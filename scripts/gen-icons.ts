/* Generates the PWA icon set from the Amperity symbol: lime circle for regular
   icons, full-bleed lime for maskable and apple touch. Run: tsx scripts/gen-icons.ts */

import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const LIME = "#DFF941";
const INK = "#0C0C0C";
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "public", "icons");

/* The Amperity ampersand, inlined from brand/amperity-symbol.svg (viewBox 0 0 60.2 75.6).
   The small dot renders in the ground lime so it reads as a cutout, as in the brand icon. */
const AMP_DOT =
  "M51.9,32.1c-3.2,0-5.9,2.6-5.9,5.9c0,3.3,2.6,5.9,5.9,5.9c3.2,0,5.9-2.6,5.9-5.9 C57.8,34.7,55.1,32.1,51.9,32.1z";
const AMP_BODY =
  "M42.4,45.7L32.6,51c0.1,0.4,0.1,0.9,0.1,1.4c0,5.2-4.2,9.5-9.5,9.4c-5.2,0-9.5-4.2-9.4-9.5 c0-5.2,4.2-9.5,9.5-9.4c2.8,0,5.2,1.2,6.9,3.1l9.1-4.9L27.2,22.8c-0.1,0-0.2,0-0.3,0c-2.8,0-5.1-2.3-5.1-5.1s2.3-5.1,5.1-5.1 c2.8,0,5.1,2.3,5.1,5.1c0,1-0.3,1.8-0.7,2.6L38.4,31c3.8-3.2,6.2-8,6.2-13.3C44.6,8,36.7,0,27,0C17.3,0,9.4,7.9,9.4,17.6 c0,5.1,2.2,9.8,5.7,13C6.3,33.9,0,42.4,0,52.3c0,12.8,10.4,23.3,23.2,23.3c7.1,0,13.5-3.2,17.8-8.2l3.4,5.2h15.7L42.4,45.7z";

function iconSvg(size: number, opts: { circle: boolean; scale: number }): string {
  const h = size * opts.scale;
  const w = h * (60.2 / 75.6);
  const x = (size - w) / 2;
  const y = (size - h) / 2;
  const s = h / 75.6;
  const shape = opts.circle
    ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${LIME}"/>`
    : `<rect width="${size}" height="${size}" fill="${LIME}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${shape}<g transform="translate(${x},${y}) scale(${s})"><path fill="${INK}" d="${AMP_BODY}"/><path fill="${LIME}" d="${AMP_DOT}"/></g></svg>`;
}

async function render(name: string, size: number, circle: boolean, scale: number) {
  const svg = iconSvg(size, { circle, scale });
  await sharp(Buffer.from(svg), { density: 300 })
    .resize(size, size)
    .png()
    .toFile(path.join(OUT, name));
  console.log(`wrote icons/${name}`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  await render("icon-192.png", 192, true, 0.52);
  await render("icon-512.png", 512, true, 0.52);
  await render("maskable-192.png", 192, false, 0.44);
  await render("maskable-512.png", 512, false, 0.44);
  await render("apple-touch-icon.png", 180, false, 0.5);
  /* Favicon: Next.js serves app/icon.png automatically. */
  const fav = iconSvg(64, { circle: true, scale: 0.52 });
  await sharp(Buffer.from(fav), { density: 300 })
    .resize(64, 64)
    .png()
    .toFile(path.join(ROOT, "app", "icon.png"));
  console.log("wrote app/icon.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
