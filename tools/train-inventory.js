#!/usr/bin/env node
/* tools/train-inventory.js: trains Galaxi's moves for the restock (inventory) fight the way games tune enemy AI: no generative AI, an
   evolutionary search against simulated players, on every CPU core.

     node tools/train-inventory.js [--runs 1200000] [--pop 100] [--sims 24] [--write]

   Galaxi has full control of his inventory: a script is 8-16 moves, any of drag (lanes), path (ring / L / snake), drop (slams), wall
   (herding stacks onto your open sides), shuffle (a new maze: easy / normal / hard) and grab (picks you up). Every rule and timing comes from
   the game itself (GALAXI_EVENTS.restock.model.plan in assets/egg/events/restock.js), so what's trained is exactly what plays.
   Four hearts dodge every script:
     oracle   searches every path, 200ms reaction, a tap every 160ms: it MUST stay hitless (proof every move can be dodged)
     super    searches every path, 260ms reaction, a tap every 190ms: a really good player, the one he's trying to beat
     good     300ms, a tap every 210ms, runs to the nearest slot outside the flashing danger
     casual   420ms, a tap every 260ms, same plan
   Score: 2 x super hits (up to 4) + good hits (up to 4) + 0.4 x casual hits (up to 6), minus a huge penalty for any oracle hit, for running
   past 22s, and for fewer than 2 shuffles. Saves tools/inventory-ai.json; --write also puts the script into restock.js (LEARNED). */
const fs = require("fs"), vm = require("vm"), path = require("path"), os = require("os");
const { Worker, isMainThread, parentPort } = require("worker_threads");
const RESTOCK = path.join(__dirname, "../assets/egg/events/restock.js");
const win = {}; vm.runInNewContext(fs.readFileSync(RESTOCK, "utf8"), { window: win });
const M = win.GALAXI_EVENTS.restock.model, { NB, T } = M;
const rng = s => () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const BOTS = { oracle: { react: 200, step: 160, exact: true }, super: { react: 260, step: 190, exact: true }, good: { react: 300, step: 210 }, casual: { react: 420, step: 260 } };
const nbrs = i => NB[i].map((j, d) => [j, d]).filter(([j]) => j !== null);

// one move against one heart: { hits, me, heading }
function play(pl, st, bot) {
  if (pl.teleport) return { hits: 0, me: pl.teleport.to, heading: null };
  if (!pl.lands.length) return { hits: 0, me: st.me, heading: st.heading }; // walls / shuffles never hurt
  const blocked = (c, t) => M.wallAt(pl, st, c, t) || (pl.temp.has(c) && pl.temp.get(c) <= t && t < pl.collect);
  const times = []; for (let t = bot.react; t < pl.end; t += bot.step) times.push(t);
  const hitsIn = (c, from, to) => { let n = 0; for (const [x, t] of pl.lands) if (x === c && t + T.hurt >= from && t <= to) n++; return n; };
  if (bot.exact) { // every path: decisions at `times`, stay or step to a free neighbour; fewest hits, then fewest moves
    const memo = new Map(), K = times.length;
    const best = (k, c) => { const key = k * 64 + c, m = memo.get(key); if (m) return m;
      const from = times[k] + 16, to = k + 1 < K ? times[k + 1] + 16 : pl.end; let b = null;
      for (const [j, d] of [[c, null], ...nbrs(c)]) { if (j !== c && blocked(j, times[k])) continue;
        const h = hitsIn(j, from, to), rest = k + 1 < K ? best(k + 1, j) : { hits: 0, moves: 0, end: j, heading: null };
        const hits = h + rest.hits, moves = (j !== c) + rest.moves;
        if (!b || hits < b.hits || hits === b.hits && moves < b.moves) b = { hits, moves, end: rest.end, heading: rest.heading ?? (j !== c ? d : null) }; }
      memo.set(key, b); return b; };
    const pre = hitsIn(st.me, 0, (times[0] ?? pl.end) + 16), r = K ? best(0, st.me) : { hits: 0, end: st.me, heading: null };
    return { hits: pre + r.hits, me: r.end, heading: r.heading ?? st.heading };
  }
  let me = st.me, heading = st.heading, hits = hitsIn(me, 0, (times[0] ?? pl.end) + 16); // greedy: out of the danger, the nearest way
  times.forEach((t, k) => { const danger = new Set(); for (const [c, lt] of pl.lands) if (lt + T.hurt >= t) danger.add(c);
    if (danger.has(me)) { const prev = new Map([[me, null]]), q = [me]; let goal = null;
      while (q.length && goal === null) { const i = q.shift(); for (const [j, d] of nbrs(i)) if (!prev.has(j) && !blocked(j, t)) { prev.set(j, [i, d]); if (!danger.has(j)) { goal = j; break; } q.push(j); } }
      if (goal !== null) { let j = goal; while (prev.get(j)[0] !== me) j = prev.get(j)[0]; heading = prev.get(j)[1]; me = j; } }
    hits += hitsIn(me, t + 16, k + 1 < times.length ? times[k + 1] + 16 : pl.end); });
  return { hits, me, heading };
}
// a whole script against one heart, on one board (a random maze, start in the middle)
function run(script, bot, seed) {
  const r = rng(seed); let st = { me: 13, heading: null, walls: M.maze(M.level(r), 13, r) }, hits = 0, ms = 0;
  script.forEach((g, k) => { const pl = M.plan(g, st, rng(seed * 97 + k)), res = play(pl, st, bot); hits += res.hits; ms += pl.end;
    st = { me: res.me, heading: res.heading, walls: M.wallsAfter(pl, st) }; });
  return { hits, ms };
}
function score(script, seeds) {
  const tot = { oracle: 0, super: 0, good: 0, casual: 0 }; let ms = 0;
  for (const s of seeds) for (const b in BOTS) { const r = run(script, BOTS[b], s); tot[b] += r.hits; if (b === "oracle") ms += r.ms; }
  const n = seeds.length, v = { oracle: tot.oracle / n, super: tot.super / n, good: tot.good / n, casual: tot.casual / n, sec: ms / n / 1000 }, shuffles = script.filter(g => g.kind === "shuffle").length;
  v.fit = 2 * Math.min(v.super, 4) + Math.min(v.good, 4) + .4 * Math.min(v.casual, 6) - 60 * v.oracle - .6 * Math.max(0, v.sec - 22) - 3 * Math.max(0, 2 - shuffles);
  return v;
}
if (!isMainThread) parentPort.on("message", ({ scripts, seeds }) => parentPort.postMessage(scripts.map(s => score(s, seeds))));
else main();

function main() {
  // ---- the genes ----
  const R = rng(Date.now() % 1e9), pick = l => l[Math.floor(R() * l.length)], tell = () => 200 + 10 * Math.floor(R() * 71);
  const lane = () => ({ axis: pick(["row", "col"]), rel: pick([0, 0, 0, 1, -1, 2, -2]), at: pick(["me", "me", "ahead"]), dir: pick(["toward", "away", "random"]) });
  const MAKE = {
    drag: () => ({ kind: "drag", tell: tell(), step: pick([30, 45, 60]), lanes: Array.from({ length: pick([1, 1, 2, 2, 3]) }, lane) }),
    path: () => ({ kind: "path", tell: tell(), step: pick([30, 45, 60]), shape: pick(["ring", "L", "snake"]), at: pick(["me", "ahead"]), dir: pick(["toward", "away", "random"]) }),
    drop: () => ({ kind: "drop", tell: tell(), shape: pick(["me", "ahead", "both", "plus", "x"]) }),
    wall: () => ({ kind: "wall", n: pick([1, 2, 3]) }), shuffle: () => ({ kind: "shuffle", level: pick(["easy", "normal", "hard"]) }), grab: () => ({ kind: "grab" }) };
  const gene = () => MAKE[pick(["drag", "drag", "drag", "path", "path", "drop", "drop", "wall", "shuffle", "grab"])]();
  const clone = x => JSON.parse(JSON.stringify(x));
  function mutate(s) { s = clone(s); const i = Math.floor(R() * s.length), g = s[i], k = R();
    if (k < .22 && g.tell) g.tell = Math.max(200, Math.min(900, g.tell + pick([-60, -30, 30, 60])));
    else if (k < .4) { const fresh = MAKE[g.kind || "drag"](), f = pick(Object.keys(fresh).filter(x => x !== "kind")); if (f) g[f] = fresh[f]; if ((g.kind || "drag") === "drag" && R() < .5) g.lanes[Math.floor(R() * g.lanes.length)] = lane(); } // tweak one thing
    else if (k < .55) s[i] = gene();
    else if (k < .68 && s.length < 16) s.splice(i, 0, gene());
    else if (k < .8 && s.length > 8) s.splice(i, 1);
    else { const j = Math.floor(R() * s.length); [s[i], s[j]] = [s[j], s[i]]; }
    return s; }
  const cross = (a, b) => clone([...a.slice(0, 1 + Math.floor(R() * (a.length - 1))), ...b.slice(1 + Math.floor(R() * (b.length - 1)))]).slice(0, 16);

  const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : +process.argv[i + 1]; };
  const RUNS = arg("runs", 1.2e6), POP = arg("pop", 100), SIMS = arg("sims", 24), W = Math.max(1, os.cpus().length - 1);
  const pool = Array.from({ length: W }, () => new Worker(__filename));
  const evalAll = (scripts, seeds) => Promise.all(pool.map((w, k) => new Promise(res => { const part = scripts.filter((_, i) => i % W === k); w.once("message", res); w.postMessage({ scripts: part, seeds }); })))
    .then(parts => scripts.map((_, i) => parts[i % W][Math.floor(i / W)]));
  const start = JSON.parse(fs.readFileSync(RESTOCK, "utf8").match(/const LEARNED = (\[.*?\]); \/\//)[1]);
  const withShuffles = s => { s = clone(s); if (s.filter(x => x.kind === "shuffle").length < 2) { s.splice(3, 0, MAKE.shuffle()); s.splice(8, 0, { kind: "grab" }, MAKE.shuffle()); } return s.slice(0, 16); };
  let pop = [withShuffles(start), ...Array.from({ length: POP - 1 }, (_, i) => i < POP / 3 ? mutate(withShuffles(start)) : Array.from({ length: 8 + Math.floor(R() * 7) }, gene))];

  (async () => {
    const t0 = Date.now(), history = []; let runs = 0, g = 0;
    while (runs < RUNS) {
      const seeds = Array.from({ length: SIMS }, (_, i) => 1000 + (g % 7) * SIMS + i), sc = await evalAll(pop, seeds); runs += pop.length * SIMS * 4;
      const ranked = pop.map((s, i) => ({ s, ...sc[i] })).sort((a, b) => b.fit - a.fit), best = ranked[0];
      history.push({ gen: g, runs, fit: +best.fit.toFixed(2), oracle: best.oracle, super: +best.super.toFixed(2), good: +best.good.toFixed(2), casual: +best.casual.toFixed(2), sec: +best.sec.toFixed(1), len: best.s.length });
      if (g % 10 === 0) { const sec = (Date.now() - t0) / 1000; console.log(`gen ${g}  ${runs.toLocaleString()} runs (${Math.round(runs / sec).toLocaleString()}/s)  fit ${best.fit.toFixed(2)}  super ${best.super.toFixed(2)} good ${best.good.toFixed(2)} casual ${best.casual.toFixed(2)} oracle ${best.oracle}  ${best.sec.toFixed(1)}s ${best.s.length} moves`); }
      const elite = ranked.slice(0, 5).map(x => x.s), tour = () => { const a = ranked[Math.floor(R() * ranked.length)], b = ranked[Math.floor(R() * ranked.length)]; return (a.fit > b.fit ? a : b).s; };
      pop = [...elite, ...Array.from({ length: POP - 5 }, () => R() < .6 ? mutate(cross(tour(), tour())) : mutate(tour()))]; g++;
    }
    // the pick: re-scored on 100 boards it never trained on; the oracle must stay hitless there too
    const fresh = Array.from({ length: 100 }, (_, i) => 900000 + i), top = pop.slice(0, 10), fsc = await evalAll(top, fresh), hand = (await evalAll([withShuffles(start)], fresh))[0];
    pool.forEach(w => w.terminate());
    const ok = top.map((s, i) => ({ s, ...fsc[i] })).filter(x => x.oracle === 0).sort((a, b) => b.fit - a.fit)[0];
    const secs = (Date.now() - t0) / 1000; console.log(`\n${runs.toLocaleString()} runs in ${secs.toFixed(0)}s (${Math.round(runs / secs).toLocaleString()}/s)`);
    if (!ok) { console.log("no finalist stayed hitless for the oracle on fresh boards; nothing written"); process.exit(1); }
    const kinds = {}; ok.s.forEach(x => { kinds[x.kind || "drag"] = (kinds[x.kind || "drag"] || 0) + 1; });
    const out = { trained: new Date().toISOString(), runs, bots: BOTS, previous: { super: hand.super, good: hand.good, casual: hand.casual, oracle: hand.oracle, sec: hand.sec },
      learned: { super: ok.super, good: ok.good, casual: ok.casual, oracle: ok.oracle, sec: ok.sec }, kinds, script: ok.s, history };
    fs.writeFileSync(path.join(__dirname, "inventory-ai.json"), JSON.stringify(out, null, 1));
    console.log(`previous script: super ${hand.super.toFixed(2)} good ${hand.good.toFixed(2)} casual ${hand.casual.toFixed(2)} oracle ${hand.oracle} (${hand.sec.toFixed(1)}s)`);
    console.log(`learned:         super ${ok.super.toFixed(2)} good ${ok.good.toFixed(2)} casual ${ok.casual.toFixed(2)} oracle ${ok.oracle} (${ok.sec.toFixed(1)}s, ${ok.s.length} moves)`);
    console.log("moves it chose:", JSON.stringify(kinds));
    if (process.argv.includes("--write")) {
      fs.writeFileSync(RESTOCK, fs.readFileSync(RESTOCK, "utf8").replace(/const LEARNED = \[.*?\]; \/\/[^\n]*/, `const LEARNED = ${JSON.stringify(ok.s)}; // Galaxi's moves, evolved by tools/train-inventory.js (${out.trained.slice(0, 10)}, ${runs.toLocaleString()} runs: super ${ok.super.toFixed(1)} hits, good ${ok.good.toFixed(1)}, casual ${ok.casual.toFixed(1)}, oracle 0 on 100 unseen boards)`));
      console.log("written to restock.js");
    }
  })();
}
