/* ============================================================================================================
   THE GALAXI BOSS FIGHT: everything you can change lives in this file. battle.js is the engine, leave it alone.
   ============================================================================================================

   HOW TO MAKE YOUR OWN (no coding experience needed, just copy a block and change the words/numbers):

   1. DIALOGUE
      - opening: plays once per page visit before Galaxi's first attack (and again if you die and press R to replay with dialogue):
          box (the first "* ..." line in the big box), say (his speech-bubble lines, Z for each), after (the box line on the first menu).
        Galaxi always attacks first. A plain retry (Z) skips the opening and starts straight at turn 0.
      - turns: the fight loops through these in order. Each turn has:
          say:    what Galaxi says in the speech bubble (a list of lines, each one waits for Z / a tap). shake: true makes a line's letters shake. Give a line
                  go: true and the attack starts the moment it's said (its bubble stays up a moment), e.g. "Go, Pikachu!"
          before: story lines before say (skipped on a plain retry); can be a function of foe, e.g. foe => foe.last === "Compliment" ? ["..."] : null
                  (nothing from before: the react lines for your pick play instead, and if there are none, the turn's otherwise lines)
                  (foe.last: what you picked on the last menu: an ACT or item name, "FIGHT", "Spare" or "Flee"; attacks can read it too via a.foe().last)
          flavor: the "* ..." line shown in the big box on your next menu; can be a function of foe too (e.g. per foe.last)
          attack: the name of an attack from the attacks list below
          box:    [width, height] of the dodge box in pixels (the screen is 640 x 480)
          time:   how long the attack lasts in milliseconds (6000 = 6 seconds)
          soul:   "blue" for Undertale's gravity SOUL (Up jumps; its exact numbers)
      - Start every box line with "* " like Undertale does. A line holds 33 letters; longer ones wrap by themselves, indented under the "* ".
        ^1 to ^9 in any line pauses after the next letter (^1 = 1/3 s, ^9 = 3 s), like UNDERTALE's text.

   2. ACTS (the ACT menu)
      Each act has a name and a run function that returns the lines to show. foe.flags remembers anything
      you like between turns (e.g. foe.flags.subscribed = true). Compliment counts foe.flags.nice: the attack right
      after a Compliment does half damage, and after the one that follows the concede.at-th Compliment, Galaxi says
      concede.say, the menu shows concede.flavor with SPARE yellow (the only way to spare him; spareAt is Infinity),
      and picking Spare plays concede.spared, then onSpare.

   3. ITEMS: name, short (the ITEM menu's name, 9 letters max like UNDERTALE's: the full name is used when you use it), how much HP it heals, optional verb ("drank"; default "ate") and optional extra lines.

   4. ATTACKS
      An attack is a function that spawns bullets. Copy one of the attacks below and tweak the numbers. Tools:
        a.box                  the dodge box edges: a.box.left / right / top / bottom / width / height
        a.soul.x, a.soul.y     where the player's heart is right now
        a.bullet({...})        spawn a bullet: x, y (where), vx, vy (speed per frame), w, h (size),
                               image ("star" etc. from the images list) or color, spin (rotation speed),
                               damage, update(b, dt, a) (runs every frame: steer it, b.dead = true removes it)
        a.every(ms, fn)        run fn every ms milliseconds while the attack lasts
        a.after(ms, fn)        run fn once after ms milliseconds
        a.random(min, max)     a random number between min and max
        a.resize(w, h)         grow/shrink the box mid-attack
        a.end()                finish the attack now (for attacks that decide their own length)
        a.steering()           true while the player is pushing a direction (arrows/WASD or a drag)
        a.key(k), a.tapped(k)  a key held / pressed this frame ("ArrowLeft" etc., WASD counts as arrows), for attacks with their own controls
        a.play(file, vol, rate) play a sound, optionally quieter (vol 0-1) or lower/higher (rate)
        a.musicRate(rate, ms)  slide the music's speed to rate over ms (0 freezes it, 1 is normal; reset after every attack)
        z: 1 on a bullet       draws it over the others

   5. ENDINGS: onWin (HP hits 0), onSpare, onFlee, onDeath (game over line), onDeathSound.

   6. VOICE LINES
      Any line can be "text" or { text: "...", sound: V.name }. The sound plays as the line starts (the blips stay
      quiet for that line). Your recordings live in assets/egg/voice/ (crunched, ready for the web); the V list below
      names them. Add a new one: give Claude the recording, or put a crunched .mp3 in that folder and add it to V.
      voice: your talking blip, one short cut of your own voice played every other letter (like Sans). Any line without a sound uses
      it, so new dialogue doesn't need a new recording.

   Controls: M mutes the music, arrows or WASD move, Z / Enter / Space or left-click confirm, X / Shift or right-click go back,
   hover with the mouse to pick menu options, drag to move on touch screens.
   In the Mario turn: left/right move, Up or Z jumps (hold for higher). On touch: drag toward where you want to go, swipe up to jump.

   Quick testing (browser console, after breaking the pfp once so the scripts are loaded):
     startBattle(GALAXI_BOSS, '', { turn: 0 })                     jumps straight into turn 0's attack
     startBattle(GALAXI_BOSS, '', { turn: 6, flags: { mario: 1600 } })  starts 1-1 at that scroll position
   In test mode window.__egg exposes the live battle (soul, player, foe, bullets, state) to poke at.

   Test it: save, reload the page, mine the pfp (click 10 times or hold it down). Press Esc or the X to leave.
   ============================================================================================================ */

const V = Object.fromEntries(["adventuretime", "ahaha", "blurple", "eventuality", "fortniteblast", "gobblegobble", "goodgrief",
  "gopikachu", "gottagofast", "hadukenblast", "idhealyoubutidontwantto", "ihavesomanyvoicelines", "itsame", "jebluey",
  "jojonokiminionaboken", "letsspeeditup", "likeandsubscribe", "rayofdeath", "thanksforwatching", "theworld",
  "thidbossthingisfun", "whosthatpokemon", "yourejokingright", "yourekidding"].map(n => [n, `assets/egg/voice/${n}.mp3`]));

// SUPER MARIO BROS. world 1-1, tile for tile (layout from the Video Game Level Corpus, github.com/TheVGLC/TheVGLC).
// One letter = one 16px tile (the heart is Mario-sized). X ground/stairs, S brick, ? and Q question blocks, <> [] pipe, E enemy
// (the one on column 106 is the Koopa). Art: SUPER MARIO ALL-STARS (SNES) rips by Mister Man (enemies) and the 1-1 map on
// spriters-resource.com, turned white with the dark parts cut out: assets/egg/mario/terrain.png (ground, pipes, stairs, rows 4-13)
// and sprites.png (16x24 cells: brick, ? block, goomba x2, squashed goomba, koopa x2, shell, empty block). Each material has its
// own colour map (which source colours are cut out), so no shade lands on the wrong side of a single cut-off.
const WORLD_1_1 = [
    "----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------",
    "----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------",
    "----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------",
    "----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------",
    "----------------------------------------------------------------------------------E-----------------------------------------------------------------------------------------------------------------------",
    "----------------------Q---------------------------------------------------------SSSSSSSS---SSSQ--------------?-----------SSS----SQQS--------------------------------------------------------XX------------",
    "-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------XXX------------",
    "-------------------------------------------------------------------------------E----------------------------------------------------------------------------------------------------------XXXX------------",
    "----------------------------------------------------------------S------------------------------------------------------------------------------------------------------------------------XXXXX------------",
    "----------------Q---S?SQS---------------------<>---------<>------------------S?S--------------S-----SS----Q--Q--Q-----S----------SS------X--X----------XX--X------------SSQS------------XXXXXX------------",
    "--------------------------------------<>------[]---------[]-----------------------------------------------------------------------------XX--XX--------XXX--XX--------------------------XXXXXXX------------",
    "----------------------------<>--------[]------[]---------[]----------------------------------------------------------------------------XXX--XXX------XXXX--XXX-----<>--------------<>-XXXXXXXX------------",
    "---------------------E------[]--------[]-E----[]-----E-E-[]------------------------------------E-E--------E-----------------EE-E-E----XXXX--XXXX----XXXXX--XXXX----[]---------EE---[]XXXXXXXXX--------X---",
    "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX--XXXXXXXXXXXXXXX---XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX--XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
];

// The World's time stop look, shared by the attack and patch notes' time-stop patch. A sphere of negative colour bursts out of Galaxi with
// a shockwave on its edge, swallows the screen, collapses back into him, and leaves the frozen world with a dull colour cast (TINT) until
// time moves again. The sphere is drawn into a half-size mask (2x2 blocks, like the sprites) and its edge fades out with a 4x4 Bayer
// dither, so it's a pixel-art gradient instead of a hard cut to negative. The shockwave rings are dithered the same way.
// timeStopFx() -> draw(ctx, t, back): t = ms since time stopped, back = ms since it started again (0 while stopped). Screen coordinates.
function timeStopFx() {
  const TINT = "#c8d8a0", OUT = 450, IN = 450, BIG = 760, EDGE = 56; // TINT: the stopped world's colour; sphere grow / collapse ms, full radius, soft edge width
  const MW = 320, MH = 196, BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
  const mask = document.createElement("canvas"), rings = document.createElement("canvas"); mask.width = rings.width = MW; mask.height = rings.height = MH;
  const mctx = mask.getContext("2d"), rctx = rings.getContext("2d"), mimg = mctx.createImageData(MW, MH), rimg = rctx.createImageData(MW, MH);
  const paint = (r, shock) => { // r: sphere radius in screen px
    const m = mimg.data, w = rimg.data;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const d = Math.hypot(x * 2 + 1 - 320, y * 2 + 1 - 150), th = BAYER[(y & 3) * 4 + (x & 3)], i = (y * MW + x) * 4;
      m[i] = m[i + 1] = m[i + 2] = 255; m[i + 3] = Math.min(1, (r - d) / EDGE + .5) > th ? 255 : 0; // inside -> fully inverted, fading out across the edge
      const ring = shock ? Math.max(0, 1 - Math.abs(d - r - 14) / 10) * .6 + Math.max(0, 1 - Math.abs(d - r - 34) / 8) * .3 : 0;
      w[i] = w[i + 1] = w[i + 2] = 255; w[i + 3] = ring > th ? 255 : 0;
    }
    mctx.putImageData(mimg, 0, 0); if (shock) rctx.putImageData(rimg, 0, 0);
  };
  return (ctx, t, back) => {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 640, 392); ctx.clip(); // stops above the HP line
    ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = back ? Math.max(0, 1 - back / 300) : Math.min(1, t / OUT); ctx.fillStyle = TINT; ctx.fillRect(0, 0, 640, 392);
    if (!back && t <= OUT + IN) {
      const r = t < OUT ? BIG * (1 - (1 - t / OUT) ** 2) : BIG * (1 - (t - OUT) / IN) ** 2; // bursts out fast, collapses faster at the end
      paint(r, t < OUT); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false;
      ctx.globalCompositeOperation = "difference"; ctx.drawImage(mask, 0, 0, 640, 392);
      if (t < OUT) { ctx.globalCompositeOperation = "source-over"; ctx.drawImage(rings, 0, 0, 640, 392); } // the shockwave riding the edge
    }
    ctx.restore();
  };
}

// Ray of Death's moves, shared by the attack and tools/train-attacks.js (which evolves the script): a move + the box + where the heart is
// -> the blasters it fires, each { x, y, ang, width, charge, k, delay (ms after the move) }. Moves: { dt (ms after the last move), kind, charge, width, ... }
//   aimed { n }          n blasters from random spots round the box, each aimed at you      fan { n, spread }   n from one spot, fanned round you
//   across { off, side } a lane across at your height + off (side -1 left, 1 right)        down { off, side }  a lane down at your x + off (side -1 top, 1 bottom)
//   cross { off }        across + down through you (+ off)                                  cage { gap }        4 lanes round you, the middle (gap px) is safe
//   sweep { n, step, every, axis }  n lanes marching (step px apart, every ms)            big { }             the big wide blaster from a top corner, aimed at you
//   spiral { n, gap }    n blasters round the box an eighth apart, one every gap ms, all firing through the middle (kablooey's opener)
function rayMoves(m, B, soul, random) {
  const cx = (B.left + B.right) / 2, cy = (B.top + B.bottom) / 2, RX = B.width / 2 + 50, RY = B.height / 2 + 45, o = { width: m.width || 26, charge: m.charge || STAR_BLASTER.charge, k: 5, delay: 0 };
  const ring = th => [cx + Math.cos(th) * RX, cy + Math.sin(th) * RY], at = (x, y, ang, more) => ({ ...o, x, y, ang, ...more });
  const across = (y, side, more) => at(side < 0 ? B.left - 45 : B.right + 45, y, side < 0 ? 0 : Math.PI, more), down = (x, side, more) => at(x, side < 0 ? B.top - 40 : B.bottom + 40, side < 0 ? Math.PI / 2 : -Math.PI / 2, more);
  const side = v => v || (random() < .5 ? -1 : 1), deg = d => d * Math.PI / 180; // th: where on the ring round the box (degrees, 0 = right, 90 = below), at: a fixed row/column (0-1 across the box) instead of yours
  switch (m.kind) {
    case "aimed": return Array.from({ length: m.n || 1 }, (_, i) => { const [x, y] = ring(m.th !== undefined ? deg(m.th + i * 360 / (m.n || 1)) : random() * Math.PI * 2); return at(x, y, Math.atan2(soul.y - y, soul.x - x)); });
    case "fan": { const [x, y] = ring(m.th !== undefined ? deg(m.th) : random() * Math.PI * 2), a0 = Math.atan2(soul.y - y, soul.x - x), n = m.n || 3; return Array.from({ length: n }, (_, i) => at(x, y, a0 + (i - (n - 1) / 2) * (m.spread || .25))); }
    case "across": return [across(m.at !== undefined ? B.top + m.at * B.height : soul.y + (m.off || 0), side(m.side))];
    case "down": return [down(m.at !== undefined ? B.left + m.at * B.width : soul.x + (m.off || 0), side(m.side))];
    case "cross": return [across(soul.y + (m.off || 0), side(0)), down(soul.x + (m.off || 0), -1)];
    case "cage": { const g = m.gap || 40; return [across(soul.y - g, -1), across(soul.y + g, 1), down(soul.x - g, -1), down(soul.x + g, 1)]; }
    case "sweep": { const n = m.n || 3, dir = side(m.side); return Array.from({ length: n }, (_, i) => m.axis === "down" ? down(Math.max(B.left + 10, Math.min(B.right - 10, soul.x + dir * i * (m.step || 40))), -1, { delay: i * (m.every || 300) }) : across(Math.max(B.top + 10, Math.min(B.bottom - 10, soul.y + dir * i * (m.step || 40))), -1, { delay: i * (m.every || 300) })); }
    case "spiral": { const th0 = m.th !== undefined ? deg(m.th) : random() * Math.PI * 2, turn = m.turn || (random() < .5 ? 1 : -1);
      return Array.from({ length: m.n || 8 }, (_, i) => { const [x, y] = ring(th0 + turn * i * Math.PI / 4); return at(x, y, Math.atan2(cy - y, cx - x), { delay: i * (m.gap || 260) }); }); }
    default: { const x = side(m.side) < 0 ? B.left - 60 : B.right + 60, y = B.top - 30; return [at(x, y, Math.atan2(soul.y - y, soul.x - x), { k: 8, width: 44, charge: m.charge || 800 })]; } // big
  }
}
// the script Ray of Death plays; END: ms after the last move before the attack ends
// Designed by hand (2026-10-11), Sans-style: teach a move, repeat it, twist it, then a finale. Same every run, so it can be learned.
const RAY = { END: 1500, moves: [
  // 1. hello: one at your row from the left, one from the right, then one down your column. They aim where you ARE: keep moving
  { dt: 500, kind: "across", side: -1, width: 36, charge: 650 }, { dt: 800, kind: "across", side: 1, width: 36, charge: 650 }, { dt: 800, kind: "down", side: -1, width: 36, charge: 650 },
  // 2. the march: 3 columns stepping right through you, then 3 rows stepping up
  { dt: 1000, kind: "sweep", axis: "down", side: 1, n: 3, step: 44, every: 280, width: 30, charge: 550 }, { dt: 1300, kind: "sweep", axis: "across", side: -1, n: 3, step: 44, every: 280, width: 30, charge: 550 },
  // 3. the cage (stand still), then a cross right on top of you (now move)
  { dt: 1300, kind: "cage", gap: 40, width: 26, charge: 650 }, { dt: 900, kind: "cross", width: 30, charge: 550 },
  // 4. the clock: top, right, bottom, left, each aimed at you, then one big blaster from the left
  { dt: 1000, kind: "aimed", th: -90, width: 30, charge: 550 }, { dt: 330, kind: "aimed", th: 0, width: 30, charge: 550 }, { dt: 330, kind: "aimed", th: 90, width: 30, charge: 550 }, { dt: 330, kind: "aimed", th: 180, width: 30, charge: 550 },
  { dt: 900, kind: "big", side: -1, charge: 750 }] };
// Kablooey's script: Ray of Death's moves plus bomb { n, every, speed } (n star bombs where you are, every ms apart, bits flying at speed px/frame)
// Designed by hand (2026-10-11): the spiral is his signature, so it opens, and comes back backwards and faster before the finale
const KAB = { END: 1500, moves: [
  { dt: 400, kind: "spiral", n: 8, th: -90, turn: 1, gap: 260, width: 26, charge: 600 }, // 1. the spiral, clockwise from the top
  { dt: 3000, kind: "bomb", n: 3, every: 900, speed: 3 }, // 2. three bombs on a beat, where you are
  { dt: 3000, kind: "fan", n: 3, spread: .3, th: -90, width: 30, charge: 650 }, { dt: 900, kind: "fan", n: 3, spread: .3, th: 90, width: 30, charge: 650 }, // 3. a fan from the top, then from below
  { dt: 1100, kind: "cage", gap: 36, width: 26, charge: 600 }, // 4. the cage: hold still
  { dt: 1300, kind: "spiral", n: 8, th: 90, turn: -1, gap: 200, width: 26, charge: 550 }, // 5. the spiral again: backwards, from the bottom, faster
  { dt: 2200, kind: "big", side: -1, charge: 800 }, { dt: 700, kind: "big", side: 1, charge: 800 }] }; // 6. two big ones, left then right
// Sonic's waves: { dt (ms after the last), lane (0, 1, "you", "other"), kind, fast, rings }
// Designed by hand (2026-10-11). lane: 0 = the bridge, 1 = the grass, "you" = whichever you're in; rings: rings in the other lane; dt: ms at full speed (placed by distance); sign: ms of running after the last wave to the signpost
const SONIC = { sign: 900, waves: [
  // 1. one at a time, alternating, with rings showing the safe lane: a pacing Crabmeat, a Motobug, spikes, a Motobug
  { dt: 700, lane: 1, kind: 1, rings: true }, { dt: 800, lane: 0, rings: true }, { dt: 800, lane: 1, kind: 2, rings: true }, { dt: 800, lane: 0, rings: true },
  // 2. now they follow you: a Motobug down your lane on every beat
  { dt: 900, lane: "you", fast: 1 }, { dt: 500, lane: "you", fast: 1 }, { dt: 500, lane: "you", fast: 1 },
  // 3. a rock on the grass, then a fast Motobug on the bridge right behind it
  { dt: 900, lane: 1, kind: 3 }, { dt: 300, lane: 0, fast: 3 },
  // 4. finale: double time, then rings, and the signpost
  { dt: 900, lane: "you", fast: 2 }, { dt: 400, lane: "you", fast: 2 }, { dt: 400, lane: "you", fast: 2 }, { dt: 400, lane: "you", fast: 2, rings: true }] };

// The World's loops. A ring loop: { slots (knives in the ring, one left out as the exit), r (ring radius), shrink / spin (px / degrees a
// frame as it closes), volleys: [{ dt (ms after the last), n, spread (radians apart), speed }] }. A shield loop: { speed (px a frame), knives }.
// Designed by hand (2026-10-11). The rule to learn: an odd fan has a knife aimed right at you (move), an even fan leaves a gap where you are (stay still)
const TW = { loops: [
  // 1. the ring (red SOUL): shrink px / spin degrees a frame once time moves (obj_rotspeargen), then the fans
  { slots: 12, r: 60, shrink: 3, spin: 1.5, volleys: [{ dt: 200, n: 3, spread: .3, speed: 4 }, { dt: 700, n: 3, spread: .3, speed: 4 }, { dt: 700, n: 4, spread: .3, speed: 4 }, { dt: 700, n: 4, spread: .3, speed: 4 }] },
  // 2. the shield (green SOUL), Undyne's lesson order: one side, then pairs, then all four, then a reverse (r: "cw" / "ccw", yellow). dt: frames after the last
  { speed: 5, knives: [{ s: "U", dt: 12 }, { s: "U", dt: 16 }, { s: "L", dt: 16 }, { s: "R", dt: 16 }, { s: "L", dt: 12 }, { s: "R", dt: 12 }, { s: "D", dt: 14 },
    { s: "U", dt: 10 }, { s: "R", dt: 10 }, { s: "D", dt: 10 }, { s: "L", dt: 10 }, { s: "U", dt: 16, r: "cw" }, { s: "D", dt: 20 }, { s: "L", dt: 12, r: "ccw" }] }] };

// Go, Pikachu's script: throws [{ dt, ms, lead }] (see the attack), stray (ms between the stray balls that box you in), first / thunder
// (ms to the first Thunder / between them), warn (its warning, ms), beat (ms between bolts), bolt (bolt speed px/frame)
// Designed by hand (2026-10-11): bolt, bolt, bolt, THUNDER on a steady beat; throws go Nice, Nice, Great, Great, Excellent, Excellent
// (aimed where you are, then halfway to where you're heading, then right where you're heading). hop: ms between Pikachu's hops
const PB = { stray: 3000, first: 2400, thunder: 2400, warn: 450, beat: 800, bolt: 3, hop: 1200,
  throws: [{ dt: 1400, ms: 900, lead: 0 }, { dt: 1400, ms: 900, lead: 0 }, { dt: 1200, ms: 700, lead: .5 }, { dt: 1200, ms: 700, lead: .5 }, { dt: 1000, ms: 550, lead: 1 }, { dt: 600, ms: 550, lead: 1 }] };

// Lorem's knobs (tools/evolve.js evolves them): rise (scroll px/frame), talk (ms he talks), overlap (px each line's blue overlaps the
// last's), shift (max px the path moves a line), minW (narrowest blue run, px)
const LOREM = { rise: .8, talk: 9000, overlap: 26, shift: 44, minW: 40, steps: [0, 1, 1, 1, 0, -1, -1, -1] }; // steps: the path's snake, in shifts per line (designed 2026-10-11: drift right, settle, drift left, settle)

// The comment section (designed by hand 2026-10-11), Sans's opening bones as comments: columns slide in from the left edge, no warning.
// rows: one letter per row of the box, top to bottom: "." a gap, "s" / "m" / "l" a short / medium / long comment, "b" a blue (pinned) comment:
// like SANS's blue bones it only hurts if you move while it's on you. dt: ms after the last column
const COMMENTS = { speed: 2.6, rows: 7, cols: [
  // 1. a trickle, one or two at a time
  { dt: 300, rows: "...s..." }, { dt: 600, rows: ".s....." }, { dt: 600, rows: ".....s." }, { dt: 600, rows: "..s.s.." },
  // 1b. the pinned wall: all blue, nowhere to go. Stand still and it passes through you (SANS's blue bone lesson)
  { dt: 1000, rows: "bbbbbbb" },
  // 2. walls with two ways through, then one whose only way through is a blue comment
  { dt: 1300, rows: "ss.sss." }, { dt: 900, rows: ".sss.ss" }, { dt: 900, rows: "s.ss.ss" }, { dt: 900, rows: "ss.s.ss" }, { dt: 1000, rows: "sssbsss" },
  // 3. the waterfall: a column every 0.6s; one gap winds down and back up, the other jumps between the edges
  { dt: 1000, rows: "s.sss.s" }, { dt: 600, rows: "ss.ss.s" }, { dt: 600, rows: ".ss.sss" }, { dt: 600, rows: ".sss.ss" }, { dt: 600, rows: "sss.ss." }, { dt: 600, rows: "ss.sss." },
  // 4. finale: long comments, middle, then both edges, then the middle again
  { dt: 1100, rows: "mmm.mmm" }, { dt: 1100, rows: ".mmmmm." }, { dt: 1100, rows: "mmm.mmm" }] };

// Mario's avalanches (see the attack): charge (warning ms), fire (blast ms), waves [{ dt, low }]. Hand-made: 4, 3.9s apart, the 1st low
const MARIO = { charge: 1400, fire: 1100, waves: [{ dt: 1500, low: true }, { dt: 3900, low: false }, { dt: 3900, low: true }, { dt: 3900, low: false }] }; // designed: low, high, low, high

// ---- shared by the Sans-style turns (5-8) ----
// Galaxi's star (the shape of assets/star-l.png, solid) drawn in code at a whole-number scale k, centred on (ox, oy)
const STAR7 = ["0001000", "0001000", "0011100", "1111111", "0011100", "0001000", "0001000"], STAR3 = ["010", "111", "010"];
const starPx = (ctx, rows, k, color = "#fff", ox = 0, oy = 0) => { const n = rows.length; ctx.fillStyle = color;
  rows.forEach((r, j) => [...r].forEach((c, i) => c === "1" && ctx.fillRect(ox + (i - n / 2) * k, oy + (j - n / 2) * k, k, k))); };
// FFXIV-style telegraph: a warning flashes in (60ms) and fades out (300ms), long before the hit lands, so you have to remember where it was
const TELL = t => t < 0 ? 0 : t < 60 ? t / 60 : Math.max(0, 1 - (t - 60) / 300);
const SANS_SFX = Object.fromEntries([["impact", "impact"], ["flash", "eyeflash"]].map(([k, f]) => [k, `assets/egg/sfx/${f}.mp3`])); // UNDERTALE's
// a star blaster: one of Galaxi's stars playing SANS's Gaster Blaster, with obj_gasterblaster's own timing (30fps frames, F):
//   it comes in from 120px behind its spot, a third of the way a frame, turning round to aim as it comes (con 1), holds still for `pause`
//   frames (con 4: that's the warning: where it sits is where it fires), opens up over 4 frames (con 6, it swells), then blasts: a packed
//   stream of spinning stars down its lane for 4 + `terminal` frames while it recoils away (1px a frame faster for 4 frames, then 4), and
//   the stream thins out. A stream star only hurts while the heart's middle is inside the lane (the beam's own rule: its rectangle).
// o: k (star scale), width (lane px), charge (ms it holds before opening), damage, pace (.8 = everything 20% slower)
const STAR_BLASTER = { in: 300, charge: 550, stream: 400, vmin: 6, vmax: 10, back: 30, terminal: 8 }; // in / charge / stream: ms (tools/train-attacks.js reads these), star speed px/60fps frame, how far behind the mouth stars start, beam hold frames
const F = 1000 / 30; // one UNDERTALE frame (30fps), ms
function starBlaster(a, x, y, ang, o = {}) {
  const SB = STAR_BLASTER, { pace = 1, k = 5, width = 26, charge = SB.charge / pace, damage = 3 } = o, dx = Math.cos(ang), dy = Math.sin(ang);
  const PAUSE = Math.max(1, Math.round((charge - SB.in) / F)), HOLD = Math.round(SB.terminal / pace); // the in-flight takes ~SB.in, the rest of charge is the hold
  const inLane = () => Math.abs((a.soul.x - x) * -dy + (a.soul.y - y) * dx) <= width / 2 && (a.soul.x - x) * dx + (a.soul.y - y) * dy > 0;
  const star = () => { const n = Math.max(1, Math.round(width / 13)); // one star per lane slice, every 60fps frame of the beam
    for (let j = 0; j < n; j++) { const big = a.random(0, 1) < .3, h = big ? 21 : 15, room = Math.max(0, width / 2 - h / 2), off = Math.max(-room, Math.min(room, (j + a.random(0, 1)) / n * width - width / 2)), sp = a.random(SB.vmin, SB.vmax) * pace, back = a.random(0, SB.back);
      a.bullet({ x: x - dy * off + dx * back, y: y + dx * off + dy * back, vx: dx * sp, vy: dy * sp, w: h, h, image: big ? "bigstar" : "star",
        spin: (a.random(0, 1) < .5 ? -1 : 1) * a.random(.2, .4), damage, update: b => b.damage = inLane() ? damage : 0 }); } };
  let bx = x - dx * 120, by = y - dy * 120, rot = ang + Math.PI, con = 1, wait = 0, beam = 0, speed = 0, swell = 0, acc = 0, recoil = 0, t = 0;
  a.bullet({ x: x + dx * 300, y: y + dy * 300, w: 1200, h: width, rot: ang, damage: 0, z: -1, draw() {}, // the lane, for tools/sim.html's bot (tell: the stars are coming or still in it); never hurts itself
    update(b, dt) { t += dt; b.tell = con >= 4 && t < 3000 / pace; if (t > 3500 / pace) b.dead = true; } });
  a.bullet({ x: bx, y: by, w: 1, h: 1, damage: 0, clip: false, z: 2, line: { x, y, ang, width }, // line: where it fires (handy for test bots)
    update(b, dt) {
      for (acc += dt * pace; acc >= F; acc -= F) {
        if (con === 1) { bx += (x - bx) / 3; by += (y - by) / 3; rot += (ang - rot) / 3; if (Math.hypot(x - bx, y - by) < 3 && Math.abs(ang - rot) < .05) { bx = x; by = y; rot = ang; con = 4; wait = PAUSE; a.sfx.charge(); } }
        else if (con === 4) { if (--wait <= 0) { con = 6; wait = 4; } }
        else if (con === 6) { swell++; if (--wait <= 0) { con = 7; a.sfx.beam(); } }
        else if (con === 7) { beam++; for (let f = 0; f < F; f += 1000 / 60) a.after(f / pace, star); // two stream volleys a frame
          speed += beam < 5 ? 1 : 4; recoil += speed; if (beam > 4 + HOLD) { con = 8; } }
        else if (con === 8) { speed += 4; recoil += speed; if (recoil > 700) { b.dead = true; return; } }
      }
      b.x = bx - dx * recoil; b.y = by - dy * recoil; },
    draw(ctx) { const im = a.images.starBlaster, s = Math.max(2, Math.round(k * .6)) + (swell >= 2 ? 1 : 0), kick = con === 7 ? Math.round(Math.sin(t / 25)) * 2 : 0; // whole-number scale (crisp), +1 as it opens; shudders while blasting
      ctx.rotate(rot - ang);
      if (!im.naturalWidth) return starPx(ctx, STAR7, s + 2, "#fff", kick, 0); // (the old drawn star if the sprite hasn't loaded)
      ctx.rotate(ang - Math.PI / 2); ctx.drawImage(im, kick - 7 * s, -9.5 * s, 14 * s, 13 * s); } }); // its jaw (the sprite's bottom) faces the lane
}

// a star bomb (kablooey's): swells up at (x, y) for 700ms, flashing (the tell, no hitbox), then pops into a ring of 8 little stars.
// o: swell / bit (Images to draw instead of the star bomb and its bits: the restock event's cake and cookies), speed
function starBurst(a, x, y, o = {}) {
  const { swell, bit, speed = 3 } = o; let t = 0; a.play(SANS_SFX.flash, .5);
  a.bullet({ x, y, w: 56, h: 56, damage: 0, clip: false, z: 1, tell: true, update(b, dt) { t += dt;
      if (t < 700) return; b.dead = true; a.play(SANS_SFX.impact, .7);
      for (let i = 0; i < 8; i++) { const ang = i * Math.PI / 4 + Math.PI / 8;
        a.bullet({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, w: 15, h: 15, spin: .15, damage: 3, ...(bit ? { draw: c => bit.naturalWidth && c.drawImage(bit, -16, -16, 32, 32) } : { image: "starBombBit" }) }); } },
    draw(ctx) { if (Math.floor(t / 70) % 2 && t < 500) return; const im = swell || a.images.starBomb, k = 2 + Math.floor(t / (swell ? 280 : 140)); // swells a pixel size every 140ms (a 16px sprite: every 280ms, up to 4x)
      if (!im.naturalWidth) return starPx(ctx, STAR7, k); swell ? ctx.drawImage(im, -8 * k, -8 * k, 16 * k, 16 * k) : ctx.drawImage(im, -4.5 * k, -4.5 * k, 9 * k, 9 * k); } });
}

// one at random, but from a shuffled deck per list: nothing repeats until the list runs out, never twice in a row, and the decks last
// the whole page visit (retries too). Lists are matched by their contents, so a list written inline in a function still has one deck
const DECKS = new Map();
// one(a, b, c): say one of these, a different one each time (picked with any(): no repeats). It can stand in for a single line, or
// for a whole exchange ([line, line]); vary() resolves it wherever the engine shows text (boss.vary)
const one = (...options) => ({ oneOf: options });
const vary = x => x && x.oneOf ? vary(any(x.oneOf)) : Array.isArray(x) ? x.flatMap(e => e && e.oneOf ? [].concat(vary(e)) : [vary(e)]) : x;
const any = list => { if (list.length < 2) return list[0]; const k = JSON.stringify(list); let d = DECKS.get(k);
  if (!d || !d.left.length) { const left = list.map((_, i) => i).sort(() => Math.random() - .5); if (d && left.at(-1) === d.last) left.unshift(left.pop()); d = { left, last: d && d.last }; DECKS.set(k, d); }
  d.last = d.left.pop(); return list[d.last]; };
const nth = (foe, pick, list) => { const i = (foe.uses[pick] || 1) - 1; return i < list.length ? list[i] : any(list.length > 1 ? list.slice(1) : list); }; // by how many times you've picked it this fight

// the Mario warp secret's ending (drafts for Galaxi to approve): the narrator didn't know either, and gets nervous about itself
const WARP_END = ["* You didn't know you could do that.", "* ...Hell, I didn't know you could do that.", "* Wait. Can you do that to me?", "* ...", "* Please don't."];

window.GALAXI_BOSS = {
  name: "Galaxi",
  sprite: "assets/egg/galaxi-idle.png",
  spriteScale: 2,        // whole numbers only, keeps the pixel art crisp
  images: { star: "assets/star-m.png", bigstar: "assets/star-l.png",
    starBlaster: "assets/egg/stars/blaster.png", starBomb: "assets/egg/stars/bomb.png", starBombBit: "assets/egg/stars/bomb-projectile.png", // Galaxi's sprites, white, 14x13 / 9x9 / 3x3
    knife: "assets/egg/theworld/knife.png", // The World's knife: 5x12, white, points up, drawn at 2x
    // SANS's own sprites, pulled from UNDERTALE's data (game.ios): Gaster Blaster (6 frames of 43x57, origin 21,28), bone caps (10x6), the wide bone stab (202x100)
    sansBlaster: "assets/egg/sans/gasterblaster.png", sansBoneTop: "assets/egg/sans/bone-top.png", sansBoneBottom: "assets/egg/sans/bone-bottom.png", sansStab: "assets/egg/sans/bonestab.png",
    mterrain: "assets/egg/mario/terrain.png", msprites: "assets/egg/mario/sprites.png", mtiles: "assets/egg/mario/tiles.png", // Galaxi's 1-1 tiles (tools/build-mario.py)
    // all POKEMON YELLOW: Poke Ball and walking Pikachu from the pret/pokeyellow disassembly, front sprite from PokeAPI/sprites
    // (both on GitHub), turned white with the outline, cheeks and the ball's light half cut out; bolt: Galaxi's own electric sprite
    pokeball: "assets/egg/pokemon/pokeball.png", pikachu: "assets/egg/pokemon/pikachu.png", pikachuWalk: "assets/egg/pokemon/pikachu-walk.png", bolt: "assets/egg/pokemon/electric.png",
    // all SONIC THE HEDGEHOG (Mega Drive): rendered from the uncompressed art, mappings, layout and palettes in the Sonic 1 rebuild
    // github.com/cvghivebrain/Sonic1sq, turned white with the darker shades cut out. ghzground: Green Hill act 1's grass, seamless 256px; bridge: one of its bridge logs
    ...Object.fromEntries(["motobug", "crabmeat", "spikes", "rock", "rings", "ghzground", "bridge", "signpost"].map(n => [n, `assets/egg/sonic/${n}.png`])) },
  sounds: [...Object.values(V), ...["timestop", "pullback", "speedup", "sparkle1", "grab", "ringloss", "signpost", "alert", "bleep"].map(n => `assets/egg/sfx/${n}.mp3`), ...["eat1", "eat2", "eat3", "drink", "burp"].map(n => `assets/egg/mc/${n}.mp3`),
    ...["b", "spearrise", "bell", "segapower", "rainbowbeam", "gigatalk", "cinematiccut", "txtsans", "impact"].map(n => `assets/egg/sans/${n}.mp3`), "assets/egg/sfx/glitch.mp3", ...Object.values(SANS_SFX)],
  hp: 320,               // Galaxi's HP (doubled 2026-10-10)
  damage: 2,             // HP you lose per hit (each bullet can override with its own damage)
  playerAttack: 22,      // roughly how hard you hit on a perfect FIGHT
  // meta events (assets/egg/events/<name>.js, see the README there): 3-4 a run on PC, never two turns in a row, each at most once a run
  eventFiles: ["badtake", "demonetized", "patchnotes", "uiupdate", "crash", "boxgrab", "thumbnail", "fakeover", "confiscate", "restock"],
  eventsPerRun: [3, 4],
  healCap: 2,            // HP an attack can give back (Sonic's rings, Mario's ? blocks): Sans never lets you heal mid-attack, this keeps it a bonus
  spareRush: 1.5,        // tried to Spare too early: Galaxi's next attack runs this much faster (the music doesn't)
  spareAt: Infinity,     // SPARE never turns yellow on its own: the only spare is Galaxi giving up (concede)
  concede: { at: 4, say: [one("You're no fun!", "Ugh. You're SO annoying.", "You're ruining my boss fight!"), one("Why- WHY are you so NICE all the time?", "Why are you being so NICE to me?!", "Who's NICE in a boss fight?!"),
    one("Just... Just go! I quit!", "Fine! FINE! I give up!", "That's it! I'm done!"), one("Do you... do you wanna be my friend?", "...Can we be friends?", "So... friends?"), "...", "... No?", "...", one("... Okay...", "... Cool. Cool cool cool.", "... That's fine...")],
    flavor: one("* Galaxi is embarrassed.", "* Galaxi is staring at his shoes.", "* Galaxi is pretending nothing happened."),
    spared: one(["...", "...", { text: "OKAY!", shake: true }, "I yield.", "Jeez."], ["...", "...", { text: "FINE!", shake: true }, "You win.", "Happy now?"], ["...", { text: "...ALRIGHT!", shake: true }, "I surrender.", "Don't tell anyone."]) }, // say: after the attack that follows your 4th Compliment, then the menu (flavor) with SPARE yellow; spared: his lines when you pick Spare, then onSpare
  voice: "assets/egg/voice/galaxi-blip.mp3", // Galaxi's talking blip: one 60ms cut of his voice (from the "I'd heal you" line), Sans-style, for any line without a recording
  narrator: "assets/egg/sfx/txt1.mp3", // the "* ..." box text sound (UNDERTALE's own)
  music: "assets/egg/music/tv-world.mp3", // battle music (loops); credit is in the page footers
  musicVolume: .35,      // 0 to 1, keep it under the voice lines
  musicBpm: 145, musicBeat0: 0, // its tempo and where beat 1 of a bar falls (s): measured from the track, 312 beats a loop (the demonetized event's heartbeat syncs to it)
  // Galaxi's recordings are mastered loud (about -12 dB average, peaks at 0) next to the sfx (-15 to -25 dB), so they're turned down to sit with them
  voiceVolume: .35,      // his recorded voice lines ("Go, Pikachu!" etc.), 0 to 1
  blipVolume: .25,       // his talking blip on every other letter (the narrator's own typing sound is much quieter to begin with)

  // the speech-bubble lines use Galaxi's recordings; the "* ..." flavor/box lines are Claude placeholders to rewrite
  opening: { box: one("* Galaxi notices you found his easter egg.", "* You broke Galaxi's profile picture. He noticed.", "* Galaxi was NOT expecting visitors."),
    say: replay => [one("So, you found me huh?", "Well well well. Look who found the secret.", "Oh. You actually clicked that."),
      one("I'm Galaxi, the REAL Galaxi, and I've gone what you'd call TURBO.", "I'm Galaxi. The REAL one. And today I'm in what you'd call TURBO mode.", "I'm Galaxi, the real deal, and I've gone FULL TURBO."),
      replay ? one("Pikachu wanted a rematch.", "Pikachu says round two.", "Back for more? Pikachu's ready.") : one("Wanna see what I can do?", "Wanna see something cool?", "Let me show you what I've got.")], // replay: R on the death screen
    after: one("* Galaxi is waiting for you to mention how cool that just was.", "* Galaxi is looking at you. Expectantly.", "* Galaxi wants a compliment. Badly.") },
  // All dialogue approved by Galaxi (2026-10-09); some lines were first drafted by Claude in his style
  turns: [
    { say: [{ text: "Go, Pikachu!", sound: V.gopikachu, go: true }], attack: "pokeball", box: [230, 150], time: 9500,
      flavor: foe => foe.loop ? ["* Pikachu looks tired too.", "* Galaxi is recycling content."] : one("* You actually do think that was pretty cool.", "* You'd never admit it, but that was cool.", "* Pikachu waves at you. Galaxi pretends not to see.") },
    { before: foe => foe.last === "Compliment" ? one(["Don't think because you're so nice I'll go easy on you!"], ["Flattery won't save you!", "...It might help a little."], ["Oh, NOW you're being nice?", "I'm still not going easy on you!"]) : null, // (he does: the toned-down blasters)
      otherwise: one(["Huh, not gonna say anything?", "That was pretty rude of you."], ["No compliment? Nothing?", "Wow. Okay."], ["You're just gonna stand there?", "After THAT? Rude."]), // a pick with no react lines (e.g. Ask for mods)
      say: [{ text: "Ray of Death.", sound: V.rayofdeath }], attack: "blasters", box: [240, 170], time: 12000, // ends itself (a.end)
      flavor: ["* Galaxi's eyes are glowing.", "* Galaxi blows on his finger like it's a smoking gun.", "* Galaxi is pretending he isn't out of breath."] },
    { say: [{ text: "Gotta go fast!", sound: V.gottagofast }], flavor: one("* You can't figure out why but you suddenly feel... faster.", "* You feel a sudden urge to collect rings.", "* Somewhere, a blue hedgehog is tapping his foot."), attack: "sonic", box: [300, 110], time: 40000,
      otherwise: one(["You know what this fight needs?", "Speed."], ["Alright, let's pick up the pace."], ["You look like you could use some cardio."]) },
    { say: one(["Let's read some comments."], ["Time for the comment section.", "Don't read the replies."], ["Okay, comments.", "What could go wrong?"]), attack: "comments", box: [300, 140], time: 20000, // ends itself (a.end)
      flavor: one("* The comment section was hostile. As usual.", "* You read the comments. Never read the comments.", "* Somebody typed \"ratio\". You felt it.") },
    { sneak: true, attack: "lorem", box: [565, 130], time: 25000, // the meta turn: pretends to skip, then ends itself (a.end)
      flavor: ["* Galaxi won't stop talking.", "* Galaxi forgot what he was saying.", "* Your ears are still ringing from all the typing."] },
    { say: [{ text: "I have so many voice lines.", sound: V.ihavesomanyvoicelines }, { text: "Kablooey!", sound: V.jebluey }], attack: "kablooey", box: [240, 170], time: 25000, // ends itself (a.end)
      flavor: ["* Galaxi is having fun.", "* Galaxi is very proud of that one.", "* Galaxi checks if you looked impressed."],
      otherwise: one(["Right. Big one coming.", "I've been saving this."], ["Time for the good stuff."], ["Okay. This one goes BOOM."]) },
    { say: [{ text: "JoJo no Kimyou na Bouken!", sound: V.jojonokiminionaboken }, { text: "The World!", sound: V.theworld, go: true }], attack: "theworld", box: [260, 170], time: 20000, // ends itself (a.end) after 2 loops, ~11s,
      flavor: ["* Time feels weird.", "* Galaxi is still doing the pose.", "* You're pretty sure you lost a few seconds."],
      otherwise: one(["Have you ever watched JoJo?", "Doesn't matter. You're about to."], ["Quick question.", "How do you feel about time?"], ["This next one's a classic.", "If you know, you know."]) },
    { say: [{ text: "It's a me!", sound: V.itsame }], attack: "mario", soul: "mario", box: [320, 160], time: 17500, // 4 avalanches of 3.8s, 3.9s apart
      flavor: ["* Galaxi is pretending to be a boss.", "* Galaxi hums the overworld theme.", "* Galaxi swears he got all the coins once."],
      otherwise: one(["Alright, last attack.", "...Probably."], ["Final attack!", "...Of this round, anyway."], ["Saving my favourite for last."]) },
  ],
  // On a phone (touchscreen, no mouse) there's no fight: after the opening Galaxi notices and you play tic-tac-toe instead, first to 3
  // (draws don't score). You're X (assets/egg/ui/x.png), he's O (o.png), both 16x16 white. Idea and beats by Galaxi; wording approved by him.
  phone: {
    intro: one(["Wait.", "Are you on your PHONE right now?", "...", "Okay, this is awkward.", "I can't fight you like this. You'd need like three thumbs.", "...",
      "Okay. Compromise.", "Tic tac toe. First to 3.", "You're X, I'm O. Tap a square."],
      ["Hold on.", "Is that a PHONE?", "...", "Yeah, no. I can't fight you on a phone.", "It'd be like fighting in oven mitts.", "...", "Okay. New plan.", "Tic tac toe. First to 3.", "You're X, I'm O. Tap a square."],
      ["Wait a second.", "You're on mobile, aren't you?", "...", "This is awkward.", "My attacks need a keyboard. You've got... thumbs.", "...", "Fine. Compromise.", "Tic tac toe. First to 3.", "You're X, I'm O. Tap a square."]),
    // the board grows each time you're about to win: first to 3 on 3x3, then first to 4 on 5x3, then a last-ditch first to 5 on 5x5 where it's 4 in a row
    stages: [
      { cols: 3, rows: 3, need: 3, target: 3 },
      { cols: 5, rows: 3, need: 3, target: 4, say: one(["...", "Okay. OKAY.", "First to 4.", "And the board's bigger now. Because I said so."], ["...", "Nope. Not losing like that.", "First to 4.", "And the board's bigger. My game, my rules."]) },
      { cols: 5, rows: 5, need: 4, target: 5, say: one(["No. No no no.", "First to 5!", "5 by 5! Four in a row!", { text: "This is my FINAL FORM.", shake: true }], ["No. Absolutely not.", "First to 5!", "Five by five! Four in a row!", { text: "FINAL. FORM.", shake: true }]) },
    ],
    mistake: .3,         // how often he just guesses instead of playing properly (0 = never loses, 1 = random)
    quipChance: .35,     // how often he says something while it's his move
    quips: ["Hmm.", "Bold.", "I see what you're doing.", "Calculated.", "...Okay, that one's a guess."],
    roundWin: () => any([["Hey! I wasn't ready!"], ["Pfft. Beginner's luck."], ["That was the warm-up.", "...Obviously."]]),
    roundLose: () => any([["Ha! O wins!"], ["Tic tac TOE.", "...That's not a joke, I just like saying it."], ["I'm basically a tic tac toe pro.", "I think..."]]),
    // one line per draw in a row (a win or loss resets it); one more draw than this list and he rage quits
    draws: [one(["A draw?", "Again. Right now."], ["Tie.", "Again."], ["Nobody wins?", "Boring. Again."]), one(["Another draw.", "Huh."], ["Two draws.", "...Weird."]),
      one(["Three draws in a row?", "Are you copying me?"], ["Three in a row?", "Are you reading my mind?"]), one(["Stop drawing. Please.", "One of us has to WIN."], ["Four draws.", "This is just sad now."]),
      one(["FIVE draws.", "I'm losing my mind."], ["Five. FIVE draws.", "My brain hurts."]), one([{ text: "I swear if this happens ONE more time...", shake: true }], [{ text: "One more draw and I'm DONE.", shake: true }])],
    rageQuit: one([{ text: "THAT'S IT!", shake: true }, "I'm done!", "This game is RIGGED!", "Tic tac toe is a solved game anyway!", { text: "You're kidding!", sound: V.yourekidding }],
      [{ text: "NOPE!", shake: true }, "I quit!", "Tic tac toe is broken!", "Everyone knows it's a solved game!", { text: "You're kidding!", sound: V.yourekidding }]),
    youWin: one(["...", "I made the board BIGGER.", "And you still won.", "Okay, fine. You win. For real this time.", "Come back on a computer for the real fight!"],
      ["...", "I made the board bigger. TWICE.", "And you STILL won.", "Fine. You win. Officially.", "Come back on a computer for the real fight!"]),
    youLose: t => t.stage ? one(["Ha! I win!", "...Don't look at the board size.", "Come back on a computer if you want a REAL rematch."], ["Ha! I win!", "...The board size had nothing to do with it.", "Come back on a computer if you want a REAL rematch."])
      : one(["Ha! I win!", "Still the boss, even on mobile.", "Come back on a computer if you want a REAL rematch."], ["Ha! I win!", "Undefeated on mobile.", "Come back on a computer if you want a REAL rematch."]),
    end: { // the box lines after each ending
      win: [{ text: "Good grief.", sound: V.goodgrief, bubble: true }, "* YOU WON!", one("* You beat Galaxi at tic tac toe.", "* Galaxi lost at tic tac toe. On his own website."), one("* Even the 5x5.", "* He made the board bigger and everything."), { text: "Thanks for watching!", sound: V.thanksforwatching, bubble: true }],
      lose: ["* You lost to Galaxi at tic tac toe.", one("* ...It happens.", "* ...Don't tell anyone."), { text: "Thanks for watching!", sound: V.thanksforwatching, bubble: true }],
      rage: ["* Galaxi flipped the board.", "* Galaxi rage quit.", one("* ...You win? Technically?", "* ...That counts as a win, right?"), { text: "Thanks for watching!", sound: V.thanksforwatching, bubble: true }],
    },
  },
  tired: .85,            // once he's out of attacks and starts over, every attack runs this fast (he's tired)

  // what Galaxi says before his next attack, by what you picked on the menu (any turn; a turn's own before wins, its otherwise is the fallback).
  // nth(foe, pick, [1st time, 2nd time, ...]): after the list runs out it picks one of the later ones at random. any([...]): one at random
  react: {
    FIGHT: foe => {
      if (foe.hp <= foe.max * .35 && !foe.flags.ow) { foe.flags.ow = true; return one(["Okay, OW.", "Can we talk about this?", "...No? Okay."], ["Ow! Hey!", "Time out!", "...There's no time outs, is there."], ["Okay, that's a lot of damage.", "Can I get a break?", "...No? Cool."]); }
      if (!foe.lastHit) return any([["Ha! Missed!", "...I mean, obviously. I'm TURBO."], ["Do you want me to stand still?", "Because I'm not gonna."], ["Miss!", "Skill issue."]]);
      if (foe.lastHit >= 28) return any([["OUCH!", "Careful, you'll RUIN my designer clothes...", "Not to mention my sex appeal.", "Anyway..."], ["Hey not the face!", "I need that for thumbnails.", "Just kidding, I'm PURELY fictional.", "Reality couldn't hold these sweet curves..."]]); // a near-perfect hit
      return nth(foe, "FIGHT", [one(["You just don't know when to quit, huh?", "Don't worry, me neither."], ["Swinging at me already?", "Bold. I like it."], ["Oh, we're FIGHTING fighting?", "Love that for me."]),
        ["That tickled.", "...A lot. It tickled a lot."], ["Is that all you've got?", "...Please say yes."], ["You know I have to edit this later, right?"]]);
    },
    Check: foe => nth(foe, "Check", [one(["Did you just check me out?", "I have a girlfriend you know..."], ["Checking my stats?", "They're better in person."], ["Did you just check me out?", "Rude. I'm taken."]),
      ["You're checking me out AGAIN?", "She's gonna hear about this."], ["Take a picture, it'll last longer.", "It'll last longer."], ["Stop reading my stats!", "Those are private!"]]),
    Compliment: foe => nth(foe, "Compliment", [one(["You're so friendly, ... why?", { text: "WHY ARE YOU SO FRIENDLY?!", shake: true }], ["Aw, stop.", { text: "No, seriously, STOP. I'm the boss!", shake: true }]),
      ["Stop it.", "...No wait, keep going."], ["I'm not blushing!", "That's just my RGB."], ["You're doing this on purpose, aren't you?", { text: "...It's working.", shake: true }]]),
    Subscribe: foe => nth(foe, "Subscribe", [one(["Sorry, force of habit..."], ["...Sorry, I always say that."], ["Ignore that. Muscle memory."]), ["You can't subscribe twice.", "I checked."],
      ["Did you just ring the bell?", "...All notifications?", "Okay that's actually really nice. Stop."]]),
    "Ask for mods": foe => nth(foe, "Ask for mods", [null, ["Okay, okay. A real one this time.", "Create. It's always Create."], ["I review mods for a living, you know.", "You could just watch the videos."]]),
    "Heal me": foe => nth(foe, "Heal me", [null, ["Still no."], ["Heal yourself, I'm busy being a boss."]]),
    "Golden Carrot": one(["Best food in the game by the way.", "I think..."], ["Golden Carrots. Peak food.", "...According to the wiki."], ["Best saturation in the game.", "...Don't fact check that."]),
    "Energy Drink": one(["I used to drink like 3 of those a day!", "Fun fact ... lol."], ["I used to live off those.", "...Don't tell my doctor."], ["That's my editing fuel.", "...Was. WAS my editing fuel."]),
    Spare: foe => nth(foe, "Spare", [[one("Do you think that little of me?", "You think I'm THAT easy?", "Spare me? SPARE ME?"), one("I should teach kids like you a lesson...", "I'll show you a lesson...", "Okay. Gloves are off..."), { text: "Let's speed things up!", sound: V.letsspeeditup }],
      ["Again?!", "You really think I'm a pushover, huh?"], ["Keep pressing it.", "See what happens."]]), // then the attack runs at spareRush
  },
  // the menu's flavor line after that attack, by the same pick (otherwise the turn's own flavor)
  reactFlavor: {
    "Heal me": foe => nth(foe, "Heal me", [one("* Galaxi doesn't want to heal you, by the way.", "* Galaxi is pretending he can't heal."), "* Galaxi still doesn't want to heal you.", "* Galaxi is being really stubborn about this."]),
    "Golden Carrot": one("* Galaxi is larping Minecraft wiki knowledge.", "* Galaxi is quoting a wiki he hasn't read."), "Energy Drink": one("* You think Galaxi has a caffeine addiction.", "* Galaxi's eye is twitching a little.") },

  // lines that can come up before any attack, ahead of the react lines: retries (by how many times you've died this visit), your HP getting low,
  // and Galaxi running out of attacks (each time the turns start over)
  aside: ({ foe, player, turn, deaths, story, first }) => {
    const out = [];
    if (first && !story && deaths) out.push(...vary(deaths === 10 ? one(["...That's ten deaths.", "Are you okay? Like, genuinely?"], ["Ten deaths.", "That's... actually kind of impressive?"])
      : [one(["Back already?"], ["Oh, you're back."], ["That was quick."]), one(["You again!", "Okay, I'll admit it. I like the attention."], ["Hi again!", "...Not that I missed you."]),
        one(["Third time's the charm, right?", "...For me. It's the charm for me."], ["Third try!", "Lucky number three. For me."]),
        one(["Want a hint?", "Dodge."], ["Need a tip?", "Don't get hit."]), one(["Okay, we've been here a while.", "I'm getting kinda hungry."], ["We've been at this for ages.", "Want a snack break?", "...Me neither."])][deaths - 1]
      || any([["Respawning any%."], ["I'm putting this in a video."], ["You'll get it eventually.", "...Eventually."]])));
    if (foe.loop && turn % window.GALAXI_BOSS.turns.length === 0) out.push(...vary(foe.loop === 1 ? one(["...", "So... I'm out of attacks.", "I didn't think you'd get this far.", "Uh... reruns!"], ["...", "So. I'm out of attacks.", "Didn't plan for you lasting this long.", "Uh... encore!"])
      : foe.loop === 2 ? one(["Seriously? Round three?", "I'm so tired.", "Do you know how long these took to make?"], ["Round THREE?", "I'm running on fumes here.", "These took ages to make, you know."])
      : any([["I'm gonna need a sequel."], ["Season 2 when?"], ["Okay, you're just farming me for content now."]])));
    if (player.hp <= 6 && !foe.flags.low) { foe.flags.low = true; out.push(...any([["You're looking kinda red.", "...The heart. I mean the heart."], ["You're low!", "Not that I care. I'm the boss."]])); }
    return out;
  },

  // ---- Galaxi being alive: everything below is picked with pick() (no repeats until a pool runs out, never twice in a row, and it
  // remembers across retries for the whole page visit), so it's hard to hear the same line twice ----
  pick: list => any(list),
  vary,
  // after an attack (story mode): a no-hit attack always gets a reaction, a beating (8+ damage) sometimes does
  afterAttack: ({ foe, hits, damage, attack }) => {
    const L = window.GALAXI_BOSS.lines;
    if (!hits) { const n = foe.flags.perfect = (foe.flags.perfect || 0) + 1; return n >= 3 && Math.random() < .5 ? any(L.streak) : any(L.perfect[attack] || L.streak); }
    foe.flags.perfect = 0;
    if (damage >= 8 && Math.random() < .5) return any(L.beaten);
  },
  lines: {
    perfect: { // you took no hits: he's impressed for one line, then covers it with a playful dig
      pokeball: [["Wild LOSER used DODGE.", "It's super effective.", "...", "Gym leader wannabe."], ["Not even ONE?", "Pikachu, we're having words later.", "...And so are we, tryhard."],
        ["You dodged a Poke Ball?", "You've done this before.", "...A LOT. No-lifer."], ["Okay, Pikachu's going back in the PC.", "...You can go in there too."],
        ["That's it, I'm evolving him.", "...Wait, I don't have a Thunder Stone.", "Stop laughing."]],
      blasters: [["You dodged the Ray of Death?", "It's called that for a REASON.", "...Show-off."], ["Not even a scratch.", "Do you ever go outside?"],
        ["Those blasters took me ages to draw!", "And you just... walked around them.", "Rude."], ["You've DEFINITELY played Undertale before.", "...Dork."],
        ["I'm renaming it.", "Ray of Mild Inconvenience.", "Happy now, sweatlord?"]],
      sonic: [["Okay, you're fast.", "Not Sonic fast.", "...Sonic FAN fast. Which is worse."], ["You didn't even grab the rings?", "...Who hurt you?"],
        ["Two lanes. TWO.", "And you still found a way to be annoying."], ["You've done Green Hill before, huh.", "...Speedrunner energy. Gross."],
        ["Sonic would be proud.", "...Sonic has terrible taste, though."]],
      lorem: [["You actually read all that?", "...Nerd."], ["Wait, you followed the BLUE ones?", "That was supposed to be a secret, cheater."],
        ["Lorem ipsum, dolor sit... you're good.", "That's Latin for 'touch grass'.", "I think."], ["Do you read the terms and conditions too?", "...Of course you do."]],
      kablooey: [["Kablooey was supposed to go kablooey ON you.", "...Party pooper."], ["Not even the big one?", "I saved the big one for last!", "Menace."],
        ["That was my finale!", "...You're ruining my finale, goober."], ["Who taught you to dodge like that?", "...Actually, I don't wanna know."]],
      theworld: [["You moved in stopped time?!", "That's not how The World works!", "...JoJo nerd."], ["Even DIO would've hit you by now.", "...And DIO's a loser. Like you."],
        ["Next time I'm stopping time for longer.", "Like... nine seconds.", "...Don't correct me, wiki reader."], ["Are you a Joestar or something?", "...You've got the pose for it. Weirdo."]],
      mario: [["Not a single hit?", "Okay, speedrunner.", "...That wasn't a compliment."], ["You beat 1-1 like it was nothing.", "...It IS 1-1, but still.", "Frame-perfect freak."],
        ["Did you get all the coins too?", "...Don't answer that. I know you did. Completionist."], ["Thank you so much for playing my game!", "...Wait, wrong line.", "Get off my game."]],
    },
    streak: [["That's three no-hit attacks.", "Are you hacking?", "...Are you Sans?", "Lazybones."], ["Your keyboard's on fire, isn't it?", "...From all that practice. Touch grass."],
      ["I'm calling the mods.", "...No, the other kind of mods.", "The ones that ban cheaters.", "Like you...", "Cheater."], ["Stop being good at my game!", "I made it!", "...Get your own game."],
      ["Is this a no-hit run?", "Are you RECORDING this?", "...Clip farmer."]],
    beaten: [["Ha! Felt that one?"], ["That's gonna leave a mark."], ["Maybe try dodging?", "Just a tip."], ["Don't worry, I'll edit that part out."], ["Want me to slow down?", "...Too bad."],
      ["That's going in the highlights."], ["Oof.", "That one's going in the thumbnail."], [{ text: "I'd heal you but I don't want to.", sound: V.idhealyoubutidontwantto }],
      ["Respawn point's that way."], ["You're playing on Hardcore, by the way.", "Did I mention that?"], ["Hey, you're doing great.", "...At getting hit."]],
  },
  // one quip mid-attack (at: ms in), picked from the attack's pool
  quips: {
    pokeball: { at: 3500, lines: ["Pikachu, focus!", "Pika pika!", "Gotta catch... you.", "Thunderbolt! No wait, Thunder!", "Who's that Pokemon? It's you. Getting hit."] },
    blasters: { at: 4200, lines: ["Don't blink.", "Charging!", "Ray of DEATH!", "Left! No, right!", "Feel the stars!"] },
    sonic: { at: 5000, lines: ["Faster!", "Gotta go FASTER!", "Watch the Motobug!", "Rings are for winners.", "Green Hill Zone, baby!"] },
    kablooey: { at: 4800, lines: ["Wait for it...", "Three... two...", "Big one incoming!", "KA-", "Boom goes the star!"] },
    theworld: { at: 4500, lines: ["WRYYY!", "ZA WARUDO!", "Muda muda muda!", "Time is MINE!", "You thought it was a normal attack, but it was me, Galaxi!"] },
    mario: { at: 7000, lines: ["Mamma mia!", "Wahoo!", "Here we go!", "Watch the pipe!", "Let's-a go!"] },
  },
  // a random thought mid-attack, in place of the attack's quip (40% of the time)
  // after the crash event's reboot (foe.flags.sans) he's half SANS: most of his random thoughts are SANS's own battle lines, in SANS's blip and font
  chatter: foe => { const B = window.GALAXI_BOSS; if (foe.flags.sans && Math.random() < .6) return any(B.sansLines).map(text => ({ text, ...B.sansVoice })); return Math.random() < .4 ? any(B.chatterLines) : null; },
  sansVoice: { voice: "assets/egg/sans/txtsans.mp3", face: "comicsans" }, // face: UNDERTALE's own bitmap fnt_comicsans (battle.js BMF), not the system font
  sansLines: [["what? you think i'm just gonna stand there and take it?"], ["heh heh heh...", "that's your fault, isn't it?"], ["you can't understand how this feels."],
    ["... or is that just a poor excuse for being lazy...?", "hell if i know."], ["welp, it was worth a shot.", "guess you like doing things the hard way, huh?"],
    ["you'll get bored here.", "and then, you'll finally quit."], ["i know your type."], ["it's not gonna BE your turn. ever."], ["heh heh heh... ya get it?"],
    ["don't say i didn't warn you."], ["are you ready?"], ["here we go."]], // SANS's genocide battle lines (UNDERTALE's lang_en.json, obj_sansb / obj_sansb_body)
  chatterLines: [["Fun fact: this fight took longer to make than my last video."], ["I should be editing right now.", "...This is more fun though."], ["Ever tried Create?", "Who are we kidding, you're on MY website.", "Of course you have..."],
    ["My modpack crashed four times while I made this.", "Worth it."], ["Do red arrows in thumbnails still work?", "...Asking for a friend."], ["I wonder how many people found this.", "...You're one of like five."],
    ["Cobblemon or Pixelmon?", "...Don't answer that, people get heated."], ["This would make a great Short.", "Fifteen seconds. Max."], ["If you clip this, tag me."],
    ["I've been staring at this sprite for three hours.", "I think it's staring back."], ["Sodium or OptiFine?", "...Wrong answer. Whatever you said."], ["Render distance: 32 chunks.", "Frame rate: yes."],
    ["Is it weird that I'm narrating my own boss fight?", "...Don't answer that either."], ["Back in my day we mined with our hands.", "...It was last week."], ["Shoutout to the people in the Discord.", "You know who you are."],
    ["Should I add a second phase?", "...Don't give me ideas."], ["My Backrooms mod has better lighting than this fight.", "...Don't tell anyone."], ["Creepers are just misunderstood.", "Like me."],
    ["Thanks for watching this far.", "...Wait, this isn't a video."], ["Hold on, I think I left a render going.", "...It can wait."]],

  acts: [
    { name: "Check", run: foe => nth(foe, "Check", [["* GALAXI - ATK 5 DEF 1", one("* Finds the best Minecraft mods. Even makes his own.", "* Reviews mods for a living. Has opinions.", "* Chronically online. Proud of it.")],
      ["* GALAXI - ATK 5 DEF 1", "* Still finds the best Minecraft mods.", "* Still makes his own."], [{ text: "Who's that Pokemon?", sound: V.whosthatpokemon, bubble: true }, "* It's Galaxi.", "* It's always been Galaxi."]]) },
    { name: "Compliment", run: foe => { foe.flags.nice = (foe.flags.nice || 0) + 1; const aha = { text: "Aha!", sound: V.ahaha, bubble: true };
      return nth(foe, "Compliment", [[one("* You tell Galaxi his videos go hard.", "* You tell Galaxi his editing is crazy good."), aha], [one("* You tell Galaxi his thumbnails are clean.", "* You tell Galaxi his voice is soothing."), aha],
        ["* You tell Galaxi his mods never crash.", "* ...They do, but he takes it.", aha], [one("* You tell Galaxi he's your favourite YouTuber.", "* You tell Galaxi he's the reason you got into mods."), aha]]); } },
    { name: "Subscribe", run: foe => {
      if (foe.flags.subscribed) return foe.uses.Subscribe > 2 ? ["* You hit the bell.", "* All notifications.", { text: "Blurple!", sound: V.blurple, bubble: true }]
        : [one("* You're already subscribed.", "* You try to subscribe again. YouTube says no."), { text: "Blurple!", sound: V.blurple, bubble: true }];
      foe.flags.subscribed = true;
      return [one("* You smash that subscribe button.", "* You hit subscribe. Hard."), { text: "Like and subscribe!", sound: V.likeandsubscribe, bubble: true }];
    } },
    { name: "Ask for mods", run: foe => nth(foe, "Ask for mods", [["* You ask for a mod recommendation.", { text: "Adventure Time!", sound: V.adventuretime, bubble: true }, one("* ...that isn't a mod.", "* ...that's a cartoon.")],
      ["* You ask for a REAL mod recommendation.", { text: "Adventure Time!", sound: V.adventuretime, bubble: true }, "* He's doing this on purpose."], ["* You ask one more time.", one("* Galaxi pretends he can't hear you.", "* Galaxi starts humming loudly.")]]) },
    { name: "Heal me", run: foe => nth(foe, "Heal me", [["* You ask Galaxi to heal you.", { text: "I'd heal you but I don't want to.", sound: V.idhealyoubutidontwantto, bubble: true }],
      ["* You ask Galaxi to heal you. Nicely.", { text: "I'd heal you but I don't want to.", sound: V.idhealyoubutidontwantto, bubble: true }, "* He said it the exact same way."], one(["* You beg.", "* Galaxi looks the other way."], ["* You get on your knees.", "* Galaxi checks his phone."])]) },
  ],

  items: [
    { name: "Actual Diamond", short: "Diamond", heal: 10, text: { text: "Gobble Gobble!", sound: V.gobblegobble, bubble: true } },
    { name: "Golden Carrot", short: "GldCarrot", heal: 15 },
    { name: "Energy Drink", short: "EnergyDrk", heal: 20, verb: "drank", text: one("* You feel chronically online.", "* You can hear colours now.") },
  ],

  attacks: {
    // It's a me: SUPER MARIO BROS. 1-1 as an auto-scroller, with simple snappy platformer controls made for it (battle.js PLAT).
    // The screen scrolls on its own at a set pace you can't speed up with a wall of Galaxi's stars closing in on the left (touch it and you get
    // hurt; get squashed against a pipe and you drop back in from the top). No enemies. Break bricks, punch ? blocks for a coin
    // (+1 HP). Every time this turn comes back it carries on where the last one stopped (broken blocks stay gone); after the
    // flagpole it starts over.
    mario(a) {
      const T = 16, left = a.box.left, top = a.box.top, W = a.box.width, img = a.images, flags = a.foe().flags;
      const END = 202 * T - W; // the camera stops at the end of the level
      if (typeof flags.mario === "number") flags.mario = { off: flags.mario, grid: WORLD_1_1.slice(4).map(r => [...r]) }; // test hook: start at this scroll
      if (!flags.mario || flags.mario.off >= END) flags.mario = { off: 0, grid: WORLD_1_1.slice(4).map(r => [...r]) }; // rows 0-3 are empty sky
      const lv = flags.mario, g = lv.grid, blocks = {};
      const solidAt = (wx, wy) => "XSQ?U<>[]".includes((g[Math.floor(wy / T)] || [])[Math.floor(wx / T)] || "-");
      const sprite = (ctx, i, x, y) => img.msprites.naturalWidth && ctx.drawImage(img.msprites, i * 16, 0, 16, 24, x, y, 16, 24); // skip if it failed to load, drawing a broken image throws
      const place = b => { b.x = left + Math.round(b.wx) - Math.round(lv.off); b.y = top + Math.round(b.wy); }; // level position -> screen, on whole pixels like the terrain
      const spawn = o => { const b = a.bullet(o); place(b); return b; };

      // the level itself: the camera scrolls SCROLL px/frame on its own and nothing else moves it (you're locked to its pace; the box
      // edges are walls), brings in each column as it reaches the right edge, draws the ground/pipes/stairs and the flagpole
      const SCROLL = 1.5; // the heart moves 2.4 (battle.js PLAT.speed), so there's room to get ahead of the star wall
      let next = Math.max(0, Math.floor(lv.off / T) - 1);
      const bringIn = () => { while (next < 202 && next * T < lv.off + W + left + T) column(next++); }; // up to the canvas edge, not just the box
      a.bullet({ x: 320, y: top + 80, w: W, h: 160, damage: 0,
        update: (b, dt) => {
          const push = Math.min(END - lv.off, SCROLL * dt / 16.7); // only the scroll moves the camera: running ahead just hits the box's right edge
          if (push > 0 && !warp) { lv.off += push; a.soul.x -= push; for (const o of a.bullets()) if (o.wx === undefined && o !== b && !o.fixed) o.x -= push; } // stars etc. live in the level too
          bringIn();
          if (!lv.flagAt && a.soul.x - left + lv.off >= 198 * T - 10) { lv.flagAt = performance.now(); a.sfx.heal(); } // touching the pole's base block
        },
        draw: ctx => {
          const o = Math.round(lv.off), fx = 198 * T + 8 - o - W / 2; // (this bullet sits at the canvas middle, x 320)
          if (img.mterrain.naturalWidth) ctx.drawImage(img.mterrain, o - left, 0, 640, 160, -320, -80, 640, 160); // the whole canvas width, so a resizing box never shows an edge
          if (Math.abs(fx) < 340) { // touch the pole and the flag slides down it
            const fy = lv.flagAt ? Math.min(78, (performance.now() - lv.flagAt) / 12) : 0;
            ctx.fillStyle = "#fff"; ctx.fillRect(fx - 1, -60, 2, 108); ctx.fillRect(fx - 3, -66, 6, 6);
            ctx.beginPath(); ctx.moveTo(fx - 1, -58 + fy); ctx.lineTo(fx - 15, -51 + fy); ctx.lineTo(fx - 1, -44 + fy); ctx.fill();
          }
        } });
      function column(c) {
        for (let r = 0; r < g.length; r++) {
          const ch = g[r][c];
          if ("X<>[]".includes(ch)) spawn({ wx: c * T + 8, wy: r * T + 8, w: T, h: T, damage: 0, solid: true, draw: () => {}, update: place }); // drawn by the terrain image
          else if ("SQ?U".includes(ch)) block(c, r);
        }
      }

      // bricks break when you hit them from below, ? blocks give a heart worth 1 HP and turn into empty blocks
      function block(c, r) {
        blocks[r + "," + c] = spawn({ wx: c * T + 8, wy: r * T + 8, w: T, h: T, damage: 0, solid: true, lift: 0,
          update: (b, dt) => { place(b); b.lift = Math.max(0, b.lift - dt); },
          draw: (ctx, b) => {
            const y = b.lift ? -4 : 0;
            sprite(ctx, { S: 0, U: 8 }[g[r][c]] ?? 1, -8, -16 + y); // brick, empty (used) block, or ? block
          },
          bump: b => {
            if (g[r][c] === "S") smash(r, c);
            else if (g[r][c] !== "U") {
              g[r][c] = "U"; b.lift = 120; a.heal(1); let t = 0;
              a.bullet({ x: b.x, y: b.y - 14, vy: -3, w: 8, h: 14, damage: 0, draw: ctx => sprite(ctx, 9, -8, -16), // a heart pops out (Galaxi's coin: frame 9)
                update: (d, dt) => { d.vy += .2 * dt / 16.7; if ((t += dt) > 450) d.dead = true; } });
            }
          } });
      }

      function smash(r, c) { // a block breaks into 4 bits
        const b = blocks[r + "," + c]; g[r][c] = "-"; a.sfx.hit(); if (!b) return; b.dead = true;
        for (const [vx, vy] of [[-1.2, -4], [1.2, -4], [-1, -2.5], [1, -2.5]])
          a.bullet({ x: b.x, y: b.y, vx, vy, w: 6, h: 6, damage: 0, spin: vx * .25, update: (d, dt) => d.vy += .25 * dt / 16.7, // spinning brick bits
            draw: ctx => { ctx.fillStyle = "#fff"; ctx.fillRect(-3, -3, 6, 6); ctx.fillStyle = "#000"; ctx.fillRect(-1, -3, 1, 3); ctx.fillRect(-3, 0, 6, 1); } });
      }

      // NOT in the original: a few times per attack an avalanche of Galaxi's stars floods one half of the sky, coming from the star wall
      // on the left. The halves split at the top of 1-1's first brick/? row: bottom = the ground up to there, top = there up to the
      // box top, and the stars are spread evenly over the whole height of their half. The half is outlined in red first (obj_bonestab's warning) until the stars come
      // (Gaster Blaster charge sound). Stars fly through pipes, stairs and blocks.
      // Fair by design, checked against the level as each one lights up (the camera keeps scrolling you toward the star wall):
      //   bottom half: a brick-row ledge (one jump up) within 80% of a sprint from the heart while it charges, far enough right to still be
      //   clear of the wall when the last stars reach it (~67px on screen when the blast ends: they're 6px a frame, the camera 1.5)
      //   top half: nothing too tall to get over staying low (a tall pipe, the stairs) between the heart and where the camera will be once
      //   the stars are past: you just keep walking along the ground (hopping pits low)
      // The half the script wants if it's fair, else the other, else it waits.
      // TRAIL: how long the last stars need to clear the box (slowest 6 px/frame over ~360px). The outline is gone once the stars
      // come: watch the stars themselves before dropping back down
      const GROUND = 9 * T, MID = 5 * T, { charge: CHARGE, fire: FIRE } = MARIO, TRAIL = 1000; // CHARGE / FIRE: the warning and the blast, ms (MARIO, above GALAXI_BOSS)
      const V = SCROLL / 16.7, stand = (c, r) => solidAt(c * T + 8, r * T + 8) && !solidAt(c * T + 8, (r - 1) * T + 8); // camera px a ms; a tile you can stand on
      const tall = c => [5, 6, 7, 8].every(r => solidAt(c * T + 8, r * T + 8)); // up from the ground to the brick row: can't be crossed staying low
      const fair = low => { const hx = a.soul.x - left + lv.off, hc = Math.floor(hx / T);
        if (!low) { for (let c = hc, end = (lv.off + V * (CHARGE + FIRE + 700) + 40) / T; c <= end; c++) if (tall(c)) return false; return true; }
        const need = lv.off + V * (CHARGE + FIRE) + 67, reach = .8 * 2.4 * CHARGE / 16.7; // (the heart runs 2.4px a frame)
        for (let c = Math.floor(need / T) - 1; c * T <= lv.off + V * CHARGE + W - 6 && c < 202; c++) if (stand(c, 5) && c * T + 20 >= need && Math.abs(c * T + 8 - hx) <= reach) return true;
        return false; };
      // the avalanches, from MARIO.waves (tools/evolve.js evolves them): { dt (ms after the last one lit up), low (true: the bottom half,
      // false: the top, missing: a coin flip) }. None starts after 13.5s (it must finish in the turn)
      let clock = 0, fired = 0, nextAt = MARIO.waves.length ? MARIO.waves[0].dt : 1e9;
      a.every(100, () => {
        clock += 100;
        if (warp || fired >= MARIO.waves.length || clock < nextAt || clock > 13500) return;
        const w = MARIO.waves[fired], want = w.low === undefined ? a.random(0, 1) < .5 : w.low, low = fair(want) ? want : fair(!want) ? !want : null;
        if (low === null) return; // neither half can be sat out from here: wait
        blast(low); fired++; if (fired < MARIO.waves.length) nextAt = clock + MARIO.waves[fired].dt;
      });
      function blast(low) {
        const y0 = low ? MID : 0, y1 = low ? GROUND : MID, half = (y1 - y0) / 2;
        let t = 0;
        a.sfx.charge(); a.after(CHARGE, () => a.sfx.beam());
        a.bullet({ x: 320, y: top + y0 + half, w: W, h: y1 - y0, damage: 0, fixed: true,
          update: (b, dt) => { if ((t += dt) > CHARGE + FIRE + TRAIL + 300) b.dead = true; b.tell = t < CHARGE + FIRE; },
          draw: ctx => { if (t >= CHARGE) return; ctx.strokeStyle = "#f00"; ctx.lineWidth = 1; ctx.strokeRect(-W / 2 + 2.5, -half + .5, W - 5, half * 2 - 1); } }); // the warning: obj_bonestab's red outline, up until the stars come
        // the avalanche: 7 stars every frame for the whole blast (~500), one in each seventh of the half so the whole height is packed
        for (let i = 0; i < FIRE / 16; i++) a.after(CHARGE + i * 16, () => { for (let j = 0; j < 7; j++) star(y0, y1, j); });
      }
      function star(y0, y1, j) {
        const big = a.random(0, 1) < .3, h = big ? 21 : 15, y = y0 + (j + a.random(0, 1)) / 7 * (y1 - y0); // its seventh of the half
        a.bullet({ x: left - a.random(4, 40), y: top + Math.max(y0 + h / 2, Math.min(y1 - h / 2, y)), vx: a.random(6, 10), w: h, h, // kept fully inside its half
          image: big ? "bigstar" : "star", spin: (a.random(0, 1) < .5 ? -1 : 1) * a.random(.2, .4), damage: 3,
          // simple hitbox rule: a wave star only hurts while the heart's middle is inside its half, so standing right on the split
          // (on the brick row, or on the ground under a top wave) is always safe even if a spinning star's corner brushes the heart
          update: b => b.damage = a.soul.y >= top + y0 && a.soul.y < top + y1 ? 3 : 0 });
      }

      // the star wall: a thick pile of stars churning along the left edge, staying put on screen. The stars are only the look;
      // one invisible strip the same width does the hurting, so there are no gaps to sit in. The scroll drags you into it if you stand still.
      for (let col = 0; col < 4; col++) for (let y = 2; y < a.box.height; y += col % 2 ? 10 : 12) {
        const big = a.random(0, 1) < .3, sz = big ? 21 : 15, x0 = left + 2 + col * 9, y0 = top + y + a.random(-2, 2), ph = a.random(0, 6);
        a.bullet({ x: x0, y: y0, w: sz, h: sz, image: big ? "bigstar" : "star", spin: (a.random(0, 1) < .5 ? -1 : 1) * a.random(.08, .2), damage: 0, fixed: true, t: 0,
          update: (b, dt) => { b.t += dt; b.x = x0 + Math.sin(b.t / 110 + ph) * 3; b.y = y0 + Math.cos(b.t / 140 + ph) * 2; } });
      }
      a.bullet({ x: left + 18, y: top + a.box.height / 2, w: 36, h: a.box.height, damage: 3, fixed: true, draw: () => {} }); // hurts once the heart is ~2px into the stars (heart hitbox reaches 4px past its middle)
      bringIn();
      // start on solid ground: where Mario starts, or the first ground on screen when carrying on
      // start in the middle like every other turn: the open ground column nearest the box's middle
      const mid = Math.floor((lv.off + W / 2) / T), open = c => c >= 0 && c < 202 && g[9][c] === "X" && !solidAt(c * T + 8, 8 * T + 8);
      let c = mid; for (let d = 0; d < 20; d++) { if (open(mid + d)) { c = mid + d; break; } if (open(mid - d)) { c = mid - d; break; } }
      a.soul.x = left + c * T + 8 - lv.off; a.soul.y = top + 9 * T - 6;

      // THE SECRET: stand on 1-1's fourth pipe (the one with the hidden coin room in the real game) and press Down. The heart goes down
      // the pipe, everything stops, a pipe grows out of the top of the box, the heart pops out of it and beats Galaxi up at full throttle
      // while he screams. His HP hits 0 and the fight is won (battle.js: api.hitFoe, and endDodge wins at 0 HP).
      const PC = [...new Set(g.flatMap(row => row.map((ch, c) => ch === "<" ? c : -1)).filter(c => c >= 0))].sort((p, q) => p - q)[3], PR = g.findIndex(row => row[PC] === "<");
      let warp = null;
      const BLUE = "#003cff"; // the blue SOUL's colour (battle.js), kept the whole way through
      const PX = 196; // where the outside pipe comes up, on the box's top edge (left of Galaxi)
      const SCREAMS = [[1700, "AUGHG!"], [2800, "OH GOD THIS HURTS!"], [4000, "HOW DID YOU DO THAT?!"], [5300, "THIS CAN'T BE HOW I GO OUT!"], [6500, "NOOOO!!"]], KO = 7000; // Galaxi's lines (his own), ms after he warps; KO: the last hit
      const pipe = (ctx, h) => { const im = img.mtiles; if (!im.naturalWidth) return; ctx.save(); ctx.beginPath(); ctx.rect(-16, -h, 32, h); ctx.clip(); // only what's grown out above the line
        ctx.drawImage(im, 16, 0, 32, 16, -16, -h, 32, 16); ctx.drawImage(im, 16, 16, 32, 16, -16, -h + 16, 32, 16); ctx.restore(); };
      const go = () => {
        const foe = a.foe(), sx = left + PC * T + 16 - lv.off, sy = top + PR * T - 6; // the heart, standing on the pipe
        warp = { t: 0 }; foe.flags.warp = true; a.extend(KO + 2500);
        const say = a.say; a.say = (l, ms, shake) => shake && say(l, ms, shake); // only the screams from here (his normal mid-attack quip would cut in); put back as the attack ends
        for (const b of a.bullets()) if (b.damage || b.image || b.tell !== undefined) b.dead = true; // the stars, the star wall, any warning
        a.soul.hide = true; a.play("assets/egg/sfx/pullback.mp3", .8, .6);
        a.bullet({ x: sx, y: sy + 6, w: 1, h: 1, damage: 0, clip: false, fixed: true, z: 3, t: 0, // going down: sinks into the pipe's mouth
          update(b, dt) { b.t += dt; if (b.t > 600) b.dead = true; a.soul.x = sx; a.soul.y = sy; a.soul.vy = 0; a.soul.inv = 1e9; },
          draw(ctx, b) { ctx.save(); ctx.beginPath(); ctx.rect(-20, -40, 40, 40); ctx.clip(); a.heart(0, -6 + Math.round(b.t / 600 * 22), BLUE); ctx.restore(); } });
        a.after(700, () => { a.sfx.move(); a.bullet({ x: PX, y: Math.round(a.box.top), w: 1, h: 1, damage: 0, clip: false, fixed: true, z: 2, t: 0, // the outside pipe grows up out of the box's edge
          update(b, dt) { b.t += dt; }, draw(ctx, b) { pipe(ctx, Math.min(32, Math.round(b.t / 300 * 32 / 4) * 4)); } }); });
        let hx = PX, hy = a.box.top - 26, vy = 0, from = null, to = null, k = 0; const trail = [];
        const dash = () => { const back = to && !to.hit; from = { x: hx, y: hy }; to = back ? { x: 320 + a.random(-95, 95), y: a.random(150, 205), hit: false } : { x: a.random(275, 365), y: a.random(85, 185), hit: true }; k = 0; };
        a.after(1100, () => { a.play("assets/egg/sfx/segapower.mp3", .7); vy = -5; }); // pops out
        a.bullet({ x: 0, y: 0, w: 1, h: 1, damage: 0, clip: false, fixed: true, z: 4, t: 0,
          update(b, dt) { b.t += dt; a.soul.inv = 1e9; a.soul.x = sx; a.soul.y = sy; a.soul.vy = 0; // the real heart stays parked (hidden) in the level
            if (b.t < 1100) return;
            if (b.t < 1700) { vy += .35 * dt / 16.7; hy += vy * dt / 16.7; if (hy > a.box.top - 32 - 6 && vy > 0) { hy = a.box.top - 38; vy = 0; } return; } // up out of the pipe, lands on it
            if (a.foe().hp <= 0) { // beaten: one hop to the right of him, onto the floor he stands on (his feet: y 212), then the ending (battle.js win: foe.flags.soulAt)
              if (!b.land) { b.land = { x: hx, y: hy, t: b.t }; trail.length = 0; a.foe().flags.soulAt = { x: 432, y: 204 }; }
              const e = Math.min(1, (b.t - b.land.t) / 450); hx = b.land.x + (432 - b.land.x) * e; hy = b.land.y + (204 - b.land.y) * e - Math.sin(e * Math.PI) * 40;
              if (b.t - b.land.t > 1100 && !b.done) { b.done = true; a.say = say; a.end(); } return; }
            if (!to) dash();
            const pace = Math.max(70, 170 - (b.t - 1700) / 40); k += dt / pace; // full throttle: faster and faster
            const e = Math.min(1, k); hx = from.x + (to.x - from.x) * e; hy = from.y + (to.y - from.y) * e - Math.sin(e * Math.PI) * (to.hit ? 10 : 24);
            trail.unshift([hx, hy]); trail.length = Math.min(trail.length, 4);
            if (k >= 1) { if (to.hit) { // his HP slides down a line to 12% by KO (each hit takes what keeps it on the line, give or take), then the knockout takes the rest
                const f = a.foe(), rest = Math.round(f.max * .12), goal = rest + (f.max - rest) * Math.max(0, 1 - (b.t - 1700) / (KO - 1700));
                a.hitFoe(b.t >= KO ? f.hp : Math.max(1, Math.min(f.hp - rest, Math.round((f.hp - goal) * a.random(.8, 1.25))))); }
              dash(); }
          },
          draw(ctx, b) { if (b.t < 1100) return; ctx.save(); trail.slice(1).forEach(([x, y], i) => { ctx.globalAlpha = .3 - i * .08; a.heart(Math.round(x), Math.round(y), BLUE); }); ctx.globalAlpha = 1; a.heart(Math.round(hx), Math.round(hy), BLUE); ctx.restore(); } });
        for (const [ms, line] of SCREAMS) a.after(ms, () => a.say(line, 500, true));
      };
      a.bullet({ x: 0, y: 0, w: 1, h: 1, damage: 0, fixed: true, draw() {}, update() { // watching for the secret (fixed: the camera scroll moves every other bullet, and would drag this off and delete it)
        if (warp || !PC) return; const wx = a.soul.x - left + lv.off;
        if (a.soul.grounded && Math.abs(a.soul.y - (top + PR * T - 6)) < 2 && wx > PC * T + 2 && wx < PC * T + 30 && a.key("ArrowDown")) go(); } });
    },
    // Gotta go fast: a SONIC THE HEDGEHOG lane runner. Two Green Hill lanes scroll past (top: the log bridge, which sags under the
    // heart like the game's; bottom: the grass), and the heart is Muffet's purple SOUL with the lanes as its strings:
    // Up / Down (or a swipe) hops a lane, Left / Right run along it. It opens with a spin dash (3 revs, each higher, then
    // the release) and rolls the whole way, with afterimages. Motobugs (on either lane, driving at you faster than the ground) and Crabmeat, spikes and rocks
    // (grass only) come at you one lane at a time. Rings come in pairs in the free lane and heal 1 HP each; every hit costs 4. Waves come quicker as it goes on.
    // UNDERTALE sounds: rev = Asgore's pullback, release = speed up, rings = sparkle
    sonic(a) {
      const B = a.box, LH = B.height / 2, LOG = 16, G = 18, SND = n => `assets/egg/sfx/${n}.mp3`; // lane height, bridge log size, grass band
      // surface: the y the heart and badniks roll / stand on (on top of the logs; a little sunk into the grass)
      const surface = i => i ? B.bottom - G + 4 : B.top + LH - LOG, base = i => surface(i) - 8;
      let sag = 0; // how far the bridge dips under the heart (px), eased in while it's on the bridge
      const S = { // sprite sheets in assets/egg/sonic/: frames side by side in cells of cw x ch, run = the animation's frames
        motobug: { cw: 40, ch: 29, run: [0, 1, 2] }, crabmeat: { cw: 48, ch: 38, run: [0, 1] },
        spikes: { cw: 40, ch: 32, run: [0] }, rock: { cw: 48, ch: 32, run: [0] }, rings: { cw: 16, ch: 16, run: [0, 1, 2, 3] } };
      const sprite = (ctx, name, t, fps = 8) => { const s = S[name], im = a.images[name], f = s.run[Math.floor(t / (1000 / fps)) % s.run.length];
        if (im && im.naturalWidth) ctx.drawImage(im, f * s.cw, 0, s.cw, s.ch, -s.cw / 2, -s.ch, s.cw, s.ch); // bottom-centre on the bullet
        else { ctx.fillStyle = "#fff"; ctx.fillRect(-10, -20, 20, 20); } };
      let lane = 1, y = base(1), sp = 0, off = 0, t = 0, dash = 0, wasHit = false; // dash: the spin dash's phase clock (negative: knocked back, before the revs)
      const TOP = 5.5, REVS = [0, 320, 640], GO = 950, STUN = 450; // top speed px/frame, rev times, release time, knockback ms before re-revving

      // the ground, scrolled with the speed (drawn under everything else): the bridge's logs, dipping round the heart, and the grass
      a.bullet({ x: 0, y: 0, w: 1, h: 1, damage: 0, z: -1,
        update(b, dt) { t += dt; off += sp * dt / 16.7; while (level.length && off >= level[0].at) fire(level.shift().w); if (!level.length && !signed && off >= END) { signed = true; signpost(); } },
        draw(ctx) { const log = a.images.bridge, grass = a.images.ghzground;
          for (let x = B.left - Math.round(off) % LOG - LOG; x < B.right; x += LOG) {
            const dip = Math.round(sag * Math.max(0, 1 - Math.abs(x + LOG / 2 - 320) / 90) ** 2);
            if (log.naturalWidth) ctx.drawImage(log, x, surface(0) + dip); }
          if (grass.naturalWidth) { const w = grass.naturalWidth; for (let x = B.left - Math.round(off) % w; x < B.right; x += w) ctx.drawImage(grass, 0, 0, w, G, x, B.bottom - G, w, G); }
        } });

      // the heart: Muffet's purple SOUL (obj_purpleheart), the two lanes are its strings: Up / Down hop a lane per press (3 frames),
      // Left / Right run along it, 100px either side of the middle. Drawn here (the engine's is hidden) so it can spin and roll
      a.soul.setMode("purple", { lines: [base(0), base(1)], start: 1, xlen: 100, hideLines: true }); a.soul.hide = true;
      a.bullet({ x: 320, y, w: 1, h: 1, damage: 0, z: 2, clip: false, trail: [], spin: 0,
        update(b, dt) {
          const was = lane; lane = a.soul.y < (base(0) + base(1)) / 2 ? 0 : 1; if (lane !== was) a.sfx.move();
          sag += ((lane ? 0 : 4) - sag) * Math.min(1, dt / 80);
          b.x = a.soul.x; b.y = Math.round(a.soul.y + (lane ? 0 : sag));
          dash += dt;
          for (const r of REVS) if (dash - dt < r && dash >= r) { a.play(SND("pullback"), .8, 1 + REVS.indexOf(r) * .15); puff(); }
          if (dash - dt < GO && dash >= GO) a.play(SND("speedup"));
          if (dash >= GO) sp = Math.min(TOP, sp + .25 * dt / 16.7); else sp = sp < 0 ? Math.min(0, sp + .2 * dt / 16.7) : Math.max(0, sp - .6 * dt / 16.7); // knocked back (bounced backwards, then skids to a stop)
          const hit = a.soul.inv > 0; if (hit && !wasHit) ringLoss(); wasHit = hit; // just got hit: drop rings, stop, spin dash again
          b.rot -= (dash < GO ? .5 : .15 + sp * .06) * dt / 16.7; // revving: a fast blur; running: rolls with the speed
          b.trail.unshift(b.y); b.trail.length = 3;
        },
        draw(ctx, b) {
          if (a.soul.inv && Math.floor(t / 80) % 2) return; // hit: flashes like the normal heart
          const squash = dash < GO ? 1 - .15 * Math.abs(Math.sin(dash / 50)) : 1;
          ctx.save(); ctx.rotate(-b.rot); // afterimages, behind it, while running
          if (sp > 2) b.trail.forEach((ty, k) => { ctx.globalAlpha = .25 - k * .07; ctx.save(); ctx.translate(-(k + 1) * 7, ty - b.y); ctx.rotate(b.rot + k * .6); a.heart(0, 0, PURPLE); ctx.restore(); });
          ctx.restore(); ctx.globalAlpha = 1; ctx.scale(1, squash); a.heart(0, 0, PURPLE); } });
      const PURPLE = "#d535d9"; // spr_heartpurple
      const puff = () => { for (let k = 0; k < 4; k++) { let pt = 0; a.bullet({ x: a.soul.x - 8, y: a.soul.y + 6, vx: -a.random(1, 2.5), vy: -a.random(.2, 1), w: 1, h: 1, damage: 0,
        update(p, dt) { if ((pt += dt) > 300) p.dead = true; }, draw(ctx) { ctx.fillStyle = "#fff"; ctx.globalAlpha = 1 - pt / 300; const s = pt < 150 ? 4 : 2; ctx.fillRect(-s / 2, -s / 2, s, s); } }); } }; // dust kicked up behind

      // what comes down the lanes. Hitboxes are smaller than the sprites, and sit on the grass like the heart. The bridge only gets
      // Motobugs; Crabmeat, spikes and rocks stay on the grass. move: "charge" drives at you (own speed + fast), "pace" walks side to
      // side at half a Motobug's speed (Crabmeat), "still" sits on the ground and only comes by as you run (rocks, spikes)
      const MOTO_SPEED = 3, MOTO = { name: "motobug", move: "charge", w: 22, h: 14 }, KINDS = [[MOTO], [MOTO, { name: "crabmeat", move: "pace", w: 26, h: 14 }, { name: "spikes", move: "still", w: 22, h: 12 }, { name: "rock", move: "still", w: 26, h: 14 }]];
      const thing = (k, i, fast = 0) => { let tt = 0, dir = -1, turn = 0; a.bullet({ x: B.right + 30, y: base(i), w: k.w, h: k.h, damage: 4,
        update(o, dt) { tt += dt;
          if (k.move === "charge") o.vx = -(sp + MOTO_SPEED + fast);
          else if (k.move === "pace") { if ((turn += dt) > 600) { turn = 0; dir = -dir; } o.vx = -sp + dir * MOTO_SPEED / 2; }
          else o.vx = -sp;
          if (o.x < B.left - 40) o.dead = true; },
        draw(ctx) { ctx.translate(0, 8); if (k.move === "pace" && dir > 0) ctx.scale(-1, 1); sprite(ctx, k.name, tt); } }); }; // standing on the surface
      const rings = i => { for (let n = 0; n < 2; n++) { let rt = 0; a.bullet({ x: B.right + 30 + n * 22, y: base(i), w: 1, h: 1, damage: 0,
        update(o, dt) { rt += dt; o.vx = -sp; if (o.x < B.left - 20) o.dead = true;
          if (Math.abs(o.x - a.soul.x) < 12 && Math.abs(o.y - a.soul.y) < 12) { o.dead = true; a.heal(1, false); a.play(SND("sparkle1"), .5); } },
        draw(ctx) { ctx.translate(0, 8); sprite(ctx, "rings", rt, 12); } }); } }; // centred on the heart's path
      // hit: like the games, your rings burst out of you in a fan, bounce, flicker and are gone; you skid to a stop and spin dash again
      // (so a hit costs HP and time: the level only moves while you do)
      const ringLoss = () => { dash = -STUN; sp = -3.5; a.play(SND("ringloss"), .7); // bounced back off what hit you; SONIC's ring loss sound
        for (let n = 0; n < 8; n++) { const ang = -Math.PI * (.12 + .76 * n / 7), v = n % 2 ? 3.4 : 2.4; let rt = 0;
          a.bullet({ x: a.soul.x, y: a.soul.y - 4, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, w: 1, h: 1, damage: 0, z: 1,
            update(o, dt) { rt += dt; o.vy += .18 * dt / 16.7; o.x -= sp * dt / 16.7; const fl = base(lane) + 4; if (o.y > fl && o.vy > 0) { o.y = fl; o.vy *= -.6; } if (rt > 1500) o.dead = true; },
            draw(ctx) { if (rt > 900 && Math.floor(rt / 60) % 2) return; ctx.translate(0, 8); sprite(ctx, "rings", rt, 16); } }); } };
      // the warning, only for things that drive at you (Motobugs): a small [!] at the far right of their lane, with SONIC's air-warning
      // ding, WARN ms before they come in. Easy to miss unless you're watching. Things that sit still or pace don't get one
      const WARN = 250, flash = i => { let ft = 0; a.play(SND("alert"), .45); a.bullet({ x: B.right - 18, y: B.top + LH * (i + .5), w: 1, h: 1, damage: 0, z: 1,
        update(f, dt) { if ((ft += dt) > 500) f.dead = true; },
        draw(ctx) { if (Math.floor(ft / 100) % 2) return; ctx.font = '16px "DTM-Mono", monospace'; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff"; ctx.fillText("[!]", 0, 0); } }); }; // blinks
      // the level, played from SONIC (above GALAXI_BOSS, designed by hand): each wave blocks one lane (lane: "you" = the one you're in,
      // "other", 0 = the bridge, 1 = the grass), with kind = which badnik / obstacle (an index into that lane's list) and fast = extra
      // speed for a Motobug (px/frame). rings: true puts rings in the other lane. Waves are placed by distance (dt = ms at full speed),
      // so getting hit and stopping holds the whole level back. The signpost waits at the end
      const PXMS = TOP / 16.7; let D = 0;
      const level = SONIC.waves.map(w => ({ w, at: D += w.dt * PXMS })), END = D + (SONIC.sign || 900) * PXMS; let signed = false;
      const fire = w => { const i = w.lane === "you" ? lane : w.lane === "other" ? 1 - lane : w.lane ? 1 : 0, ks = KINDS[i], k = ks[(w.kind || 0) % ks.length];
        if (w.rings) rings(1 - i);
        if (k.move === "charge") { flash(i); a.after(WARN, () => thing(k, i, w.fast)); } else thing(k, i, w.fast); };
      // the end of the act: SONIC 1's signpost (assets/egg/sonic/signpost.png, 5 frames of 48: Eggman, spin, edge, spin, Sonic; made
      // UNDERTALE-style from the Sonic1sq art), standing on the grass. Run past it and it spins (3 turns) and lands on Sonic, then the turn ends
      // SPIN: ms it spins (about the length of the sound)
      const SPIN = 1500, signpost = () => { let st = -1; a.bullet({ x: B.right + 30, y: B.bottom - G + 4, w: 1, h: 1, damage: 0, z: -1,
        update(o, dt) { o.vx = -sp; if (st < 0 && o.x <= a.soul.x) { st = 0; a.play(SND("signpost"), .7); } if (st < 0) return; st += dt; // SONIC's signpost sound, spinning with it
          if (st >= SPIN && !o.done) { o.done = true; a.after(600, () => a.end()); } },
        draw(ctx) { const im = a.images.signpost; if (!im || !im.naturalWidth) return; const f = st < 0 ? 0 : st >= SPIN ? 4 : [0, 1, 2, 3, 4, 1, 2, 3][Math.floor(st / 60) % 8];
          ctx.drawImage(im, f * 48, 0, 48, 48, -24, -48, 48, 48); } }); };
    },
    // SANS's genocide opener, recreated 1:1 from UNDERTALE's own code (obj_sansb_body Draw, fac 1-19; obj_sans_bonebul, obj_bonestab,
    // obj_gasterblaster, obj_sans_shaker), stepped at the game's 30fps: the box is 160x160. Frame 7: the SOUL turns blue and is slammed to
    // the floor. 21: a row of bones stabs up out of the floor (red outline first) while a sine tunnel of bones scrolls in from the left.
    // 41: the SOUL turns red (bell). 86 / 111 / 136: four Gaster Blasters (a cross, the diagonals, the cross). 156: two giant ones from
    // the sides. 246: done. Sprites and sounds pulled from the game (assets/egg/sans/). Used by the crash event's reboot.
    sansopener(a) {
      const F = 1000 / 30, B = a.box, L = B.left, Rt = B.right, T = B.top, Bot = B.bottom, S = "assets/egg/sans/", D2R = Math.PI / 180;
      const snd = (n, v = .8, r = 1) => a.play(S + n + ".mp3", v, r);
      const ldx = (len, dir) => len * Math.cos(dir * D2R), ldy = (len, dir) => -len * Math.sin(dir * D2R); // GameMaker's lengthdir_x / _y
      let frame = 0, onceThisFrame = {}; const once = (k, fn) => { if (onceThisFrame[k] !== frame) { onceThisFrame[k] = frame; fn(); } }; // a sound once per frame (the game stops and restarts it)
      const stepper = step => { let acc = 0; return (b, dt) => { acc += dt; while (acc >= F && !b.dead) { acc -= F; step(b); } }; }; // run step() once per 30fps frame
      // scr_sbo(height, hspeed, delay, type): a bone sliding sideways. type 0 stands on the floor up to height; 2 hangs from the ceiling down to it
      const sbo = (h, hs, delay, type) => { const x0 = 320 - hs * delay, y = Bot - h, y1 = type === 2 ? T + 11 : y + 5, y2 = type === 2 ? y : Bot - 6;
        a.bullet({ x: x0 + 5, y: (y1 + y2) / 2, vx: hs / 2, w: 6, h: Math.max(1, y2 - y1), damage: 3, // (hspeed is px per 30fps frame; vx is per 60fps frame)
          draw(c, b) { const top = a.images.sansBoneTop, bot = a.images.sansBoneBottom, cy = b.y; c.fillStyle = "#fff"; c.fillRect(-3, y1 - cy, 6, y2 - y1);
            if (top.naturalWidth) c.drawImage(top, -5, (type === 2 ? T + 6 : y) - cy); if (bot.naturalWidth) c.drawImage(bot, -5, (type === 2 ? y : Bot - 6) - cy); } }); };
      // obj_bonestab: a wide row of bones out of the floor. A red outline for `warning` frames, up in 3 frames, a jolt, `retain` frames, then down
      const bonestab = (height, warning, retain) => { let k = 0, active = false, con = 0, timer = 0, y = Bot, cosm = 0, jx = 0, racket = 3;
        a.bullet({ x: (L + Rt) / 2, y: Bot, w: B.width, h: 1, damage: 0, tell: true,
          update: stepper(b => { k++;
            if (k === 1) { active = true; con = 1; if (warning > 4) snd("b"); }
            if (active) { warning--; if (warning <= 0 && con === 1) con = 2; }
            if (con === 2) { if (timer === 0) snd("spearrise");
              if (timer <= 2) y -= Math.floor(height / 3); if (timer === 3) cosm -= Math.floor(height / 5); if (timer === 4) cosm = 0;
              if (timer >= 4 && timer <= 8) { const rr = a.random(0, racket) - a.random(0, racket), rr2 = a.random(0, racket) - a.random(0, racket); if (racket > 1) racket--; y = Bot - height + rr; jx = rr2; }
              if (timer >= 9 + retain) { y += Math.floor(height / 4); if (y > Bot) b.dead = true; }
              timer++; }
            const top = y + cosm + 4; b.damage = con === 2 && top < Bot ? 3 : 0; b.h = Math.max(1, Bot - top); b.y = (top + Bot) / 2; b.tell = con !== 2; }),
          draw(c, b) { if (!active) return; const cy = b.y, cx = b.x;
            if (con !== 2) { c.strokeStyle = "#f00"; c.lineWidth = 1; c.strokeRect(L + 8 - cx + .5, Bot - height - cy + .5, Rt - 3 - (L + 8), height - 3); return; } // the warning
            const im = a.images.sansStab; if (im.naturalWidth) c.drawImage(im, L + jx - cx, y + cosm - cy); } }); };
      // obj_gasterblaster: flies in from (sx, sy) and turns to face rot (degrees, GameMaker's: anticlockwise, 0 = mouth down), waits `pause`
      // frames, opens its mouth over 4, fires a beam that swells for 4 frames, holds for `terminal`, fades, and recoils off-screen
      const blaster = (sx, sy, ix, iy, rot, xs, pause, terminal) => { let x = sx, y = sy, ang = 0, con = 1, wait = 0, img = 0, bt = 0, bb = 0, bbs = 0, btimer = 0, fade = 1, speed = 0, colo = 0;
        once("power", () => snd("segapower", .8, 1.2));
        const hit = a.bullet({ x: -500, y: -500, w: 1, h: 1, damage: 0, clip: false, draw() {} }); // the beam's hitbox (a rotated rectangle along it)
        a.bullet({ x: 0, y: 0, w: 1, h: 1, damage: 0, clip: false, z: 1,
          update: stepper(b => {
            if (con === 1) { x += Math.floor((ix - x) / 3); y += Math.floor((iy - y) / 3); if (x < ix) x++; if (y < iy) y++; if (x > ix) x--; if (y > iy) y--; if (Math.abs(x - ix) < 3) x = ix; if (Math.abs(y - iy) < 3) y = iy;
              ang += Math.floor((rot - ang) / 3); if (ang < rot) ang++; if (ang > rot) ang--; if (Math.abs(ang - rot) < 3) ang = rot;
              if (x === ix && y === iy && ang === rot) { con = 4; wait = pause; } }
            else if (con === 4) { if (--wait <= 0) { con = 6; wait = 4; } } // (con 5 just starts the 4-frame mouth opening)
            if (con === 6) { img++; if (--wait <= 0) con = 7; }
            else if (con === 7) {
              img = img === 4 ? 5 : 4; const dir = rot + 90;
              if (btimer === 0) { once("beam", () => { snd("rainbowbeam", .8, 1.2); snd("gigatalk", .6, 1.2); }); if (xs >= 2) a.quake(5); }
              btimer++;
              if (btimer < 5) { speed += 1; bt += Math.floor(35 * xs / 4); } else speed += 4;
              if (btimer > 5 + terminal) { bt *= .8; fade -= .1; if (bt <= 2) { b.dead = hit.dead = true; return; } }
              x += ldx(speed, dir); y += ldy(speed, dir); bbs++; bb = Math.sin(bbs / 1.5) * bt / 4;
              const m = 70 * xs / 2, d = ang - 90, mx = x + ldx(m, d), my = y + ldy(m, d); // the mouth; the beam goes 1000px from it
              Object.assign(hit, { x: mx + ldx(500, d), y: my + ldy(500, d), w: 1000, h: Math.max(1, bt), rot: Math.atan2(ldy(1, d), ldx(1, d)), damage: colo && fade >= .8 ? 3 : 0 }); colo = 1;
            } }),
          draw(c) { const im = a.images.sansBlaster;
            if (con === 7) { const m = 70 * xs / 2, d = ang - 90, mx = x + ldx(m, d), my = y + ldy(m, d), rr = Math.random() * 2 - Math.random() * 2, rr2 = Math.random() * 2 - Math.random() * 2; // the beam (behind the head)
              c.save(); c.globalAlpha = Math.max(0, fade); c.strokeStyle = "#fff"; c.lineCap = "butt";
              for (const [len, w] of [[1000, bt + bb], [50 * xs / 2, bt / 2 + bb], [60 * xs / 2, bt / 1.25 + bb]]) { if (w <= 0) continue; c.lineWidth = w; c.beginPath(); c.moveTo(mx + rr, my + rr2); c.lineTo(x + ldx(len, d) + rr, y + ldy(len, d) + rr2); c.stroke(); }
              c.restore(); }
            if (im.naturalWidth) { c.save(); c.translate(Math.round(x), Math.round(y)); c.rotate(-ang * D2R); c.scale(xs, xs); c.drawImage(im, Math.min(5, img) * 43, 0, 43, 57, -21, -28, 43, 57); c.restore(); } } }); };
      const cross = () => { blaster(0, 0, L - 50, T + 20, 90, 2, 10, 8); blaster(640, 480, Rt + 50, Bot - 20, -90, 2, 10, 8); blaster(0, 0, L + 20, T - 60, 0, 2, 10, 8); blaster(640, 480, Rt - 20, Bot + 60, 180, 2, 10, 8); };
      // the script, by frame (alarm[7] waits from the game)
      const script = {
        0: () => snd("cinematiccut", .8, 1.4),
        7: () => { a.soul.blue = true; a.soul.ut = true; a.soul.vy = 25; slam = true; }, // event_user(10): blue, slammed down at 25px a frame
        21: () => { bonestab(55, 6, 30); for (let i = 0; i < 20; i++) { sbo(135 - Math.sin(i / 3) * 28, 12, 40 + i * 2, 2); sbo(90 - Math.sin(i / 3) * 28, 12, 40 + i * 2, 0); } },
        41: () => { a.soul.blue = false; a.soul.vy = 0; snd("bell"); },
        49: () => snd("cinematiccut", .8, 1.4),
        86: cross,
        111: () => { blaster(0, 0, L - 50, T - 50, 45, 2, 10, 8); blaster(640, 0, Rt + 50, T - 50, -45, 2, 10, 8); blaster(0, 480, L - 50, Bot + 50, 135, 2, 10, 8); blaster(640, 480, Rt + 50, Bot + 50, -135, 2, 10, 8); },
        136: cross,
        156: () => { blaster(0, 240, L - 100, T + 80, 90, 3, 20, 15); blaster(640, 240, Rt + 100, T + 80, -90, 3, 20, 15); },
        246: () => a.end(),
      };
      let slam = false;
      a.bullet({ x: 0, y: 0, w: 1, h: 1, damage: 0, clip: false, draw() {},
        update: stepper(() => { if (script[frame]) script[frame](); if (slam && a.soul.grounded) { slam = false; snd("impact"); a.quake(3); } frame++; }) });
    },
    // The comment section: like Sans's opening bones. Columns of comments slide across the box from the left edge, no warning, at a
    // steady pace, each with gaps to slip through (COMMENTS, above GALAXI_BOSS). Header above the box: "Comments 1.2K / Sort by: Top"
    comments(a) {
      const B = a.box, C = COMMENTS, RH = B.height / C.rows, FONT = '18px "DTM-Mono", monospace';
      const m = document.createElement("canvas").getContext("2d"); m.font = FONT; const CW = m.measureText("M").width || 10;
      const TEXTS = ["first!", "who's here in 2026", "W video", "galaxi never misses", "ratio", "bro fell off", "underrated", "pin me", "is this a mod?",
        "subscribed :)", "this is so cozy", "mid ngl", "4k when", "notification squad", "the editing tho", "do a part 2", "this aged well",
        "like if you read this", "I saw it first", "ok but why the star", "banger", "skill issue", "L + ratio", "touch grass"];
      const BY = { s: TEXTS.filter(t => t.length <= 7), m: TEXTS.filter(t => t.length >= 8 && t.length <= 12), l: TEXTS.filter(t => t.length >= 13), b: ["pinned", "hearted", "pinned!"] }, n = { s: 0, m: 0, l: 0, b: 0 };
      const next = c => BY[c][n[c]++ % BY[c].length]; // each length in turn, so the wall is the same every run
      a.bullet({ x: 0, y: 0, w: 1, h: 1, damage: 0, clip: false, draw(c) { c.font = "14px DTM-Sans"; c.textBaseline = "alphabetic"; // the header; both ends clear of Galaxi's sprite
        c.fillStyle = "#fff"; c.textAlign = "left"; c.fillText("Comments 1.2K", B.left, B.top - 8); c.fillStyle = "#888"; c.textAlign = "right"; c.fillText("Sort by: Top", B.right, B.top - 8); } });
      let t = 0, longest = 0;
      for (const col of C.cols) { t += col.dt; a.after(t, () => [...col.rows].forEach((ch, r) => { if (ch === ".") return;
        const text = next(ch), len = Math.round(text.length * CW);
        const blue = ch === "b";
        a.bullet({ x: B.left - len / 2, y: B.top + RH * (r + .5), vx: C.speed, w: len, h: 14, damage: 3, type: blue ? "blue" : undefined,
          draw(c) { c.font = FONT; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = blue ? "#14a9ff" : "#fff"; c.fillText(text, 0, 1); } }); })); }
      a.after(t + (B.width + 14 * 10) / C.speed * 16.7, () => a.end()); // once the last column is across (the engine waits for any stragglers)
    },
    // Go, Pikachu: "Go, Pikachu!" is a go: line, so this starts as it's said: Galaxi throws a Poke Ball next to him, it pops
    // open with a flash and Pikachu grows in like the games. Pikachu then hops into the box and runs and jumps along its floor,
    // shooting lightning at the heart on a steady beat, and every few seconds stops to call down Thunder on your column (warning
    // line first). Galaxi lobs Poke Balls too (a faint POKEMON GO catch ring round the heart while one's coming), faster as the turn goes on;
    // a ball that reaches you catches you, and that's the hit (once, the normal hit with i-frames): it wobbles once or twice (you can't move,
    // mash any key to struggle out sooner) while Pikachu waits, then you break out. Thunder's warning is UNDERTALE's red outline (obj_bonestab).
    pokeball(a) {
      const G = .2, HAND = { x: 320, y: 160 }, K = 2, PIKA = { x: 220, y: 172 }; // gravity (px/frame²), Galaxi's hand, sprite scale, where Pikachu comes out (left of Galaxi, clear of the speech bubble)
      let caught = null, safe = false; // safe: just broke out, can't be caught again for a moment
      // the ball, part: 0 whole, 1 top half, 2 bottom half (each drawn centred on its bullet)
      const look = part => (ctx, b) => { const im = a.images.pokeball, h = part ? 6 : 12, sy = part === 2 ? 6 : 0;
        if (b.alpha !== undefined) ctx.globalAlpha = Math.max(0, b.alpha); // fading out
        if (im.naturalWidth) ctx.drawImage(im, 0, sy, 12, h, -6 * K, -h / 2 * K, 12 * K, h * K); };
      // UNDERTALE sounds: throw = the swing, caught = the SOUL dropping in, wobble/bounce = menu tick, each bolt = the encounter blip
      const SND = n => `assets/egg/sfx/${n}.mp3`, THROW = SND("laz"), CATCH = SND("battlefall"), ZAP = SND("noise");
      const arc = (x, y, tx, ty, ms) => { const n = ms / 16.7; return { x, y, vx: (tx - x) / n, vy: (ty - y) / n - G * n / 2 }; }; // comes down on (tx, ty) after ms
      const fall = (b, dt) => b.vy += G * dt / 16.7;
      const pop = (x, y) => { a.sfx.crack(); // the halves fly apart
        for (const part of [1, 2]) a.bullet({ x, y: y + (part === 1 ? -6 : 6), vx: part === 1 ? -1.2 : 1.2, vy: part === 1 ? -3 : -1, spin: part === 1 ? -.2 : .2,
          damage: 0, clip: false, t: 0, draw: look(part), update(h, dt) { fall(h, dt); if ((h.t += dt) > 600) h.dead = true; } });
      };
      // a bolt: aimed at the nearest of 8 directions (every 45°), always pointing exactly the way it flies. It turns about its tip
      // (the sprite's bottom, which leads), so every angle comes out of the same spot; the hitbox sits on that tip
      const bolt = (ctx, b) => { const im = a.images.bolt; if (im.naturalWidth) ctx.drawImage(im, -8, -22, 16, 22); }; // 2x, bottom edge on the pivot
      const zap = (x, y, tx, ty, speed) => { const ang = Math.round(Math.atan2(ty - y, tx - x) / (Math.PI / 4)) * Math.PI / 4;
        a.bullet({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, rot: ang - Math.PI / 2, w: 12, h: 12, draw: bolt }); a.play(ZAP); };

      // POKEMON GO's catch rings, UNDERTALE-style and faint: while a ball flies at you, a grey ring sits round the heart (you're the
      // Pokemon here) and a coloured one shrinks inside it, going green -> yellow -> orange -> red (UNDERTALE's soul colours) as the
      // ball closes in. Drawn as pixel art: a midpoint circle of 2x2 blocks, the same 2x scale as the sprites
      const ring = (ctx, r, color) => { ctx.fillStyle = color; let x = r, y = 0, e = 1 - r;
        while (x >= y) { for (const [px, py] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) ctx.fillRect(px * 2 - 1, py * 2 - 1, 2, 2);
          y++; if (e < 0) e += 2 * y + 1; else { x--; e += 2 * (y - x) + 1; } } };
      const marker = ms => { let t = 0; a.bullet({ x: Math.round(a.soul.x), y: Math.round(a.soul.y), w: 1, h: 1, damage: 0,
        update(m, dt) { if ((t += dt) >= ms || caught) m.dead = true; m.x = Math.round(a.soul.x); m.y = Math.round(a.soul.y); }, // whole pixels, so it stays crisp
        draw(ctx) { const k = Math.min(1, t / ms);
          ctx.globalAlpha = .35; ring(ctx, 12, "#c0c0c0");
          ctx.globalAlpha = .55; ring(ctx, Math.round(11 - 7 * k), k < .4 ? "#00ff00" : k < .65 ? "#ffff00" : k < .85 ? "#ff7f27" : "#ff0000"); } }); };
      // Galaxi's throws at the heart. A ball flies in over the top edge, and from then on it's masked by the box and stays inside it:
      // it bounces off the walls and floor. Landing in the middle third it just fades away; elsewhere it rolls off toward the nearer
      // wall, bounces back, then fades. It can catch you any time until it starts fading.
      const R = 11; let hand = 1, stray = 1; // the ball's radius on screen; which hand / which side the next ball comes from (they alternate)
      const lob = (tx, ty, ms, aimed = true) => { a.play(THROW); if (aimed) marker(ms); a.bullet({ ...arc(HAND.x + (hand = -hand) * 24, HAND.y, tx, ty, ms), w: 22, h: 22, damage: 0, clip: false, spin: .15, draw: look(0),
        update(b, dt) {
          if (b === caught) return holdOn(b, dt);
          b.tell = b.clip && b.alpha === undefined; // can still catch you (for tools/sim.html's bot)
          const B = a.box, f = dt / 16.7;
          fall(b, dt);
          if (!b.clip && b.y > B.top - R) b.clip = true; // reached the box: masked from here on, so it slides in under the top edge
          if (b.clip) {
            if (b.x < B.left + R && b.vx < 0 || b.x > B.right - R && b.vx > 0) { b.vx *= -.7; b.x = Math.max(B.left + R, Math.min(B.right - R, b.x)); a.sfx.move(); } // walls
            if (b.y > B.bottom - R && b.vy > 0) { // floor
              b.y = B.bottom - R;
              if (b.landed === undefined) { // first touch: fade here if it's the middle, otherwise roll away from the middle
                b.landed = 0; const off = b.x - (B.left + B.right) / 2;
                if (Math.abs(off) < B.width / 6) b.alpha = 1; else b.vx = Math.sign(off) * Math.max(1.6, Math.abs(b.vx));
              }
              b.vy = b.vy > 1.5 ? -b.vy * .45 : 0; if (b.vy) a.sfx.move(); // a couple of hops, then it rolls
            }
            if (b.landed !== undefined) { b.landed += dt; b.spin = b.vx / R; if (b.vy === 0 && b.alpha === undefined) b.vx *= Math.pow(.99, f); } // rolls, turning as it goes
            if (b.landed > 1400 && b.alpha === undefined) b.alpha = 1;
            if (b.alpha !== undefined && (b.alpha -= dt / 300) <= 0) b.dead = true;
          }
          if (!caught && !safe && b.clip && b.alpha === undefined && Math.abs(b.x - a.soul.x) < 13 && Math.abs(b.y - a.soul.y) < 13) {
            caught = b; b.vx = b.vy = b.spin = b.rot = b.t = 0; b.x = a.soul.x; b.y = a.soul.y; b.wobbles = 2;
            b.damage = 3; b.clip = true; // the catch is the hit: the ball deals it once (the engine's normal hit, i-frames and all), then it's just a cage
            a.soul.hide = true; a.play(CATCH);
          }
        } }); };
      // caught: 400ms still, then each wobble is a 500ms shake and a 450ms pause; after the last one it pops open.
      // Struggle: after the first 400ms, every key press / tap jolts the ball and skips 110ms ahead (mashing ~2x as fast)
      const holdOn = (b, dt) => {
        a.soul.x = b.x; a.soul.y = b.y; b.t += dt; if (b.t > 40) b.damage = 0;
        if (b.t > 400 && a.pressed()) { b.t += 110; b.jolt = 140; a.sfx.move(); }
        const k = b.t - 400, i = Math.floor(k / 950), p = k - i * 950;
        b.rot = k > 0 && p < 500 ? Math.sin(p / 500 * Math.PI * 2) * .45 : 0;
        if (b.jolt > 0) { b.jolt -= dt; b.rot += Math.sin(b.jolt / 140 * Math.PI * 3) * .3; }
        if (k > 0 && b.shook !== i && i < b.wobbles) { b.shook = i; a.sfx.move(); }
        if (k < b.wobbles * 950) return;
        b.dead = true; caught = null; safe = true; a.after(900, () => safe = false); a.soul.hide = false; pop(b.x, b.y);
      };
      // throws at the heart, played from PB.throws (above GALAXI_BOSS, designed by hand): each { dt (ms after the last; waits
      // while you're caught), ms (flight time), lead (0 aims where the heart is, 1 where it's heading) }. Each is rated like a POKEMON GO
      // throw, and the rating pops up above Galaxi's head as he throws: Excellent! (fast, 0.6s or less), Great! (0.8s or less), else Nice!
      let clock = 0, k = 0, nextLob = PB.throws.length ? PB.throws[0].dt : 1e9, last = null, vel = { x: 0, y: 0 };
      a.every(50, () => {
        clock += 50;
        if (last && !caught) vel = { x: (a.soul.x - last.x) / 50, y: (a.soul.y - last.y) / 50 }; // the heart's speed, px/ms
        last = { x: a.soul.x, y: a.soul.y };
        if (clock < nextLob || caught) return;
        const th = PB.throws[k++], B = a.box, tx = Math.max(B.left + R, Math.min(B.right - R, a.soul.x + vel.x * th.ms * th.lead)), ty = Math.max(B.top + R, Math.min(B.bottom - R, a.soul.y + vel.y * th.ms * th.lead));
        lob(tx, ty, th.ms); rating(th.ms <= 600 ? "Excellent!" : th.ms <= 800 ? "Great!" : "Nice!");
        nextLob = k < PB.throws.length ? clock + PB.throws[k].dt : 1e9;
      });
      // the rating, in UNDERTALE's font at speech size, floating up from just above Galaxi's head (his sprite's top is at y 60)
      const rating = text => { let t = 0; a.bullet({ x: 320, y: 50, w: 1, h: 1, damage: 0, clip: false,
        update(r, dt) { if ((t += dt) > 700) r.dead = true; },
        draw(ctx) { ctx.globalAlpha = t > 450 ? 1 - (t - 450) / 250 : 1; ctx.fillStyle = "#fff"; ctx.font = "24px DTM-Mono"; ctx.textAlign = "center";
          ctx.fillText(text, 0, -Math.round(t / 40) * 2); } }); }; // rises in 2px steps, pixel-consistent
      a.every(PB.stray, () => { if (!caught) lob((stray = -stray) < 0 ? a.box.left + 30 : a.box.right - 30, a.box.bottom - 20, 900, false); }, PB.stray + 200); // a stray one to box you in: left corner, then right

      // Pikachu, once it hops into the box: the floor is the box bottom, the sides are walls it bounces off. It runs and jumps, and
      // shoots on a steady beat. It doesn't hurt to touch, only its bolts do.
      // POKEMON YELLOW's walking Pikachu sheet (16px frames): 2 = facing left, 5 = the same mid-step. Facing right = mirrored
      const box = a.box, HALF = 8 * K, FLOOR = box.bottom - HALF;
      const pikachu = {
        x: PIKA.x, y: PIKA.y, w: 1, h: 1, damage: 0, clip: false, t: 0, mode: "out", dir: 1, nextHop: 700, beat: 0, thunderIn: PB.first, charging: 0,
        update(p, dt) {
          p.t += dt;
          if (p.mode === "out" && p.t > 700) Object.assign(p, arc(p.x, p.y, box.left + 40, FLOOR, 550), { mode: "in", inT: 0 });
          if (p.mode === "in") { fall(p, dt); if ((p.inT += dt) >= 550) { p.y = FLOOR; p.vx = p.vy = 0; p.mode = "run"; } return; }
          if (p.mode !== "run") return;
          if (p.charging > 0) { p.vx = 0; p.charging -= dt; return; } // stands still while it calls down Thunder
          if (!caught) p.thunderIn -= dt;
          if (p.thunderIn <= 0 && p.y >= FLOOR && !caught && !a.ending) { p.thunderIn = PB.thunder; p.charging = 700; return thunder(); } // waits until it's landed
          p.vx = p.dir * 1.7; // the engine moves it by vx / vy
          if (p.x < box.left + HALF && p.dir < 0 || p.x > box.right - HALF && p.dir > 0) p.dir *= -1; // walls
          const was = p.vy; fall(p, dt);
          if (p.y >= FLOOR && p.vy > 0) { p.y = FLOOR; p.vy = 0; } // lands
          if (p.y >= FLOOR && (p.nextHop -= dt) <= 0) { p.vy = -4.6; p.nextHop = PB.hop; } // hops on a steady rhythm, so you can read it
          if ((p.beat += dt) >= PB.beat && !a.ending && !caught) { p.beat = 0; shoot(p); } // a steady beat: 1 bolt every 0.8s. Never at a caught ball (it'd be free damage); it waits
        },
        draw(ctx, p) {
          if (p.mode === "out" || p.mode === "in" && p.inT < 200) { // the battle sprite, grown in like GEN 1: small, then full size
            const im = a.images.pikachu, w = im.naturalWidth, h = im.naturalHeight, k = p.t < 120 ? 1 : 2;
            if (w) ctx.drawImage(im, -w * k / 2, h - h * k, w * k, h * k); return;
          }
          const im = a.images.pikachuWalk, f = p.charging > 0 ? (Math.floor(p.t / 60) % 2 ? 0 : 3) : p.mode === "run" && p.y >= FLOOR && Math.floor(p.t / 130) % 2 ? 5 : 2; // charging: faces you, buzzing
          if (!im.naturalWidth) return;
          if (p.dir > 0) ctx.scale(-1, 1);
          ctx.drawImage(im, 0, f * 16, 16, 16, -HALF, -HALF, 16 * K, 16 * K);
        } };
      // Thunder: obj_bonestab's warning, a red outline of the strike's column that stays up until it lands (PB.warn), then a strike of
      // stacked bolts from the box top to the floor (a zigzag: every other bolt mirrored). Step out of the column before it lands
      const thunder = () => {
        const x = Math.max(box.left + 10, Math.min(box.right - 10, a.soul.x)); let t = 0; a.sfx.charge();
        a.bullet({ x, y: (box.top + box.bottom) / 2, w: 2, h: box.height, damage: 0,
          update(w, dt) { w.tell = true; w.w = 16; if ((t += dt) < PB.warn) return; w.dead = true; strike(x); }, // tell: the strike's column
          draw(ctx, w) { ctx.strokeStyle = "#f00"; ctx.lineWidth = 1; ctx.strokeRect(-7.5, -w.h / 2 + 2.5, 15, w.h - 5); } }); // the strike's exact width
      };
      const strike = x => { let t = 0; a.sfx.beam();
        a.bullet({ x, y: (box.top + box.bottom) / 2, w: 16, h: box.height, damage: 4,
          update(b, dt) { if ((t += dt) > 260) b.dead = true; },
          draw(ctx, b) { const im = a.images.bolt; if (!im.naturalWidth) return; ctx.globalAlpha = t > 180 ? 1 - (t - 180) / 80 : 1;
            for (let y = -b.h / 2, i = 0; y < b.h / 2; y += 22, i++) { ctx.save(); if (i % 2) ctx.scale(-1, 1); ctx.drawImage(im, -8, y, 16, 22); ctx.restore(); } } });
      };
      const shoot = p => zap(p.x, p.y, a.soul.x, a.soul.y, PB.bolt); // at the heart
      // the summon: thrown next to Galaxi, pops open with a flash, out comes Pikachu
      a.bullet({ ...arc(HAND.x - 20, HAND.y - 20, PIKA.x, PIKA.y - 10, 600), w: 22, h: 22, damage: 0, clip: false, spin: .2, t: 0, draw: look(0),
        update(b, dt) {
          fall(b, dt); if ((b.t += dt) < 600) return;
          b.dead = true; pop(b.x, b.y); a.sfx.charge();
          for (let i = 0; i < 10; i++) { const ang = i / 10 * Math.PI * 2;
            a.bullet({ x: b.x, y: b.y, vx: Math.cos(ang) * 3, vy: Math.sin(ang) * 3, w: 4, h: 4, color: "#fff", damage: 0, clip: false, t: 0, update(f, dt) { if ((f.t += dt) > 250) f.dead = true; } }); }
          a.bullet(pikachu);
        } });
    },
    // Lorem ipsum, the meta one (a sneak turn: no speech bubble, no box resize). It starts by pretending Galaxi skipped his turn: the
    // menu is back, your SOUL on your button, a flavor line typing out. Then Galaxi takes over the narrator's box himself ("I'm gonna
    // try something new", in his own voice blip), reaches down, yanks your SOUL off the button into his hand and throws it into the
    // still full-size dialogue box. Then he just talks: lines of lorem ipsum typed like normal dialogue scroll up past you, an attack
    // like Sans's bones made of text: white hurts, and the blue words make a winding safe path to follow (see 4).
    lorem(a) {
      const B = a.box, VOICE = "assets/egg/voice/galaxi-blip.mp3", NARRATOR = "assets/egg/sfx/txt1.mp3";
      const FAKE = any(["* Galaxi is lost in thought.", "* Galaxi is thinking really hard.", "* Galaxi is staring into space."]), NEW = any(["I'm gonna try something new.", "Let me try something.", "Wait. New idea."]); // NEW is his speech bubble // Claude placeholders for Galaxi to reword
      const HAND = { x: 373, y: 148 }; // his raised hand on the sprite (pixel 61, 44 at 2x)
      const CW = 16; // the box text is UNDERTALE's fnt_main, written 16px a letter (a.mainText)
      // 1. the fake menu, then 2. Galaxi hijacking the text box. Typed like the real box text (32px, 33ms a letter, a sound every 2nd)
      a.soul.hide = true; a.menuLook(true);
      let boxText = null; // { text, n, t, sound }
      const type = (text, sound) => boxText = { text, n: 0, t: 0, sound };
      a.bullet({ x: 0, y: 0, w: 1, h: 1, damage: 0, clip: false,
        update(b, dt) { const o = boxText; if (!o || o.n >= o.text.length) return;
          o.t += dt; while (o.t > 33 && o.n < o.text.length) { o.t -= 33; o.n++; if (o.text[o.n - 1] !== " " && o.n % 2) o.sound === VOICE ? a.speak() : a.play(o.sound); } },
        draw() { if (boxText) a.mainText(boxText.text.slice(0, boxText.n), 52, 270); } }); // where the real flavor line goes
      type(FAKE, NARRATOR);
      a.after(2200, () => { boxText = null; a.say(NEW, 1600); });

      // 3. the summon: off the button into his hand (grab), a moment there, then thrown into the box (swing) as he starts talking
      const heart = a.bullet({ x: 0, y: 0, w: 1, h: 1, damage: 0, clip: false, z: 3, t: 0, phase: "wait",
        update(h, dt) {
          if (h.phase === "wait") return;
          h.t += dt; const e = k => 1 - (1 - Math.min(1, k)) ** 3; // ease-out
          if (h.phase === "pull") { const k = e(h.t / 380); h.x = h.from.x + (HAND.x - h.from.x) * k; h.y = h.from.y + (HAND.y - h.from.y) * k; if (h.t > 900) { h.phase = "throw"; h.t = 0; a.sfx.swing(); boxText = null; talk(); } }
          else if (h.phase === "throw") { const k = Math.min(1, h.t / 420); h.x = HAND.x + (320 - HAND.x) * k; h.y = HAND.y + (300 - HAND.y) * k - Math.sin(k * Math.PI) * 50; // a little arc
            if (k >= 1) { h.dead = true; a.soul.x = 320; a.soul.y = 300; a.soul.hide = false; playing = true; } }
          if (h.phase === "pull" && h.t > 380) { h.x = HAND.x + Math.round(Math.sin(h.t / 40)); h.y = HAND.y; } // held, struggling a little
        },
        draw(ctx, h) { if (h.phase !== "wait") a.heart(0, 0); } }); // (a.bullet copies, so keep what it returns)
      a.after(2200 + NEW.length * 33 + 450, () => { a.menuLook(false); Object.assign(heart, { phase: "pull", t: 0, from: a.menuHeart }); heart.x = heart.from.x; heart.y = heart.from.y; a.play("assets/egg/sfx/grab.mp3"); });

      // 4. the talking. Every line is printed like normal dialogue (same font, his blip on every other letter, typed with his own uneven rhythm) in the box's
      // bottom row, then scrolls up past you. Lines are filled edge to edge and stack with no space between them: white text hurts,
      // and the blue word or two on each line is safe. Each line's blue overlaps the one before it, so the blue makes one winding
      // path up through the text: keep your SOUL on it as everything scrolls by. Your SOUL can't go into the typing row.
      let playing = false;
      const BLUE = "#14a9ff", ROWH = 34, TYPE = 16, { rise: RISE, talk: TALK, overlap: OVERLAP, shift: SHIFT, minW: MINW } = LOREM; // UNDERTALE's blue, line height, ms per letter; the rest from LOREM (above GALAXI_BOSS)
      const N = Math.floor(530 / CW), LEFT = 52, FLOOR = B.bottom - ROWH - 5; // letters per line (the box's 530px wrap), where text starts, the SOUL's lowest point
      const BY_LEN = {}; "ut et ad in sed sit non amet elit enim quis lorem ipsum dolor magna culpa tempor labore dolore veniam aliqua nostrud eiusmod commodo ullamco laboris pariatur occaecat proident deserunt consequat voluptate excepteur cupidatat adipiscing incididunt consectetur amet, elit. sed, lorem, dolor. magna, aliqua. tempor, enim. quis, ipsum.".split(" ").forEach(w => (BY_LEN[w.length] ||= []).push(w));
      const pick = n => { const l = BY_LEN[n]; return l[Math.floor(a.random(0, l.length))]; };
      const fill = n => { const out = []; // words that add up to exactly n letters with their spaces
        while (n > 0) { if (n <= 11 && BY_LEN[n]) { out.push(pick(n)); break; } const w = pick(2 + Math.floor(a.random(0, Math.min(9, n - 4)))); out.push(w); n -= w.length + 1; }
        return out; };
      const px = c => LEFT + c * CW; // a letter's left edge
      let step = 0, path = { l: 320 - 30, r: 320 + 30 }, first = true, sentence = true; // sentence: the next line starts a new sentence // the last line's blue span (px); the path starts where the SOUL lands
      const line = () => { // N letters of lorem; the blue run: the word under the path's next point, widened until it overlaps the last line's
        const words = fill(first ? N - 2 : N), at = []; let c = first ? 2 : 0; for (const w of words) { at.push(c); c += w.length + 1; }
        const mid = Math.max(px(3), Math.min(px(N - 3), (path.l + path.r) / 2 + SHIFT * LOREM.steps[step++ % LOREM.steps.length])); // the path snakes by LOREM.steps
        let k0 = words.findIndex((w, k) => px(at[k] + w.length) + CW / 2 >= mid); if (k0 < 0) k0 = words.length - 1; let k1 = k0;
        const span = () => ({ l: px(at[k0]), r: px(at[k1] + words[k1].length) }), ov = sp => Math.min(sp.r, path.r) - Math.max(sp.l, path.l);
        while ((ov(span()) < OVERLAP || span().r - span().l < MINW) && (k0 > 0 || k1 < words.length - 1)) { // grow toward the old path
          const sp = span(); if (k0 > 0 && (sp.l > path.l || k1 === words.length - 1)) k0--; else k1++; }
        path = span();
        let text = first ? "* " : "", blue = first ? [false, false] : []; first = false;
        words.forEach((w, k) => { if (k) { text += " "; blue.push(k > k0 && k <= k1); } text += w; for (const _ of w) blue.push(k >= k0 && k <= k1); });
        text = text.replace(/\. ([a-z])/g, (_, c) => ". " + c.toUpperCase()); if (sentence) text = text.replace(/^(\* )?([a-z])/, (_, s, c) => (s || "") + c.toUpperCase()); // one running paragraph: capitals only after a full stop
        sentence = text.endsWith(".");
        // his rhythm, so it doesn't sound robotic: each letter a bit faster or slower, sometimes a beat between words or a hesitation
        // mid-word, a proper stop after commas and full stops; then the whole line is squeezed to finish in the typing row
        const delays = [...text].map((ch, c) => { const prev = text[c - 1];
          return TYPE * a.random(.6, 1.4) + (prev === "," ? 110 : prev === "." ? 200 : prev === " " && a.random(0, 1) < .25 ? 60 : /\w/.test(ch) && a.random(0, 1) < .06 ? 90 : 0); });
        const budget = ROWH / RISE * 16.7 * .9, sum = delays.reduce((t, d) => t + d, 0);
        return { text, blue, delays: sum > budget ? delays.map(d => d * budget / sum) : delays };
      };
      const lines = [];
      const talk = () => {
        const send = () => { const { text, blue, delays } = line();
          lines.push(a.bullet({ x: 320, y: B.bottom - ROWH / 2, vy: -RISE, w: 1, h: 1, damage: 0, n: 0, tt: 0, text, blue,
            update(l, dt) { if (l.y < B.top - ROWH) l.dead = true;
              if (l.n < N) { l.tt += dt; while (l.n < N && l.tt > delays[l.n]) { l.tt -= delays[l.n]; l.n++; if (/\w/.test(text[l.n - 1]) && l.n % 2) a.speak(); } } },
            draw(ctx, l) { ctx.translate(0, Math.round(l.y) - l.y);
              for (let c = 0; c < l.n; c++) if (text[c] !== " ") a.mainText(text[c], px(c) - 320, -13, blue[c] ? BLUE : "#fff"); } })); }; // a letter's 26px cell centred on the row: the letters sit centred in their row
        for (let t = 0; t < TALK; t += ROWH / RISE * 16.7) a.after(t, send);
        a.bullet({ x: 0, y: 0, w: 1, h: 1, damage: 0, draw() {}, t: 0, update(b, dt) { if ((b.t += dt) > TALK && !lines.some(l => !l.dead)) { b.dead = true; a.after(200, () => a.end()); } } });
      };

      // the hurting: an invisible bullet sits on the SOUL whenever its hitbox (the engine's: 4px each way) touches a typed white letter
      // (or a space between white words; the first and last letters stretch to the box's sides), so the engine deals the damage with
      // its usual flashing i-frames. The SOUL is also kept out of the typing row
      const sting = a.bullet({ x: -100, y: -100, w: 2, h: 2, draw() {}, // parked off-screen (not past -200, where the engine deletes bullets)
        update(s) {
          if (!playing) { if (heart.phase !== "wait") { a.soul.x = heart.x; a.soul.y = heart.y; } return; } // the real SOUL rides along until it lands
          a.soul.y = Math.min(FLOOR, a.soul.y); s.x = s.y = -100;
          const x = a.soul.x, y = a.soul.y, colL = c => c ? px(c) : B.left, colR = c => c < N - 1 ? px(c + 1) : B.right;
          for (const l of lines) { if (l.dead || y + 4 <= l.y - ROWH / 2 || y - 4 >= l.y + ROWH / 2) continue;
            for (let c = 0; c < l.n; c++) if (x + 4 > colL(c) && x - 4 < colR(c) && !l.blue[c]) { s.x = x; s.y = y; return; } }
        } });
    },
    // The World: DIO's time stop from JOJO'S BIZARRE ADVENTURE, in two loops (TW, above GALAXI_BOSS):
    //   1. Time stops ("The World!" is a go: line, so it lands as it's said): a negative sphere swells out of Galaxi and back, the music
    //      winds down and freezes, and so does the heart (push against it and it shakes a pixel with a quiet tick). Galaxi's knives click
    //      into a ring round it, one gap left as the exit. Time moves: the ring closes and turns like Undyne the Undying's spear ring, so
    //      the gap comes round; get out through it. Then 4 fans of knives at the heart (odd fans aim at you, even ones leave you a gap).
    //   2. Time stops again and the frozen heart is Undyne's green SOUL: knives are laid out on the 4 sides in stopped time, and when time
    //      moves they come in and the shield has to meet each one (yellow ones swing round and come from the other side).
    theworld(a) {
      const TIMESTOP = "assets/egg/sfx/timestop.mp3"; // the anime's time stop sound (levelled)
      const STOP = 1900; // how long time stays stopped. Each loop's ring and volleys come from TW (above GALAXI_BOSS, designed by hand)
      const draw = ctx => { const im = a.images.knife; if (im && im.naturalWidth) ctx.drawImage(im, -5, -12, 10, 24); }; // assets/egg/theworld/knife.png at 2x, centred on the hitbox
      const knife = (x, y, ang, speed, o) => a.bullet({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, rot: ang + Math.PI / 2, w: 6, h: 18, draw, ...o });
      // the anime's time stop (timeStopFx, above GALAXI_BOSS), drawn over everything but the heart (z: 1; the heart is drawn after it, so it stays red)
      const look = timeStopFx();
      const timeFx = () => { let t = 0, back = 0; // back: ms since time started moving again
        return a.bullet({ x: 0, y: 0, w: 1, h: 1, damage: 0, clip: false, z: 1, resume() { back = 1; },
          update(b, dt) { t += dt; if (back && (back += dt) > 300) b.dead = true; },
          draw(ctx) { look(ctx, t, back); } }); };
      const wait = ms => new Promise(go => a.after(ms, go));
      const clear = async () => { while (a.bullets().some(b => b.knife)) await wait(50); }; // until every knife has left the box
      const out = (b, m = 20) => { const B = a.box; return b.x < B.left - m || b.x > B.right + m || b.y < B.top - m || b.y > B.bottom + m; };
      const stop = async L => { const R = L.r, SLOTS = L.slots, STEP = Math.PI * 2 / SLOTS;
        a.play(TIMESTOP); a.musicRate(0, 400);
        const fx = timeFx(), cx = a.soul.x, cy = a.soul.y, B = a.box, mx = (B.left + B.right) / 2, my = (B.top + B.bottom) / 2;
        // the heart is frozen: held in place every frame. Pushing a direction shakes it 1px and ticks quietly (every 350ms while held)
        let tick = 0;
        const hold = a.bullet({ x: 0, y: 0, w: 1, h: 1, damage: 0, clip: false, draw() {},
          update(b, dt) { const push = a.steering(); tick = push ? tick - dt : 0;
            if (push && tick <= 0) { tick = 350; a.play(a.sfx.files.squeak, .25, .6); }
            b.t = (b.t || 0) + dt; a.soul.x = cx + (push ? Math.round(Math.sin(b.t / 30)) : 0); a.soul.y = cy; } }); // (game time, so a seeded sim replays exactly)
        const open = Math.hypot(mx - cx, my - cy) > 10 ? Math.atan2(my - cy, mx - cx) : 0; // never an exit into a wall; from the middle, left or right
        // the ring closes like Undyne the Undying's spear ring (obj_rotspeargen): every frame it shrinks L.shrink px and turns L.spin degrees,
        // the knives held in formation, so the exit comes round as it closes
        const ring = [], rs = { r: R, off: 0, moving: false, acc: 0 }, turn = L.spin * Math.PI / 180;
        a.bullet({ x: 0, y: 0, w: 1, h: 1, damage: 0, clip: false, draw() {}, update(b, dt) { if (!rs.moving) return;
          for (rs.acc += dt; rs.acc >= F; rs.acc -= F) { rs.r -= L.shrink; rs.off += turn; } if (rs.r < 8) b.dead = true; } });
        for (let i = 1; i < SLOTS; i++) { // slot 0 is the exit
          await wait(i === 1 ? 300 : 100);
          const phi = open + STEP * i; a.sfx.move();
          ring.push(knife(cx + Math.cos(phi) * R, cy + Math.sin(phi) * R, phi + Math.PI, 0, { knife: true, damage: 3,
            update(b, dt) {
              if (b.falling) { b.vy += .25 * dt / 16.7; if (b.y > a.box.bottom + 20) b.dead = true; return; } // tumbling down out of the box
              if (!rs.moving) return; const th = phi + rs.off;
              if (rs.r >= 8) { b.x = cx + Math.cos(th) * rs.r; b.y = cy + Math.sin(th) * rs.r; b.rot = th + Math.PI + Math.PI / 2; return; }
              // the tips meet in the middle: clank (once per ring), knocked back a little, then they fall spinning
              if (!ring.clanked) { ring.clanked = true; a.play(a.sfx.files.break1, .6, 1.8); }
              Object.assign(b, { falling: true, damage: 0, vx: Math.cos(th) * a.random(.6, 1.6) + a.random(-.5, .5), vy: -a.random(1.5, 3), spin: a.random(-.35, .35) });
            } }));
        }
        await wait(Math.max(0, STOP - 300 - (SLOTS - 2) * 100));
        hold.dead = true; a.soul.x = cx; fx.resume(); a.musicRate(1, 300); a.sfx.swing();
        rs.moving = true;
      };
      // Loop 2: time stops and the frozen heart becomes Undyne's green SOUL (obj_spearblocker): Galaxi lays knives out on the four sides in
      // stopped time (one click each), each as far out as it is late; when time moves they all fly in at L.speed px a frame and the shield
      // has to meet them. A yellow knife is Undyne's reverse spear: it stops 90px out, swings round the heart and comes in from the other side
      const shield = async L => {
        a.play(TIMESTOP); a.musicRate(0, 400); const fx = timeFx();
        a.resize(80, 80); a.soul.setMode("green", { dir: 90 }); const cx = a.soul.x, cy = a.soul.y, V = L.speed, SIDE = { L: Math.PI, R: 0, U: -Math.PI / 2, D: Math.PI / 2 };
        let at = 0, moving = false; const ks = [];
        for (const k of L.knives) { at += k.dt; const th0 = SIDE[k.s], d0 = 42 + V * at; await wait(110); a.sfx.move();
          let th = th0, d = d0, swing = 0;
          ks.push(knife(cx + Math.cos(th) * d, cy + Math.sin(th) * d, th + Math.PI, 0, { knife: true, block: true, damage: 3, clip: false, rev: k.r, acc: 0,
            update(b, dt) { if (!moving) return;
              for (b.acc += dt; b.acc >= F; b.acc -= F) {
                if (swing > 0) { th += Math.PI / 10 * (k.r === "ccw" ? -1 : 1); if (--swing === 0) b.rev = false; } // 10 frames round the heart
                else { d -= V; if (b.rev && d <= 90) { d = 90; swing = 10; } } }
              b.x = cx + Math.cos(th) * d; b.y = cy + Math.sin(th) * d; b.rot = th + Math.PI + Math.PI / 2; if (d < 4) b.dead = true; },
            draw(ctx, b) { const im = b.rev ? yellow() : a.images.knife; if (im && (im.naturalWidth || im.width)) ctx.drawImage(im, -5, -12, 10, 24); } }));
        }
        await wait(500); fx.resume(); a.musicRate(1, 300); a.sfx.swing(); moving = true;
        while (ks.some(b => !b.dead)) await wait(50);
        await wait(300); a.soul.setMode("red");
      };
      let yk = null; const yellow = () => { const im = a.images.knife; if (yk || !im.naturalWidth) return yk || im; // the knife in Undyne's reverse-spear yellow
        yk = document.createElement("canvas"); yk.width = im.naturalWidth; yk.height = im.naturalHeight; const g = yk.getContext("2d"); g.drawImage(im, 0, 0);
        g.globalCompositeOperation = "multiply"; g.fillStyle = "#ff0"; g.fillRect(0, 0, yk.width, yk.height); g.globalCompositeOperation = "destination-in"; g.drawImage(im, 0, 0); return yk; };
      const volley = v => { const x = 320, y = a.box.top - 12, ang = Math.atan2(a.soul.y - y, a.soul.x - x), n = v.n || 3; a.sfx.swing(); // from Galaxi, aimed at the heart: n knives fanned spread apart
        for (let k = 0; k < n; k++) knife(x, y, ang + (k - (n - 1) / 2) * (v.spread || .28), v.speed || 4, { knife: true, update(b) { if (b.y > a.box.top && out(b)) b.dead = true; } }); };
      (async () => {
        for (const L of TW.loops) {
          if (L.knives) { await shield(L); continue; }
          await stop(L); await clear();
          for (const v of L.volleys) { await wait(v.dt); volley(v); }
          await wait(650); await clear();
        }
        await wait(300); a.end();
      })();
    },
    // ---- Sans's moves (UNDERTALE), made of Galaxi's stars. Shared bits (starPx, starBlaster) are above GALAXI_BOSS. ----
    // Ray of Death: star blasters, Sans's Gaster Blasters. Complimented him on the menu before? Toned down: everything 20% slower. Each one flies in spinning, shows a faint aim line while it charges, then
    // fires a beam across the screen. Singles aimed at you, a pair, a cross, a quick run of singles, then a cage of 4 (stand still).
    blasters(a) { // plays RAY.moves (above GALAXI_BOSS: the moves, and the script tools/train-attacks.js evolves)
      const nice = a.foe().last === "Compliment", P = nice ? .8 : 1; // complimented: everything 20% slower
      let t = 0;
      for (const m of RAY.moves) { t += m.dt / P; a.after(t, () => { for (const b of rayMoves(m, a.box, a.soul, () => a.random(0, 1))) a.after(b.delay / P, () => starBlaster(a, b.x, b.y, b.ang, { pace: P, width: b.width, charge: b.charge / P, k: b.k })); }); }
      a.after(t + RAY.END / P, () => a.end());
    },
    // Kablooey: the finale, played from KAB (above GALAXI_BOSS, designed by hand). A spiral of 8 star blasters round
    // the box firing one after another through the middle, 3 star bombs that swell up where you are and burst into rings of little stars,
    // fans from the top and bottom, the cage, the spiral backwards, then two big blasters.
    kablooey(a) {
      let t = 0;
      for (const m of KAB.moves) { t += m.dt; a.after(t, () => {
        if (m.kind === "bomb") for (let i = 0; i < (m.n || 1); i++) a.after(i * (m.every || 1000), () => starBurst(a, a.soul.x, a.soul.y, { speed: m.speed || 3 }));
        else for (const b of rayMoves(m, a.box, a.soul, () => a.random(0, 1))) a.after(b.delay, () => starBlaster(a, b.x, b.y, b.ang, { width: b.width, charge: b.charge, k: b.k })); }); }
      a.after(t + KAB.END, () => a.end());
    },
  },

  // onWin: his last words, then { dust: true } turns him to dust like an UNDERTALE monster (he's gone after it), then the box lines
  // (foe.flags.warp: beaten by the Mario warp secret: he's done his screaming, so no "Good grief.", and the narrator gets scared too: WARP_END, above GALAXI_BOSS)
  onWin: foe => [...(foe.flags.warp ? [] : [{ text: "Good grief.", sound: V.goodgrief, bubble: true }]), ...(foe.flags.nice ? [one("* Galaxi feels kind of betrayed.", "* Galaxi did NOT see that coming.")] : []), { text: "Thanks for watching!", sound: V.thanksforwatching, bubble: true }, { dust: true }, "* YOU WON!", ...(foe.flags.warp ? WARP_END : ["* You earned 0 EXP and killed Galaxi.", "* He's gone.", "* ...Forever."])],
  onSpare: foe => [{ text: "This boss thing is fun!", sound: V.thidbossthingisfun, bubble: true }, "* YOU WON!", one("* You spared Galaxi.", "* You and Galaxi are friends now. Probably."), { text: "Thanks for watching!", sound: V.thanksforwatching, bubble: true }],
  notSpareable: { text: "You're joking, right?", sound: V.yourejokingright, bubble: true },
  onFlee: { text: "You're kidding!", sound: V.yourekidding, bubble: true },
  onDeath: "Eventuality!",
  onDeathSound: V.eventuality,
};
