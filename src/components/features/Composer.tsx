"use client";

import { useI18n } from "@/components/providers/I18nProvider";

import {
  Camera,
  CircleStop,
  ImagePlus,
  LoaderCircle,
  Mic,
  RotateCcw,
  Send,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useWalletSession } from "@/components/providers/WalletSessionProvider";
import { FundingOptionsEditor } from "@/components/features/FundingOptionsEditor";
import { CategoryPicker } from "@/components/features/CategoryPicker";
import { VoiceMessagePlayer } from "@/components/features/media/VoiceMessagePlayer";
import { CircleVideoPlayer } from "@/components/features/media/CircleVideoPlayer";
import {
  normalizeFundingOptions,
  type FundingOptionInput,
} from "@/lib/funding/options";
import {
  isPostCategory,
  isPostLanguage,
  POST_LANGUAGES,
  POST_LANGUAGE_LABELS,
  type Category,
  type MediaKind,
  type PostCategory,
  type PostLanguage,
} from "@/lib/models";
import {
  createCompatibleMediaRecorder,
  isRecordingDeviceSelectionError,
  recordedFileFromChunks,
  recordingErrorMessage,
  requestRecordingStream,
  type RecordingKind,
} from "@/lib/media/recording";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { canReceiveSbp, type SbpSettings } from "@/lib/sbp";
import sbpStyles from "./SbpSettings.module.css";

interface DraftAttachment {
  id: string;
  file: File;
  kind: MediaKind;
  preview: string;
  alt: string;
  source: "upload" | "recording";
  duration?: number;
  width?: number;
  height?: number;
  compressed?: boolean;
}

interface ComposerProps {
  mode?: "post" | "comment";
  browsingCategory?: Category;
  postId?: number;
  parentId?: number | null;
  compact?: boolean;
  onPublished?: (id: number) => void;
  onCancel?: () => void;
}

interface ActiveRecordingAttempt {
  id: number;
  kind: RecordingKind;
  recorder: MediaRecorder;
  stream: MediaStream;
  timerId: number | null;
  discard: boolean;
  finalized: boolean;
  startedAt: number;
}

interface PreparedRecording {
  kind: RecordingKind;
  stream: MediaStream;
  audioDeviceId: string;
  videoDeviceId: string;
}

const ACCEPTED_TYPES: Record<string, MediaKind> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/gif": "image",
  "image/webp": "image",
  "image/avif": "image",
  "audio/webm": "audio",
  "audio/ogg": "audio",
  "audio/mpeg": "audio",
  "audio/mp4": "audio",
  "audio/wav": "audio",
  "video/webm": "video_circle",
  "video/mp4": "video_circle",
  "video/quicktime": "video_circle",
};

const MAX_BYTES = 15 * 1024 * 1024;
const AUDIO_RECORDING_LIMIT_SECONDS = 120;
const VIDEO_RECORDING_LIMIT_SECONDS = 60;

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function trackDeviceId(track: MediaStreamTrack | undefined) {
  try {
    return track?.getSettings().deviceId ?? "";
  } catch {
    return "";
  }
}

function uniqueInputDevices(devices: MediaDeviceInfo[], kind: MediaDeviceKind) {
  const seen = new Set<string>();
  return devices.filter((device) => {
    if (device.kind !== kind) return false;
    const key = `${device.deviceId}\u0000${device.groupId}\u0000${device.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function preparedStreamMatches(
  prepared: PreparedRecording,
  kind: RecordingKind,
  audioDeviceId: string,
  videoDeviceId: string,
) {
  if (prepared.kind !== kind) return false;
  if (!prepared.stream.getAudioTracks().some((track) => track.readyState === "live")) return false;
  if (
    kind === "video_circle" &&
    !prepared.stream.getVideoTracks().some((track) => track.readyState === "live")
  ) {
    return false;
  }
  if (audioDeviceId && audioDeviceId !== prepared.audioDeviceId) return false;
  if (kind === "video_circle" && videoDeviceId && videoDeviceId !== prepared.videoDeviceId) {
    return false;
  }
  return true;
}

export function Composer({
  mode = "post",
  browsingCategory = "anything",
  postId,
  parentId = null,
  compact = false,
  onPublished,
  onCancel,
}: ComposerProps) {
  const { t } = useI18n();
  const router = useRouter();
  const recordingSetupTitleId = useId();
  const mediaPreparationRef = useRef<AbortController | null>(null);
  const [preparingMedia, setPreparingMedia] = useState(false);
  const {
    authenticated,
    session,
    status: sessionStatus,
    invalidateSession,
  } = useWalletSession();
  const [nickname, setNickname] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [language, setLanguage] = useState<PostLanguage | "">("");
  const defaultCategory = isPostCategory(browsingCategory) ? browsingCategory : "other";
  const [categoryDraft, setCategoryDraft] = useState<{ scope: Category; value: PostCategory }>({
    scope: browsingCategory,
    value: defaultCategory,
  });
  // Adjust only this field when the board changes. Remounting the whole composer
  // would throw away the user's text, attachments, and recording state.
  if (categoryDraft.scope !== browsingCategory) {
    setCategoryDraft({ scope: browsingCategory, value: defaultCategory });
  }
  const category = categoryDraft.scope === browsingCategory ? categoryDraft.value : defaultCategory;
  const [fundingOptions, setFundingOptions] = useState<FundingOptionInput[]>([]);
  const [fundingOptionsLoading, setFundingOptionsLoading] = useState(false);
  const [sbpPreference, setSbpPreference] = useState<{ walletAddress: string; ready: boolean; error: boolean } | null>(null);
  const [sbpLoading, setSbpLoading] = useState(false);
  const [sbpReload, setSbpReload] = useState(0);
  const [includeSbpForWallet, setIncludeSbpForWallet] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [recording, setRecording] = useState<RecordingKind | null>(null);
  const [recordingSetup, setRecordingSetup] = useState<RecordingKind | null>(null);
  const [deviceSetupBusy, setDeviceSetupBusy] = useState(false);
  const [recordingStartBusy, setRecordingStartBusy] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioInputAvailable, setAudioInputAvailable] = useState(false);
  const [videoInputAvailable, setVideoInputAvailable] = useState(false);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState("");
  const [selectedVideoDevice, setSelectedVideoDevice] = useState("");
  const [retakeAttachmentId, setRetakeAttachmentId] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const attachmentsRef = useRef<DraftAttachment[]>([]);
  const mountedRef = useRef(true);
  const recordingAttemptSequence = useRef(0);
  const recordingStartInFlight = useRef(false);
  const activeRecordingRef = useRef<ActiveRecordingAttempt | null>(null);
  const preparedRecordingRef = useRef<PreparedRecording | null>(null);
  const grantedMediaRef = useRef({ audio: false, video: false });
  const fundingOptionsEditedRef = useRef(false);
  const sbpReady = Boolean(authenticated && session?.walletAddress && sbpPreference?.walletAddress === session.walletAddress && sbpPreference.ready);
  const includeSbp = Boolean(sbpReady && !sbpLoading && includeSbpForWallet === session?.walletAddress);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) setIncludeSbpForWallet(null);
    });
    if (mode !== "post" || !authenticated || !session?.walletAddress) return () => controller.abort();
    const walletAddress = session.walletAddress;
    queueMicrotask(() => {
      if (!controller.signal.aborted) setSbpLoading(true);
    });
    void fetch("/api/settings/sbp", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("SBP_SETTINGS_UNAVAILABLE");
        const settings = await response.json() as SbpSettings;
        if (!controller.signal.aborted) setSbpPreference({ walletAddress, ready: canReceiveSbp(settings), error: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setSbpPreference({ walletAddress, ready: false, error: true });
      })
      .finally(() => {
        if (!controller.signal.aborted) setSbpLoading(false);
      });
    return () => controller.abort();
  }, [authenticated, mode, session?.walletAddress, sbpReload]);

  useEffect(() => {
    if (mode !== "post" || !authenticated || !session?.walletAddress) return;
    const controller = new AbortController();
    fundingOptionsEditedRef.current = false;
    queueMicrotask(() => {
      if (!controller.signal.aborted) setFundingOptionsLoading(true);
    });
    void fetch(`/api/profiles/${encodeURIComponent(session.walletAddress)}/payouts`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as {
          options?: Array<{ asset?: unknown; address?: unknown }>;
        };
        if (fundingOptionsEditedRef.current) return;
        const candidates = (payload.options ?? [])
          .filter(
            (option): option is { asset: FundingOptionInput["asset"]; address: string } =>
              typeof option.asset === "string" && typeof option.address === "string",
          )
          .map((option) => ({ asset: option.asset, address: option.address }));
        try {
          setFundingOptions(normalizeFundingOptions(candidates));
        } catch {
          // Ignore stale or unsupported saved routes; server validation remains authoritative.
        }
      })
      .catch((caught: unknown) => {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          console.error("Unable to load saved funding routes", caught);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setFundingOptionsLoading(false);
      });
    return () => controller.abort();
  }, [authenticated, mode, session?.walletAddress]);

  const cleanupRecordingAttempt = useCallback((attempt: ActiveRecordingAttempt) => {
    if (attempt.timerId !== null) {
      window.clearInterval(attempt.timerId);
      attempt.timerId = null;
    }
    attempt.stream.getTracks().forEach((track) => track.stop());
    if (liveVideoRef.current?.srcObject === attempt.stream) {
      liveVideoRef.current.srcObject = null;
    }
    if (activeRecordingRef.current === attempt) activeRecordingRef.current = null;
  }, []);

  const cleanupPreparedRecording = useCallback(() => {
    const prepared = preparedRecordingRef.current;
    if (!prepared) return;
    prepared.stream.getTracks().forEach((track) => track.stop());
    preparedRecordingRef.current = null;
  }, []);

  const discardActiveRecording = useCallback(() => {
    const attempt = activeRecordingRef.current;
    if (!attempt) return;
    attempt.discard = true;
    attempt.finalized = true;
    attempt.recorder.ondataavailable = null;
    attempt.recorder.onerror = null;
    attempt.recorder.onstop = null;
    if (attempt.recorder.state !== "inactive") attempt.recorder.stop();
    cleanupRecordingAttempt(attempt);
  }, [cleanupRecordingAttempt]);

  const invalidatePendingRecordingStart = useCallback(() => {
    recordingAttemptSequence.current += 1;
    recordingStartInFlight.current = false;
    if (mountedRef.current) setRecordingStartBusy(false);
  }, []);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      mediaPreparationRef.current?.abort();
      invalidatePendingRecordingStart();
      attachmentsRef.current.forEach((attachment) => URL.revokeObjectURL(attachment.preview));
      cleanupPreparedRecording();
      discardActiveRecording();
    };
  }, [cleanupPreparedRecording, discardActiveRecording, invalidatePendingRecordingStart]);

  useEffect(() => {
    if (authenticated) return;
    invalidatePendingRecordingStart();
    cleanupPreparedRecording();
    discardActiveRecording();
    const resetTimer = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setRecording(null);
      setRecordingSeconds(0);
      setRecordingSetup(null);
      setRetakeAttachmentId(null);
    }, 0);
    return () => window.clearTimeout(resetTimer);
  }, [authenticated, cleanupPreparedRecording, discardActiveRecording, invalidatePendingRecordingStart]);

  useEffect(() => {
    const video = liveVideoRef.current;
    const attempt = activeRecordingRef.current;
    if (recording !== "video_circle" || !video || attempt?.kind !== "video_circle") return;
    video.srcObject = attempt.stream;
    void video.play().catch(() => {
      setError("The live camera preview could not play, but you can still finish the recording.");
    });
  }, [recording]);

  const appendFiles = (
    files: File[],
    source: DraftAttachment["source"] = "upload",
    replaceAttachmentId: string | null = null,
    timing: { duration?: number; width?: number; height?: number; compressed?: boolean } = {},
  ) => {
    setError(null);
    setAttachments((current) => {
      const next = [...current];
      let replacementId = replaceAttachmentId;
      for (const file of files) {
        const kind = ACCEPTED_TYPES[file.type];
        if (!kind || file.size > MAX_BYTES) {
          setError("Use images, audio, or video files up to 15 MB.");
          continue;
        }
        const replacementIndex = replacementId
          ? next.findIndex((attachment) => attachment.id === replacementId)
          : -1;
        if (replacementIndex < 0 && next.length >= 4) {
          setError("You can attach up to four files.");
          break;
        }
        const attachment: DraftAttachment = {
          id: crypto.randomUUID(),
          file,
          kind,
          preview: URL.createObjectURL(file),
          alt: "",
          source,
          ...timing,
        };
        if (replacementIndex >= 0) {
          URL.revokeObjectURL(next[replacementIndex].preview);
          attachment.alt = next[replacementIndex].alt;
          next[replacementIndex] = attachment;
          replacementId = null;
        } else {
          next.push(attachment);
        }
      }
      return next;
    });
  };

  const prepareFiles = async (files: File[], source: DraftAttachment["source"] = "upload", replaceAttachmentId: string | null = null, durationHint?: number) => {
    mediaPreparationRef.current?.abort();
    const controller = new AbortController();
    mediaPreparationRef.current = controller;
    setPreparingMedia(true);
    try {
      for (const file of files) {
        if (controller.signal.aborted) return;
        const kind = ACCEPTED_TYPES[file.type];
        if (!kind || kind === "image" || file.size > MAX_BYTES) { appendFiles([file], source, replaceAttachmentId); continue; }
        try {
          const { prepareMediaFile } = await import("@/lib/media/prepare");
          const result = await prepareMediaFile(file, kind, controller.signal);
          if (!mountedRef.current || controller.signal.aborted) return;
          appendFiles([result.file], source, replaceAttachmentId, { duration: result.duration ?? durationHint, width: result.width, height: result.height, compressed: result.compressed });
        } catch {
          if (mountedRef.current && !controller.signal.aborted) appendFiles([file], source, replaceAttachmentId, { duration: durationHint });
        }
        replaceAttachmentId = null;
      }
    } finally {
      if (mountedRef.current && mediaPreparationRef.current === controller) { setPreparingMedia(false); mediaPreparationRef.current = null; }
    }
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    void prepareFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const refreshRecordingDevices = useCallback(async (reportError = true) => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    setDeviceSetupBusy(true);
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (!mountedRef.current) return;
      const microphones = uniqueInputDevices(devices, "audioinput");
      const cameras = uniqueInputDevices(devices, "videoinput");
      const prepared = preparedRecordingRef.current;
      setAudioDevices(microphones);
      setVideoDevices(cameras);
      setAudioInputAvailable(
        microphones.length > 0 ||
        Boolean(prepared?.stream.getAudioTracks().some((track) => track.readyState === "live")),
      );
      setVideoInputAvailable(
        cameras.length > 0 ||
        Boolean(prepared?.stream.getVideoTracks().some((track) => track.readyState === "live")),
      );
      setSelectedAudioDevice((current) =>
        current && microphones.some((device) => device.deviceId === current) ? current : "",
      );
      setSelectedVideoDevice((current) =>
        current && cameras.some((device) => device.deviceId === current) ? current : "",
      );
    } catch {
      if (reportError && mountedRef.current) {
        setError("The device list could not be refreshed. You can still try the system default device.");
      }
    } finally {
      if (mountedRef.current) setDeviceSetupBusy(false);
    }
  }, []);

  const prepareRecording = async (
    kind: RecordingKind,
    replaceAttachmentId: string | null = null,
  ) => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Recording is not supported in this browser. You can upload a file instead.");
      return;
    }
    const setupId = recordingAttemptSequence.current + 1;
    recordingAttemptSequence.current = setupId;
    cleanupPreparedRecording();
    setRecordingSetup(kind);
    setRetakeAttachmentId(replaceAttachmentId);
    setDeviceSetupBusy(true);
    setAudioDevices([]);
    setVideoDevices([]);
    setAudioInputAvailable(false);
    setVideoInputAvailable(false);
    setSelectedAudioDevice("");
    setSelectedVideoDevice("");

    let permissionStream: MediaStream | null = null;
    try {
      permissionStream = await requestRecordingStream(navigator.mediaDevices, kind);
      if (!mountedRef.current || recordingAttemptSequence.current !== setupId) {
        permissionStream.getTracks().forEach((track) => track.stop());
        permissionStream = null;
        return;
      }
      grantedMediaRef.current.audio = true;
      if (kind === "video_circle") grantedMediaRef.current.video = true;

      let devices: MediaDeviceInfo[] = [];
      try {
        devices = await navigator.mediaDevices.enumerateDevices();
      } catch {
        // The granted stream is enough to record even when Safari withholds the device list.
      }
      if (!mountedRef.current || recordingAttemptSequence.current !== setupId) {
        permissionStream.getTracks().forEach((track) => track.stop());
        permissionStream = null;
        return;
      }

      const microphones = uniqueInputDevices(devices, "audioinput");
      const cameras = uniqueInputDevices(devices, "videoinput");
      const audioDeviceId = trackDeviceId(permissionStream.getAudioTracks()[0]);
      const videoDeviceId = trackDeviceId(permissionStream.getVideoTracks()[0]);
      setAudioDevices(microphones);
      setVideoDevices(cameras);
      setAudioInputAvailable(true);
      setVideoInputAvailable(kind === "video_circle");
      setSelectedAudioDevice(
        microphones.some((device) => device.deviceId === audioDeviceId) ? audioDeviceId : "",
      );
      setSelectedVideoDevice(
        cameras.some((device) => device.deviceId === videoDeviceId) ? videoDeviceId : "",
      );
      preparedRecordingRef.current = {
        kind,
        stream: permissionStream,
        audioDeviceId,
        videoDeviceId,
      };
      permissionStream = null;
    } catch (caught) {
      permissionStream?.getTracks().forEach((track) => track.stop());
      if (mountedRef.current && recordingAttemptSequence.current === setupId) {
        setRecordingSetup(null);
        setRetakeAttachmentId(null);
        setAudioInputAvailable(false);
        setVideoInputAvailable(false);
        setError(
          recordingErrorMessage(
            caught,
            kind,
            grantedMediaRef.current.audio &&
              (kind === "audio" || grantedMediaRef.current.video),
          ),
        );
      }
    } finally {
      if (mountedRef.current && recordingAttemptSequence.current === setupId) {
        setDeviceSetupBusy(false);
      }
    }
  };

  const startRecording = async (
    kind: RecordingKind,
    replaceAttachmentId: string | null = null,
  ) => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Recording is not supported in this browser. You can upload a file instead.");
      return;
    }
    if (recordingStartInFlight.current || activeRecordingRef.current) return;

    const attemptId = recordingAttemptSequence.current + 1;
    recordingAttemptSequence.current = attemptId;
    recordingStartInFlight.current = true;
    setRecordingStartBusy(true);
    let pendingStream: MediaStream | null = null;
    let activeAttempt: ActiveRecordingAttempt | null = null;

    try {
      const prepared = preparedRecordingRef.current;
      if (
        prepared &&
        preparedStreamMatches(
          prepared,
          kind,
          selectedAudioDevice,
          selectedVideoDevice,
        )
      ) {
        pendingStream = prepared.stream;
        preparedRecordingRef.current = null;
      } else {
        cleanupPreparedRecording();
        pendingStream = await requestRecordingStream(navigator.mediaDevices, kind, {
          audioDeviceId: selectedAudioDevice,
          videoDeviceId: selectedVideoDevice,
        });
      }
      if (
        !mountedRef.current ||
        recordingAttemptSequence.current !== attemptId ||
        activeRecordingRef.current
      ) {
        pendingStream.getTracks().forEach((track) => track.stop());
        pendingStream = null;
        return;
      }

      grantedMediaRef.current.audio = true;
      if (kind === "video_circle") grantedMediaRef.current.video = true;
      const recorder = createCompatibleMediaRecorder(pendingStream, kind);
      const chunks: Blob[] = [];
      const attempt: ActiveRecordingAttempt = {
        id: attemptId,
        kind,
        recorder,
        stream: pendingStream,
        timerId: null,
        discard: false,
        finalized: false,
        startedAt: 0,
      };
      activeAttempt = attempt;
      activeRecordingRef.current = attempt;
      pendingStream = null;

      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        if (attempt.finalized) return;
        attempt.finalized = true;
        const shouldKeepRecording =
          mountedRef.current &&
          !attempt.discard &&
          activeRecordingRef.current === attempt &&
          recordingAttemptSequence.current === attempt.id;
        cleanupRecordingAttempt(attempt);

        if (!shouldKeepRecording) return;
        const durationMs = Math.max(1, performance.now() - attempt.startedAt);
        void recordedFileFromChunks(kind, chunks, recorder.mimeType, durationMs)
          .then((file) => {
            if (
              !mountedRef.current ||
              recordingAttemptSequence.current !== attempt.id ||
              attempt.discard
            ) {
              return;
            }
            return prepareFiles([file], "recording", replaceAttachmentId, durationMs / 1000);
          })
          .catch((fileError: unknown) => {
            if (!mountedRef.current || recordingAttemptSequence.current !== attempt.id) return;
            setError(
              fileError instanceof Error && fileError.message === "EMPTY_RECORDING"
                ? "The recording was empty. Please try again."
                : "This browser created an unsupported recording format. Try again or upload a file.",
            );
          })
          .finally(() => {
            if (!mountedRef.current || recordingAttemptSequence.current !== attempt.id) return;
            setRecording(null);
            setRecordingSeconds(0);
            setRetakeAttachmentId(null);
          });
      };
      recorder.onerror = () => {
        if (attempt.finalized) return;
        attempt.finalized = true;
        attempt.discard = true;
        const shouldReport = mountedRef.current && activeRecordingRef.current === attempt;
        cleanupRecordingAttempt(attempt);
        if (!shouldReport) return;
        setRecording(null);
        setRecordingSeconds(0);
        setRetakeAttachmentId(null);
        setError("Recording stopped unexpectedly. Please try again or upload a file.");
      };
      // A single final chunk produces substantially more reliable MP4 metadata on iOS.
      recorder.start();
      attempt.startedAt = performance.now();
      setRecordingSetup(null);
      setRecording(kind);
      setRecordingSeconds(0);
      const startedAt = Date.now();
      const limit = kind === "audio" ? AUDIO_RECORDING_LIMIT_SECONDS : VIDEO_RECORDING_LIMIT_SECONDS;
      attempt.timerId = window.setInterval(() => {
        const elapsed = Math.min(limit, Math.floor((Date.now() - startedAt) / 1_000));
        if (mountedRef.current && activeRecordingRef.current === attempt) {
          setRecordingSeconds(elapsed);
        }
        if (elapsed >= limit && recorder.state === "recording") recorder.stop();
      }, 250);
    } catch (caught) {
      pendingStream?.getTracks().forEach((track) => track.stop());
      if (activeAttempt) {
        activeAttempt.discard = true;
        activeAttempt.finalized = true;
        activeAttempt.recorder.ondataavailable = null;
        activeAttempt.recorder.onerror = null;
        activeAttempt.recorder.onstop = null;
        if (activeAttempt.recorder.state !== "inactive") activeAttempt.recorder.stop();
        cleanupRecordingAttempt(activeAttempt);
      }
      if (mountedRef.current && recordingAttemptSequence.current === attemptId) {
        setRecording(null);
        if (isRecordingDeviceSelectionError(caught)) {
          void refreshRecordingDevices(false);
        }
        setError(
          recordingErrorMessage(
            caught,
            kind,
            grantedMediaRef.current.audio &&
              (kind === "audio" || grantedMediaRef.current.video),
          ),
        );
      }
    } finally {
      if (recordingAttemptSequence.current === attemptId) {
        recordingStartInFlight.current = false;
        if (mountedRef.current) setRecordingStartBusy(false);
      }
    }
  };

  const stopRecording = () => {
    const attempt = activeRecordingRef.current;
    if (attempt?.recorder.state === "recording") attempt.recorder.stop();
  };

  const removeAttachment = (id: string) => {
    if (retakeAttachmentId === id) {
      if (!activeRecordingRef.current) invalidatePendingRecordingStart();
      cleanupPreparedRecording();
      setRecordingSetup(null);
      setRetakeAttachmentId(null);
    }
    setAttachments((current) => {
      const target = current.find((attachment) => attachment.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return current.filter((attachment) => attachment.id !== id);
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authenticated || submitting || preparingMedia) return;
    if (recording || recordingSetup) {
      setError("Finish or cancel the recording before publishing.");
      return;
    }
    const effectiveNickname = (nickname ?? session?.profile?.display_name ?? "").trim();
    if (!effectiveNickname) {
      setError("Add a nickname.");
      return;
    }
    if (!body.trim() && attachments.length === 0) {
      setError("Write something or attach media.");
      return;
    }

    let normalizedFundingOptions: FundingOptionInput[] = [];
    if (mode === "post") {
      if (fundingOptions.length === 0 && !includeSbp) {
        setError("Choose at least one crypto funding destination or include your configured experimental SBP option.");
        return;
      }
      try {
        normalizedFundingOptions = normalizeFundingOptions(fundingOptions);
      } catch (caught) {
        setError(
          caught instanceof Error && caught.message === "INVALID_FUNDING_ADDRESS"
            ? "Check the mainnet address for every selected funding option."
            : "Choose each funding asset only once and check its destination.",
        );
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    let mediaIds: string[] = [];
    try {
      if (attachments.length) {
        const signResponse = await fetch("/api/media/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope: mode === "post" ? "posts" : "comments",
            files: attachments.map((attachment) => ({
              name: attachment.file.name,
              type: attachment.file.type,
              size: attachment.file.size,
              kind: attachment.kind,
              alt: attachment.alt.trim(),
              duration: attachment.duration,
              width: attachment.width,
              height: attachment.height,
            })),
          }),
        });
        const signed = (await signResponse.json()) as {
          uploads?: Array<{ id: string; storagePath: string; token: string }>;
          error?: string;
        };
        if (!signResponse.ok || signed.uploads?.length !== attachments.length) {
          if (signResponse.status === 401) invalidateSession();
          throw new Error(signed.error ?? "The upload could not be prepared.");
        }

        mediaIds = signed.uploads.map((upload) => upload.id);
        const storage = getBrowserSupabase().storage.from("media");
        for (const [index, upload] of signed.uploads.entries()) {
          const attachment = attachments[index];
          const { error: uploadError } = await storage.uploadToSignedUrl(
            upload.storagePath,
            upload.token,
            attachment.file,
            { contentType: attachment.file.type, cacheControl: "31536000" },
          );
          if (uploadError) throw uploadError;
        }
      }

      const formData = new FormData();
      formData.set("nickname", effectiveNickname);
      formData.set("body", body.trim());
      formData.set("category", category);
      formData.set("mediaIds", JSON.stringify(mediaIds));
      if (mode === "post") {
        formData.set("language", language);
        formData.set("fundingOptions", JSON.stringify(normalizedFundingOptions));
        formData.set("includeSbp", includeSbp ? "true" : "false");
      }
      if (postId) formData.set("postId", String(postId));
      if (parentId) formData.set("parentId", String(parentId));

      const response = await fetch(mode === "post" ? "/api/posts" : "/api/comments", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { id?: number; error?: string };
      if (!response.ok || !payload.id) {
        if (response.status === 401) invalidateSession();
        throw new Error(payload.error ?? "Publishing failed.");
      }
      attachments.forEach((attachment) => URL.revokeObjectURL(attachment.preview));
      setAttachments([]);
      setBody("");
      if (mode === "post") {
        setLanguage("");
        setCategoryDraft({ scope: browsingCategory, value: defaultCategory });
        setIncludeSbpForWallet(null);
      }
      setSuccess(mode === "post" ? "Your ask is live." : "Comment posted.");
      onPublished?.(payload.id);
      router.refresh();
    } catch (caught) {
      if (mediaIds.length) {
        void fetch("/api/media/sign", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaIds }),
        });
      }
      setError(caught instanceof Error ? caught.message : "Publishing failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const locked = !authenticated;
  const effectiveNickname = nickname ?? session?.profile?.display_name ?? "";
  return (
    <form
      className={`rounded-[1.4rem] border border-white/12 bg-[#121412] ${compact ? "p-4" : "p-5 sm:p-7"}`}
      onSubmit={submit}
      aria-label={mode === "post" ? t("Create a post") : parentId ? t("Reply to comment") : t("Write a comment")}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c9ff55]">
            {mode === "post" ? t("Make an ask") : parentId ? t("Reply") : t("Join the thread")}
          </p>
          <h2 className={`${compact ? "mt-1 text-lg" : "mt-2 text-2xl sm:text-3xl"} font-semibold tracking-tight text-[#f2efe6]`}>
            {mode === "post" ? t("What could the internet help with?") : t("Say something useful—or funny.")}
          </h2>
        </div>
        {mode === "post" ? (
          <span className="rounded-full border border-white/12 px-3 py-1 text-xs text-white/55">{t("0% platform fee")}</span>
        ) : null}
      </div>

      {locked ? (
        <div className="rounded-xl border border-dashed border-[#c9ff55]/35 bg-[#c9ff55]/5 p-4 text-sm text-white/70">
          {sessionStatus === "signing" ? t("Finish signing in to continue.") : t("Sign in above to post, react, reply, and fund people across supported networks.")}
        </div>
      ) : (
        <>
          <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_13rem]">
            <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.13em] text-white/55">
              {mode === "post" ? t("Nickname for this post") : t("Nickname for this comment")}
              <input
                className="min-h-11 rounded-xl border border-white/12 bg-black/25 px-3 text-sm normal-case tracking-normal text-[#f2efe6] outline-none transition focus:border-[#c9ff55]/70 focus:ring-2 focus:ring-[#c9ff55]/15"
                value={effectiveNickname}
                maxLength={50}
                onChange={(event) => setNickname(event.target.value)}
                placeholder={t("Anonymous nerd")}
                required
              />
            </label>
            {mode === "post" ? (
              <CategoryPicker
                key={browsingCategory}
                value={category}
                disabled={submitting}
                onChange={(value) => setCategoryDraft({ scope: browsingCategory, value })}
              />
            ) : null}
          </div>
          {mode === "post" ? (
            <label className="mt-4 grid gap-2 text-xs font-medium uppercase tracking-[0.13em] text-white/55">
              {t("Post language (optional)")}<select
                className="feed-select w-full sm:max-w-xs"
                value={language}
                disabled={submitting}
                onChange={(event) => setLanguage(isPostLanguage(event.target.value) ? event.target.value : "")}
              >
                <option value="">{t("Not specified")}</option>
                {POST_LANGUAGES.map((value) => (
                  <option key={value} value={value}>{POST_LANGUAGE_LABELS[value]}</option>
                ))}
              </select>
              <span className="text-xs font-normal normal-case tracking-normal text-white/40">
                {t("Helps readers filter posts. It does not translate your post or change the interface language.")}</span>
            </label>
          ) : null}
          <label className="mt-4 grid gap-2 text-xs font-medium uppercase tracking-[0.13em] text-white/55">
            {mode === "post" ? t("Your ask") : t("Comment")}
            <textarea
              className={`${compact ? "min-h-24" : "min-h-32"} resize-y rounded-xl border border-white/12 bg-black/25 p-4 text-[0.98rem] leading-7 normal-case tracking-normal text-[#f2efe6] outline-none transition placeholder:text-white/25 focus:border-[#c9ff55]/70 focus:ring-2 focus:ring-[#c9ff55]/15`}
              value={body}
              maxLength={5000}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={mode === "post" ? t("Tell people what you need, why it matters, or make them laugh…") : t("Write a thoughtful reply…")}
            />
          </label>

          {mode === "post" ? (
            fundingOptionsLoading ? (
              <p className="mt-4 flex items-center gap-2 rounded-xl border border-white/8 bg-black/15 px-4 py-3 text-xs text-white/45">
                <LoaderCircle className="spin" aria-hidden="true" size={15} /> {t("Loading your saved funding destinations…")}</p>
            ) : (
              <FundingOptionsEditor
                value={fundingOptions}
                disabled={submitting}
                allowEmpty={includeSbp}
                onChange={(next) => {
                  fundingOptionsEditedRef.current = true;
                  setFundingOptions(next);
                }}
              />
            )
          ) : null}

          {mode === "post" ? (
            <section className={sbpStyles.composer} aria-label={t("Optional experimental SBP funding")}>
              <label className={sbpStyles.composerChoice}>
                <input
                  type="checkbox"
                  checked={includeSbp}
                  disabled={submitting || sbpLoading || !sbpReady}
                  onChange={(event) => setIncludeSbpForWallet(event.target.checked ? session?.walletAddress ?? null : null)}
                />
                <span>{t("Include experimental SBP for this post")}<small>{t("Optional, never added automatically. Your saved number and banks can be revealed only by signed-in people who also enable SBP. They can copy or share those details.")}</small>
                </span>
              </label>
              {sbpLoading ? (
                <p className={sbpStyles.composerHint} role="status"><LoaderCircle className="spin" size={14} aria-hidden="true" /> {t("Checking your SBP preferences…")}</p>
              ) : (
                <div className={sbpStyles.composerHint}>
                  <span>{sbpPreference?.walletAddress === session?.walletAddress && sbpPreference?.error ? t("SBP preferences could not be loaded.") : sbpReady ? t("Bank fees may apply. SBP is not counted in verified donation totals.") : t("To receive via SBP, enable it and save a phone number and receiving bank.")}</span>
                  <Link href="/settings" target="_blank" rel="noopener noreferrer" aria-label={t("Open funding settings in a new tab")}>{t("Funding settings ↗")}</Link>
                  <button type="button" className="underline underline-offset-2" disabled={submitting} onClick={() => setSbpReload((value) => value + 1)}>{t("Refresh")}</button>
                </div>
              )}
            </section>
          ) : null}

          {recordingSetup ? (
            <section
              className="mt-4 rounded-xl border border-[#c9ff55]/25 bg-[#c9ff55]/5 p-4"
              aria-labelledby={recordingSetupTitleId}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p id={recordingSetupTitleId} className="font-medium text-[#f2efe6]">
                    {retakeAttachmentId
                      ? recordingSetup === "audio" ? t("Retake voice message") : t("Retake circle video")
                      : recordingSetup === "audio" ? t("Set up voice message") : t("Set up circle video")}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/55">
                    {t("Your recording device stays active only while setup is open. Preview and replay the result before publishing; nothing uploads until you publish.")}</p>
                </div>
                <button
                  className="rounded-lg p-2 text-white/45 transition hover:bg-white/8 hover:text-white"
                  type="button"
                  onClick={() => {
                    invalidatePendingRecordingStart();
                    cleanupPreparedRecording();
                    setRecordingSetup(null);
                    setRetakeAttachmentId(null);
                    setError(null);
                  }}
                  aria-label={t("Cancel recording setup")}
                >
                  <X aria-hidden="true" size={17} />
                </button>
              </div>

              {deviceSetupBusy ? (
                <p className="mt-4 flex items-center gap-2 text-sm text-white/65" role="status">
                  <LoaderCircle className="spin" aria-hidden="true" size={17} /> {t("Detecting available devices…")}</p>
              ) : (
                <>
                  <div className={`mt-4 grid gap-3 ${recordingSetup === "video_circle" ? "sm:grid-cols-2" : ""}`}>
                    {recordingSetup === "video_circle" ? (
                      <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.12em] text-white/55">
                        {t("Camera")}<select
                          className="min-h-11 rounded-xl border border-white/12 bg-[#151815] px-3 text-sm normal-case tracking-normal text-[#f2efe6] outline-none focus:border-[#c9ff55]/70"
                          value={selectedVideoDevice}
                          onChange={(event) => setSelectedVideoDevice(event.target.value)}
                        >
                          <option value="">{t("System default camera (front preferred)")}</option>
                          {videoDevices.map((device, index) => (
                            <option
                              key={`${device.deviceId || "default"}-${device.groupId || index}-${index}`}
                              value={device.deviceId}
                            >
                              {device.label || t("Camera {value0}", { value0: index + 1 })}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.12em] text-white/55">
                      {t("Microphone")}<select
                        className="min-h-11 rounded-xl border border-white/12 bg-[#151815] px-3 text-sm normal-case tracking-normal text-[#f2efe6] outline-none focus:border-[#c9ff55]/70"
                        value={selectedAudioDevice}
                        onChange={(event) => setSelectedAudioDevice(event.target.value)}
                      >
                        <option value="">{t("System default microphone")}</option>
                        {audioDevices.map((device, index) => (
                          <option
                            key={`${device.deviceId || "default"}-${device.groupId || index}-${index}`}
                            value={device.deviceId}
                          >
                            {device.label || t("Microphone {value0}", { value0: index + 1 })}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {recordingSetup === "video_circle" ? (
                    <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-white/50">
                      <Camera className="mt-0.5 shrink-0" aria-hidden="true" size={14} />
                      {t("The granted camera is reused by default. Choose another camera here when you want to switch front, back, or external devices.")}</p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="button button-accent"
                      type="button"
                      disabled={
                        recordingStartBusy ||
                        !audioInputAvailable ||
                        (recordingSetup === "video_circle" && !videoInputAvailable)
                      }
                      onClick={() => void startRecording(recordingSetup, retakeAttachmentId)}
                    >
                      {recordingStartBusy ? (
                        <LoaderCircle className="spin" aria-hidden="true" size={17} />
                      ) : recordingSetup === "audio" ? (
                        <Mic aria-hidden="true" size={17} />
                      ) : (
                        <Video aria-hidden="true" size={17} />
                      )}
                      {recordingStartBusy ? t("Starting…") : t("Start recording")}
                    </button>
                    <button
                      className="button button-secondary"
                      type="button"
                      disabled={deviceSetupBusy || recordingStartBusy}
                      onClick={() => void refreshRecordingDevices()}
                    >
                      <RotateCcw aria-hidden="true" size={16} /> {t("Refresh devices")}</button>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => {
                        invalidatePendingRecordingStart();
                        cleanupPreparedRecording();
                        setRecordingSetup(null);
                        setRetakeAttachmentId(null);
                        setError(null);
                      }}
                    >
                      {t("Cancel")}</button>
                  </div>
                </>
              )}
            </section>
          ) : null}

          {recording ? (
            <section className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-[#ff8066]/35 bg-[#ff8066]/5 p-3" aria-label={recording === "audio" ? t("Voice recording in progress") : t("Circle video recording in progress")}>
              {recording === "video_circle" ? (
                <video ref={liveVideoRef} muted playsInline className="size-24 shrink-0 rounded-full bg-black object-cover" aria-label={t("Live camera preview")} />
              ) : (
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#ff8066]/12 text-[#ff8066]">
                  <Mic aria-hidden="true" size={22} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[#f2efe6]">{recording === "audio" ? t("Recording voice message") : t("Recording circle video")}</p>
                <p className="mt-1 text-xs text-white/50">
                  {formatDuration(recordingSeconds)} / {formatDuration(recording === "audio" ? AUDIO_RECORDING_LIMIT_SECONDS : VIDEO_RECORDING_LIMIT_SECONDS)} {t("· Nothing uploads until you publish.")}</p>
              </div>
              <button className="composer-tool recording" type="button" onClick={stopRecording}>
                <CircleStop aria-hidden="true" size={17} /> {t("Stop & preview")}</button>
            </section>
          ) : null}

          {attachments.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      {attachment.kind === "image" ? (
                        <div className="media-thumbnail-box flex items-center justify-center overflow-hidden rounded-lg bg-black/30">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={attachment.preview}
                            alt={t("Attachment preview")}
                            className="h-auto w-auto object-contain"
                          />
                        </div>
                      ) : attachment.kind === "audio" ? (
                        <VoiceMessagePlayer
                          src={attachment.preview}
                          durationHint={attachment.duration}
                          label={attachment.source === "recording" ? t("Voice recording preview") : t("Audio attachment preview")}
                        />
                      ) : (
                        <CircleVideoPlayer
                          src={attachment.preview}
                          durationHint={attachment.duration}
                          label={attachment.source === "recording" ? t("Circle video preview") : t("Video attachment preview")}
                        />
                      )}
                    </div>
                    <button
                      className="ml-auto rounded-lg p-2 text-white/45 transition hover:bg-white/8 hover:text-[#ff8066]"
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      aria-label={t("Remove attachment")}
                    >
                      <Trash2 aria-hidden="true" size={16} />
                    </button>
                  </div>
                  {attachment.source === "recording" ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#c9ff55]/18 bg-[#c9ff55]/5 p-2.5">
                      <p className="text-xs leading-5 text-white/60">
                        {attachment.kind === "audio" ? t("Voice recording ready · replay it above before publishing.") : t("Circle video ready · replay it above before publishing.")}</p>
                      <button
                        className="composer-tool"
                        type="button"
                        disabled={
                          Boolean(recording || recordingSetup) ||
                          preparingMedia ||
                          submitting ||
                          deviceSetupBusy ||
                          recordingStartBusy
                        }
                        onClick={() => void prepareRecording(
                          attachment.kind === "audio" ? "audio" : "video_circle",
                          attachment.id,
                        )}
                      >
                        <RotateCcw aria-hidden="true" size={15} /> {t("Retake")}</button>
                    </div>
                  ) : null}
                  {attachment.compressed ? <p className="mt-2 text-xs text-[#c9ff55]">{t("Compressed locally for faster uploads")}</p> : null}
                  <label className="mt-3 grid gap-1 text-[0.68rem] uppercase tracking-[0.12em] text-white/45">
                    {attachment.kind === "image" ? t("Image description") : t("Transcript or description")}
                    <input
                      className="rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-xs normal-case tracking-normal text-white outline-none focus:border-[#c9ff55]/60"
                      value={attachment.alt}
                      maxLength={500}
                      onChange={(event) =>
                        setAttachments((current) =>
                          current.map((item) =>
                            item.id === attachment.id ? { ...item, alt: event.target.value } : item,
                          ),
                        )
                      }
                      placeholder={t("Optional, helps everyone understand it")}
                    />
                  </label>
                </div>
              ))}
            </div>
          ) : null}

          {preparingMedia ? <p className="mt-3 flex items-center gap-2 text-xs text-white/60" role="status"><LoaderCircle size={16} className="media-player__spinner" aria-hidden="true" />{t("Preparing attachments…")}</p> : null}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/8 pt-4">
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              multiple
              accept="image/*,audio/*,video/mp4,video/webm,video/quicktime"
              onChange={handleFiles}
            />
            <button
              className="composer-tool"
              type="button"
              disabled={
                Boolean(recording || recordingSetup) ||
                deviceSetupBusy ||
                recordingStartBusy ||
                preparingMedia ||
                submitting ||
                attachments.length >= 4
              }
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus aria-hidden="true" size={17} />
              {t("Attach")}</button>
            {recording ? (
              <button className="composer-tool recording" type="button" onClick={stopRecording}>
                <CircleStop aria-hidden="true" size={17} />
                {t("Stop ·")}{" "}{formatDuration(recordingSeconds)} / {formatDuration(
                  recording === "audio" ? AUDIO_RECORDING_LIMIT_SECONDS : VIDEO_RECORDING_LIMIT_SECONDS,
                )}
              </button>
            ) : (
              <>
                <button
                  className="composer-tool"
                  type="button"
                  disabled={
                    Boolean(recordingSetup) ||
                    deviceSetupBusy ||
                    recordingStartBusy ||
                    preparingMedia ||
                    submitting ||
                    attachments.length >= 4
                  }
                  onClick={() => void prepareRecording("audio")}
                >
                  <Mic aria-hidden="true" size={17} />
                  {t("Voice")}</button>
                <button
                  className="composer-tool"
                  type="button"
                  disabled={
                    Boolean(recordingSetup) ||
                    deviceSetupBusy ||
                    recordingStartBusy ||
                    preparingMedia ||
                    submitting ||
                    attachments.length >= 4
                  }
                  onClick={() => void prepareRecording("video_circle")}
                >
                  <Video aria-hidden="true" size={17} />
                  {t("Circle")}</button>
              </>
            )}
            <span className="ml-auto text-xs text-white/35">{body.length}/5000</span>
            {onCancel ? (
              <button className="button button-secondary" type="button" onClick={onCancel}>
                {t("Cancel")}</button>
            ) : null}
            <button
              className="button button-accent"
              type="submit"
              disabled={
                submitting ||
                preparingMedia ||
                Boolean(recording || recordingSetup) ||
                deviceSetupBusy ||
                recordingStartBusy
              }
            >
              {submitting ? <LoaderCircle className="spin" aria-hidden="true" size={17} /> : <Send aria-hidden="true" size={17} />}
              {submitting ? t("Publishing") : mode === "post" ? t("Publish ask") : t("Post comment")}
            </button>
          </div>
        </>
      )}
      <div className="mt-3 min-h-5 text-sm" role="status" aria-live="polite">
        {error ? <p className="text-[#ff8066]">{t(error)}</p> : null}
        {success ? <p className="text-[#c9ff55]">{t(success)}</p> : null}
      </div>
    </form>
  );
}
