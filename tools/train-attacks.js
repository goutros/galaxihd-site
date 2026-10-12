#!/usr/bin/env node
/* tools/train-attacks.js: trains Galaxi's attacks the way games tune enemy AI (an evolutionary search against simulated players, no
   generative AI), on every CPU core. Same idea as tools/train-inventory.js, for the attacks in boss.js.

     node tools/train-attacks.js blasters [--gens 60] [--pop 60] [--sims 16] [--write]

   blasters (Ray of Death): the script is 5-14 moves (see rayMoves in boss.js: aimed, fan, across, down, cross, cage, sweep, big), each with
   its own timing, charge (the warning) and lane width. The danger model is starBlaster's own numbers (STAR_BLASTER in boss.js): a lane is
   deadly at a spot from when the first stars can reach it to when the last ones pass, only while the heart's middle is in the lane; the
   heart moves 2px a frame on each axis inside the box; a hit gives 1s of i-frames (battle.js). Four hearts dodge, each only knowing about a
   blaster once it's been on screen for its reaction time:
     oracle   200ms reaction, plans a path round every lane it knows of (checks the whole route): MUST stay hitless
     super    260ms, same planner: a really good player, the one he's trying to beat
     good     320ms, picks the nearest spot that's safe now and when it gets there (doesn't check the route)
     casual   450ms, same as good
   Score: 2 x super hits (up to 3) + good hits (up to 3) + 0.4 x casual hits (up to 5), minus a huge penalty for any oracle hit, for running
   past 9.5s and for more than 18 blasters. Saves tools/attack-ai-<attack>.json; --write puts the script into boss.js (RAY). */
const fs = require("fs"), vm = require("vm"), path = require("path"), os = require("os");
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const BOSS = path.join(__dirname, "../assets/egg/boss.js");
const ctx = { document: { createElement: () => ({ getContext: () => ({}) }) }, Image: function () {}, Audio: function () {}, console }; ctx.window = ctx;
vm.runInNewContext(fs.readFileSync(BOSS, "utf8") + "\n;this.__ = { rayMoves, RAY, STAR_BLASTER };", ctx);
const { rayMoves, RAY, STAR_BLASTER: SB } = ctx.__, TURN = ctx.GALAXI_BOSS.turns.find(t => t.attack === "blasters");
const rng = s => () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const FRAME = 1000 / 60, STEP = 2, IFRAMES = 1000, MARGIN = 12; // heart px a frame per axis; star half-size + the hitbox margin
const BOX = (() => { const [w, h] = TURN.box; return { left: 320 - w / 2, right: 320 + w / 2, top: 384 - h, bottom: 384, width: w, height: h }; })();
const IN = { l: BOX.left + 8, r: BOX.right - 8, t: BOX.top + 8, b: BOX.bottom - 8 }; // where the heart's middle can go
const BOTS = { oracle: { react: 200, plan: true }, super: { react: 260, plan: true }, good: { react: 320 }, casual: { react: 450 } };

// a blaster fired at time t0 -> its lane: origin, direction, half width, and when stars cover each point along it
const lane = (b, t0) => { const dx = Math.cos(b.ang), dy = Math.sin(b.ang), fire = t0 + SB.in + b.charge;
  return { x: b.x, y: b.y, dx, dy, hw: b.width / 2, seen: t0, from: A => fire + (A - SB.back - MARGIN) / (SB.vmax / FRAME), to: A => fire + SB.stream + (A + MARGIN) / (SB.vmin / FRAME) }; };
const hot = (L, x, y, t, pad = 0, padT = 0) => { const ox = x - L.x, oy = y - L.y, A = ox * L.dx + oy * L.dy; return A > -pad && Math.abs(ox * -L.dy + oy * L.dx) <= L.hw + pad && t >= L.from(A) - padT && t <= L.to(A) + padT; };
const hotAny = (lanes, x, y, t, pad, padT) => { for (const L of lanes) if (hot(L, x, y, t, pad, padT)) return true; return false; };
const PAD = 6, PADT = 60; // the bots plan with a safety buffer (the hit test itself is exact)

// the planner (oracle, super): a time-expanded search on an 8px grid, 4 frames a step (the heart covers 8px per axis in that time),
// 12 steps (~0.8s) ahead: every cell it can be in at each step without touching a known lane; it heads for the reachable cell that's
// safe longest (then nearest the middle) and takes the first step of the way there
const G = 8, GX = Math.floor((IN.r - IN.l) / G) + 1, GY = Math.floor((IN.b - IN.t) / G) + 1, NC = GX * GY, HZ = 12, DT = 4 * FRAME;
const cx = i => IN.l + (i % GX) * G, cy = i => IN.t + Math.floor(i / GX) * G;
function search(known, hx, hy, now) {
  const start = Math.max(0, Math.min(GX - 1, Math.round((hx - IN.l) / G))) + GX * Math.max(0, Math.min(GY - 1, Math.round((hy - IN.t) / G)));
  let cur = new Int16Array(NC).fill(-1); cur[start] = start; // cur[c] = the first step that got there (-1: unreachable)
  let lastOk = cur, depth = 0;
  const bad = new Int8Array(NC); // per step: 0 unknown, 1 safe, 2 hot (each cell checked once)
  for (let k = 1; k <= HZ; k++) { const nxt = new Int16Array(NC).fill(-1), t = now + k * DT; let any = false; bad.fill(0);
    for (let c = 0; c < NC; c++) { if (cur[c] < 0) continue; const x = c % GX, y = Math.floor(c / GX);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= GX || ny >= GY) continue; const n = nx + ny * GX;
        if (nxt[n] >= 0) continue; if (!bad[n]) bad[n] = hotAny(known, cx(n), cy(n), t, PAD, PADT) ? 2 : 1; if (bad[n] === 2) continue;
        nxt[n] = k === 1 ? n : cur[c]; any = true; } }
    if (!any) break; cur = nxt; lastOk = nxt; depth = k; }
  let best = -1, bs = 1e9; // among the cells still alive at the deepest step: safe longest after, then nearest the middle
  for (let c = 0; c < NC; c++) { if (lastOk[c] < 0) continue; let v = Math.hypot(cx(c) - 320, cy(c) - (IN.t + IN.b) / 2) * .02;
    for (let s = DT; s <= 600; s += 100) if (hotAny(known, cx(c), cy(c), now + depth * DT + s, PAD, PADT)) { v += 50; break; }
    if (v < bs) { bs = v; best = c; } }
  if (best < 0 || depth === 0) return [hx, hy];
  const first = lastOk[best]; return [cx(first), cy(first)];
}
// one script against one heart: hits (and how long it ran)
function run(moves, bot, seed) {
  const r = rng(seed), lanes = [], pend = []; let t = 0;
  for (const m of moves) { t += m.dt; pend.push({ t, m }); }
  const end = t + RAY.END; let hx = 320, hy = (IN.t + IN.b) / 2, inv = -1e9, hits = 0, target = null, k = 0;
  const cands = []; for (let x = IN.l; x <= IN.r; x += 14) for (let y = IN.t; y <= IN.b; y += 14) cands.push([x, y]);
  for (let now = 0; now < end; now += FRAME) {
    while (pend.length && pend[0].t <= now) { const { t: mt, m } = pend.shift(); for (const b of rayMoves(m, BOX, { x: hx, y: hy }, r)) lanes.push(lane(b, mt + b.delay)); } // (fired relative to where the heart is now)
    if (k++ % 4 === 0) { // replan, judged only on lanes it has noticed
      const known = lanes.filter(L => now - L.seen >= bot.react && now <= L.to(2000));
      if (bot.plan) target = search(known, hx, hy, now);
      else { let best = null, bs = 1e9;
        for (const [x, y] of [[hx, hy], ...cands]) { const fr = Math.ceil(Math.max(Math.abs(x - hx), Math.abs(y - hy)) / STEP), ta = now + fr * FRAME; let bad = 0;
          if (hotAny(known, hx, hy, now) && hotAny(known, x, y, now)) bad++; // greedy: nearest spot safe now and when it gets there (no route check)
          for (let s = 0; s <= 600; s += 50) if (hotAny(known, x, y, ta + s, PAD, PADT)) { bad += 2; break; }
          const v = bad * 1000 + fr + Math.hypot(x - 320, y - (IN.t + IN.b) / 2) * .02; if (v < bs) { bs = v; best = [x, y]; } }
        target = best; } }
    const mx = Math.sign(target[0] - hx) * Math.min(STEP, Math.abs(target[0] - hx)), my = Math.sign(target[1] - hy) * Math.min(STEP, Math.abs(target[1] - hy));
    hx = Math.max(IN.l, Math.min(IN.r, hx + mx)); hy = Math.max(IN.t, Math.min(IN.b, hy + my));
    if (now - inv >= IFRAMES && hotAny(lanes, hx, hy, now)) { hits++; inv = now; }
  }
  return { hits, ms: end };
}
const blasters = moves => moves.reduce((n, m) => n + rayMoves(m, BOX, { x: 320, y: 300 }, () => .5).length, 0);
function score(moves, seeds) {
  const tot = { oracle: 0, super: 0, good: 0, casual: 0 }; let ms = 0;
  for (const s of seeds) for (const b in BOTS) { const r = run(moves, BOTS[b], s); tot[b] += r.hits; ms = r.ms; }
  const n = seeds.length, v = { oracle: tot.oracle / n, super: tot.super / n, good: tot.good / n, casual: tot.casual / n, sec: ms / 1000, blasters: blasters(moves) };
  v.fit = 2 * Math.min(v.super, 3) + Math.min(v.good, 3) + .4 * Math.min(v.casual, 5) - 60 * v.oracle - 1.5 * Math.max(0, v.sec - 9.5) - .5 * Math.max(0, v.blasters - 18);
  return v;
}
if (!isMainThread) parentPort.on("message", ({ scripts, seeds }) => parentPort.postMessage(scripts.map(s => score(s, seeds))));
else main();

function main() {
  const R = rng(Date.now() % 1e9), pick = l => l[Math.floor(R() * l.length)], num = (a, b, s = 10) => a + s * Math.floor(R() * ((b - a) / s + 1));
  const MAKE = {
    aimed: () => ({ kind: "aimed", n: pick([1, 1, 2, 3]) }), fan: () => ({ kind: "fan", n: pick([2, 3, 4]), spread: pick([.15, .2, .25, .35]) }),
    across: () => ({ kind: "across", off: pick([0, 0, -30, 30, -50, 50]), side: pick([-1, 1, 0]) }), down: () => ({ kind: "down", off: pick([0, 0, -30, 30, -50, 50]), side: pick([-1, 1, 0]) }),
    cross: () => ({ kind: "cross", off: pick([0, -20, 20]) }), cage: () => ({ kind: "cage", gap: pick([28, 32, 36, 40, 48]) }),
    sweep: () => ({ kind: "sweep", n: pick([2, 3, 4]), step: pick([30, 40, 50]), every: num(150, 450), axis: pick(["across", "down"]), side: pick([-1, 1, 0]) }), big: () => ({ kind: "big" }) };
  const move = () => ({ dt: num(150, 1400), charge: num(300, 900), width: pick([22, 26, 26, 30, 36, 44]), ...MAKE[pick(Object.keys(MAKE))]() });
  const clone = x => JSON.parse(JSON.stringify(x));
  function mutate(s) { s = clone(s); const i = Math.floor(R() * s.length), m = s[i], k = R();
    if (k < .25) m.dt = Math.max(150, Math.min(1400, m.dt + pick([-150, -60, 60, 150])));
    else if (k < .45) m.charge = Math.max(300, Math.min(900, (m.charge || SB.charge) + pick([-80, -40, 40, 80])));
    else if (k < .55) m.width = pick([22, 26, 30, 36, 44]);
    else if (k < .7) { const f = MAKE[m.kind](), key = pick(Object.keys(f).filter(x => x !== "kind")); if (key) m[key] = f[key]; }
    else if (k < .8) s[i] = move();
    else if (k < .88 && s.length < 14) s.splice(i, 0, move());
    else if (k < .95 && s.length > 5) s.splice(i, 1);
    else { const j = Math.floor(R() * s.length); [s[i], s[j]] = [s[j], s[i]]; }
    s[0].dt = Math.max(300, s[0].dt); return s; }
  const cross = (a, b) => clone([...a.slice(0, 1 + Math.floor(R() * (a.length - 1))), ...b.slice(1 + Math.floor(R() * (b.length - 1)))]).slice(0, 14);
  const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : +process.argv[i + 1]; };
  const GENS = arg("gens", 60), POP = arg("pop", 60), SIMS = arg("sims", 16), W = Math.max(1, os.cpus().length - 1);
  const pool = Array.from({ length: W }, () => new Worker(__filename));
  const evalAll = (scripts, seeds) => Promise.all(pool.map((w, k) => new Promise(res => { const part = scripts.filter((_, i) => i % W === k); w.once("message", res); w.postMessage({ scripts: part, seeds }); })))
    .then(parts => scripts.map((_, i) => parts[i % W][Math.floor(i / W)]));
  const start = clone(RAY.moves);
  let pop = [start, ...Array.from({ length: POP - 1 }, (_, i) => i < POP / 3 ? mutate(mutate(start)) : Array.from({ length: 6 + Math.floor(R() * 6) }, move))];
  (async () => {
    const t0 = Date.now(), history = []; let runs = 0;
    for (let g = 0; g < GENS; g++) {
      const seeds = Array.from({ length: SIMS }, (_, i) => 1000 + (g % 5) * SIMS + i), sc = await evalAll(pop, seeds); runs += pop.length * SIMS * 4;
      const ranked = pop.map((s, i) => ({ s, ...sc[i] })).sort((a, b) => b.fit - a.fit), best = ranked[0];
      history.push({ gen: g, runs, fit: +best.fit.toFixed(2), oracle: best.oracle, super: +best.super.toFixed(2), good: +best.good.toFixed(2), casual: +best.casual.toFixed(2), sec: +best.sec.toFixed(1), blasters: best.blasters });
      if (g % 5 === 0 || g === GENS - 1) { const sec = (Date.now() - t0) / 1000; console.log(`gen ${g}  ${runs.toLocaleString()} runs (${Math.round(runs / sec).toLocaleString()}/s)  fit ${best.fit.toFixed(2)}  super ${best.super.toFixed(2)} good ${best.good.toFixed(2)} casual ${best.casual.toFixed(2)} oracle ${best.oracle}  ${best.sec.toFixed(1)}s ${best.blasters} blasters`); }
      const elite = ranked.slice(0, 4).map(x => x.s), tour = () => { const a = ranked[Math.floor(R() * ranked.length)], b = ranked[Math.floor(R() * ranked.length)]; return (a.fit > b.fit ? a : b).s; };
      pop = [...elite, ...Array.from({ length: POP - 4 }, () => R() < .6 ? mutate(cross(tour(), tour())) : mutate(tour()))];
    }
    const fresh = Array.from({ length: 60 }, (_, i) => 900000 + i), top = pop.slice(0, 8), fsc = await evalAll(top, fresh), hand = (await evalAll([start], fresh))[0];
    pool.forEach(w => w.terminate());
    const ok = top.map((s, i) => ({ s, ...fsc[i] })).filter(x => x.oracle === 0).sort((a, b) => b.fit - a.fit)[0];
    const secs = (Date.now() - t0) / 1000; console.log(`\n${runs.toLocaleString()} runs in ${secs.toFixed(0)}s (${Math.round(runs / secs).toLocaleString()}/s)`);
    console.log(`previous script: super ${hand.super.toFixed(2)} good ${hand.good.toFixed(2)} casual ${hand.casual.toFixed(2)} oracle ${hand.oracle} (${hand.sec.toFixed(1)}s, ${hand.blasters} blasters)`);
    if (!ok) { console.log("no finalist stayed hitless for the oracle on fresh boards; nothing written"); process.exit(1); }
    console.log(`learned:         super ${ok.super.toFixed(2)} good ${ok.good.toFixed(2)} casual ${ok.casual.toFixed(2)} oracle ${ok.oracle} (${ok.sec.toFixed(1)}s, ${ok.blasters} blasters, ${ok.s.length} moves)`);
    const kinds = {}; ok.s.forEach(m => { kinds[m.kind] = (kinds[m.kind] || 0) + 1; }); console.log("moves it chose:", JSON.stringify(kinds));
    fs.writeFileSync(path.join(__dirname, "attack-ai-blasters.json"), JSON.stringify({ trained: new Date().toISOString(), runs, bots: BOTS, previous: hand, learned: { ...ok, s: undefined }, kinds, script: ok.s, history }, null, 1));
    if (process.argv.includes("--write")) {
      const src = fs.readFileSync(BOSS, "utf8").replace(/const RAY = \{ END: (\d+), moves: \[.*?\] \};[^\n]*/, (_, e) => `const RAY = { END: ${e}, moves: ${JSON.stringify(ok.s)} }; // evolved by tools/train-attacks.js (${new Date().toISOString().slice(0, 10)}, ${runs.toLocaleString()} runs: super ${ok.super.toFixed(1)} hits, good ${ok.good.toFixed(1)}, casual ${ok.casual.toFixed(1)}, oracle 0 on 60 unseen runs)`);
      fs.writeFileSync(BOSS, src); console.log("written to boss.js");
    }
  })();
}
