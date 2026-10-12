/* Undertale-style battle engine for the site's easter egg (tap the pfp 9 times).
 *
 * Core (640x480 screen, 16px SOUL at 2px/frame, bullet box anchored at x 320 / bottom 385, rotated-box
 * collision, 1s flashing i-frames, HP bar geometry) ported from Webtale by Stuart Watson:
 * https://github.com/chao-master/Webtale  (MIT License, Copyright (c) 2016 Stuart Watson; full text at the end
 * of this file). Menus, dialogue, FIGHT/ACT/ITEM/MERCY, turns, endings, touch input and sound added for GalaxiHD.
 *
 * Sound effects are UNDERTALE's own (assets/egg/sfx/, from Galaxi's copy, credited in the page footers). Fonts:
 * 8-bit Operator (dialogue) and Determination Sans (buttons/HP). Heart, icons and GAME OVER are drawn in code.
 * All the content (dialogue, attacks, acts, items) lives in boss.js. See the guide at the top of that file.
 */
(() => {
  // UNDERTALE's numbers (obj_heart, obj_battlecontroller, SCR_BORDERSETUP; 30fps frames): the SOUL moves 4px a frame (2 holding X), 30 frames of
  // i-frames, box edges move 15px a frame, the menu box's inside is 565x130 with its bottom at y 385 (border 0: [32, 602, 250, 385] with 5px walls)
  const W = 640, H = 480, F = 1000 / 30, SPEED = 4 / F, SOUL = 16, IFRAMES = 30 * F, BOX_SPEED = 15 / F, BOT = 385, MW = 565, MH = 130;
  // the platformer heart (Mario turn): made for this minigame, not a port of SMB. px/frame, stepped at a fixed 60 fps. Reaches full
  // speed almost at once and stops almost at once, steers fully in the air; hold jump for the full height (~72px, clears the tall
  // pipes), tap it for a ~20px hop. Faster than the auto-scroll (1.5 px/frame) so there's always room to get ahead.
  const MARIO_FRAME = 1000 / 60;
  const PLAT = { speed: 2.4, accel: .5, stop: .6, airAccel: .4, jump: 6.6, gUp: .3, gDown: .5, cut: .45, maxFall: 7, coyote: 6, buffer: 8, bounce: 4 };
  const MONO = "DTM-Mono", SANS = "DTM-Sans", ORANGE = "#ff7f27", YELLOW = "#ffff00";
  // the 16x16 SOUL, pixel for pixel
  const HEART = ["0011000000001100", "0111110000111110", "1111111001111111", "1111111001111111", "1111111111111111", "1111111111111111",
    "1111111111111111", "1111111111111111", "1111111111111111", "1111111111111111", "0011111111111100", "0011111111111100",
    "0000111111110000", "0000111111110000", "0000001111000000", "0000001111000000"];
  // button icons, 11x11, drawn at 2x
  const ICONS = {
    FIGHT: ["00000000011", "00000000111", "00000001110", "00000011100", "01000111000", "00101110000", "00011100000", "00111000000", "01101100000", "11000110000", "10000010000"],
    ACT: ["01111111110", "11111111111", "11000000011", "11011111011", "11000000011", "11011100011", "11000000011", "11111111111", "01111111110", "00011000000", "00010000000"],
    ITEM: ["00011111000", "00110001100", "00100000100", "11111111111", "11111111111", "11111011111", "11110001111", "11111011111", "11111111111", "11111111111", "01111111110"],
    MERCY: ["11000000011", "11100000111", "01110001110", "00111011100", "00011111000", "00001110000", "00011111000", "00111011100", "01110001110", "11100000111", "11000000011"],
  };

  let seenOpening = false, deaths = 0; // the opening dialogue plays once per page visit (R on the death screen replays it); deaths: this page visit
  window.startBattle = function (boss, base, test) { // test: { turn: n } skips the opening and menu and starts that turn's attack (for quick checks)
    if (document.getElementById("ut-battle")) return;
    // ---------- page overlay + canvas (scaled to fit, whole numbers when there's room so pixels stay crisp) ----------
    const wrap = document.createElement("div"); wrap.id = "ut-battle";
    wrap.style.cssText = "position:fixed;inset:0;z-index:99999;background:#000;display:grid;place-items:center;touch-action:none;cursor:default";
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H; cv.style.imageRendering = "pixelated";
    const close = document.createElement("button"); close.textContent = "✕"; close.setAttribute("aria-label", "Close the battle");
    close.style.cssText = "position:absolute;top:10px;right:12px;background:none;border:2px solid #fff;color:#fff;font:20px/1 sans-serif;width:36px;height:36px;border-radius:50%;cursor:pointer;opacity:.7";
    wrap.append(cv, close); document.body.append(wrap);
    let R = 1; // render scale: the canvas holds the screen's real pixels (a whole multiple of 640x480) so text is drawn sharp, not upscaled; every coordinate stays 640x480
    const fit = () => { const s = Math.min(innerWidth / W, innerHeight / H); const k = s >= 1 ? Math.floor(s) : s; cv.style.width = W * k + "px"; cv.style.height = H * k + "px";
      const r = test && test.sim ? 1 : Math.max(1, Math.min(4, Math.round(k * (devicePixelRatio || 1)))); if (r !== R) { R = r; cv.width = W * R; cv.height = H * R; } }; // the sim stays 1x (speed)
    fit(); addEventListener("resize", fit);
    const ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false;
    for (const [name, file] of [[MONO, "assets/egg/fonts/determination-mono.ttf"], [SANS, "assets/egg/fonts/determination-sans.woff"]])
      new FontFace(name, `url(${base}${file})`).load().then(f => document.fonts.add(f)).catch(() => {});
    const oldOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = "hidden";

    // ---------- images ----------
    const img = src => { const i = new Image(); i.src = src.startsWith("http") ? src : base + src; return i; };
    const sprite = img(boss.sprite), images = {}; let foeSprite = sprite; // foeSprite: what he looks like right now (api.setSprite)
    for (const [k, v] of Object.entries(boss.images || {})) images[k] = img(v);
    const ui = { gameover: img("assets/egg/ui/gameover.png"), bubble: img("assets/egg/ui/blconwdshrt.png"), hpname: img("assets/egg/ui/hpname.png"), dmgnum: img("assets/egg/ui/dmgnum_o.png"), miss: img("assets/egg/ui/dmgmiss_o.png"), // UNDERTALE's, from Galaxi's copy
      bt: { FIGHT: img("assets/egg/ui/fightbt.png"), ACT: img("assets/egg/ui/talkbt.png"), ITEM: img("assets/egg/ui/itembt.png"), MERCY: img("assets/egg/ui/sparebt.png") }, // 110x42, frame 2 = selected
      target: img("assets/egg/ui/target.png"), cursor: img("assets/egg/ui/target-cursor.png"), slice: img("assets/egg/ui/slice.png") }; // UNDERTALE spr_target, spr_targetchoice (2 frames), spr_slice_o (6 frames)

    // ---------- sound: a short square-wave blip per letter, pitch from boss.voice ----------
    let ac = null;
    const vary = x => boss.vary ? boss.vary(x) : x; // boss.js one(...): pick a variant (no repeats) wherever its text is used
    const sim = !!(test && test.sim); // tools/sim.html: silent, no animation loop, the sim steps the fight itself (__egg.tick)
    const blip = (freq = 440, len = .045, vol = .06, type = "square") => { if (sim) return;
      try {
        ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume();
        const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
        o.type = type; o.frequency.value = freq * (.97 + Math.random() * .06);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + len);
        o.connect(g).connect(ac.destination); o.start(t); o.stop(t + len);
      } catch {}
    };
    // a voice can also be an audio file (boss.voice: "assets/egg/galaxi-voice.wav"): one tiny clip played per letter
    // with a little random pitch wobble, the way Undertale's text voices work. Falls back to the synth blip.
    const clips = {};
    const loadClip = src => { if (sim || typeof src !== "string" || clips[src]) return; // (the sim is silent: every replay starting a fight would fetch and decode every sound again) clips[src] = "loading";
      fetch(base + src).then(r => r.arrayBuffer()).then(b => { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); return ac.decodeAudioData(b); }).then(buf => clips[src] = buf).catch(() => delete clips[src]); };
    let lastBlip = null; // another character's voice (SANS): UNDERTALE's writer stops the last blip and replays it, same pitch every letter
    const speak = v => { if (sim) return;
      if (Array.isArray(v)) { const ok = v.filter(x => clips[x] instanceof AudioBuffer); if (!ok.length) return blip(440); v = ok[Math.floor(Math.random() * ok.length)]; }
      const buf = clips[v];
      if (!(buf instanceof AudioBuffer)) return blip(typeof v === "number" ? v : 440);
      if (ac.state === "suspended") ac.resume(); // first key/tap unlocks audio
      const own = v === boss.voice; // only Galaxi's own blip wobbles ±0.1 in pitch
      try { const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = buf; s.playbackRate.value = own ? .9 + Math.random() * .2 : 1; g.gain.value = own ? boss.blipVolume ?? .8 : .8; s.connect(g).connect(ac.destination);
        if (!own) { try { lastBlip && lastBlip.stop(); } catch {} lastBlip = s; } s.start(); } catch {}
    };
    const play = (src, vol = 1, rate = 1) => { if (sim) return; const buf = clips[src]; if (!(buf instanceof AudioBuffer)) return; try { if (ac.state === "suspended") ac.resume(); const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = buf; s.playbackRate.value = rate; g.gain.value = vol; s.connect(g).connect(ac.destination); s.start(); } catch {} };
    [].concat(boss.voice, boss.narrator, boss.sounds || [], boss.music || []).forEach(loadClip);
    // battle music: loops gaplessly through Web Audio, starts after the opening (from the top on every retry), M mutes it
    let music = null, musicGain = null, musicMuted = false, musicGen = 0;
    // where in the song we are (seconds), for things that sync to it: the playback rate's changes are kept as one ramp { from, to, t0, t1 }
    let mPos = 0, mRamp = null; const quake = { i: 0, t: 0, x: 0, y: 0 };
    const rateAt = (r, t) => t >= r.t1 ? r.to : r.from + (r.to - r.from) * (t - r.t0) / (r.t1 - r.t0);
    const songPos = (t = ac.currentTime) => { const r = mRamp, a = Math.min(t, r.t1); return mPos + (a - r.t0) * (r.from + rateAt(r, a)) / 2 + Math.max(0, t - r.t1) * r.to; };
    const stopMusic = () => { musicGen++; try { music && music.stop(); } catch {} music = null; };
    const startMusic = (gen = musicGen) => { if (sim) return; // the sim is silent, music included
      if (music || !boss.music || gen !== musicGen) return; // gen: a retry while it was still loading cancels this start
      const buf = clips[boss.music]; if (!(buf instanceof AudioBuffer)) return setTimeout(() => startMusic(gen), 200);
      try {
        if (ac.state === "suspended") ac.resume();
        music = ac.createBufferSource(); music.buffer = buf; music.loop = true;
        musicGain = ac.createGain(); musicGain.gain.value = musicMuted ? 0 : (boss.musicVolume ?? .35);
        music.connect(musicGain).connect(ac.destination); music.start(); mPos = 0; mRamp = { from: 1, to: 1, t0: ac.currentTime, t1: ac.currentTime };
      } catch {}
    };
    // a dialogue line is "text" or { text, sound }: the sound (a voice line) plays as the line starts, and replaces the blips
    const lineText = l => typeof l === "string" ? l : l.text, lineSound = l => typeof l === "string" ? null : l.sound;
    // UNDERTALE's own sound effects (from Galaxi's copy; credited in the page footers)
    const SFX = Object.fromEntries(["squeak", "select", "laz", "damage", "hurt1", "heal_c", "escaped", "break1", "break2", "noise", "battlefall", "vaporized", "txt1", "segapower", "rainbowbeam"].map(n => [n, `assets/egg/sfx/${n}.mp3`]));
    Object.values(SFX).forEach(loadClip);
    const sfx = { move: () => play(SFX.squeak), select: () => play(SFX.select), swing: () => play(SFX.laz), hit: () => play(SFX.damage), hurt: () => play(SFX.hurt1),
      heal: () => play(SFX.heal_c), charge: () => play(SFX.segapower), beam: () => play(SFX.rainbowbeam), flee: () => play(SFX.escaped), crack: () => play(SFX.break1), shatter: () => play(SFX.break2),
      start: () => { play(SFX.noise); setTimeout(() => play(SFX.battlefall), 120); }, spare: () => play(SFX.vaporized), dust: () => play(SFX.vaporized), files: SFX };

    // ---------- input: keys + taps/drags (canvas coordinates) ----------
    const down = new Set(), hit = new Set();
    // Z / Enter / Space confirm, X / Shift cancel, arrows or WASD move
    const keyName = k => ({ z: "z", Z: "z", Enter: "z", " ": "z", x: "x", X: "x", Shift: "x", Escape: "esc",
      w: "ArrowUp", W: "ArrowUp", a: "ArrowLeft", A: "ArrowLeft", s: "ArrowDown", S: "ArrowDown", d: "ArrowRight", D: "ArrowRight", r: "r", R: "r" })[k] || k;
    const kd = e => { const k = keyName(e.key);
      if (k === "m" || k === "M") { musicMuted = !musicMuted; if (musicGain) musicGain.gain.value = musicMuted ? 0 : (boss.musicVolume ?? .35); } if (!down.has(k)) hit.add(k); down.add(k); if (k.startsWith("Arrow") || k === "z") e.preventDefault(); e.stopPropagation(); };
    const ku = e => down.delete(keyName(e.key));
    addEventListener("keydown", kd, true); addEventListener("keyup", ku, true);
    const toCanvas = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
    let tap = null, drag = null;
    cv.addEventListener("contextmenu", e => { e.preventDefault(); hit.add("x"); }); // right-click = back
    cv.addEventListener("pointerdown", e => { if (e.button === 2) return; const p = toCanvas(e); tap = p; drag = { ...p, sx: soul.x, sy: soul.y }; try { cv.setPointerCapture(e.pointerId); } catch {} }); // capture can fail if the finger already lifted
    cv.addEventListener("pointermove", e => {
      // mouse hover picks the menu button / option under it (click then confirms it)
      if (e.pointerType === "mouse" && !drag) {
        const p = toCanvas(e), b = btns.findIndex(b => inside(p, b.x, b.y, b.w, b.h));
        if (state === "menu" && b >= 0 && b !== menuIx) { menuIx = b; sfx.move(); }
        if (state === "sub") { const t = sub.options.findIndex((o, i) => optHit(p, i)); if (t >= 0 && t !== subIx) { subIx = t; sfx.move(); } }
      }
      if (drag) { const p = toCanvas(e); drag.cx = p.x; drag.cy = p.y; } // Mario mode steers toward the finger, swipe up jumps
      if (drag && state === "dodge" && !soul.mario) { const p = toCanvas(e); moveSoul(drag.sx + (p.x - drag.x) * 1.4, soul.blue ? soul.y : drag.sy + (p.y - drag.y) * 1.4); } }); // blue SOUL: drag steers, tap jumps
    cv.addEventListener("pointerup", e => { // a quick vertical swipe while dodging counts as Up / Down (the Sonic lanes)
      if (drag && state === "dodge") { const p = toCanvas(e), dy = p.y - drag.y; if (Math.abs(dy) > 24 && Math.abs(dy) > Math.abs(p.x - drag.x)) hit.add(dy < 0 ? "ArrowUp" : "ArrowDown"); }
      drag = null; });
    const inside = (p, x, y, w, h) => p && p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;

    // ---------- battle state ----------
    let player, foe, state, menuIx, subIx, sub, queue, typing, after, turn, box, soul, bullets, timers, clock, attackEnd, aim, fx, flavor, talk;
    const btns = ["FIGHT", "ACT", "ITEM", "MERCY"].map((t, i) => ({ t, x: [32, 185, 345, 500][i], y: 432, w: 110, h: 42 }));
    function reset(story) { // story: play the opening dialogue this time
      storyMode = story;
      player = { name: boss.playerName || "YOU", lv: 1, hp: 20, max: 20, items: (boss.items || []).map(i => ({ ...i })) };
      foe = { hp: boss.hp, max: boss.hp, spare: 0, shake: 0, flags: {}, uses: {}, loop: 0 }; firstTurn = true; foeSprite = sprite; // uses: how many times each menu pick was made this fight
      menuIx = 0; turn = 0; bullets = []; timers = []; fx = []; clock = 0; outro = null;
      box = { x: 32, y: 250, w: MW, h: MH, tw: MW, th: MH, ox: 0, oy: 0 }; // ox/oy: a meta event dragging the box around
      soul = { x: 320, y: 320, inv: 0, dead: 0 };
      flavor = ""; firstFlavor = null; boxLine = null; deadLine = null; planEvents();
      // the opening, every time (first fight and every retry): black screen, the SOUL blinks 3 times with the encounter
      // beep, drops onto the FIGHT button, then the UI appears and the music starts over from the top
      stopMusic(); state = "intro"; introStep = 0;
    }
    let firstTurn = true, introStep = 0, storyMode = false, firstFlavor = null, boxLine = null; // boxLine: the opening's box line, kept up while Galaxi talks
    const INTRO_BLINK = 600, INTRO_DROP = 450;
    function introUpdate() {
      const beeps = [0, 200, 400];
      while (introStep < beeps.length && clock >= beeps[introStep]) { play(SFX.noise); introStep++; }
      if (introStep === 3 && clock >= INTRO_BLINK) { play(SFX.battlefall); introStep = 4; }
      if (introStep === 4 && clock >= INTRO_BLINK + INTRO_DROP) { introStep = 5; startMusic(); begin(); }
    }
    // after the blink: the opening dialogue (first time, or R on the death screen), then Galaxi attacks first, like Sans
    function begin() {
      if (!boss.opening) return toMenu();
      if (!storyMode) return first();
      const o = boss.opening, replay = seenOpening; seenOpening = true;
      say(o.box, () => { boxLine = typing; const lines = vary(typeof o.say === "function" ? o.say(replay) : [...o.say]); state = "talk"; after = () => { boxLine = null; firstFlavor = o.after; first(); }; talkLine(lines.shift(), lines); });
    }
    // ---------- phone: no fight (you'd need three thumbs), tic-tac-toe instead, first to 3. You're X, Galaxi is O ----------
    const phone = test && "phone" in test ? test.phone : matchMedia("(hover: none) and (pointer: coarse)").matches; // a touchscreen with no mouse
    const first = () => phone && boss.phone ? tttStart() : enemyTurn(); // what happens after the opening
    // boss.phone.stages: the board grows each time you're about to win ({ cols, rows, need: in a row to win, target: points to win, say })
    const MARK = { 1: img("assets/egg/ui/x.png"), 2: img("assets/egg/ui/o.png") }; // 16x16 white: you're X, Galaxi is O
    const mark = (p, cx, cy, k) => MARK[p].naturalWidth && ctx.drawImage(MARK[p], cx - k * 8, cy - k * 8, k * 16, k * 16); // k: whole-number scale, crisp (smoothing is off)
    let ttt = null; // { stage, cols, rows, need, target, b: cells (0 empty, 1 you, 2 Galaxi), wins, cur, you, him, round, turn, line, draws, at, then }
    const geo = () => { const s = ttt.rows > 3 ? 42 : 70, w = ttt.cols * s; return { s, x: 320 - w / 2, y: 424 - ttt.rows * s }; }; // bottom stays put, the tally sits under it
    const lineOf = (b, p) => ttt.wins.find(l => l.every(i => b[i] === p));
    const pickOne = l => l[Math.floor(Math.random() * l.length)];
    const linesOf = v => vary([].concat(typeof v === "function" ? v(ttt) : v || []));
    function talkThen(v, cb) { const ls = linesOf(v); if (!ls.length) return cb(); state = "talk"; after = cb; hit.clear(); tap = null; talkLine(ls.shift(), ls); }
    function tttBoard(n) { // set up stage n: its size, and every run of `need` in a row (across, down, both diagonals)
      const st = boss.phone.stages[n], { cols, rows, need } = st, wins = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        const l = Array.from({ length: need }, (_, k) => (r + dr * k) * cols + c + dc * k);
        if (r + dr * (need - 1) < rows && c + dc * (need - 1) >= 0 && c + dc * (need - 1) < cols) wins.push(l);
      }
      Object.assign(ttt, { stage: n, cols, rows, need, target: st.target, wins, b: Array(cols * rows).fill(0), cur: Math.floor(rows / 2) * cols + Math.floor(cols / 2) });
    }
    function tttStart() { ttt = { you: 0, him: 0, round: 0, draws: 0, hidden: true }; tttBoard(0); box.tw = box.th = 0; talkThen(boss.phone.intro, tttRound); } // the board appears once he's explained
    function tttRound() { ttt.hidden = false; ttt.b.fill(0); ttt.line = null; ttt.round++; ttt.turn = ttt.round % 2 ? 1 : 2; ttt.at = clock + 700; state = "ttt"; } // turns alternate who goes first
    function galaxiMove() { // wins if he can, blocks if he must, otherwise the cell on the most open lines; boss.phone.mistake of the time he just guesses
      const b = ttt.b, free = b.map((v, i) => v ? -1 : i).filter(i => i >= 0);
      const finish = p => free.find(i => { b[i] = p; const w = lineOf(b, p); b[i] = 0; return w; });
      if (Math.random() < (boss.phone.mistake ?? .3)) return pickOne(free);
      const w = finish(2) ?? finish(1); if (w !== undefined) return w;
      const score = i => ttt.wins.reduce((n, l) => { if (!l.includes(i)) return n; const mine = l.filter(j => b[j] === 2).length, yours = l.filter(j => b[j] === 1).length;
        return n + (!yours ? 1 + 2 * mine : 0) + (!mine ? .5 + yours : 0); }, 0);
      const best = Math.max(...free.map(score)); return pickOne(free.filter(i => score(i) === best));
    }
    function tttMove(p, i) {
      ttt.b[i] = p; p === 1 ? sfx.select() : sfx.move();
      const line = lineOf(ttt.b, p), full = ttt.b.every(Boolean);
      if (line || full) { ttt.line = line; state = "tttEnd"; ttt.at = clock + 1000; ttt.then = () => tttOver(line ? p : 0); return; }
      ttt.turn = 3 - p; ttt.at = clock + 650;
      if (ttt.turn === 2 && Math.random() < (boss.phone.quipChance ?? .35)) bubble = { text: pickOne(boss.phone.quips), n: 0, t: 0, quiet: false, life: 900 };
    }
    function tttOver(w) { // w: 1 you won the round, 2 Galaxi did, 0 a draw (doesn't score; enough in a row and he rage quits)
      const P = boss.phone;
      if (!w) { ttt.draws++; return ttt.draws > P.draws.length ? talkThen(P.rageQuit, () => tttEnd("rage")) : talkThen(P.draws[ttt.draws - 1], tttRound); }
      ttt.draws = 0; if (w === 1) ttt.you++; else ttt.him++;
      if (ttt.him >= ttt.target) return talkThen(P.youLose, () => tttEnd("lose"));
      if (ttt.you >= ttt.target) { const next = P.stages[ttt.stage + 1]; // about to lose: he moves the goalposts while he still can
        if (!next) return talkThen(P.youWin, () => tttEnd("win"));
        return talkThen(next.say, () => { tttBoard(ttt.stage + 1); tttRound(); }); }
      talkThen(w === 1 ? P.roundWin : P.roundLose, tttRound);
    }
    function tttEnd(how) { ttt = null; box.tw = MW; box.th = MH; foe.spared = how !== "lose"; state = "end"; say(linesOf(boss.phone.end[how]), exit); }
    function tttUpdate() {
      if (state === "tttEnd") { if (clock >= ttt.at) ttt.then(); return; }
      if (clock < ttt.at) return;
      if (ttt.turn === 2) return tttMove(2, galaxiMove());
      const { x, y, s } = geo(), C = ttt.cols, R = ttt.rows, k = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].find(k => hit.has(k));
      if (k) { const c = ttt.cur % C, r = Math.floor(ttt.cur / C); ttt.cur = { ArrowLeft: r * C + Math.max(0, c - 1), ArrowRight: r * C + Math.min(C - 1, c + 1), ArrowUp: Math.max(0, r - 1) * C + c, ArrowDown: Math.min(R - 1, r + 1) * C + c }[k]; sfx.move(); }
      const tapped = tap && inside(tap, x, y, s * C, s * R);
      if (tapped) ttt.cur = Math.min(R - 1, Math.floor((tap.y - y) / s)) * C + Math.min(C - 1, Math.floor((tap.x - x) / s));
      if ((tapped || confirm()) && !ttt.b[ttt.cur]) tttMove(1, ttt.cur);
    }
    function drawTtt() {
      const { x, y, s } = geo(), C = ttt.cols, R = ttt.rows, k = s >= 60 ? 3 : 2, at = i => [x + (i % C) * s + s / 2, y + Math.floor(i / C) * s + s / 2];
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 5; ctx.strokeRect(x - 2.5, y - 2.5, s * C + 5, s * R + 5);
      ctx.lineWidth = 3; ctx.beginPath();
      for (let c = 1; c < C; c++) { ctx.moveTo(x + c * s, y); ctx.lineTo(x + c * s, y + s * R); }
      for (let r = 1; r < R; r++) { ctx.moveTo(x, y + r * s); ctx.lineTo(x + s * C, y + r * s); }
      ctx.stroke();
      ttt.b.forEach((v, i) => { if (v && !(ttt.line && ttt.line.includes(i) && Math.floor(clock / 150) % 2)) mark(v, ...at(i), k); }); // the winning line blinks
      if (state === "ttt" && ttt.turn === 1 && !phone && !ttt.b[ttt.cur]) { ctx.globalAlpha = .35; mark(1, ...at(ttt.cur), k); ctx.globalAlpha = 1; } // keyboard cursor
      // the tally under the board, centred: [SOUL] YOU 1 - 0 GALAXI in the box font (fnt_main), "first to N" under it in the HP line's (fnt_curs)
      const M = BMF.main, parts = [["YOU", "#f00"], [`  ${ttt.you} - ${ttt.him}  `, "#fff"], ["GALAXI", "#fff"]], w = 24 + parts.reduce((n, [t]) => n + bmWidth(M, t), 0);
      let tx = Math.round(320 - w / 2); heart(tx + 8, 444); tx += 24;
      for (const [t, c] of parts) { bmText(M, t, tx, 432, c); tx += bmWidth(M, t); }
      const best = `FIRST TO ${ttt.target}${ttt.need > 3 ? ", " + ttt.need + " IN A ROW" : ""}`; bmText(BMF.curs, best, Math.round(320 - bmWidth(BMF.curs, best) / 2), 460, "#808080");
      if (state === "ttt") { const t = ttt.turn === 1 ? "YOUR TURN" : "..."; bmText(M, t, 630 - bmWidth(M, t), 286); }
    }
    function drawIntro() {
      const fx = btns[0].x + 20, fy = btns[0].y + 21;
      if (clock < INTRO_BLINK) { if (Math.floor(clock / 100) % 2 === 0) heart(320, 240); }
      else { const k = Math.min(1, (clock - INTRO_BLINK) / INTRO_DROP), e = 1 - (1 - k) ** 2; heart(320 + (fx - 320) * e, 240 + (fy - 240) * e); }
    }

    // text in the main box: lines typed out one by one, Z to advance, then cb()
    function say(lines, cb) { queue = [].concat(vary(lines)).filter(Boolean); after = cb; state = "text"; nextLine(); }
    function startLine(l) { l = vary(l); if (l && l.text && l.text.oneOf) l = { ...l, text: vary(l.text) }; /* { text: one(...) } works too */ const snd = lineSound(l); if (snd) play(snd, boss.voiceVolume ?? 1); if (l && typeof l.at === "function") try { l.at(); } catch (e) { console.error(e); } // at: an event's cue, run as the line starts
      return { text: lineText(l), n: 0, t: 0, quiet: !!snd, go: !!(l && l.go), shake: !!(l && l.shake), voice: l && l.voice, face: l && l.face }; } // voice / face: a line in someone else's voice blip and font (e.g. SANS)
    // a Galaxi speech line; one marked go: true starts the attack as it's said, and its bubble stays up a moment during the attack
    function talkLine(l, rest) { talk = startLine(l); talk.rest = rest; if (talk.go) { bubble = { ...talk, life: 1600 }; talk = null; const cb = after; after = null; cb(); } }
    function nextLine() { if (!queue.length) { const cb = after; after = null; return cb && cb(); }
      const l = queue.shift();
      if (l && l.dust) { typing = null; state = "dust"; foe.dust = { t: 0 }; sfx.dust(); return; } // { dust: true }: he turns to dust like an UNDERTALE monster, then the box text carries on
      if (l && l.bubble) { typing = null; state = "talk"; hit.clear(); tap = null; // the Z that got here doesn't also skip the bubble
        const cb = after; after = () => { state = "text"; after = cb; nextLine(); }; return talkLine(l, []); } // bubble: true = Galaxi says it in his speech bubble, then the box text carries on
      typing = startLine(l); }
    function toMenu() { bubble = null; state = "menu"; sub = null; soul.inv = 0; box.tw = MW; box.th = MH; shown = { text: "", n: 0, t: 0 };
      if (menuHooks.length) { const labels = btns.map(b => b.t), was = Object.fromEntries(btns.map(b => [b.t, b.x])); btnLabels = [...labels]; try { menuHooks.shift()(labels); } catch (e) { console.error(e); }
        btns.forEach((b, i) => { b.t = labels[i]; b.from = was[b.t]; }); btnAt = clock; } } // an event rearranging the menu: each label slides to its new spot (put back at the next enemy turn)
    let btnAt = -1e9; // when the buttons last moved (they hop to their new spots over 450ms)
    let shown = { n: 0, t: 0 }; // how much of the menu's flavor line has typed out
    // ---------- meta events: Galaxi using the situation to his advantage. Each one lives in assets/egg/events/<name>.js and registers
    // window.GALAXI_EVENTS[name] = { can(ctx), start(ctx, fx) }; boss.eventFiles lists them. 3-4 trigger a run (boss.eventsPerRun), on
    // enemy turns after the first, never two turns in a row, each at most once. test.events = ["name", ...] forces them, one a turn ----------
    let plan = null, cur = null; // plan: { queue, next } for this fight; cur: the triggered event's per-attack state (reset each enemy turn)
    let afterHooks = [], menuHooks = [], pickHooks = {}, trap = null, modal = null, btnLabels = null; const eventSprites = {};
    function planEvents() {
      const all = window.GALAXI_EVENTS || {}, forced = test && test.events, names = (forced || Object.keys(all)).filter(n => all[n] && (forced || !all[n].rare || Math.random() < all[n].rare)); // rare: the chance it's even in the running this fight
      afterHooks = []; menuHooks = []; pickHooks = {}; trap = null; modal = null; cur = null;
      if (phone || !names.length || boss.eventsPerRun === 0) return plan = null;
      const [lo, hi] = boss.eventsPerRun || [3, 4], n = forced ? names.length : lo + Math.floor(Math.random() * (hi - lo + 1));
      plan = { queue: forced ? [...names] : names.sort(() => Math.random() - .5).slice(0, n), next: forced ? (test.eventFrom ?? 1) : 1 + Math.floor(Math.random() * 2), gap: forced ? 1 : 2 };
    }
    const fxFor = (ctx, c) => ({ // the toolkit an event's start(ctx, fx) gets (assets/egg/events/README.md)
      lines(l) { c.lines.push(...[].concat(vary(l))); },                                 // Galaxi says these before the attack
      attack(fn, o = {}) { c.attack = fn; if (o.box) c.box = o.box; if (o.time) c.time = o.time; c.solo = !!o.solo; }, // swap this turn's attack for fn(a) (solo: drop the turn's story lines too)
      flavor(l) { (cur || c).flavor = l; },                                                         // the narrator's menu line once the event's attack is over ("* ..."), so you know what just happened
      foeHeal(n) { const was = foe.hp; foe.hp = Math.min(foe.max, foe.hp + n); sfx.heal(); fx.push({ kind: "heal", text: "+" + n, from: was, t: 0, life: 1500 }); }, // Galaxi heals: green number over his head, his HP bar fills
      onPick(label, start) { pickHooks[label] = start; },                                  // the next time you pick that menu button it's a trap: start(ctx, fx) runs as an event on the enemy turn it costs you
      buttons: btns,                                                                       // the 4 menu buttons { t, x, y, w, h }; set dx / dy to nudge one (a hand yanking it)
      mods: c.mods,                                                                        // { speed, soulSpeed, soulSize, invert, boxScale, boxW, boxH, bulletScale, hideFoe, bubbleAt: [x, y] } for this attack
      during(fn) { c.during.push(fn); },                                                  // fn(a) right after the attack starts (a = the attack api)
      draw(fn, o = {}) { fn.menu = !!o.menu; c.draw.push(fn); },                         // fn(ctx, ms since the event started, state) on top; fades out when its attack ends ({ menu: true }: stays for the menu after)
      zoom(k) { c.zoom = k; },                                                            // camera zoom on the heart for this attack
      box,                                                                                 // box.ox / box.oy move the box (reset after the attack)
      after(fn) { afterHooks.push(fn); },                                                 // fn({ hits, damage, turn }) after an attack; return { lines, replay: speed } to act (kept until it returns something)
      menu(fn) { menuHooks.push(fn); },                                                   // fn(labels) at the next menu: rearrange the 4 button labels (put back after one pick)
      modal(update, draw) { modal = { update, draw, t: 0 }; },                            // freeze everything: update(dt, input) each frame until it returns true; draw(ctx, t)
      pause(ms, draw) { modal = { update: (dt, i, m) => m.t >= ms, draw, t: 0 }; },      // freeze everything for ms
      fakeDeath(ms) { const d = deathScreen(soul.x, soul.y); modal = { update: (dt, i, m) => { d.update(m.t, dt); return m.t >= ms; }, draw: (c, t) => d.draw(t), t: 0 }; }, // the real death screen for ms (the music keeps going: the tell)
      sprite: n => eventSprites[n] || (eventSprites[n] = img(`assets/egg/events/sprites/${n}.png`)), // an editable PNG from events/sprites/ (draw it once .naturalWidth is set)
      foe, player, sfx, play, story: storyMode, speak: () => speak(boss.voice), heart: (x, y, col) => heart(x, y, col), text: (...a) => text(...a), wrapText: (...a) => wrapText(...a),
    });
    function triggerEvent(t) { // called by enemyTurn: maybe start the next planned event on this turn
      cur = { lines: [], mods: {}, during: [], draw: [], zoom: 1, born: clock, attack: null };
      if (btnLabels) { btns.forEach((b, i) => b.t = btnLabels[i]); btnLabels = null; } // a shuffled menu goes back to normal
      btns.forEach(b => { b.dx = b.dy = 0; b.from = null; });
      const all = window.GALAXI_EVENTS, ctx = { turn: t, attack: t.attack, foe, player, loop: foe.loop, story: storyMode };
      if (trap) { const f = trap; trap = null; cur.name = "trap"; if (plan) plan.next = Math.max(plan.next, turn - 1 + plan.gap); try { f(ctx, fxFor(ctx, cur)); } catch (e) { console.error("trap", e); } return; } // you walked into an onPick trap: it's this turn's event
      if (!plan || !plan.queue.length || turn - 1 < plan.next) return;
      const i = plan.queue.findIndex(n => !t.sneak && (!all[n].can || all[n].can(ctx)));
      if (i < 0) return; // nothing fits this turn: try the next
      const name = plan.queue.splice(i, 1)[0]; plan.next = turn - 1 + plan.gap; cur.name = name;
      try { all[name].start(ctx, fxFor(ctx, cur)); } catch (e) { console.error("event " + name, e); }
    }
    // foe speech bubble, then its attack
    function enemyTurn() {
      if (foe.hp <= 0) return win();
      const t = boss.turns[turn % boss.turns.length]; foe.loop = Math.floor(turn / boss.turns.length); turn++; // loop: how many times he's run out of attacks
      const fl = v => { v = typeof v === "function" ? v(foe, player) : v; return vary(Array.isArray(v) ? (boss.pick ? boss.pick(v) : v[Math.floor(Math.random() * v.length)]) : v); }; // a list of flavor lines: one at random (boss.pick: no repeats)
      flavor = vary(firstFlavor) || fl((boss.reactFlavor || {})[foe.last]) || fl(t.flavor) || flavor; firstFlavor = null;
      triggerEvent(t);
      if (t.sneak) { firstTurn = false; ready = t; return dodge(t); } // sneak: no speech, no box resize, no heart glide; the attack runs the show (it starts looking like the menu)
      const aside = boss.aside ? boss.aside({ foe, player, turn: turn - 1, deaths, story: storyMode, first: firstTurn }) || [] : []; firstTurn = false; // lines that can come up on any turn (retries, low HP, out of attacks)
      const r = (boss.react || {})[foe.last];
      const lines = vary([].concat(aside, storyMode && !cur.solo ? (typeof t.before === "function" ? t.before(foe) : t.before) || (typeof r === "function" ? r(foe, player) : r) || t.otherwise || [] : [], cur.lines, (cur && cur.attack) ? [] : typeof t.say === "function" ? t.say(foe) : t.say || [])); // reacting to your pick comes first (right after it), then the event, then the attack's intro (an event that swaps the attack drops it). before: story lines, skipped on a plain retry
      // like Undertale: the box shrinks to the attack's size while Galaxi talks, with the SOUL already inside it,
      // and the attack only starts once the box has finished resizing
      setBox(t);
      soul.mario = t.soul === "mario"; soul.blue = soul.mario || t.soul === "blue";
      glideTo(320, soul.blue ? BOT - SOUL / 2 : BOT - box.th / 2); // a gravity SOUL waits at the bottom, where it'll be standing
      ready = t;
      if (lines.length) { state = "talk"; after = () => { state = "ready"; }; talkLine(lines.shift(), lines); }
      else state = "ready";
    }
    // the heart never teleports: it eases to where it's needed (into the box while Galaxi talks, then to the attack's start spot)
    function glideTo(x, y) {
      const d = Math.hypot(x - soul.x, y - soul.y);
      soul.glide = d < 1 ? null : { fx: soul.x, fy: soul.y, tx: x, ty: y, t: 0, ms: Math.min(450, 180 + d * 1.5) };
      if (!soul.glide) { soul.x = x; soul.y = y; }
    }
    function stepGlide(dt) { // true while still moving
      const g = soul.glide; if (!g) return false;
      const k = Math.min(1, (g.t += dt) / g.ms), e = 1 - (1 - k) ** 3; // ease-out
      soul.x = g.fx + (g.tx - g.fx) * e; soul.y = g.fy + (g.ty - g.fy) * e;
      if (k >= 1) soul.glide = null;
      return true;
    }
    let ready = null, bubble = null, fakeMenu = false; // fakeMenu: an attack is pretending it's the player's turn // the turn waiting for the box to finish resizing; a go: line's bubble still showing
    let round = { hits: 0, dmg: 0, healed: 0 }; // this attack: hits taken, damage, HP healed (capped at boss.healCap)
    function setBox(t) { const [w, h] = (cur && cur.box) || t.box || [160, 140], k = (cur && cur.mods.boxScale) || 1; box.tw = Math.round(w * k * ((cur && cur.mods.boxW) || 1)); box.th = Math.round(h * k * ((cur && cur.mods.boxH) || 1)); } // boxW / boxH: an event stretching one side
    // the attacks' dice: a fixed seed per turn (and per event attack), so the same turn is the same pattern every run
    const seeded = str => { let s = 0; for (const ch of str) s = Math.imul(s ^ ch.charCodeAt(0), 2654435761); return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
    let rnd = Math.random;
    function dodge(t) {
      const a = (cur && cur.attack) || boss.attacks[t.attack];
      state = "dodge"; bullets = []; timers = []; clock = 0; round = { t, hits: 0, dmg: 0, healed: 0 };
      setBox(t);
      const fromX = soul.x, fromY = soul.y; // where the heart is now: it glides from here once the attack has placed it
      soul.x = 320; soul.y = BOT - box.th / 2; soul.mario = t.soul === "mario"; soul.blue = soul.mario || t.soul === "blue"; soul.vy = 0; soul.grounded = false; soul.hide = false;
      soul.vx = 0; soul.acc = 0; soul.held = true; soul.buffer = soul.coyote = 0; soul.green = soul.purple = null;
      attackEnd = (cur && cur.time) || t.time || 6000;
      rnd = seeded(t.attack + (cur && cur.attack ? "/" + cur.name : "") + "/" + (boss.turns.indexOf(t) % (boss.turns.length || 1)));
      a(api);
      if (cur) for (const f of cur.during) try { f(api); } catch (e) { console.error(e); }
      const q = !(cur && cur.attack) && boss.quips && boss.quips[t.attack], chat = q && !t.quips && boss.chatter ? boss.chatter(foe) : null; // chat: sometimes a random thought instead of the attack's quip (a two-liner: the 2nd 1.9s later)
      const quips = (cur && cur.attack) ? [] : typeof t.quips === "function" ? t.quips(foe) : t.quips || (chat ? vary([].concat(chat)).map((l, k) => [q.at + k * 1900, l]) : q ? [[q.at, boss.pick ? boss.pick(q.lines) : q.lines[0]]] : []);
      for (const [ms, l] of quips) api.after(ms, () => typeof l === "string" ? api.say(l, 1700) : api.say(l.text, 1700, false, l)); // (a line object: its own voice / font) // Galaxi talking mid-attack, Sans-style (boss.quips: one per attack, picked from its pool)
      if (t.sneak) return; // the attack places (and usually hides) the heart itself
      const toX = soul.x, toY = soul.y; soul.x = fromX; soul.y = fromY; glideTo(toX, toY); // the attack's clock waits for this
    }
    // still going: a blaster / warning mid-tell, or a hazard (spawned hurting) still inside the box. Scenery (fixed) doesn't count
    const live = b => { if (b.dead || b.fixed) return false; if (b.tell) return true; if (!b.hz) return false; const B = api.box;
      return b.x + b.w / 2 > B.left && b.x - b.w / 2 < B.right && b.y + b.h / 2 > B.top && b.y - b.h / 2 < B.bottom; };
    function endDodge() {
      const c = boss.concede, quit = c && foe.last === "Compliment" && foe.flags.nice >= c.at; // complimented him enough: he gives up
      const react = !quit && storyMode && boss.afterAttack && !(cur && cur.attack) ? vary([].concat(boss.afterAttack({ foe, player, hits: round.hits, damage: round.dmg, attack: round.t && round.t.attack }) || [])) : []; // how that attack went
      let replay = null; // an event's after hook: e.g. re-record the attack
      for (const h of [...afterHooks]) { let r = null; try { r = h({ hits: round.hits, damage: round.dmg, turn: round.t, draw: f => cur && cur.draw.push(f) }); } catch (e) { console.error(e); }
        if (r) { afterHooks.splice(afterHooks.indexOf(h), 1); if (r.lines || r.replay) { replay = r; break; } } } // a result is spent; only lines/replay act. draw: an overlay from now on
      foe.last = null; bullets = []; timers = []; api.musicRate(1); fakeMenu = false; box.ox = box.oy = 0;
      if (foe.hp <= 0) return win(); // an attack beat him (api.hitFoe)
      const done = () => { if (!cur) return; cur.overAt = cur.t || 0; if (cur.flavor) { flavor = vary(cur.flavor); cur.flavor = null; } }; // the event's attack is over: overlays fade, the narrator sums it up
      if (replay && !replay.replay) done(); // (a replay keeps them up for take 2)
      if (replay && !quit) { const l = vary([].concat(replay.lines || [])), go = !replay.replay ? toMenu : () => { cur.mods.speed = replay.replay; setBox(round.t); ready = round.t; state = "ready"; glideTo(320, BOT - box.th / 2); }; // lines only: back to the menu
        if (!l.length) return go(); state = "talk"; bubble = null; after = go; return talkLine(l.shift(), l); }
      done();
      if (!quit && react.length) { state = "talk"; bubble = null; after = toMenu; return talkLine(react.shift(), react); }
      if (!quit) return toMenu();
      const lines = vary([...c.say]); state = "talk"; after = () => { foe.spare = Infinity; toMenu(); flavor = vary(c.flavor) || flavor; }; talkLine(lines.shift(), lines); // SPARE turns yellow
    }
    function win() { state = "end"; box.tw = MW; box.th = MH; box.ox = box.oy = 0; soul.hide = false; soul.inv = 0; // back to the text box (an attack can win mid-dodge: api.hitFoe)
      const at = foe.flags.soulAt; if (at) { soul.x = at.x; soul.y = at.y; outro = { runAt: null }; } // foe.flags.soulAt: an attack left the heart there for the ending; it runs off once the narrator starts
      say([].concat(boss.onWin(foe)), exit); }
    let outro = null;
    function spare() { state = "end"; foe.spared = true; sfx.spare(); say([].concat(boss.onSpare(foe)), exit); }
    // Undertale's death: the SOUL freezes, cracks, shatters into falling shards, then GAME OVER fades in and a line is typed out
    let deadLine = null, death = null;
    // the death screen's whole timeline in one place, so the fake one (events/fakeover.js) is the real one frame for frame:
    // update(t, dt) plays its sounds and types the line, draw(t) draws it all over black. t: ms since the heart froze
    function deathScreen(sx, sy) {
      const sh = Array.from({ length: 6 }, (_, i) => ({ vx: (i - 2.5) * 1.3 + Math.random() - .5, vy: -3 - Math.random() * 2 })), done = {}, line = { text: vary(boss.onDeath) || "Stay determined!", n: 0, t: 0 };
      const once = (t, k, at, fn) => { if (t >= at && !done[k]) { done[k] = true; fn(); } };
      return { line,
        update(t, dt) { once(t, "crack", 650, sfx.crack); once(t, "shatter", 1450, sfx.shatter); once(t, "voice", 4000, () => boss.onDeathSound && play(boss.onDeathSound, boss.voiceVolume ?? 1));
          if (t > 4000) type(line, dt, boss.narrator || SFX.txt1); },
        draw(t) { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
          if (t < 650) heart(sx, sy); else if (t < 1450) { heart(sx - 2, sy, "#f00", -1); heart(sx + 2, sy, "#f00", 1); } // cracked down the middle
          else { const f = (t - 1450) / 16.7; for (const p of sh) pixels(["0110", "1111", "0110"], sx + p.vx * f - 4, sy + p.vy * f + .125 * f * f - 3, 2, "#f00"); } // the shards fall
          if (t > 2600 && ui.gameover.naturalWidth) { ctx.globalAlpha = Math.min(1, (t - 2600) / 1200); ctx.drawImage(ui.gameover, 0, 36); ctx.globalAlpha = 1; } // UNDERTALE's spr_gameoverbg
          if (t > 4000) { drawRows(BMF.main, line.text, line.n, 120, 324, 400);
            if (line.n >= line.text.length) { const h = (s, y) => bmText(BMF.curs, s, Math.round(320 - bmWidth(BMF.curs, s) / 2), y, "#808080"); h("Z / tap: try again    X: leave", 424); h("R / tap here: replay with dialogue", 452); } } } };
    }
    function gameOver() {
      deaths++; soul.dead = 1; state = "dead"; clock = 0; bullets = []; stopMusic();
      death = deathScreen(soul.x, soul.y); deadLine = death.line;
    }
    function exit() { cleanup(); }

    // ---------- the attack API (what boss.js attacks get) ----------
    const api = {
      get box() { return { left: 320 + box.ox - box.tw / 2, right: 320 + box.ox + box.tw / 2, top: BOT + box.oy - box.th, bottom: BOT + box.oy, width: box.tw, height: box.th }; }, // the size it's growing/shrinking to
      soul: { get x() { return soul.x; }, set x(v) { soul.x = v; }, get y() { return soul.y; }, set y(v) { soul.y = v; },
        get vy() { return soul.vy; }, set vy(v) { soul.vy = v; }, get grounded() { return soul.grounded; }, // vy/grounded: blue SOUL only
        get blue() { return soul.blue; }, set blue(v) { soul.blue = !!v; soul.grounded = false; }, set ut(v) {}, // blue mid-attack: UNDERTALE's own blue physics (vy in px per 30fps frame). ut: kept so old attacks still run (blue is always UNDERTALE's now)
        get hide() { return soul.hide; }, set hide(v) { soul.hide = v; }, get inv() { return soul.inv; }, set inv(v) { soul.inv = v; }, // inv: ms of flashing i-frames left // hide: don't draw the heart (it still gets hit), e.g. while it's inside a Poke Ball
        get mode() { return soul.green ? "green" : soul.purple ? "purple" : soul.blue ? "blue" : "red"; },
        // mode(m, o): change SOUL mid-attack. "green": frozen at the box middle with Undyne's shield (o.dir: where it starts facing, 90 = up).
        // "purple": Muffet's strings, o.lines = the strings' y (top to bottom), o.start = which one, o.xlen = how far either side of the middle,
        // o.hideLines: the attack draws its own strings. "red" / "blue": back to normal / gravity
        setMode(m, o = {}) { soul.green = soul.purple = null; soul.blue = m === "blue"; soul.grounded = false;
          if (m === "green") { const B = api.box; soul.x = (B.left + B.right) / 2; soul.y = (B.top + B.bottom) / 2; soul.green = { dir: o.dir ?? 90, ideal: o.dir ?? 90, flash: 0 }; }
          if (m === "purple") { const B = api.box, i = o.start ?? Math.floor(o.lines.length / 2); soul.purple = { ys: o.lines, i, xmid: (B.left + B.right) / 2, xlen: o.xlen ?? 100, hideLines: !!o.hideLines }; soul.x = (B.left + B.right) / 2; soul.y = o.lines[i]; } },
        stomp() { soul.vy = soul.mario ? -PLAT.bounce : -.35; } }, // bounce off an enemy
      images, random: (a, b) => a + rnd() * (b - a), foe: () => foe, // rnd: reseeded per turn in dodge(), so every attack plays out the same each time (learnable, like UNDERTALE)
      // bullet: {x, y, vx, vy, w, h, image, color, rot, spin, damage, clip, update(b, dt, api), draw(ctx, b), solid} -> returns the bullet; set b.dead = true to remove
      // solid: a platform the blue SOUL stands on / bumps into (never hurts), bump(b) runs when the SOUL hits it from below.
      // draw: custom drawing, centred on the bullet
      bullet(b) { b = { vx: 0, vy: 0, w: 14, h: 14, rot: 0, spin: 0, damage: boss.damage || 3, clip: true, ...b }; const k = cur && cur.mods.bulletScale; if (k && b.damage) { b.w *= k; b.h *= k; b.k = k; } b.hz = b.damage > 0; bullets.push(b); return b; }, // k: an event's bigger bullets; hz: spawned as a hazard (an attack waits for these to leave the box before it ends)
      after(ms, fn) { timers.push({ at: clock + ms, fn }); },
      every(ms, fn, from = 0) { for (let t = from; t < attackEnd; t += ms) timers.push({ at: clock + t, fn }); },
      resize(w, h) { box.tw = w; box.th = h; },
      end() { attackEnd = clock; }, // finish the attack (once what's flying has left the box)
      get ending() { return state === "dodge" && clock >= attackEnd; }, // time's up, winding down: don't start anything new
      extend(ms) { attackEnd = Math.max(attackEnd, clock + ms); }, // keep the attack going at least ms more (the Mario warp secret runs past the turn's time)
      hitFoe(dmg) { foe.lastHit = dmg; fx = fx.filter(f => f.kind !== "dmg"); fx.push({ kind: "dmg", n: dmg, from: foe.hp, delay: 0, t: 0, life: 47 * F }, { kind: "slash", k: 1.5, t: 0, life: 12 * F }); foe.hp = Math.max(0, foe.hp - dmg); }, // an attack hurting Galaxi (one damage number at a time: rapid hits would stack them unreadably): at 0 HP the fight is won when the attack ends
      menuLook(on) { fakeMenu = on; },
      get menuHeart() { const b = btns[menuIx]; return { x: b.x + 16, y: b.y + 22 }; }, // where the menu draws the SOUL on the selected button // draw the buttons exactly like the menu (selected one yellow, the SOUL on it)
      speak: () => speak(boss.voice), // one of Galaxi's voice blips
      say(text, ms = 1500, shake = false, o = {}) { text = vary(text); bubble = { text, n: 0, t: 0, quiet: false, life: ms, shake, voice: o.voice, face: o.face }; }, // o: { voice, face } (someone else's blip and font)
      setSprite(src) { const im = img(src); im.onload = () => { foeSprite = im; }; }, // what he looks like from now on (this fight); the normal sprite until it's loaded // Galaxi's speech bubble, typed with his voice blips, up for ms once typed (shake: shaky letters)
      damage(n) { // Sans-style: no flashing i-frames, so it can tick every few frames (a quieter hurt sound each time)
        if (foe.last === "Compliment") n = Math.ceil(n / 2);
        player.hp = Math.max(0, player.hp - n); round.hits++; round.dmg += n; play(SFX.hurt1, .4); if (player.hp <= 0) gameOver(); },
      steering: () => ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].some(k => down.has(k)) || !!drag, // pushing a direction
      key: k => down.has(k), tapped: k => hit.has(k), // a key held / pressed this frame ("ArrowUp", "z"...), for attacks with their own controls
      musicRate(rate, ms = 0) { if (!music) return; try { const p = music.playbackRate, t = ac.currentTime; // 0 freezes the music, 1 is normal
        mPos = songPos(t); mRamp = { from: rateAt(mRamp, t), to: rate, t0: t, t1: t + ms / 1000 }; // (keeps songPos right)
        p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); if (ms) p.linearRampToValueAtTime(rate, t + ms / 1000); else p.setValueAtTime(rate, t); } catch {} },
      bullets: () => bullets,   // every bullet on screen (e.g. to freeze them all)
      quake(i) { quake.i = Math.max(quake.i, i); quake.t = 1000 / 30; }, // shake the whole screen: ±i px, 1 less every 30fps frame (UNDERTALE's sans shaker)
      songPos: () => music ? songPos() % music.buffer.duration : null, // seconds into the battle music's loop (null: no music, e.g. the sim)
      pressed: () => hit.size > 0 || !!tap, // true on the frame any key is pressed or the screen is tapped (e.g. mashing to break free)
      heal(n, sound = true) { n = Math.min(n, (boss.healCap ?? Infinity) - round.healed); if (n <= 0) return; round.healed += n; player.hp = Math.min(player.max, player.hp + n); if (sound) sfx.heal(); }, // capped per attack
      tapped: k => hit.has(k),  // true on the frame that key went down ("ArrowUp" etc.; WASD count as arrows)
      mainText: (s, x, y, color) => bmText(BMF.main, s, x, y, color), // UNDERTALE's box font (fnt_main, 16px a letter), x / y: the top-left
      heart: (x, y, color) => heart(x, y, color), // draw the SOUL (inside a bullet's draw it follows the bullet's position/rotation)
      sfx,                      // the battle's sound effects, e.g. a.sfx.hit()
      play                      // play a sound file from boss.sounds, e.g. a.play("assets/egg/voice/ahaha.mp3")
    };

    // ---------- helpers ----------
    function moveSoul(x, y) {
      if (cur && cur.mods.soulSpeed === 0) return; // an event moving the heart itself (restock's inventory): no steering, no clamping to the box
      const S2 = SOUL * soulK() / 2, l = 320 + box.ox - box.w / 2 + S2, r = 320 + box.ox + box.w / 2 - S2, t = BOT + box.oy - box.h + S2, b = BOT + box.oy - S2;
      soul.x = Math.max(l, Math.min(r, x)); soul.y = Math.max(t, Math.min(b, y));
    }
    function hurt(d) { // true if that killed you
      if (soul.inv) return false;
      if (foe.last === "Compliment") d = Math.ceil(d / 2); // complimented: every hit of this attack does half
      d = Math.max(1, Math.round(d * (boss.damageScale ?? 1))); // boss.damageScale: the balance tuner's knob (tools/balance.py)
      player.hp = Math.max(0, player.hp - d); round.hits++; round.dmg += d; soul.inv = IFRAMES; sfx.hurt(); api.quake(2); // obj_shaker: the screen jolts 2px
      if (player.hp <= 0) { gameOver(); return true; }
      return false;
    }
    // one frame of the platformer heart. Jump = Up / Z / swipe up (hold for higher); move = arrows or drag toward where you want to go
    function marioFrame() {
      const s = soul, jump = down.has("ArrowUp") || down.has("z") || !!(drag && drag.cy < drag.y - 24);
      const dir = down.has("ArrowRight") ? 1 : down.has("ArrowLeft") ? -1 : drag && Math.abs(drag.cx - s.x) > 8 ? Math.sign(drag.cx - s.x) : 0;
      if (dir || s.grounded) { const acc = !s.grounded ? PLAT.airAccel : dir ? PLAT.accel : PLAT.stop; s.vx += Math.max(-acc, Math.min(acc, dir * PLAT.speed - s.vx)); } // letting go in the air keeps your drift
      // forgiving: a jump pressed a few frames before landing still happens (buffer), and works a few frames after walking off a ledge (coyote)
      s.buffer = jump && !s.held ? PLAT.buffer : s.buffer - 1; s.coyote = s.grounded ? PLAT.coyote : s.coyote - 1;
      if (s.buffer > 0 && s.coyote > 0) { s.vy = -PLAT.jump; s.grounded = false; s.buffer = s.coyote = 0; }
      if (!jump && s.held && s.vy < 0) s.vy *= PLAT.cut; // let go early = shorter jump
      s.held = jump;
      s.vy = Math.min(PLAT.maxFall, s.vy + (s.vy < 0 ? PLAT.gUp : PLAT.gDown)); // falls faster than it rises: snappy, not floaty
      blueMove(s.x + s.vx, s.y + s.vy);
    }
    // blue SOUL movement: box walls and ceiling, solid bullets to land on / bump into, no floor (falling out hurts)
    function blueMove(x, y) {
      const r = 6, L = 320 + box.ox - box.w / 2 + r, R = 320 + box.ox + box.w / 2 - r, T = BOT + box.oy - box.h + r;
      const solids = bullets.filter(b => b.solid);
      const at = (px, py) => solids.find(b => Math.abs(px - b.x) < b.w / 2 + r && Math.abs(py - b.y) < b.h / 2 + r);
      const want = x;
      x = Math.max(L, Math.min(R, x));
      let s = at(x, soul.y);
      if (s) x = x > s.x ? s.x + s.w / 2 + r : s.x - s.w / 2 - r;
      if (x !== want) soul.vx = 0; // ran into a wall
      soul.grounded = false;
      s = at(x, y);
      if (s) { if (soul.vy > 0) { y = s.y - s.h / 2 - r; soul.grounded = true; } else { y = s.y + s.h / 2 + r; if (soul.vy < 0 && s.bump) s.bump(s); } soul.vy = 0; } // bump: hit from below
      if (y < T) { y = T; soul.vy = 0; }
      soul.x = x; soul.y = y;
      // pushed out of the box by a wall, or fell down a pit: hurt, then drop back in from the top
      if (x < L - 1 || y > BOT + box.oy + 10) {
        // drop back in from the top above the nearest solid, so a pit can't swallow the SOUL over and over
        const land = solids.filter(b => b.x > L && b.x < R).sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
        soul.x = Math.max(L, Math.min(R, land ? land.x : soul.x)); soul.y = T; soul.vy = 0; soul.vx = 0; hurt(boss.fallDamage || 4);
      }
    }
    // UNDERTALE's SOUL has a precise collision mask: the heart's own 16x16 silhouette (spr_heart), and so do its bullets (their sprites).
    // So a hit is a heart pixel landing on a bullet pixel: each heart pixel's centre is tested against the bullet's rotated rectangle and,
    // for a bullet drawn from an image, against that image's opaque pixels too
    const HEART_PX = HEART.flatMap((r, j) => [...r].flatMap((c, i) => c === "1" ? [[i - 7.5, j - 7.5]] : []));
    const masks = new Map(); // image -> { w, h, a: Uint8Array of opaque pixels }
    const maskOf = im => { if (!im || !im.naturalWidth) return null; let m = masks.get(im); if (m) return m;
      const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext("2d"); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data, a = new Uint8Array(c.width * c.height); for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] > 0;
      masks.set(im, m = { w: c.width, h: c.height, a }); return m; };
    // the green SOUL's shield: a 60px bar 30px out from the heart, facing g.dir (degrees, 0 = right, 90 = up). A bullet marked block: true dies on it
    function blocked(b) { const g = soul.green, a = g.dir * Math.PI / 180, dx = b.x - soul.x, dy = b.y - soul.y, along = dx * Math.cos(a) - dy * Math.sin(a), side = dx * Math.sin(a) + dy * Math.cos(a);
      return along > 16 && along < 44 && Math.abs(side) <= 30; }
    function touches(b) {
      const c = Math.cos(b.rot || 0), s = Math.sin(b.rot || 0), ox = soul.x - b.x, oy = soul.y - b.y, k = soulK();
      if (Math.abs(ox) > b.w / 2 + b.h / 2 + 12 * k || Math.abs(oy) > b.w / 2 + b.h / 2 + 12 * k) return false; // nowhere near
      const m = !b.draw && b.image && maskOf(images[b.image]);
      for (const [px, py] of HEART_PX) { const hx = ox + px * k, hy = oy + py * k, u = hx * c + hy * s, v = -hx * s + hy * c; // heart pixel in the bullet's frame
        if (Math.abs(u) > b.w / 2 || Math.abs(v) > b.h / 2) continue;
        if (!m || m.a[Math.min(m.h - 1, Math.floor((v / b.h + .5) * m.h)) * m.w + Math.min(m.w - 1, Math.floor((u / b.w + .5) * m.w))]) return true; }
      return false;
    }
    function pixels(rows, x, y, k, color) { ctx.fillStyle = color; rows.forEach((row, j) => [...row].forEach((c, i) => c === "1" && ctx.fillRect(Math.round(x) + i * k, Math.round(y) + j * k, k, k))); }
    function heart(x, y, color = "#f00", half, k = 1) { // half: -1 = left half only, 1 = right half only (the cracked SOUL); k: 2 = double size, .5 = the 8px heart
      if (k < 1) return pixels(HEART_SMALL, x - 4, y - 4, 1, color);
      const rows = half ? HEART.map(r => half < 0 ? r.slice(0, 8) + "00000000" : "00000000" + r.slice(8)) : HEART;
      pixels(rows, x - 8 * k, y - 8 * k, k, color);
    }
    // spr_heart's 2 frames: hit, it flips to the dark frame every other 2 frames (image_speed 0.5) until the i-frames run out
    const tints = new Map(); // a white sprite in another colour (UNDERTALE tints its damage numbers)
    function tinted(im, color) { const k = im.src + color; let c = tints.get(k); if (c) return c; c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext("2d"); g.drawImage(im, 0, 0); g.globalCompositeOperation = "multiply"; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height); // white takes the colour, the black outline stays black
      g.globalCompositeOperation = "destination-in"; g.drawImage(im, 0, 0); tints.set(k, c); return c; }
    function soulColor() { const dark = soul.inv > 0 && Math.floor(clock / (2 * F)) % 2 ? 1 : 0; // the colours of spr_heart / _blue / _green / _purple, frame 1 and 2
      return (soul.green ? ["#00c000", "#008000"] : soul.purple ? ["#d535d9", "#8f1c93"] : soul.blue ? ["#003cff", "#001d7f"] : ["#f00", "#800000"])[dark]; }
    function soulK() { return (cur && cur.mods && cur.mods.soulSize) || 1; } // an event's heart size (patch notes): 2 or .5, whole pixels only
    const HEART_SMALL = ["01100110", "11111111", "11111111", "11111111", "01111110", "00111100", "00011000"];
    function text(s, x, y, size = 30, color = "#fff", align = "left", face = MONO) { ctx.font = `${size}px "${face}", monospace`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(s, x, y); ctx.textAlign = "left"; }
    function wrapText(s, width, size, face = MONO) { const f = BMF[face]; ctx.font = `${size}px "${face}", monospace`; const wid = f ? t => bmWidth(f, t) : t => ctx.measureText(t).width;
      const out = []; let line = ""; for (const w of s.split(" ")) { const t = line ? line + " " + w : w; if (wid(t) > width && line) { out.push(line); line = w; } else line = t; } out.push(line); return out; }
    // UNDERTALE's bitmap fonts (extracted from Galaxi's copy), laid out like obj_base_writer: a fixed advance per letter plus its few nudges.
    // glyphs: char -> [x, y, w, h, shift, offset] on the sheet; drawn 1:1 in the 640x480 battle space (UNDERTALE's battle room is 640x480 too)
    // main: the box text (typer 1, fnt_main: 16px a letter, 32px lines); plain: monster bubbles (fnt_plain, 9 / 20); comicsans: SANS's bubble
    // (typer 109, 10 / 20 and its nudges); curs: the name / LV / HP line (fnt_curs, drawn with draw_text, so each letter's own width)
    const BMF = { main: { src: "ut-main", spacing: 16, line: 32 }, plain: { src: "ut-plain", spacing: 9, line: 20 }, curs: { src: "ut-curs", spacing: 0, line: 18 },
      comicsans: { src: "ut-comicsans", spacing: 10, line: 20, kern: { w: 2, m: 2, i: -2, l: -2, s: -1, j: -1 } } };
    for (const f of Object.values(BMF)) { const src = "assets/egg/fonts/" + f.src; f.img = img(src + ".png"); fetch(base + src + ".json").then(r => r.json()).then(g => f.glyphs = g).catch(() => {}); }
    const bmAdv = (f, ch) => f.spacing ? f.spacing + ((f.kern || {})[ch] || 0) : ((f.glyphs || {})[ch] || [0, 0, 0, 0, 8])[4], bmWidth = (f, s) => [...s].reduce((n, c) => n + bmAdv(f, c), 0);
    // UNDERTALE wraps by hand (& in its strings) and indents the rest of a "* " line by two spaces; this wraps by width the same way.
    // -> rows { pre (the indent), body, at (where body starts in s) }, so a half-typed line (n letters of s) shows on the rows it will end up on
    function rowsOf(f, s, width) { const ind = s.startsWith("* ") ? "  " : "", out = []; let line = "", start = 0, at = 0;
      for (const w of s.split(" ")) { const pre = out.length ? ind : "";
        if (line && bmWidth(f, pre + line + " " + w) > width) { out.push({ pre, body: line, at: start }); line = w; start = at; } else { if (!line) start = at; line = line ? line + " " + w : w; }
        at += w.length + 1; }
      out.push({ pre: out.length ? ind : "", body: line, at: start }); return out; }
    function drawRows(f, s, n, x, y, width, color = "#fff", jig) { rowsOf(f, s, width).forEach((r, i) => { const k = Math.min(r.body.length, n - r.at); if (k > 0) bmText(f, r.pre + r.body.slice(0, k), x, y + i * f.line, color, jig); }); }
    const boxText = (s, n = s.length) => drawRows(BMF.main, s, n, 52, 270, 528); // the writer's spot in the menu box: (ideal0 + 20, ideal2 + 20), 33 letters a line
    function bmText(f, s, x, y, color = "#fff", jig) { // x, y: top-left of the line
      if (!f.glyphs || !f.img.naturalWidth) return;
      const k = color; f.tint = f.tint || {}; if (!f.tint[k]) { const c = document.createElement("canvas"); c.width = f.img.naturalWidth; c.height = f.img.naturalHeight; const g = c.getContext("2d"); g.drawImage(f.img, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height); f.tint[k] = c; }
      for (const ch of s) { const g = f.glyphs[ch]; if (g) ctx.drawImage(f.tint[k], g[0], g[1], g[2], g[3], Math.round(x + g[5] + (jig ? jig() : 0)), Math.round(y + (jig ? jig() : 0)), g[2], g[3]); x += bmAdv(f, ch); }
    }
    const confirm = () => hit.has("z") || hit.has(" "), cancel = () => hit.has("x");

    // ---------- main loop ----------
    let last = performance.now(), raf;
    function frame(now) { const dt = Math.min(50, now - last); last = now; step(dt); raf = requestAnimationFrame(frame); }
    function step(dt) { // one frame (the sim calls this too)
      if (state === "dodge") dt *= (foe?.last === "Spare" ? boss.spareRush || 1 : 1) * (foe?.loop ? boss.tired || 1 : 1) * ((cur && cur.mods.speed) || 1) * ((round.t && (round.t.speed ?? (boss.turnSpeeds || [])[boss.turns.indexOf(round.t)])) || 1); // spared too early / tired / an event / the turn's own pace (boss.turnSpeeds, set by tools/balance.py; the sim overrides it with turn.speed)
      if (cur) cur.t = (cur.t || 0) + dt;
      if (!modal) { clock += dt; update(dt); } else { modal.t += dt; if (bubble) type(bubble, dt, bubble.voice || boss.voice || 520); /* a frozen fight still types Galaxi's bubble (bad take: he talks over the rewind) */ if (hit.has("esc")) return cleanup(); if (modal.update(dt, { tapped: k => hit.has(k), confirm: confirm(), cancel: cancel(), tap, pressed: hit.size > 0 || !!tap }, modal)) modal = null; } // a modal freezes the fight
      if (!test || !test.nodraw || modal || (cur && cur.draw.length)) { draw(); if (modal && modal.draw) modal.draw(ctx, modal.t); } // test.nodraw: the sim skips frames nothing reads (event overlays time themselves in draw, so they still draw)
      hit.clear(); tap = null;
    }

    // obj_base_writer: a letter a frame; ^1-^9 in the text waits 10-90 frames after the next letter; X (or a tap) shows the rest at once,
    // Z only moves on once it's all out. Galaxi blips every other letter, anyone else every letter
    function type(o, dt, voice) {
      if (!o.pause) { o.pause = {}; let s = ""; for (let i = 0; i < o.text.length; i++) { if (o.text[i] === "^" && /[1-9]/.test(o.text[i + 1] || "")) { o.pause[s.length + 1] = o.text[++i] * 10 * F; continue; } s += o.text[i]; } o.text = s; }
      if (o.n >= o.text.length) return true;
      o.t += dt;
      while (o.t > F && o.n < o.text.length) { o.t -= F; o.n++; const ch = o.text[o.n - 1]; if (ch !== " " && (o.n % 2 || voice !== boss.voice) && !o.quiet) speak(voice); if (o.pause[o.n]) o.t -= o.pause[o.n]; }
      if (cancel() || tap) { o.n = o.text.length; return false; }
      return false;
    }

    function update(dt) {
      if (hit.has("esc")) return cleanup();
      // the box slides to its new size at a steady speed, like Undertale's (about 0.3s for menu <-> a small dodge box)
      // each edge moves 15px a frame (so the width changes 30), and like obj_uborder the top waits for the sides before it grows upward
      const toward = (v, t, k) => v < t ? Math.min(t, v + k * dt) : Math.max(t, v - k * dt);
      box.w = toward(box.w, box.tw, 2 * BOX_SPEED); if (box.w === box.tw || box.h > box.th) box.h = toward(box.h, box.th, BOX_SPEED);
      foe.shake = Math.max(0, foe.shake - dt);
      if (quake.i > 0 && (quake.t += dt) >= 1000 / 30) { quake.t -= 1000 / 30; quake.x = (Math.random() < .5 ? -1 : 1) * quake.i; quake.y = (Math.random() < .5 ? -1 : 1) * quake.i; quake.i--; } else if (quake.i <= 0) quake.x = quake.y = 0; // UNDERTALE's obj_sans_shaker
      for (const f of fx) if (f.kind === "dmg" && f.n && !f.landed && f.t >= f.delay) { f.landed = true; sfx.hit(); foe.shake = 32 * F; } // the number lands: hit sound, he shudders
      fx = fx.filter(f => (f.t += dt) < f.life);
      if (bubble && type(bubble, dt, bubble.voice || boss.voice || 520) && (bubble.life -= dt) <= 0) bubble = null;
      if (state === "intro") {
        introUpdate();
      } else if (state === "text") {
        if (type(typing, dt, boss.narrator || 300) && (confirm() || tap)) nextLine();
      } else if (state === "talk") {
        stepGlide(dt);
        if (type(talk, dt, talk.voice || boss.voice || 520) && (confirm() || tap)) {
          if (talk.rest.length) talkLine(talk.rest.shift(), talk.rest); else { const cb = after; after = null; talk = null; cb(); }
        }
      } else if (state === "dust") {
        if ((foe.dust.t += dt) > DUST + 900) { foe.gone = true; foe.dust = null; state = "text"; nextLine(); }
      } else if (state === "ttt" || state === "tttEnd") { tttUpdate();
      } else if (state === "menu") {
        // once the box has slid back to full size, the flavor line types out like Undertale's (Z still picks a button right away)
        if (shown.src !== flavor) shown = { src: flavor, text: flavor || "", n: 0, t: 0 };
        if (box.w === box.tw && box.h === box.th) type(shown, dt, boss.narrator || 300);
        const b = btns.findIndex(b => inside(tap, b.x, b.y, b.w, b.h));
        if (hit.has("ArrowLeft")) { menuIx = (menuIx + 3) % 4; sfx.move(); }
        if (hit.has("ArrowRight")) { menuIx = (menuIx + 1) % 4; sfx.move(); }
        if (b >= 0) menuIx = b;
        if (confirm() || b >= 0) { sfx.select(); openSub(btns[menuIx].t); }
      } else if (state === "sub") {
        const n = sub.options.length, cols = sub.cols || 2, was = subIx;
        if (sub.page) { const k = subIx % 4, c = k % 2; // ITEM: a 2x2 grid a page; Right off the 2nd column turns the page, Left off the 1st turns it back
          if (hit.has("ArrowDown") || hit.has("ArrowUp")) { const j = k < 2 ? subIx + 2 : subIx - 2; if (j < n) subIx = j; }
          if (hit.has("ArrowRight")) { const j = c ? subIx + 3 : subIx + 1; if (j < n) subIx = j; }
          if (hit.has("ArrowLeft")) { const j = c ? subIx - 1 : subIx - 3; if (j >= 0 && (c || subIx >= 4)) subIx = j; }
        } else {
          if (hit.has("ArrowDown")) subIx = Math.min(n - 1, subIx + cols);
          if (hit.has("ArrowUp")) subIx = Math.max(0, subIx - cols);
          if (hit.has("ArrowRight") && subIx % cols < cols - 1 && subIx + 1 < n) subIx++;
          if (hit.has("ArrowLeft") && subIx % cols) subIx--;
        }
        const t = sub.options.findIndex((o, i) => optHit(tap, i));
        if (t >= 0) subIx = t;
        if (subIx !== was) sfx.move();
        if (cancel() || (tap && t < 0 && tap.y < 400)) toMenu();
        else if ((confirm() || t >= 0) && n) { sfx.select(); sub.pick(sub.options[subIx], subIx); }
        const bb = btns.findIndex(b => inside(tap, b.x, b.y, b.w, b.h)); if (bb >= 0) { menuIx = bb; openSub(btns[bb].t); }
      } else if (state === "aim") { // obj_targetchoice: 11-13px a frame from the left edge; past the right end is a miss
        aim.x += dt * aim.v;
        if (confirm() || tap) strike(); else if (aim.x > 600) strike(true);
      } else if (state === "strike") {
        if (clock > aim.until) { aim = null; enemyTurn(); }
      } else if (state === "ready") {
        if (!stepGlide(dt) && box.w === box.tw && box.h === box.th) dodge(ready);
      } else if (state === "dodge") {
        if (stepGlide(dt)) { clock -= dt; return; } // frozen (bullets, timers, attack time) until the heart reaches its start spot
        const sp = SPEED * dt * ((cur && cur.mods.soulSpeed) || 1) * (down.has("x") ? .5 : 1), inv = cur && cur.mods.invert ? -1 : 1; // an event: slower heart / inverted controls
        let x = soul.x, y = soul.y; const px = x, py = y;
        soul.inv = Math.max(0, soul.inv - dt);
        if (soul.mario) { // platformer physics on a fixed 60 fps step, so it plays the same at any refresh rate
          soul.acc += dt;
          while (soul.acc >= MARIO_FRAME) { soul.acc -= MARIO_FRAME; marioFrame(); if (state !== "dodge") return; }
        } else if (soul.blue) { // UNDERTALE's own blue SOUL, its exact numbers (obj_heart, per 30fps frame; vy in px/frame): jump at 6, stepped gravity, let go early = -1
          const f = dt / (1000 / 30), S2 = SOUL * soulK() / 2, floor = BOT + box.oy - S2, top = BOT + box.oy - box.h + S2;
          if (down.has("ArrowLeft")) x -= sp * inv; else if (down.has("ArrowRight")) x += sp * inv;
          if ((down.has("ArrowUp") || tap) && soul.grounded) soul.vy = -6;
          if (!down.has("ArrowUp") && !drag && soul.vy <= -1) soul.vy = -1;
          const v = soul.vy; soul.vy += (v > .5 && v < 8 ? .6 : v > -1 && v <= .5 ? .2 : v > -4 && v <= -1 ? .5 : v <= -4 ? .2 : 0) * f;
          moveSoul(x, y + soul.vy * f); soul.grounded = soul.y >= floor - .01;
          if (soul.grounded && soul.vy > 0 || soul.y <= top + .01 && soul.vy < 0) soul.vy = 0;
        } else if (soul.green) { // Undyne's green SOUL (obj_spearblocker): the heart can't move; the arrows point the shield, which eases 2/3 of the way a frame, snapping inside 15 degrees
          const g = soul.green, k = ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].find(k => down.has(k));
          if (k) g.ideal = { ArrowRight: 0, ArrowUp: 90, ArrowLeft: 180, ArrowDown: 270 }[k];
          for (g.acc = (g.acc || 0) + dt; g.acc >= F; g.acc -= F) { const d = ((g.ideal - g.dir) % 360 + 540) % 360 - 180; g.dir = Math.abs(d) < 15 ? g.ideal : (g.dir + d * 2 / 3 + 360) % 360; if (g.flash > 0) g.flash--; }
        } else if (soul.purple) { // Muffet's purple SOUL (obj_purpleheart): along the string at 4px a frame, Up / Down hop one string per press, 3 frames a hop
          const p = soul.purple;
          if (down.has("ArrowLeft")) x -= sp * inv; else if (down.has("ArrowRight")) x += sp * inv;
          if (y === p.ys[p.i]) { if (hit.has("ArrowUp") && p.i > 0) p.i--; else if (hit.has("ArrowDown") && p.i < p.ys.length - 1) p.i++; }
          const to = p.ys[p.i], hop = Math.abs(p.ys[1] - p.ys[0] || 40) / 3 / F * dt; y = Math.abs(to - y) <= hop ? to : y + Math.sign(to - y) * hop;
          soul.x = Math.max(p.xmid - p.xlen, Math.min(p.xmid + p.xlen, x)); soul.y = y;
        } else {
          if (down.has("ArrowUp")) y -= sp * inv; else if (down.has("ArrowDown")) y += sp * inv;
          if (down.has("ArrowLeft")) x -= sp * inv; else if (down.has("ArrowRight")) x += sp * inv;
          moveSoul(x, y);
        }
        const moved = Math.abs(soul.x - px) > .01 || Math.abs(soul.y - py) > .01; // for blue / orange bullets (scr_damagestandard)
        const due = timers.filter(t => t.at <= clock); timers = timers.filter(t => t.at > clock); // split first, so timers can add timers
        due.forEach(t => t.fn(api));
        for (const b of bullets) {
          b.x += b.vx * dt / 16.7; b.y += b.vy * dt / 16.7; b.rot += b.spin * dt / 16.7;
          b.update && b.update(b, dt, api);
          if (state !== "dodge") return; // an update ended the attack (e.g. a.damage killed you)
          if (b.x + b.w / 2 < -200 || (b.vx >= 0 && b.x - b.w / 2 > W + 200) || b.y < -200 || b.y > H + 200) b.dead = true; // things still scrolling in from the right stay
          if (!b.dead && b.block && soul.green && blocked(b)) { b.dead = true; soul.green.flash = 5; play("assets/egg/sans/bell.mp3", .6); if (b.onBlock) b.onBlock(b); continue; } // the shield took it
          if (!b.dead && !b.solid && b.damage && (b.type !== "blue" || moved) && (b.type !== "orange" || !moved) && touches(b) && hurt(b.damage)) return; // blue: only if you moved, orange: only if you didn't
        }
        bullets = bullets.filter(b => !b.dead);
        if (clock >= attackEnd && (clock >= attackEnd + 2500 || !bullets.some(live))) endDodge(); // time's up: let what's already flying finish first (2.5s at most)
      } else if (state === "dead") {
        death.update(clock, dt);
        if (clock > 4000 && (hit.has("r") || inside(tap, 140, 452, 360, 28))) reset(true);
        else if (clock > 4000 && (confirm() || tap)) reset(false);
        if (clock > 4000 && cancel()) cleanup();
      }
    }

    const picked = k => { foe.last = k; foe.uses[k] = (foe.uses[k] || 0) + 1; }; // what you picked, and how many times this fight
    // where a sub-menu option goes (obj_battlecontroller, SCR_TEXT): the SOUL at (ideal0 + 32, ideal2 + 28) + 32px a row, the "* " 36px
    // right of it; ACT's 2nd column at ideal0 + 292, ITEM's at ideal0 + 280 with 4 to a page. -> { hx, hy: the SOUL's centre, tx, ty: the text's top-left }
    function optAt(i) { if (sub.page && Math.floor(i / 4) !== Math.floor(subIx / 4)) return null; // on another page
      const cols = sub.cols || 2, k = sub.page ? i % 4 : i, c = k % cols, r = Math.floor(k / cols);
      return { hx: c ? (sub.page ? 320 : 332) : 72, hy: 286 + r * 32, tx: c ? (sub.page ? 348 : 360) : 100, ty: 270 + r * 32 }; }
    const optHit = (p, i) => { const o = optAt(i); return o && inside(p, o.hx - 12, o.ty, 250, 32); };
    function openSub(name) {
      if (pickHooks[name]) { trap = pickHooks[name]; delete pickHooks[name]; picked(name); return enemyTurn(); } // an event rigged this button
      subIx = 0; state = "sub";
      if (name === "FIGHT") sub = { options: [{ label: boss.name, color: foe.spare >= (boss.spareAt || 1) ? YELLOW : "#fff" }], cols: 1, pick: () => { picked("FIGHT"); state = "aim"; aim = { x: 22, v: (11 + Math.random() * 2) / F }; } };
      if (name === "ACT") sub = { options: boss.acts.map(a => ({ label: a.name, act: a })), pick: o => { picked(o.act.name); const r = o.act.run(foe, player); say(r, enemyTurn); } };
      if (name === "ITEM") {
        if (!player.items.length) { say("* You have no items left.", toMenu); return; }
        sub = { page: true, options: player.items.map(i => ({ label: i.short || i.name, item: i })), pick: (o, i) => {
          picked(o.item.name); player.items.splice(i, 1); player.hp = Math.min(player.max, player.hp + o.item.heal); sfx.heal();
          say([`* You ${o.item.verb || "ate"} the ${o.item.name}.`, player.hp >= player.max ? "* Your HP was maxed out." : `* You recovered ${o.item.heal} HP!`].concat(o.item.text || []), enemyTurn);
        } };
      }
      if (name === "MERCY") sub = { options: [{ label: "Spare", color: foe.spare >= (boss.spareAt || 1) ? YELLOW : "#fff" }, { label: "Flee" }], cols: 1, pick: (o, i) => { picked(o.label);
        if (i === 1) { sfx.flee(); return say(boss.onFlee || "* You fled.", exit); }
        if (foe.spare >= (boss.spareAt || 1)) { const l = vary([].concat(boss.concede?.spared || [])); /* spared can be a one(...) of whole exchanges */ if (!l.length) return spare(); state = "talk"; after = spare; return talkLine(l.shift(), l); }
        say(boss.notSpareable || "* ...", enemyTurn);
      } };
    }

    // scr_attackcalc: 12px either side of the bar's middle is a critical (x2.2), anything else scales with how close it was (boss.playerAttack
    // is a perfect hit). obj_slice plays its 6 frames slower and smaller the further off you were; the number and the HP bar land
    // damagetimer frames in (the hit sound, Galaxi shudders), the bar drains over 30 frames, and it's gone 15 frames after he stops shaking
    function strike(missed) {
      const bonus = Math.max(1, Math.abs(aim.x + 7 - 319)), stretch = (562 - bonus) / 562, base = (boss.playerAttack || 22) / 2.2;
      const dmg = missed ? 0 : bonus <= 12 ? Math.round(base * 2.2) : Math.max(1, Math.round(base * stretch * 2));
      const spd = .5 - stretch / 4, wait = dmg ? (6 / spd + 3) * F : 0;
      foe.lastHit = dmg; sfx.swing(); state = "strike"; aim.fadeAt = clock + wait; aim.until = clock + wait + (dmg ? 47 : 40) * F;
      if (dmg) fx.push({ kind: "slash", k: stretch * 2 - .5, t: 0, life: 6 / spd * F });
      fx.push({ kind: "dmg", n: dmg, from: foe.hp, delay: wait, t: 0, life: wait + (dmg ? 47 : 40) * F });
      foe.hp = Math.max(0, foe.hp - dmg);
    }

    // ---------- drawing ----------
    function draw() {
      ctx.setTransform(R, 0, 0, R, 0, 0); ctx.imageSmoothingEnabled = false; // R: see fit()
      if (quake.x || quake.y) ctx.translate(quake.x, quake.y); // a.quake(): the whole screen jolts
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
      if (state === "dead") return drawDead();
      if (state === "intro") return drawIntro();
      const z = state === "dodge" && cur && cur.zoom > 1 ? cur.zoom : 1; // an event's camera zoom, centred on the heart (the stats and buttons stay put)
      if (z > 1) { ctx.save(); ctx.translate(soul.x, soul.y); ctx.scale(z, z); ctx.translate(-soul.x, -soul.y); }
      // foe
      const sx = foe.shake > 0 ? Math.ceil(foe.shake / (2 * F)) / 2 * (Math.floor(foe.shake / (2 * F)) % 2 ? 1 : -1) : 0; // UNDERTALE's shudder: 8px like SANS's (Froggit's is 16), sides swapped and smaller every 2 frames
      const bob = Math.round(Math.sin(clock / 500) * 2) * (boss.spriteScale || 2); // bobs in whole sprite pixels
      if (sprite.complete && sprite.naturalWidth && !foe.gone && !(cur && cur.mods.hideFoe)) { // (spared, he stays: only killing him dusts him). mods.hideFoe: an event drawing him somewhere else
        const k = boss.spriteScale || 2, w = sprite.naturalWidth * k, h = sprite.naturalHeight * k, // (a swapped sprite is drawn in the same frame as the normal one)
          X = Math.round(320 - w / 2 + sx), Y = Math.round(212 - h + bob);
        if (foe.dust) drawDust(X, Y, k); else ctx.drawImage(foeSprite.naturalWidth ? foeSprite : sprite, X, Y, w, h);
      }
      const fw = sprite.naturalWidth * (boss.spriteScale || 2) || 200, fh = sprite.naturalHeight * (boss.spriteScale || 2) || 150, ftop = 212 - fh; // his size on screen (the HP bar is as wide as him)
      for (const f of fx) {
        if (f.kind === "slash" && ui.slice.naturalWidth) { const fr = Math.min(5, Math.floor(f.t / f.life * 6)), k = f.k; ctx.drawImage(ui.slice, fr * 26, 0, 26, 110, Math.round(320 - 13 * k), Math.round(212 - fh / 2 - 55 * k), Math.round(26 * k), Math.round(110 * k)); } // centred on him
        if (f.kind === "dmg" && f.t >= f.delay) { // obj_dmgwriter: red digits 32px apart (or MISS in silver) hop up and settle, the bar under them drains
          const fr = (f.t - f.delay) / F, hop = fr < 16 ? Math.round(-4 * fr + .25 * fr * fr) : 0, ny = Math.max(4, ftop - 52) + hop, by = Math.max(4, ftop - 52) + 36;
          if (!f.n) { if (ui.miss.naturalWidth) ctx.drawImage(tinted(ui.miss, "#c0c0c0"), 320 - 62, ny); continue; }
          const ds = String(f.n); if (ui.dmgnum.naturalWidth) [...ds].forEach((d, i) => ctx.drawImage(tinted(ui.dmgnum, "#f00"), d * 36, 0, 36, 38, Math.round(320 - ds.length * 16 + i * 32), ny, 36, 38));
          const hp = Math.max(f.from - f.n, f.from - f.n / 15 * Math.floor(fr / 2)), bx = Math.round(320 - fw / 2);
          ctx.fillStyle = "#000"; ctx.fillRect(bx - 1, by - 1, fw + 2, 14); ctx.fillStyle = "#404040"; ctx.fillRect(bx, by, fw, 12); ctx.fillStyle = "#0f0"; ctx.fillRect(bx, by, Math.max(0, Math.round(fw * hp / foe.max)), 12);
        }
        if (f.kind === "heal") { // an event healed him: green number above his head (outlined so it reads over anything), the bar fills up
          const up = Math.min(1, f.t / 250) * 18, fade = Math.min(1, (f.life - f.t) / 300), y = Math.round(56 - up), hp = f.from + (foe.hp - f.from) * Math.min(1, f.t / 600);
          ctx.globalAlpha = fade; ctx.fillStyle = "#404040"; ctx.fillRect(220, 216, 200, 12); ctx.fillStyle = "#0f0"; ctx.fillRect(220, 216, Math.round(200 * hp / foe.max), 12);
          for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) text(f.text, 320 + dx, y + dy, 38, "#000", "center");
          text(f.text, 320, y, 38, "#0f0", "center"); ctx.globalAlpha = 1;
        }
      }
      const drawBubble = () => { // speech bubble (drawn after the box and bullets, so an event's full-screen UI never hides it)
      const sb = state === "talk" ? talk : state === "dead" ? null : bubble;
      if (sb && !(modal && sb.n === 0)) { // (a cutscene cued by a line: its bubble waits, empty bubbles don't flash up)
        // UNDERTALE's wide boss bubble (spr_blconwdshrt, 239x104, tail on the left, as SANS / Papyrus / Undyne use), the text written at its
        // (+32, +12): Galaxi in fnt_plain 16px further in (9px a letter, 20px lines, Undyne's typer 39), SANS in fnt_comicsans 5px in (typer 109)
        const f = BMF[sb.face] || BMF.plain, inset = f === BMF.comicsans ? 5 : 16, wrap = 195 - inset, rows = rowsOf(f, sb.text, wrap).length, im = ui.bubble, jig = () => sb.shake ? Math.round(Math.random() * 2 - 1) : 0; // shake: every letter jitters a pixel
        const [bx, by] = (cur && cur.mods.bubbleAt) || [410, 60], X = bx - 27, Y = by - 4, more = Math.max(0, rows - 4) * f.line; // mods.bubbleAt: an event moving him (the bubble follows). more: a 5th+ line stretches it
        if (im.naturalWidth) { ctx.drawImage(im, 0, 0, 239, 52, X, Y, 239, 52); if (more) ctx.drawImage(im, 0, 52, 239, 1, X, Y + 52, 239, more); ctx.drawImage(im, 0, 52, 239, 52, X, Y + 52 + more, 239, 52); }
        drawRows(f, sb.text, sb.n, X + 32 + inset, Y + 12, wrap, "#000", sb.shake && jig);
      }
      };
      if (ttt) { drawBubble(); return ttt.hidden ? undefined : drawTtt(); } // phone mode (its quips use the bubble too): the board instead of the box, stats and buttons
      // box
      // the box is always drawn at its sliding size, bottom-anchored, so it grows back into the dialogue box after an attack the
      // same way it shrank into it (the menu's flavor line waits for it to finish)
      const L = 320 + box.ox - box.w / 2, T = BOT + box.oy - box.h, BH = box.h, bx = L, bw = box.w;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 5; ctx.strokeRect(bx - 2.5, T - 2.5, bw + 5, BH + 5);
      if (state === "text" && typing) boxText(typing.text, typing.n);
      if (state === "talk" && boxLine) boxText(boxLine.text); // the opening: box line stays up, no heart yet
      else if (outro && ["talk", "dust", "text", "end"].includes(state)) { // the ending's heart (win: foe.flags.soulAt): waits by Galaxi, then runs off to the right, hopping, when the narrator starts
        if (state === "text" && foe.gone && outro.runAt === null) outro.runAt = clock; // (foe.gone: his dust has settled)
        const run = outro.runAt === null ? 0 : (clock - outro.runAt) * .25; // 4px a frame
        if (soul.x + run < 680) heart(Math.round(soul.x + run), Math.round(soul.y - (run ? Math.abs(Math.sin(run / 14)) * 4 : 0)), soul.blue ? "#003cff" : "#f00", 0, soulK()); }
      else if (state === "talk" || state === "ready") heart(soul.x, soul.y, soul.blue ? "#003cff" : "#f00", 0, soulK());
      if (state === "menu" && shown.text) boxText(shown.text, shown.n); // wrapped as the full line first, so words don't jump lines while typing
      if (state === "sub") { sub.options.forEach((o, i) => { const p = optAt(i); if (!p) return; bmText(BMF.main, "* " + o.label, p.tx, p.ty, o.color || "#fff"); if (i === subIx) heart(p.hx, p.hy); });
        if (sub.page) bmText(BMF.main, "PAGE " + (Math.floor(subIx / 4) + 1), 52 + 21 * 16, 334); }
      if (state === "aim" || state === "strike") {
        // obj_target at (ideal0 + 6, ideal2 + 6); once the hit lands it slides right, thins and fades (-0.06 width, -0.08 alpha, +15.8px a frame)
        const fr = aim && aim.fadeAt != null ? Math.max(0, (clock - aim.fadeAt) / F) : 0, xs = 1 - .06 * fr;
        if (ui.target.naturalWidth && xs > .08) { ctx.globalAlpha = Math.max(0, 1 - .08 * fr); ctx.drawImage(ui.target, Math.round(38 + 15.8 * fr), 256, Math.round(562 * xs), 128); ctx.globalAlpha = 1; }
        if (aim && !fr && ui.cursor.naturalWidth) ctx.drawImage(ui.cursor, state === "strike" && Math.floor(clock / (2.5 * F)) % 2 ? 14 : 0, 0, 14, 128, Math.round(aim.x), 256, 14, 128); // x: its left edge; flashes once you've hit
      }
      if (state === "dodge") {
        ctx.save(); ctx.beginPath(); ctx.rect(L, T, box.w, box.h);
        for (const b of [...bullets].sort((p, q) => (p.z || 0) - (q.z || 0))) { // z: higher draws on top
          ctx.save(); if (b.clip) ctx.clip(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
          const im = b.image && images[b.image];
          if (b.draw) { if (b.k) ctx.scale(b.k, b.k); b.draw(ctx, b); } else if (im && im.naturalWidth) ctx.drawImage(im, -b.w / 2, -b.h / 2, b.w, b.h); else { ctx.fillStyle = b.color || "#fff"; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); }
          ctx.restore();
        }
        ctx.restore();
        if (soul.purple && !soul.purple.hideLines) { ctx.fillStyle = "#8f1c93"; for (const y of soul.purple.ys) ctx.fillRect(L, Math.round(y) - 1, box.w, 2); }
        if (soul.green && !soul.hide) { const g = soul.green, a = g.dir * Math.PI / 180, c = Math.cos(a), s = -Math.sin(a), r = 30; // the circle (draw_circle, 12 sides) and the shield bar
          ctx.strokeStyle = "#00c000"; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i <= 12; i++) ctx.lineTo(soul.x + Math.cos(i * Math.PI / 6) * r, soul.y + Math.sin(i * Math.PI / 6) * r); ctx.stroke();
          ctx.strokeStyle = g.flash >= 2 ? "#f00" : "#4040ff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(soul.x + c * r - s * r, soul.y + s * r + c * r); ctx.lineTo(soul.x + c * r + s * r, soul.y + s * r - c * r); ctx.stroke(); }
        if (!soul.hide) heart(soul.x, soul.y, soulColor(), 0, soulK());
      }
      drawBubble();
      if (z > 1) ctx.restore();
      // stats line
      // scr_binfowrite: name and LV in fnt_curs at (30, 400), the HP label sprite at (240, 400), the bar 1.2px an HP, the numbers after it
      bmText(BMF.curs, `${player.name}   LV ${player.lv}`, 30, 400);
      if (ui.hpname.naturalWidth) ctx.drawImage(ui.hpname, 240, 400);
      ctx.fillStyle = "#f00"; ctx.fillRect(275, 400, Math.round(player.max * 1.2), 21); ctx.fillStyle = YELLOW; ctx.fillRect(275, 400, Math.round(player.hp * 1.2), 21);
      bmText(BMF.curs, `${String(player.hp).padStart(2, "0")} / ${player.max}`, 290 + player.max * 1.2, 400);
      // buttons: icon + label; the SOUL replaces the icon on the selected one
      btns.forEach((b, i) => {
        const on = i === menuIx && (state === "menu" || state === "sub" || fakeMenu), c = on ? YELLOW : ORANGE;
        const k = b.from == null ? 1 : Math.min(1, Math.max(0, (clock - btnAt) / 450)), e = k * k * (3 - 2 * k); // a shuffled button hops from its old spot
        b = { ...b, x: Math.round((b.from == null ? b.x : b.from + (b.x - b.from) * e) + (b.dx || 0)), y: Math.round(b.y + (b.dy || 0) - Math.sin(k * Math.PI) * (b.from == null ? 0 : 22)) };
        const im = ui.bt[b.t]; // UNDERTALE's button (frame 2: selected, no icon: the SOUL sits there, at (x + 8, y + 14))
        if (im && im.naturalWidth) ctx.drawImage(im, on ? 110 : 0, 0, 110, 42, b.x, b.y, 110, 42);
        else { ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3); if (!on) pixels(ICONS[b.t] || ICONS.FIGHT, b.x + 9, b.y + 10, 2, c); text(b.t, b.x + 70, b.y + 32, 30, c, "center", SANS); } // a label with no sprite (an event's)
        if (on && (state === "menu" || fakeMenu)) heart(b.x + 16, b.y + 22);
      });
      if (cur) for (const f of cur.draw) { // event overlays: fade out over 300ms once the event's attack is over, unless they're for the menu
        const k = cur.overAt == null || f.menu ? 1 : 1 - ((cur.t || 0) - cur.overAt) / 300; if (k <= 0) continue;
        ctx.save(); ctx.globalAlpha *= k; try { f(ctx, cur.t || 0, state); } catch (e) { console.error(e); } ctx.restore(); }
    }
    // UNDERTALE's monster death: a line sweeps down the sprite, everything above it breaks into pixels of dust that drift up and right and fade
    const DUST = 1100; // ms for the sweep
    function drawDust(X, Y, k) {
      const d = foe.dust, sw = sprite.naturalWidth, sh = sprite.naturalHeight;
      if (!d.px) { const c = document.createElement("canvas"); c.width = sw; c.height = sh; const g = c.getContext("2d"); g.drawImage(sprite, 0, 0); const px = g.getImageData(0, 0, sw, sh).data; d.px = [];
        for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (px[(y * sw + x) * 4 + 3] > 0) d.px.push({ x, y, vx: .02 + Math.random() * .06, vy: -.01 - Math.random() * .05 }); }
      const row = Math.min(sh, Math.floor(d.t / DUST * sh));
      if (row < sh) ctx.drawImage(sprite, 0, row, sw, sh - row, X, Y + row * k, sw * k, (sh - row) * k); // the part not swept yet
      ctx.fillStyle = "#fff";
      for (const p of d.px) { if (p.y >= row) continue; const age = d.t - p.y / sh * DUST; if (age > 900) continue;
        ctx.globalAlpha = 1 - age / 900; ctx.fillRect(Math.round(X + p.x * k + p.vx * age), Math.round(Y + p.y * k + p.vy * age), k, k); }
      ctx.globalAlpha = 1;
    }
    function drawDead() { death.draw(clock); }

    function cleanup() {
      cancelAnimationFrame(raf); removeEventListener("keydown", kd, true); removeEventListener("keyup", ku, true); removeEventListener("resize", fit);
      document.documentElement.style.overflow = oldOverflow; wrap.remove(); stopMusic(); try { ac && ac.close(); } catch {}
    }
    close.onclick = cleanup;
    reset(test && "story" in test ? test.story : !seenOpening); if (!sim) raf = requestAnimationFrame(frame); // test.story: force story mode on/off
    if (test && test.turn != null) { startMusic(); turn = test.turn; Object.assign(foe.flags, test.flags); toMenu(); enemyTurn(); } // test.flags: e.g. { mario: 1600 } starts 1-1 at that scroll
    if (test) window.__egg = { get soul() { return soul; }, api, get player() { return player; }, get foe() { return foe; }, get bullets() { return bullets; }, get state() { return state; }, get clock() { return clock; }, get box() { return box; }, get ttt() { return ttt; }, get attackEnd() { return attackEnd; }, get plan() { return plan; }, get labels() { return btns.map(b => b.t); }, get cur() { return cur; }, get modal() { return modal; }, get talk() { return talk; }, get typing() { return typing; }, get flavor() { return flavor; }, get bubble() { return bubble; }, get deadLine() { return deadLine; }, get sub() { return sub; }, get turn() { return turn; }, canvas: cv, touches: b => touches(b),
      tick(ms = 1000 / 60) { step(ms); }, // sim: one frame
      keys(list) { for (const k of list) if (!down.has(k)) hit.add(k); down.clear(); for (const k of list) down.add(k); }, // sim: hold exactly these keys
      pick(b, i = 0) { openSub(b); if (state === "sub") sub.pick(sub.options[i], i); } }; // pick("ACT", 1): choose that menu option directly. test mode only: poke at the live battle
  };
})();

/*
The MIT License (MIT)

Copyright (c) 2016 Stuart Watson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
