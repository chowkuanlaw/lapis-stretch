(function () {
  'use strict';
  const api = window.lapis;
  const view = api.view;
  const D = window.LapisData, I = window.LapisI18n;
  const { EX, BY, CYCLE, KUIH, KUIH_GROUPS, KUIH_BY, STARTERS, RULES, computeStats, ruleProgress, festivalOn, dayKey } = D;
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  const root = document.getElementById('root');
  document.body.classList.add('view-' + view);

  let st = null, howOpen = false, cardKey = '';
  const L = () => (st && st.lang) || 'en';
  const T = (k, v) => I.t(L(), k, v);
  const tx = (item, f) => I.tx(L(), item, f);
  const exName = e => tx(e, 'name');
  const loc = () => I.locale(L());
  // During a festival (the 4 days before it and the day itself) every kuih wears that festival's outfit.
  let festCache = { day: '', f: null };
  const festival = () => { const k = dayKey(new Date()); if (festCache.day !== k) festCache = { day: k, f: festivalOn(new Date()) }; return festCache.f; };
  // Easter eggs (1.7.1): pyjamas from 11 pm to 5 am, and the flag-day outfit on the day you enter its code.
  const night = () => { const h = new Date().getHours(); return h >= 23 || h < 5; };
  const flagCode = () => !!st && st.flagDay === dayKey(new Date());
  const outfit = () => { if (night()) return 'pyjama'; if (flagCode()) return 'merdeka'; const f = festival(); return f ? f.id : undefined; };
  // Draw with the kuih the user picked (Kuih Lapis until the first state arrives).
  const lapis = (pose, label, bob, skin, golden) => window.lapisSVG(pose, label, bob, skin || (st && st.kuih) || 'lapis', outfit(), golden);
  const kuihName = () => (KUIH_BY[(st && st.kuih) || 'lapis'] || KUIH_BY.lapis).name;
  const doing = e => T('doing', { k: kuihName(), ex: exName(e).toLowerCase() });

  const $ = s => document.querySelector(s);
  const pad = n => String(n).padStart(2, '0');
  const mmss = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${pad(t % 60)}`; };
  const secsLabel = s => (s < 60 ? T('secs', { n: s }) : T('mins', { n: Math.round(s / 60) }));
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const fmtMin = m => new Date(2000, 0, 1, 0, m).toLocaleTimeString(loc(), { hour: 'numeric', minute: '2-digit', hour12: true });
  const fmtTime = ts => new Date(ts).toLocaleTimeString(loc(), { hour: 'numeric', minute: '2-digit', hour12: true });
  const whenLabel = ts => {
    if (!ts) return '';
    const d = new Date(ts);
    return dayKey(d) === dayKey(new Date()) ? fmtTime(ts) : `${d.toLocaleDateString(loc(), { weekday: 'short' })} ${fmtTime(ts)}`;
  };

  const todayRec = () => (st.history || {})[dayKey(new Date())] || { total: 0, by: {} };
  const curEx = () => BY[st.cur || st.upNext];
  const stats = () => computeStats(st.history, st.goal, st.workOn ? st.workDays : null, new Date(), { saver: st.streakSaver });
  // Kuih moods (1.9.0): the resting pose while waiting for the next stretch
  const moodPose = () => ({ sad: 'sad', drowsy: 'drowsy', proud: 'proud' }[st.mood] || 'idle');
  const isAvailable = id => !st.collect || st.codeUnlocked || STARTERS.includes(id) || own(st.unlocked || {}, id) || id === st.kuih;
  const collectedCount = () => KUIH.filter(k => isAvailable(k.id)).length;
  const ruleText = r => T('rule.' + r.type, { n: r.n });

  /* ---------- sound (played by the pop-up window) ---------- */
  let ac = null;
  // Volume (1.8.0): 70 is the original loudness.
  const vol = () => (st && Number.isFinite(st.volume) ? st.volume : 70) / 70;
  // Four chime sounds (1.8.0): bell (the original), marimba, soft and pop.
  const CHIME_STYLES = {
    bell: { type: 'sine', mul: 1, attack: 0.02, decay: 1.1, gap: 0.17, level: 1 },
    marimba: { type: 'triangle', mul: 1, attack: 0.005, decay: 0.45, gap: 0.14, level: 1.3, over: 4 },
    soft: { type: 'sine', mul: 0.5, attack: 0.09, decay: 1.5, gap: 0.24, level: 0.9 },
    pop: { type: 'square', mul: 1, attack: 0.004, decay: 0.13, gap: 0.11, level: 0.45, cut: 1800 }
  };
  function chime(kind) {
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const v = vol(); if (v <= 0) return;
      const c = CHIME_STYLES[st && st.chimeStyle] || CHIME_STYLES.bell;
      const notes = kind === 'due' ? [659.25, 880] : kind === 'done' ? [783.99, 987.77, 1174.66] : kind === 'water' ? [1046.5, 783.99] : [587.33];
      const peak = (kind === 'water' ? 0.14 : 0.22) * c.level * v, decay = kind === 'water' ? c.decay * 0.55 : c.decay;
      notes.forEach((f, i) => {
        const t = ac.currentTime + 0.05 + i * c.gap;
        const tone = (freq, p) => {
          const o = ac.createOscillator(), g = ac.createGain();
          o.type = c.type; o.frequency.value = freq;
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(p, t + c.attack); g.gain.exponentialRampToValueAtTime(0.0001, t + c.attack + decay);
          if (c.cut) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = c.cut; o.connect(fl); fl.connect(g); } else o.connect(g);
          g.connect(ac.destination); o.start(t); o.stop(t + c.attack + decay + 0.1);
        };
        tone(f * c.mul, Math.min(0.5, peak));
        if (c.over) tone(f * c.over, Math.min(0.5, peak) * 0.12);
      });
    } catch (e) { /* no audio device */ }
  }
  api.onChime(chime);

  /* ---------- shared reminder card ---------- */
  const CHECK = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="currentColor"/><path d="M5.5 10.4l3 3 6-6.4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function cardHTML(compact) {
    const ex = curEx(), m = st.mode, n = todayRec().by[ex.id] || 0;
    const pose = m === 'done' ? 'cheer' : m === 'snoozed' ? 'sleep' : ex.pose;
    const howto = `<details id="howto"${howOpen ? ' open' : ''}><summary>${T('card.how')}</summary><ol>${tx(ex, 'steps').map(s => `<li>${s}</li>`).join('')}</ol></details>`;
    let top = '', actions = '', links = '', extra = '';
    if (m === 'waiting') {
      top = `<p class="tag">${st.paused ? T('card.pausedNext') : T('card.upNext')}</p>`;
      actions = compact === 'today' ? `<span class="left">${secsLabel(ex.secs)}</span>` : `<button class="btn ghost" data-act="now" type="button">${T('btn.startNow')}</button><button class="linkbtn" data-act="different" type="button">${T('btn.different')}</button><span class="spacer"></span><span class="left">${secsLabel(ex.secs)}</span>`;
    } else if (m === 'due') {
      if (compact === true) top = `<p class="shout">${T('card.shout')}</p>`;
      actions = `<button class="btn" data-act="start" type="button">${T('btn.start')}</button><button class="btn ghost" data-act="snooze" type="button">${T('btn.snooze', { n: st.snooze })}</button><span class="spacer"></span><span class="left">${secsLabel(ex.secs)}</span>`;
      links = `<div class="links"><button class="linkbtn" data-act="different" type="button">${T('btn.different')}</button><button class="linkbtn" data-act="skip" type="button">${T('btn.skip')}</button></div>`;
    } else if (m === 'active') {
      actions = `<button class="btn pink" data-act="done" type="button">${T('btn.done')}</button><button class="btn ghost" data-act="stop" type="button">${T('btn.stop')}</button><span class="spacer"></span><span class="left" data-left>${T('card.left', { t: mmss(st.activeEnd - Date.now()) })}</span>`;
      if (ex.sides) extra = `<p class="side-hint">${st.switched ? T('card.otherSide') : T('card.firstSide', { k: kuihName() })}</p>`;
    } else if (m === 'done') {
      actions = `<p class="ok">${CHECK}${T('card.nice', { n: todayRec().total })}</p>`;
    } else if (m === 'snoozed') {
      actions = `<p class="cue">${T('card.seeYou', { n: st.snooze })}</p>`;
    }
    const showHow = m !== 'done' && m !== 'snoozed';
    if (st.golden && m !== 'waiting') top = `<p class="tag gold">${T('gold.tag')}</p>` + (compact === true ? '' : top);
    return `<div class="tile${st.golden ? ' gold' : ''}">${lapis(pose, doing(ex), m !== 'active', null, st.golden)}</div>
      <div class="body">${top}<div class="head"><h3>${exName(ex)}</h3><span class="count">${T('card.count', { n })}</span></div>
      <p class="cue">${tx(ex, 'cue')}</p><p class="dose">${tx(ex, 'dose')}</p>${extra}${showHow ? howto : ''}
      <div class="row">${actions}</div>${links}</div>
      ${m === 'active' ? '<div class="bar"><i data-bar></i></div>' : ''}`;
  }
  function renderCard(el, compact) {
    const key = [st.mode, st.cur, st.upNext, st.paused, st.switched, todayRec().total, st.snooze, st.kuih, L(), outfit(), st.golden].join('|');
    if (key === cardKey) return;
    if (st.mode === 'due' && !cardKey.startsWith('due')) howOpen = false;
    cardKey = key;
    el.className = 'card pop' + (st.mode === 'due' ? ' due' : '') + (st.golden && st.mode !== 'waiting' ? ' gold' : '');
    el.innerHTML = cardHTML(compact);
    const d = el.querySelector('#howto');
    if (d) d.addEventListener('toggle', () => { howOpen = d.open; });
    tickCard(el);
  }
  function tickCard(el) {
    if (!st || st.mode !== 'active' || !el) return;
    const left = st.activeEnd - Date.now();
    const b = el.querySelector('[data-bar]'), l = el.querySelector('[data-left]');
    if (b) b.style.width = Math.min(100, 100 * (1 - left / (st.activeSecs * 1000))) + '%';
    if (l) l.textContent = T('card.left', { t: mmss(left) });
  }

  /* ---------- clicks, selects and the secret code ---------- */
  function redeemFrom(id) { const inp = document.getElementById(id); if (inp && inp.value.trim()) api.act('redeem', { code: inp.value.slice(0, 64) }); }
  document.addEventListener('click', e => {
    const kt = e.target.closest('.kuih-tap');
    if (kt) { onKuihTap(kt); return; }
    const pg = e.target.closest('[data-page]');
    if (pg) { if (pg.dataset.ptab) ptab = pg.dataset.ptab; setPage(pg.dataset.page); return; }
    const mo = e.target.closest('[data-mon]');
    if (mo) { monthOff = Math.min(0, Math.max(-12, monthOff + Number(mo.dataset.mon))); if (st) renderMain(); return; }
    const pt = e.target.closest('[data-ptab]');
    if (pt) { ptab = pt.dataset.ptab; if (st) renderMain(); return; }
    const ob = e.target.closest('[data-ob]');
    if (ob) { obAction(ob.dataset.ob); return; }
    const a = e.target.closest('[data-act]');
    if (a) { api.act(a.dataset.act); return; }
    const x = e.target.closest('[data-ex]');
    if (x) { api.act('now', { ex: x.dataset.ex }); if (view === 'main') setPage('today'); return; }
    const sp = e.target.closest('[data-step]');
    if (sp) { api.act('set', { key: sp.dataset.step, value: (st[sp.dataset.step] || 0) + Number(sp.dataset.d) }); return; }
    const rd = e.target.closest('[data-redeem]');
    if (rd) { redeemFrom(rd.dataset.redeem); return; }
    const s = e.target.closest('[data-set]');
    if (s && s.tagName !== 'SELECT') {
      const k = s.dataset.set;
      api.act('set', { key: k, value: s.dataset.sval !== undefined ? s.dataset.sval : s.dataset.val !== undefined ? +s.dataset.val : !st[k] });
      return;
    }
    const rs = e.target.closest('#resetBtn');
    if (rs) { resetClick(rs); return; }
    const w = e.target.closest('[data-w]');
    if (w) api.act(w.dataset.w);
  });
  // "Reset my data" asks twice: the first click arms it for 5 seconds.
  let resetArmed = null;
  function resetClick(b) {
    if (resetArmed) { clearTimeout(resetArmed); resetArmed = null; b.textContent = T('set.resetBtn'); b.classList.remove('danger'); api.act('reset-data'); return; }
    b.textContent = T('set.resetConfirm'); b.classList.add('danger');
    resetArmed = setTimeout(() => { resetArmed = null; b.textContent = T('set.resetBtn'); b.classList.remove('danger'); }, 5000);
  }
  document.addEventListener('change', e => {
    const s = e.target.closest('select[data-set], input[type=range][data-set]');
    if (s) api.act('set', { key: s.dataset.set, value: +s.value });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches && e.target.matches('input[data-code]')) redeemFrom(e.target.id);
  });

  /* ---------- main window: sidebar app ---------- */
  const PAGES = [
    { id: 'today', icon: '<path d="M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-5V17H4a1 1 0 0 1-1-1z"/>' },
    { id: 'progress', icon: '<path d="M4 16V11M8.5 16V6M13 16V9M17 16V4"/>' },
    { id: 'stretches', icon: '<path d="M7 5h10M7 10h10M7 15h10"/><circle cx="3.5" cy="5" r="1"/><circle cx="3.5" cy="10" r="1"/><circle cx="3.5" cy="15" r="1"/>' },
    { id: 'kuih', icon: '<circle cx="10" cy="10" r="7"/><circle cx="7.5" cy="8.5" r=".6"/><circle cx="12.5" cy="8.5" r=".6"/><path d="M7.5 12.2q2.5 2 5 0"/>' },
    { id: 'settings', icon: '<path d="M3 6h8M15 6h2M3 14h2M9 14h8"/><circle cx="13" cy="6" r="2"/><circle cx="7" cy="14" r="2"/>' }
  ];
  const svgIcon = body => `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const switchRow = (k, title, sub, pre) => `<div class="set"><div class="lbl" id="${pre || ''}lbl-${k}">${title}<small>${sub}</small></div><button class="switch" role="switch" aria-labelledby="${pre || ''}lbl-${k}" data-set="${k}" type="button"></button></div>`;
  const segGroup = (key, label, vals, fmt) => `<div class="seg" role="group" aria-label="${esc(label)}">${vals.map(v => `<button type="button" data-set="${key}" data-val="${v}">${fmt(v)}</button>`).join('')}</div>`;
  const langSeg = () => `<div class="seg" role="group" aria-label="${esc(T('set.lang'))}"><button type="button" data-set="lang" data-sval="en" lang="en">English</button><button type="button" data-set="lang" data-sval="ms" lang="ms">Bahasa Melayu</button></div>`;
  const timeSelect = (key, label, from, to) => {
    const opts = []; for (let m = from; m <= to; m += 30) opts.push(`<option value="${m}">${fmtMin(m)}</option>`);
    return `<label class="tsel">${label}<select data-set="${key}">${opts.join('')}</select></label>`;
  };
  const numSelect = (key, label, vals, fmt) => `<label class="tsel">${label}<select data-set="${key}">${vals.map(v => `<option value="${v}">${fmt(v)}</option>`).join('')}</select></label>`;
  // starters only: the first-launch picker while collecting
  const kuihTiles = (size, onlyStarters) => KUIH_GROUPS.map(g => {
    const list = KUIH.filter(k => k.group === g.id && (!onlyStarters || STARTERS.includes(k.id)));
    return `<div class="kgroup"><h3>${tx(g, 'title')} <span>${tx(g, 'sub')}</span></h3><div class="kgrid ${size}">${list.map(k => `<button type="button" class="ktile" data-set="kuih" data-sval="${k.id}" data-kid="${k.id}" aria-pressed="false" title="${esc(tx(k, 'note'))}"><span class="kimg">${lapis('idle', k.name, false, k.id)}</span><b>${k.name}</b><span class="khint"></span><span class="kprog" aria-hidden="true"><i></i></span></button>`).join('')}</div></div>`;
  }).join('');
  const obKuih = () => (st.collect && !st.codeUnlocked ? `<div class="ob-kuih ob-starters"><div class="kgrid small four">${STARTERS.map(id => { const k = KUIH_BY[id]; return `<button type="button" class="ktile" data-set="kuih" data-sval="${k.id}" data-kid="${k.id}" aria-pressed="false" title="${esc(tx(k, 'note'))}"><span class="kimg">${lapis('idle', k.name, false, k.id)}</span><b>${k.name}</b></button>`; }).join('')}</div></div>` : `<div class="ob-kuih">${kuihTiles('small')}</div>`);

  let page = 'today', ptab = 'stretches', obForce = false, obStep = 0, monthOff = 0;
  function setPage(p) {
    if (!PAGES.some(x => x.id === p)) return;
    page = p;
    const c = $('#content'); if (c) c.scrollTop = 0;
    if (st) renderMain();
  }

  function buildMain() {
    const days = T('days').split(',');
    root.innerHTML = `
    <div class="shell">
      <nav class="side-nav" aria-label="Lapis">
        <div class="nav-brand"><button type="button" class="logo kuih-tap" id="logo" aria-label="${esc(T('w.kuih'))}"></button><span class="nav-title">Lapis</span></div>
        ${PAGES.map(p => `<button type="button" class="nav-item" data-page="${p.id}" aria-label="${esc(T('nav.' + p.id))}" title="${esc(T('nav.' + p.id))}">${svgIcon(p.icon)}<span>${T('nav.' + p.id)}</span></button>`).join('')}
        <div class="nav-spacer"></div>
        <button type="button" class="nav-item nav-pause" data-w="pause-menu" id="navPause">${svgIcon('<rect x="5" y="4" width="3.2" height="12" rx="1"/><rect x="11.8" y="4" width="3.2" height="12" rx="1"/>')}</button>
        <div class="nav-status">
          <p class="ns-title" id="nsTitle"></p>
          <p class="ns-sub" id="nsSub"></p>
          <button class="btn ghost small" data-w="pause-menu" id="pauseBtn" type="button"></button>
        </div>
        <p class="nav-version" id="navVersion"></p>
      </nav>

      <div class="content" id="content">
        <div class="update-bar" id="updateBar" hidden><span id="updateText"></span><button class="btn" id="updateBtn" type="button" hidden></button></div>

        <section class="page" id="page-today" aria-labelledby="h-today">
          <header class="page-head"><h1 id="h-today">${T('today.title')}</h1><p id="todayDate"></p></header>
          <div class="fest-banner" id="festBanner" hidden><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 8.3l5-.7z"/></svg><span id="festText"></span></div>
          <div class="banner" id="banner" hidden><strong>${T('banner.title')}</strong><span>${T('banner.sub')}</span></div>
          <section class="hero" aria-label="${esc(T('clock.next'))}">
            <div class="ring" id="ring">
              <svg class="r" viewBox="0 0 132 132" aria-hidden="true"><circle class="track" cx="66" cy="66" r="58"/><circle class="arc" id="arc" cx="66" cy="66" r="58"/></svg>
              <button type="button" class="ring-mascot kuih-tap" id="heroMascot" aria-label="${esc(T('w.kuih'))}"></button>
            </div>
            <div class="hero-text"><p class="eyebrow" id="clockLabel"></p><p class="time" id="clockTime">--:--</p><p class="sub" id="clockSub"></p></div>
            <div class="hero-actions" id="heroActions">
              <button class="btn work-only" data-act="now" type="button">${T('btn.startNow')}</button>
              <button class="btn ghost work-only" data-act="different" type="button">${T('btn.different')}</button>
              <button class="btn ghost rest-only" data-act="now" type="button">${T('btn.anyway')}</button>
            </div>
          </section>
          <article class="card" id="card" hidden></article>
          <div class="today-cards">
            <section class="panel tpanel" aria-labelledby="h-goal">
              <div class="tp-head"><h2 id="h-goal">${T('goal.title')}</h2><button class="linkbtn" data-page="progress" data-ptab="stretches" type="button">${T('btn.seeProgress')}</button></div>
              <div class="big"><b id="todayCount">0</b><span id="goalOf"></span></div>
              <div class="gbar" id="goalBar" aria-hidden="true"></div>
              <p class="tp-note" id="goalNote"></p>
            </section>
            <section class="panel tpanel" aria-labelledby="h-water" id="waterPanel">
              <div class="tp-head"><h2 id="h-water">${T('water.title')}</h2><button class="linkbtn" data-page="progress" data-ptab="water" type="button">${T('btn.seeProgress')}</button></div>
              <div class="glasses" id="glasses"></div>
              <p class="tp-note" id="waterNote"></p>
              <button class="btn soft small" data-w="water-add" type="button" id="waterBtn">${T('water.drank')}</button>
            </section>
            <section class="panel tpanel next-kuih" aria-labelledby="h-next">
              <div class="nk-img" id="nkImg"></div>
              <div class="nk-body"><h2 id="h-next">${T('next.title')}</h2><p id="nkText"></p><div class="pbar" aria-hidden="true"><i id="nkBar"></i></div><p class="tp-note" id="nkProg"></p></div>
            </section>
          </div>
          <section class="coming" aria-labelledby="h-coming">
            <h2 id="h-coming">${T('coming.title')}</h2>
            <div class="coming-list" id="coming"></div>
          </section>
        </section>

        <section class="page" id="page-stretches" aria-labelledby="h-str" hidden>
          <header class="page-head"><h1 id="h-str">${T('str.title')}</h1><p>${T('str.sub')}</p></header>
          <div class="lib big" id="lib"></div>
        </section>

        <section class="page" id="page-kuih" aria-labelledby="h-kuih" hidden>
          <header class="page-head kuih-head"><div><h1 id="h-kuih">${T('kuih.title')}</h1><p id="kuihSub"></p></div><div class="pbar wide" id="colBarWrap" aria-hidden="true"><i id="colBar"></i></div></header>
          <div class="kuih-layout">
            <div class="kuih-groups">${kuihTiles('')}</div>
            <aside class="kuih-side">
              <section class="panel kuih-sel" aria-label="${esc(T('kuih.buddy'))}">
                <div class="kuih-big" id="kuihBig"></div>
                <div class="kuih-info"><h2 id="kuihName"></h2><span class="chip" id="kuihOrigin"></span><p id="kuihNote"></p><p class="buddy">${T('kuih.buddy')}</p></div>
              </section>
              <section class="panel code-card" id="codeCard">
                <label for="codeIn" class="code-lbl">${T('code.title')}</label>
                <input id="codeIn" data-code type="text" autocomplete="off" spellcheck="false" maxlength="64" placeholder="${esc(T('code.ph'))}">
                <button class="btn" data-redeem="codeIn" type="button">${T('code.btn')}</button>
                <p class="code-msg" id="codeMsg" aria-live="polite"></p>
              </section>
              <section class="panel gold-card" id="goldCard" hidden aria-labelledby="h-gold"><h2 id="h-gold">${T('gold.title')}</h2><p class="gold-sub" id="goldSub"></p><div class="gold-list" id="goldList"></div></section>
            </aside>
          </div>
        </section>

        <section class="page" id="page-progress" aria-labelledby="h-prog" hidden>
          <header class="page-head prog-head"><div><h1 id="h-prog">${T('prog.title')}</h1><p id="progSub"></p></div>
            <div class="seg ptabs" role="tablist" aria-label="${esc(T('prog.title'))}">
              <button type="button" role="tab" id="tab-stretches" data-ptab="stretches" aria-controls="ptab-stretches">${T('prog.tabStretches')}</button>
              <button type="button" role="tab" id="tab-water" data-ptab="water" aria-controls="ptab-water">${T('prog.tabWater')}</button>
            </div>
          </header>
          <div class="ptab" id="ptab-stretches" role="tabpanel" aria-labelledby="tab-stretches">
            <div class="stats">
              <div class="panel stat"><b id="stToday">0</b><span>${T('prog.today')}</span></div>
              <div class="panel stat"><b id="stWeek">0</b><span>${T('prog.week')}</span></div>
              <div class="panel stat"><b id="stBest">0</b><span>${T('prog.best')}</span></div>
              <div class="panel stat" title="${esc(T('prog.streakHint'))}"><b id="stStreak">0</b><span>${T('prog.streak')}</span><small class="saver" id="stSaver"></small></div>
            </div>
            <section class="panel"><h2>${T('prog.last7')}</h2><div class="week tall" id="weekBig"></div></section>
            <section class="panel month-panel" id="monthStretches"></section>
            <section class="panel"><h2>${T('prog.byStretch')}</h2><div class="bylist" id="byList"></div></section>
          </div>
          <div class="ptab" id="ptab-water" role="tabpanel" aria-labelledby="tab-water" hidden>
            <div class="stats water">
              <div class="panel stat"><b id="pwToday">0</b><span>${T('prog.waterToday')}</span></div>
              <div class="panel stat"><b id="pwWeek">0</b><span>${T('prog.waterWeek')}</span></div>
              <div class="panel stat"><b id="pwAvg">0</b><span>${T('prog.waterAvg')}</span></div>
              <div class="panel stat"><b id="pwGoal">0</b><span id="pwGoalLbl"></span></div>
            </div>
            <section class="panel"><h2>${T('prog.last7')}</h2><div class="week tall water" id="waterBig"></div></section>
            <section class="panel month-panel" id="monthWater"></section>
          </div>
        </section>

        <section class="page" id="page-settings" aria-labelledby="h-set" hidden>
          <header class="page-head"><h1 id="h-set">${T('set.title')}</h1></header>
          <div class="settings-cols">
            <div class="settings-col">
              <section class="panel settings"><h2>${T('set.reminders')}</h2>
                <div class="set"><div class="lbl">${T('set.every')}<small>${T('set.everySub')}</small></div>${segGroup('interval', T('set.every'), [15, 20, 30, 45, 60], v => v)}</div>
                <div class="set"><div class="lbl">${T('set.snooze')}<small>${T('set.snoozeSub')}</small></div>${segGroup('snooze', T('set.snooze'), [5, 10, 15], v => T('mins', { n: v }))}</div>
                ${switchRow('sound', T('set.sound'), T('set.soundSub'))}
                <div class="set stack" id="chimeRows"><div class="lbl">${T('set.chimeStyle')}</div>
                  <div class="seg" role="group" aria-label="${esc(T('set.chimeStyle'))}">${['bell', 'marimba', 'soft', 'pop'].map(c => `<button type="button" data-set="chimeStyle" data-sval="${c}">${T('chime.' + c)}</button>`).join('')}</div>
                  <div class="vol-row"><label for="volIn">${T('set.volume')}</label><input id="volIn" type="range" min="0" max="100" step="10" data-set="volume"><button class="btn ghost small" data-w="test-chime" type="button">${T('set.test')}</button></div>
                </div>
                ${switchRow('toast', T('set.toast'), T('set.toastSub'))}
              </section>
              <section class="panel settings"><h2>${T('set.work')}</h2>
                ${switchRow('workOn', T('set.workOn'), T('set.workOnSub'))}
                <div class="set stack"><div class="lbl">${T('set.days')}</div><div class="days" role="group" aria-label="${esc(T('set.days'))}">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button type="button" class="day" data-set="workDay" data-val="${d}" aria-pressed="false">${days[d]}</button>`).join('')}</div></div>
                <div class="set tsels">${timeSelect('workStart', T('set.from'), 300, 780)}${timeSelect('workEnd', T('set.to'), 720, 1410)}</div>
                ${switchRow('lunchOn', T('set.lunch'), T('set.lunchSub'))}
                <div class="set tsels" id="lunchTimes">${timeSelect('lunchStart', T('set.from'), 660, 900)}${timeSelect('lunchEnd', T('set.to'), 690, 960)}</div>
                ${switchRow('wrapOn', T('set.wrap'), T('set.wrapSub'))}
              </section>
              <section class="panel settings"><h2>${T('set.meetBreaks')}</h2>
                ${switchRow('quietMeetings', T('set.quiet'), T('set.quietSub') + ' ' + T('set.quietHow'))}
                ${switchRow('awayReset', T('set.awayReset'), T('set.awayResetSub'))}
                ${switchRow('ramadanOn', T('set.ramadan'), T('set.ramadanSub'))}
              </section>
            </div>
            <div class="settings-col">
              <section class="panel settings"><h2>${T('set.goal')}</h2>
                <div class="set"><div class="lbl">${T('set.goalN')}<small>${T('set.goalSub')}</small></div><div class="stepper"><button type="button" class="stp" data-step="goal" data-d="-1" aria-label="${esc(T('set.fewer'))}">−</button><b id="goalVal">8</b><button type="button" class="stp" data-step="goal" data-d="1" aria-label="${esc(T('set.more'))}">+</button></div></div>
                ${switchRow('streakSaver', T('set.saver'), T('set.saverSub'))}
                ${switchRow('summaryOn', T('set.summary'), T('set.summarySub'))}
              </section>
              <section class="panel settings"><h2>${T('set.water')}</h2>
                ${switchRow('waterOn', T('set.waterOn'), T('set.waterOnSub'))}
                <div class="set tsels">${numSelect('waterEvery', T('set.waterEvery'), [30, 45, 60, 90, 120], v => (v === 60 ? T('hour') : v === 120 ? T('hours', { n: 2 }) : v === 90 ? T('hours', { n: 1.5 }) : T('minsShort', { n: v })))}${numSelect('waterGoal', T('set.waterGoal'), [4, 5, 6, 7, 8, 9, 10, 11, 12], v => v)}</div>
              </section>
              <section class="panel settings"><h2>${T('set.collect')}</h2>
                ${switchRow('collect', T('set.collectOn'), T('set.collectOnSub'))}
                <div class="set stack"><label class="lbl" for="codeIn2">${T('code.title')}</label><div class="code-row"><input id="codeIn2" data-code type="text" autocomplete="off" spellcheck="false" maxlength="64" placeholder="${esc(T('code.ph'))}"><button class="btn" data-redeem="codeIn2" type="button">${T('code.btn')}</button></div><p class="code-msg" id="codeMsg2" aria-live="polite"></p></div>
              </section>
              <section class="panel settings"><h2>${T('set.display')}</h2>
                <div class="set"><div class="lbl">${T('set.lang')}</div>${langSeg()}</div>
                <div class="set"><div class="lbl">${T('set.textSize')}</div><div class="seg" role="group" aria-label="${esc(T('set.textSize'))}">${['normal', 'large', 'larger'].map(m => `<button type="button" data-set="textSize" data-sval="${m}">${T('text.' + m)}</button>`).join('')}</div></div>
                <div class="set"><div class="lbl">${T('set.theme')}</div><div class="seg" role="group" aria-label="${esc(T('set.theme'))}">${['auto', 'light', 'dark'].map(m => `<button type="button" data-set="theme" data-sval="${m}">${T('theme.' + m)}</button>`).join('')}</div></div>
                ${switchRow('widget', T('set.widget'), T('set.widgetSub'))}${switchRow('widgetOnTop', T('set.onTop'), T('set.onTopSub'))}${switchRow('widgetHideFull', T('set.hideFull'), T('set.hideFullSub'))}${switchRow('trayRing', T('set.trayRing'), T('set.trayRingSub'))}${switchRow('autostart', T('set.autostart'), T('set.autostartSub'))}
              </section>
            </div>
          </div>
          <section class="panel settings about-card"><h2>${T('set.aboutUpd')}</h2>
            <div class="about-grid">
              <div>
                <div class="set"><div class="lbl">${T('set.version')} <span id="version"></span><small id="updateMsg" aria-live="polite"></small></div><button class="btn ghost" data-w="check-update" id="checkBtn" type="button">${T('set.check')}</button></div>
                ${switchRow('autoUpdate', T('set.autoUpdate'), T('set.autoUpdateSub'))}
                <div class="set"><div class="lbl">${T('set.reset')}<small id="resetMsg" aria-live="polite">${T('set.resetSub')}</small></div><button class="btn ghost" id="resetBtn" type="button">${T('set.resetBtn')}</button></div>
              </div>
              <div class="about-text"><p class="note-p">${T('set.aboutText')}</p><button class="btn ghost" data-ob="open" type="button">${T('set.welcome')}</button></div>
            </div>
          </section>
        </section>
      </div>
    </div>

    <div class="onboard" id="onboard" role="dialog" aria-modal="true" aria-labelledby="obTitle0" hidden>
      <div class="ob-card">
        <div class="ob-steps" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <div class="ob-body ob-center" data-step="0">
          <div class="ob-hero" id="obWave"></div>
          <h2 id="obTitle0">${T('ob.hi')}</h2>
          <p>${T('ob.hiText')}</p>
          ${langSeg()}
        </div>
        <div class="ob-body" data-step="1" hidden>
          <h2>${T('ob.who')}</h2>
          <p>${st.collect && !st.codeUnlocked ? T('ob.whoCollect') : T('ob.whoText')}</p>
          ${obKuih()}
        </div>
        <div class="ob-body" data-step="2" hidden>
          <h2>${T('ob.often')}</h2>
          <p>${T('ob.oftenText')}</p>
          <div class="panel settings ob-settings">
            <div class="set"><div class="lbl">${T('set.every')}<small>${T('set.everySub')}</small></div>${segGroup('interval', T('set.every'), [15, 20, 30, 45, 60], v => v)}</div>
            ${switchRow('autostart', T('set.autostart'), T('set.autostartSub'), 'ob-')}
            ${switchRow('widget', T('set.widget'), T('set.widgetSub'), 'ob-')}
          </div>
        </div>
        <div class="ob-body ob-center" data-step="3" hidden>
          <div class="ob-hero" id="obCheer"></div>
          <h2 id="obDoneTitle"></h2>
          <p>${T('ob.doneText')}</p>
        </div>
        <div class="ob-actions">
          <button class="linkbtn" data-ob="skip" type="button" id="obSkip">${T('ob.skip')}</button>
          <span class="spacer"></span>
          <button class="btn ghost" data-ob="back" type="button" id="obBack">${T('ob.back')}</button>
          <button class="btn" data-ob="next" type="button" id="obNext"></button>
        </div>
      </div>
    </div>`;
  }

  let heroKey = '', kuihKey = '', comingKey = '';
  function renderKuihParts() {
    const key = [st.kuih, L(), outfit()].join('|');
    if (kuihKey === key) return;
    kuihKey = key;
    const k = KUIH_BY[st.kuih] || KUIH_BY.lapis;
    $('#logo').innerHTML = lapis('wave', k.name);
    $('#lib').innerHTML = EX.map(e => `<button type="button" data-ex="${e.id}"><div class="mini">${lapis(e.pose, doing(e))}</div><b>${exName(e)}</b><span>${tx(e, 'dose')}</span><small>${tx(e, 'cue')}</small></button>`).join('');
    $('#kuihBig').innerHTML = lapis('wave', k.name);
    $('#kuihName').textContent = k.name;
    $('#kuihOrigin').textContent = tx(k, 'origin');
    $('#kuihNote').textContent = tx(k, 'note');
    $('#obWave').innerHTML = lapis('wave', k.name);
    $('#obCheer').innerHTML = lapis('cheer', k.name);
    heroKey = ''; comingKey = '';
  }
  function renderCollection(s) {
    const collecting = st.collect && !st.codeUnlocked, n = collectedCount();
    $('#kuihSub').textContent = collecting ? T('kuih.collected', { n }) : T('kuih.sub');
    $('#colBarWrap').hidden = !collecting;
    $('#colBar').style.width = (n / KUIH.length * 100) + '%';
    document.querySelectorAll('.ktile').forEach(b => {
      const id = b.dataset.kid, ok = isAvailable(id), r = D.RULE_BY[id];
      b.setAttribute('aria-pressed', String(id === st.kuih));
      b.disabled = !ok;
      b.classList.toggle('locked', !ok);
      const hint = b.querySelector('.khint'), bar = b.querySelector('.kprog i');
      if (!hint) return;
      if (!ok && r) {
        const p = ruleProgress(r, s);
        hint.textContent = `${ruleText(r)} · ${T('rule.progress', { have: p.have, need: p.need })}`;
        bar.style.width = (p.have / p.need * 100) + '%';
        b.setAttribute('aria-label', T('kuih.lockedAria', { k: KUIH_BY[id].name, rule: ruleText(r) }));
      } else { hint.textContent = ''; b.removeAttribute('aria-label'); }
    });
    $('#codeCard').hidden = false;
    const cm = st.codeMsg ? T('code.' + st.codeMsg) : '';
    ['#codeMsg', '#codeMsg2'].forEach(id => { const el = $(id); el.textContent = cm; el.className = 'code-msg' + (st.codeMsg ? (st.codeMsg === 'bad' ? ' bad' : ' ok') : ''); });
    if (st.codeMsg && st.codeMsg !== 'bad') ['#codeIn', '#codeIn2'].forEach(id => { $(id).value = ''; });
    renderGold();
  }
  // Golden kuih found so far: a hidden section that appears after the first one turns up.
  let goldKey = '';
  function renderGold() {
    const found = Object.entries(st.goldFound || {}).filter(([id]) => KUIH_BY[id]).sort((a, b) => (a[1] < b[1] ? -1 : 1));
    $('#goldCard').hidden = !found.length;
    const key = found.map(f => f.join(':')).join(',') + L();
    if (!found.length || key === goldKey) return;
    goldKey = key;
    $('#goldSub').textContent = T('gold.sub', { n: found.length });
    $('#goldList').innerHTML = found.map(([id, d]) => { const [y, m, dd] = d.split('-').map(Number); return `<div class="gold-k">${lapis('cheer', KUIH_BY[id].name, false, id, true)}<b>${esc(KUIH_BY[id].name)}</b><span>${T('gold.found', { date: new Date(y, m - 1, dd, 12).toLocaleDateString(loc(), { day: 'numeric', month: 'short', year: 'numeric' }) })}</span></div>`; }).join('');
  }
  function renderNextKuih(s) {
    const collecting = st.collect && !st.codeUnlocked;
    const next = collecting ? RULES.find(r => !isAvailable(r.id)) : null;
    const key = next ? next.id + '|' + L() + '|' + outfit() : 'all|' + st.kuih + '|' + L() + '|' + outfit();
    if ($('#nkImg').dataset.key !== key) {
      $('#nkImg').dataset.key = key;
      $('#nkImg').innerHTML = next ? lapis('idle', '', false, next.id) : lapis('cheer', kuihName());
      $('#nkImg').classList.toggle('locked', !!next);
    }
    if (next) {
      const p = ruleProgress(next, s);
      $('#nkText').innerHTML = `<b>${esc(KUIH_BY[next.id].name)}</b>: ${esc(ruleText(next))}`;
      $('#nkBar').style.width = (p.have / p.need * 100) + '%';
      $('#nkBar').parentElement.hidden = false;
      $('#nkProg').textContent = T('rule.progress', { have: p.have, need: p.need });
    } else {
      $('#nkText').innerHTML = `<b>${esc(T('next.all'))}</b>`;
      $('#nkBar').parentElement.hidden = true;
      $('#nkProg').textContent = T('next.allSub');
    }
  }
  const GLASS = fill => `<svg width="22" height="28" viewBox="0 0 22 28" aria-hidden="true"><path d="M2 2 H20 L17.5 26 H4.5 Z" fill="${fill}" stroke="var(--m-ink)" stroke-width="2" stroke-linejoin="round"/></svg>`;
  const glasses = (n, g) => Array.from({ length: g }, (_, i) => GLASS(i < n ? '#5BC0EB' : 'var(--glass)')).join('');
  function renderToday(s) {
    const tr = todayRec(), g = st.goal;
    $('#todayCount').textContent = tr.total;
    $('#goalOf').textContent = T('goal.of', { n: g });
    $('#goalBar').innerHTML = Array.from({ length: g }, (_, i) => `<i class="${i < tr.total ? 'on' : ''}"></i>`).join('');
    $('#goalNote').textContent = tr.total >= g ? T('goal.met') : T('goal.more', { n: g - tr.total });
    const w = tr.water || 0;
    $('#glasses').innerHTML = glasses(w, st.waterGoal);
    $('#glasses').setAttribute('aria-label', T('water.count', { n: w, g: st.waterGoal }));
    $('#waterNote').textContent = !st.waterOn ? T('water.off') : st.ramadan ? T('water.count', { n: w, g: st.waterGoal }) + ' · ' + T('water.ramadan')
      : T('water.count', { n: w, g: st.waterGoal }) + (st.nextWater ? ' · ' + T('water.next', { time: fmtTime(st.nextWater) }) : '');
    renderNextKuih(s);
    const f = festival(), fb = $('#festBanner');
    fb.hidden = !f && !st.ramadan;
    if (f) {
      const name = T('fest.' + f.id), k = kuihName();
      $('#festText').textContent = f.daysLeft === 0 ? T('fest.day', { greet: T('greet.' + f.id), k }) : f.daysLeft === 1 ? T('fest.tomorrow', { fest: name, k }) : T('fest.soon', { fest: name, n: f.daysLeft, k });
    } else if (st.ramadan) $('#festText').textContent = T('ram.banner', { n: st.ramadan.day });
  }
  function renderComing() {
    const n = CYCLE.length, key = [st.idx, st.kuih, L(), outfit(), !!st.ramadan].join('|');
    if (key === comingKey) return;
    comingKey = key;
    const ids = [];
    for (let i = 1; ids.length < 4 && i <= n * 2; i++) { const id = CYCLE[(st.idx + i) % n]; if (!(st.ramadan && id === 'walk')) ids.push(id); }
    $('#coming').innerHTML = ids.map(id => { const e = BY[id]; return `<button type="button" class="coming-item" data-ex="${e.id}" title="${esc(T('coming.do', { ex: exName(e) }))}"><span class="ci-img">${lapis(e.pose, doing(e))}</span><b>${exName(e)}</b></button>`; }).join('');
  }

  function lastDays(count, field) {
    const out = [], DN = T('days').split(',');
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const h = (st.history || {})[dayKey(d)];
      out.push({ l: i === 0 ? T('prog.dayToday') : DN[d.getDay()], n: h ? (h[field || 'total'] || 0) : 0, today: i === 0 });
    }
    return out;
  }
  function weekBars(days, maxH, goal) {
    const max = Math.max(goal || st.goal || 8, ...days.map(d => d.n));
    return days.map(d => `<div class="d${d.today ? ' today' : ''}${d.n ? ' has' : ''}"><span class="n">${d.n || ''}</span><div class="b" style="height:${Math.max(6, (d.n / max) * maxH)}px"></div><span class="l">${d.l}</span></div>`).join('');
  }
  /* Month calendar (1.7.0): one square per day, darker the closer you got to your goal. */
  function monthHTML(field, goal) {
    const now = new Date(), first = new Date(now.getFullYear(), now.getMonth() + monthOff, 1, 12);
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(), lead = (first.getDay() + 6) % 7;
    const DN = T('days').split(','), heads = [1, 2, 3, 4, 5, 6, 0].map(d => `<span class="mh">${DN[d]}</span>`).join('');
    const work = st.workOn ? st.workDays : null, h = st.history || {}, tk = dayKey(now);
    let cells = '', atGoal = 0;
    for (let i = 0; i < lead; i++) cells += '<span class="mc pad"></span>';
    for (let d = 1; d <= days; d++) {
      const day = new Date(first.getFullYear(), first.getMonth(), d, 12), k = dayKey(day), rec = h[k], n = rec ? (rec[field] || 0) : 0;
      const future = k > tk, lvl = !n ? 0 : n >= goal ? 4 : Math.min(3, 1 + Math.floor(n / goal * 3));
      if (n >= goal) atGoal++;
      const off = work && !work.includes(day.getDay());
      const label = `${day.toLocaleDateString(loc(), { weekday: 'long', day: 'numeric', month: 'long' })}: ${n}`;
      cells += `<span class="mc l${lvl}${future ? ' future' : ''}${off ? ' off' : ''}${k === tk ? ' today' : ''}" title="${esc(label)}" aria-label="${esc(label)}" role="img">${d}</span>`;
    }
    const title = first.toLocaleDateString(loc(), { month: 'long', year: 'numeric' });
    const leg = [0, 1, 2, 3, 4].map(l => `<span class="mc l${l}" aria-hidden="true"></span>`).join('');
    // the month's numbers beside the calendar (1.8.0)
    let total = 0, best = null, workSoFar = 0;
    for (let d = 1; d <= days; d++) {
      const day = new Date(first.getFullYear(), first.getMonth(), d, 12), k = dayKey(day);
      if (k > tk) break;
      const n = h[k] ? (h[k][field] || 0) : 0;
      total += n;
      if (n > 0 && (!best || n > best.n)) best = { n, day };
      if (!work || work.includes(day.getDay())) workSoFar++;
    }
    const avg = workSoFar ? Math.round(total / workSoFar * 10) / 10 : 0;
    const stat = (b, l) => `<div class="mstat"><b>${b}</b><span>${l}</span></div>`;
    const side = `<div class="mstats">${stat(total, field === 'water' ? T('prog.mTotalW') : T('prog.mTotal'))}${stat(atGoal, field === 'water' ? T('prog.monthWaterShort', { g: goal }) : T('prog.mGoal'))}${stat(avg.toLocaleString(loc()), T('prog.mAvg'))}${stat(best ? best.n : '–', best ? T('prog.mBestOn', { date: best.day.toLocaleDateString(loc(), { weekday: 'short', day: 'numeric', month: 'short' }) }) : T('prog.mBest'))}</div>`;
    return `<div class="month-head"><h2>${esc(title)}</h2><span class="spacer"></span>
        <button type="button" class="mnav" data-mon="-1" aria-label="${esc(T('prog.prevMonth'))}" title="${esc(T('prog.prevMonth'))}"${monthOff <= -12 ? ' disabled' : ''}>‹</button>
        <button type="button" class="mnav" data-mon="1" aria-label="${esc(T('prog.nextMonth'))}" title="${esc(T('prog.nextMonth'))}"${monthOff >= 0 ? ' disabled' : ''}>›</button></div>
      <div class="month-wrap"><div><div class="month ${field === 'water' ? 'water' : ''}">${heads}${cells}</div>
      <div class="month-legend">${T('prog.less')} ${leg} ${T('prog.more')} <span class="spacer"></span><span class="mc l4" aria-hidden="true"></span> ${T('prog.atGoal')}</div></div>${side}</div>`;
  }
  function renderProgress(s) {
    const days = lastDays(7), sum = days.reduce((a, d) => a + d.n, 0), tr = todayRec();
    $('#progSub').textContent = ptab === 'water' ? T('prog.subWater') : T('prog.sub');
    ['stretches', 'water'].forEach(id => { $('#ptab-' + id).hidden = ptab !== id; $('#tab-' + id).setAttribute('aria-selected', String(ptab === id)); $('#tab-' + id).setAttribute('aria-pressed', String(ptab === id)); });
    $('#stToday').textContent = tr.total;
    $('#stWeek').textContent = sum;
    $('#stBest').textContent = Math.max(0, ...days.map(d => d.n));
    $('#stStreak').textContent = s.streak;
    $('#stSaver').textContent = !st.streakSaver || !s.streak ? '' : s.saverUsed ? T('prog.saverUsed') : T('prog.saverLeft');
    $('#weekBig').innerHTML = weekBars(days, 150);
    const wd = lastDays(7, 'water'), wsum = wd.reduce((x, d) => x + d.n, 0), g = st.waterGoal;
    $('#pwToday').textContent = todayRec().water || 0;
    $('#pwWeek').textContent = wsum;
    $('#pwAvg').textContent = (Math.round(wsum / 7 * 10) / 10).toLocaleString(loc());
    $('#pwGoal').textContent = wd.filter(d => d.n >= g).length;
    $('#pwGoalLbl').textContent = T('prog.waterGoalDays', { g });
    $('#waterBig').innerHTML = weekBars(wd, 150, g);
    if (ptab === 'water') $('#monthWater').innerHTML = monthHTML('water', g); else $('#monthStretches').innerHTML = monthHTML('total', st.goal);
    const by = Object.entries(tr.by || {}).filter(([id, n]) => own(BY, id) && Number.isInteger(n)).sort((a, b) => b[1] - a[1]);
    const top = Math.max(1, ...by.map(([, n]) => n));
    $('#byList').innerHTML = by.length
      ? by.map(([id, n]) => `<div class="byrow"><span>${exName(BY[id])}</span><div class="bybar"><i style="width:${(n / top) * 100}%"></i></div><b>${n}</b></div>`).join('')
      : `<p class="empty">${T('prog.empty')}</p>`;
  }

  function renderOnboarding() {
    const show = st.onboarded === false || obForce;
    $('#onboard').hidden = !show;
    if (!show) return;
    document.querySelectorAll('.ob-body').forEach(b => { b.hidden = +b.dataset.step !== obStep; });
    document.querySelectorAll('.ob-steps i').forEach((d, i) => d.classList.toggle('on', i <= obStep));
    $('#obBack').hidden = obStep === 0;
    $('#obSkip').hidden = obStep === 3;
    $('#obNext').textContent = [T('ob.go'), T('ob.next'), T('ob.next'), T('ob.finish')][obStep];
    $('#obDoneTitle').textContent = T('ob.seeYou', { n: st.interval });
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
    const s = stats();
    renderKuihParts();
    // navigation
    document.querySelectorAll('.nav-item[data-page]').forEach(b => {
      if (b.dataset.page === page) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      b.classList.toggle('alert', b.dataset.page === 'today' && (st.mode === 'due' || st.mode === 'active'));
    });
    PAGES.forEach(p => { $('#page-' + p.id).hidden = p.id !== page; });
    // sidebar status
    $('#nsTitle').textContent = st.paused ? T('ns.paused') : st.resting ? T('ns.resting') : st.quiet ? T('ns.quiet') : T('ns.on');
    $('#nsSub').textContent = st.paused ? (st.pauseUntil ? T('ns.pausedUntil', { when: whenLabel(st.pauseUntil) }) : T('ns.resume')) : st.resting ? T('ns.back', { when: whenLabel(st.backAt) })
      : (st.workOn ? T('ns.hours', { n: st.interval, from: fmtMin(st.workStart), to: fmtMin(st.workEnd) }) : T('ns.every', { n: st.interval })) + (st.awayReset ? T('ns.away') : '');
    $('#pauseBtn').textContent = st.paused ? T('resume') : T('pause');
    $('#navPause').setAttribute('aria-label', st.paused ? T('resume') : T('pause'));
    $('#navPause').title = $('#navPause').getAttribute('aria-label');
    $('#navVersion').textContent = T('version', { v: st.version || '' }) + (st.update && st.update.state === 'ready' ? T('version.ready') : '');
    // today
    $('#todayDate').textContent = new Date().toLocaleDateString(loc(), { weekday: 'long', day: 'numeric', month: 'long' });
    const card = $('#card');
    card.hidden = st.mode === 'waiting';
    if (!card.hidden) renderCard(card, 'today'); else cardKey = '';
    $('#banner').hidden = st.mode !== 'due';
    $('#heroActions').hidden = st.mode !== 'waiting';
    $('#heroActions').classList.toggle('resting', !!(st.resting && !st.paused));
    const pose = st.mode === 'due' ? 'wave' : st.mode === 'done' ? 'cheer' : st.mode === 'active' ? curEx().pose : st.quiet ? 'shh' : (st.paused || st.away || st.resting) ? 'sleep' : moodPose();
    if (pose + outfit() + st.golden !== heroKey) { heroKey = pose + outfit() + st.golden; $('#heroMascot').innerHTML = lapis(pose, kuihName(), st.mode !== 'active', null, st.golden); }
    $('#ring').classList.toggle('due', st.mode === 'due' || st.mode === 'active');
    renderToday(s);
    renderComing();
    // other pages
    if (page === 'progress') renderProgress(s);
    if (page === 'kuih' || page === 'settings' || !$('#onboard').hidden) renderCollection(s); // the code box is on both pages
    document.querySelectorAll('.seg [data-set]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sval !== undefined ? st[b.dataset.set] === b.dataset.sval : st[b.dataset.set] === +b.dataset.val)));
    document.querySelectorAll('.switch[data-set]').forEach(b => b.setAttribute('aria-checked', String(!!st[b.dataset.set])));
    document.querySelectorAll('.day[data-set]').forEach(b => b.setAttribute('aria-pressed', String((st.workDays || []).includes(+b.dataset.val))));
    document.querySelectorAll('select[data-set]').forEach(sel => { if (document.activeElement !== sel) sel.value = String(st[sel.dataset.set]); });
    document.querySelectorAll('#page-settings .tsels select').forEach(sel => { sel.disabled = (sel.dataset.set.startsWith('work') && !st.workOn) || (sel.dataset.set.startsWith('lunch') && (!st.lunchOn || !st.workOn)) || (sel.dataset.set.startsWith('water') && !st.waterOn); });
    $('#goalVal').textContent = st.goal;
    if (document.activeElement !== $('#volIn')) $('#volIn').value = String(st.volume);
    $('#chimeRows').classList.toggle('off', !st.sound);
    $('#resetMsg').textContent = st.resetDone ? T('set.resetDone') : T('set.resetSub');
    $('#resetMsg').classList.toggle('ok', !!st.resetDone);
    $('#version').textContent = st.version || '';
    $('#updateMsg').textContent = st.updateMsg ? T(st.updateMsg.k, st.updateMsg.v) : (st.autoUpdate ? T('set.checksAuto') : T('set.checksManual'));
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
      $('#updateText').textContent = T('upd.readyBar', { v: u.version });
      btn.hidden = false; btn.textContent = T('upd.restart'); btn.dataset.w = 'install-update';
    } else if (u.state === 'downloading') {
      $('#updateText').textContent = T('upd.downloadingPct', { v: u.version, p: u.percent || 0 });
      btn.hidden = true;
    } else {
      $('#updateText').textContent = T('upd.availableBar', { v: u.version, cur: st.version });
      btn.hidden = false; btn.textContent = T('upd.download'); btn.dataset.w = 'open-release';
    }
  }
  function tickMain() {
    const now = Date.now(); let label, time, sub, frac, small = false;
    if (st.mode === 'active') {
      const left = st.activeEnd - now; label = T('clock.active'); time = mmss(left); sub = exName(curEx()); frac = 1 - left / (st.activeSecs * 1000);
    } else if (st.mode === 'due') { label = T('clock.due'); time = '0:00'; sub = T('sub.due', { ex: exName(curEx()) }); frac = 1; }
    else if (st.paused) { label = T('clock.paused'); time = mmss(st.pausedLeft); sub = st.pauseUntil ? T('sub.pausedUntil', { when: whenLabel(st.pauseUntil) }) : T('sub.paused'); frac = 1 - Math.min(1, st.pausedLeft / (st.interval * 60e3)); }
    else if (st.resting) { label = T('clock.resting'); time = whenLabel(st.backAt) || '--'; sub = T('sub.resting'); frac = 0; small = true; }
    else if (st.quiet) { label = T('clock.quiet'); time = T('w.waiting'); sub = T('sub.quiet'); frac = 1; small = true; }
    else if (st.away) { label = T('clock.away'); time = `${st.interval}:00`; sub = T('sub.away'); frac = 0; }
    else { const left = st.nextDue - now; label = T('clock.next'); time = mmss(left); sub = T('sub.next', { ex: exName(BY[st.upNext]), len: secsLabel(BY[st.upNext].secs) }); frac = 1 - Math.min(1, left / (st.interval * 60e3)); }
    if (taps > 0) frac = taps / EGG_TAPS;
    if (st.mood === 'sad' && st.mode === 'waiting' && !st.paused && !st.resting && !st.away) sub = T('mood.sad', { k: kuihName() });
    if (st.backMins && st.mode === 'waiting' && !st.paused) sub = T('sub.back', { n: st.backMins });
    if (st.eggMsg) sub = T('sub.egg');
    $('#clockLabel').textContent = label; $('#clockTime').textContent = time; $('#clockSub').textContent = sub;
    $('#clockTime').classList.toggle('small', small);
    const C = 2 * Math.PI * 58, arc = $('#arc');
    arc.style.strokeDasharray = C; arc.style.strokeDashoffset = C * (1 - Math.max(0, Math.min(1, frac)));
    document.title = st.mode === 'due' ? `Lapis · ${T('w.due')}` : `Lapis · ${time}`;
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
      <button type="button" class="w-mascot kuih-tap" id="wMascot" aria-label="${esc(T('w.kuih'))}"></button>
      <div class="w-text"><p class="w-label" id="wLabel"></p><p class="w-time" id="wTime">--:--</p><p class="w-sub" id="wSub"></p></div>
      <div class="w-btns">
        <button type="button" data-w="now" id="wNow" title="${esc(T('w.stretchNow'))}" aria-label="${esc(T('w.stretchNow'))}">${ICONS.now}</button>
        <button type="button" data-w="pause-menu" id="wPause">${ICONS.pause}</button>
        <button type="button" data-w="open-main" title="${esc(T('w.open'))}" aria-label="${esc(T('w.open'))}">${ICONS.open}</button>
      </div>
      <div class="w-bar"><i id="wBar"></i></div>
    </div>`;
  }
  let wPoseKey = '', trayKuih = '';
  function sendTrayIcon(skin, step) {
    // Draw the kuih's body at tray sizes; the main process turns these into the tray icon.
    // With a step (0-16) it sits inside a ring that fills as the next stretch gets closer (1.8.0).
    const svg = window.lapisBodySVG(skin), ring = step >= 0;
    const img = new Image();
    img.onload = () => {
      const images = [[16, 1], [24, 1.5], [32, 2], [48, 3]].map(([px, scale]) => {
        const c = document.createElement('canvas'); c.width = c.height = px;
        const g = c.getContext('2d'), lw = Math.max(2, Math.round(px * 0.13)), inner = ring ? px - 2 * lw - 1 : px;
        const r = Math.min(inner / 92, inner / 98), w = 92 * r, h = 98 * r;
        g.drawImage(img, (px - w) / 2, (px - h) / 2, w, h);
        if (ring) {
          const R = px / 2 - lw / 2;
          g.lineWidth = lw; g.lineCap = 'butt';
          g.strokeStyle = 'rgba(140,140,140,.5)'; g.beginPath(); g.arc(px / 2, px / 2, R, 0, Math.PI * 2); g.stroke();
          if (step > 0) { g.strokeStyle = '#E0336F'; g.beginPath(); g.arc(px / 2, px / 2, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * step / 16); g.stroke(); }
        }
        return { scale, url: c.toDataURL('image/png') };
      });
      api.act('tray-icon', { images });
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  const waterAsk = () => st.notice && st.notice.type === 'water' && st.notice.state === 'ask' && st.mode === 'waiting';
  function renderWidget() {
    if (trayKuih !== st.kuih) { trayKuih = st.kuih; wPoseKey = ''; }
    syncTray();
    const pose = st.mode === 'due' ? 'wave' : st.mode === 'done' ? 'cheer' : st.mode === 'active' ? curEx().pose : waterAsk() ? 'glass' : st.quiet ? 'shh' : st.mode === 'snoozed' || st.paused || st.away || st.resting ? 'sleep' : moodPose();
    if (pose + outfit() + st.golden !== wPoseKey) { wPoseKey = pose + outfit() + st.golden; $('#wMascot').innerHTML = lapis(pose, kuihName(), st.mode !== 'active', null, st.golden); }
    $('#widget').classList.toggle('due', st.mode === 'due' || st.mode === 'active');
    $('#widget').classList.toggle('water', waterAsk());
    const p = $('#wPause');
    p.innerHTML = st.paused ? ICONS.resume : ICONS.pause;
    p.title = st.paused ? T('resume') : T('pause');
    p.setAttribute('aria-label', p.title);
    const tr = todayRec();
    const ready = st.update && st.update.state === 'ready';
    $('#wSub').textContent = ready ? T('w.update') : st.waterOn ? T('w.subWater', { n: tr.total, g: st.goal, w: tr.water || 0 }) : T('w.sub', { n: tr.total, g: st.goal });
    $('#wSub').classList.toggle('w-update', !!ready);
    tickWidget();
  }
  // Tray ring (1.8.0): 16 steps while counting down, full when a stretch is due, none while paused or resting.
  let trayKey = '';
  function trayStep() {
    if (!st.trayRing) return -1;
    if (st.mode === 'due' || st.mode === 'active') return 16;
    if (st.mode !== 'waiting' || st.paused || st.resting || st.away || st.quiet) return -1;
    return Math.floor(16 * (1 - Math.min(1, Math.max(0, (st.nextDue - Date.now()) / (st.interval * 60e3)))));
  }
  function syncTray() {
    const step = trayStep(), key = (st.kuih || 'lapis') + '|' + step;
    if (key !== trayKey) { trayKey = key; sendTrayIcon(st.kuih || 'lapis', step); }
  }
  function tickWidget() {
    syncTray();
    const now = Date.now(); let label, time, frac, small = false;
    if (st.mode === 'due') { label = T('w.due'); time = T('w.now'); frac = 1; }
    else if (st.mode === 'active') { const left = st.activeEnd - now; label = exName(curEx()); time = mmss(left); frac = 1 - left / (st.activeSecs * 1000); }
    else if (st.mode === 'done') { label = T('w.nice'); time = T('w.done'); frac = 1; }
    else if (st.mode === 'snoozed') { label = T('w.snoozed'); time = mmss(st.nextDue - now); frac = 0; }
    else if (waterAsk()) { label = T('w.water'); time = T('w.glass', { n: (todayRec().water || 0) + 1 }); frac = 1; small = true; }
    else if (st.paused) { label = st.pauseUntil ? T('ns.pausedUntil', { when: whenLabel(st.pauseUntil) }) : T('w.paused'); time = mmss(st.pausedLeft); frac = 0; small = !!st.pauseUntil; }
    else if (st.resting) { label = T('w.resting'); time = whenLabel(st.backAt) || '--'; frac = 0; small = true; }
    else if (st.quiet) { label = T('w.quiet'); time = T('w.waiting'); frac = 1; small = true; }
    else if (st.away) { label = T('w.away'); time = `${st.interval}:00`; frac = 0; }
    else { const left = st.nextDue - now; label = T('w.next'); time = mmss(left); frac = 1 - Math.min(1, left / (st.interval * 60e3)); }
    if (taps > 0) frac = taps / EGG_TAPS;
    if (st.backMins && st.mode === 'waiting' && !st.paused && !waterAsk()) label = T('w.back');
    if (st.eggMsg) label = T('w.egg');
    $('#wLabel').textContent = label; $('#wTime').textContent = time;
    $('#wTime').classList.toggle('small', small);
    $('#wBar').style.width = Math.max(0, Math.min(100, frac * 100)) + '%';
  }

  /* ---------- pop-up: stretch card, or a notice (water, new kuih, Friday summary) ---------- */
  function buildPopup() {
    root.innerHTML = '<div id="pop"><article class="card" id="card"></article><article class="ncard pop" id="ncard" hidden></article></div>';
    const ro = new ResizeObserver(() => api.act('popup-size', { h: Math.ceil($('#pop').getBoundingClientRect().height) }));
    ro.observe($('#pop'));
  }
  let noticeKey = '';
  function noticeHTML(n) {
    if (n.type === 'water') {
      const w = todayRec().water || 0, g = st.waterGoal;
      if (n.state === 'done') return `<div class="nc-row"><div class="nc-img">${lapis('drink', kuihName())}</div><div class="nc-body"><h3 class="nc-big">${T('wc.ahh')}</h3><p class="nc-sub">${T('wc.count', { n: w, g })}</p><div class="glasses sm">${glasses(w, g)}</div></div></div>`;
      return `<div class="nc-row"><div class="nc-img">${lapis('glass', kuihName())}</div><div class="nc-body"><p class="nc-tag water">${T('wc.tag')}</p><h3>${T('wc.title')}</h3><p class="nc-sub">${T('wc.sub', { n: w + 1, g })}</p>
        <div class="row"><button class="btn" data-w="water-drank" type="button">${T('wc.drank')}</button><button class="btn ghost" data-w="water-later" type="button">${T('btn.later')}</button></div></div></div>`;
    }
    if (n.type === 'unlock') {
      const k = KUIH_BY[n.id], r = D.RULE_BY[n.id];
      return `<div class="nc-center"><p class="nc-tag">${T('un.tag', { n: collectedCount() })}</p><div class="nc-pair"><span class="nc-small">${lapis('cheer', kuihName())}</span><span class="nc-new">${lapis('wave', k.name, true, k.id)}</span></div>
        <h3>${T('un.title', { k: esc(k.name) })}</h3><p class="nc-sub">${r ? T('un.why', { rule: ruleText(r) }) + ' ' : ''}${esc(tx(k, 'note'))}</p>
        <div class="row center"><button class="btn" data-w="unlock-use" type="button">${T('un.use', { k: esc(k.name) })}</button><button class="btn ghost" data-w="notice-close" type="button">${T('un.keep', { k: esc(kuihName()) })}</button></div></div>`;
    }
    if (n.type === 'summary') return summaryHTML(n.week);
    if (n.type === 'news') {
      const items = NEWS.filter(x => newer(x.v, n.from)).flatMap(x => x.keys).slice(0, 6);
      return `<div class="news"><div class="nc-row"><div class="nc-img">${lapis('cheer', kuihName())}</div><div class="nc-body"><p class="nc-tag">${T('news.tag', { v: n.v })}</p><h3>${T('news.title')}</h3></div></div>
        <ul class="news-list">${items.map(k => `<li>${T(k)}</li>`).join('')}</ul><div class="row end"><button class="btn" data-w="news-close" type="button">${T('news.ok')}</button></div></div>`;
    }
    if (n.type === 'teh') return `<div class="nc-row"><div class="nc-img teh">${lapis('tarik', kuihName())}</div><div class="nc-body"><p class="nc-tag teh">${T('teh.tag', { time: fmtMin(930) })}</p><h3>${T('teh.title')}</h3><p class="nc-sub">${T('teh.sub')}</p><div class="row"><button class="btn" data-w="notice-close" type="button">${T('teh.btn')}</button></div></div></div>`;
    if (n.type === 'night') return `<div class="nc-row"><div class="nc-img night">${lapis('yawn', kuihName())}</div><div class="nc-body"><p class="nc-tag night">${fmtTime(Date.now())}</p><h3>${T('night.title')}</h3><p class="nc-sub">${T('night.sub')} ${n.back ? T('night.see', { when: whenLabel(n.back) }) : T('night.seeTomorrow')}</p><div class="row"><button class="btn" data-w="notice-close" type="button">${T('night.ok')}</button><button class="btn ghost" data-w="night-more" type="button">${T('night.more')}</button></div></div></div>`;
    if (n.type === 'wrap') {
      const rec = (st.history || {})[n.day] || { total: 0 }, met = rec.total >= st.goal, s = stats();
      return `<div class="nc-row"><div class="nc-img">${lapis('wave', kuihName())}</div><div class="nc-body"><p class="nc-tag">${T('wrap.tag', { time: fmtMin(st.workEnd) })}</p><h3>${T('wrap.title')}</h3>
        <div class="wrap-stats"><span><b>${rec.total}/${st.goal}</b> ${T('wrap.stretches')}</span>${st.waterOn ? `<span><b>${rec.water || 0}</b> ${T('wrap.glasses')}</span>` : ''}<span><b>${s.streak}</b> ${T('wrap.streak')}</span></div>
        <p class="nc-sub">${met ? T('wrap.met') : T('wrap.notMet')}</p><div class="row"><button class="btn" data-w="notice-close" type="button">${T('wrap.bye')}</button></div></div></div>`;
    }
    return '';
  }
  // "What's new" items for each version (newest first); the card shows those after the version you last saw.
  const NEWS = [
    { v: '1.9.0', keys: ['news.1.9.0.a', 'news.1.9.0.b', 'news.1.9.0.c'] },
    { v: '1.8.0', keys: ['news.1.8.0.a', 'news.1.8.0.b', 'news.1.8.0.c', 'news.1.8.0.d'] },
    { v: '1.7.1', keys: ['news.1.7.1.a'] },
    { v: '1.7.0', keys: ['news.1.7.0.a', 'news.1.7.0.b', 'news.1.7.0.c'] }
  ];
  const newer = (a, b) => { const pa = a.split('.').map(Number), pb = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0); return false; };
  function summaryHTML(week) {
    const [y, m, d] = week.split('-').map(Number), mon = new Date(y, m - 1, d, 12);
    const workDays = st.workOn ? st.workDays : [1, 2, 3, 4, 5];
    const DN = T('days').split(','), h = st.history || {};
    let total = 0, water = 0, atGoal = 0, worked = 0; const by = {}, bars = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(mon); day.setDate(mon.getDate() + i);
      const rec = h[dayKey(day)] || { total: 0, by: {} };
      total += rec.total; water += rec.water || 0;
      Object.entries(rec.by || {}).forEach(([id, c]) => { if (own(BY, id)) by[id] = (by[id] || 0) + c; });
      if (workDays.includes(day.getDay())) { worked++; if (rec.total >= st.goal) atGoal++; bars.push({ l: DN[day.getDay()], n: rec.total }); }
    }
    const end = new Date(mon); end.setDate(mon.getDate() + 6);
    const range = `${mon.toLocaleDateString(loc(), { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString(loc(), { day: 'numeric', month: 'short' })}`;
    const max = Math.max(st.goal, ...bars.map(b => b.n));
    const newK = Object.entries(st.unlocked || {}).filter(([, dk]) => dk >= week).map(([id]) => id).filter(id => KUIH_BY[id]);
    const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
    const s = stats();
    return `<div class="sum">
      <div class="nc-row"><div class="nc-img">${lapis('cheer', kuihName())}</div><div class="nc-body"><p class="nc-tag">${T('sum.tag', { range })}</p><h3 class="nc-big">${T('sum.title')}</h3><p class="nc-sub">${T('sum.sub')}</p></div></div>
      <div class="sum-stats"><div><b>${total}</b><span>${T('sum.stretches')}</span></div><div><b>${atGoal}/${worked}</b><span>${T('sum.goalDays')}</span></div><div><b>${s.streak}</b><span>${T('sum.streak')}</span></div><div><b>${water}</b><span>${T('sum.water')}</span></div></div>
      <p class="sum-h">${T('sum.chart', { g: st.goal })}</p>
      <div class="sum-bars">${bars.map(b => `<div><span class="n">${b.n}</span><i class="${b.n >= st.goal ? 'met' : ''}" style="height:${Math.max(4, b.n / max * 70)}px"></i><span class="l">${b.l}</span></div>`).join('')}</div>
      ${newK.length ? `<div class="sum-new"><p>${T('sum.newKuih')}</p><div>${newK.map(id => `<span class="sum-k">${lapis('idle', KUIH_BY[id].name, false, id)}<b>${KUIH_BY[id].name}</b></span>`).join('')}</div></div>` : ''}
      <p class="nc-sub">${top ? T('sum.most', { ex: exName(BY[top[0]]), n: top[1] }) : T('sum.none')}</p>
      <div class="row end"><button class="btn ghost" data-w="summary-open" type="button">${T('btn.seeProgress')}</button><button class="btn" data-w="notice-close" type="button">${T('btn.close')}</button></div>
    </div>`;
  }
  function renderPopup() {
    const card = $('#card'), nc = $('#ncard');
    if (st.mode !== 'waiting') { nc.hidden = true; noticeKey = ''; card.hidden = false; renderCard(card, true); return; }
    card.hidden = true; cardKey = '';
    const n = st.notice;
    if (!n) { nc.hidden = true; noticeKey = ''; return; }
    const key = JSON.stringify(n) + '|' + L() + '|' + st.kuih + '|' + (todayRec().water || 0);
    nc.hidden = false;
    if (key === noticeKey) return;
    noticeKey = key;
    nc.className = 'ncard pop' + (n.type === 'summary' ? ' wide' : '');
    nc.innerHTML = noticeHTML(n);
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
    borneo: { title: 'Jom sumazau!', moves: ['wingsUp', 'wingsDown', 'wingsUp', 'wingsDown', 'wingsUp', 'walk', 'wingsUp', 'cheer'], flipEvery: 2 },
    // the flag-day code, and the Merdeka and Malaysia Day festivals: a march with the Jalur Gemilang
    merdeka: { title: 'Merdeka!', moves: ['flag', 'salute', 'flag', 'walk', 'flag', 'salute', 'cheer', 'flag'], flipEvery: 2 }
  };
  const eggStyle = skin => {
    const f = festival();
    if (flagCode() || (f && (f.id === 'merdeka' || f.id === 'malaysiaday'))) return 'merdeka';
    const g = (KUIH_BY[skin] || KUIH_BY.lapis).group;
    return Object.prototype.hasOwnProperty.call(DANCES, g) ? g : 'malay';
  };
  let eggStarted = false, eggEnding = false, eggTimer = null, eggMaster = null;
  function buildEgg() {
    root.innerHTML = `<div class="egg" id="egg" role="img" aria-label="${esc(T('egg.aria'))}">
      <div class="egg-dim"></div>
      <div class="egg-glow"></div>
      <div class="egg-confetti" id="eggConfetti"></div>
      <p class="egg-title" id="eggTitle"></p>
      <div class="egg-stage"><div class="egg-spin" id="eggSpin"><div class="egg-flip" id="eggFlip"><div class="egg-kuih" id="eggKuih"></div></div></div></div>
      <p class="egg-foot" id="eggFoot">${T('egg.stop')}</p>
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
      $('#eggFoot').textContent = T('egg.left', { n: Math.max(1, 8 - Math.floor(beat / 2)) });
    };
    show();
    eggTimer = setInterval(() => { beat++; if (beat >= 16) { finishEgg(); return; } show(); }, st.remix ? 420 : 500);
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
      const remix = !!st.remix, t0 = ac.currentTime + 0.05, E = remix ? 0.21 : 0.25, END = 32 * E; // the remix code: a faster beat
      const out = ac.createGain(); out.gain.value = ({ chinese: 0.45, indian: 0.6, borneo: 0.42, merdeka: 0.5 }[style] || 0.55) * Math.min(1.43, vol()); out.connect(ac.destination); eggMaster = out;
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

      if (style === 'merdeka') {
        // an original march (not any existing song): brass-like fanfare in B-flat, oom-pah bass, snare and bass drum
        const brass = { type: 'sawtooth', cut: 1900, peak: 0.13, attack: 0.02 };
        melody([65, 0, 70, 0, 74, 0, 77, 0, 75, 74, 72, 70, 72, 0, 74, 0, 70, 0, 74, 0, 77, 0, 79, 77, 75, 72, 74, 0, 70, 0, 0, 0], brass);
        melody([62, 0, 65, 0, 70, 0, 74, 0, 72, 70, 69, 67, 69, 0, 70, 0, 67, 0, 70, 0, 74, 0, 75, 74, 72, 69, 70, 0, 65, 0, 0, 0], Object.assign({}, brass, { peak: 0.07, cut: 1500 }));
        const chords = [[58, 62, 65], [63, 67, 70], [58, 62, 65], [60, 65, 69]], bass = [[46, 41], [51, 46], [46, 41], [41, 48]];
        each((e, t, bar) => {
          if (e % 2 === 0) voice(bass[bar][(e / 2) % 2], t, 0.2, { type: 'triangle', cut: 3000, peak: 0.26, attack: 0.01 });
          else chords[bar].forEach(m => voice(m, t, 0.14, { type: 'square', cut: 1400, peak: 0.03, attack: 0.01 }));
          if (e === 0 || e === 4) thump(t, 110, 50, 0.65, 0.25);
          if (e === 2 || e === 6) noise(t, 0.32, 0.12, 'bandpass', 1800, 0.8);
          if (bar === 3 && e >= 4) { noise(t, 0.18, 0.06, 'bandpass', 2000, 0.8); noise(t + E / 2, 0.18, 0.06, 'bandpass', 2000, 0.8); } // snare roll into the end
          if (e === 0 && bar === 0) noise(t, 0.2, 0.9, 'highpass', 6000, 0.7); // cymbal
        });
      } else if (style === 'chinese') {
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
      if (remix) {
        // remix on top of any song: tabla (dha, tin, na) and teh cups clinking
        each((e, t) => {
          const b = ['dha', 'na', 'tin', 'na', 'dha', 'dha', 'tin', 'na'][e];
          if (b === 'dha') { thump(t, 130, 75, 0.4, 0.2); thump(t, 520, 480, 0.08, 0.12); }
          else if (b === 'tin') thump(t, 620, 560, 0.1, 0.18);
          else noise(t, 0.12, 0.05, 'bandpass', 4200, 2.5);
          if (e === 3 || e === 7) gong(100, t, 0.06, 0.3, [1, 2.76, 5.4]);
        });
      }
    } catch (e) { /* no audio device */ }
  }

  /* ---------- boot ---------- */
  // Windows are built once the first state arrives, so they start in the right language,
  // and rebuilt when the language changes.
  const B = { main: [buildMain, renderMain, tickMain], widget: [buildWidget, renderWidget, tickWidget], popup: [buildPopup, renderPopup, () => tickCard($('#card'))], egg: [buildEgg, renderEgg, () => {}] }[view] || [buildMain, renderMain, tickMain];
  let built = false;
  function onState(s) {
    if (!s) return;
    const relang = !st || st.lang !== s.lang;
    st = s;
    document.documentElement.lang = L();
    if (!built || (relang && view !== 'egg')) {
      cardKey = ''; heroKey = ''; kuihKey = ''; comingKey = ''; wPoseKey = ''; noticeKey = '';
      B[0](); built = true;
    }
    B[1]();
  }
  api.onState(onState);
  api.getState().then(onState);
  let lastOutfit = '';
  setInterval(() => {
    if (!st || !built) return;
    const o = String(outfit());
    if (o !== lastOutfit) { const first = !lastOutfit; lastOutfit = o; if (!first && view !== 'egg') B[1](); }
    B[2]();
  }, 500);
})();
