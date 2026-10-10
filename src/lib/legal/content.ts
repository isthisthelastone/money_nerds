export const LEGAL_CONTACT = "contact@moneynerds.online";
// Publish email actions only after the provider's receiving setup is verified.
export const CONTACT_EMAIL_READY = process.env.NEXT_PUBLIC_CONTACT_EMAIL_READY === "true";
export const LEGAL_UPDATED = "2026-10-10";

export const legalDocuments = {
  terms: {
    title: "Terms of use",
    sections: [
      ["The service", "Money Nerds is a public board for requests and voluntary direct support. It does not hold your funds, charge a platform commission, certify a story or promise a result. Your wallet, bank or network may charge fees."],
      ["Your responsibility", "Use the service lawfully. Publish only accurate information and content you have the right to share. Do not impersonate others, scam, threaten, harass, publish private information, exploit children or share intimate imagery without consent. Do not request unlawful transfers or offer investments, guaranteed returns or payment for illegal goods."],
      ["Age and sensitive information", "Account and funding features are intended for adults aged 18 or older. Do not publish children's personal information or another person's health, identity or financial records. A person receiving support must be entitled to use the selected wallet or bank account."],
      ["Publishing and moderation", "You keep your rights in your content and permit Money Nerds to store, display and distribute it as needed to operate the public board. Public posts, comments and media may be copied or indexed by others. Content or access may be restricted for unlawful activity, abuse or security reasons. Use the reporting contact to ask for an explanation or challenge a decision."],
      ["Direct transfers", "Support is voluntary and is not a purchase, loan or investment through Money Nerds. Check the recipient, amount, asset and network before approving. Crypto transfers may be irreversible. Money Nerds cannot reverse a transfer or guarantee a refund, tax deduction, recipient identity or use of funds. Contact your bank or wallet provider about a transfer problem."],
      ["Mandatory rights", "These rules do not exclude rights or liability that applicable law does not allow to be excluded. Choosing a language or country does not change your legal rights, establish residence or select a governing law. No arbitration requirement or waiver of collective remedies is imposed here."],
    ],
  },
  privacy: {
    title: "Privacy notice",
    sections: [
      ["Contact and notice status", "Contact Money Nerds using the email below. The operator's legal identity, address, applicable representative and any required privacy officer have not yet been verified for this notice. International transfer safeguards and a complete retention schedule also remain under review. This notice describes the service; it is not a claim that those legal requirements are complete."],
      ["Information and purposes", "Sign-in providers supply account identifiers and profile details. Clerk handles authentication; Telegram is used when you choose Telegram sign-in. Money Nerds links sign-in to a public profile. Posts, comments, reactions, media, receiving addresses and funding records support the public board. Language and country preferences customise the interface; a coarse country hint may be used as a fallback, not proof of residence."],
      ["Public and restricted information", "Profiles, posts, comments, media and linked crypto activity are public. Blockchain records may remain public permanently. Optional SBP details include a phone number and receiving-bank information; eligible signed-in viewers can reveal them when the relevant SBP settings are enabled. Those viewers can copy them. Do not publish identity documents, wallet secrets, medical records or another person's private information."],
      ["Providers and disclosures", "Supabase provides database and media storage; Vercel hosts and delivers the site. Authentication, hosting, email, bank, wallet and blockchain providers process information when their services are used. Technical request and security data may be processed to deliver and protect the service. Reports sent by email include the information you choose to send. Providers and recipients may be in other countries; verified locations and transfer arrangements are not yet published."],
      ["Choice and legal grounds", "Necessary account and security processing supports the service you request. Optional view-count storage requires your choice in privacy settings. Where applicable, processing needs an appropriate legal basis, such as contract, consent, legal obligation or a documented legitimate interest; publishing this notice alone does not establish that basis. Do not treat acceptance of terms as consent to every use of personal data."],
      ["Retention and deletion", "Browser language, country and privacy-choice cookies last up to 180 days; optional view-count cookies also last up to 180 days. Account, post, media, report, security-log and backup retention periods have not yet been fully documented. Request deletion or details using the contact below. Removing site content cannot erase blockchain records or copies held by other people."],
      ["Your requests", "You can ask about access, correction, deletion, a copy of your data, restriction, objection, withdrawal of consent or an appeal, as applicable to your country. Include enough information to find the relevant account or content, but no passwords or identity documents in the first email. Verification may be needed. You can also contact the appropriate regulator. Withdrawing optional storage consent does not remove account data or affect prior lawful processing."],
    ],
  },
  cookies: {
    title: "Cookies and local storage",
    sections: [
      ["Necessary preferences", "mn_locale remembers your interface language, mn_country your selected country and mn_privacy your privacy choice. These first-party cookies last up to 180 days. Selecting a country is optional and independent from language. Signed-in preferences can also be saved to your account."],
      ["Optional view counting", "mn_viewer is a random browser identifier used to reduce duplicate post-view counts. It is set only after optional storage is allowed and lasts up to 180 days. Rejecting or revoking optional storage clears that identifier and stops optional counting. Global Privacy Control is treated as a request for necessary storage only. No advertising or third-party analytics integration is added by this feature."],
      ["Sign-in and recovery", "Clerk and sign-in providers use authentication and security cookies with their own lifetimes. Telegram uses short-lived sign-in transaction storage. A legacy session cookie may remain. A pending donation can be saved in local storage to recover a transfer you initiated; this is separate from optional view counting and is removed by the recovery flow or your browser's storage controls."],
      ["Change your choice", "Use Privacy choices in the footer or settings at any time. Necessary storage remains available when optional storage is rejected. Clearing browser data removes local preferences but does not delete a signed-in account, public posts or blockchain records."],
    ],
  },
} as const;

export type LegalDocumentKey = keyof typeof legalDocuments;
export const legalLinks = [
  { href: "/legal", label: "Legal and privacy" },
  { href: "/legal/terms", label: "Terms of use" },
  { href: "/legal/privacy", label: "Privacy notice" },
  { href: "/legal/cookies", label: "Cookies and local storage" },
  { href: "/legal/regions", label: "Country notices" },
  { href: "/legal/report", label: "Rights and content reports" },
] as const;
