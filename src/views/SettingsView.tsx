import { Check, Download, Moon, Sun, Upload, Ruler, Weight, Cake, User, Pencil, Save, Target, Sparkles, Trash2, Key } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDateLabel, fromDateKey, weekdayLabels } from "../utils/date";
import type { BodyProfile, BodyProfileRecord, FitnessGoal, Gender } from "../types";

export interface DateInfo {
  dateKey: string;
  workoutCount: number;
  photoCount: number;
}

const GOAL_OPTIONS: { value: FitnessGoal; hint: string }[] = [
  { value: "增肌", hint: "提升肌肉量" },
  { value: "减脂", hint: "降低体脂率" },
  { value: "塑形", hint: "线条紧致" },
  { value: "增力", hint: "突破力量" },
  { value: "维持", hint: "保持现状" },
];

export function SettingsView({
  isLightTheme,
  onThemeToggle,
  availableDates,
  bodyProfile,
  lastBodyProfileRecord,
  onSaveBodyProfile,
  apiKey,
  onApiKeyChange,
  onClearChat,
  chatMessageCount,
  onExport,
  onImport,
}: {
  isLightTheme: boolean;
  onThemeToggle: () => void;
  availableDates: DateInfo[];
  bodyProfile: BodyProfile;
  lastBodyProfileRecord: BodyProfileRecord | null;
  onSaveBodyProfile: (profile: BodyProfile) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  onClearChat: () => void;
  chatMessageCount: number;
  onExport: (dateKeys?: string[]) => void;
  onImport: (file: File) => Promise<{ success: boolean; message: string }>;
}) {
  const [exportMode, setExportMode] = useState<"all" | "dates">("all");
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [importStatus, setImportStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  // Body profile local draft (only committed to storage on explicit save).
  const [draft, setDraft] = useState<BodyProfile>(bodyProfile);
  const [editing, setEditing] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(bodyProfile);
  }, [bodyProfile, editing]);

  const totalWorkouts = availableDates.reduce((sum, d) => sum + d.workoutCount, 0);
  const totalPhotos = availableDates.reduce((sum, d) => sum + d.photoCount, 0);

  const toggleDate = (dateKey: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedDates(new Set(availableDates.map((d) => d.dateKey)));
  };

  const deselectAll = () => {
    setSelectedDates(new Set());
  };

  const allSelected = availableDates.length > 0 && selectedDates.size === availableDates.length;

  const handleExport = () => {
    if (exportMode === "all") {
      onExport();
    } else {
      onExport(Array.from(selectedDates));
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const result = await onImport(file);
    setImportStatus({ type: result.success ? "success" : "error", message: result.message });

    // reset file input so the same file can be re-imported
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const updateField = <K extends keyof BodyProfile>(key: K, value: BodyProfile[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const updateNumberField = (key: "heightCm" | "weightKg" | "age", raw: string) => {
    const num = Math.max(0, Number(raw) || 0);
    updateField(key, num);
  };

  // Save: commit the draft, append a timestamped history record (handled in App).
  const handleSave = () => {
    onSaveBodyProfile({
      heightCm: Math.max(0, Number(draft.heightCm) || 0),
      weightKg: Math.max(0, Number(draft.weightKg) || 0),
      age: Math.max(0, Number(draft.age) || 0),
      gender: draft.gender,
      goal: draft.goal,
    });
    setEditing(false);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
  };

  const startEdit = () => {
    setDraft(bodyProfile);
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(bodyProfile);
    setEditing(false);
  };

  const isDirty = useMemo(() => {
    return (
      draft.heightCm !== bodyProfile.heightCm ||
      draft.weightKg !== bodyProfile.weightKg ||
      draft.age !== bodyProfile.age ||
      draft.gender !== bodyProfile.gender ||
      draft.goal !== bodyProfile.goal
    );
  }, [draft, bodyProfile]);

  // BMI = weight(kg) / height(m)^2
  const heightM = draft.heightCm / 100;
  const bmi = heightM > 0 && draft.weightKg > 0 ? draft.weightKg / (heightM * heightM) : null;

  // BMR via Mifflin-St Jeor — requires all fields.
  const bmr =
    draft.heightCm > 0 && draft.weightKg > 0 && draft.age > 0 && draft.gender !== ""
      ? draft.gender === "male"
        ? 10 * draft.weightKg + 6.25 * draft.heightCm - 5 * draft.age + 5
        : 10 * draft.weightKg + 6.25 * draft.heightCm - 5 * draft.age - 161
      : null;

  const hasAnyData =
    bodyProfile.heightCm > 0 ||
    bodyProfile.weightKg > 0 ||
    bodyProfile.age > 0 ||
    bodyProfile.gender !== "" ||
    bodyProfile.goal !== "";

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-bold">设置</h2>

      {/* ── Theme ── */}
      <button
        type="button"
        onClick={onThemeToggle}
        className="flex w-full items-center justify-between rounded-2xl bg-surface px-5 py-4"
      >
        <span className="flex items-center gap-3">
          <Sun size={20} className={isLightTheme ? "text-citrus" : "text-ink/40"} />
          <span className="text-base font-medium">浅色模式</span>
        </span>
        <span
          className={`flex h-8 w-14 items-center rounded-full px-1 transition-colors ${
            isLightTheme ? "bg-ocean" : "bg-ink/20"
          }`}
        >
          <span
            className={`h-6 w-6 rounded-full bg-white shadow transition-transform ${
              isLightTheme ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </span>
        <span className="flex items-center gap-3">
          <Moon size={20} className={!isLightTheme ? "text-ocean" : "text-ink/40"} />
          <span className="text-base font-medium">深色模式</span>
        </span>
      </button>

      {/* ── Body profile ── */}
      <section className="rounded-2xl bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink/60">个人身体数据</h3>
          {savedFlash && (
            <span className="text-xs font-semibold text-ocean">已保存</span>
          )}
        </div>

        <div className="space-y-3">
          <NumberField
            icon={<Ruler size={18} className="text-ocean" />}
            label="身高"
            unit="cm"
            value={draft.heightCm}
            placeholder="170"
            disabled={!editing}
            onChange={(v) => updateNumberField("heightCm", v)}
          />
          <NumberField
            icon={<Weight size={18} className="text-ocean" />}
            label="体重"
            unit="kg"
            value={draft.weightKg}
            placeholder="65"
            disabled={!editing}
            onChange={(v) => updateNumberField("weightKg", v)}
          />
          <NumberField
            icon={<Cake size={18} className="text-ocean" />}
            label="年龄"
            unit="岁"
            value={draft.age}
            placeholder="25"
            disabled={!editing}
            onChange={(v) => updateNumberField("age", v)}
          />

          <div className="flex items-center gap-3 rounded-xl bg-mist px-4 py-3">
            <User size={18} className="text-ocean" />
            <span className="text-base font-medium">性别</span>
            <div className="ml-auto flex rounded-lg bg-surface p-1">
              {(["male", "female"] as const).map((g) => {
                const active = draft.gender === g;
                return (
                  <button
                    key={g}
                    type="button"
                    disabled={!editing}
                    onClick={() => updateField("gender", g as Gender)}
                    className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
                      active ? "bg-ocean text-mist" : "text-ink/50"
                    } ${!editing ? "opacity-60" : ""}`}
                  >
                    {g === "male" ? "男" : "女"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Goal selector */}
          <div className="rounded-xl bg-mist px-4 py-3">
            <div className="flex items-center gap-3">
              <Target size={18} className="text-ocean" />
              <span className="text-base font-medium">目标</span>
              {!editing && draft.goal && (
                <span className="ml-auto text-sm text-ink/40">{getGoalHint(draft.goal)}</span>
              )}
            </div>
            <div className={`mt-3 flex flex-wrap gap-2 ${!editing ? "opacity-60" : ""}`}>
              {GOAL_OPTIONS.map((opt) => {
                const active = draft.goal === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={!editing}
                    onClick={() => updateField("goal", active ? "" : opt.value)}
                    className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                      active ? "bg-ocean text-mist" : "bg-surface text-ink/60"
                    }`}
                  >
                    {opt.value}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {(bmi !== null || bmr !== null) && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatTile label="BMI" value={bmi !== null ? bmi.toFixed(1) : "—"} hint={bmiHint(bmi)} />
            <StatTile label="基础代谢" value={bmr !== null ? `${Math.round(bmr)}` : "—"} hint="kcal / 天" />
          </div>
        )}

        {lastBodyProfileRecord && (
          <p className="mt-4 text-xs text-ink/40">
            最后更新：{formatTimestamp(lastBodyProfileRecord.recordedAt)}
          </p>
        )}

        {/* Action buttons */}
        <div className="mt-4 flex gap-2">
          {!editing ? (
            <button
              type="button"
              onClick={startEdit}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-ocean py-3.5 text-base font-semibold text-mist active:opacity-80"
            >
              {hasAnyData || lastBodyProfileRecord ? (
                <>
                  <Pencil size={18} />
                  修改
                </>
              ) : (
                <>
                  <Save size={18} />
                  填写数据
                </>
              )}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={cancelEdit}
                className="flex-1 rounded-xl bg-mist py-3.5 text-base font-semibold text-ink/60 active:opacity-80"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty}
                className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-ocean py-3.5 text-base font-semibold text-mist active:opacity-80 disabled:bg-slate-300"
              >
                <Save size={18} />
                保存
              </button>
            </>
          )}
        </div>
      </section>

      {/* ── Export ── */}
      <section className="rounded-2xl bg-surface p-5">
        <h3 className="mb-4 text-sm font-semibold text-ink/60">导出数据</h3>

        {/* Mode toggle */}
        <div className="mb-4 flex rounded-xl bg-mist p-1">
          <button
            type="button"
            onClick={() => setExportMode("all")}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
              exportMode === "all" ? "bg-ocean text-mist" : "text-ink/50"
            }`}
          >
            全部数据
          </button>
          <button
            type="button"
            onClick={() => setExportMode("dates")}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
              exportMode === "dates" ? "bg-ocean text-mist" : "text-ink/50"
            }`}
          >
            按日期选择
          </button>
        </div>

        {exportMode === "all" ? (
          <div>
            <p className="mb-4 text-sm text-ink/50">
              包含 {totalWorkouts} 条训练记录，{totalPhotos} 张照片
            </p>
            <button
              type="button"
              onClick={handleExport}
              disabled={availableDates.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-ocean py-3.5 text-base font-semibold text-mist active:opacity-80 disabled:bg-slate-300"
            >
              <Upload size={20} />
              导出全部数据
            </button>
          </div>
        ) : (
          <div>
            {availableDates.length === 0 ? (
              <p className="text-sm text-ink/30 py-4 text-center">暂无数据</p>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={allSelected ? deselectAll : selectAll}
                    className="text-sm font-medium text-ocean"
                  >
                    {allSelected ? "取消全选" : "全选"}
                  </button>
                  <span className="text-sm text-ink/40">已选 {selectedDates.size} 天</span>
                </div>
                <div className="mb-4 max-h-60 space-y-1 overflow-y-auto">
                  {availableDates.map(({ dateKey, workoutCount, photoCount }) => {
                    const date = fromDateKey(dateKey);
                    const dayLabel = `周${weekdayLabels[(date.getDay() || 7) - 1]}`;
                    const isSelected = selectedDates.has(dateKey);

                    return (
                      <button
                        key={dateKey}
                        type="button"
                        onClick={() => toggleDate(dateKey)}
                        className="flex w-full items-center gap-3 rounded-lg py-2.5 pr-3 text-left"
                      >
                        <span
                          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                            isSelected
                              ? "border-ocean bg-ocean text-mist"
                              : "border-line"
                          }`}
                        >
                          {isSelected && <Check size={14} strokeWidth={3} />}
                        </span>
                        <span className="flex-1 text-sm font-medium">
                          {formatDateLabel(dateKey)} {dayLabel}
                        </span>
                        {workoutCount > 0 && (
                          <span className="rounded-full bg-ocean/10 px-2 py-0.5 text-xs font-semibold text-ocean">
                            {workoutCount}组
                          </span>
                        )}
                        {photoCount > 0 && (
                          <span className="rounded-full bg-citrus/10 px-2 py-0.5 text-xs font-semibold text-citrus">
                            {photoCount}张
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={selectedDates.size === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-ocean py-3.5 text-base font-semibold text-mist active:opacity-80 disabled:bg-slate-300"
                >
                  <Upload size={20} />
                  导出选中 ({selectedDates.size}天)
                </button>
              </>
            )}
          </div>
        )}
      </section>

      {/* ── Import ── */}
      <section className="rounded-2xl bg-surface p-5">
        <h3 className="mb-4 text-sm font-semibold text-ink/60">导入数据</h3>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,.json"
          onChange={handleImportFile}
          className="hidden"
          id="import-file-input"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-ocean py-3.5 text-base font-semibold text-mist active:opacity-80"
        >
          <Download size={20} />
          导入数据
        </button>
        {importStatus && (
          <p
            className={`mt-3 rounded-lg px-4 py-2.5 text-sm font-medium ${
              importStatus.type === "success"
                ? "bg-ocean/10 text-ocean"
                : "bg-coral/10 text-coral"
            }`}
          >
            {importStatus.message}
          </p>
        )}
      </section>

      {/* ── AI assistant ── */}
      <section className="rounded-2xl bg-surface p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink/60">
          <Sparkles size={16} className="text-ocean" />
          AI 助手
        </h3>

        <label className="block">
          <span className="mb-2 block text-base font-medium">DeepSeek API Key</span>
          <div className="flex items-center gap-2 rounded-xl bg-mist px-3">
            <Key size={18} className="flex-shrink-0 text-ink/40" />
            <input
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(event) => onApiKeyChange(event.target.value)}
              placeholder="sk-..."
              autoComplete="off"
              spellCheck={false}
              className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none"
            />
            <button
              type="button"
              onClick={() => setShowApiKey((prev) => !prev)}
              className="flex-shrink-0 text-sm font-medium text-ink/50 active:text-ocean"
            >
              {showApiKey ? "隐藏" : "显示"}
            </button>
          </div>
        </label>
        <p className="mt-2 text-xs leading-5 text-ink/40">
          密钥仅保存在本机，不会上传或随备份导出。直接调用 DeepSeek API（deepseek-v4-flash），遇网络/CORS 错误请自备代理。
        </p>

        <div className="mt-4 flex items-center justify-between rounded-xl bg-mist px-4 py-3">
          <span className="text-sm text-ink/50">对话记录（超出自动压缩）</span>
          <span className="text-sm font-semibold text-ink/60">{chatMessageCount} 条</span>
        </div>
        <button
          type="button"
          onClick={onClearChat}
          disabled={chatMessageCount === 0}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-mist py-3 text-sm font-semibold text-coral active:opacity-80 disabled:text-ink/30"
        >
          <Trash2 size={16} />
          清空对话
        </button>
      </section>
    </div>
  );
}

function NumberField({
  icon,
  label,
  unit,
  value,
  placeholder,
  disabled,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  unit: string;
  value: number;
  placeholder: string;
  disabled: boolean;
  onChange: (raw: string) => void;
}) {
  return (
    <label className={`flex items-center gap-3 rounded-xl bg-mist px-4 py-3 ${disabled ? "opacity-60" : ""}`}>
      {icon}
      <span className="text-base font-medium">{label}</span>
      <input
        type="number"
        min="0"
        inputMode="decimal"
        value={value === 0 ? "" : value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 min-w-0 flex-1 bg-transparent text-right text-base outline-none disabled:text-ink/40"
      />
      <span className="text-sm text-ink/50">{unit}</span>
    </label>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl bg-mist px-4 py-3 text-center">
      <p className="text-xs font-semibold text-ink/50">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ocean">{value}</p>
      <p className="mt-0.5 text-xs text-ink/40">{hint}</p>
    </div>
  );
}

function bmiHint(bmi: number | null): string {
  if (bmi === null) return "需身高体重";
  if (bmi < 18.5) return "偏瘦";
  if (bmi < 24) return "正常";
  if (bmi < 28) return "偏胖";
  return "肥胖";
}

function getGoalHint(goal: FitnessGoal): string {
  return GOAL_OPTIONS.find((opt) => opt.value === goal)?.hint ?? "";
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const pad = (n: number) => `${n}`.padStart(2, "0");
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (sameDay) return `今天 ${time}`;
  return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`;
}
