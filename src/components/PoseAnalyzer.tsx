import { Camera, ChevronDown, FileJson, Film, Pause, PersonStanding, Play, ScanLine, Table2 } from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { POSE_MODELS, applyPoseRuntimeOptions, createPoseLandmarker, type PoseModelKey } from "../services/poseLandmarker";
import { PoseMovementCard } from "./PoseMovementCard";
import {
  ANGLE_DEFS,
  clamp,
  computeAngles,
  drawPose,
  fmtDur,
  recordFrame,
  seekTo,
  waitForDuration,
  type PoseAngles,
  type PoseFrame,
} from "../utils/poseData";
import {
  baseName,
  buildAnglesCSV,
  buildLandmarksCSV,
  buildPoseJSON,
  download,
  snapshotCanvas,
} from "../utils/poseExport";
import { Stat } from "./Stat";

const WORK_MAX_W = 960; // 分析用离屏画布的最大宽度
const EMPTY_ANGLES = computeAngles(null);

type ModelStatus =
  | { kind: "idle" }
  | { kind: "loading"; text: string }
  | { kind: "ok"; text: string }
  | { kind: "error"; text: string };

interface PoseStats {
  frames: string | number;
  detected: string | number;
  rate: string | number;
  score: string | number;
}

/**
 * 姿态分析：选择本地视频 → 逐帧 seek + MediaPipe 推理 → 骨架回放 / 关节角度 / 导出。
 * 折叠卡片，首次展开才加载模型；视频与推理全程在浏览器本地完成。
 */
export function PoseAnalyzer() {
  /* ---------- refs ---------- */
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const stageInnerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  // 分析用离屏画布（限制宽度以降低推理前绘制开销）
  const work = useMemo(() => document.createElement("canvas"), []);

  // 高频数据放 ref，避免逐帧触发 React 渲染
  const framesRef = useRef<PoseFrame[]>([]);
  const paramsRef = useRef({ fps: 30, step: 1 });
  const analyzingRef = useRef(false);
  const analyzedRef = useRef(false);
  const cancelRef = useRef(false);
  const tsCursorRef = useRef(0); // VIDEO 模式时间戳需单调递增（跨次分析也要递增）
  const shownIdxRef = useRef(-1);
  const urlRef = useRef<string | null>(null);

  /* ---------- 卡片展开 / 模型 ---------- */
  const [expanded, setExpanded] = useState(false);
  const [modelLoadRequested, setModelLoadRequested] = useState(false);
  const [modelKey, setModelKey] = useState<PoseModelKey>("lite");
  const [modelStatus, setModelStatus] = useState<ModelStatus>({ kind: "idle" });

  /* ---------- 设置 ---------- */
  const [numPoses, setNumPoses] = useState(1);
  const [minConf, setMinConf] = useState(0.5);
  const [fps, setFps] = useState(30);
  const [step, setStep] = useState(1);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [visThresh, setVisThresh] = useState(0.4);
  const [speed, setSpeed] = useState(1);

  /* ---------- 视频 ---------- */
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState(0);
  const [videoMeta, setVideoMeta] = useState<{ w: number; h: number; duration: number } | null>(null);
  const [fitSize, setFitSize] = useState<{ w: number; h: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  /* ---------- 分析结果 ---------- */
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [progress, setProgress] = useState({ pct: 0, text: "尚未分析" });
  const [stats, setStats] = useState<PoseStats>({ frames: "—", detected: "—", rate: "—", score: "—" });
  const [angles, setAngles] = useState<PoseAngles>(EMPTY_ANGLES);
  const [toast, setToast] = useState({ msg: "", kind: "" });
  const toastTimer = useRef<number | undefined>(undefined);

  const showToast = useCallback((msg: string, kind = "info") => {
    setToast({ msg, kind });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast({ msg: "", kind: "" }), 2800);
  }, []);

  /* =========================================================
   * 模型加载（首次展开触发；切换模型时重建）
   * ========================================================= */
  useEffect(() => {
    if (!modelLoadRequested) return;
    let cancelled = false;
    (async () => {
      setModelStatus({ kind: "loading", text: `正在加载姿态模型（${POSE_MODELS[modelKey].label}）…` });
      try {
        const { landmarker, delegate } = await createPoseLandmarker(modelKey, { numPoses: 1, minConf: 0.5 });
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current?.close();
        landmarkerRef.current = landmarker;
        tsCursorRef.current = 0;
        setModelStatus({ kind: "ok", text: `模型就绪 · ${POSE_MODELS[modelKey].label} · ${delegate}` });
      } catch (e) {
        console.error(e);
        setModelStatus({ kind: "error", text: "模型加载失败，请检查网络后重试" });
        showToast("模型加载失败：" + (e as Error).message, "error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modelLoadRequested, modelKey, showToast]);

  // 切换过模型时提示重新分析（首次加载不提示）
  const modelSwitchedRef = useRef(false);
  useEffect(() => {
    if (!modelSwitchedRef.current) {
      modelSwitchedRef.current = true;
      return;
    }
    showToast(`已切换到 ${POSE_MODELS[modelKey].label} 模型，建议重新分析`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelKey]);

  useEffect(
    () => () => {
      landmarkerRef.current?.close?.();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      window.clearTimeout(toastTimer.current);
    },
    [],
  );

  /* =========================================================
   * 视频加载
   * ========================================================= */
  const resetAnalysis = useCallback(() => {
    framesRef.current = [];
    analyzedRef.current = false;
    setAnalyzed(false);
    shownIdxRef.current = -1;
    setStats({ frames: "—", detected: "—", rate: "—", score: "—" });
    setAngles(EMPTY_ANGLES);
    const overlay = overlayRef.current;
    overlay?.getContext("2d")?.clearRect(0, 0, overlay.width, overlay.height);
  }, []);

  const loadVideoFile = useCallback(
    (file: File | undefined) => {
      // 部分系统对 mp4 不回传 MIME 类型，用扩展名兜底
      const isVideo = (file?.type || "").startsWith("video/") ||
        /\.(mp4|m4v|webm|mov|mkv|ogv|avi)$/i.test(file?.name || "");
      if (!file || !isVideo) {
        showToast("请选择视频文件（mp4 / webm 等）", "error");
        return;
      }
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      resetAnalysis();
      setVideoMeta(null);
      setFitSize(null);
      setCurrentTime(0);
      setPlaying(false);
      urlRef.current = URL.createObjectURL(file);
      setFileName(file.name);
      setFileSize(file.size);
      const v = videoRef.current;
      if (!v) return;
      v.src = urlRef.current;
      v.load();
    },
    [resetAnalysis, showToast],
  );

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    loadVideoFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const handleMeta = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (!isFinite(v.duration)) await waitForDuration(v);
    const duration = isFinite(v.duration) ? v.duration : 0;
    if (!v.videoWidth || !duration) {
      showToast("无法读取该视频的画面信息，请换一个文件", "error");
      return;
    }
    setVideoMeta({ w: v.videoWidth, h: v.videoHeight, duration });
    v.currentTime = 0;
    v.play().catch(() => undefined);
  };

  const handleVideoError = () => {
    const v = videoRef.current;
    const code = v?.error?.code;
    let msg = "视频加载失败";
    if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
      msg = "浏览器无法解码该视频（常见于 H.265/HEVC 编码的 MP4），请转成 H.264 编码后重试";
    } else if (code === MediaError.MEDIA_ERR_DECODE) {
      msg = "视频解码出错，文件可能损坏";
    }
    setVideoMeta(null);
    setFitSize(null);
    setProgress({ pct: 0, text: msg });
    showToast(msg, "error");
  };

  /* =========================================================
   * 舞台自适应：按视频真实宽高比 contain，限高约半屏（横竖屏都不变形）
   * ========================================================= */
  const fitStage = useCallback(() => {
    const v = videoRef.current;
    const stage = stageRef.current;
    const overlay = overlayRef.current;
    if (!v?.videoWidth || !stage || !overlay) return;
    overlay.width = v.videoWidth;
    overlay.height = v.videoHeight;
    const availW = stage.clientWidth;
    const availH = Math.max(200, Math.round(window.innerHeight * 0.5));
    const scale = Math.min(availW / v.videoWidth, availH / v.videoHeight);
    setFitSize({ w: Math.floor(v.videoWidth * scale), h: Math.floor(v.videoHeight * scale) });
  }, []);

  useEffect(() => {
    if (videoMeta) fitStage();
  }, [videoMeta, fitStage]);

  useEffect(() => {
    if (expanded) fitStage(); // 折叠时 clientWidth 为 0，展开后需重算
  }, [expanded, fitStage]);

  useEffect(() => {
    const onResize = () => fitStage();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fitStage]);

  /* =========================================================
   * 骨架绘制 / 播放同步
   * ========================================================= */
  const drawFrameOverlay = useCallback(
    (idx: number) => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      const ctx = overlay.getContext("2d");
      if (!ctx) return;
      const W = overlay.width, H = overlay.height;
      ctx.clearRect(0, 0, W, H);
      if (!showSkeleton) return;
      const f = framesRef.current[idx];
      if (!f) return;
      for (const pose of f.poses) drawPose(ctx, pose.landmarks, W, H, visThresh);
    },
    [showSkeleton, visThresh],
  );

  const drawRef = useRef(drawFrameOverlay);
  drawRef.current = drawFrameOverlay;

  // 切换骨架显示/可见度阈值时重绘当前帧
  useEffect(() => {
    if (shownIdxRef.current >= 0) drawFrameOverlay(shownIdxRef.current);
  }, [drawFrameOverlay]);

  const frameIndexAt = useCallback((t: number) => {
    const frames = framesRef.current;
    if (!frames.length) return -1;
    const { fps: f, step: s } = paramsRef.current;
    return clamp(Math.round((t * f) / s), 0, frames.length - 1);
  }, []);

  // rAF 同步：时间轴 + 当前帧骨架 + 关节角度
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) {
        setCurrentTime((prev) => (Math.abs(prev - v.currentTime) >= 0.05 ? v.currentTime : prev));
        if (analyzedRef.current && !analyzingRef.current && framesRef.current.length) {
          const idx = frameIndexAt(v.currentTime);
          if (idx !== -1 && idx !== shownIdxRef.current) {
            shownIdxRef.current = idx;
            drawRef.current(idx);
            const f = framesRef.current[idx];
            setAngles(f?.poses[0] ? computeAngles(f.poses[0].landmarks) : EMPTY_ANGLES);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frameIndexAt]);

  /* =========================================================
   * 离线逐帧分析
   * ========================================================= */
  const computeStats = useCallback(() => {
    const frames = framesRef.current;
    const n = frames.length;
    const d = frames.filter((f) => f.detected).length;
    setStats({
      frames: n || "—",
      detected: n ? d : "—",
      rate: n ? `${((d / n) * 100).toFixed(1)}%` : "—",
      score: n && d
        ? (frames.filter((f) => f.detected).reduce((s, f) => s + f.poses[0].score, 0) / d).toFixed(2)
        : "—",
    });
  }, []);

  const analyze = useCallback(async () => {
    const v = videoRef.current;
    if (!v || !landmarkerRef.current || !videoMeta || analyzingRef.current) return;

    analyzingRef.current = true;
    setAnalyzing(true);
    cancelRef.current = false;
    framesRef.current = [];
    analyzedRef.current = false;
    setAnalyzed(false);
    shownIdxRef.current = -1;

    v.pause();
    v.currentTime = 0;

    let errorMsg: string | null = null;
    let lastUi = 0;
    try {
      landmarkerRef.current = await applyPoseRuntimeOptions(landmarkerRef.current, modelKey, { numPoses, minConf });

      const f = clamp(+fps || 30, 1, 120);
      const s = clamp(+step || 1, 1, 60);
      paramsRef.current = { fps: f, step: s };
      const total = Math.max(1, Math.floor((videoMeta.duration * f) / s));

      const w = Math.min(WORK_MAX_W, v.videoWidth);
      work.width = w;
      work.height = Math.round((v.videoHeight * w) / v.videoWidth);
      const wctx = work.getContext("2d");

      setProgress({ pct: 0, text: "分析中…" });
      const t0 = performance.now();
      for (let i = 0; i < total; i++) {
        if (cancelRef.current) break;
        const t = (i * s + 0.5) / f; // 对准帧中点，避免取到相邻帧
        if (t > videoMeta.duration) break;
        await seekTo(v, t);

        wctx?.drawImage(v, 0, 0, work.width, work.height);
        const ts = tsCursorRef.current + Math.round(t * 1000);
        let result = null;
        try {
          result = landmarkerRef.current.detectForVideo(work, ts);
        } catch (e) {
          console.warn("[pose] 第", i, "帧推理失败：", (e as Error).message);
        }
        tsCursorRef.current = ts + 1;
        framesRef.current.push(recordFrame(i, t, result));

        // 实时反馈：骨架叠加到当前帧
        shownIdxRef.current = i;
        drawRef.current(i);

        const now = performance.now();
        if (now - lastUi > 250 || i === total - 1) {
          lastUi = now;
          const eta = ((now - t0) / (i + 1)) * (total - i - 1);
          setProgress({
            pct: ((i + 1) / total) * 100,
            text: `分析中 ${i + 1}/${total} · 剩余约 ${fmtDur(eta / 1000)}`,
          });
          computeStats();
        }
      }
      analyzedRef.current = framesRef.current.length > 0;
    } catch (e) {
      console.error("[pose] 分析失败：", e);
      errorMsg = (e as Error).message || String(e);
    } finally {
      analyzingRef.current = false;
      setAnalyzing(false);
      setAnalyzed(analyzedRef.current);
      computeStats();
      const n = framesRef.current.length;
      if (errorMsg) {
        setProgress({ pct: 0, text: `分析出错：${errorMsg}` });
        showToast("分析出错：" + errorMsg, "error");
      } else {
        setProgress({
          pct: 100,
          text: cancelRef.current ? `已取消 · 已分析 ${n} 帧` : `分析完成 · 共 ${n} 帧`,
        });
        showToast(cancelRef.current ? "分析已取消，结果为部分数据" : "分析完成，可播放查看骨架效果");
      }
      v.currentTime = 0;
      shownIdxRef.current = -1;
    }
  }, [modelKey, numPoses, minConf, fps, step, videoMeta, computeStats, showToast]);

  const cancelAnalyze = useCallback(() => {
    cancelRef.current = true;
  }, []);

  /* =========================================================
   * 播放控制
   * ========================================================= */
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!videoMeta || analyzingRef.current) return;
    if (v?.paused) v.play().catch(() => undefined);
    else v?.pause();
  }, [videoMeta]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  /* =========================================================
   * 导出
   * ========================================================= */
  const exportJSON = useCallback(() => {
    const data = buildPoseJSON(framesRef.current, {
      video: fileName,
      duration: videoMeta?.duration,
      fpsAssumed: paramsRef.current.fps,
      step: paramsRef.current.step,
      model: modelKey,
      numPoses,
      minConfidence: minConf,
    });
    download(`${baseName(fileName)}.pose.json`, new Blob([data], { type: "application/json" }));
    showToast("已导出 JSON");
  }, [fileName, videoMeta, modelKey, numPoses, minConf, showToast]);

  const exportLandmarks = useCallback(() => {
    download(`${baseName(fileName)}.landmarks.csv`, new Blob([buildLandmarksCSV(framesRef.current)], { type: "text/csv" }));
    showToast("已导出关键点 CSV");
  }, [fileName, showToast]);

  const exportAngles = useCallback(() => {
    download(`${baseName(fileName)}.angles.csv`, new Blob([buildAnglesCSV(framesRef.current)], { type: "text/csv" }));
    showToast("已导出角度 CSV");
  }, [fileName, showToast]);

  const exportSnapshot = useCallback(() => {
    const v = videoRef.current;
    const overlay = overlayRef.current;
    if (!v || !overlay) return;
    drawRef.current(frameIndexAt(v.currentTime)); // 与当前帧保持一致
    snapshotCanvas(v, overlay).toBlob(
      (b) => {
        if (!b) return;
        download(`${baseName(fileName)}_t${v.currentTime.toFixed(2)}s.png`, b);
        showToast("已保存当前帧截图");
      },
      "image/png",
    );
  }, [fileName, frameIndexAt, showToast]);

  /* ---------- 派生值 ---------- */
  const estFrames = videoMeta
    ? Math.floor((videoMeta.duration * clamp(fps || 30, 1, 120)) / clamp(step || 1, 1, 60))
    : null;
  const metaText = videoMeta
    ? `${videoMeta.w}×${videoMeta.h} · ${videoMeta.duration.toFixed(1)} 秒 · ${(fileSize / 1048576).toFixed(1)} MB`
    : fileName
      ? "读取中…"
      : "—";
  const canAnalyze = !!videoMeta && modelStatus.kind === "ok";

  const statusDot =
    modelStatus.kind === "ok" ? "bg-ocean" : modelStatus.kind === "error" ? "bg-coral" : modelStatus.kind === "loading" ? "bg-citrus animate-pulse" : "bg-ink/30";
  const statusText =
    modelStatus.kind === "idle"
      ? `首次使用需下载模型（${POSE_MODELS[modelKey].label} 约 ${modelKey === "lite" ? 6 : 9}MB）`
      : modelStatus.text;

  const toggleExpanded = () => {
    setExpanded((prev) => {
      if (!prev) setModelLoadRequested(true);
      return !prev;
    });
  };

  return (
    <section className="rounded-[8px] border border-line bg-glass backdrop-blur-md p-4">
      <button type="button" onClick={toggleExpanded} className="flex w-full items-center justify-between gap-2 text-left">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-mist text-ocean">
            <PersonStanding size={20} aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-base font-bold">姿态分析</h3>
            <p className="mt-0.5 text-xs text-ink/50">本地视频骨架识别 · 关节角度</p>
          </div>
        </div>
        <ChevronDown size={18} className={`flex-shrink-0 text-ink/50 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {/* 折叠时保持挂载（隐藏），避免丢失已加载的视频与分析进度 */}
      <div className={expanded ? "mt-4" : "hidden"}>
        {/* 模型状态 */}
        <div className="flex items-center gap-2 rounded-[8px] bg-mist px-3 py-2">
          <span className={`h-2 w-2 flex-shrink-0 rounded-full ${statusDot}`} />
          <span className="min-w-0 flex-1 truncate text-xs text-ink/60">{statusText}</span>
        </div>

        {/* 视频舞台 */}
        <div ref={stageRef} className="mt-3 w-full">
          <div
            ref={stageInnerRef}
            className="relative mx-auto overflow-hidden rounded-[8px] bg-black"
            style={fitSize ? { width: fitSize.w, height: fitSize.h } : { width: "100%", aspectRatio: "16 / 9" }}
            onClick={() => {
              if (!videoMeta && !analyzing) fileInputRef.current?.click();
            }}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              preload="auto"
              className="h-full w-full object-contain"
              onLoadedMetadata={handleMeta}
              onError={handleVideoError}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
            />
            <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
            {!videoMeta && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[8px] border border-dashed border-line px-4 text-center">
                <Film className="text-ink/30" size={30} aria-hidden="true" />
                <p className="text-sm font-semibold text-ink/50">点击选择训练视频</p>
                <p className="text-xs text-ink/30">mp4 / webm / mov · 全程本地分析，视频不会上传</p>
              </div>
            )}
          </div>
        </div>

        {/* 播放控制 */}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!videoMeta || analyzing}
            aria-label={playing ? "暂停" : "播放"}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[8px] bg-mist text-ink disabled:opacity-40"
          >
            {playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
          </button>
          <span className="w-[78px] flex-shrink-0 text-center text-xs tabular-nums text-ink/60">
            {fmtDur(currentTime)} / {fmtDur(videoMeta?.duration || 0)}
          </span>
          <input
            type="range"
            min="0"
            max={(videoMeta?.duration || 100).toFixed(2)}
            step="0.01"
            value={Math.min(currentTime, videoMeta?.duration || 100)}
            disabled={!videoMeta || analyzing}
            onChange={(e) => {
              if (!analyzing) videoRef.current && (videoRef.current.currentTime = +e.target.value);
            }}
            aria-label="进度"
            className="h-11 min-w-0 flex-1 accent-ocean"
          />
          <select
            value={speed}
            onChange={(e) => setSpeed(+e.target.value)}
            aria-label="播放速度"
            className="h-11 flex-shrink-0 rounded-[8px] border border-line bg-mist px-1 text-base text-ink"
          >
            {[0.25, 0.5, 0.75, 1, 1.5, 2].map((s) => (
              <option key={s} value={s}>{s}×</option>
            ))}
          </select>
        </div>

        {/* 骨架开关 + 可见度 */}
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSkeleton((v) => !v)}
            className={`h-11 flex-shrink-0 rounded-[8px] px-3 text-sm font-semibold ${showSkeleton ? "bg-ocean text-mist" : "bg-mist text-ink/60"}`}
          >
            骨架
          </button>
          <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[8px] bg-mist px-3">
            <span className="flex-shrink-0 text-xs text-ink/50">可见度</span>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={visThresh}
              onChange={(e) => setVisThresh(+e.target.value)}
              aria-label="关键点可见度阈值"
              className="min-w-0 flex-1 accent-ocean"
            />
            <b className="w-9 flex-shrink-0 text-right text-xs tabular-nums text-ink/60">{visThresh.toFixed(2)}</b>
          </div>
        </div>

        {/* 分析进度 */}
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-ink/10">
            <div className="h-full rounded-full bg-ocean" style={{ width: `${progress.pct}%` }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="min-w-0 flex-1 truncate text-xs text-ink/50">{progress.text}</span>
            {analyzing && (
              <button type="button" onClick={cancelAnalyze} className="h-9 flex-shrink-0 rounded-[8px] bg-mist px-3 text-xs font-semibold text-coral">
                取消
              </button>
            )}
          </div>
        </div>

        {/* 选择视频 */}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={analyzing}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-mist text-sm font-semibold text-ink disabled:opacity-40"
          >
            <Film size={17} aria-hidden="true" />
            {fileName ? "重新选择视频" : "选择视频"}
          </button>
          <p className="mt-2 break-all text-xs text-ink/50">{fileName || "未选择文件"}</p>
          <p className="mt-0.5 text-xs text-ink/40">{metaText}</p>
        </div>

        {/* 分析设置 */}
        <div className="mt-3 rounded-[8px] border border-line bg-surface p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-ink/50">
              识别模型
              <select
                value={modelKey}
                onChange={(e) => setModelKey(e.target.value as PoseModelKey)}
                className="mt-1 h-11 w-full rounded-[8px] border border-line bg-mist px-2 text-base text-ink"
              >
                <option value="lite">lite（轻量·快）</option>
                <option value="full">full（高精度·慢）</option>
              </select>
            </label>
            <label className="text-xs text-ink/50">
              最多人数
              <select
                value={numPoses}
                onChange={(e) => setNumPoses(+e.target.value)}
                className="mt-1 h-11 w-full rounded-[8px] border border-line bg-mist px-2 text-base text-ink"
              >
                <option value={1}>1 人</option>
                <option value={2}>2 人</option>
                <option value={3}>3 人</option>
              </select>
            </label>
            <label className="col-span-2 text-xs text-ink/50">
              <span className="flex items-center justify-between">
                检测置信度
                <b className="text-xs tabular-nums text-ink/60">{minConf.toFixed(2)}</b>
              </span>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={minConf}
                onChange={(e) => setMinConf(+e.target.value)}
                className="mt-1 h-11 w-full accent-ocean"
              />
            </label>
            <label className="text-xs text-ink/50">
              视频帧率（估算）
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="120"
                step="1"
                value={fps}
                onChange={(e) => setFps(+e.target.value || 1)}
                className="mt-1 h-11 w-full rounded-[8px] border border-line bg-mist px-2 text-base text-ink"
              />
            </label>
            <label className="text-xs text-ink/50">
              帧步长（每 N 帧取 1 帧）
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="60"
                step="1"
                value={step}
                onChange={(e) => setStep(Math.min(60, Math.max(1, +e.target.value || 1)))}
                className="mt-1 h-11 w-full rounded-[8px] border border-line bg-mist px-2 text-base text-ink"
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-ink/40">{estFrames != null ? `预计分析 ${estFrames} 帧` : "请先选择视频"}</p>
          <button
            type="button"
            onClick={analyze}
            disabled={!canAnalyze || analyzing}
            className="mt-2 h-12 w-full rounded-[8px] bg-ocean text-sm font-semibold text-white disabled:opacity-40"
          >
            {analyzing ? "分析中…" : analyzed ? "重新分析" : "开始离线分析"}
          </button>
        </div>

        {/* 结果统计 */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          <Stat label="分析帧数" value={stats.frames} />
          <Stat label="检出帧数" value={stats.detected} />
          <Stat label="检出率" value={stats.rate} />
          <Stat label="平均可见度" value={stats.score} />
        </div>

        {/* 关节角度 */}
        <div className="mt-3">
          <p className="text-xs text-ink/50">关节角度 · 当前帧第一人</p>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {ANGLE_DEFS.map((def) => {
              const v = angles?.[def.key];
              return (
                <div key={def.key} className="rounded-[8px] border border-line bg-mist px-1 py-2 text-center">
                  <p className="text-[10px] text-ink/50">{def.name}</p>
                  <p className={`mt-0.5 text-sm font-bold tabular-nums ${def.side === "left" ? "text-ocean" : "text-coral"}`}>
                    {v == null ? "—" : `${v.toFixed(0)}°`}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* 导出 */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={exportJSON}
            disabled={!analyzed}
            className="flex h-11 items-center justify-center gap-1.5 rounded-[8px] bg-mist text-xs font-semibold text-ink disabled:opacity-40"
          >
            <FileJson size={15} aria-hidden="true" /> JSON 全量
          </button>
          <button
            type="button"
            onClick={exportLandmarks}
            disabled={!analyzed}
            className="flex h-11 items-center justify-center gap-1.5 rounded-[8px] bg-mist text-xs font-semibold text-ink disabled:opacity-40"
          >
            <ScanLine size={15} aria-hidden="true" /> 关键点 CSV
          </button>
          <button
            type="button"
            onClick={exportAngles}
            disabled={!analyzed}
            className="flex h-11 items-center justify-center gap-1.5 rounded-[8px] bg-mist text-xs font-semibold text-ink disabled:opacity-40"
          >
            <Table2 size={15} aria-hidden="true" /> 角度 CSV
          </button>
          <button
            type="button"
            onClick={exportSnapshot}
            disabled={!analyzed}
            className="flex h-11 items-center justify-center gap-1.5 rounded-[8px] bg-mist text-xs font-semibold text-ink disabled:opacity-40"
          >
            <Camera size={15} aria-hidden="true" /> 保存截图
          </button>
        </div>

        {/* 动作分析：本地规则引擎 + 可选 AI 点评 */}
        <PoseMovementCard getFrames={() => framesRef.current} analyzed={analyzed} showToast={showToast} />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept="video/*,.mp4,.m4v,.webm,.mov,.mkv"
        onChange={handleFileInput}
      />

      {/* 顶部容器带 backdrop-filter，fixed 需挂到 body 才能相对视口定位 */}
      {toast.msg &&
        createPortal(
          <div
            className={`fixed bottom-24 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-[8px] glass-strong px-4 py-2.5 text-sm font-semibold shadow-glass ${
              toast.kind === "error" ? "text-coral" : "text-ink"
            }`}
          >
            {toast.msg}
          </div>,
          document.body,
        )}
    </section>
  );
}
