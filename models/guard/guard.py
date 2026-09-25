# The guard's body, baked as poses (t-9e245c; stealth-game-design §7, D25, D33, D37).
#
# D37: the guards are robots, Gibson's own security units. A humanoid machine
# of rigid armour parts: a torso shell, armoured forearms and shins, ball
# joints at shoulder, elbow, hip, knee and ankle, box feet and hands, and a
# helmet whose visor strip sits at 1.65 m (play's GUARD-EYE). Each part rides
# one bone rigidly, so posing never stretches it.
#
# The walk is 16 whole-body poses around one cycle (two steps): legs and
# knees, feet kept near level, arms swinging against the legs, the pelvis
# turning and dropping on the swinging side, the torso turning against it and
# leaning over the standing leg. Every pose is grounded (its lowest point on
# z 0), so the body bobs as the legs spread. A 17th part holds the head's scan
# when he stands: looking left, looking right, and the rest pose.
#
# No skinning in the game: the vertex shader blends two poses and eases
# toward the rest pose (G1 stays held, D33).
#
#   flatpak run --filesystem=$REPO org.blender.Blender --background --factory-startup \
#     --python-exit-code 1 --python $REPO/models/guard/guard.py -- $REPO/assets/guard [PREVIEW_DIR]
#
# Writes OUT/guard.sgm (SGM1) and OUT/guard.json; with PREVIEW_DIR, Workbench
# renders of the poses and a four-view turntable of the rest pose.
#
# The mesh: 17 parts. Part k < 16 is walk pose k with pose k+1 (mod 16);
# part 16 is (look left, look right). Every vertex carries, in the guard's
# frame (x right, y forward, z up, feet at z 0; Blender's x forward, y left):
#   pos_a  short4n  the part's first pose, metres / 2 (xyz), w 0
#   pos_b  short4n  its second pose
#   pos_r  short4n  the rest pose
#   nrm_a  byte4n   normals of the three (w 0)
#   nrm_b  byte4n
#   nrm_r  byte4n
#   color  ubyte4n  the material's colour; a = 255 body, 0 the visor's strip
# 40 bytes a vertex, u16 indices (the same triangles in every part, offset).
import bpy, math, sys, json, struct, os
from mathutils import Vector as V, Matrix, Quaternion

bpy.ops.wm.read_factory_settings(use_empty=True)
ARGS = sys.argv[sys.argv.index("--") + 1:]
OUT = ARGS[0]
PREVIEW = ARGS[1] if len(ARGS) > 1 else None
os.makedirs(OUT, exist_ok=True)
WALK = 16

def hexc(h): return tuple(int(h[i:i+2], 16) / 255 for i in (1, 3, 5))
def mat(name, h):
    m = bpy.data.materials.new(name); m.diffuse_color = (*hexc(h), 1); return m
ARMOUR = mat("armour", "#5C4D8C")      # the guards' violet, now plate
SHELL = mat("shell", "#3D4052")        # steel: torso shell, helmet, feet
FRAME = mat("frame", "#2E1C4D")        # the frame between plates
JOINT = mat("joint", "#17122E")        # ball joints, waist, neck
VISOR = mat("visor", "#0D0A1A")
STRIP = mat("strip", "#FFFFFF")        # glows the state's colour in the game
BADGE = mat("badge", "#4DF2D9")
TORCH = mat("torch", "#FFCC33")
FLOOR = mat("floor", "#3D4052")

# --- the skeleton (Blender: x forward, y left, z up), heads at the joints
S = {"L": 1, "R": -1}
BONES = [("pelvis", (0, 0, 0.90), (0, 0, 1.04), None),
         ("spine", (0, 0, 1.04), (0.005, 0, 1.22), "pelvis"),
         ("chest", (0.005, 0, 1.22), (0.01, 0, 1.47), "spine"),
         ("head", (0.01, 0, 1.47), (0.01, 0, 1.75), "chest")]
for s, sg in S.items():
    BONES += [("upperarm." + s, (0, sg * 0.27, 1.39), (0.02, sg * 0.285, 1.12), "chest"),
              ("forearm." + s, (0.02, sg * 0.285, 1.12), (0.07, sg * 0.29, 0.87), "upperarm." + s),
              ("hand." + s, (0.07, sg * 0.29, 0.87), (0.08, sg * 0.29, 0.76), "forearm." + s),
              ("thigh." + s, (0, sg * 0.1, 0.86), (0.01, sg * 0.105, 0.47), "pelvis"),
              ("shin." + s, (0.01, sg * 0.105, 0.47), (0, sg * 0.11, 0.09), "thigh." + s),
              ("foot." + s, (0, sg * 0.11, 0.09), (0.17, sg * 0.11, 0.03), "shin." + s)]
bpy.ops.object.armature_add(location=(0, 0, 0))
arm = bpy.context.active_object
bpy.ops.object.mode_set(mode='EDIT')
eb = arm.data.edit_bones
for b in list(eb): eb.remove(b)
for name, h, t, parent in BONES:
    b = eb.new(name); b.head = V(h); b.tail = V(t)
    if parent: b.parent = eb[parent]
bpy.ops.object.mode_set(mode='OBJECT')
HEAD = {n: V(h) for n, h, t, p in BONES}
TAIL = {n: V(t) for n, h, t, p in BONES}

# --- the parts, each weighted 1.0 to one bone
PARTS = []
def done(x, m, bone, smooth):
    x.data.materials.append(m)
    for y in bpy.context.selected_objects: y.select_set(False)
    bpy.context.view_layer.objects.active = x
    x.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)   # the joined mesh sits at the origin, like the rig
    if smooth: bpy.ops.object.shade_smooth()
    else: bpy.ops.object.shade_flat()
    g = x.vertex_groups.new(name=bone); g.add([v.index for v in x.data.vertices], 1.0, 'REPLACE')
    PARTS.append(x); return x
def along(p0, p1):          # centre, length and rotation putting local z from p0 to p1
    p0, p1 = V(p0), V(p1); d = p1 - p0
    return (p0 + p1) / 2, d.length, V((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
def box(c, size, m, bone):
    bpy.ops.mesh.primitive_cube_add(size=1, location=c)
    x = bpy.context.active_object; x.scale = size; return done(x, m, bone, False)
def boxseg(p0, p1, w, d, m, bone):  # a box from p0 to p1, w wide (y) and d deep (x)
    c, l, r = along(p0, p1)
    bpy.ops.mesh.primitive_cube_add(size=1, location=c, rotation=r)
    x = bpy.context.active_object; x.scale = (d, w, l); return done(x, m, bone, False)
def cyl(p0, p1, rad, m, bone, sides=8):
    c, l, r = along(p0, p1)
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=rad, depth=l, location=c, rotation=r)
    return done(bpy.context.active_object, m, bone, False)
def ball(c, rad, m, bone, seg=8, rings=5, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=rad, location=c)
    x = bpy.context.active_object; x.scale = scale; return done(x, m, bone, True)

# torso: pelvis block, belt plate, waist, a shell over the chest, the breastplate, the badge light
box((0, 0, 0.92), (0.22, 0.34, 0.15), FRAME, "pelvis")
box((0.005, 0, 0.99), (0.24, 0.30, 0.04), SHELL, "pelvis")
cyl((0, 0, 0.99), (0.005, 0, 1.12), 0.105, JOINT, "spine")
box((0.01, 0, 1.28), (0.30, 0.44, 0.34), SHELL, "chest")
box((0.02, 0, 1.19), (0.26, 0.36, 0.08), FRAME, "chest")
box((0.155, 0, 1.30), (0.03, 0.30, 0.22), ARMOUR, "chest")
box((0.175, 0.08, 1.34), (0.012, 0.06, 0.05), BADGE, "chest")
cyl((0.01, 0, 1.45), (0.01, 0, 1.53), 0.055, JOINT, "chest")
# head: helmet dome, visor shell, the strip at 1.65 m
ball((0.005, 0, 1.655), 0.135, SHELL, "head", seg=12, rings=7, scale=(1.05, 0.95, 1.0))
ball((0.075, 0, 1.64), 0.11, VISOR, "head", seg=12, rings=7, scale=(0.62, 0.95, 0.6))
box((0.138, 0, 1.65), (0.016, 0.17, 0.022), STRIP, "head")
for s, sg in S.items():
    sh, el, wr = HEAD["upperarm." + s], HEAD["forearm." + s], HEAD["hand." + s]
    hi, kn, an, toe = HEAD["thigh." + s], HEAD["shin." + s], HEAD["foot." + s], TAIL["foot." + s]
    # arm: the shoulder ball under a plate, the upper arm, the elbow, the armoured forearm, the hand
    ball(sh, 0.075, JOINT, "upperarm." + s)
    box(sh + V((0, sg * 0.02, 0.035)), (0.17, 0.13, 0.09), ARMOUR, "upperarm." + s)
    cyl(sh, el, 0.05, FRAME, "upperarm." + s)
    ball(el, 0.058, JOINT, "forearm." + s)
    boxseg(el + (wr - el) * 0.12, wr, 0.11, 0.12, ARMOUR, "forearm." + s)
    box(wr + V((0.005, 0, -0.06)), (0.09, 0.07, 0.11), FRAME, "hand." + s)
    # leg: the hip ball, the thigh, the knee under its cap, the armoured shin, the ankle, the foot
    ball(hi, 0.08, JOINT, "thigh." + s)
    cyl(hi, kn, 0.07, FRAME, "thigh." + s)
    ball(kn, 0.07, JOINT, "shin." + s)
    box(kn + V((0.06, 0, 0.0)), (0.05, 0.11, 0.11), ARMOUR, "shin." + s)
    boxseg(kn + (an - kn) * 0.14, an + (kn - an) * 0.05, 0.13, 0.15, ARMOUR, "shin." + s)
    ball(an, 0.05, JOINT, "foot." + s)
    box(V(((an.x + toe.x) / 2 + 0.01, an.y, 0.035)), (0.27, 0.12, 0.07), SHELL, "foot." + s)
# the torch in the right hand, pointing forward
w = HEAD["hand.R"] + V((0.03, 0, -0.06))
cyl(w + V((-0.04, 0, 0)), w + V((0.2, 0, 0)), 0.024, TORCH, "hand.R")

for x in bpy.data.objects: x.select_set(x in PARTS)
bpy.context.view_layer.objects.active = PARTS[0]
bpy.ops.object.join()
o = bpy.context.active_object; o.name = "guard"
am = o.modifiers.new("arm", 'ARMATURE'); am.object = arm

# --- posing: rotations about world axes, expressed in each bone's frame
def rot(bone, *turns):      # turns: (axis 'X'|'Y'|'Z', degrees), applied in order
    R = Matrix.Identity(3)
    for ax, deg in turns: R = Matrix.Rotation(math.radians(deg), 3, ax) @ R
    Mr = arm.data.bones[bone].matrix_local.to_3x3()
    pb = arm.pose.bones[bone]; pb.rotation_mode = 'QUATERNION'
    pb.rotation_quaternion = (Mr.inverted() @ R @ Mr).to_quaternion()
def clear():
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = Quaternion(); pb.location = (0, 0, 0)

def walk_pose(k):
    # forward is +x: a rotation about +y by a positive angle swings a
    # hanging limb backward; about +z it turns the left side back
    ph = 2 * math.pi * k / WALK; s = math.sin(ph); c = math.cos(ph)
    clear()
    rot("pelvis", ("Z", -7 * s), ("X", 3 * c))                 # turn with the forward leg; drop the swinging hip
    rot("spine", ("Z", 11 * s), ("X", -4 * c))                 # the torso turns against the hips, leans over the standing leg
    rot("head", ("Z", -4 * s))                                 # the head keeps looking ahead
    for side, sg in S.items():
        th = -27 * s * sg                                      # left leg forward while sin > 0
        kn = 48 * max(0.0, math.sin(ph + sg * 1.7))            # the knee folds as the leg passes under
        rot("thigh." + side, ("Y", th))
        rot("shin." + side, ("Y", kn))
        rot("foot." + side, ("Y", -0.8 * (th + kn)))           # the sole stays near level
        rot("upperarm." + side, ("Y", 20 * s * sg), ("X", sg * -4))
        rot("forearm." + side, ("Y", -18 - 14 * max(0.0, -s * sg)))
def look_pose(deg):
    clear()
    rot("head", ("Z", deg)); rot("chest", ("Z", deg * 0.2))

def evaluated():
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    m = o.evaluated_get(dg).to_mesh()
    m.calc_loop_triangles()
    pos = [V(v.co) for v in m.vertices]
    nrm = [tuple(n.vector) for n in m.corner_normals]
    tris = [(tuple(t.loops), t.material_index) for t in m.loop_triangles]
    loopv = [l.vertex_index for l in m.loops]
    o.evaluated_get(dg).to_mesh_clear()
    lo = min(p.z for p in pos)                                 # grounded: the lowest point on the floor
    pos = [(p.x, p.y, p.z - lo) for p in pos]
    return pos, nrm, tris, loopv

walk = []
for k in range(WALK):
    walk_pose(k); walk.append(evaluated())
look_pose(38); left = evaluated()
look_pose(-38); right = evaluated()
clear(); rest = evaluated()
_, _, tris, loopv = rest
for w in walk + [left, right]:
    assert len(w[0]) == len(rest[0]) and len(w[2]) == len(tris), "the topology changed between poses"

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
NPARTS = WALK + 1
assert NV * NPARTS < 65535, "too many vertices for u16 indices: %d" % NV

def game(p): return (-p[1], p[0], p[2])       # a turn, not a mirror: the winding stays CCW
def s4n(p): return [max(-32767, min(32767, int(round(c / 2.0 * 32767)))) for c in game(p)] + [0]
def b4n(n):
    g = game(n); l = math.sqrt(sum(c * c for c in g)) or 1.0
    return [max(-127, min(127, int(round(c / l * 127)))) for c in g] + [0]
def u8(c): return max(0, min(255, int(round(c * 255))))

STRIDE = 40
PAIRS = [(walk[k], walk[(k + 1) % WALK]) for k in range(WALK)] + [(left, right)]
verts = bytearray()
for a, b in PAIRS:
    for (l, mi) in first_loop:
        v = loopv[l]; c = COLS[mi]
        verts += struct.pack("<4h4h4h", *s4n(a[0][v]), *s4n(b[0][v]), *s4n(rest[0][v]))
        verts += struct.pack("<4b4b4b", *b4n(a[1][l]), *b4n(b[1][l]), *b4n(rest[1][l]))
        verts += struct.pack("<4B", u8(c[0]), u8(c[1]), u8(c[2]), 0 if MATNAMES[mi].startswith("strip") else 255)
assert len(verts) == STRIDE * NV * NPARTS
idx = bytearray()
for k in range(NPARTS):
    for t in out_tris:
        idx += struct.pack("<3H", t[0] + k * NV, t[1] + k * NV, t[2] + k * NV)
parts = [(k * NT * 3, NT * 3) for k in range(NPARTS)]
with open(os.path.join(OUT, "guard.sgm"), "wb") as fh:
    fh.write(b"SGM1" + struct.pack("<5I", STRIDE, NV * NPARTS, NT * 3 * NPARTS, 2, len(parts)))
    for p in parts: fh.write(struct.pack("<2I", *p))
    fh.write(verts); fh.write(idx)
top = max(p[2] for p in rest[0])
strip = [rest[0][loopv[l]][2] for (l, mi) in first_loop if MATNAMES[mi].startswith("strip")]
info = {"robot": "D37", "vertices_per_pose": NV, "triangles": NT, "walk_poses": WALK, "parts": NPARTS,
        "stride": STRIDE, "height": round(top, 3),
        "strip_z": [round(min(strip), 3), round(max(strip), 3)],
        "cycle": "16 poses, two steps; the game plays one cycle per 1.5 m walked; part 16 is the head's scan"}
with open(os.path.join(OUT, "guard.json"), "w") as fh: json.dump(info, fh, indent=1)
print("GUARD verts/pose", NV, "tris", NT, "height", round(top, 3), "strip", info["strip_z"],
      "bytes", os.path.getsize(os.path.join(OUT, "guard.sgm")))

# --- previews: the walk's poses side by side, and a turntable of the rest pose
if PREVIEW:
    os.makedirs(PREVIEW, exist_ok=True)
    bpy.ops.mesh.primitive_cube_add(location=(0, 0, -0.05), size=1); fl = bpy.context.active_object
    fl.scale = (8, 8, 0.1); fl.data.materials.append(FLOOR)
    scn = bpy.context.scene
    scn.render.engine = 'BLENDER_WORKBENCH'
    sh = scn.display.shading; sh.color_type = 'MATERIAL'; sh.light = 'STUDIO'; sh.show_specular_highlight = False
    scn.world = bpy.data.worlds.new("w"); scn.world.color = hexc("#0D0A1A")
    scn.render.resolution_x, scn.render.resolution_y = 180, 270
    bpy.ops.object.empty_add(location=(0.05, 0, 0.95)); tgt = bpy.context.active_object
    bpy.ops.object.camera_add(location=(0.9, -3.2, 1.3)); cam = bpy.context.active_object
    cn = cam.constraints.new("TRACK_TO"); cn.target = tgt; cn.track_axis = "TRACK_NEGATIVE_Z"; cn.up_axis = "UP_Y"
    cam.data.lens = 40; scn.camera = cam
    def shoot(path):
        # ground the pose for the picture too: move rig and mesh together
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get(); m = o.evaluated_get(dg).to_mesh()
        lo = min(v.co.z for v in m.vertices); o.evaluated_get(dg).to_mesh_clear()
        arm.location.z = -lo; o.location.z = -lo
        scn.render.filepath = path; bpy.ops.render.render(write_still=True)
        arm.location.z = 0; o.location.z = 0
    for k in range(0, WALK, 2):
        walk_pose(k); shoot("%s/robot-walk-%02d.png" % (PREVIEW, k))
    for deg, nm in ((38, "left"), (-38, "right")):
        look_pose(deg); shoot("%s/robot-look-%s.png" % (PREVIEW, nm))
    clear()
    for i, ang in enumerate((0, 90, 45, 180)):                  # front, side, three-quarter, back
        a = math.radians(ang)
        cam.location = (3.3 * math.cos(a), 3.3 * math.sin(a), 1.3)
        shoot("%s/robot-turn-%d.png" % (PREVIEW, i))
    print("PREVIEW", PREVIEW)
