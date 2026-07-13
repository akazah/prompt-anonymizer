/**
 * Per-language demo content, shared by record_web.mjs and record_extension.mjs.
 *
 * Label words come from src/prompt_anonymizer/labels/<lang>.yaml (Python)
 * and web/packages/core/src/labels.ts (TS) - they must stay in sync with
 * those files. Phone numbers are chosen to match each language's phone
 * regex in src/prompt_anonymizer/languages.py / web/packages/core/src/recognizers.ts.
 *
 * UI sample paragraphs live in web/packages/core/src/samples.ts (imported by
 * the web app and proxy admin). Each language uses a distinct scenario here
 * too so CLI / extension / browser demos do not all read the same story.
 */

export const LANGUAGES = ["en", "ja", "es", "vi", "zh", "ko", "fr", "de", "pt", "it"];

/**
 * Languages that have `social` content below (SNS video, record_social.mjs).
 * Derived, never hardcoded elsewhere; add a `social` block to a language's
 * LANG_DATA entry to enable it.
 */
export function socialLanguages() {
  return LANGUAGES.filter((lang) => LANG_DATA[lang].social);
}

export const LANG_DATA = {
  en: {
    labels: { PERSON: "Name", EMAIL_ADDRESS: "Email", LOCATION: "Location", PHONE_NUMBER: "Phone" },
    // SNS video content (record_social.mjs / social-video.html). `message`
    // and `reply` are arrays of plain strings and { pii, label } spans; the
    // pii/label pairs flip between each other during the mask/restore scenes.
    social: {
      ui: {
        app: "Prompt Anonymizer",
        langPill: "English",
        anonymize: "Anonymize",
        restore: "Restore",
        replyTag: "LLM reply",
        badge: "On-device · zero network calls",
      },
      hook: {
        lines: ["That name, that email —", "safe to paste into an AI?"],
        sub: "PII slips into prompts more often than you think.",
      },
      message: [
        "Draft a follow-up email to ",
        { pii: "John Smith", label: "<Name_1>" },
        " — he's at ",
        { pii: "john.smith@example.com", label: "<Email_1>" },
        " or ",
        { pii: "(333) 333-3333", label: "<Phone_1>" },
        ".",
      ],
      captions: {
        typed: "3 pieces of PII, about to leave your device",
        masked: "Masked on-device — nothing leaves your browser",
        restored: "Fully reversible — one click brings the real text back",
      },
      reply: [
        "Sure! Here's a draft for ",
        { pii: "John Smith", label: "<Name_1>" },
        ", ready to send to ",
        { pii: "john.smith@example.com", label: "<Email_1>" },
        ".",
      ],
      outro: {
        title: "Prompt Anonymizer",
        tag: "A buddy check for PII before it reaches an LLM.",
        features: "Browser · Extension · Desktop · CLI · Proxy · MCP",
        langs: "10 languages · MIT · open source",
        url: "github.com/akazah/prompt-anonymizer",
      },
    },
    web: {
      llmReply:
        "Understood. I'll coordinate with <Name_2> on the data-room access and send the onboarding " +
        "timeline to <Name_1> at <Email_1> or <Phone_1>. Copy <Email_2> on any contract amendments.",
    },
    extension: {
      selection:
        "Following up on yesterday's call — please send the NDA draft to John Smith in New York. " +
        "Reach me at (333) 333-3333 or john.smith@example.com.",
      restore: "Got it — I'll email the NDA to <Phone_1> (<Email_1>) today.",
    },
  },
  ja: {
    labels: { PERSON: "人名", EMAIL_ADDRESS: "メールアドレス", LOCATION: "住所", PHONE_NUMBER: "電話番号" },
    social: {
      ui: {
        app: "Prompt Anonymizer",
        langPill: "日本語",
        anonymize: "匿名化",
        restore: "復元",
        replyTag: "LLMの返答",
        badge: "端末内で完結 · 外部送信ゼロ",
      },
      hook: {
        lines: ["名前もメールも、", "AIに貼って大丈夫？"],
        sub: "個人情報は、思ったよりプロンプトに紛れ込みます。",
      },
      message: [
        "",
        { pii: "山田太郎", label: "<人名_1>" },
        "さん宛のメールを書いて。連絡先は ",
        { pii: "taro.yamada@example.com", label: "<メールアドレス_1>" },
        " か ",
        { pii: "090-1234-5678", label: "<電話番号_1>" },
        " です。",
      ],
      captions: {
        typed: "個人情報3件が、端末の外へ出る寸前",
        masked: "端末内でマスク — ブラウザの外へは何も出ません",
        restored: "完全に可逆 — ワンクリックで元どおり",
      },
      reply: [
        "承知しました。",
        { pii: "山田太郎", label: "<人名_1>" },
        "さん宛の下書きです。",
        { pii: "taro.yamada@example.com", label: "<メールアドレス_1>" },
        " へ送れます。",
      ],
      outro: {
        title: "Prompt Anonymizer",
        tag: "LLMに渡す前の、PIIバディチェック。",
        features: "ブラウザ · 拡張機能 · デスクトップ · CLI · プロキシ · MCP",
        langs: "10言語対応 · MIT · オープンソース",
        url: "github.com/akazah/prompt-anonymizer",
      },
    },
    web: {
      llmReply:
        "承知しました。<人名_2>さんに引き継ぎ手順を確認し、<人名_1>さんへは<メールアドレス_1>または" +
        "<電話番号_1>で移行スケジュールを送付します。不明点があれば<メールアドレス_2>までご連絡ください。",
    },
    extension: {
      selection:
        "お世話になっております。4月分の請求書の再送をお願いします。" +
        "宛先: 〒150-0002 東京都渋谷区神南1-2-3、TEL 090-1234-5678、メール taro.yamada@example.com までお願いします。",
      restore: "承知しました。<郵便番号_1> <住所_1>宛に再送します。連絡先: <電話番号_1>（<メールアドレス_1>）",
    },
  },
  es: {
    labels: { PERSON: "Nombre", EMAIL_ADDRESS: "Correo", LOCATION: "Dirección", PHONE_NUMBER: "Teléfono" },
    web: {
      llmReply:
        "De acuerdo. Contactaré a <Nombre_2> para confirmar vuelos y enviaré la corrección del " +
        "itinerario a <Nombre_1> en <Correo_1> o al <Teléfono_1>.",
    },
    extension: {
      selection:
        "Buenos días. Necesito reprogramar la cita de María García con cardiología en Madrid " +
        "al 15 de mayo. Llamen al 612 345 678 o escriban a maria.garcia@example.com.",
      restore: "Entendido, confirmaré la nueva cita al <Teléfono_1> (<Correo_1>).",
    },
  },
  vi: {
    labels: { PERSON: "Tên", EMAIL_ADDRESS: "Email", LOCATION: "ĐịaChỉ", PHONE_NUMBER: "SốĐiệnThoại" },
    web: {
      llmReply:
        "Đã hiểu. <Tên_2> sẽ điều phối kỹ thuật viên và gửi lịch hẹn cho <Tên_1> qua <Email_1> " +
        "hoặc <SốĐiệnThoại_1>.",
    },
    extension: {
      selection:
        "Chào bạn, cần đổi lịch bảo hành máy lạnh cho Nguyễn Văn An tại Hà Nội. " +
        "Gọi 0912 345 678 hoặc nhắn an.nguyen@example.com.",
      restore: "Đã rõ, tôi sẽ gọi lại <SốĐiệnThoại_1> và gửi email tới <Email_1>.",
    },
  },
  zh: {
    labels: { PERSON: "姓名", EMAIL_ADDRESS: "电子邮箱", LOCATION: "地址", PHONE_NUMBER: "电话号码" },
    web: {
      llmReply:
        "好的。我们将向<姓名_2>共享对账单，并通过<电子邮箱_1>或<电话号码_1>联系<姓名_1>确认付款安排。",
    },
    extension: {
      selection:
        "请把合同扫描件发给王小明，公司在北京市朝阳区。电话 138-1234-5678，邮箱 xiaoming.wang@example.com。",
      restore: "好的，我会发送到 <电话号码_1>（<电子邮箱_1>）。",
    },
  },
  ko: {
    labels: { PERSON: "이름", EMAIL_ADDRESS: "이메일", LOCATION: "주소", PHONE_NUMBER: "전화번호" },
    web: {
      llmReply:
        "알겠습니다. <이름_2>님과 면접 일정을 조율한 뒤 <이름_1>님께 <이메일_1> 또는 <전화번호_1>로 " +
        "서류 제출 안내를 보내겠습니다.",
    },
    extension: {
      selection:
        "김민준 학생 입학 서류 목록을 보내 주세요. 연락처 010-1234-5678, minjun.kim@example.com.",
      restore: "알겠습니다. <전화번호_1>(<이메일_1>)로 안내드리겠습니다.",
    },
  },
  fr: {
    labels: { PERSON: "Nom", EMAIL_ADDRESS: "Email", LOCATION: "Adresse", PHONE_NUMBER: "Téléphone" },
    web: {
      llmReply:
        "Bien noté. Je transmettrai le menu adapté à <Nom_2> et confirmerai la réservation auprès " +
        "de <Nom_1> au <Téléphone_1> ou à <Email_1>.",
    },
    extension: {
      selection:
        "Merci. Confirmer la réservation de Jean Dupont (Paris) pour samedi soir. " +
        "Joignable au 06 12 34 56 78 ou jean.dupont@example.com.",
      restore: "Entendu, je confirmerai au <Téléphone_1> (<Email_1>).",
    },
  },
  de: {
    labels: { PERSON: "Name", EMAIL_ADDRESS: "EMail", LOCATION: "Adresse", PHONE_NUMBER: "Telefon" },
    web: {
      llmReply:
        "Verstanden. Ich bitte <Name_2> um die Schadensnummer und sende das Follow-up an <Name_1> " +
        "unter <EMail_1> oder <Telefon_1>.",
    },
    extension: {
      selection:
        "Schadensmeldung von Max Mustermann (Berlin) — bitte Fotos anfordern. " +
        "Tel. 0151 23456789, max.mustermann@example.com.",
      restore: "Verstanden, ich melde mich unter <Telefon_1> (<EMail_1>).",
    },
  },
  pt: {
    labels: { PERSON: "Nome", EMAIL_ADDRESS: "Email", LOCATION: "Endereço", PHONE_NUMBER: "Telefone" },
    web: {
      llmReply:
        "Entendido. Vou combinar o horário com <Nome_2> e confirmar a visita com <Nome_1> pelo " +
        "<Telefone_1> ou <Email_1>.",
    },
    extension: {
      selection:
        "Visita ao imóvel para João Silva em São Paulo. Confirmar horário no (11) 91234-5678 " +
        "ou joao.silva@example.com.",
      restore: "Entendido, vou confirmar pelo <Telefone_1> (<Email_1>).",
    },
  },
  it: {
    labels: { PERSON: "Nome", EMAIL_ADDRESS: "Email", LOCATION: "Indirizzo", PHONE_NUMBER: "Telefono" },
    web: {
      llmReply:
        "Capito. Inoltro la richiesta al servizio clienti e aggiorno <Nome_2>; contatterò <Nome_1> " +
        "a <Telefono_1> o <Email_1>.",
    },
    extension: {
      selection:
        "Trasferimento biglietti concerto — Marco Rossi, Milano. " +
        "Tel. 333 123 4567, marco.rossi@example.com.",
      restore: "Capito, la contatterò al <Telefono_1> (<Email_1>).",
    },
  },
};

export function langData(lang) {
  const data = LANG_DATA[lang];
  if (!data) throw new Error(`Unknown --lang "${lang}". Expected one of: ${LANGUAGES.join(", ")}`);
  return data;
}

export function parseLangArg(argv, fallback = "en") {
  const arg = argv.find((a) => a.startsWith("--lang="));
  return arg ? arg.slice("--lang=".length) : fallback;
}
