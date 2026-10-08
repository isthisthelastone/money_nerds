"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/** Native volume first; Web Audio gain when iOS keeps element.volume at 1. */
export function useMediaVolume(ref: RefObject<HTMLVideoElement | null>) {
  const graph = useRef<{ context: AudioContext; source: MediaElementAudioSourceNode; gain: GainNode } | null>(null);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(false);
  const [deviceVolumeOnly, setDeviceVolumeOnly] = useState(false);
  useEffect(() => () => {
    const audio = graph.current;
    if (audio) { audio.source.disconnect(); audio.gain.disconnect(); void audio.context.close(); }
  }, []);

  const setVolume = (value: number) => {
    const video = ref.current;
    if (!video) return;
    const next = Math.max(0, Math.min(1, value));
    video.muted = next === 0;
    setMuted(next === 0);
    try { video.volume = next; } catch { /* iOS may reject programmatic volume. */ }
    if (graph.current || Math.abs(video.volume - next) > .01) {
      try {
        if (!graph.current) {
          const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const context = new AudioContextClass();
          const source = context.createMediaElementSource(video);
          const gain = context.createGain();
          source.connect(gain); gain.connect(context.destination);
          graph.current = { context, source, gain };
          try { video.volume = 1; } catch { /* Native volume remains device controlled. */ }
        }
        graph.current.gain.gain.value = next;
        void graph.current.context.resume().catch(() => setDeviceVolumeOnly(true));
      } catch { setDeviceVolumeOnly(true); return; }
    }
    setVolumeState(next);
  };
  return {
    volume, muted, deviceVolumeOnly, setVolume,
    toggleMute: () => {
      const video = ref.current;
      if (video && (volume === 0 || graph.current?.gain.gain.value === 0)) { setVolume(1); return; }
      if (video) { video.muted = !video.muted; setMuted(video.muted); }
    },
    resume: () => { if (graph.current) void graph.current.context.resume().catch(() => setDeviceVolumeOnly(true)); },
  };
}
