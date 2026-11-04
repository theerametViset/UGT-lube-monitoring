// Small lubrication-themed motion icons (CSS in globals.css, stilled by prefers-reduced-motion).
import { Cog } from "lucide-react";

// Waiting on the AI: a turning gear with oil dripping onto it.
export function GearSpinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span className={`relative inline-block shrink-0 ${className}`} aria-hidden>
      <Cog className="lube-gear h-full w-full" />
      <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full">
        <path className="lube-drip" d="M12 -1 Q14.5 3 12 5 Q9.5 3 12 -1 Z" fill="#f59e0b" />
      </svg>
    </span>
  );
}

// Saving: a drop falls while the request runs; once saved it turns into a check mark.
export function SaveDrop({ saved, className = "h-4 w-4" }: { saved: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {saved ? (
        <>
          <circle className="save-ring" cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
          <path className="save-check" d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path className="save-drop" d="M12 2 Q17 9 12 13 Q7 9 12 2 Z" fill="currentColor" />
          <path d="M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        </>
      )}
    </svg>
  );
}
