"""
repair_authors.py — Enriches Paper records from OpenAlex (primary) + Crossref (fallback).

Fills in missing fields for all papers that have a DOI:
  • openAlexId   – OpenAlex work ID
  • year         – publication year
  • abstract     – paper abstract
  • journal      – journal / venue name
  • authors      – structured author list (also fixes squished single-string entries)
  • pdfUrl       – open-access PDF link, if available

OpenAlex is queried first (free, no API key). Crossref is used as a fallback
for authors and journal when OpenAlex has no usable data.

Safe to stop and resume — re-queries the DB each run for still-missing records.

Usage:
    python pipeline/repair_authors.py [--dry-run] [--delay 1.0] [--limit N]
"""

import argparse
import re
import time

import requests

from db import get_conn

CONTACT_EMAIL = "buchananlab@gmail.com"
HEADERS = {
    "Accept": "application/json",
    "User-Agent": f"wordnorms-repair ({CONTACT_EMAIL})",
}


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _clean_doi(doi):
    return re.sub(r"^https?://(dx\.)?doi\.org/", "", (doi or "").strip(), flags=re.I)


def _decode_abstract(inv):
    if not isinstance(inv, dict) or not inv:
        return None
    pos2tok = {p: t for t, ps in inv.items() for p in ps}
    txt = " ".join(pos2tok.get(i, "") for i in range(max(pos2tok) + 1))
    txt = re.sub(r"\s+([,.!?;:])", r"\1", txt)
    return re.sub(r"\s{2,}", " ", txt).strip() or None


def _safe_get(url, params=None, timeout=30):
    try:
        r = requests.get(url, params=params, headers=HEADERS, timeout=timeout)
        if r.status_code == 429:
            return None, "rate_limited"
        r.raise_for_status()
        return r.json(), None
    except requests.exceptions.HTTPError as e:
        return None, f"HTTP {r.status_code}"
    except Exception as e:
        return None, str(e)


# ---------------------------------------------------------------------------
# OpenAlex lookup by DOI
# ---------------------------------------------------------------------------

def fetch_openalex(doi):
    """
    Returns (data_dict, error_str). data_dict has keys:
      openalex_id, year, abstract, journal, authors, pdf_url
    All values may be None.
    """
    js, err = _safe_get(f"https://api.openalex.org/works/https://doi.org/{_clean_doi(doi)}")
    if err or not js:
        return None, err

    authors = [
        a["author"]["display_name"]
        for a in js.get("authorships", [])
        if (a.get("author") or {}).get("display_name")
    ]

    best_oa = js.get("best_oa_location") or {}
    primary = js.get("primary_location") or {}
    oa = js.get("open_access") or {}
    pdf_url = best_oa.get("pdf_url") or primary.get("pdf_url") or oa.get("oa_url")

    return {
        "openalex_id": js.get("id"),
        "year":        js.get("publication_year"),
        "abstract":    _decode_abstract(js.get("abstract_inverted_index")),
        "journal":     ((primary.get("source") or {}).get("display_name")),
        "authors":     authors or None,
        "pdf_url":     pdf_url,
    }, None


# ---------------------------------------------------------------------------
# Crossref fallback (authors + journal only)
# ---------------------------------------------------------------------------

def fetch_crossref(doi):
    """Returns dict with 'authors' and 'journal', or None on error."""
    js, err = _safe_get(f"https://api.crossref.org/works/{_clean_doi(doi)}")
    if err or not js:
        return None

    msg = js.get("message") or {}
    authors = []
    for a in msg.get("author", []):
        given = a.get("given", "").strip()
        family = a.get("family", "").strip()
        if family:
            authors.append(f"{given} {family}".strip() if given else family)

    titles = msg.get("container-title", [])
    return {
        "authors": authors or None,
        "journal": titles[0].strip() if titles else None,
    }


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def _is_squished(authors):
    return bool(authors and len(authors) == 1 and len(authors[0]) > 50)


def load_remaining(cur, limit=None):
    q = """
        SELECT id, doi, "openAlexId", year, abstract, journal, "pdfUrl", authors
        FROM "Paper"
        WHERE doi IS NOT NULL
          AND (
            "openAlexId" IS NULL
            OR year IS NULL
            OR abstract IS NULL
            OR journal IS NULL
            OR "pdfUrl" IS NULL
            OR (array_length(authors, 1) = 1 AND LENGTH(authors[1]) > 50)
          )
        ORDER BY id
    """
    if limit:
        q += f" LIMIT {int(limit)}"
    cur.execute(q)
    cols = ["id", "doi", "openalex_id", "year", "abstract", "journal", "pdf_url", "authors"]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def apply_updates(cur, paper_id, updates):
    """Build and run an UPDATE for only the fields in `updates`."""
    col_map = {
        "openalex_id": '"openAlexId"',
        "year":        "year",
        "abstract":    "abstract",
        "journal":     "journal",
        "authors":     "authors",
        "pdf_url":     '"pdfUrl"',
    }
    clauses, values = [], []
    for key, val in updates.items():
        clauses.append(f"{col_map[key]} = %s")
        values.append(val)
    if not clauses:
        return
    values.append(paper_id)
    cur.execute(f'UPDATE "Paper" SET {", ".join(clauses)} WHERE id = %s', values)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print changes without writing")
    parser.add_argument("--delay", type=float, default=1.0, help="Seconds between papers (default 1.0)")
    parser.add_argument("--limit", type=int, default=None, help="Process at most N papers")
    args = parser.parse_args()

    conn = get_conn()
    cur = conn.cursor()

    rows = load_remaining(cur, limit=args.limit)
    total = len(rows)
    print(f"Found {total} papers needing enrichment\n")

    updated = unchanged = 0

    for i, row in enumerate(rows, 1):
        print(f"[{i}/{total}] paper {row['id']} — {row['doi']}")
        updates = {}

        # --- OpenAlex ---
        oa, err = fetch_openalex(row["doi"])
        if err == "rate_limited":
            print("  ⚠ OpenAlex rate limited — pausing 60s")
            time.sleep(60)
            oa, err = fetch_openalex(row["doi"])

        if oa:
            if row["openalex_id"] is None and oa["openalex_id"]:
                updates["openalex_id"] = oa["openalex_id"]
                print(f"  openalex_id → {oa['openalex_id']}")
            if row["year"] is None and oa["year"]:
                updates["year"] = oa["year"]
                print(f"  year → {oa['year']}")
            if row["abstract"] is None and oa["abstract"]:
                updates["abstract"] = oa["abstract"]
                print(f"  abstract → {oa['abstract'][:80]}…")
            if row["journal"] is None and oa["journal"]:
                updates["journal"] = oa["journal"]
                print(f"  journal → {oa['journal']}")
            if row["pdf_url"] is None and oa["pdf_url"]:
                updates["pdf_url"] = oa["pdf_url"]
                print(f"  pdfUrl → {oa['pdf_url']}")
            if (_is_squished(row["authors"]) or not row["authors"]) and oa["authors"]:
                updates["authors"] = oa["authors"]
                shown = ", ".join(oa["authors"][:3])
                suffix = " …" if len(oa["authors"]) > 3 else ""
                print(f"  authors ({len(oa['authors'])}) → {shown}{suffix}")
        else:
            print(f"  OpenAlex: {err or 'no data'}")

        time.sleep(args.delay * 0.4)

        # --- Crossref fallback for authors / journal ---
        need_authors  = "authors" not in updates and (_is_squished(row["authors"]) or not row["authors"])
        need_journal  = "journal" not in updates and row["journal"] is None

        if need_authors or need_journal:
            cr = fetch_crossref(row["doi"])
            if cr:
                if need_authors and cr["authors"]:
                    updates["authors"] = cr["authors"]
                    shown = ", ".join(cr["authors"][:3])
                    suffix = " …" if len(cr["authors"]) > 3 else ""
                    print(f"  authors (crossref, {len(cr['authors'])}) → {shown}{suffix}")
                if need_journal and cr["journal"]:
                    updates["journal"] = cr["journal"]
                    print(f"  journal (crossref) → {cr['journal']}")
            else:
                print("  Crossref: no data")

        if updates:
            if not args.dry_run:
                apply_updates(cur, row["id"], updates)
                conn.commit()
            label = "(dry run) " if args.dry_run else ""
            print(f"  → {label}updated: {', '.join(updates.keys())}")
            updated += 1
        else:
            print("  → nothing new")
            unchanged += 1

        if i < total:
            time.sleep(args.delay)

    print(f"\nDone: {updated} updated, {unchanged} unchanged")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
