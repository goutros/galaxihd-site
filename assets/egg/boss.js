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
          soul:   "blue" for Undertale's gravity SOUL (Up jumps, it lands on solid bullets, falling out of the box hurts)
      - Start every box line with "* " like Undertale does. Keep lines short: about 40 letters fits on one line.

   2. ACTS (the ACT menu)
      Each act has a name and a run function that returns the lines to show. foe.flags remembers anything
      you like between turns (e.g. foe.flags.subscribed = true). Compliment counts foe.flags.nice: the attack right
      after a Compliment does half damage, and after the one that follows the concede.at-th Compliment, Galaxi says
      concede.say, the menu shows concede.flavor with SPARE yellow (the only way to spare him; spareAt is Infinity),
      and picking Spare plays concede.spared, then onSpare.

   3. ITEMS: name, how much HP it heals, optional verb ("drank"; default "ate") and optional extra lines.

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

// ---- shared by the Sans-style turns (5-8) ----
// Galaxi's star (the shape of assets/star-l.png, solid) drawn in code at a whole-number scale k, centred on (ox, oy)
const STAR7 = ["0001000", "0001000", "0011100", "1111111", "0011100", "0001000", "0001000"], STAR3 = ["010", "111", "010"];
const starPx = (ctx, rows, k, color = "#fff", ox = 0, oy = 0) => { const n = rows.length; ctx.fillStyle = color;
  rows.forEach((r, j) => [...r].forEach((c, i) => c === "1" && ctx.fillRect(ox + (i - n / 2) * k, oy + (j - n / 2) * k, k, k))); };
// FFXIV-style telegraph: a warning flashes in (60ms) and fades out (300ms), long before the hit lands, so you have to remember where it was
const TELL = t => t < 0 ? 0 : t < 60 ? t / 60 : Math.max(0, 1 - (t - 60) / 300);
const SANS_SFX = Object.fromEntries([["impact", "impact"], ["flash", "eyeflash"]].map(([k, f]) => [k, `assets/egg/sfx/${f}.mp3`])); // UNDERTALE's
// a star blaster (Sans's Gaster Blaster, one of Galaxi's stars), fired like the Mario turn's star avalanche: it flies in spinning to (x, y)
// and its lane along ang flashes up as the warning and fades (TELL), then it swells and blasts a packed stream of spinning stars down the lane
// (beam sound). Same fair rule as Mario: a stream star only hurts while the heart's middle is inside the lane. The blaster drifts
// back out once it's done. o: k (star scale), width (lane px), charge (ms), damage
function starBlaster(a, x, y, ang, o = {}) {
  const { pace = 1, k = 5, width = 26, charge = 550 / pace, damage = 3 } = o, dx = Math.cos(ang), dy = Math.sin(ang), IN = 300 / pace, FIRE = IN + charge, STREAM = 400, TRAIL = 900 / pace; // pace: .8 = everything 20% slower
  const inLane = () => Math.abs((a.soul.x - x) * -dy + (a.soul.y - y) * dx) <= width / 2 && (a.soul.x - x) * dx + (a.soul.y - y) * dy > 0;
  const star = () => { const n = Math.max(1, Math.round(width / 13)); // one star per lane slice, every frame
    for (let j = 0; j < n; j++) { const big = Math.random() < .3, h = big ? 21 : 15, room = Math.max(0, width / 2 - h / 2), off = Math.max(-room, Math.min(room, (j + Math.random()) / n * width - width / 2)), sp = a.random(6, 10) * pace, back = a.random(0, 30);
      a.bullet({ x: x - dy * off + dx * back, y: y + dx * off + dy * back, vx: dx * sp, vy: dy * sp, w: h, h, image: big ? "bigstar" : "star",
        spin: (Math.random() < .5 ? -1 : 1) * a.random(.2, .4), damage, update: b => b.damage = inLane() ? damage : 0 }); } };
  let t = 0;
  a.bullet({ x: x + dx * 300, y: y + dy * 300, w: 1200, h: width, rot: ang, damage: 0, z: -1, // the lane (centred 300px out so the off-screen cull never eats it)
    update(b, dt) { if ((t += dt) > FIRE + STREAM + TRAIL + 300) b.dead = true; },
    draw(ctx) { const v = TELL(t - IN); if (!v) return; // the lane flashes as the blaster arrives, then it's gone
      ctx.fillStyle = `rgba(255,255,255,${.25 * v})`; ctx.fillRect(-300, -width / 2, 1200, width); } });
  a.bullet({ x: x - dx * 90, y: y - dy * 90, w: 1, h: 1, damage: 0, clip: false, z: 2, line: { x, y, ang, width }, // line: where it fires (handy for test bots)
    update(b, dt) {
      if (t < IN) { const e = 1 - (1 - t / IN) ** 3; b.x = x - dx * 90 * (1 - e); b.y = y - dy * 90 * (1 - e); b.rot = (1 - e) * Math.PI * 2 * (dx < 0 ? -1 : 1); return; } // eases in, spinning
      b.rot = 0; if (t - dt < IN) a.sfx.charge();
      if (t >= FIRE && t - dt < FIRE) { a.sfx.beam(); for (let f = 0; f < STREAM; f += 16) a.after(f, star); }
      if (t > FIRE + STREAM) { const s = (t - FIRE - STREAM) / 16.7 * .25; b.x -= dx * s; b.y -= dy * s; if (t > FIRE + STREAM + 1200) b.dead = true; } }, // recoils back out once it's done
    draw(ctx) { const kick = t >= FIRE && t < FIRE + STREAM ? Math.round(Math.sin(t / 25)) * 2 : 0, im = a.images.starBlaster; // shudders while blasting
      const s = Math.max(2, Math.round(k * .6)) + (t > FIRE - 120 && t < FIRE + STREAM ? 1 : 0); // whole-number scale (crisp), +1 as it swells just before firing
      if (!im.naturalWidth) return starPx(ctx, STAR7, s + 2, "#fff", kick, 0); // (the old drawn star if the sprite hasn't loaded)
      ctx.rotate(ang - Math.PI / 2); ctx.drawImage(im, kick - 7 * s, -9.5 * s, 14 * s, 13 * s); } }); // Galaxi's star blaster: its jaw (the sprite's bottom) faces the lane and sits where the beam starts
}

const any = list => list[Math.floor(Math.random() * list.length)]; // one at random
const nth = (foe, pick, list) => { const i = (foe.uses[pick] || 1) - 1; return i < list.length ? list[i] : any(list.length > 1 ? list.slice(1) : list); }; // by how many times you've picked it this fight

window.GALAXI_BOSS = {
  name: "Galaxi",
  sprite: "assets/egg/galaxi-idle.png",
  spriteScale: 2,        // whole numbers only, keeps the pixel art crisp
  images: { star: "assets/star-m.png", bigstar: "assets/star-l.png",
    starBlaster: "assets/egg/stars/blaster.png", starBomb: "assets/egg/stars/bomb.png", starBombBit: "assets/egg/stars/bomb-projectile.png", // Galaxi's sprites, white, 14x13 / 9x9 / 3x3
    mterrain: "assets/egg/mario/terrain.png", msprites: "assets/egg/mario/sprites.png",
    // all POKEMON YELLOW: Poke Ball and walking Pikachu from the pret/pokeyellow disassembly, front sprite from PokeAPI/sprites
    // (both on GitHub), turned white with the outline, cheeks and the ball's light half cut out; bolt: Galaxi's own electric sprite
    pokeball: "assets/egg/pokemon/pokeball.png", pikachu: "assets/egg/pokemon/pikachu.png", pikachuWalk: "assets/egg/pokemon/pikachu-walk.png", bolt: "assets/egg/pokemon/electric.png",
    // all SONIC THE HEDGEHOG (Mega Drive): rendered from the uncompressed art, mappings, layout and palettes in the Sonic 1 rebuild
    // github.com/cvghivebrain/Sonic1sq, turned white with the darker shades cut out. ghzground: Green Hill act 1's grass, seamless 256px; bridge: one of its bridge logs
    ...Object.fromEntries(["motobug", "crabmeat", "spikes", "rock", "rings", "ghzground", "bridge"].map(n => [n, `assets/egg/sonic/${n}.png`])) },
  sounds: [...Object.values(V), ...["timestop", "pullback", "speedup", "sparkle1", "grab"].map(n => `assets/egg/sfx/${n}.mp3`), ...Object.values(SANS_SFX)],
  hp: 160,               // Galaxi's HP
  damage: 2,             // HP you lose per hit (each bullet can override with its own damage)
  playerAttack: 22,      // roughly how hard you hit on a perfect FIGHT
  spareRush: 1.5,        // tried to Spare too early: Galaxi's next attack runs this much faster (the music doesn't)
  spareAt: Infinity,     // SPARE never turns yellow on its own: the only spare is Galaxi giving up (concede)
  concede: { at: 4, say: ["You're no fun!", "Why- WHY are you so NICE all the time?", "Just... Just go! I quit!", "Do you... do you wanna be my friend?", "...", "... No?", "...", "... Okay..."], flavor: "* Galaxi is embarrassed.",
    spared: ["...", "...", { text: "OKAY!", shake: true }, "I yield.", "Jeez."] }, // say: after the attack that follows your 4th Compliment, then the menu (flavor) with SPARE yellow; spared: his lines when you pick Spare, then onSpare
  voice: "assets/egg/voice/galaxi-blip.mp3", // Galaxi's talking blip: one 60ms cut of his voice (from the "I'd heal you" line), Sans-style, for any line without a recording
  narrator: "assets/egg/sfx/txt1.mp3", // the "* ..." box text sound (UNDERTALE's own)
  music: "assets/egg/music/tv-world.mp3", // battle music (loops); credit is in the page footers
  musicVolume: .35,      // 0 to 1, keep it under the voice lines
  // Galaxi's recordings are mastered loud (about -12 dB average, peaks at 0) next to the sfx (-15 to -25 dB), so they're turned down to sit with them
  voiceVolume: .35,      // his recorded voice lines ("Go, Pikachu!" etc.), 0 to 1
  blipVolume: .25,       // his talking blip on every other letter (the narrator's own typing sound is much quieter to begin with)

  // the speech-bubble lines use Galaxi's recordings; the "* ..." flavor/box lines are Claude placeholders to rewrite
  opening: { box: "* Galaxi notices you found his easter egg.", say: replay => ["So, you found me huh?", "I'm Galaxi, the REAL Galaxi, and I've gone what you'd call TURBO.", replay ? "Pikachu wanted a rematch." : "Wanna see what I can do?"], // replay: R on the death screen
    after: "* Galaxi is waiting for you to mention how cool that just was." },
  // All dialogue approved by Galaxi (2026-10-09); some lines were first drafted by Claude in his style
  turns: [
    { say: [{ text: "Go, Pikachu!", sound: V.gopikachu, go: true }], attack: "pokeball", box: [230, 150], time: 9500,
      flavor: foe => foe.loop ? ["* Pikachu looks tired too.", "* Galaxi is recycling content."] : "* You actually do think that was pretty cool." },
    { before: foe => foe.last === "Compliment" ? ["Don't think because you're so nice I'll go easy on you!"] : null, // (he does: the toned-down blasters)
      otherwise: ["Huh, not gonna say anything?", "That was pretty rude of you."], // a pick with no react lines (e.g. Ask for mods)
      say: [{ text: "Ray of Death.", sound: V.rayofdeath }], attack: "blasters", box: [240, 170], time: 11000, // ends itself (a.end)
      flavor: ["* Galaxi's eyes are glowing.", "* Galaxi blows on his finger like it's a smoking gun.", "* Galaxi is pretending he isn't out of breath."] },
    { say: [{ text: "Gotta go fast!", sound: V.gottagofast }], flavor: "* You can't figure out why but you suddenly feel... faster.", attack: "sonic", box: [300, 110], time: 12000,
      otherwise: ["You know what this fight needs?", "Speed."] },
    { sneak: true, attack: "lorem", box: [575, 135], time: 25000, // the meta turn: pretends to skip, then ends itself (a.end)
      flavor: ["* Galaxi won't stop talking.", "* Galaxi forgot what he was saying.", "* Your ears are still ringing from all the typing."] },
    { say: [{ text: "I have so many voice lines.", sound: V.ihavesomanyvoicelines }, { text: "Kablooey!", sound: V.jebluey }], attack: "kablooey", box: [240, 170], time: 25000, // ends itself (a.end)
      flavor: ["* Galaxi is having fun.", "* Galaxi is very proud of that one.", "* Galaxi checks if you looked impressed."],
      otherwise: ["Okay, big one coming.", "I've been saving this."] },
    { say: [{ text: "JoJo no Kimyou na Bouken!", sound: V.jojonokiminionaboken }, { text: "The World!", sound: V.theworld, go: true }], attack: "theworld", box: [260, 170], time: 20000, // ends itself (a.end) after 2 loops, ~11s,
      flavor: ["* Time feels weird.", "* Galaxi is still doing the pose.", "* You're pretty sure you lost a few seconds."],
      otherwise: ["Have you ever watched JoJo?", "Doesn't matter. You're about to."] },
    { say: [{ text: "It's a me!", sound: V.itsame }], attack: "mario", soul: "mario", box: [320, 160], time: 17500, // 4 avalanches of 3.8s, 3.9s apart
      flavor: ["* Galaxi is pretending to be a boss.", "* Galaxi hums the overworld theme.", "* Galaxi swears he got all the coins once."],
      otherwise: ["Okay, last attack.", "...Probably."] },
  ],
  // On a phone (touchscreen, no mouse) there's no fight: after the opening Galaxi notices and you play tic-tac-toe instead, best of 3
  // (draws don't score). You're X (assets/egg/ui/x.png), he's O (o.png), both 16x16 white. Idea and beats by Galaxi; wording approved by him.
  phone: {
    intro: ["Wait.", "Are you on your PHONE right now?", "...", "Okay, this is awkward.", "I can't fight you like this. You'd need like three thumbs.", "...",
      "Okay. Compromise.", "Tic tac toe. Best of 3.", "You're X, I'm O. Tap a square."],
    // the board grows each time you're about to win: best of 3 on 3x3, then best of 5 on 5x3, then a last-ditch 5x5 where it's 4 in a row
    stages: [
      { cols: 3, rows: 3, need: 3, target: 2 },
      { cols: 5, rows: 3, need: 3, target: 3, say: ["...", "Okay. OKAY.", "Best of 5.", "And the board's bigger now. Because I said so."] },
      { cols: 5, rows: 5, need: 4, target: 4, say: ["No. No no no.", "Best of 7!", "5 by 5! Four in a row!", { text: "This is my FINAL FORM.", shake: true }] },
    ],
    mistake: .3,         // how often he just guesses instead of playing properly (0 = never loses, 1 = random)
    quipChance: .35,     // how often he says something while it's his move
    quips: ["Hmm.", "Bold.", "I see what you're doing.", "Calculated.", "...Okay, that one's a guess."],
    roundWin: () => any([["Hey! I wasn't ready!"], ["Okay. Beginner's luck."], ["That was the warm-up.", "...Obviously."]]),
    roundLose: () => any([["Ha! O wins!"], ["Tic tac TOE.", "...That's not a joke, I just like saying it."], ["I'm basically a tic tac toe pro.", "I think..."]]),
    // one line per draw in a row (a win or loss resets it); one more draw than this list and he rage quits
    draws: [["A draw?", "Okay, again."], ["Another draw.", "Huh."], ["Three draws in a row?", "Are you copying me?"], ["Okay, stop drawing.", "One of us has to WIN."],
      ["FIVE draws.", "I'm losing my mind."], [{ text: "I swear if this happens ONE more time...", shake: true }]],
    rageQuit: [{ text: "THAT'S IT!", shake: true }, "I'm done!", "This game is RIGGED!", "Tic tac toe is a solved game anyway!", { text: "You're kidding!", sound: V.yourekidding }],
    youWin: ["...", "I made the board BIGGER.", "And you still won.", "Okay, fine. You win. For real this time.", "Come back on a computer for the real fight!"],
    youLose: t => t.stage ? ["Ha! I win!", "...Don't look at the board size.", "Come back on a computer if you want a REAL rematch."]
      : ["Ha! I win!", "Still the boss, even on mobile.", "Come back on a computer if you want a REAL rematch."],
    end: { // the box lines after each ending
      win: [{ text: "Good grief.", sound: V.goodgrief, bubble: true }, "* YOU WON!", "* You beat Galaxi at tic tac toe.", "* Even the 5x5.", { text: "Thanks for watching!", sound: V.thanksforwatching, bubble: true }],
      lose: ["* You lost to Galaxi at tic tac toe.", "* ...It happens.", { text: "Thanks for watching!", sound: V.thanksforwatching, bubble: true }],
      rage: ["* Galaxi flipped the board.", "* Galaxi rage quit.", "* ...You win? Technically?", { text: "Thanks for watching!", sound: V.thanksforwatching, bubble: true }],
    },
  },
  tired: .85,            // once he's out of attacks and starts over, every attack runs this fast (he's tired)

  // what Galaxi says before his next attack, by what you picked on the menu (any turn; a turn's own before wins, its otherwise is the fallback).
  // nth(foe, pick, [1st time, 2nd time, ...]): after the list runs out it picks one of the later ones at random. any([...]): one at random
  react: {
    FIGHT: foe => {
      if (foe.hp <= foe.max * .35 && !foe.flags.ow) { foe.flags.ow = true; return ["Okay, OW.", "Can we talk about this?", "...No? Okay."]; }
      if (!foe.lastHit) return any([["Ha! Missed!", "...I mean, obviously. I'm TURBO."], ["Do you want me to stand still?", "Because I'm not gonna."], ["Miss!", "Skill issue."]]);
      if (foe.lastHit >= 28) return any([["OW.", "Okay, that one actually hurt."], ["HEY! Not the face!", "I need that for thumbnails!"]]); // a near-perfect hit
      return nth(foe, "FIGHT", [["You just don't know when to quit huh?", "Don't worry, me neither."],
        ["That tickled.", "...A lot. It tickled a lot."], ["Is that all you've got?", "...Please say yes."], ["You know I have to edit this later, right?"]]);
    },
    Check: foe => nth(foe, "Check", [["Did you just check me out?", "I have a girlfriend you know..."],
      ["You're checking me out AGAIN?", "She's gonna hear about this."], ["Okay, take a picture.", "It'll last longer."], ["Stop reading my stats!", "Those are private!"]]),
    Compliment: foe => nth(foe, "Compliment", [["You're so friendly, ... why?", { text: "WHY ARE YOU SO FRIENDLY?!", shake: true }],
      ["Stop it.", "...No wait, keep going."], ["I'm not blushing!", "That's just my RGB."], ["You're doing this on purpose, aren't you?", { text: "...It's working.", shake: true }]]),
    Subscribe: foe => nth(foe, "Subscribe", [["Sorry, force of habit..."], ["You can't subscribe twice.", "I checked."],
      ["Did you just ring the bell?", "...All notifications?", "Okay that's actually really nice. Stop."]]),
    "Ask for mods": foe => nth(foe, "Ask for mods", [null, ["Okay, okay. A real one this time.", "Create. It's always Create."], ["I review mods for a living, you know.", "You could just watch the videos."]]),
    "Heal me": foe => nth(foe, "Heal me", [null, ["Still no."], ["Heal yourself, I'm busy being a boss."]]),
    "Golden Carrot": ["Best food in the game by the way.", "I think..."],
    "Energy Drink": ["I used to drink like 3 of those a day!", "Fun fact ... lol."],
    Spare: foe => nth(foe, "Spare", [["Do you think that little of me?", "I should teach kids like you a lesson...", { text: "Let's speed things up!", sound: V.letsspeeditup }],
      ["Again?!", "You really think I'm a pushover, huh?"], ["Keep pressing it.", "See what happens."]]), // then the attack runs at spareRush
  },
  // the menu's flavor line after that attack, by the same pick (otherwise the turn's own flavor)
  reactFlavor: {
    "Heal me": foe => nth(foe, "Heal me", ["* Galaxi doesn't want to heal you, by the way.", "* Galaxi still doesn't want to heal you.", "* Galaxi is being really stubborn about this."]),
    "Golden Carrot": "* Galaxi is larping Minecraft wiki knowledge.", "Energy Drink": "* You think Galaxi has a caffeine addiction." },

  // lines that can come up before any attack, ahead of the react lines: retries (by how many times you've died this visit), your HP getting low,
  // and Galaxi running out of attacks (each time the turns start over)
  aside: ({ foe, player, turn, deaths, story, first }) => {
    const out = [];
    if (first && !story && deaths) out.push(...(deaths === 10 ? ["...That's ten deaths.", "Are you okay? Like, genuinely?"]
      : [["Back already?"], ["You again!", "Okay, I'll admit it. I like the attention."], ["Third time's the charm, right?", "...For me. It's the charm for me."],
        ["Want a hint?", "Dodge."], ["Okay, we've been here a while.", "I'm getting kinda hungry."]][deaths - 1]
      || any([["Respawning any%."], ["I'm putting this in a video."], ["You'll get it eventually.", "...Eventually."]])));
    if (foe.loop && turn % window.GALAXI_BOSS.turns.length === 0) out.push(...(foe.loop === 1 ? ["...", "Okay so I'm out of attacks.", "I didn't think you'd get this far.", "Uh... reruns!"]
      : foe.loop === 2 ? ["Seriously? Round three?", "I'm so tired.", "Do you know how long these took to make?"]
      : any([["I'm gonna need a sequel."], ["Season 2 when?"], ["Okay, you're just farming me for content now."]])));
    if (player.hp <= 6 && !foe.flags.low) { foe.flags.low = true; out.push(...any([["You're looking kinda red.", "...The heart. I mean the heart."], ["You're low!", "Not that I care. I'm the boss."]])); }
    return out;
  },

  acts: [
    { name: "Check", run: foe => nth(foe, "Check", [["* GALAXI - ATK 5 DEF 1", "* Finds the best Minecraft mods. Even makes his own."],
      ["* GALAXI - ATK 5 DEF 1", "* Still finds the best Minecraft mods.", "* Still makes his own."], [{ text: "Who's that Pokemon?", sound: V.whosthatpokemon, bubble: true }, "* It's Galaxi.", "* It's always been Galaxi."]]) },
    { name: "Compliment", run: foe => { foe.flags.nice = (foe.flags.nice || 0) + 1; const aha = { text: "Aha!", sound: V.ahaha, bubble: true };
      return nth(foe, "Compliment", [["* You tell Galaxi his videos go hard.", aha], ["* You tell Galaxi his thumbnails are clean.", aha],
        ["* You tell Galaxi his mods never crash.", "* ...They do, but he takes it.", aha], ["* You tell Galaxi he's your favourite YouTuber.", aha]]); } },
    { name: "Subscribe", run: foe => {
      if (foe.flags.subscribed) return foe.uses.Subscribe > 2 ? ["* You hit the bell.", "* All notifications.", { text: "Blurple!", sound: V.blurple, bubble: true }]
        : ["* You're already subscribed.", { text: "Blurple!", sound: V.blurple, bubble: true }];
      foe.flags.subscribed = true;
      return ["* You smash that subscribe button.", { text: "Like and subscribe!", sound: V.likeandsubscribe, bubble: true }];
    } },
    { name: "Ask for mods", run: foe => nth(foe, "Ask for mods", [["* You ask for a mod recommendation.", { text: "Adventure Time!", sound: V.adventuretime, bubble: true }, "* ...that isn't a mod."],
      ["* You ask for a REAL mod recommendation.", { text: "Adventure Time!", sound: V.adventuretime, bubble: true }, "* He's doing this on purpose."], ["* You ask one more time.", "* Galaxi pretends he can't hear you."]]) },
    { name: "Heal me", run: foe => nth(foe, "Heal me", [["* You ask Galaxi to heal you.", { text: "I'd heal you but I don't want to.", sound: V.idhealyoubutidontwantto, bubble: true }],
      ["* You ask Galaxi to heal you. Nicely.", { text: "I'd heal you but I don't want to.", sound: V.idhealyoubutidontwantto, bubble: true }, "* He said it the exact same way."], ["* You beg.", "* Galaxi looks the other way."]]) },
  ],

  items: [
    { name: "Actual Diamond", heal: 10, text: { text: "Gobble Gobble!", sound: V.gobblegobble, bubble: true } },
    { name: "Golden Carrot", heal: 15 },
    { name: "Energy Drink", heal: 20, verb: "drank", text: "* You feel chronically online." },
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
          if (push > 0) { lv.off += push; a.soul.x -= push; for (const o of a.bullets()) if (o.wx === undefined && o !== b && !o.fixed) o.x -= push; } // stars etc. live in the level too
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

      // bricks break when you hit them from below, ? blocks give a coin worth 1 HP and turn into empty blocks
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
              a.bullet({ x: b.x, y: b.y - 14, vy: -3, w: 8, h: 14, damage: 0, draw: ctx => { // a coin, edge-on as it spins, with its shine slot
                  const w = Math.max(2, Math.round(4 * Math.abs(Math.cos(t / 60)))); ctx.fillStyle = "#fff"; ctx.fillRect(-w, -6, w * 2, 12); ctx.fillRect(-w + 1, -7, w * 2 - 2, 14);
                  if (w > 2) { ctx.fillStyle = "#000"; ctx.fillRect(0, -4, 1, 8); } },
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

      // NOT in the original: 4 times per attack an avalanche of Galaxi's stars floods one half of the sky, coming from the star wall
      // on the left. The halves split at the top of 1-1's first brick/? row: bottom = the ground up to there, top = there up to the
      // box top, and the stars are spread evenly over the whole height of their half. The half flashes up first as a quick warning that fades (TELL)
      // (Gaster Blaster charge sound). Stars fly through pipes, stairs and blocks.
      // The 1st always hits the bottom half, the other 3 are random. Fair by design: the bottom half is only hit when there's
      // something to stand on (the brick/? row, a block above it, a tall pipe or the stairs, on screen or up to 6 tiles past the
      // edge); otherwise it hits the top half, which you dodge by staying low.
      // TRAIL: how long the last stars need to clear the box (slowest 6 px/frame over ~360px). The warning is long gone by then
      // (Galaxi wanted FFXIV-style tells): watch the stars themselves before dropping back down
      const GROUND = 9 * T, MID = 5 * T, CHARGE = 1400, FIRE = 1100, TRAIL = 1000;
      const ledge = () => {
        const c0 = Math.floor(lv.off / T), c1 = Math.floor((lv.off + W) / T);
        for (let c = c0; c <= Math.min(201, c1 + 6); c++) for (let r = 0; r <= 5; r++)
          if ("X<>[]SQ?U".includes(g[r][c])) return true; // a tall pipe, the stairs, or a block on the brick row or higher
        return false;
      };
      let clock = 0, fired = 0, nextAt = 1500;
      a.every(100, () => {
        clock += 100;
        if (fired >= 4 || clock < nextAt || clock > 13500) return; // 4 avalanches; 13500: the last one (3.8s) still finishes inside the 17.5s attack
        // the 1st one always hits the bottom half (it waits up to 4s for somewhere to stand), the other 3 are a coin flip
        const wantLow = fired === 0 || Math.random() < .5, canLow = ledge();
        if (fired === 0 && !canLow && clock < nextAt + 4000) return;
        blast(wantLow && canLow); fired++; nextAt = clock + 3900; // one finishes (3.8s) before the next lights up
      });
      function blast(low) {
        const y0 = low ? MID : 0, y1 = low ? GROUND : MID, half = (y1 - y0) / 2;
        let t = 0;
        a.sfx.charge(); a.after(CHARGE, () => a.sfx.beam());
        a.bullet({ x: 320, y: top + y0 + half, w: W, h: y1 - y0, damage: 0, fixed: true,
          update: (b, dt) => { if ((t += dt) > CHARGE + FIRE + TRAIL + 300) b.dead = true; },
          draw: (ctx, b) => {
            const k = TELL(t); if (!k) return;
            ctx.fillStyle = `rgba(255,255,255,${.25 * k})`; ctx.fillRect(-W / 2, -half, W, half * 2); // the warning: a quick flash
          } });
        // the avalanche: 7 stars every frame for the whole blast (~500), one in each seventh of the half so the whole height is packed
        for (let i = 0; i < FIRE / 16; i++) a.after(CHARGE + i * 16, () => { for (let j = 0; j < 7; j++) star(y0, y1, j); });
      }
      function star(y0, y1, j) {
        const big = Math.random() < .3, h = big ? 21 : 15, y = y0 + (j + Math.random()) / 7 * (y1 - y0); // its seventh of the half
        a.bullet({ x: left - a.random(4, 40), y: top + Math.max(y0 + h / 2, Math.min(y1 - h / 2, y)), vx: a.random(6, 10), w: h, h, // kept fully inside its half
          image: big ? "bigstar" : "star", spin: (Math.random() < .5 ? -1 : 1) * a.random(.2, .4), damage: 3,
          // simple hitbox rule: a wave star only hurts while the heart's middle is inside its half, so standing right on the split
          // (on the brick row, or on the ground under a top wave) is always safe even if a spinning star's corner brushes the heart
          update: b => b.damage = a.soul.y >= top + y0 && a.soul.y < top + y1 ? 3 : 0 });
      }

      // the star wall: a thick pile of stars churning along the left edge, staying put on screen. The stars are only the look;
      // one invisible strip the same width does the hurting, so there are no gaps to sit in. The scroll drags you into it if you stand still.
      for (let col = 0; col < 4; col++) for (let y = 2; y < a.box.height; y += col % 2 ? 10 : 12) {
        const big = Math.random() < .3, sz = big ? 21 : 15, x0 = left + 2 + col * 9, y0 = top + y + a.random(-2, 2), ph = Math.random() * 6;
        a.bullet({ x: x0, y: y0, w: sz, h: sz, image: big ? "bigstar" : "star", spin: (Math.random() < .5 ? -1 : 1) * a.random(.08, .2), damage: 0, fixed: true, t: 0,
          update: (b, dt) => { b.t += dt; b.x = x0 + Math.sin(b.t / 110 + ph) * 3; b.y = y0 + Math.cos(b.t / 140 + ph) * 2; } });
      }
      a.bullet({ x: left + 18, y: top + a.box.height / 2, w: 36, h: a.box.height, damage: 3, fixed: true, draw: () => {} }); // hurts once the heart is ~2px into the stars (heart hitbox reaches 4px past its middle)
      bringIn();
      // start on solid ground: where Mario starts, or the first ground on screen when carrying on
      // start in the middle like every other turn: the open ground column nearest the box's middle
      const mid = Math.floor((lv.off + W / 2) / T), open = c => c >= 0 && c < 202 && g[9][c] === "X" && !solidAt(c * T + 8, 8 * T + 8);
      let c = mid; for (let d = 0; d < 20; d++) { if (open(mid + d)) { c = mid + d; break; } if (open(mid - d)) { c = mid - d; break; } }
      a.soul.x = left + c * T + 8 - lv.off; a.soul.y = top + 9 * T - 6;
    },
    // stars rain down from the top of the box
    starfall(a) {
      a.every(300, () => a.bullet({ x: a.random(a.box.left + 8, a.box.right - 8), y: a.box.top - 16, vy: a.random(2.2, 3.4), w: 15, h: 15, image: "star", spin: .08 }));
    },
    // Gotta go fast: a SONIC THE HEDGEHOG lane runner. Two Green Hill lanes scroll past (top: the log bridge, which sags under the
    // heart like the game's; bottom: the grass) and the heart is locked in the middle of
    // the box: Up / Down (or a swipe) hops between lanes, Subway Surfers style. It opens with a spin dash (3 revs, each higher, then
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
      let lane = 1, y = base(1), sp = 0, off = 0, t = 0, dash = 0; // dash: the spin dash's phase clock
      const TOP = 5.5, REVS = [0, 320, 640], GO = 950; // top speed px/frame, rev times, release time

      // the ground, scrolled with the speed (drawn under everything else): the bridge's logs, dipping round the heart, and the grass
      a.bullet({ x: 0, y: 0, w: 1, h: 1, damage: 0, z: -1,
        update(b, dt) { t += dt; off += sp * dt / 16.7; },
        draw(ctx) { const log = a.images.bridge, grass = a.images.ghzground;
          for (let x = B.left - Math.round(off) % LOG - LOG; x < B.right; x += LOG) {
            const dip = Math.round(sag * Math.max(0, 1 - Math.abs(x + LOG / 2 - 320) / 90) ** 2);
            if (log.naturalWidth) ctx.drawImage(log, x, surface(0) + dip); }
          if (grass.naturalWidth) { const w = grass.naturalWidth; for (let x = B.left - Math.round(off) % w; x < B.right; x += w) ctx.drawImage(grass, 0, 0, w, G, x, B.bottom - G, w, G); }
        } });

      // the heart: locked to the middle, eases between lanes; drawn here (the engine's is hidden) so it can spin
      a.soul.hide = true;
      a.bullet({ x: 320, y, w: 1, h: 1, damage: 0, z: 2, clip: false, trail: [], spin: 0,
        update(b, dt) {
          if (a.tapped("ArrowUp") && lane > 0) { lane--; a.sfx.move(); }
          if (a.tapped("ArrowDown") && lane < 1) { lane++; a.sfx.move(); }
          sag += ((lane ? 0 : 4) - sag) * Math.min(1, dt / 80);
          y += (base(lane) + (lane ? 0 : sag) - y) * Math.min(1, dt / 45); // ~90ms to settle in the new lane
          a.soul.x = 320; a.soul.y = Math.round(y); b.y = a.soul.y;
          dash += dt;
          for (const r of REVS) if (dash - dt < r && dash >= r) { a.play(SND("pullback"), .8, 1 + REVS.indexOf(r) * .15); puff(); }
          if (dash - dt < GO && dash >= GO) a.play(SND("speedup"));
          if (dash >= GO) sp = Math.min(TOP, sp + .25 * dt / 16.7);
          b.rot -= (dash < GO ? .5 : .15 + sp * .06) * dt / 16.7; // revving: a fast blur; running: rolls with the speed
          b.trail.unshift(b.y); b.trail.length = 3;
        },
        draw(ctx, b) {
          if (a.soul.inv && Math.floor(t / 80) % 2) return; // hit: flashes like the normal heart
          const squash = dash < GO ? 1 - .15 * Math.abs(Math.sin(dash / 50)) : 1;
          ctx.save(); ctx.rotate(-b.rot); // afterimages, behind it, while running
          if (sp > 2) b.trail.forEach((ty, k) => { ctx.globalAlpha = .25 - k * .07; ctx.save(); ctx.translate(-(k + 1) * 7, ty - b.y); ctx.rotate(b.rot + k * .6); a.heart(0, 0); ctx.restore(); });
          ctx.restore(); ctx.globalAlpha = 1; ctx.scale(1, squash); a.heart(0, 0); } });
      const puff = () => { for (let k = 0; k < 4; k++) { let pt = 0; a.bullet({ x: 312, y: a.soul.y + 6, vx: -a.random(1, 2.5), vy: -a.random(.2, 1), w: 1, h: 1, damage: 0,
        update(p, dt) { if ((pt += dt) > 300) p.dead = true; }, draw(ctx) { ctx.fillStyle = "#fff"; ctx.globalAlpha = 1 - pt / 300; const s = pt < 150 ? 4 : 2; ctx.fillRect(-s / 2, -s / 2, s, s); } }); } }; // dust kicked up behind

      // what comes down the lanes. Hitboxes are smaller than the sprites, and sit on the grass like the heart
      // the bridge only gets Motobugs; Crabmeat, spikes and rocks stay on the grass
      const MOTO = { name: "motobug", extra: 1.3, w: 22, h: 14 }, KINDS = [[MOTO], [MOTO, { name: "crabmeat", extra: 0, w: 26, h: 14 }, { name: "spikes", extra: 0, w: 22, h: 12 }, { name: "rock", extra: 0, w: 26, h: 14 }]];
      const thing = (k, i) => { let tt = Math.random() * 500; a.bullet({ x: B.right + 30, y: base(i), w: k.w, h: k.h, damage: 4,
        update(o, dt) { tt += dt; o.vx = -(sp + k.extra); if (o.x < B.left - 40) o.dead = true; },
        draw(ctx) { ctx.translate(0, 8); sprite(ctx, k.name, tt); } }); }; // standing on the surface
      const rings = i => { for (let n = 0; n < 2; n++) { let rt = 0; a.bullet({ x: B.right + 30 + n * 22, y: base(i), w: 1, h: 1, damage: 0,
        update(o, dt) { rt += dt; o.vx = -sp; if (o.x < B.left - 20) o.dead = true;
          if (Math.abs(o.x - a.soul.x) < 12 && Math.abs(o.y - a.soul.y) < 12) { o.dead = true; a.heal(1, false); a.play(SND("sparkle1"), .5); } },
        draw(ctx) { ctx.translate(0, 8); sprite(ctx, "rings", rt, 12); } }); } }; // centred on the heart's path
      // waves: one lane blocked, every 0.8s at first, down to every 0.5s. The other lane (either one) sometimes gets rings
      let clock = 0, next = 1700;
      a.every(50, () => {
        clock += 50; if (clock < next || clock > 10200) return; // the last wave still clears before the 12s attack ends
        const i = Math.round(Math.random());
        thing(KINDS[i][Math.floor(Math.random() * KINDS[i].length)], i);
        if (Math.random() < .35) rings(1 - i);
        next = clock + Math.max(500, 800 - clock * .035);
      });
    },
    // Go, Pikachu: "Go, Pikachu!" is a go: line, so this starts as it's said: Galaxi throws a Poke Ball next to him, it pops
    // open with a flash and Pikachu grows in like the games. Pikachu then hops into the box and runs and jumps along its floor,
    // shooting lightning at the heart on a steady beat, and every few seconds stops to call down Thunder on your column (warning
    // line first). Galaxi lobs Poke Balls too (a faint POKEMON GO catch ring round the heart while one's coming), faster as the turn goes on;
    // get hit and you're caught: the ball wobbles once or twice (you can't move, mash any key to struggle out sooner) while
    // Pikachu zaps it, then you break out. The balls themselves never hurt.
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
      const R = 11; // the ball's radius on screen
      const lob = (tx, ty, ms, aimed = true) => { a.play(THROW); if (aimed) marker(ms); a.bullet({ ...arc(HAND.x + a.random(-30, 30), HAND.y, tx, ty, ms), w: 22, h: 22, damage: 0, clip: false, spin: .15, draw: look(0),
        update(b, dt) {
          if (b === caught) return holdOn(b, dt);
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
            caught = b; b.vx = b.vy = b.spin = b.rot = b.t = 0; b.x = a.soul.x; b.y = a.soul.y; b.wobbles = Math.random() < .5 ? 1 : 2;
            a.soul.hide = true; a.play(CATCH);
          }
        } }); };
      // caught: 400ms still, then each wobble is a 500ms shake and a 450ms pause; after the last one it pops open.
      // Struggle: after the first 400ms, every key press / tap jolts the ball and skips 110ms ahead (mashing ~2x as fast)
      const holdOn = (b, dt) => {
        a.soul.x = b.x; a.soul.y = b.y; b.t += dt;
        if (b.t > 400 && a.pressed()) { b.t += 110; b.jolt = 140; a.sfx.move(); }
        const k = b.t - 400, i = Math.floor(k / 950), p = k - i * 950;
        b.rot = k > 0 && p < 500 ? Math.sin(p / 500 * Math.PI * 2) * .45 : 0;
        if (b.jolt > 0) { b.jolt -= dt; b.rot += Math.sin(b.jolt / 140 * Math.PI * 3) * .3; }
        if (k > 0 && b.shook !== i && i < b.wobbles) { b.shook = i; a.sfx.move(); }
        if (k < b.wobbles * 950) return;
        b.dead = true; caught = null; safe = true; a.after(900, () => safe = false); a.soul.hide = false; pop(b.x, b.y);
      };
      // throws at the heart: one every 1.6s at first, speeding up to one every 0.95s by the end of the turn. Each is rated like a
      // POKEMON GO throw, and the rating pops up above Galaxi's head as he throws:
      //   Nice!      slow (0.95s), aimed where the heart is now: easy
      //   Great!     faster (0.7s), aimed half way to where the heart is heading
      //   Excellent! fastest (0.55s), aimed right where the heart is heading
      // Early on it's mostly Nice; later Great and Excellent take over
      const THROWS = [{ name: "Nice!", ms: 950, lead: 0 }, { name: "Great!", ms: 700, lead: .5 }, { name: "Excellent!", ms: 550, lead: 1 }];
      let clock = 0, nextLob = 1900, last = null, vel = { x: 0, y: 0 };
      a.every(50, () => {
        clock += 50;
        if (last && !caught) vel = { x: (a.soul.x - last.x) / 50, y: (a.soul.y - last.y) / 50 }; // the heart's speed, px/ms
        last = { x: a.soul.x, y: a.soul.y };
        if (clock < nextLob || caught) return;
        const late = Math.min(1, clock / 8000), roll = Math.random();
        const th = THROWS[roll < .55 - .35 * late ? 0 : roll < .9 - .3 * late ? 1 : 2]; // Nice 55% -> 20%, Excellent 10% -> 40%
        const B = a.box, tx = Math.max(B.left + R, Math.min(B.right - R, a.soul.x + vel.x * th.ms * th.lead)), ty = Math.max(B.top + R, Math.min(B.bottom - R, a.soul.y + vel.y * th.ms * th.lead));
        lob(tx, ty, th.ms); rating(th.name);
        nextLob = clock + Math.max(950, 1600 - clock * .08);
      });
      // the rating, in UNDERTALE's font at speech size, floating up from just above Galaxi's head (his sprite's top is at y 60)
      const rating = text => { let t = 0; a.bullet({ x: 320, y: 50, w: 1, h: 1, damage: 0, clip: false,
        update(r, dt) { if ((t += dt) > 700) r.dead = true; },
        draw(ctx) { ctx.globalAlpha = t > 450 ? 1 - (t - 450) / 250 : 1; ctx.fillStyle = "#fff"; ctx.font = "24px DTM-Mono"; ctx.textAlign = "center";
          ctx.fillText(text, 0, -Math.round(t / 40) * 2); } }); }; // rises in 2px steps, pixel-consistent
      a.every(3000, () => { if (!caught) lob(a.random(a.box.left + 20, a.box.right - 20), a.box.bottom - 20, 900, false); }, 3200); // a stray one to box you in

      // Pikachu, once it hops into the box: the floor is the box bottom, the sides are walls it bounces off. It runs and jumps, and
      // shoots on a steady beat. It doesn't hurt to touch, only its bolts do.
      // POKEMON YELLOW's walking Pikachu sheet (16px frames): 2 = facing left, 5 = the same mid-step. Facing right = mirrored
      const box = a.box, HALF = 8 * K, FLOOR = box.bottom - HALF;
      const pikachu = {
        x: PIKA.x, y: PIKA.y, w: 1, h: 1, damage: 0, clip: false, t: 0, mode: "out", dir: 1, nextHop: 700, beat: 0, thunderIn: 1800, charging: 0,
        update(p, dt) {
          p.t += dt;
          if (p.mode === "out" && p.t > 700) Object.assign(p, arc(p.x, p.y, box.left + 40, FLOOR, 550), { mode: "in", inT: 0 });
          if (p.mode === "in") { fall(p, dt); if ((p.inT += dt) >= 550) { p.y = FLOOR; p.vx = p.vy = 0; p.mode = "run"; } return; }
          if (p.mode !== "run") return;
          if (p.charging > 0) { p.vx = 0; p.charging -= dt; return; } // stands still while it calls down Thunder
          if (!caught) p.thunderIn -= dt;
          if (p.thunderIn <= 0 && p.y >= FLOOR && !caught) { p.thunderIn = 2400; p.charging = 700; return thunder(); } // waits until it's landed
          p.vx = p.dir * 1.7; // the engine moves it by vx / vy
          if (p.x < box.left + HALF && p.dir < 0 || p.x > box.right - HALF && p.dir > 0) p.dir *= -1; // walls
          const was = p.vy; fall(p, dt);
          if (p.y >= FLOOR && p.vy > 0) { p.y = FLOOR; p.vy = 0; if (was > 0 && Math.random() < .3) p.dir *= -1; } // lands, sometimes turns round
          if (p.y >= FLOOR && (p.nextHop -= dt) <= 0) { p.vy = -a.random(4, 5.2); p.nextHop = a.random(700, 1500); }
          if ((p.beat += dt) >= (caught ? 250 : 900)) { p.beat = 0; shoot(p); } // a steady beat: 1 bolt every 0.9s, 4 a second at a caught ball
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
      // Thunder: a flickering warning line down the heart's column, then a strike of stacked bolts from the box top to the floor
      // (a zigzag: every other bolt mirrored). Step out of the column before it lands
      const thunder = () => {
        const x = Math.max(box.left + 10, Math.min(box.right - 10, a.soul.x)); let t = 0; a.sfx.charge();
        a.bullet({ x, y: (box.top + box.bottom) / 2, w: 2, h: box.height, damage: 0,
          update(w, dt) { if ((t += dt) < 650) return; w.dead = true; strike(x); },
          draw(ctx, w) { const k = TELL(t); if (!k) return; ctx.fillStyle = "#fff"; ctx.globalAlpha = .7 * k; ctx.fillRect(-1, -w.h / 2, 2, w.h); } }); // a quick flash, gone before it strikes
      };
      const strike = x => { let t = 0; a.sfx.beam();
        a.bullet({ x, y: (box.top + box.bottom) / 2, w: 16, h: box.height, damage: 4,
          update(b, dt) { if ((t += dt) > 260) b.dead = true; },
          draw(ctx, b) { const im = a.images.bolt; if (!im.naturalWidth) return; ctx.globalAlpha = t > 180 ? 1 - (t - 180) / 80 : 1;
            for (let y = -b.h / 2, i = 0; y < b.h / 2; y += 22, i++) { ctx.save(); if (i % 2) ctx.scale(-1, 1); ctx.drawImage(im, -8, y, 16, 22); ctx.restore(); } } });
      };
      // stuck in a ball: fast bolts at the ball. Free: slower ones at the heart
      const shoot = p => caught ? zap(p.x, p.y, caught.x, caught.y, 6) : zap(p.x, p.y, a.soul.x, a.soul.y, 3);
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
      const B = a.box, FONT = '32px "DTM-Mono", monospace', VOICE = "assets/egg/voice/galaxi-blip.mp3", NARRATOR = "assets/egg/sfx/txt1.mp3";
      const FAKE = "* Galaxi is lost in thought.", NEW = "I'm gonna try something new."; // NEW is his speech bubble // Claude placeholders for Galaxi to reword
      const HAND = { x: 373, y: 148 }; // his raised hand on the sprite (pixel 61, 44 at 2x)
      const m = document.createElement("canvas").getContext("2d"); m.font = FONT; const CW = m.measureText("M").width; // the dialogue font is monospace: every letter is CW wide
      // 1. the fake menu, then 2. Galaxi hijacking the text box. Typed like the real box text (32px, 33ms a letter, a sound every 2nd)
      a.soul.hide = true; a.menuLook(true);
      let boxText = null; // { text, n, t, sound }
      const type = (text, sound) => boxText = { text, n: 0, t: 0, sound };
      a.bullet({ x: 0, y: 0, w: 1, h: 1, damage: 0, clip: false,
        update(b, dt) { const o = boxText; if (!o || o.n >= o.text.length) return;
          o.t += dt; while (o.t > 33 && o.n < o.text.length) { o.t -= 33; o.n++; if (o.text[o.n - 1] !== " " && o.n % 2) o.sound === VOICE ? a.speak() : a.play(o.sound); } },
        draw(ctx) { if (!boxText) return; ctx.font = FONT; ctx.fillStyle = "#fff"; ctx.textBaseline = "alphabetic"; ctx.fillText(boxText.text.slice(0, boxText.n), 52, 292); } });
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
      const BLUE = "#14a9ff", ROWH = 34, RISE = .8, TYPE = 16, TALK = 9000, OVERLAP = 26, SHIFT = 44; // UNDERTALE's blue, line height, scroll px/frame, ms per letter, how long he talks, blue overlap px, max path shift px a line
      const N = Math.floor(530 / CW), LEFT = 52, FLOOR = B.bottom - ROWH - 5; // letters per line (the box's 530px wrap), where text starts, the SOUL's lowest point
      const BY_LEN = {}; "ut et ad in sed sit non amet elit enim quis lorem ipsum dolor magna culpa tempor labore dolore veniam aliqua nostrud eiusmod commodo ullamco laboris pariatur occaecat proident deserunt consequat voluptate excepteur cupidatat adipiscing incididunt consectetur amet, elit. sed, lorem, dolor. magna, aliqua. tempor, enim. quis, ipsum.".split(" ").forEach(w => (BY_LEN[w.length] ||= []).push(w));
      const pick = n => { const l = BY_LEN[n]; return l[Math.floor(Math.random() * l.length)]; };
      const fill = n => { const out = []; // words that add up to exactly n letters with their spaces
        while (n > 0) { if (n <= 11 && BY_LEN[n]) { out.push(pick(n)); break; } const w = pick(2 + Math.floor(Math.random() * Math.min(9, n - 4))); out.push(w); n -= w.length + 1; }
        return out; };
      const px = c => LEFT + c * CW; // a letter's left edge
      let path = { l: 320 - 30, r: 320 + 30 }, first = true, sentence = true; // sentence: the next line starts a new sentence // the last line's blue span (px); the path starts where the SOUL lands
      const line = () => { // N letters of lorem; the blue run: the word under the path's next point, widened until it overlaps the last line's
        const words = fill(first ? N - 2 : N), at = []; let c = first ? 2 : 0; for (const w of words) { at.push(c); c += w.length + 1; }
        const mid = Math.max(px(3), Math.min(px(N - 3), (path.l + path.r) / 2 + a.random(-SHIFT, SHIFT)));
        let k0 = words.findIndex((w, k) => px(at[k] + w.length) + CW / 2 >= mid); if (k0 < 0) k0 = words.length - 1; let k1 = k0;
        const span = () => ({ l: px(at[k0]), r: px(at[k1] + words[k1].length) }), ov = sp => Math.min(sp.r, path.r) - Math.max(sp.l, path.l);
        while ((ov(span()) < OVERLAP || span().r - span().l < 40) && (k0 > 0 || k1 < words.length - 1)) { // grow toward the old path
          const sp = span(); if (k0 > 0 && (sp.l > path.l || k1 === words.length - 1)) k0--; else k1++; }
        path = span();
        let text = first ? "* " : "", blue = first ? [false, false] : []; first = false;
        words.forEach((w, k) => { if (k) { text += " "; blue.push(k > k0 && k <= k1); } text += w; for (const _ of w) blue.push(k >= k0 && k <= k1); });
        text = text.replace(/\. ([a-z])/g, (_, c) => ". " + c.toUpperCase()); if (sentence) text = text.replace(/^(\* )?([a-z])/, (_, s, c) => (s || "") + c.toUpperCase()); // one running paragraph: capitals only after a full stop
        sentence = text.endsWith(".");
        // his rhythm, so it doesn't sound robotic: each letter a bit faster or slower, sometimes a beat between words or a hesitation
        // mid-word, a proper stop after commas and full stops; then the whole line is squeezed to finish in the typing row
        const delays = [...text].map((ch, c) => { const prev = text[c - 1];
          return TYPE * a.random(.6, 1.4) + (prev === "," ? 110 : prev === "." ? 200 : prev === " " && Math.random() < .25 ? 60 : /\w/.test(ch) && Math.random() < .06 ? 90 : 0); });
        const budget = ROWH / RISE * 16.7 * .9, sum = delays.reduce((t, d) => t + d, 0);
        return { text, blue, delays: sum > budget ? delays.map(d => d * budget / sum) : delays };
      };
      const lines = [];
      const talk = () => {
        const send = () => { const { text, blue, delays } = line();
          lines.push(a.bullet({ x: 320, y: B.bottom - ROWH / 2, vy: -RISE, w: 1, h: 1, damage: 0, n: 0, tt: 0, text, blue,
            update(l, dt) { if (l.y < B.top - ROWH) l.dead = true;
              if (l.n < N) { l.tt += dt; while (l.n < N && l.tt > delays[l.n]) { l.tt -= delays[l.n]; l.n++; if (/\w/.test(text[l.n - 1]) && l.n % 2) a.speak(); } } },
            draw(ctx, l) { ctx.translate(0, Math.round(l.y) - l.y); ctx.font = FONT; ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
              for (let c = 0; c < l.n; c++) if (text[c] !== " ") { ctx.fillStyle = blue[c] ? BLUE : "#fff"; ctx.fillText(text[c], px(c) - 320, 11); } } })); }; // baseline 11 below the middle: the letters sit centred in their row
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
    // a ring of stars appears around the heart and closes in
    ring(a) {
      a.every(1300, () => {
        const cx = a.soul.x, cy = a.soul.y, n = 10, start = a.random(0, Math.PI * 2);
        for (let i = 1; i < n; i++) { // i = 0 skipped: the gap you escape through
          const ang = start + i / n * Math.PI * 2;
          a.bullet({ x: cx + Math.cos(ang) * 110, y: cy + Math.sin(ang) * 110, vx: -Math.cos(ang) * 1.6, vy: -Math.sin(ang) * 1.6, w: 13, h: 13, image: "star", spin: .1 });
        }
      });
    },
    // The World: DIO's time stop from JOJO'S BIZARRE ADVENTURE, a loop played twice:
    //   1. Time stops ("The World!" is a go: line, so the first stop lands as it's said): a negative sphere swells out of Galaxi and
    //      back, the music winds down and freezes, and the heart is frozen too. Push against it and it shakes a pixel with a quiet tick.
    //   2. While time is stopped, Galaxi's knives click into a ring round the heart, all pointing in, with one exit (facing the box middle).
    //   3. Time resumes: the knives fly in, slow at first and speeding up, and through and out the other side. Run for the exit (hold the
    //      direction while time is stopped to get a head start), then step aside: the knife opposite the exit follows you out.
    //   4. Once they're all gone, Galaxi throws 3 fans of 3 knives at the heart, then the loop starts again. The attack ends when the
    //      second loop's knives are gone.
    theworld(a) {
      const TIMESTOP = "assets/egg/sfx/timestop.mp3"; // the anime's time stop sound (levelled)
      const STOP = 1900, R = 64, SLOTS = 12, STEP = Math.PI * 2 / SLOTS, ACC = .12, VMAX = 6; // stop length, ring radius and slots, the ring knives' speed-up and top speed (medium)
      const KNIFE = ["00100", "01110", "01110", "01110", "01010", "01010", "01110", "11111", "00100", "01110", "01010", "00100"]; // points up, 2x; cut-outs: the groove and the grip
      const draw = ctx => { ctx.fillStyle = "#fff"; KNIFE.forEach((row, j) => [...row].forEach((c, i) => c === "1" && ctx.fillRect(i * 2 - 5, j * 2 - 12, 2, 2))); };
      const knife = (x, y, ang, speed, o) => a.bullet({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, rot: ang + Math.PI / 2, w: 6, h: 18, draw, ...o });
      // the anime's time stop, drawn over everything but the heart (z: 1; the heart is drawn after it, so it stays red). A sphere of negative colour bursts out of Galaxi with a shockwave on its edge, swallows the
      // screen, collapses back into him, and leaves the frozen world with a dull colour cast (TINT) until time moves again
      const TINT = "#c8d8a0", OUT = 450, IN = 450, BIG = 760, EDGE = 56; // TINT: the stopped world's colour; sphere grow / collapse ms, full radius, soft edge width
      // the sphere is drawn into a half-size mask (2x2 blocks, like the sprites) and its edge fades out with a 4x4 Bayer dither,
      // so it's a pixel-art gradient instead of a hard cut to negative. The shockwave rings are dithered the same way
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
      const timeFx = () => { let t = 0, back = 0; // back: ms since time started moving again
        return a.bullet({ x: 0, y: 0, w: 1, h: 1, damage: 0, clip: false, z: 1, resume() { back = 1; },
          update(b, dt) { t += dt; if (back && (back += dt) > 300) b.dead = true; },
          draw(ctx) {
            ctx.beginPath(); ctx.rect(0, 0, 640, 392); ctx.clip(); // stops above the HP line
            ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = back ? 1 - back / 300 : Math.min(1, t / OUT); ctx.fillStyle = TINT; ctx.fillRect(0, 0, 640, 392);
            if (t > OUT + IN) return;
            const r = t < OUT ? BIG * (1 - (1 - t / OUT) ** 2) : BIG * (1 - (t - OUT) / IN) ** 2; // bursts out fast, collapses faster at the end
            paint(r, t < OUT); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false;
            ctx.globalCompositeOperation = "difference"; ctx.drawImage(mask, 0, 0, 640, 392);
            if (t < OUT) { ctx.globalCompositeOperation = "source-over"; ctx.drawImage(rings, 0, 0, 640, 392); } // the shockwave riding the edge
          } }); };
      const wait = ms => new Promise(go => a.after(ms, go));
      const clear = async () => { while (a.bullets().some(b => b.knife)) await wait(50); }; // until every knife has left the box
      const out = (b, m = 20) => { const B = a.box; return b.x < B.left - m || b.x > B.right + m || b.y < B.top - m || b.y > B.bottom + m; };
      const stop = async () => {
        a.play(TIMESTOP); a.musicRate(0, 400);
        const fx = timeFx(), cx = a.soul.x, cy = a.soul.y, B = a.box, mx = (B.left + B.right) / 2, my = (B.top + B.bottom) / 2;
        // the heart is frozen: held in place every frame. Pushing a direction shakes it 1px and ticks quietly (every 350ms while held)
        let tick = 0;
        const hold = a.bullet({ x: 0, y: 0, w: 1, h: 1, damage: 0, clip: false, draw() {},
          update(b, dt) { const push = a.steering(); tick = push ? tick - dt : 0;
            if (push && tick <= 0) { tick = 350; a.play(a.sfx.files.squeak, .25, .6); }
            a.soul.x = cx + (push ? Math.round(Math.sin(performance.now() / 30)) : 0); a.soul.y = cy; } });
        const open = Math.hypot(mx - cx, my - cy) > 10 ? Math.atan2(my - cy, mx - cx) : Math.round(Math.random()) * Math.PI + a.random(-.4, .4); // never an exit into a wall; from the middle, left or right
        const ring = [];
        for (let i = 1; i < SLOTS; i++) { // slot 0 is the exit
          await wait(i === 1 ? 300 : 100);
          const phi = open + STEP * i; a.sfx.move();
          ring.push(knife(cx + Math.cos(phi) * R, cy + Math.sin(phi) * R, phi + Math.PI, 0, { knife: true, damage: 3, dx: -Math.cos(phi), dy: -Math.sin(phi), sp: 0, gone: 0,
            update(b, dt) {
              if (b.falling) { b.vy += .25 * dt / 16.7; if (b.y > a.box.bottom + 20) b.dead = true; return; } // tumbling down out of the box
              if (!b.sp) return; b.sp = Math.min(VMAX, b.sp + ACC * dt / 16.7); b.vx = b.dx * b.sp; b.vy = b.dy * b.sp;
              if ((b.gone += b.sp * dt / 16.7) < R - 8) return;
              // the tips meet in the middle: clank (once per ring), knocked back a little, then they fall spinning
              if (!ring.clanked) { ring.clanked = true; a.play(a.sfx.files.break1, .6, 1.8); }
              Object.assign(b, { falling: true, damage: 0, vx: -b.dx * a.random(.6, 1.6) + a.random(-.5, .5), vy: -a.random(1.5, 3), spin: a.random(-.35, .35) });
            } }));
        }
        await wait(STOP - 300 - (SLOTS - 2) * 100);
        hold.dead = true; a.soul.x = cx; fx.resume(); a.musicRate(1, 300); a.sfx.swing();
        for (const b of ring) b.sp = .5;
      };
      const volley = () => { const x = 320, y = a.box.top - 12, ang = Math.atan2(a.soul.y - y, a.soul.x - x); a.sfx.swing(); // from Galaxi, aimed at the heart
        for (const d of [-.28, 0, .28]) knife(x, y, ang + d, 4, { knife: true, update(b) { if (b.y > a.box.top && out(b)) b.dead = true; } }); };
      (async () => {
        for (let loop = 0; loop < 2; loop++) {
          await stop(); await clear();
          for (let v = 0; v < 3; v++) { volley(); await wait(650); }
          await clear();
        }
        await wait(300); a.end();
      })();
    },
    // ---- Sans's moves (UNDERTALE), made of Galaxi's stars. Shared bits (starPx, starBlaster) are above GALAXI_BOSS. ----
    // Ray of Death: star blasters, Sans's Gaster Blasters. Complimented him on the menu before? Toned down: 7 of the 14 blasters, all 20% slower. Each one flies in spinning, shows a faint aim line while it charges, then
    // fires a beam across the screen. Singles aimed at you, a pair, a cross, a quick run of singles, then a cage of 4 (stand still).
    blasters(a) {
      const B = a.box, cx = (B.left + B.right) / 2, cy = (B.top + B.bottom) / 2, RX = B.width / 2 + 50, RY = B.height / 2 + 45;
      const nice = a.foe().last === "Compliment", P = nice ? .8 : 1, o = { pace: P }, at = (ms, fn) => a.after(ms / P, fn); // complimented: the toned-down version
      const aimed = () => { const th = a.random(0, Math.PI * 2), x = cx + Math.cos(th) * RX, y = cy + Math.sin(th) * RY;
        starBlaster(a, x, y, Math.atan2(a.soul.y - y, a.soul.x - x), o); };
      const across = (y, fromLeft) => starBlaster(a, fromLeft ? B.left - 45 : B.right + 45, y, fromLeft ? 0 : Math.PI, o);
      const down = (x, fromTop) => starBlaster(a, x, fromTop ? B.top - 40 : B.bottom + 40, fromTop ? Math.PI / 2 : -Math.PI / 2, o);
      at(300, aimed);
      at(1300, () => { aimed(); if (!nice) aimed(); });
      at(2400, () => { across(a.soul.y, Math.random() < .5); if (!nice) down(a.soul.x, true); });
      for (let i = 0; i < (nice ? 2 : 5); i++) at(3500 + i * 450, aimed);
      at(6000, () => { const x = a.soul.x, y = a.soul.y; across(y - 40, true); across(y + 40, false); if (!nice) { down(x - 40, true); down(x + 40, false); } }); // a cage: the middle is safe
      at(8600, () => a.end());
    },
    // Kablooey: the finale. A spiral of 8 star blasters round the box, firing one after another through the middle, then 3 big stars that
    // swell up where you are and burst into a ring of little stars, then the 4-blaster cage with a big blaster through the middle.
    kablooey(a) {
      const B = a.box, cx = (B.left + B.right) / 2, cy = (B.top + B.bottom) / 2, RX = B.width / 2 + 50, RY = B.height / 2 + 45, wait = ms => new Promise(go => a.after(ms, go));
      const burst = (x, y) => { let t = 0; a.play(SANS_SFX.flash, .5);
        a.bullet({ x, y, w: 1, h: 1, damage: 0, clip: false, z: 1, update(b, dt) { t += dt; // swells for 700ms (no hitbox), then pops
            if (t < 700) return; b.dead = true; a.play(SANS_SFX.impact, .7);
            for (let i = 0; i < 8; i++) { const ang = i * Math.PI / 4 + Math.PI / 8; a.bullet({ x, y, vx: Math.cos(ang) * 3, vy: Math.sin(ang) * 3, w: 15, h: 15, image: "starBombBit", spin: .15, damage: 3 }); } },
          draw(ctx) { if (Math.floor(t / 70) % 2 && t < 500) return; const im = a.images.starBomb, k = 2 + Math.floor(t / 140); im.naturalWidth ? ctx.drawImage(im, -4.5 * k, -4.5 * k, 9 * k, 9 * k) : starPx(ctx, STAR7, k); } }); }; // Galaxi's star bomb, swelling 2x to 6x
      (async () => {
        await wait(300);
        const th0 = a.random(0, Math.PI * 2), turn = Math.random() < .5 ? 1 : -1;
        for (let i = 0; i < 8; i++) { const th = th0 + turn * i * Math.PI / 4, x = cx + Math.cos(th) * RX, y = cy + Math.sin(th) * RY;
          starBlaster(a, x, y, Math.atan2(cy - y, cx - x), { charge: 650 }); await wait(260); }
        await wait(1300);
        for (let i = 0; i < 3; i++) { burst(a.soul.x, a.soul.y); await wait(1000); }
        await wait(500);
        const x = a.soul.x, y = a.soul.y;
        starBlaster(a, B.left - 45, y - 40, 0); starBlaster(a, B.right + 45, y + 40, Math.PI); starBlaster(a, x - 40, B.top - 40, Math.PI / 2); starBlaster(a, x + 40, B.bottom + 40, -Math.PI / 2);
        await wait(1500);
        const bx = Math.random() < .5 ? B.left - 60 : B.right + 60; starBlaster(a, bx, B.top - 30, Math.atan2(a.soul.y - B.top + 30, a.soul.x - bx), { k: 8, width: 44, charge: 800 });
        await wait(2200); a.end();
      })();
    },
  },

  onWin: foe => [{ text: "Good grief.", sound: V.goodgrief, bubble: true }, ...(foe.flags.nice ? ["* Galaxi feels kind of betrayed."] : []), "* YOU WON!", "* You earned 0 EXP and 1 new subscriber.", { text: "Thanks for watching!", sound: V.thanksforwatching, bubble: true }],
  onSpare: foe => [{ text: "This boss thing is fun!", sound: V.thidbossthingisfun, bubble: true }, "* YOU WON!", "* You spared Galaxi.", { text: "Thanks for watching!", sound: V.thanksforwatching, bubble: true }],
  notSpareable: { text: "You're joking, right?", sound: V.yourejokingright, bubble: true },
  onFlee: { text: "You're kidding!", sound: V.yourekidding, bubble: true },
  onDeath: "Eventuality!",
  onDeathSound: V.eventuality,
};
