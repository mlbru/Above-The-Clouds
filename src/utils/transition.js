// Cloud wipe between scenes: two banks of cloud roll in from the sides and
// meet in the middle, the next scene starts behind them, and they roll away.
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';

const DEPTH_WIPE = 9000;
const W = Math.round(GAME_WIDTH / 2) + 34;

// One bank of cloud, drawn from x=0 to W with a puffy edge on the open side.
function bank(scene, side) {
  const g = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH_WIPE);
  const edgeX = side < 0 ? W - 24 : 24;
  g.fillStyle(0xdfe4f6, 1).fillRect(side < 0 ? 0 : 24, 0, W - 24, GAME_HEIGHT);
  for (let y = -10, i = 0; y < GAME_HEIGHT + 20; y += 17, i++) {
    const r = 15 + ((i * 7) % 4) * 3;
    const x = edgeX + side * -1 * (((i * 5) % 3) * 4 - 2);
    g.fillStyle(0xbfc6e4, 1).fillCircle(x + 2, y + 3, r);
    g.fillStyle(0xf4f6ff, 1).fillCircle(x, y, r);
    g.fillStyle(0xffffff, 1).fillCircle(x - 3, y - 4, Math.round(r * 0.45));
  }
  g.fillStyle(0xf4f6ff, 1).fillRect(side < 0 ? 0 : 24, 0, W - 40, GAME_HEIGHT);
  return g;
}

// Covers the screen, then calls done (which should start the next scene).
export function wipeOut(scene, done, ms = 380) {
  if (scene.wiping) return;
  scene.wiping = true;
  // Scene instances are reused (the pause menu, a restarted run): clear the
  // flag when this one closes, or the next wipe from it would never run.
  scene.events.once('shutdown', () => { scene.wiping = false; });
  const left = bank(scene, -1).setX(-W - 30);
  const right = bank(scene, 1).setX(GAME_WIDTH + 30);
  scene.tweens.add({ targets: left, x: 0, duration: ms, ease: 'Cubic.easeIn' });
  scene.tweens.add({
    targets: right, x: GAME_WIDTH - W, duration: ms, ease: 'Cubic.easeIn',
    onComplete: () => { scene.registry.set('wipeIn', true); done(); },
  });
}

// Call at the end of create(): if a wipe led here, the clouds roll away.
export function wipeIn(scene, ms = 480) {
  scene.wiping = false;
  if (!scene.registry.get('wipeIn')) return;
  scene.registry.set('wipeIn', false);
  const left = bank(scene, -1).setX(0);
  const right = bank(scene, 1).setX(GAME_WIDTH - W);
  scene.tweens.add({ targets: left, x: -W - 30, duration: ms, ease: 'Cubic.easeOut', onComplete: () => left.destroy() });
  scene.tweens.add({ targets: right, x: GAME_WIDTH + 30, duration: ms, ease: 'Cubic.easeOut', onComplete: () => right.destroy() });
}
