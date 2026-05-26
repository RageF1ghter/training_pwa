import type { ReactNode } from "react";

export function TabButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[54px] flex-col items-center justify-center gap-1 text-xs font-semibold ${
        active ? "text-ocean" : "text-ink/50"
      }`}
      aria-label={label}
      title={label}
    >
      <span className={`flex h-8 w-12 items-center justify-center rounded-[8px] ${active ? "bg-ocean/10" : ""}`}>{icon}</span>
      {label}
    </button>
  );
}
