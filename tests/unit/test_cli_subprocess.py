"""Process-boundary smoke tests for the CLI entry points.

Uses ``python -m prompt_anonymizer.cli`` (always available after editable
install) plus the ``prompt-anonymizer`` console script when on PATH.
Scan is engine-free and model-free — safe for PR CI.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path


def _run_module(*args: str, stdin: str | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "prompt_anonymizer.cli", *args],
        input=stdin,
        capture_output=True,
        text=True,
        check=False,
    )


def test_module_scan_clean_file_exits_zero(tmp_path: Path) -> None:
    clean = tmp_path / "clean.txt"
    clean.write_text("nothing sensitive here\n", encoding="utf-8")
    result = _run_module("scan", str(clean))
    assert result.returncode == 0
    # Clean summary is written to stderr (findings stay on stdout when present).
    assert "No PII found" in result.stderr


def test_module_scan_finds_pii_exits_one_and_never_prints_values(tmp_path: Path) -> None:
    dirty = tmp_path / "dirty.txt"
    phone = "090-1234-5678"
    email = "john@example.com"
    dirty.write_text(f"line one\ncall {phone} or {email}\n", encoding="utf-8")
    result = _run_module("scan", str(dirty))
    assert result.returncode == 1
    combined = result.stdout + result.stderr
    assert f"{dirty}:2:6: PHONE_NUMBER" in result.stdout
    assert f"{dirty}:2:23: EMAIL_ADDRESS" in result.stdout
    # P0: the gate must never echo the matched PII itself.
    assert phone not in combined
    assert email not in combined


def test_module_scan_stdin_reports_email_without_echoing() -> None:
    email = "leak@example.com"
    result = _run_module("scan", stdin=f"{email}\n")
    assert result.returncode == 1
    assert "<stdin>:1:1: EMAIL_ADDRESS" in result.stdout
    assert email not in result.stdout + result.stderr


def test_console_script_scan_smoke(tmp_path: Path) -> None:
    cli = shutil.which("prompt-anonymizer")
    if cli is None:
        return  # editable install without script on PATH — module tests cover the gate
    clean = tmp_path / "clean.txt"
    clean.write_text("ok\n", encoding="utf-8")
    result = subprocess.run(
        [cli, "scan", str(clean)],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0
    assert "No PII found" in result.stderr
