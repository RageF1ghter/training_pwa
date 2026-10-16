import { Camera, ChevronLeft, ChevronRight, ImagePlus, Trash2 } from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { BodyPartIcon } from "../components/BodyPartIcon";
import { BodyPartPieChart } from "../components/BodyPartPieChart";
import { ExerciseLineChart } from "../components/ExerciseLineChart";
import { ExercisePieChart } from "../components/ExercisePieChart";
import { PoseAnalyzer } from "../components/PoseAnalyzer";
import { Stat } from "../components/Stat";
import { WorkoutList } from "../components/WorkoutList";
import { bodyParts } from "../data/exercises";
import type { CalendarMode, DayPhoto, Workout } from "../types";
import {
  addDays,
  formatDateLabel,
  formatMonthTitle,
  startOfMonth,
  startOfWeek,
  toDateKey,
  todayKey,
  weekdayLabels,
} from "../utils/date";
import {
  aggregateBodyPartReps,
  aggregateExerciseReps,
  getExerciseSetsWithDetails,
  sumCalories,
  sumSets,
} from "../utils/workouts";

export function OverviewView({
  mode,
  cursorDate,
  selectedDate,
  workoutsByDate,
  photosByDate,
  photos,
  onModeChange,
  onCursorDateChange,
  onSelectDate,
  onUpload,
  onDeletePhoto,
}: {
  mode: CalendarMode;
  cursorDate: Date;
  selectedDate: string;
  workoutsByDate: Record<string, Workout[]>;
  photosByDate: Record<string, DayPhoto[]>;
  photos: DayPhoto[];
  onModeChange: (mode: CalendarMode) => void;
  onCursorDateChange: (date: Date) => void;
  onSelectDate: (dateKey: string) => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onDeletePhoto: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const days = useMemo(() => {
    if (mode === "week") {
      const start = startOfWeek(cursorDate);
      return Array.from({ length: 7 }, (_, index) => addDays(start, index));
    }
    const first = startOfMonth(cursorDate);
    const gridStart = startOfWeek(first);
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [cursorDate, mode]);

  const selectedWorkouts = workoutsByDate[selectedDate] || [];
  const hasSelectedWorkouts = selectedWorkouts.length > 0;
  const rangeWorkouts = days.flatMap((day) => workoutsByDate[toDateKey(day)] || []);
  const periodCalories = sumCalories(rangeWorkouts);
  const periodSets = sumSets(rangeWorkouts);

  // All historical workouts (for body-part overview on empty days)
  const allWorkouts = useMemo(() => Object.values(workoutsByDate).flat(), [workoutsByDate]);
  const bodyPartAgg = useMemo(() => aggregateBodyPartReps(allWorkouts), [allWorkouts]);

  const [selectedChartExercise, setSelectedChartExercise] = useState<string | null>(null);
  // When selected date has workouts, show per-exercise distribution for that day;
  // otherwise the BodyPartPieChart replaces the exercise chart entirely.
  const exerciseRepsAgg = useMemo(
    () => (hasSelectedWorkouts ? aggregateExerciseReps(selectedWorkouts) : []),
    [hasSelectedWorkouts, selectedWorkouts],
  );
  const exerciseDetailSets = useMemo(
    () => (selectedChartExercise ? getExerciseSetsWithDetails(allWorkouts, selectedChartExercise) : []),
    [allWorkouts, selectedChartExercise],
  );

  useEffect(() => {
    if (selectedChartExercise && !exerciseRepsAgg.some((e) => e.exercise === selectedChartExercise)) {
      setSelectedChartExercise(null);
    }
  }, [selectedChartExercise, exerciseRepsAgg]);

  const moveCursor = (direction: -1 | 1) => {
    const next = new Date(cursorDate);
    if (mode === "week") next.setDate(next.getDate() + direction * 7);
    else next.setMonth(next.getMonth() + direction);
    onCursorDateChange(next);
  };

  return (
    <section className="space-y-5">
      {/* Title + week/month toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">总览</h2>
          <p className="mt-1 text-sm text-ink/50">{formatMonthTitle(cursorDate)}</p>
        </div>
        <div className="grid grid-cols-2 rounded-[8px] border border-line bg-glass backdrop-blur-md p-1">
          {(["week", "month"] as CalendarMode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onModeChange(item)}
              className={`h-9 rounded-[6px] px-3 text-sm font-semibold ${mode === item ? "bg-ocean text-mist" : "text-ink/50"}`}
            >
              {item === "week" ? "周" : "月"}
            </button>
          ))}
        </div>
      </div>

      {/* Period stats */}
      <div className="grid grid-cols-2 gap-2">
        <Stat label="周期组数" value={periodSets} />
        <Stat label="周期千卡" value={periodCalories} />
      </div>

      {/* Calendar grid */}
      <div className="rounded-[8px] border border-line bg-glass backdrop-blur-md p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => moveCursor(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-mist"
            aria-label="上一个周期"
            title="上一个周期"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              onCursorDateChange(new Date());
              onSelectDate(todayKey());
            }}
            className="h-10 rounded-[8px] bg-ocean px-4 text-sm font-semibold text-white"
          >
            今天
          </button>
          <button
            type="button"
            onClick={() => moveCursor(1)}
            className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-mist"
            aria-label="下一个周期"
            title="下一个周期"
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink/50">
          {weekdayLabels.map((label) => (
            <span key={label} className="py-2">
              {label}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const key = toDateKey(day);
            const dayWorkouts = workoutsByDate[key] || [];
            const trainedParts = new Set(
              dayWorkouts.flatMap((workout) => workout.exercises.filter((exercise) => exercise.sets.length > 0).map((exercise) => exercise.bodyPart)),
            );
            const dayBodyParts = bodyParts.filter((part) => trainedParts.has(part));
            const dayPhotos = photosByDate[key] || [];
            const inMonth = day.getMonth() === cursorDate.getMonth();
            const isSelected = key === selectedDate;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectDate(key)}
                className={`flex min-h-[88px] min-w-0 flex-col items-start rounded-[8px] border p-0.5 text-left ${
                  isSelected
                    ? "border-ocean bg-ocean text-white"
                    : inMonth || mode === "week"
                      ? "border-line bg-mist"
                      : "border-transparent bg-transparent text-ink/20"
                }`}
                aria-label={`${key} 训练 ${dayWorkouts.length} 次${dayBodyParts.length ? `，${dayBodyParts.join("、")}` : ""}${dayPhotos.length ? `，照片 ${dayPhotos.length} 张` : ""}`}
              >
                <span className="flex w-full items-center justify-between px-0.5 text-sm font-bold">
                  {day.getDate()}
                  {dayPhotos.length > 0 && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isSelected ? "bg-citrus" : "bg-ocean"}`} aria-hidden="true" />}
                </span>
                <div className="flex w-full flex-1 flex-col items-center justify-center gap-0.5" aria-hidden="true">
                  {dayBodyParts.slice(0, 2).map((part) => (
                    <BodyPartIcon key={part} bodyPart={part} size={48} fitContainer className={isSelected ? "text-mist" : "text-coral"} />
                  ))}
                  {dayBodyParts.length > 2 && (
                    <span className={`text-xs leading-[14px] ${isSelected ? "text-mist" : "text-coral"}`}>+{dayBodyParts.length - 2}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2 border-t border-line pt-3" aria-label="训练部位图例">
          {bodyParts.map((part) => (
            <span key={part} className="inline-flex items-center gap-1 text-xs text-ink/60">
              <BodyPartIcon bodyPart={part} size={24} className="text-coral" />
              {part}
            </span>
          ))}
        </div>
      </div>

      {/* Exercise / body-part distribution chart */}
      <div className="rounded-[8px] border border-line bg-glass backdrop-blur-md p-4">
        <h3 className="text-base font-bold">{hasSelectedWorkouts ? "训练分布" : "历史部位分布"}</h3>
        <div className="mt-3">
          {hasSelectedWorkouts ? (
            <ExercisePieChart
              data={exerciseRepsAgg}
              selectedExercise={selectedChartExercise}
              onSelectExercise={setSelectedChartExercise}
            />
          ) : (
            <BodyPartPieChart data={bodyPartAgg} />
          )}
        </div>
      </div>

      {/* Stacked line chart for selected exercise */}
      {selectedChartExercise && exerciseDetailSets.length > 0 && (
        <ExerciseLineChart
          exerciseName={selectedChartExercise}
          groupedSets={exerciseDetailSets}
          onClose={() => setSelectedChartExercise(null)}
        />
      )}

      {/* Selected day workouts */}
      <WorkoutList workouts={selectedWorkouts} onDeleteWorkout={() => undefined} emptyText={`${formatDateLabel(selectedDate)} 没有训练`} readonly />

      {/* Selected day photos */}
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={onUpload} />
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold">{formatDateLabel(selectedDate)} 照片</h3>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-citrus text-ink"
            aria-label="添加照片"
            title="添加照片"
          >
            <ImagePlus size={20} aria-hidden="true" />
          </button>
        </div>

        {photos.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-line bg-glass backdrop-blur-md px-4 py-10 text-center">
            <Camera className="mx-auto text-ink/30" size={30} aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-ink/50">这一天还没有照片</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {photos.map((photo) => (
              <figure key={photo.id} className="relative overflow-hidden rounded-[8px] border border-line bg-glass backdrop-blur-md">
                <img src={photo.dataUrl} alt={`${photo.date} 训练照片`} className="aspect-[4/5] w-full object-cover" />
                <button
                  type="button"
                  onClick={() => onDeletePhoto(photo.id)}
                  className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-[8px] glass-strong text-coral"
                  aria-label="删除照片"
                  title="删除照片"
                >
                  <Trash2 size={17} aria-hidden="true" />
                </button>
              </figure>
            ))}
          </div>
        )}
      </div>

      {/* Pose analysis for local videos */}
      <PoseAnalyzer />
    </section>
  );
}
