"""Tests for OpenAI handler module."""
import pytest
from unittest.mock import patch, MagicMock

from src.openai_handler import OpenAIHandler


class TestOpenAIHandler:
    """Test cases for OpenAIHandler class."""

    def test_init_without_api_key_raises_error(self):
        """Test that initialization without API key raises ValueError."""
        with patch.dict("os.environ", {}, clear=True):
            with pytest.raises(ValueError, match="OpenAI API key not found"):
                OpenAIHandler()

    def test_init_with_api_key_parameter(self):
        """Test initialization with API key parameter."""
        handler = OpenAIHandler(api_key="test-key")
        assert handler.client is not None

    def test_init_with_env_var(self):
        """Test initialization with environment variable."""
        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-env-key"}):
            handler = OpenAIHandler()
            assert handler.client is not None

    def test_chat_completion_empty_prompt_raises_error(self):
        """Test that empty prompt raises ValueError."""
        handler = OpenAIHandler(api_key="test-key")
        with pytest.raises(ValueError, match="Prompt cannot be empty"):
            handler.chat_completion("")

    def test_chat_completion_whitespace_prompt_raises_error(self):
        """Test that whitespace-only prompt raises ValueError."""
        handler = OpenAIHandler(api_key="test-key")
        with pytest.raises(ValueError, match="Prompt cannot be empty"):
            handler.chat_completion("   ")

    @patch.object(OpenAIHandler, "__init__", lambda self, api_key=None: None)
    def test_chat_completion_returns_string(self):
        """Test that chat_completion returns a string response."""
        handler = OpenAIHandler()
        handler.model = "gpt-3.5-turbo"

        # Create mock response
        mock_message = MagicMock()
        mock_message.content = "This is a test response"
        mock_choice = MagicMock()
        mock_choice.message = mock_message
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        # Mock the client
        handler.client = MagicMock()
        handler.client.chat.completions.create.return_value = mock_response

        result = handler.chat_completion("Test prompt")
        assert result == "This is a test response"
        assert isinstance(result, str)
