/* Meta event: "Thumbnail shot". Galaxi stops the fight to take a thumbnail of you. The camera zooms in and the screen gets
   YouTube-thumbnail dressing: REC dot with a "3..2..1" countdown, camera-frame corners, a 4K tag, and a red clickbait label in the
   free left area with a dashed arrow to the heart (clear of his sprite and speech bubble). At the shutter the frame is captured;
   after the attack a thumbnail card (the capture, SHOCKING tag, 10:01 badge, title, views) pops in and stays for the menu. Nothing hurts.
   Engine wishes: the overlay's ms is time since the EVENT started (not the attack), so the attack's own timers (a.after) mark the
   countdown and shutter; zoom moves his sprite on screen, so the label can only dodge the unzoomed layout. */
(window.GALAXI_EVENTS = window.GALAXI_EVENTS || {}).thumbnail = {
  can(ctx) { return !["mario", "lorem", "sonic"].includes(ctx.attack); },
  start(ctx, fx) {
    const T = Math.min((ctx.turn && ctx.turn.time) || 6000, 9000), S = Math.max(1200, T - 650), LABELS = ["SHOCKING", "CLICKBAIT", "GONE WRONG", "SHOCKING", "CLICKBAIT", "(NOT CLICKBAIT)"];
    let soul = null, done = false, snap = false, shutter = -1, doneAt = -1, count = 0, shot = null;
    fx.lines(one(
      ["Hold still, I need a thumbnail.", "Make a surprised face."],
      ["Wait, wait. Thumbnail time.", "Look shocked. Not that shocked."],
      ["Don't move. This is for the algorithm.", "Perfect. Keep doing that."]));
    fx.zoom(1.5);
    fx.during(a => {
      soul = a.soul;
      a.after(Math.max(800, T - 2100), () => a.say(one("Perfect. That's the one.", "Perfect. That's the one. 10 out of 10.", "Oh, that's the one. Perfect."), 1500));
      for (let i = 1; i <= 3; i++) a.after(Math.max(0, S - 2000 + i * 500), () => { count = i; a.sfx.move(); }); // 3..2..1
      a.after(S, () => {
        snap = true; a.sfx.swing(); // the next overlay frame grabs the scene
        fx.flavor(one("* Galaxi got his thumbnail. You look terrified in it.", "* Galaxi took a thumbnail of you. It's going on the video.", "* Click. That's the thumbnail. You look shocked."));
      });
    });
    fx.after(() => { done = true; return {}; });
    fx.draw((c, ms) => {
      if (snap) { // capture 16:9 around the heart, at exactly half size (384x216 -> 192x108)
        snap = false; shutter = ms;
        const k = c.canvas.width / 640, cx = Math.max(0, Math.min(256, Math.round((soul ? soul.x : 320) - 192))), cy = Math.max(0, Math.min(264, Math.round((soul ? soul.y : 320) - 108)));
        shot = document.createElement("canvas"); shot.width = 192; shot.height = 108;
        const s = shot.getContext("2d"); s.imageSmoothingEnabled = false; s.drawImage(c.canvas, cx * k, cy * k, 384 * k, 216 * k, 0, 0, 192, 108);
      }
      c.save(); c.imageSmoothingEnabled = false;
      const W = 640, H = 480, M = 14, L = 38, TH = 3;
      // camera-frame corners
      c.fillStyle = "#fff";
      for (const [x, y, sx, sy] of [[M, M, 1, 1], [W - M, M, -1, 1], [M, H - M, 1, -1], [W - M, H - M, -1, -1]]) {
        c.fillRect(sx > 0 ? x : x - L, sy > 0 ? y : y - TH, L, TH);
        c.fillRect(sx > 0 ? x : x - TH, sy > 0 ? y : y - L, TH, L);
      }
      // blinking REC, then the countdown
      if (Math.floor(ms / 500) % 2 === 0) { c.fillStyle = "#f00"; c.fillRect(30, 29, 12, 12); c.fillRect(28, 31, 16, 8); c.fillRect(32, 27, 8, 16); }
      fx.text("REC", 52, 42, 22, "#fff", "left", "DTM-Sans");
      if (count) fx.text(["3", "3..2", "3..2..1"][count - 1], 104, 42, 22, "#fff", "left", "DTM-Sans");
      // 4K tag, top right above his bubble
      c.fillStyle = "#000"; c.fillRect(W - 72, 24, 44, 26);
      c.strokeStyle = "#fff"; c.lineWidth = 3; c.strokeRect(W - 70.5, 25.5, 41, 23);
      fx.text("4K", W - 50, 44, 20, "#fff", "center", "DTM-Sans");
      // red clickbait label in the free left area, and a dashed arrow from it to the heart
      const label = LABELS[Math.floor(ms / 900) % LABELS.length], lx = 24, ly = 100;
      c.font = '22px "DTM-Sans", monospace';
      const tw = Math.round(c.measureText(label).width) + 16;
      c.fillStyle = "#e00"; c.fillRect(lx, ly - 24, tw, 32);
      c.strokeStyle = "#fff"; c.strokeRect(lx + 1.5, ly - 22.5, tw - 3, 29);
      fx.text(label, lx + tw / 2, ly, 22, "#fff", "center", "DTM-Sans");
      if (soul) {
        const sx = lx + tw / 2, sy = ly + 8, dx = soul.x - sx, dy = soul.y - sy, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, tip = d - 38;
        if (tip > 70) {
          c.globalAlpha = .6; c.fillStyle = "#e00";
          for (let r = 16; r < tip - 22; r += 18) c.fillRect(Math.round(sx + ux * r) - 3, Math.round(sy + uy * r) - 3, 7, 7);
          c.save(); c.translate(sx + ux * tip, sy + uy * tip); c.rotate(Math.atan2(uy, ux));
          const ah = fx.sprite("arrow-head"); // sprites/arrow-head.png (27x31, pointing right, tip at its right middle)
          if (ah.naturalWidth) c.drawImage(ah, -27, -15); else { c.beginPath(); c.moveTo(0, 0); c.lineTo(-26, -15); c.lineTo(-26, 15); c.closePath(); c.fill(); } c.restore();
          c.globalAlpha = 1;
        }
      }
      // shutter flash
      if (shutter >= 0) { const k = ms - shutter; if (k < 520) { c.globalAlpha = k < 90 ? .9 : .9 * (1 - (k - 90) / 430); c.fillStyle = "#fff"; c.fillRect(0, 0, W, H); } }
      c.restore();
    });
    fx.draw((c, ms) => { // the thumbnail card, up for the menu after the attack
      if (!done || !shot) return;
      if (doneAt < 0) { doneAt = ms; fx.sfx.select(); }
      const t = ms - doneAt, slide = Math.round(Math.pow(Math.max(0, 1 - t / 220), 2) * 48), X = 24 - slide, Y = 24;
      c.save(); c.imageSmoothingEnabled = false; c.globalAlpha = t < 70 ? .35 : t < 140 ? .7 : 1;
      c.fillStyle = "#000"; c.fillRect(X - 4, Y - 4, 206, 190);
      c.fillStyle = "#fff"; c.fillRect(X, Y, 198, 114); // white 3px border around the capture
      c.drawImage(shot, X + 3, Y + 3);
      c.fillStyle = "#e00"; c.fillRect(X + 7, Y + 7, 84, 20); // red tag, top left of the shot
      fx.text("SHOCKING", X + 49, Y + 22, 14, "#fff", "center", "DTM-Sans");
      c.fillStyle = "#000"; c.fillRect(X + 153, Y + 91, 38, 16); // duration badge, bottom right
      fx.text("10:01", X + 172, Y + 104, 13, "#fff", "center", "DTM-Sans");
      fx.text("I SURVIVED GALAXI", X, Y + 136, 16, "#fff", "left", "DTM-Sans");
      fx.text("(GONE WRONG)", X, Y + 154, 16, "#fff", "left", "DTM-Sans");
      fx.text("GalaxiHD · 2.1M views", X, Y + 172, 13, "#aaa", "left", "DTM-Sans");
      c.restore();
    }, { menu: true });
  },
};
