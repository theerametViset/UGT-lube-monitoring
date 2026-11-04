"use client";

import { RouteError } from "@/components/ui/RouteError";

export default function AlarmConfigError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} label="การตั้งค่าแจ้งเตือน" />;
}
