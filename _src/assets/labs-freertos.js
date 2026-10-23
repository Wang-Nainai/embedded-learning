/* 第 3 册交互实验 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- 调度时间轴 ---------- */
  (function () {
    var canvas = $('schedCanvas'), out = $('schedOut'), tickEl = $('schedTick');
    if (!canvas || !out) return;
    var TICKS = 16;
    var tasks = [
      { name: 'H', prio: 3, color: '#7c3aed', light: '#ede9fe', releases: [0, 4, 8, 12], exec: 1 },
      { name: 'M', prio: 2, color: '#0f766e', light: '#ecfdf5', releases: [0, 8], exec: 2 },
      { name: 'L', prio: 1, color: '#b45309', light: '#fffbeb', releases: null, exec: 1 }
    ];
    var state = [], t = 0, timer = null;
    function reset() {
      if (timer) { clearInterval(timer); timer = null; }
      state = tasks.map(function (x) { return { remain: 0 }; });
      t = 0;
      $('schedPlay').textContent = '播放';
      render();
    }
    function step() {
      if (t >= TICKS) return false;
      /* 释放 */
      tasks.forEach(function (task, i) {
        if (task.releases === null) { state[i].remain = 1; return; }
        if (task.releases.indexOf(t) >= 0) state[i].remain = task.exec;
      });
      /* 选最高优先级且剩余执行 > 0 */
      var pick = -1;
      for (var i = 0; i < tasks.length; i++) {
        if (state[i].remain > 0 && (pick < 0 || tasks[i].prio > tasks[pick].prio)) pick = i;
      }
      state.forEach(function (s, i) { s.lastRun = (i === pick); });
      if (pick >= 0) state[pick].remain--;
      state.ranAt = state.ranAt || [];
      state.ranAt[t] = pick;
      t++;
      render();
      return t < TICKS;
    }
    function render() {
      var h = '<div style="overflow-x:auto"><div style="display:grid;grid-template-columns:44px repeat(' + TICKS + ',1fr);gap:2px;min-width:520px;font-size:10px">';
      h += '<div></div>';
      for (var k = 0; k < TICKS; k++) h += '<div style="text-align:center;color:#94a3b8">' + k + '</div>';
      tasks.forEach(function (task, i) {
        h += '<div style="font-family:Consolas,monospace;color:' + task.color + ';font-weight:700;display:flex;align-items:center">' + task.name + '</div>';
        for (var k = 0; k < TICKS; k++) {
          var run = state.ranAt && state.ranAt[k] === i;
          var cur = k === t - 1;
          h += '<div title="t=' + k + '" style="height:24px;border-radius:3px;background:' + (run ? task.color : task.light) +
            ';border:1px solid ' + (cur ? '#0f172a' : 'transparent') + '"></div>';
        }
      });
      h += '<div style="color:#64748b;display:flex;align-items:center">idle</div>';
      for (var k2 = 0; k2 < TICKS; k2++) {
        var idle = state.ranAt && state.ranAt[k2] === -1;
        h += '<div style="height:24px;border-radius:3px;background:' + (idle ? '#cbd5e1' : '#f1f5f9') + '"></div>';
      }
      h += '</div></div>';
      canvas.innerHTML = h;
      if (tickEl) tickEl.textContent = 't = ' + t;
      var last = t > 0 && state.ranAt ? state.ranAt[t - 1] : -2;
      out.textContent = t === 0 ? '尚未开始。H 和 M 在 t=0 同时释放，H 优先级更高，先运行。' :
        (last >= 0 ? 't=' + (t - 1) + ' 运行的是 ' + tasks[last].name + '（优先级 ' + tasks[last].prio + '）。' :
          't=' + (t - 1) + ' 没有就绪任务，运行 idle。') +
        (t >= TICKS ? '\n16 个 tick 结束：H 每 4 tick 占 1 tick，M 被 H 抢占，L 只在空隙运行。' : '');
    }
    $('schedStep').addEventListener('click', function () {
      if (timer) { clearInterval(timer); timer = null; $('schedPlay').textContent = '播放'; }
      step();
    });
    $('schedReset').addEventListener('click', reset);
    $('schedPlay').addEventListener('click', function () {
      if (timer) { clearInterval(timer); timer = null; this.textContent = '播放'; return; }
      if (t >= TICKS) reset();
      this.textContent = '暂停';
      timer = setInterval(function () {
        if (!step()) { clearInterval(timer); timer = null; $('schedPlay').textContent = '播放'; }
      }, 700);
    });
    reset();
  })();

  /* ---------- 队列 ---------- */
  (function () {
    var canvas = $('queueCanvas'), out = $('queueOut');
    if (!canvas || !out) return;
    var CAP = 4, q = [], seq = 0, msg = '队列为空。点 xQueueSend 放入一个元素。';
    function render() {
      var h = '<div style="display:flex;gap:6px;flex-wrap:wrap">';
      for (var i = 0; i < CAP; i++) {
        var has = i < q.length;
        h += '<div style="text-align:center"><div style="font-size:9.5px;color:#94a3b8;margin-bottom:3px">slot ' + i + '</div>' +
          '<div style="width:56px;height:42px;display:grid;place-items:center;border-radius:6px;font-family:Consolas,monospace;font-size:12px;border:1.5px solid ' +
          (has ? '#7c3aed' : '#cbd5e1') + ';background:' + (has ? '#f5f3ff' : '#fff') + ';color:#1e293b">' +
          (has ? q[i] : '·') + '</div></div>';
      }
      h += '</div><div style="font-size:11px;color:#64748b;margin-top:6px">count = ' + q.length + ' / ' + CAP + '</div>';
      canvas.innerHTML = h;
      out.textContent = msg;
    }
    document.querySelectorAll('[data-q]').forEach(function (b) {
      b.addEventListener('click', function () {
        var act = b.getAttribute('data-q');
        if (act === 'send') {
          if (q.length >= CAP) { msg = 'xQueueSend(..., 0) 返回 errQUEUE_FULL：队列已满，元素没有放入。'; }
          else { q.push(++seq); msg = 'xQueueSend 成功，元素 ' + seq + ' 已复制进队列。'; }
        } else if (act === 'recv') {
          if (!q.length) { msg = 'xQueueReceive(..., 0) 返回 pdFALSE：队列为空，没有取到数据。'; }
          else { msg = 'xQueueReceive 取出元素 ' + q.shift() + '，队列长度减一。'; }
        } else { q = []; seq = 0; msg = '已重置。'; }
        render();
      });
    });
    render();
  })();

  /* ---------- 优先级反转 ---------- */
  (function () {
    var canvas = $('invCanvas'), out = $('invOut');
    if (!canvas || !out) return;
    var mode = 'off', idx = 0;
    var scripts = {
      off: [
        ['t0', 'L（优先级 1）运行，取到互斥量'],
        ['t1', 'H（优先级 3）就绪，抢占 L'],
        ['t2', 'H 需要同一把锁，阻塞；L 回到就绪'],
        ['t3', 'M（优先级 2）就绪，抢占 L —— 反转发生'],
        ['t4', 'M 运行很久，H 只能等'],
        ['t5', 'M 结束，L 继续，释放锁'],
        ['t6', 'H 终于拿到锁。H 被 M 间接阻塞了整个 t3–t5']
      ],
      on: [
        ['t0', 'L（优先级 1）运行，取到互斥量'],
        ['t1', 'H（优先级 3）就绪，抢占 L'],
        ['t2', 'H 等锁阻塞；L 继承 H 的优先级，变成 3'],
        ['t3', 'M（优先级 2）就绪，但优先级低于 L，无法抢占'],
        ['t4', 'L 以优先级 3 继续运行，尽快释放锁'],
        ['t5', 'L 释放锁，恢复优先级 1；H 拿到锁'],
        ['t6', 'H 运行，M 稍后才运行。H 的等待时间显著缩短']
      ]
    };
    function render() {
      var sc = scripts[mode];
      var running = mode === 'off'
        ? ['L', 'H', 'L', 'M', 'M', 'L', 'H'][idx]
        : ['L', 'H', 'L', 'L', 'L', 'H', 'H'][idx];
      var lprio = mode === 'on' && idx >= 2 && idx <= 4 ? '3（继承）' : '1';
      var h = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">';
      [['L', '1'], ['M', '2'], ['H', '3']].forEach(function (x) {
        var on = running === x[0];
        h += '<div style="flex:1 1 80px;text-align:center;padding:7px;border-radius:7px;border:1.5px solid ' +
          (on ? '#7c3aed' : '#cbd5e1') + ';background:' + (on ? '#f5f3ff' : '#fff') + ';font-family:Consolas,monospace;font-size:11px;color:' +
          (on ? '#5b21b6' : '#64748b') + '">' + x[0] + '（prio ' + (x[0] === 'L' ? lprio : x[1]) + '）' + (on ? ' ▶' : '') + '</div>';
      });
      h += '</div><div style="display:grid;gap:3px;font-family:Consolas,monospace;font-size:11px">';
      sc.forEach(function (row, i) {
        var on = i === idx;
        h += '<div style="display:flex;gap:8px;padding:3px 6px;border-radius:4px;background:' + (on ? '#f5f3ff' : 'transparent') +
          ';color:' + (on ? '#5b21b6' : i > idx ? '#94a3b8' : '#334155') + '"><span style="min-width:24px;font-weight:700">' + row[0] + '</span><span>' + row[1] + '</span></div>';
      });
      h += '</div>';
      canvas.innerHTML = h;
      out.textContent = '模式：' + (mode === 'on' ? '有优先级继承' : '无优先级继承') + '　步骤 ' + idx + '/' + (sc.length - 1);
    }
    document.querySelectorAll('[data-inv]').forEach(function (b) {
      b.addEventListener('click', function () {
        mode = b.getAttribute('data-inv'); idx = 0;
        document.querySelectorAll('[data-inv]').forEach(function (x) { x.classList.toggle('pri', x === b); });
        render();
      });
    });
    $('invStep').addEventListener('click', function () { if (idx < scripts[mode].length - 1) idx++; render(); });
    $('invReset').addEventListener('click', function () { idx = 0; render(); });
    render();
  })();
})();
