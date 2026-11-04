"use client";

import { usePathname } from "next/navigation";
import { findNavItem } from "@/lib/nav";

export function PageTitle({ fallback }: { fallback: string }) {
  const pathname = usePathname();
  const item = findNavItem(pathname);
  if (!item) return <>{fallback}</>;
  const Icon = item.icon;
  return (
    <span className="inline-flex items-center gap-2">
      <Icon className="h-4 w-4 text-cyan max-sm:hidden" aria-hidden />
      {item.label}
    </span>
  );
}
