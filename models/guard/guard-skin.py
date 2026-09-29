# The guard's body with its skeleton, for skinning (G1; stealth-game-design
# §7 and §10, D37).
#
# The same robot as guard.py, the same 16 walk poses: this script runs
# guard.py in the same Blender process (so its bones, parts and walk_pose are
# the ones the baked guard uses), then keys those poses on the armature and
# exports the rigged body as glTF. sigil-graphics' scripts/gltf-to-sgm.mjs
# turns the glTF into SGM1 plus the skeleton and the clip.
#
#   flatpak run --filesystem=$REPO org.blender.Blender --background --factory-startup \
#     --python-exit-code 1 --python $REPO/models/guard/guard-skin.py -- $REPO/assets/guard-skin [PREVIEW_DIR]
#
# Writes OUT/guard-skin.glb and OUT/guard-skin-rig.json (the torch and the
# visor strip in the guard's bind frame, for the game to carry through the
# hand and head bones); with PREVIEW_DIR, Workbench renders of four frames of
# the keyed walk.
#
# The clip "walk": 17 keys, poses 0..15 of guard.py's walk_pose and pose 0
# again to close the loop, 2 frames apart at 24 fps (32 frames, 1.333 s; the
# game maps metres walked onto it, one cycle per 1.5 m). Every key sets every
# bone's rotation, LINEAR, and the pelvis's location grounds the pose (its
# lowest point on the floor), as guard.py grounds each baked pose.
#
# The frame: guard.py's parts face Blender's +x with y left; the game's guard
# faces +y with x right. The armature object is turned +90 deg about z before
# export, so the turn is the skeleton's base transform, and glTF's Y-up turn
# is undone by gltf-to-sgm --z-up.
import bpy, sys, os, math, json, runpy
from mathutils import Vector as V, Matrix

ARGS = sys.argv[sys.argv.index("--") + 1:]
OUT = ARGS[0]
PREVIEW = ARGS[1] if len(ARGS) > 1 else None
os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))

# guard.py builds the robot and writes its baked mesh; send that to a scratch
# folder inside OUT, which the build then removes.
SCRATCH = os.path.join(OUT, "baked-scratch")
saved = sys.argv
sys.argv = [saved[0], "--", SCRATCH]
g = runpy.run_path(os.path.join(HERE, "guard.py"), run_name="guard")
sys.argv = saved
arm, o, walk_pose, clear, WALK, BONES, HEAD = g["arm"], g["o"], g["walk_pose"], g["clear"], g["WALK"], g["BONES"], g["HEAD"]
for f in os.listdir(SCRATCH): os.remove(os.path.join(SCRATCH, f))
os.rmdir(SCRATCH)

# glTF carries the Principled BSDF's base colour, not the viewport colour
# guard.py sets; copy it across. The visor strip's alpha is 0 (the game
# lights it in the state's colour), as in guard.py's baked mesh.
for m in o.data.materials:
    if m.node_tree is None: m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    c = m.diffuse_color
    bsdf.inputs["Base Color"].default_value = (c[0], c[1], c[2], 1.0)
    bsdf.inputs["Alpha"].default_value = 0.0 if m.name.startswith("strip") else 1.0

o.parent = arm              # the exporter wants the armature as the skinned mesh's parent

def lowest():
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    m = o.evaluated_get(dg).to_mesh()
    lo = min((o.matrix_world @ v.co).z for v in m.vertices)
    o.evaluated_get(dg).to_mesh_clear()
    return lo

scn = bpy.context.scene
scn.render.fps = 24
STEP = 2
pel = arm.pose.bones["pelvis"]
Mp = arm.data.bones["pelvis"].matrix_local.to_3x3()
arm.animation_data_create()
act = bpy.data.actions.new("walk")
arm.animation_data.action = act
lows = []
for k in range(WALK + 1):
    walk_pose(k % WALK)
    pel.location = (0, 0, 0)
    lo = lowest()
    lows.append(lo)
    pel.location = Mp.inverted() @ V((0, 0, -lo))     # a world lift, in the pelvis bone's frame
    f = k * STEP
    for pb in arm.pose.bones:
        pb.keyframe_insert("rotation_quaternion", frame=f)
    pel.keyframe_insert("location", frame=f)
    assert abs(lowest()) < 1e-4, "pose %d is not grounded: lowest %f" % (k, lowest())
def curves(a):
    if hasattr(a, "fcurves") and len(a.fcurves): return list(a.fcurves)
    out = []                                          # Blender 4.4+ layered actions
    for layer in a.layers:
        for strip in layer.strips:
            for bag in strip.channelbags: out += list(bag.fcurves)
    return out
fcs = curves(act)
assert fcs, "no keys were made"
for fc in fcs:
    for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
scn.frame_start, scn.frame_end = 0, WALK * STEP
clear(); pel.location = (0, 0, 0)

# the torch (guard.py: a cylinder along +x in hand.R, from w - 0.04 to w + 0.2)
# and the visor strip's centre, in the game's frame at the bind pose
def game(p): return [-p[1], p[0], p[2]]
w = HEAD["hand.R"] + V((0.03, 0, -0.06))
tip = w + V((0.2, 0, 0))
strip = V((0.138 + 0.008, 0, 1.65))
rig = {"torch_tip": game(tip), "torch_dir": game(V((1, 0, 0))), "torch_bone": "hand.R",
       "eye": game(strip), "eye_dir": game(V((1, 0, 0))), "eye_bone": "head",
       "walk_keys": WALK + 1, "frames_per_key": STEP, "fps": scn.render.fps,
       "pelvis_lift": [round(-x, 4) for x in lows]}
with open(os.path.join(OUT, "guard-skin-rig.json"), "w") as fh: json.dump(rig, fh, indent=1)

arm.rotation_euler = (0, 0, math.pi / 2)    # face +y, the game's forward
bpy.context.view_layer.update()
for x in bpy.data.objects: x.select_set(x in (arm, o))
bpy.context.view_layer.objects.active = arm
path = os.path.join(OUT, "guard-skin.glb")
bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_skins=True,
                          export_animations=True, export_yup=True, export_force_sampling=False,
                          export_apply=False, export_materials='EXPORT')
assert os.path.getsize(path) > 1000, "the export is empty"
print("GUARD-SKIN", path, os.path.getsize(path), "bytes;", len(arm.pose.bones), "bones;", WALK + 1, "keys; lift",
      "%.4f..%.4f" % (min(rig["pelvis_lift"]), max(rig["pelvis_lift"])))

if PREVIEW:
    os.makedirs(PREVIEW, exist_ok=True)
    arm.rotation_euler = (0, 0, 0)
    bpy.ops.mesh.primitive_cube_add(location=(0, 0, -0.05), size=1); fl = bpy.context.active_object
    fl.scale = (8, 8, 0.1)
    sh = scn.display.shading; scn.render.engine = 'BLENDER_WORKBENCH'
    sh.color_type = 'MATERIAL'; sh.light = 'STUDIO'
    scn.render.resolution_x, scn.render.resolution_y = 180, 270
    bpy.ops.object.empty_add(location=(0.05, 0, 0.95)); tgt = bpy.context.active_object
    bpy.ops.object.camera_add(location=(0.9, -3.2, 1.3)); cam = bpy.context.active_object
    cn = cam.constraints.new("TRACK_TO"); cn.target = tgt; cn.track_axis = "TRACK_NEGATIVE_Z"; cn.up_axis = "UP_Y"
    cam.data.lens = 40; scn.camera = cam
    for f in (0, 8, 16, 24):
        scn.frame_set(f)
        scn.render.filepath = os.path.join(PREVIEW, "skin-walk-f%02d.png" % f)
        bpy.ops.render.render(write_still=True)
    print("PREVIEW", PREVIEW)
