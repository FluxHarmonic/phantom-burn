#!/usr/bin/env node
// build-news.mjs - phantomburn.net's /news/ and /version.json, generated into
// a staged tree. Harkfell's scripts/build-news.mjs (its ruling D38) in Phantom
// Burn's names and look. substratic's stage-web runs it (the stage-hook: in
// substratic.sgv), so both land INSIDE the tree check-site checks and
// publish-web ships byte for byte.
//
//   node scripts/build-news.mjs NEWS-DIR TREE --version X.Y.Z --stamp STAMP [--date YYYY-MM-DD]
//
// NEWS-DIR holds one Markdown file per release post, with front matter:
//     ---
//     title: Phantom Burn 0.1
//     date: 2026-09-25
//     version: 0.1.0
//     summary: One line, in David's voice, that the game can draw.
//     ---
// Short release posts only; no devlog (Harkfell's D38). The Markdown is the small subset
// the posts use: ## headings, paragraphs, "- " lists, **strong**, *em*,
// [text](url). Anything it does not know is text, escaped.
//
// Writes TREE/news/index.html (every post, newest first), TREE/news/<slug>/
// index.html (the slug is the file name without .md), the feeds
// TREE/news/feed.xml (RSS 2.0) and TREE/news/feed.json (JSON Feed 1.1) in
// the shape Crash's Press site writes them, and TREE/version.json:
//     { "version", "date", "build", "summary", "news" }
// with the summary and news URL of the post whose version equals --version.
// When no post has that version, version.json says so ("summary": "",
// "news": the index) and this prints a warning: check-site.mjs then refuses
// the tree, since the game would announce a version with nothing to say.
//
// Refuses (exit 1) on a post missing a field, a malformed date or version, an
// em dash anywhere, or two posts for one version.
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const VALUED = ["--version", "--stamp", "--date"];
const [SRC, TREE] = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && VALUED.includes(args[i - 1])));
const VERSION = opt("--version"), STAMP = opt("--stamp");
const TODAY = opt("--date") || new Date().toISOString().slice(0, 10);
const SITE = "https://phantomburn.net";
const die = (m) => { console.error(`build-news: ${m}`); process.exit(1); };
if (!SRC || !TREE || !VERSION || !STAMP) die("usage: build-news.mjs NEWS-DIR TREE --version X.Y.Z --stamp STAMP [--date YYYY-MM-DD]");
if (!/^\d+\.\d+\.\d+$/.test(VERSION)) die(`--version "${VERSION}" is not X.Y.Z`);

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function inline(s) {
  let out = esc(s);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return out;
}
function markdown(body) {
  const html = [];
  const blocks = body.trim().split(/\n\s*\n/);
  for (const b of blocks) {
    const lines = b.split("\n");
    if (/^## /.test(lines[0]) && lines.length === 1) html.push(`<h2>${inline(lines[0].slice(3).trim())}</h2>`);
    else if (lines.every((l) => /^- /.test(l))) html.push("<ul>\n" + lines.map((l) => `  <li>${inline(l.slice(2).trim())}</li>`).join("\n") + "\n</ul>");
    else html.push(`<p>${inline(lines.join(" ").trim())}</p>`);
  }
  return html.join("\n");
}
function page(title, main, depth) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="theme-color" content="#0d0a1a">
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="alternate" type="application/rss+xml" title="Phantom Burn news" href="/news/feed.xml">
  <link rel="alternate" type="application/feed+json" title="Phantom Burn news" href="/news/feed.json">
  <link rel="stylesheet" href="/style.css">
  <!-- Privacy-friendly analytics by Plausible -->
  <script async src="https://plausible.io/js/pa-GxdOlotIbYY0LzO4WRsIV.js"></script>
  <script>
    window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
    plausible.init()
  </script>
</head>
<body>
  <main class="news">
    <p class="back"><a href="/">Phantom Burn</a>${depth > 1 ? ` · <a href="/news/">News</a>` : ""}</p>
${main}
  </main>
</body>
</html>
`;
}
const longDate = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

const posts = [];
for (const f of fs.readdirSync(SRC).filter((f) => f.endsWith(".md")).sort()) {
  const text = fs.readFileSync(path.join(SRC, f), "utf8");
  if (/—/.test(text)) die(`${f} has an em dash`);
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) die(`${f} has no front matter`);
  const fm = Object.fromEntries(m[1].split("\n").filter((l) => l.trim()).map((l) => { const i = l.indexOf(":"); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
  for (const k of ["title", "date", "version", "summary"]) if (!fm[k]) die(`${f} has no ${k}:`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fm.date) || isNaN(Date.parse(fm.date))) die(`${f}: date "${fm.date}" is not YYYY-MM-DD`);
  if (!/^\d+\.\d+\.\d+$/.test(fm.version)) die(`${f}: version "${fm.version}" is not X.Y.Z`);
  const slug = f.slice(0, -3);
  if (!/^[a-z0-9-]+$/.test(slug)) die(`${f}: the file name must be lowercase letters, digits and hyphens (it is the URL)`);
  posts.push({ ...fm, slug, body: m[2] });
}
if (!posts.length) die(`${SRC} has no posts`);
const versions = posts.map((p) => p.version);
const dup = versions.find((v, i) => versions.indexOf(v) !== i);
if (dup) die(`two posts for version ${dup}`);
posts.sort((a, b) => (b.date + b.version).localeCompare(a.date + a.version));

fs.mkdirSync(path.join(TREE, "news"), { recursive: true });
for (const p of posts) {
  fs.mkdirSync(path.join(TREE, "news", p.slug), { recursive: true });
  const main = `    <article class="post" data-version="${esc(p.version)}">
      <h1>${inline(p.title)}</h1>
      <p class="date"><time datetime="${p.date}">${longDate(p.date)}</time></p>
${markdown(p.body).split("\n").map((l) => "      " + l).join("\n")}
    </article>`;
  fs.writeFileSync(path.join(TREE, "news", p.slug, "index.html"), page(`${p.title} - Phantom Burn`, main, 2));
}
const list = posts.map((p) => `      <li data-version="${esc(p.version)}"><a href="/news/${p.slug}/">${inline(p.title)}</a>
        <time datetime="${p.date}">${longDate(p.date)}</time>
        <p>${inline(p.summary)}</p></li>`).join("\n");
fs.writeFileSync(path.join(TREE, "news", "index.html"), page("News - Phantom Burn", `    <h1>News</h1>
    <p class="feeds">Follow along with <a href="/news/feed.xml">RSS</a> or <a href="/news/feed.json">JSON Feed</a>.</p>
    <ul class="post-list">
${list}
    </ul>`, 1));

// ---- the feeds (Crash's, as Press's (press feeds) writes them) --------------
// RSS 2.0 at /news/feed.xml and JSON Feed 1.1 at /news/feed.json, newest first,
// at most 20 entries. Each entry carries the post's absolute URL and its whole
// rendered body (Crash's feeds carry the body, not an excerpt), with the body's
// site-relative links made absolute so they work in a feed reader; the JSON
// Feed entry also carries the post's summary.
const FEED_TITLE = "Phantom Burn news";
const FEED_DESC = "What's new in each release of Phantom Burn.";
const AUTHOR = "David Wilson";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const rfc822 = (d) => { const t = new Date(d + "T00:00:00Z"); return `${WEEKDAYS[t.getUTCDay()]}, ${String(t.getUTCDate()).padStart(2, "0")} ${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()} 00:00:00 +0000`; };
const rfc3339 = (d) => `${d}T00:00:00Z`;
const absolute = (html) => html.replace(/(href|src)="\/(?!\/)/g, `$1="${SITE}/`);
const xml = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const feedPosts = posts.slice(0, 20).map((p) => ({ ...p, url: `${SITE}/news/${p.slug}/`, html: absolute(markdown(p.body)) }));
const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>${xml(FEED_TITLE)}</title><link>${SITE}/</link><description>${xml(FEED_DESC)}</description><language>en</language><atom:link href="${SITE}/news/feed.xml" rel="self" type="application/rss+xml"></atom:link>${feedPosts.length ? `<lastBuildDate>${rfc822(feedPosts[0].date)}</lastBuildDate>` : ""}${feedPosts.map((p) => `<item><title>${xml(p.title)}</title><link>${p.url}</link><guid isPermaLink="true">${p.url}</guid><pubDate>${rfc822(p.date)}</pubDate><dc:creator>${AUTHOR}</dc:creator><description>${xml(p.html)}</description></item>`).join("")}</channel></rss>
`;
const jsonFeed = {
  version: "https://jsonfeed.org/version/1.1",
  title: FEED_TITLE,
  home_page_url: `${SITE}/`,
  description: FEED_DESC,
  language: "en",
  feed_url: `${SITE}/news/feed.json`,
  authors: [{ name: AUTHOR }],
  items: feedPosts.map((p) => ({ id: p.url, url: p.url, title: p.title, date_published: rfc3339(p.date), content_html: p.html, summary: p.summary })),
};
fs.writeFileSync(path.join(TREE, "news", "feed.xml"), rss);
fs.writeFileSync(path.join(TREE, "news", "feed.json"), JSON.stringify(jsonFeed, null, 2) + "\n");

const mine = posts.find((p) => p.version === VERSION);
if (!mine) console.error(`build-news: WARNING: no post for version ${VERSION} (posts: ${versions.join(", ")}); version.json carries no summary and check-site.mjs will refuse the tree`);
const vj = { version: VERSION, date: TODAY, build: STAMP, summary: mine ? mine.summary : "", news: mine ? `${SITE}/news/${mine.slug}/` : `${SITE}/news/` };
fs.writeFileSync(path.join(TREE, "version.json"), JSON.stringify(vj, null, 2) + "\n");
console.log(`build-news: ${posts.length} post(s) -> news/ (+ feed.xml, feed.json); version.json ${VERSION} ${STAMP} ${mine ? "-> " + vj.news : "(NO POST)"}`);
