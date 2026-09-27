"""The club logo's leaping gymnast as a shapely polygon, in #leap box units (230 x 150).

Reads LEAP_PATH and LEAP_VIEWBOX from components/brand/sprite-paths.generated.ts (written by
scripts/svg.mjs from assets-source/logo/kraguj-silueta.svg), relative to the repository, so the
rig always calibrates on the path the site ships. figure.py stamps the logo's own profile head
from it; running this file prints the limb widths the rig's proportions were measured from.
"""
import json
import os
import re

import numpy as np
from svgelements import Path, Move, Close
from shapely.geometry import Polygon, LineString, Point

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SPRITE = os.path.join(REPO, "components", "brand", "sprite-paths.generated.ts")


def _read_sprite():
    src = open(SPRITE, encoding="utf8").read()
    path = re.search(r'export const LEAP_PATH = ("(?:[^"\\]|\\.)*");', src)
    box = re.search(r"export const LEAP_VIEWBOX = \{ x: ([\d.]+), y: ([\d.]+),", src)
    if not path or not box:
        raise RuntimeError(f"LEAP_PATH / LEAP_VIEWBOX not found in {SPRITE} (run npm run svg)")
    return json.loads(path.group(1)), float(box.group(1)), float(box.group(2))


LEAP, LEAP_X, LEAP_Y = _read_sprite()


def path_to_polys(d, step=0.4, dx=0, dy=0):
    p = Path(d)
    rings = []
    cur = []
    for seg in p:
        if isinstance(seg, Move):
            if len(cur) > 2:
                rings.append(cur)
            cur = [(seg.end.x + dx, seg.end.y + dy)]
            continue
        if isinstance(seg, Close):
            if len(cur) > 2:
                rings.append(cur)
            cur = []
            continue
        L = seg.length(error=1e-3) if hasattr(seg, "length") else 1
        n = max(1, int(L / step))
        for i in range(1, n + 1):
            q = seg.point(i / n)
            cur.append((q.x + dx, q.y + dy))
    if len(cur) > 2:
        rings.append(cur)
    return rings


def logo_poly():
    """The leap silhouette in #leap box units (the logo path moved by -LEAP_VIEWBOX.x/y)."""
    rings = path_to_polys(LEAP, dx=-LEAP_X, dy=-LEAP_Y)
    polys = [Polygon(r).buffer(0) for r in rings]
    # evenodd: largest outer, subtract holes
    polys.sort(key=lambda p: -p.area)
    g = polys[0]
    for h in polys[1:]:
        g = g.symmetric_difference(h)
    return g


if __name__ == "__main__":
    g = logo_poly()
    print("area", round(g.area, 1), "bounds", [round(v, 1) for v in g.bounds], "rings", len(path_to_polys(LEAP)))

    def widths(a, b, stations):
        """Ink width perpendicular to the segment a -> b at each station (0..1 along it)."""
        a = np.array(a, float)
        b = np.array(b, float)
        d = b - a
        L = np.linalg.norm(d)
        u = d / L
        n = np.array([-u[1], u[0]])
        out = []
        for s in stations:
            c = a + u * L * s
            ln = LineString([c - n * 30, c + n * 30]).intersection(g)
            parts = [ln] if ln.geom_type == "LineString" else list(getattr(ln, "geoms", []))
            w = None
            for pp in parts:
                if pp.distance(Point(c)) < 0.5:
                    w = pp.length
            out.append((round(s, 2), round(L * s, 1), None if w is None else round(w, 1)))
        return out

    print("front leg", widths((131, 125.1), (222.7, 146.7), [0.1, 0.2, 0.3, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95]))
    print("back leg", widths((92.5, 126.25), (2.1, 108.2), [0.1, 0.2, 0.3, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95]))
    print("front arm", widths((124, 68), (186, 52), [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95]))
    print("back arm", widths((95, 57), (73, 3), [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95]))
    print("torso", widths((111, 125), (111, 30), [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95]))
