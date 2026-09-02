const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  const deltaSeconds = Math.round((timestamp - Date.now()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ];

  for (const [unit, seconds] of units) {
    if (Math.abs(deltaSeconds) >= seconds || unit === "second") {
      return relativeTime.format(Math.round(deltaSeconds / seconds), unit);
    }
  }
  return "now";
}

export function formatWallet(wallet: string, start = 4, end = 4) {
  if (wallet.length <= start + end + 2) return wallet;
  return `${wallet.slice(0, start)}…${wallet.slice(-end)}`;
}

export function formatSol(lamports: number) {
  const sol = lamports / 1_000_000_000;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: sol < 0.01 ? 4 : 2,
    minimumFractionDigits: 0,
  }).format(sol);
}

export function formatAtomicAmount(
  amountAtomic: string | number | bigint,
  decimals: number,
  maximumFractionDigits = 6,
) {
  const raw = String(amountAtomic);
  if (!/^-?\d+$/.test(raw) || !Number.isInteger(decimals) || decimals < 0) return "0";
  const negative = raw.startsWith("-");
  const digits = negative ? raw.slice(1) : raw;
  const padded = digits.padStart(decimals + 1, "0");
  const whole = decimals ? padded.slice(0, -decimals) : padded;
  const fraction = decimals
    ? padded
        .slice(-decimals)
        .slice(0, maximumFractionDigits)
        .replace(/0+$/, "")
    : "";
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${groupedWhole}${fraction ? `.${fraction}` : ""}`;
}

export function parseJsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
