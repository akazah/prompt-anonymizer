# Story: PII-laden request -> anonymize -> mapping -> LLM reply -> deanonymize.
# Regenerate: vhs demo/tapes/demo_de.tape  (from the repository root)

Output demo/demo_de.gif

Set Shell "bash"
Set FontSize 15
Set FontFamily "DejaVu Sans Mono"
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

Type "# 1) Eine Anfrage mit personenbezogenen Daten anonymisieren (Mapping bleibt lokal)"
Enter
Sleep 800ms
Type `prompt-anonymizer anonymize -l de --mapping-file mapping.json -t "Hallo, ich bin Max Mustermann aus Berlin. Bitte formulieren Sie ein Follow-up zur Schadensmeldung (Wasserschaden). Kontakt: 0151 23456789 / max.mustermann@example.com"`
Enter
Sleep 5s

Type "# 2) Das Mapping verlässt niemals Ihr Gerät"
Enter
Sleep 600ms
Type "cat mapping.json"
Enter
Sleep 2.5s

Type "# 3) Die Antwort des LLM behält die Labels -> die echten Werte wiederherstellen"
Enter
Sleep 800ms
Type `prompt-anonymizer deanonymize --mapping-file mapping.json -t "Sehr geehrte(r) <Name_1>, Ihre Meldung aus <Adresse_1> wurde registriert. Erreichen Sie uns unter <Telefon_1> oder <EMail_1>."`
Enter
Sleep 6s
