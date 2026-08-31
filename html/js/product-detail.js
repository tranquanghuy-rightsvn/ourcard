/* Product detail page behaviour, ported from the Velora product template:
   gallery thumbs, accordion, looping related-products carousel and the
   sticky mobile buy bar. */

/* ===== GALLERY THUMBS ===== */
document.querySelectorAll('.product-gallery__thumb').forEach(function (thumb) {
  thumb.addEventListener('click', function () {
    document.querySelectorAll('.product-gallery__thumb').forEach(function (t) {
      t.classList.remove('product-gallery__thumb--active');
    });
    this.classList.add('product-gallery__thumb--active');

    var main = document.getElementById('productMainImg');
    var video = document.getElementById('productMainVideo');

    // A product can have more than one video thumb - swap the <source> and
    // reload so clicking a second clip doesn't just replay the first one.
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
    if (!main) return;
    main.hidden = false;
    main.src = img.getAttribute('data-large') || img.src;
    main.alt = img.alt;
  });
});

/* ===== ACCORDION ===== */
document.querySelectorAll('.product-accordion .faq-item__btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    this.closest('.faq-item').classList.toggle('open');
  });
});

/* ===== RELATED PRODUCTS CAROUSEL (infinite loop, 1 item per click) ===== */
(function () {
  var track = document.getElementById('productsTrack');
  var prevBtn = document.getElementById('prevBtn');
  var nextBtn = document.getElementById('nextBtn');
  var dotsWrap = document.getElementById('productsDots');
  if (!track || !prevBtn || !nextBtn) return;

  var GAP = 20;
  // Captured before any clones are inserted, so this always holds only the real
  // cards even after setup() runs again on resize.
  var realCards = Array.prototype.slice.call(track.children);
  var realCount = realCards.length;
  if (realCount === 0) return;

  var currentIndex = 0;
  var looping = false;

  function cardWidth() {
    var card = realCards[0];
    return card ? card.getBoundingClientRect().width + GAP : 0;
  }

  // How many cards the viewport shows at once. Cloning only makes sense when
  // there are MORE real cards than this - otherwise the head/tail clones sit
  // in view next to the originals and the same product renders twice.
  function perView() {
    var w = cardWidth();
    if (!w) return realCount;
    var vw = track.parentNode.getBoundingClientRect().width;
    return Math.max(1, Math.round(vw / w));
  }

  function realIndex() {
    return ((currentIndex - realCount) % realCount + realCount) % realCount;
  }

  function renderDots() {
    if (!dotsWrap) return;
    if (dotsWrap.children.length !== realCount) {
      dotsWrap.innerHTML = '';
      for (var i = 0; i < realCount; i++) {
        var dot = document.createElement('button');
        dot.className = 'products__dot';
        dot.setAttribute('aria-label', 'Go to product ' + (i + 1));
        dot.addEventListener('click', (function (idx) {
          return function () { goTo(realCount + idx, true); };
        })(i));
        dotsWrap.appendChild(dot);
      }
    }
    var ri = realIndex();
    Array.prototype.forEach.call(dotsWrap.children, function (dot, i) {
      dot.classList.toggle('products__dot--active', i === ri);
    });
  }

  function goTo(index, animate) {
    if (!looping) return;
    currentIndex = index;
    track.style.transition = animate ? '' : 'none';
    if (!animate) void track.offsetHeight; // commit "no transition" before jumping
    track.style.transform = 'translateX(-' + (currentIndex * cardWidth()) + 'px)';
    renderDots();
  }

  function removeClones() {
    Array.prototype.slice.call(track.querySelectorAll('[data-clone]')).forEach(function (n) {
      track.removeChild(n);
    });
  }

  // Rebuilds the carousel for the current viewport. Idempotent: safe to call on
  // every resize. Leaves the track as a plain left-aligned row (no clones, no
  // arrows, no dots) whenever everything already fits.
  function setup() {
    removeClones();
    track.style.transition = 'none';
    track.style.transform = 'none';
    looping = false;

    if (realCount <= perView()) {
      prevBtn.hidden = true;
      nextBtn.hidden = true;
      if (dotsWrap) dotsWrap.hidden = true;
      return;
    }

    // Clone the full set on both sides ([clones][real][clones]) so there's always
    // enough buffer to slide past either end, at any responsive item-count.
    var headClones = document.createDocumentFragment();
    var tailClones = document.createDocumentFragment();
    realCards.forEach(function (card) {
      var head = card.cloneNode(true);
      head.setAttribute('aria-hidden', 'true');
      head.setAttribute('data-clone', '');
      headClones.appendChild(head);
      var tail = card.cloneNode(true);
      tail.setAttribute('aria-hidden', 'true');
      tail.setAttribute('data-clone', '');
      tailClones.appendChild(tail);
    });
    track.insertBefore(headClones, track.firstChild);
    track.appendChild(tailClones);

    prevBtn.hidden = false;
    nextBtn.hidden = false;
    if (dotsWrap) dotsWrap.hidden = false;

    looping = true;
    goTo(realCount, false); // start on the first real card
  }

  // Once a click slides into the cloned buffer, snap invisibly back to the
  // matching real position so the next click keeps sliding the same direction.
  track.addEventListener('transitionend', function (e) {
    if (!looping || e.target !== track || e.propertyName !== 'transform') return;
    if (currentIndex >= realCount * 2) {
      goTo(currentIndex - realCount, false);
    } else if (currentIndex < realCount) {
      goTo(currentIndex + realCount, false);
    }
  });

  prevBtn.addEventListener('click', function () { goTo(currentIndex - 1, true); });
  nextBtn.addEventListener('click', function () { goTo(currentIndex + 1, true); });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setup, 150);
  });

  setup();
})();

/* ===== WISHLIST TOGGLE ===== */
document.querySelectorAll('.pcard__wish').forEach(function (btn) {
  btn.addEventListener('click', function () {
    this.classList.toggle('pcard__wish--active');
  });
});

/* ===== STICKY MOBILE BUY BAR: reveal once the main CTA scrolls out of view ===== */
(function () {
  var bar = document.getElementById('stickyBuyBar');
  var mainCta = document.querySelector('.product-info__add-to-cart');
  if (!bar || !mainCta || !window.IntersectionObserver) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      bar.classList.toggle('sticky-buy-bar--visible', !e.isIntersecting);
    });
  }, { threshold: 0 });
  io.observe(mainCta);
})();
