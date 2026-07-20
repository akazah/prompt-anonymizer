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
  "valuePitch",
  "tagLocal",
  "language",
  "nerModel",
  "splitNames",
  "loadSample",
  "anonymize",
  "anonymizeShort",
  "anonymizeHint",
  "working",
  "nerOffWarning",
  "flowOriginal",
  "flowAnonymized",
  "flowRestore",
  "loadingModel",
  "downloadingModel",
  "originalHeading",
  "inputPlaceholder",
  "anonymizedHeading",
  "copyAnonymized",
  "openRestore",
  "copied",
  "mappingLabel",
  "mappingOriginal",
  "outputEmpty",
  "restoreHeading",
  "restorePlaceholder",
  "restoreOutputEmpty",
  "deanonymize",
  "copyRestored",
  "unresolvedLabels",
  "pageTitle",
  "pageDescription",
  "errorPrefix",
  // Kept for catalog completeness / meta; not shown in the compact UI shell.
  "privacyLead",
  "privacyBody",
  "restoreHint",
] as const;

export type UiMessageKey = (typeof UI_MESSAGE_KEYS)[number];

type UiCatalog = Record<UiMessageKey, string>;

const EN: UiCatalog = {
  auto: "Auto",
  valuePitch:
    "Masks personal info in your browser—never sent out—and restores it later",
  tagLocal: "Stays local",
  privacyLead: "A second pair of eyes before you paste into an LLM.",
  privacyBody:
    "100% on-device — detection runs in your browser via WebGPU/WASM, your text is never sent to any server.",
  language: "Language",
  nerModel: "Names & places",
  splitNames: "Split name (First/Last)",
  loadSample: "Load sample",
  anonymize: "Anonymize in browser (no server)",
  anonymizeShort: "Anonymize in browser",
  anonymizeHint: "Nothing sent to a server",
  working: "Working…",
  nerOffWarning: "Names not masked",
  flowOriginal: "Original",
  flowAnonymized: "Masked",
  flowRestore: "Restore",
  loadingModel: "Loading model…",
  downloadingModel: "Downloading model:",
  originalHeading: "Your text",
  inputPlaceholder: "Paste text for the LLM…",
  anonymizedHeading: "Masked",
  copyAnonymized: "Copy",
  openRestore: "Restore",
  copied: "Copied!",
  mappingLabel: "Label",
  mappingOriginal: "Value",
  outputEmpty: "Masked text appears here…",
  restoreHeading: "LLM reply",
  restorePlaceholder: "Paste reply with <{label}>…",
  restoreOutputEmpty: "Restored text here…",
  deanonymize: "Restore",
  copyRestored: "Copy",
  restoreHint:
    "Detection is best-effort — always review the anonymized text before sending it anywhere.",
  unresolvedLabels: "Unresolved labels:",
  pageTitle: "Prompt Anonymizer — a buddy check for PII before it reaches an LLM",
  pageDescription:
    "A buddy check for PII before it reaches an LLM: catches the personal info you didn't mean to send, with consistent reversible labels. Runs 100% in your browser (WebGPU / WASM) — your text never leaves your device.",
  errorPrefix: "Error:",
};

const JA: UiCatalog = {
  auto: "自動判定",
  valuePitch: "ブラウザ内で処理。外部に送らず個人情報をマスクし、復元",
  tagLocal: "端末に保持",
  privacyLead: "送る前のダブルチェック。",
  privacyBody: "全処理がブラウザ内で完結し、テキストはサーバーへ一切送信されません。",
  language: "言語",
  nerModel: "人名・場所",
  splitNames: "姓名分割（姓/名）",
  loadSample: "サンプルを読み込む",
  anonymize: "ブラウザ内で匿名化（外部サーバー送信なし）",
  anonymizeShort: "ブラウザ内で匿名化",
  anonymizeHint: "外部サーバー送信なし",
  working: "処理中…",
  nerOffWarning: "人名はマスクされません",
  flowOriginal: "原文",
  flowAnonymized: "マスク済み",
  flowRestore: "復元",
  loadingModel: "モデルを読み込み中…",
  downloadingModel: "モデルをダウンロード中:",
  originalHeading: "原文",
  inputPlaceholder: "LLMに送るテキストを貼り付け…",
  anonymizedHeading: "マスク済み",
  copyAnonymized: "コピー",
  openRestore: "復元へ",
  copied: "コピーしました",
  mappingLabel: "ラベル",
  mappingOriginal: "実値",
  outputEmpty: "マスク結果がここに表示されます…",
  restoreHeading: "LLMの返答",
  restorePlaceholder: "<{label}> を含む返答を貼り付け…",
  restoreOutputEmpty: "復元結果がここに表示されます…",
  deanonymize: "復元",
  copyRestored: "コピー",
  restoreHint: "検出はベストエフォートです。送信前に必ず匿名化結果を確認してください。",
  unresolvedLabels: "未解決ラベル:",
  pageTitle: "Prompt Anonymizer — LLMに送る前のPIIダブルチェック",
  pageDescription:
    "LLMに送る前のPIIダブルチェック。意図せず含めがちな個人情報を、一貫した可逆ラベルで置き換えます。処理はすべてブラウザ内（WebGPU / WASM）で完結し、テキストは端末から出ません。",
  errorPrefix: "エラー:",
};

const ES: UiCatalog = {
  auto: "Automático",
  valuePitch:
    "Enmascara datos personales en el navegador sin enviarlos y permite restaurarlos",
  tagLocal: "Queda local",
  privacyLead: "Una segunda mirada antes de pegar en un LLM.",
  privacyBody:
    "100% en el dispositivo: la detección se ejecuta en tu navegador con WebGPU/WASM; tu texto nunca se envía a ningún servidor.",
  language: "Idioma",
  nerModel: "Nombres y lugares",
  splitNames: "Separar nombre (Nombre/Apellido)",
  loadSample: "Cargar ejemplo",
  anonymize: "Anonimizar en el navegador (sin servidor)",
  anonymizeShort: "Anonimizar en el navegador",
  anonymizeHint: "Sin envío a servidores",
  working: "Procesando…",
  nerOffWarning:
    "El modelo NER está desactivado: los nombres y ubicaciones NO se enmascararán (solo correos, teléfonos, etc.).",
  flowOriginal: "Original",
  flowAnonymized: "Enmascarado",
  flowRestore: "Restaurar",
  loadingModel: "Cargando modelo…",
  downloadingModel: "Descargando modelo:",
  originalHeading: "Tu texto",
  inputPlaceholder: "Pega el texto que ibas a enviar a un LLM…",
  anonymizedHeading: "Enmascarado",
  copyAnonymized: "Copiar",
  openRestore: "Restaurar",
  copied: "¡Copiado!",
  mappingLabel: "Etiqueta",
  mappingOriginal: "Valor",
  outputEmpty: "El texto anonimizado aparecerá aquí…",
  restoreHeading: "Respuesta LLM",
  restorePlaceholder: "Pega la respuesta del LLM con etiquetas como <{label}> …",
  restoreOutputEmpty: "El texto restaurado aparecerá aquí…",
  deanonymize: "Restaurar",
  copyRestored: "Copiar",
  restoreHint:
    "La detección es de mejor esfuerzo: revisa siempre el texto anonimizado antes de enviarlo.",
  unresolvedLabels: "Sin resolver:",
  pageTitle: "Prompt Anonymizer — una revisión de PII antes de llegar a un LLM",
  pageDescription:
    "Una revisión de PII antes de llegar a un LLM: captura la información personal que no querías enviar, con etiquetas reversibles coherentes. Se ejecuta 100% en tu navegador (WebGPU / WASM); tu texto nunca sale del dispositivo.",
  errorPrefix: "Error:",
};

const VI: UiCatalog = {
  auto: "Tự động",
  valuePitch:
    "Che thông tin cá nhân trong trình duyệt, không gửi ra ngoài, có thể khôi phục",
  tagLocal: "Giữ cục bộ",
  privacyLead: "Kiểm tra lần nữa trước khi dán vào LLM.",
  privacyBody:
    "100% trên thiết bị — phát hiện chạy trong trình duyệt qua WebGPU/WASM, văn bản của bạn không bao giờ được gửi lên máy chủ.",
  language: "Ngôn ngữ",
  nerModel: "Tên & địa điểm",
  splitNames: "Tách tên (Họ/Tên)",
  loadSample: "Tải mẫu",
  anonymize: "Ẩn danh trong trình duyệt (không gửi server)",
  anonymizeShort: "Ẩn danh trong trình duyệt",
  anonymizeHint: "Không gửi ra server",
  working: "Đang xử lý…",
  nerOffWarning:
    "Mô hình NER đang tắt: tên và địa điểm sẽ KHÔNG được che (chỉ email, số điện thoại, v.v.).",
  flowOriginal: "Bản gốc",
  flowAnonymized: "Đã che",
  flowRestore: "Khôi phục",
  loadingModel: "Đang tải mô hình…",
  downloadingModel: "Đang tải xuống mô hình:",
  originalHeading: "Văn bản",
  inputPlaceholder: "Dán văn bản bạn sắp gửi tới LLM…",
  anonymizedHeading: "Đã che",
  copyAnonymized: "Sao chép",
  openRestore: "Khôi phục",
  copied: "Đã sao chép!",
  mappingLabel: "Nhãn",
  mappingOriginal: "Giá trị",
  outputEmpty: "Văn bản đã ẩn danh sẽ hiện ở đây…",
  restoreHeading: "Phản hồi LLM",
  restorePlaceholder: "Dán phản hồi LLM chứa các nhãn như <{label}> …",
  restoreOutputEmpty: "Văn bản đã khôi phục sẽ hiện ở đây…",
  deanonymize: "Khôi phục",
  copyRestored: "Sao chép",
  restoreHint:
    "Phát hiện mang tính tốt nhất có thể — luôn xem lại văn bản đã ẩn danh trước khi gửi đi.",
  unresolvedLabels: "Chưa giải:",
  pageTitle: "Prompt Anonymizer — kiểm tra PII trước khi đến LLM",
  pageDescription:
    "Kiểm tra PII trước khi đến LLM: phát hiện thông tin cá nhân bạn không định gửi, với nhãn đảo ngược nhất quán. Chạy 100% trong trình duyệt (WebGPU / WASM) — văn bản không rời thiết bị.",
  errorPrefix: "Lỗi:",
};

const ZH: UiCatalog = {
  auto: "自动检测",
  valuePitch: "在浏览器内遮蔽个人信息，不外传，并可还原",
  tagLocal: "保留本地",
  privacyLead: "粘贴到 LLM 之前再检查一遍。",
  privacyBody: "100% 本地处理——检测在浏览器中通过 WebGPU/WASM 运行，文本不会发送到任何服务器。",
  language: "语言",
  nerModel: "姓名与地点",
  splitNames: "拆分姓名（姓/名）",
  loadSample: "加载示例",
  anonymize: "浏览器内匿名化（无外部服务器）",
  anonymizeShort: "浏览器内匿名化",
  anonymizeHint: "无外部服务器",
  working: "处理中…",
  nerOffWarning: "姓名未遮蔽",
  flowOriginal: "原文",
  flowAnonymized: "已遮蔽",
  flowRestore: "还原",
  loadingModel: "正在加载模型…",
  downloadingModel: "正在下载模型:",
  originalHeading: "原文",
  inputPlaceholder: "粘贴你准备发送给 LLM 的文本…",
  anonymizedHeading: "已遮蔽",
  copyAnonymized: "复制",
  openRestore: "去还原",
  copied: "已复制！",
  mappingLabel: "标签",
  mappingOriginal: "原值",
  outputEmpty: "匿名文本将显示在这里…",
  restoreHeading: "LLM 回复",
  restorePlaceholder: "粘贴包含 <{label}> 等标签的 LLM 回复…",
  restoreOutputEmpty: "还原文本将显示在这里…",
  deanonymize: "还原",
  copyRestored: "复制",
  restoreHint: "检测为尽力而为——发送前请务必检查匿名化结果。",
  unresolvedLabels: "未解析:",
  pageTitle: "Prompt Anonymizer — 发送到 LLM 前的 PII 检查",
  pageDescription:
    "发送到 LLM 前的 PII 检查：用一致且可逆的标签替换你无意发送的个人信息。100% 在浏览器中运行（WebGPU / WASM）——文本不会离开你的设备。",
  errorPrefix: "错误:",
};

const KO: UiCatalog = {
  auto: "자동 감지",
  valuePitch: "브라우저에서 개인정보를 마스킹하고 외부로 보내지 않으며 복원 가능",
  tagLocal: "로컬 보관",
  privacyLead: "LLM에 붙여넣기 전에 한 번 더 확인하세요.",
  privacyBody:
    "100% 기기 내에서 처리됩니다. 감지는 브라우저의 WebGPU/WASM으로 실행되며, 텍스트는 어떤 서버에도 전송되지 않습니다.",
  language: "언어",
  nerModel: "이름·장소",
  splitNames: "이름 분리(성/이름)",
  loadSample: "샘플 불러오기",
  anonymize: "브라우저에서 익명화 (외부 전송 없음)",
  anonymizeShort: "브라우저에서 익명화",
  anonymizeHint: "외부 전송 없음",
  working: "처리 중…",
  nerOffWarning:
    "NER 모델이 꺼져 있어 이름과 위치는 마스킹되지 않습니다(이메일, 전화번호 등만 처리).",
  flowOriginal: "원문",
  flowAnonymized: "마스킹됨",
  flowRestore: "복원",
  loadingModel: "모델 로드 중…",
  downloadingModel: "모델 다운로드 중:",
  originalHeading: "원문",
  inputPlaceholder: "LLM에 보내려던 텍스트를 붙여넣으세요…",
  anonymizedHeading: "마스킹됨",
  copyAnonymized: "복사",
  openRestore: "복원",
  copied: "복사됨!",
  mappingLabel: "레이블",
  mappingOriginal: "실값",
  outputEmpty: "익명화된 텍스트가 여기에 표시됩니다…",
  restoreHeading: "LLM 응답",
  restorePlaceholder: "<{label}> 같은 레이블이 포함된 LLM 응답을 붙여넣으세요…",
  restoreOutputEmpty: "복원된 텍스트가 여기에 표시됩니다…",
  deanonymize: "복원",
  copyRestored: "복사",
  restoreHint: "감지는 최선을 다하는 방식입니다. 전송 전에 익명화 결과를 반드시 확인하세요.",
  unresolvedLabels: "미해결:",
  pageTitle: "Prompt Anonymizer — LLM에 도달하기 전 PII 점검",
  pageDescription:
    "LLM에 도달하기 전 PII 점검: 보내지 않으려던 개인정보를 일관된 가역 레이블로 바꿉니다. 브라우저에서 100% 실행(WebGPU / WASM)되며 텍스트는 기기를 떠나지 않습니다.",
  errorPrefix: "오류:",
};

const FR: UiCatalog = {
  auto: "Auto",
  valuePitch:
    "Masque les données personnelles dans le navigateur, sans envoi externe, avec restauration",
  tagLocal: "Reste local",
  privacyLead: "Une seconde vérification avant de coller dans un LLM.",
  privacyBody:
    "100 % sur l’appareil — la détection s’exécute dans votre navigateur via WebGPU/WASM ; votre texte n’est jamais envoyé à un serveur.",
  language: "Langue",
  nerModel: "Noms & lieux",
  splitNames: "Séparer le nom (Prénom/Nom)",
  loadSample: "Charger un exemple",
  anonymize: "Anonymiser dans le navigateur (pas de serveur)",
  anonymizeShort: "Anonymiser dans le navigateur",
  anonymizeHint: "Aucun envoi serveur",
  working: "Traitement…",
  nerOffWarning:
    "Le modèle NER est désactivé : les noms et lieux ne seront PAS masqués (uniquement e-mails, téléphones, etc.).",
  flowOriginal: "Original",
  flowAnonymized: "Masqué",
  flowRestore: "Restaurer",
  loadingModel: "Chargement du modèle…",
  downloadingModel: "Téléchargement du modèle :",
  originalHeading: "Votre texte",
  inputPlaceholder: "Collez le texte que vous alliez envoyer à un LLM…",
  anonymizedHeading: "Masqué",
  copyAnonymized: "Copier",
  openRestore: "Restaurer",
  copied: "Copié !",
  mappingLabel: "Libellé",
  mappingOriginal: "Valeur",
  outputEmpty: "Le texte anonymisé apparaîtra ici…",
  restoreHeading: "Réponse LLM",
  restorePlaceholder: "Collez la réponse du LLM contenant des libellés comme <{label}> …",
  restoreOutputEmpty: "Le texte restauré apparaîtra ici…",
  deanonymize: "Restaurer",
  copyRestored: "Copier",
  restoreHint:
    "La détection est au mieux de ses capacités — vérifiez toujours le texte anonymisé avant de l’envoyer.",
  unresolvedLabels: "Non résolus:",
  pageTitle: "Prompt Anonymizer — une vérification PII avant d’atteindre un LLM",
  pageDescription:
    "Une vérification PII avant d’atteindre un LLM : intercepte les infos personnelles que vous n’aviez pas l’intention d’envoyer, avec des libellés cohérents et réversibles. S’exécute à 100 % dans votre navigateur (WebGPU / WASM) — votre texte ne quitte jamais votre appareil.",
  errorPrefix: "Erreur :",
};

const DE: UiCatalog = {
  auto: "Auto",
  valuePitch:
    "Maskiert personenbezogene Daten im Browser, ohne externe Übertragung, mit Wiederherstellung",
  tagLocal: "Bleibt lokal",
  privacyLead: "Ein zweiter Blick, bevor Sie in ein LLM einfügen.",
  privacyBody:
    "100 % auf dem Gerät — die Erkennung läuft in Ihrem Browser über WebGPU/WASM; Ihr Text wird nie an einen Server gesendet.",
  language: "Sprache",
  nerModel: "Namen & Orte",
  splitNames: "Name teilen (Vor-/Nachname)",
  loadSample: "Beispiel laden",
  anonymize: "Im Browser anonymisieren (kein Server)",
  anonymizeShort: "Im Browser anonymisieren",
  anonymizeHint: "Kein Server-Upload",
  working: "Arbeitet…",
  nerOffWarning:
    "NER-Modell ist aus: Namen und Orte werden NICHT maskiert (nur E-Mails, Telefonnummern usw.).",
  flowOriginal: "Original",
  flowAnonymized: "Maskiert",
  flowRestore: "Wiederherst.",
  loadingModel: "Modell wird geladen…",
  downloadingModel: "Modell wird heruntergeladen:",
  originalHeading: "Ihr Text",
  inputPlaceholder: "Fügen Sie den Text ein, den Sie an ein LLM senden wollten…",
  anonymizedHeading: "Maskiert",
  copyAnonymized: "Kopieren",
  openRestore: "Wiederherst.",
  copied: "Kopiert!",
  mappingLabel: "Label",
  mappingOriginal: "Wert",
  outputEmpty: "Anonymisierter Text erscheint hier…",
  restoreHeading: "LLM-Antwort",
  restorePlaceholder: "Fügen Sie die LLM-Antwort mit Labels wie <{label}> ein …",
  restoreOutputEmpty: "Wiederhergestellter Text erscheint hier…",
  deanonymize: "Wiederherst.",
  copyRestored: "Kopieren",
  restoreHint:
    "Die Erkennung ist bestmöglich — prüfen Sie den anonymisierten Text immer vor dem Senden.",
  unresolvedLabels: "Ungelöst:",
  pageTitle: "Prompt Anonymizer — ein PII-Check, bevor es ein LLM erreicht",
  pageDescription:
    "Ein PII-Check, bevor es ein LLM erreicht: fängt persönliche Daten ab, die Sie nicht senden wollten, mit konsistenten umkehrbaren Labels. Läuft zu 100 % in Ihrem Browser (WebGPU / WASM) — Ihr Text verlässt Ihr Gerät nie.",
  errorPrefix: "Fehler:",
};

const PT: UiCatalog = {
  auto: "Automático",
  valuePitch: "Mascara dados pessoais no browser sem enviar para fora, com restauração",
  tagLocal: "Fica local",
  privacyLead: "Uma segunda verificação antes de colar num LLM.",
  privacyBody:
    "100% no dispositivo — a deteção corre no seu browser via WebGPU/WASM; o seu texto nunca é enviado para nenhum servidor.",
  language: "Idioma",
  nerModel: "Nomes e locais",
  splitNames: "Separar nome (Nome/Sobrenome)",
  loadSample: "Carregar exemplo",
  anonymize: "Anonimizar no browser (sem servidor)",
  anonymizeShort: "Anonimizar no browser",
  anonymizeHint: "Sem envio para servidor",
  working: "A processar…",
  nerOffWarning:
    "O modelo NER está desligado: nomes e locais NÃO serão mascarados (apenas e-mails, telefones, etc.).",
  flowOriginal: "Original",
  flowAnonymized: "Mascarado",
  flowRestore: "Restaurar",
  loadingModel: "A carregar modelo…",
  downloadingModel: "A descarregar modelo:",
  originalHeading: "Seu texto",
  inputPlaceholder: "Cole o texto que ia enviar a um LLM…",
  anonymizedHeading: "Mascarado",
  copyAnonymized: "Copiar",
  openRestore: "Restaurar",
  copied: "Copiado!",
  mappingLabel: "Etiqueta",
  mappingOriginal: "Valor",
  outputEmpty: "O texto anonimizado aparecerá aqui…",
  restoreHeading: "Resposta LLM",
  restorePlaceholder: "Cole a resposta do LLM com etiquetas como <{label}> …",
  restoreOutputEmpty: "O texto restaurado aparecerá aqui…",
  deanonymize: "Restaurar",
  copyRestored: "Copiar",
  restoreHint:
    "A deteção é de melhor esforço — reveja sempre o texto anonimizado antes de o enviar.",
  unresolvedLabels: "Por resolver:",
  pageTitle: "Prompt Anonymizer — uma verificação de PII antes de chegar a um LLM",
  pageDescription:
    "Uma verificação de PII antes de chegar a um LLM: captura a informação pessoal que não queria enviar, com etiquetas reversíveis consistentes. Corre 100% no seu browser (WebGPU / WASM) — o seu texto nunca sai do dispositivo.",
  errorPrefix: "Erro:",
};

const IT: UiCatalog = {
  auto: "Automatico",
  valuePitch:
    "Maschera i dati personali nel browser senza inviarli all'esterno, con ripristino",
  tagLocal: "Resta locale",
  privacyLead: "Un doppio controllo prima di incollare in un LLM.",
  privacyBody:
    "100% sul dispositivo — il rilevamento gira nel browser via WebGPU/WASM; il testo non viene mai inviato ad alcun server.",
  language: "Lingua",
  nerModel: "Nomi e luoghi",
  splitNames: "Dividi nome (Nome/Cognome)",
  loadSample: "Carica esempio",
  anonymize: "Anonimizza nel browser (nessun server)",
  anonymizeShort: "Anonimizza nel browser",
  anonymizeHint: "Nessun invio esterno",
  working: "Elaborazione…",
  nerOffWarning:
    "Il modello NER è disattivato: nomi e luoghi NON verranno mascherati (solo e-mail, telefoni, ecc.).",
  flowOriginal: "Originale",
  flowAnonymized: "Mascherato",
  flowRestore: "Ripristina",
  loadingModel: "Caricamento modello…",
  downloadingModel: "Download modello:",
  originalHeading: "Il tuo testo",
  inputPlaceholder: "Incolla il testo che stavi per inviare a un LLM…",
  anonymizedHeading: "Mascherato",
  copyAnonymized: "Copia",
  openRestore: "Ripristina",
  copied: "Copiato!",
  mappingLabel: "Etichetta",
  mappingOriginal: "Valore",
  outputEmpty: "Il testo anonimizzato apparirà qui…",
  restoreHeading: "Risposta LLM",
  restorePlaceholder: "Incolla la risposta dell'LLM con etichette come <{label}> …",
  restoreOutputEmpty: "Il testo ripristinato apparirà qui…",
  deanonymize: "Ripristina",
  copyRestored: "Copia",
  restoreHint:
    "Il rilevamento è best-effort — controlla sempre il testo anonimizzato prima di inviarlo.",
  unresolvedLabels: "Non risolti:",
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

/** Visual before/after sample for the hero demo chip (locale-appropriate). */
export function demoTransformFor(lang: Language): { pii: string; label: string } {
  const pii: Record<Language, string> = {
    en: "John Smith",
    ja: "山田太郎",
    es: "María García",
    vi: "Nguyễn Văn An",
    zh: "王小明",
    ko: "김민준",
    fr: "Jean Dupont",
    de: "Max Mustermann",
    pt: "João Silva",
    it: "Marco Rossi",
  };
  return { pii: pii[lang], label: `<${LABELS[lang].PERSON}_1>` };
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
