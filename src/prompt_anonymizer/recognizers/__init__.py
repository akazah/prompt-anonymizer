"""Custom Presidio recognizers.

Language-scoped phone recognizers are registry-driven (``phone.py``, one
entry per language in :mod:`prompt_anonymizer.languages`); ja/us phone,
JP postal code / My Number, credit card and SSN recognizers are bespoke
modules registered across languages.
"""

from prompt_anonymizer.recognizers.credit_card import (
    CreditCardLookaroundRecognizer,
    build_credit_card_recognizers,
)
from prompt_anonymizer.recognizers.gliner_ner import (
    DEFAULT_GLINER_MODELS,
    GlinerModelSpec,
    build_gliner_recognizer,
)
from prompt_anonymizer.recognizers.ja_phone import (
    JaPhoneRegexRecognizer,
    build_ja_phone_recognizers,
)
from prompt_anonymizer.recognizers.ja_postal_code import JaPostalCodeRecognizer
from prompt_anonymizer.recognizers.my_number import MyNumberRecognizer, my_number_check_digit
from prompt_anonymizer.recognizers.phone import (
    RegistryPhoneRegexRecognizer,
    build_phone_recognizers,
    build_phone_regex_recognizer,
)
from prompt_anonymizer.recognizers.us_phone import UsPhoneRegexRecognizer
from prompt_anonymizer.recognizers.us_ssn import (
    UsSsnLookaroundRecognizer,
    build_us_ssn_recognizers,
)

__all__ = [
    "DEFAULT_GLINER_MODELS",
    "CreditCardLookaroundRecognizer",
    "GlinerModelSpec",
    "JaPhoneRegexRecognizer",
    "JaPostalCodeRecognizer",
    "MyNumberRecognizer",
    "RegistryPhoneRegexRecognizer",
    "UsPhoneRegexRecognizer",
    "UsSsnLookaroundRecognizer",
    "build_credit_card_recognizers",
    "build_gliner_recognizer",
    "build_ja_phone_recognizers",
    "build_phone_recognizers",
    "build_phone_regex_recognizer",
    "build_us_ssn_recognizers",
    "my_number_check_digit",
]
