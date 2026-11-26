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
        im = im.resize((1920, 1080), Image.LANCZOS)
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
        'seats': [{'type': 'counter', 'x': 0.18, 'y': 0.7, 'cover': 0.53, 'w': 0.32}, {'type': 'seat', 'x': 0.563, 'y': 0.87}, {'type': 'seat', 'x': 0.797, 'y': 0.87}]})

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

for f in [cafe_out, cafe_in, market, court, train_in, platform]: f(); print('ok', f.__name__)
