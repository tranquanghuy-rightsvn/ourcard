# khtcard (Kyu Craft) — static site + CMS + CI/CD

Kyu Craft is a wholesale pop-up card catalog site. The product catalog, categories, free
downloadable templates, the Custom Design gallery, and the "Liên hệ" inbox (contact form +
footer newsletter box) are managed through a small free CMS (Google Apps Script + Sheets).
Everything else (homepage hero, About/Craft/Wholesale marketing pages) is hand-authored
static HTML.

Canonical domain: **https://www.kyucraft.com** (baked into `scripts/build.py`'s `BASE_URL`
and every hand-authored page's canonical/OG tags — update both places together if this ever
changes).

## URL structure

Every page is a flat `<slug>.html` at the site root — **no `index.html` in any path except
the homepage itself** (which has to be `index.html`/`/` per static-hosting convention, see
`html/_redirects`). Product pages are the one exception to "flat": they live under
`product/<slug>.html` (see "Repo layout" below for why).

## Architecture

```
CMS (Google Apps Script, gas/)
   │  edit products/categories/free templates/custom designs/site settings,
   │  read contact submissions; commits straight to GitHub via Contents API
   ▼
data/products.json, data/categories.json, data/free-templates.json,
data/custom-designs.json, data/site-settings.json                   ← source of truth
html/images/*, html/videos/*, html/downloads/*                      ← assets, written straight to the site
   │  push to the relevant *.json (the commit-closing file per entity)
   ▼
GitHub Actions (.github/workflows/build.yml)
   │  runs scripts/build.py
   ▼
html/product/<slug>.html, html/shop-all.html, html/free-template.html,
html/custom-design.html, html/js/search-data.js, sitemap.xml, html/ads.txt,
every hand-authored page's <!-- CMS_* --> bands (hero, head/analytics, logo, socials),
html/index.html (2 product bands), html/wholesale-pop-up-cards.html (sidebar bands)
worker/knowledge.generated.js                       ← the chat assistant's system prompt
   │  commit "CI: build html from data", push
   ▼
Cloudflare Worker (wrangler deploy)
   ├── static assets from html/
   └── /api/chat → Gemini (key = Worker secret, never in the repo)
```

No server runs 24/7, no paid database. See
`~/.claude/skills/free-cms-static-site-pipeline/references/` for the general playbook this
follows (architecture, gotchas, hosting quotas).

## Repo layout

- `data/products.json`, `data/categories.json`, `data/free-templates.json`,
  `data/custom-designs.json`, `data/site-settings.json` — CMS-owned. **Never hand-edit** —
  the CMS overwrites these on every save, and `scripts/build.py` reads them as input. All
  start empty/seeded-categories-only on purpose (see "Scope decisions").
  - `data/categories.json` carries an explicit `order` field per category. That order is the
    display order of the "Category" filter list on Shop All *and* the Categories list in the
    Wholesale sidebar; the owner changes it with the ↑ ↓ buttons in the CMS's "Danh mục" tab
    ("Lưu thứ tự" writes the whole list back in one commit). `build.py` sorts by `order` and
    falls back to the file's array order for records written before the field existed.
  - `data/site-settings.json` is the "website admin" file — see "Site settings" below.
- `templates/product.html`, `templates/category.html`, `templates/free-template.html`,
  `templates/custom-design.html` — the design source for generated pages (`{{PLACEHOLDER}}`
  string-replace, no templating engine). Edit these by hand to change the
  product/shop-all/free-template/custom-design page design; `scripts/build.py` reads them,
  doesn't own them.
- `scripts/build.py` — builds `html/product/*.html`, `html/shop-all.html`,
  `html/free-template.html`, `html/custom-design.html`, `html/js/search-data.js` and
  `sitemap.xml` from data + templates, and patches the two dynamic bands on `html/index.html`
  (`<!-- BESTSELLERS:START/END -->`, `<!-- NEW_PRODUCTS:START/END -->`) in place. Safe to run
  repeatedly (`python3 scripts/build.py`) — idempotent, and deletes orphaned product pages
  for slugs no longer in `data/products.json`.
- `scripts/import_legacy_products.py` — historical scrape utility, kept for reference only. It
  was used once to derive the category taxonomy (`data/categories.json`) from the original
  hardcoded shop-all page. Don't run it again (it would repopulate `products.json` with the
  old demo catalog).
- `html/` — the live site.
  - `html/product/<slug>.html` — build output. This is the **one** place that keeps a
    subfolder instead of a flat `<slug>.html`: `scripts/build.py` needs to safely delete
    orphaned pages when a product is removed via the CMS (gotcha #19 in the pipeline skill),
    and it can only do that blindly-and-safely because `product/` *only* ever contains
    CMS-generated files. If products lived flat at the root alongside hand-authored pages,
    the cleanup step could delete hand-written pages by mistake.
  - `html/shop-all.html`, `html/free-template.html`, `html/custom-design.html` — build output
    (flat, don't hand-edit).
  - `html/js/search-data.js` — build output (flat data file, not templated) — the header
    search overlay's product index, regenerated from `data/products.json` every build so it
    can never drift out of sync with the real catalog.
  - Everything else (`index.html` outside the two patched bands, `our-story.html`,
    `our-craft.html`, `wholesale-pop-up-cards.html`, `contact-us.html`, `cart.html`,
    `wishlist.html`, `404.html`, `admin.html`) is hand-authored, flat `<slug>.html` — these are
    bespoke one-off marketing/utility pages, not repeating list items, so they're intentionally
    **not** CMS-managed (see "Scope decisions" below).
- `worker/` — the Cloudflare Worker. `index.js` is hand-written (the `/api/chat` endpoint);
  `knowledge.generated.js` is build output — **never hand-edit it** (see "Chat" below).
- `gas/` — the CMS backend (Google Apps Script). **Gitignored** — deployed via `clasp`, not
  git. After changing any file here, run `clasp push` then in the Apps Script editor:
  Deploy → Manage deployments → Edit → **New version** (not "New deployment" — that mints a
  new `/exec` URL and leaves the old code live on the old URL).
- `original/` — a permanent, untouched backup of the site exactly as it was before the CMS
  pipeline (verified byte-for-byte identical to commit `e66fdf2`). Committed to git so the
  original hand-built code is never lost. Not read by anything — safe to ignore day-to-day.

## SEO: meta tags, Open Graph, canonical, JSON-LD

Every page (build-generated and hand-authored) carries: `<meta name="description">`, a full
`<link rel="canonical">` pointing at its real `https://www.kyucraft.com/...` URL, Open
Graph + Twitter Card tags (with a representative banner image per page — the product's own
cover photo for product pages), and JSON-LD structured data appropriate to the page type:

- Homepage: `Organization` + `WebSite`. The homepage's whole head block (title, description,
  canonical, OG/Twitter, both JSON-LD scripts) is generated from `data/site-settings.json`
  into `<!-- CMS_HOME_META -->` — the only page whose SEO tags are CMS-driven rather than
  hand-authored (see "Site settings").
- Product pages: `Product` (name/sku/image/brand/category) + `BreadcrumbList`, generated per
  product in `scripts/build.py` (`product_jsonld()`).
- Shop All / Free Template: `CollectionPage` + `BreadcrumbList`.
- The other marketing pages: `WebPage` (or `ContactPage`/`AboutPage` where it fits) +
  `BreadcrumbList`.
- `cart.html` / `wishlist.html`: `<meta name="robots" content="noindex, follow">` instead —
  they're per-visitor utility pages with no unique content, not real pages to index.

If you add a new hand-authored page, copy the head block from a similar existing page (don't
forget to update `canonical`/`og:url`/the breadcrumb's `name`) rather than skipping it — and
copy the `<!-- CMS_* -->` bands with it, plus add the filename to `CHROME_PAGES` in
`scripts/build.py`, so it picks up the shared favicon/analytics/logo/social settings.

## Site settings (`data/site-settings.json` + the CMS's "Cài đặt website" tab)

One CMS tab, one JSON file, one commit. It owns everything that is site-wide rather than
per-product:

| Setting | Where it lands |
| --- | --- |
| Hero banner: 3 slider slides + the 2 fixed cards beside them (image, headings, body, button label + link) | `<!-- CMS_HERO -->` on `html/index.html` |
| Site title, brand name, OG title, meta description, OG image | `<!-- CMS_HOME_META -->` on `html/index.html` (title/description/canonical/OG/Twitter + the `Organization`/`WebSite` JSON-LD) |
| Logo | `<!-- CMS_LOGO -->` (header) + `<!-- CMS_FOOTER_LOGO -->` on every page |
| Favicon, Google Analytics (GA4), extra `<head>` HTML (Search Console tag, ad pixels…) | `<!-- CMS_HEAD -->` on every page |
| Social links | `<!-- CMS_SOCIAL_FOOTER -->` (footer row) + `<!-- CMS_SOCIAL_FIXED -->` (the fixed rail on the right edge) on every page — **one URL drives both**, and clearing a URL removes that icon from both |
| `ads.txt` contents | written to `html/ads.txt` (removed entirely if the field is blank) |
| Organization phone/email/city/country | the homepage `Organization` JSON-LD only — SEO metadata, **not** the visible footer contact block, which stays hand-authored |

### How the bands work

Every page — hand-authored (`html/*.html`) and generated (`templates/*.html`) — carries
`<!-- CMS_NAME:START -->` / `<!-- CMS_NAME:END -->` comment pairs. `scripts/build.py`'s
`replace_band()` rewrites what is between them and re-indents to the START marker, the same
mechanism as the existing `<!-- BESTSELLERS -->` / `<!-- NEW_PRODUCTS -->` homepage bands.
Hand-authored pages are patched on disk (`patch_chrome_pages()`); templates are patched in
memory before the `{{PLACEHOLDER}}` pass, with `prefix="../"` for product pages. A missing
band is skipped silently (`404.html` has no footer, `admin.html` has only `CMS_HEAD`), so
adding a new page just means pasting whichever bands it needs.

**Anything inside a band is build output — editing it by hand is pointless**, it gets
overwritten on the next build. Change the renderer in `scripts/build.py` instead.

### Images

Hero/logo/favicon/OG uploads go to `html/images/` with a `site-<slot>-<n>.<ext>` name.
Photos (hero slides, OG image) are canvas-resized to 1600px JPEG client-side like product
images; **logo and favicon are uploaded byte-for-byte** — pushing them through the canvas
would flatten PNG transparency and break `.ico`/`.svg`. When a slot's image is replaced, the
old file is deleted only if its name starts with `site-`, so the site's original
hand-committed images (`card-banner-1.webp`, `logo-ngang.png`, …) can never be deleted by a
CMS save.

## Chat: AI assistant (Gemini via a Cloudflare Worker)

The chat bubble is answered by Gemini, not by a person and not by canned text.

```
html/js/chat.js (browser)
   │  POST /api/chat  {messages:[{role,text}]}      ← no key, no prompt, same origin
   ▼
worker/index.js (Cloudflare Worker)
   │  origin check → rate limit → size caps
   │  + worker/knowledge.generated.js (system prompt, built from the site)
   ▼
GAS doPost({action:"chat"})                         ← holds GEMINI_API_KEY, dumb relay
   ▼
Gemini generateContent
   │  reply
   ▼  (any failure ⇒ chat.js shows the real contact channels instead)
```

### Provider: Workers AI (default), with Gemini kept as a fallback

`CHAT_PROVIDER` in `wrangler.toml` picks one of three paths:

| value | path | measured |
| --- | --- | --- |
| `workers-ai` *(default)* | Worker → Workers AI, same network, no extra hop | **0.9–3.0s, 5/5 ok** |
| `gemini-relay` | Worker → Apps Script → Gemini | **3–19s, ~1 in 3 failing** |
| `gemini` | Worker → Gemini directly | blocked outside supported regions |

The Apps Script relay was built to dodge Gemini's geo block and it does, but it is not a
viable transport for interactive chat. Every piece measures fine alone — five rapid calls to
GAS with a bad token: 1.8–5.9s, all ok; five rapid calls to Gemini from a laptop: 1.0–1.2s,
all ok; `UrlFetchApp`→Gemini timed *inside the editor*: 1.1–1.8s, all ok. Only the composed
web-app path is slow, so the cost lives in Apps Script's web-app execution, which nothing in
this repo can tune. Keep `gemini-relay` as an escape hatch, not as the default.

**Model choice is a real trade-off.** `@cf/meta/llama-3.1-8b-instruct-fast` answers in ~1s
and holds the guardrails, but it does not use the grounding: asked the MOQ, it deflected to
the contact channels even though the numbers were in its prompt.
`@cf/meta/llama-3.3-70b-instruct-fp8-fast` answers correctly (50 per design, 500 total; USD
bank transfer / PayPal; worldwide shipping) in ~2.7–3.0s and still refuses to quote a price.
The 70B model is the default for that reason.

**Free-tier budget.** Workers AI includes 10,000 Neurons/day on the Workers Free plan, with
**no paid overage on Free — it simply stops**, and the widget then shows the contact block.
At ~2,500 prompt tokens and ~120 output tokens per turn:

| model | neurons/turn | turns/day |
| --- | --- | --- |
| llama-3.3-70b-fp8-fast | ~91 | **~109** |
| llama-3.1-8b-fast | ~14 | ~690 |

The system prompt is **73% of the 70B cost**, so trimming `html/wholesale-pop-up-cards.html`
(or the Q&A list) buys daily capacity directly. Multi-turn conversations also cost more: up
to 12 previous messages ride along on every request.

### Why the Gemini path detours through Apps Script

Gemini is **geo-restricted**, and a Worker runs in the colo nearest the visitor.
Vietnamese traffic lands in Hong Kong, which Google blocks — every direct call came back
`400 FAILED_PRECONDITION: User location is not supported`. Apps Script runs on Google's own
infrastructure and is not blocked, so the Worker asks GAS to make the call.

Smart Placement was tried first and **did not work**: 34 requests over 17 minutes all
reported `cf-placement: local-HKG`, because placement needs consistent traffic from multiple
locations and the site has none yet. The config is left in place (harmless, may help later)
but it is not the fix.

GAS is a **dumb pipe** — it knows nothing about the chat. The system prompt, origin check,
per-IP rate limit and history truncation all stay in the Worker, so changing what the
assistant knows is `python3 scripts/build.py && wrangler deploy`, with no clasp push.

`GEMINI_RELAY_URL` in `wrangler.toml` selects this path. **Delete that line and the Worker
goes straight to Google again** — do that only after enabling billing on the Gemini project,
since paying removes the geo restriction (and the free tier's training/privacy terms).

**Two hops, done manually.** `/exec` does not answer directly: it runs `doPost`, then 302s
to `script.googleusercontent.com/macros/echo`, which holds the result. The Worker follows
that redirect itself (`redirect: "manual"`, then an explicit **GET** — the echo URL rejects
POST with 405) so each leg gets its own timeout and failures say which leg broke.

**Cold start is the whole problem.** Gemini itself is steady at ~1.1–1.3s (measured
directly, and `maxOutputTokens` 400 vs 160 made no difference — replies run ~115 tokens).
The variance is Apps Script: a *warm* `/exec` answers in 1.6–3.5s, a cold one took 12–28s —
even on the path that only rejects a bad token, with no Gemini call and no Sheet write. In
the GAS editor you never see this, because there is no web-app cold start there.

**Do not retry this call.** An earlier version waited 12s then retried. That was wrong: a
slow GAS is still *running*, not dead, so the retry made Gemini answer the same question
twice, wrote the turn to `ChatLogs` twice and burned double the quota. Retries are only safe
for side-effect-free work, and this has side effects. There is now one attempt with a 25s
budget, and the fix for cold starts is warmth, not repetition:

- **Warm from the browser, not from a trigger.** `chat.js` POSTs `{warm:true}` the moment a
  visitor opens the chat panel; the Worker forwards `{action:"ping"}` to GAS and returns
  immediately (`ctx.waitUntil`). The visitor still has to type their question — several
  seconds — so the cold start overlaps that instead of making them wait for it.

  This deliberately replaces an earlier one-minute keep-warm trigger. **Apps Script's 90
  minutes/day of trigger runtime is an account-wide pool shared by every script that account
  owns**, so a per-minute trigger would have spent 24–48 of those minutes on this site's
  other projects' behalf — every day, visitors or not. Web-app executions do not count
  against that pool, and a browser ping only happens when someone actually intends to chat.

  The ping uses its own rate-limit key (`warm:<ip>`) so opening and closing the panel does
  not eat into the visitor's message allowance.
- The trigger that remains does **only** log flushing, every ten minutes (~2–3 minutes of
  quota per day). Install it once with `setupChatTrigger()` in the editor.

Free-tier Gemini rate limits are per-key and still apply — firing several requests within a
minute during testing produced `upstream_error`. GAS's 30-simultaneous-executions ceiling
also still applies. Both are fine at this site's volume; revisit if the chat gets busy.

### Why a Worker at all

**The API key must never reach the browser.** Anything shipped in `html/js/*` is readable
with View Source, and bots scan JS bundles for keys. So the Worker — which until now only
served `html/` — gained exactly one endpoint. `wrangler.toml` sets `main`, an `ASSETS`
binding, and `run_worker_first = ["/api/*"]`, so **every path except `/api/*` keeps the
old asset-first behavior** (`html_handling`/`not_found_handling` are unchanged).

### The system prompt is generated, not hand-written

`build_worker_knowledge()` in `scripts/build.py` writes `worker/knowledge.generated.js` on
every build from three live sources:

1. **`html/wholesale-pop-up-cards.html`'s body copy**, flattened to text — MOQ, payment
   terms, shipping, production time, packaging. Extracted rather than retyped so the bot
   can never contradict the page.
2. **`data/products.json`** — SKU, name, category, tags, product URL.
3. **`data/site-settings.json` → `chat`** — contact channels, reply language, and the
   owner's free-text `extra_notes` (CMS tab "Cài đặt website" → "Chat AI").

Edit the Wholesale page or add a product, and the assistant's knowledge follows on the next
build. **Never hand-edit `worker/knowledge.generated.js`** — it is overwritten every build.
It *is* committed (CI does `git add html/ worker/`) so `wrangler deploy` always ships a
prompt matching the deployed HTML.

### What the assistant knows, and who writes it

Three layers, in increasing priority:

1. **The site itself** — the Wholesale page's body copy and `data/products.json`, extracted
   by `build.py` so the bot can never contradict the page.
2. **`chat.extra_notes`** in site settings — free text for anything not on the site.
3. **`data/chat-qa.json`** — Q&A pairs written in the CMS tab **"Hỏi đáp AI"**, injected as
   *owner-approved answers, HIGHEST priority*. When a visitor's question matches one, the
   model answers from it instead of inferring from the page. They do **not** override the
   hard rules — an owner-written answer still cannot make the bot quote a price.

`draft` rows are skipped. All three are baked into the prompt at build time, so a Q&A edit
goes live the same way any content edit does (CMS → commit → CI → deploy, about a minute).
Nothing is read from a Sheet at chat time — that would add a round trip to every reply, and
latency is the scarce resource on this path. `build.py` prints a warning if the prompt grows
past 40 KB, since the whole thing is sent on every turn.

### Conversation log

Every exchange is appended to a **`ChatLogs`** sheet (`conversation_id, submitted_at, role,
message, page`) and read back grouped per conversation in the CMS tab **"Hội thoại AI"**.

`conversationId` is a random id `chat.js` keeps in `sessionStorage` — it survives navigation
between the site's static pages but does not follow a visitor across sessions. The Worker
truncates it (64 chars) and the page path (300) before passing them on; neither is trusted
and neither affects the reply.

Writes never happen on the visitor's path. Opening a Spreadsheet costs several hundred ms to
over a second, and that would land squarely in the window where someone is watching the
typing dots. `logChatTurn_()` pushes the turn into `CacheService` (a few ms) and the
one-minute trigger drains the queue into the sheet in one `setValues` call. The trade: if the
cache is evicted before the flush, those turns are lost — acceptable, since this is a log the
owner reads for reference, not an accounting record. The enqueue is still wrapped in
try/catch after the reply is computed: **a logging failure must never cost the visitor their
answer.**

Visitors are anonymous, so the log carries no identity — but people do type names, emails and
phone numbers into chat boxes, and that lands in this sheet. Treat it as customer data.

### Guardrails

The generated prompt hard-forbids the things that would hurt the business more than a
missing answer: quoting any price, inventing facts outside the reference sections,
promising delivery dates, accepting orders, or claiming to be a human. Anything it cannot
answer is routed to Zalo / email / the contact form. It is also told to ignore instructions
embedded in visitor messages (prompt injection).

The Worker adds the limits a public endpoint needs: same-origin check (`Origin` or
`Referer` must match), a rate-limit binding (10 requests / 60s per IP), message truncation
at 600 chars, history capped at 12 turns, `maxOutputTokens` 400, and a 20s timeout.
Upstream error text is never forwarded to the client — a Gemini error that echoes the key
must not reach the browser.

### Failure behaviour

Every failure path (no key configured, quota exhausted, rate limited, timeout, safety
block, network error) ends the same way: `chat.js` renders `chat.error_message` followed by
the real contact block, built from `chat.contact` so it can never drift from the footer.
A visitor is never left staring at a dead chat box.

### Setup

In Apps Script (Project Settings → Script Properties):

- `GEMINI_API_KEY` — the Gemini key. It lives **here**, not in Cloudflare, because GAS is
  what actually calls Google.
- `CHAT_RELAY_TOKEN` — run `generateChatRelayToken()` once in the editor; it generates the
  value, stores it, and logs it. The `/exec` URL is public (it is already in
  `html/js/lead-form.js`), so without this shared token anyone could drain the quota.

Then in Cloudflare:

```bash
npx wrangler secret put CHAT_RELAY_TOKEN   # paste the value logged above
npx wrangler deploy
```

`GEMINI_API_KEY` as a Worker secret is only needed on the direct path (post-billing). `.key` in the repo root is a local scratch copy and is
gitignored — keep it that way. Change the model in `wrangler.toml`'s `[vars] GEMINI_MODEL`
(no code edit needed). Without the secret set, `/api/chat` returns `503 not_configured` and
the widget degrades to the contact block, so deploying before setting the key is safe.

### Privacy — decide before pointing real customers at it

On the Gemini **free tier**, Google may use submitted content to improve its products and
human reviewers may read it; the paid tier excludes training. Visitors will paste names,
emails and order quantities into this box. Either move to the paid tier or keep a visible
notice — `chat.privacy_note` exists in `data/site-settings.json` for that purpose. Free-tier
rate limits are no longer published in the docs; check your own at
<https://aistudio.google.com/rate-limit>.

## Wholesale sidebar

`html/wholesale-pop-up-cards.html`'s sidebar is generated, not hand-maintained:

- **Products** — 5 of the published bestsellers, shuffled with a seed derived from the
  bestseller slugs themselves (`bestseller_sample()`). Deliberately *not* time-random: the
  order must be stable across CI runs (otherwise every unrelated build would rewrite the page)
  but has to reshuffle the moment the owner marks another product as Bestseller in the CMS.
  Fewer than 5 bestsellers → it shows what exists; none → the list renders empty.
- **Categories** — `data/categories.json` in its CMS order, prefixed with the two virtual
  ones (Best Seller, New Product), so it can never drift from the Shop All sidebar.

## Scope decisions (read before extending)

- **Products, categories, free templates, custom design gallery, contacts and the site-wide
  settings (hero banner, title/description, logo, favicon, analytics, social links) are
  CMS-managed.** The *body copy* of the marketing pages stays hand-authored: those pages change
  rarely and have bespoke layouts — forcing them through a generic rich-text CMS field would
  flatten the design for content that's edited by hand a few times a year at most. Only their
  shared chrome (head, logo, socials) is CMS-driven, through the `<!-- CMS_* -->` bands.
- **Products optionally support video** (`videos: []`, alongside `gallery: []`) — no canvas
  resize (can't resize video with a `<canvas>`), uploaded as-is to `html/videos/`. If a
  product has at least one video, its thumb is shown first and active by default in the
  gallery (matches the original hand-built demo page's behavior); `html/js/product-detail.js`
  swaps the `<video>`'s `<source>` (and calls `.load()`) when a different video thumb is
  clicked, so more than one video per product actually works, not just the first.
- **Custom Design** (`data/custom-designs.json`): each entry is `{slug, title, cover_image,
  status}` — its own CMS tab, deliberately unrelated to Products or Free Template (own data
  file, own template, own GAS functions) even though the card markup looks similar. Replaces
  what used to be a copy-pasted, broken Shop All layout on `custom-design.html`.
- **No prices are shown anywhere** (wholesale catalog — every product has a "Contact" CTA
  instead) — this matches the original design, so `data/products.json` doesn't have a price
  field.
- **The chat widget is an AI assistant, not a human inbox and not canned text.** It cannot
  quote prices or accept orders by design (see "Chat" above) — its job is to answer factual
  questions from the site's own content and hand everything else to a real channel.
- **Cart / wishlist / checkout are unchanged** — pure client-side (localStorage), and the
  checkout modal is explicitly a demo (no payment is taken, see `html/js/checkout.js`). They
  read product info straight from the DOM (`.product-card`, `img[src]`, etc.), so
  `scripts/build.py` just has to keep emitting the same markup/classes — no JS changes needed.
- **Contact/newsletter forms submit to the CMS's public `doPost` endpoint**, land in a
  `Contacts` Google Sheet, and are **not** relayed anywhere else yet (no Telegram/email
  notification — the owner checks the "Liên hệ" tab in the CMS). Trivial to add a Telegram
  bot notification later if needed.
- **Free Template** (`data/free-templates.json`): each entry is `{slug, title, cover_image,
  file, status}` — a preview image (compressed client-side like product images) plus one
  arbitrary downloadable file (PDF/SVG/ZIP/AI — anything, no canvas resize, pushed to
  `html/downloads/<slug>.<ext>` as-is). No categories/tags — kept deliberately simple.
- **2-tier roles**: `root` (the script owner, implicit, never in the Sheet) and `editor`
  (added via the CMS's "Quản lý người dùng" tab, root-only).

## One-time setup checklist

1. **Google Apps Script**
   - `cd gas && clasp create --type webapp --title "Kyu Craft CMS"` (or `clasp clone` if a
     script already exists), then `clasp push`.
   - Deploy → New deployment → Web app → Execute as **Me**, access **Anyone** → copy the
     `/exec` URL.
   - Project Settings → Script Properties, fill in: `GITHUB_TOKEN` (a GitHub PAT with repo
     write access), `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH` (e.g. `master`).
     `SPREADSHEET_ID` is created automatically on first use — leave it blank.
   - Open the web app URL once as the script owner and log in (OTP goes to your own email —
     the owner is always root, no Sheet row needed).
2. **Point the site's forms at the CMS**: paste the `/exec` URL into `ENDPOINT` at the top of
   `html/js/lead-form.js`, and into the redirect target in `html/admin.html` (see below), then
   commit. *(Already done — both currently point at the live `/exec` URL. If you ever deploy a
   brand new GAS project instead of pushing a new version to the existing one, you'll get a
   new `/exec` URL and need to update both places again.)*
3. **GitHub Actions**: repo Settings → Secrets and variables → Actions, add
   `CLOUDFLARE_API_TOKEN` (Account → Workers Scripts → Edit permission) and
   `CLOUDFLARE_ACCOUNT_ID`.
3b. **Gemini key for the chat widget**: run `npx wrangler secret put GEMINI_API_KEY` once,
   locally. It is a Worker secret, *not* a GitHub secret — CI never needs it. Until it is
   set, the chat widget degrades to the contact block instead of breaking.
4. **Cloudflare**: create the Worker (`wrangler deploy` once locally, or let the first CI run
   create it), then Workers & Pages → the Worker → Domains & Routes → Add Custom Domain to
   point `www.kyucraft.com` at it. Adding the domain to Cloudflare + switching nameservers is
   a separate step from deploying the Worker — see the pipeline skill's hosting notes if the
   domain still resolves to the old host afterwards.

## Admin login page

`html/admin.html` is a plain static redirect to the GAS web app's `/exec` URL (meta-refresh +
`location.replace()` + a fallback link, for browsers that block one or the other). It's a
**hand-authored static file, not part of the build/CI pipeline** — `scripts/build.py` never
touches it, same treatment as `404.html` (see the pipeline skill's `static-site-build.md` §10:
content that only changes through a rare, deliberate manual edit doesn't belong in the
generator). Not linked from any nav — reach it by typing `/admin.html` directly.

Blocked from search engines with two layers (per the skill's default): `<meta name="robots"
content="noindex, nofollow, noarchive, nosnippet">` on the page itself, **and**
`Disallow: /admin.html` in `html/robots.txt`. `robots.txt` is likewise a static file, not
generated by `build.py`.

If you ever redeploy GAS to a genuinely new project (not just a new version of the existing
one), update the redirect URL in **both** `html/admin.html` (two occurrences: the
`meta http-equiv="refresh"` and the `location.replace(...)` call) and `html/js/lead-form.js`'s
`ENDPOINT`.

## Day-to-day

- Editing a product/category/free-template/custom-design/site setting in the CMS commits the
  relevant `data/*.json` straight to GitHub → triggers the Actions workflow (watches all five
  files plus `templates/**` and `scripts/build.py`, see `.github/workflows/build.yml`) →
  rebuilds `html/` → deploys to Cloudflare. Allow **about a minute** for the live site to
  catch up after saving.
- To change the homepage/marketing page copy: edit the relevant `html/<slug>.html` file by
  hand and commit — these aren't touched by `scripts/build.py` **except inside a
  `<!-- CMS_*:START -->…<!-- CMS_*:END -->` band**, which is regenerated on every build. Edit
  what a band contains in `scripts/build.py`'s renderers, not in the page.
- To change the product/shop-all/free-template/custom-design page design: edit
  `templates/product.html` / `templates/category.html` / `templates/free-template.html` /
  `templates/custom-design.html`, then run `python3 scripts/build.py` locally to verify,
  commit.
- New hand-authored page: keep it flat (`<slug>.html` at the root, no subfolder, no
  `index.html`) and give it the full SEO head block (see "SEO" above).
