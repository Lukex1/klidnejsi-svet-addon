import { expect, test } from "bun:test";
import { applyPatch, defaultSettings } from "./settings.ts";
import { emptyDay, emptyStats, recentDays, recordHit } from "./stats.ts";
import { factAt } from "../replace/library.ts";

test("a small patch keeps the api key", () => {
  const base = defaultSettings();
  base.cloud.apiKey = "secret";
  const next = applyPatch(base, { enabled: false });
  expect(next.enabled).toBe(false);
  expect(next.cloud.apiKey).toBe("secret");
  expect(next.categories.ragebait).toBe(true);
});

test("stats roll over midnight and keep history", () => {
  let stats = emptyStats();
  stats = { ...stats, today: emptyDay("2026-01-01") };
  stats = recordHit(stats, "spam", false, "www.x.com", new Date(2026, 0, 1, 12));
  stats = recordHit(stats, "ragebait", false, "reddit.com", new Date(2026, 0, 2, 12));
  expect(stats.allTime).toBe(2);
  expect(stats.today.day).toBe("2026-01-02");
  expect(stats.today.byHost["reddit.com"]).toBe(1);
  expect(stats.history[0]?.day).toBe("2026-01-01");
  expect(stats.history[0]?.byHost["x.com"]).toBe(1);
  const days = recentDays(stats, 14, new Date(2026, 0, 2, 12));
  expect(days.at(-1)?.total).toBe(1);
});

test("the same post always gets the same fact", () => {
  const first = factAt("ten sam wpis");
  expect(factAt("ten sam wpis")).toEqual(first);
  expect(first.pl.length).toBeGreaterThan(20);
  expect(first.en.length).toBeGreaterThan(20);
});
