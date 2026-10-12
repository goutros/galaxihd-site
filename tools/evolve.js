// tools/evolve.js (loaded by sim.html after train.js): evolves Galaxi's attack scripts in boss.js against the REAL fight engine, the same
// evolutionary search tools/train-attacks.js runs on Ray of Death's model. Each attack plays from a script above GALAXI_BOSS:
//   kablooey KAB, sonic SONIC, theworld TW, pokeball PB, lorem LOREM, mario MARIO
// A candidate is scored by playing the real attack with train.js's player bots, made human: R ms before a bot notices a new bullet
// (on the lane / platform / path attacks, whose bots don't do that themselves, they're shown the fight minus anything younger). Bots:
//   pro      150ms, long look-ahead: the guard (hits past what it took on the hand-made script are punished hard; it's a heuristic,
//            so the real gate is train.oracle, the exact-replay planner: the winner must clear it hitless)
//   super    260ms: a really good player          good   320ms, a slip now and then          casual  450ms, slips more
// Score: 2 x super hits (up to 3) + 1.5 x good hits (up to 4) + 0.4 x casual hits (up to 6), minus 15 a pro hit past the hand-made
// script's, minus 1 a super hit past 4 (no fun), minus 1.5 a second past 1.15x the hand-made length. "Sans level": a good player gets tagged 2-4 times, a really good one 1-3, and it can be done hitless.
//   python3 tools/job.py "train.evolve('kablooey', { gens: 25 })" tools/attack-ai-kablooey.json      then  node tools/write-script.js kablooey
(() => {
const FRAME = 1000 / 60, clone = x => JSON.parse(JSON.stringify(x));
const seeded = s => () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const RANDOM = Math.random;
let R = seeded(Date.now() % 1e9); // the evolver's own dice (Math.random is reseeded for every scored run)
const pick = l => l[Math.floor(R() * l.length)], num = (a, b, s = 10) => a + s * Math.floor(R() * ((b - a) / s + 1)), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const nudge = (v, [lo, hi, st]) => +clamp(v + st * pick([-2, -1, 1, 2]), lo, hi).toFixed(3);

// ---- each attack's genome: the live script object, its random pieces and how to mutate one ----
// list(s): the evolvable list inside the script; item(): a fresh random entry; fields: numeric ranges [lo, hi, step] it nudges;
// top: the script's own numeric knobs
const RAY_KINDS = {
  aimed: () => ({ kind: "aimed", n: pick([1, 1, 2, 3]) }), fan: () => ({ kind: "fan", n: pick([2, 3, 4]), spread: pick([.15, .2, .25, .35]) }),
  across: () => ({ kind: "across", off: pick([0, 0, -30, 30, -50, 50]), side: pick([-1, 1, 0]) }), down: () => ({ kind: "down", off: pick([0, 0, -30, 30, -50, 50]), side: pick([-1, 1, 0]) }),
  cross: () => ({ kind: "cross", off: pick([0, -20, 20]) }), cage: () => ({ kind: "cage", gap: pick([28, 32, 36, 40, 48]) }),
  sweep: () => ({ kind: "sweep", n: pick([2, 3, 4]), step: pick([30, 40, 50]), every: num(150, 450), axis: pick(["across", "down"]), side: pick([-1, 1, 0]) }), big: () => ({ kind: "big" }),
  spiral: () => ({ kind: "spiral", n: pick([4, 6, 8, 8, 10]), gap: num(150, 350) }), bomb: () => ({ kind: "bomb", n: pick([1, 2, 3, 4]), every: num(500, 1200, 50), speed: pick([2.5, 3, 3.5, 4]) }) };
const GENES = {
  blasters: { script: () => RAY, list: s => s.moves }, // scoring only (Ray of Death is designed by hand now)
  comments: { script: () => COMMENTS, list: s => s.cols }, // scoring only
  kablooey: { script: () => KAB, list: s => s.moves, min: 3, max: 14, top: { END: [1200, 3000, 200] },
    item: () => ({ dt: num(300, 3500, 50), charge: num(300, 900), width: pick([22, 26, 26, 30, 36, 44]), ...RAY_KINDS[pick(Object.keys(RAY_KINDS))]() }),
    fields: { dt: [150, 4000, 100], charge: [300, 900, 40], width: [22, 44, 4] }, regen: m => RAY_KINDS[m.kind] && RAY_KINDS[m.kind]() },
  sonic: { script: () => SONIC, list: s => s.waves, min: 8, max: 26, notice: true,
    item: () => ({ dt: num(300, 900, 50), ...(R() < .7 ? { lane: pick(["you", "other"]) } : {}), ...(R() < .4 ? { kind: pick([0, 1, 2, 3]) } : {}), ...(R() < .5 ? { fast: pick([1, 2, 3, 4]) } : {}) }),
    fields: { dt: [250, 1200, 50], fast: [0, 6, .5] }, regen: () => ({ lane: pick(["you", "other", undefined]), kind: pick([0, 1, 2, 3, undefined]), fast: pick([0, 1, 2, 3, 4]) }) },
  pokeball: { script: () => PB, list: s => s.throws, min: 4, max: 14,
    top: { stray: [1500, 5000, 250], first: [800, 3000, 200], thunder: [1400, 3600, 200], warn: [400, 900, 50], beat: [450, 1300, 50], bolt: [2, 5, .25] },
    item: () => ({ dt: num(500, 1900, 50), ...pick([{ ms: 950, lead: 0 }, { ms: 700, lead: .5 }, { ms: 550, lead: 1 }]) }),
    fields: { dt: [450, 2200, 50], ms: [450, 1000, 50], lead: [0, 1, .25] } },
  theworld: { script: () => TW, list: s => s.loops, min: 2, max: 3,
    item: () => ({ slots: pick([10, 12, 14, 16]), r: num(48, 90, 4), acc: pick([.1, .12, .15, .18]), vmax: pick([5, 6, 7, 8]), volleys: Array.from({ length: pick([2, 3, 4]) }, (_, i) => ({ dt: i ? num(350, 800, 50) : 0, n: pick([3, 3, 4, 5]), spread: pick([.2, .28, .35]), speed: pick([3.5, 4, 4.5, 5]) })) }),
    fields: { slots: [8, 18, 1], r: [44, 96, 4], acc: [.08, .25, .02], vmax: [4, 9, .5] },
    deep: L => { const v = L.volleys; if (R() < .2 && v.length < 6) v.push({ dt: num(350, 800, 50), n: 3, spread: .28, speed: 4 }); else if (R() < .2 && v.length > 1) v.pop();
      else { const x = pick(v); const k = pick(["dt", "n", "spread", "speed"]), F = { dt: [250, 1000, 50], n: [1, 7, 1], spread: [.12, .45, .04], speed: [3, 6.5, .25] }; x[k] = nudge(x[k], F[k]); } } },
  lorem: { script: () => LOREM, notice: true, top: { rise: [.6, 1.6, .05], talk: [7000, 12000, 500], overlap: [12, 40, 2], shift: [20, 110, 6], minW: [24, 70, 4] } },
  mario: { script: () => MARIO, list: s => s.waves, min: 3, max: 7, notice: true, bot: p => marioBot(p.R, p.N), top: { charge: [700, 1800, 100], fire: [700, 1600, 100] },
    item: () => ({ dt: num(2400, 4600, 100), ...(R() < .7 ? { low: R() < .5 } : {}) }), fields: { dt: [2000, 5000, 100] }, regen: () => ({ low: pick([true, false, undefined]) }) },
};

function mutate(attack, s) {
  const G = GENES[attack]; s = clone(s); const L = G.list && G.list(s);
  if (G.top && (!L || R() < .3)) { const k = pick(Object.keys(G.top)); s[k] = nudge(s[k], G.top[k]); return s; }
  const i = Math.floor(R() * L.length), m = L[i], k = R();
  if (G.deep && k < .4) G.deep(m);
  else if (k < .45) { const f = pick(Object.keys(G.fields).filter(f => f in m)); if (f) m[f] = nudge(m[f], G.fields[f]); }
  else if (k < .6 && G.regen) { const f = G.regen(m) || {}, key = pick(Object.keys(f).filter(x => !(x === "kind" && typeof f[x] === "string"))); if (key) { if (f[key] === undefined) delete m[key]; else m[key] = f[key]; } }
  else if (k < .72) L[i] = "dt" in m ? { ...G.item(), dt: m.dt } : G.item();
  else if (k < .82 && L.length < G.max) L.splice(i, 0, G.item());
  else if (k < .92 && L.length > G.min) L.splice(i, 1);
  else { const j = Math.floor(R() * L.length); [L[i], L[j]] = [L[j], L[i]]; }
  return s;
}
const cross = (attack, a, b) => { const G = GENES[attack]; if (!G.list) { const s = clone(a); for (const k in G.top) if (R() < .5) s[k] = b[k]; return s; }
  const s = clone(a), A = G.list(s), B = G.list(clone(b)), cut = 1 + Math.floor(R() * Math.max(1, A.length - 1)), cut2 = 1 + Math.floor(R() * Math.max(1, B.length - 1));
  A.splice(cut, A.length, ...B.slice(cut2)); A.length = Math.min(A.length, G.max); if (A.length < G.min) return clone(a); if (G.top) for (const k in G.top) if (R() < .5) s[k] = b[k]; return s; };

// ---- Mario's player: train.js's mario() never climbs, so a bottom-half avalanche always hits it. This one plans: every 6 frames it
// simulates the platformer heart (battle.js's marioFrame + blueMove, on the level grid) for 60 frames under 72 two-move plans and plays
// the first 6 frames of the best. Bad: being inside an avalanche's half once its stars fire (it knows the rhythm: MARIO.charge after the
// flash, which it notices R ms late), falling in a pit, the star wall.
const PLAT = { speed: 2.4, accel: .5, stop: .6, airAccel: .4, jump: 6.6, gUp: .3, gDown: .5, cut: .45, maxFall: 7, coyote: 6, buffer: 8 }, MOVES = [["ArrowRight"], ["ArrowRight", "ArrowUp"], [], ["ArrowUp"], ["ArrowLeft"], ["ArrowLeft", "ArrowUp"]];
function marioBot(R = 0, N = 0) { // N: slips a second (a wrong move held 150ms), like train.js's player
  let plan = [], at = -99, slip = 0, slipKeys = []; const lit = new WeakMap();
  return (E, attack, t) => {
    if (N && (slip -= FRAME) > 0) return slipKeys;
    if (N && Math.random() < N * FRAME / 1000) { slip = 150; slipKeys = MOVES[Math.floor(Math.random() * MOVES.length)]; return slipKeys; }
    const m = E.foe.flags.mario, f0 = Math.round(t / FRAME); if (!m || typeof m !== "object") return ["ArrowRight"];
    if (f0 - at < 6 && plan.length) return plan[f0 - at];
    const B = E.box, W = B.w, L = 320 - W / 2, T = 384 - B.h, g = m.grid, s = E.soul, solid = (c, r) => "XSQ?U<>[]".includes((g[r] || [])[c] || "-");
    const waves = E.bullets.filter(b => b.fixed && Math.abs(b.w - W) < 2 && b.h > 40 && !b.damage && !b.image && !b.dead).map(b => { if (!lit.has(b)) lit.set(b, t - R);
      return [b.y - b.h / 2 - T, b.y + b.h / 2 - T, (lit.get(b) + MARIO.charge - 150 - t) / FRAME]; }); // its half, and the frame (from now) its stars fire
    const hitTile = (x, y) => { for (let c = Math.floor((x - 14) / 16); c <= Math.floor((x + 14) / 16); c++) for (let r = Math.floor((y - 14) / 16); r <= Math.floor((y + 14) / 16); r++)
      if (solid(c, r) && Math.abs(x - c * 16 - 8) < 14 && Math.abs(y - r * 16 - 8) < 14) return [c * 16 + 8, r * 16 + 8]; return null; };
    const sim = (a, k) => { let x = s.x - L + m.off, y = s.y - T, vx = s.vx || 0, vy = s.vy || 0, gr = s.grounded, held = s.held, buf = s.buffer || 0, coy = s.coyote || 0, bad = 0;
      for (let f = 0; f < 60; f++) { const keys = MOVES[f < k ? a[0] : a[1]], jump = keys.includes("ArrowUp"), dir = keys.includes("ArrowRight") ? 1 : keys.includes("ArrowLeft") ? -1 : 0;
        if (dir || gr) { const acc = !gr ? PLAT.airAccel : dir ? PLAT.accel : PLAT.stop; vx += Math.max(-acc, Math.min(acc, dir * PLAT.speed - vx)); }
        buf = jump && !held ? PLAT.buffer : buf - 1; coy = gr ? PLAT.coyote : coy - 1;
        if (buf > 0 && coy > 0) { vy = -PLAT.jump; gr = false; buf = coy = 0; }
        if (!jump && held && vy < 0) vy *= PLAT.cut; held = jump; vy = Math.min(PLAT.maxFall, vy + (vy < 0 ? PLAT.gUp : PLAT.gDown));
        const off = m.off + 1.5 * (f + 1), want = Math.max(off + 6, Math.min(off + W - 6, x + vx)); let nx = want, h = hitTile(nx, y);
        if (h) nx = nx > h[0] ? h[0] + 14 : h[0] - 14; if (nx !== x + vx) vx = 0; x = nx; gr = false; let ny = y + vy; h = hitTile(x, ny);
        if (h) { if (vy > 0) { ny = h[1] - 14; gr = true; } else ny = h[1] + 14; vy = 0; } y = Math.max(6, ny);
        if (y > B.h + 10) return 1e4 - f; // a pit
        const w = (f + 1) / 60; for (const [y0, y1, fire] of waves) if (f >= fire && y >= y0 && y < y1) bad += 20 * (1.5 - w); // inside a half its stars are crossing (sooner is worse)
        if (x - off < 44) bad += 8; } // the star wall
      return bad + Math.abs(x - m.off - 1.5 * 60 - W * .5) * .02; };
    let best = null, bs = Infinity;
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) for (const k of [6, 18, 36]) { const v = sim([i, j], k) + (i === j ? 0 : .01); if (v < bs) { bs = v; best = [i, j, k]; } }
    at = f0; plan = Array.from({ length: 6 }, (_, f) => MOVES[f < best[2] ? best[0] : best[1]]); return plan[0];
  };
}

// ---- scoring on the real engine ----
const BOTS = { pro: { R: 150, H: 60, M: 6, C: .001 }, super: { R: 260, H: 42, M: 6 }, good: { R: 320, H: 30, M: 4, N: .2 }, casual: { R: 450, H: 24, M: 4, N: .5 } };
// the fight as a bot with R ms reaction sees it: everything but the bullets that appeared less than R ms ago
const noticing = (keys, R) => { const born = new WeakMap(), seen = t => b => { if (!born.has(b)) born.set(b, t); return t - born.get(b) >= R; };
  return (E, a, t) => keys(Object.create(E, { bullets: { get: () => E.bullets.filter(seen(t)) } }), a, t); };
const turnOf = attack => GALAXI_BOSS.turns.findIndex(t => t.attack === attack);
async function play(attack, script, p, seed) { // one run with player profile p: the hits it cost (seeded, so every candidate meets the same dice)
  const live = GENES[attack].script(), keep = clone(live); script = clone(script); // (script may be the live object itself)
  for (const k of Object.keys(live)) delete live[k]; Object.assign(live, script);
  Math.random = seeded(seed); DECKS.clear(); botKeys.mash = false;
  try { const r = await train.turn(turnOf(attack), GENES[attack].notice ? noticing(GENES[attack].bot ? GENES[attack].bot(p) : train.player({ ...p, R: 0 }), p.R) : train.player(p)); return { hits: r.hits.length, sec: r.dodgeSec }; }
  finally { Math.random = RANDOM; for (const k of Object.keys(live)) delete live[k]; Object.assign(live, keep); }
}
async function score(attack, script, seeds, base) {
  const v = { pro: 0, super: 0, good: 0, casual: 0, sec: 0 };
  for (const s of seeds) for (const b in BOTS) { const r = await play(attack, script, BOTS[b], s); v[b] += r.hits / seeds.length; v.sec = Math.max(v.sec, r.sec); }
  const b = base || v; v.fit = 2 * Math.min(v.super, 3) + 1.5 * Math.min(v.good, 4) + .4 * Math.min(v.casual, 6) - 15 * Math.max(0, v.pro - b.pro - .25) - Math.max(0, v.super - 4) - 1.5 * Math.max(0, v.sec - b.sec * 1.15);
  for (const k in v) v[k] = +v[k].toFixed(2); return v;
}
// the proof, per seed: a hitless run that actually happened. First the pro bot with no reaction delay (cheap, and the only player that
// handles Sonic's lane taps: train.oracle can't), then train.oracle (the exact-replay planner), then a finer, further oracle search
async function proven(attack, script, seeds = [1, 2, 3]) {
  const live = GENES[attack].script(), keep = clone(live), out = []; script = clone(script);
  for (const k of Object.keys(live)) delete live[k]; Object.assign(live, clone(script));
  try { for (const seed of seeds) { let h = (await play(attack, script, { ...BOTS.pro, R: 0 }, seed)).hits;
      if (h) h = (await train.oracle(turnOf(attack), { seed })).hits; if (h) h = (await train.oracle(turnOf(attack), { seed, step: 4, H: 72 })).hits; out.push(h); if (h) break; } }
  finally { for (const k of Object.keys(live)) delete live[k]; Object.assign(live, keep); }
  return out;
}

async function evolve(attack, { gens = 25, pop = 24, seeds = 4, finalists = 5, prove = true } = {}) {
  const say = m => train.progress && train.progress(`${attack}: ${m}`), t0 = performance.now();
  await train.turn(turnOf(attack), train.player()); // warm-up (fonts, images)
  const hand = clone(GENES[attack].script()), handSc = await score(attack, hand, [500, 501, 502, 503, 504, 505]), base = handSc;
  say(`hand-made: ${JSON.stringify(handSc)}`);
  let popl = [hand, ...Array.from({ length: pop - 1 }, (_, i) => { let s = hand; for (let k = 0; k <= i % 4; k++) s = mutate(attack, s); return s; })];
  const history = [];
  for (let g = 0; g < gens; g++) {
    const sd = Array.from({ length: seeds }, (_, i) => 1000 + (g % 5) * seeds + i), sc = [];
    for (const s of popl) sc.push(await score(attack, s, sd, base));
    const ranked = popl.map((s, i) => ({ s, ...sc[i] })).sort((a, b) => b.fit - a.fit), best = ranked[0];
    history.push({ gen: g, ...best, s: undefined }); say(`gen ${g}: ${JSON.stringify({ ...best, s: undefined })} (${Math.round((performance.now() - t0) / 1000)}s)`);
    const elite = ranked.slice(0, 3).map(x => x.s), tour = () => { const a = pick(ranked), b = pick(ranked); return (a.fit > b.fit ? a : b).s; };
    popl = [...elite, ...Array.from({ length: pop - 3 }, () => R() < .5 ? mutate(attack, cross(attack, tour(), tour())) : mutate(attack, tour()))];
  }
  // finalists on unseen dice, best first; the first the oracle clears hitless wins (the hand-made script if none does)
  const fresh = Array.from({ length: 10 }, (_, i) => 900000 + i), fin = [];
  for (const s of popl.slice(0, finalists)) fin.push({ s, ...(await score(attack, s, fresh, base)) });
  fin.sort((a, b) => b.fit - a.fit);
  let win = null; const proofs = [];
  for (const f of fin) { if (f.pro > handSc.pro + .5) continue; const p = prove ? await proven(attack, f.s) : []; proofs.push({ fit: f.fit, oracle: p }); say(`oracle on finalist (fit ${f.fit}): ${p}`); if (p.every(h => !h)) { win = f; break; } }
  Math.random = RANDOM;
  return { attack, trained: new Date().toISOString(), sec: Math.round((performance.now() - t0) / 1000), bots: BOTS, hand: { ...handSc, script: hand },
    learned: win ? { ...win, s: undefined, script: win.s } : null, proofs, history };
}

Object.assign(window.train, { evolve, score: (a, s, seeds = [1, 2, 3, 4]) => score(a, s || clone(GENES[a].script()), seeds), proven, GENES });
})();
