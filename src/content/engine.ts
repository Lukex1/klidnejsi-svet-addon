import { findPosts, type Candidate } from "./adapters/index.ts";
import { applyEmbedded } from "../classifier/embedded.ts";
import { analyze, decideFromScores, isUncertain } from "../classifier/score.ts";
import { firstSentence, replacementFor } from "../replace/library.ts";
import { sendMessage } from "../shared/browser.ts";
import { hashString } from "../shared/hash.ts";
import { siteFromHost } from "../shared/settings.ts";
import { isLoopbackUrl, isModelEndpoint, sameAuthor } from "../shared/text.ts";
import { emptyScores } from "../shared/stats.ts";
import { CATEGORY_IDS, type AnalysisInput, type CategoryId, type CloudResult, type Mode, type Scores, type Settings, type Verdict } from "../shared/types.ts";
import { defaultSettings } from "../shared/settings.ts";

const revealed = new Set<string>();
const counted = new Set<string>();
const cloudCache = new Map<string, Verdict["scores"]>();

let settings: Settings = defaultSettings();
let paused = false;
let generation = 1;
let cloudBudget = 40;
let neuralBudget = 200;
let neuralHold = 0;
let neuralTimer = 0;
let neuralActive = 0;
const neuralWaiters: Array<() => void> = [];
let activeCloud = 0;
const cloudWaiters: Array<() => void> = [];

export function applyRuntime(next: Settings, nextPaused: boolean): void {
  settings = next;
  paused = nextPaused;
  generation += 1;
  cloudBudget = 40;
  neuralBudget = 200;
  neuralHold = 0;
}

export function shouldRun(): boolean {
  if (!settings.enabled || paused) return false;
  const site = siteFromHost(location.hostname);
  if (!site) return false;
  return settings.sites[site];
}

export interface PageTally {
  total: number;
  counts: Scores;
  custom: number;
}

export function pageTally(): PageTally {
  const counts = emptyScores();
  let custom = 0;
  let total = 0;
  for (const node of document.querySelectorAll<HTMLElement>(".klsv-on")) {
    total += 1;
    const key = node.dataset.klsvCategory ?? "";
    if (key === "custom") custom += 1;
    else if ((CATEGORY_IDS as readonly string[]).includes(key)) counts[key as CategoryId] += 1;
  }
  return { total, counts, custom };
}

export function hiddenCount(): number {
  return pageTally().total;
}

export function clearAll(): void {
  for (const node of document.querySelectorAll<HTMLElement>(".klsv-root")) clearOne(node);
}

export async function scanDocument(): Promise<void> {
  if (!shouldRun()) {
    if (document.querySelector(".klsv-on")) clearAll();
    return;
  }
  const posts = findPosts();
  for (let index = 0; index < posts.length; index += 1) {
    const post = posts[index];
    if (!post) continue;
    try {
      treat(post);
    } catch {
      // One broken card should not stop the rest of the feed.
    }
    if (index % 12 === 11) await yieldFrame();
  }
}

function yieldFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function hashOf(text: string): string {
  return hashString(text).toString(36);
}

function stampFor(hash: string): string {
  return [generation, hash, settings.mode, settings.showReason ? "1" : "0", settings.language].join("|");
}

function modelReady(): boolean {
  const cloud = settings.cloud;
  if (!cloud.enabled || !isModelEndpoint(cloud.endpoint)) return false;
  if (isLoopbackUrl(cloud.endpoint)) return true;
  return cloud.apiKey.length > 0;
}

function wantsNeural(verdict: Verdict): boolean {
  if (!settings.cloud.neural || verdict.custom || verdict.hide) return false;
  if (verdict.reasons.includes("wyjątek")) return false;
  if (Date.now() < neuralHold || neuralBudget <= 0) return false;
  return true;
}

function retryNeuralLater(): void {
  if (neuralTimer) return;
  neuralTimer = window.setTimeout(() => {
    neuralTimer = 0;
    document.dispatchEvent(new Event("klsv-rescan"));
  }, 1600);
}

function toInput(text: string, promoted: boolean): AnalysisInput {
  return {
    text,
    sensitivity: settings.sensitivity,
    categories: settings.categories,
    allowPhrases: settings.allowPhrases,
    blockPhrases: settings.blockPhrases,
    promoted,
  };
}

function treat(post: Candidate): void {
  const hash = hashOf(post.text);
  const stamp = stampFor(hash);
  if (revealed.has(hash)) {
    if (post.el.dataset.klsvStamp) clearOne(post.el);
    post.el.dataset.klsvStamp = stamp;
    return;
  }
  if (post.author && settings.allowAuthors.some((item) => sameAuthor(item, post.author))) {
    if (post.el.classList.contains("klsv-on")) clearOne(post.el);
    post.el.dataset.klsvStamp = stamp;
    return;
  }
  if (post.el.dataset.klsvStamp === stamp && post.el.dataset.klsvPending !== `${generation}|${hash}`) return;

  const input = toInput(post.text, post.promoted);
  const exact = analyze(input);
  const local =
    settings.cloud.embedded && !exact.reasons.includes("wyjątek") ? applyEmbedded(exact, input) : exact;
  if (wantsNeural(local)) {
    const pending = `${generation}|${hash}|neural`;
    if (post.el.dataset.klsvPending === pending) return;
    post.el.dataset.klsvPending = pending;
    neuralBudget -= 1;
    void resolveNeural(post, input, hash, local, generation);
    return;
  }

  const ask = modelReady() && isUncertain(local, input) && cloudBudget > 0;

  if (ask) {
    const pending = `${generation}|${hash}`;
    if (post.el.dataset.klsvPending === pending) return;
    post.el.dataset.klsvPending = pending;
    cloudBudget -= 1;
    void resolveCloud(post, input, hash, local, generation);
    return;
  }
  settle(post.el, post.text, post.author, hash, local);
}

async function withNeural<T>(task: () => Promise<T>): Promise<T> {
  if (neuralActive >= 1) {
    await new Promise<void>((resolve) => {
      neuralWaiters.push(resolve);
    });
  }
  neuralActive += 1;
  try {
    return await task();
  } finally {
    neuralActive -= 1;
    neuralWaiters.shift()?.();
  }
}

async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeCloud >= 2) {
    await new Promise<void>((resolve) => {
      cloudWaiters.push(resolve);
    });
  }
  activeCloud += 1;
  try {
    return await task();
  } finally {
    activeCloud -= 1;
    cloudWaiters.shift()?.();
  }
}

async function resolveNeural(
  post: Candidate,
  input: AnalysisInput,
  hash: string,
  local: Verdict,
  seenGeneration: number,
): Promise<void> {
  try {
    const response = await withNeural(() =>
      sendMessage<CloudResult>({
        type: "classify-neural",
        text: input.text.slice(0, 1200),
      }),
    );
    if (seenGeneration !== generation || !post.el.isConnected) return;
    if (!response.ok) {
      delete post.el.dataset.klsvPending;
      const waiting = /pobieram|uruchamiam|fetch|network|Failed|HTTP/i.test(response.error);
      if (!waiting) {
        settle(post.el, post.text, post.author, hash, local);
        return;
      }
      neuralBudget += 1;
      neuralHold = Date.now() + 1500;
      retryNeuralLater();
      return;
    }
    const merged = emptyScores();
    for (const id of CATEGORY_IDS) merged[id] = Math.max(local.scores[id], response.scores[id]);
    const verdict = decideFromScores(merged, input, [...local.reasons, "model"], local.custom);
    settle(post.el, post.text, post.author, hash, verdict);
  } catch {
    if (seenGeneration !== generation || !post.el.isConnected) return;
    delete post.el.dataset.klsvPending;
    neuralHold = Date.now() + 1500;
    retryNeuralLater();
  }
}

async function resolveCloud(
  post: Candidate,
  input: AnalysisInput,
  hash: string,
  local: Verdict,
  seenGeneration: number,
): Promise<void> {
  try {
    const cached = cloudCache.get(hash);
    const scores =
      cached ??
      (await withSlot(async () => {
        const response = await sendMessage<CloudResult>({
          type: "classify-cloud",
          text: input.text.slice(0, 1200),
        });
        return response.ok ? response.scores : null;
      }));
    if (seenGeneration !== generation || !post.el.isConnected) return;
    const verdict = scores ? decideFromScores(scores, input, ["model"], false) : local;
    if (scores) cloudCache.set(hash, scores);
    settle(post.el, post.text, post.author, hash, verdict);
  } catch {
    if (seenGeneration !== generation || !post.el.isConnected) return;
    settle(post.el, post.text, post.author, hash, local);
  }
}

function settle(el: HTMLElement, text: string, author: string, hash: string, verdict: Verdict): void {
  delete el.dataset.klsvPending;
  if (!verdict.hide) {
    clearOne(el);
    el.dataset.klsvStamp = stampFor(hash);
    return;
  }
  hush(el);
  paint(el, text, author, hash, verdict);
  el.dataset.klsvCategory = verdict.top ?? (verdict.custom ? "custom" : "");
  el.dataset.klsvStamp = stampFor(hash);
  if (!counted.has(hash)) {
    counted.add(hash);
    void sendMessage({
      type: "record-hit",
      category: verdict.top,
      custom: verdict.custom,
      host: location.hostname,
    }).catch(() => undefined);
  }
}

function paint(el: HTMLElement, text: string, author: string, hash: string, verdict: Verdict): void {
  clearOne(el);
  const mode: Mode = settings.mode;
  const position = getComputedStyle(el).position;
  if (position === "static") el.classList.add("klsv-rel");
  el.classList.add("klsv-root", "klsv-on", `klsv-${mode}`);

  for (const child of [...el.children]) {
    if (!(child instanceof HTMLElement)) continue;
    child.setAttribute("inert", "");
    child.setAttribute("data-klsv-inert", "1");
  }

  const replacement = replacementFor(text, settings.language, verdict, settings.showReason);
  const body = mode === "line" ? firstSentence(replacement.body) : replacement.body;
  const color = getComputedStyle(el).color;
  const background = opaqueBackground(el);

  const veil = document.createElement("div");
  veil.className = "klsv-veil";
  veil.setAttribute("role", "note");
  veil.setAttribute("aria-label", `${replacement.kicker}. ${firstSentence(body)}`);
  if (mode === "cover") veil.style.background = background;

  const plate = document.createElement("div");
  plate.className = "klsv-plate";
  plate.style.color = color;
  if (mode === "cover") plate.style.background = "transparent";
  else plate.style.background = background;

  const kicker = document.createElement("p");
  kicker.className = "klsv-kicker";
  kicker.textContent = replacement.kicker;

  const copy = document.createElement("p");
  copy.className = "klsv-body";
  copy.textContent = body;

  const actions = document.createElement("div");
  actions.className = "klsv-actions";
  const labels =
    settings.ui === "cs"
      ? { show: "Zobrazit originál", allow: "Nechat autora" }
      : { show: "Pokaż oryginał", allow: "Zostaw autora" };

  actions.append(
    actionButton(labels.show, () => {
      revealed.add(hash);
      clearOne(el);
      el.dataset.klsvStamp = stampFor(hash);
    }),
  );
  if (author) {
    actions.append(
      actionButton(labels.allow, () => {
        clearOne(el);
        void sendMessage({ type: "allow-author", author }).catch(() => undefined);
      }),
    );
  }

  plate.append(kicker, copy, actions);
  veil.append(plate);
  for (const eventName of ["pointerdown", "mousedown", "mouseup", "click"] as const) {
    veil.addEventListener(eventName, (event) => {
      event.stopPropagation();
    });
  }
  el.append(veil);
}

function actionButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return button;
}

function hush(el: HTMLElement): void {
  for (const media of el.querySelectorAll("video, audio")) {
    if (!(media instanceof HTMLMediaElement) || media.paused) continue;
    media.pause();
    media.dataset.klsvPaused = "1";
  }
}

function clearOne(el: HTMLElement): void {
  el.classList.remove("klsv-root", "klsv-on", "klsv-soft", "klsv-cover", "klsv-line", "klsv-rel");
  el.querySelector(":scope > .klsv-veil")?.remove();
  for (const node of el.querySelectorAll("[data-klsv-inert]")) {
    node.removeAttribute("inert");
    node.removeAttribute("data-klsv-inert");
  }
  delete el.dataset.klsvStamp;
  delete el.dataset.klsvPending;
  delete el.dataset.klsvCategory;
}

function opaqueBackground(start: HTMLElement): string {
  let node: HTMLElement | null = start;
  while (node) {
    const color = getComputedStyle(node).backgroundColor;
    const match = /rgba?\(([^)]+)\)/.exec(color);
    const channels = match?.[1];
    if (channels) {
      const parts = channels.split(",").map((part) => part.trim());
      const alpha = parts.length >= 4 ? Number(parts[3]) : 1;
      if (Number.isFinite(alpha) && alpha >= 0.85) return color;
    }
    node = node.parentElement;
  }
  return "Canvas";
}
