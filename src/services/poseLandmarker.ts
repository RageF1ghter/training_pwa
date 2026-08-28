import type { PoseLandmarker } from "@mediapipe/tasks-vision";

const BASE = import.meta.env.BASE_URL;
const TASKS_VERSION = "1.0.1";
const CDN_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/wasm`;

/* 优先本地 public/（断网可用），CDN 仅作回退 */
export const WASM_DIRS = [`${BASE}wasm`, CDN_WASM];

export type PoseModelKey = "lite" | "full";

export const POSE_MODELS: Record<PoseModelKey, { label: string; local: string; remote: string }> = {
  lite: {
    label: "lite",
    local: `${BASE}models/pose_landmarker_lite.task`,
    remote: "https://storage.googleapis.com/mediapipe-models/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  },
  full: {
    label: "full",
    local: `${BASE}models/pose_landmarker_full.task`,
    remote: "https://storage.googleapis.com/mediapipe-models/pose_landmarker_full/float16/1/pose_landmarker_full.task",
  },
};

export interface PoseLandmarkerBundle {
  landmarker: PoseLandmarker;
  modelKey: PoseModelKey;
  delegate: "GPU" | "CPU";
  src: "local" | "remote";
}

/**
 * 创建 landmarker：组合 本地wasm/CDNwasm × 本地模型/远程模型 × GPU/CPU 逐级尝试。
 * @mediapipe/tasks-vision 通过动态 import 引入，避免进入首屏 bundle。
 */
export async function createPoseLandmarker(
  modelKey: PoseModelKey,
  { numPoses = 1, minConf = 0.5 }: { numPoses?: number; minConf?: number } = {},
): Promise<PoseLandmarkerBundle> {
  const { FilesetResolver, PoseLandmarker: PoseLandmarkerClass } = await import("@mediapipe/tasks-vision");
  const errors: string[] = [];
  for (const wasmDir of WASM_DIRS) {
    const fileset = await FilesetResolver.forVisionTasks(wasmDir);
    for (const src of ["local", "remote"] as const) {
      const modelPath = POSE_MODELS[modelKey][src];
      for (const delegate of ["GPU", "CPU"] as const) {
        try {
          const landmarker = await PoseLandmarkerClass.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: modelPath, delegate },
            runningMode: "VIDEO",
            numPoses,
            minPoseDetectionConfidence: minConf,
            minPosePresenceConfidence: minConf,
            minTrackingConfidence: minConf,
            outputSegmentationMasks: false,
          });
          console.info(`[pose] 模型就绪: ${modelKey} · ${src} · ${delegate} · ${wasmDir}`);
          return { landmarker, modelKey, delegate, src };
        } catch (e) {
          errors.push(`${modelKey}/${src}/${delegate}: ${(e as Error).message}`);
        }
      }
    }
  }
  throw new Error(errors.join(" | "));
}

/** 把面板上的运行参数同步给 landmarker；setOptions 失败时重建模型兜底 */
export async function applyPoseRuntimeOptions(
  landmarker: PoseLandmarker,
  modelKey: PoseModelKey,
  { numPoses, minConf }: { numPoses: number; minConf: number },
): Promise<PoseLandmarker> {
  const opts = {
    numPoses,
    minPoseDetectionConfidence: minConf,
    minPosePresenceConfidence: minConf,
    minTrackingConfidence: minConf,
  };
  try {
    await landmarker.setOptions(opts);
    return landmarker;
  } catch (e) {
    console.warn("[pose] setOptions 失败，改为重建模型：", e);
    const bundle = await createPoseLandmarker(modelKey, { numPoses, minConf });
    return bundle.landmarker;
  }
}
