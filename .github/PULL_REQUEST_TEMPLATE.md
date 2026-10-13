# Pull request

Thank you for contributing. Please fill this in — it makes review much faster.

## What this changes

<!-- One or two sentences. What is different after this merges? -->

## Type of change

- [ ] Bug fix
- [ ] New natural-language token
- [ ] New feature
- [ ] Refactor with no behaviour change
- [ ] Documentation
- [ ] Build or tooling

## How it was verified

<!-- Paste the real output, not a description of it. -->

```
$ npm run build
$ npm test
```

- [ ] `npm run build` passes with no TypeScript errors
- [ ] `npm test` passes, including the new tests
- [ ] I added tests for new behaviour
- [ ] Date-sensitive logic uses an injected clock rather than the wall clock

## Checklist

- [ ] This is original work; no code, assets, copy or styling from any other
      product is included
- [ ] No new runtime dependencies (the runtime list must stay at `react` and
      `react-dom`)
- [ ] No telemetry, network calls, analytics or error reporting
- [ ] No account, server or sync functionality
- [ ] Parser changes cover both acceptance **and** refusal behaviour
- [ ] `README.md`, `docs/ARCHITECTURE.md` and `CHANGELOG.md` updated if behaviour
      changed, and every claim in them is still checkable
- [ ] `NOTICE.md` clean-room obligations respected

## Anything a reviewer should know

<!-- Ambiguous parser cases, deliberate trade-offs, known gaps. -->
