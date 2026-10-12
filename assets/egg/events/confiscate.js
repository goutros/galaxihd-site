/* Item confiscation: Galaxi pulls one of your items out of the ITEM button (no hands, like he pulls your SOUL off the button in
   Lorem) and eats it in front of you. The item is its own menu text ("* Energy Drink", the ITEM menu's font and size): it pops out of
   the button and floats up beside his face while he says "Mine now.", then on "Gobble Gobble!" it slides to his mouth and he chomps it
   from the end in 3 bites, each with MINECRAFT's eating sound (drinks: the drinking sound) and MINECRAFT block particles made of the
   bitten-off letters (like the pfp breaking); a burp after. His heal shows above his head on the next line. */
(window.GALAXI_EVENTS = window.GALAXI_EVENTS || {}).confiscate = {
  can(ctx) { return ctx.player.items.length > 0; },
  start(ctx, fx) {
    const items = fx.player.items; if (!items.length) return;
    const item = items.splice(Math.floor(Math.random() * items.length), 1)[0], name = item.name, heal = item.heal || 0;
    const an = /^[aeiou]/i.test(name) ? "an" : "a", drink = item.drink || /drink|potion|milk|juice|soda|cola|tea|coffee/i.test(name), verb = drink ? "drank" : "ate";
    const MC = "assets/egg/mc/", BITE = drink ? [MC + "drink.mp3"] : [1, 2, 3].map(i => `${MC}eat${i}.mp3`);
    const btn = fx.buttons.find(b => b.t === "ITEM") || fx.buttons[2];
    const LABEL = "* " + name, FONT = '32px "DTM-Mono", monospace', HOLD = [290, 150], MOUTH = [316, 128]; // HOLD: where it's held up, its end by his face (right-aligned there); MOUTH: his mouth (the text's right end goes in)
    const ease = k => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); }, lerp = (a, b, k) => a + (b - a) * k;
    let phase = "idle", left = LABEL.length, bites = 0, lastT = 0; const parts = []; // left: letters not eaten yet
    const label = (c, x, y, n = left, align = "center") => { c.font = FONT; c.textBaseline = "middle"; c.textAlign = align; c.fillStyle = "#fff"; c.fillText(LABEL.slice(0, n), Math.round(x), Math.round(y)); };
    const width = (c, n) => { c.font = FONT; return c.measureText(LABEL.slice(0, n)).width; }, holdX = c => Math.max(HOLD[0], Math.ceil(width(c, LABEL.length)) + 16); // long names: held further right, never off the screen's left edge
    // MINECRAFT's block particles (as on the pfp, site.js): each shows a random 4x4 chunk of the "texture" (here: the letters just bitten
    // off), gravity .04 blocks/tick², drag .98 per tick, life 4 / (random * .9 + .1) ticks; 1 block = the text's height, 1 tick = 50ms
    const crumbs = (c, from, to, x, y) => { const w = Math.ceil(width(c, to) - width(c, from)) + 2, tex = document.createElement("canvas"); tex.width = w; tex.height = 36;
      const tc = tex.getContext("2d"); tc.font = FONT; tc.textBaseline = "middle"; tc.fillStyle = "#fff"; tc.fillText(LABEL.slice(from, to), 1, 18);
      const px = tc.getImageData(0, 0, w, 36).data, spots = []; for (let v = 0; v < 33; v += 2) for (let u = 0; u < w - 3; u += 2) if (px[((v + 2) * w + u + 2) * 4 + 3] > 0) spots.push([u, v]); // chunks with ink in them
      if (!spots.length) return; const B = 32;
      for (let i = 0; i < 14; i++) { const [u, v] = spots[Math.floor(Math.random() * spots.length)];
        parts.push({ x: x - Math.random() * 10, y: y + (Math.random() - .5) * 16, vx: (Math.random() * .25 - .05) * B, vy: -(.05 + Math.random() * .2) * B, B, u, v, tex,
          size: Math.round(4 + Math.random() * 4), life: 4 / (Math.random() * .9 + .1) * 50, age: 0 }); } };
    const drawParts = (c, t) => { const dt = Math.max(0, t - lastT) / 50; lastT = t; // in ticks
      for (const p of parts) { p.age += dt * 50; p.vy += .04 * p.B * dt; p.vx *= .98 ** dt; p.vy *= .98 ** dt; p.x += p.vx * dt; p.y += p.vy * dt; }
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].age >= parts[i].life) parts.splice(i, 1);
      for (const p of parts) c.drawImage(p.tex, p.u, p.v, 4, 4, Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size); };

    // cutscene 1: the item pops out of the ITEM button and floats up into the box
    const pull = () => { fx.play("assets/egg/sfx/grab.mp3", .7); fx.pause(1100, (c, t) => {
      c.save(); c.imageSmoothingEnabled = false;
      const bx = btn.x + btn.w / 2, by = btn.y + btn.h / 2;
      if (t < 120) btn.dy = -Math.round(6 * t / 120); else if (t < 400) btn.dy = Math.round(-6 * (1 - ease((t - 120) / 280)) * Math.cos((t - 120) / 35)); else btn.dy = 0; // the button jolts as it comes out
      if (t >= 120) { const k = ease((t - 120) / 800), x = lerp(bx, holdX(c) - width(c, LABEL.length) / 2, k), y = lerp(by, HOLD[1], k) - Math.sin(Math.min(1, (t - 120) / 800) * Math.PI) * 60; // an arc up out of the button
        label(c, x, y); if (t - 16 < 120) fx.sfx.select(); }
      if (t > 1000) phase = "held";
      c.restore();
    }); };

    // cutscene 2: to his mouth, chomped from the end in 3 bites, crumbs flying, then a burp
    const eat = () => { phase = "eat"; lastT = 0; const per = Math.ceil(LABEL.length / 3); fx.pause(1700, (c, t) => {
      c.save(); c.imageSmoothingEnabled = false;
      const k = ease(t / 300), right = lerp(holdX(c), Math.max(MOUTH[0], holdX(c)), k), y = lerp(HOLD[1], MOUTH[1], k); // slides over, its end at his mouth
      const b = Math.min(3, Math.floor(Math.max(0, t - 300) / 300)); // bites so far
      while (bites < b) { const from = Math.max(0, LABEL.length - (bites + 1) * per), to = left; bites++; fx.play(BITE[(bites - 1) % BITE.length], .9); fx.speak(); crumbs(c, from, to, MOUTH[0], MOUTH[1]); left = from; }
      if (left > 0) label(c, right, y, left, "right");
      if (t > 1300 && bites >= 3 && phase === "eat") { phase = "gone"; fx.play(MC + "burp.mp3", .8); }
      drawParts(c, t);
      c.restore();
    }); };

    const h = text => ({ text, at: () => { if (heal) fx.foeHeal(heal); } }); // his heal (green +n above his head) shows as he reacts, once the eating's done
    fx.lines([
      one(`Is that ${an} ${name}?`, `Ooh. ${name}.`, `Nice ${name} you got there.`),
      { text: one("Mine now.", "I'll take that.", "Confiscated."), at: pull },
      { text: "Gobble Gobble!", sound: V.gobblegobble, at: eat },
      name === "Energy Drink" ? one([h("I'm not addicted."), "YOU'RE the one who's addicted."], [h("I'm not addicted,"), "YOU'RE addicted."])
        : name === "Golden Carrot" ? one([h("Best food in the game."), "I'm not sharing."], [h("Golden Carrot."), "Peak food. Sorry."])
        : one([h("Needs salt."), "...You're welcome."], [h("Mm."), "That was supposed to be YOUR healing, huh?"], [h("Tastes like a nerd's inventory.")]),
    ]);
    fx.flavor(`* Galaxi took your ${name} and ${verb} it with his mouth wide open.`);
    fx.draw(c => { if (phase !== "held") return; c.save(); label(c, holdX(c), HOLD[1], left, "right"); c.restore(); }); // held up by his face while he says "Mine now."
  },
};
