# open-todoist — full product description

Long-form, machine-readable description for LLM retrieval. The concise map is in
[llms.txt](llms.txt); human-facing detail is in [README.md](README.md).

---

## 1. Summary

open-todoist is a browser-based task manager that runs entirely on the user's
own device. It is an MIT-licensed open source alternative to Todoist, built
around natural-language task entry and a keyboard-first workflow. It requires
no account, contacts no server, and functions with no network connection.

Identity: independent, unofficial clean-room reimplementation. Not affiliated
with, endorsed by, or connected to Doist. Contains no Doist code, assets, or
brand material.

---

## 2. Core capability: natural-language quick add

The defining feature. A single line of text is parsed into a structured task.

### Supported date tokens (English)

- `today`, `tonight` (sets 20:00), `tomorrow`, `tmrw`
- `next week` (Monday of next week), `next month` (1st), `next year` (Jan 1)
- `next monday` and other `next <weekday>` forms
- Bare weekdays: `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`, plus full names
- Absolute: `jan 5`, `5 jan`, `oct 21st`, `2026-10-20`, `11/03`
- Relative offsets: `3d`, `2w`, `10m`, `1y`
- Phrases: `in 2 weeks`, `in a week`, `in three days`, `in 2 months`

### Supported time tokens

`at 14:00`, `at 9am`, `9am`, `7:30pm`, `at 7`, `noon`, `midnight`

### Supported recurrence tokens

`every day`, `every weekday`, `every weekend`, `every monday`,
`every mon,wed,fri`, `every 2 weeks`, `every other week`, `every 3 months`,
`daily`, `weekly`, `biweekly`, `fortnightly`, `monthly`, `yearly`, `annually`

### Supported Chinese tokens

- Dates: `今天` `今晚` `明天` `明日` `后天` `大后天` `周三` `下周三` `下周` `下个月` `明年` `三天后`
- Times: `下午3点半` `下午三点半` `晚上8点` (both ASCII and Chinese numerals)
- Recurrence: `每天` `每周` `每月` `每年` `每周五` `每个工作日` `每两天`

### Priority, project, label

- `p1` (urgent) through `p4` (no priority); `p5`–`p9` are not priorities
- `#Project` or `#项目名` — creates the project if it does not exist
- `@label` — repeatable, de-duplicated

### Combination and preview

Tokens combine freely in one line. The parse result is rendered as live chips
underneath the input box on every keystroke, before the user commits, showing
the resolved date, recurrence, priority, project and labels, plus the cleaned
title.

Example: `Draft release notes #Work @docs every monday at 9am p1` produces title
`Draft release notes`, due Monday 09:00, recurrence every Monday, priority 1,
project Work, label docs.

### Deliberate refusals

The parser declines ambiguous input rather than guessing:

- Bare `may` is not treated as a month (it is a common English word)
- `mar` is not treated as a weekday (ambiguous with March)
- A bare clock time with no date and no recurrence stays in the title
- `morning`, `evening`, `night` are not treated as times (too common in titles)
- Month names require an accompanying day number (`jan 5`, never bare `jan`)

Rationale: a leftover word is a visible, fixable mistake; a silently wrong due
date is invisible until it causes a problem. When input consists only of tokens,
the entire line is preserved as the title.

### Resolution rules

- A time attaches to a date when both are present
- A time with only a recurrence attaches to that recurrence's first fire date
- Multiple dates, recurrences, priorities or projects: the first wins, and a
  warning is shown

---

## 3. Task model

Each task carries: `id`, `title`, `description`, `projectId` (null = Inbox),
`labels[]`, `priority` (1–4), `due` (optional date plus optional time),
`recurrence`, `createdAt`, `completedAt`, `order`, `isDeleted`, `deletedAt`.

Deletion is always soft. Trashed tasks are recoverable and can be permanently
purged from the Trash view.

### Recurrence semantics

A repeat is structured data (`daily`, `weekdays`, `weekly` with optional
pinned weekdays, `monthly`, `yearly`, each with an interval), not a string.

- The next occurrence is always **strictly after** the base date, so completing
  a daily task schedules tomorrow rather than looping on today
- Completing a recurring task **rolls it forward**: the due date advances to the
  next fire date, preserving the clock time, and the task stays open
- Recurring tasks are projected onto the days they fire, so a weekday repeat
  appears in Today on weekdays and not at weekends
- Month arithmetic clamps (31 January plus one month = 28 or 29 February)

### Date handling

A due date is stored as a calendar day (`YYYY-MM-DD`) in the user's local
timezone, never as an epoch instant. This is deliberate: instant-based storage
shifts the day for users whose local date differs from UTC. DST behaviour and
leap-year clamping are covered by tests.

---

## 4. Views

Inbox, Today, Upcoming, per-project views, per-label views, Completed, Trash.

- **Today** shows open tasks due today or earlier
- **Upcoming** shows open tasks due in the future
- Sorting: manual order, due date, priority, A–Z, created date; ascending or
  descending
- Filtering: by project, by label, by priority; multiple filter kinds combine
  with AND, multiple labels combine with OR
- When sorting by due date, results group into Overdue / Today / Tomorrow /
  Later / No date

---

## 5. Projects

Create, rename, reorder and delete. Deleting a project is non-destructive: its
tasks move to the Inbox rather than disappearing. Project creation is implicit —
typing `#NewProject` in quick add creates it if absent.

---

## 6. Keyboard model

Global: `⌘K`/`Ctrl-K` command palette; `N`, `Q` or `/` to focus quick add;
`T` Today; `U` Upcoming; `I` Inbox; `C` Completed; `S` toggle statistics.

Task row (when focused): `Space` or `X` complete/reopen; `E` edit title inline;
`1`–`4` set priority; `Delete` trash (or restore inside Trash); `↑`/`↓` reorder.

Shortcuts are suppressed while typing in a field. Every mouse action has an
equivalent command palette entry.

---

## 7. Statistics

Computed on demand from the in-memory task list, rendered as hand-written SVG
with no charting library:

- Tasks completed today, due today
- Current completion streak in days, and longest historical streak
- A 28-day completion sparkline
- Completions distributed by project and by label

Streak rule: a run ending today counts; a run ending yesterday still counts
(today is not over); a gap at yesterday breaks it.

---

## 8. Data and privacy

- Storage: IndexedDB database `open-todoist`, object stores `tasks`,
  `projects`, `settings`
- If IndexedDB is unavailable, the app falls back to localStorage automatically,
  and a failed transaction degrades to the fallback rather than throwing
- Writes are debounced (250 ms) and write the full snapshot, which keeps on-disk
  state consistent with no partial-update path
- No sync. No accounts. No network requests after page load
- No telemetry, analytics or error reporting of any kind

### Data portability

- **JSON export**: a versioned, pretty-printed document containing `app`,
  `schemaVersion`, `exportedAt`, `projects` and `tasks`
- **JSON import**: validates structure, coerces malformed fields (invalid
  priority falls back to 4, malformed due dates are dropped, labels may be given
  as a comma-separated string), and reconstructs projects that tasks reference
  but the file omits, reporting what it did
- **CSV export**: 12 columns (id, title, description, project, labels,
  priority, due_date, due_time, recurrence, status, created_at, completed_at)
  with RFC-4180 quoting for commas, quotes and newlines

---

## 9. Architecture

React 18 + TypeScript + Vite, built with Vitest. The domain layer in `src/lib`
is pure TypeScript that never imports React, which is why all tests run in Node
without a DOM shim.

Layers: `components → store (reducer) → lib → IndexedDB`.

Source sizes: ~3,700 lines of TypeScript (excluding tests), 415 lines of CSS,
1,073 lines of tests, 165 tests in 5 suites.

Runtime dependencies: `react` and `react-dom`. No ORM, no UI framework, no
charting library, no date library, no state-management library.

---

## 10. Limitations

Stated plainly, because a task manager that overstates itself is not useful:

- **No mobile app.** The web app is responsive and installable to the home
  screen, but there is no native app and no push notifications
- **No reminders.** Due dates are passive
- **No cross-device sync.** Tasks live in one browser profile; clearing site
  data deletes them. Use the JSON export
- **No calendar, board or Gantt layouts.** List layout only
- **No comments, attachments, duration tracking, or custom fields**
- **No integrations, no templates, no shared or team features**
- **No saved custom filters or custom views**

Compared with Todoist (Doist), this project is narrower in every dimension except
privacy and self-hosting, where it is categorically stronger.

---

## 11. Verification

```bash
npm install
npm run build    # tsc --noEmit && vite build — no TypeScript errors
npm test         # 165 tests across 5 suites
```

Test coverage: natural-language parsing (73, including refusal cases and
Chinese), recurrence and date arithmetic (28, including DST and leap years),
view selection / filtering / sorting (28), JSON and CSV round-trips (20),
streak and aggregation logic (16). The clock is injected everywhere, so all
expectations are anchored to a fixed reference date rather than the wall clock.

---

## 12. License and provenance

MIT licensed. Clean-room: no proprietary source code, markup, copy, imagery,
font, theme or brand asset from the target was obtained or used. Reverse
engineering was limited to observations of the target's public web surface;
see [docs/REVERSE_ENGINEERING.md](docs/REVERSE_ENGINEERING.md).

"Todoist" is a trademark of Doist. This project is independent and unaffiliated.
