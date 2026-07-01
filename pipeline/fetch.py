#!/usr/bin/env python3
"""
Fetches candidate papers from OpenAlex, enriches missing abstracts via
Crossref and EuropePMC, then inserts new papers into the Paper table with
status PENDING_REVIEW.

Papers already in the DB (matched by DOI or OpenAlex ID) are skipped.
Run on a cron schedule (monthly) to keep the review queue fresh.

Queries are split by publication year rather than one giant relevance-sorted
query. This keeps each query's result count well under OpenAlex's basic-
pagination cap (page * per_page <= 10,000, i.e. page 51+ fails outright with
per_page=200) and means a failure/rate-limit on one year doesn't lose every
other year's results.

OpenAlex bills per call beyond a modest daily free quota (higher with an
OPENALEX_API_KEY, still not unlimited) — so routine cron runs default to only
the last DEFAULT_LOOKBACK_YEARS years, not the full historical range. Run a
full backfill manually, once, with an explicit --start-year:
    python pipeline/fetch.py --start-year 1900 --dry-run   # preview volume first
    python pipeline/fetch.py --start-year 1900             # then for real
"""
import argparse
import datetime
import math
import os
import re
import time
import requests

from db import get_conn

CONTACT_EMAIL = "buchananlab@gmail.com"
HEADERS = {
    "Accept": "application/json",
    "User-Agent": f"wordnorms-fetcher (mailto:{CONTACT_EMAIL})",
}
OPENALEX_API_KEY = os.environ.get("OPENALEX_API_KEY")

# Phrases OR'd together against title_and_abstract. Kept broad on purpose —
# many norm/rating papers don't use the words "lexical" or "linguistic" at all.
SEARCH_TERMS = [
    "lexical database", "lexical norms", "linguistic database", "linguistic norms",
    "psycholinguistic norms", "psycholinguistic megastudy", "lexical megastudy",
    "concreteness ratings", "imageability ratings", "familiarity ratings",
    "word ratings", "affective ratings",
    "valence ratings", "arousal ratings", "dominance ratings",
    "treebank",
]

TYPE_FILTER = (
    "type:types/article|types/dataset|types/preprint"
    "|types/supplementary-materials|types/report|types/book-chapter"
)

# OpenAlex's basic pagination hard-caps at page * per_page <= 10,000.
PER_PAGE = 200
MAX_PAGE = 10_000 // PER_PAGE

# Earliest year for a manual --start-year full backfill. Routine (no-args)
# cron runs use DEFAULT_LOOKBACK_YEARS instead — see module docstring.
START_YEAR = 1900
DEFAULT_LOOKBACK_YEARS = 1


def _search_query():
    # Quoted so OpenAlex matches the exact phrase, not just any document containing
    # the individual words — unquoted "word ratings" matched 531 works in 2022 alone
    # (test-ratings, accent ratings, story ratings, etc.); quoted, it matched 4.
    return "+OR+".join(f"%22{term.replace(' ', '%20')}%22" for term in SEARCH_TERMS)


# Coarse multi-year buckets for eras with few matching papers (keeps call counts
# low), then yearly buckets once volume is high enough to risk the 10,000-result
# pagination cap. Bounds are inclusive.
COARSE_BUCKETS = [(1900, 1989), (1990, 1999), (2000, 2009)]
YEARLY_FROM = 2010


def _year_buckets(start_year, end_year):
    buckets = []
    for lo, hi in COARSE_BUCKETS:
        b_lo, b_hi = max(lo, start_year), min(hi, end_year)
        if b_lo <= b_hi:
            buckets.append((b_lo, b_hi))
    for y in range(max(YEARLY_FROM, start_year), end_year + 1):
        buckets.append((y, y))
    return buckets


def _range_url(lo, hi):
    year_filter = f"publication_year:{lo}" if lo == hi else f"publication_year:>{lo - 1},publication_year:<{hi + 1}"
    url = (
        "https://api.openalex.org/works?"
        f"filter=title_and_abstract.search:{_search_query()},"
        f"{TYPE_FILTER},{year_filter}"
        f"&sort=relevance_score:desc&per_page={PER_PAGE}"
    )
    if OPENALEX_API_KEY:
        url += f"&api_key={OPENALEX_API_KEY}"
    return url


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

def _parse_work(w):
    doi = (w.get("doi") or "").replace("https://doi.org/", "").lower() or None
    best_oa = w.get("best_oa_location") or {}
    primary = w.get("primary_location") or {}
    oa = w.get("open_access") or {}
    pdf_url = best_oa.get("pdf_url") or primary.get("pdf_url") or oa.get("oa_url")
    return {
        "title": w.get("title"),
        "year": w.get("publication_year"),
        "doi": doi,
        "openalex_id": (w.get("id") or "").replace("https://openalex.org/", "") or None,
        "authors": [
            a["author"]["display_name"]
            for a in w.get("authorships", [])
            if a.get("author", {}).get("display_name")
        ],
        "abstract": decode_abstract(w.get("abstract_inverted_index")),
        "journal": (primary.get("source") or {}).get("display_name"),
        "pdf_url": pdf_url,
    }


def fetch_openalex_range(lo, hi):
    """Fetch every result for one year bucket [lo, hi]. Never raises — logs and
    returns whatever was collected before any failure, so one bad bucket (rate
    limit, timeout, unexpected response) doesn't take down the whole run."""
    label = str(lo) if lo == hi else f"{lo}-{hi}"
    papers = []
    page = 1
    max_page = None

    while max_page is None or page <= max_page:
        try:
            r = requests.get(_range_url(lo, hi) + f"&page={page}", headers=HEADERS, timeout=60)
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            print(f"  {label} page {page}: request failed ({e}) — stopping this bucket", flush=True)
            break

        if "results" not in data or "meta" not in data:
            print(f"  {label} page {page}: unexpected response ({data.get('error', 'no results/meta')}) — stopping this bucket", flush=True)
            break

        for w in data["results"]:
            papers.append(_parse_work(w))

        if max_page is None:
            total = data["meta"].get("count", 0)
            pages_needed = math.ceil(total / PER_PAGE) if total else 0
            max_page = min(pages_needed, MAX_PAGE)
            if pages_needed > MAX_PAGE:
                print(f"  {label}: {total} results exceeds the {MAX_PAGE * PER_PAGE}-result pagination cap — only the top {MAX_PAGE * PER_PAGE} by relevance will be fetched", flush=True)

        if not data["results"]:
            break
        page += 1
        time.sleep(0.1)

    return papers


def fetch_openalex(start_year=START_YEAR, end_year=None):
    end_year = end_year or datetime.date.today().year
    buckets = _year_buckets(start_year, end_year)
    papers = []
    for lo, hi in buckets:
        label = str(lo) if lo == hi else f"{lo}-{hi}"
        bucket_papers = fetch_openalex_range(lo, hi)
        if bucket_papers:
            print(f"  {label}: {len(bucket_papers)} collected", flush=True)
        papers.extend(bucket_papers)

    print(f"OpenAlex: {len(papers)} results across {len(buckets)} buckets ({start_year}-{end_year})", flush=True)
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
    doi = paper["doi"]
    oa_id = paper["openalex_id"]
    cur.execute(
        """
        INSERT INTO "Paper"
            ("createdAt", "updatedAt", title, authors, year, doi,
             "openAlexId", abstract, journal, "pdfUrl", status)
        SELECT NOW(), NOW(), %s, %s, %s, %s, %s, %s, %s, %s, 'PENDING_REVIEW'::"PaperStatus"
        WHERE NOT EXISTS (
            SELECT 1 FROM "Paper"
            WHERE (%s IS NOT NULL AND doi = %s)
               OR (%s IS NOT NULL AND "openAlexId" = %s)
        )
        """,
        (
            paper["title"],
            paper["authors"],
            paper["year"],
            doi,
            oa_id,
            paper["abstract"],
            paper.get("journal"),
            paper.get("pdf_url"),
            doi, doi,
            oa_id, oa_id,
        ),
    )
    return cur.rowcount


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

COMMIT_EVERY = 100  # papers between progress prints + DB commits, so a killed/crashed
                     # run doesn't lose everything and progress is visible from outside


def main(start_year=START_YEAR, end_year=None, dry_run=False):
    papers = fetch_openalex(start_year, end_year)

    if dry_run:
        with_doi = sum(1 for p in papers if p["doi"])
        print(f"\nDry run — {len(papers)} candidates fetched ({with_doi} with a DOI). No DB writes, no abstract enrichment.")
        for p in papers[:20]:
            print(f"  [{p['year']}] {p['title']} — {p['journal'] or 'no journal'}")
        if len(papers) > 20:
            print(f"  … and {len(papers) - 20} more")
        return

    conn = get_conn()
    try:
        existing_dois, existing_oa_ids = load_existing(conn)
        print(f"DB already has {len(existing_dois)} DOIs, {len(existing_oa_ids)} OpenAlex IDs", flush=True)
        print(f"Processing {len(papers)} candidates from OpenAlex...", flush=True)

        cur = conn.cursor()
        inserted = skipped = enriched = 0

        for i, paper in enumerate(papers, start=1):
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
            if paper["doi"]:
                existing_dois.add(paper["doi"])
            if paper["openalex_id"]:
                existing_oa_ids.add(paper["openalex_id"])

            if i % COMMIT_EVERY == 0:
                conn.commit()
                print(f"  {i}/{len(papers)} processed — inserted: {inserted}  |  enriched: {enriched}  |  skipped: {skipped}", flush=True)

        conn.commit()
    finally:
        conn.close()

    print(f"\nDone — inserted: {inserted}  |  enriched: {enriched}  |  skipped: {skipped}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--start-year", type=int, default=None,
        help=f"First publication year to fetch (default: current year - {DEFAULT_LOOKBACK_YEARS}, "
             f"for routine runs. Pass --start-year {START_YEAR} for a full historical backfill — do this "
             "manually, not via cron, to avoid re-querying 125+ years every month.",
    )
    parser.add_argument("--end-year", type=int, default=None, help="Last publication year to fetch (default: current year)")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and report counts only — no DB writes, no abstract enrichment")
    args = parser.parse_args()

    start_year = args.start_year
    if start_year is None:
        start_year = datetime.date.today().year - DEFAULT_LOOKBACK_YEARS
        print(f"No --start-year given — defaulting to routine lookback ({start_year}-present). "
              f"Pass --start-year {START_YEAR} for a full historical backfill.")

    main(start_year, args.end_year, args.dry_run)
