"use client";

import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import { PLAYBACK_RATES } from "./PlaybackSpeedSelect";

const players = new Set<HTMLMediaElement>();

function pauseOtherPlayers(event: Event) {
  if (!(event.target instanceof HTMLMediaElement)) return;
  for (const player of players) {
    if (player !== event.target) player.pause();
  }
}

function registerPlayer(player: HTMLMediaElement) {
  if (players.size === 0) document.addEventListener("play", pauseOtherPlayers, true);
  players.add(player);
  return () => {
    players.delete(player);
    player.pause();
    if (players.size === 0) document.removeEventListener("play", pauseOtherPlayers, true);
  };
}

function readDuration(media: HTMLMediaElement) {
  if (Number.isFinite(media.duration) && media.duration > 0) return media.duration;
  if (media.ended && Number.isFinite(media.currentTime) && media.currentTime > 0) {
    return media.currentTime;
  }
  // A partially buffered range is not the recording's full duration.
  return 0;
}

export function formatMediaTime(seconds: number) {
  const whole = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, "0")}`;
}

export function useMediaPlayback<T extends HTMLMediaElement>({ src, durationHint = 0 }: { src: string; durationHint?: number }) {
  const initialDuration = Number.isFinite(durationHint) && durationHint > 0 ? durationHint : 0;
  const mediaRef = useRef<T>(null);
  const mounted = useRef(false);
  const learnedDuration = useRef(initialDuration);
  const playRequested = useRef(false);
  const playAttempt = useRef(0);
  const [active, setActive] = useState(false);
  const [source, setSource] = useState(src);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration);
  const [error, setError] = useState<string | null>(null);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    mounted.current = true;
    const media = mediaRef.current;
    const unregister = media ? registerPlayer(media) : undefined;
    const target = media?.parentElement;
    const observer = target && typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) { setActive(true); observer?.disconnect(); }
      }, { rootMargin: "200px" }) : null;
    if (target && observer) observer.observe(target);
    else setActive(true);
    return () => {
      mounted.current = false;
      playAttempt.current += 1;
      observer?.disconnect();
      unregister?.();
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      const media = mediaRef.current;
      if (!media || media.paused) return;
      if (now - last >= 100) { setCurrentTime(media.currentTime); last = now; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const updateTiming = useCallback((event: SyntheticEvent<T>) => {
    const media = event.currentTarget;
    const nextDuration = readDuration(media) || learnedDuration.current || initialDuration;
    learnedDuration.current = nextDuration;
    setCurrentTime(Number.isFinite(media.currentTime) ? Math.max(0, media.currentTime) : 0);
    setDuration(nextDuration);
  }, [initialDuration]);

  const togglePlayback = useCallback(async () => {
    const media = mediaRef.current;
    if (!media) return;
    if (playRequested.current || (!media.paused && !media.ended)) {
      playAttempt.current += 1;
      playRequested.current = false;
      media.pause();
      setLoading(false);
      return;
    }
    const attempt = ++playAttempt.current;
    playRequested.current = true;
    setActive(true);
    setError(null);
    setLoading(true);
    try {
      if (media.error) {
        // Reload our stable public route, not an expired cached storage redirect.
        const refreshed = new URL(src, window.location.href);
        if (["http:", "https:"].includes(refreshed.protocol)) refreshed.searchParams.set("retry", String(Date.now()));
        const nextSource = refreshed.toString();
        setSource(nextSource);
        media.src = nextSource;
        media.load();
      } else if (!media.getAttribute("src")) media.src = source;
      if (media.ended) media.currentTime = 0;
      await media.play();
      if (!mounted.current) media.pause();
    } catch (cause) {
      if (!mounted.current || playAttempt.current !== attempt) return;
      setLoading(false);
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setPlaying(false);
      setError(cause instanceof DOMException && cause.name === "NotAllowedError"
        ? "Playback was blocked by your browser. Tap play to try again."
        : "This recording couldn’t play. Tap retry to load it again.");
    } finally {
      if (playAttempt.current === attempt) playRequested.current = false;
    }
  }, [source, src]);

  const seek = useCallback((seconds: number) => {
    const media = mediaRef.current;
    if (!media || !Number.isFinite(seconds)) return;
    const availableDuration = readDuration(media) || learnedDuration.current || initialDuration;
    if (availableDuration <= 0) return;
    try {
      media.currentTime = Math.min(availableDuration, Math.max(0, seconds));
      setCurrentTime(media.currentTime);
    } catch {
      // A stream may not be seekable until the next metadata update.
    }
  }, [initialDuration]);

  const changeRate = useCallback((nextRate: number) => {
    const media = mediaRef.current;
    if (!media || !PLAYBACK_RATES.some(value => value === nextRate)) return;
    // load()/source refresh resets the current rate to this browser default.
    media.defaultPlaybackRate = nextRate;
    media.playbackRate = nextRate;
    setRate(media.playbackRate);
  }, []);

  const mediaEvents = {
    onLoadedMetadata: updateTiming,
    onDurationChange: updateTiming,
    onTimeUpdate: updateTiming,
    onPlay: () => {
      setPlaying(true);
      setError(null);
    },
    onPlaying: () => {
      setPlaying(true);
      setLoading(false);
      setError(null);
    },
    onPause: () => {
      playRequested.current = false;
      setPlaying(false);
      setLoading(false);
    },
    onEnded: (event: SyntheticEvent<T>) => {
      playRequested.current = false;
      updateTiming(event);
      setPlaying(false);
      setLoading(false);
    },
    onWaiting: (event: SyntheticEvent<T>) => { if (!event.currentTarget.paused) setLoading(true); },
    onCanPlay: (event: SyntheticEvent<T>) => {
      updateTiming(event);
      setLoading(false);
    },
    onProgress: updateTiming,
    onSeeked: (event: SyntheticEvent<T>) => { updateTiming(event); if (event.currentTarget.paused) setLoading(false); },
    onError: (event: SyntheticEvent<T>) => {
      if (event.currentTarget.error?.code === 1) return; // source change / user cancellation
      playRequested.current = false;
      setLoading(false);
      setPlaying(false);
      setError("This recording couldn’t load. Tap retry to try again.");
    },
    onRateChange: (event: SyntheticEvent<T>) => setRate(event.currentTarget.playbackRate),
  };

  return {
    mediaRef,
    mediaSource: active ? source : undefined,
    playing,
    loading,
    currentTime,
    duration: duration || initialDuration,
    progress: (duration || initialDuration) > 0 ? Math.min(1, Math.max(0, currentTime / (duration || initialDuration))) : 0,
    error,
    rate,
    togglePlayback,
    seek,
    changeRate,
    mediaEvents,
  };
}
