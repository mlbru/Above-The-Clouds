import { Audio } from '../systems/AudioSystem.js';

const bar = (v) => '|'.repeat(Math.round(v * 10)) + '.'.repeat(10 - Math.round(v * 10));

// Builds MenuList items for the shared settings page.
export function settingsItems(progression, onBack, onChange = () => {}, onCode = null) {
  const s = () => progression.settings;
  const set = (k, v) => { progression.setSetting(k, v); Audio.setVolumes(s().music, s().sfx); onChange(k, v); };
  const step = (k, d) => set(k, Math.max(0, Math.min(1, Math.round((s()[k] + d) * 10) / 10)));
  return [
    { label: () => `MUSIC   < ${bar(s().music)} >`, onLeft: () => step('music', -0.1), onRight: () => step('music', 0.1), onSelect: () => step('music', s().music >= 1 ? -1 : 0.1) },
    { label: () => `EFFECTS < ${bar(s().sfx)} >`, onLeft: () => step('sfx', -0.1), onRight: () => step('sfx', 0.1), onSelect: () => step('sfx', s().sfx >= 1 ? -1 : 0.1) },
    { label: () => `SCREEN SHAKE: ${s().shake ? 'ON' : 'OFF'}`, onSelect: () => set('shake', !s().shake), onLeft: () => set('shake', !s().shake), onRight: () => set('shake', !s().shake) },
    { label: () => `PARTICLES: ${s().reducedParticles ? 'REDUCED' : 'FULL'}`, onSelect: () => set('reducedParticles', !s().reducedParticles), onLeft: () => set('reducedParticles', !s().reducedParticles), onRight: () => set('reducedParticles', !s().reducedParticles) },
    { label: () => `TIMING: ${s().forgiving ? 'FORGIVING' : 'NORMAL'}${s().forgiving && s().mode && s().mode !== 'normal' ? ' (NORMAL MODE ONLY)' : ''}`, onSelect: () => set('forgiving', !s().forgiving), onLeft: () => set('forgiving', !s().forgiving), onRight: () => set('forgiving', !s().forgiving) },
    ...(onCode ? [{ label: 'ENTER CODE', onSelect: onCode }] : []),
    { label: 'BACK', onSelect: onBack },
  ];
}

export const CONTROLS_TEXT = [
  'CHOOSE ROUTE   ← →  OR  A D  OR  1 2 3',
  'START CLIMB    ↑  W  SPACE  ENTER',
  'CLIMB INPUTS   ← ↑ →  OR  A W D  ON THE BEAT',
  'AT A LEDGE     R REST   V VIEW   C PHOTO',
  'PAUSE          ESC  OR  P        FULLSCREEN  F',
  'DEBUG          F3  OR  `   (B: AUTOPILOT)',
].join('\n');
