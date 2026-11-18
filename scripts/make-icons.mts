// Makes the app icons (home screen, install, Apple) from the logo artwork.
// Run with: npx tsx scripts/make-icons.mts
import sharp from "sharp";

const mark = (bleed: boolean) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${bleed ? 0 : 8}" fill="#1c3a32"/>
  <g transform="${bleed ? "translate(4.8 4.8) scale(0.7)" : ""}">
    <rect x="14.6" y="4.5" width="2.8" height="23.5" rx="0.7" fill="#cfdad5"/>
    <path d="M14.6 8 H22.5 L26.5 11.5 L22.5 15 H14.6 Z" fill="#f4c430"/>
    <path d="M17.4 17.5 H9.5 L5.5 21 L9.5 24.5 H17.4 Z" fill="#f4c430"/>
  </g>
</svg>`;

const out: [string, number, boolean][] = [
  ["public/icons/icon-192.png", 192, false],
  ["public/icons/icon-512.png", 512, false],
  // Maskable: full-bleed tile, signpost kept inside the safe zone
  ["public/icons/maskable-512.png", 512, true],
  // Apple adds its own rounded corners
  ["src/app/apple-icon.png", 180, true],
];
for (const [file, size, bleed] of out) {
  await sharp(Buffer.from(mark(bleed)), { density: (size / 32) * 72 }).resize(size, size).png().toFile(file);
  console.log("wrote", file);
}
