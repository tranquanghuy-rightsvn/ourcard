/* Site search: a header button that opens an overlay over a hard-coded
   snapshot of the Shop All catalogue (the site has no backend to query).
   Reads/writes the cart through the same window.khtCart / window.khtProduct
   surface cart.js exposes, so "add to cart" from a result behaves exactly
   like adding from a product tile. */
(function () {
  var PRODUCTS = [
    { id: 'pc1052-summer-holiday-beach-popup-card', name: 'PC1052 - Summer Holiday Beach Popup Card', price: 195000, image: 'images/pc1052-beach.jpg', link: 'product/index.html' },
    { id: 'pc1051-summer-holiday-mountain-popup-card', name: 'PC1051 - Summer Holiday Mountain Popup Card', price: 130000, image: 'images/pc1051-mountain.png', link: 'product/index.html' },
    { id: 'pc1046-back-to-school-popup-card', name: 'PC1046 - Back to school Popup Card', price: 395000, image: 'images/pc1046-back-to-school.png', link: 'product/index.html' },
    { id: 'pc1043-happy-birthday-with-numbers-popup-card', name: 'PC1043 - Happy birthday with numbers Popup Card', price: 470000, image: 'images/pc1043-birthday-numbers.png', link: 'product/index.html' },
    { id: 'pc1042-happy-birthday-flower-popup-card', name: 'PC1042 - Happy birthday flower Popup Card', price: 255000, image: 'images/pc1042-birthday-flower.png', link: 'product/index.html' },
    { id: 'pc1041-happy-birthday-60th-popup-card', name: 'PC1041 - Happy Birthday 60th Popup Card', price: 380000, image: 'images/pc1041-birthday-60th.png', link: 'product/index.html' },
    { id: 'pc1044-travel-adventure-popup-card', name: 'PC1044 - Travel Adventure Popup Card', price: 240000, image: 'images/pc1044-travel-adventure.jpg', link: 'product/index.html' },
    { id: 'pc1040-badminton-popup-card', name: 'PC1040 - Badminton Popup Card', price: 295000, image: 'images/pc1040-badminton.jpg', link: 'product/index.html' },
    { id: 'p1039-cornflowers-popup-card', name: 'P1039 - Cornflowers Popup Card', price: 530000, image: 'images/p1039-cornflowers.png', link: 'product/index.html' },
    { id: 'pc1036-camera-popup-card', name: 'PC1036 - Camera Popup Card', price: 365000, image: 'images/pc1036-camera.png', link: 'product/index.html' },
    { id: 'pc1038-happy-wedding-popup-card', name: 'PC1038 - Happy Wedding Popup Card', price: 170000, image: 'images/pc1038-happy-wedding.png', link: 'product/index.html' },
    { id: 'pc1037-happy-anniversary-popup-card', name: 'PC1037 - Happy Anniversary Popup Card', price: 150000, image: 'images/pc1037-happy-anniversary.png', link: 'product/index.html' },
    { id: 'pc1035-happy-wedding-popup-card', name: 'PC1035 - Happy Wedding Popup Card', price: 585000, image: 'images/pc1035-happy-wedding.jpg', link: 'product/index.html' },
    { id: 'pc1033-happy-anniversary-with-numbers-popup-card', name: 'PC1033 - Happy Anniversary with numbers Popup Card', price: 510000, image: 'images/pc1033-happy-anniversary-numbers.png', link: 'product/index.html' },
    { id: 'pc1034-farther-s-day-camping-popup-card', name: 'PC1034 - Farther\'s day camping Popup Card', price: 120000, image: 'images/pc1034-fathers-day-camping.png', link: 'product/index.html' },
    { id: 'pc1031-best-dad-ever-popup-card', name: 'PC1031 - Best Dad Ever Popup Card', price: 545000, image: 'images/pc1031-best-dad-ever.png', link: 'product/index.html' },
    { id: 'pc1032-super-dad-popup-card', name: 'PC1032 - Super Dad Popup Card', price: 345000, image: 'images/pc1032-super-dad.png', link: 'product/index.html' },
    { id: 'pc1030-happy-mother-s-day-popup-card', name: 'PC1030 - Happy Mother\'s Day Popup Card', price: 135000, image: 'images/pc1030-mothers-day.png', link: 'product/index.html' },
    { id: 'pc1029-happy-birthday-popup-card', name: 'PC1029 - Happy Birthday Popup Card', price: 485000, image: 'images/pc1029-happy-birthday.png', link: 'product/index.html' },
    { id: 'pc1028-saint-patrick-beer-popup-card', name: 'PC1028 - Saint Patrick Beer Popup Card', price: 395000, image: 'images/pc1028-saint-patrick-beer.png', link: 'product/index.html' }
  ];

  var POPULAR = ['Birthday', 'Wedding', 'Anniversary', 'Summer', 'Dad'];
  var RESULT_LIMIT = 8;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Wraps the matched substring in <mark> so the hit is obvious in the list. */
  function highlight(name, query) {
    var idx = name.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return escapeHtml(name);
    return escapeHtml(name.slice(0, idx)) +
      '<mark>' + escapeHtml(name.slice(idx, idx + query.length)) + '</mark>' +
      escapeHtml(name.slice(idx + query.length));
  }

  function search(query) {
    var q = query.trim().toLowerCase();
    if (!q) return [];
    return PRODUCTS
      .filter(function (p) { return p.name.toLowerCase().indexOf(q) !== -1; })
      .sort(function (a, b) {
        return a.name.toLowerCase().indexOf(q) - b.name.toLowerCase().indexOf(q);
      });
  }

  function build() {
    var overlay = document.createElement('div');
    overlay.className = 'search-overlay';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Search designs');
    overlay.innerHTML =
      '<div class="search-overlay__backdrop" data-search-close></div>' +
      '<div class="search-overlay__panel">' +
        '<div class="search-overlay__bar">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>' +
          '<input type="text" class="search-overlay__input" placeholder="Search designs — birthday, wedding, beach…" autocomplete="off">' +
          '<button type="button" class="search-overlay__close" aria-label="Close search" data-search-close>&times;</button>' +
        '</div>' +
        '<div class="search-overlay__body">' +
          '<div class="search-overlay__hint">' +
            '<p>Popular searches</p>' +
            '<div class="search-overlay__chips">' +
              POPULAR.map(function (term) {
                return '<button type="button" class="search-overlay__chip" data-chip="' + term + '">' + term + '</button>';
              }).join('') +
            '</div>' +
          '</div>' +
          '<div class="search-overlay__results" hidden></div>' +
          '<div class="search-overlay__empty" hidden>' +
            'No designs match “<span data-query></span>”.' +
          '</div>' +
        '</div>' +
        '<div class="search-overlay__footer"><a data-shop-all-link>Browse all designs →</a></div>' +
      '</div>';

    return {
      overlay: overlay,
      input: overlay.querySelector('.search-overlay__input'),
      hint: overlay.querySelector('.search-overlay__hint'),
      results: overlay.querySelector('.search-overlay__results'),
      empty: overlay.querySelector('.search-overlay__empty'),
      footerLink: overlay.querySelector('[data-shop-all-link]')
    };
  }

  function renderResults(container, items, query) {
    var fromRoot = window.khtProduct ? window.khtProduct.fromRoot : function (u) { return u; };
    var money = window.khtProduct ? window.khtProduct.format : function (v) { return v + '₫'; };
    var shown = items.slice(0, RESULT_LIMIT);
    var countLabel = items.length > RESULT_LIMIT
      ? 'Showing ' + shown.length + ' of ' + items.length + ' designs'
      : shown.length + (shown.length === 1 ? ' design' : ' designs');

    container.innerHTML =
      '<p class="search-overlay__count">' + countLabel + '</p>' +
      shown.map(function (p) {
        return (
          '<div class="search-result">' +
            '<a class="search-result__link" href="' + fromRoot(p.link) + '">' +
              '<span class="search-result__media"><img src="' + fromRoot(p.image) + '" alt="" loading="lazy"></span>' +
              '<span class="search-result__info">' +
                '<span class="search-result__name">' + highlight(p.name, query) + '</span>' +
              '</span>' +
            '</a>' +
            '<button type="button" class="search-result__add" data-id="' + p.id + '" aria-label="Add to cart">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 4h2l2.4 12.4a2 2 0 002 1.6h8.4a2 2 0 002-1.6L21 8H6"/>' +
              '<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/></svg>' +
            '</button>' +
          '</div>'
        );
      }).join('');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var toggle = document.querySelector('.search-toggle');
    if (!toggle) return;

    var ui = build();
    document.body.appendChild(ui.overlay);
    if (window.khtProduct) ui.footerLink.setAttribute('href', window.khtProduct.fromRoot('shop-all/index.html'));

    var lastFocused = null;

    function renderState(query) {
      var q = query.trim();
      if (!q) {
        ui.hint.hidden = false;
        ui.results.hidden = true;
        ui.empty.hidden = true;
        return;
      }
      var matches = search(q);
      ui.hint.hidden = true;
      if (!matches.length) {
        ui.results.hidden = true;
        ui.empty.hidden = false;
        ui.empty.querySelector('[data-query]').textContent = q;
      } else {
        ui.empty.hidden = true;
        ui.results.hidden = false;
        renderResults(ui.results, matches, q);
      }
    }

    function open() {
      lastFocused = document.activeElement;
      ui.overlay.hidden = false;
      document.body.style.overflow = 'hidden';
      toggle.setAttribute('aria-expanded', 'true');
      ui.input.value = '';
      renderState('');
      ui.input.focus();
    }

    function close() {
      ui.overlay.hidden = true;
      document.body.style.overflow = '';
      toggle.setAttribute('aria-expanded', 'false');
      if (lastFocused) lastFocused.focus();
    }

    toggle.addEventListener('click', function () {
      if (ui.overlay.hidden) open(); else close();
    });
    ui.overlay.querySelectorAll('[data-search-close]').forEach(function (el) {
      el.addEventListener('click', close);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !ui.overlay.hidden) close();
    });
    ui.input.addEventListener('input', function () { renderState(ui.input.value); });
    ui.hint.querySelectorAll('[data-chip]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ui.input.value = btn.getAttribute('data-chip');
        ui.input.focus();
        renderState(ui.input.value);
      });
    });
    ui.results.addEventListener('click', function (e) {
      var btn = e.target.closest('.search-result__add');
      if (!btn) return;
      e.preventDefault();
      var id = btn.getAttribute('data-id');
      var product = PRODUCTS.filter(function (p) { return p.id === id; })[0];
      if (product && window.khtCart) {
        window.khtCart.add(product, 1);
        if (window.khtToast) window.khtToast('Added to cart');
      }
    });
  });
})();
