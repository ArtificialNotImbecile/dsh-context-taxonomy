# DSH Context Taxonomy

[English](README.md) | 简体中文

> **看清 DeepSeek Harness 如何为每次普通 Agent 调用组装上下文。** 在同一个可探索界面中检查完整 System Prompt、对话历史、当前提示、工具定义、模型选项、token 构成、缓存用量与推理证据。

Context Taxonomy 是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的学习与调试插件。它通过 Harness 公开的 `llm/stream` 调度层观察 provider-neutral 的逻辑请求，将其中的内容整理成 taxonomy，并在会话旁提供独立的 **Context Taxonomy** 标签页。

![真实 DeepSeek Harness 会话打开 Context Taxonomy，检查组装后的 System Prompt、消息、工具、选项与 token 构成](https://raw.githubusercontent.com/ArtificialNotImbecile/dsh-context-taxonomy/codex-initial-plugin-assets/context-taxonomy-demo.gif)

_以上演示录制自官方 Harness `0.1.0-rc.6` Web profile 上的一次真实 DeepSeek-V4-Flash 调用，不是 mock 或测试 fixture。_

## 它与 Harness Trajectory 有什么区别

Context Taxonomy 是官方 [**Trajectory**](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/client/ui-trajectory) 视图的补充，不是替代品。两者都会展示 System Prompt、工具定义、请求选项和模型报告的 token 用量，但它们围绕不同问题组织这些信息。

| | Harness Trajectory | Context Taxonomy |
| --- | --- | --- |
| 核心问题 | Agent 执行过程中发生了什么，先后顺序如何？ | 这一次逻辑模型调用由哪些上下文组成？ |
| 组织方式 | 按 Turn/Step 展示 User、Assistant、Tool、Subtool、重试、压缩和计时的事件记录。 | 将每次调用分成 System、Conversation、Current prompt、Tools、Options 和 Unclassified。 |
| 最适合 | 跟踪执行流程、检查工具输入与结果、分析延迟、定位失败和重试。 | 解释 prompt 构成、上下文增长、暴露的工具 schema、消息来源以及意外的逻辑请求字段。 |
| 上下文分析 | 在执行记录旁展示已记录的 prompt、工具、选项、用量和 prompt 变化。 | 额外提供分类 token 估算、`MessageSource.kind` / `ContextForm` 来源、未分类字段、逻辑 reasoning 保留检查和已脱敏 canonical JSON。 |
| 覆盖范围与历史 | 从 Harness 官方 Session 数据重建时间线，包括 compaction。 | 只观察到达本插件 `llm/stream` listener 的普通 agent-loop 调用；排除辅助调用，也不能重建安装前的调用。 |
| 存储 | 使用 Harness 已保留的官方 Session 数据。 | 使用独立保留的已脱敏 sidecar，使每条被观察的逻辑调用可以单独检查。 |

需要了解模型回复、工具调用、嵌套工作、耗时、重试和 compaction 时，使用 **Trajectory**。需要理解某次请求为什么包含这些 prompt、哪些上下文和工具暴露给了模型、各类别占用了多少估算输入，或哪些字段不符合预期 taxonomy 时，使用 **Context Taxonomy**。两者配合使用，最适合完整学习和调试 Harness。

## 已安装 Harness 的用户快速开始

如果 `dsh --version` 已经可用，并显示 `0.1.0-rc.6`，将插件安装到 Web profile 后启动 Harness：

```sh
dsh plugin --profile web add @artificialnotimbecile/dsh-context-taxonomy@0.1.0
dsh web
```

如果 `dsh web` 已经运行，请在安装后停止并重新启动，使新 bundle 被加载。随后创建或打开 Session，发送一次普通 Agent 请求，再选择 **Context Taxonomy** 标签页。插件只能记录安装后发生的调用，无法还原更早的调用。

如果 `PATH` 中没有 `dsh`，可以使用固定版本的 `npx` 命令：

```sh
npx --yes @deepseek-ai/dsh@0.1.0-rc.6 plugin --profile web add @artificialnotimbecile/dsh-context-taxonomy@0.1.0
npx --yes @deepseek-ai/dsh@0.1.0-rc.6 web
```

较长的写法不会全局安装 Harness；`npx` 会从缓存运行固定版本的 CLI。两种方式中的 `plugin --profile web add` 都只会修改本地 Web profile。未设置 `DSH_HOME` 时，其位置通常是 `~/.dsh/profiles/web`。

## 它能帮助回答什么问题

- Harness 为这次调用组装了什么 System Prompt？
- 哪些消息属于对话历史、当前上下文或插件注入？
- 模型可以看到哪些工具及其 JSON schema？
- 使用了哪个 provider、模型、reasoning effort、采样选项和 token 上限？
- System Prompt、消息、工具和选项分别占了多少估算输入？
- Adapter 是否报告了 cache read、cache write 或 reasoning tokens？
- 重试或同一 Session 后续调用之间发生了什么变化？

因此，这个插件适合学习 Harness 架构、讲解插件开发、排查 prompt 膨胀、比较 Agent preset、审计工具暴露以及调查模型行为，而不必手工阅读原始 Session 日志。

插件会严格说明它观察到的范围：它**不会**捕获 provider HTTP payload、headers、endpoint、serializer 输出、真实 transport attempt 或投递状态。在 LLM dispatch 之前失败的调用，以及在本 listener 之前被截断的调用，都不可见。界面会把 provider 报告的用量标为 actual，把本地推导的构成标为 estimated。

## 可检查的内容

- System、Conversation、Current prompt、Tools、Options 和 Unclassified 分区。
- 消息携带的 DSH `MessageSource.kind` 与 `ContextForm` 来源。
- 模型报告的 prompt、cache、output 和 reasoning 用量；缺失字段不会伪装成零。
- 与实际用量明确区分的各分区估算构成。
- 只针对逻辑消息的 DeepSeek reasoning 保留检查，不会把它描述成 wire 证据。
- 支持惰性分页的已脱敏 canonical logical JSON。
- Harness 重启后仍保留的逐 Session capture。

### 一眼了解调用构成

![Context Taxonomy 总览展示实际输入用量、估算构成、缓存与推理证据和分类上下文树](https://raw.githubusercontent.com/ArtificialNotImbecile/dsh-context-taxonomy/codex-initial-plugin-assets/context-taxonomy-overview.png)

### 检查已脱敏逻辑请求

![惰性 Raw explorer 展示已脱敏 Harness 逻辑请求及明确的非 wire 提示](https://raw.githubusercontent.com/ArtificialNotImbecile/dsh-context-taxonomy/codex-initial-plugin-assets/context-taxonomy-logical-request.png)

## 从 GitHub 源码安装

首个版本仅支持 DeepSeek Harness `0.1.0-rc.6` 的 `web` profile。安装本身就是启用本地捕获的明确选择。

如需审计源码，请固定 release，并选择仓库中的可发布子目录：

```sh
npx @deepseek-ai/dsh@0.1.0-rc.6 plugin --profile web add \
  'github:ArtificialNotImbecile/dsh-context-taxonomy#v0.1.0&path:packages/dsh-context-taxonomy'
```

Git 安装会执行 package 的 `prepare` 构建。第一次尝试时，pnpm 11 会安全停止，并输出 `$DSH_HOME/profiles/web/pnpm-workspace.yaml` 中 `allowBuilds` 所需的准确 codeload URL、commit 和 workspace path key。检查固定版本的源码，加入这个准确 key 后，再次执行命令。仅按 package 名称添加 entry 不足以授权 Git dependency。推荐普通用户安装预编译的 npm release。

## 数据处理

紧凑索引使用 Harness `storageDomain`，已脱敏的逻辑 JSON 以私有 gzip blob 存在 `$DSH_HOME/context-taxonomy`。内置清洗会处理疑似 secret 的 key、Bearer credential、credential query parameter、data URL 和较大的 base64 内容，而且不能关闭。Hash 只会在脱敏后计算。

默认保留 30 天、每个 Session 生命周期 200 条 capture、全局 512 MiB、单条 16 MiB。目录权限为 `0700`，blob 权限为 `0600`。v1 不提供静态加密，也不提供修改或删除 Remote。

## 开发

```sh
pnpm install --ignore-scripts
pnpm run build
pnpm run test
pnpm run pack:plugin
```

仓库根目录是 private workspace，可发布 package 位于 [`packages/dsh-context-taxonomy`](packages/dsh-context-taxonomy)，Kimi K3 的 UI 规格与无框架 prototype 位于 [`design`](design)。

## License

MIT
