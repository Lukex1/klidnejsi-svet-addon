export type BrowserTarget = "chrome" | "firefox";

const HOSTS = [
  "x.com",
  "twitter.com",
  "reddit.com",
  "facebook.com",
  "instagram.com",
  "threads.net",
  "threads.com",
  "youtube.com",
  "linkedin.com",
  "tiktok.com",
  "bsky.app",
] as const;

function matches(): string[] {
  return HOSTS.flatMap((host) => [`*://${host}/*`, `*://*.${host}/*`]);
}

export interface ExtensionManifest {
  manifest_version: 3;
  name: string;
  version: string;
  description: string;
  minimum_chrome_version?: string;
  browser_specific_settings?: {
    gecko: { id: string; strict_min_version: string };
  };
  permissions: string[];
  host_permissions: string[];
  optional_host_permissions: string[];
  content_security_policy: { extension_pages: string };
  background: 
            | { service_worker: string; type: "module" }
            | { scripts: string[]; type?: "module" };
  action: {
    default_title: string;
    default_popup: string;
    default_icon: Record<string, string>;
  };
  options_ui: { page: string; open_in_tab: boolean };
  icons: Record<string, string>;
  commands: Record<string, { suggested_key: { default: string }; description: string }>;
  content_scripts: {
    matches: string[];
    js: string[];
    css: string[];
    run_at: "document_idle";
  }[];
}

const ICONS: Record<string, string> = {
  "16": "icons/icon16.png",
  "32": "icons/icon32.png",
  "48": "icons/icon48.png",
  "128": "icons/icon128.png",
};

export function createManifest(target: BrowserTarget): ExtensionManifest {
  const manifest: ExtensionManifest = {
    manifest_version: 3,
    name: "klsv",
    version: "1.0.0",
    description:
      "Klidnější svět. Chowa prowokację, szorstkie słowa i sztuczny połysk, także filmy z modelu, a w ich miejsce kładzie ciekawostkę.",
    permissions: ["storage", "scripting", "activeTab"],
    host_permissions: [
      "https://huggingface.co/*",
      "https://cdn-lfs.huggingface.co/*",
      "https://*.hf.co/*",
    ],
    optional_host_permissions: ["https://*/*", "http://127.0.0.1/*", "http://localhost/*"],
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
    background: {
      service_worker: "background/index.js",
      type: "module",
    },
    action: {
      default_title: "klsv — klidnější svět",
      default_popup: "popup/index.html",
      default_icon: ICONS,
    },
    options_ui: {
      page: "options/index.html",
      open_in_tab: true,
    },
    icons: ICONS,
    commands: {
      "toggle-enabled": {
        suggested_key: { default: "Alt+Shift+K" },
        description: "Włącz lub wyłącz klsv",
      },
    },
    content_scripts: [
      {
        matches: matches(),
        js: ["content/index.js"],
        css: ["content/feed.css"],
        run_at: "document_idle",
      },
    ],
  };

  if (target === "chrome") manifest.minimum_chrome_version = "111";
  if (target === "firefox") {
    manifest.background = {
      scripts: ["background/index.js"],
      type: "module"
    }
    manifest.browser_specific_settings = {
      gecko: {
        id: "klsv@klidnejsi.svet",
        strict_min_version: "128.0",
      },
    };
  }
  return manifest;
}
