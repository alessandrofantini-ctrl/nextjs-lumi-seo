/* Componenti UI condivisi — tema chiaro */

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-8 pt-9 pb-6 border-b border-[#e8e8e8] bg-white">
      <h1 className="text-[21px] font-semibold text-[#1a1a1a] leading-tight">{title}</h1>
      {subtitle && <p className="text-[#8f8f8f] text-[13px] mt-1">{subtitle}</p>}
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
    <div className={`rounded-xl border border-[#e8e8e8] bg-white ${className}`}>
      {children}
    </div>
  );
}

export function Divider() {
  return <hr className="border-[#e8e8e8] my-6" />;
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-medium text-[#737373] uppercase tracking-wide mb-1.5">
      {children}
    </label>
  );
}

const inputBase =
  "w-full px-3 py-2 rounded-lg bg-white border border-[#d9d9d9] text-[#1a1a1a] text-[13px] placeholder:text-[#c0c0c0] focus:outline-none focus:border-[#999] transition-colors";

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
  variant?: "primary" | "ghost" | "danger";
  loading?: boolean;
}) {
  const base = "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-[#1a1a1a] hover:bg-[#333] text-white",
    ghost:   "bg-transparent hover:bg-[#f0f0ef] text-[#737373] hover:text-[#1a1a1a] border border-[#e0e0e0] hover:border-[#ccc]",
    danger:  "bg-transparent hover:bg-red-50 text-red-500 hover:text-red-600 border border-red-200 hover:border-red-300",
  };
  return (
    <button {...props} disabled={loading || props.disabled} className={`${base} ${variants[variant]} ${className}`}>
      {loading ? <span className="opacity-60">Caricamento…</span> : children}
    </button>
  );
}

export function Alert({ children, type = "error" }: { children: React.ReactNode; type?: "error" | "warn" | "info" }) {
  const styles = {
    error: "bg-red-50 border-red-200 text-red-700",
    warn:  "bg-yellow-50 border-yellow-200 text-yellow-800",
    info:  "bg-blue-50 border-blue-200 text-blue-700",
  };
  return (
    <div className={`p-3.5 rounded-lg border text-[13px] leading-relaxed ${styles[type]}`}>
      {children}
    </div>
  );
}

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#f0f0ef] text-[#555] text-[11px] font-medium border border-[#e0e0e0]">
      {children}
    </span>
  );
}
