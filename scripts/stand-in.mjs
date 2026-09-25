#!/usr/bin/env node
// stand-in.mjs - build the stand-in floor from G0's Blender export of the
// floor-14 slice, until the floor compiler's output lands.
//
//   node scripts/stand-in.mjs [EXPORT-DIR]
//
// EXPORT-DIR holds floor-14-slice.obj/.mtl, city.obj/.mtl and the eight
// tex-*.png (default: the design's attachments folder). Writes
// assets/stand-in/:
//   floor14.sgm (+ .json)  the dressed slice for drawing, G0's layout
//                          (position uv normal color emission), Y-up as
//                          exported; the game draws it through a model
//                          matrix that turns it Z-up
//   city.sgm (+ .json)     the skyline, the same way
//   tex-*.png              the eight text-cell textures
//   floor14.collide        the collision soup in the compiler's PBC1 form
//                          (contract draft 1): "PBC1", u32 N, N x 9 float32
//                          (design coordinates: x east, y north, z up),
//                          N x u8 surface, N x u8 room (255: none)
//   floor14.collide.b64    the same bytes in base64, which the web page
//                          hands the game as a string (the browser bridge
//                          has no fetch into a bytevector)
// and src/phantom/stand-in.sgl: the draw ranges, lights and views as data.
//
// The guard in the export (uniform, helmet, visor, armour, glove, torch)
// and the plants' leaves are drawn but do not collide.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const EXPORT = path.resolve(process.argv[2] || path.join(os.homedir(), "Ops/attachments/stealth-game-design/floor-14-export"));
const CONV = path.join(ROOT, ".sigil/deps/sigil-graphics/scripts/obj-to-sgm.mjs");
const OUT = path.join(ROOT, "assets/stand-in");

for (const f of ["floor-14-slice.obj", "city.obj", "README.txt"]) {
  if (!fs.existsSync(path.join(EXPORT, f))) { console.error(`stand-in: ${EXPORT}/${f} missing`); process.exit(1); }
}
if (!fs.existsSync(CONV)) { console.error(`stand-in: ${CONV} missing (run sigil deps install)`); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const RENDER_ATTRS = "position,uv,normal,color,emission";
const conv = (obj, out, attrs) =>
  execFileSync("node", [CONV, path.join(EXPORT, obj), out, "--attrs", attrs, "--srgb"], { encoding: "utf8" });

conv("floor-14-slice.obj", path.join(OUT, "floor14.sgm"), RENDER_ATTRS);
conv("city.obj", path.join(OUT, "city.sgm"), RENDER_ATTRS);
for (const f of fs.readdirSync(EXPORT).filter((n) => /^tex-.*\.png$/.test(n))) {
  fs.copyFileSync(path.join(EXPORT, f), path.join(OUT, f));
}

// --- the collision soup ----------------------------------------------------

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stand-in-"));
const posSgm = path.join(tmp, "pos.sgm");
conv("floor-14-slice.obj", posSgm, "position");
const side = JSON.parse(fs.readFileSync(posSgm + ".json", "utf8"));
const buf = fs.readFileSync(posSgm);
const magic = buf.toString("latin1", 0, 4);
if (magic !== "SGM1") { console.error(`stand-in: ${posSgm} is not SGM1 (${magic})`); process.exit(1); }
const stride = buf.readUInt32LE(4), nv = buf.readUInt32LE(8), ni = buf.readUInt32LE(12);
const isz = buf.readUInt32LE(16), nparts = buf.readUInt32LE(20);
if (stride !== 12) { console.error(`stand-in: position-only stride is ${stride}, want 12`); process.exit(1); }
const vbase = 24 + nparts * 8, ibase = vbase + nv * stride;
if (ibase + ni * isz !== buf.length) { console.error("stand-in: SGM1 size does not add up"); process.exit(1); }
const vert = (k) => {
  const o = vbase + k * stride;
  const x = buf.readFloatLE(o), y = buf.readFloatLE(o + 4), z = buf.readFloatLE(o + 8);
  return [x, -z, y]; // OBJ (x, z_design, -y_design) -> design (x, y, z)
};
const idx = (i) => (isz === 2 ? buf.readUInt16LE(ibase + i * 2) : buf.readUInt32LE(ibase + i * 4));

// The surface tags this stand-in uses (the compiler's own table replaces it).
const SURFACES = ["solid", "marble", "carpet", "tile", "grate", "glass"];
const surfaceOf = (m) =>
  ({ "m-marble": 1, "m-carpet": 2, "m-tile": 3, "m-grate": 4, pane: 5, rail: 5 })[m] ?? 0;
const SKIP = new Set(["uniform", "helmet", "visor", "armour", "glove", "torch", "leaf"]);

const tris = [], surf = [];
let skipped = 0;
for (const p of side.parts) {
  if (p.count % 3 !== 0) { console.error(`stand-in: part ${p.name} count ${p.count} not a multiple of 3`); process.exit(1); }
  if (SKIP.has(p.name)) { skipped += p.count / 3; continue; }
  for (let i = p.first; i < p.first + p.count; i += 3) {
    tris.push([vert(idx(i)), vert(idx(i + 1)), vert(idx(i + 2))]);
    surf.push(surfaceOf(p.name));
  }
}
fs.rmSync(tmp, { recursive: true });

const N = tris.length;
const out = Buffer.alloc(8 + N * 36 + N * 2);
out.write("PBC1", 0, "latin1");
out.writeUInt32LE(N, 4);
tris.forEach((t, k) => t.flat().forEach((v, j) => out.writeFloatLE(v, 8 + k * 36 + j * 4)));
surf.forEach((s, k) => out.writeUInt8(s, 8 + N * 36 + k));
for (let k = 0; k < N; k++) out.writeUInt8(255, 8 + N * 37 + k);
fs.writeFileSync(path.join(OUT, "floor14.collide"), out);
fs.writeFileSync(path.join(OUT, "floor14.collide.b64"), out.toString("base64"));

// --- the scene data ----------------------------------------------------------

const floor = JSON.parse(fs.readFileSync(path.join(OUT, "floor14.sgm.json"), "utf8"));
const city = JSON.parse(fs.readFileSync(path.join(OUT, "city.sgm.json"), "utf8"));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const PANEL = hex("#CCE6FF");
const radius = (w) => 3 + 0.5 * Math.sqrt(w);
// From the export README: [design position, watts, colour, circuit (0 c1
// office, 1 c2 lobby/mezzanine/corridor, 2 c3 FM office, 3 the exit light)].
const LIGHTS = [
  [[3, 2, 6.0], 420, PANEL, 1], [[3, 5, 6.0], 420, PANEL, 1], [[7, 2, 6.0], 420, PANEL, 1], [[7, 5, 6.0], 420, PANEL, 1],
  [[12.8, 6.0, 6.0], 300, PANEL, 1], [[5, 8.5, 2.75], 90, PANEL, 1],
  [[16.5, 8.5, 2.8], 90, PANEL, 1], [[19.5, 11.5, 2.8], 90, PANEL, 1],
  [[18, 15, 2.7], 140, PANEL, 0], [[18, 19, 2.7], 140, PANEL, 0], [[20.5, 17, 2.7], 140, PANEL, 0],
  [[24, 19, 2.7], 35, PANEL, 2], [[24.58, 19.48, 1.05], 25, hex("#F2731A"), 2],
  [[3, 9.75, 2.45], 12, hex("#FF9F1A"), 3],
];
// The export's three views (eye at 1.6 m), with the lens as a vertical field
// of view for a 16:9 frame: 36 mm sensor width, 20.25 mm high, so
// fov_y = 2 atan(10.125 / f).
const VIEWS = [
  ["arrival", [1.3, 1.3, 1.6], [10.0, 7.2, 2.2], 17],
  ["overlook", [4.2, 9.3, 4.6], [7.0, -26.0, 1.0], 19],
  ["office", [20.5, 12.2, 1.6], [19.4, 18.8, 1.0], 17],
];
const f = (x) => { const r = Math.round(x * 10000) / 10000; return Number.isInteger(r) ? r.toFixed(1) : r.toString(); };
const GLASS = new Set(["pane", "rail"]);
const textured = floor.parts.filter((p) => p.texture);
const ranges = [];
for (const p of floor.parts.filter((q) => !q.texture)) {
  const glass = GLASS.has(p.name);
  const last = ranges[ranges.length - 1];
  if (last && !glass && !last.glass && last.first + last.count === p.first) last.count += p.count;
  else ranges.push({ first: p.first, count: p.count, glass });
}
const lights = LIGHTS.map(([p, w, c, g]) => `(${[...p, radius(w), c[0] * 1.6, c[1] * 1.6, c[2] * 1.6, g].map(f).join(" ")})`);
const views = VIEWS.map(([name, eye, at, lens]) => {
  const d = [at[0] - eye[0], at[1] - eye[1], at[2] - eye[2]];
  const len = Math.hypot(...d);
  // yaw 0 looks north (+y), positive turns toward west (counter-clockwise from above)
  const yaw = Math.atan2(-d[0], d[1]), pitch = Math.asin(d[2] / len);
  const fov = (2 * Math.atan(10.125 / lens) * 180) / Math.PI;
  return `(${name} ${[...eye, yaw, pitch, fov].map(f).join(" ")})`;
});
const cityCount = city.parts.reduce((s, p) => s + p.count, 0);
const sgl = `;;; (phantom stand-in) - generated by scripts/stand-in.mjs from G0's export
;;; of the floor-14 slice (assets/stand-in/). Do not edit. The stand-in floor
;;; until the floor compiler's output lands.
(define-library (phantom stand-in)
  (import (sigil core))
  (export stand-in-draws stand-in-city-count stand-in-lights stand-in-views
          stand-in-surfaces stand-in-triangles)
  (begin
    ;; (first count texture-file-or-#f glass?): each textured material, then
    ;; the untextured ones merged into ranges, the glass (pane, rail) apart.
    (define stand-in-draws
      '(${textured.map((p) => `(${p.first} ${p.count} "${p.texture}" #f)`).join("\n        ")}
        ${ranges.map((r) => `(${r.first} ${r.count} #f ${r.glass ? "#t" : "#f"})`).join("\n        ")}))
    (define stand-in-city-count ${cityCount})
    ;; (x y z radius r g b circuit), design coordinates (z up)
    (define stand-in-lights
      '(${lights.join("\n        ")}))
    ;; (name x y z yaw pitch fov-y-degrees), design coordinates; yaw 0 faces
    ;; north (+y) and grows counter-clockwise seen from above
    (define stand-in-views
      '(${views.join("\n        ")}))
    ;; the surface tags in floor14.collide
    (define stand-in-surfaces '(${SURFACES.join(" ")}))
    (define stand-in-triangles ${N})))
`;
fs.writeFileSync(path.join(ROOT, "src/phantom/stand-in.sgl"), sgl);
console.log(`stand-in: floor14.sgm ${floor.vertexCount} vertices, ${textured.length} textured + ${ranges.length} ranges; city ${cityCount} indices;`
  + ` collide ${N} triangles (${skipped} skipped: guard, leaves); ${LIGHTS.length} lights; ${VIEWS.length} views`);
