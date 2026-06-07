import { Activity } from "lucide-react";
import { useMemo } from "react";
import type { ExerciseRepsAgg } from "../utils/workouts";

const CHART_COLORS = [
  "rgb(var(--ocean-rgb))",
  "rgb(var(--coral-rgb))",
  "var(--color-citrus)",
  "rgb(var(--ocean-rgb) / 0.6)",
  "rgb(var(--coral-rgb) / 0.6)",
  "rgb(var(--color-citrus) / 0.7)",
  "rgb(var(--ocean-rgb) / 0.35)",
  "rgb(var(--coral-rgb) / 0.35)",
  "rgb(var(--color-citrus) / 0.45)",
  "rgb(var(--ocean-rgb) / 0.2)",
  "rgb(var(--coral-rgb) / 0.2)",
  "rgb(var(--color-citrus) / 0.3)",
];

const CX = 100;
const CY = 100;
const R = 78;
const INNER_R = 32;

type ArcDatum = ExerciseRepsAgg & {
  path: string;
  color: string;
  startAngle: number;
  endAngle: number;
};

export function ExercisePieChart({
  data,
  selectedExercise,
  onSelectExercise,
}: {
  data: ExerciseRepsAgg[];
  selectedExercise: string | null;
  onSelectExercise: (exercise: string | null) => void;
}) {
  const arcs = useMemo(() => computeArcs(data, selectedExercise), [data, selectedExercise]);
  const totalReps = useMemo(() => data.reduce((sum, d) => sum + d.totalReps, 0), [data]);

  if (data.length === 0) {
    return (
      <div className="rounded-[8px] border border-dashed border-line bg-glass backdrop-blur-md px-4 py-10 text-center">
        <Activity className="mx-auto text-ink/30" size={28} aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-ink/50">当前周期暂无训练数据</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-center">
        <svg viewBox="0 0 200 200" className="w-full max-w-[220px]" aria-label="训练分布饼图">
          {arcs.map((arc) => (
            <path
              key={arc.exercise}
              d={arc.path}
              fill={arc.color}
              stroke="var(--color-mist)"
              strokeWidth="1.5"
              className="cursor-pointer transition-transform duration-150 active:opacity-80"
              onClick={() => onSelectExercise(arc.exercise === selectedExercise ? null : arc.exercise)}
              aria-label={`${arc.exercise} ${arc.totalReps} 次`}
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
        {data.map((item, index) => {
          const isSelected = item.exercise === selectedExercise;
          return (
            <button
              key={item.exercise}
              type="button"
              onClick={() => onSelectExercise(isSelected ? null : item.exercise)}
              className={`flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-sm font-semibold ${
                isSelected ? "text-ocean" : "text-ink/70"
              }`}
            >
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
              />
              <span className="truncate">{item.exercise}</span>
              <span className="ml-auto shrink-0 text-xs text-ink/40">{item.totalReps}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function computeArcs(data: ExerciseRepsAgg[], selectedExercise: string | null): ArcDatum[] {
  const totalReps = data.reduce((sum, d) => sum + d.totalReps, 0);
  if (totalReps === 0) return [];

  let currentAngle = -Math.PI / 2;
  const minAngle = 0.5 * (Math.PI / 180);

  return data.map((item, index) => {
    let sliceAngle = (item.totalReps / totalReps) * 2 * Math.PI;
    if (sliceAngle < minAngle) sliceAngle = minAngle;

    const endAngle = currentAngle + sliceAngle;
    const largeArc = sliceAngle > Math.PI ? 1 : 0;
    const isSelected = item.exercise === selectedExercise;
    const offset = isSelected ? 4 : 0;
    const midAngle = currentAngle + sliceAngle / 2;
    const cxOff = CX + offset * Math.cos(midAngle);
    const cyOff = CY + offset * Math.sin(midAngle);

    const x1 = cxOff + R * Math.cos(currentAngle);
    const y1 = cyOff + R * Math.sin(currentAngle);
    const x2 = cxOff + R * Math.cos(endAngle);
    const y2 = cyOff + R * Math.sin(endAngle);
    const x3 = cxOff + INNER_R * Math.cos(endAngle);
    const y3 = cyOff + INNER_R * Math.sin(endAngle);
    const x4 = cxOff + INNER_R * Math.cos(currentAngle);
    const y4 = cyOff + INNER_R * Math.sin(currentAngle);

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
      color: CHART_COLORS[index % CHART_COLORS.length],
      startAngle: currentAngle,
      endAngle,
    };

    currentAngle = endAngle;
    return arc;
  });
}
