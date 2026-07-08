#!/usr/bin/env python3
"""Render README.md and docs/i18n/README_<lang>.md from locale YAML sources.

Source layout (docs/i18n/):
  config.yaml     — language registry and output paths
  sections.yaml   — ordered section IDs
  locales/<code>.yaml — per-language section bodies + lang_switcher is generated
  README.template.md — human-readable outline of the section order

Usage:
  uv run python scripts/render_readme_i18n.py            # write outputs
  uv run python scripts/render_readme_i18n.py --check    # exit 1 if drift
  uv run python scripts/render_readme_i18n.py --extract # bootstrap locales/*.yaml
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
I18N_DIR = REPO_ROOT / "docs" / "i18n"
CONFIG_PATH = I18N_DIR / "config.yaml"
SECTIONS_PATH = I18N_DIR / "sections.yaml"
LOCALES_DIR = I18N_DIR / "locales"
TEMPLATE_PATH = I18N_DIR / "README.template.md"

@dataclass(frozen=True)
class Language:
    code: str
    native: str
    output: str
    root: bool = False

    @property
    def output_path(self) -> Path:
        return REPO_ROOT / self.output

    @property
    def is_i18n(self) -> bool:
        return not self.root


def load_yaml(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def load_config() -> list[Language]:
    raw = load_yaml(CONFIG_PATH)["languages"]
    return [
        Language(
            code=entry["code"],
            native=entry["native"],
            output=entry["output"],
            root=bool(entry.get("root", False)),
        )
        for entry in raw
    ]


def load_section_ids() -> list[str]:
    return list(load_yaml(SECTIONS_PATH)["sections"])


def split_readme(content: str) -> dict[str, str]:
    """Split a rendered README into preamble + named sections."""
    lines = content.splitlines()
    section_starts: list[int] = [i for i, line in enumerate(lines) if line.startswith("## ")]
    if not section_starts:
        raise ValueError("README has no ## sections")

    preamble = "\n".join(lines[: section_starts[0]]).rstrip()
    bodies: list[str] = []
    for idx, start in enumerate(section_starts):
        end = section_starts[idx + 1] if idx + 1 < len(section_starts) else len(lines)
        bodies.append("\n".join(lines[start:end]).rstrip())

    section_ids = load_section_ids()[1:]  # skip preamble key
    if len(bodies) == len(section_ids):
        mapping = dict(zip(section_ids, bodies, strict=True))
    elif len(bodies) == len(section_ids) - 1:
        # Missing quickstart_mcp — insert before scan.
        mapping = {}
        body_idx = 0
        for sid in section_ids:
            if sid == "quickstart_mcp":
                continue
            mapping[sid] = bodies[body_idx]
            body_idx += 1
        mapping["quickstart_mcp"] = ""
    else:
        raise ValueError(
            f"expected {len(section_ids)} or {len(section_ids) - 1} sections, got {len(bodies)}"
        )

    return {"preamble": preamble, **mapping}


def lang_switcher_line(current: Language, languages: list[Language]) -> str:
    parts: list[str] = []
    for lang in languages:
        if lang.code == current.code:
            parts.append(lang.native)
            continue
        if lang.root:
            href = "../../README.md" if current.is_i18n else "README.md"
        elif current.root:
            href = f"docs/i18n/README_{lang.code}.md"
        else:
            href = f"README_{lang.code}.md"
        parts.append(f"[{lang.native}]({href})")
    return " | ".join(parts)


def render_language(
    lang: Language,
    languages: list[Language],
    section_ids: list[str],
    locale: dict[str, str],
) -> str:
    chunks: list[str] = [lang_switcher_line(lang, languages)]

    for sid in section_ids:
        body = locale.get(sid, "") if sid != "preamble" else locale.get("preamble", "")
        if body.strip():
            chunks.append(body.rstrip())

    return "\n\n".join(chunks) + "\n"


def load_locale(code: str) -> dict[str, str]:
    path = LOCALES_DIR / f"{code}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"missing locale file {path}")
    data = load_yaml(path)
    sections = data.get("sections", {})
    if "preamble" in data and "preamble" not in sections:
        sections = {"preamble": data["preamble"], **sections}
    return {k: (v or "").rstrip() for k, v in sections.items()}


def write_locale(code: str, sections: dict[str, str]) -> None:
    LOCALES_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "code": code,
        "sections": {k: sections.get(k, "") for k in load_section_ids()},
    }
    path = LOCALES_DIR / f"{code}.yaml"
    path.write_text(
        yaml.safe_dump(
            payload,
            allow_unicode=True,
            sort_keys=False,
            width=1000,
            default_style="|" if False else None,
        ),
        encoding="utf-8",
    )
    # safe_dump wraps long strings poorly; use block scalars for multiline sections.
    _rewrite_locale_with_block_scalars(path, payload)


def _rewrite_locale_with_block_scalars(path: Path, payload: dict) -> None:
    """Emit YAML with literal block scalars for multiline section bodies."""
    lines = [f"code: {payload['code']}", "sections:"]
    for key, value in payload["sections"].items():
        text = value or ""
        if "\n" in text or len(text) > 120:
            lines.append(f"  {key}: |")
            for line in text.splitlines():
                lines.append(f"    {line}")
            if not text:
                lines.append("    ")
        elif text == "":
            lines.append(f"  {key}: ''")
        else:
            escaped = text.replace("'", "''")
            lines.append(f"  {key}: '{escaped}'")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def extract_locales(languages: list[Language]) -> None:
    section_ids = load_section_ids()
    for lang in languages:
        source = lang.output_path
        if not source.exists():
            raise FileNotFoundError(source)
        sections = split_readme(source.read_text(encoding="utf-8"))
        # Strip the generated lang switcher from preamble (first line).
        preamble_lines = sections["preamble"].splitlines()
        if preamble_lines and "|" in preamble_lines[0]:
            sections["preamble"] = "\n".join(preamble_lines[1:]).lstrip("\n")
        missing = [sid for sid in section_ids if not sections.get(sid, "").strip()]
        if missing:
            print(f"  {lang.code}: note — empty sections: {', '.join(missing)}")
        write_locale(lang.code, sections)
        print(f"  wrote locales/{lang.code}.yaml")


def render_all(
    languages: list[Language],
    *,
    check: bool = False,
) -> int:
    section_ids = load_section_ids()
    errors: list[str] = []

    for lang in languages:
        locale = load_locale(lang.code)
        rendered = render_language(lang, languages, section_ids, locale)
        target = lang.output_path
        if check:
            if not target.exists():
                errors.append(f"{target}: missing (run render_readme_i18n.py)")
                continue
            current = target.read_text(encoding="utf-8")
            if current != rendered:
                errors.append(f"{target}: out of date (run render_readme_i18n.py)")
        else:
            target.write_text(rendered, encoding="utf-8")
            print(f"  wrote {lang.output}")

    if errors:
        for err in errors:
            print(err, file=sys.stderr)
        return 1
    return 0


def write_template_outline(section_ids: list[str]) -> None:
    lines = [
        "# README template outline",
        "",
        "Do not edit generated `README.md` or `docs/i18n/README_*.md` by hand.",
        "Change locale strings under `docs/i18n/locales/` and regenerate:",
        "",
        "```bash",
        "uv run python scripts/render_readme_i18n.py",
        "```",
        "",
        "The renderer concatenates, in order:",
        "",
    ]
    for sid in section_ids:
        lines.append(f"- `{{{{ sections.{sid} }}}}` — see `locales/<code>.yaml`")
    lines.extend(
        [
            "",
            "The language switcher (first line) is generated from `config.yaml`.",
            "",
        ]
    )
    TEMPLATE_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="exit 1 when rendered output differs from committed files",
    )
    parser.add_argument(
        "--extract",
        action="store_true",
        help="bootstrap docs/i18n/locales/*.yaml from current README files",
    )
    args = parser.parse_args()

    languages = load_config()
    section_ids = load_section_ids()

    if args.extract:
        print("Extracting locale YAML from README files…")
        extract_locales(languages)
        write_template_outline(section_ids)
        return 0

    if not args.check:
        write_template_outline(section_ids)

    return render_all(languages, check=args.check)


if __name__ == "__main__":
    raise SystemExit(main())
