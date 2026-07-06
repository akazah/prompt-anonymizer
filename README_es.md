[English](README.md) | [日本語](README_ja.md) | Español | [Tiếng Việt](README_vi.md)

# Prompt Anonymizer

> **Usa LLM de frontera sin mostrarles tus PII.**
> Anonimización reversible en el dispositivo — no elijas entre inteligencia y
> privacidad.

[![CI](https://github.com/akazah/prompt-anonymizer/actions/workflows/ci.yml/badge.svg)](https://github.com/akazah/prompt-anonymizer/actions/workflows/ci.yml)
[![Python](https://img.shields.io/badge/python-3.12%E2%80%933.13-blue)](pyproject.toml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Hoy tienes dos opciones. Ejecutar un modelo local — privado, pero renuncias
a la inteligencia de frontera. O pegar en ChatGPT / Claude / Gemini y
vigilarte tú mismo, prompt a prompt. Prompt Anonymizer queda en el medio:

|  | Inteligencia | Privacidad | En qué debes confiar |
|---|---|---|---|
| Modelo local | ✗ sacrificada | ✓ | en nada |
| Modelo de frontera, sin filtrar | ✓ | ✗ | en el proveedor y en tu propia vigilancia |
| **Modelo de frontera + Prompt Anonymizer** | **✓** | **✓** | **en código que puedes leer + una revisión final** |

Sustituye los PII por etiquetas coherentes (`<人名_1>`, `<Name_1>`,
`<Nombre_1>`, `<Tên_1>`, …) **antes** de que el texto salga de tu máquina.
Como el mismo valor siempre recibe la misma etiqueta, la respuesta del LLM
sigue teniendo sentido. Cuando vuelve la respuesta, el mapeo — que nunca
salió de tu dispositivo — restaura los valores reales.

Idiomas admitidos: japonés (`ja`), inglés (`en`), español (`es`) y
vietnamita (`vi`). El valor por defecto de `PromptAnonymizer(languages=…)`
sigue siendo `("en", "ja")`; pasa `languages=["es"]` o `languages=["vi"]`
(o inclúyelos en una lista multilingüe) para activarlos. La interfaz web
añade Español / Tiếng Việt al selector de idioma; la detección automática
distingue los cuatro.

La detección se ejecuta en el dispositivo (WebGPU / WASM en el navegador,
spaCy o transformers locales en Python). No te fíes de nuestra palabra:
abre las DevTools, mira la pestaña de red o lee el código fuente. Tiene
licencia MIT y es lo bastante pequeño para auditarlo de una sentada.

## Demo

Anonimizar → el mapeo permanece local → la respuesta del LLM conserva las
etiquetas → restaurar:

<img alt="Demo de la app web: anonimizar, mapeo y restauración en ida y vuelta" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_web.gif?raw=true" width="85%">

<details>
<summary>Demo de la CLI (japonés / inglés — también español y vietnamita)</summary>

<img alt="Demo de la CLI (japonés)" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_ja.gif?raw=true" width="49%"> <img alt="Demo de la CLI (inglés)" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_en.gif?raw=true" width="49%">
</details>

<details>
<summary>Demo de la extensión de Chrome (panel lateral)</summary>

<img alt="Demo de la extensión de Chrome" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_extension.gif?raw=true" width="40%">
</details>

## Pruébalo

| Destino | Cómo | Notas |
|---|---|---|
| **Navegador (WebGPU)** | [akazah.github.io/prompt-anonymizer](https://akazah.github.io/prompt-anonymizer/) | 100 % en el dispositivo: el NER se ejecuta en tu navegador vía WebGPU (con respaldo WASM). Tu texto nunca se envía a un servidor — compruébalo en la pestaña de red. |
| **App de escritorio** | Descarga desde [Releases](https://github.com/akazah/prompt-anonymizer/releases) (`.dmg` / `.msi` / `.AppImage` / `.deb`) | Tauri 2. Sin firmar por ahora — tu SO avisará en el primer arranque. |
| **Extensión de Chrome** | `prompt-anonymizer-extension-*.zip` desde [Releases](https://github.com/akazah/prompt-anonymizer/releases) | Descomprime → `chrome://extensions` → activa el modo de desarrollador → «Cargar descomprimida». Selecciona texto → clic derecho → *Anonymize selection*. |
| **Python / CLI** | `pip install git+https://github.com/akazah/prompt-anonymizer` (aún no en PyPI) | Presidio + spaCy. Consulta el inicio rápido más abajo. |
| **CLI de Node (npx)** | `npx @prompt-anonymizer/cli` (aún no en npm — compilar desde `web/packages/cli`) | Mismos comandos y flags que la CLI de Python; NER con transformers.js, totalmente en el dispositivo. |
| **Web Component** | `@prompt-anonymizer/element` (aún no en npm) | Elemento `<prompt-anonymizer>` independiente del framework: inserta el panel completo de anonimizar → restaurar en cualquier sitio (HTML plano, Svelte, Angular, …). |
| **React / Vue** | `@prompt-anonymizer/react` / `@prompt-anonymizer/vue` (aún no en npm) | Componente `<AnonymizerPanel />` listo para usar más un hook `useAnonymizer()` / composable para interfaces personalizadas. Consulta el inicio rápido más abajo. |

## Inicio rápido (Python)

```bash
# Aún no publicado en PyPI: instalar desde GitHub (una etiqueta o main para lo último):
pip install git+https://github.com/akazah/prompt-anonymizer@v0.2.0
python -m spacy download ja_core_news_sm   # en: en_core_web_sm; es: es_core_news_sm
python -m spacy download xx_ent_wiki_sm    # vi: sin pipeline oficial de spaCy — WikiNER
```

```python
from prompt_anonymizer import PromptAnonymizer

pa = PromptAnonymizer(languages=["ja"])
result = pa.anonymize("山田太郎の電話は090-1234-5678", language="ja")

result.text     # '<人名_1>の電話は<電話番号_1>'
result.mapping  # {'<人名_1>': '山田太郎', '<電話番号_1>': '090-1234-5678'}

pa_es = PromptAnonymizer(languages=["es"])
pa_es.anonymize(
    "El cliente es Javier Moreno, teléfono 612 345 678", language="es"
).text  # 'El cliente es <Nombre_1>, teléfono <Teléfono_1>'

# los nombres en vi necesitan el backend transformer (véase «Backend NER con transformer opcional»)
pa_vi = PromptAnonymizer(languages=["vi"], ner_backend="hf")
pa_vi.anonymize(
    "Tôi tên là Nguyễn Văn An, số điện thoại 0912 345 678", language="vi"
).text  # 'Tôi tên là <Tên_1>, số điện thoại <SốĐiệnThoại_1>'

llm_output = call_your_llm(result.text)          # las etiquetas sobreviven la ida y vuelta
pa.deanonymize(llm_output, result.mapping)       # valores reales restaurados, en local
```

CLI (`-l ja|en|es|vi`):

```bash
prompt-anonymizer anonymize -l ja --interactive --mapping-file mapping.json \
  -t "山田太郎の電話は090-1234-5678"
prompt-anonymizer anonymize -l es -t "El cliente es Javier Moreno, teléfono 612 345 678"
prompt-anonymizer deanonymize --mapping-file mapping.json -t "<人名_1>様 ..."
```

## Inicio rápido (JavaScript / TypeScript)

La CLI de Node replica la CLI de Python (mismos comandos, flags y salida
JSON), ejecutando el núcleo TypeScript con NER de transformers.js en el
dispositivo:

```bash
# Aún no publicado en npm — compilar desde el repositorio:
cd web && pnpm install && pnpm --filter "./packages/*" build
node packages/cli/dist/cli.js anonymize -t "山田太郎の電話は090-1234-5678"
# Cuando se publique: npx @prompt-anonymizer/cli anonymize -t "..."
```

Para insertar el panel listo de anonimizar → restaurar en cualquier
frontend, usa el web component independiente del framework:

```html
<script type="module">
  import { definePromptAnonymizer } from "@prompt-anonymizer/element";
  definePromptAnonymizer();
</script>
<prompt-anonymizer language="auto"></prompt-anonymizer>
```

React (`@prompt-anonymizer/react`) y Vue 3 (`@prompt-anonymizer/vue`)
incluyen un `<AnonymizerPanel />` tipado que envuelve ese elemento:

```tsx
import { AnonymizerPanel } from "@prompt-anonymizer/react"; // o "@prompt-anonymizer/vue"

<AnonymizerPanel language="auto" denyList={["ProjectX"]}
  onAnonymize={(result) => console.log(result.text)} />
```

Para interfaces personalizadas, ambos paquetes también exponen la sesión
anonimizar → LLM → restaurar como hook / composable:

```ts
import { useAnonymizer } from "@prompt-anonymizer/react"; // o "@prompt-anonymizer/vue"

const { anonymize, restore, mapping, busy, error } = useAnonymizer();
const result = await anonymize(input, { language: "ja" });
// envía result.text al LLM — el mapeo nunca sale del dispositivo — y luego:
const { text: restored, unresolved } = await restore(llmReply);
```

Por defecto la detección es solo por expresiones regulares (correos,
teléfonos, …); pasa un `ner` (p. ej. `new TransformersNerBackend()` de
`@prompt-anonymizer/core`) para enmascarar también nombres y ubicaciones.

## ¿Por qué no…?

**¿Por qué no usar Presidio directamente?** Usa
[Microsoft Presidio](https://github.com/microsoft/presidio) directamente si
necesitas un marco general de detección y anonimización de PII. Prompt
Anonymizer usa Presidio como motor de su núcleo Python y añade encima el
flujo de ida y vuelta con LLM: marcadores de posición coherentes, prompt
anonimizado de salida, restauración local tras la respuesta — además de
superficies de navegador, extensión y escritorio que no requieren Python.

**¿Por qué no LLM Guard?** [LLM Guard](https://github.com/protectai/llm-guard)
es un sólido conjunto de salvaguardas en Python con su propio
Anonymize/Deanonymize. Prompt Anonymizer se diferencia en tres puntos:
detección con prioridad en japonés (nombres japoneses, direcciones, My
Number con validación de dígito de control), superficies para no
desarrolladores (pega texto en una página del navegador — sin configurar
Python) y una base de código lo bastante pequeña para leerla de verdad.

**¿Por qué no una extensión de Chrome «100 % local»?** Varias extensiones
de código cerrado afirman procesamiento local. Las afirmaciones no son
auditorías. Este proyecto tiene licencia MIT: abre la pestaña de red o lee
el código fuente. (Extensiones maliciosas de «privacidad con IA» que
exfiltran conversaciones están documentadas — la categoría se ha ganado el
escepticismo.)

## Cómo funciona

1. Detección — Presidio + spaCy NER (Python) o NER con transformers.js +
   reconocedores por expresiones regulares (navegador/escritorio/extensión),
   ampliado con patrones telefónicos por localidad (JP, US/NANP, España +34 /
   móviles y fijos agrupados, formatos móvil y fijo de Vietnam) y
   reconocedores específicos de Japón (códigos postales 〒, My Number con
   validación de dígito de control). Los correos y las tarjetas de crédito
   son independientes del idioma; JP_POSTAL_CODE y JP_MY_NUMBER se detectan
   en todos los modos de idioma.
2. Etiquetado coherente — los spans se fusionan (prioridad por puntuación) y
   se sustituyen por desplazamiento desde el final; los valores idénticos
   comparten una etiqueta.
3. Reversión — `deanonymize(text, mapping)` restaura los originales, la
   etiqueta más larga primero. El mapeo se te devuelve y la biblioteca
   **nunca lo persiste**; guardarlo de forma segura es tu responsabilidad.

## Entidades admitidas

| Entidad | etiqueta ja | etiqueta en | etiqueta es | etiqueta vi | Motor |
|---|---|---|---|---|---|
| PERSON | 人名 | Name | Nombre | Tên | NER |
| LOCATION | 住所 | Location | Dirección | ĐịaChỉ | NER |
| EMAIL_ADDRESS | メールアドレス | Email | Correo | Email | patrón |
| PHONE_NUMBER | 電話番号 | Phone | Teléfono | SốĐiệnThoại | patrón (JP/US/ES/VI) + libphonenumber (Python) |
| JP_POSTAL_CODE | 郵便番号 | PostalCode | CódigoPostal | MãBưuĐiện | patrón (personalizado) |
| JP_MY_NUMBER | マイナンバー | MyNumber | MyNumber | MyNumber | patrón + dígito de control (personalizado) |
| CREDIT_CARD | クレジットカード | CreditCard | Tarjeta | ThẻTínDụng | patrón + comprobación Luhn (ambos núcleos, todos los idiomas) |
| CUSTOM (deny list) | 秘匿情報 | Custom | Personalizado | TùyChỉnh | coincidencia exacta |

`deny_list` fuerza el enmascarado de cadenas concretas; `allow_list` las
exime.

### Backend NER con transformer opcional (Python)

El NER por defecto es spaCy (`ja` → `ja_core_news_sm` / `ja_core_news_lg`,
`en` → `en_core_web_sm` / `en_core_web_lg`, `es` → `es_core_news_sm` /
`es_core_news_lg`). Vietnamita no tiene pipeline oficial de spaCy — ambos
tamaños de modelo usan el modelo WikiNER multilingüe `xx_ent_wiki_sm` para
tokenización y NER base de PER/LOC. Para un buen recall de nombres y
ubicaciones en vietnamita, usa el backend transformer (véase más abajo).

Para un recall notablemente mejor de PERSON/LOCATION (especialmente `ja` y
`vi`), instala el extra `hf` y cambia el backend — modelos Hugging Face por
idioma, totalmente en local:

| Idioma | spaCy (`sm` / `lg`) | HF NER (`ner_backend="hf"`) |
|---|---|---|
| `ja` | `ja_core_news_sm` / `ja_core_news_lg` | `tsmatz/xlm-roberta-ner-japanese` |
| `en` | `en_core_web_sm` / `en_core_web_lg` | `dslim/bert-base-NER` |
| `es` | `es_core_news_sm` / `es_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `vi` | `xx_ent_wiki_sm` (ambos tamaños) | `NlpHUST/ner-vietnamese-electra-base` |

El núcleo TypeScript (navegador / extensión / escritorio / CLI de Node)
ejecuta modelos ONNX de transformers.js: `ja` y `en` usan las mismas
familias que arriba; `es` y `vi` usan ambos
`Xenova/bert-base-multilingual-cased-ner-hrl` (no existe exportación ONNX
de un NER vietnamita dedicado; el modelo multilingüe se transfiere bien al
vietnamita).

```bash
pip install "prompt-anonymizer[hf]"
```

```python
pa = PromptAnonymizer(languages=["ja"], ner_backend="hf")  # CLI: --ner-backend hf
pa_vi = PromptAnonymizer(languages=["vi"], ner_backend="hf")  # recomendado para nombres en vi
```

El procesamiento por lotes también está disponible y es mucho más rápido que
un bucle:

```python
results = pa.anonymize_batch(texts, language="ja", batch_size=16)
```

## Precisión

Medido a nivel de span en un conjunto dorado sintético con semilla (200
documentos cada uno para `ja`, `en`, `es` y `vi` en
`tests/golden/golden_{ja,en,es,vi}.json`) — consulta
[docs/EVAL.md](docs/EVAL.md) para la tabla completa y
`uv run python -m prompt_anonymizer.evals` para reproducir (por defecto los
cuatro idiomas). Destacados (núcleo Python, modelos `sm`): recall 1.00 en
ja PHONE_NUMBER / EMAIL_ADDRESS / JP_POSTAL_CODE / CREDIT_CARD; recall de
ja PERSON 0.82 con spaCy, 1.00 con `ner_backend="hf"`. El recall de
es/vi PHONE_NUMBER también es 1.00; vi PERSON/LOCATION se benefician mucho de
`ner_backend="hf"`.

Estas cifras existen para detectar regresiones, no para prometer recall en
texto del mundo real.

## Limitaciones

- **La detección es un mejor esfuerzo y no está garantizada.** Ocurren
  falsos negativos; revisa siempre el texto anonimizado antes de enviarlo a
  cualquier sitio (`--interactive` y las tablas de mapeo en las interfaces
  existen para esto).
- La anonimización oculta identificadores, no el contexto. Los detalles
  cuasi identificadores en el texto circundante (un cargo poco común, un
  evento concreto) pueden seguir acotando de quién o de qué escribes.
- LOCATION tiene el recall más débil, sobre todo en direcciones japonesas
  parciales.
- El modelo NER del navegador es una descarga única de ~100–300 MB (se
  cachea después).
- Las compilaciones de escritorio y extensión no están firmadas por ahora.

## Hoja de ruta

Consulta los [issues](https://github.com/akazah/prompt-anonymizer/issues)
abiertos y [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). Destacados:
publicación en npm / PyPI, publicación en tiendas (Chrome Web Store),
firma de código, modelos NER japoneses más pequeños, PII estructurado
multirregión (más formatos de teléfono / ID nacional con validación por
suma de comprobación), servidor MCP.

## Contributing / Security / License

- [CONTRIBUTING.md](CONTRIBUTING.md) — configuración de desarrollo (uv / pnpm), comandos de prueba y evaluación
- [SECURITY.md](SECURITY.md) — reporte de vulnerabilidades y bypasses de anonimización
- [MIT](LICENSE)
