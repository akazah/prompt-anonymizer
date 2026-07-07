# @prompt-anonymizer/element

Framework-agnostic `<prompt-anonymizer>` web component: drop the full
anonymize → mapping → restore panel into any site (plain HTML, Svelte,
Angular, …). PII is replaced with consistent, reversible labels before the
text leaves the page — detection runs entirely on-device.

## Usage

```html
<script type="module">
  import { definePromptAnonymizer } from "@prompt-anonymizer/element";
  definePromptAnonymizer();
</script>

<prompt-anonymizer language="auto"></prompt-anonymizer>
```

Attributes / properties include `language` (`auto` | `ja` | `en` | `es` |
`vi`), deny/allow lists and entity selection; the element fires events with
the anonymization result so you can pipe the text to an LLM and restore the
reply locally. For React and Vue, use the typed wrappers
[`@prompt-anonymizer/react`](https://www.npmjs.com/package/@prompt-anonymizer/react)
and [`@prompt-anonymizer/vue`](https://www.npmjs.com/package/@prompt-anonymizer/vue).

## Documentation

Full docs, demos and the supported-entity table:
[github.com/akazah/prompt-anonymizer](https://github.com/akazah/prompt-anonymizer)

MIT © akazah
