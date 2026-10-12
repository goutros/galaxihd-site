/* Fake game over: mid-attack the fight freezes on the REAL death screen (battle.js deathScreen via fx.fakeDeath: the same crack,
   shatter, UNDERTALE's GAME OVER, "Eventuality!" typed in his voice, even the retry hints), frame for frame. The one tell: the battle
   music never stops (a real death cuts it). Then the screen tears away in glitch bars, Galaxi goes "...psych." and heals 10 HP while
   you panicked, and the heart gets 900ms of i-frames as the fight resumes. */
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
        fx.fakeDeath(5800); // the real thing for ~1.4s past the retry hints, then it tears
        a.after(1, () => { // timers are frozen during the pause, so this fires when it ends
          tearAt = now; a.soul.inv = 900; // the bullets that were on the heart can't hit it on the first frames
          a.say(one("...psych.", "Gotcha.", "You should've seen your face."), 2200);
          fx.foeHeal(10);
        });
      });
    });
  },
};
