# 状态矩阵 · State Matrix

适用于 Context Taxonomy 面板(规格见 [`ui-spec.md`](ui-spec.md))。每个状态给出:检测依据(`llm/stream` 可观察证据)、A–E 各区表现、文案(zh/en)、ARIA 与键盘、可用操作、恢复路径。

状态轴(正交,可组合):

- **面板轴 panel**: `loading` → `ready` →(`error` 为快照级失败)
- **调用轴 call**(每个逻辑调用一个): `running` / `success` / `error` / `aborted` / `interrupted`
- **用量轴 usage**: `reported` / `no-usage`(仅终结后可判定)
- **记录轴 record**: `complete` / `reconstructed`(近似)/ `corrupt`
- **E 区轴 raw**: `available` / `unavailable` / `oversize` / `corrupt`
- **视图轴 view**: `unfiltered` / `filtered` / `filter-empty`

---

## 1. 总览矩阵 · Overview

| # | 状态 | 检测依据(权威来源) | 首要视觉 | 文案 zh | 文案 en | Live 播报 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | loading | 快照请求在途(UI 自有态) | 骨架行,`aria-busy` | 正在加载调用记录… | Loading call records… | 无(避免噪音) |
| 2 | empty | 快照 `calls.length === 0` | 空态插画位 + 说明 | 此轮还没有逻辑调用。 | No logical calls in this turn yet. | 无 |
| 3 | running | 已见 `GenerateOptions`,未见终结 `finish` 帧 | StateDot 矩阵动画 + 计时 | 进行中 | Running | 新调用开始时 polite |
| 4 | success | `finish` ∈ {stop, tool-calls, max-tokens} | 绿点;max-tokens 追加说明 | 已完成 | Complete | 无(进行中→完成不播报) |
| 5 | error | `finish.kind = 'error'`(含 `LlmFailure`) | 红点 + 错误详情卡 | 失败 | Failed | **assertive** |
| 6 | aborted | `finish.kind = 'aborted'`(用户在途取消) | 琥珀点 + 说明行 | 已中止 | Aborted | polite |
| 7 | interrupted | 重载后发现无终结帧的孤儿记录(崩溃恢复) | 琥珀点 + 说明行 | 已中断 | Interrupted | polite(恢复时一次) |
| 8 | no-usage | 终结后无 `usage` chunk | 总量标签改"估算" + 芯片 | 未返回用量 | No usage reported | 无 |
| 9 | raw unavailable | 记录 `raw.state = 'unavailable'` | E 区按钮禁用 + 说明 | 不可用 | unavailable | 无 |
| 10 | corrupt | 记录解析失败 `recordCompleteness='corrupt'` 或 `raw.state='corrupt'` | 警告详情卡(可展示部分仍展示) | 损坏 | corrupt | polite |
| 11 | oversize | `raw.byteCount > 展示预算`(256 KiB) | E 区内联截断说明 | 超大 | oversize | 无 |
| 12 | filter-empty | 筛选后可见条目 = 0 且存在筛选条件 | 树区空态 + 清除按钮 | 没有匹配此筛选的上下文条目。 | No context items match this filter. | 无 |

---

## 2. 分状态详情 · Per-state detail

### 2.1 loading(面板轴)

- **触发**:进入面板或切换 turn 后,调用记录快照未返回。
- **A 区**:骨架文本行(圆角灰条,`--dsw-alias-bg-skeleton`),切换器位置留空(不出现在骨架里,避免假控件)。根元素 `aria-busy="true"`。
- **B 区**:总量与组成条骨架;不出芯片。
- **C 区**:筛选框禁用(`disabled` + `aria-disabled`)。
- **D 区**:3 组 × 2 条骨架行(仅色条,无文本,避免编造)。
- **E 区**:整盒骨架。
- **操作**:全部不可用;焦点不落入骨架(Tab 跳过)。
- **恢复**:快照到达 → 按实际状态渲染;失败 → 快照级 error(A–E 整体错误卡 + 重试按钮,文案 `加载失败:{message} / Failed to load: {message}`)。
- **超时**:无 UI 自有超时;加载指示可持续,由连接层横幅(ui-primitives ConnectionBanner)承担断线表达。

### 2.2 empty(面板轴,ready 且无调用)

- **触发**:快照返回 `calls = []`(turn 未开始,或调用在派发前失败/被拦截)。
- **表现**:B–E 区整体替换为空态块(居中,`label-tertiary`):主文案 + 诚实提示(规格 §1.2-5)。
  - 主:`此轮还没有逻辑调用。` / `No logical calls in this turn yet.`
  - 副:`调用在派发前失败或被更早拦截时对本面板不可见。` / `Calls that fail before dispatch, or are intercepted earlier, are not visible to this panel.`
- **A 区**:保留(turn 身份真实存在);切换器显示空槽文案 `0 个调用 / 0 calls`,跟进开关禁用(`title` 说明"无可跟进调用")。
- **操作**:筛选框禁用;无其他。
- **恢复**:turn 开始 → 自动进入 running(经快照更新),live polite 播报 `新调用 1 已开始`。

### 2.3 running(调用轴)

- **检测**:记录存在(请求已在 `llm/stream` 组装冻结),未观察到终结 `finish`。
- **A 区**:状态点 = StateDot 矩阵追逐动画(reduced-motion 时为静态蓝点);元信息 `已进行 {duration} / Running for {duration}`(秒级 tick);切换器对应按钮带同样状态点。
- **B 区**:总量 = 估算值,标签 `估算输入 tokens estimated input tokens`;不出现缓存芯片(usage 未至);组成条照常(请求已完整,树可全量派生——这是诚实点:running ≠ 内容不全)。
- **D 区**:完整可浏览;默认展开"当前用户提示"。
- **E 区**:可加载(请求已冻结,记录完整)。
- **操作**:全部可用;跟进最新 ON 时选择会随新调用推进(§5.1)。
- **退出**:观察到 `finish` → 转 4/5/6;崩溃重载 → 7。

### 2.4 success(调用轴)

- **检测**:终结 `finish` ∈ {`stop`, `tool-calls`, `max-tokens`}。
- **A 区**:绿点;`耗时 {duration} / Took {duration}`;`max-tokens` 时状态文案 `已完成 · 达到输出上限` / `Complete · output limit reached`(事实陈述,不归入 error)。
- **B 区**:有 usage → 主数字 = 计费输入(input+cacheRead+cacheWrite),标签 `实际输入 tokens`,右侧 `est. {x} · {±%}`;有 cacheRead/Write → 缓存芯片(`缓存命中率 {rate}%`,detail 卡给 hit/miss/write/output 四行,字段名对齐 `TokenUsage`);有 reasoning 块 → 推理校验芯片。
- **D/E 区**:无变化。
- **注意**:success ∩ no-usage 见 2.8;success ∩ reconstructed 时 A 区挂近似徽标。

### 2.5 error(调用轴)

- **检测**:终结 `finish.kind='error'`,`LlmFailure { message, code, status?, providerRetryAfterMs?, requestId? }` 随记录可用。
- **A 区**:红点,`失败 Failed`。
- **B 区**:错误详情卡(默认展开,`role="alert"` 一次性播报):
  - 主行:`调用失败:{message}({code})` / `Call failed: {message} ({code})`
  - 键值:`status`(若有)、`requestId`(若有,等宽可复制)、`retryAfterMs`(若有)
  - 有重试:`将于 {seconds}s 后重试(第 {n} 次,共 {max} 次)` / `Retrying in {seconds}s (attempt {n} of {max})`,重试开始/取消随快照更新文案(对齐 ui-conversation `message.retry.*` 词表)。
- **D/E 区**:照常(请求已发出,上下文完整可见)。
- **操作**:重试是 Harness 自身行为,面板**不提供**重试按钮(只读原则);展示重试状态即可。
- **用量**:通常无 usage → 叠加 2.8。

### 2.6 aborted(调用轴)

- **检测**:终结 `finish.kind='aborted'`(用户取消经 `signal` 到达)。
- **表现**:琥珀点 + `已中止 Aborted`;说明行:`调用被用户中止;已产生的输出保留在对话中。` / `The call was aborted by the user; output produced so far is kept in the conversation.`
- **与 error 的视觉差异**:非故障色(琥珀,对齐 `state-warn-*`),不出 `role="alert"`,只有 polite 播报。
- **用量**:一般无 → 2.8;若 provider 在上报后中止(罕见),按 reported 展示。

### 2.7 interrupted(调用轴)

- **检测**:仅崩溃恢复路径——重载时发现无终结帧的孤儿运行记录。
- **表现**:琥珀点 + `已中断 Interrupted`;说明:`应用重启后从会话记录恢复;该调用的最终状态未知。` / `Recovered from the session record after an app restart; the call's final state is unknown.`
- **文案纪律**:不猜结果(不写"失败"或"已完成");usage 若有残片照常展示并标 `实际`——只有完整 `usage` chunk 落盘才算 reported。
- **恢复**:无自动恢复;新 turn 开始自然翻页。

### 2.8 no-usage(用量轴)

- **检测**:调用终结且记录中无 `usage`。
- **B 区**:主数字 = 估算,标签 `估算输入 tokens`;追加芯片 `未返回用量 No usage reported`(neutral tone,非错误),详情卡:`provider 未返回本次调用的用量;总量为估算值。` / `The provider returned no usage for this call; totals are estimates.`
- **不做什么**:不给缓存芯片、不给 est-vs-actual delta、不把估算写成"实际"。
- **组合**:可与 success/error/aborted/interrupted 叠加;running 期间不判定(用量本来就未到)。

### 2.9 raw unavailable(E 区轴)

- **检测**:`raw.state='unavailable'`(记录缺失,如旧格式会话或截断丢失)。
- **表现**:E 区保持可展开(结构摘要可能仍在);体内单行说明:`此调用的逻辑请求记录不可用(记录缺失或被截断)。` / `The logical request record is unavailable for this call (missing or truncated record).`;"加载下一段"与"复制全部"按钮禁用,`title`/`aria-describedby` 给出原因。
- **文案纪律**:不说"原始载荷",不说"wire"。

### 2.10 corrupt(记录轴 / E 区轴)

- **检测**:记录 JSON 解析失败或字段自相矛盾(`recordCompleteness='corrupt'`);E 区单独损坏为 `raw.state='corrupt'`。
- **表现**(尽力而为,诚实降级):
  - 调用级:A 区挂 `损坏 corrupt` 警告徽标;B 区警告详情卡 `记录无法解析(结构损坏);可展示的内容如下。` / `The record could not be parsed (corrupt structure); readable content is shown below.`;能解析的区照常渲染,不能解析的区整体替换为该说明。
  - E 区级:盒内同上说明 + 已读字节原文(等宽,`user-select: all`)。
- **播报**:polite 一次。
- **操作**:复制可用(复制已读部分,按钮文案不变);分页不可用。

### 2.11 oversize(E 区轴)

- **检测**:`raw.byteCount > 262144`(展示预算 256 KiB,组件常量,不是配置)。
- **表现**:E 区可分页加载前 256 KiB;首行内联说明:`记录共 {bytes} 字节,超出展示预算;仅分页展示前 {shown} 字节。` / `The record is {bytes} bytes, over the display budget; only the first {shown} bytes are paged.`;到达截断点后"加载下一段"消失,出现截断标记 `…(已截断 truncated)`。
- **复制**:复制全部仍取**完整记录**(分页是展示预算,不是数据丢失)——按钮旁小字注明 `复制不受截断影响 / Copy is not affected by truncation`。
- **树**:单条目正文同样适用:`max-height 300px` 滚动 + 超过 64 KiB 的单体文本截断 + 同款说明。

### 2.12 filter-empty(视图轴)

- **检测**:`(query ≠ "" 或 bucket ≠ null)` 且可见条目数 = 0。
- **表现**:D 区替换为居中说明 `没有匹配此筛选的上下文条目。` / `No context items match this filter.` + 次要按钮 `清除筛选 Clear filter`(点击清空 query 与桶筛选,焦点回筛选框)。
- **区分**:无任何筛选而树为空 = `tree.emptyNone`(`此调用未记录到派生条目。`),不出清除按钮。
- **A/B 区**:不受影响(组成条与图例仍反映未筛选全量,图例中激活的桶保持 pressed)。

---

## 3. 组合与优先级 · Combinations & precedence

- **同轴互斥,跨轴叠加**。例:`success ∩ no-usage ∩ reconstructed`、`error ∩ retry-scheduled`、`running ∩ oversize(E 区)` 均合法。
- A 区状态点优先级(同一调用多标记时):`error` > `interrupted` ≈ `aborted` > `running` > `success`;徽标行可同时挂"近似/损坏"与状态点,不冲突。
- 芯片行顺序固定:重建近似 → 损坏 → 重试 → 缓存 → 推理 → 未知字段 → 未返回用量(与 pi "诊断归属预算卡"原则一致,全部集中在 B 区)。
- 面板轴优先:loading 与快照级 error 覆盖一切调用轴渲染。

## 4. 转换与播报规则 · Transitions & announcements

| 转换 | 播报(polite 除非注明) |
| --- | --- |
| empty → running(首个调用) | `新调用 {n} 已开始 / Call {n} started` |
| running → success | 不播报(数字静默更新) |
| running → error | `调用 {n} 失败:{message}`(assertive,`role="alert"`) |
| running → aborted / interrupted | `调用 {n} 已中止/已中断` |
| 跟进 ON 自动切调用 | `已切换到调用 {n} / Switched to call {n}` |
| 跟进 OFF 有新调用 | `有 {n} 个新调用 / {n} new calls`(跟进按钮角标同步) |
| 复制成功/失败 | `已复制 / 复制失败`(按钮内联,1.4s) |
| 分页加载失败 | 内联错误 + 重试按钮,polite |

所有播报经一个 visually-hidden `aria-live="polite"` 区(assertive 用独立 `role="alert"` 区),150ms 去抖合并同类;不因播报移动焦点。
