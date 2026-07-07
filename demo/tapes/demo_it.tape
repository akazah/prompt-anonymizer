# Story: PII-laden request -> anonymize -> mapping -> LLM reply -> deanonymize.
# Regenerate: vhs demo/tapes/demo_it.tape  (from the repository root)

Output demo/demo_it.gif

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

Type "# 1) Anonimizzare una richiesta con dati personali (la mappatura resta locale)"
Enter
Sleep 800ms
Type `prompt-anonymizer anonymize -l it --mapping-file mapping.json -t "Ciao, sono Marco Rossi. Per favore, scriva un annuncio di trasferimento dell'ufficio. Ci trasferiamo a Milano. Contatto: 333 123 4567 / marco.rossi@example.com"`
Enter
Sleep 5s

Type "# 2) La mappatura non lascia mai il tuo dispositivo"
Enter
Sleep 600ms
Type "cat mapping.json"
Enter
Sleep 2.5s

Type "# 3) La risposta dell'LLM mantiene le etichette -> ripristinare i valori reali"
Enter
Sleep 800ms
Type `prompt-anonymizer deanonymize --mapping-file mapping.json -t "Gentile <Nome_1>, siamo lieti di annunciare che il nostro ufficio si trasferisce a <Indirizzo_1>. Per domande, contattaci al <Telefono_1> o <Email_1>."`
Enter
Sleep 6s
