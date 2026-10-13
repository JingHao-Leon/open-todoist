# FAQ

Answers to questions people actually ask about open-todoist. The same questions
appear in the [README](../README.md).

### Is this an open source Todoist alternative?

Yes. open-todoist is an independent, MIT-licensed task manager that covers the
core job — natural-language quick add, projects, labels, priorities, recurring
tasks, and multiple views — with no account and no server. It is not affiliated
with Doist and contains none of their code or assets. It is, however, narrower:
no mobile app, no reminders, no calendar or board layouts, and no sync between
devices. See [COMPARISON.md](./COMPARISON.md) for the full table.

### Does it work offline?

Completely, and not as a feature bolted on afterwards. The application makes no
network requests at all after the page loads — there is no API client in the
codebase. Data is read from and written to IndexedDB in your browser, so the app
works on a plane, on a locked-down corporate network, with no connection at all.

### Do I need an account?

No. There is no sign-up, no login, no email address and no password. There is no
server that could hold your account because there is no server. The cost is the
one described under syncing below.

### Where is my data stored, and can anyone else see it?

In your browser's IndexedDB, on your machine. It never leaves the device. There
is no analytics, no telemetry, no crash reporting, and no third-party script. The
runtime dependency list is `react` and `react-dom` — you can verify that in
`package.json` — so there is no analytics SDK hiding in a transitive dependency
either.

### Will my tasks sync between my phone and my laptop?

No. Your tasks live in one browser profile on one machine. This is the main
trade-off of a local-first app and we want to state it plainly rather than bury
it. Clearing your browser data for this site will delete your tasks.

Because of that, export regularly: **JSON** in the status bar writes a complete,
pretty-printed backup, and **JSON** re-imports it. Treat the export as the sync
you do have.

### What natural language does the quick add understand?

Dates (`today`, `tomorrow`, `tonight`, `next monday`, `mon`, `jan 5`, `2026-10-20`,
`3d`, `in 2 weeks`), times (`at 14:00`, `9am`, `7:30pm`), repeats (`every day`,
`every weekday`, `every monday`, `every 2 weeks`, `daily`, `weekly`), priority
(`p1`–`p4`), projects (`#Project` or `#项目名`) and labels (`@label`) — combined in
one line. Chinese works too: `明天`, `下周三`, `三天后`, `每天`, `每周五`, `下午3点半`.

You can type a whole line and it parses:

```
Draft release notes #Work @docs every monday at 9am p1
→ title: Draft release notes · date: Mon 19 Oct 09:00 · Every Mon · p1 · #Work · @docs
```

### What happens when the parser is not sure?

It does nothing. This is a deliberate design decision, not a limitation we
forgot. If a token is ambiguous the parser leaves the text in the title rather
than guessing: `may` stays `may`, and `mar` (Tuesday or March?) stays `mar`.
Likewise a bare `at 14:00` with no date is left as-is instead of silently
assuming today.

A word left in the title is a mistake you can see and fix. A wrong due date is a
mistake you discover on the day it matters. If the input is *only* tokens, the
whole line is kept as the title.

### Does it work on mobile?

The web app is responsive and you can add it to your home screen, but there is no
native app and no push notifications. If phone access is important to you, this
is the wrong tool — use Todoist or similar. We would rather say so than let you
find out later.

### Does it send reminders?

No. Due dates are passive; nothing will interrupt you. This is a real gap
compared with Todoist and it is listed as one.

### What is the keyboard shortcut for adding a task?

Press `N`, `Q` or `/` from anywhere outside a text field. Press `⌘K` (or `Ctrl-K`)
for the command palette, which can reach every view, sort mode, export and
project. Inside a focused task row: `Space` or `X` completes, `E` edits,
`1`–`4` sets priority, `Delete` trashes, and `↑`/`↓` reorders. The full table is
in the [README](../README.md#keyboard-shortcuts).

### What happens when I complete a recurring task?

It rolls forward instead of closing. The due date advances to the next fire date,
keeping the clock time if you set one, and the task stays open. A one-off task
instead gets a completion timestamp and moves to Completed.

### Can I back up or move my data to another machine?

Yes, with JSON export and import. Export writes a versioned, pretty-printed
document; import validates it, repairs malformed fields, and reconstructs
projects that tasks reference but the file is missing. CSV export is available
for spreadsheets. Both buttons are in the status bar, and both are in the ⌘K
palette.

### How do recurring tasks interact with Today?

A recurring task occupies every day it fires, not just the day it was created. A
weekday repeat appears on Monday through Friday and not on the weekend, and
Today and Upcoming project it accordingly.

### Is it really local-first, or does it sync somehow?

Local-first. There is no sync layer, no conflict resolution, no background worker
and no network call. On boot the whole dataset is loaded into memory; writes are
debounced and persist to IndexedDB. If IndexedDB is unavailable — private window,
hardened browser — the app silently falls back to localStorage rather than
failing.

### Why is the natural-language parser so conservative?

Because it is the part of a task manager that can quietly ruin your week. A
parser that treats `may` as a date will, one day, schedule something for May and
you will not notice until it is wrong. Every refusal in this parser is a
trade where we chose a visible, fixable leftover word over an invisible wrong
date. The refusals are covered by tests so they stay deliberate.

### How is this different from Obsidian Tasks or a plain to-do file?

Those are excellent and complement this rather than compete. This is a
purpose-built task UI with views, filters and a keyboard workflow. What it adds
on top is the live parse preview — you see exactly what will be created before you
commit — and a strict "nothing leaves your machine" boundary.

### Why does it look nothing like Todoist?

On purpose. The clean-room rule forbids copying their visual identity, and
honestly a derivative look would add nothing. The interface here is a plain
system-font list with one accent colour. It is not trying to pass as theirs and
it is not affiliated with Doist.

### How do I report a bug or request a feature?

Open an issue at the repository. Issues and pull requests both use templates.
For anything touching your data, please include the output of **JSON → import**
so the bug can be reproduced against a real dataset.

### What is the licence?

MIT. See [LICENSE](../LICENSE) and [NOTICE.md](../NOTICE.md), which also records
the trademark position: "Todoist" is a trademark of Doist, and this project is
independent, unofficial and unaffiliated with them.
