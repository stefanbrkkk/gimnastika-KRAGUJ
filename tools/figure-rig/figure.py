"""
Technique B generator: a skeleton + tapered-limb "skin" calibrated on the logo's
split-leap silhouette, unioned into ONE filled outline (shapely), filleted at the
joints (morphological closing), simplified and written as compact SVG path data.

Units: logo units (the #leap box is 230 x 150; the figure's leg ~94, arm ~62).
Angles: degrees, screen convention (y down): 0 = right, 90 = down, -90 = up.
"""
import math, json
import numpy as np
from shapely.geometry import Polygon, Point, LineString, MultiPolygon
from shapely.ops import unary_union
from shapely import affinity
from logo_geom import logo_poly

RAD = math.pi / 180

# ---- proportions measured on the logo (logo_geom.py) ----------------------
THIGH, SHIN, FOOT = 47.0, 40.0, 16.5
UPPER, FORE, HAND = 27.0, 24.0, 12.0
SPINE = 63.0   # hip centre -> neck base
NECK = 6.0

def V(a):
    return np.array([math.cos(a * RAD), math.sin(a * RAD)])

def perp(u):
    # "front" normal of a direction pointing from hip to neck when facing +x
    return np.array([-u[1], u[0]])

def strip(pts, halfL, halfR, n_round=True):
    """Polygon around a polyline with per-vertex half widths (left/right of travel)."""
    pts = [np.array(p, float) for p in pts]
    left, right = [], []
    for i, p in enumerate(pts):
        if i == 0:
            d = pts[1] - pts[0]
        elif i == len(pts) - 1:
            d = pts[-1] - pts[-2]
        else:
            d = (pts[i + 1] - pts[i - 1])
        d = d / (np.linalg.norm(d) + 1e-9)
        nl = np.array([d[1], -d[0]])  # left of travel (screen)
        left.append(p + nl * halfL[i])
        right.append(p - nl * halfR[i])
    ring = left + right[::-1]
    return Polygon(ring).buffer(0)

def taper(p0, a, L, w0, w1, prof=None, bias=None, n=10):
    """Tapered segment from p0 along angle a, length L. prof: list of (s, w) overrides.
    bias: list of (s, k) shifting the width toward the left (+k) or right (-k) side."""
    u = V(a)
    ss = np.linspace(0, 1, n)
    if prof:
        xs = [q[0] for q in prof]; ws = [q[1] for q in prof]
        W = np.interp(ss, xs, ws)
    else:
        W = w0 + (w1 - w0) * ss
    B = np.zeros_like(ss)
    if bias:
        B = np.interp(ss, [q[0] for q in bias], [q[1] for q in bias])
    pts = [p0 + u * L * s for s in ss]
    hl = W / 2 + B
    hr = W / 2 - B
    return strip(pts, np.maximum(hl, 0.05), np.maximum(hr, 0.05)), p0 + u * L

def disc(p, r):
    return Point(float(p[0]), float(p[1])).buffer(r, resolution=24)

# ---- the logo's own head, stamped (the face profile is the brand's) --------
_LOGO = logo_poly()
_HEAD_CLIP = Polygon([(99.4, 24), (131, 24), (131, 57.5), (123, 61.5), (107, 62.5), (99.4, 49.5), (99.0, 40)])
HEAD_LOGO = _LOGO.intersection(_HEAD_CLIP)
# the head's own frame in the logo: neck point (bottom centre) and its "up" axis
HEAD_NECK = np.array([111.5, 60.0])
HEAD_AXIS = -81.0  # neck base -> crown in the logo (tilted forward, chin lifted)

def head_at(neck_pt, axis_deg, facing=1, tilt=0.0):
    """The logo head placed so its neck point sits at neck_pt and its axis points axis_deg."""
    g = affinity.translate(HEAD_LOGO, -HEAD_NECK[0], -HEAD_NECK[1])
    if facing < 0:
        g = affinity.scale(g, -1, 1, origin=(0, 0))
        base = 180 - HEAD_AXIS
    else:
        base = HEAD_AXIS
    g = affinity.rotate(g, axis_deg - base + tilt, origin=(0, 0))
    return affinity.translate(g, neck_pt[0], neck_pt[1])

def head_front(neck_pt, axis_deg=-90):
    """A frontal head (cartwheel / straddle): an egg with a small bun on the crown."""
    u = V(axis_deg)
    c = neck_pt + u * 13.0
    e = affinity.scale(Point(0, 0).buffer(1, resolution=32), 10.8, 13.2)
    e = affinity.rotate(e, axis_deg + 90, origin=(0, 0))
    e = affinity.translate(e, c[0], c[1])
    bun = disc(neck_pt + u * 26.5, 4.6)
    return unary_union([e, bun])

# ---- limbs -----------------------------------------------------------------
LEG_PROF_THIGH = [(0, 23.0), (0.12, 20.0), (0.35, 17.2), (0.7, 14.8), (1, 13.0)]
THIGH_BIAS = [(0, 0), (0.3, 0.7), (0.7, 0.3), (1, 0)]
LEG_PROF_SHIN = [(0, 12.8), (0.22, 12.6), (0.5, 10.6), (0.8, 8.4), (1, 7.6)]

LEG_PROF_THIGH_FRONT = [(0, 18.8), (0.2, 17.6), (0.45, 16.0), (0.75, 14.0), (1, 12.6)]

def leg(hip, a_thigh, a_shin, foot="point", a_foot=None, side=1, frontal=False):
    """side: +1 when the knee faces the figure's +x front in its own frame (sets calf side)."""
    parts = []
    th, knee = taper(hip, a_thigh, THIGH, 0, 0, prof=LEG_PROF_THIGH_FRONT if frontal else LEG_PROF_THIGH, bias=None if frontal else [(q[0], q[1] * side) for q in THIGH_BIAS], n=18)
    parts += [th, disc(knee, 6.3)]
    # calf bulge sits on the back of the shin
    sh, ank = taper(knee, a_shin, SHIN, 0, 0, prof=LEG_PROF_SHIN,
                    bias=[(0, 0), (0.25, -0.9 * side), (0.6, -0.3 * side), (1, 0)], n=18)
    parts += [sh, disc(ank, 3.8)]
    if foot == "point":
        af = a_shin + 10 * side if a_foot is None else a_foot
        # slipper foot: broad instep, rounded point (the logo's front foot)
        ft, toe = taper(ank, af, FOOT, 0, 0,
                        prof=[(0, 7.4), (0.3, 8.4), (0.65, 7.4), (0.9, 4.6), (1, 2.4)],
                        bias=[(0, 0), (0.35, 0.6 * side), (1, 0)], n=14)
        parts += [ft, disc(toe - V(af) * 1.0, 1.4)]
    elif foot == "flat":
        af = a_shin - 90 * side if a_foot is None else a_foot  # foot points to the front
        heel = ank - V(af) * 3.5 + V(a_shin) * 3.2
        sole0 = ank + V(a_shin) * 3.5
        ft = Polygon([tuple(ank - V(af) * 3.2), tuple(heel), tuple(sole0 + V(af) * 16.0),
                      tuple(ank + V(af) * 17.5 + V(a_shin) * 1.2), tuple(ank + V(af) * 5 - V(a_shin) * 3.2)]).buffer(0)
        parts += [ft.buffer(1.2).buffer(-1.2), disc(heel, 2.6), disc(sole0 + V(af) * 15.2, 2.0)]
        toe = sole0 + V(af) * 16
    elif foot == "front":  # standing, seen from the front: short, widening to the toes
        af = a_shin if a_foot is None else a_foot
        ft, toe = taper(ank, af, 9.5, 0, 0, prof=[(0, 7.4), (0.5, 8.2), (0.85, 8.4), (1, 5.0)], n=8)
        parts += [ft]
    elif foot == "flex":  # toes on the floor (push-up): short foot bent up
        af = a_shin - 70 * side if a_foot is None else a_foot
        ft, toe = taper(ank, af, 12, 0, 0, prof=[(0, 7.4), (0.5, 7.2), (1, 3.4)])
        parts += [ft, disc(toe - V(af) * 1.5, 1.8)]
    return unary_union(parts), knee, ank, toe

ARM_PROF_UP = [(0, 13.0), (0.2, 11.4), (0.6, 10.0), (1, 8.8)]
ARM_PROF_FORE = [(0, 8.6), (0.25, 8.6), (0.7, 7.0), (1, 6.0)]

def arm(sh, a_up, a_fore, a_hand=None, hand="flat", side=1):
    parts = []
    up, el = taper(sh, a_up, UPPER, 0, 0, prof=ARM_PROF_UP, n=14)
    parts += [up, disc(el, 4.2), disc(sh, 5.4)]
    fo, wr = taper(el, a_fore, FORE, 0, 0, prof=ARM_PROF_FORE, n=14)
    parts += [fo, disc(wr, 2.9)]
    ah = a_fore if a_hand is None else a_hand
    if hand == "flat":
        hd, tip = taper(wr, ah, HAND, 0, 0, prof=[(0, 6.0), (0.3, 7.8), (0.7, 6.4), (1, 2.0)], n=12)
        parts += [hd]
    elif hand == "fist":  # gripping a bar: a round fist
        tip = wr + V(ah) * 4.5
        parts += [disc(tip, 4.4)]
    elif hand == "none":  # the hand is added by the caller (e.g. a rail grip)
        tip = wr
    elif hand == "palm":  # flat on the floor: the hand turned 90 deg to the forearm
        hd, tip = taper(wr + V(a_fore) * 1.5, ah, HAND, 0, 0, prof=[(0, 5.6), (0.4, 5.4), (0.8, 4.0), (1, 1.8)])
        parts += [hd, disc(wr + V(a_fore) * 1.2, 3.2)]
    return unary_union(parts), el, wr, tip

# ---- torso -----------------------------------------------------------------
# side view: half-width to the back (b) and to the front (f) along the spine, hip (0) -> neck (1)
TORSO_SIDE = [  # s, back, front
    (0.00, 12.5, 10.0),
    (0.12, 12.8, 10.6),
    (0.30, 11.4, 11.6),
    (0.48, 11.0, 12.8),
    (0.64, 11.8, 13.8),
    (0.80, 11.6, 13.0),
    (0.92, 9.5, 9.5),
    (1.00, 5.8, 5.2),
]

def spine_curve(hip, a_low, a_high, n=24):
    """Smooth spine: quadratic Bezier hip -> neck base, bending from a_low to a_high."""
    L = SPINE
    p0 = np.array(hip, float)
    c = p0 + V(a_low) * L * 0.5
    p2 = c + V(a_high) * L * 0.5
    ts = np.linspace(0, 1, n)
    pts = [(1 - t) ** 2 * p0 + 2 * (1 - t) * t * c + t * t * p2 for t in ts]
    return pts

def pelvis(hip, a_low, facing=1):
    """The pelvis/seat mass under the torso (fills the crotch between the thigh roots)."""
    u = V(a_low); f = perp(u) * facing
    c = np.array(hip, float) - u * 2.5 - f * 1.0
    e = affinity.scale(Point(0, 0).buffer(1, resolution=24), 12.6, 10.5)
    e = affinity.rotate(e, a_low + 90, origin=(0, 0))
    return affinity.translate(e, c[0], c[1])

def torso_side(hip, a_low, a_high, facing=1, prof=TORSO_SIDE):
    pts = spine_curve(hip, a_low, a_high)
    ss = np.linspace(0, 1, len(pts))
    b = np.interp(ss, [q[0] for q in prof], [q[1] for q in prof])
    f = np.interp(ss, [q[0] for q in prof], [q[2] for q in prof])
    # strip(): "left of travel" for travel hip->neck facing +x is the FRONT when the body is upright
    # (travel up (0,-1): left = (d_y, -d_x) = (-1, 0) -> that is the back). So left = back.
    if facing > 0:
        g = strip(pts, b, f)
    else:
        g = strip(pts, f, b)
    return unary_union([g, pelvis(hip, a_low, facing)]), pts

def torso_front(hip, a):
    """Frontal torso (cartwheel, straddle, salute): hips, waist, lats, sloped shoulders."""
    L = SPINE
    u = V(a)
    ss = np.array([0, 0.1, 0.25, 0.42, 0.6, 0.76, 0.86, 0.92, 0.97, 1.0])
    ws = np.array([32.0, 31.5, 27.5, 23.6, 25.4, 28.6, 30.8, 27.0, 16.0, 11.0])
    pts = [np.array(hip) + u * L * s for s in ss]
    g = strip(pts, ws / 2, ws / 2)
    c = np.array(hip) - u * 1.5
    return unary_union([g, Point(*c).buffer(13.0, resolution=24)]), pts

# ---- assembly ----------------------------------------------------------------
def smooth_ring(coords, step=0.35, sigma=1.1):
    """Resample a closed ring every `step` units and smooth it (Gaussian, sigma in units)."""
    c = np.array(coords[:-1] if tuple(coords[0]) == tuple(coords[-1]) else coords, float)
    seg = np.diff(np.vstack([c, c[:1]]), axis=0)
    L = np.hypot(seg[:, 0], seg[:, 1])
    cum = np.concatenate([[0], np.cumsum(L)])
    total = cum[-1]
    n = max(16, int(total / step))
    t = np.linspace(0, total, n, endpoint=False)
    cc = np.vstack([c, c[:1]])
    x = np.interp(t, cum, cc[:, 0]); y = np.interp(t, cum, cc[:, 1])
    k = int(max(1, round(3 * sigma / step)))
    w = np.exp(-0.5 * ((np.arange(-k, k + 1) * step) / sigma) ** 2); w /= w.sum()
    xs = np.array([np.dot(w, np.take(x, range(i - k, i + k + 1), mode="wrap")) for i in range(n)])
    ys = np.array([np.dot(w, np.take(y, range(i - k, i + k + 1), mode="wrap")) for i in range(n)])
    return list(zip(xs, ys))

def smooth_geom(g, sigma=1.1):
    polys = list(g.geoms) if isinstance(g, MultiPolygon) else [g]
    out = []
    for p in polys:
        if p.area < 4:
            continue
        ext = smooth_ring(list(p.exterior.coords), sigma=sigma)
        holes = [smooth_ring(list(r.coords), sigma=sigma) for r in p.interiors if Polygon(r).area > 3]
        out.append(Polygon(ext, holes).buffer(0))
    return unary_union(out)

BRUSH = {"amp": 0.16, "seed": 7}

def brush_ring(coords, amp, seed, step=0.9):
    c = np.array(coords[:-1], float)
    seg = np.diff(np.vstack([c, c[:1]]), axis=0)
    L = np.hypot(seg[:, 0], seg[:, 1]); cum = np.concatenate([[0], np.cumsum(L)]); total = cum[-1]
    n = max(16, int(total / step)); t = np.linspace(0, total, n, endpoint=False)
    cc = np.vstack([c, c[:1]])
    x = np.interp(t, cum, cc[:, 0]); y = np.interp(t, cum, cc[:, 1])
    dx = np.roll(x, -1) - np.roll(x, 1); dy = np.roll(y, -1) - np.roll(y, 1)
    nl = np.hypot(dx, dy) + 1e-9; nx, ny = dy / nl, -dx / nl
    rng = np.random.default_rng(seed)
    w = np.zeros(n)
    for wl in (9.0, 16.0, 27.0):  # wavelengths in units, like the tracer's 1-3 unit segments strung together
        k = max(1, round(total / wl))
        w += np.sin(2 * np.pi * k * t / total + rng.uniform(0, 2 * np.pi)) * rng.uniform(0.6, 1.0)
    w = w / (np.abs(w).max() + 1e-9) * amp
    return list(zip(x + nx * w, y + ny * w))

def brush_geom(g, amp, seed):
    polys = list(g.geoms) if isinstance(g, MultiPolygon) else [g]
    out = []
    for i, p in enumerate(polys):
        ext = brush_ring(list(p.exterior.coords), amp, seed + i)
        holes = [brush_ring(list(r.coords), amp, seed + 50 + i) for r in p.interiors]
        out.append(Polygon(ext, holes).buffer(0))
    return unary_union(out)

def finish(parts, close=1.8, open_=0.4, sigma=1.1):
    g = unary_union([p for p in parts if p is not None and not p.is_empty])
    g = g.buffer(close, resolution=16).buffer(-close, resolution=16)   # fillets at joints (armpits, crotch)
    if open_:
        g = g.buffer(-open_, resolution=16).buffer(open_, resolution=16)  # no hairline spikes
    if sigma:
        g = smooth_geom(g, sigma)
    g = fill_small_holes(g, 60.0)
    if BRUSH["amp"]:
        g = brush_geom(g, BRUSH["amp"], BRUSH["seed"])
    return g

def fill_small_holes(g, max_area):
    polys = list(g.geoms) if isinstance(g, MultiPolygon) else [g]
    out = []
    for p in polys:
        keep = [r for r in p.interiors if Polygon(r).area > max_area]
        out.append(Polygon(p.exterior, keep))
    return unary_union(out)

def hip_for(H, front, up, a_thigh, spread=8.0):
    """Leg root: slides toward the thigh's direction (the logo's wide pelvis in a split)."""
    d = V(a_thigh)
    return H + front * spread * float(np.dot(d, front)) + up * 1.0

def to_path(g, tol=0.12, prec=1):
    """Shapely polygon(s) -> compact SVG path (relative lineto, 1 decimal, like the sprite's svgo)."""
    g = g.simplify(tol, preserve_topology=True)
    polys = list(g.geoms) if isinstance(g, MultiPolygon) else [g]
    out = []
    f = lambda v: (f"{v:.{prec}f}").rstrip("0").rstrip(".") if "." in f"{v:.{prec}f}" else f"{v:.{prec}f}"
    def fmt(v):
        s = f"{round(v, prec):.{prec}f}"
        if "." in s:
            s = s.rstrip("0").rstrip(".")
        if s.startswith("0."):
            s = s[1:]
        elif s.startswith("-0."):
            s = "-" + s[2:]
        return "0" if s in ("", "-0", "-") else s
    for p in polys:
        for ring in [p.exterior] + list(p.interiors):
            cs = list(ring.coords)[:-1]
            q = [(round(x, prec), round(y, prec)) for x, y in cs]
            d = f"M{fmt(q[0][0])} {fmt(q[0][1])}l"
            parts = []
            for (x0, y0), (x1, y1) in zip(q, q[1:]):
                dx, dy = x1 - x0, y1 - y0
                if abs(dx) < 1e-9 and abs(dy) < 1e-9:
                    continue
                a, b = fmt(dx), fmt(dy)
                parts.append(a + ("" if b.startswith("-") else " ") + b)
            s = ""
            for t in parts:
                s += t if (not s or t.startswith("-")) else " " + t
            out.append(d + s + "z")
    return "".join(out)

def bbox(g):
    return [round(v, 1) for v in g.bounds]
