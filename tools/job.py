#!/usr/bin/env python3
"""tools/job.py: run a tools/train.js job in a headless Chrome (away from any open browser) and save what it returns.

    python3 tools/job.py "train.oracle(1, { seed: 1 })" out.json [--minutes 60]

Serves the site on a spare port, opens tools/sim.html#job=<the expression>, the page runs it and posts the JSON back here.
"""
import argparse, http.server, json, os, shutil, socketserver, subprocess, sys, tempfile, threading, time, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("expr"); ap.add_argument("out"); ap.add_argument("--minutes", type=float, default=60)
    a = ap.parse_args()
    result = {}

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kw): super().__init__(*args, directory=str(ROOT), **kw)
        def log_message(self, *args): pass
        def end_headers(self):  # every replay starts a fresh fight that asks for its images and sounds again: let Chrome cache them
            if self.command == "GET": self.send_header("Cache-Control", "max-age=3600")
            super().end_headers()
        def do_POST(self):  # the page posts its result (or its progress) here
            body = self.rfile.read(int(self.headers["Content-Length"])).decode()
            if self.path == "/progress":
                print(body, flush=True)
            else:
                result["data"] = body
            self.send_response(200); self.end_headers(); self.wfile.write(b"ok")

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("127.0.0.1", 0), Handler) as srv:
        port = srv.server_address[1]
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        prof = tempfile.mkdtemp(prefix="galaxi-job-")
        url = f"http://127.0.0.1:{port}/tools/sim.html#job=" + urllib.parse.quote(a.expr)
        chrome = subprocess.Popen([CHROME, "--headless=new", f"--user-data-dir={prof}", "--no-first-run", "--disable-background-timer-throttling",
                                   "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--autoplay-policy=no-user-gesture-required", url],
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            end = time.time() + a.minutes * 60
            while "data" not in result and time.time() < end and chrome.poll() is None:
                time.sleep(1)
        finally:
            chrome.kill(); shutil.rmtree(prof, ignore_errors=True)
        if "data" not in result:
            sys.exit("no result (timed out or Chrome quit)")
        Path(a.out).write_text(result["data"])
        print(f"saved {a.out} ({len(result['data'])} chars)")


if __name__ == "__main__":
    main()
