import type { WorkoutSet } from "../types";
import { formatDuration } from "../utils/workouts";

export function RestInterval({ previousSet, set }: { previousSet?: WorkoutSet; set: WorkoutSet }) {
  if (!previousSet) return null;

  const seconds =
    previousSet.finishedAt !== undefined && set.startedAt !== undefined
      ? Math.max(0, (set.startedAt - previousSet.finishedAt) / 1000)
      : null;

  return (
    <p className="py-0.5 text-center text-xs tabular-nums text-ink/50">
      休息 {seconds !== null && Number.isFinite(seconds) ? formatDuration(seconds) : "—"}
    </p>
  );
}
