import { fold, isModelEndpoint } from "./text.ts";
import {
  CATEGORY_IDS,
  MODE_IDS,
  SITE_IDS,
  type CloudSettings,
  type Lang,
  type Mode,
  type UiLang,
  type Settings,
  type SiteId,
} from "./types.ts";

function allOn<T extends string>(ids: readonly T[]): Record<T, boolean> {
  const out = {} as Record<T, boolean>;
  for (const id of ids) out[id] = true;
  return out;
}

export function defaultCloud(): CloudSettings {
  return {
    embedded: true,
    neural: true,
    enabled: false,
    endpoint: "http://127.0.0.1:11434/v1/chat/completions",
    model: "qwen2.5:0.5b",
    apiKey: "",
  };
}

export function defaultSettings(): Settings {
  return {
    enabled: true,
    sensitivity: 58,
    mode: "soft",
    language: "pl",
    ui: "pl",
    showReason: true,
    dark: false,
    categories: allOn(CATEGORY_IDS),
    sites: allOn(SITE_IDS),
    allowAuthors: [],
    allowPhrases: [],
    blockPhrases: [],
    cloud: defaultCloud(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function choice<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function stringList(value: unknown, fallback: readonly string[], min: number, maxItems: number): string[] {
  if (!Array.isArray(value)) return [...fallback];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const text = item.trim();
    if (text.length < min || text.length > 80) continue;
    const key = fold(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
}

function boolMap<T extends string>(
  ids: readonly T[],
  value: unknown,
  fallback: Record<T, boolean>,
): Record<T, boolean> {
  const source = isRecord(value) ? value : {};
  const out = {} as Record<T, boolean>;
  for (const id of ids) {
    out[id] = bool(source[id], fallback[id]);
  }
  return out;
}

function cloudFrom(value: unknown, fallback: CloudSettings): CloudSettings {
  const source = isRecord(value) ? value : {};
  const endpointRaw = typeof source.endpoint === "string" ? source.endpoint.trim() : fallback.endpoint;
  const endpoint = !endpointRaw || isModelEndpoint(endpointRaw) ? endpointRaw : fallback.endpoint;
  const modelRaw = typeof source.model === "string" ? source.model.trim() : fallback.model;
  const apiKey = typeof source.apiKey === "string" ? source.apiKey.trim() : fallback.apiKey;
  return {
    embedded: bool(source.embedded, fallback.embedded),
    neural: bool(source.neural, fallback.neural),
    enabled: bool(source.enabled, fallback.enabled),
    endpoint: endpoint || fallback.endpoint,
    model: modelRaw.slice(0, 80) || fallback.model,
    apiKey: apiKey.slice(0, 300),
  };
}

export function mergeSettings(value: unknown, fallback = defaultSettings()): Settings {
  const source = isRecord(value) ? value : {};
  const language = choice<Lang>(source.language, ["pl", "en"], fallback.language);
  const ui = choice<UiLang>(source.ui, ["pl", "cs"], fallback.ui);
  return {
    enabled: bool(source.enabled, fallback.enabled),
    sensitivity: num(source.sensitivity, fallback.sensitivity, 0, 100),
    mode: choice<Mode>(source.mode, MODE_IDS, fallback.mode),
    language,
    ui,
    showReason: bool(source.showReason, fallback.showReason),
    dark: bool(source.dark, fallback.dark),
    categories: boolMap(CATEGORY_IDS, source.categories, fallback.categories),
    sites: boolMap(SITE_IDS, source.sites, fallback.sites),
    allowAuthors: stringList(source.allowAuthors, fallback.allowAuthors, 2, 200),
    allowPhrases: stringList(source.allowPhrases, fallback.allowPhrases, 3, 100),
    blockPhrases: stringList(source.blockPhrases, fallback.blockPhrases, 3, 100),
    cloud: cloudFrom(source.cloud, fallback.cloud),
  };
}

export function applyPatch(base: Settings, patch: unknown): Settings {
  if (!isRecord(patch)) return base;
  const merged: Record<string, unknown> = { ...base, ...patch };
  if (isRecord(patch.categories)) merged.categories = { ...base.categories, ...patch.categories };
  else delete merged.categories;
  if (isRecord(patch.sites)) merged.sites = { ...base.sites, ...patch.sites };
  else delete merged.sites;
  if (isRecord(patch.cloud)) merged.cloud = { ...base.cloud, ...patch.cloud };
  else delete merged.cloud;
  return mergeSettings(merged, base);
}

export function siteFromHost(hostname: string): SiteId | null {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  if (host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com")) {
    return "x";
  }
  if (host === "reddit.com" || host.endsWith(".reddit.com")) return "reddit";
  if (host === "facebook.com" || host.endsWith(".facebook.com")) return "facebook";
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
  if (host === "threads.net" || host.endsWith(".threads.net") || host === "threads.com" || host.endsWith(".threads.com")) {
    return "threads";
  }
  if (host === "youtube.com" || host.endsWith(".youtube.com")) return "youtube";
  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return "linkedin";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
  if (host === "bsky.app" || host.endsWith(".bsky.app")) return "bsky";
  return null;
}
