# Integrations

Recipes for putting Prompt Anonymizer where your LLM traffic already flows.
Most of these build on the OpenAI-compatible proxy
(`@prompt-anonymizer/proxy`) — anything that speaks the OpenAI API can be
pointed at it with a single base-URL change; PII is masked on the way out
and labels are restored in the reply (streaming included).

Start the proxy once (see the
[README quickstart](../README.md#quickstart-local-proxy)):

```bash
npx @prompt-anonymizer/proxy
# → http://127.0.0.1:8787/v1  (admin GUI: http://127.0.0.1:8787/admin/)
```

## Anything that reads `OPENAI_BASE_URL`

The OpenAI SDKs (Python / JS), `llm`, aider, Continue, and most tools honor
the standard environment variables:

```bash
export OPENAI_BASE_URL=http://127.0.0.1:8787/v1
export OPENAI_API_KEY=sk-...        # forwarded upstream unchanged
```

## LiteLLM

Point the model's `api_base` at the proxy — per model, so you can route
only the vendors you don't want to see PII:

```yaml
# litellm config.yaml
model_list:
  - model_name: gpt-4o-masked
    litellm_params:
      model: openai/gpt-4o
      api_base: http://127.0.0.1:8787/v1
      api_key: os.environ/OPENAI_API_KEY
```

Or in code: `litellm.completion(model="openai/gpt-4o", api_base="http://127.0.0.1:8787/v1", ...)`.

## OpenWebUI

Add the proxy as an OpenAI-compatible connection: Admin Panel → Settings →
Connections → OpenAI API → set the URL to `http://127.0.0.1:8787/v1` (use
`http://host.docker.internal:8787/v1` when OpenWebUI runs in Docker and the
proxy on the host). Every chat through that connection is anonymized before
it leaves the machine; the reply comes back restored, so users see real
names while the upstream vendor never does.

## MCP clients (Claude Desktop / Claude Code / Cursor)

The MCP server exposes `anonymize` / `deanonymize` / `scan` as tools — see
the [README quickstart](../README.md#quickstart-mcp-server) and
`web/packages/mcp/README.md`. Claude Code:

```bash
claude mcp add prompt-anonymizer -- npx -y @prompt-anonymizer/mcp
```

Typical agent uses: `scan` a repo before pushing; `anonymize` a local file
(`file:` input) so its PII never enters the model context; `deanonymize`
with `output_file` to restore a reply straight to disk.

## Git hooks and CI

pre-commit framework (Python CLI) — full recipe in the
[README](../README.md#commit-time--ci-gate-scan):

```yaml
repos:
  - repo: https://github.com/akazah/prompt-anonymizer
    rev: v0.3.3
    hooks:
      - id: prompt-anonymizer-scan
```

husky + lint-staged (Node CLI):

```json
{ "lint-staged": { "*": "prompt-anonymizer scan" } }
```

GitHub Actions job that fails a PR when tracked text files contain PII
(findings show `file:line:col` and entity type only — logs stay PII-free):

```yaml
jobs:
  pii-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-python@v6
        with: { python-version: "3.13" }
      - run: pip install prompt-anonymizer==0.3.3
      - run: git ls-files -z '*.md' '*.txt' | xargs -0 prompt-anonymizer scan
```

## Python apps (library, no proxy)

When you control the code, calling the library directly gives you the
mapping for the round-trip — see the
[README quickstart](../README.md#quickstart-python). The same applies to
JS/TS apps with `@prompt-anonymizer/core` or the React/Vue bindings.

## Notes

- The proxy keeps mappings in memory per request and binds to `127.0.0.1`
  by default. Detection there is regex-first with opt-in NER — configure
  entity types and deny/allow lists in the admin GUI.
- Detection is best-effort everywhere; treat these integrations as a
  safety net, not a guarantee (see
  [README limitations](../README.md#limitations)).
