"""Single source of truth for the languages both cores support.

To add a language, add one :class:`LanguageConfig` entry to :data:`LANGUAGES`
(plus a ``labels/<code>.yaml`` file) and mirror it in the TypeScript core's
``web/packages/core/src/languages.ts``. CLI validation, spaCy/HF model
resolution, phone recognizers, heuristic language detection, eval defaults
and the consistency tests all derive from it; the tests in
``tests/unit/test_languages.py`` then point at every remaining gap
(labels, models, golden sets, README translation).

This module is dependency-free (no presidio / spaCy imports) so the
engine-free ``scan`` path stays light.
"""

from __future__ import annotations

from dataclasses import dataclass

__all__ = [
    "DEFAULT_LANGUAGES",
    "DETECTION_RULES",
    "LANGUAGES",
    "SUPPORTED_LANGUAGES",
    "LanguageConfig",
    "PhonePattern",
    "PhoneSpec",
]


@dataclass(frozen=True)
class PhonePattern:
    """One regex for a language's phone notation (kept in parity with the
    TS core's rule table in ``web/packages/core/src/recognizers.ts``)."""

    name: str
    regex: str
    score: float


@dataclass(frozen=True)
class PhoneSpec:
    """Language-scoped phone detection: a libphonenumber region for
    Presidio's ``PhoneRecognizer`` plus regex fallbacks for notation
    variants the libphonenumber matcher skips."""

    region: str
    patterns: tuple[PhonePattern, ...]
    context: tuple[str, ...]


@dataclass(frozen=True)
class LanguageConfig:
    code: str
    #: English display name (used in docs / help text).
    name: str
    #: spaCy pipeline per model size.
    spacy_sm: str
    spacy_lg: str
    #: Transformer NER checkpoint for ``ner_backend="hf"``. Defaults mirror
    #: the TypeScript core's ONNX exports (see ``DEFAULT_NER_MODELS`` in
    #: ``web/packages/core/src/ner.ts``).
    hf_ner_model: str
    #: Language-scoped phone recognition. ``None`` for languages whose phone
    #: formats are already covered by the cross-language ja/us recognizers.
    phone: PhoneSpec | None = None


# 9 digits after the prefix (mobile), or 10 for 02x landlines. Each
# alternative is a fixed run of bounded groups - no ReDoS-prone nesting.
_VN_PHONE_BODY = (
    r"(?:\d{2}[ .-]?\d{3}[ .-]?\d{4}"
    r"|\d{3}[ .-]?\d{3}[ .-]?\d{3}"
    r"|\d{2}[ .-]?\d{4}[ .-]?\d{4})"
)

# Multilingual NER fine-tuned on ten high-resource languages (de, es, fr,
# it, nl, pt, zh, en, ar, lv); mBERT transfers usably to languages outside
# that set (used for ko, where no checkpoint in this family exists).
_HRL = "Davlan/bert-base-multilingual-cased-ner-hrl"

LANGUAGES: dict[str, LanguageConfig] = {
    "en": LanguageConfig(
        code="en",
        name="English",
        spacy_sm="en_core_web_sm",
        spacy_lg="en_core_web_lg",
        hf_ner_model="dslim/bert-base-NER",
        # US formats are covered by the cross-language UsPhoneRegexRecognizer
        # registered for every language (recognizers/us_phone.py).
        phone=None,
    ),
    "ja": LanguageConfig(
        code="ja",
        name="Japanese",
        spacy_sm="ja_core_news_sm",
        spacy_lg="ja_core_news_lg",
        hf_ner_model="tsmatz/xlm-roberta-ner-japanese",
        # JP formats are covered by the cross-language JaPhoneRegexRecognizer
        # (with its digit-count validator) plus a JP-region PhoneRecognizer,
        # both registered in recognizers/ja_phone.py.
        phone=None,
    ),
    "es": LanguageConfig(
        code="es",
        name="Spanish",
        spacy_sm="es_core_news_sm",
        spacy_lg="es_core_news_lg",
        hf_ner_model=_HRL,
        # Nine digits (mobiles 6/7, landlines 8/9) grouped 3-3-3 or, for
        # landlines, 2-3-2-2. A bare 9-digit run is too ambiguous, so the
        # fallback requires either the +34 prefix or group separators.
        phone=PhoneSpec(
            region="ES",
            patterns=(
                PhonePattern(
                    "es_phone_prefixed",
                    r"(?<!\d)\+34[ .-]?[6789]\d{2}[ .-]?\d{3}[ .-]?\d{3}(?!\d)",
                    0.6,
                ),
                PhonePattern(
                    "es_phone_grouped",
                    r"(?<!\d)[6789]\d{2}[ .-]\d{3}[ .-]\d{3}(?!\d)",
                    0.6,
                ),
                PhonePattern(
                    "es_phone_landline",
                    r"(?<!\d)[89]\d[ .-]\d{3}[ .-]\d{2}[ .-]\d{2}(?!\d)",
                    0.5,
                ),
            ),
            context=(
                "teléfono",
                "telefono",
                "móvil",
                "movil",
                "llamar",
                "contacto",
                "tel",
                "phone",
            ),
        ),
    ),
    "vi": LanguageConfig(
        code="vi",
        name="Vietnamese",
        # No official spaCy pipeline: the multi-language WikiNER model
        # provides tokenization plus baseline PER/LOC NER for both sizes.
        spacy_sm="xx_ent_wiki_sm",
        spacy_lg="xx_ent_wiki_sm",
        # Native VLSP-trained model (no ONNX export exists, so the TS core
        # falls back to the multilingual HRL model for vi).
        hf_ner_model="NlpHUST/ner-vietnamese-electra-base",
        # Ten digits starting with 0 (mobiles), 02x landlines add a digit;
        # +84 replaces the leading 0. Grouped 4-3-3 / 3-3-4 / 3-4-4.
        phone=PhoneSpec(
            region="VN",
            patterns=(
                PhonePattern("vn_phone_domestic", rf"(?<!\d)0{_VN_PHONE_BODY}(?!\d)", 0.6),
                PhonePattern("vn_phone_prefixed", rf"(?<!\d)\+84[ .-]?{_VN_PHONE_BODY}(?!\d)", 0.6),
            ),
            context=(
                "điện thoại",
                "số điện thoại",
                "di động",
                "gọi",
                "liên hệ",
                "sđt",
                "tel",
                "phone",
            ),
        ),
    ),
    "zh": LanguageConfig(
        code="zh",
        name="Chinese",
        spacy_sm="zh_core_web_sm",
        spacy_lg="zh_core_web_lg",
        hf_ner_model=_HRL,
        # Mobiles are 11 digits (1[3-9]..) grouped 3-4-4; landlines are a
        # 0-prefixed 3/4-digit area code plus 7-8 digits.
        phone=PhoneSpec(
            region="CN",
            patterns=(
                PhonePattern(
                    "zh_mobile",
                    r"(?<!\d)(?:\+86[ .-]?)?1[3-9]\d[ .-]?\d{4}[ .-]?\d{4}(?!\d)",
                    0.6,
                ),
                PhonePattern(
                    "zh_landline",
                    r"(?<!\d)(?:\+86[ .-]?)?0\d{2,3}[ .-]\d{7,8}(?!\d)",
                    0.5,
                ),
            ),
            context=("电话", "手机", "手机号", "联系", "电话号码", "tel", "phone"),
        ),
    ),
    "ko": LanguageConfig(
        code="ko",
        name="Korean",
        spacy_sm="ko_core_news_sm",
        spacy_lg="ko_core_news_lg",
        hf_ner_model=_HRL,
        # Mobiles are 01X-XXXX-XXXX (010/011/016/017/018/019); +82 replaces
        # the leading 0. Landlines are 02 (Seoul) or 0XX plus 7-8 digits.
        phone=PhoneSpec(
            region="KR",
            patterns=(
                PhonePattern(
                    "kr_mobile",
                    r"(?<!\d)01[016789][ .-]?\d{3,4}[ .-]?\d{4}(?!\d)",
                    0.6,
                ),
                PhonePattern(
                    "kr_prefixed",
                    r"(?<!\d)\+82[ .-]?1[016789][ .-]?\d{3,4}[ .-]?\d{4}(?!\d)",
                    0.6,
                ),
                PhonePattern(
                    "kr_landline",
                    r"(?<!\d)0(?:2|[3-6]\d)[ .-]\d{3,4}[ .-]\d{4}(?!\d)",
                    0.5,
                ),
            ),
            context=("전화", "전화번호", "휴대폰", "핸드폰", "연락처", "tel", "phone"),
        ),
    ),
    "fr": LanguageConfig(
        code="fr",
        name="French",
        spacy_sm="fr_core_news_sm",
        spacy_lg="fr_core_news_lg",
        hf_ner_model=_HRL,
        # Ten digits written as five pairs (06 12 34 56 78); +33 replaces
        # the leading 0.
        phone=PhoneSpec(
            region="FR",
            patterns=(
                PhonePattern(
                    "fr_phone",
                    r"(?<!\d)(?:\+33[ .-]?[1-9]|0[1-9])(?:[ .-]?\d{2}){4}(?!\d)",
                    0.6,
                ),
            ),
            context=(
                "téléphone",
                "telephone",
                "portable",
                "appeler",
                "contact",
                "tél",
                "tel",
                "phone",
            ),
        ),
    ),
    "de": LanguageConfig(
        code="de",
        name="German",
        spacy_sm="de_core_news_sm",
        spacy_lg="de_core_news_lg",
        hf_ner_model=_HRL,
        # Variable-length area codes (2-4 digits after the 0) and bodies;
        # a separator (space, slash, dot or dash) is required without the
        # +49 prefix to keep bare digit runs from matching.
        phone=PhoneSpec(
            region="DE",
            patterns=(
                PhonePattern(
                    "de_prefixed",
                    r"(?<!\d)\+49[ .-]?\d{2,4}[ /.-]?\d{4,8}(?!\d)",
                    0.6,
                ),
                PhonePattern(
                    "de_domestic",
                    r"(?<!\d)0\d{2,4}[ /.-]\d{4,8}(?!\d)",
                    0.5,
                ),
            ),
            context=("telefon", "handy", "anrufen", "kontakt", "rufnummer", "tel", "phone"),
        ),
    ),
    "pt": LanguageConfig(
        code="pt",
        name="Portuguese",
        spacy_sm="pt_core_news_sm",
        spacy_lg="pt_core_news_lg",
        hf_ner_model=_HRL,
        # Nine digits (mobiles 9[1236]X, landlines 2XX) grouped 3-3-3. A
        # bare 9-digit run is too ambiguous, so the fallback requires either
        # the +351 prefix or group separators (mirroring es).
        phone=PhoneSpec(
            region="PT",
            patterns=(
                PhonePattern(
                    "pt_prefixed",
                    r"(?<!\d)\+351[ .-]?(?:9[1236]\d|2\d{2})[ .-]?\d{3}[ .-]?\d{3}(?!\d)",
                    0.6,
                ),
                PhonePattern(
                    "pt_grouped",
                    r"(?<!\d)(?:9[1236]\d|2\d{2})[ .-]\d{3}[ .-]\d{3}(?!\d)",
                    0.6,
                ),
            ),
            context=("telefone", "telemóvel", "telemovel", "ligar", "contacto", "tel", "phone"),
        ),
    ),
    "it": LanguageConfig(
        code="it",
        name="Italian",
        spacy_sm="it_core_news_sm",
        spacy_lg="it_core_news_lg",
        hf_ner_model=_HRL,
        # Mobiles are 3XX plus 6-7 digits (grouped 3-3-4 or 3-3-3);
        # landlines are a 0-prefixed 1-3 digit area code plus 5-8 digits,
        # separator required to keep bare digit runs from matching.
        phone=PhoneSpec(
            region="IT",
            patterns=(
                PhonePattern(
                    "it_mobile",
                    r"(?<!\d)(?:\+39[ .-]?)?3\d{2}[ .-]\d{3}[ .-]\d{3,4}(?!\d)",
                    0.6,
                ),
                PhonePattern(
                    "it_mobile_prefixed",
                    r"(?<!\d)\+39[ .-]?3\d{2}[ .-]?\d{6,7}(?!\d)",
                    0.6,
                ),
                PhonePattern(
                    "it_landline",
                    r"(?<!\d)0\d{1,3}[ .-]\d{5,8}(?!\d)",
                    0.5,
                ),
            ),
            context=("telefono", "cellulare", "chiamare", "contatto", "tel", "phone"),
        ),
    ),
}

#: Display / evaluation order (mirrors the TS registry's ordering).
SUPPORTED_LANGUAGES: tuple[str, ...] = ("ja", "en", "es", "vi", "zh", "ko", "fr", "de", "pt", "it")

if set(SUPPORTED_LANGUAGES) != set(LANGUAGES):  # pragma: no cover - registry drift guard
    raise AssertionError("SUPPORTED_LANGUAGES and LANGUAGES must list the same codes")

#: Languages a default :class:`~prompt_anonymizer.core.PromptAnonymizer` loads models for.
DEFAULT_LANGUAGES: tuple[str, ...] = ("en", "ja")

#: Ordered ``(language, marker regex)`` rules for heuristic language
#: detection, evaluated top to bottom; no match means ``en``. Script-scoped
#: rules (kana, hangul, han) are reliable; the Latin-diacritic rules are
#: best-effort - languages sharing diacritics (fr/it/es/pt accents) can be
#: confused, which is acceptable for a fallback heuristic. Mirrors
#: ``DETECTION_RULES`` in the TS core (``language-detect.ts``), where the
#: browser's built-in LanguageDetector is preferred when available.
DETECTION_RULES: tuple[tuple[str, str], ...] = (
    # Kana is uniquely Japanese; han without kana (checked next) counts as
    # Chinese - kanji-only Japanese fragments are the known blind spot.
    # Include halfwidth katakana (FF61-FF9F); fullwidth-only ranges miss
    # strings such as 「ｶﾀｶﾅﾉﾐ」.
    ("ja", r"[\u3040-\u30ff\uff61-\uff9f]"),
    ("ko", r"[\uac00-\ud7a3\u1100-\u11ff]"),
    ("zh", r"[\u4e00-\u9fff]"),
    # Vietnamese-specific letters (also claims ă/â/ơ/ư before the Latin
    # rules below can).
    ("vi", r"[ăâđơưĂÂĐƠƯ\u01a0\u01a1\u01af\u01b0\u1ea0-\u1ef9]"),
    ("de", r"[ßäöÄÖẞ]"),
    ("pt", r"[ãõÃÕ]"),
    ("es", r"[¿¡ñÑ]"),
    ("fr", r"[œŒêîûëïçÇÊÎÛËÏ]"),
    ("it", r"[èòìàùÈÒÌÀÙ]"),
    # Broad accented-vowel fallback: shared across Romance languages, mapped
    # to es (the most common case historically; fr/it usually match above).
    ("es", r"[áéíóúüÁÉÍÓÚÜ]"),
)
