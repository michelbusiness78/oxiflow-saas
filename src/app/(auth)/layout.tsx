export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-oxi-bg px-4 py-12">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-oxi-navy">
          <span className="text-base font-bold text-white">O</span>
        </div>
        <span className="text-xl font-semibold tracking-tight text-oxi-navy">
          OxiFlow
        </span>
      </div>

      {/* Card */}
      <div className="w-full max-w-[400px] rounded-2xl border border-oxi-border bg-oxi-surface p-8 shadow-oxi-md">
        {children}
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs text-oxi-text-muted">
        © {new Date().getFullYear()} OxiFlow — Tous droits réservés
      </p>
    </div>
  );
}
