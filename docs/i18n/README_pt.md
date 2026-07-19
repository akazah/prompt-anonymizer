[English](../../README.md) | [日本語](README_ja.md) | [Español](README_es.md) | [Tiếng Việt](README_vi.md) | [中文](README_zh.md) | [한국어](README_ko.md) | [Français](README_fr.md) | [Deutsch](README_de.md) | Português | [Italiano](README_it.md)

# Prompt Anonymizer

> **Uma segunda verificação dos seus prompts — antes de chegarem a um LLM.**
> Anonimização reversível no dispositivo que apanha os PII que não tencionava enviar.

[![CI](https://github.com/akazah/prompt-anonymizer/actions/workflows/ci.yml/badge.svg)](https://github.com/akazah/prompt-anonymizer/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/akazah/prompt-anonymizer)](https://github.com/akazah/prompt-anonymizer/releases)
[![PyPI](https://img.shields.io/pypi/v/prompt-anonymizer?logo=pypi&logoColor=white)](https://pypi.org/project/prompt-anonymizer/)
[![npm](https://img.shields.io/npm/v/%40prompt-anonymizer%2Fcli?logo=npm)](https://www.npmjs.com/package/@prompt-anonymizer/cli)
[![Python](https://img.shields.io/badge/python-3.12%E2%80%933.13-blue)](pyproject.toml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)

A sua equipa já tem a regra: *não colar dados de clientes, segredos nem
informação pessoal no ChatGPT / Claude / Gemini.* Mas anda toda a gente com
pressa, e um nome ou um número de telefone escapa. O Prompt Anonymizer é essa
segunda verificação — corre **na sua máquina** e apanha esses PII **antes** de
o texto sair, para que um deslize não se torne uma fuga. Não substitui a
regra nem o seu critério; reforça-os.

| Linha de defesa contra um deslize com PII | Apanha-o? | Em que confia |
|---|---|---|
| Apenas uma política escrita | ✗ depende da memória | em todos, sempre |
| A sua própria vigilância de último segundo | ~ quando se lembra | na sua atenção, à pressa |
| **+ Prompt Anonymizer** | **✓ automático, no dispositivo** | **em código que pode ler** |

Substitui os PII por rótulos consistentes (`<人名_1>`, `<Name_1>`, `<Nombre_1>`,
`<Tên_1>`, …) **antes** de o texto sair da sua máquina. Como o mesmo valor
recebe sempre o mesmo rótulo, a resposta do LLM continua a fazer sentido —
não abdica da inteligência de fronteira para estar seguro. Quando a resposta
volta, o mapeamento — que nunca saiu do seu dispositivo — restaura os valores
reais.

Para as pessoas, é um segundo olhar no navegador, na aplicação de ambiente de
trabalho ou na extensão do Chrome. Para os pipelines, a mesma verificação é
aplicada automaticamente — o proxy compatível com OpenAI mascara antes da
saída, e a porta `scan` faz falhar um commit ou uma execução de CI quando um
PII escapa.

Idiomas suportados: inglês (`en`), japonês (`ja`), espanhol (`es`),
vietnamita (`vi`) e — novos — chinês (`zh`), coreano (`ko`), francês (`fr`),
alemão (`de`), português (`pt`) e italiano (`it`). O valor por omissão de
`PromptAnonymizer(languages=…)` continua a ser `("en", "ja")`; todos os
outros idiomas são ativados via `languages=[...]`. Todos os seletores de
idioma das interfaces e a deteção automática cobrem os dez. O suporte de
idiomas é orientado por um registo — adicionar um idioma é uma entrada no
registo (`languages.py` / `languages.ts`) mais um ficheiro de rótulos.

A deteção corre no dispositivo (WebGPU / WASM no navegador, spaCy ou
transformers locais em Python). Não confie apenas na nossa palavra: abra as
DevTools, observe o separador de rede ou leia o código-fonte. Tem licença
MIT e é suficientemente pequeno para ser auditado de uma assentada.

<details>
<summary><b>Índice</b></summary>

- [Demo](#demo)
- [Experimente](#experimente)
- [Início rápido (Python)](#início-rápido-python)
- [Início rápido (JavaScript / TypeScript)](#início-rápido-javascript--typescript)
- [Início rápido (proxy local)](#início-rápido-proxy-local)
- [Início rápido (servidor MCP)](#início-rápido-servidor-mcp)
- [Barreira no commit / CI (`scan`)](#barreira-no-commit--ci-scan)
- [Porque não…?](#porque-não)
- [Como funciona](#como-funciona)
- [Entidades suportadas](#entidades-suportadas)
- [Precisão](#precisão)
- [Limitações](#limitações)
- [Roteiro](#roteiro)
- [Contributing / Security / License](#contributing--security--license)

</details>

## Demo

Anonimizar → o mapeamento fica local → a resposta do LLM mantém os rótulos → restaurar:

<img alt="Demo da aplicação web: anonimizar, mapeamento e restauro de ida e volta" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_web_pt.gif?raw=true" width="85%">

<details>
<summary>Demo da CLI</summary>

<img alt="Demo da CLI" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_pt.gif?raw=true" width="70%">
</details>

<details>
<summary>Demo da extensão Chrome (painel lateral)</summary>

<img alt="Demo da extensão Chrome" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_extension_pt.gif?raw=true" width="40%">
</details>

## Experimente

| Alvo | Como | Notas |
|---|---|---|
| **Navegador (WebGPU)** | [akazah.github.io/prompt-anonymizer](https://akazah.github.io/prompt-anonymizer/) | 100 % no dispositivo: o NER corre no seu navegador via WebGPU (com recurso a WASM). O seu texto nunca é enviado para um servidor — verifique-o no separador de rede. |
| **Aplicação de desktop** | Transfira a partir de [Releases](https://github.com/akazah/prompt-anonymizer/releases) (`.dmg` / `.msi` / `.exe` / `.AppImage` / `.deb` / `.rpm`) | Tauri 2. Sem assinatura por agora — o seu SO avisará no primeiro arranque. |
| **Extensão Chrome** | `prompt-anonymizer-extension-*.zip` a partir de [Releases](https://github.com/akazah/prompt-anonymizer/releases) | Descomprima → `chrome://extensions` → ative o modo de programador → «Carregar expandida». Selecione texto → clique direito → *Anonymize selection*. |
| **Python / CLI** | `pip install prompt-anonymizer` | Presidio + spaCy. Veja o início rápido abaixo. |
| **CLI de Node (npx)** | `npx @prompt-anonymizer/cli` | Mesmos comandos e flags da CLI de Python; NER com transformers.js, totalmente no dispositivo. |
| **Web Component** | `@prompt-anonymizer/element` | Elemento `<prompt-anonymizer>` independente de framework: insira o painel completo de anonimizar → restaurar em qualquer site (HTML simples, Svelte, Angular, …). |
| **React / Vue** | `@prompt-anonymizer/react` / `@prompt-anonymizer/vue` | Componente `<AnonymizerPanel />` pronto a usar mais um hook `useAnonymizer()` / composable para interfaces personalizadas. Veja o início rápido abaixo. |
| **Proxy local + GUI de administração** | `npx @prompt-anonymizer/proxy` | Proxy inverso compatível com OpenAI: aponte `OPENAI_BASE_URL` para ele e os PII são mascarados antes de saírem da sua máquina, com os rótulos restaurados nas respostas (incl. streaming). GUI de administração em `http://127.0.0.1:8787/admin/`. Veja o início rápido abaixo. |
| **Servidor MCP** | `npx @prompt-anonymizer/mcp` | Ferramentas `anonymize` / `deanonymize` / `scan` para qualquer cliente MCP (Claude Desktop, Claude Code, Cursor, …). O mapeamento de rótulos permanece na memória do servidor (`mapping_id`) e nunca é mostrado ao modelo salvo pedido explícito. Veja o início rápido abaixo. |
| **Hook de commit / barreira de CI** | `prompt-anonymizer scan` (ambas as CLI) + [`.pre-commit-hooks.yaml`](../../.pre-commit-hooks.yaml) | Barreira de PII por código de saída para verificações no commit e em CI: reporta `file:line:col` e o tipo de entidade, nunca o texto correspondente. Offline e sem modelos por omissão. Veja abaixo. |

## Início rápido (Python)

```bash
pip install prompt-anonymizer
python -m spacy download ja_core_news_sm   # en: en_core_web_sm; es: es_core_news_sm
python -m spacy download xx_ent_wiki_sm    # vi: sem pipeline oficial de spaCy — WikiNER
# zh: zh_core_web_sm; ko: ko_core_news_sm; fr/de/pt/it: *_core_news_sm — ou
# instale todos os modelos sm de uma vez: uv sync --group models (lg: --group models-lg)
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

# os nomes em vi precisam do backend transformer (ver «Backend NER com transformer opcional»)
pa_vi = PromptAnonymizer(languages=["vi"], ner_backend="hf")
pa_vi.anonymize(
    "Tôi tên là Nguyễn Văn An, số điện thoại 0912 345 678", language="vi"
).text  # 'Tôi tên là <Tên_1>, số điện thoại <SốĐiệnThoại_1>'

llm_output = call_your_llm(result.text)          # os rótulos sobrevivem à ida e volta
pa.deanonymize(llm_output, result.mapping)       # valores reais restaurados, localmente
```

CLI (`-l ja|en|es|vi|zh|ko|fr|de|pt|it`):

```bash
prompt-anonymizer anonymize -l ja --interactive --mapping-file mapping.json \
  -t "山田太郎の電話は090-1234-5678"
prompt-anonymizer anonymize -l es -t "El cliente es Javier Moreno, teléfono 612 345 678"
prompt-anonymizer anonymize -l fr -t "Le client est Pierre Durand, téléphone 06 12 34 56 78"
prompt-anonymizer deanonymize --mapping-file mapping.json -t "<人名_1>様 ..."
```

## Início rápido (JavaScript / TypeScript)

A CLI de Node replica a CLI de Python (mesmos comandos, flags e saída JSON),
executando o núcleo TypeScript com NER de transformers.js no dispositivo:

```bash
npx @prompt-anonymizer/cli anonymize -t "山田太郎の電話は090-1234-5678"
```

Para incorporar o painel pronto de anonimizar → restaurar em qualquer
frontend, use o web component independente de framework:

```html
<script type="module">
  import { definePromptAnonymizer } from "@prompt-anonymizer/element";
  definePromptAnonymizer();
</script>
<prompt-anonymizer language="auto"></prompt-anonymizer>
```

React (`@prompt-anonymizer/react`) e Vue 3 (`@prompt-anonymizer/vue`)
incluem um `<AnonymizerPanel />` tipado que envolve esse elemento:

```tsx
import { AnonymizerPanel } from "@prompt-anonymizer/react"; // ou "@prompt-anonymizer/vue"

<AnonymizerPanel language="auto" denyList={["ProjectX"]}
  onAnonymize={(result) => console.log(result.text)} />
```

Para interfaces personalizadas, ambos os pacotes também expõem a sessão
anonimizar → LLM → restaurar como hook / composable:

```ts
import { useAnonymizer } from "@prompt-anonymizer/react"; // ou "@prompt-anonymizer/vue"

const { anonymize, restore, mapping, busy, error } = useAnonymizer();
const result = await anonymize(input, { language: "ja" });
// envie result.text para o LLM — o mapeamento nunca sai do dispositivo — depois:
const { text: restored, unresolved } = await restore(llmReply);
```

Por omissão, a deteção é apenas por expressões regulares (emails, números
de telefone, …); passe um `ner` (p. ex. `new TransformersNerBackend()` de
`@prompt-anonymizer/core`) para mascarar também nomes e localizações.

## Início rápido (proxy local)

Execute o proxy compatível com OpenAI e aponte qualquer cliente para ele —
os PII são mascarados antes de o pedido sair da sua máquina e os rótulos
são restaurados na resposta (streaming incluído). Os mapeamentos permanecem
na memória do proxy, por pedido:

```bash
npx @prompt-anonymizer/proxy            # escuta em http://127.0.0.1:8787

# Na sua app / shell:
export OPENAI_BASE_URL=http://127.0.0.1:8787/v1
```

A GUI de administração em `http://127.0.0.1:8787/admin/` mostra o estado em
tempo real e os eventos de redação (apenas rótulos e contagens), edita a
configuração do proxy (upstream, NER, listas deny/allow) e oferece um
playground de anonimização apenas local. O proxy liga-se a `127.0.0.1` por
omissão; os valores originais só podem ser revelados na GUI quando ativa
explicitamente `--record-mappings`.

## Início rápido (servidor MCP)

Disponibilize ferramentas de anonimização no dispositivo a qualquer cliente MCP —
Claude Desktop, Claude Code, Cursor, …:

```bash
# Claude Code:
claude mcp add prompt-anonymizer -- npx -y @prompt-anonymizer/mcp
```

Três ferramentas, todas concebidas para que PII não entrem no contexto do modelo:
`anonymize` devolve o texto mascarado e um `mapping_id` (o mapeamento permanece na
memória do servidor salvo pedido explícito), `deanonymize` restaura por
`mapping_id` — opcionalmente diretamente para um ficheiro — e `scan` verifica
ficheiros à procura de PII, reportando apenas `file:line:col` e o tipo de entidade,
nunca o texto correspondente. Passe `--ner` nos argumentos do servidor para mascarar
também nomes/localizações (descarga única do modelo na primeira utilização).

## Barreira no commit / CI (`scan`)

Ambas as CLI incluem um subcomando `scan` concebido para git hooks e CI:
sai com `0` quando as entradas estão limpas, `1` quando são encontrados PII
e `2` em caso de erro. Reporta apenas `file:line:col` e o tipo de entidade —
**o texto correspondente nunca é impresso**, pelo que a saída do hook e os
logs de CI ficam livres de PII. Por omissão é offline, determinista e sem
modelos (PII estruturado: emails, números de telefone, códigos postais JP,
My Number, cartões de crédito — mais os termos de `--deny`); `--ner` ativa
a deteção de nomes/localizações onde haja modelos disponíveis.

```bash
prompt-anonymizer scan src/prompt.txt docs/*.md      # ficheiros (p. ex. em stage)
git diff --cached -U0 | prompt-anonymizer scan       # ou encaminhe um diff
prompt-anonymizer scan --deny ProjectX --json -t "..."
```

Com o framework [pre-commit](https://pre-commit.com)
(definição do hook: [`.pre-commit-hooks.yaml`](../../.pre-commit-hooks.yaml)):

```yaml
repos:
  - repo: https://github.com/akazah/prompt-anonymizer
    rev: v0.3.3
    hooks:
      - id: prompt-anonymizer-scan
        # args: [--deny, ProjectX, --allow, support@example.com]
```

Os projetos Node podem ligar a mesma barreira através de husky +
lint-staged (`npx @prompt-anonymizer/cli scan`):

```json
{ "lint-staged": { "*": "prompt-anonymizer scan" } }
```

Como tudo o resto aqui, a deteção é feita na base do melhor esforço: trate
o `scan` como uma rede de segurança contra fugas óbvias, não como uma
garantia.

## Porque não…?

**Porque não usar simplesmente o Presidio?** Use o
[Microsoft Presidio](https://github.com/microsoft/presidio) diretamente se
precisar de uma framework genérica de deteção / anonimização de PII. O
Prompt Anonymizer usa o Presidio como motor do seu núcleo Python e
acrescenta por cima o fluxo de ida e volta com o LLM: marcadores de posição
consistentes, prompt anonimizado à saída, restauro local após a resposta —
além de superfícies de navegador, extensão e desktop que não precisam de
Python de todo.

**Porque não o LLM Guard?** O [LLM Guard](https://github.com/protectai/llm-guard)
é um sólido conjunto de salvaguardas do lado Python com o seu próprio
Anonymize/Deanonymize. O Prompt Anonymizer distingue-se em três pontos:
deteção com prioridade no japonês (nomes japoneses, moradas, My Number com
validação de dígito de controlo), superfícies para não programadores (cole
texto numa página do navegador — sem configurar Python) e uma base de
código suficientemente pequena para ser realmente lida.

**Porque não uma extensão Chrome «100 % local»?** Várias extensões de
código fechado afirmam fazer processamento local. Afirmações não são
auditorias. Este projeto tem licença MIT: abra o separador de rede ou leia
o código-fonte. (Extensões maliciosas de «privacidade com IA» que exfiltram
conversas já foram documentadas — a categoria mereceu o ceticismo.)

## Como funciona

1. Deteção — Presidio + spaCy NER (Python) ou NER de transformers.js +
   reconhecedores por expressões regulares (navegador/desktop/extensão),
   alargado com padrões telefónicos por região orientados pelo registo
   (JP, US/NANP, ES, VN, CN, KR, FR, DE, PT, IT) e reconhecedores
   específicos do Japão (códigos postais 〒, My Number com validação de
   dígito de controlo). Os emails e os cartões de crédito são independentes
   do idioma; JP_POSTAL_CODE e JP_MY_NUMBER são detetados em todos os modos
   de idioma.
2. Rotulagem consistente — os spans são fundidos (pontuação primeiro) e
   substituídos por offset a partir do fim; valores idênticos partilham o
   mesmo rótulo.
3. Reversão — `deanonymize(text, mapping)` restaura os originais, o rótulo
   mais longo primeiro. O mapeamento é-lhe devolvido e a biblioteca
   **nunca o persiste**; guardá-lo em segurança é da sua responsabilidade.

## Entidades suportadas

| Entidade | rótulo ja | rótulo en | rótulo es | rótulo vi | Motor |
|---|---|---|---|---|---|
| PERSON | 人名 | Name | Nombre | Tên | NER |
| LOCATION | 住所 | Location | Dirección | ĐịaChỉ | NER |
| EMAIL_ADDRESS | メールアドレス | Email | Correo | Email | padrão |
| PHONE_NUMBER | 電話番号 | Phone | Teléfono | SốĐiệnThoại | padrões por idioma orientados pelo registo + regiões libphonenumber (JP/US/ES/VN/CN/KR/FR/DE/PT/IT) |
| JP_POSTAL_CODE | 郵便番号 | PostalCode | CódigoPostal | MãBưuĐiện | padrão (personalizado) |
| JP_MY_NUMBER | マイナンバー | MyNumber | MyNumber | MyNumber | padrão + dígito de controlo (personalizado) |
| CREDIT_CARD | クレジットカード | CreditCard | Tarjeta | ThẻTínDụng | padrão + verificação de Luhn (ambos os núcleos, todos os idiomas) |
| CUSTOM (deny list) | 秘匿情報 | Custom | Personalizado | TùyChỉnh | correspondência exata |
| US_SSN (opcional) | 社会保障番号 | SSN | SSN | SSN | padrão + regras de invalidação (ambos os núcleos, todos os idiomas) |
| IBAN_CODE (opcional) | IBAN | IBAN | IBAN | IBAN | padrão + verificação mod-97 (ambos os núcleos, todos os idiomas) |

Os rótulos dos seis idiomas novos (zh, ko, fr, de, pt, it) são fornecidos
em `src/prompt_anonymizer/labels/*.yaml` (Python) e em `LABELS` em
`web/packages/core/src/labeling.ts` (TS).

`deny_list` força o mascaramento de cadeias específicas; `allow_list`
isenta-as. As entidades opcionais não são detetadas por omissão — peça-as
explicitamente: `PromptAnonymizer(entities=[...])`,
`new Anonymizer({ entities })` ou
`--entities PERSON,EMAIL_ADDRESS,US_SSN,IBAN_CODE` em qualquer das CLI.

### Backend NER com transformer opcional (Python)

O NER por omissão é o spaCy, com o modelo de cada idioma resolvido a partir
do registo central (veja a tabela abaixo; instale todos os modelos `sm` com
`uv sync --group models`, os `lg` com `--group models-lg`, ou use
`python -m spacy download <modelo>`). O vietnamita não tem pipeline oficial
de spaCy — ambos os tamanhos de modelo usam o modelo WikiNER multilingue
`xx_ent_wiki_sm` para tokenização e NER de base de PER/LOC. Para um bom
recall de nomes/localizações em vietnamita, use antes o backend transformer
(veja abaixo).

Para um recall marcadamente melhor de PERSON/LOCATION (especialmente `ja` e
`vi`), instale o extra `hf` e mude o backend — modelos Hugging Face por
idioma, totalmente locais:

| Idioma | spaCy (`sm` / `lg`) | HF NER (`ner_backend="hf"`) |
|---|---|---|
| `ja` | `ja_core_news_sm` / `ja_core_news_lg` | `tsmatz/xlm-roberta-ner-japanese` |
| `en` | `en_core_web_sm` / `en_core_web_lg` | `dslim/bert-base-NER` |
| `es` | `es_core_news_sm` / `es_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `vi` | `xx_ent_wiki_sm` (ambos os tamanhos) | `NlpHUST/ner-vietnamese-electra-base` |
| `zh` | `zh_core_web_sm` / `zh_core_web_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `ko` | `ko_core_news_sm` / `ko_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `fr` | `fr_core_news_sm` / `fr_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `de` | `de_core_news_sm` / `de_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `pt` | `pt_core_news_sm` / `pt_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `it` | `it_core_news_sm` / `it_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |

O modelo HRL multilingue cobre `de`/`es`/`fr`/`it`/`pt`/`zh` de forma
nativa; o coreano não tem checkpoint dedicado nesta família e depende da
transferência entre idiomas do mBERT.

O núcleo TypeScript (navegador / extensão / desktop / CLI de Node) executa
modelos ONNX de transformers.js: `ja` e `en` usam as mesmas famílias que
acima; `es`, `vi`, `zh`, `ko`, `fr`, `de`, `pt` e `it` usam todos
`Xenova/bert-base-multilingual-cased-ner-hrl` (não existe exportação ONNX
de um modelo NER vietnamita dedicado; o modelo multilingue transfere-se bem
para o vietnamita, e ao coreano aplica-se a mesma ressalva de
transferência).

```bash
pip install "prompt-anonymizer[hf]"
```

```python
pa = PromptAnonymizer(languages=["ja"], ner_backend="hf")  # CLI: --ner-backend hf
pa_vi = PromptAnonymizer(languages=["vi"], ner_backend="hf")  # recomendado para nomes em vi
```

O processamento em lote também está disponível e é muito mais rápido do que
um ciclo:

```python
results = pa.anonymize_batch(texts, language="ja", batch_size=16)
```

## Precisão

Medido ao nível do span num conjunto dourado sintético com semente (200
documentos por cada um dos dez idiomas em
`tests/golden/golden_{lang}.json`) — consulte
[docs/EVAL.md](../EVAL.md) para a tabela completa e
`uv run python -m prompt_anonymizer.evals` para reproduzir (por omissão,
todos os dez idiomas). Destaques (núcleo Python, modelos `sm`): recall 1.00
em ja PHONE_NUMBER / EMAIL_ADDRESS / JP_POSTAL_CODE / CREDIT_CARD; recall
de ja PERSON 0.82 com spaCy, 1.00 com `ner_backend="hf"`. O recall de
es/vi PHONE_NUMBER também é 1.00; vi PERSON/LOCATION beneficiam fortemente
de `ner_backend="hf"`. O recall de PII estruturado (telefone / email /
cartão) é 1.00 para os seis idiomas novos (zh, ko, fr, de, pt, it) no
conjunto dourado — [docs/EVAL.md](../EVAL.md) tem a tabela do núcleo TS;
os números de NER em Python são produzidos pela avaliação semanal.

Estes números existem para apanhar regressões, não para prometer recall em
texto do mundo real.

## Limitações

- **A deteção é feita na base do melhor esforço e não é garantida.**
  Acontecem falsos negativos; reveja sempre o texto anonimizado antes de o
  enviar para qualquer lado (`--interactive` e as tabelas de mapeamento nas
  interfaces existem para isso).
- A anonimização esconde identificadores, não o contexto. Detalhes
  quase-identificadores no texto circundante (um cargo raro, um evento
  específico) podem, ainda assim, restringir sobre quem ou o quê está a
  escrever.
- LOCATION é a entidade com o recall mais fraco, sobretudo em moradas
  japonesas parciais.
- O modelo NER do navegador é uma transferência única de ~100–300 MB (fica
  em cache depois).
- As builds de desktop e da extensão não estão assinadas por agora.

## Roteiro

Consulte os [issues](https://github.com/akazah/prompt-anonymizer/issues)
abertos e [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md). Destaques:
Chrome Web Store, assinatura de código, modelos NER
japoneses mais pequenos, PII estruturado multirregião (mais formatos de
telefone / de identificação nacional com validação por dígito de
verificação).

## Contributing / Security / License

- [docs/INTEGRATIONS.md](../INTEGRATIONS.md) — receitas para LiteLLM, OpenWebUI, clientes MCP, git hooks e CI
- [CONTRIBUTING.md](../../.github/CONTRIBUTING.md) — configuração de desenvolvimento (uv / pnpm), comandos de teste e avaliação
- [docs/AUDIT.md](../AUDIT.md) — verifique você mesmo as afirmações on-device, passo a passo
- [SECURITY.md](../../.github/SECURITY.md) — comunicação de vulnerabilidades e de contornos da anonimização
- [MIT](../../LICENSE)
