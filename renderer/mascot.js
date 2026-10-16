/* Lapis and friends: Malaysian kuih drawn as SVG characters in stretch poses.
   lapisSVG(pose, label, bob, skinId) — every kuih shares the same arms, legs and face,
   so all stretch poses work for every character. */
(function () {
  'use strict';
  const INK = '#2A1F1A';
  const IDLE_ARMS = [[[33, 60], [25, 74], [23, 88]], [[87, 60], [95, 74], [97, 88]]];
  const IDLE_LEGS = [[[50, 100], [49, 138]], [[70, 100], [71, 138]]];
  const POSES = {
    idle: {},
    wave: { arms: [IDLE_ARMS[0], [[87, 60], [100, 46], [106, 28]]] },
    chin: { body: 'translate(-4 0)', extra: '<path class="fx" d="M116 46 H99"/><polyline class="fx" points="104,40 98,46 104,52"/>' },
    neck: { body: 'rotate(-13 60 100)', arms: [IDLE_ARMS[0], [[87, 60], [96, 38], [80, 14]]] },
    thoracic: { body: 'rotate(7 60 100)', arms: [[[33, 58], [20, 36], [42, 16]], [[87, 58], [100, 36], [78, 16]]], face: 'happy' },
    shoulders: { extra: '<path class="fx" d="M14 54 A11 11 0 1 1 25 38"/><polyline class="fx" points="19,36 25,38 23,44"/><path class="fx" d="M106 54 A11 11 0 1 0 95 38"/><polyline class="fx" points="101,36 95,38 97,44"/>' },
    twist: { body: 'translate(60 0) scale(.88 1) translate(-60 0)', arms: [[[33, 60], [52, 74], [80, 74]], [[87, 60], [100, 72], [104, 86]]], extra: '<path class="fx" d="M34 4 Q60 -8 86 4"/><polyline class="fx" points="79,-1 86,4 79,9"/>' },
    wrist: { arms: [[[33, 60], [60, 68], [104, 56]], [[87, 60], [106, 60], [108, 44]]] },
    eyes: { arms: [IDLE_ARMS[0], [[87, 60], [98, 50], [80, 38]]], extra: '<path class="fx dash" d="M100 44 L126 34"/>' },
    reach: { arms: [[[33, 58], [28, 30], [38, 4]], [[87, 58], [92, 30], [82, 4]]], face: 'happy' },
    walk: { body: 'rotate(4 60 100)', arms: [[[33, 60], [22, 70], [18, 82]], [[87, 60], [98, 72], [106, 80]]], legs: [[[50, 100], [38, 136]], [[70, 100], [82, 136]]], extra: '<path class="fx" d="M8 62 H-4"/><path class="fx" d="M10 78 H-2"/><path class="fx" d="M8 94 H-2"/>' },
    cheer: { arms: [[[33, 58], [22, 40], [14, 22]], [[87, 58], [98, 40], [106, 22]]], face: 'happy' },
    sleep: { face: 'closed', extra: '<text class="zz" x="98" y="12">z</text><text class="zz" x="110" y="0" style="font-size:13px">z</text>' },
    // dance moves (easter egg)
    wingsUp: { arms: [[[33, 60], [16, 52], [0, 40]], [[87, 60], [104, 52], [120, 40]]], face: 'happy' },
    wingsDown: { body: 'rotate(-4 60 100)', arms: [[[33, 60], [16, 64], [0, 64]], [[87, 60], [104, 64], [120, 64]]] },
    mudraL: { body: 'translate(-3 2)', arms: [[[33, 60], [14, 56], [20, 36]], [[87, 60], [104, 60], [120, 54]]], legs: [[[50, 100], [36, 118], [42, 138]], [[70, 100], [84, 118], [78, 138]]], face: 'happy' },
    mudraR: { body: 'translate(3 2)', arms: [[[33, 60], [16, 60], [0, 54]], [[87, 60], [106, 56], [100, 36]]], legs: [[[50, 100], [36, 118], [42, 138]], [[70, 100], [84, 118], [78, 138]]], face: 'happy' },
    salute: { body: 'translate(0 3)', front: true, arms: [[[33, 62], [42, 86], [56, 82]], [[87, 62], [78, 86], [64, 82]]], face: 'happy' },
    horse: { body: 'translate(0 4)', arms: [[[33, 60], [18, 46], [10, 26]], [[87, 60], [104, 66], [118, 62]]], legs: [[[50, 100], [34, 116], [32, 138]], [[70, 100], [86, 116], [88, 138]]] },
    // water reminder (1.6.0): holding up a glass, and drinking from it
    glass: { arms: [IDLE_ARMS[0], [[87, 60], [102, 56], [106, 40]]], prop: 'glass', face: 'happy' },
    drink: K => ({ body: 'rotate(-5 60 100)', front: true, face: 'closed', mouth: 'none', arms: [IDLE_ARMS[0], [[87, 62], [100, 80], [77, 66 + (K.faceDy || 0)]]], prop: 'sip' }),
    // quiet during meetings: finger to lips
    shh: K => ({ front: true, mouth: 'none', arms: [IDLE_ARMS[0], [[87, 62], [86, 84], [62, 62 + (K.faceDy || 0)]]], extra: '<path class="fx" d="M100 40 q6 -4 12 0"/><path class="fx" d="M102 30 q8 -6 16 0"/>' }),
    kick: { body: 'rotate(-6 60 100)', arms: [[[33, 60], [18, 46], [12, 30]], [[87, 60], [102, 48], [110, 32]]], legs: [[[50, 100], [48, 138]], [[70, 100], [88, 110], [104, 112]]], face: 'happy' }
  };

  /* ---------- helpers for kuih art ---------- */
  const O = `stroke="${INK}" stroke-width="3.5"`;
  function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
  function dotsIn(seed, n, inside, draw) {
    const r = rng(seed); let out = '', tries = 0;
    while (n > 0 && tries++ < 2000) { const x = 20 + r() * 80, y = 14 + r() * 90; if (inside(x, y)) { out += draw(x, y, r); n--; } }
    return out;
  }
  const inCircle = (cx, cy, rad) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 < rad * rad;
  function scallop(cx, cy, R, n, br) { // centres of bumps for flower-edged kuih
    return Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; })
      .map(([x, y]) => ({ x, y, r: br }));
  }
  function bumpsShape(cx, cy, core, bumps, fill, stroke) {
    // outline trick: draw everything a bit larger in ink first, then the fills on top
    const all = [{ x: cx, y: cy, r: core }, ...bumps];
    return all.map(c => `<circle cx="${c.x}" cy="${c.y}" r="${c.r + 1.75}" fill="${stroke}"/>`).join('') +
           all.map(c => `<circle cx="${c.x}" cy="${c.y}" r="${c.r}" fill="${fill}"/>`).join('');
  }
  function spiral(cx, cy, r0, r1, turns, steps) {
    let d = '';
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, a = t * turns * Math.PI * 2 - Math.PI / 2, rr = r0 + (r1 - r0) * t;
      d += (i ? ' L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1);
    }
    return d;
  }

  /* ---------- the kuih ---------- */
  const KUIH = {
    lapis: {
      name: 'Kuih Lapis', origin: 'Malay', note: 'Layered steamed rice-flour cake',
      half: 28, faceDy: 0,
      sil: '<rect x="32" y="18" width="56" height="84" rx="13"/>',
      art: id => `<clipPath id="k${id}"><rect x="32" y="18" width="56" height="84" rx="13"/></clipPath><g clip-path="url(#k${id})">${['#C9184A', '#FFF1F4', '#F06A8F', '#FFF1F4', '#F06A8F', '#FFF1F4', '#F06A8F'].map((c, i) => `<rect x="30" y="${18 + i * 12}" width="60" height="12" fill="${c}"/>`).join('')}</g><rect x="32" y="18" width="56" height="84" rx="13" fill="none" ${O}/>`
    },
    onde: {
      name: 'Onde-onde', origin: 'Malay', note: 'Pandan balls filled with gula melaka, rolled in coconut',
      half: 35, faceDy: 12,
      sil: '<circle cx="60" cy="65" r="36"/>',
      art: () => `<circle cx="60" cy="65" r="36" fill="#4FA34A" ${O}/><path d="M36 50 A28 28 0 0 1 72 34" stroke="#8FD17F" stroke-width="5" fill="none" stroke-linecap="round" opacity=".6"/>` +
        dotsIn(11, 20, (x, y) => inCircle(60, 62, 31)(x, y) && (y < 49 || x < 37 || x > 83 || y > 86), (x, y, r) => `<path d="M${x.toFixed(1)} ${y.toFixed(1)} l${(2 + r() * 3).toFixed(1)} ${(r() * 2 - 1).toFixed(1)}" stroke="#FFFDF6" stroke-width="2.2" stroke-linecap="round"/>`) +
        `<path d="M90 80 q4 8 0 12 q-5 -3 -3 -9 z" fill="#7A3E12" ${O.replace('3.5', '2')}/>`
    },
    serimuka: {
      name: 'Seri Muka', origin: 'Malay', note: 'Pandan custard on glutinous rice',
      half: 30, faceDy: 0,
      sil: '<rect x="30" y="24" width="60" height="78" rx="11"/>',
      art: id => `<clipPath id="k${id}"><rect x="30" y="24" width="60" height="78" rx="11"/></clipPath><g clip-path="url(#k${id})"><rect x="28" y="22" width="64" height="46" fill="#93C95A"/><rect x="28" y="22" width="64" height="8" fill="#A9D873"/><rect x="28" y="68" width="64" height="36" fill="#FBF6EA"/>` +
        dotsIn(5, 22, (x, y) => y > 72 && y < 100 && x > 32 && x < 88, (x, y, r) => `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="2.6" ry="1.4" transform="rotate(${(r() * 180).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="none" stroke="#D9CDB1" stroke-width="1.1"/>`) +
        `<path d="M28 68 H92" stroke="#7BAF45" stroke-width="2"/></g><rect x="30" y="24" width="60" height="78" rx="11" fill="none" ${O}/>`
    },
    karipap: {
      name: 'Karipap', origin: 'Malay', note: 'Curry puff with a crimped edge',
      half: 31, faceDy: 14,
      sil: '<path d="M22 102 A38 72 0 0 1 98 102 Z"/>',
      art: () => `<path d="M22 102 A38 72 0 0 1 98 102 Z" fill="#E6A64B" ${O}/><path d="M30 101 A30 64 0 0 1 90 101" fill="none" stroke="#C9832F" stroke-width="7" stroke-dasharray="0.1 8.2" stroke-linecap="round"/><path d="M38 60 Q46 46 58 42" stroke="#F6CF86" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/>`
    },
    bahulu: {
      name: 'Kuih Bahulu', origin: 'Malay', note: 'Little golden sponge cakes, a Hari Raya favourite',
      half: 36, faceDy: 10,
      sil: scallop(60, 64, 27, 8, 11).map(c => `<circle cx="${c.x}" cy="${c.y}" r="${c.r}"/>`).join('') + '<circle cx="60" cy="64" r="29"/>',
      art: () => bumpsShape(60, 64, 29, scallop(60, 64, 27, 8, 11), '#D48A2E', INK) +
        `<circle cx="60" cy="64" r="22" fill="#EDB55A"/>` + scallop(60, 64, 27, 8, 0).map(c => `<path d="M${60 + (c.x - 60) * 0.55} ${64 + (c.y - 64) * 0.55} L${60 + (c.x - 60) * 0.95} ${64 + (c.y - 64) * 0.95}" stroke="#B9701F" stroke-width="1.8" stroke-linecap="round"/>`).join('')
    },
    angku: {
      name: 'Ang Ku Kueh', origin: 'Chinese', note: 'Red tortoise cake, for luck and long life',
      half: 35, faceDy: 10,
      sil: '<ellipse cx="60" cy="64" rx="35" ry="38"/>',
      art: () => `<ellipse cx="60" cy="64" rx="35" ry="38" fill="#D7263D" ${O}/><ellipse cx="60" cy="66" rx="25" ry="28" fill="none" stroke="#A9172E" stroke-width="2.5"/>` +
        [[60, 33], [38, 44], [82, 44], [31, 68], [89, 68], [42, 91], [78, 91]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#A9172E"/>`).join('') +
        `<ellipse cx="46" cy="42" rx="8" ry="4" fill="#FFFFFF" opacity=".35" transform="rotate(-30 46 42)"/>`
    },
    kapit: {
      name: 'Kuih Kapit', origin: 'Chinese', note: 'Crispy rolled "love letters" for Chinese New Year',
      half: 22, faceDy: 0,
      sil: '<rect x="38" y="14" width="44" height="88" rx="10"/>',
      art: id => `<clipPath id="k${id}"><rect x="38" y="14" width="44" height="88" rx="10"/></clipPath><rect x="38" y="14" width="44" height="88" rx="10" fill="#F2D083"/><g clip-path="url(#k${id})" stroke="#D7A548" stroke-width="1.4" opacity=".7">` +
        Array.from({ length: 16 }, (_, i) => `<path d="M${10 + i * 8} 10 l-40 100"/><path d="M${-30 + i * 8} 10 l40 100"/>`).join('') +
        `</g><rect x="38" y="14" width="44" height="88" rx="10" fill="none" ${O}/><ellipse cx="60" cy="20" rx="17" ry="4.5" fill="#E3B963" stroke="${INK}" stroke-width="2"/><path d="M60 20 m-9 0 a9 3 0 1 1 9 2" fill="none" stroke="#B9852F" stroke-width="1.5"/>`
    },
    huat: {
      name: 'Huat Kueh', origin: 'Chinese', note: 'Smiling steamed "prosperity" cake',
      half: 33, faceDy: 2,
      sil: '<path d="M30 66 L90 66 L84 102 L36 102 Z"/><path d="M25 70 C25 30 43 16 60 16 C77 16 95 30 95 70 Z"/>',
      art: () => `<path d="M30 66 L90 66 L84 102 L36 102 Z" fill="#FFFFFF" ${O}/>` +
        [40, 48, 56, 64, 72, 80].map(x => `<path d="M${x} 70 L${x + (x - 60) * 0.1} 99" stroke="#E5DACF" stroke-width="1.6"/>`).join('') +
        `<path d="M25 70 C25 30 43 16 60 16 C77 16 95 30 95 70 Z" fill="#F38BB0" ${O}/><path d="M60 18 L56 36 M60 18 L70 34 M60 18 L46 28" stroke="#C9507D" stroke-width="2.6" stroke-linecap="round"/><path d="M34 46 Q38 32 48 26" stroke="#FCC6D9" stroke-width="4" fill="none" stroke-linecap="round"/>`
    },
    bulan: {
      name: 'Kuih Bulan', origin: 'Chinese', note: 'Mooncake for the Mid-Autumn Festival',
      half: 34, faceDy: 12,
      sil: '<rect x="25" y="32" width="70" height="70" rx="20"/>',
      art: () => `<rect x="25" y="32" width="70" height="70" rx="20" fill="#C98235" ${O}/><rect x="33" y="40" width="54" height="54" rx="14" fill="#D9974A" stroke="#9E5D20" stroke-width="2.2"/>` +
        Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return `<circle cx="${(60 + 31 * Math.cos(a)).toFixed(1)}" cy="${(67 + 31 * Math.sin(a)).toFixed(1)}" r="1.8" fill="#9E5D20"/>`; }).join('') +
        `<path d="M40 46 Q46 40 54 40" stroke="#F0BC78" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
    },
    tart: {
      name: 'Tart Nenas', origin: 'Nyonya', note: 'Pineapple tart with buttery pastry',
      half: 36, faceDy: 12,
      sil: scallop(60, 65, 28, 12, 8).map(c => `<circle cx="${c.x}" cy="${c.y}" r="${c.r}"/>`).join('') + '<circle cx="60" cy="65" r="30"/>',
      art: () => bumpsShape(60, 65, 30, scallop(60, 65, 28, 12, 8), '#EBC074', INK) +
        `<circle cx="60" cy="65" r="21" fill="#E8862A" stroke="#C26414" stroke-width="2"/><path d="M47 56 Q52 50 60 49" stroke="#F7B566" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
    },
    murukku: {
      name: 'Murukku', origin: 'Indian', note: 'Crunchy spiral of rice and lentil flour, made for Deepavali',
      half: 36, faceDy: 12,
      sil: '<circle cx="60" cy="64" r="37"/>',
      art: () => `<circle cx="60" cy="64" r="37" fill="#D9A23F" ${O}/><path d="${spiral(60, 64, 15, 33, 2.2, 160)}" fill="none" stroke="#B7802B" stroke-width="2.6" stroke-dasharray="4 2.5"/><path d="M34 46 A30 30 0 0 1 56 32" stroke="#F0C66E" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
    },
    ladoo: {
      name: 'Ladoo', origin: 'Indian', note: 'Sweet round treat for festivals and celebrations',
      half: 33, faceDy: 12,
      sil: '<circle cx="60" cy="66" r="34"/>',
      art: () => `<circle cx="60" cy="66" r="34" fill="#F4A41E" ${O}/>` +
        dotsIn(21, 34, inCircle(60, 66, 29), (x, y) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.3" fill="none" stroke="#D9850E" stroke-width="1.2" opacity=".75"/>`) +
        `<rect x="44" y="40" width="5" height="3" rx="1" fill="#6FAF5A" transform="rotate(-25 46 41)"/><rect x="72" y="44" width="5" height="3" rx="1" fill="#6FAF5A" transform="rotate(30 74 45)"/><path d="M38 52 A26 26 0 0 1 58 38" stroke="#FFD27A" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
    },
    putu: {
      name: 'Putu Mayam', origin: 'Indian', note: 'String hoppers with coconut and gula melaka',
      half: 35, faceDy: 14,
      sil: '<path d="M24 102 C22 62 36 30 60 30 C84 30 98 62 96 102 Z"/>',
      art: id => `<clipPath id="k${id}"><path d="M24 102 C22 62 36 30 60 30 C84 30 98 62 96 102 Z"/></clipPath><path d="M24 102 C22 62 36 30 60 30 C84 30 98 62 96 102 Z" fill="#F8F1E2"/><g clip-path="url(#k${id})" fill="none" stroke="#E2D2B2" stroke-width="1.6">` +
        Array.from({ length: 10 }, (_, i) => `<path d="M18 ${40 + i * 7} q8 -4 16 0 t16 0 t16 0 t16 0 t16 0"/>`).join('') +
        `</g><path d="M24 102 C22 62 36 30 60 30 C84 30 98 62 96 102 Z" fill="none" ${O}/><path d="M42 36 Q60 24 78 36 Q70 42 60 41 Q50 42 42 36 Z" fill="#8B4A1F" stroke="${INK}" stroke-width="2"/>` +
        [[48, 33], [56, 30], [64, 31], [71, 34], [60, 36]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#FFFFFF"/>`).join('')
    },
    vadai: {
      name: 'Vadai', origin: 'Indian', note: 'Savoury lentil doughnut, best with tea',
      half: 36, faceDy: 8, mouth: 'none',
      sil: '<path fill-rule="evenodd" d="M60 27 a37 37 0 1 0 0.01 0 Z M60 66 a8 8 0 1 0 0.01 0 Z"/>',
      art: () => `<path fill-rule="evenodd" d="M60 27 a37 37 0 1 0 0.01 0 Z M60 66 a8 8 0 1 0 0.01 0 Z" fill="#C98031" ${O}/><circle cx="60" cy="74" r="14" fill="none" stroke="#A86320" stroke-width="2"/>` +
        dotsIn(31, 12, (x, y) => inCircle(60, 64, 32)(x, y) && !inCircle(60, 74, 16)(x, y), (x, y) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.4" fill="#3B2414"/>`) +
        `<path d="M34 48 A30 30 0 0 1 54 33" stroke="#E7A75A" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
    },
    jalebi: {
      name: 'Jalebi', origin: 'Indian', note: 'Syrupy orange swirls, crisp and sticky',
      half: 35, faceDy: 12,
      sil: `<circle cx="60" cy="64" r="20"/><path d="${spiral(60, 64, 22, 32, 1.7, 140)}" fill="none" stroke-width="12"/>`,
      art: () => `<path d="${spiral(60, 64, 22, 32, 1.7, 140)}" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"/><path d="${spiral(60, 64, 22, 32, 1.7, 140)}" fill="none" stroke="#F2861E" stroke-width="8" stroke-linecap="round"/><path d="${spiral(60, 64, 22, 32, 1.7, 140)}" fill="none" stroke="#FFC46B" stroke-width="2" stroke-linecap="round" opacity=".7" transform="translate(-1 -1.5)"/>` +
        `<circle cx="60" cy="64" r="21" fill="#F2861E" ${O}/><path d="M47 54 Q52 47 61 46" stroke="#FFC46B" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
    },
    keklapis: {
      name: 'Kek Lapis Sarawak', origin: 'Sarawak', note: 'Patterned layer cake, a Sarawak icon',
      half: 30, faceDy: 2,
      sil: '<rect x="30" y="20" width="60" height="82" rx="9"/>',
      art: id => {
        const cols = ['#E34B4B', '#F5C84A', '#3FA35B', '#F5C84A'];
        let cells = '';
        for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) cells += `<rect x="${36 + c * 12}" y="${26 + r * 12.6}" width="12" height="12.6" fill="${cols[(r + c) % 4]}"/>`;
        return `<rect x="30" y="20" width="60" height="82" rx="9" fill="#8A5326" ${O}/><clipPath id="k${id}"><rect x="36" y="26" width="48" height="70" rx="4"/></clipPath><g clip-path="url(#k${id})" opacity=".85">${cells}</g>` +
          [1, 2, 3, 4, 5].map(r => `<path d="M36 ${26 + r * 12.6} H84" stroke="#8A5326" stroke-width="1.2" opacity=".6"/>`).join('');
      }
    },
    celorot: {
      name: 'Kuih Celorot', origin: 'Sarawak', note: 'Gula apong kuih steamed in a cone of palm leaf',
      half: 26, faceDy: 6,
      sil: '<path d="M26 34 L94 34 L72 102 L48 102 Z"/><ellipse cx="60" cy="30" rx="30" ry="12"/>',
      art: id => `<ellipse cx="60" cy="31" rx="28" ry="11" fill="#7A4A22" ${O.replace('3.5', '2.5')}/><path d="M40 28 Q50 20 62 21" stroke="#A9703A" stroke-width="3" fill="none" stroke-linecap="round"/>` +
        `<clipPath id="k${id}"><path d="M26 34 L94 34 L72 102 L48 102 Z"/></clipPath><path d="M26 34 L94 34 L72 102 L48 102 Z" fill="#5FA046"/><g clip-path="url(#k${id})">` +
        [0, 1, 2, 3, 4, 5].map(i => `<path d="M10 ${20 + i * 16} L110 ${50 + i * 16}" stroke="#82BE5F" stroke-width="5"/><path d="M10 ${27 + i * 16} L110 ${57 + i * 16}" stroke="#4A8536" stroke-width="1.5"/>`).join('') +
        `</g><path d="M26 34 L94 34 L72 102 L48 102 Z" fill="none" ${O}/>`
    },
    pinjaram: {
      name: 'Pinjaram', origin: 'Sabah & Sarawak', note: 'Fried "UFO" kuih with a crispy rim, also called penyaram',
      half: 24, faceDy: 17,
      sil: '<ellipse cx="60" cy="92" rx="42" ry="10"/><path d="M34 92 C34 56 46 46 60 46 C74 46 86 56 86 92 Z"/>',
      art: () => `<ellipse cx="60" cy="92" rx="42" ry="10" fill="#E2A24C" ${O}/><path d="M24 92 Q60 99 96 92" stroke="#C47C2A" stroke-width="2" fill="none"/>` +
        `<path d="M34 92 C34 56 46 46 60 46 C74 46 86 56 86 92 Z" fill="#B8692A" ${O}/><path d="M42 66 Q46 54 56 50" stroke="#D89050" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
    },
    cincin: {
      name: 'Kuih Cincin', origin: 'Sabah', note: 'Crunchy ring-shaped kuih made with palm sugar',
      half: 36, faceDy: -2,
      sil: '<path fill-rule="evenodd" d="M60 27 a37 37 0 1 0 0.01 0 Z M60 64 a11 11 0 1 0 0.01 0 Z"/>',
      art: () => `<path fill-rule="evenodd" d="M60 27 a37 37 0 1 0 0.01 0 Z M60 64 a11 11 0 1 0 0.01 0 Z" fill="#7A4524" ${O}/>` +
        [20, 27, 33].map(r => `<circle cx="60" cy="72" r="${r}" fill="none" stroke="#5A2F16" stroke-width="1.6" stroke-dasharray="9 5" opacity=".8"/>`).join('') +
        `<circle cx="60" cy="75" r="11" fill="none" ${O.replace('3.5', '2.5')}/><path d="M34 46 A30 30 0 0 1 54 32" stroke="#A8693C" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
    },
    hinompuka: {
      name: 'Hinompuka', origin: 'Sabah', note: 'KadazanDusun rice cake steamed in leaves, served at Kaamatan',
      half: 30, faceDy: 9,
      sil: '<rect x="30" y="32" width="60" height="70" rx="10"/><path d="M52 34 L46 14 L60 26 L74 14 L68 34 Z"/>',
      art: id => `<path d="M52 34 L46 14 L60 26 L74 14 L68 34 Z" fill="#7DB257" ${O.replace('3.5', '2.5')}/>` +
        `<clipPath id="k${id}"><rect x="30" y="32" width="60" height="70" rx="10"/></clipPath><rect x="30" y="32" width="60" height="70" rx="10" fill="#8CBA5E"/><g clip-path="url(#k${id})">` +
        [0, 1, 2, 3, 4, 5, 6].map(i => `<path d="M${18 + i * 14} 30 L${34 + i * 14} 106" stroke="#6E9C45" stroke-width="1.5"/>`).join('') +
        `<path d="M30 46 H90" stroke="#5E8A3A" stroke-width="2.5"/></g><rect x="30" y="32" width="60" height="70" rx="10" fill="none" ${O}/>` +
        `<path d="M48 34 Q60 40 72 34" stroke="#8A5A2B" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="60" cy="36" r="3.5" fill="#8A5A2B"/>`
    }
  };

  /* ---------- festive outfits (1.6.0) ----------
     Worn only in the few days before a festival and on the day itself (see data.js).
     Headwear sits on each kuih's top edge; clothing is clipped to the kuih's own outline. */
  const TOPS = { lapis: [18, 1], onde: [29, 0], serimuka: [24, 1], karipap: [30, 0], bahulu: [26, 0], angku: [26, 0], kapit: [14, 1], huat: [16, 0], bulan: [32, 1], tart: [27, 0],
    murukku: [27, 0], ladoo: [32, 0], putu: [30, 0], vadai: [27, 0], jalebi: [20, 1], keklapis: [20, 1], celorot: [18, 0], pinjaram: [46, 0], cincin: [27, 0], hinompuka: [32, 1] };
  const crown = sid => { const t = TOPS[sid] || [20, 1]; return t[0] + (t[1] ? 3 : 7); };
  const hem = K => Math.max(80, 70 + (K.faceDy || 0) + 6); // clothing starts below the mouth
  const S2 = `stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"`;
  const OUTFITS = {
    raya: { // baju Melayu: black velvet songkok and a songket sampin, holding a ketupat
      hat: y => `<path d="M43 ${y + 1} L45 ${y - 13} Q60 ${y - 16} 75 ${y - 13} L77 ${y + 1} Q60 ${y + 4} 43 ${y + 1} Z" fill="#1C1A1F" ${S2}/><path d="M47 ${y - 9} Q60 ${y - 11} 73 ${y - 9}" stroke="#4A4552" stroke-width="1.6" fill="none"/>`,
      body: (y, id) => `<g clip-path="url(#c${id})"><rect x="0" y="${y}" width="120" height="40" fill="#5B1F4A"/>` +
        [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => `<path d="M${14 + i * 11} ${y + 9} l5.5 -5 l5.5 5 l-5.5 5 Z" fill="none" stroke="#E7B84A" stroke-width="1.6"/>`).join('') +
        `<rect x="0" y="${y}" width="120" height="3" fill="#E7B84A"/><rect x="0" y="${y + 17}" width="120" height="2" fill="#E7B84A"/></g>`,
      prop: (x, y) => `<g transform="translate(${x} ${y}) rotate(-12)"><path d="M0 -12 L11 0 L0 12 L-11 0 Z" fill="#9BC45A" ${S2}/><path d="M-5.5 -6 L5.5 6 M5.5 -6 L-5.5 6 M0 -12 L0 12" stroke="#5E8A2E" stroke-width="1.6"/><path d="M0 12 q3 8 -2 14" fill="none" stroke="#9BC45A" stroke-width="3" stroke-linecap="round"/></g>`
    },
    cny: { // samfu: black cap with a red knot, red top with gold frog buttons, holding a mandarin orange
      hat: y => `<path d="M44 ${y + 1} Q44 ${y - 15} 60 ${y - 15} Q76 ${y - 15} 76 ${y + 1} Q60 ${y + 4} 44 ${y + 1} Z" fill="#1C1A1F" ${S2}/><path d="M60 ${y - 15} V${y + 2} M51 ${y - 13} Q50 ${y - 6} 50 ${y + 2} M69 ${y - 13} Q70 ${y - 6} 70 ${y + 2}" stroke="#3B3740" stroke-width="1.4" fill="none"/><circle cx="60" cy="${y - 18}" r="4" fill="#D7263D" ${S2}/>`,
      body: (y, id, sid) => `<g clip-path="url(#c${id})"><rect x="0" y="${y}" width="120" height="40" fill="${sid === 'angku' ? '#1F1A17' : '#D7263D'}"/><rect x="0" y="${y}" width="120" height="3" fill="#F4C542"/>` +
        [0, 1, 2].map(i => `<path d="M53 ${y + 8 + i * 7} h14" stroke="#F4C542" stroke-width="2.2" stroke-linecap="round"/><circle cx="60" cy="${y + 8 + i * 7}" r="2" fill="#F4C542"/>`).join('') +
        [[24, 14], [90, 20], [34, 28], [96, 6]].map(([x, d]) => `<circle cx="${x}" cy="${y + d}" r="3" fill="none" stroke="#F4C542" stroke-width="1.3"/>`).join('') + '</g>',
      prop: (x, y) => `<g transform="translate(${x} ${y})"><circle r="9" fill="#F7931E" ${S2}/><path d="M0 -9 q5 -7 10 -4 q-4 4 -10 4" fill="#5FA046" stroke="${INK}" stroke-width="1.8"/><circle cx="-3" cy="-3" r="2" fill="#FFC56B"/></g>`
    },
    deepavali: { // saree drape with a gold border, jasmine in the hair and a pottu, holding a diya lamp
      hat: y => `<path d="M40 ${y + 4} Q60 ${y - 10} 80 ${y + 4}" fill="none" stroke="#2F7D32" stroke-width="2"/>` +
        [-4, -3, -2, -1, 0, 1, 2, 3, 4].map(i => { const x = 60 + i * 5, yy = y + 4 - 14 * (1 - (i / 4.4) ** 2); return `<circle cx="${x}" cy="${yy.toFixed(1)}" r="3.4" fill="${i === 0 ? '#F7931E' : '#FFFDF5'}" stroke="${INK}" stroke-width="1.5"/>`; }).join(''),
      body: (y, id) => `<g clip-path="url(#c${id})"><path d="M0 ${y - 4} L120 ${y + 10} L120 140 L0 140 Z" fill="#C2185B"/><path d="M0 ${y - 4} L120 ${y + 10}" stroke="#F4C542" stroke-width="5"/><path d="M0 ${y + 3} L120 ${y + 17}" stroke="#F4C542" stroke-width="1.4" stroke-dasharray="2 4"/>` +
        [[30, 16], [52, 24], [74, 22], [92, 30]].map(([x, d]) => `<circle cx="${x}" cy="${y + d}" r="1.8" fill="#F4C542"/>`).join('') + '</g>',
      face: (fy) => `<circle cx="60" cy="${40 + fy}" r="2.6" fill="#D7263D"/>`,
      prop: (x, y) => `<g transform="translate(${x} ${y + 4})"><path d="M-11 -2 Q0 12 11 -2 Q0 1 -11 -2 Z" fill="#B5652B" ${S2}/><path d="M0 -4 Q-4 -10 0 -18 Q4 -10 0 -4 Z" fill="#FFB020" stroke="#E2711D" stroke-width="1.4"/></g>`
    },
    kaamatan: { // KadazanDusun: black sinuangga with gold and red trim, and a woven siga on the head
      hat: y => `<path d="M42 ${y + 2} L44 ${y - 9} L74 ${y - 9} L84 ${y - 20} L80 ${y - 6} L78 ${y + 2} Q60 ${y + 5} 42 ${y + 2} Z" fill="#1F1A17" ${S2}/><path d="M44 ${y - 4} H78 M46 ${y - 7} H76" stroke="#E2B43A" stroke-width="1.6"/><path d="M50 ${y - 1} l3 -3 l3 3 l3 -3 l3 3 l3 -3 l3 3 l3 -3 l3 3" fill="none" stroke="#D7263D" stroke-width="1.4"/>`,
      body: (y, id) => `<g clip-path="url(#c${id})"><rect x="0" y="${y}" width="120" height="40" fill="#1F1A17"/><rect x="0" y="${y}" width="120" height="4" fill="#E2B43A"/><rect x="0" y="${y + 6}" width="120" height="2" fill="#D7263D"/><rect x="0" y="${y + 10}" width="120" height="2" fill="#3FA34D"/>` +
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => `<circle cx="${12 + i * 11}" cy="${y + 18}" r="2.2" fill="#E2B43A"/>`).join('') + '</g>',
      prop: null
    },
    gawai: { // Iban: hornbill-feather headdress on a beaded band, pua kumbu weave and a silver belt
      hat: y => `<path d="M42 ${y + 2} Q60 ${y - 6} 78 ${y + 2} L78 ${y + 6} Q60 ${y - 2} 42 ${y + 6} Z" fill="#D7263D" ${S2}/>` +
        [[-10, -24, -14], [0, -32, 0], [10, -24, 14]].map(([dx, h, r]) => `<g transform="translate(${60 + dx} ${y - 1}) rotate(${r})"><path d="M-3.5 0 Q-5 ${h / 2} 0 ${h} Q5 ${h / 2} 3.5 0 Z" fill="#FFFDF5" ${S2}/><path d="M-2.6 ${h * 0.62} Q0 ${h * 1.02} 2.6 ${h * 0.62} Q0 ${h * 0.86} -2.6 ${h * 0.62} Z" fill="#1F1A17"/></g>`).join('') +
        [46, 52, 58, 64, 70, 76].map((x, i) => `<circle cx="${x}" cy="${y + 2}" r="1.6" fill="${['#F4C542', '#1F1A17', '#FFFDF5'][i % 3]}"/>`).join(''),
      body: (y, id) => `<g clip-path="url(#c${id})"><rect x="0" y="${y}" width="120" height="40" fill="#7A2318"/>` +
        [0, 1, 2, 3, 4, 5, 6].map(i => `<path d="M${10 + i * 15} ${y + 13} l7 -6 l7 6 l-7 6 Z" fill="none" stroke="#F3E3C3" stroke-width="1.6"/><circle cx="${17 + i * 15}" cy="${y + 13}" r="1.4" fill="#1F1A17"/>`).join('') +
        `<rect x="0" y="${y}" width="120" height="4" fill="#C9CED6"/>` + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => `<circle cx="${6 + i * 11}" cy="${y + 2}" r="2.4" fill="#E9EDF2" stroke="#8A919C" stroke-width=".8"/>`).join('') + '</g>',
      prop: null
    }
  };
  const PROPS = {
    glass: (x, y) => `<g transform="translate(${x} ${y - 10})"><path d="M-8 -11 L8 -11 L6 11 L-6 11 Z" fill="#EAF6FB" ${S2}/><path d="M-7 -3 L7 -3 L6 11 L-6 11 Z" fill="#5BC0EB"/><path d="M-8 -11 L8 -11 L6 11 L-6 11 Z" fill="none" ${S2}/><path d="M-4 -7 V6" stroke="#fff" stroke-width="2" stroke-linecap="round"/></g>`,
    sip: (x, y) => `<g transform="translate(${x - 9} ${y - 7}) rotate(-55)"><path d="M-8 -11 L8 -11 L6 11 L-6 11 Z" fill="#EAF6FB" ${S2}/><path d="M-6.8 -6 L1 -11 L8 -11 L6 11 L-6 11 Z" fill="#5BC0EB"/><path d="M-8 -11 L8 -11 L6 11 L-6 11 Z" fill="none" ${S2}/><path d="M-4 -6 V6" stroke="#fff" stroke-width="2" stroke-linecap="round"/></g>`
  };
  window.LAPIS_OUTFITS = Object.keys(OUTFITS);

  let uid = 0;
  const pts = a => a.map(p => p.join(',')).join(' ');
  function face(kind, mouth) {
    let eyes;
    if (kind === 'happy') eyes = '<path class="line" d="M45 49 Q50 43 55 49"/><path class="line" d="M65 49 Q70 43 75 49"/>';
    else if (kind === 'closed') eyes = '<path class="line" d="M45 47 H55"/><path class="line" d="M65 47 H75"/>';
    else eyes = '<circle class="eye" cx="50" cy="47" r="3.4"/><circle class="eye" cx="70" cy="47" r="3.4"/>';
    const m = mouth === 'none' ? '' : '<path class="line" d="M53 57 Q60 64 67 57"/>';
    return eyes + m + '<ellipse class="blush" cx="42" cy="60" rx="4.5" ry="2.6"/><ellipse class="blush" cx="78" cy="60" rx="4.5" ry="2.6"/>';
  }
  function figure(p, sticker, id, K, sid, outfit) {
    const legs = p.legs || IDLE_LEGS, arms = p.arms || IDLE_ARMS, d = (K.half || 28) - 28;
    const O2 = outfit && OUTFITS[outfit], fy = K.faceDy || 0;
    // what the right hand holds: the pose's own prop (a glass) wins over a festive one
    const ra = arms[1], rh = ra[ra.length - 1], rdx = d;
    const held = p.prop ? PROPS[p.prop](rh[0] + rdx, rh[1]) : (O2 && O2.prop && !p.front ? O2.prop(rh[0] + rdx, rh[1] - 6) : '');
    let s = '';
    legs.forEach(l => { const e = l[l.length - 1], dx = l[0][0] < 60 ? -3 : 3; s += `<polyline class="limb" points="${pts(l)}"/><ellipse class="foot" cx="${e[0] + dx}" cy="${e[1] + 2}" rx="8" ry="4.5"/>`; });
    s += `<g transform="${p.body || ''}">`;
    let armsSVG = '';
    arms.forEach(a => { const e = a[a.length - 1], dx = a[0][0] < 60 ? -d : d; armsSVG += `<g transform="translate(${dx} 0)"><polyline class="limb" points="${pts(a)}"/><circle class="hand" cx="${e[0]}" cy="${e[1]}" r="4.6"/></g>`; });
    if (!p.front) s += armsSVG + held;
    if (sticker) s += K.sil;
    else {
      s += K.art(id);
      if (O2) s += `<clipPath id="c${id}">${K.sil}</clipPath>` + O2.body(hem(K), id, sid);
      s += `<g transform="translate(0 ${fy})">${face(p.face, p.mouth || K.mouth)}</g>`;
      if (O2 && O2.face) s += O2.face(fy);
    }
    if (O2) s += O2.hat(crown(sid));
    if (p.front) s += armsSVG + held;
    s += '</g>' + (p.extra || '');
    return s;
  }
  // Just the kuih and its face (no arms or legs), cropped square: used to draw the tray icon.
  window.lapisBodySVG = function (skin) {
    const K = KUIH[skin] || KUIH.lapis, id = ++uid;
    // Standalone image (no page CSS), so the face gets its styling inline.
    const f = face('', K.mouth)
      .replace(/class="eye"/g, `fill="${INK}"`)
      .replace(/class="line"/g, `fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"`)
      .replace(/class="blush"/g, 'fill="#F58FAE" opacity=".85"');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="14 8 92 98" width="92" height="98">${K.art(id)}<g transform="translate(0 ${K.faceDy || 0})">${f}</g></svg>`;
  };
  window.LAPIS_KUIH = Object.entries(KUIH).map(([id, k]) => ({ id, name: k.name, origin: k.origin, note: k.note }));
  window.lapisSVG = function (pose, label, bob, skin, outfit) {
    const sid = KUIH[skin] ? skin : 'lapis', K = KUIH[sid], id = ++uid;
    const p0 = POSES[pose] || POSES.idle, p = typeof p0 === 'function' ? p0(K) : p0;
    const o = Object.prototype.hasOwnProperty.call(OUTFITS, outfit) ? outfit : null;
    return `<svg class="lapis" viewBox="-8 -${o ? 30 : 14} 136 ${o ? 182 : 166}" role="img" aria-label="${label || K.name}"><g class="${bob ? 'bob' : ''}"><g class="stk">${figure(p, true, id, K, sid, o)}</g><g>${figure(p, false, id, K, sid, o)}</g></g></svg>`;
  };
})();
