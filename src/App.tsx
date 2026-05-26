import { Activity, CalendarDays, Camera, Dumbbell } from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [tab, setTab] = useState<Tab>("record");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("week");
  const [cursorDate, setCursorDate] = useState(() => new Date());

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

  const workoutsByDate = useMemo(() => groupWorkoutsByDate(workouts), [workouts]);
  const photosByDate = useMemo(() => groupPhotosByDate(photos), [photos]);
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

    const nextWorkout = {
      ...draftWorkout,
      notes: draftWorkout.notes.trim(),
      exercises: cleanedExercises,
      calories: Math.max(0, Number(draftWorkout.calories) || 0),
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
  };

  const deleteWorkout = (id: string) => {
    setWorkouts((items) => items.filter((item) => item.id !== id));
  };

  const startSetTimer = () => {
    setTimerStartedAt(Date.now());
    setElapsedSeconds(0);
  };

  const finishSetTimer = () => {
    if (timerStartedAt === null) return;
    setElapsedSeconds(Math.max(1, Math.floor((Date.now() - timerStartedAt) / 1000)));
    setTimerStartedAt(null);
  };

  const resetCurrentSet = () => {
    setTimerStartedAt(null);
    setElapsedSeconds(0);
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
    setSetReps("10");
    resetCurrentSet();
  };

  const deleteDraftSet = (exerciseId: string, setId: string) => {
    setDraftWorkout((current) => ({
      ...current,
      exercises: current.exercises
        .map((exercise) => (exercise.id === exerciseId ? { ...exercise, sets: exercise.sets.filter((set) => set.id !== setId) } : exercise))
        .filter((exercise) => exercise.sets.length > 0),
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

  return (
    <div className="min-h-screen bg-mist text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-surface shadow-lift">
        <header className="safe-top border-b border-line bg-surface/95 px-5 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ocean">
                FitLog <span className="font-normal text-ink/40">v{__APP_VERSION__}</span>
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-normal">训练记录</h1>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-[8px] bg-ocean text-mist">
              <Dumbbell size={24} aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label="训练" value={workouts.length} />
            <Stat label="组数" value={sumSets(workouts)} />
            <Stat label="千卡" value={sumCalories(workouts)} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-5 pb-24 pt-5">
          {tab === "record" && (
            <RecordView
              draftWorkout={draftWorkout}
              selectedBodyPart={selectedBodyPart}
              selectedExercise={selectedExercise}
              setWeight={setWeight}
              setReps={setReps}
              elapsedSeconds={elapsedSeconds}
              timerStartedAt={timerStartedAt}
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
              onAddCustomExercise={addExerciseToCurrentGroup}
              onDeleteCustomExercise={deleteExerciseFromCurrentGroup}
              onReorderExercises={reorderExerciseGroup}
              onDeleteWorkout={deleteWorkout}
              onDateChange={selectDate}
            />
          )}

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
        </main>

        <nav className="safe-bottom fixed bottom-0 left-1/2 grid w-full max-w-[430px] -translate-x-1/2 grid-cols-3 border-t border-line bg-surface/95 px-5 pt-2 backdrop-blur">
          <TabButton icon={<Activity size={21} />} label="记录" active={tab === "record"} onClick={() => setTab("record")} />
          <TabButton icon={<CalendarDays size={21} />} label="日历" active={tab === "calendar"} onClick={() => setTab("calendar")} />
          <TabButton icon={<Camera size={21} />} label="照片" active={tab === "photos"} onClick={() => setTab("photos")} />
        </nav>
      </div>
    </div>
  );
}

function getVisibleExercises(bodyPart: BodyPart, customExercises: CustomExerciseMap, hiddenExercises: HiddenExerciseMap) {
  return [...exercisePresets[bodyPart].filter((exercise) => !hiddenExercises[bodyPart].includes(exercise)), ...customExercises[bodyPart]];
}
