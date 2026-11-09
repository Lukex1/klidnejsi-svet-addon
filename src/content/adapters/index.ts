import { siteFromHost } from "../../shared/settings.ts";
import type { SiteId } from "../../shared/types.ts";

export interface Candidate {
  el: HTMLElement;
  text: string;
  author: string;
  promoted: boolean;
}

interface Extracted {
  text: string;
  author: string;
  promoted: boolean;
}

type Extract = (el: HTMLElement) => Extracted | null;

interface SiteConfig {
  selector: string;
  extract: Extract;
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function dedupe(parts: string[]): string {
  const unique = [...new Set(parts.filter((part) => part.length > 0))];
  unique.sort((a, b) => b.length - a.length);
  const kept: string[] = [];
  for (const part of unique) {
    if (kept.some((item) => item.includes(part))) continue;
    kept.push(part);
    if (kept.length >= 4) break;
  }
  return kept.join("\n").slice(0, 4000);
}

function decodeName(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function authorFrom(root: ParentNode, selectors: readonly string[]): string {
  for (const selector of selectors) {
    const node = root.querySelector(selector);
    if (!(node instanceof HTMLElement)) continue;
    if (node instanceof HTMLAnchorElement) {
      const href = node.getAttribute("href") ?? "";
      const match = /\/(?:user|u|profile|@|in)\/([^/?#]+)/i.exec(href);
      const name = match?.[1];
      if (name) return decodeName(name).replace(/^@/, "").slice(0, 80);
    }
    const handle = node.textContent?.match(/@[\w.]{2,40}/);
    if (handle?.[0]) return handle[0].slice(1, 81);
    const text = clean(node.textContent ?? "");
    const first = text.split("·")[0]?.trim() ?? "";
    if (first) return first.slice(0, 80);
  }
  return "";
}

function isPromoted(el: HTMLElement, selectors: readonly string[]): boolean {
  for (const selector of selectors) {
    try {
      if (el.matches(selector) || el.querySelector(selector)) return true;
    } catch {
      // Ignore a selector the site's DOM does not support.
    }
  }
  for (const node of el.querySelectorAll("[aria-label]")) {
    const label = node.getAttribute("aria-label") ?? "";
    if (label.length > 0 && label.length < 40 && /\b(promoted|sponsored|sponsorowane|reklama)\b/i.test(label)) {
      return true;
    }
  }
  return false;
}

function ownedText(el: HTMLElement, selector: string, textSelector: string, min: number): string {
  const nodes = [...el.querySelectorAll(textSelector)].filter((node): node is HTMLElement => node instanceof HTMLElement);
  const parts: string[] = [];
  for (const node of nodes) {
    if (node.closest("[contenteditable='true'], textarea, input")) continue;
    if (node.closest(selector) !== el) continue;
    const text = clean(node.innerText || "");
    if (text.length < min) continue;
    const nested = nodes.some((other) => other !== node && node.contains(other) && clean(other.innerText || "").length >= min);
    if (nested) continue;
    parts.push(text);
  }
  return dedupe(parts);
}

function fromSelectors(
  selector: string,
  textSelector: string,
  authors: readonly string[],
  promotedSelectors: readonly string[],
  min: number,
): Extract {
  return (el) => {
    const text = ownedText(el, selector, textSelector, min);
    const promoted = isPromoted(el, promotedSelectors);
    if (text.length < 16 && !promoted) return null;
    if (!text) return null;
    return { text, author: authorFrom(el, authors), promoted };
  };
}

function shadowChunks(el: HTMLElement): string[] {
  const chunks: string[] = [];
  let roots: ParentNode[] = el.shadowRoot ? [el.shadowRoot] : [];
  for (let depth = 0; depth < 3 && roots.length > 0; depth += 1) {
    const next: ParentNode[] = [];
    for (const root of roots) {
      for (const node of root.querySelectorAll("h1, h2, p, [slot='text-body'], [slot='comment'], [slot='title'], .md")) {
        if (!(node instanceof HTMLElement)) continue;
        const text = clean(node.innerText || node.textContent || "");
        if (text.length > 1) chunks.push(text);
      }
      for (const node of root.querySelectorAll("*")) {
        if (!(node instanceof HTMLElement) || !node.shadowRoot) continue;
        const tag = node.tagName;
        if (tag === "SHREDDIT-POST" || tag === "SHREDDIT-COMMENT") continue;
        next.push(node.shadowRoot);
      }
    }
    roots = next;
  }
  return chunks;
}

function marks(el: HTMLElement): string {
  const bits: string[] = [];
  for (const node of el.querySelectorAll("[aria-label], ytd-badge-supported-renderer, .yt-badge-shape")) {
    const label = clean(`${node.getAttribute("aria-label") ?? ""} ${node.textContent ?? ""}`);
    if (label.length < 4 || label.length > 90) continue;
    if (/\b(ai|sora|veo|kling|syntet|synthetic|generat)\b/i.test(label)) bits.push(label);
  }
  return dedupe(bits);
}

function extractReddit(el: HTMLElement): Extracted | null {
  const selector = "shreddit-post, shreddit-comment, div.thing, [data-testid='post-container']";
  const chunks: string[] = [];
  const title = el.getAttribute("post-title");
  if (title) chunks.push(clean(title));
  const light = ownedText(el, selector, "a.title, .usertext-body, [slot='text-body'], [slot='comment'], [data-click-id='text'], h1", 1);
  if (light) chunks.push(light);
  chunks.push(...shadowChunks(el));
  const text = dedupe(chunks);
  const promoted = el.getAttribute("promoted") === "true" || isPromoted(el, [".promotedlink"]);
  if (text.length < 16 && !promoted) return null;
  if (!text) return null;
  const author =
    el.getAttribute("author") ||
    authorFrom(el, ["a.author", "a[href*='/user/']", "a[href*='/u/']"]);
  return { text, author, promoted };
}

const SITES: Record<SiteId, SiteConfig> = {
  x: {
    selector: "article[data-testid='tweet']",
    extract: fromSelectors(
      "article[data-testid='tweet']",
      "[data-testid='tweetText']",
      ["[data-testid='User-Name']"],
      ["[data-testid='placementTracking']"],
      1,
    ),
  },
  reddit: {
    selector: "shreddit-post, shreddit-comment, div.thing, [data-testid='post-container']",
    extract: extractReddit,
  },
  facebook: {
    selector: "div[role='article']",
    extract: fromSelectors(
      "div[role='article']",
      "div[dir='auto'], span[dir='auto']",
      ["h2 a", "h3 a", "h4 a", "strong a"],
      ["[aria-label='Sponsored']"],
      24,
    ),
  },
  instagram: {
    selector: "article",
    extract: fromSelectors("article", "h1, span[dir='auto']", ["header a"], [], 20),
  },
  threads: {
    selector: "article",
    extract: fromSelectors("article", "h1, span[dir='auto'], div[dir='auto']", ["a[href*='/@']"], [], 20),
  },
  youtube: {
    selector:
      "ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-promoted-video-renderer, ytd-ad-slot-renderer, ytd-reel-item-renderer, ytd-reel-video-renderer, ytd-comment-thread-renderer, ytd-comment-view-model, ytd-comment-renderer",
    extract: (el) => {
      const base = fromSelectors(
        "ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-promoted-video-renderer, ytd-ad-slot-renderer, ytd-reel-item-renderer, ytd-reel-video-renderer, ytd-comment-thread-renderer, ytd-comment-view-model, ytd-comment-renderer",
        "#video-title, #content-text, #comment-content, h2, yt-shorts-video-title",
        ["#author-text", "ytd-channel-name a", "#author-comment-badge"],
        ["ytd-promoted-video-renderer", "ytd-ad-slot-renderer"],
        1,
      )(el);
      const extra = marks(el);
      if (!base && extra.length < 8) return null;
      if (!base) return { text: extra, author: "", promoted: false };
      return { ...base, text: dedupe([base.text, extra]) };
    },
  },
  linkedin: {
    selector: ".feed-shared-update-v2, div[data-urn*='urn:li:activity']",
    extract: fromSelectors(
      ".feed-shared-update-v2, div[data-urn*='urn:li:activity']",
      ".update-components-text, .feed-shared-inline-show-more-text, .update-components-update-v2__commentary",
      [".update-components-actor__name", ".update-components-actor__title"],
      [],
      20,
    ),
  },
  tiktok: {
    selector: "[data-e2e='recommend-list-item-container'], [data-e2e='search_top-item'], [data-e2e='browse-video'], [data-e2e='feed-video']",
    extract: (el) => {
      const base = fromSelectors(
        "[data-e2e='recommend-list-item-container'], [data-e2e='search_top-item'], [data-e2e='browse-video'], [data-e2e='feed-video']",
        "[data-e2e='video-desc'], [data-e2e='browse-video-desc'], [data-e2e='search-card-desc']",
        ["[data-e2e='video-author-uniqueid']", "[data-e2e='browse-username']"],
        [],
        1,
      )(el);
      const extra = marks(el);
      if (!base && extra.length < 8) return null;
      if (!base) return { text: extra, author: "", promoted: false };
      return { ...base, text: dedupe([base.text, extra]) };
    },
  },
  bsky: {
    selector: "[data-testid^='feedItem'], [data-testid='postThreadItem']",
    extract: fromSelectors(
      "[data-testid^='feedItem'], [data-testid='postThreadItem']",
      "[data-testid='postText']",
      ["a[href*='/profile/']"],
      [],
      1,
    ),
  },
};

function collect(selector: string, extract: Extract): Candidate[] {
  const posts: Candidate[] = [];
  for (const node of document.querySelectorAll(selector)) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.closest(".klsv-veil")) continue;
    if (node.getAttribute("aria-hidden") === "true") continue;
    if (node.closest("nav, [role='navigation'], [role='banner']")) continue;
    const rect = node.getBoundingClientRect();
    if (rect.width < 140 || rect.height < 28) continue;
    const extracted = extract(node);
    if (!extracted) continue;
    posts.push({ el: node, ...extracted });
  }
  return posts;
}

function watchVideo(): Candidate | null {
  const player = document.querySelector("#movie_player, #shorts-player");
  const meta = document.querySelector("ytd-watch-metadata, ytd-reel-video-renderer");
  if (!(player instanceof HTMLElement) || !(meta instanceof HTMLElement)) return null;
  const title = clean(meta.querySelector("h1, h2, #video-title")?.textContent ?? "");
  const about = clean(meta.querySelector("#description-inline-expander, ytd-text-inline-expander, #description")?.textContent ?? "");
  const text = dedupe([title, about, marks(meta)].filter((part) => part.length > 0));
  if (text.length < 8) return null;
  const rect = player.getBoundingClientRect();
  if (rect.width < 140 || rect.height < 28) return null;
  return {
    el: player,
    text,
    author: authorFrom(meta, ["ytd-channel-name a", "#channel-name a", "a[href*='/@']"]),
    promoted: false,
  };
}

export function findPosts(hostname = location.hostname): Candidate[] {
  const site = siteFromHost(hostname);
  if (!site) return [];
  const config = SITES[site];
  const primary = collect(config.selector, config.extract);
  if (site === "youtube") {
    const watch = watchVideo();
    if (watch && !primary.some((post) => post.el === watch.el || post.el.contains(watch.el))) primary.push(watch);
  }
  if (primary.length > 0) return primary;
  const fallbackSelector = "article, [role='article']";
  return collect(
    fallbackSelector,
    fromSelectors(fallbackSelector, "h1, h2, p, div[dir='auto']", ["a[href]"], [], 32),
  );
}
