#!/usr/bin/env python3
"""
Single-paper extraction using Groq API (cloud, free tier).
Triggered from the admin panel on AWS for newly accepted papers.

Requires GROQ_API_KEY in .env.local.

Usage (CLI):
    python extract.py --paper-id 123

Called programmatically from the Next.js API route:
    python extract.py --paper-id <id>
"""
import argparse
import os
import sys
import tempfile

import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / ".env.local")

from db import get_conn
from extract_core import (
    PROMPT_SYSTEM, build_prompt,
    extract_pdf_text, parse_response, save_extraction, save_extraction_failure,
)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama-3.1-8b-instant"
EXTRACTED_BY = "groq"


def call_groq(text):
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not set in .env.local")

    r = requests.post(
        GROQ_API_URL,
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": MODEL,
            "messages": [
                {"role": "system", "content": PROMPT_SYSTEM},
                {"role": "user", "content": build_prompt(text)},
            ],
            "temperature": 0.1,
        },
        timeout=60,
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


def get_paper(conn, paper_id):
    cur = conn.cursor()
    cur.execute(
        'SELECT id, title, "pdfUrl" FROM "Paper" WHERE id = %s',
        (paper_id,),
    )
    row = cur.fetchone()
    if not row:
        raise ValueError(f"Paper {paper_id} not found")
    return {"id": row[0], "title": row[1], "pdfUrl": row[2]}


def download_pdf(pdf_url):
    r = requests.get(pdf_url, timeout=30)
    r.raise_for_status()
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(r.content)
        return f.name


def run(paper_id, pdf_path=None):
    conn = get_conn()
    try:
        paper = get_paper(conn, paper_id)
        print(f"Extracting: [{paper['id']}] {paper['title'][:70]}")

        if pdf_path:
            tmp, cleanup = pdf_path, False
        elif paper["pdfUrl"]:
            tmp, cleanup = download_pdf(paper["pdfUrl"]), True
        else:
            print("No pdfUrl — cannot extract")
            save_extraction_failure(conn, paper_id, "skipped:no_pdf")
            conn.commit()
            sys.exit(0)

        try:
            text = extract_pdf_text(tmp)
        except Exception as e:
            print(f"Failed to read PDF: {e}")
            save_extraction_failure(conn, paper_id, "skipped:bad_pdf")
            conn.commit()
            sys.exit(0)
        finally:
            if cleanup:
                os.unlink(tmp)

        if not text or len(text.strip()) < 100:
            print("Could not extract text from PDF")
            save_extraction_failure(conn, paper_id, "skipped:no_text")
            conn.commit()
            sys.exit(0)

        raw = call_groq(text)
        data = parse_response(raw)

        if not save_extraction(conn, paper_id, data, EXTRACTED_BY):
            print("Failed to parse model response")
            save_extraction_failure(conn, paper_id, "failed:parse_error")
            conn.commit()
            sys.exit(1)

        confidence = (data or {}).get("confidence")
        needs_review = confidence is not None and confidence < 0.6
        print(f"Done (confidence={confidence}{'  ⚑ flagged for review' if needs_review else ''})")

    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--paper-id", type=int, required=True)
    parser.add_argument("--pdf-path", default=None)
    args = parser.parse_args()
    run(args.paper_id, args.pdf_path)


if __name__ == "__main__":
    main()
