// news-image-20261126 — "The World in One Day", Thursday 26 November 2026.
// A from-scratch broadsheet front page drawn with pure Node 22 stdlib:
// own canvas primitives, own 5x7 bitmap font, own PNG encoder (CRC32 +
// zlib deflate). No network, no dependencies, no dates or randomness at
// run time: two runs write byte-identical 1024x1024 PNGs.
//
// Stories (all reported 26 Nov 2026, sources Reuters/BBC/AP/AFP):
//  LEAD  Macy's 100th Thanksgiving parade postponed — first time ever,
//        storm moves it to Saturday 28 Nov (New York, USA).
//  1 Houthis claim attack on Saudi Ras Tanura refinery; Brent tops $94.
//  2 US proposes new Section 301 tariffs on 14 partners; Taiwan up to 15%.
//  3 Ukraine says it struck a Russian air base, damaging five jets.
//  4 Israeli strike in Gaza kills a senior Hamas official and his family.
//  5 North Korea's Kim orders wider deployment of tactical nuclear arms.
//  6 India marks 18 years since the 26/11 Mumbai attacks.
//  ALSO  Chess: Gukesh–Sindarov Game 3, 1-1, Geneva. Colombia frees 20
//        supermarket hostages. Kenya discharges its last Ebola patient.
//        Norway voids disputed oil licences. Bangladesh garment pay +36%.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
const PAPER = [247, 242, 231];
const INK = [20, 20, 20];
const NAVY = [14, 30, 51];
const NAVY2 = [24, 48, 80];
const RED = [178, 34, 34];
const GOLD = [214, 148, 32];
const AMBER = [232, 163, 61];
const TEAL = [31, 122, 109];
const SKY = [52, 84, 128];
const SKY2 = [88, 124, 164];
const CLOUD = [58, 68, 84];
const RAIN = [170, 196, 222];
const CARD_BG = [255, 255, 255];
const MUTED = [96, 96, 96];
const LINE = [200, 192, 176];
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

// ---------------------------------------------------------------- canvas
const buf = Buffer.alloc(W * H * 3);

function px(x: number, y: number, c: number[]): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: number[]): void {
  const x0 = Math.max(0, x), y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 3;
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
    }
  }
}

function hLine(x: number, y: number, w: number, c: number[]): void {
  fillRect(x, y, w, 1, c);
}

function vLine(x: number, y: number, h: number, c: number[]): void {
  fillRect(x, y, 1, h, c);
}

function line(x0: number, y0: number, x1: number, y1: number, c: number[]): void {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0, y = y0;
  for (;;) {
    px(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

function fillCircle(cx: number, cy: number, r: number, c: number[]): void {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    fillRect(cx - half, cy + y, half * 2 + 1, 1, c);
  }
}

function ring(cx: number, cy: number, r: number, c: number[]): void {
  for (let a = 0; a < 360; a += 2) {
    const t = (a * Math.PI) / 180;
    px(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), c);
  }
}

function fillEllipse(cx: number, cy: number, rx: number, ry: number, c: number[]): void {
  for (let y = -ry; y <= ry; y++) {
    const t = 1 - (y * y) / (ry * ry);
    if (t < 0) continue;
    const half = Math.floor(rx * Math.sqrt(t));
    fillRect(cx - half, cy + y, half * 2 + 1, 1, c);
  }
}

// Scanline polygon fill (points as [x, y] pairs, integer coords).
function fillPoly(pts: number[][], c: number[]): void {
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  for (let y = Math.max(0, minY); y <= Math.min(H - 1, maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        const t = (y - a[1]) / (b[1] - a[1]);
        xs.push(Math.round(a[0] + t * (b[0] - a[0])));
      }
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      fillRect(xs[k], y, xs[k + 1] - xs[k] + 1, 1, c);
    }
  }
}

function vGrad(x: number, y: number, w: number, h: number, top: number[], bot: number[]): void {
  for (let yy = 0; yy < h; yy++) {
    const t = h <= 1 ? 0 : yy / (h - 1);
    const c = [
      Math.round(top[0] + (bot[0] - top[0]) * t),
      Math.round(top[1] + (bot[1] - top[1]) * t),
      Math.round(top[2] + (bot[2] - top[2]) * t),
    ];
    fillRect(x, y + yy, w, 1, c);
  }
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph: 7 rows of 5 cells, '#' = ink.
const FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#..##', '#.#.#', '##..#', '#...#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '...#.', '..#..', '..#..', '..#..'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
  b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
  c: ['.....', '.....', '.####', '#....', '#....', '#....', '.####'],
  d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
  f: ['..##.', '.#...', '.#...', '####.', '.#...', '.#...', '.#...'],
  g: ['.....', '.###.', '#...#', '#...#', '.####', '....#', '.###.'],
  h: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'],
  i: ['.....', '..#..', '.....', '.##..', '..#..', '..#..', '.###.'],
  j: ['..#..', '.....', '.##..', '..#..', '..#..', '..#..', '.##..'],
  k: ['#....', '#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.'],
  l: ['.##..', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  n: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  p: ['.....', '####.', '#...#', '#...#', '####.', '#....', '#....'],
  q: ['.....', '.####', '#...#', '#...#', '.####', '....#', '....#'],
  r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'],
  s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'],
  t: ['.#...', '.#...', '####.', '.#...', '.#...', '.#...', '..##.'],
  u: ['.....', '.....', '#...#', '#...#', '#...#', '#...#', '.###.'],
  v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  w: ['.....', '.....', '#...#', '#.#.#', '#.#.#', '##.##', '.#.#.'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  y: ['.....', '#...#', '#...#', '.#.#.', '..#..', '..#..', '.#...'],
  z: ['.....', '.....', '#####', '...#.', '..#..', '.#...', '#####'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.....', '.##..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.#...'],
  "'": ['..#..', '..#..', '.....', '.....', '.....', '.....', '.....'],
  '"': ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
  '—': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '(': ['...##', '..#..', '.#...', '.#...', '.#...', '..#..', '...##'],
  ')': ['##...', '..#..', '...#.', '...#.', '...#.', '..#..', '##...'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '#.##.', '#..##'],
  '$': ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '•': ['.....', '.....', '.###.', '.###.', '.###.', '.....', '.....'],
};

function glyph(ch: string): string[] {
  return FONT[ch] ?? FONT['?'];
}

function textWidth(s: string, scale: number): number {
  return s.length * (5 * scale + scale) - scale;
}

function drawText(s: string, x: number, y: number, scale: number, c: number[], align: 'left' | 'center' | 'right' = 'left'): void {
  let ox = x;
  if (align === 'center') ox = x - Math.floor(textWidth(s, scale) / 2);
  if (align === 'right') ox = x - textWidth(s, scale);
  for (let i = 0; i < s.length; i++) {
    const g = glyph(s[i]);
    const gx = ox + i * (6 * scale);
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === '#') fillRect(gx + col * scale, y + r * scale, scale, scale, c);
      }
    }
  }
}

// Greedy word wrap to a pixel width; returns lines.
function wrap(s: string, maxW: number, scale: number): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? cur + ' ' + w : w;
    if (textWidth(trial, scale) <= maxW || !cur) cur = trial;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawLines(lines: string[], x: number, y: number, scale: number, c: number[], lh: number): void {
  lines.forEach((ln, i) => drawText(ln, x, y + i * lh, scale, c));
}

// ---------------------------------------------------------------- PNG encode
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();

function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter none
    buf.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- pictograms
// Each draws inside a 76x76 box at (x, y).

function picOil(x: number, y: number): void {
  fillRect(x, y, 76, 76, [250, 244, 230]);
  // derrick frame
  line(x + 20, y + 66, x + 34, y + 14, INK);
  line(x + 52, y + 66, x + 38, y + 14, INK);
  line(x + 24, y + 52, x + 48, y + 52, INK);
  line(x + 28, y + 38, x + 44, y + 38, INK);
  line(x + 32, y + 24, x + 40, y + 24, INK);
  // flame
  fillPoly([[x + 60, y + 22], [x + 68, y + 34], [x + 64, y + 44], [x + 56, y + 44], [x + 52, y + 34]], [232, 120, 30]);
  fillPoly([[x + 60, y + 30], [x + 64, y + 38], [x + 60, y + 43], [x + 56, y + 38]], GOLD);
  // barrel
  fillRect(x + 8, y + 56, 14, 12, NAVY2);
  fillEllipse(x + 15, y + 56, 7, 3, SKY2);
}

function picTariff(x: number, y: number): void {
  fillRect(x, y, 76, 76, [250, 244, 230]);
  // rising bars
  fillRect(x + 12, y + 48, 12, 20, TEAL);
  fillRect(x + 28, y + 38, 12, 30, NAVY2);
  fillRect(x + 44, y + 26, 12, 42, RED);
  line(x + 10, y + 24, x + 62, y + 8, RED);
  line(x + 62, y + 8, x + 54, y + 10, RED);
  line(x + 62, y + 8, x + 60, y + 16, RED);
  drawText('%', x + 8, y + 2, 2, GOLD);
}

function picJet(x: number, y: number): void {
  fillRect(x, y, 76, 76, [250, 244, 230]);
  // jet silhouette (nose right)
  fillPoly([[x + 10, y + 44], [x + 58, y + 34], [x + 66, y + 38], [x + 58, y + 42], [x + 30, y + 48], [x + 22, y + 54], [x + 16, y + 48]], NAVY);
  fillPoly([[x + 34, y + 38], [x + 30, y + 26], [x + 38, y + 38]], NAVY);
  // motion lines
  line(x + 4, y + 40, x + 14, y + 40, MUTED);
  line(x + 2, y + 46, x + 12, y + 46, MUTED);
  // blast star
  fillPoly([[x + 62, y + 12], [x + 66, y + 20], [x + 72, y + 16], [x + 68, y + 24], [x + 74, y + 28], [x + 66, y + 30], [x + 64, y + 38], [x + 60, y + 30], [x + 52, y + 30], [x + 58, y + 24], [x + 52, y + 18], [x + 60, y + 20]], GOLD);
}

function picGaza(x: number, y: number): void {
  fillRect(x, y, 76, 76, [250, 244, 230]);
  // damaged building
  fillPoly([[x + 14, y + 68], [x + 14, y + 30], [x + 26, y + 22], [x + 30, y + 30], [x + 40, y + 24], [x + 48, y + 32], [x + 48, y + 68]], NAVY2);
  fillRect(x + 20, y + 40, 6, 6, GOLD);
  fillRect(x + 34, y + 48, 6, 6, GOLD);
  fillRect(x + 20, y + 56, 6, 6, PAPER);
  // smoke
  fillCircle(x + 56, y + 16, 7, CLOUD);
  fillCircle(x + 62, y + 10, 5, CLOUD);
  fillCircle(x + 50, y + 10, 5, CLOUD);
}

function picAtom(x: number, y: number): void {
  fillRect(x, y, 76, 76, [250, 244, 230]);
  ring(x + 38, y + 38, 24, RED);
  ring(x + 38, y + 38, 16, NAVY2);
  fillCircle(x + 38, y + 38, 6, RED);
  fillCircle(x + 38, y + 14, 5, GOLD);
  fillCircle(x + 59, y + 50, 5, GOLD);
  fillCircle(x + 17, y + 50, 5, GOLD);
}

function picCandle(x: number, y: number): void {
  fillRect(x, y, 76, 76, [250, 244, 230]);
  // glow
  fillCircle(x + 38, y + 22, 14, [252, 226, 160]);
  // flame
  fillPoly([[x + 38, y + 8], [x + 44, y + 20], [x + 38, y + 26], [x + 32, y + 20]], [232, 120, 30]);
  fillPoly([[x + 38, y + 16], [x + 41, y + 22], [x + 38, y + 25], [x + 35, y + 22]], GOLD);
  // candle
  fillRect(x + 30, y + 28, 16, 36, WHITE);
  fillRect(x + 30, y + 28, 16, 4, NAVY2);
  fillRect(x + 22, y + 64, 32, 5, NAVY2);
}

// ---------------------------------------------------------------- page
function masthead(): void {
  fillRect(0, 0, W, 104, NAVY);
  fillRect(0, 104, W, 4, GOLD);
  drawText('THE WORLD IN ONE DAY', W / 2, 16, 6, WHITE, 'center');
  drawText('THURSDAY  •  26 NOVEMBER 2026  •  12 STORIES, 7 REGIONS', W / 2, 66, 3, AMBER, 'center');
}

function hero(): void {
  const y0 = 108, y1 = 448;
  fillRect(0, y0, W, y1 - y0, PAPER);
  // --- illustration: storm over the New York skyline, grounded balloon
  const ix = 0, iw = 560;
  vGrad(ix, y0, iw, y1 - y0, SKY, SKY2);
  // storm clouds
  fillEllipse(120, y0 + 34, 110, 30, CLOUD);
  fillEllipse(300, y0 + 22, 130, 34, CLOUD);
  fillEllipse(470, y0 + 40, 100, 28, CLOUD);
  fillEllipse(210, y0 + 52, 90, 24, [70, 80, 96]);
  // rain (deterministic diagonal streaks)
  for (let i = 0; i < 42; i++) {
    const rx = 12 + ((i * 53) % 520);
    const ry = y0 + 60 + ((i * 37) % 200);
    line(rx, ry, rx - 7, ry + 16, RAIN);
  }
  // skyline
  const towers: [number, number, number][] = [
    [0, 150, 190], [62, 120, 220], [128, 170, 170], [196, 110, 230],
    [258, 150, 190], [322, 130, 210], [386, 160, 180], [452, 108, 220],
    [512, 48, 250],
  ];
  for (const [tx, tw, th] of towers) {
    fillRect(ix + tx, y1 - th, tw, th, NAVY);
    for (let wy = y1 - th + 14; wy < y1 - 12; wy += 18) {
      for (let wx = ix + tx + 10; wx < ix + tx + tw - 8; wx += 16) {
        if (((wx * 7 + wy * 3) % 5) < 2) fillRect(wx, wy, 5, 7, AMBER);
      }
    }
  }
  // grounded balloon, tilted, ropes slack
  fillEllipse(150, y0 + 250, 96, 62, RED);
  fillEllipse(150, y0 + 250, 60, 62, WHITE);
  fillEllipse(150, y0 + 250, 24, 62, RED);
  fillRect(118, y0 + 318, 64, 6, NAVY);
  line(128, y0 + 312, 128, y0 + 318, NAVY);
  line(172, y0 + 312, 172, y0 + 318, NAVY);
  // "100" badge
  fillCircle(470, y0 + 88, 40, GOLD);
  ring(470, y0 + 88, 40, WHITE);
  drawText('100', 470, y0 + 72, 4, NAVY, 'center');
  drawText('YEARS', 470, y0 + 104, 2, NAVY, 'center');
  // --- headline block, right of the illustration
  const tx = 592;
  drawText('THANKSGIVING  •  NEW YORK', tx, y0 + 26, 2, RED);
  const head = wrap("100TH MACY'S PARADE POSTPONED", 400, 4);
  drawLines(head, tx, y0 + 62, 4, INK, 44);
  drawText('FIRST TIME EVER', tx, y0 + 62 + head.length * 44 + 8, 3, RED);
  const deck = wrap('A Thanksgiving storm grounds the balloons. The parade moves to Saturday, Nov 28.', 400, 2);
  drawLines(deck, tx, y0 + 62 + head.length * 44 + 52, 2, MUTED, 20);
  fillRect(tx, y0 + 296, 400, 2, LINE);
  drawText('GUSTS 60 MPH  •  N.J. EMERGENCY', tx, y0 + 312, 2, NAVY);
}

interface Card {
  kicker: string;
  color: number[];
  head: string;
  sub: string;
  pic: (x: number, y: number) => void;
}

const CARDS: Card[] = [
  { kicker: 'OIL  •  MIDDLE EAST', color: RED, head: 'HOUTHIS HIT SAUDI REFINERY', sub: 'Ras Tanura hit; Brent tops $94.', pic: picOil },
  { kicker: 'TRADE  •  WASHINGTON', color: NAVY2, head: "TRUMP'S NEW TARIFFS", sub: '14 partners face levies; Taiwan up to 15%.', pic: picTariff },
  { kicker: 'WAR  •  UKRAINE', color: TEAL, head: 'UKRAINE HITS RUSSIAN AIR BASE', sub: 'Five jets damaged in strike, Kyiv says.', pic: picJet },
  { kicker: 'GAZA  •  MIDDLE EAST', color: RED, head: 'ISRAELI STRIKE KILLS HAMAS CHIEF', sub: 'Senior official and family dead in Gaza.', pic: picGaza },
  { kicker: 'ASIA  •  SECURITY', color: NAVY2, head: 'KIM ORDERS MORE NUCLEAR ARMS', sub: 'N. Korea to widen tactical deployments.', pic: picAtom },
  { kicker: 'INDIA  •  REMEMBRANCE', color: TEAL, head: 'INDIA MARKS 18 YEARS SINCE 26/11', sub: 'Mumbai remembers the 2008 attacks.', pic: picCandle },
];

function grid(): void {
  const gx = 8, gy = 456;
  const cw = 328, ch = 220, gap = 8;
  CARDS.forEach((card, i) => {
    const cx = gx + (i % 3) * (cw + gap);
    const cy = gy + Math.floor(i / 3) * (ch + gap);
    fillRect(cx, cy, cw, ch, CARD_BG);
    fillRect(cx, cy, cw, 8, card.color);
    drawText(card.kicker, cx + 14, cy + 20, 2, card.color);
    const head = wrap(card.head, cw - 20, 3);
    drawLines(head, cx + 14, cy + 48, 3, INK, 26);
    card.pic(cx + 14, cy + 128);
    const sub = wrap(card.sub, cw - 118, 2);
    drawLines(sub, cx + 102, cy + 132, 2, MUTED, 20);
  });
}

function ticker(): void {
  const y0 = 908;
  fillRect(0, y0, W, 64, NAVY);
  drawText('ALSO TODAY', 16, y0 + 10, 2, GOLD);
  drawText('Chess: Gukesh-Sindarov Game 3, 1-1 in Geneva  -  Colombia frees 20 hostages', 16, y0 + 30, 2, WHITE);
  drawText('Kenya Ebola patient out  -  Norway voids oil licences  -  Bangladesh pay +36%', 16, y0 + 50, 2, WHITE);
}

function footer(): void {
  drawText('DRAWN BY PROGRAM  •  SOURCES: REUTERS, BBC, AP, AFP  •  THURSDAY 26 NOVEMBER 2026', W / 2, 988, 2, MUTED, 'center');
}

function draw(): void {
  fillRect(0, 0, W, H, PAPER);
  masthead();
  hero();
  grid();
  ticker();
  footer();
}

function main(): void {
  draw();
  const png = encodePNG();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'entry.png'), png);
  console.log(`wrote ${png.length} bytes`);
}

main();
