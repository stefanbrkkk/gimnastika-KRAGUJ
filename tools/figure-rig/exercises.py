"""
Scroll-scrubbed exercises: each program figure as a FLIPBOOK of one continuous movement that ends
exactly in its approved pose -> assets-source/exercises/<id>.json (scripts/exercises.mjs turns them
into components/brand/exercises/<id>.generated.ts).

Every frame is built by the same rig as the approved family (final_poses.py: side_figure /
front_figure, the same heads, finish() and brush settings) from rig parameters interpolated between
key phases; the key phases that ARE approved poses are the approved geometry itself, and the last
frame is the final pose (same builder + parameters => the same path data).

Coordinates: every frame of an exercise is in its FINAL pose's own file coordinates (the pose's
0-origin + PAD viewBox, assets-source/poses/<pose>.svg). Earlier frames may lie outside that box
(a run-up, a start further along the beam); the site draws them in the pose's nested
<svg overflow="visible">, so its placement code does not change.

Run: python exercises.py [id ...]   (default: all; writes the repo's assets-source/exercises)
"""
import json
import math
import os
import sys

import numpy as np
from shapely import affinity
from shapely.geometry import MultiPolygon

import final_poses as FP  # builds the approved family at import: TOL, BRUSH off, the frontal head
import figure as F
import poses_b as PB
from figure import V, to_path

REPO = FP.REPO
OUT = os.path.join(REPO, "assets-source", "exercises")

# Precision of the in-between frames: they are drawn at <= ~0.8 px per pose unit on the site (a
# card draws the 230-unit logo box at 35 of 48 icon units of a <= 176 px drawing: 0.56 px/unit;
# the band 0.64 px/unit; the coach plate ~0.78 px/unit), so whole units and a coarser simplification
# stay under half a pixel. Key frames and the final frame keep the approved precision (TOL, 0.1).
MID_TOL = 0.5
MID_PREC = 0


# ------------------------------------------------------------------ interpolation
def ease(t, kind="io"):
    if kind == "lin":
        return t
    if kind == "in":
        return t * t
    if kind == "out":
        return 1 - (1 - t) * (1 - t)
    if kind == "io":
        return t * t * (3 - 2 * t)
    raise ValueError(kind)


def lerp(a, b, t, sw=0.5):
    """Interpolate two parameter trees: numbers linearly (exact at t = 0 and 1), anything else
    (foot / hand types, flags) switches from a to b at t >= sw."""
    if type(a) is not type(b) and not (isinstance(a, (int, float)) and isinstance(b, (int, float))):
        return b if t >= sw else a
    if isinstance(a, dict):
        assert set(a) == set(b), (sorted(a), sorted(b))
        return {k: lerp(a[k], b[k], t, sw) for k in a}
    if isinstance(a, (list, tuple)):
        assert len(a) == len(b)
        return [lerp(x, y, t, sw) for x, y in zip(a, b)]
    if isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool):
        return a * (1 - t) + b * t
    return b if t >= sw else a


# ------------------------------------------------------------------ geometry helpers
def polys(g):
    return list(g.geoms) if isinstance(g, MultiPolygon) else [g]


def ink_pts(g):
    return np.vstack([np.array(p.exterior.coords) for p in polys(g)])


def snap_y(g, y):
    """Translate so the lowest ink lies exactly on y."""
    return affinity.translate(g, 0, y - g.bounds[3])


def shift_path(d, dx, dy):
    """Move every subpath start (M x y) of a to_path() string by (dx, dy) (multiples of 0.1): the
    relative drawing is untouched, so a key frame IS the approved path, only placed elsewhere."""
    out = []
    for chunk in d.split("M")[1:]:
        head, rest = chunk.split("l", 1)
        x, y = (float(v) for v in head.split(" "))
        out.append(f"M{fmt1(x + dx)} {fmt1(y + dy)}l{rest}")
    return "".join(out)


def fmt1(v):
    s = f"{round(v, 1):.1f}"
    s = s.rstrip("0").rstrip(".")
    if s.startswith("0."):
        s = s[1:]
    elif s.startswith("-0."):
        s = "-" + s[2:]
    return "0" if s in ("", "-0", "-") else s


def path_points(d):
    """Absolute vertices of a to_path() string (M x y l dx dy ... z, one subpath per ring)."""
    import re
    rings = []
    for sub in re.findall(r"M[^M]*", d):
        nums = [float(v) for v in re.findall(r"-?(?:\d+\.?\d*|\.\d+)", sub)]
        x, y = nums[0], nums[1]
        pts = [(x, y)]
        for i in range(2, len(nums), 2):
            x += nums[i]
            y += nums[i + 1]
            pts.append((x, y))
        rings.append(pts)
    return rings


def grid(v):
    """Round to the 0.1 grid (key-pose placements: the approved relative path is kept verbatim)."""
    return round(v * 10) / 10


# ------------------------------------------------------------------ frames
class Frame:
    def __init__(self, g=None, d=None, key=None, exact=None, note=""):
        self.g = g          # geometry in the exercise's file coordinates (in-between / new key frames)
        self.d = d          # raw path (approved key poses: the approved string, placed)
        self.key = key      # key phase name, or None
        self.exact = exact  # approved pose id this key frame equals, or None
        self.note = note

    def path(self):
        if self.d is not None:
            return self.d
        if self.key:
            return to_path(self.g, tol=FP.TOL)
        return to_path(self.g, tol=MID_TOL, prec=MID_PREC)


def to_file(g, pose):
    """Rig coordinates of the final pose -> its file coordinates (put()'s own translation)."""
    dx, dy = FP.POSES[pose]["origin"]
    return affinity.translate(g, dx, dy)


def approved_frame(pid, key, at=(0.0, 0.0)):
    """The approved pose `pid`, its file origin placed at `at` (0.1 grid) of the exercise."""
    ax, ay = grid(at[0]), grid(at[1])
    d = FP.POSES[pid]["d"]
    return Frame(d=shift_path(d, ax, ay) if (ax or ay) else d, key=key, exact=pid), (ax, ay)


def segment(build, a, b, ts, kind="io", sw=0.5, post=None, note=""):
    """In-between frames from key params a -> b at the given (un-eased) times."""
    out = []
    for t in ts:
        p = lerp(a, b, ease(t, kind), sw)
        g = build(p)
        if post:
            g = post(g, p, t)
        out.append(Frame(g=g, note=note))
    return out


# ------------------------------------------------------------------ constrained figures
# A pose is a parameter tree: H (hip), the torso angle(s), legs and arms as bone angles, or an
# "ik" target (ankle / wrist) with a bend side, so a hand or a foot stays planted on a support
# while the body moves; "anchor" = (joint, point) moves the whole figure so that joint (of a limb
# given by angles) lies on the point (a hand fixed on a rail or a table, a support foot).
FOOT_FRONT_DROP = 9.5   # ankle -> lowest ink of a "front" (standing, frontal) foot
PALM_DROP = 4.19        # wrist -> lowest ink of a palm flat on a support (vertical forearm)


def resolve_ik(root, L, a, b):
    if L.get("ik") is None:
        return L
    L = dict(L)
    L["thigh" if "thigh" in L else "up"], L["shin" if "shin" in L else "fore"] = PB.ik2(root, L["ik"], a, b, L.get("bend", 1))
    return L


def front_joints(H, a, legs, arms):
    H = np.array(H, float)
    u = V(a); r = F.perp(u)
    neck = H + u * F.SPINE
    J = {}
    for i, L in enumerate(legs):
        hip = H + r * L["s"] * 7.5 - u * 1.0
        J[f"hip{i}"] = hip
        if L.get("ik") is None:
            J[f"knee{i}"] = hip + V(L["thigh"]) * F.THIGH
            J[f"ank{i}"] = J[f"knee{i}"] + V(L["shin"]) * F.SHIN
    for i, A in enumerate(arms):
        sh = neck - u * 7.5 + r * A["s"] * 12.0
        J[f"sh{i}"] = sh
        if A.get("ik") is None:
            J[f"el{i}"] = sh + V(A["up"]) * F.UPPER
            J[f"wr{i}"] = J[f"el{i}"] + V(A["fore"]) * F.FORE
    return J


def front_pose(p):
    """Frontal figure from a parameter tree {H, a, legs, arms, anchor?, close?} -> geometry."""
    H = np.array(p["H"], float)
    if p.get("anchor"):
        name, target = p["anchor"]
        H = H + (np.array(target, float) - front_joints(H, p["a"], p["legs"], p["arms"])[name])
    J = front_joints(H, p["a"], p["legs"], p["arms"])
    legs = [resolve_ik(J[f"hip{i}"], L, F.THIGH, F.SHIN) for i, L in enumerate(p["legs"])]
    arms = [resolve_ik(J[f"sh{i}"], A, F.UPPER, F.FORE) for i, A in enumerate(p["arms"])]
    clean = lambda d: {k: v for k, v in d.items() if k not in ("ik", "bend")}
    g, J = PB.front_figure(H, p["a"], [clean(L) for L in legs], [clean(A) for A in arms], close=p.get("close", 1.8))
    return g


def leg_f(s, thigh, shin=None, foot="point", af=None, side=1, ik=None, bend=1):
    shin = thigh if shin is None else shin
    if af is None:
        af = shin + 10 * side if foot == "point" else (shin - 90 * side if foot == "flat" else shin)
    return dict(s=s, thigh=thigh, shin=shin, foot=foot, af=af, side=side, ik=ik, bend=bend)


def arm_f(s, up, fore=None, hand="flat", ah=None, ik=None, bend=1):
    fore = up if fore is None else fore
    return dict(s=s, up=up, fore=fore, hand=hand, ah=fore if ah is None else ah, ik=ik, bend=bend)


def lowest_ink_near(g, x, radius=10.0):
    pts = ink_pts(g)
    sel = pts[np.abs(pts[:, 0] - x) <= radius]
    return float(sel[:, 1].max()) if len(sel) else -1e9


def snap_contact(g, x, line_y, radius=10.0):
    """Translate vertically so the lowest ink near x lies exactly on line_y."""
    return affinity.translate(g, 0, line_y - lowest_ink_near(g, x, radius))


# ------------------------------------------------------------------ smooth tracks through keys
def pchip_weights(ts, T):
    """Monotone cubic (Fritsch-Carlson) interpolation at T through knots ts, as a function of the
    knot values: returns interp(values). No overshoot: an angle that only grows between keys never
    swings back, a support never dips below its line between two keys that touch it."""
    ts = np.asarray(ts, float)

    def interp(ys):
        ys = np.asarray(ys, float)
        n = len(ts)
        if n == 1:
            return float(ys[0])
        h = np.diff(ts)
        dlt = np.diff(ys) / h
        m = np.zeros(n)
        m[0], m[-1] = dlt[0], dlt[-1]
        for k in range(1, n - 1):
            if dlt[k - 1] * dlt[k] <= 0:
                m[k] = 0.0
            else:
                w1, w2 = 2 * h[k] + h[k - 1], h[k] + 2 * h[k - 1]
                m[k] = (w1 + w2) / (w1 / dlt[k - 1] + w2 / dlt[k])
        # ends: zero velocity (the exercise starts from rest and stops in the pose)
        m[0] = m[-1] = 0.0
        k = int(np.clip(np.searchsorted(ts, T, side="right") - 1, 0, n - 2))
        u = (T - ts[k]) / h[k]
        h00, h10, h01, h11 = 2 * u**3 - 3 * u**2 + 1, u**3 - 2 * u**2 + u, -2 * u**3 + 3 * u**2, u**3 - u**2
        return float(h00 * ys[k] + h10 * h[k] * m[k] + h01 * ys[k + 1] + h11 * h[k] * m[k + 1])
    return interp


def track(keys, times, stops=()):
    """p(T): the key parameter trees interpolated smoothly (PCHIP per number) over the key times;
    anything that is not a number switches halfway between the keys where it changes. `stops`
    = key indexes where the motion comes to rest (velocity 0), e.g. the bottom of a dip."""
    segs = [[0]]
    for i in range(1, len(keys)):
        segs[-1].append(i)
        if i in stops and i < len(keys) - 1:
            segs.append([i])

    def at(T):
        seg = next(sg for sg in segs if times[sg[0]] <= T <= times[sg[-1]])
        ts = [times[i] for i in seg]
        f = pchip_weights(ts, T)

        def rec(nodes):
            a = nodes[0]
            if isinstance(a, dict):
                return {k: rec([n[k] for n in nodes]) for k in a}
            if isinstance(a, (list, tuple)) and all(isinstance(n, (list, tuple)) and len(n) == len(a) for n in nodes):
                return [rec([n[j] for n in nodes]) for j in range(len(a))]
            if all(isinstance(n, (int, float)) and not isinstance(n, bool) for n in nodes):
                return f([float(n) for n in nodes])
            j = min(range(len(ts)), key=lambda q: abs(ts[q] - T) - (1e-9 if ts[q] >= T else 0))
            return nodes[j]
        return rec([keys[i] for i in seg])
    return at


def with_pins(pfun, T, pins, resolve):
    """pfun(T) with limbs pinned to supports: pins = [(limbs, i, target, T_on, T_off, blend)]. In
    [T_on, T_off] the limb is IK'd onto the target; within `blend` before / after, its angles blend
    from the track to the pinned angles at the window's edge (the hand / foot lands, then leaves)."""
    p = pfun(T)
    for limbs, i, target, t_on, t_off, blend in pins:
        def pinned_at(tt):
            q = pfun(tt)
            q[limbs][i] = dict(q[limbs][i], ik=tuple(target))
            return dict(resolve(q)[limbs][i], bend=q[limbs][i].get("bend", 1))
        if t_on <= T <= t_off:
            p[limbs][i] = dict(p[limbs][i], ik=tuple(target))
        elif t_on - blend < T < t_on:
            w = ease((T - (t_on - blend)) / blend, "io")
            p[limbs][i] = lerp(dict(p[limbs][i], ik=None), dict(pinned_at(t_on), ik=None), w)
        elif t_off < T < t_off + blend:
            w = ease((T - t_off) / blend, "io")
            p[limbs][i] = lerp(dict(pinned_at(t_off), ik=None), dict(p[limbs][i], ik=None), w)
    return p


# ------------------------------------------------------------------ side (profile) figures
def side_joints(p):
    H = np.array(p["H"], float)
    u_low, u_high = V(p["a_low"]), V(p["a_high"])
    f_low, f_high = F.perp(u_low), F.perp(u_high)
    neck = H + u_low * F.SPINE * 0.5 + u_high * F.SPINE * 0.5
    J = {"neck": neck}
    for i, L in enumerate(p["legs"]):
        hint = L["thigh"] if L.get("ik") is None else L.get("thigh_hint", L["thigh"])
        hip = F.hip_for(H, f_low, u_low, hint, L.get("spread", p.get("spread", 4.0)))
        J[f"hip{i}"] = hip
        if L.get("ik") is None:
            J[f"knee{i}"] = hip + V(L["thigh"]) * F.THIGH
            J[f"ank{i}"] = J[f"knee{i}"] + V(L["shin"]) * F.SHIN
    for i, A in enumerate(p["arms"]):
        sh = PB.shoulder_for(neck, u_high, f_high, A["up"], A.get("off", (0, 0)))
        J[f"sh{i}"] = sh
        if A.get("ik") is None:
            J[f"wr{i}"] = sh + V(A["up"]) * F.UPPER + V(A["fore"]) * F.FORE
    return J


def side_resolved(p):
    p = json.loads(json.dumps(p, default=float))
    H = np.array(p["H"], float)
    if p.get("anchor"):
        name, target = p["anchor"]
        H = H + (np.array(target, float) - side_joints(p)[name])
        p["anchor"] = None
    p["H"] = [float(H[0]), float(H[1])]
    J = side_joints(p)
    # (the shoulder / hip root depend a little on the limb angle: two passes settle the IK)
    for _ in range(2):
        legs = [dict(resolve_ik(J[f"hip{i}"], L, F.THIGH, F.SHIN), ik=None) for i, L in enumerate(p["legs"])]
        arms = [dict(resolve_ik(J[f"sh{i}"], A, F.UPPER, F.FORE), ik=None) for i, A in enumerate(p["arms"])]
        J = side_joints(dict(p, legs=legs, arms=arms))
    p["legs"], p["arms"] = legs, arms
    return p


def side_pose(p, extra=()):
    """Profile figure from {H, a_low, a_high, head, spread, legs, arms, anchor?} -> geometry."""
    q = side_resolved(p)
    clean = lambda d: {k: v for k, v in d.items() if k not in ("ik", "bend", "thigh_hint")}
    g, J = PB.side_figure(q["H"], q["a_low"], q["a_high"], [clean(L) for L in q["legs"]], [clean(A) for A in q["arms"]],
                          head_tilt=q["head"], spread=q.get("spread", 4.0), parts_extra=list(extra))
    return g


def leg_s(thigh, shin=None, foot="point", af=None, side=1, ik=None, bend=1, spread=None):
    shin = thigh if shin is None else shin
    if af is None:
        af = shin + 10 * side if foot == "point" else (shin - 90 * side if foot == "flat" else shin)
    L = dict(thigh=thigh, shin=shin, foot=foot, af=af, side=side, ik=ik, bend=bend)
    if spread is not None:
        L["spread"] = spread
    return L


def arm_s(up, fore=None, hand="flat", ah=None, ik=None, bend=1):
    fore = up if fore is None else fore
    return dict(up=up, fore=fore, hand=hand, ah=fore if ah is None else ah, ik=ik, bend=bend)


# ================================================================== E1 starJump -> star (front view)
# Parter: the star floats over the floor mat's middle (pose-scene.ts ANCHOR.parter). She stands
# on the carpet below it (icon y 36 at x 24.5, between the tumbling diagonal and the front edge),
# dips, drives up onto her toes and rises vertically into the approved star at its apex.
E1_FLOOR = 143.4  # rig y of the carpet under her (icon y ~36)


def e1_build(p):
    """Frontal figure, exactly symmetric (the right half mirrored, like the approved star).
    p: hy = hip y; the right leg (th, sh, af, foot, side) or an ankle target (ik); the right arm."""
    H = (0.0, p["hy"])
    if "ik" in p and p["ik"] is not None:
        root = np.array(H) + np.array([7.5, 1.0])  # front_figure's hip root for s=+1 upright
        th, sh = PB.ik2(root, p["ik"], F.THIGH, F.SHIN, bend=1)
    else:
        th, sh = p["th"], p["sh"]
    R = dict(s=1, thigh=th, shin=sh, foot=p["foot"], af=p["af"], side=p["side"])
    L = dict(s=-1, thigh=180 - th, shin=180 - sh, foot=p["foot"], af=180 - p["af"], side=p["side"])
    arms = [dict(s=-1, up=180 - p["up"], fore=180 - p["fore"]), dict(s=1, up=p["up"], fore=p["fore"])]
    g, J = FP.front_figure(H, -90, [L, R], arms)
    return FP.mirror_symmetric(g, 0.0)


def e1_frames():
    on_floor = lambda g, p=None, t=None: snap_y(g, E1_FLOOR)
    # standing: feet together (the salute's stance), arms down and a little out from the hips; the
    # right ankle is an IK target, so it stays put while she sinks into the plié (knees open)
    probe = e1_build(dict(hy=46.0, ik=None, th=90.8, sh=89.4, af=89.4, foot="front", side=1, up=74.0, fore=78.0))
    hy0 = 46.0 + (E1_FLOOR - probe.bounds[3])
    ank = tuple(np.array([7.5, hy0 + 1.0]) + V(90.8) * F.THIGH + V(89.4) * F.SHIN)
    stand = dict(hy=hy0, ik=ank, th=90.0, sh=90.0, af=89.4, foot="front", side=1, up=74.0, fore=78.0)
    dip = dict(stand, hy=hy0 + 13.0, up=68.0, fore=70.0)
    push = dict(stand, hy=hy0 + 1.0, up=8.0, fore=4.0)
    # relevé: legs straight, up on pointed toes, the arms swinging on up past the shoulders
    releve = dict(hy=hy0 - 5.0, ik=None, th=90.3, sh=90.5, af=95.0, foot="point", side=-1, up=-28.0, fore=-30.0)
    star = dict(hy=0.0, ik=None, th=19.0, sh=18.0, af=13.0, foot="point", side=-1, up=-42.0, fore=-40.0)

    fr = [Frame(g=on_floor(e1_build(stand)), key="stand")]
    fr += segment(e1_build, stand, dip, [0.36, 0.7], "io", post=on_floor)
    fr.append(Frame(g=on_floor(e1_build(dip)), key="dip"))
    fr += segment(e1_build, dip, push, [0.3, 0.62, 1.0], "in", post=on_floor)
    fr.append(Frame(g=on_floor(e1_build(releve)), key="takeoff"))

    # flight: the hip rises ballistically (fast, then slowing to the apex) while the legs open
    top = releve["hy"] + (E1_FLOOR - e1_build(releve).bounds[3])

    def flight(t):
        p = lerp(releve, star, ease(t, "io"))
        p["hy"] = top + (star["hy"] - top) * ease(t, "out")
        g = e1_build(p)
        return Frame(g=on_floor(g) if g.bounds[3] > E1_FLOOR else g)
    fr += [flight(t) for t in [0.07, 0.16, 0.26, 0.37, 0.49, 0.61, 0.73, 0.85, 0.95]]
    for f in fr:
        f.g = to_file(f.g, "star")
    fr.append(Frame(g=to_file(FP.star()[0], "star"), key="star", exact="star"))
    return dict(id="starJump", pose="star", note="starJump → POSES.star (parter): stand on the carpet, plié, relevé, rise vertically into the star at its apex.", frames=fr, ghosts=["dip"])


def front_resolved(p):
    """The parameter tree with the anchor applied and every IK limb turned into angles."""
    p = json.loads(json.dumps(p, default=float))
    H = np.array(p["H"], float)
    if p.get("anchor"):
        name, target = p["anchor"]
        H = H + (np.array(target, float) - front_joints(H, p["a"], p["legs"], p["arms"])[name])
        p["anchor"] = None
    p["H"] = [float(H[0]), float(H[1])]
    J = front_joints(H, p["a"], p["legs"], p["arms"])
    p["legs"] = [dict(resolve_ik(J[f"hip{i}"], L, F.THIGH, F.SHIN), ik=None) for i, L in enumerate(p["legs"])]
    p["arms"] = [dict(resolve_ik(J[f"sh{i}"], A, F.UPPER, F.FORE), ik=None) for i, A in enumerate(p["arms"])]
    return p


def pinned(pa, pb, t, pins, kind="io"):
    """Params at t between key params pa -> pb, with limbs pinned to supports over time windows:
    pins = [(limbs, i, target, t_on, t_off)] ("legs"/"arms", index, ankle/wrist point). Inside the
    window the limb is IK'd to the target; outside, its angles blend from/to the pinned angles at
    the window's edges, so a hand or foot lands and leaves without a pop."""
    e = ease(t, kind)
    p = lerp(pa, pb, e)
    for limbs, i, target, t_on, t_off in pins:
        def at(tt):
            q = lerp(pa, pb, ease(tt, kind))
            q[limbs][i] = dict(q[limbs][i], ik=tuple(target))
            return front_resolved(q)[limbs][i]
        if t_on <= t <= t_off:
            p[limbs][i] = dict(p[limbs][i], ik=tuple(target))
        elif t < t_on:
            p[limbs][i] = lerp(pa[limbs][i], dict(at(t_on), bend=pa[limbs][i].get("bend", 1)), ease(t / t_on, "io"))
        else:
            p[limbs][i] = lerp(dict(at(t_off), bend=pb[limbs][i].get("bend", 1)), pb[limbs][i], ease((t - t_off) / (1 - t_off), "io"))
    return p


# ================================================================== E2 beamCartwheel -> cartwheel
# Greda: the approved inverted star with both hands on the beam top (pose-scene.ts ANCHOR.greda).
# She starts at the beam's far end in cart1's stance (standing on one foot, arms up, the lead leg
# lifted), steps onto the lead leg, reaches down along the beam and wheels over the first hand
# into the inverted star. Every foot / hand that touches, touches the beam top.
# She wheels in from the RIGHT (the approach is authored travelling right, then mirrored): the
# approved star is exactly symmetric, and on the card plate only the right side has room for the
# straight kick leg as it swings through horizontal (the plate clips 12-14 px left of the drawing;
# travelling right, the toes would leave the plate by ~4 icon units).
BEAM = 187.4 - FP.POSES["cartwheel"]["origin"][1]   # the beam top (the cartwheel's floor), rig y
E2_FOOT0 = -124.0   # cart1's standing foot on the beam (rig x); the beam's flat top spans +-124.9
E2_LEAD = -106.0    # the lead foot's short beam step: the hips sit over it when the first hand lands


def cart1_lerp(H):
    return dict(H=list(H), a=-85.0, anchor=None, close=1.8,
                legs=[leg_f(-1, 93, 93, "front", side=1), leg_f(1, 40, 38, "point", af=33, side=-1)],
                arms=[arm_f(-1, -106, -104), arm_f(1, -58, -56)])


def place_cart1(pose, foot_x_file, floor_file):
    """cart1 with its foot contact at (foot_x_file, floor_file) of `pose`'s file coordinates:
    (key origin on the 0.1 grid, cart1's hip in `pose`'s rig coordinates)."""
    fx, fy = FP.POSES["cart1"]["contacts"]["foot"]
    ko = (grid(foot_x_file - fx), grid(floor_file - fy))
    o1, o = FP.POSES["cart1"]["origin"], FP.POSES[pose]["origin"]
    return ko, (o1[0] + ko[0] - o[0], o1[1] + ko[1] - o[1])


def e2_frames():
    ow = FP.POSES["cartwheel"]["origin"]
    ko1, H1 = place_cart1("cartwheel", E2_FOOT0 + ow[0], 187.4)
    lead = (E2_LEAD, BEAM - FOOT_FRONT_DROP)    # the lead foot's ankle, planted
    back = (E2_FOOT0, BEAM - FOOT_FRONT_DROP)   # cart1's standing foot
    hand1 = (-31.93, 102.45)  # the approved hands (wrists) of the inverted star
    hand2 = (31.93, 102.45)

    k0 = cart1_lerp(H1)
    # step: the lead foot comes down just ahead on the beam, knees soft, torso leaning into the move
    k1 = dict(H=[-114.0, 13.0], a=-78.0, anchor=None, close=1.8,
              legs=[leg_f(-1, 96, 92, "front", af=92, side=1, ik=back, bend=-1), leg_f(1, 84, 92, "front", af=90, side=1, ik=lead, bend=1)],
              arms=[arm_f(-1, -96, -94), arm_f(1, -44, -42)])
    # reach: the body tips over the bent lead leg, the kick leg lifts behind in line with the torso
    k2 = dict(H=[-104.0, 20.0], a=10.0, anchor=None, close=1.8,
              legs=[leg_f(-1, 200, 200, "point", af=208, side=1), leg_f(1, 70, 100, "front", af=90, side=1, ik=lead, bend=1)],
              arms=[arm_f(-1, -14, -12), arm_f(1, 58, 60, "palm", ah=110)])
    # first hand: the hand on the beam, torso and arm in one line, the kick leg already near vertical
    k3 = dict(H=[0.0, 0.0], a=48.0, anchor=("wr1", hand1), close=1.8,
              legs=[leg_f(-1, 262, 262, "point", af=272, side=-1), leg_f(1, 70, 100, "front", af=90, side=1, ik=lead, bend=1)],
              arms=[arm_f(-1, 16, 22, "palm", ah=8), arm_f(1, 52, 52, "palm", ah=180)])
    k4 = dict(H=[0.0, 0.0], a=90.0, anchor=("wr1", hand1), close=1.8,
              legs=[leg_f(-1, 313, 313, "point", side=-1), leg_f(1, 227, 227, "point", side=1)],
              arms=[arm_f(-1, 67, 67, "palm", ah=0), arm_f(1, 113, 113, "palm", ah=180)])

    supports = [E2_FOOT0, E2_LEAD, hand1[0], hand2[0]]

    def on_beam(x):
        """The lowest ink onto the beam top (nothing passes below it). It must be a foot or a hand
        on its support spot, and the planted support near x must touch (within 1 unit)."""
        def f(g):
            g = snap_y(g, BEAM)
            low = ink_pts(g)[np.argmax(ink_pts(g)[:, 1])]
            assert min(abs(low[0] - sx) for sx in supports) < 9.0, f"the lowest ink at x={low[0]:.1f} is no support"
            gap = BEAM - lowest_ink_near(g, x, 8.0)
            assert gap <= 1.0, f"support at x={x} is {gap:.2f} above the beam"
            return g
        return f
    k3r = front_resolved(k3)  # the hip where the first hand lands (for interpolating toward it)
    g1, _ = FP.cart_phase1()
    fr = [Frame(g=affinity.translate(g1, H1[0], H1[1]), key="start")]
    fr.append(Frame(g=on_beam(E2_FOOT0)(front_pose(pinned(k0, k1, 0.5, [("legs", 0, back, 0.0, 1.0)])))))
    fr.append(Frame(g=on_beam(E2_FOOT0)(front_pose(k1)), key="step"))
    for t in [0.22, 0.44, 0.64, 0.83]:
        fr.append(Frame(g=on_beam(E2_LEAD)(front_pose(pinned(k1, k2, t, [("legs", 0, back, 0.0, 0.2)])))))
    fr.append(Frame(g=on_beam(E2_LEAD)(front_pose(k2)), key="reach"))
    for t in [0.33, 0.67]:
        fr.append(Frame(g=on_beam(E2_LEAD)(front_pose(pinned(k2, k3r, t, [("legs", 1, lead, 0.0, 1.0)])))))
    fr.append(Frame(g=on_beam(hand1[0])(front_pose(k3)), key="hand"))
    pins = [("legs", 1, lead, 0.0, 0.2), ("arms", 0, hand2, 0.5, 1.0)]
    for t in [0.12, 0.25, 0.38, 0.5, 0.62, 0.74, 0.86, 0.95]:
        fr.append(Frame(g=on_beam(hand1[0])(front_pose(pinned(k3, k4, t, pins, "lin")))))
    for f in fr:  # wheel in from the right: mirror the approach about the star's axis (x = 0)
        f.g = to_file(affinity.scale(f.g, -1, 1, origin=(0, 0)), "cartwheel")
    g, J = FP.cart_inverted()
    fr.append(Frame(g=to_file(FP.mirror_symmetric(g, 0.0), "cartwheel"), key="cartwheel", exact="cartwheel"))
    return dict(id="beamCartwheel", pose="cartwheel", note="beamCartwheel → POSES.cartwheel (greda): cart1's stance at the beam's far end, a short step, reach along the beam, wheel over the first hand into the inverted star (in from the right).", frames=fr, ghosts=["start", "hand"])


# ================================================================== E3 barCast -> barHandstand
# Razboj: front support on the high rail (hands gripping it at the approved hand contact, arms
# straight, hips at the rail, legs hanging down-forward), a small pike, then the cast: the legs
# swing back and up, the body passes horizontal behind the bar with the shoulders leaning over
# it, and rises into the approved handstand. The hands never move: every frame carries the same
# grip_hand() part on the rail, and the arms are anchored on its wrist.
def e3_frames():
    W = np.array([-1.5, 109.5])  # the approved handstand's wrist (both arms) = the grip
    grip = FP.grip_hand(W, 90, 180)

    def key(a_low, a_high, arm, legs, head):
        return dict(H=[0.0, 0.0], a_low=a_low, a_high=a_high, head=head, spread=4.0, anchor=("wr0", tuple(W)),
                    legs=[leg_s(legs[0], legs[1]), leg_s(legs[0] + 1.5, legs[1] + 1.5)],
                    arms=[arm_s(arm, arm, "none"), arm_s(arm, arm, "none")])

    keys = [
        key(-81, -77, 96, (83, 85), 0),       # front support: hips at the rail, legs down-forward
        key(-72, -70, 101, (66, 70), 2),      # the pike before the cast (legs forward under the bar)
        key(-40, -36, 112, (150, 150), 3),    # cast: legs swing back, hips leave the bar
        key(2, 4, 119, (184, 184), 6),        # horizontal behind the bar, shoulders over it
        key(52, 54, 108, (234, 234), 10),     # rising
        key(90, 90, 90, (270, 269.5), 12),    # handstand (the approved -90 / -90.5 legs)
    ]
    times = [0, 1.6, 3.0, 3.8, 4.7, 6.0]
    pf = track(keys, times, stops=(1,))
    frames_T = [0, 0.55, 1.1, 1.6, 2.05, 2.45, 2.8, 3.1, 3.4, 3.62, 3.8, 4.0, 4.25, 4.5, 4.75, 5.0, 5.25, 5.5, 5.75]
    names = {0: "support", 1.6: "pike", 3.8: "horizontal"}
    fr = []
    for T in frames_T:
        g = side_pose(pf(T), extra=[grip])
        fr.append(Frame(g=to_file(g, "barHandstand"), key=names.get(T)))
    g, J = FP.bar_handstand()
    fr.append(Frame(g=to_file(g, "barHandstand"), key="barHandstand", exact="barHandstand"))
    return dict(id="barCast", pose="barHandstand", note="barCast → POSES.barHandstand (razboj): front support on the high rail, pike, cast back through horizontal, rise into the handstand; the grip never moves.", frames=fr, ghosts=["horizontal"])


# ================================================================== E4 vaultHandspring -> vault
# Preskok (ProgramIcon: run-up dashes, the springboard wedge, the table). The pose's hand contact
# sits on the table top (pose-scene.ts ANCHOR.preskok); the icon's lines, mapped into the vault's
# rig coordinates through that placement, are the supports: the run-up's top edge, the board's
# sloped top edge (the stroke's outer edge, like every apparatus contact) and the table top.
K_CARD = 35 / 230
SW_REF = 2.8 / (150 / 48)


def icon_to_rig(pose, anchor_file, target_icon, k=K_CARD):
    """Map icon units of a card scene to the pose's rig coordinates (the inverse of posePlacement)."""
    o = FP.POSES[pose]["origin"]
    ax, ay = anchor_file[0] - o[0], anchor_file[1] - o[1]
    return lambda x, y: (ax + (x - target_icon[0]) / k, ay + (y - target_icon[1]) / k)


VAULT_TO_RIG = icon_to_rig("vault", FP.POSES["vault"]["contacts"]["hand"], (33.5, 14 - SW_REF / 2))
TABLE = VAULT_TO_RIG(33.5, 14 - SW_REF / 2)[1]
RUNWAY = VAULT_TO_RIG(0, 42 - SW_REF / 2)[1]
_d = np.array([9.5, -4.5]) / math.hypot(9.5, 4.5)
_n = np.array([_d[1], -_d[0]])  # the board top's outward (upper) normal
BOARD = (VAULT_TO_RIG(*(np.array([11, 42]) + _n * SW_REF / 2)), VAULT_TO_RIG(*(np.array([20.5, 37.5]) + _n * SW_REF / 2)))
BOARD_DEG = math.degrees(math.atan2(-4.5, 9.5))


def board_y(x):
    (x0, y0), (x1, y1) = BOARD
    return y0 + (x - x0) * (y1 - y0) / (x1 - x0)


def snap_to_board(g, x_lo=None, x_hi=None):
    """Translate vertically so the ink rests on the board's sloped top (no point below it)."""
    (x0, _), (x1, _) = BOARD
    pts = ink_pts(g)
    sel = pts[(pts[:, 0] >= x0) & (pts[:, 0] <= x1)]
    dy = max(y - board_y(x) for x, y in sel)
    return affinity.translate(g, 0, -dy)


def e4_frames():
    W0 = (-25.78, 106.35)  # the approved vault's wrist (arm 0): the hand stays on the table
    fin = dict(H=[0.0, 0.0], a_low=106, a_high=103, head=10, spread=4.0, anchor=None,
               legs=[leg_s(288, 289), leg_s(287, 288)],
               arms=[arm_s(101, 101, "palm", ah=192), arm_s(100, 100, "palm", ah=191)])

    def K(H, a_low, a_high, head, legs, arms, anchor=None):
        return side_resolved(dict(H=list(H), a_low=a_low, a_high=a_high, head=head, spread=4.0, anchor=anchor, legs=legs, arms=arms))

    feet_board = (-165.0, board_y(-165.0) - 6.5)   # ankle over the board, foot flat on it
    feet_toes = (-160.0, board_y(-160.0) - 13.0)   # up on the toes as she leaves it
    keys = [
        # run: push-off stride (back foot on the run-up, knee driving), arms in opposition
        K((-196, RUNWAY - 96), -76, -78, 0, [leg_s(116, 126), leg_s(30, 112)], [arm_s(28, -45), arm_s(146, 105)]),
        # flight stride, the other leg forward
        K((-181, RUNWAY - 100), -76, -78, 0, [leg_s(44, 118), leg_s(128, 168)], [arm_s(144, 100), arm_s(32, -40)]),
        # hurdle: the last push off one foot, both arms swinging back
        K((-177, RUNWAY - 98), -80, -82, 0, [leg_s(30, 115), leg_s(106, 120)], [arm_s(132, 118), arm_s(128, 114)]),
        # hurdle flight: legs together reaching for the board, arms behind
        K((-168, RUNWAY - 110), -86, -88, 0, [leg_s(80, 96), leg_s(82, 98)], [arm_s(142, 126), arm_s(138, 122)]),
        # board: both feet flat on the board, knees soft, arms swinging down through
        K((0, 0), -85, -86, 0, [leg_s(66, 112, "flat", af=BOARD_DEG), leg_s(68, 114, "flat", af=BOARD_DEG)],
          [arm_s(96, 88), arm_s(92, 84)], anchor=("ank0", feet_board)),
        # take-off: stretched, leaning into the vault, arms overhead
        K((0, 0), -72, -70, 2, [leg_s(106, 106), leg_s(107, 107)], [arm_s(-74, -74), arm_s(-72, -72)], anchor=("ank0", feet_toes)),
        # pre-flight: rising and rotating forward above the table, reaching for it
        K((-132, 96), -22, -20, 4, [leg_s(160, 160), leg_s(161, 161)], [arm_s(-38, -38), arm_s(-37, -37)]),
        # hands on the table: body inclined ~35 deg, arms in line, legs a touch behind
        K((0, 0), 35, 36, 8, [leg_s(208, 208), leg_s(207, 207)], [arm_s(37, 37, "palm", ah=192), arm_s(36, 36, "palm", ah=191)],
          anchor=("wr0", W0)),
        side_resolved(fin),
    ]
    times = [0, 1.0, 2.0, 2.6, 3.3, 4.1, 5.1, 6.1, 8.0]
    pf = track(keys, times, stops=(4,))
    fr = []

    def at(T, name=None):
        p = pf(T)
        if times[4] <= T <= times[5]:  # on the board: the feet stay where they land
            u = (T - times[4]) / (times[5] - times[4])
            p["anchor"] = ("ank0", tuple(np.array(feet_board) * (1 - u) + np.array(feet_toes) * u))
        if T >= times[7]:  # on the table: the hand stays where it lands
            p["anchor"] = ("wr0", W0)
        else:  # in the air the hands stay in line with the forearms; they turn flat on the table
            p["arms"] = [dict(A, hand="flat", ah=A["fore"]) for A in p["arms"]]
        g = side_pose(p)
        if T in (times[0], times[2]):
            g = snap_y(g, RUNWAY)   # the stance foot on the run-up
        if times[4] <= T <= times[5]:
            g = snap_to_board(g)
        if T >= times[7]:
            g = snap_contact(g, W0[0], TABLE, 8.0)
        return Frame(g=to_file(g, "vault"), key=name)

    # (the support frames straddle the pass through the vertical handstand: its peak, 0.4 icon
    # units above the approved pose's reach, falls between two frames, so the plate's --head holds)
    plan = [(0, "run"), (0.5, None), (1.0, None), (1.5, None), (2.0, "hurdle"), (2.6, None), (3.3, "board"), (3.62, None),
            (3.86, None), (4.1, "takeoff"), (4.45, None), (4.8, None), (5.1, None), (5.45, None), (5.8, None), (6.1, "hands"),
            (6.42, None), (6.72, None), (7.0, None), (7.55, None), (7.8, None)]
    for T, name in plan:
        fr.append(at(T, name))
    g, J = FP.vault()
    fr.append(Frame(g=to_file(g, "vault"), key="vault", exact="vault"))
    return dict(id="vaultHandspring", pose="vault", note="vaultHandspring → POSES.vault (preskok): run-up, hurdle, both feet on the board, stretched take-off, pre-flight, hands on the table, over into the handspring.", frames=fr, ghosts=["run", "takeoff", "hands"])


# ================================================================== E5 aerobicKick -> highKick
# Aerobik: standing in profile, feet together; the kicking leg brushes out to a pointed-toe tendu,
# then swings up straight through horizontal to the approved high kick while both arms open back
# and the torso leans away from the leg. The support leg is the approved one in every frame (the
# figure is anchored on its ankle), so the support foot never moves.
def toe_ankle(toe_x, floor, af):
    """The ankle that puts a pointed foot's tip (direction af) on the floor at toe_x."""
    return (toe_x - math.cos(math.radians(af)) * 16.9, floor - math.sin(math.radians(af)) * 16.9)


def e5_frames():
    ANK = (-0.75, 86.13)  # the approved support ankle
    floor = FP.POSES["highKick"]["floor"] - FP.POSES["highKick"]["origin"][1]
    support = leg_s(90, 90, "flat", af=0, spread=3)

    def K(a_low, a_high, head, kick, arms):
        return dict(H=[0.0, 0.0], a_low=a_low, a_high=a_high, head=head, spread=3, anchor=("ank0", ANK),
                    legs=[support, kick], arms=arms)

    # the brush: heel up, the pointed toe sliding forward on the floor to a straight-leg tendu
    brush = [(0.0, None), (0.4, (ANK[0] + 16, 78)), (1.0, (ANK[0] + 50, 72))]  # (T, (toe x, foot angle))
    keys = [
        K(-90, -91, 0, leg_s(90, 90, "flat", af=0, spread=4), [arm_s(84, 88), arm_s(92, 96)]),              # stand
        side_resolved(K(-92, -93, 0, leg_s(66, 68, "point", af=72, spread=4, ik=toe_ankle(ANK[0] + 50, floor, 72)),
                        [arm_s(94, 96), arm_s(98, 100)])),                                                     # tendu
        K(-97, -99, -2, leg_s(0, -1, "point", af=-12, spread=5), [arm_s(160, 158, ah=156), arm_s(146, 148)]),  # horizontal
        K(-101, -103, -4, leg_s(-76, -77, "point", af=-90, spread=5), [arm_s(212, 210, ah=206), arm_s(175, 177, ah=181)]),
    ]
    keys[1]["anchor"] = ("ank0", ANK)
    times = [0, 1.0, 2.0, 3.0]
    pf = track(keys, times, stops=(1,))

    def at(T):
        p = pf(T)
        if 0 < T < 1.0:  # sliding the toe out along the floor
            u = ease(T, "io")
            x = np.interp(u, [0, 0.4, 1.0], [ANK[0] + 12, brush[1][1][0] + 6, brush[2][1][0]])
            af = np.interp(u, [0, 0.4, 1.0], [86, 78, 72])
            p["legs"][1] = dict(p["legs"][1], foot="point", af=float(af), ik=toe_ankle(float(x), floor, float(af)), bend=1)
        return side_pose(p)

    plan = [(0, "stand"), (0.3, None), (0.6, None), (0.82, None), (1.0, "tendu"), (1.2, None), (1.38, None), (1.54, None),
            (1.68, None), (1.8, None), (1.91, None), (2.0, "horizontal"), (2.1, None), (2.2, None), (2.31, None), (2.43, None),
            (2.56, None), (2.7, None), (2.85, None)]
    fr = []
    for T, name in plan:
        g = at(T)
        assert g.bounds[3] <= floor + 0.3, f"below the floor by {g.bounds[3] - floor:.2f} at T={T}"
        fr.append(Frame(g=to_file(g, "highKick"), key=name))
    g, J = FP.high_kick()
    fr.append(Frame(g=to_file(g, "highKick"), key="highKick", exact="highKick"))
    return dict(id="aerobicKick", pose="highKick", note="aerobicKick → POSES.highKick (aerobik): stand in profile, brush to a tendu, straight-leg kick through horizontal into the high kick; the support foot never moves.", frames=fr, ghosts=["horizontal"])


# ================================================================== E6 coachScale -> scale
# The coach plate: from standing upright, the arms rise (one forward, one back), the torso tips
# forward and the free leg lifts behind into the approved scale. Arms at scale()'s 1.08 length in
# every frame; the support leg is the approved one (anchored on its ankle), its foot flat and still.
class long_arms:
    def __enter__(self):
        F.UPPER, F.FORE = 27.0 * 1.08, 24.0 * 1.08

    def __exit__(self, *exc):
        F.UPPER, F.FORE = 27.0, 24.0


def e6_frames():
    ANK = (2.74, 88.7)  # the approved support ankle
    floor = FP.POSES["scale"]["floor"] - FP.POSES["scale"]["origin"][1]
    support = leg_s(90, 90, "flat", af=0)

    def K(a_low, a_high, head, free, arms):
        return dict(H=[0.0, 0.0], a_low=a_low, a_high=a_high, head=head, spread=4.0, anchor=("ank0", ANK),
                    legs=[support, free], arms=arms)

    keys = [
        K(-90, -91, 0, leg_s(90, 90, "flat", af=0, side=-1), [arm_s(84, 86), arm_s(94, 96)]),                  # stand
        K(-84, -82, -3, leg_s(120, 120, "point", af=110, side=-1), [arm_s(52, 50, ah=48), arm_s(126, 124, ah=124)]),
        K(-64, -52, -9, leg_s(150, 152, "point", af=164, side=-1), [arm_s(10, 8, ah=6), arm_s(168, 166, ah=166)]),
        K(-40, -19, -16, leg_s(197, 199, "point", af=206, side=-1), [arm_s(-10, -11, ah=-13), arm_s(208, 206, ah=208)]),
    ]
    with long_arms():
        keys[1] = side_resolved(dict(keys[1], legs=[support, dict(keys[1]["legs"][1], ik=toe_ankle(ANK[0] - 56, floor, 110), bend=-1)]))
        keys[1]["anchor"] = ("ank0", ANK)
    times = [0, 0.9, 1.75, 2.7]
    pf = track(keys, times)

    def at(T):
        p = pf(T)
        if 0 < T < 0.9:  # the free foot points and slides back along the floor (tendu behind)
            u = T / 0.9
            x = np.interp(ease(u, "out"), [0, 1], [ANK[0] - 22, ANK[0] - 56])
            af = float(np.interp(u, [0, 1], [100, 110]))
            p["legs"][1] = dict(p["legs"][1], foot="point", af=af, ik=toe_ankle(float(x), floor, af), bend=-1)
        return side_pose(p)

    plan = [(0, "stand"), (0.25, None), (0.48, None), (0.7, None), (0.9, "tendu"), (1.06, None), (1.21, None), (1.36, None),
            (1.5, None), (1.63, None), (1.75, "lift"), (1.88, None), (2.01, None), (2.14, None), (2.27, None), (2.4, None),
            (2.52, None), (2.62, None)]
    fr = []
    with long_arms():
        for T, name in plan:
            g = at(T)
            assert g.bounds[3] <= floor + 0.3, f"below the floor by {g.bounds[3] - floor:.2f} at T={T}"
            fr.append(Frame(g=to_file(g, "scale"), key=name))
    g, J = FP.scale()
    fr.append(Frame(g=to_file(g, "scale"), key="scale", exact="scale"))
    return dict(id="coachScale", pose="scale", note="coachScale → POSES.scale (coach plate): stand, tendu behind, arms open, the torso tips forward and the free leg lifts into the scale; the support foot never moves.", frames=fr, ghosts=["lift"])


# ================================================================== E7 enrollCartwheel -> salute
# The enrollment band: ONE cartwheel on the floor whose key frames are exactly the approved cart1
# (start) -> cart2 (through the inverted star) -> cart3 (landing lunge) -> salute, travelling right.
# Every key pose is the approved drawing placed on the 0.1 grid; keyOrigins give each key pose's
# own file origin in the exercise's (salute) coordinates, so the runtime can spread the keys to the
# band's step ticks (a per-key x offset). The contacts walk forward like the spokes of a wheel:
# cart1's foot -> the lead foot -> first hand -> second hand -> first foot (cart3's trailing toe) ->
# second foot (cart3's front foot, which becomes the salute's right foot and never moves again).
FLOOR7 = FP.POSES["salute"]["floor"] - FP.POSES["salute"]["origin"][1]   # the mat, salute rig y


def place_key(pid, rig_xy_guess):
    """Key pose `pid` with its rig origin near rig_xy_guess (salute rig), standing on the mat:
    (keyOrigin on the 0.1 grid in salute file coordinates, its rig origin in salute rig coords)."""
    o, os_ = FP.POSES[pid]["origin"], FP.POSES["salute"]["origin"]
    kx = grid(rig_xy_guess[0] + os_[0] - o[0])
    ky = grid(FP.POSES["salute"]["floor"] - FP.POSES[pid]["floor"])
    return (kx, ky), (kx + o[0] - os_[0], ky + o[1] - os_[1])


def pin_toe(p, i, toe, iters=3):
    """Leg i of a frontal pose with its pointed toe tip on `toe`: the ankle target follows the foot
    angle, which keeps its angle to the shin (the foot rolls over the toe as the body passes)."""
    L = p["legs"][i]
    off = L["af"] - L["shin"]
    shin = L["shin"]
    for _ in range(iters):
        af = shin + off
        ank = (toe[0] - math.cos(math.radians(af)) * 16.9, toe[1] - math.sin(math.radians(af)) * 16.9)
        p["legs"][i] = dict(L, ik=ank, af=af)
        shin = front_resolved(p)["legs"][i]["shin"]
    return p


def e7_frames():
    ko = {}
    ko["salute"], _ = (0.0, 0.0), None
    # cart3: its front (s=+1) ankle on the salute's right ankle -> the foot stays for the stand-up
    g3, J3 = FP.cart_phase3()
    ko["cart3"], P3 = place_key("cart3", np.array([7.26, 87.99]) - J3["ank1"])
    toe3 = np.array(P3) + J3["toe0"]                 # the trailing toe (the first foot that landed)
    # cart2: its second (s=-1) hand one hand-and-a-bit before that landing foot
    ko["cart2"], P2 = place_key("cart2", (toe3[0] - 50.0 - 31.93, 0.0))
    P2 = np.array(P2)
    hand1, hand2 = P2 + (-31.93, 102.45), P2 + (31.93, 102.45)
    lead = (P2[0] - 106.0, FLOOR7 - FOOT_FRONT_DROP)  # the lead foot, the hips over it at first contact
    foot0_x = P2[0] - 152.0                            # cart1's standing foot
    ko["cart1"], P1 = place_key("cart1", (foot0_x - FP.POSES["cart1"]["contacts"]["foot"][0] + FP.POSES["cart1"]["origin"][0], 0.0))
    back = (foot0_x, FLOOR7 - FOOT_FRONT_DROP)

    # ---- key parameter trees (salute rig), legs / arms ordered [s=-1, s=+1]
    k_c1 = cart1_lerp(P1)
    k_step = dict(H=[P2[0] - 128.0, P1[1] + 5.0], a=-78.0, anchor=None, close=1.8,
                  legs=[leg_f(-1, 100, 94, "front", af=94, side=1, ik=back, bend=-1), leg_f(1, 80, 96, "front", af=92, side=1, ik=lead, bend=1)],
                  arms=[arm_f(-1, -98, -96), arm_f(1, -44, -42)])
    k_reach = dict(H=[P2[0] - 112.0, P2[1] + 24.0], a=4.0, anchor=None, close=1.8,
                   legs=[leg_f(-1, 196, 196, "point", af=204, side=1), leg_f(1, 70, 100, "front", af=90, side=1, ik=lead, bend=1)],
                   arms=[arm_f(-1, -14, -12), arm_f(1, 58, 60, "palm", ah=110)])
    k_hand = front_resolved(dict(H=[0.0, 0.0], a=48.0, anchor=("wr1", tuple(hand1)), close=1.8,
                                 legs=[leg_f(-1, 262, 262, "point", af=272, side=-1), leg_f(1, 70, 100, "front", af=90, side=1, ik=lead, bend=1)],
                                 arms=[arm_f(-1, 16, 22, "palm", ah=8), arm_f(1, 52, 52, "palm", ah=180)]))
    k_c2 = dict(H=list(P2), a=90.0, anchor=None, close=1.8,
                legs=[leg_f(-1, 329, 329, "point", side=-1), leg_f(1, 241, 241, "point", side=1)],
                arms=[arm_f(-1, 67, 67, "palm", ah=0), arm_f(1, 113, 113, "palm", ah=180)])
    # first foot down: the s=-1 toe lands where cart3 keeps it; an inverted V over hand and foot
    k_land = dict(H=[toe3[0] - 28.0, P2[1] - 2.0], a=118.0, anchor=None, close=1.8,
                  legs=[leg_f(-1, 432, 434, "point", af=424, side=-1, bend=-1), leg_f(1, 282, 282, "point", side=1)],
                  arms=[arm_f(-1, 92, 92, "palm", ah=0), arm_f(1, 150, 150, "palm", ah=180)])
    # second foot: the s=+1 leg comes over straight toward its landing spot, the hands have left
    # (the hips vault over the planted first foot like a spoke of the wheel: hip = toe - 104 V(115))
    k_second = dict(H=list(toe3 - V(115.0) * 104.0), a=232.0, anchor=None, close=1.8,
                    legs=[leg_f(-1, 482, 484, "point", af=474, side=-1, bend=-1), leg_f(1, 398, 400, "point", side=1)],
                    arms=[arm_f(-1, 196, 198), arm_f(1, 252, 250)])
    # cart3 in lerp form: its own builder's numbers (the lead leg's IK angles from the approved pose)
    q3 = {}
    u = V(-97.0); r = F.perp(u)
    hip_t = np.array([0.0, 0.0]) + r * -7.5 - u * 1.0
    g_t, _, _, _ = F.leg(hip_t, 146.0, 146.0, "point", None, -1, frontal=True)
    floor3 = float(max(y for x, y in g_t.exterior.coords))
    hip_l = r * 7.5 - u * 1.0
    th3, sh3 = PB.ik2(hip_l, (hip_l[0] + 26.0, floor3 - 9.0), F.THIGH, F.SHIN, bend=1)
    k_c3 = dict(H=list(P3), a=263.0, anchor=None, close=1.8,
                legs=[leg_f(-1, 506, 506, "point", af=496, side=-1, bend=-1), leg_f(1, th3 + 360, sh3 + 360, "front", af=sh3 + 360, side=1)],
                arms=[arm_f(-1, 239, 241), arm_f(1, 289, 287)])
    # rising out of the lunge over the front foot while the back toe slides in
    k_rise = dict(H=[-10.0, 3.0], a=267.0, anchor=None, close=1.4,
                  legs=[leg_f(-1, 474, 476, "point", af=466, side=-1, bend=-1), leg_f(1, 448, 452, "front", af=452, side=1)],
                  arms=[arm_f(-1, 236, 238), arm_f(1, 300, 298)])
    k_sal = dict(H=[0.0, 0.0], a=270.0, anchor=None, close=0.9,
                 legs=[leg_f(-1, 449.2, 450.6, "front", side=1, bend=-1), leg_f(1, 90.8 + 360, 89.4 + 360, "front", af=89.4 + 360, side=1)],
                 arms=[arm_f(-1, 233, 235), arm_f(1, 307, 305)])

    keys = [k_c1, k_step, k_reach, k_hand, k_c2, k_land, k_second, k_c3, k_rise, k_sal]
    names = ["cart1", "step", "reach", "hand", "cart2", "land", "second", "cart3", "rise", "salute"]
    keysR = [front_resolved(k) for k in keys]
    times = [0, 1.0, 2.0, 2.8, 3.6, 4.4, 5.0, 5.4, 6.2, 7.0]
    pf = track(keysR, times, stops=(7,))
    ankle_front = (7.26, 87.99)
    pins = [
        ("legs", 0, back, 0.0, 1.25, 0.3),             # cart1's foot until it kicks
        ("legs", 1, lead, 1.0, 3.05, 0.3),             # the lead foot: step .. push off
        ("arms", 1, tuple(hand1), 2.8, 4.0, 0.3),      # first hand
        ("arms", 0, tuple(hand2), 3.3, 4.6, 0.3),      # second hand
        ("legs", 1, ankle_front, 5.12, 7.0, 0.2),      # the front foot: lands, cart3 .. salute
    ]

    def at(T):
        p = with_pins(pf, T, pins, front_resolved)
        if 4.4 <= T <= 5.4:          # the first foot rolls over its toe
            p = pin_toe(p, 0, toe3)
        elif 5.4 < T < 7.0:          # ... and slides in beside the front foot, still pointed
            u = ease((T - 5.4) / 1.6, "io")
            tgt = (toe3[0] + (-7.36 - toe3[0]) * u, FLOOR7)
            p["legs"][0] = dict(p["legs"][0], foot="point", af=p["legs"][0]["shin"] - 10.0)
            p = pin_toe(p, 0, tgt)
        # a cartwheel always touches the mat: the lowest ink onto it, and that must be a support
        g = snap_y(front_pose(p), FLOOR7)
        low = ink_pts(g)[np.argmax(ink_pts(g)[:, 1])]
        supports = [back[0], lead[0], hand1[0], hand2[0], toe3[0], 7.26, -7.36]
        if 5.4 < T < 7.0:
            supports.append(toe3[0] + (-7.36 - toe3[0]) * ease((T - 5.4) / 1.6, "io"))
        assert min(abs(low[0] - x) for x in supports) < 14.0, f"T={T}: the lowest ink at x={low[0]:.1f} is no support"
        return g

    plan = [0.0, 0.3, 0.65, 1.0, 1.3, 1.58, 1.84, 2.0, 2.3, 2.56, 2.8, 3.0, 3.2, 3.4, 3.6, 3.8, 4.0, 4.2, 4.4,
            4.62, 4.84, 5.06, 5.24, 5.4, 5.62, 5.86, 6.1, 6.34, 6.58, 6.8, 7.0]
    fr = []
    for T in plan:
        name = names[times.index(T)] if T in times else None
        if name not in ("cart1", "cart2", "cart3", "salute"):
            name = None  # step / reach / hand / land shape the track; only the approved poses are keys
        if name in ("cart1", "cart2", "cart3"):
            fr.append(approved_frame(name, name, ko[name])[0])
        elif name == "salute":
            g, J = FP.salute()
            fr.append(Frame(g=to_file(g, "salute"), key="salute", exact="salute"))
        else:
            fr.append(Frame(g=to_file(at(T), "salute"), key=name))
    keyOrigins = {n: ko[n] for n in ("cart1", "cart2", "cart3", "salute")}
    return dict(id="enrollCartwheel", pose="salute", note="enrollCartwheel → POSES.salute (enrollment band): one cartwheel through the approved cart1, cart2, cart3 into the salute, travelling right; keyOrigins place each key pose.", frames=fr, ghosts=["cart1", "cart2", "cart3"], keyOrigins=keyOrigins)


EXERCISES = {
    "starJump": e1_frames,
    "beamCartwheel": e2_frames,
    "barCast": e3_frames,
    "vaultHandspring": e4_frames,
    "aerobicKick": e5_frames,
    "coachScale": e6_frames,
    "enrollCartwheel": e7_frames,
}


# ------------------------------------------------------------------ output
def bounds_of(paths):
    xs, ys = [], []
    for d in paths:
        for ring in path_points(d):
            for x, y in ring:
                xs.append(x)
                ys.append(y)
    return [math.floor(min(xs) * 10) / 10, math.floor(min(ys) * 10) / 10, math.ceil(max(xs) * 10) / 10, math.ceil(max(ys) * 10) / 10]


def build(eid):
    spec = EXERCISES[eid]()
    frames = spec["frames"]
    paths = [f.path() for f in frames]
    keys = [i for i, f in enumerate(frames) if f.key]
    names = [frames[i].key for i in keys]
    assert keys[-1] == len(frames) - 1, "the last frame is the last key"
    assert paths[-1] == FP.POSES[spec["pose"]]["d"], "the last frame is the approved pose"
    for f, d in zip(frames, paths):
        if f.exact and f.g is None:  # a placed approved pose: the same relative drawing
            assert d.split("l", 1)[1] == FP.POSES[f.exact]["d"].split("l", 1)[1], f.key
    ghosts = [keys[names.index(n)] for n in spec.get("ghosts", [])]
    out = {"id": eid, "pose": spec["pose"], "note": spec["note"], "frames": paths, "keys": keys, "keyNames": names, "ghosts": ghosts}
    if "keyOrigins" in spec:
        out["keyOrigins"] = [list(spec["keyOrigins"][n]) for n in names]
    out["bounds"] = bounds_of(paths)
    return out, spec


def write(rec):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{rec['id']}.json")
    with open(path, "w") as fh:
        json.dump(rec, fh, indent=1)
        fh.write("\n")
    return path


if __name__ == "__main__":
    import gzip
    ids = sys.argv[1:] or list(EXERCISES)
    for eid in ids:
        rec, _ = build(eid)
        path = write(rec)
        raw = sum(len(d) for d in rec["frames"])
        gz = len(gzip.compress(json.dumps(rec["frames"]).encode(), 9))
        print(f"{eid:16s} {len(rec['frames']):3d} frames  keys {rec['keys']}  ghosts {rec['ghosts']}  raw {raw:6d}  gz~{gz:5d}  bounds {rec['bounds']}")
