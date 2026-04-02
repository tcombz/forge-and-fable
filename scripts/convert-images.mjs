/**
 * Convert all card + alt-art images to WebP.
 * Run once: node scripts/convert-images.mjs
 *
 * Targets:
 *   public/cards/*.{jpg,jpeg,png}  → public/cards/*.webp   (max 800×800, quality 82)
 *   public/alt-art/*.{jpg,jpeg,png} → public/alt-art/*.webp (max 800×800, quality 80)
 *
 * Original files are KEPT so nothing breaks if a browser doesn't support WebP.
 */

import sharp from "sharp";
import { readdir, stat } from "fs/promises";
import { join, extname, basename } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const DIRS = [
  { dir: join(root, "public/cards"),   maxDim: 800, quality: 82 },
  { dir: join(root, "public/alt-art"), maxDim: 800, quality: 80 },
];

async function convertDir({ dir, maxDim, quality }) {
  let files;
  try { files = await readdir(dir); } catch { console.log(`Skipping ${dir} (not found)`); return; }

  const images = files.filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  let saved = 0, total = 0;

  for (const file of images) {
    const inPath  = join(dir, file);
    const outPath = join(dir, basename(file, extname(file)) + ".webp");

    // Skip if already done and output is newer
    try {
      const [inStat, outStat] = await Promise.all([stat(inPath), stat(outPath)]);
      if (outStat.mtimeMs >= inStat.mtimeMs) { console.log(`  ✓ skip  ${file}`); continue; }
    } catch { /* outPath doesn't exist yet — proceed */ }

    try {
      const inSize = (await stat(inPath)).size;
      await sharp(inPath)
        .resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true })
        .webp({ quality, effort: 5 })
        .toFile(outPath);
      const outSize = (await stat(outPath)).size;
      const pct = Math.round((1 - outSize / inSize) * 100);
      console.log(`  → ${file.padEnd(40)} ${(inSize/1024).toFixed(0).padStart(6)} KB  →  ${(outSize/1024).toFixed(0).padStart(5)} KB  (-${pct}%)`);
      saved += inSize - outSize;
      total += inSize;
    } catch (e) {
      console.error(`  ✗ FAILED ${file}:`, e.message);
    }
  }

  console.log(`\n  ${dir.split(/[\\/]/).slice(-2).join("/")}:  saved ${(saved / 1024 / 1024).toFixed(1)} MB of ${(total / 1024 / 1024).toFixed(1)} MB total\n`);
}

console.log("Converting images to WebP…\n");
for (const entry of DIRS) {
  console.log(`\n── ${entry.dir} ──`);
  await convertDir(entry);
}
console.log("Done.");
