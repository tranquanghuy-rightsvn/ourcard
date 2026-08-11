/* Cart page actions. Checkout is disabled, so "Contact" opens the
   contact-notice popup instead of an in-browser payment flow. "Export to PDF"
   uses the browser's print dialog (Save as PDF) via a print stylesheet —
   no PDF library needed. */
(function () {
  var contactBtn = document.getElementById('contactBtn');
  var modal = document.getElementById('contactNotice');

  if (contactBtn && modal) {
    var lastFocused = null;

    var openModal = function () {
      lastFocused = document.activeElement;
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
    };

    var closeModal = function () {
      modal.hidden = true;
      document.body.style.overflow = '';
      if (lastFocused) lastFocused.focus();
    };

    contactBtn.addEventListener('click', openModal);
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
