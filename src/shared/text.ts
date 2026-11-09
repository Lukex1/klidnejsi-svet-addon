export function fold(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}%]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeAuthor(value: string): string {
  return value.trim().replace(/^@+/, "").replace(/\s+/g, " ").toLocaleLowerCase();
}

export function sameAuthor(left: string, right: string): boolean {
  const a = normalizeAuthor(left);
  const b = normalizeAuthor(right);
  return a.length > 1 && a === b;
}

export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.includes(".");
  } catch {
    return false;
  }
}

export function isLoopbackUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  } catch {
    return false;
  }
}

export function isModelEndpoint(value: string): boolean {
  return isHttpsUrl(value) || isLoopbackUrl(value);
}

export function endpointPermission(value: string): string | null {
  try {
    const url = new URL(value);
    if (isHttpsUrl(value)) return "https://*/*";
    if (isLoopbackUrl(value)) return `${url.protocol}//${url.hostname}/*`;
    return null;
  } catch {
    return null;
  }
}

export function linesFrom(value: string, min: number, maxItems: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of value.split(/\n+/)) {
    const text = raw.trim();
    if (text.length < min || text.length > 80) continue;
    const key = fold(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
}
