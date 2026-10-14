# hcc distribution design

Answers the Distribution section of `docs/ROADMAP.md` for
[Capsize-Games/hcc#6](https://github.com/Capsize-Games/hcc/issues/6):
package naming, publish readiness, install story, and the
versioning contract against headlesscode releases.

Recommendations are concrete and ordered; rationale follows each one.
No code changes ship with this doc — implementation is follow-up work.

## 1. Package naming

**Verdict: publish as `@capsizellc/hcc`. Keep the `hcc` binary name.**

Evidence (checked 2026-10-14 against the live npm registry):

| Name              | Registry result            |
| ----------------- | -------------------------- |
| `hcc`             | TAKEN — `0.1.1` exists     |
| `@capsizellc/hcc` | Free (404)                 |
| `@capsize/hcc`    | Free (404), scope unproven |
| `@capsizellc/ui`  | `0.1.2` — scope is proven  |
|                   | Capsize-owned              |

Reasons for `@capsizellc/hcc`:

- The bare name is gone. Squatting risk and confusion with the
  unrelated `hcc@0.1.1` owner argue against trying to acquire it.
- The `@capsizellc` scope is proven ours: `@capsizellc/ui`
  publishes from it today. `@capsize/...` returns 404 for
  everything probed, which means either the org does not exist or
  we do not control it — do not design around an unowned scope.
- npm scopes do not affect the installed binary: the `bin` entry
  stays `"hcc": "bin/hcc.mjs"`, so
  `npm install -g @capsizellc/hcc` still puts a plain `hcc` on
  PATH. Users never type the scope after install.

Alternatives rejected:

- **Pick a different bare name** (e.g. `headless-chat`). Burns the
  `hcc` brand the repo, docs, and binary already use, for no gain —
  any bare name can be taken next, while the owned scope is stable.
- **`@capsize/hcc`.** Only if the owner first proves control of the
  `@capsize` org. Until then it is a publish-time failure waiting
  to happen.

## 2. What must change to publish

`package.json` today has `"private": true` and
`"headlesscode": "file:../headlesscode"`. The `file:` dependency
cannot ship: it resolves to a sibling checkout path that does not
exist on any consumer machine, and `npm pack` either embeds a
stale copy or produces an uninstallable tarball. Publish readiness
is the checklist below.

### 2.1 The `file:` replacement

**Verdict: depend on the published `headlesscode` package by semver
range (option A).**

| Option                        | Verdict | Reason                                 |
| ----------------------------- | ------- | -------------------------------------- |
| A. `headlesscode: ^x.y` (npm) | Adopt   | Already on npm; normal dep (§2.2)      |
| B. `peerDependencies`         | Reject  | hcc is an end-user CLI, not a library; |
|                               |         | peers push install burden onto users   |
| C. `bundledDependencies`      | Reject  | Bloated tarball, stale copies, plus    |
|                               |         | Apache-2.0 attribution inside an MIT   |
|                               |         | tarball (§2.3)                         |

`headlesscode` is already published (registry latest `1.3.0` at
time of writing). hcc's `package.json` should declare a caret
range with a floor at the first headlesscode release hcc is
verified against (see §4).

Local development keeps tracking the checkout without dirtying the
shipped manifest: develop with an ephemeral local install
(`npm install ../headlesscode`, never committed) or a packed
tarball for pre-release testing. CI installs the published range
by default, plus one job installing from the sibling checkout to
catch drift early.

### 2.2 Publish checklist (follow-up work, not this doc)

1. Rename to `@capsizellc/hcc`; keep `bin.hcc` unchanged.
2. Remove `"private": true`.
3. Replace the `file:` dep with the §2.1 semver range.
4. Add a `files` allowlist (`bin/`, built output, `LICENSE`,
   `README.md`) so the tarball cannot leak `node_modules`,
   tests, or a stray local headlesscode copy.
5. Add `repository`, `author`, and `keywords` metadata.
6. Set the headlesscode floor to a version actually published —
   note the repo (1.9.15) is ahead of the registry (1.3.0), so
   either headlesscode publishes first or hcc's floor waits for it.
7. Publish with provenance (`npm publish --provenance` from CI on
   a tagged release) so the registry links the tarball to this repo.

### 2.3 License note

hcc is MIT per the standing owner decision; headlesscode stays
Apache-2.0. Depending on it (option A) keeps the licenses in
separate packages, which needs no attribution work beyond the
normal `node_modules` notices. Only bundling (rejected) would
oblige hcc to carry Apache-2.0 attribution text in its own tarball.

## 3. Install story

**Verdict: global npm install is the primary path; `npx` is the
zero-install path; curl-to-bin waits for the single-binary decision.**

- **Primary:** `npm install -g @capsizellc/hcc`, then run `hcc`.
  npm links `bin/hcc.mjs` into the global bin dir — the standard
  PATH convention, no custom installer or PATH editing. Requires
  Node `>=22` per `engines` (matches headlesscode's `>=22.19`
  closely; align the exact floor when the §2.2 floor is set).
- **Try without installing:** `npx @capsizellc/hcc`. Works the day
  the package publishes; document it in the README as the
  quickstart.
- **curl-to-bin:** deferred. A curl-piped binary needs the open
  roadmap decision "single-binary packaging (pkg/caxa/deno) vs
  node+tsx runtime" settled first — shipping a curl installer for
  a Node-runtime CLI just re-implements npm badly. Revisit if
  Phase 2 (full TUI) justifies a standalone binary.

## 4. Versioning contract against headlesscode

**Verdict: hcc versions independently; the dependency range plus a
documented support floor is the contract.**

- hcc keeps its own `0.x` line (`0.1.0` today). Its bumps follow
  hcc's UX changes, not headlesscode's releases.
- The `headlesscode` range (`^x.y`) declares compatibility. The
  floor `x.y` is the lowest headlesscode release hcc's CI has
  verified; raising the floor is a minor hcc bump with a changelog
  note naming the required headlesscode version.
- A breaking headlesscode API change that forces hcc code changes
  is a minor hcc bump at minimum; if it changes hcc's own CLI
  surface, a major bump once hcc reaches `1.0`.
- CI verifies both ends: the published-range install (latest) and
  the sibling-checkout install (bleeding edge, §2.1). If the
  sibling job fails, hcc holds its floor and files a headlesscode
  follow-up instead of tracking the break.
- README documents the floor ("requires headlesscode >= x.y")
  next to the install instructions, updated on every floor change.
