import { cn } from "@/lib/utils";

/** ELITE shield mark (tower in a gold shield), drawn as SVG so it stays crisp at any size. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 48" className={cn("size-7", className)} aria-hidden>
      <defs>
        <linearGradient id="elite-gold" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#c99a5b" />
          <stop offset="1" stopColor="#f6c987" />
        </linearGradient>
      </defs>
      <path d="M2 2h36v33L20 46 2 35z" fill="url(#elite-gold)" />
      <g fill="none" stroke="#1c1917" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M18 34V8l2-1.4L22 8v26" />
        <path d="M14.5 34V14l5.5-2.8 5.5 2.8v20" />
        <path d="M9 38V23l11-5.5L31 23v15" />
        <path d="M12 36.5V21.6M28 36.5V21.6" />
      </g>
    </svg>
  );
}

export function Logo({ className, collapsed = false }: { className?: string; collapsed?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      {!collapsed && (
        <span className="flex flex-col leading-none">
          <span className="font-serif text-[15px] font-semibold tracking-[0.22em] text-foreground">ELITE</span>
          <span className="mt-0.5 text-[9px] font-medium tracking-[0.32em] text-muted-foreground">REAL ESTATE CRM</span>
        </span>
      )}
    </span>
  );
}
