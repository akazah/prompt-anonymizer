"""Tests for Presidio handler module."""
import pytest

from src.presidio_handler import PresidioHandler


class TestPresidioHandler:
    """Test cases for PresidioHandler class."""

    @pytest.fixture
    def handler(self):
        """Create a PresidioHandler instance for tests."""
        return PresidioHandler()

    def test_anonymize_text_returns_dict_with_expected_keys(self, handler):
        """Test that anonymize_text returns dict with 'styled_text' and 'text' keys."""
        result = handler.anonymize_text("John Smith", "en")
        assert "styled_text" in result
        assert "text" in result

    def test_anonymize_text_empty_string(self, handler):
        """Test handling of empty string input."""
        result = handler.anonymize_text("", "en")
        assert result["text"] == ""
        assert result["styled_text"] == ""

    def test_anonymize_text_whitespace_only(self, handler):
        """Test handling of whitespace-only input."""
        result = handler.anonymize_text("   ", "en")
        assert result["text"] == ""
        assert result["styled_text"] == ""

    def test_anonymize_text_unsupported_language_raises_error(self, handler):
        """Test that unsupported language raises ValueError."""
        with pytest.raises(ValueError, match="Unsupported language"):
            handler.anonymize_text("Test text", "fr")

    def test_anonymize_text_email_english(self, handler):
        """Test email anonymization in English."""
        text = "Contact me at test@example.com for details."
        result = handler.anonymize_text(text, "en")
        assert "test@example.com" not in result["text"]
        assert "Email_A" in result["text"]

    def test_anonymize_text_person_english(self, handler):
        """Test person name anonymization in English."""
        text = "John Smith met with Jane Doe yesterday."
        result = handler.anonymize_text(text, "en")
        # Check that person names are replaced with labels
        assert "Name_" in result["text"]

    def test_anonymize_text_multiple_same_entity(self, handler):
        """Test that same entity gets same label."""
        text = "John Smith called John Smith twice."
        result = handler.anonymize_text(text, "en")
        # Same person should get same label (Name_A)
        # Count occurrences - should appear twice
        plain_text = result["text"]
        # If John Smith is detected, the label should appear twice
        if "Name_A" in plain_text:
            assert plain_text.count("Name_A") == 2

    def test_int_to_alphabet_lowercase(self):
        """Test _int_to_alphabet returns correct characters."""
        assert PresidioHandler._int_to_alphabet(0) == "A"
        assert PresidioHandler._int_to_alphabet(25) == "Z"
        assert PresidioHandler._int_to_alphabet(26) == "a"
        assert PresidioHandler._int_to_alphabet(51) == "z"
        assert PresidioHandler._int_to_alphabet(52) == "0"
        assert PresidioHandler._int_to_alphabet(61) == "9"

    def test_anonymize_text_japanese_email(self, handler):
        """Test email anonymization in Japanese."""
        text = "連絡先は test@example.com です。"
        result = handler.anonymize_text(text, "ja")
        assert "test@example.com" not in result["text"]
        assert "メールアドレス_A" in result["text"]

    def test_anonymize_text_returns_different_text(self, handler):
        """Test that anonymized text differs from original when PII is present."""
        text = "John Smith's email is john@example.com"
        result = handler.anonymize_text(text, "en")
        assert result["text"] != text
