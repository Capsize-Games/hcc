# TUI framework evaluation: Ink vs OpenTUI

For [hcc#4](https://github.com/Capsize-Games/hcc/issues/4), Phase 2
(full-screen interface). Evaluated 2026-10-14 with throwaway spikes in
`/tmp/hcc-tui-eval` (not preserved in this repo): one Ink app and one
OpenTUI app, each rendering a streaming text pane (token appended every
50 ms) plus a one-line input with Enter-to-submit. Measured under a
Python pty harness (`probe.py`): spawn-to-first-byte, in-app
first-frame callback, and keypress-to-echo latency (median of 5).

Versions: Ink 8.0.0 + React 19.3.1, `@opentui/core` 0.6.6, Node
v22.23.3, Bun 1.4.3 (OpenTUI control runs only; hcc targets Node).

## Recommendation: Ink

Adopt Ink for the Phase 2 view layer.

1. **It runs on hcc's stack; OpenTUI does not.** Ink declares
   `node>=22`, matching hcc's engines. OpenTUI 0.6.6 requires Bun
   ≥1.3.14 or Node ≥26.4 with `--experimental-ffi`, and crashes on
   Node 22 (`Failed to initialize OpenTUI render library: OpenTUI
native FFI is not available for this runtime yet`). Worse, a
   plain `npm i @opentui/core` on Node 22 silently resolves to the
   stale 0.5.10 instead of warning. Adopting OpenTUI would force
   hcc onto Bun or a bleeding-edge Node, and complicate the
   single-binary question in the roadmap (the 5 MB platform `.so`
   sidecar does not bundle like JS).
2. **The performance gap does not matter for a chat TUI.** OpenTUI
   is faster (~17 ms vs ~37 ms keypress-to-echo, 70–150 ms vs
   ~270 ms cold start), but 37 ms is well under the ~100 ms
   perceived-instant threshold, and redraw byte volume was
   comparable (Ink ~8 KB/s, OpenTUI ~11 KB/s on the spike
   workload). Ink's maturity (v8, large ecosystem,
   `ink-testing-library`) outweighs headroom hcc does not need.

Re-evaluate only if Phase 2 grows 60 fps dashboards, inline images,
or mouse-heavy widgets — OpenTUI's native renderer and widget set
(ScrollBox, Select, Markdown, Diff, Image) would earn a second look
then, presumably once its Node support stabilizes.

## Comparison

| Criterion                        | Ink 8 + React 19                | OpenTUI core 0.6.6                                   |
| -------------------------------- | ------------------------------- | ---------------------------------------------------- |
| Verdict                          | Adopt                           | Decline for now                                      |
| Runtime on Node 22               | Works (`node>=22`)              | Crashes (needs Node ≥26 + `--experimental-ffi`)      |
| Cold start (spawn to first byte) | ~270 ms (Node), ~120 ms (Bun)   | 70–150 ms (Bun only)                                 |
| Keypress-to-echo (median)        | ~37 ms (same on Node and Bun)   | ~17 ms (Bun)                                         |
| Redraw volume (20 Hz stream)     | ~8 KB/s                         | ~11 KB/s                                             |
| Prod install size                | 24 MB                           | 54 MB (incl. 23 MB TypeScript via `bun-ffi-structs`) |
| Tarball (unpacked)               | 605 KB + 174 KB (react)         | 17 MB + 5 MB platform `.so`                          |
| UI model                         | React components, flexbox       | Imperative renderables (React/Solid wrappers exist)  |
| Widgets for Phase 2              | Build on primitives + ecosystem | Richer built-ins (Select, ScrollBox, Diff, Markdown) |
| Single-binary story              | Pure JS, bundles trivially      | 5 MB native sidecar × 8 platform packages + FFI flag |
| Maturity                         | v8, widely adopted              | 0.x, API in flux, used by OpenCode in production     |
| License                          | MIT                             | MIT                                                  |

## Prototype notes

- Both spikes: ~60 lines, streaming pane + input + Enter handling +
  Ctrl-C exit + `AUTO_EXIT_MS` self-quit for headless runs. Both
  functionally verified: a typed sentinel word echoed in the input
  and, after Enter, appeared in the stream pane.
- Ink latency is framework-bound, not runtime-bound: identical
  ~37 ms medians under Node and Bun. OpenTUI's ~17 ms held across
  repeat runs.
- OpenTUI's `'tok'`-style contiguous text never appears in its raw
  output: it repaints per-character with cursor addressing and
  truecolor escapes, which is why its byte volume slightly exceeds
  Ink's line-based redraws on this workload.
- `npm view`/`npm i` skew: on Node 22, `npm i @opentui/core`
  installs 0.5.10 with no warning even though `latest` is 0.6.6;
  only an explicit `@0.6.6` (with an `EBADENGINE` warning) gets
  current code. Spike measurements above are all 0.6.6 under Bun.
- Spike locations (throwaway, outside this repo):
  `/tmp/hcc-tui-eval/ink-spike/app.mjs`,
  `/tmp/hcc-tui-eval/opentui-spike/app.mjs`,
  `/tmp/hcc-tui-eval/probe.py`,
  `/tmp/hcc-tui-eval/functional.py`.
