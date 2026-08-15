"use client";

import {
  CircleStop,
  ImagePlus,
  LoaderCircle,
  Mic,
  Send,
  Trash2,
  Video,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useWalletSession } from "@/components/providers/WalletSessionProvider";
import type { MediaKind } from "@/lib/models";
import { getBrowserSupabase } from "@/lib/supabase/browser";

interface DraftAttachment {
  id: string;
  file: File;
  kind: MediaKind;
  preview: string;
  alt: string;
}

interface ComposerProps {
  mode?: "post" | "comment";
  postId?: number;
  parentId?: number | null;
  compact?: boolean;
  onPublished?: (id: number) => void;
  onCancel?: () => void;
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

function supportedRecorderMime(kind: "audio" | "video_circle") {
  const candidates =
    kind === "audio"
      ? ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
      : ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) ?? "";
}

export function Composer({
  mode = "post",
  postId,
  parentId = null,
  compact = false,
  onPublished,
  onCancel,
}: ComposerProps) {
  const router = useRouter();
  const { authenticated, session, status: sessionStatus } = useWalletSession();
  const [nickname, setNickname] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("anything");
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [recording, setRecording] = useState<"audio" | "video_circle" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const attachmentsRef = useRef<DraftAttachment[]>([]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(
    () => () => {
      attachmentsRef.current.forEach((attachment) => URL.revokeObjectURL(attachment.preview));
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const appendFiles = (files: File[]) => {
    setError(null);
    setAttachments((current) => {
      const next = [...current];
      for (const file of files) {
        const kind = ACCEPTED_TYPES[file.type];
        if (!kind || file.size > MAX_BYTES) {
          setError("Use images, audio, or video files up to 15 MB.");
          continue;
        }
        if (next.length >= 4) {
          setError("You can attach up to four files.");
          break;
        }
        next.push({
          id: crypto.randomUUID(),
          file,
          kind,
          preview: URL.createObjectURL(file),
          alt: "",
        });
      }
      return next;
    });
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    appendFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
  };

  const startRecording = async (kind: "audio" | "video_circle") => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Recording is not supported in this browser. You can upload a file instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === "audio"
          ? { audio: true }
          : {
              audio: true,
              video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
            },
      );
      streamRef.current = stream;
      if (kind === "video_circle" && liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        await liveVideoRef.current.play();
      }
      chunksRef.current = [];
      const mimeType = supportedRecorderMime(kind);
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = (recorder.mimeType || (kind === "audio" ? "audio/webm" : "video/webm")).split(";")[0];
        const extension = type.includes("mp4") ? "mp4" : "webm";
        const blob = new Blob(chunksRef.current, { type });
        const file = new File([blob], `${kind === "audio" ? "voice" : "circle"}-${Date.now()}.${extension}`, {
          type,
        });
        appendFiles([file]);
        stopTracks();
        setRecording(null);
      };
      recorder.start(500);
      setRecording(kind);
    } catch (caught) {
      stopTracks();
      setRecording(null);
      setError(
        caught instanceof DOMException && caught.name === "NotAllowedError"
          ? "Camera or microphone access was not allowed. You can upload a file instead."
          : "Recording could not start on this device.",
      );
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const removeAttachment = (id: string) => {
    setAttachments((current) => {
      const target = current.find((attachment) => attachment.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return current.filter((attachment) => attachment.id !== id);
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authenticated || submitting) return;
    const effectiveNickname = (nickname ?? session?.profile?.display_name ?? "").trim();
    if (!effectiveNickname) {
      setError("Add a nickname.");
      return;
    }
    if (!body.trim() && attachments.length === 0) {
      setError("Write something or attach media.");
      return;
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
            })),
          }),
        });
        const signed = (await signResponse.json()) as {
          uploads?: Array<{ id: string; storagePath: string; token: string }>;
          error?: string;
        };
        if (!signResponse.ok || signed.uploads?.length !== attachments.length) {
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
      if (postId) formData.set("postId", String(postId));
      if (parentId) formData.set("parentId", String(parentId));

      const response = await fetch(mode === "post" ? "/api/posts" : "/api/comments", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { id?: number; error?: string };
      if (!response.ok || !payload.id) throw new Error(payload.error ?? "Publishing failed.");
      attachments.forEach((attachment) => URL.revokeObjectURL(attachment.preview));
      setAttachments([]);
      setBody("");
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
      aria-label={mode === "post" ? "Create a post" : parentId ? "Reply to comment" : "Write a comment"}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c9ff55]">
            {mode === "post" ? "Make an ask" : parentId ? "Reply" : "Join the thread"}
          </p>
          <h2 className={`${compact ? "mt-1 text-lg" : "mt-2 text-2xl sm:text-3xl"} font-semibold tracking-tight text-[#f2efe6]`}>
            {mode === "post" ? "What could the internet help with?" : "Say something useful—or funny."}
          </h2>
        </div>
        {mode === "post" ? (
          <span className="rounded-full border border-white/12 px-3 py-1 text-xs text-white/55">0% platform fee</span>
        ) : null}
      </div>

      {locked ? (
        <div className="rounded-xl border border-dashed border-[#c9ff55]/35 bg-[#c9ff55]/5 p-4 text-sm text-white/70">
          {sessionStatus === "signing"
            ? "Approve the signature in your wallet to continue. This costs no SOL."
            : "Connect your Solana wallet above to post, react, reply, and fund people."}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_13rem]">
            <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.13em] text-white/55">
              Nickname for this {mode}
              <input
                className="min-h-11 rounded-xl border border-white/12 bg-black/25 px-3 text-sm normal-case tracking-normal text-[#f2efe6] outline-none transition focus:border-[#c9ff55]/70 focus:ring-2 focus:ring-[#c9ff55]/15"
                value={effectiveNickname}
                maxLength={50}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="Anonymous nerd"
                required
              />
            </label>
            {mode === "post" ? (
              <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.13em] text-white/55">
                Category
                <select
                  className="min-h-11 rounded-xl border border-white/12 bg-[#151815] px-3 text-sm normal-case tracking-normal text-[#f2efe6] outline-none focus:border-[#c9ff55]/70"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  <option value="anything">Anything</option>
                  <option value="for-fun">For fun</option>
                  <option value="mutual-aid">Mutual aid</option>
                  <option value="build">Build</option>
                  <option value="animals">Animals</option>
                  <option value="art">Art</option>
                </select>
              </label>
            ) : null}
          </div>
          <label className="mt-4 grid gap-2 text-xs font-medium uppercase tracking-[0.13em] text-white/55">
            {mode === "post" ? "Your ask" : "Comment"}
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
              placeholder={mode === "post" ? "Tell people what you need, why it matters, or make them laugh…" : "Write a thoughtful reply…"}
            />
          </label>

          {recording === "video_circle" ? (
            <div className="mt-4 flex items-center gap-4 rounded-xl border border-[#ff8066]/35 bg-[#ff8066]/5 p-3">
              <video ref={liveVideoRef} muted playsInline className="size-24 rounded-full bg-black object-cover" />
              <div>
                <p className="font-medium text-[#f2efe6]">Recording a circle</p>
                <p className="mt-1 text-xs text-white/50">Nothing uploads until you publish.</p>
              </div>
            </div>
          ) : null}

          {attachments.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-start gap-3">
                    {attachment.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={attachment.preview} alt="Attachment preview" className="h-20 w-24 rounded-lg object-cover" />
                    ) : attachment.kind === "audio" ? (
                      <audio src={attachment.preview} controls className="w-full min-w-0" />
                    ) : (
                      <video src={attachment.preview} controls playsInline className="size-24 rounded-full bg-black object-cover" />
                    )}
                    <button
                      className="ml-auto rounded-lg p-2 text-white/45 transition hover:bg-white/8 hover:text-[#ff8066]"
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      aria-label="Remove attachment"
                    >
                      <Trash2 aria-hidden="true" size={16} />
                    </button>
                  </div>
                  <label className="mt-3 grid gap-1 text-[0.68rem] uppercase tracking-[0.12em] text-white/45">
                    {attachment.kind === "image" ? "Image description" : "Transcript or description"}
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
                      placeholder="Optional, helps everyone understand it"
                    />
                  </label>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/8 pt-4">
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              multiple
              accept="image/*,audio/*,video/mp4,video/webm,video/quicktime"
              onChange={handleFiles}
            />
            <button className="composer-tool" type="button" onClick={() => inputRef.current?.click()}>
              <ImagePlus aria-hidden="true" size={17} />
              Attach
            </button>
            {recording ? (
              <button className="composer-tool recording" type="button" onClick={stopRecording}>
                <CircleStop aria-hidden="true" size={17} />
                Stop recording
              </button>
            ) : (
              <>
                <button className="composer-tool" type="button" onClick={() => void startRecording("audio")}>
                  <Mic aria-hidden="true" size={17} />
                  Voice
                </button>
                <button className="composer-tool" type="button" onClick={() => void startRecording("video_circle")}>
                  <Video aria-hidden="true" size={17} />
                  Circle
                </button>
              </>
            )}
            <span className="ml-auto text-xs text-white/35">{body.length}/5000</span>
            {onCancel ? (
              <button className="button button-secondary" type="button" onClick={onCancel}>
                Cancel
              </button>
            ) : null}
            <button className="button button-accent" type="submit" disabled={submitting || Boolean(recording)}>
              {submitting ? <LoaderCircle className="spin" aria-hidden="true" size={17} /> : <Send aria-hidden="true" size={17} />}
              {submitting ? "Publishing" : mode === "post" ? "Publish ask" : "Post comment"}
            </button>
          </div>
        </>
      )}
      <div className="mt-3 min-h-5 text-sm" role="status" aria-live="polite">
        {error ? <p className="text-[#ff8066]">{error}</p> : null}
        {success ? <p className="text-[#c9ff55]">{success}</p> : null}
      </div>
    </form>
  );
}
