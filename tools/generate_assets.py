#!/usr/bin/env python3
"""Generate app icon + launch logo PNGs from scratch (stdlib only).
Dark slate background with a green upward area-chart motif, matching the app theme."""
import zlib, struct, math, os

BG_TOP = (13, 17, 23)
BG_BOT = (7, 9, 13)
GREEN = (33, 212, 115)
GREEN_DK = (24, 160, 88)

# Upward-trending chart path, normalized (x, y) with y=0 at top.
PATH = [(0.10, 0.70), (0.22, 0.61), (0.34, 0.65), (0.46, 0.49),
        (0.58, 0.53), (0.70, 0.37), (0.82, 0.29), (0.91, 0.20)]
BASELINE = 0.82


def blend(dst, src, a):
    return tuple(int(src[i] * a + dst[i] * (1 - a)) for i in range(3))


def make_canvas(size, bg=True):
    buf = bytearray(size * size * 4)
    for y in range(size):
        if bg:
            t = y / (size - 1)
            r = int(BG_TOP[0] * (1 - t) + BG_BOT[0] * t)
            g = int(BG_TOP[1] * (1 - t) + BG_BOT[1] * t)
            b = int(BG_TOP[2] * (1 - t) + BG_BOT[2] * t)
            row = bytes((r, g, b, 255)) * size
        else:
            row = bytes((0, 0, 0, 0)) * size
        buf[y * size * 4:(y + 1) * size * 4] = row
    return buf


def get_px(buf, size, x, y):
    i = (y * size + x) * 4
    return (buf[i], buf[i + 1], buf[i + 2], buf[i + 3])


def set_px(buf, size, x, y, rgb, a):
    if x < 0 or y < 0 or x >= size or y >= size:
        return
    i = (y * size + x) * 4
    da = buf[i + 3] / 255.0
    out_a = a + da * (1 - a)
    if out_a <= 0:
        return
    dst = (buf[i], buf[i + 1], buf[i + 2])
    # source-over compositing on possibly-transparent dst
    out = tuple(int((rgb[k] * a + dst[k] * da * (1 - a)) / out_a) for k in range(3))
    buf[i], buf[i + 1], buf[i + 2], buf[i + 3] = out[0], out[1], out[2], int(out_a * 255)


def disc(buf, size, cx, cy, r, rgb):
    x0, x1 = int(cx - r - 1), int(cx + r + 1)
    y0, y1 = int(cy - r - 1), int(cy + r + 1)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if d <= r - 1:
                set_px(buf, size, x, y, rgb, 1.0)
            elif d <= r:
                set_px(buf, size, x, y, rgb, r - d)


def points(size):
    return [(px * size, py * size) for px, py in PATH]


def fill_area(buf, size):
    pts = points(size)
    base_y = BASELINE * size
    for x in range(int(pts[0][0]), int(pts[-1][0])):
        # interpolate line y at this x
        ly = None
        for i in range(len(pts) - 1):
            x0, y0 = pts[i]; x1, y1 = pts[i + 1]
            if x0 <= x <= x1 and x1 != x0:
                ly = y0 + (y1 - y0) * (x - x0) / (x1 - x0)
                break
        if ly is None:
            continue
        for y in range(int(ly), int(base_y)):
            t = (y - ly) / max(1.0, (base_y - ly))
            a = 0.32 * (1 - t)  # fade downward
            set_px(buf, size, x, y, GREEN, a)


def stroke_line(buf, size, thickness, dot_r):
    pts = points(size)
    r = thickness / 2.0
    for i in range(len(pts) - 1):
        x0, y0 = pts[i]; x1, y1 = pts[i + 1]
        seg = math.hypot(x1 - x0, y1 - y0)
        steps = max(1, int(seg / 1.2))
        for s in range(steps + 1):
            t = s / steps
            disc(buf, size, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, GREEN)
    for (x, y) in pts:
        disc(buf, size, x, y, dot_r, (235, 255, 245))
        disc(buf, size, x, y, dot_r * 0.55, GREEN_DK)


def write_png(path, size, buf):
    def chunk(typ, data):
        c = struct.pack(">I", len(data)) + typ + data
        return c + struct.pack(">I", zlib.crc32(typ + data) & 0xffffffff)
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        raw += buf[y * size * 4:(y + 1) * size * 4]
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)
    print("wrote", path, os.path.getsize(path), "bytes")


def main():
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    icons = os.path.join(base, "ios/FinanceTracker/Assets.xcassets")

    # App icon — opaque, full bleed (iOS applies its own mask)
    s = 1024
    buf = make_canvas(s, bg=True)
    fill_area(buf, s)
    stroke_line(buf, s, thickness=int(s * 0.028), dot_r=int(s * 0.014))
    write_png(os.path.join(icons, "AppIcon.appiconset/icon-1024.png"), s, buf)

    # Launch logo — transparent background, chart only (single-scale: px == pt)
    s = 256
    buf = make_canvas(s, bg=False)
    fill_area(buf, s)
    stroke_line(buf, s, thickness=int(s * 0.034), dot_r=int(s * 0.018))
    write_png(os.path.join(icons, "LaunchLogo.imageset/launch-logo.png"), s, buf)


if __name__ == "__main__":
    main()
