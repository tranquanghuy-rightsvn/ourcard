/* Contact form — demo only: validates locally, nothing is sent anywhere. */
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('contactForm');
  if (!form) return;
  var errorEl = document.getElementById('contactError');

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    form.querySelectorAll('.is-invalid').forEach(function (f) { f.classList.remove('is-invalid'); });
    var missing = Array.prototype.filter.call(form.querySelectorAll('[required]'), function (field) {
      if (!field.value.trim()) return true;
      return field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value.trim());
    });

    if (missing.length) {
      missing.forEach(function (f) { f.classList.add('is-invalid'); });
      errorEl.textContent = 'Please check the highlighted fields.';
      errorEl.hidden = false;
      missing[0].focus();
      return;
    }

    form.innerHTML =
      '<div class="contact-form__done">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" ' +
          'stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>' +
        '<h2>Thanks for getting in touch</h2>' +
        '<p>This is a demo form, so nothing was actually sent. Email us at ' +
          '<a href="mailto:info@khtcard.com">info@khtcard.com</a> and we&rsquo;ll reply within one working day.</p>' +
      '</div>';
  });
});
