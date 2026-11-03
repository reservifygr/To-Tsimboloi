# To Tsimboloi (Το Τσιμπολόι): demo website and pickup ordering

> **DEMO MODE.** This is a client proposal prepared by Reservify. It sends **no real orders, payments, SMS, emails, deposits or bookings**. All data stays in the visitor's own browser (localStorage). Every page shows a DEMO banner.

Bilingual (Greek first at `/`, English at `/en/`) restaurant site for the meze tavern at **Agiou Ioannou 71, Agia Paraskevi, Athens · 210 600 5412**, with a pickup-ordering demo and a staff dashboard.

| Route | What it does |
|---|---|
| `/` | Home: hero, call-to-book, menu highlights, live music, parties, 15% card, visit info |
| `/menu/` | Full structured menu, category nav, works **without JavaScript**, print layout + QR dialog, `?table=12` chip for table QR codes |
| `/order/` | Pickup only: item dialog (options, quantity, notes), cart, name/phone, pickup time, "pay at pickup" label, DEMO submit |
| `/admin/` | Staff demo: fixture login, roles, incoming-orders board, status flow, sound after a click, pause ordering, prep time, availability/price edits, simulated orders, reports, audit log |
| `/events/` | Undated placeholder cards, calendar, party/group inquiry form (never auto-confirms) |
| `/offers/` | Offers, all labelled "Concept – subject to approval"; coupon architecture only (no code is redeemable) |
| `/contact/` | Click-to-call, Google Maps / OpenStreetMap links, Instagram (unverified), DEMO message form |
| `/privacy/` | Draft GDPR privacy + cookie notice (needs a lawyer's review) |

## Run it

Requires Node 20+. **No dependencies**: nothing to install.

```bash
npm run dev          # build to dist/ and serve on http://localhost:4173
npm test             # 37 unit tests (domain, i18n, SEO, honesty guards)
npm run test:e2e     # 15 end-to-end tests in headless Chrome (set CHROME_PATH if Chrome is not in /usr/bin)
npm run shots        # regenerate screenshots/
```

Build options (environment variables): `RELATIVE=1` (relative links, so the site works from any folder or preview host), `SITE_URL` (canonical origin, default `https://tsimboloi-demo.example`), `BASE` (sub-path, e.g. `/To-Tsimboloi` for GitHub Pages), `INDEXABLE=1` (allow search indexing; **off by default** so the demo is never indexed).

### Demo credentials (public fixture, not a secret)

| User | Passcode | Can do |
|---|---|---|
| `owner` | `owner-demo` | everything incl. prices and prep time |
| `staff` | `staff-demo` | orders, availability, pause, reports, simulate |
| `kitchen` | `kitchen-demo` | start preparing / mark ready, availability |

The login is client-side only and provides **no security**. It exists to demonstrate role gating. Open `/admin/` in two tabs to see live updates and the "changed on another device" conflict protection.

## Architecture

```
src/shared/      pure ES modules used by the browser AND Node tests
  menu-data.js   typed menu (MenuCategory, MenuItem, OptionGroup), prices in integer cents
  cart.js        immutable cart, option validation, quantity bounds, totals recomputed from menu
  orders.js      Order/OrderItem, StaffRole, state machine, role gating, optimistic concurrency, audit trail
  adapter.js     DemoAdapter (localStorage, idempotent submit, event log)  |  ProductionAdapter (inert, throws)
  hours.js       opening hours (UNVERIFIED) + Athens-timezone pickup-slot generator
  inquiries.js   Inquiry validation (event requests + contact messages); confirmed is always false
  content-data.js venue facts, Event and Offer placeholders, Coupon architecture
  qr.js          dependency-free QR encoder (byte mode, ECC M, RS verified against published vectors)
  strings.js     all UI copy, Greek + English (key parity is tested)
src/site/render.js  build-time renderer: layout, SEO head, hreflang, JSON-LD, sitemap, robots
src/client/      page scripts (app, menu, order, admin, events, offers, contact, forms)
src/styles/      one stylesheet incl. print + reduced-motion
scripts/         build.mjs (pre-renders 16 pages), serve.mjs (static server)
tests/unit, tests/e2e   node:test; e2e drives Chrome over the DevTools protocol (no Playwright/Puppeteer needed)
```

Key rules, enforced in code and tests:
- **Server-authoritative pricing**: an order's prices are recomputed from the menu (with staff overrides); client totals are ignored.
- **No duplicate orders**: every submit carries an idempotency key; the same key returns the same order. The button is also locked during submission (tested with a double click).
- **Race protection**: status changes need `expectedVersion`; a stale screen gets `STALE_VERSION` instead of overwriting.
- **Hours are unverified**, so pickup falls back to a typed "requested time" that staff confirm. The slot picker is built and tested and turns on when `HOURS.verified = true` with closing times.
- Structured data lists only name, address, telephone, URL and image. Hours, rating, reviews, cuisine, price range and social profiles are left out until verified.
- No third-party requests (tested): no fonts, maps, analytics or trackers load. "Analytics" is a local mock that records only after opt-in.

## Facts and their status

| Fact | Value used | Source | Status |
|---|---|---|---|
| Name | Το Τσιμπολόι / To Tsimboloi | brief | confirm Latin spelling (also seen as "Tsimpoloi") |
| Address | Αγίου Ιωάννου 71, Αγία Παρασκευή | brief, vrisko | confirmed by two sources |
| Postal code | 153 42 | vrisko | **NEEDS OWNER VERIFICATION** (not published on site) |
| Phone | 210 600 5412 | brief | confirmed |
| Opening hours | Wed–Fri from 17:00, Sat from 13:00, Sun 13:00–19:00, Mon/Tue closed? | Athinorama listing | **NEEDS OWNER VERIFICATION**, closing times unknown, not shown on site |
| Instagram | @to.tsimpoloi | link in an in2life.gr review, June 2026 | **NEEDS OWNER VERIFICATION** (profile not reachable for checking) |
| Facebook / Google Business / reviews | none found | searches | Nothing invented; no ratings or reviews shown |
| Previous name | "Κατσούνα" sign on the supplied exterior photo | owner photo | **Confirm the rebrand**; that photo is deliberately not used |
| Live music | "most weekends" | in2life.gr, June 2026 | shown as "a review mentions", no dates |
| Cretan / regional cuisine claims | not used | n/a | add only if the owner confirms |
| Menu items and prices | 25 items | brief transcription | all `verified:false`; dish names "pork fillets" and "soft drinks" need checking |
| Beers, wines, spirits, coffee | not listed | menu photos not supplied | **send the drinks menu** |
| Allergens / dietary labels | none | n/a | must come from the kitchen; a warning is shown instead |
| 15% discount card | exists | brief | terms, validity and combinability unknown; not treated as stackable |

## Assets and permissions

- `public/images/interior.webp`, `pan-snails.webp`, `plates-salad.webp`, `salad-feta.webp`, `og-interior.jpg` (crop of the interior): **owner-supplied for this demo**. Written permission to publish is still required. The exterior photo was excluded because it shows the old sign.
- No stock, press or AI images are used. Press photos found online were not copied (copyright).
- `public/images/live-music-sign.webp` (the venue's neon "Το Τσιμπολόι · Live music" sign, owner-supplied) is the brand image. The header logo (`logo-sign.webp`) and the favicons/touch icons are crops of the same photo. A clean vector version of the logo would be sharper at small sizes: ask the owner whether one exists.
- No university or college logos or names are used, and no partnership is implied.

## Deployment (static hosting)

`dist/` is plain static files. Any static host works (Netlify, Cloudflare Pages, Vercel static, GitHub Pages, nginx):

1. `SITE_URL=https://<final-domain> npm run build` (add `INDEXABLE=1` only after the owner approves go-live).
2. Upload `dist/`. Configure the host to serve `404.html` for unknown paths.
3. **GitHub Pages (set up):** `.github/workflows/pages.yml` runs the unit tests, builds with the right sub-path and commits the result to the `gh-pages` branch on every push to `main`. One-time step: repo **Settings → Pages → Deploy from a branch → `gh-pages` / (root)**. Live at https://reservifygr.github.io/To-Tsimboloi/ (noindex while in demo mode).
4. After the domain is final, regenerate and **phone-scan the table QR code** before printing.

## Production roadmap (not built, not connected)

This repo is **not** connected to the Reservify CRM, Yasu, or any production database. Going live with real ordering needs:

- **Backend** (e.g. Supabase/Postgres) behind the existing `ProductionAdapter` interface. Tables: `menu_categories`, `menu_items`, `option_groups`, `option_choices`, `orders`, `order_items`, `order_events` (append-only audit), `inquiries`, `staff_members` (role), `settings`.
- **Row-level security**: anonymous users may only insert orders/inquiries through a server function; staff read and update by role; only owners change prices; `order_events` is insert-only.
- **Server-side validation** reusing `src/shared` rules: recompute prices, validate options, `UNIQUE(idempotency_key)`, `version` check on every status change (`UPDATE ... WHERE version = $expected`).
- **Rate limiting + bot protection** on order and inquiry endpoints (per IP/phone), plus phone verification or a call-back policy against prank orders.
- **Staff notifications**: realtime subscription for the dashboard, optional kitchen ticket printer, and SMS/email only through a vetted provider with consent.
- **Policies**: cancellation, no-show and refund rules; online payment only if a provider is chosen (currently "pay at pickup" only).
- **Delivery** is out of scope: it needs the venue's own drivers or a third-party contract.
- Real authentication (no shared passcodes), backups, logging, a GDPR processing record and a reviewed privacy notice.

## Owner approval checklist

- [ ] Photo usage permission (and the Κατσούνα → Τσιμπολόι rebrand)
- [ ] Opening hours incl. closing times and days off
- [ ] Full menu incl. drinks, exact dish names, prices, allergens
- [ ] Instagram handle; any Facebook / Google Business profile to link
- [ ] Our-story text, live-music schedule, themed nights
- [ ] Which offer concepts to keep, their terms, and whether the 15% card stacks
- [ ] Party/inquiry policy (minimum size, deposits: none in this demo)
- [ ] Legal entity details for the privacy notice
- [ ] Domain, and go-live approval for indexing

## Blocking integrations before real use

DNS/domain · order database + server API · real staff authentication · notification channel (dashboard realtime / printer / SMS) · payment provider (only if online payment is wanted) · operations workflow (who confirms, how fast, cancellation rules) · delivery partner (if ever) · written photo authorization.


## Version 2 (redesign)

- Night / copper / neon editorial design, mobile first, scroll animations (reduced-motion respected). System fonts, nothing third-party loads.
- Menu page (read-only) with a QR panel: the QR carries the restaurant logo in the centre (error-correction level H, decoded by OpenCV in `tests/tools/qr-decode-check.py`). **Scan it with a real phone before printing.** Table QR: `/menu/?table=12` shows the table number only; no ordering.
- Order page: takeaway or delivery (delivery requires a full address), cash or card. **Card is a label only: no payment is taken** (DEMO).
- Admin (demo fixture logins on the page): orders board with takeaway/delivery filter, address and payment badges; menu tab to change price, set available / sold out / hidden and upload an image per dish; Instagram/poster image upload; takeaway/delivery switches; QR generator (SVG/PNG/print).
- Live & Events: the real 8 Nov flyer event (names as printed; NEEDS OWNER VERIFICATION), Instagram carousel (links out, no embeds), "Past events" from the second list of posts (assumption). Post dates are derived from the shortcodes and are approximate. A daily rebuild moves passed events to Past.
- Temporary imagery: posts without media show a designed "Photo coming soon" tile. No stock photos could be fetched from this environment.

### Still needed from the owner
Menu photos and the full drinks list, Instagram images/videos with captions and dates, confirmed opening hours, delivery area/fees/logistics, real payment provider.

## V3: admin and ordering flow

- **Incoming order popup.** A new order opens a dialog with the order, an approximate time (quick chips or any 1-240 minutes, chosen per order) and Accept / Reject (a reason is required). "Later" keeps the order waiting; a bar reopens it. The time is stored on the order (`etaMinutes`, `etaAt`), shown on the board, the slip and the customer's confirmation.
- **Sound.** A soft two-note chime plays when an order arrives and repeats every 10 seconds until all pending orders are answered. Browsers only allow sound after a click, so the login click enables it; after a page reload the first click re-enables it.
- **Archive.** Orders tab > Archive: completed, rejected and cancelled orders with search, details, receipt print / courier email / copy.
- **Customers.** "Save customer" on any order stores name, phone, delivery address and notes in the Customers tab (regular badge on their orders). Customers can also tick "Remember my details on this device" at checkout; that data stays in their own browser.
- **Checkout.** The order page keeps a small cart with a Checkout button (a floating button on phones). The details form opens as a dialog, so nobody scrolls to the bottom of the menu.
- **Courier email.** "Email to courier" opens the staff member's mail app with the order slip addressed to the courier email set in Settings. The demo sends nothing itself; production would send through an email service.
