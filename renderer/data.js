/* Stretch library shared by the main process (require) and the windows (script tag). */
(function (root) {
  'use strict';
  const EX = [
    { id: 'chin', name: 'Chin tucks', pose: 'chin', cue: 'Slide your head straight back, like making a double chin.', dose: '10 slow reps', secs: 45,
      steps: ['Sit tall with your eyes level.', 'Glide your chin straight back without tipping your head down. Hold for 2 seconds.', 'Relax forward and repeat slowly.'] },
    { id: 'neck', name: 'Neck side stretch', pose: 'neck', cue: 'Ear toward shoulder. Keep the other shoulder down.', dose: '20 sec each side', secs: 40, sides: true,
      steps: ['Drop your right ear toward your right shoulder.', 'Rest your right hand lightly on your head. Do not pull.', 'Keep the left shoulder heavy. Switch sides halfway.'] },
    { id: 'thoracic', name: 'Thoracic extension', pose: 'thoracic', cue: 'Hands behind your head, arch back over the chair.', dose: '10 reps', secs: 40,
      steps: ['Sit so the top of the chair back meets your mid-back.', 'Lace your fingers behind your head, elbows wide.', 'Breathe out and lean back over the chair, then return. Keep your neck relaxed.'] },
    { id: 'shoulders', name: 'Shoulder rolls', pose: 'shoulders', cue: 'Big slow circles: up, back and down.', dose: '10 backwards', secs: 30,
      steps: ['Let your arms hang loose.', 'Lift your shoulders to your ears, squeeze them back, then drop them down.', 'Keep the circles slow and large.'] },
    { id: 'twist', name: 'Seated twist', pose: 'twist', cue: 'Turn your chest toward the chair back. Hips face forward.', dose: '15 sec each side', secs: 30, sides: true,
      steps: ['Sit tall, feet flat on the floor.', 'Hold the chair back or armrest and turn from your ribs, not your neck.', 'Breathe out to turn a little further. Switch sides halfway.'] },
    { id: 'wrist', name: 'Wrist stretch', pose: 'wrist', cue: 'Arm out, palm up, gently pull your fingers back.', dose: '20 sec each hand', secs: 40, sides: true,
      steps: ['Straighten one arm in front of you, palm facing up.', 'With the other hand, ease the fingers down and back.', 'Hold, then flip the palm down for a few seconds. Switch hands halfway.'] },
    { id: 'eyes', name: '20-20-20 eye break', pose: 'eyes', cue: 'Look at something about 6 metres away.', dose: '20 seconds', secs: 20,
      steps: ['Look away from your screen.', 'Find something far away: a window, the end of the office.', 'Blink slowly a few times while you look.'] },
    { id: 'reach', name: 'Stand and reach', pose: 'reach', cue: 'Stand up, reach both arms overhead, lean side to side.', dose: '5 each side', secs: 30,
      steps: ['Stand with feet hip-width apart.', 'Reach both arms up and lace your fingers.', 'Lean gently left, then right. Breathe out on each lean.'] },
    { id: 'walk', name: 'Walkaround', pose: 'walk', cue: 'Get up and walk. Refill your water, rest your eyes.', dose: '2 min', secs: 120,
      steps: ['Stand up and leave your desk.', 'Walk a lap of the office or to the pantry.', 'Drink some water before you sit back down.'] }
  ];
  const CYCLE = ['chin', 'neck', 'thoracic', 'eyes', 'walk', 'shoulders', 'twist', 'wrist', 'eyes', 'reach', 'chin', 'walk'];
  const BY = Object.fromEntries(EX.map(e => [e.id, e]));
  const KUIH_GROUPS = [
    { id: 'malay', title: 'Malay', sub: 'From the Malay kitchen' },
    { id: 'chinese', title: 'Chinese & Nyonya', sub: 'Festival and kopitiam favourites' },
    { id: 'indian', title: 'Indian', sub: 'Deepavali and mamak treats' },
    { id: 'borneo', title: 'Sabah & Sarawak', sub: 'From Borneo, for Gawai, Kaamatan and Raya' }
  ];
  const KUIH = [
    { id: 'lapis', group: 'malay', name: 'Kuih Lapis', origin: 'Malay', note: 'Layered steamed rice-flour cake, peeled one layer at a time.' },
    { id: 'onde', group: 'malay', name: 'Onde-onde', origin: 'Malay', note: 'Pandan balls filled with gula melaka and rolled in grated coconut.' },
    { id: 'serimuka', group: 'malay', name: 'Seri Muka', origin: 'Malay', note: 'Green pandan custard on a layer of glutinous rice.' },
    { id: 'karipap', group: 'malay', name: 'Karipap', origin: 'Malay', note: 'Curry puff with a crimped edge, the tea-time classic.' },
    { id: 'bahulu', group: 'malay', name: 'Kuih Bahulu', origin: 'Malay', note: 'Little golden sponge cakes, a Hari Raya favourite.' },
    { id: 'angku', group: 'chinese', name: 'Ang Ku Kueh', origin: 'Chinese', note: 'Red tortoise cake, for luck and a long life.' },
    { id: 'kapit', group: 'chinese', name: 'Kuih Kapit', origin: 'Chinese', note: 'Crispy rolled "love letters" for Chinese New Year.' },
    { id: 'huat', group: 'chinese', name: 'Huat Kueh', origin: 'Chinese', note: 'Steamed "prosperity" cake that splits into a smile.' },
    { id: 'bulan', group: 'chinese', name: 'Kuih Bulan', origin: 'Chinese', note: 'Mooncake for the Mid-Autumn Festival.' },
    { id: 'tart', group: 'chinese', name: 'Tart Nenas', origin: 'Nyonya', note: 'Pineapple tart with buttery pastry, a festive must.' },
    { id: 'murukku', group: 'indian', name: 'Murukku', origin: 'Indian', note: 'Crunchy spiral of rice and lentil flour, made for Deepavali.' },
    { id: 'ladoo', group: 'indian', name: 'Ladoo', origin: 'Indian', note: 'Sweet round treat for festivals and celebrations.' },
    { id: 'putu', group: 'indian', name: 'Putu Mayam', origin: 'Indian', note: 'String hoppers with grated coconut and gula melaka.' },
    { id: 'vadai', group: 'indian', name: 'Vadai', origin: 'Indian', note: 'Savoury lentil doughnut, best with teh tarik.' },
    { id: 'jalebi', group: 'indian', name: 'Jalebi', origin: 'Indian', note: 'Syrupy orange swirls, crisp and sticky.' },
    { id: 'keklapis', group: 'borneo', name: 'Kek Lapis Sarawak', origin: 'Sarawak', note: 'The patterned layer cake Sarawak is famous for, sliced to show its colours.' },
    { id: 'celorot', group: 'borneo', name: 'Kuih Celorot', origin: 'Sarawak', note: 'Gula apong kuih steamed in a cone of rolled palm leaf.' },
    { id: 'pinjaram', group: 'borneo', name: 'Pinjaram', origin: 'Sabah & Sarawak', note: 'Fried "UFO" kuih with a domed middle and crispy rim, also called penyaram.' },
    { id: 'cincin', group: 'borneo', name: 'Kuih Cincin', origin: 'Sabah', note: 'Crunchy ring-shaped kuih made with palm sugar, a Raya favourite.' },
    { id: 'hinompuka', group: 'borneo', name: 'Hinompuka', origin: 'Sabah', note: 'KadazanDusun rice cake steamed in leaves, served at Kaamatan.' }
  ];
  const KUIH_BY = Object.fromEntries(KUIH.map(k => [k.id, k]));
  const api = { EX, CYCLE, BY, KUIH, KUIH_GROUPS, KUIH_BY };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LapisData = api;
})(typeof self !== 'undefined' ? self : this);
