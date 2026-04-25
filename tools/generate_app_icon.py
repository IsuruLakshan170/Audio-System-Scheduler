"""
Generate myicon.ico (Windows / PyInstaller) and PNGs for the web app.
Theme: දහම් පාසල් ශ්‍රව්‍ය + කාලසටහන (sound + time on navy / gold).

  py -3 -m pip install pillow
  py -3 tools/generate_app_icon.py

Requires: Pillow (added to requirements-build.txt for convenience)
"""
from __future__ import annotations

import os
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Install Pillow: py -3 -m pip install pillow", file=sys.stderr)
    sys.exit(1)

NAVY = (30, 58, 90, 255)
GOLD = (201, 164, 58, 255)
GOLD_L = (232, 213, 160, 255)
BROWN = (139, 115, 85, 255)
CREAM = (244, 234, 212, 255)


def draw_mark(size: int) -> Image.Image:
    """Same motif as public/icon.svg — tuned for small sizes."""
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    m = size / 128.0
    cx, cy = 64.0 * m, 64.0 * m
    r = 60.0 * m
    sw = max(1, int(3 * m))

    def R(x: float) -> float:
        return x * m

    # disc
    box = (cx - r, cy - r, cx + r, cy + r)
    draw.ellipse(box, fill=NAVY, outline=GOLD, width=sw)
    # 12 o’clock tick
    draw.line(
        (cx, cy - r + R(2), cx, cy - r + R(12)),
        fill=GOLD_L,
        width=max(1, int(3 * m)),
    )
    # sound arcs (broad stroke so 16x16 still reads)
    for i, (x_left, wcol, wstroke) in enumerate(
        [
            (R(34), GOLD_L, max(1, int(3 * m))),
            (R(24), GOLD, max(1, int(2.5 * m))),
            (R(16), BROWN, max(1, int(2 * m))),
        ]
    ):
        # partial rings on the left, opening toward right
        pr = R(20 + i * 2)
        abox = (x_left - pr, cy - pr, x_left + pr, cy + pr)
        draw.arc(abox, start=70, end=140, fill=wcol, width=wstroke)
        draw.arc(abox, start=200, end=290, fill=wcol, width=wstroke)
    # speaker
    p = [
        (R(52), R(52)),
        (R(52), R(76)),
        (R(62), R(70)),
        (R(72), R(80)),
        (R(72), R(48)),
        (R(62), R(58)),
    ]
    draw.polygon(p, fill=CREAM, outline=GOLD)
    dr = R(4)
    draw.ellipse((R(78), cy - dr, R(86), cy + dr), fill=GOLD)
    # light schedule arc
    ab = (R(64), R(40), R(108), R(88))
    draw.arc(ab, start=280, end=80, fill=(122, 106, 74, 180), width=max(1, int(2 * m)))
    return im


def main() -> None:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    public = os.path.join(root, "public")
    os.makedirs(public, exist_ok=True)

    big = draw_mark(256)
    im192 = big.resize((192, 192), Image.LANCZOS)
    im512 = big.resize((512, 512), Image.LANCZOS)
    im32 = big.resize((32, 32), Image.LANCZOS)
    im16 = big.resize((16, 16), Image.LANCZOS)

    im192.save(os.path.join(public, "logo192.png"), "PNG", optimize=True)
    im512.save(os.path.join(public, "logo512.png"), "PNG", optimize=True)

    # PWA / browser: combined favicon (16 + 32)
    im32.save(
        os.path.join(public, "favicon.ico"),
        format="ICO",
        sizes=[(16, 16), (32, 32)],
        append_images=[im16],
    )

    ico_path = os.path.join(root, "myicon.ico")
    big.save(
        ico_path,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print("Wrote", ico_path)
    print("Wrote", os.path.join(public, "favicon.ico"))
    print("Wrote", os.path.join(public, "logo192.png"), "|", os.path.join(public, "logo512.png"))


if __name__ == "__main__":
    main()
