/* Undertale-style battle engine for the site's easter egg (tap the pfp 9 times).
 *
 * Core (640x480 screen, 16px SOUL at 2px/frame, bullet box anchored at x 320 / bottom 384, rotated-box
 * collision, 1s flashing i-frames, HP bar geometry) ported from Webtale by Stuart Watson:
 * https://github.com/chao-master/Webtale  (MIT License, Copyright (c) 2016 Stuart Watson; full text at the end
 * of this file). Menus, dialogue, FIGHT/ACT/ITEM/MERCY, turns, endings, touch input and sound added for GalaxiHD.
 *
 * Sound effects are UNDERTALE's own (assets/egg/sfx/, from Galaxi's copy, credited in the page footers). Fonts:
 * 8-bit Operator (dialogue) and Determination Sans (buttons/HP). Heart, icons and GAME OVER are drawn in code.
 * All the content (dialogue, attacks, acts, items) lives in boss.js. See the guide at the top of that file.
 */
(() => {
  const W = 640, H = 480, SPEED = 2 / 1000 * 60, SOUL = 16, IFRAMES = 1000, BOX_SPEED = .9, JUMP = .62, GRAVITY = .0025; // blue SOUL jumps ~77px: clears 1-1's tallest pipe (4 tiles of 16px)
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
    const fit = () => { const s = Math.min(innerWidth / W, innerHeight / H); const k = s >= 1 ? Math.floor(s) : s; cv.style.width = W * k + "px"; cv.style.height = H * k + "px"; };
    fit(); addEventListener("resize", fit);
    const ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false;
    for (const [name, file] of [[MONO, "assets/egg/fonts/determination-mono.ttf"], [SANS, "assets/egg/fonts/determination-sans.woff"]])
      new FontFace(name, `url(${base}${file})`).load().then(f => document.fonts.add(f)).catch(() => {});
    const oldOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = "hidden";

    // ---------- images ----------
    const img = src => { const i = new Image(); i.src = src.startsWith("http") ? src : base + src; return i; };
    const sprite = img(boss.sprite), images = {};
    for (const [k, v] of Object.entries(boss.images || {})) images[k] = img(v);
    const ui = { target: img("assets/egg/ui/target.png"), cursor: img("assets/egg/ui/target-cursor.png"), slice: img("assets/egg/ui/slice.png") }; // UNDERTALE spr_target, spr_targetchoice (2 frames), spr_slice_o (6 frames)

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
    const loadClip = src => { if (typeof src !== "string" || clips[src]) return; clips[src] = "loading";
      fetch(base + src).then(r => r.arrayBuffer()).then(b => { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); return ac.decodeAudioData(b); }).then(buf => clips[src] = buf).catch(() => delete clips[src]); };
    const speak = v => { if (sim) return;
      if (Array.isArray(v)) { const ok = v.filter(x => clips[x] instanceof AudioBuffer); if (!ok.length) return blip(440); v = ok[Math.floor(Math.random() * ok.length)]; }
      const buf = clips[v];
      if (!(buf instanceof AudioBuffer)) return blip(typeof v === "number" ? v : 440);
      if (ac.state === "suspended") ac.resume(); // first key/tap unlocks audio
      try { const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = buf; s.playbackRate.value = .9 + Math.random() * .2; /* ±0.1 pitch per blip */ g.gain.value = v === boss.voice ? boss.blipVolume ?? .8 : .8; s.connect(g).connect(ac.destination); s.start(); } catch {}
    };
    const play = (src, vol = 1, rate = 1) => { if (sim) return; const buf = clips[src]; if (!(buf instanceof AudioBuffer)) return; try { if (ac.state === "suspended") ac.resume(); const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = buf; s.playbackRate.value = rate; g.gain.value = vol; s.connect(g).connect(ac.destination); s.start(); } catch {} };
    [].concat(boss.voice, boss.narrator, boss.sounds || [], boss.music || []).forEach(loadClip);
    // battle music: loops gaplessly through Web Audio, starts after the opening (from the top on every retry), M mutes it
    let music = null, musicGain = null, musicMuted = false, musicGen = 0;
    const stopMusic = () => { musicGen++; try { music && music.stop(); } catch {} music = null; };
    const startMusic = (gen = musicGen) => {
      if (music || !boss.music || gen !== musicGen) return; // gen: a retry while it was still loading cancels this start
      const buf = clips[boss.music]; if (!(buf instanceof AudioBuffer)) return setTimeout(() => startMusic(gen), 200);
      try {
        if (ac.state === "suspended") ac.resume();
        music = ac.createBufferSource(); music.buffer = buf; music.loop = true;
        musicGain = ac.createGain(); musicGain.gain.value = musicMuted ? 0 : (boss.musicVolume ?? .35);
        music.connect(musicGain).connect(ac.destination); music.start();
      } catch {}
    };
    // a dialogue line is "text" or { text, sound }: the sound (a voice line) plays as the line starts, and replaces the blips
    const lineText = l => typeof l === "string" ? l : l.text, lineSound = l => typeof l === "string" ? null : l.sound;
    // UNDERTALE's own sound effects (from Galaxi's copy; credited in the page footers)
    const SFX = Object.fromEntries(["squeak", "select", "laz", "damage", "hurt1", "heal_c", "escaped", "break1", "break2", "noise", "battlefall", "vaporized", "txt1", "segapower", "rainbowbeam"].map(n => [n, `assets/egg/sfx/${n}.mp3`]));
    Object.values(SFX).forEach(loadClip);
    const sfx = { move: () => play(SFX.squeak), select: () => play(SFX.select), swing: () => play(SFX.laz), hit: () => play(SFX.damage), hurt: () => play(SFX.hurt1),
      heal: () => play(SFX.heal_c), charge: () => play(SFX.segapower), beam: () => play(SFX.rainbowbeam), flee: () => play(SFX.escaped), crack: () => play(SFX.break1), shatter: () => play(SFX.break2),
      start: () => { play(SFX.noise); setTimeout(() => play(SFX.battlefall), 120); }, spare: () => play(SFX.vaporized), files: SFX };

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
        if (state === "sub") { const cols = sub.cols || 2, t = sub.options.findIndex((o, i) => inside(p, 60 + (i % cols) * 280, 262 + Math.floor(i / cols) * 34, 260, 32)); if (t >= 0 && t !== subIx) { subIx = t; sfx.move(); } }
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
      foe = { hp: boss.hp, max: boss.hp, spare: 0, shake: 0, flags: {}, uses: {}, loop: 0 }; firstTurn = true; // uses: how many times each menu pick was made this fight
      menuIx = 0; turn = 0; bullets = []; timers = []; fx = []; clock = 0;
      box = { x: 32, y: 250, w: 575, h: 135, tw: 575, th: 135 };
      soul = { x: 320, y: 320, inv: 0, dead: 0 };
      flavor = ""; firstFlavor = null; boxLine = null; shards = []; deadLine = null;
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
    // ---------- phone: no fight (you'd need three thumbs), tic-tac-toe instead, best of 3. You're X, Galaxi is O ----------
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
    function tttEnd(how) { ttt = null; box.tw = 575; box.th = 135; foe.spared = how !== "lose"; state = "end"; say(linesOf(boss.phone.end[how]), exit); }
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
      // the tally under the board, centred: [SOUL] YOU 1 - 0 GALAXI, with "best of N" small underneath
      const parts = [["YOU", "#f00"], [`  ${ttt.you} - ${ttt.him}  `, "#fff"], ["GALAXI", "#fff"]];
      ctx.font = `28px "${SANS}", monospace`; const w = 24 + parts.reduce((n, [t]) => n + ctx.measureText(t).width, 0);
      let tx = 320 - w / 2; heart(tx + 8, 444); tx += 24;
      for (const [t, c] of parts) { text(t, tx, 453, 28, c, "left", SANS); tx += ctx.measureText(t).width; }
      text(`BEST OF ${ttt.target * 2 - 1}${ttt.need > 3 ? " · " + ttt.need + " IN A ROW" : ""}`, 320, 474, 20, "#888", "center", SANS);
      if (state === "ttt") text(ttt.turn === 1 ? "YOUR TURN" : "...", 630, 302, 26, "#fff", "right", SANS);
    }
    function drawIntro() {
      const fx = btns[0].x + 20, fy = btns[0].y + 21;
      if (clock < INTRO_BLINK) { if (Math.floor(clock / 100) % 2 === 0) heart(320, 240); }
      else { const k = Math.min(1, (clock - INTRO_BLINK) / INTRO_DROP), e = 1 - (1 - k) ** 2; heart(320 + (fx - 320) * e, 240 + (fy - 240) * e); }
    }

    // text in the main box: lines typed out one by one, Z to advance, then cb()
    function say(lines, cb) { queue = [].concat(vary(lines)).filter(Boolean); after = cb; state = "text"; nextLine(); }
    function startLine(l) { l = vary(l); const snd = lineSound(l); if (snd) play(snd, boss.voiceVolume ?? 1); return { text: lineText(l), n: 0, t: 0, quiet: !!snd, go: !!(l && l.go), shake: !!(l && l.shake) }; }
    // a Galaxi speech line; one marked go: true starts the attack as it's said, and its bubble stays up a moment during the attack
    function talkLine(l, rest) { talk = startLine(l); talk.rest = rest; if (talk.go) { bubble = { ...talk, life: 1600 }; talk = null; const cb = after; after = null; cb(); } }
    function nextLine() { if (!queue.length) { const cb = after; after = null; return cb && cb(); }
      const l = queue.shift();
      if (l && l.bubble) { typing = null; state = "talk"; hit.clear(); tap = null; // the Z that got here doesn't also skip the bubble
        const cb = after; after = () => { state = "text"; after = cb; nextLine(); }; return talkLine(l, []); } // bubble: true = Galaxi says it in his speech bubble, then the box text carries on
      typing = startLine(l); }
    function toMenu() { bubble = null; state = "menu"; sub = null; soul.inv = 0; box.tw = 575; box.th = 135; shown = { n: 0, t: 0 }; }
    let shown = { n: 0, t: 0 }; // how much of the menu's flavor line has typed out
    // foe speech bubble, then its attack
    function enemyTurn() {
      if (foe.hp <= 0) return win();
      const t = boss.turns[turn % boss.turns.length]; foe.loop = Math.floor(turn / boss.turns.length); turn++; // loop: how many times he's run out of attacks
      const fl = v => { v = typeof v === "function" ? v(foe, player) : v; return vary(Array.isArray(v) ? (boss.pick ? boss.pick(v) : v[Math.floor(Math.random() * v.length)]) : v); }; // a list of flavor lines: one at random (boss.pick: no repeats)
      flavor = vary(firstFlavor) || fl((boss.reactFlavor || {})[foe.last]) || fl(t.flavor) || flavor; firstFlavor = null;
      if (t.sneak) { firstTurn = false; ready = t; return dodge(t); } // sneak: no speech, no box resize, no heart glide; the attack runs the show (it starts looking like the menu)
      const aside = boss.aside ? boss.aside({ foe, player, turn: turn - 1, deaths, story: storyMode, first: firstTurn }) || [] : []; firstTurn = false; // lines that can come up on any turn (retries, low HP, out of attacks)
      const r = (boss.react || {})[foe.last];
      const lines = vary([].concat(aside, storyMode ? (typeof t.before === "function" ? t.before(foe) : t.before) || (typeof r === "function" ? r(foe, player) : r) || t.otherwise || (boss.chatter ? boss.chatter(foe) : null) || [] : [], typeof t.say === "function" ? t.say(foe) : t.say || [])); // before: story lines, skipped on a plain retry
      // like Undertale: the box shrinks to the attack's size while Galaxi talks, with the SOUL already inside it,
      // and the attack only starts once the box has finished resizing
      box.tw = t.box ? t.box[0] : 160; box.th = t.box ? t.box[1] : 140;
      soul.mario = t.soul === "mario"; soul.blue = soul.mario || t.soul === "blue";
      glideTo(320, soul.blue ? 384 - 22 : 384 - box.th / 2); // a gravity SOUL waits at the bottom, where it'll be standing
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
    function dodge(t) {
      const a = boss.attacks[t.attack];
      state = "dodge"; bullets = []; timers = []; clock = 0; round = { t, hits: 0, dmg: 0, healed: 0 };
      box.tw = t.box ? t.box[0] : 160; box.th = t.box ? t.box[1] : 140;
      const fromX = soul.x, fromY = soul.y; // where the heart is now: it glides from here once the attack has placed it
      soul.x = 320; soul.y = 384 - box.th / 2; soul.mario = t.soul === "mario"; soul.blue = soul.mario || t.soul === "blue"; soul.vy = 0; soul.grounded = false; soul.hide = false;
      soul.vx = 0; soul.acc = 0; soul.held = true; soul.buffer = soul.coyote = 0;
      attackEnd = t.time || 6000;
      a(api);
      const q = boss.quips && boss.quips[t.attack], quips = typeof t.quips === "function" ? t.quips(foe) : t.quips || (q ? [[q.at, boss.pick ? boss.pick(q.lines) : q.lines[0]]] : []);
      for (const [ms, l] of quips) api.after(ms, () => api.say(l, 1700)); // Galaxi talking mid-attack, Sans-style (boss.quips: one per attack, picked from its pool)
      if (t.sneak) return; // the attack places (and usually hides) the heart itself
      const toX = soul.x, toY = soul.y; soul.x = fromX; soul.y = fromY; glideTo(toX, toY); // the attack's clock waits for this
    }
    function endDodge() {
      const c = boss.concede, quit = c && foe.last === "Compliment" && foe.flags.nice >= c.at; // complimented him enough: he gives up
      const react = !quit && storyMode && boss.afterAttack ? vary([].concat(boss.afterAttack({ foe, player, hits: round.hits, damage: round.dmg, attack: round.t && round.t.attack }) || [])) : []; // how that attack went
      foe.last = null; bullets = []; timers = []; api.musicRate(1); fakeMenu = false;
      if (!quit && react.length) { state = "talk"; bubble = null; after = toMenu; return talkLine(react.shift(), react); }
      if (!quit) return toMenu();
      const lines = vary([...c.say]); state = "talk"; after = () => { foe.spare = Infinity; toMenu(); flavor = vary(c.flavor) || flavor; }; talkLine(lines.shift(), lines); // SPARE turns yellow
    }
    function win() { state = "end"; say([].concat(boss.onWin(foe)), exit); }
    function spare() { state = "end"; foe.spared = true; sfx.spare(); say([].concat(boss.onSpare(foe)), exit); }
    // Undertale's death: the SOUL freezes, cracks, shatters into falling shards, then GAME OVER fades in and a line is typed out
    let shards = [], deadLine = null;
    function gameOver() {
      deaths++; soul.dead = 1; state = "dead"; clock = 0; bullets = []; stopMusic();
      setTimeout(sfx.crack, 650);
      setTimeout(() => { sfx.shatter(); shards = Array.from({ length: 6 }, (_, i) => ({ x: soul.x, y: soul.y, vx: (i - 2.5) * 1.3 + Math.random() - .5, vy: -3 - Math.random() * 2 })); }, 1450);
      if (boss.onDeathSound) setTimeout(() => play(boss.onDeathSound, boss.voiceVolume ?? 1), 4000);
      deadLine = { text: vary(boss.onDeath) || "Stay determined!", n: 0, t: 0 };
    }
    function exit() { cleanup(); }

    // ---------- the attack API (what boss.js attacks get) ----------
    const api = {
      get box() { return { left: 320 - box.tw / 2, right: 320 + box.tw / 2, top: 384 - box.th, bottom: 384, width: box.tw, height: box.th }; }, // the size it's growing/shrinking to
      soul: { get x() { return soul.x; }, set x(v) { soul.x = v; }, get y() { return soul.y; }, set y(v) { soul.y = v; },
        get vy() { return soul.vy; }, set vy(v) { soul.vy = v; }, get grounded() { return soul.grounded; }, // vy/grounded: blue SOUL only
        get hide() { return soul.hide; }, set hide(v) { soul.hide = v; }, get inv() { return soul.inv; }, // inv: ms of flashing i-frames left // hide: don't draw the heart (it still gets hit), e.g. while it's inside a Poke Ball
        stomp() { soul.vy = soul.mario ? -PLAT.bounce : -.35; } }, // bounce off an enemy
      images, random: (a, b) => a + Math.random() * (b - a), foe: () => foe,
      // bullet: {x, y, vx, vy, w, h, image, color, rot, spin, damage, clip, update(b, dt, api), draw(ctx, b), solid} -> returns the bullet; set b.dead = true to remove
      // solid: a platform the blue SOUL stands on / bumps into (never hurts), bump(b) runs when the SOUL hits it from below.
      // draw: custom drawing, centred on the bullet
      bullet(b) { b = { vx: 0, vy: 0, w: 14, h: 14, rot: 0, spin: 0, damage: boss.damage || 3, clip: true, ...b }; bullets.push(b); return b; },
      after(ms, fn) { timers.push({ at: clock + ms, fn }); },
      every(ms, fn, from = 0) { for (let t = from; t < attackEnd; t += ms) timers.push({ at: clock + t, fn }); },
      resize(w, h) { box.tw = w; box.th = h; },
      end() { attackEnd = clock; }, // finish the attack now
      menuLook(on) { fakeMenu = on; },
      get menuHeart() { const b = btns[menuIx]; return { x: b.x + 20, y: b.y + 21 }; }, // where the menu draws the SOUL on the selected button // draw the buttons exactly like the menu (selected one yellow, the SOUL on it)
      speak: () => speak(boss.voice), // one of Galaxi's voice blips
      say(text, ms = 1500) { text = vary(text); bubble = { text, n: 0, t: 0, quiet: false, life: ms }; }, // Galaxi's speech bubble, typed with his voice blips, up for ms once typed
      damage(n) { // Sans-style: no flashing i-frames, so it can tick every few frames (a quieter hurt sound each time)
        if (foe.last === "Compliment") n = Math.ceil(n / 2);
        player.hp = Math.max(0, player.hp - n); round.hits++; round.dmg += n; play(SFX.hurt1, .4); if (player.hp <= 0) gameOver(); },
      steering: () => ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].some(k => down.has(k)) || !!drag, // pushing a direction
      musicRate(rate, ms = 0) { if (!music) return; try { const p = music.playbackRate, t = ac.currentTime; // 0 freezes the music, 1 is normal
        p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); if (ms) p.linearRampToValueAtTime(rate, t + ms / 1000); else p.setValueAtTime(rate, t); } catch {} },
      bullets: () => bullets,   // every bullet on screen (e.g. to freeze them all)
      pressed: () => hit.size > 0 || !!tap, // true on the frame any key is pressed or the screen is tapped (e.g. mashing to break free)
      heal(n, sound = true) { n = Math.min(n, (boss.healCap ?? Infinity) - round.healed); if (n <= 0) return; round.healed += n; player.hp = Math.min(player.max, player.hp + n); if (sound) sfx.heal(); }, // capped per attack
      tapped: k => hit.has(k),  // true on the frame that key went down ("ArrowUp" etc.; WASD count as arrows)
      heart: (x, y, color) => heart(x, y, color), // draw the SOUL (inside a bullet's draw it follows the bullet's position/rotation)
      sfx,                      // the battle's sound effects, e.g. a.sfx.hit()
      play                      // play a sound file from boss.sounds, e.g. a.play("assets/egg/voice/ahaha.mp3")
    };

    // ---------- helpers ----------
    function moveSoul(x, y) {
      const l = 320 - box.w / 2 + SOUL / 2, r = 320 + box.w / 2 - SOUL / 2, t = 384 - box.h + SOUL / 2, b = 384 - SOUL / 2;
      soul.x = Math.max(l, Math.min(r, x)); soul.y = Math.max(t, Math.min(b, y));
    }
    function hurt(d) { // true if that killed you
      if (soul.inv) return false;
      if (foe.last === "Compliment") d = Math.ceil(d / 2); // complimented: every hit of this attack does half
      player.hp = Math.max(0, player.hp - d); round.hits++; round.dmg += d; soul.inv = IFRAMES; sfx.hurt();
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
      const r = 6, L = 320 - box.w / 2 + r, R = 320 + box.w / 2 - r, T = 384 - box.h + r;
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
      if (x < L - 1 || y > 384 + 10) {
        // drop back in from the top above the nearest solid, so a pit can't swallow the SOUL over and over
        const land = solids.filter(b => b.x > L && b.x < R).sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
        soul.x = Math.max(L, Math.min(R, land ? land.x : soul.x)); soul.y = T; soul.vy = 0; soul.vx = 0; hurt(boss.fallDamage || 4);
      }
    }
    function touches(b) { // a true rotated-rectangle test against the soul (it used to box a rotated bullet upright: a star spun 45deg hit ~40% wider than it looks)
      const c = Math.cos(b.rot || 0), s = Math.sin(b.rot || 0), ox = soul.x - b.x, oy = soul.y - b.y;
      return Math.abs(ox * c + oy * s) <= b.w / 2 + 4 && Math.abs(-ox * s + oy * c) <= b.h / 2 + 4; // +4 instead of the full 8px half-soul: Undertale's hitbox is smaller than the heart
    }
    function pixels(rows, x, y, k, color) { ctx.fillStyle = color; rows.forEach((row, j) => [...row].forEach((c, i) => c === "1" && ctx.fillRect(Math.round(x) + i * k, Math.round(y) + j * k, k, k))); }
    function heart(x, y, color = "#f00", half) { // half: -1 = left half only, 1 = right half only (the cracked SOUL)
      const rows = half ? HEART.map(r => half < 0 ? r.slice(0, 8) + "00000000" : "00000000" + r.slice(8)) : HEART;
      pixels(rows, x - 8, y - 8, 1, color);
    }
    function text(s, x, y, size = 30, color = "#fff", align = "left", face = MONO) { ctx.font = `${size}px "${face}", monospace`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(s, x, y); ctx.textAlign = "left"; }
    function wrapText(s, width, size) { ctx.font = `${size}px "${MONO}", monospace`; const out = []; let line = ""; for (const w of s.split(" ")) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > width && line) { out.push(line); line = w; } else line = t; } out.push(line); return out; }
    const confirm = () => hit.has("z") || hit.has(" "), cancel = () => hit.has("x");

    // ---------- main loop ----------
    let last = performance.now(), raf;
    function frame(now) {
      const dt = Math.min(50, now - last) * (state === "dodge" && foe?.last === "Spare" ? boss.spareRush || 1 : 1) * (state === "dodge" && foe?.loop ? boss.tired || 1 : 1); last = now; clock += dt; // spared too early: the attack runs fast
      update(dt); draw(); hit.clear(); tap = null;
      raf = requestAnimationFrame(frame);
    }

    function type(o, dt, voice) {
      if (o.n >= o.text.length) return true;
      o.t += dt;
      while (o.t > 33 && o.n < o.text.length) { o.t -= 33; o.n++; const ch = o.text[o.n - 1]; if (ch !== " " && o.n % 2 && !o.quiet) speak(voice); }
      if (confirm() || cancel() || tap) { o.n = o.text.length; return false; } // skip ahead
      return false;
    }

    function update(dt) {
      if (hit.has("esc")) return cleanup();
      // the box slides to its new size at a steady speed, like Undertale's (about 0.3s for menu <-> a small dodge box)
      const step = BOX_SPEED * dt, toward = (v, t) => v < t ? Math.min(t, v + step) : Math.max(t, v - step);
      box.w = toward(box.w, box.tw); box.h = toward(box.h, box.th);
      foe.shake = Math.max(0, foe.shake - dt);
      fx = fx.filter(f => (f.t += dt) < f.life);
      if (bubble && type(bubble, dt, boss.voice || 520) && (bubble.life -= dt) <= 0) bubble = null;
      if (state === "intro") {
        introUpdate();
      } else if (state === "text") {
        if (type(typing, dt, boss.narrator || 300) && (confirm() || tap)) nextLine();
      } else if (state === "talk") {
        stepGlide(dt);
        if (type(talk, dt, boss.voice || 520) && (confirm() || tap)) {
          if (talk.rest.length) talkLine(talk.rest.shift(), talk.rest); else { const cb = after; after = null; talk = null; cb(); }
        }
      } else if (state === "ttt" || state === "tttEnd") { tttUpdate();
      } else if (state === "menu") {
        // once the box has slid back to full size, the flavor line types out like Undertale's (Z still picks a button right away)
        const line = flavor || "";
        if (box.w === box.tw && box.h === box.th && shown.n < line.length) {
          shown.t += dt;
          while (shown.t > 33 && shown.n < line.length) { shown.t -= 33; shown.n++; if (line[shown.n - 1] !== " " && shown.n % 2) speak(boss.narrator || 300); }
        }
        const b = btns.findIndex(b => inside(tap, b.x, b.y, b.w, b.h));
        if (hit.has("ArrowLeft")) { menuIx = (menuIx + 3) % 4; sfx.move(); }
        if (hit.has("ArrowRight")) { menuIx = (menuIx + 1) % 4; sfx.move(); }
        if (b >= 0) menuIx = b;
        if (confirm() || b >= 0) { sfx.select(); openSub(btns[menuIx].t); }
      } else if (state === "sub") {
        const n = sub.options.length, cols = sub.cols || 2, was = subIx;
        if (hit.has("ArrowDown")) subIx = Math.min(n - 1, subIx + cols);
        if (hit.has("ArrowUp")) subIx = Math.max(0, subIx - cols);
        if (hit.has("ArrowRight") && subIx % cols < cols - 1 && subIx + 1 < n) subIx++;
        if (hit.has("ArrowLeft") && subIx % cols) subIx--;
        const t = sub.options.findIndex((o, i) => inside(tap, 60 + (i % cols) * 280, 262 + Math.floor(i / cols) * 34, 260, 32));
        if (t >= 0) subIx = t;
        if (subIx !== was) sfx.move();
        if (cancel() || (tap && t < 0 && tap.y < 400)) toMenu();
        else if ((confirm() || t >= 0) && n) { sfx.select(); sub.pick(sub.options[subIx], subIx); }
        const bb = btns.findIndex(b => inside(tap, b.x, b.y, b.w, b.h)); if (bb >= 0) { menuIx = bb; openSub(btns[bb].t); }
      } else if (state === "aim") {
        aim.x += dt * .42;
        if (confirm() || tap) strike(); else if (aim.x > 600) strike(true);
      } else if (state === "strike") {
        if (clock > aim.until) { aim = null; enemyTurn(); }
      } else if (state === "ready") {
        if (!stepGlide(dt) && box.w === box.tw && box.h === box.th) dodge(ready);
      } else if (state === "dodge") {
        if (stepGlide(dt)) { clock -= dt; return; } // frozen (bullets, timers, attack time) until the heart reaches its start spot
        const sp = SPEED * dt;
        let x = soul.x, y = soul.y;
        soul.inv = Math.max(0, soul.inv - dt);
        if (soul.mario) { // platformer physics on a fixed 60 fps step, so it plays the same at any refresh rate
          soul.acc += dt;
          while (soul.acc >= MARIO_FRAME) { soul.acc -= MARIO_FRAME; marioFrame(); if (state !== "dodge") return; }
        } else if (soul.blue) { // Undertale's blue SOUL: gravity, Up (or a tap) jumps, let go early for a short hop
          if (down.has("ArrowLeft")) x -= sp * 1.4; else if (down.has("ArrowRight")) x += sp * 1.4;
          if ((down.has("ArrowUp") || tap) && soul.grounded) soul.vy = -JUMP;
          if (!down.has("ArrowUp") && !drag && soul.vy < -.15) soul.vy = -.15;
          soul.vy = Math.min(.6, soul.vy + GRAVITY * dt);
          blueMove(x, y + soul.vy * dt);
          if (state !== "dodge") return;
        } else {
          if (down.has("ArrowUp")) y -= sp; else if (down.has("ArrowDown")) y += sp;
          if (down.has("ArrowLeft")) x -= sp; else if (down.has("ArrowRight")) x += sp;
          moveSoul(x, y);
        }
        const due = timers.filter(t => t.at <= clock); timers = timers.filter(t => t.at > clock); // split first, so timers can add timers
        due.forEach(t => t.fn(api));
        for (const b of bullets) {
          b.x += b.vx * dt / 16.7; b.y += b.vy * dt / 16.7; b.rot += b.spin * dt / 16.7;
          b.update && b.update(b, dt, api);
          if (state !== "dodge") return; // an update ended the attack (e.g. a.damage killed you)
          if (b.x + b.w / 2 < -200 || (b.vx >= 0 && b.x - b.w / 2 > W + 200) || b.y < -200 || b.y > H + 200) b.dead = true; // things still scrolling in from the right stay
          if (!b.dead && !b.solid && b.damage && touches(b) && hurt(b.damage)) return;
        }
        bullets = bullets.filter(b => !b.dead);
        if (clock >= attackEnd) endDodge();
      } else if (state === "dead") {
        for (const p of shards) { p.x += p.vx * dt / 16.7; p.y += p.vy * dt / 16.7; p.vy += .25 * dt / 16.7; }
        if (clock > 4000 && deadLine) type(deadLine, dt, boss.narrator || SFX.txt1);
        if (clock > 4000 && (hit.has("r") || inside(tap, 140, 452, 360, 28))) reset(true);
        else if (clock > 4000 && (confirm() || tap)) reset(false);
        if (clock > 4000 && cancel()) cleanup();
      }
    }

    const picked = k => { foe.last = k; foe.uses[k] = (foe.uses[k] || 0) + 1; }; // what you picked, and how many times this fight
    function openSub(name) {
      subIx = 0; state = "sub";
      if (name === "FIGHT") sub = { options: [{ label: boss.name, color: foe.spare >= (boss.spareAt || 1) ? YELLOW : "#fff" }], cols: 1, pick: () => { picked("FIGHT"); state = "aim"; aim = { x: 40 }; } };
      if (name === "ACT") sub = { options: boss.acts.map(a => ({ label: a.name, act: a })), pick: o => { picked(o.act.name); const r = o.act.run(foe, player); say(r, enemyTurn); } };
      if (name === "ITEM") {
        if (!player.items.length) { say("* You have no items left.", toMenu); return; }
        sub = { options: player.items.map(i => ({ label: i.name, item: i })), pick: (o, i) => {
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

    function strike(missed) {
      const acc = missed ? 0 : 1 - Math.abs(aim.x - 320) / 280;
      const dmg = missed || acc < .05 ? 0 : Math.max(1, Math.round((boss.playerAttack || 18) * (.4 + acc)));
      foe.lastHit = dmg; foe.hp = Math.max(0, foe.hp - dmg); sfx.swing(); if (dmg) { foe.shake = 600; setTimeout(sfx.hit, 330); }
      fx.push({ kind: "dmg", text: dmg ? String(dmg) : "MISS", t: 0, life: 1100 });
      if (dmg) fx.push({ kind: "slash", t: 0, life: 450 });
      state = "strike"; aim.until = clock + 1100;
    }

    // ---------- drawing ----------
    function draw() {
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
      if (state === "dead") return drawDead();
      if (state === "intro") return drawIntro();
      // foe
      const sx = foe.shake ? Math.sin(clock / 25) * 8 * (foe.shake / 600) : 0;
      const bob = Math.round(Math.sin(clock / 500) * 2) * (boss.spriteScale || 2); // bobs in whole sprite pixels
      ctx.globalAlpha = foe.spared ? .5 : 1;
      if (sprite.complete && sprite.naturalWidth) {
        const k = boss.spriteScale || 2, w = sprite.naturalWidth * k, h = sprite.naturalHeight * k;
        ctx.drawImage(sprite, Math.round(320 - w / 2 + sx), Math.round(212 - h + bob), w, h);
      }
      ctx.globalAlpha = 1;
      for (const f of fx) {
        if (f.kind === "slash" && ui.slice.naturalWidth) { const fr = Math.min(5, Math.floor(f.t / f.life * 6)); ctx.drawImage(ui.slice, fr * 26, 0, 26, 110, 294, 26, 52, 220); } // 2x, centred on the sprite
        if (f.kind === "dmg") {
          const up = Math.min(1, f.t / 200) * 20; text(f.text, 320, 40 - up + 20, 38, f.text === "MISS" ? "#ccc" : "#f22", "center");
          ctx.fillStyle = "#404040"; ctx.fillRect(220, 210, 200, 12); ctx.fillStyle = "#0f0"; ctx.fillRect(220, 210, 200 * foe.hp / foe.max, 12);
        }
      }
      // speech bubble
      const sb = state === "talk" ? talk : state === "dead" ? null : bubble;
      if (sb) {
        const rows = wrapText(sb.text, 180, 24); let left = sb.n; // wrapped as the full line first, so words don't jump rows while typing
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(410, 60, 200, Math.max(110, rows.length * 22 + 22), 12); ctx.fill(); // grows for long lines
        ctx.beginPath(); ctx.moveTo(410, 100); ctx.lineTo(395, 112); ctx.lineTo(410, 118); ctx.fill();
        const cw = ctx.measureText("M").width, jig = () => sb.shake ? Math.round(Math.random() * 2 - 1) : 0; // shake: every letter jitters a pixel, like UNDERTALE's shaky text
        rows.forEach((l, i) => { const s = l.slice(0, Math.max(0, left)); if (sb.shake) [...s].forEach((c, j) => text(c, 422 + j * cw + jig(), 86 + i * 22 + jig(), 24, "#000")); else text(s, 422, 86 + i * 22, 24, "#000"); left -= l.length + 1; });
      }
      if (ttt) return ttt.hidden ? undefined : drawTtt(); // phone mode: the board instead of the box, stats and buttons
      // box
      // the box is always drawn at its sliding size, bottom-anchored, so it grows back into the dialogue box after an attack the
      // same way it shrank into it (the menu's flavor line waits for it to finish)
      const L = 320 - box.w / 2, T = 384 - box.h, BH = box.h, bx = L, bw = box.w;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 5; ctx.strokeRect(bx - 2.5, T - 2.5, bw + 5, BH + 5);
      if (state === "text" && typing) wrapText(typing.text.slice(0, typing.n), 530, 32).forEach((l, i) => text(l, 52, 292 + i * 34, 32));
      if (state === "talk" && boxLine) wrapText(boxLine.text, 530, 32).forEach((l, i) => text(l, 52, 292 + i * 34, 32)); // the opening: box line stays up, no heart yet
      else if (state === "talk" || state === "ready") heart(soul.x, soul.y, soul.blue ? "#003cff" : "#f00");
      if (state === "menu") { // wrapped as the full line first, so words don't jump lines while typing
        let left = shown.n;
        wrapText(flavor || "", 530, 32).forEach((l, i) => { text(l.slice(0, Math.max(0, left)), 52, 292 + i * 34, 32); left -= l.length + 1; });
      }
      if (state === "sub") sub.options.forEach((o, i) => {
        const cols = sub.cols || 2, x = 60 + (i % cols) * 280, y = 288 + Math.floor(i / cols) * 34;
        text("* " + o.label, x + 28, y, 32, o.color || "#fff"); if (i === subIx) heart(x + 10, y - 9);
      });
      if (state === "aim" || state === "strike") {
        if (ui.target.naturalWidth) ctx.drawImage(ui.target, 39, 253); // 562x128 at 1x, centre lands on x 320
        if (aim && ui.cursor.naturalWidth) ctx.drawImage(ui.cursor, state === "strike" && Math.floor(clock / 60) % 2 ? 14 : 0, 0, 14, 128, Math.round(aim.x - 7), 253, 14, 128);
      }
      if (state === "dodge") {
        ctx.save(); ctx.beginPath(); ctx.rect(L, T, box.w, box.h);
        for (const b of [...bullets].sort((p, q) => (p.z || 0) - (q.z || 0))) { // z: higher draws on top
          ctx.save(); if (b.clip) ctx.clip(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
          const im = b.image && images[b.image];
          if (b.draw) b.draw(ctx, b); else if (im && im.naturalWidth) ctx.drawImage(im, -b.w / 2, -b.h / 2, b.w, b.h); else { ctx.fillStyle = b.color || "#fff"; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); }
          ctx.restore();
        }
        ctx.restore();
        if (!soul.hide && (!soul.inv || Math.floor(clock / 80) % 2)) heart(soul.x, soul.y, soul.blue ? "#003cff" : "#f00");
      }
      // stats line
      text(`${player.name}   LV ${player.lv}`, 32, 418, 26, "#fff", "left", SANS);
      text("HP", 245, 416, 18, "#fff", "left", SANS);
      ctx.fillStyle = "#f00"; ctx.fillRect(275, 400, player.max * 1.25, 21); ctx.fillStyle = YELLOW; ctx.fillRect(275, 400, player.hp * 1.25, 21);
      text(`${player.hp} / ${player.max}`, 275 + player.max * 1.25 + 14, 418, 26, "#fff", "left", SANS);
      // buttons: icon + label; the SOUL replaces the icon on the selected one
      btns.forEach((b, i) => {
        const on = i === menuIx && (state === "menu" || state === "sub" || fakeMenu), c = on ? YELLOW : ORANGE;
        ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3);
        if (on && (state === "menu" || fakeMenu)) heart(b.x + 20, b.y + 21); else pixels(ICONS[b.t], b.x + 9, b.y + 10, 2, c);
        text(b.t, b.x + 70, b.y + 32, 30, c, "center", SANS);
      });
    }
    function drawDead() {
      if (clock < 650) heart(soul.x, soul.y);
      else if (clock < 1450) { heart(soul.x - 2, soul.y, "#f00", -1); heart(soul.x + 2, soul.y, "#f00", 1); } // cracked down the middle
      for (const p of shards) pixels(["0110", "1111", "0110"], p.x - 4, p.y - 3, 2, "#f00");
      if (clock > 2600) {
        ctx.globalAlpha = Math.min(1, (clock - 2600) / 1200);
        text("GAME", 320, 150, 120, "#fff", "center", SANS); text("OVER", 320, 250, 120, "#fff", "center", SANS);
        ctx.globalAlpha = 1;
      }
      if (deadLine && clock > 4000) {
        wrapText(deadLine.text.slice(0, deadLine.n), 420, 32).forEach((l, i) => text(l, 140, 340 + i * 34, 32));
        if (deadLine.n >= deadLine.text.length) { text("Z / tap: try again    X: leave", 320, 440, 22, "#777", "center"); text("R / tap here: replay with dialogue", 320, 470, 22, "#777", "center"); }
      }
    }

    function cleanup() {
      cancelAnimationFrame(raf); removeEventListener("keydown", kd, true); removeEventListener("keyup", ku, true); removeEventListener("resize", fit);
      document.documentElement.style.overflow = oldOverflow; wrap.remove(); stopMusic(); try { ac && ac.close(); } catch {}
    }
    close.onclick = cleanup;
    reset(test && "story" in test ? test.story : !seenOpening); if (!sim) raf = requestAnimationFrame(frame); // test.story: force story mode on/off
    if (test && test.turn != null) { startMusic(); turn = test.turn; Object.assign(foe.flags, test.flags); toMenu(); enemyTurn(); } // test.flags: e.g. { mario: 1600 } starts 1-1 at that scroll
    if (test) window.__egg = { get soul() { return soul; }, api, get player() { return player; }, get foe() { return foe; }, get bullets() { return bullets; }, get state() { return state; }, get clock() { return clock; }, get box() { return box; }, get ttt() { return ttt; }, get attackEnd() { return attackEnd; }, get talk() { return talk; }, get typing() { return typing; }, get flavor() { return flavor; }, get bubble() { return bubble; }, get deadLine() { return deadLine; }, get sub() { return sub; }, get turn() { return turn; }, canvas: cv, touches: b => touches(b),
      tick(ms = 1000 / 60) { clock += ms; update(ms); draw(); hit.clear(); tap = null; }, // sim: one frame
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
