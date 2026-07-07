# Story: PII-laden request -> anonymize -> mapping -> LLM reply -> deanonymize.
# Regenerate: vhs demo/tapes/demo_pt.tape  (from the repository root)

Output demo/demo_pt.gif

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

Type "# 1) Anonimizar uma solicitação com dados pessoais (o mapeamento fica local)"
Enter
Sleep 800ms
Type `prompt-anonymizer anonymize -l pt --mapping-file mapping.json -t "Olá, eu sou João Silva. Por favor, redija um comunicado de mudança de escritório. Estamos nos mudando para São Paulo. Contato: 912 345 678 / joao.silva@example.com"`
Enter
Sleep 5s

Type "# 2) O mapeamento nunca sai do seu computador"
Enter
Sleep 600ms
Type "cat mapping.json"
Enter
Sleep 2.5s

Type "# 3) A resposta do LLM mantém os rótulos -> restaurar os valores reais"
Enter
Sleep 800ms
Type `prompt-anonymizer deanonymize --mapping-file mapping.json -t "Prezado(a) <Nome_1>, temos o prazer de anunciar que nosso escritório está se mudando para <Endereço_1>. Em caso de dúvidas, entre em contato pelo <Telefone_1> ou <Email_1>."`
Enter
Sleep 6s
