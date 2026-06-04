#!/usr/bin/env python3
"""
Bulk extraction using Ollama (local, free).
Run on your local machine to process existing ACCEPTED papers.

Requires Ollama running locally:
    ollama serve
    ollama pull llama3.1

Usage:
    python extract_local.py                   # process all unextracted ACCEPTED papers
    python extract_local.py --limit 50        # process at most 50 papers
    python extract_local.py --pdf-dir ./pdfs  # read PDFs from a local directory
    python extract_local.py --redo            # re-extract all ACCEPTED papers, even already done
"""
import argparse
import os
import tempfile
import time

import requests

from db import get_conn, get_engine
from extract_core import (
    PROMPT_SYSTEM, build_prompt,
    extract_pdf_text, parse_response, save_extraction, save_extraction_failure,
)

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "llama3.1"
EXTRACTED_BY = "ollama"


def call_ollama(text):
    payload = {
        "model": MODEL,
        "stream": False,
        "options": {"num_predict": 4096},
        "messages": [
            {"role": "system", "content": PROMPT_SYSTEM},
            {"role": "user", "content": build_prompt(text)},
        ],
    }
    r = requests.post(OLLAMA_URL, json=payload, timeout=120)
    r.raise_for_status()
    return r.json()["message"]["content"]


def load_pending(engine, limit=None, redo=False):
    import pandas as pd
    if redo:
        query = """
            SELECT p.id, p.title, p."pdfUrl"
            FROM "Paper" p
            WHERE p.status = 'ACCEPTED'::"PaperStatus"
            ORDER BY p.id
        """
    else:
        query = """
            SELECT p.id, p.title, p."pdfUrl"
            FROM "Paper" p
            LEFT JOIN "PaperExtraction" pe ON pe."paperId" = p.id
            WHERE p.status = 'ACCEPTED'::"PaperStatus"
              AND pe.id IS NULL
            ORDER BY p.id
        """
    if limit:
        query += f" LIMIT {int(limit)}"
    return pd.read_sql(query, engine)


def get_pdf_text(row, pdf_dir=None):
    """Try local pdf_dir first, then fall back to downloading pdfUrl."""
    if pdf_dir:
        # look for <doi-or-id>.pdf in the local directory
        candidates = [
            os.path.join(pdf_dir, f"{row['id']}.pdf"),
            os.path.join(pdf_dir, f"{str(row.get('doi', '')).replace('/', '_')}.pdf"),
        ]
        for path in candidates:
            if os.path.exists(path):
                return extract_pdf_text(path)

    if row.get("pdfUrl"):
        r = requests.get(row["pdfUrl"], timeout=30)
        r.raise_for_status()
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(r.content)
            tmp = f.name
        try:
            return extract_pdf_text(tmp)
        finally:
            os.unlink(tmp)

    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--pdf-dir", default=None)
    parser.add_argument("--delay", type=float, default=4.0, help="Seconds to wait between papers (default: 4)")
    parser.add_argument("--redo", action="store_true", help="Re-extract all ACCEPTED papers, even already done")
    args = parser.parse_args()

    engine = get_engine()
    conn = get_conn()

    df = load_pending(engine, limit=args.limit, redo=args.redo)
    print(f"Found {len(df)} unextracted ACCEPTED papers")

    done = failed = skipped = 0

    try:
        for _, row in df.iterrows():
            print(f"  [{row['id']}] {str(row['title'])[:70]}", end=" ... ")

            text = None
            try:
                text = get_pdf_text(row, pdf_dir=args.pdf_dir)
            except Exception as e:
                print(f"PDF error: {e}")
                save_extraction_failure(conn, int(row["id"]), "failed:pdf_error")
                conn.commit()
                failed += 1
                continue

            if not text or len(text.strip()) < 100:
                print("no text")
                save_extraction_failure(conn, int(row["id"]), "skipped:no_text")
                conn.commit()
                skipped += 1
                continue

            try:
                raw = call_ollama(text)
                data = parse_response(raw)

                if save_extraction(conn, int(row["id"]), data, EXTRACTED_BY, paper_text=text):
                    conn.commit()
                    flag = " ⚑ needs review" if (data or {}).get("confidence", 1) < 0.6 else ""
                    print(f"ok (confidence={data.get('confidence', '?')}){flag}")
                    done += 1
                else:
                    print(f"parse failed — raw response ({len(raw)} chars):\n...head: {raw[:300]}\n...tail: {raw[-200:]}")
                    save_extraction_failure(conn, int(row["id"]), "failed:parse_error")
                    conn.commit()
                    failed += 1
            except Exception as e:
                print(f"error: {e}")
                conn.rollback()
                save_extraction_failure(conn, int(row["id"]), "failed:llm_error")
                conn.commit()
                failed += 1

            if args.delay > 0:
                time.sleep(args.delay)

    finally:
        conn.close()
        engine.dispose()

    print(f"\nDone — extracted: {done}  |  skipped (no PDF): {skipped}  |  failed: {failed}")


if __name__ == "__main__":
    main()
