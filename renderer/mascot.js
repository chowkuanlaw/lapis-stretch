/* Lapis the kuih lapis, drawn as SVG in different stretch poses. */
(function () {
  'use strict';
  const STRIPES = ['#C9184A', '#FFF1F4', '#F06A8F', '#FFF1F4', '#F06A8F', '#FFF1F4', '#F06A8F']
    .map((c, i) => `<rect x="30" y="${18 + i * 12}" width="60" height="12" fill="${c}"/>`).join('');
  const IDLE_ARMS = [[[33, 60], [25, 74], [23, 88]], [[87, 60], [95, 74], [97, 88]]];
  const IDLE_LEGS = [[[50, 100], [49, 138]], [[70, 100], [71, 138]]];
  const POSES = {
    idle: {},
    wave: { arms: [IDLE_ARMS[0], [[87, 60], [100, 46], [106, 28]]] },
    chin: { body: 'translate(-4 0)', extra: '<path class="fx" d="M114 46 H97"/><polyline class="fx" points="102,40 96,46 102,52"/>' },
    neck: { body: 'rotate(-13 60 100)', arms: [IDLE_ARMS[0], [[87, 60], [96, 38], [80, 14]]] },
    thoracic: { body: 'rotate(7 60 100)', arms: [[[33, 58], [20, 36], [42, 16]], [[87, 58], [100, 36], [78, 16]]], face: 'happy' },
    shoulders: { extra: '<path class="fx" d="M20 54 A11 11 0 1 1 31 38"/><polyline class="fx" points="25,36 31,38 29,44"/><path class="fx" d="M100 54 A11 11 0 1 0 89 38"/><polyline class="fx" points="95,36 89,38 91,44"/>' },
    twist: { body: 'translate(60 0) scale(.88 1) translate(-60 0)', arms: [[[33, 60], [52, 74], [80, 74]], [[87, 60], [100, 72], [104, 86]]], extra: '<path class="fx" d="M34 8 Q60 -4 86 8"/><polyline class="fx" points="79,3 86,8 79,13"/>' },
    wrist: { arms: [[[33, 60], [60, 68], [104, 56]], [[87, 60], [106, 60], [108, 44]]] },
    eyes: { arms: [IDLE_ARMS[0], [[87, 60], [98, 50], [80, 38]]], extra: '<path class="fx dash" d="M96 46 L124 36"/>' },
    reach: { arms: [[[33, 58], [28, 30], [38, 4]], [[87, 58], [92, 30], [82, 4]]], face: 'happy' },
    walk: { body: 'rotate(4 60 100)', arms: [[[33, 60], [22, 70], [18, 82]], [[87, 60], [98, 72], [106, 80]]], legs: [[[50, 100], [38, 136]], [[70, 100], [82, 136]]], extra: '<path class="fx" d="M14 62 H2"/><path class="fx" d="M16 78 H4"/><path class="fx" d="M14 94 H4"/>' },
    cheer: { arms: [[[33, 58], [22, 40], [14, 22]], [[87, 58], [98, 40], [106, 22]]], face: 'happy' },
    sleep: { face: 'closed', extra: '<text class="zz" x="94" y="16">z</text><text class="zz" x="106" y="4" style="font-size:13px">z</text>' }
  };
  let uid = 0;
  const pts = a => a.map(p => p.join(',')).join(' ');
  function face(kind) {
    let eyes;
    if (kind === 'happy') eyes = '<path class="line" d="M45 49 Q50 43 55 49"/><path class="line" d="M65 49 Q70 43 75 49"/>';
    else if (kind === 'closed') eyes = '<path class="line" d="M45 47 H55"/><path class="line" d="M65 47 H75"/>';
    else eyes = '<circle class="eye" cx="50" cy="47" r="3.4"/><circle class="eye" cx="70" cy="47" r="3.4"/>';
    return eyes + '<path class="line" d="M53 57 Q60 64 67 57"/><ellipse class="blush" cx="42" cy="60" rx="4.5" ry="2.6"/><ellipse class="blush" cx="78" cy="60" rx="4.5" ry="2.6"/>';
  }
  function figure(p, sticker, id) {
    const legs = p.legs || IDLE_LEGS, arms = p.arms || IDLE_ARMS;
    let s = '';
    legs.forEach(l => { const e = l[l.length - 1], dx = l[0][0] < 60 ? -3 : 3; s += `<polyline class="limb" points="${pts(l)}"/><ellipse class="foot" cx="${e[0] + dx}" cy="${e[1] + 2}" rx="8" ry="4.5"/>`; });
    s += `<g transform="${p.body || ''}">`;
    arms.forEach(a => { const e = a[a.length - 1]; s += `<polyline class="limb" points="${pts(a)}"/><circle class="hand" cx="${e[0]}" cy="${e[1]}" r="4.6"/>`; });
    if (sticker) s += '<rect x="32" y="18" width="56" height="84" rx="13"/>';
    else s += `<clipPath id="lc${id}"><rect x="32" y="18" width="56" height="84" rx="13"/></clipPath><g clip-path="url(#lc${id})">${STRIPES}</g><rect class="outline" x="32" y="18" width="56" height="84" rx="13"/>${face(p.face)}`;
    s += '</g>' + (p.extra || '');
    return s;
  }
  window.lapisSVG = function (pose, label, bob) {
    const p = POSES[pose] || POSES.idle, id = ++uid;
    return `<svg class="lapis" viewBox="-4 -10 128 160" role="img" aria-label="${label || 'Lapis'}"><g class="${bob ? 'bob' : ''}"><g class="stk">${figure(p, true, id)}</g><g>${figure(p, false, id)}</g></g></svg>`;
  };
})();
