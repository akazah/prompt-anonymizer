# 国際PII対応 実装計画（P14–P17）

本ドキュメントは、対応エンティティを日米中心の現状（`PERSON` / `EMAIL_ADDRESS` /
`LOCATION` / `PHONE_NUMBER` / `JP_POSTAL_CODE` / `JP_MY_NUMBER` / `CREDIT_CARD`）から、
各国固有の構造化PII（国民ID・税番号・IBAN等）へ拡張するための計画である。
フェーズ番号は `IMPLEMENTATION_PLAN.md`（P1–P13）から連番を引き継ぐ。

## 方針（二本立て）

| トラック | 対象 | 手段 |
|---|---|---|
| A: 構造化PII | 国民ID・税番号・IBAN等の番号系 | 検出正規表現は自前で書き、チェックディジット検証を stdnum 系ライブラリへ委譲する |
| B: 文脈PII | 人名・住所・組織等 | 既存のGPU推論パス（transformers.js / `ner_backend="hf"`）にPII特化NERモデルを評価導入する |

分離の根拠:

- NERモデルはチェックディジットを検証できず、番号系のスパン境界も不正確になりがちで、
  可逆ラベル（deanonymizeでの完全復元）の前提を壊す。番号系は正規表現+検証が優位
- 検出正規表現を外部ライブラリから丸ごと輸入すると、未検証入力に対して他者の正規表現を
  大量に走らせることになりReDoS審査（AGENTS.md P1）が不可能になる。検証関数は
  正規表現をほぼ含まない純粋なチェックサム計算であり、このリスクがない
- 両コアのパリティ契約（`tests/golden/`）上、追加エンティティはPython/TS双方に
  同等実装が必要。検証の委譲は移植コスト（チェックサムの写経ミス）を最小化する

## ライセンス方針（本計画の受け入れ基準）

本体は MIT。以下を受け入れ基準として明文化する（P14でCONTRIBUTING.mdに反映）。

**コード依存:**

- MIT / Apache-2.0 / BSD 系: 採用可
- LGPL-2.1+（python-stdnum）: import による依存利用のみ可。
  コードのベンダリング（リポジトリへのコピー）は不可
- コピーレフト（GPL）・独自二段階ライセンス: 不採用

**NERモデル（実行時にHF CDNからダウンロードされ同梱はしないが、本ツールは業務利用を
訴求するため既定モデルは商用安全なものに限る）:**

- 必須条件: (1) 商用利用可、(2) 派生物作成可（ONNX変換・q8量子化は派生物にあたる）、
  (3) 学習データセットのライセンスが利用を汚染しないこと
- 採用したモデルはライセンス・取得日・学習データセットを本ドキュメントの監査表に記録し、
  リビジョン（コミットハッシュ）をピンする

### ライセンス監査表（2026-07 調査）

| 依存 / モデル | ライセンス | 判定 |
|---|---|---|
| presidio-analyzer（既存依存） | MIT | 採用可 |
| [python-stdnum](https://arthurdejong.org/python-stdnum/)（200超の国別番号の検証） | LGPL-2.1+ | 依存利用のみ可・ベンダリング不可 |
| [stdnum](https://www.npmjs.com/package/stdnum)（npm、python-stdnumのTS移植） | MIT | 採用可 |
| [gliner](https://pypi.org/project/gliner/)（PyPI、GLiNERランタイム） | Apache-2.0 | 採用可 |
| [gliner](https://www.npmjs.com/package/gliner)（npm、GLiNER.js） | MIT | 採用可（メンテ状況に留意、P17参照） |
| libphonenumber-js（必要時のみ） | MIT | 採用可 |
| モデル: `urchade/gliner_multi_pii-v1`（en/fr/de/es/it/pt） | Apache-2.0 | 採用可 |
| モデル: `DataSign/gliner-ja-pii-v1`（ja） | Apache-2.0 | 採用可 |
| モデル: `iiiorg/piiranha-v1-detect-personal-information` | CC-BY-NC-ND-4.0 | **不採用**（商用不可 + 派生不可 = 量子化も不可） |
| モデル: `LiquidAI/LFM2-350M-PII-Extract-JP` | LFM Open License v1.0 | **不採用**（年商$10M超の商用利用不可。制約が利用者に転嫁される） |
| データセット: `ai4privacy/pii-masking-200k`（400kも同系） | 独自二段階（企業は有償） | このデータで学習したモデルは汚染の可能性があり個別審査。Piiranhaが該当 |
| データセット: `ai4privacy/pii-masking-openpii-1m` | CC-BY-4.0 | このデータ由来のモデルは帰属表示のみで採用可 |

注意: モデルカードのライセンス表記は変更されうる（Piiranhaは当初MITと報じられ、後に
CC-BY-NC-ND-4.0になった実例がある）。採用時点のリビジョンをピンし、更新時は再審査する。

## フェーズ計画

### P14 ライセンス方針の明文化と対象選定

1. 上記ライセンス受け入れ基準を `CONTRIBUTING.md` に追記する
2. 第一弾の対象エンティティを決定する。提案は以下の2種:
   - `US_SSN`: Presidio組み込み `UsSsnRecognizer` が実績あり、需要が最大
   - `IBAN`: 国横断で1エンティティ、mod-97検証で偽陽性を抑えられ、
     Presidio組み込み `IbanRecognizer` + stdnum双方に検証実装がある
3. ラベルを `labels/{en,ja}.yaml` に追加する（例: `US_SSN: SSN / 社会保障番号`、
   `IBAN: IBAN / 国際銀行口座番号`）。既存ラベルの変更はしない（追加のみなので
   既存mappingを壊さない）。CHANGELOGに記載する
4. 既定動作の決定: 新エンティティは **opt-in**（`entities` 引数への明示追加）から
   開始し、golden set での偽陽性影響を計測してから `DEFAULT_ENTITIES` 入りを判断する。
   偽陽性の増加は既定動作の信頼性を直接毀損するため、投機的に既定入りさせない

完了基準: CONTRIBUTINGにライセンス基準が記載され、対象エンティティ・ラベル・
既定動作の決定が本ドキュメントに追記されている。

### P15 構造化PII: Pythonコア

1. 選定エンティティについてPresidio組み込みrecognizerを登録する。既知の罠への対処:
   - 組み込みrecognizerの多くは `en` のみ登録。全設定言語への登録が必要
   - `\b` アンカーはCJK文字に隣接すると効かない。`CreditCardRecognizer` の
     置き換え（`recognizers/credit_card.py`）と同じ方式でCJK安全な
     lookaroundパターンにラップする
2. Presidioにチェックディジット検証がない番号は `python-stdnum` の `validate()` を
   `my_number.py` と同様のvalidator付きrecognizerとして組み込む
3. `evals` のFakerジェネレータに新エンティティのケースを追加し、golden setを再生成する
   （`uv run python -m prompt_anonymizer.evals`）。導入前後のエンティティ別
   precision/recall/F1を `docs/EVAL.md` に記録する
4. round-tripテスト（anonymize → deanonymize 恒等）を新エンティティ込みで追加する

完了基準: `uv run pytest -m "not slow"` 成功。新エンティティのF1がEVAL.mdに記録され、
既存エンティティの数値に回帰がない。

### P16 構造化PII: TypeScriptコア

1. `@prompt-anonymizer/core` に `stdnum`（npm, MIT）を追加する。
   バンドル肥大を避けるため国別モジュール単位でimportし（`stdnum` 全体は約3MB）、
   webアプリのバンドルサイズをビルドCIで計測・上限チェックする
2. 検出正規表現は `recognizers.ts` の既存流儀（有界量指定子・lookaround・
   `(?<![\d-])` 系の境界）で自前実装し、`validate` に stdnum を接続する。
   ReDoSレビュー（AGENTS.md P1）を必須とする
3. TSコアの `AnonymizerOptions` に `entities?: string[]` フィルタを追加する
   （Pythonコアの `entities` 引数に相当。現状TS側に無く、opt-in方式の前提となる。
   未指定時は現行の全ルール適用のままにし、既存アプリの挙動を変えない）
4. `labeling.ts` 側のテストをPython側と対で追加する（AGENTS.mdのオフセット処理
   要件）。golden set パリティを `pnpm test` で検証する。
   アプリUI（web / extension / element）は現状エンティティ別の選択UIを持たないため
   変更しない。UIでのエンティティ選択は既定入り判断（P14-4）とあわせて別途検討する

完了基準: `cd web && pnpm test && pnpm lint && pnpm build` 成功。golden set上の
両コア精度が `docs/EVAL.md` に併記され、乖離が既存エンティティ並みに収まる。

### P17 文脈PII: PII特化NERモデルの評価（トラックB）

構造化PIIと独立して進められる。**評価ゲート方式**とし、golden setで有意な改善が
確認できた場合のみ本採用する。

1. Python側の評価: presidio-analyzer 2.2.363 には `GLiNERRecognizer` が組み込み済み。
   `evals` にバックエンド切替（例: `--ner-backend gliner`）を追加し、
   `urchade/gliner_multi_pii-v1`（en）/ `DataSign/gliner-ja-pii-v1`（ja）を
   golden setで現行 spacy / hf バックエンドと比較する
2. 判断基準: (1) PERSON/LOCATION のF1改善幅、(2) モデルサイズ（初回ダウンロード。
   現行 xlm-roberta 系 q8 約280MBとの比較）、(3) 推論レイテンシ
3. TS側はPython側の評価結果が出てから着手する。GLiNERはtransformers.jsの
   `token-classification` パイプラインでは動かず、`gliner`（npm）は
   onnxruntime-webを別途抱えるため、二重ランタイムのバンドル影響と
   メンテ状況（v0.0.19、更新頻度低）を導入判断の材料に含める。
   改善幅がバンドル増を正当化しない場合、TS側は現行モデル据え置きで
   「Python側のみgliner opt-in」という非対称構成も許容する
   （NERバックエンドは両コアとも差し替え可能なインターフェースであり、
   golden setパリティはバックエンドごとに計測・記録する）

完了基準: バックエンド別の精度比較表が `docs/EVAL.md` に追加され、
採用/不採用の判断根拠が記録されている。不採用でも評価基盤（`--ner-backend gliner`）は
将来のモデル再評価のために残す。

## CI・キャッシュ

- 新規モデル（GLiNER）の評価は既存の `weekly-eval.yml` 系に載せ、PR CIには含めない
  （モデルダウンロードが重いため）。モデルは `actions/cache` でモデル名+リビジョンを
  キーにキャッシュする（spaCyモデルキャッシュと同方式）
- stdnum導入後のバンドルサイズ計測は既存のwebビルドジョブに組み込み、
  別ジョブを増やさない

## リスク

| リスク | 影響 | 緩和策 |
|---|---|---|
| 番号系エンティティ追加による偽陽性増 | 既定動作の信頼低下 | opt-in開始 + golden setでの前後比較をマージ条件にする |
| `stdnum`（npm）のツリーシェイク不全 | ブラウザ版バンドル肥大 | 国別モジュール単位import + CIでのサイズ上限チェック |
| モデルカードのライセンス変更 | 商用利用者の法的リスク | リビジョンピン + 監査表への記録 + 更新時再審査 |
| GLiNER.js のメンテ停滞 | TS側トラックBの保守負担 | 評価ゲートで改善幅がバンドル増を上回る場合のみ採用。非対称構成を許容 |
| Presidio組み込みrecognizerのCJK境界問題 | ja文中の検出漏れ | credit_card方式のCJK安全ラップを標準手順にする |
| LGPL依存（python-stdnum）の扱い誤り | ライセンス違反 | ベンダリング禁止をCONTRIBUTINGに明記。依存はimportのみ |

## 実施順序

P14 → P15 → P16 の順に進める。P17はP14完了後、P15/P16と並行可。
各フェーズはPull Request単位とし、フェーズ番号をPRタイトルに記載する
（例: `P15: add US_SSN + IBAN recognizers to the Python core`）。
