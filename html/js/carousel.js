document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.bestsellers, .partners').forEach(function (carousel) {
    var track = carousel.querySelector('.bestsellers__track, .partners__track');
    var prev = carousel.querySelector('.bestsellers__arrow--prev, .partners__arrow--prev');
    var next = carousel.querySelector('.bestsellers__arrow--next, .partners__arrow--next');
    if (!track || !prev || !next) return;
    function step() {
      var item = track.querySelector('.bestsellers__item, .partners__item');
      if (!item) return track.clientWidth / 3;
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return item.getBoundingClientRect().width + gap;
    }
    prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); });
    next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: 'smooth' }); });
  });
});
