import { applyRuntime, clearAll, pageTally, scanDocument, shouldRun } from "./engine.ts";
import { inExtension, sendMessage } from "../shared/browser.ts";
import { mergeSettings } from "../shared/settings.ts";
import type { StatePayload } from "../shared/types.ts";

const globalFlag = globalThis as typeof globalThis & { __klsv?: boolean };

if (globalFlag.__klsv) {
  document.dispatchEvent(new Event("klsv-rescan"));
} else if (inExtension()) {
  globalFlag.__klsv = true;
  boot();
}

function boot(): void {
  document.addEventListener("klsv-rescan", () => {
    scheduleScan(0);
  });
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== "object") return false;
    const type = (message as { type?: unknown }).type;
    if (type === "get-count") {
      sendResponse({ ok: true, ...pageTally() });
      return true;
    }
    if (type === "apply-state") {
      const body = message as { settings?: unknown; paused?: unknown };
      applyRuntime(mergeSettings(body.settings), Boolean(body.paused));
      if (!shouldRun()) clearAll();
      scheduleScan(0);
      sendResponse({ ok: true });
      return true;
    }
    return false;
  });
  void start();
}

let timer = 0;
let scanning = false;
let pending = false;
let observer: MutationObserver | null = null;

function scheduleScan(delay = 180): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    void run();
  }, delay);
}

async function run(): Promise<void> {
  if (scanning) {
    pending = true;
    return;
  }
  scanning = true;
  try {
    await scanDocument();
    reportCount();
  } finally {
    scanning = false;
    if (pending) {
      pending = false;
      scheduleScan(40);
    }
  }
}

function reportCount(): void {
  const tally = pageTally();
  void sendMessage({ type: "set-badge", total: tally.total, counts: tally.counts, custom: tally.custom }).catch((error: unknown) => {
    const text = error instanceof Error ? error.message : "";
    if (text.toLowerCase().includes("context")) observer?.disconnect();
  });
}

function mutationMatters(records: MutationRecord[]): boolean {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node instanceof HTMLElement && (node.classList.contains("klsv-veil") || node.closest(".klsv-veil"))) continue;
      return true;
    }
    for (const node of record.removedNodes) {
      if (node instanceof HTMLElement && (node.classList.contains("klsv-veil") || node.closest(".klsv-veil"))) continue;
      return true;
    }
  }
  return false;
}

async function start(): Promise<void> {
  const loaded = (await pullState()) || (await wait(400).then(pullState));
  if (!loaded) return;
  observer = new MutationObserver((records) => {
    if (!mutationMatters(records)) return;
    scheduleScan();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("scroll", () => scheduleScan(450), { passive: true, capture: true });
  scheduleScan(0);
}

async function pullState(): Promise<boolean> {
  try {
    const state = await sendMessage<StatePayload>({ type: "get-state" });
    if (!state.ok) return false;
    applyRuntime(state.settings, state.paused);
    return true;
  } catch {
    return false;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
