# Story: PII-laden request -> anonymize -> mapping -> LLM reply -> deanonymize.
# Regenerate: vhs demo/tapes/demo_fr.tape  (from the repository root)

Output demo/demo_fr.gif

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

Type "# 1) Anonymiser une demande contenant des données personnelles (le mapping reste local)"
Enter
Sleep 800ms
Type `prompt-anonymizer anonymize -l fr --mapping-file mapping.json -t "Bonjour, je suis Jean Dupont. Merci de rédiger une annonce de déménagement de bureau. Nous déménageons à Paris. Contact : 06 12 34 56 78 / jean.dupont@example.com"`
Enter
Sleep 5s

Type "# 2) Le mapping ne quitte jamais votre machine"
Enter
Sleep 600ms
Type "cat mapping.json"
Enter
Sleep 2.5s

Type "# 3) La réponse du LLM conserve les étiquettes -> restaurer les vraies valeurs"
Enter
Sleep 800ms
Type `prompt-anonymizer deanonymize --mapping-file mapping.json -t "Cher/Chère <Nom_1>, nous avons le plaisir de vous annoncer que notre bureau déménage à <Adresse_1>. Pour toute question, contactez-nous au <Téléphone_1> ou à <Email_1>."`
Enter
Sleep 6s
