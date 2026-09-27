"""Technique B pose helpers: a skeleton in the logo's proportions, skinned by figure.py into ONE
filled outline. side_figure() builds a profile figure (the logo's own head), front_figure() a
frontal one (cartwheel, straddle, salute); ik2() and settle() place hands and feet on supports.

(The exploratory pose library that grew here during pose authoring was trimmed to the helpers the
approved family and the exercises use; final_poses.py holds the approved poses.)
"""
import math

import numpy as np

from figure import *

HEAD_OFF = HEAD_AXIS - (-91.0)  # the logo head's tilt against its spine (chin level, gaze forward)


def shoulder_for(neck, u, front, a_up, off=(0.0, 0.0)):
    d = V(a_up)
    s = neck - u * 7.0 + front * (1.5 + 5.0 * float(np.dot(d, front))) + u * (2.5 * max(0.0, float(np.dot(d, u))))
    return s + front * off[0] + u * off[1]


def side_figure(H, a_low, a_high, legs, arms, head_tilt=0.0, spread=4.0, parts_extra=(), sigma=1.1, close=1.8):
    """Profile figure facing +x when upright. H = hip centre; a_low / a_high = the spine's
    direction at the hip / at the neck (deg, screen convention); legs / arms = dicts of bone
    angles (or an "ik" target for the ankle / wrist). Returns (geometry, joints)."""
    H = np.array(H, float)
    u_low, u_high = V(a_low), V(a_high)
    f_low, f_high = perp(u_low), perp(u_high)
    tor, sp = torso_side(H, a_low, a_high)
    neck = sp[-1]
    parts = [tor, head_at(neck + u_high * 2.0, a_high + HEAD_OFF + head_tilt)]
    J = {"neck": neck, "hip": H}
    for i, L in enumerate(legs):
        if "ik" in L:  # ankle target
            hip0 = hip_for(H, f_low, u_low, L.get("thigh_hint", 90), L.get("spread", spread))
            L = dict(L); L["thigh"], L["shin"] = ik2(hip0, L["ik"], THIGH, SHIN, L.get("bend", 1))
        hip = hip_for(H, f_low, u_low, L["thigh"], L.get("spread", spread))
        g, knee, ank, toe = leg(hip, L["thigh"], L["shin"], L.get("foot", "point"), L.get("af"), L.get("side", 1))
        parts.append(g)
        J[f"toe{i}"] = toe; J[f"ank{i}"] = ank; J[f"knee{i}"] = knee
    for i, A in enumerate(arms):
        if "ik" in A:  # wrist target
            sh0 = shoulder_for(neck, u_high, f_high, A.get("up_hint", 90), A.get("off", (0, 0)))
            A = dict(A); A["up"], A["fore"] = ik2(sh0, A["ik"], UPPER, FORE, A.get("bend", 1))
        sh = shoulder_for(neck, u_high, f_high, A["up"], A.get("off", (0, 0)))
        g, el, wr, tip = arm(sh, A["up"], A.get("fore", A["up"]), A.get("ah"), A.get("hand", "flat"))
        parts.append(g)
        J[f"wr{i}"] = wr; J[f"tip{i}"] = tip; J[f"sh{i}"] = sh
    parts += list(parts_extra)
    return finish(parts, close=close, sigma=sigma), J


def front_figure(H, a, legs, arms, head_tilt=0.0, sigma=1.1, close=1.8, hip_x=7.5):
    """Frontal body (cartwheel star, straddle, salute). a = spine direction hip -> neck;
    s = -1 / +1 picks the hip / shoulder on the figure's own left / right axis."""
    H = np.array(H, float)
    u = V(a)
    r = perp(u)  # the figure's own left/right axis
    tor, pts = torso_front(H, a)
    neck = pts[-1]
    parts = [tor, head_front(neck + u * 1.0, a + head_tilt)]
    J = {"neck": neck, "hip": H}
    for i, L in enumerate(legs):
        s = L["s"]  # -1 / +1: which hip
        hip = H + r * s * hip_x - u * 1.0
        g, knee, ank, toe = leg(hip, L["thigh"], L["shin"], L.get("foot", "point"), L.get("af"), L.get("side", 1), frontal=True)
        parts.append(g)
        J[f"toe{i}"] = toe; J[f"ank{i}"] = ank
    for i, A in enumerate(arms):
        s = A["s"]
        sh = neck - u * 7.5 + r * s * 12.0
        g, el, wr, tip = arm(sh, A["up"], A.get("fore", A["up"]), A.get("ah"), A.get("hand", "flat"))
        parts.append(g)
        J[f"wr{i}"] = wr; J[f"tip{i}"] = tip
    return finish(parts, close=close, sigma=sigma), J


def ik2(P, T, a, b, bend=1):
    """2-bone IK: angles (deg) of bone 1 and bone 2 from P so the chain ends at T.
    bend=+1 puts the middle joint on the left of P->T (screen), -1 on the right."""
    P = np.array(P, float); T = np.array(T, float)
    d = T - P; dist = min(np.hypot(*d), a + b - 1e-3)
    base = math.degrees(math.atan2(d[1], d[0]))
    cosA = (a * a + dist * dist - b * b) / (2 * a * dist)
    A = math.degrees(math.acos(max(-1, min(1, cosA))))
    a1 = base - bend * A
    M = P + V(a1) * a
    a2 = math.degrees(math.atan2(T[1] - M[1], T[0] - M[0]))
    return a1, a2


def settle(build, contacts, lo=-40, hi=40):
    """Turn the whole figure (via its build(dtheta)) until both contact points are level."""
    def diff(t):
        g, J = build(t)
        return J[contacts[0]][1] - J[contacts[1]][1]
    f_lo, f_hi = diff(lo), diff(hi)
    for _ in range(40):
        mid = (lo + hi) / 2
        f_mid = diff(mid)
        if (f_mid > 0) == (f_lo > 0):
            lo, f_lo = mid, f_mid
        else:
            hi = mid
    return build((lo + hi) / 2)
