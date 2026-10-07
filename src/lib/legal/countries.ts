import type { LegalCountry, Locale } from "@/lib/i18n/config";

// Authority names are proper names; country names are localised with Intl.
// Source: https://www.edpb.europa.eu/about-edpb/our-members_en (20 September 2026).
export const privacyAuthorities: Partial<Record<LegalCountry, { name: string; url: string }>> = {
  AT: { name: "Datenschutzbehörde", url: "https://www.dsb.gv.at/" },
  BE: { name: "APD / GBA", url: "https://www.autoriteprotectiondonnees.be/" },
  BG: { name: "Commission for Personal Data Protection", url: "https://www.cpdp.bg/" },
  HR: { name: "AZOP", url: "https://azop.hr/" },
  CY: { name: "Commissioner for Personal Data Protection", url: "https://www.dataprotection.gov.cy/" },
  CZ: { name: "Úřad pro ochranu osobních údajů", url: "https://uoou.gov.cz/" },
  DK: { name: "Datatilsynet", url: "https://www.datatilsynet.dk/" },
  EE: { name: "Andmekaitse Inspektsioon", url: "https://www.aki.ee/" },
  FI: { name: "Tietosuojavaltuutetun toimisto", url: "https://tietosuoja.fi/en/" },
  FR: { name: "CNIL", url: "https://www.cnil.fr/" },
  DE: { name: "BfDI / Länder authorities", url: "https://www.bfdi.bund.de/EN/Service/Anschriften/Laender/Laender-node.html" },
  GR: { name: "Hellenic Data Protection Authority", url: "https://www.dpa.gr/" },
  HU: { name: "NAIH", url: "https://www.naih.hu/" },
  IE: { name: "Data Protection Commission", url: "https://www.dataprotection.ie/" },
  IT: { name: "Garante per la protezione dei dati personali", url: "https://www.garanteprivacy.it/" },
  LV: { name: "Datu valsts inspekcija", url: "https://www.dvi.gov.lv/" },
  LT: { name: "Valstybinė duomenų apsaugos inspekcija", url: "https://vdai.lrv.lt/" },
  LU: { name: "CNPD", url: "https://cnpd.public.lu/" },
  MT: { name: "Information and Data Protection Commissioner", url: "https://idpc.org.mt/" },
  NL: { name: "Autoriteit Persoonsgegevens", url: "https://autoriteitpersoonsgegevens.nl/" },
  PL: { name: "Urząd Ochrony Danych Osobowych", url: "https://uodo.gov.pl/" },
  PT: { name: "CNPD", url: "https://www.cnpd.pt/" },
  RO: { name: "ANSPDCP", url: "https://www.dataprotection.ro/" },
  SK: { name: "Úrad na ochranu osobných údajov", url: "https://dataprotection.gov.sk/" },
  SI: { name: "Informacijski pooblaščenec", url: "https://www.ip-rs.si/" },
  ES: { name: "AEPD", url: "https://www.aepd.es/" },
  SE: { name: "Integritetsskyddsmyndigheten", url: "https://www.imy.se/" },
  US: { name: "FTC", url: "https://reportfraud.ftc.gov/" },
  RU: { name: "Роскомнадзор", url: "https://rkn.gov.ru/" },
  SG: { name: "PDPC Singapore", url: "https://www.pdpc.gov.sg/" },
  MY: { name: "Pesuruhjaya Perlindungan Data Peribadi", url: "https://www.pdp.gov.my/" },
};

export function countryName(country: Exclude<LegalCountry, "GLOBAL">, locale: Locale) {
  return new Intl.DisplayNames([locale], { type: "region" }).of(country) ?? country;
}

export const regionalNotices = {
  EU: "EU privacy rights may include access, correction, erasure, restriction, portability and objection, plus a complaint to a supervisory authority. GDPR scope depends on the processing and territorial connection. Optional storage requires the applicable consent rules. Illegal-content notices can be sent without an account. National consumer, fundraising and payment rules still require separate review; this country selection is not legal clearance.",
  US: "US rights depend on the state, activity and statutory thresholds; there is no single state-privacy rule for everyone. Request access, correction, deletion, an opt-out or an appeal through the reporting contact where applicable. For nonconsensual intimate imagery, the TAKE IT DOWN Act requires covered platforms to remove qualifying content as soon as possible and within 48 hours of a valid request, with reasonable efforts to remove known identical copies. This is a legal requirement, not a verified service-level promise.",
  RU: "Russian personal-data localisation and cross-border requirements need an operator-specific assessment. A Russian-localised collection and storage arrangement has not been verified for this service. Current digital-currency restrictions and the September 2026 legal changes also require review; a voluntary gift, Russian interface or SBP option does not prove the activity is permitted. Do not provide sensitive information on the assumption that local hosting or regulatory approval exists.",
  SG: "Singapore's PDPA may require notification, consent or another permitted basis, access and correction, a designated data-protection contact and safeguards for overseas transfers. Payment Services Act regulation can include facilitating digital-token transfers without holding the tokens. Charitable fundraising appeals may have separate requirements. Money Nerds does not claim a Singapore payment licence or charity registration.",
  MY: "Malaysia's PDPA applies within its statutory scope, including relevant commercial transactions. Its notice-and-choice rules require a privacy notice in Bahasa Malaysia and English; both are available below. Access, correction, withdrawal and other applicable requests can be sent to the contact provided. DPO, breach, transfer and digital-asset requirements need an operator-specific assessment; no registration or authorisation is claimed.",
  GLOBAL: "No supported country is selected. You can read every country notice and correct the selection. An IP-country hint can be wrong because of travel, a VPN or network routing. Your language choice is not a statement about nationality, residence or applicable law.",
} as const;
