import { LEADERBOARD } from '../config/leaderboardConfig.js';

export const NAME_MAX = 12;
const SUBMIT_DELAY_MS = 4000;

export const leaderboardEnabled = () => !!(LEADERBOARD.url && LEADERBOARD.key);

// Letters, digits, space and dash only (what the pixel font can draw).
export function cleanName(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9 -]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
}

function playerId(prog) {
  const d = prog.data;
  if (!d.playerId) {
    const c = globalThis.crypto;
    d.playerId = c && c.randomUUID ? c.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
        const r = Math.floor(Math.random() * 16);
        return (ch === 'x' ? r : (r & 3) | 8).toString(16);
      });
    prog.save();
  }
  return d.playerId;
}

const headers = (extra = {}) => ({ apikey: LEADERBOARD.key, Authorization: `Bearer ${LEADERBOARD.key}`, 'Content-Type': 'application/json', ...extra });

export const playerName = (prog) => cleanName(prog.data.playerName);

export function setPlayerName(prog, raw) {
  const name = cleanName(raw);
  if (!name) return false;
  prog.data.playerName = name;
  prog.save();
  // Climbs made before there was a name count too, and the name changes on old rows.
  prog.data.lbSynced = {};
  syncAll(prog);
  return true;
}

// Runs that used cheat codes stay off the board.
const eligible = (prog) => !Object.values(prog.data.cheats || {}).some(Boolean);

// Sends the best height of a mode when it is higher than what was sent before.
export async function submitBest(prog, mode, { keepalive = false } = {}) {
  const name = playerName(prog);
  const height = prog.bestFor(mode);
  const synced = prog.data.lbSynced || (prog.data.lbSynced = {});
  if (!leaderboardEnabled() || !name || !eligible(prog) || height <= 0 || synced[mode] === height) return false;
  try {
    const res = await fetch(`${LEADERBOARD.url}/rest/v1/scores?on_conflict=player_id,mode`, {
      method: 'POST',
      keepalive,
      headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({ player_id: playerId(prog), mode, name, height }),
    });
    if (!res.ok) return false;
    synced[mode] = height;
    prog.save();
    return true;
  } catch {
    return false;
  }
}

export function syncAll(prog, opts) {
  return Promise.all(['normal', 'hard', 'summit'].map((m) => submitBest(prog, m, opts)));
}

// Called on every new record: waits a moment so a streak of records is one request.
let timer = null;
export function queueSubmit(prog) {
  if (!leaderboardEnabled() || !playerName(prog)) return;
  clearTimeout(timer);
  timer = setTimeout(() => { timer = null; syncAll(prog); }, SUBMIT_DELAY_MS);
  if (typeof window !== 'undefined' && !queueSubmit.hooked) {
    queueSubmit.hooked = true;
    window.addEventListener('pagehide', () => { if (timer) { clearTimeout(timer); timer = null; syncAll(prog, { keepalive: true }); } });
  }
}

// The best climbers of a mode: [{ name, height, mine }]. Throws when offline.
export async function fetchTop(prog, mode, limit = 10) {
  const url = `${LEADERBOARD.url}/rest/v1/scores?select=player_id,name,height&mode=eq.${mode}&order=height.desc,updated_at.asc&limit=${limit}`;
  const res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`leaderboard ${res.status}`);
  const me = playerId(prog);
  return (await res.json()).map((r) => ({ name: r.name, height: r.height, mine: r.player_id === me }));
}
