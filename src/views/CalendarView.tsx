import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { Stat } from "../components/Stat";
import { WorkoutList } from "../components/WorkoutList";
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
import { sumCalories, sumSets } from "../utils/workouts";

export function CalendarView({
  mode,
  cursorDate,
  selectedDate,
  workoutsByDate,
  photosByDate,
  onModeChange,
  onCursorDateChange,
  onSelectDate,
}: {
  mode: CalendarMode;
  cursorDate: Date;
  selectedDate: string;
  workoutsByDate: Record<string, Workout[]>;
  photosByDate: Record<string, DayPhoto[]>;
  onModeChange: (mode: CalendarMode) => void;
  onCursorDateChange: (date: Date) => void;
  onSelectDate: (dateKey: string) => void;
}) {
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
  const rangeWorkouts = days.flatMap((day) => workoutsByDate[toDateKey(day)] || []);
  const periodCalories = sumCalories(rangeWorkouts);
  const periodSets = sumSets(rangeWorkouts);

  const moveCursor = (direction: -1 | 1) => {
    const next = new Date(cursorDate);
    if (mode === "week") next.setDate(next.getDate() + direction * 7);
    else next.setMonth(next.getMonth() + direction);
    onCursorDateChange(next);
  };

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">训练日历</h2>
          <p className="mt-1 text-sm text-ink/50">{formatMonthTitle(cursorDate)}</p>
        </div>
        <div className="grid grid-cols-2 rounded-[8px] border border-line bg-surface p-1">
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

      <div className="grid grid-cols-2 gap-2">
        <Stat label="周期组数" value={periodSets} />
        <Stat label="周期千卡" value={periodCalories} />
      </div>

      <div className="rounded-[8px] border border-line bg-surface p-4">
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
            const dayPhotos = photosByDate[key] || [];
            const inMonth = day.getMonth() === cursorDate.getMonth();
            const isSelected = key === selectedDate;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectDate(key)}
                className={`aspect-square rounded-[8px] border p-1 text-left ${
                  isSelected
                    ? "border-ocean bg-ocean text-white"
                    : inMonth || mode === "week"
                      ? "border-line bg-mist"
                      : "border-transparent bg-transparent text-ink/20"
                }`}
                aria-label={`${key} 训练 ${dayWorkouts.length} 次`}
              >
                <span className="text-sm font-bold">{day.getDate()}</span>
                <div className="mt-1 flex min-h-[14px] gap-1">
                  {dayWorkouts.length > 0 && <span className={`h-2 w-2 rounded-full ${isSelected ? "bg-surface" : "bg-coral"}`} />}
                  {dayPhotos.length > 0 && <span className={`h-2 w-2 rounded-full ${isSelected ? "bg-citrus" : "bg-ocean"}`} />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <WorkoutList workouts={selectedWorkouts} onDeleteWorkout={() => undefined} emptyText={`${formatDateLabel(selectedDate)} 没有训练`} readonly />
    </section>
  );
}
