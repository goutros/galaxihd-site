const ME = new URL(document.currentScript.src), ROOT = new URL(".", ME).href; // site.js sits at the site root: every page finds assets from here
const BUILD = ME.search; // "?v=..." from the page's own <script> tag, passed on to the egg scripts so a new publish is never served stale
// video grids: skeleton tiles while loading, thumbnails fade in, the YouTube player only loads on click.
// One video plays at a time; it opens full-width in the top row of its box, the other tiles slide around
// it (FLIP), then the page scrolls to centre it. Rows are always filled: tiles that would leave a gap stay hidden.
(() => {
  // per grid: data-src (one or more JSON lists, comma-separated, merged newest first),
  // data-show (how many to show collapsed, default 6), data-limit (max to load), data-expand="false" (no Show all)
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fmt = d => new Date(d).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  const views = n => new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n);
  // a tile's caption: the title (its own span, so phones can cut it to 2 lines) and "date · views" (phones show just the views)
  const caption = (title, v) => {
    const cap = document.createElement("figcaption"), t = document.createElement("time");
    cap.append(Object.assign(document.createElement("span"), { className: "vt", textContent: title }));
    t.dateTime = v.published;
    t.append(Object.assign(document.createElement("span"), { className: v.views ? "on-desktop" : "", textContent: fmt(v.published) + (v.views ? " · " : "") }), v.views ? `${views(v.views)} views` : "");
    cap.append(t); return cap;
  };
  const cols = grid => getComputedStyle(grid).gridTemplateColumns.split(" ").length;
  let current = null; // the open <figure>

  function thumb(fig) {
    const v = fig.video, b = document.createElement("button");
    b.className = "thumb"; b.setAttribute("aria-label", "Play: " + v.title);
    const img = new Image(); img.alt = ""; img.decoding = "async"; img.loading = "lazy";
    img.onload = () => { img.classList.add("ready"); b.classList.add("ready"); };
    img.src = `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;
    b.append(img); b.onclick = () => play(fig);
    return b;
  }

  function player(v) {
    const wrap = document.createElement("div"); wrap.className = "player";
    const f = document.createElement("iframe");
    f.src = `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&enablejsapi=1`;
    f.title = v.title; f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen"; f.allowFullscreen = true;
    f.style.opacity = 0; f.style.transition = "opacity .3s ease";
    // the iframe never reports the mouse, so a clear shield over the picture keeps the star cursor alive there.
    // Click = play/pause, double-click = fullscreen (via YouTube's postMessage API); the control bar stays uncovered.
    const shield = document.createElement("div"); shield.className = "shield";
    const send = (event, func) => f.contentWindow.postMessage(JSON.stringify({ event, func, args: [], id: v.id }), "*");
    let playing = true;
    shield.onclick = () => send("command", playing ? "pauseVideo" : "playVideo");
    shield.ondblclick = () => f.requestFullscreen?.();
    const hear = e => {
      if (!f.isConnected) return removeEventListener("message", hear);
      if (e.source !== f.contentWindow) return;
      try { const s = JSON.parse(e.data).info?.playerState; if (s != null) playing = s === 1 || s === 3; } catch {}
    };
    addEventListener("message", hear);
    f.onload = () => { f.style.opacity = 1; wrap.style.animation = "none"; send("listening"); };
    wrap.append(f, shield); return wrap;
  }

  // show only as many tiles as fill complete rows (the open video takes a whole row by itself)
  function layout(grid) {
    const c = cols(grid), others = grid.tiles.filter(f => f !== current);
    const full = Math.floor(others.length / c) * c;
    const cap = Math.min(Math.ceil(grid.show / c) * c, full) || others.length;
    const want = grid.expanded ? full || others.length : cap;
    others.forEach((f, i) => f.hidden = i >= want);
    if (current && current.parentElement === grid) current.hidden = false;
    if (grid.more) { grid.more.hidden = others.length <= cap; grid.more.textContent = grid.expanded ? "Show less" : `Show all ${grid.tiles.length}`; }
    if (grid.yt) grid.yt.hidden = !grid.expanded;
  }

  function play(fig) {
    const grids = new Set([fig.parentElement, current && current.parentElement].filter(Boolean));
    const tiles = [...grids].flatMap(g => g.tiles.filter(t => !t.hidden));
    const first = new Map(tiles.map(el => [el, el.getBoundingClientRect()]));
    const r0 = first.get(fig), centreY = r0.top + r0.height / 2;
    const swap = current && current.parentElement === fig.parentElement; // player already open in this box

    if (current) { current.classList.remove("open"); current.firstChild.replaceWith(thumb(current)); }
    fig.firstChild.replaceWith(player(fig.video)); fig.classList.add("open");
    current = fig;
    grids.forEach(layout);

    // swapping inside one box: the player stays put (top row), box height is unchanged, so the page doesn't move
    if (!swap) { const r1 = fig.getBoundingClientRect(); scrollBy({ top: r1.top + r1.height / 2 - centreY, behavior: "instant" }); } // start level with the click
    glide([...grids].flatMap(g => g.tiles), first, fig, swap);
  }

  // One animation drives everything: tiles slide/grow from where they were (FLIP) while the page
  // scrolls to centre the player, on the same curve and clock, so it reads as a single motion.
  let run = 0;
  function glide(tiles, first, fig, still) {
    const id = ++run, last = new Map();
    tiles.forEach(el => { el.style.transform = el.style.opacity = ""; const b = el.getBoundingClientRect(); if (b.width) last.set(el, b); });
    const p = fig.firstChild.getBoundingClientRect(), from = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    const mid = innerHeight / 2;
    const to = still ? from : Math.max(0, Math.min(max, from + p.top + p.height / 2 - mid));
    if (calm) return scrollTo({ top: to, behavior: "instant" });
    const ease = t => 1 - (1 - t) ** 3, t0 = performance.now(), D = 450;
    const frame = now => {
      if (id !== run) return; // a newer click took over
      const t = Math.min(1, (now - t0) / D), k = 1 - ease(t);
      last.forEach((b, el) => {
        const a = first.get(el);
        if (a) el.style.transform = `translate(${k * (a.left - b.left)}px, ${k * (a.top - b.top)}px) scale(${1 + k * (a.width / b.width - 1)}, ${1 + k * (a.height / b.height - 1)})`;
        else { el.style.opacity = 1 - k; el.style.transform = `scale(${1 - k * .1})`; }
      });
      scrollTo({ top: to + (from - to) * k, behavior: "instant" });
      if (t < 1) requestAnimationFrame(frame);
      else last.forEach((b, el) => el.style.transform = el.style.opacity = "");
    };
    requestAnimationFrame(frame);
  }

  // shorts strip: tiles go in front of the YouTube button. Only the newest Short autoplays (muted, looping) while it's in view;
  // clicking any Short plays it with sound and stops the one before.
  // Scrolled out of view = back to the thumbnail. Reduced motion: no autoplay. Players load behind the same shimmer as the video grids.
  document.querySelectorAll(".shorts[data-src]").forEach(async strip => {
    const yt = strip.lastElementChild; yt.hidden = true;
    strip.prepend(...Array.from({ length: 4 }, () => Object.assign(document.createElement("figure"), { className: "vid skel-tile", innerHTML: '<div class="thumb skel"></div><div class="skel skel-line"></div>' })));
    let list;
    try { list = (await (await fetch(strip.dataset.src, { cache: "no-store" })).json()).slice(0, 7); }
    catch { strip.closest("section").hidden = true; return; }
    let active = null;
    const stop = fig => { fig.firstChild.replaceWith(fig.thumbBtn); if (active === fig) active = null; };
    // no YouTube UI: controls=0, captions forced off, our own layer on top (click = pause/play, no on-screen icon, Galaxi's call) plus a mute button,
    // both driven through YouTube's postMessage API. The iframe is taller than its box (CSS) so the title bar and logo
    // YouTube always draws at its top/bottom edges get cropped off. Looping is done here: loop=1 needs a playlist,
    // which brings back prev/next buttons.
    const speaker = q => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/>${q ? '<path d="m16 9.5 5 5m0-5-5 5"/>' : '<path d="M16 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>'}</svg>`;
    const embed = (fig, muted) => {
      if (active && active !== fig) stop(active);
      const v = fig.video, w = document.createElement("div"); w.className = "sp skel";
      const f = document.createElement("iframe");
      f.src = `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&playsinline=1&controls=0&disablekb=1&cc_load_policy=0&iv_load_policy=3&rel=0&enablejsapi=1` + (muted ? "&mute=1" : "");
      f.title = v.title; f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen"; f.tabIndex = -1;
      f.style.opacity = 0; f.style.transition = "opacity .3s ease";
      const post = msg => f.contentWindow?.postMessage(JSON.stringify(msg), "*");
      const send = (func, args = []) => post({ event: "command", func, args, id: v.id });
      let paused = false, quiet = muted;
      const pause = document.createElement("button"); pause.className = "shield"; pause.setAttribute("aria-label", "Pause: " + v.title);
      pause.onclick = () => {
        paused = !paused; send(paused ? "pauseVideo" : "playVideo");
        pause.setAttribute("aria-label", (paused ? "Play: " : "Pause: ") + v.title);
      };
      const mute = document.createElement("button"); mute.className = "mute";
      const draw = () => { mute.innerHTML = speaker(quiet); mute.setAttribute("aria-label", quiet ? "Unmute" : "Mute"); };
      mute.onclick = () => { quiet = !quiet; send(quiet ? "mute" : "unMute"); draw(); };
      draw();
      // the captions module loads when playback starts, so switch it off on every "playing" report too
      const hear = e => {
        if (!f.isConnected) return removeEventListener("message", hear);
        if (e.source !== f.contentWindow) return;
        try {
          const st = JSON.parse(e.data).info?.playerState;
          if (st === 1) { send("unloadModule", ["captions"]); show(); }
          if (st === 0) { send("seekTo", [0, true]); send("playVideo"); } // ended: loop
        } catch {}
      };
      addEventListener("message", hear);
      // stay behind the shimmer until YouTube reports "playing", so its own loading screen (thumbnail + icon) never shows;
      // 8s fallback in case the player never starts
      const show = () => { f.style.opacity = 1; w.classList.remove("skel"); };
      f.onload = () => { post({ event: "listening", id: v.id }); send("unloadModule", ["captions"]); setTimeout(show, 8000); };
      w.append(f, pause, mute);
      fig.firstChild.replaceWith(w); active = fig;
    };
    let first;
    const seen = new IntersectionObserver(es => es.forEach(e => {
      const fig = e.target, on = fig.querySelector("iframe");
      if (!e.isIntersecting && on) stop(fig);
      else if (e.isIntersecting && fig === first && !active && !calm) embed(fig, true);
    }), { threshold: .6 });
    strip.querySelectorAll(".skel-tile").forEach(t => t.remove());
    strip.prepend(...list.map(v => {
      const fig = document.createElement("figure"); fig.className = "vid"; fig.video = v;
      const cap = caption(v.title.replace(/\s*#\S+/g, ""), v); // hashtags are for YouTube search, not the tile
      const b = thumb(fig); b.onclick = () => embed(fig, false);
      fig.thumbBtn = b; fig.append(b, cap); seen.observe(fig);
      return fig;
    }));
    first = strip.firstElementChild;
    yt.hidden = false;
    // < > page by one view's width (4 on desktop); swiping/trackpad scroll still works, the snap keeps pages aligned
    const btns = strip.closest("section").querySelectorAll(".pg");
    const edge = () => { const end = strip.scrollWidth - strip.clientWidth - 2; btns[0].disabled = strip.scrollLeft <= 2; btns[1].disabled = strip.scrollLeft >= end; };
    btns.forEach(b => b.onclick = () => strip.scrollBy({ left: b.dataset.dir * (strip.clientWidth + 12), behavior: calm ? "instant" : "smooth" }));
    strip.addEventListener("scroll", edge, { passive: true }); edge();
  });

  document.querySelectorAll(".grid[data-src]").forEach(async grid => {
    grid.show = +(grid.dataset.show || 6);
    // placeholder tiles until the list arrives
    grid.innerHTML = '<figure class="vid"><div class="thumb skel"></div><div class="skel skel-line"></div><div class="skel skel-line short"></div></figure>'.repeat(Math.ceil(grid.show / cols(grid)) * cols(grid));
    let list;
    try {
      const lists = await Promise.all(grid.dataset.src.split(",").map(async u => (await fetch(u.trim(), { cache: "no-store" })).json()));
      const seen = new Set();
      list = lists.flat().sort((a, b) => b.published.localeCompare(a.published)).filter(v => !seen.has(v.id) && seen.add(v.id));
      if (grid.dataset.limit) list = list.slice(0, +grid.dataset.limit);
    } catch { grid.innerHTML = ""; return; }
    grid.tiles = list.map(v => {
      const fig = document.createElement("figure"); fig.className = "vid"; fig.video = v;
      const cap = caption(v.title, v);
      fig.append(thumb(fig), cap);
      return fig;
    });
    grid.replaceChildren(...grid.tiles);
    if (grid.dataset.expand !== "false") {
      grid.more = document.createElement("button"); grid.more.className = "pill more";
      grid.more.onclick = () => {
        const h0 = grid.offsetHeight, was = new Set(grid.tiles.filter(t => !t.hidden));
        grid.expanded = !grid.expanded;
        if (!grid.expanded && current) { // Show less also closes whatever video is playing, in any box
          const g = current.parentElement;
          current.classList.remove("open"); current.firstChild.replaceWith(thumb(current)); current = null;
          if (g !== grid) layout(g);
        }
        layout(grid);
        if (!calm) { // box eases to its new height; newly shown tiles (and the YouTube button) fade and scale in
          const ease = "cubic-bezier(.22, 1, .36, 1)";
          grid.style.overflow = "hidden";
          grid.animate([{ height: h0 + "px" }, { height: grid.offsetHeight + "px" }], { duration: 450, easing: ease })
            .onfinish = () => grid.style.overflow = "";
          [...grid.tiles.filter(t => !t.hidden && !was.has(t)), ...(grid.expanded && grid.yt ? [grid.yt] : [])].forEach((el, i) =>
            el.animate([{ opacity: 0, transform: "scale(.96)" }, { opacity: 1, transform: "none" }],
              { duration: 400, delay: Math.min(i * 25, 250), easing: ease, fill: "backwards" }));
        }
        if (!grid.expanded) grid.closest("section").scrollIntoView({ block: "start" }); // don't strand the reader below a shrunk box
      };
      grid.after(grid.more);
      if (grid.dataset.yt) { // data-yt: where "Continue on YouTube" goes, shown only while expanded
        grid.yt = document.createElement("a"); grid.yt.className = "pill more social yt"; grid.yt.href = grid.dataset.yt;
        grid.yt.target = "_blank"; grid.yt.rel = "noopener";
        grid.yt.innerHTML = document.querySelector("#ytLogo").innerHTML + "Continue on YouTube";
        grid.after(grid.yt);
      }
    }
    layout(grid);
    addEventListener("resize", () => layout(grid));
  });
})();

// sidebar menu: the button toggles it; jumping to a section keeps it open, going to another page closes it
// (every page loads closed). On phones it's a pop-over that also closes on an outside tap or Esc
(() => {
  const root = document.documentElement, btn = document.getElementById("menuBtn"), panel = document.getElementById("panel");
  const phone = matchMedia("(width < 800px)");
  const isOpen = () => root.classList.contains("menu-open");
  const set = open => { root.classList.toggle("menu-open", open); btn.setAttribute("aria-expanded", open); };
  btn.onclick = () => { panel.classList.add("anim"); set(!isOpen()); };
  panel.addEventListener("click", e => { const a = e.target.closest("a"); if (a && !a.classList.contains("sec")) set(false); }); // a page link closes it, a section link keeps it open
  document.addEventListener("click", e => { if (phone.matches && isOpen() && !panel.contains(e.target) && !btn.contains(e.target)) set(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && phone.matches && isOpen()) { set(false); btn.focus(); } });
  phone.addEventListener("change", () => { if (phone.matches) root.classList.remove("menu-open"); });
})();


// Mario Galaxy-style pointer: an upright pixel star (sways with movement) replaces the mouse cursor and sheds a few
// twinkling star sprites as it moves. On touch screens there's no star cursor: dragging a finger (scrolling included) sheds the sparkles.
(() => {
  const fine = matchMedia("(pointer: fine)").matches, calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!fine && calm) return;
  const base = ROOT + "assets/";
  const star = new Image(); star.src = base + "cursor-star.png"; star.alt = ""; star.id = "cursor";
  if (fine) { document.body.append(star); document.documentElement.classList.add("star-cursor"); }

  const c = document.getElementById("fx"), x = c.getContext("2d");
  const sprites = ["star-s", "star-s", "star-s", "star-m"].map(n => Object.assign(new Image(), { src: base + n + ".png" }));
  const bits = [];
  let px = -99, py = -99, running = false, carry = 0, settle;
  const size = () => { c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio; x.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); x.imageSmoothingEnabled = false; };
  addEventListener("resize", size); size();

  addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    star.style.translate = `${e.clientX}px ${e.clientY}px`; // position via `translate` so the CSS `rotate` spin stays centred
    star.classList.add("on");
    star.classList.toggle("hot", !!e.target.closest("a, button, [role=button]"));
    if (calm) return;
    // sway: lean toward the direction of travel, settle upright when the mouse stops
    if (px >= 0) star.style.rotate = `${Math.max(-18, Math.min(18, (e.clientX - px) * 1.2))}deg`;
    clearTimeout(settle); settle = setTimeout(() => star.style.rotate = "0deg", 90);
    shed(e.clientX, e.clientY);
  });
  // a few sparkles per distance travelled, so a slow drift barely sheds and a quick flick glitters
  function shed(cx, cy) {
    carry += Math.hypot(cx - px, cy - py) / 38;
    if (px < 0) carry = 0;
    for (; carry >= 1; carry--) bits.push({
      img: sprites[Math.random() * 4 | 0], x: cx + (Math.random() - .5) * 14, y: cy + (Math.random() - .5) * 14,
      vx: (Math.random() - .5) * .6, vy: .2 + Math.random() * .5, life: 1, spin: Math.random() * 6
    });
    px = cx; py = cy;
    if (!running && bits.length) { running = true; requestAnimationFrame(tick); }
  }
  // touch: touchmove keeps firing while the page scrolls under the finger (pointermove stops), and passive never blocks the scroll
  if (!calm) {
    addEventListener("touchstart", e => { px = py = -99; shed(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    addEventListener("touchmove", e => shed(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  }
  // fade out over the YouTube player and when leaving the window: a cross-origin iframe never reports the mouse
  // position, so the star can't follow inside it; the player shows the normal cursor instead
  document.addEventListener("mouseout", e => {
    if (!e.relatedTarget || e.relatedTarget.tagName === "IFRAME") { star.classList.remove("on"); px = py = -99; }
  });

  function tick() {
    x.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i]; b.life -= .022; b.x += b.vx; b.y += b.vy; b.spin += .25;
      if (b.life <= 0) { bits.splice(i, 1); continue; }
      x.globalAlpha = b.life * (.55 + .45 * Math.abs(Math.sin(b.spin))); // twinkle as it fades
      const s = b.img.naturalWidth * 3;
      if (s) x.drawImage(b.img, Math.round(b.x - s / 2), Math.round(b.y - s / 2), s, s);
    }
    x.globalAlpha = 1;
    if (bits.length) requestAnimationFrame(tick); else running = false;
  }
})();

// keep stat numbers that come from a list (e.g. client video count) up to date
document.querySelectorAll("[data-count]").forEach(async el => {
  try {
    const lists = await Promise.all(el.dataset.count.split(",").map(async u => (await fetch(u.trim(), { cache: "no-store" })).json()));
    const n = lists.flat().length;
    el.textContent = n >= 10 ? Math.floor(n / 5) * 5 + "+" : n; // round down to a safe "45+" style figure
  } catch {}
});

// headline view numbers from stats.json (update_videos.py, refreshed daily): data-key picks the figure. 3 significant
// figures rounded down (1.14M, 11.4M, 114M) so it never overstates; the big one rolls up from 0 when it first scrolls
// into view and hovering its tile shows the exact total. data-plain = just the short figure, no roll or hover.
document.querySelectorAll("[data-stat]").forEach(async el => {
  let n;
  try { n = (await (await fetch(el.dataset.stat, { cache: "no-store" })).json())[el.dataset.key]; } catch { return; }
  if (!n) return;
  const short = x => {
    const [d, u] = x >= 1e9 ? [1e9, "B"] : x >= 1e6 ? [1e6, "M"] : x >= 1e3 ? [1e3, "K"] : [1, ""], v = x / d;
    const dp = d === 1 ? 0 : v < 10 ? 2 : v < 100 ? 1 : 0, p = 10 ** dp;
    return (Math.floor(v * p) / p).toFixed(dp) + u; // toFixed keeps the trailing zero: 8.30M, not 8.3M
  };
  if ("plain" in el.dataset) return el.textContent = short(n);
  let hover = false, now = n; const tile = el.closest(".stats > div") || el.parentElement;
  const draw = x => { now = x; el.textContent = hover ? x.toLocaleString("en") : short(x); };
  tile.addEventListener("mouseenter", () => { hover = true; draw(now); });
  tile.addEventListener("mouseleave", () => { hover = false; draw(now); });
  tile.title = n.toLocaleString("en") + " views";
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return draw(n);
  new IntersectionObserver(([e], o) => {
    if (!e.isIntersecting) return; o.disconnect();
    const t0 = performance.now(), f = t => { const k = Math.min(1, (t - t0) / 2000); draw(Math.round(n * (1 - (1 - k) ** 3))); if (k < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }).observe(el);
});

// Minecraft-style night sky: pixel star sprites at random spots, spaced out so they rarely overlap,
// each twinkling on its own slow clock. Positions are in % so they survive window resizes.
(() => {
  const sky = document.createElement("div"); sky.id = "stars"; sky.setAttribute("aria-hidden", "true");
  document.body.prepend(sky);
  const base = ROOT + "assets/";
  const sprites = [["star-s", 3, 6], ["star-m", 5, 3], ["star-l", 7, 1]]; // name, pixel size, weight (small ones most common)
  const pick = () => { let r = Math.random() * 10; for (const s of sprites) if ((r -= s[2]) < 0) return s; return sprites[0]; };
  const W = innerWidth, H = innerHeight, n = Math.round(W * H / 14000), gap = 56, placed = [];
  for (let tries = 0; placed.length < n && tries < n * 30; tries++) {
    const x = Math.random() * W, y = Math.random() * H;
    if (placed.some(p => (p.x - x) ** 2 + (p.y - y) ** 2 < gap * gap)) continue; // keep stars apart
    placed.push({ x, y });
    const [name, px] = pick(), img = new Image();
    img.src = base + name + ".png"; img.alt = "";
    img.width = img.height = px * 3; // 3x nearest-neighbour
    img.style.cssText = `left:${x / W * 100}%;top:${y / H * 100}%;--o:${(.5 + Math.random() * .5).toFixed(2)};--d:${(2.5 + Math.random() * 4).toFixed(1)}s;--delay:-${(Math.random() * 6).toFixed(1)}s`;
    sky.append(img);
  }
})();

// Discord bar: a few of the page's twinkling stars, gold, scattered behind the text
document.querySelectorAll(".discord.galaxi").forEach(bar => {
  const base = ROOT + "assets/discord/";
  const sky = document.createElement("span"); sky.className = "gx-sky"; sky.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 9; i++) {
    const [name, px] = [["star-s", 3], ["star-s", 3], ["star-m", 5], ["star-l", 7]][i % 4], img = new Image();
    img.src = base + name + "-gold.png"; img.alt = ""; img.width = img.height = px * 3;
    img.style.cssText = `left:${(i + .2 + Math.random() * .6) / 9 * 100}%;top:${10 + Math.random() * 70}%;--o:${(.45 + Math.random() * .4).toFixed(2)};--d:${(2.5 + Math.random() * 4).toFixed(1)}s;--delay:-${(Math.random() * 6).toFixed(1)}s`;
    sky.append(img);
  }
  bar.prepend(sky);
});

// glass cards: a soft light follows the mouse across the card
document.querySelectorAll(".glass").forEach(card => card.addEventListener("pointermove", e => {
  const r = card.getBoundingClientRect();
  card.style.setProperty("--mx", e.clientX - r.left + "px"); card.style.setProperty("--my", e.clientY - r.top + "px");
}));

// brand logos: once they don't fit the card, duplicate the row and loop it as a carousel
document.querySelectorAll(".brand-row").forEach(row => {
  if (row.scrollWidth <= row.parentElement.clientWidth) return;
  row.append(...[...row.children].map(li => Object.assign(li.cloneNode(true), { ariaHidden: "true" })));
  row.classList.add("scroll");
});

// creator pfps: tooltip + label from the link's @ and data-subs, size by audience (1x, 1.2x at 100K+, 1.5x at 1M+)
document.querySelectorAll(".creators li[data-subs]").forEach(li => {
  const a = li.querySelector("a"), subs = +li.dataset.subs, at = "@" + a.href.split("@").pop().replace(/\/.*/, "");
  const n = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(subs) + " subscribers";
  li.style.setProperty("--s", subs >= 1e6 ? 1.5 : subs >= 1e5 ? 1.2 : 1);
  a.setAttribute("aria-label", `${at}${li.hasAttribute("data-verified") ? " (verified)" : ""}, ${n}`);
  a.insertAdjacentHTML("beforeend", `<span class="tip">${at}<small>${n}</small></span>`);
  if (li.hasAttribute("data-verified")) a.insertAdjacentHTML("beforeend", '<svg class="tick" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#1d9bf0"/><path d="m7 12.5 3.2 3.2L17 9" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>');
});

// creator cloud: rows alternate long/short (honeycomb feel), every pfp the same gap apart, each row centred
const scatter = ul => {
  const items = [...ul.children], W = ul.clientWidth, gap = 16;
  const ws = items.map(li => li.offsetWidth), hs = items.map(li => li.offsetHeight), maxH = Math.max(...hs);
  const avg = ws.reduce((a, b) => a + b, 0) / ws.length, cols = Math.max(2, Math.floor((W + gap) / (avg + gap)));
  let i = 0, r = 0, y = 34;
  while (i < items.length) {
    let per = Math.min(cols - (r % 2), items.length - i);
    while (per > 1 && ws.slice(i, i + per).reduce((a, b) => a + b, 0) + gap * (per - 1) > W) per--; // big pfps: fit the row
    const row = items.slice(i, i + per), rowW = ws.slice(i, i + per).reduce((a, b) => a + b, 0) + gap * (per - 1);
    let x = (W - rowW) / 2;
    row.forEach((li, c) => { li.style.animationDelay = -((i + c) * .9 % 4) + "s"; li.style.left = x + "px"; li.style.top = y + (maxH - hs[i + c]) / 2 + "px"; x += ws[i + c] + gap; });
    i += per; r++; y += maxH + gap * .75;
  }
  ul.style.height = y - gap * .75 + 4 + "px";
};
document.querySelectorAll(".creators").forEach(ul => {
  if (!ul.children.length) return;
  scatter(ul); addEventListener("resize", () => scatter(ul));
});

// live subscriber count (socialcounts.org estimate, no key needed). Rolls up from 0 the first time it's on screen,
// then polls every 15s and only ever rolls UP while you watch. Coming back to the tab (or reloading) shows the
// accurate number even if it dropped. If the API is down the static "32K+" stays.
document.querySelectorAll("[data-live]").forEach(el => {
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // 32.2K / 322K / 3.2M / 32M (one decimal under 100K and under 10M), rounded down so it never overstates; hovering shows the exact estimate
  const short = n => {
    const [d, u] = n >= 1e6 ? [1e6, "M"] : n >= 1e3 ? [1e3, "K"] : [1, ""], v = n / d, p = v < (u === "M" ? 10 : 100) && d > 1 ? 10 : 1;
    return Math.floor(v * p) / p + u;
  };
  let shown = 0, raf, seen = false, pending = 0, hover = false;
  const fmt = n => hover ? n.toLocaleString("en") : short(n);
  el.parentElement.addEventListener("mouseenter", () => { hover = true; if (shown) el.textContent = fmt(shown); });
  el.parentElement.addEventListener("mouseleave", () => { hover = false; if (shown) el.textContent = fmt(shown); });
  const set = n => { cancelAnimationFrame(raf); shown = n; el.textContent = fmt(n); };
  const roll = (to, ms) => {
    if (calm) return set(to);
    cancelAnimationFrame(raf);
    const from = shown, t0 = performance.now();
    const f = now => {
      const k = Math.min(1, (now - t0) / ms);
      shown = Math.round(from + (to - from) * (1 - (1 - k) ** 3)); el.textContent = fmt(shown);
      if (k < 1) raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
  };
  const show = (n, accurate) => {
    if (!seen) return pending = n; // wait until it scrolls into view so the first roll-up is actually seen
    if (!shown) roll(n, 1800); else if (n > shown) roll(n, 1200); else if (accurate) set(n);
  };
  const update = async accurate => {
    try {
      const r = await fetch(`https://api.socialcounts.org/youtube-live-subscriber-count/${el.dataset.live}`);
      const n = (await r.json()).counters.estimation.subscriberCount;
      if (n > 0) show(n, accurate);
    } catch {}
  };
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { seen = true; o.disconnect(); if (pending) show(pending); } }).observe(el);
  update(true);
  setInterval(() => { if (!document.hidden) update(false); }, 15000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) update(true); });
});

// fanart: one group per artist, platform icon + @handle as the credit (Discord has no public profile URL by name, so no link)
(async () => {
  const box = document.getElementById("artists");
  if (!box) return;
  const urls = { x: "https://x.com/", instagram: "https://www.instagram.com/", tiktok: "https://www.tiktok.com/@", youtube: "https://www.youtube.com/@" };
  let artists = [];
  try { artists = await (await fetch(box.dataset.src, { cache: "no-store" })).json(); } catch { return; }
  for (const a of artists) {
    const group = document.createElement("div"); group.className = "artist";
    const h = document.createElement("h3");
    const credit = document.createElement(urls[a.platform] ? "a" : "span");
    if (urls[a.platform]) { credit.href = urls[a.platform] + a.handle; credit.target = "_blank"; credit.rel = "noopener"; }
    if (document.getElementById("i-" + a.platform)) credit.innerHTML = `<svg aria-hidden="true"><use href="#i-${a.platform}"/></svg>`;
    credit.append("@" + a.handle);
    credit.title = a.platform[0].toUpperCase() + a.platform.slice(1);
    h.append(credit);
    // favourites first; pieces are dealt across the columns left to right so "first" means the top row
    const starred = a.starred || [];
    const wall = document.createElement("div"); wall.className = "fanart";
    wall.pieces = [...starred, ...a.images.filter(s => !starred.includes(s))].map(src => {
      const link = document.createElement("a"), img = document.createElement("img");
      link.href = "../" + src; img.src = "../" + src; img.loading = "lazy"; img.alt = `Fanart by @${a.handle}`;
      img.onload = () => { if (img.naturalWidth < 400) img.classList.add("tiny"); }; // small pixel art: keep pixels sharp when scaled up
      if (starred.includes(src)) link.className = "starred";
      link.append(img); return link;
    });
    wall.append(...wall.pieces); // in the page before deal() measures it (the gallery card stays hidden until it holds art)
    group.append(h, wall);
    // artists with a single piece share a row, up to 3 side by side; 2+ pieces get their own row
    if (a.images.length < 2) {
      let row = box.lastElementChild;
      if (!row?.classList.contains("artist-row") || row.children.length === 3) { row = document.createElement("div"); row.className = "artist-row"; box.append(row); }
      row.append(group);
    } else box.append(group);
  }

  const deal = () => box.querySelectorAll(".fanart").forEach(wall => {
    const n = Math.max(1, Math.min(3, Math.floor((wall.clientWidth + 12) / 212))); // up to 3 columns, each at least 200px
    if (wall.n === n) return;
    wall.n = n;
    const cols = Array.from({ length: n }, () => { const c = document.createElement("div"); c.className = "col"; return c; });
    wall.pieces.forEach((p, i) => cols[i % n].append(p));
    wall.replaceChildren(...cols);
  });
  deal(); addEventListener("resize", deal);

  // viewer: the thumbnail glides to the centre (FLIP), page dims + blurs; outside click, the X, Esc or a double-click on the art glides it back
  const lb = document.getElementById("lightbox"), frame = lb.querySelector(".lb-frame"), big = lb.querySelector("img");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let thumb = null;
  const topLayer = () => ["cursor", "fx"].map(id => document.getElementById(id)).filter(Boolean); // the modal sits in the top layer, so these move inside it while open
  const flip = () => { // transform that puts the big image exactly over the thumbnail
    const a = thumb.getBoundingClientRect(), b = frame.getBoundingClientRect();
    return `translate(${a.left + a.width / 2 - (b.left + b.width / 2)}px, ${a.top + a.height / 2 - (b.top + b.height / 2)}px) scale(${a.width / b.width})`;
  };
  const ease = { duration: still ? 0 : 380, easing: "cubic-bezier(.2, .8, .2, 1)" };
  box.addEventListener("click", async e => {
    const link = e.target.closest(".fanart a");
    if (!link) return;
    e.preventDefault();
    if (lb.open) return;
    thumb = link.querySelector("img");
    big.src = thumb.currentSrc; big.alt = thumb.alt; big.classList.toggle("tiny", thumb.classList.contains("tiny"));
    lb.querySelector(".lb-fav").hidden = !link.classList.contains("starred");
    await big.decode().catch(() => {});
    lb.classList.add("dim"); lb.showModal();
    lb.append(...topLayer()); // star cursor + its sparkle trail ride above the blur
    lb.offsetWidth; lb.classList.remove("dim"); // fade the dim + blur in
    frame.animate([{ transform: flip() }, { transform: "none" }], ease);
    thumb.style.visibility = "hidden"; // it looks like the thumbnail itself lifted off the grid
  });
  const close = () => {
    if (!lb.open || lb.classList.contains("dim")) return;
    lb.classList.add("dim");
    frame.animate([{ transform: "none" }, { transform: flip() }], { ...ease, fill: "forwards" });
    const t = thumb;
    setTimeout(() => { lb.close(); document.body.append(...topLayer()); frame.getAnimations().forEach(a => a.cancel()); t.style.visibility = ""; }, ease.duration); // a timer, not .finished: paused/background tabs never finish animations
  };
  lb.addEventListener("click", e => { if (e.target !== big) close(); }); // backdrop or X
  big.addEventListener("dblclick", close); // double-click the art itself
  lb.addEventListener("cancel", e => { e.preventDefault(); close(); }); // Esc
})();

// easter egg: mine the pfp like a Minecraft block for an Undertale-style boss fight. Each click cracks it one stage, holding
// mines it continuously (~1.2s, like stone with a wooden pickaxe); after 10 stages it breaks with block particles and the fight
// opens. Stop for 1.5s and the cracks heal. Cracks + stone sounds: Minecraft 1.21.1 (assets via mcasset.cloud) in assets/egg/mc/.
// The fight code (assets/egg/) only downloads when it's triggered. Content lives in assets/egg/boss.js.
(() => {
  const base = ROOT;
  const load = src => new Promise((ok, no) => { const s = document.createElement("script"); s.src = base + src + BUILD; s.onload = ok; s.onerror = no; document.head.append(s); });
  const MC = base + "assets/egg/mc/", STAGES = 10, HOLD = 120; // ms per stage while holding
  const img = src => Object.assign(new Image(), { src });
  let cracks = null; // loaded on the first hit
  // Minecraft's sounds: hitting = the block's step sound at 1/4 volume, half pitch, every 4 ticks; breaking = its dig sound at pitch .8
  const sound = (name, n, volume, rate) => { try { const a = new Audio(MC + name + (1 + Math.floor(Math.random() * n)) + ".mp3");
    a.volume = volume; a.preservesPitch = false; a.playbackRate = rate; a.play().catch(() => {}); } catch {} };

  document.querySelectorAll(".avatar").forEach(av => {
    const original = av.src, S = 256; // cracked copies are drawn at 256px (crisp at 84px on 3x screens)
    const clean = img(original); // always crack / sample the clean picture, never the last cracked copy
    let progress = 0, holding = false, last = 0, lastSound = 0, lastBit = 0, idle, texture, busy = false, shown = -1;
    av.draggable = false; av.style.webkitTouchCallout = "none"; av.style.touchAction = "none"; av.style.userSelect = "none";
    // the pfp shrunk to a 16x16 "block texture", for the particles (like a Minecraft block's own texture)
    const tex = () => { if (texture) return texture; const c = document.createElement("canvas"); c.width = c.height = 16;
      const x = c.getContext("2d"); x.drawImage(clean, 0, 0, 16, 16); return texture = c; };
    // Minecraft draws the crack texture over the block as dst * src * 2 (dark lines darken, light ones brighten a little)
    const show = stage => {
      if (stage < 0) { av.src = original; return; }
      const crack = cracks[stage]; if (!crack.complete || !clean.complete) return;
      const c = document.createElement("canvas"); c.width = c.height = S; const x = c.getContext("2d");
      x.drawImage(clean, 0, 0, S, S); const d = x.getImageData(0, 0, S, S);
      const k = document.createElement("canvas"); k.width = k.height = 16; const kx = k.getContext("2d"); kx.drawImage(crack, 0, 0); const m = kx.getImageData(0, 0, 16, 16).data;
      for (let y = 0; y < S; y++) for (let x2 = 0; x2 < S; x2++) {
        const t = (Math.floor(y * 16 / S) * 16 + Math.floor(x2 * 16 / S)) * 4; if (m[t + 3] < 128) continue; // transparent: no crack here
        const i = (y * S + x2) * 4, f = m[t] / 255 * 2;
        d.data[i] = Math.min(255, d.data[i] * f); d.data[i + 1] = Math.min(255, d.data[i + 1] * f); d.data[i + 2] = Math.min(255, d.data[i + 2] * f);
      }
      x.putImageData(d, 0, 0); av.src = c.toDataURL();
    };
    const setProgress = p => { progress = p; const st = Math.min(STAGES - 1, Math.floor(progress) - 1); if (st !== shown) { shown = st; show(st); } };
    const heal = () => { holding = false; setProgress(0); };
    const hit = bits => { // the hit sound every 4 ticks, 1 particle a tick while mining (a click gets a few at once)
      const now = performance.now();
      if (now - lastSound >= 200) { lastSound = now; sound("step_stone", 6, .25, .5); }
      if (bits || now - lastBit >= 50) { lastBit = now; particles(av, tex(), bits || 1, false); }
    };
    const breakIt = async () => {
      busy = true; holding = false; sound("dig_stone", 4, 1, .8);
      particles(av, tex(), 64, true); av.style.visibility = "hidden"; show(-1); shown = -1; progress = 0;
      try { if (!window.startBattle) { await load("assets/egg/boss.js"); await load("assets/egg/battle.js"); } } catch { av.style.visibility = ""; busy = false; return; }
      setTimeout(() => { av.style.visibility = ""; busy = false; try { window.startBattle(window.GALAXI_BOSS, base); } catch {} }, 650); // let the particles fly first
    };
    const tick = now => {
      if (!holding) return;
      const dt = Math.min(50, now - last); last = now;
      if (progress < STAGES) { setProgress(progress + dt / HOLD); hit(); }
      if (progress >= STAGES) return breakIt();
      requestAnimationFrame(tick);
    };
    av.addEventListener("pointerdown", e => {
      if (busy || e.button > 0) return; e.preventDefault();
      if (!cracks) cracks = Array.from({ length: STAGES }, (_, i) => img(`${MC}destroy_stage_${i}.png`));
      clearTimeout(idle); try { av.setPointerCapture(e.pointerId); } catch {}
      lastSound = 0; setProgress(Math.floor(progress) + 1); hit(3); // a click is worth one whole stage
      if (progress >= STAGES) return breakIt();
      holding = true; last = performance.now(); requestAnimationFrame(tick);
    });
    const release = () => { holding = false; clearTimeout(idle); idle = setTimeout(heal, 1500); };
    av.addEventListener("pointerup", release); av.addEventListener("pointercancel", release); av.addEventListener("lostpointercapture", release);
    av.addEventListener("contextmenu", e => e.preventDefault());
  });

  // Minecraft's block particles (TerrainParticle): each shows a random 4x4-texel chunk of the block's 16x16 texture, falls with
  // gravity .04 blocks/tick², drag .98 per tick, lives 4 / (random * .9 + .1) ticks. A hit spawns a few at the face; breaking
  // spawns a 4x4x4 grid of 64 that pop outward from the middle. 1 block = the pfp's size on screen, 1 tick = 50ms.
  let cv, ctx, live = [];
  function particles(av, tex, n, burst) {
    const r = av.getBoundingClientRect(), B = r.width;
    if (!cv) { cv = Object.assign(document.createElement("canvas"), { className: "mc-particles" });
      Object.assign(cv.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 2147483646 });
      document.body.append(cv); ctx = cv.getContext("2d"); }
    for (let i = 0; i < n; i++) {
      let x, y, vx, vy;
      if (burst) { const gx = (i % 4 + .5) / 4, gy = (Math.floor(i / 4) % 4 + .5) / 4; x = gx; y = gy; // grid over the block
        vx = (gx - .5) * .3 + (Math.random() - .5) * .08; vy = (gy - .5) * .3 - Math.random() * .12; }
      else { x = Math.random(); y = Math.random(); vx = (Math.random() - .5) * .08; vy = -Math.random() * .06; }
      live.push({ x: r.left + x * B, y: r.top + y * B, vx: vx * B, vy: vy * B, B, u: Math.floor(Math.random() * 13), v: Math.floor(Math.random() * 13),
        size: Math.round(B * (.1 + Math.random() * .1)), life: 4 / (Math.random() * .9 + .1) * 50, age: 0, tex });
    }
    if (live.length === n) { let last = performance.now(); requestAnimationFrame(function step(now) {
      const dt = Math.min(50, now - last) / 50; last = now; // in ticks
      const dpr = devicePixelRatio || 1; if (cv.width !== innerWidth * dpr) { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, innerWidth, innerHeight); ctx.imageSmoothingEnabled = false;
      live = live.filter(p => (p.age += dt * 50) < p.life);
      for (const p of live) { p.vy += .04 * p.B * dt; p.vx *= .98 ** dt; p.vy *= .98 ** dt; p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.drawImage(p.tex, p.u, p.v, 4, 4, Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size); }
      if (live.length) requestAnimationFrame(step); else ctx.clearRect(0, 0, innerWidth, innerHeight);
    }); }
  }
})();
