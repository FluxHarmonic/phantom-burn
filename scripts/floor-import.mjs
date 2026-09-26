#!/usr/bin/env node
// floor-import.mjs - bring a compiled floor into the game's assets.
//
//   node scripts/floor-import.mjs [SRC-DIR] [FLOOR]
//
// SRC-DIR is the floor compiler's output (default: the compiler worktree's
// build/floors, ../task-phantom-burn-p0-compiler/build/floors); FLOOR is the
// floor's name (default 14-slice). Writes assets/floors/FLOOR/:
//   floor.sgm              the static mesh (SGM1, stride 60: the contract's
//                          layout with the light and circuit slots)
//   collide, collide.b64   the PBC1 collision soup, and in base64 for the web
//   tex-*.png              the text-cell textures
//   city.sgm               the skyline, from the stand-in (the compiler does
//                          not build the city yet)
//   floor.sexp             what the game needs from the JSON sidecar, as one
//                          Sigil datum both shells read with `read`:
//     ((name "14-slice")
//      (layout (position float3) ...)
//      (parts (NAME FIRST COUNT TEXTURE-FILE-OR-#f GLASS?) ...)
//      (circuits (NAME INDEX LEVEL R G B SWITCHABLE?) ...)
//      (ambient R G B)
//      (fixtures (X Y Z CIRCUIT) ...)      ; the switchable lights, whose
//                                          ; emissive surfaces go dark with them
//      (views (NAME EX EY EZ TX TY TZ LENS-OR-#f) ...)
//      (start X Y FACING)
//      (exit X Y)
//      (surfaces NAME ...)                 ; the collision's surface tags, by index
//      (devices (ID KIND X Y Z FACING TIER ROOM ARGS...) ...)   ; P3, the device API:
//      (outlines (ROOM FLOOR-Z (X Y) ...) ...)                  ;   the floor's devices,
//      (openings (KIND X0 Y0 X1 Y1) ...)                        ;   and the terminal's map
//      (look sim)                          ; PRACTICE (topics/phantom-burn-practice-api):
//      (wire (X0 Y0 Z0 X1 Y1 Z1) ...))     ;   the sim's look, and its edges
//      (each only when the compiler wrote it; ROOM is the compiled room's index)
// Refuses a floor with problems, or whose layout is not the contract's.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.resolve(process.argv[2] || path.join(ROOT, "../task-phantom-burn-p0-compiler/build/floors"));
const FLOOR = process.argv[3] || "14-slice";
const OUT = path.join(ROOT, "assets/floors", FLOOR);
const need = (f) => { if (!fs.existsSync(f)) { console.error(`floor-import: ${f} missing`); process.exit(1); } return f; };

const j = JSON.parse(fs.readFileSync(need(path.join(SRC, `${FLOOR}.sgm.json`)), "utf8"));
if (j.problems && j.problems.length) { console.error(`floor-import: the floor has problems:\n${j.problems.join("\n")}`); process.exit(1); }
const LAYOUT = [["position", "float3"], ["uv", "float2"], ["normal", "float3"], ["color", "ubyte4n"], ["emission", "ubyte4n"], ["light", "float4"], ["circuit", "ubyte4"]];
if (JSON.stringify(j.layout) !== JSON.stringify(LAYOUT)) { console.error(`floor-import: layout ${JSON.stringify(j.layout)} is not the contract's`); process.exit(1); }

fs.mkdirSync(OUT, { recursive: true });
fs.copyFileSync(need(path.join(SRC, `${FLOOR}.sgm`)), path.join(OUT, "floor.sgm"));
const collide = fs.readFileSync(need(path.join(SRC, `${FLOOR}.collide`)));
if (collide.toString("latin1", 0, 4) !== "PBC1") { console.error("floor-import: the collision is not PBC1"); process.exit(1); }
fs.writeFileSync(path.join(OUT, "collide"), collide);
fs.writeFileSync(path.join(OUT, "collide.b64"), collide.toString("base64"));
const texFiles = [];
for (const [name, t] of Object.entries(j.textures || {})) {
  fs.copyFileSync(need(path.join(SRC, t.file)), path.join(OUT, t.file));
  texFiles.push([name, t.file]);
}
fs.copyFileSync(need(path.join(ROOT, "assets/stand-in/city.sgm")), path.join(OUT, "city.sgm"));

const num = (x) => { const r = Math.round(x * 10000) / 10000; return Number.isInteger(r) ? r.toFixed(1) : String(r); };
const str = (s) => JSON.stringify(String(s));
const texOf = (name) => { const t = texFiles.find(([n]) => n === name); return t ? str(t[1]) : "#f"; };
const parts = j.parts.map((p) => `(${p.name} ${p.first} ${p.count} ${p.texture ? texOf(p.texture) : "#f"} ${p.pass === "glass" ? "#t" : "#f"})`);
const circuits = j.circuits.map((c) => `(${c.name} ${c.index} ${num(c.level)} ${c.rgb.map(num).join(" ")} ${c.switchable ? "#t" : "#f"})`);
const switchable = new Set(j.circuits.filter((c) => c.switchable).map((c) => c.index));
const fixtures = j.lights.filter((l) => switchable.has(l.circuit)).map((l) => `(${l.at.map(num).join(" ")} ${l.circuit})`);
const views = j.views.map((v) => `(${v.name} ${v.eye.map(num).join(" ")} ${v.at.map(num).join(" ")} ${v.lens_mm ? num(v.lens_mm) : "#f"})`);
// P3 (topics/phantom-burn-device-api): the devices, and the terminal map's
// outlines and openings, carried as the compiler wrote them
const devices = (j.devices || []).map((d) =>
  `(${d.id} ${d.kind} ${d.at.map(num).join(" ")} ${num(d.facing || 0)} ${d.tier} ${d.room}${(d.args || []).map((a) => " " + num(a)).join("")})`);
const outlines = (j.outlines || []).map((o) => `(${o.room} ${num(o.floor)} ${o.corners.map((c) => `(${num(c[0])} ${num(c[1])})`).join(" ")})`);
const openings = (j.openings || []).map((o) => `(${o.kind} ${num(o.from[0])} ${num(o.from[1])} ${num(o.to[0])} ${num(o.to[1])})`);
// PRACTICE: the floor's look, and on a sim floor its edges, one edge a row
const look = j.look ? `\n (look ${j.look})` : "";
const wire = (j.wire || []).map((e) => `(${e.map(num).join(" ")})`);
const p3 = (name, rows) => rows.length ? `\n (${name}\n  ${rows.join("\n  ")})` : "";
const sexp = `;; generated by scripts/floor-import.mjs from ${FLOOR}.sgm.json; do not edit
((name ${str(FLOOR)})
 (layout ${LAYOUT.map(([n, f]) => `(${n} ${f})`).join(" ")})
 (parts
  ${parts.join("\n  ")})
 (circuits
  ${circuits.join("\n  ")})
 (ambient ${j.ambient.map(num).join(" ")})
 (fixtures
  ${fixtures.join("\n  ")})
 (views
  ${views.join("\n  ")})
 (start ${num(j.start.at[0])} ${num(j.start.at[1])} ${num(j.start.facing || 0)})
 (exit ${num(j.exit.at[0])} ${num(j.exit.at[1])})
 (surfaces ${j.surfaces.map((s) => s.name).join(" ")})${p3("devices", devices)}${p3("outlines", outlines)}${p3("openings", openings)}${look}${p3("wire", wire)})
`;
fs.writeFileSync(path.join(OUT, "floor.sexp"), sexp);
console.log(`floor-import: ${FLOOR} from ${SRC}: ${parts.length} parts, ${circuits.length} circuits, ${fixtures.length} switchable fixtures, ${views.length} views, ${(collide.length - 8) / 38} collision triangles${j.look ? `, look ${j.look}` : ""}${wire.length ? `, ${wire.length} wire edges` : ""} -> ${path.relative(ROOT, OUT)}`);
