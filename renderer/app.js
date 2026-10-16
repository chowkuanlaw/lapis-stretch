(function () {
  'use strict';
  const api = window.lapis;
  const view = api.view;
  const { EX, BY } = window.LapisData;
  const lapis = window.lapisSVG;
  const root = document.getElementById('root');
  document.body.classList.add('view-' + view);

  const $ = s => document.querySelector(s);
  const pad = n => String(n).padStart(2, '0');
  const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const mmss = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${pad(t % 60)}`; };
  const secsLabel = s => (s < 60 ? s + ' sec' : Math.round(s / 60) + ' min');

  let st = null, howOpen = false, cardKey = '';
  const todayRec = () => (st.history || {})[dayKey(new Date())] || { total: 0, by: {} };
  const curEx = () => BY[st.cur || st.upNext];

  /* ---------- sound (played by the pop-up window) ---------- */
  let ac = null;
  function chime(kind) {
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const notes = kind === 'due' ? [659.25, 880] : kind === 'done' ? [783.99, 987.77, 1174.66] : [587.33];
      notes.forEach((f, i) => {
        const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + 0.05 + i * 0.17;
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 1.2);
      });
    } catch (e) { /* no audio device */ }
  }
  api.onChime(chime);

  /* ---------- shared reminder card ---------- */
  const CHECK = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="currentColor"/><path d="M5.5 10.4l3 3 6-6.4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function cardHTML(compact) {
    const ex = curEx(), m = st.mode, n = todayRec().by[ex.id] || 0;
    const pose = m === 'done' ? 'cheer' : m === 'snoozed' ? 'sleep' : ex.pose;
    const howto = `<details id="howto"${howOpen ? ' open' : ''}><summary>How to</summary><ol>${ex.steps.map(s => `<li>${s}</li>`).join('')}</ol></details>`;
    let top = '', actions = '', links = '', extra = '';
    if (m === 'waiting') {
      top = `<p class="tag">${st.paused ? 'Paused · up next' : 'Up next'}</p>`;
      actions = `<button class="btn ghost" data-act="now" type="button">Start now</button><button class="linkbtn" data-act="different" type="button">Different stretch</button><span class="spacer"></span><span class="left">${secsLabel(ex.secs)}</span>`;
    } else if (m === 'due') {
      if (compact) top = `<p class="shout">It's time to <em>stretch!</em></p>`;
      actions = `<button class="btn" data-act="start" type="button">Start</button><button class="btn ghost" data-act="snooze" type="button">Snooze ${st.snooze} min</button><span class="spacer"></span><span class="left">${secsLabel(ex.secs)}</span>`;
      links = `<div class="links"><button class="linkbtn" data-act="different" type="button">Different stretch</button><button class="linkbtn" data-act="skip" type="button">Skip this one</button></div>`;
    } else if (m === 'active') {
      actions = `<button class="btn pink" data-act="done" type="button">Done</button><button class="btn ghost" data-act="stop" type="button">Stop</button><span class="spacer"></span><span class="left" data-left>${mmss(st.activeEnd - Date.now())} left</span>`;
      if (ex.sides) extra = `<p class="side-hint">${st.switched ? 'Other side now' : 'First side · Lapis chimes when to switch'}</p>`;
    } else if (m === 'done') {
      actions = `<p class="ok">${CHECK}Nice! That's ${todayRec().total} today.</p>`;
    } else if (m === 'snoozed') {
      actions = `<p class="cue">See you in ${st.snooze} min.</p>`;
    }
    const showHow = m !== 'done' && m !== 'snoozed';
    return `<div class="tile">${lapis(pose, 'Lapis doing ' + ex.name.toLowerCase(), m !== 'active')}</div>
      <div class="body">${top}<div class="head"><h3>${ex.name}</h3><span class="count">${n} today</span></div>
      <p class="cue">${ex.cue}</p><p class="dose">${ex.dose}</p>${extra}${showHow ? howto : ''}
      <div class="row">${actions}</div>${links}</div>
      ${m === 'active' ? '<div class="bar"><i data-bar></i></div>' : ''}`;
  }
  function renderCard(el, compact) {
    const key = [st.mode, st.cur, st.upNext, st.paused, st.switched, todayRec().total, st.snooze].join('|');
    if (key === cardKey) return;
    if (st.mode === 'due' && !cardKey.startsWith('due')) howOpen = false;
    cardKey = key;
    el.className = 'card pop' + (st.mode === 'due' ? ' due' : '');
    el.innerHTML = cardHTML(compact);
    const d = el.querySelector('#howto');
    if (d) d.addEventListener('toggle', () => { howOpen = d.open; });
    tickCard(el);
  }
  function tickCard(el) {
    if (st.mode !== 'active') return;
    const left = st.activeEnd - Date.now();
    const b = el.querySelector('[data-bar]'), l = el.querySelector('[data-left]');
    if (b) b.style.width = Math.min(100, 100 * (1 - left / (st.activeSecs * 1000))) + '%';
    if (l) l.textContent = mmss(left) + ' left';
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('[data-act]');
    if (a) { api.act(a.dataset.act); return; }
    const x = e.target.closest('[data-ex]');
    if (x) { api.act('now', { ex: x.dataset.ex }); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const s = e.target.closest('[data-set]');
    if (s) {
      const k = s.dataset.set;
      api.act('set', { key: k, value: s.dataset.val !== undefined ? +s.dataset.val : !st[k] });
      return;
    }
    const w = e.target.closest('[data-w]');
    if (w) api.act(w.dataset.w);
  });

  /* ---------- main window ---------- */
  const SWITCHES = [
    ['sound', 'Chime', 'A soft two-note bell when it is time'],
    ['widget', 'Desktop widget', 'Small countdown card on your desktop'],
    ['widgetOnTop', 'Keep widget on top', 'Stays above your other windows'],
    ['toast', 'Windows notification too', 'Also shows in the Windows notification centre'],
    ['awayReset', 'Restart timer when I am away', 'After 5 min idle, or when you lock or sleep your PC'],
    ['autostart', 'Start with Windows', 'Lapis starts quietly in the tray when you sign in'],
    ['updateCheck', 'Check for updates', 'Asks GitHub once a day if a newer Lapis is out. Off by default']
  ];
  function buildMain() {
    root.innerHTML = `
    <div class="app">
      <header class="top">
        <div class="brand"><span class="logo">${lapis('wave', 'Lapis')}</span>
          <div><h1>Lapis</h1><p>Stretch nudges from a kuih lapis while you work</p></div></div>
        <button class="btn ghost" data-w="pause" id="pauseBtn" type="button">Pause reminders</button>
      </header>
      <div class="update-bar" id="updateBar" hidden><span id="updateText"></span><button class="btn" data-w="open-release" type="button">Download</button></div>
      <main class="grid">
        <section class="stage">
          <div class="clock">
            <div class="ring" id="ring">
              <svg class="r" viewBox="0 0 132 132" aria-hidden="true"><circle class="track" cx="66" cy="66" r="58"/><circle class="arc" id="arc" cx="66" cy="66" r="58"/></svg>
              <div class="ring-mascot" id="heroMascot"></div>
            </div>
            <div><p class="eyebrow" id="clockLabel">Next stretch in</p><p class="time" id="clockTime">--:--</p><p class="sub" id="clockSub"></p></div>
          </div>
          <div class="banner" id="banner" hidden><strong>It's time to <em>stretch!</em></strong><span>Quick one while you're here.</span></div>
          <article class="card" id="card"></article>
          <p class="note">Lapis lives in your system tray. Closing this window keeps the reminders running; right-click the tray icon to quit.</p>
        </section>
        <aside class="side">
          <section class="panel today">
            <h2>Today</h2>
            <div class="big"><b id="todayCount">0</b><span id="todayWord">stretches done</span></div>
            <div class="week" id="week"></div>
            <p class="foot" id="weekFoot"></p>
          </section>
          <section class="panel settings">
            <h2>Settings</h2>
            <div class="set"><div class="lbl">Remind me every<small>Minutes between nudges</small></div><div class="seg" id="segInterval">${[15, 20, 30, 45, 60].map(v => `<button type="button" data-set="interval" data-val="${v}">${v}</button>`).join('')}</div></div>
            <div class="set"><div class="lbl">Snooze for<small>When you're mid-meeting</small></div><div class="seg" id="segSnooze">${[5, 10, 15].map(v => `<button type="button" data-set="snooze" data-val="${v}">${v} min</button>`).join('')}</div></div>
            ${SWITCHES.map(([k, t, d]) => `<div class="set"><div class="lbl" id="lbl-${k}">${t}<small>${d}</small></div><button class="switch" role="switch" aria-labelledby="lbl-${k}" data-set="${k}" type="button"></button></div>`).join('')}
            <div class="set"><div class="lbl">Version <span id="version"></span><small id="updateMsg" aria-live="polite"></small></div><button class="btn ghost" data-w="check-update" id="checkBtn" type="button">Check now</button></div>
          </section>
        </aside>
      </main>
      <section class="panel library">
        <div class="lib-head"><h2>All stretches</h2><p>Click one to do it now. Lapis rotates through these, with a walk every few rounds.</p></div>
        <div class="lib">${EX.map(e => `<button type="button" data-ex="${e.id}"><div class="mini">${lapis(e.pose, 'Lapis doing ' + e.name.toLowerCase())}</div><b>${e.name}</b><span>${e.dose}</span></button>`).join('')}</div>
      </section>
    </div>`;
  }
  let heroKey = '';
  function renderMain() {
    renderCard($('#card'), false);
    $('#banner').hidden = st.mode !== 'due';
    $('#pauseBtn').textContent = st.paused ? 'Resume reminders' : 'Pause reminders';
    const pose = st.mode === 'due' ? 'wave' : st.mode === 'done' ? 'cheer' : st.mode === 'active' ? curEx().pose : (st.paused || st.away) ? 'sleep' : 'idle';
    if (pose !== heroKey) { heroKey = pose; $('#heroMascot').innerHTML = lapis(pose, 'Lapis', st.mode !== 'active'); }
    $('#ring').classList.toggle('due', st.mode === 'due' || st.mode === 'active');
    document.querySelectorAll('.seg [data-set]').forEach(b => b.setAttribute('aria-pressed', String(st[b.dataset.set] === +b.dataset.val)));
    document.querySelectorAll('.switch[data-set]').forEach(b => b.setAttribute('aria-checked', String(!!st[b.dataset.set])));
    const t = todayRec();
    $('#todayCount').textContent = t.total;
    $('#todayWord').textContent = t.total === 1 ? 'stretch done' : 'stretches done';
    const days = [], D = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const h = (st.history || {})[dayKey(d)];
      days.push({ l: i === 0 ? 'Today' : D[d.getDay()], n: h ? h.total : 0, today: i === 0 });
    }
    const max = Math.max(8, ...days.map(d => d.n)), sum = days.reduce((a, d) => a + d.n, 0);
    $('#week').innerHTML = days.map(d => `<div class="d${d.today ? ' today' : ''}${d.n ? ' has' : ''}"><span class="n">${d.n || ''}</span><div class="b" style="height:${Math.max(6, (d.n / max) * 78)}px"></div><span class="l">${d.l}</span></div>`).join('');
    $('#weekFoot').textContent = sum ? `${sum} stretches in the last 7 days.` : 'Your week fills in as you stretch.';
    $('#version').textContent = st.version || '';
    $('#updateMsg').textContent = st.updateMsg || (st.updateCheck ? 'Checks once a day' : 'Lapis only checks when you click Check now');
    $('#checkBtn').disabled = !!st.checking;
    $('#updateBar').hidden = !st.update;
    if (st.update) $('#updateText').textContent = `Lapis ${st.update.version} is available. You have ${st.version}.`;
    tickMain();
  }
  function tickMain() {
    const now = Date.now(); let label, time, sub, frac;
    if (st.mode === 'active') {
      const left = st.activeEnd - now; label = 'Stretching'; time = mmss(left); sub = curEx().name; frac = 1 - left / (st.activeSecs * 1000);
    } else if (st.mode === 'due') { label = 'Right now'; time = '0:00'; sub = 'Stretch time'; frac = 1; }
    else if (st.paused) { label = 'Paused'; time = mmss(st.pausedLeft); sub = 'Resume when you are back at your desk'; frac = 1 - Math.min(1, st.pausedLeft / (st.interval * 60e3)); }
    else if (st.away) { label = 'Away from desk'; time = `${st.interval}:00`; sub = 'The timer restarts when you are back'; frac = 0; }
    else { const left = st.nextDue - now; label = 'Next stretch in'; time = mmss(left); sub = `Every ${st.interval} minutes`; frac = 1 - Math.min(1, left / (st.interval * 60e3)); }
    $('#clockLabel').textContent = label; $('#clockTime').textContent = time; $('#clockSub').textContent = sub;
    const C = 2 * Math.PI * 58, arc = $('#arc');
    arc.style.strokeDasharray = C; arc.style.strokeDashoffset = C * (1 - Math.max(0, Math.min(1, frac)));
    document.title = st.mode === 'due' ? 'Lapis · Time to stretch!' : `Lapis · ${time}`;
    tickCard($('#card'));
  }

  /* ---------- desktop widget ---------- */
  const ICONS = {
    now: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="2.5" width="3" height="11" rx="1" fill="currentColor"/><rect x="9.5" y="2.5" width="3" height="11" rx="1" fill="currentColor"/></svg>',
    resume: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.5-3.6M3 2.5V5h2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    open: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9 2.5h4.5V7M13.5 2.5 8 8M6.5 3.5h-3v9h9v-3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  function buildWidget() {
    root.innerHTML = `<div class="widget" id="widget">
      <div class="w-mascot" id="wMascot"></div>
      <div class="w-text"><p class="w-label" id="wLabel">Next stretch</p><p class="w-time" id="wTime">--:--</p><p class="w-sub" id="wSub"></p></div>
      <div class="w-btns">
        <button type="button" data-w="now" id="wNow" title="Stretch now" aria-label="Stretch now">${ICONS.now}</button>
        <button type="button" data-w="pause" id="wPause" title="Pause reminders" aria-label="Pause reminders">${ICONS.pause}</button>
        <button type="button" data-w="open-main" title="Open Lapis" aria-label="Open Lapis">${ICONS.open}</button>
      </div>
      <div class="w-bar"><i id="wBar"></i></div>
    </div>`;
  }
  let wPoseKey = '';
  function renderWidget() {
    const pose = st.mode === 'due' ? 'wave' : st.mode === 'done' ? 'cheer' : st.mode === 'active' ? curEx().pose : st.mode === 'snoozed' || st.paused || st.away ? 'sleep' : 'idle';
    if (pose !== wPoseKey) { wPoseKey = pose; $('#wMascot').innerHTML = lapis(pose, 'Lapis', st.mode !== 'active'); }
    $('#widget').classList.toggle('due', st.mode === 'due' || st.mode === 'active');
    const p = $('#wPause');
    p.innerHTML = st.paused ? ICONS.resume : ICONS.pause;
    p.title = st.paused ? 'Resume reminders' : 'Pause reminders';
    p.setAttribute('aria-label', p.title);
    const t = todayRec().total;
    $('#wSub').textContent = `${t} ${t === 1 ? 'stretch' : 'stretches'} today`;
    tickWidget();
  }
  function tickWidget() {
    const now = Date.now(); let label, time, frac;
    if (st.mode === 'due') { label = 'Time to stretch!'; time = 'Now'; frac = 1; }
    else if (st.mode === 'active') { const left = st.activeEnd - now; label = curEx().name; time = mmss(left); frac = 1 - left / (st.activeSecs * 1000); }
    else if (st.mode === 'done') { label = 'Nice one'; time = 'Done'; frac = 1; }
    else if (st.mode === 'snoozed') { label = 'Snoozed'; time = mmss(st.nextDue - now); frac = 0; }
    else if (st.paused) { label = 'Paused'; time = mmss(st.pausedLeft); frac = 0; }
    else if (st.away) { label = 'Away from desk'; time = `${st.interval}:00`; frac = 0; }
    else { const left = st.nextDue - now; label = 'Next stretch'; time = mmss(left); frac = 1 - Math.min(1, left / (st.interval * 60e3)); }
    $('#wLabel').textContent = label; $('#wTime').textContent = time;
    $('#wBar').style.width = Math.max(0, Math.min(100, frac * 100)) + '%';
  }

  /* ---------- pop-up ---------- */
  function buildPopup() {
    root.innerHTML = '<div id="pop"><article class="card" id="card"></article></div>';
    const ro = new ResizeObserver(() => api.act('popup-size', { h: Math.ceil($('#pop').getBoundingClientRect().height) }));
    ro.observe($('#pop'));
  }
  function renderPopup() {
    if (st.mode === 'waiting') { cardKey = ''; return; }
    renderCard($('#card'), true);
  }

  /* ---------- boot ---------- */
  const B = { main: [buildMain, renderMain, tickMain], widget: [buildWidget, renderWidget, tickWidget], popup: [buildPopup, renderPopup, () => tickCard($('#card'))] }[view] || [buildMain, renderMain, tickMain];
  B[0]();
  function onState(s) { st = s; B[1](); }
  api.onState(onState);
  api.getState().then(onState);
  setInterval(() => { if (st) B[2](); }, 500);
})();
