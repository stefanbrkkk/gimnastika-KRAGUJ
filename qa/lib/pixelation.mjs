// Photo 08 privacy check: the one face the club blurred was re-covered with a
// strong mosaic in assets-source/slike/web/08-aerobik-tim-selfie.jpg (2000×1500).
// The mosaic is a 9×10 grid of ~23.45 px blocks near the top centre
// (x 653.6–864.5, y 452.8–687.3 px). Its position is stored as fractions of the
// image size, so the same box works for every generated width (480/960/1600).
//
// Metrics, measured on greyscale pixels inside the grid:
//   medianStd — median luminance std-dev inside each block (25 % margin trimmed):
//               ≈0.4–2.6 for the mosaic, ≥10 for a real face.
//   ratio     — mean |Δ| across block boundaries ÷ mean |Δ| across block centres
//               (same distance): ≈7.5–9 for the mosaic, ≈0.85–1.3 for a real face.
//   spread    — std-dev of the block means: the mosaic still carries the face's
//               tones (≈65), so a blank/flat patch would also be noticed.
// A face that is "un-pixelated" (original restored, AI-upscaled, sharpened, or
// heavily re-blurred into a smooth patch) loses the block structure: ratio ≈ 1.
import sharp from "sharp";

export const PHOTO08_MOSAIC = {
  source: "assets-source/slike/web/08-aerobik-tim-selfie.jpg",
  x: 653.6 / 2000,
  y: 452.8 / 1500,
  blockW: 23.45 / 2000,
  blockH: 23.45 / 1500,
  cols: 9,
  rows: 10,
};

/** A real, un-pixelated face in the same photo (sanity control for the metric). */
export const PHOTO08_CONTROL = { ...PHOTO08_MOSAIC, x: 470 / 2000, y: 540 / 1500, cols: 8, rows: 9 };

export const THRESHOLDS = { maxMedianStd: 5, minRatio: 3, minSpread: 15 };

export async function greyscale(input) {
  const { data, info } = await sharp(input).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export function mosaicMetrics({ data, width, height }, grid = PHOTO08_MOSAIC) {
  const bw = grid.blockW * width;
  const bh = grid.blockH * height;
  const dx = Math.max(1, Math.round(bw * 0.25));
  const dy = Math.max(1, Math.round(bh * 0.25));
  const px = (x, y) => data[Math.min(height - 1, Math.max(0, Math.round(y))) * width + Math.min(width - 1, Math.max(0, Math.round(x)))];
  const stds = [];
  const means = [];
  let boundary = 0;
  let nb = 0;
  let interior = 0;
  let ni = 0;
  for (let j = 0; j < grid.rows; j++) {
    for (let i = 0; i < grid.cols; i++) {
      const x0 = grid.x * width + i * bw;
      const y0 = grid.y * height + j * bh;
      let n = 0;
      let m = 0;
      let m2 = 0;
      for (let y = Math.ceil(y0 + dy); y <= Math.floor(y0 + bh - dy); y++) {
        for (let x = Math.ceil(x0 + dx); x <= Math.floor(x0 + bw - dx); x++) {
          const v = data[y * width + x];
          n += 1;
          m += v;
          m2 += v * v;
        }
      }
      if (n > 0) {
        m /= n;
        means.push(m);
        stds.push(Math.sqrt(Math.max(0, m2 / n - m * m)));
      }
      const cx = x0 + bw / 2;
      const cy = y0 + bh / 2;
      for (let t = 0.3; t <= 0.71; t += 0.1) {
        const yy = y0 + bh * t;
        const xx = x0 + bw * t;
        interior += Math.abs(px(cx + dx, yy) - px(cx - dx, yy)) + Math.abs(px(xx, cy + dy) - px(xx, cy - dy));
        ni += 2;
        if (i > 0) {
          boundary += Math.abs(px(x0 + dx, yy) - px(x0 - dx, yy));
          nb += 1;
        }
        if (j > 0) {
          boundary += Math.abs(px(xx, y0 + dy) - px(xx, y0 - dy));
          nb += 1;
        }
      }
    }
  }
  const sorted = [...stds].sort((a, b) => a - b);
  const mu = means.reduce((a, b) => a + b, 0) / means.length;
  const round = (v) => Math.round(v * 100) / 100;
  return {
    medianStd: round(sorted[Math.floor(sorted.length / 2)] ?? NaN),
    ratio: round(boundary / nb / Math.max(0.25, interior / ni)),
    spread: round(Math.sqrt(means.reduce((a, b) => a + (b - mu) ** 2, 0) / means.length)),
  };
}

export function isPixelated(m, t = THRESHOLDS) {
  return m.medianStd <= t.maxMedianStd && m.ratio >= t.minRatio && m.spread >= t.minSpread;
}

/** Metrics for one image file: the mosaic box and the control face. */
export async function checkPhoto08(file) {
  const img = await greyscale(file);
  const mosaic = mosaicMetrics(img, PHOTO08_MOSAIC);
  const control = mosaicMetrics(img, PHOTO08_CONTROL);
  return { file, width: img.width, mosaic, control, pixelated: isPixelated(mosaic), controlLooksNatural: !isPixelated(control) };
}
