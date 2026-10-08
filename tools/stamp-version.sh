#!/bin/sh
# Run before every publish: stamps ?v=<timestamp> on style.css / site.js in all pages, so browsers (and the
# egg scripts, via site.js) fetch the new files straight away instead of serving GitHub Pages' 10-minute cache.
cd "$(dirname "$0")/.." && v=$(date +%Y%m%d%H%M) && sed -i '' -E "s/(style\.css|site\.js)\?v=[A-Za-z0-9]+/\1?v=$v/g" index.html portfolio/index.html fanart/index.html && echo "stamped v=$v"
