/** Public configuration and types only. Recipient details must stay in private APIs. */
export const SBP_BANKS = [
  { id: "sber", name: "Sberbank" },
  { id: "tbank", name: "T-Bank" },
  { id: "alfa", name: "Alfa-Bank" },
  { id: "ozon", name: "Ozon Bank" },
  { id: "vtb", name: "VTB" },
  { id: "gazprom", name: "Gazprombank" },
  { id: "raiffeisen", name: "Raiffeisenbank" },
  { id: "sovcom", name: "Sovcombank" },
  { id: "psb", name: "PSB" },
  { id: "akbars", name: "Ak Bars Bank" },
  { id: "yandex", name: "Yandex Bank" },
  { id: "mts", name: "MTS Bank" },
] as const;

export type SbpBankId = (typeof SBP_BANKS)[number]["id"];
export const SBP_LINK_GUIDES: Partial<Record<SbpBankId, { url: string; label: string; placeholder: string }>> = {
  alfa: {
    url: "https://alfabank.servicecdn.ru/site-upload/57/33/2365/dogovor_sbp-qr-code-6032026.pdf",
    label: "Alfa-Bank personal SBP collection",
    placeholder: "https://web.alfabank.ru/public/mrv2/…",
  },
  tbank: {
    url: "https://www.tbank.ru/bank/help/debit-cards/tinkoff-black/additional-options/request-and-collect/",
    label: "T-Bank personal collection",
    placeholder: "https://www.tbank.ru/collectmoney/crowd/…/…/",
  },
};
export type SbpBank = { bankId: SbpBankId; transferUrl: string | null };
export type SbpSettings = { enabled: boolean; phone: string | null; banks: SbpBank[] };
export type SbpAvailability =
  | { available: false }
  | { available: true; banks: { bankId: SbpBankId; hasLink: boolean }[] };
export type SbpTransferDetails = { bankId: SbpBankId; phone: string; transferUrl: string | null };

export const EMPTY_SBP_SETTINGS: SbpSettings = { enabled: false, phone: null, banks: [] };

export function isSbpBankId(value: unknown): value is SbpBankId {
  return SBP_BANKS.some((bank) => bank.id === value);
}

export function sbpBankName(id: SbpBankId) {
  return SBP_BANKS.find((bank) => bank.id === id)?.name ?? id;
}

export function canReceiveSbp(settings: SbpSettings) {
  return settings.enabled && /^\+7[0-9]{10}$/.test(settings.phone ?? "") && settings.banks.length > 0;
}

/** Normalize pasting a Russian-format number into the fixed +7 prefix field. */
export function sbpPhoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  return ((digits.length === 11 && /^[78]/.test(digits)) ? digits.slice(1) : digits).slice(0, 10);
}
