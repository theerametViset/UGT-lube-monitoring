export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="on-dark relative flex min-h-screen items-center justify-center overflow-hidden p-4"
      style={{
        background:
          "linear-gradient(135deg, #050505 0%, #0a1628 35%, #0d2847 60%, #0066cc 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #0066cc, transparent)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-20 h-[28rem] w-[28rem] rounded-full opacity-15 blur-3xl"
        style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="relative z-10 w-full max-w-md">{children}</div>
      <div className="absolute bottom-4 left-0 right-0 text-center text-[14px] text-white/30">
        UGT Reliability Lube Monitoring © 2026
      </div>
    </div>
  );
}
