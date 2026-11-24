"""2D cartoon renderer: story JSON -> MP4, CPU only (Pillow + FFmpeg).

Usage:
    python -m toonlib.render2d stories/demo.json -o out/demo_2d.mp4
    python -m toonlib.render2d stories/demo.json -o out/demo_2d.mp4 --workers 4 --quality fast

Long videos (up to hours) are rendered in parallel chunks and joined without
re-encoding, so memory use stays flat whatever the length.
"""
import argparse
import math
import os
import random
import shutil
import subprocess
import sys
import tempfile
import textwrap
import time
from multiprocessing import Pool

from PIL import Image, ImageDraw, ImageFont

from . import story as S
from . import music

BASE_W, BASE_H = 1280, 720
OUTLINE = (30, 24, 40)

_FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
]
_font_cache = {}


def font(px):
    px = max(int(px), 6)
    if px not in _font_cache:
        f = None
        for p in _FONT_CANDIDATES:
            if os.path.exists(p):
                f = ImageFont.truetype(p, px)
                break
        _font_cache[px] = f or ImageFont.load_default()
    return _font_cache[px]


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c)


class Canvas:
    """Draws in 1280x720 stage units onto a (possibly supersampled) image."""

    def __init__(self, img):
        self.img = img
        self.d = ImageDraw.Draw(img)
        self.k = img.width / BASE_W

    def p(self, x, y):
        return (x * self.k, y * self.k)

    def box(self, x0, y0, x1, y1):
        k = self.k
        return [min(x0, x1) * k, min(y0, y1) * k, max(x0, x1) * k, max(y0, y1) * k]

    def ellipse(self, cx, cy, rx, ry, fill, outline=OUTLINE, w=4):
        self.d.ellipse(self.box(cx - rx, cy - ry, cx + rx, cy + ry), fill=fill,
                       outline=outline, width=max(1, int(w * self.k)) if outline else 0)

    def rect(self, x0, y0, x1, y1, fill, outline=None, w=4, r=0):
        b = self.box(x0, y0, x1, y1)
        ww = max(1, int(w * self.k)) if outline else 0
        if r:
            self.d.rounded_rectangle(b, radius=r * self.k, fill=fill, outline=outline, width=ww)
        else:
            self.d.rectangle(b, fill=fill, outline=outline, width=ww)

    def poly(self, pts, fill, outline=None, w=4):
        self.d.polygon([self.p(*q) for q in pts], fill=fill, outline=outline,
                       width=max(1, int(w * self.k)) if outline else 0)

    def limb(self, pts, color, width, outline=OUTLINE, ow=4):
        """Thick rounded polyline with an outline (arms, legs)."""
        k = self.k
        pp = [self.p(*q) for q in pts]
        if outline:
            W = (width + ow * 2) * k
            self.d.line(pp, fill=outline, width=int(W), joint="curve")
            for q in pp:
                self.d.ellipse([q[0] - W / 2, q[1] - W / 2, q[0] + W / 2, q[1] + W / 2], fill=outline)
        W = width * k
        self.d.line(pp, fill=color, width=int(W), joint="curve")
        for q in pp:
            self.d.ellipse([q[0] - W / 2, q[1] - W / 2, q[0] + W / 2, q[1] + W / 2], fill=color)

    def arc(self, cx, cy, rx, ry, a0, a1, color=OUTLINE, w=4):
        self.d.arc(self.box(cx - rx, cy - ry, cx + rx, cy + ry), a0, a1, fill=color,
                   width=max(1, int(w * self.k)))

    def text(self, x, y, s, size, fill=OUTLINE, anchor="mm", stroke=0, stroke_fill=None):
        self.d.text(self.p(x, y), s, font=font(size * self.k), fill=fill, anchor=anchor,
                    stroke_width=int(stroke * self.k), stroke_fill=stroke_fill)


# --------------------------------------------------------------------------- backgrounds

def _gradient(img, top, bottom, y0=0, y1=None):
    y1 = img.height if y1 is None else y1
    d = ImageDraw.Draw(img)
    for y in range(y0, y1):
        f = (y - y0) / max(1, (y1 - y0 - 1))
        d.line([(0, y), (img.width, y)], fill=tuple(int(a + (b - a) * f) for a, b in zip(top, bottom)))


def _hills(c, base_y, amp, color, seed, n=5):
    rnd = random.Random(seed)
    pts = [(-20, BASE_H)]
    phase = [rnd.uniform(0, 6.28) for _ in range(3)]
    for i in range(0, 1321, 20):
        y = base_y + amp * (0.6 * math.sin(i / 210 + phase[0]) + 0.3 * math.sin(i / 97 + phase[1])
                            + 0.1 * math.sin(i / 41 + phase[2]))
        pts.append((i, y))
    pts.append((1320, BASE_H))
    c.poly(pts, color)


def _tree(c, x, y, s, leaf=(76, 175, 80)):
    c.rect(x - 9 * s, y - 70 * s, x + 9 * s, y, (121, 85, 61), OUTLINE, 3)
    for dx, dy, r in ((0, -110, 46), (-30, -85, 34), (30, -85, 34)):
        c.ellipse(x + dx * s, y + dy * s, r * s, r * s, leaf, OUTLINE, 3)
    c.ellipse(x - 12 * s, y - 125 * s, 14 * s, 10 * s, shade(leaf, 1.25), None)


def _house(c, x, y):
    c.rect(x, y - 130, x + 170, y, (240, 200, 150), OUTLINE, 4)
    c.poly([(x - 20, y - 125), (x + 85, y - 200), (x + 190, y - 125)], (200, 70, 60), OUTLINE, 4)
    c.rect(x + 65, y - 70, x + 105, y, (130, 80, 50), OUTLINE, 3)
    c.rect(x + 18, y - 105, x + 52, y - 72, (170, 220, 255), OUTLINE, 3)
    c.rect(x + 120, y - 105, x + 154, y - 72, (170, 220, 255), OUTLINE, 3)


def _cloud(c, x, y, s, col=(255, 255, 255)):
    for dx, dy, r in ((0, 0, 32), (34, -14, 38), (70, 0, 30), (35, 10, 30)):
        c.ellipse(x + dx * s, y + dy * s, r * s, r * s * 0.85, col, None)


BACKGROUNDS = {}


def bg(name):
    def deco(fn):
        BACKGROUNDS[name] = fn
        return fn
    return deco


@bg("park")
def bg_park(c, static, t):
    if static:
        _gradient(c.img, (110, 190, 255), (200, 235, 255), 0, int(c.img.height * 0.75))
        c.ellipse(1110, 110, 55, 55, (255, 221, 87), None)
        _hills(c, 430, 40, (140, 205, 120), 1)
        _hills(c, 490, 30, (102, 187, 106), 2)
        c.rect(0, 540, BASE_W, BASE_H, (124, 200, 90))
        _house(c, 820, 500)
        for x, s in ((120, 1.0), (300, 0.75), (1150, 0.9)):
            _tree(c, x, 520, s)
        rnd = random.Random(5)
        for _ in range(40):
            x, y = rnd.uniform(0, BASE_W), rnd.uniform(560, 715)
            col = rnd.choice([(255, 120, 150), (255, 230, 90), (255, 255, 255)])
            c.ellipse(x, y, 4, 4, col, None)
    else:
        for i, (y, s, sp) in enumerate(((90, 1.0, 14), (160, 0.7, 9), (60, 0.6, 6))):
            x = (i * 470 + t * sp) % (BASE_W + 300) - 200
            _cloud(c, x, y, s)


@bg("sunset")
def bg_sunset(c, static, t):
    if static:
        _gradient(c.img, (255, 120, 90), (255, 214, 130), 0, int(c.img.height * 0.75))
        c.ellipse(640, 430, 90, 90, (255, 240, 170), None)
        _hills(c, 440, 45, (170, 90, 120), 3)
        _hills(c, 500, 30, (120, 70, 110), 4)
        c.rect(0, 540, BASE_W, BASE_H, (95, 120, 70))
        for x, s in ((100, 1.0), (1180, 1.1)):
            _tree(c, x, 530, s, (70, 110, 60))
    else:
        for i, (y, s, sp) in enumerate(((110, 0.9, 10), (190, 0.6, 7))):
            x = (i * 600 + t * sp) % (BASE_W + 300) - 200
            _cloud(c, x, y, s, (255, 190, 170))


@bg("night")
def bg_night(c, static, t):
    if static:
        _gradient(c.img, (15, 20, 60), (60, 60, 120), 0, int(c.img.height * 0.75))
        c.ellipse(1080, 120, 50, 50, (250, 245, 210), None)
        c.ellipse(1100, 108, 44, 44, (35, 40, 90), None)
        _hills(c, 450, 40, (40, 50, 90), 5)
        c.rect(0, 540, BASE_W, BASE_H, (40, 70, 60))
        _house(c, 820, 500)
        c.rect(838, 395, 872, 428, (255, 220, 120), OUTLINE, 3)
        c.rect(940, 395, 974, 428, (255, 220, 120), OUTLINE, 3)
        for x, s in ((150, 1.0), (1180, 0.9)):
            _tree(c, x, 520, s, (40, 90, 70))
    else:
        rnd = random.Random(9)
        for i in range(70):
            x, y = rnd.uniform(0, BASE_W), rnd.uniform(0, 400)
            tw = 0.5 + 0.5 * math.sin(t * rnd.uniform(1, 4) + i)
            r = 1.2 + 1.8 * tw
            c.ellipse(x, y, r, r, (255, 255, 220), None)


@bg("beach")
def bg_beach(c, static, t):
    if static:
        _gradient(c.img, (90, 200, 255), (210, 245, 255), 0, int(c.img.height * 0.6))
        c.ellipse(200, 110, 55, 55, (255, 230, 90), None)
        c.rect(0, 380, BASE_W, 520, (40, 160, 220))
        c.rect(0, 520, BASE_W, BASE_H, (245, 220, 160))
        # palm tree
        c.limb([(1130, 560), (1120, 450), (1140, 330)], (150, 105, 60), 22)
        for ang in (-150, -110, -60, -20, 20):
            a = math.radians(ang)
            c.limb([(1140, 330), (1140 + 60 * math.cos(a), 330 + 45 * math.sin(a) + 10),
                    (1140 + 120 * math.cos(a), 330 + 70 * math.sin(a) + 40)], (60, 170, 80), 14, OUTLINE, 3)
    else:
        for row, y in enumerate((400, 440, 480)):
            off = (t * (30 + row * 15)) % 80
            for i in range(-1, 18):
                x = i * 80 + off - 40
                c.arc(x, y, 30, 8, 200, 340, (230, 250, 255), 3)
        x = (t * 12) % (BASE_W + 300) - 200
        _cloud(c, x, 120, 0.8)


@bg("room")
def bg_room(c, static, t):
    if static:
        c.rect(0, 0, BASE_W, 520, (250, 225, 190))
        for x in range(0, BASE_W, 80):
            c.rect(x, 0, x + 40, 520, (245, 215, 178))
        c.rect(0, 520, BASE_W, BASE_H, (170, 115, 75))
        for y in range(540, BASE_H, 40):
            c.d.line([c.p(0, y), c.p(BASE_W, y)], fill=(150, 100, 65), width=int(3 * c.k))
        c.rect(860, 120, 1120, 330, (150, 210, 255), OUTLINE, 6)
        c.d.line([c.p(990, 120), c.p(990, 330)], fill=OUTLINE, width=int(6 * c.k))
        c.d.line([c.p(860, 225), c.p(1120, 225)], fill=OUTLINE, width=int(6 * c.k))
        c.rect(100, 180, 300, 320, (255, 255, 255), OUTLINE, 5)
        c.ellipse(200, 250, 40, 40, (255, 160, 80), None)
        c.rect(80, 470, 380, 490, (190, 120, 70), OUTLINE, 4)
        c.rect(100, 490, 120, 600, (160, 100, 60), OUTLINE, 3)
        c.rect(340, 490, 360, 600, (160, 100, 60), OUTLINE, 3)
        c.ellipse(230, 450, 30, 20, (240, 90, 90), OUTLINE, 3)


@bg("space")
def bg_space(c, static, t):
    if static:
        _gradient(c.img, (10, 5, 30), (40, 20, 80))
        c.ellipse(1050, 170, 90, 90, (255, 150, 90), OUTLINE, 4)
        c.arc(1050, 170, 150, 30, 160, 380, (255, 220, 150), 6)
        c.ellipse(220, 140, 40, 40, (120, 200, 255), OUTLINE, 3)
        c.ellipse(640, 900, 700, 360, (170, 170, 190), OUTLINE, 5)
        for x, y, r in ((300, 620, 30), (800, 600, 22), (1000, 660, 40), (520, 690, 18)):
            c.ellipse(x, y, r, r * 0.4, (140, 140, 160), None)
    else:
        rnd = random.Random(3)
        for i in range(120):
            x, y = rnd.uniform(0, BASE_W), rnd.uniform(0, 560)
            tw = 0.5 + 0.5 * math.sin(t * rnd.uniform(1, 5) + i)
            c.ellipse(x, y, 1 + 1.6 * tw, 1 + 1.6 * tw, (255, 255, 255), None)


# --------------------------------------------------------------------------- characters

def depth_scale(y):
    return 0.55 + 0.45 * (y - 400) / 200


def draw_character(c, cfg, st, t, seed):
    if not st["visible"]:
        return
    s = st["scale"] * cfg["height"] * depth_scale(st["y"])
    fx = st["facing"]
    shirt, skin, hair, pants = (hex2rgb(cfg[k]) for k in ("shirt", "skin", "hair", "pants"))
    gx, gy = st["x"], st["y"]

    ph = st["walk_phase"]
    bob = abs(math.sin(ph)) * 6 if st["walking"] else math.sin(t * 2.2 + seed) * 1.5
    if st["dance"]:
        bob = abs(math.sin(st["dance_phase"])) * 14
    lift = st["jump"]
    y0 = gy - lift - bob * s

    # shadow on the ground
    sh = max(0.35, 1 - lift / 250)
    c.ellipse(gx, gy, 46 * s * sh, 10 * s * sh, (0, 0, 0, 60), None)

    def P(x, y):
        return (gx + x * s * fx, y0 + y * s)

    # legs
    for side in (-1, 1):
        sw = math.sin(ph + (0 if side > 0 else math.pi)) if st["walking"] else 0
        if st["dance"]:
            sw = 0.5 * math.sin(st["dance_phase"] + (0 if side > 0 else math.pi))
        foot_x = side * 14 + sw * 22
        foot_y = -max(0, math.cos(ph + (0 if side > 0 else math.pi))) * 10 if st["walking"] else 0
        if lift > 5:
            foot_y -= 12
        hip = P(side * 14, -72)
        knee = P(side * 14 + sw * 12, -38 + foot_y / 2)
        foot = P(foot_x, -10 + foot_y)
        c.limb([hip, knee, foot], pants, 17 * s)
        c.ellipse(foot[0] + 7 * s * fx, foot[1] + 4 * s, 17 * s, 9 * s, (60, 50, 60), OUTLINE, 3)

    # arms (back arm first)
    def arm(side):
        sh_x, sh_y = side * 33, -132
        if st["dance"]:
            a = st["dance_phase"] + (0 if side > 0 else math.pi)
            up = 0.5 + 0.5 * math.sin(a)
            elbow = (side * (50 + 10 * up), -150 - 30 * up)
            hand = (side * (58 + 6 * up), -175 - 55 * up)
        elif side > 0 and st["wave"] > 0:
            w = st["wave"]
            wig = math.sin(st.get("wave_phase", 0)) * 18
            elbow = (side * (55 + 8 * w), -132 - 35 * w)
            hand = (side * (68 + wig * w * 0.6), -132 - 95 * w)
        else:
            swing = -math.sin(ph + (0 if side > 0 else math.pi)) * 18 if st["walking"] else 0
            elbow = (side * 42 + swing * 0.5, -102)
            hand = (side * 44 + swing, -72)
        pts = [P(sh_x, sh_y), P(*elbow), P(*hand)]
        c.limb(pts[:2], shirt, 15 * s)
        c.limb(pts[1:], skin, 13 * s)
        c.ellipse(pts[2][0], pts[2][1], 10 * s, 10 * s, skin, OUTLINE, 3)

    arm(-1)
    # torso
    bx, by = P(0, -105)
    c.d.rounded_rectangle(c.box(bx - 40 * s, by - 45 * s, bx + 40 * s, by + 40 * s),
                          radius=26 * s * c.k, fill=shirt, outline=OUTLINE, width=max(1, int(4 * c.k)))
    stx, sty = P(10, -110)
    c.ellipse(stx, sty, 9 * s, 9 * s, shade(shirt, 1.3), None)
    arm(1)

    # head
    hx, hy = P(4, -190)
    c.ellipse(hx, hy, 50 * s, 48 * s, skin, OUTLINE, 4)
    # hair cap
    c.d.chord(c.box(hx - 51 * s, hy - 50 * s, hx + 51 * s, hy + 24 * s), 180, 360, fill=hair,
              outline=OUTLINE, width=max(1, int(4 * c.k)))
    tuft = [P(-10, -236), P(6, -256), P(14, -234)]
    c.poly(tuft, hair, OUTLINE, 3)

    # face (shifted toward facing side)
    look = st["look"] * 4
    ex = hx + 10 * s * fx
    ey = hy + 2 * s
    op = S.blink(t, seed)
    emo = st["emotion"]
    for side in (-1, 1):
        cx = ex + side * 17 * s
        c.ellipse(cx, ey, 11 * s, 14 * s * max(op, 0.12), (255, 255, 255), OUTLINE, 3)
        if op > 0.3:
            c.ellipse(cx + (3 + look) * s * fx, ey + 2 * s, 5.5 * s, 7 * s * op, OUTLINE, None)
            c.ellipse(cx + (5 + look) * s * fx, ey - 2 * s, 2 * s, 2 * s, (255, 255, 255), None)
        if emo == "angry":
            c.d.line([c.p(cx - 11 * s, ey - 22 * s + side * 5 * s), c.p(cx + 11 * s, ey - 22 * s - side * 5 * s)],
                     fill=OUTLINE, width=max(1, int(4 * c.k)))
    for side in (-1, 1):
        c.ellipse(ex + side * 30 * s, ey + 20 * s, 9 * s, 5 * s, (255, 150, 150), None)

    mx, my = ex, ey + 26 * s
    if st["talk"] > 0.05:
        o = st["talk"]
        c.ellipse(mx, my, 11 * s, (3 + 9 * o) * s, (150, 40, 60), OUTLINE, 3)
    elif emo == "sad":
        c.arc(mx, my + 10 * s, 12 * s, 8 * s, 200, 340, OUTLINE, 4)
    elif emo == "surprised":
        c.ellipse(mx, my, 7 * s, 9 * s, (150, 40, 60), OUTLINE, 3)
    elif emo == "angry":
        c.d.line([c.p(mx - 10 * s, my), c.p(mx + 10 * s, my)], fill=OUTLINE, width=max(1, int(4 * c.k)))
    else:
        c.d.chord(c.box(mx - 14 * s, my - 10 * s, mx + 14 * s, my + 10 * s), 0, 180, fill=(150, 40, 60),
                  outline=OUTLINE, width=max(1, int(3 * c.k)))

    return (hx, hy - 60 * s)


def draw_bubble(c, x, y, text):
    lines = textwrap.wrap(text, 26) or [""]
    fs = 26
    lh = fs * 1.25
    wmax = max(c.d.textlength(l, font=font(fs * c.k)) for l in lines) / c.k
    w, h = wmax + 40, len(lines) * lh + 26
    bx = min(max(x - w / 2, 12), BASE_W - w - 12)
    by = max(y - h - 30, 12)
    tail_x = min(max(x, bx + 25), bx + w - 25)
    c.poly([(tail_x - 14, by + h - 3), (tail_x + 14, by + h - 3), (x, min(y, by + h + 28))],
           (255, 255, 255), OUTLINE, 4)
    c.rect(bx, by, bx + w, by + h, (255, 255, 255), OUTLINE, 4, r=20)
    c.rect(tail_x - 12, by + h - 8, tail_x + 12, by + h - 1, (255, 255, 255))
    for i, l in enumerate(lines):
        c.text(bx + w / 2, by + 13 + lh * (i + 0.5), l, fs)


def draw_title(c, scene, t):
    cols = scene.get("colors", ["#ff7eb3", "#7afcff"])
    _gradient(c.img, hex2rgb(cols[0]), hex2rgb(cols[1]))
    rnd = random.Random(1)
    for i in range(25):
        x = (rnd.uniform(0, BASE_W) + t * rnd.uniform(-30, 30)) % BASE_W
        y = (rnd.uniform(0, BASE_H) - t * rnd.uniform(20, 60)) % BASE_H
        r = rnd.uniform(6, 22)
        c.ellipse(x, y, r, r, (255, 255, 255), None)
    p = S.ease(min(1, t / 0.8), "out")
    bounce = math.sin(min(1, t / 0.8) * math.pi) * 25
    size = 30 + 50 * p
    c.text(640, 320 - bounce, scene.get("text", ""), size, (255, 255, 255), stroke=6, stroke_fill=OUTLINE)
    if scene.get("subtitle") and t > 0.6:
        c.text(640, 420, scene["subtitle"], 32, (255, 255, 255), stroke=4, stroke_fill=OUTLINE)


# --------------------------------------------------------------------------- frame + video

class FrameRenderer:
    def __init__(self, story, ss):
        self.story = story
        self.W, self.H = story["resolution"]
        self.ss = ss
        self._bg_cache = {}

    def _static_bg(self, idx, scene):
        if idx not in self._bg_cache:
            if len(self._bg_cache) > 4:
                self._bg_cache.clear()
            img = Image.new("RGB", (self.W * self.ss, self.H * self.ss), (255, 255, 255))
            fn = BACKGROUNDS.get(scene["background"], bg_park)
            fn(Canvas(img), True, 0)
            self._bg_cache[idx] = img
        return self._bg_cache[idx]

    def render(self, fi):
        story = self.story
        t = fi / story["fps"]
        scene, lt, idx = S.scene_at(story, t)
        if scene.get("type") == "title":
            img = Image.new("RGB", (self.W * self.ss, self.H * self.ss))
            c = Canvas(img)
            draw_title(c, scene, lt)
        else:
            img = self._static_bg(idx, scene).copy()
            c = Canvas(img)
            fn = BACKGROUNDS.get(scene["background"], bg_park)
            fn(c, False, t)
            # shadows need alpha: draw characters on an RGBA overlay
            layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
            lc = Canvas(layer)
            names = list(scene["cast"].keys())
            states = [(n, S.character_state(scene, n, lt)) for n in names]
            states.sort(key=lambda ns: ns[1]["y"])
            bubbles = []
            for i, (n, st) in enumerate(states):
                cfg = story["characters"].get(n, dict(S.DEFAULT_CHARACTER))
                top = draw_character(lc, cfg, st, t, seed=(sum(map(ord, n)) % 997) / 997.0)
                if st["say"] and top:
                    bubbles.append((top, st["say"]))
            for (x, y), txt in bubbles:
                draw_bubble(lc, x, y, txt)
            if scene.get("caption"):
                lc.rect(0, 650, BASE_W, BASE_H, (0, 0, 0, 140))
                lc.text(640, 685, scene["caption"], 28, (255, 255, 255))
            img.paste(layer, (0, 0), layer)
        if self.ss > 1:
            img = img.resize((self.W, self.H), Image.LANCZOS)
        f = S.scene_fade(scene, lt)
        if f < 1:
            img = Image.blend(Image.new("RGB", img.size), img, max(f, 0))
        return img


def _ffmpeg_writer(path, w, h, fps, crf, preset):
    cmd = ["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{w}x{h}", "-r", str(fps), "-i", "-", "-c:v", "libx264", "-preset", preset,
           "-crf", str(crf), "-pix_fmt", "yuv420p", "-g", str(fps * 2), path]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE)


def _render_chunk(args):
    story, ss, f0, f1, path, crf, preset, wid = args
    r = FrameRenderer(story, ss)
    w, h = story["resolution"]
    proc = _ffmpeg_writer(path, w, h, story["fps"], crf, preset)
    t0 = time.time()
    for fi in range(f0, f1):
        proc.stdin.write(r.render(fi).tobytes())
        if wid == 0 and (fi - f0) % (story["fps"] * 5) == 0 and fi > f0:
            done = (fi - f0) / (f1 - f0)
            eta = (time.time() - t0) / done * (1 - done)
            print(f"  worker0 {done * 100:5.1f}%  eta ~{eta / 60:.1f} min", flush=True)
    proc.stdin.close()
    proc.wait()
    return path


def render_video(story, out, workers=None, quality="good", music_on=True):
    ss = {"fast": 1, "good": 2}[quality]
    crf, preset = (23, "veryfast") if quality == "fast" else (19, "medium")
    n = S.total_frames(story)
    workers = workers or os.cpu_count() or 2
    # keep chunks <= ~10 min so a crash loses little and progress is visible
    max_chunk = story["fps"] * 600
    nchunks = max(workers, math.ceil(n / max_chunk))
    tmp = tempfile.mkdtemp(prefix="toon2d_")
    bounds = [round(i * n / nchunks) for i in range(nchunks + 1)]
    jobs = [(story, ss, bounds[i], bounds[i + 1], os.path.join(tmp, f"seg{i:04d}.mp4"), crf, preset, i)
            for i in range(nchunks) if bounds[i + 1] > bounds[i]]
    print(f"Rendering {n} frames ({story['_duration']:.1f}s) in {len(jobs)} chunks on {workers} workers...")
    t0 = time.time()
    with Pool(workers) as pool:
        segs = pool.map(_render_chunk, jobs, chunksize=1)
    listfile = os.path.join(tmp, "list.txt")
    with open(listfile, "w") as f:
        for s_ in segs:
            f.write(f"file '{s_}'\n")
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    joined = os.path.join(tmp, "joined.mp4")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", listfile,
                    "-c", "copy", joined], check=True)
    finalize_audio(story, joined, out, tmp, music_on)
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"Done: {out}  ({time.time() - t0:.0f}s render time)")


def finalize_audio(story, video, out, tmp, music_on=True):
    """Mux the story's music file, or generated cartoon music, onto the video."""
    track = story.get("music")
    if track == "none" or not music_on:
        shutil.move(video, out)
        return
    if not track or track == "auto":
        track = os.path.join(tmp, "music.wav")
        music.generate(track, story["_duration"], seed=len(story["title"]))
        loop = []
    else:
        loop = ["-stream_loop", "-1"]
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", video, *loop, "-i", track,
                    "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
                    "-shortest", out], check=True)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Render a story JSON as a 2D cartoon video")
    ap.add_argument("story")
    ap.add_argument("-o", "--out", default="out/video_2d.mp4")
    ap.add_argument("--workers", type=int, default=None)
    ap.add_argument("--quality", choices=["fast", "good"], default="good")
    ap.add_argument("--no-music", action="store_true")
    ap.add_argument("--frame", type=float, default=None, help="render one still at this time (s) to PNG")
    a = ap.parse_args(argv)
    story = S.load_story(a.story)
    if a.frame is not None:
        img = FrameRenderer(story, 2).render(int(a.frame * story["fps"]))
        img.save(a.out)
        print("Saved", a.out)
        return
    render_video(story, a.out, a.workers, a.quality, not a.no_music)


if __name__ == "__main__":
    sys.exit(main())
