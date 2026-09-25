"""Regenerate data/word-library.js from data/word-library.json.

The game loads the library as a script (not via fetch) so index.html can be
opened straight from disk without a web server.
Usage: python3 tools/json_to_js.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with open(os.path.join(ROOT, "data", "word-library.json")) as f:
    library = json.load(f)
with open(os.path.join(ROOT, "data", "word-library.js"), "w") as f:
    f.write("// Generated from word-library.json by tools/build_word_library.py — edit the JSON, then run\n")
    f.write("// python3 tools/json_to_js.py to refresh this file.\n")
    f.write("window.WORD_LIBRARY = ")
    json.dump(library, f, separators=(",", ":"))
    f.write(";\n")
