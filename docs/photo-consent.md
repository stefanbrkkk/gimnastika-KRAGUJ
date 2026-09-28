# Photo publication ledger — GSU „Kraguj“

Release decision, 28 September 2026. `publication` in `content/photos.ts` is the per-ID source of truth. `NEXT_PUBLIC_MINOR_PHOTOS` and `NEXT_PUBLIC_CAMP_GROUP_PHOTOS` are additional gates; neither can approve a pending or excluded frame. Source files stay outside `public/` and `out/`.

The club permits photos of **its own children at the seaside camp**, for which it says signed photo/video consent exists. The reply did not identify those frames by ID, and the files have no reliable location or consent mapping. Outdoor camp frames therefore remain pending until that mapping is supplied. Permission to download Instagram photos does not authorize publication; written parental permissions are pending. The mixed-club white-shirt image is excluded.

| ID | Visual match / provenance | Publication |
|----|---------------------------|-------------|
| 01 | Coach kneeling with young medalists; exact "coach with her gymnasts" reference uncertain | Pending child consent |
| 02 | Indoor white-shirt “Gimnastički kamp 2026” certificate group, mixed-club risk | **Excluded**, regardless of flags |
| 03 | Club lineup under banner; Instagram-sized source | Pending written parent permission |
| 04 | Gymnast on airtrack; Instagram-sized source | Pending written parent permission |
| 05 | Two coaches foreground, **children visible behind them** | Pending child consent; not adults-only |
| 06 | Single coach portrait | Approved (adult) |
| 08 | Aerobic team selfie with a pixelated face | Pending child consent; never undo pixelation |
| 09 | Coach with white-shirt camp gymnasts and certificates indoors | **Excluded**, regardless of flags |
| 10 | Coach and girls outdoors in a park; seaside-camp ID unproven | Pending exact camp-photo match |
| 11 | Two girls at an outdoor climbing park; seaside-camp ID unproven | Pending exact camp-photo match |
| 12 | Gymnasts on beam before mural | Pending child consent |
| 14 | Gymnasts and coach before mural | Pending child consent |
| 15 | One gymnast on uneven bars | Pending child consent |
| 16 | Camp meal with children and adults; seaside-camp ID unproven | Pending exact camp-photo match |
| 17 | Birthday cake with no people | Approved (no people) |

ID 07 is an excluded beauty-studio portrait; Slađana has no uniform portrait yet. Reserve IDs 13/18/19 and Instagram screenshot 5657 are not registered for generation. The club cannot supply the exact 2023 medal count.

## Release check

Default build and malformed photo flags must not emit child images. Even `MINOR_PHOTOS=true` is insufficient until a child frame's `publication` changes with per-ID evidence. Image generation runs before every build and clears `public/img`; the export pruner checks the same predicate. Inspect `public/img`, `content/images.generated.json`, `out/img`, rendered HTML, RSC/JS payloads and direct URLs before any public deployment. `noindex` is not photo authorization.
