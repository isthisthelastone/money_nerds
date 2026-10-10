"use client";

import { useI18n } from "@/components/providers/I18nProvider";

import { LoaderCircle, Pause, Play, RotateCcw } from "lucide-react";
import { useId } from "react";
import { formatMediaTime, useMediaPlayback } from "./useMediaPlayback";
import { PlaybackSpeedSelect } from "./PlaybackSpeedSelect";

type VoiceMessagePlayerProps = {
  src: string;
  label?: string;
  durationHint?: number;
};

const TIMELINE_TICKS = Array.from({ length: 36 }, (_, index) => index);

function VoiceMessagePlayback({ src, label: providedLabel, durationHint }: VoiceMessagePlayerProps) {
  const { t } = useI18n();
  const label = providedLabel ?? t("Voice message");
  const {
    mediaRef, playing, loading, currentTime, duration, progress, error, rate,
    togglePlayback, seek, changeRate, mediaEvents, mediaSource,
  } = useMediaPlayback<HTMLAudioElement>({ src, durationHint });
  const errorId = useId();
  const elapsed = formatMediaTime(currentTime);
  const total = duration > 0 ? formatMediaTime(duration) : "—:—";
  const action = error ? "Retry voice message" : playing ? "Pause voice message" : "Play voice message";

  return (
    <div className="voice-player" data-playing={playing} role="group" aria-label={label}>
      <audio ref={mediaRef} src={mediaSource} preload="metadata" {...mediaEvents} hidden />
      <button
        type="button"
        className="media-play-button voice-player__play"
        onClick={() => void togglePlayback()}
        aria-label={t(action)}
        aria-describedby={error ? errorId : undefined}
        aria-busy={loading}
      >
        {loading ? <LoaderCircle className="media-player__spinner" size={21} aria-hidden="true" /> : error ? <RotateCcw size={21} aria-hidden="true" /> : playing ? <Pause size={21} fill="currentColor" aria-hidden="true" /> : <Play size={22} fill="currentColor" aria-hidden="true" />}
      </button>
      <div className="voice-player__body">
        <span className="voice-player__label">{label}</span>
        <div className="voice-player__timeline">
          <div className="voice-player__track" aria-hidden="true">
            {TIMELINE_TICKS.map((tick) => (
              <span key={tick} className="voice-player__tick" data-played={tick < progress * TIMELINE_TICKS.length} />
            ))}
          </div>
          <input
            className="voice-player__range"
            type="range"
            min={0}
            max={duration || 1}
            step={0.01}
            value={duration > 0 ? Math.min(currentTime, duration) : 0}
            onChange={(event) => seek(Number(event.currentTarget.value))}
            onKeyDown={(event) => {
              const offsets: Record<string, number> = {
                ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5,
                PageUp: 10, PageDown: -10,
              };
              if (event.key in offsets) {
                event.preventDefault();
                seek(currentTime + offsets[event.key]);
              }
            }}
            disabled={duration <= 0}
            aria-label={t("Seek voice message")}
            aria-valuetext={t("{value0} of {value1}", { value0: elapsed, value1: duration > 0 ? total : t("unknown duration") })}
          />
        </div>
        <div className="voice-player__time" aria-hidden="true">
          <span>{elapsed}</span><span className="voice-player__time-divider">/</span>
          <span>{total}</span>
        </div>
      </div>
      <PlaybackSpeedSelect rate={rate} onChange={changeRate} />
      {error ? <p id={errorId} className="voice-player__error" role="status">{t(error)} <a href={src} target="_blank" rel="noopener noreferrer">{t("Open recording")}</a></p> : null}
    </div>
  );
}

export function VoiceMessagePlayer(props: VoiceMessagePlayerProps) {
  return <VoiceMessagePlayback key={props.src} {...props} />;
}
