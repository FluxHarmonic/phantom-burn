#!/usr/bin/env node
// verify-live.mjs - check a deployment of phantomburn.net against the staged
// tree it was published from (after Harkfell's scripts/verify-live.mjs).
//
//   node scripts/verify-live.mjs https://<id>.phantomburn.pages.dev build/site
//   node scripts/verify-live.mjs http://127.0.0.1:8819 build/site --wrangler-dev
//
// files         every file of DIR.manifest (but _headers and the @ lines,
//               functions/ and wrangler.jsonc) is 200 and byte for byte the
//               staged file, with no X-Robots-Tag: noindex (public from 0.1),
//               and nothing but .html comes back as html. The wasm,
//               w/<sha16>/phantom-burn.wasm, is fetched through the Pages
//               Function (from R2) like any file. The edge can serve the
//               previous deployment for up to a minute, so a mismatch is
//               retried for 90 s before it counts; every retry is logged.
// wasm-headers  the wasm: application/wasm, an immutable cache, CORP
//               same-origin, COEP require-corp (the Function's own headers).
//               A 404 from the wasm route right after a deploy is retried
//               after 2, 4 and 8 s, each retry logged, before it counts
//               (Harkfell's t-975606: twice on 2026-09-29 the R2-backed wasm
//               answered 404 just after a deploy and 200 seconds later, which
//               failed a publish whose production was already live).
// version       /version.json is served no-store as JSON.
// wasm-wire     the wasm arrives br- or gzip-encoded (a raw request that does
//               not decompress, asking as a browser asks) and decompresses to
//               the wasm its name promises. Identity is a FAIL on a deployment;
//               under --wrangler-dev it is allowed and named (the local server
//               need not compress).
// redirect      every _redirects rule answers its status and Location (the
//               game's earlier paths 301 to /badge-in/, the rest of the path and
//               the query string kept: /play/?go=14 -> /badge-in/?go=14).
// missing       a missing page, a missing file under the game, the old
//               /<game>/phantom-burn.wasm, /_headers and /_redirects answer 404 with the
//               staged 404.html byte for byte; a missing wasm key answers the
//               Function's own 404. Under --wrangler-dev /_headers may be 502
//               (wrangler's local asset server).
// The game's path is read from the manifest's header (# game NAME).
// Exit 0 green, 1 red, 2 setup failed.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";
import crypto from "node:crypto";
const WDEV = process.argv.includes("--wrangler-dev");
const [BASE0, DIR0] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!BASE0 || !DIR0) { console.log("usage: verify-live.mjs URL DIR [--wrangler-dev]"); process.exit(2); }
const BASE = BASE0.replace(/\/$/, ""), DIR = path.resolve(DIR0.replace(/\/$/, ""));
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const lines = fs.readFileSync(DIR + ".manifest", "utf8").split("\n").filter((l) => l && !l.startsWith("#"));
const entries = lines.map((l) => ({ h: l.slice(0, 64), f: l.slice(66) })).filter((e) => !e.f.startsWith("@") && e.f !== "_headers" && e.f !== "_redirects");
const SLUG = (fs.readFileSync(DIR + ".manifest", "utf8").match(/^# game (\S+)$/m) || [])[1];
if (!SLUG) { console.log("SETUP-FAILED: the manifest names no game path (# game)"); process.exit(2); }
const hide = (s) => s;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// t-975606: the wasm route can answer 404 for a few seconds after a deploy.
// Fetch it again after 2, 4 and 8 s while it says 404, and say so each time;
// any other status is returned at once (only the known race is waited out).
const WASM_BACKOFF = [2000, 4000, 8000];
async function fetchWasm(url, init, leg) {
  let r = await fetch(url, init);
  for (const ms of WASM_BACKOFF) {
    if (r.status !== 404) break;
    await r.arrayBuffer();
    console.log(`  retry ${leg}: ${url.replace(BASE, "")} answered 404; again in ${ms / 1000} s`);
    await sleep(ms);
    r = await fetch(url, init);
  }
  return r;
}
let failed = 0;
const pass = (leg, what) => console.log(`  ok   ${leg}: ${what}`);
const fail = (leg, what) => { failed++; console.log(`  FAIL ${leg}: ${hide(what)}`); };

// ---- files --------------------------------------------------------------------------
async function check(f, wantSha) {
  let url = "/" + f.split("/").map(encodeURIComponent).join("/");
  if (url.endsWith("/index.html")) url = url.slice(0, -"index.html".length);
  const r = await fetch(BASE + url, { redirect: "follow" });
  const body = Buffer.from(await r.arrayBuffer());
  const type = r.headers.get("content-type") || "";
  const why = [];
  if (r.status !== 200) why.push(`status ${r.status}`);
  if (sha(body) !== wantSha) why.push("bytes differ");
  if (!f.endsWith(".html") && type.startsWith("text/html")) why.push(`served as ${type}`);
  // the wasm's Function says noindex on purpose (a binary is no page); the site's files must not
  if (!f.startsWith("w/") && /noindex/.test(r.headers.get("x-robots-tag") || "")) why.push(`X-Robots-Tag: ${r.headers.get("x-robots-tag")}`);
  return why;
}
let bad = 0;
for (const { h, f } of entries) {
  let why = await check(f, h);
  for (let t = 0; why.length && t < 9; t++) {
    console.log(`  retry files: ${f}: ${why.join(", ")}; again in 10 s (${t + 1} of 9)`);
    await sleep(10000); why = await check(f, h);
  }
  if (why.length) { bad++; fail("files", `${f}: ${why.join(", ")}`); }
}
if (!bad) pass("files", `${entries.length} files byte for byte, none noindex (the wasm through the Function)`);

// ---- the wasm -------------------------------------------------------------------------
const wasm = entries.find((e) => /^w\/[0-9a-f]{16}\/phantom-burn\.wasm$/.test(e.f));
if (!wasm) fail("wasm-headers", "the manifest names no w/<sha16>/phantom-burn.wasm");
else {
  const r = await fetchWasm(`${BASE}/${wasm.f}`, { headers: { "accept-encoding": "br, gzip" } }, "wasm-headers");
  await r.arrayBuffer();
  const h = (n) => r.headers.get(n) || "";
  const detail = [];
  if (!h("content-type").startsWith("application/wasm")) detail.push(`content-type "${h("content-type")}"`);
  if (!/immutable/.test(h("cache-control")) || !/max-age=\d{7,}/.test(h("cache-control"))) detail.push(`cache-control "${h("cache-control")}"`);
  if (h("cross-origin-resource-policy") !== "same-origin") detail.push(`CORP "${h("cross-origin-resource-policy")}"`);
  if (h("cross-origin-embedder-policy") !== "require-corp") detail.push(`COEP "${h("cross-origin-embedder-policy")}"`);
  if (detail.length) fail("wasm-headers", detail.join("; "));
  else pass("wasm-headers", `${h("content-type")}, ${h("cache-control")}, CORP same-origin, COEP require-corp`);

  const url = new URL(`${BASE}/${wasm.f}`);
  const rawGet = () => new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.get(url, { headers: { "accept-encoding": "br, gzip" } }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, enc: res.headers["content-encoding"] || "identity", body: Buffer.concat(chunks) }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(120000, () => req.destroy(new Error("timed out after 120 s")));
  }).catch((e) => ({ error: e.message }));
  let raw = await rawGet();
  for (const ms of WASM_BACKOFF) {   // t-975606, as fetchWasm
    if (raw.status !== 404) break;
    console.log(`  retry wasm-wire: /${wasm.f} answered 404; again in ${ms / 1000} s`);
    await sleep(ms);
    raw = await rawGet();
  }
  const want = wasm.f.split("/")[1];
  if (raw.error) fail("wasm-wire", `${wasm.f}: ${raw.error}`);
  else if (raw.status !== 200) fail("wasm-wire", `${wasm.f} answered ${raw.status}`);
  else if (raw.enc === "identity") {
    if (WDEV && sha(raw.body).slice(0, 16) === want) pass("wasm-wire", `identity (${raw.body.length} bytes), allowed under --wrangler-dev; the bytes are the wasm its name promises`);
    else fail("wasm-wire", `${wasm.f} arrived identity-encoded, ${raw.body.length} bytes on the wire: nothing is compressing it`);
  } else {
    let decoded = null;
    try { decoded = raw.enc === "br" ? zlib.brotliDecompressSync(raw.body) : zlib.gunzipSync(raw.body); } catch (e) { fail("wasm-wire", `the ${raw.enc} body does not decompress: ${e.message}`); }
    if (decoded) {
      if (sha(decoded).slice(0, 16) !== want) fail("wasm-wire", `the ${raw.enc} body decodes to ${decoded.length} bytes hashing ${sha(decoded).slice(0, 16)}, not ${want}`);
      else pass("wasm-wire", `${raw.enc}: ${raw.body.length} bytes on the wire for ${decoded.length} (${(100 * raw.body.length / decoded.length).toFixed(1)}%), the wasm its name promises`);
    }
  }
}

// ---- version --------------------------------------------------------------------------
{
  const r = await fetch(`${BASE}/version.json`);
  await r.arrayBuffer();
  const cc = r.headers.get("cache-control") || "", ct = r.headers.get("content-type") || "";
  r.status === 200 && /no-store/.test(cc) && /^application\/json/.test(ct)
    ? pass("version", `/version.json 200, ${ct}, cache-control ${cc}`)
    : fail("version", `/version.json ${r.status}, content-type "${ct}", cache-control "${cc}" (want 200 application/json no-store)`);
}

// ---- redirect -------------------------------------------------------------------------
{
  const rfile = path.join(DIR, "_redirects");
  const rules = fs.existsSync(rfile) ? fs.readFileSync(rfile, "utf8").split("\n").map((l) => l.replace(/#.*/, "").trim()).filter(Boolean)
    .map((l) => { const [from, to, st] = l.split(/\s+/); return { from, to, status: st ? Number(st) : 302 }; }) : [];
  const why = [];
  for (const r of rules) {
    const tail = r.from.endsWith("/*") ? "assets/sigil-web-app.js" : "";
    const from = r.from.endsWith("/*") ? r.from.slice(0, -1) + tail : r.from;
    const want = r.to.replace(":splat", tail);
    // with a query string: it must survive the move (?go=14 still goes to floor 14)
    const g = await fetch(BASE + from + "?go=14", { redirect: "manual" });
    await g.arrayBuffer();
    const loc = (g.headers.get("location") || "").replace(BASE, "");
    if (g.status !== r.status || loc !== want + "?go=14") why.push(`${from}?go=14: ${g.status} -> ${loc} (want ${r.status} -> ${want}?go=14)`);
  }
  if (!rules.length) fail("redirect", "no _redirects rules in the tree");
  else if (why.length) fail("redirect", why.join("; "));
  else pass("redirect", `${rules.length} rules: ${rules.map((r) => `${r.from} ${r.status} -> ${r.to}`).join(", ")}`);
}

// ---- missing --------------------------------------------------------------------------
{
  const fourSha = sha(fs.readFileSync(path.join(DIR, "404.html")));
  const probes = [`/no-such-page-${Date.now()}`, `/${SLUG}/no-such-file.js`, `/${SLUG}/phantom-burn.wasm`, "/_headers", "/_redirects", `/w/${"0".repeat(16)}/phantom-burn.wasm`];
  const why = [];
  for (const p of probes) {
    const r = await fetch(BASE + p);
    const b = Buffer.from(await r.arrayBuffer());
    if (WDEV && (p === "/_headers" || p === "/_redirects") && r.status === 502) continue;
    if (r.status !== 404) { why.push(`${p} ${r.status}`); continue; }
    if (!p.startsWith("/w/") && sha(b) !== fourSha) why.push(`${p} 404 but not 404.html`);
  }
  if (why.length) fail("missing", why.join(", "));
  else pass("missing", `${probes.length} probes 404 (the site's 404.html; the Function's own for a missing wasm)${WDEV ? "; /_headers 502 allowed under --wrangler-dev" : ""}`);
}

console.log(failed ? `RED: ${failed} failed at ${BASE}` : `GREEN at ${BASE}`);
process.exit(failed ? 1 : 0);
