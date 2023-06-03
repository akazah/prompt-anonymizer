English | [日本語](README_ja.md)
# Prompt Anonymizer
Prompt Anonymizer is a demo scripts to anonymize text before sending it to the OpenAI API. It uses the Presidio Analyzer and Presidio Anonymizer to identify and replace PII entities in the text.
- Prompt Anonymizer anonymize the original text in a format that allows the AI to recognize that the same thing is the same.
- Prompt Anonymizer is available in Japanese and English.

## Setup
1. `git clone https://github.com/akazah/prompt-anonymizer.git`
2. `cd prompt-anonymizer`
3. `poetry install`
4. Set your OpenAI API key; `export OPENAI_API_KEY=YOUR_API_KEY` or you can use environment variables management tools like direnv, dotenv and so on. (I'm using direnv)
5. Download spacy model; `poetry run python -m spacy download en_core_web_lg` and `poetry run python -m spacy download ja_core_news_lg`

## Usage
### English
`poetry run python main.py --text "John will have a birthday next month. What kind of gift would be appropriate? John loves nice cuisine. John lives in New York. His email is example@example.com. His mobile is (333)333-3333." --language en`

### Japanese
`poetry run python main.py --text "山田太郎は、来月、誕生日を迎えます。どんなプレゼントが適しているでしょうか。山田太郎は、おいしいものが大好きです。山田太郎は、東京都中央区に在住しています。彼のメールアドレスは example@example.com です。彼の電話番号は 090-0000-0000 です。" --language ja`

## Demo
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
