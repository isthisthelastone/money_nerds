"use client";

import { useI18n } from "@/components/providers/I18nProvider";
export const PLAYBACK_RATES = [0.5, 1, 1.5, 2, 2.5] as const;

export function PlaybackSpeedSelect({ rate, onChange }: { rate: number; onChange: (rate: number) => void }) {
  const { t } = useI18n();
  return <span className="media-speed">
    <span className="media-speed__value" aria-hidden="true">{rate}×</span>
    <select className="media-speed__select" value={rate} aria-label={t("Playback speed")} onChange={event => onChange(Number(event.target.value))}>
      {PLAYBACK_RATES.map(value => <option key={value} value={value}>{value}×</option>)}
    </select>
  </span>;
}
