#!/usr/bin/env python3
"""
One-time import of both_lab_table.csv into the Paper table.

Performs a stratified 80/20 split so each class (include/exclude) is
proportionally represented in the initial validation set.

Safe to re-run: papers with an existing DOI are skipped via ON CONFLICT.
Papers without a DOI are inserted unconditionally (Postgres allows multiple NULLs
in a unique column).
"""
import csv
import re
import random
from pathlib import Path

from db import get_conn

CSV_PATH = Path(__file__).parent / "both_lab_table.csv"
RANDOM_SEED = 42
VAL_RATIO = 0.20


def clean_doi(val):
    if not val or val.strip().upper() == "NA":
        return None
    val = re.sub(r"^https?://(dx\.)?doi\.org/", "", val.strip(), flags=re.I)
    return val.lower() or None


def parse_authors(val):
    """Parse R-style c("Name1", "Name2") or plain comma/semicolon lists."""
    if not val or val.strip().upper() == "NA":
        return []
    names = re.findall(r'"([^"]+)"', val)
    if names:
        return names
    return [n.strip() for n in re.split(r"[;,]", val) if n.strip()]


def na(val):
    if not val or str(val).strip().upper() == "NA":
        return None
    return str(val).strip() or None


def main():
    random.seed(RANDOM_SEED)

    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    print(f"Read {len(rows)} rows from {CSV_PATH.name}")

    # separate by class for stratified split
    include = [r for r in rows if r.get("code", "").strip() == "Yes"]
    exclude = [r for r in rows if r.get("code", "").strip() == "No"]

    random.shuffle(include)
    random.shuffle(exclude)

    n_val_inc = int(len(include) * VAL_RATIO)
    n_val_exc = int(len(exclude) * VAL_RATIO)

    val_ids = (
        {id(r) for r in include[:n_val_inc]}
        | {id(r) for r in exclude[:n_val_exc]}
    )

    inserted = skipped = no_title = 0

    conn = get_conn()
    try:
        cur = conn.cursor()

        for row in rows:
            title = na(row.get("TITLE"))
            if not title:
                no_title += 1
                continue

            doi = clean_doi(row.get("DOI", ""))
            status = "ACCEPTED" if row.get("code", "").strip() == "Yes" else "EXCLUDED"
            is_val = id(row) in val_ids

            year_raw = na(row.get("YEAR"))
            year = int(year_raw) if year_raw and year_raw.isdigit() else None
            authors = parse_authors(row.get("AUTHOR", ""))
            abstract = na(row.get("ABSTRACT"))

            if doi:
                cur.execute(
                    """
                    INSERT INTO "Paper"
                        ("createdAt", "updatedAt", title, authors, year, doi,
                         abstract, status, "isValidation")
                    VALUES
                        (NOW(), NOW(), %s, %s, %s, %s, %s, %s::"PaperStatus", %s)
                    ON CONFLICT (doi) DO NOTHING
                    """,
                    (title, authors, year, doi, abstract, status, is_val),
                )
            else:
                cur.execute(
                    """
                    INSERT INTO "Paper"
                        ("createdAt", "updatedAt", title, authors, year,
                         abstract, status, "isValidation")
                    VALUES
                        (NOW(), NOW(), %s, %s, %s, %s, %s::"PaperStatus", %s)
                    """,
                    (title, authors, year, abstract, status, is_val),
                )

            if cur.rowcount:
                inserted += 1
            else:
                skipped += 1

        conn.commit()
    finally:
        conn.close()

    print(f"Inserted : {inserted}")
    print(f"Skipped  : {skipped}  (duplicate DOI)")
    print(f"No title : {no_title}  (skipped)")
    print(f"Val set  : {n_val_inc + n_val_exc} papers  "
          f"({n_val_inc} include / {n_val_exc} exclude)")


if __name__ == "__main__":
    main()
