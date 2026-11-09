import { CATEGORY_IDS, type CategoryId, type Mode, type Scores, type SiteId } from "./types.ts";

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  hint: string;
}

export const CATEGORIES: readonly CategoryMeta[] = [
  {
    id: "ragebait",
    label: "Prowokacja",
    hint: "Wpisy napisane tak, żeby wyciągnąć kłótnię.",
  },
  {
    id: "toxicity",
    label: "Szorstkie słowa",
    hint: "Obelgi, pogarda i nękanie.",
  },
  {
    id: "ai_slop",
    label: "Sztuczny połysk",
    hint: "Gładki tekst z generatora i filmy złożone przez model.",
  },
  {
    id: "doom",
    label: "Czarny scenariusz",
    hint: "Ciągły alarm zamiast treści.",
  },
  {
    id: "clickbait",
    label: "Pusta obietnica",
    hint: "Tytuł obiecuje coś, czego w środku nie ma.",
  },
  {
    id: "spam",
    label: "Nachalna reklama",
    hint: "Promocje i wstawione ogłoszenia.",
  },
];

export const SITES: readonly { id: SiteId; label: string }[] = [
  { id: "x", label: "X" },
  { id: "reddit", label: "Reddit" },
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "threads", label: "Threads" },
  { id: "youtube", label: "YouTube" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "tiktok", label: "TikTok" },
  { id: "bsky", label: "Bluesky" },
];

export const MODE_META: readonly { id: Mode; label: string; hint: string }[] = [
  {
    id: "soft",
    label: "Miękko",
    hint: "Wpis zostaje w tym samym miejscu, ale jest rozmyty. Na wierzchu leży ciekawostka.",
  },
  {
    id: "cover",
    label: "Zasłona",
    hint: "Treści nie widać wcale. Zostaje karta w kolorze tła strony.",
  },
  {
    id: "line",
    label: "Jedna linia",
    hint: "Mocniejsze rozmycie i jedno zdanie zamiast całego akapitu.",
  },
];

export const CATEGORY_MARK: Record<CategoryId, string> = {
  ragebait: "r",
  toxicity: "t",
  ai_slop: "a",
  doom: "d",
  clickbait: "c",
  spam: "s",
};

export function categoryLabel(id: CategoryId): string {
  return CATEGORIES.find((item) => item.id === id)?.label ?? id;
}

export function badgeLine(enabled: Record<CategoryId, boolean>, counts: Scores, custom = 0): string {
  const parts = CATEGORY_IDS.filter((id) => enabled[id]).map((id) => `${CATEGORY_MARK[id]}:${counts[id]}`);
  if (custom > 0) parts.push(`+:${custom}`);
  return parts.join(" ");
}

export function siteLabel(id: SiteId): string {
  return SITES.find((item) => item.id === id)?.label ?? id;
}

export function sensitivityLabel(value: number): string {
  if (value < 35) return "łagodna";
  if (value < 70) return "średnia";
  return "ostra";
}
