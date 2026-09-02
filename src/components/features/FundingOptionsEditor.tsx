"use client";

import { Check, CircleDollarSign, ShieldCheck } from "lucide-react";
import {
  normalizePayoutAddress,
  PAYOUT_ASSET_CONFIG,
  type PayoutAsset,
} from "@/lib/funding/payouts";
import type { FundingOptionInput } from "@/lib/funding/options";

const FUNDING_GROUPS: Array<{
  id: string;
  title: string;
  hint: string;
  assets: PayoutAsset[];
}> = [
  {
    id: "solana",
    title: "Solana",
    hint: "One Solana address can receive SOL and the selected Solana tokens.",
    assets: ["SOL", "USDC-SOL", "USDT-SOL"],
  },
  {
    id: "ethereum",
    title: "Ethereum",
    hint: "One Ethereum address can receive ETH and USDT on ERC-20.",
    assets: ["ETH", "USDT-ERC20"],
  },
  {
    id: "bitcoin",
    title: "Bitcoin",
    hint: "Use a Bitcoin mainnet address.",
    assets: ["BTC"],
  },
  {
    id: "tron",
    title: "TRON",
    hint: "One TRON address can receive TRX and USDT on TRC-20.",
    assets: ["TRX", "USDT-TRC20"],
  },
  {
    id: "ton",
    title: "TON",
    hint: "Use a TON mainnet wallet address.",
    assets: ["TON"],
  },
  {
    id: "injective",
    title: "Injective",
    hint: "Use your Injective mainnet destination.",
    assets: ["INJ"],
  },
];

function assetLabel(asset: PayoutAsset) {
  switch (asset) {
    case "USDC-SOL":
      return "USDC · Solana";
    case "USDT-SOL":
      return "USDT · Solana";
    case "USDT-ERC20":
      return "USDT · ERC-20";
    case "USDT-TRC20":
      return "USDT · TRC-20";
    default:
      return asset;
  }
}

export function FundingOptionsEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: FundingOptionInput[];
  onChange: (value: FundingOptionInput[]) => void;
  disabled?: boolean;
}) {
  const selected = new Map(value.map((option) => [option.asset, option.address]));

  const toggle = (asset: PayoutAsset, groupAssets: PayoutAsset[]) => {
    const current = selected.get(asset);
    if (current !== undefined) {
      onChange(value.filter((option) => option.asset !== asset));
      return;
    }
    const sharedAddress = groupAssets
      .map((candidate) => selected.get(candidate))
      .find((address): address is string => typeof address === "string");
    onChange([...value, { asset, address: sharedAddress ?? "" }]);
  };

  const updateGroupAddress = (assets: PayoutAsset[], address: string) => {
    const group = new Set(assets);
    onChange(
      value.map((option) =>
        group.has(option.asset) ? { ...option, address } : option,
      ),
    );
  };

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#c9ff55]/20 bg-[#c9ff55]/[0.035]">
      <div className="border-b border-white/8 p-4 sm:p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#f2efe6]">
          <CircleDollarSign aria-hidden="true" size={18} className="text-[#c9ff55]" />
          Where can people fund this ask?
        </p>
        <p className="mt-1.5 max-w-3xl text-xs leading-5 text-white/50">
          Select every asset you accept, then add the matching mainnet destination. The Fund
          button will show only these choices. At least one is required; Money Nerds never
          redirects or takes a cut.
        </p>
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
        {FUNDING_GROUPS.map((group) => {
          const activeAssets = group.assets.filter((asset) => selected.has(asset));
          const address = activeAssets.length ? selected.get(activeAssets[0]) ?? "" : "";
          const invalid = Boolean(
            address &&
              activeAssets.some((asset) => !normalizePayoutAddress(asset, address)),
          );
          return (
            <div
              key={group.id}
              className={`rounded-xl border p-3.5 transition ${
                activeAssets.length
                  ? "border-[#c9ff55]/30 bg-black/25"
                  : "border-white/8 bg-black/10"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[#f2efe6]">{group.title}</p>
                  <p className="mt-1 text-[0.68rem] leading-4 text-white/38">{group.hint}</p>
                </div>
                {activeAssets.length ? (
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#c9ff55]/12 text-[#c9ff55]">
                    <Check aria-hidden="true" size={14} />
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {group.assets.map((asset) => {
                  const active = selected.has(asset);
                  return (
                    <button
                      key={asset}
                      type="button"
                      className={`rounded-full border px-2.5 py-1.5 text-[0.7rem] font-medium transition ${
                        active
                          ? "border-[#c9ff55]/45 bg-[#c9ff55]/12 text-[#dfff9c]"
                          : "border-white/10 text-white/45 hover:border-white/25 hover:text-white/75"
                      }`}
                      aria-pressed={active}
                      disabled={disabled}
                      onClick={() => toggle(asset, group.assets)}
                    >
                      {assetLabel(asset)}
                    </button>
                  );
                })}
              </div>
              {activeAssets.length ? (
                <label className="mt-3 grid gap-1.5 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-white/45">
                  {PAYOUT_ASSET_CONFIG[activeAssets[0]].networkName} address
                  <input
                    className={`min-h-10 rounded-lg border bg-black/30 px-3 font-mono text-xs normal-case tracking-normal text-[#f2efe6] outline-none transition ${
                      invalid
                        ? "border-[#ff8066]/60 focus:ring-2 focus:ring-[#ff8066]/10"
                        : "border-white/12 focus:border-[#c9ff55]/65 focus:ring-2 focus:ring-[#c9ff55]/10"
                    }`}
                    value={address}
                    onChange={(event) => updateGroupAddress(group.assets, event.target.value)}
                    placeholder={`Paste ${group.title} mainnet address`}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    disabled={disabled}
                    required
                  />
                  {invalid ? (
                    <span className="normal-case tracking-normal text-[#ff9a86]">
                      This does not look like a valid {group.title} mainnet address.
                    </span>
                  ) : null}
                </label>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="flex items-start gap-2 border-t border-white/8 px-4 py-3 text-[0.7rem] leading-5 text-white/42">
        <ShieldCheck aria-hidden="true" size={15} className="mt-0.5 shrink-0 text-[#9ccaff]" />
        Destinations are saved to your Money Nerds profile and snapshotted on this post, so a
        later profile edit cannot silently change where an existing Fund button sends people.
      </p>
    </section>
  );
}
