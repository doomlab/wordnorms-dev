"""
repair_authors.py — Fix papers where all author names were stored as a single
concatenated string (a seed.py import artifact). Uses the Crossref API to
fetch correct structured author data for each affected paper.

Skips papers already fixed in a previous run (re-queries the DB each time
so it's safe to stop and resume).

Usage:
    python pipeline/repair_authors.py [--dry-run] [--delay 1.5]
"""

import argparse
import time
import requests
from db import get_conn

CROSSREF_URL = "https://api.crossref.org/works/{doi}"
HEADERS = {"User-Agent": "wordnorms-dev/1.0 (mailto:buchananlab@gmail.com)"}


def fetch_crossref(doi):
    """Returns (authors_list, journal_str) or ("rate_limited", None) or (None, None)."""
    try:
        r = requests.get(CROSSREF_URL.format(doi=doi), headers=HEADERS, timeout=15)
        if r.status_code == 429:
            return "rate_limited", None
        if r.status_code != 200:
            return None, None
        data = r.json().get("message", {})
        names = []
        for a in data.get("author", []):
            given = a.get("given", "").strip()
            family = a.get("family", "").strip()
            if family:
                names.append(f"{given} {family}".strip() if given else family)
        titles = data.get("container-title", [])
        journal = titles[0].strip() if titles else None
        return (names if names else None), journal
    except Exception as e:
        print(f"  request error: {e}")
        return None, None


def load_remaining(cur):
    cur.execute("""
        SELECT id, doi, authors[1]
        FROM "Paper"
        WHERE array_length(authors, 1) = 1
          AND LENGTH(authors[1]) > 50
          AND doi IS NOT NULL
        ORDER BY id
    """)
    return cur.fetchall()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print changes without writing")
    parser.add_argument("--delay", type=float, default=1.5, help="Seconds between API calls (default 1.5)")
    args = parser.parse_args()

    conn = get_conn()
    cur = conn.cursor()

    rows = load_remaining(cur)
    total = len(rows)
    print(f"Found {total} papers still needing repair\n")

    fixed = 0
    skipped = 0
    i = 0

    for paper_id, doi, squished in rows:
        i += 1
        print(f"[{i}/{total}] paper {paper_id} — {doi}")

        names, journal = fetch_crossref(doi)

        if names == "rate_limited":
            print(f"  ⚠ rate limited — pausing 30s then retrying")
            time.sleep(30)
            names, journal = fetch_crossref(doi)

        if names:
            print(f"  authors: {', '.join(names)}")
            if journal:
                print(f"  journal: {journal}")
            if not args.dry_run:
                cur.execute(
                    'UPDATE "Paper" SET authors = %s, journal = %s WHERE id = %s',
                    (names, journal, paper_id),
                )
                conn.commit()
            fixed += 1
        else:
            print(f"  skipped: no Crossref data")
            skipped += 1

        if i < total:
            time.sleep(args.delay)

    print(f"\nDone: {fixed} fixed, {skipped} skipped")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
