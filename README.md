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
   │  edit products/categories/free templates/custom designs, read contact submissions
   │  commits straight to GitHub via Contents API
   ▼
data/products.json, data/categories.json, data/free-templates.json,
data/custom-designs.json                                            ← source of truth
html/images/*, html/videos/*, html/downloads/*                      ← assets, written straight to the site
   │  push to the relevant *.json (the commit-closing file per entity)
   ▼
GitHub Actions (.github/workflows/build.yml)
   │  runs scripts/build.py
   ▼
html/product/<slug>.html, html/shop-all.html, html/free-template.html,
html/custom-design.html, html/js/search-data.js, sitemap.xml,
html/index.html (2 patched bands)
   │  commit "CI: build html from data", push
   ▼
Cloudflare Workers Static Assets (wrangler deploy)
```

No server runs 24/7, no paid database. See
`~/.claude/skills/free-cms-static-site-pipeline/references/` for the general playbook this
follows (architecture, gotchas, hosting quotas).

## Repo layout

- `data/products.json`, `data/categories.json`, `data/free-templates.json`,
  `data/custom-designs.json` — CMS-owned. **Never hand-edit** — the CMS overwrites these on
  every save, and `scripts/build.py` reads them as input. All start empty/seeded-categories-only
  on purpose (see "Scope decisions").
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

- Homepage: `Organization` + `WebSite`.
- Product pages: `Product` (name/sku/image/brand/category) + `BreadcrumbList`, generated per
  product in `scripts/build.py` (`product_jsonld()`).
- Shop All / Free Template: `CollectionPage` + `BreadcrumbList`.
- The other marketing pages: `WebPage` (or `ContactPage`/`AboutPage` where it fits) +
  `BreadcrumbList`.
- `cart.html` / `wishlist.html`: `<meta name="robots" content="noindex, follow">` instead —
  they're per-visitor utility pages with no unique content, not real pages to index.

If you add a new hand-authored page, copy the head block from a similar existing page (don't
forget to update `canonical`/`og:url`/the breadcrumb's `name`) rather than skipping it.

## Scope decisions (read before extending)

- **Products, categories, free templates, custom design gallery, and contacts are
  CMS-managed.** The marketing pages listed above change rarely and have bespoke layouts —
  forcing them through a generic rich-text CMS field would flatten the design for content
  that's edited by hand a few times a year at most.
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

- Editing a product/category/free-template/custom-design in the CMS commits the relevant
  `data/*.json` straight to GitHub → triggers the Actions workflow (watches all four files,
  see `.github/workflows/build.yml`) → rebuilds `html/` → deploys to Cloudflare. Allow **about
  a minute** for the live site to catch up after saving.
- To change the homepage/marketing page copy: edit the relevant `html/<slug>.html` file by
  hand and commit — these aren't touched by `scripts/build.py` except for the two anchored
  bestseller/new-product bands on `html/index.html`.
- To change the product/shop-all/free-template/custom-design page design: edit
  `templates/product.html` / `templates/category.html` / `templates/free-template.html` /
  `templates/custom-design.html`, then run `python3 scripts/build.py` locally to verify,
  commit.
- New hand-authored page: keep it flat (`<slug>.html` at the root, no subfolder, no
  `index.html`) and give it the full SEO head block (see "SEO" above).
