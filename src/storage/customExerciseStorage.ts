import { bodyParts, exercisePresets } from "../data/exercises";
import type { BodyPart, CustomExerciseMap, ExerciseOrderMap, HiddenExerciseMap } from "../types";

const CUSTOM_STORAGE_KEY = "fitlog.customExercises";
const HIDDEN_STORAGE_KEY = "fitlog.hiddenExercises";
const ORDER_STORAGE_KEY = "fitlog.exerciseOrder";

export function createEmptyCustomExerciseMap(): CustomExerciseMap {
  return bodyParts.reduce((map, bodyPart) => {
    map[bodyPart] = [];
    return map;
  }, {} as CustomExerciseMap);
}

export function readCustomExercises() {
  try {
    const value = localStorage.getItem(CUSTOM_STORAGE_KEY);
    const saved = value ? (JSON.parse(value) as Partial<Record<BodyPart, string[]>>) : {};
    const map = createEmptyCustomExerciseMap();

    bodyParts.forEach((bodyPart) => {
      map[bodyPart] = normalizeExercises(saved[bodyPart] || [], bodyPart);
    });

    return map;
  } catch {
    return createEmptyCustomExerciseMap();
  }
}

export function writeCustomExercises(customExercises: CustomExerciseMap) {
  localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(customExercises));
}

export function addCustomExercise(customExercises: CustomExerciseMap, bodyPart: BodyPart, exercise: string) {
  const name = exercise.trim();
  if (!name || exercisePresets[bodyPart].includes(name) || customExercises[bodyPart].includes(name)) {
    return customExercises;
  }

  return {
    ...customExercises,
    [bodyPart]: [...customExercises[bodyPart], name],
  };
}

export function removeCustomExercise(customExercises: CustomExerciseMap, bodyPart: BodyPart, exercise: string) {
  return {
    ...customExercises,
    [bodyPart]: customExercises[bodyPart].filter((item) => item !== exercise),
  };
}

export function createEmptyHiddenExerciseMap(): HiddenExerciseMap {
  return bodyParts.reduce((map, bodyPart) => {
    map[bodyPart] = [];
    return map;
  }, {} as HiddenExerciseMap);
}

export function readHiddenExercises() {
  try {
    const value = localStorage.getItem(HIDDEN_STORAGE_KEY);
    const saved = value ? (JSON.parse(value) as Partial<Record<BodyPart, string[]>>) : {};
    const map = createEmptyHiddenExerciseMap();

    bodyParts.forEach((bodyPart) => {
      map[bodyPart] = normalizeHiddenExercises(saved[bodyPart] || [], bodyPart);
    });

    return map;
  } catch {
    return createEmptyHiddenExerciseMap();
  }
}

export function writeHiddenExercises(hiddenExercises: HiddenExerciseMap) {
  localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(hiddenExercises));
}

export function hidePresetExercise(hiddenExercises: HiddenExerciseMap, bodyPart: BodyPart, exercise: string) {
  if (!exercisePresets[bodyPart].includes(exercise) || hiddenExercises[bodyPart].includes(exercise)) {
    return hiddenExercises;
  }

  return {
    ...hiddenExercises,
    [bodyPart]: [...hiddenExercises[bodyPart], exercise],
  };
}

export function createEmptyExerciseOrderMap(): ExerciseOrderMap {
  return bodyParts.reduce((map, bodyPart) => {
    map[bodyPart] = [];
    return map;
  }, {} as ExerciseOrderMap);
}

export function readExerciseOrder() {
  try {
    const value = localStorage.getItem(ORDER_STORAGE_KEY);
    const saved = value ? (JSON.parse(value) as Partial<Record<BodyPart, string[]>>) : {};
    const map = createEmptyExerciseOrderMap();

    bodyParts.forEach((bodyPart) => {
      map[bodyPart] = normalizeOrder(saved[bodyPart] || []);
    });

    return map;
  } catch {
    return createEmptyExerciseOrderMap();
  }
}

export function writeExerciseOrder(exerciseOrder: ExerciseOrderMap) {
  localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(exerciseOrder));
}

export function setExerciseOrderForBodyPart(exerciseOrder: ExerciseOrderMap, bodyPart: BodyPart, exercises: string[]) {
  return {
    ...exerciseOrder,
    [bodyPart]: normalizeOrder(exercises),
  };
}

function normalizeExercises(exercises: string[], bodyPart: BodyPart) {
  const seen = new Set<string>();

  return exercises
    .map((exercise) => exercise.trim())
    .filter((exercise) => {
      if (!exercise || seen.has(exercise) || exercisePresets[bodyPart].includes(exercise)) return false;
      seen.add(exercise);
      return true;
    });
}

function normalizeHiddenExercises(exercises: string[], bodyPart: BodyPart) {
  const seen = new Set<string>();

  return exercises
    .map((exercise) => exercise.trim())
    .filter((exercise) => {
      if (!exercise || seen.has(exercise) || !exercisePresets[bodyPart].includes(exercise)) return false;
      seen.add(exercise);
      return true;
    });
}

function normalizeOrder(exercises: string[]) {
  const seen = new Set<string>();

  return exercises
    .map((exercise) => exercise.trim())
    .filter((exercise) => {
      if (!exercise || seen.has(exercise)) return false;
      seen.add(exercise);
      return true;
    });
}
