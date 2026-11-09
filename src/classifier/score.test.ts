import { describe, expect, test } from "bun:test";
import { analyze, isUncertain, thresholdFor } from "./score.ts";
import { defaultSettings } from "../shared/settings.ts";
import type { AnalysisInput, CategoryId } from "../shared/types.ts";

function input(text: string, patch: Partial<AnalysisInput> = {}): AnalysisInput {
  const base = defaultSettings();
  return {
    text,
    sensitivity: patch.sensitivity ?? base.sensitivity,
    categories: { ...base.categories, ...patch.categories },
    allowPhrases: patch.allowPhrases ?? [],
    blockPhrases: patch.blockPhrases ?? [],
    promoted: patch.promoted ?? false,
  };
}

function off(category: CategoryId): Partial<AnalysisInput> {
  const categories = { ...defaultSettings().categories, [category]: false };
  return { categories };
}

describe("klsv classifier", () => {
  test("thresholds follow the sensitivity slider", () => {
    expect(thresholdFor(0)).toBe(88);
    expect(thresholdFor(58)).toBe(56);
    expect(thresholdFor(100)).toBe(33);
  });

  test("leaves an ordinary morning alone", () => {
    const verdict = analyze(input("Rano padało, potem wyszło słońce i kawa smakowała lepiej niż wczoraj."));
    expect(verdict.hide).toBe(false);
    expect(verdict.top).toBeNull();
  });

  test("hides a polish ragebait stack", () => {
    const verdict = analyze(
      input("Nikt wam tego nie powie. Czy wy jesteście ślepi? Zrobili z was idiotów i będziecie płakać!!!"),
    );
    expect(verdict.hide).toBe(true);
    expect(verdict.top).toBe("ragebait");
  });

  test("hides obvious ai sludge and can be told not to", () => {
    const text =
      "In today's fast-paced world, it's important to note that we must delve into the tapestry of innovation. Let's dive in.";
    expect(analyze(input(text)).top).toBe("ai_slop");
    expect(analyze(input(text)).hide).toBe(true);
    expect(analyze(input(text, off("ai_slop"))).hide).toBe(false);
  });

  test("hides a video made by a model", () => {
    const verdict = analyze(input("Ten film został wygenerowany przez AI. Sora, 12 sekund."));
    expect(verdict.hide).toBe(true);
    expect(verdict.top).toBe("ai_slop");
  });

  test("hides a direct insult", () => {
    const verdict = analyze(input("Jesteś żałosny, zamknij ryj, nikt cię tu nie chce."));
    expect(verdict.hide).toBe(true);
    expect(verdict.top).toBe("toxicity");
  });

  test("allow phrase wins and a private phrase always hides", () => {
    const rage = "Nikt wam tego nie powie, a słońce i tak wschodzi. Czy wy jesteście ślepi?";
    expect(analyze(input(rage, { allowPhrases: ["słońce"] })).hide).toBe(false);
    const calm = "Rano padało, potem wyszło słońce i kawa smakowała lepiej niż wczoraj.";
    const blocked = analyze(input(calm, { blockPhrases: ["kawa"] }));
    expect(blocked.hide).toBe(true);
    expect(blocked.custom).toBe(true);
  });

  test("sensitivity decides a single medium signal", () => {
    const text = "This makes my blood boil.";
    expect(analyze(input(text, { sensitivity: 100 })).hide).toBe(true);
    expect(analyze(input(text, { sensitivity: 15 })).hide).toBe(false);
  });

  test("promoted posts count as spam only when that category is on", () => {
    const text = "A quiet note about shoes for the weekend.";
    expect(analyze(input(text, { promoted: true })).hide).toBe(true);
    expect(analyze(input(text, { promoted: true, ...off("spam") })).hide).toBe(false);
  });

  test("shouting is only a signal, not a verdict by itself", () => {
    const verdict = analyze(input("TO JEST SAM KRZYK BEZ TREŚCI I BEZ SENSÓW KTÓRY NIC NIE MÓWI TYLKO TRWA"));
    expect(verdict.scores.ragebait).toBeGreaterThanOrEqual(26);
    expect(verdict.hide).toBe(false);
  });

  test("asks the model only near the threshold", () => {
    const text = "Czy wy jesteście ślepi dzisiaj?";
    const near = analyze(input(text));
    expect(near.hide).toBe(false);
    expect(isUncertain(near, input(text))).toBe(true);
    const calmText = "Rano padało, potem wyszło słońce i kawa smakowała lepiej niż wczoraj.";
    expect(isUncertain(analyze(input(calmText)), input(calmText))).toBe(false);
  });
});
