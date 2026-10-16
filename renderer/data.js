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
  const api = { EX, CYCLE, BY };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LapisData = api;
})(typeof self !== 'undefined' ? self : this);
