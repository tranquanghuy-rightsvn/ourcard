/* Cart page actions. Checkout is disabled, so "Contact" opens the
   contact-notice popup instead of an in-browser payment flow. "Export to PDF"
   uses the browser's print dialog (Save as PDF) via a print stylesheet —
   no PDF library needed. */
(function () {
  var contactBtn = document.getElementById('contactBtn');
  var modal = document.getElementById('contactNotice');

  if (contactBtn && modal) {
    var lastFocused = null;
    var mainView = document.getElementById('contactNoticeMain');
    var qrView = document.getElementById('contactNoticeQrView');
    var phoneBtn = document.getElementById('contactNoticePhoneBtn');
    var backBtn = document.getElementById('contactNoticeBack');
    var qrRendered = false;

    /* Placeholder QR pattern (three finder squares + a deterministic module
       grid derived from the seed text) so each code looks distinct without
       encoding a real payload — same approach as the checkout demo QR. */
    var renderFakeQr = function (el, seedText) {
      var SIZE = 21;
      var seed = 0;
      for (var i = 0; i < seedText.length; i++) seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
      var next = function () {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      var inFinder = function (x, y) {
        var zones = [[0, 0], [SIZE - 7, 0], [0, SIZE - 7]];
        return zones.some(function (z) {
          return x >= z[0] && x < z[0] + 7 && y >= z[1] && y < z[1] + 7;
        });
      };
      var rects = '';
      for (var y = 0; y < SIZE; y++) {
        for (var x = 0; x < SIZE; x++) {
          if (inFinder(x, y)) continue;
          if (next() > 0.55) rects += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
        }
      }
      [[0, 0], [SIZE - 7, 0], [0, SIZE - 7]].forEach(function (z) {
        rects += '<path d="M' + z[0] + ' ' + z[1] + 'h7v7h-7z" fill="none" stroke="currentColor" stroke-width="1"/>';
        rects += '<rect x="' + (z[0] + 2) + '" y="' + (z[1] + 2) + '" width="3" height="3"/>';
      });
      el.innerHTML = '<svg viewBox="0 0 ' + SIZE + ' ' + SIZE + '" width="100%" height="100%" fill="currentColor">' +
        rects + '</svg>';
    };

    var showMainView = function () {
      qrView.hidden = true;
      mainView.hidden = false;
    };

    var showQrView = function () {
      if (!qrRendered) {
        renderFakeQr(document.getElementById('contactNoticeQrZalo'), 'zalo:+84708976136');
        renderFakeQr(document.getElementById('contactNoticeQrWhatsapp'), 'whatsapp:+84708976136');
        qrRendered = true;
      }
      mainView.hidden = true;
      qrView.hidden = false;
    };

    var openModal = function () {
      lastFocused = document.activeElement;
      showMainView();
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
    };

    var closeModal = function () {
      modal.hidden = true;
      document.body.style.overflow = '';
      if (lastFocused) lastFocused.focus();
    };

    contactBtn.addEventListener('click', openModal);
    if (phoneBtn) phoneBtn.addEventListener('click', showQrView);
    if (backBtn) backBtn.addEventListener('click', showMainView);
    modal.querySelectorAll('[data-contact-notice-close]').forEach(function (el) {
      el.addEventListener('click', closeModal);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });
  }

  var exportBtn = document.getElementById('exportPdfBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', function () {
      window.print();
    });
  }
})();
