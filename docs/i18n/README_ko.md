[English](../../README.md) | [日本語](README_ja.md) | [Español](README_es.md) | [Tiếng Việt](README_vi.md) | [中文](README_zh.md) | 한국어 | [Français](README_fr.md) | [Deutsch](README_de.md) | [Português](README_pt.md) | [Italiano](README_it.md)

# Prompt Anonymizer

> **PII를 보여주지 않고 프런티어 LLM을 사용하세요.**
> 되돌릴 수 있는 온디바이스 익명화 — 지능과 프라이버시를 맞바꾸지 마세요.

[![CI](https://github.com/akazah/prompt-anonymizer/actions/workflows/ci.yml/badge.svg)](https://github.com/akazah/prompt-anonymizer/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/akazah/prompt-anonymizer)](https://github.com/akazah/prompt-anonymizer/releases)
[![Python](https://img.shields.io/badge/python-3.12%E2%80%933.13-blue)](pyproject.toml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)

지금은 선택지가 둘뿐입니다. 로컬 모델을 돌리기 — 프라이빗하지만 프런티어급
지능은 포기해야 합니다. 아니면 ChatGPT / Claude / Gemini에 붙여넣고 프롬프트
하나하나를 스스로 검열하기. Prompt Anonymizer는 그 중간에 위치합니다:

|  | 지능 | 프라이버시 | 신뢰해야 하는 것 |
|---|---|---|---|
| 로컬 모델 | ✗ 희생됨 | ✓ | 없음 |
| 프런티어 모델(그대로) | ✓ | ✗ | 벤더, 그리고 자신의 주의력 |
| **프런티어 모델 + Prompt Anonymizer** | **✓** | **✓** | **읽을 수 있는 코드 + 전송 전 마지막 확인** |

텍스트가 컴퓨터를 떠나기 **전에** PII를 일관된 레이블(`<人名_1>`, `<Name_1>`,
`<Nombre_1>`, `<Tên_1>` 등)로 치환합니다. 같은 값에는 항상 같은 레이블이
붙기 때문에 LLM의 답변은 여전히 문맥이 통합니다. 응답이 돌아오면, 기기를
한 번도 떠난 적 없는 매핑이 실제 값을 복원합니다.

지원 언어: 영어(`en`), 일본어(`ja`), 스페인어(`es`), 베트남어(`vi`),
그리고 새로 추가된 중국어(`zh`), 한국어(`ko`), 프랑스어(`fr`),
독일어(`de`), 포르투갈어(`pt`), 이탈리아어(`it`). 기본값인
`PromptAnonymizer(languages=…)`는 여전히 `("en", "ja")`이며, 그 외 언어는
`languages=[...]`로 명시적으로 활성화합니다. 모든 UI의 언어 선택기와 자동
감지는 열 개 언어 전부를 지원합니다. 언어 지원은 레지스트리 기반입니다 —
언어 하나를 추가하는 데 필요한 것은 레지스트리 항목 하나
(`languages.py` / `types.ts`)와 레이블 파일 하나뿐입니다.

감지는 온디바이스에서 실행됩니다(브라우저에서는 WebGPU / WASM, Python에서는
spaCy 또는 로컬 transformers). 우리 말을 그대로 믿을 필요는 없습니다.
DevTools를 열어 네트워크 탭을 지켜보거나 소스를 직접 읽어보세요.
MIT 라이선스이며 한자리에서 다 감사할 수 있을 만큼 작은 코드베이스입니다.

<details>
<summary><b>목차</b></summary>

- [데모](#데모)
- [사용해 보기](#사용해-보기)
- [빠른 시작 (Python)](#빠른-시작-python)
- [빠른 시작 (JavaScript / TypeScript)](#빠른-시작-javascript--typescript)
- [빠른 시작 (로컬 프록시)](#빠른-시작-로컬-프록시)
- [커밋 시 / CI 게이트 (`scan`)](#커밋-시--ci-게이트-scan)
- [왜 다른 도구를 쓰지 않는가?](#왜-다른-도구를-쓰지-않는가)
- [동작 원리](#동작-원리)
- [지원 엔티티](#지원-엔티티)
- [정확도](#정확도)
- [제한 사항](#제한-사항)
- [로드맵](#로드맵)
- [Contributing / Security / License](#contributing--security--license)

</details>

## 데모

익명화 → 매핑은 로컬에 남음 → LLM 응답에는 레이블이 유지됨 → 복원:

<img alt="브라우저 앱 데모: 익명화, 매핑, 복원 왕복" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_web.gif?raw=true" width="85%">

<details>
<summary>CLI 데모 (일본어 / 영어 — 나머지 여덟 개 언어도 동일하게 동작)</summary>

<img alt="CLI 데모 (일본어)" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_ja.gif?raw=true" width="49%"> <img alt="CLI 데모 (영어)" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_en.gif?raw=true" width="49%">
</details>

<details>
<summary>Chrome 확장 프로그램 데모 (사이드 패널)</summary>

<img alt="Chrome 확장 프로그램 데모" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_extension.gif?raw=true" width="40%">
</details>

## 사용해 보기

| 대상 | 방법 | 비고 |
|---|---|---|
| **브라우저 (WebGPU)** | [akazah.github.io/prompt-anonymizer](https://akazah.github.io/prompt-anonymizer/) | 100% 온디바이스: NER이 WebGPU(미지원 시 WASM 폴백)로 브라우저 안에서 실행됩니다. 텍스트는 서버로 전혀 전송되지 않습니다 — 네트워크 탭에서 확인해 보세요. |
| **데스크톱 앱** | [Releases](https://github.com/akazah/prompt-anonymizer/releases)에서 다운로드 (`.dmg` / `.msi` / `.exe` / `.AppImage` / `.deb` / `.rpm`) | Tauri 2 기반. 현재는 서명되지 않아 첫 실행 시 OS 경고가 표시됩니다. |
| **Chrome 확장 프로그램** | [Releases](https://github.com/akazah/prompt-anonymizer/releases)의 `prompt-anonymizer-extension-*.zip` | 압축 해제 → `chrome://extensions` → 개발자 모드 활성화 → "압축해제된 확장 프로그램을 로드합니다". 텍스트 선택 → 우클릭 → *Anonymize selection*. |
| **Python / CLI** | `pip install git+https://github.com/akazah/prompt-anonymizer` (아직 PyPI 미게시) | Presidio + spaCy. 아래 빠른 시작 참고. |
| **Node CLI (npx)** | `npx @prompt-anonymizer/cli` (아직 npm 미게시 — `web/packages/cli`에서 빌드) | Python CLI와 동일한 명령·플래그. transformers.js NER, 완전 온디바이스. |
| **Web Component** | `@prompt-anonymizer/element` (아직 npm 미게시) | 프레임워크에 독립적인 `<prompt-anonymizer>` 요소: 익명화 → 복원 패널 전체를 어떤 사이트에도 삽입할 수 있습니다(순수 HTML, Svelte, Angular 등). |
| **React / Vue** | `@prompt-anonymizer/react` / `@prompt-anonymizer/vue` (아직 npm 미게시) | 바로 쓸 수 있는 `<AnonymizerPanel />` 컴포넌트와 커스텀 UI용 `useAnonymizer()` 훅 / 컴포저블. 아래 빠른 시작 참고. |
| **로컬 프록시 + 관리 GUI** | `@prompt-anonymizer/proxy` (아직 npm 미게시 — `web/packages/proxy`에서 빌드) | OpenAI 호환 리버스 프록시: `OPENAI_BASE_URL`을 이쪽으로 지정하면 PII가 컴퓨터를 떠나기 전에 마스킹되고, 응답의 레이블은 복원됩니다(스트리밍 포함). 관리 GUI는 `http://127.0.0.1:8787/admin/`. 아래 빠른 시작 참고. |
| **커밋 훅 / CI 게이트** | `prompt-anonymizer scan` (두 CLI 모두) + [`.pre-commit-hooks.yaml`](../../.pre-commit-hooks.yaml) | 종료 코드 기반 PII 게이트로 커밋 시·CI 검사에 사용: `file:line:col`과 엔티티 유형만 보고하며, 매칭된 텍스트는 절대 출력하지 않습니다. 기본값은 오프라인·모델 불필요. 아래 참고. |

## 빠른 시작 (Python)

```bash
# Not published to PyPI yet - install from GitHub (a tag, or main for latest):
pip install git+https://github.com/akazah/prompt-anonymizer@v0.2.2
python -m spacy download ja_core_news_sm   # en: en_core_web_sm; es: es_core_news_sm
python -m spacy download xx_ent_wiki_sm    # vi: no official spaCy pipeline — WikiNER
# zh: zh_core_web_sm; ko: ko_core_news_sm; fr/de/pt/it: *_core_news_sm — or
# install every sm model at once: uv sync --group models (lg: --group models-lg)
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

# vi 이름 감지에는 transformer 백엔드가 필요합니다("선택적 Transformer NER 백엔드" 참고)
pa_vi = PromptAnonymizer(languages=["vi"], ner_backend="hf")
pa_vi.anonymize(
    "Tôi tên là Nguyễn Văn An, số điện thoại 0912 345 678", language="vi"
).text  # 'Tôi tên là <Tên_1>, số điện thoại <SốĐiệnThoại_1>'

llm_output = call_your_llm(result.text)          # 레이블은 왕복 후에도 그대로 유지됨
pa.deanonymize(llm_output, result.mapping)       # 실제 값을 로컬에서 복원
```

CLI (`-l ja|en|es|vi|zh|ko|fr|de|pt|it`):

```bash
prompt-anonymizer anonymize -l ja --interactive --mapping-file mapping.json \
  -t "山田太郎の電話は090-1234-5678"
prompt-anonymizer anonymize -l es -t "El cliente es Javier Moreno, teléfono 612 345 678"
prompt-anonymizer anonymize -l fr -t "Le client est Pierre Durand, téléphone 06 12 34 56 78"
prompt-anonymizer deanonymize --mapping-file mapping.json -t "<人名_1>様 ..."
```

## 빠른 시작 (JavaScript / TypeScript)

Node CLI는 Python CLI와 동일합니다(같은 명령, 플래그, JSON 출력).
TypeScript 코어와 transformers.js NER을 온디바이스로 실행합니다:

```bash
# npm 미게시 — 저장소에서 빌드:
cd web && pnpm install && pnpm --filter "./packages/*" build
node packages/cli/dist/cli.js anonymize -t "山田太郎の電話は090-1234-5678"
# 게시 후: npx @prompt-anonymizer/cli anonymize -t "..."
```

익명화 → 복원 패널을 어떤 프런트엔드에든 그대로 삽입하려면 프레임워크에
독립적인 웹 컴포넌트를 사용하세요:

```html
<script type="module">
  import { definePromptAnonymizer } from "@prompt-anonymizer/element";
  definePromptAnonymizer();
</script>
<prompt-anonymizer language="auto"></prompt-anonymizer>
```

React(`@prompt-anonymizer/react`)와 Vue 3(`@prompt-anonymizer/vue`)은
이 요소를 감싼 타입 지원 `<AnonymizerPanel />`을 제공합니다:

```tsx
import { AnonymizerPanel } from "@prompt-anonymizer/react"; // 또는 "@prompt-anonymizer/vue"

<AnonymizerPanel language="auto" denyList={["ProjectX"]}
  onAnonymize={(result) => console.log(result.text)} />
```

커스텀 UI를 위해 두 패키지 모두 익명화 → LLM → 복원 세션을
훅 / 컴포저블로도 제공합니다:

```ts
import { useAnonymizer } from "@prompt-anonymizer/react"; // 또는 "@prompt-anonymizer/vue"

const { anonymize, restore, mapping, busy, error } = useAnonymizer();
const result = await anonymize(input, { language: "ja" });
// result.text를 LLM에 전송 — 매핑은 기기를 떠나지 않습니다 — 그 다음:
const { text: restored, unresolved } = await restore(llmReply);
```

기본 감지는 정규식 전용입니다(이메일, 전화번호 등). `ner`(예:
`@prompt-anonymizer/core`의 `new TransformersNerBackend()`)를 넘기면
이름과 위치도 마스킹합니다.

## 빠른 시작 (로컬 프록시)

OpenAI 호환 프록시를 실행하고 아무 클라이언트나 그쪽으로 지정하세요 —
요청이 컴퓨터를 떠나기 전에 PII가 마스킹되고, 응답에서는 레이블이
복원됩니다(스트리밍 포함). 매핑은 요청 단위로 프록시 메모리에만
유지됩니다:

```bash
# npm 미게시 — 저장소에서 빌드:
cd web && pnpm install && pnpm --filter @prompt-anonymizer/proxy... build
node packages/proxy/dist/cli.js            # http://127.0.0.1:8787 에서 수신
# 게시 후: npx @prompt-anonymizer/proxy

# 앱 / 셸에서:
export OPENAI_BASE_URL=http://127.0.0.1:8787/v1
```

관리 GUI(`http://127.0.0.1:8787/admin/`)에서는 실시간 상태와 마스킹
이벤트(레이블과 건수만)를 확인하고, 프록시 설정(업스트림, NER,
deny/allow 목록)을 편집하며, 로컬 전용 익명화 플레이그라운드를 사용할
수 있습니다. 프록시는 기본적으로 `127.0.0.1`에 바인딩되며, 원본 값은
`--record-mappings`를 명시적으로 활성화한 경우에만 GUI에서 볼 수
있습니다.

## 커밋 시 / CI 게이트 (`scan`)

두 CLI 모두 git 훅과 CI를 위해 설계된 `scan` 하위 명령을 제공합니다.
입력이 깨끗하면 종료 코드 `0`, PII가 발견되면 `1`, 오류 시 `2`로
종료합니다. `file:line:col`과 엔티티 유형만 보고하며 — **매칭된 텍스트는
절대 출력되지 않으므로** 훅 출력과 CI 로그에 PII가 남지 않습니다.
기본값은 오프라인·결정적·모델 불필요입니다(구조화된 PII: 이메일,
전화번호, 일본 우편번호, My Number, 신용카드 — 그리고 `--deny` 지정 단어).
`--ner`을 켜면 모델이 있는 환경에서 이름 / 위치 감지도 수행합니다.

```bash
prompt-anonymizer scan src/prompt.txt docs/*.md      # 파일 (예: 스테이징된 파일)
git diff --cached -U0 | prompt-anonymizer scan       # 또는 diff를 파이프로 전달
prompt-anonymizer scan --deny ProjectX --json -t "..."
```

[pre-commit](https://pre-commit.com) 프레임워크와 함께 사용하기
(훅 정의: [`.pre-commit-hooks.yaml`](../../.pre-commit-hooks.yaml)):

```yaml
repos:
  - repo: https://github.com/akazah/prompt-anonymizer
    rev: v0.2.2  # first tag that ships this hook
    hooks:
      - id: prompt-anonymizer-scan
        # args: [--deny, ProjectX, --allow, support@example.com]
```

Node 프로젝트는 husky + lint-staged로 같은 게이트를 연결할 수 있습니다
(게시 후에는 `npx @prompt-anonymizer/cli`, 그 전까지는
`web/packages/cli`에서 빌드):

```json
{ "lint-staged": { "*": "prompt-anonymizer scan" } }
```

다른 기능과 마찬가지로 감지는 최선의 노력(best-effort)입니다. `scan`은
명백한 유출을 막는 안전망이지 보증이 아닙니다.

## 왜 다른 도구를 쓰지 않는가?

**그냥 Presidio를 쓰면 되지 않나?** 범용 PII 감지 / 익명화 프레임워크가
필요하다면 [Microsoft Presidio](https://github.com/microsoft/presidio)를
직접 사용하세요. Prompt Anonymizer는 Python 코어의 엔진으로 Presidio를
사용하면서 그 위에 LLM 왕복 워크플로를 얹습니다: 일관된 플레이스홀더,
익명화된 프롬프트 출력, 응답 후 로컬 복원 — 여기에 Python이 전혀 필요
없는 브라우저·확장 프로그램·데스크톱 형태까지 제공합니다.

**LLM Guard는 왜 아닌가?** [LLM Guard](https://github.com/protectai/llm-guard)는
자체 Anonymize/Deanonymize를 갖춘 탄탄한 Python 측 가드레일 스위트입니다.
Prompt Anonymizer는 세 가지가 다릅니다: 일본어 우선 감지(일본인 이름,
주소, 체크 디지트 검증이 있는 My Number), 비개발자용 형태(브라우저
페이지에 텍스트를 붙여넣기만 하면 됨 — Python 설정 불필요), 그리고
실제로 다 읽을 수 있을 만큼 작은 코드베이스입니다.

**"100% 로컬"을 내세우는 Chrome 확장 프로그램은 왜 아닌가?** 로컬 처리를
주장하는 클로즈드 소스 확장 프로그램이 여럿 있습니다. 주장은 감사가
아닙니다. 이 프로젝트는 MIT 라이선스입니다: 네트워크 탭을 열거나 소스를
읽어보세요. (대화를 외부로 유출하는 악성 "AI 프라이버시" 확장 프로그램이
실제로 보고된 바 있습니다 — 이 카테고리가 의심받는 데는 이유가 있습니다.)

## 동작 원리

1. 감지 — Presidio + spaCy NER(Python) 또는 transformers.js NER + 정규식
   인식기(브라우저 / 데스크톱 / 확장 프로그램). 레지스트리 기반의 로캘별
   전화번호 패턴(JP, US/NANP, ES, VN, CN, KR, FR, DE, PT, IT)과 일본
   특화 인식기(〒 우편번호, 체크 디지트 검증이 있는 My Number)로
   확장됩니다. 이메일과 신용카드는 언어에 독립적이며, JP_POSTAL_CODE와
   JP_MY_NUMBER는 모든 언어 모드에서 감지됩니다.
2. 일관된 레이블링 — 스팬을 점수 우선으로 병합하고 오프셋 기반으로
   끝에서부터 치환합니다. 동일한 값은 하나의 레이블을 공유합니다.
3. 복원 — `deanonymize(text, mapping)`이 레이블 길이가 긴 것부터 원본을
   복원합니다. 매핑은 호출자에게 반환되며 라이브러리는 **절대 영속화하지
   않습니다** — 안전하게 보관하는 것은 사용자의 책임입니다.

## 지원 엔티티

| 엔티티 | ja 레이블 | en 레이블 | es 레이블 | vi 레이블 | 엔진 |
|---|---|---|---|---|---|
| PERSON | 人名 | Name | Nombre | Tên | NER |
| LOCATION | 住所 | Location | Dirección | ĐịaChỉ | NER |
| EMAIL_ADDRESS | メールアドレス | Email | Correo | Email | 패턴 |
| PHONE_NUMBER | 電話番号 | Phone | Teléfono | SốĐiệnThoại | 레지스트리 기반 언어별 패턴 + libphonenumber 리전 (JP/US/ES/VN/CN/KR/FR/DE/PT/IT) |
| JP_POSTAL_CODE | 郵便番号 | PostalCode | CódigoPostal | MãBưuĐiện | 패턴 (커스텀) |
| JP_MY_NUMBER | マイナンバー | MyNumber | MyNumber | MyNumber | 패턴 + 체크 디지트 (커스텀) |
| CREDIT_CARD | クレジットカード | CreditCard | Tarjeta | ThẻTínDụng | 패턴 + Luhn 검사 (두 코어, 모든 언어) |
| CUSTOM (deny list) | 秘匿情報 | Custom | Personalizado | TùyChỉnh | 완전 일치 |
| US_SSN (opt-in) | 社会保障番号 | SSN | SSN | SSN | 패턴 + 무효값 규칙 (두 코어, 모든 언어) |
| IBAN_CODE (opt-in) | IBAN | IBAN | IBAN | IBAN | 패턴 + mod-97 검사 (두 코어, 모든 언어) |

새 여섯 개 언어(zh, ko, fr, de, pt, it)의 레이블은
`src/prompt_anonymizer/labels/*.yaml`(Python)과
`web/packages/core/src/labeling.ts`의 `LABELS`(TS)에 들어 있습니다.

`deny_list`는 특정 문자열의 마스킹을 강제하고, `allow_list`는 이를
제외합니다. opt-in 엔티티는 기본적으로 감지되지 않습니다 — 명시적으로
요청하세요: `PromptAnonymizer(entities=[...])`,
`new Anonymizer({ entities })`, 또는 두 CLI의
`--entities PERSON,EMAIL_ADDRESS,US_SSN,IBAN_CODE`.

### 선택적 Transformer NER 백엔드 (Python)

기본 NER은 spaCy이며 언어별 모델은 중앙 레지스트리에서 결정됩니다
(아래 표 참고. `sm` 모델 전체는 `uv sync --group models`, `lg`는
`--group models-lg`, 또는 `python -m spacy download <model>`로 설치).
베트남어에는 공식 spaCy 파이프라인이 없어 두 모델 크기 모두 다국어
WikiNER 모델 `xx_ent_wiki_sm`으로 토큰화와 기본 PER/LOC NER을
수행합니다. 베트남어 이름 / 위치 재현율을 제대로 얻으려면 아래의
transformer 백엔드를 사용하세요.

PERSON/LOCATION 재현율을 크게 높이고 싶다면(특히 `ja`와 `vi`) `hf`
extra를 설치하고 백엔드를 전환하세요 — 언어별 Hugging Face 모델을
완전히 로컬에서 실행합니다:

| 언어 | spaCy (`sm` / `lg`) | HF NER (`ner_backend="hf"`) |
|---|---|---|
| `ja` | `ja_core_news_sm` / `ja_core_news_lg` | `tsmatz/xlm-roberta-ner-japanese` |
| `en` | `en_core_web_sm` / `en_core_web_lg` | `dslim/bert-base-NER` |
| `es` | `es_core_news_sm` / `es_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `vi` | `xx_ent_wiki_sm` (두 크기 모두) | `NlpHUST/ner-vietnamese-electra-base` |
| `zh` | `zh_core_web_sm` / `zh_core_web_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `ko` | `ko_core_news_sm` / `ko_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `fr` | `fr_core_news_sm` / `fr_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `de` | `de_core_news_sm` / `de_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `pt` | `pt_core_news_sm` / `pt_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `it` | `it_core_news_sm` / `it_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |

다국어 HRL 모델은 `de`/`es`/`fr`/`it`/`pt`/`zh`를 네이티브로 지원합니다.
한국어는 이 계열에 전용 체크포인트가 없어 mBERT의 언어 간 전이에
의존합니다.

TypeScript 코어(브라우저 / 확장 프로그램 / 데스크톱 / Node CLI)는
transformers.js ONNX 모델을 실행합니다. `ja`와 `en`은 위와 같은 계열을
사용하고, `es`, `vi`, `zh`, `ko`, `fr`, `de`, `pt`, `it`은 모두
`Xenova/bert-base-multilingual-cased-ner-hrl`을 사용합니다(전용 베트남어
NER 모델의 ONNX 익스포트는 존재하지 않으며, 다국어 모델이 베트남어에도
잘 전이됩니다. 한국어에도 같은 전이 관련 유의점이 적용됩니다).

```bash
pip install "prompt-anonymizer[hf]"
```

```python
pa = PromptAnonymizer(languages=["ja"], ner_backend="hf")  # CLI: --ner-backend hf
pa_vi = PromptAnonymizer(languages=["vi"], ner_backend="hf")  # vi 이름에 권장
```

배치 처리도 제공되며 루프보다 훨씬 빠릅니다:

```python
results = pa.anonymize_batch(texts, language="ja", batch_size=16)
```

## 정확도

시드 고정 합성 골든 세트(전체 열 개 언어 각 200개 문서,
`tests/golden/golden_{lang}.json`)에서 스팬 단위로 측정 — 전체 표는
[docs/EVAL.md](../EVAL.md), 재현은 `uv run python -m prompt_anonymizer.evals`
(기본값은 전체 열 개 언어). 요약(Python 코어, `sm` 모델): ja의
PHONE_NUMBER / EMAIL_ADDRESS / JP_POSTAL_CODE / CREDIT_CARD 재현율 1.00;
ja PERSON은 spaCy에서 재현율 0.82, `ner_backend="hf"`에서 1.00. es/vi의
PHONE_NUMBER 재현율도 1.00이며, vi의 PERSON/LOCATION은
`ner_backend="hf"`로 크게 개선됩니다. 새 여섯 개 언어(zh, ko, fr, de,
pt, it)의 구조화된 PII 재현율(전화 / 이메일 / 카드)은 골든 세트에서
1.00입니다 — TS 코어 표는 [docs/EVAL.md](../EVAL.md) 참고. Python NER
수치는 주간 eval에서 생성됩니다.

이 수치는 회귀를 잡기 위한 것이지 실제 텍스트에 대한 재현율을 약속하는
것이 아닙니다.

## 제한 사항

- **감지는 최선의 노력이며 보장되지 않습니다.** 미탐(false negative)은
  발생할 수 있습니다. 익명화된 텍스트를 어디로든 보내기 전에 반드시
  검토하세요(`--interactive`와 각 UI의 매핑 테이블이 그 용도입니다).
- 익명화는 식별자를 숨길 뿐 맥락은 숨기지 않습니다. 주변 텍스트의
  준식별 정보(희귀한 직함, 특정 행사 등)만으로도 누구에 대해, 무엇에
  대해 쓰고 있는지 좁혀질 수 있습니다.
- LOCATION은 재현율이 가장 약한 엔티티이며, 특히 일본어 주소의 부분
  표기에 취약합니다.
- 브라우저 NER 모델은 최초 1회 약 100–300 MB를 다운로드합니다(이후에는
  캐시됩니다).
- 데스크톱과 확장 프로그램 빌드는 현재 서명되어 있지 않습니다.

## 로드맵

열려 있는 [issues](https://github.com/akazah/prompt-anonymizer/issues)와
[IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md)를 참고하세요. 주요 항목:
npm / PyPI 게시, 스토어 게시(Chrome Web Store), 코드 서명, 더 작은 일본어
NER 모델, 다지역 구조화 PII(체크섬 검증을 통한 전화번호 / 국민 ID 형식
추가), MCP 서버.

## Contributing / Security / License

- [CONTRIBUTING.md](../../.github/CONTRIBUTING.md) — 개발 환경 설정(uv / pnpm), 테스트·평가 명령
- [SECURITY.md](../../.github/SECURITY.md) — 취약점 및 익명화 우회 보고
- [MIT](../../LICENSE)
