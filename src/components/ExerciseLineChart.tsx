import * as echarts from "echarts";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { formatDateLabel } from "../utils/date";
import { formatDuration, formatRestGap, type EnrichedSet } from "../utils/workouts";

function readCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "";
}

export function ExerciseLineChart({
  exerciseName,
  groupedSets,
  onClose,
}: {
  exerciseName: string;
  groupedSets: { workoutId: string; workoutDate: string; sets: EnrichedSet[] }[];
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  const allSets = useMemo(() => groupedSets.flatMap((g) => g.sets), [groupedSets]);
  const totalSets = allSets.length;
  const totalReps = useMemo(() => allSets.reduce((s, set) => s + set.reps, 0), [allSets]);

  const xLabels = useMemo(() => {
    return allSets.map((set, i) => `${formatDateLabel(set.workoutDate)} #${i + 1}`);
  }, [allSets]);

  const weightData = useMemo(() => allSets.map((s) => s.weight), [allSets]);
  const restGapData = useMemo(() => allSets.map((s) => s.restGapSeconds ?? null), [allSets]);

  // Compute previous-workout weights: for each set, find the weight of the
  // same-position set in the chronologically previous workout (if any).
  const prevWeightData = useMemo(() => {
    // groupedSets is sorted by date descending — so index i+1 is the previous workout
    // Build a flat array matching allSets order, with previous weight or null
    const result: (number | null)[] = [];
    for (let gi = 0; gi < groupedSets.length; gi++) {
      const current = groupedSets[gi];
      const prev = groupedSets[gi + 1] ?? null; // next group = older workout
      for (let si = 0; si < current.sets.length; si++) {
        const prevWeight = prev && si < prev.sets.length ? prev.sets[si].weight : null;
        result.push(prevWeight);
      }
    }
    return result;
  }, [groupedSets]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (!chartRef.current) {
      chartRef.current = echarts.init(el);
    }

    const ink = readCssVar("--ink-rgb").split(" ")[0];
    const inkColor = ink ? `rgb(${ink}, ${ink}, ${ink})` : "#ffffff";
    const ink50 = ink ? `rgba(${ink}, ${ink}, ${ink}, 0.5)` : "rgba(255,255,255,0.5)";
    const ink15 = ink ? `rgba(${ink}, ${ink}, ${ink}, 0.15)` : "rgba(255,255,255,0.15)";
    const mist = readCssVar("--color-mist") || "#000000";

    chartRef.current.setOption(
      {
        backgroundColor: "transparent",
        textStyle: { color: ink50, fontFamily: "Inter, sans-serif", fontSize: 11 },
        grid: { left: 48, right: 56, top: 12, bottom: 28 },
        tooltip: {
          trigger: "axis",
          confine: true,
          backgroundColor: mist,
          borderColor: ink15,
          textStyle: { color: inkColor, fontSize: 12 },
          formatter: (params: { seriesName: string; value: number | null; color: string; axisValue: string }[]) => {
            const lines = params
              .filter((p) => p.value !== null)
              .map((p) => {
                const val =
                  p.seriesName === "休息"
                    ? formatRestGap(p.value as number)
                    : p.seriesName === "重量" || p.seriesName === "上次重量"
                      ? `${p.value} kg`
                      : String(p.value);
                return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px;"></span>${p.seriesName}: <b>${val}</b>`;
              });
            return `<div style="font-weight:600;margin-bottom:4px;">${params[0]?.axisValue ?? ""}</div>${lines.join("<br>")}`;
          },
        },
        legend: {
          data: ["重量", "上次重量", "休息"],
          bottom: 0,
          textStyle: { color: ink50, fontSize: 11 },
          icon: "roundRect",
        },
        xAxis: {
          type: "category",
          data: xLabels,
          axisLine: { lineStyle: { color: ink15 } },
          axisTick: { show: false },
          axisLabel: { color: ink50, fontSize: 9, interval: 0, rotate: xLabels.length > 7 ? 30 : 0 },
        },
        yAxis: [
          {
            type: "value",
            name: "kg",
            nameTextStyle: { color: ink50, fontSize: 10 },
            splitLine: { lineStyle: { color: ink15 } },
            axisLabel: { color: ink50, fontSize: 10 },
          },
          {
            type: "value",
            name: "秒",
            nameTextStyle: { color: ink50, fontSize: 10 },
            splitLine: { show: false },
            axisLabel: { color: ink50, fontSize: 10 },
          },
        ],
        series: [
          {
            name: "重量",
            type: "line",
            data: weightData,
            smooth: true,
            symbol: "circle",
            symbolSize: 7,
            lineStyle: { color: "rgb(var(--ocean-rgb))", width: 2.5 },
            itemStyle: { color: "rgb(var(--ocean-rgb))" },
          },
          {
            name: "上次重量",
            type: "line",
            data: prevWeightData,
            smooth: true,
            symbol: "diamond",
            symbolSize: 7,
            lineStyle: { color: "var(--color-citrus)", width: 2, type: "dashed" },
            itemStyle: { color: "var(--color-citrus)" },
            connectNulls: false,
          },
          {
            name: "休息",
            type: "line",
            yAxisIndex: 1,
            data: restGapData,
            smooth: true,
            symbol: "triangle",
            symbolSize: 8,
            lineStyle: { color: "rgb(var(--coral-rgb))", width: 2 },
            itemStyle: { color: "rgb(var(--coral-rgb))" },
            areaStyle: { color: "rgb(var(--coral-rgb) / 0.08)" },
          },
        ],
      },
      { notMerge: true },
    );

    const handleResize = () => chartRef.current?.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [xLabels, weightData, restGapData, prevWeightData]);

  useEffect(() => {
    return () => {
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  const totalDuration = useMemo(
    () => allSets.reduce((s, set) => s + Math.max(set.computedDuration ?? set.durationSeconds, 0), 0),
    [allSets],
  );

  const hasPrevData = prevWeightData.some((w) => w !== null);

  return (
    <div className="space-y-4 rounded-[8px] border border-line bg-glass backdrop-blur-md p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">{exerciseName}</h3>
          <p className="mt-1 text-sm text-ink/50">
            {totalSets} 组 · {totalReps} 次 · {formatDuration(totalDuration)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-[8px] text-ink/50"
          aria-label="关闭详情"
          title="关闭详情"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      {!hasPrevData && (
        <p className="rounded-[8px] bg-ocean/5 px-3 py-2 text-xs text-ocean">
          没有更早的训练记录可对比，上次重量将在下次训练时显示。
        </p>
      )}

      <div ref={containerRef} className="h-[260px] w-full" />

      {/* Per-set rest gap list */}
      <div className="grid grid-cols-2 gap-2">
        {allSets.map((set, index) => {
          if (index === 0) return null;
          return (
            <div key={set.id} className="flex items-center gap-2 rounded-[8px] bg-mist px-3 py-2 text-xs">
              <span className="text-ink/40">间歇 {index}→{index + 1}</span>
              <span className="ml-auto font-semibold text-coral">{formatRestGap(set.restGapSeconds)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
