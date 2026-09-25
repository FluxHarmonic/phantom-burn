# The floor compiler

Floors are written as text (`floors/NAME.floor`), props as parts (`props/NAME.prop`), surfaces as text cells (`props/textures/NAME.cells`), and the compiler turns them into what the game draws and collides with. This is Phantom Burn's design section 7, *Building the world*; the gates are section 8's 1, 2 and 6.

Coordinates everywhere are metres, **x east, y north, z up**, the output mesh included.

## Tools

```
phantom-burn --floor-check FLOOR...          gates 1, 2 and 6; problems as FILE:LINE: message [gate N]
phantom-burn --floor-compile FLOOR [--out DIR]
                                              DIR/NAME.sgm, NAME.sgm.json, NAME.collide, tex-*.png
                                              (DIR defaults to build/floors)
phantom-burn --floor-sheet FLOOR [OUT.svg]   the plan from above
phantom-burn --floor-time FLOOR [N]          compile N times, print the stage times
```

```
phantom-burn --floor-reach FLOOR [--save-witness PATH]
                                              gate 3: the exit reached from the start and
                                              (from the badge) through the duct, with the
                                              exit's tier; nothing behind the exit without
                                              it; each route replayed through the walker
phantom-burn --floor-reach FLOOR --probe X Y Z
                                              a body settled at (X Y Z), tick by tick
phantom-burn --floor-replay FILE.collide SCRIPT
                                              gate 5's native leg: a witness script
                                              replayed over the shipped collision file,
                                              one "replay K X Y Z YAW HEIGHT" line a tick
scripts/floor-shot FLOOR [K...]              in-game shots of the floor's views through the
                                              shell's shot-native, beside the export's renders
```

Exit status: 0 clean, 1 problems, 2 a usage or file error. `--raise` (with `--floor-check`) lets an internal compiler error through with its stack, and prints the stages as they finish.

Heavy runs go to an azoth runner (folio `procedures/azoth-remote-builds`):

```
scripts/build-remote --no-web --command "--floor-reach floors/14-slice.floor" --output build/floors
```

builds HEAD's release config on the runner, runs the release binary with those arguments, and fetches `build/floors` to `build/remote-out-<sha>/`.

In-process: `(compile-floor "floors/NAME.floor" read-text)` from `(phantom floor compile)`, where `read-text` is `(lambda (path) text-or-#f)`. It never raises on bad content.

## The floor file

```
(floor
  level: 14                  ; required
  intent: "..."              tier-in: staff  tier-out: facilities
  ambient: (hvac 0.3 ...)    ; sound, name level pairs
  rooms: ((NAME corners: ((x y) ...) floor: Z ceiling: Z surface: S
                [over: ROOM | (ROOM ...)] [light: CIRCUIT | none]
                [edge: glass-rail] [crouch-only: #t]) ...)
  openings: ((door|arch|glass|grate|hatch between: (A B) at: (x y) | along: ((x y) (x y))
                [width: W] [height: H] [size: S]) 
             (window|exit in: ROOM at: (x y) | along: (...) [sill: Z] [head: Z] [reader: TIER]) ...)
  stairs: ((from: LOWER to: UPPER start: (x y) end: (x y) [width: W] [surface: S]) ...)
  lights: ((CIRCUIT level: L [panel: (x y)] [needs: TIER]) ...)
  things: ((lifts in: ROOM along: ((x y) (x y)) count: N [kind: PROP])
           (guard kind: patrol|post route: ((x y) ...) [waits: (s ...)])
           (desk|cabinet|prop kind: PROP PLACEMENT [facing: DEGREES] [z: Z])
           (badge on-desk: (x y) tier: TIER)
           (rail along: ((x y) (x y)) [in: ROOM]) ...)
  views: ((NAME at: (x y z) look: (x y z) [lens: MM]) ...)
  start: (x y)  [facing: DEGREES])
```

Rooms:
- **Corners** are an outline in either winding; it must be a simple shape.
- **Over:** a room with `edge:` is OPEN over the rooms it names: a mezzanine inside their height, sharing their air. Its edges that face their air are open, with rails. Under it, the lower room's ceiling is `SLAB` (0.25 m) below its floor. A room without `edge:` is CLOSED over them (a duct): its floor is at or above their ceiling, and the gap is solid.
- **Surface** names a legend surface (footsteps, and the floor's material). **Light** names a circuit.

Openings are placed on the wall the two rooms share (or, for `window` and `exit`, on the room's wall with the outside beyond):
- `door` is 1 m wide and 2.1 m high unless given.
- `arch` and `grate` take the whole shared wall and the full shared height unless given.
- `glass` and `window` take their `along:` stretch; `window` runs `sill:` to `head:` above the floor, and both get a pane.
- `exit` takes the `exit-door` prop's `opening:` and places the door.
- `hatch` is a square (`size:`, 0.64 m by default) at a point inside both rooms, turned square to the upper room's nearest wall, through the slab between them.

A thing's PLACEMENT is `at: (x y)`, or `in: ROOM` with `against: WALL from: (END M)`, `from: (corner N (dx dy))` or `from: (centre (dx dy))` (see the growth plan, item 1). `z:` is an absolute height. `facing:` and the start's `facing:` are degrees anticlockwise from east (0 east, 90 north). Note that the shell's walker counts yaw from north.

The circuits `emergency`, `screens` and `city` are reserved: lamps in props and the compiler's rules use them, and nothing switches them.

## Props

```
(prop NAME
  [mount: floor | wall]      ; wall: origin on the wall's face, x to the viewer's right, +y into the room
  [opening: (W H)]           ; the hole a wall prop needs (the exit door)
  parts: ((box size: (x y z) at: (x y z) material: M)
          (wedge size: (x y z) at: (x y z) material: M)          ; rises from -y to +y
          (cylinder radius: R height: H at: (x y z) material: M [sides: N])
          (extrude outline: ((x y) ...) height: H at: (x y z) material: M))
  [lamps: ((at: (x y z) colour: "#RRGGBB" [radius: R] [strength: S] circuit: C) ...)]
  [hides: none | crouched | standing])
```

`at:` is a part's centre (an extrusion's base corner). A floor prop's origin is on the floor under its middle, and its front is -y.

## The legend and textures

`props/materials.legend` holds:
- the palette (every colour a cell or material may use);
- the surfaces (`material:`, `noise:`, and optional `walls:` and `ceiling:`);
- the materials (`texture:` or `colour:`, and optional `glass:` opacity and `emits: #t`);
- the materials the detail rules use (`walls:`, `ceilings:`, `trim:`, `skirting:`, `frames:`, `rails:`, `panels:`).

A texture is 16 by 16 cells per half metre: `(texture NAME legend: (("c" "#RRGGBB") ...) cells: ("16 chars" ...))`. Row 0 is the image's top row.

## How it builds

1. **The plan:** every room outline and hatch square is overlaid and split where outlines cross or touch. A **face** is a region covered by one set of outlines; an **edge** is a stretch of outline with a face (or the void) on each side.
2. **Heights:** each face's rooms give intervals of air; linked rooms (one room, one volume, a hatch and its two rooms) that touch make one **column**.
3. **Openings** become holes in the edges their rooms share.
4. **Walls:** on each side of each edge, whatever air does not continue across the edge (into a linked room, or through a hole) is wall.
5. **Floors and ceilings:** the bottom and top of each column.
6. **Stairs** are flat steps of at most 0.17 m rise. **Rails** run along an open room's open edges, left open where a stair lands. **Frames** go round doors, arches, the exit and grates; windows get mullions, a sill and a head; walls get skirting.
7. **Dressing:** the things' props, the lifts along their wall, the exit door, each circuit's switch panel, and ceiling light panels. Panels are the most interior spots of each lit ceiling, 3.5 m apart (4 m under ceilings over 4 m), 0.9 m from its edge. The city shines through windows.
8. **Light:** per vertex, each circuit's light from its panels and lamps, occluded by the opaque collision triangles; the four strongest circuits are kept.

Render surfaces are split at a half-metre grid so the vertex light holds up; collision surfaces are not.

## Outputs

- **Mesh:** one vertex buffer (stride 60) and one index buffer, u16 while it can.
  - Layout: `position float3, uv float2, normal float3, color ubyte4n, emission ubyte4n, light float4, circuit ubyte4`.
  - Parts (index ranges), in order: one per texture, then `solid` (colour per vertex), then `glass` (blended, cull none).
  - Front faces are CCW from the side they face.
- **`light` and `circuit`:** four (circuit index, intensity) slots per vertex. The shader multiplies each by its circuit's level and colour, so switching a circuit is one uniform. **Declare `circuit` as `in uvec4 circuit;`**: sokol binds UBYTE4 as an integer attribute (`glVertexAttribIPointer`), and a `vec4` input reads undefined (the shell measured every slot reading circuit 0).
- **Emission alpha:** 0 is not emissive; `128 + k` is a fixture on circuit `k` (it goes dark with it); 255 is always on.
- **Circuits:** the floor's, in order, then `emergency`, `screens` and `city`.
- **Collision soup** (`.collide`): `"PBC1"`, a u32 count, then count x 9 float32, count x u8 surface tag, count x u8 room (255 none). Each triangle is CCW from its open side; glass and rails are two-sided.
- **The JSON sidecar:** layout, parts, textures, `ambient`, circuits (with `switchable`), `lights` (every emitter), surfaces (the tag table), rooms, edges (the sector graph: kind, rooms, where, how wide, and walk, sight and sound factors), views, start, exit, guards, and problems.


## Format growth plan

Agreed 2026-09-25 (David asked whether `.floor` scales to larger maps). P0's slice stays as it is. Each piece is built when P1 and P2's floors need it, and new work is designed so these fit without rework.

1. **Room-relative placement for things. Built in P0** (the root room uses it). A thing names its room (`in: ROOM`) and is placed from one of three anchors. It compiles to world coordinates, so nothing downstream changes. Every placement goes through one resolver, `resolve-placement` in `dress.sgl`, so a new anchor is one more case there.
   - `against: WALL from: (END M)`: its back against one of the room's walls (`north`, `south`, `east`, `west`: the wall whose outward normal is nearest that direction), its centre `M` metres along the wall from that wall's `END`, facing into the room. This is the preferred anchor because it survives reshaping the room.
   - `from: (corner N (dx dy))`: offset from the room's Nth corner (0-based, in the order written).
   - `from: (centre (dx dy))`: offset from the room's centroid, for things that belong in the middle.
2. **Shared edges and named points,** so rooms that meet don't repeat corners and drift apart. The first step is a check that the walls either side of every opening coincide. The plan already treats corners closer than 0.1 mm as one; a corner off by 5 cm makes a sliver wall, which the check will name.
3. **Prefab groups:** a named cluster (a desk pod: desk, chair, monitor, lamp), placed once like a prop, and a declarative repeat (`repeat: N step: (dx dy)`).
4. **Includes or zones** once a floor passes about 50 rooms: a floor file that includes zone files, each checked on its own and then together at the seams.
5. **Guard waypoints named or attached to rooms** (`(at: ROOM from: centre (dx dy))`), so moving a room moves its route.
6. **Incremental, per-room checks:** the plan, the heights and the walls are already per face and per edge. Caching them by room lets live reload recheck only the rooms an edit touched and their neighbours.

## Gates (design section 8)

- **1, parse and legend:** every file reads; every field exists and has the right shape; every name is declared (surfaces, circuits, rooms, props, materials, textures, palette colours). Openings sit on a wall their rooms share; a hatch's square lies inside both rooms, with the upper room's floor above the lower room's ceiling. Guard waypoints are in a room and 0.3 m clear of walls, props, stairs and rails. Views and the start are in a room. Fixtures: every emissive vertex's tag names a real circuit, and every switchable ceiling panel's emissive vertices carry its circuit.
- **2, sealed:** outlines are simple; no two rooms on one level overlap; no opening opens onto the void; and rays from inside every room, in 26 directions, all meet the built surfaces.
- **6, stacking and stairs:** closed rooms over others start at or above their ceiling; open ones sit inside them, with 2 m under their slab; a room over another is above it, and stacked rooms say `over:`; stairs start in the lower room and land on an open edge of the upper, with no rail across where they land.
  The built heights are checked too: in every face, no two rooms have air at the same height.
- **3, reach** (`--floor-reach`, through the shell's `(phantom walker)` at its fixed TICK over the compiled collision):
  - With the exit's tier, the exit is reached from the start, and from the badge through the duct with the corridor's floor forbidden.
  - Without the tier, nothing reaches the space behind the exit.
  - Each route is realized from the real start state, recording every input, then replayed from a fresh walker to the same place.
  - "Unreachable" means no searched pattern reached it.
- **5, determinism:** a gate 3 witness replayed natively (`--floor-replay`) and on the web (the shell's page, a `replay` dispatch over the same `.collide` bytes) gives byte-identical traces.
