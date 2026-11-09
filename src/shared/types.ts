export const CATEGORY_IDS = [
  "ragebait",
  "toxicity",
  "ai_slop",
  "doom",
  "clickbait",
  "spam",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export const SITE_IDS = [
  "x",
  "reddit",
  "facebook",
  "instagram",
  "threads",
  "youtube",
  "linkedin",
  "tiktok",
  "bsky",
] as const;

export type SiteId = (typeof SITE_IDS)[number];

export const MODE_IDS = ["soft", "cover", "line"] as const;

export type Mode = (typeof MODE_IDS)[number];

export type Lang = "pl" | "en";

export type UiLang = "pl" | "cs";

export interface CloudSettings {
  /** Dopasowanie fraz z paczki. Nie wychodzi z przeglądarki. */
  embedded: boolean;
  /** Prawdziwy lekki model w przeglądarce. Wagi pobiera raz i zostawia u siebie. */
  neural: boolean;
  /** Opcjonalny większy model: Ollama na localhost albo zdalny https. */
  enabled: boolean;
  endpoint: string;
  model: string;
  apiKey: string;
}

export interface Settings {
  enabled: boolean;
  sensitivity: number;
  mode: Mode;
  language: Lang;
  ui: UiLang;
  showReason: boolean;
  dark: boolean;
  categories: Record<CategoryId, boolean>;
  sites: Record<SiteId, boolean>;
  allowAuthors: string[];
  allowPhrases: string[];
  blockPhrases: string[];
  cloud: CloudSettings;
}

export interface SettingsPatch {
  enabled?: boolean;
  sensitivity?: number;
  mode?: Mode;
  language?: Lang;
  ui?: UiLang;
  showReason?: boolean;
  dark?: boolean;
  categories?: Partial<Record<CategoryId, boolean>>;
  sites?: Partial<Record<SiteId, boolean>>;
  allowAuthors?: string[];
  allowPhrases?: string[];
  blockPhrases?: string[];
  cloud?: Partial<CloudSettings>;
}

export interface Scores {
  ragebait: number;
  toxicity: number;
  ai_slop: number;
  doom: number;
  clickbait: number;
  spam: number;
}

export interface Verdict {
  hide: boolean;
  scores: Scores;
  top: CategoryId | null;
  reasons: string[];
  custom: boolean;
  threshold: number;
}

export interface DayStat {
  day: string;
  total: number;
  custom: number;
  byCategory: Scores;
  byHost: Record<string, number>;
}

export interface Stats {
  allTime: number;
  today: DayStat;
  history: DayStat[];
}

export interface AnalysisInput {
  text: string;
  sensitivity: number;
  categories: Record<CategoryId, boolean>;
  allowPhrases: readonly string[];
  blockPhrases: readonly string[];
  promoted: boolean;
}

export type ClientMessage =
  | { type: "get-state"; tabId?: number }
  | { type: "patch-settings"; patch: SettingsPatch }
  | { type: "set-paused"; tabId: number; paused: boolean }
  | { type: "allow-author"; author: string }
  | { type: "record-hit"; category: CategoryId | null; custom: boolean; host: string }
  | { type: "set-badge"; total: number; counts: Scores; custom: number }
  | { type: "classify-neural"; text: string }
  | { type: "neural-status" }
  | { type: "classify-cloud"; text: string }
  | { type: "test-cloud"; endpoint: string; model: string; apiKey: string }
  | { type: "reset" };

export interface StatePayload {
  ok: true;
  settings: Settings;
  stats: Stats;
  paused: boolean;
  tabUrl: string | null;
  tabId: number | null;
}

export type Ack = { ok: true } | { ok: false; error: string };

export type CloudResult = { ok: true; scores: Scores } | { ok: false; error: string };

export type NeuralStatus = {
  ok: true;
  phase: "off" | "idle" | "loading" | "ready" | "error";
  detail: string;
};
