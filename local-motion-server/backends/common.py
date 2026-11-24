"""Shared helpers for the image-to-video backends."""
from PIL import Image


def fit_image(path, long_side, multiple, width=0, height=0):
    """Open the scene picture and centre-crop / resize it to a size the model accepts."""
    im = Image.open(path).convert("RGB")
    if width and height:
        W, H = width, height
    else:
        ar = im.width / im.height
        if ar >= 1:
            W, H = long_side, long_side / ar
        else:
            W, H = long_side * ar, long_side
    W = max(multiple, int(round(W / multiple)) * multiple)
    H = max(multiple, int(round(H / multiple)) * multiple)
    # centre-crop to the target aspect, then resize
    tar = W / H
    if im.width / im.height > tar:
        nw = int(im.height * tar)
        im = im.crop(((im.width - nw) // 2, 0, (im.width - nw) // 2 + nw, im.height))
    else:
        nh = int(im.width / tar)
        im = im.crop((0, (im.height - nh) // 2, im.width, (im.height - nh) // 2 + nh))
    return im.resize((W, H), Image.LANCZOS), W, H


def step_callback(total, progress):
    def cb(pipe, step, timestep, kwargs):
        try:
            progress((step + 1) / max(1, total))
        except Exception:
            pass
        return kwargs
    return cb


NEGATIVE = ("worst quality, low quality, blurry, distorted face, deformed hands, extra fingers, extra limbs, morphing, "
            "flickering, jittery, text, watermark, sudden change of style, new characters appearing")
