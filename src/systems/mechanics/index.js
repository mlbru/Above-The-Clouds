// Biome mechanics: each biome may name one rule in `mechanic`. This manager
// runs them all and combines what they do to the weather, the sky and routes.
import { BIOMES } from '../../data/biomes.js';
import { Whiteout } from './Whiteout.js';
import { Rockfall } from './Rockfall.js';
import { Thermals } from './Thermals.js';
import { Darkness } from './Darkness.js';
import { PrismLight } from './PrismLight.js';
import { Storm } from './Storm.js';
import { Swing } from './Swing.js';
import { DragonEye } from './DragonEye.js';
import { Swarm } from './Swarm.js';
import { Gears } from './Gears.js';
import { BoneGarden } from './BoneGarden.js';

const MECHANICS = { whiteout: Whiteout, rockfall: Rockfall, thermals: Thermals, darkness: Darkness, prismLight: PrismLight, storm: Storm, swing: Swing, dragonEye: DragonEye, swarm: Swarm, gears: Gears, boneGarden: BoneGarden };

export class BiomeMechanics {
  constructor(rng) {
    this.list = Object.values(BIOMES)
      .filter((b) => b.mechanic)
      .map((b) => ({ biome: b.id, id: b.mechanic, impl: new MECHANICS[b.mechanic](rng) }));
  }

  // mix: biomeMixAt() at the climber. Returns [{ id, event }] for phase changes.
  update(dt, mix) {
    const events = [];
    for (const m of this.list) {
      const w = (mix.a.id === m.biome ? 1 - mix.t : 0) + (mix.b.id === m.biome ? mix.t : 0);
      m.w = w;
      const event = m.impl.update(dt, w);
      if (event) events.push({ id: m.id, event });
    }
    return events;
  }

  // Two biomes can share a rule (the volcano erupts like the Stone Wall's
  // rockfall): the one you are in now wins.
  get(id) {
    const all = this.list.filter((x) => x.id === id);
    const m = all.reduce((best, x) => ((x.w || 0) > (best.w || 0) ? x : best), all[0]);
    return m ? m.impl : null;
  }

  weather() {
    const out = { snow: 0, mist: 0, wind: 0 };
    for (const m of this.list) {
      const w = m.impl.weather();
      out.snow += w.snow; out.mist += w.mist; out.wind += w.wind;
    }
    return out;
  }

  // Lets every mechanic change the routes offered right now (ctx: { mountain }).
  decorateRoutes(routes, ctx) {
    for (const m of this.list) if (m.impl.decorateRoutes) m.impl.decorateRoutes(routes, ctx);
  }
}
