/* Box grab: two of Galaxi's hands come in from the sides of the screen, grab the dodge box by its left and right edges (thunk + shake),
   drag it around, put it back, let go and slide back out. No arms: just the hands.
   The hand is sprites/hand.png (16x17, drawn 4x; pixel 9,12 = grab point, wrist at the top), turned a quarter so the fingers point
   into the box; the right hand is the left one mirrored.
   Engine wishes: an attack-end hook with the real end time (we time the ease-back off turn.time; if the attack ends early the engine snaps the box
   to 0, so we only pull the hand away from where it was), and fx.box.w / fx.box.h (we read the size from ctx.turn.box). */
(window.GALAXI_EVENTS = window.GALAXI_EVENTS || {}).boxgrab = {
  can(ctx) { return ["pokeball", "blasters", "kablooey", "theworld"].includes(ctx.attack); },
  start(ctx, fx) {
    fx.lines(one(["This box is in my way."], ["Let me just...", "move this."], ["Hold on.", "This box is annoying me."]));
    fx.flavor(one("* Galaxi put the box back. Roughly where it was.", "* The box is back. Galaxi pretends nothing happened.", "* Galaxi let go. The box is slightly less square now."));
    const bw = (ctx.turn.box || [240, 170])[0], bh = (ctx.turn.box || [240, 170])[1];
    const total = ctx.turn.time || 9000, GRAB = 600, RAMP = 900, BACK = 900, LIFT = 400, SHAKE = 200, backAt = Math.max(GRAB + RAMP, total - LIFT - BACK);
    const lo = Math.max(-95, bh - 255), hi = 8, mid = (lo + hi) / 2, amp = (hi - lo) / 2 * .85; // top stays below y 125, bottom above y 392
    const ax = Math.min(105, (640 - bw) / 2 - 70), OUT = 80; // room left for the hands at the screen edges; how far off screen they start
    let t = 0, over = false, overAt = -1, last = null; // t: game time (a.every ticks, so pauses and speed changes carry it); over: the attack ended; last: the hands' last spot
    const ease = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    fx.during(a => a.every(16, () => {
      t += 16;
      const s = t / 1000, e = ease((t - GRAB) / RAMP) * (1 - ease((t - backAt) / BACK));
      const k = t >= GRAB && t < GRAB + SHAKE ? Math.round((1 - (t - GRAB) / SHAKE) * 4) * (Math.floor(t / 32) % 2 ? 1 : -1) : 0; // the thunk
      fx.box.ox = Math.round(e * ax * Math.sin(s * .85)) + k; fx.box.oy = Math.round(e * (mid + amp * Math.sin(s * 1.3 + 1))) + (k >> 1);
    }));
    fx.after(() => { over = true; return {}; });
    let thunked = false, released = false;
    fx.draw((c, ms) => {
      if (t < 120) return;
      if (t >= GRAB && !thunked) { thunked = true; fx.sfx.hit(); }
      if (t >= total - LIFT && !released) { released = true; fx.sfx.move(); }
      if (over && overAt < 0) overAt = ms;
      const gy = Math.round((385 + fx.box.oy - bh / 2) / 4) * 4, gl = 320 + fx.box.ox - bw / 2 - 4, gr = 320 + fx.box.ox + bw / 2 + 4; // the grips: the middle of each side
      const reach = p => [gl - (gl + OUT) * (1 - p), gr + (640 + OUT - gr) * (1 - p)]; // p 0..1: off the screen edges -> on the box
      let L, R, Y = gy;
      if (over) { const p = ease((ms - overAt) / 300); last = last || [gl, gr, gy]; [L, R] = [last[0] - (last[0] + OUT) * p, last[1] + (640 + OUT - last[1]) * p]; Y = last[2]; } // attack ended early: slide out from where they were
      else { [L, R] = reach(t < GRAB ? ease(t / GRAB) : t < total - LIFT ? 1 : 1 - ease((t - total + LIFT) / LIFT)); last = [L, R, Y]; }
      const sq = t >= GRAB && t < GRAB + 80 ? 4 : 0; // the squeeze: both hands press in
      L = Math.round(L / 4) * 4 + sq; R = Math.round(R / 4) * 4 - sq;
      if (L < -60 && R > 700) return;
      c.save(); c.imageSmoothingEnabled = false;
      const im = fx.sprite("hand"); // sprites/hand.png
      for (const [X, side] of [[L, 1], [R, -1]]) {
        c.save(); c.translate(X, Y); c.scale(side, 1); c.rotate(-Math.PI / 2); // wrist out, fingers into the box; grab point on the grip
        if (im.naturalWidth) c.drawImage(im, -36, -48, 64, 68);
        else { // fallback until it loads, same footprint
          const blk = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x * 4, y * 4, w * 4, h * 4); };
          blk(-3, -8, 6, 4, "#000"); blk(-2, -8, 4, 4, "#fff"); blk(-7, -5, 13, 7, "#000"); blk(-6, -4, 11, 5, "#fff");
          for (let i = 0; i < 4; i++) { blk(-6 + i * 3, 2, 3, 4, "#000"); blk(-5 + i * 3, 2, 1, 3, "#fff"); }
        }
        c.restore();
        if (t >= GRAB && t < GRAB + 160) { const r = 16 + Math.round((t - GRAB) / 40) * 4; c.fillStyle = "#fff"; for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c.fillRect(X + sx * r - (sx < 0 ? 4 : 0), Y + sy * r - (sy < 0 ? 4 : 0), 4, 4); } // impact ticks
      }
      c.restore();
    });
  },
};
