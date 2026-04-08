const path = require('path')
const fs   = require('fs')

// ── Load & normalise ──────────────────────────────────────────────────────────
// In a packaged Electron app __dirname is inside the asar/app folder.
// process.resourcesPath points to the resources/ dir which contains app.asar (or app/).
// We try __dirname/../data first (works in dev and asar:false builds),
// then fall back to resourcesPath/app/data.
function resolveDataDir () {
  const candidates = [
    path.join(__dirname, '..', 'data'),
    path.join(process.resourcesPath || '', 'app', 'data'),
    path.join(process.resourcesPath || '', 'data')
  ]
  for (const dir of candidates) {
    try {
      if (fs.existsSync(path.join(dir, 'en_kjv.json'))) return dir
    } catch (_) {}
  }
  return candidates[0] // fallback
}
const DATA_DIR = resolveDataDir()
const loadJSON = f => {
  let text = fs.readFileSync(path.join(DATA_DIR, f), 'utf-8')
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)  // strip UTF-8 BOM
  return JSON.parse(text)
}

const BOOK_NAMES_ENG = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
  '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra',
  'Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon',
  'Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos',
  'Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah',
  'Malachi','Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians',
  '2 Corinthians','Galatians','Ephesians','Philippians','Colossians',
  '1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon',
  'Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation'
]

const OT_END = 39   // books 0-38 = OT, 39-65 = NT

function normalizeEng (raw) {
  return raw.map((book, i) => ({
    title: BOOK_NAMES_ENG[i] || ('Book ' + (i + 1)),
    abbv: book.abbrev || '',
    chapters: book.chapters          // already array of string-arrays
  }))
}

function normalizeAmhOrm (raw) {
  return raw.books.map(book => ({
    title: book.name || book.title || '',
    abbv:  book.abbv || '',
    chapters: book.chapters.map(ch => ch.verses)
  }))
}

const data = {
  eng: normalizeEng(loadJSON('en_kjv.json')),
  amh: normalizeAmhOrm(loadJSON('amharic_bible.json')),
  orm: normalizeAmhOrm(loadJSON('oromo_bible.json'))
}

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  lang:         'eng',
  bookIndex:    0,
  chapterIndex: 0,
  view:         'single',   // 'single' | 'parallel'
  testament:    'ot'        // 'ot' | 'nt'
}

// ── DOM helpers ───────────────────────────────────────────────────────────────
const el = id => document.getElementById(id)

const bookList          = el('bookList')
const chapterGrid       = el('chapterGrid')
const chapterPanelTitle = el('chapterPanelTitle')
const chapterHeader     = el('chapterHeader')
const versesContainer   = el('versesContainer')
const singleView        = el('singleView')
const parallelView      = el('parallelView')
const searchResults     = el('searchResults')
const searchInput       = el('searchInput')
const settingsPanel     = el('settingsPanel')
const fontSizeSlider    = el('fontSizeSlider')
const fontSizeValue     = el('fontSizeValue')
const nightModeToggle   = el('nightModeToggle')
const otBtn             = el('otBtn')
const ntBtn             = el('ntBtn')
const singleViewBtn     = el('singleViewBtn')
const parallelViewBtn   = el('parallelViewBtn')
const prevBtn           = el('prevChapter')
const nextBtn           = el('nextChapter')

// ── Book list ─────────────────────────────────────────────────────────────────
function renderBookList () {
  bookList.innerHTML = ''
  const books = data[state.lang]
  const start = state.testament === 'ot' ? 0 : OT_END
  const end   = state.testament === 'ot' ? OT_END : 66

  for (let i = start; i < end; i++) {
    const div = document.createElement('div')
    div.className = 'book-item' + (i === state.bookIndex ? ' active' : '')
    div.innerHTML  = '<span class="book-num">' + (i + 1) + '</span>' + books[i].title
    div.addEventListener('click', () => selectBook(i))
    bookList.appendChild(div)
  }

  // scroll active book into view
  const active = bookList.querySelector('.book-item.active')
  if (active) active.scrollIntoView({ block: 'nearest' })
}

function selectBook (index) {
  state.bookIndex    = index
  state.chapterIndex = 0
  renderBookList()
  renderChapterGrid()
  render()
}

// ── Chapter grid ──────────────────────────────────────────────────────────────
function renderChapterGrid () {
  const book = data[state.lang][state.bookIndex]
  chapterPanelTitle.textContent = book.title
  chapterGrid.innerHTML = ''

  book.chapters.forEach(function (_, i) {
    const btn = document.createElement('button')
    btn.className   = 'ch-btn' + (i === state.chapterIndex ? ' active' : '')
    btn.textContent = i + 1
    btn.addEventListener('click', function () {
      state.chapterIndex = i
      renderChapterGrid()
      render()
    })
    chapterGrid.appendChild(btn)
  })
}

// ── Render single view ────────────────────────────────────────────────────────
function renderSingle () {
  const book    = data[state.lang][state.bookIndex]
  const chapter = book.chapters[state.chapterIndex] || []

  chapterHeader.textContent = book.title + '  —  Chapter ' + (state.chapterIndex + 1)
  versesContainer.innerHTML = ''

  chapter.forEach(function (text, i) {
    if (!text || !text.trim()) return
    const div = document.createElement('div')
    div.className    = 'verse-block'
    div.dataset.verse = i + 1
    div.innerHTML    = '<span class="verse-num">' + (i + 1) + '</span>' + text
    div.addEventListener('click', function () { div.classList.toggle('highlighted') })
    versesContainer.appendChild(div)
  })

  versesContainer.scrollTop = 0
}

// ── Render parallel view ──────────────────────────────────────────────────────
function renderParallel () {
  const book = data[state.lang][state.bookIndex]
  chapterHeader.textContent = book.title + '  —  Chapter ' + (state.chapterIndex + 1)

  const cols = {
    eng: el('parallelEng'),
    amh: el('parallelAmh'),
    orm: el('parallelOrm')
  }

  Object.keys(cols).forEach(function (lang) {
    const container = cols[lang]
    if (!container) return
    const chapter = (data[lang][state.bookIndex] &&
                     data[lang][state.bookIndex].chapters[state.chapterIndex]) || []
    container.innerHTML = ''

    chapter.forEach(function (text, i) {
      if (!text || !text.trim()) return
      const div = document.createElement('div')
      div.className = 'verse-block'
      div.innerHTML = '<span class="verse-num">' + (i + 1) + '</span>' + text
      div.addEventListener('click', function () { div.classList.toggle('highlighted') })
      container.appendChild(div)
    })

    container.scrollTop = 0
  })
}

// ── Main render ───────────────────────────────────────────────────────────────
function render () {
  searchResults.classList.add('hidden')

  if (state.view === 'single') {
    singleView.classList.remove('hidden')
    parallelView.classList.add('hidden')
    renderSingle()
  } else {
    singleView.classList.add('hidden')
    parallelView.classList.remove('hidden')
    renderParallel()
  }
}

// ── Search ────────────────────────────────────────────────────────────────────
function doSearch () {
  const query = searchInput.value.trim()
  if (!query) return
  const q = query.toLowerCase()
  const results = []

  data[state.lang].forEach(function (book, bi) {
    book.chapters.forEach(function (chapter, ci) {
      chapter.forEach(function (verse, vi) {
        if (verse && verse.toLowerCase().includes(q)) {
          results.push({ book: book, bi: bi, ci: ci, vi: vi, verse: verse })
        }
      })
    })
  })

  singleView.classList.add('hidden')
  parallelView.classList.add('hidden')
  searchResults.classList.remove('hidden')
  searchResults.innerHTML =
    '<div class="search-results-header">' + results.length +
    ' result(s) for "<strong>' + query + '</strong>"</div>'

  if (!results.length) {
    searchResults.innerHTML += '<p style="color:var(--text-light);padding:16px 0">No results found.</p>'
    return
  }

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex   = new RegExp(escaped, 'gi')

  results.slice(0, 150).forEach(function (r) {
    const div = document.createElement('div')
    div.className = 'search-result-item'
    const highlighted = r.verse.replace(regex, function (m) { return '<mark>' + m + '</mark>' })
    div.innerHTML =
      '<div class="search-ref">' + r.book.title + ' ' + (r.ci + 1) + ':' + (r.vi + 1) + '</div>' +
      '<div class="search-text">' + highlighted + '</div>'

    div.addEventListener('click', function () {
      state.bookIndex    = r.bi
      state.chapterIndex = r.ci
      state.testament    = r.bi < OT_END ? 'ot' : 'nt'
      otBtn.classList.toggle('active', state.testament === 'ot')
      ntBtn.classList.toggle('active', state.testament === 'nt')
      state.view = 'single'
      singleViewBtn.classList.add('active')
      parallelViewBtn.classList.remove('active')
      renderBookList()
      renderChapterGrid()
      render()
      setTimeout(function () {
        const verseEl = versesContainer.querySelector('[data-verse="' + (r.vi + 1) + '"]')
        if (verseEl) {
          verseEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
          verseEl.classList.add('highlighted')
        }
      }, 80)
    })
    searchResults.appendChild(div)
  })
}

// ── Prev / Next chapter ───────────────────────────────────────────────────────
function prevChapter () {
  if (state.chapterIndex > 0) {
    state.chapterIndex--
  } else if (state.bookIndex > 0) {
    state.bookIndex--
    state.chapterIndex = data[state.lang][state.bookIndex].chapters.length - 1
    if (state.bookIndex < OT_END && state.testament !== 'ot') {
      state.testament = 'ot'
      otBtn.classList.add('active')
      ntBtn.classList.remove('active')
    }
    renderBookList()
  }
  renderChapterGrid()
  render()
}

function nextChapter () {
  const book = data[state.lang][state.bookIndex]
  if (state.chapterIndex < book.chapters.length - 1) {
    state.chapterIndex++
  } else if (state.bookIndex < 65) {
    state.bookIndex++
    state.chapterIndex = 0
    if (state.bookIndex >= OT_END && state.testament !== 'nt') {
      state.testament = 'nt'
      ntBtn.classList.add('active')
      otBtn.classList.remove('active')
    }
    renderBookList()
  }
  renderChapterGrid()
  render()
}

// ── Event listeners ───────────────────────────────────────────────────────────

// Language buttons
document.querySelectorAll('.lang-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.lang-btn').forEach(function (b) { b.classList.remove('active') })
    btn.classList.add('active')
    state.lang         = btn.dataset.lang
    state.bookIndex    = 0
    state.chapterIndex = 0
    state.testament    = 'ot'
    otBtn.classList.add('active')
    ntBtn.classList.remove('active')
    renderBookList()
    renderChapterGrid()
    render()
  })
})

// Testament tabs
otBtn.addEventListener('click', function () {
  state.testament = 'ot'
  otBtn.classList.add('active')
  ntBtn.classList.remove('active')
  renderBookList()
})

ntBtn.addEventListener('click', function () {
  state.testament = 'nt'
  ntBtn.classList.add('active')
  otBtn.classList.remove('active')
  renderBookList()
})

// View buttons
singleViewBtn.addEventListener('click', function () {
  state.view = 'single'
  singleViewBtn.classList.add('active')
  parallelViewBtn.classList.remove('active')
  render()
})

parallelViewBtn.addEventListener('click', function () {
  state.view = 'parallel'
  parallelViewBtn.classList.add('active')
  singleViewBtn.classList.remove('active')
  render()
})

// Prev / Next
prevBtn.addEventListener('click', prevChapter)
nextBtn.addEventListener('click', nextChapter)

// Search
el('searchBtn').addEventListener('click', doSearch)
searchInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch() })

// Settings
el('settingsBtn').addEventListener('click', function () {
  settingsPanel.classList.toggle('hidden')
})
el('closeSettings').addEventListener('click', function () {
  settingsPanel.classList.add('hidden')
})

fontSizeSlider.addEventListener('input', function () {
  fontSizeValue.textContent = fontSizeSlider.value + 'px'
  document.documentElement.style.setProperty('--font-size', fontSizeSlider.value + 'px')
})

nightModeToggle.addEventListener('change', function () {
  document.body.classList.toggle('night', nightModeToggle.checked)
})

// Keyboard shortcuts
document.addEventListener('keydown', function (e) {
  if (e.ctrlKey && e.key === 'f') { searchInput.focus(); e.preventDefault() }
  if (!e.target.matches('input')) {
    if (e.key === 'ArrowRight') nextChapter()
    if (e.key === 'ArrowLeft')  prevChapter()
  }
})

// ── Init ──────────────────────────────────────────────────────────────────────
renderBookList()
renderChapterGrid()
render()
