"use client";

import { LoaderCircle, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatMediaTime, useMediaPlayback } from "./useMediaPlayback";

interface CircleVideoPlayerProps {
  src: string;
  label?: string;
}

export function CircleVideoPlayer(props: CircleVideoPlayerProps) {
  return <CircleVideo key={props.src} {...props} />;
}

function CircleVideo({ src, label = "Circle video" }: CircleVideoPlayerProps) {
  const {
    mediaRef, playing, loading, currentTime, duration, progress, error,
    togglePlayback, seek, mediaEvents,
  } = useMediaPlayback<HTMLVideoElement>();
  const descriptionId = useId();
  const dragging = useRef<number | null>(null);
  const [muted, setMuted] = useState(false);

  const seekFromPointer = (event: PointerEvent<SVGSVGElement>) => {
    if (!duration) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    // The timeline begins at twelve o'clock and progresses clockwise.
    const angle = (Math.atan2(y, x) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
    seek((angle / (Math.PI * 2)) * duration);
  };

  const finishSeek = (event: PointerEvent<SVGSVGElement>) => {
    if (dragging.current !== event.pointerId) return;
    dragging.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const seekWithKeyboard = (event: KeyboardEvent<SVGSVGElement>) => {
    const offsets: Record<string, number> = {
      ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5,
      PageUp: 10, PageDown: -10,
    };
    if (event.key in offsets) {
      event.preventDefault();
      seek(currentTime + offsets[event.key]);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      seek(event.key === "Home" ? 0 : duration);
    }
  };

  const time = formatMediaTime(currentTime);
  const total = formatMediaTime(duration);
  const remaining = formatMediaTime(Math.max(0, duration - currentTime));

  return (
    <div className="circle-message" role="group" aria-label={label}>
      <div className="circle-message__player" data-playing={playing} data-loading={loading}>
        <video
          ref={mediaRef}
          src={src}
          playsInline
          preload="metadata"
          className="circle-message__video"
          aria-label={label}
          {...mediaEvents}
          onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
        />
        <div className="circle-message__shade" aria-hidden="true" />
        <button
          type="button"
          className="circle-message__toggle"
          onClick={() => void togglePlayback()}
          aria-label={`${error ? "Retry" : playing ? "Pause" : "Play"} ${label}`}
        >
          <span className="circle-message__play-disc">
            {loading ? <LoaderCircle className="media-player__spinner" size={28} aria-hidden="true" />
              : error ? <RotateCcw size={28} aria-hidden="true" />
                : playing ? <Pause size={28} fill="currentColor" aria-hidden="true" />
                  : <Play size={30} fill="currentColor" aria-hidden="true" />}
          </span>
        </button>
        <button
          className="circle-message__mute"
          type="button"
          aria-label={muted ? "Unmute video" : "Mute video"}
          aria-pressed={muted}
          onClick={() => {
            const video = mediaRef.current;
            if (video) video.muted = !video.muted;
          }}
        >
          {muted ? <VolumeX size={17} aria-hidden="true" /> : <Volume2 size={17} aria-hidden="true" />}
        </button>
        <div className="circle-message__time" aria-hidden="true">
          <span>{time}</span><span className="circle-message__time-divider">/</span>
          <span>{duration ? `−${remaining}` : "–:––"}</span>
        </div>
        <svg
          viewBox="0 0 240 240"
          className="circle-message__seek"
          role="slider"
          tabIndex={0}
          aria-label={`Seek ${label}`}
          aria-valuemin={0}
          aria-valuemax={duration || 1}
          aria-valuenow={Math.min(currentTime, duration || 1)}
          aria-valuetext={duration ? `${time} of ${total}; ${remaining} remaining` : "Duration not yet available"}
          aria-disabled={!duration}
          aria-describedby={descriptionId}
          onKeyDown={seekWithKeyboard}
          onPointerDown={(event) => {
            if (!event.isPrimary || event.button !== 0 || !duration) return;
            event.preventDefault();
            dragging.current = event.pointerId;
            event.currentTarget.setPointerCapture(event.pointerId);
            seekFromPointer(event);
          }}
          onPointerMove={(event) => {
            if (dragging.current === event.pointerId) seekFromPointer(event);
          }}
          onPointerUp={(event) => {
            if (dragging.current === event.pointerId) seekFromPointer(event);
            finishSeek(event);
          }}
          onPointerCancel={finishSeek}
          onLostPointerCapture={() => { dragging.current = null; }}
        >
          <circle className="circle-message__ring-track" cx="120" cy="120" r="114" />
          <circle
            className="circle-message__ring-progress"
            cx="120" cy="120" r="114" pathLength="100"
            strokeDasharray="100"
            strokeDashoffset={100 - progress * 100}
            transform="rotate(-90 120 120)"
          />
          <circle className="circle-message__seek-hit" cx="120" cy="120" r="105" />
        </svg>
      </div>
      <span id={descriptionId} className="sr-only">Drag around the edge, or use arrow keys to seek five seconds.</span>
      {loading ? <span className="sr-only" role="status">Loading video…</span> : null}
      {error ? (
        <p className="media-player__error" role="alert">
          {error} <a href={src} target="_blank" rel="noopener noreferrer">Open recording</a>
        </p>
      ) : null}
    </div>
  );
}
