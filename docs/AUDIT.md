# Audit it yourself

"100% on-device" is a claim; this page is the procedure for checking it,
without trusting us. Total time: about 15 minutes for the network checks,
an afternoon for a source read.

## 1. Watch the network (browser app, 5 minutes)

1. Open <https://akazah.github.io/prompt-anonymizer/> and DevTools →
   **Network** tab (tick *Preserve log*).
2. First "Anonymize" click with the NER model enabled: you will see
   requests to `huggingface.co` / `cdn-lfs.huggingface.co` — that is the
   one-time NER model (ONNX weights, data not code) being downloaded and
   cached.
3. Every subsequent anonymize/restore: **zero requests**. Type real-looking
   PII, anonymize, restore — the network tab stays empty.
4. Stronger variant: after the model is cached, go DevTools → Network →
   throttling → **Offline**, reload, and use the app. It works.
5. Regex-only variant (no model at all): untick the "NER model" checkbox —
   fully offline from the first click.

The Chrome extension and desktop app run the same core; the extension can
be checked the same way via `chrome://extensions` → *service worker* →
Network.

## 2. Grep the source for network paths (10 minutes)

The sources contain no direct network calls — check, don't believe:

```bash
git clone https://github.com/akazah/prompt-anonymizer && cd prompt-anonymizer

# Python core: no requests/urllib/httpx/socket use
grep -rn "requests\.\|urllib\|httpx\|socket" src/prompt_anonymizer/

# TypeScript core + element: no fetch/XHR/WebSocket
grep -rn "fetch(\|XMLHttpRequest\|WebSocket" web/packages/core/src web/packages/element/src
```

What network access remains, by design, lives in dependencies and is
model-download only:

| Surface | Network path | When |
| --- | --- | --- |
| Browser / extension / desktop / Node CLI | transformers.js fetches ONNX model files from the Hugging Face CDN | first NER use, then cached |
| Python | spaCy / HF models are installed by you (`spacy download`, pip) | install time, not run time |
| Proxy | forwards your request to the upstream you configure | that is its job — the point is the *body* is masked first |

The proxy binds to `127.0.0.1` by default and its admin GUI shows labels
and counts only, unless you explicitly pass `--record-mappings`
(`web/packages/proxy`).

## 3. Check that mappings are never persisted (10 minutes)

The mapping (label → original value) is the sensitive artifact. Verify the
library never writes it anywhere:

```bash
# Where does anything write files at all?
grep -rn "writeFile\|open(" src/prompt_anonymizer/ \
  web/packages/core/src web/packages/cli/src web/packages/mcp/src
```

You should find exactly three kinds of hits: a read of the bundled label
YAML (`labeling.py`), the CLIs writing a mapping **only** when you pass
`--mapping-file`, and the MCP server writing **only** to an `output_file`
you name. Nothing writes on its own; there is no telemetry, no analytics,
no crash reporting in any surface.

## 4. Read the source in one sitting (an afternoon)

Reading order for the TypeScript core (~2k lines,
`web/packages/core/src/`): `types.ts` → `recognizers.ts` (regex + checksum
validators) → `labeling.ts` (span merge + replacement) → `session.ts`
(restore) → `ner.ts` (the only file that touches transformers.js). The
Python core mirrors it under `src/prompt_anonymizer/`. The parity contract
between the two is the golden set in `tests/golden/`.

## 5. Verify what you install matches the source

- Release wheels/zips are built by GitHub Actions from tagged commits —
  the workflow files are in `.github/workflows/`, and each release links
  its run. Or skip the question entirely: build from source
  (`uv build`, `cd web && pnpm build`).
- Once on npm, packages are published with OIDC provenance ("Built and
  signed on GitHub Actions" on the npm page), tying the tarball to a
  public build log.
- A reproducible-build check for the deployed Pages bundle is on the
  roadmap; until then, the offline test in §1 is the strongest check for
  the hosted app.

## Found something?

A network call we did not document, or any path that leaks input text or
mappings, is a vulnerability: please report it per
[SECURITY.md](../SECURITY.md) — as is any anonymization bypass (PII the
detectors should catch but do not).
