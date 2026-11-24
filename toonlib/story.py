"""Story file loading and timeline evaluation, shared by the 2D and 3D renderers.

A story is a JSON file with a list of scenes. Each scene has a duration, a
background, a cast (who is on screen and where they start) and a list of
timed actions. The same story can be rendered as a 2D cartoon (toonlib.render2d)
or a 3D cartoon (toonlib/render3d.py inside Blender).

Pure Python, no dependencies: Blender's bundled Python imports it too.
"""
import json
import math

DEFAULT_CHARACTER = {
    "shirt": "#3fa7f5",
    "skin": "#ffd2a6",
    "hair": "#3b2414",
    "pants": "#2f3e66",
    "height": 1.0,
}


def load_story(path):
    with open(path, encoding="utf-8") as f:
        story = json.load(f)
    return normalize(story)


def normalize(story):
    story.setdefault("title", "Untitled")
    story.setdefault("fps", 24)
    story.setdefault("resolution", [1280, 720])
    chars = story.setdefault("characters", {})
    for name, c in chars.items():
        for k, v in DEFAULT_CHARACTER.items():
            c.setdefault(k, v)
        c.setdefault("name", name)
    expanded = []
    for scene in story.get("scenes", []):
        repeat = int(scene.get("repeat", 1))
        for _ in range(max(repeat, 1)):
            expanded.append(scene)
    story["scenes"] = expanded
    t = 0.0
    for scene in story["scenes"]:
        scene.setdefault("background", "park")
        scene.setdefault("cast", {})
        scene.setdefault("actions", [])
        scene.setdefault("fade", 0.4)
        scene["_start"] = t
        t += float(scene["duration"])
    story["_duration"] = t
    return story


def total_frames(story):
    return int(round(story["_duration"] * story["fps"]))


def scene_at(story, t):
    """Return (scene, local_time, scene_index) for a global time t."""
    scenes = story["scenes"]
    for i, s in enumerate(scenes):
        if t < s["_start"] + s["duration"] or i == len(scenes) - 1:
            return s, t - s["_start"], i
    raise ValueError("story has no scenes")


def ease(x, kind="inout"):
    x = min(max(x, 0.0), 1.0)
    if kind == "linear":
        return x
    if kind == "in":
        return x * x
    if kind == "out":
        return 1 - (1 - x) * (1 - x)
    return x * x * (3 - 2 * x)


def _active(a, t):
    return a["start"] <= t < a["end"]


def character_state(scene, name, t):
    """Evaluate everything a renderer needs to draw one character at local time t.

    Positions are in a stage coordinate system: x in [0, 1280] left to right,
    y in [0, 720] top to bottom, y = feet position. The 3D renderer maps x to
    world X and y (depth) to world Y.
    """
    cast = scene["cast"][name]
    x, y = cast.get("at", [640, 600])
    facing = cast.get("facing", 1)
    st = {
        "x": float(x), "y": float(y), "facing": facing,
        "walk_phase": 0.0, "walking": False, "speed": 0.0,
        "jump": 0.0, "wave": 0.0, "dance": 0.0, "talk": 0.0,
        "say": None, "look": cast.get("look", 0.0),
        "emotion": cast.get("emotion", "happy"),
        "visible": True, "scale": float(cast.get("scale", 1.0)),
    }
    acts = [a for a in scene["actions"] if a.get("char") == name]
    acts.sort(key=lambda a: a["start"])
    for a in acts:
        kind = a["type"]
        if kind == "move":
            if t < a["start"]:
                continue
            fx, fy = a.get("from", [st["x"], st["y"]])
            tx, ty = a["to"]
            dur = max(a["end"] - a["start"], 1e-6)
            p = ease((t - a["start"]) / dur, a.get("ease", "inout" if a.get("style") == "slide" else "linear"))
            st["x"] = fx + (tx - fx) * p
            st["y"] = fy + (ty - fy) * p
            if tx != fx:
                st["facing"] = 1 if tx > fx else -1
            if _active(a, t) and a.get("style", "walk") != "slide":
                st["walking"] = True
                dist = math.hypot(tx - fx, ty - fy)
                st["speed"] = dist / dur
                stride = 70.0 if a.get("style") != "run" else 110.0
                st["walk_phase"] = ((t - a["start"]) * st["speed"] / stride) * math.pi * 2
        elif kind == "face":
            if t >= a["start"]:
                st["facing"] = a.get("dir", 1)
        elif kind == "emotion":
            if t >= a["start"] and t < a.get("end", 1e9):
                st["emotion"] = a.get("value", "happy")
        elif kind == "hide":
            if a["start"] <= t < a.get("end", 1e9):
                st["visible"] = False
        elif _active(a, t):
            local = t - a["start"]
            dur = a["end"] - a["start"]
            if kind == "jump":
                n = max(int(a.get("count", 1)), 1)
                seg = dur / n
                p = (local % seg) / seg
                st["jump"] = math.sin(p * math.pi) * a.get("height", 120)
            elif kind == "wave":
                st["wave"] = min(1.0, local * 4, (dur - local) * 4)
                st["wave_phase"] = local * 9
            elif kind == "dance":
                st["dance"] = 1.0
                st["dance_phase"] = local * a.get("tempo", 2.0) * math.pi * 2
            elif kind == "say":
                st["say"] = a["text"]
                st["talk"] = abs(math.sin(local * 14)) if local < dur - 0.3 else 0.0
            elif kind == "look":
                st["look"] = a.get("dir", 0.0)
    return st


def blink(t, seed=0.0):
    """1.0 = eyes open, 0.0 = closed. Blinks roughly every 3 s."""
    period = 3.1 + (seed % 1.0)
    p = (t + seed * 1.7) % period
    if p < 0.12:
        return abs(p - 0.06) / 0.06
    return 1.0


def scene_fade(scene, local_t):
    """Brightness multiplier for fade-in/fade-out at scene edges."""
    f = scene.get("fade", 0.4)
    if f <= 0:
        return 1.0
    return min(1.0, local_t / f, (scene["duration"] - local_t) / f)
