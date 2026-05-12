#!/usr/bin/env python3
"""
Fetches candidate papers from OpenAlex, enriches missing abstracts via
Crossref and EuropePMC, then inserts new papers into the Paper table with
status PENDING_REVIEW.

Papers already in the DB (matched by DOI or OpenAlex ID) are skipped.
Run on a cron schedule (e.g. weekly) to keep the review queue fresh.
"""
import math
import re
import time
import requests

from db import get_conn

CONTACT_EMAIL = "buchananlab@gmail.com"
HEADERS = {
    "Accept": "application/json",
    "User-Agent": f"wordnorms-fetcher ({CONTACT_EMAIL})",
}

BASE_URL = (
    "https://api.openalex.org/works?"
    "filter=title_and_abstract.search:"
    "lexical+database+OR+lexical+norms+OR+linguistic+database+OR+linguistic+norms,"
    "type:types/article|types/dataset|types/preprint"
    "|types/supplementary-materials|types/report|types/book-chapter"
    "&sort=relevance_score:desc"
    "&per_page=200"
)


# ---------------------------------------------------------------------------
# Abstract decoding
# ---------------------------------------------------------------------------

def decode_abstract(inv):
    if not isinstance(inv, dict) or not inv:
        return None
    pos2tok = {p: t for t, ps in inv.items() for p in ps}
    txt = " ".join(pos2tok.get(i, "") for i in range(max(pos2tok) + 1))
    txt = re.sub(r"\s+([,.!?;:])", r"\1", txt)
    return re.sub(r"\s{2,}", " ", txt).strip() or None


# ---------------------------------------------------------------------------
# Abstract enrichment (Crossref → EuropePMC fallback)
# ---------------------------------------------------------------------------

def _clean_doi(doi):
    if not doi:
        return ""
    return re.sub(r"^https?://(dx\.)?doi\.org/", "", doi.strip(), flags=re.I)


def _safe_get(url, params=None):
    try:
        r = requests.get(url, params=params, headers=HEADERS, timeout=30)
        r.raise_for_status()
        return r.json(), None
    except requests.exceptions.HTTPError as e:
        return None, f"HTTP {r.status_code}"
    except Exception as e:
        return None, str(e)


def fetch_crossref_abstract(doi):
    doi = _clean_doi(doi)
    js, err = _safe_get(f"https://api.crossref.org/works/{doi}")
    if err:
        return None
    abstract = (js.get("message") or {}).get("abstract")
    if abstract:
        return re.sub(r"<[^>]+>", "", abstract).strip()
    return None


def fetch_europepmc_abstract(doi):
    js, err = _safe_get(
        "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
        params={"query": f"DOI:{_clean_doi(doi)}", "format": "json", "pageSize": 1},
    )
    if err:
        return None
    results = (js or {}).get("resultList", {}).get("result", [])
    if results and results[0].get("abstractText"):
        return results[0]["abstractText"]
    return None


def enrich_abstract(doi):
    for fetcher in (fetch_crossref_abstract, fetch_europepmc_abstract):
        abstract = fetcher(doi)
        if abstract:
            return abstract
        time.sleep(0.3)
    return None


# ---------------------------------------------------------------------------
# OpenAlex fetch
# ---------------------------------------------------------------------------

def fetch_openalex():
    probe = requests.get(BASE_URL + "&page=1", headers=HEADERS, timeout=30)
    probe.raise_for_status()
    meta = probe.json()["meta"]
    total, per_page = meta["count"], meta["per_page"]
    pages = math.ceil(total / per_page)
    print(f"OpenAlex: {total} results across {pages} pages")

    papers = []
    for page in range(1, pages + 1):
        r = requests.get(BASE_URL + f"&page={page}", headers=HEADERS, timeout=60)
        r.raise_for_status()
        for w in r.json().get("results", []):
            doi = (w.get("doi") or "").replace("https://doi.org/", "").lower() or None
            papers.append({
                "title": w.get("title"),
                "year": w.get("publication_year"),
                "doi": doi,
                "openalex_id": w.get("id"),
                "authors": [
                    a["author"]["display_name"]
                    for a in w.get("authorships", [])
                    if a.get("author", {}).get("display_name")
                ],
                "abstract": decode_abstract(w.get("abstract_inverted_index")),
            })
        print(f"  page {page}/{pages} — {len(papers)} collected", end="\r")

    print()
    return papers


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def load_existing(conn):
    cur = conn.cursor()
    cur.execute('SELECT doi, "openAlexId" FROM "Paper"')
    dois, openalex_ids = set(), set()
    for doi, oa_id in cur.fetchall():
        if doi:
            dois.add(doi.lower())
        if oa_id:
            openalex_ids.add(oa_id)
    return dois, openalex_ids


def insert_paper(cur, paper):
    cur.execute(
        """
        INSERT INTO "Paper"
            ("createdAt", "updatedAt", title, authors, year, doi,
             "openAlexId", abstract, status)
        VALUES
            (NOW(), NOW(), %s, %s, %s, %s, %s, %s, 'PENDING_REVIEW'::"PaperStatus")
        ON CONFLICT (doi) DO NOTHING
        """,
        (
            paper["title"],
            paper["authors"],
            paper["year"],
            paper["doi"],
            paper["openalex_id"],
            paper["abstract"],
        ),
    )
    return cur.rowcount


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    papers = fetch_openalex()

    conn = get_conn()
    try:
        existing_dois, existing_oa_ids = load_existing(conn)
        print(f"DB already has {len(existing_dois)} DOIs, {len(existing_oa_ids)} OpenAlex IDs")

        cur = conn.cursor()
        inserted = skipped = enriched = 0

        for paper in papers:
            # skip if already in DB
            if paper["doi"] and paper["doi"] in existing_dois:
                skipped += 1
                continue
            if paper["openalex_id"] and paper["openalex_id"] in existing_oa_ids:
                skipped += 1
                continue

            # enrich missing abstracts
            if not paper["abstract"] and paper["doi"]:
                paper["abstract"] = enrich_abstract(paper["doi"])
                if paper["abstract"]:
                    enriched += 1

            if not paper["title"]:
                skipped += 1
                continue

            inserted += insert_paper(cur, paper)

        conn.commit()
    finally:
        conn.close()

    print(f"\nDone — inserted: {inserted}  |  enriched: {enriched}  |  skipped: {skipped}")


if __name__ == "__main__":
    main()
