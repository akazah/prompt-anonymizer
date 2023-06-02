import fire
from colorama import Fore, Back, Style
from src.presidio_handler import PresidioHandler
from src.openai_handler import OpenAIHandler
from config.constants import ENTITIES


def anonymize(text, language="en"):
    return PresidioHandler().anonymize_text(text=text, language=language)


def prompt(prompt):
    return OpenAIHandler().chat_completion(prompt=prompt)


def ask_to_send_text_to_openai(text, anonymized_texts, language, inform=True):
    if inform:
        if language == "ja":
            user_input = input(
                f"\n\n■ 原文\n----------\n{text}\n----------\n\n■ 匿名処理結果\n----------\n{anonymized_texts['styled_text']}\n----------\n\n{Fore.GREEN}匿名処理結果をプロンプトとしてOpenAIに送りますか？\n（匿名化処理は失敗することがあります。よく確認してください）{Style.RESET_ALL}\n\n(n)o,(Y)es > "
            )
        else:
            user_input = input(
                f"\n\n■ Original\n----------\n{text}\n----------\n\n■ Anonymized text\n----------\n{anonymized_texts['styled_text']}{Fore.GREEN}\n----------\n\nDo you send this anonymized text as a prompt to OpenAI?\n(Anonymization can fail.Please check carefully){Style.RESET_ALL}\n\n(n)o,(Y)es > "
            )
    else:
        user_input = input("\n(n)o,(Y)es > ")

    if user_input == "Y":
        if language == "ja":
            print("OpenAI platformと通信中...")
        else:
            print("Communicating with OpenAI platform...")
        completion = prompt(prompt=anonymized_texts['text'])
        return "\n=> " + completion
    elif user_input == "n":
        if language == "ja":
            return "中止しました"
        else:
            return "aborted"
    else:
        ask_to_send_text_to_openai(
            text=text, anonymized_texts=anonymized_texts, language=language, inform=False
        )


def main(text, language="en"):
    anonymized_texts = anonymize(text=text, language=language)
    print(
        ask_to_send_text_to_openai(
            text=text, anonymized_texts=anonymized_texts, language=language
        )
    )

if __name__ == "__main__":
    fire.core.Display = lambda lines, out: print(*lines, file=out)
    fire.Fire(main)
