/* 姿态识别纯逻辑：常量、关节角计算、骨架绘制、帧记录、视频 seek。
 * 与 React 无关；骨架拓扑内置为本模块常量，绘制时无需引入 MediaPipe 主包。 */

/** 紧凑关键点：[x, y, z, visibility]（归一化坐标） */
export type PoseLandmark = [number, number, number, number];

export interface PoseRecord {
  score: number;
  landmarks: PoseLandmark[];
  world: PoseLandmark[];
}

export interface PoseFrame {
  frame: number;
  time: number;
  detected: boolean;
  poses: PoseRecord[];
}

export type PoseAngles = Record<string, number | null>;

/** detectForVideo 结果的结构子集（与 MediaPipe 类型结构兼容） */
export interface PoseDetectResult {
  landmarks?: { x: number; y: number; z: number; visibility?: number }[][];
  worldLandmarks?: { x: number; y: number; z: number; visibility?: number }[][];
}

/* 33 个关键点名称（导出 CSV 用） */
export const LM_NAMES = [
  "nose", "left_eye_inner", "left_eye", "left_eye_outer",
  "right_eye_inner", "right_eye", "right_eye_outer", "left_ear", "right_ear",
  "mouth_left", "mouth_right",
  "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
  "left_wrist", "right_wrist", "left_pinky", "right_pinky",
  "left_index", "right_index", "left_thumb", "right_thumb",
  "left_hip", "right_hip", "left_knee", "right_knee",
  "left_ankle", "right_ankle", "left_heel", "right_heel",
  "left_foot_index", "right_foot_index",
] as const;

/* 关节角定义：a-b-c 三点夹角（b 为关节顶点） */
export interface AngleDef {
  key: string;
  name: string;
  side: "left" | "right";
  a: number;
  b: number;
  c: number;
}

export const ANGLE_DEFS: AngleDef[] = [
  { key: "l_elbow", name: "左肘", side: "left", a: 11, b: 13, c: 15 },
  { key: "r_elbow", name: "右肘", side: "right", a: 12, b: 14, c: 16 },
  { key: "l_shoulder", name: "左肩", side: "left", a: 13, b: 11, c: 23 },
  { key: "r_shoulder", name: "右肩", side: "right", a: 14, b: 12, c: 24 },
  { key: "l_hip", name: "左髋", side: "left", a: 11, b: 23, c: 25 },
  { key: "r_hip", name: "右髋", side: "right", a: 12, b: 24, c: 26 },
  { key: "l_knee", name: "左膝", side: "left", a: 23, b: 25, c: 27 },
  { key: "r_knee", name: "右膝", side: "right", a: 24, b: 26, c: 28 },
];

/* MediaPipe Pose 33 点骨架拓扑（等价于 PoseLandmarker.POSE_CONNECTIONS） */
export const POSE_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10], [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
  [17, 19], [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28],
  [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32],
];

/* 骨架配色：按人体左右侧 */
export const LEFT_IDX = new Set([1, 2, 3, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31]);
export const RIGHT_IDX = new Set([4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32]);
export const COLOR_LEFT = "#22d3ee";
export const COLOR_RIGHT = "#fb7185";
export const COLOR_CENTER = "#e2e8f0";

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function fmtDur(s: number) {
  s = Math.max(0, Math.round(s));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/* a-b-c 夹角（度），任一点可见度过低返回 null */
export function angleOf(lms: PoseLandmark[], def: AngleDef, minVis = 0.3): number | null {
  const A = lms[def.a], B = lms[def.b], C = lms[def.c];
  if (!A || !B || !C) return null;
  if ((A[3] ?? 1) < minVis || (B[3] ?? 1) < minVis || (C[3] ?? 1) < minVis) return null;
  const v1 = [A[0] - B[0], A[1] - B[1]];
  const v2 = [C[0] - B[0], C[1] - B[1]];
  const dot = v1[0] * v2[0] + v1[1] * v2[1];
  const n1 = Math.hypot(v1[0], v1[1]), n2 = Math.hypot(v2[0], v2[1]);
  if (!n1 || !n2) return null;
  return (Math.acos(clamp(dot / (n1 * n2), -1, 1)) * 180) / Math.PI;
}

export function computeAngles(lms: PoseLandmark[] | null): PoseAngles {
  const out: PoseAngles = {};
  for (const def of ANGLE_DEFS) out[def.key] = lms ? angleOf(lms, def) : null;
  return out;
}

/* 把一帧的推理结果整理为紧凑结构 */
export function recordFrame(i: number, t: number, result: PoseDetectResult | null): PoseFrame {
  const landmarks = result?.landmarks || [];
  const world = result?.worldLandmarks || [];
  const poses: PoseRecord[] = landmarks.map((lms, pi) => ({
    score: lms.reduce((s, p) => s + (p.visibility ?? 1), 0) / lms.length,
    landmarks: lms.map((p): PoseLandmark => [
      +p.x.toFixed(5), +p.y.toFixed(5), +p.z.toFixed(5), +(p.visibility ?? 1).toFixed(3),
    ]),
    world: (world[pi] || []).map((p): PoseLandmark => [
      +p.x.toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4), +(p.visibility ?? 1).toFixed(3),
    ]),
  }));
  return { frame: i, time: +t.toFixed(3), detected: poses.length > 0, poses };
}

/* 在画布上绘制一副骨架（landmarks 为归一化坐标） */
export function drawPose(ctx: CanvasRenderingContext2D, lms: PoseLandmark[], W: number, H: number, minVis: number) {
  const P = (i: number): [number, number, number] | null => (lms[i] ? [lms[i][0] * W, lms[i][1] * H, lms[i][3] ?? 1] : null);
  const lw = Math.max(2, Math.round(W / 360));

  ctx.lineCap = "round";
  for (const [start, end] of POSE_CONNECTIONS) {
    const a = P(start), b = P(end);
    if (!a || !b) continue;
    const vis = Math.min(a[2], b[2]);
    if (vis < minVis) continue;
    ctx.globalAlpha = clamp(vis, 0.3, 1);
    ctx.strokeStyle = LEFT_IDX.has(start) ? COLOR_LEFT : RIGHT_IDX.has(start) ? COLOR_RIGHT : COLOR_CENTER;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }

  const r = Math.max(3, Math.round(W / 320));
  for (let i = 0; i < lms.length; i++) {
    const p = P(i);
    if (!p || p[2] < minVis) continue;
    ctx.globalAlpha = clamp(p[2], 0.35, 1);
    ctx.fillStyle = LEFT_IDX.has(i) ? COLOR_LEFT : RIGHT_IDX.has(i) ? COLOR_RIGHT : COLOR_CENTER;
    ctx.beginPath();
    ctx.arc(p[0], p[1], i === 0 ? r * 1.6 : r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* 精确 seek 到指定时间，resolve 后画面即该帧 */
export function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener("seeked", finish);
      resolve();
    };
    if (Math.abs(video.currentTime - t) < 1e-6) {
      finish();
      return;
    }
    video.addEventListener("seeked", finish);
    setTimeout(finish, 3000); // 兜底，防止个别帧卡住
    video.currentTime = t;
  });
}

/* 个别 webm 时长为 Infinity：先 seek 极大值强制浏览器计算 */
export function waitForDuration(video: HTMLVideoElement, timeout = 2500): Promise<void> {
  return new Promise((res) => {
    const done = () => res();
    video.addEventListener("durationchange", done, { once: true });
    setTimeout(done, timeout);
    video.currentTime = 1e7;
  });
}
