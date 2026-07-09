# Chrome Web Store listing copy

Paste-ready copy for the Developer Dashboard. Screenshots: capture the side
panel over a real ChatGPT page (with fake PII), 1280×800, light theme; reuse
frames from `demo/demo_extension_en.gif`.

## Name

```
Prompt Anonymizer — hide PII from ChatGPT & LLMs
```

(45-char limit is for the short name on some surfaces; dashboard allows 75.)

## Summary (132 chars max)

```
Replace names, phones and other PII with reversible labels before text
reaches an LLM. 100% on-device — verifiably: it's open source.
```

## Description

```
A buddy check for PII before it reaches an LLM — it catches the personal
data you didn't mean to send.

Prompt Anonymizer replaces PII — names, phone numbers, emails, postal
codes, credit cards, Japanese My Number — with consistent labels like
<Name_1> BEFORE the text leaves your browser. Because the same value
always gets the same label, the LLM's answer still makes sense. When the
reply comes back, the mapping (which never left your device) restores the
real values.

HOW IT WORKS
• Select text on any page → right-click → "Anonymize selection", or open
  the side panel and paste.
• Detection runs entirely in your browser (WebGPU / WASM). After the
  one-time model download, no network requests are made — open DevTools
  and check.
• Review the detected entities in the mapping table, copy the anonymized
  text into ChatGPT / Claude / Gemini, then paste the reply back to
  restore the original values.

LANGUAGES
Ten languages — Japanese, English, Spanish, Vietnamese, Chinese, Korean,
French, German, Portuguese, Italian — with automatic detection, all
supported as equals. Each with locale-specific structured PII: per-region
phone formats and checksum-validated national IDs (e.g. Japan's My Number,
so it doesn't blindly mask every 12-digit number).

PRIVACY
This extension sends nothing anywhere. No telemetry, no accounts, no
servers. It is MIT-licensed open source — read the code or watch the
network tab: https://github.com/akazah/prompt-anonymizer

LIMITATIONS
Detection is best-effort. Always review the anonymized text before
sending — the mapping table exists exactly for that final check.
```

## Category / language

- Category: **Workflow & Planning** (alt: Tools)
- Languages: English, Japanese, Spanish, Vietnamese, Chinese, Korean,
  French, German, Portuguese, Italian

## Privacy tab answers

- Single purpose: *Anonymize personally identifiable information in text
  before the user sends it to an LLM, and restore it in the reply.*
- Data collected: **none** (check no boxes).
- Remote code: none. All code is packaged; the NER model is data (ONNX
  weights) fetched once from the Hugging Face CDN and cached.
- Permission justifications:
  - `contextMenus` — the "Anonymize selection" right-click entry.
  - `sidePanel` — the main UI lives in the side panel.
  - `storage` — persists user settings (language, deny/allow lists) locally.
  - (List any additional permissions from `manifest.json` at submission
    time; keep the manifest minimal — reviewers weigh permissions heavily.)
