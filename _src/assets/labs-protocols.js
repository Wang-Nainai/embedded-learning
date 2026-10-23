/* 第 4 册交互实验 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }
  function hex2(n) { return n.toString(16).toUpperCase().padStart(2, '0'); }

  /* ---------- 1. UART 帧 ---------- */
  (function () {
    var canvas = $('uartCanvas'), out = $('uartOut');
    if (!canvas || !out) return;
    function run() {
      var baud = parseInt($('uartBaud').value, 10);
      var dataBits = parseInt($('uartData').value, 10);
      var parity = $('uartParity').value;
      var stop = parseInt($('uartStop').value, 10);
      var raw = ($('uartByte').value || '0').trim().toLowerCase().replace(/^0x/, '');
      var byte = parseInt(raw, 16);
      if (isNaN(byte)) { out.textContent = '字节请填 0x00–0xFF。'; return; }
      byte = byte & ((1 << dataBits) - 1);        /* 7 位模式只看低 7 位 */

      var bits = [];
      bits.push({ v: 0, label: '起始', kind: 'start' });
      for (var i = 0; i < dataBits; i++) {
        bits.push({ v: (byte >> i) & 1, label: 'D' + i, kind: 'data' });
      }
      var ones = 0;
      for (var k = 0; k < dataBits; k++) ones += (byte >> k) & 1;
      if (parity !== 'N') {
        var p = parity === 'E' ? (ones % 2) : (1 - (ones % 2));
        bits.push({ v: p, label: '校验', kind: 'parity' });
      }
      for (var s = 0; s < stop; s++) bits.push({ v: 1, label: '停止', kind: 'stop' });

      var h = '<div style="display:flex;gap:2px;flex-wrap:wrap;align-items:flex-end">';
      h += '<div style="text-align:center"><div style="height:16px"></div><div style="width:30px;height:34px;display:grid;place-items:center;border-radius:4px;background:#f1f5f9;border:1px solid #cbd5e1;font-size:10px;color:#64748b">空闲</div><div style="font-size:9px;color:#94a3b8">1</div></div>';
      bits.forEach(function (b, i) {
        var bg = b.kind === 'start' ? '#fef3c7' : b.kind === 'stop' ? '#dcfce7' : b.kind === 'parity' ? '#f5f3ff' : '#e0e7ff';
        var bd = b.kind === 'start' ? '#fbbf24' : b.kind === 'stop' ? '#4ade80' : b.kind === 'parity' ? '#c4b5fd' : '#818cf8';
        h += '<div style="text-align:center">' +
          '<div style="height:16px;font-size:9px;color:#64748b">' + b.label + '</div>' +
          '<div style="width:34px;height:34px;display:grid;place-items:center;border-radius:4px;font-family:Consolas,monospace;font-size:13px;font-weight:700;background:' + bg + ';border:1px solid ' + bd + ';color:#1e293b">' + b.v + '</div>' +
          '<div style="font-size:9px;color:#94a3b8">' + (i + 1) + '</div></div>';
      });
      h += '</div>';
      canvas.innerHTML = h;

      var total = bits.length;
      var frameUs = total / baud * 1e6;
      var maxBytes = baud / total;
      out.textContent = [
        '配置          ' + baud + ' ' + dataBits + parity + stop,
        '一帧位数      ' + total + ' 位',
        '位时间        ' + (1e6 / baud).toFixed(2) + ' µs',
        '一帧时间      ' + frameUs.toFixed(2) + ' µs',
        '理论吞吐      ' + Math.floor(maxBytes).toFixed(0) + ' 字节/秒',
        '字节值        0x' + hex2(byte) + '  (' + bits.filter(function (b) { return b.kind === 'data' && b.v; }).length + ' 个 1)'
      ].join('\n');
    }
    ['change', 'input'].forEach(function (ev) {
      on($('uartBaud'), ev, run); on($('uartData'), ev, run);
      on($('uartParity'), ev, run); on($('uartStop'), ev, run); on($('uartByte'), ev, run);
    });
    run();
  })();

  /* ---------- 2. SPI 波形 ---------- */
  (function () {
    var canvas = $('spiCanvas'), out = $('spiOut');
    if (!canvas || !out) return;
    var mode = 0;
    var VALUE = 0xA5;
    function render() {
      var cpol = (mode >> 1) & 1, cpha = mode & 1;
      var W = 760, LEFT = 54, LEAD = 30, BITW = 80, H = 190, YCLK = 58, YDAT = 132;
      var idle = cpol ? 18 : 0;
      var x0 = function (i) { return LEFT + LEAD + i * BITW; };

      /* 时钟：先保持空闲，再逐位产生一个完整脉冲 */
      var pts = [LEFT + ',' + (YCLK - idle)];
      pts.push((LEFT + LEAD) + ',' + (YCLK - idle));
      for (var i = 0; i < 8; i++) {
        var a = x0(i), m = a + BITW / 2;
        var active = cpol ? 0 : 18;
        pts.push(a + ',' + (YCLK - idle));
        pts.push(a + ',' + (YCLK - active));
        pts.push(m + ',' + (YCLK - active));
        pts.push(m + ',' + (YCLK - idle));
      }
      pts.push((x0(7) + BITW) + ',' + (YCLK - idle));

      /* 数据：CPHA=0 在边沿前建立，CPHA=1 在第一个边沿变化 */
      var bitAt = function (b) { return (VALUE >> (7 - b)) & 1; };
      var y0 = YDAT - bitAt(0) * 18;
      var d = 'M ' + LEFT + ' ' + y0;
      var prevY = y0;
      for (var b = 0; b < 8; b++) {
        var sx = x0(b) + (cpha ? 0 : -6);
        var ex = sx + BITW;
        var y = YDAT - bitAt(b) * 18;
        d += ' L ' + sx + ' ' + prevY;
        d += ' L ' + sx + ' ' + y;
        d += ' L ' + ex + ' ' + y;
        prevY = y;
      }

      var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" font-family="Segoe UI, Microsoft YaHei, sans-serif">' +
        '<rect width="' + W + '" height="' + H + '" fill="#fbfdff"/>' +
        '<text x="8" y="' + (YCLK - 4) + '" font-size="11" fill="#475569">SCLK</text>' +
        '<text x="8" y="' + (YDAT - 4) + '" font-size="11" fill="#475569">MOSI</text>' +
        '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#0f766e" stroke-width="1.8"/>' +
        '<path d="' + d + '" fill="none" stroke="#c2410c" stroke-width="1.8"/>';

      for (var i2 = 0; i2 < 8; i2++) {
        var bitv = bitAt(i2);
        var sx2 = cpha ? x0(i2) + BITW / 2 : x0(i2);
        var yv = YDAT - bitv * 18;
        svg += '<circle cx="' + sx2 + '" cy="' + yv + '" r="4" fill="#fff" stroke="#7c3aed" stroke-width="1.6"/>';
        svg += '<text x="' + (x0(i2) + BITW / 2) + '" y="' + (H - 26) + '" font-size="10" fill="#94a3b8" text-anchor="middle">b' + (7 - i2) + '=' + bitv + '</text>';
      }
      svg += '<text x="' + LEFT + '" y="' + (H - 8) + '" font-size="10.5" fill="#7c3aed">○ 采样点</text>';
      svg += '<text x="' + (LEFT + 90) + '" y="' + (H - 8) + '" font-size="10.5" fill="#64748b">CPOL=' + cpol + '  CPHA=' + cpha + '　空闲' + (cpol ? '高' : '低') + '，第 ' + (cpha ? '二' : '一') + ' 个边沿采样</text>';
      svg += '</svg>';
      canvas.innerHTML = svg;
      out.textContent = 'Mode ' + mode + '：CPOL=' + cpol + '，CPHA=' + cpha + '\n' +
        '数据 0x' + hex2(VALUE) + '，MSB 先发。采样点在' + (cpha ? '第二个' : '第一个') + '边沿。';
    }
    document.querySelectorAll('[data-spi]').forEach(function (b) {
      b.addEventListener('click', function () {
        mode = parseInt(b.getAttribute('data-spi'), 10);
        document.querySelectorAll('[data-spi]').forEach(function (x) { x.classList.toggle('pri', x === b); });
        render();
      });
    });
    render();
  })();

  /* ---------- 3. CAN 仲裁 ---------- */
  (function () {
    var canvas = $('canCanvas'), out = $('canOut');
    if (!canvas || !out) return;
    var nodes = [{ id: 0x120, name: 'A' }, { id: 0x230, name: 'B' }, { id: 0x7FF, name: 'C' }];
    var bit = 10, alive, log;
    function reset() {
      bit = 10; alive = [true, true, true]; log = [];
      render();
    }
    function render() {
      var h = '<div style="display:grid;gap:6px;font-family:Consolas,monospace;font-size:11.5px">';
      nodes.forEach(function (n, i) {
        var row = '';
        for (var b = 10; b >= 0; b--) {
          var v = (n.id >> b) & 1;
          var isCur = b === bit;
          row += '<span style="display:inline-grid;place-items:center;width:20px;height:22px;margin-right:2px;border-radius:3px;font-size:10px;border:1px solid ' +
            (isCur ? '#c2410c' : '#cbd5e1') + ';background:' + (v ? '#fff' : '#fef3c7') + ';color:' + (v ? '#64748b' : '#92400e') + ';opacity:' + (alive[i] ? 1 : .35) + '">' + v + '</span>';
        }
        h += '<div><span style="color:#334155;font-weight:700">节点' + n.name + ' 0x' + n.id.toString(16).toUpperCase() + '</span> ' +
          (alive[i] ? '' : '<span style="color:#b91c1c">已退出</span>') + '<br>' + row + '</div>';
      });
      h += '</div>';
      canvas.innerHTML = h;
      out.textContent = log.length ? log.slice(-5).join('\n') : '三个节点同时开始发送。点“下一位”逐位仲裁（从 bit10 到 bit0）。';
    }
    on($('canStep'), 'click', function () {
      if (bit < 0) { out.textContent = '仲裁结束，赢家继续发送数据。'; return; }
      var vals = nodes.map(function (n, i) { return alive[i] ? (n.id >> bit) & 1 : null; });
      var anyZero = vals.some(function (v) { return v === 0; });
      log.push('bit' + bit + '：' + vals.map(function (v, i) { return alive[i] ? nodes[i].name + '=' + v : nodes[i].name + '=退出'; }).join('  '));
      if (anyZero) {
        vals.forEach(function (v, i) {
          if (v === 1) { alive[i] = false; log.push('  → 节点' + nodes[i].name + ' 发 1 读到 0，退出仲裁'); }
        });
      }
      bit--;
      render();
    });
    on($('canReset'), 'click', reset);
    reset();
  })();

  /* ---------- 4. Modbus CRC ---------- */
  (function () {
    var out = $('mbOut');
    if (!out) return;
    function crc16(bytes) {
      var crc = 0xFFFF;
      for (var i = 0; i < bytes.length; i++) {
        crc ^= bytes[i];
        for (var b = 0; b < 8; b++) {
          crc = (crc & 1) ? ((crc >> 1) ^ 0xA001) : (crc >> 1);
        }
      }
      return crc & 0xFFFF;
    }
    function parseHex(s) {
      s = (s || '').trim();
      if (!s) return [];
      return s.split(/[\s,]+/).map(function (x) {
        var v = parseInt(x.replace(/^0x/i, ''), 16);
        return isNaN(v) ? 0 : v & 0xFF;
      });
    }
    function run() {
      var addr = parseHex($('mbAddr').value)[0] || 0;
      var func = parseHex($('mbFunc').value)[0] || 0;
      var data = parseHex($('mbData').value);
      var body = [addr, func].concat(data);
      var crc = crc16(body);
      var frame = body.concat([crc & 0xFF, crc >> 8]);
      out.textContent = [
        '从站地址  0x' + hex2(addr),
        '功能码    0x' + hex2(func),
        '数据      ' + data.map(function (x) { return hex2(x); }).join(' '),
        'CRC16     0x' + crc.toString(16).toUpperCase().padStart(4, '0') + '（低字节先发：' + hex2(crc & 0xFF) + ' ' + hex2(crc >> 8) + '）',
        '',
        '完整帧    ' + frame.map(function (x) { return hex2(x); }).join(' '),
        '字节数    ' + frame.length
      ].join('\n');
    }
    ['input', 'change'].forEach(function (ev) {
      on($('mbAddr'), ev, run); on($('mbFunc'), ev, run); on($('mbData'), ev, run);
    });
    on($('mbGo'), 'click', run);
    run();
  })();

  /* ---------- 5. 帧解析状态机 ---------- */
  (function () {
    var canvas = $('frCanvas'), out = $('frOut');
    if (!canvas || !out) return;
    var MAXP = 32, bytes = [], pos = 0;
    var st = { state: 'SOF1', type: 0, seq: 0, len: 0, idx: 0, pl: [], crc: 0, crcLo: 0 };
    var lastMsg = '';
    var names = ['SOF1', 'SOF2', 'TYPE', 'SEQ', 'LEN', 'PAYLOAD', 'CRC_LO', 'CRC_HI'];
    function crc16(arr) {
      var crc = 0xFFFF;
      for (var i = 0; i < arr.length; i++) {
        crc ^= arr[i];
        for (var b = 0; b < 8; b++) crc = (crc & 1) ? ((crc >> 1) ^ 0xA001) : (crc >> 1);
      }
      return crc & 0xFFFF;
    }
    function load() {
      bytes = (($('frInput').value || '').trim().split(/[\s,]+/)).map(function (x) {
        var v = parseInt(x.replace(/^0x/i, ''), 16);
        return isNaN(v) ? 0 : v & 0xFF;
      });
      pos = 0;
      lastMsg = '';
      st = { state: 'SOF1', type: 0, seq: 0, len: 0, idx: 0, pl: [], crc: 0, crcLo: 0 };
      render('已载入 ' + bytes.length + ' 个字节。');
    }
    function feed(b) {
      var msg = '';
      switch (st.state) {
        case 'SOF1':
          if (b === 0xAA) st.state = 'SOF2'; else msg = '等待帧头 0xAA';
          break;
        case 'SOF2':
          if (b === 0x55) { st.state = 'TYPE'; msg = '帧头匹配'; }
          else if (b === 0xAA) { msg = '仍是 0xAA，继续等 0x55'; }
          else { st.state = 'SOF1'; msg = '不是 0x55，回到找帧头'; }
          break;
        case 'TYPE': st.type = b; st.state = 'SEQ'; msg = 'type=0x' + hex2(b); break;
        case 'SEQ': st.seq = b; st.state = 'LEN'; msg = 'seq=' + b; break;
        case 'LEN':
          if (b > MAXP) { st.state = 'SOF1'; msg = '长度 ' + b + ' 超过上限，重同步'; }
          else { st.len = b; st.idx = 0; st.pl = []; st.state = b === 0 ? 'CRC_LO' : 'PAYLOAD'; msg = 'len=' + b; }
          break;
        case 'PAYLOAD':
          st.pl.push(b); st.idx++;
          msg = '载荷 ' + st.idx + '/' + st.len;
          if (st.idx >= st.len) st.state = 'CRC_LO';
          break;
        case 'CRC_LO': st.crcLo = b; st.state = 'CRC_HI'; msg = 'CRC 低字节 0x' + hex2(b); break;
        case 'CRC_HI':
          var crc = st.crcLo | (b << 8);
          var calc = crc16([st.type, st.seq, st.len].concat(st.pl));
          st.state = 'SOF1';
          msg = crc === calc ? '✓ CRC 正确，收到完整帧' : '✗ CRC 错（收到 0x' + crc.toString(16).toUpperCase() + '，计算 0x' + calc.toString(16).toUpperCase() + '），丢弃';
          break;
      }
      return msg;
    }
    function render(msg) {
      var h = '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">';
      names.forEach(function (n) {
        var on = st.state === n;
        h += '<span style="padding:4px 7px;border-radius:5px;font-family:Consolas,monospace;font-size:10.5px;border:1px solid ' +
          (on ? '#c2410c' : '#cbd5e1') + ';background:' + (on ? '#fff7ed' : '#fff') + ';color:' + (on ? '#9a3412' : '#64748b') + '">' + n + '</span>';
      });
      h += '</div>';
      h += '<div style="font-family:Consolas,monospace;font-size:11px;color:#334155">已处理 ' + pos + ' / ' + bytes.length +
        ' 字节　type=0x' + hex2(st.type) + ' seq=' + st.seq + ' len=' + st.len + ' payload=[' + st.pl.map(function (x) { return hex2(x); }).join(' ') + ']</div>';
      canvas.innerHTML = h;
      out.textContent = msg || lastMsg || '点“下一步”喂入一个字节。';
    }
    on($('frLoad'), 'click', load);
    on($('frStep'), 'click', function () {
      if (pos >= bytes.length) { render(lastMsg ? lastMsg + '\n（字节流已处理完）' : '字节流已处理完。'); return; }
      var b = bytes[pos++];
      var m = feed(b);
      lastMsg = '字节 0x' + hex2(b) + '：' + m;
      render(lastMsg);
    });
    on($('frReset'), 'click', function () { load(); render('已重置。'); });
    load();
  })();
})();
