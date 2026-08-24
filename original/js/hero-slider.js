document.addEventListener('DOMContentLoaded', function () {
  var hero = document.querySelector('.hero');
  if (!hero) return;
  var slides = hero.querySelectorAll('.hero__slide');
  var dots = hero.querySelectorAll('.hero__dot');
  var prev = hero.querySelector('.hero__arrow--prev');
  var next = hero.querySelector('.hero__arrow--next');
  if (slides.length < 2) return;

  var FADE = 900;

  var current = 0;
  var timer;
  var leaving;
  var leavingTimer;

  function goTo(index) {
    if (index === current) return;

    // Park the old slide under the new one at full opacity so the fade never
    // exposes the hero background, then drop it once the fade is over.
    if (leaving) leaving.classList.remove('is-leaving');
    clearTimeout(leavingTimer);
    leaving = slides[current];
    leaving.classList.remove('is-active');
    leaving.classList.add('is-leaving');
    leavingTimer = setTimeout(function () {
      leaving.classList.remove('is-leaving');
      leaving = null;
    }, FADE);

    dots[current].classList.remove('is-active');
    current = (index + slides.length) % slides.length;
    slides[current].classList.add('is-active');
    dots[current].classList.add('is-active');
  }

  function restart() {
    clearInterval(timer);
    timer = setInterval(function () { goTo(current + 1); }, 6000);
  }

  if (prev) prev.addEventListener('click', function () { goTo(current - 1); restart(); });
  if (next) next.addEventListener('click', function () { goTo(current + 1); restart(); });
  dots.forEach(function (dot, i) {
    dot.addEventListener('click', function () { goTo(i); restart(); });
  });

  restart();
});
