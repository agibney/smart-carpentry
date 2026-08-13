# smart-carpentry

Personal project: project tracking + fast bidding for a solo carpentry
business (client-facing), built as a React portfolio piece (interview prep —
Vue experience is already covered) and to learn agentic AI patterns.

## Stack
- `web/` — React 19 + React Router 7 (framework mode) + PrimeReact. Primary,
  actively-developed frontend. Business logic lives in route loaders/actions
  and `web/app/lib` (e.g. `lib/api.ts`), not components.
- `api/` — Express, Drizzle ORM, Postgres (docker-compose). Replaced the
  original Nitro server routes so the backend is a standalone service any
  frontend can call.
- Schema: api/src/db/schema.ts — clients, projects, bids, bid_line_items,
  subcontractors, project_subcontractors, attachments
- `app/` — Nuxt 3 / Vue 3. Frozen reference implementation only (kept for
  side-by-side comparison / interview talking points) — not receiving new
  features going forward.

## Conventions
- Client PII fields (phone/email/address) are named *Encrypted — never
  render or log raw values without going through the encryption helper
- Photos: private object storage, signed URLs only, no public links
- Keep UI components thin; logic in loaders/actions/lib (React) or
  composables (Vue reference app)

## Current focus
Building out core CRUD UI in `web/` (React): project list, project detail,
bid draft screen