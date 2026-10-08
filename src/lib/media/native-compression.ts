import type { MediaKind } from "@/lib/models";
import { createCompatibleMediaRecorder, recordedFileFromChunks } from "./recording";

/** Short-file fallback for Safari versions without WebCodecs encoders. Local only. */
export async function compressWithNativeRecorder(file: File, kind: MediaKind, duration: number, signal: AbortSignal): Promise<File | null> {
  if (duration > 20 || !window.AudioContext || typeof MediaRecorder === "undefined" || signal.aborted) return null;
  const context = new AudioContext();
  let source: MediaElementAudioSourceNode | undefined;
  let media: HTMLMediaElement | undefined;
  let video: HTMLVideoElement | undefined;
  let url: string | undefined;
  let stream: MediaStream | undefined;
  let frame = 0;
  let recorder: MediaRecorder | undefined;
  let interrupted = false;
  const stopWork = () => {
    interrupted = true;
    media?.pause();
    if (recorder?.state === "recording") recorder.stop();
    void context.close().catch(() => undefined);
  };
  const onVisibility = () => { if (document.visibilityState === "hidden") stopWork(); };
  signal.addEventListener("abort", stopWork, { once: true });
  document.addEventListener("visibilitychange", onVisibility);
  try {
    const destination = context.createMediaStreamDestination();
    destination.channelCount = 1;
    // The native element decodes formats that Safari's decodeAudioData doesn't.
    // Route sound exclusively to the recorder, not to the speakers.
    media = document.createElement(kind === "audio" ? "audio" : "video");
    media.preload = "auto"; url = URL.createObjectURL(file); media.src = url;
    source = context.createMediaElementSource(media); source.connect(destination);
    if (kind === "video_circle") {
      video = media as HTMLVideoElement; video.playsInline = true;
      const canvas = document.createElement("canvas"); canvas.width = 480; canvas.height = 480;
      if (!canvas.captureStream) return null;
      const paint = canvas.getContext("2d"); if (!paint) return null;
      stream = canvas.captureStream(24);
      destination.stream.getAudioTracks().forEach(track => stream!.addTrack(track));
      const draw = () => {
        if (!video) return;
        paint.fillStyle = "black"; paint.fillRect(0, 0, 480, 480);
        const scale = Math.min(480 / (video.videoWidth || 480), 480 / (video.videoHeight || 480));
        const width = video.videoWidth * scale, height = video.videoHeight * scale;
        if (video.readyState >= 2) paint.drawImage(video, (480-width)/2, (480-height)/2, width, height);
        frame = requestAnimationFrame(draw);
      };
      draw();
    } else stream = destination.stream;
    await context.resume();
    if (context.state !== "running" || signal.aborted || interrupted) return null;
    // Prime decoding before the recording clock starts, so no leading audio is lost.
    await media.play(); media.pause(); media.currentTime = 0;
    recorder = createCompatibleMediaRecorder(stream, kind === "audio" ? "audio" : "video_circle");
    const chunks: Blob[] = [];
    const start = performance.now();
    await new Promise<void>((resolve, reject) => {
      const stop = () => { if (recorder?.state === "recording") recorder.stop(); };
      const abort = () => { stop(); reject(new DOMException("Canceled", "AbortError")); };
      const timer = setTimeout(stop, Math.ceil(duration * 1000));
      recorder!.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder!.onstop = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); resolve(); };
      recorder!.onerror = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); reject(new Error("Encoding failed")); };
      media!.onended = stop;
      signal.addEventListener("abort", abort, { once: true });
      recorder!.start();
      void media!.play().catch(abort);
    });
    if (signal.aborted || interrupted) return null;
    return await recordedFileFromChunks(kind === "audio" ? "audio" : "video_circle", chunks, recorder.mimeType, performance.now() - start);
  } catch { return null; }
  finally {
    signal.removeEventListener("abort", stopWork);
    document.removeEventListener("visibilitychange", onVisibility);
    cancelAnimationFrame(frame);
    if (recorder?.state === "recording") recorder.stop();
    source?.disconnect(); media?.pause();
    stream?.getTracks().forEach(track => track.stop());
    if (url) URL.revokeObjectURL(url);
    await context.close().catch(() => undefined);
  }
}
