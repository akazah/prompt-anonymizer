# prompt-anonymizer 実装計画

> **注（2026-07）:** 本ドキュメントは 2023 年の再開時点からの**歴史的な実装計画**です。
> 現行の機能・バージョン（0.3.0）と完了状況は [CHANGELOG.md](../CHANGELOG.md)、
> [README.md](../README.md) および GitHub Issues を参照してください。

本ドキュメントは、このリポジトリの現状（2023年6月時点で開発が止まった状態）を、型付けされ・テスト済み・CI/CDとパッケージ配布が整った状態まで引き上げるための実装計画である。フェーズごとにタスクと完了基準を定義する。

改訂: マルチターゲット配布（GUI版・Chrome拡張・ブラウザGPU動作版）とデモGIF刷新をP9–P13として追加した。P7にあったGIF撮り直しタスクはP13へ移管した。

## 品質基準（常に維持する前提）

- リポジトリに秘密情報・APIキー・利用者固有のデータを混入させない
- 「PIIを匿名化する」という機能表明に対して、検出精度を保証しない旨を明示し、送信前の人間による確認ステップを維持する。匿名化→復元のround-tripを継続的にテストで担保する
- 依存パッケージ・APIキー・言語モデルが未設定の環境でも、原因のわかるメッセージで終了する（無応答・生のスタックトレースにしない）

## 現状分析

### リポジトリ概況

| 項目 | 現状 |
|---|---|
| 履歴 | 8コミット、すべて2023年6月2日〜3日。以後活動なし |
| 規模 | Python約234行（main.py 57 / presidio_handler.py 92 / openai_handler.py 17 / テスト2本 60 / config 8） |
| Star / Fork | 23 / 1。未処理のPull Requestが1件ある |
| ライセンス | MIT |
| README | 日英2本、デモGIFあり。構成の刷新が必要 |
| リリース / PyPI | なし / 未公開 |
| CI/CD・コミュニティ整備 | 一切なし |

### 依存関係

| パッケージ | 現行の指定 | 対応 |
|---|---|---|
| presidio-analyzer / presidio-anonymizer | `^2.2.32` | `>=2.2.363` へ更新 |
| spacy | `^3.5.3` | `>=3.8.14` へ更新 |
| openai | `^0.27.7` | v1系（`>=2`）へ更新。旧`openai.ChatCompletion.create`はv1移行時に廃止されており、デモ部分は現行SDKでは動作しない |
| pyyaml | 宣言なし（presidio経由の推移依存に暗黙依存） | 直接依存として明示する |
| pytest | 本体依存とdev依存の両方に重複記載 | dev依存のみに統一する |

### コード上の欠陥

**テスト2本が実行時に例外を起こし機能していない**
- `presidio_handler_test.py`: `anonymize_text()` はdictを返すが、テストは `person_1 not in result_text` のようにdictへ直接 `in` 演算子を使っており、これはdictのキー集合との比較になるため意図した検証になっていない。また `result_text.count(...)` はdictに存在しないメソッドで `AttributeError` になる。さらにモデルダウンロードを要する処理がモジュールのトップレベルで実行される
- `openai_handler_test.py`: `chat_completion()` はstrを返すが、テストは `completion["choices"]` のようにdict添字アクセスをしており `TypeError` になる。加えて実際のAPIへライブ呼び出しを行う

**main.pyの分岐に戻り値の欠落がある**
`ask_to_send_text_to_openai` の不正入力時の再帰呼び出しには `return` が付いておらず、Y/n以外を入力した場合、最終的な出力が常に `None` になる

**匿名化コアの設計上の欠陥**
現行実装は、いったんハッシュ値に置換したのち、そのハッシュ文字列をラベル（`人名_A`等）へ文字列置換するという二段階の変換を行っている。
- ハッシュ値の部分一致による意図しない誤置換が起こりうる
- ラベルの連番生成（`_int_to_alphabet`）は62件（A–Z, a–z, 0–9）までしか正しい文字を返さず、63件目以降は不正な値になる
- 原文とラベルの対応表（mapping）が呼び出し側に返されない。このため、LLMの応答に含まれるラベルを原文へ戻す「復元」機能が実装できない構造になっている

**日本語の電話番号検出漏れの原因**
Presidioの `PhoneRecognizer` は既定で `supported_language="en"`、既定の対応地域は `("US","UK","DE","FR","IL","IN","CA","BR")` であり、日本（JP）は含まれない。`ja` パイプラインには電話番号認識器がそもそも登録されておらず、日本語文中の電話番号検出はspaCyのNERのみに依存している

## 目標アーキテクチャ

### 公開API

```python
from prompt_anonymizer import PromptAnonymizer

pa = PromptAnonymizer(languages=["ja", "en"])
result = pa.anonymize("山田太郎の電話は090-1234-5678", language="ja")

result.text      # "<人名_1>の電話は<電話番号_1>"
result.mapping   # {"<人名_1>": "山田太郎", "<電話番号_1>": "090-1234-5678"}
result.entities  # [(start, end, entity_type, score), ...]

llm_output = call_your_llm(result.text)
pa.deanonymize(llm_output, result.mapping)
```

設計原則:
- 一貫ラベリングは、Analyzer結果のスパンをオフセットベースで直接置換する方式で実装する（現行のハッシュ二段変換は廃止する）
- mappingは呼び出し側に返す。永続化はしない（保存する場合の責任はライブラリ利用者側にある旨をドキュメントに明記する）
- 設定（エンティティ一覧・ラベルのi18n・認識器）は `importlib.resources` でパッケージ内リソースとして扱い、実行時のカレントディレクトリに依存しない構造にする

### リポジトリ構成

```
prompt-anonymizer/
├── src/prompt_anonymizer/
│   ├── __init__.py          # PromptAnonymizer, AnonymizeResult をexport
│   ├── core.py               # 匿名化・復元ロジック
│   ├── recognizers/          # ja_phone.py, ja_postal_code.py, my_number.py ...
│   ├── labels/                # en.yaml, ja.yaml（パッケージリソース）
│   ├── cli.py                 # typer製CLI
│   └── evals/                 # 評価基盤（精度計測）
├── web/                        # pnpm workspace（TS共有コア + 3ターゲット）
│   ├── packages/core/          # @prompt-anonymizer/core（TS実装）
│   └── apps/
│       ├── web/                # ブラウザGPU動作版（Vite）
│       ├── extension/          # Chrome拡張（MV3）
│       └── desktop/            # GUI版（Tauri 2）
├── demo/                       # デモ資材（vhsテープ・録画スクリプト・GIF）
├── tests/                      # unit / integration / eval / golden
├── .github/workflows/          # ci.yml / release.yml / release-apps.yml / pages.yml / weekly-eval.yml
├── AGENTS.md
├── CHANGELOG.md / CONTRIBUTING.md / SECURITY.md / CODE_OF_CONDUCT.md
└── pyproject.toml
```

## 設計判断

| # | 項目 | 決定 | 根拠 |
|---|---|---|---|
| D1 | PyPIパッケージ名 | `prompt-anonymizer`。使用不可の場合は `prompt-anonymizer-jp` を代替名とする | リポジトリ名との一致を優先する。P5着手時に可用性を確認する |
| D2 | パッケージマネージャ | poetryから `uv` へ移行 | 依存解決・lockfile・venv・ビルドを単一ツールに集約でき、CI実行時間を短縮できる |
| D3 | Pythonサポート範囲 | 3.10–3.13 | presidio-analyzer/anonymizerの要求（`>=3.10,<3.15`）に整合する。3.14対応は、P5のCIマトリクスで依存ホイールの供給状況を検証してから追加を判断する |
| D4 | OpenAI依存の扱い | コアから分離し `[project.optional-dependencies] demo` に限定する | 匿名化コアの動作を特定LLMプロバイダに依存させない。デモ・CIレビューでのみ具体的なSDKを使う |
| D5 | MCPサーバー | 今回のスコープに含めない。将来スコープとして記録する | 中核機能（匿名化・復元・精度改善）を優先し、スコープの肥大化を避ける |
| D6 | 検出エンジン | Presidioを継続利用し、カスタム認識器で拡張する | 保守実績のあるOSSの認識器フレームワークに追加する方が、独自NLPパイプラインを新規に保守するより低コストになる。将来的な認識器のupstream化も選択肢になる |
| D7 | 復元（deanonymize） | 公開APIの一部として実装する | 現行実装は原文↔ラベルの対応表を返しておらず、これが一貫ラベリングという設計の効用（LLM応答から元情報へ戻す）を妨げている。上記の欠陥修正そのもの |
| D8 | リポジトリ名・履歴 | 変更しない（rename・force-pushをしない） | 履歴の連続性を保つ。force-pushは共同作業者・fork・既存リンクを壊すリスクがある |
| D9 | バージョニング | 0.1.0からの連番でSemVerを再開し、0.2.0から出す | 既存の0.1.0との連続性を保ちつつ、破壊的なAPI再設計（D7等）をマイナーバージョンの引き上げで示す |
| D10 | 開発運用 | 全ての変更はPull Request経由で行い、mainへの直pushを禁止する。CI（lint・型検査・テスト）通過をマージ条件にする | 変更履歴と差分レビューの単位を保ち、型・テストの回帰を機械的に防ぐ |
| D11 | ラベル書式 | `人名_A` から `<人名_1>` へ変更する（連番は無制限、区切りは山括弧） | 現行の英字1桁エンコードは63件目以降で不正な値を返す上限があり、地の文中の記号との衝突可能性もある。この変更にともない既存のデモ資料は新形式で撮り直す |
| D12 | 検出エンジンの二本立て | TypeScript製コア `@prompt-anonymizer/core` を新設し、GUI・Chrome拡張・ブラウザ版の3ターゲットで共有する。Pythonライブラリ（PyPI）は主力として維持する | Chrome拡張・ブラウザ版ではPython/Presidioは動かない。ラベル書式・mapping仕様（D11）を両エンジンの共通仕様としてドキュメント化し、golden setで精度パリティを可視化する |
| D13 | ブラウザ側NER | transformers.js v3+（`device: "webgpu"`、非対応環境はWASMへ自動フォールバック）。日本語は `tsmatz/xlm-roberta-ner-japanese` のONNX変換版、英語は既存ONNXのNERモデルを使用する。電話番号・メール・郵便番号・マイナンバー等の構造化PIIはP3の正規表現認識器をTSへ移植する | ブラウザ内で完結する（テキストを外部へ送らない）ことが本ターゲットの最大の訴求点。WebGPUで実用速度、WASMフォールバックで互換性を確保する |
| D14 | GUIの実装方式 | Tauri 2でWebアプリUIをラップする。Win/macOS/Linux向けバイナリを `tauri-apps/tauri-action` でビルドしGitHub Releaseに添付する | Pythonバンドル案はspaCyモデル込みで数百MB超になり、コアの分裂も招くため不採用。Tauriならフロントエンドを3ターゲットで共有できる |
| D15 | リポジトリ構成 | モノレポ。本リポジトリに `web/` ワークスペース（pnpm workspaces）を追加する | リポジトリ分割はコア仕様（ラベル書式・golden set）の同期コストを上げる |
| D16 | ストア公開・署名 | 初回スコープ外。Chrome拡張はzipをReleaseに添付し、Web Store公開は手動タスクとしてIssue化する。デスクトップ版のコード署名/notarizationも未署名で開始しIssue化する | 開発者アカウント・証明書の取得は人間側の手続きが必要。配布自体はzip/バイナリ添付で先行できる |

## フェーズ計画

各フェーズはPull Request単位で進める。フェーズ番号をPRタイトルに記載する（例: `P1: migrate to uv + src layout`）。

### P1 基盤刷新

1. pyproject.toml をPEP 621 `[project]` 形式に全面書き換える
   - `name = "prompt-anonymizer"` / `version = "0.2.0.dev0"` / `requires-python = ">=3.10,<3.15"`
   - dependencies: `presidio-analyzer>=2.2.363`, `presidio-anonymizer>=2.2.363`, `pyyaml`, `typer`
   - `[project.optional-dependencies] demo = ["openai>=2", "rich"]`
   - `[dependency-groups] dev = ["ruff", "mypy", "pytest", "pytest-cov", "pre-commit"]`
   - pytestの本体依存への重複記載を解消する
2. `.gitignore` からlock除外行を削除し、`uv.lock` をコミットする。`.python-version` を追加する
3. src layoutへ移動する（`git mv` で履歴を保持する）。`[project.scripts] prompt-anonymizer = "prompt_anonymizer.cli:app"`
4. ruff（lint・format）・mypy・pre-commitの設定をpyprojectに集約する。旧black/flake8設定を削除する
5. LICENSEの年を更新する

完了基準: `uv sync --all-extras && uv run ruff check . && uv run mypy src && uv build` が成功する。

### P2 コア再設計

1. `core.py` を実装する
   - Analyzer結果のスパンをマージ（重複はスコア優先）し、原文文字列が同一であれば同一ラベルを割り当てたうえで、末尾側からオフセットベースで直接置換する（現行のハッシュ二段変換を廃止する）
   - `AnonymizeResult` dataclass（text / mapping / entities）を定義する
   - `deanonymize(text, mapping)` を実装する。ラベル長の降順で置換し、部分文字列の衝突を避ける
   - 言語モデル未ダウンロード時は、`spacy download` コマンドを提示する専用の例外を送出する
2. `cli.py`（typerで実装、fireを置換する）: `anonymize --text/--file/stdin --language ja --json`、`--interactive`（確認プロンプト。不正入力はループで再入力を促す構造にし、現行の戻り値欠落を解消する）
3. `demo/` を openai v1系SDKで書き直す（`from openai import OpenAI`）。モデル名を引数化しハードコードを排除する
4. 旧 `main.py` / `src/openai_handler.py` / `src/presidio_handler.py` / `config/` を新構成へ移行したうえで削除する

完了基準: Fakerで生成した50ケースで `anonymize→deanonymize` のround-tripが恒等になることをテストで確認する。APIキー・言語モデルが未設定の環境でもCLIが原因のわかるメッセージで終了する。

### P3 日本語検出の改善

1. `ja` パイプラインに `PhoneRecognizer(supported_language="ja", supported_regions=("JP",))` を登録する。`en` パイプラインへのJPリージョン追加も検討する
2. カスタム認識器を追加する
   - 郵便番号: `〒?\d{3}-?\d{4}` に加え、コンテキスト語（住所・宛先等）でスコアを補正する
   - マイナンバー: 12桁に加えて検査用数字（チェックデジット）の検証ロジックを実装し、桁数一致のみによる誤検出を排除する
   - 携帯・固定電話の表記ゆれに対する正規表現フォールバックを追加する
3. `PromptAnonymizer` の引数として deny_list（強制的にマスクする語）/ allow_list（除外する語）を追加する
4. LOCATIONエンティティの検出精度を評価基盤（P4）で数値化し、READMEに実測値として記載する。`ja_ginza` 等の代替モデル対応は、使用中のspaCyバージョンとの互換性確認を前提にIssue化する

完了基準: エンティティ別のprecision/recall/F1が記録され、`ja`/`PHONE_NUMBER`のrecallが現行実装比で改善している。

### P4 テスト・評価基盤

1. 既存の2テストファイルを廃棄し、新規に作成する（現行のアサーションは型不一致により実行時例外を起こし機能していない）
2. 3層構成にする
   - `tests/unit/`: ラベリングの一貫性・mapping生成・復元・各カスタム認識器の単体ロジック（NLPエンジン不要な範囲はモック、必要な箇所は `_sm` モデルを使用する）
   - `tests/integration/`: `_sm` モデルによる実パイプライン検証（マーカー `integration`）
   - `tests/eval/`: 精度回帰用のゴールデンセット比較（マーカー `slow`。週次CIでのみ実行する）
3. 評価基盤（`prompt_anonymizer.evals`）を実装する
   - Faker(ja_JP / en_US) でシード固定の合成文書を各言語200件生成する（依頼文・議事録風・問い合わせ風の3ジャンル）。PIIの埋め込み位置をground truth spanとして保持する
   - span単位でエンティティ別のprecision/recall/F1を算出し、`docs/EVAL.md` にMarkdown表として出力する。`uv run python -m prompt_anonymizer.evals` で再現できるようにする
   - ゴールデンセットをJSON（`tests/golden/`）としてもエクスポートし、TSコア（P9）とのパリティ検証に用いる
   - 将来拡張として、表記ゆれ・敬称・旧字体・住所の部分表記等を含むadversarialケースを追加し、LLM-as-judgeによる見逃し（false negative）分類を導入する
4. コアモジュールのカバレッジ85%以上をCIのゲート条件にする

完了基準: `uv run pytest -m "not slow"` が数分以内に成功する。評価基盤がエンティティ別の数値を出力し、改善前後の比較ができる形で記録される。

### P5 CI/CD・リリース

1. `ci.yml`: Pythonマトリクス{3.10, 3.11, 3.12, 3.13} × ubuntu-latest（+ macOS 1構成）。uvのセットアップ→ruff→mypy→pytestの順に実行する。spaCyの`_sm`モデルはactions/cacheでモデル名とバージョンをキーにキャッシュする。あわせてNode側（pnpm install→lint→test→build）のジョブも実行する。3.14対応の可否はこのマトリクスで検証し、対応できればclassifiersへ反映する
2. `release.yml`: `v*` タグのpushで `uv build` を実行し、PyPI Trusted Publishing（OIDC。APIトークンの管理が不要になる）で公開したうえで、GitHub Releaseを自動作成する
3. `weekly-eval.yml`: cronで`_lg`モデルによるフル評価を実行し、精度の回帰を検知する
4. `CHANGELOG.md`（Keep a Changelog形式）を新設する。SemVerの運用をCONTRIBUTINGに明記する
5. `v0.2.0` をPyPIへ初回公開する
6. READMEにバッジ（CI / PyPIバージョン / 対応Pythonバージョン / ライセンス）を追加する

完了基準: タグをpushするだけでPyPIに新バージョンが公開される。CIの全マトリクスが成功する。

### P6 メンテナンス運用整備

1. README記載のTODO 7項目、およびP3/P5での積み残しをGitHub Issueに登録する。ラベル（`good first issue` / `help wanted` 等）を付与し、Milestone `v0.3` を作成する
2. Issueテンプレートを整備する（bug / feature に加え、匿名化漏れ（false negative）専用の報告テンプレートを作る）
3. `CONTRIBUTING.md`（uvでのセットアップ→テスト→評価基盤の実行手順）、`SECURITY.md`（脆弱性報告の窓口。検出はベストエフォートであり保証しないこと・送信前確認は利用者側の責任であることを明記する）、`CODE_OF_CONDUCT.md` を追加する
4. リポジトリルートに `AGENTS.md` を追加し、レビュー観点を明記する（例: PII漏洩リスクのある変更はP0として扱う、正規表現のReDoSリスクはP1として扱う、オフセット処理の変更には対応するテストの追加を必須とする）。AIコードレビューツール（例: Codexの`@codex review`・自動レビュー、またはCI組込みのAction）を有効化する。複数の仕組みを同時に有効化すると同一PRへコメントが重複するため、いずれか一つを選ぶ
5. Branch protectionを設定する: mainへの直push禁止、CI必須、レビュー必須とする
6. 現在オープンになっているPull Requestを処理する（レビューしてマージする、または理由を示してクローズする）

完了基準: 直近のPRにレビューが付いたうえでマージされている。Issueが整理され、ラベルとMilestoneが設定されている。

### P7 ドキュメント刷新

1. READMEを再構成する: 課題提示 → Quickstart（`uvx prompt-anonymizer` または `pip install`） → 一貫ラベリングと復元のround-tripを示すコード例 → 対応エンティティ表（en/ja別、カスタム認識器に印） → 精度表（評価基盤の実測値） → Limitations（LOCATION精度の限界・検出を保証しないこと・human-in-the-loopでの確認を推奨する旨） → Roadmap（Milestone v0.3へのリンク） → Contributing
2. 現行READMEの「デモスクリプトである」「最初のPythonプロジェクトである」旨の記述を、ライブラリとしての位置づけへ書き換える
3. `README_ja.md` を同期する。デモGIFの撮り直しはP13で行う
4. 公開APIにdocstring（Googleスタイル）を追加する

完了基準: リポジトリを初めて見る人がREADMEのみでinstall→匿名化→復元まで到達できる。

### P8 リポジトリ表示の整備

1. GitHub Topicsを追加する（`llm`, `privacy`, `pii`, `data-anonymization`, `japanese` 等）。DescriptionとWebsite欄を整備する

将来スコープ（未スケジュール）: `anonymize` / `deanonymize` をMCP toolとして公開する。着手前に、その時点のMCP SDKとの互換性を確認する。

完了基準: リポジトリの説明とTopicsが現状の機能を正確に反映している。

### P9 TypeScript共有コア

1. `web/packages/core` を作成する（pnpm workspace、TypeScript、vitest、strict設定）
   - `anonymize(text, {language}) → {text, mapping, entities}` / `deanonymize(text, mapping)`。ラベル書式・置換アルゴリズム（末尾側からのオフセット置換、同一原文＝同一ラベル）はP2のPython実装と同一仕様にする
   - 正規表現認識器（メール・電話JP/US・郵便番号・マイナンバーのチェックデジット）をP3から移植する
   - NERバックエンドは差し替え可能なインターフェースにし、transformers.js実装（webgpu→wasmフォールバック、モデル遅延ロード＋進捗コールバック）と、テスト用のモック実装を用意する
2. 精度のパリティ検証: P4のFakerゴールデンセット（`tests/golden/`のJSON）をTSコアでも読み込み、同一セットでprecision/recall/F1を計測して `docs/EVAL.md` にPython版と併記する
3. round-tripテスト（anonymize→deanonymize恒等）をvitestで実装する

完了基準: `pnpm test` が成功し、golden set上のround-tripが恒等。エンティティ別精度が両エンジン分記録される。

### P10 ブラウザGPU動作版（Webアプリ）

1. `web/apps/web` をViteで作成する。UI要件:
   - 左に入力、右に匿名化結果（エンティティ種別ごとに色分けハイライト）、mappingテーブル、コピー用ボタン、deanonymize用の貼り付け欄
   - 初回ロード時にWebGPU可否を判定して表示（GPU/WASMどちらで動作中かバッジ表示）。モデルダウンロードの進捗バーを出す
   - 「テキストは一切サーバーへ送信されない（全処理がブラウザ内）」ことをUIに明示する。これが本ターゲットの最大の訴求点
2. 配布: GitHub Pagesへのデプロイworkflow（`pages.yml`）+ `v*` タグ時に静的ビルドzipをReleaseへ添付
3. READMEに「Try it in your browser」リンクを追加する

完了基準: Pages上でモデルロード→匿名化→復元が動作し、ネットワークタブでテキスト送信が発生しないこと（モデル取得を除く）。

### P11 Chrome拡張（MV3）

1. `web/apps/extension` を作成する。構成:
   - Side Panelで `core` を実行する。MV3 service workerではWebGPU/WASM実行が制約されるため、推論はside panelのDOMコンテキストで行う
   - 機能: 選択テキストの右クリックメニュー「Anonymize selection」→ side panelに結果表示・ワンクリックコピー。mappingはsession storageに保持し、復元タブでLLM応答を貼り付けてdeanonymizeできる
   - モデルは初回に拡張内でダウンロード・キャッシュする（`chrome.storage` ではなくCache APIを使用）
2. 配布: `v*` タグで `extension-vX.Y.Z.zip` をReleaseに添付。「Load unpacked / zipからのインストール手順」をREADMEに記載。Chrome Web Store公開は手動タスクとしてIssue化する

完了基準: zipを読み込んだ拡張で、任意ページの選択テキストの匿名化→コピー→復元が完結する。

### P12 GUI版（Tauri 2）+ リリースビルド統合

1. `web/apps/desktop` にTauri 2プロジェクトを作成し、`apps/web` のUIを流用する（デスクトップ固有: クリップボード連携、モデルのローカルキャッシュ）
2. `release-apps.yml` workflowを新設する（既存 `release.yml` = PyPI公開とは分離）:
   - matrix: `windows-latest` / `macos-latest`（aarch64 + x86_64）/ `ubuntu-latest`
   - `tauri-apps/tauri-action` で dmg / msi・NSIS / AppImage・deb を生成しGitHub Releaseへ添付
   - 同workflow内でP10のWebビルドzip・P11の拡張zipも添付し、`v*` タグ1つで全ターゲットのリリースが揃う構成にする
   - Rustビルドは `swatinem/rust-cache`、node側はpnpm cacheでCI時間を抑制する
3. コード署名・notarization・自動アップデートは初回リリースでは行わずIssue化する

完了基準: タグpushのみで PyPI + GitHub Release（デスクトップ3OS・拡張zip・Webビルドzip）+ Pages更新がすべて自動で揃う。

### P13 デモGIFの刷新（説得力の強化）

1. **CLI版GIF**: 手撮りをやめ、`vhs`（charmbracelet）の `.tape` スクリプトを `demo/tapes/` にコミットして再現可能にする。構成を「ストーリー型」にする:
   - Before: PIIだらけの依頼文（人名・電話・メール・住所入り）をそのまま見せる
   - anonymize実行 → `<人名_1>` 形式で置換された文とmappingを表示
   - LLM応答にラベルが含まれる様子 → deanonymizeで実名に戻る、まで一連で見せる
   - ja / en の2本。フォント・配色・タイポ速度を統一する
2. **Web/GUI版GIF**: Playwrightのscreencastで撮影するスクリプトを `demo/scripts/` に置き、mp4→GIF変換（ffmpeg + palettegen）で軽量・高画質にする。ハイライト表示とWebGPUバッジが映るカットを含める
3. **Chrome拡張GIF**: 実ページ上で選択→右クリック→side panelで匿名化、の流れを撮影する
4. README/README_ja の Demo節を刷新: 冒頭に最も説得力のある1本（匿名化→復元round-trip）を大きく配置し、CLI/拡張/GUIは折りたたみまたはリンクにする。GIFはリポジトリ肥大化を避けるためサイズ上限（~2MB/本）を設け、超える場合はmp4をRelease assetにしてリンクする

完了基準: 全GIFがスクリプトから再生成可能で、README冒頭のデモだけで「一貫ラベリング＋復元」「ローカル完結」の価値が伝わる。

## リスク

| リスク | 影響 | 緩和策 |
|---|---|---|
| spaCyの`_lg`モデル（各約500MB）でCIが重くなる | CI実行時間・課金の増加 | 通常CIは`_sm`+cacheのみとし、`_lg`は週次cronに限定する |
| Python 3.14で依存ホイールが未供給 | CIマトリクスの失敗 | P5のマトリクスで検証してからclassifiersに追加する。当面は3.10–3.13の範囲にとどめる |
| spaCy言語モデルのライセンス条件 | 配布上の制約 | モデルは同梱せず、利用者側でダウンロードする現行方式を維持する |
| 匿名化の見逃し（false negative）による利用者側のインシデント | 信頼性・利用者への実害 | SECURITY.mdと確認プロンプトで検出を保証しない旨を明記する。false-negative報告テンプレート（P6）で改善ループを作る |
| PyPIパッケージ名の先取り | 名前の喪失 | P1完了後、できるだけ早い時点で名前を確保する（プレリリースでの先行登録も選択肢にする） |
| AIコードレビューの誤検出 | Pull Requestのノイズ増加 | `AGENTS.md`のレビュー観点でP0/P1に限定する指示を与える。複数のAIレビュー機構を同時に有効化しない |
| NERモデルのサイズ（xlm-roberta-base系はq8でも約280MB） | ブラウザ版・拡張の初回ロードが遅い | 量子化（q8）+ Cache APIによる再訪時キャッシュで緩和する。より小型の日本語NERモデルの検証をIssue化する |
| WebGPUのブラウザ差（Firefox/Safariはフラグが必要） | ブラウザ版の体験差 | transformers.jsのWASM自動フォールバックで機能自体は全ブラウザで維持する。動作モードをUIにバッジ表示する |
| TSコアとPythonコアの精度乖離 | 「同じツール」としての信頼低下 | golden setによる両エンジンの精度をEVAL.mdに併記し、乖離を可視化する |
| 拡張・デスクトップの未署名配布に伴う警告表示 | インストール時の心理的障壁 | READMEに手順と理由を明記する。署名対応（D16）をIssue化して追跡する |
| 作業量の見積り超過 | 全体スケジュールの遅延 | 優先度の低いタスク（LOCATION精度改善の深追い、MCPサーバー化）を切り離し、P1・P2・P4・P5・P6・P7を先に完了させる |

## 実施順序

P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8 のあと、P9 → P10 →（P11とP12は並行可）→ P13 の順に進める。各フェーズの間には、CIとレビューが完了してから次のフェーズに進めるだけの時間を確保する。

## 次の一歩

1. 現在オープンになっているPull Requestを処理する
2. 「設計判断」章の内容を確認する
3. P1のPull Requestを作成する

## 付録: READMEの構成案

```
# prompt-anonymizer
> Anonymize PII before it reaches an LLM — with consistent, reversible labels. JA/EN.

[badges: CI | PyPI | Python | License]

## Try it (browser / desktop / extension / CLI)
## Why
## Quickstart
## How it works
## Supported entities
## Accuracy
## Limitations
## Roadmap
## Contributing / Security / License
```
