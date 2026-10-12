#!/usr/bin/env python3
"""tools/build-mario.py: draws Mario's level art from Galaxi's tiles (assets/egg/mario/tiles.png, 16px grid) and the 1-1 map in boss.js.

    python3 tools/build-mario.py        (after editing tiles.png)

tiles.png (column, row in 16px tiles):
  1-2,0  pipe top (2 wide)      1-2,1  pipe body (2 wide)      1,2 / 2,2 / 3,2  ground: left end, middle, right end
  4,2    used block             5,2    ? block                 5,1  heart (what a ? block gives)
  6,2    brick                  7,2    hard block (the stairs, the flagpole base)
Writes terrain.png (202 x 10 tiles: ground, pipes, stairs; the bricks and ? blocks are sprites since they can be hit) and
sprites.png (16x24 frames, block in the bottom 16 rows: 0 brick, 1 ?, 8 used, 9 heart; the other frames are left alone)."""
import re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "assets/egg/mario"
T = 16
tiles = Image.open(DIR / "tiles.png").convert("RGBA")
tile = lambda c, r, w=1: tiles.crop((c * T, r * T, (c + w) * T, (r + 1) * T))
src = (ROOT / "assets/egg/boss.js").read_text()
rows = re.findall(r'"([-XSQ?U<>\[\]E]{202})"', src[src.index("const WORLD_1_1"):])[4:]  # rows 0-3 are empty sky (boss.js drops them too)
assert len(rows) == 10, len(rows)

out = Image.new("RGBA", (202 * T, 10 * T))
for r, row in enumerate(rows):
    for c, ch in enumerate(row):
        x, y = c * T, r * T
        if ch == "X":
            if r == 9:  # the ground: rounded ends at the pits
                left, right = c == 0 or row[c - 1] != "X", c == 201 or row[c + 1] != "X"
                out.alpha_composite(tile(1 if left else 3 if right else 2, 2), (x, y))
            else:
                out.alpha_composite(tile(7, 2), (x, y))
        elif ch == "<":
            out.alpha_composite(tile(1, 0, 2), (x, y))
        elif ch == "[":
            out.alpha_composite(tile(1, 1, 2), (x, y))
out.save(DIR / "terrain.png")

old = Image.open(DIR / "sprites.png").convert("RGBA")
sp = Image.new("RGBA", (10 * T, 24))
sp.alpha_composite(old, (0, 0))
for i, (c, r) in {0: (6, 2), 1: (5, 2), 8: (4, 2), 9: (5, 1)}.items():
    sp.paste(Image.new("RGBA", (T, 24)), (i * T, 0))
    sp.alpha_composite(tile(c, r), (i * T, 8))
sp.save(DIR / "sprites.png")
print("wrote terrain.png and sprites.png")
