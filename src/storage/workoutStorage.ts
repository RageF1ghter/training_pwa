import type { Workout } from "../types";

const STORAGE_KEY = "fitlog.workouts";

export function readWorkouts() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    const parsed = value ? (JSON.parse(value) as unknown[]) : [];
    return parsed.map(normalizeWorkout).filter(Boolean) as Workout[];
  } catch {
    return [];
  }
}

export function writeWorkouts(workouts: Workout[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));
}

function normalizeWorkout(value: unknown): Workout | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = String(raw.id || crypto.randomUUID());
  const date = String(raw.date || "");
  const calories = Math.max(0, Number(raw.calories) || 0);
  const createdAt = String(raw.createdAt || new Date().toISOString());

  if (Array.isArray(raw.exercises)) {
    return {
      id,
      date,
      exercises: raw.exercises.map(normalizeWorkoutExercise).filter(Boolean) as Workout["exercises"],
      calories,
      createdAt,
      startedAt: typeof raw.startedAt === "number" ? raw.startedAt : undefined,
    };
  }

  if (typeof raw.bodyPart === "string" && typeof raw.exercise === "string" && Array.isArray(raw.sets)) {
    return {
      id,
      date,
      exercises: [
        {
          id: crypto.randomUUID(),
          bodyPart: raw.bodyPart as Workout["exercises"][number]["bodyPart"],
          exercise: raw.exercise,
          sets: raw.sets.map(normalizeWorkoutSet).filter(Boolean) as Workout["exercises"][number]["sets"],
        },
      ],
      calories,
      createdAt,
      startedAt: typeof raw.startedAt === "number" ? raw.startedAt : undefined,
    };
  }

  return null;
}

function normalizeWorkoutExercise(value: unknown): Workout["exercises"][number] | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.bodyPart !== "string" || typeof raw.exercise !== "string" || !Array.isArray(raw.sets)) return null;

  return {
    id: String(raw.id || crypto.randomUUID()),
    bodyPart: raw.bodyPart as Workout["exercises"][number]["bodyPart"],
    exercise: raw.exercise,
    sets: raw.sets.map(normalizeWorkoutSet).filter(Boolean) as Workout["exercises"][number]["sets"],
  };
}

function normalizeWorkoutSet(value: unknown): Workout["exercises"][number]["sets"][number] | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  return {
    id: String(raw.id || crypto.randomUUID()),
    weight: Math.max(0, Number(raw.weight) || 0),
    reps: Math.max(0, Number(raw.reps) || 0),
    durationSeconds: Math.max(0, Number(raw.durationSeconds) || 0),
    startedAt: typeof raw.startedAt === "number" ? raw.startedAt : undefined,
    finishedAt: typeof raw.finishedAt === "number" ? raw.finishedAt : undefined,
  };
}
