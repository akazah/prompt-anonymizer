# Story: PII-laden request -> anonymize -> mapping -> LLM reply -> deanonymize.
# Regenerate: vhs demo/tapes/demo_en.tape  (from the repository root)

Output demo/demo_en.gif

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

Type "# 1) Anonymize a request full of PII (mapping stays local)"
Enter
Sleep 800ms
Type `prompt-anonymizer anonymize -l en --mapping-file mapping.json -t "Hi, I'm John Smith. Please draft an office-move announcement. We are moving to New York. Contact: (333) 333-3333 / john.smith@example.com"`
Enter
Sleep 5s

Type "# 2) The mapping never leaves your machine"
Enter
Sleep 600ms
Type "cat mapping.json"
Enter
Sleep 2.5s

Type "# 3) The LLM reply keeps the labels -> restore the real values"
Enter
Sleep 800ms
Type `prompt-anonymizer deanonymize --mapping-file mapping.json -t "Dear <Name_1>, we are pleased to announce our office is moving to <Location_1>. For questions, reach us at <Phone_1> or <Email_1>."`
Enter
Sleep 6s
