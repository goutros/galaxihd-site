"""Refresh videos.json (GalaxiHD long-forms), shorts.json (newest 7 Shorts) and clients.json (client videos crediting @GalaxiHD).

Runs daily from GitHub Actions; standard library only.
ponytail: YouTube RSS returns the newest 15 videos per feed, so videos.json holds the latest 15
long-forms. clients.json accumulates, so older client videos stay once found; all their view counts
refresh daily from each watch page (a failed read keeps the last known count).
"""
import json
import re
import time
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).parent
GALAXIHD = "UCwywZS4y7ExtoSBUxZDgC3Q"
CLIENTS = {"CurseForge": "UCR8UEiShOYvi7dNby2DNY9A"}
TAGS = ("@galaxihd", "@goutros")  # credited as @Goutros before the rename (Oct 2024 to Aug 2025)
NS = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015", "media": "http://search.yahoo.com/mrss/"}


def longforms(channel_id, kind="UULF"):
    # UULF playlist = a channel's public long-form uploads (no Shorts, no lives); UUSH = its Shorts
    url = f"https://www.youtube.com/feeds/videos.xml?playlist_id={kind}{channel_id[2:]}"
    for attempt in range(8):  # YouTube's feed endpoint randomly 404s/500s; it answers on a retry
        try:
            root = ET.fromstring(urllib.request.urlopen(url, timeout=30).read())
            break
        except urllib.error.HTTPError:
            if attempt == 7:
                raise
            time.sleep(10)
    for e in root.findall("a:entry", NS):
        yield {
            "id": e.find("yt:videoId", NS).text,
            "title": e.find("a:title", NS).text,
            "published": e.find("a:published", NS).text[:10],
            "description": e.find("media:group/media:description", NS).text or "",
            "views": int(e.find("media:group/media:community/media:statistics", NS).get("views", 0)),
        }


def feed(channel_id, kind="UULF"):
    """longforms() as a list, or None if YouTube's feed stays down: that part keeps yesterday's file, the rest still runs."""
    try:
        return list(longforms(channel_id, kind))
    except urllib.error.HTTPError:
        return None


def live_views(video_id):
    """Current view count from the watch page (the RSS feed only covers a channel's newest 15). None if YouTube won't say."""
    req = urllib.request.Request(f"https://www.youtube.com/watch?v={video_id}", headers={"User-Agent": "Mozilla/5.0", "Accept-Language": "en"})
    try:
        m = re.search(r'"videoDetails":\{.*?"viewCount":"(\d+)"', urllib.request.urlopen(req, timeout=30).read().decode())
        return int(m.group(1)) if m else None
    except Exception:  # one bad page must not stop the daily run; that video keeps its last known count
        return None


def refresh(views):
    """{id: views} -> same dict with live counts, 8 pages at a time; a failed read or a lower number keeps the old count."""
    with ThreadPoolExecutor(8) as ex:
        for i, n in zip(list(views), ex.map(live_views, list(views))):
            if n and n >= views[i]:
                views[i] = n
    return views


def save(name, items):
    (HERE / name).write_text(json.dumps(items, indent=1, ensure_ascii=False) + "\n")


def main():
    keep = ("id", "title", "published", "views")
    mine = feed(GALAXIHD)
    if mine is not None:
        save("videos.json", [{k: v[k] for k in keep} for v in mine])
    my_shorts = feed(GALAXIHD, "UUSH")
    if my_shorts is not None:
        save("shorts.json", [{k: v[k] for k in keep} for v in my_shorts][:7])  # 2 pages of 4: 7 Shorts + the YouTube button

    path = HERE / "clients.json"
    known = {v["id"]: v for v in (json.loads(path.read_text()) if path.exists() else [])}
    for client, cid in CLIENTS.items():
        for v in feed(cid) or []:
            if any(t in v["description"].lower() for t in TAGS):
                known[v["id"]] = {"id": v["id"], "title": v["title"], "published": v["published"], "views": v["views"], "client": client}
    fresh = refresh({i: v.get("views", 0) for i, v in known.items()})  # every client video, not just the newest 15
    for i, v in known.items():
        v["views"] = fresh[i]
    save("clients.json", sorted(known.values(), key=lambda v: v["published"], reverse=True))

    # client Shorts carry no credit, so they're hand-picked (Galaxi went through all CurseForge Shorts once, 2026-10-08);
    # new ones get added by hand. Only their view counts refresh here. Kept out of clients.json so the video grids skip them.
    path = HERE / "client_shorts.json"
    shorts = json.loads(path.read_text()) if path.exists() else []
    fresh = refresh({v["id"]: v.get("views", 0) for v in shorts})
    for v in shorts:
        v["views"] = fresh[v["id"]]
    save("client_shorts.json", shorts)

    # stats.json: the headline numbers on the site. views_all = channel lifetime views (About page, exact) + every client
    # video and Short; views_longform = the same without Shorts: own long-forms + client long-forms.
    # own_longforms holds every GalaxiHD long-form id -> views; new uploads join from the feed, all refresh from watch pages.
    path = HERE / "stats.json"
    stats = json.loads(path.read_text()) if path.exists() else {}
    own = stats.get("own_longforms", {})
    for v in mine or []:
        own.setdefault(v["id"], v["views"])
    refresh(own)
    channel = stats.get("channel_views", 0)
    try:
        req = urllib.request.Request(f"https://www.youtube.com/channel/{GALAXIHD}/about", headers={"User-Agent": "Mozilla/5.0", "Accept-Language": "en"})
        m = re.search(r'"viewCountText":"([\d,]+) views"', urllib.request.urlopen(req, timeout=30).read().decode())
        if m and int(m.group(1).replace(",", "")) >= channel:
            channel = int(m.group(1).replace(",", ""))
    except Exception:
        pass  # keep yesterday's figure
    client_lf = sum(v["views"] for v in known.values())
    stats = {
        "views_all": channel + client_lf + sum(v["views"] for v in shorts),
        "views_longform": sum(own.values()) + client_lf,
        "channel_views": channel,
        "own_longforms": own,
    }
    save("stats.json", stats)


if __name__ == "__main__":
    main()
