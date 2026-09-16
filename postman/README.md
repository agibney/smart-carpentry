# Postman collection

`smart-carpentry.postman_collection.json` — manual API testing against `api/`'s endpoints with
real Keycloak-issued tokens, for cases the web UI doesn't cover yet (e.g. creating a client —
no web UI for that exists yet) or cross-tenant checks (confirming one business's data isn't
reachable with another business's token).

**Setup**: import the collection into Postman, then temporarily enable **Direct access
grants** on the `carpentry` realm's `web-app` client (Keycloak admin console → Clients →
web-app → Settings → Capability config → Save). That's off by default — real login only ever
uses Authorization Code + PKCE — so flip it back off when you're done testing.

**Usage**: run the requests in the **Auth** folder first (each saves its `access_token` into a
collection variable); the rest of the collection's requests reference those via
`{{access_token_owner}}` etc. The "Get Token - business_b" request has placeholder
`username`/`password` values — edit them to match whatever business you've created locally
before running the Tenant Isolation Check folder.
