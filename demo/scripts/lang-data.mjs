/**
 * Per-language demo content, shared by record_web.mjs and record_extension.mjs.
 *
 * Label words come from src/prompt_anonymizer/labels/<lang>.yaml (Python)
 * and web/packages/core/src/labels.ts (TS) - they must stay in sync with
 * those files. Phone numbers are chosen to match each language's phone
 * regex in src/prompt_anonymizer/languages.py / web/packages/core/src/recognizers.ts.
 */

export const LANGUAGES = ["en", "ja", "es", "vi", "zh", "ko", "fr", "de", "pt", "it"];

export const LANG_DATA = {
  en: {
    labels: { PERSON: "Name", EMAIL_ADDRESS: "Email", LOCATION: "Location", PHONE_NUMBER: "Phone" },
    web: {
      llmReply:
        "A nice idea: since <Name_1> lives in <Location_1>, a local specialty gift would land " +
        "well - ask <Name_2> to help coordinate. Reach <Name_1> at <Email_1> or <Phone_1>, and " +
        "loop in <Name_2> via <Email_2>.",
    },
    extension: {
      selection: "Thanks for your help. Could you resend the invoice? Reach me at (333) 333-3333 or john.smith@example.com.",
      restore: "Got it, I'll resend it to <Phone_1> (<Email_1>).",
    },
  },
  ja: {
    labels: { PERSON: "人名", EMAIL_ADDRESS: "メールアドレス", LOCATION: "住所", PHONE_NUMBER: "電話番号" },
    web: {
      llmReply:
        "いい案ですね。<人名_1>さんは<住所_1>にお住まいなので、地元の名産品を贈ると喜ばれそうです。" +
        "準備は<人名_2>さんと相談してみてください。<人名_1>さんへは<メールアドレス_1>か<電話番号_1>、" +
        "<人名_2>さんへは<メールアドレス_2>でご連絡できます。",
    },
    extension: {
      selection:
        "お世話になっております。件の請求書を再送します。" +
        "宛先: 〒150-0002 東京都渋谷区、TEL 090-1234-5678、メール taro.yamada@example.com までお願いします。",
      restore: "承知しました。<郵便番号_1> <電話番号_1>（<メールアドレス_1>）宛に再送します。",
    },
  },
  es: {
    labels: { PERSON: "Nombre", EMAIL_ADDRESS: "Correo", LOCATION: "Dirección", PHONE_NUMBER: "Teléfono" },
    web: {
      llmReply:
        "Buena idea: como <Nombre_1> vive en <Dirección_1>, un regalo típico de la zona sería un " +
        "acierto. Puedes coordinarlo con <Nombre_2>. Contacta a <Nombre_1> en <Correo_1> o " +
        "<Teléfono_1>, y a <Nombre_2> en <Correo_2>.",
    },
    extension: {
      selection: "Gracias por su ayuda. ¿Podría reenviar la factura? Puede contactarme al 612 345 678 o en maria.garcia@example.com.",
      restore: "Entendido, lo reenviaré a <Teléfono_1> (<Correo_1>).",
    },
  },
  vi: {
    labels: { PERSON: "Tên", EMAIL_ADDRESS: "Email", LOCATION: "ĐịaChỉ", PHONE_NUMBER: "SốĐiệnThoại" },
    web: {
      llmReply:
        "Ý hay đấy: vì <Tên_1> sống ở <ĐịaChỉ_1>, một món quà đặc sản địa phương sẽ rất hợp. " +
        "Bạn có thể nhờ <Tên_2> giúp chuẩn bị. Liên hệ <Tên_1> qua <Email_1> hoặc <SốĐiệnThoại_1>, " +
        "và <Tên_2> qua <Email_2>.",
    },
    extension: {
      selection: "Cảm ơn bạn đã hỗ trợ. Bạn có thể gửi lại hóa đơn được không? Liên hệ với tôi qua 0912 345 678 hoặc an.nguyen@example.com.",
      restore: "Đã rõ, tôi sẽ gửi lại tới <SốĐiệnThoại_1> (<Email_1>).",
    },
  },
  zh: {
    labels: { PERSON: "姓名", EMAIL_ADDRESS: "电子邮箱", LOCATION: "地址", PHONE_NUMBER: "电话号码" },
    web: {
      llmReply:
        "好主意：既然<姓名_1>住在<地址_1>，送一份当地特产会很合适。可以请<姓名_2>协助安排。" +
        "联系<姓名_1>请发邮件至<电子邮箱_1>或拨打<电话号码_1>，联系<姓名_2>请发邮件至<电子邮箱_2>。",
    },
    extension: {
      selection: "谢谢您的帮助。可以麻烦重新发送一下发票吗？可以通过 138-1234-5678 或 xiaoming.wang@example.com 联系我。",
      restore: "好的，我会重新发送到 <电话号码_1>（<电子邮箱_1>）。",
    },
  },
  ko: {
    labels: { PERSON: "이름", EMAIL_ADDRESS: "이메일", LOCATION: "주소", PHONE_NUMBER: "전화번호" },
    web: {
      llmReply:
        "좋은 생각이에요. <이름_1>님이 <주소_1>에 살고 계시니 그 지역 특산품 선물이 잘 어울릴 것 " +
        "같아요. <이름_2>님과 함께 준비해 보세요. <이름_1>님께는 <이메일_1> 또는 <전화번호_1>로, " +
        "<이름_2>님께는 <이메일_2>로 연락하시면 됩니다.",
    },
    extension: {
      selection: "도와주셔서 감사합니다. 청구서를 다시 보내주실 수 있나요? 010-1234-5678 또는 minjun.kim@example.com으로 연락 주세요.",
      restore: "알겠습니다. <전화번호_1>(<이메일_1>)로 다시 보내드리겠습니다.",
    },
  },
  fr: {
    labels: { PERSON: "Nom", EMAIL_ADDRESS: "Email", LOCATION: "Adresse", PHONE_NUMBER: "Téléphone" },
    web: {
      llmReply:
        "Bonne idée : puisque <Nom_1> habite à <Adresse_1>, un cadeau typique de la région ferait " +
        "plaisir. Vous pouvez vous coordonner avec <Nom_2>. Contactez <Nom_1> à <Email_1> ou au " +
        "<Téléphone_1>, et <Nom_2> à <Email_2>.",
    },
    extension: {
      selection: "Merci pour votre aide. Pourriez-vous renvoyer la facture ? Vous pouvez me joindre au 06 12 34 56 78 ou à jean.dupont@example.com.",
      restore: "Entendu, je la renverrai au <Téléphone_1> (<Email_1>).",
    },
  },
  de: {
    labels: { PERSON: "Name", EMAIL_ADDRESS: "EMail", LOCATION: "Adresse", PHONE_NUMBER: "Telefon" },
    web: {
      llmReply:
        "Gute Idee: Da <Name_1> in <Adresse_1> wohnt, käme ein regionales Geschenk gut an. Sie " +
        "können sich mit <Name_2> abstimmen. Erreichen Sie <Name_1> unter <EMail_1> oder " +
        "<Telefon_1>, und <Name_2> unter <EMail_2>.",
    },
    extension: {
      selection: "Danke für Ihre Hilfe. Könnten Sie die Rechnung erneut senden? Sie erreichen mich unter 0151 23456789 oder max.mustermann@example.com.",
      restore: "Verstanden, ich sende sie erneut an <Telefon_1> (<EMail_1>).",
    },
  },
  pt: {
    labels: { PERSON: "Nome", EMAIL_ADDRESS: "Email", LOCATION: "Endereço", PHONE_NUMBER: "Telefone" },
    web: {
      llmReply:
        "Boa ideia: como <Nome_1> mora em <Endereço_1>, um presente típico da região seria bem-" +
        "vindo. Você pode combinar com <Nome_2>. Fale com <Nome_1> pelo <Email_1> ou <Telefone_1>, " +
        "e com <Nome_2> pelo <Email_2>.",
    },
    extension: {
      selection: "Obrigado pela ajuda. Poderia reenviar a fatura? Pode me contatar pelo 912 345 678 ou joao.silva@example.com.",
      restore: "Entendido, vou reenviar para <Telefone_1> (<Email_1>).",
    },
  },
  it: {
    labels: { PERSON: "Nome", EMAIL_ADDRESS: "Email", LOCATION: "Indirizzo", PHONE_NUMBER: "Telefono" },
    web: {
      llmReply:
        "Buona idea: dato che <Nome_1> vive a <Indirizzo_1>, un regalo tipico del posto farebbe " +
        "piacere. Puoi organizzarti con <Nome_2>. Contatta <Nome_1> a <Email_1> o al <Telefono_1>, " +
        "e <Nome_2> a <Email_2>.",
    },
    extension: {
      selection: "Grazie per l'aiuto. Potrebbe reinviare la fattura? Può contattarmi al 333 123 4567 o a marco.rossi@example.com.",
      restore: "Capito, la reinvierò a <Telefono_1> (<Email_1>).",
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
