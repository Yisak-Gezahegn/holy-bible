/**
 * Converts assets/icon.png → assets/icon.ico
 * Embeds sizes: 16, 32, 48, 64, 128, 256
 * Uses only Node built-ins — no npm packages.
 */
const fs   = require('fs')
const path = require('path')
const zlib = require('zlib')

// ── Read & decode the PNG we generated ───────────────────────────────────────
const pngBuf = fs.readFileSync(path.join(__dirname, '..', 'assets', 'icon.png'))

function parsePng(buf) {
  // find IHDR
  let pos = 8
  let width, height, pixels
  while (pos < buf.length) {
    const len  = buf.readUInt32BE(pos);     pos += 4
    const type = buf.slice(pos, pos + 4).toString('ascii'); pos += 4
    const data = buf.slice(pos, pos + len); pos += len + 4  // skip crc
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4) }
    if (type === 'IDAT') {
      // collect all IDAT chunks
      if (!pixels) pixels = [data]; else pixels.push(data)
    }
  }
  const raw = zlib.inflateSync(Buffer.concat(pixels))
  const stride = 1 + width * 4
  const rgba = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y++) {
    raw.copy(rgba, y * width * 4, y * stride + 1, (y + 1) * stride)
  }
  return { width, height, rgba }
}

const src = parsePng(pngBuf)

// ── Resize (nearest-neighbour) ────────────────────────────────────────────────
function resize(src, size) {
  const out = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.floor(x * src.width  / size)
      const sy = Math.floor(y * src.height / size)
      const si = (sy * src.width + sx) * 4
      const di = (y  * size      + x)  * 4
      src.rgba.copy(out, di, si, si + 4)
    }
  }
  return out
}

// ── Build ICO ─────────────────────────────────────────────────────────────────
const SIZES = [16, 32, 48, 64, 128, 256]

// Each image stored as PNG inside ICO (modern format, supported by Windows Vista+)
const zlib2 = require('zlib')

function u16le(n) { const b = Buffer.alloc(2); b.writeUInt16LE(n, 0); return b }
function u32le(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0, 0); return b }

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
function u32be(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0, 0); return b }
function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data)
  return Buffer.concat([u32be(d.length), t, d, u32be(crc32(Buffer.concat([t, d])))])
}

function makePng(rgba, size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6  // RGBA
  const raw = Buffer.alloc(size * (1 + size * 4))
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 4)] = 0
    rgba.copy(raw, y * (1 + size * 4) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const compressed = zlib2.deflateSync(raw, { level: 9 })
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

const images = SIZES.map(size => makePng(resize(src, size), size))

// ICO header: reserved(2) + type(2) + count(2)
const count  = SIZES.length
const header = Buffer.concat([u16le(0), u16le(1), u16le(count)])

// Directory entries (16 bytes each)
const dirEntrySize = 16
const dataOffset   = 6 + count * dirEntrySize
let offset = dataOffset
const dirs = images.map((img, i) => {
  const size = SIZES[i]
  const entry = Buffer.concat([
    Buffer.from([size === 256 ? 0 : size, size === 256 ? 0 : size, 0, 0]),
    u16le(1),       // color planes
    u16le(32),      // bits per pixel
    u32le(img.length),
    u32le(offset)
  ])
  offset += img.length
  return entry
})

const ico = Buffer.concat([header, ...dirs, ...images])
const outPath = path.join(__dirname, '..', 'assets', 'icon.ico')
fs.writeFileSync(outPath, ico)
console.log('icon.ico written to assets/ (' + SIZES.join(', ') + 'px)')
