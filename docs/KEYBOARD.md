# hcc keyboard audit (issue #2)

Every keyboard/exit path of the hcc chat, audited against
headlesscode 1.9.15 (`d93e4ef5`), whose terminal chat
(`src/terminal/chat.ts`, `input.ts`, `cli.ts`) hcc wraps.
hcc adds no key handling of its own: `src/cli.ts` answers
`--help`/`--version` and passes everything else to
`terminalMain`, so every path below is upstream behavior
documented here as the hcc contract. Re-audit when the
`file:../headlesscode` dependency moves past the commit above.

In-chat `/help` states the short version: "Ctrl-C cancels an
active turn, twice force quits; Ctrl-D exits."

## State table

| #   | State                         | Indicator                 | Keyboard exit        | Result                                      |
| --- | ----------------------------- | ------------------------- | -------------------- | ------------------------------------------- |
| S1  | Prompt idle                   | `you> `                   | `/exit`              | Saves, exits 0                              |
| S1  | Prompt idle                   | `you> `                   | Ctrl-D               | EOF: saves, exits (1 if pending unsavable)  |
| S1  | Prompt idle                   | `you> `                   | Ctrl-C               | Cancels the current line, stays in chat     |
| S2  | Multiline draft               | `... ` after `"""`        | Closing `"""`        | Sends the draft as one turn                 |
| S2  | Multiline draft               | `... ` after `"""`        | Ctrl-C               | Discards the draft, stays in chat           |
| S2  | Multiline draft               | `... ` after `"""`        | Ctrl-D               | Exits chat, draft lost                      |
| S3  | Backslash continuation        | `... ` after trailing `\` | Finish the line      | Sends the joined message                    |
| S3  | Backslash continuation        | `... ` after trailing `\` | Ctrl-C               | Discards, stays in chat                     |
| S3  | Backslash continuation        | `... ` after trailing `\` | Ctrl-D               | Exits chat, draft lost                      |
| S4  | Active turn (responsive)      | Streaming output          | Ctrl-C (once)        | Aborts the turn, partial result saved       |
| S5  | Hung turn                     | No output, prompt gone    | Ctrl-C (twice)       | Force quits, exit 130, pending lost         |
| S6  | Queued backlog                | None visible              | None — see H1        | Each queued line becomes a turn             |
| S7  | Backlog overflow              | Warning line              | Automatic            | Discards backlog, exits 1                   |
| S8  | Revision conflict             | "Use /save to retry"      | `/save` then `/exit` | Retries save, then exits 0                  |
| S8  | Revision conflict             | "Use /save to retry"      | Ctrl-D               | Exits 1, pending dropped                    |
| S9  | Save failure (disk)           | "Could not save"          | `/save` then `/exit` | Retries save, then exits 0                  |
| S9  | Save failure (disk)           | "Could not save"          | Ctrl-D               | Exits 1, pending dropped                    |
| S10 | Startup (before first prompt) | Header not yet shown      | Ctrl-D               | EOF queued, exits after startup             |
| S10 | Startup (before first prompt) | Header not yet shown      | Ctrl-C               | Queued as "Input cancelled" at first prompt |
| S11 | Hung store/skill/import await | Command echoes, no result | None — see H2        | No keyboard path out                        |
| S12 | Piped / non-TTY input         | No `you> ` prompt         | EOF (pipe close)     | Saves, exits                                |
| S13 | hcc `--help` / `--version`    | One-shot output           | None needed          | Exits 0 immediately                         |

Notes:

- `/exit` is refused while session content is unsaved (S8, S9):
  it prints the retry hint and stays in chat. Ctrl-D is the
  escape hatch there; it exits 1 and drops the pending content.
- Ctrl-C at an idle prompt never exits; it only cancels the
  line being composed (S1, S2, S3).
- A message over 50,000 characters is discarded with an error
  and the chat stays at the prompt; not an exit state.
- SIGTERM (not a keyboard path) aborts the turn and exits 1
  via the supervisor-abort handler.
- The `bin/hcc.mjs` launcher passes stdio through, so keys
  reach the chat unchanged; the chat runs the TTY in raw mode
  while at the prompt, so Ctrl-C/Ctrl-D arrive as handled
  bytes rather than signals.

## Trap states and follow-ups

H1 and H2 are headlesscode defects found by this audit; hcc
owns no code on these paths, so they are filed here as
cross-repo follow-ups instead of fixed. H3 is a minor UX gap
in the same area.

### H1 — queued input backlog has no keyboard flush (headlesscode)

Repro: at `you> `, paste 50 lines (or type ahead during a
turn). Every queued line becomes its own turn after the
current one. Ctrl-C cancels only the line being composed;
a typed `/exit` lands behind the queue. Only the overflow
guard (>256 lines or >1MB queued) discards input, and it
exits the chat with code 1.

Expected: Ctrl-C at an idle prompt also drops the queued
backlog (with a notice), or a command such as `/discard`
clears it. Severity: medium-low — escapable via repeated
turn aborts plus Ctrl-D, but an accidental paste can queue
dozens of unwanted turns with no direct stop.

Upstream: `TerminalInput` queue in
`headlesscode/src/terminal/input.ts`; consumer loop in
`headlesscode/src/terminal/chat.ts`.

### H2 — hung non-turn await has no force quit (headlesscode)

Repro: the main loop awaits `store.save`/`store.load`,
skill activation, or session import with no abort. The
double-Ctrl-C force quit only fires while `activeTurn` is
set; anywhere else Ctrl-C just queues another "Input
cancelled". If one of those awaits never resolves, no
keyboard path leaves the chat.

Expected: extend the second-press force quit to any
in-flight command await, not just active turns. Severity:
low — these are local disk/registry operations that rarely
hang, but the trap is total when one does.

Upstream: interrupt handler in
`headlesscode/src/terminal/chat.ts` (the `activeTurn`
branch); `savePending`, `/resume`, `/sessions`, skill and
import awaits in the same file.

### H3 — refused `/exit` does not name the Ctrl-D hatch (headlesscode)

Repro: enter a revision conflict (S8), then `/exit`. The
chat prints "Use /save to retry" and stays, with no hint
that Ctrl-D exits (dropping pending). A user who wants out
without saving has to discover Ctrl-D by accident.

Expected: append "or Ctrl-D to exit without saving" to the
refusal message. Severity: low — cosmetic, documented here
in the meantime.

## Verification

- `test/keyboard.test.ts` pins the upstream `/help` exit
  lines (Ctrl-C, double-press force quit, Ctrl-D) so a
  headlesscode upgrade that changes them fails loudly, and
  checks this document still names every audited state.
- Paths verified by reading `chat.ts`, `input.ts`, and
  `cli.ts` at the commit above plus their tests
  (`chat.test.ts`: interrupt-abort, second-press force quit
  exit 130, overflow guard, conflict retry, PTY Ctrl-C).
