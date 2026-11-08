"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { addListingImage, makeCoverImage, removeListingImage } from "@/app/actions/listings";
import { LISTING_IMAGE_BUCKET, listingImageUrl } from "@/lib/images";

const MAX_PHOTOS = 12;
const MAX_EDGE = 1800;

/** Downscale + re-encode phone photos in the browser (also strips EXIF/GPS metadata). */
async function compress(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process image"))), "image/jpeg", 0.85),
  );
  return { blob, width, height };
}

export function PhotoManager({
  userId,
  listingId,
  images,
  locked,
}: {
  userId: string;
  listingId: string;
  images: { id: string; storage_path: string }[];
  locked: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  async function upload(files: FileList) {
    setError(null);
    const list = Array.from(files).slice(0, MAX_PHOTOS - images.length);
    const supabase = createClient();
    for (const [i, file] of list.entries()) {
      setBusy(`Uploading ${i + 1} of ${list.length}…`);
      try {
        if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image`);
        const { blob, width, height } = await compress(file);
        const path = `${userId}/${listingId}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage.from(LISTING_IMAGE_BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
        if (upErr) throw upErr;
        const res = await addListingImage(listingId, path, width, height);
        if (!res.ok) throw new Error(res.error);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      }
    }
    setBusy(null);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {images.map((img, i) => (
          <div key={img.id} className="group relative aspect-square overflow-hidden rounded-lg bg-ice">
            <Image src={listingImageUrl(img.storage_path)!} alt={`Photo ${i + 1}`} fill sizes="160px" className="object-cover" />
            {i === 0 && <span className="badge absolute top-1 left-1 bg-ink text-white">Cover</span>}
            {!locked && (
              <div className="absolute inset-x-1 bottom-1 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                {i > 0 && (
                  <button type="button" className="btn-secondary btn-sm flex-1" onClick={() => start(async () => { await makeCoverImage(listingId, img.id); router.refresh(); })}>
                    Cover
                  </button>
                )}
                <button type="button" className="btn-danger btn-sm" aria-label={`Delete photo ${i + 1}`} onClick={() => start(async () => { await removeListingImage(img.id); router.refresh(); })}>
                  ✕
                </button>
              </div>
            )}
          </div>
        ))}
        {!locked && images.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={Boolean(busy)}
            className="flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-line text-sm text-muted hover:border-sky hover:text-sky"
          >
            <span className="text-2xl">+</span>
            {busy ?? "Add photos"}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} />
      <p className="hint mt-2">Up to {MAX_PHOTOS} photos. Show the whole item, bases/edges, size labels, and any damage. The first photo is the cover.</p>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
