import type { MediaAsset } from "@/lib/models";

export function MediaGallery({ media }: { media: MediaAsset[] }) {
  if (!media.length) return null;
  const images = media.filter((asset) => asset.kind === "image");
  const messages = media.filter((asset) => asset.kind !== "image");

  return (
    <div className="mt-5 grid gap-3">
      {images.length ? (
        <div className={`grid gap-2 overflow-hidden rounded-2xl ${images.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {images.map((asset) => (
            <a key={asset.id} href={asset.public_url} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-xl bg-black/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.public_url}
                alt={asset.alt_text || "Media attached to this message"}
                className="max-h-[34rem] w-full object-cover transition duration-300 group-hover:scale-[1.015]"
                loading="lazy"
              />
            </a>
          ))}
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
              <figure key={asset.id} className="w-fit rounded-[1.4rem] border border-white/10 bg-black/25 p-3">
                <video
                  src={asset.public_url}
                  controls
                  playsInline
                  preload="metadata"
                  className="aspect-square w-48 rounded-full bg-black object-cover sm:w-56"
                  aria-label={asset.alt_text || "Circular video message"}
                />
                {asset.alt_text ? <figcaption className="mt-2 max-w-56 text-xs leading-5 text-white/55">{asset.alt_text}</figcaption> : null}
              </figure>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

