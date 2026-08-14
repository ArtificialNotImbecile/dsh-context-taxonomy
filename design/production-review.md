# 生产界面视觉复核 · Production visual review

- 日期:2026-08-14 · 复核人:UI/UX 设计负责人
- 材料:本地真实生产截图(1280×720,亮主题,真实 DeepSeek 调用;等价实录发布在 README assets 分支)+ 只读源码 `packages/dsh-context-taxonomy/src/client/`(`ContextTaxonomyView.tsx`、`ContextTaxonomyView.module.css`、`controller.ts`、`locales.ts`)+ `design/ui-spec.md` / `state-matrix.md`
- 范围:仅视觉与交互复核,不改动任何实现。截图只覆盖"滚动到顶、亮主题、单个成功调用"一种形态;凡截图不足以判断的条目集中在文末 **Unknown**,不猜测。

## 总体判断

信息架构与 DSH 原生界面的融合是合格的:三区骨架(身份/预算/树)落位正确,令牌全部消费 `--dsw-*` 语义别名,真实性文案(`scope`、`raw.note`)达标。主要问题集中在三处:**吸顶层叠冲突会在滚动时盖住工具栏**(代码证据)、**类别色直接当小字文本色导致对比度不达标**(实测)、**组成条被警告色淹没,健康调用也显示三条诊断噪音**。

---

## P1 — 阻断级(建议下个迭代必须修)

### P1-1 吸顶层叠冲突:滚动后工具栏与组标题被身份栏盖住(代码证据,截图不可见)

`ContextTaxonomyView.module.css` 中 `.identity` 吸顶 `top: 0; z-index: 3`(38-47 行),`.toolbar` 吸顶 `top: 0; z-index: 2`(104-111 行),`.group > header` 吸顶 `top: 45px; z-index: 1`(122 行)。截图形态下 `.identity` 实际高约 96–110px(标题行 + select 行 + meta 行)。同一滚动容器内:

- 工具栏与身份栏同为 `top: 0`,滚动时两者叠合,`z-index 2 < 3`,**工具栏被身份栏整个遮住**,滚动中无法筛选;
- 组标题停在 `45px`,仍落在身份栏(~96px+)覆盖区内,`z-index 1 < 3`,**组标题同样被遮**;
- ≤360px 容器下身份栏变更高(168-171 行的纵向堆叠),问题加剧。

截图在滚动顶,不显示该问题;以上为 CSS 直接推论,建议以真机滚动复核确认。修法:三行吸顶偏移改为共享自定义属性(pi-desktop 的 `--taxonomy-head-height` / `--taxonomy-toolbar-height` 模式,ui-spec §3.5),窄断点同步抬高。

### P1-2 类别色用作小字文本,实测对比度全部不达 WCAG AA

`.parts summary code`(11.5px 类别色,144 行)、`.itemMeta` / `.callMeta` / `.raw > p`(10.5px `label-caption`,69/138/152 行)在白底上的实测对比度:

| 用途 | 令牌 | 实测 | 要求 |
| --- | --- | --- | --- |
| tools 类别标签文字 | `state-warn-primary` 琥珀 | **2.15:1** | ≥4.5:1 |
| current-prompt 类别标签文字 | `state-success-primary` 绿 | **2.28:1** | ≥4.5:1 |
| meta/路径/时间戳 | `label-caption` | **2.13:1** | ≥4.5:1 |

修法:文本形态使用加深变体(ui-spec §3.3 已给出模式:`text` 桶用 `deepseek-600` 5.39:1、`options` 桶用 `#6e6e6e` 5.10:1);meta 文本从 `label-caption` 提到 `label-tertiary`(5.80:1,实测)。图形用途(色块、边轨、条段)不受此限。

### P1-3 组成条被"警告色"淹没,色彩语义过载

截图中 Tools 占 7,712/9,591 ≈ 80%,整条组成条 80% 是琥珀色(`state-warn-primary`),Unclassified 用 `state-error-primary` 红(2-7 行)。**状态色被借作类别色**:每一次健康调用都呈现一大条"警告",红色又预留给"未分类",用户无法区分"类别占比"与"故障信号"。ui-spec §3.3 的 9 桶调色板刻意避开了 state 色。修法:类别色改用中立调色板(可沿用 spec 表),state 色只留给状态点与诊断。

### P1-4 树尾部被悬浮输入框盖住,且无法滚动脱出(截图可见)

截图中 CURRENT PROMPT 组的 "Current prompt" 条目被 "Message the agent" 悬浮输入框遮掉一半。`.tree` 的 `padding-bottom` 只有 `4px`(113 行),面板自身滚动(`overflow: auto`,10-11 行)也无法把最后约 120px 内容滚出遮挡区——**raw 区与末尾条目在该 tab 形态下实质不可达**。修法:树尾部 padding 提升到输入框占位高度以上(参考 ui-conversation 的 overlay composer seat 处理),或该 tab 下为面板预留底部安全区。

---

## P2 — 高优先(影响理解与一致性)

### P2-1 诊断芯片恒显,健康调用也有三条噪音

截图:"Cache evidence: read 0 · Unknown"、"Logical reasoning check: Not applicable"、"Unclassified: 0 items" 三芯片恒显(`ContextTaxonomyView.tsx` 301-313 行)。spec 与 pi-desktop 的共同原则是"只有需要注意的才出现";`0 items`、`Not applicable` 是事实不是警报。另 "read 0 · Unknown" 把"有字段值为 0"与"字段缺失 Unknown"混排在一枚芯片里,语义含糊。修法:缓存芯片仅在有 cache 字段时出现(缺字段时单枚 "No cache fields reported" 已够);reasoning 仅在 applicable 时出现;unclassified 仅在 count > 0 时出现;恒显期望改进位说明文字。

### P2-2 组成按 6 类别聚合,推理份额不可见

组成条/图例按 `system/conversation/current-prompt/tools/options/unclassified` 聚合(275-300 行),conversation 内的 reasoning / tool_call / tool_result 份额不可见。面板自带 "Logical reasoning check" 诊断,却让被检查对象的 token 占比无处可见——诊断与证据脱节。修法:conversation 内至少拆出 reasoning 份额(ui-spec §3.3 的桶模型),或在 reasoning 芯片详情卡内给出推理 tokens。

### P2-3 "Following latest" 是静态徽章但长得像按钮,且不可手动开关

`ContextTaxonomyView.tsx` 253-257 行:跟进中渲染 `<span class="followBadge">`,样式(58-65 行)与按钮同为描边药丸。**不可点的元素不应有按钮外观**;且用户在跟进态没有任何途径主动关闭跟进(spec §5.1 为 `aria-pressed` 开关),只能去 select 里选另一个调用。好的一面:controller 语义正确——手动选择自动钉住(`select` 默认 `followLatest=false`)、`jumpLatest` 恢复、`newerCount` 计数、钉住的调用消失后自动回落跟进(controller.ts 87-93、116-155 行)。修法:跟进徽章改为开关按钮(`aria-pressed`),非跟进态的 "Jump to latest (n)" 保持不变。

### P2-4 "Actual prompt tokens" 用词偏 wire 且中文未翻译

`tokens.actual` = "Actual prompt tokens" / "实际 prompt tokens"(locales.ts 40/119 行)。问题有二:(a) 全屏两处对同一量的命名不一致——面板叫 "prompt tokens",底部状态栏叫 "Input 7.7K tok";`TokenUsage` 字段名是 `inputTokens`,spec 文案为 "actual input tokens";(b) 中文案未翻译,"prompt tokens" 直嵌中文句。修法:统一为 "实际输入 tokens / actual input tokens"。同理 "Usage unknown / Usage 未知" 的 Usage 未翻译(41/120 行)。

### P2-5 两个灰色类别 + 灰色条轨,三色不可分辨

`--ctx-system: label-tertiary`、`--ctx-options: label-caption`、组成条轨道 `border-l1`(2-6、83 行)是三级不同的浅灰;截图中 System(深灰)与 Options(浅灰)图例色块仅凭明度区分,小份额时在条上几乎隐形。修法:options 换用有色相的中立色(spec 的 `#8a8a8a` 同样有此问题,建议两桶都调整),或给 options 加描边纹理。

---

## P3 — 打磨项

1. **图例缺百分比列**,筛选时非选中条段也无 dimmed 处理(spec §4.2-2/3 均有);"est. 9,591" 缺 `±x.x%` 差值。
2. **组标题只有计数没有占比**(截图 SYSTEM/CONVERSATION/CURRENT PROMPT 行右侧均只有 "1"),spec 为 计数+百分比。
3. **状态信息重复**:select 内 "Call 1 · Complete" 与 meta 行 "● Complete Turn 1 · Step 1 · Call 1" 重复;可接受,但 meta 行可省掉重复的状态词。
4. **死键与措辞**:`settled`、`filter.all`、`raw.disclosure` 三个 locale 键未被引用;"Logical reasoning check" 语义累赘(建议 "Reasoning retention");zh 的 `scope`/`raw.note` 保留英文 "payload"(建议 "这不是 provider 的 HTTP 请求体");`formatNumber`/`toLocaleTimeString` 未传界面语言,中英界面下数字分组跟随浏览器而非 UI 语言。
5. **条目行无 hover 反馈**(仅 button 有 hover),与 pi-desktop 行 hover 不一致。
6. **select 替代分段切换器是可接受的规模化取舍**(optgroup 按 Turn/Step 分组、选项带状态与重试序号,414 行实现清晰),代价是失去全部调用状态的同屏点阵概览;如调用数常态 ≤6,仍建议分段控件 + 状态点。
7. **raw 区缺结构摘要**(spec §4.5 的 messages/tools/顶层键顺序),摘要行只有标题 + state code。
8. **切换调用无播报**:live 区只播报 jumpLatest 可用与复制结果(397-400 行),spec 要求 polite 播报 "已切换到调用 {n}"。

---

## Unknown — 截图不足以判断(不猜测,建议补截图或真机复核)

1. **240px / ≤360px 窄形容器实际渲染**:CSS 有 360px 容器查询适配(167-176 行:纵向堆叠、单列图例、路径折行),但未经验证;P1-1 的吸顶冲突在窄形下几乎必然更糟。
2. **暗色主题**:截图为亮主题;类别色借用 state 色在暗色下会自动切阶(P1-3 的语义问题仍在,对比度问题可能变化)。
3. **键盘可达性与焦点可见性**:CSS 有 `focus-visible` 规则(33-36 行)、`/` 聚焦筛选、`Esc` 清筛选(代码 169-178 行),截图无法验证实际行为。
4. **滚动中的吸顶行为与轮询刷新时的布局稳定性**:P1-1 为静态 CSS 推论,未真机滚动确认;running 轮询(1s,controller 210-215 行)下的重渲染闪烁未知。
5. **屏幕阅读器实际播报**(live 区存在于代码,播报时机未知)、**raw 分页/复制在大记录下的表现**、**多调用时 select 的实际可用性**(本截图仅 1 个调用)。
6. **error / aborted / interrupted / no-usage / oversize 等状态的实际呈现**:代码路径齐全(failure 卡、role=alert/status、raw 六种非 available 文案),无截图佐证视觉质量。

---

## 做得对、应保持的

- 真实性文案:`scope`("…not a provider HTTP payload")、`raw.note`、空态的可见范围说明、用量缺失的 "Usage unknown",全部诚实且无 wire 暗示。
- 样式所有权干净:组件内零字面颜色,全部 `--dsw-*` 别名;类别色收敛为组件级自定义属性;`prefers-reduced-motion` 有降级;骨架屏 + `aria-busy`。
- 工程语义:follow/钉住/回落逻辑、raw 64 KiB 分页与"复制全部自动读齐"、stale-generation  fencing、筛选覆盖 part 级路径。
- 与 DSH 的融合:作为 Chat/Trajectory 平级 "Context" tab 嵌入,字族、圆角、边框、状态栏均原生。
