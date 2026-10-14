# AGENTS.md — hcc

Interactive terminal interface for headlesscode. Thin UX layer: all
agent behavior lives in the `headlesscode` dependency (`file:../headlesscode`).

## Rules

- TypeScript, strict, ES2022, tabs, 80 columns. Prettier enforces style.
- No business logic here that belongs in headlesscode; hcc owns only
  presentation, argument handling, and interface configuration.
- Every user-facing behavior needs a test in `test/` (run: `just test`).
- `just ci` (lint + typecheck + test) must pass before merge.
- MIT licensed (explicit owner decision 2026-10-14: the interface
  layer is MIT; the headlesscode harness stays Apache-2.0).
