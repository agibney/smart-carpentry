# smart-carpentry

Personal project: project tracking + fast bidding for a solo carpentry
business (client-facing), built to learn Vue→React comparison and
agentic AI patterns.

## Stack
- Nuxt 3 / Vue 3 (frontend, will be rebuilt in React/Next later for comparison —
  keep business logic in composables, not components, to ease that later)
- Nitro (server/api routes), Drizzle ORM, Postgres (docker-compose)
- Schema: server/db/schema.ts — clients, projects, bids, bid_line_items,
  subcontractors, project_subcontractors, attachments

## Conventions
- Client PII fields (phone/email/address) are named *Encrypted — never
  render or log raw values without going through the encryption helper
- Photos: private object storage, signed URLs only, no public links
- Keep UI components thin; logic in composables

## Current focus
Building core CRUD UI: project list, project detail, bid draft screen