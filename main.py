"""Main CLI entry point for Prompt Anonymizer."""
import sys
from typing import Dict
import fire
from colorama import Fore, Style
from openai import OpenAIError

from src.presidio_handler import PresidioHandler
from src.openai_handler import OpenAIHandler


class PromptAnonymizer:
    """CLI application for anonymizing prompts before sending to OpenAI."""

    def __init__(self):
        """Initialize anonymizer with required handlers."""
        try:
            self.presidio_handler = PresidioHandler()
            self.openai_handler = OpenAIHandler()
        except (ValueError, FileNotFoundError) as e:
            print(f"{Fore.RED}Initialization error: {e}{Style.RESET_ALL}")
            sys.exit(1)

    def _get_messages(self, language: str) -> Dict[str, str]:
        """
        Get localized UI messages.

        Args:
            language: Language code ('en' or 'ja').

        Returns:
            Dictionary of localized messages.
        """
        if language == "ja":
            return {
                "original": "■ 原文",
                "anonymized": "■ 匿名処理結果",
                "prompt_send": (
                    f"{Fore.GREEN}匿名処理結果をプロンプトとしてOpenAIに送りますか？\n"
                    f"（匿名化処理は失敗することがあります。よく確認してください）{Style.RESET_ALL}"
                ),
                "input_prompt": "(n)o,(Y)es > ",
                "communicating": "OpenAI platformと通信中...",
                "aborted": "中止しました",
                "error_anonymize": "匿名化エラー:",
                "error_openai": "OpenAI APIエラー:",
                "invalid_input": "無効な入力です。もう一度お試しください。",
            }
        else:
            return {
                "original": "■ Original",
                "anonymized": "■ Anonymized text",
                "prompt_send": (
                    f"{Fore.GREEN}Do you send this anonymized text as a prompt "
                    f"to OpenAI?\n(Anonymization can fail. Please check "
                    f"carefully){Style.RESET_ALL}"
                ),
                "input_prompt": "(n)o,(Y)es > ",
                "communicating": "Communicating with OpenAI platform...",
                "aborted": "Aborted",
                "error_anonymize": "Anonymization error:",
                "error_openai": "OpenAI API error:",
                "invalid_input": "Invalid input. Please try again.",
            }

    def _display_anonymization_result(
        self,
        original_text: str,
        anonymized_texts: Dict[str, str],
        messages: Dict[str, str],
    ) -> None:
        """
        Display original and anonymized text.

        Args:
            original_text: Original input text.
            anonymized_texts: Dictionary with 'styled_text' and 'text' keys.
            messages: Localized UI messages.
        """
        print(f"\n\n{messages['original']}")
        print("-" * 10)
        print(original_text)
        print("-" * 10)
        print(f"\n{messages['anonymized']}")
        print("-" * 10)
        print(anonymized_texts["styled_text"])
        print("-" * 10)

    def _prompt_user_confirmation(self, messages: Dict[str, str]) -> bool:
        """
        Prompt user to confirm sending to OpenAI.

        Args:
            messages: Localized UI messages.

        Returns:
            True if user confirms, False if user aborts, prompts again on invalid input.
        """
        while True:
            print(f"\n{messages['prompt_send']}")
            user_input = input(f"\n{messages['input_prompt']}")

            if user_input == "Y":
                return True
            elif user_input == "n":
                return False
            else:
                print(f"{Fore.YELLOW}{messages['invalid_input']}{Style.RESET_ALL}")

    def _send_to_openai(self, anonymized_text: str, messages: Dict[str, str]) -> str:
        """
        Send anonymized text to OpenAI and return response.

        Args:
            anonymized_text: The anonymized text to send.
            messages: Localized UI messages.

        Returns:
            OpenAI response or error message.
        """
        try:
            print(messages["communicating"])
            response = self.openai_handler.chat_completion(anonymized_text)
            return f"\n=> {response}"
        except OpenAIError as e:
            return f"{Fore.RED}{messages['error_openai']} {str(e)}{Style.RESET_ALL}"

    def main(self, text: str, language: str = "en") -> None:
        """
        Main entry point for anonymization workflow.

        Args:
            text: Text to anonymize.
            language: Language code ('en' or 'ja'). Defaults to 'en'.
        """
        messages = self._get_messages(language)

        # Anonymize text
        try:
            anonymized_texts = self.presidio_handler.anonymize_text(
                text=text, language=language
            )
        except (ValueError, FileNotFoundError, Exception) as e:
            print(f"{Fore.RED}{messages['error_anonymize']} {str(e)}{Style.RESET_ALL}")
            sys.exit(1)

        # Display results
        self._display_anonymization_result(text, anonymized_texts, messages)

        # Get user confirmation
        if self._prompt_user_confirmation(messages):
            result = self._send_to_openai(anonymized_texts["text"], messages)
            print(result)
        else:
            print(messages["aborted"])


if __name__ == "__main__":
    # Suppress Fire's default output formatting
    fire.core.Display = lambda lines, out: print(*lines, file=out)

    # Create instance and run
    anonymizer = PromptAnonymizer()
    fire.Fire(anonymizer.main)
