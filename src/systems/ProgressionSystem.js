import { COSMETICS, DEFAULT_LOOK, describeRequirement } from '../data/cosmetics.js';
import { GEMS } from '../data/gems.js';
import { GEAR_BY_ID, PERK_BY_ID, PACK_SLOTS } from '../data/shop.js';
import { STAMPS } from '../data/logbook.js';
import { STARS, MASTERY_BIOMES } from '../data/mastery.js';
import { LIFT_BY_ID } from '../data/lifts.js';
import { currentSeason } from '../data/seasons.js';

const KEY = 'above-the-clouds-save-v1';

// FNV-1a of a code, as 8 hex digits (see redeemCode).
export function codeHash(code) {
  let h = 0x811c9dc5;
  for (const ch of code) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
const DEBUG_CODE_HASH = 'e17bdefb';

export const DEFAULT_SETTINGS = {
  music: 0.6,
  sfx: 0.8,
  shake: true,
  reducedParticles: false,
  forgiving: false,
  mode: 'normal',
  // Look and feel (Settings): chalk marks, beat pulse, hit-stop, weather on
  // the climber, ledge idles. See ui/SettingsMenu.js for the choices.
  chalkMarks: 'line',
  beatPulse: 'subtle',
  hitStop: 'subtle',
  weatherCoat: true,
  ledgeLife: 'lively',
  // Bram's dares picked for the next endless run (data/dares.js).
  dares: [],
  // The debug overlay in runs (F3 / ` or the menus).
  debugOverlay: false,
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
    // Lift tickets owned, { [biomeId]: count }, and the one picked for the
    // next Normal run (null: start at base camp). See data/lifts.js.
    tickets: {},
    lift: null,
    perks: [],
    activePerk: null,
    cheats: {},
    // Bram's logbook: earned stamp ids and the lifetime counters stamps read.
    stamps: [],
    counters: {},
    // Bram's one-line tips already shown.
    tipsSeen: [],
    // Expeditions: { [id]: { best, summits, bestTime, pages: [pitch indexes] } }
    expeditions: {},
    // Biome mastery: { [biomeId]: [star ids] } (see data/mastery.js).
    mastery: {},
    // Best height per set of dares: { [dareKey]: meters } (data/dares.js).
    dareBest: {},
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
    this.migrate();
    // Cosmetics you have not looked at yet show as NEW. Older saves start with
    // everything they already own marked as seen.
    if (!Array.isArray(this.data.seen)) this.data.seen = [...this.data.unlocked];
    // Items added in an update may already be earned.
    this.checkUnlocks();
  }

  isNew(id) { return this.isUnlocked(id) && !this.data.seen.includes(id); }
  markSeen(id) { if (this.isNew(id)) { this.data.seen.push(id); this.save(); } }

  load() {
    const base = freshData();
    try {
      const raw = this.storage.getItem(KEY);
      if (!raw) return base;
      const parsed = JSON.parse(raw);
      // Items without a requirement (including ones added in later versions) are always owned.
      const unlocked = [...new Set([...(parsed.unlocked || []), ...base.unlocked])];
      return { ...base, ...parsed, unlocked, bestByMode: { ...base.bestByMode, ...parsed.bestByMode }, look: { ...base.look, ...parsed.look }, settings: { ...base.settings, ...parsed.settings }, gemsFound: { ...parsed.gemsFound }, inventory: { ...parsed.inventory }, counters: { ...parsed.counters }, expeditions: { ...parsed.expeditions }, mastery: { ...parsed.mastery }, dareBest: { ...parsed.dareBest }, tickets: { ...parsed.tickets } };
    } catch {
      return base;
    }
  }

  // Saves from before the mountain map: the old Stone and Frozen tickets were
  // gear in the pack; the mastery star for perfects is now a streak star.
  migrate() {
    const d = this.data;
    for (const [old, id] of [['lift-stone', 'stone'], ['lift-frozen', 'frozen']]) {
      if (d.inventory[old]) d.tickets[id] = (d.tickets[id] || 0) + d.inventory[old];
      if (d.packed.includes(old) && !d.lift) d.lift = id;
      delete d.inventory[old];
    }
    d.packed = d.packed.filter((id) => GEAR_BY_ID[id]);
    for (const list of Object.values(d.mastery)) {
      const i = list.indexOf('perfects');
      if (i >= 0) list.splice(i, 1, ...(list.includes('streak') ? [] : ['streak']));
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
        || (r.streak && d.bestStreak >= r.streak)
        || (r.mastery && this.stars(r.mastery).length >= STARS.length);
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

  // Dared runs keep their own records, one per set of dares (and mode), so
  // they never touch the mode records or the leaderboard.
  recordDareHeight(h, key) {
    const v = Math.floor(h * 10) / 10;
    if (v <= (this.data.dareBest[key] || 0)) return { newBest: false, unlocks: [] };
    this.data.dareBest[key] = v;
    this.save();
    return { newBest: true, unlocks: [] };
  }

  dareBestFor(key) { return this.data.dareBest[key] || 0; }

  // ---------- biome mastery ----------
  stars(biomeId) { return (this.data.mastery && this.data.mastery[biomeId]) || []; }
  // Returns { isNew, unlocks }: unlocks are cosmetics freed by a full set.
  earnStar(biomeId, star) {
    const m = this.data.mastery || (this.data.mastery = {});
    const list = m[biomeId] || (m[biomeId] = []);
    if (list.includes(star)) return { isNew: false, unlocks: [] };
    list.push(star);
    const unlocks = this.checkUnlocks();
    this.save();
    return { isNew: true, unlocks };
  }

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

  // The debug overlay and the autopilot are hidden behind a code that only
  // the developer knows. Kept apart from the cheats on purpose: those runs
  // still count for records and the leaderboard (they are for testing).
  get debugUnlocked() { return !!this.data.debugUnlocked; }

  // Cheat codes (settings > ENTER CODE). Entering a code again switches it off.
  redeemCode(raw) {
    const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cheats = this.data.cheats || (this.data.cheats = {});
    // Stored as a hash, so the code cannot be read from the published source.
    if (codeHash(code) === DEBUG_CODE_HASH) {
      this.data.debugUnlocked = !this.data.debugUnlocked;
      if (!this.data.debugUnlocked) this.data.settings.debugOverlay = false;
      this.save();
      return { ok: true, message: this.data.debugUnlocked ? 'DEBUG TOOLS: ON (F3 OR ` IN A RUN, B: AUTOPILOT)' : 'DEBUG TOOLS: OFF' };
    }
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
    // Not a cheat (runs stay on the leaderboard): it only opens the collection.
    if (code === 'OPENBOOK') {
      this.data.journalAll = true;
      // Maarten's own save also gets his Normal record (1867 m) back. The online
      // board already has it, so it is marked as sent and nothing is uploaded.
      if (String(this.data.playerName || '').toUpperCase() === 'MAARTEN' && this.bestFor('normal') < 1867) {
        this.recordHeight(1867, 'normal');
        this.data.lbSynced = { ...this.data.lbSynced, normal: 1867 };
      }
      this.save();
      return { ok: true, message: 'THE WHOLE COLLECTION IS OPEN' };
    }
    // Every biome mastered at once: all three stars everywhere, so every
    // mastery reward unlocks. Stars are kept, so entering it again changes nothing.
    if (code === 'GRANDMASTER') {
      if (!this.data.mastery) this.data.mastery = {};
      for (const id of MASTERY_BIOMES) this.data.mastery[id] = [...STARS];
      const unlocks = this.checkUnlocks();
      this.save();
      return { ok: true, message: unlocks.length ? `ALL BIOMES MASTERED: ${unlocks.length} ITEMS UNLOCKED` : 'ALL BIOMES ARE ALREADY MASTERED' };
    }
    if (code === 'GOLDENCITY') {
      cheats.goldenCity = !cheats.goldenCity;
      this.save();
      return { ok: true, message: cheats.goldenCity ? 'GOLDEN CITY: EVERY NEW BIOME' : 'GOLDEN CITY: OFF' };
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
    if (r.season && r.season !== currentSeason()) return { state: 'locked', reason: describeRequirement(r), price: r.price };
    if (r.gem && this.found(r.gem) < r.count) {
      const g = GEMS[r.gem];
      return { state: 'locked', reason: `FIND ${r.count} ${g.name}${r.count > 1 ? 'S' : ''} (${this.found(r.gem)}/${r.count})`, price: r.price };
    }
    return { state: this.gems >= r.price ? 'buy' : 'poor', price: r.price };
  }

  buyCosmetic(slot, item) {
    if (this.cosmeticStatus(item).state !== 'buy' || !this.spend(item.requirement.price)) return false;
    this.data.unlocked.push(item.id);
    this.data.seen.push(item.id);
    this.data.look[slot] = item.id;
    this.save();
    return true;
  }

  owned(gearId) { return this.data.inventory[gearId] || 0; }

  // Why a gear item or perk with `needs` is not for sale yet, or null when it is.
  lockedReason(item) {
    const n = item && item.needs;
    if (!n) return null;
    if (n.best && this.bestFor('normal') < n.best) return `REACH ${n.best} M IN NORMAL (${Math.floor(this.bestFor('normal'))}/${n.best})`;
    if (n.gem && this.found(n.gem) < n.count) {
      const g = GEMS[n.gem];
      return `FIND ${n.count} ${g.name}${n.count > 1 ? 'S' : ''} (${this.found(n.gem)}/${n.count})`;
    }
    return null;
  }

  buyGear(id) {
    const g = GEAR_BY_ID[id];
    if (!g || this.lockedReason(g) || !this.spend(g.price)) return false;
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
    if (this.owned(id) < 1 || p.length >= PACK_SLOTS) return null;
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

  // ---------- lift tickets (data/lifts.js) ----------
  mastered(biomeId) { return this.stars(biomeId).length >= STARS.length; }
  tickets(id) { return this.data.tickets[id] || 0; }

  // What the map can do with a ticket: locked | buy | poor (with the price).
  liftStatus(id) {
    const l = LIFT_BY_ID[id];
    if (!l) return { state: 'locked' };
    if (!this.mastered(l.after)) return { state: 'locked', price: l.price, needs: l.after };
    return { state: this.gems >= l.price ? 'buy' : 'poor', price: l.price };
  }

  // A bought ticket is picked for the next run right away.
  buyLift(id) {
    if (this.liftStatus(id).state !== 'buy' || !this.spend(LIFT_BY_ID[id].price)) return false;
    this.data.tickets[id] = this.tickets(id) + 1;
    this.data.lift = id;
    this.save();
    return true;
  }

  // Picks the ticket for the next run (null: base camp). Needs one in hand.
  setLift(id) {
    if (id && this.tickets(id) < 1) return false;
    this.data.lift = id || null;
    this.save();
    return true;
  }

  // The picked ticket when a Normal run leaves base camp: spends it and
  // returns its biome id, or null. The pick stays while you have more.
  useLift() {
    const id = this.data.lift;
    if (!id || this.tickets(id) < 1) { this.data.lift = null; return null; }
    this.data.tickets[id]--;
    if (!this.data.tickets[id]) this.data.lift = null;
    this.save();
    return id;
  }

  hasPerk(id) { return this.data.perks.includes(id); }

  buyPerk(id) {
    const p = PERK_BY_ID[id];
    if (!p || this.hasPerk(id) || this.lockedReason(p) || !this.spend(p.price)) return false;
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

  // ---------- expeditions ----------
  expedition(id) {
    const e = this.data.expeditions;
    return e[id] || (e[id] = { best: 0, summits: 0, bestTime: null, pages: [] });
  }

  // Returns true when this is a new best height on that expedition.
  recordExpeditionHeight(id, h) {
    const e = this.expedition(id);
    if (h <= e.best) return false;
    e.best = Math.floor(h * 10) / 10;
    this.save();
    return true;
  }

  // Returns true if the page was new.
  findJournalPage(id, page) {
    const e = this.expedition(id);
    if (e.pages.includes(page)) return false;
    e.pages.push(page);
    this.save();
    return true;
  }

  // Returns { first, bestTime } for the summit summary.
  recordSummit(id, ms) {
    const e = this.expedition(id);
    const first = e.summits === 0;
    e.summits++;
    if (e.bestTime === null || ms < e.bestTime) e.bestTime = Math.round(ms);
    this.save();
    return { first, bestTime: e.bestTime };
  }

  // ---------- Bram's logbook ----------
  bump(counter, n = 1) {
    const c = this.data.counters;
    c[counter] = (c[counter] || 0) + n;
    this.save();
  }

  hasStamp(id) { return this.data.stamps.includes(id); }

  // Checks every unearned stamp against the save and the current run (or
  // null). Keeps the best run so far for per-run stamps. Earned stamps are
  // recorded and paid out; returns them.
  checkStamps(run = null) {
    const d = this.data;
    const c = d.counters;
    const ctx = { d, run, c };
    let changed = false;
    const earned = [];
    for (const s of STAMPS) {
      if (d.stamps.includes(s.id)) continue;
      const v = s.value(ctx);
      if (s.perRun && v > (c[`best:${s.id}`] || 0)) { c[`best:${s.id}`] = v; changed = true; }
      if (v >= s.goal) earned.push(s);
    }
    if (!earned.length) { if (changed) this.save(); return []; }
    for (const s of earned) {
      d.stamps.push(s.id);
      d.gems += s.gems;
      d.gemsEarned += s.gems;
    }
    this.save();
    return earned;
  }
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
