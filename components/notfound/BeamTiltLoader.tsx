"use client";

import dynamic from "next/dynamic";

/**
 * The root not-found boundary is part of the root layout's tree, so its client
 * code ships with every page. This loader is all that ships; the tilt logic is a
 * separate chunk fetched only when the 404 actually renders (after hydration).
 */
const BeamTiltMotion = dynamic(() => import("./BeamTiltMotion"), { ssr: false });

export function BeamTiltLoader({ label }: { label: string }) {
  return <BeamTiltMotion label={label} />;
}
