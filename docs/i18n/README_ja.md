[English](../../README.md) | 日本語 | [Español](README_es.md) | [Tiếng Việt](README_vi.md) | [中文](README_zh.md) | [한국어](README_ko.md) | [Français](README_fr.md) | [Deutsch](README_de.md) | [Português](README_pt.md) | [Italiano](README_it.md)

# Prompt Anonymizer

> **PIIを見せずにフロンティアLLMを使う。**
> 復元可能・オンデバイスの匿名化 — 知能とプライバシーを天秤にかけない。

[![CI](https://github.com/akazah/prompt-anonymizer/actions/workflows/ci.yml/badge.svg)](https://github.com/akazah/prompt-anonymizer/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/akazah/prompt-anonymizer)](https://github.com/akazah/prompt-anonymizer/releases)
[![Python](https://img.shields.io/badge/python-3.12%E2%80%933.13-blue)](pyproject.toml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)

現状の選択肢は2つです。ローカルモデルを動かす — プライベートだが、
フロンティア級の知能は諦めることになる。あるいはChatGPT / Claude / Gemini に
貼り付けて、プロンプトごとに自分で気をつける。Prompt Anonymizerはその中間に
位置します:

|  | 知能 | プライバシー | 信頼しなければならないもの |
|---|---|---|---|
| ローカルモデル | ✗ 犠牲になる | ✓ | なし |
| フロンティアモデル（そのまま） | ✓ | ✗ | ベンダーと、自分自身の注意力 |
| **フロンティアモデル + Prompt Anonymizer** | **✓** | **✓** | **読めるコード + 送信前の最終確認** |

テキストが手元を離れる**前に**、PIIを一貫したラベル（`<人名_1>`、`<Name_1>`、
`<Nombre_1>`、`<Tên_1>` など）へ置き換えます。同じ値には常に同じラベルが
割り当てられるため、LLMの回答は文脈を保ったまま。返ってきた応答は、手元から
一度も出ていない対応表（mapping）で元の値に復元できます。

対応言語は英語（`en`）、日本語（`ja`）、スペイン語（`es`）、ベトナム語（`vi`）
に加え、新たに中国語（`zh`）、韓国語（`ko`）、フランス語（`fr`）、
ドイツ語（`de`）、ポルトガル語（`pt`）、イタリア語（`it`）の計10言語です。
デフォルトの `PromptAnonymizer(languages=…)` は引き続き `("en", "ja")` のままで、
それ以外の言語は `languages=[...]` でオプトインします。各UIの言語ピッカーと
自動検出は10言語すべてをカバーします。言語サポートはレジストリ駆動です —
言語の追加はレジストリ1エントリ（`languages.py` / `types.ts`）+
ラベルファイル1つで済みます。

検出はオンデバイスで実行されます（ブラウザではWebGPU / WASM、Pythonでは
spaCyまたはローカルのtransformers）。私たちの言葉を鵜呑みにする必要は
ありません。DevToolsを開いてネットワークタブを監視するか、ソースを読んで
ください。MITライセンスで、一度に読み切れる規模のコードベースです —
手順は [docs/AUDIT.md](docs/AUDIT.md)（英語）にまとめてあります。

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

<img alt="ブラウザ版デモ: 匿名化・対応表・復元のラウンドトリップ" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_web.gif?raw=true" width="85%">

<details>
<summary>CLIデモ（日本語 / 英語 — 残り8言語も同じように使えます）</summary>

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
| **デスクトップアプリ** | [Releases](https://github.com/akazah/prompt-anonymizer/releases) から `.dmg` / `.msi` / `.exe` / `.AppImage` / `.deb` / `.rpm` | Tauri 2製。現状は未署名のため初回起動時にOSの警告が出ます。 |
| **Chrome拡張** | [Releases](https://github.com/akazah/prompt-anonymizer/releases) の `prompt-anonymizer-extension-*.zip` | 展開 → `chrome://extensions` → デベロッパーモード → 「パッケージ化されていない拡張機能を読み込む」。テキスト選択 → 右クリック → *Anonymize selection*。 |
| **Python / CLI** | `pip install git+https://github.com/akazah/prompt-anonymizer`（PyPI未公開） | Presidio + spaCy。下のQuickstart参照。 |
| **Node CLI（npx）** | `npx @prompt-anonymizer/cli`（npm未公開 — `web/packages/cli` からビルド） | Python CLIと同じコマンド・フラグ。transformers.js NERで完全オンデバイス。 |
| **Web Component** | `@prompt-anonymizer/element`（npm未公開） | フレームワーク非依存の `<prompt-anonymizer>` 要素。匿名化→復元パネルを任意のサイトへ埋め込み可能（素のHTML・Svelte・Angular等）。 |
| **React / Vue** | `@prompt-anonymizer/react` / `@prompt-anonymizer/vue`（npm未公開） | 組み込み用 `<AnonymizerPanel />` コンポーネント + カスタムUI向け `useAnonymizer()` フック / コンポーザブル。下のQuickstart参照。 |
| **ローカルプロキシ + 管理GUI** | `@prompt-anonymizer/proxy`（npm未公開 — `web/packages/proxy` からビルド） | OpenAI互換のリバースプロキシ。`OPENAI_BASE_URL` を向けるだけでPIIをマスクして送信し、応答内のラベルを復元（ストリーミング対応）。管理GUIは `http://127.0.0.1:8787/admin/`。下のQuickstart参照。 |
| **MCPサーバー** | `@prompt-anonymizer/mcp`（npm未公開 — `web/packages/mcp` からビルド） | MCPクライアント（Claude Desktop / Claude Code / Cursor など）向けの `anonymize` / `deanonymize` / `scan` ツール。マッピングはサーバーメモリ内に保持（`mapping_id` 参照）され、明示的に要求しない限りモデルには渡りません。下のQuickstart参照。 |
| **コミットフック / CIゲート** | `prompt-anonymizer scan`（両CLI） + [`.pre-commit-hooks.yaml`](../../.pre-commit-hooks.yaml) | 終了コードで判定するPIIゲート。`file:line:col` とエンティティ種別のみを報告し、検出したテキスト自体は出力しません。デフォルトはオフライン・モデル不要。下の解説参照。 |
