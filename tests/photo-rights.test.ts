import { describe, expect, it } from "vitest";
import { PHOTOS, mayPublishPhoto } from "@/content/photos";

const enabled = { MINOR_PHOTOS: true, CAMP_GROUP_PHOTOS: true };
const disabled = { MINOR_PHOTOS: false, CAMP_GROUP_PHOTOS: false };

const APPROVED = ["01", "03", "04", "05", "06", "08", "10", "11", "12", "14", "15", "16", "17"];

describe("per-image publication rights", () => {
  it("publishes individually cleared images when both switches are enabled", () => {
    const ids = Object.values(PHOTOS).filter((p) => mayPublishPhoto(p, enabled)).map((p) => p.id).sort();
    expect(ids).toEqual(APPROVED);
  });

  it("never publishes white-shirt mixed-club groups, whatever the flags say", () => {
    for (const flags of [enabled, disabled, { MINOR_PHOTOS: true, CAMP_GROUP_PHOTOS: false }, { MINOR_PHOTOS: false, CAMP_GROUP_PHOTOS: true }]) {
      for (const id of ["02", "09"] as const) expect(mayPublishPhoto(PHOTOS[id], flags), `${id} ${JSON.stringify(flags)}`).toBe(false);
    }
  });

  it("a single enabled switch cannot approve what the other gate withholds", () => {
    expect(
      Object.values(PHOTOS).filter((p) => mayPublishPhoto(p, { MINOR_PHOTOS: true, CAMP_GROUP_PHOTOS: false })).map((p) => p.id).sort(),
    ).toEqual(APPROVED);
    expect(
      Object.values(PHOTOS).filter((p) => mayPublishPhoto(p, { MINOR_PHOTOS: false, CAMP_GROUP_PHOTOS: true })).map((p) => p.id).sort(),
    ).toEqual(["06", "17"]);
  });

  it("absent-equivalent disabled flags expose only consent-free frames", () => {
    expect(Object.values(PHOTOS).filter((p) => mayPublishPhoto(p, disabled)).map((p) => p.id).sort()).toEqual(["06", "17"]);
  });
});
