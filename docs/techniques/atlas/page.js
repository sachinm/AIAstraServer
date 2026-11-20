(function () {
  var views = Array.prototype.slice.call(document.querySelectorAll('article.view'));
  var links = Array.prototype.slice.call(document.querySelectorAll('.views a'));
  var names = views.map(function (v) { return v.id; });
  function show() {
    var want = (location.hash || '').replace(/^#/, '');
    if (names.indexOf(want) < 0) want = 'guide';
    // a chapter that is not shown stays laid out off screen, so its diagrams are measured and drawn correctly
    views.forEach(function (v) { v.classList.toggle('off', v.id !== want); });
    links.forEach(function (a) {
      if (a.getAttribute('data-view') === want) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', show);
  show();

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!(t instanceof Element)) return;
    var jump = t.closest('[data-jump]');
    if (jump) {
      var el = document.getElementById(jump.getAttribute('data-jump'));
      if (el) el.scrollIntoView({ block: 'start' });
      return;
    }
    var side = t.closest('.sidetoggle button');
    if (side) {
      var pair = side.closest('.pair');
      pair.setAttribute('data-side', side.getAttribute('data-show'));
      Array.prototype.forEach.call(side.parentElement.children, function (b) {
        b.setAttribute('aria-pressed', b === side ? 'true' : 'false');
      });
    }
  });
})();
