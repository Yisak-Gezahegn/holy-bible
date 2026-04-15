# ✝ Holy Bible — Multilingual Scripture Reader

A desktop Bible app supporting **English (KJV & NIV)**, **አማርኛ (Amharic)**, and **Macaafa Qulquulu (Afaan Oromo)** — built with Electron.

## ✨ Features (v1.0.1)

- 📖 Read the full Bible in 3 languages (KJV, NIV, Amharic, Oromo)
- ⊞ Side-by-side parallel view (all 3 languages at once)
- 🔍 Scoped search — Entire Bible / Old Testament / New Testament / Current Book
- 🖊 6-color verse highlighting (persists after closing)
- 📝 Inline verse notes (auto-saved)
- 🔖 Bookmarks with Library tab to review all saved items
- 🌙 Night mode & adjustable font size
- 🚫 No native menu bar — clean modern UI
- 📴 Fully offline — no internet required

## 📥 Download

Go to the [**Releases**](https://github.com/Yisak-Gezahegn/holy-bible/releases) page and download:

- **`Holy Bible Setup 1.0.1.exe`** — Windows installer (one-click install)

## 🛠 Build from Source

```bash
git clone https://github.com/Yisak-Gezahegn/holy-bible.git
cd holy-bible
npm install
npm start          # run in development
npm run dist       # build installer → dist2/
```

## 📁 Project Structure

```
holy-bible/
├── main.js              # Electron main process
├── src/
│   ├── index.html       # App UI
│   ├── renderer.js      # All app logic
│   └── style.css        # Styles
├── data/
│   ├── en_kjv.json      # English KJV
│   ├── en_niv.json      # English NIV
│   ├── amharic_bible.json
│   └── oromo_bible.json
├── assets/
│   ├── icon.png
│   └── icon.ico
└── scripts/
    ├── make_icon.js     # Generates icon.png
    ├── make_ico.js      # Generates icon.ico
    └── convert_niv.js   # Converts NIV source files → en_niv.json
```

## About

Developed by **Yisak Gezahegn**  
Adama, Ethiopia  
Computer Science Department, Haramaya University

🕊 *Made in loving memory of Gezahegn Mamo*

> "Bringing the Word of God to every reader, in every language."

## License

MIT © 2026 Yisak Gezahegn
