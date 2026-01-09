"""OpenAI API handler with modern client and error handling."""
import os
from typing import Optional
from openai import OpenAI, OpenAIError

from config.constants import OPENAI_MODEL


class OpenAIHandler:
    """Handler for OpenAI API interactions with error handling."""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize OpenAI handler.

        Args:
            api_key: Optional API key. If not provided, reads from
                OPENAI_API_KEY env var.

        Raises:
            ValueError: If API key is not provided and not found in environment.
        """
        api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError(
                "OpenAI API key not found. Set OPENAI_API_KEY environment variable "
                "or pass api_key parameter."
            )
        self.client = OpenAI(api_key=api_key)
        self.model = OPENAI_MODEL

    def chat_completion(self, prompt: str, temperature: float = 1.0) -> str:
        """
        Generate a chat completion response.

        Args:
            prompt: The user prompt to send to the model.
            temperature: Sampling temperature (0-2). Higher values make
                output more random.

        Returns:
            The model's response content.

        Raises:
            OpenAIError: If the API request fails.
            ValueError: If prompt is empty.
        """
        if not prompt or not prompt.strip():
            raise ValueError("Prompt cannot be empty")

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
            )
            return response.choices[0].message.content or ""
        except OpenAIError as e:
            raise OpenAIError(f"Failed to generate completion: {str(e)}") from e
