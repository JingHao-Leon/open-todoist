# Contributing to open-todoist

Thanks for considering a contribution. This is a small project with a clear
scope: a local-first task manager that works without an account or a server.

## Before you start

Please read [NOTICE.md](NOTICE.md). This project is a clean-room reimplementation
and must stay one. Contributions must be original work — no code, assets, copy
or styling lifted from any other product, and no reverse-engineered or
decompiled material.

## Scope

Changes that fit the project's existing constraints are the easiest to accept:

- Bug fixes in the parser, recurrence engine, date arithmetic, filtering or
  statistics
- Additional natural-language tokens, with tests for both acceptance **and**
  refusal behaviour
- New tests
- Documentation and accessibility improvements

Changes that will very likely be declined, because they contradict the
project's premise:

- Accounts, authentication, servers, sync or any cloud backend
- Telemetry, analytics, error reporting or crash reporting
- Advertising, affiliate links, upsells or donation prompts
- AI features that transmit task content to any service
- Large runtime dependencies, especially UI frameworks, date libraries, chart
  libraries or ORMs
- Copying any third-party visual design wholesale

## Development

```bash
npm install
npm run dev          # dev server on http://localhost:5173
npm run build        # tsc --noEmit && vite build
npm test             # vitest run
npm run test:watch   # vitest
```

Requires Node 18 or newer. On a slow network:
`npm install --registry=https://registry.npmmirror.com`.

## Tests

New behaviour needs a test. The parser in particular should be tested in both
directions: that a token is recognised, and that ambiguous input is correctly
*refused*. The existing refusals are deliberate design decisions, not gaps —
please read `docs/ARCHITECTURE.md` §5 before changing parser behaviour.

Every date-sensitive function takes an injectable clock. Please keep it that way;
tests must not depend on the wall clock.

```ts
// Good: deterministic
const NOW = new Date(2026, 9, 14, 10, 0, 0);
expect(parseInput('Standup tomorrow', { now: NOW }).due).toEqual({ date: '2026-10-15' });

// Avoid: fails tomorrow
expect(parseInput('Standup tomorrow').due).toEqual({ date: '2026-10-15' });
```

## Pull requests

1. Branch from `main`.
2. Make `npm run build` and `npm test` pass.
3. Update `README.md`, `docs/ARCHITECTURE.md` and `CHANGELOG.md` if behaviour
   changes. Claims in the README are meant to be checkable — if you add a
   feature, document it; if you change a number, make it true.
4. Fill in the pull request template.

## Reporting bugs

Open an issue. If the bug involves data, attach the output of **JSON → export**
if you are able to share it; note that the export contains your task text, so
redact anything sensitive first.

## Code of conduct

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Licence

Contributions are accepted under the MIT licence. By submitting a pull request
you confirm that your contribution is original work that you have the right to
license under those terms.
