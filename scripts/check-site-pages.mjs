// check-site-pages.mjs - the site's own pages in headless Chrome, for
// scripts/check-game.mjs (the arm substratic's check-site runs). Ported from Harkfell's
// verify-site.mjs (its landing, carousel, contrast, news, feeds, version,
// preview, crosslink and console legs), in phantomburn.net's names.
//
//   import { pageLegs } from "./check-site-pages.mjs";
//   await pageLegs({ DIR, BASE, SLUG, STAMP, REPO, ok, bad });
//
// BASE is check-site's own server (serve-site.mjs's handler over DIR), so the
// pages load through the same Pages rules the other legs use. Legs:
//   landing    / in Chrome: title, the h1's logo image (the game's own, 2x,
//              alt "Phantom Burn"), the three JetBrains Mono faces
//              loaded (not a fallback), every image decoded, BADGE IN
//              resolving to /<game>/, the source, license, font license and
//              news links, no em dash in the rendered text, every request 2xx
//   carousel   the pictures change by themselves, a click on a dot shows that
//              picture and its caption, one shows at a time, and under
//              prefers-reduced-motion nothing changes by itself
//   contrast   BADGE IN's text against its background, plain and with
//              :hover, :focus-visible and :active forced: at least 4.5:1
//   phone      at 390 CSS px wide (a phone, emulated), /, /news/ and the post
//              have no horizontal scroll and BADGE IN fits on screen
//   badge-in   a real click on BADGE IN lands on /<game>/ and the game says
//              "phantom-burn: ready"
//   news       /news/ lists every post in news/*.md, newest first; each post
//              page answers with its title, date and version
//   feeds      feed.xml (RSS 2.0, parsed by the browser's XML parser) and
//              feed.json (JSON Feed 1.1) list every post as /news/ does,
//              newest first, every URL absolute under https://phantomburn.net;
//              <link rel="alternate"> on / and /news/; a visible RSS link
//   version    /version.json: exactly its five fields, the staged build's
//              stamp, package.sgl's version, that version's post and its
//              summary (printable ASCII, at most 120 characters), served
//              no-store as JSON
//   preview    og:image and twitter:image are shots/og.png, a 1200x630 PNG in
//              the tree served as image/png, with type, size and alt;
//              twitter:card summary_large_image
//   crosslink  the landing's footer links Crash The Stack and Harkfell beside
//              the Flux Harmonic mark
//   em-dash    no em dash in any of the site's own text files (the game's
//              directory and the wasm are not the site's copy)
//   console    no console error, exception or failed request on /, /news/,
//              each post, and the 404 page
//   analytics  (scripts/plausible-check.mjs) every HTML page in the tree, the
//              game's included, carries David's Plausible snippet exactly
//              once, in <head>, with phantomburn.net's script ID and no
//              other site's; in Chrome, against a stub plausible.io (no
//              internet: the stub answers every https://plausible.io/*
//              request), each page the legs above visit loads the script
//              and sends a pageview for phantomburn.net that the stub
//              accepts (202, seen by the page)
//   privacy    the landing's footer says "Privacy-friendly analytics by
//              Plausible: no cookies, no personal data."
//   analytics-down  with plausible.io unreachable (every request refused),
//              / and the game still work: no error but the refused
//              plausible.io requests themselves, and the game says ready
// Chrome runs muted, into the worker-null sink (worker-instructions: no audio
// on David's speakers). Throws on a setup failure; check-site reports that as
// SETUP-FAILED.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { auditTree, plausibleStub, isPlausibleFailure, PRIVACY } from "./plausible-check.mjs";

const PLAUSIBLE_ID = "pa-GxdOlotIbYY0LzO4WRsIV";
const PLAUSIBLE_DOMAIN = "phantomburn.net";
const SITE = "https://phantomburn.net";
const DRAWABLE = /^[\x20-\x7e]*$/;
const SUMMARY_MAX = 120;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EM = /—|&mdash;|&#8212;|&#x2014;/i;

export async function pageLegs({ DIR, BASE, SLUG, STAMP, REPO, ok, bad }) {
  const text = (p) => fs.readFileSync(path.join(DIR, p), "utf8");

  // ---- em-dash (no browser): the site's own text files ----------------------------
  {
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
    const mine = walk(DIR).map((f) => path.relative(DIR, f))
      .filter((f) => !f.startsWith(SLUG + "/") && !f.startsWith("w/") && /\.(html|xml|json|txt|css)$|^_headers$|^_redirects$/.test(f) && f !== "fonts/OFL.txt");
    const dashed = mine.filter((f) => EM.test(text(f)));
    dashed.length ? bad("em-dash", `an em dash in ${dashed.join(", ")}`) : ok("em-dash", `none in the site's ${mine.length} text files`);
  }

  // ---- analytics (no browser): the tag on every HTML page ------------------------------
  {
    const { pages, problems } = auditTree(DIR, PLAUSIBLE_ID);
    // a floor: the pages that must be there, so an empty walk is no pass
    const must = ["index.html", "404.html", "news/index.html", `${SLUG}/index.html`];
    const absent = must.filter((p) => !pages.includes(p));
    if (absent.length) problems.push(`pages missing from the walk: ${absent.join(", ")}`);
    problems.length ? bad("analytics", problems.slice(0, 6).join("; "))
      : ok("analytics", `David's snippet with ${PLAUSIBLE_ID} (${PLAUSIBLE_DOMAIN}) once, in <head>, on all ${pages.length} HTML pages: ${pages.join(", ")}`);
  }

  // ---- the browser ------------------------------------------------------------------
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), "phantom-check-pages-chrome-"));
  spawnSync("sh", ["-c", "pactl list short sinks 2>/dev/null | grep -q worker-null || pactl load-module module-null-sink sink_name=worker-null >/dev/null 2>&1 || true"]);
  const chrome = spawn("google-chrome", [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--mute-audio",
    "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--enable-webgl", "--ignore-gpu-blocklist",
    "--remote-debugging-port=0", `--user-data-dir=${udd}`, "--window-size=1100,900", "about:blank",
  ], { stdio: "ignore", detached: true, env: { ...process.env, PULSE_SINK: "worker-null" } });
  const killChrome = () => { try { process.kill(-chrome.pid, "SIGKILL"); } catch { /* gone */ } try { fs.rmSync(udd, { recursive: true, force: true }); } catch { /* scratch */ } };
  process.on("exit", killChrome);
  try {
    let port = null;
    for (let i = 0; i < 100 && !port; i++) {
      try { port = fs.readFileSync(path.join(udd, "DevToolsActivePort"), "utf8").split("\n")[0]; } catch { await sleep(100); }
    }
    if (!port) throw new Error("SETUP-FAILED: Chrome wrote no DevToolsActivePort in 10 s (google-chrome on PATH?)");
    let pageWs = null;
    for (let i = 0; i < 50 && !pageWs; i++) {
      try { const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const p = list.find((t) => t.type === "page"); if (p) pageWs = p.webSocketDebuggerUrl; } catch { /* not up */ }
      if (!pageWs) await sleep(200);
    }
    if (!pageWs) throw new Error("SETUP-FAILED: no DevTools page target in 10 s");
    const ws = new WebSocket(pageWs);
    let msgId = 0; const pending = new Map();
    const consoleLines = []; const consoleErrors = [];
    const net = new Map();
    let stub = null;
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result); return; }
      if (stub) stub.onMessage(msg);
      const p = msg.params || {};
      if (msg.method === "Runtime.consoleAPICalled") {
        const t = (p.args || []).map((a) => a.value ?? a.description ?? "").join(" ");
        consoleLines.push(t);
        if (p.type === "error") consoleErrors.push(`console.error: ${t}`);
      }
      if (msg.method === "Runtime.exceptionThrown") consoleErrors.push("exception: " + (p.exceptionDetails.exception?.description || p.exceptionDetails.text));
      if (msg.method === "Log.entryAdded" && p.entry.level === "error") consoleErrors.push(`log: ${p.entry.text} ${p.entry.url || ""}`);
      if (msg.method === "Network.requestWillBeSent") net.set(p.requestId, { url: p.request.url, status: null, mime: null, failed: null, doc: p.documentURL });
      if (msg.method === "Network.responseReceived") { const r = net.get(p.requestId) || { url: p.response.url }; r.status = p.response.status; r.mime = p.response.mimeType; net.set(p.requestId, r); }
      if (msg.method === "Network.loadingFailed") { const r = net.get(p.requestId) || {}; r.failed = p.errorText; net.set(p.requestId, r); }
    });
    await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
    const send = (method, params = {}) => new Promise((res, rej) => { const id = ++msgId; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
    await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable"); await send("Log.enable");
    await send("Network.setCacheDisabled", { cacheDisabled: true });
    // plausible.io, stood in for (scripts/plausible-check.mjs): no leg reaches the internet
    stub = await plausibleStub(send, { mode: "stub" });
    const evalJS = async (expr) => {
      const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
      return r.result.value;
    };
    const waitFor = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn().catch(() => null); if (v) return v; await sleep(150); } return null; };
    const netSince = (from) => [...net.values()].slice(from);
    const good = (r) => !r.failed && r.status !== null && r.status >= 200 && r.status < 400;
    // a URL is bad when no request for it succeeded (a request the page
    // abandoned and made again is not a missing file)
    const badRequests = (list) => { const g = new Set(list.filter(good).map((r) => r.url)); return list.filter((r) => !good(r) && !g.has(r.url) && !/^data:/.test(r.url || "")); };
    // what each page's analytics saw: its URL -> the event statuses the page got back
    const seen = new Map();
    // every page a leg opened while the stub served (the review, 2026-09-30:
    // a page that recorded nothing was simply absent from seen, and only the
    // floors below could notice)
    const visited = new Set();
    const notePlausible = async () => {
      const got = await waitFor(() => evalJS("window.__plausibleStub && window.__plausibleStub.length ? JSON.stringify([location.href, window.__plausibleStub]) : null"), 5000);
      if (got) { const [u, st] = JSON.parse(got); seen.set(u, st); }
    };
    const visit = async (p) => {
      await send("Page.navigate", { url: BASE + p });
      const r = await waitFor(() => evalJS("document.readyState === 'complete' && document.fonts.status === 'loaded'"), 15000);
      if (stub && stub.mode === "stub") { visited.add(await evalJS("location.href").catch(() => BASE + p)); await notePlausible(); }
      return r;
    };
    const errorsAt = {};   // page -> errors seen while it was open
    // the landing's errors are collected from its first load through the
    // carousel, contrast and phone legs (timers, clicks, the phone's media
    // queries), up to the click into the game, whose own legs judge it
    let landingFrom = null;
    const note = async (p, from, netFrom) => {
      const errs = consoleErrors.slice(from);
      const reqs = badRequests(netSince(netFrom)).map((r) => `${(r.url || "(no url)").replace(BASE, "")} ${r.status ?? ""}${r.failed ?? ""}`);
      errorsAt[p] = [...errs, ...reqs.map((r) => `request ${r}`)];
    };

    // ---- landing --------------------------------------------------------------------
    {
      const e0 = consoleErrors.length, n0 = net.size;
      const ready = await visit("/");
      await sleep(400);
      const detail = [];
      if (!ready) detail.push("the page or its fonts did not finish loading in 15 s");
      const facts = await evalJS(`(async () => {
        await document.fonts.ready;
        const faces = [...document.fonts].map((f) => f.family.replace(/"/g, "") + "/" + f.style + "/" + f.weight + "/" + f.status);
        const imgs = [...document.images].map((i) => [i.getAttribute("src"), i.complete && i.naturalWidth > 0, i.naturalWidth + "x" + i.naturalHeight]);
        const play = document.querySelector(".play a");
        const logo = document.querySelector("h1 img");
        return { title: document.title, faces, imgs, play: play && play.href, playText: play && play.textContent.trim(),
                 links: [...document.querySelectorAll("a")].map((a) => a.href),
                 logo: logo && [logo.getAttribute("src"), logo.alt, logo.complete && logo.naturalWidth > 0, logo.naturalWidth + "x" + logo.naturalHeight],
                 text: document.body.innerText };
      })()`);
      if (facts.title !== "Phantom Burn") detail.push(`title "${facts.title}"`);
      // the h1 is the game's own logo (scripts/site-shots), 2x, named for a reader
      if (!facts.logo) detail.push("the h1 holds no logo image");
      else if (facts.logo[0] !== "/logo.png" || facts.logo[1] !== "Phantom Burn" || !facts.logo[2] || facts.logo[3] !== "950x136") detail.push(`the h1's logo is ${facts.logo.join(" ")} (want /logo.png "Phantom Burn", decoded, 950x136)`);
      for (const want of ["JetBrains Mono/normal/400/loaded", "JetBrains Mono/normal/700/loaded", "JetBrains Mono/italic/400/loaded"]) {
        if (!facts.faces.includes(want)) detail.push(`font ${want.split("/").slice(0, 3).join(" ")} not loaded (${facts.faces.join(", ")})`);
      }
      const shots = facts.imgs.filter((i) => /^\/shots\//.test(i[0] || ""));
      if (shots.length < 3) detail.push(`${shots.length} pictures (want at least 3)`);
      for (const i of shots) if (i[2] !== "480x270") detail.push(`${i[0]} is ${i[2]}, not a 480x270 frame`);
      const undecoded = facts.imgs.filter((i) => !i[1]);
      if (undecoded.length) detail.push(`images not decoded: ${undecoded.map((i) => i[0]).join(", ")}`);
      if (facts.play !== `${BASE}/${SLUG}/`) detail.push(`BADGE IN resolves to ${facts.play}`);
      if (facts.playText !== "BADGE IN") detail.push(`the play link says "${facts.playText}"`);
      for (const want of ["https://github.com/FluxHarmonic/phantom-burn", "https://creativecommons.org/licenses/by/4.0/", `${BASE}/fonts/OFL.txt`, `${BASE}/news/`]) {
        if (!facts.links.includes(want)) detail.push(`no link to ${want.replace(BASE, "")}`);
      }
      if (!facts.links.some((l) => /\/LICENSE$/.test(l))) detail.push("no link to the code's license");
      if (EM.test(facts.text)) detail.push("an em dash in the rendered text");
      if (!/How it was made/i.test(facts.text) || !/No image generator was used/.test(facts.text)) detail.push("the How it was made disclosure is missing");
      const reqs = badRequests(netSince(n0));
      if (reqs.length) detail.push(`requests not 2xx: ${reqs.map((r) => `${(r.url || "(no url)").replace(BASE, "")} ${r.status ?? ""}${r.failed ?? ""}`).join(", ")}`);
      landingFrom = [e0, n0];
      detail.length ? bad("landing", detail.join("; "))
        : ok("landing", `title and h1; ${facts.faces.filter((f) => f.endsWith("/loaded")).length} JetBrains Mono faces loaded; ${facts.imgs.length} images decoded (${shots.length} 480x270 pictures); BADGE IN -> /${SLUG}/; source, license, font license and news links; ${netSince(n0).length} requests, all 2xx`);
    }

    // ---- carousel -------------------------------------------------------------------
    {
      const detail = [];
      const state = () => evalJS(`(() => { const c = document.querySelector(".carousel"); if (!c) return null;
        const imgs = [...c.querySelectorAll(".frames img")];
        const dots = [...c.querySelectorAll(".dots button")];
        const cap = c.querySelector(".caption");
        return { live: c.classList.contains("live"), n: imgs.length, ndots: dots.length,
                 shown: imgs.map((i, k) => i.classList.contains("shown") ? k : -1).filter((k) => k >= 0),
                 visible: imgs.map((i, k) => getComputedStyle(i).opacity === "1" ? k : -1).filter((k) => k >= 0),
                 current: dots.map((b, k) => b.getAttribute("aria-current") === "true" ? k : -1).filter((k) => k >= 0),
                 caption: cap ? cap.textContent : null, labels: dots.map((b) => b.getAttribute("aria-label")),
                 alts: imgs.every((i) => (i.getAttribute("alt") || "").length > 10),
                 every: Number(c.getAttribute("data-interval")) }; })()`);
      const s0 = await state();
      if (!s0) detail.push("no .carousel on the landing");
      else {
        if (!s0.live) detail.push("the carousel's script did not run (no .live)");
        if (s0.n < 3 || s0.n !== s0.ndots) detail.push(`${s0.n} pictures and ${s0.ndots} dots`);
        if (s0.shown.join() !== "0" || s0.current.join() !== "0") detail.push(`at load: shown ${s0.shown}, dot ${s0.current} (want 0, 0)`);
        if (s0.caption !== s0.labels[0]) detail.push(`at load the caption is "${s0.caption}", not "${s0.labels[0]}"`);
        if (!s0.alts) detail.push("a picture without a real alt text");
        const moved = await waitFor(async () => { const s = await state(); return s.shown.length === 1 && s.shown[0] !== 0 ? s : null; }, s0.every + 3000);
        if (!moved) detail.push(`no automatic change within ${s0.every + 3000} ms`);
        const last = s0.ndots - 1;
        const xy = await evalJS(`(() => { const b = document.querySelectorAll(".carousel .dots button")[${last}]; b.scrollIntoView({block: "center"}); const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
        for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: xy[0], y: xy[1], button: "left", clickCount: 1 });
        await sleep(1700);   // past the 1.2 s fade
        const s1 = await state();
        if (s1.shown.join() !== `${last}` || s1.current.join() !== `${last}` || s1.visible.join() !== `${last}`) detail.push(`after a click on the last dot: shown ${s1.shown}, dot ${s1.current}, opaque ${s1.visible} (want ${last})`);
        if (s1.caption !== s1.labels[last]) detail.push(`after the click the caption is "${s1.caption}", not "${s1.labels[last]}"`);
        await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1, y: 1 });
        await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
        await visit("/");
        await sleep(s0.every + 2000);
        const s2 = await state();
        if (s2.shown.join() !== "0") detail.push(`under prefers-reduced-motion the picture changed to ${s2.shown}`);
        await send("Emulation.setEmulatedMedia", { features: [] });
        if (!detail.length) ok("carousel", `${s0.n} pictures, one shown; moved to ${moved.shown[0]} by itself within ${s0.every + 3000} ms; the last dot shows the last picture and its caption; still under reduced motion for ${s0.every + 2000} ms`);
      }
      if (detail.length) bad("carousel", detail.join("; "));
    }

    // ---- contrast -------------------------------------------------------------------
    {
      await visit("/");
      const detail = [], got = [];
      await send("DOM.enable"); await send("CSS.enable");
      const { root } = await send("DOM.getDocument", { depth: 1 });
      const { nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector: ".play a" });
      if (!nodeId) detail.push("no .play a on the landing");
      else {
        for (const st of [[], ["hover"], ["focus", "focus-visible"], ["active", "hover"]]) {
          await send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: st });
          const c = await evalJS(`(() => {
            const a = document.querySelector(".play a"), cs = getComputedStyle(a);
            const rgb = (s) => s.match(/[\\d.]+/g).slice(0, 3).map(Number);
            const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
            const L1 = lum(rgb(cs.color)), L2 = lum(rgb(cs.backgroundColor));
            return { color: cs.color, bg: cs.backgroundColor, ratio: (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05) };
          })()`);
          const name = st.length ? st.join("+") : "plain";
          got.push(`${name} ${c.ratio.toFixed(1)}`);
          if (!(c.ratio >= 4.5)) detail.push(`${name}: text ${c.color} on ${c.bg} is ${c.ratio.toFixed(2)}:1 (want 4.5)`);
        }
        await send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] });
      }
      detail.length ? bad("contrast", detail.join("; ")) : ok("contrast", `BADGE IN's text against its background: ${got.join(", ")} (:1, want >= 4.5)`);
    }

    // ---- phone: nothing wider than a phone's screen ----------------------------------
    {
      const detail = [];
      await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      const pages = ["/", "/news/", ...fs.readdirSync(path.join(REPO, "news")).filter((f) => f.endsWith(".md")).map((f) => `/news/${f.slice(0, -3)}/`)];
      const got = [];
      for (const p of pages) {
        await visit(p);
        await sleep(300);
        const m = await evalJS(`(() => { const d = document.documentElement; const a = document.querySelector(".play a");
          const r = a && a.getBoundingClientRect();
          return { vw: window.innerWidth, screen: screen.width, sw: Math.max(d.scrollWidth, document.body.scrollWidth), play: r ? [Math.round(r.left), Math.round(r.right)] : null }; })()`);
        got.push(`${p} ${m.sw}/${m.vw}`);
        // a mobile browser widens the layout to fit content wider than the
        // screen (and zooms out), so a wide page shows as innerWidth > 390
        if (m.screen !== 390) detail.push(`${p}: the screen is ${m.screen} px, not the emulated 390 (the leg measured nothing)`);
        else if (m.vw > 390) detail.push(`${p} forced a ${m.vw} px layout on a 390 px phone (something is wider than the screen)`);
        if (m.sw > m.vw) detail.push(`${p} is ${m.sw} px wide on a ${m.vw} px screen`);
        if (m.play && (m.play[0] < 0 || m.play[1] > m.vw)) detail.push(`${p}: BADGE IN spans ${m.play[0]}..${m.play[1]} px on a ${m.vw} px screen`);
      }
      await send("Emulation.clearDeviceMetricsOverride");
      detail.length ? bad("phone", detail.join("; ")) : ok("phone", `no horizontal scroll at 390 px: ${got.join(", ")} (content/viewport px); BADGE IN on screen`);
      await visit("/");
    }

    // ---- badge-in: a real click, as a visitor gets there ------------------------------
    await note("/ (landing, carousel, contrast, phone at 390 px)", landingFrom[0], landingFrom[1]);
    {
      const detail = [];
      const l0 = consoleLines.length;
      await evalJS(`document.querySelector(".play a").scrollIntoView({block: "center"})`);
      await sleep(200);
      const xy = await evalJS(`(() => { const r = document.querySelector(".play a").getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
      for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: xy[0], y: xy[1], button: "left", clickCount: 1 });
      const at = await waitFor(async () => { const h = await evalJS("location.href"); return h === `${BASE}/${SLUG}/` ? h : null; }, 10000);
      if (!at) detail.push(`the click did not land on /${SLUG}/ (at ${await evalJS("location.href").catch(() => "?")})`);
      const ready = await waitFor(async () => consoleLines.slice(l0).find((l) => /^phantom-burn: ready/.test(l)), 90000);
      if (!ready) detail.push(`the game never said "phantom-burn: ready" within 90 s`);
      visited.add(await evalJS("location.href").catch(() => `${BASE}/${SLUG}/`));
      await notePlausible();
      await send("Page.navigate", { url: "about:blank" });
      await sleep(300);
      detail.length ? bad("badge-in", detail.join("; ")) : ok("badge-in", `a click on BADGE IN lands on /${SLUG}/ and the game says "${ready}"`);
    }

    // ---- news -----------------------------------------------------------------------
    const newsPosts = [];
    {
      const detail = [];
      const e0 = consoleErrors.length, n0 = net.size;
      await visit("/news/");
      await note("/news/", e0, n0);
      const r = await fetch(`${BASE}/news/`);
      const html = await r.text();
      if (r.status !== 200) detail.push(`/news/ answered ${r.status}`);
      const items = [...html.matchAll(/<li data-version="([^"]+)"><a href="(\/news\/[a-z0-9-]+\/)">([\s\S]*?)<\/a>\s*<time datetime="([^"]+)">[\s\S]*?<p>([\s\S]*?)<\/p><\/li>/g)]
        .map((m) => ({ version: m[1], href: m[2], title: m[3], date: m[4], summary: m[5] }));
      const sources = fs.readdirSync(path.join(REPO, "news")).filter((f) => f.endsWith(".md"));
      if (items.length !== sources.length) detail.push(`/news/ lists ${items.length} post(s); news/ has ${sources.length}`);
      for (const f of sources) if (!items.some((i) => i.href === `/news/${f.slice(0, -3)}/`)) detail.push(`news/${f} is not listed`);
      const order = items.map((i) => i.date + i.version);
      if (order.join() !== [...order].sort().reverse().join()) detail.push(`/news/ is not newest first: ${items.map((i) => i.date).join(" ")}`);
      for (const it of items) {
        const e1 = consoleErrors.length, n1 = net.size;
        await visit(it.href);
        await note(it.href, e1, n1);
        const p = await fetch(BASE + it.href);
        const body = await p.text();
        if (p.status !== 200) { detail.push(`${it.href} answered ${p.status}`); continue; }
        if (!body.includes(`data-version="${it.version}"`)) detail.push(`${it.href} is not the post for ${it.version}`);
        if (!/<h1>[^<]+<\/h1>/.test(body) || !body.includes(`<time datetime="${it.date}">`)) detail.push(`${it.href} lacks its title or date`);
        newsPosts.push(it);
      }
      detail.length ? bad("news", detail.join("; ")) : ok("news", `/news/ lists ${items.length} post(s) newest first (${items.map((i) => `${i.version} ${i.date}`).join(", ")}), one per news/*.md; each post page answers with its title, date and version`);
    }

    // ---- feeds ----------------------------------------------------------------------
    {
      const detail = [];
      const xr = await fetch(`${BASE}/news/feed.xml`);
      const xmlText = await xr.text();
      if (xr.status !== 200) detail.push(`/news/feed.xml answered ${xr.status}`);
      await visit("/news/");
      const rss = await evalJS(`(() => {
        const d = new DOMParser().parseFromString(${JSON.stringify(xmlText)}, "application/xml");
        const err = d.querySelector("parsererror");
        if (err) return { error: err.textContent.slice(0, 160) };
        const el = d.documentElement, ch = d.querySelector("channel");
        const t = (e, sel) => { const x = e && e.getElementsByTagName(sel)[0]; return x ? x.textContent : null; };
        const self = ch && [...ch.getElementsByTagName("atom:link")].map((e) => e.getAttribute("href"))[0];
        return { root: el.tagName, version: el.getAttribute("version"), link: t(ch, "link"), self,
                 items: [...d.getElementsByTagName("item")].map((i) => ({ link: t(i, "link"), guid: t(i, "guid"), pubDate: t(i, "pubDate"), description: t(i, "description") })) };
      })()`);
      let jf = null;
      const jr = await fetch(`${BASE}/news/feed.json`);
      try { jf = JSON.parse(await jr.text()); } catch (e) { detail.push(`/news/feed.json does not parse: ${e.message}`); }
      if (jr.status !== 200) detail.push(`/news/feed.json answered ${jr.status}`);
      const want = newsPosts.map((p) => `${SITE}${p.href}`);
      const abs = (u, where) => { if (typeof u !== "string" || !u.startsWith(`${SITE}/`)) detail.push(`${where}: "${u}" is not an absolute ${SITE}/ URL`); };
      const bodyUrls = (html, where) => { for (const m of (html || "").matchAll(/(?:href|src)="([^"]*)"/g)) if (!/^mailto:/.test(m[1]) && !/^https:\/\/(?!phantomburn\.net)/.test(m[1])) abs(m[1], `${where} body link`); };
      if (rss.error) detail.push(`feed.xml does not parse as XML: ${rss.error}`);
      else {
        if (rss.root !== "rss" || rss.version !== "2.0") detail.push(`feed.xml is <${rss.root} version="${rss.version}">, not RSS 2.0`);
        abs(rss.link, "RSS channel link");
        if (rss.self !== `${SITE}/news/feed.xml`) detail.push(`RSS self link is ${rss.self}`);
        const got = rss.items.map((i) => i.link);
        if (!want.length || got.join() !== want.join()) detail.push(`RSS items ${got.join(", ")} are not /news/'s posts in its order (${want.join(", ")})`);
        for (const i of rss.items) {
          abs(i.link, "RSS item link"); abs(i.guid, "RSS item guid");
          if (!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} \+0000$/.test(i.pubDate || "")) detail.push(`RSS pubDate "${i.pubDate}" is not RFC 822`);
          if (!i.description || i.description.length < 40) detail.push(`RSS item ${i.link} has no body`);
          bodyUrls(i.description, `RSS ${i.link}`);
        }
      }
      if (jf) {
        if (jf.version !== "https://jsonfeed.org/version/1.1") detail.push(`feed.json version "${jf.version}"`);
        abs(jf.home_page_url, "JSON home_page_url");
        if (jf.feed_url !== `${SITE}/news/feed.json`) detail.push(`JSON feed_url is ${jf.feed_url}`);
        const got = (jf.items || []).map((i) => i.url);
        if (!want.length || got.join() !== want.join()) detail.push(`JSON items ${got.join(", ")} are not /news/'s posts in its order`);
        for (const i of jf.items || []) {
          abs(i.id, "JSON item id"); abs(i.url, "JSON item url");
          if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(i.date_published || "")) detail.push(`JSON date_published "${i.date_published}" is not RFC 3339`);
          if (!i.content_html || i.content_html.length < 40) detail.push(`JSON item ${i.url} has no body`);
          bodyUrls(i.content_html, `JSON ${i.url}`);
          if (!fs.existsSync(path.join(DIR, new URL(i.url).pathname, "index.html"))) detail.push(`${i.url} has no page in the tree`);
        }
      }
      for (const p of ["/", "/news/"]) {
        const html = await (await fetch(BASE + p)).text();
        if (!/<link rel="alternate" type="application\/rss\+xml"[^>]*href="\/news\/feed\.xml"/.test(html)) detail.push(`${p} has no <link rel="alternate"> to the RSS feed`);
        if (!/<link rel="alternate" type="application\/feed\+json"[^>]*href="\/news\/feed\.json"/.test(html)) detail.push(`${p} has no <link rel="alternate"> to the JSON feed`);
      }
      if (!/<a href="\/news\/feed\.xml">RSS<\/a>/.test(await (await fetch(`${BASE}/news/`)).text())) detail.push("/news/ shows no visible RSS link");
      detail.length ? bad("feeds", [...new Set(detail)].join("; "))
        : ok("feeds", `feed.xml (RSS 2.0, parsed by the browser) and feed.json (JSON Feed 1.1) list ${want.length} post(s) as /news/ does, newest first, every URL absolute under ${SITE}/ (bodies included); alternate links on / and /news/; the RSS link on /news/`);
    }

    // ---- version --------------------------------------------------------------------
    {
      const detail = [];
      let vj = null;
      try { vj = JSON.parse(text("version.json")); } catch (e) { detail.push(`version.json does not parse: ${e.message}`); }
      if (vj) {
        const keys = Object.keys(vj).sort().join(",");
        if (keys !== "build,date,news,summary,version") detail.push(`version.json has the fields ${keys} (want build, date, news, summary, version)`);
        if (vj.build !== STAMP) detail.push(`build "${vj.build}" is not the staged build's ${STAMP}`);
        const pkg = (fs.readFileSync(path.join(REPO, "package.sgl"), "utf8").match(/^  version: "([0-9.]+)"/m) || [])[1];
        if (vj.version !== pkg) detail.push(`version "${vj.version}" is not package.sgl's ${pkg}`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(vj.date || "")) detail.push(`date "${vj.date}" is not YYYY-MM-DD`);
        const post = newsPosts.find((p) => p.version === vj.version);
        if (!post) detail.push(`no news post for version ${vj.version} (posts: ${newsPosts.map((p) => p.version).join(", ") || "none"})`);
        else {
          if (vj.news !== `${SITE}${post.href}`) detail.push(`news "${vj.news}" is not the post's URL ${SITE}${post.href}`);
          const listed = post.summary.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/<[^>]+>/g, "");
          if (vj.summary !== listed) detail.push(`summary differs from the post's: "${vj.summary}" against "${listed}"`);
        }
        if (!vj.summary) detail.push("the summary is empty");
        if (!DRAWABLE.test(vj.summary || "")) detail.push(`the summary has characters outside printable ASCII: ${[...(vj.summary || "")].filter((c) => !DRAWABLE.test(c)).join(" ")}`);
        if ((vj.summary || "").length > SUMMARY_MAX) detail.push(`the summary is ${vj.summary.length} characters (at most ${SUMMARY_MAX})`);
      }
      const r = await fetch(`${BASE}/version.json`);
      await r.arrayBuffer();
      if (!/no-store/.test(r.headers.get("cache-control") || "")) detail.push(`/version.json is served with cache-control "${r.headers.get("cache-control")}", not no-store`);
      if (!/^application\/json/.test(r.headers.get("content-type") || "")) detail.push(`/version.json is served as ${r.headers.get("content-type")}`);
      detail.length ? bad("version", detail.join("; ")) : ok("version", `version.json ${vj.version} ${vj.date} build ${vj.build} -> ${vj.news}; summary ${vj.summary.length} chars, printable ASCII; served no-store as application/json`);
    }

    // ---- preview --------------------------------------------------------------------
    {
      const detail = [];
      const html = text("index.html");
      const meta = (attr, key) => (new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`).exec(html) || [])[1];
      const URL_ = `${SITE}/shots/og.png`;
      const want = [["property", "og:image", URL_], ["property", "og:image:type", "image/png"], ["property", "og:image:width", "1200"], ["property", "og:image:height", "630"],
        ["property", "og:url", `${SITE}/`], ["name", "twitter:card", "summary_large_image"], ["name", "twitter:image", URL_]];
      for (const [a, k, v] of want) { const got = meta(a, k); if (got !== v) detail.push(`${k} is ${got === undefined ? "absent" : `"${got}"`}, not "${v}"`); }
      for (const [a, k] of [["property", "og:title"], ["property", "og:description"], ["property", "og:image:alt"], ["name", "twitter:image:alt"], ["name", "twitter:title"], ["name", "twitter:description"], ["name", "description"]]) if (!meta(a, k)) detail.push(`${k} is absent or empty`);
      const file = path.join(DIR, "shots", "og.png");
      if (!fs.existsSync(file)) detail.push("shots/og.png is not in the tree");
      else {
        const png = fs.readFileSync(file);
        const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
        if (png.toString("ascii", 1, 4) !== "PNG" || w !== 1200 || h !== 630) detail.push(`shots/og.png is ${w}x${h}, not a 1200x630 PNG`);
      }
      const r = await fetch(`${BASE}/shots/og.png`);
      await r.arrayBuffer();
      if (r.status !== 200 || !/^image\/png/.test(r.headers.get("content-type") || "")) detail.push(`/shots/og.png answered ${r.status} ${r.headers.get("content-type")}`);
      detail.length ? bad("preview", detail.join("; ")) : ok("preview", `og:image and twitter:image ${URL_} (1200x630 PNG, served image/png) with type, size and alt; twitter:card summary_large_image`);
    }

    // ---- crosslink ------------------------------------------------------------------
    {
      const foot = (/<footer>([\s\S]*?)<\/footer>/.exec(text("index.html")) || [])[1] || "";
      const detail = [];
      if (!foot) detail.push("index.html has no footer");
      if (!/href="https:\/\/crashthestack\.com\/">Crash The Stack<\/a>/.test(foot)) detail.push("the footer does not link Crash The Stack");
      if (!/href="https:\/\/harkfell\.com\/">Harkfell<\/a>/.test(foot)) detail.push("the footer does not link Harkfell");
      if (!/<a class="mark" href="https:\/\/fluxharmonic\.com\/"><img src="\/mark\.png"/.test(foot)) detail.push("the footer lost the Flux Harmonic mark and its link");
      detail.length ? bad("crosslink", detail.join("; ")) : ok("crosslink", "the footer links Crash The Stack and Harkfell beside the Flux Harmonic mark");
    }

    // ---- console --------------------------------------------------------------------
    {
      const e0 = consoleErrors.length, n0 = net.size;
      await visit(`/no-such-page-${Date.now()}`);
      // the 404 itself is the point; only its own resources must load
      await note("(404)", e0, n0);
      errorsAt["(404)"] = errorsAt["(404)"].filter((e) => !/no-such-page-\d+ 404|status of 404/.test(e));
      const dirty = Object.entries(errorsAt).filter(([, errs]) => errs.length);
      dirty.length ? bad("console", dirty.map(([p, errs]) => `${p}: ${errs.slice(0, 3).join(" | ")}`).join("; "))
        : ok("console", `no console error, exception or failed request on ${Object.keys(errorsAt).join(", ")}`);
    }

    // ---- analytics, in Chrome: every page visited sent its pageview ------------------
    {
      const detail = [];
      const pages = [...seen.keys()].map((u) => u.replace(BASE, "")).sort();
      // a floor: the landing, the game, /news/, a post and the 404 page, so
      // a harness that recorded nothing is no pass
      for (const want of ["/", `/${SLUG}/`, "/news/"]) if (!pages.includes(want)) detail.push(`no analytics recorded on ${want}`);
      if (!pages.some((p) => /^\/news\/[a-z0-9-]+\/$/.test(p))) detail.push("no analytics recorded on a news post");
      if (!pages.some((p) => /^\/no-such-page-\d+$/.test(p))) detail.push("no analytics recorded on the 404 page");
      for (const u of visited) if (!seen.has(u)) detail.push(`${u.replace(BASE, "")}: visited, and no event status came back to the page`);
      for (const [u, st] of seen) {
        const p = u.replace(BASE, "");
        if (!st.includes(202)) detail.push(`${p}: the page got ${JSON.stringify(st)} back, not 202`);
        const evs = stub.events.filter((e) => e.body && e.body.u === u);
        if (!evs.some((e) => e.body.n === "pageview")) detail.push(`${p}: the stub received no pageview for it`);
      }
      const wrongScript = stub.scripts.filter((sc) => sc.id !== PLAUSIBLE_ID);
      if (wrongScript.length) detail.push(`scripts requested for other IDs: ${[...new Set(wrongScript.map((sc) => sc.id))].join(", ")}`);
      const wrongDomain = stub.events.filter((e) => !e.body || e.body.d !== PLAUSIBLE_DOMAIN);
      if (wrongDomain.length) detail.push(`${wrongDomain.length} event(s) not for ${PLAUSIBLE_DOMAIN}: ${JSON.stringify(wrongDomain[0].body).slice(0, 120)}`);
      detail.length ? bad("analytics", detail.slice(0, 6).join("; "))
        : ok("analytics", `${pages.length} pages loaded the stub script for ${PLAUSIBLE_ID} and sent a pageview for ${PLAUSIBLE_DOMAIN} that came back 202 (${stub.scripts.length} script requests, ${stub.events.length} events): ${pages.join(", ")}`);
    }

    // ---- privacy: the footer's line -----------------------------------------------------
    {
      await visit("/");
      const foot = await evalJS("(() => { const f = document.querySelector('footer'); if (!f) return null; const a = [...f.querySelectorAll('a')].find((a) => a.textContent.trim() === 'Plausible'); return { text: f.innerText, link: a ? a.href : null }; })()");
      !foot ? bad("privacy", "the landing has no <footer>")
        : !foot.text.includes(PRIVACY) ? bad("privacy", `the landing's footer does not say "${PRIVACY}"`)
        : foot.link !== "https://plausible.io/data-policy" ? bad("privacy", `the footer's "Plausible" links ${foot.link || "nowhere"}, not https://plausible.io/data-policy`)
        : ok("privacy", `the landing's footer says "${PRIVACY}", Plausible linking its data policy`);
    }

    // ---- analytics-down: plausible.io unreachable --------------------------------------
    {
      stub.setMode("down");
      const detail = [];
      const split = (e0, n0) => {
        const errs = [...consoleErrors.slice(e0), ...badRequests(netSince(n0)).map((r) => `request ${r.url} ${r.status ?? ""}${r.failed ?? ""}`)];
        return { ours: errs.filter(isPlausibleFailure), other: errs.filter((e) => !isPlausibleFailure(e)) };
      };
      const f0 = stub.failed.length;
      let e0 = consoleErrors.length, n0 = net.size;
      await visit("/");
      await sleep(1000);
      const landed = await evalJS("!!document.querySelector('h1.logo img') && document.querySelector('h1.logo img').naturalWidth > 0").catch(() => false);
      let r = split(e0, n0);
      if (!landed) detail.push("/: the landing did not render its logo");
      if (r.other.length) detail.push(`/: ${r.other.slice(0, 3).join(" | ")}`);
      const landingFails = r.ours.length;
      const l0 = consoleLines.length;
      e0 = consoleErrors.length; n0 = net.size;
      await send("Page.navigate", { url: `${BASE}/${SLUG}/` });
      const ready = await waitFor(async () => consoleLines.slice(l0).find((l) => /^phantom-burn: ready/.test(l)), 90000);
      await sleep(1000);
      r = split(e0, n0);
      if (!ready) detail.push(`/${SLUG}/: the game never said "phantom-burn: ready" within 90 s`);
      if (r.other.length) detail.push(`/${SLUG}/: ${r.other.slice(0, 3).join(" | ")}`);
      // the positive control: the stub really refused them (or this leg judged nothing)
      const refused = stub.failed.length - f0;
      if (refused < 2 || !landingFails || !r.ours.length) detail.push(`plausible.io was not refused on both pages (${refused} refused; ${landingFails} and ${r.ours.length} failures seen)`);
      await send("Page.navigate", { url: "about:blank" });
      await sleep(300);
      stub.setMode("stub");
      detail.length ? bad("analytics-down", detail.join("; "))
        : ok("analytics-down", `with plausible.io refused (${refused} requests), / renders and /${SLUG}/ says "${ready}", and the only errors are the refused plausible.io requests`);
    }
    stub.close();
    ws.close();
  } finally {
    killChrome();
  }
}
