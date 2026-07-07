# Story: PII-laden request -> anonymize -> mapping -> LLM reply -> deanonymize.
# Regenerate: vhs demo/tapes/demo_ko.tape  (from the repository root)

Output demo/demo_ko.gif

Set Shell "bash"
Set FontSize 15
Set FontFamily "Noto Sans Mono CJK KR"
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

Type "# 1) 개인정보가 포함된 요청을 익명화합니다 (매핑은 로컬에만 저장됩니다)"
Enter
Sleep 800ms
Type `prompt-anonymizer anonymize -l ko --mapping-file mapping.json -t "안녕하세요, 저는 김민준입니다. 사무실 이전 안내문을 작성해 주세요. 저희는 서울로 이전합니다. 연락처: 010-1234-5678 / minjun.kim@example.com"`
Enter
Sleep 5s

Type "# 2) 매핑 표는 기기 밖으로 나가지 않습니다"
Enter
Sleep 600ms
Type "cat mapping.json"
Enter
Sleep 2.5s

Type "# 3) LLM 응답에는 라벨이 그대로 남습니다 -> 실제 값으로 복원합니다"
Enter
Sleep 800ms
Type `prompt-anonymizer deanonymize --mapping-file mapping.json -t "<이름_1>님께, 저희 사무실이 <주소_1>(으)로 이전함을 안내드립니다. 문의사항은 <전화번호_1> 또는 <이메일_1>로 연락 주세요."`
Enter
Sleep 6s
