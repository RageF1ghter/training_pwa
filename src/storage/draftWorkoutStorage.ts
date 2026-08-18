import { createBlankWorkout } from "../factories/workout";
import type { Workout } from "../types";
import { cleanWorkoutExercises } from "../utils/workouts";
import {
  addCustomExercise,
  readCustomExercises,
  writeCustomExercises,
} from "./customExerciseStorage";
import { normalizeWorkout, readWorkouts, writeWorkouts } from "./workoutStorage";

const STORAGE_KEY = "fitlog.draftWorkout";
const STALE_DRAFT_MS = 6 * 60 * 60 * 1000;

export function readDraftWorkout(): Workout {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return createBlankWorkout();
    const normalized = normalizeWorkout(JSON.parse(value));
    if (!normalized || normalized.exercises.length === 0) return createBlankWorkout();
    return normalized;
  } catch {
    return createBlankWorkout();
  }
}

export function writeDraftWorkout(draft: Workout) {
  if (draft.exercises.length === 0) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function lastRecordAt(draft: Workout): number {
  let latest = draft.startedAt ?? 0;
  for (const exercise of draft.exercises) {
    for (const set of exercise.sets) {
      const stamp = set.finishedAt ?? set.startedAt;
      if (typeof stamp === "number" && stamp > latest) latest = stamp;
    }
  }
  if (latest > 0) return latest;
  const created = Date.parse(draft.createdAt);
  return Number.isNaN(created) ? 0 : created;
}

export function commitDraftAsWorkout(draft: Workout): Workout {
  return {
    ...draft,
    exercises: cleanWorkoutExercises(draft.exercises),
    calories: 0,
    createdAt: new Date().toISOString(),
  };
}

// Idempotent launch-time check: a draft whose last set was recorded more than
// 6 hours ago belongs to a finished session, so turn it into a saved workout.
export function reconcileStaleDraft(now = Date.now()) {
  const draft = readDraftWorkout();
  if (draft.exercises.length === 0) return;
  if (now - lastRecordAt(draft) <= STALE_DRAFT_MS) return;

  const workout = commitDraftAsWorkout(draft);
  writeWorkouts([workout, ...readWorkouts()]);
  let customExercises = readCustomExercises();
  for (const exercise of workout.exercises) {
    customExercises = addCustomExercise(customExercises, exercise.bodyPart, exercise.exercise);
  }
  writeCustomExercises(customExercises);
  localStorage.removeItem(STORAGE_KEY);
}
