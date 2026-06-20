import type { BodyPart, DayPhoto, Workout, WorkoutSet } from "../types";

export function sumCalories(workouts: Workout[]) {
  return workouts.reduce((total, item) => total + item.calories, 0);
}

export function sumSets(workouts: Workout[]) {
  return workouts.reduce((total, item) => total + countWorkoutSets(item), 0);
}

export function countWorkoutSets(workout: Workout) {
  return workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
}

export function countWorkoutReps(workout: Workout) {
  return workout.exercises.reduce(
    (total, exercise) => total + exercise.sets.reduce((setTotal, set) => setTotal + set.reps, 0),
    0,
  );
}

export function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = `${safeSeconds % 60}`.padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

export function groupWorkoutsByDate(workouts: Workout[]) {
  return workouts.reduce<Record<string, Workout[]>>((map, workout) => {
    map[workout.date] = [...(map[workout.date] || []), workout];
    return map;
  }, {});
}

export function groupPhotosByDate(photos: DayPhoto[]) {
  return photos.reduce<Record<string, DayPhoto[]>>((map, photo) => {
    map[photo.date] = [...(map[photo.date] || []), photo];
    return map;
  }, {});
}

// ── Chart / detail panel helpers ──

export type ExerciseRepsAgg = {
  exercise: string;
  bodyPart: BodyPart;
  totalReps: number;
};

export function aggregateExerciseReps(workouts: Workout[]): ExerciseRepsAgg[] {
  const map = new Map<string, { bodyPart: BodyPart; totalReps: number }>();
  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      const existing = map.get(exercise.exercise);
      const reps = exercise.sets.reduce((sum, s) => sum + s.reps, 0);
      if (existing) {
        existing.totalReps += reps;
      } else {
        map.set(exercise.exercise, { bodyPart: exercise.bodyPart, totalReps: reps });
      }
    }
  }
  return Array.from(map.entries())
    .map(([exercise, { bodyPart, totalReps }]) => ({ exercise, bodyPart, totalReps }))
    .sort((a, b) => b.totalReps - a.totalReps);
}

export type EnrichedSet = WorkoutSet & {
  workoutDate: string;
  workoutId: string;
  computedDuration: number | null;
  restGapSeconds: number | null;
};

export function getExerciseSetsWithDetails(
  workouts: Workout[],
  exerciseName: string,
): { workoutId: string; workoutDate: string; sets: EnrichedSet[] }[] {
  const allSets: (WorkoutSet & { workoutDate: string; workoutId: string })[] = [];
  for (const workout of workouts) {
    for (const ex of workout.exercises) {
      if (ex.exercise !== exerciseName) continue;
      for (const set of ex.sets) {
        allSets.push({ ...set, workoutDate: workout.date, workoutId: workout.id });
      }
    }
  }

  allSets.sort((a, b) => {
    if (a.startedAt !== undefined && b.startedAt !== undefined) return a.startedAt - b.startedAt;
    if (a.startedAt !== undefined) return -1;
    if (b.startedAt !== undefined) return 1;
    return 0;
  });

  let prevFinishedAt: number | null = null;
  let prevWorkoutId: string | null = null;
  const enriched = allSets.map((set) => {
    const computedDuration =
      set.startedAt !== undefined && set.finishedAt !== undefined
        ? Math.max(0, (set.finishedAt - set.startedAt) / 1000)
        : null;

    // Reset rest-gap tracking when crossing a workout boundary, so the
    // first set of each workout always has a null rest gap.
    if (prevWorkoutId !== null && prevWorkoutId !== set.workoutId) {
      prevFinishedAt = null;
    }

    const restGapSeconds =
      set.startedAt !== undefined && prevFinishedAt !== null
        ? Math.max(0, (set.startedAt - prevFinishedAt) / 1000)
        : null;
    prevFinishedAt = set.finishedAt ?? null;
    prevWorkoutId = set.workoutId;
    return { ...set, computedDuration, restGapSeconds };
  });

  const grouped = new Map<string, { workoutId: string; workoutDate: string; sets: EnrichedSet[] }>();
  for (const set of enriched) {
    const key = set.workoutId;
    if (!grouped.has(key)) {
      grouped.set(key, { workoutId: set.workoutId, workoutDate: set.workoutDate, sets: [] });
    }
    grouped.get(key)!.sets.push(set);
  }

  return Array.from(grouped.values()).sort((a, b) => b.workoutDate.localeCompare(a.workoutDate));
}

// ── Body-part aggregation (for empty-day historical overview) ──

export type BodyPartRepsAgg = {
  bodyPart: BodyPart;
  totalReps: number;
};

export function aggregateBodyPartReps(workouts: Workout[]): BodyPartRepsAgg[] {
  const map = new Map<BodyPart, number>();
  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      const reps = exercise.sets.reduce((sum, s) => sum + s.reps, 0);
      map.set(exercise.bodyPart, (map.get(exercise.bodyPart) || 0) + reps);
    }
  }
  return Array.from(map.entries())
    .map(([bodyPart, totalReps]) => ({ bodyPart, totalReps }))
    .sort((a, b) => b.totalReps - a.totalReps);
}

export function formatRestGap(seconds: number | null): string {
  if (seconds === null) return "---";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}m${secs}s`;
}
