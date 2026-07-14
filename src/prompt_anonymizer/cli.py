"""Command-line interface (typer)."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Annotated

import typer

from prompt_anonymizer.exceptions import PromptAnonymizerError
from prompt_anonymizer.languages import SUPPORTED_LANGUAGES

app = typer.Typer(
    name="prompt-anonymizer",
    help="Anonymize PII before it reaches an LLM - with consistent, reversible labels.",
    no_args_is_help=True,
)

# typer help strings must be constants at decoration time, so derive them here.
_LANGUAGE_HELP = f"Language ({'/'.join(SUPPORTED_LANGUAGES)})."
_SCAN_LANGUAGE_HELP = f"Language: {', '.join(SUPPORTED_LANGUAGES)} or auto."


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
    language: Annotated[str, typer.Option("--language", "-l", help=_LANGUAGE_HELP)] = "en",
    model_size: Annotated[str, typer.Option(help="spaCy model size: sm or lg.")] = "sm",
    ner_backend: Annotated[
        str,
        typer.Option(
            help="NER backend: spacy (default) or hf (transformer; requires the hf extra)."
        ),
    ] = "spacy",
    as_json: Annotated[
        bool, typer.Option("--json", help="Output JSON with text, mapping and entities.")
    ] = False,
    interactive: Annotated[
        bool, typer.Option("--interactive", "-i", help="Review the result before printing.")
    ] = False,
    mapping_file: Annotated[
        Path | None, typer.Option(help="Write the label mapping to this JSON file.")
    ] = None,
    entities: Annotated[
        str | None,
        typer.Option(
            "--entities",
            help=(
                "Comma-separated entity types to detect (default: the built-in set). "
                "Example: --entities PERSON,EMAIL_ADDRESS,US_SSN"
            ),
        ),
    ] = None,
) -> None:
    """Anonymize PII in TEXT and print the result (and mapping)."""
    from prompt_anonymizer.core import PromptAnonymizer

    if language not in SUPPORTED_LANGUAGES:
        raise typer.BadParameter(f"Language must be one of: {', '.join(SUPPORTED_LANGUAGES)}.")
    raw = _read_input(text, file)
    try:
        if entities is not None:
            pa = PromptAnonymizer(
                languages=[language],
                model_size=model_size,
                ner_backend=ner_backend,
                entities=[e.strip() for e in entities.split(",") if e.strip()],
            )
        else:
            pa = PromptAnonymizer(
                languages=[language],
                model_size=model_size,
                ner_backend=ner_backend,
            )
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


_SCAN_NER_OFF_NOTICE = (
    "Note: NER is off - names and locations are NOT scanned "
    "(pass --ner to enable; requires spaCy models)."
)


def _line_col(text: str, offset: int) -> tuple[int, int]:
    """1-based line and column of a character offset."""
    line = text.count("\n", 0, offset) + 1
    return line, offset - text.rfind("\n", 0, offset)


def _scan_inputs(files: list[Path] | None, text: str | None) -> list[tuple[str, str]]:
    """Resolve scan targets to ``(display name, content)`` pairs."""
    if files:
        if text is not None:
            raise typer.BadParameter("Provide FILES or --text, not both.")
        inputs: list[tuple[str, str]] = []
        for path in files:
            # A shell glob like `scan *` expands to include directories; skip
            # them rather than aborting the whole scan.
            if path.is_dir():
                continue
            try:
                inputs.append((str(path), path.read_text(encoding="utf-8")))
            except (OSError, UnicodeDecodeError) as exc:
                typer.secho(f"cannot read {path}: {exc}", fg=typer.colors.RED, err=True)
                raise typer.Exit(code=2) from exc
        return inputs
    return [("<text>" if text is not None else "<stdin>", _read_input(text, None))]


@app.command()
def scan(
    files: Annotated[
        list[Path] | None,
        typer.Argument(help="Files to scan (e.g. staged files passed by pre-commit)."),
    ] = None,
    text: Annotated[str | None, typer.Option("--text", "-t", help="Text to scan.")] = None,
    language: Annotated[str, typer.Option("--language", "-l", help=_SCAN_LANGUAGE_HELP)] = "auto",
    ner: Annotated[
        bool,
        typer.Option(
            "--ner/--no-ner",
            help="Also scan names/locations with the NER model (requires spaCy models).",
        ),
    ] = False,
    deny: Annotated[
        list[str] | None,
        typer.Option("--deny", help="Term that must never appear (repeatable)."),
    ] = None,
    allow: Annotated[
        list[str] | None,
        typer.Option("--allow", help="Term to ignore when detected (repeatable)."),
    ] = None,
    as_json: Annotated[
        bool, typer.Option("--json", help="Output findings as JSON (locations and types only).")
    ] = False,
) -> None:
    """Fail (exit 1) when PII is found - a commit-time / CI gate.

    Reports file:line:col and the entity type per finding; the matched text
    itself is never printed. By default only structured PII (emails, phone
    numbers, postal codes, My Number, credit cards) and --deny terms are
    scanned - fast, offline, no models needed. Exit codes: 0 = clean,
    1 = PII found, 2 = error.
    """
    from prompt_anonymizer.core import PromptAnonymizer
    from prompt_anonymizer.labeling import EntitySpan
    from prompt_anonymizer.scan import guess_language, scan_text

    if language not in (*SUPPORTED_LANGUAGES, "auto"):
        raise typer.BadParameter(
            f"Language must be one of: {', '.join(SUPPORTED_LANGUAGES)} or auto."
        )
    deny = deny or []
    allow = allow or []
    inputs = _scan_inputs(files, text)
    if not ner:
        typer.secho(_SCAN_NER_OFF_NOTICE, fg=typer.colors.YELLOW, err=True)

    anonymizers: dict[str, PromptAnonymizer] = {}

    def spans_for(content: str) -> list[EntitySpan]:
        if not ner:
            return scan_text(content, deny_list=deny, allow_list=allow, language=language)
        lang = guess_language(content) if language == "auto" else language
        if lang not in anonymizers:
            anonymizers[lang] = PromptAnonymizer(languages=[lang], deny_list=deny, allow_list=allow)
        return anonymizers[lang].anonymize(content, language=lang).entities

    findings: list[dict[str, object]] = []
    try:
        for name, content in inputs:
            for span in spans_for(content):
                line, column = _line_col(content, span.start)
                findings.append(
                    {
                        "file": name,
                        "line": line,
                        "column": column,
                        "start": span.start,
                        "end": span.end,
                        "entity_type": span.entity_type,
                        "score": span.score,
                    }
                )
    except PromptAnonymizerError as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=2) from exc

    if as_json:
        print(json.dumps({"findings": findings, "inputs": len(inputs)}, ensure_ascii=False))
    else:
        for f in findings:
            print(
                f"{f['file']}:{f['line']}:{f['column']}: "
                f"{f['entity_type']} (score {f['score']:.2f})"
            )

    if findings:
        typer.secho(
            f"PII found: {len(findings)} finding(s) in "
            f"{len({f['file'] for f in findings})} of {len(inputs)} input(s).",
            fg=typer.colors.RED,
            err=True,
        )
        raise typer.Exit(code=1)
    typer.secho(f"No PII found in {len(inputs)} input(s).", fg=typer.colors.GREEN, err=True)


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
