import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config/gameConfig.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { ClimbScene } from './scenes/ClimbScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { ShopScene } from './scenes/ShopScene.js';
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
  scene: [BootScene, MenuScene, ClimbScene, PauseScene, ShopScene],
  disableContextMenu: true,
});

window.__game = game;
installFullscreenKey();
if (isTouchDevice()) installTouchControls();
// Unlock audio on the very first real touch or click (required on iOS).
window.addEventListener('pointerdown', () => Audio.init(), { once: true, capture: true });

if (import.meta.env.DEV && params.has('harness')) import('../tests/browserHarness.js');
