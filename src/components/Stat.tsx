export function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[8px] border border-line bg-glass backdrop-blur-md px-3 py-2">
      <p className="text-xs text-ink/50">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
