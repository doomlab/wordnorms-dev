# wordnorms-dev

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
└── public/       # Static assets
```

See [pipeline/README.md](pipeline/README.md) for the full ML pipeline documentation.
