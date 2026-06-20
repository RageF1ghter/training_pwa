import * as echarts from "echarts";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { formatDateLabel } from "../utils/date";
import { formatDuration, formatRestGap, type EnrichedSet } from "../utils/workouts";

function readCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "";
}

/** Resolve a CSS custom property whose value is space-separated R G B into rgb(r,g,b). */
function readCssRGB(name: string): string {
  const raw = readCssVar(name); // e.g. "0 229 255"
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 3) {
    return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
  }
  return raw || "#000";
}

/** Resolve a CSS custom property whose value is space-separated R G B into rgba(r,g,b,a). */
function readCssRGBA(name: string, alpha: number): string {
  const raw = readCssVar(name);
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 3) {
    return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
  }
  return `rgba(0,0,0,${alpha})`;
}

/**
 * Detect and interpolate unreasonable rest-gap values using relative deviation.
 *
 * A non-null value is considered unreasonable when it deviates by more than
 * `maxDeviation` (e.g. 0.3 = 30%) from EVERY available reasonable neighbour.
 * The algorithm iterates until no more values change classification, then
 * replaces unreasonable values with linear interpolation.
 *
 * Null values are kept as-is — they represent the first set of a workout
 * where no previous rest exists.
 */
const MAX_REST_DEVIATION = 0.3;

function interpolateOutliers(values: (number | null)[]): (number | null)[] {
  const n = values.length;
  if (n === 0) return values;

  // Nulls stay null; non-null values start as candidates
  const isReasonable = values.map((v) => v !== null);

  // Iteratively prune values that deviate > 30% from ALL available reasonable neighbours
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 20) {
    changed = false;
    iterations++;
    for (let i = 0; i < n; i++) {
      if (!isReasonable[i]) continue;
      const v = values[i]!;

      // Nearest reasonable neighbour before
      let beforeIdx = -1;
      for (let j = i - 1; j >= 0 && beforeIdx === -1; j--) {
        if (isReasonable[j]) beforeIdx = j;
      }
      // Nearest reasonable neighbour after
      let afterIdx = -1;
      for (let j = i + 1; j < n && afterIdx === -1; j++) {
        if (isReasonable[j]) afterIdx = j;
      }

      const deviatesBefore =
        beforeIdx >= 0 && Math.abs(v - values[beforeIdx]!) / values[beforeIdx]! > MAX_REST_DEVIATION;
      const deviatesAfter =
        afterIdx >= 0 && Math.abs(v - values[afterIdx]!) / values[afterIdx]! > MAX_REST_DEVIATION;

      const hasBefore = beforeIdx >= 0;
      const hasAfter = afterIdx >= 0;

      // Unreasonable only if it deviates from EVERY available neighbour
      if ((!hasBefore || deviatesBefore) && (!hasAfter || deviatesAfter)) {
        isReasonable[i] = false;
        changed = true;
      }
    }
  }

  // Interpolate unreasonable values from their nearest reasonable neighbours
  return values.map((v, i) => {
    if (isReasonable[i]) return v;

    let before: { idx: number; val: number } | null = null;
    let after: { idx: number; val: number } | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (isReasonable[j] && values[j] !== null) {
        before = { idx: j, val: values[j]! };
        break;
      }
    }
    for (let j = i + 1; j < n; j++) {
      if (isReasonable[j] && values[j] !== null) {
        after = { idx: j, val: values[j]! };
        break;
      }
    }

    if (before && after) {
      const t = (i - before.idx) / (after.idx - before.idx);
      return Math.round(before.val + t * (after.val - before.val));
    }
    return before?.val ?? after?.val ?? v;
  });
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

  // ── Current workout (newest) as primary, previous aligned side-by-side ──
  const currentSets = useMemo(() => groupedSets[0]?.sets ?? [], [groupedSets]);
  const prevWorkoutDate = useMemo(() => groupedSets[1]?.workoutDate ?? null, [groupedSets]);
  const prevSets = useMemo(() => groupedSets[1]?.sets ?? [], [groupedSets]);

  const totalSets = currentSets.length;
  const totalReps = useMemo(() => currentSets.reduce((s, set) => s + set.reps, 0), [currentSets]);

  // x-axis: set positions from the current workout
  const xLabels = useMemo(() => {
    if (currentSets.length === 0) return [];
    return currentSets.map((_, i) => `组${i + 1}`);
  }, [currentSets]);

  // Current weight per set
  const weightData = useMemo(() => currentSets.map((s) => s.weight), [currentSets]);

  // Previous workout weight, aligned by set position
  const prevWeightData = useMemo(() => {
    return currentSets.map((_, i) => (i < prevSets.length ? prevSets[i].weight : null));
  }, [currentSets, prevSets]);

  // Rest gaps for current workout (null for first set).
  // Unreasonable values (> 30 min) are replaced via linear interpolation for display only.
  const restGapData = useMemo(() => {
    const raw = currentSets.map((s) => s.restGapSeconds ?? null);
    return interpolateOutliers(raw);
  }, [currentSets]);

  const hasPrevData = prevSets.length > 0;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (!chartRef.current) {
      chartRef.current = echarts.init(el);
    }

    const ink = readCssVar("--ink-rgb").split(" ")[0];
    const inkColor = ink ? `rgb(${ink}, ${ink}, ${ink})` : "#ffffff";
    const ink50 = ink ? `rgba(${ink}, ${ink}, ${ink}, 0.5)` : "rgba(255,255,255,0.5)";
    const mist = readCssVar("--color-mist") || "#000000";

    // Resolve CSS custom properties to real colour strings ECharts can parse
    const ocean = readCssRGB("--ocean-rgb");
    const ocean15 = readCssRGBA("--ocean-rgb", 0.15);
    const ocean30 = readCssRGBA("--ocean-rgb", 0.30);
    const coral = readCssRGB("--coral-rgb");
    const coral15 = readCssRGBA("--coral-rgb", 0.15);
    const coral30 = readCssRGBA("--coral-rgb", 0.30);
    const citrus = readCssVar("--color-citrus") || "#FFEA00";

    const legendData = hasPrevData
      ? ["本次重量", `上次 (${formatDateLabel(prevWorkoutDate!)})`, "休息"]
      : ["本次重量", "休息"];

    const series: echarts.SeriesOption[] = [
      {
        name: "本次重量",
        type: "line",
        data: weightData,
        smooth: true,
        symbol: "circle",
        symbolSize: 8,
        lineStyle: { color: ocean, width: 2.5 },
        itemStyle: { color: ocean, borderColor: ocean, borderWidth: 2 },
        emphasis: {
          scale: 1.6,
          itemStyle: { shadowBlur: 8, shadowColor: ocean },
        },
      },
      {
        name: "休息",
        type: "line",
        yAxisIndex: 1,
        data: restGapData,
        smooth: true,
        symbol: "triangle",
        symbolSize: 10,
        lineStyle: { color: coral, width: 2.5 },
        itemStyle: { color: coral, borderColor: coral, borderWidth: 2 },
        areaStyle: { color: readCssRGBA("--coral-rgb", 0.12) },
        emphasis: {
          scale: 1.6,
          itemStyle: { shadowBlur: 8, shadowColor: coral },
        },
      },
    ];

    // Insert previous weight as second series when available
    if (hasPrevData) {
      series.splice(1, 0, {
        name: `上次 (${formatDateLabel(prevWorkoutDate!)})`,
        type: "line",
        data: prevWeightData,
        smooth: true,
        symbol: "diamond",
        symbolSize: 9,
        lineStyle: { color: citrus, width: 2.5, type: "dashed" },
        itemStyle: { color: citrus, borderColor: citrus, borderWidth: 2 },
        connectNulls: false,
        emphasis: {
          scale: 1.6,
          itemStyle: { shadowBlur: 8, shadowColor: citrus },
        },
      });
    }

    chartRef.current.setOption(
      {
        backgroundColor: "transparent",
        textStyle: { color: ink50, fontFamily: "Inter, sans-serif", fontSize: 11 },
        grid: { left: 48, right: 64, top: 52, bottom: 16 },
        tooltip: {
          trigger: "axis",
          confine: true,
          backgroundColor: mist,
          borderColor: ocean30,
          borderWidth: 1,
          textStyle: { color: inkColor, fontSize: 12 },
          formatter: (params: { seriesName: string; value: number | null; color: string; axisValue: string }[]) => {
            const lines = params
              .filter((p) => p.value !== null)
              .map((p) => {
                const val =
                  p.seriesName.startsWith("上次")
                    ? `${p.value} kg`
                    : p.seriesName === "休息"
                      ? formatRestGap(p.value as number)
                      : p.seriesName === "本次重量"
                        ? `${p.value} kg`
                        : String(p.value);
                return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px;"></span>${p.seriesName}: <b>${val}</b>`;
              });
            return `<div style="font-weight:600;margin-bottom:4px;">${params[0]?.axisValue ?? ""}</div>${lines.join("<br>")}`;
          },
        },
        legend: {
          data: legendData,
          top: 0,
          textStyle: { color: inkColor, fontSize: 13, fontWeight: "bold" },
          icon: "roundRect",
          itemWidth: 16,
          itemHeight: 10,
          itemGap: 24,
        },
        xAxis: {
          type: "category",
          data: xLabels,
          axisLine: { lineStyle: { color: ocean30 } },
          axisTick: { show: false },
          axisLabel: {
            color: ink50,
            fontSize: 11,
            fontWeight: "bold",
            interval: 0,
            rotate: xLabels.length > 7 ? 30 : 0,
          },
        },
        yAxis: [
          {
            type: "value",
            name: "重量 (kg)",
            nameTextStyle: { color: ocean, fontSize: 11, fontWeight: "bold" },
            splitLine: { lineStyle: { color: ocean15, type: "dashed" } },
            axisLabel: { color: ocean, fontSize: 10, fontWeight: "bold" },
            axisLine: { lineStyle: { color: ocean30 } },
          },
          {
            type: "value",
            name: "休息 (秒)",
            nameTextStyle: { color: coral, fontSize: 11, fontWeight: "bold" },
            splitLine: { show: false },
            axisLabel: { color: coral, fontSize: 10, fontWeight: "bold" },
            axisLine: { lineStyle: { color: coral30 } },
          },
        ],
        series,
      },
      { notMerge: true },
    );

    const handleResize = () => chartRef.current?.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [xLabels, weightData, restGapData, prevWeightData, hasPrevData, prevWorkoutDate]);

  useEffect(() => {
    return () => {
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  const totalDuration = useMemo(
    () => currentSets.reduce((s, set) => s + Math.max(set.computedDuration ?? set.durationSeconds, 0), 0),
    [currentSets],
  );

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

      {/* Per-set rest gap list (current workout only) */}
      <div className="grid grid-cols-2 gap-2">
        {currentSets.map((set, index) => {
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
