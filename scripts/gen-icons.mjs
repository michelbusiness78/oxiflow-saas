// Génère les icônes PWA OxiFlow en PNG (192, 384, 512, maskable 512)
// Usage : node scripts/gen-icons.mjs

import sharp from 'sharp';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'public', 'icons');

// ── SVG source — "OF" géométrique sur fond bleu #1a56db ──────────────────────
// Utilise des paths SVG purs (pas de <text>) pour rendu pixel-perfect à toutes tailles.
// Viewbox 512×512. Les lettres O et F sont dessinées manuellement.

const SVG_SIZE = 512;
const BG_COLOR = '#1a56db';
const FG_COLOR = '#ffffff';
const RADIUS   = 96;   // coins arrondis du fond

// "O" : anneau centré à (164, 256), rayon ext 96, rayon int 58
const OX = 152, OY = 256, OR = 98, OI = 58;

// "F" : lettre tracée à la main (x=274..370, y=156..356)
const FX = 274;  // x gauche du F
const FW = 92;   // largeur totale
const FH = 200;  // hauteur totale
const FY = OY - FH / 2;  // y haut = 156

const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_SIZE} ${SVG_SIZE}">
  <!-- Fond bleu coins arrondis -->
  <rect width="${SVG_SIZE}" height="${SVG_SIZE}" rx="${RADIUS}" fill="${BG_COLOR}"/>

  <!-- O : anneau -->
  <circle cx="${OX}" cy="${OY}" r="${OR}" fill="${FG_COLOR}"/>
  <circle cx="${OX}" cy="${OY}" r="${OI}" fill="${BG_COLOR}"/>

  <!-- F : rectangle vertical gauche (montant) -->
  <rect x="${FX}" y="${FY}" width="34" height="${FH}" rx="4" fill="${FG_COLOR}"/>
  <!-- F : barre haute -->
  <rect x="${FX + 34}" y="${FY}" width="${FW - 34}" height="34" rx="4" fill="${FG_COLOR}"/>
  <!-- F : barre milieu -->
  <rect x="${FX + 34}" y="${FY + FH / 2 - 17}" width="${(FW - 34) * 0.7}" height="30" rx="4" fill="${FG_COLOR}"/>
</svg>`;

// ── Version maskable : même icône centrée dans une zone safe (80% du carré) ──
// Le fond remplit 100% pour satisfaire les launchers Android maskable.
const svgMaskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_SIZE} ${SVG_SIZE}">
  <!-- Fond plein (pas de coins arrondis — maskable = fond total) -->
  <rect width="${SVG_SIZE}" height="${SVG_SIZE}" fill="${BG_COLOR}"/>

  <!-- Icône centrée à 80% (padding 10% de chaque côté = 51px sur 512) -->
  <g transform="translate(51,51) scale(0.8)">
    <rect width="${SVG_SIZE}" height="${SVG_SIZE}" rx="${RADIUS}" fill="${BG_COLOR}"/>
    <circle cx="${OX}" cy="${OY}" r="${OR}" fill="${FG_COLOR}"/>
    <circle cx="${OX}" cy="${OY}" r="${OI}" fill="${BG_COLOR}"/>
    <rect x="${FX}" y="${FY}" width="34" height="${FH}" rx="4" fill="${FG_COLOR}"/>
    <rect x="${FX + 34}" y="${FY}" width="${FW - 34}" height="34" rx="4" fill="${FG_COLOR}"/>
    <rect x="${FX + 34}" y="${FY + FH / 2 - 17}" width="${(FW - 34) * 0.7}" height="30" rx="4" fill="${FG_COLOR}"/>
  </g>
</svg>`;

// ── Génération ────────────────────────────────────────────────────────────────

const svgBuf     = Buffer.from(svgIcon);
const svgMaskBuf = Buffer.from(svgMaskable);

const sizes = [192, 384, 512];

async function main() {
  for (const size of sizes) {
    const file = path.join(OUT, `icon-${size}.png`);
    await sharp(svgBuf)
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(file);
    console.log(`✅ ${file}`);
  }

  // Maskable 512
  const maskFile = path.join(OUT, 'icon-512-maskable.png');
  await sharp(svgMaskBuf)
    .resize(512, 512)
    .png({ compressionLevel: 9 })
    .toFile(maskFile);
  console.log(`✅ ${maskFile}`);

  // Aussi mettre à jour le favicon.svg dans /public
  const faviconPath = path.join(__dirname, '..', 'public', 'favicon.svg');
  writeFileSync(faviconPath, svgIcon, 'utf8');
  console.log(`✅ favicon.svg mis à jour`);

  console.log('\nTous les icônes générés dans public/icons/');
}

main().catch((e) => { console.error(e); process.exit(1); });
