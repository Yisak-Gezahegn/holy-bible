'use strict'
// ═══════════════════════════════════════════════════════════════════════════
// Holy Bible v1.0.1 — renderer.js
// ═══════════════════════════════════════════════════════════════════════════
const fs   = require('fs')
const path = require('path')

// ── Data directory ────────────────────────────────────────────────────────────
function resolveDataDir () {
  const candidates = [
    path.join(__dirname, '..', 'data'),
    path.join(process.resourcesPath || '', 'app', 'data'),
    path.join(process.resourcesPath || '', 'data')
  ]
  for (const dir of candidates) {
    try { if (fs.existsSync(path.join(dir, 'en_kjv.json'))) return dir } catch (_) {}
  }
  return candidates[0]
}
const DATA_DIR = resolveDataDir()

function loadJSON (f) {
  let text = fs.readFileSync(path.join(DATA_DIR, f), 'utf-8')
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  return JSON.parse(text)
}

// ── Book names ────────────────────────────────────────────────────────────────
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

// ── Normalizers ───────────────────────────────────────────────────────────────
function normalizeEng (raw) {
  return raw.map((book, i) => ({
    title: BOOK_NAMES_ENG[i] || ('Book ' + (i + 1)),
    abbv: book.abbrev || '',
    chapters: book.chapters
  }))
}

function normalizeAmhOrm (raw) {
  return raw.books.map(book => ({
    title: book.name || book.title || '',
    abbv:  book.abbv || '',
    chapters: book.chapters.map(ch => ch.verses)
  }))
}

// ── Bible data cache ──────────────────────────────────────────────────────────
const BIBLE_CACHE = {}

const VERSION_DEFS = {
  eng: [
    { id: 'kjv', label: 'KJV',  file: 'en_kjv.json',       norm: normalizeEng    },
    { id: 'niv', label: 'NIV',  file: 'en_niv.json',        norm: normalizeEng    }
  ],
  amh: [
    { id: 'amh', label: 'አማርኛ', file: 'amharic_bible.json', norm: normalizeAmhOrm },
    { id: 'amt', label: 'አዲሱ',  file: null,                 norm: null            }
  ],
  orm: [
    { id: 'orm', label: 'Macaafa Qulquulu', file: 'oromo_bible.json', norm: normalizeAmhOrm }
  ]
}

function getBible (versionId) {
  if (BIBLE_CACHE[versionId]) return BIBLE_CACHE[versionId]
  for (const defs of Object.values(VERSION_DEFS)) {
    const v = defs.find(x => x.id === versionId)
    if (v) {
      if (!v.file) return null
      BIBLE_CACHE[versionId] = v.norm(loadJSON(v.file))
      return BIBLE_CACHE[versionId]
    }
  }
  return null
}

// Pre-load all available bibles
;['kjv','amh','orm'].forEach(getBible)


// ═══════════════════════════════════════════════════════════════════════════
// PERSISTENCE — localStorage
// ═══════════════════════════════════════════════════════════════════════════
const STORAGE_KEY = 'hb_userdata_v1'

function loadUserData () {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (_) {}
  return { highlights: {}, notes: {}, bookmarks: {} }
}

function saveUserData () {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(userData)) } catch (_) {}
}

let userData = loadUserData()

// verseId: "versionId|bookIdx|chapterIdx|verseIdx"
function vid (versionId, bi, ci, vi) {
  return versionId + '|' + bi + '|' + ci + '|' + vi
}

function setHighlight (id, colorIdx) {
  userData.highlights[id] = { color: colorIdx, ts: Date.now() }
  saveUserData()
}
function clearHighlight (id) {
  delete userData.highlights[id]
  saveUserData()
}
function setNote (id, text) {
  if (!text || !text.trim()) { delete userData.notes[id] }
  else { userData.notes[id] = { text: text.trim(), edited: Date.now() } }
  saveUserData()
}
function toggleBookmark (id) {
  if (userData.bookmarks[id]) { delete userData.bookmarks[id] }
  else { userData.bookmarks[id] = { ts: Date.now() } }
  saveUserData()
}

// ── Highlight colors ──────────────────────────────────────────────────────────
const COLORS     = ['#FFD700','#90EE90','#87CEEB','#FFB6C1','#FFA500','#DDA0DD']
const COLORS_BG  = ['#FFD70044','#90EE9044','#87CEEB44','#FFB6C144','#FFA50044','#DDA0DD44']


// ═══════════════════════════════════════════════════════════════════════════
// APP STATE
// ═══════════════════════════════════════════════════════════════════════════
const state = {
  lang:         'eng',
  version:      'kjv',
  bookIdx:      0,
  chapterIdx:   0,
  testament:    'ot',
  view:         'single',   // 'single' | 'parallel'
  activeTab:    'reader',   // 'reader' | 'library'
  libFilter:    'all',
  searchOpen:   false
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id)

const bookListEl       = $('bookList')
const chapterGridEl    = $('chapterGrid')
const chapterPanelTitle= $('chapterPanelTitle')
const chapterHeader    = $('chapterHeader')
const versesContainer  = $('versesContainer')
const singleView       = $('singleView')
const parallelView     = $('parallelView')
const searchResults    = $('searchResults')
const searchInput      = $('searchInput')
const settingsPanel    = $('settingsPanel')
const fontSizeSlider   = $('fontSizeSlider')
const fontSizeValue    = $('fontSizeValue')
const nightModeToggle  = $('nightModeToggle')
const otBtn            = $('otBtn')
const ntBtn            = $('ntBtn')
const singleViewBtn    = $('singleViewBtn')
const parallelViewBtn  = $('parallelViewBtn')
const prevBtn          = $('prevChapter')
const nextBtn          = $('nextChapter')
const versionSelect    = $('versionSelect')
const colorPicker      = $('colorPicker')
const libraryList      = $('libraryList')
const readerTab        = $('readerTab')
const libraryTab       = $('libraryTab')

let pickerTargetVid = null   // verse id currently targeted by color picker

// ── Toast notification ────────────────────────────────────────────────────────
function showToast (msg, duration) {
  duration = duration || 3000
  const toast = $('toast')
  toast.textContent = msg
  toast.classList.remove('hidden')
  clearTimeout(toast._timer)
  toast._timer = setTimeout(() => toast.classList.add('hidden'), duration)
}


// ═══════════════════════════════════════════════════════════════════════════
// VERSION SELECT
// ═══════════════════════════════════════════════════════════════════════════
function populateVersionSelect () {
  versionSelect.innerHTML = ''
  const defs = VERSION_DEFS[state.lang] || []
  defs.forEach(v => {
    const opt = document.createElement('option')
    opt.value = v.id
    opt.textContent = v.label + (v.file ? '' : ' (soon)')
    versionSelect.appendChild(opt)
  })
  // pick first available
  const first = defs.find(v => v.file)
  if (first) {
    state.version = first.id
    versionSelect.value = first.id
  }
}

versionSelect.addEventListener('change', () => {
  const defs = VERSION_DEFS[state.lang] || []
  const chosen = defs.find(v => v.id === versionSelect.value)
  if (chosen && !chosen.file) {
    showToast('⏳ ' + chosen.label + ' version coming soon — data file not yet available.')
    // revert to previous valid version
    versionSelect.value = state.version
    return
  }
  state.version = versionSelect.value
  renderBookList()
  renderChapterGrid()
  render()
})

// ═══════════════════════════════════════════════════════════════════════════
// SIDEBAR — book list
// ═══════════════════════════════════════════════════════════════════════════
function renderBookList () {
  const bible = getBible(state.version)
  bookListEl.innerHTML = ''
  if (!bible) { bookListEl.innerHTML = '<p class="no-data">No data available.</p>'; return }

  const start = state.testament === 'ot' ? 0 : OT_END
  const end   = state.testament === 'ot' ? OT_END : bible.length

  for (let i = start; i < end; i++) {
    const div = document.createElement('div')
    div.className = 'book-item' + (i === state.bookIdx ? ' active' : '')
    div.innerHTML = '<span class="book-num">' + (i + 1) + '</span>' + bible[i].title
    div.addEventListener('click', () => selectBook(i))
    bookListEl.appendChild(div)
  }

  const active = bookListEl.querySelector('.book-item.active')
  if (active) active.scrollIntoView({ block: 'nearest' })
}

function selectBook (idx) {
  state.bookIdx   = idx
  state.chapterIdx = 0
  renderBookList()
  renderChapterGrid()
  render()
}

// ── Chapter grid ──────────────────────────────────────────────────────────────
function renderChapterGrid () {
  const bible = getBible(state.version)
  if (!bible) return
  const book = bible[state.bookIdx]
  chapterPanelTitle.textContent = book.title
  chapterGridEl.innerHTML = ''

  book.chapters.forEach((_, i) => {
    const btn = document.createElement('button')
    btn.className   = 'ch-btn' + (i === state.chapterIdx ? ' active' : '')
    btn.textContent = i + 1
    btn.addEventListener('click', () => {
      state.chapterIdx = i
      renderChapterGrid()
      render()
    })
    chapterGridEl.appendChild(btn)
  })
}


// ═══════════════════════════════════════════════════════════════════════════
// VERSE RENDERING
// ═══════════════════════════════════════════════════════════════════════════
function buildVerseEl (text, verseNum, verseVid) {
  const hl = userData.highlights[verseVid]
  const bm = userData.bookmarks[verseVid]
  const nt = userData.notes[verseVid]

  const wrap = document.createElement('div')
  wrap.className = 'verse-block' + (hl ? ' highlighted' : '') + (bm ? ' bookmarked' : '')
  wrap.dataset.vid = verseVid
  if (hl) wrap.style.background = COLORS_BG[hl.color]

  // verse number + text
  const numSpan = document.createElement('span')
  numSpan.className   = 'verse-num'
  numSpan.textContent = verseNum

  const txtSpan = document.createElement('span')
  txtSpan.className   = 'verse-text'
  txtSpan.textContent = text

  // action buttons
  const actions = document.createElement('span')
  actions.className = 'verse-actions'

  const hlBtn = document.createElement('button')
  hlBtn.className = 'va-btn' + (hl ? ' active' : '')
  hlBtn.title     = 'Highlight'
  hlBtn.innerHTML = '🖊'
  hlBtn.addEventListener('click', e => {
    e.stopPropagation()
    openColorPicker(verseVid, hlBtn)
  })

  const bmBtn = document.createElement('button')
  bmBtn.className = 'va-btn' + (bm ? ' active' : '')
  bmBtn.title     = 'Bookmark'
  bmBtn.innerHTML = '🔖'
  bmBtn.addEventListener('click', e => {
    e.stopPropagation()
    toggleBookmark(verseVid)
    renderVerses()
    if (state.activeTab === 'library') renderLibrary()
  })

  const ntBtn2 = document.createElement('button')
  ntBtn2.className = 'va-btn' + (nt ? ' active' : '')
  ntBtn2.title     = 'Note'
  ntBtn2.innerHTML = '📝'
  ntBtn2.addEventListener('click', e => {
    e.stopPropagation()
    toggleNoteArea(wrap, verseVid)
  })

  actions.appendChild(hlBtn)
  actions.appendChild(bmBtn)
  actions.appendChild(ntBtn2)

  wrap.appendChild(numSpan)
  wrap.appendChild(txtSpan)
  wrap.appendChild(actions)

  // existing note preview
  if (nt) {
    const notePreview = document.createElement('div')
    notePreview.className = 'note-preview'
    notePreview.textContent = '📝 ' + nt.text
    wrap.appendChild(notePreview)
  }

  return wrap
}

function toggleNoteArea (wrap, verseVid) {
  let area = wrap.querySelector('.note-area')
  if (area) { area.remove(); return }

  area = document.createElement('div')
  area.className = 'note-area'

  const ta = document.createElement('textarea')
  ta.className   = 'note-textarea'
  ta.placeholder = 'Write a note…'
  ta.value       = (userData.notes[verseVid] && userData.notes[verseVid].text) || ''

  let saveTimer = null
  ta.addEventListener('input', () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      setNote(verseVid, ta.value)
      // update preview
      const preview = wrap.querySelector('.note-preview')
      if (ta.value.trim()) {
        if (preview) { preview.textContent = '📝 ' + ta.value.trim() }
        else {
          const p = document.createElement('div')
          p.className   = 'note-preview'
          p.textContent = '📝 ' + ta.value.trim()
          wrap.insertBefore(p, area)
        }
      } else {
        if (preview) preview.remove()
      }
      if (state.activeTab === 'library') renderLibrary()
    }, 600)
  })

  const closeBtn = document.createElement('button')
  closeBtn.className   = 'note-close'
  closeBtn.textContent = 'Done'
  closeBtn.addEventListener('click', () => area.remove())

  area.appendChild(ta)
  area.appendChild(closeBtn)
  wrap.appendChild(area)
  ta.focus()
}

function renderVerses () {
  searchResults.classList.add('hidden')
  if (state.view === 'parallel') { renderParallel(); return }

  singleView.classList.remove('hidden')
  parallelView.classList.add('hidden')

  const bible = getBible(state.version)
  if (!bible) { versesContainer.innerHTML = '<p class="no-data">Version data not available.</p>'; return }

  const book    = bible[state.bookIdx]
  const chapter = book.chapters[state.chapterIdx] || []

  chapterHeader.textContent = book.title + '  —  Chapter ' + (state.chapterIdx + 1)
  versesContainer.innerHTML = ''
  versesContainer.style.fontSize = fontSizeSlider.value + 'px'

  chapter.forEach((text, vi) => {
    if (!text || !text.trim()) return
    const verseVid = vid(state.version, state.bookIdx, state.chapterIdx, vi)
    const el = buildVerseEl(text, vi + 1, verseVid)
    versesContainer.appendChild(el)
  })

  versesContainer.scrollTop = 0
}

function renderParallel () {
  singleView.classList.add('hidden')
  parallelView.classList.remove('hidden')
  searchResults.classList.add('hidden')

  const versions = [
    { id: 'kjv', colId: 'parallelCol1' },
    { id: 'amh', colId: 'parallelCol2' },
    { id: 'orm', colId: 'parallelCol3' }
  ]

  // Use current book/chapter for all
  versions.forEach(({ id: vId, colId }) => {
    const col    = $(colId)
    const bible  = getBible(vId)
    col.innerHTML = ''
    if (!bible) { col.innerHTML = '<p class="no-data">N/A</p>'; return }

    const book    = bible[state.bookIdx]
    const chapter = (book && book.chapters[state.chapterIdx]) || []

    chapter.forEach((text, vi) => {
      if (!text || !text.trim()) return
      const verseVid = vid(vId, state.bookIdx, state.chapterIdx, vi)
      const el = buildVerseEl(text, vi + 1, verseVid)
      col.appendChild(el)
    })
    col.scrollTop = 0
  })

  const kjvBible = getBible('kjv')
  if (kjvBible) {
    chapterHeader.textContent = kjvBible[state.bookIdx].title + '  —  Chapter ' + (state.chapterIdx + 1)
  }
}

function render () {
  searchResults.classList.add('hidden')
  renderVerses()
}


// ═══════════════════════════════════════════════════════════════════════════
// COLOR PICKER
// ═══════════════════════════════════════════════════════════════════════════
function openColorPicker (verseVid, anchorEl) {
  pickerTargetVid = verseVid
  const rect = anchorEl.getBoundingClientRect()
  colorPicker.style.top  = (rect.bottom + 6) + 'px'
  colorPicker.style.left = Math.min(rect.left, window.innerWidth - 220) + 'px'
  colorPicker.classList.remove('hidden')
}

function closeColorPicker () {
  colorPicker.classList.add('hidden')
  pickerTargetVid = null
}

document.querySelectorAll('.cp-color').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!pickerTargetVid) return
    setHighlight(pickerTargetVid, parseInt(btn.dataset.color))
    closeColorPicker()
    renderVerses()
    if (state.activeTab === 'library') renderLibrary()
  })
})

$('cpClear').addEventListener('click', () => {
  if (!pickerTargetVid) return
  clearHighlight(pickerTargetVid)
  closeColorPicker()
  renderVerses()
  if (state.activeTab === 'library') renderLibrary()
})

document.addEventListener('click', e => {
  if (!colorPicker.classList.contains('hidden') &&
      !colorPicker.contains(e.target) &&
      !e.target.classList.contains('va-btn')) {
    closeColorPicker()
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// LIBRARY TAB
// ═══════════════════════════════════════════════════════════════════════════
function parseVid (verseVid) {
  const parts = verseVid.split('|')
  return { versionId: parts[0], bi: +parts[1], ci: +parts[2], vi: +parts[3] }
}

function getVerseText (verseVid) {
  const { versionId, bi, ci, vi } = parseVid(verseVid)
  const bible = getBible(versionId)
  if (!bible) return ''
  const book = bible[bi]
  if (!book) return ''
  const chapter = book.chapters[ci]
  if (!chapter) return ''
  return chapter[vi] || ''
}

function getVerseRef (verseVid) {
  const { versionId, bi, ci, vi } = parseVid(verseVid)
  const bible = getBible(versionId)
  if (!bible) return verseVid
  const book = bible[bi]
  if (!book) return verseVid
  return book.title + ' ' + (ci + 1) + ':' + (vi + 1) + ' (' + versionId.toUpperCase() + ')'
}

function renderLibrary () {
  libraryList.innerHTML = ''
  const filter = state.libFilter

  // Collect all entries
  const entries = []

  Object.entries(userData.highlights).forEach(([id, data]) => {
    if (filter === 'all' || filter === 'highlight') {
      entries.push({ type: 'highlight', id, ts: data.ts, color: data.color })
    }
  })
  Object.entries(userData.bookmarks).forEach(([id, data]) => {
    if (filter === 'all' || filter === 'bookmark') {
      entries.push({ type: 'bookmark', id, ts: data.ts })
    }
  })
  Object.entries(userData.notes).forEach(([id, data]) => {
    if (filter === 'all' || filter === 'note') {
      entries.push({ type: 'note', id, ts: data.edited, noteText: data.text })
    }
  })

  // Sort newest first
  entries.sort((a, b) => b.ts - a.ts)

  if (!entries.length) {
    libraryList.innerHTML = '<p class="no-data">No saved items yet. Highlight, bookmark, or note a verse to see it here.</p>'
    return
  }

  entries.forEach(entry => {
    const text = getVerseText(entry.id)
    const ref  = getVerseRef(entry.id)

    const card = document.createElement('div')
    card.className = 'lib-card'
    if (entry.type === 'highlight') card.style.borderLeft = '4px solid ' + COLORS[entry.color]

    const badge = document.createElement('span')
    badge.className = 'lib-badge lib-badge-' + entry.type
    badge.textContent = entry.type === 'highlight' ? '🖊 Highlight'
                      : entry.type === 'bookmark'  ? '🔖 Bookmark'
                      : '📝 Note'

    const refEl = document.createElement('div')
    refEl.className   = 'lib-ref'
    refEl.textContent = ref

    const textEl = document.createElement('div')
    textEl.className   = 'lib-text'
    textEl.textContent = text

    card.appendChild(badge)
    card.appendChild(refEl)
    card.appendChild(textEl)

    if (entry.type === 'note' && entry.noteText) {
      const noteEl = document.createElement('div')
      noteEl.className   = 'lib-note-text'
      noteEl.textContent = '📝 ' + entry.noteText
      card.appendChild(noteEl)
    }

    // Click to navigate
    card.addEventListener('click', () => {
      const { bi, ci } = parseVid(entry.id)
      state.bookIdx   = bi
      state.chapterIdx = ci
      state.testament  = bi < OT_END ? 'ot' : 'nt'
      otBtn.classList.toggle('active', state.testament === 'ot')
      ntBtn.classList.toggle('active', state.testament === 'nt')
      switchTab('reader')
      renderBookList()
      renderChapterGrid()
      render()
      // scroll to verse
      setTimeout(() => {
        const { vi } = parseVid(entry.id)
        const verseEl = versesContainer.querySelector('[data-vid="' + entry.id + '"]')
        if (verseEl) verseEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    })

    libraryList.appendChild(card)
  })
}


// ═══════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════
// SEARCH ENGINE
// ═══════════════════════════════════════════════════════════════════════════
function doSearch () {
  const query = searchInput.value.trim()
  if (!query) return
  const q = query.toLowerCase()

  const scopeEl = document.querySelector('input[name="scope"]:checked')
  const scope   = scopeEl ? scopeEl.value : 'all'
  const bible   = getBible(state.version)
  if (!bible) return

  let startBook = 0
  let endBook   = bible.length
  if (scope === 'ot')   { startBook = 0;             endBook = OT_END }
  else if (scope === 'nt')   { startBook = OT_END;        endBook = bible.length }
  else if (scope === 'book') { startBook = state.bookIdx; endBook = state.bookIdx + 1 }

  const results = []
  for (let bi = startBook; bi < endBook; bi++) {
    const book = bible[bi]
    book.chapters.forEach((chapter, ci) => {
      chapter.forEach((verse, vi) => {
        if (verse && verse.toLowerCase().includes(q)) {
          results.push({ book, bi, ci, vi, verse })
        }
      })
    })
  }

  singleView.classList.add('hidden')
  parallelView.classList.add('hidden')
  searchResults.classList.remove('hidden')

  const scopeLabel = scope === 'all' ? 'Entire Bible'
    : scope === 'ot'   ? 'Old Testament'
    : scope === 'nt'   ? 'New Testament'
    : bible[state.bookIdx].title

  searchResults.innerHTML =
    '<div class="search-results-header">' +
    results.length + ' result(s) for "<strong>' + query + '</strong>" in ' + scopeLabel +
    '</div>'

  if (!results.length) {
    searchResults.innerHTML += '<p style="color:var(--text-light);padding:16px 0">No results found.</p>'
    return
  }

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex   = new RegExp(escaped, 'gi')

  results.slice(0, 200).forEach(r => {
    const div = document.createElement('div')
    div.className = 'search-result-item'
    const hl = r.verse.replace(regex, m => '<mark>' + m + '</mark>')
    div.innerHTML =
      '<div class="search-ref">' + r.book.title + ' ' + (r.ci + 1) + ':' + (r.vi + 1) + '</div>' +
      '<div class="search-text">' + hl + '</div>'

    div.addEventListener('click', () => {
      state.bookIdx    = r.bi
      state.chapterIdx = r.ci
      state.testament  = r.bi < OT_END ? 'ot' : 'nt'
      otBtn.classList.toggle('active', state.testament === 'ot')
      ntBtn.classList.toggle('active', state.testament === 'nt')
      state.view = 'single'
      singleViewBtn.classList.add('active')
      parallelViewBtn.classList.remove('active')
      renderBookList()
      renderChapterGrid()
      render()
      setTimeout(() => {
        const verseEl = versesContainer.querySelector('[data-vid*="|' + r.bi + '|' + r.ci + '|' + r.vi + '"]')
        if (verseEl) verseEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 80)
    })
    searchResults.appendChild(div)
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION — prev / next chapter
// ═══════════════════════════════════════════════════════════════════════════
function prevChapter () {
  const bible = getBible(state.version)
  if (!bible) return
  if (state.chapterIdx > 0) {
    state.chapterIdx--
  } else if (state.bookIdx > 0) {
    state.bookIdx--
    state.chapterIdx = bible[state.bookIdx].chapters.length - 1
    if (state.bookIdx < OT_END && state.testament !== 'ot') {
      state.testament = 'ot'
      otBtn.classList.add('active'); ntBtn.classList.remove('active')
    }
    renderBookList()
  }
  renderChapterGrid()
  render()
}

function nextChapter () {
  const bible = getBible(state.version)
  if (!bible) return
  const book = bible[state.bookIdx]
  if (state.chapterIdx < book.chapters.length - 1) {
    state.chapterIdx++
  } else if (state.bookIdx < bible.length - 1) {
    state.bookIdx++
    state.chapterIdx = 0
    if (state.bookIdx >= OT_END && state.testament !== 'nt') {
      state.testament = 'nt'
      ntBtn.classList.add('active'); otBtn.classList.remove('active')
    }
    renderBookList()
  }
  renderChapterGrid()
  render()
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════════════════════════════════════════
function switchTab (tab) {
  state.activeTab = tab
  readerTab.classList.toggle('hidden', tab !== 'reader')
  readerTab.classList.toggle('active', tab === 'reader')
  libraryTab.classList.toggle('hidden', tab !== 'library')
  if (tab === 'library') renderLibrary()
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════════════

// Language buttons (original topbar design)
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    state.lang       = btn.dataset.lang
    state.bookIdx    = 0
    state.chapterIdx = 0
    state.testament  = 'ot'
    otBtn.classList.add('active'); ntBtn.classList.remove('active')
    populateVersionSelect()
    renderBookList()
    renderChapterGrid()
    render()
  })
})

// Testament tabs
otBtn.addEventListener('click', () => {
  state.testament = 'ot'
  otBtn.classList.add('active'); ntBtn.classList.remove('active')
  renderBookList()
})
ntBtn.addEventListener('click', () => {
  state.testament = 'nt'
  ntBtn.classList.add('active'); otBtn.classList.remove('active')
  renderBookList()
})

// View mode (original topbar design)
singleViewBtn.addEventListener('click', () => {
  state.view = 'single'
  singleViewBtn.classList.add('active'); parallelViewBtn.classList.remove('active')
  render()
})
parallelViewBtn.addEventListener('click', () => {
  state.view = 'parallel'
  parallelViewBtn.classList.add('active'); singleViewBtn.classList.remove('active')
  render()
})

// Prev / Next
prevBtn.addEventListener('click', prevChapter)
nextBtn.addEventListener('click', nextChapter)

// Search — show scope row on focus, keep visible while interacting
searchInput.addEventListener('focus', () => {
  $('searchScopeWrap').classList.remove('hidden')
})
// Don't hide on blur — user needs to click radio buttons after focusing input
// Hide only when clicking outside the entire search area
document.addEventListener('click', e => {
  const scopeWrap = $('searchScopeWrap')
  if (!scopeWrap.classList.contains('hidden')) {
    const searchArea = scopeWrap.closest('.topbar-right') || scopeWrap.parentElement
    if (!searchArea.contains(e.target) && e.target !== searchInput && e.target.id !== 'searchBtn') {
      scopeWrap.classList.add('hidden')
    }
  }
})
$('searchBtn').addEventListener('click', doSearch)
searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch() })

// Library button
$('libraryBtn').addEventListener('click', () => switchTab('library'))
$('libraryBackBtn').addEventListener('click', () => switchTab('reader'))

// Settings
$('settingsBtn').addEventListener('click', () => settingsPanel.classList.toggle('hidden'))
$('closeSettings').addEventListener('click', () => settingsPanel.classList.add('hidden'))

fontSizeSlider.addEventListener('input', () => {
  fontSizeValue.textContent = fontSizeSlider.value + 'px'
  versesContainer.style.fontSize = fontSizeSlider.value + 'px'
})

nightModeToggle.addEventListener('change', () => {
  document.body.classList.toggle('night', nightModeToggle.checked)
})

// Library filters
document.querySelectorAll('.lib-filter').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.lib-filter').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    state.libFilter = btn.dataset.filter
    renderLibrary()
  })
})

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'f') {
    e.preventDefault()
    searchInput.focus()
  }
  if (!e.target.matches('input, textarea')) {
    if (e.key === 'ArrowRight') nextChapter()
    if (e.key === 'ArrowLeft')  prevChapter()
  }
})

// Close settings when clicking outside
document.addEventListener('click', e => {
  if (!settingsPanel.classList.contains('hidden') &&
      !settingsPanel.contains(e.target) &&
      e.target.id !== 'settingsBtn') {
    settingsPanel.classList.add('hidden')
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════
populateVersionSelect()
renderBookList()
renderChapterGrid()
render()
