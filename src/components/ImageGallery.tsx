"use client";
import Image from "next/image";
import { useState } from "react";

export function ImageGallery({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0);
  if (!images.length) {
    return <div className="card flex aspect-[4/3] items-center justify-center text-muted">No photos</div>;
  }
  return (
    <div>
      <div className="card relative aspect-[4/3] overflow-hidden bg-ice">
        <Image src={images[active]} alt={`${alt} — photo ${active + 1}`} fill priority sizes="(min-width:1024px) 60vw, 100vw" className="object-contain" />
        {images.length > 1 && (
          <>
            <button
              type="button"
              className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow"
              onClick={() => setActive((a) => (a - 1 + images.length) % images.length)}
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button
              type="button"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow"
              onClick={() => setActive((a) => (a + 1) % images.length)}
              aria-label="Next photo"
            >
              ›
            </button>
            <span className="badge absolute right-2 bottom-2 bg-ink/80 text-white">
              {active + 1} / {images.length}
            </span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              className={`relative h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${i === active ? "border-ember" : "border-transparent"}`}
              aria-label={`Show photo ${i + 1}`}
            >
              <Image src={src} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
