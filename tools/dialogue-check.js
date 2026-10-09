// Run: node tools/dialogue-check.js  (checks every dialogue branch in assets/egg/boss.js still returns lines)
global.window = {}; global.document = { createElement: () => ({ getContext: () => ({}) }) };
require("../assets/egg/boss.js"); const B = window.GALAXI_BOSS, assert = require("assert"), T = JSON.stringify;
const R = x => B.vary(x); // resolve one(...) variants the way the engine does
const foe = (o = {}) => ({ hp: 160, max: 160, flags: {}, uses: {}, loop: 0, ...o }), p = { hp: 20 };
assert(R(B.react.FIGHT(foe({ uses: { FIGHT: 1 }, lastHit: 20 }))).length);
assert(/Miss|stand still/.test(T(B.react.FIGHT(foe({ uses: { FIGHT: 2 }, lastHit: 0 })))));
for (const k in B.react) for (let n = 1; n < 7; n++) { const r = R(typeof B.react[k] == "function" ? B.react[k](foe({ uses: { [k]: n }, lastHit: 10 })) : B.react[k]); assert(r === null || (Array.isArray(r) && r.length && r.every(l => typeof l === "string" || l.text)), k + n); }
for (const a of B.acts) for (let n = 1; n < 6; n++) { const f = foe({ uses: { [a.name]: n } }); if (n > 1) f.flags.subscribed = true; const r = R(a.run(f)); assert(r.length && r.every(l => typeof l === "string" || l.text), a.name + n); }
assert(B.aside({ foe: foe(), player: p, turn: 0, deaths: 1, story: false, first: true }).length);
for (let d = 1; d < 25; d++) assert(B.aside({ foe: foe(), player: p, turn: 0, deaths: d, story: false, first: true }).length, "deaths " + d);
for (let l = 1; l < 6; l++) assert(B.aside({ foe: foe({ loop: l }), player: p, turn: 7 * l, deaths: 0, story: true }).length, "loop " + l);
{ const pool = [["a"], ["b"], ["c"], ["d"]], got = Array.from({ length: 40 }, () => B.pick(pool)[0]); // no-repeat picker
  for (let i = 0; i < 40; i += 4) assert.strictEqual(new Set(got.slice(i, i + 4)).size, 4, "each lap of 4 uses all 4: " + got.join(""));
  for (let i = 1; i < 40; i++) assert.notStrictEqual(got[i], got[i - 1], "never twice in a row: " + got.join("")); }
for (const k in B.lines.perfect) assert(B.lines.perfect[k].length >= 4, "perfect pool " + k);
for (const k in B.quips) assert(B.quips[k].lines.length >= 5, "quips " + k);
for (const attack of ["pokeball", "blasters", "sonic", "lorem", "kablooey", "theworld", "mario"]) { // a no-hit attack always gets its own reaction
  const r = B.afterAttack({ foe: foe(), hits: 0, damage: 0, attack }); assert(Array.isArray(r) && r.length && B.lines.perfect[attack].some(l => l === r), "no-hit reaction " + attack); }
{ const seen = new Set(); for (let i = 0; i < 60; i++) seen.add(R(B.opening.say(false)).join("|")); assert(seen.size > 3, "opening varies: " + seen.size); } // one(): different runs, different lines
for (const v of [B.opening.box, B.opening.after, B.concede.flavor, B.concede.spared, B.phone.intro, B.phone.rageQuit]) assert([].concat(R(v)).every(l => typeof l === "string" || l.text), "resolves to lines");

assert.strictEqual(B.afterAttack({ foe: foe(), hits: 2, damage: 4, attack: "sonic" }), undefined, "a light attack gets nothing");
console.log("dialogue ok");
