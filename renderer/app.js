(function () {
  'use strict';
  const api = window.lapis;
  const view = api.view;
  const { EX, BY, CYCLE, KUIH, KUIH_GROUPS, KUIH_BY } = window.LapisData;
  // Draw with the kuih the user picked (Kuih Lapis until the first state arrives).
  const lapis = (pose, label, bob, skin) => window.lapisSVG(pose, label, bob, skin || (st && st.kuih) || 'lapis');
  const kuihName = () => (KUIH_BY[(st && st.kuih) || 'lapis'] || KUIH_BY.lapis).name;
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
      actions = compact === 'today' ? `<span class="left">${secsLabel(ex.secs)}</span>` : `<button class="btn ghost" data-act="now" type="button">Start now</button><button class="linkbtn" data-act="different" type="button">Different stretch</button><span class="spacer"></span><span class="left">${secsLabel(ex.secs)}</span>`;
    } else if (m === 'due') {
      if (compact === true) top = `<p class="shout">It's time to <em>stretch!</em></p>`;
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
    return `<div class="tile">${lapis(pose, kuihName() + ' doing ' + ex.name.toLowerCase(), m !== 'active')}</div>
      <div class="body">${top}<div class="head"><h3>${ex.name}</h3><span class="count">${n} today</span></div>
      <p class="cue">${ex.cue}</p><p class="dose">${ex.dose}</p>${extra}${showHow ? howto : ''}
      <div class="row">${actions}</div>${links}</div>
      ${m === 'active' ? '<div class="bar"><i data-bar></i></div>' : ''}`;
  }
  function renderCard(el, compact) {
    const key = [st.mode, st.cur, st.upNext, st.paused, st.switched, todayRec().total, st.snooze, st.kuih].join('|');
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
    const kt = e.target.closest('.kuih-tap');
    if (kt) { onKuihTap(kt); return; }
    const pg = e.target.closest('[data-page]');
    if (pg) { setPage(pg.dataset.page); return; }
    const ob = e.target.closest('[data-ob]');
    if (ob) { obAction(ob.dataset.ob); return; }
    const a = e.target.closest('[data-act]');
    if (a) { api.act(a.dataset.act); return; }
    const x = e.target.closest('[data-ex]');
    if (x) { api.act('now', { ex: x.dataset.ex }); if (view === 'main') setPage('today'); return; }
    const s = e.target.closest('[data-set]');
    if (s) {
      const k = s.dataset.set;
      api.act('set', { key: k, value: s.dataset.sval !== undefined ? s.dataset.sval : s.dataset.val !== undefined ? +s.dataset.val : !st[k] });
      return;
    }
    const w = e.target.closest('[data-w]');
    if (w) api.act(w.dataset.w);
  });

  /* ---------- main window: sidebar app ---------- */
  const PAGES = [
    { id: 'today', label: 'Today', icon: '<path d="M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-5V17H4a1 1 0 0 1-1-1z"/>' },
    { id: 'stretches', label: 'Stretches', icon: '<path d="M7 5h10M7 10h10M7 15h10"/><circle cx="3.5" cy="5" r="1"/><circle cx="3.5" cy="10" r="1"/><circle cx="3.5" cy="15" r="1"/>' },
    { id: 'kuih', label: 'Your kuih', icon: '<circle cx="10" cy="10" r="7"/><circle cx="7.5" cy="8.5" r=".6"/><circle cx="12.5" cy="8.5" r=".6"/><path d="M7.5 12.2q2.5 2 5 0"/>' },
    { id: 'progress', label: 'Progress', icon: '<path d="M4 16V11M8.5 16V6M13 16V9M17 16V4"/>' },
    { id: 'settings', label: 'Settings', icon: '<path d="M3 6h8M15 6h2M3 14h2M9 14h8"/><circle cx="13" cy="6" r="2"/><circle cx="7" cy="14" r="2"/>' }
  ];
  const svgIcon = body => `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const SETTING_GROUPS = [
    { title: 'Alerts', items: [['sound', 'Chime', 'A soft two-note bell when it is time'], ['toast', 'Windows notification too', 'Also shows in the Windows notification centre']] },
    { title: 'Desktop', items: [['widget', 'Desktop widget', 'Small countdown card on your desktop'], ['widgetOnTop', 'Keep widget on top', 'Stays above your other windows']] },
    { title: 'When you step away', items: [['awayReset', 'Restart timer when I am away', 'After 5 min idle, or when you lock or sleep your PC'], ['autostart', 'Start with Windows', 'Lapis starts quietly in the tray when you sign in']] }
  ];
  const switchRow = ([k, t, d], pre) => `<div class="set"><div class="lbl" id="${pre || ''}lbl-${k}">${t}<small>${d}</small></div><button class="switch" role="switch" aria-labelledby="${pre || ''}lbl-${k}" data-set="${k}" type="button"></button></div>`;
  const segGroup = (key, label, vals, fmt) => `<div class="seg" role="group" aria-label="${label}">${vals.map(v => `<button type="button" data-set="${key}" data-val="${v}">${fmt(v)}</button>`).join('')}</div>`;
  const kuihTiles = size => KUIH_GROUPS.map(g => `<div class="kgroup"><h3>${g.title} <span>${g.sub}</span></h3><div class="kgrid ${size}">${KUIH.filter(k => k.group === g.id).map(k => `<button type="button" class="ktile" data-set="kuih" data-sval="${k.id}" aria-pressed="false" title="${esc(k.note)}"><span class="kimg">${lapis('idle', k.name, false, k.id)}</span><b>${k.name}</b></button>`).join('')}</div></div>`).join('');

  let page = 'today', obForce = false, obStep = 0;
  function setPage(p) {
    if (!PAGES.some(x => x.id === p)) return;
    page = p;
    const c = $('#content'); if (c) c.scrollTop = 0;
    if (st) renderMain();
  }

  function buildMain() {
    root.innerHTML = `
    <div class="shell">
      <nav class="side-nav" aria-label="Lapis">
        <div class="nav-brand"><span class="logo" id="logo"></span><span class="nav-title">Lapis</span></div>
        ${PAGES.map(p => `<button type="button" class="nav-item" data-page="${p.id}" aria-label="${p.label}" title="${p.label}">${svgIcon(p.icon)}<span>${p.label}</span></button>`).join('')}
        <div class="nav-spacer"></div>
        <button type="button" class="nav-item nav-pause" data-w="pause" id="navPause" aria-label="Pause reminders" title="Pause reminders">${svgIcon('<rect x="5" y="4" width="3.2" height="12" rx="1"/><rect x="11.8" y="4" width="3.2" height="12" rx="1"/>')}</button>
        <div class="nav-status">
          <p class="ns-title" id="nsTitle">Reminders on</p>
          <p class="ns-sub" id="nsSub"></p>
          <button class="btn ghost small" data-w="pause" id="pauseBtn" type="button">Pause reminders</button>
        </div>
        <p class="nav-version" id="navVersion"></p>
      </nav>

      <div class="content" id="content">
        <div class="update-bar" id="updateBar" hidden><span id="updateText"></span><button class="btn" id="updateBtn" type="button" hidden></button></div>

        <section class="page" id="page-today" aria-labelledby="h-today">
          <header class="page-head"><h1 id="h-today">Today</h1><p id="todayDate"></p></header>
          <div class="banner" id="banner" hidden><strong>It's time to <em>stretch!</em></strong><span>Quick one while you're here.</span></div>
          <section class="hero" aria-label="Next stretch">
            <div class="ring" id="ring">
              <svg class="r" viewBox="0 0 132 132" aria-hidden="true"><circle class="track" cx="66" cy="66" r="58"/><circle class="arc" id="arc" cx="66" cy="66" r="58"/></svg>
              <button type="button" class="ring-mascot kuih-tap" id="heroMascot" aria-label="Your kuih"></button>
            </div>
            <div class="hero-text"><p class="eyebrow" id="clockLabel">Next stretch in</p><p class="time" id="clockTime">--:--</p><p class="sub" id="clockSub"></p></div>
            <div class="hero-actions" id="heroActions">
              <button class="btn" data-act="now" type="button">Start now</button>
              <button class="btn ghost" data-act="different" type="button">Different stretch</button>
            </div>
          </section>
          <div class="today-row">
            <article class="card" id="card"></article>
            <section class="panel today-panel" aria-label="Today's progress">
              <div class="big"><b id="todayCount">0</b><span id="todayWord">stretches today</span><button class="linkbtn" data-page="progress" type="button">See progress</button></div>
              <div class="week" id="week"></div>
            </section>
          </div>
          <section class="coming" aria-labelledby="h-coming">
            <h2 id="h-coming">Coming up</h2>
            <div class="coming-list" id="coming"></div>
          </section>
        </section>

        <section class="page" id="page-stretches" aria-labelledby="h-str" hidden>
          <header class="page-head"><h1 id="h-str">Stretches</h1><p>Lapis rotates through these, with a walk every few rounds. Click one to do it now.</p></header>
          <div class="lib big" id="lib"></div>
        </section>

        <section class="page" id="page-kuih" aria-labelledby="h-kuih" hidden>
          <header class="page-head"><h1 id="h-kuih">Your kuih</h1><p>Shows up on reminders, the desktop widget and the tray icon.</p></header>
          <div class="kuih-layout">
            <aside class="panel kuih-sel" aria-label="Selected kuih">
              <div class="kuih-big" id="kuihBig"></div>
              <div class="kuih-info"><h2 id="kuihName"></h2><span class="chip" id="kuihOrigin"></span><p id="kuihNote"></p></div>
            </aside>
            <div class="kuih-groups">${kuihTiles('')}</div>
          </div>
        </section>

        <section class="page" id="page-progress" aria-labelledby="h-prog" hidden>
          <header class="page-head"><h1 id="h-prog">Progress</h1><p>Your stretches over the last week.</p></header>
          <div class="stats">
            <div class="panel stat"><b id="stToday">0</b><span>today</span></div>
            <div class="panel stat"><b id="stWeek">0</b><span>last 7 days</span></div>
            <div class="panel stat"><b id="stBest">0</b><span>best day this week</span></div>
            <div class="panel stat"><b id="stStreak">0</b><span id="stStreakLbl">day streak</span></div>
          </div>
          <section class="panel"><h2>Last 7 days</h2><div class="week tall" id="weekBig"></div></section>
          <section class="panel"><h2>Today by stretch</h2><div class="bylist" id="byList"></div></section>
        </section>

        <section class="page" id="page-settings" aria-labelledby="h-set" hidden>
          <header class="page-head"><h1 id="h-set">Settings</h1></header>
          <div class="settings-grid">
            <section class="panel settings"><h2>Reminders</h2>
              <div class="set"><div class="lbl">Remind me every<small>Minutes between nudges</small></div>${segGroup('interval', 'Minutes between reminders', [15, 20, 30, 45, 60], v => v)}</div>
              <div class="set"><div class="lbl">Snooze for<small>When you're mid-meeting</small></div>${segGroup('snooze', 'Snooze length', [5, 10, 15], v => v + ' min')}</div>
            </section>
            ${SETTING_GROUPS.map(g => `<section class="panel settings"><h2>${g.title}</h2>${g.items.map(i => switchRow(i)).join('')}</section>`).join('')}
            <section class="panel settings"><h2>Updates</h2>
              ${switchRow(['autoUpdate', 'Update automatically', 'Checks GitHub when Lapis starts and once a day'])}
              <div class="set"><div class="lbl">Version <span id="version"></span><small id="updateMsg" aria-live="polite"></small></div><button class="btn ghost" data-w="check-update" id="checkBtn" type="button">Check now</button></div>
            </section>
            <section class="panel settings"><h2>About</h2>
              <p class="note-p">Lapis lives in your system tray, near the clock. Closing this window keeps the reminders running; right-click the tray icon to quit.</p>
              <button class="btn ghost" data-ob="open" type="button">Show the welcome again</button>
            </section>
          </div>
        </section>
      </div>
    </div>

    <div class="onboard" id="onboard" role="dialog" aria-modal="true" aria-labelledby="obTitle0" hidden>
      <div class="ob-card">
        <div class="ob-steps" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <div class="ob-body ob-center" data-step="0">
          <div class="ob-hero" id="obWave"></div>
          <h2 id="obTitle0">Hi, I'm Lapis</h2>
          <p>Every 20 minutes I'll pop up with one quick desk stretch: chin tucks, neck stretches, a walk to refill your water. Two minutes of setup and we're off.</p>
        </div>
        <div class="ob-body" data-step="1" hidden>
          <h2>Who's stretching with you?</h2>
          <p>Pick a kuih. It shows up on reminders, the desktop widget and the tray. You can change it any time.</p>
          <div class="ob-kuih">${kuihTiles('small')}</div>
        </div>
        <div class="ob-body" data-step="2" hidden>
          <h2>How often?</h2>
          <p>Most people like every 20 minutes. Lapis also restarts the timer when you've been away from your desk.</p>
          <div class="panel settings ob-settings">
            <div class="set"><div class="lbl">Remind me every<small>Minutes between nudges</small></div>${segGroup('interval', 'Minutes between reminders', [15, 20, 30, 45, 60], v => v)}</div>
            ${switchRow(['autostart', 'Start with Windows', 'Lapis starts quietly in the tray when you sign in'], 'ob-')}
            ${switchRow(['widget', 'Desktop widget', 'Small countdown card on your desktop'], 'ob-')}
          </div>
        </div>
        <div class="ob-body ob-center" data-step="3" hidden>
          <div class="ob-hero" id="obCheer"></div>
          <h2 id="obDoneTitle">See you in 20 minutes</h2>
          <p>Lapis lives in your tray, near the clock. Click it any time to open this window, or right-click it to pause.</p>
        </div>
        <div class="ob-actions">
          <button class="linkbtn" data-ob="skip" type="button" id="obSkip">Skip</button>
          <span class="spacer"></span>
          <button class="btn ghost" data-ob="back" type="button" id="obBack">Back</button>
          <button class="btn" data-ob="next" type="button" id="obNext">Get started</button>
        </div>
      </div>
    </div>`;
  }

  let heroKey = '', kuihKey = '';
  function renderKuihParts() {
    if (kuihKey === st.kuih) return;
    kuihKey = st.kuih;
    const k = KUIH_BY[st.kuih] || KUIH_BY.lapis;
    $('#logo').innerHTML = lapis('wave', k.name);
    $('#lib').innerHTML = EX.map(e => `<button type="button" data-ex="${e.id}"><div class="mini">${lapis(e.pose, k.name + ' doing ' + e.name.toLowerCase())}</div><b>${e.name}</b><span>${e.dose}</span><small>${e.cue}</small></button>`).join('');
    $('#kuihBig').innerHTML = lapis('wave', k.name);
    $('#kuihName').textContent = k.name;
    $('#kuihOrigin').textContent = k.origin;
    $('#kuihNote').textContent = k.note;
    $('#obWave').innerHTML = lapis('wave', k.name);
    $('#obCheer').innerHTML = lapis('cheer', k.name);
    document.querySelectorAll('.ktile').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sval === st.kuih)));
    heroKey = ''; comingKey = '';
  }

  let comingKey = '';
  function renderComing() {
    const n = CYCLE.length, key = st.idx + '|' + st.kuih;
    if (key === comingKey) return;
    comingKey = key;
    const ids = [1, 2, 3, 4].map(i => CYCLE[(st.idx + i) % n]);
    $('#coming').innerHTML = ids.map(id => { const e = BY[id]; return `<button type="button" class="coming-item" data-ex="${e.id}" title="Do ${esc(e.name)} now"><span class="ci-img">${lapis(e.pose, kuihName() + ' doing ' + e.name.toLowerCase())}</span><b>${e.name}</b></button>`; }).join('');
  }

  function lastDays(count) {
    const out = [], D = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const h = (st.history || {})[dayKey(d)];
      out.push({ l: i === 0 ? 'Today' : D[d.getDay()], n: h ? h.total : 0, today: i === 0 });
    }
    return out;
  }
  function weekBars(days, maxH) {
    const max = Math.max(8, ...days.map(d => d.n));
    return days.map(d => `<div class="d${d.today ? ' today' : ''}${d.n ? ' has' : ''}"><span class="n">${d.n || ''}</span><div class="b" style="height:${Math.max(6, (d.n / max) * maxH)}px"></div><span class="l">${d.l}</span></div>`).join('');
  }
  function renderProgress() {
    const days = lastDays(7), sum = days.reduce((a, d) => a + d.n, 0), t = todayRec();
    $('#stToday').textContent = t.total;
    $('#stWeek').textContent = sum;
    $('#stBest').textContent = Math.max(0, ...days.map(d => d.n));
    let streak = 0;
    for (let i = t.total ? 0 : 1; i < 366; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const h = (st.history || {})[dayKey(d)];
      if (h && h.total) streak++; else break;
    }
    $('#stStreak').textContent = streak;
    $('#stStreakLbl').textContent = streak === 1 ? 'day streak' : 'day streak';
    $('#weekBig').innerHTML = weekBars(days, 150);
    const by = Object.entries(t.by || {}).filter(([id]) => BY[id]).sort((a, b) => b[1] - a[1]);
    const top = Math.max(1, ...by.map(([, n]) => n));
    $('#byList').innerHTML = by.length
      ? by.map(([id, n]) => `<div class="byrow"><span>${BY[id].name}</span><div class="bybar"><i style="width:${(n / top) * 100}%"></i></div><b>${n}</b></div>`).join('')
      : '<p class="empty">No stretches yet today. Your first one is coming up.</p>';
  }

  function renderOnboarding() {
    const show = st.onboarded === false || obForce;
    $('#onboard').hidden = !show;
    if (!show) return;
    document.querySelectorAll('.ob-body').forEach(b => { b.hidden = +b.dataset.step !== obStep; });
    document.querySelectorAll('.ob-steps i').forEach((d, i) => d.classList.toggle('on', i <= obStep));
    $('#obBack').hidden = obStep === 0;
    $('#obSkip').hidden = obStep === 3;
    $('#obNext').textContent = ['Get started', 'Next', 'Next', 'Start stretching'][obStep];
    $('#obDoneTitle').textContent = `See you in ${st.interval} minutes`;
  }
  function obAction(what) {
    if (what === 'open') { obForce = true; obStep = 0; }
    else if (what === 'back') obStep = Math.max(0, obStep - 1);
    else if (what === 'next' && obStep < 3) obStep++;
    else if (what === 'next' || what === 'skip') { obForce = false; obStep = 0; api.act('set', { key: 'onboarded', value: true }); }
    renderMain();
    const n = $('#obNext'); if (n && !$('#onboard').hidden) n.focus();
  }

  function renderMain() {
    renderKuihParts();
    // navigation
    document.querySelectorAll('.nav-item[data-page]').forEach(b => {
      if (b.dataset.page === page) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      b.classList.toggle('alert', b.dataset.page === 'today' && (st.mode === 'due' || st.mode === 'active'));
    });
    PAGES.forEach(p => { $('#page-' + p.id).hidden = p.id !== page; });
    // sidebar status
    $('#nsTitle').textContent = st.paused ? 'Reminders paused' : 'Reminders on';
    $('#nsSub').textContent = st.paused ? 'Resume when you are back' : `Every ${st.interval} min` + (st.awayReset ? ' · restarts when you are away' : '');
    $('#pauseBtn').textContent = st.paused ? 'Resume reminders' : 'Pause reminders';
    $('#navPause').setAttribute('aria-label', st.paused ? 'Resume reminders' : 'Pause reminders');
    $('#navPause').title = $('#navPause').getAttribute('aria-label');
    $('#navVersion').textContent = `Version ${st.version || ''}` + (st.update && st.update.state === 'ready' ? ' · update ready' : '');
    // today
    $('#todayDate').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    renderCard($('#card'), 'today');
    $('#banner').hidden = st.mode !== 'due';
    $('#heroActions').hidden = st.mode !== 'waiting';
    const pose = st.mode === 'due' ? 'wave' : st.mode === 'done' ? 'cheer' : st.mode === 'active' ? curEx().pose : (st.paused || st.away) ? 'sleep' : 'idle';
    if (pose !== heroKey) { heroKey = pose; $('#heroMascot').innerHTML = lapis(pose, kuihName(), st.mode !== 'active'); }
    $('#ring').classList.toggle('due', st.mode === 'due' || st.mode === 'active');
    const t = todayRec();
    $('#todayCount').textContent = t.total;
    $('#todayWord').textContent = t.total === 1 ? 'stretch today' : 'stretches today';
    $('#week').innerHTML = weekBars(lastDays(7), 64);
    renderComing();
    // other pages
    if (page === 'progress') renderProgress();
    document.querySelectorAll('.seg [data-set]').forEach(b => b.setAttribute('aria-pressed', String(st[b.dataset.set] === +b.dataset.val)));
    document.querySelectorAll('.switch[data-set]').forEach(b => b.setAttribute('aria-checked', String(!!st[b.dataset.set])));
    $('#version').textContent = st.version || '';
    $('#updateMsg').textContent = st.updateMsg || (st.autoUpdate ? 'Lapis checks for updates automatically' : 'Lapis only checks when you click Check now');
    $('#checkBtn').disabled = !!st.checking || !!(st.update && st.update.state !== 'available');
    renderUpdateBar();
    renderOnboarding();
    tickMain();
  }
  function renderUpdateBar() {
    const u = st.update, bar = $('#updateBar'), btn = $('#updateBtn');
    bar.hidden = !u;
    if (!u) return;
    if (u.state === 'ready') {
      $('#updateText').textContent = `Lapis ${u.version} is ready. Restart to update; your stretch history stays.`;
      btn.hidden = false; btn.textContent = 'Restart to update'; btn.dataset.w = 'install-update';
    } else if (u.state === 'downloading') {
      $('#updateText').textContent = `Downloading Lapis ${u.version}... ${u.percent || 0}%`;
      btn.hidden = true;
    } else {
      $('#updateText').textContent = `Lapis ${u.version} is available. You have ${st.version}.`;
      btn.hidden = false; btn.textContent = 'Download'; btn.dataset.w = 'open-release';
    }
  }
  function tickMain() {
    const now = Date.now(); let label, time, sub, frac;
    if (st.mode === 'active') {
      const left = st.activeEnd - now; label = 'Stretching'; time = mmss(left); sub = curEx().name; frac = 1 - left / (st.activeSecs * 1000);
    } else if (st.mode === 'due') { label = 'Right now'; time = '0:00'; sub = curEx().name + ' is waiting for you'; frac = 1; }
    else if (st.paused) { label = 'Paused'; time = mmss(st.pausedLeft); sub = 'Resume when you are back at your desk'; frac = 1 - Math.min(1, st.pausedLeft / (st.interval * 60e3)); }
    else if (st.away) { label = 'Away from desk'; time = `${st.interval}:00`; sub = 'The timer restarts when you are back'; frac = 0; }
    else { const left = st.nextDue - now; label = 'Next stretch in'; time = mmss(left); sub = `${BY[st.upNext].name} is next · ${secsLabel(BY[st.upNext].secs)}`; frac = 1 - Math.min(1, left / (st.interval * 60e3)); }
    if (taps > 0) frac = taps / EGG_TAPS;
    if (st.eggMsg) sub = 'Okay, back to work!';
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
      <button type="button" class="w-mascot kuih-tap" id="wMascot" aria-label="Your kuih"></button>
      <div class="w-text"><p class="w-label" id="wLabel">Next stretch</p><p class="w-time" id="wTime">--:--</p><p class="w-sub" id="wSub"></p></div>
      <div class="w-btns">
        <button type="button" data-w="now" id="wNow" title="Stretch now" aria-label="Stretch now">${ICONS.now}</button>
        <button type="button" data-w="pause" id="wPause" title="Pause reminders" aria-label="Pause reminders">${ICONS.pause}</button>
        <button type="button" data-w="open-main" title="Open Lapis" aria-label="Open Lapis">${ICONS.open}</button>
      </div>
      <div class="w-bar"><i id="wBar"></i></div>
    </div>`;
  }
  let wPoseKey = '', trayKuih = '';
  function sendTrayIcon(skin) {
    // Draw the kuih's body at tray sizes; the main process turns these into the tray icon.
    const svg = window.lapisBodySVG(skin);
    const img = new Image();
    img.onload = () => {
      const images = [[16, 1], [24, 1.5], [32, 2], [48, 3]].map(([px, scale]) => {
        const c = document.createElement('canvas'); c.width = c.height = px;
        const g = c.getContext('2d'), r = Math.min(px / 92, px / 98);
        const w = 92 * r, h = 98 * r;
        g.drawImage(img, (px - w) / 2, (px - h) / 2, w, h);
        return { scale, url: c.toDataURL('image/png') };
      });
      api.act('tray-icon', { images });
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function renderWidget() {
    if (trayKuih !== st.kuih) { trayKuih = st.kuih; wPoseKey = ''; sendTrayIcon(st.kuih || 'lapis'); }
    const pose = st.mode === 'due' ? 'wave' : st.mode === 'done' ? 'cheer' : st.mode === 'active' ? curEx().pose : st.mode === 'snoozed' || st.paused || st.away ? 'sleep' : 'idle';
    if (pose !== wPoseKey) { wPoseKey = pose; $('#wMascot').innerHTML = lapis(pose, kuihName(), st.mode !== 'active'); }
    $('#widget').classList.toggle('due', st.mode === 'due' || st.mode === 'active');
    const p = $('#wPause');
    p.innerHTML = st.paused ? ICONS.resume : ICONS.pause;
    p.title = st.paused ? 'Resume reminders' : 'Pause reminders';
    p.setAttribute('aria-label', p.title);
    const t = todayRec().total;
    const ready = st.update && st.update.state === 'ready';
    $('#wSub').textContent = ready ? `Update ready · open Lapis` : `${t} ${t === 1 ? 'stretch' : 'stretches'} today`;
    $('#wSub').classList.toggle('w-update', !!ready);
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
    if (taps > 0) frac = taps / EGG_TAPS;
    if (st.eggMsg) label = 'Back to work!';
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

  /* ---------- easter egg: tap the kuih 10 times quickly ---------- */
  const EGG_TAPS = 10, EGG_GAP = 500;
  let taps = 0, lastTap = 0, tapReset = null;
  function onKuihTap(btn) {
    const now = Date.now();
    taps = now - lastTap < EGG_GAP ? taps + 1 : 1;
    lastTap = now;
    clearTimeout(tapReset);
    tapReset = setTimeout(() => { taps = 0; showTaps(btn); }, EGG_GAP + 150);
    btn.classList.remove('squish'); void btn.offsetWidth; btn.classList.add('squish');
    showTaps(btn);
    if (taps >= EGG_TAPS) {
      taps = 0; clearTimeout(tapReset); showTaps(btn);
      const r = btn.getBoundingClientRect();
      api.act('egg', { rx: r.left + r.width / 2, ry: r.top + r.height / 2 }); // main adds the window's position
    }
  }
  function showTaps(btn) {
    btn.classList.toggle('wobble', taps >= 5);
    if (view === 'main') { $('#ring').classList.toggle('tapping', taps > 0); if (st) tickMain(); }
    if (view === 'widget') { $('#widget').classList.toggle('tapping', taps > 0); if (st) tickWidget(); }
  }

  /* The dance itself runs in its own full-screen window (view=egg).
     Each kuih group has its own song and dance; the kuih you picked decides which. */
  const DANCES = {
    malay: { title: 'Jom joget!', moves: ['wave', 'cheer', 'twist', 'reach', 'shoulders', 'walk', 'thoracic', 'cheer'], flipEvery: 1 },
    chinese: { title: 'Huat ah!', moves: ['salute', 'salute', 'horse', 'cheer', 'kick', 'horse', 'reach', 'salute'], flipEvery: 2 },
    indian: { title: 'Vaanga aadalaam!', moves: ['mudraL', 'mudraR', 'mudraL', 'mudraR', 'cheer', 'kick', 'mudraL', 'reach'], flipEvery: 4 },
    borneo: { title: 'Jom sumazau!', moves: ['wingsUp', 'wingsDown', 'wingsUp', 'wingsDown', 'wingsUp', 'walk', 'wingsUp', 'cheer'], flipEvery: 2 }
  };
  const eggStyle = skin => {
    const forced = new URLSearchParams(location.search).get('song');
    if (DANCES[forced]) return forced;
    const g = (KUIH_BY[skin] || KUIH_BY.lapis).group;
    return DANCES[g] ? g : 'malay';
  };
  let eggStarted = false, eggEnding = false, eggTimer = null, eggMaster = null;
  function buildEgg() {
    root.innerHTML = `<div class="egg" id="egg" role="img" aria-label="Your kuih is dancing. Click or press Escape to stop.">
      <div class="egg-dim"></div>
      <div class="egg-glow"></div>
      <div class="egg-confetti" id="eggConfetti"></div>
      <p class="egg-title" id="eggTitle"></p>
      <div class="egg-stage"><div class="egg-spin" id="eggSpin"><div class="egg-flip" id="eggFlip"><div class="egg-kuih" id="eggKuih"></div></div></div></div>
      <p class="egg-foot" id="eggFoot">Click anywhere or press Esc to stop</p>
    </div>`;
    document.addEventListener('keydown', e => { if (e.key === 'Escape') finishEgg(); });
    document.addEventListener('mousedown', () => finishEgg());
  }
  function renderEgg() {
    if (eggStarted) return;
    eggStarted = true;
    const q = new URLSearchParams(location.search);
    const fx = Number(q.get('fx')), fy = Number(q.get('fy'));
    const ox = Number.isFinite(fx) ? fx - innerWidth / 2 : 0, oy = Number.isFinite(fy) ? fy - innerHeight / 2 : 0;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const skin = st.kuih || 'lapis', style = eggStyle(skin);
    $('#egg').dataset.style = style;
    $('#eggTitle').textContent = DANCES[style].title;
    const k = $('#eggKuih');
    k.style.setProperty('--k', Math.round(Math.min(innerHeight * 0.62, 640)) + 'px');
    k.innerHTML = lapis('wave', '', false, skin);
    // other kuih rain down while it dances, friends from the same group first
    const shuffle = a => a.sort(() => Math.random() - 0.5);
    const mine = KUIH_BY[skin] ? KUIH_BY[skin].group : 'malay';
    const others = [...shuffle(KUIH.filter(x => x.id !== skin && x.group === mine)), ...shuffle(KUIH.filter(x => x.group !== mine))].slice(0, 14);
    shuffle(others);
    $('#eggConfetti').innerHTML = reduce ? '' : others.map((o, i) => {
      const left = (i / others.length) * 100 + Math.random() * 5, size = 56 + Math.round(Math.random() * 46);
      const dur = (3.2 + Math.random() * 2.2).toFixed(2), delay = (Math.random() * 2.5).toFixed(2), turn = Math.random() < 0.5 ? -1 : 1;
      return `<div class="egg-drop" style="left:${left.toFixed(1)}%;--s:${size}px;--d:${dur}s;--w:${delay}s;--r:${turn * 540}deg">${lapis('idle', '', false, o.id)}</div>`;
    }).join('');
    $('#egg').classList.add('on');
    eggSpinTo(ox, oy, reduce, false);
    if (st.sound) chime('due');
    eggTimer = setTimeout(() => startDance(skin, style, reduce), reduce ? 400 : 1000);
    eggSafety = setTimeout(finishEgg, 12000);
  }
  let eggSafety = null, eggOrigin = [0, 0];
  function eggSpinTo(ox, oy, reduce, back) {
    eggOrigin = back ? eggOrigin : [ox, oy];
    const far = `translate(${eggOrigin[0]}px, ${eggOrigin[1]}px) scale(.1) rotate(${back ? -1080 : 0}deg)`;
    const near = `translate(0, 0) scale(1) rotate(${back ? 0 : 1080}deg)`;
    const frames = reduce ? [{ opacity: back ? 1 : 0 }, { opacity: back ? 0 : 1 }]
      : back ? [{ transform: near, opacity: 1 }, { transform: far, opacity: 0.3 }] : [{ transform: far, opacity: 0.6 }, { transform: near, opacity: 1 }];
    $('#eggSpin').animate(frames, { duration: reduce ? 300 : back ? 750 : 1000, easing: back ? 'cubic-bezier(.6,0,.8,.4)' : 'cubic-bezier(.2,.8,.3,1)', fill: 'both' });
  }
  function startDance(skin, style, reduce) {
    if (eggEnding) return;
    const egg = $('#egg'), k = $('#eggKuih'), flip = $('#eggFlip'), D = DANCES[style];
    egg.classList.add('dancing');
    if (reduce) egg.classList.add('calm');
    if (st.sound) playSong(style);
    let beat = 0;
    const show = () => {
      k.innerHTML = lapis(D.moves[beat % D.moves.length], '', false, skin);
      flip.classList.toggle('flip', Math.floor(beat / D.flipEvery) % 2 === 1 && !reduce);
      $('#eggFoot').textContent = `Dancing for ${Math.max(1, 8 - Math.floor(beat / 2))} more seconds · click anywhere or press Esc to stop`;
    };
    show();
    eggTimer = setInterval(() => { beat++; if (beat >= 16) { finishEgg(); return; } show(); }, 500);
  }
  function finishEgg() {
    if (!eggStarted || eggEnding) return;
    eggEnding = true;
    clearInterval(eggTimer); clearTimeout(eggTimer); clearTimeout(eggSafety);
    if (eggMaster && ac) { try { eggMaster.gain.setTargetAtTime(0, ac.currentTime, 0.08); } catch (e) { /* ignore */ } }
    const egg = $('#egg');
    egg.classList.remove('dancing');
    egg.classList.add('leaving');
    eggSpinTo(0, 0, matchMedia('(prefers-reduced-motion: reduce)').matches, true);
    setTimeout(() => api.act('egg-done'), 800);
  }

  /* Four original tunes, all synthesized here (no audio files), 120 bpm, four bars = 8 seconds.
     Melodies: 0 = hold the previous note, -1 = rest; one step is an eighth note. */
  function playSong(style) {
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const t0 = ac.currentTime + 0.05, E = 0.25, END = 32 * E;
      const out = ac.createGain(); out.gain.value = { chinese: 0.45, indian: 0.6, borneo: 0.42 }[style] || 0.55; out.connect(ac.destination); eggMaster = out;
      const hz = m => 440 * Math.pow(2, (m - 69) / 12);
      const env = (g, t, peak, a, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
      const at = i => t0 + i * E;
      // one sustained, bowed or blown note, optionally sliding up into the pitch
      const voice = (m, t, len, o) => {
        const osc = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
        osc.type = o.type || 'sawtooth';
        if (o.slide) { osc.frequency.setValueAtTime(hz(m - o.slide), t); osc.frequency.exponentialRampToValueAtTime(hz(m), t + 0.07); } else osc.frequency.value = hz(m);
        f.type = o.filter || 'lowpass'; f.frequency.value = o.cut || 2400; f.Q.value = o.q || 0.7;
        osc.connect(f); f.connect(g); g.connect(out);
        env(g, t, o.peak || 0.1, o.attack || 0.03, len * 0.95);
        osc.start(t); osc.stop(t + len + 0.1);
        if (o.vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = o.vibRate || 5.5; lg.gain.value = o.vib; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + len + 0.1); }
      };
      const melody = (mel, o) => {
        for (let i = 0; i < mel.length; i++) {
          const m = mel[i]; if (m <= 0) continue;
          let n = 1; while (i + n < mel.length && mel[i + n] === 0) n++;
          (o.pluck ? pluck : voice)(m, at(i), n * E, o);
        }
      };
      // plucked string (Karplus-Strong): sape, guzheng
      const pluck = (m, t, len, o) => {
        const sr = ac.sampleRate, dur = Math.max(0.6, Math.min(1.6, len + 0.5)), N = Math.floor(sr * dur), P = Math.max(2, Math.round(sr / hz(m)));
        const buf = ac.createBuffer(1, N, sr), d = buf.getChannelData(0), damp = o.damp || 0.996;
        for (let j = 0; j < P; j++) d[j] = Math.random() * 2 - 1;
        for (let j = P; j < N; j++) d[j] = damp * 0.5 * (d[j - P] + d[j - P + 1]);
        const s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = o.cut || 3200;
        s.buffer = buf; s.connect(f); f.connect(g); g.connect(out); g.gain.value = o.peak || 0.3; s.start(t);
      };
      // gongs: a few inharmonic partials with a long ring
      const gong = (m, t, peak, ring, ratios) => (ratios || [1, 2.02, 2.76, 4.07]).forEach((r, i) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine'; o.frequency.value = hz(m) * r;
        o.connect(g); g.connect(out); env(g, t, peak / (1 + i * 1.3), 0.004, ring / (1 + i * 0.5)); o.start(t); o.stop(t + ring + 0.1);
      });
      const thump = (t, f0, f1, peak, len) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len * 0.7);
        o.connect(g); g.connect(out); env(g, t, peak, 0.005, len); o.start(t); o.stop(t + len + 0.05);
      };
      const noise = (t, peak, len, type, freq, q) => {
        const n = ac.createBufferSource(), buf = ac.createBuffer(1, Math.floor(ac.sampleRate * (len + 0.02)), ac.sampleRate), d = buf.getChannelData(0);
        for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / d.length);
        const f = ac.createBiquadFilter(), g = ac.createGain();
        n.buffer = buf; f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
        n.connect(f); f.connect(g); g.connect(out); env(g, t, peak, 0.003, len); n.start(t); n.stop(t + len + 0.02);
      };
      const drone = (ms, peak, type, cut) => ms.forEach(m => voice(m, t0, END, { type: type || 'sawtooth', cut: cut || 700, peak, attack: 0.4 }));
      const each = fn => { for (let i = 0; i < 32; i++) fn(i % 8, at(i), Math.floor(i / 8)); };

      if (style === 'chinese') {
        // erhu-like lead in D major pentatonic, guzheng off-beats, lion-dance drum, cymbals and gong
        melody([74, 0, 71, 69, 71, 74, 76, 0, 78, 76, 74, 71, 69, 0, 71, 0, 69, 71, 74, 0, 71, 69, 66, 64, 66, 69, 64, 0, 62, 0, 0, 0],
          { type: 'sawtooth', filter: 'bandpass', cut: 1300, q: 0.8, peak: 0.2, vib: 7, vibRate: 6, slide: 1 });
        const zheng = [[62, 66, 69], [62, 66, 71], [57, 62, 66], [57, 62, 64]];
        each((e, t, bar) => {
          if (e % 2 === 1) pluck(zheng[bar][(e >> 1) % 3] + 12, t, E, { peak: 0.14, damp: 0.994 });
          if (['dum', 'dum', '', 'dum', 'dum', '', 'dum', 'roll'][e] === 'dum') thump(t, 120, 60, 0.6, 0.22);
          if (e === 7) { thump(t, 140, 70, 0.35, 0.1); thump(t + E / 2, 140, 70, 0.35, 0.1); }
          if (e === 2 || e === 6) noise(t, 0.16, 0.35, 'highpass', 5200, 0.7);
          if (e === 0 && bar % 2 === 0) gong(50, t, 0.32, 2.2, [1, 1.48, 2.3, 3.1]);
        });
      } else if (style === 'indian') {
        // nadaswaram-like reed in a Mayamalavagowla-style scale over a tanpura drone, with parai/thavil beat and talam bells
        drone([50, 57, 62], 0.035, 'sawtooth', 650);
        melody([69, 70, 69, 67, 66, 0, 67, 69, 70, 73, 74, 0, 73, 70, 69, 0, 74, 73, 70, 69, 67, 69, 66, 63, 67, 66, 63, 0, 62, 0, 0, 0],
          { type: 'square', filter: 'bandpass', cut: 1500, q: 1.6, peak: 0.24, vib: 4, vibRate: 5, slide: 2 });
        each((e, t) => {
          const hit = ['dum', 'tak', '', 'tak', 'dum', '', 'tak', 'tak'][e];
          if (hit === 'dum') thump(t, 160, 70, 0.6, 0.2);
          if (hit === 'tak') { noise(t, 0.3, 0.07, 'bandpass', 3200, 1.4); thump(t, 420, 300, 0.12, 0.06); }
          if (e === 0 || e === 4) gong(96, t, 0.07, 0.5, [1, 1.51, 2.4]);
          if (e === 2 || e === 6) gong(96, t, 0.035, 0.08, [1, 1.51]);
        });
      } else if (style === 'borneo') {
        // sape-like plucked lead in A minor pentatonic, kulintangan gong row, agung gongs and a sompoton-style drone
        drone([57, 64], 0.03, 'square', 900);
        melody([76, 76, 74, 72, 74, 0, 76, 79, 81, 0, 79, 76, 74, 76, 74, 72, 69, 72, 74, 76, 74, 72, 69, 67, 69, 69, 72, 0, 69, 0, 0, 0],
          { pluck: true, peak: 0.42, damp: 0.997, cut: 3000 });
        const kul = [69, 72, 74, 76, 79, 76, 74, 72];
        each((e, t, bar) => {
          gong(kul[(e + bar * 2) % 8] + 12, t, 0.05, 0.35, [1, 2.4, 3.9]);
          if (e === 0) gong(45, t, 0.4, 1.8, [1, 2.01, 2.9]);
          if (e === 4) gong(52, t, 0.3, 1.4, [1, 2.01, 2.9]);
          if (e === 2 || e === 6) gong(64, t, 0.08, 0.25, [1, 2.6]);
          if (e === 3 || e === 7) thump(t, 200, 110, 0.25, 0.12);
        });
      } else {
        // joget: violin-like melody, accordion off-beats, bass and gendang (dum/tak)
        melody([69, 69, 74, 76, 77, 76, 74, 73, 74, 0, 69, 0, 70, 69, 67, 69, 65, 67, 69, 70, 72, 70, 69, 67, 69, 73, 76, 74, -1, 74, 74, 0],
          { type: 'sawtooth', cut: 2400, peak: 0.11, vib: 5, vibRate: 5.5 });
        const chords = [[62, 65, 69], [62, 65, 69], [67, 70, 74], [69, 73, 76]], bass = [[38, 45], [38, 45], [43, 50], [45, 52]];
        each((e, t, bar) => {
          if (e % 2 === 1) chords[bar].forEach(m => voice(m, t, 0.17, { type: 'square', cut: 1700, peak: 0.035, attack: 0.01 }));
          if (e % 2 === 0) voice(bass[bar][(e / 2) % 2], t, 0.42, { type: 'triangle', cut: 4000, peak: 0.22, attack: 0.01 });
          const hit = ['dum', '', 'tak', 'dum', '', 'tak', 'tak', ''][e];
          if (hit === 'dum') thump(t, 140, 55, 0.6, 0.24);
          else if (hit === 'tak') noise(t, 0.35, 0.08, 'bandpass', 2600, 1.2);
        });
      }
    } catch (e) { /* no audio device */ }
  }

  /* ---------- boot ---------- */
  const B = { main: [buildMain, renderMain, tickMain], widget: [buildWidget, renderWidget, tickWidget], popup: [buildPopup, renderPopup, () => tickCard($('#card'))], egg: [buildEgg, renderEgg, () => {}] }[view] || [buildMain, renderMain, tickMain];
  B[0]();
  function onState(s) { st = s; B[1](); }
  api.onState(onState);
  api.getState().then(onState);
  setInterval(() => { if (st) B[2](); }, 500);
})();
