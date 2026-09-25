# The guard's body, baked as poses (t-9e245c; stealth-game-design §7, D25, D33).
#
# One smooth body grown from joints (the pass-3 guard, as guard-rig.py built it
# for the skinning probe), with the look test's helmet, visor shell and LED
# strip in place of the cap and face. The rig walks a 32-frame cycle; its eight
# keys (every 4 frames) are baked as whole-body poses, with the rest pose as a
# ninth. No skinning in the game: the vertex shader blends two walk poses, and
# eases toward the rest pose when the guard stops.
#
#   flatpak run --filesystem=$REPO org.blender.Blender --background --factory-startup \
#     --python-exit-code 1 --python $REPO/models/guard/guard.py -- $REPO/assets/guard [PREVIEW_DIR]
#
# Writes OUT/guard.sgm (SGM1, the layout below) and OUT/guard.json (counts and
# the parts), and with PREVIEW_DIR a Workbench sheet of the eight poses.
#
# The mesh: 8 parts, part k = walk pose k blended with pose k+1 (mod 8). Every
# vertex carries, in the guard's own frame (x right, y forward, z up, feet at
# z 0; Blender's x forward and y left):
#   pos_a  short4n  walk pose k, metres / 2 (xyz), w 0
#   pos_b  short4n  walk pose k+1
#   pos_r  short4n  the rest pose
#   nrm_a  byte4n   normals of the three (w 0)
#   nrm_b  byte4n
#   nrm_r  byte4n
#   color  ubyte4n  the material's colour; a = 255 body, 0 the visor's strip
# 40 bytes a vertex, u16 indices (the same triangles in every part, offset).
import bpy, math, sys, json, struct, os
from mathutils import Vector as V, Matrix

bpy.ops.wm.read_factory_settings(use_empty=True)
ARGS = sys.argv[sys.argv.index("--") + 1:]
OUT = ARGS[0]
PREVIEW = ARGS[1] if len(ARGS) > 1 else None
os.makedirs(OUT, exist_ok=True)

def hexc(h): return tuple(int(h[i:i+2], 16) / 255 for i in (1, 3, 5))
def mat(name, h):
    m = bpy.data.materials.new(name); m.diffuse_color = (*hexc(h), 1); return m
# The look test's guard colours for the helmet and visor; the rig's for the rest.
UNI, TROU, BOOT = mat("uniform", "#5C4D8C"), mat("trousers", "#2E1C4D"), mat("boots", "#0D0A1A")
SKIN, BELT, BADGE, TORCH = mat("skin", "#9E5761"), mat("belt", "#17122E"), mat("badge", "#4DF2D9"), mat("torch", "#FFCC33")
HELMET, VISOR, STRIP = mat("helmet", "#21173D"), mat("visor", "#0D0A1A"), mat("strip", "#FFFFFF")
FLOOR = mat("floor", "#3D4052")

# --- the body: guard-rig.py's joint graph, rest pose (arms down, legs straight)
J, E, R = [], [], []
def j(p, r, parent=None):
    J.append(V(p)); R.append(r); i = len(J) - 1
    if parent is not None: E.append((parent, i))
    return i
pel = j((0, 0, 0.92), (0.15, 0.11))
waist = j((0.005, 0, 1.08), (0.145, 0.1), pel)
chest = j((0.01, 0, 1.28), (0.18, 0.12), waist)
neck = j((0.02, 0, 1.47), (0.055, 0.055), chest)
NAMED = {pel: "pelvis", waist: "waist", chest: "chest", neck: "neck"}
HAND = {}
for side, s in ((1, "L"), (-1, "R")):
    col = j((0.0, side * 0.11, 1.41), (0.07, 0.06), chest)
    sh = j((0.0, side * 0.2, 1.39), (0.07, 0.065), col)
    el = j((0.02, side * 0.23, 1.10), (0.05, 0.05), sh)
    ha = j((0.06, side * 0.24, 0.84), (0.038, 0.035), el)
    HAND[s] = ha
    NAMED.update({col: "clavicle." + s, sh: "upperarm." + s, el: "forearm." + s, ha: "hand." + s})
for side, s in ((1, "L"), (-1, "R")):
    hi = j((0, side * 0.09, 0.86), (0.085, 0.085), pel)
    kn = j((0.01, side * 0.095, 0.44), (0.058, 0.058), hi)
    an = j((0.0, side * 0.1, 0.03), (0.045, 0.045), kn)
    to = j((0.16, side * 0.1, 0.0), (0.05, 0.042), an)
    NAMED.update({hi: "hip." + s, kn: "thigh." + s, an: "shin." + s, to: "foot." + s})
me = bpy.data.meshes.new("guard"); me.from_pydata([tuple(p) for p in J], E, [])
o = bpy.data.objects.new("guard", me); bpy.context.collection.objects.link(o)
sk = o.modifiers.new("skin", 'SKIN'); sk.use_smooth_shade = True; sk.branch_smoothing = 0.6
for i, r in enumerate(R): me.skin_vertices[0].data[i].radius = r
me.skin_vertices[0].data[0].use_root = True
bpy.context.view_layer.objects.active = o; o.select_set(True)
bpy.ops.object.skin_armature_create(modifier="skin")
arm = next(x for x in bpy.data.objects if x.type == 'ARMATURE')
for b in arm.data.bones:
    tail = arm.matrix_world @ b.tail_local
    i = min(range(len(J)), key=lambda k: (J[k] - tail).length)
    old = b.name; b.name = NAMED.get(i, old)
    vg = o.vertex_groups.get(old)
    if vg: vg.name = b.name
bpy.context.view_layer.objects.active = o
for x in bpy.data.objects: x.select_set(x is o)
bpy.ops.object.modifier_apply(modifier="skin")
sub = o.modifiers.new("sub", 'SUBSURF'); sub.levels = 1
bpy.ops.object.modifier_move_to_index(modifier="sub", index=0)
bpy.ops.object.modifier_apply(modifier="sub")
o.data.materials.append(UNI); o.data.materials.append(TROU); o.data.materials.append(BOOT)
for p in o.data.polygons:
    z = p.center.z
    p.material_index = 2 if z < 0.13 else (1 if z < 0.87 else 0)

# --- the small rigid parts, each weighted 1.0 to one bone
def part(op, loc, scale, m, bone, smooth=True, **kw):
    op(location=loc, **kw); x = bpy.context.active_object; x.scale = scale; x.data.materials.append(m)
    bpy.ops.object.transform_apply(scale=True)
    if smooth: bpy.ops.object.shade_smooth()
    g = x.vertex_groups.new(name=bone); g.add([v.index for v in x.data.vertices], 1.0, 'REPLACE')
    return x
# The head: the look test's helmet and visor shell, and the strip across the
# visor at 1.63 m (P1's GUARD-EYE is 1.65; the strip glows the guard's state).
P = [part(bpy.ops.mesh.primitive_uv_sphere_add, (0.02, 0, 1.63), (1.12, 1.02, 1.1), HELMET, "neck", segments=18, ring_count=10, radius=0.115),
     part(bpy.ops.mesh.primitive_uv_sphere_add, (0.085, 0, 1.6), (0.55, 0.95, 0.62), VISOR, "neck", segments=18, ring_count=10, radius=0.12),
     part(bpy.ops.mesh.primitive_cube_add, (0.146, 0, 1.63), (0.012, 0.19, 0.018), STRIP, "neck", smooth=False, size=1),
     part(bpy.ops.mesh.primitive_uv_sphere_add, J[HAND["L"]], (0.05, 0.036, 0.045), SKIN, "hand.L", segments=10, ring_count=6, radius=1),
     part(bpy.ops.mesh.primitive_uv_sphere_add, J[HAND["R"]], (0.05, 0.036, 0.045), SKIN, "hand.R", segments=10, ring_count=6, radius=1),
     part(bpy.ops.mesh.primitive_cylinder_add, (0.005, 0, 0.93), (0.158, 0.118, 0.05), BELT, "pelvis", vertices=16, radius=1, depth=1),
     part(bpy.ops.mesh.primitive_cube_add, (-0.05, 0.125, 0.9), (0.05, 0.03, 0.09), BELT, "pelvis", smooth=False, size=1),
     part(bpy.ops.mesh.primitive_cube_add, (0.165, 0.075, 1.32), (0.012, 0.05, 0.07), BADGE, "chest", smooth=False, size=1),
     part(bpy.ops.mesh.primitive_cylinder_add, J[HAND["R"]] + V((0.1, 0, 0)), (0.025, 0.025, 0.2), TORCH, "hand.R",
          vertices=10, radius=1, depth=1, rotation=(0, math.pi / 2, 0))]
for x in bpy.data.objects: x.select_set(x is o or x in P)
bpy.context.view_layer.objects.active = o; bpy.ops.object.join()
o.modifiers["Armature"].object = arm
o.parent = arm

# --- the walk: guard-rig.py's cycle, keys every 4 frames (frame 33 = frame 1)
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='POSE')
def swing(bone, deg, frame):
    pb = arm.pose.bones[bone]; pb.rotation_mode = 'QUATERNION'
    Mr = arm.data.bones[bone].matrix_local.to_3x3()
    pb.rotation_quaternion = (Mr.inverted() @ Matrix.Rotation(math.radians(deg), 3, 'Y') @ Mr).to_quaternion()
    pb.keyframe_insert("rotation_quaternion", frame=frame)
for k in range(9):
    f = 1 + 4 * k; ph = 2 * math.pi * k / 8; s = math.sin(ph)
    for side, sg in (("L", 1), ("R", -1)):
        swing("thigh." + side, -28 * s * sg, f)
        swing("shin." + side, 40 * max(0.0, math.sin(ph + sg * 1.6)), f)
        swing("upperarm." + side, 20 * s * sg, f)
        swing("forearm." + side, -12 - 8 * max(0.0, s * sg), f)
    arm.pose.bones["pelvis"].location = (0, 0, 0); arm.pose.bones["pelvis"].keyframe_insert("location", frame=f)
bpy.ops.object.mode_set(mode='OBJECT')
scn = bpy.context.scene; scn.frame_start, scn.frame_end = 1, 32; scn.render.fps = 30

# --- the poses, from the evaluated (armature-deformed) mesh
def evaluated():
    dg = bpy.context.evaluated_depsgraph_get()
    m = o.evaluated_get(dg).to_mesh()
    m.calc_loop_triangles()
    pos = [tuple(v.co) for v in m.vertices]
    nrm = [tuple(n.vector) for n in m.corner_normals]
    tris = [(tuple(t.loops), t.material_index) for t in m.loop_triangles]
    loopv = [l.vertex_index for l in m.loops]
    o.evaluated_get(dg).to_mesh_clear()
    return pos, nrm, tris, loopv
FRAMES = [1 + 4 * k for k in range(8)]
walk = []
for f in FRAMES:
    scn.frame_set(f); walk.append(evaluated())
arm.data.pose_position = 'REST'; bpy.context.view_layer.update()
rest = evaluated()
arm.data.pose_position = 'POSE'; bpy.context.view_layer.update()
_, _, tris, loopv = rest
for w in walk:
    assert len(w[0]) == len(rest[0]) and len(w[2]) == len(tris), "the topology changed between poses"

# One game vertex per (Blender vertex, material, rest normal rounded): smooth
# surfaces share their vertices, hard edges (the cubes) split them.
COLS = [tuple(m.diffuse_color[:3]) for m in o.data.materials]
MATNAMES = [m.name for m in o.data.materials]
keys, first_loop, out_tris = {}, [], []
for loops, mi in tris:
    ids = []
    for l in loops:
        n = rest[1][l]
        k = (loopv[l], mi, round(n[0], 2), round(n[1], 2), round(n[2], 2))
        if k not in keys:
            keys[k] = len(first_loop); first_loop.append((l, mi))
        ids.append(keys[k])
    out_tris.append(ids)
NV = len(first_loop); NT = len(out_tris)
assert NV * 8 < 65535, "too many vertices for u16 indices: %d" % NV

# The skin's radius at the ankles and toes reaches below the joints: lift
# every pose by the same amount, so the standing soles sit on z 0 (and the
# planted foot of the walk stays on the floor).
LIFT = -min(p[2] for p in rest[0])
def game(p):          # Blender (x forward, y left, z up) -> the game's (x right, y forward, z up)
    return (-p[1], p[0], p[2] + LIFT)
def game_n(n):
    return (-n[1], n[0], n[2])
def s4n(p):           # metres / 2, short4n
    return [max(-32767, min(32767, int(round(c / 2.0 * 32767)))) for c in game(p)] + [0]
def b4n(n):
    g = game_n(n); l = math.sqrt(sum(c * c for c in g)) or 1.0
    return [max(-127, min(127, int(round(c / l * 127)))) for c in g] + [0]
def u8(c): return max(0, min(255, int(round(c * 255))))

STRIDE = 40
verts = bytearray()
for k in range(8):
    a, b = walk[k], walk[(k + 1) % 8]
    for (l, mi) in first_loop:
        v = loopv[l]
        c = COLS[mi]
        verts += struct.pack("<4h4h4h", *s4n(a[0][v]), *s4n(b[0][v]), *s4n(rest[0][v]))
        verts += struct.pack("<4b4b4b", *b4n(a[1][l]), *b4n(b[1][l]), *b4n(rest[1][l]))
        verts += struct.pack("<4B", u8(c[0]), u8(c[1]), u8(c[2]), 0 if MATNAMES[mi].startswith("strip") else 255)
assert len(verts) == STRIDE * NV * 8
idx = bytearray()
for k in range(8):
    for t in out_tris:
        # (x, y, z) -> (-y, x, z) is a turn, not a mirror: the winding stays
        # counter-clockwise from outside
        idx += struct.pack("<3H", t[0] + k * NV, t[1] + k * NV, t[2] + k * NV)
parts = [(k * NT * 3, NT * 3) for k in range(8)]
with open(os.path.join(OUT, "guard.sgm"), "wb") as fh:
    fh.write(b"SGM1" + struct.pack("<5I", STRIDE, NV * 8, NT * 3 * 8, 2, len(parts)))
    for p in parts: fh.write(struct.pack("<2I", *p))
    fh.write(verts); fh.write(idx)
top = max(p[2] for p in rest[0]) + LIFT
info = {"vertices_per_pose": NV, "triangles": NT, "poses": 8, "stride": STRIDE, "parts": parts,
        "height": round(top, 3), "lift": round(LIFT, 4), "strip_z": round(1.63 + LIFT, 3), "frames": FRAMES,
        "cycle": "32 frames at 30 fps, two steps; the game plays one cycle per 1.5 m walked"}
with open(os.path.join(OUT, "guard.json"), "w") as fh: json.dump(info, fh, indent=1)
print("GUARD verts/pose", NV, "tris", NT, "height", round(top, 3), "bytes", os.path.getsize(os.path.join(OUT, "guard.sgm")))

# --- the preview: the eight poses side by side (Workbench), for judging by eye
if PREVIEW:
    os.makedirs(PREVIEW, exist_ok=True)
    bpy.ops.mesh.primitive_cube_add(location=(0, 0, -0.05), size=1); fl = bpy.context.active_object
    fl.scale = (8, 8, 0.1); fl.data.materials.append(FLOOR)
    scn.render.engine = 'BLENDER_WORKBENCH'
    sh = scn.display.shading; sh.color_type = 'MATERIAL'; sh.light = 'STUDIO'; sh.show_specular_highlight = False
    scn.world = bpy.data.worlds.new("w"); scn.world.color = hexc("#0D0A1A")
    scn.render.resolution_x, scn.render.resolution_y = 180, 270
    bpy.ops.object.empty_add(location=(0.05, 0, 0.95)); tgt = bpy.context.active_object
    bpy.ops.object.camera_add(location=(0.9, -3.2, 1.3)); cam = bpy.context.active_object
    c = cam.constraints.new("TRACK_TO"); c.target = tgt; c.track_axis = "TRACK_NEGATIVE_Z"; c.up_axis = "UP_Y"
    cam.data.lens = 40; scn.camera = cam
    for f in FRAMES:
        scn.frame_set(f); scn.render.filepath = "%s/guard-pose-f%02d.png" % (PREVIEW, f)
        bpy.ops.render.render(write_still=True)
    print("PREVIEW", PREVIEW)
