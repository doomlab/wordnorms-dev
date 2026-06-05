#!/usr/bin/env python3
"""
Download PDFs and extract corresponding-author emails from the first two pages.

PDFs are saved to pipeline/pdfs/{id}.pdf  (gitignored).
Emails are appended to pipeline/pdfs/emails.csv.

Resolution strategy per paper:
  1. Try pdfUrl directly (if it's already a PDF)
  2. Resolve landing pages: Zenodo API, citation_pdf_url meta tag, .pdf href scan
  3. Try Unpaywall for an open-access PDF URL
  4. Try Semantic Scholar for an open-access PDF URL
  5. Try CORE.ac.uk (set CORE_API_KEY env var for higher rate limits)
  6. Try Google Scholar via scholarly (opt-in: --scholar)
  7. Try Sci-Hub via headless Chromium (requires: pip install playwright && playwright install chromium)
  8. Extract emails from first 2 pages of whatever we download

Modes (pick one):
  (default)        Only papers that failed with pdf_error
  --all-missing    Also papers with no extraction record yet
  --all            All accepted papers (for full email collection)

Usage:
    python download_pdfs.py                  # retry pdf_error papers
    python download_pdfs.py --all            # collect emails from every paper
    python download_pdfs.py --limit 20       # first N papers
    python download_pdfs.py --delay 3        # seconds between requests (default 2)
"""
import argparse
import csv
import io
import os
import re
import time
from urllib.parse import urljoin

import pdfplumber
import requests

try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

from db import get_conn, get_engine

PDF_DIR = os.path.join(os.path.dirname(__file__), "pdfs")
EMAILS_CSV = os.path.join(PDF_DIR, "emails.csv")
CONTACT_EMAIL = "buchananlab@gmail.com"

_BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

PDF_HEADERS = {
    "User-Agent": _BROWSER_UA,
    "Accept": "application/pdf,*/*",
}
HTML_HEADERS = {
    "User-Agent": _BROWSER_UA,
    "Accept": "text/html,*/*",
}

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
SKIP_DOMAINS = {"example.com", "test.com", "elsevier.com", "springer.com",
                "wiley.com", "tandfonline.com", "sagepub.com", "apa.org"}


# ---------------------------------------------------------------------------
# PDF resolution helpers
# ---------------------------------------------------------------------------

def fetch_pdf(url):
    """GET url; return (bytes, note) if it's a PDF, else (None, reason)."""
    try:
        r = requests.get(url, headers=PDF_HEADERS, timeout=30, allow_redirects=True)
        if r.status_code == 200:
            if b"%PDF" in r.content[:1024]:
                return r.content, "ok"
            ct = r.headers.get("Content-Type", "")
            return None, f"200 but not PDF ({ct[:40]})"
        return None, f"HTTP {r.status_code}"
    except Exception as e:
        return None, f"err:{e}"


def zenodo_pdf_url(record_id):
    """Query Zenodo API for the PDF file URL in a record."""
    try:
        r = requests.get(
            f"https://zenodo.org/api/records/{record_id}",
            headers={"Accept": "application/json"},
            timeout=15,
        )
        if r.status_code == 200:
            for f in r.json().get("files", []):
                key = f.get("key", "")
                if key.lower().endswith(".pdf"):
                    return f.get("links", {}).get("self")
    except Exception:
        pass
    return None


def html_pdf_url(url):
    """Fetch a landing page and look for a PDF URL via meta tag or href."""
    try:
        r = requests.get(url, headers=HTML_HEADERS, timeout=20, allow_redirects=True)
        if r.status_code != 200:
            return None
        html = r.text
        base = r.url

        # citation_pdf_url meta tag — most reliable across repos
        for pattern in [
            r'<meta[^>]+name=["\']citation_pdf_url["\'][^>]+content=["\']([^"\']+)["\']',
            r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']citation_pdf_url["\']',
        ]:
            m = re.search(pattern, html, re.IGNORECASE)
            if m:
                return urljoin(base, m.group(1))

        # Direct .pdf href
        m = re.search(r'href=["\']([^"\']+\.pdf(?:\?[^"\']*)?)["\']', html, re.IGNORECASE)
        if m:
            return urljoin(base, m.group(1))
    except Exception:
        pass
    return None



SCIHUB_DOMAINS = ["sci-hub.ru", "sci-hub.st"]

def scihub_fetch(doi, browser):
    """Use Playwright to load Sci-Hub and download the PDF in the same browser session."""
    if not doi or not browser:
        return None, "no doi or browser"
    domain_notes = []
    for domain in SCIHUB_DOMAINS:
        page = None
        try:
            page = browser.new_page()
            page.goto(f"https://{domain}/{doi}", wait_until="domcontentloaded", timeout=40000)
            # Wait for DDoS challenge to resolve and the actual PDF embed to appear
            try:
                page.wait_for_selector(
                    "iframe#pdf, embed[src], a[href*='.pdf']",
                    timeout=20000,
                )
            except Exception:
                pass  # read whatever is there and let the regex decide
            html = page.content()

            pdf_url = None
            for pat in [
                r'<iframe[^>]+id=["\']pdf["\'][^>]+src=["\']([^"\']+)["\']',
                r'<iframe[^>]+src=["\']([^"\']+)["\'][^>]+id=["\']pdf["\']',
                r'<embed[^>]+src=["\']([^"\']+\.pdf[^"\']*)["\']',
                r'''href=["']([^"']*\.pdf[^"']*)["']''',
            ]:
                m = re.search(pat, html, re.IGNORECASE)
                if m:
                    url = m.group(1)
                    if url.startswith("//"):
                        url = "https:" + url
                    elif not url.startswith("http"):
                        url = f"https://{domain}{url}"
                    pdf_url = url
                    break

            if not pdf_url:
                page.close()
                domain_notes.append(f"{domain}:no pdf link")
                continue  # try next domain

            print(f"\n    [scihub] found {pdf_url[:80]}", end=" ", flush=True)

            # Use Playwright's request context to download the PDF —
            # shares the full browser session (cookies across all domains, headers)
            # without opening a PDF viewer
            try:
                api_resp = page.context.request.get(
                    pdf_url,
                    headers={
                        "Referer": f"https://{domain}/{doi}",
                        "Accept": "application/pdf,*/*",
                    },
                    timeout=30000,
                )
                body = api_resp.body()
                page.close()
                if body and b"%PDF" in body[:1024]:
                    return body, "ok"
                return None, f"HTTP {api_resp.status} / not PDF ({len(body)} bytes)"
            except Exception as e:
                page.close()
                return None, f"download err: {e}"

        except Exception as e:
            if page:
                try:
                    page.close()
                except Exception:
                    pass
            domain_notes.append(f"{domain}:err:{e}")
            continue
    return None, " | ".join(domain_notes) if domain_notes else "all domains failed"


def unpaywall_pdf_url(doi):
    """Ask Unpaywall for an open-access PDF URL."""
    if not doi:
        return None
    try:
        r = requests.get(
            f"https://api.unpaywall.org/v2/{doi}?email={CONTACT_EMAIL}",
            timeout=15,
        )
        if r.status_code == 200:
            loc = r.json().get("best_oa_location") or {}
            return loc.get("url_for_pdf")
    except Exception:
        pass
    return None


def plos_resolve(title):
    """Search PLOS API by title, return (doi, pdf_url) or (None, None)."""
    if not title:
        return None, None
    try:
        r = requests.get(
            "https://api.plos.org/search",
            params={"q": f'title:"{title}"', "fl": "id,title", "wt": "json", "rows": 1},
            timeout=15,
        )
        if r.status_code == 200:
            docs = r.json().get("response", {}).get("docs", [])
            if docs:
                doi = docs[0].get("id", "")
                if doi.startswith("10.1371/"):
                    pdf_url = f"https://journals.plos.org/plosone/article/file?id={doi}&type=printable"
                    return doi, pdf_url
    except Exception:
        pass
    return None, None


def semantic_scholar_pdf_url(doi):
    """Ask Semantic Scholar for an open-access PDF URL."""
    if not doi:
        return None
    try:
        r = requests.get(
            f"https://api.semanticscholar.org/graph/v1/paper/DOI:{doi}",
            params={"fields": "openAccessPdf"},
            timeout=15,
        )
        if r.status_code == 200:
            oa = r.json().get("openAccessPdf") or {}
            return oa.get("url")
    except Exception:
        pass
    return None


def core_pdf_url(doi, title=None):
    """Search CORE.ac.uk for an open-access PDF URL. Uses CORE_API_KEY env var if set."""
    if not doi and not title:
        return None
    try:
        params = {"limit": 1}
        api_key = os.environ.get("CORE_API_KEY", "")
        if api_key:
            params["api_key"] = api_key
        params["q"] = f'doi:"{doi}"' if doi else f'title:"{title}"'
        r = requests.get(
            "https://api.core.ac.uk/v3/search/outputs",
            params=params,
            timeout=15,
        )
        if r.status_code == 200:
            results = r.json().get("results", [])
            if results:
                return results[0].get("downloadUrl")
    except Exception:
        pass
    return None


def scholarly_pdf_url(title, doi=None):
    """Search Google Scholar via scholarly for a direct PDF link."""
    try:
        from scholarly import scholarly as _scholarly
        query = doi if doi else title
        results = _scholarly.search_pubs(query)
        pub = next(results, None)
        if pub:
            return pub.get("eprint_url")
    except Exception:
        pass
    return None


def get_pdf(pdf_url, doi, browser=None, semantic_scholar_only=False, scholar=False, title=None, conn=None):
    """Try all strategies to retrieve PDF bytes. Returns (bytes, source) or (None, reason)."""
    reasons = []

    # If no DOI, try PLOS title search first — many missing-DOI papers are PLOS ONE
    if not doi and title:
        found_doi, plos_url = plos_resolve(title)
        if found_doi:
            doi = found_doi
            if conn:
                cur = conn.cursor()
                cur.execute('UPDATE "Paper" SET doi = %s WHERE doi IS NULL AND title = %s',
                            (doi, title))
                conn.commit()
            if plos_url:
                data, note = fetch_pdf(plos_url)
                if data:
                    return data, "plos"
                reasons.append(f"plos:{note}")
        else:
            reasons.append("plos:not found")

    if not semantic_scholar_only:
        if pdf_url:
            # Direct download
            data, note = fetch_pdf(pdf_url)
            if data:
                return data, "direct"
            reasons.append(f"direct:{note}")

            # Zenodo landing page
            m = re.search(r"zenodo\.org/(?:record|records)/(\d+)", pdf_url)
            if m:
                resolved = zenodo_pdf_url(m.group(1))
                if resolved:
                    data, note = fetch_pdf(resolved)
                    if data:
                        return data, "zenodo"
                    reasons.append(f"zenodo:{note}")
                else:
                    reasons.append("zenodo:no file found")

            # Generic landing page (handle.net, figshare, institutional repos)
            resolved = html_pdf_url(pdf_url)
            if resolved:
                data, note = fetch_pdf(resolved)
                if data:
                    return data, "html"
                reasons.append(f"html:{note}")
            else:
                reasons.append("html:no pdf link")

        # Unpaywall fallback
        if doi:
            resolved = unpaywall_pdf_url(doi)
            if resolved:
                data, note = fetch_pdf(resolved)
                if data:
                    return data, "unpaywall"
                reasons.append(f"unpaywall:{note}")
            else:
                reasons.append("unpaywall:no oa url")
            time.sleep(0.5)

    # Semantic Scholar
    if doi:
        resolved = semantic_scholar_pdf_url(doi)
        if resolved:
            data, note = fetch_pdf(resolved)
            if data:
                return data, "semanticscholar"
            reasons.append(f"semanticscholar:{note}")
        else:
            reasons.append("semanticscholar:no oa url")
        time.sleep(0.5)

    # CORE.ac.uk
    if not semantic_scholar_only:
        resolved = core_pdf_url(doi, title=title)
        if resolved:
            data, note = fetch_pdf(resolved)
            if data:
                return data, "core"
            reasons.append(f"core:{note}")
        else:
            reasons.append("core:no result")
        time.sleep(0.5)

    # Google Scholar via scholarly
    if scholar and title:
        resolved = scholarly_pdf_url(title, doi=doi)
        if resolved:
            data, note = fetch_pdf(resolved)
            if data:
                return data, "scholar"
            reasons.append(f"scholar:{note}")
        else:
            reasons.append("scholar:no pdf link")
        time.sleep(1)

    if not semantic_scholar_only:
        # Sci-Hub via headless browser (last resort — requires DOI)
        if not doi:
            reasons.append("scihub:skipped (no doi)")
        elif browser:
            time.sleep(3)  # be polite — don't hammer Sci-Hub
            data, note = scihub_fetch(doi, browser)
            if data:
                return data, "scihub"
            reasons.append(f"scihub:{note}")

    return None, " | ".join(reasons) if reasons else "no pdf_url or doi"


# ---------------------------------------------------------------------------
# Email extraction
# ---------------------------------------------------------------------------

def extract_emails(pdf_bytes):
    """Extract email addresses from the first 2 pages of a PDF."""
    emails = []
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages[:2]:
                text = page.extract_text() or ""
                for m in EMAIL_RE.finditer(text):
                    addr = m.group().lower().rstrip(".")
                    domain = addr.split("@")[-1]
                    if domain not in SKIP_DOMAINS and "." in domain:
                        emails.append(addr)
    except Exception:
        pass
    return list(dict.fromkeys(emails))


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def load_papers(engine, limit=None, all_missing=False, all_papers=False, before_id=None, from_id=None):
    import pandas as pd
    id_filter = ""
    if before_id:
        id_filter += f" AND p.id < {int(before_id)}"
    if from_id:
        id_filter += f" AND p.id >= {int(from_id)}"
    if all_papers:
        query = f"""
            SELECT p.id, p.title, p.doi, p."pdfUrl"
            FROM "Paper" p
            WHERE p.status = 'ACCEPTED'::"PaperStatus"
              AND p."canonicalPaperId" IS NULL
              {id_filter}
            ORDER BY p.id
        """
    elif all_missing:
        query = f"""
            SELECT p.id, p.title, p.doi, p."pdfUrl"
            FROM "Paper" p
            LEFT JOIN "PaperExtraction" pe ON pe."paperId" = p.id
            WHERE p.status = 'ACCEPTED'::"PaperStatus"
              AND p."canonicalPaperId" IS NULL
              AND (pe.id IS NULL OR pe."extractedBy" = 'failed:pdf_error')
              {id_filter}
            ORDER BY p.id
        """
    else:
        query = f"""
            SELECT p.id, p.title, p.doi, p."pdfUrl"
            FROM "Paper" p
            JOIN "PaperExtraction" pe ON pe."paperId" = p.id
            WHERE p.status = 'ACCEPTED'::"PaperStatus"
              AND p."canonicalPaperId" IS NULL
              AND pe."extractedBy" = 'failed:pdf_error'
              {id_filter}
            ORDER BY p.id
        """
    if limit:
        query += f" LIMIT {int(limit)}"
    return pd.read_sql(query, engine)


def mark_retryable(conn, paper_id):
    """Mark a successfully-downloaded paper so --retry-failed picks it up next."""
    cur = conn.cursor()
    cur.execute(
        """UPDATE "PaperExtraction"
           SET "extractedBy" = 'failed:pdf_error_retryable'
           WHERE "paperId" = %s AND "extractedBy" = 'failed:pdf_error'""",
        (paper_id,),
    )
    conn.commit()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--delay", type=float, default=2.0,
                        help="Seconds between papers (default: 2)")
    parser.add_argument("--all-missing", action="store_true",
                        help="Also include papers with no extraction record")
    parser.add_argument("--all", action="store_true",
                        help="All accepted papers — for collecting emails across the full corpus")
    parser.add_argument("--before-id", type=int, default=None,
                        help="Only process papers with id < N")
    parser.add_argument("--from-id", type=int, default=None,
                        help="Only process papers with id >= N (resume from a specific point)")
    parser.add_argument("--semantic-scholar-only", action="store_true",
                        help="Skip all other sources; only try Semantic Scholar (good for re-runs after prior failures)")
    parser.add_argument("--scholar", action="store_true",
                        help="Also search Google Scholar via scholarly (slow, rate-limited — use with --delay 5+)")
    parser.add_argument("--headed", action="store_true",
                        help="Run Playwright in headed mode (visible browser) for debugging")
    args = parser.parse_args()

    os.makedirs(PDF_DIR, exist_ok=True)

    engine = get_engine()
    conn = get_conn()
    df = load_papers(engine, limit=args.limit, all_missing=args.all_missing, all_papers=args.all, before_id=args.before_id, from_id=args.from_id)
    print(f"Found {len(df)} papers to attempt\n")

    playwright_ctx = None
    browser = None
    if PLAYWRIGHT_AVAILABLE:
        playwright_ctx = sync_playwright().start()
        browser = playwright_ctx.chromium.launch(headless=not args.headed)
        print("Playwright ready (Sci-Hub fallback enabled)\n")
    else:
        print("Playwright not installed — Sci-Hub fallback disabled\n")

    csv_exists = os.path.exists(EMAILS_CSV)
    csv_file = open(EMAILS_CSV, "a", newline="", encoding="utf-8")
    writer = csv.writer(csv_file)
    if not csv_exists:
        writer.writerow(["paper_id", "doi", "title", "emails"])

    downloaded = already_have = failed = 0
    failures_csv = os.path.join(PDF_DIR, "failed_downloads.csv")
    failures_file = open(failures_csv, "w", newline="", encoding="utf-8")
    failures_writer = csv.writer(failures_file)
    failures_writer.writerow(["paper_id", "doi", "title", "reason"])

    for _, row in df.iterrows():
        paper_id = int(row["id"])
        doi = str(row.get("doi") or "").strip()
        if doi in ("nan", "None"):
            doi = ""
        pdf_path = os.path.join(PDF_DIR, f"{paper_id}.pdf")

        if os.path.exists(pdf_path):
            # Validate — delete and retry if the file isn't actually a PDF
            with open(pdf_path, "rb") as f:
                header = f.read(8)
            if b"%PDF" in header:
                print(f"  [{paper_id}] already downloaded, skipping")
                already_have += 1
                continue
            else:
                print(f"  [{paper_id}] existing file is corrupt, re-downloading")
                os.remove(pdf_path)

        title_short = str(row["title"])[:65]
        print(f"  [{paper_id}] {title_short} ...", end=" ", flush=True)

        pdf_url = row.get("pdfUrl")
        if not isinstance(pdf_url, str):
            pdf_url = None
        pdf_bytes, source = get_pdf(pdf_url, doi, browser=browser,
                                    semantic_scholar_only=args.semantic_scholar_only,
                                    scholar=args.scholar,
                                    title=str(row["title"]), conn=conn)

        if pdf_bytes is None:
            print(f"failed — {source}")
            failures_writer.writerow([paper_id, doi or "", str(row["title"]), source])
            failures_file.flush()
            failed += 1
            time.sleep(args.delay)
            continue

        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)

        mark_retryable(conn, paper_id)

        emails = extract_emails(pdf_bytes)
        if emails:
            writer.writerow([paper_id, doi, row["title"], "; ".join(emails)])
            csv_file.flush()
            email_str = ", ".join(emails[:2]) + ("..." if len(emails) > 2 else "")
            print(f"[{source}] → {email_str}")
        else:
            print(f"[{source}] → no email found")

        downloaded += 1
        time.sleep(args.delay)

    csv_file.close()
    failures_file.close()
    if browser:
        browser.close()
    if playwright_ctx:
        playwright_ctx.stop()
    conn.close()
    engine.dispose()

    print(f"\nDone — downloaded: {downloaded}  |  already had: {already_have}  |  failed: {failed}")
    print(f"Emails: {EMAILS_CSV}")

    if failed:
        print(f"Failed list: {failures_csv}")

    print(f"Re-extract with local PDFs: python extract_local.py --retry-failed --pdf-dir pdfs")


if __name__ == "__main__":
    main()
