"""Static checks for the pre-commit hook definition.

Ensures the published hook metadata stays a PII-safe scan gate: Python
entry ``prompt-anonymizer scan``, text files only, no args that would
echo matched text.
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HOOKS_PATH = ROOT / ".pre-commit-hooks.yaml"


def _parse_simple_yaml_list(text: str) -> list[dict[str, object]]:
    """Minimal YAML subset parser for our single-document hook list.

    Avoids adding PyYAML as a test dependency; the file is intentionally
    small and hand-maintained.
    """
    hooks: list[dict[str, object]] = []
    current: dict[str, object] | None = None
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].rstrip()
        if not line.strip():
            continue
        if line.startswith("- "):
            current = {}
            hooks.append(current)
            rest = line[2:].strip()
            if rest and ":" in rest:
                key, _, value = rest.partition(":")
                current[key.strip()] = value.strip()
            continue
        if current is None:
            continue
        if ":" in line:
            key, _, value = line.partition(":")
            current[key.strip()] = value.strip()
    return hooks


def test_pre_commit_hooks_yaml_defines_scan_gate() -> None:
    text = HOOKS_PATH.read_text(encoding="utf-8")
    hooks = _parse_simple_yaml_list(text)
    assert len(hooks) >= 1

    scan = next((h for h in hooks if h.get("id") == "prompt-anonymizer-scan"), None)
    assert scan is not None, "missing id: prompt-anonymizer-scan"
    assert scan.get("entry") == "prompt-anonymizer scan"
    assert scan.get("language") == "python"
    assert scan.get("types") == "[text]"
    # No default args that would enable NER (models) or print matched text.
    assert "args" not in scan
