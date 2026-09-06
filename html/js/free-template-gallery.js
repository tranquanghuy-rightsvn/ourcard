(function () {
  var grid = document.querySelector('.shop__grid');
  if (!grid || !grid.querySelector('.js-template-gallery-open')) return;

  var lastFocused = null;

  var overlay = document.createElement('div');
  overlay.className = 'template-gallery-overlay';
  overlay.hidden = true;
  overlay.innerHTML =
    '<div class="template-gallery-overlay__backdrop" data-template-gallery-close></div>' +
    '<div class="template-gallery-overlay__panel" role="dialog" aria-modal="true">' +
    '<button type="button" class="template-gallery-overlay__close" data-template-gallery-close aria-label="Close">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18" /></svg>' +
    '</button>' +
    '<h2 class="template-gallery-overlay__title"></h2>' +
    '<div class="template-gallery-overlay__gallery"></div>' +
    '<a class="btn-download template-gallery-overlay__download" href="#" download></a>' +
    '</div>';
  document.body.appendChild(overlay);

  var galleryEl = overlay.querySelector('.template-gallery-overlay__gallery');
  var titleEl = overlay.querySelector('.template-gallery-overlay__title');
  var downloadEl = overlay.querySelector('.template-gallery-overlay__download');

  function bindThumbs() {
    galleryEl.querySelectorAll('.product-gallery__thumb').forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        galleryEl.querySelectorAll('.product-gallery__thumb').forEach(function (t) {
          t.classList.remove('product-gallery__thumb--active');
        });
        this.classList.add('product-gallery__thumb--active');
        var main = galleryEl.querySelector('.js-template-gallery-main-img');
        var video = galleryEl.querySelector('#productMainVideo');
        if (this.hasAttribute('data-video')) {
          if (main) main.hidden = true;
          if (video) {
            var src = this.getAttribute('data-video');
            var sourceEl = video.querySelector('source');
            if (sourceEl && sourceEl.getAttribute('src') !== src) {
              sourceEl.setAttribute('src', src);
              video.load();
            }
            video.hidden = false;
          }
          return;
        }
        if (video) {
          video.pause();
          video.hidden = true;
        }
        var img = this.querySelector('img');
        if (!main || !img) return;
        main.hidden = false;
        main.src = img.getAttribute('data-large') || img.src;
        main.alt = img.alt;
      });
    });
  }

  function open(card) {
    var data = card.querySelector('.js-template-gallery-data');
    if (!data) return;
    lastFocused = document.activeElement;
    galleryEl.innerHTML = data.innerHTML;
    titleEl.textContent = data.getAttribute('data-title') || '';
    downloadEl.href = data.getAttribute('data-download') || '#';
    downloadEl.textContent = 'Download';
    bindThumbs();
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    overlay.querySelector('.template-gallery-overlay__close').focus();
  }

  function close() {
    overlay.hidden = true;
    document.body.style.overflow = '';
    if (lastFocused) lastFocused.focus();
  }

  grid.addEventListener('click', function (e) {
    var trigger = e.target.closest('.js-template-gallery-open');
    if (!trigger) return;
    e.preventDefault();
    var card = trigger.closest('.product-card');
    if (card) open(card);
  });

  overlay.querySelectorAll('[data-template-gallery-close]').forEach(function (el) {
    el.addEventListener('click', close);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !overlay.hidden) close();
  });
})();
