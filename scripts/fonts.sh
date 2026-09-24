#!/usr/bin/env bash
# Regenerates the self-hosted font subsets (needs Python fontTools + brotli:
#   python3 -m venv .venv && .venv/bin/pip install fonttools brotli).
# Mona Sans (OFL, github.com/github/mona-sans): opsz pinned, wght 400–900, wdth 100–125,
# glyphs limited to the characters the site uses (Basic Latin + Serbian Latin + punctuation).
# If the club adds text with other characters (e.g. ö, ü), add their code points to MONA_UNICODES
# and run this script again.
set -euo pipefail
PY="${PYTHON:-.venv/bin/python}"
MONA_UNICODES="U+0020-007E,U+00A0,U+00A9,U+00AB,U+00AE,U+00B0,U+00B7,U+00BB,U+00D7,U+00E9,U+0103,U+0106-0107,U+010C-010D,U+0110-0111,U+0160-0161,U+017D-017E,U+2010-2015,U+2018-201E,U+2022,U+2026,U+2060,U+20AC,U+2190-2193,U+2197,U+2212,U+25B8,U+FEFF,U+FFFD"
TMP="$(mktemp -d)"
"$PY" -m fontTools.varLib.instancer fonts/source/MonaSansVF-wdth-opsz-wght.woff2 opsz=drop wght=400:900 wdth=100:125 -o "$TMP/mona.ttf"
"$PY" -m fontTools.subset "$TMP/mona.ttf" --unicodes="$MONA_UNICODES" \
  --layout-features='kern,liga,calt,ccmp,locl,mark,mkmk,tnum,lnum,case' --flavor=woff2 \
  --output-file=fonts/mona-sans-kraguj.woff2
# Doto: scoreboard numerals only (digits . : – ~ space), round dots (ROND=100), wght 400–900.
"$PY" -m fontTools.varLib.instancer fonts/source/Doto-variable.ttf ROND=100 wght=400:900 -o "$TMP/doto.ttf"
"$PY" -m fontTools.subset "$TMP/doto.ttf" --unicodes="U+0020,U+0030-0039,U+002E,U+003A,U+2013,U+007E" \
  --layout-features='tnum,lnum' --flavor=woff2 --output-file=fonts/doto-scoreboard.woff2
rm -rf "$TMP"
ls -la fonts/*.woff2
