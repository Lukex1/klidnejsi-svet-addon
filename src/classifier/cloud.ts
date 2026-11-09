import { CATEGORY_IDS, type Scores } from "../shared/types.ts";
import { emptyScores } from "../shared/stats.ts";

export const CLOUD_SYSTEM = [
  "You classify one social-media post.",
  "Reply with JSON only, no markdown:",
  '{"scores":{"ragebait":0,"toxicity":0,"ai_slop":0,"doom":0,"clickbait":0,"spam":0}}',
  "Integers 0-100.",
  "ragebait = outrage bait, toxicity = insults or harassment, ai_slop = generic AI writing,",
  "doom = apocalyptic panic bait, clickbait = curiosity-gap hooks, spam = scams and promos.",
  "Ordinary opinions, news, and jokes stay low.",
].join(" ");

function clamp(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

export function parseCloudScores(raw: string): Scores | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const source =
    record.scores && typeof record.scores === "object"
      ? (record.scores as Record<string, unknown>)
      : record;
  const scores = emptyScores();
  let found = false;
  for (const id of CATEGORY_IDS) {
    if (!(id in source)) continue;
    scores[id] = clamp(source[id]);
    found = true;
  }
  return found ? scores : null;
}
