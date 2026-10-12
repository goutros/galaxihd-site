/* Meta event: "GalaxiUT.exe (Not Responding)". Replaces the turn's attack. Galaxi glitches out (his sprite tears, a stuttering "errerr"
   of his own voice: sfx/glitch.mp3), then the attack box itself is the error window (UNDERTALE style: black, white border, grey title
   bar). Pick with Left/Right + Z (or tap a button).
   WAIT: it hangs, glitches and pops up again, up to 3 times; the third time it responds and a short lag-spike attack follows.
   CLOSE: the window falls, the screen goes black and GalaxiUT.exe reboots... as SANS (foe.flags.sans: his lines and blips from now on,
   boss.sansLines; sprite assets/egg/galaxi-sans.png once Galaxi has made it). He opens with SANS's genocide intro and then the genocide
   opener, 1:1 (boss.attacks.sansopener). Then Galaxi snaps out of it for four lines (still in SANS's voice and font), gets cut off,
   and SANS finishes: "always wondered why people never use their strongest attack first." */
(window.GALAXI_EVENTS = window.GALAXI_EVENTS || {}).crash = {
  can(ctx) { return ctx.attack !== "mario" && ctx.attack !== "lorem" && !ctx.foe.flags.sans; }, // mario's scrolling world and the lorem sneak turn don't take a swapped attack well; one reboot a fight
  start(ctx, fx) {
    const rnd = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    const tear = (c, seed, n, y0 = 0, y1 = 480) => { const k = c.canvas.width / 640; // bands of what's on the canvas copied sideways
      for (let i = 0; i < n; i++) { const h = 4 + 4 * Math.floor(rnd(seed + i * 5) * 4), y = y0 + 4 * Math.floor(rnd(seed + i * 3) * (y1 - y0 - h) / 4), dx = (rnd(seed + i * 9) < .5 ? -1 : 1) * (4 + 4 * Math.floor(rnd(seed + i * 7) * 10));
        c.drawImage(c.canvas, 0, y * k, 640 * k, h * k, dx, y, 640, h); } };
    const SANS = window.GALAXI_BOSS.sansVoice; // { voice, face }: SANS's text blip and font
    fx.attack(a => {
      const D = { x: 100, y: 148, w: 440, h: 236 }, BTN = [{ x: 116, y: D.y + 150, w: 200, h: 62, lines: ["Wait for the program", "to respond"] }, { x: 324, y: D.y + 150, w: 200, h: 62, lines: ["Close the program"] }];
      const GLITCH = 900, POP = 100, WAITMS = 1300; // Galaxi glitching, the window's outline popping in, how long a wait hangs
      let phase = "glitch", pick = 0, waits = 0, t0 = 0, done = false; // phase: glitch, choose, waiting, responding, drop, reboot
      const go = (p, m) => { phase = p; t0 = m.t; if (p === "glitch") fx.play("assets/egg/sfx/glitch.mp3", .9); };
      fx.play("assets/egg/sfx/glitch.mp3", .9);
      fx.modal((dt, input, m) => { const t = m.t - t0;
        if (phase === "glitch") { if (t >= GLITCH + POP) go("choose", m); return false; }
        if (phase === "choose") {
          for (const k of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "a", "d", "A", "D"]) if (input.tapped(k)) { pick = 1 - pick; fx.sfx.move(); break; }
          let chosen = -1; if (input.tap) BTN.forEach((b, i) => { const p = input.tap; if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) chosen = pick = i; });
          if (input.confirm) chosen = pick;
          if (chosen === 0) { fx.sfx.select(); waits++; go("waiting", m); }
          if (chosen === 1) { fx.sfx.select(); fx.sfx.crack(); go("drop", m); }
          return false; }
        if (phase === "waiting") { if (t >= WAITMS) go(waits >= 3 ? "responding" : "glitch", m); return false; } // hangs, then pops up again (3rd time: it responds)
        if (phase === "responding") { if (t >= 700) { done = "wait"; return true; } return false; }
        if (phase === "drop") { if (t >= 480) { go("reboot", m); fx.play("assets/egg/sans/cinematiccut.mp3", .8, 1.4); } return false; }
        if (phase === "reboot") { if (t >= 2200) { done = "close"; return true; } return false; }
        return false;
      }, (c, mt) => { const t = mt - t0; c.save(); c.imageSmoothingEnabled = false;
        if (phase === "glitch" && t < GLITCH) { // Galaxi glitching out: his sprite tears and flickers, the odd band across the whole screen
          const seed = Math.floor(t / 45) * 11 + waits * 101 + 1; tear(c, seed, 9, 40, 216); tear(c, seed + 50, 2);
          if (Math.floor(t / 90) % 3 === 1) { c.globalCompositeOperation = "difference"; c.fillStyle = "#fff"; c.fillRect(230, 40 + 4 * Math.floor(rnd(seed) * 30), 180, 8 + 4 * Math.floor(rnd(seed + 1) * 8)); c.globalCompositeOperation = "source-over"; }
          c.restore(); return; }
        if (phase === "reboot") { // the reboot: black, a line of boot text, a dotted bar
          c.fillStyle = "#000"; c.fillRect(0, 0, 640, 480);
          if (t > 500) fx.text("Restarting GalaxiUT.exe" + ".".repeat(1 + Math.floor(t / 300) % 3), 320, 230, 24, "#fff", "center", "DTM-Mono");
          if (t > 800) { c.fillStyle = "#fff"; for (let i = 0; i < Math.min(16, Math.floor((t - 800) / 80)); i++) c.fillRect(192 + i * 16, 256, 12, 12); }
          c.restore(); return; }
        if (phase === "glitch") { c.strokeStyle = "#fff"; c.lineWidth = 3; c.strokeRect(D.x + 1.5, D.y + 1.5, D.w - 3, D.h - 3); c.restore(); return; } // the outline pops in first
        const drop = phase === "drop" ? Math.round((t / 480) ** 2 * 420 / 4) * 4 : 0; c.translate(0, drop); // closing: the window falls
        c.fillStyle = "#000"; c.fillRect(D.x, D.y, D.w, D.h);
        c.fillStyle = "#c0c0c0"; c.fillRect(D.x, D.y, D.w, 32);
        fx.text(phase === "responding" ? "GalaxiUT.exe" : "GalaxiUT.exe (Not Responding)", D.x + 10, D.y + 23, 20, "#000", "left", "DTM-Sans");
        c.fillStyle = "#000"; c.fillRect(D.x + D.w - 30, D.y + 5, 22, 22); fx.text("X", D.x + D.w - 19, D.y + 23, 18, "#fff", "center", "DTM-Sans");
        c.strokeStyle = "#fff"; c.lineWidth = 3; c.strokeRect(D.x + 1.5, D.y + 1.5, D.w - 3, D.h - 3);
        if (phase === "waiting" || phase === "responding") {
          const ok = phase === "responding";
          fx.text(ok ? "GalaxiUT.exe is responding." : "Waiting for GalaxiUT.exe" + ".".repeat(1 + Math.floor(t / 250) % 3), D.x + D.w / 2, D.y + 110, 22, "#fff", "center", "DTM-Mono");
          const bw = 300, f = ok ? 1 : Math.min(.94, t / WAITMS), bx = D.x + (D.w - bw) / 2; // it never quite finishes, until it does
          c.strokeStyle = "#fff"; c.lineWidth = 3; c.strokeRect(bx + 1.5, D.y + 140.5, bw - 3, 24);
          c.fillStyle = "#fff"; for (let i = 0; i < Math.floor(f * 18); i++) c.fillRect(bx + 6 + i * 16, D.y + 145, 12, 14);
        } else {
          const ic = fx.sprite("crash-icon"); // sprites/crash-icon.png (44x44)
          if (ic.naturalWidth) c.drawImage(ic, D.x + 22, D.y + 52); else { c.fillStyle = "#fff"; c.fillRect(D.x + 22, D.y + 52, 44, 44); }
          fx.text("GalaxiUT.exe is not responding.", D.x + 78, D.y + 72, 20, "#fff", "left", "DTM-Mono");
          fx.text(waits ? "Still not responding. Probably a lag spike." : "The fight may be frozen. Probably a lag spike.", D.x + 78, D.y + 98, 14, "#bbb", "left", "DTM-Mono");
          if (waits) fx.text(`(Waited ${waits}x)`, D.x + 78, D.y + 118, 14, "#888", "left", "DTM-Mono");
          BTN.forEach((b, i) => { const sel = pick === i; c.fillStyle = "#000"; c.fillRect(b.x, b.y, b.w, b.h);
            c.strokeStyle = sel ? "#ff0" : "#fff"; c.lineWidth = 3; c.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3);
            b.lines.forEach((s, j) => fx.text(s, b.x + b.w / 2 + 10, b.y + b.h / 2 + 6 + (j - (b.lines.length - 1) / 2) * 20, 18, sel ? "#ff0" : "#fff", "center", "DTM-Sans"));
            if (sel && phase === "choose") fx.heart(b.x + 18, b.y + b.h / 2); });
        }
        c.restore();
      });

      // once the window's gone: what happens next
      let started = false;
      a.bullet({ x: 0, y: 0, w: 1, h: 1, damage: 0, clip: false, draw() {}, update(b) { if (started || !done) return; started = true; b.dead = true; done === "wait" ? waitAttack() : reboot(); } });

      // ---- WAIT (3 times): it responds, then a short lag-spike attack (stars that freeze, then drop) ----
      function waitAttack() {
        fx.flavor(one("* GalaxiUT.exe recovered. Mostly.", "* The lag spike passed. Galaxi is fine. Probably.", "* Galaxi stopped buffering."));
        a.resize(260, 170); a.say(one("Oh. There we go.", "Back. Did you miss me?", "Sorry. Buffering."), 1600);
        for (let i = 0; i < 6; i++) a.after(900 + i * 650, () => { const B = a.box; let t = 0;
          a.bullet({ x: Math.max(B.left + 10, Math.min(B.right - 10, a.soul.x + a.random(-24, 24))), y: B.top - 14, w: 15, h: 15, image: "star", spin: .08, damage: 3, tell: true,
            update(b, dt) { t += dt; const phase = t % 760; b.tell = phase < 360; b.vy = phase < 360 ? 0 : 6.5; if (b.y > B.bottom + 20) b.dead = true; } }); });
        a.after(5800, () => a.end());
      }

      // ---- CLOSE: he reboots as SANS: the genocide intro, the genocide opener, "huh." ----
      function reboot() {
        fx.foe.flags.sans = true; a.setSprite("assets/egg/galaxi-sans.png");
        fx.flavor("* You feel like you're going to have a bad time."); // (SANS's own line)
        a.resize(160, 160);
        // a line ending in "-" is cut off: it's only up a moment once typed
        const lines = (list, then) => { let at = 400; for (const l of list) { const cut = l.endsWith("-"), ms = 900 + l.length * 33; a.after(at, () => a.say(l, cut ? 120 : 900, false, SANS)); at += cut ? l.length * 33 + 120 : ms + 250; } a.after(at, then); };
        lines(["it's a beautiful day outside.", "birds are singing, flowers are blooming...", "on days like these, kids like you...", "Should be burning in hell."], () => {
          window.GALAXI_BOSS.attacks.sansopener(Object.create(a, { end: { value: () => {
            // Galaxi snaps out of it for a moment (his own sprite, still SANS's voice and font: Galaxi's lines), then it pulls him back under
            a.setSprite(window.GALAXI_BOSS.sprite);
            lines(["huh...", "wait, that wasn't my move", "what was that", "sorry I'm back now-"], () => {
              fx.play("assets/egg/sfx/glitch.mp3", .9); a.quake(4); a.setSprite("assets/egg/galaxi-sans.png");
              lines(["always wondered why people never use their strongest attack first."], () => a.end()); }); } } }));
        });
      }
    }, { box: [440, 236], time: 90000, solo: true });
  },
};
