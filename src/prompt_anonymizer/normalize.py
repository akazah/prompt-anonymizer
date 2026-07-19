"""Detection-only text normalization with original-offset mapping.

Analyzers see a normalized view (NFC, plus language-specific folds such as
halfwidth katakana → fullwidth for ``ja``). Spans are projected back onto
the original string before labeling, so mappings always store the caller's
verbatim values. Mirrors ``web/packages/core/src/normalize.ts``.
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass

from prompt_anonymizer.labeling import EntitySpan
from prompt_anonymizer.languages import LANGUAGES

# Halfwidth katakana base (FF66-FF9D) / marks (FF9E/FF9F) → fullwidth.
# Voiced pairs consume base+mark (ｶﾞ → ガ).
_HW_BASE = {
    "ｦ": "ヲ",
    "ｧ": "ァ",
    "ｨ": "ィ",
    "ｩ": "ゥ",
    "ｪ": "ェ",
    "ｫ": "ォ",
    "ｬ": "ャ",
    "ｭ": "ュ",
    "ｮ": "ョ",
    "ｯ": "ッ",
    "ｰ": "ー",
    "ｱ": "ア",
    "ｲ": "イ",
    "ｳ": "ウ",
    "ｴ": "エ",
    "ｵ": "オ",
    "ｶ": "カ",
    "ｷ": "キ",
    "ｸ": "ク",
    "ｹ": "ケ",
    "ｺ": "コ",
    "ｻ": "サ",
    "ｼ": "シ",
    "ｽ": "ス",
    "ｾ": "セ",
    "ｿ": "ソ",
    "ﾀ": "タ",
    "ﾁ": "チ",
    "ﾂ": "ツ",
    "ﾃ": "テ",
    "ﾄ": "ト",
    "ﾅ": "ナ",
    "ﾆ": "ニ",
    "ﾇ": "ヌ",
    "ﾈ": "ネ",
    "ﾉ": "ノ",
    "ﾊ": "ハ",
    "ﾋ": "ヒ",
    "ﾌ": "フ",
    "ﾍ": "ヘ",
    "ﾎ": "ホ",
    "ﾏ": "マ",
    "ﾐ": "ミ",
    "ﾑ": "ム",
    "ﾒ": "メ",
    "ﾓ": "モ",
    "ﾔ": "ヤ",
    "ﾕ": "ユ",
    "ﾖ": "ヨ",
    "ﾗ": "ラ",
    "ﾘ": "リ",
    "ﾙ": "ル",
    "ﾚ": "レ",
    "ﾛ": "ロ",
    "ﾜ": "ワ",
    "ﾝ": "ン",
}
_HW_PUNCT = {
    "｡": "。",
    "｢": "「",
    "｣": "」",
    "､": "、",
    "･": "・",
}
_HW_VOICED = {
    "カ": "ガ",
    "キ": "ギ",
    "ク": "グ",
    "ケ": "ゲ",
    "コ": "ゴ",
    "サ": "ザ",
    "シ": "ジ",
    "ス": "ズ",
    "セ": "ゼ",
    "ソ": "ゾ",
    "タ": "ダ",
    "チ": "ヂ",
    "ツ": "ヅ",
    "テ": "デ",
    "ト": "ド",
    "ハ": "バ",
    "ヒ": "ビ",
    "フ": "ブ",
    "ヘ": "ベ",
    "ホ": "ボ",
    "ウ": "ヴ",
}
_HW_SEMI_VOICED = {
    "ハ": "パ",
    "ヒ": "ピ",
    "フ": "プ",
    "ヘ": "ペ",
    "ホ": "ポ",
}

#: Named detect-time folds registered per language on :class:`LanguageConfig`.
FOLD_HALFWIDTH_KATAKANA = "halfwidth_katakana"


@dataclass(frozen=True)
class DetectView:
    """Normalized text plus a map from normalized offsets to original ones.

    ``orig_pos[i]`` is the original-string offset corresponding to normalized
    offset ``i``. Length is ``len(text) + 1`` so an end-exclusive span
    ``[start, end)`` maps to ``[orig_pos[start], orig_pos[end])``.
    """

    text: str
    orig_pos: tuple[int, ...]

    def map_span(self, start: int, end: int) -> tuple[int, int]:
        if start < 0 or end < start or end > len(self.text):
            raise ValueError(f"span [{start}, {end}) out of range for detect view")
        return self.orig_pos[start], self.orig_pos[end]

    def map_spans(self, spans: list[EntitySpan]) -> list[EntitySpan]:
        mapped: list[EntitySpan] = []
        for span in spans:
            orig_start, orig_end = self.map_span(span.start, span.end)
            mapped.append(
                EntitySpan(
                    start=orig_start,
                    end=orig_end,
                    entity_type=span.entity_type,
                    score=span.score,
                )
            )
        return mapped


def _nfc_with_map(text: str) -> tuple[str, list[int]]:
    """NFC-normalize ``text`` while tracking original offsets."""
    out: list[str] = []
    orig_pos = [0]
    i = 0
    n = len(text)
    while i < n:
        j = i + 1
        while j < n and unicodedata.combining(text[j]):
            j += 1
        chunk = unicodedata.normalize("NFC", text[i:j])
        if not chunk:
            i = j
            continue
        for k, ch in enumerate(chunk):
            out.append(ch)
            orig_pos.append(j if k == len(chunk) - 1 else i)
        i = j
    return "".join(out), orig_pos


def _fold_halfwidth_katakana(text: str, orig_pos: list[int]) -> tuple[str, list[int]]:
    """Fold halfwidth katakana to fullwidth; update ``orig_pos`` in step."""
    out: list[str] = []
    new_pos = [orig_pos[0]]
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        if ch in _HW_BASE:
            base = _HW_BASE[ch]
            nxt = text[i + 1] if i + 1 < n else ""
            if nxt == "ﾞ" and base in _HW_VOICED:
                out.append(_HW_VOICED[base])
                new_pos.append(orig_pos[i + 2])
                i += 2
                continue
            if nxt == "ﾟ" and base in _HW_SEMI_VOICED:
                out.append(_HW_SEMI_VOICED[base])
                new_pos.append(orig_pos[i + 2])
                i += 2
                continue
            out.append(base)
            new_pos.append(orig_pos[i + 1])
            i += 1
            continue
        if ch in _HW_PUNCT:
            out.append(_HW_PUNCT[ch])
            new_pos.append(orig_pos[i + 1])
            i += 1
            continue
        if ch in ("ﾞ", "ﾟ"):
            # Orphan mark: keep as fullwidth voiced/semi-voiced mark.
            out.append("゛" if ch == "ﾞ" else "゜")
            new_pos.append(orig_pos[i + 1])
            i += 1
            continue
        out.append(ch)
        new_pos.append(orig_pos[i + 1])
        i += 1
    return "".join(out), new_pos


def _apply_fold(name: str, text: str, orig_pos: list[int]) -> tuple[str, list[int]]:
    if name == FOLD_HALFWIDTH_KATAKANA:
        return _fold_halfwidth_katakana(text, orig_pos)
    raise ValueError(f"unknown detect fold: {name}")


def normalize_for_detect(text: str, language: str = "en") -> DetectView:
    """Build the detection view for ``text`` in ``language``.

    Always applies NFC. Then applies any ``detect_folds`` registered on the
    language config (unknown languages get NFC only).
    """
    normalized, orig_pos = _nfc_with_map(text)
    config = LANGUAGES.get(language)
    folds = config.detect_folds if config is not None else ()
    for fold in folds:
        normalized, orig_pos = _apply_fold(fold, normalized, orig_pos)
    return DetectView(text=normalized, orig_pos=tuple(orig_pos))
