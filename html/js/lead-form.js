/* Wires forms to the GAS CMS's public doPost endpoint (no auth, no payment —
   just a Google Sheet). Uses text/plain so the browser sends a "simple
   request" and skips the CORS preflight OPTIONS call Apps Script can't
   answer. Exposes window.khtLead.submit() so contact.js (which has its own
   validation UI) can reuse the same submit path as the generic
   [data-lead-form] footer newsletter boxes wired up below. */
(function () {
  // Fill this in after deploying the GAS web app (Deploy > New deployment > Web app).
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbze46G0S-cX3WGMfxD73hiF0nXYCNRe7THG1inp_5Nc25ayh-jyTtEGKr80LR9bRJFQ/exec';

  function isConfigured() {
    return ENDPOINT && ENDPOINT.indexOf('PASTE_') !== 0;
  }

  function submit(payload) {
    if (!isConfigured()) return Promise.reject(new Error('not_configured'));
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json(); })
      .then(function (json) {
        if (!json || !json.ok) throw new Error('server_error');
        return json;
      });
  }

  window.khtLead = { submit: submit, isConfigured: isConfigured };

  function showNote(form, message, isError) {
    var note = form.querySelector('[data-lead-note]');
    if (!note) {
      note = document.createElement('p');
      note.setAttribute('data-lead-note', '');
      note.className = 'lead-form__note';
      form.appendChild(note);
    }
    note.textContent = message;
    note.classList.toggle('lead-form__note--error', !!isError);
  }

  function serialize(form) {
    var data = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.type === 'submit' || el.type === 'file') return;
      data[el.name] = el.value;
    });
    return data;
  }

  // Generic footer "Receive catalogs from us" forms.
  document.querySelectorAll('[data-lead-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var honeypot = form.querySelector('[name="_hp"]');
      if (honeypot && honeypot.value) {
        showNote(form, 'Thank you! We will get back to you soon.', false);
        form.reset();
        return;
      }
      var payload = serialize(form);
      payload.formType = 'newsletter';
      var submitBtn = form.querySelector('button[type="submit"]');
      var originalLabel = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending…';
      }
      submit(payload)
        .then(function () {
          showNote(form, 'Thank you! We will get back to you soon.', false);
          form.reset();
        })
        .catch(function () {
          showNote(form, 'Something went wrong — please try again or email admin@kyucraft.com.', true);
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalLabel;
          }
        });
    });
  });
})();
