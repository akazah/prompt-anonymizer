# @prompt-anonymizer/vue

Vue 3 bindings for [prompt-anonymizer](https://github.com/akazah/prompt-anonymizer):
anonymize PII before it reaches an LLM, with consistent, reversible labels.
Detection runs entirely on-device.

## Usage

Drop-in panel component:

```vue
<script setup>
import { AnonymizerPanel } from "@prompt-anonymizer/vue";
</script>

<template>
  <AnonymizerPanel language="auto" :deny-list="['ProjectX']"
    @anonymize="(result) => console.log(result.text)" />
</template>
```

Composable for custom UIs — the full anonymize → LLM → restore session:

```ts
import { useAnonymizer } from "@prompt-anonymizer/vue";

const { anonymize, restore, mapping, busy, error } = useAnonymizer();
const result = await anonymize(input, { language: "ja" });
// send result.text to the LLM — the mapping never leaves the device — then:
const { text: restored, unresolved } = await restore(llmReply.value);
```

By default detection is regex-only (emails, phone numbers, …); pass a
`ner` backend (e.g. `new TransformersNerBackend()` from
`@prompt-anonymizer/core`) to also mask names and locations.

## Documentation

Full docs, demos and the supported-entity table:
[github.com/akazah/prompt-anonymizer](https://github.com/akazah/prompt-anonymizer)

MIT © akazah
