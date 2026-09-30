#!/usr/bin/env node
// check-game.mjs - Phantom Burn's own legs of substratic's check-site (its
// "arm", named in substratic.sgv). check-site serves the staged tree on
// loopback, runs its shared legs (the files, the redirects, indexing, the
// 404s, the wasm), then runs this while the server is up and relays these
// lines. Everything here was scripts/check-site.mjs's (2c1ff55), unchanged
// but for where the server comes from.
//
//   node scripts/check-game.mjs BASE DIR     (BASE: http://127.0.0.1:PORT)
//
//   root        / links the game at /<game>/
//   redirect    some _redirects rule sends its path to /<game>/
//   tree        the site's own files are there: style.css, the icons, the
//               Flux Harmonic mark, the fonts with their OFL.txt
//   (pages)     scripts/check-site-pages.mjs: landing, carousel, contrast,
//               phone, badge-in, news, feeds, version, preview, crosslink,
//               em-dash, console (its header lists what each checks)
//   boots       the game at /<game>/ and its title (?title=1) boot in headless
//               Chrome (scripts/shot-web.mjs: --mute-audio and the worker-null
//               sink) with no console error
//   overlay     the page has no HTML instructions overlay (#how)
//   transmission  floor 14 (?go=14, the flow) prints Crash's transmission
//   fullscreen  Substratic's button, and the page's "phantom-burn: fullscreen"
//               line (the pause panel's row), each call requestFullscreen
//   title-room  the first title after a cold load, its room held back past the
//               title's 10 s wait, shows the room once it lands. This leg
//               serves the tree itself (substratic's serve-site.mjs, from
//               $SUBSTRATIC_CHECKS), holding the room's files back 12 s.
//   reticle     in play the reticle is at the view's centre; aimed at floor
//               14's printer (?view=8) it lights and the deck's label stands
//               beside it
// Exit 0 green, 1 red, 2 setup failed.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { spawn } from "node:child_process";
import { pageLegs } from "./check-site-pages.mjs";

const [BASE0, DIR0] = process.argv.slice(2);
if (!BASE0 || !DIR0) { console.log("SETUP-FAILED: usage: check-game.mjs BASE DIR"); process.exit(2); }
const BASE = BASE0.replace(/\/$/, ""), DIR = path.resolve(DIR0.replace(/\/$/, ""));
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const MAN = DIR + ".manifest";
const manText = fs.readFileSync(MAN, "utf8");
const SLUG = (manText.match(/^# game (\S+)$/m) || [])[1];
if (!SLUG) { console.log("SETUP-FAILED: the manifest names no game path (# game)"); process.exit(2); }
const files = manText.split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.slice(66)).filter((f) => !f.startsWith("@"));
const CHECKS = process.env.SUBSTRATIC_CHECKS;
if (!CHECKS || !fs.existsSync(path.join(CHECKS, "serve-site.mjs"))) { console.log("SETUP-FAILED: SUBSTRATIC_CHECKS does not name substratic's tasks/checks"); process.exit(2); }
const { createHandler } = await import(path.join(CHECKS, "serve-site.mjs"));

let fail = 0;
const ok = (leg, what) => console.log(`  ok   ${leg}: ${what}`);
const bad = (leg, what) => { fail++; console.log(`  FAIL ${leg}: ${what}`); };

// root
{
  const rootText = await (await fetch(BASE + "/")).text();
  rootText.includes(`href="/${SLUG}/"`) ? ok("root", `/ links /${SLUG}/`) : bad("root", `/ does not link /${SLUG}/`);
}
// redirect: an earlier path goes to the game
{
  const rfile = path.join(DIR, "_redirects");
  const rules = fs.existsSync(rfile) ? fs.readFileSync(rfile, "utf8").split("\n").map((l) => l.replace(/#.*/, "").trim()).filter(Boolean) : [];
  rules.some((l) => (l.split(/\s+/)[1] || "").startsWith(`/${SLUG}/`))
    ? ok("redirect", `a _redirects rule sends its path to /${SLUG}/`) : bad("redirect", `no rule sends anything to /${SLUG}/`);
}
// tree: the site's own files
{
  const want = ["style.css", "logo.png", "favicon.png", "favicon.ico", "mark.png", "fonts/OFL.txt", "fonts/JetBrainsMono-Regular.woff2", "fonts/JetBrainsMono-Bold.woff2", "fonts/JetBrainsMono-Italic.woff2", "news/index.html", "version.json"];
  const missing = want.filter((f) => !files.includes(f));
  missing.length ? bad("tree", `missing: ${missing.join(", ")}`) : ok("tree", `the site's ${want.length} named files are staged`);
}

// the site's pages in Chrome (scripts/check-site-pages.mjs); a setup failure there is the whole gate's
{
  const built = (manText.match(/^# built (.*)$/m) || [])[1] || "";
  const headSha = (manText.match(/^# head (\S+)$/m) || [])[1] || "";
  const STAMP = /\(runner build\)$/.test(built) ? built.slice(0, 12) : `local-${headSha.slice(0, 12)}`;
  try { await pageLegs({ DIR, BASE, SLUG, STAMP, REPO, ok, bad }); }
  catch (e) { console.log(/^Error: SETUP-FAILED/.test(String(e)) ? String(e).replace(/^Error: /, "") : `SETUP-FAILED: the page legs threw: ${e && e.stack || e}`); process.exit(2); }
}

// boots
for (const [q, want] of [["hud=0", "game"], ["title=1", "title"]]) {
  // asynchronously: this process is also the server the browser talks to
  const r = await new Promise((resolve) => {
    const ch = spawn("node", [path.join(REPO, "scripts/shot-web.mjs"), DIR, `/tmp/phantom-check-site-${want}.png`,
      "--url", `${BASE}/${SLUG}/`, "--query", q, "--wait", "2500"]);
    let o = "";
    ch.stdout.on("data", (d) => { o += d; }); ch.stderr.on("data", (d) => { o += d; });
    const kill = setTimeout(() => ch.kill("SIGKILL"), 200000);
    ch.on("close", (code) => { clearTimeout(kill); resolve({ status: code, out: o }); });
  });
  const out = r.out;
  r.status === 0 && /shot ->/.test(out) ? ok("boots", `the ${want} boots at /${SLUG}/?${q} with no console error`)
    : bad("boots", `the ${want} at /${SLUG}/?${q}: rc ${r.status}: ${out.split("\n").filter((l) => !/^retry/.test(l)).slice(0, 3).join(" | ").slice(0, 300)}`);
}
// Phantom 0.1 (David): no HTML instructions over the game; Crash's
// transmission on floor 14 instead; Substratic's fullscreen button, and the
// pause panel's FULLSCREEN row through the page's line.
{
  const page = fs.readFileSync(path.join(DIR, SLUG, "index.html"), "utf8");
  /id="how"/.test(page) ? bad("overlay", "the page still has the #how instructions overlay") : ok("overlay", "no HTML instructions overlay");
  const con = "/tmp/phantom-check-site-floor14.console";
  // the spy: requestFullscreen counted, never entered (headless Chrome refuses without a gesture anyway)
  const spy = "(() => { let n = 0; Element.prototype.requestFullscreen = function () { n++; return Promise.resolve(); };" +
              " const b = document.getElementById('sub-fs'); if (b) b.click(); console.log('phantom-burn: fullscreen'); return (b ? 'button ' : 'nobutton ') + n; })()";
  const r = await new Promise((resolve) => {
    const ch = spawn("node", [path.join(REPO, "scripts/shot-web.mjs"), DIR, "/tmp/phantom-check-site-floor14.png",
      "--url", `${BASE}/${SLUG}/`, "--query", "go=14", "--wait", "6000", "--console", con, "--eval", spy]);
    let o = "";
    ch.stdout.on("data", (d) => { o += d; }); ch.stderr.on("data", (d) => { o += d; });
    const kill = setTimeout(() => ch.kill("SIGKILL"), 200000);
    ch.on("close", (code) => { clearTimeout(kill); resolve({ status: code, out: o }); });
  });
  const lines = fs.existsSync(con) ? fs.readFileSync(con, "utf8").split("\n") : [];
  const tx = lines.find((l) => l.includes("phantom-burn: transmission "));
  tx ? ok("transmission", `floor 14 (?go=14): ${tx.replace(/^.*phantom-burn: transmission /, "").slice(0, 60)}`)
     : bad("transmission", `floor 14 (?go=14): no transmission line (rc ${r.status})`);
  const ev = (r.out.match(/eval: "([^"]*)"/) || [])[1] || "";
  ev === "button 2" ? ok("fullscreen", "Substratic's button and the pause panel's line each request fullscreen")
                    : bad("fullscreen", `the fullscreen spy: ${ev || "no result"} (want button 2)`);
}
// title-room (David, 2026-09-29: the first title after a cold load showed only
// the console): the root room held back 12 s, past the title's 10 s wait, so
// the title starts without it; when it lands the title must put it in. The
// root console's screen is violet (C-GIBSON); the bare title has none. Served
// from this leg's own server over DIR (the same handler), so it can hold the
// room back.
{
  const handler = createHandler(DIR);
  const hold = http.createServer((req, res) => {
    if (req.url.includes("/assets/floors/root-room/")) setTimeout(() => handler(req, res), 12000);
    else handler(req, res);
  });
  await new Promise((r) => hold.listen(0, "127.0.0.1", r));
  const HOLD = `http://127.0.0.1:${hold.address().port}`;
  const png = "/tmp/phantom-check-site-title-room.png";
  const r = await new Promise((resolve) => {
    const ch = spawn("node", [path.join(REPO, "scripts/shot-web.mjs"), DIR, png,
      "--url", `${HOLD}/${SLUG}/`, "--wait", "14000"]);
    let o = "";
    ch.stdout.on("data", (d) => { o += d; }); ch.stderr.on("data", (d) => { o += d; });
    const kill = setTimeout(() => ch.kill("SIGKILL"), 200000);
    ch.on("close", (code) => { clearTimeout(kill); resolve({ status: code, out: o }); });
  });
  hold.close();
  const n = r.status === 0 && fs.existsSync(png) ? violetPixels(png) : -1;
  n >= 300 ? ok("title-room", `the first title, its room held back 12 s, shows it when it lands (${n} violet pixels)`)
           : bad("title-room", `the first title with its room held back: ${n < 0 ? "no shot (rc " + r.status + ")" : n + " violet pixels (want 300 or more): the console alone"}`);
}
// reticle (David, 2026-09-29: "you can't tell what you're pointing at"): in
// play a small plus at the view's centre in C-TEXT-DIM; aimed at a device
// (floor 14's view 8, deck-printer) it is C-SELECTED and the deck's label
// stands beside it.
{
  const shoot = (q, png) => new Promise((resolve) => {
    const ch = spawn("node", [path.join(REPO, "scripts/shot-web.mjs"), DIR, png, "--url", `${BASE}/${SLUG}/`, "--query", q, "--wait", "3000"]);
    let o = ""; ch.stdout.on("data", (d) => { o += d; }); ch.stderr.on("data", (d) => { o += d; });
    const kill = setTimeout(() => ch.kill("SIGKILL"), 200000);
    ch.on("close", (code) => { clearTimeout(kill); resolve(code); });
  });
  const plain = "/tmp/phantom-check-site-reticle.png", aimed = "/tmp/phantom-check-site-reticle-aimed.png";
  const r1 = await shoot("go=14", plain), r2 = await shoot("view=8&hud=0", aimed);
  const a = r1 === 0 ? decodePng(plain) : null, b = r2 === 0 ? decodePng(aimed) : null;
  // the centre, in the canvas's pixels (the view is scaled into the canvas)
  const centre = (img) => img ? [Math.floor(img.w / 2) - 12, Math.floor(img.h / 2) - 12, Math.floor(img.w / 2) + 12, Math.floor(img.h / 2) + 12] : null;
  const label = (img) => img ? [Math.floor(img.w / 2) + 8, Math.floor(img.h / 2) - 14, Math.min(img.w, Math.floor(img.w / 2) + 260), Math.floor(img.h / 2) + 14] : null;
  const dim = countNear(a, 115, 128, 166, 12, centre(a));
  dim >= 4 ? ok("reticle", `in play the reticle is at the centre (${dim} C-TEXT-DIM pixels)`)
           : bad("reticle", `in play (?go=14): ${dim} C-TEXT-DIM pixels at the centre (want 4 or more)`);
  const lit = countNear(b, 77, 242, 217, 12, centre(b)), lab = countNear(b, 77, 242, 217, 12, label(b));
  lit >= 4 && lab >= 40 ? ok("reticle", `aimed at the printer it lights (${lit}) and the deck's label stands beside it (${lab})`)
                        : bad("reticle", `aimed at the printer (?view=8): ${lit} C-SELECTED pixels at the centre, ${lab} in the label (want 4 and 40 or more)`);
}
process.exit(fail ? 1 : 0);

// A PNG's pixels (8-bit RGB or RGBA, not interlaced: a Chrome screenshot).
function decodePng(file) {
  const b = fs.readFileSync(file);
  let o = 8, w = 0, h = 0, ch = 0, idat = [];
  while (o < b.length) {
    const len = b.readUInt32BE(o), type = b.toString("latin1", o + 4, o + 8), d = b.subarray(o + 8, o + 8 + len);
    if (type === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ch = d[9] === 6 ? 4 : 3; if (d[8] !== 8 || d[12] !== 0) return null; }
    else if (type === "IDAT") idat.push(d);
    o += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * ch, px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[y * stride + x - ch] : 0, up = y > 0 ? px[(y - 1) * stride + x] : 0,
            c = x >= ch && y > 0 ? px[(y - 1) * stride + x - ch] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      px[y * stride + x] = v & 255;
    }
  }
  return { w, h, ch, px };
}
// how many pixels in the box [x0, x1) x [y0, y1) (the whole image by default)
// are within tol of (r g b)
function countNear(img, r, g, b, tol, box) {
  if (!img) return -1;
  const [x0, y0, x1, y1] = box || [0, 0, img.w, img.h];
  let n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * img.w + x) * img.ch;
    if (Math.abs(img.px[i] - r) < tol && Math.abs(img.px[i + 1] - g) < tol && Math.abs(img.px[i + 2] - b) < tol) n++;
  }
  return n;
}
// C-GIBSON's violet (#B36BFF): the root console's screen
function violetPixels(file) { return countNear(decodePng(file), 179, 107, 255, 45); }
