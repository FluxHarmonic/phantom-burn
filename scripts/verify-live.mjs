#!/usr/bin/env node
// verify-live.mjs - check a deployment of phantomburn.net against the staged
// tree it was published from.
//
//   node scripts/verify-live.mjs https://<id>.phantomburn.pages.dev build/site
//
// Every file of DIR.manifest (but _headers) is fetched and must be 200 and
// byte for byte the staged file, with X-Robots-Tag: noindex, and nothing but
// .html may come back as html (a missing file on Pages is its 404 page or,
// with no 404.html, the root page with a 200:
// topics/cloudflare-pages-serves-index-for-a-missing-path). A missing path
// must be a 404 with 404.html's body. The edge can serve the previous
// deployment for up to a minute, so a mismatch is retried for 90 s before it
// counts. Exit 0 green, 1 red, 2 setup failed.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const [BASE0, DIR0] = process.argv.slice(2);
if (!BASE0 || !DIR0) { console.log("usage: verify-live.mjs URL DIR"); process.exit(2); }
const BASE = BASE0.replace(/\/$/, ""), DIR = path.resolve(DIR0.replace(/\/$/, ""));
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const lines = fs.readFileSync(DIR + ".manifest", "utf8").split("\n").filter((l) => l && !l.startsWith("#"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
  if (!/noindex/.test(r.headers.get("x-robots-tag") || "")) why.push("no noindex");
  return why;
}
let fail = 0;
for (const l of lines) {
  const [h, f] = [l.slice(0, 64), l.slice(66)];
  if (f === "_headers") continue;
  let why = await check(f, h);
  for (let t = 0; why.length && t < 9; t++) { await sleep(10000); why = await check(f, h); }
  if (why.length) { fail++; console.log(`  FAIL ${f}: ${why.join(", ")}`); }
}
const four = sha(fs.readFileSync(path.join(DIR, "404.html")));
const miss = await fetch(BASE + "/no-such-page-" + Date.now());
const mb = Buffer.from(await miss.arrayBuffer());
if (miss.status !== 404 || sha(mb) !== four) { fail++; console.log(`  FAIL missing path: ${miss.status}, ${sha(mb) === four ? "404.html" : "not 404.html"}`); }
console.log(fail ? `RED: ${fail} failed of ${lines.length} files + the 404` : `GREEN: ${lines.length - 1} files byte for byte with noindex, and a real 404, at ${BASE}`);
process.exit(fail ? 1 : 0);
