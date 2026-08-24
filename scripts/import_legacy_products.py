#!/usr/bin/env python3
"""One-time import: scrape the ~20 hardcoded product cards in
original/shop-all/index.html into data/products.json + data/categories.json.

Run once, by hand, from the repo root:
    python3 scripts/import_legacy_products.py

After this, products.json/categories.json are the source of truth (edited via
the GAS CMS or by hand) — do not re-run this script against a live catalog,
it will stomp on real edits.
"""
import datetime
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHOP_ALL_SRC = ROOT / "original" / "shop-all" / "index.html"
PRODUCT_DETAIL_SRC = ROOT / "original" / "product" / "index.html"
PRODUCTS_OUT = ROOT / "data" / "products.json"
CATEGORIES_OUT = ROOT / "data" / "categories.json"

CATEGORY_LABELS = {
    "christmas": "Christmas",
    "birthday": "Birthday",
    "anniversary": "Anniversary",
    "other": "Other",
    "seasonal": "Seasonal",
    "vehicle-sports": "Vehicle & Sports",
    "love-floral": "Love & Floral",
    "animals": "Animals",
}
SPECIAL_TAGS = {"best-sellers", "new-product"}

CARD_RE = re.compile(
    r'<div\s+class="product-card"\s+data-categories="(?P<categories>[^"]*)"\s*>'
    r'(?P<body>.*?)\s*</div>\s*</div>\n',
    re.DOTALL,
)
IMG_RE = re.compile(r'<img\s+src="\.\./images/([^"]+)"\s+alt="([^"]+)"')
BADGE_RE = re.compile(r'<span class="product-tile__badge">([^<]+)</span>')
NAME_RE = re.compile(r'<p>([^<]+)</p>')
TAGS_TEXT_RE = re.compile(r'<p class="product-tile__categories">\s*([^<]+?)\s*</p>')


def slugify(text):
    text = text.lower().replace("'", "")
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def split_sku_name(raw_name):
    # "PC1052 - Summer Holiday Beach Popup Card" -> ("PC1052", "Summer Holiday Beach Popup Card")
    parts = raw_name.split(" - ", 1)
    if len(parts) == 2:
        return parts[0].strip(), parts[1].strip()
    return "", raw_name.strip()


def extract_pc1052_description():
    """PC1052 is the one product with real hand-written copy (the old demo
    detail page) — reuse it verbatim instead of the generic placeholder."""
    if not PRODUCT_DETAIL_SRC.exists():
        return None
    html = PRODUCT_DETAIL_SRC.read_text()
    m = re.search(
        r'<h2 class="product-information__title">Information</h2>\s*(.*?)\s*<button class="product-info__share"',
        html,
        re.DOTALL,
    )
    return m.group(1).strip() if m else None


def generic_description(name):
    return (
        f"<p>{name} pop-up card, laser-cut and hand-assembled in our workshop. "
        "Every layer folds flat for shipping and pops back into shape the moment "
        "the card is opened.</p>\n"
        "<p>Mix into any wholesale order — the 50 pcs minimum applies per design, "
        "not per shipment. Own artwork, logo and private-label packaging available "
        "on request.</p>"
    )


def main():
    html = SHOP_ALL_SRC.read_text()
    products = []
    today = datetime.date.today().isoformat()
    pc1052_desc = extract_pc1052_description()

    for idx, m in enumerate(CARD_RE.finditer(html), start=1):
        categories = m.group("categories").split()
        body = m.group("body")

        img_m = IMG_RE.search(body)
        if not img_m:
            raise SystemExit(f"card #{idx}: no <img> found, adjust the regex")
        cover_image, alt_text = img_m.group(1), img_m.group(2)

        badge_m = BADGE_RE.search(body)
        badge = badge_m.group(1).strip() if badge_m else ""

        name_m = NAME_RE.search(body)
        raw_name = name_m.group(1).strip() if name_m else alt_text
        sku, name = split_sku_name(raw_name)

        tags_m = TAGS_TEXT_RE.search(body)
        tags_text = tags_m.group(1).strip() if tags_m else ""

        main_category = next((c for c in categories if c not in SPECIAL_TAGS), "other")

        slug = slugify(raw_name)
        is_bestseller = "best-sellers" in categories or badge == "Bestseller"
        is_new = "new-product" in categories or badge == "New Product"

        description_html = (
            pc1052_desc if (sku == "PC1052" and pc1052_desc) else generic_description(name)
        )

        products.append(
            {
                "id": idx,
                "slug": slug,
                "sku": sku,
                "name": name,
                "category": main_category,
                "tags_text": tags_text,
                "is_bestseller": is_bestseller,
                "is_new": is_new,
                "cover_image": cover_image,
                "gallery": [cover_image],
                "description_html": description_html,
                "status": "published",
                "updated_at": today,
            }
        )

    if len(products) != 20:
        print(f"WARNING: expected 20 products, scraped {len(products)} — check the source page")

    # Keep the full sidebar taxonomy (not just categories some product already
    # uses) — Christmas/Animals have 0 products today but are still valid
    # categories the owner can assign new products to via the CMS.
    categories = [{"key": key, "label": label} for key, label in CATEGORY_LABELS.items()]

    PRODUCTS_OUT.parent.mkdir(parents=True, exist_ok=True)
    PRODUCTS_OUT.write_text(json.dumps(products, ensure_ascii=False, indent=2) + "\n")
    CATEGORIES_OUT.write_text(json.dumps(categories, ensure_ascii=False, indent=2) + "\n")
    print(f"Wrote {len(products)} products -> {PRODUCTS_OUT}")
    print(f"Wrote {len(categories)} categories -> {CATEGORIES_OUT}")


if __name__ == "__main__":
    main()
