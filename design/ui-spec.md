# Context Taxonomy 面板 UI 规格 / UI Specification

- 版本 Version: 1.0 (2026-08-14)
- 状态 Status: 可实施 Ready for implementation(无待决问题 no open questions)
- 范围 Scope: DeepSeek Harness Web 客户端的只读检查面板;本文件不写生产 React,只规定设计契约
- 交互原型 Prototype: [`prototype/index.html`](prototype/index.html)(无依赖静态页)
- 状态矩阵 State matrix: [`state-matrix.md`](state-matrix.md)

---

## 1. 产品定位与真实性契约 · Product scope & honesty contract

### 1.1 这是什么 · What this is

Context Taxonomy 是 DeepSeek Harness 的 Web-profile 插件提供的只读面板。它记录并解释普通 agent-loop 调用提交到 Harness 公开 `llm/stream` waterfall 的**provider 中立逻辑请求**(`GenerateOptions`),以及流经同一 waterfall 的流式响应块(`StreamChunk`)。

Context Taxonomy is a read-only panel, delivered by a Web-profile plugin for DeepSeek Harness, that records and explains the provider-neutral **logical requests** (`GenerateOptions`) that ordinary agent-loop calls submit to Harness's public `llm/stream` waterfall, together with the `StreamChunk` sequence that flows back through the same waterfall.

面板展示的数据只有三个来源,全部来自 Harness 官方插件 API 可达的位置:

| 数据 | 来源 | 说明 |
| --- | --- | --- |
| 逻辑请求(logical request) | `llm/stream` waterfall 入参 `GenerateOptions`(`packages/llm/llm/src/types.ts:320`):`provider`、`model`、`reasoningEffort`、`messages`、`system`、`tools`、`temperature`、`maxTokens`、`stop`、`purpose` | 发送前已完整组装冻结,因此 running 中的调用也有完整上下文树 |
| 响应与状态 | 同一 waterfall 返回的 `StreamChunk` 序列(`types.ts:291`):block 增量、`usage`、终结 `finish`(`stop` / `tool-calls` / `max-tokens` / `aborted` / `error`) | 生命周期状态的唯一权威来源 |
| 用量(usage) | `StreamChunk { type:'usage', usage: TokenUsage }`(`types.ts:135`):`inputTokens`、`outputTokens`、`cacheReadTokens?`、`cacheWriteTokens?`、`reasoningTokens?` | 仅当 provider 经适配器上报才存在;缺失时面板必须显式说明 |

### 1.2 永不声称什么 · What this never claims

以下文案禁令是硬性契约,适用于所有界面文本、tooltip、aria-label 与文档:

1. **不是 wire capture。** 本面板不观察、不重建、不暗示 provider 的 HTTP body、请求头、endpoint 或传输过程。禁止出现 "wire"、"HTTP 请求体"、"payload 抓取"、"exact bytes sent" 等措辞。统一用词:**逻辑请求 logical request**。
2. **不是 provider payload 原文。** 分类树中的路径(如 `$.messages[2].content[0]`)是**逻辑路径 logical path**,指向记录的逻辑请求文档,不是任何 provider 的线上报文路径。文案必须写 "logical path",禁止只写 "payload path"。
3. **用量缺失要说缺失。** provider 未上报 usage 时显示 "未返回用量 No usage reported",绝不把估算值伪装成实际值。估算值永远带 "估算 estimated" 限定词。
4. **重建要说重建。** 会话日志不完整、分类为近似重建时,显示 "重建的近似结果 Reconstructed approximation" 标记(沿用 pi-desktop 既有文案)。
5. **不可见要说不可见。** 在 LLM 派发前失败、或在本监听器之前被拦截的调用对本插件不可见;空状态必须如实说明,不得暗示 "没有任何活动"。
6. **脱敏是构造性保证。** 密钥只存在于传输层请求头,从不进入 `llm/stream` waterfall;面板据此声明 "已脱敏 sanitized",但不得宣称做了事后擦除。复制功能复制的是同一份逻辑请求记录。

### 1.3 术语 · Terminology(全面板统一)

| 术语 | EN | 定义 |
| --- | --- | --- |
| 逻辑调用 | logical call | 一次 `llm/stream` 调用,以 `(turn, step)` 标识;同一步内的重试是同一逻辑调用的多次**尝试 attempt** |
| 逻辑请求 | logical request | 该调用提交的 `GenerateOptions` 记录 |
| 尝试 | attempt | 一次 provider 实际执行;首次执行为 attempt 1,重试递增 |
| 用量 | usage | provider 上报的 `TokenUsage`;缺失即 "未返回用量" |
| 桶 | bucket | 上下文份额的展示分类(§4.3),比内部分类 kind 粗 |
| 已脱敏 | sanitized | 记录自构造起不含密钥(§1.2-6) |

---

## 2. 信息架构 · Information architecture

面板可停靠右侧(240–720px 宽)或整页展示;两种形态共享同一 DOM 结构,仅容器宽度不同。自上而下五个区:

```
┌─ A 身份栏(吸顶)─────────────────────────── provider/model · 来源徽标 · 调用切换器 · 跟进最新
├─ B 预算卡 ──────────────────────────────── 总量 · 组成条 · 图例筛选 · 状态芯片(可展开详情)
├─ C 工具栏(吸顶)─────────────────────────── 筛选输入 · 全部展开/收起
├─ D 分类树 ──────────────────────────────── 组 → 条目 → 部分 → 正文(只有叶子正文带盒子)
└─ E 逻辑请求(已脱敏)────────────────────── 虚线折叠盒 · 结构摘要 · 分页加载 · 复制
```

布局沿袭 pi-desktop `ContextTaxonomyView.tsx` 的三区原则(身份栏 / 预算卡承载全部诊断 / 内容树),并为本产品增加两个一级元素:**调用切换器**(一个 turn 内多次逻辑调用)与**跟进最新**(流式追加时的选择语义)。视觉深度规则不变:组 → 条目 → 部分 → 正文逐级变轻,只有叶子正文带边框盒。

Zones: **A** identity header (sticky) · **B** budget card (owns every diagnostic) · **C** toolbar (sticky) · **D** taxonomy tree (group → item → part → body, lighter with depth) · **E** sanitized logical request (dashed disclosure box). New to this product vs the pi-desktop reference: the **call switcher** (several logical calls per turn) and **Follow latest** (selection semantics while calls append live).

---

## 3. 设计令牌 · Design tokens

### 3.1 消费规则 · Consumption rules

遵循 `docs/web-styling.md`(deepseek-harness):

- 特性组件 CSS **只消费 `--dsw-alias-*` 语义令牌**,不得抄录静态色板值或书写字面颜色;主题分支(`body[data-ds-dark-theme]`)只属于 ui-theme,特性 CSS 不出现主题选择器。
- 桶色(--ctx-kind-*)是本组件的表现契约,按 web-styling.md 的"组件级自定义属性"条款定义在组件作用域;数值见 §3.3,来源逐行列出。
- 字号必须搭配行高;有匹配角色时用 `--dsw-font-*` 变量。
- 源码、JSON、路径等需要保列的内容不换行,滚动条样式复用 ui-theme 共享皮肤(`scrollbar.css` 的 `--dsh-scrollbar-*` 间接层)。
- 表现全部进 CSS;内联样式只允许传组件级自定义属性值,不得编码主题分支。

### 3.2 语义令牌映射 · Semantic token mapping

| 用途 | 令牌 |
| --- | --- |
| 面板底 / 卡片底 | `--dsw-alias-bg-base` / `--dsw-alias-bg-layer-1` |
| 正文主色 / 次级 / 三级 / 说明 | `--dsw-alias-label-primary` / `-secondary` / `-tertiary` / `--dsw-alias-label-caption` |
| 分隔线(弱→强) | `--dsw-alias-border-l1` → `--dsw-alias-border-l4` |
| 悬停 / 选中底 | `--dsw-alias-interactive-bg-hover` / `-active` |
| 品牌/链接 | `--dsw-alias-state-business-primary`(dark 自动切 400 阶) |
| 成功 / 警告 / 错误 | `--dsw-alias-state-success-*` / `-warn-*` / `-error-*` |
| 代码块底 | `--dsw-alias-markdown-code-block`(JSON 高亮用 `--shiki-*` 令牌,与 `shiki.css` 一致) |
| 阴影(浮层) | `--dsw-shadow-lv2` |
| 字族 | `--dsw-font-family` / `--ds-font-family-code`(`base.css`) |
| 动效 | `--ds-transition-duration-fast`(0.1s)/ `--ds-transition-duration`(0.2s)+ `--ds-ease-in-out` |

### 3.3 桶色 · Bucket colors

颜色在面板里只表达一件事:一段上下文属于哪个桶。同一颜色贯穿组成条、图例、条目边轨、部分标签。亮主题 9 色取自 pi-desktop 既有 `--kind-*`(`styles.css:2418-2426`,`text` 桶对齐 dsw deepseek 品牌蓝);暗主题为本文档提出的派生值,优先复用 ui-theme 既有令牌(shiki 深色阶 / dsw 静态阶),无对应阶的标注"派生"。

Colour means exactly one thing here — which bucket a span of context falls into — shared by the composition bar, legend, item rail and part tag. Light values are the pi-desktop `--kind-*` set; dark values are proposed derivations that reuse existing ui-theme steps wherever a hue match exists.

| 桶 bucket | 亮 light(来源) | 暗 dark(来源) | 文本对比度* |
| --- | --- | --- | --- |
| instructions 指令 | `#55606e`(pi) | `#9aa5b1`(派生) | 6.39 / 7.29 |
| text 文本 | `#4176e6`(dsw `deepseek-500`) | `#679efe`(dsw `deepseek-400`) | 见 -ink / 5.90 |
| reasoning 推理 | `#0b7c86`(pi) | `#4cc3ce`(派生) | 4.95 / 7.47 |
| tool_call 工具调用 | `#6b4ec8`(pi) | `#b197fc`(shiki `token-function` 暗阶) | 5.92 / 6.50 |
| tool_definition 工具定义 | `#a4479a`(pi) | `#c57fbd`(派生) | 5.32 / 5.34 |
| tool_result 工具结果 | `#00843a`(pi) | `#69db7c`(shiki `token-string` 暗阶) | 4.81 / 8.98 |
| attachment 附件 | `#b05a00`(pi) | `#ffa94d`(shiki `token-parameter` 暗阶) | 4.87 / 8.24 |
| options 选项与元数据 | `#8a8a8a`(pi) | `#a2a4a6`(dsw `neutral-400`) | 见 -ink / 6.27 |
| unknown 未知 | `#c8452f`(pi) | `#d9705a`(派生) | 4.83 / 4.79 |

\* 列为"作为文字(部分标签,11px 等宽)在面板底色上的 WCAG 对比度,亮/暗"。图形用途(组成条段、图例方块、2px 边轨)只需 ≥3:1,全部满足。亮主题下 `text`、`options` 两桶的文字形态使用加深变体:`--ctx-kind-text-ink: var(--dsw-static-deepseek-600)`(5.39:1)、`--ctx-kind-options-ink: #6e6e6e`(5.10:1);暗主题文字形态直接用表列值。以上数值经 WCAG 2.x 相对亮度公式核算。

### 3.4 字级 · Type scale(字号/行高/字重,面板为密集检查器,沿用 pi-desktop 密度)

| 角色 | 规格 | 备注 |
| --- | --- | --- |
| 总量数字 | 25px/1,600,letter-spacing −0.03em,`tabular-nums` | pi 既有 |
| 条目标题 | 12px/18px,550 | `font-synthesis: style` 下 550 落到 500,符合 base.css 注释 |
| 部分标题 / 正文 | 11.5px/18px(正文行高 1.55) | |
| 图例/芯片/工具栏 | 11–11.5px/18px | |
| 元信息/路径/标签 | 10.5px/16px,等宽字族 | |
| 组名 | 10.5px/16px,等宽,大写,字距 0.1em | 中文不落大写,仅字距生效 |

### 3.5 间距、圆角、动效 · Spacing, radius, motion

- 间距步进 4px(4/6/8/12/16);圆角:芯片 5px、卡片与正文盒 6px、吸顶栏 0。
- 吸顶高度:`--ctx-head-height: 58px`、`--ctx-toolbar-height: 42px`(≤320px 容器时头栏变 82px,见 §8),组标题吸顶偏移 = 两者之和。
- 动效:chevron 旋转 120ms、hover/淡入 100–120ms,全部 `--ds-ease-in-out`;`prefers-reduced-motion: reduce` 时全部降为 0ms 且不播放 StateDot 追逐动画(静态圆点代替)。

---

## 4. 区域规格 · Zone specifications

### 4.1 A 区 · 身份栏 Identity header(吸顶,z-index 3)

内容(两行):

- 行 1:`{provider}/{model}`(13px 半粗,省略号截断,`title` 悬浮全文)+ 条件徽标(仅异常时)+ **调用切换器** + **跟进最新**开关。
- 行 2(元信息,等宽 11px,`label-caption`):来源标识 `逻辑请求 · llm/stream` / `logical request · llm/stream`(恒显首项)· `第 {turn} 轮 · 调用 {step}` · 状态点 + 状态文案 · 开始时刻(HH:MM:SS,本地化)· 耗时(running 为计时中,完成为毫秒/秒)。

来源标识恒在行 2 首项,不占行 1(行 1 空间留给切换器;原型实测 360px 下行 1 徽标会把切换器压到只剩两个按钮)。异常徽标出现在行 1(永远只在需要注意时显示):

| 条件 | 徽标 | 文案(zh / en) |
| --- | --- | --- |
| 记录完整 | 无徽标;行 2 首项来源标识 | `逻辑请求 · llm/stream` / `logical request · llm/stream` |
| 日志不完整、近似重建 | 危险色描边药丸(沿用 pi `approximate` 样式) | `重建的近似结果` / `Reconstructed approximation` |
| 记录损坏 | 警告色描边药丸 | `损坏` / `Corrupt` |

**调用切换器 call switcher**:分段控件(`role="group"`,`aria-label` = "本轮逻辑调用 / Logical calls in this turn"),每个逻辑调用一个按钮,内容 = 序号 + StateDot 状态点(`ui-primitives` StateDot:running=追逐矩阵,complete=done,error=error,aborted/interrupted=warning);当前项 `aria-pressed="true"`,`aria-label` = "调用 {n},共 {m} 个,{状态}" / "Call {n} of {m}, {status}"。键盘:`←/→` 在按钮间移动并选中(roving tabindex),`Home/End` 跳首尾;Tab 只停一次。调用数过多时横向滚动不换行。

**跟进最新 Follow latest**:切换器右侧的开关按钮(`aria-pressed`),图标 + 文案"跟进最新 / Follow latest"。语义见 §5.1。当跟进关闭且有更新调用到达,按钮带"新"角标(`aria-describedby` 说明"有 {n} 个新调用 / {n} new calls")。

### 4.2 B 区 · 预算卡 Budget card

1. **总量行**:主数字(25px tabular-nums)= provider 上报输入 tokens(`inputTokens + cacheReadTokens + cacheWriteTokens`,三者互斥见 `TokenUsage` 文档注释)或估算值;标签区分 `实际输入 tokens actual input tokens` / `估算输入 tokens estimated input tokens`;有实际值时右侧小字 `est. {估算} · {±x.x%}`(沿用 pi 格式)。running 中只显示估算并标注。未返回用量:主数字=估算,标签 `估算输入 tokens`,并出现用量芯片(§state-matrix)。
2. **组成条**:10px 高圆角 3px 分段条,`aria-hidden="true"`(信息由图例列表承载);筛选激活时其他段 `opacity .22`。
3. **图例**:`<ul>`,每项一个按钮(色块 + 桶名 + tokens + 百分比),`aria-pressed` 表筛选态,点击切换桶筛选(再点取消);行格 `8px minmax(0,1fr) auto 34px`。
4. **状态芯片行**: chips(`aria-expanded` 控制详情卡),tone:ok/neutral/bad/warn;只有需要注意的才带色(pi 原则:通过的检查是事实不是警报)。固定候选:缓存命中率(有 cacheRead/Write 时)、推理保留校验(有 reasoning 块时)、未分类字段(有 unknown 桶时)、重建近似、未返回用量、重试信息。详情卡 = 标题句 + 一句解释 + 键值对(tabular-nums),链接用品牌色。

### 4.3 C 区 · 工具栏 Toolbar(吸顶,z-index 2)

- 筛选输入:`type="search"`,占位"筛选条目和路径 / Filter items and paths",`aria-label` 同义完整句;匹配条目标题、角色、kind、逻辑路径及嵌套部分路径(与 pi `searchText` 口径一致)。
- 右侧:全部展开/收起按钮(单一按钮切换文案)。

### 4.4 D 区 · 分类树 Taxonomy tree

层级:`section`(组,`aria-label`=组名)> `details.taxonomy-item`(条目)> `details.taxonomy-part`(部分)> 正文盒。组标题吸顶(z-index 1):组名(等宽大写)+ 条目数 + 占比。

- **条目行**:14px chevron + 标题(截断) + tokens;左侧 2px 桶色边轨(`--ctx-kind-*`);hover 底 `--dsw-alias-interactive-bg-hover`。
- **条目体**:元信息行(角色、折叠的信封字段数 `+{n} envelope fields`、逻辑路径)> 部分列表或直接正文。
- **部分行**:chevron + 等宽标签(part kind,桶色文字)+ 标题 + tokens。
- **正文盒**:唯一带边框盒的层;markdown 11.5px/1.55;JSON 用 shiki 令牌高亮,`max-height 300px` 内部滚动,保列不换行。
- **逻辑路径**:左侧截断(`direction: rtl`)+ `<bdi>` 隔离,保证 `$.tools[0]` 不错排(pi-desktop 既有技巧,注释见 `ContextTaxonomyView.tsx:496-505`)。
- **信封折叠**:消息信封字段(role、tool_call_id 等 metadata 部分)计入 tokens 与组成,但不占树行,折进元信息行 `+{n} 个信封字段`。
- **默认展开**:仅"当前用户提示"条目;推理校验失败时追加展开含 reasoning 部分的条目(沿用 pi 策略:面板打开是一张地图,不是倾倒)。

### 4.5 E 区 · 逻辑请求(已脱敏)Logical request (sanitized)

虚线描边 `details`(与树视觉分离),摘要行:chevron + 标题"逻辑请求(已脱敏)/ Logical request (sanitized)" + 小字 `{状态} · {字节数} 字节` + 顶层键顺序(`messages → tools → temperature …`)。体内:

- 结构摘要:`{n} 条消息 · {m} 个工具 · 逻辑字段顺序` + 顶层键序列(chip 化 `code`)。
- JSON 分页:首段自动加载;按钮"加载下一段 / Load next chunk"(生产步长 **64 KiB**;原型用 1 KiB 演示分页机制)。已加载/总字节进度小字。
- 操作:复制全部(`quiet/ghost sm` 按钮;1.4s "已复制 copied" 反馈,`aria-live="polite"`)。
- 诚实标注(固定一行小字):`记录自 llm/stream 的逻辑请求,非 provider 线上报文` / `Logical request recorded at llm/stream, not the provider's wire payload`。
- 异常形态(unavailable / oversize / corrupt)见 state-matrix,均在盒内联展示,不弹窗。

---

## 5. 交互行为 · Interaction behavior

### 5.1 跟进最新 Follow-latest 状态机

```
[ON] ──用户点选某调用──▶ [OFF(钉住)] ──点"跟进最新"──▶ [ON](跳到最新)
[ON] ──新调用到达──▶ [ON]:选择自动推进到最新;列表追加;live 区播报
[OFF] ──新调用到达──▶ [OFF]:选择不动;跟进按钮角标 +1;live 区播报
```

- 默认 ON;turn 结束(所有调用终结)后保持当前选择,角标清零。
- 选择变化即重渲染 B–E 区;A 区元信息与切换器同步。
- 播报用 `aria-live="polite"` 独立 visually-hidden 区:"已切换到调用 {n}" / "Switched to call {n}";"新调用 {n} 已开始" / "Call {n} started"。

### 5.2 调用选择 Call selection

切换器点击/方向键即选;选择是单态(radio 语义,用 `aria-pressed` 于 group 内实现,与 pi 一致)。选择变化不清空筛选与展开状态(用户上下文比面板状态值钱)。

### 5.3 筛选 Filtering

文本筛选与桶筛选可叠加,AND 语义;命中条目保留其组壳;组内为空则整组隐藏;全空显示 filter-empty 态(见 state-matrix)并提供"清除筛选"按钮。筛选中"全部展开"只作用于可见项。

### 5.4 分页与复制 Paging & copy

- "加载下一段"期间按钮进 loading 态(禁用 + 文案"加载中… Loading…"),错误内联展示并提供重试;`done` 后按钮消失,显示完整字节数。
- "复制全部"自动取齐剩余段再写剪贴板;失败内联报错。复制内容 = 已脱敏逻辑请求 JSON 文本,不含任何面板装饰。

### 5.5 树开合 Tree disclosure

原生 `details/summary`;chevron 90° 旋转;"全部展开/收起"同步所有 `details`;状态记忆在面板会话内有效(切换调用不清空,刷新不保留)。

---

## 6. 无障碍 · Accessibility(WCAG 2.2 AA)

### 6.1 键盘 Keyboard

| 位置 | 键 | 行为 |
| --- | --- | --- |
| 全局 | Tab / Shift+Tab | 序贯经过:切换器 → 跟进 → 图例按钮 → 芯片 → 筛选框 → 展开全部 → 各 summary → E 区 |
| 调用切换器 | ← → Home End | 组内移动并选中(roving tabindex,Tab 只入组一次) |
| 图例/芯片/按钮 | Enter / Space | 触发(原生 button) |
| 树条目/部分/E 区 | Enter / Space | 开合(原生 summary);←/→ 不绑定(保持原生语义) |
| 筛选框 | Esc | 清空并复原列表;焦点留在框内 |

### 6.2 ARIA

- 面板根:`role="region"`,`aria-label`="上下文分类 Context taxonomy";`aria-busy` 于 loading。
- 树容器:`aria-label`="派生上下文分类 Derived context taxonomy";组用 `section` + `aria-label`(不套 `role="tree"`:交互是 disclosures 而非树栅格,避免错误的键盘预期)。
- 组成条 `aria-hidden`;数据由图例 `<ul>` 承载。
- 切换器:`role="group"` + 每钮 `aria-pressed` + 完整 `aria-label`。
- 状态变化(切换调用、新调用、复制结果、加载错误):`aria-live="polite"`;仅"调用失败"用 `role="alert"`(assertive),因为用户可能在等待。
- 所有图标/色点 `aria-hidden`,状态永远有文字伴随(色彩不作为唯一信息通道:状态点 + 文案;桶色 + 桶名)。
- focus-visible:2px `--dsw-alias-state-business-primary` 外描边,offset 2px,全局不压制。

### 6.3 其他 Other

- 对比度:正文 ≥4.5:1,大字/图标/控件边界 ≥3:1;桶色见 §3.3 表(已核算)。
- 触控目标:切换器按钮 24×24px 最小(WCAG 2.5.8),其余可点行 ≥26px 高。
- reduced motion:见 §3.5。
- 数字:`tabular-nums` + 本地化千分位(`toLocaleString` 跟随界面语言)。
- 中英文:等宽元信息行允许横向截断不换行;中文文案不使用英文大写样式;所有截断带 `title`(悬停全文)。

---

## 7. 响应式 · Responsive

- 最小宽度 **240px**;布局 keyed off 面板容器(`container: ctx / inline-size`),不是视口——面板可独立拖宽。
- `≤320px`(容器查询):头栏两行变三行(切换器独占一行,吸顶高 82px);隐藏条目 tokens 列与组占比;切换器横向滚动;图例百分比列收窄。
- `≥560px`:不拉大信息密度,仅总量行与图例获得更多呼吸位;树保持单列(检查器不做多栏)。
- 整页形态:最大内容宽 900px 居中,其余规则相同。

## 8. 主题 · Themes

亮/暗由 ui-theme 的 `body[data-ds-dark-theme]` 切换;本组件零主题分支。暗主题只影响:语义令牌(自动)、桶色(§3.3 组件作用域内 `body[data-ds-dark-theme] &` 一条重绑——作为组件级属性契约登记,待 ui-theme 收编)、shiki 高亮(自动)。原型用 `data-theme` 演示同一机制。

---

## 9. 数据契约(UI 消费面)· Data contract consumed by the UI

```jsonc
LogicalCallRecord {
  id: string; turn: number; step: number;      // 逻辑调用身份
  attempt: number;                              // ≥1,重试递增
  provider: string; model: string;
  startedAt: number; endedAt?: number;          // epoch ms
  status: "running" | "success" | "error" | "aborted" | "interrupted";
  finish?: "stop" | "tool-calls" | "max-tokens";// success 的细分
  failure?: { message; code; status?; retryAfterMs?; requestId? };  // error/aborted
  retry?: { scheduled: boolean; ordinal: number; max?: number; delayMs?: number };
  usage?: TokenUsage;                           // 缺省 = 未返回用量
  estimate: { inputTokens: number };            // 面板自算,永标"估算"
  source: "stream-record" | "reconstructed";    // 后者触发近似徽标
  recordCompleteness: "complete" | "degraded" | "corrupt";
  taxonomy: { groups: [...] };                  // §4.4 的树数据
  raw: { state: "available" | "unavailable" | "oversize" | "corrupt";
         byteCount?: number; sha256?: string; topLevelOrder: string[];
         messageCount?: number; toolCount?: number };
}
```

派生规则:status 由 `StreamChunk` 终结帧与崩溃恢复标记决定;`interrupted` 仅在重载时发现孤儿运行记录;usage 只在 `usage` chunk 到达后存在。完整状态推演见 [`state-matrix.md`](state-matrix.md)。

---

## 10. 文案总表 · Copy deck(全量,zh / en)

| 键 | 中文 | English |
| --- | --- | --- |
| panel.title | 上下文分类 | Context taxonomy |
| panel.region | 上下文分类 | Context taxonomy |
| tree.label | 派生上下文分类 | Derived context taxonomy |
| header.source | 逻辑请求 · llm/stream | logical request · llm/stream |
| header.reconstructed | 重建的近似结果 | Reconstructed approximation |
| header.turnStep | 第 {turn} 轮 · 调用 {step} | Turn {turn} · call {step} |
| switcher.group | 本轮逻辑调用 | Logical calls in this turn |
| switcher.item | 调用 {n},共 {m} 个,{status} | Call {n} of {m}, {status} |
| follow.on | 跟进最新 | Follow latest |
| follow.new | 有 {n} 个新调用 | {n} new calls |
| follow.announce.switch | 已切换到调用 {n} | Switched to call {n} |
| follow.announce.new | 新调用 {n} 已开始 | Call {n} started |
| status.running | 进行中 | Running |
| status.success | 已完成 | Complete |
| status.error | 失败 | Failed |
| status.aborted | 已中止 | Aborted |
| status.interrupted | 已中断 | Interrupted |
| status.runningFor | 已进行 {duration} | Running for {duration} |
| status.took | 耗时 {duration} | Took {duration} |
| budget.actual | 实际输入 tokens | actual input tokens |
| budget.estimated | 估算输入 tokens | estimated input tokens |
| budget.estDelta | est. {estimate} · {delta} | est. {estimate} · {delta} |
| budget.composition | 估算上下文组成 | Estimated context composition |
| chip.cache | 缓存命中率 {rate}% | Cache {rate}% hit |
| chip.reasoning | 推理{status} | Reasoning {status} |
| reasoning.kept / .dropped / .notApplicable / .unknown | 已保留 / 已丢弃 / 不适用 / 未知 | kept / dropped / n/a / unknown |
| chip.unclassified | {n} 个未知字段 | {n} unknown fields |
| chip.noUsage | 未返回用量 | No usage reported |
| chip.retry | 重试 {ordinal}/{max} | Retry {ordinal}/{max} |
| filter.placeholder | 筛选条目和路径 | Filter items and paths |
| filter.aria | 筛选上下文条目和逻辑路径 | Filter context items and logical paths |
| tree.expandAll / .collapseAll | 全部展开 / 全部收起 | Expand all / Collapse all |
| tree.emptyFiltered | 没有匹配此筛选的上下文条目。 | No context items match this filter. |
| tree.clearFilter | 清除筛选 | Clear filter |
| tree.emptyNone | 此调用未记录到派生条目。 | This call recorded no derived items. |
| envelope.folded | +{n} 个信封字段 | +{n} envelope fields |
| raw.title | 逻辑请求(已脱敏) | Logical request (sanitized) |
| raw.summary | {state} · {bytes} 字节 | {state} · {bytes} bytes |
| raw.state.available / .oversize | 完整 / 超大 | complete / oversize |
| raw.state.unavailable / .corrupt | 不可用 / 损坏 | unavailable / corrupt |
| raw.note | 记录自 llm/stream 的逻辑请求,非 provider 线上报文 | Logical request recorded at llm/stream, not the provider's wire payload |
| raw.shape | {n} 条消息 · {m} 个工具 · 逻辑字段顺序 | {n} messages · {m} tools · logical field order |
| raw.loadNext | 加载下一段 | Load next chunk |
| raw.loading | 加载中… | Loading… |
| raw.progress | 已加载 {loaded}/{total} 字节 | {loaded}/{total} bytes loaded |
| raw.copyAll | 复制全部 | Copy full |
| raw.copied / .copyFailed | 已复制 / 复制失败 | copied / copy failed |
| raw.unavailableBody | 此调用的逻辑请求记录不可用(记录缺失或被截断)。 | The logical request record is unavailable for this call (missing or truncated record). |
| raw.oversizeBody | 记录共 {bytes} 字节,超出展示预算;仅分页展示前 {shown} 字节。 | The record is {bytes} bytes, over the display budget; only the first {shown} bytes are paged. |
| raw.corruptBody | 记录无法解析(结构损坏);可展示的内容如下。 | The record could not be parsed (corrupt structure); readable content is shown below. |
| group.instructions / .conversation / .prompt / .tools / .options / .unknown | 指令 / 对话 / 当前提示 / 工具 / 请求选项 / 未知字段 | Instructions / Conversation / Current prompt / Tools / Request options / Unknown fields |
| bucket.* (9 键) | 指令/文本/推理/工具调用/工具定义/工具结果/附件/选项与元数据/未知 | Instructions/Text/Reasoning/Tool calls/Tool definitions/Tool results/Attachments/Options & metadata/Unknown |
| item.turn | {role} 轮次 | {role} turn |
| role.user / .assistant / .tool / .system / .developer | 用户 / 助手 / 工具 / 系统 / 开发者 | User / Assistant / Tool / System / Developer |
| state.loading | 正在加载调用记录… | Loading call records… |
| state.empty | 此轮还没有逻辑调用。 | No logical calls in this turn yet. |
| state.emptyHint | 调用在派发前失败或被更早拦截时对本面板不可见。 | Calls that fail before dispatch, or are intercepted earlier, are not visible to this panel. |
| state.errorBody | 调用失败:{message}({code}) | Call failed: {message} ({code}) |
| state.retryHint | 将于 {seconds}s 后重试(第 {n} 次,共 {max} 次) | Retrying in {seconds}s (attempt {n} of {max}) |
| state.abortedBody | 调用被用户中止;已产生的输出保留在对话中。 | The call was aborted by the user; output produced so far is kept in the conversation. |
| state.interruptedBody | 应用重启后从会话记录恢复;该调用的最终状态未知。 | Recovered from the session record after an app restart; the call's final state is unknown. |
| state.noUsageBody | provider 未返回本次调用的用量;总量为估算值。 | The provider returned no usage for this call; totals are estimates. |
| demo.* | (仅原型演示镀铬,见 prototype) | (prototype demo chrome only) |

文案约束:中文顿号/冒号用全角;数字与单位间空格(en)或不空格(zh)按上表;"tokens" 在中文文案保留英文词(与 harness 既有 `stats.tokens` 一致:"输入 {input} tok · 输出 {output} tok" 风格为更短变体,本面板用完整词)。

---

## 11. 与既有代码的映射 · Mapping to existing code(不写生产 React,仅登记对应关系)

| 本规格元素 | 既有资产 |
| --- | --- |
| 三区/五区骨架、树、预算卡、筛选 | pi-desktop `ContextTaxonomyView.tsx` + `styles.css:2401-3231`(模式沿用,文案按 §1.2 修正) |
| 按钮(复制/加载/清除) | `ui-primitives` Button(sm,ghost/outline 变体) |
| 状态点 | `ui-primitives` StateDot(running=matrix,done/warning/error) |
| 输入框 | `ui-primitives` Input 的令牌与焦点态 |
| JSON 高亮 | ui-theme `shiki.css` 令牌 |
| 滚动条 | ui-theme `scrollbar.css` 共享皮肤 |
| 字族/动效/阴影 | ui-theme `base.css` / `gradient-shadow-text.css` |
| 生命周期词汇 | `llm/stream`:`FinishReasonMap`、`TokenUsage`、`GenerateOptions`;UI 状态词与 `ui-trajectory` 的 `running/complete/error` 对齐,增补 `aborted/interrupted`(turn 级) |

实现时样式落点:特性包内 CSS Module(如 `ContextTaxonomy.module.css`),仅消费 §3 令牌;不新增全局主题,不引入组件库或 Tailwind(web-styling.md 硬性条款)。
