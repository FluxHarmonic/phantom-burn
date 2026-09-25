// gate-replay.mjs - gate 5 (design section 8, determinism): a witness script
// replayed natively and on the web gives byte-identical traces.
//
//   node scripts/gate-replay.mjs BUILD FLOOR SCRIPT NATIVE [--out DIR]
//
//   BUILD   a web build's served tree (build/web, or build/remote-web-<sha>)
//   FLOOR   the floor the page loads (?floor=FLOOR), whose
//           BUILD/assets/floors/FLOOR/collide.b64 both legs replay over
//   SCRIPT  a gate 3 witness (phantom-burn --floor-reach FLOOR --save-witness)
//   NATIVE  the native leg's output: phantom-burn --floor-replay
//           assets/floors/FLOOR/collide.b64 SCRIPT (the same bytes), one
//           "replay K X Y Z YAW HEIGHT" line a tick, then "replay-done N";
//           other lines (a runner log's) are ignored
//
// The web leg: the shell's scripts/shot-web.mjs opens the page (headless
// Chrome), hands it the script with window.phantomDispatch("replay", SCRIPT),
// and keeps the console, where the game prints "phantom-burn: replay LINE"
// per tick. Both traces are written to DIR (default build/floors/gate5) as
// native.txt and web.txt.
//
// Prints "gate 5 OK: N ticks, byte-identical (sha256 ...)" and exits 0, or
// the first differing line and exits 1; SETUP-FAILED and exit 2 when a leg
// has no trace.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1] === "--out"));
const [BUILD, FLOOR, SCRIPT, NATIVE] = positional;
const OUT = opt("--out", "build/floors/gate5");
const fail = (msg) => { console.log("SETUP-FAILED: " + msg); process.exit(2); };

if (!BUILD || !FLOOR || !SCRIPT || !NATIVE) fail("usage: node scripts/gate-replay.mjs BUILD FLOOR SCRIPT NATIVE [--out DIR]");
if (!/^[a-z0-9-]+$/.test(FLOOR)) fail(`FLOOR is a floor's name (a-z, 0-9, -), not '${FLOOR}'`);
if (!fs.existsSync(path.join(BUILD, "assets/floors", FLOOR, "collide.b64"))) fail(`${BUILD}/assets/floors/${FLOOR}/collide.b64 missing`);
if (!fs.existsSync(SCRIPT)) fail(`no script ${SCRIPT}`);
if (!fs.existsSync(NATIVE)) fail(`no native trace ${NATIVE}`);
fs.mkdirSync(OUT, { recursive: true });

// the trace lines of a leg's output: "replay ..." and "replay-done N"
const trace = (lines) => lines.filter((l) => /^replay( |-done )/.test(l));

const native = trace(fs.readFileSync(NATIVE, "utf8").split("\n"));
if (!native.length || !/^replay-done /.test(native[native.length - 1])) fail(`${NATIVE} has no complete trace`);

const script = fs.readFileSync(SCRIPT, "utf8");
const consoleFile = path.join(OUT, "web-console.txt");
// ports of our own, so another worker's shot-web on the defaults cannot answer
const port = 20000 + (process.pid % 10000);
const r = spawnSync("node", ["scripts/shot-web.mjs", BUILD, path.join(OUT, "web.png"),
  "--query", `floor=${FLOOR}&hud=0`, "--wait", "3000", "--console", consoleFile,
  "--port", String(port), "--cdp", String(port + 10000),
  "--eval", `window.phantomDispatch("replay", ${JSON.stringify(script)}), "sent"`], { encoding: "utf8" });
process.stdout.write(r.stdout || "");
if (!fs.existsSync(consoleFile)) fail("the web leg left no console (shot-web failed)");
const web = trace(fs.readFileSync(consoleFile, "utf8").split("\n")
  .filter((l) => l.startsWith("phantom-burn: replay")).map((l) => l.slice("phantom-burn: ".length)));
if (fs.readFileSync(consoleFile, "utf8").includes("replay-error")) fail("the page says the script is not a script");
if (!web.length || !/^replay-done /.test(web[web.length - 1])) fail("the web leg printed no complete trace");

const nt = native.join("\n") + "\n", wt = web.join("\n") + "\n";
fs.writeFileSync(path.join(OUT, "native.txt"), nt);
fs.writeFileSync(path.join(OUT, "web.txt"), wt);
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
if (nt === wt) {
  console.log(`gate 5 OK: ${native.length - 1} ticks, native and web byte-identical (sha256 ${sha(nt)})`);
  process.exit(0);
}
const k = native.findIndex((l, i) => l !== web[i]);
console.log(`gate 5 FAILED: the traces differ first at line ${k + 1} of ${native.length} (web has ${web.length})`);
console.log(`  native: ${native[k] ?? "(none)"}`);
console.log(`  web:    ${web[k] ?? "(none)"}`);
process.exit(1);
