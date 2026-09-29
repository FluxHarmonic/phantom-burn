#!/usr/bin/env node
// check-site.mjs - the local gate for a staged phantomburn.net tree (a
// private preview: lighter than Harkfell's verify-site.mjs, the same idea).
//
//   node scripts/check-site.mjs build/site
//
// Serves the tree on loopback through scripts/serve-site.mjs (Pages' rules:
// the tree's own _headers, real 404s from 404.html, pretty URLs) and checks:
//   manifest   the tree still hashes to build/site.manifest
//   old-path   the game's first path (each _redirects source) is in no public
//              file but _redirects, and has no directory in the tree
//   root       / is 200 html with no link (<a) and no game path
//   robots     /robots.txt disallows everything
//   noindex    every response carries X-Robots-Tag: noindex
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
import { createHandler, parseRedirects } from "./serve-site.mjs";

const DIR = path.resolve((process.argv[2] || "").replace(/\/$/, ""));
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
if (!process.argv[2] || !fs.existsSync(path.join(DIR, "index.html"))) { console.log(`SETUP-FAILED: ${DIR}/index.html missing`); process.exit(2); }
const MAN = DIR + ".manifest";
if (!fs.existsSync(MAN)) { console.log(`SETUP-FAILED: ${MAN} missing (scripts/stage-web)`); process.exit(2); }
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const GATES = ["scripts/check-site.mjs", "scripts/serve-site.mjs", "scripts/tree-manifest"];
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
for (const f of ["index.html", "404.html", "robots.txt", "_headers", "_redirects"]) {
  if (!fs.existsSync(path.join(DIR, f))) { bad("old-path", `${f} is missing from the tree`); continue; }
  if (f === "_redirects") continue;
  const t = fs.readFileSync(path.join(DIR, f), "utf8");
  // as a path (/NAME), not a substring: "display" does not name /play/
  // (redirect sources are plain lowercase names: no regex characters to escape)
  const named = OLD.filter((p) => new RegExp("/" + p + "(?![A-Za-z0-9_-])").test(t));
  named.length ? bad("old-path", `${f} names ${named.join(" ")}`) : ok("old-path", `${f} names no old path`);
}
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
const server = http.createServer((req, res) => { asked.add(decodeURIComponent(req.url.split("?")[0])); handler(req, res); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;
async function get(p) {
  const r = await fetch(BASE + p, { redirect: "manual" });
  return { status: r.status, type: r.headers.get("content-type") || "", robots: r.headers.get("x-robots-tag") || "",
           location: r.headers.get("location") || "", body: Buffer.from(await r.arrayBuffer()) };
}

// root, robots
const root = await get("/");
const rootText = root.body.toString("utf8");
root.status === 200 && root.type.startsWith("text/html") && !/<a[\s>]/i.test(rootText) && !rootText.includes(SLUG)
  ? ok("root", "/ is 200 html, no link, no game path") : bad("root", `/ is ${root.status} ${root.type}, links ${/<a[\s>]/i.test(rootText)}`);
const robots = await get("/robots.txt");
robots.status === 200 && /User-agent:\s*\*/.test(robots.body.toString()) && /^Disallow:\s*\/\s*$/m.test(robots.body.toString())
  ? ok("robots", "disallows everything") : bad("robots", `status ${robots.status}: ${robots.body.toString().slice(0, 60)}`);

// files, noindex
let served = 0, noidx = 0;
for (const f of files) {
  if (f === "_headers" || f === "_redirects") continue;   // consumed by Pages, never served
  const url = "/" + f.split("/").map(encodeURIComponent).join("/");
  const r = await get(url.endsWith("/index.html") ? url.slice(0, -"index.html".length) : url);
  const same = r.status === 200 && sha(r.body) === sha(fs.readFileSync(path.join(DIR, f)));
  const htmlOk = f.endsWith(".html") || !r.type.startsWith("text/html");
  if (same && htmlOk) served++; else bad("files", `${f}: ${r.status} ${r.type}${same ? "" : " (bytes differ)"}`);
  if (/noindex/.test(r.robots)) noidx++; else bad("noindex", `${f} has no X-Robots-Tag: noindex`);
}
const nfiles = files.filter((f) => f !== "_headers" && f !== "_redirects").length;
if (served === nfiles) ok("files", `${served} of ${nfiles} served byte for byte`);
if (noidx === nfiles) ok("noindex", `all ${noidx} files carry X-Robots-Tag: noindex`);

// missing
const four = fs.existsSync(path.join(DIR, "404.html")) ? fs.readFileSync(path.join(DIR, "404.html")) : Buffer.from("(no 404.html)");
for (const p of ["/no-such-page", `/${SLUG}/no-such-file.js`, "/p-aaaaaaaaaa/", "/_headers", "/_redirects", `/${SLUG}/phantom-burn.wasm`, "/w/0000000000000000/phantom-burn.wasm"]) {
  const r = await get(p);
  r.status === 404 && sha(r.body) === sha(four) && /noindex/.test(r.robots)
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
