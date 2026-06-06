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

## Maintenance mode

Maintenance mode redirects all visitors to a maintenance page. It is controlled from the admin panel and applies globally to all visitors.

**To turn it on:** log in as a super admin, go to `/admin`, click **Enable** in the Site Management card.

**To turn it off:** go to `/admin` (the admin panel is always accessible even during maintenance), click **Disable**.

**If the admin panel is unreachable**, turn it off directly in the database:

```sql
UPDATE "SiteSettings" SET "maintenanceMode" = false WHERE id = 1;
```

The change takes effect immediately for all visitors — no redeploy needed.
