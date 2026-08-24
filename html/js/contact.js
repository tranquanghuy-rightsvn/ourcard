/* Contact form — validates locally, then submits to the GAS CMS's public
   doPost endpoint (see lead-form.js). */
document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("contactForm");
  if (!form) return;
  var errorEl = document.getElementById("contactError");
  var attachmentField = form.querySelector('[name="attachment"]');
  var honeypot = form.querySelector('[name="_hp"]');

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (honeypot && honeypot.value) return; // bot form-filler, silently drop

    form.querySelectorAll(".is-invalid").forEach(function (f) {
      f.classList.remove("is-invalid");
    });
    var missing = Array.prototype.filter.call(
      form.querySelectorAll("[required]"),
      function (field) {
        if (!field.value.trim()) return true;
        return (
          field.type === "email" &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value.trim())
        );
      },
    );

    var attachmentInvalid =
      attachmentField &&
      attachmentField.files[0] &&
      !/\.(pdf|png)$/i.test(attachmentField.files[0].name);
    if (attachmentInvalid) missing.push(attachmentField);

    if (missing.length) {
      missing.forEach(function (f) {
        f.classList.add("is-invalid");
      });
      errorEl.textContent = "Please check the highlighted fields.";
      errorEl.hidden = false;
      missing[0].focus();
      return;
    }
    errorEl.hidden = true;

    var payload = {
      formType: "contact",
      name: form.querySelector('[name="name"]').value,
      company: form.querySelector('[name="company"]').value,
      email: form.querySelector('[name="email"]').value,
      phone: form.querySelector('[name="phone"]').value,
      subject: form.querySelector('[name="subject"]').value,
      message: form.querySelector('[name="message"]').value
    };
    if (attachmentField && attachmentField.files[0]) {
      payload.note = "[Enquiry included a file attachment — ask sender to email it directly]";
    }

    var submitBtn = form.querySelector(".contact-form__submit");
    var originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    var showDone = function () {
      form.innerHTML =
        '<div class="contact-form__done">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" ' +
        'stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>' +
        "<h2>Thanks for getting in touch</h2>" +
        "<p>We'll reply within one working day. You can also reach us directly at " +
        '<a href="mailto:admin@kyucraft.com">admin@kyucraft.com</a>.</p>' +
        "</div>";
    };

    if (!window.khtLead || !window.khtLead.isConfigured()) {
      // GAS endpoint not wired up yet — still reassure the visitor.
      showDone();
      return;
    }

    window.khtLead
      .submit(payload)
      .then(showDone)
      .catch(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
        errorEl.textContent =
          "Something went wrong sending your enquiry — please email admin@kyucraft.com directly.";
        errorEl.hidden = false;
      });
  });
});
