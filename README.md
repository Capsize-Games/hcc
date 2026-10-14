# hcc

Interactive terminal interface for the
[headlesscode](https://github.com/Capsize-Games/headlesscode)
coding-agent harness — the `muse`-style front door to the local agent loop.

## Install

```sh
npm install
npm link   # puts `hcc` on PATH for development
```

Requires the headlesscode checkout at `../headlesscode`.

## Usage

```sh
hcc                          # open the terminal chat
hcc --workspace <path>       # chat scoped to a workspace
hcc --resume <id>            # resume a session
hcc --model <model>          # model override
hcc --help | --version
```

Inside, `/help` lists chat commands. Each message starts one turn.

## Develop

```sh
just setup    # install dependencies
just ci       # lint + typecheck + test
```

MIT — © 2026 Capsize LLC. See LICENSE.
