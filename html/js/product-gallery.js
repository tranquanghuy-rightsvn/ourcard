document.addEventListener('DOMContentLoaded', function () {
  var mainImg = document.querySelector('.product__gallery-main img');
  var thumbs = document.querySelectorAll('.product__thumbs img');
  if (!mainImg || !thumbs.length) return;
  thumbs.forEach(function (thumb) {
    thumb.addEventListener('click', function () {
      mainImg.src = thumb.dataset.full || thumb.src;
      mainImg.alt = thumb.alt;
      thumbs.forEach(function (t) { t.classList.remove('is-active'); });
      thumb.classList.add('is-active');
    });
  });
});
