# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| 1.0.x | ✅ |

## Reporting a vulnerability

Please **do not** open a public issue for a security problem.

Email **security@example.invalid** with:

- a description of the issue and its impact,
- steps to reproduce,
- the version or commit affected.

Replace the address above with a real monitored mailbox before publishing this
repository; it is a placeholder so that no unowned address is published by
accident.

We aim to acknowledge a report within 72 hours and to provide a fix or
mitigation plan within 14 days.

## Threat model

This application's security properties follow directly from its architecture, so
it is worth being precise about what they do and do not cover.

### What this project protects

**Your task data does not leave your device.** Tasks are stored in your
browser's IndexedDB. The application contains no API client, no fetch of remote
data, and no server component. Clearing this application's access to the network
should not change its behaviour — that is the intended design, and it is the
reason there is no account to breach and no credentials to leak.

**No telemetry exists.** There is no analytics, no error reporting, no crash
reporting, no session recording, and no third-party script. The complete runtime
dependency list is `react` and `react-dom`, which is verifiable in
`package.json`.

**Supply chain is small and auditable.** Two runtime dependencies, both MIT
licensed. There is no ORM, no date library, no chart library and no
state-management library, because each would be code this project would have to
trust.

**Exports are plain data.** The JSON export is readable, pretty-printed and
documented in `docs/ARCHITECTURE.md`.

### What this project does not protect

**There is no encryption at rest.** Your tasks sit in browser storage in plain
text. Anyone with access to your operating system account, your browser profile
directory, or an unlocked device can read them. Clearing site data deletes
everything with no recovery.

**There is no authentication.** The application does not verify who you are,
because it is a single-user local tool. There is no access control between
operating system accounts or browser profiles beyond what the browser itself
provides.

**There is no sync and therefore no sync security story.** Data does not travel
between devices, so there is no transport security to assess, and equally no
protection of data in transit because there is no transit.

**XSS is a real risk in any app that renders user text.** open-todoist renders
task titles as text content rather than injecting them as HTML. If you find an
input path that allows markup or script execution from task text, that is a
genuine vulnerability and we want to hear about it.

**The origin is trusted.** The app is served as static files and expects to run
on its own origin. Do not embed it in a page alongside untrusted content.

## Data handling

We receive no data. There is nothing to collect, because there is no server.
Issue reports are handled by email and are not stored beyond their resolution.
