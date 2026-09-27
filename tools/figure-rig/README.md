# Figure rig

Authoring-time tooling for the gymnast figures (the site's build never runs Python). A calibrated
skeleton in the club logo's proportions, tapered limbs, the logo's own profile head, unioned into
one filled outline (shapely), filleted and smoothed, written as compact SVG path data.

| File | What it is |
|---|---|
| `figure.py` | Skinning: limbs, torso, heads, `finish()` (fillets, smoothing), `to_path()` |
| `logo_geom.py` | The logo's leap as a polygon, read from `components/brand/sprite-paths.generated.ts` (`LEAP_PATH`) |
| `poses_b.py` | Pose helpers: `side_figure()`, `front_figure()`, `ik2()`, `settle()` |
| `final_poses.py` | The approved pose family → `assets-source/poses/*.svg` |
| `exercises.py` | The scroll-scrubbed exercises → `assets-source/exercises/*.json` |

## Setup

```sh
python3 -m venv tools/figure-rig/.venv
tools/figure-rig/.venv/bin/pip install -r tools/figure-rig/requirements.txt
```

## Regenerate

```sh
tools/figure-rig/.venv/bin/python tools/figure-rig/final_poses.py   # approved poses (must stay byte-identical)
tools/figure-rig/.venv/bin/python tools/figure-rig/exercises.py     # all exercises, or name ids: starJump barCast …
npm run svg                                                         # → components/brand/*.generated.ts
```

`final_poses.py` must reproduce the committed `assets-source/poses/*.svg` byte for byte; check
with `git status` after running it. Changing an approved pose is a design decision, never a
side effect of tooling work.

## Outputs

- **Poses** (`assets-source/poses/<id>.svg`): one `fill="currentColor"` path in logo units at the
  logo figure's body scale, a 0-origin viewBox with 2 units of padding, floor and contact anchors
  as `data-*` attributes. `scripts/svg.mjs` turns them into `components/brand/poses.generated.ts`.
- **Exercises** (`assets-source/exercises/<id>.json`): `{ id, pose, note, frames, keys, keyNames,
  ghosts, keyOrigins?, bounds }`: the frames of one continuous movement that ends exactly in
  `pose`, every frame in that pose's own file coordinates (earlier frames may lie outside its
  viewBox). Key frames that are approved poses are the approved path, only placed (`keyOrigins`:
  where that pose's own origin lies, 0.1 grid); in-between frames use whole units and a coarser
  simplification (sub-pixel at the site's sizes). `scripts/exercises.mjs` normalises every frame
  with the poses' svgo pass, checks the contract, and writes one module per exercise to
  `components/brand/exercises/<id>.generated.ts`; `tests/exercises.test.ts` checks the scenes.

Every exercise is built from key parameter trees (bone angles, or IK targets for planted hands and
feet) interpolated with monotone cubics, so angles never swing back between keys and the motion
only stops where the movement really stops. Supports are pinned (a support foot, the grip on the
rail, the hands on the table) and every frame is snapped onto its floor or apparatus line.
