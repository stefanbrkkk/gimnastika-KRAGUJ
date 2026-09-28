import { describe, expect, it } from "vitest";
import { PHOTOS, mayPublishPhoto } from "@/content/photos";

const enabled = { MINOR_PHOTOS: true, CAMP_GROUP_PHOTOS: true };

describe("per-image publication rights", () => {
  it("publishes only individually cleared images even with both switches enabled", () => {
    const ids = Object.values(PHOTOS).filter((p) => mayPublishPhoto(p, enabled)).map((p) => p.id).sort();
    expect(ids).toEqual(["06", "17"]);
  });

  it("never publishes white-shirt groups, the coach with children in the background, or Instagram children", () => {
    for (const id of ["01", "02", "03", "04", "05", "08", "09", "10", "11", "12", "14", "15", "16"] as const) {
      expect(mayPublishPhoto(PHOTOS[id], enabled), id).toBe(false);
    }
  });

  it("absent-equivalent disabled flags do not expose children", () => {
    expect(Object.values(PHOTOS).filter((p) => mayPublishPhoto(p, { MINOR_PHOTOS: false, CAMP_GROUP_PHOTOS: false })).map((p) => p.id).sort()).toEqual(["06", "17"]);
  });
});
