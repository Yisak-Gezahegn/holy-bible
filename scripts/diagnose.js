const path = require('path')
const fs   = require('fs')

const DATA_DIR = path.join(__dirname, '..', 'data')
const loadJSON = f => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf-8'))

// ── Check raw structure ───────────────────────────────────────────────────────
const rawAmh = loadJSON('amharic_bible.json')
const rawOrm = loadJSON('oromo_bible.json')
const rawEng = loadJSON('en_kjv.json')

console.log('=== ENG ===')
console.log('type:', Array.isArray(rawEng) ? 'array' : typeof rawEng)
console.log('length:', rawEng.length)
console.log('book[0] keys:', Object.keys(rawEng[0]))
console.log('book[0].abbrev:', rawEng[0].abbrev)
console.log('chapters type:', Array.isArray(rawEng[0].chapters) ? 'array' : typeof rawEng[0].chapters)
console.log('ch[0] type:', Array.isArray(rawEng[0].chapters[0]) ? 'array' : typeof rawEng[0].chapters[0])
console.log('ch[0][0]:', rawEng[0].chapters[0][0])

console.log('\n=== AMH ===')
console.log('top-level keys:', Object.keys(rawAmh))
console.log('books length:', rawAmh.books.length)
console.log('book[0] keys:', Object.keys(rawAmh.books[0]))
console.log('book[0].title:', rawAmh.books[0].title)
console.log('book[0].name:', rawAmh.books[0].name)
console.log('chapters[0] keys:', Object.keys(rawAmh.books[0].chapters[0]))
console.log('chapters[0].verses[0]:', rawAmh.books[0].chapters[0].verses[0])

console.log('\n=== ORM ===')
console.log('top-level keys:', Object.keys(rawOrm))
console.log('books length:', rawOrm.books.length)
console.log('book[0] keys:', Object.keys(rawOrm.books[0]))
console.log('book[0].title:', rawOrm.books[0].title)
console.log('chapters[0] keys:', Object.keys(rawOrm.books[0].chapters[0]))
console.log('chapters[0].verses[0]:', rawOrm.books[0].chapters[0].verses[0])

// ── Simulate normalizeAmhOrm ──────────────────────────────────────────────────
console.log('\n=== NORMALIZE TEST ===')
function normalizeAmhOrm(raw) {
  return raw.books.map(book => ({
    title: book.title,
    abbv:  book.abbv || '',
    chapters: book.chapters.map(ch => ch.verses)
  }))
}

const amh = normalizeAmhOrm(rawAmh)
const orm = normalizeAmhOrm(rawOrm)

console.log('AMH[0].title:', amh[0].title)
console.log('AMH[0].chapters[0][0]:', amh[0].chapters[0][0])
console.log('ORM[0].title:', orm[0].title)
console.log('ORM[0].chapters[0][0]:', orm[0].chapters[0][0])

// ── Check book counts match ───────────────────────────────────────────────────
console.log('\n=== BOOK COUNT CHECK ===')
function normalizeEng(raw) {
  return raw.map((book, i) => ({
    title: book.abbrev || ('Book ' + (i+1)),
    chapters: book.chapters
  }))
}
const eng = normalizeEng(rawEng)
console.log('ENG books:', eng.length)
console.log('AMH books:', amh.length)
console.log('ORM books:', orm.length)

// Check chapter counts match for first 5 books
console.log('\n=== CHAPTER COUNT MISMATCH CHECK (first 10 books) ===')
for (let i = 0; i < 10; i++) {
  const e = eng[i]?.chapters.length
  const a = amh[i]?.chapters.length
  const o = orm[i]?.chapters.length
  if (e !== a || e !== o) {
    console.log(`Book ${i+1}: ENG=${e} AMH=${a} ORM=${o} *** MISMATCH ***`)
  } else {
    console.log(`Book ${i+1}: ${e} chapters OK`)
  }
}
