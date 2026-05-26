import {
  closestCenter,
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Flame, Play, Plus, RotateCcw, Save, Square, Trash2, X } from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";
import { WorkoutList } from "../components/WorkoutList";
import { bodyParts, exercisePresets } from "../data/exercises";
import type { BodyPart, CustomExerciseMap, ExerciseOrderMap, HiddenExerciseMap, Workout } from "../types";
import { formatDateLabel } from "../utils/date";
import { countWorkoutReps, countWorkoutSets, formatDuration } from "../utils/workouts";

export function RecordView({
  draftWorkout,
  selectedBodyPart,
  selectedExercise,
  setWeight,
  setReps,
  elapsedSeconds,
  timerStartedAt,
  selectedDate,
  selectedWorkouts,
  customExercises,
  hiddenExercises,
  exerciseOrder,
  onDraftWorkoutChange,
  onSelectedBodyPartChange,
  onSelectedExerciseChange,
  onSetWeightChange,
  onSetRepsChange,
  onStartSetTimer,
  onFinishSetTimer,
  onResetCurrentSet,
  onSave,
  onAddSet,
  onDeleteDraftSet,
  onAddCustomExercise,
  onDeleteCustomExercise,
  onReorderExercises,
  onDeleteWorkout,
  onDateChange,
}: {
  draftWorkout: Workout;
  selectedBodyPart: BodyPart;
  selectedExercise: string;
  setWeight: number;
  setReps: number;
  elapsedSeconds: number;
  timerStartedAt: number | null;
  selectedDate: string;
  selectedWorkouts: Workout[];
  customExercises: CustomExerciseMap;
  hiddenExercises: HiddenExerciseMap;
  exerciseOrder: ExerciseOrderMap;
  onDraftWorkoutChange: Dispatch<SetStateAction<Workout>>;
  onSelectedBodyPartChange: (bodyPart: BodyPart) => void;
  onSelectedExerciseChange: (exercise: string) => void;
  onSetWeightChange: (weight: number) => void;
  onSetRepsChange: (reps: number) => void;
  onStartSetTimer: () => void;
  onFinishSetTimer: () => void;
  onResetCurrentSet: () => void;
  onSave: () => void;
  onAddSet: () => void;
  onDeleteDraftSet: (exerciseId: string, setId: string) => void;
  onAddCustomExercise: (bodyPart: BodyPart, exercise: string) => void;
  onDeleteCustomExercise: (bodyPart: BodyPart, exercise: string) => void;
  onReorderExercises: (bodyPart: BodyPart, exercises: string[]) => void;
  onDeleteWorkout: (id: string) => void;
  onDateChange: (dateKey: string) => void;
}) {
  const presets = exercisePresets[selectedBodyPart].filter((exercise) => !hiddenExercises[selectedBodyPart].includes(exercise));
  const knownExercises = orderExercises([...presets, ...customExercises[selectedBodyPart]], exerciseOrder[selectedBodyPart]);
  const [isAddingCustomExercise, setIsAddingCustomExercise] = useState(false);
  const [customExerciseDraft, setCustomExerciseDraft] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [activeDragExercise, setActiveDragExercise] = useState<string | null>(null);
  const customExerciseName = customExerciseDraft.trim();
  const canAddCustomExercise = customExerciseName.length > 0 && !knownExercises.includes(customExerciseName);
  const canAddSet = selectedExercise.trim().length > 0 && elapsedSeconds > 0 && setReps > 0 && timerStartedAt === null;
  const canSave = countWorkoutSets(draftWorkout) > 0;
  const customInputRef = useRef<HTMLInputElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    if (isAddingCustomExercise) customInputRef.current?.focus();
  }, [isAddingCustomExercise]);

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    if (deleteTarget && !dialog.open) dialog.showModal();
    else if (!deleteTarget && dialog.open) dialog.close();
  }, [deleteTarget]);

  useEffect(() => {
    if (!isEditMode) return;

    const exitEditModeOnBlankPress = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("button, input, select, textarea, dialog")) return;
      setIsEditMode(false);
    };

    window.addEventListener("pointerdown", exitEditModeOnBlankPress);
    return () => window.removeEventListener("pointerdown", exitEditModeOnBlankPress);
  }, [isEditMode]);

  useEffect(() => {
    return clearLongPressTimer;
  }, []);

  const handleBodyPartChange = (bodyPart: BodyPart) => {
    cancelCustomExercise();
    setIsEditMode(false);
    setDeleteTarget(null);
    onResetCurrentSet();
    onSelectedBodyPartChange(bodyPart);
  };

  const selectExercise = (exercise: string) => {
    onResetCurrentSet();
    onSelectedExerciseChange(exercise);
  };

  const startCustomExercise = () => {
    setCustomExerciseDraft("");
    setIsAddingCustomExercise(true);
  };

  const cancelCustomExercise = () => {
    setCustomExerciseDraft("");
    setIsAddingCustomExercise(false);
  };

  const addCustomExercise = () => {
    if (!canAddCustomExercise) return;
    onAddCustomExercise(selectedBodyPart, customExerciseDraft);
    setIsEditMode(false);
    setDeleteTarget(null);
    cancelCustomExercise();
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current === null) return;
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  const startExerciseLongPress = () => {
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setIsEditMode(true);
      longPressTimerRef.current = null;
    }, 650);
  };

  const deleteExercise = () => {
    if (!deleteTarget) return;
    onDeleteCustomExercise(selectedBodyPart, deleteTarget);
    setIsEditMode(false);
    setDeleteTarget(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragExercise(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragExercise(null);
    if (!over || active.id === over.id) return;

    const oldIndex = knownExercises.indexOf(String(active.id));
    const newIndex = knownExercises.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorderExercises(selectedBodyPart, arrayMove(knownExercises, oldIndex, newIndex));
  };

  const addSet = () => {
    onAddSet();
  };

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">训练记录</h2>
          <p className="mt-1 text-sm text-ink/50">{formatDateLabel(draftWorkout.date)}</p>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-coral text-white disabled:bg-ink/15"
          aria-label="保存训练"
          title="保存训练"
        >
          <Save size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <SummaryTile label="动作" value={draftWorkout.exercises.length} />
        <SummaryTile label="组数" value={countWorkoutSets(draftWorkout)} />
        <SummaryTile label="次数" value={countWorkoutReps(draftWorkout)} />
      </div>

      <div className="space-y-4 rounded-[8px] border border-line bg-surface p-4">
        <label className="block">
          <span className="text-sm font-semibold">日期</span>
          <input
            type="date"
            value={draftWorkout.date}
            onChange={(event) => onDateChange(event.target.value)}
            className="mt-2 h-12 w-full min-w-0 rounded-[8px] border border-line bg-mist px-3 text-base outline-none focus:border-ocean"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold">锻炼部位</span>
          <select
            value={selectedBodyPart}
            onChange={(event) => handleBodyPartChange(event.target.value as BodyPart)}
            className="mt-2 h-12 w-full rounded-[8px] border border-line bg-mist px-3 text-base outline-none focus:border-ocean"
          >
            {bodyParts.map((part) => (
              <option key={part}>{part}</option>
            ))}
          </select>
        </label>

        <div>
          <span className="text-sm font-semibold">动作项目</span>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDragExercise(null)}>
            <SortableContext items={knownExercises} strategy={rectSortingStrategy}>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {knownExercises.map((exercise) => (
                  <SortableExerciseButton
                    key={exercise}
                    exercise={exercise}
                    selected={selectedExercise === exercise}
                    editing={isEditMode}
                    active={activeDragExercise === exercise}
                    onLongPress={startExerciseLongPress}
                    onClearLongPress={clearLongPressTimer}
                    onForceEditMode={() => {
                      clearLongPressTimer();
                      longPressTriggeredRef.current = true;
                      setIsEditMode(true);
                    }}
                    onDelete={() => setDeleteTarget(exercise)}
                    onSelect={() => selectExercise(exercise)}
                    consumeLongPressClick={() => {
                      if (!longPressTriggeredRef.current) return false;
                      longPressTriggeredRef.current = false;
                      return true;
                    }}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay adjustScale={false}>
              {activeDragExercise ? <ExerciseButtonVisual exercise={activeDragExercise} selected={selectedExercise === activeDragExercise} dragging /> : null}
            </DragOverlay>
          </DndContext>

          <div className="mt-2 grid grid-cols-2 gap-2">
            {!isAddingCustomExercise && (
              <button
                type="button"
                onClick={startCustomExercise}
                className="flex min-h-[42px] items-center justify-center gap-2 rounded-[8px] border border-dashed border-line bg-surface px-3 py-2 text-sm font-semibold text-ink/60"
                aria-label="添加自定义动作"
                title="添加自定义动作"
              >
                <Plus size={17} aria-hidden="true" />
                <span>自定义</span>
              </button>
            )}
          </div>

          <dialog
            ref={deleteDialogRef}
            onClose={() => setDeleteTarget(null)}
            className="w-[min(340px,calc(100vw-40px))] rounded-[8px] border border-line bg-surface p-0 text-ink shadow-lift backdrop:bg-ink/35"
          >
            <div className="p-5">
              <h3 className="text-lg font-bold">删除动作项目</h3>
              <p className="mt-2 text-sm leading-6 text-ink/60">
                确定删除「{deleteTarget}」吗？已保存的训练记录不会被修改。
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" onClick={deleteExercise} className="h-11 rounded-[8px] bg-coral px-3 text-sm font-semibold text-white">
                  删除
                </button>
                <button type="button" onClick={() => setDeleteTarget(null)} className="h-11 rounded-[8px] bg-mist px-3 text-sm font-semibold text-ink/60">
                  取消
                </button>
              </div>
            </div>
          </dialog>

          {isAddingCustomExercise && (
            <div className="mt-2 grid grid-cols-[1fr_64px_64px] gap-2">
              <input
                ref={customInputRef}
                value={customExerciseDraft}
                onChange={(event) => setCustomExerciseDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && canAddCustomExercise) {
                    event.preventDefault();
                    addCustomExercise();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelCustomExercise();
                  }
                }}
                placeholder="输入自定义动作名称"
                className="h-12 min-w-0 rounded-[8px] border border-line bg-mist px-3 text-base outline-none focus:border-coral"
                aria-label="自定义动作名称"
              />
              <button
                type="button"
                onClick={addCustomExercise}
                disabled={!canAddCustomExercise}
                className="flex h-12 items-center justify-center gap-1 rounded-[8px] bg-ocean px-2 text-sm font-semibold text-white disabled:bg-ink/15"
              >
                <Plus size={16} aria-hidden="true" />
                添加
              </button>
              <button type="button" onClick={cancelCustomExercise} className="flex h-12 items-center justify-center gap-1 rounded-[8px] bg-coral px-2 text-sm font-semibold text-white">
                <X size={16} aria-hidden="true" />
                取消
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-[8px] border border-line bg-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">当前组</h3>
            <p className="mt-1 text-sm text-ink/50">
              {selectedBodyPart} · {selectedExercise || "未选择动作"}
            </p>
          </div>
          <div className="rounded-[8px] bg-mist px-3 py-2 text-lg font-bold tabular-nums">{formatDuration(elapsedSeconds)}</div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-sm font-semibold">重量</span>
            <div className="mt-2 flex h-12 items-center rounded-[8px] border border-line bg-mist px-3">
              <input
                type="number"
                min="0"
                inputMode="decimal"
                value={setWeight}
                onChange={(event) => onSetWeightChange(Number(event.target.value))}
                className="min-w-0 flex-1 bg-transparent text-base outline-none"
              />
              <span className="text-sm text-ink/50">kg</span>
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-semibold">次数</span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={setReps}
              onChange={(event) => onSetRepsChange(Number(event.target.value))}
              className="mt-2 h-12 w-full rounded-[8px] border border-line bg-mist px-3 text-base outline-none focus:border-ocean"
            />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onStartSetTimer}
            disabled={timerStartedAt !== null || !selectedExercise}
            className="flex h-12 items-center justify-center gap-2 rounded-[8px] bg-ocean px-3 text-sm font-semibold text-white disabled:bg-ink/15"
          >
            <Play size={17} aria-hidden="true" />
            开始
          </button>
          <button
            type="button"
            onClick={onFinishSetTimer}
            disabled={timerStartedAt === null}
            className="flex h-12 items-center justify-center gap-2 rounded-[8px] bg-ocean px-3 text-sm font-semibold text-mist disabled:bg-ink/15"
          >
            <Square size={16} aria-hidden="true" />
            完成
          </button>
          <button
            type="button"
            onClick={onResetCurrentSet}
            className="flex h-12 items-center justify-center gap-2 rounded-[8px] bg-mist px-3 text-sm font-semibold text-ink/60"
          >
            <RotateCcw size={16} aria-hidden="true" />
            重置
          </button>
        </div>

        <button
          type="button"
          onClick={addSet}
          disabled={!canAddSet}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-coral px-3 text-sm font-semibold text-white disabled:bg-ink/15"
        >
          <Plus size={17} aria-hidden="true" />
          添加本组
        </button>
      </div>

      <DraftWorkoutSummary workout={draftWorkout} onDeleteSet={onDeleteDraftSet} />

      <div className="space-y-4 rounded-[8px] border border-line bg-surface p-4">
        <label className="block">
          <span className="text-sm font-semibold">整次训练消耗</span>
          <div className="mt-2 flex items-center gap-2 rounded-[8px] border border-line bg-mist px-3">
            <Flame className="text-coral" size={19} aria-hidden="true" />
            <input
              type="number"
              min="0"
              inputMode="decimal"
              value={draftWorkout.calories}
              onChange={(event) => onDraftWorkoutChange((current) => ({ ...current, calories: Number(event.target.value) }))}
              className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none"
              aria-label="整次训练消耗"
            />
            <span className="text-sm text-ink/50">kcal</span>
          </div>
        </label>
        <label className="block">
          <span className="text-sm font-semibold">备注</span>
          <textarea
            value={draftWorkout.notes}
            onChange={(event) => onDraftWorkoutChange((current) => ({ ...current, notes: event.target.value }))}
            rows={3}
            className="mt-2 w-full resize-none rounded-[8px] border border-line bg-mist px-3 py-3 text-base outline-none focus:border-ocean"
          />
        </label>
      </div>

      <WorkoutList workouts={selectedWorkouts} onDeleteWorkout={onDeleteWorkout} emptyText="这一天还没有训练记录" />
    </section>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[8px] border border-line bg-surface px-3 py-2">
      <p className="text-xs text-ink/50">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function DraftWorkoutSummary({ workout, onDeleteSet }: { workout: Workout; onDeleteSet: (exerciseId: string, setId: string) => void }) {
  if (workout.exercises.length === 0) {
    return (
      <div className="rounded-[8px] border border-dashed border-line bg-surface px-4 py-8 text-center">
        <p className="text-sm font-semibold text-ink/50">当前训练还没有添加组</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {workout.exercises.map((exercise) => (
        <article key={exercise.id} className="rounded-[8px] border border-line bg-surface p-4">
          <div>
            <p className="text-sm font-semibold text-ocean">{exercise.bodyPart}</p>
            <h3 className="mt-1 text-lg font-bold">{exercise.exercise}</h3>
          </div>
          <div className="mt-3 space-y-2">
            {exercise.sets.map((set, index) => (
              <div key={set.id} className="grid grid-cols-[1fr_38px] items-center gap-2 rounded-[8px] bg-mist px-3 py-2">
                <span className="text-sm font-semibold text-ink/60">
                  {index + 1}组 · {set.weight}kg · {set.reps}次 · {formatDuration(set.durationSeconds)}
                </span>
                <button
                  type="button"
                  onClick={() => onDeleteSet(exercise.id, set.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-[8px] text-coral"
                  aria-label="删除当前组"
                  title="删除当前组"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function SortableExerciseButton({
  exercise,
  selected,
  editing,
  active,
  onLongPress,
  onClearLongPress,
  onForceEditMode,
  onDelete,
  onSelect,
  consumeLongPressClick,
}: {
  exercise: string;
  selected: boolean;
  editing: boolean;
  active: boolean;
  onLongPress: () => void;
  onClearLongPress: () => void;
  onForceEditMode: () => void;
  onDelete: () => void;
  onSelect: () => void;
  consumeLongPressClick: () => boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: exercise,
    disabled: !editing,
  });

  return (
    <div
      ref={setNodeRef}
      className="relative"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
      }}
    >
      {editing && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          onPointerDown={(event) => event.stopPropagation()}
          className="absolute -left-3 -top-3 z-10 flex h-9 w-9 items-center justify-center"
          aria-label={`删除 ${exercise}`}
          title="删除"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-coral text-white shadow-lift">
            <X size={12} aria-hidden="true" />
          </span>
        </button>
      )}
      <button
        type="button"
        {...(editing ? attributes : {})}
        {...(editing ? listeners : {})}
        {...(!editing
          ? {
              onPointerDown: onLongPress,
              onPointerUp: onClearLongPress,
              onPointerLeave: onClearLongPress,
              onPointerCancel: onClearLongPress,
            }
          : {})}
        onContextMenu={(event) => {
          event.preventDefault();
          onForceEditMode();
        }}
        onClick={(event) => {
          if (consumeLongPressClick()) {
            event.preventDefault();
            return;
          }
          if (editing) return;
          onSelect();
        }}
        className={`min-h-[42px] w-full rounded-[8px] border px-3 py-2 text-left text-sm font-semibold transition-[box-shadow,opacity,transform] duration-200 ${
          selected ? "border-ocean bg-ocean text-white" : "border-line bg-mist text-ink"
        } ${editing ? "cursor-grab touch-none ring-2 ring-coral/20 active:cursor-grabbing" : ""} ${
          active || isDragging ? "opacity-30" : ""
        }`}
        title={editing ? "拖拽调整顺序" : "长按进入编辑"}
      >
        {exercise}
      </button>
    </div>
  );
}

function ExerciseButtonVisual({ exercise, selected, dragging = false }: { exercise: string; selected: boolean; dragging?: boolean }) {
  return (
    <div
      className={`min-h-[42px] min-w-[150px] rounded-[8px] border px-3 py-2 text-left text-sm font-semibold shadow-lift ${
        selected ? "border-ocean bg-ocean text-white" : "border-line bg-mist text-ink"
      } ${dragging ? "scale-105" : ""}`}
    >
      {exercise}
    </div>
  );
}

function orderExercises(exercises: string[], savedOrder: string[]) {
  const visible = new Set(exercises);
  const ordered = savedOrder.filter((exercise) => visible.has(exercise));
  const unordered = exercises.filter((exercise) => !ordered.includes(exercise));
  return [...ordered, ...unordered];
}
