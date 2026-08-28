# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm run dev      # Start dev server on 0.0.0.0
npm run build    # TypeScript check (tsc -b) then Vite production build
npm run preview  # Preview production build on 0.0.0.0
```

## Architecture

FitLog is a workout-tracking PWA (React 18 + TypeScript + Vite + Tailwind CSS 3). The UI is Chinese-language and optimized for iPhone standalone mode (safe-area padding, portrait lock, 430px max-width container). Icons come from `lucide-react`.

**State & persistence model:** `App.tsx:33-69` holds all state in `useState` with lazy initializers from localStorage/IndexedDB. Every state change syncs back to storage via `useEffect` (`App.tsx:71-131`). There is no router, no context, and no state library — all state and callbacks are passed as props. The `__APP_VERSION__` global is injected at build time by Vite's `define` from `package.json` version.

**Theme system:** Dark (default) and light themes via CSS custom properties on `:root` and `html.light` in `styles.css`. The toggle (now in the Settings tab) persists preference to `localStorage` under `fitlog.theme`. Theme-aware colors are defined in `tailwind.config.ts` and used as Tailwind tokens (`bg-ocean`, `text-coral`, `bg-mist`, `text-ink`, `border-line`, `bg-glass`, `bg-surface`, `bg-glass-heavy`, `bg-citrus`) rather than hardcoded hex values. `ink`/`ocean`/`coral` are backed by `rgb(var(--*-rgb) / <alpha-value>)`, so they support opacity modifiers (`bg-ocean/10`, `text-ink/50`); `mist`/`citrus`/`surface`/`glass`/`line` resolve to plain `var(--color-*)` and do not. The `glass` and `glass-strong` utility classes provide backdrop-blur surfaces; `shadow-glass` and `shadow-lift` are the custom elevation shadows. Charts read these CSS vars at runtime via `getComputedStyle` (see `ExerciseLineChart.readCssVar`/`readCssRGB`).

**Three tabs**, toggled via bottom nav (`App.tsx`):
- **Record** (`views/RecordView.tsx`) — Draft workout form with body-part selector, exercise grid (preset + custom), set timer (start/finish/reset), weight/reps dropdown selectors. A `DraftWorkoutSummary` lists added sets inline, each editable (Pencil → edit weight/reps/duration → confirm) or deletable (Trash). Completed workouts display in `WorkoutList`. Long-press (650ms) or right-click on an exercise enters edit mode with drag-to-reorder (`@dnd-kit`) and a red delete (×) badge. The set timer has a companion rest timer: after adding a set, the UI switches to "休息中" (resting) mode with its own elapsed counter and "开始下一组" (start next set) button. Saving the workout opens a calorie-entry dialog before persisting.
- **Overview** (`views/OverviewView.tsx`) — Merged calendar + photos on a single scrolling page sharing one `selectedDate`. Top: title + week/month toggle + period totals (sets, kcal). Then the calendar grid with dot indicators (coral = workout, ocean = photo). Below: a donut chart — per-exercise distribution for the selected day (`ExercisePieChart`, click a slice → `ExerciseLineChart`), or all-history body-part distribution (`BodyPartPieChart`) when the day has no workouts. A read-only `WorkoutList` for the selected date. Then the selected day's photo section: a 2-column grid (`aspect-[4/5]`), upload (`ImagePlus` → `handlePhotoUpload` writes to IndexedDB), and per-photo delete. Clicking a calendar cell re-renders the chart, list, and photos for that day — all driven by the shared `selectedDate`/`selectDate`. At the very bottom sits the collapsible **姿态分析** card (`PoseAnalyzer`).
- **Settings** (`views/SettingsView.tsx`) — Light/dark theme toggle, body profile entry (height/weight/age/gender/goal with BMI/BMR), DeepSeek API key + chat controls, and data backup. Export supports either all data or a picked subset of dates; both produce a `fitlog-backup-YYYY-MM-DD.zip` (JSZip) containing `data.json`. Import accepts `.zip` or a raw `.json` and merges into the existing data.

**Project structure:**
```
src/
  App.tsx                          # Root — all state, persistence effects, callbacks, export/import
  main.tsx                         # Mounts App; registers SW in prod, unregisters it in dev
  types.ts                         # All shared TypeScript types
  styles.css                       # Tailwind + CSS custom properties + glass utilities
  data/exercises.ts                # 8 body parts, preset exercises (6-7 each)
  factories/workout.ts             # createBlankWorkout() factory
  utils/
    id.ts                          # makeId() — crypto.randomUUID with Math.random fallback
    date.ts                        # Date key formatting, week/month math, weekday labels
    workouts.ts                    # Aggregation helpers (sumSets, sumCalories, formatDuration, groupByDate, chart data)
    aiContext.ts                   # buildAIContextMarkdown() — aggregates workouts+profile into a Markdown snapshot for AI
    poseData.ts                    # Pose pure logic — skeleton topology, joint-angle math, frame recording, canvas drawing, video seek helpers
    poseExport.ts                  # Pose data export — JSON / landmarks CSV / angles CSV / composed PNG snapshot
  storage/
    workoutStorage.ts              # localStorage read/write + legacy migration (normalizeWorkout)
    customExerciseStorage.ts       # Custom/hidden exercise CRUD + ordering persistence
    bodyProfileStorage.ts          # Body profile (height/weight/age/gender) localStorage read/write
    chatStorage.ts                 # Chat messages, DeepSeek API key, and compacted summary persistence
    photoStorage.ts                # IndexedDB CRUD for photos + fileToDataUrl helper
  services/
    deepseek.ts                    # DeepSeek chat-completions client (chat + compactHistory); first HTTP layer in the app
    poseLandmarker.ts              # MediaPipe PoseLandmarker creation with fallback chain (local wasm/CDN × local/remote model × GPU/CPU); dynamic-imports @mediapipe/tasks-vision
  components/
    TabButton.tsx                  # Bottom nav tab button
    Stat.tsx                       # Stat display tile (label + value)
    WorkoutList.tsx                # Read-only (or delete-capable) list of saved workouts
    ExercisePieChart.tsx           # Custom SVG donut chart — per-exercise reps for a day
    BodyPartPieChart.tsx           # Custom SVG donut chart — all-history body-part reps distribution
    ExerciseLineChart.tsx          # ECharts line chart — current-vs-prev weight + rest gaps per exercise
    PoseAnalyzer.tsx               # Collapsible pose-analysis card (local video → skeleton playback, joint angles, export)
  views/
    RecordView.tsx                 # Draft workout builder, set editing, exercise management
    OverviewView.tsx               # Merged calendar grid + charts + selected-day workouts & photos
    SettingsView.tsx               # Theme toggle, body profile entry (BMI/BMR), AI settings, ZIP/JSON export & import
public/
  sw.js                            # Service Worker (network-first nav, cache-first static)
  manifest.webmanifest             # PWA manifest (standalone, portrait, dark theme)
  icons/                           # App icons (180px, 512px PNG + logo)
  models/                          # MediaPipe pose landmarker .task files (lite + full, ~15MB)
  wasm/                            # MediaPipe tasks-vision WASM runtime (simd + nosimd, ~23MB)
```

**Data layer:**
- `storage/workoutStorage.ts` — Workouts persisted to `localStorage` under `fitlog.workouts`. Includes a `normalizeWorkout` migration that handles both the current multi-exercise format and a legacy single-exercise format (with `bodyPart`/`exercise`/`sets` at the workout level).
- `storage/customExerciseStorage.ts` — Custom exercises (`fitlog.customExercises`), hidden presets (`fitlog.hiddenExercises`), and per-body-part exercise ordering (`fitlog.exerciseOrder`), each in separate localStorage keys. All readers include normalization (dedup, trim, filter invalid entries).
- `storage/photoStorage.ts` — Photos stored in IndexedDB (`fitlog.photos` database, `photos` object store, keyed by `id` with a `date` index). Uses a `withPhotoStore` helper that wraps IndexedDB transactions in promises.
- `storage/bodyProfileStorage.ts` — Body profile (`{ heightCm, weightKg, age, gender, goal }`) persisted to `localStorage` under `fitlog.bodyProfile`. Also maintains a time-series history under `fitlog.bodyProfileHistory` (array of `BodyProfileRecord = BodyProfile & { id, recordedAt }`), appended on every explicit save and sorted by `recordedAt`. Readers normalize/clamp numeric values, validate `gender`/`goal` against their unions, and dedup by `id`; empty profile defaults all fields to `0` / `""`.
- `storage/chatStorage.ts` — AI assistant state in `localStorage`: chat turns (`fitlog.chatMessages`, `ChatMessage[]` — only user/assistant are persisted; transient system messages are rebuilt by `App.tsx`), the DeepSeek API key (`fitlog.deepseekApiKey`, plaintext string), and a compacted summary (`fitlog.chatSummary`, `ChatSummary | null`). Readers normalize per message (validates `role ∈ {system,user,assistant}`, non-empty `content`, present `createdAt`) and dedup by `id`.
- `services/deepseek.ts` — First real HTTP layer in the app (no other `fetch` exists). Calls `https://api.deepseek.com/chat/completions` (OpenAI-compatible) with model `deepseek-v4-flash` (the legacy `deepseek-chat`/`deepseek-reasoner` names are deprecated 2026/07/24). Exports `chat()` and `compactHistory()`; both return `{ success, message, data? }`. `compactHistory` feeds older turns with a fixed summarization prompt to produce a ≤300-char digest. CORS is a known risk — DeepSeek may not send permissive `Access-Control-Allow-Origin`, so network failures surface a message telling the user to self-host a proxy.
- `utils/aiContext.ts` — `buildAIContextMarkdown({ workouts, bodyProfile, bodyProfileHistory, range })` aggregates the user's data into a compact Markdown snapshot (profile + BMI/BMR, training overview, body-part distribution, top-exercise strength trends, body-data trajectory). Used as the AI assistant's system-message data context. Excludes photo base64 and ids to save tokens. Reuses `aggregateBodyPartReps`/`aggregateExerciseReps`/`getExerciseSetsWithDetails`/`sumSets`/`sumCalories`.
- **Backup format** (`App.tsx`) — Export writes `{ version, exportedAt, appVersion, workouts, customExercises, hiddenExercises, exerciseOrder, bodyProfile, bodyProfileHistory, photos }` as `data.json` inside a ZIP. (Chat data and the API key are intentionally NOT included in backups — they are device-local secrets.) Import validates `version`/`workouts`/`photos`, then merges by date: existing workouts and photos for any imported date are replaced by the imported ones, while exercise config (custom/hidden/order), `bodyProfile`, and `bodyProfileHistory` are overwritten wholesale.

**Chart utilities** (`utils/workouts.ts`):
- `aggregateExerciseReps(workouts)` — Groups exercises by name, sums total reps, returns sorted `ExerciseRepsAgg[]` for the per-day pie chart.
- `aggregateBodyPartReps(workouts)` — Groups all sets by body part, sums reps, returns sorted `BodyPartRepsAgg[]` for the historical `BodyPartPieChart`.
- `getExerciseSetsWithDetails(workouts, exerciseName)` — Returns all sets for an exercise as `EnrichedSet[]` enriched with `computedDuration` (from timestamps) and `restGapSeconds` (current.startedAt - prev.finishedAt), grouped by workout date. Rest-gap tracking resets at each workout boundary so the first set of a workout is always null. Feeds the line chart detail panel.
- `formatRestGap(seconds)` — Human-readable rest gap ("2m30s" or "---" for null).
- `countWorkoutSets`/`countWorkoutReps`/`sumSets`/`sumCalories`/`groupWorkoutsByDate`/`groupPhotosByDate`/`formatDuration` — aggregation helpers used across views.

**Key types** (`types.ts`): `Workout` → `WorkoutExercise[]` → `WorkoutSet[]`. `WorkoutSet` has optional `startedAt?: number` and `finishedAt?: number` (Unix ms timestamps) for computing rest gaps. `Workout` has optional `startedAt?: number`. `BodyPart` is a union of 8 Chinese strings. `DayPhoto` holds a base64 `dataUrl`. `CalendarMode` = `"week" | "month"`. `Tab` = `"record" | "overview" | "settings"`. `BodyProfile` = `{ heightCm, weightKg, age: number, gender: Gender | "", goal: FitnessGoal | "" }` where `Gender = "male" | "female"` and `FitnessGoal` is a union of 5 Chinese strings (`增肌`/`减脂`/`维持`/`塑形`/`增力`); stored empty until the user fills it in Settings. `BodyProfileRecord = BodyProfile & { id: string, recordedAt: string }` is a timestamped snapshot appended to history on each save. Support maps: `CustomExerciseMap`, `HiddenExerciseMap`, `ExerciseOrderMap` are all `Record<BodyPart, string[]>`.

**Exercise system** (`data/exercises.ts`): 8 body parts, each with 6-7 preset exercises. Users can add custom exercises per body part, hide preset exercises, and reorder the combined list via long-press drag-and-drop. The visible exercise list per body part = `presets.filter(not hidden).concat(custom)`, ordered by saved `exerciseOrder`. Deleting a preset exercise hides it; deleting a custom exercise removes it permanently.

**Set timer & rest timer flow** (`App.tsx:216-294`):
1. User taps "开始" → `startSetTimer()` sets `timerStartedAt`/`setStartTimestamp = Date.now()`, interval ticks `elapsedSeconds`, stamps `draftWorkout.startedAt` once.
2. User taps "完成" → `finishSetTimer()` finalizes duration (`setFinishTimestamp`), stops the timer.
3. User taps "添加本组" → `addSetToDraftWorkout()` adds the set, then `resetCurrentSet()` + auto-starts rest: `setIsResting(true)`, `setRestStartedAt(Date.now())`.
4. During rest, weight/reps selectors remain visible, "开始下一组" re-enters the active set timer, and "结束休息"/"重置" call `resetCurrentSet()` to clear the active set state.

**Save flow** (`App.tsx:155-210`) — `saveWorkout()` cleans/validates the draft (drops empty exercises/sets), and if anything remains, opens the calorie-entry dialog (native `<dialog>` controlled by `calorieDialogRef`, `App.tsx:526-570`). `confirmSaveWorkout()` applies the entered calories, stamps `createdAt`, prepends the workout, registers any new exercise names as custom, selects the new date, and resets the draft + timers.

**Per-set editing** (`App.tsx:296-321`, `RecordView.tsx:534-697`) — `DraftWorkoutSummary` lets each added set be edited inline (weight/reps/duration) or deleted. `updateDraftSet` recomputes `finishedAt` from `startedAt + durationSeconds*1000` when the set has a start timestamp.

**Body profile flow** (`App.tsx` `saveBodyProfile`, `SettingsView.tsx` body section) — Unlike workout/exercise state which persists on every change, body profile uses explicit save. Fields (height/weight/age/gender/goal) stay read-only until the user taps "修改" (or "保存" on first entry); editing writes to a local `draft` and computes BMI / BMR (Mifflin-St Jeor) live. Goal is chosen from a fixed union (`增肌`/`减脂`/`塑形`/`增力`/`维持`) via tap-to-toggle chips; the active goal shows a hint next to it in read-only mode. "保存" commits via `saveBodyProfile()` only when `draft` differs from stored profile (`isDirty`): it normalizes/clamps, overwrites `fitlog.bodyProfile`, and appends a timestamped `BodyProfileRecord` to `fitlog.bodyProfileHistory` for trend analysis. "取消" discards. The last record's `recordedAt` shows as "最后更新".

**AI assistant** (`App.tsx` chat state + callbacks, `services/deepseek.ts`, `utils/aiContext.ts`, `SettingsView.tsx` AI section) — A floating button (bottom-right, above the nav) opens a full-screen native `<dialog>` chat. The user's DeepSeek API key is entered in Settings (plaintext, `fitlog.deepseekApiKey`, never included in backups). On each send, `assembleApiMessages()` builds the request: an optional prior summary (if a compact happened), then a freshly rebuilt data snapshot via `buildAIContextMarkdown(range:"30d")`, then the persisted user/assistant turns — then calls `chat()`. **Memory & compaction**: only user/assistant turns persist; when ≥ 10 such turns accumulate (5 exchanges), `maybeCompact()` takes the older turns (keeping the latest 2), asks `compactHistory()` to summarize them into ≤300 chars, stores the result in `fitlog.chatSummary`, and deletes the summarized turns — so token usage stays bounded while retaining long-term context. Compaction failure is non-fatal (history is kept, retried next time). A "刷新数据" button re-injects fresh data via a transient assistant note; "清空对话" clears messages + summary. Inputs respect iOS rules (`text-base` ≥16px, `min-w-0`); the floating button is `h-14 w-14`.

**Pose analysis** (`components/PoseAnalyzer.tsx`, bottom of Overview): local-video skeleton analysis with MediaPipe Pose Landmarker, fully ported from the standalone 姿态识别 tool. The card is collapsible; the model loads lazily on **first expand** (never on app start), and `@mediapipe/tasks-vision` is dynamic-imported so it stays a separate ~144KB chunk outside the main bundle. Creation tries a fallback chain (local wasm dir → CDN wasm × local model file → remote model × GPU → CPU delegate) in `services/poseLandmarker.ts`, so deleting the ~38MB `public/models` + `public/wasm` binaries still works online. Analysis is offline frame-by-frame (`seekTo` + `detectForVideo` on an offscreen canvas capped at 960px width) storing compact `[x,y,z,visibility]` frames in a ref (no re-render per frame); a rAF loop then syncs the timeline slider, the skeleton overlay canvas, and the 8 joint-angle chips during playback. Settings: model (lite/full), max poses, detection confidence, assumed fps, and frame step. Exports: full JSON, landmarks CSV (33 points), angles CSV, and a composed video+skeleton PNG snapshot (`utils/poseExport.ts`). The skeleton topology constant in `utils/poseData.ts` mirrors `PoseLandmarker.POSE_CONNECTIONS` so drawing never needs the MediaPipe import. Collapsing the card keeps the video and analysis alive (CSS `hidden`, not unmount); switching tabs unmounts OverviewView and discards them.

**Exercise edit mode** (`RecordView.tsx:117-129, 172-179`):
- Entered via long-press (650ms `setTimeout` on pointerdown) or right-click (`onContextMenu`).
- In edit mode: exercise buttons become draggable (via `@dnd-kit/sortable`), show a red delete (×) badge.
- Tapping blank area outside interactive elements exits edit mode (global `pointerdown` listener).
- Native `<dialog>` element used for delete confirmation modal.

**Service Worker** (`public/sw.js`): Cache name `fitlog-pwa-v3`, scoped via a computed `BASE` path. Network-first for navigation requests (with cache fallback), cache-first for all other GET requests. Pre-caches `BASE`, `index.html`, `manifest.webmanifest`, `icons/icon-180.png`, `icons/icon-512.png` on install. Skips all dev-server requests (localhost, `/@vite/`, `/src/`, etc.). Clears old caches on activate. `main.tsx` registers it **only in production**; in dev it unregisters any matching SW and clears `fitlog-pwa-*` caches.

**Vite config** (`vite.config.ts`): Base path is `/training_pwa/`. `__APP_VERSION__` is defined from `package.json` version, displayed in the header.

## iOS Safari design rules

This PWA targets iPhone standalone mode. All UI changes must respect:

- **Touch targets** — minimum 44×44px. Buttons, tappable icons, and interactive elements must be at least `h-11 w-11` (Tailwind). Never use smaller than `h-9 w-9`.
- **Input font size** — never set `text-base` (16px) or smaller on `<input>`, `<select>`, `<textarea>`. iOS Safari zooms the viewport when focusing inputs with font-size < 16px, which breaks the 430px fixed-width layout. All form inputs already use `text-base`.
- **Safe areas** — use `.safe-top` / `.safe-bottom` for any fixed or sticky element at the top/bottom edge. These include `env(safe-area-inset-*)` padding (see `styles.css`). The bottom nav already uses `safe-bottom`.
- **No hover states** — interaction styles must use active/disabled states, not `:hover`. Use `bg-coral`/`bg-ocean` for active, `bg-slate-300` or `bg-ink/15` for disabled. Icons and colors should respond to tap, not hover.
- **Overscroll** — the container is a 430px max-width phone frame centered on desktop. Avoid `overflow: scroll` on the root; scrolling lives inside `<main>`.
- **Type="date" inputs** — always include `min-w-0` and use the `.date-input` CSS class to prevent iOS native picker overflow. The `.date-input` class sets `-webkit-appearance: none` and custom styling for the datetime picker indicator.
- **Position fixed** — bottom nav uses `fixed`. Be aware that iOS virtual keyboard can push fixed elements up; avoid placing critical controls that would be hidden behind the keyboard.
- **Web API availability** — `crypto.randomUUID()` is unavailable in HTTP (non-secure) contexts. Always provide a `Math.random()` fallback (see `utils/id.ts`). IndexedDB and localStorage are available in both HTTP and HTTPS.
- **No auto-push** — do not push to GitHub after each change. Only push when the user explicitly asks.
- **Theme colors** — always use semantic Tailwind tokens (`bg-ocean`, `text-coral`, `bg-mist`, `text-ink`, `border-line`, `bg-glass`, `bg-surface`, `bg-glass-heavy`, `bg-citrus`, `shadow-glass`, `shadow-lift`) rather than hardcoded hex values, so elements respond to the theme toggle. Use `bg-citrus` for photo/contrast accents. Prefer the alpha-modifier tokens (`ocean`/`coral`/`ink`) when you need opacity variants like `bg-ocean/10` or `text-ink/50`.
