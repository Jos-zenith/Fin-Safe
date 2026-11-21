// "55,000" next to a 00 key is easy to turn into "5,50,000". The keypad shows the amount in words so that is visible.
import { describe, expect, it } from "vitest";
import { amountInWords } from "@/lib/format";
import { translate } from "@/i18n";
import { en, hi, ta } from "./helpers";

const units = (lang: "en" | "hi" | "ta") => ({
  rupee: translate(lang, "amount.rupee"),
  rupees: translate(lang, "amount.rupees"),
  thousand: translate(lang, "amount.thousand"),
  lakh: translate(lang, "amount.lakh"),
  crore: translate(lang, "amount.crore"),
});

describe("amountInWords", () => {
  const U = units("en");
  const words = (n: number) => amountInWords(n, "en", U);

  it("says nothing for zero", () => {
    expect(words(0)).toBe("");
    expect(words(Number.NaN)).toBe("");
  });

  it("spells out Indian units", () => {
    expect(words(1)).toBe("One rupee");
    expect(words(20)).toBe("Twenty rupees");
    expect(words(100)).toBe("One hundred rupees");
    expect(words(55000)).toBe("Fifty-five thousand rupees");
    expect(words(100000)).toBe("One lakh rupees");
    expect(words(125000)).toBe("One lakh twenty-five thousand rupees");
    expect(words(1234567)).toBe("Twelve lakh thirty-four thousand five hundred sixty-seven rupees");
    expect(words(10000000)).toBe("One crore rupees");
    expect(words(1000000000)).toBe("One hundred crore rupees");
  });

  it("makes the extra-zero mistake visible", () => {
    expect(words(55000)).not.toBe(words(550000));
    expect(words(550000)).toBe("Five lakh fifty thousand rupees");
  });

  it("keeps digits and adds the unit word in Hindi and Tamil", () => {
    expect(amountInWords(55000, "hi", units("hi"))).toBe("55 हज़ार रुपये");
    expect(amountInWords(125000, "hi", units("hi"))).toBe("1 लाख 25 हज़ार रुपये");
    expect(amountInWords(55000, "ta", units("ta"))).toBe("55 ஆயிரம் ரூபாய்");
  });

  it("has the unit words in every language", () => {
    for (const d of [en, hi, ta] as Record<string, string>[]) {
      for (const k of ["amount.rupee", "amount.rupees", "amount.thousand", "amount.lakh", "amount.crore"]) expect(d[k], k).toBeTruthy();
    }
  });
});
