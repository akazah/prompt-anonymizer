# Zenn 記事ドラフト

投稿前に: 冒頭の体験談・数値・スクリーンショットを自分のものに差し替えて
ください。`slug` / `topics` は Zenn の frontmatter 仕様に合わせてあります。

---

```yaml
title: "ChatGPT に個人情報を送る前に、ブラウザ内で匿名化する — Prompt Anonymizer を公開しました"
emoji: "🕵️"
type: "tech"
topics: ["llm", "chatgpt", "セキュリティ", "個人情報", "oss"]
published: false
```

## TL;DR

- LLM に送るテキストから PII(人名・住所・電話番号・マイナンバーなど)を
  **送信前に** `<人名_1>` のような一貫したラベルへ置換し、返答が返ってきたら
  ローカルで元に戻す OSS を作りました
- 検出は **完全オンデバイス**(ブラウザなら WebGPU/WASM、Python なら
  spaCy / ローカル transformers)。DevTools のネットワークタブで無通信を
  確認できます
- ブラウザ版・Chrome 拡張・デスクトップアプリ・Python/Node CLI・
  OpenAI 互換プロキシ・MCP サーバー・pre-commit フックの形で使えます
- MIT ライセンス。リポジトリ: https://github.com/akazah/prompt-anonymizer
- デモ(インストール不要): https://akazah.github.io/prompt-anonymizer/

## 課題: 賢さとプライバシーのトレードオフ

いま LLM を使うとき、選択肢は実質 2 つです。

| | 賢さ | プライバシー |
|---|---|---|
| ローカルモデル | 妥協する | ✓ |
| フロンティアモデルに生テキスト | ✓ | 自分の注意力頼み |

顧客対応メールの下書き、契約書のレビュー、問い合わせログの要約 —
実務で LLM が本領を発揮するテキストほど、人名・連絡先・住所が
入っています。「送る前に手で伏せ字にする」を毎回やるのは現実的では
ないし、伏せ字にすると LLM の返答から元に戻すのも手作業になります。

## 解決策: 一貫・可逆なラベル置換

Prompt Anonymizer は送信前に PII を検出し、**同じ値には同じラベル**を
割り当てて置換します。

```
入力:   山田太郎の電話は090-1234-5678。山田太郎さんに折り返してください。
送信:   <人名_1>の電話は<電話番号_1>。<人名_1>さんに折り返してください。
```

同一値が同一ラベルになるので、LLM は「<人名_1> という人物」として
一貫した文脈を保ったまま回答できます。返答が返ってきたら、端末から
一度も出ていないマッピングで復元します。

```
LLM の返答: <人名_1>様 お電話ありがとうございました。…
復元後:     山田太郎様 お電話ありがとうございました。…
```

## 多言語対応 — 日本語も「おまけ」ではない

既存の PII 検出ツール(Presidio、LLM Guard など)は英語圏中心で、
日本語はどうしても手薄になりがちです。Prompt Anonymizer は
**10言語**(日本語・英語・スペイン語・ベトナム語・中国語・韓国語・
フランス語・ドイツ語・ポルトガル語・イタリア語)を**対等に**扱い、
それぞれにロケール固有の構造化 PII を用意しています
(`-l ja|en|es|vi|zh|ko|fr|de|pt|it`、自動判定あり)。

日本語まわりを例に挙げると:

- 日本語人名の NER(spaCy `ja_core_news_*` /
  `tsmatz/xlm-roberta-ner-japanese`)
- 〒 付き郵便番号
- **マイナンバー(チェックデジット検証付き)** — 12 桁の数字を
  片っ端からマスクするのではなく、検査数字が合うものだけ
- 日本の電話番号形式(市外局番・携帯・フリーダイヤル)

同様に、各言語で地域別の電話番号形式などに対応しています。

## 「オンデバイス」を主張ではなく検証可能にする

「100% ローカル処理」を謳うクローズドソースの拡張機能はたくさん
ありますが、主張と監査は別物です(実際に会話を外部送信していた
「AI プライバシー」拡張の事例も報告されています)。

このプロジェクトの立場はシンプルです:

1. MIT ライセンスで、1 日で読み切れるサイズのコードベース
2. ブラウザ版を開いて DevTools のネットワークタブを見れば、推論中に
   外部リクエストが飛ばないことを自分で確認できる(NER モデルの
   初回ダウンロードのみ)
3. マッピング(ラベル → 実値)はライブラリからは一切永続化されない

## 使い方

### ブラウザ(インストール不要)

https://akazah.github.io/prompt-anonymizer/ を開いてテキストを貼るだけ。
NER モデル(初回のみ 100–300 MB)のダウンロード後は完全オフラインで
動きます。

### Python

```bash
pip install prompt-anonymizer
python -m spacy download ja_core_news_sm
```

```python
from prompt_anonymizer import PromptAnonymizer

pa = PromptAnonymizer(languages=["ja"])
result = pa.anonymize("山田太郎の電話は090-1234-5678", language="ja")
result.text     # '<人名_1>の電話は<電話番号_1>'

llm_output = call_your_llm(result.text)
pa.deanonymize(llm_output, result.mapping)   # ローカルで復元
```

### OpenAI 互換プロキシ(コード変更ゼロ)

```bash
npx @prompt-anonymizer/proxy
export OPENAI_BASE_URL=http://127.0.0.1:8787/v1
```

既存のアプリ・SDK の向き先を変えるだけで、リクエストは送信前に
マスクされ、レスポンス(ストリーミング含む)はラベルが復元されて
返ってきます。

### コミット前のうっかり漏洩ゲート

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/akazah/prompt-anonymizer
    rev: v0.3.0
    hooks:
      - id: prompt-anonymizer-scan
```

`scan` は PII を見つけると exit 1 で止め、`file:line:col` と種別だけを
表示します(**マッチしたテキスト自体はログに出しません**)。

## 限界も明記しておきます

検出はベストエフォートです。偽陰性はゼロにできないので、送信前の
最終確認 UI(`--interactive`、各 UI のマッピングテーブル)を必ず
挟む設計にしています。また、識別子を隠しても文脈からの再識別
(珍しい役職名など)までは防げません。この位置づけは README の
Limitations にも明記しています。

## おわりに

- リポジトリ: https://github.com/akazah/prompt-anonymizer
- 検出漏れを見つけたら: false-negative 用の Issue テンプレートが
  あります(マッチした実テキストは書かないでください)
- Good first issue も用意しています。日本語 NER の改善、新しい
  電話番号形式の追加など、貢献しやすい入口から歓迎します
