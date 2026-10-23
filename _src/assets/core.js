/* 嵌入式学习路径 · 系列教程共享脚本（无外部依赖） */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };

  /* ---------- 主题 ---------- */
  var THEME_KEY = 'emb-tut-theme';
  function readTheme() {
    try { var v = localStorage.getItem(THEME_KEY); if (v === 'dark' || v === 'light') return v; } catch (e) {}
    return 'light';
  }
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    var btn = $('#themeBtn');
    if (btn) {
      btn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
      btn.setAttribute('aria-label', t === 'dark' ? '切换到浅色模式' : '切换到深色模式');
      btn.title = btn.getAttribute('aria-label');
      var sun = $('.ic-sun', btn), moon = $('.ic-moon', btn);
      if (sun && moon) { sun.style.display = t === 'dark' ? 'none' : ''; moon.style.display = t === 'dark' ? '' : 'none'; }
    }
  }
  applyTheme(readTheme());
  var themeBtn = $('#themeBtn');
  if (themeBtn) themeBtn.addEventListener('click', function () {
    applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  /* ---------- 侧栏抽屉 ---------- */
  var sidebar = $('#sidebar'), scrim = $('#scrim'), menuBtn = $('#menuBtn');
  function setDrawer(open) {
    if (!sidebar) return;
    sidebar.classList.toggle('open', open);
    if (scrim) scrim.classList.toggle('on', open);
    if (menuBtn) menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    doc.body.classList.toggle('no-scroll', open && window.innerWidth <= 1024);
  }
  if (menuBtn) menuBtn.addEventListener('click', function () { setDrawer(!sidebar.classList.contains('open')); });
  if (scrim) scrim.addEventListener('click', function () { setDrawer(false); });
  window.addEventListener('resize', function () { if (window.innerWidth > 1024) setDrawer(false); });
  $$('#sidebar a').forEach(function (a) { a.addEventListener('click', function () { if (window.innerWidth <= 1024) setDrawer(false); }); });

  /* ---------- 阅读进度 + 回到顶部 ---------- */
  var bar = $('#progressBar'), toTop = $('#toTop');
  function onScroll() {
    var h = doc.documentElement.scrollHeight - window.innerHeight;
    var y = window.pageYOffset || doc.documentElement.scrollTop;
    if (bar) bar.style.width = (h > 0 ? Math.min(100, (y / h) * 100) : 0) + '%';
    if (toTop) toTop.classList.toggle('on', y > 700);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
  if (toTop) toTop.addEventListener('click', function () {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });

  /* ---------- 目录高亮 + 右栏本讲目录 ---------- */
  var links = $$('.toc a');
  var chapters = $$('.ch');
  var railTitle = $('#railTitle'), railList = $('#railList'), railPct = $('#railPct');
  var railCh = null;

  function buildRail(ch) {
    if (!railList || !railTitle) return;
    var h2 = ch.querySelector('h2');
    railTitle.textContent = h2 ? h2.textContent.trim() : '';
    var hs = $$('h3', ch);
    if (!hs.length) { railList.innerHTML = '<li><a href="#' + ch.id + '">本讲内容</a></li>'; return; }
    railList.innerHTML = hs.map(function (h) {
      var num = h.querySelector('.n');
      var label = h.textContent.replace(/\s+/g, ' ').trim();
      if (num) { label = num.textContent.trim() + '\u3000' + label.replace(num.textContent.trim(), '').trim(); }
      return '<li><a href="#' + h.id + '">' + label + '</a></li>';
    }).join('');
  }

  function updateNav() {
    if (!links.length || !chapters.length) return;
    var y = (window.pageYOffset || doc.documentElement.scrollTop) + 150;
    var cur = null;
    chapters.forEach(function (c) { if (c.offsetTop <= y) cur = c; });

    if (cur) {
      links.forEach(function (a) {
        var on = a.getAttribute('href') === '#' + cur.id;
        a.classList.toggle('active', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
      if (railList && cur.id !== railCh) { buildRail(cur); railCh = cur.id; }
      var active = null;
      var hs = $$('h3', cur);
      hs.forEach(function (h) { if (h.getBoundingClientRect().top <= 150) active = h; });
      if (!active && hs.length) active = hs[0];
      $$('.rail-list a').forEach(function (a) {
        a.classList.toggle('active', !!active && a.getAttribute('href') === '#' + active.id);
      });
    } else if (railTitle && railList) {
      railTitle.textContent = '课程地图';
      railList.innerHTML = '<li><a href="#ch01">从第 01 讲开始</a></li>';
      links.forEach(function (a) { a.classList.remove('active'); });
    }

    if (railPct) {
      var h = doc.documentElement.scrollHeight - window.innerHeight;
      var top = window.pageYOffset || doc.documentElement.scrollTop;
      railPct.textContent = (h > 0 ? Math.min(100, Math.round(top / h * 100)) : 0) + '%';
    }
  }

  var navTick = false;
  function onNavScroll() {
    if (navTick) return;
    navTick = true;
    requestAnimationFrame(function () { updateNav(); navTick = false; });
  }
  window.addEventListener('scroll', onNavScroll, { passive: true });
  window.addEventListener('resize', onNavScroll);
  updateNav();

  /* 直接带 #锚点 打开时，等布局（含右栏）稳定后再对齐一次 */
  if (location.hash && location.hash.length > 1) {
    setTimeout(function () {
      var el = doc.getElementById(location.hash.slice(1));
      if (el) { el.scrollIntoView({ block: 'start' }); updateNav(); }
    }, 60);
  }

  /* ---------- 复制代码 ---------- */
  function copyText(text, btn) {
    function ok() {
      var old = btn.textContent;
      btn.textContent = '已复制';
      btn.classList.add('ok');
      setTimeout(function () { btn.textContent = old; btn.classList.remove('ok'); }, 1500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, function () { fallback(); });
    } else { fallback(); }
    function fallback() {
      var ta = doc.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      doc.body.appendChild(ta);
      ta.select();
      var done = false;
      try { done = doc.execCommand('copy'); } catch (e) { done = false; }
      doc.body.removeChild(ta);
      if (done) ok(); else { btn.textContent = '请手动选择'; setTimeout(function () { btn.textContent = '复制'; }, 1600); }
    }
  }
  doc.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.copy') : null;
    if (!btn) return;
    var box = btn.closest('.code');
    var code = box && box.querySelector('pre code');
    if (code) copyText((code.textContent || '').replace(/\n$/, ''), btn);
  });

  /* ---------- 测验 ---------- */
  doc.addEventListener('click', function (e) {
    var opt = e.target.closest ? e.target.closest('.quiz .opt') : null;
    if (!opt) return;
    var quiz = opt.closest('.quiz');
    if (quiz.dataset.done === '1') return;          /* 已答对，忽略后续点击 */
    var ans = parseInt(quiz.getAttribute('data-answer'), 10);
    var idx = parseInt(opt.getAttribute('data-i'), 10);
    var fb = quiz.querySelector('[data-fb]');
    $$('.opt', quiz).forEach(function (o) { o.classList.remove('wrong'); });
    if (idx === ans) {
      opt.classList.add('right');
      quiz.dataset.done = '1';
      if (fb) { fb.classList.add('show'); fb.innerHTML = '<b>回答正确。</b> ' + fb.innerHTML; }
    } else {
      opt.classList.add('wrong');
      if (fb) { fb.classList.add('show'); }
    }
  });

  /* ---------- 搜索 ---------- */
  var index = null;
  function buildIndex() {
    index = [];
    chapters.forEach(function (ch) {
      var h2 = ch.querySelector('h2');
      var chTitle = h2 ? h2.textContent.trim() : ch.id;
      var heads = $$('h3, h4', ch);
      heads.forEach(function (h) {
        var text = '', n = h.nextElementSibling, guard = 0;
        while (n && guard < 6 && !/^H[234]$/.test(n.tagName)) {
          text += ' ' + n.textContent.replace(/\s+/g, ' ').trim();
          n = n.nextElementSibling; guard++;
        }
        index.push({ id: h.id, title: h.textContent.replace(/\s+/g, ' ').trim(), ch: chTitle, text: text.slice(0, 700) });
      });
      if (!heads.length) {
        index.push({ id: ch.id, title: chTitle, ch: chTitle, text: ch.textContent.replace(/\s+/g, ' ').slice(0, 700) });
      }
    });
  }
  var sbox = $('#searchBox'), sInput = $('#searchInput'), sRes = $('#searchRes');
  var sel = -1, results = [];
  function openSearch() {
    if (!sbox) return;
    if (!index) buildIndex();
    sbox.classList.add('on');
    doc.body.classList.add('no-scroll');
    setTimeout(function () { sInput.focus(); sInput.select(); }, 30);
    render('');
  }
  function closeSearch() {
    if (!sbox) return;
    sbox.classList.remove('on');
    doc.body.classList.remove('no-scroll');
    sel = -1;
  }
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function render(q) {
    if (!sRes) return;
    q = q.trim().toLowerCase();
    results = !q ? index.slice(0, 8) : index.filter(function (it) {
      return (it.title + ' ' + it.text + ' ' + it.ch).toLowerCase().indexOf(q) >= 0;
    }).slice(0, 20);
    sel = results.length ? 0 : -1;
    if (!results.length) { sRes.innerHTML = '<div class="sr-empty">没有找到匹配的章节。试试更短的关键词，例如“指针”“队列”“CRC”。</div>'; return; }
    sRes.innerHTML = results.map(function (it, i) {
      var snippet = it.text.replace(/\s+/g, ' ').trim().slice(0, 78);
      return '<button class="sr-item' + (i === 0 ? ' sel' : '') + '" data-id="' + esc(it.id) + '"><b>' + esc(it.title) +
        '</b><span>' + esc(it.ch) + (snippet ? ' · ' + esc(snippet) : '') + '</span></button>';
    }).join('');
  }
  function go(id) {
    var el = doc.getElementById(id);
    if (el) { closeSearch(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); history.replaceState(null, '', '#' + id); }
  }
  if (sInput) {
    sInput.addEventListener('input', function () { render(sInput.value); });
    sInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeSearch(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!results.length) return;
        sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
        $$('.sr-item', sRes).forEach(function (b, i) { b.classList.toggle('sel', i === sel); });
        var cur = $$('.sr-item', sRes)[sel]; if (cur) cur.scrollIntoView({ block: 'nearest' });
      }
      if (e.key === 'Enter' && sel >= 0 && results[sel]) { go(results[sel].id); }
    });
  }
  if (sRes) sRes.addEventListener('click', function (e) {
    var b = e.target.closest('.sr-item'); if (b) go(b.getAttribute('data-id'));
  });
  if (sbox) sbox.addEventListener('click', function (e) { if (e.target === sbox) closeSearch(); });
  var sBtn = $('#searchBtn');
  if (sBtn) sBtn.addEventListener('click', openSearch);
  doc.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
    else if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(doc.activeElement.tagName)) { e.preventDefault(); openSearch(); }
    else if (e.key === 'Escape') { closeSearch(); setDrawer(false); }
  });

  /* ---------- 年份 ---------- */
  var y = $('#year'); if (y) y.textContent = new Date().getFullYear();
})();
