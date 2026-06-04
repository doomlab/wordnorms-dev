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
python extract_local.py                    # all unextracted ACCEPTED papers
python extract_local.py --limit 50         # test run on 50 papers
python extract_local.py --pdf-dir ./pdfs   # use local PDFs instead of downloading
```

Papers with `confidence < 0.6` are flagged as "needs review" in the DB. Already-extracted papers are skipped automatically.

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
