import { CATEGORIES, CATEGORY_MARK, MODE_META, SITES } from "../shared/catalog.ts";
import { applyStaticCopy, categoryCopy, modeCopy, modelLine, sensitivityName, t } from "../shared/copy.ts";
import { inExtension, queryActiveTab, sendMessage, sendTabMessage } from "../shared/browser.ts";
import { applyPatch, defaultSettings, siteFromHost } from "../shared/settings.ts";
import { emptyScores, emptyStats } from "../shared/stats.ts";
import { thresholdFor } from "../classifier/score.ts";
import type { CategoryId, Mode, NeuralStatus, Scores, Settings, SettingsPatch, SiteId, StatePayload, Stats } from "../shared/types.ts";
import { applyTheme, byId, mountChecks, mountChips, syncChecks, syncChips } from "../ui/controls.ts";

let settings: Settings = defaultSettings();
let stats: Stats = emptyStats();
let paused = false;
let tabId: number | null = null;
let tabUrl: string | null = null;
let scriptMissing = false;
let writing = false;
let tally = { total: 0, counts: emptyScores(), custom: 0, known: false };

const enabled = byId<HTMLButtonElement>("enabled");
const dark = byId<HTMLButtonElement>("dark");
const uiLang = byId<HTMLDivElement>("ui-lang");
const status = byId<HTMLParagraphElement>("status");
const count = byId<HTMLElement>("count");
const badges = byId<HTMLDivElement>("badges");
const modelStatus = byId<HTMLParagraphElement>("model-status");
const hint = byId<HTMLParagraphElement>("hint");
const pause = byId<HTMLButtonElement>("pause");
const inject = byId<HTMLButtonElement>("inject");
const sensitivity = byId<HTMLInputElement>("sensitivity");
const sensitivityText = byId<HTMLElement>("sensitivity-label");
const threshold = byId<HTMLParagraphElement>("threshold");
const modes = byId<HTMLDivElement>("modes");
const categories = byId<HTMLDivElement>("categories");
const sites = byId<HTMLDivElement>("sites");
const today = byId<HTMLElement>("today");
const options = byId<HTMLButtonElement>("options");

mountChecks(categories, CATEGORIES, false, (id, on) => {
  void persist({ categories: { [id as CategoryId]: on } });
});
mountChips(sites, SITES, (id, on) => {
  void persist({ sites: { [id as SiteId]: on } });
});

for (const mode of MODE_META) {
  const button = document.createElement("button");
  button.type = "button";
  button.role = "radio";
  button.dataset.mode = mode.id;
  button.textContent = mode.label;
  button.title = mode.hint;
  button.addEventListener("click", () => {
    void persist({ mode: mode.id });
  });
  modes.append(button);
}

enabled.addEventListener("click", () => {
  void persist({ enabled: enabled.getAttribute("aria-checked") !== "true" });
});

for (const button of uiLang.querySelectorAll("button")) {
  button.addEventListener("click", () => {
    void persist({ ui: button.dataset.ui === "cs" ? "cs" : "pl" });
  });
}

dark.addEventListener("click", () => {
  const next = dark.getAttribute("aria-checked") !== "true";
  applyTheme(next);
  void persist({ dark: next });
});

pause.addEventListener("click", () => {
  if (!inExtension() || tabId == null) return;
  paused = !paused;
  sync();
  void sendMessage({ type: "set-paused", tabId, paused }).catch(() => undefined);
});

inject.addEventListener("click", () => {
  void injectHere();
});

sensitivity.addEventListener("input", () => {
  settings = applyPatch(settings, { sensitivity: Number(sensitivity.value) });
  sync();
  scheduleSave({ sensitivity: Number(sensitivity.value) });
});

options.addEventListener("click", () => {
  if (inExtension()) chrome.runtime.openOptionsPage();
});

if (inExtension()) {
  chrome.storage.onChanged.addListener(() => {
    if (writing) return;
    void load();
  });
}

void load();
window.setInterval(() => {
  void refreshCount();
  void refreshModel();
}, 1500);

let saveTimer = 0;
function scheduleSave(patch: SettingsPatch): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void persist(patch, false);
  }, 160);
}

async function load(): Promise<void> {
  if (inExtension()) {
    const tab = await queryActiveTab();
    tabId = tab?.id ?? null;
    tabUrl = tab?.url ?? null;
    try {
      const state = await sendMessage<StatePayload>({ type: "get-state", tabId: tabId ?? undefined });
      if (state.ok) {
        settings = state.settings;
        stats = state.stats;
        paused = state.paused;
        tabUrl = state.tabUrl ?? tabUrl;
        tabId = state.tabId ?? tabId;
      }
    } catch {
      status.textContent = t(settings.ui, "backgroundDown");
    }
  }
  sync();
  await refreshCount();
  await refreshModel();
}

async function persist(patch: SettingsPatch, paint = true): Promise<void> {
  settings = applyPatch(settings, patch);
  if (paint) sync();
  if (!inExtension()) return;
  writing = true;
  try {
    await sendMessage({ type: "patch-settings", patch });
  } catch {
    status.textContent = t(settings.ui, "saveFailed");
  } finally {
    window.setTimeout(() => {
      writing = false;
    }, 300);
  }
}

function hostnameOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function describe(): string {
  const ui = settings.ui;
  if (!inExtension()) return t(ui, "previewOutside");
  if (!settings.enabled) return t(ui, "off");
  if (paused) return t(ui, "paused");
  const host = hostnameOf(tabUrl);
  const site = host ? siteFromHost(host) : null;
  if (!host || !site) return t(ui, "skipPage");
  if (!settings.sites[site]) return `${host} ${t(ui, "siteOff")}`;
  return `${t(ui, "worksOn")} ${host}`;
}

function renderBadges(): void {
  badges.replaceChildren();
  for (const category of CATEGORIES) {
    if (!settings.categories[category.id]) continue;
    const chip = document.createElement("span");
    chip.className = "badge";
    const value = tally.known ? String(tally.counts[category.id]) : "–";
    chip.textContent = `${CATEGORY_MARK[category.id]}:${value}`;
    chip.title = categoryCopy(settings.ui, category.id).label;
    badges.append(chip);
  }
  if (tally.custom > 0) {
    const own = document.createElement("span");
    own.className = "badge";
    own.textContent = `+:${tally.custom}`;
    own.title = t(settings.ui, "ownPhrase");
    badges.append(own);
  }
}

function sync(): void {
  applyTheme(settings.dark);
  applyStaticCopy(settings.ui);
  enabled.setAttribute("aria-checked", String(settings.enabled));
  dark.setAttribute("aria-checked", String(settings.dark));
  for (const button of uiLang.querySelectorAll("button")) {
    button.setAttribute("aria-checked", String(button.dataset.ui === settings.ui));
  }
  for (const input of categories.querySelectorAll("input")) {
    const id = input.dataset.id as CategoryId | undefined;
    if (!id) continue;
    const meta = categoryCopy(settings.ui, id);
    const strong = input.parentElement?.querySelector("strong");
    if (strong) strong.textContent = meta.label;
  }
  renderBadges();
  status.textContent = describe();
  sensitivity.value = String(settings.sensitivity);
  sensitivityText.textContent = sensitivityName(settings.ui, settings.sensitivity);
  threshold.textContent = `${t(settings.ui, "threshold")}: ${thresholdFor(settings.sensitivity)}. ${t(settings.ui, "thresholdHint")}`;
  today.textContent = String(stats.today.total);
  pause.textContent = paused ? t(settings.ui, "resume") : t(settings.ui, "pause");
  inject.textContent = t(settings.ui, "inject");
  syncChecks(categories, (id) => settings.categories[id as CategoryId] === true);
  syncChips(sites, (id) => settings.sites[id as SiteId] === true);
  for (const button of modes.querySelectorAll("button")) {
    const id = button.dataset.mode as Mode | undefined;
    if (id) {
      const meta = modeCopy(settings.ui, id);
      button.textContent = meta.label;
      button.title = meta.hint;
    }
    button.setAttribute("aria-checked", String(button.dataset.mode === settings.mode));
  }
  const host = hostnameOf(tabUrl);
  const site = host ? siteFromHost(host) : null;
  const canInject = inExtension() && settings.enabled && !paused && site != null && settings.sites[site] && scriptMissing;
  inject.hidden = !canInject;
  hint.hidden = !canInject;
}

async function refreshModel(): Promise<void> {
  if (!inExtension()) {
    modelStatus.textContent = t(settings.ui, "modelOutside");
    return;
  }
  try {
    const response = await sendMessage<NeuralStatus>({ type: "neural-status" });
    modelStatus.textContent = modelLine(settings.ui, response.detail);
  } catch {
    modelStatus.textContent = t(settings.ui, "modelSilent");
  }
}

async function refreshCount(): Promise<void> {
  if (!inExtension() || tabId == null) {
    count.textContent = "—";
    tally = { total: 0, counts: emptyScores(), custom: 0, known: !inExtension() };
    sync();
    return;
  }
  try {
    const response = await sendTabMessage<{ ok: true; total: number; counts: Scores; custom: number }>(tabId, { type: "get-count" });
    tally = { total: response.total, counts: response.counts, custom: response.custom, known: true };
    count.textContent = String(response.total);
    scriptMissing = false;
  } catch {
    count.textContent = "—";
    scriptMissing = true;
    tally = { total: 0, counts: emptyScores(), custom: 0, known: false };
  }
  sync();
}

async function injectHere(): Promise<void> {
  if (tabId == null) return;
  try {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["content/feed.css"] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content/index.js"] });
    scriptMissing = false;
    window.setTimeout(() => void refreshCount(), 500);
  } catch {
    hint.hidden = false;
    hint.textContent = t(settings.ui, "hintBlocked");
  }
}
