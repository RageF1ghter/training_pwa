import type { BodyProfile, BodyProfileRecord, FitnessGoal, Gender, Workout } from "../types";
import { aggregateBodyPartReps, aggregateExerciseReps, getExerciseSetsWithDetails, sumCalories, sumSets } from "./workouts";
import { fromDateKey } from "./date";

export type AIRange = "7d" | "30d" | "all";

const RANGE_DAYS: Record<Exclude<AIRange, "all">, number> = { "7d": 7, "30d": 30 };

export function buildAIContextMarkdown(args: {
  workouts: Workout[];
  bodyProfile: BodyProfile;
  bodyProfileHistory: BodyProfileRecord[];
  range: AIRange;
}): string {
  const { bodyProfile, range } = args;
  const since = range === "all" ? null : rangeStart(range);
  const workouts = since ? args.workouts.filter((w) => w.date >= since) : args.workouts;
  const history = since
    ? args.bodyProfileHistory.filter((r) => r.recordedAt.slice(0, 10) >= since)
    : args.bodyProfileHistory;

  const lines: string[] = [];
  lines.push(`# 健身数据分析（${rangeLabel(range)}）`);
  lines.push("");

  // ── Profile ──
  lines.push("## 个人档案");
  const profileParts: string[] = [];
  if (bodyProfile.heightCm > 0) profileParts.push(`身高 ${bodyProfile.heightCm}cm`);
  if (bodyProfile.weightKg > 0) profileParts.push(`体重 ${bodyProfile.weightKg}kg`);
  if (bodyProfile.age > 0) profileParts.push(`年龄 ${bodyProfile.age}`);
  if (bodyProfile.gender) profileParts.push(bodyProfile.gender === "male" ? "男" : "女");
  lines.push(profileParts.length ? `- ${profileParts.join("｜")}` : "- 暂未填写身体数据");
  if (bodyProfile.goal) lines.push(`- 训练目标：${bodyProfile.goal}`);

  const bmi = computeBmi(bodyProfile);
  const bmr = computeBmr(bodyProfile);
  const metrics: string[] = [];
  if (bmi !== null) metrics.push(`BMI ${bmi.toFixed(1)}（${bmiCategory(bmi)}）`);
  if (bmr !== null) metrics.push(`基础代谢约 ${Math.round(bmr)} kcal/天`);
  if (metrics.length) lines.push(`- ${metrics.join("｜")}`);
  lines.push("");

  // ── Overview ──
  lines.push("## 训练概况");
  if (workouts.length === 0) {
    lines.push("- 该时段内暂无训练记录");
  } else {
    const totalSets = sumSets(workouts);
    const totalCalories = sumCalories(workouts);
    const totalReps = workouts.reduce((sum, w) => sum + countReps(w), 0);
    const weeks = rangeWeeks(range, workouts);
    lines.push(`- 训练 ${workouts.length} 次｜总组数 ${totalSets}｜总次数 ${totalReps}｜消耗 ${totalCalories} kcal`);
    if (weeks > 0) lines.push(`- 平均每周约 ${(workouts.length / weeks).toFixed(1)} 次`);
  }
  lines.push("");

  // ── Body-part distribution ──
  if (workouts.length > 0) {
    const parts = aggregateBodyPartReps(workouts);
    const total = parts.reduce((s, p) => s + p.totalReps, 0) || 1;
    lines.push("## 部位训练分布");
    lines.push("| 部位 | 总次数 | 占比 |");
    lines.push("| --- | --- | --- |");
    for (const p of parts) {
      lines.push(`| ${p.bodyPart} | ${p.totalReps} | ${((p.totalReps / total) * 100).toFixed(0)}% |`);
    }
    lines.push("");
  }

  // ── Top exercises trend ──
  if (workouts.length > 0) {
    const top = aggregateExerciseReps(workouts).slice(0, 6);
    lines.push("## 重点动作强度趋势");
    for (const ex of top) {
      const series = getExerciseSetsWithDetails(workouts, ex.exercise);
      const trend = series
        .map((group) => {
          const top = group.sets
            .map((s) => ({ w: s.weight, r: s.reps }))
            .sort((a, b) => b.w - a.w)[0];
          if (!top) return null;
          return `${formatMD(group.workoutDate)} ${top.w > 0 ? `${top.w}kg` : "自重"}×${top.r}`;
        })
        .filter(Boolean)
        .reverse()
        .join(" → ");
      if (trend) lines.push(`- ${ex.exercise}（${ex.bodyPart}）：${trend}`);
    }
    lines.push("");
  }

  // ── Body-data trajectory ──
  if (history.length >= 2) {
    const first = history[0];
    const last = history[history.length - 1];
    const delta = +(last.weightKg - first.weightKg).toFixed(1);
    if (delta !== 0 || first.weightKg !== last.weightKg) {
      const sign = delta > 0 ? "+" : "";
      lines.push("## 身体数据变化");
      lines.push(`- ${formatMD(first.recordedAt.slice(0, 10))} ${first.weightKg}kg → ${formatMD(last.recordedAt.slice(0, 10))} ${last.weightKg}kg（${sign}${delta}kg）`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

function rangeStart(range: "7d" | "30d"): string {
  const days = RANGE_DAYS[range];
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return toDateKey(d);
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function rangeLabel(range: AIRange): string {
  if (range === "all") return "全部";
  return `近 ${RANGE_DAYS[range]} 天`;
}

function rangeWeeks(range: AIRange, workouts: Workout[]): number {
  if (workouts.length === 0) return 0;
  if (range === "all") {
    const dates = workouts.map((w) => fromDateKey(w.date).getTime()).sort((a, b) => a - b);
    const spanDays = Math.max(1, (dates[dates.length - 1] - dates[0]) / 86_400_000);
    return Math.max(1, +(spanDays / 7).toFixed(1));
  }
  return RANGE_DAYS[range] / 7;
}

function countReps(workout: Workout): number {
  return workout.exercises.reduce((sum, ex) => sum + ex.sets.reduce((s, set) => s + set.reps, 0), 0);
}

function computeBmi(p: { heightCm: number; weightKg: number }): number | null {
  const m = p.heightCm / 100;
  return m > 0 && p.weightKg > 0 ? p.weightKg / (m * m) : null;
}

function computeBmr(p: { heightCm: number; weightKg: number; age: number; gender: Gender | "" }): number | null {
  if (p.heightCm <= 0 || p.weightKg <= 0 || p.age <= 0 || p.gender === "") return null;
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.gender === "male" ? base + 5 : base - 161;
}

function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return "偏瘦";
  if (bmi < 24) return "正常";
  if (bmi < 28) return "偏胖";
  return "肥胖";
}

function formatMD(dateKey: string): string {
  const d = fromDateKey(dateKey);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// Re-exported for type-only callers that may want them.
export type { FitnessGoal };
