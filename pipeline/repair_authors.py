"""
repair_authors.py — Fix papers where all author names were stored as a single
concatenated string (a seed.py import artifact). Uses the Crossref API to
fetch correct structured author data for each affected paper.

Usage:
    python pipeline/repair_authors.py [--dry-run]
"""

import argparse
import time
import requests
from db import get_conn

CROSSREF_URL = "https://api.crossref.org/works/{doi}"
HEADERS = {"User-Agent": "wordnorms-dev/1.0 (mailto:buchananlab@gmail.com)"}


def fetch_authors_crossref(doi):
    try:
        r = requests.get(CROSSREF_URL.format(doi=doi), headers=HEADERS, timeout=10)
        if r.status_code != 200:
            return None
        data = r.json().get("message", {})
        authors = data.get("author", [])
        names = []
        for a in authors:
            given = a.get("given", "").strip()
            family = a.get("family", "").strip()
            if family:
                names.append(f"{given} {family}".strip() if given else family)
        return names if names else None
    except Exception as e:
        print(f"  error fetching {doi}: {e}")
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print changes without writing")
    args = parser.parse_args()

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, doi, authors[1]
        FROM "Paper"
        WHERE array_length(authors, 1) = 1
          AND LENGTH(authors[1]) > 50
          AND doi IS NOT NULL
        ORDER BY id
    """)
    rows = cur.fetchall()
    print(f"Found {len(rows)} papers with squished authors\n")

    fixed = 0
    failed = 0

    for paper_id, doi, squished in rows:
        names = fetch_authors_crossref(doi)
        if names:
            print(f"[{paper_id}] {doi}")
            print(f"  was: {squished[:80]}{'…' if len(squished) > 80 else ''}")
            print(f"  now: {', '.join(names)}")
            if not args.dry_run:
                cur.execute(
                    'UPDATE "Paper" SET authors = %s WHERE id = %s',
                    (names, paper_id),
                )
                conn.commit()
            fixed += 1
        else:
            print(f"[{paper_id}] {doi} — no Crossref data, skipping")
            failed += 1

        time.sleep(0.1)  # be polite to Crossref

    print(f"\nDone: {fixed} fixed, {failed} skipped")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
