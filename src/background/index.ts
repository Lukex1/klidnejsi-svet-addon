import { CLOUD_SYSTEM, parseCloudScores } from "../classifier/cloud.ts";
import {
  getTab,
  isExtensionPage,
  queryTabs,
  sendTabMessage,
  sessionGet,
  sessionSet,
  storageGet,
  storageSet,
} from "../shared/browser.ts";
import { badgeLine } from "../shared/catalog.ts";
import { applyPatch, defaultSettings, mergeSettings } from "../shared/settings.ts";
import { emptyScores, emptyStats, mergeStats, recordHit } from "../shared/stats.ts";
import { endpointPermission, isLoopbackUrl, isModelEndpoint, sameAuthor } from "../shared/text.ts";
import {
  CATEGORY_IDS,
  type Ack,
  type CategoryId,
  type ClientMessage,
  type CloudResult,
  type NeuralStatus,
  type Scores,
  type Settings,
  type StatePayload,
  type Stats,
} from "../shared/types.ts";

let settings: Settings = defaultSettings();
let stats: Stats = emptyStats();
let pauses: Record<string, boolean> = {};
let loading: Promise<void> | null = null;

function ready(): Promise<void> {
  loading ??= load();
  return loading;
}

async function load(): Promise<void> {
  const stored = await storageGet(["settings", "stats"]);
  settings = mergeSettings(stored.settings);
  stats = mergeStats(stored.stats);
  const session = await sessionGet(["pauses"]);
  pauses = readPauses(session.pauses);
  if (stored.settings == null) await storageSet({ settings, stats });
}

function readPauses(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, boolean> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === true) out[key] = true;
  }
  return out;
}

function isCategory(value: unknown): value is CategoryId {
  return typeof value === "string" && (CATEGORY_IDS as readonly string[]).includes(value);
}

async function broadcast(): Promise<void> {
  const tabs = await queryTabs();
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id == null) return;
      try {
        await sendTabMessage(tab.id, {
          type: "apply-state",
          settings,
          paused: pauses[String(tab.id)] === true,
        });
      } catch {
        // The tab has no content script yet.
      }
    }),
  );
}

function readCounts(value: unknown): Scores {
  const scores = emptyScores();
  if (!value || typeof value !== "object") return scores;
  const record = value as Record<string, unknown>;
  for (const id of CATEGORY_IDS) {
    const raw = record[id];
    scores[id] = typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
  }
  return scores;
}

function setBadge(tabId: number, total: number, counts: Scores, custom: number): void {
  const text = total > 0 ? String(Math.min(total, 999)) : "";
  const line = badgeLine(settings.categories, counts, custom);
  const title = line ? `klsv · ${total} · ${line}` : "klsv — klidnější svět";
  const background = settings.dark ? "#8fb89a" : "#234036";
  const foreground = settings.dark ? "#142018" : "#f4f0e6";
  chrome.action.setBadgeText({ tabId, text }, () => undefined);
  chrome.action.setBadgeBackgroundColor({ tabId, color: background }, () => undefined);
  chrome.action.setTitle({ tabId, title }, () => undefined);
  const action = chrome.action as typeof chrome.action & {
    setBadgeTextColor?: (details: { tabId: number; color: string }, callback: () => void) => void;
  };
  action.setBadgeTextColor?.({ tabId, color: foreground }, () => undefined);
}

function hasHostPermission(origin: string): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.permissions.contains({ origins: [origin] }, (ok) => {
      resolve(Boolean(ok) && !chrome.runtime.lastError);
    });
  });
}

function readModelText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return JSON.stringify(data);
  const first = choices[0];
  if (!first || typeof first !== "object") return null;
  const message = (first as { message?: { content?: unknown } }).message;
  return typeof message?.content === "string" ? message.content : null;
}

async function callModel(endpoint: string, model: string, apiKey: string, text: string): Promise<CloudResult> {
  const origin = endpointPermission(endpoint);
  if (!isModelEndpoint(endpoint) || !origin) {
    return { ok: false, error: "Podaj adres https albo lokalny http://127.0.0.1." };
  }
  if (!isLoopbackUrl(endpoint) && !apiKey) return { ok: false, error: "Przy zdalnym modelu brakuje klucza." };
  if (!(await hasHostPermission(origin))) return { ok: false, error: "Brak zgody na to połączenie." };
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: model || "qwen2.5:0.5b",
        temperature: 0,
        max_tokens: 200,
        messages: [
          { role: "system", content: CLOUD_SYSTEM },
          { role: "user", content: text.slice(0, 1200) },
        ],
      }),
      signal: AbortSignal.timeout(isLoopbackUrl(endpoint) ? 20000 : 8000),
    });
    if (!response.ok) return { ok: false, error: `Model odpowiedział ${response.status}.` };
    const data: unknown = await response.json();
    const content = readModelText(data);
    const scores = content ? parseCloudScores(content) : null;
    if (!scores) return { ok: false, error: "Model nie odesłał ocen." };
    return { ok: true, scores };
  } catch {
    return { ok: false, error: "Nie udało się dojść do modelu." };
  }
}

async function stateFor(sender: chrome.runtime.MessageSender, requestedTab: unknown): Promise<StatePayload> {
  let tabId = sender.tab?.id ?? null;
  if (isExtensionPage(sender) && typeof requestedTab === "number") tabId = requestedTab;
  let tabUrl = sender.tab?.url ?? null;
  if (tabId != null && !tabUrl) {
    const tab = await getTab(tabId);
    tabUrl = tab?.url ?? null;
  }
  return {
    ok: true,
    settings,
    stats,
    paused: tabId != null && pauses[String(tabId)] === true,
    tabUrl,
    tabId,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureOffscreen(): Promise<boolean> {
  const offscreen = chrome.offscreen;
  if (!offscreen?.createDocument) return false;
  try {
    if (await offscreen.hasDocument()) return true;
    await offscreen.createDocument({
      url: "model/offscreen.html",
      reasons: ["WORKERS"],
      justification: "Lokalny model ocenia wpisy na stronie i nie wysyła ich na serwer.",
    });
    return true;
  } catch {
    return false;
  }
}

async function askOffscreen<T>(message: object): Promise<T | null> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = (await chrome.runtime.sendMessage(message)) as T | undefined;
      if (response) return response;
    } catch {
      // The model page is still starting.
    }
    await delay(250);
  }
  return null;
}

interface NeuralModule {
  classifyNeural: (text: string) => Promise<CloudResult>;
  neuralSnapshot: () => { phase: NeuralStatus["phase"]; detail: string };
}

let neuralModule: Promise<NeuralModule> | null = null;

function loadNeural(): Promise<NeuralModule> {
  neuralModule ??= import(chrome.runtime.getURL("model/runtime.js")) as Promise<NeuralModule>;
  return neuralModule;
}

async function neuralStatus(): Promise<NeuralStatus> {
  if (!settings.cloud.neural) return { ok: true, phase: "off", detail: "off" };
  const alive = chrome.offscreen?.hasDocument ? await chrome.offscreen.hasDocument().catch(() => false) : false;
  if (alive) {
    const response = await askOffscreen<NeuralStatus>({ type: "neural-status-query" });
    if (response?.ok) return response;
  }
  if (neuralModule) {
    const snap = (await neuralModule).neuralSnapshot();
    return { ok: true, phase: snap.phase, detail: snap.detail };
  }
  return { ok: true, phase: "idle", detail: "idle" };
}

async function classifyNeuralMessage(text: string): Promise<CloudResult> {
  if (!settings.cloud.neural) return { ok: false, error: "Model jest wyłączony." };
  if (await ensureOffscreen()) {
    const response = await askOffscreen<CloudResult>({ type: "neural-infer", text });
    if (response && typeof response.ok === "boolean") return response;
  }
  const module = await loadNeural();
  return module.classifyNeural(text);
}

async function handle(message: ClientMessage, sender: chrome.runtime.MessageSender): Promise<StatePayload | Ack | CloudResult | NeuralStatus> {
  await ready();
  switch (message.type) {
    case "get-state":
      return stateFor(sender, message.tabId);
    case "patch-settings": {
      if (!isExtensionPage(sender)) return { ok: false, error: "Tej zmiany nie przyjmę z tej strony." };
      settings = applyPatch(settings, message.patch);
      await storageSet({ settings });
      await broadcast();
      return { ok: true };
    }
    case "set-paused": {
      if (!isExtensionPage(sender) || typeof message.tabId !== "number") {
        return { ok: false, error: "Tej zmiany nie przyjmę z tej strony." };
      }
      if (message.paused) pauses[String(message.tabId)] = true;
      else delete pauses[String(message.tabId)];
      await sessionSet({ pauses });
      await broadcast();
      return { ok: true };
    }
    case "allow-author": {
      const author = message.author.trim();
      if (author.length < 2) return { ok: false, error: "Za krótki autor." };
      if (!settings.allowAuthors.some((item) => sameAuthor(item, author))) {
        settings = applyPatch(settings, { allowAuthors: [...settings.allowAuthors, author].slice(-200) });
        await storageSet({ settings });
        await broadcast();
      }
      return { ok: true };
    }
    case "record-hit": {
      const category = isCategory(message.category) ? message.category : null;
      stats = recordHit(stats, category, message.custom, message.host);
      await storageSet({ stats });
      return { ok: true };
    }
    case "set-badge": {
      if (sender.tab?.id != null) {
        const total = typeof message.total === "number" && Number.isFinite(message.total) ? Math.max(0, Math.round(message.total)) : 0;
        const custom = typeof message.custom === "number" && Number.isFinite(message.custom) ? Math.max(0, Math.round(message.custom)) : 0;
        setBadge(sender.tab.id, total, readCounts(message.counts), custom);
      }
      return { ok: true };
    }
    case "neural-status":
      return neuralStatus();
    case "classify-neural":
      return classifyNeuralMessage(message.text);
    case "classify-cloud":
      return callModel(settings.cloud.endpoint, settings.cloud.model, settings.cloud.apiKey, message.text);
    case "test-cloud": {
      if (!isExtensionPage(sender)) return { ok: false, error: "Test modelu jest tylko w ustawieniach." };
      return callModel(message.endpoint, message.model, message.apiKey, "Spokojny test połączenia klsv.");
    }
    case "reset": {
      if (!isExtensionPage(sender)) return { ok: false, error: "Reset jest tylko w ustawieniach." };
      settings = defaultSettings();
      stats = emptyStats();
      pauses = {};
      await storageSet({ settings, stats });
      await sessionSet({ pauses });
      await broadcast();
      return { ok: true };
    }
    default:
      return { ok: false, error: "Nie znam tej wiadomości." };
  }
}

function parseMessage(value: unknown): ClientMessage | null {
  if (!value || typeof value !== "object") return null;
  const type = (value as { type?: unknown }).type;
  if (typeof type !== "string") return null;
  return value as ClientMessage;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const parsed = parseMessage(message);
  if (!parsed) {
    sendResponse({ ok: false, error: "Pusta wiadomość." });
    return true;
  }
  void handle(parsed, sender)
    .then(sendResponse)
    .catch(() => sendResponse({ ok: false, error: "Coś się rozsypało w tle." }));
  return true;
});

chrome.commands?.onCommand.addListener((command) => {
  void (async () => {
    await ready();
    if (command !== "toggle-enabled") return;
    settings = applyPatch(settings, { enabled: !settings.enabled });
    await storageSet({ settings });
    await broadcast();
  })();
});

chrome.runtime.onInstalled.addListener(() => {
  void ready();
});

void ready();
