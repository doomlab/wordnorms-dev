#!/usr/bin/env python3
"""
Enrich metadata for papers that have PDFs but incomplete DB records.
For papers with a DOI, fetches directly from Crossref.
For papers missing a DOI, searches Crossref by title.
Prompts for confirmation before each update.

Usage:
    python enrich_metadata.py
    python enrich_metadata.py --limit 50
"""
import argparse
import os

import requests

from db import get_conn, get_engine

PDF_DIR = os.path.join(os.path.dirname(__file__), "pdfs")
HEADERS = {"User-Agent": "WordNorms/1.0 (mailto:buchananlab@gmail.com)"}


def crossref_by_doi(doi):
    try:
        r = requests.get(f"https://api.crossref.org/works/{doi}", headers=HEADERS, timeout=15)
        if r.ok:
            return r.json().get("message")
    except Exception:
        pass
    return None


def crossref_by_title(title):
    try:
        r = requests.get(
            "https://api.crossref.org/works",
            params={"query.title": title, "rows": 1},
            headers=HEADERS,
            timeout=15,
        )
        if r.ok:
            items = r.json().get("message", {}).get("items", [])
            if items:
                return items[0]
    except Exception:
        pass
    return None


def parse_item(item):
    title = item["title"][0] if item.get("title") else None
    pub = item.get("published") or item.get("published-print") or {}
    year = (pub.get("date-parts") or [[None]])[0][0]
    authors = [
        f"{a.get('given', '')} {a.get('family', '')}".strip()
        for a in item.get("author", [])
    ]
    abstract = item.get("abstract") or None
    doi = item.get("DOI")
    return title, year, authors, abstract, doi


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    # Collect valid PDF IDs
    pdf_ids = []
    for fname in os.listdir(PDF_DIR):
        if not fname.endswith(".pdf"):
            continue
        try:
            pid = int(fname[:-4])
        except ValueError:
            continue
        with open(os.path.join(PDF_DIR, fname), "rb") as f:
            if b"%PDF" in f.read(8):
                pdf_ids.append(pid)

    print(f"Found {len(pdf_ids)} valid PDFs\n")

    conn = get_conn()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT id, title, doi, year, authors, abstract
        FROM "Paper"
        WHERE id = ANY(%s)
          AND status = 'ACCEPTED'::"PaperStatus"
          AND "canonicalPaperId" IS NULL
          AND (
            doi IS NULL
            OR year IS NULL
            OR array_length(authors, 1) IS NULL
            OR array_length(authors, 1) = 0
          )
        ORDER BY id
        """,
        (pdf_ids,),
    )
    rows = cur.fetchall()
    print(f"{len(rows)} papers with PDFs and incomplete metadata\n")

    if args.limit:
        rows = rows[: args.limit]

    updated = skipped = 0

    for paper_id, title, doi, year, authors, abstract in rows:
        print(f"[{paper_id}] {str(title)[:70]}")
        print(f"  DB:  doi={doi or '—'}  year={year or '—'}  authors={len(authors or [])} listed")

        if doi:
            item = crossref_by_doi(doi)
            source = "doi"
        else:
            item = crossref_by_title(title)
            source = "title search"

        if not item:
            print(f"  No Crossref result — skipping\n")
            skipped += 1
            continue

        new_title, new_year, new_authors, new_abstract, new_doi = parse_item(item)
        score = round(item.get("score", 0), 1)

        print(f"  [{source}] score={score}")
        print(f"  Title:   {new_title}")
        print(f"  Year:    {new_year}  |  Authors: {', '.join((new_authors or [])[:3])}{'...' if len(new_authors or []) > 3 else ''}")
        if new_doi and not doi:
            print(f"  DOI:     {new_doi}")

        resp = input("  Update? [y/n/q] ").strip().lower()
        print()
        if resp == "q":
            break
        if resp != "y":
            skipped += 1
            continue

        # Check DOI collision before writing
        if new_doi and not doi:
            cur.execute(
                'SELECT id FROM "Paper" WHERE doi = %s AND id != %s',
                (new_doi, paper_id),
            )
            collision = cur.fetchone()
            if collision:
                print(f"  DOI already on paper {collision[0]} — linking {paper_id} as duplicate\n")
                cur.execute(
                    'UPDATE "Paper" SET "canonicalPaperId"=%s, "updatedAt"=NOW() WHERE id=%s',
                    (collision[0], paper_id),
                )
                conn.commit()
                updated += 1
                continue

        cur.execute(
            """UPDATE "Paper" SET
                doi      = COALESCE(doi, %s),
                title    = COALESCE(%s, title),
                year     = COALESCE(year, %s),
                authors  = CASE WHEN array_length(authors, 1) IS NULL OR array_length(authors, 1) = 0
                                THEN %s ELSE authors END,
                abstract = COALESCE(abstract, %s),
                "updatedAt" = NOW()
            WHERE id = %s""",
            (new_doi, new_title, new_year, new_authors, new_abstract, paper_id),
        )
        conn.commit()
        print(f"  Updated.\n")
        updated += 1

    conn.close()
    engine = get_engine()
    engine.dispose()

    print(f"\nDone — updated: {updated}  |  skipped: {skipped}")


if __name__ == "__main__":
    main()
