/* 第 1 册交互实验：无依赖，全部基于原生 DOM */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]; }); }

  /* ---------- 1. 编译流水线 ---------- */
  (function () {
    var out = $('buildOut'), ctl = $('buildCtl');
    if (!out || !ctl) return;
    var stages = [
      ['hello.c  ·  你写的源文件',
        '#include <stdio.h>\n\nint main(void)\n{\n    printf("Hello, C!\\n");\n    return 0;\n}\n\n' +
        '→ 纯文本，约 80 字节。编译器还不认识它。'].join('\n'),
      ['hello.i  ·  预处理之后',
        '…… stdio.h 的几千行声明被展开进来 ……\n' +
        'extern int printf (const char *__restrict, ...);\n' +
        '……\n' +
        'int main(void)\n{\n    printf("Hello, C!\\n");\n    return 0;\n}\n\n' +
        '→ 仍然是人能读的 C 代码，但已经没有任何 # 指令。'].join('\n'),
      ['hello.s  ·  编译成汇编',
        '    .section .rdata,"dr"\nLC0:\n    .ascii "Hello, C!\\12\\0"\n' +
        '    .text\n    .globl main\nmain:\n    subq $40, %rsp\n' +
        '    leaq LC0(%rip), %rcx\n    call printf\n    xorl %eax, %eax\n' +
        '    addq $40, %rsp\n    ret\n\n' +
        '→ 已经是目标 CPU 的汇编指令，但仍是文本。'].join('\n'),
      ['hello.o  ·  目标文件',
        'COFF/ELF 头部 + .text 段 + .rdata 段 + 符号表\n\n' +
        '符号表（示意）：\n  U  printf      ← 未定义，等链接器去找\n  T  main        ← 已定义在本文件\n\n' +
        '→ 机器码有了，但 printf 的地址还是空的（重定位项）。'].join('\n'),
      ['hello.exe  ·  可执行文件',
        '入口点 → 启动代码 → main → printf（已从 C 运行库解析）\n\n' +
        '$ ./hello\nHello, C!\n\n' +
        '→ 所有符号都接上了，操作系统可以加载并执行。'].join('\n')
    ];
    function show(i) {
      out.textContent = stages[i][0] + '\n' + '─'.repeat(46) + '\n' + stages[i][1];
      Array.prototype.forEach.call(ctl.querySelectorAll('button'), function (b, k) {
        b.classList.toggle('pri', k === i);
      });
    }
    ctl.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-stage]');
      if (b) show(parseInt(b.getAttribute('data-stage'), 10));
    });
    show(0);
  })();

  /* ---------- 2. 整数范围与溢出 ---------- */
  (function () {
    var sel = $('intType'), inp = $('intVal'), btn = $('intGo'), out = $('intOut');
    if (!sel || !out) return;
    var T = {
      s8: { bits: 8, signed: true, name: 'signed char' },
      u8: { bits: 8, signed: false, name: 'unsigned char' },
      s16: { bits: 16, signed: true, name: 'short' },
      u16: { bits: 16, signed: false, name: 'unsigned short' },
      s32: { bits: 32, signed: true, name: 'int' },
      u32: { bits: 32, signed: false, name: 'unsigned int' },
      s64: { bits: 64, signed: true, name: 'long long' }
    };
    function bitsOf(v, n) {
      var s = '', x = v;
      for (var i = 0; i < n; i++) {
        s = (x & 1n ? '1' : '0') + s;
        x >>= 1n;
        if ((i + 1) % 8 === 0 && i !== n - 1) s = ' ' + s;
      }
      return s;
    }
    function run() {
      var t = T[sel.value];
      var raw = (inp.value || '').trim().replace(/[\s,_]/g, '');
      var v;
      try { v = BigInt(raw || '0'); } catch (e) {
        out.textContent = '请输入十进制整数（可以带负号）。';
        return;
      }
      var n = BigInt(t.bits), mod = 1n << n;
      var min = t.signed ? -(1n << (n - 1n)) : 0n;
      var max = t.signed ? (1n << (n - 1n)) - 1n : mod - 1n;
      var inRange = v >= min && v <= max;
      var stored, note;
      if (inRange) {
        stored = v;
        note = '在范围内，按原值存储。';
      } else if (!t.signed) {
        stored = ((v % mod) + mod) % mod;
        note = '超出范围。无符号类型按 2^' + t.bits + ' 取模，实际存成 ' + stored.toString() + '。';
      } else {
        stored = ((v % mod) + mod) % mod;
        if (stored >= (1n << (n - 1n))) stored -= mod;
        note = '超出范围。有符号溢出是未定义行为；这里显示的 ' + stored.toString() + ' 只是常见实现的结果，不能依赖。';
      }
      var neg = stored < 0n;
      var twos = neg ? stored + mod : stored;
      var lines = [
        '类型        ' + t.name + '（' + t.bits + ' 位，' + (t.signed ? '有符号' : '无符号') + '）',
        '范围        ' + min.toString() + ' ～ ' + max.toString(),
        '输入        ' + v.toString(),
        '存入后的值  ' + stored.toString(),
        '十六进制    0x' + twos.toString(16).toUpperCase().padStart(t.bits / 4, '0'),
        '二进制      ' + bitsOf(twos, t.bits),
        '补码        负数按 2^' + t.bits + ' 取模表示：' + (neg ? stored.toString() + ' + 2^' + t.bits + ' = ' + twos.toString() : '非负，原码即补码')
      ];
      lines.push('');
      lines.push((inRange ? '✓ ' : '⚠ ') + note);
      out.textContent = lines.join('\n');
    }
    on(btn, 'click', run);
    on(sel, 'change', run);
    on(inp, 'keydown', function (e) { if (e.key === 'Enter') run(); });
    run();
  })();

  /* ---------- 3. 位运算 ---------- */
  (function () {
    var a = $('bitA'), b = $('bitB'), op = $('bitOp'), out = $('bitOut');
    if (!a || !out) return;
    function bin8(x) {
      var s = (x & 0xff).toString(2).padStart(8, '0');
      return s.slice(0, 4) + ' ' + s.slice(4);
    }
    function run() {
      var x = parseInt(a.value, 10), y = parseInt(b.value, 10);
      if (isNaN(x) || isNaN(y)) { out.textContent = '请输入 0–255 的整数。'; return; }
      x = ((x % 256) + 256) % 256;
      y = ((y % 256) + 256) % 256;
      var r, expr;
      switch (op.value) {
        case 'and': r = x & y; expr = 'A & B'; break;
        case 'or': r = x | y; expr = 'A | B'; break;
        case 'xor': r = x ^ y; expr = 'A ^ B'; break;
        case 'not': r = ~x; expr = '~A'; break;
        case 'shl': r = x << 1; expr = 'A << 1'; break;
        default: r = x >> 1; expr = 'A >> 1'; break;
      }
      var u = r >>> 0;
      out.textContent = [
        'A           ' + x.toString().padStart(3) + '   ' + bin8(x) + '   0x' + x.toString(16).toUpperCase().padStart(2, '0'),
        'B           ' + y.toString().padStart(3) + '   ' + bin8(y) + '   0x' + y.toString(16).toUpperCase().padStart(2, '0'),
        '─'.repeat(52),
        expr.padEnd(12) + '= ' + String(r).padStart(3) + '   ' + bin8(u) + '   0x' + u.toString(16).toUpperCase().padStart(8, '0'),
        '',
        op.value === 'not' ? '提示：~ 在 32 位 int 上运算，所以 ~178 = -179，低 8 位是 0x4D。' :
          op.value === 'shl' ? '提示：左移一位相当于乘 2（不溢出时）；移出的高位被丢弃。' :
            op.value === 'shr' ? '提示：正数右移一位相当于整除 2；负数的右移由实现定义。' :
              '提示：与、或、异或都是逐位运算，不产生进位。'
      ].join('\n');
    }
    ['input', 'change'].forEach(function (ev) {
      on(a, ev, run); on(b, ev, run); on(op, ev, run);
    });
    on($('bitGo'), 'click', run);
    run();
  })();

  /* ---------- 4. for 循环单步 ---------- */
  (function () {
    var nIn = $('loopN'), out = $('loopOut'), stepBtn = $('loopStep'), resetBtn = $('loopReset');
    if (!out) return;
    var n = 5, i = 0, sum = 0, phase = 0, done = false;
    function render() {
      var lines = [];
      lines.push('int sum = 0;');
      lines.push('for (int i = 0; i < ' + n + '; i++) {');
      lines.push('    sum += i;');
      lines.push('}');
      lines.push('─'.repeat(40));
      lines.push('i = ' + i + '    sum = ' + sum);
      lines.push('');
      if (done) {
        lines.push('✓ 循环结束：条件 i < ' + n + ' 为假（i = ' + i + '）。');
        lines.push('  循环体执行了 ' + n + ' 次，条件判断了 ' + (n + 1) + ' 次。');
      } else if (phase === 0) {
        lines.push('→ 下一步：判断 i < ' + n + ' 是否成立。');
      } else if (phase === 1) {
        lines.push('→ 条件成立，执行循环体：sum = ' + sum + ' + ' + i + ' = ' + (sum + i) + '。');
      } else {
        lines.push('→ 执行步进：i++，然后回到条件判断。');
      }
      out.textContent = lines.join('\n');
    }
    function reset() { n = Math.max(0, Math.min(9, parseInt(nIn.value, 10) || 0)); i = 0; sum = 0; phase = 0; done = false; render(); }
    on(stepBtn, 'click', function () {
      if (done) return;
      if (phase === 0) {
        if (i < n) phase = 1; else { done = true; phase = 0; }
      } else if (phase === 1) {
        sum += i; phase = 2;
      } else {
        i++; phase = 0;
      }
      render();
    });
    on($('loopRun'), 'click', function () {
      var guard = 0;
      while (!done && guard++ < 200) {
        if (phase === 0) { if (i < n) phase = 1; else { done = true; phase = 0; } }
        else if (phase === 1) { sum += i; phase = 2; }
        else { i++; phase = 0; }
      }
      render();
    });
    on(resetBtn, 'click', reset);
    on(nIn, 'change', reset);
    reset();
  })();

  /* ---------- 5. 栈帧 ---------- */
  (function () {
    var canvas = $('stackCanvas'), out = $('stackOut'), stepBtn = $('stackStep'), resetBtn = $('stackReset');
    if (!canvas || !out) return;
    var step = 0, total = 4;
    var texts = [
      'main 的栈帧建立：a = 3，b = 5。此时只有一层。',
      '调用 swap(a, b)：把 a、b 的值复制到新栈帧的 x、y。注意地址不同。',
      'swap 内部交换 x、y：x 变成 5，y 变成 3。main 的 a、b 完全没被碰。',
      'swap 返回：它的栈帧被整体丢弃，x、y 不复存在。',
      '回到 main：a 仍是 3，b 仍是 5。值传递决定了这个结果。'
    ];
    function frame(title, rows, tone, note) {
      var h = '<div style="border:1px solid ' + (tone === 'main' ? '#a5b4fc' : '#6ee7b7') +
        ';background:' + (tone === 'main' ? '#eef2ff' : '#ecfdf5') + ';border-radius:10px;padding:9px 11px;margin:6px 0">' +
        '<div style="font-size:12px;font-weight:700;color:' + (tone === 'main' ? '#26348f' : '#065f46') + ';margin-bottom:5px">' + title + '</div>';
      rows.forEach(function (r) {
        h += '<div style="display:flex;gap:8px;align-items:center;margin:3px 0">' +
          '<span style="font-family:Consolas,monospace;font-size:12px;min-width:74px;color:#334155">' + r[0] + '</span>' +
          '<span style="font-family:Consolas,monospace;font-size:12px;background:#fff;border:1px solid #cbd5e1;border-radius:5px;padding:2px 8px;color:#0f172a">' + r[1] + '</span>' +
          (r[2] ? '<span style="font-size:11px;color:#64748b">' + r[2] + '</span>' : '') + '</div>';
      });
      if (note) h += '<div style="font-size:11px;color:#64748b;margin-top:5px">' + note + '</div>';
      return h + '</div>';
    }
    function render() {
      var h = '';
      if (step >= 1 && step <= 3) {
        h += frame('swap 的栈帧（地址 0x7FFC10）', [
          ['x', step === 2 ? '5' : '3', step === 2 ? '已交换' : 'a 的副本'],
          ['y', step === 2 ? '3' : '5', step === 2 ? '已交换' : 'b 的副本'],
          ['返回地址', '→ main', '']
        ], 'swap', step === 3 ? '即将销毁' : '');
      }
      h += frame('main 的栈帧（地址 0x7FFC40）', [
        ['a', '3', step >= 4 ? '始终是 3' : ''],
        ['b', '5', step >= 4 ? '始终是 5' : '']
      ], 'main');
      h += '<div style="font-size:11px;color:#64748b;margin-top:2px">栈向低地址增长：swap 的帧在 main 的下方。</div>';
      canvas.innerHTML = h;
      out.textContent = '步骤 ' + step + '/' + total + '\n' + texts[step];
    }
    on(stepBtn, 'click', function () { if (step < total) step++; render(); });
    on(resetBtn, 'click', function () { step = 0; render(); });
    render();
  })();

  /* ---------- 6. 数组越界 ---------- */
  (function () {
    var idx = $('arrIdx'), val = $('arrVal'), out = $('arrOut'), canvas = $('arrCanvas');
    if (!canvas || !out) return;
    var buf = [0, 0, 0, 0], guard = 0x11223344, log = [];
    function render() {
      var i = parseInt(idx.value, 10);
      var h = '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-end">';
      for (var k = 0; k < 4; k++) {
        var active = (k === i);
        h += '<div style="text-align:center">' +
          '<div style="font-size:10.5px;color:#64748b;margin-bottom:3px">buf[' + k + ']</div>' +
          '<div style="width:62px;height:44px;display:grid;place-items:center;border-radius:7px;font-family:Consolas,monospace;font-size:13px;' +
          'border:2px solid ' + (active ? '#3b5bdb' : '#cbd5e1') + ';background:' + (active ? '#eef2ff' : '#fff') + ';color:#0f172a">' + buf[k] + '</div>' +
          '<div style="font-size:10px;color:#94a3b8;margin-top:2px">0x100' + k + '</div></div>';
      }
      h += '<div style="text-align:center;margin-left:10px">' +
        '<div style="font-size:10.5px;color:#b91c1c;margin-bottom:3px">guard（相邻变量）</div>' +
        '<div style="width:92px;height:44px;display:grid;place-items:center;border-radius:7px;font-family:Consolas,monospace;font-size:12px;' +
        'border:2px dashed ' + (i >= 4 ? '#dc2626' : '#fca5a5') + ';background:' + (i >= 4 ? '#fef2f2' : '#fff') + ';color:#7f1d1d">' +
        guard.toString(16).toUpperCase().padStart(8, '0') + '</div>' +
        '<div style="font-size:10px;color:#94a3b8;margin-top:2px">0x1004</div></div>';
      h += '</div>';
      canvas.innerHTML = h;
      out.textContent = log.length ? log.join('\n') : '还没有写入。拖动下标到 4 或更大，再点“写入”。';
    }
    function write() {
      var i = parseInt(idx.value, 10);
      var v = parseInt(val.value, 10);
      if (isNaN(v)) { out.textContent = '写入值必须是整数。'; return; }
      if (i >= 0 && i < 4) {
        buf[i] = v;
        log.push('buf[' + i + '] = ' + v + '  ✓ 在数组范围内。');
      } else {
        guard = v;
        log.push('buf[' + i + '] = ' + v + '  ⚠ 越界！真实程序里这是未定义行为，');
        log.push('   这里只是示意：紧挨着的 guard 被改成了 ' + v + '。');
      }
      if (log.length > 8) log = log.slice(-8);
      render();
    }
    on($('arrWrite'), 'click', write);
    on($('arrReset'), 'click', function () { buf = [0, 0, 0, 0]; guard = 0x11223344; log = []; idx.value = 0; $('arrIdxVal').textContent = '0'; render(); });
    on(idx, 'input', function () { $('arrIdxVal').textContent = idx.value; render(); });
    render();
  })();

  /* ---------- 7. 指针遍历 ---------- */
  (function () {
    var canvas = $('ptrCanvas'), out = $('ptrOut');
    if (!canvas || !out) return;
    var arr = [10, 20, 30, 40, 50], base = 0x1000, i = 0;
    function render() {
      var h = '<div style="display:flex;gap:6px;flex-wrap:wrap">';
      for (var k = 0; k < arr.length; k++) {
        var on = k === i;
        h += '<div style="text-align:center">' +
          '<div style="height:18px;font-size:14px;color:#3b5bdb">' + (on ? '▲' : '') + '</div>' +
          '<div style="width:66px;height:46px;display:grid;place-items:center;border-radius:7px;font-family:Consolas,monospace;font-size:13px;' +
          'border:2px solid ' + (on ? '#3b5bdb' : '#cbd5e1') + ';background:' + (on ? '#eef2ff' : '#fff') + ';color:#0f172a">' + arr[k] + '</div>' +
          '<div style="font-size:10px;color:#94a3b8;margin-top:2px">0x' + (base + k * 4).toString(16).toUpperCase() + '</div></div>';
      }
      h += '<div style="text-align:center">' +
        '<div style="height:18px;font-size:11px;color:#64748b">p</div>' +
        '<div style="width:66px;height:46px;display:grid;place-items:center;border-radius:7px;font-family:Consolas,monospace;font-size:11px;' +
        'border:2px solid ' + (i === 5 ? '#dc2626' : '#0f766e') + ';background:' + (i === 5 ? '#fef2f2' : '#ecfdf5') + ';color:#065f46">' +
        '0x' + (base + i * 4).toString(16).toUpperCase() + '</div>' +
        '<div style="font-size:10px;color:#94a3b8;margin-top:2px">' + (i === 5 ? '尾后' : 'p') + '</div></div>';
      h += '</div>';
      canvas.innerHTML = h;
      var lines = ['p     = 0x' + (base + i * 4).toString(16).toUpperCase() + '   （a + ' + i + '）'];
      if (i < 5) {
        lines.push('*p    = ' + arr[i]);
        lines.push('p - a = ' + i + '  → 相隔 ' + i + ' 个元素，' + i * 4 + ' 字节');
      } else {
        lines.push('*p    = 未定义行为：这是数组末尾的后一个位置，只能比较，不能解引用');
      }
      out.textContent = lines.join('\n');
    }
    on($('ptrNext'), 'click', function () { if (i < 5) i++; render(); });
    on($('ptrPrev'), 'click', function () { if (i > 0) i--; render(); });
    on($('ptrReset'), 'click', function () { i = 0; render(); });
    render();
  })();

  /* ---------- 8. 数组退化 ---------- */
  (function () {
    var canvas = $('decayCanvas'), out = $('decayOut'), ctl = document.querySelector('[data-decay]');
    if (!canvas || !out) return;
    var cur = 'a';
    var data = {
      a: {
        title: 'int a[5] = {1,2,3,4,5};', type: 'int[5]', size: '20 字节（5 × 4）',
        assign: '不能赋值：a = p 编译错误', addr: '&a 的类型是 int (*)[5]',
        note: 'a 是一个数组对象，本身占 20 字节。'
      },
      p: {
        title: 'int *p = a;', type: 'int *', size: '8 字节（一个指针）',
        assign: '可以赋值：p = a 或 p = &x', addr: '&p 的类型是 int **',
        note: 'p 是一个指针对象，只占 8 字节，另有所指。'
      }
    };
    function render() {
      var d = data[cur];
      var rows = [
        ['表达式', cur],
        ['类型', d.type],
        ['sizeof', d.size],
        ['可赋值性', d.assign],
        ['取地址', d.addr]
      ];
      var h = '<div style="font-family:Consolas,monospace;font-size:12px">' +
        '<div style="color:#0f172a;font-weight:700;margin-bottom:7px">' + d.title + '</div>';
      rows.forEach(function (r) {
        h += '<div style="display:flex;gap:10px;padding:3px 0;border-bottom:1px dashed #dbe4f3">' +
          '<span style="min-width:88px;color:#64748b">' + r[0] + '</span>' +
          '<span style="color:#1e293b">' + r[1] + '</span></div>';
      });
      h += '</div>';
      canvas.innerHTML = h;
      out.textContent = d.note + '\n数组名在 sizeof、&、字符串初始化这三种场合不会退化。';
    }
    Array.prototype.forEach.call(document.querySelectorAll('[data-decay]'), function (b) {
      b.addEventListener('click', function () {
        cur = b.getAttribute('data-decay');
        Array.prototype.forEach.call(document.querySelectorAll('[data-decay]'), function (x) {
          x.classList.toggle('pri', x === b);
        });
        render();
      });
    });
    render();
  })();

  /* ---------- 9. 堆分配 ---------- */
  (function () {
    var canvas = $('heapCanvas'), out = $('heapOut'), ctl = document.querySelector('[data-heap]');
    if (!canvas || !out) return;
    var st, logs;
    function reset() {
      st = { a: null, b: null };
      logs = ['堆初始为空。pa、pb 都是未初始化的指针（野指针）。'];
      render();
    }
    function render() {
      var h = '<div style="display:flex;gap:12px;flex-wrap:wrap">';
      ['a', 'b'].forEach(function (k) {
        var blk = st[k];
        var alive = blk && blk.alive;
        h += '<div style="flex:1 1 180px;border:1px solid ' + (alive ? '#86efac' : '#e2e8f0') + ';background:' + (alive ? '#f0fdf4' : '#f8fafc') +
          ';border-radius:9px;padding:9px 11px">' +
          '<div style="font-size:11px;color:#64748b">堆块 ' + k.toUpperCase() + '</div>' +
          '<div style="font-family:Consolas,monospace;font-size:12px;color:' + (alive ? '#166534' : '#94a3b8') + ';margin-top:3px">' +
          (blk ? (alive ? '已分配 · 16 字节 · 值 ' + blk.val : '已释放（内存已归还）') : '不存在') + '</div></div>';
      });
      h += '<div style="flex:1 1 180px;border:1px dashed #cbd5e1;border-radius:9px;padding:9px 11px;background:#fff">' +
        '<div style="font-size:11px;color:#64748b">指针变量</div>' +
        '<div style="font-family:Consolas,monospace;font-size:12px;color:#1e293b;margin-top:3px">' +
        'pa = ' + (st.a ? (st.a.alive ? '&A' : '&A（悬空）') : 'NULL') + '<br>' +
        'pb = ' + (st.b ? (st.b.alive ? '&B' : '&B（悬空）') : 'NULL') + '</div></div>';
      h += '</div>';
      canvas.innerHTML = h;
      out.textContent = logs.slice(-6).join('\n');
    }
    function log(s) { logs.push(s); if (logs.length > 12) logs.shift(); }
    on(ctl, 'click', function (e) {
      var b = e.target.closest('[data-heap]');
      if (!b) return;
      var act = b.getAttribute('data-heap');
      if (act === 'reset') { reset(); return; }
      if (act === 'allocA') {
        if (st.a) { log('A 已经分配过了，先 free 再分配，否则旧块就泄漏了。'); }
        else { st.a = { alive: true, val: 0 }; log('pa = malloc(16) → 得到块 A。'); }
      } else if (act === 'allocB') {
        if (st.b) { log('B 已经分配过了。'); }
        else { st.b = { alive: true, val: 0 }; log('pb = malloc(16) → 得到块 B。'); }
      } else if (act === 'freeA') {
        if (!st.a) { log('A 还没分配，free(NULL) 是安全的，但这里什么也不会发生。'); }
        else if (!st.a.alive) { log('⚠ 双重释放：A 已经释放过了，再 free 是未定义行为。'); }
        else { st.a.alive = false; log('free(pa)：块 A 归还给堆管理器。pa 现在是悬空指针。'); }
      } else if (act === 'freeB') {
        if (!st.b) { log('B 还没分配。'); }
        else if (!st.b.alive) { log('⚠ 双重释放。'); }
        else { st.b.alive = false; log('free(pb)：块 B 已释放。'); }
      } else if (act === 'writeA') {
        if (!st.a) { log('⚠ pa 是野指针/空指针，写入会崩溃。'); }
        else if (!st.a.alive) { log('⚠ *pa = 42：写入已释放的内存，属于释放后使用（未定义行为）。'); }
        else { st.a.val = 42; log('*pa = 42：正常写入块 A。'); }
      }
      render();
    });
    reset();
  })();

  /* ---------- 10. 链表 ---------- */
  (function () {
    var canvas = $('listCanvas'), out = $('listOut');
    if (!canvas || !out) return;
    var nodes, msg;
    function reset() {
      nodes = [{ v: 10 }, { v: 20 }, { v: 30 }];
      msg = '初始链表：10 → 20 → 30 → NULL。head 指向 10。';
      render();
    }
    function render() {
      var h = '<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;font-family:Consolas,monospace;font-size:12px">' +
        '<span style="color:#3b5bdb;font-weight:700">head</span><span style="color:#3b5bdb">→</span>';
      nodes.forEach(function (n, i) {
        h += '<span style="display:inline-flex;border:1.5px solid #a5b4fc;border-radius:7px;overflow:hidden;background:#fff">' +
          '<span style="padding:7px 10px;background:#eef2ff;color:#1e293b;font-weight:700">' + n.v + '</span>' +
          '<span style="padding:7px 6px;color:#64748b;border-left:1px solid #c7d2fe;font-size:10px">next</span></span>';
        h += '<span style="color:#64748b">→</span>';
      });
      h += '<span style="color:#b91c1c;font-weight:700">NULL</span></div>';
      h += '<div style="font-size:11px;color:#64748b;margin-top:6px">共 ' + nodes.length + ' 个节点；每个节点都是单独 malloc 出来的。</div>';
      canvas.innerHTML = h;
      out.textContent = msg;
    }
    document.querySelectorAll('[data-list]').forEach(function (b) {
      b.addEventListener('click', function () {
        var act = b.getAttribute('data-list');
        if (act === 'head') {
          nodes.unshift({ v: 5 });
          msg = '头插 5：新节点 next 指向原 head，再让 head 指向新节点。O(1)。';
        } else if (act === 'mid') {
          var idx = nodes.findIndex(function (n) { return n.v === 20; });
          if (idx < 0) { msg = '找不到 20，无法插入。'; }
          else { nodes.splice(idx + 1, 0, { v: 25 }); msg = '在 20 后插入 25：先让 25.next = 20.next，再让 20.next = 25。顺序不能反。'; }
        } else if (act === 'del') {
          var k = nodes.findIndex(function (n) { return n.v === 20; });
          if (k < 0) { msg = '找不到 20，可能已经删过了。'; }
          else { nodes.splice(k, 1); msg = '删除 20：让前驱 10 的 next 指向 30，然后 free 掉 20。'; }
        } else { reset(); return; }
        render();
      });
    });
    reset();
  })();
})();
