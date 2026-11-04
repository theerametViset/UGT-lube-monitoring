"use client";

import { RouteError } from "@/components/ui/RouteError";

export default function AssetsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} label="รายการเครื่องจักร" />;
}
