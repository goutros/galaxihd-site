/* Patch notes: Galaxi "patches" the fight with one random rule change. A pop-up above his head (the rule's icon,
   "PATCH x.y.z" + the change, same layout as demonetized / bad take) shows while he talks and through the attack. Every change goes either way (+ or -):
   attack speed, heart speed, heart size (2x / 8px heart), box size / width / height (taller only where there's room under him),
   bullet size, max HP (your HP keeps its ratio, put back after the attack), inverted controls, or The World's time stop twice
   (freeze only, no knives; never on The World itself). */
(window.GALAXI_EVENTS = window.GALAXI_EVENTS || {}).patchnotes = {
  can(ctx) { return ["pokeball", "blasters", "kablooey", "theworld"].includes(ctx.attack); },
  start(ctx, fx) {
    const pct = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1)); // a slightly different number each patch
    const ICON = { // 8x8 symbols for the pop-up
      down: ["...##...", "...##...", "...##...", "...##...", "##.##.##", ".######.", "..####..", "...##..."],
      up: ["...##...", "..####..", ".######.", "##.##.##", "...##...", "...##...", "...##...", "...##..."],
      flip: ["..#.....", ".#######", "..#.....", "........", ".....#..", "#######.", ".....#..", "........"],
      box: ["########", "#......#", "#.####.#", "#.#..#.#", "#.#..#.#", "#.####.#", "#......#", "########"],
      wide: ["........", "..#..#..", ".##..##.", "########", ".##..##.", "..#..#..", "........", "........"],
      tall: ["...#....", "..###...", ".#####..", "...#....", "...#....", ".#####..", "..###...", "...#...."],
      big: ["...##...", "..####..", ".######.", "########", "########", ".######.", "..####..", "...##..."],
      tiny: ["........", "........", "..####..", ".######.", ".######.", "..####..", "........", "........"],
      fast: ["#..#....", ".#..#...", "..#..#..", "...#..#.", "..#..#..", ".#..#...", "#..#....", "........"],
      slowmo: ["########", ".#....#.", "..#..#..", "...##...", "...##...", "..#..#..", ".#....#.", "########"],
      hp: ["........", ".##.##..", "#######.", "#######.", ".#####..", "..###...", "...#....", "........"],
      clock: ["..####..", ".#....#.", "#..#...#", "#..#...#", "#..###.#", "#......#", ".#....#.", "..####.."],
      soul: [".##..##.", "########", "########", "########", ".######.", "..####..", "...##...", "........"],
    };
    // every patch goes either way. Each change: (up) => { mods | hp, icon, small (the pop-up text), say } or null when it doesn't fit this attack
    const H = (ctx.turn && ctx.turn.box && ctx.turn.box[1]) || 150, ROOM = Math.floor((168 / H - 1) * 100); // the box can't grow taller than 168px (he stands right above it)
    const CHANGES = [
      up => { const n = pct(15, 25); return { mods: { speed: up ? 1 + n / 100 : 1 - n / 100 }, icon: up ? "fast" : "slowmo", small: `Attack speed ${up ? "+" : "-"}${n}%`,
        say: up ? one(["Quick patch!", "Cranked the attack speed."], ["Hotfix incoming.", "Everything's faster. Blink and you miss it."], ["Patch day!", "I turned the tick rate up."])
          : one(["Quick patch!", "Slowed everything down.", "...", "Why did I do that?"], ["Hotfix incoming.", "Server's lagging. Everything's slower."], ["Patch day!", "Slow-mo update. For the replays."]) }; },
      up => { const n = pct(25, 35); return { mods: { soulSpeed: up ? 1 + n / 100 : 1 - n / 100 }, icon: up ? "up" : "down", small: `Heart speed ${up ? "+" : "-"}${n}%`,
        say: up ? one(["Quick patch!", "Buffed your heart speed."], ["Hotfix incoming.", "...Wait, that made you faster.", "Whoops."])
          : one(["Quick patch!", "Nerfed your heart speed."], ["Hotfix incoming.", "Your heart's a bit slower now."], ["Patch day!", "Balance changes. Mostly to you."]) }; },
      up => ({ mods: { soulSize: up ? 2 : .5 }, icon: "soul", small: `Heart size ${up ? "+100" : "-50"}%`,
        say: up ? one(["Quick patch!", "Made your heart bigger.", "Easier to hit. For me."], ["Patch day!", "Your heart's huge now.", "...Is that a buff or a nerf?"])
          : one(["Quick patch!", "Shrunk your heart.", "...Wait. That helps you."], ["Hotfix incoming.", "Tiny heart now.", "...Why did I do that?"]) }),
      up => { const n = up ? Math.min(pct(15, 25), ROOM) : pct(25, 35); if (up && n < 10) return null; return { mods: { boxScale: up ? 1 + n / 100 : 1 - n / 100 }, icon: "box", small: `Box size ${up ? "+" : "-"}${n}%`,
        say: up ? one(["Quick patch!", "Gave you a bigger box.", "...", "Why did I do that?"], ["Patch day!", "More room. You'll still get hit."])
          : one(["Quick patch!", "The box was too roomy."], ["Hotfix incoming.", "Shrunk the box. Cozy, right?"], ["Patch day!", "Less room. More skill."]) }; },
      up => { const n = pct(20, 30); return { mods: { boxW: up ? 1 + n / 100 : 1 - n / 100 }, icon: "wide", small: `Box width ${up ? "+" : "-"}${n}%`,
        say: up ? one(["Quick patch!", "Stretched the box."], ["Patch day!", "Stretched the box.", "...I don't know why I did that."]) : one(["Quick patch!", "Squished the box."], ["Hotfix incoming.", "The box was too wide anyway."]) }; },
      up => { const n = up ? Math.min(pct(15, 25), ROOM) : pct(20, 30); if (up && n < 10) return null; return { mods: { boxH: up ? 1 + n / 100 : 1 - n / 100 }, icon: "tall", small: `Box height ${up ? "+" : "-"}${n}%`,
        say: up ? one(["Quick patch!", "Made the box taller."]) : one(["Quick patch!", "Flattened the box."], ["Hotfix incoming.", "Less headroom. Duck."]) }; },
      up => { const n = up ? pct(35, 50) : pct(25, 35); return { mods: { bulletScale: up ? 1 + n / 100 : 1 - n / 100 }, icon: up ? "big" : "tiny", small: `Bullets ${up ? "+" : "-"}${n}%`,
        say: up ? one(["Quick patch!", "Buffed my bullets."], ["Hotfix incoming.", "Bigger bullets. You're welcome."], ["Patch day!", "I made the bullets chunkier."])
          : one(["Quick patch!", "Smaller bullets."], ["Hotfix incoming.", "...Wait. That helps you.", "Whoops."], ["Patch day!", "I nerfed myself?", "...", "Who approved this?"]) }; },
      up => { const n = pct(20, 35); return { hp: up ? 1 + n / 100 : 1 - n / 100, icon: "hp", small: `Max HP ${up ? "+" : "-"}${n}%`,
        say: up ? one(["Quick patch!", "More max HP for you.", "...Don't get used to it."], ["Patch day!", "Buffed your health.", "...Why did I do that?"])
          : one(["Quick patch!", "Nerfed your max HP."], ["Hotfix incoming.", "Your health bar was too long.", "Fixed it."]) }; },
      () => (ctx.turn && ctx.turn.attack) === "theworld" ? null : { icon: "clock", small: "Time stop x2", // The World's time stop (no knives), twice, in any other attack
        during: a => { const T = (ctx.turn && ctx.turn.time) || 9000; a.after(T * .3, () => timeStop(a)); a.after(T * .62, () => timeStop(a)); },
        say: one(["Quick patch!", "Found a Stand Arrow laying around.", "Wanna see what it does?"], ["Patch day!", "Found this weird arrow.", "Poked myself with it.", "Check this out."], ["Hotfix incoming.", "Guess who gave himself Stand?", "...Me. I did."]) }, // Galaxi's wording
      () => ({ mods: { invert: true }, icon: "flip", small: "Controls inverted",
        say: one(["Quick patch!", "Flipped your controls."], ["Hotfix incoming.", "Left is right now. Good luck."], ["Patch day!", "Flipped your controls.", "...Wait, did I flip mine too?"]) }),
    ];
    // time stop: the whole fight freezes (bullets, timers, the heart) under The World's look and sound, then the tint fades and time swings back
    const STOP = 1900, look = timeStopFx();
    const timeStop = a => {
      a.play("assets/egg/sfx/timestop.mp3"); a.musicRate(0, 400);
      const hx = a.soul.x, hy = a.soul.y; let frozen = false, back = 0;
      fx.pause(STOP, (c2, t) => { frozen = true; look(c2, t, 0); fx.heart(hx, hy); }); // the heart stays red on top of the negative
      a.bullet({ x: 0, y: 0, w: 1, h: 1, damage: 0, clip: false, z: 1, draw(c2) { if (back) look(c2, STOP, back); },
        update(b, dt) { if (!frozen) return; if (!back) { a.musicRate(1, 300); a.sfx.swing(); } if ((back += dt) > 300) b.dead = true; } }); // runs again only once the freeze is over
    };
    let c = null; while (!c) c = CHANGES[Math.floor(Math.random() * CHANGES.length)](Math.random() < .5);
    const ver = `${1 + Math.floor(Math.random() * 2)}.${Math.floor(Math.random() * 10)}.${1 + Math.floor(Math.random() * 9)}`;
    Object.assign(fx.mods, c.mods);
    if (c.hp) { // max HP: scaled for this attack, your HP keeps its ratio both ways
      const scale = k => { const p = fx.player, r = p.hp / p.max; p.max = Math.max(1, Math.round(p.max * k)); p.hp = Math.max(1, Math.min(p.max, Math.round(r * p.max))); };
      let base = null; fx.during(() => { if (base === null) { base = fx.player.max; scale(c.hp); } });
      fx.after(() => { if (base !== null) scale(base / fx.player.max); return {}; });
    }
    fx.lines(c.say);
    fx.flavor(one(`* Patch ${ver} got rolled back. Nobody liked it.`, `* Patch ${ver} was live for exactly one attack.`, `* Patch ${ver} is gone. The patch notes remain.`));

    // the pop-up above his head (same layout as demonetized / bad take): the rule's icon + "PATCH x.y.z" + the change, up while he talks and through the attack
    fx.during(a => { fx.sfx.select(); if (c.during) c.during(a); }); // the patch goes live
    fx.draw((c2, ms) => {
      c2.save(); c2.imageSmoothingEnabled = false;
      const head = `PATCH ${ver}  `; c2.font = '16px "DTM-Mono", monospace'; c2.textBaseline = "middle";
      const w1 = Math.round(c2.measureText(head).width), w2 = Math.round(c2.measureText(c.small).width), x = Math.round(320 - (22 + w1 + w2) / 2), y = 34 + Math.max(0, 6 - Math.floor(ms / 30)); // y: the label's middle; pops up 6px
      c2.fillStyle = "#fff"; ICON[c.icon].forEach((r, j) => [...r].forEach((ch, i) => { if (ch === "#") c2.fillRect(x + i * 2, y - 8 + j * 2, 2, 2); }));
      fx.text(head, x + 22, y, 16, "#ff0", "left", "DTM-Mono"); fx.text(c.small, x + 22 + w1, y, 16, "#fff", "left", "DTM-Mono");
      c2.restore();
    });
  },
};
