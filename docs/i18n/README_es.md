[English](../../README.md) | [日本語](README_ja.md) | Español | [Tiếng Việt](README_vi.md) | [中文](README_zh.md) | [한국어](README_ko.md) | [Français](README_fr.md) | [Deutsch](README_de.md) | [Português](README_pt.md) | [Italiano](README_it.md)

# Prompt Anonymizer

> **Una segunda revisión de tus prompts, antes de que lleguen a un LLM.**
> Anonimización reversible en el dispositivo que detecta los PII que no querías enviar.

[![CI](https://github.com/akazah/prompt-anonymizer/actions/workflows/ci.yml/badge.svg)](https://github.com/akazah/prompt-anonymizer/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/akazah/prompt-anonymizer)](https://github.com/akazah/prompt-anonymizer/releases)
[![PyPI](https://img.shields.io/pypi/v/prompt-anonymizer?logo=pypi&logoColor=white)](https://pypi.org/project/prompt-anonymizer/)
[![npm](https://img.shields.io/npm/v/%40prompt-anonymizer%2Fcli?logo=npm)](https://www.npmjs.com/package/@prompt-anonymizer/cli)
[![Python](https://img.shields.io/badge/python-3.12%E2%80%933.13-blue)](pyproject.toml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)

Tu equipo ya tiene la regla: *no pegar datos de clientes, secretos ni
información personal en ChatGPT / Claude / Gemini.* Pero la gente va con
prisa, y un nombre o un teléfono se cuela. Prompt Anonymizer es esa segunda
revisión: se ejecuta **en tu máquina** y detecta esos PII **antes** de que el
texto salga, para que un descuido no se convierta en una filtración. No
sustituye la regla ni tu criterio; los respalda.

| Línea de defensa ante un descuido con PII | ¿Lo detecta? | En qué confías |
|---|---|---|
| Solo una política escrita | ✗ depende de la memoria | en todos, siempre |
| Tu propia vigilancia de último segundo | ~ cuando te acuerdas | en tu atención, con prisa |
| **+ Prompt Anonymizer** | **✓ automático, en el dispositivo** | **en código que puedes leer** |

Sustituye los PII por etiquetas coherentes (`<人名_1>`, `<Name_1>`,
`<Nombre_1>`, `<Tên_1>`, …) **antes** de que el texto salga de tu máquina.
Como el mismo valor siempre recibe la misma etiqueta, la respuesta del LLM
sigue teniendo sentido — no renuncias a la inteligencia de frontera para
estar a salvo. Cuando vuelve la respuesta, el mapeo — que nunca salió de tu
dispositivo — restaura los valores reales.

Para las personas, es una segunda mirada en el navegador, la app de
escritorio o la extensión de Chrome. Para las canalizaciones, la misma
comprobación se aplica automáticamente: el proxy compatible con OpenAI
enmascara antes de la salida, y la puerta `scan` hace fallar un commit o una
ejecución de CI cuando se cuela un PII.

Idiomas admitidos: inglés (`en`), japonés (`ja`), español (`es`),
vietnamita (`vi`) y — nuevos — chino (`zh`), coreano (`ko`), francés (`fr`),
alemán (`de`), portugués (`pt`) e italiano (`it`). El valor por defecto de
`PromptAnonymizer(languages=…)` sigue siendo `("en", "ja")`; los demás
idiomas se activan con `languages=[...]`. Todos los selectores de idioma de
las interfaces y la detección automática cubren los diez. El soporte de
idiomas se rige por un registro central: añadir un idioma es una entrada en
el registro (`languages.py` / `languages.ts`) más un archivo de etiquetas.

La detección se ejecuta en el dispositivo (WebGPU / WASM en el navegador,
spaCy o transformers locales en Python). No te fíes de nuestra palabra:
abre las DevTools, mira la pestaña de red o lee el código fuente. Tiene
licencia MIT y es lo bastante pequeño para auditarlo de una sentada.

<details>
<summary><b>Índice</b></summary>

- [Demo](#demo)
- [Pruébalo](#pruébalo)
- [Inicio rápido (Python)](#inicio-rápido-python)
- [Inicio rápido (JavaScript / TypeScript)](#inicio-rápido-javascript--typescript)
- [Inicio rápido (proxy local)](#inicio-rápido-proxy-local)
- [Inicio rápido (servidor MCP)](#inicio-rápido-servidor-mcp)
- [Puerta en el commit / CI (`scan`)](#puerta-en-el-commit--ci-scan)
- [¿Por qué no…?](#por-qué-no)
- [Cómo funciona](#cómo-funciona)
- [Entidades admitidas](#entidades-admitidas)
- [Precisión](#precisión)
- [Limitaciones](#limitaciones)
- [Hoja de ruta](#hoja-de-ruta)
- [Contributing / Security / License](#contributing--security--license)

</details>

## Demo

Anonimizar → el mapeo permanece local → la respuesta del LLM conserva las
etiquetas → restaurar:

<img alt="Demo de la app web: anonimizar, mapeo y restauración en ida y vuelta" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_web_es.gif?raw=true" width="85%">

<details>
<summary>Demo de la CLI</summary>

<img alt="Demo de la CLI" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_es.gif?raw=true" width="70%">
</details>

<details>
<summary>Demo de la extensión de Chrome (panel lateral)</summary>

<img alt="Demo de la extensión de Chrome" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_extension_es.gif?raw=true" width="40%">
</details>

## Pruébalo

| Destino | Cómo | Notas |
|---|---|---|
| **Navegador (WebGPU)** | [akazah.github.io/prompt-anonymizer](https://akazah.github.io/prompt-anonymizer/) | 100 % en el dispositivo: el NER se ejecuta en tu navegador vía WebGPU (con respaldo WASM). Tu texto nunca se envía a un servidor — compruébalo en la pestaña de red. |
| **App de escritorio** | Descarga desde [Releases](https://github.com/akazah/prompt-anonymizer/releases) (`.dmg` / `.msi` / `.exe` / `.AppImage` / `.deb` / `.rpm`) | Tauri 2. Sin firmar por ahora — tu SO avisará en el primer arranque. |
| **Extensión de Chrome** | `prompt-anonymizer-extension-*.zip` desde [Releases](https://github.com/akazah/prompt-anonymizer/releases) | Descomprime → `chrome://extensions` → activa el modo de desarrollador → «Cargar descomprimida». Selecciona texto → clic derecho → *Anonymize selection*. |
| **Python / CLI** | `pip install prompt-anonymizer` | Presidio + spaCy. Consulta el inicio rápido más abajo. |
| **CLI de Node (npx)** | `npx @prompt-anonymizer/cli` | Mismos comandos y flags que la CLI de Python; NER con transformers.js, totalmente en el dispositivo. |
| **Web Component** | `@prompt-anonymizer/element` | Elemento `<prompt-anonymizer>` independiente del framework: inserta el panel completo de anonimizar → restaurar en cualquier sitio (HTML plano, Svelte, Angular, …). |
| **React / Vue** | `@prompt-anonymizer/react` / `@prompt-anonymizer/vue` | Componente `<AnonymizerPanel />` listo para usar más un hook `useAnonymizer()` / composable para interfaces personalizadas. Consulta el inicio rápido más abajo. |
| **Proxy local + GUI de administración** | `npx @prompt-anonymizer/proxy` | Proxy inverso compatible con OpenAI: apunta `OPENAI_BASE_URL` hacia él y los PII se enmascaran antes de salir de tu máquina, con las etiquetas restauradas en las respuestas (incl. streaming). GUI de administración en `http://127.0.0.1:8787/admin/`. Consulta el inicio rápido más abajo. |
| **Servidor MCP** | `npx @prompt-anonymizer/mcp` | Herramientas `anonymize` / `deanonymize` / `scan` para cualquier cliente MCP (Claude Desktop, Claude Code, Cursor, …). El mapeo de etiquetas permanece en la memoria del servidor (`mapping_id`) y nunca se muestra al modelo salvo petición explícita. |
| **Hook de commit / puerta de CI** | `prompt-anonymizer scan` (ambas CLI) + [`.pre-commit-hooks.yaml`](../../.pre-commit-hooks.yaml) | Puerta de PII por código de salida para comprobaciones en el commit y en CI: informa `file:line:col` y el tipo de entidad, nunca el texto coincidente. Sin conexión y sin modelos por defecto. Véase más abajo. |

## Inicio rápido (Python)

```bash
pip install prompt-anonymizer
python -m spacy download ja_core_news_sm   # en: en_core_web_sm; es: es_core_news_sm
python -m spacy download xx_ent_wiki_sm    # vi: sin pipeline oficial de spaCy — WikiNER
# zh: zh_core_web_sm; ko: ko_core_news_sm; fr/de/pt/it: *_core_news_sm — o
# instala todos los modelos sm de una vez: uv sync --group models (lg: --group models-lg)
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

CLI (`-l ja|en|es|vi|zh|ko|fr|de|pt|it`):

```bash
prompt-anonymizer anonymize -l ja --interactive --mapping-file mapping.json \
  -t "山田太郎の電話は090-1234-5678"
prompt-anonymizer anonymize -l es -t "El cliente es Javier Moreno, teléfono 612 345 678"
prompt-anonymizer anonymize -l fr -t "Le client est Pierre Durand, téléphone 06 12 34 56 78"
prompt-anonymizer deanonymize --mapping-file mapping.json -t "<人名_1>様 ..."
```

## Inicio rápido (JavaScript / TypeScript)

La CLI de Node replica la CLI de Python (mismos comandos, flags y salida
JSON), ejecutando el núcleo TypeScript con NER de transformers.js en el
dispositivo:

```bash
npx @prompt-anonymizer/cli anonymize -t "山田太郎の電話は090-1234-5678"
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

## Inicio rápido (proxy local)

Ejecuta el proxy compatible con OpenAI y apunta cualquier cliente hacia él —
los PII se enmascaran antes de que la petición salga de tu máquina y las
etiquetas se restauran en la respuesta (streaming incluido). Los mapeos
permanecen en la memoria del proxy, por petición:

```bash
npx @prompt-anonymizer/proxy            # escucha en http://127.0.0.1:8787

# En tu app / shell:
export OPENAI_BASE_URL=http://127.0.0.1:8787/v1
```

La GUI de administración en `http://127.0.0.1:8787/admin/` muestra el estado
en vivo y los eventos de redacción (solo etiquetas y recuentos), edita la
configuración del proxy (upstream, NER, listas deny/allow) y ofrece un
área de pruebas de anonimización solo local. El proxy se enlaza a
`127.0.0.1` por defecto; los valores originales solo pueden revelarse en la
GUI cuando activas explícitamente `--record-mappings`.

## Inicio rápido (servidor MCP)

Ofrece herramientas de anonimización en el dispositivo a cualquier cliente MCP —
Claude Desktop, Claude Code, Cursor, …:

```bash
# Claude Code:
claude mcp add prompt-anonymizer -- npx -y @prompt-anonymizer/mcp
```

Tres herramientas, todas diseñadas para que los PII no entren en el contexto del
modelo: `anonymize` devuelve el texto enmascarado y un `mapping_id` (el mapeo
permanece en la memoria del servidor salvo petición explícita), `deanonymize`
restaura por `mapping_id` — opcionalmente directo a un archivo — y `scan`
comprueba archivos en busca de PII, informando `file:line:col` y el tipo de
entidad pero nunca el texto coincidente. Pasa `--ner` en los argumentos del
servidor para enmascarar también nombres/ubicaciones (descarga única del modelo
en el primer uso).

## Puerta en el commit / CI (`scan`)

Ambas CLI incluyen un subcomando `scan` diseñado para git hooks y CI: sale
con `0` cuando las entradas están limpias, `1` cuando se encuentran PII y
`2` en caso de error. Informa solo `file:line:col` y el tipo de entidad —
**el texto coincidente nunca se imprime**, así que la salida del hook y los
logs de CI quedan libres de PII. Por defecto es sin conexión, determinista
y sin modelos (PII estructurado: correos, teléfonos, códigos postales de
JP, My Number, tarjetas de crédito — más los términos de `--deny`); `--ner`
activa la detección de nombres/ubicaciones donde haya modelos disponibles.

```bash
prompt-anonymizer scan src/prompt.txt docs/*.md      # archivos (p. ej. en stage)
git diff --cached -U0 | prompt-anonymizer scan       # o canaliza un diff
prompt-anonymizer scan --deny ProjectX --json -t "..."
```

Con el framework [pre-commit](https://pre-commit.com)
(definición del hook: [`.pre-commit-hooks.yaml`](../../.pre-commit-hooks.yaml)):

```yaml
repos:
  - repo: https://github.com/akazah/prompt-anonymizer
    rev: v0.3.1
    hooks:
      - id: prompt-anonymizer-scan
        # args: [--deny, ProjectX, --allow, support@example.com]
```

Los proyectos Node pueden conectar la misma puerta mediante husky +
lint-staged (`npx @prompt-anonymizer/cli scan`):

```json
{ "lint-staged": { "*": "prompt-anonymizer scan" } }
```

Como todo lo demás aquí, la detección es un mejor esfuerzo: trata `scan`
como una red de seguridad frente a fugas evidentes, no como una garantía.

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
detección multilingüe en diez idiomas con PII estructurado propio de cada
región (IDs nacionales validados por suma de comprobación como My Number,
formatos de teléfono por región), superficies para no desarrolladores
(pega texto en una página del navegador — sin configurar Python) y una base
de código lo bastante pequeña para leerla de verdad.

**¿Por qué no una extensión de Chrome «100 % local»?** Varias extensiones
de código cerrado afirman procesamiento local. Las afirmaciones no son
auditorías. Este proyecto tiene licencia MIT: abre la pestaña de red o lee
el código fuente. (Extensiones maliciosas de «privacidad con IA» que
exfiltran conversaciones están documentadas — la categoría se ha ganado el
escepticismo.)

## Cómo funciona

1. Detección — Presidio + spaCy NER (Python) o NER con transformers.js +
   reconocedores por expresiones regulares (navegador/escritorio/extensión),
   ampliado con patrones telefónicos por localidad regidos por el registro
   (JP, US/NANP, ES, VN, CN, KR, FR, DE, PT, IT) y
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
| PHONE_NUMBER | 電話番号 | Phone | Teléfono | SốĐiệnThoại | patrones por idioma regidos por el registro + regiones libphonenumber (JP/US/ES/VN/CN/KR/FR/DE/PT/IT) |
| JP_POSTAL_CODE | 郵便番号 | PostalCode | CódigoPostal | MãBưuĐiện | patrón (personalizado) |
| JP_MY_NUMBER | マイナンバー | MyNumber | MyNumber | MyNumber | patrón + dígito de control (personalizado) |
| CREDIT_CARD | クレジットカード | CreditCard | Tarjeta | ThẻTínDụng | patrón + comprobación Luhn (ambos núcleos, todos los idiomas) |
| CUSTOM (deny list) | 秘匿情報 | Custom | Personalizado | TùyChỉnh | coincidencia exacta |
| US_SSN (opcional) | 社会保障番号 | SSN | SSN | SSN | patrón + reglas de invalidación (ambos núcleos, todos los idiomas) |
| IBAN_CODE (opcional) | IBAN | IBAN | IBAN | IBAN | patrón + comprobación mod-97 (ambos núcleos, todos los idiomas) |

Las etiquetas de los seis idiomas nuevos (zh, ko, fr, de, pt, it) se
incluyen en `src/prompt_anonymizer/labels/*.yaml` (Python) y en `LABELS` en
`web/packages/core/src/labeling.ts` (TS).

`deny_list` fuerza el enmascarado de cadenas concretas; `allow_list` las
exime.
Las entidades opcionales no se detectan por defecto — solicítalas
explícitamente: `PromptAnonymizer(entities=[...])`,
`new Anonymizer({ entities })` o
`--entities PERSON,EMAIL_ADDRESS,US_SSN,IBAN_CODE` en cualquiera de las CLI.

### Backend NER con transformer opcional (Python)

El NER por defecto es spaCy, con el modelo de cada idioma resuelto desde el
registro central (véase la tabla siguiente; instala todos los modelos `sm`
con `uv sync --group models`, los `lg` con `--group models-lg`, o usa
`python -m spacy download <modelo>`). Vietnamita no tiene pipeline oficial
de spaCy — ambos tamaños de modelo usan el modelo WikiNER multilingüe
`xx_ent_wiki_sm` para tokenización y NER base de PER/LOC. Para un buen
recall de nombres y ubicaciones en vietnamita, usa el backend transformer
(véase más abajo).

Para un recall notablemente mejor de PERSON/LOCATION (especialmente `ja` y
`vi`), instala el extra `hf` y cambia el backend — modelos Hugging Face por
idioma, totalmente en local:

| Idioma | spaCy (`sm` / `lg`) | HF NER (`ner_backend="hf"`) |
|---|---|---|
| `ja` | `ja_core_news_sm` / `ja_core_news_lg` | `tsmatz/xlm-roberta-ner-japanese` |
| `en` | `en_core_web_sm` / `en_core_web_lg` | `dslim/bert-base-NER` |
| `es` | `es_core_news_sm` / `es_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `vi` | `xx_ent_wiki_sm` (ambos tamaños) | `NlpHUST/ner-vietnamese-electra-base` |
| `zh` | `zh_core_web_sm` / `zh_core_web_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `ko` | `ko_core_news_sm` / `ko_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `fr` | `fr_core_news_sm` / `fr_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `de` | `de_core_news_sm` / `de_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `pt` | `pt_core_news_sm` / `pt_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `it` | `it_core_news_sm` / `it_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |

El modelo HRL multilingüe cubre `de`/`es`/`fr`/`it`/`pt`/`zh` de forma
nativa; el coreano no tiene checkpoint dedicado en esta familia y depende de
la transferencia entre idiomas de mBERT.

El núcleo TypeScript (navegador / extensión / escritorio / CLI de Node)
ejecuta modelos ONNX de transformers.js: `ja` y `en` usan las mismas
familias que arriba; `es`, `vi`, `zh`, `ko`, `fr`, `de`, `pt` e `it` usan
todos `Xenova/bert-base-multilingual-cased-ner-hrl` (no existe exportación
ONNX de un NER vietnamita dedicado; el modelo multilingüe se transfiere bien
al vietnamita, y al coreano se le aplica la misma salvedad de
transferencia).

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
documentos por cada uno de los diez idiomas en
`tests/golden/golden_{lang}.json`) — consulta
[docs/EVAL.md](../EVAL.md) para la tabla completa y
`uv run python -m prompt_anonymizer.evals` para reproducir (por defecto los
diez idiomas). Destacados (núcleo Python, modelos `sm`): recall 1.00 en
ja PHONE_NUMBER / EMAIL_ADDRESS / JP_POSTAL_CODE / CREDIT_CARD; recall de
ja PERSON 0.82 con spaCy, 1.00 con `ner_backend="hf"`. El recall de
es/vi PHONE_NUMBER también es 1.00; vi PERSON/LOCATION se benefician mucho de
`ner_backend="hf"`. El recall de PII estructurado (teléfono / correo /
tarjeta) es 1.00 para los seis idiomas nuevos (zh, ko, fr, de, pt, it) en el
conjunto dorado — [docs/EVAL.md](../EVAL.md) tiene la tabla del núcleo TS;
las cifras de NER en Python las produce la evaluación semanal.

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
abiertos y [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md). Destacados:
Chrome Web Store, firma de código, modelos NER japoneses
más pequeños, PII estructurado multirregión (más formatos de teléfono / ID
nacional con validación por suma de comprobación).

## Contributing / Security / License

- [docs/INTEGRATIONS.md](../INTEGRATIONS.md) — recetas para LiteLLM, OpenWebUI, clientes MCP, git hooks y CI
- [CONTRIBUTING.md](../../.github/CONTRIBUTING.md) — configuración de desarrollo (uv / pnpm), comandos de prueba y evaluación
- [docs/AUDIT.md](../AUDIT.md) — verifica tú mismo las afirmaciones on-device, paso a paso
- [SECURITY.md](../../.github/SECURITY.md) — reporte de vulnerabilidades y bypasses de anonimización
- [MIT](../../LICENSE)
