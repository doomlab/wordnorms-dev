#!/usr/bin/env python3
"""
Download PDFs for papers that previously failed with pdf_error,
and extract corresponding-author emails from the first two pages.

PDFs are saved to pipeline/pdfs/{id}.pdf  (gitignored).
Emails are appended to pipeline/pdfs/emails.csv.

Strategy per paper:
  1. Try pdfUrl directly (with polite headers + redirects)
  2. If that fails, query Unpaywall for an open-access PDF URL
  3. Extract emails from first 2 pages of whatever we download

Usage:
    python download_pdfs.py                  # all failed:pdf_error papers
    python download_pdfs.py --limit 20       # first 20
    python download_pdfs.py --delay 3        # seconds between requests (default 2)
    python download_pdfs.py --all-missing    # also include papers with no extraction at all
"""
import argparse
import csv
import os
import re
import time

import pdfplumber
import requests

from db import get_conn, get_engine

PDF_DIR = os.path.join(os.path.dirname(__file__), "pdfs")
EMAILS_CSV = os.path.join(PDF_DIR, "emails.csv")
CONTACT_EMAIL = "buchananlab@gmail.com"

HEADERS = {
    "User-Agent": f"WordNormsResearchBot/1.0 (academic research; mailto:{CONTACT_EMAIL})",
    "Accept": "application/pdf,*/*",
}

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
# Common false-positive domains to skip
SKIP_DOMAINS = {"example.com", "test.com", "elsevier.com", "springer.com",
                "wiley.com", "tandfonline.com", "sagepub.com", "apa.org"}


def load_papers(engine, limit=None, all_missing=False):
    import pandas as pd
    if all_missing:
        query = """
            SELECT p.id, p.title, p.doi, p."pdfUrl"
            FROM "Paper" p
            LEFT JOIN "PaperExtraction" pe ON pe."paperId" = p.id
            WHERE p.status = 'ACCEPTED'::"PaperStatus"
              AND (pe.id IS NULL OR pe."extractedBy" = 'failed:pdf_error')
            ORDER BY p.id
        """
    else:
        query = """
            SELECT p.id, p.title, p.doi, p."pdfUrl"
            FROM "Paper" p
            JOIN "PaperExtraction" pe ON pe."paperId" = p.id
            WHERE p.status = 'ACCEPTED'::"PaperStatus"
              AND pe."extractedBy" = 'failed:pdf_error'
            ORDER BY p.id
        """
    if limit:
        query += f" LIMIT {int(limit)}"
    return pd.read_sql(query, engine)


def try_download(url):
    """Try to download a PDF from url. Returns bytes or None."""
    try:
        r = requests.get(url, headers=HEADERS, timeout=30, allow_redirects=True)
        if r.status_code == 200 and b"%PDF" in r.content[:1024]:
            return r.content
    except Exception:
        pass
    return None


def unpaywall_pdf_url(doi):
    """Ask Unpaywall for an open-access PDF URL. Returns url string or None."""
    if not doi:
        return None
    try:
        r = requests.get(
            f"https://api.unpaywall.org/v2/{doi}?email={CONTACT_EMAIL}",
            timeout=15,
        )
        if r.status_code == 200:
            data = r.json()
            loc = data.get("best_oa_location") or {}
            return loc.get("url_for_pdf")
    except Exception:
        pass
    return None


def extract_emails(pdf_bytes):
    """Extract email addresses from the first 2 pages of a PDF."""
    emails = []
    try:
        import io
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
    return list(dict.fromkeys(emails))  # deduplicate, preserve order


def mark_downloaded(conn, paper_id):
    """Reset extractedBy from failed:pdf_error so --retry-failed picks it up."""
    cur = conn.cursor()
    cur.execute(
        """UPDATE "PaperExtraction" SET "extractedBy" = 'failed:pdf_error_retryable'
           WHERE "paperId" = %s AND "extractedBy" = 'failed:pdf_error'""",
        (paper_id,),
    )
    conn.commit()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--delay", type=float, default=2.0,
                        help="Seconds between requests (default: 2)")
    parser.add_argument("--all-missing", action="store_true",
                        help="Also include papers with no extraction record")
    args = parser.parse_args()

    os.makedirs(PDF_DIR, exist_ok=True)

    engine = get_engine()
    conn = get_conn()
    df = load_papers(engine, limit=args.limit, all_missing=args.all_missing)
    print(f"Found {len(df)} papers to attempt")

    csv_exists = os.path.exists(EMAILS_CSV)
    csv_file = open(EMAILS_CSV, "a", newline="", encoding="utf-8")
    writer = csv.writer(csv_file)
    if not csv_exists:
        writer.writerow(["paper_id", "doi", "title", "emails"])

    downloaded = skipped = 0

    for _, row in df.iterrows():
        paper_id = int(row["id"])
        doi = row.get("doi") or ""
        pdf_path = os.path.join(PDF_DIR, f"{paper_id}.pdf")

        # Skip if already downloaded
        if os.path.exists(pdf_path):
            print(f"  [{paper_id}] already have PDF, skipping")
            skipped += 1
            continue

        title_short = str(row["title"])[:60]
        print(f"  [{paper_id}] {title_short} ...", end=" ", flush=True)

        pdf_bytes = None

        # 1. Try pdfUrl
        if row.get("pdfUrl"):
            pdf_bytes = try_download(row["pdfUrl"])
            if pdf_bytes:
                print("direct", end=" ")

        # 2. Try Unpaywall
        if pdf_bytes is None and doi:
            oa_url = unpaywall_pdf_url(doi)
            if oa_url:
                pdf_bytes = try_download(oa_url)
                if pdf_bytes:
                    print("unpaywall", end=" ")
            time.sleep(0.5)  # extra courtesy for Unpaywall

        if pdf_bytes is None:
            print("failed")
            skipped += 1
            time.sleep(args.delay)
            continue

        # Save PDF
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)

        # Extract emails
        emails = extract_emails(pdf_bytes)
        if emails:
            writer.writerow([paper_id, doi, row["title"], "; ".join(emails)])
            csv_file.flush()
            print(f"→ {', '.join(emails[:2])}{'...' if len(emails) > 2 else ''}")
        else:
            print("→ no email found")

        downloaded += 1
        time.sleep(args.delay)

    csv_file.close()
    conn.close()
    engine.dispose()

    print(f"\nDone — downloaded: {downloaded}  |  skipped/failed: {skipped}")
    print(f"Emails saved to: {EMAILS_CSV}")
    print(f"To re-extract with local PDFs:")
    print(f"  python extract_local.py --retry-failed --pdf-dir pdfs")


if __name__ == "__main__":
    main()
