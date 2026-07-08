"""End-to-end demo: anonymize -> LLM -> deanonymize.

Requires the ``demo`` extra: ``uv sync --extra demo`` and OPENAI_API_KEY.

    uv run python demo/demo_openai.py --language ja --model gpt-4o-mini \
        --text "山田太郎の電話は090-1234-5678です。返信文を書いて。"
"""

from __future__ import annotations

import argparse
import os
import sys

from prompt_anonymizer import PromptAnonymizer

DEFAULT_TEXTS = {
    "ja": (
        "来週から新プロジェクトに配属される山田太郎さんの業務引き継ぎをお願いします。"
        "前任担当の佐藤花子さんに手順と未完了タスクを確認したいです。"
        "山田太郎さんは東京都中央区在住で、緊急連絡は "
        "090-1234-5678 または taro.yamada@example.com へ。"
        "佐藤花子さんへの確認は hanako.sato@example.com までお願いします。"
    ),
    "en": (
        "We need to onboard vendor John Smith before the compliance audit next month. "
        "Emily Johnson from procurement will coordinate the paperwork. "
        "John Smith is based in New York — reach him at john@example.com or (333) 333-3333. "
        "Loop in Emily Johnson at emily.johnson@example.com for contract amendments."
    ),
    "es": (
        "Hay un error en el itinerario de María García para el congreso en Madrid. "
        "Su colega Carlos Ruiz puede confirmar vuelos y alojamiento. "
        "María García reside en Madrid; su correo es maria.garcia@example.com "
        "y su móvil es +34 612 345 678. "
        "Escriba también a Carlos Ruiz en carlos.ruiz@example.com."
    ),
    "vi": (
        "Khách hàng Nguyễn Văn An báo lỗi bảo hành máy lạnh đã mua tại Hà Nội. "
        "Trần Thị Mai từ bộ phận hỗ trợ sẽ điều phối kỹ thuật viên. "
        "Liên hệ Nguyễn Văn An qua an.nguyen@example.com hoặc 0912 345 678. "
        "Gửi lịch hẹn sửa chữa cho Trần Thị Mai tại mai.tran@example.com."
    ),
    "zh": (
        "承建商王小明尚未收到上月工程款，李美玲需要起草催款函。"
        "王小明公司在北京市朝阳区注册，对账联系 xiaoming.wang@example.com，电话 138-1234-5678。"
        "抄送项目经理李美玲 meiling.li@example.com，请在本周五前回复付款计划。"
    ),
    "ko": (
        "김민준 학생의 올해 가을 입학 서류 제출 기한을 확인해 주세요. "
        "입학 담당 이서연과 면접 일정을 조율해야 합니다. "
        "김민준은 서울특별시 강남구에 거주하며, 연락은 minjun.kim@example.com "
        "또는 010-1234-5678로 부탁드립니다. "
        "이서연에게는 seoyeon.lee@example.com으로 서류 목록을 공유해 주세요."
    ),
    "fr": (
        "Pourriez-vous modifier la réservation de Jean Dupont au restaurant près de Paris ? "
        "Marie Martin gère la liste des invités et les allergies. "
        "Jean Dupont est joignable au 06 12 34 56 78 ou jean.dupont@example.com. "
        "Transmettez le menu adapté à Marie Martin via marie.martin@example.com."
    ),
    "de": (
        "Bitte verfassen Sie ein Follow-up zur Schadensmeldung von Max Mustermann (Wasserschaden). "
        "Anna Schmidt aus der Versicherungsabteilung benötigt Fotos und die Schadensnummer. "
        "Max Mustermann wohnt in Berlin; Tel. 0151 23456789, E-Mail max.mustermann@example.com. "
        "Kopie an Anna Schmidt: anna.schmidt@example.com."
    ),
    "pt": (
        "Solicito agendamento de visita ao imóvel para João Silva em São Paulo. "
        "Ana Costa do corretor enviará as chaves e a planta. "
        "Fale com João Silva pelo joao.silva@example.com ou (11) 91234-5678. "
        "Confirme horários com Ana Costa em ana.costa@example.com."
    ),
    "it": (
        "Marco Rossi non riesce a trasferire i biglietti del concerto a Milano. "
        "La collega Giulia Bianchi deve redigere l'email al servizio clienti. "
        "Contattare Marco Rossi a marco.rossi@example.com o al 333 123 4567. "
        "Inoltrare la risposta a Giulia Bianchi su giulia.bianchi@example.com."
    ),
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--text", default=None)
    parser.add_argument(
        "--language",
        default="en",
        choices=["en", "ja", "es", "vi", "zh", "ko", "fr", "de", "pt", "it"],
    )
    parser.add_argument("--model", default="gpt-4o-mini", help="OpenAI model name")
    args = parser.parse_args()

    if not os.getenv("OPENAI_API_KEY"):
        print("OPENAI_API_KEY is not set. Export it before running this demo.", file=sys.stderr)
        return 1

    from openai import OpenAI

    text = args.text or DEFAULT_TEXTS[args.language]
    pa = PromptAnonymizer(languages=[args.language])
    result = pa.anonymize(text, language=args.language)

    print(f"== Original ==\n{text}\n")
    print(f"== Anonymized (sent to the LLM) ==\n{result.text}\n")
    print("== Mapping (kept local, never sent) ==")
    for label, original in result.mapping.items():
        print(f"  {label} -> {original}")

    answer = input("\nSend the anonymized text? (n)o,(Y)es > ").strip()
    while answer not in ("Y", "n"):
        answer = input("Please answer 'Y' or 'n' > ").strip()
    if answer == "n":
        print("aborted")
        return 2

    client = OpenAI()
    response = client.chat.completions.create(
        model=args.model,
        messages=[{"role": "user", "content": result.text}],
    )
    llm_output = response.choices[0].message.content or ""
    print(f"\n== LLM response (labels intact) ==\n{llm_output}\n")
    print(f"== Deanonymized ==\n{pa.deanonymize(llm_output, result.mapping)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
