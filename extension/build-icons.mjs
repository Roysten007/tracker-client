// Génère les 3 icônes SM (16, 48, 128) sans dépendance npm.
// PNG minimal : IHDR + IDAT (compressé zlib) + IEND. Chaque taille = fond navy #0A0A78
// avec "SM" en blanc au centre (glyphes bitmap dessinés à la main pour rester zéro-dépendance).

import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "icons");
mkdirSync(outDir, { recursive: true });

// Palette : navy + blanc.
const BG = [0x0a, 0x0a, 0x78, 0xff]; // #0A0A78
const FG = [0xff, 0xff, 0xff, 0xff]; // #FFFFFF

// Glyphes 5x7 pour "S" et "M" (bitmap 1 = pixel plein).
const GLYPH_S = [
  [0, 1, 1, 1, 0],
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [0, 1, 1, 0, 0],
  [0, 0, 0, 1, 0],
  [0, 0, 0, 1, 0],
  [0, 1, 1, 0, 0],
];
const GLYPH_M = [
  [1, 0, 0, 0, 1],
  [1, 1, 0, 1, 1],
  [1, 0, 1, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
];

function tailleIcone(taille) {
  // Pixel data : ligne par ligne, filter byte 0 + pixels RGBA.
  const buf = Buffer.alloc(taille * (1 + taille * 4));
  for (let y = 0; y < taille; y++) {
    const off = y * (1 + taille * 4);
    buf[off] = 0; // filter None
    for (let x = 0; x < taille; x++) {
      const p = off + 1 + x * 4;
      buf[p] = BG[0];
      buf[p + 1] = BG[1];
      buf[p + 2] = BG[2];
      buf[p + 3] = BG[3];
    }
  }

  // Dessine "SM" au centre. Le facteur d'échelle scale les glyphes 5x7 à ~60% de la taille.
  const scale = Math.max(1, Math.floor(taille / 14));
  const largeurGlyph = 5 * scale;
  const hauteurGlyph = 7 * scale;
  const espace = scale;
  const largeurTotale = largeurGlyph * 2 + espace;
  const startX = Math.floor((taille - largeurTotale) / 2);
  const startY = Math.floor((taille - hauteurGlyph) / 2);

  const dessiner = (glyph, offsetX) => {
    for (let gy = 0; gy < 7; gy++) {
      for (let gx = 0; gx < 5; gx++) {
        if (!glyph[gy][gx]) continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const px = startX + offsetX + gx * scale + sx;
            const py = startY + gy * scale + sy;
            if (px < 0 || py < 0 || px >= taille || py >= taille) continue;
            const off = py * (1 + taille * 4) + 1 + px * 4;
            buf[off] = FG[0];
            buf[off + 1] = FG[1];
            buf[off + 2] = FG[2];
            buf[off + 3] = FG[3];
          }
        }
      }
    }
  };
  dessiner(GLYPH_S, 0);
  dessiner(GLYPH_M, largeurGlyph + espace);
  return buf;
}

// ---- Encodage PNG minimal ---------------------------------------------------

// CRC32 (spec PNG).
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encoderPNG(taille, pixelData) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(taille, 0);
  ihdr.writeUInt32BE(taille, 4);
  ihdr[8] = 8; // profondeur 8 bits/canal
  ihdr[9] = 6; // couleur RGBA
  // compression, filter, interlace : 0
  const idat = deflateSync(pixelData);
  const iend = Buffer.alloc(0);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", iend)]);
}

// ---- Écriture -------------------------------------------------------------

for (const taille of [16, 48, 128]) {
  const pixels = tailleIcone(taille);
  const png = encoderPNG(taille, pixels);
  const chemin = join(outDir, `sm-${taille}.png`);
  writeFileSync(chemin, png);
  // eslint-disable-next-line no-console
  console.log(`OK : icons/sm-${taille}.png (${png.length} octets)`);
}
