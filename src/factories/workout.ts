import type { Workout } from "../types";
import { todayKey } from "../utils/date";
import { makeId } from "../utils/id";

export function createBlankWorkout(date = todayKey()): Workout {
  return {
    id: makeId(),
    date,
    exercises: [],
    calories: 0,
    notes: "",
    createdAt: new Date().toISOString(),
  };
}
