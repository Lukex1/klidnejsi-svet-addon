export function inExtension(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
}

export function extensionUrl(path: string): string {
  return chrome.runtime.getURL(path);
}

export function sendMessage<T>(message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: T) => {
      const messageText = chrome.runtime.lastError?.message;
      if (messageText) reject(new Error(messageText));
      else resolve(response);
    });
  });
}

export function queryActiveTab(): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(tabs[0] ?? null);
    });
  });
}

export function sendTabMessage<T>(tabId: number, message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response: T) => {
      const messageText = chrome.runtime.lastError?.message;
      if (messageText) reject(new Error(messageText));
      else resolve(response);
    });
  });
}

export function storageGet(keys: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (items) => {
      resolve(items);
    });
  });
}

export function storageSet(items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, () => resolve());
  });
}

export function sessionGet(keys: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    if (!chrome.storage.session) {
      resolve({});
      return;
    }
    chrome.storage.session.get(keys, (items) => resolve(items));
  });
}

export function sessionSet(items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    if (!chrome.storage.session) {
      resolve();
      return;
    }
    chrome.storage.session.set(items, () => resolve());
  });
}

export function queryTabs(): Promise<chrome.tabs.Tab[]> {
  return new Promise((resolve) => {
    chrome.tabs.query({}, (tabs) => {
      if (chrome.runtime.lastError) resolve([]);
      else resolve(tabs);
    });
  });
}

export function getTab(tabId: number): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(tab);
    });
  });
}

export function isExtensionPage(sender: chrome.runtime.MessageSender): boolean {
  const url = sender.url ?? "";
  return url.startsWith(chrome.runtime.getURL(""));
}
