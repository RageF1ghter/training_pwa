/* 动作分析规则引擎：与 pose-analysis skill 的 scripts/pose_report.mjs 同一套
 * 已验证的阈值和流程（分段、分类、疲劳、QC），输入直接来自内存中的 PoseFrame[]。
 * 所有数字在这里算好；AI 教练（DeepSeek）只解读，绝不重算。 */
import type { ApiMessage } from "../services/deepseek";
import type { BodyProfile } from "../types";
import { ANGLE_DEFS, angleOf, type AngleDef, type PoseFrame } from "./poseData";

const DEFS: Record<string, AngleDef> = Object.fromEntries(
  ANGLE_DEFS.map((d) => [d.key, d]),
);
const KNEE_L = DEFS.l_knee, KNEE_R = DEFS.r_knee;
const HIP_L = DEFS.l_hip, HIP_R = DEFS.r_hip;

export interface RepGeom {
  leanDeg: number; // 底部躯干与竖直方向夹角
  shSepX: number; // 双肩 x 间距：<0.05 侧面视角，>0.1 正面
  hipBelowKneeY: number; // >0 表示髋低于膝（全深蹲）
  asymDeg: number | null; // 底部左右膝角差
  heelV: [number, number]; // 左右脚跟可见度
}

export interface MovementRep {
  kind: "squat" | "hinge" | "crouch" | "partial";
  start: number;
  bottomAt: number;
  end: number;
  minKnee: number;
  hipAtMin: number | null;
  descS: number;
  ascS: number;
  bottomS: number;
  restBefore: number | null;
  geom: RepGeom | null;
}

export interface MovementReport {
  qc: { frames: number; detected: number; rate: string; gaps: string[] };
  reps: MovementRep[];
  rom: Record<string, { min: number; max: number } | null>;
  fatigue: {
    ascFirst: number;
    ascLast: number;
    ascPct: number;
    bottomFirst: number;
    bottomLast: number;
    descStable: boolean;
  } | null;
}

interface Row {
  t: number;
  det: boolean;
  lKnee: number | null; rKnee: number | null;
  lHip: number | null; rHip: number | null;
  lSh: number | null; rSh: number | null;
}

const UP = 150, DOWN = 115;

export function computeMovementReport(frames: PoseFrame[]): MovementReport {
  const rows: Row[] = frames.map((f) => {
    const lms = f.poses[0]?.landmarks;
    const a = (def: AngleDef) => (lms ? angleOf(lms, def) : null);
    return {
      t: f.time,
      det: f.detected,
      lKnee: a(KNEE_L), rKnee: a(KNEE_R),
      lHip: a(HIP_L), rHip: a(HIP_R),
      lSh: a(DEFS.l_shoulder), rSh: a(DEFS.r_shoulder),
    };
  });

  /* 检出统计与空档 */
  const detected = rows.filter((r) => r.det).length;
  const gaps: string[] = [];
  let g0: number | null = null;
  for (const r of rows) {
    if (!r.det && g0 == null) g0 = r.t;
    if (r.det && g0 != null) {
      if (r.t - g0 > 0.4) gaps.push(`${g0.toFixed(1)}s-${r.t.toFixed(1)}s`);
      g0 = null;
    }
  }
  if (g0 != null) gaps.push(`${g0.toFixed(1)}s-结尾`);

  /* 合并膝/髋角（左优先右补）+ ±2 帧平滑 */
  const raw = rows.map((r) => ({ t: r.t, v: r.lKnee ?? r.rKnee, hip: r.lHip ?? r.rHip }));
  const sm = raw.map((_, i) => {
    const vs: number[] = [];
    for (let j = Math.max(0, i - 2); j <= Math.min(raw.length - 1, i + 2); j++) {
      if (raw[j].v != null) vs.push(raw[j].v as number);
    }
    return { t: raw[i].t, v: vs.length ? vs.reduce((a, b) => a + b) / vs.length : null };
  });

  /* 迟滞状态机分段 */
  const cycles: { pts: { t: number; v: number }[] }[] = [];
  let state: "up" | "down" = "up", cur: { pts: { t: number; v: number }[] } | null = null;
  for (const k of sm) {
    if (k.v == null) continue;
    if (state === "up" && k.v < DOWN) { cur = { pts: [] }; state = "down"; }
    if (state === "down" && cur) {
      cur.pts.push({ t: k.t, v: k.v });
      if (k.v > UP) { cycles.push(cur); cur = null; state = "up"; }
    }
  }

  const reps: MovementRep[] = [];
  cycles.forEach((c) => {
    const pts = c.pts;
    let min = pts[0], i0 = 0;
    pts.forEach((p, i) => { if (p.v < min.v) { min = p; i0 = i; } });
    let s140 = pts[0].t;
    for (let i = i0; i >= 0; i--) if (pts[i].v > 140) { s140 = pts[i].t; break; }
    let e140 = pts[pts.length - 1].t;
    for (let i = i0; i < pts.length; i++) if (pts[i].v > 140) { e140 = pts[i].t; break; }
    const b90 = pts.filter((p) => p.v < 90);
    const fr = rows.find((r) => Math.abs(r.t - min.t) < 0.02);
    const total = e140 - s140;
    const minKnee = min.v;
    if (total <= 0.6 || minKnee >= 130) return;

    const rep: MovementRep = {
      kind: "partial",
      start: +s140.toFixed(2),
      bottomAt: +min.t.toFixed(2),
      end: +e140.toFixed(2),
      minKnee: +minKnee.toFixed(1),
      hipAtMin: fr && (fr.lHip ?? fr.rHip) != null ? +(fr.lHip ?? fr.rHip as number).toFixed(1) : null,
      descS: +(min.t - s140).toFixed(2),
      ascS: +(e140 - min.t).toFixed(2),
      bottomS: b90.length ? +(b90[b90.length - 1].t - b90[0].t).toFixed(2) : 0,
      restBefore: null,
      geom: geomAt(frames, min.t),
    };
    const bottomS = b90.length ? +(b90[b90.length - 1].t - b90[0].t).toFixed(2) : 0;
    if (minKnee >= 90) rep.kind = "partial";
    else if (bottomS > 1.8) rep.kind = "crouch";
    else if (rep.geom) {
      const g = rep.geom;
      const shapeOk = g.hipBelowKneeY > -0.01 && (g.asymDeg == null || g.asymDeg < 20) &&
        (rep.hipAtMin == null || rep.hipAtMin > rep.minKnee - 5);
      rep.kind = shapeOk ? "squat" : "hinge";
    } else rep.kind = "squat";
    reps.push(rep);
  });
  reps.forEach((r, i) => {
    if (i > 0) r.restBefore = +(r.start - reps[i - 1].end).toFixed(2);
  });

  /* 各关节活动度 */
  const rom = (pick: (r: Row) => number | null) => {
    const vs = rows.map(pick).filter((v): v is number => v != null);
    return vs.length ? { min: Math.round(Math.min(...vs)), max: Math.round(Math.max(...vs)) } : null;
  };

  /* 疲劳趋势（≥3 次深蹲） */
  const squats = reps.filter((r) => r.kind === "squat");
  let fatigue: MovementReport["fatigue"] = null;
  if (squats.length >= 3) {
    const a0 = squats[0].ascS, a1 = squats[squats.length - 1].ascS;
    fatigue = {
      ascFirst: a0,
      ascLast: a1,
      ascPct: Math.round(((a1 - a0) / a0) * 100),
      bottomFirst: squats[0].bottomS,
      bottomLast: squats[squats.length - 1].bottomS,
      descStable: Math.max(...squats.map((s) => s.descS)) - Math.min(...squats.map((s) => s.descS)) < 0.3,
    };
  }

  return {
    qc: {
      frames: frames.length,
      detected,
      rate: `${((detected / Math.max(1, frames.length)) * 100).toFixed(1)}%`,
      gaps,
    },
    reps,
    rom: {
      lKnee: rom((r) => r.lKnee), rKnee: rom((r) => r.rKnee),
      lHip: rom((r) => r.lHip), rHip: rom((r) => r.rHip),
      lSh: rom((r) => r.lSh), rSh: rom((r) => r.rSh),
    },
    fatigue,
  };
}

/* 底部帧几何指标（归一化坐标计算，与 skill 脚本一致） */
function geomAt(frames: PoseFrame[], t: number): RepGeom | null {
  let fr = frames[0];
  for (const f of frames) if (Math.abs(f.time - t) < Math.abs(fr.time - t)) fr = f;
  const lms = fr.poses[0]?.landmarks;
  if (!lms) return null;
  const mid = (i: number, j: number): [number, number] => [(lms[i][0] + lms[j][0]) / 2, (lms[i][1] + lms[j][1]) / 2];
  const shMid = mid(11, 12), hipMid = mid(23, 24), kneeMid = mid(25, 26);
  const dx = shMid[0] - hipMid[0], dy = shMid[1] - hipMid[1];
  const lk = angleOf(lms, KNEE_L), rk = angleOf(lms, KNEE_R);
  return {
    leanDeg: +((Math.atan2(Math.abs(dx), Math.abs(dy)) * 180) / Math.PI).toFixed(1),
    shSepX: +Math.abs(lms[11][0] - lms[12][0]).toFixed(3),
    hipBelowKneeY: +(hipMid[1] - kneeMid[1]).toFixed(3),
    asymDeg: lk != null && rk != null ? +Math.abs(lk - rk).toFixed(1) : null,
    heelV: [lms[29][3], lms[30][3]],
  };
}

/* AI 教练消息：判读规则（skill 判读标准精简版）+ 已算好的指标。
 * 约束 DeepSeek 只解读、不重算，是准确性的关键。 */
export function buildPoseCoachMessages(report: MovementReport, profile?: BodyProfile | null): ApiMessage[] {
  const sys = [
    "你是 FitLog 的动作分析教练。以下是本地规则引擎从用户训练视频计算的指标（JSON），所有数字已经算好，你只负责解读：",
    "- 只基于给定数字解读，禁止自行估算或补算任何角度",
    "- 判读标准：底部膝角<90°达标；geom.hipBelowKneeY>0 表示髋低于膝（全深蹲）；geom.leanDeg 20–30°躯干直立良好，>45°提示前倾过多；geom.asymDeg>15 提示左右不对称；geom.shSepX<0.05 为侧面视角（深度/前倾结论可信），>0.1 为正面（深度不可靠，只谈对称类指标）",
    "- kind 字段：只有 squat 计入训练次数；hinge=俯身捡拾类、crouch=长时间蹲姿保持、partial=浅幅屈膝，均为非训练动作",
    "- fatigue.ascPct ≥ +30 表示起身逐次明显变慢（疲劳信号）",
    "- geom.heelV 任一侧 <0.5 时，不得下“脚跟离地/膝盖内扣”类结论",
    "- qc.gaps 有检出空档时结论要保守并说明",
    "输出（中文，≤250字）：①一句话总结论 ②逐次要点（只挑有问题的次数）③2–3条可执行的改进建议 ④一句数据局限。",
  ].join("\n");
  let profileLine = "";
  if (profile && (profile.heightCm > 0 || profile.weightKg > 0)) {
    profileLine = `\n\n用户身体数据：身高 ${profile.heightCm}cm，体重 ${profile.weightKg}kg${profile.goal ? `，目标「${profile.goal}」` : ""}。`;
  }
  return [
    { role: "system", content: sys },
    { role: "user", content: `请分析这组动作指标：\n${JSON.stringify(report)}${profileLine}` },
  ];
}
