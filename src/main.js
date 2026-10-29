import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config/gameConfig.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { ClimbScene } from './scenes/ClimbScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { CollectionScene } from './scenes/CollectionScene.js';
import { ExpeditionScene } from './scenes/ExpeditionScene.js';
import { LeaderboardScene } from './scenes/LeaderboardScene.js';
import { SettingsScene } from './scenes/SettingsScene.js';
import { DaresScene } from './scenes/DaresScene.js';
import { ControlsScene } from './scenes/ControlsScene.js';
import { MapScene } from './scenes/MapScene.js';
import { installFullscreenKey } from './utils/fullscreen.js';
import { installTouchControls, isTouchDevice } from './ui/TouchControls.js';
import { Audio } from './systems/AudioSystem.js';

// ?timer drives the loop with setTimeout (useful for automated testing in
// hidden/background tabs where requestAnimationFrame is suspended).
const params = new URLSearchParams(window.location.search);

const game = new Phaser.Game({
  fps: { target: 60, forceSetTimeOut: params.has('timer') },
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0d0f1a',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, MenuScene, ClimbScene, PauseScene, ShopScene, CollectionScene, ExpeditionScene, LeaderboardScene, SettingsScene, DaresScene, ControlsScene, MapScene],
  disableContextMenu: true,
});

window.__game = game;
if (import.meta.env.DEV) window.__audio = Audio;
installFullscreenKey();
if (isTouchDevice()) installTouchControls();
// Unlock audio on the very first real touch or click (required on iOS).
window.addEventListener('pointerdown', () => Audio.init(), { once: true, capture: true });

if (import.meta.env.DEV && params.has('harness')) import('../tests/browserHarness.js');

// The installable app (public/sw.js): offline play and updates on the next
// launch. Only for the hosted build; the one-file builds have no sw.js next to them.
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.location.protocol === 'https:' && !window.ATC_SINGLE_FILE) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
