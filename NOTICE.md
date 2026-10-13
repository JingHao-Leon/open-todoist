# NOTICE

## Trademark and non-affiliation

**"Todoist" is a trademark of Doist.** This project is not affiliated with,
endorsed by, sponsored by, or in any way officially connected with Doist or any
of its products or services.

This project is an **independent, unofficial, clean-room reimplementation**
written from publicly observable behaviour and public documentation. It is not a
fork, a derivative work, a port, or a translation of Todoist or any part of it.

If you are looking for the official Todoist product, it is at
<https://www.todoist.com>. Please consider using it — it is a mature product
with mobile apps, reminders, calendar integration and team features that this
project does not have. See [docs/COMPARISON.md](docs/COMPARISON.md) for an honest
account of where this project falls short.

## No derived code or assets

To state the provenance of this repository explicitly:

- **No source code** from Todoist, in any language, in original or decompiled
  form, was copied, translated, transcribed, or used in the creation of this
  project. None was obtained.
- **No assets** — images, icons, illustrations, logos, sounds, themes,
  stylesheets, or fonts — from Todoist or any third party are included. Every
  asset in this repository is original to it. The stylesheet is hand-written and
  the charts are hand-rolled SVG.
- **No copy text, marketing material, or documentation** from Todoist is
  reproduced. Product names and feature terminology appear only where necessary
  to describe compatibility, and are used nominatively.
- **No data** belonging to Todoist or its users is included. The sample data in
  the screenshots was generated locally for this repository.

## What the reverse engineering actually covered

Short version, because the distinction matters. Full detail with evidence IDs is
in [docs/REVERSE_ENGINEERING.md](docs/REVERSE_ENGINEERING.md).

The REA observations in this project cover the **public web surface** of the
target: 78 scripts (351,479 AST nodes) from the public marketing site, and
5 scripts (1,910 AST nodes) from the unauthenticated login shell at
`app.todoist.com`. Those observations yielded a technology fingerprint and a
public information architecture. They yielded no task-data API, no request
shapes, and no storage model, because none are exposed to an anonymous session.

This project is therefore a behavioural reimplementation informed by public
observation and public documentation — **not** a decompilation, and not a port.

## Name

"open-todoist" is used here as a descriptive reference to the compatibility
target, following the `open-<name>` clean-room convention. It is not a claim of
authorship, ownership, or official status, and it is not a domain name or
trademark of this project.

## Third-party dependencies

This project depends on `react` and `react-dom` at runtime (MIT licensed), and
on Vite, TypeScript, Vitest and related tooling at build time. See
`package.json` for the exact list and versions. No dependency is copyleft-licensed.
