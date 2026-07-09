[English](../../README.md) | [日本語](README_ja.md) | [Español](README_es.md) | [Tiếng Việt](README_vi.md) | 中文 | [한국어](README_ko.md) | [Français](README_fr.md) | [Deutsch](README_de.md) | [Português](README_pt.md) | [Italiano](README_it.md)

# Prompt Anonymizer

> **提示词的二次复核 —— 在它们到达 LLM 之前。**
> 可逆的设备端匿名化，帮你抓住不小心要发出去的 PII。

[![CI](https://github.com/akazah/prompt-anonymizer/actions/workflows/ci.yml/badge.svg)](https://github.com/akazah/prompt-anonymizer/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/akazah/prompt-anonymizer)](https://github.com/akazah/prompt-anonymizer/releases)
[![Python](https://img.shields.io/badge/python-3.12%E2%80%933.13-blue)](pyproject.toml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)

你的团队早已有一条规矩：*不要把客户数据、机密或个人信息粘贴进
ChatGPT / Claude / Gemini。* 但人总在赶时间，一个姓名或电话号码就溜了过去。
Prompt Anonymizer 就是那次复核 —— 它在**你的机器上**运行，在文本离开**之前**
抓住这些 PII，让一次疏忽不至于变成一次泄露。它不取代规矩，也不取代你的判断，
而是为它们兜底。

| 针对 PII 疏忽的防线 | 能否抓住？ | 你需要信任的东西 |
|---|---|---|
| 仅靠一纸制度 | ✗ 依赖记性 | 每个人、每一次 |
| 你自己临发前的警惕 | ～ 想起来时 | 赶时间中的你的注意力 |
| **+ Prompt Anonymizer** | **✓ 自动、设备端** | **可以读懂的代码** |

它会在文本离开你的机器**之前**，把 PII 替换为一致的标签（`<人名_1>`、
`<Name_1>`、`<Nombre_1>`、`<Tên_1>` 等）。由于同一个值总是得到同一个标签，
LLM 的回答依然保持连贯 —— 你无需为了安全而放弃前沿级智能。回复返回后，
从未离开设备的映射表（mapping）会把真实值还原回来。

对人而言，它是浏览器、桌面应用或 Chrome 扩展里的第二双眼睛。对流水线而言，
同样的检查会自动执行 —— 兼容 OpenAI 的代理在出站前先做掩码，`scan` 关卡
会在 PII 混入时让一次提交或 CI 运行失败。

支持的语言：英语（`en`）、日语（`ja`）、西班牙语（`es`）、越南语（`vi`），
以及新增的中文（`zh`）、韩语（`ko`）、法语（`fr`）、德语（`de`）、
葡萄牙语（`pt`）和意大利语（`it`）。默认的 `PromptAnonymizer(languages=…)`
仍为 `("en", "ja")`；其他所有语言通过 `languages=[...]` 显式启用。各 UI 的
语言选择器和自动检测覆盖全部十种语言。语言支持由注册表驱动 — 新增一种
语言只需一条注册表记录（`languages.py` / `languages.ts`）加一个标签文件。

检测在设备端运行（浏览器中为 WebGPU / WASM，Python 中为 spaCy 或本地
transformers）。不必轻信我们的说法：打开 DevTools 盯着网络面板，或者直接
读源码。它采用 MIT 许可证，代码量小到一口气就能审完。

<details>
<summary><b>目录</b></summary>

- [演示](#演示)
- [立即试用](#立即试用)
- [快速上手（Python）](#快速上手python)
- [快速上手（JavaScript / TypeScript）](#快速上手javascript--typescript)
- [快速上手（本地代理）](#快速上手本地代理)
- [快速上手（MCP 服务器）](#快速上手mcp-服务器)
- [提交时 / CI 门禁（`scan`）](#提交时--ci-门禁scan)
- [为什么不用……？](#为什么不用)
- [工作原理](#工作原理)
- [支持的实体](#支持的实体)
- [准确率](#准确率)
- [局限性](#局限性)
- [路线图](#路线图)
- [Contributing / Security / License](#contributing--security--license)

</details>

## 演示

匿名化 → 映射表留在本地 → LLM 回复保留标签 → 还原：

<img alt="浏览器应用演示：匿名化、映射表、还原的完整往返" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_web_zh.gif?raw=true" width="85%">

<details>
<summary>CLI 演示</summary>

<img alt="CLI 演示" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_zh.gif?raw=true" width="70%">
</details>

<details>
<summary>Chrome 扩展演示（侧边栏）</summary>

<img alt="Chrome 扩展演示" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_extension_zh.gif?raw=true" width="40%">
</details>

## 立即试用

| 目标 | 方式 | 说明 |
|---|---|---|
| **浏览器（WebGPU）** | [akazah.github.io/prompt-anonymizer](https://akazah.github.io/prompt-anonymizer/) | 100% 设备端：NER 通过 WebGPU（不支持时回退到 WASM）在浏览器内运行。你的文本从不发送到任何服务器 — 可在网络面板中验证。 |
| **桌面应用** | 从 [Releases](https://github.com/akazah/prompt-anonymizer/releases) 下载（`.dmg` / `.msi` / `.exe` / `.AppImage` / `.deb` / `.rpm`） | 基于 Tauri 2。目前未签名 — 首次启动时操作系统会弹出警告。 |
| **Chrome 扩展** | [Releases](https://github.com/akazah/prompt-anonymizer/releases) 中的 `prompt-anonymizer-extension-*.zip` | 解压 → `chrome://extensions` → 开启开发者模式 → “加载已解压的扩展程序”。选中文本 → 右键 → *Anonymize selection*。 |
| **Python / CLI** | `pip install prompt-anonymizer` | Presidio + spaCy。参见下方快速上手。 |
| **Node CLI（npx）** | `npx @prompt-anonymizer/cli` | 与 Python CLI 相同的命令和参数；transformers.js NER，完全设备端。 |
| **Web Component** | `@prompt-anonymizer/element` | 与框架无关的 `<prompt-anonymizer>` 元素：把完整的匿名化 → 还原面板嵌入任意站点（纯 HTML、Svelte、Angular 等）。 |
| **React / Vue** | `@prompt-anonymizer/react` / `@prompt-anonymizer/vue` | 开箱即用的 `<AnonymizerPanel />` 组件，外加面向自定义 UI 的 `useAnonymizer()` hook / 组合式函数。参见下方快速上手。 |
| **本地代理 + 管理 GUI** | `npx @prompt-anonymizer/proxy` | OpenAI 兼容的反向代理：把 `OPENAI_BASE_URL` 指向它，PII 在离开你的机器前被遮蔽，响应中的标签被还原（含流式）。管理 GUI 位于 `http://127.0.0.1:8787/admin/`。参见下方快速上手。 |
| **MCP 服务器** | `npx @prompt-anonymizer/mcp` | 面向任意 MCP 客户端（Claude Desktop、Claude Code、Cursor 等）的 `anonymize` / `deanonymize` / `scan` 工具。标签映射保存在服务器内存中（`mapping_id`），除非显式请求，否则不会展示给模型。参见下方快速上手。 |
| **提交钩子 / CI 门禁** | `prompt-anonymizer scan`（两个 CLI 均有） + [`.pre-commit-hooks.yaml`](../../.pre-commit-hooks.yaml) | 基于退出码的 PII 门禁，用于提交时和 CI 检查：只报告 `file:line:col` 和实体类型，绝不输出匹配到的文本。默认离线、无需模型。见下文。 |

## 快速上手（Python）

```bash
pip install prompt-anonymizer
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

# vi 的人名检测需要 transformer 后端（见“可选的 Transformer NER 后端”）
pa_vi = PromptAnonymizer(languages=["vi"], ner_backend="hf")
pa_vi.anonymize(
    "Tôi tên là Nguyễn Văn An, số điện thoại 0912 345 678", language="vi"
).text  # 'Tôi tên là <Tên_1>, số điện thoại <SốĐiệnThoại_1>'

llm_output = call_your_llm(result.text)          # 标签在往返过程中原样保留
pa.deanonymize(llm_output, result.mapping)       # 在本地还原真实值
```

CLI（`-l ja|en|es|vi|zh|ko|fr|de|pt|it`）：

```bash
prompt-anonymizer anonymize -l ja --interactive --mapping-file mapping.json \
  -t "山田太郎の電話は090-1234-5678"
prompt-anonymizer anonymize -l es -t "El cliente es Javier Moreno, teléfono 612 345 678"
prompt-anonymizer anonymize -l fr -t "Le client est Pierre Durand, téléphone 06 12 34 56 78"
prompt-anonymizer deanonymize --mapping-file mapping.json -t "<人名_1>様 ..."
```

## 快速上手（JavaScript / TypeScript）

Node CLI 与 Python CLI 完全对应（相同的命令、参数和 JSON 输出），
在设备端运行 TypeScript 核心与 transformers.js NER：

```bash
npx @prompt-anonymizer/cli anonymize -t "山田太郎の電話は090-1234-5678"
```

要把现成的匿名化 → 还原面板嵌入任意前端，使用与框架无关的
Web Component：

```html
<script type="module">
  import { definePromptAnonymizer } from "@prompt-anonymizer/element";
  definePromptAnonymizer();
</script>
<prompt-anonymizer language="auto"></prompt-anonymizer>
```

React（`@prompt-anonymizer/react`）和 Vue 3（`@prompt-anonymizer/vue`）
提供了包装该元素的带类型 `<AnonymizerPanel />`：

```tsx
import { AnonymizerPanel } from "@prompt-anonymizer/react"; // 或 "@prompt-anonymizer/vue"

<AnonymizerPanel language="auto" denyList={["ProjectX"]}
  onAnonymize={(result) => console.log(result.text)} />
```

对于自定义 UI，两个包还把匿名化 → LLM → 还原的会话暴露为
hook / 组合式函数：

```ts
import { useAnonymizer } from "@prompt-anonymizer/react"; // 或 "@prompt-anonymizer/vue"

const { anonymize, restore, mapping, busy, error } = useAnonymizer();
const result = await anonymize(input, { language: "ja" });
// 把 result.text 发送给 LLM — mapping 从不离开设备 — 然后:
const { text: restored, unresolved } = await restore(llmReply);
```

默认只做正则检测（邮箱、电话号码等）；传入 `ner`（例如来自
`@prompt-anonymizer/core` 的 `new TransformersNerBackend()`）即可同时
遮蔽人名和地址。

## 快速上手（本地代理）

启动 OpenAI 兼容代理，把任意客户端指向它 — PII 在请求离开你的机器前
被遮蔽，响应中的标签被还原（包含流式）。映射表按请求保存在代理内存中：

```bash
npx @prompt-anonymizer/proxy            # 监听 http://127.0.0.1:8787

# 在你的应用 / shell 中:
export OPENAI_BASE_URL=http://127.0.0.1:8787/v1
```

管理 GUI（`http://127.0.0.1:8787/admin/`）显示实时状态和脱敏事件
（仅标签和计数），可编辑代理配置（上游、NER、deny/allow 列表），
并提供一个仅限本地的匿名化演练场。代理默认绑定 `127.0.0.1`；只有在
显式启用 `--record-mappings` 时，原始值才能在 GUI 中查看。

## 快速上手（MCP 服务器）

为任意 MCP 客户端 — Claude Desktop、Claude Code、Cursor 等 — 提供设备端匿名化工具：

```bash
# Claude Code:
claude mcp add prompt-anonymizer -- npx -y @prompt-anonymizer/mcp
```

三个工具均旨在让 PII 不进入模型上下文：`anonymize` 返回脱敏文本和
`mapping_id`（映射默认留在服务器内存，除非你显式要求返回），`deanonymize`
按 `mapping_id` 还原 — 也可直接写入文件 — `scan` 检查文件中的 PII，只报告
`file:line:col` 和实体类型，绝不打印匹配文本。在服务器参数中传入 `--ner` 可
额外遮盖人名/地址（首次使用时一次性下载模型）。

## 提交时 / CI 门禁（`scan`）

两个 CLI 都提供为 git 钩子和 CI 设计的 `scan` 子命令：输入干净时退出码
为 `0`，发现 PII 为 `1`，出错为 `2`。它只报告 `file:line:col` 和实体
类型 — **匹配到的文本绝不打印**，因此钩子输出和 CI 日志中不会残留 PII。
默认离线、确定性、无需模型（结构化 PII：邮箱、电话号码、日本邮编、
My Number、信用卡 — 外加 `--deny` 指定的词）；`--ner` 可在有模型的环境中
额外启用人名 / 地址检测。

```bash
prompt-anonymizer scan src/prompt.txt docs/*.md      # 文件（例如已暂存的）
git diff --cached -U0 | prompt-anonymizer scan       # 或者用管道传入 diff
prompt-anonymizer scan --deny ProjectX --json -t "..."
```

配合 [pre-commit](https://pre-commit.com) 框架使用
（钩子定义：[`.pre-commit-hooks.yaml`](../../.pre-commit-hooks.yaml)）：

```yaml
repos:
  - repo: https://github.com/akazah/prompt-anonymizer
    rev: v0.3.1
    hooks:
      - id: prompt-anonymizer-scan
        # args: [--deny, ProjectX, --allow, support@example.com]
```

Node 项目可通过 husky + lint-staged 接入同样的门禁
（`npx @prompt-anonymizer/cli scan`）：

```json
{ "lint-staged": { "*": "prompt-anonymizer scan" } }
```

和这里的其他功能一样，检测是尽力而为的：把 `scan` 当作拦截明显泄漏的
安全网，而不是一种保证。

## 为什么不用……？

**为什么不直接用 Presidio？** 如果你需要通用的 PII 检测 / 匿名化框架，
请直接使用 [Microsoft Presidio](https://github.com/microsoft/presidio)。
Prompt Anonymizer 以 Presidio 作为其 Python 核心的引擎，并在其之上叠加了
LLM 往返工作流：一致的占位符、输出匿名化后的提示词、响应返回后的本地
还原 — 此外还提供完全不需要 Python 的浏览器、扩展和桌面形态。

**为什么不用 LLM Guard？** [LLM Guard](https://github.com/protectai/llm-guard)
是一套扎实的 Python 侧护栏套件，自带 Anonymize/Deanonymize。
Prompt Anonymizer 有三点不同：日语优先的检测（日文人名、地址、带校验位
验证的 My Number）、面向非开发者的形态（在浏览器页面里粘贴文本即可 —
无需配置 Python），以及一个真正读得完的代码库。

**为什么不用某个“100% 本地”的 Chrome 扩展？** 若干闭源扩展声称本地
处理。声称不等于审计。本项目采用 MIT 许可证：打开网络面板，或者读源码。
（外泄对话的恶意“AI 隐私”扩展已有实录 — 这个品类被质疑是有原因的。）

## 工作原理

1. 检测 — Presidio + spaCy NER（Python）或 transformers.js NER + 正则
   识别器（浏览器 / 桌面 / 扩展），并以注册表驱动的地区电话号码模式
   （JP、US/NANP、ES、VN、CN、KR、FR、DE、PT、IT）和日本专用识别器
   （带 〒 的邮编、带校验位验证的 My Number）加以扩展。邮箱和信用卡
   与语言无关；JP_POSTAL_CODE 和 JP_MY_NUMBER 在所有语言模式下均被检测。
2. 一致标注 — 跨度按分数优先合并，并基于偏移量从末尾开始替换；相同的值
   共享同一个标签。
3. 还原 — `deanonymize(text, mapping)` 按标签长度降序还原原始值。映射表
   返回给你，库**从不持久化**它；安全地保存它是你的责任。

## 支持的实体

| 实体 | ja 标签 | en 标签 | es 标签 | vi 标签 | 引擎 |
|---|---|---|---|---|---|
| PERSON | 人名 | Name | Nombre | Tên | NER |
| LOCATION | 住所 | Location | Dirección | ĐịaChỉ | NER |
| EMAIL_ADDRESS | メールアドレス | Email | Correo | Email | 模式 |
| PHONE_NUMBER | 電話番号 | Phone | Teléfono | SốĐiệnThoại | 注册表驱动的按语言模式 + libphonenumber 地区（JP/US/ES/VN/CN/KR/FR/DE/PT/IT） |
| JP_POSTAL_CODE | 郵便番号 | PostalCode | CódigoPostal | MãBưuĐiện | 模式（自定义） |
| JP_MY_NUMBER | マイナンバー | MyNumber | MyNumber | MyNumber | 模式 + 校验位（自定义） |
| CREDIT_CARD | クレジットカード | CreditCard | Tarjeta | ThẻTínDụng | 模式 + Luhn 校验（两个核心、所有语言） |
| CUSTOM（deny list） | 秘匿情報 | Custom | Personalizado | TùyChỉnh | 精确匹配 |
| US_SSN（opt-in） | 社会保障番号 | SSN | SSN | SSN | 模式 + 无效值规则（两个核心、所有语言） |
| IBAN_CODE（opt-in） | IBAN | IBAN | IBAN | IBAN | 模式 + mod-97 校验（两个核心、所有语言） |

六种新语言（zh、ko、fr、de、pt、it）的标签收录在
`src/prompt_anonymizer/labels/*.yaml`（Python）以及
`web/packages/core/src/labeling.ts` 中的 `LABELS`（TS）。

`deny_list` 强制遮蔽特定字符串；`allow_list` 将其豁免。
opt-in 实体默认不检测 — 需要显式请求：
`PromptAnonymizer(entities=[...])`、`new Anonymizer({ entities })`，或在
任一 CLI 上使用 `--entities PERSON,EMAIL_ADDRESS,US_SSN,IBAN_CODE`。

### 可选的 Transformer NER 后端（Python）

默认 NER 为 spaCy，每种语言的模型从中央注册表解析（见下表；用
`uv sync --group models` 一次性安装全部 `sm` 模型，`lg` 模型用
`--group models-lg`，或使用 `python -m spacy download <model>`）。
越南语没有官方 spaCy 流水线 — 两种模型规格都使用多语言 WikiNER 模型
`xx_ent_wiki_sm` 进行分词和基线 PER/LOC NER。若要获得良好的越南语
人名 / 地址召回率，请改用 transformer 后端（见下文）。

若想显著提升 PERSON/LOCATION 召回率（尤其是 `ja` 和 `vi`），安装
`hf` extra 并切换后端 — 按语言使用 Hugging Face 模型，完全在本地运行：

| 语言 | spaCy（`sm` / `lg`） | HF NER（`ner_backend="hf"`） |
|---|---|---|
| `ja` | `ja_core_news_sm` / `ja_core_news_lg` | `tsmatz/xlm-roberta-ner-japanese` |
| `en` | `en_core_web_sm` / `en_core_web_lg` | `dslim/bert-base-NER` |
| `es` | `es_core_news_sm` / `es_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `vi` | `xx_ent_wiki_sm`（两种规格） | `NlpHUST/ner-vietnamese-electra-base` |
| `zh` | `zh_core_web_sm` / `zh_core_web_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `ko` | `ko_core_news_sm` / `ko_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `fr` | `fr_core_news_sm` / `fr_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `de` | `de_core_news_sm` / `de_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `pt` | `pt_core_news_sm` / `pt_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `it` | `it_core_news_sm` / `it_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |

多语言 HRL 模型原生覆盖 `de`/`es`/`fr`/`it`/`pt`/`zh`；
韩语在该系列中没有专用检查点，依赖 mBERT 的跨语言迁移。

TypeScript 核心（浏览器 / 扩展 / 桌面 / Node CLI）运行 transformers.js 的
ONNX 模型：`ja` 和 `en` 使用与上表相同的系列；`es`、`vi`、`zh`、`ko`、
`fr`、`de`、`pt` 和 `it` 全部使用
`Xenova/bert-base-multilingual-cased-ner-hrl`（不存在专用越南语 NER 模型的
ONNX 导出；多语言模型对越南语迁移良好，同样的迁移注意事项也适用于韩语）。

```bash
pip install "prompt-anonymizer[hf]"
```

```python
pa = PromptAnonymizer(languages=["ja"], ner_backend="hf")  # CLI: --ner-backend hf
pa_vi = PromptAnonymizer(languages=["vi"], ner_backend="hf")  # 推荐用于 vi 人名
```

也提供批量处理，比循环快得多：

```python
results = pa.anonymize_batch(texts, language="ja", batch_size=16)
```

## 准确率

在带随机种子的合成黄金数据集上按跨度级别测量（全部十种语言各 200 篇
文档，位于 `tests/golden/golden_{lang}.json`）— 完整表格见
[docs/EVAL.md](../EVAL.md)，用 `uv run python -m prompt_anonymizer.evals`
复现（默认为全部十种语言）。要点（Python 核心、`sm` 模型）：ja 的
PHONE_NUMBER / EMAIL_ADDRESS / JP_POSTAL_CODE / CREDIT_CARD 召回率为 1.00；
ja PERSON 用 spaCy 召回率 0.82，用 `ner_backend="hf"` 为 1.00。es/vi 的
PHONE_NUMBER 召回率同样为 1.00；vi 的 PERSON/LOCATION 在
`ner_backend="hf"` 下有显著提升。六种新语言（zh、ko、fr、de、pt、it）的
结构化 PII 召回率（电话 / 邮箱 / 卡号）在黄金数据集上为 1.00 —
[docs/EVAL.md](../EVAL.md) 有 TS 核心的表格；Python 的 NER 数值由每周
eval 生成。

这些数字的用途是捕捉回归，而非承诺在真实文本上的召回率。

## 局限性

- **检测是尽力而为的，没有任何保证。** 漏检（false negative）会发生；
  在把匿名化后的文本发往任何地方之前，务必先检查一遍
  （`--interactive` 以及各 UI 中的映射表就是为此准备的）。
- 匿名化隐藏的是标识符，不是上下文。周围文本中的准标识信息
  （一个罕见的职位头衔、一次特定的活动）仍可能缩小你在谈论谁或什么
  的范围。
- LOCATION 是召回率最弱的实体，对不完整的日文地址尤其如此。
- 浏览器端 NER 模型需要一次性下载约 100–300 MB（之后会被缓存）。
- 桌面版和扩展的构建目前未签名。

## 路线图

参见开放的 [issues](https://github.com/akazah/prompt-anonymizer/issues) 和
[IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md)。重点：PyPI / npm
注册表发布（启用 Trusted Publishing — 目前可从 GitHub Releases 安装）、
Chrome Web Store 上架、代码签名、更小的日语 NER 模型、多地区结构化
PII（通过校验和验证支持更多电话 / 国民 ID 格式）。

## Contributing / Security / License

- [docs/INTEGRATIONS.md](../INTEGRATIONS.md) — LiteLLM、OpenWebUI、MCP 客户端、git 钩子与 CI 的集成示例
- [CONTRIBUTING.md](../../.github/CONTRIBUTING.md) — 开发环境（uv / pnpm）、测试与评估命令
- [docs/AUDIT.md](../AUDIT.md) — 逐步自行验证设备端声明
- [SECURITY.md](../../.github/SECURITY.md) — 报告漏洞与匿名化绕过
- [MIT](../../LICENSE)
