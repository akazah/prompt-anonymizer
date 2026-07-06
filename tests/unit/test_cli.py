"""CLI tests (typer CliRunner). Anonymize paths use the real sm models."""

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from prompt_anonymizer.cli import _confirm_loop, app

runner = CliRunner()


def test_version() -> None:
    result = runner.invoke(app, ["version"])
    assert result.exit_code == 0
    assert "0.2.0" in result.output


def test_deanonymize_with_mapping_file(tmp_path: Path) -> None:
    mapping_file = tmp_path / "mapping.json"
    mapping_file.write_text(
        json.dumps({"<人名_1>": "山田太郎"}, ensure_ascii=False), encoding="utf-8"
    )
    result = runner.invoke(
        app,
        ["deanonymize", "--text", "<人名_1>さんへ", "--mapping-file", str(mapping_file)],
    )
    assert result.exit_code == 0
    assert "山田太郎さんへ" in result.output


def test_anonymize_requires_input() -> None:
    result = runner.invoke(app, ["anonymize"])
    assert result.exit_code != 0


@pytest.mark.integration
def test_anonymize_json_and_mapping_file(tmp_path: Path) -> None:
    mapping_file = tmp_path / "mapping.json"
    result = runner.invoke(
        app,
        [
            "anonymize",
            "--text",
            "電話は090-1234-5678です",
            "--language",
            "ja",
            "--json",
            "--mapping-file",
            str(mapping_file),
        ],
    )
    assert result.exit_code == 0
    payload = json.loads(result.output)
    assert "<電話番号_1>" in payload["text"]
    assert payload["mapping"]["<電話番号_1>"] == "090-1234-5678"
    assert json.loads(mapping_file.read_text(encoding="utf-8")) == payload["mapping"]


@pytest.mark.integration
def test_anonymize_file_input(tmp_path: Path) -> None:
    source = tmp_path / "input.txt"
    source.write_text("メールは a@b.co です", encoding="utf-8")
    result = runner.invoke(app, ["anonymize", "--file", str(source), "--language", "ja"])
    assert result.exit_code == 0
    assert "<メールアドレス_1>" in result.output


@pytest.mark.integration
def test_anonymize_interactive_abort() -> None:
    result = runner.invoke(
        app,
        ["anonymize", "--text", "a@b.co", "--language", "en", "--interactive"],
        input="n\n",
    )
    assert result.exit_code == 2
    assert "aborted" in result.output


@pytest.mark.integration
def test_anonymize_interactive_invalid_then_yes() -> None:
    """Invalid input must re-prompt (the legacy code returned None here)."""
    result = runner.invoke(
        app,
        ["anonymize", "--text", "a@b.co", "--language", "en", "--interactive"],
        input="maybe\nY\n",
    )
    assert result.exit_code == 0
    assert "<Email_1>" in result.output


def test_confirm_loop_reprompts(monkeypatch: pytest.MonkeyPatch) -> None:
    answers = iter(["x", "", "Y"])
    monkeypatch.setattr("builtins.input", lambda _prompt: next(answers))
    assert _confirm_loop("? ") is True


def test_anonymize_unsupported_language_fails_cleanly() -> None:
    result = runner.invoke(app, ["anonymize", "--text", "hi", "--language", "xx"])
    assert result.exit_code == 1
    assert "Traceback" not in result.output


@pytest.mark.integration
def test_anonymize_entities_option_filters_detection() -> None:
    result = runner.invoke(
        app,
        [
            "anonymize",
            "--text",
            "Contact me at john@example.com or call 555-123-4567.",
            "--language",
            "en",
            "--entities",
            "EMAIL_ADDRESS",
        ],
    )
    assert result.exit_code == 0
    assert "<Email_1>" in result.output
    assert "john@example.com" not in result.output
    assert "555-123-4567" in result.output
