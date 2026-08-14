# 最终 UI/UX 复核 · Final review

- 日期:2026-08-14 · 复核人:UI/UX 设计负责人(最终视觉判断)
- 材料:`/tmp/dsh-context-taxonomy-final-review.png`(亮主题)+ `/tmp/dsh-context-taxonomy-final-review-dark.png`(暗色,同一真实会话,含 3 个 logical calls 的 Step 1/2/3 选择器与 follow 按钮)+ 只读源码 `packages/dsh-context-taxonomy/src/client/` + 前次复核 `design/production-review.md`
- 本版更新:暗色主题与多调用形态已用第二张截图验证;此前终审的剩余问题(P2-1、P2-2、P3-1/2/3/4/6)已经修复方确认并测试通过,我抽查源码与截图后确认。

## 结论:**SHIP**

两轮复核的全部阻断项与高优项均已修复并验证。亮暗两主题下,面板一眼可读:provider/model + 调用选择器 + follow 开关、来源徽标("logical request · llm/stream")、大数字 + 组成条 + 分类树,用途自明,与 DSH 原生界面融合良好。

## 修复核验(两轮累计)

| 条目 | 状态 | 证据 |
| --- | --- | --- |
| 吸顶层叠冲突 | ✅ | 仅 `.toolbar` 吸顶,identity/组标题不再吸顶 |
| 底部遮挡 | ✅ | `.panel { padding-bottom: 136px }`,内容可滚出输入框遮挡区 |
| 类别文本低对比 | ✅ | part 标签 `label-secondary`、meta `label-tertiary`;类别色只剩图形用途 |
| 警告色泛滥 | ✅ | 类别色 `color-mix(in oklab,…)` 派生,亮暗两主题截图均清晰可辨 |
| 诊断噪音 | ✅ | 芯片条件化;健康调用只剩 Cache / reasoning 两枚 |
| 推理份额可见性 | ✅ | reasoning 芯片携带估算 tokens("Passed · est. 37 input tokens") |
| follow 交互 | ✅ | `aria-pressed` 开关 + `pauseLatest`/`jumpLatest`;暗色截图确认按钮形态 |
| "prompt tokens" 措辞 | ✅ | "Actual input tokens / 实际输入 tokens" |
| 树内 token 数字对比度 | ✅ | `.item/.parts summary b` 改 `label-tertiary`(5.80:1)(CSS 139-140 行) |
| 无 usage 时大数字标签 | ✅ | "Estimated input tokens / 估算输入 tokens"(locales 41/120 行) |
| cache 数字千分位 | ✅ | `status.cache.read/write` 经 `formatNumber`(TSX 182-183 行) |
| `<1%` 显示 | ✅ | `formatShare`:非零不足 1% 显示 `<1%`(TSX 69-73 行) |
| reasoning / noUsage 文案 | ✅ | "Reasoning retention / 推理保留";zh "下游流没有上报用量…" 不再夹英文 |
| 筛选 dim | ✅ | `.compositionDim { opacity: .18 }`(CSS 85 行) |
| 百分比/est 差值/死键/hover/播报 | ✅ | 图例与组标题百分比、"est. 13,805 · +10.6%"、死键已删、`.item:hover`、`announce.switch` |

## 暗色主题与多调用形态(本轮已验证)

- **暗色**:第二张截图确认面板在暗色下渲染干净——表面层级、组成条四色(青灰/蓝/青绿/紫)、图例、芯片、树与工具栏全部可读;类别色经 `color-mix` 自语义令牌派生,随主题自动切阶。
- **多调用**:暗色截图确认完整身份栏——provider/model 行、"Step 3 · Call 1 · Complete" 选择器、"Following latest" 按钮、来源徽标 + 状态 meta 行,层级正确。上一轮亮色截图(单调用会话)未显示 select 行的形态差异就此闭环:多调用形态已视觉验证,合格。
- 此前"截图与源码不一致"的存疑点消除,无遗留行动。

## 剩余问题

### P3(仅一条,打磨项,不阻断)

1. `formatNumber` 与 `toLocaleTimeString` 未传界面语言(TSX 66、307 行):数字千分位分组与时间格式跟随浏览器 locale 而非 UI 语言。中英界面混用时会出现中文界面英文数字分组。建议后续迭代对齐 `localeTag(language)` 模式。

## Unknown(仍缺证据,不猜测;均不阻断)

1. **240px / ≤360px 窄形容器实渲染**:CSS 有 360px 容器查询(纵向堆叠、单列图例、meta 折行、路径 rtl 截断),吸顶冲突源已消除,代码评估低风险;无截图。
2. **running / error / aborted / interrupted / no-usage / raw 各异常态**的实际呈现:代码路径齐全(failure 卡 `role=alert/status`、raw 六种文案、轮询刷新),无截图。
3. **屏幕阅读器实际播报**:live 区与 `announce.switch` 已在代码中就位,实机播报时机未验证。

## 真实性文案核验(通过)

两主题截图与源码中的全部对外文案保持诚实:来源标识 "logical request · llm/stream"、"Filter items and logical paths"、"est." 限定词、"Usage not reported / 未上报用量"、"Estimated input tokens / 估算输入 tokens"、`scope`("…not a provider HTTP payload")、`raw.note`、raw 区六种非 available 文案。无任何 wire/payload 抓取暗示。

**终审意见:SHIP。** 无阻断项;唯一遗留 P3(数字/时间的界面语言本地化)可排入任一后续迭代。
