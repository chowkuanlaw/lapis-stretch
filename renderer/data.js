/* Stretch library, kuih, unlock rules and festival dates.
   Shared by the main process (require) and the windows (script tag). */
(function (root) {
  'use strict';
  // Each text field has an English version and a Bahasa Melayu one (ms).
  const EX = [
    { id: 'chin', name: 'Chin tucks', pose: 'chin', cue: 'Slide your head straight back, like making a double chin.', dose: '10 slow reps', secs: 45,
      steps: ['Sit tall with your eyes level.', 'Glide your chin straight back without tipping your head down. Hold for 2 seconds.', 'Relax forward and repeat slowly.'],
      ms: { name: 'Tarik dagu', cue: 'Tarik kepala lurus ke belakang, seperti membuat dagu berlapis.', dose: '10 kali perlahan',
        steps: ['Duduk tegak, mata pandang lurus ke depan.', 'Tarik dagu lurus ke belakang tanpa menunduk. Tahan 2 saat.', 'Lepaskan ke depan dan ulang perlahan-lahan.'] } },
    { id: 'neck', name: 'Neck side stretch', pose: 'neck', cue: 'Ear toward shoulder. Keep the other shoulder down.', dose: '20 sec each side', secs: 40, sides: true,
      steps: ['Drop your right ear toward your right shoulder.', 'Rest your right hand lightly on your head. Do not pull.', 'Keep the left shoulder heavy. Switch sides halfway.'],
      ms: { name: 'Regangan sisi leher', cue: 'Telinga ke arah bahu. Bahu sebelah lagi kekal di bawah.', dose: '20 saat setiap sisi',
        steps: ['Jatuhkan telinga kanan ke arah bahu kanan.', 'Letakkan tangan kanan perlahan di atas kepala. Jangan tarik.', 'Biarkan bahu kiri rendah. Tukar sisi di pertengahan.'] } },
    { id: 'thoracic', name: 'Thoracic extension', pose: 'thoracic', cue: 'Hands behind your head, arch back over the chair.', dose: '10 reps', secs: 40,
      steps: ['Sit so the top of the chair back meets your mid-back.', 'Lace your fingers behind your head, elbows wide.', 'Breathe out and lean back over the chair, then return. Keep your neck relaxed.'],
      ms: { name: 'Lentur belakang atas', cue: 'Tangan di belakang kepala, lentur ke belakang di atas kerusi.', dose: '10 kali',
        steps: ['Duduk supaya bahagian atas penyandar kerusi berada di tengah belakang anda.', 'Silangkan jari di belakang kepala, siku dibuka luas.', 'Hembus nafas dan sandar ke belakang di atas kerusi, kemudian kembali. Biarkan leher santai.'] } },
    { id: 'shoulders', name: 'Shoulder rolls', pose: 'shoulders', cue: 'Big slow circles: up, back and down.', dose: '10 backwards', secs: 30,
      steps: ['Let your arms hang loose.', 'Lift your shoulders to your ears, squeeze them back, then drop them down.', 'Keep the circles slow and large.'],
      ms: { name: 'Putar bahu', cue: 'Bulatan besar dan perlahan: ke atas, ke belakang dan ke bawah.', dose: '10 kali ke belakang',
        steps: ['Biarkan lengan tergantung longgar.', 'Angkat bahu ke telinga, rapatkan ke belakang, kemudian turunkan.', 'Buat bulatan yang perlahan dan besar.'] } },
    { id: 'twist', name: 'Seated twist', pose: 'twist', cue: 'Turn your chest toward the chair back. Hips face forward.', dose: '15 sec each side', secs: 30, sides: true,
      steps: ['Sit tall, feet flat on the floor.', 'Hold the chair back or armrest and turn from your ribs, not your neck.', 'Breathe out to turn a little further. Switch sides halfway.'],
      ms: { name: 'Pusing badan', cue: 'Pusingkan dada ke arah penyandar kerusi. Pinggul kekal menghadap ke depan.', dose: '15 saat setiap sisi',
        steps: ['Duduk tegak, kaki rata di lantai.', 'Pegang penyandar atau tempat letak tangan, pusing dari rusuk, bukan dari leher.', 'Hembus nafas untuk pusing sedikit lagi. Tukar sisi di pertengahan.'] } },
    { id: 'wrist', name: 'Wrist stretch', pose: 'wrist', cue: 'Arm out, palm up, gently pull your fingers back.', dose: '20 sec each hand', secs: 40, sides: true,
      steps: ['Straighten one arm in front of you, palm facing up.', 'With the other hand, ease the fingers down and back.', 'Hold, then flip the palm down for a few seconds. Switch hands halfway.'],
      ms: { name: 'Regangan pergelangan tangan', cue: 'Lengan lurus, tapak tangan ke atas, tarik jari perlahan ke belakang.', dose: '20 saat setiap tangan',
        steps: ['Luruskan sebelah lengan ke depan, tapak tangan menghadap ke atas.', 'Dengan tangan sebelah lagi, tolak jari perlahan ke bawah dan ke belakang.', 'Tahan, kemudian terbalikkan tapak tangan ke bawah seketika. Tukar tangan di pertengahan.'] } },
    { id: 'eyes', name: '20-20-20 eye break', pose: 'eyes', cue: 'Look at something about 6 metres away.', dose: '20 seconds', secs: 20,
      steps: ['Look away from your screen.', 'Find something far away: a window, the end of the office.', 'Blink slowly a few times while you look.'],
      ms: { name: 'Rehat mata 20-20-20', cue: 'Pandang sesuatu kira-kira 6 meter jauhnya.', dose: '20 saat',
        steps: ['Alihkan pandangan dari skrin.', 'Cari sesuatu yang jauh: tingkap, atau hujung pejabat.', 'Kelip mata perlahan beberapa kali sambil memandang.'] } },
    { id: 'reach', name: 'Stand and reach', pose: 'reach', cue: 'Stand up, reach both arms overhead, lean side to side.', dose: '5 each side', secs: 30,
      steps: ['Stand with feet hip-width apart.', 'Reach both arms up and lace your fingers.', 'Lean gently left, then right. Breathe out on each lean.'],
      ms: { name: 'Berdiri dan capai', cue: 'Berdiri, angkat kedua-dua lengan ke atas, condong ke kiri dan kanan.', dose: '5 kali setiap sisi',
        steps: ['Berdiri dengan kaki selebar pinggul.', 'Angkat kedua-dua lengan dan silangkan jari.', 'Condong perlahan ke kiri, kemudian ke kanan. Hembus nafas setiap kali condong.'] } },
    { id: 'walk', name: 'Walkaround', pose: 'walk', cue: 'Get up and walk. Refill your water, rest your eyes.', dose: '2 min', secs: 120,
      steps: ['Stand up and leave your desk.', 'Walk a lap of the office or to the pantry.', 'Drink some water before you sit back down.'],
      ms: { name: 'Jalan sekejap', cue: 'Bangun dan berjalan. Isi semula air, rehatkan mata.', dose: '2 min',
        steps: ['Bangun dan tinggalkan meja anda.', 'Jalan satu pusingan pejabat atau ke pantri.', 'Minum air sebelum duduk semula.'] } }
  ];
  const CYCLE = ['chin', 'neck', 'thoracic', 'eyes', 'walk', 'shoulders', 'twist', 'wrist', 'eyes', 'reach', 'chin', 'walk'];
  const BY = Object.fromEntries(EX.map(e => [e.id, e]));
  const KUIH_GROUPS = [
    { id: 'malay', title: 'Malay', sub: 'From the Malay kitchen', ms: { title: 'Melayu', sub: 'Dari dapur Melayu' } },
    { id: 'chinese', title: 'Chinese & Nyonya', sub: 'Festival and kopitiam favourites', ms: { title: 'Cina & Nyonya', sub: 'Kegemaran perayaan dan kopitiam' } },
    { id: 'indian', title: 'Indian', sub: 'Deepavali and mamak treats', ms: { title: 'India', sub: 'Juadah Deepavali dan mamak' } },
    { id: 'borneo', title: 'Sabah & Sarawak', sub: 'From Borneo, for Gawai, Kaamatan and Raya', ms: { title: 'Sabah & Sarawak', sub: 'Dari Borneo, untuk Gawai, Kaamatan dan Raya' } }
  ];
  const KUIH = [
    { id: 'lapis', group: 'malay', name: 'Kuih Lapis', origin: 'Malay', note: 'Layered steamed rice-flour cake, peeled one layer at a time.', ms: { origin: 'Melayu', note: 'Kuih kukus tepung beras berlapis, dikupas selapis demi selapis.' } },
    { id: 'onde', group: 'malay', name: 'Onde-onde', origin: 'Malay', note: 'Pandan balls filled with gula melaka and rolled in grated coconut.', ms: { origin: 'Melayu', note: 'Bebola pandan berinti gula melaka, disalut kelapa parut.' } },
    { id: 'serimuka', group: 'malay', name: 'Seri Muka', origin: 'Malay', note: 'Green pandan custard on a layer of glutinous rice.', ms: { origin: 'Melayu', note: 'Kastard pandan hijau di atas lapisan pulut.' } },
    { id: 'karipap', group: 'malay', name: 'Karipap', origin: 'Malay', note: 'Curry puff with a crimped edge, the tea-time classic.', ms: { origin: 'Melayu', note: 'Karipap berkelim cantik, juadah minum petang.' } },
    { id: 'bahulu', group: 'malay', name: 'Kuih Bahulu', origin: 'Malay', note: 'Little golden sponge cakes, a Hari Raya favourite.', ms: { origin: 'Melayu', note: 'Kek span kecil keemasan, kegemaran Hari Raya.' } },
    { id: 'angku', group: 'chinese', name: 'Ang Ku Kueh', origin: 'Chinese', note: 'Red tortoise cake, for luck and a long life.', ms: { origin: 'Cina', note: 'Kuih kura-kura merah, untuk tuah dan panjang umur.' } },
    { id: 'kapit', group: 'chinese', name: 'Kuih Kapit', origin: 'Chinese', note: 'Crispy rolled "love letters" for Chinese New Year.', ms: { origin: 'Cina', note: 'Kuih "surat cinta" rangup yang digulung, untuk Tahun Baru Cina.' } },
    { id: 'huat', group: 'chinese', name: 'Huat Kueh', origin: 'Chinese', note: 'Steamed "prosperity" cake that splits into a smile.', ms: { origin: 'Cina', note: 'Kuih kukus "kemakmuran" yang merekah seperti senyuman.' } },
    { id: 'bulan', group: 'chinese', name: 'Kuih Bulan', origin: 'Chinese', note: 'Mooncake for the Mid-Autumn Festival.', ms: { origin: 'Cina', note: 'Kuih bulan untuk Pesta Tanglung.' } },
    { id: 'tart', group: 'chinese', name: 'Tart Nenas', origin: 'Nyonya', note: 'Pineapple tart with buttery pastry, a festive must.', ms: { origin: 'Nyonya', note: 'Tart nenas berpastri mentega, wajib setiap perayaan.' } },
    { id: 'murukku', group: 'indian', name: 'Murukku', origin: 'Indian', note: 'Crunchy spiral of rice and lentil flour, made for Deepavali.', ms: { origin: 'India', note: 'Pilin rangup tepung beras dan kacang dal, dibuat untuk Deepavali.' } },
    { id: 'ladoo', group: 'indian', name: 'Ladoo', origin: 'Indian', note: 'Sweet round treat for festivals and celebrations.', ms: { origin: 'India', note: 'Manisan bulat untuk perayaan dan keraian.' } },
    { id: 'putu', group: 'indian', name: 'Putu Mayam', origin: 'Indian', note: 'String hoppers with grated coconut and gula melaka.', ms: { origin: 'India', note: 'Putu mayam dengan kelapa parut dan gula melaka.' } },
    { id: 'vadai', group: 'indian', name: 'Vadai', origin: 'Indian', note: 'Savoury lentil doughnut, best with teh tarik.', ms: { origin: 'India', note: 'Kuih kacang dal berbentuk donat, paling sedap dengan teh tarik.' } },
    { id: 'jalebi', group: 'indian', name: 'Jalebi', origin: 'Indian', note: 'Syrupy orange swirls, crisp and sticky.', ms: { origin: 'India', note: 'Lingkaran oren bersirap, rangup dan melekit.' } },
    { id: 'keklapis', group: 'borneo', name: 'Kek Lapis Sarawak', origin: 'Sarawak', note: 'The patterned layer cake Sarawak is famous for, sliced to show its colours.', ms: { origin: 'Sarawak', note: 'Kek lapis bercorak yang terkenal dari Sarawak, dipotong untuk menunjukkan warnanya.' } },
    { id: 'celorot', group: 'borneo', name: 'Kuih Celorot', origin: 'Sarawak', note: 'Gula apong kuih steamed in a cone of rolled palm leaf.', ms: { origin: 'Sarawak', note: 'Kuih gula apong yang dikukus dalam gulungan daun nipah.' } },
    { id: 'pinjaram', group: 'borneo', name: 'Pinjaram', origin: 'Sabah & Sarawak', note: 'Fried "UFO" kuih with a domed middle and crispy rim, also called penyaram.', ms: { origin: 'Sabah & Sarawak', note: 'Kuih "UFO" goreng dengan tengah membonjol dan tepi rangup, juga dipanggil penyaram.' } },
    { id: 'cincin', group: 'borneo', name: 'Kuih Cincin', origin: 'Sabah', note: 'Crunchy ring-shaped kuih made with palm sugar, a Raya favourite.', ms: { origin: 'Sabah', note: 'Kuih rangup berbentuk cincin daripada gula kabung, kegemaran Hari Raya.' } },
    { id: 'hinompuka', group: 'borneo', name: 'Hinompuka', origin: 'Sabah', note: 'KadazanDusun rice cake steamed in leaves, served at Kaamatan.', ms: { origin: 'Sabah', note: 'Kuih pulut KadazanDusun yang dikukus dalam daun, dihidang ketika Kaamatan.' } }
  ];
  const KUIH_BY = Object.fromEntries(KUIH.map(k => [k.id, k]));
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

  /* ---------- kuih collection (1.6.0) ---------- */
  const STARTERS = ['lapis', 'angku', 'murukku', 'keklapis'];
  // In the order they usually unlock. type: what is counted; n: how many.
  const RULES = [
    { id: 'onde', type: 'total', n: 5 },
    { id: 'karipap', type: 'goalDays', n: 1 },
    { id: 'kapit', type: 'variety', n: 9 },
    { id: 'serimuka', type: 'streak', n: 3 },
    { id: 'ladoo', type: 'dayMax', n: 10 },
    { id: 'putu', type: 'weekMax', n: 25 },
    { id: 'tart', type: 'streak', n: 5 },
    { id: 'cincin', type: 'eyes', n: 5 },
    { id: 'huat', type: 'total', n: 50 },
    { id: 'vadai', type: 'allInDay', n: 9 },
    { id: 'celorot', type: 'streak', n: 10 },
    { id: 'bahulu', type: 'total', n: 100 },
    { id: 'jalebi', type: 'streak', n: 20 },
    { id: 'bulan', type: 'total', n: 200 },
    { id: 'pinjaram', type: 'days', n: 30 },
    { id: 'hinompuka', type: 'total', n: 500 }
  ];
  const RULE_BY = Object.fromEntries(RULES.map(r => [r.id, r]));

  const pad = n => String(n).padStart(2, '0');
  const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const keyDate = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const mondayKey = d => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return dayKey(x); };

  /* Everything the unlock rules and Progress need, from the saved history.
     workDays: weekday numbers (0 = Sunday) that count for streaks, or null for every day. */
  function computeStats(history, goal, workDays, now) {
    const h = history || {}, today = dayKey(now || new Date());
    const keys = Object.keys(h).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k) && k <= today).sort();
    const s = { total: 0, days: 0, dayMax: 0, eyes: 0, variety: 0, allInDay: 0, goalDays: 0, weekMax: 0, streak: 0, bestStreak: 0 };
    const seen = new Set(), weeks = {};
    for (const k of keys) {
      const v = h[k] || {}, t = v.total || 0, by = v.by || {};
      s.total += t; if (t > 0) s.days++;
      s.dayMax = Math.max(s.dayMax, t);
      if (t >= goal) s.goalDays++;
      s.eyes += by.eyes || 0;
      const ids = Object.keys(by).filter(id => own(BY, id) && by[id] > 0);
      ids.forEach(id => seen.add(id));
      s.allInDay = Math.max(s.allInDay, ids.length);
      const wk = mondayKey(keyDate(k)); weeks[wk] = (weeks[wk] || 0) + t;
    }
    s.variety = seen.size;
    s.weekMax = Math.max(0, ...Object.values(weeks));
    // streaks: working days at the daily goal; days off never break it, today only counts once reached
    if (keys.length) {
      let run = 0;
      for (let d = keyDate(keys[0]); dayKey(d) <= today; d = addDays(d, 1)) {
        const k = dayKey(d), t = (h[k] && h[k].total) || 0;
        if (workDays && !workDays.includes(d.getDay())) continue;
        if (t >= goal) { run++; s.bestStreak = Math.max(s.bestStreak, run); }
        else if (k !== today) run = 0;
      }
      s.streak = run;
    }
    return s;
  }
  // How far along a rule is: { have, need, done } (streaks unlock on the best streak, show the current one)
  function ruleProgress(rule, s) {
    const have = rule.type === 'streak' ? s.streak : s[rule.type] || 0;
    const best = rule.type === 'streak' ? s.bestStreak : have;
    return { have: Math.min(have, rule.n), need: rule.n, done: best >= rule.n };
  }

  /* ---------- festive outfits (1.6.0) ----------
     The festive day of each festival (Malaysian public holidays). The outfit shows on the
     4 days before and on the day itself; when two overlap, the closer festival wins. */
  const FESTIVAL_DAYS = {
    deepavali: ['2026-11-08', '2027-10-28', '2028-10-17', '2029-11-05', '2030-10-26'],
    cny: ['2027-02-06', '2028-01-26', '2029-02-13', '2030-02-03'],
    raya: ['2027-03-10', '2028-02-27', '2029-02-15', '2030-02-05'],
    kaamatan: [], gawai: []
  };
  for (let y = 2026; y <= 2035; y++) { FESTIVAL_DAYS.kaamatan.push(`${y}-05-31`); FESTIVAL_DAYS.gawai.push(`${y}-06-01`); }
  const LEAD_DAYS = 4;
  function festivalOn(now) {
    const today = keyDate(dayKey(now || new Date()));
    let best = null;
    for (const [id, days] of Object.entries(FESTIVAL_DAYS)) {
      for (const k of days) {
        const left = Math.round((keyDate(k) - today) / 864e5);
        if (left >= 0 && left <= LEAD_DAYS && (!best || left < best.daysLeft)) best = { id, day: k, daysLeft: left };
      }
    }
    return best;
  }

  const api = { EX, CYCLE, BY, KUIH, KUIH_GROUPS, KUIH_BY, STARTERS, RULES, RULE_BY, computeStats, ruleProgress, festivalOn, FESTIVAL_DAYS, dayKey };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LapisData = api;
})(typeof self !== 'undefined' ? self : this);
