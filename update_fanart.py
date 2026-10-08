"""Build fanart.json from assets/fanart/<platform>@<handle>/ folders.

One folder per artist, e.g. assets/fanart/discord@teeth.ling/ or assets/fanart/x@someone/.
Platforms with an icon on the site: discord, x, instagram, tiktok, youtube (anything else shows a plain @).
Pinned artists first (PINNED), then A-Z by handle; art A-Z by filename (git checkouts reset file dates, so dates are not usable).
Favourites: move a piece into the artist's "starred" subfolder; starred art is listed first and gets a star badge on the site. Runs on push via .github/workflows/update-videos.yml.
"""
import json
from pathlib import Path

ROOT = Path(__file__).parent
IMAGES = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
PINNED = ["teeth.ling"]  # always shown first, in this order


def build():
    artists = []
    for folder in sorted((ROOT / "assets" / "fanart").glob("*@*")):
        if not folder.is_dir():
            continue
        platform, handle = folder.name.split("@", 1)
        pics = lambda d: sorted(f for f in d.iterdir() if f.suffix.lower() in IMAGES) if d.is_dir() else []
        starred, rest = pics(folder / "starred"), pics(folder)
        if starred or rest:
            artists.append({"platform": platform.lower(), "handle": handle,
                            "starred": [f.relative_to(ROOT).as_posix() for f in starred],
                            "images": [f.relative_to(ROOT).as_posix() for f in starred + rest]})
    pin = lambda a: PINNED.index(a["handle"]) if a["handle"] in PINNED else len(PINNED)
    # pinned first, then artists with 2+ pieces (own rows), then single pieces (they share rows on the site)
    return sorted(artists, key=lambda a: (pin(a), len(a["images"]) < 2, a["handle"].lower()))


if __name__ == "__main__":
    (ROOT / "fanart.json").write_text(json.dumps(build(), indent=1) + "\n")
    # self-check: folder name parsing keeps dots/underscores in handles
    assert "discord@teeth.ling".split("@", 1) == ["discord", "teeth.ling"]
