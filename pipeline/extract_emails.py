#!/usr/bin/env python3
"""
Scan pipeline/pdfs/ for any PDFs not yet in emails.csv and extract emails from them.
Run this after manually dropping PDFs into the folder.

Usage:
    python extract_emails.py
    python extract_emails.py --recheck    # re-extract even papers already in emails.csv
"""
import argparse
import csv
import io
import os
import re

import pdfplumber

from db import get_engine

PDF_DIR = os.path.join(os.path.dirname(__file__), "pdfs")
EMAILS_CSV = os.path.join(PDF_DIR, "emails.csv")

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
SKIP_DOMAINS = {"example.com", "test.com", "elsevier.com", "springer.com",
                "wiley.com", "tandfonline.com", "sagepub.com", "apa.org"}


def extract_emails(pdf_path):
    emails = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages[:2]:
                text = page.extract_text() or ""
                for m in EMAIL_RE.finditer(text):
                    addr = m.group().lower().rstrip(".")
                    domain = addr.split("@")[-1]
                    if domain not in SKIP_DOMAINS and "." in domain:
                        emails.append(addr)
    except Exception as e:
        return None, str(e)
    return list(dict.fromkeys(emails)), None


def load_paper_metadata(engine, paper_ids):
    import pandas as pd
    ids = ", ".join(str(i) for i in paper_ids)
    query = f"""
        SELECT id, doi, title FROM "Paper"
        WHERE id IN ({ids})
    """
    return pd.read_sql(query, engine).set_index("id")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--recheck", action="store_true",
                        help="Re-extract even papers already in emails.csv")
    args = parser.parse_args()

    # Find all PDFs
    all_pdfs = {}  # paper_id -> path
    for fname in os.listdir(PDF_DIR):
        if fname.endswith(".pdf"):
            try:
                pid = int(fname[:-4])
                all_pdfs[pid] = os.path.join(PDF_DIR, fname)
            except ValueError:
                pass

    print(f"Found {len(all_pdfs)} PDFs in {PDF_DIR}")

    # Find which paper_ids are already in emails.csv
    already_done = set()
    csv_exists = os.path.exists(EMAILS_CSV)
    if csv_exists and not args.recheck:
        with open(EMAILS_CSV, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    already_done.add(int(row["paper_id"]))
                except (ValueError, KeyError):
                    pass

    to_process = {pid: path for pid, path in all_pdfs.items() if pid not in already_done}
    print(f"{len(already_done)} already in emails.csv, {len(to_process)} to check\n")

    if not to_process:
        print("Nothing to do.")
        return

    # Load metadata from DB
    engine = get_engine()
    meta = load_paper_metadata(engine, list(to_process.keys()))
    engine.dispose()

    added = no_email = errors = 0

    with open(EMAILS_CSV, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not csv_exists:
            writer.writerow(["paper_id", "doi", "title", "emails"])

        for pid, path in sorted(to_process.items()):
            row_meta = meta.loc[pid] if pid in meta.index else None
            title = str(row_meta["title"]) if row_meta is not None else f"Paper {pid}"
            doi = str(row_meta["doi"]) if row_meta is not None and row_meta["doi"] else ""
            title_short = title[:65]

            print(f"  [{pid}] {title_short} ...", end=" ", flush=True)

            emails, err = extract_emails(path)
            if err:
                print(f"error: {err}")
                errors += 1
                continue

            if emails:
                writer.writerow([pid, doi, title, "; ".join(emails)])
                f.flush()
                print(", ".join(emails[:2]) + ("..." if len(emails) > 2 else ""))
                added += 1
            else:
                print("no email found")
                no_email += 1

    print(f"\nDone — added: {added}  |  no email: {no_email}  |  errors: {errors}")
    print(f"Emails file: {EMAILS_CSV}")


if __name__ == "__main__":
    main()
