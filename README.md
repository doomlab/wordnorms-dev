# wordnorms-dev

[![DOI](https://zenodo.org/badge/1260507039.svg)](https://zenodo.org/badge/latestdoi/1260507039)

Development of the new wordnorms.com website.

## Stack

- **Web app** — Blitz.js (Next.js App Router), Postgres, Prisma
- **Pipeline** — Python ML pipeline for paper fetching and classification

## Structure

```
wordnorms-dev/
├── src/          # Next.js / Blitz web app
├── db/           # Prisma schema and migrations
├── pipeline/     # Python ML pipeline (fetch, predict, extract)
├── scripts/      # Node.js maintenance and backfill scripts
├── integrations/ # Email (Resend) integration
├── cronJobs/     # Cron job reference (cron.txt)
└── public/       # Static assets
```

See [pipeline/README.md](pipeline/README.md) for the full ML pipeline documentation.

## Local development

Install dependencies:
```bash
npm install
```

Run the dev server:
```bash
npm run dev
```

Run database migrations:
```bash
npm run migrate
```

Open Prisma Studio (DB browser):
```bash
npm run studio
```

Run tests:
```bash
npm test
```

## Environment variables

All variables live in `.env.local` (not committed). The app and all scripts read from this file.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string (`postgresql://user:pass@host:5432/db`) |
| `RESEND_API_KEY` | Yes | API key for transactional email via Resend |
| `APP_ORIGIN` | Yes | Full origin URL, e.g. `https://wordnorms.com` (used in email links) |
| `PIPELINE_PYTHON` | No | Path to the Python binary to use when triggering pipeline from the admin panel (default: `python`) |
| `GITHUB_TOKEN` | No | GitHub personal access token — raises sync-model-cards rate limit from 60 to 5000 req/hr |

Pipeline-only variables (also read from `.env.local` by Python scripts):

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | No | API key for Groq LLM extraction (used by `extract.py`) |
| `CORE_API_KEY` | No | API key for CORE.ac.uk PDF access — higher rate limits (free, optional) |

## App routes

| Route | Who sees it | Description |
|---|---|---|
| `/` | Public | Home / word search |
| `/norms` | Public | Norms browser |
| `/datasets` | Public | Dataset listing |
| `/visualizations` | Public | Visualizations |
| `/tutorial` | Public | Tutorial |
| `/progress` | Public | Project progress |
| `/dashboard` | Logged-in users | Personal dashboard and profile |
| `/admin` | ADMIN / SUPER_ADMIN | Admin panel (paper review, pipeline, stats, users) |
| `/admin/review` | ADMIN+ | Review PENDING_REVIEW papers |
| `/admin/papers` | ADMIN+ | Browse all papers |
| `/admin/stats` | ADMIN+ | Model performance stats |
| `/admin/users` | SUPER_ADMIN | User management |
| `/maintenance` | Public | Shown to all visitors when maintenance mode is on |

## Scripts

One-off and maintenance scripts live in `scripts/`. Run them with `npm run` (which automatically loads `.env.local`) or directly via `node --env-file=.env.local scripts/<name>.mjs`.

| Script | npm command | Description |
|---|---|---|
| `db-restore.mjs` | `npm run db:restore -- --file=dump.sql` | Restore a SQL dump into the database; prompts for confirmation |
| `backfill-author-meta.mjs` | `npm run backfill:author-meta` | Fetch authorships (name, ORCID, OpenAlex author ID) for papers missing `authorMeta` |
| `backfill-citations.mjs` | `node --env-file=.env.local scripts/backfill-citations.mjs` | Populate `PaperCitation` rows for accepted papers that have an OpenAlex ID |
| `normalize-openalex-ids.mjs` | `node --env-file=.env.local scripts/normalize-openalex-ids.mjs` | Convert stored full-URL OpenAlex IDs (e.g. `https://openalex.org/W123`) to bare IDs (`W123`); merges duplicates |
| `flatten-duplicate-chains.mjs` | `node --env-file=.env.local scripts/flatten-duplicate-chains.mjs` | Flatten chained `canonicalPaperId` references (A→B→C becomes A→C, B→C) |
| `sync-model-cards.mjs` | `node --env-file=.env.local scripts/sync-model-cards.mjs` | Pull YAML model cards from the SemanticPrimeR GitHub repo into `data/model-cards/` |
| `weekly-admin-summary.mjs` | `node --env-file=.env.local scripts/weekly-admin-summary.mjs` | Email a weekly summary to all ADMIN and SUPER_ADMIN users via Resend |

## Cron jobs

Cron definitions live in `cronJobs/cron.txt`. Install on the server with `crontab -e`.

| Schedule | Command | Description |
|---|---|---|
| 1st of month, midnight | `scripts/sync-model-cards.mjs` | Sync model cards from GitHub |
| 1st of month, 2am | `pipeline/fetch.py` | Fetch new papers from OpenAlex |
| 1st of month, 3am | `pipeline/predict.py` | Score and classify fetched papers |
| Every Monday, 8am | `scripts/weekly-admin-summary.mjs` | Send weekly admin digest email |

## Maintenance mode

Maintenance mode redirects all visitors to a maintenance page. It is controlled from the admin panel and applies globally to all visitors.

**To turn it on:** log in as a super admin, go to `/admin`, click **Enable** in the Site Management card.

**To turn it off:** go to `/admin` (the admin panel is always accessible even during maintenance), click **Disable**.

**If the admin panel is unreachable**, turn it off directly in the database:

```sql
UPDATE "SiteSettings" SET "maintenanceMode" = false WHERE id = 1;
```

The change takes effect immediately for all visitors — no redeploy needed.
