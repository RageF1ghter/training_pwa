import { Check, Download, Moon, Sun, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { formatDateLabel, fromDateKey, weekdayLabels } from "../utils/date";

export interface DateInfo {
  dateKey: string;
  workoutCount: number;
  photoCount: number;
}

export function SettingsView({
  isLightTheme,
  onThemeToggle,
  availableDates,
  onExport,
  onImport,
}: {
  isLightTheme: boolean;
  onThemeToggle: () => void;
  availableDates: DateInfo[];
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
    </div>
  );
}
