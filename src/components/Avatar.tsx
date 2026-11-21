// Initial circles use fixed brand fills (lavender, lime, ivory, burgundy) so they read the same on any surface.
const TONES = [
  "bg-[#A9A1E8] text-[#171717]",
  "bg-[#C7FF00] text-[#171717]",
  "bg-[#EAE7DD] text-[#171717]",
  "bg-[#43000B] text-[#EAE7DD]",
];

export function Avatar({ name, size = 56, tone, ring }: { name: string; size?: number; tone?: number; ring?: boolean }) {
  const t = tone ?? name.charCodeAt(0) % TONES.length;
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className={`grid shrink-0 place-items-center rounded-full font-extrabold ${TONES[t % TONES.length]} ${ring ? "ring-2 ring-lime ring-offset-2 ring-offset-char" : ""}`}
    >
      {name.replace(/^Dr\.\s*/, "").slice(0, 1).toUpperCase()}
    </span>
  );
}

/** The ArthClear mark: a lime tile with a burgundy parallelogram. */
export function BrandMark({ size = 36 }: { size?: number }) {
  return <span aria-hidden className="ac-logo-mark" style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }} />;
}
