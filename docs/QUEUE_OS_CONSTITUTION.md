# Queue OS Constitution
**Version 1.0 — July 2026**

> This document governs all development decisions for Queue OS.
> Every feature, architecture change, and code pattern must align with these principles.
> When in doubt, refer here first.

---

## 1. Product Vision

Queue OS is a **complete Queue Operating System** — not a clinic app, not a hospital tool, not a Pakistani-only product.

It is infrastructure for managing human queues across any organisation, any country, any scale.

**Today:** A single-queue dashboard for small businesses with a public directory and claim flow.

**Tomorrow:** A multi-tenant enterprise platform serving hospitals, government offices, banks, universities, embassies, and large corporations — with departments, counters, staff, services, analytics, and reporting.

**The north star:** Every organisation on earth that makes people wait should be able to use Queue OS.

---

## 2. Core Principles

### 2.1 One codebase. One deployment. One database.
There will never be separate applications for small businesses vs enterprise.
Enterprise functionality unlocks through feature flags, subscription plans, and permissions — never through a separate codebase.

### 2.2 Generic by design
Nothing in the architecture should assume "clinic", "Pakistan", or "small business".
Every model, route, and component should work equally well for a dental clinic in Rawalpindi and a government ministry in Riyadh.

### 2.3 Database is the single source of truth
The frontend is presentation only. The worker validates everything. HTML never makes security decisions.

### 2.4 Scalability from day one
Decisions made today must not block the enterprise path tomorrow.
A choice that works for 10 businesses must also work for 10,000.

### 2.5 No hacks. No temporary fixes. No hardcoding.
Every workaround accumulates technical debt. Write it right or document why it can't be right yet.

---

## 3. Architecture Principles

### 3.1 Multi-Tenant Architecture

```
Organization
    ├── Branches
    │      ├── Departments
    │      │      ├── Counters
    │      │      ├── Services
    │      │      └── Queues
    │      └── Staff
    └── Customers
```

**Current state:** Organization = Shop (single branch, single queue)
**Evolution path:** Organizations gain branches → branches gain departments → departments gain counters

This evolution must happen without breaking existing single-queue businesses.

### 3.2 Feature Flag Philosophy

Enterprise features are gated by:
1. **Subscription plan** — Free/Basic/Pro unlock different feature sets
2. **Feature flags** — Per-shop boolean flags (allow_priority_call, allow_paid_tokens, etc.)
3. **Organization type** — Future: small_business / enterprise / government
4. **Permissions** — Future: staff roles, counter assignments, supervisor access

Never use separate code paths for small vs enterprise. Use the same code, gated by flags.

### 3.3 Frontend Architecture (Critical)

**Current approach (acceptable for now, not for the future):**
- Large single HTML files (admin.html, index.html, customer.html)

**Target architecture:**
```
pwa/
  pages/
    admin/          — modular admin pages
    business/       — business dashboard
    customer/       — customer directory and queue
    reception/      — future: reception desk view
  components/
    navbar.js
    queue-card.js
    business-card.js
    modal.js
    table.js
  services/
    api.js          — all fetch() calls
    auth.js         — session management
    queue.js        — queue state management
    notifications.js
  utils/
    helpers.js
    validation.js
    formatting.js
  styles/           — shared CSS variables and components
```

**Rule:** No single HTML file should exceed ~500 lines of JavaScript.
When a file exceeds this, extract into services/ or components/.

### 3.4 Backend Architecture

```
worker/src/
  routes/         — HTTP handlers (thin, delegate to services)
  services/       — business logic (reusable, testable)
  utils/          — shared utilities (db, auth, response, crypto)
  middleware/     — CORS, rate limiting, auth checks
```

**Rule:** Routes should not contain business logic.
Routes receive requests, call services, return responses.
Services contain all logic and can be tested independently.

---

## 4. Database Philosophy

### 4.1 Idempotent migrations
Every SQL file must be safe to run multiple times.
Use `IF NOT EXISTS`, `CREATE OR REPLACE`, `ON CONFLICT DO NOTHING`.

### 4.2 Soft deletes
Important records (shops, tokens, subscriptions) should be soft-deleted where possible.
Add `deleted_at TIMESTAMPTZ` rather than hard deleting.

### 4.3 Audit trails
Financial and access records (subscriptions, payments, activations) must never be deleted.
Status columns (status='expired', status='cancelled') replace deletion.

### 4.4 Status as single source of truth
`subscriptions.status = 'active'` is the governing field for subscription validity.
`shops.is_active` is a cache/convenience field that must always be kept in sync.
The subscription status wins in case of conflict.

### 4.5 No N+1 queries
Every list endpoint must batch-fetch related data.
Never loop over results and query inside the loop.

---

## 5. Security Rules

1. **Every admin endpoint** must call `requireAdmin()` before touching data
2. **Every shop endpoint** must call `requireShopAuth()` and verify `auth.shop_id === requested_shop_id`
3. **Public endpoints** expose only non-sensitive fields (no owner_phone in full, no pin_hash ever)
4. **PINs** are always hashed with bcrypt before storage — never stored in plaintext
5. **Session tokens** expire after 30 days — no exceptions
6. **Rate limiting** on WhatsApp and auth endpoints to prevent abuse
7. **Frontend never makes security decisions** — all validation is server-side

---

## 6. Subscription Philosophy

### 6.1 Snapshot architecture
When a subscription is assigned, plan limits (`max_tokens_per_day`, `max_queue_size`) are copied onto the subscription row. This enables per-business custom overrides while still having global plan defaults.

### 6.2 Propagation is explicit
Changing a plan's defaults does NOT automatically update existing subscriptions.
Admin must explicitly choose to propagate changes using the "apply to existing" option.
This protects custom-plan businesses from accidental overwrites.

### 6.3 Cron safety
The `expire_subscriptions()` function deactivates shops only when their **most recent** subscription is expired. Historical expired rows from previous billing periods are ignored.

---

## 7. Business Directory & Mini Website

### 7.1 Every business gets a public page automatically
URL pattern: `queue-os.pages.dev/shop.html?id=<uuid>` or `shop.html?slug=<slug>`

This page shows: name, category, area, address, opening hours, description, logo, live queue stats, and a "Get Token" CTA for active businesses.

### 7.2 Businesses edit information once
The business dashboard Settings panel is the editor. The public page reads directly from the database. Single source of truth.

### 7.3 Unclaimed businesses
Businesses can be seeded into the directory before they join the platform.
They show as "Unclaimed" and allow anyone to submit a claim request.
Admin approves claims, which activates the business and starts a 30-day trial.

### 7.4 Future mini website capabilities
- Logo and cover image upload
- About section
- Services list
- Doctors/staff profiles
- Google Maps integration
- Customer reviews
- Announcements
- Photo gallery
- SEO-friendly metadata for every business

---

## 8. Business Importer

### 8.1 No more SQL seed files
City-specific SQL seed files are deprecated.
The permanent solution is `scripts/import-businesses.js`.

### 8.2 Usage pattern
```bash
node scripts/import-businesses.js --file data/city.xlsx --city CityName --country Country --dry-run
node scripts/import-businesses.js --file data/city.xlsx --city CityName --country Country
```

### 8.3 Supported formats
CSV and Excel (.xlsx/.xls). Column names are matched by keyword, case-insensitive.

### 8.4 Adding a new city/country
1. Get a spreadsheet of businesses
2. Run the importer with --dry-run to preview
3. Run without --dry-run to insert
4. Done. No SQL. No code changes.

---

## 9. International Support

Architecture must never assume:
- Pakistani phone number format (03xx-xxxxxxx)
- Pakistani currency (Rs/PKR)
- Pakistan timezone (PKT/UTC+5)
- Urdu or English as the only languages
- Specific address format

All of these must be configurable or derived from the business's country/city setting.

**Supported markets (planned):**
Pakistan → UAE → Saudi Arabia → UK → Italy → Europe → Global

---

## 10. API Philosophy

### 10.1 RESTful
- GET for reads, POST for creates, PATCH for updates, DELETE for deletes
- Resources are nouns: `/shops`, `/tokens`, `/subscriptions`
- Actions use sub-resources: `/shops/:id/activate`, `/tokens/:id/cancel`

### 10.2 Consistent response shape
```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "Human-readable message" }
```

### 10.3 Meaningful errors
Never return generic "Error occurred". Always explain what failed and why.

### 10.4 No breaking changes
Adding fields to responses is safe. Removing or renaming fields is a breaking change and requires a versioned endpoint.

---

## 11. Code Quality Standards

1. **Functions do one thing** — if it needs a comment to explain what it does, it should be split
2. **No magic numbers** — constants are named
3. **No commented-out code** — delete it or put it behind a feature flag
4. **Consistent naming** — camelCase for JS, snake_case for SQL/DB columns
5. **Error handling everywhere** — no silent failures, no empty catch blocks
6. **No `console.log` in production code** — use proper error returns

---

## 12. Roadmap

### Phase 1 (Current) — Stable Foundation
- [x] Single-queue business dashboard
- [x] Customer directory and token flow
- [x] Admin dashboard
- [x] Subscription system
- [x] Unclaimed business listings
- [x] Business public page
- [x] Claim flow
- [x] Business importer (CSV/Excel)
- [x] Bilingual support (EN/UR)

### Phase 2 — Enterprise Foundation
- [ ] Modular frontend architecture (components/services)
- [ ] Organization model with branches
- [ ] Department and counter support
- [ ] Staff/reception accounts
- [ ] Multi-queue per organization
- [ ] Analytics dashboard

### Phase 3 — Growth
- [ ] Reviews system
- [ ] Business photo gallery
- [ ] Announcements
- [ ] Advanced analytics
- [ ] WhatsApp notifications (automated)
- [ ] SMS notifications

### Phase 4 — Marketplace
- [ ] Searchable directory with filters
- [ ] Premium visibility for businesses
- [ ] Customer accounts (track history)
- [ ] Ratings and reviews
- [ ] Nearby discovery

### Phase 5 — International
- [ ] Multi-currency support
- [ ] Multi-timezone support
- [ ] Arabic, Hindi, Italian, French language support
- [ ] Regional phone/address formats
- [ ] UAE, Saudi, UK, Italy market launch

---

## 13. What We Will Never Do

1. Create a separate app for enterprise vs small business
2. Hardcode "clinic" or "Pakistan" anywhere in generic logic
3. Store PINs or passwords in plaintext
4. Return sensitive fields (pin_hash, full phone) from public endpoints
5. Build giant monolithic HTML files with thousands of lines
6. Use raw SQL seed files for data imports
7. Make frontend responsible for security decisions

---

*This constitution is a living document. Update it when the product vision evolves.*
*Last updated: July 2026*
