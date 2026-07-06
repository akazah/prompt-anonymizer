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
        "山田太郎は、来月、誕生日を迎えます。どんなプレゼントが適しているでしょうか。"
        "山田太郎は、おいしいものが大好きです。山田太郎は、東京都中央区に在住しています。"
        "彼のメールアドレスは taro.yamada@example.com です。彼の電話番号は 090-0000-0000 です。"
    ),
    "en": (
        "John will have a birthday next month. What kind of gift would be appropriate? "
        "John loves nice cuisine. John lives in New York. His email is john@example.com. "
        "His mobile is (333) 333-3333."
    ),
    "es": (
        "María García cumple años el mes que viene. ¿Qué regalo sería apropiado? "
        "María García vive en Madrid. Su correo es maria.garcia@example.com. "
        "Su teléfono es 612 345 678."
    ),
    "vi": (
        "Nguyễn Văn An sẽ có sinh nhật vào tháng tới. Nên tặng quà gì? "
        "Nguyễn Văn An sống tại Hà Nội. Email là nguyen.an@example.com. "
        "Số điện thoại là 0912 345 678."
    ),
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--text", default=None)
    parser.add_argument("--language", default="en", choices=["en", "ja", "es", "vi"])
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
