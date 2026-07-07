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

## Bắt đầu nhanh (Python)

```bash
# Chưa công bố lên PyPI — cài từ GitHub (theo tag, hoặc main để lấy bản mới nhất):
pip install git+https://github.com/akazah/prompt-anonymizer@v0.2.2
python -m spacy download ja_core_news_sm   # en: en_core_web_sm; es: es_core_news_sm
python -m spacy download xx_ent_wiki_sm    # vi: không có pipeline spaCy chính thức — WikiNER
# zh: zh_core_web_sm; ko: ko_core_news_sm; fr/de/pt/it: *_core_news_sm — hoặc
# cài mọi mô hình sm cùng lúc: uv sync --group models (lg: --group models-lg)
```

```python
from prompt_anonymizer import PromptAnonymizer

pa = PromptAnonymizer(languages=["ja"])
result = pa.anonymize("山田太郎の電話は090-1234-5678", language="ja")

result.text     # '<人名_1>の電話は<電話番号_1>'
result.mapping  # {'<人名_1>': '山田太郎', '<電話番号_1>': '090-1234-5678'}

pa_es = PromptAnonymizer(languages=["es"])
pa_es.anonymize(
    "El cliente es Javier Moreno, teléfono 612 345 678", language="es"
).text  # 'El cliente es <Nombre_1>, teléfono <Teléfono_1>'

# tên vi cần backend transformer (xem mục "Backend NER transformer tùy chọn")
pa_vi = PromptAnonymizer(languages=["vi"], ner_backend="hf")
pa_vi.anonymize(
    "Tôi tên là Nguyễn Văn An, số điện thoại 0912 345 678", language="vi"
).text  # 'Tôi tên là <Tên_1>, số điện thoại <SốĐiệnThoại_1>'

llm_output = call_your_llm(result.text)          # nhãn vẫn còn sau vòng qua LLM
pa.deanonymize(llm_output, result.mapping)       # khôi phục giá trị thật, cục bộ
```

CLI (`-l ja|en|es|vi|zh|ko|fr|de|pt|it`):

```bash
prompt-anonymizer anonymize -l ja --interactive --mapping-file mapping.json \
  -t "山田太郎の電話は090-1234-5678"
prompt-anonymizer anonymize -l es -t "El cliente es Javier Moreno, teléfono 612 345 678"
prompt-anonymizer anonymize -l fr -t "Le client est Pierre Durand, téléphone 06 12 34 56 78"
prompt-anonymizer deanonymize --mapping-file mapping.json -t "<人名_1>様 ..."
```

## Bắt đầu nhanh (JavaScript / TypeScript)

Node CLI phản chiếu CLI Python (cùng lệnh, cờ và đầu ra JSON),
chạy lõi TypeScript với transformers.js NER trên thiết bị:

```bash
# Chưa công bố lên npm — build từ repo:
cd web && pnpm install && pnpm --filter "./packages/*" build
node packages/cli/dist/cli.js anonymize -t "山田太郎の電話は090-1234-5678"
# Sau khi công bố: npx @prompt-anonymizer/cli anonymize -t "..."
```

Để nhúng bảng ẩn danh → khôi phục có sẵn vào bất kỳ frontend nào, dùng
web component độc lập framework:

```html
<script type="module">
  import { definePromptAnonymizer } from "@prompt-anonymizer/element";
  definePromptAnonymizer();
</script>
<prompt-anonymizer language="auto"></prompt-anonymizer>
```

React (`@prompt-anonymizer/react`) và Vue 3 (`@prompt-anonymizer/vue`) cung cấp
`<AnonymizerPanel />` có kiểu, bọc phần tử đó:

```tsx
import { AnonymizerPanel } from "@prompt-anonymizer/react"; // hoặc "@prompt-anonymizer/vue"

<AnonymizerPanel language="auto" denyList={["ProjectX"]}
  onAnonymize={(result) => console.log(result.text)} />
```

Cho giao diện tùy chỉnh, cả hai gói còn expose phiên ẩn danh → LLM → khôi phục
dưới dạng hook / composable:

```ts
import { useAnonymizer } from "@prompt-anonymizer/react"; // hoặc "@prompt-anonymizer/vue"

const { anonymize, restore, mapping, busy, error } = useAnonymizer();
const result = await anonymize(input, { language: "ja" });
// gửi result.text tới LLM — mapping không bao giờ rời thiết bị — rồi:
const { text: restored, unresolved } = await restore(llmReply);
```

Mặc định phát hiện chỉ dùng regex (email, số điện thoại, …); truyền
`ner` (ví dụ `new TransformersNerBackend()` từ `@prompt-anonymizer/core`)
để cũng che tên và địa điểm.

## Bắt đầu nhanh (proxy cục bộ)

Chạy proxy tương thích OpenAI và trỏ bất kỳ client nào vào nó — PII được che
trước khi yêu cầu rời khỏi máy của bạn và nhãn được khôi phục trong phản hồi
(kể cả streaming). Bảng ánh xạ chỉ nằm trong bộ nhớ của proxy, theo từng yêu
cầu:

```bash
# Chưa công bố lên npm — build từ repo:
cd web && pnpm install && pnpm --filter @prompt-anonymizer/proxy... build
node packages/proxy/dist/cli.js            # lắng nghe tại http://127.0.0.1:8787
# Sau khi công bố: npx @prompt-anonymizer/proxy

# Trong ứng dụng / shell của bạn:
export OPENAI_BASE_URL=http://127.0.0.1:8787/v1
```

GUI quản trị tại `http://127.0.0.1:8787/admin/` hiển thị trạng thái trực tiếp
và các sự kiện che PII (chỉ nhãn và số lượng), cho phép chỉnh cấu hình proxy
(upstream, NER, danh sách deny/allow) và cung cấp playground ẩn danh chỉ chạy
cục bộ. Proxy mặc định gắn vào `127.0.0.1`; giá trị gốc chỉ có thể xem trong
GUI khi bạn bật `--record-mappings` một cách tường minh.

## Cổng lúc commit / CI (`scan`)

Cả hai CLI đều có lệnh con `scan` thiết kế cho git hook và CI: thoát mã
`0` khi đầu vào sạch, `1` khi tìm thấy PII và `2` khi có lỗi. Nó chỉ báo cáo
`file:line:col` và loại thực thể — **văn bản khớp không bao giờ được in ra**,
nên đầu ra của hook và log CI không chứa PII. Mặc định nó offline, tất định và
không cần mô hình (PII có cấu trúc: email, số điện thoại, mã bưu chính JP,
My Number, thẻ tín dụng — cộng các cụm từ `--deny`); `--ner` bật thêm phát
hiện tên/địa điểm ở nơi có mô hình.

```bash
prompt-anonymizer scan src/prompt.txt docs/*.md      # tệp (ví dụ đã staged)
git diff --cached -U0 | prompt-anonymizer scan       # hoặc pipe một diff
prompt-anonymizer scan --deny ProjectX --json -t "..."
```

Với framework [pre-commit](https://pre-commit.com)
(định nghĩa hook: [`.pre-commit-hooks.yaml`](../../.pre-commit-hooks.yaml)):

```yaml
repos:
  - repo: https://github.com/akazah/prompt-anonymizer
    rev: v0.2.2  # tag đầu tiên kèm hook này
    hooks:
      - id: prompt-anonymizer-scan
        # args: [--deny, ProjectX, --allow, support@example.com]
```

Dự án Node có thể nối cùng cổng chặn này qua husky + lint-staged
(`npx @prompt-anonymizer/cli` sau khi công bố; trước đó, build từ
`web/packages/cli`):

```json
{ "lint-staged": { "*": "prompt-anonymizer scan" } }
```

Như mọi thứ khác ở đây, phát hiện là nỗ lực tốt nhất: hãy coi `scan` là lưới
an toàn cho các rò rỉ hiển nhiên, không phải một sự đảm bảo.

## Tại sao không …?

**Tại sao không dùng Presidio trực tiếp?** Dùng [Microsoft Presidio](https://github.com/microsoft/presidio)
trực tiếp nếu bạn cần framework phát hiện / ẩn danh PII đa mục đích.
Prompt Anonymizer dùng Presidio làm engine cho lõi Python và bổ sung quy trình
vòng qua LLM: placeholder nhất quán, prompt đã ẩn danh ra ngoài, khôi phục cục
bộ sau phản hồi — cộng thêm giao diện trình duyệt, tiện ích và desktop không
cần Python.

**Tại sao không LLM Guard?** [LLM Guard](https://github.com/protectai/llm-guard)
là bộ guardrail Python vững chắc với Anonymize/Deanonymize riêng.
Prompt Anonymizer khác ở ba điểm: phát hiện đa ngôn ngữ trên mười ngôn ngữ
với PII có cấu trúc riêng theo khu vực (ID quốc gia được kiểm tra chữ số như
My Number, định dạng số điện thoại theo vùng), giao diện cho người không
phải lập trình viên (dán văn bản trên trang trình duyệt — không cần cài
Python), và mã nguồn đủ nhỏ để thực sự đọc được.

**Tại sao không dùng tiện ích Chrome "100% cục bộ"?** Một số tiện ích mã
đóng tuyên bố xử lý cục bộ. Tuyên bố không phải là kiểm toán. Dự án này có
giấy phép MIT: mở tab mạng, hoặc đọc mã nguồn. (Tiện ích "quyền riêng tư AI"
độc hại đã được ghi nhận là đánh cắp hội thoại — danh mục này xứng đáng bị
hoài nghi.)

## Cách hoạt động

1. Phát hiện — Presidio + spaCy NER (Python) hoặc transformers.js NER + bộ nhận
   dạng regex (trình duyệt/desktop/tiện ích), mở rộng với mẫu số điện thoại
   theo locale do registry điều khiển (JP, US/NANP, ES, VN, CN, KR, FR, DE,
   PT, IT) và bộ nhận dạng riêng cho Nhật (mã bưu
   chính 〒, My Number có kiểm tra chữ số). Email và thẻ tín dụng không phụ
   thuộc ngôn ngữ; JP_POSTAL_CODE và JP_MY_NUMBER được phát hiện ở mọi chế độ
   ngôn ngữ.
2. Gán nhãn nhất quán — span được gộp (ưu tiên điểm) và thay thế theo offset
   từ cuối; giá trị giống nhau dùng chung một nhãn.
3. Hoàn nguyên — `deanonymize(text, mapping)` khôi phục bản gốc, nhãn dài nhất
   trước. Bảng ánh xạ được trả về cho bạn và **không bao giờ được thư viện lưu
   trữ**; lưu trữ an toàn là trách nhiệm của bạn.

## Thực thể được hỗ trợ

| Thực thể | nhãn ja | nhãn en | nhãn es | nhãn vi | Engine |
|---|---|---|---|---|---|
| PERSON | 人名 | Name | Nombre | Tên | NER |
| LOCATION | 住所 | Location | Dirección | ĐịaChỉ | NER |
| EMAIL_ADDRESS | メールアドレス | Email | Correo | Email | mẫu regex |
| PHONE_NUMBER | 電話番号 | Phone | Teléfono | SốĐiệnThoại | mẫu regex theo ngôn ngữ do registry điều khiển + vùng libphonenumber (JP/US/ES/VN/CN/KR/FR/DE/PT/IT) |
| JP_POSTAL_CODE | 郵便番号 | PostalCode | CódigoPostal | MãBưuĐiện | mẫu regex (tùy chỉnh) |
| JP_MY_NUMBER | マイナンバー | MyNumber | MyNumber | MyNumber | mẫu regex + chữ số kiểm tra (tùy chỉnh) |
| CREDIT_CARD | クレジットカード | CreditCard | Tarjeta | ThẻTínDụng | mẫu regex + kiểm tra Luhn (cả hai lõi, mọi ngôn ngữ) |
| CUSTOM (deny list) | 秘匿情報 | Custom | Personalizado | TùyChỉnh | khớp chính xác |
| US_SSN (tùy chọn bật) | 社会保障番号 | SSN | SSN | SSN | mẫu regex + quy tắc loại trừ (cả hai lõi, mọi ngôn ngữ) |
| IBAN_CODE (tùy chọn bật) | IBAN | IBAN | IBAN | IBAN | mẫu regex + kiểm tra mod-97 (cả hai lõi, mọi ngôn ngữ) |

Nhãn cho sáu ngôn ngữ mới (zh, ko, fr, de, pt, it) nằm trong
`src/prompt_anonymizer/labels/*.yaml` (Python) và trong `LABELS` ở
`web/packages/core/src/labeling.ts` (TS).

`deny_list` buộc che các chuỗi cụ thể; `allow_list` miễn trừ chúng.
Các thực thể tùy chọn bật không được phát hiện theo mặc định — hãy yêu cầu
tường minh: `PromptAnonymizer(entities=[...])`, `new Anonymizer({ entities })`,
hoặc `--entities PERSON,EMAIL_ADDRESS,US_SSN,IBAN_CODE` trên cả hai CLI.

### Backend NER transformer tùy chọn (Python)

NER mặc định là spaCy, với mô hình theo từng ngôn ngữ được phân giải từ
registry trung tâm (xem bảng bên dưới; cài mọi mô hình `sm` bằng
`uv sync --group models`, bản `lg` bằng `--group models-lg`, hoặc dùng
`python -m spacy download <mô hình>`). Tiếng Việt không có pipeline spaCy
chính thức — cả hai kích thước dùng mô hình WikiNER đa ngôn ngữ
`xx_ent_wiki_sm` để token hóa và NER PER/LOC cơ bản. Để có recall tên/địa
điểm tiếng Việt tốt, hãy dùng backend transformer thay thế (xem bên dưới).

Để cải thiện đáng kể recall PERSON/LOCATION (đặc biệt `ja` và `vi`),
cài extra `hf` và chuyển backend — mô hình Hugging Face theo ngôn ngữ, hoàn
toàn cục bộ:

| Ngôn ngữ | spaCy (`sm` / `lg`) | HF NER (`ner_backend="hf"`) |
|---|---|---|
| `ja` | `ja_core_news_sm` / `ja_core_news_lg` | `tsmatz/xlm-roberta-ner-japanese` |
| `en` | `en_core_web_sm` / `en_core_web_lg` | `dslim/bert-base-NER` |
| `es` | `es_core_news_sm` / `es_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `vi` | `xx_ent_wiki_sm` (cả hai kích thước) | `NlpHUST/ner-vietnamese-electra-base` |
| `zh` | `zh_core_web_sm` / `zh_core_web_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `ko` | `ko_core_news_sm` / `ko_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `fr` | `fr_core_news_sm` / `fr_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `de` | `de_core_news_sm` / `de_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `pt` | `pt_core_news_sm` / `pt_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |
| `it` | `it_core_news_sm` / `it_core_news_lg` | `Davlan/bert-base-multilingual-cased-ner-hrl` |

Mô hình HRL đa ngôn ngữ bao phủ `de`/`es`/`fr`/`it`/`pt`/`zh` một cách bản
địa; tiếng Hàn không có checkpoint chuyên dụng trong họ này và dựa vào khả
năng chuyển giao xuyên ngôn ngữ của mBERT.

Lõi TypeScript (trình duyệt / tiện ích / desktop / Node CLI) chạy mô hình
ONNX transformers.js: `ja` và `en` dùng cùng họ với trên; `es`, `vi`, `zh`,
`ko`, `fr`, `de`, `pt` và `it` đều dùng
`Xenova/bert-base-multilingual-cased-ner-hrl` (không có bản export ONNX
của mô hình NER tiếng Việt chuyên dụng; mô hình đa ngôn ngữ chuyển giao tốt
sang tiếng Việt, và lưu ý chuyển giao tương tự áp dụng cho tiếng Hàn).

```bash
pip install "prompt-anonymizer[hf]"
```

```python
pa = PromptAnonymizer(languages=["ja"], ner_backend="hf")  # CLI: --ner-backend hf
pa_vi = PromptAnonymizer(languages=["vi"], ner_backend="hf")  # khuyến nghị cho tên vi
```

Xử lý theo lô cũng có sẵn và nhanh hơn nhiều so với vòng lặp:

```python
results = pa.anonymize_batch(texts, language="ja", batch_size=16)
```

## Độ chính xác

Đo ở cấp span trên tập golden tổng hợp có seed (200 tài liệu cho mỗi ngôn
ngữ trong cả mười ngôn ngữ, tại `tests/golden/golden_{lang}.json`) —
xem [docs/EVAL.md](../EVAL.md) để có bảng đầy đủ và
`uv run python -m prompt_anonymizer.evals` để tái tạo (mặc định cả mười ngôn
ngữ). Điểm nổi bật (lõi Python, mô hình `sm`): ja PHONE_NUMBER /
EMAIL_ADDRESS / JP_POSTAL_CODE / CREDIT_CARD recall 1.00; ja PERSON recall
0.82 với spaCy, 1.00 với `ner_backend="hf"`. es/vi PHONE_NUMBER recall cũng
1.00; vi PERSON/LOCATION hưởng lợi mạnh từ `ner_backend="hf"`. Recall PII
có cấu trúc (điện thoại / email / thẻ) đạt 1.00 cho sáu ngôn ngữ mới (zh,
ko, fr, de, pt, it) trên tập golden — [docs/EVAL.md](../EVAL.md) có bảng
của lõi TS; số liệu NER Python do eval hằng tuần tạo ra.

Các con số này nhằm bắt hồi quy, không phải hứa hẹn recall trên văn bản thực
tế.

## Hạn chế

- **Phát hiện là nỗ lực tốt nhất và không được đảm bảo.** False negative vẫn
  xảy ra; luôn rà soát văn bản đã ẩn danh trước khi gửi đi đâu
  (`--interactive`, và bảng ánh xạ trong giao diện, tồn tại cho việc này).
- Ẩn danh che định danh, không che ngữ cảnh. Chi tiết gần như định danh trong
  văn bản xung quanh (chức danh hiếm, sự kiện cụ thể) vẫn có thể thu hẹp ai
  hoặc cái gì bạn đang viết về.
- Recall LOCATION là thực thể yếu nhất, đặc biệt với địa chỉ tiếng Nhật không
  đầy đủ.
- Mô hình NER trên trình duyệt tải một lần khoảng ~100–300 MB (sau đó được
  cache).
- Bản build desktop và tiện ích hiện chưa được ký.

## Lộ trình

Xem [issues](https://github.com/akazah/prompt-anonymizer/issues) mở và
[IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md). Nổi bật: công bố npm / PyPI,
công bố cửa hàng (Chrome Web Store), ký mã, mô hình NER tiếng Nhật nhỏ hơn,
PII có cấu trúc đa vùng (thêm định dạng số điện thoại / ID quốc gia qua kiểm
tra checksum).

## Contributing / Security / License

- [CONTRIBUTING.md](../../.github/CONTRIBUTING.md) — thiết lập dev (uv / pnpm), lệnh test và eval
- [SECURITY.md](../../.github/SECURITY.md) — báo cáo lỗ hổng và cách vượt qua ẩn danh
- [MIT](../../LICENSE)
