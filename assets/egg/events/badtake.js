/* Bad take: from the turn it lands on, every attack is recorded (what's inside the box, every few frames). The first one you
   take no hits on is "too clean": Galaxi says so in his bubble (no Z needed) while the box plays your whole run backwards
   like a VHS rewind, timecode counting down to 00:00:00 in its top-left corner, then take 2 starts straight away at 1.15x
   with a blinking red record dot and "Recording 00:00" ticking above his head. He reacts to take 2's result. Gives up after 3 hit attacks in a row. */
(window.GALAXI_EVENTS = window.GALAXI_EVENTS || {}).badtake = {
  start(ctx, fx) {
    const SPEED = 1.15, CAP = 120; // take 2's pace; the most frames kept (past it, every other frame is dropped and recording slows)
    let armed = false, take2At = -1, gt = 0, streak = 0; // gt: the overlay's latest ms (fx.during has no clock)
    let rec = [], recMs = 0, api = null;
    const pad = n => String(n).padStart(2, "0"), DOT = ["..###..", ".#####.", "#######", "#######", "#######", ".#####.", "..###.."]; // the record dot, 2px pixels
    fx.during(a => {
      if (armed) { if (take2At < 0) take2At = gt; return; } // take 2 just began
      const cv = document.querySelector("#ut-battle canvas"); let n = 0, every = 3; rec = []; recMs = 0; api = a;
      a.bullet({ x: 0, y: 0, w: 1, h: 1, damage: 0, clip: false, draw() {},
        update(b, dt) { // the canvas still holds last frame here: copy the inside of the box
          recMs += dt; if (!cv || n++ % every) return;
          const B = a.box, w = Math.round(B.width), h = Math.round(B.height), f = document.createElement("canvas"); f.width = w; f.height = h;
          const g = f.getContext("2d"), k = cv.width / 640; g.imageSmoothingEnabled = false; g.drawImage(cv, Math.round(B.left) * k, Math.round(B.top) * k, w * k, h * k, 0, 0, w, h); rec.push(f); // (the canvas can be drawn at a multiple of 640x480)
          if (rec.length >= CAP) { rec = rec.filter((_, k) => k % 2 === 0); every *= 2; } // ponytail: halve the footage instead of growing past CAP
        } });
    });
    const rewind = (c, t, R) => { // the recorded attack, backwards, inside the box
      const B = api.box, k = Math.min(1, t / R), f = rec[Math.round((1 - k) * (rec.length - 1))], tick = Math.floor(t / 90);
      c.save(); c.imageSmoothingEnabled = false;
      c.beginPath(); c.rect(B.left, B.top, B.width, B.height); c.clip();
      c.fillStyle = "#000"; c.fillRect(B.left, B.top, B.width, B.height);
      if (f) c.drawImage(f, Math.round(B.left) + (tick % 3 - 1) * 2, Math.round(B.top)); // tape wobble
      c.fillStyle = "rgba(255,255,255,.07)"; for (let y = Math.round(B.top); y < B.bottom; y += 4) c.fillRect(B.left, y, B.width, 2); // scanlines
      c.fillStyle = "rgba(255,255,255,.22)"; // tracking-noise bars sliding down
      for (let i = 0; i < 3; i++) { const y = B.top + ((tick * 37 + i * 97 + t * .25) % (B.height + 30)) - 15, h = 4 + ((tick + i * 3) % 3) * 4; c.fillRect(B.left, Math.floor(y), B.width, h); }
      const x = Math.round(B.left) + 8, y = Math.round(B.top) + 8, sec = Math.ceil(recMs * (1 - k) / 1000); // timecode: the run's length down to zero
      c.fillStyle = "#fff"; for (const dx of [0, 8]) for (let r = 0; r < 7; r++) { const w = 4 - Math.abs(r - 3); c.fillRect(x + dx + (4 - w) * 2, y + r * 2, w * 2, 2); } // ◀◀ in 2px pixels
      c.textBaseline = "middle"; fx.text("REWIND", x + 22, y + 7, 16, "#fff", "left", "DTM-Mono");
      fx.text("00:00:" + pad(sec), x, y + 26, 16, "#fff", "left", "DTM-Mono");
      c.restore();
    };
    fx.after(r => {
      if (r.hits !== 0) return ++streak >= 3 ? {} : undefined; // got hit: keep waiting for a clean attack, but not forever
      armed = true; streak = 0;
      const R = Math.min(2200, Math.max(1200, recMs / 5)); // the rewind: ~5x speed, 1.2-2.2s
      fx.flavor(one("* Galaxi re-recorded the attack. Take 2 was faster.", "* Galaxi called it too clean and went again at 1.15x.", "* That attack got a second take. It ran a bit faster."));
      r.draw((c, ms) => { // take 2: a red pixel record dot above his head, "Recording 00:00" ticking up (the rewind itself is the pause below)
        gt = ms; if (take2At < 0) return;
        const sec = Math.floor((ms - take2At) / 1000), label = "Recording " + pad(Math.floor(sec / 60)) + ":" + pad(sec % 60); c.font = '16px "DTM-Mono", monospace';
        const x = Math.round(320 - (22 + Math.round(c.measureText(label).width)) / 2), y = 27; // centred on him, label middle at 34 like the other pop-ups
        c.save(); c.imageSmoothingEnabled = false;
        if (Math.floor((ms - take2At) / 500) % 2 === 0) { c.fillStyle = "#ff0000"; DOT.forEach((row, r) => [...row].forEach((p, k) => p === "#" && c.fillRect(x + k * 2, y + r * 2, 2, 2))); } // blinks like a camera's
        c.textBaseline = "middle"; fx.text(label, x + 22, y + 7, 16, "#fff", "left", "DTM-Mono");
        c.restore();
      });
      fx.after(r2 => ({ lines: r2.hits === 0 ? one(["...Fine.", "We'll use that one."], ["Hm. Okay.", "That one's usable."]) : one(["See? Way better.", "That's the real take."], ["See? Way better."]) })); // take 2's verdict (lines only: back to the menu)
      return { replay: SPEED, lines: [{ go: true, at: () => fx.pause(R, (c, t) => rewind(c, t, R)), // no Z: he says it over the rewind, take 2 rolls when it ends
        text: one("Too clean. Try again.", "Too clean... I'm clip farming, sorry.", "Nope, too clean. Run it back.", "That was too clean for the thumbnail. Again.") }] };
    });
  },
};
