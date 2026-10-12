/* UI update: Galaxi "redesigns" the menu. Every button swaps place (a derangement; the engine animates the hop), each still does what
   its label says. While the shuffled menu is up: a window icon + "UI v2.0 IS LIVE" pops up above his head and a yellow NEW! tag pops onto one
   button once the hop is done. Both only show in the menu / ACT list and are gone after the first pick.
   Engine wishes: none. */
(window.GALAXI_EVENTS = window.GALAXI_EVENTS || {}).uiupdate = {
  can() { return true; },
  start(ctx, fx) {
    fx.lines(one(["Rolled out a new UI!", "You're welcome."], ["Redesigned the menu.", "Don't worry about it."], ["Big UI update!", "Everything's in a better place now."]));
    fx.flavor(one("* The buttons moved. Galaxi calls it a redesign.", "* Every button is in a new spot. Galaxi says it's an upgrade.", "* UI v2.0 is live. Nobody asked for it."));
    const BX = [32, 185, 345, 500], BW = 110, BY = 432, HOP = 450;
    let shuffled = false, tagSlot = 0, seen = null, gone = false; // seen: overlay time the shuffled menu first showed
    fx.menu(labels => {
      const orig = [...labels];
      let p;
      do { p = [0, 1, 2, 3]; for (let i = 3; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } } while (p.some((v, i) => v === i)); // no button stays put
      p.forEach((from, i) => { labels[i] = orig[from]; });
      tagSlot = Math.floor(Math.random() * 4);
      shuffled = true;
    });
    fx.draw((ctx2, ms, state) => {
      if (!shuffled || gone) return;
      if (state !== "menu" && state !== "sub") { gone = seen !== null; return; } // the shuffled menu is only up in these states; once left, it's over
      if (seen === null) { seen = ms; fx.sfx.move(); }
      const el = ms - seen;
      ctx2.save();
      ctx2.imageSmoothingEnabled = false;
      // the pop-up above his head (same layout as demonetized / bad take): a pixel window icon + "UI v2.0 IS LIVE"
      const WIN = ["########", "#.#.#..#", "########", "#......#", "#.####.#", "#......#", "#.##...#", "########"], label = "UI v2.0 IS LIVE";
      ctx2.font = '16px "DTM-Mono", monospace'; ctx2.textBaseline = "middle";
      const tw = Math.round(ctx2.measureText(label).width), x = Math.round(320 - (22 + tw) / 2), y = 34 + Math.max(0, 6 - Math.floor(el / 30)); // y: the label's middle; pops up 6px
      ctx2.fillStyle = "#fff"; WIN.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === "#") ctx2.fillRect(x + i * 2, y - 8 + j * 2, 2, 2); }));
      fx.text(label, x + 22, y, 16, "#ff0", "left", "DTM-Mono");
      ctx2.textBaseline = "alphabetic";
      if (el > HOP) { // the NEW! tag appears once the buttons have landed
        const tw = 46, th = 17, tx = BX[tagSlot] + BW - tw - 2, ty = BY - 11; // straddles the button's top-right corner
        const tag = fx.sprite("new-tag"); // sprites/new-tag.png (50x21, border included)
        if (tag.naturalWidth) ctx2.drawImage(tag, tx - 2, ty - 2);
        else { ctx2.fillStyle = "#000"; ctx2.fillRect(tx - 2, ty - 2, tw + 4, th + 4); ctx2.fillStyle = "#ff0"; ctx2.fillRect(tx, ty, tw, th); fx.text("NEW!", tx + tw / 2, ty + 14, 16, "#000", "center", "DTM-Sans"); }
      }
      ctx2.restore();
    }, { menu: true }); // stays for the menu (that's where the new layout is)
  },
};
