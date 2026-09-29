import Image from "next/image";
import { Camera } from "@phosphor-icons/react/dist/ssr";

/**
 * A place for a photograph of real UAE business people (visual direction v2).
 * Until a licensed photo is chosen, it shows a quiet gradient panel that says what goes here,
 * so nobody mistakes a stock placeholder for the final page.
 */
export function PhotoSlot({ src, alt, brief, className = "" }: { src?: string; alt: string; brief: string; className?: string }) {
  if (src) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <Image src={src} alt={alt} fill sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" priority />
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={`Photo to come: ${brief}`}
      className={`relative grid content-start justify-items-end overflow-hidden bg-[radial-gradient(80%_70%_at_70%_20%,rgb(255_255_255/0.35),transparent_60%),linear-gradient(160deg,rgb(143_217_208/0.55),rgb(10_86_112/0.35))] ${className}`}
    >
      <p className="m-4 flex max-w-xs items-start gap-2 rounded-2xl bg-black/25 px-3 py-2 text-sm text-white backdrop-blur">
        <Camera size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>Photo to come: {brief}</span>
      </p>
    </div>
  );
}
