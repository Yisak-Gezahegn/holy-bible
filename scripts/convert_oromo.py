import os
import re
import json

# Standard 66 book order with USFM codes and Afaan Oromo names
BOOK_ORDER = [
    ("GEN", "Uumama"),
    ("EXO", "Baʼuu"),
    ("LEV", "Leewwii"),
    ("NUM", "Lakkoofsa"),
    ("DEU", "Seera Lammaffaa"),
    ("JOS", "Yoosuwaa"),
    ("JDG", "Abbootii Murtii"),
    ("RUT", "Ruutii"),
    ("1SA", "1 Samʼeel"),
    ("2SA", "2 Samʼeel"),
    ("1KI", "1 Mootota"),
    ("2KI", "2 Mootota"),
    ("1CH", "1 Seenaa"),
    ("2CH", "2 Seenaa"),
    ("EZR", "Eziraa"),
    ("NEH", "Neheemiyaa"),
    ("EST", "Aster"),
    ("JOB", "Iyyoob"),
    ("PSA", "Faarfannaa"),
    ("PRO", "Barruu Ogummaa"),
    ("ECC", "Qoheleet"),
    ("SNG", "Faaruu Faarfannaa"),
    ("ISA", "Isaayyaas"),
    ("JER", "Ermiyaas"),
    ("LAM", "Boocichaa"),
    ("EZK", "Hizqeel"),
    ("DAN", "Daaniyeel"),
    ("HOS", "Hooseʼaa"),
    ("JOL", "Yoʼeel"),
    ("AMO", "Aamoos"),
    ("OBA", "Obadiyaa"),
    ("JON", "Yoonaas"),
    ("MIC", "Miikiyaas"),
    ("NAM", "Naahuum"),
    ("HAB", "Habaquuq"),
    ("ZEP", "Sefaniyaas"),
    ("HAG", "Haggaai"),
    ("ZEC", "Zakariyaas"),
    ("MAL", "Malaaʼekii"),
    ("MAT", "Maatewoos"),
    ("MRK", "Maarqoos"),
    ("LUK", "Luuqaas"),
    ("JHN", "Yohannis"),
    ("ACT", "Hojii Ergamootaa"),
    ("ROM", "Roomaa"),
    ("1CO", "1 Qorontos"),
    ("2CO", "2 Qorontos"),
    ("GAL", "Gaalaatiyaa"),
    ("EPH", "Efesoon"),
    ("PHP", "Filiphisiyuus"),
    ("COL", "Qolasiyaas"),
    ("1TH", "1 Tesalooqee"),
    ("2TH", "2 Tesalooqee"),
    ("1TI", "1 Ximootewoos"),
    ("2TI", "2 Ximootewoos"),
    ("TIT", "Tiitoos"),
    ("PHM", "Filimoon"),
    ("HEB", "Ibroota"),
    ("JAS", "Yaaqoob"),
    ("1PE", "1 Phexroos"),
    ("2PE", "2 Phexroos"),
    ("1JN", "1 Yohannis"),
    ("2JN", "2 Yohannis"),
    ("3JN", "3 Yohannis"),
    ("JUD", "Yihuudaa"),
    ("REV", "Mul'ata"),
]

def parse_usfm(filepath):
    """Parse a USFM file and return chapters as list of verse lists."""
    with open(filepath, encoding="utf-8") as f:
        content = f.read()

    chapters = {}
    current_chapter = None
    current_verse_num = None
    current_verse_text = []

    def save_verse():
        if current_chapter and current_verse_num:
            if current_chapter not in chapters:
                chapters[current_chapter] = {}
            text = " ".join(current_verse_text).strip()
            # Remove USFM inline markers like \w, \wj, \nd etc.
            text = re.sub(r'\\[a-z0-9]+\*?', '', text)
            text = re.sub(r'\s+', ' ', text).strip()
            chapters[current_chapter][current_verse_num] = text

    for line in content.splitlines():
        line = line.strip()

        # Chapter marker
        c_match = re.match(r'^\\c\s+(\d+)', line)
        if c_match:
            save_verse()
            current_chapter = int(c_match.group(1))
            current_verse_num = None
            current_verse_text = []
            continue

        # Verse marker
        v_match = re.match(r'^\\v\s+(\d+(?:-\d+)?)\s*(.*)', line)
        if v_match:
            save_verse()
            verse_ref = v_match.group(1)
            # Handle verse ranges like "1-3" - use first number
            current_verse_num = int(verse_ref.split('-')[0])
            current_verse_text = [v_match.group(2)] if v_match.group(2) else []
            continue

        # Skip non-text markers (headers, notes, etc.)
        if line.startswith('\\') and not line.startswith('\\v'):
            # But keep continuation text after markers like \p \q
            marker_match = re.match(r'^\\[a-z0-9]+\s*(.*)', line)
            if marker_match and current_verse_num and marker_match.group(1):
                current_verse_text.append(marker_match.group(1))
            continue

        # Plain continuation text
        if current_verse_num and line:
            current_verse_text.append(line)

    save_verse()  # Save last verse

    # Convert to list-of-lists format (chapters sorted, verses sorted)
    result = []
    for ch_num in sorted(chapters.keys()):
        verses = chapters[ch_num]
        max_verse = max(verses.keys())
        verse_list = []
        for v in range(1, max_verse + 1):
            verse_list.append(verses.get(v, ""))
        result.append({"chapter": str(ch_num), "title": "", "verses": verse_list})

    return result

def find_usfm_file(folder, book_code):
    """Find the USFM file for a given book code."""
    for fname in os.listdir(folder):
        if fname.upper().endswith('.USFM') and book_code.upper() in fname.upper():
            return os.path.join(folder, fname)
    return None

def main():
    usfm_folder = "Downloads/oro_usfm"
    output_file = "Downloads/oromo_bible.json"

    bible = {"title": "Kitaaba Qulqulluu", "books": []}
    missing = []

    for book_code, book_name in BOOK_ORDER:
        filepath = find_usfm_file(usfm_folder, book_code)
        if not filepath:
            print(f"  MISSING: {book_code} - {book_name}")
            missing.append(book_code)
            bible["books"].append({"title": book_name, "abbv": book_code, "chapters": []})
            continue

        chapters = parse_usfm(filepath)
        bible["books"].append({
            "title": book_name,
            "abbv": book_code,
            "chapters": chapters
        })
        print(f"  OK: {book_code} - {book_name} ({len(chapters)} chapters)")

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(bible, f, ensure_ascii=False, indent=2)

    print(f"\nDone. Saved to {output_file}")
    if missing:
        print(f"Missing books: {missing}")
    else:
        print("All 66 books converted successfully.")

if __name__ == "__main__":
    main()
