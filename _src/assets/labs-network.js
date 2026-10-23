/* 第 5 册交互实验 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }
  function ip2int(s) {
    var p = s.trim().split('.');
    if (p.length !== 4) return null;
    var n = 0;
    for (var i = 0; i < 4; i++) {
      var v = parseInt(p[i], 10);
      if (isNaN(v) || v < 0 || v > 255) return null;
      n = (n * 256) + v;
    }
    return n >>> 0;
  }
  function int2ip(n) {
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  }
  function bin8(n) { return (n & 255).toString(2).padStart(8, '0'); }

  /* ---------- 1. 封装 ---------- */
  (function () {
    var canvas = $('encapCanvas'), out = $('encapOut');
    if (!canvas || !out) return;
    var step = 0, dir = 'send';
    var layers = [
      { name: '应用数据', color: '#e0e7ff', border: '#818cf8', text: '#26348f', desc: 'HTTP / MQTT 消息' },
      { name: 'TCP 头', color: '#dcfce7', border: '#4ade80', text: '#166534', desc: '端口、序号、确认号、窗口' },
      { name: 'IP 头', color: '#fef3c7', border: '#fbbf24', text: '#92400e', desc: '源/目的 IP、TTL、协议' },
      { name: '以太网头', color: '#ede9fe', border: '#c4b5fd', text: '#5b21b6', desc: '源/目的 MAC、类型' }
    ];
    function render() {
      var n = dir === 'send' ? step : 4 - step;
      var h = '<div style="display:flex;flex-wrap:wrap;align-items:stretch;gap:2px">';
      for (var i = 0; i < 4; i++) {
        var show = i >= 4 - n;
        if (!show) continue;
        var L = layers[i];
        h += '<div style="flex:1 1 110px;min-width:90px;padding:9px 7px;border:1px solid ' + L.border + ';background:' + L.color + ';border-radius:6px;text-align:center">' +
          '<div style="font-size:11.5px;font-weight:700;color:' + L.text + '">' + L.name + '</div>' +
          '<div style="font-size:9.5px;color:#475569;margin-top:3px;line-height:1.4">' + L.desc + '</div></div>';
      }
      h += '</div>';
      canvas.innerHTML = h;
      var msg = dir === 'send'
        ? ['应用层产生数据 "Hello"', '传输层加 TCP 头（端口/序号）', '网络层加 IP 头（地址/TTL）', '链路层加以太网头与 FCS，发出'][step]
        : ['收到帧，链路层校验 FCS 并剥掉以太网头', '网络层检查目的 IP，剥掉 IP 头', '传输层按端口交付，剥掉 TCP 头', '应用层拿到 "Hello"'][step];
      out.textContent = (dir === 'send' ? '封装 ' : '解封装 ') + step + '/4\n' + msg;
    }
    function advance(d) {
      if (d !== dir) { dir = d; step = 0; }
      step = Math.min(4, step + 1);
      render();
    }
    on($('encapSend'), 'click', function () { advance('send'); });
    on($('encapRecv'), 'click', function () { advance('recv'); });
    on($('encapReset'), 'click', function () { dir = 'send'; step = 0; render(); });
    render();
  })();

  /* ---------- 2. 子网 ---------- */
  (function () {
    var out = $('snOut');
    if (!out) return;
    function run() {
      var ip = ip2int($('snIp').value);
      var p = parseInt($('snPrefix').value, 10);
      if (ip === null || isNaN(p) || p < 0 || p > 32) { out.textContent = '请输入合法的 IPv4 地址与 0–32 的前缀。'; return; }
      var mask = p === 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0;
      var net = (ip & mask) >>> 0;
      var bcast = (net | (~mask >>> 0)) >>> 0;
      var count = Math.pow(2, 32 - p);
      var usable = p >= 31 ? count : Math.max(0, count - 2);
      var first = p >= 31 ? net : net + 1;
      var last = p >= 31 ? bcast : bcast - 1;
      out.textContent = [
        'IP          ' + int2ip(ip) + '   ' + [24, 16, 8, 0].map(function (s) { return bin8(ip >>> s); }).join(' '),
        '掩码 /' + p + '    ' + int2ip(mask) + '   ' + [24, 16, 8, 0].map(function (s) { return bin8(mask >>> s); }).join(' '),
        '网络地址    ' + int2ip(net),
        '广播地址    ' + int2ip(bcast),
        '可用范围    ' + int2ip(first) + ' – ' + int2ip(last),
        '地址总数    ' + count,
        '可用主机    ' + usable,
        '',
        p <= 30 ? '前 ' + p + ' 位是网络号，后 ' + (32 - p) + ' 位是主机号。' : '点对点/单主机特殊前缀，规则与常规子网不同。'
      ].join('\n');
    }
    ['input', 'change'].forEach(function (ev) { on($('snIp'), ev, run); on($('snPrefix'), ev, run); });
    on($('snGo'), 'click', run);
    run();
  })();

  /* ---------- 3. 路由 ---------- */
  (function () {
    var canvas = $('routeCanvas'), out = $('routeOut');
    if (!canvas || !out) return;
    var hops = [
      { from: 'PC 192.168.1.10', to: '网关 192.168.1.1', smac: 'AA:PC', dmac: 'AA:GW', ttl: 64, note: 'PC 查路由：目的不在本子网，交给默认网关' },
      { from: '路由器 R1', to: '路由器 R2', smac: 'BB:R1', dmac: 'BB:R2', ttl: 63, note: 'R1 查表：下一跳 R2，改 MAC，TTL-1' },
      { from: '路由器 R2', to: '服务器 10.0.0.5', smac: 'CC:R2', dmac: 'CC:SRV', ttl: 62, note: 'R2 发现目的在本子网，ARP 服务器，最后一跳' },
      { from: '服务器', to: '应用', smac: '—', dmac: '—', ttl: 62, note: '逐层解封装，数据交给应用' }
    ];
    var i = 0;
    function render() {
      var h = '<div style="display:grid;gap:5px;font-family:Consolas,monospace;font-size:11px">';
      hops.forEach(function (hp, k) {
        var on = k === i;
        h += '<div style="padding:6px 8px;border-radius:6px;border:1px solid ' + (on ? '#0369a1' : '#e2e8f0') +
          ';background:' + (on ? '#f0f9ff' : '#fff') + ';color:' + (k > i ? '#94a3b8' : '#334155') + '">' +
          '<b>' + hp.from + ' → ' + hp.to + '</b><br>' +
          'srcMAC=' + hp.smac + '  dstMAC=' + hp.dmac + '  TTL=' + hp.ttl + '</div>';
      });
      h += '</div>';
      canvas.innerHTML = h;
      out.textContent = '第 ' + i + ' 跳\n' + hops[i].note + '\n（源/目的 IP 始终是 192.168.1.10 → 10.0.0.5）';
    }
    on($('routeStep'), 'click', function () { if (i < hops.length - 1) i++; render(); });
    on($('routeReset'), 'click', function () { i = 0; render(); });
    render();
  })();

  /* ---------- 4. TCP ---------- */
  (function () {
    var canvas = $('tcpCanvas'), out = $('tcpOut');
    if (!canvas || !out) return;
    var steps = [
      { c: 'CLOSED', s: 'LISTEN', pkt: '客户端准备连接', seq: '—', ack: '—' },
      { c: 'SYN_SENT', s: 'LISTEN', pkt: '① SYN seq=x', seq: 'x=1000', ack: '—' },
      { c: 'SYN_SENT', s: 'SYN_RCVD', pkt: '② SYN+ACK seq=y ack=x+1', seq: 'y=5000', ack: '1001' },
      { c: 'ESTABLISHED', s: 'ESTABLISHED', pkt: '③ ACK ack=y+1', seq: '1001', ack: '5001' },
      { c: 'ESTABLISHED', s: 'ESTABLISHED', pkt: '④ 数据 500 字节', seq: '1001–1500', ack: '5001' },
      { c: 'ESTABLISHED', s: 'ESTABLISHED', pkt: '⑤ ACK 1501', seq: '5001', ack: '1501' },
      { c: 'FIN_WAIT_1', s: 'ESTABLISHED', pkt: '⑥ FIN seq=1501', seq: '1501', ack: '5001' },
      { c: 'FIN_WAIT_2', s: 'CLOSE_WAIT', pkt: '⑦ ACK 1502', seq: '5001', ack: '1502' },
      { c: 'FIN_WAIT_2', s: 'LAST_ACK', pkt: '⑧ FIN seq=5001', seq: '5001', ack: '1502' },
      { c: 'TIME_WAIT', s: 'CLOSED', pkt: '⑨ ACK 5002', seq: '1502', ack: '5002' }
    ];
    var i = 0;
    function render() {
      var st = steps[i];
      var h = '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<div style="flex:1 1 120px;border:1px solid #bae6fd;background:#f0f9ff;border-radius:8px;padding:8px 10px">' +
        '<div style="font-size:10.5px;color:#64748b">客户端状态</div><div style="font-family:Consolas,monospace;font-size:12px;color:#075985;font-weight:700">' + st.c + '</div></div>' +
        '<div style="flex:2 1 220px;border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:8px 10px">' +
        '<div style="font-size:10.5px;color:#64748b">当前报文</div><div style="font-family:Consolas,monospace;font-size:12px;color:#1e293b">' + st.pkt + '</div></div>' +
        '<div style="flex:1 1 120px;border:1px solid #bae6fd;background:#f0f9ff;border-radius:8px;padding:8px 10px">' +
        '<div style="font-size:10.5px;color:#64748b">服务器状态</div><div style="font-family:Consolas,monospace;font-size:12px;color:#075985;font-weight:700">' + st.s + '</div></div>' +
        '</div>';
      canvas.innerHTML = h;
      out.textContent = '步骤 ' + i + '/' + (steps.length - 1) + '\nseq=' + st.seq + '   ack=' + st.ack;
    }
    on($('tcpStep'), 'click', function () { if (i < steps.length - 1) i++; render(); });
    on($('tcpReset'), 'click', function () { i = 0; render(); });
    render();
  })();

  /* ---------- 5. MQTT ---------- */
  (function () {
    var canvas = $('mqCanvas'), out = $('mqOut');
    if (!canvas || !out) return;
    var subs = [], retained = null, log = [], online = true, msgId = 0;
    function render() {
      var h = '<div style="display:grid;gap:6px;font-family:Consolas,monospace;font-size:11px">' +
        '<div style="padding:7px 9px;border:1px solid #fbbf24;background:#fffbeb;border-radius:6px;color:#92400e">Broker　retained=' +
        (retained ? '"' + retained + '"' : '空') + '</div>' +
        '<div style="padding:7px 9px;border:1px solid #cbd5e1;background:#fff;border-radius:6px;color:#334155">订阅者：' +
        (subs.length ? subs.map(function (s, i) { return 'S' + (i + 1) + (s.online ? '' : '(离线)'); }).join('　') : '（暂无）') + '</div>' +
        '<div style="padding:7px 9px;border:1px solid #cbd5e1;background:' + (online ? '#f0fdf4' : '#fef2f2') + ';border-radius:6px;color:' + (online ? '#166534' : '#991b1b') + '">发布者：' + (online ? '在线' : '已掉线') + '</div>' +
        '</div>';
      canvas.innerHTML = h;
      out.textContent = log.length ? log.slice(-7).join('\n') : '选择一个 QoS，点“发布”。';
    }
    function push(s) { log.push(s); if (log.length > 20) log.shift(); }
    on($('mqPub'), 'click', function () {
      if (!online) { push('⚠ 发布者已掉线，无法发布（Broker 将发送遗嘱消息）'); render(); return; }
      var q = $('mqQos').value;
      var payload = '{"temp":' + (20 + Math.floor(Math.random() * 8)) + '}';
      msgId++;
      push('PUBLISH qos=' + q + ' id=' + msgId + ' payload=' + payload);
      if (q === '1') push('  → Broker 回 PUBACK（可能重复投递）');
      if (q === '2') {
        push('  → Broker 回 PUBREC');
        push('  → 发布者回 PUBREL');
        push('  → Broker 回 PUBCOMP（恰好一次）');
      }
      if ($('mqRetain').checked) { retained = payload; push('  → 标记 retained，Broker 保存最后一条'); }
      subs.forEach(function (s, i) {
        if (s.online) push('  → 投递给 S' + (i + 1) + '：' + payload);
        else push('  → S' + (i + 1) + ' 离线，按会话设置决定是否缓存');
      });
      render();
    });
    on($('mqSub'), 'click', function () {
      subs.push({ online: true });
      push('新订阅者 S' + subs.length + ' 订阅 device/+/telemetry');
      if (retained) push('  → 立即收到 retained 消息：' + retained);
      render();
    });
    on($('mqDrop'), 'click', function () {
      online = false;
      push('发布者异常断开 → Broker 发布遗嘱：device/esp32-001/status = offline');
      render();
    });
    on($('mqOnline'), 'click', function () {
      online = true;
      push('发布者重新连接 Broker（Clean Session 按配置决定是否恢复订阅）');
      render();
    });
    on($('mqReset'), 'click', function () {
      subs = []; retained = null; log = []; online = true; msgId = 0;
      render();
    });
    render();
  })();
})();
