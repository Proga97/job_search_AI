---
id: visa-sponsors
title: Visa Sponsors
description: Search official U.S. employer sponsorship records and use sponsor matches in your job workflow.
sidebar_position: 4
---

## What it is

The Visa Sponsors page lets you search official U.S. employer sponsorship records from inside Meow AI.

The provider is auto-discovered at startup from the `visa-sponsor-providers/` directory.

Available providers:

| Country | Source | What it lists |
|---------|--------|---------------|
| United States (`us`) | [U.S. Department of Labor LCA disclosure data](https://www.dol.gov/agencies/eta/foreign-labor/performance) | Employers with certified H-1B, H-1B1, or E-3 Labor Condition Application filings |

For each company, it shows:

- Match score against your query
- Company location (when available)
- Licensed routes and type/rating details
- Per-provider last refresh time and sponsor count

## Why it exists

Many roles require sponsorship-ready employers. This page helps you quickly validate whether a target company has certified U.S. LCA filing history, so you can prioritize applications and sourcing terms. A historical filing does not guarantee that every current role offers sponsorship.

## How to use it

1. Open **Visa Sponsors** in the app.
2. Enter a company name in the search box.
3. Confirm the United States source in the source field.
4. Select a result to view sponsor details.
5. Use the score and route details to decide whether to prioritize that employer.

### Job-list sponsor labels

Meow AI matches each fetched job's employer name against the selected country's sponsor records during import. This happens before and independently of the AI scoring pipeline.

- **Visa sponsorship** means the job description explicitly says sponsorship is available.
- **No sponsorship** means the job description explicitly rules sponsorship out.
- **Sponsor-listed** means the employer name matched the official sponsor records, but the listing itself does not promise sponsorship.
- **Sponsorship unclear** means neither the listing text nor the sponsor records produced a reliable result.

Existing jobs with no recorded sponsor match are backfilled during the next job import. Provider failures do not block job importing; unmatched jobs remain eligible for a later backfill.

If a public-facing employer name does not match directly, Meow AI uses the
configured scoring model to resolve the brand to a likely legal employer. It
then verifies that legal name against the official sponsor data. AI output by
itself never marks a company as sponsor-listed. Successful and unsuccessful
lookups are cached privately for 30 days per user and workspace.
To control cost and search latency, one import run performs at most 25 new AI
alias lookups; official-list checks and previously cached aliases are not capped.

### Refresh schedule

Each provider refreshes independently on its own daily schedule (default: **02:00 UTC**). Use the download/update button in the page header to fetch the latest register immediately for all providers.

### API examples

```bash
# Search sponsors across all providers
curl -X POST http://localhost:3001/api/visa-sponsors/search \
  -H "content-type: application/json" \
  -d '{"query":"Monzo","limit":100,"minScore":20}'
```

```bash
# Search sponsors restricted to a specific country
curl -X POST http://localhost:3001/api/visa-sponsors/search \
  -H "content-type: application/json" \
  -d '{"query":"Google","country":"united states","limit":100}'
```

```bash
# Get one organization's entries (all licensed routes)
curl "http://localhost:3001/api/visa-sponsors/organization/Monzo%20Bank%20Ltd"
```

```bash
# Get status of all registered providers
curl "http://localhost:3001/api/visa-sponsors/status"
```

```bash
# Trigger manual refresh for all providers
curl -X POST http://localhost:3001/api/visa-sponsors/update
```

```bash
# Trigger manual refresh for a specific provider
curl -X POST http://localhost:3001/api/visa-sponsors/update/us
```

## Common problems

### No results found

- Try alternate legal names (`Ltd`, `Limited`, abbreviations).
- Reduce spelling strictness by searching a shorter core name.

### Sponsor data is empty

- Run a manual refresh with the header update button (or `POST /api/visa-sponsors/update`).
- Check `GET /api/visa-sponsors/status` to see per-provider error details.
- Verify the server can reach the U.S. Department of Labor website.

### Company appears once but has multiple routes

- Open the detail panel for that company; route/type entries are shown there.

### A country's provider is missing

- Check startup logs for registry warnings about that provider id, including skipped invalid manifests.
- Ensure the provider id is registered in `shared/src/visa-sponsor-providers/index.ts`.
- Ensure the manifest exists at `visa-sponsor-providers/<id>/manifest.ts` or `visa-sponsor-providers/<id>/src/manifest.ts`.
- See [Add a Visa Sponsor Provider](/docs/next/workflows/add-a-visa-sponsor-provider) for the full workflow.

## Related pages

- [Add a Visa Sponsor Provider](/docs/next/workflows/add-a-visa-sponsor-provider)
- [Orchestrator](/docs/next/features/orchestrator)
- [Post-Application Tracking](/docs/next/features/post-application-tracking)
- [Self-Hosting](/docs/next/getting-started/self-hosting)
