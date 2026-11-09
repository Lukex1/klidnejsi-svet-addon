import { CLOUD_SYSTEM, parseCloudScores } from "../classifier/cloud.ts";
import { CALM_TEXTS, CATEGORY_TEXTS, scoresFromVectors } from "../classifier/neural.ts";
import { CATEGORY_IDS, type CategoryId, type CloudResult, type Scores } from "../shared/types.ts";

type Phase = "idle" | "loading" | "ready" | "error";

interface Snapshot {
  phase: Phase;
  detail: string;
}

interface VectorModel {
  (text: string, options: { pooling: "mean"; normalize: true }): Promise<{ data: ArrayLike<number>; dims?: number[] }>;
}

interface LanguageSession {
  prompt: (input: string) => Promise<string>;
  destroy?: () => void;
  inputUsage?: number;
  inputQuota?: number;
}

interface LanguageModelApi {
  availability: () => Promise<string>;
  create: (options?: {
    temperature?: number;
    topK?: number;
    initialPrompts?: { role: "system" | "user" | "assistant"; content: string }[];
  }) => Promise<LanguageSession>;
}

const MODEL_ID = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

let phase: Phase = "idle";
let detail = "idle";
let chain: Promise<void> = Promise.resolve();
let embedder: VectorModel | null = null;
let language: LanguageSession | null = null;
let calmBank: Float32Array[] = [];
let categoryBanks: Partial<Record<CategoryId, Float32Array[]>> = {};
const cache = new Map<string, Scores>();

function snapshot(): Snapshot {
  return { phase, detail };
}

function languageApi(): LanguageModelApi | null {
  const value = (globalThis as { LanguageModel?: LanguageModelApi }).LanguageModel;
  return value ?? null;
}

function asVector(output: { data: ArrayLike<number>; dims?: number[] }): Float32Array {
  const dims = output.dims ?? [];
  const hidden = dims.length > 0 ? dims[dims.length - 1] ?? output.data.length : output.data.length;
  const start = Math.max(0, output.data.length - hidden);
  const vector = new Float32Array(hidden);
  let norm = 0;
  for (let index = 0; index < hidden; index += 1) {
    const value = Number(output.data[start + index] ?? 0);
    vector[index] = value;
    norm += value * value;
  }
  norm = Math.sqrt(norm) || 1;
  for (let index = 0; index < vector.length; index += 1) vector[index] = (vector[index] ?? 0) / norm;
  return vector;
}

async function pointWasmAtExtension(): Promise<void> {
  const transformers = await import("@huggingface/transformers");
  const base = chrome.runtime.getURL("ort/");
  const wasm = transformers.env.backends.onnx.wasm as {
    wasmPaths?: { mjs?: string; wasm?: string } | string;
    numThreads?: number;
    proxy?: boolean;
  };
  wasm.wasmPaths = {
    mjs: `${base}ort-wasm-simd-threaded.asyncify.mjs`,
    wasm: `${base}ort-wasm-simd-threaded.asyncify.wasm`,
  };
  wasm.numThreads = 1;
  wasm.proxy = false;
  transformers.env.useWasmCache = false;
  transformers.env.allowLocalModels = false;
  transformers.env.allowRemoteModels = true;
}

async function openLanguage(): Promise<boolean> {
  const api = languageApi();
  if (!api) return false;
  let state = "unavailable";
  try {
    state = await api.availability();
  } catch {
    return false;
  }
  if (state !== "available") return false;
  language = await api.create({
    temperature: 0,
    topK: 1,
    initialPrompts: [{ role: "system", content: CLOUD_SYSTEM }],
  });
  detail = "ready:browser";
  return true;
}

async function openEmbedder(): Promise<void> {
  await pointWasmAtExtension();
  const transformers = await import("@huggingface/transformers");
  const extractor = await transformers.pipeline("feature-extraction", MODEL_ID, {
    dtype: "q8",
    device: "wasm",
    progress_callback: (info: { status?: string; progress?: number; file?: string }) => {
      const progress = typeof info.progress === "number" ? Math.round(info.progress) : null;
      const file = info.file ? info.file.split("/").pop() : "wagi";
      detail = progress == null ? `download:${file}` : `download:${file}:${progress}`;
    },
  });
  embedder = extractor as VectorModel;
  calmBank = [];
  for (const text of CALM_TEXTS) calmBank.push(asVector(await embedder(text, { pooling: "mean", normalize: true })));
  categoryBanks = {};
  for (const id of CATEGORY_IDS) {
    const bank: Float32Array[] = [];
    for (const text of CATEGORY_TEXTS[id]) bank.push(asVector(await embedder(text, { pooling: "mean", normalize: true })));
    categoryBanks[id] = bank;
  }
  detail = "ready:embed";
}

async function ensureReady(): Promise<void> {
  if (language || embedder) return;
  if (phase === "loading") return chain;
  phase = "loading";
  detail = "starting";
  chain = (async () => {
    try {
      const opened = await openLanguage();
      if (!opened) await openEmbedder();
      phase = "ready";
    } catch (error) {
      phase = "error";
      detail = error instanceof Error ? error.message : "model się nie uruchomił";
      throw error;
    }
  })();
  return chain;
}

async function classifyWithLanguage(text: string): Promise<Scores | null> {
  if (!language) return null;
  if ((language.inputUsage ?? 0) > (language.inputQuota ?? 1_000_000) * 0.7) {
    language.destroy?.();
    language = null;
    await openLanguage();
  }
  if (!language) return null;
  const raw = await language.prompt(text.slice(0, 1200));
  return parseCloudScores(raw);
}

async function classifyWithEmbedder(text: string): Promise<Scores> {
  if (!embedder) throw new Error("model nie jest gotowy");
  const banks = categoryBanks as Record<CategoryId, readonly Float32Array[]>;
  const vector = asVector(await embedder(text.slice(0, 600), { pooling: "mean", normalize: true }));
  return scoresFromVectors(vector, calmBank, banks);
}

let classifyChain: Promise<unknown> = Promise.resolve();

async function classifyNeuralNow(text: string): Promise<CloudResult> {
  const key = text.slice(0, 600);
  const cached = cache.get(key);
  if (cached) return { ok: true, scores: cached };
  try {
    await ensureReady();
  } catch {
    return { ok: false, error: detail };
  }
  try {
    let scores = language ? await classifyWithLanguage(key) : null;
    if (!scores) {
      if (!embedder) await openEmbedder();
      scores = await classifyWithEmbedder(key);
    }
    if (cache.size > 400) cache.clear();
    cache.set(key, scores);
    return { ok: true, scores };
  } catch (error) {
    const message = error instanceof Error ? error.message : "model nie ocenił wpisu";
    return { ok: false, error: message };
  }
}

export function classifyNeural(text: string): Promise<CloudResult> {
  const run = classifyChain.then(() => classifyNeuralNow(text));
  classifyChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function neuralSnapshot(): Snapshot {
  return snapshot();
}

function isOffscreenPage(): boolean {
  return typeof location !== "undefined" && location.pathname.endsWith("/offscreen.html");
}

if (isOffscreenPage()) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== "object") return false;
    const kind = (message as { type?: string }).type;
    if (kind === "neural-infer") {
      const text = (message as { text?: string }).text ?? "";
      void classifyNeural(text).then(sendResponse);
      return true;
    }
    if (kind === "neural-status-query") {
      sendResponse({ ok: true, ...snapshot() });
      return true;
    }
    return false;
  });
}
