import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { type ChangeEvent, useRef } from "react";
import type { DayPhoto, Workout } from "../types";
import { formatDateLabel } from "../utils/date";

export function PhotoView({
  selectedDate,
  photos,
  workouts,
  onDateChange,
  onUpload,
  onDeletePhoto,
}: {
  selectedDate: string;
  photos: DayPhoto[];
  workouts: Workout[];
  onDateChange: (dateKey: string) => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onDeletePhoto: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">每日照片</h2>
          <p className="mt-1 text-sm text-slate-500">{formatDateLabel(selectedDate)}</p>
        </div>
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

      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={onUpload} />

      <label className="block">
        <span className="text-sm font-semibold">日期</span>
        <input
          type="date"
          value={selectedDate}
          onChange={(event) => onDateChange(event.target.value)}
          className="mt-2 h-12 w-full min-w-0 rounded-[8px] border border-line bg-white px-3 text-base outline-none focus:border-ocean"
        />
      </label>

      <div className="rounded-[8px] border border-line bg-white p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">当天训练</span>
          <span className="text-sm text-slate-500">{workouts.length} 次</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {workouts.length === 0 && <span className="text-sm text-slate-500">暂无记录</span>}
          {workouts.map((workout) => (
            <span key={workout.id} className="rounded-[8px] bg-mist px-3 py-2 text-sm font-semibold">
              {formatWorkoutTag(workout)}
            </span>
          ))}
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="rounded-[8px] border border-dashed border-line bg-white px-4 py-10 text-center">
          <Camera className="mx-auto text-slate-400" size={30} aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-slate-500">这一天还没有照片</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {photos.map((photo) => (
            <figure key={photo.id} className="relative overflow-hidden rounded-[8px] border border-line bg-white">
              <img src={photo.dataUrl} alt={`${photo.date} 训练照片`} className="aspect-[4/5] w-full object-cover" />
              <button
                type="button"
                onClick={() => onDeletePhoto(photo.id)}
                className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-[8px] bg-white/90 text-coral"
                aria-label="删除照片"
                title="删除照片"
              >
                <Trash2 size={17} aria-hidden="true" />
              </button>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}

function formatWorkoutTag(workout: Workout) {
  const names = workout.exercises.map((exercise) => exercise.exercise);
  if (names.length === 0) return "空训练";
  if (names.length <= 2) return names.join(" · ");
  return `${names.slice(0, 2).join(" · ")} 等`;
}
