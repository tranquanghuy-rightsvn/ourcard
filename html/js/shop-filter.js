(function () {
  var nav = document.querySelector('.shop__categories');
  var grid = document.querySelector('.shop__grid');
  if (!nav || !grid) return;

  var allCheckbox = nav.querySelector('[data-category="all"]');
  var allInputs = Array.prototype.slice.call(
    nav.querySelectorAll('input[type="checkbox"]')
  );
  var specialCheckboxes = allInputs.filter(function (cb) {
    var category = cb.getAttribute('data-category');
    return category === 'best-sellers' || category === 'new-product';
  });
  var childCheckboxes = allInputs.filter(function (cb) {
    return cb !== allCheckbox && specialCheckboxes.indexOf(cb) === -1;
  });
  if (!allCheckbox || !childCheckboxes.length) return;

  var cards = Array.prototype.slice.call(grid.querySelectorAll('.product-card'));

  function checkedCategoriesOf(list) {
    return list
      .filter(function (cb) {
        return cb.checked;
      })
      .map(function (cb) {
        return cb.getAttribute('data-category');
      });
  }

  function applyFilter() {
    if (allCheckbox.checked) {
      cards.forEach(function (card) {
        card.style.display = '';
      });
      return;
    }

    var activeSpecials = checkedCategoriesOf(specialCheckboxes);
    var activeChildren = checkedCategoriesOf(childCheckboxes);

    cards.forEach(function (card) {
      var cardCategories = (card.getAttribute('data-categories') || '').split(/\s+/);
      var matchesSpecials =
        activeSpecials.length &&
        activeSpecials.some(function (category) {
          return cardCategories.indexOf(category) !== -1;
        });
      var matchesChildren =
        activeChildren.length &&
        activeChildren.some(function (category) {
          return cardCategories.indexOf(category) !== -1;
        });

      var matches;
      if (activeSpecials.length && activeChildren.length) {
        matches = matchesSpecials && matchesChildren;
      } else if (activeSpecials.length) {
        matches = matchesSpecials;
      } else if (activeChildren.length) {
        matches = matchesChildren;
      } else {
        matches = false;
      }

      card.style.display = matches ? '' : 'none';
    });
  }

  allCheckbox.addEventListener('change', function () {
    if (allCheckbox.checked) {
      specialCheckboxes.forEach(function (cb) {
        cb.checked = false;
      });
      childCheckboxes.forEach(function (cb) {
        cb.checked = true;
      });
    } else {
      childCheckboxes.forEach(function (cb) {
        cb.checked = false;
      });
    }
    applyFilter();
  });

  specialCheckboxes.forEach(function (cb) {
    cb.addEventListener('change', function () {
      allCheckbox.checked = false;
      var otherSpecialActive = specialCheckboxes.some(function (other) {
        return other !== cb && other.checked;
      });
      if (cb.checked && !otherSpecialActive) {
        childCheckboxes.forEach(function (box) {
          box.checked = false;
        });
      }
      applyFilter();
    });
  });

  childCheckboxes.forEach(function (cb) {
    cb.addEventListener('change', function () {
      allCheckbox.checked = false;
      applyFilter();
    });
  });

  var categoryParam = new URLSearchParams(window.location.search).get('category');
  var targetSpecial = specialCheckboxes.filter(function (cb) {
    return cb.getAttribute('data-category') === categoryParam;
  })[0];
  if (targetSpecial) {
    allCheckbox.checked = false;
    childCheckboxes.forEach(function (cb) {
      cb.checked = false;
    });
    targetSpecial.checked = true;
    applyFilter();
  }
})();
