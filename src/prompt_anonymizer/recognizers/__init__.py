"""Custom Presidio recognizers (Japanese-focused, plus es/vi phone)."""

from prompt_anonymizer.recognizers.credit_card import (
    CreditCardLookaroundRecognizer,
    build_credit_card_recognizers,
)
from prompt_anonymizer.recognizers.es_phone import (
    EsPhoneRegexRecognizer,
    build_es_phone_recognizers,
)
from prompt_anonymizer.recognizers.ja_phone import (
    JaPhoneRegexRecognizer,
    build_ja_phone_recognizers,
)
from prompt_anonymizer.recognizers.ja_postal_code import JaPostalCodeRecognizer
from prompt_anonymizer.recognizers.my_number import MyNumberRecognizer, my_number_check_digit
from prompt_anonymizer.recognizers.us_phone import UsPhoneRegexRecognizer
from prompt_anonymizer.recognizers.us_ssn import (
    UsSsnLookaroundRecognizer,
    build_us_ssn_recognizers,
)
from prompt_anonymizer.recognizers.vn_phone import (
    VnPhoneRegexRecognizer,
    build_vn_phone_recognizers,
)

__all__ = [
    "CreditCardLookaroundRecognizer",
    "EsPhoneRegexRecognizer",
    "JaPhoneRegexRecognizer",
    "JaPostalCodeRecognizer",
    "MyNumberRecognizer",
    "UsPhoneRegexRecognizer",
    "UsSsnLookaroundRecognizer",
    "VnPhoneRegexRecognizer",
    "build_credit_card_recognizers",
    "build_es_phone_recognizers",
    "build_ja_phone_recognizers",
    "build_us_ssn_recognizers",
    "build_vn_phone_recognizers",
    "my_number_check_digit",
]
