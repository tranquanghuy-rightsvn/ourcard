document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.bestsellers').forEach(function (carousel) {
    var track = carousel.querySelector('.bestsellers__track');
    var prev = carousel.querySelector('.bestsellers__arrow--prev');
    var next = carousel.querySelector('.bestsellers__arrow--next');
    if (!track || !prev || !next) return;
    function step() {
      var item = track.querySelector('.bestsellers__item');
      return item ? item.getBoundingClientRect().width + 28 : track.clientWidth / 3;
    }
    prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); });
    next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: 'smooth' }); });
  });
});
