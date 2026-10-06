# Photo publication ledger — GSU „Kraguj“

Release decision, 28 September 2026, updated 29 September 2026. `publication` in `content/photos.ts` is the per-ID source of truth. `NEXT_PUBLIC_MINOR_PHOTOS` and `NEXT_PUBLIC_CAMP_GROUP_PHOTOS` are additional gates; neither can approve a pending or excluded frame. Source files stay outside `public/` and `out/`.

The club permits photos of **its own children at the seaside camp**, for which it says signed photo/video consent exists. The reply did not identify those frames by ID, and the files have no reliable location or consent mapping — seaside-camp frames stay pending until that mapping arrives, except where the owner explicitly instructs otherwise below. Permission to download Instagram photos does not authorize publication; written parental permissions are pending. The mixed-club white-shirt image is excluded.

Update 29 September 2026 (owner direct instruction): all club minors' frames approved
for publication — 01, 03, 04, 05, 08, 10, 11, 12, 14, 15, 16 — on the owner's
responsibility that parental consent covers them. Frames 02 and 09 (white-shirt
mixed-club groups, possibly other clubs' children) stay **excluded**: the owner
previously and explicitly ordered that image left out, so enabling them needs a
separate explicit instruction, not inference.

Update 30 September 2026 (owner explicit instruction "add all other images"):
frames 02 and 09 approved as well, on the owner's responsibility, with the
mixed-club risk explicitly noted and reversible at any time (flip back to
`"excluded"`). Written cross-club permissions are still recommended. Note both
frames additionally require the `CAMP_GROUP_PHOTOS` gate (see below).

| ID | Visual match / provenance | Publication |
|----|---------------------------|-------------|
| 01 | Coach kneeling with young medalists; exact "coach with her gymnasts" reference uncertain | Approved 29 Sep (owner instruction) |
| 02 | Indoor white-shirt “Gimnastički kamp 2026” certificate group, mixed-club risk | Approved 30 Sep (owner explicit instruction; cross-club permissions recommended) |
| 03 | Club lineup under banner; Instagram-sized source | Approved 29 Sep (owner instruction) |
| 04 | Gymnast on airtrack; Instagram-sized source | Approved 29 Sep (owner instruction) |
| 05 | Two coaches foreground, **children visible behind them** | Approved 29 Sep (owner instruction); not adults-only |
| 06 | Single coach portrait | Approved (adult) |
| 07 | Club-kit coach portrait, received 1 Oct 2026 | Approved (adult) |
| 08 | Aerobic team selfie with a pixelated face | Approved 29 Sep (owner instruction); never undo pixelation |
| 09 | Coach with white-shirt camp gymnasts and certificates indoors | Approved 30 Sep (owner explicit instruction; cross-club permissions recommended) |
| 10 | Coach and girls outdoors in a park; seaside-camp ID unproven | Approved 29 Sep (owner instruction) |
| 11 | Two girls at an outdoor climbing park; seaside-camp ID unproven | Approved 29 Sep (owner instruction) |
| 12 | Gymnasts on beam before mural | Approved 29 Sep (owner instruction) |
| 14 | Gymnasts and coach before mural | Approved 29 Sep (owner instruction) |
| 15 | One gymnast on uneven bars | Approved 29 Sep (owner instruction) |
| 16 | Camp meal with children and adults; seaside-camp ID unproven | Approved 29 Sep (owner instruction) |
| 17 | Birthday cake with no people | Approved (no people) |

ID 07 is now the club-kit coach portrait (received 1 Oct 2026); the old excluded beauty-studio portrait is gone. Reserve IDs 13/18/19 and Instagram screenshot 5657 are not registered for generation. The club cannot supply the exact 2023 medal count.

## Release check

Default build and malformed photo flags must not emit child images. Even `MINOR_PHOTOS=true` is insufficient until a child frame's `publication` changes with per-ID evidence. Image generation runs before every build and clears `public/img`; the export pruner checks the same predicate. Inspect `public/img`, `content/images.generated.json`, `out/img`, rendered HTML, RSC/JS payloads and direct URLs before any public deployment. `noindex` is not photo authorization.

## Update 6 October 2026 — Instagram competition photographs

Client email thread “Upit za sajt”: at 10:00 the club confirmed the parental
permissions had been collected and permitted more Instagram photographs; at
11:49 it explicitly approved the proposed competition/apparatus additions.
The site owner directly requested downloading/screenshotting that account and
adding the selected pictures to the website on 6 October 2026.

| ID | Source | Selection |
|----|--------|-----------|
| 18 | https://www.instagram.com/p/DWtgeBOjVbV/ | A-program team, source JPEG 1440×1920 |
| 19 | https://www.instagram.com/reel/DWtgmdNjdha/ | Competition beam cover, source JPEG 640×1136 |
| 20 | https://www.instagram.com/p/DWtgiekDeQV/ | First video, clean screenshot of supported position on bars, 570×770 |
| 21 | https://www.instagram.com/p/DV86l6XjXIZ/ | Three club medalists, clean screenshot 614×819 |

All four are approved under the above correspondence and owner request, and
remain behind the existing MINOR_PHOTOS gate. Captures contain no Instagram
controls or cursor. No faces were edited, no synthetic imagery was used, and no
new athlete names or medal counts were added. Frame 15 is retained in source
but removed from the gallery in favor of the clearer competition frame 20.

Production finalization: confirmed Vercel custom domain is
`https://www.gimnastikakraguj.rs` (apex redirects there). On 6 October 2026
NEXT_PUBLIC_SITE_URL was updated from the staging Vercel origin and
NEXT_PUBLIC_INDEXABLE enabled for production, following the client’s completed
consent confirmation and request to finish publication. Existing minor and camp
photo gates remain enabled exactly as in the prior production deployment.
