"""Generate display-sized WebP copies of the photos for fast page loads.

The book never shows an image wider than ~1200px on screen, so the 2400-3600px
source JPEGs are far larger than needed. This writes a WebP next to each JPEG,
capped at LONG_EDGE and re-encoded, while leaving the original JPEGs in place as
a fallback (and for the full-detail zoom view). Re-run any time; it skips files
whose WebP is already up to date.
"""
import os
from PIL import Image

IMAGES = "Images"
LONG_EDGE = 2000
QUALITY = 80

count = 0
before = 0
after = 0

for name in sorted(os.listdir(IMAGES)):
    base, ext = os.path.splitext(name)
    if ext.lower() not in (".jpg", ".jpeg"):
        continue

    src = os.path.join(IMAGES, name)
    dst = os.path.join(IMAGES, base + ".webp")

    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        continue

    with Image.open(src) as im:
        im = im.convert("RGB")
        w, h = im.size
        scale = LONG_EDGE / max(w, h)
        if scale < 1:
            im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
        im.save(dst, "WEBP", quality=QUALITY, method=4)

    count += 1
    before += os.path.getsize(src)
    after += os.path.getsize(dst)

if count:
    print(f"Wrote {count} WebP files. Source {before/1e6:.1f} MB -> WebP {after/1e6:.1f} MB")
else:
    print("All WebP files already up to date.")
