type Props = {
  className?: string;
};

/** Mirrae logo: an arched mirror holding a soft reflection, plus the italic wordmark. */
export function SiteMark({ className = '' }: Props) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg width="26" height="30" viewBox="0 0 26 30" fill="none" aria-hidden="true">
        <path d="M3 29V13C3 6.4 7.4 2 13 2s10 4.4 10 11v16" stroke="#1f4634" strokeWidth="1.8" />
        <path
          d="M13 12l1.4 3.6L18 17l-3.6 1.4L13 22l-1.4-3.6L8 17l3.6-1.4L13 12z"
          fill="#1f4634"
        />
      </svg>
      <span className="font-lux-display text-[1.7rem] font-medium italic leading-none tracking-tight">
        Mirrae
      </span>
    </span>
  );
}
