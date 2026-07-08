[English](../../README.md) | [日本語](README_ja.md) | [Español](README_es.md) | [Tiếng Việt](README_vi.md) | [中文](README_zh.md) | [한국어](README_ko.md) | [Français](README_fr.md) | [Deutsch](README_de.md) | [Português](README_pt.md) | Italiano

# Prompt Anonymizer

> **Usa gli LLM di frontiera senza mostrare loro i tuoi PII.**
> Anonimizzazione reversibile sul dispositivo — non barattare l'intelligenza
> con la privacy.

[![CI](https://github.com/akazah/prompt-anonymizer/actions/workflows/ci.yml/badge.svg)](https://github.com/akazah/prompt-anonymizer/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/akazah/prompt-anonymizer)](https://github.com/akazah/prompt-anonymizer/releases)
[![Python](https://img.shields.io/badge/python-3.12%E2%80%933.13-blue)](pyproject.toml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)

Oggi hai due opzioni. Eseguire un modello locale — privato, ma rinunci
all'intelligenza di frontiera. Oppure incollare in ChatGPT / Claude /
Gemini e sorvegliarti da solo, un prompt alla volta. Prompt Anonymizer si
colloca nel mezzo:

|  | Intelligenza | Privacy | Di cosa devi fidarti |
|---|---|---|---|
| Modello locale | ✗ sacrificata | ✓ | di niente |
| Modello di frontiera, senza filtri | ✓ | ✗ | del fornitore e della tua stessa vigilanza |
| **Modello di frontiera + Prompt Anonymizer** | **✓** | **✓** | **di codice che puoi leggere + una revisione finale** |

Sostituisce i PII con etichette coerenti (`<人名_1>`, `<Name_1>`,
`<Nombre_1>`, `<Tên_1>`, …) **prima** che il testo lasci la tua macchina.
Poiché lo stesso valore riceve sempre la stessa etichetta, la risposta
dell'LLM continua ad avere senso. Quando la risposta torna, la mappatura —
che non ha mai lasciato il tuo dispositivo — ripristina i valori reali.

Lingue supportate: inglese (`en`), giapponese (`ja`), spagnolo (`es`),
vietnamita (`vi`) e — novità — cinese (`zh`), coreano (`ko`), francese
(`fr`), tedesco (`de`), portoghese (`pt`) e italiano (`it`). Il valore
predefinito di `PromptAnonymizer(languages=…)` resta `("en", "ja")`; ogni
altra lingua si attiva con `languages=[...]`. Tutti i selettori di lingua
delle interfacce e il rilevamento automatico coprono tutte e dieci. Il
supporto delle lingue è guidato da un registro — aggiungere una lingua è
una voce nel registro (`languages.py` / `languages.ts`) più un file di
etichette.

Il rilevamento avviene sul dispositivo (WebGPU / WASM nel browser, spaCy o
transformers locali in Python). Non fidarti della nostra parola: apri i
DevTools, osserva la scheda di rete o leggi il codice sorgente. Ha licenza
MIT ed è abbastanza piccolo da poter essere verificato in una sola seduta.

<details>
<summary><b>Indice</b></summary>

- [Demo](#demo)
- [Provalo](#provalo)
- [Avvio rapido (Python)](#avvio-rapido-python)
- [Avvio rapido (JavaScript / TypeScript)](#avvio-rapido-javascript--typescript)
- [Avvio rapido (proxy locale)](#avvio-rapido-proxy-locale)
- [Avvio rapido (server MCP)](#avvio-rapido-server-mcp)
- [Barriera al commit / in CI (`scan`)](#barriera-al-commit--in-ci-scan)
- [Perché no…?](#perché-no)
- [Come funziona](#come-funziona)
- [Entità supportate](#entità-supportate)
- [Accuratezza](#accuratezza)
- [Limitazioni](#limitazioni)
- [Roadmap](#roadmap)
- [Contributing / Security / License](#contributing--security--license)

</details>

## Demo

Anonimizza → la mappatura resta locale → la risposta dell'LLM mantiene le
etichette → ripristina:

<img alt="Demo dell'app web: anonimizzazione, mappatura e ripristino di andata e ritorno" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_web_it.gif?raw=true" width="85%">

<details>
<summary>Demo della CLI</summary>

<img alt="Demo della CLI" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_it.gif?raw=true" width="70%">
</details>

<details>
<summary>Demo dell'estensione Chrome (pannello laterale)</summary>

<img alt="Demo dell'estensione Chrome" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_extension_it.gif?raw=true" width="40%">
</details>

## Provalo

| Destinazione | Come | Note |
|---|---|---|
| **Browser (WebGPU)** | [akazah.github.io/prompt-anonymizer](https://akazah.github.io/prompt-anonymizer/) | 100% sul dispositivo: il NER gira nel tuo browser via WebGPU (con fallback WASM). Il tuo testo non viene mai inviato a un server — verificalo nella scheda di rete. |
| **App desktop** | Scarica da [Releases](https://github.com/akazah/prompt-anonymizer/releases) (`.dmg` / `.msi` / `.exe` / `.AppImage` / `.deb` / `.rpm`) | Tauri 2. Per ora senza firma — il tuo SO avviserà al primo avvio. |
| **Estensione Chrome** | `prompt-anonymizer-extension-*.zip` da [Releases](https://github.com/akazah/prompt-anonymizer/releases) | Decomprimi → `chrome://extensions` → attiva la modalità sviluppatore → «Carica estensione non pacchettizzata». Seleziona il testo → clic destro → *Anonymize selection*. |
| **Python / CLI** | `pip install prompt-anonymizer` | Presidio + spaCy. Vedi l'avvio rapido qui sotto. |
| **CLI Node (npx)** | `npx @prompt-anonymizer/cli` | Stessi comandi e flag della CLI Python; NER con transformers.js, interamente sul dispositivo. |
| **Web Component** | `@prompt-anonymizer/element` | Elemento `<prompt-anonymizer>` indipendente dal framework: inserisci il pannello completo anonimizza → ripristina in qualsiasi sito (HTML puro, Svelte, Angular, …). |
| **React / Vue** | `@prompt-anonymizer/react` / `@prompt-anonymizer/vue` | Componente `<AnonymizerPanel />` pronto all'uso più un hook `useAnonymizer()` / composable per interfacce personalizzate. Vedi l'avvio rapido qui sotto. |
| **Proxy locale + GUI di amministrazione** | `npx @prompt-anonymizer/proxy` | Reverse proxy compatibile con OpenAI: punta `OPENAI_BASE_URL` verso di esso e i PII vengono mascherati prima di lasciare la tua macchina, con le etichette ripristinate nelle risposte (streaming incluso). GUI di amministrazione su `http://127.0.0.1:8787/admin/`. Vedi l'avvio rapido qui sotto. |
| **Server MCP** | `npx @prompt-anonymizer/mcp` | Strumenti `anonymize` / `deanonymize` / `scan` per qualsiasi client MCP (Claude Desktop, Claude Code, Cursor, …). La mappatura resta in memoria del server (`mapping_id`) e non viene mostrata al modello salvo richiesta esplicita. Vedi l'avvio rapido qui sotto. |
| **Hook di commit / barriera CI** | `prompt-anonymizer scan` (entrambe le CLI) + [`.pre-commit-hooks.yaml`](../../.pre-commit-hooks.yaml) | Barriera PII basata sul codice di uscita per i controlli al commit e in CI: riporta `file:line:col` e il tipo di entità, mai il testo corrispondente. Offline e senza modelli per impostazione predefinita. Vedi sotto. |

## Avvio rapido (Python)

```bash
pip install prompt-anonymizer
python -m spacy download ja_core_news_sm   # en: en_core_web_sm; es: es_core_news_sm
python -m spacy download xx_ent_wiki_sm    # vi: nessuna pipeline spaCy ufficiale — WikiNER
# zh: zh_core_web_sm; ko: ko_core_news_sm; fr/de/pt/it: *_core_news_sm — oppure
# installa tutti i modelli sm in una volta: uv sync --group models (lg: --group models-lg)
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

# i nomi in vi richiedono il backend transformer (vedi «Backend NER transformer opzionale»)
pa_vi = PromptAnonymizer(languages=["vi"], ner_backend="hf")
pa_vi.anonymize(
    "Tôi tên là Nguyễn Văn An, số điện thoại 0912 345 678", language="vi"
).text  # 'Tôi tên là <Tên_1>, số điện thoại <SốĐiệnThoại_1>'

llm_output = call_your_llm(result.text)          # le etichette sopravvivono all'andata e ritorno
pa.deanonymize(llm_output, result.mapping)       # valori reali ripristinati, in locale
```

CLI (`-l ja|en|es|vi|zh|ko|fr|de|pt|it`):

```bash
prompt-anonymizer anonymize -l ja --interactive --mapping-file mapping.json \
  -t "山田太郎の電話は090-1234-5678"
prompt-anonymizer anonymize -l es -t "El cliente es Javier Moreno, teléfono 612 345 678"
prompt-anonymizer anonymize -l fr -t "Le client est Pierre Durand, téléphone 06 12 34 56 78"
prompt-anonymizer deanonymize --mapping-file mapping.json -t "<人名_1>様 ..."
```

## Avvio rapido (JavaScript / TypeScript)

La CLI Node replica la CLI Python (stessi comandi, flag e output JSON),
eseguendo il core TypeScript con il NER di transformers.js sul dispositivo:

```bash
npx @prompt-anonymizer/cli anonymize -t "山田太郎の電話は090-1234-5678"
```

Per incorporare il pannello pronto anonimizza → ripristina in qualsiasi
frontend, usa il web component indipendente dal framework:

```html
<script type="module">
  import { definePromptAnonymizer } from "@prompt-anonymizer/element";
  definePromptAnonymizer();
</script>
<prompt-anonymizer language="auto"></prompt-anonymizer>
```

React (`@prompt-anonymizer/react`) e Vue 3 (`@prompt-anonymizer/vue`)
includono un `<AnonymizerPanel />` tipizzato che avvolge quell'elemento:

```tsx
import { AnonymizerPanel } from "@prompt-anonymizer/react"; // o "@prompt-anonymizer/vue"

<AnonymizerPanel language="auto" denyList={["ProjectX"]}
  onAnonymize={(result) => console.log(result.text)} />
```

Per interfacce personalizzate, entrambi i pacchetti espongono anche la
sessione anonimizza → LLM → ripristina come hook / composable:

```ts
import { useAnonymizer } from "@prompt-anonymizer/react"; // o "@prompt-anonymizer/vue"

const { anonymize, restore, mapping, busy, error } = useAnonymizer();
const result = await anonymize(input, { language: "ja" });
// invia result.text all'LLM — la mappatura non lascia mai il dispositivo — poi:
const { text: restored, unresolved } = await restore(llmReply);
```

Per impostazione predefinita il rilevamento è solo tramite espressioni
regolari (email, numeri di telefono, …); passa un `ner` (es.
`new TransformersNerBackend()` da `@prompt-anonymizer/core`) per mascherare
anche nomi e luoghi.

## Avvio rapido (proxy locale)

Esegui il proxy compatibile con OpenAI e punta qualsiasi client verso di
esso — i PII vengono mascherati prima che la richiesta lasci la tua
macchina e le etichette vengono ripristinate nella risposta (streaming
incluso). Le mappature restano nella memoria del proxy, per richiesta:

```bash
npx @prompt-anonymizer/proxy            # in ascolto su http://127.0.0.1:8787

# Nella tua app / shell:
export OPENAI_BASE_URL=http://127.0.0.1:8787/v1
```

La GUI di amministrazione su `http://127.0.0.1:8787/admin/` mostra lo stato
in tempo reale e gli eventi di oscuramento (solo etichette e conteggi),
modifica la configurazione del proxy (upstream, NER, liste deny/allow) e
offre un playground di anonimizzazione solo locale. Il proxy si collega a
`127.0.0.1` per impostazione predefinita; i valori originali sono
rivelabili nella GUI solo quando attivi esplicitamente `--record-mappings`.

## Avvio rapido (server MCP)

Offri strumenti di anonimizzazione sul dispositivo a qualsiasi client MCP —
Claude Desktop, Claude Code, Cursor, …:

```bash
# Claude Code:
claude mcp add prompt-anonymizer -- npx -y @prompt-anonymizer/mcp
```

Tre strumenti, tutti progettati perché i PII non entrino nel contesto del modello:
`anonymize` restituisce il testo mascherato e un `mapping_id` (la mappatura resta
in memoria del server salvo richiesta esplicita), `deanonymize` ripristina tramite
`mapping_id` — opzionalmente direttamente su file — e `scan` controlla i file alla
ricerca di PII, riportando solo `file:line:col` e il tipo di entità, mai il testo
corrispondente. Passa `--ner` negli argomenti del server per mascherare anche
nomi/luoghi (download del modello una tantum al primo utilizzo).

## Barriera al commit / in CI (`scan`)

Entrambe le CLI includono un sottocomando `scan` pensato per git hook e CI:
esce con `0` quando gli input sono puliti, `1` quando vengono trovati PII e
`2` in caso di errore. Riporta solo `file:line:col` e il tipo di entità —
**il testo corrispondente non viene mai stampato**, così l'output dell'hook
e i log di CI restano privi di PII. Per impostazione predefinita è offline,
deterministico e senza modelli (PII strutturati: email, numeri di telefono,
codici postali JP, My Number, carte di credito — più i termini di
`--deny`); `--ner` attiva il rilevamento di nomi/luoghi dove sono
disponibili i modelli.

```bash
prompt-anonymizer scan src/prompt.txt docs/*.md      # file (es. in stage)
git diff --cached -U0 | prompt-anonymizer scan       # oppure invia un diff in pipe
prompt-anonymizer scan --deny ProjectX --json -t "..."
```

Con il framework [pre-commit](https://pre-commit.com)
(definizione dell'hook: [`.pre-commit-hooks.yaml`](../../.pre-commit-hooks.yaml)):

```yaml
repos:
  - repo: https://github.com/akazah/prompt-anonymizer
    rev: v0.3.0
    hooks:
      - id: prompt-anonymizer-scan
        # args: [--deny, ProjectX, --allow, support@example.com]
```

I progetti Node possono collegare la stessa barriera tramite husky +
lint-staged (`npx @prompt-anonymizer/cli scan`):

```json
{ "lint-staged": { "*": "prompt-anonymizer scan" } }
```

Come tutto il resto qui, il rilevamento è best-effort: tratta `scan` come
una rete di sicurezza contro le fughe evidenti, non come una garanzia.

## Perché no…?

**Perché non usare direttamente Presidio?** Usa
[Microsoft Presidio](https://github.com/microsoft/presidio) direttamente se
ti serve un framework generico di rilevamento / anonimizzazione dei PII.
Prompt Anonymizer usa Presidio come motore del suo core Python e vi
aggiunge sopra il flusso di andata e ritorno con l'LLM: segnaposto
coerenti, prompt anonimizzato in uscita, ripristino locale dopo la
risposta — oltre a superfici browser, estensione e desktop che non
richiedono affatto Python.

**Perché non LLM Guard?** [LLM Guard](https://github.com/protectai/llm-guard)
è una solida suite di guardrail lato Python con i propri
Anonymize/Deanonymize. Prompt Anonymizer si differenzia in tre punti:
rilevamento multilingue su dieci lingue con PII strutturati specifici per
locale (ID nazionali con validazione checksum come My Number, formati
telefonici per regione), superfici per non sviluppatori (incolla il testo
in una pagina del browser — nessuna configurazione Python) e una base di
codice abbastanza piccola da poter essere letta davvero.

**Perché non un'estensione Chrome «100% locale»?** Diverse estensioni a
codice chiuso dichiarano un'elaborazione locale. Le dichiarazioni non sono
audit. Questo progetto ha licenza MIT: apri la scheda di rete o leggi il
codice sorgente. (Estensioni malevole di «privacy con IA» che esfiltrano le
conversazioni sono state documentate — la categoria si è guadagnata lo
scetticismo.)

## Come funziona

1. Rilevamento — Presidio + spaCy NER (Python) oppure NER di
   transformers.js + riconoscitori a espressioni regolari
   (browser/desktop/estensione), esteso con pattern telefonici per località
   guidati dal registro (JP, US/NANP, ES, VN, CN, KR, FR, DE, PT, IT) e
   riconoscitori specifici per il Giappone (codici postali 〒, My Number
   con validazione della cifra di controllo). Email e carte di credito sono
   indipendenti dalla lingua; JP_POSTAL_CODE e JP_MY_NUMBER vengono
   rilevati in tutte le modalità di lingua.
2. Etichettatura coerente — gli span vengono fusi (prima il punteggio) e
   sostituiti in base all'offset partendo dalla fine; i valori identici
   condividono la stessa etichetta.
3. Reversione — `deanonymize(text, mapping)` ripristina gli originali,
   prima l'etichetta più lunga. La mappatura ti viene restituita e la
   libreria **non la persiste mai**; conservarla in modo sicuro è tua
   responsabilità.

## Entità supportate

| Entità | etichetta ja | etichetta en | etichetta es | etichetta vi | Motore |
|---|---|---|---|---|---|
| PERSON | 人名 | Name | Nombre | Tên | NER |
| LOCATION | 住所 | Location | Dirección | ĐịaChỉ | NER |
| EMAIL_ADDRESS | メールアドレス | Email | Correo | Email | pattern |
| PHONE_NUMBER | 電話番号 | Phone | Teléfono | SốĐiệnThoại | pattern per lingua guidati dal registro + regioni libphonenumber (JP/US/ES/VN/CN/KR/FR/DE/PT/IT) |
| JP_POSTAL_CODE | 郵便番号 | PostalCode | CódigoPostal | MãBưuĐiện | pattern (personalizzato) |
| JP_MY_NUMBER | マイナンバー | MyNumber | MyNumber | MyNumber | pattern + cifra di controllo (personalizzato) |
| CREDIT_CARD | クレジットカード | CreditCard | Tarjeta | ThẻTínDụng | pattern + verifica di Luhn (entrambi i core, tutte le lingue) |
| CUSTOM (deny list) | 秘匿情報 | Custom | Personalizado | TùyChỉnh | corrispondenza esatta |
| US_SSN (opzionale) | 社会保障番号 | SSN | SSN | SSN | pattern + regole di invalidazione (entrambi i core, tutte le lingue) |
| IBAN_CODE (opzionale) | IBAN | IBAN | IBAN | IBAN | pattern + verifica mod-97 (entrambi i core, tutte le lingue) |

Le etichette delle sei nuove lingue (zh, ko, fr, de, pt, it) sono fornite
in `src/prompt_anonymizer/labels/*.yaml` (Python) e in `LABELS` in
`web/packages/core/src/labeling.ts` (TS).

`deny_list` forza il mascheramento di stringhe specifiche; `allow_list` le
esenta. Le entità opzionali non vengono rilevate per impostazione
predefinita — richiedile esplicitamente: `PromptAnonymizer(entities=[...])`,
`new Anonymizer({ entities })` oppure
`--entities PERSON,EMAIL_ADDRESS,US_SSN,IBAN_CODE` su una delle due CLI.

### Backend NER transformer opzionale (Python)

Il NER predefinito è spaCy, con il modello per ciascuna lingua risolto dal
registro centrale (vedi la tabella qui sotto; installa tutti i modelli `sm`
con `uv sync --group models`, quelli `lg` con `--group models-lg`, oppure
usa `python -m spacy download <modello>`). Il vietnamita non ha una
pipeline spaCy ufficiale — entrambe le dimensioni di modello usano il
modello WikiNER multilingue `xx_ent_wiki_sm` per la tokenizzazione e il NER
di base PER/LOC. Per un buon recall di nomi/luoghi in vietnamita, usa
invece il backend transformer (vedi sotto).

Per un recall di PERSON/LOCATION nettamente migliore (specialmente `ja` e
`vi`), installa l'extra `hf` e cambia il backend — modelli Hugging Face per
lingua, interamente in locale:

| Lingua | spaCy (`sm` / `lg`) | HF NER (`ner_backend="hf"`) |
|---|---|---|
| `ja` | `ja_core_news_sm` / `ja_core_news_lg` | `tsmatz/xlm-roberta-ner-japanese` |
| `en` | `en_core_web_sm` / `en_core_web_lg` | `dslim/bert-base-NER` |
| `es` | `es_core_news_sm` / `es_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `vi` | `xx_ent_wiki_sm` (entrambe le dimensioni) | `NlpHUST/ner-vietnamese-electra-base` |
| `zh` | `zh_core_web_sm` / `zh_core_web_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `ko` | `ko_core_news_sm` / `ko_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `fr` | `fr_core_news_sm` / `fr_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `de` | `de_core_news_sm` / `de_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `pt` | `pt_core_news_sm` / `pt_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `it` | `it_core_news_sm` / `it_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |

Il modello HRL multilingue copre `de`/`es`/`fr`/`it`/`pt`/`zh` in modo
nativo; il coreano non ha un checkpoint dedicato in questa famiglia e si
affida al transfer cross-lingua di mBERT.

Il core TypeScript (browser / estensione / desktop / CLI Node) esegue
modelli ONNX di transformers.js: `ja` ed `en` usano le stesse famiglie di
cui sopra; `es`, `vi`, `zh`, `ko`, `fr`, `de`, `pt` e `it` usano tutti
`Xenova/bert-base-multilingual-cased-ner-hrl` (non esiste un'esportazione
ONNX di un modello NER vietnamita dedicato; il modello multilingue si
trasferisce bene al vietnamita, e al coreano si applica la stessa
avvertenza sul transfer).

```bash
pip install "prompt-anonymizer[hf]"
```

```python
pa = PromptAnonymizer(languages=["ja"], ner_backend="hf")  # CLI: --ner-backend hf
pa_vi = PromptAnonymizer(languages=["vi"], ner_backend="hf")  # consigliato per i nomi in vi
```

È disponibile anche l'elaborazione in batch, molto più veloce di un ciclo:

```python
results = pa.anonymize_batch(texts, language="ja", batch_size=16)
```

## Accuratezza

Misurato a livello di span su un golden set sintetico con seed (200
documenti per ciascuna delle dieci lingue in
`tests/golden/golden_{lang}.json`) — consulta
[docs/EVAL.md](../EVAL.md) per la tabella completa e
`uv run python -m prompt_anonymizer.evals` per riprodurre (per impostazione
predefinita tutte e dieci le lingue). In evidenza (core Python, modelli
`sm`): recall 1.00 su ja PHONE_NUMBER / EMAIL_ADDRESS / JP_POSTAL_CODE /
CREDIT_CARD; recall di ja PERSON 0.82 con spaCy, 1.00 con
`ner_backend="hf"`. Anche il recall di es/vi PHONE_NUMBER è 1.00; vi
PERSON/LOCATION traggono grande beneficio da `ner_backend="hf"`. Il recall
dei PII strutturati (telefono / email / carta) è 1.00 per le sei nuove
lingue (zh, ko, fr, de, pt, it) sul golden set —
[docs/EVAL.md](../EVAL.md) contiene la tabella del core TS; i numeri del
NER Python sono prodotti dalla valutazione settimanale.

Questi numeri esistono per intercettare le regressioni, non per promettere
recall su testo del mondo reale.

## Limitazioni

- **Il rilevamento è best-effort e non è garantito.** I falsi negativi
  accadono; rivedi sempre il testo anonimizzato prima di inviarlo ovunque
  (`--interactive` e le tabelle di mappatura nelle interfacce esistono per
  questo).
- L'anonimizzazione nasconde gli identificatori, non il contesto. Dettagli
  quasi identificativi nel testo circostante (un titolo di lavoro raro, un
  evento specifico) possono comunque restringere il campo su chi o cosa
  stai scrivendo.
- LOCATION è l'entità con il recall più debole, specialmente per gli
  indirizzi giapponesi parziali.
- Il modello NER del browser è un download una tantum di ~100–300 MB (poi
  viene messo in cache).
- Le build desktop e dell'estensione per ora non sono firmate.

## Roadmap

Consulta le [issues](https://github.com/akazah/prompt-anonymizer/issues)
aperte e [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md). In evidenza:
pubblicazione su PyPI / npm (Trusted Publishing — oggi installabile da
GitHub Releases), Chrome Web Store, firma del codice, modelli NER giaponesi
più piccoli, PII strutturati multi-regione (più formati di telefono / ID
nazionali con validazione tramite checksum).

## Contributing / Security / License

- [docs/INTEGRATIONS.md](../INTEGRATIONS.md) — ricette per LiteLLM, OpenWebUI, client MCP, git hook e CI
- [CONTRIBUTING.md](../../.github/CONTRIBUTING.md) — configurazione di sviluppo (uv / pnpm), comandi di test e valutazione
- [docs/AUDIT.md](../AUDIT.md) — verifica tu stesso le affermazioni on-device, passo dopo passo
- [SECURITY.md](../../.github/SECURITY.md) — segnalazione di vulnerabilità e di elusioni dell'anonimizzazione
- [MIT](../../LICENSE)
