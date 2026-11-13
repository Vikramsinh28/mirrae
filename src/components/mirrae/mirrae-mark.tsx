interface MirraeMarkProps {
  readonly className?: string;
  /** Show the wordmark next to the symbol. */
  readonly withWordmark?: boolean;
}

/** Mirrae logo: an arched mirror holding a soft reflection, plus the wordmark. */
export function MirraeMark({ className = '', withWordmark = true }: MirraeMarkProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <path
          d="M6 29V14C6 7.9 10.5 3 16 3s10 4.9 10 11v15H6Z"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <path
          d="M11 29V15.5C11 11.9 13.2 9 16 9s5 2.9 5 6.5V29"
          stroke="#E0B35F"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
      {withWordmark && (
        <span className="font-display text-[1.65rem] font-medium leading-none tracking-tight">
          Mirrae
        </span>
      )}
    </span>
  );
}
