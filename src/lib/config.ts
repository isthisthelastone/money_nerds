const readPublicEnv = (name: string, fallback?: string) => {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const getSupabaseUrl = () =>
  readPublicEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    "https://hqluarhwllbisizcirhg.supabase.co",
  );

export const getSupabasePublishableKey = () =>
  readPublicEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const getSupabaseServiceRoleKey = () =>
  readPublicEnv("SUPABASE_SERVICE_ROLE_KEY");

export const SOLANA_NETWORK = "mainnet-beta" as const;

export const getSolanaRpcUrl = () =>
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

export const SITE_URL = "https://www.moneynerds.online";
export const SERVICE_WALLET = "BqzLRNsHraeahvfppDs9QmRDdYx3gUYt69pgA6UR9GQg";
export const SESSION_COOKIE = "mn_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
export const MAX_MEDIA_BYTES = 15 * 1024 * 1024;
export const MAX_MEDIA_PER_MESSAGE = 4;

