'use strict'
// Converts 66 individual NIV JSON files → data/en_niv.json
// Format matches en_kjv.json: array of {abbrev, chapters: string[][]}
const fs   = require('fs')
const path = require('path')

const NIV_DIR = path.join(__dirname, '..', 'resource', 'Bible-niv-main', 'Bible-niv-main')
const OUT     = path.join(__dirname, '..', 'data', 'en_niv.json')

const BOOK_ORDER = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
  '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra',
  'Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song Of Solomon',
  'Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos',
  'Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah',
  'Malachi','Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians',
  '2 Corinthians','Galatians','Ephesians','Philippians','Colossians',
  '1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon',
  'Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation'
]

const result = []

for (const bookName of BOOK_ORDER) {
  const filePath = path.join(NIV_DIR, bookName + '.json')
  if (!fs.existsSync(filePath)) {
    console.warn('MISSING:', bookName)
    result.push({ abbrev: bookName.toLowerCase().replace(/\s/g,''), chapters: [] })
    continue
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  // raw.chapters = [{chapter:"1", verses:[{verse:"1", text:"..."},...]}]
  const chapters = raw.chapters.map(ch =>
    ch.verses.map(v => v.text)
  )
  result.push({ abbrev: bookName.toLowerCase().replace(/\s/g,''), chapters })
  console.log('OK:', bookName, '—', chapters.length, 'chapters')
}

fs.writeFileSync(OUT, JSON.stringify(result))
console.log('\nWritten to', OUT)
console.log('Total books:', result.length)
