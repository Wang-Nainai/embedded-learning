/* 门户交互：移动导航、滚动高亮、进入动画、年份 */
(function () {
  'use strict';
  var doc = document;
  var nav = doc.getElementById('nav');
  var toggle = doc.getElementById('navToggle');
  var links = doc.getElementById('navLinks');
  var body = doc.body;

  /* 移动端导航 */
  function setOpen(open) {
    if (!links || !toggle) return;
    links.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
    body.style.overflow = open ? 'hidden' : '';
  }
  if (toggle) {
    toggle.addEventListener('click', function () {
      setOpen(!links.classList.contains('open'));
    });
  }
  if (links) {
    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
  }
  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setOpen(false);
  });
  window.addEventListener('resize', function () {
    if (window.innerWidth > 860) setOpen(false);
  });

  /* 滚动：导航阴影 + 当前区块高亮 */
  var sections = Array.prototype.slice.call(doc.querySelectorAll('main section[id]'));
  var navLinks = links ? Array.prototype.slice.call(links.querySelectorAll('a[href^="#"]')) : [];
  var ticking = false;

  function update() {
    var y = window.pageYOffset || doc.documentElement.scrollTop;
    if (nav) nav.classList.toggle('scrolled', y > 8);

    var current = null;
    sections.forEach(function (s) {
      if (s.getBoundingClientRect().top <= 190) current = s.id;
    });
    navLinks.forEach(function (a) {
      a.classList.toggle('active', !!current && a.getAttribute('href') === '#' + current);
    });
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();

  /* 进入动画 */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce && 'IntersectionObserver' in window) {
    var items = doc.querySelectorAll('.course, .path-step, .read-mode, .section-head');
    Array.prototype.forEach.call(items, function (el, i) {
      el.classList.add('reveal');
      el.style.transitionDelay = (i % 5) * 40 + 'ms';
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    Array.prototype.forEach.call(items, function (el) { io.observe(el); });
  }

  var year = doc.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
