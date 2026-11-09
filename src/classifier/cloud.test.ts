import { expect, test } from "bun:test";
import { parseCloudScores } from "./cloud.ts";

test("reads scores wrapped in markdown", () => {
  const scores = parseCloudScores('```json\n{"scores":{"ragebait":80,"toxicity":0,"ai_slop":10,"doom":0,"clickbait":4,"spam":0}}\n```');
  expect(scores?.ragebait).toBe(80);
  expect(scores?.ai_slop).toBe(10);
});

test("rejects a sentence without scores", () => {
  expect(parseCloudScores("I would not hide this.")).toBeNull();
});
