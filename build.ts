import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { createManifest, type BrowserTarget } from "./src/manifest-data.ts";

const CHROME_DIR = "./dist/chrome";
const FIREFOX_DIR = "./dist/firefox";

async function main(): Promise<void> {
  await buildOnce();
  if (!process.argv.includes("--watch")) return;
  console.log("Czekam na zmiany w src…");
  const { watch } = await import("node:fs");
  let timer: ReturnType<typeof setTimeout> | null = null;
  watch("./src", { recursive: true }, () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      buildOnce().catch((error: unknown) => console.error(error));
    }, 150);
  });
}

async function buildOnce(): Promise<void> {
  console.log("Czyszczenie dist…");
  await rm("./dist", { recursive: true, force: true });
  await mkdir(CHROME_DIR, { recursive: true });

  console.log("Budowanie skryptów…");
  const pages = await Bun.build({
    entrypoints: ["./src/background/index.ts", "./src/popup/index.ts", "./src/options/index.ts"],
    outdir: CHROME_DIR,
    root: "./src",
    target: "browser",
    format: "esm",
    splitting: false,
    minify: false,
    sourcemap: "none",
    naming: {
      entry: "[dir]/[name].[ext]",
      chunk: "[name].[ext]",
      asset: "[name].[ext]",
    },
  });
  if (!pages.success) throw new Error(pages.logs.map((log) => log.message).join("\n"));

  const content = await Bun.build({
    entrypoints: ["./src/content/index.ts"],
    outdir: `${CHROME_DIR}/content`,
    target: "browser",
    format: "iife",
    minify: false,
    sourcemap: "none",
    naming: "[name].[ext]",
  });
  if (!content.success) throw new Error(content.logs.map((log) => log.message).join("\n"));

  const model = await Bun.build({
    entrypoints: ["./src/model/runtime.ts"],
    outdir: `${CHROME_DIR}/model`,
    target: "browser",
    format: "esm",
    splitting: false,
    minify: false,
    sourcemap: "none",
    naming: "[name].[ext]",
  });
  if (!model.success) throw new Error(model.logs.map((log) => log.message).join("\n"));

  await copyStatic(CHROME_DIR);
  await writeIcons(`${CHROME_DIR}/icons`);
  await writeManifest(CHROME_DIR, "chrome");
  await cp(CHROME_DIR, FIREFOX_DIR, { recursive: true });
  await writeManifest(FIREFOX_DIR, "firefox");
  console.log("Chrome:  dist/chrome");
  console.log("Firefox: dist/firefox");
}

async function copyStatic(outdir: string): Promise<void> {
  await mkdir(`${outdir}/popup`, { recursive: true });
  await mkdir(`${outdir}/options`, { recursive: true });
  await mkdir(`${outdir}/ui`, { recursive: true });
  await mkdir(`${outdir}/content`, { recursive: true });
  await cp("./src/popup/index.html", `${outdir}/popup/index.html`);
  await cp("./src/popup/popup.css", `${outdir}/popup/popup.css`);
  await cp("./src/options/index.html", `${outdir}/options/index.html`);
  await cp("./src/options/options.css", `${outdir}/options/options.css`);
  await cp("./src/ui/theme.css", `${outdir}/ui/theme.css`);
  await cp("./src/content/feed.css", `${outdir}/content/feed.css`);
  await mkdir(`${outdir}/model`, { recursive: true });
  await cp("./src/model/offscreen.html", `${outdir}/model/offscreen.html`);
  await mkdir(`${outdir}/ort`, { recursive: true });
  await cp(
    "./node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm",
    `${outdir}/ort/ort-wasm-simd-threaded.asyncify.wasm`,
  );
  await cp(
    "./node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs",
    `${outdir}/ort/ort-wasm-simd-threaded.asyncify.mjs`,
  );
  await cp(
    "./node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm",
    `${outdir}/model/ort-wasm-simd-threaded.asyncify.wasm`,
  );
  await cp(
    "./node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs",
    `${outdir}/model/ort-wasm-simd-threaded.asyncify.mjs`,
  );
}

async function writeManifest(outdir: string, target: BrowserTarget): Promise<void> {
  const manifest = createManifest(target);
  await writeFile(`${outdir}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
}

function crc32(buffer: Buffer): number {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return ~crc >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function png(size: number, rgba: Uint8Array): Buffer {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    const start = y * (size * 4 + 1);
    raw[start] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * size * 4, size * 4).copy(raw, start + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function cover(distance: number, radius: number): number {
  return Math.max(0, Math.min(1, radius - distance + 0.75));
}

function iconPixels(size: number): Uint8Array {
  const pixels = new Uint8Array(size * size * 4);
  const radius = size * 0.28;
  const center = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const dx = px < radius ? radius - px : px > size - radius ? px - (size - radius) : 0;
      const dy = py < radius ? radius - py : py > size - radius ? py - (size - radius) : 0;
      const outside = dx === 0 && dy === 0 ? 0 : Math.hypot(dx, dy);
      const alpha = outside === 0 ? 1 : cover(outside, radius);
      if (alpha <= 0) continue;
      const dist = Math.hypot(px - center, py - center);
      let red = 35;
      let green = 64;
      let blue = 54;
      if (dist < size * 0.33) {
        red = 244;
        green = 240;
        blue = 230;
      }
      const horizon = center + size * 0.06;
      const sun = Math.hypot(px - center, py - (horizon - size * 0.1));
      if (sun < size * 0.035) {
        red = 184;
        green = 97;
        blue = 69;
      } else if (dist < size * 0.27 && Math.abs(py - horizon) < Math.max(1, size * 0.018)) {
        red = 35;
        green = 64;
        blue = 54;
      } else if (
        dist < size * 0.2 &&
        Math.abs(px - center) < size * 0.16 &&
        Math.abs(py - (horizon + size * 0.055)) < Math.max(1, size * 0.014)
      ) {
        red = 35;
        green = 64;
        blue = 54;
      }
      const index = (y * size + x) * 4;
      pixels[index] = red;
      pixels[index + 1] = green;
      pixels[index + 2] = blue;
      pixels[index + 3] = Math.round(alpha * 255);
    }
  }
  return pixels;
}

async function writeIcons(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    await writeFile(`${dir}/icon${size}.png`, png(size, iconPixels(size)));
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
