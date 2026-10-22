// In-browser integration tests. Load the game with ?play&timer&harness&seed=N,
// then run `await window.__runHarness()` from the console.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const scene = () => window.__atc;

async function waitFor(fn, timeout = 8000, label = 'condition') {
  const t0 = performance.now();
  while (performance.now() - t0 < timeout) {
    if (fn()) return true;
    await sleep(16);
  }
  throw new Error(`timeout waiting for ${label}`);
}

// Presses each note at its ideal time plus `offsetFor(note)` using the scene clock.
async function playCombo(offsetFor = () => 0, dirFor = (n) => n.dir) {
  const s = scene();
  const combo = s.combo;
  const results = [];
  while (s.combo === combo && combo.index < combo.notes.length) {
    const note = combo.current;
    const target = note.time + offsetFor(note);
    await waitFor(() => s.combo !== combo || combo.current !== note || s.now() >= target, 6000, 'note time');
    if (s.combo !== combo || combo.current !== note) continue;
    s.comboInput(dirFor(note), target);
    results.push({ result: note.result, reason: note.reason, offset: Math.round(note.offset) });
  }
  // Hold notes keep the combo open until they finish.
  await waitFor(() => s.combo !== combo || combo.done, 6000, 'holds finished');
  return results;
}

async function toRouteSelect() {
  const s = scene();
  if (s.state === 'RESTING') s.restAction('continue');
  await waitFor(() => s.state === 'ROUTE_SELECT', 6000, 'ROUTE_SELECT');
}

function chooseType(type) {
  const s = scene();
  const i = s.routes.findIndex((r) => r.type === type);
  if (i < 0) return false;
  s.pickRoute(i, true);
  return true;
}

export async function runHarness() {
  const out = [];
  const check = (name, ok, info = '') => { out.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  let s = scene();

  // 1. Safe route, perfect inputs
  await toRouteSelect();
  let lvl = s.node.level;
  chooseType('safe');
  let r = await playCombo();
  await waitFor(() => s.state === 'ROUTE_SELECT' || s.state === 'RESTING', 6000, 'after safe');
  check('1 safe route completes', s.node.level > lvl && r.every((x) => x.result === 'perfect'), `level ${lvl} -> ${s.node.level}, ${r.map((x) => x.result).join(',')}`);

  // 2. Risky route (falls back to whatever the longest route is near a ledge)
  await toRouteSelect();
  lvl = s.node.level;
  const riskyAvail = chooseType('risky') || chooseType('normal') || chooseType('safe');
  const routeType = s.route.type;
  r = await playCombo(() => 30);
  await waitFor(() => s.state === 'ROUTE_SELECT' || s.state === 'RESTING', 6000, 'after risky');
  check('2 risky route completes', riskyAvail && s.node.level > lvl, `${routeType} ${r.length} inputs, level ${lvl} -> ${s.node.level}`);

  // 3-6. Early, late, wrong-direction inputs and their effect on grip & pose
  await toRouteSelect();
  s.grip.set(100);
  chooseType('normal') || chooseType('safe');
  const gripBefore = s.grip.value;
  const combo = s.combo;
  const poses = [];
  const origHold = s.climber.hold.bind(s.climber);
  s.climber.hold = (name, ms) => { poses.push(name); return origHold(name, ms); };
  r = await playCombo((n) => (n.index === 0 ? -(combo.goodMs + 80) : n.index === 1 ? 0 : 0), (n) => (n.index === 2 ? (n.dir === 'L' ? 'R' : 'L') : n.dir));
  // note 1 is left unpressed in a second pass below; here: early, perfect, wrong
  s.climber.hold = origHold;
  check('3 early input -> MISS(early)', combo.notes[0].result === 'miss' && combo.notes[0].reason === 'early', JSON.stringify(r[0]));
  const wrongNote = combo.notes[2];
  check('5 wrong direction -> MISS(wrong)', wrongNote.result === 'miss' && wrongNote.reason === 'wrong', JSON.stringify(r[2]));
  check('6 misses cost extra grip and play a struggle pose', gripBefore - s.grip.value > s.route.gripCost && poses.some((p) => p === 'hesitate' || p === 'slip2'), `grip ${gripBefore.toFixed(1)} -> ${s.grip.value.toFixed(1)}, poses ${poses.join(',')}`);
  await waitFor(() => s.state === 'ROUTE_SELECT' || s.state === 'RESTING', 6000, 'after misses');

  // 4. Late input
  await toRouteSelect();
  chooseType('safe');
  const c4 = s.combo;
  await playCombo((n) => (n.index === 0 ? c4.goodMs + 60 : 0));
  check('4 late input -> MISS(late)', c4.notes[0].result === 'miss' && c4.notes[0].reason === 'late', `${c4.notes[0].result}/${c4.notes[0].reason}`);
  await waitFor(() => s.state === 'ROUTE_SELECT' || s.state === 'RESTING', 6000, 'after late');

  // 10. Pause during a combo freezes timing
  await toRouteSelect();
  chooseType('safe');
  const c10 = s.combo;
  const firstTime = c10.notes[0].time;
  s.pauseGame();
  await sleep(2500);
  const unjudged = c10.notes.every((n) => n.result === null);
  const clockFrozen = s.clock;
  await sleep(300);
  const stillFrozen = s.clock === clockFrozen;
  window.__game.scene.getScene('Pause').resume();
  await sleep(50);
  check('10 pause freezes combo timing', unjudged && stillFrozen && c10.notes[0].time > firstTime, `notes unjudged=${unjudged}, clock frozen=${stillFrozen}, first note shifted ${Math.round(c10.notes[0].time - firstTime)}ms`);
  await playCombo();
  await waitFor(() => s.state === 'ROUTE_SELECT' || s.state === 'RESTING', 6000, 'after pause combo');

  // 7-8. Low grip causes a slip; successful recovery returns to a valid hold
  await toRouteSelect();
  const climbedLevel = s.node.level;
  s.grip.set(1);
  chooseType('safe');
  await playCombo((n) => n.index === 0 ? s.combo.goodMs + 60 : 0);
  await waitFor(() => s.state === 'SLIPPING', 4000, 'SLIPPING');
  check('7 low grip triggers a slip', s.state === 'SLIPPING');
  const rec = s.recovery;
  await waitFor(() => s.now() >= rec.notes[0].time, 4000, 'recovery note');
  s.recoveryInput(rec.notes[0].dir, rec.notes[0].time + 10);
  await waitFor(() => s.state === 'ROUTE_SELECT' || s.state === 'RESTING', 4000, 'after recovery');
  const valid = s.mountain.getLevel(s.node.level).nodes.includes(s.node);
  check('8 recovery catches a valid lower hold', valid && s.node.level <= climbedLevel && s.grip.value > 0, `node ${s.node.id} (was level ${climbedLevel}), grip ${s.grip.value.toFixed(0)}`);

  // 9. Failed recovery -> back to checkpoint
  await toRouteSelect();
  const cp = s.checkpoint;
  s.grip.set(0.5);
  await waitFor(() => s.state === 'SLIPPING', 8000, 'SLIPPING from hang drain');
  const rec2 = s.recovery;
  const wrongDir = rec2.notes[0].dir === 'L' ? 'R' : 'L';
  await waitFor(() => s.now() >= rec2.notes[0].time, 4000, 'recovery note 2');
  s.recoveryInput(wrongDir, rec2.notes[0].time);
  await waitFor(() => s.state === 'RESTING', 8000, 'respawn RESTING');
  check('9 failed recovery returns to the checkpoint', s.node === cp && s.grip.value > 0, `checkpoint ${cp.id}, now at ${s.node.id}`);

  // 17. Holds are distinguishable: every interactive node has a chalked hold sprite
  let missingHold = 0, holds = 0;
  for (const seg of s.mountain.segments.values()) {
    if (!s.wall.visuals.has(seg.index)) continue;
    for (const lv of seg.levels) for (const n of lv.nodes) {
      if (n.kind === 'ledge') continue;
      holds++;
      if (!s.wall.getHold(n.id)) missingHold++;
    }
  }
  check('17 every reachable hold has a hold sprite', holds > 0 && missingHold === 0, `${holds} holds, ${missingHold} missing`);

  // 13-14. Long run: teleport up through ~1500 levels and watch memory
  const startTex = window.__game.textures.getTextureKeys().length;
  const startObjects = s.children.length;
  let maxSeg = 0, maxDrawn = 0, maxObjects = 0, maxTex = 0;
  for (let i = 0; i < 700; i++) {
    if (s.state === 'RESTING') s.restAction('continue');
    if (s.state !== 'ROUTE_SELECT') { await sleep(20); continue; }
    const route = s.routes[s.routes.length - 1];
    s.routeUI.hide();
    s.state = 'CLIMB_ANIMATION';
    s.climber.setPosition(route.target.x, route.target.y);
    s.arrive(route.target, route.heightGain);
    if (i % 10 === 0) await sleep(40);
    maxSeg = Math.max(maxSeg, s.mountain.segments.size);
    maxDrawn = Math.max(maxDrawn, s.wall.activeCount);
    maxObjects = Math.max(maxObjects, s.children.length);
    maxTex = Math.max(maxTex, window.__game.textures.getTextureKeys().length);
  }
  await sleep(500);
  check('13 old segments are removed', s.mountain.segments.size < 14 && s.wall.activeCount < 14, `alive data ${s.mountain.segments.size}, drawn ${s.wall.activeCount}, max ${maxSeg}/${maxDrawn}, reached ${Math.floor(s.node.level * 1.5)} m`);
  check('14 no unbounded growth on a long run', maxObjects < startObjects + 400 && maxTex < startTex + 40, `objects ${startObjects} -> max ${maxObjects}, textures ${startTex} -> max ${maxTex}`);

  // 15. Restart has no stale listeners
  const kb = window.__game.input.keyboard;
  const before = s.input.keyboard.listenerCount('keydown');
  const blurBefore = window.__game.events.listenerCount('blur');
  const seeds = [];
  for (let i = 0; i < 3; i++) {
    const run = s.runId;
    s.pauseGame();
    await sleep(100);
    window.__game.scene.getScene('Pause').restart();
    await waitFor(() => window.__atc && window.__atc.runId === run + 1 && window.__atc.state === 'RESTING', 8000, 'restart');
    s = scene();
    seeds.push(s.seed);
  }
  const after = s.input.keyboard.listenerCount('keydown');
  const ours = () => {
    const l = window.__game.events._events.blur;
    return (Array.isArray(l) ? l : l ? [l] : []).filter((x) => x.fn === window.__atc.onBlur || x.context === window.__atc).length;
  };
  const blurListeners = ours();
  check('15 restart leaves no stale listeners or state', after === before && blurListeners === 1 && s.node.level === 0 && s.combo === null, `keydown ${before} -> ${after}, scene blur listeners ${blurListeners}, node ${s.node.id}, grip ${s.grip.value}, kb ${!!kb}`);

  // 16. The base camp trader opens over the climb and hands control back
  const traderHere = s.atTrader();
  s.restAction('trader');
  await waitFor(() => window.__game.scene.isActive('Shop'), 4000, 'trader open');
  const climbPaused = s.sys.isPaused();
  window.__game.scene.getScene('Shop').close();
  await waitFor(() => s.sys.isActive() && !s.paused, 4000, 'trader closed');
  check('16 trader opens at base camp and closes back to the climb', traderHere && climbPaused && s.state === 'RESTING', `at trader ${traderHere}, climb paused while open ${climbPaused}, state ${s.state}`);

  // 18. A gem on a route target is collected on arrival
  s.restAction('continue');
  await waitFor(() => s.state === 'ROUTE_SELECT', 6000, 'route select for gem');
  const gr = s.routes[0];
  gr.gem = { type: 'emerald', key: 'harness' };
  s.pendingGem = { route: gr, img: null };
  const wallet = s.prog.data.gems; // the real wallet, also when a gem code is active
  const expected = Math.round(1 * s.gemScale * (s.gear.charm > 0 ? 2 : 1));
  s.routeUI.hide();
  s.state = 'CLIMB_ANIMATION';
  s.arrive(gr.target, gr.heightGain);
  check('18 gems are collected into the wallet', s.mountain.takenGems.has('harness') && s.prog.data.gems - wallet >= expected && s.run.gems >= expected, `wallet ${wallet} -> ${s.prog.data.gems}, expected +${expected}`);

  // 11. Resize keeps the 480x270 game and camera intact
  const canvas = window.__game.canvas;
  const W0 = window.__game.scale.width, H0 = window.__game.scale.height;
  window.dispatchEvent(new Event('resize'));
  await sleep(200);
  check('11 resize keeps internal resolution', window.__game.scale.width === W0 && window.__game.scale.height === H0 && canvas.width === W0, `canvas ${canvas.width}x${canvas.height}, css ${canvas.style.width} x ${canvas.style.height}`);

  return out.join('\n');
}

window.__runHarness = runHarness;
