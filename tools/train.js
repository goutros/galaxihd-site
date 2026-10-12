// tools/train.js (loaded by sim.html): the browser half of the balance pipeline. It plays the real fight engine (no drawing, ~1000x real
// time) with player AIs and measures what every attack and event does to you, at a range of Galaxi's attack speeds. tools/balance.py
// turns those numbers into whole fights and tunes Galaxi. Run train.measure() in sim.html's console (or let Claude drive it).
(() => {
const FRAME = 1000 / 60, ALL = [[], ["ArrowUp"], ["ArrowDown"], ["ArrowLeft"], ["ArrowRight"], ["ArrowUp", "ArrowLeft"], ["ArrowUp", "ArrowRight"], ["ArrowDown", "ArrowLeft"], ["ArrowDown", "ArrowRight"]];

// Mario's auto-scroller: run, keeping to the middle of the screen (room both ways), jumping walls and gaps; while a top-half
// avalanche is lit, don't jump. (A real ledge-climber for the bottom waves is still to do: this bot is a weak Mario player.)
function mario(E) {
  const m = E.foe.flags.mario; if (!m || typeof m !== "object") return ["ArrowRight"];
  const B = E.box, L = 320 - B.w / 2, T = 384 - B.h, s = E.soul, g = m.grid, wx = s.x - L + m.off, wy = s.y - T, MID = 5 * 16;
  const solid = (x, y) => "XSQ?U<>[]".includes((g[Math.floor(y / 16)] || [])[Math.floor(x / 16)] || "-");
  const run = dir => { if (!dir) return []; const ahead = dir > 0 ? [10, 18, 26] : [-10, -18, -26], wall = ahead.some(dx => solid(wx + dx, wy) || solid(wx + dx, wy - 10)), gap = ahead.every(dx => !solid(wx + dx, wy + 14));
    const k = dir > 0 ? ["ArrowRight"] : dir < 0 ? ["ArrowLeft"] : []; return wall || gap ? [...k, "ArrowUp"] : k; };
  const wave = E.bullets.find(b => b.fixed && Math.abs(b.w - B.w) < 2 && b.h > 40 && b.damage === 0 && !b.image && b.tell);
  if (wave && wave.y - T < MID) { const k = run(s.x - L < B.w * .45 ? 1 : 0); return k.filter(x => x !== "ArrowUp"); } // a top wave: stay down
  const sx = s.x - L; return sx > B.w * .55 ? run(0) : run(1); // keep around the middle
}

// Lorem: the white letters hurt, the blue words are the safe path: the target is the middle of where the blue spans of every line
// around the heart (and the ones rising into it) overlap. Letter width measured like boss.js does, at the time (the font may load late)
const mono = document.createElement("canvas").getContext("2d");
function loremTarget(E) {
  mono.font = '32px "DTM-Mono", monospace'; const CW = mono.measureText("M").width, s = E.soul;
  let l = -1e9, r = 1e9;
  for (const b of E.bullets) { if (!b.text || !b.blue || b.dead || b.y - s.y > 17 + 4 + 26 || s.y - b.y > 17 + 4) continue;
    const idx = b.blue.map((v, c) => v ? c : -1).filter(c => c >= 0); if (!idx.length) continue;
    l = Math.max(l, 52 + idx[0] * CW); r = Math.min(r, 52 + (idx[idx.length - 1] + 1) * CW); }
  return l < -1e8 ? null : (l + r) / 2;
}

// the restock trap's inventory: step off a flashing slot to the first open side that isn't flashing (one tap at a time)
function grid(E, t, me) {
  if ((me.cool -= FRAME) > 0) return [];
  const B = E.box, L = 320 - B.w / 2, T = 384 - B.h, cell = (x, y) => [Math.floor((x - L) / 36), Math.floor((y - T) / 36)];
  const danger = new Set(E.bullets.filter(b => b.tell && me.seen(b, t)).map(b => cell(b.x, b.y).join())), [c, r] = cell(E.soul.x, E.soul.y);
  if (!danger.has(c + "," + r)) return [];
  const opts = [["ArrowLeft", -1, 0], ["ArrowRight", 1, 0], ["ArrowUp", 0, -1], ["ArrowDown", 0, 1]].filter(([, dc, dr]) => c + dc >= 0 && c + dc < 9 && r + dr >= 0 && r + dr < 3);
  const k = (opts.find(([, dc, dr]) => !danger.has((c + dc) + "," + (r + dr))) || opts[0])[0]; me.cool = 200; return [k];
}

// the player AI: the sim's look-ahead bot with its settings open. H frames of look-ahead, M px of safety margin, C pull to the middle;
// then made human: R ms before it notices a new bullet, and N slips a second (a wrong direction held for 150ms)
function player(p = {}) {
  const { H = 30, M = 4, C = .002, R = 0, N = 0 } = p, born = new WeakMap(); let slip = 0, slipKeys = [];
  const me = { cool: 0, seen: (b, t) => { if (!born.has(b)) born.set(b, t); return t - born.get(b) >= R; } };
  const danger = (E, x, y, f, t) => { let d = 0;
    for (const b of E.bullets) { if ((!b.damage && !b.tell) || b.solid || b.dead || b.text || (b.w <= 2 && b.h <= 2) || !me.seen(b, t)) continue; // (lorem's lines and its 2px sting: the path term covers those)
      const px = b.x + b.vx * f, py = b.y + b.vy * f; if (b.w < 120 && b.h < 120 && Math.abs(px - x) + Math.abs(py - y) > 160) continue; // far off: skip (a screen of comment bullets made this the cost)
      const c = Math.cos(b.rot || 0), sn = Math.sin(b.rot || 0), ox = x - px, oy = y - py;
      if (Math.abs(ox * c + oy * sn) <= b.w / 2 + M && Math.abs(-ox * sn + oy * c) <= b.h / 2 + M) d += 1 / (1 + f * .25); }
    return d; };
  const keys = (E, attack, t) => {
    if (N && (slip -= FRAME) > 0) return slipKeys;
    if (N && Math.random() < N * FRAME / 1000) { slip = 150; slipKeys = ALL[1 + Math.floor(Math.random() * 8)]; return slipKeys; }
    if (attack === "mario") return mario(E);
    if (attack === "inventory") return grid(E, t, me);
    if (attack === "sonic" || (E.soul.hide && attack === "pokeball")) return botKeys(E, attack); // lane switching / mashing out: the sim's own
    const s = E.soul, B = E.box, L = 320 - B.w / 2 + 8, Rt = 320 + B.w / 2 - 8, T = 384 - B.h + 8, Bt = 384 - 8;
    const tx = attack === "lorem" ? loremTarget(E) : null; // lorem: stay on the blue path
    let best = [], bestScore = Infinity;
    for (const k of ALL) { const vx = (k.includes("ArrowRight") ? 1 : 0) - (k.includes("ArrowLeft") ? 1 : 0), vy = (k.includes("ArrowDown") ? 1 : 0) - (k.includes("ArrowUp") ? 1 : 0); let score = 0;
      for (let f = 1; f <= H; f += 3) score += danger(E, Math.max(L, Math.min(Rt, s.x + vx * 2 * f)), Math.max(T, Math.min(Bt, s.y + vy * 2 * f)), f, t);
      score += tx !== null ? Math.abs(s.x + vx * 4 - tx) * .05 : Math.hypot(s.x + vx * 20 - 320, s.y + vy * 20 - (384 - B.h / 2)) * C; score += k.length ? .001 : 0;
      if (score < bestScore) { bestScore = score; best = k; } }
    return best;
  };
  return keys;
}

// one turn of the real fight: turn i (or an event forced onto it), Galaxi's attack at `speed`, played by `keys`. Returns the HP it cost
// you, what you healed, and what Galaxi healed / took from you
async function turn(i, keys, { speed = 1, event = null } = {}) {
  await Promise.all(['32px "DTM-Mono"', '32px "DTM-Sans"'].map(f => document.fonts.load(f))); // lorem lays its text out by the font's width: measure with the real one
  document.getElementById("ut-battle")?.querySelector("button")?.click(); window.__egg = undefined;
  const T = GALAXI_BOSS.turns, sp = T.map(t => t.speed); T.forEach(t => t.speed = speed);
  startBattle(GALAXI_BOSS, "../", { turn: i, sim: true, nodraw: true, story: true, events: event ? [event] : [], eventFrom: i });
  const E = __egg; E.foe.hp = 100; E.player.hp = 10;
  let lost = 0, healed = 0, hp = 10, t = 0, dodge = 0, picked = false, attack = T[i].attack; const hits = [], items0 = E.player.items.length, foe0 = E.foe.hp;
  for (; t < 90000; t += FRAME) { const st = E.state;
    if (E.modal) E.keys(Math.floor(t / 100) % 2 ? ["z"] : []); // a popup (the crash dialog): confirm
    else if (st === "talk" || st === "text") E.keys(t % 200 < FRAME ? ["z"] : []);
    else if (st === "dodge") { dodge += FRAME; E.keys(keys(E, E.cur && E.cur.name === "trap" ? "inventory" : attack, t)); }
    else if (st === "menu" && event === "restock" && !picked) { picked = true; E.pick("ITEM"); } // walk into the trap
    else if (st === "menu" || st === "end" || st === "dead") break; else E.keys([]);
    E.tick(FRAME); if (E.player.hp < hp) { lost += hp - E.player.hp; hits.push(hp - E.player.hp); } else healed += E.player.hp - hp; E.player.hp = hp = 10; await null; // held at 10: never dies, room to heal
  }
  T.forEach((t, k) => t.speed = sp[k]);
  document.getElementById("ut-battle")?.querySelector("button")?.click(); // close it (frees its canvas, listeners, audio)
  await new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = r; c.port2.postMessage(0); }); // let the page breathe between runs (a sweep that never yields gets the tab killed; a MessageChannel isn't throttled in a hidden tab like setTimeout)
  train.done = (train.done || 0) + 1;
  return { lost, hits, healed, sec: +(t / 1000).toFixed(2), dodgeSec: +(dodge / 1000).toFixed(2), foeHealed: Math.max(0, E.foe.hp - foe0), itemsLost: Math.max(0, items0 - E.player.items.length) };
}

// the player AI learns: a small search over its look-ahead (H), margin (M) and centre pull (C) on the free-movement attacks, keeping
// whatever loses the least HP
async function learn(runs = 3) {
  const T = GALAXI_BOSS.turns, free = T.map((t, i) => i).filter(i => !["mario", "sonic", "lorem"].includes(T[i].attack));
  let best = null;
  for (const H of [24, 30, 42]) for (const M of [3, 4, 6]) for (const C of [.001, .002, .004]) { let lost = 0;
    for (const i of free) for (let r = 0; r < runs; r++) lost += (await turn(i, player({ H, M, C }))).lost;
    if (!best || lost < best.lost) best = { H, M, C, lost }; }
  return best;
}
// the first turn an event fits: never turn 0 (battle.js only fires an event once turn - 1 >= plan.next, so eventFrom 0 slips it to a later turn)
function eventTurn(name) {
  const T = GALAXI_BOSS.turns, ev = window.GALAXI_EVENTS[name];
  return T.findIndex((t, k) => k && !t.sneak && (!ev.can || ev.can({ turn: t, attack: t.attack, foe: { hp: 100, max: 320, flags: {}, uses: {} }, player: { hp: 20, max: 20, items: [{ name: "Golden Carrot", heal: 15 }] }, loop: 0, story: true })));
}

// what everything does to you: every attack at each of Galaxi's speeds, and every event, for each player
async function measure({ profiles, speeds = [.8, .9, 1, 1.1, 1.2, 1.35, 1.5], n = 12, nEvents = 10 } = {}) {
  const T = GALAXI_BOSS.turns, all = window.GALAXI_EVENTS, out = { turns: T.map(t => t.attack), speeds, attacks: {}, events: {} };
  await turn(0, player()); // warm-up (fonts, images)
  for (const [who, p] of Object.entries(profiles)) {
    out.attacks[who] = T.map(() => ({})); out.events[who] = {};
    for (let i = 0; i < T.length; i++) for (const sp of speeds) { const runs = []; for (let r = 0; r < n; r++) runs.push(await turn(i, player(p), { speed: sp })); out.attacks[who][i][sp] = runs.map(({ hits, healed, dodgeSec, sec }) => ({ hits, healed, dodgeSec, sec })); }
    for (const name of Object.keys(all)) {
      const i = eventTurn(name);
      if (i < 0) continue; const runs = []; for (let r = 0; r < nEvents; r++) runs.push(await turn(i, player(p), { event: name }));
      out.events[who][name] = { turn: i, runs: runs.map(({ hits, healed, foeHealed, itemsLost, sec }) => ({ hits, healed, foeHealed, itemsLost, sec })) }; }
  }
  return out;
}

// ---------- the best player: a planner on exact replays ----------
// Seeded Math.random makes a fight replay exactly (same seed + same keys = same fight). Every `step` frames the planner replays the
// attack with each move held for `step` frames then its look-ahead bot for the rest of H frames (~0.7s: about what an attack's
// warnings give a person), and keeps the move that loses the least HP. Real physics, real bullets, platforming included. A hitless
// result is an actual key sequence that clears the attack: proof a hitless run is possible.
const seeded = s => () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const RANDOM = Math.random, BEST = { H: 24, M: 6, C: .001 };
const yieldNow = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = r; c.port2.postMessage(0); });
function replay(i, { seed, speed = 1, event = null }, inputs, maxF = 1e9) {
  const T = GALAXI_BOSS.turns, sp = T.map(t => t.speed); T.forEach(t => t.speed = speed); Math.random = seeded(seed);
  DECKS.clear(); botKeys.mash = false; // boss.js's no-repeat line decks reshuffle with Math.random: start them fresh or the rolls drift
  document.getElementById("ut-battle")?.querySelector("button")?.click(); window.__egg = undefined;
  startBattle(GALAXI_BOSS, "../", { turn: i, sim: true, nodraw: true, story: true, events: event ? [event] : [], eventFrom: i });
  const E = __egg; E.foe.hp = 100; E.player.hp = 10;
  const lostAt = [], caught = [], used = []; let f = 0, hp = 10, picked = false, ended = false;
  for (let t = 0; t < 120000; t += FRAME) { const st = E.state; let dodging = false;
    if (E.modal) E.keys(Math.floor(t / 100) % 2 ? ["z"] : []);
    else if (st === "talk" || st === "text") E.keys(t % 200 < FRAME ? ["z"] : []);
    else if (st === "dodge") { if (f >= maxF) break; E.keys(used[f] = inputs(f, E)); dodging = true; }
    else if (st === "menu" && event === "restock" && !picked) { picked = true; E.pick("ITEM"); }
    else if (st === "menu" || st === "end" || st === "dead") { ended = true; break; } else E.keys([]);
    E.tick(FRAME); if (dodging) { lostAt[f] = Math.max(0, hp - E.player.hp); caught[f++] = !!E.soul.hide; } E.player.hp = hp = 10;
  }
  document.getElementById("ut-battle")?.querySelector("button")?.click(); Math.random = RANDOM; T.forEach((t, k) => t.speed = sp[k]);
  return { lostAt, caught, used, ended };
}
const MARIO_MOVES = [["ArrowRight"], ["ArrowRight", "ArrowUp"], [], ["ArrowUp"], ["ArrowLeft"], ["ArrowLeft", "ArrowUp"]];
async function oracle(i, opts = {}) {
  const { step = 6, H = 42 } = opts, attack = opts.event === "restock" ? "inventory" : GALAXI_BOSS.turns[i].attack;
  const moves = attack === "mario" ? MARIO_MOVES : ALL, chosen = [];
  const live = (E, k, f) => E.soul.hide ? (f % 2 ? ["z"] : []) : k; // caught in a Poke Ball: mash out
  let prev = null;
  for (;;) {
    const n = chosen.length; let best = null;
    for (const c of [null, ...moves]) { // null: the bot's own moves (never worse than the bot; it knows Sonic's lane hops, the inventory's taps)
      const b0 = player(BEST); let held = [], at = -9; const bot = (E, a, t) => { const f = Math.round(t / FRAME); if (f - at >= 3 || f < n + step) { held = b0(E, a, t); at = f; } return held; }; // look-ahead: it re-decides every 3 frames (the first step's frames are exact)
      const r = replay(i, opts, (f, E) => f < n ? chosen[f] : live(E, f < n + step && c ? c : bot(E, E.cur && E.cur.name === "trap" ? "inventory" : attack, f * FRAME), f), n + H);
      let score = c === prev ? -.01 : 0; // (keep going the same way when it's a tie)
      r.lostAt.forEach((l, f) => { if (f >= n && l) score += l * (f < n + step ? 4 : 1); });
      r.caught.forEach((c, f) => { if (f >= n && c && !(f && r.caught[f - 1])) score += 3; }); // caught in a Poke Ball: the bolts come later than the look-ahead, so count the catch itself
      if (!best || score < best.score) best = { c, score, ended: r.ended, keys: r.used.slice(n, n + step) };
    }
    for (let k = 0; k < step; k++) chosen.push(best.keys[k] || []); // exactly what was played in the winning replay
    prev = best.c; await yieldNow();
    if (best.ended && replay(i, opts, f => f < chosen.length ? chosen[f] : [], chosen.length).ended || chosen.length > 4000) break;
  }
  const fin = replay(i, opts, (f, E) => f < chosen.length ? chosen[f] : live(E, [], f));
  return { lost: fin.lostAt.reduce((a, b) => a + b, 0), hits: fin.lostAt.filter(Boolean).length, frames: fin.lostAt.length };
}

// the proof: the planner on every attack (and the comment section) at each of Galaxi's speeds, a few seeds each
async function prove({ seeds = [1, 2, 3], speeds = [1], attacks = null, events = [] } = {}) {
  const T = GALAXI_BOSS.turns, out = [], jobs = [];
  for (const sp of speeds) { for (let i = 0; i < T.length; i++) if (!attacks || attacks.includes(T[i].attack)) jobs.push({ i, sp, name: T[i].attack });
    for (const ev of events) jobs.push({ i: eventTurn(ev), sp, name: ev, event: ev }); }
  for (const j of jobs) for (const seed of seeds) {
    const t0 = performance.now(); let r = await oracle(j.i, { seed, speed: j.sp, event: j.event });
    for (const harder of [{ step: 4, H: 72 }, { step: 3, H: 108 }, { step: 6, H: 160 }]) if (r.hits) r = await oracle(j.i, { seed, speed: j.sp, event: j.event, ...harder }); // took a hit: search finer and further ahead (still ~1-1.8s of foresight)
    out.push({ name: j.name, speed: j.sp, seed, ...r, sec: Math.round((performance.now() - t0) / 1000) });
    train.progress && train.progress(`${j.name} x${j.sp} #${seed}: ${r.hits} hits (${out.at(-1).sec}s)`);
  }
  return out;
}

window.train = { player, turn, mario, learn, measure, replay, oracle, prove };
})();
