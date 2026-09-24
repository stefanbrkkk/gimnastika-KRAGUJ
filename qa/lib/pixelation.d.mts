export interface MosaicGrid {
  source: string;
  x: number;
  y: number;
  blockW: number;
  blockH: number;
  cols: number;
  rows: number;
}
export interface MosaicMetrics {
  medianStd: number;
  ratio: number;
  spread: number;
}
export interface Photo08Check {
  file: string;
  width: number;
  mosaic: MosaicMetrics;
  control: MosaicMetrics;
  pixelated: boolean;
  controlLooksNatural: boolean;
}
export const PHOTO08_MOSAIC: MosaicGrid;
export const PHOTO08_CONTROL: MosaicGrid;
export const THRESHOLDS: { maxMedianStd: number; minRatio: number; minSpread: number };
export function greyscale(input: string | Buffer): Promise<{ data: Buffer; width: number; height: number }>;
export function mosaicMetrics(img: { data: Buffer; width: number; height: number }, grid?: MosaicGrid): MosaicMetrics;
export function isPixelated(m: MosaicMetrics, t?: { maxMedianStd: number; minRatio: number; minSpread: number }): boolean;
export function checkPhoto08(file: string): Promise<Photo08Check>;
