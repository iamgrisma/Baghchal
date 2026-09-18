import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(width, height, drawFn) {
  // RGBA buffer: each scanline has 1 filter byte (0) + width * 4 bytes
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const color = drawFn(x, y, width, height);
      rawData[pixelOffset] = color[0];     // R
      rawData[pixelOffset + 1] = color[1]; // G
      rawData[pixelOffset + 2] = color[2]; // B
      rawData[pixelOffset + 3] = color[3]; // A
    }
  }

  const compressedData = zlib.deflateSync(rawData);

  // PNG Header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT chunk
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(12 + length);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  // CRC32 calculation
  const crc = crc32(chunk.subarray(4, 8 + length));
  chunk.writeInt32BE(crc, 8 + length);
  return chunk;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    crc = crc ^ byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
    }
  }
  return (crc ^ 0xffffffff) | 0;
}

function renderBaghchal(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const maxR = w * 0.46;

  // Background deep warm slate
  let r = 26, g = 20, b = 18, a = 255;

  // Border gold ring
  if (dist < maxR && dist >= maxR - 8) {
    r = 234; g = 179; b = 8;
  } else if (dist < maxR - 8 && dist >= maxR - 12) {
    r = 180; g = 83; b = 9;
  } else if (dist < maxR - 12) {
    // Inside board
    r = 28; g = 25; b = 23;

    // Diamond grid motif in background
    const normX = Math.abs(dx) / (w * 0.35);
    const normY = Math.abs(dy) / (h * 0.35);
    if (Math.abs(normX + normY - 1) < 0.04) {
      r = 115; g = 115; b = 115; a = 255;
    }

    // Tiger head silhouette in center
    const tHeadR = w * 0.22;
    const dyHead = y - (cy + h * 0.02);
    const headDist = Math.sqrt(dx * dx + dyHead * dyHead);

    // Ears
    const ear1 = Math.sqrt(Math.pow(x - (cx - w * 0.16), 2) + Math.pow(y - (cy - h * 0.16), 2));
    const ear2 = Math.sqrt(Math.pow(x - (cx + w * 0.16), 2) + Math.pow(y - (cy - h * 0.16), 2));
    if (ear1 < w * 0.09 || ear2 < w * 0.09) {
      r = 249; g = 115; b = 22; // vibrant amber orange
    }

    // Main head circle
    if (headDist < tHeadR) {
      r = 234; g = 88; b = 12; // deep warm tiger orange

      // Muzzle
      const dyMuzzle = y - (cy + h * 0.1);
      const muzzleDist = Math.sqrt(dx * dx * 1.3 + dyMuzzle * dyMuzzle);
      if (muzzleDist < w * 0.11) {
        r = 254; g = 243; b = 199; // warm cream
      }

      // Eyes
      const eyeL = Math.sqrt(Math.pow(x - (cx - w * 0.08), 2) + Math.pow(y - (cy - h * 0.02), 2));
      const eyeR = Math.sqrt(Math.pow(x - (cx + w * 0.08), 2) + Math.pow(y - (cy - h * 0.02), 2));
      if (eyeL < w * 0.035 || eyeR < w * 0.035) {
        r = 254; g = 240; b = 138; // golden yellow eyes
        if (eyeL < w * 0.015 || eyeR < w * 0.015) {
          r = 28; g = 25; b = 23; // black pupils
        }
      }

      // Nose
      const noseDist = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - (cy + h * 0.06), 2));
      if (noseDist < w * 0.025) {
        r = 120; g = 53; b = 15;
      }
    }
  }

  return [r, g, b, a];
}

const pubDir = path.resolve('public');
if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });

fs.writeFileSync(path.join(pubDir, 'pwa-192x192.png'), createPNG(192, 192, renderBaghchal));
fs.writeFileSync(path.join(pubDir, 'pwa-512x512.png'), createPNG(512, 512, renderBaghchal));
fs.writeFileSync(path.join(pubDir, 'pwa-maskable-512x512.png'), createPNG(512, 512, renderBaghchal));
fs.writeFileSync(path.join(pubDir, 'apple-touch-icon.png'), createPNG(180, 180, renderBaghchal));

console.log('Generated PWA icon PNGs successfully.');
