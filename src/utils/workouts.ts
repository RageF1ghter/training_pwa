import type { DayPhoto, Workout } from "../types";

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
