"""Runs INSIDE Blender. Builds one story scene in 3D (toon shaded, outlined) and renders a frame range.

Called by toonlib/render3d.py, one Blender process per chunk:
    blender -b --factory-startup -P toonlib/blender_scene.py -- story.json SCENE_INDEX F0 F1 out.mp4 [preview]

Character motion is not keyframed by hand: a frame-change handler evaluates the
same story timeline as the 2D renderer (toonlib.story.character_state) every frame.
"""
import math
import os
import random
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from toonlib import story as S  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:]
STORY_PATH, SCENE_IDX, F0, F1, OUT = argv[0], int(argv[1]), int(argv[2]), int(argv[3]), argv[4]
PREVIEW = len(argv) > 5 and argv[5] == "preview"
SAMPLES = int(os.environ.get("TOON_SAMPLES", "8"))

story = S.load_story(STORY_PATH)
scene_def = story["scenes"][SCENE_IDX]
FPS = story["fps"]


def hex2lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c) + (1.0,)


def stage_to_world(x, y):
    return Vector(((x - 640) / 100.0, (600 - y) / 30.0, 0))


# ------------------------------------------------------------------ materials
_mats = {}


def toon(color, name=None, emit=False):
    key = (color, emit)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(name or f"toon_{color}")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    base = hex2lin(color) if isinstance(color, str) else color
    if emit:
        e = nt.nodes.new("ShaderNodeEmission")
        e.inputs["Color"].default_value = base
        e.inputs["Strength"].default_value = 1.0
        nt.links.new(e.outputs[0], out.inputs[0])
    else:
        diff = nt.nodes.new("ShaderNodeBsdfDiffuse")
        s2r = nt.nodes.new("ShaderNodeShaderToRGB")
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.interpolation = "CONSTANT"
        els = ramp.color_ramp.elements
        els[0].position = 0.0
        els[0].color = tuple(v * 0.55 for v in base[:3]) + (1,)
        els[1].position = 0.12
        els[1].color = base
        hi = els.new(0.75)
        hi.color = tuple(min(1, v * 1.15 + 0.04) for v in base[:3]) + (1,)
        e = nt.nodes.new("ShaderNodeEmission")
        nt.links.new(diff.outputs[0], s2r.inputs[0])
        nt.links.new(s2r.outputs[0], ramp.inputs[0])
        nt.links.new(ramp.outputs[0], e.inputs[0])
        nt.links.new(e.outputs[0], out.inputs[0])
    _mats[key] = m
    return m


def outline_mat():
    if "outline" in bpy.data.materials:
        return bpy.data.materials["outline"]
    m = bpy.data.materials.new("outline")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (0.012, 0.01, 0.02, 1)
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(e.outputs[0], o.inputs[0])
    m.use_backface_culling = True
    return m


def finish(obj, color, outline=0.025, parent=None, emit=False, smooth=True):
    obj.data.materials.append(toon(color, emit=emit))
    if outline:
        obj.data.materials.append(outline_mat())
        mod = obj.modifiers.new("outline", "SOLIDIFY")
        mod.thickness = -outline
        mod.offset = 1.0
        mod.use_flip_normals = True
        mod.material_offset = 1
        mod.use_rim = False
    if smooth and hasattr(obj.data, "polygons"):
        for p in obj.data.polygons:
            p.use_smooth = True
    if parent:
        obj.parent = parent
    return obj


def sphere(name, loc, scale, color, parent=None, outline=0.025, seg=24, emit=False):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    return finish(o, color, outline / max(min(scale), 0.05) if outline else 0, parent, emit)


def cyl(name, loc, radius, depth, color, parent=None, outline=0.025, rot=(0, 0, 0), verts=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    return finish(o, color, outline, parent)


def cone(name, loc, r1, depth, color, parent=None, outline=0.03):
    bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=r1, depth=depth, location=loc)
    o = bpy.context.active_object
    o.name = name
    return finish(o, color, outline, parent)


def cube(name, loc, scale, color, parent=None, outline=0.03, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    return finish(o, color, outline / max(min(scale), 0.05) if outline else 0, parent, smooth=False)


def empty(name, loc=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    if parent:
        o.parent = parent
    return o


# ------------------------------------------------------------------ characters

def build_character(name, cfg):
    h = cfg["height"]
    root = empty(f"{name}_root")
    rig = empty(f"{name}_rig", parent=root)  # bob/jump offset
    rig.scale = (h, h, h)
    parts = {"root": root, "rig": rig}
    shirt, skin, hair, pants = cfg["shirt"], cfg["skin"], cfg["hair"], cfg["pants"]

    for side, tag in ((-1, "L"), (1, "R")):
        hip = empty(f"{name}_hip{tag}", (side * 0.17, 0, 0.78), rig)
        cyl(f"{name}_leg{tag}", (0, 0, -0.36), 0.1, 0.72, pants, hip)
        sphere(f"{name}_shoe{tag}", (0, -0.07, -0.74), (0.14, 0.2, 0.09), "#3c323c", hip)
        parts["hip" + tag] = hip

    sphere(f"{name}_body", (0, 0, 1.18), (0.42, 0.34, 0.5), shirt, rig)
    sphere(f"{name}_belly", (0, -0.27, 1.22), (0.14, 0.1, 0.14), shirt, rig, outline=0)

    for side, tag in ((-1, "L"), (1, "R")):
        sh = empty(f"{name}_sh{tag}", (side * 0.42, 0, 1.45), rig)
        cyl(f"{name}_arm{tag}", (0, 0, -0.27), 0.08, 0.55, shirt, sh)
        sphere(f"{name}_hand{tag}", (0, 0, -0.58), (0.11, 0.11, 0.11), skin, sh)
        parts["sh" + tag] = sh

    head = empty(f"{name}_head", (0, 0, 2.05), rig)
    parts["head"] = head
    sphere(f"{name}_skull", (0, 0, 0), (0.5, 0.46, 0.48), skin, head)
    sphere(f"{name}_hair", (0, 0.06, 0.16), (0.53, 0.49, 0.38), hair, head)
    cone(f"{name}_tuft", (0.05, 0, 0.55), 0.12, 0.25, hair, head)
    for side, tag in ((-1, "L"), (1, "R")):
        eye = sphere(f"{name}_eye{tag}", (side * 0.17, -0.4, 0.02), (0.11, 0.06, 0.14), "#ffffff", head, outline=0.012)
        parts["eye" + tag] = eye
        sphere(f"{name}_pupil{tag}", (side * 0.17, -0.455, 0.0), (0.06, 0.03, 0.08), "#1e1828", head, outline=0)
        sphere(f"{name}_cheek{tag}", (side * 0.3, -0.36, -0.14), (0.08, 0.03, 0.05), "#ff9a9a", head, outline=0)
    parts["mouth"] = sphere(f"{name}_mouth", (0, -0.44, -0.2), (0.13, 0.04, 0.05), "#962838", head, outline=0.01)
    return parts


def pose_character(parts, st, t, seed):
    root, rig = parts["root"], parts["rig"]
    root.hide_render = not st["visible"]
    for ch in root.children_recursive:
        ch.hide_render = not st["visible"]
    pos = stage_to_world(st["x"], st["y"])
    root.location = pos
    root.scale = (st["scale"],) * 3
    turn = 70 if st["walking"] else 25
    root.rotation_euler = (0, 0, math.radians(turn * st["facing"]) if st["facing"] else 0)

    ph = st["walk_phase"]
    bob = abs(math.sin(ph)) * 0.06 if st["walking"] else math.sin(t * 2.2 + seed) * 0.012
    if st["dance"]:
        bob = abs(math.sin(st["dance_phase"])) * 0.15
    rig.location = (0, 0, bob + st["jump"] / 100.0)

    for side, tag in ((-1, "L"), (1, "R")):
        sw = math.sin(ph + (0 if side > 0 else math.pi)) if st["walking"] else 0
        if st["dance"]:
            sw = 0.4 * math.sin(st["dance_phase"] + (0 if side > 0 else math.pi))
        tuck = 0.5 if st["jump"] > 5 else 0
        parts["hip" + tag].rotation_euler = (sw * 0.6 + tuck, 0, 0)

        sh = parts["sh" + tag]
        if st["dance"]:
            a = st["dance_phase"] + (0 if side > 0 else math.pi)
            up = 0.5 + 0.5 * math.sin(a)
            sh.rotation_euler = (0, side * -(2.2 + 0.6 * up), 0)
        elif side > 0 and st["wave"] > 0:
            w = st["wave"]
            sh.rotation_euler = (0, -(2.7 + 0.25 * math.sin(st.get("wave_phase", 0))) * w, 0)
        else:
            swing = -sw * 0.5 if st["walking"] else 0
            sh.rotation_euler = (swing, side * -0.12, 0)

    op = S.blink(t, seed)
    for tag in ("L", "R"):
        parts["eye" + tag].scale.z = 0.14 * max(op, 0.1)
    talk = st["talk"]
    m = parts["mouth"]
    emo = st["emotion"]
    if talk > 0.05:
        m.scale = (0.11, 0.04, 0.04 + 0.09 * talk)
    elif emo == "surprised":
        m.scale = (0.07, 0.04, 0.09)
    elif emo in ("sad", "angry"):
        m.scale = (0.12, 0.04, 0.02)
    else:
        m.scale = (0.14, 0.04, 0.05)
    parts["head"].rotation_euler = (0, 0, math.radians(st["look"] * -20))


# ------------------------------------------------------------------ environments

def world_color(color, strength=1.0):
    w = bpy.data.worlds.new("w")
    bpy.context.scene.world = w
    w.use_nodes = True
    bgn = w.node_tree.nodes["Background"]
    bgn.inputs[0].default_value = hex2lin(color)
    bgn.inputs[1].default_value = strength


def backdrop(top, bottom):
    """Big vertical gradient sky card behind the set (emission, unaffected by light)."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 40, 12), rotation=(math.radians(90), 0, 0))
    o = bpy.context.active_object
    o.scale = (120, 40, 1)
    m = bpy.data.materials.new("sky")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = hex2lin(bottom)
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[1].color = hex2lin(top)
    e = nt.nodes.new("ShaderNodeEmission")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Y"], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], e.inputs[0])
    nt.links.new(e.outputs[0], out.inputs[0])
    o.data.materials.append(m)


def ground(color, size=80):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, size / 2 - 12, 0))
    finish(bpy.context.active_object, color, 0, smooth=False)


def hills(color, y, seed, n=6, h=3.0):
    rnd = random.Random(seed)
    for i in range(n):
        x = -24 + i * 48 / (n - 1) + rnd.uniform(-3, 3)
        s = rnd.uniform(5, 8)
        sphere(f"hill{seed}_{i}", (x, y, -s * 0.35), (s, s * 0.5, h * rnd.uniform(0.8, 1.2)), color, outline=0)


def tree(x, y, s=1.0, leaf="#4caf50"):
    cyl("trunk", (x, y, 0.7 * s), 0.16 * s, 1.4 * s, "#79553d")
    for dx, dz, r in ((0, 2.1, 0.8), (-0.5, 1.7, 0.6), (0.5, 1.7, 0.6)):
        sphere("leaf", (x + dx * s, y, dz * s), (r * s,) * 3, leaf, seg=16)


def house(x, y):
    cube("house", (x, y, 1.1), (1.5, 1.2, 1.1), "#f0c896")
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=2.4, depth=1.4, location=(x, y, 2.9),
                                    rotation=(0, 0, math.radians(45)))
    finish(bpy.context.active_object, "#c8463c", 0.04, smooth=False)
    cube("door", (x, y - 1.21, 0.6), (0.32, 0.02, 0.6), "#824f32", outline=0)
    for dx in (-0.9, 0.9):
        cube("win", (x + dx, y - 1.21, 1.4), (0.3, 0.02, 0.28), "#aadcff", outline=0)


def cloud(name, x, y, z, s=1.0, color="#ffffff"):
    root = empty(name, (x, y, z))
    for dx, dz, r in ((0, 0, 1.0), (1.0, 0.3, 1.2), (2.0, 0, 0.9), (1.0, -0.2, 0.9)):
        sphere("puff", (dx * s, 0, dz * s), (r * s, r * s * 0.7, r * s * 0.8), color, root, outline=0, seg=12)
    return root


def sun_light(energy=3.0, color=(1, 0.97, 0.9), angle=(50, 0, 30)):
    bpy.ops.object.light_add(type="SUN", rotation=tuple(math.radians(a) for a in angle))
    l = bpy.context.active_object
    l.data.energy = energy
    l.data.color = color
    l.data.angle = math.radians(8)
    return l


def build_environment(name):
    clouds = []
    if name == "sunset":
        world_color("#ff9a70", 0.6)
        backdrop("#ff7a5a", "#ffd682")
        sphere("sun", (0, 38, 4), (5, 0.1, 5), "#fff0aa", outline=0, emit=True)
        hills("#aa5a78", 26, 3)
        hills("#784670", 18, 4, h=2.2)
        ground("#5f7846")
        tree(-7.5, 6, 1.1, "#466e3c")
        tree(7.5, 5, 1.2, "#466e3c")
        clouds = [cloud("c1", -10, 30, 11, 1.5, "#ffbeaa"), cloud("c2", 6, 30, 14, 1.2, "#ffbeaa")]
        sun_light(2.5, (1, 0.75, 0.6), (70, 0, 10))
    elif name == "night":
        world_color("#202a5a", 0.5)
        backdrop("#0f143c", "#3c3c78")
        sphere("moon", (12, 38, 16), (2.5, 0.1, 2.5), "#faf5d2", outline=0, emit=True)
        rnd = random.Random(9)
        for i in range(60):
            sphere("star", (rnd.uniform(-45, 45), 39, rnd.uniform(8, 30)), (0.12,) * 3, "#ffffdc", outline=0, seg=6, emit=True)
        hills("#28325a", 22, 5)
        ground("#28463c")
        house(6, 9)
        tree(-7, 6, 1.0, "#285a46")
        sun_light(1.2, (0.6, 0.7, 1.0), (55, 0, -30))
        bpy.ops.object.light_add(type="POINT", location=(6, 7.6, 1.4))
        bpy.context.active_object.data.energy = 300
        bpy.context.active_object.data.color = (1, 0.8, 0.4)
    elif name == "beach":
        world_color("#aee6ff", 0.8)
        backdrop("#5ac8ff", "#d2f5ff")
        sphere("sun", (-14, 38, 16), (2.5, 0.1, 2.5), "#ffe65a", outline=0, emit=True)
        bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 22, 0.02))
        sea = bpy.context.active_object
        sea.scale = (120, 26, 1)
        finish(sea, "#28a0dc", 0, smooth=False)
        bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -2, 0))
        sand = bpy.context.active_object
        sand.scale = (120, 22, 1)
        finish(sand, "#f5dca0", 0, smooth=False)
        cyl("palm", (8, 5, 2.0), 0.22, 4.0, "#96693c", rot=(0, math.radians(-8), 0))
        for i in range(6):
            a = i * math.pi / 3
            bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.35, depth=2.6,
                                            location=(8.3 + math.cos(a) * 1.1, 5 + math.sin(a) * 1.1, 3.8),
                                            rotation=(math.sin(a) * 1.9, -math.cos(a) * 1.9, 0))
            finish(bpy.context.active_object, "#3caa50", 0.03)
        clouds = [cloud("c1", -4, 30, 13, 1.3)]
        sun_light(3.2)
    elif name == "room":
        world_color("#fae1be", 0.9)
        bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 6, 5), rotation=(math.radians(90), 0, 0))
        wall = bpy.context.active_object
        wall.scale = (40, 10, 1)
        finish(wall, "#fae1be", 0, smooth=False)
        ground("#aa734b", 40)
        cube("window", (5, 5.9, 3.6), (1.6, 0.05, 1.2), "#96d2ff")
        cube("frame", (-5, 5.9, 3.4), (1.2, 0.05, 0.9), "#ffffff")
        sphere("art", (-5, 5.8, 3.4), (0.5, 0.05, 0.5), "#ffa050", outline=0)
        cube("table", (-5, 3.5, 1.4), (1.8, 0.8, 0.08), "#be7846")
        for dx in (-1.6, 1.6):
            cube("tleg", (-5 + dx, 3.5, 0.7), (0.1, 0.1, 0.7), "#a06438", outline=0.02)
        sphere("ball", (-5, 3.5, 1.8), (0.32,) * 3, "#f05a5a")
        sun_light(2.0, (1, 0.95, 0.85), (45, 0, 40))
    elif name == "space":
        world_color("#1e1440", 0.5)
        backdrop("#0a0520", "#28145a")
        rnd = random.Random(3)
        for i in range(90):
            sphere("star", (rnd.uniform(-45, 45), 39, rnd.uniform(2, 30)), (0.1,) * 3, "#ffffff", outline=0, seg=6, emit=True)
        sphere("planet", (14, 36, 18), (5, 5, 5), "#ff965a")
        sphere("planet2", (-15, 34, 20), (2, 2, 2), "#78c8ff")
        ground("#aaaabe")
        rnd = random.Random(4)
        for i in range(10):
            sphere("crater", (rnd.uniform(-12, 12), rnd.uniform(-2, 14), 0.0), (rnd.uniform(0.5, 1.4), rnd.uniform(0.5, 1.4), 0.12),
                   "#8c8ca0", outline=0)
        sun_light(3.0, (1, 0.95, 1), (40, 0, 60))
    else:  # park
        world_color("#b4dcff", 0.8)
        backdrop("#6ebeff", "#c8ebff")
        sphere("sun", (14, 38, 18), (2.5, 0.1, 2.5), "#ffdc57", outline=0, emit=True)
        hills("#8ccd78", 24, 1)
        hills("#66bb6a", 16, 2, h=2.0)
        ground("#7cc85a")
        house(6.5, 9)
        tree(-7.5, 6, 1.0)
        tree(-3.5, 10, 0.8)
        tree(11, 7, 0.9)
        rnd = random.Random(5)
        for _ in range(30):
            sphere("flower", (rnd.uniform(-10, 10), rnd.uniform(-3, 5), 0.03), (0.06, 0.06, 0.03),
                   rnd.choice(["#ff7896", "#ffe65a", "#ffffff"]), outline=0, seg=8)
        clouds = [cloud("c1", -9, 30, 13, 1.4), cloud("c2", 3, 30, 16, 1.0), cloud("c3", 13, 30, 12, 1.1)]
        sun_light(3.0)
    return clouds


# ------------------------------------------------------------------ speech bubbles (billboards)

def build_bubble(name):
    root = empty(f"{name}_bubble")
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0.02, 0), rotation=(math.radians(90), 0, 0))
    card = bpy.context.active_object
    card.parent = root
    finish(card, "#ffffff", 0, emit=True, smooth=False)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0.04, 0), rotation=(math.radians(90), 0, 0))
    border = bpy.context.active_object
    border.parent = root
    finish(border, "#1e1828", 0, emit=True, smooth=False)
    bpy.ops.object.text_add(location=(0, -0.01, 0), rotation=(math.radians(90), 0, 0))
    txt = bpy.context.active_object
    txt.parent = root
    txt.data.align_x = "CENTER"
    txt.data.align_y = "CENTER"
    txt.data.size = 0.42
    txt.data.materials.append(toon("#1e1828", emit=True))
    return {"root": root, "card": card, "border": border, "text": txt, "last": None}


def update_bubble(b, text, head_world):
    if not text:
        b["root"].hide_render = True
        for k in ("card", "border", "text"):
            b[k].hide_render = True
        return
    for k in ("root", "card", "border", "text"):
        b[k].hide_render = False
    if b["last"] != text:
        import textwrap
        lines = textwrap.wrap(text, 22) or [""]
        b["text"].data.body = "\n".join(lines)
        w = max(len(l) for l in lines) * 0.26 + 0.6
        h = len(lines) * 0.55 + 0.4
        b["card"].scale = (w, h, 1)
        b["border"].scale = (w + 0.12, h + 0.12, 1)
        b["h"] = h
        b["last"] = text
    loc = head_world + Vector((0, -0.4, 0.45 + b["h"] / 2))
    loc.x = max(-5.2, min(5.2, loc.x))
    b["root"].location = loc


# ------------------------------------------------------------------ title cards

def build_title(sd):
    cols = sd.get("colors", ["#ff7eb3", "#7afcff"])
    world_color(cols[1], 1.0)
    backdrop(cols[0], cols[1])
    sun_light(3.0)
    bpy.ops.object.text_add(location=(0, 0, 2.3), rotation=(math.radians(90), 0, 0))
    t = bpy.context.active_object
    t.data.body = sd.get("text", "")
    t.data.align_x = "CENTER"
    t.data.align_y = "CENTER"
    t.data.size = 1.6
    t.data.extrude = 0.25
    t.data.bevel_depth = 0.04
    t.data.materials.append(toon("#ffffff"))
    sub = None
    if sd.get("subtitle"):
        bpy.ops.object.text_add(location=(0, 0, 0.9), rotation=(math.radians(90), 0, 0))
        sub = bpy.context.active_object
        sub.data.body = sd["subtitle"]
        sub.data.align_x = "CENTER"
        sub.data.size = 0.7
        sub.data.extrude = 0.08
        sub.data.materials.append(toon("#1e1828"))
    rnd = random.Random(1)
    confetti = []
    for i in range(40):
        c = sphere("conf", (rnd.uniform(-9, 9), rnd.uniform(2, 8), rnd.uniform(-1, 9)), (0.18,) * 3,
                   rnd.choice(["#ff5a78", "#ffe65a", "#5ad2ff", "#8cff78", "#ffffff"]), outline=0, seg=8)
        confetti.append((c, c.location.copy(), rnd.uniform(0.6, 1.6)))
    return t, sub, confetti


# ------------------------------------------------------------------ main

def setup_render():
    sc = bpy.context.scene
    # Blender 4.2-4.4 call the engine BLENDER_EEVEE_NEXT; 4.0/4.1 and 4.5+ use BLENDER_EEVEE
    engines = sc.render.bl_rna.properties["engine"].enum_items.keys()
    sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
    sc.eevee.taa_render_samples = 4 if PREVIEW else SAMPLES
    for attr, val in (("use_soft_shadows", True), ("shadow_cube_size", "512"), ("shadow_cascade_size", "2048")):
        if hasattr(sc.eevee, attr):  # removed in EEVEE Next
            setattr(sc.eevee, attr, val)
    sc.view_settings.view_transform = "Standard"
    w, h = story["resolution"]
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 50 if PREVIEW else 100
    sc.render.fps = FPS
    sc.frame_start, sc.frame_end = F0, F1 - 1
    sc.render.filepath = OUT
    sc.render.image_settings.file_format = "FFMPEG"
    sc.render.ffmpeg.format = "MPEG4"
    sc.render.ffmpeg.codec = "H264"
    sc.render.ffmpeg.constant_rate_factor = "HIGH"
    sc.render.ffmpeg.ffmpeg_preset = "GOOD"
    sc.render.ffmpeg.audio_codec = "NONE"


def setup_camera():
    bpy.ops.object.camera_add(location=(0, -12, 2.6))
    cam = bpy.context.active_object
    cam.data.lens = 32
    target = empty("cam_target", (0, 0, 1.5))
    con = cam.constraints.new("TRACK_TO")
    con.target = target
    con.track_axis = "TRACK_NEGATIVE_Z"
    con.up_axis = "UP_Y"
    bpy.context.scene.camera = cam
    return cam, target


def main():
    for o in list(bpy.data.objects):  # drop the factory cube/light/camera
        bpy.data.objects.remove(o, do_unlink=True)
    setup_render()
    cam, target = setup_camera()
    sd = scene_def

    if sd.get("type") == "title":
        title, sub, confetti = build_title(sd)

        def handler(scn, *_):
            t = scn.frame_current / FPS
            p = S.ease(min(1, t / 0.8), "out")
            title.scale = (max(p, 0.01),) * 3
            title.rotation_euler = (math.radians(90), 0, math.sin(t * 1.5) * 0.08)
            title.location.z = 2.3 + math.sin(min(1, t / 0.8) * math.pi) * 0.6
            if sub:
                sub.scale = (min(1, max(0.01, (t - 0.5) * 2)),) * 3
            for c, base, sp in confetti:
                c.location = base + Vector((math.sin(t * sp) * 0.5, 0, -((t * sp * 1.5) % 10)))
            cam.location = (math.sin(t * 0.4) * 0.5, -12 + t * 0.2, 1.8)
    else:
        clouds = build_environment(sd["background"])
        names = list(sd["cast"].keys())
        rigs = {}
        bubbles = {}
        for n in names:
            cfg = story["characters"].get(n, dict(S.DEFAULT_CHARACTER, name=n))
            rigs[n] = build_character(n, cfg)
            bubbles[n] = build_bubble(n)
        cloud_base = [(c, c.location.copy()) for c in clouds]
        camdef = sd.get("camera", {})
        if isinstance(camdef, str):
            camdef = {"mode": camdef}

        def handler(scn, *_):
            lt = scn.frame_current / FPS
            gt = sd["_start"] + lt
            for c, base in cloud_base:
                c.location.x = (base.x + 24 + lt * 0.4) % 48 - 24
            focus = []
            for n in names:
                st = S.character_state(sd, n, lt)
                seed = (sum(map(ord, n)) % 997) / 997.0
                pose_character(rigs[n], st, gt, seed)
                head = rigs[n]["root"].location + Vector((0, 0, 2.6 * story["characters"].get(n, {}).get("height", 1.0)))
                update_bubble(bubbles[n], st["say"] if st["visible"] else None, head)
                if st["visible"]:
                    focus.append(rigs[n]["root"].location.copy())
            mode = camdef.get("mode", "auto")
            follow = camdef.get("follow")
            if follow and follow in rigs:
                fx = rigs[follow]["root"].location.x
                cam.location = (fx, -13, 3.0)
                target.location = (fx, 0, 1.6)
            elif mode == "orbit":
                a = lt * 0.15 - 0.3
                cam.location = (math.sin(a) * 17, -math.cos(a) * 17, 3.6)
                target.location = (0, 0, 1.5)
            else:  # gentle push-in, centred on the cast
                cx = sum(f.x for f in focus) / len(focus) if focus else 0
                cx = max(-3, min(3, cx * 0.5))
                dur = sd["duration"]
                cam.location = (cx, -12 + 1.5 * (lt / dur), 2.6)
                target.location = (cx, 0, 1.5)

    bpy.app.handlers.frame_change_pre.append(handler)
    bpy.context.scene.frame_set(F0)
    bpy.ops.render.render(animation=True)


main()
