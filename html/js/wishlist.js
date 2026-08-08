/* Wishlist: same shape as the cart, but a saved-for-later list with no
   quantities. Reads product tiles through the shared reader in cart.js. */
(function () {
  var STORAGE_KEY = 'kht_wishlist';

  function get() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function save(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    updateBadges();
  }

  function has(id) {
    return get().some(function (it) { return it.id === id; });
  }

  function updateBadges() {
    var count = get().length;
    document.querySelectorAll('.wishlist-link__badge').forEach(function (el) {
      el.textContent = count;
      el.hidden = count === 0;
    });
  }

  function toast(message) {
    if (window.khtToast) return window.khtToast(message);
    var el = document.getElementById('cartToast');
    if (el) {
      el.querySelector('.cart-toast__text').textContent = message;
      el.classList.remove('is-visible');
      void el.offsetWidth;
      el.classList.add('is-visible');
    }
  }

  function remove(id) {
    save(get().filter(function (it) { return it.id !== id; }));
    render();
    syncButtons();
  }

  /* Hearts fill in when the product is already saved, on every page. */
  function syncButtons() {
    document.querySelectorAll('.btn-wish, .pcard__wish').forEach(function (btn) {
      var product = window.khtProduct && window.khtProduct.read(btn);
      if (!product) return;
      var saved = has(product.id);
      var activeClass = btn.classList.contains('pcard__wish') ? 'pcard__wish--active' : 'btn-wish--active';
      btn.classList.toggle(activeClass, saved);
      btn.setAttribute('title', saved ? 'In wishlist' : 'Add to wishlist');
      btn.setAttribute('aria-label', saved ? 'Remove from wishlist' : 'Add to wishlist');
    });
  }

  function initButtons() {
    document.querySelectorAll('.btn-wish, .pcard__wish').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var product = window.khtProduct && window.khtProduct.read(btn);
        if (!product || !product.id) return;
        if (has(product.id)) {
          save(get().filter(function (it) { return it.id !== product.id; }));
          toast('Removed from wishlist');
        } else {
          save(get().concat([product]));
          toast('Saved to wishlist');
        }
        syncButtons();
      });
    });
  }

  function render() {
    var container = document.getElementById('wishlistItems');
    var empty = document.querySelector('.wishlist-empty');
    if (!container) return;

    var items = get();
    if (!items.length) {
      container.innerHTML = '';
      container.style.display = 'none';
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';
    container.style.display = '';

    var fromRoot = window.khtProduct ? window.khtProduct.fromRoot : function (u) { return u; };
    var money = window.khtProduct ? window.khtProduct.format : function (v) { return v + '₫'; };

    container.innerHTML = items.map(function (it) {
      var link = fromRoot(it.link) || '#';
      return (
        '<div class="wish-card" data-id="' + it.id + '">' +
          '<a class="wish-card__media" href="' + link + '"><img src="' + fromRoot(it.image) + '" alt="' + it.name + '"></a>' +
          '<a class="wish-card__name" href="' + link + '">' + it.name + '</a>' +
          '<p class="wish-card__price">' + money(it.price || 0) + '</p>' +
          '<div class="wish-card__actions">' +
            '<button type="button" class="add-to-cart" data-wish-add>' +
              '<svg class="icon-cart" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">' +
              '<path d="M3 4h2l2.4 12.4a2 2 0 002 1.6h8.4a2 2 0 002-1.6L21 8H6"/>' +
              '<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/></svg>Add to Cart</button>' +
            '<button type="button" class="wish-card__remove" aria-label="Remove from wishlist">Remove</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    container.querySelectorAll('.wish-card').forEach(function (row) {
      var id = row.getAttribute('data-id');
      row.querySelector('.wish-card__remove').addEventListener('click', function () { remove(id); });
      row.querySelector('[data-wish-add]').addEventListener('click', function (e) {
        e.preventDefault();
        var it = get().find(function (x) { return x.id === id; });
        if (it && window.khtCart) {
          window.khtCart.add(it);
          toast('Added to cart');
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initButtons();
    syncButtons();
    updateBadges();
    render();
  });
})();
