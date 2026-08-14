# design/ — Context Taxonomy 面板设计稿

面向 DeepSeek Harness Web 客户端的只读检查面板设计。产品定位与真实性契约见 `ui-spec.md` §1:面板展示的是 Harness 公开 `llm/stream` waterfall 上可观察的**逻辑请求**(`GenerateOptions`)与流式响应块,**不是** provider 线上报文、HTTP body 或 wire capture。

生产实现以官方-only public API 为最终事实来源。原型文档中的 `attempt`、256 KiB 展示预算或重建状态仅表示早期视觉探索；v1 实际使用每次 `llm/stream` invocation 的 logical-call ordinal、Host 端 65,536 字符分页和显式 raw state，绝不据此声称 provider transport 已执行。

## 文件

| 文件 | 内容 |
| --- | --- |
| `ui-spec.md` | 完整 UI 规格:真实性契约、令牌(ui-theme `--dsw-*` + 桶色派生值)、五区布局、交互(跟进最新/调用切换/筛选/分页)、无障碍(WCAG 2.2 AA)、响应式(240px 起)、全量中英文案 |
| `state-matrix.md` | 状态矩阵:loading / empty / running / success / error / aborted / interrupted / no-usage / raw unavailable / corrupt / oversize / filter-empty 的检测依据、各区表现、文案、播报与恢复 |
| `prototype/` | 无依赖静态交互原型(见下) |

## 预览原型 Preview

无需构建、无任何依赖。两种方式任选:

```sh
# 方式一:直接用浏览器打开
open design/prototype/index.html          # macOS

# 方式二:本地静态服务(推荐,剪贴板 API 需要安全上下文)
cd design/prototype && python3 -m http.server 8000
# 打开 http://localhost:8000
```

支持 hash 直达演示态(便于测试与分享):`index.html#state=oversize&lang=en&theme=dark&width=240`(`state` 取值见状态下拉,`width` 240–720)。

## 原型覆盖

- **跟进最新 follow-latest**:默认开启;点选历史调用即钉住(开关弹起),新调用到达时按钮角标计数;重新开启跳回最新。点"模拟新调用"观察两种行为。
- **调用选择 call switcher**:分段控件,`←/→/Home/End` 漫游,`aria-pressed` 单态。
- **筛选**:文本筛选(条目 + 逻辑路径)与图例桶筛选可叠加;filter-empty 演示态含"清除筛选"。
- **分类树**:组 → 条目 → 部分 → 正文,原生 `details`,信封字段折叠,逻辑路径左侧截断(`bdi` 隔离)。
- **已脱敏逻辑请求分页**:E 区虚线盒,演示步长 1 KiB(生产 64 KiB,见 `ui-spec.md` §4.5),含复制全部、unavailable / corrupt / oversize 形态。
- **状态演示**:顶部"演示状态"下拉覆盖状态矩阵全部 12 态。
- **响应式**:拖动"面板宽度"滑杆 240–720px;≤320px 隐藏 tokens 列与组占比(容器查询)。
- **主题**:亮 / 暗 / 跟随系统;中英文一键切换(`lang` 属性同步)。

演示镀铬(顶部工具条)不属于产品 UI。原型不写生产 React,组件映射关系见 `ui-spec.md` §11。

## 边界

本目录是设计资产;不修改 `src/`、`packages/`、配置、DeepSeek Harness 或 Pi Desktop。参考来源(只读):pi-desktop `ContextTaxonomyView.tsx` 与 `styles.css` 的 `.taxonomy-*`;deepseek-harness `ui-theme` / `ui-primitives` / `ui-conversation` / `ui-trajectory` 与 `docs/web-styling.md`。
