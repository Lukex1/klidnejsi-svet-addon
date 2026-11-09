import { expect, test } from "bun:test";
import { badgeLine } from "./catalog.ts";
import { emptyScores } from "./stats.ts";
import type { CategoryId } from "./types.ts";

test("badge line keeps a mark for every enabled category", () => {
  const counts = emptyScores();
  counts.ragebait = 2;
  counts.spam = 1;
  const enabled = {
    ragebait: true,
    toxicity: false,
    ai_slop: true,
    doom: false,
    clickbait: false,
    spam: true,
  } satisfies Record<CategoryId, boolean>;
  expect(badgeLine(enabled, counts)).toBe("r:2 a:0 s:1");
  expect(badgeLine(enabled, counts, 3)).toBe("r:2 a:0 s:1 +:3");
});
