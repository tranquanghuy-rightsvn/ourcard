(function () {
  var nav = document.querySelector('.shop__categories');
  var grid = document.querySelector('.shop__grid');
  if (!nav || !grid) return;

  var allCheckbox = nav.querySelector('[data-category="all"]');
  var childCheckboxes = Array.prototype.slice.call(
    nav.querySelectorAll('input[type="checkbox"]:not([data-category="all"])')
  );
  if (!allCheckbox || !childCheckboxes.length) return;

  var cards = Array.prototype.slice.call(grid.querySelectorAll('.product-card'));

  function setChildren(checked) {
    childCheckboxes.forEach(function (cb) {
      cb.checked = checked;
    });
  }

  function syncAllFromChildren() {
    allCheckbox.checked = childCheckboxes.every(function (cb) {
      return cb.checked;
    });
  }

  function applyFilter() {
    var activeCategories = childCheckboxes
      .filter(function (cb) {
        return cb.checked;
      })
      .map(function (cb) {
        return cb.getAttribute('data-category');
      });

    cards.forEach(function (card) {
      var cardCategories = (card.getAttribute('data-categories') || '').split(/\s+/);
      var matches =
        !activeCategories.length ||
        activeCategories.some(function (category) {
          return cardCategories.indexOf(category) !== -1;
        });
      card.style.display = matches ? '' : 'none';
    });
  }

  allCheckbox.addEventListener('change', function () {
    setChildren(allCheckbox.checked);
    applyFilter();
  });

  childCheckboxes.forEach(function (cb) {
    cb.addEventListener('change', function () {
      syncAllFromChildren();
      applyFilter();
    });
  });
})();
