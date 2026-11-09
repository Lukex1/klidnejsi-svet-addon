import { PHRASES } from "./phrases.ts";
import { decideFromScores } from "./score.ts";
import { emptyScores } from "../shared/stats.ts";
import { fold } from "../shared/text.ts";
import { CATEGORY_IDS, type AnalysisInput, type CategoryId, type Scores, type Verdict } from "../shared/types.ts";

const MAX_GAP = 2;

interface FuzzyRule {
  category: CategoryId;
  weight: number;
  tokens: string[];
  needle: string;
}

const RULES: readonly FuzzyRule[] = PHRASES.map((phrase) => {
  const folded = fold(phrase.phrase);
  return {
    category: phrase.category,
    weight: Math.round(phrase.weight * 0.9),
    tokens: folded.split(" ").filter((token) => token.length >= 3),
    needle: ` ${folded} `,
  };
}).filter((rule) => rule.tokens.length >= 2 && rule.weight > 0);

function wordsOf(text: string): string[] {
  const folded = fold(text);
  return folded ? folded.split(" ") : [];
}

function orderedWithGaps(words: readonly string[], tokens: readonly string[]): boolean {
  let from = 0;
  for (const token of tokens) {
    const at = words.indexOf(token, from);
    if (at < 0 || at - from > MAX_GAP) return false;
    from = at + 1;
  }
  return true;
}

export function embeddedScores(text: string): Scores {
  const scores = emptyScores();
  const words = wordsOf(text);
  if (words.length < 2) return scores;
  const padded = ` ${words.join(" ")} `;
  for (const rule of RULES) {
    if (padded.includes(rule.needle)) continue;
    if (!orderedWithGaps(words, rule.tokens)) continue;
    scores[rule.category] = Math.min(100, scores[rule.category] + rule.weight);
  }
  return scores;
}

export function applyEmbedded(verdict: Verdict, input: AnalysisInput): Verdict {
  if (verdict.reasons.includes("wyjątek")) return verdict;
  const extra = embeddedScores(input.text);
  const touched = CATEGORY_IDS.some((id) => extra[id] > 0);
  if (!touched) return verdict;
  const scores = emptyScores();
  for (const id of CATEGORY_IDS) scores[id] = Math.min(100, verdict.scores[id] + extra[id]);
  const reasons = verdict.reasons.includes("lekki model") ? verdict.reasons : [...verdict.reasons, "lekki model"].slice(0, 6);
  return decideFromScores(scores, input, reasons, verdict.custom);
}
