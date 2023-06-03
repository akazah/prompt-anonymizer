# Prompt Anonymizer
Prompt Anonymizer は、OpenAI API に送信する前にテキストを匿名化するデモスクリプトです。Presidio AnalyzerとPresidio Anonymizerを使用して、テキスト内の個人情報を識別して置換します。
  - Prompt Anonymizerは、元のテキストを AI が同じものであると認識できる形式で匿名化します。
  - Prompt Anonymizerは日本語と英語で利用できます。

## セットアップ
1. `git clone https://github.com/akazah/prompt-anonymizer.git`
2. `cd prompt-anonymizer`
3. `poetry install`
4. 環境変数にOpenAIのAPIキーをセットする。 `export OPENAI_API_KEY={YOUR_API_KEY}`  
    または、direnvやdotenvなどを使ってもOKです。(私はdirenvを使っています)
5. spacyのモデルをダウンロード。
    - `poetry run python -m spacy download en_core_web_lg`
    - `poetry run python -m spacy download ja_core_news_lg`

## 使用方法
### 日本語
`poetry run python main.py --text "山田太郎は、来月、誕生日を迎えます。どんなプレゼントが適しているでしょうか。山田太郎は、おいしいものが大好きです。山田太郎は、東京都中央区に在住しています。彼のメールアドレスは example@example.com です。彼の電話番号は 090-0000-0000 です。" --language ja`

### 英語
`poetry run python main.py --text "John will have a birthday next month. What kind of gift would be appropriate? John loves nice cuisine. John lives in New York. His email is example@example.com. His mobile is (333)333-3333." --language en`


## デモ
<img alt="demo_en" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_en.gif?raw=true" width="40%"> <img alt="demo_ja" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_ja.gif?raw=true" width="40%">

## TODO
- [ ] Improve the anonymization process. The current version often fails to anonymize.
- [ ] Find efficient ways for human to find fails to anonymize. 
- [ ] Separate the demo portion from the library portion so that they can be used independently.
- [ ] Refactor the code. The first version has a lot of code that is not DRY.
- [ ] Follow the best practices of Python.
- [ ] Add validation and exception handling.
- [ ] Add tests.

## Contributing
Pull requests are welcome.
This is my first python project, so I'm not sure if I'm following the best practices. If you have any suggestions, please let me know.

## License
Licensed under the [MIT](https://opensource.org/licenses/MIT) License.
