#!/usr/bin/env python3
"""Build html/product/*.html + html/shop-all/index.html from data/*.json +
templates/*.html, and patch the two dynamic bands on html/index.html in
place. Stdlib only. Safe to run repeatedly (idempotent) and safe to run in
CI (GitHub Actions) right after the CMS commits data/products.json.

    python3 scripts/build.py
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
TEMPLATES = ROOT / "templates"
OUT = ROOT / "html"

WISH_SVG = """<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 00-7.8 7.8l1.1 1.1L12 21.2l7.8-7.8 1-1.1a5.5 5.5 0 000-7.7z" />
                </svg>"""

CART_SVG = """<svg class="icon-cart" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <path d="M3 4h2l2.4 12.4a2 2 0 002 1.6h8.4a2 2 0 002-1.6L21 8H6" />
                  <circle cx="9" cy="20" r="1.4" />
                  <circle cx="17" cy="20" r="1.4" />
                </svg>"""

PCARD_WISH_SVG = """<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                  </svg>"""


def load_json(name):
    return json.loads((DATA / name).read_text())


def badge_of(product):
    if product.get("is_bestseller"):
        return "Bestseller"
    if product.get("is_new"):
        return "New Product"
    return None


def data_categories(product):
    tags = [product["category"]]
    if product.get("is_bestseller"):
        tags.append("best-sellers")
    if product.get("is_new"):
        tags.append("new-product")
    return " ".join(tags)


def title_line(product):
    return f'{html.escape(product["sku"])} - {html.escape(product["name"])}'


def render_card(product, prefix, with_data_categories, wrapper_class="product-card"):
    badge = badge_of(product)
    badge_html = f'<span class="product-tile__badge">{badge}</span>' if badge else ""
    cats_attr = f' data-categories="{data_categories(product)}"' if with_data_categories else ""
    href = f'{prefix}product/{product["slug"]}.html'
    return f"""<div class="{wrapper_class}"{cats_attr}>
            <div class="product-tile__media">
              {badge_html}
              <a class="product-tile__link" href="{href}"><img
                  src="{prefix}images/{product['cover_image']}"
                  alt="{title_line(product)}"
                  loading="lazy"
              /></a>
              <button type="button" class="btn-wish" aria-label="Add to wishlist" title="Add to wishlist">
                {WISH_SVG}
              </button>
            </div>
            <a class="product-tile__link" href="{href}"><p>{title_line(product)}</p></a>
            <p class="product-tile__categories">{html.escape(product.get("tags_text", ""))}</p>
            <div class="product-actions">
              <a class="btn-contact" href="{prefix}contact-us/index.html">Contact</a>
              <button type="button" class="add-to-cart" aria-label="Add to cart" title="Add to cart">
                {CART_SVG}
              </button>
            </div>
          </div>"""


def render_pcard(product, prefix):
    badge = badge_of(product)
    badge_html = ""
    if badge == "Bestseller":
        badge_html = '<span class="pcard__badge">Bestseller</span>'
    elif badge == "New Product":
        badge_html = '<span class="pcard__badge p">New Product</span>'
    href = f'{prefix}product/{product["slug"]}.html'
    return f"""<div class="pcard">
                <div class="pcard__media">
                  <button class="pcard__wish" aria-label="Add to wishlist">
                    {PCARD_WISH_SVG}
                  </button>
                  <a href="{href}"><img
                      loading="lazy"
                      src="{prefix}images/{product['cover_image']}"
                      alt="{title_line(product)}"
                  /></a>
                  {badge_html}
                </div>
                <div class="pcard__info">
                  <p class="pcard__name">{title_line(product)}</p>
                  <p class="pcard__categories">{html.escape(product.get("tags_text", ""))}</p>
                  <div class="product-actions">
                    <a class="btn-contact" href="{prefix}contact-us/index.html">Contact</a>
                    <button type="button" class="add-to-cart" aria-label="Add to cart" title="Add to cart">
                      {CART_SVG}
                    </button>
                  </div>
                </div>
              </div>"""


def render_gallery_thumbs(product):
    thumbs = []
    for i, img in enumerate(product["gallery"]):
        active = " product-gallery__thumb--active" if i == 0 else ""
        lazy = ' loading="lazy"' if i > 0 else ""
        thumbs.append(
            f'<button class="product-gallery__thumb{active}">\n'
            f'            <img{lazy} src="../images/{img}" data-large="../images/{img}" '
            f'alt="{title_line(product)}, photo {i + 1}" />\n'
            f"          </button>"
        )
    return "\n          ".join(thumbs)


def render_product_page(product, all_products, template):
    others = [p for p in all_products if p["id"] != product["id"]][:8]
    related_html = "\n              ".join(render_pcard(p, "../") for p in others)
    badge = badge_of(product)
    badge_html = f'<span class="product-gallery__badge">{badge}</span>' if badge else ""

    page = template
    page = page.replace(
        "{{PAGE_TITLE}}",
        f'{html.escape(product["sku"])} &ndash; {html.escape(product["name"])} | Kyu Craft | Popup Card',
    )
    page = page.replace("{{BREADCRUMB_NAME}}", f'{html.escape(product["sku"])} &mdash; {html.escape(product["name"])}')
    page = page.replace("{{GALLERY_THUMBS}}", render_gallery_thumbs(product))
    page = page.replace("{{GALLERY_BADGE_HTML}}", badge_html)
    page = page.replace("{{GALLERY_MAIN_SRC}}", f"../images/{product['gallery'][0]}")
    page = page.replace("{{GALLERY_MAIN_ALT}}", title_line(product))
    page = page.replace("{{PRODUCT_TITLE}}", f'{html.escape(product["sku"])} &mdash; {html.escape(product["name"])}')
    page = page.replace("{{SKU}}", html.escape(product["sku"]))
    page = page.replace("{{TAGS_TEXT}}", html.escape(product.get("tags_text", "")))
    page = page.replace("{{PRODUCT_INFO_HTML}}", product["description_html"])
    page = page.replace("{{RELATED_PRODUCTS_CARDS}}", related_html)
    page = page.replace("{{STICKY_BAR_NAME}}", f'{html.escape(product["sku"])} &mdash; {html.escape(product["name"])}')
    return page


def build_product_pages(products, template):
    product_dir = OUT / "product"
    product_dir.mkdir(parents=True, exist_ok=True)
    valid_files = set()
    for product in products:
        if product.get("status") != "published":
            continue
        filename = f'{product["slug"]}.html'
        valid_files.add(filename)
        (product_dir / filename).write_text(render_product_page(product, products, template))

    # Orphan cleanup (gotcha #19): top-level scan only, no recursion.
    removed = []
    for f in product_dir.glob("*.html"):
        if f.name not in valid_files:
            f.unlink()
            removed.append(f.name)
    return valid_files, removed


def build_shop_all(products, categories, template):
    published = [p for p in products if p.get("status") == "published"]
    cards_html = "\n          ".join(render_card(p, "../", with_data_categories=True) for p in published)

    checkboxes = "\n            ".join(
        f'<label class="shop__category shop__category--child">\n'
        f'              <input type="checkbox" checked data-category="{c["key"]}" />\n'
        f'              <span>{html.escape(c["label"])}</span>\n'
        f"            </label>"
        for c in categories
    )

    page = template.replace("{{PRODUCT_CARDS}}", cards_html)
    page = page.replace("{{CATEGORY_CHECKBOXES}}", checkboxes)
    shop_all_dir = OUT / "shop-all"
    shop_all_dir.mkdir(parents=True, exist_ok=True)
    (shop_all_dir / "index.html").write_text(page)


def patch_band(text, marker, products, prefix, wrapper_class, with_data_categories, limit=8):
    start = f"<!-- {marker}:START -->"
    end = f"<!-- {marker}:END -->"
    pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.DOTALL)
    cards = "\n            ".join(
        render_card(p, prefix, with_data_categories=with_data_categories, wrapper_class=wrapper_class)
        for p in products[:limit]
    )
    replacement = f"{start}\n            {cards}\n            {end}"
    new_text, count = pattern.subn(replacement, text, count=1)
    if count != 1:
        raise SystemExit(f"homepage marker {marker} not found — did html/index.html's anchors move?")
    return new_text


def patch_homepage(products):
    index_path = OUT / "index.html"
    text = index_path.read_text()
    published = [p for p in products if p.get("status") == "published"]
    bestsellers = [p for p in published if p.get("is_bestseller")]
    new_products = [p for p in published if p.get("is_new")]
    text = patch_band(text, "BESTSELLERS", bestsellers, "", "bestsellers__item", with_data_categories=False)
    text = patch_band(text, "NEW_PRODUCTS", new_products, "", "product-card", with_data_categories=False)
    index_path.write_text(text)


def build_sitemap(products, base_url="https://khtcard.com"):
    published = [p for p in products if p.get("status") == "published"]
    static_pages = [
        "", "shop-all/", "custom-design/", "our-story/", "our-craft/",
        "wholesale-pop-up-cards/", "contact-us/", "free-template/",
    ]
    urls = [f"{base_url}/{p}" for p in static_pages]
    urls += [f'{base_url}/product/{p["slug"]}.html' for p in published]
    body = "\n".join(f"  <url><loc>{u}</loc></url>" for u in urls)
    xml = f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{body}\n</urlset>\n'
    (OUT / "sitemap.xml").write_text(xml)


def main():
    products = load_json("products.json")
    categories = load_json("categories.json")

    product_template = (TEMPLATES / "product.html").read_text()
    category_template = (TEMPLATES / "category.html").read_text()

    valid_files, removed = build_product_pages(products, product_template)
    build_shop_all(products, categories, category_template)
    patch_homepage(products)
    build_sitemap(products)

    print(f"Built {len(valid_files)} product pages, shop-all/index.html, sitemap.xml, patched index.html")
    if removed:
        print(f"Removed {len(removed)} orphaned product page(s): {', '.join(removed)}")


if __name__ == "__main__":
    main()
