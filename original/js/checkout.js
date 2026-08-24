/* Checkout modal — demo only. Nothing is sent anywhere, no payment is taken,
   and the QR is a generated placeholder pattern rather than a real payment code. */
(function () {
  var modal = document.getElementById('checkout');
  var openBtn = document.getElementById('payNowBtn');
  if (!modal || !openBtn) return;

  var form = document.getElementById('checkoutForm');
  var body = document.getElementById('checkoutBody');
  var qrBlock = document.getElementById('checkoutQr');
  var qrCode = document.getElementById('checkoutQrCode');
  var errorEl = document.getElementById('checkoutError');
  var lastFocused = null;

  function cartTotal() {
    return window.khtCart ? window.khtCart.total() : 0;
  }

  function money(value) {
    return window.khtCart ? window.khtCart.format(value) : value + '₫';
  }

  /* A QR-shaped placeholder: three finder squares plus a deterministic module
     pattern, so it reads as a QR at a glance without encoding anything. */
  function renderFakeQr(seedText) {
    var SIZE = 25;
    var seed = 0;
    for (var i = 0; i < seedText.length; i++) seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
    function next() {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    function inFinder(x, y) {
      var zones = [[0, 0], [SIZE - 7, 0], [0, SIZE - 7]];
      return zones.some(function (z) {
        return x >= z[0] && x < z[0] + 7 && y >= z[1] && y < z[1] + 7;
      });
    }

    var rects = '';
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        if (inFinder(x, y)) continue;
        if (next() > 0.55) rects += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
      }
    }
    // Finder squares: 7x7 outline with a 3x3 solid centre.
    [[0, 0], [SIZE - 7, 0], [0, SIZE - 7]].forEach(function (z) {
      rects += '<path d="M' + z[0] + ' ' + z[1] + 'h7v7h-7z" fill="none" stroke="currentColor" stroke-width="1"/>';
      rects += '<rect x="' + (z[0] + 2) + '" y="' + (z[1] + 2) + '" width="3" height="3"/>';
    });

    qrCode.innerHTML = '<svg viewBox="0 0 ' + SIZE + ' ' + SIZE + '" width="100%" height="100%" fill="currentColor">' +
      rects + '</svg>';
  }

  function orderRef() {
    // Stable per modal opening, just to make the demo feel complete.
    return 'KYU-' + String(Math.floor(Date.now() / 1000) % 10000).padStart(4, '0');
  }

  function syncPayment() {
    var transfer = form.querySelector('input[name="payment"][value="transfer"]').checked;
    qrBlock.hidden = !transfer;
    var submit = document.getElementById('checkoutSubmit');
    submit.textContent = transfer ? 'I have transferred' : 'Place order';
  }

  function openModal() {
    if (!cartTotal()) return;
    lastFocused = document.activeElement;
    var ref = orderRef();
    document.getElementById('checkoutTotal').textContent = money(cartTotal());
    document.getElementById('checkoutQrAmount').textContent = money(cartTotal());
    document.getElementById('checkoutRef').textContent = ref;
    renderFakeQr(ref + ':' + cartTotal());
    syncPayment();
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    var first = form.querySelector('input[name="name"]');
    if (first) first.focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
    if (lastFocused) lastFocused.focus();
  }

  function showSuccess(method) {
    var paid = method === 'transfer';
    body.innerHTML =
      '<div class="checkout__done">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" ' +
          'stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>' +
        '<h2>Order placed</h2>' +
        '<p>' + (paid
          ? 'Thanks! We&rsquo;ll check the transfer and email you once the cards ship.'
          : 'Thanks! Pay the courier when your cards arrive &mdash; we&rsquo;ll email the tracking number.') + '</p>' +
        '<p class="checkout__demo-note">Demo store: nothing was charged and no order was actually created.</p>' +
        '<button type="button" class="checkout__submit" data-checkout-close>Done</button>' +
      '</div>';
    body.querySelectorAll('[data-checkout-close]').forEach(function (el) {
      el.addEventListener('click', function () {
        closeModal();
        location.reload();
      });
    });
    if (window.khtCart) window.khtCart.clear();
  }

  openBtn.addEventListener('click', openModal);

  modal.querySelectorAll('[data-checkout-close]').forEach(function (el) {
    el.addEventListener('click', closeModal);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });

  form.querySelectorAll('input[name="payment"]').forEach(function (radio) {
    radio.addEventListener('change', syncPayment);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var missing = Array.prototype.filter.call(form.querySelectorAll('[required]'), function (field) {
      return !field.value.trim();
    });
    form.querySelectorAll('.is-invalid').forEach(function (f) { f.classList.remove('is-invalid'); });
    if (missing.length) {
      missing.forEach(function (f) { f.classList.add('is-invalid'); });
      errorEl.textContent = 'Please fill in the required fields.';
      errorEl.hidden = false;
      missing[0].focus();
      return;
    }
    errorEl.hidden = true;
    showSuccess(form.querySelector('input[name="payment"]:checked').value);
  });
})();
