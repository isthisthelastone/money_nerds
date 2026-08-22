export type RecordingKind = "audio" | "video_circle";

export interface RecordingDeviceSelection {
  audioDeviceId?: string;
  videoDeviceId?: string;
}

const MIME_CANDIDATES: Record<RecordingKind, readonly string[]> = {
  audio: [
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ],
  video_circle: [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm",
  ],
};

const RETRYABLE_DEVICE_ERRORS = new Set([
  "AbortError",
  "ConstraintNotSatisfiedError",
  "DevicesNotFoundError",
  "NotFoundError",
  "NotReadableError",
  "OverconstrainedError",
  "TrackStartError",
  "TypeError",
]);

const AUDIO_MIMES = new Set([
  "audio/mp4",
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/wav",
]);

const VIDEO_MIMES = new Set(["video/mp4", "video/webm"]);

function uniqueConstraints(candidates: MediaStreamConstraints[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = JSON.stringify(candidate);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function audioConstraint(deviceId: string, exact: boolean): MediaTrackConstraints | true {
  if (!deviceId) return true;
  return exact
    ? { deviceId: { exact: deviceId } }
    : { deviceId: { ideal: deviceId } };
}

function videoConstraint(
  deviceId: string,
  exact: boolean,
): MediaTrackConstraints {
  return {
    ...(deviceId
      ? exact
        ? { deviceId: { exact: deviceId } }
        : { deviceId: { ideal: deviceId } }
      : { facingMode: { ideal: "user" } }),
    width: { ideal: 720 },
    height: { ideal: 720 },
  };
}

export function recordingConstraintCandidates(
  kind: RecordingKind,
  selection: RecordingDeviceSelection = {},
): MediaStreamConstraints[] {
  const audioDeviceId = selection.audioDeviceId?.trim() ?? "";
  const videoDeviceId = selection.videoDeviceId?.trim() ?? "";

  if (kind === "audio") {
    return uniqueConstraints([
      { audio: audioConstraint(audioDeviceId, true) },
      { audio: audioConstraint(audioDeviceId, false) },
      { audio: true },
    ]);
  }

  return uniqueConstraints([
    {
      audio: audioConstraint(audioDeviceId, true),
      video: videoConstraint(videoDeviceId, true),
    },
    {
      audio: audioConstraint(audioDeviceId, false),
      video: videoConstraint(videoDeviceId, false),
    },
    {
      audio: true,
      video: videoConstraint("", false),
    },
    { audio: true, video: true },
  ]);
}

export function mediaErrorName(value: unknown) {
  if (!value || typeof value !== "object" || !("name" in value)) return "";
  return String(value.name);
}

export function isRecordingDeviceSelectionError(value: unknown) {
  return RETRYABLE_DEVICE_ERRORS.has(mediaErrorName(value));
}

function missingTrackError(kind: RecordingKind) {
  const error = new Error(
    kind === "audio" ? "No microphone track was returned" : "Camera or microphone track missing",
  );
  error.name = "NotFoundError";
  return error;
}

export async function requestRecordingStream(
  mediaDevices: Pick<MediaDevices, "getUserMedia">,
  kind: RecordingKind,
  selection: RecordingDeviceSelection = {},
) {
  const candidates = recordingConstraintCandidates(kind, selection);
  let lastError: unknown = new Error("No recording constraints were available");

  for (const [index, constraints] of candidates.entries()) {
    try {
      const stream = await mediaDevices.getUserMedia(constraints);
      const hasAudio = stream.getAudioTracks().some((track) => track.readyState === "live");
      const hasVideo = stream.getVideoTracks().some((track) => track.readyState === "live");
      if (!hasAudio || (kind === "video_circle" && !hasVideo)) {
        stream.getTracks().forEach((track) => track.stop());
        throw missingTrackError(kind);
      }
      return stream;
    } catch (error) {
      lastError = error;
      if (!isRecordingDeviceSelectionError(error) || index === candidates.length - 1) {
        throw error;
      }
    }
  }

  throw lastError;
}

export function recorderMimeCandidates(kind: RecordingKind) {
  return MIME_CANDIDATES[kind];
}

export function createCompatibleMediaRecorder(stream: MediaStream, kind: RecordingKind) {
  for (const mimeType of MIME_CANDIDATES[kind]) {
    try {
      if (typeof MediaRecorder.isTypeSupported === "function" && !MediaRecorder.isTypeSupported(mimeType)) {
        continue;
      }
      return new MediaRecorder(stream, { mimeType });
    } catch {
      // Safari versions occasionally advertise a MIME that the constructor rejects.
    }
  }
  return new MediaRecorder(stream);
}

function baseMimeType(value: string | undefined) {
  return value?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function mimeMatchesKind(mimeType: string, kind: RecordingKind) {
  return kind === "audio" ? AUDIO_MIMES.has(mimeType) : VIDEO_MIMES.has(mimeType);
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

async function sniffRecordedMimeType(blob: Blob, kind: RecordingKind) {
  const bytes = new Uint8Array(await blob.slice(0, 64).arrayBuffer());
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    return kind === "audio" ? "audio/mp4" : "video/mp4";
  }
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return kind === "audio" ? "audio/webm" : "video/webm";
  }
  if (kind === "audio" && bytes.length >= 12) {
    if (ascii(bytes, 0, 4) === "OggS") return "audio/ogg";
    if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE") return "audio/wav";
    if (ascii(bytes, 0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) {
      return "audio/mpeg";
    }
  }
  return "";
}

export async function resolveRecordedMimeType(
  kind: RecordingKind,
  chunks: readonly Blob[],
  recorderMimeType: string,
) {
  const rawBlob = new Blob([...chunks]);
  const detected = await sniffRecordedMimeType(rawBlob, kind);
  if (detected) return detected;

  for (const declared of [...chunks.map((chunk) => chunk.type), recorderMimeType]) {
    const mimeType = baseMimeType(declared);
    if (mimeMatchesKind(mimeType, kind)) return mimeType;
  }
  return "";
}

export function recordingFileExtension(kind: RecordingKind, mimeType: string) {
  if (kind === "audio") {
    if (mimeType === "audio/mp4") return "m4a";
    if (mimeType === "audio/ogg") return "ogg";
    if (mimeType === "audio/mpeg") return "mp3";
    if (mimeType === "audio/wav") return "wav";
    return "webm";
  }
  return mimeType === "video/mp4" ? "mp4" : "webm";
}

export async function recordedFileFromChunks(
  kind: RecordingKind,
  chunks: readonly Blob[],
  recorderMimeType: string,
) {
  const size = chunks.reduce((total, chunk) => total + chunk.size, 0);
  if (!size) throw new Error("EMPTY_RECORDING");
  const mimeType = await resolveRecordedMimeType(kind, chunks, recorderMimeType);
  if (!mimeType) throw new Error("UNSUPPORTED_RECORDING_FORMAT");
  const extension = recordingFileExtension(kind, mimeType);
  const blob = new Blob([...chunks], { type: mimeType });
  return new File(
    [blob],
    `${kind === "audio" ? "voice" : "circle"}-${Date.now()}.${extension}`,
    { type: mimeType },
  );
}

export function recordingErrorMessage(
  error: unknown,
  kind: RecordingKind,
  permissionWasGranted: boolean,
) {
  const name = mediaErrorName(error);
  const devices = kind === "audio" ? "microphone" : "camera and microphone";

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return permissionWasGranted
      ? `The browser could not reopen the ${devices} after access was granted. Reselect the device or close other recording apps and try again.`
      : `Allow ${devices} access in your browser settings, then try again. You can upload a file instead.`;
  }
  if (name === "SecurityError") {
    return `The ${devices} are blocked for this site. Check browser and iOS privacy settings, then try again.`;
  }
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") {
    return `The ${devices} could not be opened. Close other camera or recording apps, then try again.`;
  }
  if (isRecordingDeviceSelectionError(error)) {
    return `The selected ${devices} are no longer available. Refresh or reselect the device and try again.`;
  }
  if (name === "NotSupportedError") {
    return "This browser cannot create a compatible recording. You can upload a file instead.";
  }
  return "Recording could not start on this device. Try another device or upload a file.";
}
