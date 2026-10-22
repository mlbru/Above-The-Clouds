import { COSMETICS, DEFAULT_LOOK, describeRequirement } from '../data/cosmetics.js';
import { GEMS } from '../data/gems.js';
import { GEAR_BY_ID, PERK_BY_ID, PACK_SLOTS } from '../data/shop.js';

const KEY = 'above-the-clouds-save-v1';

export const DEFAULT_SETTINGS = {
  music: 0.6,
  sfx: 0.8,
  shake: true,
  reducedParticles: false,
  forgiving: false,
  mode: 'normal',
};

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

function freshData() {
  return {
    version: 1,
    bestHeight: 0,
    bestByMode: { normal: 0, hard: 0, summit: 0 },
    totalClimbed: 0,
    bestStreak: 0,
    tutorialDone: false,
    runs: 0,
    photos: 0,
    biomes: [],
    viewpoints: [],
    discoveries: [],
    unlocked: Object.values(COSMETICS).flat().filter((c) => !c.requirement).map((c) => c.id),
    look: { ...DEFAULT_LOOK },
    settings: { ...DEFAULT_SETTINGS },
    gems: 0,
    gemsEarned: 0,
    gemsFound: {},
    inventory: {},
    packed: [],
    perks: [],
    activePerk: null,
    cheats: {},
  };
}

// Persistent progression. Survives falls and restarts; never affects difficulty.
export class ProgressionSystem {
  constructor(storage) {
    try {
      this.storage = storage || globalThis.localStorage || memoryStorage();
      this.storage.getItem('probe');
    } catch {
      this.storage = memoryStorage();
    }
    this.data = this.load();
  }

  load() {
    const base = freshData();
    try {
      const raw = this.storage.getItem(KEY);
      if (!raw) return base;
      const parsed = JSON.parse(raw);
      // Items without a requirement (including ones added in later versions) are always owned.
      const unlocked = [...new Set([...(parsed.unlocked || []), ...base.unlocked])];
      return { ...base, ...parsed, unlocked, bestByMode: { ...base.bestByMode, ...parsed.bestByMode }, look: { ...base.look, ...parsed.look }, settings: { ...base.settings, ...parsed.settings }, gemsFound: { ...parsed.gemsFound }, inventory: { ...parsed.inventory } };
    } catch {
      return base;
    }
  }

  save() {
    try { this.storage.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage full or blocked */ }
  }

  get settings() { return this.data.settings; }
  setSetting(key, value) { this.data.settings[key] = value; this.save(); }

  // Returns any cosmetics that became unlocked.
  checkUnlocks() {
    const d = this.data;
    const newly = [];
    for (const item of Object.values(COSMETICS).flat()) {
      if (d.unlocked.includes(item.id) || !item.requirement) continue;
      const r = item.requirement;
      const ok = (r.height && d.bestHeight >= r.height)
        || (r.viewpoints && d.viewpoints.length >= r.viewpoints)
        || (r.discoveries && d.discoveries.length >= r.discoveries)
        || (r.discovery && d.discoveries.includes(r.discovery))
        || (r.streak && d.bestStreak >= r.streak);
      if (ok) { d.unlocked.push(item.id); newly.push(item); }
    }
    return newly;
  }

  // Records a height for the given mode. newBest refers to that mode's record;
  // unlocks use the overall best across modes.
  recordHeight(h, mode = 'normal') {
    let newBest = false;
    const v = Math.floor(h * 10) / 10;
    const byMode = this.data.bestByMode;
    if (v > (byMode[mode] || 0)) { byMode[mode] = v; newBest = true; }
    if (v > this.data.bestHeight) this.data.bestHeight = v;
    const unlocks = this.checkUnlocks();
    if (newBest || unlocks.length) this.save();
    return { newBest, unlocks };
  }

  // Records a perfect streak. Returns cosmetics unlocked by it.
  recordStreak(n) {
    if (n <= this.data.bestStreak) return [];
    this.data.bestStreak = n;
    const unlocks = this.checkUnlocks();
    this.save();
    return unlocks;
  }

  bestFor(mode) { return this.data.bestByMode[mode] || 0; }

  addClimbed(m) { this.data.totalClimbed += m; }

  addToList(list, id) {
    if (!id || this.data[list].includes(id)) return { isNew: false, unlocks: [] };
    this.data[list].push(id);
    const unlocks = this.checkUnlocks();
    this.save();
    return { isNew: true, unlocks };
  }
  discoverBiome(id) { return this.addToList('biomes', id); }
  discoverViewpoint(name) { return this.addToList('viewpoints', name); }
  discover(id) { return this.addToList('discoveries', id); }

  isUnlocked(id) { return this.data.unlocked.includes(id); }
  setLook(slot, id) { if (this.isUnlocked(id)) { this.data.look[slot] = id; this.save(); } }
  startRun() { this.data.runs++; this.save(); }

  // ---------- gems & the trader ----------
  get infiniteGems() { return !!(this.data.cheats && this.data.cheats.infiniteGems); }
  get gems() { return this.infiniteGems ? 99999 : this.data.gems; }

  // Cheat codes (settings > ENTER CODE). Entering a code again switches it off.
  redeemCode(raw) {
    const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cheats = this.data.cheats || (this.data.cheats = {});
    if (code === 'GEMSTORM') {
      cheats.infiniteGems = !cheats.infiniteGems;
      this.save();
      return { ok: true, message: cheats.infiniteGems ? 'UNLIMITED GEMS: ON' : 'UNLIMITED GEMS: OFF' };
    }
    if (code === 'WARPZONE') {
      cheats.devTeleport = !cheats.devTeleport;
      this.save();
      return { ok: true, message: cheats.devTeleport ? 'DEV TELEPORT: ON (TITLE SCREEN)' : 'DEV TELEPORT: OFF' };
    }
    return { ok: false, message: 'UNKNOWN CODE' };
  }

  // Adds gems to the wallet. `type` records a found regional stone.
  addGems(amount, type = null) {
    const d = this.data;
    const n = Math.max(0, Math.round(amount));
    d.gems += n;
    d.gemsEarned += n;
    if (type && GEMS[type]) d.gemsFound[type] = (d.gemsFound[type] || 0) + 1;
    this.save();
    return n;
  }

  found(type) { return this.infiniteGems ? 99 : this.data.gemsFound[type] || 0; }

  spend(price) {
    if (this.infiniteGems) return true;
    if (price > this.data.gems) return false;
    this.data.gems -= price;
    this.save();
    return true;
  }

  // What the trader can do with a cosmetic: owned | buy | poor | locked.
  cosmeticStatus(item) {
    if (this.isUnlocked(item.id)) return { state: 'owned' };
    const r = item.requirement;
    if (!r || !r.price) return { state: 'locked', reason: describeRequirement(r) };
    if (r.gem && this.found(r.gem) < r.count) {
      const g = GEMS[r.gem];
      return { state: 'locked', reason: `FIND ${r.count} ${g.name}${r.count > 1 ? 'S' : ''} (${this.found(r.gem)}/${r.count})`, price: r.price };
    }
    return { state: this.gems >= r.price ? 'buy' : 'poor', price: r.price };
  }

  buyCosmetic(slot, item) {
    if (this.cosmeticStatus(item).state !== 'buy' || !this.spend(item.requirement.price)) return false;
    this.data.unlocked.push(item.id);
    this.data.look[slot] = item.id;
    this.save();
    return true;
  }

  owned(gearId) { return this.data.inventory[gearId] || 0; }

  buyGear(id) {
    const g = GEAR_BY_ID[id];
    if (!g || !this.spend(g.price)) return false;
    this.data.inventory[id] = this.owned(id) + 1;
    if (!this.data.packed.includes(id) && this.data.packed.length < PACK_SLOTS) this.data.packed.push(id);
    this.save();
    return true;
  }

  isPacked(id) { return this.data.packed.includes(id); }

  // Returns the new packed state, or null if it could not be packed.
  togglePack(id) {
    const p = this.data.packed;
    if (p.includes(id)) { p.splice(p.indexOf(id), 1); this.save(); return false; }
    if (p.length >= PACK_SLOTS || this.owned(id) < 1) return null;
    p.push(id);
    this.save();
    return true;
  }

  // Spends one of every packed item. Items you still own stay packed.
  consumePack() {
    const used = [];
    for (const id of this.data.packed) {
      if (this.owned(id) < 1) continue;
      this.data.inventory[id]--;
      used.push(id);
    }
    this.data.packed = this.data.packed.filter((id) => this.owned(id) > 0);
    this.save();
    return used;
  }

  hasPerk(id) { return this.data.perks.includes(id); }

  buyPerk(id) {
    const p = PERK_BY_ID[id];
    if (!p || this.hasPerk(id) || !this.spend(p.price)) return false;
    this.data.perks.push(id);
    if (!this.data.activePerk) this.data.activePerk = id;
    this.save();
    return true;
  }

  // Selecting the active perk again turns it off.
  setActivePerk(id) {
    if (id && !this.hasPerk(id)) return;
    this.data.activePerk = this.data.activePerk === id ? null : id;
    this.save();
  }
  addPhoto() { this.data.photos++; this.save(); }
}

// A throwaway copy for dev runs: plays like the real save but never writes it.
// Settings and codes stay shared, so the pause menu still works.
export function sandboxCopy(prog) {
  const json = JSON.stringify(prog.data);
  const copy = new ProgressionSystem({ getItem: () => json, setItem: () => {} });
  copy.data.settings = prog.data.settings;
  copy.data.cheats = prog.data.cheats;
  return copy;
}
