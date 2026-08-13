# Smart Carpentry — Requirements (Draft)

## Vision
A project management, scheduling, and bidding tool built first for a solo
carpenter (with occasional subcontractors), designed so it could later be
marketed to similar solo/small-team tradespeople — carpenters, handymen,
landscapers.

## Decision: multi-tenant from the start
Every table gets scoped to a `business_id`, and each business (e.g. a small local contractor's) has its own login. A user's session is tied to exactly one
business/tenant; all queries filter by that tenant.
- Adds a `businesses` table (id, name, created_at, etc.)
- Every existing table (clients, projects, bids, subcontractors,
  attachments) gets a `business_id` foreign key
- Auth needs to resolve which business a logged-in user belongs to, and
  every server route must scope its query by that business — this is the
  part that most needs discipline (a missed filter = a data leak across
  tenants), so it's worth a shared helper/middleware pattern rather than
  remembering to add `.where(eq(table.businessId, ...))` by hand in every
  route.

## Scope tiers

### V1 — Core (personal use, single business)
- Clients, projects, bids, bid line items, subcontractors, attachments
  (already modeled)
- **Gaps to add:**
  - Actual cost tracking — separate from bid line items, so "bid vs.
    actual" comparison is possible
  - **Bid revisions & change orders** — resolved design:
    - `BIDS` and `BID_LINE_ITEMS` stay as the "current state" he actually
      edits — no change to his existing workflow of updating a bid in
      place.
    - New table `BID_REVISIONS`: `id`, `bid_id` FK, `revision_number`,
      `revision_type` (`initial` / `adjustment` / `change_order`),
      `reason` (free text), `total_amount` (snapshot),
      `line_items_snapshot` (JSON snapshot of line items at save time),
      `created_at`. A revision is saved on an explicit action or when the
      total changes meaningfully — not every keystroke.
    - **Threshold for revision vs. new project:** a change substantial
      enough to be its own scope of work (not just a tweak to the
      existing scope) becomes a new, linked project rather than a bid
      revision.
      - Add `parent_project_id` (self-referencing FK, nullable) to
        `PROJECTS` — links a major addition back to the original project
        for the same client, while giving it its own bid, line items,
        and schedule entries.
      - This is a judgment call for the business owner in the moment,
        not something the app enforces — the schema supports both paths.
      - Side benefit: "other projects for this client" (including
        linked ones) becomes a natural view — full project history per
        client, not just one project at a time.
- Client PII (contact info) encrypted at rest, masked from anyone but the
  owner
- Photos in private storage, signed URLs only, EXIF stripped

### V2 — Near-term additions
- **Scheduling** — calendar/timeline view for projects, accounting for
  family obligations (blocked-off personal time) in addition to weather.
- **Weather integration** — actively suggests reschedules,
  not just informational. Data source: National Weather Service API
  (api.weather.gov) — free, official U.S. data, no ToS gray area (unlike
  the retail pricing scrapers).
  - New table `SCHEDULE_ENTRIES`: `id`, `project_id` FK, `planned_date`,
    `status` (scheduled/rescheduled/completed), `weather_sensitivity`
    enum (`none`, `outdoor_general`, `temperature_sensitive`,
    `wind_sensitive`, `ground_condition_sensitive`), `notes`. The
    sensitivity enum is designed to generalize across trades (e.g.
    `ground_condition_sensitive` covers landscaping's wet-ground/sod
    concerns, not just carpentry).
  - Add `job_site_location` (zip or lat/long) to `PROJECTS` — separate
    from the client's billing/contact address, needed for weather lookups
    and later reusable for mileage tracking.
  - Logic: check upcoming weather-sensitive schedule entries against the
    forecast, apply a threshold per sensitivity type, and on a flag
    suggest the next 2-3 days that look clear rather than just warning.
- **Pricing integration** — sequencing decision: start with manual price
  entry plus a `fetched_at`/`last updated` timestamp for V1 (no external
  API dependency). Move to a live pricing API in V2 once it's clear how
  often prices go stale enough to matter for real bids.
  - Third-party options researched: Unwrangle (Lowe's + other retailers),
    SerpApi (Home Depot-specific engine, built-in 1hr caching, free tier
    to prototype), BigBox API (Home Depot-specific, lowest cost). None are
    official retailer APIs — all are commercial scrapers of public product
    pages, so budget for occasional breakage when a retailer changes its
    site.
  - Caching design: a `material_prices` table (sku, retailer, price,
    fetched_at); check freshness before re-fetching (e.g. reuse if under
    24-48h old); always surface the price's age in the UI rather than
    presenting a number as current when it may not be
- **Mileage tracking** — start with manual entry; design so it can be
  swapped for real GPS tracking or a third-party integration later without
  a schema rework. Feeds into project cost tracking as a cost line, not
  just tax reporting.
  - New table `MILEAGE_ENTRIES`: `id`, `business_id`, `project_id` FK
    (nullable, for non-project trips), `date`, `miles`, `purpose`/`notes`,
    `rate_per_mile` (captured at time of entry so historical entries stay
    accurate if the standard rate changes), `computed_cost` (miles ×
    rate) — this computed cost rolls into the project's actual-cost
    tracking alongside bid line items.
  - `job_site_location` (added for weather) can later support
    auto-calculating distance once GPS/integration is added — no new
    location field needed for that upgrade.
- **Reporting** — cost and revenue summaries per project/time period.
  Framed as general financial reporting, *not* a tax tool — avoids taking
  on liability for tax accuracy or completeness. If tax-adjacent reporting
  is pursued later, this needs review with an accountant or lawyer before
  being marketed that way.
- **AI-generated design options** — client-facing visual concepts (e.g.
  material/style variations) to help close bids. Supports both image-to-
  image (transforming an actual photo of the client's space) and
  text-to-image (from-scratch concept renders when there's no existing
  photo) depending on the project.
  - No new table — extends `ATTACHMENTS`: adds `design_concept` to the
    `type` field, plus `source_attachment_id` (nullable, self-referencing
    — links a generated concept to the original photo it was based on)
    and `prompt` (text, what was requested).
  - Agent tool takes a `variation_count` parameter (default ~3, tunable
    later) rather than hardcoding how many options get generated.
  - Guardrails: generated images are illustrative concepts, not a
    guarantee of final appearance — needs a visible label in the UI, not
    just a one-time disclaimer. Image generation has a real per-image
    cost (unlike the mostly-text line-item agent), so generation should be
    metered/rate-limited per bid rather than freely regenerable.
- **Mobile + voice input** — runs as an installable PWA (not a separate
  React Native app) so it stays within the single frontend being built,
  rather than fragmenting into a third framework to learn/maintain.
  - Voice handles quick logging first (progress notes, mileage, status
    updates) — not full bid/project creation initially.
  - Flow: record audio in-browser (MediaRecorder API) → Nitro route →
    cloud speech-to-text (e.g. Whisper API — chosen over the browser's
    built-in Web Speech API since job sites are noisy and accuracy
    matters) → transcript passed to agent tool `parse_voice_log`.
  - `parse_voice_log` takes the transcript plus the business's active
    project list (for name-matching, e.g. "the Smith deck job") and
    returns a structured intent: `progress_note`, `mileage_entry`, or
    `status_update` (each with the relevant fields) — never raw text
    written directly to the DB.
  - Same discipline as bid calculations: the agent structures the intent,
    it doesn't unilaterally commit meaningful state changes. Low-risk
    intents (a progress note) can save directly; ones that change data
    the owner cares about getting right (mileage figures, status changes)
    get a quick confirm step before saving, at least until transcription
    accuracy is trusted.
  - **On-site photo capture** — mobile camera access to add job-site
    photos directly to `ATTACHMENTS`, tied to the current project (or
    held pending until a new project is created, per below).
  - **Automatic photo redaction** — on every upload: strip all EXIF
    metadata (GPS + other identifying tags), then run automatic detection
    for faces (reliable via a cloud vision API), license plates, and
    street-number/address text (lower accuracy — OCR-based). A blurred
    derivative is generated and stored as `redacted_storage_key` on
    `ATTACHMENTS`, alongside `redaction_status`
    (`pending`/`processed`/`reviewed`) and `detections` (JSON bounding
    boxes, for manual review/adjustment).
    - The redacted version is what renders by default everywhere,
      including the owner's own review screen — an explicit "show
      original" toggle is the only way to see the unblurred photo. Safer
      default given it's not yet decided exactly when redaction matters
      most (client's own file vs. portfolio/marketing/other clients).
    - Automatic detection is a first pass, not the final word — plate
      and address-text detection especially can miss things, so the
      owner should review/confirm before a photo is used anywhere
      sensitive (client-facing design concepts, any future public
      portfolio use).
  - **Quick new-project setup** — a lightweight on-site flow to create a
    project on the spot: client (existing or quick-add new), project
    title, initial photos. `job_site_location` can auto-fill from the
    device's GPS at capture time instead of being entered manually later.

### V3 — Product vision (multi-business)
- Multi-tenant architecture (see decision above)
- Per-business configuration (solo vs. small team, different trades)
- Packaging/marketing as a SaaS tool for solo/small-team tradespeople

## Non-functional requirements (carry through all tiers)
- Client contact info and photos remain protected regardless of scope tier
- If multi-tenant: full data isolation between businesses is a hard
  requirement, not just role-based access within one household
- Liability awareness: any reporting/export feature should avoid implying
  tax-compliance guarantees
- **Bid calculations are pure, deterministic code — never AI-generated.**
  The agent may suggest line items (description, quantity, unit,
  suggested price, category) but never a subtotal, markup, tax, or total.
  A single pure function owns all bid math; the UI always calls it rather
  than trusting any stored/cached total. `BID_LINE_ITEMS` gets a `source`
  field (`ai_suggested` / `price_lookup` / `manual`) so a reviewer can see
  which numbers need closer scrutiny. Agent-suggested quantities/prices
  are validated (no negatives, outlier flags against lookup prices) before
  reaching the calculation — failures surface for review rather than
  silently falling back to a default.