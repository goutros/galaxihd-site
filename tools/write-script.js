#!/usr/bin/env node
// tools/write-script.js <attack>: puts the script tools/evolve.js learned (tools/attack-ai-<attack>.json) into boss.js, on its const's line
const fs = require("fs"), path = require("path");
const NAME = { kablooey: "KAB", sonic: "SONIC", theworld: "TW", pokeball: "PB", lorem: "LOREM", mario: "MARIO" }, attack = process.argv[2], name = NAME[attack];
if (!name) { console.log("usage: node tools/write-script.js " + Object.keys(NAME).join("|")); process.exit(1); }
const r = JSON.parse(fs.readFileSync(path.join(__dirname, `attack-ai-${attack}.json`), "utf8")), L = r.learned;
if (!L) { console.log("nothing learned passed the oracle; boss.js unchanged"); process.exit(1); }
const BOSS = path.join(__dirname, "../assets/egg/boss.js"), src = fs.readFileSync(BOSS, "utf8"), re = new RegExp(`^const ${name} = .*$`, "m");
if (!re.test(src)) { console.log(`no "const ${name} = ..." line in boss.js`); process.exit(1); }
const note = `evolved by tools/evolve.js (${r.trained.slice(0, 10)}: hits per run, super ${L.super}, good ${L.good}, casual ${L.casual}; hand-made was ${r.hand.super} / ${r.hand.good} / ${r.hand.casual}; proven hitless on 3 seeds)`;
fs.writeFileSync(BOSS, src.replace(re, `const ${name} = ${JSON.stringify(L.script)}; // ${note}`));
console.log(`${name} written: ${note}`);
