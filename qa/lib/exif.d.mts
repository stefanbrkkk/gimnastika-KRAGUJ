export interface MetadataReport {
  format: string;
  exif: string[];
  xmp: string[];
  iptc: string[];
  icc: string[];
}
export function inspectMetadata(buf: Buffer): MetadataReport;
export const IMAGE_EXT: RegExp;
