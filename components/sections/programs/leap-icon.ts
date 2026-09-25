/**
 * The club's leap silhouette (#leap, components/brand/Sprite.tsx) as a drawing in ProgramIcon's
 * 48-unit box — the aerobic-gymnastics plate (design review v2, QP2-06): 48 units wide (the
 * icon's own width), the front toe standing on the floor y = 42.
 * - LEAP_ICON_BOX places `<use href="#leap">`: the exact logo path from the page's sprite, drawn
 *   in the cards and the detail sheet.
 * - LEAP_ICON_D is the same outline as a plain path in icon units (flattened, simplified; within
 *   0.15 units of the logo outline — tests/programs.test.ts). It is the plate's static print
 *   (.pi-latent), which the quiz's plates read (quiz/views.ts iconArt reads paths, never <use>).
 * #leap's box is 230×150 (LEAP_VIEWBOX); the toe sits at 97.8% of its height. Not imported from
 * the generated sprite paths, so no path strings travel into the lazy sheet chunk.
 */
export const LEAP_ICON_BOX = { x: 0, y: 11.38, width: 48, height: 31.304 } as const;

export const LEAP_ICON_D =
  "M45.9 42l-2.7-.4-3.3-.8-3-.3-3.6-.1-6.8-.9-.9 0-.7 .4-1.2 .3-1.6 0-3.8-.7-3.8-1.1-4.1-.2-5-1.7-.5 .1-.7 .4-.4 0-.4-.2-1-1.4-1.8-1.1-.2-.4 .3-.3 1.5-.1 5.1 1.6 2.8 .4 2.2 .2 5.2 0 2.8 .2 .5-.1-.1-.8-.5-1.8 0-3.3-.4-2.2 .1-.7 .6-1.2 .1-.9-.3-.5-2.6-2.9-1.2-1.8-.8-1.2-.6-1.5-1.4-2.1-.5-1.1 .1-.2 .6 .2 .2-.2 .2-1.7 .2 0 .4 .2 .4-.1 .2 .4 .5 .1 .1 .8 0 .3-.5 1.2 .1 .8 4.6 5.9 .3-.1 .4-1.5 .2-.5 .8-.7 2.1-1 .5 0 .7 .4 .4 .6 .1 1.1 .4 1.2-.2 1.1-.8 1.5 .1 .5 .2 .2 1.4 .2 1.3 0 2.9-.7 3.1-.3 1.2-.3 1.4-.6 .8-.2 .9-.4 .4 .1-.1 .4-1 1.2-.3 .8-1.9 .1-3.7 1.1-3.3 .7-2.1 .7-.6 1-.4 3.2 0 1.1 .4 .8 1.3 1.6 .8 .7 3.9 1.7 6.2 1.1 4.8 1.6 2.6 .1 1 .6 .6 .6 .1 .3-.2 .4-1.1 .1z";
