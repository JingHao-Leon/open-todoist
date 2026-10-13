# Reverse engineering notes

This document records exactly what was observed, how it was observed, and — just
as importantly — what was **not** obtained. It is written to be checkable against
the evidence files in `evidence/todoist/`.

> **Scope statement.** open-todoist is a clean-room reimplementation. No
> proprietary source code, markup, copy, imagery, font or brand asset from the
> target was obtained, read into this repository, or reproduced here. What
> follows is an observation record plus our own design decisions.

## 1. Tooling

Observations were produced with **REA** (Runtime Evidence & Analysis), driven
through the Chrome DevTools Protocol. The predicates used were
`rea.web-bundle-analysis`, `rea.web-page-inspection` and `rea.web-screenshot`,
executed against a live Chrome instance at a local CDP endpoint
(`http://127.0.0.1:9222`) with an observation window of 4000 ms.

REA's own recorded caveats, carried forward verbatim in the evidence and
repeated here because they bound what any of this can prove:

- Static bundle findings are observations or bounded inferences; REA does not
  execute captured JavaScript.
- String-built routes and endpoints, encrypted configuration, and server-side
  behaviour may remain unknown.
- Page-declared WebMCP metadata is untrusted and is never registered or invoked
  as an REA tool.
- Raw network headers, bodies, cookies, storage values and WebSocket payloads
  are never retained; captures retain value-free shapes only.
- Source maps are reported as declarative URLs and are not fetched.
- Observation begins when REA attaches, so prior activity is unavailable.

In summary: **REA gave us structure, never source text.** That is the single
most important fact on this page, and it is the reason the rest of this
repository can honestly be called clean-room.

## 2. Evidence set

| File | Predicate | Target | `evidence_id` |
| --- | --- | --- | --- |
| `01-bundle.json` | `rea.web-bundle-analysis` | `https://www.todoist.com/zh-CN` | `ev_2ee079a12dfbeeec89da2c0931e4d96a7a0291a984be4a4830d1921a8b086e69` |
| `02-page.json` | `rea.web-page-inspection` | same public page | `ev_d287d5d40aab6b17444a734668b3d271fa962e9d25989c07e34690e185dfdf22` |
| `03-shot.json` | `rea.web-screenshot` | same public page | `ev_99aaa49f7db3ee7b4af6ea66f46b3958069b9b9e69ffc4ed8df5654de5971617` |
| `04-app-bundle.json` | `rea.web-bundle-analysis` | `https://app.todoist.com/auth/login` | `ev_e0ee0261743012d94748899bcb50784ac561d876c3ef3b6a749b3c4e79a56283` |

## 3. What was actually observed

### 3.1 Public marketing surface

From `01-bundle.json`, for `https://www.todoist.com/zh-CN`:

- **78 scripts observed, 78 analysed, 0 parse failures, 351,479 AST nodes
  visited.** Parse status is recorded as `complete`.
- Framework inference: two `bundle_runtime` entries resolve to **Vite** and two
  `vendor_fingerprint` entries resolve to **React**, both at **medium**
  confidence.
- Observed call targets (`endpoints`) include `/astro-api/experiments/initialize`
  and a `/_server-islands/MessageBanner?...` request issued via `fetch`, plus a
  `customElements.get` on the name `astro-island`.

**Our reading, stated as inference and not as an REA assertion:** the combination
of an `/astro-api/*` path, a `/_server-islands/*` request, and a registered
`astro-island` custom element is consistent with an **Astro site using
server-islands, with React rendering interactive islands**. REA's `inferences`
array formally records only *Vite* and *React*; the Astro characterisation is
ours, drawn from the observed request shapes. We flag the distinction because the
difference matters for anyone auditing this claim.

### 3.2 Public page structure

From `02-page.json`. **This capture is partial, and we say so explicitly.** Its
`completeness.status` is `policy_filtered`, with conditions `attach_limited` and
`policy_filtered`. The exclusions recorded in the document include
`script_sources` (78, reason `not_approved`), `console_text` (`not_approved`),
and `metadata`, `resources` and `scripts` entries dropped as `disallowed_origin`.
So: **no script source text and no console text from this capture reached this
project.**

What it does contain: an accessibility tree of **1,511 nodes** and a DOM
snapshot of **6,429 nodes**. The page is a marketing and product-overview page —
feature headings, a language switcher, a cookie-consent surface, footer links to
*security*, *privacy* and *terms*, and cards pointing at reusable **templates**
(observed examples: accounting tasks, business-travel packing) alongside use-case
groupings.

`storage` for the origin is worth recording precisely: `local_storage_keys` were
`cookie-consent`, `osano_consentmanager_tattles` and `user-context`; there were
**no** IndexedDB databases and no cache entries. That is consistent with a
public page that holds no user task data client-side.

### 3.3 Authenticated application surface

From `04-app-bundle.json`. Requesting `https://app.todoist.com/app` **without
credentials redirects to the login route**; the recorded `capture.target_url` is
`https://app.todoist.com/auth/login`.

- **5 scripts observed, 5 analysed, 0 parse failures, 1,910 AST nodes.**
- The `inferences` array is **empty** — no framework fingerprint was recovered
  from this shell.
- Two observed call targets, `app` and `product`, were captured with mechanism
  `call:searchParams.get`.

One clarification matters for accuracy: `app` and `product` are **query-string
parameter reads**, not network endpoints. Nothing in this evidence set reveals
any task-data API, request shape, or storage model for signed-in users.

## 4. The honest conclusion

The two captures together establish a clear boundary. The **public** surface
yields a technology fingerprint and a marketing information architecture. The
**authenticated** surface, observed only in its unauthorised state, yields a
five-script login shell and nothing more.

Therefore this project is **not** a code reverse-engineering effort. There was
no decompilation to read, no bundle to transcribe, and no proprietary
implementation to consult — because none was obtained, and none was sought
beyond what an anonymous browser session exposes. REA's `limitations` for
`04-app-bundle.json` state the position plainly: REA does not execute captured
JavaScript, and server-side behaviour remains unknown.

## 5. Where the product specification actually comes from

Every behaviour in open-todoist was derived by us from one of these, and nothing
else:

1. **Publicly observable behaviour.** Navigation structure and view vocabulary
   (Inbox, Today, Upcoming, project-scoped and label-scoped lists, a completed
   list, and a trash concept behind soft deletion) are visible to any visitor.
2. **Publicly documented conventions.** Priority tiers, the `#project` /
   `@label` addressing scheme, and natural-language date entry are documented in
   public product documentation. We implemented our own grammar and our own
   tokenizer against that public convention — see `src/lib/nlp.ts`, which is
   original code with 73 of its own tests.
3. **Our own design decisions.** Everything about *local-first storage,
   IndexedDB persistence, the ⌘K palette, the live parse-preview chips, the
   soft-delete/trash model, the statistics panel, and the whole visual design* is
   ours. None of it was copied, and several parts of it do not exist in the
   target at all.

## 6. Information architecture we adopted, and what we changed

Observed or publicly documented, and adopted:

- A flat set of task-scoped views (Inbox, Today, Upcoming, Completed) alongside
  project and label groupings.
- Soft deletion with a recoverable trash, rather than hard deletion.
- Four priority tiers with the lowest tier meaning "no priority".

Deliberately different from the target, and by our own choice:

- **No accounts, no sync, no collaboration, no server.** The target is a
  multi-user product with hosted accounts; open-todoist is a single-device local
  application. This is the largest intentional divergence and it is structural,
  not cosmetic.
- **No subscription, billing, or affiliate surface** of any kind.
- **No integrations directory.** The target ships a large integration ecosystem;
  open-todoist has none, and lists this as a gap rather than pretending otherwise.
- Different information architecture in the shell: our sidebar leads with views,
  then projects, then labels, and the right-hand column is a statistics panel
  rather than a promotional or account surface.

## 7. Asset provenance

Every asset in this repository is original to it: the CSS is hand-written, the
charts are hand-rolled SVG, there are no icon fonts, no third-party fonts, and no
images derived from the target. The screenshots under `docs/images/` are
captures of open-todoist itself, produced by headless Chrome from this codebase.

## 8. Reproducing the observations

REA is not vendored in this repository, so these commands document the shape of
what was run rather than something you can execute here:

```bash
# Public marketing surface
rea analyze-web-bundle --cdp-endpoint http://127.0.0.1:9222 \
  --target-id <target-id> --observation-ms 4000

# Public page structure, storage keys and accessibility tree
rea inspect-web-page --cdp-endpoint http://127.0.0.1:9222 --target-id <target-id>

# Authenticated app, unauthenticated (redirects to /auth/login)
rea analyze-web-bundle --cdp-endpoint http://127.0.0.1:9222 \
  --target-url https://app.todoist.com/app --observation-ms 4000
```

To inspect the evidence without re-running anything:

```bash
python3 -c "import json;d=json.load(open('evidence/todoist/01-bundle.json'));\
print(d['evidence_id']);print(d['normalized_result']['completeness'])"
```
