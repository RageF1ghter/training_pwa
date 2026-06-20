import { Activity, CalendarDays, Camera, Flame, Settings } from "lucide-react";
import JSZip from "jszip";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Stat } from "./components/Stat";
import { TabButton } from "./components/TabButton";
import { exercisePresets } from "./data/exercises";
import { createBlankWorkout } from "./factories/workout";
import {
  addCustomExercise,
  hidePresetExercise,
  readCustomExercises,
  readExerciseOrder,
  readHiddenExercises,
  removeCustomExercise,
  setExerciseOrderForBodyPart,
  writeCustomExercises,
  writeExerciseOrder,
  writeHiddenExercises,
} from "./storage/customExerciseStorage";
import { fileToDataUrl, getPhotos, removePhoto, savePhoto } from "./storage/photoStorage";
import { readWorkouts, writeWorkouts } from "./storage/workoutStorage";
import type { BodyPart, CalendarMode, CustomExerciseMap, DayPhoto, ExerciseOrderMap, HiddenExerciseMap, Tab, Workout } from "./types";
import { todayKey } from "./utils/date";
import { makeId } from "./utils/id";
import { groupPhotosByDate, groupWorkoutsByDate, sumCalories, sumSets } from "./utils/workouts";
import { CalendarView } from "./views/CalendarView";
import { PhotoView } from "./views/PhotoView";
import { SettingsView } from "./views/SettingsView";
import type { DateInfo } from "./views/SettingsView";
import { RecordView } from "./views/RecordView";

export default function App() {
  const [workouts, setWorkouts] = useState<Workout[]>(() => readWorkouts());
  const [customExercises, setCustomExercises] = useState<CustomExerciseMap>(() => readCustomExercises());
  const [hiddenExercises, setHiddenExercises] = useState<HiddenExerciseMap>(() => readHiddenExercises());
  const [exerciseOrder, setExerciseOrder] = useState<ExerciseOrderMap>(() => readExerciseOrder());
  const [photos, setPhotos] = useState<DayPhoto[]>([]);
  const [draftWorkout, setDraftWorkout] = useState<Workout>(() => createBlankWorkout());
  const [selectedBodyPart, setSelectedBodyPart] = useState<BodyPart>("胸部");
  const [selectedExercise, setSelectedExercise] = useState(() => exercisePresets["胸部"][0]);
  const [setWeight, setSetWeight] = useState("");
  const [setReps, setSetReps] = useState("10");
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null);
  const [setStartTimestamp, setSetStartTimestamp] = useState<number | null>(null);
  const [setFinishTimestamp, setSetFinishTimestamp] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [restStartedAt, setRestStartedAt] = useState<number | null>(null);
  const [restSeconds, setRestSeconds] = useState(0);
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [tab, setTab] = useState<Tab>("record");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>(() => {
    try {
      const saved = localStorage.getItem("fitlog.calendarMode");
      if (saved === "week" || saved === "month") return saved;
    } catch { /* noop */ }
    return "week";
  });
  const [cursorDate, setCursorDate] = useState(() => new Date());
  const [isLightTheme, setIsLightTheme] = useState(() => {
    try {
      return localStorage.getItem("fitlog.theme") === "light";
    } catch {
      return false;
    }
  });
  const [calorieDialogOpen, setCalorieDialogOpen] = useState(false);
  const [calorieDialogValue, setCalorieDialogValue] = useState("");
  const calorieDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem("fitlog.theme", isLightTheme ? "light" : "dark");
    } catch { /* noop */ }
    document.documentElement.classList.toggle("light", isLightTheme);
  }, [isLightTheme]);

  useEffect(() => {
    try {
      localStorage.setItem("fitlog.calendarMode", calendarMode);
    } catch { /* noop */ }
  }, [calendarMode]);

  useEffect(() => {
    writeWorkouts(workouts);
  }, [workouts]);

  useEffect(() => {
    writeCustomExercises(customExercises);
  }, [customExercises]);

  useEffect(() => {
    writeHiddenExercises(hiddenExercises);
  }, [hiddenExercises]);

  useEffect(() => {
    writeExerciseOrder(exerciseOrder);
  }, [exerciseOrder]);

  useEffect(() => {
    getPhotos()
      .then((items) => setPhotos(items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))))
      .catch(() => setPhotos([]));
  }, []);

  useEffect(() => {
    if (timerStartedAt === null) return;

    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - timerStartedAt) / 1000)));
    }, 250);

    return () => window.clearInterval(interval);
  }, [timerStartedAt]);

  useEffect(() => {
    if (restStartedAt === null) return;

    const interval = window.setInterval(() => {
      setRestSeconds(Math.max(0, Math.floor((Date.now() - restStartedAt) / 1000)));
    }, 250);

    return () => window.clearInterval(interval);
  }, [restStartedAt]);

  useEffect(() => {
    const dialog = calorieDialogRef.current;
    if (!dialog) return;
    if (calorieDialogOpen && !dialog.open) dialog.showModal();
    else if (!calorieDialogOpen && dialog.open) dialog.close();
  }, [calorieDialogOpen]);

  const workoutsByDate = useMemo(() => groupWorkoutsByDate(workouts), [workouts]);
  const photosByDate = useMemo(() => groupPhotosByDate(photos), [photos]);
  const availableDates = useMemo((): DateInfo[] => {
    const dateMap = new Map<string, { workoutCount: number; photoCount: number }>();
    Object.entries(workoutsByDate).forEach(([dateKey, ws]) => {
      dateMap.set(dateKey, { workoutCount: ws.length, photoCount: 0 });
    });
    Object.entries(photosByDate).forEach(([dateKey, ps]) => {
      const entry = dateMap.get(dateKey);
      if (entry) {
        entry.photoCount = ps.length;
      } else {
        dateMap.set(dateKey, { workoutCount: 0, photoCount: ps.length });
      }
    });
    return Array.from(dateMap.entries())
      .map(([dateKey, counts]) => ({ dateKey, ...counts }))
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [workoutsByDate, photosByDate]);
  const selectedWorkouts = workoutsByDate[selectedDate] || [];
  const selectedPhotos = photosByDate[selectedDate] || [];

  const saveWorkout = () => {
    const cleanedExercises = draftWorkout.exercises
      .map((exercise) => ({
        ...exercise,
        exercise: exercise.exercise.trim(),
        sets: exercise.sets.map((set) => ({
          ...set,
          weight: Math.max(0, Number(set.weight) || 0),
          reps: Math.max(0, Number(set.reps) || 0),
          durationSeconds: Math.max(0, Number(set.durationSeconds) || 0),
        })),
      }))
      .filter((exercise) => exercise.exercise && exercise.sets.length > 0);
    if (cleanedExercises.length === 0) return;

    setCalorieDialogValue("");
    setCalorieDialogOpen(true);
  };

  const confirmSaveWorkout = () => {
    const cleanedExercises = draftWorkout.exercises
      .map((exercise) => ({
        ...exercise,
        exercise: exercise.exercise.trim(),
        sets: exercise.sets.map((set) => ({
          ...set,
          weight: Math.max(0, Number(set.weight) || 0),
          reps: Math.max(0, Number(set.reps) || 0),
          durationSeconds: Math.max(0, Number(set.durationSeconds) || 0),
        })),
      }))
      .filter((exercise) => exercise.exercise && exercise.sets.length > 0);
    if (cleanedExercises.length === 0) return;

    const nextWorkout = {
      ...draftWorkout,
      exercises: cleanedExercises,
      calories: Math.max(0, Number(calorieDialogValue) || 0),
      createdAt: new Date().toISOString(),
    };

    setWorkouts((items) => [nextWorkout, ...items]);
    nextWorkout.exercises.forEach((exercise) => {
      setCustomExercises((items) => addCustomExercise(items, exercise.bodyPart, exercise.exercise));
    });
    setSelectedDate(nextWorkout.date);
    setDraftWorkout(createBlankWorkout(nextWorkout.date));
    setElapsedSeconds(0);
    setTimerStartedAt(null);
    setSetStartTimestamp(null);
    setSetFinishTimestamp(null);
    setIsResting(false);
    setRestStartedAt(null);
    setRestSeconds(0);
    setCalorieDialogOpen(false);
  };

  const deleteWorkout = (id: string) => {
    setWorkouts((items) => items.filter((item) => item.id !== id));
  };

  const startSetTimer = () => {
    if (isResting) {
      setIsResting(false);
      setRestStartedAt(null);
      setRestSeconds(0);
    }
    const now = Date.now();
    setTimerStartedAt(now);
    setSetStartTimestamp(now);
    setSetFinishTimestamp(null);
    setElapsedSeconds(0);
    setDraftWorkout((current) => {
      if (current.startedAt) return current;
      return { ...current, startedAt: now };
    });
  };

  const finishSetTimer = () => {
    if (timerStartedAt === null) return;
    const now = Date.now();
    setElapsedSeconds(Math.max(1, Math.floor((now - timerStartedAt) / 1000)));
    setSetFinishTimestamp(now);
    setTimerStartedAt(null);
  };

  const resetCurrentSet = () => {
    setTimerStartedAt(null);
    setSetStartTimestamp(null);
    setSetFinishTimestamp(null);
    setElapsedSeconds(0);
    setIsResting(false);
    setRestStartedAt(null);
    setRestSeconds(0);
  };

  const addSetToDraftWorkout = () => {
    const exerciseName = selectedExercise.trim();
    if (!exerciseName || elapsedSeconds <= 0 || Number(setReps) <= 0) return;

    setDraftWorkout((current) => {
      const nextSet = {
        id: makeId(),
        weight: Math.max(0, Number(setWeight) || 0),
        reps: Math.max(0, Number(setReps) || 0),
        durationSeconds: Math.max(0, Number(elapsedSeconds) || 0),
        startedAt: setStartTimestamp ?? undefined,
        finishedAt: setFinishTimestamp ?? undefined,
      };
      const existingExercise = current.exercises.find(
        (exercise) => exercise.bodyPart === selectedBodyPart && exercise.exercise === exerciseName,
      );

      if (existingExercise) {
        return {
          ...current,
          exercises: current.exercises.map((exercise) =>
            exercise.id === existingExercise.id ? { ...exercise, sets: [...exercise.sets, nextSet] } : exercise,
          ),
        };
      }

      return {
        ...current,
        exercises: [
          ...current.exercises,
          {
            id: makeId(),
            bodyPart: selectedBodyPart,
            exercise: exerciseName,
            sets: [nextSet],
          },
        ],
      };
    });
    resetCurrentSet();
    setIsResting(true);
    setRestStartedAt(Date.now());
    setRestSeconds(0);
  };

  const deleteDraftSet = (exerciseId: string, setId: string) => {
    setDraftWorkout((current) => ({
      ...current,
      exercises: current.exercises
        .map((exercise) => (exercise.id === exerciseId ? { ...exercise, sets: exercise.sets.filter((set) => set.id !== setId) } : exercise))
        .filter((exercise) => exercise.sets.length > 0),
    }));
  };

  const updateDraftSet = (exerciseId: string, setId: string, updates: { weight: number; reps: number; durationSeconds: number }) => {
    setDraftWorkout((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: exercise.sets.map((set) =>
                set.id === setId
                  ? { ...set, weight: updates.weight, reps: updates.reps, durationSeconds: updates.durationSeconds, finishedAt: set.startedAt != null ? set.startedAt + updates.durationSeconds * 1000 : set.finishedAt }
                  : set,
              ),
            }
          : exercise,
      ),
    }));
  };

  const addExerciseToCurrentGroup = (bodyPart: BodyPart, exercise: string) => {
    const name = exercise.trim();
    if (!name) return;

    setCustomExercises((items) => addCustomExercise(items, bodyPart, name));
    setExerciseOrder((items) =>
      items[bodyPart].includes(name) ? items : setExerciseOrderForBodyPart(items, bodyPart, [...items[bodyPart], name]),
    );
    setSelectedBodyPart(bodyPart);
    setSelectedExercise(name);
  };

  const deleteExerciseFromCurrentGroup = (bodyPart: BodyPart, exercise: string) => {
    const isPreset = exercisePresets[bodyPart].includes(exercise);

    if (isPreset) {
      setHiddenExercises((items) => hidePresetExercise(items, bodyPart, exercise));
    } else {
      setCustomExercises((items) => removeCustomExercise(items, bodyPart, exercise));
    }

    setExerciseOrder((items) => setExerciseOrderForBodyPart(items, bodyPart, items[bodyPart].filter((item) => item !== exercise)));

    if (selectedBodyPart === bodyPart && selectedExercise === exercise) {
      const nextHiddenExercises = isPreset ? [...hiddenExercises[bodyPart], exercise] : hiddenExercises[bodyPart];
      const nextCustomExercises = isPreset ? customExercises[bodyPart] : customExercises[bodyPart].filter((item) => item !== exercise);
      const nextExercise = [...exercisePresets[bodyPart].filter((item) => !nextHiddenExercises.includes(item)), ...nextCustomExercises][0] || "";
      setSelectedExercise(nextExercise);
    }
  };

  const reorderExerciseGroup = (bodyPart: BodyPart, exercises: string[]) => {
    setExerciseOrder((items) => setExerciseOrderForBodyPart(items, bodyPart, exercises));
  };

  const selectDate = (dateKey: string) => {
    setSelectedDate(dateKey);
    setDraftWorkout((current) => ({ ...current, date: dateKey }));
  };

  const changeSelectedBodyPart = (bodyPart: BodyPart) => {
    const exercises = getVisibleExercises(bodyPart, customExercises, hiddenExercises);
    setSelectedBodyPart(bodyPart);
    setSelectedExercise(exercises[0] || "");
  };

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const nextPhotos = await Promise.all(
      files.map(async (file) => ({
        id: makeId(),
        date: selectedDate,
        dataUrl: await fileToDataUrl(file),
        createdAt: new Date().toISOString(),
      })),
    );

    await Promise.all(nextPhotos.map(savePhoto));
    setPhotos((items) => [...nextPhotos, ...items]);
    event.target.value = "";
  };

  const deletePhoto = async (id: string) => {
    await removePhoto(id);
    setPhotos((items) => items.filter((item) => item.id !== id));
  };

  const handleExport = async (dateKeys?: string[]) => {
    const isPartial = dateKeys && dateKeys.length > 0;
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      appVersion: __APP_VERSION__,
      workouts: isPartial ? workouts.filter((w) => dateKeys.includes(w.date)) : workouts,
      customExercises,
      hiddenExercises,
      exerciseOrder,
      photos: isPartial ? photos.filter((p) => dateKeys.includes(p.date)) : photos,
    };

    const zip = new JSZip();
    zip.file("data.json", JSON.stringify(exportData, null, 2));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fitlog-backup-${todayKey()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File): Promise<{ success: boolean; message: string }> => {
    try {
      let json: unknown;

      if (file.name.endsWith(".zip")) {
        const zip = await JSZip.loadAsync(file);
        const dataFile = zip.file("data.json");
        if (!dataFile) return { success: false, message: "无效的备份文件：未找到 data.json" };
        json = JSON.parse(await dataFile.async("string"));
      } else {
        json = JSON.parse(await file.text());
      }

      const data = json as Record<string, unknown>;
      if (typeof data.version !== "number" || !Array.isArray(data.workouts) || !Array.isArray(data.photos)) {
        return { success: false, message: "无效的备份文件：数据格式不正确" };
      }

      const importedWorkouts = data.workouts as Workout[];
      const importedPhotos = data.photos as DayPhoto[];
      const importedDates = new Set([
        ...importedWorkouts.map((w) => w.date),
        ...importedPhotos.map((p) => p.date),
      ]);

      // Merge workouts: remove existing for imported dates, add imported
      setWorkouts((prev) => [...prev.filter((w) => !importedDates.has(w.date)), ...importedWorkouts]);

      // Replace exercise config
      if (data.customExercises && typeof data.customExercises === "object") {
        setCustomExercises(data.customExercises as typeof customExercises);
      }
      if (data.hiddenExercises && typeof data.hiddenExercises === "object") {
        setHiddenExercises(data.hiddenExercises as typeof hiddenExercises);
      }
      if (data.exerciseOrder && typeof data.exerciseOrder === "object") {
        setExerciseOrder(data.exerciseOrder as typeof exerciseOrder);
      }

      // Merge photos: remove existing for imported dates, then save imported
      const photosToRemove = photos.filter((p) => importedDates.has(p.date));
      await Promise.all(photosToRemove.map((p) => removePhoto(p.id)));
      await Promise.all(importedPhotos.map((p) => savePhoto(p)));
      setPhotos((prev) => [...prev.filter((p) => !importedDates.has(p.date)), ...importedPhotos]);

      return {
        success: true,
        message: `导入成功！已恢复 ${importedWorkouts.length} 条训练，${importedPhotos.length} 张照片`,
      };
    } catch {
      return { success: false, message: "导入失败：无法读取文件" };
    }
  };

  return (
    <div className="min-h-screen bg-mist text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-glass backdrop-blur-xl shadow-glass pb-24">
        <header className="safe-top border-b border-line glass-strong px-5 pb-4">
          <div>
            <p className="text-sm font-semibold text-ocean">
              FitLog <span className="font-normal text-ink/40">v{__APP_VERSION__}</span>
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-normal">{calendarMode === "week" ? "本周训练记录" : "本月训练记录"}</h1>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label="训练" value={workouts.length} />
            <Stat label="组数" value={sumSets(workouts)} />
            <Stat label="千卡" value={sumCalories(workouts)} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-5 pt-5">
          {tab === "record" && (
            <RecordView
              draftWorkout={draftWorkout}
              selectedBodyPart={selectedBodyPart}
              selectedExercise={selectedExercise}
              setWeight={setWeight}
              setReps={setReps}
              elapsedSeconds={elapsedSeconds}
              timerStartedAt={timerStartedAt}
              isResting={isResting}
              restSeconds={restSeconds}
              selectedDate={selectedDate}
              selectedWorkouts={selectedWorkouts}
              customExercises={customExercises}
              hiddenExercises={hiddenExercises}
              exerciseOrder={exerciseOrder}
              onDraftWorkoutChange={setDraftWorkout}
              onSelectedBodyPartChange={changeSelectedBodyPart}
              onSelectedExerciseChange={setSelectedExercise}
              onSetWeightChange={setSetWeight}
              onSetRepsChange={setSetReps}
              onStartSetTimer={startSetTimer}
              onFinishSetTimer={finishSetTimer}
              onResetCurrentSet={resetCurrentSet}
              onSave={saveWorkout}
              onAddSet={addSetToDraftWorkout}
              onDeleteDraftSet={deleteDraftSet}
              onUpdateDraftSet={updateDraftSet}
              onAddCustomExercise={addExerciseToCurrentGroup}
              onDeleteCustomExercise={deleteExerciseFromCurrentGroup}
              onReorderExercises={reorderExerciseGroup}
              onDeleteWorkout={deleteWorkout}
              onDateChange={selectDate}
            />
          )}

          <dialog
            ref={calorieDialogRef}
            onClose={() => setCalorieDialogOpen(false)}
            className="w-[min(340px,calc(100vw-40px))] rounded-[8px] border border-line bg-glass backdrop-blur-xl p-0 text-ink shadow-glass backdrop:bg-ink/35"
          >
            <div className="p-5">
              <h3 className="text-lg font-bold">输入训练消耗</h3>
              <p className="mt-2 text-sm leading-6 text-ink/60">请输入本次训练消耗的卡路里。</p>
              <label className="mt-4 block">
                <div className="flex items-center gap-2 rounded-[8px] border border-line bg-mist px-3">
                  <Flame className="text-coral" size={19} aria-hidden="true" />
                  <input
                    type="number"
                    min="0"
                    inputMode="decimal"
                    value={calorieDialogValue}
                    onChange={(event) => setCalorieDialogValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        confirmSaveWorkout();
                      }
                    }}
                    className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none"
                    placeholder="0"
                    aria-label="卡路里"
                    autoFocus
                  />
                  <span className="text-sm text-ink/50">kcal</span>
                </div>
              </label>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" onClick={confirmSaveWorkout} className="h-11 rounded-[8px] bg-ocean px-3 text-sm font-semibold text-white">
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => setCalorieDialogOpen(false)}
                  className="h-11 rounded-[8px] bg-mist px-3 text-sm font-semibold text-ink/60"
                >
                  取消
                </button>
              </div>
            </div>
          </dialog>

          {tab === "calendar" && (
            <CalendarView
              mode={calendarMode}
              cursorDate={cursorDate}
              selectedDate={selectedDate}
              workoutsByDate={workoutsByDate}
              photosByDate={photosByDate}
              onModeChange={setCalendarMode}
              onCursorDateChange={setCursorDate}
              onSelectDate={selectDate}
            />
          )}

          {tab === "photos" && (
            <PhotoView
              selectedDate={selectedDate}
              photos={selectedPhotos}
              workouts={selectedWorkouts}
              onDateChange={selectDate}
              onUpload={handlePhotoUpload}
              onDeletePhoto={deletePhoto}
            />
          )}

          {tab === "settings" && (
            <SettingsView
              isLightTheme={isLightTheme}
              onThemeToggle={() => setIsLightTheme((prev) => !prev)}
              availableDates={availableDates}
              onExport={handleExport}
              onImport={handleImport}
            />
          )}
        </main>
      </div>

      <nav className="safe-bottom fixed bottom-0 left-1/2 z-50 grid w-full max-w-[430px] -translate-x-1/2 grid-cols-4 border-t border-line glass-strong px-5 pt-2">
        <TabButton icon={<Activity size={21} />} label="记录" active={tab === "record"} onClick={() => setTab("record")} />
        <TabButton icon={<CalendarDays size={21} />} label="日历" active={tab === "calendar"} onClick={() => setTab("calendar")} />
        <TabButton icon={<Camera size={21} />} label="照片" active={tab === "photos"} onClick={() => setTab("photos")} />
        <TabButton icon={<Settings size={21} />} label="设置" active={tab === "settings"} onClick={() => setTab("settings")} />
      </nav>
    </div>
  );
}

function getVisibleExercises(bodyPart: BodyPart, customExercises: CustomExerciseMap, hiddenExercises: HiddenExerciseMap) {
  return [...exercisePresets[bodyPart].filter((exercise) => !hiddenExercises[bodyPart].includes(exercise)), ...customExercises[bodyPart]];
}
