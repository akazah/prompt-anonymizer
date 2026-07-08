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
Type `prompt-anonymizer anonymize -l ko --mapping-file mapping.json -t "안녕하세요, 서울특별시 강남구에 사는 김민준입니다. 올해 가을 입학 서류 제출 기한을 확인해 주세요. 연락: 010-1234-5678 / minjun.kim@example.com"`
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
Type `prompt-anonymizer deanonymize --mapping-file mapping.json -t "<이름_1>님, <주소_1> 거주 확인되었습니다. <전화번호_1> 또는 <이메일_1>로 서류 안내를 보내드리겠습니다."`
Enter
Sleep 6s
