#!/usr/bin/env node
// play-import.mjs - what P1's guard and game loop need from a compiled floor,
// as one Sigil datum: assets/floors/FLOOR/play.sexp.
//
//   node scripts/play-import.mjs [SRC-DIR] [FLOOR] [FLOOR-FILE]
//
// SRC-DIR is the floor compiler's output (default: the compiler worktree's
// build/floors), FLOOR the floor's name (default 14-slice), FLOOR-FILE the
// floor's source (default floors/FLOOR.floor; only the badge is read from it,
// because the compiler's JSON does not carry it yet). Run it after
// scripts/floor-import.mjs, which brings in floor.sgm; this reads that copy,
// so the light it samples is the light the game draws.
//
//   ((guards (patrol ((X Y) ...) (WAIT ...)) ...)
//    (start X Y FACING)
//    (exit X Y)
//    (badge X Y Z)                ; on the desk top
//    (glass X0 Y0 Z0 X1 Y1 Z1 X2 Y2 Z2 ...)   ; the collision's glass triangles,
//                                             ; which sight passes through
//    (light CELL X0 Y0 W H N      ; the grid, then N layers:
//      K Z I0 I1 I2 I3 I4 I5 ...)) ; cell K = row * W + col, the floor's z there,
//                                  ; and the baked intensity of circuits 0 to 5
//
// The light grid samples floor.sgm's baked per-vertex light (the contract's
// light and circuit slots) on every upward-facing triangle (floors, stairs,
// desk and cabinet tops), at each cell's centre, interpolated across the
// triangle. A cell over two floors (the lobby under the mezzanine) has a layer
// for each; layers less than 5 cm apart are one. This is the light "at your
// feet", which design section 3 samples for visibility (Thief's way).

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.resolve(process.argv[2] || path.join(ROOT, "../task-phantom-burn-p0-compiler/build/floors"));
const FLOOR = process.argv[3] || "14-slice";
const FLOOR_FILE = path.resolve(process.argv[4] || path.join(ROOT, "floors", `${FLOOR}.floor`));
const OUT = path.join(ROOT, "assets/floors", FLOOR);
const CELL = 0.25;
const die = (m) => { console.error(`play-import: ${m}`); process.exit(1); };
const need = (f) => { if (!fs.existsSync(f)) die(`${f} missing`); return f; };

const j = JSON.parse(fs.readFileSync(need(path.join(SRC, `${FLOOR}.sgm.json`)), "utf8"));
if (j.problems && j.problems.length) die(`the floor has problems:\n${j.problems.join("\n")}`);
if (!j.guards || !j.guards.length) die("the floor has no guards");

// --- the mesh ------------------------------------------------------------------

const buf = fs.readFileSync(need(path.join(OUT, "floor.sgm")));
if (buf.toString("latin1", 0, 4) !== "SGM1") die("floor.sgm is not SGM1");
const stride = buf.readUInt32LE(4), nv = buf.readUInt32LE(8), ni = buf.readUInt32LE(12);
const isz = buf.readUInt32LE(16), nparts = buf.readUInt32LE(20);
if (stride !== 60) die(`floor.sgm stride ${stride}, want 60 (the contract's layout)`);
const vbase = 24 + nparts * 8, ibase = vbase + nv * stride;
if (ibase + ni * isz !== buf.length) die("floor.sgm's size does not add up");
const idx = (i) => (isz === 2 ? buf.readUInt16LE(ibase + i * 2) : buf.readUInt32LE(ibase + i * 4));
const NC = 6;
// a vertex: position, and its light as intensity per circuit 0..5
const vert = (k) => {
  const o = vbase + k * stride;
  const light = new Array(NC).fill(0);
  for (let s = 0; s < 4; s++) {
    const c = buf.readUInt8(o + 56 + s), i = buf.readFloatLE(o + 40 + s * 4);
    if (i > 0) { if (c >= NC) die(`vertex ${k} slot ${s}: circuit ${c} out of range`); light[c] += i; }
  }
  return { x: buf.readFloatLE(o), y: buf.readFloatLE(o + 4), z: buf.readFloatLE(o + 8), light };
};

// --- the light grid --------------------------------------------------------------

const ups = [];
let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
for (let t = 0; t < ni; t += 3) {
  const a = vert(idx(t)), b = vert(idx(t + 1)), c = vert(idx(t + 2));
  const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z, wx = c.x - a.x, wy = c.y - a.y, wz = c.z - a.z;
  const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
  const len = Math.hypot(nx, ny, nz);
  if (len < 1e-9 || nz / len <= 0.5) continue;
  ups.push([a, b, c]);
  for (const p of [a, b, c]) { minx = Math.min(minx, p.x); miny = Math.min(miny, p.y); maxx = Math.max(maxx, p.x); maxy = Math.max(maxy, p.y); }
}
const X0 = Math.floor(minx / CELL) * CELL, Y0 = Math.floor(miny / CELL) * CELL;
const W = Math.ceil((maxx - X0) / CELL) + 1, H = Math.ceil((maxy - Y0) / CELL) + 1;
const cells = new Map();   // k -> [{z, light}]
for (const [a, b, c] of ups) {
  const d = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
  if (Math.abs(d) < 1e-12) continue;
  const c0 = Math.max(0, Math.floor((Math.min(a.x, b.x, c.x) - X0) / CELL) - 1);
  const c1 = Math.min(W - 1, Math.ceil((Math.max(a.x, b.x, c.x) - X0) / CELL) + 1);
  const r0 = Math.max(0, Math.floor((Math.min(a.y, b.y, c.y) - Y0) / CELL) - 1);
  const r1 = Math.min(H - 1, Math.ceil((Math.max(a.y, b.y, c.y) - Y0) / CELL) + 1);
  for (let r = r0; r <= r1; r++) for (let col = c0; col <= c1; col++) {
    const x = X0 + (col + 0.5) * CELL, y = Y0 + (r + 0.5) * CELL;
    const u = ((x - a.x) * (c.y - a.y) - (c.x - a.x) * (y - a.y)) / d;
    const v = ((b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y)) / d;
    if (u < -1e-9 || v < -1e-9 || u + v > 1 + 1e-9) continue;
    const z = a.z + u * (b.z - a.z) + v * (c.z - a.z);
    const light = a.light.map((la, i) => la + u * (b.light[i] - la) + v * (c.light[i] - la));
    const k = r * W + col;
    const layers = cells.get(k) || [];
    if (!layers.some((l) => Math.abs(l.z - z) < 0.05)) layers.push({ z, light });
    cells.set(k, layers);
  }
}
const num = (x) => { const r = Math.round(x * 10000) / 10000; return Number.isInteger(r) ? r.toFixed(1) : String(r); };
const layerText = [];
let nlayers = 0;
for (const k of [...cells.keys()].sort((p, q) => p - q)) {
  for (const l of cells.get(k).sort((p, q) => p.z - q.z)) {
    layerText.push(`${k} ${num(l.z)} ${l.light.map(num).join(" ")}`);
    nlayers++;
  }
}

// --- glass, from the collision soup ----------------------------------------------

const coll = fs.readFileSync(need(path.join(OUT, "collide")));
if (coll.toString("latin1", 0, 4) !== "PBC1") die("collide is not PBC1");
const n = coll.readUInt32LE(4);
if (coll.length !== 8 + 38 * n) die("collide's size does not match its count");
const glassTag = j.surfaces.findIndex((s) => s.name === "glass");
if (glassTag < 0) die("the surface table has no glass");
const glass = [];
for (let i = 0; i < n; i++) {
  if (coll.readUInt8(8 + 36 * n + i) !== glassTag) continue;
  const t = [];
  for (let q = 0; q < 9; q++) t.push(num(coll.readFloatLE(8 + 36 * i + 4 * q)));
  glass.push(t.join(" "));
}

// --- the badge, from the floor file ----------------------------------------------

const src = fs.readFileSync(need(FLOOR_FILE), "utf8");
const bm = src.match(/\(badge\s+on-desk:\s*\(\s*([-0-9.]+)\s+([-0-9.]+)\s*\)/);
if (!bm) die(`${FLOOR_FILE}: no (badge on-desk: (X Y))`);
const bx = Number(bm[1]), by = Number(bm[2]);
// the desk top under it: the lowest upward surface there between 0.3 and
// 1.5 m (the floor is below it, a monitor or lamp top above it)
const bcell = Math.floor((by - Y0) / CELL) * W + Math.floor((bx - X0) / CELL);
const tops = (cells.get(bcell) || []).filter((l) => l.z > 0.3 && l.z < 1.5).map((l) => l.z);
if (!tops.length) die(`no desk top under the badge at (${bx} ${by})`);
const bz = Math.min(...tops);

const guards = j.guards.map((g) => {
  if (g.kind !== "patrol") die(`guard kind ${g.kind}: only patrol is known`);
  if (g.route.length !== g.waits.length) die("a guard's route and waits differ in length");
  return `(patrol (${g.route.map((p) => `(${num(p[0])} ${num(p[1])})`).join(" ")}) (${g.waits.map(num).join(" ")}))`;
});

// --- P2: the sector graph, surfaces' noise, panels, and rooms by place --------------

const roomIndex = new Map(j.rooms.map((r) => [r.name, r.index]));
const roomOf = (name) => (name === "exterior" ? -1 : (roomIndex.has(name) ? roomIndex.get(name) : die(`edge names room ${name}`)));
const sym = (s) => (s === null || s === undefined ? "#f" : String(s));
const rooms = j.rooms.map((r) =>
  `(${r.index} ${r.name} ${num(r.floor)} ${num(r.ceiling)} ${r.group} ${sym(r.circuit)} ${r.crouch_only ? "#t" : "#f"})`);
const edges = j.edges.map((e) =>
  `(${e.kind} ${roomOf(e.a)} ${roomOf(e.b)} ${num(e.at[0])} ${num(e.at[1])} ${num(e.width)} ${num(e.zlo)} ${num(e.zhi)} ${num(e.walk)} ${num(e.sight)} ${num(e.sound)} ${sym(e.needs)})`);
const surfaces = j.surfaces.map((s) => `(${s.name} ${sym(s.noise)})`);
const panels = j.circuits.filter((c) => c.panel).map((c) =>
  `(${c.name} ${num(c.panel[0])} ${num(c.panel[1])} ${sym(c.needs)})`);
const am = src.match(/ambient:\s*\(([^)]*)\)/);
const noiseAmbient = am ? am[1].trim() : "";
const reader = j.exit && j.exit.reader ? j.exit.reader : null;

// rooms by place: the collision's upward triangles carry their room (u8,
// 255 none), rasterised on the light grid's cells with a layer per height
const rcells = new Map();
for (let i = 0; i < n; i++) {
  const room = coll.readUInt8(8 + 37 * n + i);
  if (room === 255) continue;
  const v = []; for (let q = 0; q < 9; q++) v.push(coll.readFloatLE(8 + 36 * i + 4 * q));
  const [ax, ay, az, bx, by, bz, cx, cy, cz] = v;
  const ux = bx - ax, uy = by - ay, uz = bz - az, wx = cx - ax, wy = cy - ay, wz = cz - az;
  const nz = ux * wy - uy * wx, len = Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, nz);
  if (len < 1e-9 || nz / len <= 0.5) continue;
  const d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
  if (Math.abs(d) < 1e-12) continue;
  const c0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - X0) / CELL) - 1), c1 = Math.min(W - 1, Math.ceil((Math.max(ax, bx, cx) - X0) / CELL) + 1);
  const r0 = Math.max(0, Math.floor((Math.min(ay, by, cy) - Y0) / CELL) - 1), r1 = Math.min(H - 1, Math.ceil((Math.max(ay, by, cy) - Y0) / CELL) + 1);
  for (let r = r0; r <= r1; r++) for (let col = c0; col <= c1; col++) {
    const x = X0 + (col + 0.5) * CELL, y = Y0 + (r + 0.5) * CELL;
    const u = ((x - ax) * (cy - ay) - (cx - ax) * (y - ay)) / d, w = ((bx - ax) * (y - ay) - (x - ax) * (by - ay)) / d;
    if (u < -1e-9 || w < -1e-9 || u + w > 1 + 1e-9) continue;
    const z = az + u * (bz - az) + w * (cz - az);
    const k = r * W + col, ls = rcells.get(k) || [];
    if (!ls.some((l) => Math.abs(l.z - z) < 0.05)) ls.push({ z, room });
    rcells.set(k, ls);
  }
}
const roomLines = [];
for (const k of [...rcells.keys()].sort((p, q) => p - q))
  for (const l of rcells.get(k).sort((p, q) => p.z - q.z)) roomLines.push(`${k} ${num(l.z)} ${l.room}`);
if (!roomLines.length) die("no room tags on the collision's floors");

const sexp = `;; generated by scripts/play-import.mjs from ${FLOOR}.sgm.json, floor.sgm and collide; do not edit
((guards ${guards.join(" ")})
 (start ${num(j.start.at[0])} ${num(j.start.at[1])} ${num(j.start.facing || 0)})
 (exit ${num(j.exit.at[0])} ${num(j.exit.at[1])})
 (badge ${num(bx)} ${num(by)} ${num(bz)})
 (glass ${glass.join("\n  ")})
 (rooms ${rooms.join("\n  ")})
 (edges ${edges.join("\n  ")})
 (surfaces ${surfaces.join(" ")})
 (panels ${panels.join(" ")})
 (reader ${sym(reader)})
 (noise-ambient ${noiseAmbient})
 (roomgrid ${roomLines.length}
  ${roomLines.join("\n  ")})
 (light ${num(CELL)} ${num(X0)} ${num(Y0)} ${W} ${H} ${nlayers}
  ${layerText.join("\n  ")}))
`;
fs.writeFileSync(path.join(OUT, "play.sexp"), sexp);
console.log(`play-import: ${path.relative(ROOT, path.join(OUT, "play.sexp"))}: ${j.guards.length} guard(s), ` +
  `badge (${bx} ${by} ${num(bz)}), ${glass.length} glass triangles, light grid ${W}x${H} at ${CELL} m, ` +
  `${cells.size} cells, ${nlayers} layers, ${sexp.length} bytes`);
