"use client";

import { Check, Download, Share2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { MediaAsset } from "@/lib/models";

type ShareStatus = "idle" | "shared" | "copied" | "unavailable";

function imageFilename(asset: MediaAsset) {
  const extension = asset.mime_type.split("/")[1]?.replace("jpeg", "jpg") ?? "image";
  return `money-nerds-${asset.id}.${extension}`;
}

export function MediaGallery({ media }: { media: MediaAsset[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previewTitleId = useId();
  const previewDescriptionId = useId();
  const [activeImage, setActiveImage] = useState<MediaAsset | null>(null);
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const images = media.filter((asset) => asset.kind === "image");
  const messages = media.filter((asset) => asset.kind !== "image");

  useEffect(() => {
    if (!activeImage || dialogRef.current?.open) return;
    dialogRef.current?.showModal();
  }, [activeImage]);

  if (!media.length) return null;

  const closePreview = () => {
    dialogRef.current?.close();
  };

  const shareImage = async () => {
    if (!activeImage) return;
    const url = new URL(activeImage.public_url, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Image on Money Nerds",
          text: activeImage.alt_text || undefined,
          url,
        });
        setShareStatus("shared");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setShareStatus("copied");
      } else {
        setShareStatus("unavailable");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setShareStatus("unavailable");
      }
    }
  };

  return (
    <div className="mt-5 grid gap-3">
      {images.length ? (
        <div className="flex flex-wrap items-start gap-3" aria-label="Attached images">
          {images.map((asset) => {
            const description = asset.alt_text || "Media attached to this message";
            return (
              <button
                key={asset.id}
                type="button"
                className="media-thumbnail-box group flex items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/30 transition hover:border-[#c9ff55]/45"
                onClick={() => {
                  setShareStatus("idle");
                  setActiveImage(asset);
                }}
                aria-haspopup="dialog"
                aria-label={`Open full-size image: ${description}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.public_url}
                  alt={description}
                  width={asset.width ?? undefined}
                  height={asset.height ?? undefined}
                  className="h-auto w-auto object-contain"
                  loading="lazy"
                />
              </button>
            );
          })}
        </div>
      ) : null}
      {messages.length ? (
        <div className="flex flex-wrap gap-3">
          {messages.map((asset) =>
            asset.kind === "audio" ? (
              <figure key={asset.id} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 p-3">
                <figcaption className="mb-2 text-xs uppercase tracking-[0.12em] text-white/45">Voice message</figcaption>
                <audio controls preload="metadata" className="w-full" aria-label={asset.alt_text || "Voice message"}>
                  <source src={asset.public_url} type={asset.mime_type} />
                </audio>
                {asset.alt_text ? <p className="mt-2 text-xs leading-5 text-white/55">{asset.alt_text}</p> : null}
              </figure>
            ) : (
              <figure key={asset.id} className="w-fit max-w-full rounded-[1.4rem] border border-white/10 bg-black/25 p-3">
                <video
                  src={asset.public_url}
                  controls
                  playsInline
                  preload="metadata"
                  className="aspect-square w-48 max-w-full rounded-full bg-black object-cover sm:w-56"
                  aria-label={asset.alt_text || "Circular video message"}
                />
                {asset.alt_text ? <figcaption className="mt-2 max-w-56 text-xs leading-5 text-white/55">{asset.alt_text}</figcaption> : null}
              </figure>
            ),
          )}
        </div>
      ) : null}

      <dialog
        ref={dialogRef}
        className="media-preview-dialog"
        aria-labelledby={previewTitleId}
        aria-describedby={previewDescriptionId}
        onCancel={(event) => {
          event.preventDefault();
          closePreview();
        }}
        onClose={() => {
          setActiveImage(null);
          setShareStatus("idle");
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closePreview();
        }}
      >
        {activeImage ? (
          <div className="media-preview-dialog__inner">
            <div className="flex items-start justify-between gap-4 px-4 pb-3 pt-4 sm:px-5">
              <div className="min-w-0">
                <h2 id={previewTitleId} className="font-semibold text-[#f2efe6]">Full-size image</h2>
                <p id={previewDescriptionId} className="mt-1 truncate text-xs text-white/50">
                  {activeImage.alt_text || "Image attached to this message"}
                </p>
              </div>
              <button className="post-action shrink-0" type="button" onClick={closePreview} aria-label="Close image preview">
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <div className="media-preview-dialog__canvas">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeImage.public_url}
                alt={activeImage.alt_text || "Media attached to this message"}
                width={activeImage.width ?? undefined}
                height={activeImage.height ?? undefined}
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 px-4 py-4 sm:px-5">
              <button className="button button-secondary" type="button" onClick={() => void shareImage()}>
                {shareStatus === "shared" || shareStatus === "copied" ? (
                  <Check aria-hidden="true" size={17} />
                ) : (
                  <Share2 aria-hidden="true" size={17} />
                )}
                {shareStatus === "shared"
                  ? "Shared"
                  : shareStatus === "copied"
                    ? "Link copied"
                    : "Share"}
              </button>
              <a
                className="button button-accent"
                href={activeImage.public_url}
                download={imageFilename(activeImage)}
                aria-label="Save full-size image"
              >
                <Download aria-hidden="true" size={17} /> Save
              </a>
              <p className="min-h-5 flex-1 text-right text-xs text-white/45" role="status" aria-live="polite">
                {shareStatus === "unavailable" ? "Sharing is unavailable. You can save the image instead." : ""}
              </p>
            </div>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
