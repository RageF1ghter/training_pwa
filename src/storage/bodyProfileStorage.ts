import type { BodyProfile, BodyProfileRecord, FitnessGoal, Gender } from "../types";

const STORAGE_KEY = "fitlog.bodyProfile";
const HISTORY_KEY = "fitlog.bodyProfileHistory";

const VALID_GOALS: readonly FitnessGoal[] = ["增肌", "减脂", "维持", "塑形", "增力"];

export function createEmptyBodyProfile(): BodyProfile {
  return { heightCm: 0, weightKg: 0, age: 0, gender: "", goal: "" };
}

export function readBodyProfile(): BodyProfile {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    const saved = value ? (JSON.parse(value) as Partial<BodyProfile>) : {};
    return normalizeBodyProfile(saved);
  } catch {
    return createEmptyBodyProfile();
  }
}

export function writeBodyProfile(bodyProfile: BodyProfile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bodyProfile));
}

export function readBodyProfileHistory(): BodyProfileRecord[] {
  try {
    const value = localStorage.getItem(HISTORY_KEY);
    const saved = value ? (JSON.parse(value) as unknown) : [];
    if (!Array.isArray(saved)) return [];
    const seen = new Set<string>();
    const records: BodyProfileRecord[] = [];
    for (const entry of saved) {
      const record = normalizeBodyProfileRecord(entry);
      if (!record || seen.has(record.id)) continue;
      seen.add(record.id);
      records.push(record);
    }
    return records.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  } catch {
    return [];
  }
}

export function writeBodyProfileHistory(history: BodyProfileRecord[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function normalizeBodyProfile(data: Partial<BodyProfile> | null | undefined): BodyProfile {
  if (!data || typeof data !== "object") return createEmptyBodyProfile();

  const gender = data.gender === "male" || data.gender === "female" ? (data.gender as Gender) : "";
  const goal = VALID_GOALS.includes(data.goal as FitnessGoal) ? (data.goal as FitnessGoal) : "";

  return {
    heightCm: clampNumber(data.heightCm),
    weightKg: clampNumber(data.weightKg),
    age: clampNumber(data.age),
    gender,
    goal,
  };
}

function normalizeBodyProfileRecord(data: unknown): BodyProfileRecord | null {
  if (!data || typeof data !== "object") return null;
  const entry = data as Partial<BodyProfileRecord>;
  const id = typeof entry.id === "string" ? entry.id.trim() : "";
  const recordedAt = typeof entry.recordedAt === "string" ? entry.recordedAt.trim() : "";
  if (!id || !recordedAt) return null;

  return {
    ...normalizeBodyProfile(entry),
    id,
    recordedAt,
  };
}

function clampNumber(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return num;
}
