export function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[8px] border border-line bg-white px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
