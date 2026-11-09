import { fold } from "../shared/text.ts";
import {
  CATEGORY_IDS,
  type AnalysisInput,
  type CategoryId,
  type Scores,
  type Verdict,
} from "../shared/types.ts";
import { emptyScores } from "../shared/stats.ts";
import { PHRASES } from "./phrases.ts";

interface Rule {
  phrase: string;
  category: CategoryId;
  weight: number;
  needle: string;
}

const RULES: readonly Rule[] = PHRASES.map((phrase) => ({
  phrase: phrase.phrase,
  category: phrase.category,
  weight: phrase.weight,
  needle: ` ${fold(phrase.phrase)} `,
}));

export function thresholdFor(sensitivity: number): number {
  const value = Math.min(100, Math.max(0, sensitivity));
  return Math.round(88 - value * 0.55);
}

function bump(scores: Scores, category: CategoryId, weight: number): void {
  scores[category] = Math.min(100, scores[category] + weight);
}

function pushReason(reasons: string[], reason: string): void {
  if (reasons.length >= 6 || reasons.includes(reason)) return;
  reasons.push(reason);
}

function padded(text: string): string {
  return ` ${fold(text)} `;
}

function containsPhrase(haystack: string, phrases: readonly string[]): boolean {
  const space = padded(haystack);
  return phrases.some((phrase) => {
    const needle = fold(phrase);
    return needle.length >= 3 && space.includes(` ${needle} `);
  });
}

function structural(text: string, scores: Scores, reasons: string[]): void {
  const letters = text.replace(/[^\p{L}]/gu, "");
  const caps = letters.replace(/[^\p{Lu}]/gu, "");
  if (letters.length > 40 && caps.length / letters.length > 0.62) {
    bump(scores, "ragebait", 26);
    pushReason(reasons, "wersaliki");
  }

  const exclaims = text.match(/!/g)?.length ?? 0;
  if (exclaims >= 5) {
    bump(scores, "ragebait", 18);
    pushReason(reasons, "krzyk");
  } else if (exclaims >= 3) {
    bump(scores, "ragebait", 10);
  }

  if (/(?:\?!|!{3,}|\?{3,})/u.test(text)) {
    bump(scores, "ragebait", 12);
  }

  const dashes = text.match(/[—–]/g)?.length ?? 0;
  if (dashes >= 3) {
    bump(scores, "ai_slop", 18);
    pushReason(reasons, "myślniki");
  }

  const numbered = text.match(/(?:^|\n)\s*\d+[.)]/g)?.length ?? 0;
  if (numbered >= 3) {
    bump(scores, "ai_slop", 16);
    pushReason(reasons, "lista");
  }

  const emojiLines = text.match(/(?:^|\n)\s*\p{Extended_Pictographic}/gu)?.length ?? 0;
  if (emojiLines >= 3) {
    bump(scores, "ai_slop", 18);
    pushReason(reasons, "emoji-lista");
  }
}

export function decideFromScores(
  scores: Scores,
  input: AnalysisInput,
  reasons: string[],
  custom: boolean,
): Verdict {
  const threshold = thresholdFor(input.sensitivity);
  let top: CategoryId | null = null;
  let best = 0;
  for (const id of CATEGORY_IDS) {
    if (!input.categories[id]) continue;
    const value = scores[id];
    if (value > best) {
      best = value;
      top = id;
    }
  }
  return {
    hide: custom || (top !== null && best >= threshold),
    scores,
    top,
    reasons,
    custom,
    threshold,
  };
}

export function analyze(input: AnalysisInput): Verdict {
  const scores = emptyScores();
  const reasons: string[] = [];
  const letters = input.text.match(/\p{L}/gu)?.length ?? 0;

  if (containsPhrase(input.text, input.allowPhrases)) {
    return decideFromScores(scores, input, ["wyjątek"], false);
  }

  const custom = containsPhrase(input.text, input.blockPhrases);
  if (custom) pushReason(reasons, "twoja fraza");

  if (letters < 12 && !custom && !input.promoted) {
    return decideFromScores(scores, input, reasons, custom);
  }

  const space = padded(input.text);
  for (const rule of RULES) {
    if (!rule.needle.trim()) continue;
    if (!space.includes(rule.needle)) continue;
    bump(scores, rule.category, rule.weight);
    pushReason(reasons, rule.phrase);
  }

  structural(input.text, scores, reasons);

  if (input.promoted) {
    bump(scores, "spam", 70);
    pushReason(reasons, "reklama");
  }

  return decideFromScores(scores, input, reasons, custom);
}

export function isUncertain(verdict: Verdict, input: AnalysisInput): boolean {
  if (verdict.custom) return false;
  let best = 0;
  for (const id of CATEGORY_IDS) {
    if (!input.categories[id]) continue;
    best = Math.max(best, verdict.scores[id]);
  }
  return Math.abs(best - verdict.threshold) <= 12;
}
