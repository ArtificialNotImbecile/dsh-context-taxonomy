# @artificialnotimbecile/dsh-context-taxonomy

English | [简体中文](https://github.com/ArtificialNotImbecile/dsh-context-taxonomy/blob/main/README.zh-CN.md)

**See how DeepSeek Harness assembles each ordinary agent call:** the complete system prompt, conversation history, current prompt, tool definitions, model options, token composition, cache usage, and logical reasoning evidence.

This read-only Web-profile plugin is designed for learning Harness architecture and debugging agent behavior. It captures the provider-neutral `GenerateOptions` values that reach this plugin's public `llm/stream` listener and presents them as an explorable Context Taxonomy beside the conversation. Use it to study prompt construction, compare presets, audit which tools the model could call, diagnose context growth, and understand retries without reading a Session log by hand.

![A real DeepSeek Harness session opening Context Taxonomy and inspecting the assembled context](https://raw.githubusercontent.com/ArtificialNotImbecile/dsh-context-taxonomy/codex-initial-plugin-assets/context-taxonomy-demo.gif)

_Recorded from a real DeepSeek-V4-Flash run on the official Harness `0.1.0-rc.6` Web profile—not a mock or fixture._

## Context Taxonomy and Harness Trajectory

This plugin complements the official [**Trajectory**](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/client/ui-trajectory) view rather than replacing it. Both can show system prompts, tools, request options, and reported usage, but they answer different questions.

| | Harness Trajectory | Context Taxonomy |
| --- | --- | --- |
| Primary question | What happened during the run, and in what order? | What context made up this logical model call? |
| Organization | Turn/Step event ledger with User, Assistant, Tool, Subtool, retry, compaction, and timing records. | Per-call System, Conversation, Current prompt, Tools, Options, and Unclassified taxonomy. |
| Distinct strengths | Execution flow, tool inputs/results, latency, retries, and failures. | Estimated category composition, message provenance, unexpected fields, logical reasoning checks, and sanitized canonical logical JSON. |
| Coverage | Reconstructs official Session history, including compaction. | Records ordinary calls that reach this plugin after installation; auxiliary calls are excluded. |

Use Trajectory to understand the execution story. Use Context Taxonomy to understand the anatomy of one assembled logical request and why its context looks the way it does.

It does not capture a provider HTTP body, headers, endpoint, transport attempt, or delivery status. Calls that fail before LLM dispatch or are intercepted by an earlier waterfall listener are not visible.

## Quick start for existing Harness users

The package targets DeepSeek Harness `0.1.0-rc.6` exactly. If `dsh --version` already works and reports that version, install the plugin and restart the Web profile with the short commands:

```sh
dsh plugin --profile web add @artificialnotimbecile/dsh-context-taxonomy@0.1.0
dsh web
```

If the `dsh` binary is not on your `PATH`, use the pinned CLI through `npx`:

```sh
npx --yes @deepseek-ai/dsh@0.1.0-rc.6 plugin --profile web add @artificialnotimbecile/dsh-context-taxonomy@0.1.0
npx --yes @deepseek-ai/dsh@0.1.0-rc.6 web
```

If Harness is already running, restart it after installation. Then create or open a Session, send an ordinary agent request, and select the **Context Taxonomy** tab. The plugin records calls made after installation and cannot reconstruct older calls. Installation modifies only the local Web profile, normally under `$DSH_HOME/profiles/web` or `~/.dsh/profiles/web` when `DSH_HOME` is unset.

The bundle is Web-only because it uses the Web profile's storage-domain, API Gateway, client-module, and conversation-view services. New ordinary agent-loop calls are followed automatically; selecting an older call pins the view until **Jump to latest** is used.

## Other installation paths

For local development, pack the repository and install the resulting tarball:

```sh
pnpm install --ignore-scripts
pnpm run build
pnpm run test
pnpm --filter @artificialnotimbecile/dsh-context-taxonomy pack --pack-destination "$PWD"
npx @deepseek-ai/dsh@0.1.0-rc.6 plugin --profile web add ./artificialnotimbecile-dsh-context-taxonomy-0.1.0.tgz
```

A pinned Git source install can target the workspace subdirectory:

```sh
npx @deepseek-ai/dsh@0.1.0-rc.6 plugin --profile web add \
  'github:ArtificialNotImbecile/dsh-context-taxonomy#v0.1.0&path:packages/dsh-context-taxonomy'
```

This runs the package's `prepare` build. The first attempt stops safely and prints the exact codeload URL + commit + workspace-path key pnpm 11 requires under `allowBuilds` in the Web profile's `pnpm-workspace.yaml`; review the pinned source, add that exact key, then repeat the command. A package-name-only entry is insufficient for Git dependencies. The precompiled npm package is the normal installation path.

## Configuration

The bundle patch supplies these explicit defaults:

| Field | Default | Meaning |
| --- | --- | --- |
| `root` | `$DSH_HOME/context-taxonomy` | Absolute private sidecar directory. |
| `captureContent` | `sanitized` | Store sanitized logical JSON; `structure-only` stores summaries only. |
| `retentionDays` | `30` | Maximum settled-capture age. |
| `maxCapturesPerSession` | `200` | Maximum settled rows per Session lifecycle. |
| `maxStoredBytes` | `536870912` | Global compressed-blob budget. |
| `maxCaptureBytes` | `16777216` | Maximum sanitized bytes for one blob. Larger calls keep a summary with `omitted-size-limit`. |
| `maxPendingCaptures` | `64` | Background capture admission cap. Full queues omit new captures without changing the model stream. |
| `extraRedactKeyPatterns` | `[]` | Additional case-insensitive Unicode regular expressions for object keys. |

The logical-request and RPC schemas use `formatVersion: 1`, `taxonomyVersion: 1`, and `source: "dsh-logical-call"`. Captures are fenced by Session id, creation time, and working directory so a reused id cannot read an older lifecycle's sidecar.

## Privacy and retention

Installation is the opt-in. The default bundle stores sanitized logical JSON locally for 30 days, up to 200 captures per Session lifecycle, 512 MiB globally, and 16 MiB per capture. The private data directory uses mode `0700`; gzip blobs use `0600`. Built-in secret-key, bearer token, credential query, data URL, and large-base64 redaction cannot be disabled. The plugin does not provide at-rest encryption or a delete Remote in v1.

The UI labels provider-reported usage as actual and category composition as estimated. A cache usage field only records what the downstream usage chunk disclosed; it does not identify which section hit a provider cache. The DeepSeek reasoning check evaluates logical messages only and is not evidence about serialized provider content.

## License

MIT
