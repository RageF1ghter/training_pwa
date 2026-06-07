# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm run dev      # Start dev server on 0.0.0.0
npm run build    # TypeScript check (tsc -b) then Vite production build
npm run preview  # Preview production build on 0.0.0.0
```

## Architecture

FitLog is a workout-tracking PWA (React 18 + TypeScript + Vite + Tailwind CSS 3). The UI is Chinese-language and optimized for iPhone standalone mode (safe-area padding, portrait lock, 430px max-width container).

**State & persistence model:** `App.tsx:29-54` holds all state in `useState` with lazy initializers from localStorage/IndexedDB. Every state change syncs back to storage via `useEffect`. There is no router, no context, and no state library — all state and callbacks are passed as props. The `__APP_VERSION__` global is injected at build time by Vite's `define` from `package.json` version.

**Theme system:** Dark (default) and light themes via CSS custom properties on `:root` and `html.light` in `styles.css`. The toggle button in the header persists preference to `localStorage` under `fitlog.theme`. Theme-aware colors use Tailwind tokens (`bg-ocean`, `text-coral`, `bg-mist`, `text-ink`, `border-line`, `bg-glass`) rather than hardcoded hex values. The `glass` and `glass-strong` utility classes provide backdrop-blur surfaces.

**Three tabs**, toggled via bottom nav (`App.tsx:405-409`):
- **Record** (`views/RecordView.tsx`) — Draft workout form with body-part selector, exercise grid (preset + custom), set timer (start/finish), weight/reps dropdown selectors, calorie/notes fields. Completed workouts display in `WorkoutList`. Long-press (650ms) or right-click on an exercise enters edit mode with drag-to-reorder (`@dnd-kit`) and delete buttons. The set timer has a companion rest timer: after adding a set, the UI switches to "休息中" (resting) mode with its own elapsed counter and "开始下一组" (start next set) button.
- **Calendar** (`views/CalendarView.tsx`) — Week or month grid view. Dot indicators show workout (coral) and photo (ocean) presence per day. Period totals (sets, kcal) at top. Below the grid: exercise donut chart (custom SVG). Click a pie slice to reveal an ECharts stacked line chart with weight/reps/duration/rest-gap for each set. Read-only workout list for the selected date.
- **Photos** (`views/PhotoView.tsx`) — Per-date photo upload (base64 via FileReader, stored in IndexedDB) with a 2-column grid and delete buttons. Shows workout body-part tags for the selected date above the photo grid.

**Project structure:**
```
src/
  App.tsx                          # Root — all state, persistence effects, callbacks
  types.ts                         # All shared TypeScript types
  styles.css                       # Tailwind + CSS custom properties + glass utilities
  data/exercises.ts                # 8 body parts, preset exercises
  factories/workout.ts             # createBlankWorkout() factory
  utils/
    id.ts                          # makeId() — crypto.randomUUID with Math.random fallback
    date.ts                        # Date key formatting, week/month math, weekday labels
    workouts.ts                    # Aggregation helpers (sumSets, sumCalories, formatDuration, groupByDate)
  storage/
    workoutStorage.ts              # localStorage read/write + legacy migration (normalizeWorkout)
    customExerciseStorage.ts       # Custom/hidden exercise CRUD + ordering persistence
    photoStorage.ts                # IndexedDB CRUD for photos + fileToDataUrl helper
  components/
    TabButton.tsx                  # Bottom nav tab button
    Stat.tsx                       # Stat display tile (label + value)
    WorkoutList.tsx                # Read-only (or delete-capable) list of saved workouts
    ExercisePieChart.tsx           # Custom SVG donut chart — exercise reps distribution
    ExerciseLineChart.tsx          # ECharts stacked line chart — per-set detail when pie slice clicked
  views/
    RecordView.tsx                 # Draft workout builder + exercise management
    CalendarView.tsx               # Week/month calendar with date selection
    PhotoView.tsx                  # Photo upload, gallery, and workout tags
public/
  sw.js                            # Service Worker (network-first nav, cache-first static)
  manifest.webmanifest             # PWA manifest (standalone, portrait, dark theme)
  icons/                           # App icons (180px, 512px PNG + SVG)
```

**Data layer:**
- `storage/workoutStorage.ts` — Workouts persisted to `localStorage` under `fitlog.workouts`. Includes a `normalizeWorkout` migration that handles both the current multi-exercise format and a legacy single-exercise format (with `bodyPart`/`exercise`/`sets` at the workout level).
- `storage/customExerciseStorage.ts` — Custom exercises (`fitlog.customExercises`), hidden presets (`fitlog.hiddenExercises`), and per-body-part exercise ordering (`fitlog.exerciseOrder`), each in separate localStorage keys. All readers include normalization (dedup, trim, filter invalid entries).
- `storage/photoStorage.ts` — Photos stored in IndexedDB (`fitlog.photos` database, `photos` object store, keyed by `id` with a `date` index). Uses a `withPhotoStore` helper that wraps IndexedDB transactions in promises.

**Chart utilities** (`utils/workouts.ts`):
- `aggregateExerciseReps(workouts)` — Groups exercises by name, sums total reps, returns sorted `ExerciseRepsAgg[]` for the pie chart.
- `getExerciseSetsWithDetails(workouts, exerciseName)` — Returns all sets for an exercise enriched with `computedDuration` (from timestamps) and `restGapSeconds` (current.startedAt - prev.finishedAt), grouped by workout date. Feeds the line chart detail panel.
- `formatRestGap(seconds)` — Human-readable rest gap ("2m30s" or "---" for null).

**Key types** (`types.ts`): `Workout` → `WorkoutExercise[]` → `WorkoutSet[]`. `WorkoutSet` has optional `startedAt?: number` and `finishedAt?: number` (Unix ms timestamps) for computing rest gaps. `Workout` has optional `startedAt?: number`. `BodyPart` is a union of 8 Chinese strings. `DayPhoto` holds a base64 `dataUrl`. `CalendarMode` = `"week" | "month"`. `Tab` = `"record" | "calendar" | "photos"`. Support maps: `CustomExerciseMap`, `HiddenExerciseMap`, `ExerciseOrderMap` are all `Record<BodyPart, string[]>`.

**Exercise system** (`data/exercises.ts`): 8 body parts, each with 6-7 preset exercises. Users can add custom exercises per body part, hide preset exercises, and reorder the combined list via long-press drag-and-drop. The visible exercise list per body part = `presets.filter(not hidden).concat(custom)`, ordered by saved `exerciseOrder`. Deleting a preset exercise hides it; deleting a custom exercise removes it permanently.

**Set timer & rest timer flow** (`App.tsx:86-104`):
1. User taps "开始" → `startSetTimer()` sets `timerStartedAt = Date.now()`, interval ticks `elapsedSeconds`.
2. User taps "完成" → `finishSetTimer()` finalizes duration, stops the timer.
3. User taps "添加本组" → `addSetToDraftWorkout()` adds the set, then auto-starts rest: `setIsResting(true)`, `setRestStartedAt(Date.now())`.
4. During rest, weight/reps selectors remain visible, and "开始下一组" re-enters the active set timer.

**Exercise edit mode** (`RecordView.tsx:94-104, 172-201`):
- Entered via long-press (650ms `setTimeout` on pointerdown) or right-click (`onContextMenu`).
- In edit mode: exercise buttons become draggable (via `@dnd-kit/sortable`), show a red delete (×) badge.
- Tapping blank area outside interactive elements exits edit mode (global `pointerdown` listener).
- Native `<dialog>` element used for delete confirmation modal.

**Service Worker** (`public/sw.js`): Network-first for navigation requests (with cache fallback), cache-first for all other GET requests. Caches `/`, `/index.html`, `/manifest.webmanifest`, `/icons/icon.svg` on install. Clears old caches on activate.

**Vite config** (`vite.config.ts`): Base path is `/training_pwa/`. `__APP_VERSION__` is defined from `package.json` version, displayed in the header.

## iOS Safari design rules

This PWA targets iPhone standalone mode. All UI changes must respect:

- **Touch targets** — minimum 44×44px. Buttons, tappable icons, and interactive elements must be at least `h-11 w-11` (Tailwind). Never use smaller than `h-9 w-9`.
- **Input font size** — never set `text-base` (16px) or smaller on `<input>`, `<select>`, `<textarea>`. iOS Safari zooms the viewport when focusing inputs with font-size < 16px, which breaks the 430px fixed-width layout. All form inputs already use `text-base`.
- **Safe areas** — use `.safe-top` / `.safe-bottom` for any fixed or sticky element at the top/bottom edge. These include `env(safe-area-inset-*)` padding (see `styles.css`). The bottom nav already uses `safe-bottom`.
- **No hover states** — interaction styles must use active/disabled states, not `:hover`. Use `bg-coral`/`bg-ocean` for active, `bg-slate-300` for disabled. Icons and colors should respond to tap, not hover.
- **Overscroll** — the container is a 430px max-width phone frame centered on desktop. Avoid `overflow: scroll` on the root; scrolling lives inside `<main>`.
- **Type="date" inputs** — always include `min-w-0` and use the `.date-input` CSS class to prevent iOS native picker overflow. The `.date-input` class sets `-webkit-appearance: none` and custom styling for the datetime picker indicator.
- **Position fixed** — bottom nav uses `fixed`. Be aware that iOS virtual keyboard can push fixed elements up; avoid placing critical controls that would be hidden behind the keyboard.
- **Web API availability** — `crypto.randomUUID()` is unavailable in HTTP (non-secure) contexts. Always provide a `Math.random()` fallback (see `utils/id.ts`). IndexedDB and localStorage are available in both HTTP and HTTPS.
- **No auto-push** — do not push to GitHub after each change. Only push when the user explicitly asks.
- **Theme colors** — always use semantic Tailwind tokens (`bg-ocean`, `text-coral`, `bg-mist`, `text-ink`, `border-line`, `bg-glass`, `bg-surface`) rather than hardcoded hex values, so elements respond to the theme toggle. Use `bg-citrus` for photo-related accents.
