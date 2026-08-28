#!/usr/bin/env python3
"""
Automated Wiktionary & Frequency Lexicon Ingest Pipeline for Jolito.

Downloads open Wiktionary extraction data (Kaikki.org) and OpenSubtitles Spanish frequency list:
1. Filters for high-frequency lemmas, Mexican idioms, and colloquial expressions.
2. Eliminates raw grammatical inflection meta-glosses.
3. Builds an inflection-to-lemma mapping table for fast verb/noun conjugation lookup.
4. Outputs compact static JSON files to:
   - `public/dict/es-en.json` (canonical dictionary entries)
   - `public/dict/es-lemmas.json` (inflection -> lemma map)
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
DICT_OUTPUT_PATH = "public/dict/es-en.json"
LEMMAS_OUTPUT_PATH = "public/dict/es-lemmas.json"

# Core curated Mexican Spanish seed entries to guarantee first-class quality
CURATED_MEXICAN_ENTRIES = [
    {
        "spanish": "madre",
        "english": "mother",
        "context": "Also central to countless Mexican idioms and slang.",
        "tag": "basics",
    },
    {
        "spanish": "padre",
        "english": "father / cool",
        "context": "Standard noun; in Mexico, widely used for 'cool'.",
        "tag": "basics",
    },
    {
        "spanish": "a toda madre",
        "english": "awesome / great / at full speed",
        "context": "Colloquial Mexican expression meaning fantastic or very fast.",
        "tag": "slang",
    },
    {
        "spanish": "ni madres",
        "english": "no way / not a chance",
        "context": "Emphatic Mexican slang rejection.",
        "tag": "slang",
    },
    {
        "spanish": "hasta la madre",
        "english": "fed up / completely full",
        "context": "Meaning sick and tired of something or very crowded.",
        "tag": "slang",
    },
    {
        "spanish": "desmadre",
        "english": "chaos / wild party / mess",
        "context": "Very common Mexican slang for disorder or intense fun.",
        "tag": "slang",
    },
    {
        "spanish": "madrazo",
        "english": "heavy blow / hard hit",
        "context": "Colloquial Mexican term for a punch or impact.",
        "tag": "slang",
    },
    {
        "spanish": "de pocas madres",
        "english": "unbelievable / amazing",
        "context": "Slang for something exceptionally good or brazen.",
        "tag": "slang",
    },
    {
        "spanish": "valer madre",
        "english": "to be worthless / ruined",
        "context": "Common idiom meaning something went wrong.",
        "tag": "slang",
    },
    {
        "spanish": "dar en la madre",
        "english": "to hit / break / beat up",
        "context": "Slang for striking or destroying something.",
        "tag": "slang",
    },
    {
        "spanish": "partirse la madre",
        "english": "to work relentlessly / take a spill",
        "context": "Slang for giving 100% effort or getting hurt.",
        "tag": "slang",
    },
    {
        "spanish": "ahorita",
        "english": "right now / in a bit",
        "context": "Iconic Mexican time nuance: right now, soon, or never.",
        "tag": "slang",
    },
    {
        "spanish": "qué padre",
        "english": "how cool / fantastic",
        "context": "Quintessential Mexican Spanish slang for something great.",
        "tag": "slang",
    },
    {
        "spanish": "qué chido",
        "english": "how cool / that is great",
        "context": "Universal Mexican exclamation of enthusiasm.",
        "tag": "slang",
    },
    {
        "spanish": "no manches",
        "english": "no way / you are kidding",
        "context": "Everyday Mexican expression of disbelief.",
        "tag": "slang",
    },
    {
        "spanish": "chela",
        "english": "beer",
        "context": "Casual Mexican word for a cold beer.",
        "tag": "slang",
    },
    {
        "spanish": "¿Dónde está el metro?",
        "english": "Where is the metro?",
        "context": "Asking for subway directions in Mexico City.",
        "tag": "travel",
    },
    {
        "spanish": "la cuenta, por favor",
        "english": "the bill, please",
        "context": "Polite restaurant phrase.",
        "tag": "travel",
    },
    {
        "spanish": "para llevar",
        "english": "to go / takeaway",
        "context": "Used when ordering food.",
        "tag": "food",
    },
    {
        "spanish": "Nos vemos al rato",
        "english": "See you later",
        "context": "Casual farewell in Mexican Spanish.",
        "tag": "common",
    },
]

META_GLOSS_PATTERN = re.compile(
    r"^(first|second|third)-person"
    r"|^(masculine|feminine)\s+(plural|singular)"
    r"|^(plural|singular)\s+of"
    r"|^gerund\s+of"
    r"|^infinitive\s+of"
    r"|^participle\s+of"
    r"|^past participle\s+of"
    r"|^imperative\s+of"
    r"|^subjunctive\s+of"
    r"|^indicative\s+of"
    r"|^synonym\s+of",
    re.IGNORECASE,
)

def clean_gloss_text(gloss):
    # Remove parentheticals like (transitive), (botany), (slang)
    cleaned = re.sub(r"\s*\(.*?\)\s*", " ", gloss).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    if not cleaned:
        cleaned = gloss.strip()
    # If synonym list is excessively long, truncate to top 3
    parts = [p.strip() for p in cleaned.split(",") if p.strip()]
    if len(parts) > 3:
        cleaned = ", ".join(parts[:3])
    return cleaned

def main():
    start_time = time.time()
    os.makedirs("public/dict", exist_ok=True)

    print("1. Downloading Spanish 50k word frequency list...")
    req_freq = urllib.request.Request(FREQ_URL, headers={"User-Agent": "JolitoDictionaryBuilder/1.0"})
    with urllib.request.urlopen(req_freq, timeout=30) as resp:
        freq_lines = resp.read().decode("utf-8").splitlines()

    top_words = {}
    for rank, line in enumerate(freq_lines[:40000]):
        parts = line.split()
        if parts:
            top_words[parts[0].lower()] = rank

    print(f"   Indexed {len(top_words)} top frequency Spanish words.")

    print("2. Streaming Kaikki Spanish Wiktionary dump...")
    req_kaikki = urllib.request.Request(KAIKKI_URL, headers={"User-Agent": "JolitoDictionaryBuilder/1.0"})

    lemmas = {}
    raw_inflections = {}
    scanned = 0

    with urllib.request.urlopen(req_kaikki, timeout=240) as resp:
        for line in resp:
            scanned += 1
            if scanned % 100000 == 0:
                print(f"   Processed {scanned} lines... ({len(lemmas)} lemmas captured)")

            data = json.loads(line.decode("utf-8"))
            word = data.get("word", "").strip()
            pos = data.get("pos", "")
            if not word or len(word) < 2:
                continue

            word_lower = word.lower()
            senses = data.get("senses", [])

            is_pure_form = True
            lemma_targets = []
            for s in senses:
                s_tags = [t.lower() for t in s.get("tags", []) + s.get("raw_tags", [])]
                if "form-of" in s_tags or "form_of" in s:
                    if "form_of" in s and s["form_of"]:
                        for f in s["form_of"]:
                            if "word" in f:
                                lemma_targets.append(f["word"].strip())
                else:
                    is_pure_form = False

            if is_pure_form:
                if lemma_targets:
                    for target in lemma_targets:
                        t_lower = target.lower()
                        if t_lower != word_lower:
                            if word_lower not in raw_inflections:
                                raw_inflections[word_lower] = []
                            if t_lower not in raw_inflections[word_lower]:
                                raw_inflections[word_lower].append(t_lower)
                continue

            is_mexican = any("mexic" in t.lower() for s in senses for t in s.get("tags", []) + s.get("raw_tags", []))
            is_slang = any(t.lower() in ["slang", "colloquial", "informal"] for s in senses for t in s.get("tags", []) + s.get("raw_tags", []))
            is_idiom = any(t.lower() in ["idiom", "proverb", "phrase", "idiomatic"] for s in senses for t in s.get("tags", []) + s.get("raw_tags", []))

            # Filter: include top frequency words or any Mexican / slang / idiom expression
            if word_lower not in top_words and not is_mexican and not is_slang and not is_idiom:
                continue

            valid_glosses = []
            for s in senses:
                s_tags = [t.lower() for t in s.get("tags", []) + s.get("raw_tags", [])]
                if "form-of" in s_tags:
                    continue
                if any(t in s_tags for t in ["archaic", "obsolete", "historical", "taxonomic", "botany", "chemistry", "zoology"]):
                    continue

                s_mex = any("mexic" in t for t in s_tags)
                for g in s.get("glosses", []):
                    g = g.strip()
                    if not g or META_GLOSS_PATTERN.match(g):
                        continue
                    clean_g = clean_gloss_text(g)
                    if clean_g:
                        valid_glosses.append((clean_g, s_mex))

            if valid_glosses:
                if word_lower not in lemmas:
                    lemmas[word_lower] = {
                        "spanish": word,
                        "pos": pos,
                        "glosses": valid_glosses,
                        "is_mexican": is_mexican,
                        "is_slang": is_slang,
                        "is_idiom": is_idiom,
                    }
                else:
                    lemmas[word_lower]["glosses"].extend(valid_glosses)
                    if is_mexican:
                        lemmas[word_lower]["is_mexican"] = True
                    if is_slang:
                        lemmas[word_lower]["is_slang"] = True
                    if is_idiom:
                        lemmas[word_lower]["is_idiom"] = True

    print(f"3. Building entries and resolving inflections...")
    # Add curated Mexican entries first
    entries = []
    seen_spanish = set()

    for item in CURATED_MEXICAN_ENTRIES:
        seen_spanish.add(item["spanish"].lower())
        entries.append(item)

    for word_lower, data in lemmas.items():
        if word_lower in seen_spanish:
            continue
        seen_spanish.add(word_lower)

        # Prioritize Mexican glosses
        unique_glosses = []
        seen_g = set()
        # Sort so Mexican senses are first
        sorted_glosses = sorted(data["glosses"], key=lambda x: not x[1])
        for g, _ in sorted_glosses:
            if g.lower() not in seen_g:
                seen_g.add(g.lower())
                unique_glosses.append(g)

        if not unique_glosses:
            continue

        clean_english = "; ".join(unique_glosses[:2])
        if len(clean_english) > 120:
            clean_english = unique_glosses[0][:120]

        is_slang = data["is_slang"]
        is_idiom = data["is_idiom"]
        is_mexican = data["is_mexican"]
        rank = top_words.get(word_lower, 99999)

        tag = "slang" if is_slang else ("idiom" if is_idiom else ("basics" if rank < 2500 else "common"))
        context = f"{data['pos']}." + (" Mexico." if is_mexican else "") + (" Colloquial / slang." if is_slang else "")

        entries.append({
            "spanish": data["spanish"],
            "english": clean_english,
            "context": context.strip(),
            "tag": tag,
        })

    # Resolve inflections to known lemmas
    lemma_map = {}
    for form, targets in raw_inflections.items():
        if form in seen_spanish:
            continue
        # Only keep inflections in top frequency words to keep file compact
        if form not in top_words:
            continue
        for target in targets:
            if target in seen_spanish:
                lemma_map[form] = target
                break

    print(f"4. Writing {len(entries)} entries to {DICT_OUTPUT_PATH}...")
    dict_bytes = json.dumps(entries, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    with open(DICT_OUTPUT_PATH, "wb") as f:
        f.write(dict_bytes)

    print(f"5. Writing {len(lemma_map)} inflection mappings to {LEMMAS_OUTPUT_PATH}...")
    lemma_bytes = json.dumps(lemma_map, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    with open(LEMMAS_OUTPUT_PATH, "wb") as f:
        f.write(lemma_bytes)

    dict_gz = len(gzip.compress(dict_bytes))
    lemma_gz = len(gzip.compress(lemma_bytes))
    elapsed = time.time() - start_time

    print(f"✓ Successfully built Jolito Lexicon in {elapsed:.2f}s!")
    print(f"  Dictionary: {len(entries)} words | {len(dict_bytes)/1024:.1f} KB (gzipped: {dict_gz/1024:.1f} KB)")
    print(f"  Lemma map:  {len(lemma_map)} forms  | {len(lemma_bytes)/1024:.1f} KB (gzipped: {lemma_gz/1024:.1f} KB)")

if __name__ == "__main__":
    main()

