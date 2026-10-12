/* Fake game over: mid-attack the fight freezes on a convincing GAME OVER (crack, shatter, GAME/OVER, "Eventuality!" typed
   with his voice), then Galaxi goes "...psych." and heals 10 HP while you panicked.
   The heart gets 900ms of i-frames when the fight resumes, and the GAME OVER screen tears away in glitch bars (no text on top of him).
   Engine wishes: the pause draw only gets (ctx, t), so the heart position is captured via a.soul in fx.during;
   a.soul.inv is getter-only in battle.js, so the i-frames assignment below is a no-op until it gets a setter. */
(window.GALAXI_EVENTS = window.GALAXI_EVENTS || {}).fakeover = {
  can(ctx) { return ctx.attack !== "mario" && ctx.attack !== "lorem"; },
  start(ctx, fx) {
    let now = 0, tearAt = -1;
    fx.flavor(one("* That Game Over was fake. Galaxi healed 10 HP while you panicked.", "* Fake Game Over. Galaxi used the screen time to heal 10 HP.", "* You did not die. Galaxi did heal 10 HP, though."));
    fx.draw((c, ms) => { // glitch tear: the GAME OVER screen rips away in black bars over the fight
      now = ms;
      if (tearAt < 0 || ms - tearAt > 450) return;
      const k = (ms - tearAt) / 450, tick = Math.floor(ms / 50);
      c.imageSmoothingEnabled = false;
      for (let y = 0; y < 480; y += 24) {
        const h = (tick * 7 + y * 13) % 100 / 100;
        if (h < 1 - k) { // fewer bars each frame
          const j = ((tick * 11 + y * 5) % 9 - 4) * 8;
          c.fillStyle = "#000"; c.fillRect(j, y, 640, 24);
          c.fillStyle = "#fff"; c.fillRect(j, y, 640, 2);
        }
      }
    });
    fx.during(a => {
      a.after(2500 + Math.random() * 2000, () => {
        const sx = a.soul.x, sy = a.soul.y, word = "Eventuality!", msg = "GAME", shards = [];
        let cracked = false, shattered = false, voiced = false, typed = 0;
        for (let i = 0; i < 6; i++) shards.push({ vx: (i - 2.5) * 1.3 + Math.random() - .5, vy: -3 - Math.random() * 2 });
        fx.pause(3600, (c, t) => {
          c.save(); c.imageSmoothingEnabled = false;
          c.fillStyle = "#000"; c.fillRect(0, 0, 640, 480);
          if (t < 500) fx.heart(sx, sy);
          else if (t < 1100) { // cracked down the middle
            if (!cracked) { cracked = true; fx.sfx.crack(); }
            for (const [dx, x0] of [[-2, 0], [2, sx]]) { c.save(); c.beginPath(); c.rect(x0 ? sx : 0, 0, x0 ? 640 : sx, 480); c.clip(); fx.heart(sx + dx, sy, "#f00"); c.restore(); }
          } else { // shattered, shards fall
            if (!shattered) { shattered = true; fx.sfx.shatter(); }
            const f = (t - 1100) / 16.7;
            c.fillStyle = "#f00";
            for (const s of shards) {
              const px = Math.round(sx + s.vx * f - 4), py = Math.round(sy + s.vy * f + .125 * f * f - 3);
              c.fillRect(px + 2, py, 4, 2); c.fillRect(px, py + 2, 8, 2); c.fillRect(px + 2, py + 4, 4, 2);
            }
          }
          if (t > 1500) {
            c.globalAlpha = Math.min(1, (t - 1500) / 800);
            fx.text(msg, 320, 150, 120, "#fff", "center", "DTM-Sans"); fx.text("OVER", 320, 250, 120, "#fff", "center", "DTM-Sans");
            c.globalAlpha = 1;
          }
          if (t > 2300) {
            if (!voiced) { voiced = true; fx.play(V.eventuality, window.GALAXI_BOSS.voiceVolume ?? 1); }
            typed = Math.min(word.length, Math.floor((t - 2300) / 70));
            fx.text(word.slice(0, typed), 140, 340, 32);
          }
          c.restore();
        });
        a.after(1, () => { // timers are frozen during the pause, so this fires when it ends
          tearAt = now; a.soul.inv = 900; // the bullets that were on the heart can't hit it on the first frames
          a.say(one("...psych.", "Gotcha.", "You should've seen your face."), 2200);
          fx.foeHeal(10);
        });
      });
    });
  },
};
