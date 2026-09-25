/**
 * Programs (§5 S3). One color = one program, identical in S3, S4 and S9 filters,
 * always paired with a text label.
 */
import type { ProgramId, ScheduleGroup } from "./schedule";

export type ApparatusIcon = "parter" | "greda" | "razboj" | "preskok" | "aerobik";

export interface Program {
  id: ProgramId;
  /** Card order number, 1-based. */
  n: number;
  title: string;
  /** Short title for chips / filters. */
  short: string;
  /** Age line; null when the club gave no age for the program. */
  age: string | null;
  /** Program color (§5): used only as a swatch/fill, never as text color. */
  color: string;
  /** True when the color is dark enough to need light content on top of it. */
  colorIsDark: boolean;
  icon: ApparatusIcon;
  /** Accessible name for the apparatus icon. */
  iconLabel: string;
  description: string;
  /** Schedule groups belonging to this program, with optional sub-labels. */
  groups: readonly { id: ScheduleGroup["id"]; label?: string }[];
  /** Ages for the program-age filter chips in S3 (inclusive). null = not age-bound. */
  ageRange: readonly [number, number] | null;
  hidden?: boolean;
}

export const PROGRAMS: readonly Program[] = [
  {
    id: "mladja",
    n: 1,
    title: "Mlađa početna grupa",
    short: "Mlađa početna",
    age: "3–8 godina",
    color: "#cfe6ff",
    colorIsDark: false,
    icon: "parter",
    iconLabel: "Parter",
    description: "Prvi koraci u gimnastici: koordinacija, ravnoteža, gipkost i hrabrost — kroz igru, uz trenericu.",
    groups: [{ id: "mladja" }],
    ageRange: [3, 8],
  },
  {
    id: "starija",
    n: 2,
    title: "Starija početna grupa",
    short: "Starija početna",
    age: "od 8 godina",
    color: "#8da9c6",
    colorIsDark: false,
    icon: "greda",
    iconLabel: "Greda",
    description:
      "Za decu koja tek počinju, a imaju 8 i više godina: osnovni elementi na parteru i spravama, snaga i pravilno držanje.",
    groups: [{ id: "starija" }],
    ageRange: [8, 18],
  },
  {
    id: "c-program",
    n: 3,
    title: "Takmičarke — C program",
    short: "C program",
    age: null,
    color: "#457cb3",
    colorIsDark: true,
    icon: "razboj",
    iconLabel: "Dvovisinski razboj",
    description: "Takmičarske grupe po C programu Gimnastičkog saveza Srbije.",
    groups: [
      { id: "c-starije", label: "Starije" },
      { id: "c-mladje", label: "Mlađe" },
    ],
    ageRange: null,
  },
  {
    id: "ab-program",
    n: 4,
    title: "Takmičarke — A i B program",
    short: "A i B program",
    age: null,
    color: "#112d5f",
    colorIsDark: true,
    icon: "preskok",
    iconLabel: "Preskok",
    description: "Takmičarska grupa A i B programa Gimnastičkog saveza Srbije — treninzi pet dana u nedelji.",
    groups: [{ id: "ab" }],
    ageRange: null,
  },
  {
    id: "aerobik",
    n: 5,
    title: "Aerobna gimnastika",
    short: "Aerobna gimnastika",
    age: null,
    color: "#c9b8ff",
    colorIsDark: false,
    icon: "aerobik",
    iconLabel: "Aerobik",
    description:
      "Gimnastika uz muziku: koreografija, skokovi, snaga i izdržljivost. Nastupamo na takmičenjima Gimnastičkog saveza Srbije.",
    groups: [{ id: "aerobik" }],
    ageRange: null,
  },
  // TODO(klub): Trampolina — only in the Instagram bio, copy not provided. Shown only if FLAGS.SHOW_TRAMPOLINE.
  {
    id: "trampolina",
    n: 6,
    title: "Trampolina",
    short: "Trampolina",
    age: null,
    color: "#eef3fa",
    colorIsDark: false,
    icon: "parter",
    iconLabel: "Trampolina",
    description: "",
    groups: [],
    ageRange: null,
    hidden: true,
  },
];

export const programById = (id: ProgramId): Program => {
  const p = PROGRAMS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown program ${id}`);
  return p;
};

/** Programs visible under the current flags. */
export const visiblePrograms = (showTrampoline: boolean): readonly Program[] =>
  PROGRAMS.filter((p) => (p.id === "trampolina" ? showTrampoline && p.description !== "" : !p.hidden));

export const PROGRAMS_COPY = {
  heading: "Programi",
} as const;
