// The Far Range's side scenery (render/farSideArt.js) on screen: for each
// Far Range biome, a back and a mid strip on both sides of the screen,
// scrolling up with parallax as you climb, faded in by how much of that
// biome you are in, lit by the hour (hazier further back), with falling water
// that flows and windows and fungus that glow at night.
import { DEPTH, GAME_WIDTH } from '../config/gameConfig.js';
import { lerpColor } from '../utils/color.js';
import { FAR_BIOMES } from '../data/biomes.js';
import { buildFarSideTextures, SIDE_W, SIDE_H } from '../render/farSideArt.js';

const LAYERS = [
  { layer: 'back', f: 0.42, depth: DEPTH.bgWeather + 2, haze: 0.3, inset: 0 },
  { layer: 'mid', f: 0.7, depth: DEPTH.bgWeather + 4, haze: 0.06, inset: -6 },
];

export class FarSides {
  constructor(scene) {
    this.scene = scene;
    this.items = null;
    this.t = 0;
  }

  // Paint the textures ahead of time (the scene calls this while the dragon
  // flight's cutscene starts, so the ~150 ms of painting is never felt).
  prebuild() { if (!this.items) this.build(); }

  build() {
    const sc = this.scene;
    buildFarSideTextures(sc);
    this.items = [];
    for (const id of FAR_BIOMES) {
      for (const L of LAYERS) {
        for (const side of ['l', 'r']) {
          const key = `far_side_${id}_${L.layer}_${side}`;
          const x = side === 'l' ? L.inset : GAME_WIDTH - SIDE_W - L.inset;
          const mk = (k, depth, blend) => (sc.textures.exists(k)
            ? sc.add.tileSprite(x, 0, SIDE_W, sc.scale.height + 8, k).setOrigin(0, 0).setScrollFactor(0).setDepth(depth).setFlipX(side === 'r').setVisible(false).setBlendMode(blend)
            : null);
          this.items.push({
            id, side, ...L,
            img: mk(key, L.depth, 0),
            water: mk(`${key}_water`, L.depth + 0.1, 0),
            glow: mk(`${key}_glow`, L.depth + 0.2, 1),
          });
        }
      }
    }
  }

  // weightOf(id): how much of that biome is around you (0..1).
  update(dt, { weightOf, camY, light, skyBottom, night }) {
    this.t += dt;
    const any = FAR_BIOMES.some((id) => weightOf(id) > 0.001);
    if (!any && !this.items) return;
    if (!this.items) this.build();
    for (const it of this.items) {
      const w = weightOf(it.id);
      const on = w > 0.01;
      for (const o of [it.img, it.water, it.glow]) if (o) o.setVisible(on);
      if (!on) continue;
      const ty = ((camY * it.f) % SIDE_H + SIDE_H) % SIDE_H;
      const tint = lerpColor(light, skyBottom, it.haze * (1 - night * 0.5));
      it.img.setTilePosition(0, ty).setAlpha(w).setTint(tint);
      if (it.water) it.water.setTilePosition(0, ty - this.t * 0.11 * (it.layer === 'mid' ? 1.4 : 1)).setAlpha(w * 0.92).setTint(lerpColor(tint, 0xffffff, 0.3));
      if (it.glow) it.glow.setTilePosition(0, ty).setAlpha(w * Math.max(0, night - 0.15) * 1.15 * (0.85 + 0.15 * Math.sin(this.t / 700 + it.f * 9)));
    }
  }

  destroy() { (this.items || []).forEach((it) => [it.img, it.water, it.glow].forEach((o) => o && o.destroy())); }
}
