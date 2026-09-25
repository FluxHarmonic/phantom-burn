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

Exit status: 0 clean, 1 problems, 2 a usage or file error. `--raise` (with `--floor-check`) lets an internal compiler error through with its stack, and prints the stages as they finish.

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
           (desk|cabinet|prop at: (x y) kind: PROP [facing: DEGREES] [z: Z])
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
- **`light` and `circuit`:** four (circuit index, intensity) slots per vertex. The shader multiplies each by its circuit's level and colour, so switching a circuit is one uniform.
- **Emission alpha:** 0 is not emissive; `128 + k` is a fixture on circuit `k` (it goes dark with it); 255 is always on.
- **Circuits:** the floor's, in order, then `emergency`, `screens` and `city`.
- **Collision soup** (`.collide`): `"PBC1"`, a u32 count, then count x 9 float32, count x u8 surface tag, count x u8 room (255 none). Each triangle is CCW from its open side; glass and rails are two-sided.
- **The JSON sidecar:** layout, parts, textures, `ambient`, circuits (with `switchable`), `lights` (every emitter), surfaces (the tag table), rooms, edges (the sector graph: kind, rooms, where, how wide, and walk, sight and sound factors), views, start, exit, guards, and problems.

## Gates (design section 8)

- **1, parse and legend:** every file reads; every field exists and has the right shape; every name is declared (surfaces, circuits, rooms, props, materials, textures, palette colours). Openings sit on a wall their rooms share; a hatch's square lies inside both rooms, with the upper room's floor above the lower room's ceiling. Guard waypoints are in a room and 0.3 m clear of walls, props, stairs and rails. Views and the start are in a room. Fixtures: every emissive vertex's tag names a real circuit, and every switchable ceiling panel's emissive vertices carry its circuit.
- **2, sealed:** outlines are simple; no two rooms on one level overlap; no opening opens onto the void; and rays from inside every room, in 26 directions, all meet the built surfaces.
- **6, stacking and stairs:** closed rooms over others start at or above their ceiling; open ones sit inside them, with 2 m under their slab; a room over another is above it, and stacked rooms say `over:`; stairs start in the lower room and land on an open edge of the upper, with no rail across where they land.
