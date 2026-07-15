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
    assert "0.3.1" in result.output


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
    assert result.exit_code == 2
    assert "Language must be one of" in result.output
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


# -- scan (commit-time / CI gate; engine-free, no models needed) ------------


def test_scan_clean_file_exits_zero(tmp_path: Path) -> None:
    clean = tmp_path / "clean.txt"
    clean.write_text("nothing sensitive here\n", encoding="utf-8")
    result = runner.invoke(app, ["scan", str(clean)])
    assert result.exit_code == 0
    assert "No PII found" in result.output


def test_scan_finds_pii_exits_one_and_never_prints_values(tmp_path: Path) -> None:
    dirty = tmp_path / "dirty.txt"
    dirty.write_text("line one\ncall 090-1234-5678 or john@example.com\n", encoding="utf-8")
    result = runner.invoke(app, ["scan", str(dirty)])
    assert result.exit_code == 1
    assert f"{dirty}:2:6: PHONE_NUMBER" in result.output
    assert f"{dirty}:2:23: EMAIL_ADDRESS" in result.output
    # P0: the gate must never echo the matched PII itself.
    assert "090-1234-5678" not in result.output
    assert "john@example.com" not in result.output


def test_scan_json_reports_locations_only(tmp_path: Path) -> None:
    dirty = tmp_path / "dirty.txt"
    dirty.write_text("mail: a@b.co", encoding="utf-8")
    result = runner.invoke(app, ["scan", "--json", str(dirty)])
    assert result.exit_code == 1
    payload = json.loads(result.stdout)
    assert payload["inputs"] == 1
    (finding,) = payload["findings"]
    assert finding == {
        "file": str(dirty),
        "line": 1,
        "column": 7,
        "start": 6,
        "end": 12,
        "entity_type": "EMAIL_ADDRESS",
        "score": 1.0,
    }
    assert "a@b.co" not in result.stdout


def test_scan_text_and_stdin_inputs() -> None:
    result = runner.invoke(app, ["scan", "-t", "call 090-1234-5678"])
    assert result.exit_code == 1
    assert "<text>:1:6: PHONE_NUMBER" in result.output

    result = runner.invoke(app, ["scan"], input="john@example.com\n")
    assert result.exit_code == 1
    assert "<stdin>:1:1: EMAIL_ADDRESS" in result.output


def test_scan_deny_and_allow_lists() -> None:
    result = runner.invoke(app, ["scan", "-t", "ProjectXの件", "--deny", "ProjectX"])
    assert result.exit_code == 1
    assert "CUSTOM" in result.output

    result = runner.invoke(
        app, ["scan", "-t", "mail support@example.com", "--allow", "support@example.com"]
    )
    assert result.exit_code == 0


def test_scan_warns_when_ner_off() -> None:
    result = runner.invoke(app, ["scan", "-t", "hello"])
    assert result.exit_code == 0
    assert "names and locations are NOT scanned" in result.output


def test_scan_missing_file_exits_two(tmp_path: Path) -> None:
    result = runner.invoke(app, ["scan", str(tmp_path / "missing.txt")])
    assert result.exit_code == 2
    assert "cannot read" in result.output


def test_scan_skips_directories(tmp_path: Path) -> None:
    # `scan *` expands to include directories; they must be skipped, not fatal.
    sub = tmp_path / "docs"
    sub.mkdir()
    clean = tmp_path / "clean.txt"
    clean.write_text("hello world", encoding="utf-8")
    result = runner.invoke(app, ["scan", str(sub), str(clean)])
    assert result.exit_code == 0
    assert "cannot read" not in result.output


def test_scan_rejects_files_and_text_together(tmp_path: Path) -> None:
    clean = tmp_path / "clean.txt"
    clean.write_text("x", encoding="utf-8")
    result = runner.invoke(app, ["scan", str(clean), "-t", "y"])
    assert result.exit_code == 2


def test_scan_rejects_unsupported_language() -> None:
    result = runner.invoke(app, ["scan", "-t", "hi", "-l", "xx"])
    assert result.exit_code == 2


@pytest.mark.integration
def test_scan_ner_detects_person() -> None:
    result = runner.invoke(app, ["scan", "--ner", "-t", "山田太郎の電話は090-1234-5678"])
    assert result.exit_code == 1
    assert "PERSON" in result.output
    assert "PHONE_NUMBER" in result.output
    assert "山田太郎" not in result.output
    assert "090-1234-5678" not in result.output
