import type { MediaKind } from "@/lib/models";
import { BlobSource, Input, ALL_FORMATS, Output, BufferTarget, Conversion, Mp4OutputFormat, WebMOutputFormat, Quality, canEncodeAudio, canEncodeVideo } from "mediabunny";

export interface PreparedMediaFile {
  file: File;
  duration?: number;
  width?: number;
  height?: number;
  compressed: boolean;
}

/** Imported only after choosing a file, never on the landing-page critical path. */
export async function prepareMediaFile(file: File, kind: MediaKind, signal: AbortSignal): Promise<PreparedMediaFile> {
  const original: PreparedMediaFile = { file, compressed: false };
  if (kind === "image" || file.size > 15 * 1024 * 1024 || signal.aborted) return original;
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  let conversion: Conversion | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const work = new AbortController();
  const cancel = () => { work.abort(); void conversion?.cancel().catch(() => undefined); input.dispose(); };
  const nativeFallback = async () => {
    if (!original.duration || work.signal.aborted || signal.aborted) return original;
    const { compressWithNativeRecorder } = await import("./native-compression");
    const compressed = await compressWithNativeRecorder(file, kind, original.duration, work.signal);
    if (!compressed || compressed.size >= file.size * .9 || signal.aborted || work.signal.aborted) return original;
    return { ...original, file: compressed, width: kind === "video_circle" ? 480 : undefined, height: kind === "video_circle" ? 480 : undefined, compressed: true };
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    timeout = setTimeout(cancel, 30_000);
    const duration = await input.computeDuration();
    if (Number.isFinite(duration) && duration > 0 && duration <= 86400) original.duration = duration;
    const video = await input.getPrimaryVideoTrack();
    if (video) {
      const width = await video.getDisplayWidth();
      const height = await video.getDisplayHeight();
      if (Number.isInteger(width) && width > 0 && width <= 8192) original.width = width;
      if (Number.isInteger(height) && height > 0 && height <= 8192) original.height = height;
    }
    if (!original.duration || signal.aborted) return original;
    // Don't waste CPU/battery re-encoding compact recordings or long movies.
    const targetBps = kind === "audio" ? 64000 : 514000;
    if (file.size * 8 / duration < targetBps * 1.35 || duration > (kind === "audio" ? 180 : 120)) return original;
    const aac = await canEncodeAudio("aac", { bitrate: 64000, numberOfChannels: 1, sampleRate: 48000 });
    const mp4 = aac && (kind === "audio" || await canEncodeVideo("avc", { width: 480, height: 480, bitrate: 450000 }));
    if (!mp4 && (!await canEncodeAudio("opus", { bitrate: 48000, numberOfChannels: 1, sampleRate: 48000 }) || (kind === "video_circle" && !await canEncodeVideo("vp8", { width: 480, height: 480, bitrate: 450000 })))) {
      return await nativeFallback();
    }
    const output = new Output({ format: mp4 ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat(), target: new BufferTarget() });
    conversion = await Conversion.init({
      input, output,
      video: kind === "audio" ? { discard: true } : {
        width: Math.min(480, original.width ?? 480), height: Math.min(480, original.height ?? 480), fit: "contain",
        frameRate: 24, codec: mp4 ? "avc" : "vp8", quality: new Quality({ bitrate: 450000 }), keyFrameInterval: 2,
      },
      audio: { codec: mp4 ? "aac" : "opus", quality: new Quality({ bitrate: mp4 ? 64000 : 48000 }), numberOfChannels: 1, sampleRate: 48000 },
    });
    // Never silently drop a camera/microphone track because a codec is unsupported.
    if (!conversion.isValid || conversion.discardedTracks.length) { await conversion.cancel(); return await nativeFallback(); }
    if (signal.aborted) return original;
    await conversion.execute();
    const buffer = output.target.buffer;
    if (!buffer || signal.aborted || buffer.byteLength >= file.size * .9) return original;
    const type = mp4 ? (kind === "audio" ? "audio/mp4" : "video/mp4") : (kind === "audio" ? "audio/webm" : "video/webm");
    const extension = mp4 ? (kind === "audio" ? "m4a" : "mp4") : "webm";
    return { ...original, file: new File([buffer], `${file.name.replace(/\.[^.]+$/, "")}-compact.${extension}`, { type }),
      width: video ? Math.min(480, original.width ?? 480) : undefined, height: video ? Math.min(480, original.height ?? 480) : undefined, compressed: true };
  } catch {
    await conversion?.cancel().catch(() => undefined);
    return await nativeFallback().catch(() => original);
  }
  finally { clearTimeout(timeout); signal.removeEventListener("abort", cancel); input.dispose(); }
}
