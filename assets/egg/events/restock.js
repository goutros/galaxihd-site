/* Restock (rare): Galaxi "generously" tosses food into your ITEM button and skips his attack. It's a trap: the moment you open ITEM
   it's a GOTCHA and you're dropped straight into HIS inventory. The box becomes Minecraft's inventory screen (sprites/mc-inventory.png,
   undertale-ified from the 1.21.1 texture) unfolding out of the box, with Galaxi standing (and talking) in the player box and stack
   counts in Minecraft's font (sprites/mc-font.png). Your SOUL sits in a slot like an item and moves through the main inventory and the
   hotbar (arrows jump to the nearest slot that way; armour, offhand and crafting are scenery); a few food stacks are walls. His
   cursor (sprites/cursor.png) drags a stack across whole rows and columns, Ray of Death style: each lane flashes first (the TELL flash,
   a chevron hopping the way he'll drag), then he drag-splits it like Minecraft, dropping items into every empty slot it passes (that
   hurts), and double-clicks them all back. Every pattern is checked: a safe slot is in reach inside the tell. Twice he picks YOU up and drops you somewhere else. Anything thrown is the white
   UNDERTALE version (sprites/ut-*.png); the ITEM menu shows Minecraft's real colours (sprites/food-*.png). */
(window.GALAXI_EVENTS = window.GALAXI_EVENTS || {}).restock = {
  rare: .4,
  // the inventory fight's rules, pure (no canvas, no engine): the game and tools/train-inventory.js (which evolves Galaxi's drag patterns) share them
  model: (() => {
    const SL = [], put = (x, y) => SL.push([x + 8, y + 8]); // every slot's centre at 1x, by Minecraft's layout: main 0-26, hotbar 27-35, armour 36-39, offhand 40, crafting 41-44, result 45
    for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) put(8 + 18 * c, 84 + 18 * r);
    for (let c = 0; c < 9; c++) put(8 + 18 * c, 142);
    for (let r = 0; r < 4; r++) put(8, 8 + 18 * r);
    put(77, 62); put(98, 18); put(116, 18); put(98, 36); put(116, 36); put(154, 28);
    const PLAY = 36; // you move (and he drags) in the main inventory and hotbar only (0-35); armour, offhand and crafting are scenery
    const ROWS = [...[0, 1, 2].map(r => [...Array(9).keys()].map(c => r * 9 + c)), [...Array(9).keys()].map(c => 27 + c)]; // left to right
    const COLS = [...Array(9).keys()].map(c => [c, 9 + c, 18 + c, 27 + c]); // top to bottom (main into the hotbar)
    const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // left, right, up, down
    const NB = SL.map(([x, y], i) => DIRS.map(([dx, dy]) => { let best = null, bs = 1e9; // arrow keys: the nearest slot that way (like a controller in a menu)
      if (i < PLAY) SL.forEach(([u, v], j) => { if (j >= PLAY) return; const al = (u - x) * dx + (v - y) * dy, pe = Math.abs((u - x) * dy - (v - y) * dx); if (al > 2 && pe <= al * 1.6 && al + pe * 2 < bs) { bs = al + pe * 2; best = j; } }); return best; }));
    const mid = l => l.reduce((t, i) => [t[0] + SL[i][0] / l.length, t[1] + SL[i][1] / l.length], [0, 0]), far = (i, j) => Math.hypot(SL[i][0] - SL[j][0], SL[i][1] - SL[j][1]);
    const RS = [...ROWS].sort((p, q) => mid(p)[1] - mid(q)[1] || mid(p)[0] - mid(q)[0]), CS = [...COLS].sort((p, q) => mid(p)[0] - mid(q)[0] || mid(p)[1] - mid(q)[1]); // rows top to bottom, columns left to right
    // a gene: { tell, step (ms a slot as he sweeps, default T.step), lanes: [{ axis: "row" | "col", rel: -2..2 (rows/columns away), at: "me" | "ahead" (where you're heading), dir: "toward" | "away" | "random" }] }
    // -> the lanes to drag, where you are right now, each { cells (in drag order), h (a row) }
    const resolve = (gene, me, heading, random) => { const ahead = heading != null && NB[me][heading] != null ? NB[me][heading] : me, out = [];
      for (const g of gene.lanes) { const base = g.at === "ahead" ? ahead : me, list = g.axis === "row" ? RS : CS, l = list[list.findIndex(x => x.includes(base)) + g.rel];
        if (!l || out.some(o => o.src === l)) continue;
        const flip = g.dir === "random" ? random() < .5 : (far(l[0], me) < far(l.at(-1), me)) === (g.dir === "toward"); // toward: starts at the far end and comes at you
        out.push({ src: l, h: list === RS, cells: flip ? [...l].reverse() : l }); }
      return out; };
    // the timing of one drag (game ms, before Galaxi's pace P): the lanes flash for `tell`, then he steps 45ms a slot, 150ms between lanes; 380ms later he collects
    const T = { pace: 1.2, move: 200, step: 45, between: 150, collect: 380, after: 200, hurt: 80 }; // pace: Galaxi's (P, everything 20% slower); move: ms a player needs per slot moved
    // the food maze: `level` decides how many stacks block your way. Never on you or next to you; easy/normal keep every slot reachable, hard can seal off a few
    const LEVELS = { easy: 3, normal: 6, hard: 10 }, level = random => { const r = random(); return r < .3 ? "easy" : r < .7 ? "normal" : "hard"; };
    const maze = (lv, me, random) => { const n = LEVELS[lv]; let w;
      for (let tries = 0; tries < 60; tries++) { w = new Set(); while (w.size < n) { const i = Math.floor(random() * PLAY); if (i !== me && !NB[me].includes(i)) w.add(i); }
        const seen = new Set([me]), q = [me]; while (q.length) { const i = q.shift(); for (const j of NB[i]) if (j !== null && !seen.has(j) && !w.has(j)) { seen.add(j); q.push(j); } }
        if (seen.size >= PLAY - n - (lv === "hard" ? 4 : 0)) break; }
      return w; };
    const RESHUFFLE = [4, 8]; // he reshuffles his inventory (a new maze) before these moves
    // ---- Galaxi's full control: every move ("gene") becomes one exact timeline, played by the game and simulated by the trainer ----
    // { kind: "drag", tell, step, lanes }            lanes (see resolve), drag-split: an item into every empty slot he passes (hurts)
    // { kind: "path", tell, step, shape, at, dir }   a freeform drag: "ring" (round you), "L" (along your row, then your column), "snake" (zigzag down your row and the next)
    // { kind: "drop", tell, shape }                  stacks slammed down all at once: "me", "ahead", "both", "plus", "x"
    // { kind: "wall", n }                            herding: he moves n food stacks onto your open sides (never sealing you in)
    // { kind: "shuffle", level }                     a new maze ("easy" / "normal" / "hard")
    // { kind: "grab" }                               he picks you up and drops you somewhere roomy, far away
    const rc = i => i < 27 ? [Math.floor(i / 9), i % 9] : [3, i - 27], id = (r, c) => r < 0 || r > 3 || c < 0 || c > 8 ? null : r < 3 ? r * 9 + c : 27 + c; // the play area is a 4x9 grid (row 3: the hotbar)
    const span = (a, b) => { const o = []; for (let x = a; ; x += Math.sign(b - a) || 1) { o.push(x); if (x === b) return o; } };
    const reachFrom = (me, walls) => { const d = new Map([[me, 0]]), q = [me]; while (q.length) { const i = q.shift(); for (const j of NB[i]) if (j !== null && !d.has(j) && !walls.has(j)) { d.set(j, d.get(i) + 1); q.push(j); } } return d; };
    const aheadOf = (me, heading) => heading != null && NB[me][heading] != null ? NB[me][heading] : me;
    const orient = (cells, me, dir, random) => { const flip = dir === "random" ? random() < .5 : (far(cells[0], me) < far(cells.at(-1), me)) === (dir === "toward"); return flip ? [...cells].reverse() : cells; };
    const shape = (g, me, heading, random) => { const [r, c] = rc(g.at === "ahead" ? aheadOf(me, heading) : me); let cells;
      if (g.shape === "ring") { cells = [[-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1]].map(([a, b]) => id(r + a, c + b)); const k = Math.floor(random() * 8); cells = [...cells.slice(k), ...cells.slice(0, k)]; }
      else if (g.shape === "L") cells = [...span(c < 4 ? 8 : 0, c).map(x => id(r, x)), ...span(r, r < 2 ? 3 : 0).slice(1).map(y => id(y, c))];
      else { const r2 = r < 3 ? r + 1 : r - 1; cells = []; for (let x = 0; x < 9; x++) cells.push(...(x % 2 ? [id(r2, x), id(r, x)] : [id(r, x), id(r2, x)])); }
      cells = cells.filter(x => x !== null); return g.shape === "ring" ? cells : orient(cells, me, g.dir, random); };
    const drops = (g, me, heading) => { const [r, c] = rc(me), a = aheadOf(me, heading);
      return ({ me: [me], ahead: [a], both: [me, a], plus: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]].map(([x, y]) => id(r + x, c + y)), x: [[0, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, y]) => id(r + x, c + y)) }[g.shape] || [me]).filter((x, k, l) => x !== null && l.indexOf(x) === k); };
    const plan = (g, st, random) => { const P = T.pace, k = g.kind || "drag", out = { kind: k, lanes: [], visits: [], lands: [], temp: new Map(), adds: [], removes: [], teleport: null, collect: 0, end: 0 };
      if (k === "drag" || k === "path" || k === "drop") {
        let lanes = k === "drag" ? resolve(g, st.me, st.heading, random).map(l => l.cells) : k === "path" ? [shape(g, st.me, st.heading, random)] : [drops(g, st.me, st.heading)], drop = k === "drop";
        const D = new Set(lanes.flat()), d = reachFrom(st.me, st.walls); // fair: a slot outside the danger in reach inside the tell, else a main row you're not on
        if (!D.size || ![...d.keys()].some(i => !D.has(i) && d.get(i) <= Math.floor(g.tell * P / T.move))) { lanes = [ROWS[(Math.floor(st.me / 9) + 1) % 3]]; drop = false; out.kind = "drag"; }
        out.lanes = lanes; let t = g.tell * P;
        lanes.forEach((l, j) => { if (j) t += T.between * P;
          for (const c of l) { if (!drop) t += (g.step ?? T.step) * P; out.visits.push([c, t]); if (st.walls.has(c) || out.temp.has(c)) continue; out.lands.push([c, t]); out.temp.set(c, t); } });
        out.collect = t + T.collect * P; out.end = out.collect + T.after * P;
      } else if (k === "wall") { let t = 0; const w = new Set(st.walls), open = NB[st.me].filter(j => j !== null && !w.has(j)).sort(() => random() - .5);
        for (const c of open.slice(0, Math.min(g.n || 1, open.length - 1))) { w.add(c); if (reachFrom(st.me, w).size < 8) { w.delete(c); continue; } // never sealing you in
          if (w.size > LEVELS.hard) { const old = [...w].filter(x => x !== c && !NB[st.me].includes(x)).sort((x, y) => far(y, st.me) - far(x, st.me))[0]; if (old != null) { w.delete(old); out.removes.push([old, t + 120 * P]); } } // a far stack moves over
          t += 300 * P; out.adds.push([c, t]); }
        out.end = t + 200 * P;
      } else if (k === "shuffle") { const w = [...maze(g.level || "normal", st.me, random)]; st.walls.forEach(c => out.removes.push([c, 300 * P]));
        w.forEach((c, i) => out.adds.push([c, (550 + 40 * i) * P])); out.end = (550 + 40 * w.length + 250) * P;
      } else { const spots = [...Array(PLAY).keys()].filter(i => !st.walls.has(i) && far(i, st.me) > 55 && reachFrom(i, st.walls).size >= 6); // grab
        out.teleport = { to: spots.length ? spots[Math.floor(random() * spots.length)] : st.me, lift: 670 * P, at: 1090 * P }; out.end = 1190 * P; }
      return out; };
    const wallAt = (pl, st, c, t) => { let w = st.walls.has(c); for (const [x, at] of pl.removes) if (x === c && at <= t) w = false; for (const [x, at] of pl.adds) if (x === c && at <= t) w = true; return w; }; // a wall at time t during a plan
    const wallsAfter = (pl, st) => { const w = new Set(st.walls); pl.removes.forEach(([c]) => w.delete(c)); pl.adds.forEach(([c]) => w.add(c)); return w; };
    return { SL, PLAY, ROWS, COLS, DIRS, NB, resolve, T, LEVELS, level, maze, RESHUFFLE, plan, wallAt, wallsAfter };
  })(),
  start(ctx, fx) {
    const FOODS = [["apple", "Apple"], ["bread", "Bread"], ["porkchop", "Cooked Porkchop"], ["cookie", "Cookie"], ["melon", "Melon Slice"],
      ["potato", "Baked Potato"], ["cake", "Cake"], ["steak", "Steak"], ["pie", "Pumpkin Pie"]];
    const items = fx.player.items, n = Math.max(2, 6 - items.length); // the ITEM list fits 6
    const fakes = FOODS.sort(() => Math.random() - .5).slice(0, n).map(([s, name]) => ({ name, heal: 6 + Math.floor(Math.random() * 6), sprite: "food-" + s, trap: true }));
    const btn = fx.buttons.find(b => b.t === "ITEM") || fx.buttons[2];
    const food = (c, s, x, y) => { const im = fx.sprite(s.replace("food-", "ut-")); if (im.naturalWidth) { c.imageSmoothingEnabled = false; c.drawImage(im, Math.round(x - 16), Math.round(y - 16), 32, 32); } };
    fakes.forEach(f => { fx.sprite(f.sprite); fx.sprite(f.sprite.replace("food-", "ut-")); }); fx.sprite("ut-cake"); fx.sprite("ut-cookie"); // load them now

    // the toss: food arcs from Galaxi into the ITEM button, which bumps as each one lands
    let tossAt = -1, landed = 0;
    fx.lines([
      one("You look hungry.", "You look like you skip breakfast.", "When did you last eat? Be honest."),
      { text: one("Here, have some snacks.", "Free food. Don't make it weird.", "Catch!"), at: () => { tossAt = -2; } },
      one("...On the house.", "I'm skipping my turn. That's how nice I am.", "Eat up. I insist."),
    ]);
    fx.attack(a => a.after(150, () => a.end()), { box: [565, 130], time: 400, solo: true }); // no attack this turn: that's the bait
    fx.draw((c, ms) => {
      if (tossAt === -2) tossAt = ms; if (tossAt < 0) return;
      const to = [btn.x + btn.w / 2, btn.y + 10];
      fakes.forEach((f, i) => { const k = (ms - tossAt - i * 140) / 520; if (k < 0) return;
        if (k >= 1) { if (landed <= i) { landed = i + 1; fx.sfx.move(); btn.dy = -6; } return; }
        food(c, f.sprite, 320 + (to[0] - 320) * k, 150 + (to[1] - 150) * k - Math.sin(k * Math.PI) * 120); });
      btn.dy = Math.min(0, (btn.dy || 0) + 1); // the bump settles
      const last = ms - tossAt - (fakes.length - 1) * 140 - 520; // a "+N" over the button once they're all in
      if (last > 0 && last < 1400) { c.globalAlpha *= Math.min(1, (1400 - last) / 300); fx.text(`+${fakes.length}`, to[0] + 40, btn.y - 8 - Math.min(16, last / 20), 26, "#0f0", "center", "DTM-Sans"); }
    }, { menu: true });
    items.push(...fakes);
    fx.flavor(one("* Your pockets smell like a bakery now.", "* Galaxi gave you free food. Suspiciously nice of him.", "* You got free food. From Galaxi. Huh."));

    // the trap: opening ITEM costs your turn and starts this instead
    const OY = 50; let fxt = null; // OY: how far up the box sits, so the inventory screen (352x332) clears the HP line
    fx.onPick("ITEM", (ctx2, fx2) => {
      for (let i = items.length - 1; i >= 0; i--) if (items[i].trap) items.splice(i, 1); // the fake food is gone either way
      fxt = fx2; let lifted = false; // the box eases up while it shrinks
      fx2.draw((c, ms) => { if (lifted) return; fx2.box.oy = -OY * Math.min(1, ms / 220); lifted = ms >= 220; });
      fx2.after(r => { fx2.mods.hideFoe = false; fx2.mods.bubbleAt = null; return r.hits === 0 ? { // however it ended (folded back, or cut off by the time cap): he's back to normal
        lines: one(["...Did you just speedrun my inventory?"], ["Not even one hit?", "You'd be great at sorting chests."], ["Okay, inventory Tetris champion."]) } : {}; });
      fx2.lines([{ text: one("Gotcha!", "Food fight!", "Did you really think it was FREE?"), shake: true, go: true, at: () => fx2.sfx.shatter() }]); // GOTCHA: straight in, no Z
      fx2.flavor(one("* You feel awfully cubic...", "* You got dragged around a Minecraft inventory. Your real items are fine.", "* You'll never trust free food again."));
      fx2.mods.soulSpeed = 0; // the SOUL only moves slot to slot (the attack moves it)
      fx2.attack(inventory, { box: [324, 108], time: 32000, solo: true });
    });

    function inventory(a) {
      const B = a.box, S = 36, P = GALAXI_EVENTS.restock.model.T.pace; // Galaxi's pace (see model.T)
      const IX = B.left - 14, IY = B.top - 166; // Minecraft's inventory screen (176x166, drawn 2x): its 9x3 grid lines up with the box
      // every slot on the screen, by Minecraft's layout (item top-left at 1x): main 0-26, hotbar 27-35, armour 36-39, offhand 40, crafting 41-44, result 45
      const M = GALAXI_EVENTS.restock.model, SL = M.SL.map(([x, y]) => [IX + 2 * x, IY + 2 * y]), N = SL.length, slot = i => SL[i], ROWS = M.ROWS, NB = M.NB; // every slot on the screen (see model)
      const DIRS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].map((k, d) => [k, ...M.DIRS[d]]);
      const UT = fakes.map(f => f.sprite.replace("food-", "ut-")), slots = Array(N).fill(null), counts = Array(N).fill(0), landed = Array(N).fill(-1e9), wait = ms => new Promise(go => a.after(ms * P, go));
      let me = 13, heading = null, held = false, track = false, rep = 0, now = 0, open = 0, closing = false, flying = []; // me: the SOUL's slot; held: he's carrying it; open: 0 = just the box, 1 = the whole screen; flying: stacks being collected
      const cur = { x: B.right + 40, y: B.top - 40, tx: B.right + 40, ty: B.top - 40, item: null, n: 0 }; // his cursor and what it carries
      const lay = w => [...w].forEach((i, k) => { slots[i] = UT[k % UT.length]; counts[i] = 8 + Math.floor(a.random(0, 57)); landed[i] = now; }); // food walls
      lay(M.maze(M.level(() => a.random(0, 1)), me, () => a.random(0, 1)));

      // Minecraft's font (sprites/mc-font.png: the ascii sheet, 8x8 cells) with its drop shadow, 2x
      const MCW = "41355551333515155555555555114545655555555355555555555555555353552555554551542555555535555553136"; // glyph widths, chars 32-126
      const shade = document.createElement("canvas"); shade.width = shade.height = 128; let shaded = false;
      const mcText = (c, str, x, y, right = false) => { // y: top of the glyphs; right: x is the right edge
        const font = fx.sprite("mc-font"); if (!font.naturalWidth) return;
        if (!shaded) { const g = shade.getContext("2d"); g.drawImage(font, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = "#3f3f3f"; g.fillRect(0, 0, 128, 128); shaded = true; } // the shadow copy
        const adv = ch => ((+MCW[ch.charCodeAt(0) - 32] || 5) + 1) * 2, w = [...str].reduce((t, ch) => t + adv(ch), 0) - 2;
        let cx = Math.round(right ? x - w : x);
        for (const ch of str) { const k = ch.charCodeAt(0), sx = (k % 16) * 8, sy = Math.floor(k / 16) * 8;
          c.drawImage(shade, sx, sy, 8, 8, cx + 2, y + 2, 16, 16); c.drawImage(font, sx, sy, 8, 8, cx, y, 16, 16); cx += adv(ch); } };
      const count = (c, n, x, y) => { if (n > 1) mcText(c, String(n), x + 18, y + 2, true); }; // bottom-right of the slot, like Minecraft
      const sprite = (c, s, x, y, k = 2) => { const im = fx.sprite(s); if (im.naturalWidth) c.drawImage(im, Math.round(x - 8 * k), Math.round(y - 8 * k), 16 * k, 16 * k); };

      // the screen: unfolds out of the box (its 9x3 grid) and folds back at the end; Galaxi in the player box
      a.bullet({ x: 0, y: 0, w: 1, h: 1, damage: 0, z: -2, clip: false, draw(c) {
        c.imageSmoothingEnabled = false;
        const dy = a.box.top - B.top, k = 1 - (1 - open) ** 3, lr = (p, q) => Math.round(p + (q - p) * k); // dy: the box easing back down at the end
        c.save(); c.beginPath(); c.rect(lr(B.left, IX), lr(B.top + dy, IY + dy), lr(324, 352), lr(108, 332)); c.clip();
        const inv = fx.sprite("mc-inventory"); if (inv.naturalWidth) c.drawImage(inv, IX, IY + dy, 352, 332);
        const gal = fx.sprite("../../galaxi-idle"); // him, 1x (the biggest whole size that fits), centred in the player box
        if (gal.naturalWidth) c.drawImage(gal, Math.round(IX + 102 - gal.naturalWidth / 2), Math.round(IY + dy + 86 - gal.naturalHeight / 2));
        mcText(c, "Crafting", IX + 194, IY + dy + 16); // where Minecraft puts its title (97, 8)
        const hover = !closing && (cur.item || track) ? SL.findIndex(([x, y]) => Math.abs(cur.x - x) <= 18 && Math.abs(cur.y - y) <= 18) : -1;
        for (let i = 0; i < N; i++) { const [x, y] = slot(i);
          if (i === hover) { c.fillStyle = "rgba(255,255,255,.25)"; c.fillRect(x - 16, y - 16 + dy, 32, 32); } // Minecraft's hover highlight
          if (slots[i]) { sprite(c, slots[i], x, y + dy, now - landed[i] < 80 ? 3 : 2); count(c, counts[i], x, y + dy); } } // a placed item pops in
        c.restore();
      } });
      a.bullet({ x: 0, y: 0, w: 1, h: 1, damage: 0, z: 5, clip: false, draw(c) { // his cursor (sprites/cursor.png at 2x, tip = the hotspot), carrying a stack; collected stacks fly into it
        for (const f of flying) { const k = Math.min(1, (now - f.at) / 180); sprite(c, f.item, f.x + (cur.x - f.x) * k, f.y + (cur.y - f.y) * k); }
        if (cur.item) { sprite(c, cur.item, cur.x, cur.y); count(c, cur.n, cur.x, cur.y); }
        const im = fx.sprite("cursor"); if (im.naturalWidth) c.drawImage(im, Math.round(cur.x), Math.round(cur.y), im.naturalWidth * 2, im.naturalHeight * 2); } });
      a.every(16, () => { now += 16; flying = flying.filter(f => now - f.at < 180);
        open = closing ? Math.max(0, open - 16 / 260) : Math.min(1, open + 16 / 300);
        fxt.mods.hideFoe = open >= 1; // the screen covers him: only the one in the player box
        if (now > 1300 && !closing && !fxt.mods.bubbleAt) fxt.mods.bubbleAt = [IX + 166, IY + 40]; // after the Gotcha bubble: he talks from the player box
        if (track) [cur.tx, cur.ty] = slot(me);
        cur.x += (cur.tx - cur.x) * (cur.fast ? .6 : .25); cur.y += (cur.ty - cur.y) * (cur.fast ? .6 : .25);
        if (held) { a.soul.x = cur.x; a.soul.y = cur.y; return; }
        const tap = DIRS.findIndex(([k]) => a.tapped(k)), hold = DIRS.findIndex(([k]) => a.key(k)); let d = -1;
        if (tap >= 0) { d = tap; rep = 200; } else if (hold >= 0 && (rep -= 16) <= 0) { d = hold; rep = 110; } // one slot a tap; held, it repeats
        const to = d >= 0 ? NB[me][d] : null;
        if (to !== null && !slots[to]) { me = to; heading = d; } // food is a wall
        else if (d >= 0 && tap >= 0) { a.soul.x += DIRS[d][1] * 5; a.soul.y += DIRS[d][2] * 5; } // bonk
        const [x, y] = slot(me); a.soul.x += (x - a.soul.x) * .5; a.soul.y += (y - a.soul.y) * .5;
      });
      const go = i => { [cur.tx, cur.ty] = slot(i); };
      const flash = (i, ms) => { let t = 0; const [x, y] = slot(i); a.bullet({ x, y, w: S - 8, h: S - 8, damage: 0, tell: true, z: -1, clip: false, update(b, dt) { if ((t += dt) > ms) b.dead = true; },
        draw(c) { c.fillStyle = `rgba(255,255,255,${.12 + .3 * TELL(t % 360)})`; c.fillRect(-S / 2 + 3, -S / 2 + 3, S - 6, S - 6); } }); }; // flashes every 360ms

      // a lane's warning: Ray of Death's flash (TELL, every 360ms) on each of its slots, with a chevron marching the way he'll drag
      const chevron = (c, x, y, dx, dy) => { for (let i = -3; i <= 3; i++) { const f = (3 - Math.abs(i)) * 2; c.fillRect(Math.round(x + dx * f + dy * i * 2) - 1, Math.round(y + dy * f + dx * i * 2) - 1, 3, 3); } }; // a pixel ">" pointing (dx, dy)
      const warn = p => { let t = 0; const way = k => { const [ax, ay] = slot(p.cells[Math.max(0, k === p.cells.length - 1 ? k - 1 : k)]), [bx, by] = slot(p.cells[Math.min(p.cells.length - 1, k === p.cells.length - 1 ? k : k + 1)]); const dx = Math.sign(bx - ax); return [dx, dx ? 0 : Math.sign(by - ay)]; }; // the way he goes from slot k
        a.bullet({ x: 0, y: 0, w: 1, h: 1, damage: 0, z: -1, clip: false, update(b, dt) { t += dt; if (p.done) b.dead = true; },
          draw(c) { const v = .1 + .25 * TELL(t % 360), m = Math.floor(t / 120) % p.cells.length; // the chevron hops slot to slot along the lane
            p.cells.forEach((i, k) => { const [x, y] = slot(i); c.fillStyle = `rgba(255,255,255,${v})`; c.fillRect(x - 15, y - 15, 30, 30);
              if (k === m && !p.drop) { c.fillStyle = "rgba(255,255,255,.7)"; chevron(c, x, y, ...way(k)); } }); } });
        p.cells.forEach(i => a.bullet({ x: slot(i)[0], y: slot(i)[1], w: S - 8, h: S - 8, damage: 0, tell: true, clip: false, update(b) { if (p.done) b.dead = true; }, draw() {} })); }; // (tell boxes for tools/sim.html's bot)
      // one of Galaxi's moves, played exactly as the model times it (model.plan: the same timeline the trainer simulates)
      const LINES = { easy: one("Let me tidy up.", "Okay, cleaning up."), normal: one("Sorting time.", "Let me reorganize."), hard: one("Hoarder mode.", "I collect stuff, okay?") };
      async function perform(gene) {
        const walls = new Set([...Array(M.PLAY).keys()].filter(i => slots[i])), pl = M.plan(gene, { me, heading, walls }, () => a.random(0, 1)), at = (ms, fn) => a.after(ms, fn);
        const done = new Promise(r => at(pl.end, r));
        if (pl.lanes.length) { // drags, paths and drops: warn, then the cursor steps through, an item lands in every empty slot (hurts), then he double-clicks them back
          const item = UT[Math.floor(a.random(0, UT.length))], ps = pl.lanes.map(cells => ({ cells, drop: pl.kind === "drop" })), placed = [];
          ps.forEach(warn); cur.item = item; cur.n = 64;
          const [x0, y0] = slot(pl.lanes[0][0]), [x1, y1] = slot(pl.lanes[0][Math.min(1, pl.lanes[0].length - 1)]); cur.tx = x0 - Math.sign(x1 - x0) * 40; cur.ty = y0 - Math.sign(y1 - y0) * 40; // lines up just outside
          if (pl.kind === "drop") pl.visits.forEach(([c], k) => at(pl.visits[0][1] * k / pl.visits.length, () => go(c))); // drops: the cursor tours the targets during the tell
          else pl.visits.forEach(([c, t]) => at(t - (gene.step ?? M.T.step) * M.T.pace, () => { go(c); cur.fast = true; }));
          at(pl.visits[0][1] - (pl.kind === "drop" ? 0 : (gene.step ?? M.T.step) * M.T.pace), () => a.sfx.swing());
          pl.lands.forEach(([c, t]) => at(t, () => { if (slots[c]) return; slots[c] = item; counts[c] = Math.max(1, Math.floor(64 / pl.lands.length)); landed[c] = now; placed.push(c); a.sfx.move();
            let h = 0; const [x, y] = slot(c); a.bullet({ x, y, w: 26, h: 26, clip: false, update(b, dt) { if ((h += dt) > M.T.hurt) b.dead = true; }, draw() {} }); })); // landing on you hurts
          at(pl.lands.at(-1)?.[1] ?? pl.collect, () => { cur.fast = false; ps.forEach(p => { p.done = true; }); });
          at(pl.collect, () => { for (const c of placed) if (slots[c] === item) { const [x, y] = slot(c); flying.push({ item, x, y, at: now }); slots[c] = null; counts[c] = 0; } a.sfx.select(); });
          at(pl.end - 20, () => { cur.item = null; cur.n = 0; });
        } else if (pl.kind === "wall" || pl.kind === "shuffle") { // he moves stacks around: herding you, or a whole new maze
          if (pl.kind === "shuffle") a.say(LINES[gene.level || "normal"], 1100); else a.say(one("Blocked.", "Not that way.", "Nope. Wall."), 900);
          pl.removes.forEach(([c, t]) => { at(Math.max(0, t - 150), () => go(c)); at(t, () => { if (!slots[c]) return; const [x, y] = slot(c); flying.push({ item: slots[c], x, y, at: now }); slots[c] = null; counts[c] = 0; }); });
          if (pl.removes.length) at(pl.removes[0][1], () => a.sfx.select());
          pl.adds.forEach(([c, t]) => { at(Math.max(0, t - 120 * M.T.pace), () => { go(c); cur.item = UT[Math.floor(a.random(0, UT.length))]; cur.n = 8 + Math.floor(a.random(0, 57)); });
            at(t, () => { slots[c] = cur.item || UT[0]; counts[c] = cur.n || 16; landed[c] = now; cur.item = null; a.sfx.move(); }); });
        } else { // grab: the cursor locks onto you, the slot flashes, he lifts you and drops you somewhere roomy
          track = true; at(150 * M.T.pace, () => flash(me, 520 * M.T.pace));
          at(pl.teleport.lift, () => { track = false; held = true; a.play("assets/egg/sfx/grab.mp3", .6); a.say(one("Mine now.", "Shift-click!", "Let me just... sort you."), 1000); go(pl.teleport.to); });
          at(pl.teleport.at, () => { me = pl.teleport.to; heading = null; held = false; a.play("assets/egg/sfx/pullback.mp3", .4); });
        }
        await done;
      }
      const LEARNED = [{"kind":"shuffle","level":"hard"},{"kind":"drop","tell":220,"shape":"ahead"},{"kind":"drag","tell":670,"step":30,"lanes":[{"axis":"row","rel":0,"at":"me","dir":"away"}]},{"kind":"drop","tell":510,"shape":"both"},{"tell":200,"step":30,"lanes":[{"axis":"row","rel":-2,"at":"ahead","dir":"away"},{"axis":"col","rel":0,"at":"me","dir":"away"},{"axis":"row","rel":1,"at":"ahead","dir":"random"}]},{"kind":"wall","n":1},{"tell":200,"step":45,"lanes":[{"axis":"col","rel":0,"at":"me","dir":"away"}]},{"tell":200,"step":30,"lanes":[{"axis":"row","rel":-2,"at":"ahead","dir":"away"},{"axis":"col","rel":0,"at":"me","dir":"away"},{"axis":"row","rel":1,"at":"ahead","dir":"random"}]},{"kind":"shuffle","level":"normal"},{"tell":200,"step":60,"lanes":[{"axis":"col","rel":0,"at":"me","dir":"away"}]},{"tell":200,"step":30,"lanes":[{"axis":"row","rel":-2,"at":"ahead","dir":"away"},{"axis":"col","rel":0,"at":"me","dir":"away"}]},{"tell":200,"step":30,"lanes":[{"axis":"row","rel":-2,"at":"ahead","dir":"away"},{"axis":"col","rel":0,"at":"me","dir":"away"},{"axis":"row","rel":1,"at":"ahead","dir":"random"}]},{"tell":200,"step":45,"lanes":[{"axis":"col","rel":0,"at":"me","dir":"away"}]},{"tell":200,"step":30,"lanes":[{"axis":"row","rel":-2,"at":"ahead","dir":"away"},{"axis":"col","rel":0,"at":"me","dir":"away"}]}]; // Galaxi's moves, evolved by tools/train-inventory.js (2026-10-10, 1,200,000 runs: super 4.5 hits, good 6.6, casual 8.6, oracle 0 on 100 unseen boards)
      (async () => {
        await wait(400);
        a.say(one("Drag and drop!", "Watch your toes!", "Click and drag, baby!"), 1100);
        for (const [k, gene] of LEARNED.entries()) {
          if (k === Math.floor(LEARNED.length / 2)) a.say(one("Inventory management!", "So organized.", "Sorting time!"), 1000);
          await perform(gene);
        }
        await wait(300); closing = true; fxt.mods.bubbleAt = null; a.soul.hide = true; cur.tx = B.right + 60; cur.ty = B.top - 60; // his cursor leaves, the screen folds back into the box (he talks from his usual spot again)
        const raw = ms => new Promise(r => a.after(ms, r)); await raw(280);
        for (let t = 1; t <= 10; t++) { fxt.box.oy = -OY * (1 - t / 10); await raw(22); } // and the box eases back down
        a.end();
      })();
    }
  },
};
