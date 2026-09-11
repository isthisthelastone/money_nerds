import "server-only";

import { NextResponse } from "next/server";
import { RequestBodyError } from "@/lib/http";
import { EMPTY_SBP_SETTINGS, isSbpBankId, type SbpSettings } from "@/lib/sbp";
import { createAdminSupabase } from "@/lib/supabase/admin";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Vary": "Cookie, Authorization",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export function sbpResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: PRIVATE_HEADERS });
}

export function isSameOriginSbpRequest(request: Request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin && request.headers.get("sec-fetch-site") !== "cross-site";
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Check your SBP settings.");
  }
  return value as Record<string, unknown>;
}

/** No network fetch: bank-owned collection pages are opened by the donor only. */
export function validateSbpTransferUrl(bankId: string, value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("Use a bank-issued collection link.");
  const text = value.trim();
  if (!text) return null;
  let url: URL;
  try { url = new URL(text); } catch { throw new Error("Use a complete HTTPS bank collection link."); }
  if (text.length > 1024 || url.protocol !== "https:" || url.username || url.password ||
      url.port || url.hash || url.search || /[\\\s\x00-\x1f\x7f]/.test(text)) {
    throw new Error("Use the original bank collection link without tracking parameters or fragments.");
  }
  // Reject normalized traversal and encoded path separators, including double encoding.
  if (/%(?:2f|5c|2e|25)/i.test(text) || /\/\.{1,2}(?:\/|$)/.test(text)) {
    throw new Error("This bank collection link format is not supported.");
  }
  const path = url.pathname;
  const supported = bankId === "alfa"
    ? url.hostname === "web.alfabank.ru" && /^\/public\/mrv2\/[^/]+\/?$/.test(path)
    : bankId === "tbank" && ["www.tbank.ru", "tbank.ru"].includes(url.hostname) &&
      /^\/collectmoney\/crowd\/[^/]+\/[^/]+\/?$/.test(path);
  if (!supported || !text.startsWith(`${url.origin}/`)) {
    throw new Error("Use a supported Alfa-Bank or T-Bank personal collection link, or leave the link empty for phone-transfer instructions.");
  }
  return text;
}

export function parseSbpSettings(value: unknown): SbpSettings {
  const input = objectValue(value);
  if (typeof input.enabled !== "boolean" || Object.keys(input).some((key) => !["enabled", "phone", "banks"].includes(key))) {
    throw new Error("Check your SBP settings.");
  }
  if (!input.enabled) return { ...EMPTY_SBP_SETTINGS, banks: [] };
  const phone = input.phone === null || input.phone === "" ? null : input.phone;
  if (phone !== null && (typeof phone !== "string" || !/^\+7[0-9]{10}$/.test(phone))) {
    throw new Error("Enter +7 followed by exactly 10 digits.");
  }
  if (!Array.isArray(input.banks) || input.banks.length > 12) {
    throw new Error("Choose valid receiving banks.");
  }
  const banks = input.banks.map((value) => {
    const bank = objectValue(value);
    if (!isSbpBankId(bank.bankId) || Object.keys(bank).some((key) => !["bankId", "transferUrl"].includes(key))) {
      throw new Error("Choose a supported receiving bank.");
    }
    return { bankId: bank.bankId, transferUrl: validateSbpTransferUrl(bank.bankId, bank.transferUrl) };
  });
  if (new Set(banks.map((bank) => bank.bankId)).size !== banks.length) {
    throw new Error("Choose each receiving bank only once.");
  }
  if (banks.length && !phone) throw new Error("Add your +7 phone number before selecting receiving banks.");
  return { enabled: true, phone, banks };
}

export async function getOwnSbpSettings(walletAddress: string): Promise<SbpSettings> {
  const { data, error } = await createAdminSupabase().from("profile_sbp_settings")
    .select("enabled, phone, banks").eq("wallet_address", walletAddress).maybeSingle();
  if (error) throw new Error("SBP settings are temporarily unavailable.");
  return data ? parseSbpSettings(data) : { ...EMPTY_SBP_SETTINGS, banks: [] };
}

export function sbpBodyError(error: unknown) {
  if (error instanceof RequestBodyError) {
    return sbpResponse({ error: "Send valid SBP settings as a small JSON request." }, error.code === "REQUEST_TOO_LARGE" ? 413 : 400);
  }
  return sbpResponse({ error: error instanceof Error ? error.message : "Check your SBP settings." }, 400);
}
