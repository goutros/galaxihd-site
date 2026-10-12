/* Demonetized: this attack isn't ad friendly, so you have to bleep yourself. Your heart beats with the battle music (boss.musicBpm, locked to where the song is; a copy of it swells and fades
   on every beat); on every 4th beat press Z / Enter / Space and a black censor bar covers the heart's "mouth" with a quiet bleep.
   Miss the 4th beat (no press within WINDOW ms of it) and you take 1 HP and he yells. The first bar is free, to catch the rhythm.
   A yellow pixel $ and "BLEEP ON 4!" pop up above his head. Lines marked draft are Claude's for Galaxi to polish. */
(window.GALAXI_EVENTS = window.GALAXI_EVENTS || {}).demonetized = {
  can(ctx) { return ["blasters", "kablooey", "comments", "pokeball", "theworld"].includes(ctx.turn && ctx.turn.attack); }, // free-moving hearts only (Mario jumps on Z, Sonic has its own controls)
  start(ctx, fx) {
    const BOSS = window.GALAXI_BOSS, BPM = BOSS.musicBpm || 145, B0 = BOSS.musicBeat0 || 0, BEAT = 60000 / BPM, WINDOW = 120, BAR = 4; // on the music's beat (0.41s); press within 120ms either side of the 4th
    const DOLLAR = ["..yyyy..", ".yyyyyy.", "yyykyyyy", "yykkkkyy", "yykyyyyy", "yykkkkyy", "yyyyykyy", "yykkkkyy", ".yykyyy.", "..yyyy.."]; // the yellow $ (k = cut-out)
    fx.lines(one(["Wait, this next part isn't ad friendly.", "So you're gonna have to bleep yourself.", "Every fourth beat. Don't miss."], // draft
      ["Uh oh. YouTube's watching.", "Bleep yourself on the beat, okay?", "Every fourth one. Z, Enter, whatever."], // draft
      ["This attack is getting demonetized...", "Unless you bleep it.", "On the fourth beat. Keep up."])); // draft
    fx.flavor(one("* You bleeped yourself on beat. Mostly.", "* The attack was censored for advertisers.", "* Your heart kept the beat. YouTube was not impressed.")); // draft
    let A = null, pops = [], bar = 0, called = -1e9; // pops: [{ x, y, t, big }] the heartbeat copies; bar: ms the censor bar has left
    fx.during(a => { A = a; let t = 0, last = null, n = 0, judged = -1;
      a.bullet({ x: 0, y: 0, w: 1, h: 1, damage: 0, clip: false, draw() {},
        update(b, dt) { t += dt;
          const pos = a.songPos(), sb = pos == null ? t / BEAT : (pos - B0) * BPM / 60, fl = Math.floor(sb), ph = sb - fl, q = k => ((k % BAR) + BAR) % BAR; // where in the song we are, in beats (the sim has no music: game time)
          if (fl !== last) { if (last !== null) { n++; pops.push({ x: a.soul.x, y: a.soul.y, t: 0, big: q(fl) === BAR - 1 }); } last = fl; } // a beat: the heart pulses (bigger on the 4th)
          if (a.tapped("z")) { const near = ph < .5 ? fl : fl + 1, id = ph < .5 ? n : n + 1; // the nearest beat to the press
            if (q(near) === BAR - 1 && id >= BAR * 2 && (ph < .5 ? ph : 1 - ph) * BEAT <= WINDOW && judged < id) { judged = id; bar = 380; a.play("assets/egg/sfx/bleep.mp3", .35); } } // on the 4th: bleeped
          if (q(fl) === BAR - 1 && n >= BAR * 2 && judged < n && ph * BEAT > WINDOW) { judged = n; a.damage(1); // missed the bleep
            if (t - called > 3000) { called = t; a.say(one("You missed the bleep!", "BLEEP! You had one job!", "That's not ad friendly!"), 1200); } } // draft
          pops.forEach(p => p.t += dt); pops = pops.filter(p => p.t < 350); bar = Math.max(0, bar - dt); } });
    });
    fx.draw((c, ms) => {
      if (A && !A.soul.hide) {
        for (const p of pops) { const k = p.t / 350; c.save(); c.globalAlpha = .6 * (1 - k); c.translate(A.soul.x, A.soul.y); c.scale(1 + k * (p.big ? 1.4 : .8), 1 + k * (p.big ? 1.4 : .8)); fx.heart(0, 0); c.restore(); } // the beat: a copy swells and fades
        if (bar) { c.fillStyle = "#000"; c.fillRect(Math.round(A.soul.x) - 6, Math.round(A.soul.y) - 1, 12, 4); } // the censor bar over its "mouth"
      }
      c.save(); c.imageSmoothingEnabled = false; c.font = '16px "DTM-Mono", monospace'; c.textBaseline = "middle"; // the pop-up above his head: yellow $ + BLEEP ON 4!, centred on him
      const tw = Math.round(c.measureText("BLEEP ON 4!").width), x = Math.round(320 - (20 + tw) / 2), y = 24 + Math.max(0, 6 - Math.floor(ms / 30)); // pops up 6px as it appears
      DOLLAR.forEach((row, j) => [...row].forEach((p, i) => { if (p === ".") return; c.fillStyle = p === "y" ? "#ff0" : "#000"; c.fillRect(x + i * 2, y + j * 2, 2, 2); }));
      fx.text("BLEEP ON 4!", x + 20, y + 10, 16, "#ff0", "left", "DTM-Mono");
      c.restore();
    });
  }
};
