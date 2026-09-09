"use client";

import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";

const players = new Set<HTMLMediaElement>();

function pauseOtherPlayers(event: Event) {
  if (!(event.target instanceof HTMLMediaElement)) return;
  for (const player of players) {
    if (player !== event.target && !player.paused) player.pause();
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
  // Some MediaRecorder WebM files do not include a duration. Use the browser's
  // real seekable range when it becomes available; never seek to an invented time.
  if (media.seekable.length > 0) {
    const end = media.seekable.end(media.seekable.length - 1);
    if (Number.isFinite(end) && end > 0) return end;
  }
  return 0;
}

export function formatMediaTime(seconds: number) {
  const whole = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, "0")}`;
}

export function useMediaPlayback<T extends HTMLMediaElement>() {
  const mediaRef = useRef<T>(null);
  const mounted = useRef(false);
  const learnedDuration = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    mounted.current = true;
    const media = mediaRef.current;
    const unregister = media ? registerPlayer(media) : undefined;
    return () => {
      mounted.current = false;
      unregister?.();
    };
  }, []);

  const updateTiming = useCallback((event: SyntheticEvent<T>) => {
    const media = event.currentTarget;
    const nextDuration = readDuration(media) || learnedDuration.current;
    learnedDuration.current = nextDuration;
    setCurrentTime(Number.isFinite(media.currentTime) ? Math.max(0, media.currentTime) : 0);
    setDuration(nextDuration);
  }, []);

  const togglePlayback = useCallback(async () => {
    const media = mediaRef.current;
    if (!media) return;
    if (!media.paused && !media.ended) {
      media.pause();
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (media.error) media.load();
      if (media.ended) media.currentTime = 0;
      await media.play();
      if (!mounted.current) media.pause();
    } catch (cause) {
      if (!mounted.current) return;
      setLoading(false);
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setPlaying(false);
      setError(cause instanceof DOMException && cause.name === "NotAllowedError"
        ? "Playback was blocked by your browser. Tap play to try again."
        : "This recording couldn’t play. Tap retry to load it again.");
    }
  }, []);

  const seek = useCallback((seconds: number) => {
    const media = mediaRef.current;
    if (!media || !Number.isFinite(seconds)) return;
    const availableDuration = readDuration(media) || learnedDuration.current;
    if (availableDuration <= 0) return;
    try {
      media.currentTime = Math.min(availableDuration, Math.max(0, seconds));
      setCurrentTime(media.currentTime);
    } catch {
      // A stream may not be seekable until the next metadata update.
    }
  }, []);

  const cycleRate = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;
    const nextRate = media.playbackRate < 1.5 ? 1.5 : media.playbackRate < 2 ? 2 : 1;
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
      setPlaying(false);
      setLoading(false);
    },
    onEnded: (event: SyntheticEvent<T>) => {
      updateTiming(event);
      setPlaying(false);
      setLoading(false);
    },
    onWaiting: () => setLoading(true),
    onCanPlay: (event: SyntheticEvent<T>) => {
      updateTiming(event);
      setLoading(false);
    },
    onError: () => {
      setLoading(false);
      setPlaying(false);
      setError("This recording couldn’t load. Tap retry to try again.");
    },
    onRateChange: (event: SyntheticEvent<T>) => setRate(event.currentTarget.playbackRate),
  };

  return {
    mediaRef,
    playing,
    loading,
    currentTime,
    duration,
    progress: duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0,
    error,
    rate,
    togglePlayback,
    seek,
    cycleRate,
    mediaEvents,
  };
}
