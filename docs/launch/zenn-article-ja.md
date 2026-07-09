# Zenn 記事ドラフト

投稿前に: 冒頭の体験談・数値・スクリーンショットを自分のものに差し替えて
ください。`slug` / `topics` は Zenn の frontmatter 仕様に合わせてあります。

---

```yaml
title: "ChatGPT に個人情報を送る前の「ダブルチェック」をブラウザ内で — Prompt Anonymizer を公開しました"
emoji: "🕵️"
type: "tech"
topics: ["llm", "chatgpt", "セキュリティ", "個人情報", "oss"]
published: false
```

## はじめに

顧客対応メールの下書き、問い合わせログの要約、契約書のレビュー —
LLM が本当に役に立つ場面ほど、テキストには人名・電話番号・住所が
入っています。

多くのチームには既にルールがあります —「顧客データや個人情報を
ChatGPT / Claude / Gemini に貼らない」。でも人は急いでいて、名前や
電話番号がつい紛れ込む。かといって「送る前に手で伏せ字」を毎回やるのも
現実的ではなく、伏せ字にしたあと LLM の返答を元に戻すのも手作業です。

そこで、**ルールを人の注意任せにしない**ために、**送信前に PII を
ラベルに置き換え、返答が返ってきたらローカルで復元する** OSS を作りました。
うっかりミスをブラウザ内で捕まえる、いわば送信前のダブルチェックです。
Prompt Anonymizer です。

- リポジトリ: https://github.com/akazah/prompt-anonymizer
- デモ(インストール不要): https://akazah.github.io/prompt-anonymizer/
- MIT ライセンス

## TL;DR

- PII を `<人名_1>` のような**一貫したラベル**へ置換し、同じ値には常に
  同じラベルを割り当てる
- 検出は**端末内**で完結(ブラウザは WebGPU/WASM、Python は spaCy /
  ローカル transformers)。マッピングはライブラリから永続化しない
- ブラウザ版・Chrome 拡張・デスクトップ・Python/Node CLI・
  OpenAI 互換プロキシ・MCP サーバー・pre-commit フックで使える

## どう動くか

送信前に PII を検出し、**同じ値には同じラベル**を割り当てて置換します。

```
入力:   山田太郎の電話は090-1234-5678。山田太郎さんに折り返してください。
送信:   <人名_1>の電話は<電話番号_1>。<人名_1>さんに折り返してください。
```

同一ラベルが繰り返されるので、LLM は「<人名_1> という人物」として
文脈を保ったまま回答できます。返答が返ってきたら、端末から一度も
出ていないマッピングで復元します。

```
LLM の返答: <人名_1>様 お電話ありがとうございました。…
復元後:     山田太郎様 お電話ありがとうございました。…
```

## 日本語もちゃんと扱いたかった

英語向けに設計された PII ツールは、日本語の人名・住所・番号体系まで
カバーしきれないことが多いです。自分のユースケースでは日本語が中心
だったので、最初から多言語を前提にしました。

**10言語**(日本語・英語・スペイン語・ベトナム語・中国語・韓国語・
フランス語・ドイツ語・ポルトガル語・イタリア語)をレジストリで管理し、
言語ごとに構造化 PII を足しています(`-l ja|en|es|vi|zh|ko|fr|de|pt|it`、
自動判定あり)。

日本語まわりの例:

- 人名 NER(spaCy `ja_core_news_*` /
  `tsmatz/xlm-roberta-ner-japanese`)
- 〒 付き郵便番号
- **マイナンバー**(チェックデジット検証付き) — 12 桁を片っ端から
  マスクするのではなく、検査数字が合うものだけ
- 日本の電話番号(市外局番・携帯・フリーダイヤル)

Python コアの検出エンジンは [Presidio](https://github.com/microsoft/presidio)
を土台に、spaCy NER とカスタム recognizer を載せています。ブラウザ版は
Python が動かないので、regex + transformers.js NER の別実装ですが、
ラベル形式と golden set で両者の挙動を揃えています。

## 「オンデバイス」は、自分で確かめられるように

プライバシー系ツールは「100% ローカル」の主張が多い一方で、中身を
見られないものも少なくありません。自分が使うなら、**主張ではなく
確認できる**形にしたかったので、次のようにしています。

1. MIT ライセンスで、読み切れるサイズのコードベース
2. ブラウザ版を開いて DevTools のネットワークタブを見れば、推論中に
   外部リクエストが飛ばないことを自分で確認できる(NER モデルの
   初回ダウンロードのみ)
3. マッピング(ラベル → 実値)はライブラリから一切永続化しない

疑われたときに「ソースを見てください」で終わらせず、**ネットワークタブを
開いて一緒に確認する**のが一番説得力がある、というのが現場感です。

## 使い方

### ブラウザ(インストール不要)

https://akazah.github.io/prompt-anonymizer/ を開いてテキストを貼るだけ。
NER モデル(初回のみ 100–300 MB)のダウンロード後はオフラインで動きます。
「NER モデル」のチェックを外せば、メール・電話・カードなど regex のみの
完全オフライン運用もできます。

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

### OpenAI 互換プロキシ(既存コードをほぼそのまま)

```bash
npx @prompt-anonymizer/proxy
export OPENAI_BASE_URL=http://127.0.0.1:8787/v1
```

向き先を変えるだけで、リクエストは送信前にマスクされ、レスポンス
(ストリーミング含む)はラベルが復元されて返ってきます。

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

## 正直に言うと、万能ではない

検出はベストエフォートです。漏れはゼロにできないので、送信前の
確認 UI(`--interactive`、各 UI のマッピングテーブル)を挟む設計に
しています。識別子を隠しても、珍しい役職名など文脈からの再識別までは
防げません。

「ベンダーに顧客リストを渡さない」レベルには上がる、という位置づけです。
詳細は README の Limitations に書いています。

## おわりに

フロントモデルを諦めずに、実務テキストを扱うための小さなレイヤーとして
使ってもらえたらうれしいです。

- リポジトリ: https://github.com/akazah/prompt-anonymizer
- 検出漏れを見つけたら: false-negative 用の Issue テンプレートがあります
  (マッチした実テキストは書かないでください)
- Good first issue も用意しています。日本語 NER の改善、電話番号形式の
  追加など、小さな PR から歓迎します

使ってみて「ここが弱い」「こういうユースケースがある」という声も
Issue や Discussion でもらえると助かります。
