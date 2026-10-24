export function DueMarker({ xPercent, yPx }: { xPercent: number; yPx: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 transition-transform duration-240 ease-standard motion-reduce:transition-none"
      style={{ transform: `translate(${xPercent}%, ${yPx}px)` }}
    >
      <span className="absolute -top-1 left-0 h-8 w-0.5 -translate-x-1/2 bg-accent outline-2 outline-bg" />
      <span className="absolute -top-1.75 left-0 size-1.5 -translate-x-1/2 rounded-full bg-accent outline-2 outline-bg" />
    </div>
  );
}
