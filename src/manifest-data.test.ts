import { expect, test } from "bun:test";
import { createManifest } from "./manifest-data.ts";

test("chrome and firefox manifests share the feed script and differ where they must", () => {
  const chrome = createManifest("chrome");
  const firefox = createManifest("firefox");
  expect("service_worker" in chrome.background ? chrome.background.service_worker : chrome.background.scripts[0]).toBe(
    "background/index.js",
  );
  expect(chrome.browser_specific_settings).toBeUndefined();
  expect(firefox.browser_specific_settings?.gecko.id).toBe("klsv@klidnejsi.svet");
  expect(chrome.content_scripts[0]?.matches.some((match) => match.includes("x.com"))).toBe(true);
  expect(firefox.content_scripts[0]?.css).toEqual(["content/feed.css"]);
  expect(chrome.permissions).toContain("scripting");
});
