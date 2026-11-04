import { healthColor } from "@/lib/scoring/health";

// Card background: an oil tank filled to a 0–100 value, coloured by the health status
// thresholds unless a colour is given. `sediment` adds particles drifting up (dirty oil).
// Decoration only — the number on the card is the real value.
export function OilLevel({ health, color = healthColor(health), sediment = false }: { health: number; color?: string; sediment?: boolean }) {
  // 100 fills to 85% of the card so the wave crest stays visible.
  const level = Math.max(4, Math.min(100, health)) * 0.85;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10" style={{ height: `${level}%`, color }} aria-hidden>
      {/* Two crests at different speeds; each SVG is two waves wide so sliding -50% loops seamlessly. */}
      <svg className="oil-wave-back absolute bottom-full left-0 h-5 w-[200%]" viewBox="0 0 200 20" preserveAspectRatio="none">
        <path d="M0 10 Q12.5 2 25 10 T50 10 T75 10 T100 10 T125 10 T150 10 T175 10 T200 10 V20 H0 Z" fill="currentColor" fillOpacity="0.1" />
      </svg>
      <svg className="oil-wave absolute bottom-full left-0 h-4 w-[200%]" viewBox="0 0 200 20" preserveAspectRatio="none">
        <path d="M0 10 Q12.5 18 25 10 T50 10 T75 10 T100 10 T125 10 T150 10 T175 10 T200 10 V20 H0 Z" fill="currentColor" fillOpacity="0.14" />
      </svg>
      <div className="h-full w-full bg-current opacity-[0.14]" />
      {sediment &&
        [12, 31, 52, 70, 88].map((x, i) => (
          <span
            key={x}
            className="oil-sediment absolute bottom-1 h-1 w-1 rounded-full bg-current"
            style={{ left: `${x}%`, animationDelay: `${i * -1.3}s` }}
          />
        ))}
    </div>
  );
}
