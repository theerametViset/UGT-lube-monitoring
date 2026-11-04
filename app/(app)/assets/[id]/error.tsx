"use client";

import { RouteError } from "@/components/ui/RouteError";

export default function AssetDetailError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} label="ข้อมูลเครื่องจักร" />;
}
