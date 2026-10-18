# Phantom Burn

A first-person stealth and hacking game in the world of Crash The Stack, built with Sigil. Early development.

A normal launch opens the title menu on both desktop and web. Choose PRACTICE
or INFILTRATE, then use the pause panel's QUIT TO TITLE to choose again. Floors
and results stay inside the same running game. URL parameters and native flags
such as `--floor`, `--play` and `--title` are development and test shortcuts.

## Checks

Build the native dev executable with `scripts/dev sigil build` before running
the full `scripts/dev sigil test` command. That command runs the Sigil suite,
then `test/test-native-flow.mjs`: title, floor 14, title, training in one process.
The integration check needs `DISPLAY` (use a virtual display in headless CI).
Focused `scripts/dev sigil test --sgl test/FILE.sgl` commands run only that test.

`sigil check-site` also runs `test/test-seamless-browser.mjs` through the tracked
`scripts/check-seamless-flow.mjs` leg. It exercises the served game's real menu
and pause panel and fails on document replacement, URL changes or app restart.
Both flow checks use isolated saves/browser storage and muted audio.

## Licenses

The code is GPL-3.0-or-later (`LICENSE`). The models, art, music and sound
are CC-BY-4.0 (`assets/LICENSE`), credit David Wilson / Flux Harmonic,
except the reserved marks in `assets/RESERVED.md`: the name, the logo and
the Flux Harmonic mark. The third-party notices are in `NOTICE`.
