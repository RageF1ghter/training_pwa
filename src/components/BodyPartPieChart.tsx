import { Activity } from "lucide-react";
import { useMemo } from "react";
import type { BodyPart } from "../types";
import type { BodyPartRepsAgg } from "../utils/workouts";

const BODY_PART_COLORS: Record<BodyPart, string> = {
  胸部: "rgb(var(--coral-rgb))",
  背部: "rgb(var(--ocean-rgb))",
  腿部: "var(--color-citrus)",
  肩部: "rgb(var(--coral-rgb) / 0.6)",
  手臂: "rgb(var(--ocean-rgb) / 0.6)",
  核心: "rgb(var(--color-citrus) / 0.7)",
  有氧: "rgb(var(--coral-rgb) / 0.35)",
  全身: "rgb(var(--ocean-rgb) / 0.35)",
};

const CX = 100;
const CY = 100;
const R = 78;
const INNER_R = 32;

type ArcDatum = BodyPartRepsAgg & {
  path: string;
  color: string;
};

export function BodyPartPieChart({ data }: { data: BodyPartRepsAgg[] }) {
  const arcs = useMemo(() => computeArcs(data), [data]);
  const totalReps = useMemo(() => data.reduce((sum, d) => sum + d.totalReps, 0), [data]);

  if (data.length === 0) {
    return (
      <div className="rounded-[8px] border border-dashed border-line bg-glass backdrop-blur-md px-4 py-10 text-center">
        <Activity className="mx-auto text-ink/30" size={28} aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-ink/50">暂无历史训练数据</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-center">
        <svg viewBox="0 0 200 200" className="w-full max-w-[220px]" aria-label="部位训练分布饼图">
          {arcs.map((arc) => (
            <path
              key={arc.bodyPart}
              d={arc.path}
              fill={arc.color}
              stroke="var(--color-mist)"
              strokeWidth="1.5"
              aria-label={`${arc.bodyPart} ${arc.totalReps} 次`}
            />
          ))}
          <text x={CX} y={CY - 6} textAnchor="middle" dominantBaseline="middle" className="fill-ink text-[18px] font-bold">
            {totalReps}
          </text>
          <text x={CX} y={CY + 12} textAnchor="middle" dominantBaseline="middle" className="fill-ink/50 text-[11px]">
            总次数
          </text>
        </svg>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2">
        {data.map((item) => (
          <div
            key={item.bodyPart}
            className="flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-sm font-semibold text-ink/70"
          >
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: BODY_PART_COLORS[item.bodyPart] }}
            />
            <span className="truncate">{item.bodyPart}</span>
            <span className="ml-auto shrink-0 text-xs text-ink/40">{item.totalReps}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function computeArcs(data: BodyPartRepsAgg[]): ArcDatum[] {
  const totalReps = data.reduce((sum, d) => sum + d.totalReps, 0);
  if (totalReps === 0) return [];

  let currentAngle = -Math.PI / 2;
  const minAngle = 0.5 * (Math.PI / 180);

  return data.map((item) => {
    let sliceAngle = (item.totalReps / totalReps) * 2 * Math.PI;
    if (sliceAngle < minAngle) sliceAngle = minAngle;

    const endAngle = currentAngle + sliceAngle;
    const largeArc = sliceAngle > Math.PI ? 1 : 0;

    const x1 = CX + R * Math.cos(currentAngle);
    const y1 = CY + R * Math.sin(currentAngle);
    const x2 = CX + R * Math.cos(endAngle);
    const y2 = CY + R * Math.sin(endAngle);
    const x3 = CX + INNER_R * Math.cos(endAngle);
    const y3 = CY + INNER_R * Math.sin(endAngle);
    const x4 = CX + INNER_R * Math.cos(currentAngle);
    const y4 = CY + INNER_R * Math.sin(currentAngle);

    const path = [
      `M ${x1.toFixed(1)} ${y1.toFixed(1)}`,
      `A ${R} ${R} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`,
      `L ${x3.toFixed(1)} ${y3.toFixed(1)}`,
      `A ${INNER_R} ${INNER_R} 0 ${largeArc} 0 ${x4.toFixed(1)} ${y4.toFixed(1)}`,
      "Z",
    ].join(" ");

    const arc: ArcDatum = {
      ...item,
      path,
      color: BODY_PART_COLORS[item.bodyPart],
    };

    currentAngle = endAngle;
    return arc;
  });
}
