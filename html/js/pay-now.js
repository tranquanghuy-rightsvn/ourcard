/* Cart page "Pay now" — checkout is disabled, so this opens the contact-notice
   popup instead of an in-browser payment flow. */
(function () {
  var openBtn = document.getElementById('payNowBtn');
  var modal = document.getElementById('contactNotice');
  if (!openBtn || !modal) return;

  var lastFocused = null;

  function openModal() {
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
    if (lastFocused) lastFocused.focus();
  }

  openBtn.addEventListener('click', openModal);
  modal.querySelectorAll('[data-contact-notice-close]').forEach(function (el) {
    el.addEventListener('click', closeModal);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });
})();
