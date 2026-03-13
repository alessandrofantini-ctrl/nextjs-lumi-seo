/* Componenti UI condivisi — design system Orbita */

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-6 pt-5 pb-4 border-b border-[#f0f0f0] bg-white">
      <h1 className="text-[17px] font-semibold text-[#1a1a1a] leading-tight tracking-[-0.01em]">
        {title}
      </h1>
      {subtitle && (
        <p className="text-[#ababab] text-[12px] mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}

export function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-6 py-5 ${className}`}>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-[#f0f0f0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${className}`}>
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
  "w-full px-3 py-2 rounded-md bg-white border border-[#e8e8e8] " +
  "text-[#1a1a1a] text-[13px] placeholder:text-[#d0d0d0] " +
  "focus:outline-none focus:border-[#6366f1] focus:ring-1 " +
  "focus:ring-[#6366f1]/20 transition-colors";

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
    primary: "bg-[#6366f1] hover:bg-[#4f46e5] text-white shadow-sm",
    ghost:   "bg-transparent hover:bg-[#f5f5f4] text-[#555] hover:text-[#1a1a1a] border border-[#e8e8e8]",
    danger:  "bg-transparent hover:bg-red-50 text-red-500 border border-red-200 hover:border-red-300",
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

export function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "blue" | "green" | "amber" | "red" | "purple";
}) {
  const styles = {
    default: "bg-[#f4f4f3] text-[#555] border-[#e8e8e8]",
    blue:    "bg-[#e0e7ff] text-[#4338ca] border-[#c7d2fe]",
    green:   "bg-[#dcfce7] text-[#15803d] border-[#bbf7d0]",
    amber:   "bg-[#fef9c3] text-[#a16207] border-[#fef08a]",
    red:     "bg-[#fee2e2] text-[#b91c1c] border-[#fecaca]",
    purple:  "bg-[#ede9fe] text-[#6d28d9] border-[#ddd6fe]",
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium border ${styles[variant]}`}>
      {children}
    </span>
  );
}
