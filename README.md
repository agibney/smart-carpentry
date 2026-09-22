# Smart Carpentry

A personal project: project tracking and fast bidding for a solo carpentry
business. It's client-facing tooling for a real solo carpenter, built to
develop production React experience alongside my existing Vue background,
and as a way to learn agentic AI development patterns.

**Early stage, personal project, MIT licensed — not actively seeking
contributions at this stage.** Core CRUD (projects, bids) is being built out
on top of real Keycloak-backed auth (OIDC, Authorization Code + PKCE);
scheduling and the rest of the roadmap below are not implemented yet.

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
- [`postman/`](postman/README.md) — Postman collection for manual API
  testing against `api/` with real Keycloak-issued tokens.

## Observability (planned)

Not implemented yet. Planned stack: Prometheus + Grafana for metrics and
dashboards (via `prom-client` on the Express API, scraped at a `/metrics`
endpoint — request latency, error rates, queue depth if background jobs get
added later), plus OpenTelemetry tracing to show a request's full path
through API → agent calls → DB. Chosen over a paid SaaS (e.g. Datadog)
because it's fully self-hostable for a personal project, and tracing in
particular is worth showing off given the project's agentic/MCP angle.

## Working with Claude Code

I use Claude Code as a working pair on this project: I write specs (either
in chat or as docs like `docs/requirements.md`), Claude proposes an
implementation plan and the code, and I review and correct before anything
gets committed — nothing lands without me reading and understanding it
first. `CLAUDE.md` in this repo captures the conventions I've settled on
for that back-and-forth to stay quick.

## Getting started

```bash
docker-compose up -d          # Postgres + a local Keycloak (realm auto-imported)
cd api && npm install && npm run dev
cd web && npm install && npm run dev
```

See each package's `.env.example` for required environment variables —
`api/` and `web/` both need the local Keycloak realm/client settings, plus
`web/`'s own `SESSION_SECRET`.

## License

MIT — see [LICENSE](LICENSE).
