#!/bin/sh
# Copied verbatim (below this header) from the design attachments' bayer.sh
# (~/Ops/attachments/stealth-game-design/bayer.sh, 2026-09-25): Crash The
# Stack's ordered dither (scripts/art/dither, o4x4/o8x8 branch) against an
# explicit palette PNG. scripts/gate-dither holds the game's post pass to it.
# Crash's ordered dither (scripts/art/dither, o4x4/o8x8 branch) against an explicit palette PNG.
# usage: bayer.sh RAW.png OUT.png PALETTE.png o4x4|o8x8 [SPREAD]
set -eu; export LC_ALL=C
raw="$1"; out="$2"; pal="$3"; method="$4"; spread="${5:-40}"
tmp="$(mktemp -d)"; trap 'rm -rf "${tmp:?}"' EXIT
hexes="$(convert "$pal" -unique-colors txt:- | sed -n 's/.*\(#[0-9A-F]\{6\}\).*/\1/p' | tr '\n' ' ')"
convert "$raw" -strip -alpha off -depth 8 -compress none "PPM:$tmp/in.ppm"
awk -v hexes="$hexes" -v method="$method" -v spread="$spread" '
  function hex2(h, i) { return (index("0123456789ABCDEF", substr(h, i, 1)) - 1) * 16 + index("0123456789ABCDEF", substr(h, i + 1, 1)) - 1 }
  function clamp(v) { return v < 0 ? 0 : (v > 255 ? 255 : v) }
  function nearest(r, g, b,    i, d, best, bi) { best = 1e18
    for (i = 1; i <= np; i++) { d = (r - pr[i]) ^ 2 + (g - pg[i]) ^ 2 + (b - pb[i]) ^ 2; if (d < best) { best = d; bi = i } } return bi }
  BEGIN { np = split(hexes, hx, " "); for (i = 1; i <= np; i++) { pr[i] = hex2(hx[i], 2); pg[i] = hex2(hx[i], 4); pb[i] = hex2(hx[i], 6) }
    split("0 8 2 10 12 4 14 6 3 11 1 9 15 7 13 5", b4, " ")
    split("0 32 8 40 2 34 10 42 48 16 56 24 50 18 58 26 12 44 4 36 14 46 6 38 60 28 52 20 62 30 54 22 3 35 11 43 1 33 9 41 51 19 59 27 49 17 57 25 15 47 7 39 13 45 5 37 63 31 55 23 61 29 53 21", b8, " ")
    tok = 0 }
  /^#/ { next }
  { for (f = 1; f <= NF; f++) { tok++; if (tok == 1) continue; if (tok == 2) { W = $f; continue }; if (tok == 3) { H = $f; continue }; if (tok == 4) continue; v[tok - 5] = $f } }
  END { n = W * H; m = (method == "o4x4") ? 4 : 8
    for (p = 0; p < n; p++) { x = p % W; y = int(p / W)
      t = (m == 4) ? b4[(y % 4) * 4 + (x % 4) + 1] : b8[(y % 8) * 8 + (x % 8) + 1]; t = ((t + 0.5) / (m * m) - 0.5) * spread
      pick[p] = nearest(clamp(v[p * 3] + t), clamp(v[p * 3 + 1] + t), clamp(v[p * 3 + 2] + t)) }
    printf "P6\n%d %d\n255\n", W, H; for (p = 0; p < n; p++) { i = pick[p]; printf "%c%c%c", pr[i], pg[i], pb[i] } }' "$tmp/in.ppm" > "$tmp/out.ppm"
convert "$tmp/out.ppm" "PNG24:$out"
colors="$(convert "$out" -unique-colors txt:- | sed -n 's/.*\(#[0-9A-F]\{6\}\).*/\1/p' | sort -u)"
for c in $colors; do case " $hexes " in *" $c "*) ;; *) echo "REFUSED: $c not in palette"; exit 1 ;; esac; done
echo "$out $method spread $spread colors $(printf '%s\n' "$colors" | wc -l) of $(echo $hexes | wc -w)"
