#!/usr/bin/env python3
"""
Automated Wiktionary & Frequency Lexicon Ingest Pipeline for Jolito.

Downloads open Wiktionary extraction data (Kaikki.org) and OpenSubtitles Spanish frequency list,
filtering for top ~30,000+ high-frequency lemmas, Mexican idioms, and colloquial expressions.
Outputs a compact static JSON file to `public/dict/es-en.json`.
"""

import gzip
import json
import os
import re
import sys
import time
import urllib.request

FREQ_URL = "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/es/es_50k.txt"
KAIKKI_URL = "https://kaikki.org/dictionary/Spanish/kaikki.org-dictionary-Spanish.jsonl"
OUTPUT_PATH = "public/dict/es-en.json"

def main():
    start_time = time.time()
    os.makedirs("public/dict", exist_ok=True)

    print("1. Downloading Spanish 50k word frequency list...")
    req_freq = urllib.request.Request(FREQ_URL, headers={"User-Agent": "JolitoDictionaryBuilder/1.0"})
    with urllib.request.urlopen(req_freq, timeout=20) as resp:
        freq_lines = resp.read().decode("utf-8").splitlines()

    top_words = {}
    for rank, line in enumerate(freq_lines[:30000]):
        parts = line.split()
        if parts:
            top_words[parts[0].lower()] = rank

    print(f"   Indexed {len(top_words)} top frequency Spanish words.")

    print("2. Streaming Kaikki Spanish Wiktionary dump...")
    req_kaikki = urllib.request.Request(KAIKKI_URL, headers={"User-Agent": "JolitoDictionaryBuilder/1.0"})
    
    entries = []
    seen = set()
    scanned = 0

    with urllib.request.urlopen(req_kaikki, timeout=240) as resp:
        for line in resp:
            scanned += 1
            if scanned % 100000 == 0:
                print(f"   Processed {scanned} lines... ({len(entries)} words captured)")

            data = json.loads(line.decode("utf-8"))
            word = data.get("word", "").strip()
            pos = data.get("pos", "")

            if not word or len(word) < 2:
                continue

            word_lower = word.lower()
            senses = data.get("senses", [])

            is_mexican = any("mexic" in t.lower() for s in senses for t in s.get("tags", []) + s.get("raw_tags", []))
            is_slang = any("slang" in t.lower() or "colloquial" in t.lower() or "informal" in t.lower() for s in senses for t in s.get("tags", []) + s.get("raw_tags", []))
            is_idiom = any("idiom" in t.lower() or "proverb" in t.lower() or "phrase" in t.lower() for s in senses for t in s.get("tags", []) + s.get("raw_tags", []))

            # Filter: include top frequency words or any Mexican / slang / idiom expression
            if word_lower not in top_words and not is_mexican and not is_slang and not is_idiom:
                continue

            all_glosses = []
            for sense in senses:
                glosses = sense.get("glosses", [])
                for g in glosses:
                    if g and not g.startswith("plural of ") and not g.startswith("feminine plural of "):
                        all_glosses.append(g)

            if not all_glosses and senses:
                for sense in senses:
                    for g in sense.get("glosses", []):
                        if g:
                            all_glosses.append(g)

            if not all_glosses:
                continue

            if word_lower not in seen:
                seen.add(word_lower)
                clean_gloss = "; ".join(all_glosses[:2])
                clean_gloss = re.sub(r"\(.*?\)", "", clean_gloss).strip()
                clean_gloss = re.sub(r"\s+", " ", clean_gloss)
                if not clean_gloss:
                    clean_gloss = all_glosses[0]

                tag = "slang" if is_slang else ("idiom" if is_idiom else ("basics" if top_words.get(word_lower, 99999) < 2500 else "common"))
                context = f"{pos}." + (" Mexico." if is_mexican else "") + (" Colloquial / slang." if is_slang else "")

                entries.append({
                    "spanish": word,
                    "english": clean_gloss[:120],
                    "context": context.strip(),
                    "tag": tag
                })

    print(f"3. Writing {len(entries)} entries to {OUTPUT_PATH}...")
    json_bytes = json.dumps(entries, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    with open(OUTPUT_PATH, "wb") as f:
        f.write(json_bytes)

    compressed_size = len(gzip.compress(json_bytes))
    elapsed = time.time() - start_time
    print(f"✓ Successfully generated {OUTPUT_PATH} with {len(entries)} words in {elapsed:.2f}s!")
    print(f"  Uncompressed size: {len(json_bytes)/1024:.1f} KB | Gzipped transfer size: {compressed_size/1024:.1f} KB")

if __name__ == "__main__":
    main()
