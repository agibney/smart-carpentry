# Smart Carpentry — Requirements (Draft)

## Vision
A project management, scheduling, and bidding tool built first for a solo
carpenter (with occasional subcontractors), designed so it could later be
marketed to similar solo/small-team tradespeople — carpenters, handymen,
landscapers.

## Decision: multi-tenant from the start
Every table gets scoped to a `business_id`, and each business (e.g. a small
local contractor's) has its own login. A user's session is tied to exactly one
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

## Access control: USERS and admin scope
- `USERS` table: `id`, `business_id` (nullable FK), `user_type`
  (`business` / `global`), `role`, `name`, `email`, `preferred_language`.
- `user_type` and `role` are deliberately separate fields, not one
  overloaded field: `user_type` determines *scope* (which business a user
  is confined to, or whether they operate across all businesses),
  `role` determines *permission level* within that scope (e.g. owner vs.
  employee within a business; support vs. super-admin at the global
  level). Keeping these orthogonal avoids awkward combinations a single
  field would force together.
- `business_id` is nullable specifically to represent global-scope users
  (e.g. platform-level admin/support access across all tenants) — a
  regular business user always has a `business_id`; a global user does
  not.
- This mirrors a real-world pattern from prior device-management work:
  global admins see across all tenants, tenant-scoped admins/users see
  only their own tenant's data. The practical implication: no query can
  rely on a single uniform `WHERE business_id = :current` filter anymore
  — every route needs an explicit branch for "is this a global user,"
  since that's exactly the kind of check that's easy to add in one place
  and forget in another (the same class of bug as a missing
  authorization check on a single route while a sibling route has it).
- Every business-scoped table carries `business_id` directly, even where
  it's technically derivable through a join (e.g. via `client_id` on
  `PROJECTS`, or via `project_id` on `ATTACHMENTS`). This is a deliberate,
  uniform rule — no table is the exception that has to be remembered —
  precisely to guard against the class of bug where an indirect scoping
  chain gets missed in one code path.
- `MATERIALS`/pricing data is business-scoped for two independent
  reasons: (1) the same uniform-consistency principle above, and (2)
  businesses can have distinct negotiated or special pricing from
  suppliers that shouldn't be visible to other tenants — this is real
  business-specific data, not just shared public retail pricing.

## PII encryption approach
- **Method:** application-level encryption (AES-256-GCM via Node's
  built-in `crypto` module), not database-level (`pgcrypto`) or a full
  KMS/envelope-encryption setup. Application-level is the most
  transparent option for this project's scale — the encryption/decryption
  logic lives in application code that can be pointed to and explained
  directly, rather than being implicit in a database extension. A KMS
  (e.g. AWS KMS) is the right answer at real production scale, but is
  more infrastructure than this project needs today.
- **Fields encrypted:** `phone_encrypted`, `email_encrypted`,
  `address_encrypted` on `CLIENTS` (see "Internationalization /
  localization" below for `CLIENTS.preferred_language`, a separate,
  unencrypted field).
- **Searchability problem:** strong encryption (random IV per value) is
  non-deterministic — encrypting the same email twice produces different
  ciphertext, so an encrypted column can't be searched with a direct
  equality match.
- **Solution — paired hash columns for exact-match lookup:** alongside
  each encrypted field that needs to be searchable, store a separate
  deterministic HMAC-SHA256 hash (e.g. `email_hash`, `phone_hash`), keyed
  with a secret HMAC key (not a plain hash — plain hashes of low-entropy
  data like emails are vulnerable to precomputed dictionary attacks).
  Lookups query the hash column with a normal equality match; the
  matched row's encrypted field is then decrypted for display/use.
  Values are normalized (trimmed, lowercased) before hashing so
  `John@X.com` and `john@x.com` match the same hash.
- **Matches real usage pattern:** clients are looked up by exact phone
  number or exact email pulled directly from a text, call, or email
  thread — never a partial/fuzzy fragment — so exact-match hash lookup
  covers the real search need. `name` is not encrypted and supports
  normal fuzzy search (`ILIKE`) directly. `address` is encrypted but not
  paired with a hash column, since address lookup isn't an anticipated
  use case — it's stored for display only.
- **Limitation to note:** this approach only supports exact-match lookup,
  not partial/fuzzy search, on any encrypted+hashed field. If fuzzy
  search on an encrypted field is ever needed, this pattern doesn't cover
  it — searchable encryption schemes exist but are significantly more
  complex and are considered out of scope for this project's size.
- **Key management (open item):** where `encryptionKey` and `hmacKey`
  themselves live is still to be decided — environment variables are the
  minimal starting point; a secrets manager is worth revisiting if this
  ever moves toward the V3 multi-business product vision.

## Internationalization / localization
- Motivated by a real, common scenario: many contractors/subcontractors in
  the target market speak Spanish primarily, not English.
- Two distinct concerns, handled differently:
  - **UI localization** (the app's own interface — labels, buttons, menus):
    handled via translation files (e.g. i18next, a standard React choice),
    not stored in the database. `USERS.preferred_language` determines
    which translation set loads for that user. This is the primary need
    driving this feature — subcontractors need the app itself to work in
    their language.
  - **Content localization** (client-facing data — bid text, project
    descriptions) existing in multiple languages: NOT built now. Adding
    `preferred_language` to `CLIENTS` supports a lighter, related need —
    determining what language client-facing communications (e.g. a bid
    PDF, an automated notification) are generated in — without taking on
    the larger, separate problem of storing/maintaining translated
    versions of arbitrary content. Full content translation (e.g. a bid
    description existing in both English and Spanish) is a future
    consideration, not a V1/V2 commitment.
- Schema impact: `preferred_language` added to both `USERS` (drives UI
  language) and `CLIENTS` (drives client-facing communication language) —
  same field name, two different purposes worth keeping distinct when
  reasoning about the design.

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
  owner — see "PII encryption approach" above for the concrete mechanism
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
    presenting a number as current when it may not be. Business-specific
    negotiated/special pricing (see "Access control" above) is a known
    gap to revisit when this moves from manual entry to live API
    integration.
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

## Known Limitations
Scope limitation: This system's privacy protections (scrubbing, encryption,
access control) apply to data once it enters the application. The system
does not control, and cannot guarantee, what happens to photos or client
information before that point — e.g., photos taken on a personal device
before upload, or client-sent images shared directly via text/email outside
the app. Where feasible (e.g., in-app camera capture), the system will aim
to minimize exposure before ingestion, but this remains a known boundary of
the design.

Search limitation: encrypted PII fields paired with a hash column
(phone, email) only support exact-match lookup, not partial/fuzzy search.

## Open TODOs / Future Considerations
Captured to revisit later, not yet scoped into a tier:
- **Navigation/menu system** — left sidebar, decided per user type:
  - Business user: Dashboard, Projects (Bids nested under individual
    projects, not top-level), Clients, Subcontractors, Materials, Settings
    (Users nested inside Settings, likely owner-role-only).
  - Global admin: Businesses, Users, Settings.
  - Post-login routing fix landed first (`/dashboard` and `/admin/dashboard`
    placeholders — see web/app/routes.ts and auth.server.ts's
    handleLoginCallback) so neither role lands directly on a create form;
    the full nav/dashboard UI itself is still TODO, pending Sakai below.
- **Dashboard content** (placeholder routes exist; content still TODO):
  - Business dashboard: active projects, pending/unsent bids, upcoming
    project start/end dates, quick-add actions for Project/Client.
  - Global admin dashboard: total businesses, recently created businesses,
    anything flagged for admin attention — explicitly *not* any specific
    business's projects/clients/data.
- **Global admin as a true super-user** — not just managing the businesses
  list (`/api/businesses`), but able to view/modify data across *all*
  entity types for *any* business, not only its own. This is a superset of
  the "act as business X" impersonation gap already flagged as a known V1
  limitation in the Keycloak auth work. Decided shape: impersonation ("act
  as business X", reusing the existing `scopedTo` tenant-scoping logic)
  rather than a parallel unrestricted cross-tenant access path — safer and
  keeps every access auditable as a specific business context, instead of
  a separate code path that bypasses tenant scoping entirely.
- **Adopt Sakai** (PrimeReact's official free admin template, MIT-licensed,
  https://sakai.primereact.org/) as the layout/nav/dashboard foundation,
  rather than building the navigation shell and layout conventions from
  scratch. Decided, not just under consideration — hold off on custom
  nav/dashboard styling until it's integrated, to avoid duplicate work.
- **Client-facing portal (future, post-MVP)** — view-only for v1: bid/quote
  status, project timeline, shared photos.
  - Access model still undecided: invite-only (simpler, likely v1 default)
    vs. self-registration (later, if product-izing).
  - One client login could map to one or multiple projects — TBD.
  - Photos need a "share with client" flag — not all internal job photos
    should be client-visible.
  - Timeline: decide if milestones are free-text updates or structured
    stages (structured is more work but reusable later for scheduling).
  - A later tier: async threaded comments on milestones/photos, not
    real-time chat — real-time messaging is a much bigger lift and
    competes with just texting him directly.
  - Sequencing: build after internal project tracking/timeline is solid,
    since the portal mostly surfaces existing state rather than invents
    new tracking logic.
- **Historical project import** — todo, needs full scoping. ~12 projects
  from this year exist only as one-off PDF/Word docs.
  - Critical constraint: existing bids are already finalized dollar
    amounts — must NOT be recalculated through the itemized bid engine.
  - Implies two bid entry modes: "new bid" (itemized, calculated) vs.
    "historical/recorded bid" (flat total + scope description, locked from
    recalculation).
  - At this volume (~12), manual entry via the standard create/edit form
    is likely faster than building an AI-extraction pipeline; an
    extraction pipeline could be worth revisiting if this becomes a
    multi-customer product with a larger backlog.
  - Still open: how much line-item detail (if any) to capture for
    historical entries.
- **Solo-tradesperson UX principles** (cross-cutting, applies to multiple
  existing features):
  - Near-zero-friction quick actions for frequent tasks (status updates,
    expense/receipt logging) — a few-tap ceiling, not a rule for every
    flow.
  - Visual-first status indicators: color-coded badges/progress bars
    instead of text-heavy status lists.
  - Voice input reprioritized higher rather than left as a late deferred
    feature, given the on-the-job/hands-dirty use case (see "Mobile +
    voice input" under V2 above).
  - Task-scoped linear wizard flows (e.g. new project, generate bid)
    rather than making the whole app linear — coexists with the dashboard
    as an overview entry point.
  - Framed as broadly valuable for solo tradespeople generally — relevant
    if this becomes a marketable product (see V3).
- **Before/after photo + marketing feature**:
  - Photo capture at project start ("clock in") and project end ("clock
    out") — fits naturally into existing photo storage plans and
    wizard-style task flows.
  - Lower-risk tier: just the photo capture itself.
  - Higher-risk tier: auto-generating captions and posting to
    social/Google Business — recommend draft-and-approve (one-tap
    confirm) rather than fully automatic posting, consistent with the
    app's existing "AI suggests, human confirms" pattern.
  - Needs a per-project "OK to share publicly" flag for client
    privacy/consent, since job sites are on clients' property and photos
    may show identifying details.
  - Templated captions (neighborhood, job type, canned CTA) achievable
    without AI; AI-generated caption variation could layer on later.
  - Google Business Profile likely higher-value/simpler API than Meta for
    a local tradesperson — worth considering first if this gets built out.
