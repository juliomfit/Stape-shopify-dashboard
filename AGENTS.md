<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

This repo is a single **Next.js 16 (Turbopack) app** — the "Shopify + Stape Analytics Dashboard" (`stape-shopify-dashboard`). Package manager is **npm** (`package-lock.json`). There is **no test framework** and no Docker/CI. Standard commands live in `package.json`/`README.md`; the key ones:

- Run dev server: `npm run dev` — serves on `http://localhost:3000` (binds `::`, so `[::1]:3000` locally). Ready in <1s.
- Lint: `npm run lint` (ESLint 9 / `eslint-config-next`).
- Build: `npm run build`.

Non-obvious things to know:

- **Do not copy `.env.example` verbatim for a credential-free run.** It sets placeholder BigQuery values (`GOOGLE_CLOUD_PROJECT`, `BIGQUERY_DATASET`, `BIGQUERY_TABLE`) plus `GOOGLE_APPLICATION_CREDENTIALS=secrets/gcp-service-account.json`. With no service-account file present, `isStapeConfigured()` is true so the app tries to query BigQuery and renders a red **"Stape error"** banner. To run cleanly with no credentials, leave `GOOGLE_CLOUD_PROJECT` (and the Shopify vars) **empty** so pages show tidy "not configured" panels instead.
- **All external integrations are optional at boot** (Shopify, Stape/BigQuery, Meta, Google Ads). Each has an `is*Configured()` guard, so the app boots and every page renders with zero credentials — just with empty data panels. Real data needs a BigQuery service-account key + Shopify Admin app creds (see `README.md`).
- **Runtime writes local JSON state under `secrets/`** (gitignored), created on demand — e.g. pasted ad spend goes to `secrets/ads-paste.json` via the "Save Meta totals" / CSV import flow on `/attribution` (True Performance). This flow is a good credential-free end-to-end check: it persists and the "Meta Ads connected" badge turns green.
- **`.env.local` is not hot-reloaded** — restart `npm run dev` after changing env vars.
- Next.js auto-generates/maintains its own block in this `AGENTS.md` (and `CLAUDE.md`) on every `next dev`; both files are committed so the tree stays clean. Keep edits outside the `nextjs-agent-rules` markers.
