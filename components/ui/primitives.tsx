import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { healthColor, statusBadgeClass, statusFromHealth, statusLabelTh } from "@/lib/scoring/health";
import type { AssetStatus } from "@/lib/types";
import { readableText } from "@/lib/color";

export function Card({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        "rounded-[14px] border border-border bg-bg2 shadow-card",
        // cn doesn't merge classes, so a caller's own padding (p-0, py-2.5…) replaces the default instead of fighting it
        !/(^|\s)p[xytrbl]?-/.test(className ?? "") && "p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn("badge", className)}>{children}</span>;
}

export function StatusBadge({ status }: { status: AssetStatus }) {
  return (
    <Badge className={statusBadgeClass(status)}>
      <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle" aria-hidden />{statusLabelTh(status)}
    </Badge>
  );
}

// The one way to show a machine's Health Score: a unitless 0–100 number, its
// status word, and the status colour — identical on every page.
export function HealthBadge({ score, size = "md" }: { score: number; size?: "md" | "lg" | "tile" }) {
  const status = statusFromHealth(score);
  // "tile": a square block for ranked lists — the score large, the status word under it.
  if (size === "tile") {
    return (
      <span className={cn(statusBadgeClass(status), "flex h-14 w-14 flex-col items-center justify-center rounded-xl tabular-nums")}>
        <span className="font-mono text-[20px] font-bold leading-none">{score}</span>
        <span className="mt-1 text-[11px] font-semibold leading-none">{statusLabelTh(status)}</span>
      </span>
    );
  }
  return (
    <Badge className={cn(statusBadgeClass(status), "tabular-nums", size === "lg" && "px-2.5 py-1 text-[14px]")}>
      <span className="font-mono">{score}</span>
      <span aria-hidden>·</span>
      {statusLabelTh(status)}
    </Badge>
  );
}

type ButtonVariant = "primary" | "ghost" | "danger" | "ok" | "critical";
const buttonVariants: Record<ButtonVariant, string> = {
  // same gradient as the segmented filter bars
  primary: "bg-gradient-to-b from-cyan to-cyan-dark text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_14px_rgba(0,102,204,0.28)] hover:brightness-110",
  ghost:
    "bg-bg2 text-t1 border border-border hover:border-cyan hover:text-cyan",
  danger:
    "bg-red/10 text-red border border-red/30 hover:bg-red/20",
  // #15803d: white text 5.0:1 (brand green #22c55e was 2.3:1 on the main Save button)
  ok: "bg-[#15803d] text-white hover:bg-[#166534]",
  // Solid primary action for a reading that makes a machine Critical (white on #b91c1c = 6.5:1).
  critical: "bg-[#b91c1c] text-white hover:bg-[#991b1b]",
};

export function Button({
  children,
  variant = "ghost",
  size = "md",
  className,
  ...props
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "md" | "sm" | "xs";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cn(BUTTON_BASE, BUTTON_SIZES[size], buttonVariants[variant], className)} {...props}>
      {children}
    </button>
  );
}

const BUTTON_BASE =
  "tap inline-flex items-center gap-1.5 rounded-pill font-semibold transition active:scale-95 disabled:opacity-40";
const BUTTON_SIZES = {
  md: "px-4 py-2 text-[14px]",
  sm: "px-2.5 py-1.5 text-[14px]",
  xs: "px-2 py-1 text-[14px]",
};

/**
 * A link that looks like <Button>. Use it instead of <Link><Button/></Link>: a
 * button inside a link is invalid HTML and gives keyboard users two Tab stops
 * for one action. `disabled` renders a non-focusable span (a link can't be disabled).
 */
export function ButtonLink({
  href,
  children,
  variant = "ghost",
  size = "md",
  className,
  disabled,
  ...props
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "md" | "sm" | "xs";
  disabled?: boolean;
} & Omit<ComponentProps<typeof Link>, "href" | "children">) {
  const cls = cn(BUTTON_BASE, BUTTON_SIZES[size], buttonVariants[variant], className);
  if (disabled) {
    return (
      <span aria-disabled="true" className={cn(cls, "cursor-not-allowed opacity-40")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={cls} {...props}>
      {children}
    </Link>
  );
}

export function HealthBar({ score }: { score: number }) {
  return (
    <div className="min-w-[110px]">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-t3">Score</span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: healthColor(score) }}
          />
          <span
            className="font-mono text-[14px] font-bold"
            style={{ color: readableText(healthColor(score)) }}
          >
            {score}
          </span>
        </span>
      </div>
      <div
        className="hbar-track mt-[3px]"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`คะแนนสุขภาพ ${score} (${statusLabelTh(statusFromHealth(score))})`}
      >
        <div
          className="hbar-fill"
          style={{ width: `${score}%`, background: healthColor(score) }}
        />
      </div>
    </div>
  );
}

const accentByTone = {
  cyan: "before:bg-cyan",
  red: "before:bg-red",
  yellow: "before:bg-yellow",
  green: "before:bg-green",
} as const;
const iconByTone = { cyan: "text-cyan", red: "text-red", yellow: "text-yellow", green: "text-green" } as const;

// "ไทย (English)" → the Thai label, with the English on its own line, smaller
// and lighter: the UI is Thai-first with English labels (AGENTS.md), and the
// English shouldn't compete with it. Text without "(…)" renders as is.
export function BiLabel({ text }: { text: string }) {
  const m = text.match(/^(.+?)\s*\(([^()]+)\)$/);
  if (!m) return <>{text}</>;
  return (
    <>
      {m[1]}
      <span className="block text-[12px] font-normal text-t3">{m[2]}</span>
    </>
  );
}

export function KpiCard({
  label,
  value,
  note,
  tone = "cyan",
  icon,
  valueClassName,
  className,
  backdrop,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: keyof typeof accentByTone;
  icon?: ReactNode;
  valueClassName?: string;
  className?: string;
  /** Absolutely positioned decoration painted behind the card's content. */
  backdrop?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-[14px] border border-border bg-bg2 p-4 shadow-card before:absolute before:inset-x-0 before:top-0 before:h-[3px]",
        accentByTone[tone],
        className,
      )}
    >
      {backdrop}
      <div className="kpi-lbl mb-1 pr-7 text-[14px] font-semibold leading-snug text-t3">
        <BiLabel text={label} />
      </div>
      <div
        className={cn(
          "truncate font-sans text-[33px] font-bold leading-none tracking-tight",
          valueClassName,
        )}
      >
        {value}
      </div>
      {note ? <div className="mt-1 text-[13px] text-t3">{note}</div> : null}
      {icon ? (
        <div className={cn("absolute right-3 top-3 opacity-60 [&>svg]:h-5 [&>svg]:w-5", iconByTone[tone])} aria-hidden>
          {icon}
        </div>
      ) : null}
    </div>
  );
}