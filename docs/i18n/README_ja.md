[English](../../README.md) | 日本語 | [Español](README_es.md) | [Tiếng Việt](README_vi.md) | [中文](README_zh.md) | [한국어](README_ko.md) | [Français](README_fr.md) | [Deutsch](README_de.md) | [Português](README_pt.md) | [Italiano](README_it.md)

# Prompt Anonymizer

> **プロンプトに、送る前のダブルチェックを。**
> オンデバイスで復元可能な匿名化が、送るつもりのなかったPIIを捕まえます。

[![CI](https://github.com/akazah/prompt-anonymizer/actions/workflows/ci.yml/badge.svg)](https://github.com/akazah/prompt-anonymizer/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/akazah/prompt-anonymizer)](https://github.com/akazah/prompt-anonymizer/releases)
[![Python](https://img.shields.io/badge/python-3.12%E2%80%933.13-blue)](pyproject.toml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)

あなたのチームには既にルールがあるはずです —「顧客データや秘密情報、
個人情報を ChatGPT / Claude / Gemini に貼らない」。でも人は急いでいて、
名前や電話番号がつい紛れ込む。Prompt Anonymizer はその**ダブルチェック**役です。
処理は**手元のマシンで完結**し、テキストが外に出る**前に**PIIを捕まえるので、
うっかりが漏洩になりません。ルールやあなたの判断を置き換えるものではなく、
それを裏打ちします。

| PIIのうっかりに対する防御層 | 捕まえる？ | 信頼するもの |
|---|---|---|
| ルール（文書）だけ | ✗ 記憶頼み | 全員が毎回守ること |
| 直前の自分の注意 | 〜 覚えていれば | 急いでいる最中の注意力 |
| **+ Prompt Anonymizer** | **✓ 自動・オンデバイス** | **読めるコード** |

PIIは一貫したラベル（`<人名_1>`、`<Name_1>`、`<Nombre_1>`、`<Tên_1>` など）へ、
テキストが手元を離れる**前に**置き換えられます。同じ値には常に同じラベルが
割り当てられるため、LLMの回答は文脈を保ったまま — 安全のためにフロンティア級の
知能を諦める必要はありません。返ってきた応答は、手元から一度も出ていない
対応表（mapping）で元の値に復元できます。

人には、ブラウザ・デスクトップアプリ・Chrome拡張での「もう一つの目」。
パイプラインには、同じチェックが自動で走ります — OpenAI互換プロキシは
送信前にマスクし、`scan` ゲートはPIIが紛れたコミットやCI実行を失敗させます。

対応言語は英語（`en`）、日本語（`ja`）、スペイン語（`es`）、ベトナム語（`vi`）
に加え、新たに中国語（`zh`）、韓国語（`ko`）、フランス語（`fr`）、
ドイツ語（`de`）、ポルトガル語（`pt`）、イタリア語（`it`）の計10言語です。
デフォルトの `PromptAnonymizer(languages=…)` は引き続き `("en", "ja")` のままで、
それ以外の言語は `languages=[...]` でオプトインします。各UIの言語ピッカーと
自動検出は10言語すべてをカバーします。言語サポートはレジストリ駆動です —
言語の追加はレジストリ1エントリ（`languages.py` / `languages.ts`）+
ラベルファイル1つで済みます。

検出はオンデバイスで実行されます（ブラウザではWebGPU / WASM、Pythonでは
spaCyまたはローカルのtransformers）。私たちの言葉を鵜呑みにする必要は
ありません。DevToolsを開いてネットワークタブを監視するか、ソースを読んで
ください。MITライセンスで、一度に読み切れる規模のコードベースです —
手順は [docs/AUDIT.md](../AUDIT.md)（英語）にまとめてあります。

<details>
<summary><b>目次</b></summary>

- [デモ](#デモ)
- [使ってみる](#使ってみる)
- [Quickstart（Python）](#quickstartpython)
- [Quickstart（JavaScript / TypeScript）](#quickstartjavascript--typescript)
- [Quickstart（ローカルプロキシ）](#quickstartローカルプロキシ)
- [Quickstart（MCPサーバー）](#quickstartmcpサーバー)
- [コミット時 / CIゲート（`scan`）](#コミット時--ciゲートscan)
- [なぜ〇〇ではないのか？](#なぜ〇〇ではないのか)
- [仕組み](#仕組み)
- [対応エンティティ](#対応エンティティ)
- [精度](#精度)
- [制限事項](#制限事項)
- [ロードマップ](#ロードマップ)
- [Contributing / Security / License](#contributing--security--license)

</details>

## デモ

匿名化 → 対応表はローカルに残る → LLM応答にはラベルが残る → 復元:

<img alt="ブラウザ版デモ: 匿名化・対応表・復元のラウンドトリップ" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_web_ja.gif?raw=true" width="85%">

<details>
<summary>CLIデモ</summary>

<img alt="CLIデモ" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_ja.gif?raw=true" width="70%">
</details>

<details>
<summary>Chrome拡張デモ（サイドパネル）</summary>

<img alt="Chrome拡張デモ" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_extension_ja.gif?raw=true" width="40%">
</details>

## 使ってみる

| ターゲット | 入手方法 | 補足 |
|---|---|---|
| **ブラウザ版（WebGPU）** | [akazah.github.io/prompt-anonymizer](https://akazah.github.io/prompt-anonymizer/) | 完全オンデバイス。NERはWebGPU（非対応環境はWASM）でブラウザ内実行され、テキストはサーバーへ一切送信されません — ネットワークタブで確認できます。 |
| **デスクトップアプリ** | [Releases](https://github.com/akazah/prompt-anonymizer/releases) から `.dmg` / `.msi` / `.exe` / `.AppImage` / `.deb` / `.rpm` | Tauri 2製。現状は未署名のため初回起動時にOSの警告が出ます。 |
| **Chrome拡張** | [Releases](https://github.com/akazah/prompt-anonymizer/releases) の `prompt-anonymizer-extension-*.zip` | 展開 → `chrome://extensions` → デベロッパーモード → 「パッケージ化されていない拡張機能を読み込む」。テキスト選択 → 右クリック → *Anonymize selection*。 |
| **Python / CLI** | `pip install prompt-anonymizer` | Presidio + spaCy。下のQuickstart参照。 |
| **Node CLI（npx）** | `npx @prompt-anonymizer/cli` | Python CLIと同じコマンド・フラグ。transformers.js NERで完全オンデバイス。 |
| **Web Component** | `@prompt-anonymizer/element` | フレームワーク非依存の `<prompt-anonymizer>` 要素。匿名化→復元パネルを任意のサイトへ埋め込み可能（素のHTML・Svelte・Angular等）。 |
| **React / Vue** | `@prompt-anonymizer/react` / `@prompt-anonymizer/vue` | 組み込み用 `<AnonymizerPanel />` コンポーネント + カスタムUI向け `useAnonymizer()` フック / コンポーザブル。下のQuickstart参照。 |
| **ローカルプロキシ + 管理GUI** | `npx @prompt-anonymizer/proxy` | OpenAI互換のリバースプロキシ。`OPENAI_BASE_URL` を向けるだけでPIIをマスクして送信し、応答内のラベルを復元（ストリーミング対応）。管理GUIは `http://127.0.0.1:8787/admin/`。下のQuickstart参照。 |
| **MCPサーバー** | `npx @prompt-anonymizer/mcp` | MCPクライアント（Claude Desktop / Claude Code / Cursor など）向けの `anonymize` / `deanonymize` / `scan` ツール。マッピングはサーバーメモリ内に保持（`mapping_id` 参照）され、明示的に要求しない限りモデルには渡りません。下のQuickstart参照。 |
| **コミットフック / CIゲート** | `prompt-anonymizer scan`（両CLI） + [`.pre-commit-hooks.yaml`](../../.pre-commit-hooks.yaml) | 終了コードで判定するPIIゲート。`file:line:col` とエンティティ種別のみを報告し、検出したテキスト自体は出力しません。デフォルトはオフライン・モデル不要。下の解説参照。 |

## Quickstart（Python）

```bash
pip install prompt-anonymizer
python -m spacy download ja_core_news_sm   # en: en_core_web_sm; es: es_core_news_sm
python -m spacy download xx_ent_wiki_sm    # vi: 公式spaCyパイプラインなし — WikiNER
# zh: zh_core_web_sm; ko: ko_core_news_sm; fr/de/pt/it: *_core_news_sm —
# smモデル一括なら uv sync --group models（lgは --group models-lg）
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

# vi の人名検出には transformer バックエンドを推奨（後述の「オプションのTransformer NERバックエンド」参照）
pa_vi = PromptAnonymizer(languages=["vi"], ner_backend="hf")
pa_vi.anonymize(
    "Tôi tên là Nguyễn Văn An, số điện thoại 0912 345 678", language="vi"
).text  # 'Tôi tên là <Tên_1>, số điện thoại <SốĐiệnThoại_1>'

llm_output = call_your_llm(result.text)      # ラベルはLLM応答にそのまま残る
pa.deanonymize(llm_output, result.mapping)   # ローカルで元の値に復元
```

CLI（`-l ja|en|es|vi|zh|ko|fr|de|pt|it`）:

```bash
prompt-anonymizer anonymize -l ja --interactive --mapping-file mapping.json \
  -t "山田太郎の電話は090-1234-5678"
prompt-anonymizer anonymize -l es -t "El cliente es Javier Moreno, teléfono 612 345 678"
prompt-anonymizer anonymize -l fr -t "Le client est Pierre Durand, téléphone 06 12 34 56 78"
prompt-anonymizer deanonymize --mapping-file mapping.json -t "<人名_1>様 ..."
```

## Quickstart（JavaScript / TypeScript）

Node CLIはPython CLIのミラーです（同じコマンド・フラグ・JSON出力）。
TypeScriptコア + transformers.js NERをオンデバイスで実行します:

```bash
npx @prompt-anonymizer/cli anonymize -t "山田太郎の電話は090-1234-5678"
```

匿名化→復元パネルを任意のフロントエンドへ埋め込むには、フレームワーク
非依存のWeb Componentを使います:

```html
<script type="module">
  import { definePromptAnonymizer } from "@prompt-anonymizer/element";
  definePromptAnonymizer();
</script>
<prompt-anonymizer language="auto"></prompt-anonymizer>
```

React（`@prompt-anonymizer/react`）/ Vue 3（`@prompt-anonymizer/vue`）には
この要素を包む型付き `<AnonymizerPanel />` があります:

```tsx
import { AnonymizerPanel } from "@prompt-anonymizer/react"; // または "@prompt-anonymizer/vue"

<AnonymizerPanel language="auto" denyList={["ProjectX"]}
  onAnonymize={(result) => console.log(result.text)} />
```

カスタムUI向けには「匿名化 → LLM → 復元」のセッションをフック /
コンポーザブルとしても提供します:

```ts
import { useAnonymizer } from "@prompt-anonymizer/react"; // または "@prompt-anonymizer/vue"

const { anonymize, restore, mapping, busy, error } = useAnonymizer();
const result = await anonymize(input, { language: "ja" });
// result.text をLLMへ送信（mappingは手元に残ります）。応答が来たら:
const { text: restored, unresolved } = await restore(llmReply);
```

デフォルトは正規表現のみの検出（メール・電話番号など）です。人名・住所も
マスクするには `@prompt-anonymizer/core` の
`new TransformersNerBackend()` を `ner` として渡してください。

## Quickstart（ローカルプロキシ）

OpenAI互換プロキシを起動してクライアントを向けるだけで、リクエストが
マシンを離れる前にPIIがマスクされ、応答内のラベルは復元されます
（ストリーミング対応）。マッピングはリクエスト単位でプロキシのメモリ内
にのみ保持されます:

```bash
npx @prompt-anonymizer/proxy            # http://127.0.0.1:8787 で待ち受け

# アプリ / シェル側:
export OPENAI_BASE_URL=http://127.0.0.1:8787/v1
```

管理GUI（`http://127.0.0.1:8787/admin/`）では、稼働状況とリダクション
イベント（ラベルと件数のみ）の確認、設定（上流URL・NER・deny/allow
リスト）の編集、ローカル完結の匿名化プレイグラウンドが使えます。
プロキシはデフォルトで `127.0.0.1` にバインドされ、元の値のGUI表示は
`--record-mappings` を明示的に有効化した場合のみ可能です。

## Quickstart（MCPサーバー）

MCPクライアント（Claude Desktop / Claude Code / Cursor など）に、
オンデバイス匿名化ツールを追加できます:

```bash
# Claude Code:
claude mcp add prompt-anonymizer -- npx -y @prompt-anonymizer/mcp
```

3つのツールはいずれも「PIIをモデルのコンテキストに入れない」設計です:
`anonymize` はマスク済みテキストと `mapping_id` を返し（マッピング自体は
明示的に要求しない限りサーバーメモリ内に留まります）、`deanonymize` は
`mapping_id` で復元（ファイルへの直接書き出しも可能）、`scan` はファイルの
PIIチェックで `file:line:col` と種別のみを報告します（検出テキストは決して
出力しません）。サーバー引数に `--ner` を付けると人名・住所もマスクします
（初回のみモデルをダウンロード）。

## コミット時 / CIゲート（`scan`）

両CLIには、gitフックやCI向けに設計された `scan` サブコマンドがあります。
入力がクリーンなら終了コード `0`、PIIが見つかれば `1`、エラーは `2` です。
報告するのは `file:line:col` とエンティティ種別のみで、**検出したテキスト
自体は決して出力しません** — フックの出力やCIログにPIIが残らない設計です。
デフォルトはオフライン・決定的・モデル不要（構造化PII: メール・電話番号・
郵便番号・マイナンバー・クレジットカード + `--deny` 指定語）。`--ner` を
付けるとモデルのある環境で人名・住所も検査できます。

```bash
prompt-anonymizer scan src/prompt.txt docs/*.md      # ファイル（ステージ済みなど）
git diff --cached -U0 | prompt-anonymizer scan       # diffをパイプしてもOK
prompt-anonymizer scan --deny ProjectX --json -t "..."
```

[pre-commit](https://pre-commit.com) フレームワークから使う場合
（フック定義: [`.pre-commit-hooks.yaml`](../../.pre-commit-hooks.yaml)）:

```yaml
repos:
  - repo: https://github.com/akazah/prompt-anonymizer
    rev: v0.3.0
    hooks:
      - id: prompt-anonymizer-scan
        # args: [--deny, ProjectX, --allow, support@example.com]
```

Nodeプロジェクトなら husky + lint-staged で同じゲートを組めます
（`npx @prompt-anonymizer/cli scan`）:

```json
{ "lint-staged": { "*": "prompt-anonymizer scan" } }
```

他の機能と同じく検出はベストエフォートです。`scan` は明白な漏れを止める
セーフティネットであり、保証ではありません。

## なぜ〇〇ではないのか？

**Presidioをそのまま使えばいいのでは？** 汎用のPII検出・匿名化フレーム
ワークが必要なら [Microsoft Presidio](https://github.com/microsoft/presidio)
を直接使ってください。Prompt AnonymizerはPythonコアのエンジンとして
Presidioを使いつつ、その上にLLMラウンドトリップのワークフローを載せて
います: 一貫したプレースホルダー、匿名化済みプロンプトの出力、応答後の
ローカル復元 — さらにPythonが一切不要なブラウザ・拡張・デスクトップの
各ターゲットも提供します。

**LLM Guardではだめなのか？** [LLM Guard](https://github.com/protectai/llm-guard)
は独自のAnonymize/Deanonymizeを備えた、堅実なPython側ガードレール
スイートです。Prompt Anonymizerは3点で異なります: 10言語をまたぐ多言語検出と
ロケール固有の構造化PII（検査用数字を検証するマイナンバーなどの各国ID、
地域別の電話番号形式）、非開発者向けのターゲット（ブラウザページに
テキストを貼るだけ — Pythonのセットアップ不要）、そして実際に読み切れる
規模のコードベースです。

**「100%ローカル」を謳うChrome拡張ではだめなのか？** ローカル処理を主張
するクローズドソースの拡張は複数あります。しかし主張は監査ではありません。
このプロジェクトはMITライセンスです: ネットワークタブを開くか、ソースを
読んでください。（会話を外部送信する悪意ある「AIプライバシー」拡張は実際に
報告されており、このカテゴリが疑われるのには理由があります。）

## 仕組み

1. 検出 — Presidio + spaCy NER（Python）／transformers.js NER + 正規表現認識器
   （ブラウザ・デスクトップ・拡張）。レジストリ駆動の地域別電話番号パターン
   （JP・US/NANP・ES・VN・CN・KR・FR・DE・PT・IT）と、
   〒付き郵便番号・マイナンバー（検査用数字の検証つき）などの日本向け
   カスタム認識器を追加。メール・クレジットカードは言語非依存;
   JP_POSTAL_CODE と JP_MY_NUMBER は全言語モードで検出されます。
2. 一貫ラベリング — スパンをスコア優先でマージし、末尾側からオフセットベースで
   置換。同じ値には同じラベル。
3. 復元 — `deanonymize(text, mapping)` がラベル長の降順で元の値に戻します。
   mappingは呼び出し側に返され、ライブラリは**永続化しません**（保存する場合の
   管理責任は利用者側にあります）。

## 対応エンティティ

| エンティティ | jaラベル | enラベル | esラベル | viラベル | エンジン |
|---|---|---|---|---|---|
| PERSON | 人名 | Name | Nombre | Tên | NER |
| LOCATION | 住所 | Location | Dirección | ĐịaChỉ | NER |
| EMAIL_ADDRESS | メールアドレス | Email | Correo | Email | パターン |
| PHONE_NUMBER | 電話番号 | Phone | Teléfono | SốĐiệnThoại | レジストリ駆動の言語別パターン + libphonenumberリージョン（JP/US/ES/VN/CN/KR/FR/DE/PT/IT） |
| JP_POSTAL_CODE | 郵便番号 | PostalCode | CódigoPostal | MãBưuĐiện | パターン（カスタム） |
| JP_MY_NUMBER | マイナンバー | MyNumber | MyNumber | MyNumber | パターン + 検査用数字（カスタム） |
| CREDIT_CARD | クレジットカード | CreditCard | Tarjeta | ThẻTínDụng | パターン + Luhn検査（両コア、全言語） |
| CUSTOM（deny list） | 秘匿情報 | Custom | Personalizado | TùyChỉnh | 完全一致 |
| US_SSN（opt-in） | 社会保障番号 | SSN | SSN | SSN | パターン + 無効値ルール（両コア、全言語） |
| IBAN_CODE（opt-in） | IBAN | IBAN | IBAN | IBAN | パターン + mod-97検査（両コア、全言語） |

新規6言語（zh・ko・fr・de・pt・it）のラベルは
`src/prompt_anonymizer/labels/*.yaml`（Python）と
`web/packages/core/src/labeling.ts` の `LABELS`（TS）に収録されています。

`deny_list` で特定の語を強制マスク、`allow_list` で除外できます。
opt-inエンティティはデフォルトでは検出されません。
`PromptAnonymizer(entities=[...])`、`new Anonymizer({ entities })`、または
CLIの `--entities PERSON,EMAIL_ADDRESS,US_SSN,IBAN_CODE` で明示指定してください。

### オプションのTransformer NERバックエンド（Python）

デフォルトのNERはspaCyで、言語ごとのモデルは中央レジストリから解決されます
（下表参照。smモデル一式は `uv sync --group models`、lgは
`--group models-lg`、または `python -m spacy download <モデル名>` で
インストール）。ベトナム語には公式のspaCyパイプラインがなく、両サイズとも
多言語WikiNERモデル `xx_ent_wiki_sm` でトークン化とベースラインのPER/LOC NERを
行います。ベトナム語の人名・住所の再現率を上げるには、下記のtransformer
バックエンドの利用を推奨します。

人名・住所の再現率を大きく上げたい場合（特に `ja` と `vi`）は `hf` extra を
入れてバックエンドを切り替えられます。言語ごとのHugging Faceモデルを完全に
ローカルで実行します:

| 言語 | spaCy（`sm` / `lg`） | HF NER（`ner_backend="hf"`） |
|---|---|---|
| `ja` | `ja_core_news_sm` / `ja_core_news_lg` | `tsmatz/xlm-roberta-ner-japanese` |
| `en` | `en_core_web_sm` / `en_core_web_lg` | `dslim/bert-base-NER` |
| `es` | `es_core_news_sm` / `es_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `vi` | `xx_ent_wiki_sm`（両サイズ） | `NlpHUST/ner-vietnamese-electra-base` |
| `zh` | `zh_core_web_sm` / `zh_core_web_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `ko` | `ko_core_news_sm` / `ko_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `fr` | `fr_core_news_sm` / `fr_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `de` | `de_core_news_sm` / `de_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `pt` | `pt_core_news_sm` / `pt_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `it` | `it_core_news_sm` / `it_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |

多言語HRLモデルは `de`/`es`/`fr`/`it`/`pt`/`zh` をネイティブにカバーします。
韓国語にはこのファミリーの専用チェックポイントがなく、mBERTの言語間転移に
依存します。

TypeScriptコア（ブラウザ・拡張・デスクトップ・Node CLI）はtransformers.jsの
ONNXモデルを使用します。`ja` と `en` は上記と同系統、`es`・`vi`・`zh`・`ko`・
`fr`・`de`・`pt`・`it` はいずれも
`Xenova/bert-base-multilingual-cased-ner-hrl`（専用ベトナム語NERのONNX
エクスポートは存在しないが、多言語モデルはベトナム語にもよく転移する。
韓国語にも同じ転移の注意が当てはまる）。

```bash
pip install "prompt-anonymizer[hf]"
```

```python
pa = PromptAnonymizer(languages=["ja"], ner_backend="hf")  # CLI: --ner-backend hf
pa_vi = PromptAnonymizer(languages=["vi"], ner_backend="hf")  # vi の人名向けに推奨
```

複数テキストは `anonymize_batch(texts, language="ja", batch_size=16)` で
ループより高速に処理できます。

## 精度

シード固定の合成ゴールデンセット（全10言語 各200文書、
`tests/golden/golden_{lang}.json`）でスパン単位計測。全表は
[docs/EVAL.md](../EVAL.md)、再現は `uv run python -m prompt_anonymizer.evals`
（デフォルトで全10言語）。概要（Pythonコア・`sm`モデル）: ja の PHONE_NUMBER /
EMAIL_ADDRESS / JP_POSTAL_CODE / CREDIT_CARD は recall 1.00、ja PERSON は
spaCy で recall 0.82、`ner_backend="hf"` で 1.00。es/vi の PHONE_NUMBER も
recall 1.00; vi の PERSON/LOCATION は `ner_backend="hf"` で大きく改善します。
新規6言語（zh・ko・fr・de・pt・it）の構造化PII（電話・メール・カード）の
recallはゴールデンセット上で 1.00 です — TSコアの表は
[docs/EVAL.md](../EVAL.md) を参照。PythonのNER数値は週次evalで生成されます。

この数値はリグレッション検知のためのものであり、実世界のテキストに対する
再現率を約束するものではありません。

## 制限事項

- **検出はベストエフォートであり保証されません。** 見逃し（false negative）は
  起こりえます。送信前に必ず匿名化結果を確認してください（そのための
  `--interactive` と各UIの対応表表示です）。
- 匿名化が隠すのは識別子であり、文脈ではありません。周囲のテキストに残る
  準識別的な情報（珍しい役職、特定のイベントなど）から、誰について・何に
  ついて書いているかが絞り込まれる可能性はあります。
- LOCATIONが最も弱く、特に日本語住所の部分表記は苦手です。
- ブラウザ版のNERモデルは初回のみ約100–300MBのダウンロードが発生します
  （以降はキャッシュされます）。
- デスクトップ版・拡張は現状未署名です。

## ロードマップ

[Issues](https://github.com/akazah/prompt-anonymizer/issues) と
[IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) を参照。主なもの:
PyPI / npm レジストリ公開（Trusted Publishing の有効化 — 現時点では
GitHub Releases からインストール可能）、Chrome Web Store 公開、コード署名、
より小型の日本語NERモデル、多地域の構造化PII（チェックサム検証による
電話番号・国民ID形式の追加）、**段階的マスク（オプトイン）** — 同姓の示し方・電話の局番のみ残す・
住所は都道府県市区町村まで残すなど、各国・各ロケールのルールと法域ごとの
プライバシー要件に慎重に合わせた粗粒度の保持ポリシー（実装前にスコープ
定義が必要。残す部分も準識別情報になり得る）。

## Contributing / Security / License

- [docs/INTEGRATIONS.md](../INTEGRATIONS.md) — LiteLLM、OpenWebUI、MCP クライアント、git フックと CI のレシピ
- [CONTRIBUTING.md](../../.github/CONTRIBUTING.md) — 開発環境（uv / pnpm）、テスト・評価の実行手順
- [docs/AUDIT.md](../AUDIT.md) — オンデバイス主張を自分で検証する手順
- [SECURITY.md](../../.github/SECURITY.md) — 脆弱性・匿名化バイパスの報告窓口
- [MIT](../../LICENSE)
