# Feature comparison

open-todoist versus Todoist (Doist). This document is deliberately blunt in both
directions: it lists what we did not build, and it does not pretend the original
is worse than it is. Todoist is a mature, well-funded product; we are a small
local-first application. Where it wins, it wins.

Scope note: this comparison is written from the publicly observable behaviour of
Todoist and its public documentation. See
[REVERSE_ENGINEERING.md](./REVERSE_ENGINEERING.md) for exactly what was and was
not observed — no proprietary code was obtained.

## Feature table

| Feature | open-todoist | Todoist | Notes |
| --- | --- | --- | --- |
| Natural-language quick add | ✅ 73 tests | ✅ | Our grammar is independent. Conservative by design: it refuses ambiguous tokens instead of guessing. |
| Live parse preview before commit | ✅ | ✅ | Chips render on every keystroke. |
| Repeat / recurrence | ✅ daily, weekday, weekly-by-day, monthly, yearly, intervals | ✅ | Completing a repeat rolls it forward rather than closing it. |
| Four priority tiers | ✅ `p1`–`p4` | ✅ | Same convention, independently implemented. |
| Projects | ✅ | ✅ | Deleting a project returns its tasks to Inbox instead of destroying them. |
| Labels | ✅ | ✅ | |
| Inbox / Today / Upcoming / Completed | ✅ | ✅ | |
| Project view, label view | ✅ | ✅ | |
| Trash with restore | ✅ soft delete | ✅ | |
| Manual task ordering | ✅ | ✅ | |
| Sorting and filtering | ✅ 5 sort keys, filter by project/label/priority | ✅ more | Todoist has saved custom filters and saved sorts. |
| Command palette (⌘K) | ✅ | ✅ | |
| Keyboard-first workflow | ✅ documented table | ✅ | Our row-scoped shortcuts are our own design. |
| Statistics | ✅ streak, 28-day sparkline, per-project and per-label bars | ✅ deeper | Hand-rolled SVG, no charting library. |
| JSON export / import | ✅ round-trip tested | ⚠️ | Todoist exports via its own sync API rather than a documented round-trippable file. |
| CSV export | ✅ 12 columns, RFC-4180 quoting | ⚠️ | Todoist CSV export is a Pro feature. |
| Offline | ✅ fully, no network calls at all | ⚠️ offline mode | Todoist added offline mode; ours has no server to be offline from. |
| Browser extensions | ❌ | ✅ macOS, Windows, Linux, Chrome, Firefox, Safari, Edge | **Significant gap.** |
| Mobile apps | ❌ | ✅ iOS and Android, native | **Significant gap.** The web app is responsive but is not a native app. |
| Calendar integrations | ❌ | ✅ Google Calendar, CalDAV, Outlook | **Significant gap.** |
| Email capture (forward to task) | ❌ | ✅ | |
| Assistant / AI features | ❌ | ✅ | Deliberate. We do not send your task text to any service. |
| Integrations directory | ❌ | ✅ 100+ | **Significant gap.** |
| Duration tracking | ❌ | ✅ | |
| Task comments | ❌ | ✅ | |
| File attachments | ❌ | ✅ | |
| Reminders and notifications | ❌ | ✅ push, email | **Significant gap.** We set a due date; nothing will interrupt you. |
| Team / shared projects | ❌ | ✅ | **Structural gap**, by design. |
| Comments and mentions | ❌ | ✅ | |
| Board / calendar / Gantt layouts | ❌ | ✅ board, calendar, Gantt | **Significant gap.** |
| Custom views and saved filters | ❌ | ✅ | |
| Custom item fields | ❌ | ✅ | |
| Templates | ❌ | ✅ | |
| Natural language in other languages | ✅ Chinese and English | ✅ many | |
| Dark mode | ✅ follows `prefers-color-scheme` | ✅ | |
| Keyboard shortcuts for date jump | ❌ | ✅ | |
| Cross-device sync | ❌ n/a | ✅ | **The core trade-off.** See below. |
| User accounts | ❌ n/a | ✅ | **The core trade-off.** |
| Self-hosting | ✅ it is a static bundle you already host | ✅ server option | |
| Collaboration, sharing, permissions | ❌ | ✅ | |
| Subscription tiers and billing | ❌ | ✅ Free / Pro / Business | |
| Affiliate programme | ❌ | ✅ | |

## Where open-todoist is genuinely better

Not marketing — these are the actual differences.

**There is nothing to sign up for.** There is no account, no email address, no
password, no OAuth provider, and no company with a copy of your task list. The
data is in your browser's IndexedDB and the code makes no network requests at
all.

**You can read your own data.** Export produces documented, pretty-printed JSON.
The schema is described in `docs/ARCHITECTURE.md` and the export is plain
objects. No proprietary sync API is required to get your tasks out.

**No telemetry, by construction.** There is no analytics code to inspect, and no
dependency that could phone home. The runtime dependency list is `react` and
`react-dom`.

**Import is forgiving.** A task referencing a project that is missing from the
file gets the project reconstructed as a placeholder and the situation is
reported, rather than silently dropping the task into the Inbox and losing the
grouping.

**A task due "today" means your today.** Due dates are calendar days resolved in
local time, verified by tests that pin behaviour across a DST transition. Plenty
of task managers store an instant and quietly shift the day.

## Where open-todoist is clearly worse

Todoist has been built for a decade by a full team. It is not close.

- **You cannot check your tasks on your phone.** No native app. This is the
  single biggest practical limitation, and no amount of keyboard cleverness
  compensates for it.
- **Nothing reminds you.** Due dates are passive. If you rely on Todoist's
  reminders to prompt you, there is no equivalent here.
- **No calendar, no board, no Gantt.** Only the list layout exists.
- **No sync between devices.** Your tasks live in one browser profile on one
  machine. Clearing site data deletes them — which is exactly why the JSON export
  exists, and why you should use it.
- **No integrations.** Dozens of third-party tools do not know this app exists.
- **No comments, attachments, or duration tracking**, which are genuinely
  useful for shared or long-running work.

## The honest framing

If you need reminders, a phone, a calendar, or collaboration, Todoist is the
better tool and this project is not a substitute for it.

open-todoist is for a narrower case: you want a task list that starts
instantaneously, works with no connection, contains nothing you do not intend to
put in it, costs nothing, and can never be switched off by a company or read by
an advertiser. If that trade is right for you, everything in the table above
marked ✅ is real and works today.

It is also, incidentally, a demonstration that a competent task manager is about
3,700 lines of original TypeScript — not a platform.
