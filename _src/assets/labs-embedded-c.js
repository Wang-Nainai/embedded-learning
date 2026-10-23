/* 第 2 册交互实验 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

  /* ---------- 1. 启动流程 ---------- */
  (function () {
    var canvas = $('bootCanvas'), out = $('bootOut');
    if (!canvas || !out) return;
    var step = 0;
    var texts = [
      '上电：Flash 里是烧录好的镜像，SRAM 内容是随机的（图中用 ?? 表示）。',
      '硬件从向量表取出初始栈指针 SP 和复位入口，跳到 Reset_Handler。',
      '复制 .data：把 g_counter 的初值 42 从 Flash 搬到 SRAM。',
      '清零 .bss：把 buf[] 全部写成 0。C 标准要求未初始化全局变量为 0。',
      '调用 main：此时全局变量都已就绪，栈也准备好了。'
    ];
    function cell(v, tone) {
      return '<span style="display:inline-grid;place-items:center;min-width:38px;height:28px;padding:0 6px;border-radius:5px;font-family:Consolas,monospace;font-size:11.5px;border:1px solid ' +
        (tone === 'flash' ? '#a5b4fc' : tone === 'ram' ? '#86efac' : '#e2e8f0') + ';background:' +
        (tone === 'flash' ? '#eef2ff' : tone === 'ram' ? '#f0fdf4' : '#f8fafc') + ';color:#1e293b">' + v + '</span>';
    }
    function render() {
      var flash = [cell('指令', 'flash'), cell('指令', 'flash'), cell(step >= 2 ? '42' : '42', 'flash')];
      var ram = [
        cell(step >= 2 ? '42' : '??', 'ram'),
        cell(step >= 3 ? '0' : '??', 'ram'),
        cell(step >= 3 ? '0' : '??', 'ram'),
        cell(step >= 4 ? 'SP' : '??', 'ram')
      ];
      var h = '<div style="display:grid;gap:8px;font-size:11.5px">' +
        '<div><div style="color:#26348f;font-weight:700;margin-bottom:4px">Flash（只读，掉电不丢）</div>' +
        '<div style="display:flex;gap:4px;flex-wrap:wrap">' + flash.join('') + '</div>' +
        '<div style="color:#64748b;margin-top:3px">向量表 | .text | .data 初值</div></div>' +
        '<div><div style="color:#166534;font-weight:700;margin-bottom:4px">SRAM（可读写，掉电丢失）</div>' +
        '<div style="display:flex;gap:4px;flex-wrap:wrap">' + ram.join('') + '</div>' +
        '<div style="color:#64748b;margin-top:3px">g_counter | buf[0] | buf[1] | 栈顶</div></div></div>';
      canvas.innerHTML = h;
      out.textContent = '步骤 ' + step + '/4\n' + texts[step];
    }
    on($('bootStep'), 'click', function () { if (step < 4) step++; render(); });
    on($('bootReset'), 'click', function () { step = 0; render(); });
    render();
  })();

  /* ---------- 2. 寄存器位图 ---------- */
  (function () {
    var canvas = $('regCanvas'), out = $('regOut');
    if (!canvas || !out) return;
    var val = 0, last = -1;
    function render() {
      var h = '<div style="display:grid;grid-template-columns:repeat(8,1fr);gap:4px">';
      for (var i = 31; i >= 0; i--) {
        var bit = (val >>> i) & 1;
        h += '<button type="button" data-bit="' + i + '" title="bit ' + i + '" style="cursor:pointer;font-family:Consolas,monospace;font-size:11px;padding:5px 2px;border-radius:5px;border:1px solid ' +
          (bit ? '#0f766e' : '#cbd5e1') + ';background:' + (bit ? '#0f766e' : '#fff') + ';color:' + (bit ? '#fff' : '#64748b') + '">' +
          bit + '<span style="display:block;font-size:8.5px;opacity:.7">' + i + '</span></button>';
        if (i % 8 === 0 && i !== 0) h += '</div><div style="display:grid;grid-template-columns:repeat(8,1fr);gap:4px">';
      }
      h += '</div>';
      canvas.innerHTML = h;
      var hex = (val >>> 0).toString(16).toUpperCase().padStart(8, '0');
      var bin = (val >>> 0).toString(2).padStart(32, '0').replace(/(.{8})(?=.)/g, '$1 ');
      var lines = ['REG = 0x' + hex + '   (' + (val >>> 0) + ')', '      ' + bin];
      if (last >= 0) {
        lines.push('');
        lines.push('置位  REG |=  (1u << ' + last + ');');
        lines.push('清位  REG &= ~(1u << ' + last + ');');
        lines.push('读取  (REG >> ' + last + ') & 1u  →  ' + ((val >>> last) & 1));
      }
      out.textContent = lines.join('\n');
    }
    canvas.addEventListener('click', function (e) {
      var b = e.target.closest('[data-bit]');
      if (!b) return;
      var i = parseInt(b.getAttribute('data-bit'), 10);
      val = (val ^ (1 << i)) >>> 0;
      last = i;
      render();
    });
    on($('regZero'), 'click', function () { val = 0; last = -1; render(); });
    on($('regAll'), 'click', function () { val = 0xFFFFFFFF; last = -1; render(); });
    render();
  })();

  /* ---------- 3. 字段掩码 ---------- */
  (function () {
    var pos = $('fldPos'), w = $('fldW'), v = $('fldVal'), out = $('fldOut');
    if (!out) return;
    function run() {
      var p = parseInt(pos.value, 10), n = parseInt(w.value, 10);
      if (isNaN(p) || isNaN(n) || p < 0 || p > 31 || n < 1 || n > 32 || p + n > 32) {
        out.textContent = '非法组合：要求 0 ≤ 偏移 ≤ 31，1 ≤ 宽度 ≤ 32，且 偏移 + 宽度 ≤ 32。';
        return;
      }
      var raw = (v.value || '0').trim();
      var num;
      try { num = raw.toLowerCase().indexOf('0x') === 0 ? BigInt(raw) : BigInt(raw); } catch (e) {
        out.textContent = '数值请填十进制或 0x 开头的十六进制。';
        return;
      }
      var P = BigInt(p), N = BigInt(n);
      var mask = ((1n << N) - 1n) << P;
      var shifted = (num << P) & mask;
      var clipped = num & ((1n << N) - 1n);
      var hex = function (x) { return '0x' + x.toString(16).toUpperCase().padStart(8, '0'); };
      out.textContent = [
        '偏移 POS   = ' + p,
        '宽度 WIDTH = ' + n,
        '掩码 MSK   = ' + hex(mask) + '   (' + mask.toString(2).padStart(32, '0').replace(/(.{8})(?=.)/g, '$1 ') + ')',
        '输入值     = ' + num.toString() + '  ' + hex(num & 0xFFFFFFFFn),
        '截到字段宽 = ' + clipped.toString(),
        '',
        '置字段  REG = (REG & ~' + hex(mask) + ') | (' + hex(shifted) + ');',
        '读字段  (' + hex(mask) + ' & REG) >> ' + p,
        '',
        (num > ((1n << N) - 1n) ? '⚠ 输入值超过字段宽度，置字段时会先被截断为 ' + clipped.toString() : '✓ 输入值在字段宽度内')
      ].join('\n');
    }
    ['input', 'change'].forEach(function (ev) { on(pos, ev, run); on(w, ev, run); on(v, ev, run); });
    on($('fldGo'), 'click', run);
    run();
  })();

  /* ---------- 4. 符号扩展 ---------- */
  (function () {
    var inp = $('seVal'), out = $('seOut');
    if (!out) return;
    function run() {
      var raw = (inp.value || '0').trim().replace(/^0x/i, '');
      if (!/^[0-9a-fA-F]{1,2}$/.test(raw)) { out.textContent = '请输入 0x00–0xFF（1–2 位十六进制）。'; return; }
      var u = parseInt(raw, 16);
      var s = u >= 128 ? u - 256 : u;
      var bin8 = u.toString(2).padStart(8, '0');
      var signExt = (s < 0 ? s + 4294967296 : s).toString(2).padStart(32, '0');
      var zeroExt = u.toString(2).padStart(32, '0');
      out.textContent = [
        '8 位值       0x' + raw.toUpperCase().padStart(2, '0') + '    ' + bin8,
        '',
        '按 int8_t     ' + s + '   （符号扩展）',
        '  32 位模式    ' + signExt.replace(/(.{8})(?=.)/g, '$1 '),
        '',
        '按 uint8_t    ' + u + '   （零扩展）',
        '  32 位模式    ' + zeroExt.replace(/(.{8})(?=.)/g, '$1 '),
        '',
        s < 0 ? '最高位是 1：有符号解释为负数，扩展时高位补 1。' : '最高位是 0：两种解释结果相同。'
      ].join('\n');
    }
    on(inp, 'input', run);
    on($('seGo'), 'click', run);
    run();
  })();

  /* ---------- 5. 结构体对齐 ---------- */
  (function () {
    var canvas = $('alignCanvas'), out = $('alignOut'), ctl = $('alignCtl');
    if (!canvas || !out) return;
    var T = {
      char: { size: 1, align: 1, label: 'char' },
      short: { size: 2, align: 2, label: 'short' },
      int: { size: 4, align: 4, label: 'int' },
      longlong: { size: 8, align: 8, label: 'long long' },
      arr3: { size: 3, align: 1, label: 'char[3]' }
    };
    var members = [], packed = false;
    function up(x, a) { return Math.ceil(x / a) * a; }
    function compute() {
      var cur = 0, maxa = 1, rows = [];
      members.forEach(function (m, i) {
        var t = T[m], off = packed ? cur : up(cur, t.align);
        rows.push({ name: t.label + ' m' + i, off: off, size: t.size, align: t.align, pad: off - cur });
        cur = off + t.size;
        maxa = Math.max(maxa, t.align);
      });
      var total = packed ? cur : up(cur, maxa);
      return { rows: rows, total: total, align: packed ? 1 : maxa, tail: total - cur };
    }
    function render() {
      var r = compute();
      var h = '<div style="display:flex;gap:2px;flex-wrap:wrap;margin-bottom:8px">';
      var used = 0;
      r.rows.forEach(function (row) {
        for (var p = 0; p < row.pad; p++) {
          h += '<span style="width:22px;height:34px;border:1px dashed #cbd5e1;background:repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9 3px,#e2e8f0 3px,#e2e8f0 6px);border-radius:3px"></span>';
        }
        for (var b = 0; b < row.size; b++) {
          h += '<span style="width:22px;height:34px;display:grid;place-items:center;border:1px solid #0f766e;background:#ecfdf5;border-radius:3px;font-size:9px;color:#115e59">' + (b === 0 ? row.name.split(' ')[1] : '') + '</span>';
        }
        used += row.pad + row.size;
      });
      for (var t = 0; t < r.tail; t++) {
        h += '<span style="width:22px;height:34px;border:1px dashed #cbd5e1;background:repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9 3px,#e2e8f0 3px,#e2e8f0 6px);border-radius:3px"></span>';
      }
      h += '</div>';
      canvas.innerHTML = h;
      var lines = ['成员                偏移   大小   对齐'];
      r.rows.forEach(function (row) {
        lines.push(row.name.padEnd(18) + String(row.off).padStart(4) + String(row.size).padStart(7) + String(row.align).padStart(7));
      });
      lines.push('─'.repeat(42));
      lines.push('sizeof = ' + r.total + ' 字节   对齐 = ' + r.align + '   填充 = ' + (r.total - r.rows.reduce(function (a, b) { return a + b.size; }, 0)) + ' 字节');
      lines.push(packed ? '紧凑布局：没有填充，但成员可能未对齐。' : '自然对齐：编译器插入填充以满足对齐要求。');
      out.textContent = lines.join('\n');
    }
    on(ctl, 'click', function (e) {
      var b = e.target.closest('[data-add]');
      if (b) {
        if (members.length >= 5) { out.textContent = '最多演示 5 个成员，再多图就放不下了。'; return; }
        members.push(b.getAttribute('data-add'));
        render();
      }
    });
    on($('alignPack'), 'click', function () {
      packed = !packed;
      $('alignPack').textContent = '紧凑布局：' + (packed ? '开' : '关');
      $('alignPack').classList.toggle('pri', packed);
      render();
    });
    on($('alignReset'), 'click', function () { members = []; packed = false; $('alignPack').textContent = '紧凑布局：关'; $('alignPack').classList.remove('pri'); render(); });
    members = ['char', 'int', 'short'];
    render();
  })();

  /* ---------- 6. 状态机 ---------- */
  (function () {
    var canvas = $('fsmCanvas'), out = $('fsmOut');
    if (!canvas || !out) return;
    var S = ['IDLE', 'CONNECTING', 'READY', 'ERROR'];
    var state = 0, retry = 0, log = [];
    var trans = {
      '0:start': [1, '开始连接'],
      '1:connected': [2, '连接成功'],
      '1:timeout': [1, '超时重试'],
      '1:fail': [1, '失败重试'],
      '2:fail': [1, '连接断开，重连'],
      '2:timeout': [1, '心跳超时，重连'],
      '3:reset': [0, '复位']
    };
    function render() {
      var h = '<div style="display:flex;gap:6px;flex-wrap:wrap">';
      S.forEach(function (s, i) {
        var on = i === state;
        h += '<div style="flex:1 1 90px;text-align:center;padding:9px 6px;border-radius:8px;border:1.5px solid ' +
          (on ? '#0f766e' : '#cbd5e1') + ';background:' + (on ? '#ecfdf5' : '#fff') + ';color:' + (on ? '#115e59' : '#64748b') +
          ';font-family:Consolas,monospace;font-size:11.5px;font-weight:' + (on ? '700' : '400') + '">' + s + '</div>';
      });
      h += '</div>';
      canvas.innerHTML = h;
      out.textContent = '当前状态：' + S[state] + '   retry = ' + retry + '\n' + (log.length ? log.slice(-6).join('\n') : '点击事件按钮开始。');
    }
    document.querySelectorAll('[data-ev]').forEach(function (b) {
      b.addEventListener('click', function () {
        var ev = b.getAttribute('data-ev');
        var key = state + ':' + ev;
        if (trans[key]) {
          var t = trans[key];
          if (ev === 'timeout' || ev === 'fail') retry++;
          if (t[0] === 2) retry = 0;
          if (t[0] === 0) retry = 0;
          if (state === 1 && (ev === 'timeout' || ev === 'fail') && retry >= 3) {
            state = 3;
            log.push('EV_' + ev.toUpperCase() + ' → 重试 3 次，进入 ERROR');
          } else {
            state = t[0];
            log.push('EV_' + ev.toUpperCase() + ' → ' + t[1] + '，进入 ' + S[state]);
          }
        } else {
          log.push('EV_' + ev.toUpperCase() + ' 在 ' + S[state] + ' 下无迁移，已忽略');
        }
        render();
      });
    });
    on($('fsmReset'), 'click', function () { state = 0; retry = 0; log = []; render(); });
    render();
  })();

  /* ---------- 7. 环形缓冲 ---------- */
  (function () {
    var canvas = $('ringCanvas'), out = $('ringOut');
    if (!canvas || !out) return;
    var N = 8, buf = new Array(N).fill(null), head = 0, tail = 0, seq = 0;
    function count() { return (head + N - tail) % N; }
    function render() {
      var h = '<div style="display:flex;gap:4px;flex-wrap:wrap">';
      for (var i = 0; i < N; i++) {
        var v = buf[i];
        var isH = i === head, isT = i === tail;
        h += '<div style="text-align:center">' +
          '<div style="height:14px;font-size:9px;color:#b45309">' + (isH ? 'head' : '') + '</div>' +
          '<div style="width:44px;height:40px;display:grid;place-items:center;border-radius:6px;font-family:Consolas,monospace;font-size:12px;border:1.5px solid ' +
          (isH ? '#b45309' : isT ? '#0f766e' : '#cbd5e1') + ';background:' + (v !== null ? '#ecfdf5' : '#fff') + ';color:#1e293b">' +
          (v === null ? '·' : v) + '</div>' +
          '<div style="height:14px;font-size:9px;color:#0f766e">' + (isT ? 'tail' : '') + '</div></div>';
      }
      h += '</div>';
      canvas.innerHTML = h;
      out.textContent = 'count = ' + count() + ' / ' + (N - 1) + '   head = ' + head + '   tail = ' + tail + '\n' +
        (count() === N - 1 ? '已满：再 push 会返回 false（不是覆盖）。' : count() === 0 ? '已空：pop 会返回 false。' : '可继续读写。');
    }
    document.querySelectorAll('[data-ring]').forEach(function (b) {
      b.addEventListener('click', function () {
        var act = b.getAttribute('data-ring');
        if (act === 'push') {
          var next = (head + 1) % N;
          if (next === tail) { out.textContent = 'push 失败：缓冲区已满，返回 false。'; return; }
          buf[head] = ++seq;
          head = next;
        } else if (act === 'pop') {
          if (head === tail) { out.textContent = 'pop 失败：缓冲区为空，返回 false。'; return; }
          buf[tail] = null;
          tail = (tail + 1) % N;
        } else if (act === 'fill') {
          while ((head + 1) % N !== tail) { buf[head] = ++seq; head = (head + 1) % N; }
        } else {
          buf = new Array(N).fill(null); head = 0; tail = 0; seq = 0;
        }
        render();
      });
    });
    render();
  })();

  /* ---------- 8. 竞态 ---------- */
  (function () {
    var canvas = $('raceCanvas'), out = $('raceOut');
    if (!canvas || !out) return;
    var mode = 'unsafe', idx = 0;
    var scripts = {
      unsafe: [
        ['初始', 'counter = 5，r0 = r1 = ?'],
        ['主', '读 counter → r0 = 5'],
        ['中断', '打断主循环，读 counter → r1 = 5'],
        ['主', 'r0 = r0 + 1 = 6'],
        ['中断', 'r1 = r1 + 1 = 6'],
        ['主', '写回 counter = 6'],
        ['中断', '写回 counter = 6（覆盖了主循环的结果）'],
        ['结果', 'counter = 6，两次加法只生效一次']
      ],
      safe: [
        ['初始', 'counter = 5，r0 = r1 = ?'],
        ['主', '关中断（保存 PRIMASK）'],
        ['主', '读 counter → r0 = 5'],
        ['中断', '中断到来，但被挂起（pending）'],
        ['主', 'r0 = r0 + 1 = 6'],
        ['主', '写回 counter = 6'],
        ['主', '开中断（恢复 PRIMASK）'],
        ['中断', '现在才执行：读 counter → r1 = 6'],
        ['中断', 'r1 = r1 + 1 = 7'],
        ['中断', '写回 counter = 7'],
        ['结果', 'counter = 7，两次加法都生效']
      ]
    };
    function render() {
      var sc = scripts[mode];
      var h = '<div style="display:grid;gap:3px;font-family:Consolas,monospace;font-size:11px">';
      sc.forEach(function (row, i) {
        var on = i === idx;
        h += '<div style="display:flex;gap:8px;padding:4px 7px;border-radius:5px;background:' + (on ? '#ecfdf5' : 'transparent') +
          ';border:1px solid ' + (on ? '#0f766e' : 'transparent') + ';color:' + (on ? '#115e59' : i > idx ? '#94a3b8' : '#334155') + '">' +
          '<span style="min-width:34px;font-weight:700">' + row[0] + '</span><span>' + row[1] + '</span></div>';
      });
      h += '</div>';
      canvas.innerHTML = h;
      var done = idx === sc.length - 1;
      out.textContent = '模式：' + (mode === 'unsafe' ? '无保护' : '临界区') + '　步骤 ' + idx + '/' + (sc.length - 1) +
        (done ? '\n结果：' + sc[sc.length - 1][1] : '');
    }
    document.querySelectorAll('[data-race]').forEach(function (b) {
      b.addEventListener('click', function () {
        mode = b.getAttribute('data-race'); idx = 0;
        document.querySelectorAll('[data-race]').forEach(function (x) { x.classList.toggle('pri', x === b); });
        render();
      });
    });
    on($('raceStep'), 'click', function () { if (idx < scripts[mode].length - 1) idx++; render(); });
    on($('raceReset'), 'click', function () { idx = 0; render(); });
    render();
  })();
})();
