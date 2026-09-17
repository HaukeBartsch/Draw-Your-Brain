"""Rasterize a Draw-Your-Brain `.code` drawing into a sketch image.

A `.code` file is the app's saved drawing: a JSON array of strokes,

    [ {"color": "rgb(133, 193, 233)", "lineWidth": 6,
       "pos": [[0.18, 0.59, 0], [0.31, 0.62, 22], ...]}, ... ]

where `pos` points are in the **unit square** (0..1) and `color` is a CSS color
(name, `#hex`, or `rgb(r, g, b)`).  This turns that into a white-background RGB
PIL image to use as the FLUX.2 sketch.

Rendering is done at 2× and downscaled (anti-aliased) for clean lines, and it
needs only Pillow — no torch.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

# The few CSS color names the app actually uses (see drawBrain.html's palette).
_NAMED = {
    "black": "#000000",
    "white": "#ffffff",
    "orange": "#ffa500",
    "limegreen": "#32cd32",
    "green": "#008000",
    "red": "#ff0000",
    "blue": "#0000ff",
    "gray": "#808080",
    "grey": "#808080",
}
_RGB_RE = re.compile(r"rgb\(\s*(\d{1,3})[,\s]+(\d{1,3})[,\s]+(\d{1,3})")


def parse_color(value, fallback: str = "#000000") -> str:
    """Normalise a CSS color (name / #hex / rgb()) to a `#rrggbb` string."""
    if value is None:
        return fallback
    c = str(value).strip().lower()
    if c.startswith("#") and len(c) in (4, 7):
        return c
    m = _RGB_RE.search(c)
    if m:
        r, g, b = (max(0, min(255, int(m[i]))) for i in (1, 2, 3))
        return "#%02x%02x%02x" % (r, g, b)
    return _NAMED.get(c, fallback)


def load_code(path) -> list:
    """Load and validate a `.code` drawing (a non-empty list of strokes)."""
    strokes = json.loads(Path(path).read_text())
    if not isinstance(strokes, list) or not strokes:
        raise ValueError(f"no strokes in {path}")
    return strokes


def rasterize_code(code_path, size: int = 512) -> "Image.Image":  # noqa: F821
    """Render a `.code` drawing to a white-background RGB image of `size`×`size`.

    `size` is in output pixels; the image is drawn at 2× and downscaled for
    anti-aliasing.  Line widths are scaled so they look the same at a 512px
    reference (the app's fast-path size).
    """
    from PIL import Image, ImageDraw

    strokes = load_code(code_path)
    S = int(size) * 2  # supersample
    img = Image.new("RGB", (S, S), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    ref = 512.0

    for s in strokes:
        if not isinstance(s, dict):
            continue
        pos = s.get("pos") or []
        if not pos:
            continue
        color = parse_color(s.get("color"))
        width = max(1, int(round((int(s.get("lineWidth", 4))) * S / ref)))
        pts = [(float(p[0]) * S, float(p[1]) * S) for p in pos]
        if len(pts) < 2:  # a lone point (a click) -> a dot
            x, y = pts[0]
            draw.ellipse([x - width, y - width, x + width, y + width], fill=color)
            continue
        draw.line(pts, fill=color, width=width, joint="curve")

    return img.resize((int(size), int(size)), Image.LANCZOS)
