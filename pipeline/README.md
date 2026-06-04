# WordNorms Pipeline

ML pipeline that feeds the WordNorms admin review system. Fetches candidate papers from OpenAlex, scores them with a trained classifier, and writes results directly to the shared Postgres database.

## Overview

```
OpenAlex API
    │
    ▼
fetch.py ──────────────────► Paper table (status = PENDING_REVIEW)
                                    │
Hand-coded data (seed)              │
    │                               ▼
    └──► Paper table ──► predict.py ──► updates modelScore + status
         (ACCEPTED /                │
          EXCLUDED,                 ├──► PENDING_REVIEW  (predicted include → admin reviews)
          isValidation)             └──► EXCLUDED        (predicted exclude → skipped)
                                    │
                                    └──► ModelRun table (accuracy, F1, val size, etc.)

Admin reviews PENDING_REVIEW papers
    │
    ├──► ACCEPTED ──► extract.py (triggered from admin panel)
    └──► EXCLUDED ──► added to training pool on next run
```

## Scripts

| Script | Trigger | What it does |
|---|---|---|
| `fetch.py` | Cron (e.g. weekly) | Queries OpenAlex, enriches missing abstracts via Crossref/EuropePMC, inserts new papers into DB (skips existing DOIs) |
| `predict.py` | After fetch, or on demand | Trains SVM on reviewed papers, scores PENDING_REVIEW papers, logs a ModelRun |
| `extract.py` | Admin panel button | Runs extraction model on ACCEPTED papers, updates status to ADDED_TO_TRAINING |
| `extract_local.py` | On demand | Bulk-extracts ACCEPTED papers using a local Ollama model (free, no API key) |
| `download_pdfs.py` | On demand | Downloads PDFs for ACCEPTED papers and extracts author emails into `pdfs/emails.csv` |
| `extract_emails.py` | On demand | Scans `pdfs/` for any manually-added PDFs not yet in `emails.csv` and fills in the gaps |
| `send_drafts.py` | On demand | Reads `emails.csv`, groups papers by author email, and creates Outlook draft emails via AppleScript |
| `seed.py` | One-time | Imports `both_lab_table.csv` into Paper table with an 80/20 validation split |
| `db.py` | Imported by all scripts | Shared Postgres connection via DATABASE_URL |

## Database integration

All scripts connect to the same Postgres instance as the web app using `DATABASE_URL` from `.env.local`. No intermediate CSV files — the DB is the single source of truth.

**Paper table fields used by the pipeline:**
- `status` — pipeline stage (PENDING_REVIEW → ACCEPTED/EXCLUDED → ADDED_TO_TRAINING)
- `modelScore` — raw SVM decision score from the most recent predict run
- `isValidation` — marks holdout papers (set at seed time, grows over time; never demoted)

**ModelRun table** — one row per predict.py run:
- `trainSize`, `valSize` — sizes of training and validation sets used
- `accuracy`, `precision`, `recall`, `f1` — evaluated on the validation set
- `valRebalanced` — true if the validation set was expanded this run
- `createdAt` — timestamp (used to plot performance over time on the stats page)

## Validation set strategy

The holdout set is designed to stay representative as publication styles and paper types change over time.

- **Seed:** 20% of `both_lab_table.csv` is randomly selected as validation at import time (stratified by class, so include/exclude ratio is preserved)
- **Growth:** each time `predict.py` runs, it checks whether validation is still ~20% of all labeled papers. If it has drifted below that threshold, newly reviewed papers are randomly promoted to fill it back up (stratified)
- **One-way:** papers already in the validation set are never moved back to training — the set only grows
- **Why this works:** recent papers flow into the validation set gradually, keeping it representative of current literature without causing abrupt metric shifts. The stats page flags runs where the validation set was rebalanced so you can distinguish real model improvement from distribution shift

## Local extraction with Ollama

Use this to bulk-extract ACCEPTED papers locally (free, no API key needed) after restoring the production DB.

**Step 1 — Start Ollama**
```bash
ollama serve
```

**Step 2 — Pull the model (first time only)**
```bash
ollama pull llama3.1
```

**Step 3 — Run extraction from the pipeline directory**
```bash
cd pipeline
python extract_local.py
```

| Flag | Default | Description |
|---|---|---|
| _(none)_ | | All unextracted ACCEPTED papers (no existing extraction record) |
| `--retry-failed` | | Only papers that previously failed (`parse_error`, `llm_error`, `pdf_error_retryable`) |
| `--redo` | | Re-extract all ACCEPTED papers, even ones already done (e.g. after updating the prompt) |
| `--pdf-dir PATH` | | Read PDFs from a local directory (`pdfs/{id}.pdf`) instead of downloading via `pdfUrl` |
| `--limit N` | | Stop after N papers |
| `--delay N` | `4.0` | Seconds between Ollama calls |

Papers with `confidence < 0.6` are flagged as "needs review" in the DB. Already-extracted papers are skipped automatically unless `--redo` is set.

Typical follow-up after a PDF download run:
```bash
python extract_local.py --retry-failed --pdf-dir ./pdfs
```

---

## Author email campaign

To invite authors to verify their extracted data, run these three steps in order.

**Step 1 — Download PDFs and extract emails**
```bash
python download_pdfs.py --all --delay 3
```
Downloads PDFs for all ACCEPTED papers using a resolution chain (direct URL → Zenodo API → HTML meta tag → Unpaywall → Sci-Hub via headless Chromium). Extracts author emails from the first two pages of each PDF. Saves PDFs to `pdfs/{id}.pdf` (gitignored) and emails to `pdfs/emails.csv`. A log of papers that couldn't be downloaded is written to `pdfs/failed_downloads.csv` as it runs.

| Flag | Default | Description |
|---|---|---|
| _(none)_ | | Only papers currently marked `failed:pdf_error` |
| `--all-missing` | | Also include papers with no extraction record yet |
| `--all` | | All ACCEPTED papers — use this for a full email collection run |
| `--before-id N` | | Only process papers with `id < N` (useful for catching papers missed at the start of a run) |
| `--limit N` | | Stop after N papers (useful for test runs) |
| `--delay N` | `2.0` | Seconds between papers; increase if publishers start blocking |
| `--semantic-scholar-only` | | Skip all other sources and only try Semantic Scholar — useful after a prior run where direct/Unpaywall/Sci-Hub already failed |

Sci-Hub fallback requires Playwright: `pip install playwright && playwright install chromium`. If not installed, Sci-Hub is skipped gracefully.

For papers that still can't be downloaded automatically, find and place the PDF manually as `pdfs/{paper_id}.pdf`.

**Step 2 — Catch manually-added PDFs**
```bash
python extract_emails.py
```
Scans `pdfs/` for any PDFs not yet represented in `emails.csv` (e.g. ones you dropped in manually after the download run). Safe to re-run — already-processed papers are skipped.

| Flag | Description |
|---|---|
| `--recheck` | Re-extract emails even from papers already in `emails.csv` |

**Step 3 — Create Outlook drafts**
```bash
python send_drafts.py --dry-run   # preview what will be sent
python send_drafts.py             # create drafts in Outlook
```
Reads `emails.csv`, deduplicates by email address (one email per person even if they have multiple papers), and creates draft emails in Outlook via AppleScript. Drafts land in your Outlook Drafts folder — review and send from there.

| Flag | Default | Description |
|---|---|---|
| `--base-url` | `https://manynorms.wordnorms.com` | Base URL used to build suggest-edit links in the email body |
| `--dry-run` | | Print a preview of each email instead of creating drafts |

Requires Mac with Microsoft Outlook installed. No API key needed — uses AppleScript to create drafts directly in the app.

---

## Running locally

Install dependencies:
```bash
cd pipeline
pip install -r requirements.txt
```

Set up the DB connection — scripts read `DATABASE_URL` from `../.env.local`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/wordnorms_dev
```

Seed the database (one-time):
```bash
python seed.py
```

Run the full pipeline manually:
```bash
python fetch.py    # fetch new papers from OpenAlex
python predict.py  # score and classify
```

## Cron setup

Example crontab for weekly OpenAlex fetch + predict (runs Sunday at 2am):
```
0 2 * * 0 cd /path/to/wordnorms-dev/pipeline && python fetch.py && python predict.py >> logs/pipeline.log 2>&1
```

## Hand-coded data

`both_lab_table.csv` — 3,267 papers manually reviewed by the lab. Imported once via `seed.py`. Columns used:

| CSV column | DB field | Notes |
|---|---|---|
| `DOI` | `doi` | Normalized (strips `https://doi.org/`) |
| `TITLE` | `title` | |
| `ABSTRACT` | `abstract` | |
| `AUTHOR` | `authors` | Split from semicolon-separated string |
| `YEAR` | `year` | |
| `KEYWORDS` | — | Used for text feature construction only |
| `code` | `status` | `Yes` → ACCEPTED, `No` → EXCLUDED |

After seeding, `both_lab_table.csv` is no longer needed — the DB is the authoritative record.
