# Photo consent ledger — GSU „Kraguj“ website

Per-image authorization record (brief rule: explicit ledger, fail closed).
Display mapping is as of `df23f5d`; re-verify after the Programs×Schedule merge.

## Basis

- Owner relay 2026-09-28: the club emailed that it asked all parents and everyone
  agreed to children's photos on the website (club children and other clubs'
  children in camp groups alike), as a sports/achievement presentation.
- The email itself is archived by the owner and was **not inspected in this repo**.
- Photos 02/09 approval is therefore **secondhand** (via our club, not the other
  clubs' parents in writing) — highest residual risk; pull first if disputed.
- No names, birth dates, or per-child records are stored in the repo (alts are
  descriptive, names allow-list enforced by `qa/content.mjs`).

## Images

| ID | Frame | Subjects | Source file | Approved display |
|----|-------|----------|-------------|------------------|
| 01 | KR-01 | minors (team + medals) + 1 adult | `assets-source/slike/web/01-uspeh-medalje-ekipa.jpg` | Results photo, gallery |
| 02 | KR-02 | minors (camp group + certificates, ~40 girls, possibly other clubs) | `assets-source/slike/web/02-zajednica-kamp-grupa.jpg` | About pair, gallery (needs `CAMP_GROUP_PHOTOS`) |
| 03 | KR-03 | minors (club lineup under banner) | `assets-source/slike/web/03-hala-ceo-klub-baner.jpg` | About print, gallery |
| 04 | KR-04 | 1 minor (airtrack jump) | `assets-source/slike/web/04-trening-airtrack-skok.jpg` | Programs frame, gallery |
| 05 | KR-05 | adults only (master prompt; background distant) | `assets-source/slike/web/05-treneri-zajedno.jpg` | Coaches team photo, gallery (never gated) |
| 06 | KR-06 | adult (coach portrait) | `assets-source/slike/web/06-trener-portret-mladja.jpg` | Coaches card (never gated) |
| 08 | KR-08 | minors (aerobic team selfie, 1 face pixelated at source) | `assets-source/slike/web/08-aerobik-tim-selfie.jpg` | Gallery (always `noCrop`, never un-blur) |
| 09 | KR-09 | minors (camp group + certificates, possibly other clubs) | `assets-source/slike/web/09-kamp-hala-sertifikati.jpg` | Camp postcards, gallery (needs `CAMP_GROUP_PHOTOS`) |
| 10 | KR-10 | minors (camp park selfie) | `assets-source/slike/web/10-kamp-selfie-park.jpg` | Camp postcards, gallery |
| 11 | KR-11 | minors (camp climbing park) | `assets-source/slike/web/11-kamp-penjanje.jpg` | Camp postcards, gallery |
| 12 | KR-12 | minors (beam mural pose) | `assets-source/slike/web/12-greda-mural-poze.jpg` | Gallery |
| 14 | KR-14 | minors (beam mural + coach) | `assets-source/slike/rezerva/14-greda-mural-sa-trenerom.jpg` | Gallery |
| 15 | KR-15 | 1 minor (uneven bars) | `assets-source/slike/rezerva/15-razboj-trening-mutna.jpg` | Gallery |
| 16 | KR-16 | minors (camp lunch) | `assets-source/slike/rezerva/16-kamp-rucak.jpg` | Gallery (not in camp stack — needs club OK per DECISIONS) |
| 17 | KR-17 | no children (birthday cake) | `assets-source/slike/rezerva/17-torta-rodjendan-kluba-2019.jpg` | Timeline item (never gated) |

Excluded: candidate 07 (Slađana portrait slot — beauty-studio rights, never use);
reserve 13/18/19 are not registered in `content/photos.ts` and never build.

## Release rule

- Public URL requires `MINOR_PHOTOS=true` effective **and** this ledger's basis intact.
  `scripts/prune-out.ts` strips hidden files from `out/`; unknown flag values fail
  the build (`content/site.ts` strict parser). `noindex` is not consent.
