import { applyEmbedded } from "../classifier/embedded.ts";
import { analyze, thresholdFor } from "../classifier/score.ts";
import { CATEGORIES, MODE_META, SITES } from "../shared/catalog.ts";
import { applyStaticCopy, categoryCopy, modeCopy, optionText, sensitivityName, t } from "../shared/copy.ts";
import { inExtension, sendMessage } from "../shared/browser.ts";
import { applyPatch, defaultSettings, mergeSettings } from "../shared/settings.ts";
import { emptyStats, recentDays, topHosts } from "../shared/stats.ts";
import { endpointPermission, isModelEndpoint, linesFrom } from "../shared/text.ts";
import { firstSentence, replacementFor } from "../replace/library.ts";
import {
  CATEGORY_IDS,
  type CategoryId,
  type CloudResult,
  type Lang,
  type Mode,
  type Settings,
  type SettingsPatch,
  type SiteId,
  type StatePayload,
  type Stats,
} from "../shared/types.ts";
import { applyTheme, byId, mountChecks, mountChips, syncChecks, syncChips } from "../ui/controls.ts";

const SAMPLES: readonly (readonly [string, string])[] = [
  ["sampleCalm", "Rano padało, potem wyszło słońce i kawa smakowała lepiej niż wczoraj."],
  ["sampleRage", "Nikt wam tego nie powie. Czy wy jesteście ślepi? Zrobili z was idiotów i będziecie płakać!"],
  [
    "sampleSlop",
    "W dzisiejszym dynamicznym świecie warto się temu przyjrzeć. W tym artykule omówimy, jak to rewolucjonizuje sposób pracy. Kluczowe jest, aby działać.",
  ],
  ["sampleInsult", "Jesteś żałosny, zamknij ryj, nikt cię tu nie chce."],
  ["sampleAd", "Gwarantowany zysk. Zarabiam z domu, link in bio, airdrop czeka."],
];

let settings: Settings = defaultSettings();
let stats: Stats = emptyStats();
let writing = false;

const enabled = byId<HTMLButtonElement>("enabled");
const dark = byId<HTMLButtonElement>("dark");
const sensitivity = byId<HTMLInputElement>("sensitivity");
const sensitivityText = byId<HTMLElement>("sensitivity-label");
const threshold = byId<HTMLParagraphElement>("threshold");
const modes = byId<HTMLDivElement>("modes");
const modeHint = byId<HTMLParagraphElement>("mode-hint");
const showReason = byId<HTMLInputElement>("show-reason");
const language = byId<HTMLDivElement>("language");
const uiLang = byId<HTMLDivElement>("ui-lang");
const categories = byId<HTMLDivElement>("categories");
const sites = byId<HTMLDivElement>("sites");
const allow = byId<HTMLTextAreaElement>("allow");
const block = byId<HTMLTextAreaElement>("block");
const authors = byId<HTMLTextAreaElement>("authors");
const embedded = byId<HTMLButtonElement>("embedded");
const neural = byId<HTMLButtonElement>("neural");
const cloudEnabled = byId<HTMLButtonElement>("cloud-enabled");
const endpoint = byId<HTMLInputElement>("endpoint");
const model = byId<HTMLInputElement>("model");
const apiKey = byId<HTMLInputElement>("api-key");
const showKey = byId<HTMLButtonElement>("show-key");
const testCloud = byId<HTMLButtonElement>("test-cloud");
const cloudResult = byId<HTMLElement>("cloud-result");
const samples = byId<HTMLDivElement>("samples");
const draft = byId<HTMLTextAreaElement>("draft");
const decision = byId<HTMLParagraphElement>("decision");
const scoreList = byId<HTMLDivElement>("score-list");
const reasons = byId<HTMLDivElement>("reasons");
const previewKicker = byId<HTMLParagraphElement>("preview-kicker");
const previewBody = byId<HTMLParagraphElement>("preview-body");
const days = byId<HTMLDivElement>("days");
const hosts = byId<HTMLUListElement>("hosts");
const emptyStatsNote = byId<HTMLParagraphElement>("empty-stats");
const allTime = byId<HTMLElement>("all-time");
const todayTotal = byId<HTMLElement>("today-total");
const shortcut = byId<HTMLElement>("shortcut");
const saveState = byId<HTMLElement>("save-state");
const importFile = byId<HTMLInputElement>("import-file");

mountChecks(categories, CATEGORIES, true, (id, on) => {
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
  button.textContent = mode.id;
  button.addEventListener("click", () => void persist({ mode: mode.id }));
  modes.append(button);
}

for (const [label, text] of SAMPLES) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ghost";
  button.dataset.copy = label;
  button.textContent = label;
  button.addEventListener("click", () => {
    draft.value = text;
    preview();
  });
  samples.append(button);
}

enabled.addEventListener("click", () => void persist({ enabled: enabled.getAttribute("aria-checked") !== "true" }));
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
embedded.addEventListener("click", () => {
  void persist({ cloud: { embedded: embedded.getAttribute("aria-checked") !== "true" } });
});
neural.addEventListener("click", () => {
  void persist({ cloud: { neural: neural.getAttribute("aria-checked") !== "true" } });
});
cloudEnabled.addEventListener("click", () => {
  void persist({ cloud: { enabled: cloudEnabled.getAttribute("aria-checked") !== "true" } });
});
showReason.addEventListener("change", () => void persist({ showReason: showReason.checked }));
sensitivity.addEventListener("input", () => {
  settings = applyPatch(settings, { sensitivity: Number(sensitivity.value) });
  paint();
  preview();
  schedule({ sensitivity: Number(sensitivity.value) });
});

for (const button of language.querySelectorAll("button")) {
  button.addEventListener("click", () => {
    const lang = button.dataset.lang === "en" ? "en" : "pl";
    void persist({ language: lang satisfies Lang });
  });
}

for (const field of [allow, block, authors, endpoint, model, apiKey]) {
  field.addEventListener("input", () => schedule(fieldPatch()));
}

showKey.addEventListener("click", () => {
  apiKey.type = apiKey.type === "password" ? "text" : "password";
  showKey.textContent = optionText(settings.ui, apiKey.type === "password" ? "show" : "hide");
});

draft.addEventListener("input", () => preview());

testCloud.addEventListener("click", () => {
  void (async () => {
    cloudResult.textContent = optionText(settings.ui, "asking");
    if (!inExtension()) {
      cloudResult.textContent = optionText(settings.ui, "onlyInside");
      return;
    }
    const origin = endpointPermission(endpoint.value.trim());
    if (!origin) {
      cloudResult.textContent = optionText(settings.ui, "needUrl");
      return;
    }
    const granted = await new Promise<boolean>((resolve) => {
      chrome.permissions.request({ origins: [origin] }, (ok) => resolve(Boolean(ok)));
    });
    if (!granted) {
      cloudResult.textContent = optionText(settings.ui, "needPermission");
      return;
    }
    await persist(fieldPatch(), false);
    const result = await sendMessage<CloudResult>({
      type: "test-cloud",
      endpoint: endpoint.value.trim(),
      model: model.value.trim(),
      apiKey: apiKey.value,
    });
    cloudResult.textContent = result.ok ? optionText(settings.ui, "connected") : result.error;
  })().catch(() => {
    cloudResult.textContent = optionText(settings.ui, "checkFailed");
  });
});

byId<HTMLButtonElement>("export").addEventListener("click", () => {
  const payload = {
    ...settings,
    cloud: {
      embedded: settings.cloud.embedded,
      neural: settings.cloud.neural,
      enabled: settings.cloud.enabled,
      endpoint: settings.cloud.endpoint,
      model: settings.cloud.model,
    },
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "klsv-ustawienia.json";
  link.click();
  URL.revokeObjectURL(link.href);
});

byId<HTMLButtonElement>("import").addEventListener("click", () => importFile.click());
importFile.addEventListener("change", () => {
  const file = importFile.files?.[0];
  if (!file) return;
  void file.text().then(async (text) => {
    const parsed: unknown = JSON.parse(text);
    settings = mergeSettings(parsed, settings);
    paint();
    await persist(settings);
  }).catch(() => {
    saveState.textContent = optionText(settings.ui, "importFailed");
  });
});

byId<HTMLButtonElement>("reset").addEventListener("click", () => {
  const question = settings.ui === "cs" ? "Vymazat nastavení, klíč a statistiky?" : "Wyczyścić ustawienia, klucz i statystyki?";
  if (!confirm(question)) return;
  if (!inExtension()) {
    settings = defaultSettings();
    stats = emptyStats();
    paint();
    return;
  }
  void sendMessage({ type: "reset" }).then(() => load());
});

if (inExtension()) {
  chrome.storage.onChanged.addListener(() => {
    if (writing) return;
    void load();
  });
  chrome.commands.getAll((commands) => {
    const toggle = commands.find((command) => command.name === "toggle-enabled");
    shortcut.textContent = toggle?.shortcut || optionText(settings.ui, "unassigned");
  });
} else {
  shortcut.textContent = optionText(settings.ui, "onlyExtension");
}

void load();

let saveTimer = 0;
function schedule(patch: SettingsPatch): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => void persist(patch, false), 350);
}

async function load(): Promise<void> {
  if (!inExtension()) {
    paint();
    return;
  }
  try {
    const state = await sendMessage<StatePayload>({ type: "get-state" });
    if (state.ok) {
      settings = state.settings;
      stats = state.stats;
    }
  } catch {
    saveState.textContent = t(settings.ui, "backgroundDown");
  }
  paint();
}

async function persist(patch: SettingsPatch, paintNow = true): Promise<void> {
  settings = applyPatch(settings, patch);
  if (paintNow) paint();
  else preview();
  if (!inExtension()) return;
  writing = true;
  try {
    await sendMessage({ type: "patch-settings", patch });
    saveState.textContent = optionText(settings.ui, "saved");
  } catch {
    saveState.textContent = t(settings.ui, "saveFailed");
  } finally {
    window.setTimeout(() => {
      writing = false;
    }, 400);
  }
}

function fieldPatch(): SettingsPatch {
  const nextEndpoint = endpoint.value.trim();
  const cloud: SettingsPatch["cloud"] = {
    embedded: embedded.getAttribute("aria-checked") === "true",
    neural: neural.getAttribute("aria-checked") === "true",
    enabled: cloudEnabled.getAttribute("aria-checked") === "true",
    model: model.value.trim(),
    apiKey: apiKey.value,
  };
  if (!nextEndpoint || isModelEndpoint(nextEndpoint)) cloud.endpoint = nextEndpoint;
  return {
    allowPhrases: linesFrom(allow.value, 3, 100),
    blockPhrases: linesFrom(block.value, 3, 100),
    allowAuthors: linesFrom(authors.value, 2, 200),
    cloud,
  };
}

function paint(): void {
  applyTheme(settings.dark);
  applyStaticCopy(settings.ui);
  enabled.setAttribute("aria-checked", String(settings.enabled));
  dark.setAttribute("aria-checked", String(settings.dark));
  for (const button of uiLang.querySelectorAll("button")) {
    button.setAttribute("aria-checked", String(button.dataset.ui === settings.ui));
  }
  embedded.setAttribute("aria-checked", String(settings.cloud.embedded));
  neural.setAttribute("aria-checked", String(settings.cloud.neural));
  cloudEnabled.setAttribute("aria-checked", String(settings.cloud.enabled));
  sensitivity.value = String(settings.sensitivity);
  sensitivityText.textContent = sensitivityName(settings.ui, settings.sensitivity);
  threshold.textContent = `${optionText(settings.ui, "thresholdIs")} ${thresholdFor(settings.sensitivity)}. ${optionText(settings.ui, "thresholdLong")}`;
  showKey.textContent = optionText(settings.ui, apiKey.type === "password" ? "show" : "hide");
  showReason.checked = settings.showReason;
  if (document.activeElement !== allow) allow.value = settings.allowPhrases.join("\n");
  if (document.activeElement !== block) block.value = settings.blockPhrases.join("\n");
  if (document.activeElement !== authors) authors.value = settings.allowAuthors.join("\n");
  if (document.activeElement !== endpoint) endpoint.value = settings.cloud.endpoint;
  if (document.activeElement !== model) model.value = settings.cloud.model;
  if (document.activeElement !== apiKey) apiKey.value = settings.cloud.apiKey;
  for (const input of categories.querySelectorAll("input")) {
    const id = input.dataset.id as CategoryId | undefined;
    if (!id) continue;
    const meta = categoryCopy(settings.ui, id);
    const strong = input.parentElement?.querySelector("strong");
    const small = input.parentElement?.querySelector("small");
    if (strong) strong.textContent = meta.label;
    if (small) small.textContent = meta.hint;
  }
  syncChecks(categories, (id) => settings.categories[id as CategoryId] === true);
  syncChips(sites, (id) => settings.sites[id as SiteId] === true);
  for (const button of modes.querySelectorAll("button")) {
    const id = button.dataset.mode as Mode | undefined;
    const on = id === settings.mode;
    if (id) {
      const meta = modeCopy(settings.ui, id);
      button.textContent = meta.label;
      if (on) modeHint.textContent = meta.hint;
    }
    button.setAttribute("aria-checked", String(on));
  }
  for (const button of language.querySelectorAll("button")) {
    button.setAttribute("aria-checked", String(button.dataset.lang === settings.language));
  }
  allTime.textContent = String(stats.allTime);
  todayTotal.textContent = String(stats.today.total);
  paintDays();
  paintHosts();
  preview();
}

function paintDays(): void {
  const points = recentDays(stats);
  const max = Math.max(1, ...points.map((point) => point.total));
  days.replaceChildren();
  for (const point of points) {
    const column = document.createElement("span");
    const bar = document.createElement("i");
    bar.style.height = `${Math.max(2, Math.round((point.total / max) * 78))}px`;
    bar.title = `${point.day}: ${point.total}`;
    const label = document.createElement("b");
    label.textContent = point.day.slice(8);
    column.append(bar, label);
    days.append(column);
  }
}

function paintHosts(): void {
  const list = topHosts(stats);
  hosts.replaceChildren();
  emptyStatsNote.hidden = stats.today.total > 0;
  for (const item of list) {
    const row = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = item.host;
    const total = document.createElement("strong");
    total.textContent = String(item.total);
    row.append(name, total);
    hosts.append(row);
  }
}

function preview(): void {
  const text = draft.value.trim();
  if (!text) {
    decision.textContent = optionText(settings.ui, "paste");
    scoreList.replaceChildren();
    reasons.replaceChildren();
    previewKicker.textContent = "klsv";
    previewBody.textContent = optionText(settings.ui, "previewEmpty");
    return;
  }
  const drafted = {
    text,
    sensitivity: settings.sensitivity,
    categories: settings.categories,
    allowPhrases: settings.allowPhrases,
    blockPhrases: settings.blockPhrases,
    promoted: false,
  };
  const exact = analyze(drafted);
  const verdict = settings.cloud.embedded ? applyEmbedded(exact, drafted) : exact;
  const verdictWord = optionText(settings.ui, verdict.hide ? "wouldHide" : "wouldKeep");
  decision.textContent = `${verdictWord} ${optionText(settings.ui, "thresholdIs")} ${verdict.threshold}.`;
  scoreList.replaceChildren();
  for (const id of CATEGORY_IDS) {
    const row = document.createElement("div");
    row.className = settings.categories[id] ? "score" : "score off";
    const name = document.createElement("span");
    name.textContent = categoryCopy(settings.ui, id).label;
    const track = document.createElement("div");
    track.className = "track";
    const bar = document.createElement("i");
    bar.style.width = `${verdict.scores[id]}%`;
    track.append(bar);
    const value = document.createElement("em");
    value.textContent = String(verdict.scores[id]);
    row.append(name, track, value);
    scoreList.append(row);
  }
  reasons.replaceChildren();
  for (const reason of verdict.reasons) {
    const chip = document.createElement("span");
    chip.textContent = reason;
    reasons.append(chip);
  }
  if (!verdict.hide) {
    previewKicker.textContent = optionText(settings.ui, "stays");
    previewBody.textContent = text;
    return;
  }
  const replacement = replacementFor(text, settings.language, verdict, settings.showReason);
  previewKicker.textContent = replacement.kicker;
  previewBody.textContent = settings.mode === "line" ? firstSentence(replacement.body) : replacement.body;
}
