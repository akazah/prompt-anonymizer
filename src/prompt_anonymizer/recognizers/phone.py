"""Registry-driven, language-scoped phone recognizers.

One generic recognizer replaces the per-language modules (the former
``es_phone.py`` / ``vn_phone.py``): every language whose
:class:`~prompt_anonymizer.languages.LanguageConfig` defines a
:class:`~prompt_anonymizer.languages.PhoneSpec` gets a libphonenumber-backed
``PhoneRecognizer`` for its region plus a regex fallback for notation
variants the libphonenumber matcher skips. Adding phone support for a new
language is a registry entry, not a new module.

Japanese and US formats stay in their own modules (``ja_phone.py`` /
``us_phone.py``): they are registered for *every* language (phone numbers
travel across language contexts) and the ja recognizer carries a digit-count
validator the generic pattern recognizer does not need.
"""

from __future__ import annotations

from presidio_analyzer import EntityRecognizer, Pattern, PatternRecognizer

from prompt_anonymizer.languages import LANGUAGES, PhoneSpec


class RegistryPhoneRegexRecognizer(PatternRecognizer):
    """Regex fallback for one language's phone notation variants."""

    def __init__(self, language: str, spec: PhoneSpec | None = None) -> None:
        if spec is None:
            config = LANGUAGES.get(language)
            if config is None or config.phone is None:
                raise ValueError(f"no phone spec registered for language '{language}'")
            spec = config.phone
        super().__init__(
            supported_entity="PHONE_NUMBER",
            patterns=[Pattern(p.name, p.regex, p.score) for p in spec.patterns],
            context=list(spec.context),
            supported_language=language,
            name=f"PhoneRegexRecognizer_{language}",
        )


def build_phone_regex_recognizer(language: str) -> RegistryPhoneRegexRecognizer | None:
    """The regex-only phone recognizer for ``language`` (``None`` when the
    registry defines no phone spec). Used by the engine-free ``scan`` path."""
    config = LANGUAGES.get(language)
    if config is None or config.phone is None:
        return None
    return RegistryPhoneRegexRecognizer(language, config.phone)


def build_phone_recognizers(language: str) -> list[EntityRecognizer]:
    """Recognizers to register on ``language``'s pipeline for PHONE_NUMBER.

    Empty for languages without a registry phone spec (en / ja, which are
    covered by the cross-language recognizers instead).
    """
    from presidio_analyzer.predefined_recognizers import PhoneRecognizer

    config = LANGUAGES.get(language)
    if config is None or config.phone is None:
        return []
    spec = config.phone
    return [
        PhoneRecognizer(
            supported_language=language,
            supported_regions=(spec.region,),
            context=list(spec.context),
        ),
        RegistryPhoneRegexRecognizer(language, spec),
    ]
