"""Free-text stop search over the static GTFS stops.txt data.

"49th and fraser" -> terms ["49", "fraser"] -> every stop whose name contains
both words, in any order (e.g. "Northbound Fraser St @ E 49 Ave" and
"Eastbound E 49 Ave @ Fraser St").

Matching rules, applied the same way to queries and stop names:
  * lowercase; split on anything that isn't a letter or digit (so "&", "@",
    "-" and "/" all act as separators)
  * strip ordinal suffixes from numbers: 49th -> 49, 1st -> 1
  * drop separator words (and, at) and filler words (ave, st, station,
    eastbound, ...)

Each remaining query word matches a stop-name word that is:
  * identical                                  (score 100)
  * a prefix of it, for words of 3+ letters    (score 90, "fras" -> "fraser")
  * a close typo, for words of 4+ letters      (score <= 85, "frasr" -> "fraser")
Numbers only ever match exactly, so "49" never matches "48" or "490".
"""

import re
from dataclasses import dataclass, field

from rapidfuzz import fuzz, process

# Words that join two street names: "49th and fraser", "main @ hastings"
SEPARATOR_WORDS = {"and", "at", "of"}

# Words too common in stop names to help narrow a search
FILLER_WORDS = {
    # street types
    "ave", "av", "avenue", "st", "street", "rd", "road", "blvd", "boulevard",
    "dr", "drive", "hwy", "highway", "way", "pl", "place", "cres", "crescent",
    "ct", "court", "pkwy", "parkway", "ln", "lane",
    # directions
    "northbound", "southbound", "eastbound", "westbound",
    "nb", "sb", "eb", "wb",
    "n", "s", "e", "w", "north", "south", "east", "west",
    # station / stop words
    "station", "stn", "stop", "bay", "platform", "loop", "exchange", "the",
}

STOP_WORDS = SEPARATOR_WORDS | FILLER_WORDS

_TOKEN_RE = re.compile(r"[a-z0-9]+")
_ORDINAL_RE = re.compile(r"^(\d+)(?:st|nd|rd|th)$")
_DIRECTION_RE = re.compile(r"\b(North|South|East|West)bound\b", re.IGNORECASE)

EXACT_SCORE = 100
PREFIX_SCORE = 90
MIN_PREFIX_LEN = 3
MIN_FUZZY_LEN = 4
FUZZY_CUTOFF = 80  # rapidfuzz ratio, 0-100
FUZZY_WEIGHT = 0.85  # keeps a typo match below an exact or prefix match


def normalize(text: str) -> list[str]:
    """Turn free text into the list of meaningful search words."""
    words = []
    for token in _TOKEN_RE.findall(text.lower()):
        ordinal = _ORDINAL_RE.match(token)
        if ordinal:
            token = ordinal.group(1)
        if token not in STOP_WORDS:
            words.append(token)
    return words


def split_direction(stop_name: str) -> tuple[str, str | None]:
    """'Northbound Fraser St @ E 49 Ave' -> ('Fraser St @ E 49 Ave', 'Northbound')."""
    match = _DIRECTION_RE.search(stop_name)
    if not match:
        return stop_name, None
    direction = match.group(1).capitalize() + "bound"
    place = _DIRECTION_RE.sub("", stop_name, count=1)
    place = re.sub(r"\(\s+", "(", place)
    place = re.sub(r"\s{2,}", " ", place).strip()
    return place, direction


@dataclass
class StopSearchIndex:
    stops: list[dict] = field(default_factory=list)
    # word -> indices into self.stops whose name contains that word
    postings: dict[str, set[int]] = field(default_factory=dict)
    # every distinct word, for prefix and fuzzy lookups
    vocabulary: list[str] = field(default_factory=list)
    # normalized words of each stop name, parallel to self.stops
    stop_words: list[set[str]] = field(default_factory=list)

    @classmethod
    def build(cls, stops: list[dict]) -> "StopSearchIndex":
        """`stops` items need "stop_id", "stop_code" and "stop_name" keys."""
        index = cls()
        for stop in stops:
            place, direction = split_direction(stop["stop_name"])
            position = len(index.stops)
            index.stops.append({
                "stop_id": stop["stop_id"],
                "stop_code": stop["stop_code"],
                "stop_name": stop["stop_name"],
                "direction": direction,
                "label": f"{place}, {direction}" if direction else place,
            })
            words = set(normalize(stop["stop_name"]))
            index.stop_words.append(words)
            for word in words:
                index.postings.setdefault(word, set()).add(position)
        index.vocabulary = list(index.postings)
        return index

    def _word_matches(self, word: str) -> dict[str, float]:
        """Every vocabulary word that `word` matches, with its match score."""
        matches: dict[str, float] = {}
        if word in self.postings:
            matches[word] = EXACT_SCORE
        if word.isdigit():
            return matches

        if len(word) >= MIN_PREFIX_LEN:
            for candidate in self.vocabulary:
                if candidate != word and candidate.startswith(word):
                    matches[candidate] = PREFIX_SCORE

        if len(word) >= MIN_FUZZY_LEN:
            for candidate, ratio, _ in process.extract(
                word,
                self.vocabulary,
                scorer=fuzz.ratio,
                score_cutoff=FUZZY_CUTOFF,
                limit=None,
            ):
                if candidate.isdigit():
                    continue
                matches.setdefault(candidate, ratio * FUZZY_WEIGHT)
        return matches

    def search(self, query: str, limit: int = 20) -> tuple[list[str], list[dict]]:
        """Return (search terms, matching stops ranked best first)."""
        terms = list(dict.fromkeys(normalize(query)))  # dedupe, keep order
        if not terms:
            return terms, []

        per_term_matches = []
        candidates: set[int] | None = None
        for term in terms:
            matches = self._word_matches(term)
            if not matches:
                return terms, []
            per_term_matches.append(matches)
            hits = set().union(*(self.postings[w] for w in matches))
            candidates = hits if candidates is None else candidates & hits
            if not candidates:
                return terms, []

        scored = []
        for position in candidates:
            stop = self.stops[position]
            stop_words = self.stop_words[position]
            score = sum(
                max(s for w, s in matches.items() if w in stop_words)
                for matches in per_term_matches
            )
            scored.append((score, stop))

        scored.sort(key=lambda item: (-item[0], item[1]["label"]))
        results = [
            {**stop, "score": round(score / len(terms), 1)}
            for score, stop in scored[:limit]
        ]
        return terms, results
