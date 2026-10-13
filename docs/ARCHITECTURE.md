# Architecture

open-todoist is a single-page React application with no backend. Everything —
parsing, storage, statistics — runs in the browser tab you already have open.

## 1. Design constraints

Four constraints drove every decision:

1. **Local-first, literally.** No network calls exist in the shipped code. Data
   lives in IndexedDB. There is no API client because there is no API.
2. **No large dependencies.** The entire runtime dependency list is `react` and
   `react-dom`. Persistence is a hand-written IndexedDB wrapper, styling is
   plain CSS, and charts are hand-rolled SVG.
3. **Timezones are a correctness problem, not a detail.** A task due "today" is a
   calendar day in the user's timezone. Using `toISOString()` anywhere in the date
   path would shift the day for half the world, so every conversion goes through
   local getters. See §4.
4. **No silent guesses.** The parser shows its work before the user commits.

## 2. Module map

```
src/
├── types.ts              Domain model. Plain serialisable interfaces.
├── lib/
│   ├── date.ts           Calendar arithmetic on YYYY-MM-DD strings
│   ├── nlp.ts            Quick-add tokenizer  ← the centrepiece
│   ├── recurrence.ts     Next-fire-date engine
│   ├── filter.ts         View selection, filtering, sorting
│   ├── stats.ts          Streaks and completion distributions
│   ├── factory.ts        Task/project construction, completion semantics
│   ├── db.ts             IndexedDB wrapper (+ localStorage fallback)
│   ├── io.ts             JSON import/export, CSV export, validation
│   └── id.ts             UUID generation
├── store/useStore.tsx    Reducer + write-through persistence
├── components/           Sidebar, QuickAdd, TaskList, TaskRow,
│                         CommandPalette, StatsPanel
└── test/                 5 suites, 165 tests
```

The dependency direction is strictly one-way: `components → store → lib`, and
`lib` modules never import React. That is what lets the whole domain layer run
under Node in the test suite with no DOM shim.

## 3. Data flow

```
       keystroke
           │
           ▼
    ┌─────────────┐
    │  parseInput │  single left-to-right scan, longest match wins
    └──────┬──────┘
           │ ParseResult
           ▼
    ┌─────────────┐   live chips render here, before any commit
    │ previewChips│
    └─────────────┘

  Enter ──▶ addFromText ──▶ createTask ──▶ reducer ──┐
                                                     │
                                       ┌─────────────▼─────────────┐
                                       │  in-memory State          │
                                       │  {tasks, projects, view…}  │
                                       └─────────────┬─────────────┘
                                                     │ debounced 250 ms
                                       ┌─────────────▼─────────────┐
                                       │  IndexedDB (2 stores)     │
                                       │  or localStorage fallback │
                                       └───────────────────────────┘
```

On boot, the store loads the entire snapshot into memory. This is a deliberate
trade: a personal task list is thousands of rows at most, so keeping it in memory
makes every view, filter and statistic a pure synchronous function. Writes are
debounced and always write the **whole** dataset, which keeps the code simple and
makes the on-disk state trivially consistent — there is no partial-update path
that could drift.

## 4. The date model

The single most consequential decision in the codebase.

A due date is stored as two fields:

```ts
interface DueDate {
  date: string;   // "2026-10-20" — a calendar day, not an instant
  time?: string;  // "14:00" — optional wall-clock time
}
```

The day is **never** an epoch timestamp. `toISOString()` is banned from the date
path, because it converts to UTC and would report "tomorrow" as "today" for every
user east of Greenwich in the evening. All arithmetic goes through
`new Date(y, m, d)` local-midnight construction, and additions use
`setDate`/`setMonth`/`setFullYear` rather than millisecond deltas, so DST
transitions cannot drift a task onto the wrong day. `src/test/recurrence.test.ts`
pins this behaviour across the 29 March 2026 US spring-forward date.

Month arithmetic clamps rather than overflows: 31 January plus one month is
28 February (29 in a leap year). Leap-day annual repeats clamp to 28 February.

## 5. The natural-language parser

This is the product. It is one left-to-right scan over the input.

At each cursor position, matchers are tried in a fixed order:

```
#project  →  @label  →  p1..p4  →  Chinese  →  repeat  →  date  →  time
```

The first matcher to hit **consumes its span** and the cursor jumps to its end.
A consumed span is recorded, and the title is then rebuilt from the spans that
were *not* consumed — so the title is derived, never guessed. This design makes
double-matching structurally impossible.

### Conservative by construction

The interesting decision is what the parser *refuses* to do.

| Input | Result | Why |
| --- | --- | --- |
| `You may want to check this` | title only | bare `may` is a month name, but also an ordinary word |
| `Fix the mar floor` | title only | `mar` is both Tuesday and March — genuinely ambiguous |
| `Read at 14:00` | title keeps `at 14:00` | a clock time with no date has nothing to attach to |
| `Morning run` | title only | `morning` is far too common a word to treat as 09:00 |

A leftover word is a visible mistake the user can fix by deleting it. A silently
mis-set due date is invisible until the day it causes a problem. When the input
is genuinely ambiguous the parser keeps the text and stays quiet.

Two exceptions attach a time safely: if a date is also present, the time joins
that date; if a repeat is present, the time joins the repeat's **first fire
date**. A repeat implies a future date, so nothing is invented.

Chinese is handled in the same scanner. Because Chinese has no word delimiters,
these tokens are unambiguous in a way the English ones are not — which is exactly
why `明天` is a hard date while the English `may` cannot be. Both `下午3点半` and
`下午三点半` parse to 15:30.

### What the parser understands

**Dates** — `today` `tonight` `tomorrow` `tmrw` `next week` `next month`
`next year` `next monday` `mon` `sunday` `jan 5` `5 jan` `oct 21st` `2026-10-20`
`11/03` `3d` `2w` `10m` `in 2 weeks` `in a week` `in three days`
**Chinese** — `今天` `今晚` `明天` `后天` `大后天` `周三` `下周三` `下周` `下个月` `三天后`
**Times** — `at 14:00` `at 9am` `9am` `7:30pm` `noon` `midnight`
**Chinese times** — `下午3点半` `下午三点半` `晚上8点`
**Repeats** — `every day` `every weekday` `every weekend` `every monday`
`every mon,wed,fri` `every 2 weeks` `every other week` `daily` `weekly`
`biweekly` `monthly` `yearly`
**Chinese repeats** — `每天` `每周` `每月` `每年` `每周五` `每个工作日` `每两天`
**Priority** — `p1` `p2` `p3` `p4`
**Project** — `#Project`, `#项目名` (creates the project if it is new)
**Labels** — `@label`

Two deliberate limits: month names are only dates when a day number accompanies
them (`jan 5`, never bare `jan`), and `p5`–`p9` are not priorities.

## 6. Recurrence

A repeat is data, not a string:

```ts
type Recurrence =
  | { freq: 'daily';   interval: number }
  | { freq: 'weekdays'; interval: 1 }
  | { freq: 'weekly';  interval: number; daysOfWeek?: number[] }
  | { freq: 'monthly'; interval: number }
  | { freq: 'yearly';  interval: number }
```

`nextOccurrence(rec, after)` always returns a date **strictly after** `after`,
so completing a daily task today schedules tomorrow instead of looping on today.
Weekly rules walk interval-sized windows forward from the week containing the
base date, anchoring weeks on Monday.

Because a recurring task occupies many days, date-driven views project it: Today
and Upcoming use `taskOccurrences()` rather than the single stored due date, so a
weekday repeat genuinely appears on each weekday.

Completing a recurring task **rolls it forward** — the due date advances to the
next fire date, preserving the clock time, and the task stays open. One-off tasks
get a `completedAt` stamp instead.

## 7. Keyboard model

| Scope | Key | Action |
| --- | --- | --- |
| Global | `⌘K` / `Ctrl-K` | command palette |
| Global | `N` or `Q` or `/` | focus quick add |
| Global | `T` `U` `I` `C` | Today / Upcoming / Inbox / Completed |
| Global | `S` | toggle statistics |
| Task row | `Space` or `X` | toggle done (recurring tasks roll forward) |
| Task row | `E` | edit title inline |
| Task row | `1`–`4` | set priority |
| Task row | `Delete` | move to trash (`Backspace` restores it there) |
| Task row | `↑` `↓` | reorder manually |

Every shortcut is suppressed while the user is typing in a field, and every
mouse action has a palette command. The palette composes over the store rather
than dispatching synthetic clicks.

## 8. Storage

`open-todoist`, version 1, three object stores: `tasks` and `projects` (keyPath
`id`, with indexes for soft-delete, project and due date) plus `settings`.

There is no migration framework. At v1 the schema is one `if` away from being
correct and the data is plain JSON, so a migration system would be scaffolding
without a problem to solve.

If IndexedDB is unavailable — private windows, hardened profiles — `db.ts` falls
back to localStorage automatically, and if a transaction fails it degrades to the
fallback rather than throwing. Losing the user's tasks because a browser quirk
blocked a write is a worse outcome than a slightly slower one.

## 9. Testing

165 tests across 5 suites, all pure Node with no DOM shim:

| Suite | Tests | Covers |
| --- | --- | --- |
| `nlp.test.ts` | 73 | the parser, including refusals and Chinese |
| `recurrence.test.ts` | 28 | next-fire dates, DST, month/leap clamping |
| `filter.test.ts` | 28 | view selection, filtering, sorting stability |
| `io.test.ts` | 20 | JSON round-trip, CSV quoting, import recovery |
| `stats.test.ts` | 16 | streak rules, aggregation, soft-delete exclusion |

The clock is injected everywhere (`{ now }`, `new Date()` parameters) so every
expectation is anchored to a fixed reference day rather than to the wall clock.

The parser tests pin the reference date to **Wednesday 14 October 2026**, which is
what makes assertions like "the coming Friday is 16 October" checkable.
