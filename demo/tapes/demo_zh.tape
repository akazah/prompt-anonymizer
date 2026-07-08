# Story: PII-laden request -> anonymize -> mapping -> LLM reply -> deanonymize.
# Regenerate: vhs demo/tapes/demo_zh.tape  (from the repository root)

Output demo/demo_zh.gif

Set Shell "bash"
Set FontSize 15
Set FontFamily "Noto Sans Mono CJK SC"
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

Type "# 1) 匿名化含有个人信息的请求（对照表仅保存在本地）"
Enter
Sleep 800ms
Type `prompt-anonymizer anonymize -l zh --mapping-file mapping.json -t "你好，我是王小明，公司在北京市朝阳区。请起草上月工程款催款函。联系：138-1234-5678 / xiaoming.wang@example.com"`
Enter
Sleep 5s

Type "# 2) 对照表不会离开你的电脑"
Enter
Sleep 600ms
Type "cat mapping.json"
Enter
Sleep 2.5s

Type "# 3) LLM 的回复保留标签 -> 还原真实值"
Enter
Sleep 800ms
Type `prompt-anonymizer deanonymize --mapping-file mapping.json -t "尊敬的<姓名_1>，我们已记录您在<地址_1>的账款。请通过<电话号码_1>或<电子邮箱_1>确认付款安排。"`
Enter
Sleep 6s
