# Smart Carpentry

A personal project: project tracking and fast bidding for a solo carpentry
business. It's client-facing tooling for a real solo carpenter, built to
develop production React experience alongside my existing Vue background,
and as a way to learn agentic AI development patterns.

**Early stage, personal project — unlicensed and not open for
contributions.** Core CRUD (projects, bids) is being built out; auth,
scheduling, and the rest of the roadmap below are not implemented yet.

## Stack

- **`web/`** — React 19 + React Router 7 (framework mode) + PrimeReact. The
  actively-developed frontend. Business logic lives in route
  loaders/actions and `web/app/lib`, not components.
- **`api/`** — Express + Drizzle ORM + Postgres (via `docker-compose`). A
  standalone service any frontend can call.
- **`app/`** — Nuxt 3 / Vue 3. A frozen reference implementation, kept only
  for side-by-side comparison — not receiving new features.

## Docs

- [`docs/requirements.md`](docs/requirements.md) — full product
  requirements: scope tiers, multi-tenant design, and the scheduling /
  weather / pricing / voice / AI-design roadmap.
- [`docs/carpentry_app_erd.html`](docs/carpentry_app_erd.html) — entity
  relationship diagram for the schema in `api/src/db/schema.ts`.

## Working with Claude Code

I use Claude Code as a working pair on this project: I write specs (either
in chat or as docs like `docs/requirements.md`), Claude proposes an
implementation plan and the code, and I review and correct before anything
gets committed — nothing lands without me reading and understanding it
first. `CLAUDE.md` in this repo captures the conventions I've settled on
for that back-and-forth to stay quick.

## Getting started

```bash
docker-compose up -d          # Postgres (+ any other local services)
cd api && npm install && npm run dev
cd web && npm install && npm run dev
```

See each package's `.env.example` for required environment variables.
