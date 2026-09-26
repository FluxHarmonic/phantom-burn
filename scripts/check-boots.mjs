#!/usr/bin/env node
// check-boots.mjs - Phantom Burn's own legs of substratic's check-site (its
// "arm", named in substratic.sgv): what the shared legs cannot know about
// this game. check-site runs it while its loopback server serves the staged
// tree, and relays these lines; the legs were scripts/check-site.mjs's
// (842b520) before the shared tools took the rest.
//
//   node scripts/check-boots.mjs BASE DIR     (BASE: http://127.0.0.1:PORT)
//
//   root       / has no link (<a) and does not name the game's path: the
//              placeholder root never leads anyone to the game
//   redirect   some _redirects rule sends its path to /<game>/ (the game's
//              first path keeps working, David 2026-09-26)
//   boots      the game at /<game>/ and its title (?title=1) boot in headless
//              Chrome (scripts/shot-web.mjs: --mute-audio and the worker-null
//              sink) through that server with no console error
// Exit 0 green, 1 red, 2 setup failed.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const [BASE0, DIR0] = process.argv.slice(2);
if (!BASE0 || !DIR0) { console.log("SETUP-FAILED: usage: check-boots.mjs BASE DIR"); process.exit(2); }
const BASE = BASE0.replace(/\/$/, ""), DIR = path.resolve(DIR0.replace(/\/$/, ""));
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const man = fs.readFileSync(DIR + ".manifest", "utf8");
const SLUG = (man.match(/^# game (\S+)$/m) || [])[1];
if (!SLUG) { console.log("SETUP-FAILED: the manifest names no game path (# game)"); process.exit(2); }

let fail = 0;
const ok = (leg, what) => console.log(`  ok   ${leg}: ${what}`);
const bad = (leg, what) => { fail++; console.log(`  FAIL ${leg}: ${what}`); };

// root
const r = await fetch(BASE + "/");
const rootText = await r.text();
!/<a[\s>]/i.test(rootText) && !rootText.includes(SLUG)
  ? ok("root", "/ has no link and does not name the game's path")
  : bad("root", `/ links ${/<a[\s>]/i.test(rootText)}, names the game's path ${rootText.includes(SLUG)}`);

// redirect: the old path goes to the game
const rfile = path.join(DIR, "_redirects");
const rules = fs.existsSync(rfile) ? fs.readFileSync(rfile, "utf8").split("\n").map((l) => l.replace(/#.*/, "").trim()).filter(Boolean) : [];
rules.some((l) => (l.split(/\s+/)[1] || "").startsWith(`/${SLUG}/`))
  ? ok("redirect", `a _redirects rule sends its path to /${SLUG}/`) : bad("redirect", `no rule sends anything to /${SLUG}/`);

// boots
for (const [q, want] of [["hud=0", "game"], ["title=1", "title"]]) {
  const res = await new Promise((resolve) => {
    const ch = spawn(process.execPath, [path.join(REPO, "scripts/shot-web.mjs"), DIR, `/tmp/phantom-check-site-${want}.png`,
      "--url", `${BASE}/${SLUG}/`, "--query", q, "--wait", "2500"]);
    let o = "";
    ch.stdout.on("data", (d) => { o += d; }); ch.stderr.on("data", (d) => { o += d; });
    const kill = setTimeout(() => ch.kill("SIGKILL"), 200000);
    ch.on("close", (code) => { clearTimeout(kill); resolve({ status: code, out: o }); });
  });
  res.status === 0 && /shot ->/.test(res.out) ? ok("boots", `the ${want} boots at /${SLUG}/?${q} with no console error`)
    : bad("boots", `the ${want} at /${SLUG}/?${q}: rc ${res.status}: ${res.out.split("\n").filter((l) => !/^retry/.test(l)).slice(0, 3).join(" | ").slice(0, 300)}`);
}
process.exit(fail ? 1 : 0);
