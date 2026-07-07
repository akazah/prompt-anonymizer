# @prompt-anonymizer/core

Anonymize PII before it reaches an LLM — with consistent, reversible labels
(`<Name_1>`, `<人名_1>`, `<Nombre_1>`, `<Tên_1>`, …). Browser-first TypeScript
core: regex recognizers plus optional on-device NER via transformers.js
(WebGPU / WASM in the browser, ONNX in Node). Nothing ever leaves the device.

This is the engine behind the [browser app](https://akazah.github.io/prompt-anonymizer/),
Chrome extension, desktop app, Node CLI, `<prompt-anonymizer>` web component,
React/Vue bindings and the OpenAI-compatible local proxy.

## Usage

```ts
import { Anonymizer } from "@prompt-anonymizer/core";

const anonymizer = new Anonymizer();
const result = await anonymizer.anonymize("山田太郎の電話は090-1234-5678", {
  language: "ja",
});

result.text;    // '<人名_1>の電話は<電話番号_1>'
result.mapping; // { '<人名_1>': '山田太郎', '<電話番号_1>': '090-1234-5678' }

// send result.text to the LLM — the mapping never leaves the device — then:
const restored = anonymizer.deanonymize(llmReply, result.mapping);
```

By default detection is regex-only (emails, phone numbers, JP postal codes,
My Number, credit cards, deny-list terms). Pass a `TransformersNerBackend`
to also mask names and locations with an on-device NER model:

```ts
import { Anonymizer, TransformersNerBackend } from "@prompt-anonymizer/core";

const anonymizer = new Anonymizer({ ner: new TransformersNerBackend() });
```

Supported languages (10): Japanese, English, Spanish, Vietnamese, Chinese,
Korean, French, German, Portuguese, Italian (plus `auto` detection).
Opt-in entities: `US_SSN`, `IBAN_CODE`.

## Documentation

Full docs, demos, supported-entity table and accuracy numbers:
[github.com/akazah/prompt-anonymizer](https://github.com/akazah/prompt-anonymizer)

MIT © akazah
