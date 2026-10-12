# Meta events

Galaxi bending the fight's rules mid-run. Each event is one file here, `<name>.js`, listed in `boss.js` → `eventFiles`. The engine
(`battle.js`) picks 3–4 a run (PC only, never on the first attack, never two enemy turns in a row, each at most once), and calls the
event's `start` on the enemy turn it lands on, before Galaxi talks and attacks.

```js
(window.GALAXI_EVENTS = window.GALAXI_EVENTS || {}).myEvent = {
  can(ctx) { return true; },       // optional: does it fit this turn? (otherwise the engine tries it on a later turn)
  start(ctx, fx) { ... },          // set it up (runs once)
};
```

The file is a plain browser script loaded after `boss.js` and `battle.js`. It must not touch any other file, and must not define globals
other than its own `GALAXI_EVENTS.<name>` entry (wrap helpers inside the object or an IIFE).

## ctx

`{ turn, attack, foe, player, loop, story }` — `turn` is the turn object from `boss.turns` about to run (`turn.attack` is its attack name:
`pokeball`, `blasters`, `sonic`, `lorem`, `kablooey`, `theworld`, `mario`), `foe.hp / foe.max / foe.flags`, `player.hp / player.max /
player.items` (array of `{ name, heal, text }`), `loop` = how many times he's run out of attacks, `story` = story mode (dialogue on).
The lorem turn (`turn.sneak`) never gets events.

## fx

| call | what it does |
|---|---|
| `fx.lines(list)` | Galaxi says these (speech bubble, Z to advance) before the attack. Strings, or `{ text, shake: true }`. Wrap alternatives in `one(...)`. |
| `fx.attack(fn, { box: [w, h], time: ms })` | replace this turn's attack with `fn(a)` (same shape as the attacks in `boss.js`). `time` caps it; `a.end()` ends it early. |
| `fx.mods` | object for this attack: `speed` (whole attack runs this fast), `soulSpeed` (heart speed), `invert: true` (arrow keys reversed), `boxScale` (box size), `bulletScale` (hurting bullets bigger, hitbox too). |
| `fx.during(fn)` | `fn(a)` right after the attack starts: spawn extra bullets, `a.after(ms, ...)` timers, etc. |
| `fx.draw(fn, { menu })` | `fn(ctx, ms, state)` every frame on top of everything (canvas 640×480). `ms` = since the event started (game time). It fades out over 300ms once the event's attack is over; pass `{ menu: true }` to keep it up for the menu after. |
| `fx.zoom(k)` | camera zoom on the heart for this attack (stats and buttons stay put). |
| `fx.box` | the box: set `fx.box.ox / fx.box.oy` (px) to move it during the attack; it's put back after. Bullets don't move with it. |
| `fx.after(fn)` | `fn({ hits, damage, turn, draw })` after each attack (this one and later ones); return nothing to keep waiting, `{}` to give up, or `{ lines, replay: speed }` to say lines then replay the same attack at that speed. `draw(fn)` adds an overlay from that moment (for effects that start later than the event did). |
| `fx.menu(fn)` | `fn(labels)` at the next menu: rearrange the 4 labels (`["FIGHT","ACT","ITEM","MERCY"]`) in place; each button keeps working by its label. Put back after. |
| `fx.modal(update, draw)` | freeze the whole fight. `update(dt, input, m)` every frame until it returns `true`; `draw(ctx, m.t)` on top. `input`: `{ tapped(k), confirm, cancel, tap, pressed }` (keys: `"ArrowUp"` etc., `"z"`, `"x"`; `tap` = `{x, y}` canvas coords or null). |
| `fx.pause(ms, draw)` | freeze everything for `ms`, drawing `draw(ctx, t)`. |
| `fx.flavor(line)` | the narrator's menu line once the event's attack is over (`"* ..."`, or `one(...)`). **Every event sets one**, so the player always knows what just happened. |
| `fx.foeHeal(n)` | Galaxi heals n HP the readable way: heal sound, a green outlined `+n` above his head, his HP bar filling. Use this instead of touching `foe.hp`. |
| `fx.onPick(label, start)` | rig a menu button: the next time the player picks `label` (`"ITEM"` etc.) it costs their turn and `start(ctx, fx)` runs as the enemy turn's event (fresh fx: lines, attack, draw, flavor...). |
| `fx.buttons` | the 4 menu buttons `{ t, x, y, w, h }`; set `dx` / `dy` on one to nudge it (reset each enemy turn). |
| `fx.attack(fn, { solo: true })` | also drops the turn's story lines, so only the event's lines play. |
| line `{ text, at: fn }` | `fn()` runs the moment that line starts. Start an `fx.pause` cutscene there and the line's bubble waits until it's over. |
| `fx.foe`, `fx.player`, `fx.sfx`, `fx.play(src, vol)`, `fx.speak()`, `fx.story` | as in the engine. `fx.sfx`: `move`, `select`, `hit`, `hurt`, `heal`, `swing`, `crack`, `shatter`, `flee`, `charge`, `beam`. `fx.speak()` = one of Galaxi's voice blips. |
| `fx.heart(x, y, color)`, `fx.text(s, x, y, size, color, align, face)`, `fx.wrapText(s, width, size)` | draw helpers. Fonts: `"DTM-Mono"` (dialogue) or `"DTM-Sans"` (UI). |

Inside an attack, `a` is the attack api (see the top of `boss.js`): `a.box` (edges), `a.soul`, `a.bullet({...})`, `a.after`, `a.every`,
`a.random`, `a.resize`, `a.end`, `a.say(text, ms)` (a bubble mid-attack), `a.heal`, `a.damage(n)`, `a.images`, `a.play`, `a.sfx`, `a.foe()`.
A bullet with `damage: 0` never hurts; give a telegraph `tell: true` while it's about to hurt (the sim bot reads it).

## Screen layout (canvas 640×480)

Galaxi's sprite: centred on x 320, from y ~60 (head top) to y 212 (feet), mouth around (320, 120). His speech bubble: x 410-610, from
y 60. Damage / heal numbers: above his head (y 20-56). The free space for event UI is the **left** of him (x 20-240, y 20-200) and the
top-right corner above the bubble (y < 56). Never put text over his sprite. Box: bottom edge y 384, centred on x 320 (menu size 575×135).
Stats line y ~400-421. Buttons y 432, x 32 / 185 / 345 / 500, 110×42.

## Rare events

`rare: 0.4` on the event object: it's only in the running in 40% of fights (it still needs to be picked from the 3-4).

## Globals from boss.js you can use

`one(...)`, `any(list)` (no-repeat random), `V.<voiceline>` (Galaxi's recordings: `V.gobblegobble`, `V.yourekidding`, `V.eventuality`, …),
`STAR7` + `starPx(ctx, rows, k, color, ox, oy)` (his star in pixels), `TELL(ms)` (FFXIV-style flash: 0→1→0 over 360ms),
`starBlaster(a, x, y, ang, o)`, `SANS_SFX.impact / .flash`.

## Rules

- **Voice:** Galaxi's lines are short, cocky, then undercut ("I'm basically a pro." / "I think..."), "..." pauses, playful digs (nerd,
  tryhard, sweaty). Every line set wrapped in `one(...)` with 2–3 versions. No em dashes. Narrator box lines start with `"* "`.
- **Look:** pixel-crisp, white on black, UNDERTALE style. Whole-number scales, `ctx.imageSmoothingEnabled` stays false.
- **Fair:** anything that hurts has a tell first, hitboxes no bigger than what's drawn, a skilled player can dodge it.
- **No new files outside `assets/egg/events/`**, no edits to `battle.js` / `boss.js` / anything else. If you need an engine feature that
  isn't here, write it as a comment at the top of your file and work around it.
- Check syntax with `node --check <file>`. Don't open the browser (Claude is testing in it); the main session tests every event in the sim.

## Sprites

Editable PNGs live in `sprites/` (white/colour pixel art at 1x, edit them in Aseprite). Load one with `fx.sprite("name")` (cached) and
draw it once `.naturalWidth` is set, at a whole-number scale; keep a code-drawn fallback for the first frames while it loads.
`hand.png` (box grab, drawn 4x), `like-heart.png` (comments), `crash-icon.png`, `new-tag.png`, `skip-button.png`, `arrow-head.png` (thumbnail).
Keep the size (or update the draw call) so the anchor stays right.
