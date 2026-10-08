"use client";

import { useI18n } from "@/components/providers/I18nProvider";
export const PLAYBACK_RATES = [0.5, 1, 1.5, 2, 2.5] as const;

export function PlaybackSpeedSelect({ rate, onChange }: { rate: number; onChange: (rate: number) => void }) {
  const { t } = useI18n();
  return <select className="media-speed" value={rate} aria-label={t("Playback speed")} onChange={event => onChange(Number(event.target.value))}>
    {PLAYBACK_RATES.map(value => <option key={value} value={value}>{value}×</option>)}
  </select>;
}
