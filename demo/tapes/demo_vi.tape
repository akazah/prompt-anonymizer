# Story: PII-laden request -> anonymize -> mapping -> LLM reply -> deanonymize.
# Regenerate: vhs demo/tapes/demo_vi.tape  (from the repository root)

Output demo/demo_vi.gif

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

Type "# 1) Ẩn danh yêu cầu chứa thông tin cá nhân (bảng ánh xạ chỉ lưu cục bộ)"
Enter
Sleep 800ms
Type `prompt-anonymizer anonymize -l vi --mapping-file mapping.json -t "Xin chào, tôi là Nguyễn Văn An. Vui lòng soạn thông báo chuyển văn phòng. Chúng tôi chuyển đến Hà Nội. Liên hệ: 0912 345 678 / an.nguyen@example.com"`
Enter
Sleep 5s

Type "# 2) Bảng ánh xạ không rời khỏi máy của bạn"
Enter
Sleep 600ms
Type "cat mapping.json"
Enter
Sleep 2.5s

Type "# 3) Phản hồi của LLM vẫn giữ nhãn -> khôi phục giá trị thật"
Enter
Sleep 800ms
Type `prompt-anonymizer deanonymize --mapping-file mapping.json -t "Kính gửi <Tên_1>, chúng tôi vui mừng thông báo văn phòng sẽ chuyển đến <ĐịaChỉ_1>. Mọi thắc mắc xin liên hệ <SốĐiệnThoại_1> hoặc <Email_1>."`
Enter
Sleep 6s
