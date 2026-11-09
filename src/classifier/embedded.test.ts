import { expect, test } from "bun:test";
import { applyEmbedded } from "./embedded.ts";
import { analyze } from "./score.ts";
import { defaultSettings } from "../shared/settings.ts";

const base = defaultSettings();

function sample(text: string) {
  return {
    text,
    sensitivity: base.sensitivity,
    categories: base.categories,
    allowPhrases: [],
    blockPhrases: [],
    promoted: false,
  };
}

test("the packed model catches a phrase with a word shoved in the middle", () => {
  const text = "Nikt wam dzisiaj tego nie powie.";
  const exact = analyze(sample(text));
  expect(exact.hide).toBe(false);
  const blended = applyEmbedded(exact, sample(text));
  expect(blended.hide).toBe(true);
  expect(blended.top).toBe("ragebait");
});

test("a calm sentence still does not trip the packed model", () => {
  const text = "Rano padało, potem wyszło słońce i kawa smakowała lepiej niż wczoraj.";
  const verdict = applyEmbedded(analyze(sample(text)), sample(text));
  expect(verdict.hide).toBe(false);
  expect(verdict.scores.ragebait).toBe(0);
});
