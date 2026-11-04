import { useId } from 'react';

// Geometry and dot colours are the logo masters' (wiki: Brand). The light dot is #D98A00,
// not the interface accent; logos are exempt from the 3:1 rule.
export function Mark({ size = 24, className }: { size?: number; className?: string }) {
  const clip = useId();
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
    >
      <defs>
        <clipPath id={clip}>
          <circle cx="100" cy="100" r="96" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`} fill="currentColor">
        <rect x="0" y="9" width="200" height="22" rx="11" />
        <rect x="0" y="41" width="200" height="22" rx="11" />
        <rect x="0" y="73" width="200" height="22" rx="11" />
        <rect x="0" y="105" width="138" height="22" rx="11" />
        <rect x="0" y="137" width="200" height="22" rx="11" />
        <rect x="0" y="169" width="200" height="22" rx="11" />
      </g>
      <circle cx="160" cy="116" r="11" className="fill-[#d98a00] dark:fill-[#ffb224]" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5 text-text">
      <Mark />
      <span className="text-lg font-semibold tracking-[-0.03em]">workclock</span>
    </span>
  );
}
