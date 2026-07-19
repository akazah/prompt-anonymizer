"""Seeded synthetic document generation with ground-truth PII spans."""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Any

from faker import Faker

from prompt_anonymizer.languages import LANGUAGES
from prompt_anonymizer.recognizers.my_number import my_number_check_digit

GENRES = ("request", "minutes", "inquiry")

# Ground-truth entity types for name-part spans (see labels/<lang>.yaml keys).
_NAME_PART_ENTITY = {
    "first": "PERSON_FIRST_NAME",
    "middle": "PERSON_MIDDLE_NAME",
    "last": "PERSON_LAST_NAME",
}


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

    def pii_person(self, parts: list[tuple[str, str]]) -> _Builder:
        """Insert a whitespace-separated PERSON span with per-part ground truth."""
        name = " ".join(value for _, value in parts)
        start = self._length
        self.spans.append(
            GoldenSpan(
                start=start,
                end=start + len(name),
                entity_type="PERSON",
                value=name,
            )
        )
        offset = start
        for i, (part_key, value) in enumerate(parts):
            if i > 0:
                offset += 1  # space between tokens
            self.spans.append(
                GoldenSpan(
                    start=offset,
                    end=offset + len(value),
                    entity_type=_NAME_PART_ENTITY[part_key],
                    value=value,
                )
            )
            offset += len(value)
        return self.lit(name)

    @property
    def text(self) -> str:
        return "".join(self._parts)


def _single_token(fake: Faker, rng: random.Random, draw: Any) -> str:
    """Return a one-token name; Faker locales sometimes emit multi-word parts."""
    for _ in range(30):
        value = str(draw())
        if value and " " not in value.strip():
            return value.strip()
    return str(draw()).split()[0]


def _person_parts(fake: Faker, rng: random.Random, language: str) -> list[tuple[str, str]]:
    """Compose a splittable full name with known first / middle / last parts.

    Uses Faker's ``first_name`` / ``last_name`` (not ``name()``) so the golden
    set can record exact part boundaries for name-splitting accuracy metrics.
    Parts are ordered in the language's native name order
    (``family_name_first`` from :data:`LANGUAGES`). Each part is one token so
    the ground truth matches the whitespace-based ``split_person_name`` heuristic.
    """
    family_first = LANGUAGES[language].family_name_first
    first = _single_token(fake, rng, fake.first_name)
    last = _single_token(fake, rng, fake.last_name)
    if family_first:
        parts: list[tuple[str, str]] = [("last", last), ("first", first)]
        if rng.random() < 0.15:
            middle = _single_token(fake, rng, fake.first_name)
            parts = [("last", last), ("middle", middle), ("first", first)]
    else:
        parts = [("first", first), ("last", last)]
        if rng.random() < 0.25:
            middle = _single_token(fake, rng, fake.first_name)
            parts = [("first", first), ("middle", middle), ("last", last)]
    return parts


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


def _es_phone(rng: random.Random) -> str:
    kind = rng.choice(["mobile", "mobile_prefixed", "landline"])
    if kind == "landline":
        return (
            f"9{rng.randint(1, 8)} {rng.randint(100, 999)} "
            f"{rng.randint(10, 99)} {rng.randint(10, 99)}"
        )
    mobile = (
        f"{rng.choice('67')}{rng.randint(10, 99)} {rng.randint(100, 999)} {rng.randint(100, 999)}"
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


def _zh_phone(rng: random.Random) -> str:
    kind = rng.choice(["mobile", "mobile_grouped", "mobile_prefixed"])
    mobile = f"1{rng.choice('3456789')}{rng.randint(0, 9)}"
    body = f"{rng.randint(0, 9999):04d}"
    tail = f"{rng.randint(0, 9999):04d}"
    if kind == "mobile":
        return f"{mobile}{body}{tail}"
    if kind == "mobile_grouped":
        return f"{mobile} {body} {tail}"
    return f"+86 {mobile}-{body}-{tail}"


def _ko_phone(rng: random.Random) -> str:
    kind = rng.choice(["mobile", "mobile_bare", "mobile_prefixed"])
    body = f"{rng.randint(1000, 9999)}-{rng.randint(1000, 9999)}"
    if kind == "mobile":
        return f"010-{body}"
    if kind == "mobile_bare":
        return f"010{body.replace('-', '')}"
    return f"+82 10-{body}"


def _fr_phone(rng: random.Random) -> str:
    pairs = " ".join(f"{rng.randint(0, 99):02d}" for _ in range(4))
    head = rng.choice("167")
    if rng.random() < 0.5:
        return f"0{head} {pairs}"
    return f"+33 {head} {pairs}"


def _de_phone(rng: random.Random) -> str:
    # Bodies stay <= 7 digits so a 4-digit area code can never form a
    # 12-digit run: those occasionally pass the My Number check digit and
    # would be (correctly, but confusingly) masked as JP_MY_NUMBER.
    kind = rng.choice(["mobile", "landline", "prefixed"])
    if kind == "mobile":
        return f"01{rng.choice('567')}{rng.randint(0, 9)} {rng.randint(1000000, 9999999)}"
    if kind == "landline":
        return f"0{rng.randint(30, 999)} {rng.randint(100000, 9999999)}"
    return f"+49 {rng.randint(30, 999)} {rng.randint(100000, 9999999)}"


def _pt_phone(rng: random.Random) -> str:
    kind = rng.choice(["mobile", "mobile_prefixed", "landline"])
    mobile = (
        f"9{rng.choice('1236')}{rng.randint(0, 9)} {rng.randint(100, 999)} {rng.randint(100, 999)}"
    )
    if kind == "mobile":
        return mobile
    if kind == "mobile_prefixed":
        return f"+351 {mobile}"
    return f"2{rng.randint(10, 99)} {rng.randint(100, 999)} {rng.randint(100, 999)}"


def _it_phone(rng: random.Random) -> str:
    kind = rng.choice(["mobile", "mobile_prefixed", "landline"])
    mobile = f"3{rng.randint(10, 99)} {rng.randint(100, 999)} {rng.randint(1000, 9999)}"
    if kind == "mobile":
        return mobile
    if kind == "mobile_prefixed":
        return f"+39 {mobile}"
    return f"0{rng.randint(2, 99)} {rng.randint(10000, 99999999)}"


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


# Faker's it_IT city provider is not deterministic across processes (its
# output depends on hash randomization), which would break the seeded golden
# set; LOCATION slots draw from a curated list of real Italian cities.
_IT_CITIES = (
    "Roma",
    "Milano",
    "Napoli",
    "Torino",
    "Palermo",
    "Genova",
    "Bologna",
    "Firenze",
    "Venezia",
    "Verona",
)


def _credit_card(fake: Faker, rng: random.Random) -> str:
    """A Luhn-valid 16-digit Visa number, bare or hyphenated 4-4-4-4."""
    try:
        number = fake.credit_card_number(card_type="visa16")
    except KeyError:
        # Some locale providers (zh_CN, pt_PT) replace the standard card
        # table; their "visa" type also yields 16-digit Luhn-valid numbers.
        number = fake.credit_card_number(card_type="visa")
        while len(number) != 16:  # pragma: no cover - locale-dependent
            number = fake.credit_card_number(card_type="visa")
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
    name = _person_parts(fake, rng, "ja")
    name2 = _person_parts(fake, rng, "ja")
    email = fake.ascii_safe_email()
    phone = _ja_phone(rng)
    postal = _ja_postal(rng)
    city = fake.address().split("\n")[0]
    iban = _iban(rng)

    if genre == "request":
        b.lit("お世話になっております。").pii_person(name).lit(
            "と申します。来月の打ち合わせについて相談させてください。"
        ).lit("会場は").pii(city, "LOCATION").lit("を予定しています。連絡先は ").pii(
            phone, "PHONE_NUMBER"
        ).lit("、メールは ").pii(email, "EMAIL_ADDRESS").lit(" です。よろしくお願いいたします。")
    elif genre == "minutes":
        b.lit("【議事録】出席者: ").pii_person(name).lit("、").pii_person(name2).lit(
            "。次回会場の住所は "
        ).pii(postal, "JP_POSTAL_CODE").lit(" ").pii(city, "LOCATION").lit(
            "。決定事項: 資料は "
        ).pii(email, "EMAIL_ADDRESS").lit(" へ送付する。担当者直通は ").pii(
            phone, "PHONE_NUMBER"
        ).lit("。経費精算の振込先は ").pii(iban, "IBAN_CODE").lit("。")
    else:
        card = _credit_card(fake, rng)
        my_number = _my_number(rng)
        b.lit("お問い合わせありがとうございます。ご登録のお名前は ").pii_person(name).lit(
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
    name = _person_parts(fake, rng, "en")
    name2 = _person_parts(fake, rng, "en")
    email = fake.ascii_safe_email()
    phone = _us_phone(rng)
    city = fake.city()
    ssn = _us_ssn(fake)
    iban = _iban(rng)

    if genre == "request":
        b.lit("Hi, my name is ").pii_person(name).lit(
            ". I'd like to schedule a meeting next month. The venue will be in "
        ).pii(city, "LOCATION").lit(". You can reach me at ").pii(phone, "PHONE_NUMBER").lit(
            " or "
        ).pii(email, "EMAIL_ADDRESS").lit(". Thanks!")
    elif genre == "minutes":
        b.lit("[Minutes] Attendees: ").pii_person(name).lit(" and ").pii_person(name2).lit(
            ". Next meeting will be held in "
        ).pii(city, "LOCATION").lit(". Action item: send the deck to ").pii(
            email, "EMAIL_ADDRESS"
        ).lit(". Direct line: ").pii(phone, "PHONE_NUMBER").lit(". Payroll: SSN ").pii(
            ssn, "US_SSN"
        ).lit(", reimbursement IBAN ").pii(iban, "IBAN_CODE").lit(".")
    else:
        card = _credit_card(fake, rng)
        b.lit("Thank you for contacting support. We have your name as ").pii_person(name).lit(
            " and your address in "
        ).pii(city, "LOCATION").lit(". We will call you back at ").pii(phone, "PHONE_NUMBER").lit(
            ". The card on file is "
        ).pii(card, "CREDIT_CARD").lit(". A copy was sent to ").pii(email, "EMAIL_ADDRESS").lit(".")

    return GoldenCase(id=case_id, language="en", genre=genre, text=b.text, spans=b.spans)


@dataclass(frozen=True)
class _GenericSpec:
    """Phrase table for the template-driven builder.

    ja / en keep bespoke builders (they exercise extra entity types:
    JP postal / My Number, US SSN, IBAN); every other language is three
    genre templates instantiated from this table, so adding golden-set
    support for a new language is one spec plus a phone generator.
    """

    phone: Any  # Callable[[random.Random], str]
    # (intro, after_name, after_city, after_phone, closing) for "request"
    request: tuple[str, str, str, str, str]
    # (header, between_names, venue, send_to, direct_line, tail) for "minutes"
    minutes: tuple[str, str, str, str, str, str]
    # (intro, address, callback, card, copy, tail) for "inquiry"
    inquiry: tuple[str, str, str, str, str, str]
    # Some Faker locales have unusable city providers; draw from a curated
    # list instead when set.
    cities: tuple[str, ...] | None = None


_GENERIC_SPECS: dict[str, _GenericSpec] = {
    "es": _GenericSpec(
        phone=_es_phone,
        request=(
            "Buenos días, me llamo ",
            ". Me gustaría programar una reunión el próximo mes. El lugar será ",
            ". Puede llamarme al ",
            " o escribirme a ",
            ". ¡Gracias!",
        ),
        minutes=(
            "[Acta] Asistentes: ",
            " y ",
            ". La próxima reunión será en ",
            ". Tarea pendiente: enviar la presentación a ",
            ". Línea directa: ",
            ".",
        ),
        inquiry=(
            "Gracias por contactar con soporte. Su nombre registrado es ",
            " y su dirección está en ",
            ". Le devolveremos la llamada al ",
            ". La tarjeta registrada es ",
            ". Se envió una copia a ",
            ".",
        ),
    ),
    "vi": _GenericSpec(
        phone=_vn_phone,
        request=(
            "Xin chào, tôi tên là ",
            ". Tôi muốn đặt lịch họp vào tháng tới. Địa điểm dự kiến tại ",
            ". Vui lòng liên hệ với tôi qua số ",
            " hoặc email ",
            ". Xin cảm ơn!",
        ),
        minutes=(
            "[Biên bản] Người tham dự: ",
            " và ",
            ". Cuộc họp tiếp theo sẽ diễn ra tại ",
            ". Việc cần làm: gửi tài liệu tới ",
            ". Số máy trực tiếp: ",
            ".",
        ),
        inquiry=(
            "Cảm ơn bạn đã liên hệ bộ phận hỗ trợ. Tên đăng ký của bạn là ",
            ", địa chỉ tại ",
            ". Chúng tôi sẽ gọi lại cho bạn qua số ",
            ". Thẻ thanh toán đã đăng ký là ",
            ". Bản sao đã được gửi tới ",
            ".",
        ),
        cities=_VN_CITIES,
    ),
    "zh": _GenericSpec(
        phone=_zh_phone,
        request=(
            "您好，我叫",
            "。我想安排下个月的会议，地点定在",
            "。请拨打 ",
            " 联系我，或发邮件至 ",
            "。谢谢！",
        ),
        minutes=(
            "【会议纪要】出席者：",
            "、",
            "。下次会议将在",
            "举行。待办事项：请将资料发送至 ",
            "。直线电话：",
            "。",
        ),
        inquiry=(
            "感谢您联系客服。您登记的姓名是",
            "，地址位于",
            "。我们将回拨 ",
            "。登记的银行卡号为 ",
            "。副本已发送至 ",
            "。",
        ),
    ),
    "ko": _GenericSpec(
        phone=_ko_phone,
        request=(
            "안녕하세요, 제 이름은 ",
            "입니다. 다음 달 회의를 잡고 싶습니다. 장소는 ",
            "입니다. 연락처는 ",
            " 이고, 이메일은 ",
            " 입니다. 감사합니다!",
        ),
        minutes=(
            "[회의록] 참석자: ",
            ", ",
            ". 다음 회의 장소는 ",
            ". 할 일: 자료를 ",
            " 로 보낼 것. 직통 전화: ",
            ".",
        ),
        inquiry=(
            "문의해 주셔서 감사합니다. 등록된 성함은 ",
            " 님이고, 주소는 ",
            " 입니다. 회신 전화는 ",
            " 로 드리겠습니다. 등록된 카드 번호는 ",
            " 입니다. 사본은 ",
            " 로 발송되었습니다.",
        ),
    ),
    "fr": _GenericSpec(
        phone=_fr_phone,
        request=(
            "Bonjour, je m'appelle ",
            ". Je souhaite organiser une réunion le mois prochain. Le lieu sera ",
            ". Vous pouvez me joindre au ",
            " ou m'écrire à ",
            ". Merci !",
        ),
        minutes=(
            "[Compte rendu] Participants : ",
            " et ",
            ". La prochaine réunion aura lieu à ",
            ". À faire : envoyer la présentation à ",
            ". Ligne directe : ",
            ".",
        ),
        inquiry=(
            "Merci d'avoir contacté le support. Votre nom enregistré est ",
            " et votre adresse se trouve à ",
            ". Nous vous rappellerons au ",
            ". La carte enregistrée est ",
            ". Une copie a été envoyée à ",
            ".",
        ),
    ),
    "de": _GenericSpec(
        phone=_de_phone,
        request=(
            "Guten Tag, mein Name ist ",
            ". Ich möchte für nächsten Monat ein Treffen vereinbaren. Der Ort wird ",
            " sein. Sie erreichen mich unter ",
            " oder per E-Mail an ",
            ". Vielen Dank!",
        ),
        minutes=(
            "[Protokoll] Teilnehmer: ",
            " und ",
            ". Das nächste Treffen findet in ",
            " statt. Aufgabe: Unterlagen senden an ",
            ". Durchwahl: ",
            ".",
        ),
        inquiry=(
            "Vielen Dank für Ihre Anfrage. Ihr registrierter Name ist ",
            " und Ihre Adresse liegt in ",
            ". Wir rufen Sie zurück unter ",
            ". Die hinterlegte Karte ist ",
            ". Eine Kopie wurde gesendet an ",
            ".",
        ),
    ),
    "pt": _GenericSpec(
        phone=_pt_phone,
        request=(
            "Bom dia, chamo-me ",
            ". Gostaria de agendar uma reunião no próximo mês. O local será ",
            ". Pode ligar-me para o ",
            " ou escrever para ",
            ". Obrigado!",
        ),
        minutes=(
            "[Ata] Participantes: ",
            " e ",
            ". A próxima reunião será em ",
            ". Tarefa: enviar a apresentação para ",
            ". Linha direta: ",
            ".",
        ),
        inquiry=(
            "Obrigado por contactar o suporte. O seu nome registado é ",
            " e a sua morada fica em ",
            ". Vamos ligar de volta para o ",
            ". O cartão registado é ",
            ". Foi enviada uma cópia para ",
            ".",
        ),
    ),
    "it": _GenericSpec(
        phone=_it_phone,
        cities=_IT_CITIES,
        request=(
            "Buongiorno, mi chiamo ",
            ". Vorrei fissare una riunione il mese prossimo. Il luogo sarà ",
            ". Può chiamarmi al ",
            " o scrivermi a ",
            ". Grazie!",
        ),
        minutes=(
            "[Verbale] Partecipanti: ",
            " e ",
            ". La prossima riunione si terrà a ",
            ". Da fare: inviare la presentazione a ",
            ". Linea diretta: ",
            ".",
        ),
        inquiry=(
            "Grazie per aver contattato l'assistenza. Il nome registrato è ",
            " e il suo indirizzo si trova a ",
            ". La richiameremo al ",
            ". La carta registrata è ",
            ". Una copia è stata inviata a ",
            ".",
        ),
    ),
}


def _build_generic(
    language: str, genre: str, fake: Faker, rng: random.Random, case_id: str
) -> GoldenCase:
    spec = _GENERIC_SPECS[language]
    b = _Builder()
    name = _person_parts(fake, rng, language)
    name2 = _person_parts(fake, rng, language)
    email = fake.ascii_safe_email()
    phone = spec.phone(rng)
    city = rng.choice(spec.cities) if spec.cities is not None else fake.city()

    if genre == "request":
        intro, after_name, after_city, after_phone, closing = spec.request
        b.lit(intro).pii_person(name).lit(after_name).pii(city, "LOCATION").lit(after_city).pii(
            phone, "PHONE_NUMBER"
        ).lit(after_phone).pii(email, "EMAIL_ADDRESS").lit(closing)
    elif genre == "minutes":
        header, between, venue, send_to, direct, tail = spec.minutes
        b.lit(header).pii_person(name).lit(between).pii_person(name2).lit(venue).pii(
            city, "LOCATION"
        ).lit(send_to).pii(email, "EMAIL_ADDRESS").lit(direct).pii(phone, "PHONE_NUMBER").lit(tail)
    else:
        card = _credit_card(fake, rng)
        intro, address, callback, card_phrase, copy_phrase, tail = spec.inquiry
        b.lit(intro).pii_person(name).lit(address).pii(city, "LOCATION").lit(callback).pii(
            phone, "PHONE_NUMBER"
        ).lit(card_phrase).pii(card, "CREDIT_CARD").lit(copy_phrase).pii(
            email, "EMAIL_ADDRESS"
        ).lit(tail)

    return GoldenCase(id=case_id, language=language, genre=genre, text=b.text, spans=b.spans)


_LOCALES = {
    "ja": "ja_JP",
    "en": "en_US",
    "es": "es_ES",
    "vi": "vi_VN",
    "zh": "zh_CN",
    "ko": "ko_KR",
    "fr": "fr_FR",
    "de": "de_DE",
    "pt": "pt_PT",
    "it": "it_IT",
}
_BESPOKE_BUILDERS = {"ja": _build_ja, "en": _build_en}


def generate_cases(language: str, count: int = 200, seed: int = 20260705) -> list[GoldenCase]:
    """Generate ``count`` seeded synthetic cases for ``language``."""
    if language not in _LOCALES:
        raise ValueError(f"no golden builder for language '{language}'")
    fake = Faker(_LOCALES[language])
    fake.seed_instance(seed)
    rng = random.Random(seed)
    bespoke = _BESPOKE_BUILDERS.get(language)
    if bespoke is not None:
        return [
            bespoke(GENRES[i % len(GENRES)], fake, rng, f"{language}-{i:04d}") for i in range(count)
        ]
    return [
        _build_generic(language, GENRES[i % len(GENRES)], fake, rng, f"{language}-{i:04d}")
        for i in range(count)
    ]
