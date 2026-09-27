// The one svgo configuration for the brand SVGs: the logo files, the pose family (scripts/svg.mjs)
// and the exercise frames (scripts/exercises.mjs) are normalised identically, so an exercise's
// last frame is byte-for-byte its pose's path.
export const svgoConfig = {
  floatPrecision: 1,
  multipass: true,
  plugins: [
    { name: "preset-default", params: { overrides: { cleanupIds: false } } },
  ],
};
