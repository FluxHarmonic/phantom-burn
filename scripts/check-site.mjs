#!/usr/bin/env node
// check-site.mjs - the local gate for a staged phantomburn.net tree (public
// from 0.1; Harkfell's verify-site.mjs, the same idea).
//
//   node scripts/check-site.mjs build/site
//
// Serves the tree on loopback through scripts/serve-site.mjs (Pages' rules:
// the tree's own _headers, real 404s from 404.html, pretty URLs) and checks:
//   manifest   the tree still hashes to build/site.manifest
//   tree       the site's own files are there: style.css, the icons, the
//              Flux Harmonic mark, the fonts with their OFL.txt
//   old-path   the game's earlier paths (each _redirects source) are in none of
//              the site's own text files (the landing, the news, the feeds,
//              version.json, _headers), and have no directory in the tree
//   root       / is 200 html and links the game at /<game>/
//   robots     /robots.txt allows everything (public from 0.1)
//   indexable  no response carries X-Robots-Tag: noindex, and only the 404
//              page asks not to be indexed (its <meta name="robots">)
//   files      every file in the manifest is served 200 byte for byte, and
//              nothing but .html is served as html
//   missing    a missing path is a 404 with 404.html's body, at the root and
//              under the game; /_headers and /_redirects are not served
//   slash      /<game> redirects (308) to /<game>/
//   redirect   every _redirects rule answers its status and Location (the
//              game's earlier paths 301 to /badge-in/, the rest of the path and
//              the query string kept)
//   wasm       exactly one wasm, at w/<sha16>/phantom-burn.wasm, named by its
//              own sha256; the page's data-wasm names it; the old
//              /<game>/phantom-burn.wasm is gone (a 404) (t-5b3251: in
//              production the wasm is in R2)
//   overlay    the page has no HTML instructions overlay (#how)
//   transmission  floor 14 (?go=14, the flow) prints Crash's transmission
//   fullscreen Substratic's button, and the page's "phantom-burn: fullscreen"
//              line (the pause panel's row), each call requestFullscreen
//   title-room the first title after a cold load, its room held back past the
//              title's 10 s wait, shows the room once it lands (not the console alone)
//   reticle    in play the reticle is at the view's centre; aimed at floor 14's
//              printer (?view=8) it lights and the deck's label stands beside it
//   webgl      scripts/webgl-check.mjs: with WebGL off, or only WebGL 1, the
//              page says the game needs WebGL 2 and never fetches the wasm;
//              with no context for the game's canvas, the same message in
//              place of the loader's raw error; with WebGL 2, no message and
//              the game boots
//   (pages)    scripts/check-site-pages.mjs: landing, carousel, contrast,
//              badge-in, news, feeds, version, preview, crosslink, em-dash,
//              console (its header lists what each checks)
//   boots      the game at /<game>/ and its title (?title=1) boot in headless
//              Chrome through this same server with no console error, and
//              fetched the wasm from /w/<sha16>/ and nowhere else
// All green writes build/site.verified: the manifest's sha256, the gate
// files' hashes, HEAD, and whether the checkout was clean; publish-web
// refuses without it. Exit 0 green, 1 red, 2 setup failed.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import zlib from "node:zlib";
import { createHandler, parseRedirects } from "./serve-site.mjs";
import { pageLegs } from "./check-site-pages.mjs";

const DIR = path.resolve((process.argv[2] || "").replace(/\/$/, ""));
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
if (!process.argv[2] || !fs.existsSync(path.join(DIR, "index.html"))) { console.log(`SETUP-FAILED: ${DIR}/index.html missing`); process.exit(2); }
const MAN = DIR + ".manifest";
if (!fs.existsSync(MAN)) { console.log(`SETUP-FAILED: ${MAN} missing (scripts/stage-web)`); process.exit(2); }
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
// shot-web.mjs decides the boots, transmission and fullscreen verdicts;
// webgl-check.mjs the webgl leg
const GATES = ["scripts/check-site.mjs", "scripts/check-site-pages.mjs", "scripts/serve-site.mjs", "scripts/shot-web.mjs", "scripts/webgl-check.mjs", "scripts/tree-manifest"];
const gateHashes = GATES.map((g) => [g, sha(fs.readFileSync(path.join(REPO, g)))]);   // at the START of the run
const head = execFileSync("git", ["-C", REPO, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const clean = execFileSync("git", ["-C", REPO, "status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim() === "";

let pass = 0, fail = 0;
const ok = (leg, what) => { pass++; console.log(`  ok   ${leg}: ${what}`); };
const bad = (leg, what) => { fail++; console.log(`  FAIL ${leg}: ${what}`); };

// manifest
const want = fs.readFileSync(MAN, "utf8").split("\n").filter((l) => l && !l.startsWith("#")).join("\n");
const got = execFileSync(path.join(REPO, "scripts/tree-manifest"), [DIR], { encoding: "utf8" }).trim();
want === got ? ok("manifest", `${got.split("\n").length} files match`) : bad("manifest", "the tree no longer matches its manifest; restage");
const files = got.split("\n").map((l) => l.slice(66)).filter((f) => !f.startsWith("@"));   // @: functions/, wrangler.jsonc

// the game's path, from the manifest's header (stage-web writes # game NAME)
const SLUG = (fs.readFileSync(MAN, "utf8").match(/^# game (\S+)$/m) || [])[1];
if (!SLUG || !fs.statSync(path.join(DIR, SLUG), { throwIfNoEntry: false })?.isDirectory()) { console.log(`SETUP-FAILED: the manifest names no game directory (# game), or it is missing`); process.exit(2); }
const REDIRECTS = fs.existsSync(path.join(DIR, "_redirects")) ? parseRedirects(fs.readFileSync(path.join(DIR, "_redirects"), "utf8")) : [];

// old-path: the first path lives on only as a redirect source
const OLD = REDIRECTS.map((r) => r.from.replace(/\/\*$/, "").replace(/^\//, "")).filter((p, i, a) => p && a.indexOf(p) === i);
// the site's own text files: everything but the game's directory and the wasm
const SITE_TEXT = files.filter((f) => !f.startsWith(SLUG + "/") && !f.startsWith("w/") && f !== "fonts/OFL.txt" && /\.(html|xml|json|txt|css)$|^_headers$/.test(f));
for (const f of ["index.html", "404.html", "robots.txt", "_headers", "_redirects"]) if (!fs.existsSync(path.join(DIR, f))) bad("old-path", `${f} is missing from the tree`);
for (const f of SITE_TEXT) {
  const t = fs.readFileSync(path.join(DIR, f), "utf8");
  // as a path (/NAME), not a substring: "display" does not name /play/
  // (redirect sources are plain lowercase names: no regex characters to escape)
  const named = OLD.filter((p) => new RegExp("/" + p + "(?![A-Za-z0-9_-])").test(t));
  if (named.length) bad("old-path", `${f} names ${named.join(" ")}`);
}
if (SITE_TEXT.length) ok("old-path", `checked ${SITE_TEXT.length} site text files for ${OLD.map((p) => "/" + p).join(" ")}`);
else bad("old-path", "no site text files to check");
for (const p of OLD) fs.existsSync(path.join(DIR, p)) ? bad("old-path", `${p} exists in the tree`) : ok("old-path", `/${p}/ is only a redirect`);

// wasm: one, content-named, and what the page points at
const wasms = files.filter((f) => f.endsWith(".wasm"));
const WASM = wasms.length === 1 ? wasms[0] : null;
const m = WASM && WASM.match(/^w\/([0-9a-f]{16})\/phantom-burn\.wasm$/);
if (!m) bad("wasm", `want one wasm at w/<sha16>/phantom-burn.wasm, found: ${wasms.join(" ") || "none"}`);
else if (sha(fs.readFileSync(path.join(DIR, WASM))).slice(0, 16) !== m[1]) bad("wasm", `${WASM} does not hash to its name`);
else ok("wasm", `the wasm is w/${m[1]}/phantom-burn.wasm, named by its sha256`);
const page = fs.readFileSync(path.join(DIR, SLUG, "index.html"), "utf8");
m && page.includes(`data-wasm="/w/${m[1]}/phantom-burn"`) && !page.includes('data-wasm="phantom-burn"')
  ? ok("wasm", "the page's data-wasm names it") : bad("wasm", "the page's data-wasm does not name the staged wasm");

// every request the boots make, to see where the page took its wasm from
const asked = new Set();
const handler = createHandler(DIR);
// title-room: while holdRoom is set, the title's root room answers that much later
let holdRoom = 0;
const server = http.createServer((req, res) => {
  asked.add(decodeURIComponent(req.url.split("?")[0]));
  if (holdRoom && req.url.includes("/assets/floors/root-room/")) setTimeout(() => handler(req, res), holdRoom);
  else handler(req, res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;
async function get(p) {
  const r = await fetch(BASE + p, { redirect: "manual" });
  return { status: r.status, type: r.headers.get("content-type") || "", robots: r.headers.get("x-robots-tag") || "",
           location: r.headers.get("location") || "", body: Buffer.from(await r.arrayBuffer()) };
}

// tree: the site's own files
{
  const want = ["style.css", "logo.png", "favicon.png", "favicon.ico", "mark.png", "fonts/OFL.txt", "fonts/JetBrainsMono-Regular.woff2", "fonts/JetBrainsMono-Bold.woff2", "fonts/JetBrainsMono-Italic.woff2", "news/index.html", "version.json"];
  const missing = want.filter((f) => !files.includes(f));
  missing.length ? bad("tree", `missing: ${missing.join(", ")}`) : ok("tree", `the site's ${want.length} named files are staged`);
}
// root, robots
const root = await get("/");
const rootText = root.body.toString("utf8");
root.status === 200 && root.type.startsWith("text/html") && rootText.includes(`href="/${SLUG}/"`)
  ? ok("root", `/ is 200 html and links /${SLUG}/`) : bad("root", `/ is ${root.status} ${root.type}, links /${SLUG}/: ${rootText.includes(`href="/${SLUG}/"`)}`);
const robots = await get("/robots.txt");
const robotsText = robots.body.toString();
robots.status === 200 && /User-agent:\s*\*/i.test(robotsText) && /^Allow:\s*\/\s*$/mi.test(robotsText) && !/^Disallow:\s*\S/mi.test(robotsText)
  ? ok("robots", "allows everything") : bad("robots", `status ${robots.status}: ${robotsText.slice(0, 60)}`);

// files, indexable
// a <meta> for robots (or a named crawler) whose content says noindex, its
// attributes in any order
const asksNoindex = (html) => [...html.matchAll(/<meta\b[^>]*>/gi)].some(([m]) =>
  /\bname\s*=\s*["']?(robots|googlebot|bingbot)\b/i.test(m) && /\bcontent\s*=\s*["'][^"']*noindex/i.test(m));
let served = 0, noidx = 0;
const noidxFiles = [];   // one FAIL line for all of them, below
for (const f of files) {
  if (f === "_headers" || f === "_redirects") continue;   // consumed by Pages, never served
  const url = "/" + f.split("/").map(encodeURIComponent).join("/");
  const r = await get(url.endsWith("/index.html") ? url.slice(0, -"index.html".length) : url);
  const same = r.status === 200 && sha(r.body) === sha(fs.readFileSync(path.join(DIR, f)));
  const htmlOk = f.endsWith(".html") || !r.type.startsWith("text/html");
  if (same && htmlOk) served++; else bad("files", `${f}: ${r.status} ${r.type}${same ? "" : " (bytes differ)"}`);
  if (/noindex/.test(r.robots)) { noidx++; noidxFiles.push(f); }
  if (f.endsWith(".html") && f !== "404.html" && asksNoindex(fs.readFileSync(path.join(DIR, f), "utf8"))) { noidx++; bad("indexable", `${f} asks not to be indexed`); }
}
const nfiles = files.filter((f) => f !== "_headers" && f !== "_redirects").length;
if (served === nfiles) ok("files", `${served} of ${nfiles} served byte for byte`);
if (!asksNoindex(fs.readFileSync(path.join(DIR, "404.html"), "utf8"))) { noidx++; bad("indexable", "404.html does not ask not to be indexed"); }
if (noidxFiles.length) bad("indexable", `${noidxFiles.length} files are served with X-Robots-Tag: noindex, e.g. ${noidxFiles.filter((f) => !f.startsWith(SLUG + "/")).slice(0, 5).join(", ")}`);
if (noidx === 0) ok("indexable", `none of ${nfiles} files carries X-Robots-Tag: noindex; 404.html alone says noindex`);

// missing
const four = fs.existsSync(path.join(DIR, "404.html")) ? fs.readFileSync(path.join(DIR, "404.html")) : Buffer.from("(no 404.html)");
for (const p of ["/no-such-page", `/${SLUG}/no-such-file.js`, "/p-aaaaaaaaaa/", "/_headers", "/_redirects", `/${SLUG}/phantom-burn.wasm`, "/w/0000000000000000/phantom-burn.wasm"]) {
  const r = await get(p);
  r.status === 404 && sha(r.body) === sha(four)
    ? ok("missing", `${p} is a 404 with 404.html`) : bad("missing", `${p}: ${r.status}`);
}
const slash = await get(`/${SLUG}`);
slash.status === 308 && slash.location === `/${SLUG}/` ? ok("slash", `/${SLUG} redirects to /${SLUG}/`) : bad("slash", `${slash.status} -> ${slash.location}`);
// redirect: each rule, with a sample path under a splat
for (const r of REDIRECTS) {
  const tail = r.from.endsWith("/*") ? "assets/sigil-web-app.js" : "";
  const from = r.from.endsWith("/*") ? r.from.slice(0, -1) + tail : r.from;
  const want = r.to.replace(":splat", tail);
  // with a query string, which Pages keeps (?go=14 must survive the move)
  const g = await get(from + "?go=14");
  g.status === r.status && g.location === want + "?go=14" ? ok("redirect", `${from}?go=14 ${r.status} -> ${want}?go=14`) : bad("redirect", `${from}?go=14: ${g.status} -> ${g.location} (want ${r.status} -> ${want}?go=14)`);
}
if (!REDIRECTS.some((r) => r.to.startsWith(`/${SLUG}/`))) bad("redirect", `no rule sends anything to /${SLUG}/`);

// the site's pages in Chrome (scripts/check-site-pages.mjs); a setup failure there is the whole gate's
{
  const built = (fs.readFileSync(MAN, "utf8").match(/^# built (.*)$/m) || [])[1] || "";
  const headSha = (fs.readFileSync(MAN, "utf8").match(/^# head (\S+)$/m) || [])[1] || "";
  const STAMP = /\(runner build\)$/.test(built) ? built.slice(0, 12) : `local-${headSha.slice(0, 12)}`;
  try { await pageLegs({ DIR, BASE, SLUG, STAMP, REPO, ok, bad }); }
  catch (e) { console.log(/^Error: SETUP-FAILED/.test(String(e)) ? String(e).replace(/^Error: /, "") : `SETUP-FAILED: the page legs threw: ${e && e.stack || e}`); server.close(); try { fs.rmSync(DIR + ".verified"); } catch { /* none */ } process.exit(2); }
}

// boots (what the page requests is recorded from here on: the probes above are not the page's)
asked.clear();
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
// root console's screen is violet (C-GIBSON); the bare title has none.
{
  holdRoom = 12000;
  const png = "/tmp/phantom-check-site-title-room.png";
  const r = await new Promise((resolve) => {
    const ch = spawn("node", [path.join(REPO, "scripts/shot-web.mjs"), DIR, png,
      "--url", `${BASE}/${SLUG}/`, "--wait", "14000"]);
    let o = "";
    ch.stdout.on("data", (d) => { o += d; }); ch.stderr.on("data", (d) => { o += d; });
    const kill = setTimeout(() => ch.kill("SIGKILL"), 200000);
    ch.on("close", (code) => { clearTimeout(kill); resolve({ status: code, out: o }); });
  });
  holdRoom = 0;
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
// webgl (2026-09-29: a visitor with no WebGL 2 got "Failed to start:
// sigil_wasm_start failed (rc -1)"): scripts/webgl-check.mjs in each mode.
// off (Chrome's --disable-webgl) and webgl1 (getContext("webgl2") null):
// the message, and the wasm never requested; late (null on #stage alone):
// the game's failure turns into the message; on, the positive control: the
// game boots and there is no message.
for (const mode of ["off", "webgl1", "late", "on"]) {
  const r = await new Promise((resolve) => {
    const ch = spawn("node", [path.join(REPO, "scripts/webgl-check.mjs"), "--url", `${BASE}/${SLUG}/`, "--mode", mode,
      "--query", mode === "on" ? "hud=0" : "", "--wait", "2500", "--shot", `/tmp/phantom-check-site-webgl-${mode}.png`]);
    let o = "";
    ch.stdout.on("data", (d) => { o += d; }); ch.stderr.on("data", (d) => { o += d; });
    const kill = setTimeout(() => ch.kill("SIGKILL"), 200000);
    ch.on("close", (code) => { clearTimeout(kill); resolve({ status: code, out: o }); });
  });
  const verdict = r.out.trim().split("\n").pop();
  r.status === 0 && verdict === `PASS ${mode}`
    ? ok("webgl", `${mode}: ${{ off: "WebGL off: the message, no wasm fetched", webgl1: "WebGL 1 only: the message, no wasm fetched",
                               late: "no context for the game's canvas: the message, not the raw error", on: "WebGL 2: the game boots, no message" }[mode]}`)
    : bad("webgl", `${mode}: rc ${r.status}: ${r.out.split("\n").filter((l) => /FAIL|SETUP|TIMED/.test(l)).join(" | ").slice(0, 400)}`);
}
server.close();
if (m) {
  const want = `/w/${m[1]}/phantom-burn.wasm`;
  const other = [...asked].filter((u) => u.endsWith(".wasm") && u !== want);
  asked.has(want) && other.length === 0
    ? ok("boots", "the page fetched its wasm from /w/<sha16>/ and no other wasm")
    : bad("boots", `the page's wasm requests: ${[...asked].filter((u) => u.endsWith(".wasm")).join(" ") || "none"}`);
}

if (fail === 0) {
  fs.writeFileSync(DIR + ".verified",
    `manifest-sha256 ${sha(fs.readFileSync(MAN))}\n` + gateHashes.map(([g, h]) => `gate ${h} ${g}`).join("\n") +
    `\ngate-head ${head}\ngate-clean ${clean ? "yes" : "no"}\nat ${new Date().toISOString()}\n`);
  console.log(`GREEN: ${pass} pass, 0 fail -> ${DIR}.verified${clean ? "" : " (NOTE: tracked changes in the checkout; publish-web will refuse)"}`);
  process.exit(0);
}
try { fs.rmSync(DIR + ".verified"); } catch { /* none */ }
console.log(`RED: ${pass} pass, ${fail} fail`);
process.exit(1);

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
