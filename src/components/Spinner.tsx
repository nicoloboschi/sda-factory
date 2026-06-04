/** Small inline loading spinner with an optional label. */
export function Spinner({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-sm text-[var(--muted)] ${className}`}>
      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
      {label && <span>{label}</span>}
    </div>
  );
}
