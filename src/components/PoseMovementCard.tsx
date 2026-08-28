import { ClipboardCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { chat as deepseekChat } from "../services/deepseek";
import { readApiKey } from "../storage/chatStorage";
import { readBodyProfile } from "../storage/bodyProfileStorage";
import { renderMarkdown } from "../utils/markdown";
import { buildPoseCoachMessages, computeMovementReport, type MovementReport } from "../utils/poseMovement";
import type { PoseFrame } from "../utils/poseData";

const KIND_LABEL: Record<MovementReport["reps"][number]["kind"], string> = {
  squat: "深蹲",
  hinge: "俯身/捡拾",
  crouch: "蹲姿保持",
  partial: "浅幅屈膝",
};

/**
 * 动作分析卡：本地规则引擎即时出报告（次数/深度/节奏/疲劳），
 * 可选调用 DeepSeek 做"教练点评"——只上传摘要指标，不上传视频或原始坐标。
 */
export function PoseMovementCard({
  getFrames,
  analyzed,
  showToast,
}: {
  getFrames: () => PoseFrame[];
  analyzed: boolean;
  showToast: (msg: string, kind?: "info" | "error") => void;
}) {
  const [report, setReport] = useState<MovementReport | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachText, setCoachText] = useState<string | null>(null);
  const [coachError, setCoachError] = useState<string | null>(null);

  // 重新分析/换视频时清空旧报告
  useEffect(() => {
    if (!analyzed) {
      setReport(null);
      setCoachText(null);
      setCoachError(null);
    }
  }, [analyzed]);

  const runMovement = () => {
    const frames = getFrames();
    if (!frames.length) {
      showToast("请先完成姿态分析", "error");
      return;
    }
    setReport(computeMovementReport(frames));
    setCoachText(null);
    setCoachError(null);
  };

  const runCoach = async () => {
    if (!report || coachLoading) return;
    const apiKey = readApiKey();
    if (!apiKey.trim()) {
      setCoachError("请先在设置页填写 DeepSeek API Key");
      return;
    }
    setCoachLoading(true);
    setCoachError(null);
    const result = await deepseekChat({
      apiKey,
      messages: buildPoseCoachMessages(report, readBodyProfile()),
    });
    setCoachLoading(false);
    if (!result.success || !result.data) {
      setCoachError(result.message);
      return;
    }
    setCoachText(result.data);
  };

  const squats = report?.reps.filter((r) => r.kind === "squat") || [];
  const others = report?.reps.filter((r) => r.kind !== "squat") || [];

  return (
    <div className="mt-3 rounded-[8px] border border-line bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-ink/60">动作分析 · 深蹲</p>
        <button
          type="button"
          onClick={runMovement}
          disabled={!analyzed}
          className="flex h-9 items-center gap-1.5 rounded-[8px] bg-mist px-3 text-xs font-semibold text-ink disabled:opacity-40"
        >
          <ClipboardCheck size={14} aria-hidden="true" />
          {report ? "重新计算" : "分析动作"}
        </button>
      </div>

      {report && (
        <div className="mt-2">
          <p className="text-xs text-ink/50">
            有效深蹲 <b className="text-ink">{squats.length}</b> 次
            {report.qc.gaps.length > 0 && <> · 检出 {report.qc.rate}，空档 {report.qc.gaps.join("、")}</>}
          </p>

          {squats.length > 0 && (
            <div className="mt-2 -mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[330px] text-xs tabular-nums">
                <thead>
                  <tr className="text-left text-[10px] text-ink/50">
                    <th className="py-1.5 pr-2 font-medium">次</th>
                    <th className="pr-2 font-medium">膝角</th>
                    <th className="pr-2 font-medium">髋角</th>
                    <th className="pr-2 font-medium">下蹲</th>
                    <th className="pr-2 font-medium">起身</th>
                    <th className="pr-2 font-medium">停留</th>
                    <th className="font-medium">前倾</th>
                  </tr>
                </thead>
                <tbody>
                  {squats.map((r, i) => (
                    <tr key={r.start} className="border-t border-line">
                      <td className="py-1.5 pr-2 font-bold">{i + 1}</td>
                      <td className="pr-2">{r.minKnee.toFixed(0)}°</td>
                      <td className="pr-2">{r.hipAtMin != null ? `${r.hipAtMin.toFixed(0)}°` : "—"}</td>
                      <td className="pr-2">{r.descS.toFixed(2)}s</td>
                      <td className="pr-2">{r.ascS.toFixed(2)}s</td>
                      <td className="pr-2">{r.bottomS.toFixed(1)}s</td>
                      <td>{r.geom ? `${r.geom.leanDeg.toFixed(0)}°` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {report.fatigue && (
            <p className="mt-2 text-xs text-ink/60">
              疲劳：起身 {report.fatigue.ascFirst.toFixed(2)}s → {report.fatigue.ascLast.toFixed(2)}s
              （{report.fatigue.ascPct >= 0 ? "+" : ""}{report.fatigue.ascPct}%），底部停留 {report.fatigue.bottomFirst.toFixed(1)}s → {report.fatigue.bottomLast.toFixed(1)}s
              {report.fatigue.descStable ? "，下蹲节奏稳定" : ""}
            </p>
          )}

          {others.length > 0 && (
            <p className="mt-1.5 text-xs text-ink/50">
              另有 {others.length} 次非训练动作未计入：
              {others.map((r) => `${KIND_LABEL[r.kind]}（${r.start.toFixed(1)}s）`).join("、")}
            </p>
          )}

          {squats.length === 0 && (
            <p className="mt-2 text-xs text-ink/50">未识别到有效深蹲（逐次分段目前仅支持蹲类动作）</p>
          )}

          {/* AI 教练点评 */}
          <div className="mt-3 border-t border-line pt-3">
            <button
              type="button"
              onClick={runCoach}
              disabled={coachLoading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-ocean text-sm font-semibold text-white disabled:opacity-40"
            >
              <Sparkles size={16} aria-hidden="true" />
              {coachLoading ? "点评中…" : "AI 教练点评"}
            </button>
            <p className="mt-1.5 text-center text-[10px] text-ink/40">
              联网调用 DeepSeek，仅上传上方摘要指标（不含视频与画面）
            </p>
            {coachError && <p className="mt-2 rounded-lg bg-coral/10 px-3 py-2 text-xs text-coral">{coachError}</p>}
            {coachText && (
              <div
                className="chat-markdown mt-2 rounded-[8px] bg-mist px-3 py-2.5 text-sm leading-6"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(coachText) }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
