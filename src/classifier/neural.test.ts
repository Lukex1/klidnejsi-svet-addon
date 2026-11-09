import { expect, test } from "bun:test";
import { pointsFromMargin, scoresFromVectors } from "./neural.ts";
import { emptyScores } from "../shared/stats.ts";
import type { CategoryId } from "../shared/types.ts";

test("a vector close to ragebait and far from calm scores high", () => {
  const post = new Float32Array([1, 0, 0]);
  const calm = [new Float32Array([0, 1, 0])];
  const categories = {} as Record<CategoryId, Float32Array[]>;
  for (const id of Object.keys(emptyScores()) as CategoryId[]) {
    categories[id] = [new Float32Array([0, 0, 1])];
  }
  categories.ragebait = [post];
  const scores = scoresFromVectors(post, calm, categories);
  expect(scores.ragebait).toBe(100);
  expect(scores.toxicity).toBe(0);
});

test("margin below the calm band stays at zero", () => {
  expect(pointsFromMargin(0)).toBe(0);
  expect(pointsFromMargin(0.02)).toBe(0);
  expect(pointsFromMargin(0.2)).toBe(100);
});
