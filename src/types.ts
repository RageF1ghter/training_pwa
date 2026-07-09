export type BodyPart = "胸部" | "背部" | "腿部" | "肩部" | "手臂" | "核心" | "有氧" | "全身";

export type CustomExerciseMap = Record<BodyPart, string[]>;

export type HiddenExerciseMap = Record<BodyPart, string[]>;

export type ExerciseOrderMap = Record<BodyPart, string[]>;

export type CalendarMode = "week" | "month";

export type Tab = "record" | "calendar" | "photos" | "settings";

export type WorkoutSet = {
  id: string;
  weight: number;
  reps: number;
  durationSeconds: number;
  startedAt?: number;
  finishedAt?: number;
};

export type WorkoutExercise = {
  id: string;
  bodyPart: BodyPart;
  exercise: string;
  sets: WorkoutSet[];
};

export type Workout = {
  id: string;
  date: string;
  exercises: WorkoutExercise[];
  calories: number;
  createdAt: string;
  startedAt?: number;
};

export type DayPhoto = {
  id: string;
  date: string;
  dataUrl: string;
  createdAt: string;
};

export type Gender = "male" | "female";

export type FitnessGoal = "增肌" | "减脂" | "维持" | "塑形" | "增力";

export type BodyProfile = {
  heightCm: number;
  weightKg: number;
  age: number;
  gender: Gender | "";
  goal: FitnessGoal | "";
};

export type BodyProfileRecord = BodyProfile & {
  id: string;
  recordedAt: string;
};

export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

export type ChatSummary = {
  content: string;
  summarizedUpTo: string;
  createdAt: string;
};
