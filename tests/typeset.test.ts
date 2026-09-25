import { describe, expect, it } from "vitest";
import { typesetSr } from "@/lib/typeset";

const NB = " ";
const show = (s: string) => s.replaceAll(NB, "~");

describe("typesetSr", () => {
  it("glues one-letter words to the next word, including chains", () => {
    expect(show(typesetSr("fizički, mentalni i emotivni razvoj"))).toBe("fizički, mentalni i~emotivni razvoj");
    expect(show(typesetSr("Takmičarke — A i B program"))).toBe("Takmičarke~— A~i~B~program");
    expect(show(typesetSr("1. mesto ekipno — I kolo B programa"))).toBe("1.~mesto ekipno~— I~kolo B~programa");
    expect(show(typesetSr("za decu u Kragujevcu"))).toBe("za decu u~Kragujevcu");
  });

  it("never lets a spaced dash start a line", () => {
    expect(show(typesetSr("Od prvog koluta do postolja — licencirane"))).toBe("Od prvog koluta do postolja~— licencirane");
  });

  it("keeps numbers with their words, dates and phone numbers whole", () => {
    expect(show(typesetSr("42 registrovane takmičarke"))).toBe("42~registrovane takmičarke");
    expect(show(typesetSr("za decu već od 3. godine."))).toBe("za decu već od 3.~godine.");
    expect(show(typesetSr("Beograd, 2. 12. 2023."))).toBe("Beograd, 2.~12.~2023.");
    expect(show(typesetSr("Pozovite 060 028 7631"))).toBe("Pozovite 060~028~7631");
  });

  it("leaves times, codes and multi-letter words alone", () => {
    expect(typesetSr("Po, Sr, Pe 18:00–19:00")).toBe("Po, Sr, Pe 18:00–19:00");
    expect(typesetSr("KR-01 Galerija")).toBe("KR-01 Galerija");
    expect(typesetSr("od 2007.")).toBe("od 2007.");
  });

  it("changes only whitespace (visible text is identical)", () => {
    const src = "Naša misija je da kroz gimnastiku podržimo pravilan fizički, mentalni i emotivni razvoj dece i mladih — od prvih koraka.";
    expect(typesetSr(src).replaceAll(NB, " ")).toBe(src);
  });
});
