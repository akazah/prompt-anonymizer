# Story: PII-laden request -> anonymize -> mapping -> LLM reply -> deanonymize.
# Regenerate: vhs demo/tapes/demo_es.tape  (from the repository root)

Output demo/demo_es.gif

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

Type "# 1) Anonimizar una solicitud con datos personales (el mapeo queda en local)"
Enter
Sleep 800ms
Type `prompt-anonymizer anonymize -l es --mapping-file mapping.json -t "Hola, soy María García. Por favor redacte un aviso de traslado de oficina. Nos mudamos a Madrid. Contacto: 612 345 678 / maria.garcia@example.com"`
Enter
Sleep 5s

Type "# 2) El mapeo nunca sale de tu equipo"
Enter
Sleep 600ms
Type "cat mapping.json"
Enter
Sleep 2.5s

Type "# 3) La respuesta del LLM conserva las etiquetas -> restaurar los valores reales"
Enter
Sleep 800ms
Type `prompt-anonymizer deanonymize --mapping-file mapping.json -t "Estimada <Nombre_1>, nos complace anunciar que nuestra oficina se traslada a <Dirección_1>. Para consultas, contáctenos en <Teléfono_1> o <Correo_1>."`
Enter
Sleep 6s
