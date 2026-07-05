# Story: PII-laden request -> anonymize -> mapping -> LLM reply -> deanonymize.
# Regenerate: vhs demo/tapes/demo_ja.tape  (from the repository root)

Output demo/demo_ja.gif

Set Shell "bash"
Set FontSize 15
Set FontFamily "Noto Sans Mono CJK JP"
Set Width 1080
Set Height 500
Set Padding 16
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms

Hide
Type "cd /workspace && source .venv/bin/activate && clear"
Enter
Sleep 500ms
Show

Type "# 1) PIIを含む依頼文を匿名化する（マッピングはローカル保存）"
Enter
Sleep 800ms
Type `prompt-anonymizer anonymize -l ja --mapping-file mapping.json -t "お世話になっております。山田太郎です。新しいオフィス（〒150-0002 東京都渋谷区）への移転案内のメール文面を作ってください。連絡先: 090-1234-5678 / taro.yamada@example.com"`
Enter
Sleep 5s

Type "# 2) 対応表はローカルに残る（LLMには送らない）"
Enter
Sleep 600ms
Type "cat mapping.json"
Enter
Sleep 2.5s

Type "# 3) LLMの応答にはラベルがそのまま残る → 復元する"
Enter
Sleep 800ms
Type `prompt-anonymizer deanonymize --mapping-file mapping.json -t "<人名_1>様 いつもお世話になっております。この度、弊社オフィスは <郵便番号_1> <住所_1> へ移転いたします。ご不明点は <電話番号_1> または <メールアドレス_1> までご連絡ください。"`
Enter
Sleep 6s
