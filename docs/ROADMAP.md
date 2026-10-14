# hcc roadmap

Living plan for the hcc terminal interface. headlesscode owns all
agent behavior; this repo owns presentation and interface config only.

## v0.1 — REPL wrapper (done)

`hcc` opens headlesscode's terminal chat with hcc branding. Args pass
through; `--help`/`--version` are hcc's own. Gated by `just ci`.

## Next — REPL hardening

- Pick up headlesscode's force-quit fix (second Ctrl-C exits a hung
  turn) once it merges; the `file:` dependency tracks the checkout.
- Keyboard audit: done — see docs/KEYBOARD.md (13 states, 3
  cross-repo follow-ups H1-H3 filed there for headlesscode).
- `/help` parity review against headlesscode chat commands.

## Phase 2 — full TUI

Evaluate Ink vs OpenTUI for a full-screen interface: streaming panes,
diff view, approval prompts, session picker. hcc grows a view layer;
the headlesscode turn runner stays the driver.

## Phase 3 — fleet attach

Optional mode that submits to and monitors fleet/RSI workers instead
of (or alongside) the local loop. Needs a queue/identity UX that does
not exist yet; do not start before Phase 2 lands.

## Distribution

- npm publish readiness: confirm the `hcc` name, provenance, tarball
  contents (must not leak the `file:` dev dependency).
- Install story: global install vs curl-to-bin; PATH conventions.
- Versioning contract against headlesscode releases.

## Open decisions

- Single-binary packaging (pkg/caxa/deno) vs node+tsx runtime.
- CI for this repo (mirror headlesscode's typecheck-test gates).
