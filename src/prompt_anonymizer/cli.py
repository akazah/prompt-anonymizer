"""Command-line interface (typer)."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Annotated

import typer

from prompt_anonymizer.exceptions import PromptAnonymizerError

app = typer.Typer(
    name="prompt-anonymizer",
    help="Anonymize PII before it reaches an LLM - with consistent, reversible labels.",
    no_args_is_help=True,
)


def _read_input(text: str | None, file: Path | None) -> str:
    if text is not None:
        return text
    if file is not None:
        return file.read_text(encoding="utf-8")
    if not sys.stdin.isatty():
        data = sys.stdin.read()
        if data.strip():
            return data
    raise typer.BadParameter("Provide --text, --file, or pipe text via stdin.")


def _confirm_loop(prompt: str) -> bool:
    """Ask a Y/n question, re-prompting on invalid input."""
    while True:
        answer = input(prompt).strip()
        if answer == "Y":
            return True
        if answer == "n":
            return False
        print("Please answer 'Y' or 'n'.")


@app.command()
def anonymize(
    text: Annotated[str | None, typer.Option("--text", "-t", help="Text to anonymize.")] = None,
    file: Annotated[
        Path | None, typer.Option("--file", "-f", exists=True, help="Read text from a file.")
    ] = None,
    language: Annotated[str, typer.Option("--language", "-l", help="Language (en/ja).")] = "en",
    model_size: Annotated[str, typer.Option(help="spaCy model size: sm or lg.")] = "sm",
    as_json: Annotated[
        bool, typer.Option("--json", help="Output JSON with text, mapping and entities.")
    ] = False,
    interactive: Annotated[
        bool, typer.Option("--interactive", "-i", help="Review the result before printing.")
    ] = False,
    mapping_file: Annotated[
        Path | None, typer.Option(help="Write the label mapping to this JSON file.")
    ] = None,
) -> None:
    """Anonymize PII in TEXT and print the result (and mapping)."""
    from prompt_anonymizer.core import PromptAnonymizer

    raw = _read_input(text, file)
    try:
        pa = PromptAnonymizer(languages=[language], model_size=model_size)
        result = pa.anonymize(raw, language=language)
    except PromptAnonymizerError as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from exc

    if interactive:
        print(f"\n== Original ==\n{raw}\n\n== Anonymized ==\n{result.text}\n")
        print("== Mapping ==")
        for label, original in result.mapping.items():
            print(f"  {label} -> {original}")
        ok = _confirm_loop(
            "\nUse this result? Detection is best-effort - review carefully. (n)o,(Y)es > "
        )
        if not ok:
            typer.secho("aborted", fg=typer.colors.YELLOW)
            raise typer.Exit(code=2)

    if mapping_file is not None:
        mapping_file.write_text(
            json.dumps(result.mapping, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    if as_json:
        print(json.dumps(result.to_dict(), ensure_ascii=False, indent=2))
    else:
        print(result.text)


@app.command()
def deanonymize(
    text: Annotated[str | None, typer.Option("--text", "-t", help="Text to restore.")] = None,
    file: Annotated[
        Path | None, typer.Option("--file", "-f", exists=True, help="Read text from a file.")
    ] = None,
    mapping_file: Annotated[
        Path, typer.Option(..., help="JSON file with the label mapping.")
    ] = ...,  # type: ignore[assignment]
) -> None:
    """Restore original values in TEXT using a mapping JSON file."""
    from prompt_anonymizer.labeling import deanonymize as _deanonymize

    raw = _read_input(text, file)
    mapping = json.loads(mapping_file.read_text(encoding="utf-8"))
    print(_deanonymize(raw, mapping))


@app.command()
def version() -> None:
    """Print the installed version."""
    from prompt_anonymizer import __version__

    print(__version__)


if __name__ == "__main__":
    app()
