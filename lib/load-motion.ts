/**
 * Lazy entry to the motion system for islands in the initial bundle:
 *   const { gsap, loadFlip } = await loadMotion();
 * The gsap chunk is shared with the hero's motion layer, so it downloads once.
 */
export const loadMotion = () =>
  import("./motion").then((m) => {
    m.registerMotion();
    return m;
  });
