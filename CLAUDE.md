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

**State & persistence model:** `App.tsx:30-45` holds all state in `useState` with lazy initializers from localStorage/IndexedDB. Every state change syncs back to storage via `useEffect`. There is no router, no context, and no state library — all state and callbacks are passed as props.

**Three tabs**, toggled via bottom nav (`App.tsx:335-339`):
- **Record** (`views/RecordView.tsx`) — Draft workout form with body-part selector, exercise grid (preset + custom), set timer (start/finish), weight/reps inputs, calorie/notes fields. Completed workouts display in `WorkoutList`. Long-press on an exercise enters edit mode with drag-to-reorder (`@dnd-kit`) and delete buttons.
- **Calendar** (`views/CalendarView.tsx`) — Week or month grid view. Dot indicators show workout/photo presence per day. Period totals (sets, kcal) at top. Read-only workout list for the selected date.
- **Photos** (`views/PhotoView.tsx`) — Per-date photo upload (base64 via FileReader, stored in IndexedDB) with a 2-column grid and delete buttons.

**Data layer:**
- `storage/workoutStorage.ts` — Workouts persisted to `localStorage` under `fitlog.workouts`. Includes a `normalizeWorkout` migration that handles both the current multi-exercise format and a legacy single-exercise format (with `bodyPart`/`exercise`/`sets` at the workout level).
- `storage/customExerciseStorage.ts` — Custom exercises, hidden presets, and per-body-part exercise ordering, each in separate localStorage keys.
- `storage/photoStorage.ts` — Photos stored in IndexedDB (`fitlog.photos` database, `photos` object store, keyed by `id` with a `date` index).

**Key types** (`types.ts`): `Workout` → `WorkoutExercise[]` → `WorkoutSet[]`. `BodyPart` is a union of 8 Chinese strings. `DayPhoto` holds a base64 `dataUrl`.

**Exercise system** (`data/exercises.ts`): 8 body parts, each with 6-7 preset exercises. Users can add custom exercises per body part, hide preset exercises, and reorder the combined list. The visible exercise list per body part = `presets.filter(not hidden).concat(custom)`, ordered by saved `exerciseOrder`.

**Service Worker** (`public/sw.js`): Cache-first strategy for static assets. Caches `/`, `/index.html`, `/manifest.webmanifest`, `/icons/icon.svg` on install. Clears old caches on activate.

## iOS Safari design rules

This PWA targets iPhone standalone mode. All UI changes must respect:

- **Touch targets** — minimum 44×44px. Buttons, tappable icons, and interactive elements must be at least `h-11 w-11` (Tailwind). Never use smaller than `h-9 w-9`.
- **Input font size** — never set `text-base` (16px) or smaller on `<input>`, `<select>`, `<textarea>`. iOS Safari zooms the viewport when focusing inputs with font-size < 16px, which breaks the 430px fixed-width layout. All form inputs already use `text-base`.
- **Safe areas** — use `.safe-top` / `.safe-bottom` for any fixed or sticky element at the top/bottom edge. These include `env(safe-area-inset-*)` padding (see `styles.css`). The bottom nav already uses `safe-bottom`.
- **No hover states** — interaction styles must use active/disabled states, not `:hover`. Use `bg-coral`/`bg-ocean` for active, `bg-slate-300` for disabled. Icons and colors should respond to tap, not hover.
- **Overscroll** — the container is a 430px max-width phone frame centered on desktop. Avoid `overflow: scroll` on the root; scrolling lives inside `<main>`.
- **Type="date" inputs** — always include `min-w-0` to prevent iOS native picker overflow.
- **Position fixed** — bottom nav uses `fixed`. Be aware that iOS virtual keyboard can push fixed elements up; avoid placing critical controls that would be hidden behind the keyboard.
- **Web API availability** — `crypto.randomUUID()` is unavailable in HTTP (non-secure) contexts. Always provide a `Math.random()` fallback. IndexedDB and localStorage are available in both HTTP and HTTPS.
- **No auto-push** — do not push to GitHub after each change. Only push when the user explicitly asks.
