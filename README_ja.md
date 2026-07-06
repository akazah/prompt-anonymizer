[English](README.md) | 日本語

# Prompt Anonymizer

> **PIIを見せずにフロンティアLLMを使う。**
> 復元可能・オンデバイスの匿名化 — 知能とプライバシーを天秤にかけない。

[![CI](https://github.com/akazah/prompt-anonymizer/actions/workflows/ci.yml/badge.svg)](https://github.com/akazah/prompt-anonymizer/actions/workflows/ci.yml)
[![Python](https://img.shields.io/badge/python-3.12%E2%80%933.13-blue)](pyproject.toml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

現状の選択肢は2つです。ローカルモデルを動かす — プライベートだが、
フロンティア級の知能は諦めることになる。あるいはChatGPT / Claude / Gemini に
貼り付けて、プロンプトごとに自分で気をつける。Prompt Anonymizerはその中間に
位置します:

|  | 知能 | プライバシー | 信頼しなければならないもの |
|---|---|---|---|
| ローカルモデル | ✗ 犠牲になる | ✓ | なし |
| フロンティアモデル（そのまま） | ✓ | ✗ | ベンダーと、自分自身の注意力 |
| **フロンティアモデル + Prompt Anonymizer** | **✓** | **✓** | **読めるコード + 送信前の最終確認** |

テキストが手元を離れる**前に**、PIIを一貫したラベル（`<人名_1>`、`<Name_1>`
など）へ置き換えます。同じ値には常に同じラベルが割り当てられるため、LLMの
回答は文脈を保ったまま。返ってきた応答は、手元から一度も出ていない対応表
（mapping）で元の値に復元できます。

検出はオンデバイスで実行されます（ブラウザではWebGPU / WASM、Pythonでは
spaCyまたはローカルのtransformers）。私たちの言葉を鵜呑みにする必要は
ありません。DevToolsを開いてネットワークタブを監視するか、ソースを読んで
ください。MITライセンスで、一度に読み切れる規模のコードベースです。

## デモ

匿名化 → 対応表はローカルに残る → LLM応答にはラベルが残る → 復元:

<img alt="ブラウザ版デモ: 匿名化・対応表・復元のラウンドトリップ" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_web.gif?raw=true" width="85%">

<details>
<summary>CLIデモ（日本語 / 英語）</summary>

<img alt="CLIデモ（日本語）" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_ja.gif?raw=true" width="49%"> <img alt="CLIデモ（英語）" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_en.gif?raw=true" width="49%">
</details>

<details>
<summary>Chrome拡張デモ（サイドパネル）</summary>

<img alt="Chrome拡張デモ" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_extension.gif?raw=true" width="40%">
</details>

## 使ってみる

| ターゲット | 入手方法 | 補足 |
|---|---|---|
| **ブラウザ版（WebGPU）** | [akazah.github.io/prompt-anonymizer](https://akazah.github.io/prompt-anonymizer/) | 完全オンデバイス。NERはWebGPU（非対応環境はWASM）でブラウザ内実行され、テキストはサーバーへ一切送信されません — ネットワークタブで確認できます。 |
| **デスクトップアプリ** | [Releases](https://github.com/akazah/prompt-anonymizer/releases) から `.dmg` / `.msi` / `.AppImage` / `.deb` | Tauri 2製。現状は未署名のため初回起動時にOSの警告が出ます。 |
| **Chrome拡張** | [Releases](https://github.com/akazah/prompt-anonymizer/releases) の `prompt-anonymizer-extension-*.zip` | 展開 → `chrome://extensions` → デベロッパーモード → 「パッケージ化されていない拡張機能を読み込む」。テキスト選択 → 右クリック → *Anonymize selection*。 |
| **Python / CLI** | `pip install git+https://github.com/akazah/prompt-anonymizer`（PyPI未公開） | Presidio + spaCy。下のQuickstart参照。 |
| **Node CLI（npx）** | `npx @prompt-anonymizer/cli`（npm未公開 — `web/packages/cli` からビルド） | Python CLIと同じコマンド・フラグ。transformers.js NERで完全オンデバイス。 |
| **Web Component** | `@prompt-anonymizer/element`（npm未公開） | フレームワーク非依存の `<prompt-anonymizer>` 要素。匿名化→復元パネルを任意のサイトへ埋め込み可能（素のHTML・Svelte・Angular等）。 |
| **React / Vue** | `@prompt-anonymizer/react` / `@prompt-anonymizer/vue`（npm未公開） | 組み込み用 `<AnonymizerPanel />` コンポーネント + カスタムUI向け `useAnonymizer()` フック / コンポーザブル。下のQuickstart参照。 |

## Quickstart（Python）

```bash
# PyPI未公開のためGitHubからインストール（タグ指定、またはmainで最新）:
pip install git+https://github.com/akazah/prompt-anonymizer@v0.2.0
python -m spacy download ja_core_news_sm   # 英語も使う場合は en_core_web_sm も
```

```python
from prompt_anonymizer import PromptAnonymizer

pa = PromptAnonymizer(languages=["ja"])
result = pa.anonymize("山田太郎の電話は090-1234-5678", language="ja")

result.text     # '<人名_1>の電話は<電話番号_1>'
result.mapping  # {'<人名_1>': '山田太郎', '<電話番号_1>': '090-1234-5678'}

llm_output = call_your_llm(result.text)      # ラベルはLLM応答にそのまま残る
pa.deanonymize(llm_output, result.mapping)   # ローカルで元の値に復元
```

CLI:

```bash
prompt-anonymizer anonymize -l ja --interactive --mapping-file mapping.json \
  -t "山田太郎の電話は090-1234-5678"
prompt-anonymizer deanonymize --mapping-file mapping.json -t "<人名_1>様 ..."
```

## Quickstart（JavaScript / TypeScript）

Node CLIはPython CLIのミラーです（同じコマンド・フラグ・JSON出力）。
TypeScriptコア + transformers.js NERをオンデバイスで実行します:

```bash
# npm未公開のためリポジトリからビルド:
cd web && pnpm install && pnpm --filter "./packages/*" build
node packages/cli/dist/cli.js anonymize -t "山田太郎の電話は090-1234-5678"
# 公開後は: npx @prompt-anonymizer/cli anonymize -t "..."
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
スイートです。Prompt Anonymizerは3点で異なります: 日本語ファーストの検出
（日本人名・住所・検査用数字の検証つきマイナンバー）、非開発者向けの
ターゲット（ブラウザページにテキストを貼るだけ — Pythonのセットアップ
不要）、そして実際に読み切れる規模のコードベースです。

**「100%ローカル」を謳うChrome拡張ではだめなのか？** ローカル処理を主張
するクローズドソースの拡張は複数あります。しかし主張は監査ではありません。
このプロジェクトはMITライセンスです: ネットワークタブを開くか、ソースを
読んでください。（会話を外部送信する悪意ある「AIプライバシー」拡張は実際に
報告されており、このカテゴリが疑われるのには理由があります。）

## 仕組み

1. 検出 — Presidio + spaCy NER（Python）／transformers.js NER + 正規表現認識器
   （ブラウザ・デスクトップ・拡張）。日本の電話番号・〒付き郵便番号・
   マイナンバー（検査用数字の検証つき）などの日本語向けカスタム認識器を追加。
2. 一貫ラベリング — スパンをスコア優先でマージし、末尾側からオフセットベースで
   置換。同じ値には同じラベル。
3. 復元 — `deanonymize(text, mapping)` がラベル長の降順で元の値に戻します。
   mappingは呼び出し側に返され、ライブラリは**永続化しません**（保存する場合の
   管理責任は利用者側にあります）。

## 対応エンティティ

| エンティティ | jaラベル | enラベル | エンジン |
|---|---|---|---|
| PERSON | 人名 | Name | NER |
| LOCATION | 住所 | Location | NER |
| EMAIL_ADDRESS | メールアドレス | Email | パターン |
| PHONE_NUMBER | 電話番号 | Phone | パターン（JP/US表記ゆれ）+ libphonenumber（Python） |
| JP_POSTAL_CODE | 郵便番号 | PostalCode | パターン（カスタム） |
| JP_MY_NUMBER | マイナンバー | MyNumber | パターン + 検査用数字（カスタム） |
| CREDIT_CARD | クレジットカード | CreditCard | パターン + Luhn検査（両コア, ja/en） |
| CUSTOM（deny list） | 秘匿情報 | Custom | 完全一致 |

`deny_list` で特定の語を強制マスク、`allow_list` で除外できます。

### オプションのTransformer NERバックエンド（Python）

デフォルトのNERはspaCyです。日本語の人名・住所の再現率を大きく上げたい
場合は `hf` extra を入れてバックエンドを切り替えられます。ブラウザ版が
transformers.jsで使うのと同系統のモデルを、完全にローカルで実行します:

```bash
pip install "prompt-anonymizer[hf]"
```

```python
pa = PromptAnonymizer(languages=["ja"], ner_backend="hf")  # CLI: --ner-backend hf
```

複数テキストは `anonymize_batch(texts, language="ja", batch_size=16)` で
ループより高速に処理できます。

## 精度

シード固定の合成ゴールデンセット（各言語200文書）でスパン単位計測。全表は
[docs/EVAL.md](docs/EVAL.md)、再現は `python -m prompt_anonymizer.evals`。
概要（Pythonコア・`sm`モデル）: ja の PHONE_NUMBER / EMAIL_ADDRESS /
JP_POSTAL_CODE / CREDIT_CARD は recall 1.00、ja PERSON は spaCy で
recall 0.82、`ner_backend="hf"` で 1.00。

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
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) を参照。主なもの:
npm / PyPI公開、Chrome Web Store公開、コード署名、より小型の日本語NER
モデル、多地域の構造化PII（チェックサム検証による電話番号・国民ID形式の
追加）、MCPサーバー。

## Contributing / Security / License

- [CONTRIBUTING.md](CONTRIBUTING.md) — 開発環境（uv / pnpm）、テスト・評価の実行手順
- [SECURITY.md](SECURITY.md) — 脆弱性・匿名化バイパスの報告窓口
- [MIT](LICENSE)
