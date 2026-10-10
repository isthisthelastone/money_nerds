"use client";

import { useI18n } from "@/components/providers/I18nProvider";
import { useSyncExternalStore } from "react";
export const PLAYBACK_RATES = [0.5, 1, 1.5, 2, 2.5] as const;
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function PlaybackSpeedSelect({ rate, onChange }: { rate: number; onChange: (rate: number) => void }) {
  const { t } = useI18n();
  // A native select can change before React hydrates, losing the first choice.
  const interactive = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  return <span className="media-speed" data-interactive={interactive} aria-busy={!interactive}>
    <span className="media-speed__value" aria-hidden="true">{rate}×</span>
    <select className="media-speed__select" disabled={!interactive} value={rate} aria-label={t("Playback speed")} onChange={event => onChange(Number(event.target.value))}>
      {PLAYBACK_RATES.map(value => <option key={value} value={value}>{value}×</option>)}
    </select>
  </span>;
}
