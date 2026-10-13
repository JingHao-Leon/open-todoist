# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-10-14

First public release.

### Added

- **Natural-language quick add** with live parse preview. Dates, times,
  recurrence, priority, projects and labels parsed from a single line, in
  English and Chinese. 73 tests, including explicit refusal of ambiguous input.
- **Task model** with title, description, project, labels, four priority tiers,
  due date, recurrence, timestamps, manual ordering and soft deletion.
- **Seven views**: Inbox, Today, Upcoming, project, label, Completed, Trash.
- **Sorting and filtering** — five sort keys in two directions; filtering by
  project, label and priority.
- **Project management** — create, rename, reorder, delete. Deleting a project
  returns its tasks to the Inbox instead of destroying them.
- **Keyboard-first workflow** — ⌘K command palette, quick-add hotkey, row-scoped
  shortcuts for completing, editing, prioritising, trashing and reordering.
- **Recurrence engine** — daily, weekday, weekly by pinned weekdays, monthly and
  yearly, with arbitrary intervals. Completing a repeat rolls it forward.
- **Statistics panel** — completion streak, best streak, a 28-day sparkline and
  completions by project and by label, drawn as hand-rolled SVG.
- **Data portability** — versioned JSON export and import with validation and
  repair, plus a 12-column CSV export with RFC-4180 quoting.
- **Storage** — hand-written IndexedDB wrapper with an automatic localStorage
  fallback. No ORM, no sync, no network calls.
- **Dark mode** following `prefers-color-scheme`.
- **Chinese and English** support throughout the parser.

### Not included

Deliberately out of scope for 1.0.0, and documented rather than implied:
native mobile apps, reminders and notifications, cross-device sync, calendar /
board / Gantt layouts, comments, attachments, duration tracking, and
integrations.

[1.0.0]: https://github.com/
