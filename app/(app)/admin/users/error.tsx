"use client";

import { RouteError } from "@/components/ui/RouteError";

export default function AdminUsersError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} label="การจัดการผู้ใช้" />;
}
