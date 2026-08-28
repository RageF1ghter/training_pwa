/* 姿态分析数据导出：JSON / 关键点CSV / 角度CSV / 截图PNG */
import { ANGLE_DEFS, LM_NAMES, angleOf, type PoseFrame } from "./poseData";

export function download(filename: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export function baseName(fileName: string | null) {
  return (fileName || "pose").replace(/\.[^.]+$/, "");
}

export function buildPoseJSON(
  frames: PoseFrame[],
  meta: Record<string, unknown>,
) {
  return JSON.stringify({
    meta: {
      app: "FitLog pose analyzer (MediaPipe Pose Landmarker)",
      generatedAt: new Date().toISOString(),
      ...meta,
    },
    frames,
  });
}

export function buildLandmarksCSV(frames: PoseFrame[]) {
  const cols = ["frame", "time_s", "detected"];
  for (const n of LM_NAMES) cols.push(`${n}_x`, `${n}_y`, `${n}_z`, `${n}_v`);
  const lines = [cols.join(",")];
  for (const f of frames) {
    const row: (string | number)[] = [f.frame, f.time, f.detected ? 1 : 0];
    const lms = f.poses[0]?.landmarks || [];
    for (const p of lms) row.push(p[0], p[1], p[2], p[3]);
    while (row.length < cols.length) row.push("");
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

export function buildAnglesCSV(frames: PoseFrame[]) {
  const cols = ["frame", "time_s", "detected", ...ANGLE_DEFS.map((d) => `${d.key}_deg`)];
  const lines = [cols.join(",")];
  for (const f of frames) {
    const row: (string | number)[] = [f.frame, f.time, f.detected ? 1 : 0];
    for (const def of ANGLE_DEFS) {
      const v = f.poses[0] ? angleOf(f.poses[0].landmarks, def) : null;
      row.push(v == null ? "" : v.toFixed(1));
    }
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

/* 当前画面 + 骨架合成截图 */
export function snapshotCanvas(video: HTMLVideoElement, overlay: HTMLCanvasElement) {
  const c = document.createElement("canvas");
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.drawImage(video, 0, 0);
    ctx.drawImage(overlay, 0, 0);
  }
  return c;
}
