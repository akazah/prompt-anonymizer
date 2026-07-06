"""Seeded synthetic document generation with ground-truth PII spans."""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Any

from faker import Faker

from prompt_anonymizer.recognizers.my_number import my_number_check_digit

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


def _my_number(rng: random.Random) -> str:
    """A check-digit-valid 12-digit My Number, bare or hyphenated 4-4-4."""
    body = "".join(str(rng.randint(0, 9)) for _ in range(11))
    number = body + str(my_number_check_digit(body))
    if rng.random() < 0.5:
        return "-".join(number[i : i + 4] for i in range(0, 12, 4))
    return number


def _credit_card(fake: Faker, rng: random.Random) -> str:
    """A Luhn-valid 16-digit Visa number, bare or hyphenated 4-4-4-4."""
    number = fake.credit_card_number(card_type="visa16")
    if rng.random() < 0.5:
        return "-".join(number[i : i + 4] for i in range(0, 16, 4))
    return number


def _build_ja(genre: str, fake: Faker, rng: random.Random, case_id: str) -> GoldenCase:
    b = _Builder()
    name = fake.name()
    name2 = fake.name()
    email = fake.ascii_safe_email()
    phone = _ja_phone(rng)
    postal = _ja_postal(rng)
    city = fake.address().split("\n")[0]

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
        ).lit("。")
    else:
        card = _credit_card(fake, rng)
        my_number = _my_number(rng)
        b.lit("お問い合わせありがとうございます。ご登録のお名前は ").pii(name, "PERSON").lit(
            " 様、ご住所は "
        ).pii(city, "LOCATION").lit(" で間違いないでしょうか。折り返しは ").pii(
            phone, "PHONE_NUMBER"
        ).lit(" までお願いします。お支払いのカード番号は ").pii(card, "CREDIT_CARD").lit(
            " 、ご本人確認のマイナンバーは "
        ).pii(my_number, "JP_MY_NUMBER").lit(" 、控えは ").pii(email, "EMAIL_ADDRESS").lit(
            " に送信済みです。"
        )

    return GoldenCase(id=case_id, language="ja", genre=genre, text=b.text, spans=b.spans)


def _build_en(genre: str, fake: Faker, rng: random.Random, case_id: str) -> GoldenCase:
    b = _Builder()
    name = fake.name()
    name2 = fake.name()
    email = fake.ascii_safe_email()
    phone = _us_phone(rng)
    city = fake.city()

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
        ).lit(". Direct line: ").pii(phone, "PHONE_NUMBER").lit(".")
    else:
        card = _credit_card(fake, rng)
        b.lit("Thank you for contacting support. We have your name as ").pii(name, "PERSON").lit(
            " and your address in "
        ).pii(city, "LOCATION").lit(". We will call you back at ").pii(phone, "PHONE_NUMBER").lit(
            ". The card on file is "
        ).pii(card, "CREDIT_CARD").lit(". A copy was sent to ").pii(email, "EMAIL_ADDRESS").lit(".")

    return GoldenCase(id=case_id, language="en", genre=genre, text=b.text, spans=b.spans)


def generate_cases(language: str, count: int = 200, seed: int = 20260705) -> list[GoldenCase]:
    """Generate ``count`` seeded synthetic cases for ``language``."""
    locale = "ja_JP" if language == "ja" else "en_US"
    fake = Faker(locale)
    fake.seed_instance(seed)
    rng = random.Random(seed)
    build = _build_ja if language == "ja" else _build_en
    return [build(GENRES[i % len(GENRES)], fake, rng, f"{language}-{i:04d}") for i in range(count)]
