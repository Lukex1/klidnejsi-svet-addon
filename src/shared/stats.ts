import { CATEGORY_IDS, type CategoryId, type DayStat, type Scores, type Stats } from "./types.ts";

export function emptyScores(): Scores {
  return {
    ragebait: 0,
    toxicity: 0,
    ai_slop: 0,
    doom: 0,
    clickbait: 0,
    spam: 0,
  };
}

export function todayKey(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function emptyDay(day = todayKey()): DayStat {
  return {
    day,
    total: 0,
    custom: 0,
    byCategory: emptyScores(),
    byHost: {},
  };
}

export function emptyStats(): Stats {
  return {
    allTime: 0,
    today: emptyDay(),
    history: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function copyScores(value: unknown, fallback: Scores): Scores {
  const source = isRecord(value) ? value : {};
  const scores = emptyScores();
  for (const id of CATEGORY_IDS) {
    const raw = source[id];
    const parsed = typeof raw === "number" ? raw : fallback[id];
    scores[id] = Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
  }
  return scores;
}

function copyHost(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const out: Record<string, number> = {};
  for (const [host, total] of Object.entries(value)) {
    if (typeof total !== "number" || !Number.isFinite(total)) continue;
    out[host.slice(0, 80)] = Math.max(0, Math.round(total));
  }
  return out;
}

function copyDay(value: unknown, fallback: DayStat): DayStat {
  const source = isRecord(value) ? value : {};
  const day = typeof source.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(source.day) ? source.day : fallback.day;
  return {
    day,
    total: typeof source.total === "number" && Number.isFinite(source.total) ? Math.max(0, Math.round(source.total)) : 0,
    custom: typeof source.custom === "number" && Number.isFinite(source.custom) ? Math.max(0, Math.round(source.custom)) : 0,
    byCategory: copyScores(source.byCategory, fallback.byCategory),
    byHost: copyHost(source.byHost),
  };
}

export function mergeStats(value: unknown): Stats {
  const base = emptyStats();
  if (!isRecord(value)) return base;
  const historyRaw = Array.isArray(value.history) ? value.history : [];
  return {
    allTime: typeof value.allTime === "number" && Number.isFinite(value.allTime) ? Math.max(0, Math.round(value.allTime)) : 0,
    today: copyDay(value.today, base.today),
    history: historyRaw.slice(0, 13).map((item) => copyDay(item, emptyDay("1970-01-01"))),
  };
}

function roll(stats: Stats, now = new Date()): Stats {
  const day = todayKey(now);
  if (stats.today.day === day) return stats;
  const archived: DayStat = {
    ...stats.today,
    byCategory: { ...stats.today.byCategory },
    byHost: { ...stats.today.byHost },
  };
  return {
    ...stats,
    today: emptyDay(day),
    history: [archived, ...stats.history].slice(0, 13),
  };
}

export function recordHit(
  stats: Stats,
  category: CategoryId | null,
  custom: boolean,
  host: string,
  now = new Date(),
): Stats {
  const next = roll(stats, now);
  const key = host.toLowerCase().replace(/^www\./, "").slice(0, 80);
  const byHost = { ...next.today.byHost };
  if (key) byHost[key] = (byHost[key] ?? 0) + 1;
  const byCategory = { ...next.today.byCategory };
  if (category) byCategory[category] += 1;
  return {
    allTime: next.allTime + 1,
    history: next.history,
    today: {
      ...next.today,
      total: next.today.total + 1,
      custom: next.today.custom + (category ? 0 : custom ? 1 : 0),
      byCategory,
      byHost,
    },
  };
}

export function recentDays(stats: Stats, count = 14, now = new Date()): { day: string; total: number }[] {
  const totals = new Map<string, number>();
  totals.set(stats.today.day, stats.today.total);
  for (const item of stats.history) totals.set(item.day, item.total);
  const days: { day: string; total: number }[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    const key = todayKey(date);
    days.push({ day: key, total: totals.get(key) ?? 0 });
  }
  return days;
}

export function topHosts(stats: Stats, limit = 5): { host: string; total: number }[] {
  return Object.entries(stats.today.byHost)
    .map(([host, total]) => ({ host, total: total ?? 0 }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}
