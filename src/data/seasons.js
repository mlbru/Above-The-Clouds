// Seasons on the real calendar: base camp dresses up for them and Bram sells
// a seasonal item. ?season=halloween (or sinterklaas, christmas, none)
// overrides the date. The first match wins, so Sinterklaas holds camp until
// the 5th of December and Christmas takes over after.
export const SEASONS = {
  halloween: { name: 'HALLOWEEN', greeting: 'HAPPY HALLOWEEN', from: [10, 15], to: [11, 3] },
  sinterklaas: { name: 'SINTERKLAAS', greeting: 'HAPPY SINTERKLAAS', from: [11, 8], to: [12, 5] },
  christmas: { name: 'CHRISTMAS', greeting: 'MERRY CHRISTMAS', from: [12, 1], to: [1, 6] },
};

// The season on a date (month 1-12), or null.
export function seasonOn(date) {
  const md = (date.getMonth() + 1) * 100 + date.getDate();
  for (const [id, s] of Object.entries(SEASONS)) {
    const a = s.from[0] * 100 + s.from[1], b = s.to[0] * 100 + s.to[1];
    if (a <= b ? md >= a && md <= b : md >= a || md <= b) return id;
  }
  return null;
}

export function currentSeason() {
  try {
    const v = new URLSearchParams(window.location.search).get('season');
    if (v !== null) return SEASONS[v] ? v : null;
  } catch { /* not in a browser */ }
  return seasonOn(new Date());
}
