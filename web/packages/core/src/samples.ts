import type { Language } from "./types.js";

/**
 * UI sample paragraphs for the web app and proxy admin.
 * One distinct scenario per language — keep phone numbers aligned with each
 * language's recognizer patterns in `languages.py` / `recognizers.ts`.
 */
export const SAMPLES: Record<Language, string> = {
  ja: "来週から新プロジェクトに配属される山田太郎さんの業務引き継ぎをお願いします。前任担当の佐藤花子さんに手順と未完了タスクを確認したいです。山田太郎さんは東京都中央区在住で、緊急連絡は 090-1234-5678 または taro.yamada@example.com へ。佐藤花子さんへの確認は hanako.sato@example.com までお願いします。移行期限は来月末です。",
  en: "We need to onboard vendor John Smith before the compliance audit next month. Emily Johnson from procurement will coordinate the paperwork and data-room access. John Smith is based in New York — reach him at john@example.com or (333) 333-3333. Loop in Emily Johnson at emily.johnson@example.com for contract amendments and the NDA timeline.",
  es: "Hay un error en el itinerario de María García para el congreso en Madrid. Su colega Carlos Ruiz puede confirmar vuelos y alojamiento. María García reside en Madrid; su correo es maria.garcia@example.com y su móvil es +34 612 345 678. Escriba también a Carlos Ruiz en carlos.ruiz@example.com para cerrar horarios con el ponente invitado.",
  vi: "Khách hàng Nguyễn Văn An báo lỗi bảo hành máy lạnh đã mua tại Hà Nội. Trần Thị Mai từ bộ phận hỗ trợ sẽ điều phối kỹ thuật viên. Liên hệ Nguyễn Văn An qua an.nguyen@example.com hoặc 0912 345 678. Gửi lịch hẹn sửa chữa cho Trần Thị Mai tại mai.tran@example.com trước ngày mai.",
  zh: "承建商王小明尚未收到上月工程款，李美玲需要起草催款函。王小明公司在北京市朝阳区注册，对账联系 xiaoming.wang@example.com，电话 138-1234-5678。抄送项目经理李美玲 meiling.li@example.com，请在本周五前回复付款计划。",
  ko: "김민준 학생의 올해 가을 입학 서류 제출 기한을 확인해 주세요. 입학 담당 이서연과 면접 일정을 조율해야 합니다. 김민준은 서울특별시 강남구에 거주하며, 연락은 minjun.kim@example.com 또는 010-1234-5678로 부탁드립니다. 이서연에게는 seoyeon.lee@example.com으로 서류 목록을 공유해 주세요.",
  fr: "Pourriez-vous modifier la réservation de Jean Dupont au restaurant près de Paris ? Marie Martin gère la liste des invités et les allergies. Jean Dupont est joignable au 06 12 34 56 78 ou jean.dupont@example.com. Transmettez le menu adapté à Marie Martin via marie.martin@example.com avant jeudi.",
  de: "Bitte verfassen Sie ein Follow-up zur Schadensmeldung von Max Mustermann (Wasserschaden). Anna Schmidt aus der Versicherungsabteilung benötigt Fotos und die Schadensnummer. Max Mustermann wohnt in Berlin; Tel. 0151 23456789, E-Mail max.mustermann@example.com. Kopie an Anna Schmidt: anna.schmidt@example.com — Frist: 15. März.",
  pt: "Solicito agendamento de visita ao imóvel para João Silva em São Paulo. Ana Costa do corretor enviará as chaves e a planta. Fale com João Silva pelo joao.silva@example.com ou (11) 91234-5678. Confirme horários com Ana Costa em ana.costa@example.com até sexta-feira.",
  it: "Marco Rossi non riesce a trasferire i biglietti del concerto a Milano. La collega Giulia Bianchi deve redigere l'email al servizio clienti. Contattare Marco Rossi a marco.rossi@example.com o al 333 123 4567. Inoltrare la risposta a Giulia Bianchi su giulia.bianchi@example.com entro stasera.",
};
