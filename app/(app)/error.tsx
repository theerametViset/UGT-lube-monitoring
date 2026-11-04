"use client";

import { TriangleAlert, RotateCcw, House } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDemo = process.env.DEMO_MODE !== "false" && !process.env.NEXT_PUBLIC_SUPABASE_URL;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <TriangleAlert className="h-12 w-12 text-yellow" aria-hidden />
      <h1 className="mt-3 font-sans text-[18px] font-bold text-t1">เกิดข้อผิดพลาด</h1>
      <p className="mt-1 max-w-[400px] text-center text-[13px] text-t3">
        {isDemo
          ? "อาจเกิดจาก Supabase ยังไม่ได้ตั้งค่า — ลองตั้ง DEMO_MODE=true หรือใส่ env"
          : error.message || "กรุณาลองอีกครั้ง"}
      </p>
      <div className="mt-4 flex gap-2">
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cyan px-4 py-2 text-[14px] font-semibold text-white transition hover:bg-cyan-focus"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />ลองอีกครั้ง
        </button>
        <a
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-[14px] font-semibold text-t2 transition hover:border-cyan"
        >
          <House className="h-3.5 w-3.5" aria-hidden />กลับ Dashboard
        </a>
      </div>
    </div>
  );
}
