# khtcard (Kyu Craft) — static site + CMS + CI/CD

Kyu Craft is a wholesale pop-up card catalog site. The product catalog, categories, and the
"Liên hệ" inbox (contact form + footer newsletter box) are managed through a small free CMS
(Google Apps Script + Sheets). Everything else (homepage hero, About/Craft/Custom
Design/Wholesale marketing pages) is hand-authored static HTML.

## Architecture

```
CMS (Google Apps Script, gas/)
   │  edit products/categories, read contact submissions
   │  commits straight to GitHub via Contents API
   ▼
data/products.json, data/categories.json   ← source of truth for the catalog
html/images/*                              ← product photos, written straight to the site
   │  push to data/products.json or data/categories.json (the commit-closing file)
   ▼
GitHub Actions (.github/workflows/build.yml)
   │  runs scripts/build.py
   ▼
html/product/<slug>.html, html/shop-all/index.html, html/index.html (2 patched bands)
   │  commit "CI: build html from data", push
   ▼
Cloudflare Workers Static Assets (wrangler deploy)
```

No server runs 24/7, no paid database. See
`~/.claude/skills/free-cms-static-site-pipeline/references/` for the general playbook this
follows (architecture, gotchas, hosting quotas).

## Repo layout

- `data/products.json`, `data/categories.json` — CMS-owned. **Never hand-edit** — the CMS
  overwrites these on every save, and `scripts/build.py` reads them as input.
- `templates/product.html`, `templates/category.html` — the design source for generated
  pages (`{{PLACEHOLDER}}` string-replace, no templating engine). Edit these by hand to
  change the product/shop-all page design; `scripts/build.py` reads them, doesn't own them.
- `scripts/build.py` — builds `html/product/*.html` + `html/shop-all/index.html` from
  data + templates, and patches the two dynamic bands on `html/index.html`
  (`<!-- BESTSELLERS:START/END -->`, `<!-- NEW_PRODUCTS:START/END -->`) in place. Safe to run
  repeatedly (`python3 scripts/build.py`) — idempotent, and deletes orphaned product pages
  for slugs no longer in `data/products.json`.
- `scripts/import_legacy_products.py` — historical scrape utility, kept for reference only.
  It was used once to derive the category taxonomy (`data/categories.json`) from the original
  hardcoded shop-all page. **`data/products.json` starts empty (`[]`) on purpose** — the
  owner adds every product from scratch through the CMS; nothing is pre-seeded. Don't run
  this script again (it would repopulate products.json with the old demo catalog).
- `html/` — the live site. `html/product/*` and `html/shop-all/index.html` are build output
  (don't hand-edit, CI overwrites them). Everything else (`index.html` outside the two
  patched bands, `our-story/`, `our-craft/`, `custom-design/`, `wholesale-pop-up-cards/`,
  `contact-us/`, `free-template/`, `cart/`, `wishlist/`) is hand-authored — these are bespoke
  one-off marketing pages, not repeating list items, so they're intentionally **not**
  CMS-managed (see "Scope decisions" below).
- `gas/` — the CMS backend (Google Apps Script). **Gitignored** — deployed via `clasp`, not
  git. After changing any file here, run `clasp push` then in the Apps Script editor:
  Deploy → Manage deployments → Edit → **New version** (not "New deployment" — that mints a
  new `/exec` URL and leaves the old code live on the old URL).
- `original/` — a permanent, untouched backup of the site exactly as it was before the CMS
  pipeline (verified byte-for-byte identical to commit `e66fdf2`). Committed to git so the
  original hand-built code is never lost. Not read by anything — safe to ignore day-to-day.

## Scope decisions (read before extending)

- **Only products/categories/contacts are CMS-managed.** The marketing pages listed above
  change rarely and have bespoke layouts — forcing them through a generic rich-text CMS field
  would flatten the design for content that's edited by hand a few times a year at most.
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
   `html/js/lead-form.js` (`PASTE_GAS_EXEC_URL_HERE`), then commit.
3. **GitHub Actions**: repo Settings → Secrets and variables → Actions, add
   `CLOUDFLARE_API_TOKEN` (Account → Workers Scripts → Edit permission) and
   `CLOUDFLARE_ACCOUNT_ID`.
4. **Cloudflare**: create the Worker (`wrangler deploy` once locally, or let the first CI run
   create it), then Workers & Pages → the Worker → Domains & Routes → Add Custom Domain to
   point your real domain at it. Adding the domain to Cloudflare + switching nameservers is a
   separate step from deploying the Worker — see the pipeline skill's hosting notes if the
   domain still resolves to the old host afterwards.
## Day-to-day

- Editing a product/category in the CMS commits `data/products.json` (and `data/categories.json`
  for categories) straight to GitHub → triggers the Actions workflow → rebuilds `html/` →
  deploys to Cloudflare. Allow **about a minute** for the live site to catch up after saving.
- To change the homepage/marketing page copy: edit the relevant `html/*/index.html` file by
  hand and commit — these aren't touched by `scripts/build.py` except for the two anchored
  bestseller/new-product bands on `html/index.html`.
- To change the product/shop-all page design: edit `templates/product.html` /
  `templates/category.html`, then run `python3 scripts/build.py` locally to verify, commit.
