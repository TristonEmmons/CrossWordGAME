"""Build data/word-library.json: 500 common English words per length (3-12).

Sources (download before running):
  enable1.txt  - ENABLE word list (no proper nouns / abbreviations)
  bad.txt      - LDNOOBW English profanity list
Requires: pip install wordfreq

Usage: python3 tools/build_word_library.py enable1.txt bad.txt > data/word-library.json
"""
import json
import re
import sys

from wordfreq import top_n_list, zipf_frequency

PER_LENGTH = 500
# Three-letter words run out of genuinely common entries before 500, so that
# bucket stops at this frequency floor (Zipf scale) instead of padding with junk.
MIN_ZIPF_SHORT = 2.9
LENGTHS = range(3, 13)
ROMAN = re.compile(r"^m{0,4}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$")
# Extra exclusions: slurs/crude terms not in the base list, and odd short entries.
EXTRA_BAD = {
    "sex", "sexy", "gay", "gays", "kill", "killed", "killer", "killing", "dead",
    "death", "rape", "raped", "nazi", "nazis", "drug", "drugs", "porn", "nude",
    "naked", "damn", "hell", "crap", "piss", "suck", "sucks", "sucked", "dick",
    "cock", "butt", "tits", "boob", "boobs", "hoe", "hoes", "pee", "poo", "poop",
    "fag", "homo", "jew", "jews", "slut", "whore", "bitch", "ass", "arse",
    "murder", "suicide", "terror", "terrorist", "terrorism", "abortion",
    "dildo", "sexual", "sexually", "orgasm", "erotic", "stripper",
    "cocaine", "heroin", "weed", "meth", "lol", "omg", "ok", "tho", "gonna",
    "wanna", "gotta", "fuck", "shit", "bastard", "wtf", "lmao",
}
# Hand-skimmed oddities (names, abbreviations, slang, fragments) from the short buckets.
ODD = set("""
ain ala als alt ama ana ava ave bam bel ben bob bop bot bra bro bum cad cam chi cis col con
cos cox dee del dev dis doc dom don dos dow eff eng eta gal gee gen goa hah heh hes hmm hon
hun ins jin joe jun kat kay ken lam las lea lee lex lib lin mac mae mag mar mas med mel mil
mir mis mon mos nah nam nan nos ole ons ooh ops pac pam pas pol pow rad raj rec ref reg rep
res rev rex rom sal sec sen ser sic sim sis sol sox sri sup tae tao ted tel til tis tom tor
ugh umm ups var vis wat wen yah yea yep yup yum pic pro sub
alan anti dude haha hong info jack john matt mike nick semi tony mini okay yeah auto
amazon alexander allegedly harry henry louis paris peter smith texas trump wales japan china
jones brazil boston jordan joseph martin miller french german soviet jersey english charlie
victoria catholic colorado democrat democrats marshall twitter charlotte manhattan marijuana
republican republicans chamberlain presbyterian circumcision prostitution bachelorette
narcissistic manslaughter evangelical assault abuse drunk cigarette cigarettes
aba aga alp ami ani ars att bah bal bas bey bis biz bos coo cor coz dah dak dal daw deb dex dui
dun eau ems ere ers eth fay fil fro gan git hae haw het hoy ich ids ifs lac lat lei lev lis loo
luv mig mol mor mot naw nee nom obi ora pap pax pia pom ras rei rem ret rin roc sha sos tau tat
tod vox wha wis yeh yin zee nil phi psi thy aff ais bod cee dey dup ecu fas fer fey ged hao kos ley
mem mun mus nth obe pes ria sae shh syn tas tsk wot zig vas vac ump ell baa pus pox dud tut
""".split())


def main(enable_path, bad_path):
    with open(enable_path) as f:
        dictionary = {w.strip().lower() for w in f if w.strip()}
    with open(bad_path) as f:
        bad = {w.strip().lower() for w in f if w.strip()} | EXTRA_BAD

    buckets = {n: [] for n in LENGTHS}
    for word in top_n_list("en", 400000, wordlist="best"):
        n = len(word)
        if n not in buckets or len(buckets[n]) >= PER_LENGTH:
            continue
        if not word.isascii() or not word.isalpha() or word not in dictionary:
            continue
        if word in bad or word in ODD or any(b in word for b in bad if len(b) >= 4):
            continue
        if n == 3 and zipf_frequency(word, "en") < MIN_ZIPF_SHORT:
            continue
        if ROMAN.match(word):
            continue
        buckets[n].append(word)
        if all(len(b) >= PER_LENGTH for b in buckets.values()):
            break

    for n, words in buckets.items():
        if len(words) < PER_LENGTH:
            print(f"note: only {len(words)} words of length {n}", file=sys.stderr)
    out = {str(n): sorted(words) for n, words in buckets.items()}
    json.dump(out, sys.stdout, indent=0, separators=(",", ":"))
    sys.stdout.write("\n")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
