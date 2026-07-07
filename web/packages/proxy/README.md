# @prompt-anonymizer/proxy

OpenAI-compatible local reverse proxy that anonymizes PII **before** requests
leave your machine and restores the labels in responses — streaming included.
Point any OpenAI-compatible client at it; no code changes needed. Mappings
stay in proxy memory, per request, and are never persisted.

## Usage

```bash
npx @prompt-anonymizer/proxy        # listens on http://127.0.0.1:8787

# In your app / shell:
export OPENAI_BASE_URL=http://127.0.0.1:8787/v1
```

The admin GUI at `http://127.0.0.1:8787/admin/` shows live status and
redaction events (labels and counts only), edits the proxy config (upstream,
NER, deny/allow lists) and offers a local-only anonymization playground.

The proxy binds to `127.0.0.1` by default; original values are only
revealable in the GUI when you explicitly enable `--record-mappings`.

Supported languages (10): Japanese, English, Spanish, Vietnamese, Chinese,
Korean, French, German, Portuguese, Italian (plus auto-detection).
Detection is regex recognizers plus optional on-device NER
(transformers.js).

## Documentation

Full docs, demos and the supported-entity table:
[github.com/akazah/prompt-anonymizer](https://github.com/akazah/prompt-anonymizer)

MIT © akazah
