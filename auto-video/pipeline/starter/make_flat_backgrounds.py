# Flat 2D explainer backgrounds (vector look): drawn at 4K, saved at 1920x1080.
import json, os, sys, math, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter
OUT = sys.argv[1]
W, H = 3840, 2160
INK = (43, 43, 58, 255)
FONT = '/home/user/2D-3D_ContentLib/auto-video/app/fonts/Poppins-Bold.ttf'

def hexc(c, a=255):
    c = c.lstrip('#'); return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), a)

class Pic:
    def __init__(s, bg='#ffffff'):
        s.im = Image.new('RGBA', (W, H), hexc(bg)); s.d = ImageDraw.Draw(s.im)
    def X(s, x): return int(round(x * W))
    def Y(s, y): return int(round(y * H))
    def rect(s, x0, y0, x1, y1, fill, r=0, ol=True, ow=7):
        box = [s.X(x0), s.Y(y0), s.X(x1), s.Y(y1)]
        s.d.rounded_rectangle(box, radius=int(r * H), fill=hexc(fill) if isinstance(fill, str) else fill, outline=INK if ol else None, width=ow if ol else 0)
    def poly(s, pts, fill, ol=True, ow=7):
        p = [(s.X(x), s.Y(y)) for x, y in pts]; s.d.polygon(p, fill=hexc(fill) if isinstance(fill, str) else fill)
        if ol: s.d.line(p + [p[0]], fill=INK, width=ow, joint='curve')
    def circ(s, cx, cy, r, fill, ol=True, ow=7):
        rr = r * H; s.d.ellipse([s.X(cx) - rr, s.Y(cy) - rr, s.X(cx) + rr, s.Y(cy) + rr], fill=hexc(fill) if isinstance(fill, str) else fill, outline=INK if ol else None, width=ow if ol else 0)
    def ell(s, x0, y0, x1, y1, fill, ol=True, ow=7):
        s.d.ellipse([s.X(x0), s.Y(y0), s.X(x1), s.Y(y1)], fill=hexc(fill) if isinstance(fill, str) else fill, outline=INK if ol else None, width=ow if ol else 0)
    def line(s, pts, color='#2b2b3a', w=7):
        s.d.line([(s.X(x), s.Y(y)) for x, y in pts], fill=hexc(color) if isinstance(color, str) else color, width=w, joint='curve')
    def text(s, x, y, t, size, color):
        f = ImageFont.truetype(FONT, int(size * H)); bb = s.d.textbbox((0, 0), t, font=f); s.d.text((s.X(x) - (bb[2] - bb[0]) / 2, s.Y(y) - (bb[3] - bb[1]) / 2 - bb[1]), t, font=f, fill=hexc(color))
    def glow(s, cx, cy, r, color, a=70):
        lay = Image.new('RGBA', (W, H), None); d = ImageDraw.Draw(lay); rr = r * H
        d.ellipse([s.X(cx) - rr, s.Y(cy) - rr, s.X(cx) + rr, s.Y(cy) + rr], fill=hexc(color, a)); lay = lay.filter(ImageFilter.GaussianBlur(rr * 0.35)); s.im.alpha_composite(lay); s.d = ImageDraw.Draw(s.im)
    def shade(s, pts, a=40):  # soft flat shadow
        lay = Image.new('RGBA', (W, H), None); d = ImageDraw.Draw(lay); d.polygon([(s.X(x), s.Y(y)) for x, y in pts], fill=(30, 20, 40, a)); s.im.alpha_composite(lay); s.d = ImageDraw.Draw(s.im)
    def cloud(s, cx, cy, k=1.0):
        for dx, dy, r in [(-0.05, 0.01, 0.045), (0, -0.015, 0.06), (0.055, 0.005, 0.045), (0.02, 0.02, 0.045), (-0.025, 0.025, 0.04)]:
            s.circ(cx + dx * k, cy + dy * k, r * k, '#ffffff', ol=False)
    def save(s, id_, meta, holes=None):
        os.makedirs(os.path.join(OUT, id_), exist_ok=True)
        im = s.im
        if holes:
            a = Image.new('L', (W, H), 255); d = ImageDraw.Draw(a)
            for (x0, y0, x1, y1, r) in holes: d.rounded_rectangle([s.X(x0), s.Y(y0), s.X(x1), s.Y(y1)], radius=int(r * H), fill=0)
            # keep the drawn bars / frames inside the holes opaque
            im = im.copy(); base = im.split()[3]
            mask = Image.composite(Image.new('L', (W, H), 255), a, s.keep) if hasattr(s, 'keep') else a
            im.putalpha(mask)
        pass  # keep 4K so close-up zooms stay sharp
        fn = 'image.png'; im.save(os.path.join(OUT, id_, fn)) if holes else im.convert('RGB').save(os.path.join(OUT, id_, 'image.jpg'), quality=93)
        meta = {'id': id_, 'file': f'backgrounds/{id_}/{fn if holes else "image.jpg"}', **meta}
        json.dump(meta, open(os.path.join(OUT, id_, 'background.json'), 'w'), indent=2)

def plant(p, x, y, k=1.0, pot='#c96f4a'):
    for i, (dx, dy, r, c) in enumerate([(-0.02, -0.07, 0.04, '#3f9b5a'), (0.02, -0.08, 0.042, '#4fb06a'), (0, -0.115, 0.04, '#3f9b5a'), (-0.008, -0.06, 0.03, '#5cc27a')]):
        p.circ(x + dx * k, y + dy * k, r * k, c)
    p.poly([(x - 0.03 * k, y - 0.05 * k), (x + 0.03 * k, y - 0.05 * k), (x + 0.022 * k, y), (x - 0.022 * k, y)], pot)

def tree(p, x, y, k=1.0):
    p.rect(x - 0.008 * k, y - 0.25 * k, x + 0.008 * k, y, '#8a5a3c')
    for dx, dy, r, c in [(-0.045, -0.3, 0.08, '#3f9b5a'), (0.04, -0.31, 0.085, '#4aa865'), (0, -0.37, 0.09, '#4fb06a'), (-0.01, -0.28, 0.06, '#5cc27a')]:
        p.circ(x + dx * k, y + dy * k, r * k, c)

def lamp_post(p, x, y, k=1.0):
    p.rect(x - 0.005 * k, y - 0.5 * k, x + 0.005 * k, y, '#3b4a5a'); p.rect(x - 0.012 * k, y - 0.02 * k, x + 0.012 * k, y, '#3b4a5a')
    p.poly([(x - 0.02 * k, y - 0.5 * k), (x + 0.02 * k, y - 0.5 * k), (x + 0.012 * k, y - 0.54 * k), (x - 0.012 * k, y - 0.54 * k)], '#3b4a5a'); p.circ(x, y - 0.49 * k, 0.012 * k, '#ffe27a')

def cup_icon(p, x, y, k, col='#f6e7d3', ink=True):
    p.rect(x - 0.025 * k, y - 0.03 * k, x + 0.025 * k, y + 0.03 * k, col, r=0.008 * k, ol=ink)
    p.d.arc([p.X(x + 0.017 * k), p.Y(y - 0.015 * k), p.X(x + 0.045 * k), p.Y(y + 0.015 * k)], -90, 90, fill=hexc(col), width=int(0.008 * k * H))
    for i in range(3): p.line([(x - 0.012 * k + i * 0.012 * k, y - 0.04 * k), (x - 0.006 * k + i * 0.012 * k, y - 0.06 * k), (x - 0.012 * k + i * 0.012 * k, y - 0.08 * k)], col, int(0.005 * k * H))

def buildings(p, y_base, cols, seed=3, hmin=0.18, hmax=0.42):
    rnd = random.Random(seed); x = -0.02
    while x < 1.02:
        w = rnd.uniform(0.08, 0.15); h = rnd.uniform(hmin, hmax); c = cols[rnd.randrange(len(cols))]
        p.rect(x, y_base - h, x + w, y_base, c, ol=False)
        for wy in [y_base - h + 0.04 + i * 0.07 for i in range(int((h - 0.06) / 0.07))]:
            for wx in [x + 0.015 + j * 0.035 for j in range(int((w - 0.02) / 0.035))]:
                p.rect(wx, wy, wx + 0.018, wy + 0.035, (255, 255, 255, 110), ol=False)
        x += w + rnd.uniform(0.0, 0.015)

# ---------- 1. cafe outside ----------
def cafe_out():
    p = Pic('#bfe6f5'); p.cloud(0.14, 0.12, 1.2); p.cloud(0.47, 0.08, 0.9); p.cloud(0.9, 0.14, 1.1)
    buildings(p, 0.72, ['#f2d0a9', '#e8b4a0', '#c9d8e8', '#d7c4e8', '#f5e0b8'], seed=4)
    # cafe facade
    p.rect(0.36, 0.17, 0.97, 0.76, '#8a5a44'); p.rect(0.36, 0.17, 0.97, 0.21, '#6e4535')
    for i, yy in enumerate([0.25 + q * 0.045 for q in range(11)]):  # brick rows
        for xx in [0.37 + ((i % 2) * 0.02) + j * 0.04 for j in range(15)]:
            if xx < 0.955: p.rect(xx, yy, xx + 0.034, yy + 0.035, (150, 98, 74, 255), ol=False)
    p.rect(0.47, 0.205, 0.86, 0.3, '#2f5d50', r=0.02); p.text(0.69, 0.252, 'CAFE', 0.06, '#f6e7d3'); cup_icon(p, 0.53, 0.255, 0.9)
    # striped awning
    n = 14; x0, x1 = 0.37, 0.96
    for i in range(n):
        a, b2 = x0 + (x1 - x0) * i / n, x0 + (x1 - x0) * (i + 1) / n; c = '#d9534f' if i % 2 == 0 else '#fbf3e4'
        p.poly([(a, 0.32), (b2, 0.32), (b2 + 0.004, 0.39), (a + 0.004, 0.39)], c, ol=False)
        p.d.pieslice([p.X(a + 0.004), p.Y(0.37), p.X(b2 + 0.004), p.Y(0.41)], 0, 180, fill=hexc(c))
    p.line([(x0, 0.32), (x1, 0.32)], w=8)
    # window with the inside
    p.rect(0.4, 0.43, 0.7, 0.72, '#cfe9f2'); p.rect(0.4, 0.62, 0.7, 0.72, '#a9764f', ol=False); p.line([(0.4, 0.62), (0.7, 0.62)], w=6)
    for lx in [0.47, 0.55, 0.63]: p.line([(lx, 0.43), (lx, 0.48)], w=5); p.d.pieslice([p.X(lx - 0.02), p.Y(0.47), p.X(lx + 0.02), p.Y(0.51)], 180, 360, fill=hexc('#2f5d50')); p.glow(lx, 0.5, 0.04, '#ffe27a', 120)
    for cx in [0.45, 0.6]: p.circ(cx, 0.585, 0.025, '#5b4636', ol=False); p.rect(cx - 0.02, 0.6, cx + 0.02, 0.63, '#5b4636', ol=False)
    p.poly([(0.43, 0.43), (0.47, 0.43), (0.42, 0.72), (0.4, 0.72), (0.4, 0.6)], (255, 255, 255, 90), ol=False); p.rect(0.4, 0.43, 0.7, 0.72, None); p.line([(0.55, 0.43), (0.55, 0.62)], w=6)
    p.rect(0.39, 0.72, 0.71, 0.745, '#6e4535')
    # door
    p.rect(0.75, 0.41, 0.89, 0.76, '#2f5d50'); p.rect(0.77, 0.44, 0.87, 0.6, '#cfe9f2'); p.circ(0.865, 0.62, 0.009, '#e8b923'); p.line([(0.79, 0.445), (0.81, 0.445)], '#ffffff', 5)
    p.line([(0.805, 0.44), (0.79, 0.47), (0.835, 0.47), (0.82, 0.44)], w=4); p.rect(0.785, 0.47, 0.85, 0.51, '#fbf3e4', r=0.008); p.text(0.8175, 0.49, 'OPEN', 0.022, '#2f5d50')
    plant(p, 0.73, 0.76, 1.1); plant(p, 0.915, 0.76, 1.1)
    # chalk stand
    p.poly([(0.315, 0.62), (0.355, 0.62), (0.365, 0.77), (0.305, 0.77)], '#8a5a44'); p.rect(0.31, 0.635, 0.36, 0.735, '#2b3a35'); cup_icon(p, 0.335, 0.685, 0.6, '#ffffff', False)
    # pavement
    p.rect(-0.01, 0.76, 1.01, 1.01, '#eadfcd', ol=False); p.line([(0, 0.76), (1, 0.76)], w=8)
    for i in range(14): p.line([(i * 0.08 + 0.02, 0.775), (i * 0.08 - 0.03, 1.0)], (205, 190, 168, 255), 5)
    for yy in [0.82, 0.9]: p.line([(0, yy), (1, yy)], (205, 190, 168, 255), 5)
    tree(p, 0.1, 0.76, 1.1); lamp_post(p, 0.25, 0.77, 1.0)
    p.rect(0.13, 0.7, 0.23, 0.72, '#b98a4c'); p.rect(0.135, 0.72, 0.145, 0.765, '#3b4a5a'); p.rect(0.215, 0.72, 0.225, 0.765, '#3b4a5a'); p.rect(0.13, 0.655, 0.23, 0.675, '#b98a4c')
    p.save('bg_flat_cafe_out', {'name': 'Flat: cafe outside', 'place': 'cafe', 'time': 'day', 'indoor': False, 'tags': ['flat', 'cafe', 'coffee', 'street'], 'groundNear': 0.95, 'groundFar': 0.8, 'heightNear': 0.6, 'seats': [{'type': 'door', 'x': 0.82, 'y': 0.8}]})

# ---------- 2. cafe inside ----------
def cafe_in():
    p = Pic('#f6e7d3')
    # window with street view
    p.rect(0.5, 0.12, 0.9, 0.5, '#bfe6f5'); buildings(p, 0.5, ['#f2d0a9', '#e8b4a0', '#c9d8e8'], seed=9, hmin=0.12, hmax=0.25)
    p.rect(0.5, 0.12, 0.9, 0.5, None, ow=12); p.line([(0.7, 0.12), (0.7, 0.5)], '#ffffff', 16); p.line([(0.5, 0.31), (0.9, 0.31)], '#ffffff', 16); p.rect(0.5, 0.12, 0.9, 0.5, None, ow=8)
    p.poly([(0.53, 0.12), (0.58, 0.12), (0.52, 0.5), (0.5, 0.5), (0.5, 0.35)], (255, 255, 255, 80), ol=False)
    p.rect(0.49, 0.5, 0.91, 0.525, '#ffffff')
    # wainscot + floor
    p.rect(-0.01, 0.585, 1.01, 0.8, '#9b6b4b', ol=False); p.line([(0, 0.585), (1, 0.585)], w=8)
    for i in range(30): p.line([(i * 0.035, 0.6), (i * 0.035, 0.8)], (128, 86, 60, 255), 5)
    p.rect(-0.01, 0.57, 1.01, 0.59, '#7a5038')
    p.rect(-0.01, 0.8, 1.01, 1.01, '#d4a676', ol=False); p.line([(0, 0.8), (1, 0.8)], w=8)
    for i in range(7):
        yy = 0.8 + i * 0.035; p.line([(0, yy), (1, yy)], (186, 140, 98, 255), 5)
        for j in range(12): xx = j * 0.09 + (i % 2) * 0.045; p.line([(xx, yy), (xx, yy + 0.035)], (186, 140, 98, 255), 4)
    # shelves + menu board on the left wall
    p.rect(0.03, 0.08, 0.3, 0.3, '#2b3a35', r=0.01); p.rect(0.03, 0.08, 0.3, 0.3, None, r=0.01, ow=14)
    for i, yy in enumerate([0.13, 0.18, 0.23, 0.27]): p.line([(0.1, yy), (0.22 - (i % 2) * 0.04, yy)], '#ffffff', 6); p.circ(0.255, yy, 0.006, '#ffffff', ol=False)
    cup_icon(p, 0.065, 0.13, 0.55, '#ffffff', False)
    for yy in [0.38, 0.48]:
        p.rect(0.02, yy, 0.32, yy + 0.015, '#7a5038')
        for j in range(6):
            cx = 0.045 + j * 0.048; c = ['#d9534f', '#f6c445', '#5aa5c9', '#ffffff', '#3f9b5a', '#e67ab4'][j]
            if j % 3 == 2: p.rect(cx - 0.012, yy - 0.06, cx + 0.012, yy, '#cfe9f2'); p.rect(cx - 0.012, yy - 0.025, cx + 0.012, yy, '#a9764f', ol=False)
            else: p.rect(cx - 0.014, yy - 0.04, cx + 0.014, yy, c, r=0.006)
    # pendant lamps
    for lx in [0.38, 0.62, 0.84]:
        p.line([(lx, 0), (lx, 0.1)], w=5); p.d.pieslice([p.X(lx - 0.035), p.Y(0.085), p.X(lx + 0.035), p.Y(0.155)], 180, 360, fill=hexc('#2f5d50'), outline=INK, width=6)
        p.glow(lx, 0.14, 0.09, '#ffe27a', 90); p.circ(lx, 0.122, 0.012, '#fff3b0', ol=False)
    # wall frames
    p.rect(0.36, 0.22, 0.45, 0.36, '#ffffff'); p.circ(0.405, 0.29, 0.035, '#f6c445', ol=False); p.poly([(0.365, 0.355), (0.4, 0.3), (0.445, 0.355)], '#3f9b5a', ol=False)
    plant(p, 0.95, 0.8, 1.3); plant(p, 0.46, 0.585, 0.8)
    # counter (left, the waiter stands behind it)
    p.rect(0.01, 0.53, 0.35, 0.56, '#c99a6e'); p.rect(0.02, 0.56, 0.34, 0.8, '#5b3a2a')
    for i in range(6): p.rect(0.035 + i * 0.051, 0.58, 0.075 + i * 0.051, 0.78, '#6e4535', r=0.006, ol=False)
    p.rect(0.04, 0.43, 0.12, 0.53, '#b8c0c8'); p.rect(0.055, 0.45, 0.105, 0.49, '#2b2b3a'); p.rect(0.07, 0.49, 0.09, 0.51, '#2b2b3a'); p.circ(0.115, 0.44, 0.008, '#d9534f')
    for i in range(3): p.rect(0.145 + i * 0.022, 0.49 - i * 0.012, 0.162 + i * 0.022, 0.53, '#ffffff', r=0.004)
    p.d.pieslice([p.X(0.24), p.Y(0.44), p.X(0.32), p.Y(0.56)], 180, 360, fill=hexc('#cfe9f2', 200), outline=INK, width=6); p.rect(0.255, 0.48, 0.305, 0.5, '#e67ab4', r=0.006); p.rect(0.255, 0.5, 0.305, 0.53, '#f6e7d3', r=0.004)
    # round table + two chairs (people sit on them)
    p.shade([(0.6, 0.875), (0.76, 0.875), (0.74, 0.89), (0.62, 0.89)], 45)
    p.rect(0.675, 0.685, 0.685, 0.87, '#3b3b48'); p.ell(0.65, 0.86, 0.71, 0.88, '#3b3b48')
    p.rect(0.6, 0.67, 0.76, 0.69, '#e9d3b6', r=0.008)
    for cx, back in [(0.565, -1), (0.795, 1)]:
        bx = cx + back * 0.038
        p.rect(bx - 0.007, 0.57, bx + 0.007, 0.87, '#c0583f', r=0.004); p.rect(cx - 0.042, 0.755, cx + 0.042, 0.775, '#c0583f', r=0.006)
        p.rect(cx - 0.036, 0.775, cx - 0.028, 0.87, '#8a3f2c'); p.rect(cx + 0.028, 0.775, cx + 0.036, 0.87, '#8a3f2c')
    p.save('bg_flat_cafe_in', {'name': 'Flat: cafe inside', 'place': 'cafe', 'time': 'day', 'indoor': True, 'tags': ['flat', 'cafe', 'coffee', 'restaurant'], 'groundNear': 0.95, 'groundFar': 0.82, 'heightNear': 0.6,
        'seats': [{'type': 'counter', 'x': 0.18, 'y': 0.7, 'cover': 0.53, 'w': 0.32}, {'type': 'seat', 'x': 0.563, 'y': 0.87, 'face': 1}, {'type': 'seat', 'x': 0.797, 'y': 0.87, 'face': -1}]})

# ---------- 3. market street ----------
def market():
    p = Pic('#ffe3b8'); p.circ(0.85, 0.12, 0.06, '#fff3b0', ol=False); p.cloud(0.2, 0.1, 1.0); p.cloud(0.6, 0.07, 0.8)
    buildings(p, 0.62, ['#e8b4a0', '#c9d8e8', '#f5e0b8', '#d7c4e8', '#bfe3c9'], seed=11, hmin=0.25, hmax=0.5)
    # shop row
    cols = [('#3f7fbf', '#f6c445'), ('#d9534f', '#fbf3e4'), ('#3f9b5a', '#f6e7d3'), ('#e67ab4', '#fbf3e4'), ('#f39c32', '#ffffff')]
    for i in range(5):
        x0 = 0.01 + i * 0.2; x1 = x0 + 0.18; c, c2 = cols[i]
        p.rect(x0, 0.36, x1, 0.74, '#f4ead8'); p.rect(x0 + 0.01, 0.37, x1 - 0.01, 0.43, c, r=0.01)
        p.rect(x0 + 0.03, 0.385, x1 - 0.03, 0.415, (255, 255, 255, 170), r=0.01, ol=False)
        p.rect(x0 + 0.015, 0.48, x1 - 0.015, 0.72, '#6b6f7a')
        for k in range(9): p.line([(x0 + 0.015, 0.495 + k * 0.025), (x1 - 0.015, 0.495 + k * 0.025)], (90, 94, 104, 255), 4)
        for k in range(6):
            a, b2 = x0 + 0.18 * k / 6, x0 + 0.18 * (k + 1) / 6; p.poly([(a, 0.44), (b2, 0.44), (b2, 0.475), (a, 0.475)], c if k % 2 == 0 else c2, ol=False)
        p.line([(x0, 0.44), (x1, 0.44)], w=6); p.line([(x0, 0.475), (x1, 0.475)], w=6)
    # electric pole + wires
    for px in [0.31, 0.79]: p.rect(px - 0.006, 0.12, px + 0.006, 0.78, '#6b5a4a'); p.rect(px - 0.03, 0.15, px + 0.03, 0.16, '#6b5a4a')
    p.line([(0, 0.2), (0.31, 0.16), (0.79, 0.17), (1, 0.21)], '#3b3b48', 5); p.line([(0, 0.23), (0.31, 0.155), (0.79, 0.16), (1, 0.24)], '#3b3b48', 4)
    # road
    p.rect(-0.01, 0.74, 1.01, 1.01, '#e3cfa8', ol=False); p.line([(0, 0.74), (1, 0.74)], w=8)
    for i in range(18): p.circ(random.Random(i).uniform(0, 1), random.Random(i + 50).uniform(0.78, 0.99), 0.004, '#c9b48c', ol=False)
    # fruit + vegetable stalls (left and right edges, behind the people)
    for sx in [0.03, 0.83]:
        p.rect(sx, 0.62, sx + 0.15, 0.75, '#b98a4c'); p.rect(sx - 0.005, 0.6, sx + 0.155, 0.625, '#8a5a3c')
        rnd = random.Random(int(sx * 100))
        for k in range(14):
            fx = sx + 0.015 + (k % 7) * 0.02; fy = 0.585 - (k // 7) * 0.025; p.circ(fx, fy, 0.014, ['#d9534f', '#f39c32', '#f6c445', '#3f9b5a'][rnd.randrange(4)], ow=4)
        p.rect(sx + 0.005, 0.38, sx + 0.012, 0.6, '#6b5a4a'); p.rect(sx + 0.138, 0.38, sx + 0.145, 0.6, '#6b5a4a')
        p.poly([(sx - 0.02, 0.36), (sx + 0.17, 0.36), (sx + 0.155, 0.42), (sx - 0.005, 0.42)], '#2f8f8f')
    p.save('bg_flat_market', {'name': 'Flat: market street', 'place': 'market', 'time': 'day', 'indoor': False, 'tags': ['flat', 'market', 'bazaar', 'street', 'road'], 'groundNear': 0.95, 'groundFar': 0.79, 'heightNear': 0.6, 'seats': []})

# ---------- 4. court room ----------
def court():
    p = Pic('#ecdcc0')
    for wx in [0.06, 0.82]:
        p.rect(wx, 0.08, wx + 0.12, 0.42, '#cfe9f2'); p.line([(wx + 0.06, 0.08), (wx + 0.06, 0.42)], '#ffffff', 12); p.rect(wx, 0.08, wx + 0.12, 0.42, None, ow=10)
        p.rect(wx - 0.03, 0.08, wx, 0.44, '#3f7a5a'); p.rect(wx + 0.12, 0.08, wx + 0.15, 0.44, '#3f7a5a')
    # ceiling fan
    p.line([(0.3, 0), (0.3, 0.05)], w=6); p.ell(0.22, 0.045, 0.38, 0.065, '#8a8f98'); p.circ(0.3, 0.055, 0.015, '#5b5f68')
    # wall panelling
    p.rect(-0.01, 0.48, 1.01, 0.78, '#8a5a3c', ol=False)
    for i in range(26): p.line([(i * 0.04, 0.5), (i * 0.04, 0.78)], (112, 72, 48, 255), 5)
    p.line([(0, 0.48), (1, 0.48)], w=8); p.rect(-0.01, 0.47, 1.01, 0.49, '#6e4535')
    # judge's chair + bench (centre, raised)
    p.rect(0.44, 0.17, 0.56, 0.5, '#7a1f2b', r=0.04); p.rect(0.455, 0.19, 0.545, 0.48, '#952a38', r=0.03, ol=False)
    p.circ(0.5, 0.11, 0.045, '#ffffff'); p.circ(0.5, 0.11, 0.045, None); p.line([(0.5, 0.11), (0.5, 0.08)], w=6); p.line([(0.5, 0.11), (0.52, 0.11)], w=6)
    p.rect(0.27, 0.44, 0.73, 0.47, '#5b3a2a'); p.rect(0.29, 0.47, 0.71, 0.73, '#7a4b33')
    for i in range(4): p.rect(0.31 + i * 0.1, 0.5, 0.39 + i * 0.1, 0.7, '#8a5a3c', r=0.008)
    # scales of justice on the bench front
    p.line([(0.5, 0.52), (0.5, 0.66)], '#e8b923', 9); p.line([(0.455, 0.545), (0.545, 0.545)], '#e8b923', 9); p.rect(0.48, 0.655, 0.52, 0.67, '#e8b923', ol=False)
    for sx in [0.455, 0.545]: p.line([(sx, 0.545), (sx - 0.015, 0.59)], '#e8b923', 4); p.line([(sx, 0.545), (sx + 0.015, 0.59)], '#e8b923', 4); p.d.pieslice([p.X(sx - 0.02), p.Y(0.575), p.X(sx + 0.02), p.Y(0.605)], 0, 180, fill=hexc('#e8b923'))
    # gavel block + files on the bench
    p.rect(0.62, 0.425, 0.66, 0.44, '#5b3a2a'); p.rect(0.33, 0.41, 0.4, 0.44, '#f4ead8'); p.rect(0.335, 0.4, 0.395, 0.415, '#d9a441')
    # floor
    p.rect(-0.01, 0.78, 1.01, 1.01, '#c9b8a0', ol=False); p.line([(0, 0.78), (1, 0.78)], w=8)
    for i in range(12): p.line([(i * 0.1 - 0.1, 1.0), (0.2 + i * 0.06, 0.78)], (176, 160, 138, 255), 5)
    for yy in [0.84, 0.91]: p.line([(0, yy), (1, yy)], (176, 160, 138, 255), 5)
    # witness box (right)
    p.rect(0.745, 0.555, 0.895, 0.575, '#5b3a2a'); p.rect(0.755, 0.575, 0.885, 0.84, '#8a5a3c')
    for i in range(5): p.rect(0.763 + i * 0.025, 0.59, 0.778 + i * 0.025, 0.83, '#9b6b4b', r=0.004, ol=False)
    # lawyer table (left, at the back)
    p.rect(0.03, 0.6, 0.23, 0.625, '#5b3a2a'); p.rect(0.045, 0.625, 0.065, 0.79, '#5b3a2a'); p.rect(0.195, 0.625, 0.215, 0.79, '#5b3a2a'); p.rect(0.08, 0.575, 0.15, 0.6, '#f4ead8'); p.rect(0.16, 0.58, 0.2, 0.6, '#d9a441')
    p.save('bg_flat_court', {'name': 'Flat: court room', 'place': 'court', 'time': 'day', 'indoor': True, 'tags': ['flat', 'court', 'judge'], 'groundNear': 0.96, 'groundFar': 0.8, 'heightNear': 0.6,
        'seats': [{'type': 'judge', 'x': 0.5, 'y': 0.62, 'cover': 0.44, 'w': 0.46}, {'type': 'witness', 'x': 0.82, 'y': 0.84, 'cover': 0.555, 'w': 0.15}]})

# ---------- 5. train coach inside (see-through windows) ----------
def train_in():
    p = Pic('#cfe3e0'); holes = []
    p.rect(-0.01, -0.01, 1.01, 0.06, '#e8efee', ol=False); p.line([(0, 0.06), (1, 0.06)], w=6)
    for fx in [0.25, 0.6]: p.circ(fx, 0.04, 0.03, '#8a8f98'); p.circ(fx, 0.04, 0.008, '#3b3b48')
    # luggage rack
    p.rect(0.02, 0.13, 0.84, 0.145, '#9aa3ad');
    for i in range(14): p.line([(0.03 + i * 0.06, 0.145), (0.03 + i * 0.06, 0.17)], '#9aa3ad', 6)
    p.rect(0.02, 0.165, 0.84, 0.175, '#9aa3ad')
    # hand straps
    p.line([(0.0, 0.09), (1.0, 0.09)], '#9aa3ad', 10)
    for hx in [0.12, 0.3, 0.48, 0.66]: p.line([(hx, 0.09), (hx, 0.13)], '#5b5f68', 5); p.ell(hx - 0.012, 0.125, hx + 0.012, 0.155, None, ow=8)
    # windows (holes) with bars
    for wx in [0.05, 0.31, 0.57]:
        x0, x1, y0, y1 = wx, wx + 0.22, 0.22, 0.46; holes.append((x0, y0, x1, y1, 0.02))
        p.rect(x0 - 0.012, y0 - 0.015, x1 + 0.012, y1 + 0.015, '#f4ead8', r=0.025)
    p.keep = Image.new('L', (W, H), 0); kd = ImageDraw.Draw(p.keep)
    for (x0, y0, x1, y1, r) in holes:
        p.rect(x0, y0, x1, y1, '#bfe6f5', r=0.02)  # drawn glass colour (hidden by the hole)
        for k in range(1, 5):
            yy = y0 + (y1 - y0) * k / 5; p.line([(x0, yy), (x1, yy)], '#7d8590', 12); kd.line([(p.X(x0), p.Y(yy)), (p.X(x1), p.Y(yy))], fill=255, width=12)
        p.d.rounded_rectangle([p.X(x0), p.Y(y0), p.X(x1), p.Y(y1)], radius=int(0.02 * H), outline=INK, width=8); kd.rounded_rectangle([p.X(x0), p.Y(y0), p.X(x1), p.Y(y1)], radius=int(0.02 * H), outline=255, width=10)
    # seats under the windows (blue cushions)
    p.rect(0.02, 0.5, 0.84, 0.74, '#2f5f9e', r=0.02); for_ = [p.line([(0.02 + i * 0.205, 0.51), (0.02 + i * 0.205, 0.73)], '#244a7c', 6) for i in range(1, 4)]
    p.rect(0.015, 0.73, 0.845, 0.768, '#3a6fb3', r=0.012); p.rect(0.03, 0.768, 0.83, 0.815, '#5b5f68')
    # door at the right end with yellow handles
    p.rect(0.86, 0.12, 0.99, 0.82, '#e8efee'); p.rect(0.885, 0.18, 0.965, 0.42, '#bfe6f5', r=0.015); p.line([(0.875, 0.3), (0.875, 0.7)], '#f6c445', 12); p.line([(0.975, 0.3), (0.975, 0.7)], '#f6c445', 12)
    # floor
    p.rect(-0.01, 0.8, 1.01, 1.01, '#8c9098', ol=False); p.line([(0, 0.8), (1, 0.8)], w=8)
    for i in range(30): p.line([(i * 0.035, 0.82), (i * 0.035 - 0.02, 1.0)], (120, 124, 132, 255), 4)
    p.save('bg_flat_train_in', {'name': 'Flat: train coach inside', 'place': 'railway', 'time': 'day', 'indoor': True, 'tags': ['flat', 'train', 'coach', 'window', 'inside train'], 'groundNear': 0.96, 'groundFar': 0.82, 'heightNear': 0.6, 'windowHoles': True, 'windowView': 'train',
        'seats': [{'type': 'window', 'x': 0.45, 'y': 0.47, 'cover': 0.2, 'w': 0.82}, {'type': 'seat', 'x': 0.12, 'y': 0.84}, {'type': 'seat', 'x': 0.33, 'y': 0.84}, {'type': 'seat', 'x': 0.54, 'y': 0.84}]}, holes=holes)

# ---------- 6. railway platform with a train standing ----------
def platform():
    p = Pic('#bfe6f5'); p.cloud(0.3, 0.06, 0.8); buildings(p, 0.3, ['#c9d8e8', '#e8b4a0'], seed=21, hmin=0.08, hmax=0.15)
    # train coach behind the platform
    p.rect(-0.02, 0.22, 1.02, 0.62, '#2f5f9e'); p.rect(-0.02, 0.22, 1.02, 0.26, '#244a7c'); p.rect(-0.02, 0.5, 1.02, 0.53, '#f6c445', ol=False)
    for i in range(9):
        wx = 0.02 + i * 0.115
        if i == 3: p.rect(wx, 0.29, wx + 0.075, 0.62, '#1c2f4f'); p.line([(wx + 0.005, 0.32), (wx + 0.005, 0.6)], '#f6c445', 8); p.line([(wx + 0.07, 0.32), (wx + 0.07, 0.6)], '#f6c445', 8); continue
        p.rect(wx, 0.3, wx + 0.075, 0.44, '#bfe6f5', r=0.012)
        for k in range(1, 4): p.line([(wx, 0.3 + 0.035 * k), (wx + 0.075, 0.3 + 0.035 * k)], '#7d8590', 6)
    p.rect(-0.02, 0.62, 1.02, 0.66, '#3b3b48', ol=False)
    # canopy + pillars
    p.rect(-0.01, -0.01, 1.01, 0.12, '#d9534f'); p.rect(-0.01, 0.12, 1.01, 0.15, '#b5472f')
    for px in [0.17, 0.83]: p.rect(px - 0.012, 0.15, px + 0.012, 0.75, '#3f7a5a'); p.rect(px - 0.02, 0.72, px + 0.02, 0.76, '#2f5d50')
    # hanging clock + board
    p.line([(0.5, 0.15), (0.5, 0.17)], w=5); p.circ(0.5, 0.2, 0.03, '#ffffff'); p.line([(0.5, 0.2), (0.5, 0.18)], w=5); p.line([(0.5, 0.2), (0.515, 0.2)], w=5)
    p.rect(0.62, 0.155, 0.76, 0.2, '#f6c445', r=0.006); p.rect(0.64, 0.17, 0.74, 0.185, '#2b2b3a', ol=False)
    # platform floor with yellow edge
    p.rect(-0.01, 0.66, 1.01, 0.7, '#f6c445'); p.rect(-0.01, 0.7, 1.01, 1.01, '#c8c3b8', ol=False); p.line([(0, 0.7), (1, 0.7)], w=8)
    for i in range(16): p.line([(i * 0.07, 0.72), (i * 0.07 - 0.05, 1.0)], (176, 170, 160, 255), 5)
    for yy in [0.8, 0.9]: p.line([(0, yy), (1, yy)], (176, 170, 160, 255), 5)
    # bench
    p.rect(0.88, 0.71, 0.99, 0.73, '#8a5a3c'); p.rect(0.89, 0.73, 0.9, 0.77, '#3b3b48'); p.rect(0.97, 0.73, 0.98, 0.77, '#3b3b48')
    p.save('bg_flat_platform', {'name': 'Flat: railway platform', 'place': 'railway', 'time': 'day', 'indoor': False, 'tags': ['flat', 'railway', 'station', 'platform', 'train'], 'groundNear': 0.95, 'groundFar': 0.76, 'heightNear': 0.6, 'seats': []})


def floor_tiles(p, y0, col, line, wood=False):
    p.rect(-0.01, y0, 1.01, 1.01, col, ol=False); p.line([(0, y0), (1, y0)], w=8)
    if wood:
        for i in range(8):
            yy = y0 + i * (1 - y0) / 7; p.line([(0, yy), (1, yy)], line, 5)
            for j in range(12): xx = j * 0.09 + (i % 2) * 0.045; p.line([(xx, yy), (xx, yy + (1 - y0) / 7)], line, 4)
    else:
        for i in range(14): p.line([(i * 0.08 - 0.05, 1.0), (0.1 + i * 0.065, y0)], line, 5)
        for yy in [y0 + (1 - y0) * 0.35, y0 + (1 - y0) * 0.7]: p.line([(0, yy), (1, yy)], line, 5)

def window(p, x0, y0, x1, y1, sky='#bfe6f5', night=False, frame='#ffffff'):
    p.rect(x0, y0, x1, y1, '#1c2440' if night else sky)
    if night: p.circ(x0 + (x1 - x0) * 0.7, y0 + (y1 - y0) * 0.3, 0.025, '#fff3b0', ol=False)
    else: p.cloud(x0 + (x1 - x0) * 0.35, y0 + (y1 - y0) * 0.35, 0.45)
    p.line([((x0 + x1) / 2, y0), ((x0 + x1) / 2, y1)], frame, 14); p.line([(x0, (y0 + y1) / 2), (x1, (y0 + y1) / 2)], frame, 14); p.rect(x0, y0, x1, y1, None, ow=9)

def home_in():
    p = Pic('#f3dcc2'); p.rect(-0.01, 0.6, 1.01, 0.62, '#c99a6e', ol=False)
    window(p, 0.08, 0.14, 0.3, 0.44); p.rect(0.05, 0.1, 0.08, 0.5, '#d9534f'); p.rect(0.3, 0.1, 0.33, 0.5, '#d9534f'); p.rect(0.04, 0.09, 0.34, 0.11, '#8a5a3c')
    # door
    p.rect(0.86, 0.22, 0.97, 0.8, '#8a5a3c'); p.rect(0.875, 0.25, 0.955, 0.5, '#9b6b4b', r=0.008, ol=False); p.rect(0.875, 0.53, 0.955, 0.77, '#9b6b4b', r=0.008, ol=False); p.circ(0.95, 0.53, 0.008, '#e8b923')
    # family photo + clock + TV
    p.rect(0.4, 0.14, 0.52, 0.28, '#ffffff'); [p.circ(0.43 + i * 0.03, 0.22, 0.018, c, ow=4) for i, c in enumerate(['#f1c79a', '#d79d6c', '#eab98c', '#f1c79a'])]
    p.circ(0.6, 0.2, 0.04, '#ffffff'); p.line([(0.6, 0.2), (0.6, 0.175)], w=5); p.line([(0.6, 0.2), (0.618, 0.2)], w=5)
    p.rect(0.68, 0.33, 0.82, 0.48, '#2b2b3a', r=0.008); p.rect(0.69, 0.34, 0.81, 0.47, '#5aa5c9', ol=False); p.rect(0.66, 0.6, 0.84, 0.66, '#8a5a3c'); p.rect(0.735, 0.48, 0.765, 0.6, '#3b3b48')
    # sofa (two seats) + carpet + table
    p.ell(0.18, 0.86, 0.72, 0.97, '#d9a441', ol=False)
    p.rect(0.12, 0.6, 0.54, 0.8, '#3f7fbf', r=0.03); p.rect(0.1, 0.68, 0.16, 0.86, '#2f6fae', r=0.02); p.rect(0.5, 0.68, 0.56, 0.86, '#2f6fae', r=0.02); p.rect(0.15, 0.76, 0.51, 0.84, '#4b8ccc', r=0.015)
    plant(p, 0.62, 0.8, 1.1)
    floor_tiles(p, 0.84, '#e6d2b5', (210, 190, 160, 255)); p.ell(0.18, 0.88, 0.72, 0.98, '#d9a441', ol=False); p.ell(0.22, 0.9, 0.68, 0.96, '#e8b923', ol=False)
    p.rect(0.12, 0.6, 0.54, 0.8, None, r=0.03)
    p.save('bg_flat_home', {'name': 'Flat: home living room', 'place': 'house_inside', 'time': 'day', 'indoor': True, 'tags': ['flat', 'home', 'house', 'ghar', 'living room', 'family'], 'groundNear': 0.97, 'groundFar': 0.86, 'heightNear': 0.62,
        'seats': [{'type': 'seat', 'x': 0.25, 'y': 0.9}, {'type': 'seat', 'x': 0.41, 'y': 0.9}, {'type': 'door', 'x': 0.915, 'y': 0.86}]})

def hut(p, x, y, w, h, wall='#e8c48f', roof='#c9a15a'):
    p.rect(x, y - h, x + w, y, wall); p.rect(x + w * 0.38, y - h * 0.62, x + w * 0.62, y, '#6b4426')
    p.poly([(x - w * 0.12, y - h), (x + w / 2, y - h * 1.75), (x + w * 1.12, y - h)], roof)
    for i in range(6): p.line([(x + w * (0.05 + i * 0.18), y - h * 1.02), (x + w / 2, y - h * 1.7)], (160, 120, 60, 255), 4)

def village():
    p = Pic('#bfe6f5'); p.circ(0.85, 0.12, 0.055, '#fff3b0', ol=False); p.cloud(0.2, 0.1, 1.0); p.cloud(0.55, 0.14, 0.8)
    p.poly([(0, 0.55), (0.2, 0.42), (0.4, 0.52), (0.6, 0.4), (0.8, 0.5), (1, 0.43), (1, 0.6), (0, 0.6)], '#8fbf7a', ol=False)
    p.rect(-0.01, 0.55, 1.01, 0.7, '#a9cf6a', ol=False)
    for i in range(16): p.line([(i * 0.07, 0.58), (i * 0.07 + 0.03, 0.69)], (140, 180, 80, 255), 5)
    hut(p, 0.08, 0.72, 0.18, 0.18); hut(p, 0.62, 0.7, 0.16, 0.16, '#f0d3a0', '#b98a4c')
    tree(p, 0.42, 0.72, 1.15); tree(p, 0.92, 0.72, 0.9)
    # well
    p.rect(0.82, 0.66, 0.9, 0.73, '#b8a48c'); p.ell(0.815, 0.65, 0.905, 0.675, '#6b6f7a'); p.line([(0.825, 0.66), (0.825, 0.58), (0.895, 0.58), (0.895, 0.66)], '#6b4426', 7)
    p.rect(-0.01, 0.72, 1.01, 1.01, '#e3c48f', ol=False); p.line([(0, 0.72), (1, 0.72)], w=8)
    for i in range(22): p.circ(random.Random(i).uniform(0, 1), random.Random(i + 9).uniform(0.76, 0.99), 0.004, '#c9a874', ol=False)
    # charpai
    p.rect(0.3, 0.76, 0.48, 0.79, '#b98a4c'); 
    for i in range(7): p.line([(0.305 + i * 0.028, 0.765), (0.305 + i * 0.028, 0.785)], (230, 210, 170, 255), 4)
    p.rect(0.305, 0.79, 0.315, 0.84, '#6b4426'); p.rect(0.465, 0.79, 0.475, 0.84, '#6b4426')
    p.save('bg_flat_village', {'name': 'Flat: village', 'place': 'village_street', 'time': 'day', 'indoor': False, 'tags': ['flat', 'village', 'gaon', 'hut', 'farm', 'kids'], 'groundNear': 0.95, 'groundFar': 0.76, 'heightNear': 0.6,
        'seats': [{'type': 'seat', 'x': 0.35, 'y': 0.84}, {'type': 'seat', 'x': 0.43, 'y': 0.84}]})

def road():
    p = Pic('#bfe6f5'); p.cloud(0.25, 0.1, 1.0); p.cloud(0.75, 0.08, 0.9)
    buildings(p, 0.6, ['#f2d0a9', '#e8b4a0', '#c9d8e8', '#d7c4e8', '#bfe3c9', '#f5e0b8'], seed=31, hmin=0.25, hmax=0.5)
    p.rect(-0.01, 0.6, 1.01, 0.68, '#d8cdb8', ol=False); p.line([(0, 0.6), (1, 0.6)], w=7)
    for i in range(14): p.line([(i * 0.075, 0.6), (i * 0.075 - 0.01, 0.68)], (190, 180, 160, 255), 4)
    lamp_post(p, 0.15, 0.66, 0.9); lamp_post(p, 0.62, 0.66, 0.9); tree(p, 0.38, 0.66, 0.9)
    # traffic signal
    p.rect(0.87, 0.3, 0.878, 0.66, '#3b3b48'); p.rect(0.855, 0.24, 0.893, 0.36, '#2b2b3a', r=0.01); [p.circ(0.874, 0.265 + i * 0.035, 0.012, c, ow=4) for i, c in enumerate(['#d9534f', '#f6c445', '#3f9b5a'])]
    p.rect(-0.01, 0.68, 1.01, 0.7, '#f4f1e6'); p.rect(-0.01, 0.7, 1.01, 1.01, '#6b6f7a', ol=False); p.line([(0, 0.7), (1, 0.7)], w=8)
    for i in range(10): p.rect(i * 0.11 + 0.02, 0.84, i * 0.11 + 0.08, 0.855, '#f4f1e6', ol=False)
    p.save('bg_flat_road', {'name': 'Flat: city road', 'place': 'city_street', 'time': 'day', 'indoor': False, 'tags': ['flat', 'road', 'street', 'city', 'highway', 'lane'], 'groundNear': 0.95, 'groundFar': 0.74, 'heightNear': 0.6, 'seats': []})

def police():
    p = Pic('#dfe6d8'); p.rect(-0.01, 0.62, 1.01, 0.64, '#7d8a70', ol=False)
    window(p, 0.06, 0.12, 0.24, 0.38)
    p.rect(0.3, 0.1, 0.52, 0.34, '#c9a15a'); p.rect(0.315, 0.115, 0.505, 0.325, '#e6d2b5', ol=False)
    for i, (x, y, c) in enumerate([(0.33, 0.14, '#ffffff'), (0.41, 0.13, '#f6e7d3'), (0.45, 0.21, '#ffffff'), (0.34, 0.23, '#cfe9f2')]): p.rect(x, y, x + 0.05, y + 0.07, c); p.circ(x + 0.025, y + 0.008, 0.006, '#d9534f', ol=False)
    p.line([(0.355, 0.17), (0.435, 0.16), (0.475, 0.24), (0.365, 0.26)], '#d9534f', 4)
    p.rect(0.56, 0.18, 0.62, 0.62, '#6b7a5a'); [p.rect(0.565, 0.2 + i * 0.1, 0.615, 0.28 + i * 0.1, '#7d8c6a', ol=False) for i in range(4)]
    # lock-up on the right
    p.rect(0.7, 0.1, 0.99, 0.78, '#9aa0a8'); p.rect(0.72, 0.13, 0.97, 0.78, '#b8bec6', ol=False)
    # inspector desk
    p.rect(0.3, 0.46, 0.4, 0.62, '#3b3b48', r=0.02)
    p.rect(0.16, 0.585, 0.56, 0.61, '#7a4b33'); p.rect(0.17, 0.61, 0.55, 0.8, '#8a5a3c'); p.rect(0.2, 0.55, 0.27, 0.585, '#f4ead8'); p.rect(0.42, 0.56, 0.47, 0.585, '#d9a441')
    p.rect(0.48, 0.545, 0.5, 0.585, '#2b2b3a'); p.circ(0.49, 0.54, 0.008, '#d9534f')
    floor_tiles(p, 0.8, '#c8c3b8', (176, 170, 160, 255))
    p.save('bg_flat_police', {'name': 'Flat: police station', 'place': 'police', 'time': 'day', 'indoor': True, 'tags': ['flat', 'police', 'thana', 'station', 'lockup', 'crime'], 'groundNear': 0.96, 'groundFar': 0.82, 'heightNear': 0.6,
        'seats': [{'type': 'desk', 'x': 0.36, 'y': 0.72, 'cover': 0.585, 'w': 0.4}, {'type': 'cell', 'x': 0.845, 'y': 0.82, 'cover': 0.13, 'w': 0.25}]})

def haunted():
    p = Pic('#2a2450')
    for i in range(40): r = random.Random(i); p.circ(r.uniform(0, 1), r.uniform(0, 0.45), 0.003, '#fff8d0', ol=False)
    p.glow(0.8, 0.15, 0.12, '#fff3b0', 60); p.circ(0.8, 0.15, 0.06, '#fff3b0', ol=False); p.circ(0.78, 0.13, 0.012, '#e8dca0', ol=False)
    p.rect(-0.01, 0.55, 1.01, 0.72, '#3a3466', ol=False)
    # old house
    p.rect(0.3, 0.28, 0.68, 0.72, '#4a4070'); p.poly([(0.27, 0.29), (0.49, 0.12), (0.71, 0.29)], '#2f2850'); p.rect(0.6, 0.14, 0.64, 0.24, '#2f2850')
    for wx, wy in [(0.34, 0.36), (0.56, 0.36), (0.34, 0.52)]: p.rect(wx, wy, wx + 0.08, wy + 0.1, '#f6c445'); p.line([(wx, wy), (wx + 0.08, wy + 0.1)], w=6); p.line([(wx + 0.04, wy), (wx + 0.04, wy + 0.1)], w=6)
    p.rect(0.46, 0.5, 0.53, 0.72, '#1f1a38'); p.poly([(0.46, 0.5), (0.5, 0.46), (0.53, 0.5)], '#1f1a38')
    # dead tree + bats + graves
    p.line([(0.12, 0.74), (0.12, 0.4), (0.06, 0.3)], '#1f1a38', 22); p.line([(0.12, 0.48), (0.2, 0.36), (0.24, 0.33)], '#1f1a38', 14); p.line([(0.12, 0.42), (0.08, 0.32)], '#1f1a38', 10)
    for bx, by in [(0.25, 0.12), (0.33, 0.08), (0.6, 0.06)]: p.poly([(bx - 0.02, by), (bx - 0.008, by + 0.008), (bx, by + 0.003), (bx + 0.008, by + 0.008), (bx + 0.02, by), (bx, by + 0.015)], '#151228', ol=False)
    p.rect(-0.01, 0.72, 1.01, 1.01, '#2f3b2a', ol=False); p.line([(0, 0.72), (1, 0.72)], w=8)
    for gx in [0.78, 0.88]: p.rect(gx, 0.64, gx + 0.05, 0.74, '#7d8590', r=0.02); p.line([(gx + 0.025, 0.66), (gx + 0.025, 0.7)], w=5); p.line([(gx + 0.012, 0.675), (gx + 0.038, 0.675)], w=5)
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    for i in range(6): d.ellipse([i * 700 - 300, 1480 + (i % 2) * 60, i * 700 + 700, 1780], fill=(200, 200, 230, 50))
    lay = lay.filter(ImageFilter.GaussianBlur(60)); p.im.alpha_composite(lay); p.d = ImageDraw.Draw(p.im)
    p.save('bg_flat_haunted', {'name': 'Flat: haunted house at night', 'place': 'haunted', 'time': 'night', 'indoor': False, 'tags': ['flat', 'haunted', 'horror', 'bhoot', 'night', 'graveyard'], 'groundNear': 0.95, 'groundFar': 0.76, 'heightNear': 0.6, 'seats': [{'type': 'door', 'x': 0.495, 'y': 0.76}]})

def school():
    p = Pic('#f6ecd0'); p.rect(-0.01, 0.62, 1.01, 0.64, '#a9cf6a', ol=False)
    p.rect(0.22, 0.12, 0.68, 0.42, '#2f5d50'); p.rect(0.22, 0.12, 0.68, 0.42, None, ow=16); p.rect(0.22, 0.42, 0.68, 0.44, '#8a5a3c')
    p.line([(0.27, 0.2), (0.4, 0.2)], '#ffffff', 6); p.line([(0.27, 0.26), (0.45, 0.26)], '#ffffff', 6); p.text(0.55, 0.27, 'A B C', 0.05, '#ffffff'); p.text(0.33, 0.35, '1+2=3', 0.035, '#f6c445')
    window(p, 0.76, 0.14, 0.94, 0.4); p.circ(0.12, 0.18, 0.04, '#ffffff'); p.line([(0.12, 0.18), (0.12, 0.155)], w=5); p.line([(0.12, 0.18), (0.14, 0.18)], w=5)
    # teacher table
    p.rect(0.04, 0.58, 0.2, 0.6, '#8a5a3c'); p.rect(0.05, 0.6, 0.19, 0.76, '#9b6b4b'); p.rect(0.07, 0.555, 0.12, 0.58, '#d9534f'); p.rect(0.13, 0.56, 0.17, 0.58, '#3f7fbf')
    floor_tiles(p, 0.78, '#d4c4a0', (190, 175, 145, 255))
    # student benches (front row, low)
    for bx in [0.42, 0.72]:
        p.rect(bx - 0.1, 0.8, bx + 0.1, 0.82, '#8a5a3c'); p.rect(bx - 0.095, 0.82, bx - 0.085, 0.9, '#6b4426'); p.rect(bx + 0.085, 0.82, bx + 0.095, 0.9, '#6b4426')
    p.save('bg_flat_school', {'name': 'Flat: school classroom', 'place': 'school', 'time': 'day', 'indoor': True, 'tags': ['flat', 'school', 'classroom', 'kids', 'teacher', 'college'], 'groundNear': 0.96, 'groundFar': 0.8, 'heightNear': 0.6,
        'seats': [{'type': 'board', 'x': 0.3, 'y': 0.8}, {'type': 'seat', 'x': 0.4, 'y': 0.93}, {'type': 'seat', 'x': 0.7, 'y': 0.93}]})

def office():
    p = Pic('#e8ecf0'); window(p, 0.05, 0.1, 0.45, 0.48, frame='#cfd6dd'); buildings(p, 0.48, ['#c9d8e8', '#d7c4e8'], seed=5, hmin=0.1, hmax=0.2); p.rect(0.05, 0.1, 0.45, 0.48, None, ow=9)
    p.rect(0.52, 0.12, 0.74, 0.34, '#ffffff'); p.line([(0.55, 0.3), (0.6, 0.24), (0.65, 0.27), (0.71, 0.17)], '#3f9b5a', 8); p.rect(0.8, 0.3, 0.86, 0.62, '#cfe9f2'); p.rect(0.79, 0.62, 0.87, 0.7, '#9aa3ad')
    plant(p, 0.94, 0.7, 1.2)
    # boss desk with computer
    p.rect(0.4, 0.47, 0.5, 0.6, '#2b2b3a', r=0.02)
    p.rect(0.3, 0.6, 0.66, 0.625, '#8a5a3c'); p.rect(0.31, 0.625, 0.65, 0.8, '#9b6b4b'); p.rect(0.5, 0.5, 0.6, 0.58, '#2b2b3a'); p.rect(0.505, 0.505, 0.595, 0.575, '#5aa5c9', ol=False); p.rect(0.54, 0.58, 0.56, 0.6, '#2b2b3a'); p.rect(0.34, 0.585, 0.4, 0.6, '#f4ead8')
    floor_tiles(p, 0.8, '#b8c0c8', (160, 168, 176, 255))
    p.save('bg_flat_office', {'name': 'Flat: office', 'place': 'office', 'time': 'day', 'indoor': True, 'tags': ['flat', 'office', 'company', 'boss', 'work', 'bank'], 'groundNear': 0.96, 'groundFar': 0.82, 'heightNear': 0.6,
        'seats': [{'type': 'desk', 'x': 0.45, 'y': 0.73, 'cover': 0.6, 'w': 0.36}]})

def park():
    p = Pic('#bfe6f5'); p.cloud(0.2, 0.1, 1.1); p.cloud(0.7, 0.13, 0.9); p.circ(0.9, 0.1, 0.05, '#fff3b0', ol=False)
    buildings(p, 0.5, ['#c9d8e8', '#e8b4a0'], seed=17, hmin=0.1, hmax=0.2)
    p.rect(-0.01, 0.5, 1.01, 1.01, '#8fcf6a', ol=False); p.line([(0, 0.5), (1, 0.5)], w=6)
    p.poly([(0.42, 0.5), (0.58, 0.5), (0.9, 1.0), (0.1, 1.0)], '#e9dcc8', ol=False)
    tree(p, 0.12, 0.62, 1.2); tree(p, 0.88, 0.64, 1.3); tree(p, 0.32, 0.56, 0.8)
    for i in range(18): r = random.Random(i); fx, fy = r.uniform(0, 1), r.uniform(0.6, 0.95)
    for i in range(18):
        r = random.Random(i + 3); fx, fy = r.uniform(0, 1), r.uniform(0.62, 0.97)
        if abs(fx - 0.5) < 0.12 + (fy - 0.5) * 0.8: continue
        p.circ(fx, fy, 0.008, ['#d9534f', '#f6c445', '#e67ab4', '#ffffff'][i % 4], ow=3)
    # bench
    p.rect(0.62, 0.66, 0.8, 0.68, '#b98a4c'); p.rect(0.62, 0.62, 0.8, 0.64, '#b98a4c'); p.rect(0.63, 0.68, 0.64, 0.73, '#3b4a5a'); p.rect(0.78, 0.68, 0.79, 0.73, '#3b4a5a')
    lamp_post(p, 0.55, 0.62, 0.8)
    p.save('bg_flat_park', {'name': 'Flat: park', 'place': 'other', 'time': 'day', 'indoor': False, 'tags': ['flat', 'park', 'garden', 'romance', 'kids', 'field'], 'groundNear': 0.95, 'groundFar': 0.72, 'heightNear': 0.6,
        'seats': [{'type': 'seat', 'x': 0.665, 'y': 0.73}, {'type': 'seat', 'x': 0.755, 'y': 0.73}]})

def hospital():
    p = Pic('#e4f1f0'); window(p, 0.06, 0.12, 0.26, 0.4)
    p.rect(0.62, 0.08, 0.66, 0.6, '#cfe0f0', ol=False); [p.line([(0.62 + i * 0.01, 0.08), (0.62 + i * 0.01, 0.6)], '#b0c8e0', 4) for i in range(4)]
    p.rect(0.72, 0.26, 0.82, 0.38, '#2b2b3a', r=0.01); p.line([(0.73, 0.33), (0.75, 0.33), (0.76, 0.29), (0.775, 0.36), (0.79, 0.32), (0.81, 0.32)], '#3fd16a', 5); p.rect(0.765, 0.38, 0.775, 0.62, '#9aa3ad')
    p.rect(0.88, 0.25, 0.89, 0.62, '#9aa3ad'); p.rect(0.87, 0.24, 0.9, 0.25, '#9aa3ad'); p.rect(0.875, 0.26, 0.895, 0.32, '#cfe9f2', r=0.008)
    p.circ(0.4, 0.16, 0.04, '#d9534f'); p.rect(0.39, 0.13, 0.41, 0.19, '#ffffff', ol=False); p.rect(0.37, 0.15, 0.43, 0.17, '#ffffff', ol=False)
    # bed
    p.rect(0.28, 0.48, 0.3, 0.66, '#9aa3ad'); p.rect(0.28, 0.54, 0.62, 0.58, '#ffffff'); p.rect(0.28, 0.58, 0.62, 0.6, '#9aa3ad'); p.rect(0.3, 0.6, 0.31, 0.7, '#6b7380'); p.rect(0.59, 0.6, 0.6, 0.7, '#6b7380'); p.rect(0.3, 0.525, 0.36, 0.55, '#cfe9f2', r=0.01)
    floor_tiles(p, 0.72, '#d6dde0', (184, 194, 198, 255))
    p.save('bg_flat_hospital', {'name': 'Flat: hospital room', 'place': 'hospital', 'time': 'day', 'indoor': True, 'tags': ['flat', 'hospital', 'doctor', 'patient', 'clinic'], 'groundNear': 0.95, 'groundFar': 0.76, 'heightNear': 0.6,
        'seats': [{'type': 'bed', 'x': 0.45, 'y': 0.545, 'w': 0.32}]})

ALL = [cafe_out, cafe_in, market, court, train_in, platform, home_in, village, road, police, haunted, school, office, park, hospital]
only = sys.argv[2:]
for f in ALL:
    if not only or f.__name__ in only: f(); print('ok', f.__name__)

