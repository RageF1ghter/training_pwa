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
      <div className="rounded-[8px] border border-dashed border-line bg-surface px-4 py-8 text-center">
        <Activity className="mx-auto text-ink/30" size={28} aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-ink/50">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {workouts.map((workout) => (
        <article key={workout.id} className="rounded-[8px] border border-line bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ocean">{workout.exercises.length} 个动作</p>
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
                    <span key={set.id} className="rounded-[8px] bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink/60">
                      {index + 1}组 {set.weight}kg {set.reps}次 {formatDuration(set.durationSeconds)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {workout.notes && <p className="mt-3 text-sm leading-6 text-ink/60">{workout.notes}</p>}
        </article>
      ))}
    </div>
  );
}

function formatWorkoutTitle(workout: Workout) {
  const names = workout.exercises.map((exercise) => exercise.exercise);
  if (names.length === 0) return "空训练";
  if (names.length <= 2) return names.join(" + ");
  return `${names.slice(0, 2).join(" + ")} 等`;
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[8px] bg-mist px-3 py-2">
      <p className="text-xs text-ink/50">{label}</p>
      <p className="mt-1 text-base font-bold">{value}</p>
    </div>
  );
}
