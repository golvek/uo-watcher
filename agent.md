# UO Watcher

Chrome extension (Manifest V3) that overlays a draggable countdown timer on internal review tools.

## Target

- **URL match**: `https://review.intern.facebook.com/intern/review/*`
- **Content script injection**: on page load, guarded by `window.hasInjectedCountdownTimer` to prevent duplicates

## Files

| File | Role |
|---|---|
| `manifest.json` | Extension manifest (permissions, content scripts, popup, icons) |
| `content.js` | Main timer logic injected into review pages |
| `popup.html` | Popup UI (tabs: Tracker, Settings) |
| `popup.js` | Popup event handlers and sync storage binding |
| `styles.css` | Timer overlay styles (dark theme, draggable, CSS custom property for scaling) |
| `icon.png` | Extension icon (128x128, magnifying glass + clock) |
| `tutorial.html` | How-to guide (English) with link to PT-BR version |
| `tutorial-pt.html` | How-to guide (Brazilian Portuguese) with link to EN version |

## Architecture

### State (persisted via `localStorage`)

| Key | Type | Default | Description |
|---|---|---|---|
| `ext_time_left` | int | `211` | Seconds remaining on current timer |
| `ext_is_paused` | bool | `false` | Whether timer is paused |
| `ext_current_id` | string\|null | `null` | Current task ID (from `div._8m9f` text content) |
| `ext_task_count` | int | `0` | Number of tasks completed |
| `ext_time_bank` | int | `0` | Accumulated leftover seconds from completed tasks |
| `ext_total_work_seconds` | int | `0` | Total seconds spent on completed tasks only |
| `ext_timer_duration` | int | `211` | Custom timer duration set by user |
| `ext_timer_x` | int | - | Saved overlay X position (pixels, from left) |
| `ext_timer_y` | int | - | Saved overlay Y position (pixels, from top) |
| `ext_daily_reset_hour` | int | `0` | Hour (0-23) at which daily reset triggers |
| `ext_last_reset_date` | string\|null | `null` | Date string of last reset to prevent re-triggering |

### Runtime state (not persisted)

| Variable | Type | Default | Description |
|---|---|---|---|
| `timeSpentThisTask` | int | `0` | Seconds spent on current task; added to total on Submit |
| `timerDuration` | int | `INITIAL_TIME` | Current timer duration (from localStorage or sync) |
| `dailyResetHour` | int | `0` | Hour for daily reset (from localStorage or sync) |
| `lastResetDate` | string\|null | `null` | Last reset date to prevent double resets |
| `showTotal` | bool | `true` | Show Total section in overlay |
| `showTasks` | bool | `true` | Show Tasks section in overlay |
| `showBank` | bool | `true` | Show Bank section in overlay |
| `hideLabels` | bool | `false` | Hide section labels for a cleaner look |
| `colorblindMode` | bool | `false` | Use colorblind-safe palette |

### Settings (persisted via `chrome.storage.sync`)

| Key | Type | Default | Description |
|---|---|---|---|
| `overlaySize` | int | `100` | Scale percentage (50-250) |
| `timerDuration` | int | `211` | Timer countdown in seconds (10-3600) |
| `dailyResetHour` | int | `0` | Hour (0-23) for daily tasks/total/bank reset |
| `showTotal` | bool | `true` | Toggle Total section visibility |
| `showTasks` | bool | `true` | Toggle Tasks section visibility |
| `showBank` | bool | `true` | Toggle Bank section visibility |
| `hideLabels` | bool | `false` | Hide widget labels (only values shown) |
| `colorblindMode` | bool | `false` | Switch to colorblind-safe palette |

### Overlay UI (`#custom-countdown-timer`)

Compact dark overlay with labels on top, values below. No dividers between sections. Flat `#1a1a1e` background, no border, no shadow.

| Section | Default Color | Colorblind Color | Content |
|---|---|---|---|
| Total | `#FFB74D` (orange) | same | Formatted total work time (`Xh Ym` or `Ym`) |
| Tasks | `#81C784` (green) | `#4FC3F7` (cyan) | Task count |
| Bank | `#64B5F6` (blue) | `#CE93D8` (purple) | Time bank in seconds |
| Timer | `#d4d4d8` / `#e8a87c` (<=10s) / `#e05555` (<=0) | white / `#FFF176` (<=10s) / `#FF5252` (<=0) | Countdown or "PAUSED" label |

- Labels are always white (`#ffffff`), values carry semantic colors
- Timer section always visible. Total, Tasks, Bank toggled via `showTotal`, `showTasks`, `showBank`
- Labels hidden via `hideLabels`
- Paused state dims to `opacity: 0.5`
- Hover/active maintain `#1a1a1e` background (forced via `!important`)
- Font sizes: 10px labels, 14px values
- Padding: `2px 10px`, gap: `10px`

### Interaction

- **Left click**: Toggle pause/resume
- **Drag**: Move overlay (position persisted)
- **Drag threshold**: 3px before drag engages (to distinguish from click)

### Scaling

The overlay uses a CSS custom property `--overlay-scale` (default `1`). `content.js` reads `overlaySize` from `chrome.storage.sync` and sets `--overlay-scale` to `size/100`. The CSS applies `transform: scale(var(--overlay-scale))` with `transform-origin: top left`.

## Timer Behavior

**Every 1s interval** (`setInterval`):

1. Check daily reset: if `lastResetDate !== today` and `currentHour >= dailyResetHour`, zero tasks/total/bank and reset timer
2. Check if current page shows a task (`div._8m9f` with non-empty text)
3. If no task: add `.paused` class, do nothing
4. If in a task and not paused:
   - Increment `timeSpentThisTask`
   - Decrement `timeLeft` (if > 0)
   - If `timeLeft === 0`: decrement `timeBank` (if > 0), else decrement `timeLeft` further (negative = overtime)
5. Update display

**Daily reset** (checked every tick, before task check):

- Runs when `lastResetDate !== today` AND `currentHour >= dailyResetHour`
- Zeroes `taskCount`, `totalWorkSeconds`, `timeBank`, `timeSpentThisTask`
- Saves `lastResetDate = today`
- Calls `resetTimer()`

**Task detection** (separate 1s interval):

- Monitors `div._8m9f` text content
- When ID changes (non-null to new non-null):
  1. Save new `currentId`
  2. Reset timer to `timerDuration`

**Task completion** (capture-phase click listener on `document`):

- Listens for clicks on `div.x6ikm8r.x10wlt62.x2b8uid.xlyipyv.xuxw1ft` with text "Submit"
- Falls back to reading `currentId` from `div._8m9f` if not set
- On click:
  1. Add current `timeLeft` (positive or negative) to `timeBank`
  2. Increment `taskCount`
  3. Add `timeSpentThisTask` to `totalWorkSeconds` (actual seconds spent, not `timerDuration`)
  4. Reset `timeSpentThisTask = 0`

**Homepage reset** (History API hooks + `popstate`):

- When URL does not contain "queue" (homepage), calls `resetTimer()`
- Also checked on initial script load

**Initialization**:

- On script load, checks `div._8m9f` immediately
- If task ID matches stored ID: just sync (no reset)
- If task ID differs from stored ID: saves new ID + resets timer
- If homepage (no "queue" in URL): resets timer immediately

## Popup Communication

Popup caches the last received stats in `chrome.storage.local` (key: `cachedStats`) so values persist when the content script is unreachable (wrong tab, popup reopened, etc.). On load, popup restores cached values immediately, then polls the active tab's content script every 1s for live updates.

Popup sends messages to the active tab's content script:

| Action | Effect |
|---|---|
| `reset_all` | Zeroes taskCount, totalWorkSeconds, timeBank, timeSpentThisTask; resets timer to timerDuration; unpauses |
| `reset_timer` | Resets timer to timerDuration without touching stats |
| `add_tasks` | Adds `count` to taskCount, adds `timerDuration * count` to totalWorkSeconds |
| `get_stats` | Returns `{ taskCount, totalWorkSeconds }` for popup display |

Storage changes are listened for via `chrome.storage.onChanged` in content.js:
- `overlaySize`: updates `--overlay-scale` CSS variable
- `timerDuration`: updates `timerDuration` and calls `resetTimer()`
- `dailyResetHour`: updates `dailyResetHour` and saves to localStorage
- `showTotal`, `showTasks`, `showBank`, `hideLabels`, `colorblindMode`: update display

## Popup UI

**Tracker tab:**
- Stats box: tasks count and total work time with seconds (`Xh Ym Zs` / `Ym Zs` / `Zs`)
- "How to Use" button: opens `tutorial.html` in a new tab
- Ko-fi support button

**Settings tab** (2 collapsible sections, flat dark theme, system font):

1. **Widget Visibility**: Scale slider, toggles for Total/Tasks/Bank sections, Hide labels, Colorblind mode
2. **Timer & Tasks**: Duration input with default button, daily reset hour, collapsible "Manual Entry" sub-section with Add/Remove tasks input and red "Reset All" button (double confirmation)

All section headers have help tooltips (`?` icon). Checkboxes use a simple checkmark style.

## Tutorial Pages

Two pages that cross-link to each other:
- `tutorial.html` (English) - "How to Use the Timer"
- `tutorial-pt.html` (Brazilian Portuguese) - "Como Usar o Timer"

Content: widget preview matching actual extension style, color explanations, step-by-step how it works. Includes italic note under Total about seconds appearing in popup.

## Edge Cases

- **No task on page**: Timer pauses visually, countdown does not decrement
- **Overtime**: `timeLeft` goes negative, displayed in red
- **Missing sound file**: Removed; alert sound feature has been removed
- **Multiple injections**: Guarded by `window.hasInjectedCountdownTimer`
- **First-ever task**: No time bank accumulation (currentId starts as null); Submit click reads ID from DOM if currentId is null
- **Overlay off-screen**: Dragging clamped to viewport bounds
- **Bank accumulates negative**: If task goes overtime, bank decreases
- **Daily reset while paused**: Runs regardless of pause state (checked before task/pause check)
- **Colorblind mode**: Switches green to cyan, amber to bright yellow, blue to purple; red stays distinct
