/* Componenti UI condivisi */

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-8 pt-10 pb-7 border-b border-white/[0.06]">
      <h1 className="text-[22px] font-semibold text-white/90 leading-tight">{title}</h1>
      {subtitle && <p className="text-white/35 text-[13px] mt-1">{subtitle}</p>}
    </div>
  );
}

export function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-8 py-7 max-w-3xl ${className}`}>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/[0.07] bg-white/[0.02] ${className}`}>
      {children}
    </div>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-medium text-white/40 uppercase tracking-wide mb-1.5">
      {children}
    </label>
  );
}

const inputBase =
  "w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-white/[0.09] text-white/80 text-[13px] placeholder:text-white/20 focus:outline-none focus:border-white/20 focus:bg-[#1c1c1c] transition-colors";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputBase} resize-none leading-relaxed ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${inputBase} cursor-pointer ${props.className ?? ""}`} />
  );
}

export function Btn({
  children,
  variant = "primary",
  loading = false,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
  loading?: boolean;
}) {
  const base = "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-white/[0.1] hover:bg-white/[0.16] text-white/90 border border-white/[0.1] hover:border-white/20",
    ghost:   "bg-transparent hover:bg-white/[0.05] text-white/50 hover:text-white/80",
  };
  return (
    <button {...props} disabled={loading || props.disabled} className={`${base} ${variants[variant]} ${className}`}>
      {loading ? <span className="opacity-60">Caricamento…</span> : children}
    </button>
  );
}

export function Alert({ children, type = "error" }: { children: React.ReactNode; type?: "error" | "warn" | "info" }) {
  const styles = {
    error: "bg-red-500/8 border-red-500/20 text-red-400",
    warn:  "bg-yellow-500/8 border-yellow-500/20 text-yellow-400",
    info:  "bg-blue-500/8 border-blue-500/20 text-blue-400",
  };
  return (
    <div className={`p-3 rounded-lg border text-[13px] leading-relaxed ${styles[type]}`}>
      {children}
    </div>
  );
}
