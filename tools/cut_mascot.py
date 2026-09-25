"""Cut the mascot artwork out of its black background.

Pure-black regions (the backdrop and the hole in the handle) become transparent; the
dark-brown eyes are kept. Edge pixels are un-matted from black so outlines stay clean.
Usage: python3 tools/cut_mascot.py path/to/mascot-on-black.png
Writes assets/img/mascot.png, app-icon-180.png, favicon-64.png. Needs pillow, numpy, scipy.
"""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

im = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(np.float32)
mx = im.max(axis=2)
lab, n = ndimage.label(mx < 60)
bg = np.zeros(mx.shape, bool)
for i in range(1, n + 1):
    region = lab == i
    if mx[region].mean() < 10:  # true black, not the brown eyes
        bg |= region

near = ndimage.binary_dilation(bg, iterations=3) & ~bg
alpha = np.ones(mx.shape, np.float32)
alpha[bg] = 0
alpha[near] = np.clip(mx[near] / 200.0, 0, 1)
safe = np.maximum(alpha, 1e-3)[..., None]
rgb = np.where(near[..., None], np.clip(im / safe, 0, 255), im)
img = Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), "RGBA")
img = img.crop(img.getbbox())
w, h = img.size
side = max(w, h) + 40
square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
square.paste(img, ((side - w) // 2, (side - h) // 2))
for name, px in (("mascot", 512), ("app-icon-180", 180), ("favicon-64", 64)):
    square.resize((px, px), Image.LANCZOS).save(f"assets/img/{name}.png", optimize=True)
