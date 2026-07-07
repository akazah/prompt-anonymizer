[English](../../README.md) | [日本語](README_ja.md) | [Español](README_es.md) | Tiếng Việt | [中文](README_zh.md) | [한국어](README_ko.md) | [Français](README_fr.md) | [Deutsch](README_de.md) | [Português](README_pt.md) | [Italiano](README_it.md)

# Prompt Anonymizer

> **Dùng LLM frontier mà không để lộ PII của bạn.**
> Ẩn danh có thể hoàn nguyên, trên thiết bị — không phải đánh đổi trí tuệ lấy quyền riêng tư.

[![CI](https://github.com/akazah/prompt-anonymizer/actions/workflows/ci.yml/badge.svg)](https://github.com/akazah/prompt-anonymizer/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/akazah/prompt-anonymizer)](https://github.com/akazah/prompt-anonymizer/releases)
[![Python](https://img.shields.io/badge/python-3.12%E2%80%933.13-blue)](pyproject.toml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)

Hiện tại bạn có hai lựa chọn. Chạy mô hình cục bộ — riêng tư, nhưng phải từ bỏ
trí tuệ frontier. Hoặc dán vào ChatGPT / Claude / Gemini và tự kiểm soát, từng
prompt một. Prompt Anonymizer nằm ở giữa:

|  | Trí tuệ | Quyền riêng tư | Điều bạn phải tin tưởng |
|---|---|---|---|
| Mô hình cục bộ | ✗ hy sinh | ✓ | không gì cả |
| Mô hình frontier, thuần | ✓ | ✗ | nhà cung cấp, và sự cảnh giác của chính bạn |
| **Mô hình frontier + Prompt Anonymizer** | **✓** | **✓** | **mã nguồn bạn có thể đọc + một lần rà soát cuối** |

Nó thay thế PII bằng nhãn nhất quán (`<人名_1>`, `<Name_1>`, `<Nombre_1>`,
`<Tên_1>`, …) **trước khi** văn bản rời khỏi máy của bạn. Vì cùng một giá trị
luôn nhận cùng một nhãn, câu trả lời của LLM vẫn có nghĩa. Khi phản hồi trở
về, bảng ánh xạ — không bao giờ rời thiết bị — khôi phục các giá trị thật.

Ngôn ngữ hỗ trợ: tiếng Anh (`en`), tiếng Nhật (`ja`), tiếng Tây Ban Nha (`es`),
tiếng Việt (`vi`), và — mới — tiếng Trung (`zh`), tiếng Hàn (`ko`), tiếng
Pháp (`fr`), tiếng Đức (`de`), tiếng Bồ Đào Nha (`pt`) và tiếng Ý (`it`).
Mặc định `PromptAnonymizer(languages=…)` vẫn là `("en", "ja")`; các ngôn ngữ
còn lại bật qua `languages=[...]`. Mọi bộ chọn ngôn ngữ trong giao diện và
tự động nhận diện đều bao phủ cả mười ngôn ngữ. Hỗ trợ ngôn ngữ được điều
khiển bởi registry trung tâm — thêm một ngôn ngữ chỉ cần một mục registry
(`languages.py` / `types.ts`) cộng một tệp nhãn.

Phát hiện chạy trên thiết bị (WebGPU / WASM trong trình duyệt, spaCy hoặc
transformers cục bộ trong Python). Đừng chỉ tin lời chúng tôi: mở DevTools, xem
tab mạng, hoặc đọc mã nguồn. Giấy phép MIT và đủ nhỏ để rà soát trong một lần
ngồi.

<details>
<summary><b>Mục lục</b></summary>

- [Demo](#demo)
- [Dùng thử](#dùng-thử)
- [Bắt đầu nhanh (Python)](#bắt-đầu-nhanh-python)
- [Bắt đầu nhanh (JavaScript / TypeScript)](#bắt-đầu-nhanh-javascript--typescript)
- [Bắt đầu nhanh (proxy cục bộ)](#bắt-đầu-nhanh-proxy-cục-bộ)
- [Cổng lúc commit / CI (`scan`)](#cổng-lúc-commit--ci-scan)
- [Tại sao không …?](#tại-sao-không-)
- [Cách hoạt động](#cách-hoạt-động)
- [Thực thể được hỗ trợ](#thực-thể-được-hỗ-trợ)
- [Độ chính xác](#độ-chính-xác)
- [Hạn chế](#hạn-chế)
- [Lộ trình](#lộ-trình)
- [Contributing / Security / License](#contributing--security--license)

</details>

## Demo

Ẩn danh → bảng ánh xạ giữ tại local → phản hồi LLM giữ nhãn → khôi phục:

<img alt="Demo ứng dụng trình duyệt: ẩn danh, bảng ánh xạ, vòng qua khôi phục" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_web.gif?raw=true" width="85%">

<details>
<summary>Demo CLI (tiếng Nhật / tiếng Anh — tám ngôn ngữ còn lại dùng tương tự)</summary>

<img alt="Demo CLI (tiếng Nhật)" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_ja.gif?raw=true" width="49%"> <img alt="Demo CLI (tiếng Anh)" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_en.gif?raw=true" width="49%">
</details>

<details>
<summary>Demo tiện ích Chrome (bảng bên)</summary>

<img alt="Demo tiện ích Chrome" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_extension.gif?raw=true" width="40%">
</details>

## Dùng thử

| Mục tiêu | Cách | Ghi chú |
|---|---|---|
| **Trình duyệt (WebGPU)** | [akazah.github.io/prompt-anonymizer](https://akazah.github.io/prompt-anonymizer/) | 100% trên thiết bị: NER chạy trong trình duyệt qua WebGPU (dự phòng WASM). Văn bản của bạn không bao giờ gửi lên máy chủ — kiểm chứng trong tab mạng. |
| **Ứng dụng desktop** | Tải từ [Releases](https://github.com/akazah/prompt-anonymizer/releases) (`.dmg` / `.msi` / `.exe` / `.AppImage` / `.deb` / `.rpm`) | Tauri 2. Hiện chưa ký — hệ điều hành sẽ cảnh báo khi chạy lần đầu. |
| **Tiện ích Chrome** | `prompt-anonymizer-extension-*.zip` từ [Releases](https://github.com/akazah/prompt-anonymizer/releases) | Giải nén → `chrome://extensions` → bật Chế độ nhà phát triển → "Tải tiện ích đã giải nén". Chọn văn bản → nhấp chuột phải → *Anonymize selection*. |
| **Python / CLI** | `pip install git+https://github.com/akazah/prompt-anonymizer` (chưa có trên PyPI) | Presidio + spaCy. Xem Bắt đầu nhanh bên dưới. |
| **Node CLI (npx)** | `npx @prompt-anonymizer/cli` (chưa có trên npm — build từ `web/packages/cli`) | Cùng lệnh và cờ với CLI Python; transformers.js NER, hoàn toàn trên thiết bị. |
| **Web Component** | `@prompt-anonymizer/element` (chưa có trên npm) | Phần tử `<prompt-anonymizer>` độc lập framework: nhúng toàn bộ bảng ẩn danh → khôi phục vào bất kỳ trang web nào (HTML thuần, Svelte, Angular, …). |
| **React / Vue** | `@prompt-anonymizer/react` / `@prompt-anonymizer/vue` (chưa có trên npm) | Component `<AnonymizerPanel />` dùng ngay, kèm hook `useAnonymizer()` / composable cho giao diện tùy chỉnh. Xem Bắt đầu nhanh bên dưới. |
| **Proxy cục bộ + GUI quản trị** | `@prompt-anonymizer/proxy` (chưa có trên npm — build từ `web/packages/proxy`) | Reverse proxy tương thích OpenAI: trỏ `OPENAI_BASE_URL` vào nó và PII được che trước khi rời máy của bạn, nhãn được khôi phục trong phản hồi (kể cả streaming). GUI quản trị tại `http://127.0.0.1:8787/admin/`. Xem Bắt đầu nhanh bên dưới. |
| **Máy chủ MCP** | `@prompt-anonymizer/mcp` (chưa có trên npm — build từ `web/packages/mcp`) | Các công cụ `anonymize` / `deanonymize` / `scan` cho mọi MCP client (Claude Desktop, Claude Code, Cursor, …). Bảng ánh xạ nhãn nằm trong bộ nhớ máy chủ (`mapping_id`) và không bao giờ hiển thị cho mô hình trừ khi được yêu cầu rõ ràng. |
| **Hook commit / cổng CI** | `prompt-anonymizer scan` (cả hai CLI) + [`.pre-commit-hooks.yaml`](../../.pre-commit-hooks.yaml) | Cổng chặn PII qua mã thoát cho kiểm tra lúc commit và trong CI: báo cáo `file:line:col` và loại thực thể, không bao giờ in văn bản khớp. Mặc định offline và không cần mô hình. Xem bên dưới. |
