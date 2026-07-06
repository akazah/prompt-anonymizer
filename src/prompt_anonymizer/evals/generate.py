"""Seeded synthetic document generation with ground-truth PII spans."""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Any

from faker import Faker

GENRES = ("request", "minutes", "inquiry")


@dataclass(frozen=True)
class GoldenSpan:
    start: int
    end: int
    entity_type: str
    value: str


@dataclass
class GoldenCase:
    id: str
    language: str
    genre: str
    text: str
    spans: list[GoldenSpan] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "language": self.language,
            "genre": self.genre,
            "text": self.text,
            "spans": [
                {
                    "start": s.start,
                    "end": s.end,
                    "entity_type": s.entity_type,
                    "value": s.value,
                }
                for s in self.spans
            ],
        }


class _Builder:
    """Concatenates literal text and PII slots while tracking offsets."""

    def __init__(self) -> None:
        self._parts: list[str] = []
        self._length = 0
        self.spans: list[GoldenSpan] = []

    def lit(self, text: str) -> _Builder:
        self._parts.append(text)
        self._length += len(text)
        return self

    def pii(self, value: str, entity_type: str) -> _Builder:
        self.spans.append(
            GoldenSpan(
                start=self._length,
                end=self._length + len(value),
                entity_type=entity_type,
                value=value,
            )
        )
        return self.lit(value)

    @property
    def text(self) -> str:
        return "".join(self._parts)


def _ja_phone(rng: random.Random) -> str:
    kind = rng.choice(["mobile", "landline", "tollfree"])
    if kind == "mobile":
        return f"0{rng.choice('789')}0-{rng.randint(1000, 9999)}-{rng.randint(1000, 9999)}"
    if kind == "tollfree":
        return f"0120-{rng.randint(100, 999)}-{rng.randint(100, 999)}"
    return f"03-{rng.randint(1000, 9999)}-{rng.randint(1000, 9999)}"


def _ja_postal(rng: random.Random) -> str:
    return f"〒{rng.randint(100, 999)}-{rng.randint(1000, 9999):04d}"


def _us_phone(rng: random.Random) -> str:
    return f"({rng.randint(201, 989)}) {rng.randint(200, 999)}-{rng.randint(1000, 9999)}"


def _es_phone(rng: random.Random) -> str:
    kind = rng.choice(["mobile", "mobile_prefixed", "landline"])
    if kind == "landline":
        return (
            f"9{rng.randint(1, 8)} {rng.randint(100, 999)} "
            f"{rng.randint(10, 99)} {rng.randint(10, 99)}"
        )
    mobile = (
        f"{rng.choice('67')}{rng.randint(10, 99)} "
        f"{rng.randint(100, 999)} {rng.randint(100, 999)}"
    )
    return mobile if kind == "mobile" else f"+34 {mobile}"


def _vn_phone(rng: random.Random) -> str:
    kind = rng.choice(["mobile_433", "mobile_334", "mobile_prefixed"])
    if kind == "mobile_334":
        return (
            f"0{rng.choice('35789')}{rng.randint(1, 9)} "
            f"{rng.randint(100, 999)} {rng.randint(1000, 9999)}"
        )
    mobile = (
        f"{rng.choice('35789')}{rng.randint(10, 99)} "
        f"{rng.randint(100, 999)} {rng.randint(100, 999)}"
    )
    if kind == "mobile_433":
        return f"0{mobile}"
    return f"+84 {mobile}"


# Faker's vi_VN city/address providers emit malformed values ("JaneThị xã"),
# so LOCATION slots draw from a curated list of real Vietnamese cities.
_VN_CITIES = (
    "Hà Nội",
    "Thành phố Hồ Chí Minh",
    "Đà Nẵng",
    "Hải Phòng",
    "Cần Thơ",
    "Huế",
    "Nha Trang",
    "Đà Lạt",
    "Vũng Tàu",
    "Biên Hòa",
)


def _credit_card(fake: Faker, rng: random.Random) -> str:
    """A Luhn-valid 16-digit Visa number, bare or hyphenated 4-4-4-4."""
    number = fake.credit_card_number(card_type="visa16")
    if rng.random() < 0.5:
        return "-".join(number[i : i + 4] for i in range(0, 16, 4))
    return number


def _mod97_digits(num_str: str) -> int:
    remainder = 0
    for ch in num_str:
        remainder = (remainder * 10 + int(ch)) % 97
    return remainder


def _us_ssn(fake: Faker) -> str:
    """A valid-format US SSN from Faker, rejecting known-invalid groups."""
    for _ in range(100):
        ssn = fake.ssn()
        area, group, serial = ssn.split("-")
        if area in ("000", "666") or area.startswith("9"):
            continue
        if group == "00" or serial == "0000":
            continue
        return ssn
    return fake.ssn()


def _iban(rng: random.Random) -> str:
    """A valid German IBAN (DE + mod-97 check digits + 18-digit BBAN)."""
    bban = "".join(str(rng.randint(0, 9)) for _ in range(18))
    rearranged = bban + "DE" + "00"
    digits = "".join(ch if ch.isdigit() else str(ord(ch) - ord("A") + 10) for ch in rearranged)
    check = 98 - _mod97_digits(digits)
    iban = f"DE{check:02d}{bban}"
    if rng.random() < 0.5:
        return " ".join(iban[i : i + 4] for i in range(0, len(iban), 4))
    return iban


def _build_ja(genre: str, fake: Faker, rng: random.Random, case_id: str) -> GoldenCase:
    b = _Builder()
    name = fake.name()
    name2 = fake.name()
    email = fake.ascii_safe_email()
    phone = _ja_phone(rng)
    postal = _ja_postal(rng)
    city = fake.address().split("\n")[0]
    iban = _iban(rng)

    if genre == "request":
        b.lit("お世話になっております。").pii(name, "PERSON").lit(
            "と申します。来月の打ち合わせについて相談させてください。"
        ).lit("会場は").pii(city, "LOCATION").lit("を予定しています。連絡先は ").pii(
            phone, "PHONE_NUMBER"
        ).lit("、メールは ").pii(email, "EMAIL_ADDRESS").lit(" です。よろしくお願いいたします。")
    elif genre == "minutes":
        b.lit("【議事録】出席者: ").pii(name, "PERSON").lit("、").pii(name2, "PERSON").lit(
            "。次回会場の住所は "
        ).pii(postal, "JP_POSTAL_CODE").lit(" ").pii(city, "LOCATION").lit(
            "。決定事項: 資料は "
        ).pii(email, "EMAIL_ADDRESS").lit(" へ送付する。担当者直通は ").pii(
            phone, "PHONE_NUMBER"
        ).lit("。経費精算の振込先は ").pii(iban, "IBAN_CODE").lit("。")
    else:
        card = _credit_card(fake, rng)
        b.lit("お問い合わせありがとうございます。ご登録のお名前は ").pii(name, "PERSON").lit(
            " 様、ご住所は "
        ).pii(city, "LOCATION").lit(" で間違いないでしょうか。折り返しは ").pii(
            phone, "PHONE_NUMBER"
        ).lit(" までお願いします。お支払いのカード番号は ").pii(card, "CREDIT_CARD").lit(
            " 、控えは "
        ).pii(email, "EMAIL_ADDRESS").lit(" に送信済みです。")

    return GoldenCase(id=case_id, language="ja", genre=genre, text=b.text, spans=b.spans)


def _build_en(genre: str, fake: Faker, rng: random.Random, case_id: str) -> GoldenCase:
    b = _Builder()
    name = fake.name()
    name2 = fake.name()
    email = fake.ascii_safe_email()
    phone = _us_phone(rng)
    city = fake.city()
    ssn = _us_ssn(fake)
    iban = _iban(rng)

    if genre == "request":
        b.lit("Hi, my name is ").pii(name, "PERSON").lit(
            ". I'd like to schedule a meeting next month. The venue will be in "
        ).pii(city, "LOCATION").lit(". You can reach me at ").pii(phone, "PHONE_NUMBER").lit(
            " or "
        ).pii(email, "EMAIL_ADDRESS").lit(". Thanks!")
    elif genre == "minutes":
        b.lit("[Minutes] Attendees: ").pii(name, "PERSON").lit(" and ").pii(name2, "PERSON").lit(
            ". Next meeting will be held in "
        ).pii(city, "LOCATION").lit(". Action item: send the deck to ").pii(
            email, "EMAIL_ADDRESS"
        ).lit(". Direct line: ").pii(phone, "PHONE_NUMBER").lit(". Payroll: SSN ").pii(
            ssn, "US_SSN"
        ).lit(", reimbursement IBAN ").pii(iban, "IBAN_CODE").lit(".")
    else:
        card = _credit_card(fake, rng)
        b.lit("Thank you for contacting support. We have your name as ").pii(name, "PERSON").lit(
            " and your address in "
        ).pii(city, "LOCATION").lit(". We will call you back at ").pii(phone, "PHONE_NUMBER").lit(
            ". The card on file is "
        ).pii(card, "CREDIT_CARD").lit(". A copy was sent to ").pii(email, "EMAIL_ADDRESS").lit(".")

    return GoldenCase(id=case_id, language="en", genre=genre, text=b.text, spans=b.spans)


def _build_es(genre: str, fake: Faker, rng: random.Random, case_id: str) -> GoldenCase:
    b = _Builder()
    name = fake.name()
    name2 = fake.name()
    email = fake.ascii_safe_email()
    phone = _es_phone(rng)
    city = fake.city()

    if genre == "request":
        b.lit("Buenos días, me llamo ").pii(name, "PERSON").lit(
            ". Me gustaría programar una reunión el próximo mes. El lugar será "
        ).pii(city, "LOCATION").lit(". Puede llamarme al ").pii(phone, "PHONE_NUMBER").lit(
            " o escribirme a "
        ).pii(email, "EMAIL_ADDRESS").lit(". ¡Gracias!")
    elif genre == "minutes":
        b.lit("[Acta] Asistentes: ").pii(name, "PERSON").lit(" y ").pii(name2, "PERSON").lit(
            ". La próxima reunión será en "
        ).pii(city, "LOCATION").lit(". Tarea pendiente: enviar la presentación a ").pii(
            email, "EMAIL_ADDRESS"
        ).lit(". Línea directa: ").pii(phone, "PHONE_NUMBER").lit(".")
    else:
        card = _credit_card(fake, rng)
        b.lit("Gracias por contactar con soporte. Su nombre registrado es ").pii(
            name, "PERSON"
        ).lit(" y su dirección está en ").pii(city, "LOCATION").lit(
            ". Le devolveremos la llamada al "
        ).pii(phone, "PHONE_NUMBER").lit(". La tarjeta registrada es ").pii(
            card, "CREDIT_CARD"
        ).lit(". Se envió una copia a ").pii(email, "EMAIL_ADDRESS").lit(".")

    return GoldenCase(id=case_id, language="es", genre=genre, text=b.text, spans=b.spans)


def _build_vi(genre: str, fake: Faker, rng: random.Random, case_id: str) -> GoldenCase:
    b = _Builder()
    name = fake.name()
    name2 = fake.name()
    email = fake.ascii_safe_email()
    phone = _vn_phone(rng)
    city = rng.choice(_VN_CITIES)

    if genre == "request":
        b.lit("Xin chào, tôi tên là ").pii(name, "PERSON").lit(
            ". Tôi muốn đặt lịch họp vào tháng tới. Địa điểm dự kiến tại "
        ).pii(city, "LOCATION").lit(". Vui lòng liên hệ với tôi qua số ").pii(
            phone, "PHONE_NUMBER"
        ).lit(" hoặc email ").pii(email, "EMAIL_ADDRESS").lit(". Xin cảm ơn!")
    elif genre == "minutes":
        b.lit("[Biên bản] Người tham dự: ").pii(name, "PERSON").lit(" và ").pii(
            name2, "PERSON"
        ).lit(". Cuộc họp tiếp theo sẽ diễn ra tại ").pii(city, "LOCATION").lit(
            ". Việc cần làm: gửi tài liệu tới "
        ).pii(email, "EMAIL_ADDRESS").lit(". Số máy trực tiếp: ").pii(phone, "PHONE_NUMBER").lit(
            "."
        )
    else:
        card = _credit_card(fake, rng)
        b.lit("Cảm ơn bạn đã liên hệ bộ phận hỗ trợ. Tên đăng ký của bạn là ").pii(
            name, "PERSON"
        ).lit(", địa chỉ tại ").pii(city, "LOCATION").lit(
            ". Chúng tôi sẽ gọi lại cho bạn qua số "
        ).pii(phone, "PHONE_NUMBER").lit(". Thẻ thanh toán đã đăng ký là ").pii(
            card, "CREDIT_CARD"
        ).lit(". Bản sao đã được gửi tới ").pii(email, "EMAIL_ADDRESS").lit(".")

    return GoldenCase(id=case_id, language="vi", genre=genre, text=b.text, spans=b.spans)


_LOCALES = {"ja": "ja_JP", "en": "en_US", "es": "es_ES", "vi": "vi_VN"}
_BUILDERS = {"ja": _build_ja, "en": _build_en, "es": _build_es, "vi": _build_vi}


def generate_cases(language: str, count: int = 200, seed: int = 20260705) -> list[GoldenCase]:
    """Generate ``count`` seeded synthetic cases for ``language``."""
    if language not in _BUILDERS:
        raise ValueError(f"no golden builder for language '{language}'")
    fake = Faker(_LOCALES[language])
    fake.seed_instance(seed)
    rng = random.Random(seed)
    build = _BUILDERS[language]
    return [build(GENRES[i % len(GENRES)], fake, rng, f"{language}-{i:04d}") for i in range(count)]
