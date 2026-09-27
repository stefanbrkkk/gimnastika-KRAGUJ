"""
The approved pose family (P1-P8 + P2s) -> assets-source/poses/<id>.svg.
Run: python final_poses.py [out_dir]   (default: the repo's assets-source/poses)

Built with the prototype generator (figure.py + poses_b.py helpers): calibrated skeleton, the
logo's own profile head (side poses), a refined frontal head (frontal poses), limb taper from the
logo, pointed slipper feet, exact floor/apparatus contact computed from the final outline.

Units: logo units at the logo's body scale (the #leap box is 230 x 150), so every pose has the
same body size as the logo figure. Each file's viewBox starts at 0 0; anchors are data attributes.
"""
import math, os, sys
import numpy as np
from shapely import affinity
from shapely.geometry import Polygon, Point, LineString, MultiPolygon, box
from shapely.ops import unary_union

import figure as F
import poses_b as PB  # helpers: side_figure, front_figure, ik2, shoulder_for, settle ...
from figure import V, perp, taper, disc, strip, finish, to_path, THIGH, SHIN, UPPER, FORE, HAND

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
TOL = float(os.environ.get("POSE_TOL", "0.22"))
# no brush wobble: poses are capped at 200 px (plan §9), where 0.16 units is < 0.25 px -- it only costs bytes
F.BRUSH["amp"] = float(os.environ.get("POSE_BRUSH", "0"))
PAD = 2.0

# ------------------------------------------------------------------ refined frontal head
def head_front2(neck_pt, axis_deg=-90):
    """Frontal head in the logo head's size (crown->chin 28, width ~21.6 with hair): a cranium
    widest at the temples, a jaw that tapers to a small chin, hair pulled back into a bun that
    shows only as a low cap above the crown; the neck is part of it (so the head sits, not floats)."""
    u = V(axis_deg); r = perp(u)
    base = np.array(neck_pt, float)
    # right half profile (r, u) from the chin up; neck from 0 to 6
    half = [(0.0, 6.2), (3.2, 6.7), (6.0, 8.6), (8.4, 11.8), (9.9, 15.6), (10.7, 19.6), (10.9, 23.0),
            (10.4, 26.8), (9.0, 30.0), (6.8, 32.4), (3.6, 33.8), (0.0, 34.2)]
    pts = [(-x, y) for x, y in reversed(half)] + [(x, y) for x, y in half[1:-1]]
    ring = [tuple(base + r * x + u * y) for x, y in pts]
    head = Polygon(ring).buffer(0)
    neck = Polygon([tuple(base + r * -5.4 + u * -1.0), tuple(base + r * 5.4 + u * -1.0),
                    tuple(base + r * 4.7 + u * 9.0), tuple(base + r * -4.7 + u * 9.0)])
    bun = Point(*(base + u * 34.3)).buffer(3.9, resolution=24)
    g = unary_union([head, neck, bun])
    return g.buffer(0.9, resolution=16).buffer(-0.9, resolution=16)


PB.head_front = head_front2  # front_figure() looks the head up in poses_b's namespace


def front_figure(H, a, legs, arms, arm_scale=1.0):
    """poses_b.front_figure, with the frontal head placed one unit lower (neck merges)."""
    return PB.front_figure(H, a, legs, arms)


def mirror_symmetric(g, x0=0.0):
    """Exact bilateral symmetry: keep the right half (x >= x0) and mirror it."""
    b = g.bounds
    right = g.intersection(box(x0, b[1] - 5, b[2] + 5, b[3] + 5))
    left = affinity.scale(right, -1, 1, origin=(x0, 0))
    return unary_union([right, left]).buffer(0.05).buffer(-0.05)


def ring_pts(g):
    polys = list(g.geoms) if isinstance(g, MultiPolygon) else [g]
    return [np.array(p.exterior.coords) for p in polys]


def contact_below(g, near, radius=9.0):
    """The lowest ink near `near` (x within radius): returns (x, y) on the ink edge."""
    pts = np.vstack(ring_pts(g))
    sel = pts[np.abs(pts[:, 0] - near[0]) <= radius]
    y = sel[:, 1].max()
    xs = sel[sel[:, 1] >= y - 0.25][:, 0]
    return (float(xs.mean()), float(y))


def edge_point(g, p):
    """Nearest point on the ink outline to p."""
    q = g.exterior.interpolate(g.exterior.project(Point(*p))) if g.geom_type == "Polygon" else None
    return (q.x, q.y)


POSES = {}


def put(pid, g, floor=None, contacts=None, note=""):
    """Normalise to a 0-origin viewBox with PAD, round, store."""
    b = g.bounds
    dx, dy = -b[0] + PAD, -b[1] + PAD
    g2 = affinity.translate(g, dx, dy)
    W = math.ceil((b[2] - b[0] + 2 * PAD) * 10) / 10
    Hh = math.ceil((b[3] - b[1] + 2 * PAD) * 10) / 10
    # origin: the translation from rig coordinates to the file's viewBox (exercises.py draws every
    # frame of an exercise in its final pose's file coordinates)
    rec = {"d": to_path(g2, tol=TOL), "vb": [0, 0, W, Hh], "note": note, "geom": g2, "origin": (dx, dy)}
    if floor is not None:
        rec["floor"] = round(g2.bounds[3], 1)
    if contacts:
        rec["contacts"] = {k: (round(x + dx, 1), round(y + dy, 1)) for k, (x, y) in contacts.items()}
    POSES[pid] = rec


# ================================================================== P1 star: straddle jump, arms V
def star():
    legs = [dict(s=-1, thigh=161, shin=162, side=1, af=167), dict(s=1, thigh=19, shin=18, side=-1, af=13)]
    arms = [dict(s=-1, up=-138, fore=-140), dict(s=1, up=-42, fore=-40)]
    g, J = front_figure((0, 0), -90, legs, arms)
    return mirror_symmetric(g, 0.0), J


g, J = star()
put("star", g, note="P1 raznožni skok (in the air: no floor)")

# ================================================================== P2 cartwheel: inverted star
def cart_inverted(t=0.0):
    legs = [dict(s=1, thigh=-133 + t, shin=-133 + t, side=1), dict(s=-1, thigh=-47 + t, shin=-47 + t, side=-1)]
    arms = [dict(s=1, up=113 + t, fore=113 + t, hand="palm", ah=180 + t), dict(s=-1, up=67 + t, fore=67 + t, hand="palm", ah=0 + t)]
    return front_figure((0, 0), 90 + t, legs, arms)


def hands_level(build, lo=-6, hi=6):
    return PB.settle(build, ("wr0", "wr1"), lo, hi)


g, J = cart_inverted()
g = mirror_symmetric(g, 0.0)
hl = contact_below(g, J["wr0"]); hr = contact_below(g, J["wr1"])
put("cartwheel", g, floor=True, contacts={"handL": min(hl, hr), "handR": max(hl, hr)}, note="P2 zvezda (inverted star; hands on the floor or beam)")

# ================================================================== P2s cartwheel phases -> P6
def cart_phase1():
    # the start: arms up, the lead (right) leg lifted toward the travel direction; standing on the left foot
    legs = [dict(s=-1, thigh=93, shin=93, foot="front", side=1), dict(s=1, thigh=40, shin=38, side=-1, af=33)]
    arms = [dict(s=-1, up=-106, fore=-104), dict(s=1, up=-58, fore=-56)]
    return front_figure((0, 0), -85, legs, arms)


def cart_phase2():
    # passing through the handstand: hands level on the floor, the legs already rotating over
    # toward the travel direction (right), so the frame shows direction (P2 is the still emblem)
    legs = [dict(s=1, thigh=-119, shin=-119, side=1), dict(s=-1, thigh=-31, shin=-31, side=-1)]
    arms = [dict(s=1, up=113, fore=113, hand="palm", ah=180), dict(s=-1, up=67, fore=67, hand="palm", ah=0)]
    return front_figure((0, 0), 90, legs, arms)


def cart_phase3(trail=146.0, lead_dx=26.0, tilt=-97.0):
    """The landing lunge: the front (lead) foot down with the knee bent over it, the trailing leg
    stretched behind to a pointed toe on the floor, arms still high beside the ears, the torso
    still coming upright out of the wheel (tilted back toward the hands). Both supports on the
    floor, so it can never read as the salute (legs together) or the start (one foot down)."""
    u = V(tilt); r = perp(u)
    H = np.array([0.0, 0.0])
    # trailing leg (her left, image left): straight, toe on the floor
    hip_t = H + r * -7.5 - u * 1.0
    g_t, knee_t, ank_t, toe_t = F.leg(hip_t, trail, trail, "point", None, -1, frontal=True)
    floor = float(max(y for x, y in g_t.exterior.coords))
    # lead leg (image right): foot flat on the same floor, knee bent out toward the travel side
    hip_l = H + r * 7.5 - u * 1.0
    ank_target = (hip_l[0] + lead_dx, floor - 9.0)
    th, sh = PB.ik2(hip_l, ank_target, F.THIGH, F.SHIN, bend=1)
    legs = [dict(s=-1, thigh=trail, shin=trail, side=-1), dict(s=1, thigh=th, shin=sh, foot="front", side=1)]
    arms = [dict(s=-1, up=tilt - 24, fore=tilt - 22), dict(s=1, up=tilt + 26, fore=tilt + 24)]
    return front_figure((0, 0), tilt, legs, arms)


g1, J1 = cart_phase1()
put("cart1", g1, floor=True, contacts={"foot": contact_below(g1, J1["ank0"], 6)}, note="P2s 1/3 start")
g2, J2 = cart_phase2()
a = contact_below(g2, J2["wr0"]); b_ = contact_below(g2, J2["wr1"])
put("cart2", g2, floor=True, contacts={"handL": min(a, b_), "handR": max(a, b_)}, note="P2s 2/3 inverted")
g3, J3 = cart_phase3()
put("cart3", g3, floor=True, contacts={"foot": contact_below(g3, J3["ank1"], 7), "toe": contact_below(g3, J3["toe0"], 4)}, note="P2s 3/3 landing lunge")

# ================================================================== P3 barHandstand
def grip_hand(wr, fore_deg, fingers_to):
    """Hand on top of a rail: palm along the rail top, fingers hooking down the far side."""
    d = V(fingers_to)
    down = V(fore_deg)
    palm0 = wr + down * 2.2
    palm = strip([palm0 - d * 1.5, palm0 + d * 5.0], [2.6, 2.4], [2.6, 2.4])
    hook = LineString([tuple(palm0 + d * 4.6), tuple(palm0 + d * 7.0 + down * 1.2), tuple(palm0 + d * 7.2 + down * 3.6)]).buffer(1.55, cap_style=1)
    return unary_union([palm, hook, disc(wr + down * 0.6, 3.1)])


def bar_handstand():
    # straight handstand, hollow-free line, head neutral (eyes to the hands), both hands on the rail
    legs = [dict(thigh=-90, shin=-90, side=1), dict(thigh=-90.5, shin=-90.5, side=1)]
    arms = [dict(up=90, fore=90, hand="none"), dict(up=90, fore=90, hand="none")]
    _, J = PB.side_figure((0, 0), 90, 90, legs, arms, head_tilt=12)
    # rail grips (fingers toward the chest side = -x), skinned with the body in one finish
    grip = grip_hand(np.array(J["wr0"]), 90, 180)
    return PB.side_figure((0, 0), 90, 90, legs, arms, head_tilt=12, parts_extra=[grip])


g, J = bar_handstand()
wr = np.array(J["wr0"])
palm_bottom = (float(wr[0] - 1.0), float(wr[1] + 2.2 + 2.5))
# the anchor: the palm's contact with the rail top (nearest ink edge point)
put("barHandstand", g, contacts={"hand": edge_point(g, palm_bottom)}, note="P3 stoj na pritci (rail top at the hand anchor)")

# ================================================================== P4 vault: handspring, hands on the table
def vault():
    legs = [dict(thigh=-72, shin=-71, side=1), dict(thigh=-73, shin=-72, side=1)]
    arms = [dict(up=101, fore=101, hand="palm", ah=192), dict(up=100, fore=100, hand="palm", ah=191)]
    return PB.side_figure((0, 0), 106, 103, legs, arms, head_tilt=10)


g, J = vault()
put("vault", g, contacts={"hand": contact_below(g, J["wr0"], 7)}, note="P4 premet (hands on the table top)")

# ================================================================== P5 highKick toward 170 deg
def high_kick():
    # ~166 deg between the legs: at 170 the kicking thigh merges with the chest in profile and the
    # leg reads as a raised arm; both arms go behind so the leg is the only limb in front of the face
    legs = [dict(thigh=90, shin=90, foot="flat", side=1), dict(thigh=-76, shin=-77, side=1, af=-90, spread=5)]
    arms = [dict(up=-148, fore=-150, ah=-154), dict(up=175, fore=177, ah=181)]
    return PB.side_figure((0, 0), -101, -103, legs, arms, head_tilt=-4, spread=3)


g, J = high_kick()
put("highKick", g, floor=True, contacts={"foot": contact_below(g, J["ank0"], 12)}, note="P5 visoki zamah (~166 deg)")

# ================================================================== P6 salute: frontal V
def salute():
    legs = [dict(s=-1, thigh=89.2, shin=90.6, foot="front", side=1), dict(s=1, thigh=90.8, shin=89.4, foot="front", side=1)]
    arms = [dict(s=-1, up=-127, fore=-125), dict(s=1, up=-53, fore=-55)]
    g, J = PB.front_figure((0, 0), -90, legs, arms, close=0.9)
    return mirror_symmetric(g, 0.0), J


g, J = salute()
put("salute", g, floor=True, note="P6 pozdrav")

# ================================================================== P7 scale: longer arms, flat foot
def scale():
    k = 1.08
    F.UPPER, F.FORE = 27.0 * k, 24.0 * k
    try:
        legs = [dict(thigh=90, shin=90, foot="flat", side=1), dict(thigh=197, shin=199, side=-1, af=206)]
        arms = [dict(up=-10, fore=-11, ah=-13), dict(up=-152, fore=-154, ah=-152)]
        return PB.side_figure((0, 0), -40, -19, legs, arms, head_tilt=-16)
    finally:
        F.UPPER, F.FORE = 27.0, 24.0


g, J = scale()
put("scale", g, floor=True, contacts={"foot": contact_below(g, J["ank0"], 12)}, note="P7 vaga (flat support foot)")

# ================================================================== P8 beamHandstand: split handstand
def beam_handstand():
    legs = [dict(thigh=-90 - 58, shin=-90 - 58, side=1), dict(thigh=-90 + 54, shin=-90 + 54, side=1)]
    arms = [dict(up=90, hand="palm", ah=180), dict(up=90, hand="palm", ah=180)]
    return PB.side_figure((0, 0), 90, 90, legs, arms, head_tilt=12)


g, J = beam_handstand()
put("beamHandstand", g, floor=True, contacts={"hand": contact_below(g, J["wr0"], 7)}, note="P8 stoj u raskoraku na gredi")


# ------------------------------------------------------------------ write
def svg_source(pid, rec):
    attrs = [f'data-pose="{pid}"']
    if "floor" in rec:
        attrs.append(f'data-floor="{rec["floor"]:g}"')
    for k, (x, y) in (rec.get("contacts") or {}).items():
        kebab = "".join("-" + c.lower() if c.isupper() else c for c in k)
        attrs.append(f'data-{kebab}="{x:g},{y:g}"')
    vb = " ".join(f"{v:g}" for v in rec["vb"])
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" {" ".join(attrs)}><path fill="currentColor" d="{rec["d"]}"/></svg>\n'


if __name__ == "__main__":
    import gzip
    OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "assets-source", "poses")
    os.makedirs(OUT, exist_ok=True)
    for pid, rec in POSES.items():
        s = svg_source(pid, rec)
        open(os.path.join(OUT, f"{pid}.svg"), "w").write(s)
        print(f"{pid:14s} raw {len(s):5d}  gz {len(gzip.compress(s.encode(), 9)):4d}  vb {rec['vb'][2]}x{rec['vb'][3]}  floor {rec.get('floor')}  {rec.get('contacts') or ''}")
