"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Settings, TriangleAlert, CircleCheck, Rocket } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { isDemoMode } from "@/lib/env";

const F =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-[15px] text-white placeholder-white/30 outline-none transition focus:border-cyan focus:bg-white/10";

export default function LoginPage() {
  const router = useRouter();
  const demo = isDemoMode();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const sb = createClient();
    const { error } = await sb.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function forgot() {
    if (!email) {
      setErr("กรอกอีเมลก่อน แล้วกดลืมรหัสผ่าน");
      return;
    }
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback`,
    });
    if (error) setErr(error.message);
    else setReset(true);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl backdrop-blur-xl">
      {/* Logo */}
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-dark text-[26px] font-extrabold text-white shadow-lg">
          <Settings className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="font-sans text-[20px] font-bold text-white">UGT RELIABILITY</h1>
        <p className="mt-0.5 text-[13px] font-semibold text-cyan-dark">
          Lube Monitoring
        </p>
      </div>

      {demo && (
        <div className="mb-4 flex items-center justify-center gap-1.5 rounded-lg border border-yellow/30 bg-yellow/10 px-3 py-2 text-center text-[14px] text-yellow">
          <TriangleAlert className="h-3.5 w-3.5" aria-hidden />เข้าใช้ได้โดยไม่ต้องล็อกอิน
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="login-1" className="mb-1 block text-[13px] font-bold text-white/50">
            อีเมล
          </label>
          <input
            id="login-1"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className={F}
          />
        </div>
        <div>
          <label htmlFor="login-2" className="mb-1 block text-[13px] font-bold text-white/50">
            รหัสผ่าน
          </label>
          <input
            id="login-2"
            type="password"
            required
            autoComplete="current-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="••••••••"
            className={F}
          />
        </div>

        {err && (
          <div role="alert" className="rounded-lg border border-red/30 bg-red/10 px-3 py-2 text-[14px] text-red">
            {err}
          </div>
        )}
        {reset && (
          <div className="flex items-center gap-1.5 rounded-lg border border-green/30 bg-green/10 px-3 py-2 text-[14px] text-green">
            <CircleCheck className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลแล้ว — ตรวจสอบกล่องเมล
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-cyan py-2.5 text-[15px] font-bold text-white transition hover:bg-cyan-focus disabled:opacity-50"
        >
          {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-[14px]">
        <button
          onClick={forgot}
          className="text-white/40 transition hover:text-cyan-dark"
        >
          ลืมรหัสผ่าน?
        </button>
        <span className="text-white/40">ขอบัญชีผู้ใช้ได้จากผู้ดูแลระบบ</span>
      </div>

      {demo && (
        <Link
          href="/dashboard"
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-2 text-[14px] font-semibold text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <Rocket className="h-3.5 w-3.5" aria-hidden />เข้าใช้งานโดยไม่ต้องล็อกอิน
        </Link>
      )}
    </div>
  );
}
