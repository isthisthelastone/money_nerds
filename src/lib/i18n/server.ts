import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { browserLocale, COUNTRY_COOKIE, isLegalCountry, isLocale, LOCALE_COOKIE, localeFromCountry, localeFromTag, makeTranslator, type LegalCountry, type Locale } from "./config";
import { getMessages } from "./messages";

/** Request-scoped only: never share an authenticated visitor's settings in the Next data cache. */
export const getRequestPreferences = cache(async () => {
  const [cookieStore, requestHeaders, session] = await Promise.all([cookies(), headers(), auth()]);
  let savedLocale: Locale | null = null;
  let savedCountry: LegalCountry | null = null;
  if (session.userId) {
    const db = createAdminSupabase();
    const { data: link } = await db.rpc("get_clerk_profile", { p_clerk_user_id: session.userId });
    if (link && typeof link.profile_wallet === "string" && !link.deleted) {
      const { data } = await db.from("profile_preferences").select("locale, legal_country").eq("wallet_address", link.profile_wallet).maybeSingle();
      if (isLocale(data?.locale)) savedLocale = data.locale;
      if (isLegalCountry(data?.legal_country)) savedCountry = data.legal_country;
    }
  }
  const metadata = session.sessionClaims?.metadata;
  let metadataLocale = metadata && typeof metadata === "object" && "locale" in metadata ? localeFromTag(metadata.locale) : null;
  const explicitLocale = requestHeaders.get("x-mn-ui-locale");
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (session.userId && !savedLocale && !isLocale(cookieLocale) && !isLocale(explicitLocale) && !metadataLocale) {
    try {
      const user = await (await clerkClient()).users.getUser(session.userId);
      // Preferences may be user-editable; they are never used for authorization.
      metadataLocale = localeFromTag(user.publicMetadata.locale ?? user.unsafeMetadata.locale ?? user.unsafeMetadata.language);
    } catch { /* A metadata-provider outage must not stop public rendering. */ }
  }
  const cookieCountry = cookieStore.get(COUNTRY_COOKIE)?.value;
  const countryHint = process.env.VERCEL === "1" ? requestHeaders.get("x-vercel-ip-country") : null;
  const locale = isLocale(explicitLocale) ? explicitLocale : isLocale(cookieLocale) ? cookieLocale : savedLocale ?? metadataLocale ?? browserLocale(requestHeaders.get("accept-language")) ?? localeFromCountry(countryHint);
  const country = isLegalCountry(cookieCountry) ? cookieCountry : savedCountry ?? (isLegalCountry(countryHint) ? countryHint : "GLOBAL");
  return { locale, country, countryHint: isLegalCountry(countryHint) ? countryHint : null };
});

export async function getTranslator() {
  return makeTranslator(getMessages((await getRequestPreferences()).locale));
}
