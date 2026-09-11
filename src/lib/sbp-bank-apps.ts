import type { SbpBankId } from "./sbp";

type SendingBankGuide = {
  kind: "transfer" | "app" | "online" | "app-options" | "instructions";
  openUrl: string;
  helpUrl: string;
  navigation: string;
  note: string;
};

const ONLINE_NOTE = "Opens the bank’s official website in a new tab. You can also open your installed banking app manually. This is a web-bank fallback, not a native-app shortcut; recipient details are not prefilled.";

/**
 * Bank-published links reviewed 2026-09-11; evidence in docs/sbp-bank-apps.md.
 * These are sender entry points, NOT recipient payment links. Never interpolate
 * a phone, amount, bank ID or collection URL into them. No guessed app schemes.
 */
export const SBP_SENDING_BANK_GUIDES: Record<SbpBankId, SendingBankGuide> = {
  sber: {
    kind: "online",
    openUrl: "https://online.sberbank.ru/CSAFront/index.do",
    helpUrl: "https://sbp.nspk.ru/participants/5b8100bf-e723-4d12-a49b-58651ea3ce18",
    navigation: "Платежи → СБП → номер телефона → банк получателя",
    note: ONLINE_NOTE,
  },
  tbank: {
    kind: "transfer",
    openUrl: "https://l.tbank.ru/help_transfers_by_phone",
    helpUrl: "https://www.tbank.ru/bank/help/payments/transfers/russia/phone/",
    navigation: "Платежи → Переводы по телефону",
    note: "Uses T-Bank’s published phone-transfer link. The bank may open its app or show its app page, depending on your device. Paste the phone number yourself; no payment is created by this button.",
  },
  alfa: {
    kind: "online",
    openUrl: "https://web.alfabank.ru/",
    helpUrl: "https://alfabank.ru/everyday/payments-and-transfers/transfers-by-phone-number/",
    navigation: "Платежи → перевод по номеру телефона → другой банк / СБП",
    note: ONLINE_NOTE,
  },
  ozon: {
    kind: "online",
    openUrl: "https://finance.ozon.ru/",
    helpUrl: "https://finance.ozon.ru/promo/app",
    navigation: "Платежи → Перевод по телефону → банк получателя",
    note: ONLINE_NOTE,
  },
  vtb: {
    kind: "online",
    openUrl: "https://online.vtb.ru/",
    helpUrl: "https://www.vtb.ru/personal/online-servisy/perevody-sbp/",
    navigation: "Платежи → По номеру телефона или карты → банк получателя",
    note: ONLINE_NOTE,
  },
  gazprom: {
    kind: "online",
    openUrl: "https://ib.online.gpb.ru/",
    helpUrl: "https://www.gazprombank.ru/personal/page/sbp/",
    navigation: "Переводы → По номеру телефона, карты или счёта → По номеру телефона → СБП",
    note: ONLINE_NOTE,
  },
  raiffeisen: {
    kind: "online",
    openUrl: "https://online.raiffeisen.ru/",
    helpUrl: "https://www.raiffeisen.ru/retail/remote_service/information-centr/knowledgebase/konsultaciya_po_onlajn-banku/",
    navigation: "Перевод по номеру телефона / СБП → банк получателя. If needed: Профиль → Настройки → Настройки СБП.",
    note: ONLINE_NOTE,
  },
  sovcom: {
    kind: "online",
    openUrl: "https://online.sovcombank.ru/",
    helpUrl: "https://sovcombank.ru/apply/sbp/perevody-po-karte/",
    navigation: "Халва: Платежи → по номеру телефона → В другой банк (СБП)",
    note: ONLINE_NOTE,
  },
  psb: {
    kind: "app-options",
    openUrl: "https://www.psbank.ru/personal/remote/inner_apps",
    helpUrl: "https://www.psbank.ru/articles/chto-takoe-sbp",
    navigation: "Перевод по номеру телефона / СБП → банк получателя",
    note: "Opens PSB’s official app options for Android and its iPhone web-bank instructions. Choose the option for your device, or open your installed app. This is not a direct transfer shortcut.",
  },
  akbars: {
    kind: "online",
    openUrl: "https://online.akbars.ru/",
    helpUrl: "https://life.akbars.ru/personal-finance/ekonomim/sistema-bystrykh-platezhey/",
    navigation: "Платежи → В другие банки через СБП → Перевод по номеру телефона",
    note: ONLINE_NOTE,
  },
  yandex: {
    kind: "online",
    openUrl: "https://bank.yandex.ru/",
    helpUrl: "https://yandex.ru/support/pay-card/ru/operations/transfers",
    navigation: "Карта → Перевести → номер телефона → банк получателя",
    note: "Opens the official Yandex Pay web bank. Its documented web flow supports phone-number transfers. Paste the number and choose the recipient’s bank; nothing is prefilled or sent automatically.",
  },
  mts: {
    kind: "instructions",
    openUrl: "https://www.mtsbank.ru/chastnim-licam/vse-servici/perevody-po-nomeru/",
    helpUrl: "https://www.mtsbank.ru/chastnim-licam/vse-servici/perevody-po-nomeru/",
    navigation: "Платежи → Переводы → По номеру телефона",
    note: "Opens MTS Bank’s official phone-transfer guide, including its app options. A current direct app-opening shortcut is not documented. Open your installed app to make the transfer.",
  },
};
