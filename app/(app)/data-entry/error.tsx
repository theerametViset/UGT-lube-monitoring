"use client";

import { RouteError } from "@/components/ui/RouteError";

export default function DataEntryError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} label="หน้าป้อนข้อมูล" />;
}
