/**
 * UI chrome strings for the GitHub Pages web app.
 *
 * The language `<select>` drives both anonymizer detection language and UI
 * locale. When the select is `auto`, the UI follows `navigator.language`
 * (falling back to English) while detection still auto-detects the input.
 *
 * Brand name "Prompt Anonymizer" stays untranslated.
 */

import {
  LABELS,
  SUPPORTED_LANGUAGES,
  isLanguage,
  languageFromBcp47,
  type Language,
  type LanguageOption,
} from "@prompt-anonymizer/core";

export const UI_MESSAGE_KEYS = [
  "auto",
  "privacyLead",
  "privacyBody",
  "language",
  "nerModel",
  "loadSample",
  "anonymize",
  "working",
  "nerOffWarning",
  "loadingModel",
  "downloadingModel",
  "originalHeading",
  "inputPlaceholder",
  "anonymizedHeading",
  "copyAnonymized",
  "copied",
  "mappingLabel",
  "mappingOriginal",
  "restoreHeading",
  "restorePlaceholder",
  "deanonymize",
  "copyRestored",
  "restoreHint",
  "unresolvedLabels",
  "checking",
  "wasmBadge",
  "engineWebgpuTitle",
  "engineWasmTitle",
  "pageTitle",
  "pageDescription",
  "errorPrefix",
] as const;

export type UiMessageKey = (typeof UI_MESSAGE_KEYS)[number];

type UiCatalog = Record<UiMessageKey, string>;

const EN: UiCatalog = {
  auto: "Auto",
  privacyLead: "A second pair of eyes before you paste into an LLM.",
  privacyBody:
    "100% on-device — detection runs in your browser via WebGPU/WASM, your text is never sent to any server.",
  language: "Language",
  nerModel: "NER model (names & locations)",
  loadSample: "Load sample",
  anonymize: "Anonymize",
  working: "Working…",
  nerOffWarning:
    "NER model is off: names and locations will NOT be masked (only emails, phone numbers, etc.).",
  loadingModel: "Loading model…",
  downloadingModel: "Downloading model:",
  originalHeading: "Original (stays on your device)",
  inputPlaceholder: "Paste the text you were about to send to an LLM…",
  anonymizedHeading: "Anonymized (safe to send)",
  copyAnonymized: "Copy anonymized text",
  copied: "Copied!",
  mappingLabel: "Label",
  mappingOriginal: "Original (kept local)",
  restoreHeading: "Restore (paste the LLM reply)",
  restorePlaceholder: "Paste the LLM response containing labels like <{label}> …",
  deanonymize: "Deanonymize",
  copyRestored: "Copy restored text",
  restoreHint:
    "Detection is best-effort — always review the anonymized text before sending it anywhere.",
  unresolvedLabels: "Unresolved labels (no stored mapping):",
  checking: "checking…",
  wasmBadge: "WASM (no WebGPU)",
  engineWebgpuTitle: "Inference is GPU-accelerated in your browser.",
  engineWasmTitle:
    "WebGPU unavailable; falling back to WebAssembly (slower, still on-device).",
  pageTitle: "Prompt Anonymizer — a buddy check for PII before it reaches an LLM",
  pageDescription:
    "A buddy check for PII before it reaches an LLM: catches the personal info you didn't mean to send, with consistent reversible labels. Runs 100% in your browser (WebGPU / WASM) — your text never leaves your device.",
  errorPrefix: "Error:",
};

const JA: UiCatalog = {
  auto: "自動判定",
  privacyLead: "送る前のダブルチェック。",
  privacyBody: "全処理がブラウザ内で完結し、テキストはサーバーへ一切送信されません。",
  language: "言語",
  nerModel: "NERモデル（人名と場所）",
  loadSample: "サンプルを読み込む",
  anonymize: "匿名化",
  working: "処理中…",
  nerOffWarning:
    "NERモデルがオフのため、人名・住所はマスクされません（メールアドレスや電話番号などのみ）。",
  loadingModel: "モデルを読み込み中…",
  downloadingModel: "モデルをダウンロード中:",
  originalHeading: "原文（端末内に保持）",
  inputPlaceholder: "LLMに送ろうとしていたテキストを貼り付け…",
  anonymizedHeading: "匿名化済み（送信して安全）",
  copyAnonymized: "匿名化テキストをコピー",
  copied: "コピーしました",
  mappingLabel: "ラベル",
  mappingOriginal: "原文（ローカルに保持）",
  restoreHeading: "復元（LLMの返答を貼り付け）",
  restorePlaceholder: "<{label}> のようなラベルを含むLLMの返答を貼り付け…",
  deanonymize: "復元",
  copyRestored: "復元テキストをコピー",
  restoreHint: "検出はベストエフォートです。送信前に必ず匿名化結果を確認してください。",
  unresolvedLabels: "未解決のラベル（保存された対応なし）:",
  checking: "確認中…",
  wasmBadge: "WASM（WebGPUなし）",
  engineWebgpuTitle: "ブラウザ内でGPU加速により推論しています。",
  engineWasmTitle: "WebGPUが使えないため、WebAssemblyにフォールバックしています（低速ですが端末内処理）。",
  pageTitle: "Prompt Anonymizer — LLMに送る前のPIIダブルチェック",
  pageDescription:
    "LLMに送る前のPIIダブルチェック。意図せず含めがちな個人情報を、一貫した可逆ラベルで置き換えます。処理はすべてブラウザ内（WebGPU / WASM）で完結し、テキストは端末から出ません。",
  errorPrefix: "エラー:",
};

const ES: UiCatalog = {
  auto: "Automático",
  privacyLead: "Una segunda mirada antes de pegar en un LLM.",
  privacyBody:
    "100% en el dispositivo: la detección se ejecuta en tu navegador con WebGPU/WASM; tu texto nunca se envía a ningún servidor.",
  language: "Idioma",
  nerModel: "Modelo NER (nombres y ubicaciones)",
  loadSample: "Cargar ejemplo",
  anonymize: "Anonimizar",
  working: "Procesando…",
  nerOffWarning:
    "El modelo NER está desactivado: los nombres y ubicaciones NO se enmascararán (solo correos, teléfonos, etc.).",
  loadingModel: "Cargando modelo…",
  downloadingModel: "Descargando modelo:",
  originalHeading: "Original (permanece en tu dispositivo)",
  inputPlaceholder: "Pega el texto que ibas a enviar a un LLM…",
  anonymizedHeading: "Anonimizado (seguro para enviar)",
  copyAnonymized: "Copiar texto anonimizado",
  copied: "¡Copiado!",
  mappingLabel: "Etiqueta",
  mappingOriginal: "Original (se conserva localmente)",
  restoreHeading: "Restaurar (pega la respuesta del LLM)",
  restorePlaceholder: "Pega la respuesta del LLM con etiquetas como <{label}> …",
  deanonymize: "Desanonimizar",
  copyRestored: "Copiar texto restaurado",
  restoreHint:
    "La detección es de mejor esfuerzo: revisa siempre el texto anonimizado antes de enviarlo.",
  unresolvedLabels: "Etiquetas sin resolver (sin mapeo guardado):",
  checking: "comprobando…",
  wasmBadge: "WASM (sin WebGPU)",
  engineWebgpuTitle: "La inferencia se acelera con GPU en tu navegador.",
  engineWasmTitle:
    "WebGPU no disponible; se usa WebAssembly (más lento, sigue en el dispositivo).",
  pageTitle: "Prompt Anonymizer — una revisión de PII antes de llegar a un LLM",
  pageDescription:
    "Una revisión de PII antes de llegar a un LLM: captura la información personal que no querías enviar, con etiquetas reversibles coherentes. Se ejecuta 100% en tu navegador (WebGPU / WASM); tu texto nunca sale del dispositivo.",
  errorPrefix: "Error:",
};

const VI: UiCatalog = {
  auto: "Tự động",
  privacyLead: "Kiểm tra lần nữa trước khi dán vào LLM.",
  privacyBody:
    "100% trên thiết bị — phát hiện chạy trong trình duyệt qua WebGPU/WASM, văn bản của bạn không bao giờ được gửi lên máy chủ.",
  language: "Ngôn ngữ",
  nerModel: "Mô hình NER (tên và địa điểm)",
  loadSample: "Tải mẫu",
  anonymize: "Ẩn danh",
  working: "Đang xử lý…",
  nerOffWarning:
    "Mô hình NER đang tắt: tên và địa điểm sẽ KHÔNG được che (chỉ email, số điện thoại, v.v.).",
  loadingModel: "Đang tải mô hình…",
  downloadingModel: "Đang tải xuống mô hình:",
  originalHeading: "Bản gốc (giữ trên thiết bị của bạn)",
  inputPlaceholder: "Dán văn bản bạn sắp gửi tới LLM…",
  anonymizedHeading: "Đã ẩn danh (an toàn để gửi)",
  copyAnonymized: "Sao chép văn bản đã ẩn danh",
  copied: "Đã sao chép!",
  mappingLabel: "Nhãn",
  mappingOriginal: "Bản gốc (giữ cục bộ)",
  restoreHeading: "Khôi phục (dán phản hồi của LLM)",
  restorePlaceholder: "Dán phản hồi LLM chứa các nhãn như <{label}> …",
  deanonymize: "Bỏ ẩn danh",
  copyRestored: "Sao chép văn bản đã khôi phục",
  restoreHint:
    "Phát hiện mang tính tốt nhất có thể — luôn xem lại văn bản đã ẩn danh trước khi gửi đi.",
  unresolvedLabels: "Nhãn chưa giải quyết (không có ánh xạ đã lưu):",
  checking: "đang kiểm tra…",
  wasmBadge: "WASM (không có WebGPU)",
  engineWebgpuTitle: "Suy luận được tăng tốc GPU trong trình duyệt của bạn.",
  engineWasmTitle:
    "Không có WebGPU; chuyển sang WebAssembly (chậm hơn, vẫn trên thiết bị).",
  pageTitle: "Prompt Anonymizer — kiểm tra PII trước khi đến LLM",
  pageDescription:
    "Kiểm tra PII trước khi đến LLM: phát hiện thông tin cá nhân bạn không định gửi, với nhãn đảo ngược nhất quán. Chạy 100% trong trình duyệt (WebGPU / WASM) — văn bản không rời thiết bị.",
  errorPrefix: "Lỗi:",
};

const ZH: UiCatalog = {
  auto: "自动检测",
  privacyLead: "粘贴到 LLM 之前再检查一遍。",
  privacyBody: "100% 本地处理——检测在浏览器中通过 WebGPU/WASM 运行，文本不会发送到任何服务器。",
  language: "语言",
  nerModel: "NER 模型（姓名与地点）",
  loadSample: "加载示例",
  anonymize: "匿名化",
  working: "处理中…",
  nerOffWarning: "NER 模型已关闭：姓名和地点不会被遮蔽（仅处理邮箱、电话等）。",
  loadingModel: "正在加载模型…",
  downloadingModel: "正在下载模型:",
  originalHeading: "原文（保留在您的设备上）",
  inputPlaceholder: "粘贴你准备发送给 LLM 的文本…",
  anonymizedHeading: "已匿名（可安全发送）",
  copyAnonymized: "复制匿名文本",
  copied: "已复制！",
  mappingLabel: "标签",
  mappingOriginal: "原文（本地保留）",
  restoreHeading: "还原（粘贴 LLM 回复）",
  restorePlaceholder: "粘贴包含 <{label}> 等标签的 LLM 回复…",
  deanonymize: "去匿名化",
  copyRestored: "复制还原文本",
  restoreHint: "检测为尽力而为——发送前请务必检查匿名化结果。",
  unresolvedLabels: "未解析的标签（无已存映射）:",
  checking: "检查中…",
  wasmBadge: "WASM（无 WebGPU）",
  engineWebgpuTitle: "正在浏览器中使用 GPU 加速推理。",
  engineWasmTitle: "无法使用 WebGPU；回退到 WebAssembly（较慢，仍在本地）。",
  pageTitle: "Prompt Anonymizer — 发送到 LLM 前的 PII 检查",
  pageDescription:
    "发送到 LLM 前的 PII 检查：用一致且可逆的标签替换你无意发送的个人信息。100% 在浏览器中运行（WebGPU / WASM）——文本不会离开你的设备。",
  errorPrefix: "错误:",
};

const KO: UiCatalog = {
  auto: "자동 감지",
  privacyLead: "LLM에 붙여넣기 전에 한 번 더 확인하세요.",
  privacyBody:
    "100% 기기 내에서 처리됩니다. 감지는 브라우저의 WebGPU/WASM으로 실행되며, 텍스트는 어떤 서버에도 전송되지 않습니다.",
  language: "언어",
  nerModel: "NER 모델 (이름 및 위치)",
  loadSample: "샘플 불러오기",
  anonymize: "익명화",
  working: "처리 중…",
  nerOffWarning:
    "NER 모델이 꺼져 있어 이름과 위치는 마스킹되지 않습니다(이메일, 전화번호 등만 처리).",
  loadingModel: "모델 로드 중…",
  downloadingModel: "모델 다운로드 중:",
  originalHeading: "원문 (기기에 유지)",
  inputPlaceholder: "LLM에 보내려던 텍스트를 붙여넣으세요…",
  anonymizedHeading: "익명화됨 (전송해도 안전)",
  copyAnonymized: "익명화 텍스트 복사",
  copied: "복사됨!",
  mappingLabel: "레이블",
  mappingOriginal: "원문 (로컬에 유지)",
  restoreHeading: "복원 (LLM 응답 붙여넣기)",
  restorePlaceholder: "<{label}> 같은 레이블이 포함된 LLM 응답을 붙여넣으세요…",
  deanonymize: "역익명화",
  copyRestored: "복원 텍스트 복사",
  restoreHint: "감지는 최선을 다하는 방식입니다. 전송 전에 익명화 결과를 반드시 확인하세요.",
  unresolvedLabels: "해결되지 않은 레이블 (저장된 매핑 없음):",
  checking: "확인 중…",
  wasmBadge: "WASM (WebGPU 없음)",
  engineWebgpuTitle: "브라우저에서 GPU 가속으로 추론합니다.",
  engineWasmTitle: "WebGPU를 사용할 수 없어 WebAssembly로 대체합니다(더 느리지만 여전히 기기 내).",
  pageTitle: "Prompt Anonymizer — LLM에 도달하기 전 PII 점검",
  pageDescription:
    "LLM에 도달하기 전 PII 점검: 보내지 않으려던 개인정보를 일관된 가역 레이블로 바꿉니다. 브라우저에서 100% 실행(WebGPU / WASM)되며 텍스트는 기기를 떠나지 않습니다.",
  errorPrefix: "오류:",
};

const FR: UiCatalog = {
  auto: "Auto",
  privacyLead: "Une seconde vérification avant de coller dans un LLM.",
  privacyBody:
    "100 % sur l’appareil — la détection s’exécute dans votre navigateur via WebGPU/WASM ; votre texte n’est jamais envoyé à un serveur.",
  language: "Langue",
  nerModel: "Modèle NER (noms et lieux)",
  loadSample: "Charger un exemple",
  anonymize: "Anonymiser",
  working: "Traitement…",
  nerOffWarning:
    "Le modèle NER est désactivé : les noms et lieux ne seront PAS masqués (uniquement e-mails, téléphones, etc.).",
  loadingModel: "Chargement du modèle…",
  downloadingModel: "Téléchargement du modèle :",
  originalHeading: "Original (reste sur votre appareil)",
  inputPlaceholder: "Collez le texte que vous alliez envoyer à un LLM…",
  anonymizedHeading: "Anonymisé (sans risque à envoyer)",
  copyAnonymized: "Copier le texte anonymisé",
  copied: "Copié !",
  mappingLabel: "Libellé",
  mappingOriginal: "Original (conservé localement)",
  restoreHeading: "Restaurer (collez la réponse du LLM)",
  restorePlaceholder: "Collez la réponse du LLM contenant des libellés comme <{label}> …",
  deanonymize: "Désanonymiser",
  copyRestored: "Copier le texte restauré",
  restoreHint:
    "La détection est au mieux de ses capacités — vérifiez toujours le texte anonymisé avant de l’envoyer.",
  unresolvedLabels: "Libellés non résolus (aucun mapping enregistré) :",
  checking: "vérification…",
  wasmBadge: "WASM (pas de WebGPU)",
  engineWebgpuTitle: "L’inférence est accélérée par le GPU dans votre navigateur.",
  engineWasmTitle:
    "WebGPU indisponible ; bascule vers WebAssembly (plus lent, toujours sur l’appareil).",
  pageTitle: "Prompt Anonymizer — une vérification PII avant d’atteindre un LLM",
  pageDescription:
    "Une vérification PII avant d’atteindre un LLM : intercepte les infos personnelles que vous n’aviez pas l’intention d’envoyer, avec des libellés cohérents et réversibles. S’exécute à 100 % dans votre navigateur (WebGPU / WASM) — votre texte ne quitte jamais votre appareil.",
  errorPrefix: "Erreur :",
};

const DE: UiCatalog = {
  auto: "Auto",
  privacyLead: "Ein zweiter Blick, bevor Sie in ein LLM einfügen.",
  privacyBody:
    "100 % auf dem Gerät — die Erkennung läuft in Ihrem Browser über WebGPU/WASM; Ihr Text wird nie an einen Server gesendet.",
  language: "Sprache",
  nerModel: "NER-Modell (Namen & Orte)",
  loadSample: "Beispiel laden",
  anonymize: "Anonymisieren",
  working: "Arbeitet…",
  nerOffWarning:
    "NER-Modell ist aus: Namen und Orte werden NICHT maskiert (nur E-Mails, Telefonnummern usw.).",
  loadingModel: "Modell wird geladen…",
  downloadingModel: "Modell wird heruntergeladen:",
  originalHeading: "Original (bleibt auf Ihrem Gerät)",
  inputPlaceholder: "Fügen Sie den Text ein, den Sie an ein LLM senden wollten…",
  anonymizedHeading: "Anonymisiert (sicher zum Senden)",
  copyAnonymized: "Anonymisierten Text kopieren",
  copied: "Kopiert!",
  mappingLabel: "Label",
  mappingOriginal: "Original (lokal behalten)",
  restoreHeading: "Wiederherstellen (LLM-Antwort einfügen)",
  restorePlaceholder: "Fügen Sie die LLM-Antwort mit Labels wie <{label}> ein …",
  deanonymize: "Deanonymisieren",
  copyRestored: "Wiederhergestellten Text kopieren",
  restoreHint:
    "Die Erkennung ist bestmöglich — prüfen Sie den anonymisierten Text immer vor dem Senden.",
  unresolvedLabels: "Ungelöste Labels (kein gespeichertes Mapping):",
  checking: "prüft…",
  wasmBadge: "WASM (kein WebGPU)",
  engineWebgpuTitle: "Die Inferenz wird in Ihrem Browser per GPU beschleunigt.",
  engineWasmTitle:
    "WebGPU nicht verfügbar; Fallback auf WebAssembly (langsamer, weiterhin auf dem Gerät).",
  pageTitle: "Prompt Anonymizer — ein PII-Check, bevor es ein LLM erreicht",
  pageDescription:
    "Ein PII-Check, bevor es ein LLM erreicht: fängt persönliche Daten ab, die Sie nicht senden wollten, mit konsistenten umkehrbaren Labels. Läuft zu 100 % in Ihrem Browser (WebGPU / WASM) — Ihr Text verlässt Ihr Gerät nie.",
  errorPrefix: "Fehler:",
};

const PT: UiCatalog = {
  auto: "Automático",
  privacyLead: "Uma segunda verificação antes de colar num LLM.",
  privacyBody:
    "100% no dispositivo — a deteção corre no seu browser via WebGPU/WASM; o seu texto nunca é enviado para nenhum servidor.",
  language: "Idioma",
  nerModel: "Modelo NER (nomes e locais)",
  loadSample: "Carregar exemplo",
  anonymize: "Anonimizar",
  working: "A processar…",
  nerOffWarning:
    "O modelo NER está desligado: nomes e locais NÃO serão mascarados (apenas e-mails, telefones, etc.).",
  loadingModel: "A carregar modelo…",
  downloadingModel: "A descarregar modelo:",
  originalHeading: "Original (fica no seu dispositivo)",
  inputPlaceholder: "Cole o texto que ia enviar a um LLM…",
  anonymizedHeading: "Anonimizado (seguro para enviar)",
  copyAnonymized: "Copiar texto anonimizado",
  copied: "Copiado!",
  mappingLabel: "Etiqueta",
  mappingOriginal: "Original (mantido localmente)",
  restoreHeading: "Restaurar (cole a resposta do LLM)",
  restorePlaceholder: "Cole a resposta do LLM com etiquetas como <{label}> …",
  deanonymize: "Desanonimizar",
  copyRestored: "Copiar texto restaurado",
  restoreHint:
    "A deteção é de melhor esforço — reveja sempre o texto anonimizado antes de o enviar.",
  unresolvedLabels: "Etiquetas por resolver (sem mapeamento guardado):",
  checking: "a verificar…",
  wasmBadge: "WASM (sem WebGPU)",
  engineWebgpuTitle: "A inferência é acelerada por GPU no seu browser.",
  engineWasmTitle:
    "WebGPU indisponível; a usar WebAssembly (mais lento, ainda no dispositivo).",
  pageTitle: "Prompt Anonymizer — uma verificação de PII antes de chegar a um LLM",
  pageDescription:
    "Uma verificação de PII antes de chegar a um LLM: captura a informação pessoal que não queria enviar, com etiquetas reversíveis consistentes. Corre 100% no seu browser (WebGPU / WASM) — o seu texto nunca sai do dispositivo.",
  errorPrefix: "Erro:",
};

const IT: UiCatalog = {
  auto: "Automatico",
  privacyLead: "Un doppio controllo prima di incollare in un LLM.",
  privacyBody:
    "100% sul dispositivo — il rilevamento gira nel browser via WebGPU/WASM; il testo non viene mai inviato ad alcun server.",
  language: "Lingua",
  nerModel: "Modello NER (nomi e luoghi)",
  loadSample: "Carica esempio",
  anonymize: "Anonimizza",
  working: "Elaborazione…",
  nerOffWarning:
    "Il modello NER è disattivato: nomi e luoghi NON verranno mascherati (solo e-mail, telefoni, ecc.).",
  loadingModel: "Caricamento modello…",
  downloadingModel: "Download modello:",
  originalHeading: "Originale (resta sul tuo dispositivo)",
  inputPlaceholder: "Incolla il testo che stavi per inviare a un LLM…",
  anonymizedHeading: "Anonimizzato (sicuro da inviare)",
  copyAnonymized: "Copia testo anonimizzato",
  copied: "Copiato!",
  mappingLabel: "Etichetta",
  mappingOriginal: "Originale (conservato in locale)",
  restoreHeading: "Ripristina (incolla la risposta dell'LLM)",
  restorePlaceholder: "Incolla la risposta dell'LLM con etichette come <{label}> …",
  deanonymize: "Deanonymizza",
  copyRestored: "Copia testo ripristinato",
  restoreHint:
    "Il rilevamento è best-effort — controlla sempre il testo anonimizzato prima di inviarlo.",
  unresolvedLabels: "Etichette non risolte (nessuna mappa salvata):",
  checking: "verifica…",
  wasmBadge: "WASM (senza WebGPU)",
  engineWebgpuTitle: "L'inferenza è accelerata dalla GPU nel browser.",
  engineWasmTitle:
    "WebGPU non disponibile; fallback a WebAssembly (più lento, sempre sul dispositivo).",
  pageTitle: "Prompt Anonymizer — un controllo PII prima che raggiunga un LLM",
  pageDescription:
    "Un controllo PII prima che raggiunga un LLM: intercetta le informazioni personali che non volevi inviare, con etichette coerenti e reversibili. Gira al 100% nel browser (WebGPU / WASM) — il testo non lascia mai il dispositivo.",
  errorPrefix: "Errore:",
};

export const UI_STRINGS: Record<Language, UiCatalog> = {
  en: EN,
  ja: JA,
  es: ES,
  vi: VI,
  zh: ZH,
  ko: KO,
  fr: FR,
  de: DE,
  pt: PT,
  it: IT,
};

/** Resolve UI locale from the language select value (+ navigator when auto). */
export function resolveUiLanguage(
  option: LanguageOption | string,
  navigatorLanguage: string = typeof navigator !== "undefined" ? (navigator.language ?? "") : "",
): Language {
  if (option !== "auto" && isLanguage(option)) return option;
  return languageFromBcp47(navigatorLanguage) ?? "en";
}

export function t(lang: Language, key: UiMessageKey): string {
  return UI_STRINGS[lang][key];
}

/** Restore-pane placeholder with a language-appropriate sample label. */
export function restorePlaceholderFor(lang: Language): string {
  const label = `<${LABELS[lang].PERSON}_1>`;
  return t(lang, "restorePlaceholder").replace("{label}", label);
}

/** Guard used by tests: every registry language has a complete catalog. */
export function assertUiCatalogComplete(): void {
  for (const lang of SUPPORTED_LANGUAGES) {
    const catalog = UI_STRINGS[lang];
    for (const key of UI_MESSAGE_KEYS) {
      if (!catalog[key]?.trim()) {
        throw new Error(`Missing UI string: ${lang}.${key}`);
      }
    }
  }
}
