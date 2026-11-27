# "Bean Night" backgrounds: dark walls, soft flat shapes with thin light outlines, warm lamp glows. Drawn at 4K.
# usage: python3 make_bean_backgrounds.py <backgrounds folder> [names…]
import json, os, sys, random, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
OUT = sys.argv[1]; W, H = 3840, 2160
FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'app', 'fonts')
HAND = os.path.join(FONTS, 'Kalam-Bold.ttf'); BOLD = os.path.join(FONTS, 'Poppins-SemiBold.ttf')
LINE = (150, 150, 158, 255)

def hx(c, a=255):
    if isinstance(c, tuple): return c
    c = c.lstrip('#'); return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), a)

class Pic:
    def __init__(s, bg):
        s.im = Image.new('RGBA', (W, H), hx(bg)); s.d = ImageDraw.Draw(s.im)
    def X(s, x): return int(round(x * W))
    def Y(s, y): return int(round(y * H))
    def rect(s, x0, y0, x1, y1, fill, r=0.0, line=None, lw=6):
        s.d.rounded_rectangle([s.X(x0), s.Y(y0), s.X(x1), s.Y(y1)], radius=int(r * H), fill=hx(fill) if fill else None, outline=hx(line) if line else None, width=lw if line else 0)
    def circ(s, cx, cy, r, fill, line=None, lw=6):
        rr = r * H; s.d.ellipse([s.X(cx) - rr, s.Y(cy) - rr, s.X(cx) + rr, s.Y(cy) + rr], fill=hx(fill) if fill else None, outline=hx(line) if line else None, width=lw if line else 0)
    def line(s, pts, c=LINE, w=6): s.d.line([(s.X(x), s.Y(y)) for x, y in pts], fill=hx(c), width=w, joint='curve')
    def poly(s, pts, fill): s.d.polygon([(s.X(x), s.Y(y)) for x, y in pts], fill=hx(fill))
    def text(s, x, y, t, size, c, font=HAND, anchor='mm', rot=0):
        f = ImageFont.truetype(font, int(size * H))
        if not rot: s.d.text((s.X(x), s.Y(y)), t, font=f, fill=hx(c), anchor=anchor); return
        lay = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(lay).text((s.X(x), s.Y(y)), t, font=f, fill=hx(c), anchor=anchor)
        lay = lay.rotate(rot, center=(s.X(x), s.Y(y))); s.im.alpha_composite(lay); s.d = ImageDraw.Draw(s.im)
    def glow(s, cx, cy, r, c, a=110):
        lay = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(lay); rr = r * H
        d.ellipse([s.X(cx) - rr, s.Y(cy) - rr, s.X(cx) + rr, s.Y(cy) + rr], fill=hx(c, a)); lay = lay.filter(ImageFilter.GaussianBlur(rr * 0.45)); s.im.alpha_composite(lay); s.d = ImageDraw.Draw(s.im)
    def shade_band(s, y0, y1, a0, a1):  # vertical darkening (vignette feel)
        lay = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
        for i in range(s.Y(y0), s.Y(y1)): t = (i - s.Y(y0)) / max(1, s.Y(y1) - s.Y(y0)); d.line([(0, i), (W, i)], fill=(0, 0, 0, int(a0 + (a1 - a0) * t)))
        s.im.alpha_composite(lay); s.d = ImageDraw.Draw(s.im)
    def panels(s, y0, y1, n, c):
        for i in range(1, n): s.line([(i / n, y0), (i / n, y1)], c, 5)
    def floor(s, y0, c, lines=True):
        s.rect(-0.01, y0, 1.01, 1.01, c); s.line([(0, y0), (1, y0)], (120, 120, 128, 255), 6)
        if lines:
            for i in range(-6, 22): s.line([(0.5 + (i - 8) * 0.06, y0), (0.5 + (i - 8) * 0.16, 1.0)], hx(c, 255)[:3] + (255,) if False else (70, 70, 78, 255), 3)
    def save(s, id_, meta):
        os.makedirs(os.path.join(OUT, id_), exist_ok=True)
        s.im.convert('RGB').save(os.path.join(OUT, id_, 'image.jpg'), quality=92)
        meta = {'id': id_, 'file': f'backgrounds/{id_}/image.jpg', 'rev': 3, **meta}
        json.dump(meta, open(os.path.join(OUT, id_, 'background.json'), 'w'), indent=2)

GN, GF, HN = 0.88, 0.80, 0.40   # feet line (near / far) and character height at the front
def chair(p, x, feet, face=1, c=(150, 150, 158, 255)):  # thin line chair; the person sits at x
    seat = feet - 0.077; back = x - face * 0.04
    p.line([(back, seat - 0.15), (back, feet)], c, 9); p.line([(back, seat), (x + face * 0.035, seat)], c, 9); p.line([(x + face * 0.035, seat), (x + face * 0.035, feet)], c, 7)
def desk(p, x0, x1, top, feet, c='#b08a5a'):
    p.rect(x0, top - 0.008, x1, top + 0.008, c, r=0.006); p.line([(x0 + 0.012, top), (x0 + 0.012, feet)], (150, 150, 158, 255), 7); p.line([(x1 - 0.012, top), (x1 - 0.012, feet)], (150, 150, 158, 255), 7)

def classroom():
    p = Pic('#2a2c33'); p.panels(0.05, GN, 7, (36, 38, 45, 255))
    p.rect(0.08, 0.17, 0.31, 0.5, '#9fc4e8', r=0.02, line=(120, 120, 128, 255), lw=10)
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)  # trees seen through the window (clipped to the glass)
    for i in range(7): rr = (0.06 + 0.012 * ((i * 5) % 3)) * H; cx, cy = p.X(0.07 + i * 0.043), p.Y(0.505 - 0.012 * ((i * 3) % 4)); d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=hx(['#5aa04a', '#4f9642', '#62a852', '#57a047'][i % 4]))
    mask = Image.new('L', (W, H), 0); ImageDraw.Draw(mask).rounded_rectangle([p.X(0.08), p.Y(0.17), p.X(0.31), p.Y(0.5)], radius=int(0.02 * H), fill=255)
    lay.putalpha(Image.composite(lay.getchannel('A'), Image.new('L', (W, H), 0), mask)); p.im.alpha_composite(lay); p.d = ImageDraw.Draw(p.im)
    p.rect(0.08, 0.38, 0.31, 0.5, None, r=0.02, line=(120, 120, 128, 255), lw=10); p.rect(0.08, 0.17, 0.31, 0.5, None, r=0.02, line=(120, 120, 128, 255), lw=12)
    p.line([(0.195, 0.17), (0.195, 0.5)], (120, 120, 128, 255), 9); p.line([(0.08, 0.335), (0.31, 0.335)], (120, 120, 128, 255), 9)
    for x, c, t, cc in [(0.395, '#e8643a', 'READ', '#f3a98f'), (0.475, '#3b82d6', 'MATHS', '#9cc7f2')]:
        p.rect(x - 0.032, 0.22, x + 0.032, 0.33, c, r=0.02); p.text(x, 0.245, t, 0.022, '#ffffff'); p.circ(x, 0.295, 0.022, cc)
    p.circ(0.6, 0.26, 0.055, '#efeee8', line=(120, 120, 128, 255), lw=8)
    for i in range(12): a = i / 12 * 2 * math.pi; p.line([(0.6 + math.sin(a) * 0.0265, 0.26 - math.cos(a) * 0.047), (0.6 + math.sin(a) * 0.029, 0.26 - math.cos(a) * 0.052)], (40, 40, 48, 255), 6)
    p.line([(0.6, 0.26), (0.604, 0.225)], (40, 40, 48, 255), 8); p.line([(0.6, 0.26), (0.595, 0.29)], (210, 60, 50, 255), 6)
    p.rect(0.68, 0.3, 1.02, 0.62, '#242a26', r=0.012, line='#a58254', lw=14); p.text(0.79, 0.4, 'x + 4 = 10', 0.05, '#e8e8e0', BOLD); p.text(0.765, 0.5, 'x = ?', 0.05, '#e8e8e0', BOLD)
    p.line([(0.92, 0.47), (0.92, 0.56), (0.98, 0.56), (0.92, 0.47)], (220, 220, 214, 255), 5)
    p.rect(0.66, 0.62, 0.96, 0.632, '#a58254'); p.rect(0.61, 0.58, 0.69, 0.592, '#a58254')
    for i, c in enumerate(['#e8643a', '#3b82d6', '#f0c330']): p.rect(0.617 + i * 0.022, 0.53, 0.633 + i * 0.022, 0.58, c, r=0.008)
    p.floor(GN, '#1e1f25')
    seats = []
    for x in [0.17, 0.39, 0.61]: chair(p, x, GN); desk(p, x + 0.055, x + 0.155, GN - 0.12, GN); seats.append({'type': 'seat', 'x': x, 'y': GN, 'face': 1, 'tableY': GN - 0.12})
    p.shade_band(0.0, 0.12, 120, 0)
    p.save('bg_bean_classroom', {'name': 'Bean: classroom', 'place': 'school', 'time': 'day', 'indoor': True, 'tags': ['bean', 'school', 'classroom', 'class', 'teacher', 'exam'], 'groundNear': GN + 0.03, 'groundFar': GN - 0.006, 'heightNear': HN, 'seats': seats + [{'type': 'board', 'x': 0.84, 'y': GN}]})

def cafe():
    p = Pic('#3a2c27'); p.panels(0.05, GN, 9, (48, 37, 32, 255))
    p.rect(0.04, 0.2, 0.4, 0.62, '#4a74c4', r=0.025, line='#b88a5a', lw=14)
    for x0, x1, top in [(0.08, 0.13, 0.33), (0.14, 0.2, 0.4), (0.22, 0.27, 0.3), (0.29, 0.34, 0.36), (0.35, 0.39, 0.42)]: p.rect(x0, top, x1, 0.62, '#3a5ea8')
    p.line([(0.22, 0.2), (0.22, 0.62)], '#b88a5a', 8); p.text(0.17, 0.27, 'CAFE', 0.05, '#f2f2f2', BOLD)
    for row in [0.34, 0.44]:
        p.rect(0.47, row, 0.66, row + 0.012, '#b88a5a', r=0.006)
        for i in range(5): x = 0.49 + i * 0.038; p.rect(x - 0.011, row - 0.045, x + 0.011, row - 0.002, '#f2ede2', r=0.006); p.rect(x - 0.011, row - 0.03, x + 0.011, row - 0.022, '#c98a5a')
    p.rect(0.73, 0.22, 1.02, 0.56, '#2a211d', r=0.02, line='#b88a5a', lw=10); p.text(0.86, 0.27, 'MENU', 0.04, '#f2f2f2', BOLD)
    for i, t in enumerate(['hot chocolate  3', 'latte  3.5', 'tea  2', 'cookie  2']): p.text(0.86, 0.33 + i * 0.055, t, 0.03, '#ece6da')
    for lx in [0.49, 0.77, 0.98]: p.line([(lx, 0), (lx, 0.15)], (110, 100, 90, 255), 4); p.glow(lx, 0.17, 0.09, '#ffcf73', 140); p.circ(lx, 0.165, 0.012, '#fff1c4')
    p.floor(GN, '#241b18', lines=False)
    # counter (the barista stands behind it), plant, table with two stools
    p.rect(0.68, 0.66, 1.02, 0.68, '#c9a070', r=0.008); p.rect(0.69, 0.68, 1.01, GN + 0.005, '#8a5a3a', r=0.01)
    p.poly([(0.6, GN), (0.64, GN), (0.645, GN - 0.07), (0.595, GN - 0.07)], '#c96f3a')
    for i in range(6): a = -0.9 + i * 0.36; p.line([(0.62, GN - 0.07), (0.62 + math.sin(a) * 0.04, GN - 0.07 - math.cos(a) * 0.1)], '#4f9a4a', 14)
    p.rect(0.12, GN - 0.11, 0.24, GN - 0.098, '#b88a5a', r=0.006); p.line([(0.18, GN - 0.1), (0.18, GN)], '#b88a5a', 8)
    p.save('bg_bean_cafe', {'name': 'Bean: cafe', 'place': 'cafe', 'time': 'night', 'indoor': True, 'tags': ['bean', 'cafe', 'coffee', 'restaurant', 'tea'], 'groundNear': GN + 0.03, 'groundFar': GN - 0.006, 'heightNear': HN,
        'seats': [{'type': 'seat', 'x': 0.095, 'y': GN, 'face': 1, 'tableY': GN - 0.104, 'stool': True, 'cup': True}, {'type': 'seat', 'x': 0.265, 'y': GN, 'face': -1, 'tableY': GN - 0.104, 'stool': True, 'cup': True}, {'type': 'counter', 'x': 0.86, 'y': 0.83, 'cover': 0.66, 'w': 0.33}]})

def corridor():
    p = Pic('#2a3038')
    for i in range(6): p.glow(0.08 + i * 0.18, 0.1, 0.06, '#e8e8f0', 90); p.circ(0.08 + i * 0.18, 0.08, 0.012, '#d8dce4')
    p.rect(0.74, 0.3, 0.9, 0.45, '#b98a4c', r=0.015)
    for i, (x, c) in enumerate([(0.76, '#f2f2f2'), (0.795, '#f2c33a'), (0.83, '#8cc4ee'), (0.865, '#f2f2f2')]): p.rect(x - 0.015, 0.32 + (i % 2) * 0.03, x + 0.015, 0.37 + (i % 2) * 0.03, c)
    cols = ['#3e6188', '#456a92', '#c06a48'] ; x = -0.02; i = 0
    while x < 1.02:
        c = '#c06a48' if i % 7 in (2, 9) or i % 9 == 4 else ['#3e6188', '#456a92', '#4c74a0'][i % 3]
        p.rect(x, 0.5, x + 0.058, GN - 0.005, c, r=0.025)
        for k in range(3): p.line([(x + 0.016, 0.535 + k * 0.012), (x + 0.042, 0.535 + k * 0.012)], (30, 40, 55, 255), 5)
        p.rect(x + 0.026, 0.67, x + 0.032, 0.7, '#e8e8f0'); x += 0.064; i += 1
    p.floor(GN, '#23272e')
    p.save('bg_bean_corridor', {'name': 'Bean: school corridor (lockers)', 'place': 'school', 'time': 'day', 'indoor': True, 'tags': ['bean', 'school', 'corridor', 'lockers', 'college', 'hallway'], 'groundNear': GN + 0.03, 'groundFar': GN - 0.006, 'heightNear': HN, 'seats': []})

def street():
    p = Pic('#15171d'); rnd = random.Random(4)
    for i in range(9):
        x = i * 0.12 - 0.02; h = rnd.uniform(0.25, 0.45); p.rect(x, 0.62 - h, x + 0.11, 0.62, '#1d2028'); p.line([(x, 0.62 - h), (x + 0.11, 0.62 - h)], (70, 72, 80, 255), 5)
        for k in range(8):
            if rnd.random() < 0.35: wx = x + 0.015 + (k % 3) * 0.032; wy = 0.62 - h + 0.04 + (k // 3) * 0.07; p.rect(wx, wy, wx + 0.016, wy + 0.028, '#d9b878')
    for i, (c) in enumerate(['#4fa6e0', '#e8643a', '#4fa6e0', '#f0c330', '#e8643a']):
        x = 0.01 + i * 0.205; p.rect(x, 0.42, x + 0.19, GN, ['#262a33', '#2e2824', '#262a33', '#2b2a26', '#2e2824'][i]); p.rect(x + 0.02, 0.56, x + 0.17, GN - 0.01, '#111318')
        if i == 3: p.rect(x + 0.03, 0.57, x + 0.16, GN - 0.02, '#c9b282'); [p.rect(x + 0.045 + j * 0.04, 0.66, x + 0.07 + j * 0.04, 0.7, '#8a7650') for j in range(3)]
        p.d.pieslice([p.X(x + 0.01), p.Y(0.46), p.X(x + 0.18), p.Y(0.56)], 180, 360, fill=hx(c)); p.rect(x + 0.01, 0.505, x + 0.18, 0.512, c)
        for j in range(4): p.line([(x + 0.04 + j * 0.04, 0.47), (x + 0.03 + j * 0.04, 0.51)], (240, 240, 240, 180), 4)
        for j in range(3): p.rect(x + 0.03 + j * 0.05, 0.44, x + 0.06 + j * 0.05, 0.47, '#d9b878' if (i + j) % 2 else '#3a3d45')
    for lx in [0.19, 0.72]: p.line([(lx, GN), (lx, 0.33), (lx + 0.04, 0.33)], (150, 150, 158, 255), 9); p.glow(lx + 0.045, 0.345, 0.07, '#ffd98a', 150); p.circ(lx + 0.045, 0.34, 0.01, '#fff1c4')
    p.rect(-0.01, GN, 1.01, 0.93, '#2a2c33'); p.line([(0, GN), (1, GN)], (120, 120, 128, 255), 6); p.rect(-0.01, 0.93, 1.01, 1.01, '#1a1c22')
    for i in range(7): p.rect(i * 0.16 + 0.04, 0.965, i * 0.16 + 0.1, 0.972, '#d8d8d8')
    p.save('bg_bean_street', {'name': 'Bean: night street with shops', 'place': 'city_street', 'time': 'night', 'indoor': False, 'tags': ['bean', 'street', 'road', 'market', 'city', 'night', 'shops'], 'groundNear': GN + 0.03, 'groundFar': GN - 0.006, 'heightNear': HN, 'seats': []})

def bedroom():
    p = Pic('#16181e')
    p.rect(0.66, 0.16, 0.86, 0.44, '#0f1116', r=0.02, line=(160, 160, 168, 255), lw=9); p.line([(0.76, 0.16), (0.76, 0.44)], (160, 160, 168, 255), 7); p.line([(0.66, 0.3), (0.86, 0.3)], (160, 160, 168, 255), 7)
    p.glow(0.81, 0.2, 0.05, '#ffffff', 60); p.circ(0.81, 0.2, 0.022, '#f2f2ea')
    for i in range(30): r = random.Random(i); p.circ(r.uniform(0, 1), r.uniform(0, 0.12), 0.002, '#8a8a90')
    # nightstand with a digital clock, bed
    p.rect(0.18, 0.66, 0.31, GN, '#22252c', r=0.015, line=(160, 160, 168, 255), lw=7); p.line([(0.2, 0.75), (0.29, 0.75)], (160, 160, 168, 255), 5); p.circ(0.245, 0.705, 0.006, '#d8d8d8')
    p.rect(0.2, 0.6, 0.29, 0.655, '#1a1c22', r=0.02, line=(200, 90, 70, 255), lw=6); p.text(0.245, 0.628, '3:00', 0.035, '#e8643a', BOLD)
    p.rect(0.33, 0.55, 0.36, GN, '#2b2e36', r=0.012, line=(160, 160, 168, 255), lw=6)
    p.rect(0.34, 0.75, 0.97, GN, '#2b2e36', r=0.012, line=(160, 160, 168, 255), lw=6)
    p.rect(0.355, 0.715, 0.48, 0.765, '#5e636e', r=0.02)
    p.rect(0.47, 0.71, 0.96, 0.79, '#2f3d5e', r=0.03, line=(160, 160, 168, 255), lw=6); p.line([(0.6, 0.735), (0.86, 0.73)], (110, 120, 150, 255), 4)
    p.rect(-0.01, GN, 1.01, 1.01, '#101216'); p.line([(0, GN), (1, GN)], (90, 90, 98, 255), 5)
    p.save('bg_bean_bedroom', {'name': 'Bean: bedroom at night', 'place': 'house_inside', 'time': 'night', 'indoor': True, 'tags': ['bean', 'bedroom', 'home', 'house', 'night', 'bed', 'sleep'], 'groundNear': GN + 0.03, 'groundFar': GN - 0.006, 'heightNear': HN,
        'seats': [{'type': 'bed', 'x': 0.6, 'y': 0.73, 'w': 0.46}]})

def park():
    p = Pic('#15171d'); rnd = random.Random(9)
    for i in range(9):
        x = i * 0.12 - 0.02; h = rnd.uniform(0.25, 0.42); p.line([(x, 0.6 - h), (x + 0.1, 0.6 - h)], (70, 72, 80, 255), 5)
        for k in range(9):
            if rnd.random() < 0.3: wx = x + 0.01 + (k % 3) * 0.032; wy = 0.6 - h + 0.04 + (k // 3) * 0.07; p.rect(wx, wy, wx + 0.014, wy + 0.026, '#c9ac70')
    for lx in [0.55]: p.line([(lx, GN - 0.12), (lx, 0.36), (lx + 0.03, 0.36)], (150, 150, 158, 255), 8); p.glow(lx + 0.035, 0.37, 0.05, '#ffd98a', 120)
    # chain fence
    p.line([(0, 0.52), (1, 0.52)], (200, 200, 205, 255), 7)
    for i in range(9): p.line([(i * 0.125, 0.52), (i * 0.125, GN)], (200, 200, 205, 255), 7)
    for i in range(-20, 60):
        x = i * 0.018; p.line([(x, 0.52), (x + 0.22, GN)], (120, 120, 128, 255), 2); p.line([(x + 0.22, 0.52), (x, GN)], (120, 120, 128, 255), 2)
    p.rect(-0.01, GN, 1.01, 1.01, '#22242a'); p.line([(0, GN), (1, GN)], (120, 120, 128, 255), 6)
    p.rect(0.76, 0.75, 0.92, 0.765, '#b08a5a', r=0.006); p.rect(0.76, 0.79, 0.92, 0.805, '#b08a5a', r=0.006); p.line([(0.775, 0.805), (0.775, GN)], (150, 150, 158, 255), 6); p.line([(0.905, 0.805), (0.905, GN)], (150, 150, 158, 255), 6)
    p.save('bg_bean_park', {'name': 'Bean: night park / court with fence', 'place': 'other', 'time': 'night', 'indoor': False, 'tags': ['bean', 'park', 'court', 'playground', 'night', 'fence', 'ground'], 'groundNear': GN + 0.03, 'groundFar': GN - 0.006, 'heightNear': HN,
        'seats': [{'type': 'seat', 'x': 0.8, 'y': GN, 'face': 1}, {'type': 'seat', 'x': 0.88, 'y': GN, 'face': -1}]})

def stadium():
    p = Pic('#14161c')
    for lx in [0.06, 0.78]: p.line([(lx, 0.66), (lx, 0.2)], (170, 170, 178, 255), 7); p.rect(lx - 0.035, 0.17, lx + 0.035, 0.205, '#2a2c33', r=0.02, line=(200, 200, 205, 255), lw=6); p.glow(lx, 0.19, 0.08, '#ffffff', 90); [p.circ(lx - 0.022 + j * 0.015, 0.188, 0.006, '#ffffff') for j in range(4)]
    rnd = random.Random(2)
    for i in range(70): x = rnd.uniform(0, 1); y = rnd.uniform(0.5, 0.6); p.circ(x, y, 0.012, '#5a5e6a'); p.rect(x - 0.012, y + 0.008, x + 0.012, y + 0.035, '#5a5e6a', r=0.01)
    p.line([(0, 0.62), (1, 0.62)], (170, 170, 178, 255), 6)
    for i in range(21): p.line([(i * 0.05, 0.62), (i * 0.05, 0.66)], (170, 170, 178, 255), 4)
    p.rect(-0.01, 0.66, 1.01, 1.01, '#5c2a26')
    for i, y in enumerate([0.72, 0.8, 0.88, 0.96]): p.line([(0, y), (1, y - 0.01)], (220, 210, 205, 255), 5)
    p.line([(0.62, 0.66), (0.58, 1.0)], (240, 240, 240, 255), 9)
    p.save('bg_bean_stadium', {'name': 'Bean: stadium running track at night', 'place': 'other', 'time': 'night', 'indoor': False, 'tags': ['bean', 'stadium', 'race', 'sports', 'track', 'ground', 'match'], 'groundNear': 0.93, 'groundFar': 0.8, 'heightNear': 0.42, 'seats': []})

ALL = [classroom, cafe, corridor, street, bedroom, park, stadium]
only = sys.argv[2:]
for f in ALL:
    if not only or f.__name__ in only: f(); print('ok', f.__name__)
