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
- Multi-tenant from the start (see docs/requirements.md): every table is
  meant to be scoped by `business_id`, even though V1 only ever has one
  business. Not yet reflected in the schema above — flag this gap when
  touching schema/query code rather than assuming single-tenant.
- `app/` — Nuxt 3 / Vue 3. Frozen reference implementation only (kept for
  side-by-side comparison / interview talking points) — not receiving new
  features going forward.

## Conventions
- Client PII fields (phone/email/address) are named *Encrypted — never
  render or log raw values without going through the encryption helper
- Photos: private object storage, signed URLs only, no public links
- Keep UI components thin; logic in loaders/actions/lib (React) or
  composables (Vue reference app)
- Bid calculations are pure, deterministic code — never AI-generated. An
  agent may suggest line items (description/quantity/unit/price/category)
  but never a subtotal, markup, tax, or total; a single pure function
  owns all bid math and the UI always calls it rather than trusting a
  stored/cached total. See docs/requirements.md for the full rationale.

## Current focus
Building out core CRUD UI in `web/` (React): project list, project detail,
bid draft screen

## Requirements / roadmap
Full product requirements (scope tiers V1–V3, schema decisions, multi-tenant
design, scheduling/weather/pricing/mileage/voice/AI-design plans) live in
docs/requirements.md. Consult it for anything beyond current-focus CRUD
work; it isn't auto-loaded into every session.