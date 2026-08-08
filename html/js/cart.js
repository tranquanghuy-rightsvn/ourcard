/* Client-side cart, ported from the Velora template: no backend, persisted in
   localStorage. KHT quotes per order rather than listing prices, so the cart
   totals quantities and ends in a quote request instead of a checkout. */
(function () {
  var STORAGE_KEY = 'kht_cart';

  function getCart() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveCart(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  /* Product names wrap with <br>, which textContent would glue together
     ("HolidayBeach"), so turn the break back into a space first. */
  function readName(el) {
    if (!el) return '';
    return el.innerHTML
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function slugify(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function totalQty() {
    return getCart().reduce(function (sum, it) { return sum + it.qty; }, 0);
  }

  function totalPrice() {
    return getCart().reduce(function (sum, it) { return sum + (it.price || 0) * it.qty; }, 0);
  }

  function formatVnd(value) {
    return value.toLocaleString('vi-VN') + '₫';
  }

  function updateBadges() {
    var count = totalQty();
    document.querySelectorAll('.cart-link__badge').forEach(function (el) {
      el.textContent = count;
      el.hidden = count === 0;
    });
  }

  function showToast(message) {
    var toast = document.getElementById('cartToast');
    if (!toast) {
      var style = document.createElement('style');
      style.textContent =
        '#cartToast{position:fixed;top:20px;right:20px;z-index:9999;display:flex;align-items:center;gap:8px;' +
        'background:#2f2f2e;color:#fff;font-size:13.5px;font-weight:500;padding:14px 20px;border-radius:4px;' +
        'box-shadow:0 4px 16px rgba(0,0,0,0.18);opacity:0;transform:translateY(-20px);pointer-events:none;}' +
        '#cartToast.is-visible{animation:cartToastPulse 2s ease forwards;}' +
        '#cartToast svg{flex-shrink:0;color:#fff;}' +
        '@keyframes cartToastPulse{' +
          '0%{opacity:0;transform:translateY(-20px);}' +
          '10%{opacity:1;transform:translateY(0);}' +
          '88%{opacity:1;transform:translateY(0);}' +
          '100%{opacity:0;transform:translateY(-10px);}}';
      document.head.appendChild(style);
      toast = document.createElement('div');
      toast.id = 'cartToast';
      toast.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' +
        '<span class="cart-toast__text"></span>';
      document.body.appendChild(toast);
    }
    toast.querySelector('.cart-toast__text').textContent = message;
    // Restart the animation even if it's already mid-flight (rapid repeat clicks).
    toast.classList.remove('is-visible');
    void toast.offsetWidth;
    toast.classList.add('is-visible');
  }

  function addItem(id, meta, qty) {
    var items = getCart();
    var existing = items.find(function (it) { return it.id === id; });
    if (existing) {
      existing.qty += qty || 1;
    } else {
      items.push(Object.assign({ id: id, qty: qty || 1 }, meta));
    }
    saveCart(items);
    updateBadges();
  }

  function setQty(id, qty) {
    var items = getCart();
    var idx = items.findIndex(function (it) { return it.id === id; });
    if (idx === -1) return;
    if (qty <= 0) {
      items.splice(idx, 1);
    } else {
      items[idx].qty = qty;
    }
    saveCart(items);
    updateBadges();
    renderCartPage();
  }

  /* Paths are stored relative to the site root, so an entry saved on a nested
     page still resolves from any other page. The logo always points at the
     site root, which is how each page works out where it sits. */
  function rootPrefix() {
    var logo = document.querySelector('.logo');
    var href = logo ? logo.getAttribute('href') : '';
    return href.replace(/index\.html$/, '');
  }

  function toRootRelative(url) {
    if (!url) return '';
    try {
      var rootPath = new URL(rootPrefix() || '.', location.href).pathname;
      var full = new URL(url, location.href).pathname;
      return full.indexOf(rootPath) === 0 ? full.slice(rootPath.length) : full;
    } catch (e) {
      return url;
    }
  }

  function fromRootRelative(url) {
    return url ? rootPrefix() + url : '';
  }

  /* Read the product a button belongs to. KHT tiles carry no data attributes,
     so the details come from the markup around the button. */
  function readPrice(el) {
    return el ? parseInt(el.getAttribute('data-price'), 10) || 0 : 0;
  }

  function readProduct(btn) {
    var card = btn.closest('.bestsellers__item, .product-card, .pcard');
    if (card) {
      var nameEl = card.querySelector('.pcard__name, p');
      var img = card.querySelector('img');
      var link = card.tagName === 'A' ? card : card.querySelector('a[href]');
      var name = readName(nameEl);
      return {
        id: slugify(name),
        name: name,
        price: readPrice(card.querySelector('.product-price, .pcard__price')),
        image: toRootRelative(img && img.getAttribute('src')),
        link: toRootRelative(link && link.getAttribute('href'))
      };
    }
    // Product detail page: the main CTA and the sticky bar.
    var title = document.querySelector('.product-info__title');
    var main = document.getElementById('productMainImg');
    if (!title) return null;
    var text = readName(title);
    return {
      id: slugify(text),
      name: text,
      price: readPrice(document.querySelector('.product-info__price')),
      image: toRootRelative(main && main.getAttribute('src')),
      link: toRootRelative(location.pathname)
    };
  }

  function flashAdded(btn) {
    var label = btn.querySelector('.product-info__add-to-cart-label');
    if (!label) return;
    var original = label.getAttribute('data-original-label') || label.textContent;
    label.setAttribute('data-original-label', original);
    btn.classList.add('is-added');
    label.textContent = 'Added ✓';
    clearTimeout(btn._cartFlashTimer);
    btn._cartFlashTimer = setTimeout(function () {
      btn.classList.remove('is-added');
      label.textContent = original;
    }, 1200);
  }

  function initAddButtons() {
    var selector = '.add-to-cart, .pcard__cta, .product-info__add-to-cart, .sticky-buy-bar__cta';
    document.querySelectorAll(selector).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation(); // the tiles are wrapped in a link to the product page
        var product = readProduct(btn);
        if (!product || !product.id) return;
        addItem(product.id, product, 1);
        showToast('Added to cart');
        if (btn.classList.contains('product-info__add-to-cart')) flashAdded(btn);
      });
    });
  }

  function renderCartPage() {
    var container = document.getElementById('cartItems');
    var summary = document.getElementById('cartSummary');
    var emptyState = document.querySelector('.cart-empty-state');
    if (!container) return;

    var items = getCart();
    if (!items.length) {
      container.style.display = 'none';
      if (summary) summary.style.display = 'none';
      if (emptyState) emptyState.style.display = '';
      return;
    }
    if (emptyState) emptyState.style.display = 'none';
    container.style.display = '';
    if (summary) summary.style.display = '';

    container.innerHTML = items.map(function (it) {
      var link = fromRootRelative(it.link) || '#';
      return (
        '<div class="cart-item" data-id="' + it.id + '">' +
          '<a href="' + link + '" class="cart-item__media"><img src="' + fromRootRelative(it.image) + '" alt="' + it.name + '"></a>' +
          '<div class="cart-item__info">' +
            '<a href="' + link + '" class="cart-item__name">' + it.name + '</a>' +
            '<div class="cart-item__qty">' +
              '<button type="button" class="cart-item__qty-btn" data-action="dec" aria-label="Decrease quantity">&minus;</button>' +
              '<span class="cart-item__qty-value">' + it.qty + '</span>' +
              '<button type="button" class="cart-item__qty-btn" data-action="inc" aria-label="Increase quantity">+</button>' +
            '</div>' +
          '</div>' +
          '<div class="cart-item__price">' + formatVnd(it.price * it.qty) +
            '<span>' + formatVnd(it.price) + ' each</span></div>' +
          '<button type="button" class="cart-item__remove" aria-label="Remove">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
            '<path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>' +
          '</button>' +
        '</div>'
      );
    }).join('');

    if (summary) {
      var designs = summary.querySelector('.cart-summary__designs');
      var total = summary.querySelector('.cart-summary__total-value');
      if (designs) {
        designs.textContent = '(' + items.length + (items.length === 1 ? ' design, ' : ' designs, ') +
          totalQty() + (totalQty() === 1 ? ' item)' : ' items)');
      }
      if (total) total.textContent = formatVnd(totalPrice());
    }

    container.querySelectorAll('.cart-item').forEach(function (row) {
      var id = row.getAttribute('data-id');
      row.querySelector('[data-action="dec"]').addEventListener('click', function () {
        var it = getCart().find(function (x) { return x.id === id; });
        if (it) setQty(id, it.qty - 1);
      });
      row.querySelector('[data-action="inc"]').addEventListener('click', function () {
        var it = getCart().find(function (x) { return x.id === id; });
        if (it) setQty(id, it.qty + 1);
      });
      row.querySelector('.cart-item__remove').addEventListener('click', function () {
        setQty(id, 0);
      });
    });
  }

  /* Shared with wishlist.js so both features read a tile the same way. */
  window.khtProduct = {
    read: readProduct,
    toRoot: toRootRelative,
    fromRoot: fromRootRelative,
    format: formatVnd
  };
  window.khtToast = showToast;

  /* Small surface for the checkout modal to read totals and empty the cart. */
  window.khtCart = {
    items: getCart,
    total: totalPrice,
    count: totalQty,
    format: formatVnd,
    add: function (product, qty) {
      if (!product || !product.id) return;
      addItem(product.id, product, qty || 1);
    },
    clear: function () {
      saveCart([]);
      updateBadges();
      renderCartPage();
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    initAddButtons();
    updateBadges();
    renderCartPage();
  });
})();
