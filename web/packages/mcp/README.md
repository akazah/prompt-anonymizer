# @prompt-anonymizer/mcp

MCP (Model Context Protocol) server that lets any MCP client — Claude
Desktop, Claude Code, Cursor, … — anonymize PII with consistent, reversible
labels before text goes anywhere, and scan files for PII before commits.
Detection runs entirely on-device.

## Tools

| Tool | What it does |
| --- | --- |
| `anonymize` | Replace PII with labels (`<Name_1>`, `<人名_1>`, …). Returns the anonymized text and a `mapping_id`; the label → value mapping stays in server memory and is **not** shown to the model unless explicitly requested. |
| `deanonymize` | Restore original values by `mapping_id` (or an explicit mapping). Can write straight to a file so the restored PII never enters the model context. |
| `scan` | PII gate for files/text: reports `file:line:col` and entity type only — **never the matched text**. |

## Setup

Claude Code:

```bash
claude mcp add prompt-anonymizer -- npx -y @prompt-anonymizer/mcp
```

Claude Desktop / other MCP clients (`mcpServers` config):

```json
{
  "mcpServers": {
    "prompt-anonymizer": {
      "command": "npx",
      "args": ["-y", "@prompt-anonymizer/mcp"]
    }
  }
}
```

By default detection is offline and model-free (emails, phone numbers, JP
postal codes, My Number with check-digit validation, credit cards, deny-list
terms). Add `--ner` to the args to also mask names and locations with an
on-device transformers.js model (one-time download on first use).

Supported languages (10): Japanese, English, Spanish, Vietnamese, Chinese,
Korean, French, German, Portuguese, Italian — plus auto-detection.

## Privacy notes

- Mappings live in server memory only and die with the process; nothing is
  persisted.
- Text passed as `text` arguments is already in the model's context — use
  the `file` inputs when you want PII to stay out of the conversation
  entirely.
- Detection is best-effort; review before sending anything sensitive.

## Documentation

Full docs, demos and the supported-entity table:
[github.com/akazah/prompt-anonymizer](https://github.com/akazah/prompt-anonymizer)

MIT © akazah
