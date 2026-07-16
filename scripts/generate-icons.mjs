// Reproducible app-icon / splash pipeline for Wharf Mobile.
//
// Derives every launcher asset from the Wharf brand mark — the design variant 1a
// `❯_` "prompt" mark (see wharf-web/public/favicon.svg) — so the phone icon matches
// the web favicon and the in-app brand chip. The mark geometry lives here as
// constants (scaled 16× from the 64px favicon), the script writes the canonical
// source SVGs into assets/brand/, then rasterises the required PNGs into
// assets/images/ with sharp.
//
// Run: `bun run gen:icons` (or `node scripts/generate-icons.mjs`).

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BRAND_DIR = resolve(ROOT, "assets/brand");
const IMAGE_DIR = resolve(ROOT, "assets/images");

const SIZE = 1024;
const SHELL = "#0A0E13"; // app background (tailwind `shell`)
const ACCENT = "#57D7C2"; // brand teal (default accent)

// The `❯_` mark in the 1024 canvas, centred: a rounded chevron plus an underscore
// bar. Scaled 16× from the favicon's 64px coordinates, nudged to sit on the canvas
// centre so it survives Android's circular/rounded adaptive-icon masking.
function markPaths(color) {
  return [
    `<path d="M300 336 L508 512 L300 688" fill="none" stroke="${color}"`,
    ` stroke-width="96" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<rect x="556" y="620" width="168" height="72" rx="24" fill="${color}"/>`,
  ].join("");
}

// Wraps the mark in a full SVG document. `background` fills the canvas (null =
// transparent); `scale` shrinks the mark about the centre so foreground/splash
// variants keep clear of the adaptive-icon safe zone.
function svgDocument({ color, background = null, scale = 1 }) {
  const bg = background ? `<rect width="${SIZE}" height="${SIZE}" fill="${background}"/>` : "";
  const open = `<g transform="translate(${SIZE / 2} ${SIZE / 2}) scale(${scale}) translate(${-SIZE / 2} ${-SIZE / 2})">`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${bg}${open}${markPaths(color)}</g></svg>`;
}

// Full app icon: teal mark on the dark shell, full-bleed (stores round the
// corners). This is the committed source SVG.
const ICON_SVG = svgDocument({ color: ACCENT, background: SHELL });
// Transparent teal mark, shrunk into the adaptive safe zone — foreground + splash.
const MARK_SVG = svgDocument({ color: ACCENT, scale: 0.72 });
// Same silhouette in white for Android's themed (monochrome) icon slot.
const MONO_SVG = svgDocument({ color: "#FFFFFF", scale: 0.72 });

async function rasterize(svg, file, size = SIZE) {
  await sharp(Buffer.from(svg))
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(resolve(IMAGE_DIR, file));
}

async function main() {
  await mkdir(BRAND_DIR, { recursive: true });
  await mkdir(IMAGE_DIR, { recursive: true });

  // Canonical, committed source SVGs.
  await writeFile(resolve(BRAND_DIR, "wharf-icon.svg"), ICON_SVG);
  await writeFile(resolve(BRAND_DIR, "wharf-mark.svg"), MARK_SVG);

  // Rasterised launcher assets wired into app.config.ts.
  await rasterize(ICON_SVG, "icon.png"); // ios + android legacy + store
  await rasterize(MARK_SVG, "android-icon-foreground.png"); // adaptive foreground
  await rasterize(MONO_SVG, "android-icon-monochrome.png"); // adaptive monochrome
  await rasterize(MARK_SVG, "splash-icon.png"); // splash screen
  await rasterize(ICON_SVG, "favicon.png", 48); // web favicon

  process.stdout.write("Generated app icons + splash from the Wharf brand mark.\n");
}

main().catch((error) => {
  process.stderr.write(`${error}\n`);
  process.exit(1);
});
