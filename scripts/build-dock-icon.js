#!/usr/bin/env node
/**
 * Builds dock icons (dark + light) with:
 * - macOS-style rounded corners (~22% radius)
 * - Zoomed content (1.25x) to reduce wasted space
 * - Same dimensions for both variants
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ICONS = [
  { input: 'code-auto-dark.png', output: 'code-auto-dock.png' },
  { input: 'code-auto-light.png', output: 'code-auto-dock-light.png' },
];

const ZOOM = 1.25; // Scale up center content by 25%
const CORNER_RADIUS_PCT = 0.22; // ~22% radius for macOS-style squircle

async function processIcon(inputFile, outputFile) {
  const inputPath = path.resolve(__dirname, '..', 'public', inputFile);
  const outputPath = path.resolve(__dirname, '..', 'public', outputFile);

  if (!fs.existsSync(inputPath)) {
    console.warn('Skipping (not found):', inputFile);
    return;
  }

  const meta = await sharp(inputPath).metadata();
  const size = meta.width || 1024;
  const radius = Math.round(size * CORNER_RADIUS_PCT);

  // 1. Zoom in: scale up, then extract center
  const zoomedSize = Math.round(size * ZOOM);
  const left = Math.floor((zoomedSize - size) / 2);
  const top = left;

  const zoomed = await sharp(inputPath)
    .resize(zoomedSize, zoomedSize)
    .extract({ left, top, width: size, height: size })
    .toBuffer();

  // 2. Apply rounded corner mask (macOS-style squircle)
  const maskSvg = `
    <svg width="${size}" height="${size}">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/>
    </svg>
  `;

  await sharp(zoomed)
    .composite([
      {
        input: Buffer.from(maskSvg),
        blend: 'dest-in',
      },
    ])
    .png()
    .toFile(outputPath);

  console.log('Built:', outputFile);
}

async function buildDockIcons() {
  for (const { input, output } of ICONS) {
    await processIcon(input, output);
  }
}

buildDockIcons().catch((err) => {
  console.error(err);
  process.exit(1);
});
