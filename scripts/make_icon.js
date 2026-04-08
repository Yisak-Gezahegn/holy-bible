/**
 * Generates assets/icon.png (256x256) — a Bible book icon.
 * Uses only Node built-ins (zlib + fs). No npm packages needed.
 */
const fs   = require('fs')
const path = require('path')
const zlib = require('zlib')

const SIZE = 256

// ── helpers ──────────────────────────────────────────────────────────────────
function u32be(n) {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n >>> 0, 0)
  return b
}
function crc32(buf) {
  const t = makeCrcTable()
  let c = 0xffffffff
  for (const b of buf) c = (t[(c ^ b) & 0xff] ^ (c >>> 8))
  return (c ^ 0xffffffff) >>> 0
}
let _crcTable
function makeCrcTable() {
  if (_crcTable) return _crcTable
  _crcTable = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    _crcTable[n] = c
  }
  return _crcTable
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data)
  const crcBuf = Buffer.concat([t, d])
  return Buffer.concat([u32be(d.length), t, d, u32be(crc32(crcBuf))])
}

// ── draw pixels ───────────────────────────────────────────────────────────────
// RGBA pixel buffer
const pixels = Buffer.alloc(SIZE * SIZE * 4, 0)

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return
  const i = (y * SIZE + x) * 4
  pixels[i]     = r
  pixels[i + 1] = g
  pixels[i + 2] = b
  pixels[i + 3] = a
}

function fillRect(x, y, w, h, r, g, b, a = 255) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      setPixel(x + dx, y + dy, r, g, b, a)
}

function drawCircle(cx, cy, radius, r, g, b, a = 255) {
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++)
      if (dx * dx + dy * dy <= radius * radius)
        setPixel(cx + dx, cy + dy, r, g, b, a)
}

function roundRect(x, y, w, h, rad, r, g, b, a = 255) {
  // fill body
  fillRect(x + rad, y,       w - rad * 2, h,           r, g, b, a)
  fillRect(x,       y + rad, w,           h - rad * 2, r, g, b, a)
  // corners
  drawCircle(x + rad,     y + rad,     rad, r, g, b, a)
  drawCircle(x + w - rad, y + rad,     rad, r, g, b, a)
  drawCircle(x + rad,     y + h - rad, rad, r, g, b, a)
  drawCircle(x + w - rad, y + h - rad, rad, r, g, b, a)
}

// ── background gradient (dark brown → lighter brown) ─────────────────────────
for (let y = 0; y < SIZE; y++) {
  const t = y / SIZE
  const r = Math.round(60  + t * 30)
  const g = Math.round(25  + t * 15)
  const b = Math.round(5   + t * 5)
  for (let x = 0; x < SIZE; x++) setPixel(x, y, r, g, b)
}

// ── book body ─────────────────────────────────────────────────────────────────
// main cover (dark brown)
roundRect(44, 28, 168, 200, 12, 90, 45, 10)

// spine (left edge, darker)
fillRect(44, 40, 18, 176, 55, 25, 5)

// cover highlight (right side lighter)
fillRect(180, 40, 20, 176, 110, 58, 18)

// pages (right side, cream/white stack)
for (let i = 0; i < 6; i++) {
  fillRect(208 + i, 38 + i, 6, 180 - i * 2, 240 - i * 8, 230 - i * 8, 210 - i * 8)
}

// ── gold cross on cover ───────────────────────────────────────────────────────
const cx = 128, cy = 118
// vertical bar
fillRect(cx - 7, cy - 52, 14, 80, 220, 170, 40)
// horizontal bar
fillRect(cx - 32, cy - 22, 64, 14, 220, 170, 40)
// cross shine
fillRect(cx - 4, cy - 50, 5, 76, 240, 200, 80)
fillRect(cx - 30, cy - 20, 60, 5,  240, 200, 80)

// ── gold title lines (decorative) ────────────────────────────────────────────
fillRect(72, 188, 112, 4, 200, 155, 35)
fillRect(80, 196, 96,  3, 200, 155, 35)

// ── bookmark ribbon ───────────────────────────────────────────────────────────
fillRect(148, 28, 12, 60, 180, 30, 30)
// ribbon tip (triangle-ish)
for (let i = 0; i < 8; i++) {
  fillRect(148 + i, 88, 12 - i, 1, 180, 30, 30)
}

// ── encode PNG ────────────────────────────────────────────────────────────────
const IHDR = Buffer.concat([
  u32be(SIZE), u32be(SIZE),
  Buffer.from([8, 2, 0, 0, 0])  // 8-bit, RGB+A=truecolor, no interlace
])
// actually use color type 6 (RGBA)
const ihdrData = Buffer.alloc(13)
ihdrData.writeUInt32BE(SIZE, 0)
ihdrData.writeUInt32BE(SIZE, 4)
ihdrData[8]  = 8   // bit depth
ihdrData[9]  = 6   // color type RGBA
ihdrData[10] = 0   // compression
ihdrData[11] = 0   // filter
ihdrData[12] = 0   // interlace

// build raw scanlines (filter byte 0 = None per row)
const raw = Buffer.alloc(SIZE * (1 + SIZE * 4))
for (let y = 0; y < SIZE; y++) {
  raw[y * (1 + SIZE * 4)] = 0  // filter None
  pixels.copy(raw, y * (1 + SIZE * 4) + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
}

const compressed = zlib.deflateSync(raw, { level: 9 })

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),  // PNG signature
  chunk('IHDR', ihdrData),
  chunk('IDAT', compressed),
  chunk('IEND', Buffer.alloc(0))
])

const outDir = path.join(__dirname, '..', 'assets')
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'icon.png'), png)
console.log('icon.png written to assets/')
