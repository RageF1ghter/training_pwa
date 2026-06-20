import { Activity, Trash2 } from "lucide-react";
import type { Workout } from "../types";
import { countWorkoutReps, countWorkoutSets, formatDuration } from "../utils/workouts";

export function WorkoutList({
  workouts,
  onDeleteWorkout,
  emptyText,
  readonly = false,
}: {
  workouts: Workout[];
  onDeleteWorkout: (id: string) => void;
  emptyText: string;
  readonly?: boolean;
}) {
  if (!workouts.length) {
    return (
      <div className="rounded-[8px] border border-dashed border-line bg-glass backdrop-blur-md px-4 py-8 text-center">
        <Activity className="mx-auto text-ink/30" size={28} aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-ink/50">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {workouts.map((workout) => (
        <article key={workout.id} className="rounded-[8px] border border-line bg-glass backdrop-blur-md p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ocean">{uniqueBodyParts(workout).length} 个部位</p>
              <h3 className="mt-1 truncate text-lg font-bold">{formatWorkoutTitle(workout)}</h3>
            </div>
            {!readonly && (
              <button
                type="button"
                onClick={() => onDeleteWorkout(workout.id)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] text-coral"
                aria-label="删除训练"
                title="删除训练"
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniMetric label="组" value={countWorkoutSets(workout)} />
            <MiniMetric label="次数" value={countWorkoutReps(workout)} />
            <MiniMetric label="千卡" value={workout.calories} />
          </div>
          <div className="mt-3 space-y-2">
            {workout.exercises.map((exercise) => (
              <div key={exercise.id} className="rounded-[8px] bg-mist px-3 py-2">
                <p className="text-sm font-semibold text-ink/80">
                  {exercise.bodyPart} · {exercise.exercise}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {exercise.sets.map((set, index) => (
                    <span key={set.id} className="rounded-[8px] bg-glass backdrop-blur-sm px-2.5 py-1.5 text-xs font-semibold text-ink/60">
                      {index + 1}组 {set.weight}kg {set.reps}次 {formatDuration(set.durationSeconds)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function uniqueBodyParts(workout: Workout): string[] {
  return [...new Set(workout.exercises.map((e) => e.bodyPart))];
}

function formatWorkoutTitle(workout: Workout) {
  const parts = uniqueBodyParts(workout);
  if (parts.length === 0) return "空训练";
  if (parts.length <= 2) return parts.join(" + ");
  return `${parts.slice(0, 2).join(" + ")} 等`;
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[8px] bg-mist px-3 py-2">
      <p className="text-xs text-ink/50">{label}</p>
      <p className="mt-1 text-base font-bold">{value}</p>
    </div>
  );
}
