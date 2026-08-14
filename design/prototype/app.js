/* Context Taxonomy 交互原型(无依赖)。
 * 数据来源说明:全部夹具为虚构的"逻辑调用记录"(llm/stream 可达的 GenerateOptions
 * + StreamChunk 观察),不含任何 provider 线上报文;文案遵循 ui-spec.md §1.2。 */
"use strict";

/* ------------------------------------------------------------------ i18n --- */

const I18N = {
  zh: {
    "demo.title": "Context Taxonomy 交互原型(非生产 UI)",
    "demo.lang": "语言", "demo.theme": "主题",
    "demo.themeAuto": "跟随系统", "demo.themeLight": "亮色", "demo.themeDark": "暗色",
    "demo.state": "演示状态", "demo.append": "模拟新调用", "demo.width": "面板宽度",
    "demo.s.normal": "正常(4 个调用)", "demo.s.loading": "loading 加载中",
    "demo.s.empty": "empty 空", "demo.s.noUsage": "no-usage 未返回用量",
    "demo.s.aborted": "aborted 已中止", "demo.s.interrupted": "interrupted 已中断",
    "demo.s.rawUnavailable": "raw 不可用", "demo.s.corrupt": "corrupt 损坏",
    "demo.s.oversize": "oversize 超大", "demo.s.filterEmpty": "filter-empty 筛选为空",
    "panel.region": "上下文分类",
    "tree.label": "派生上下文分类",
    "header.source": "逻辑请求 · llm/stream",
    "header.reconstructed": "重建的近似结果",
    "header.corrupt": "损坏",
    "header.turnStep": "第 {turn} 轮 · 调用 {step}",
    "header.attempt": "尝试 {n}",
    "switcher.group": "本轮逻辑调用",
    "switcher.item": "调用 {n},共 {m} 个,{status}",
    "switcher.empty": "0 个调用",
    "follow.on": "跟进最新",
    "follow.new": "有 {n} 个新调用",
    "follow.announce.switch": "已切换到调用 {n}",
    "follow.announce.new": "新调用 {n} 已开始",
    "follow.none": "无可跟进调用",
    "status.running": "进行中", "status.success": "已完成", "status.error": "失败",
    "status.aborted": "已中止", "status.interrupted": "已中断",
    "status.maxTokens": "已完成 · 达到输出上限",
    "status.runningFor": "已进行 {duration}",
    "status.took": "耗时 {duration}",
    "budget.actual": "实际输入 tokens", "budget.estimated": "估算输入 tokens",
    "budget.estDelta": "est. {estimate} · {delta}",
    "budget.aria": "上下文预算",
    "budget.composition": "估算上下文组成",
    "chip.cache": "缓存命中率 {rate}%",
    "chip.reasoning": "推理{status}",
    "reasoning.kept": "已保留", "reasoning.dropped": "已丢弃",
    "chip.unclassified": "{n} 个未知字段",
    "chip.noUsage": "未返回用量",
    "chip.noUsage.body": "provider 未返回本次调用的用量;总量为估算值。",
    "chip.retry": "重试 {n}/{max}",
    "chip.reconstructed": "重建的近似结果",
    "chip.reconstructed.title": "无法获得完整记录",
    "chip.reconstructed.body": "此分类由会话日志近似重建,部分上下文可能缺失。",
    "chip.corrupt.body": "记录无法解析(结构损坏);可展示的内容如下。",
    "cache.hit": "缓存命中", "cache.miss": "缓存未命中", "cache.write": "缓存写入", "cache.output": "输出",
    "filter.placeholder": "筛选条目和路径",
    "filter.aria": "筛选上下文条目和逻辑路径",
    "tree.expandAll": "全部展开", "tree.collapseAll": "全部收起",
    "tree.emptyFiltered": "没有匹配此筛选的上下文条目。",
    "tree.clearFilter": "清除筛选",
    "tree.emptyNone": "此调用未记录到派生条目。",
    "envelope.folded": "+{n} 个信封字段",
    "raw.title": "逻辑请求(已脱敏)",
    "raw.summary": "{state} · {bytes} 字节",
    "raw.state.available": "完整", "raw.state.oversize": "超大",
    "raw.state.unavailable": "不可用", "raw.state.corrupt": "损坏",
    "raw.note": "记录自 llm/stream 的逻辑请求,非 provider 线上报文。",
    "raw.shape": "{n} 条消息 · {m} 个工具 · 逻辑字段顺序",
    "raw.loadNext": "加载下一段",
    "raw.loading": "加载中…",
    "raw.progress": "已加载 {loaded}/{total} 字节",
    "raw.demoStep": "演示步长 1 KiB;生产 64 KiB",
    "raw.copyAll": "复制全部",
    "raw.copied": "已复制", "raw.copyFailed": "复制失败",
    "raw.unavailableBody": "此调用的逻辑请求记录不可用(记录缺失或被截断)。",
    "raw.oversizeBody": "记录共 {bytes} 字节,超出展示预算;仅分页展示前 {shown} 字节。",
    "raw.oversizeCopyNote": "复制不受截断影响。",
    "raw.truncated": "…(已截断)",
    "raw.corruptBody": "记录无法解析(结构损坏);可展示的内容如下。",
    "group.instructions": "指令", "group.conversation": "对话", "group.prompt": "当前提示",
    "group.tools": "工具", "group.options": "请求选项", "group.unknown": "未知字段",
    "bucket.instructions": "指令", "bucket.text": "文本", "bucket.reasoning": "推理",
    "bucket.tool_call": "工具调用", "bucket.tool_definition": "工具定义",
    "bucket.tool_result": "工具结果", "bucket.attachment": "附件",
    "bucket.options": "选项与元数据", "bucket.unknown": "未知",
    "state.loading": "正在加载调用记录…",
    "state.empty": "此轮还没有逻辑调用。",
    "state.emptyHint": "调用在派发前失败或被更早拦截时对本面板不可见。",
    "state.errorBody": "调用失败:{message}({code})",
    "state.retryHint": "将于 {seconds}s 后重试(第 {n} 次,共 {max} 次)",
    "state.abortedBody": "调用被用户中止;已产生的输出保留在对话中。",
    "state.interruptedBody": "应用重启后从会话记录恢复;该调用的最终状态未知。",
    "announce.callFailed": "调用 {n} 失败:{message}"
  },
  en: {
    "demo.title": "Context Taxonomy interactive prototype (not production UI)",
    "demo.lang": "Language", "demo.theme": "Theme",
    "demo.themeAuto": "System", "demo.themeLight": "Light", "demo.themeDark": "Dark",
    "demo.state": "Demo state", "demo.append": "Simulate new call", "demo.width": "Panel width",
    "demo.s.normal": "Normal (4 calls)", "demo.s.loading": "loading",
    "demo.s.empty": "empty", "demo.s.noUsage": "no-usage",
    "demo.s.aborted": "aborted", "demo.s.interrupted": "interrupted",
    "demo.s.rawUnavailable": "raw unavailable", "demo.s.corrupt": "corrupt",
    "demo.s.oversize": "oversize", "demo.s.filterEmpty": "filter-empty",
    "panel.region": "Context taxonomy",
    "tree.label": "Derived context taxonomy",
    "header.source": "logical request · llm/stream",
    "header.reconstructed": "Reconstructed approximation",
    "header.corrupt": "Corrupt",
    "header.turnStep": "Turn {turn} · call {step}",
    "header.attempt": "attempt {n}",
    "switcher.group": "Logical calls in this turn",
    "switcher.item": "Call {n} of {m}, {status}",
    "switcher.empty": "0 calls",
    "follow.on": "Follow latest",
    "follow.new": "{n} new calls",
    "follow.announce.switch": "Switched to call {n}",
    "follow.announce.new": "Call {n} started",
    "follow.none": "No call to follow",
    "status.running": "Running", "status.success": "Complete", "status.error": "Failed",
    "status.aborted": "Aborted", "status.interrupted": "Interrupted",
    "status.maxTokens": "Complete · output limit reached",
    "status.runningFor": "Running for {duration}",
    "status.took": "Took {duration}",
    "budget.actual": "actual input tokens", "budget.estimated": "estimated input tokens",
    "budget.estDelta": "est. {estimate} · {delta}",
    "budget.aria": "Context budget",
    "budget.composition": "Estimated context composition",
    "chip.cache": "Cache {rate}% hit",
    "chip.reasoning": "Reasoning {status}",
    "reasoning.kept": "kept", "reasoning.dropped": "dropped",
    "chip.unclassified": "{n} unknown fields",
    "chip.noUsage": "No usage reported",
    "chip.noUsage.body": "The provider returned no usage for this call; totals are estimates.",
    "chip.retry": "Retry {n}/{max}",
    "chip.reconstructed": "Reconstructed approximation",
    "chip.reconstructed.title": "The complete record was unavailable",
    "chip.reconstructed.body": "This taxonomy was reconstructed from the session log; some context parts may be missing.",
    "chip.corrupt.body": "The record could not be parsed (corrupt structure); readable content is shown below.",
    "cache.hit": "Cache hit", "cache.miss": "Cache miss", "cache.write": "Cache write", "cache.output": "Output",
    "filter.placeholder": "Filter items and paths",
    "filter.aria": "Filter context items and logical paths",
    "tree.expandAll": "Expand all", "tree.collapseAll": "Collapse all",
    "tree.emptyFiltered": "No context items match this filter.",
    "tree.clearFilter": "Clear filter",
    "tree.emptyNone": "This call recorded no derived items.",
    "envelope.folded": "+{n} envelope fields",
    "raw.title": "Logical request (sanitized)",
    "raw.summary": "{state} · {bytes} bytes",
    "raw.state.available": "complete", "raw.state.oversize": "oversize",
    "raw.state.unavailable": "unavailable", "raw.state.corrupt": "corrupt",
    "raw.note": "Logical request recorded at llm/stream, not the provider's wire payload.",
    "raw.shape": "{n} messages · {m} tools · logical field order",
    "raw.loadNext": "Load next chunk",
    "raw.loading": "Loading…",
    "raw.progress": "{loaded}/{total} bytes loaded",
    "raw.demoStep": "Demo step 1 KiB; 64 KiB in production",
    "raw.copyAll": "Copy full",
    "raw.copied": "copied", "raw.copyFailed": "copy failed",
    "raw.unavailableBody": "The logical request record is unavailable for this call (missing or truncated record).",
    "raw.oversizeBody": "The record is {bytes} bytes, over the display budget; only the first {shown} bytes are paged.",
    "raw.oversizeCopyNote": "Copy is not affected by truncation.",
    "raw.truncated": "…(truncated)",
    "raw.corruptBody": "The record could not be parsed (corrupt structure); readable content is shown below.",
    "group.instructions": "Instructions", "group.conversation": "Conversation", "group.prompt": "Current prompt",
    "group.tools": "Tools", "group.options": "Request options", "group.unknown": "Unknown fields",
    "bucket.instructions": "Instructions", "bucket.text": "Text", "bucket.reasoning": "Reasoning",
    "bucket.tool_call": "Tool calls", "bucket.tool_definition": "Tool definitions",
    "bucket.tool_result": "Tool results", "bucket.attachment": "Attachments",
    "bucket.options": "Options & metadata", "bucket.unknown": "Unknown",
    "state.loading": "Loading call records…",
    "state.empty": "No logical calls in this turn yet.",
    "state.emptyHint": "Calls that fail before dispatch, or are intercepted earlier, are not visible to this panel.",
    "state.errorBody": "Call failed: {message} ({code})",
    "state.retryHint": "Retrying in {seconds}s (attempt {n} of {max})",
    "state.abortedBody": "The call was aborted by the user; output produced so far is kept in the conversation.",
    "state.interruptedBody": "Recovered from the session record after an app restart; the call's final state is unknown.",
    "announce.callFailed": "Call {n} failed: {message}"
  }
};

const BUCKETS = ["instructions", "text", "reasoning", "tool_call", "tool_definition", "tool_result", "attachment", "options", "unknown"];
const GROUPS = ["instructions", "conversation", "prompt", "tools", "options", "unknown"];

let lang = "zh";
const t = (key, vars) => {
  let s = (I18N[lang] && I18N[lang][key]) ?? I18N.zh[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
};
const num = (n) => n.toLocaleString(lang === "zh" ? "zh-CN" : "en-US");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* -------------------------------------------------------------- fixtures --- */
/* 虚构逻辑请求(GenerateOptions 字段名,provider 中立;内容已脱敏)。 */

const SYSTEM_TEXT = "You are Harness, an agent running inside DeepSeek Harness.\nFollow the AGENTS.md conventions of the workspace. Prefer existing patterns over new abstractions.\nNever print secrets; credentials live only in transport headers.";
const PROJECT_TEXT = "# AGENTS.md(excerpt)\n- ESM everywhere; pnpm workspaces.\n- Model-visible inputs must be reconstructable from the session log.\n- Tests describe behavior, not correctness.";
const MEMORY_TEXT = "- user prefers pnpm over npm\n- repo: dsh-context-taxonomy (design branch)";

const TOOL_SCHEMAS = [
  { name: "bash", description: "Run a bash command in the workspace.", parameters: { type: "object", properties: { command: { type: "string" }, timeout: { type: "number" } }, required: ["command"] } },
  { name: "read_file", description: "Read a UTF-8 text file by path.", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
  { name: "edit_file", description: "Replace an exact string in a file.", parameters: { type: "object", properties: { path: { type: "string" }, old_string: { type: "string" }, new_string: { type: "string" } }, required: ["path", "old_string", "new_string"] } }
];

function makeRequest(step, extraMessages) {
  const messages = [
    { role: "user", content: [{ type: "text", text: "把面板的最小宽度收敛到 240px,并检查窄屏下 tokens 列的取舍。" }] },
    { role: "assistant", content: [
      { type: "reasoning", text: "需要先看容器查询断点,再决定隐藏哪一列。" },
      { type: "tool-call", id: "call_01", name: "bash", arguments: "{\"command\":\"rg -n 'container' design/prototype\"}" }
    ] },
    { role: "tool", content: [{ type: "tool-result", toolCallId: "call_01", text: "responsive.css:4:@container (max-width: 320px)" }] },
    ...extraMessages
  ];
  const req = {
    provider: "deepseek",
    model: "deepseek-chat",
    reasoningEffort: "medium",
    system: SYSTEM_TEXT + "\n\n" + PROJECT_TEXT + "\n\n" + MEMORY_TEXT,
    messages,
    tools: TOOL_SCHEMAS,
    temperature: 0.2,
    maxTokens: 8192,
    stop: ["</tool>"]
  };
  if (step >= 2) req.messages.push({ role: "user", content: [{ type: "text", text: "继续:暗色主题的桶色也一起核对。" }] });
  return req;
}

function makeGroups(variant) {
  const groups = [
    { id: "instructions", items: [
      { key: "i-sys", title: "系统提示", kind: "system_prompt", bucket: "instructions", role: "system",
        path: "$.system", tokens: 892, foldedCount: 1,
        parts: [
          { key: "i-sys-p1", tag: "text", bucket: "instructions", title: "核心指令", tokens: 512, path: "$.system(segments[0])", body: { format: "markdown", text: SYSTEM_TEXT } },
          { key: "i-sys-p2", tag: "text", bucket: "instructions", title: "项目上下文 AGENTS.md", tokens: 284, path: "$.system(segments[1])", body: { format: "markdown", text: PROJECT_TEXT } },
          { key: "i-sys-p3", tag: "text", bucket: "instructions", title: "记忆", tokens: 96, path: "$.system(segments[2])", body: { format: "markdown", text: MEMORY_TEXT } }
        ] },
      { key: "i-dev", title: "开发者指令", kind: "developer_instructions", bucket: "instructions", role: "developer",
        path: "$.messages[0].content[0]", tokens: 1024, foldedCount: 1,
        parts: [{ key: "i-dev-p1", tag: "text", bucket: "instructions", title: "输出规约", tokens: 1024, path: "$.messages[0].content[0].text", body: { format: "markdown", text: "所有 UI 文案中英文双语;禁用 wire/payload 措辞;估算值必须标注。" } }] }
    ] },
    { id: "conversation", items: [
      { key: "c-u1", title: "用户 轮次", kind: "conversation_history", bucket: "text", role: "user",
        path: "$.messages[1]", tokens: 388, foldedCount: 1,
        parts: [{ key: "c-u1-p1", tag: "text", bucket: "text", title: "用户消息", tokens: 388, path: "$.messages[1].content[0].text", body: { format: "markdown", text: "把面板的最小宽度收敛到 240px,并检查窄屏下 tokens 列的取舍。" } }] },
      { key: "c-a1", title: "助手 轮次", kind: "conversation_history", bucket: "text", role: "assistant",
        path: "$.messages[2]", tokens: 1218, foldedCount: 1,
        parts: [
          { key: "c-a1-p1", tag: "reasoning", bucket: "reasoning", title: "推理块", tokens: 640, path: "$.messages[2].content[0].text", body: { format: "markdown", text: "需要先看容器查询断点,再决定隐藏哪一列。tokens 列在 320px 以下隐藏,组占比同步隐藏。" } },
          { key: "c-a1-p2", tag: "tool_call", bucket: "tool_call", title: "bash", toolCallId: "call_01", tokens: 578, path: "$.messages[2].content[1]", body: { format: "json", text: "{\n  \"id\": \"call_01\",\n  \"name\": \"bash\",\n  \"arguments\": \"{\\\"command\\\":\\\"rg -n 'container' design/prototype\\\"}\"\n}" } }
        ] },
      { key: "c-t1", title: "工具 轮次", kind: "conversation_history", bucket: "tool_result", role: "tool",
        path: "$.messages[3]", tokens: 996, foldedCount: 2,
        parts: [{ key: "c-t1-p1", tag: "tool_result", bucket: "tool_result", title: "bash 结果", toolCallId: "call_01", tokens: 996, path: "$.messages[3].content[0].text", body: { format: "markdown", text: "responsive.css:4:@container (max-width: 320px) {\n  .ctx-item-tokens, .ctx-group-head .g-pct { display: none; }\n}" } }] }
    ] },
    { id: "prompt", items: [
      { key: "p-cur", title: "当前用户提示", kind: "current_user_prompt", bucket: "text", role: "user",
        path: "$.messages[4]", tokens: 214, foldedCount: 1,
        parts: [{ key: "p-cur-p1", tag: "text", bucket: "text", title: "当前提示", tokens: 214, path: "$.messages[4].content[0].text", body: { format: "markdown", text: "继续:暗色主题的桶色也一起核对。" } }] }
    ] },
    { id: "tools", items: [
      { key: "t-defs", title: "bash, read_file, edit_file", kind: "tool_definition", bucket: "tool_definition", role: "tool_definition",
        path: "$.tools", tokens: 1688, foldedCount: 0,
        parts: TOOL_SCHEMAS.map((s, i) => ({ key: `t-defs-p${i}`, tag: "text", bucket: "tool_definition", title: s.name, tokens: [602, 470, 616][i], path: `$.tools[${i}]`, body: { format: "json", text: JSON.stringify(s, null, 2) } })) }
    ] },
    { id: "options", items: [
      { key: "o-req", title: "请求选项", kind: "provider_options", bucket: "options", role: "request_options",
        path: "$", tokens: 486, foldedCount: 0,
        parts: [{ key: "o-req-p1", tag: "metadata", bucket: "options", title: "采样与停止", tokens: 486, path: "$.temperature", body: { format: "json", text: "{\n  \"temperature\": 0.2,\n  \"maxTokens\": 8192,\n  \"stop\": [\"</tool>\"]\n}" } }] }
    ] }
  ];
  if (variant === "unknown") {
    groups.push({ id: "unknown", items: [
      { key: "u-exp", title: "其他逻辑请求字段", kind: "unclassified", bucket: "unknown", role: "unclassified",
        path: "$", tokens: 96, foldedCount: 0,
        parts: [{ key: "u-exp-p1", tag: "unclassified", bucket: "unknown", title: "$.experimental", tokens: 96, path: "$.experimental", body: { format: "json", text: "{\n  \"routingHint\": \"lab-cluster\"\n}" } }] }
    ] });
  }
  return groups;
}

const BASE_TIME = Date.now() - 96_000;

function makeCalls() {
  return [
    { id: "c1", turn: 3, step: 1, attempt: 1, provider: "deepseek", model: "deepseek-chat",
      startedAt: BASE_TIME, endedAt: BASE_TIME + 6_420, status: "success", finish: "tool-calls",
      usage: { inputTokens: 1712, outputTokens: 318, cacheReadTokens: 4096, cacheWriteTokens: 1024, reasoningTokens: 96 },
      source: "stream-record", recordCompleteness: "complete",
      groups: makeGroups("normal"),
      raw: { state: "available", topLevelOrder: [], text: "" } },
    { id: "c2", turn: 3, step: 2, attempt: 1, provider: "deepseek", model: "deepseek-chat",
      startedAt: BASE_TIME + 21_000, endedAt: BASE_TIME + 34_300, status: "success", finish: "stop",
      usage: { inputTokens: 5230, outputTokens: 642 },
      source: "stream-record", recordCompleteness: "complete",
      groups: makeGroups("unknown"),
      raw: { state: "available", topLevelOrder: [], text: "" } },
    { id: "c3", turn: 3, step: 3, attempt: 1, provider: "deepseek", model: "deepseek-chat",
      startedAt: BASE_TIME + 52_000, endedAt: BASE_TIME + 53_150, status: "error",
      failure: { message: "Rate limit exceeded", code: "rate_limit", status: 429, requestId: "req_9f3c2a", retryAfterMs: 4000 },
      retry: { scheduled: true, ordinal: 2, max: 3, delayMs: 4000 },
      source: "stream-record", recordCompleteness: "complete",
      groups: makeGroups("normal"),
      raw: { state: "available", topLevelOrder: [], text: "" } },
    { id: "c4", turn: 3, step: 4, attempt: 1, provider: "deepseek", model: "deepseek-chat",
      startedAt: Date.now() - 12_000, status: "running",
      source: "stream-record", recordCompleteness: "complete",
      groups: makeGroups("normal"),
      raw: { state: "available", topLevelOrder: [], text: "" } }
  ];
}

function fillRaw(call) {
  if (call.raw.text) return;
  const req = makeRequest(call.step, call.step >= 3 ? [{ role: "assistant", content: [{ type: "text", text: "已核对容器查询断点:320px 以下隐藏 tokens 列与组占比。" }] }] : []);
  call.raw.text = JSON.stringify(req, null, 2);
  call.raw.byteCount = call.raw.text.length;
  call.raw.topLevelOrder = Object.keys(req);
  call.raw.messageCount = req.messages.length;
  call.raw.toolCount = req.tools.length;
}

function estimateOf(call) {
  return call.groups.reduce((a, g) => a + g.items.reduce((b, it) => b + it.tokens, 0), 0);
}

/* 演示状态夹具:对正常夹具做最小变更,覆盖 state-matrix 的各轴。 */
function buildDemoCalls(demo) {
  const calls = makeCalls();
  calls.forEach(fillRaw);
  const first = () => [structuredClone(calls[0])];
  switch (demo) {
    case "empty": return [];
    case "noUsage": { const c = first(); delete c[0].usage; return c; }
    case "aborted": { const c = first(); Object.assign(c[0], { status: "aborted", endedAt: c[0].startedAt + 2100 }); delete c[0].usage; delete c[0].finish; return c; }
    case "interrupted": { const c = first(); Object.assign(c[0], { status: "interrupted" }); delete c[0].usage; delete c[0].finish; return c; }
    case "rawUnavailable": { const c = first(); c[0].raw = { state: "unavailable", topLevelOrder: [], text: "", byteCount: 0 }; return c; }
    case "corrupt": { const c = first(); c[0].recordCompleteness = "corrupt"; c[0].raw.state = "corrupt"; c[0].raw.text = c[0].raw.text.slice(0, 400); return c; }
    case "oversize": { const c = first(); c[0].raw.state = "oversize"; c[0].raw.byteCount = 1_482_033; return c; }
    default: return calls; // normal / loading / filterEmpty 由渲染层处理
  }
}

/* ----------------------------------------------------------------- state --- */

const state = {
  demo: "normal",
  calls: buildDemoCalls("normal"),
  selectedId: null,
  follow: true,
  followNew: 0,
  query: "",
  bucket: null,
  allExpanded: false,
  openItems: new Set(["p-cur"]),
  openParts: new Set(),
  chipsOpen: new Set(),
  rawOpen: false,
  rawShown: {},
  rawLoading: false,
  copied: false
};

const $ = (sel) => document.querySelector(sel);
const panel = $("#panel");
const live = $("#live");
const liveAlert = $("#liveAlert");
let liveTimer = 0;
function announce(msg, assertive) {
  const el = assertive ? liveAlert : live;
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => { el.textContent = msg; }, 150);
}

function selectedCall() {
  return state.calls.find((c) => c.id === state.selectedId) ?? state.calls[state.calls.length - 1] ?? null;
}

/* --------------------------------------------------------------- helpers --- */

const fmtTime = (ms) => new Date(ms).toLocaleTimeString(lang === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const fmtDur = (ms) => {
  const s = Math.max(0, Math.round(ms / 100) / 10);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
};
const DOT_STATE = { running: "ongoing", success: "done", error: "error", aborted: "warning", interrupted: "warning" };
const statusLabel = (c) => c.status === "success" && c.finish === "max-tokens" ? t("status.maxTokens") : t(`status.${c.status}`);
const kindVar = (bucket) => `var(--kind-${bucket.replace(/_/g, "-")})`;

function compositionOf(call) {
  const total = estimateOf(call);
  const map = new Map();
  for (const g of call.groups) for (const it of g.items) {
    const partSum = it.parts.reduce((a, p) => a + p.tokens, 0);
    for (const p of it.parts) map.set(p.bucket, (map.get(p.bucket) ?? 0) + p.tokens);
    const folded = it.tokens - partSum;
    if (folded > 0) map.set(it.foldedCount > 0 ? "options" : it.bucket, (map.get(it.foldedCount > 0 ? "options" : it.bucket) ?? 0) + folded);
  }
  return BUCKETS.filter((b) => map.has(b))
    .map((b) => ({ bucket: b, tokens: map.get(b), pct: total ? map.get(b) / total * 100 : 0 }))
    .sort((a, b2) => b2.tokens - a.tokens)
    .map((e) => ({ ...e, total }));
}

function itemSearchText(it) {
  return [it.title, it.role, it.kind, it.path, ...it.parts.flatMap((p) => [p.tag, p.title, p.path ?? "", p.toolCallId ?? ""])].join(" ").toLowerCase();
}
function visibleGroups(call) {
  const q = state.query.trim().toLowerCase();
  return call.groups
    .map((g) => ({ ...g, items: g.items.filter((it) => {
      const bucketOk = !state.bucket || it.bucket === state.bucket || it.parts.some((p) => p.bucket === state.bucket);
      const queryOk = !q || itemSearchText(it).includes(q);
      return bucketOk && queryOk;
    }) }))
    .filter((g) => g.items.length > 0);
}

/* ---------------------------------------------------------------- render --- */

function renderAll() {
  const focusId = document.activeElement?.dataset?.focusId;
  panel.setAttribute("aria-label", t("panel.region"));
  if (state.demo === "loading") { renderLoading(); return; }
  if (state.calls.length === 0) { renderEmpty(); return; }
  if (!selectedCall()) state.selectedId = state.calls[state.calls.length - 1].id;
  panel.removeAttribute("aria-busy");
  panel.querySelector(":scope > .ctx-empty")?.remove();
  renderHead();
  renderBudget();
  renderToolbar();
  renderTree();
  if (focusId) panel.querySelector(`[data-focus-id="${focusId}"]`)?.focus();
}

function renderLoading() {
  panel.setAttribute("aria-busy", "true");
  panel.innerHTML = `
    <div class="ctx-head"><div class="skel-row w60"></div><div class="skel-row w35"></div></div>
    <div class="ctx-budget"><div class="skel-row w35"></div><div class="skel-row w80"></div><div class="skel-row w60"></div></div>
    <div class="ctx-toolbar"><div class="skel-row w80" style="margin:0"></div></div>
    <div class="ctx-tree">${'<div class="skel-row w60"></div><div class="skel-row w80"></div>'.repeat(3)}</div>
    <span class="visually-hidden">${esc(t("state.loading"))}</span>`;
}

function renderEmpty() {
  panel.removeAttribute("aria-busy");
  panel.innerHTML = `
    <div class="ctx-head"><div class="ctx-head-id">
      <strong>deepseek/deepseek-chat</strong>
      <span class="ctx-badge">${esc(t("header.source"))}</span>
      <span class="ctx-switcher" role="group" aria-label="${esc(t("switcher.group"))}"><button type="button" disabled>${esc(t("switcher.empty"))}</button></span>
      <button type="button" class="ctx-follow" disabled title="${esc(t("follow.none"))}">${esc(t("follow.on"))}</button>
    </div></div>
    <p class="ctx-empty">${esc(t("state.empty"))}<span class="sub">${esc(t("state.emptyHint"))}</span></p>`;
}

function renderHead() {
  const call = selectedCall();
  const n = state.calls.indexOf(call) + 1;
  let head = panel.querySelector(".ctx-head");
  if (!head) {
    head = document.createElement("div");
    head.className = "ctx-head";
    panel.prepend(head);
  }
  const badges = [];
  if (call.source === "reconstructed") badges.push(`<span class="ctx-badge" data-tone="bad">${esc(t("header.reconstructed"))}</span>`);
  if (call.recordCompleteness === "corrupt") badges.push(`<span class="ctx-badge" data-tone="warn">${esc(t("header.corrupt"))}</span>`);

  const switcher = state.calls.map((c, i) => `
    <button type="button" data-focus-id="sw-${c.id}" data-call="${c.id}"
      tabindex="${c.id === call.id ? "0" : "-1"}"
      aria-pressed="${c.id === call.id}"
      aria-label="${esc(t("switcher.item", { n: i + 1, m: state.calls.length, status: statusLabel(c) }))}">
      <span class="ctx-dot" data-state="${DOT_STATE[c.status]}" aria-hidden="true"></span>${i + 1}
    </button>`).join("");

  const timing = call.status === "running"
    ? t("status.runningFor", { duration: fmtDur(Date.now() - call.startedAt) })
    : t("status.took", { duration: fmtDur((call.endedAt ?? call.startedAt) - call.startedAt) });

  head.innerHTML = `
    <div class="ctx-head-id">
      <strong title="${esc(call.provider)}/${esc(call.model)}">${esc(call.provider)}/${esc(call.model)}</strong>
      ${badges.join("")}
      <span class="ctx-switcher" role="group" aria-label="${esc(t("switcher.group"))}">${switcher}</span>
      <button type="button" class="ctx-follow" data-focus-id="follow" aria-pressed="${state.follow}"
        ${state.followNew > 0 ? `aria-describedby="followNewHint"` : ""}>
        ${esc(t("follow.on"))}${state.followNew > 0 ? `<span class="ctx-follow-badge" aria-hidden="true">${state.followNew}</span>` : ""}
      </button>
      ${state.followNew > 0 ? `<span id="followNewHint" class="visually-hidden">${esc(t("follow.new", { n: state.followNew }))}</span>` : ""}
    </div>
    <div class="ctx-head-meta">
      <span>${esc(t("header.source"))}</span>
      <span class="dot-sep">·</span>
      <span>${esc(t("header.turnStep", { turn: call.turn, step: call.step }))}</span>
      <span class="dot-sep">·</span>
      <span class="ctx-dot" data-state="${DOT_STATE[call.status]}" aria-hidden="true"></span>
      <span>${esc(statusLabel(call))}</span>
      ${call.attempt > 1 ? `<span class="dot-sep">·</span><span>${esc(t("header.attempt", { n: call.attempt }))}</span>` : ""}
      <span class="dot-sep">·</span>
      <span>${fmtTime(call.startedAt)}</span>
      <span class="dot-sep">·</span>
      <span id="ctxDuration">${esc(timing)}</span>
    </div>`;

  head.querySelectorAll(".ctx-switcher button").forEach((btn) => {
    btn.addEventListener("click", () => selectCall(btn.dataset.call, true));
    btn.addEventListener("keydown", onSwitcherKey);
  });
  head.querySelector(".ctx-follow").addEventListener("click", () => {
    state.follow = !state.follow;
    if (state.follow) {
      state.followNew = 0;
      const last = state.calls[state.calls.length - 1];
      if (last && last.id !== state.selectedId) {
        state.selectedId = last.id;
        announce(t("follow.announce.switch", { n: state.calls.length }));
      }
      renderAll();
    } else renderHead();
  });
}

function onSwitcherKey(e) {
  const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
  if (!keys.includes(e.key)) return;
  e.preventDefault();
  const idx = state.calls.findIndex((c) => c.id === state.selectedId);
  const next = e.key === "Home" ? 0 : e.key === "End" ? state.calls.length - 1
    : e.key === "ArrowRight" ? Math.min(state.calls.length - 1, idx + 1) : Math.max(0, idx - 1);
  const target = state.calls[next];
  if (target) {
    selectCall(target.id, true);
    panel.querySelector(`[data-focus-id="sw-${target.id}"]`)?.focus();
  }
}

function selectCall(id, manual) {
  if (state.selectedId === id) return;
  state.selectedId = id;
  if (manual && state.follow && id !== state.calls[state.calls.length - 1]?.id) state.follow = false;
  if (manual && state.follow === false && id === state.calls[state.calls.length - 1]?.id) { /* 仍钉住,由 follow 按钮恢复 */ }
  const idx = state.calls.findIndex((c) => c.id === id) + 1;
  announce(t("follow.announce.switch", { n: idx }));
  renderAll();
}

function renderBudget() {
  const call = selectedCall();
  let el = panel.querySelector(".ctx-budget");
  if (!el) { el = document.createElement("div"); el.className = "ctx-budget"; panel.appendChild(el); }
  el.setAttribute("aria-label", t("budget.aria"));

  const est = estimateOf(call);
  const u = call.usage;
  const billed = u ? u.inputTokens + (u.cacheReadTokens ?? 0) + (u.cacheWriteTokens ?? 0) : null;
  const delta = billed ? (() => { const d = (est - billed) / billed * 100; const r = Math.round(d * 10) / 10; return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(1)}%`; })() : null;

  const comp = compositionOf(call);
  const total = comp[0]?.total ?? 0;

  /* 芯片:重建 → 损坏 → 重试 → 缓存 → 推理 → 未知字段 → 未返回用量(state-matrix §3) */
  const chips = [];
  if (call.source === "reconstructed") chips.push({ id: "reconstructed", tone: "bad", label: t("chip.reconstructed") });
  if (call.recordCompleteness === "corrupt") chips.push({ id: "corrupt", tone: "warn", label: t("header.corrupt") });
  if (call.retry?.scheduled) chips.push({ id: "retry", tone: "warn", label: t("chip.retry", { n: call.retry.ordinal, max: call.retry.max }) });
  if (u && (u.cacheReadTokens ?? 0) + (u.cacheWriteTokens ?? 0) > 0) {
    const rate = Math.round((u.cacheReadTokens ?? 0) / Math.max(1, (u.cacheReadTokens ?? 0) + u.inputTokens) * 1000) / 10;
    chips.push({ id: "cache", tone: "ok", label: t("chip.cache", { rate }) });
  }
  const hasReasoning = call.groups.some((g) => g.items.some((it) => it.parts.some((p) => p.bucket === "reasoning")));
  if (hasReasoning) chips.push({ id: "reasoning", tone: "ok", label: t("chip.reasoning", { status: t("reasoning.kept") }) });
  const unknownCount = call.groups.filter((g) => g.id === "unknown").reduce((a, g) => a + g.items.length, 0);
  if (unknownCount > 0) chips.push({ id: "unclassified", tone: "bad", label: t("chip.unclassified", { n: unknownCount }) });
  if (!u && call.status !== "running") chips.push({ id: "noUsage", tone: "neutral", label: t("chip.noUsage") });

  const detail = chipDetail(call, u);

  el.innerHTML = `
    <div class="ctx-total">
      <b>${num(billed ?? est)}</b>
      <span>${esc(billed ? t("budget.actual") : t("budget.estimated"))}</span>
      ${billed ? `<em>${esc(t("budget.estDelta", { estimate: num(est), delta }))}</em>` : ""}
    </div>
    ${total > 0 ? `
      <div class="ctx-bar" aria-hidden="true">
        ${comp.map((e) => `<span class="${state.bucket && state.bucket !== e.bucket ? "dimmed" : ""}" style="width:${Math.max(1, e.pct)}%;background:${kindVar(e.bucket)}"></span>`).join("")}
      </div>
      <ul class="ctx-legend" aria-label="${esc(t("budget.composition"))}">
        ${comp.map((e) => `<li><button type="button" data-bucket="${e.bucket}" aria-pressed="${state.bucket === e.bucket}">
          <i style="background:${kindVar(e.bucket)}" aria-hidden="true"></i>
          <span class="l-label">${esc(t(`bucket.${e.bucket}`))}</span>
          <span class="l-value">${num(e.tokens)}</span>
          <span class="l-pct">${Math.round(e.pct)}%</span>
        </button></li>`).join("")}
      </ul>` : ""}
    ${chips.length ? `<div class="ctx-chips">${chips.map((c) => `
      <button type="button" class="ctx-chip" data-chip="${c.id}" data-tone="${c.tone}" aria-expanded="${state.chipsOpen.has(c.id)}">${esc(c.label)}</button>`).join("")}</div>` : ""}
    ${call.status === "error" ? `
      <div class="ctx-detail" data-tone="bad">
        <strong>${esc(t("state.errorBody", { message: call.failure.message, code: call.failure.code }))}</strong>
        ${call.failure.status ? `<div class="ctx-kv"><span>status</span><b>${call.failure.status}</b></div>` : ""}
        ${call.failure.requestId ? `<div class="ctx-kv"><span>requestId</span><b>${esc(call.failure.requestId)}</b></div>` : ""}
        ${call.retry?.scheduled ? `<span>${esc(t("state.retryHint", { seconds: Math.round(call.retry.delayMs / 1000), n: call.retry.ordinal, max: call.retry.max }))}</span>` : ""}
      </div>` : ""}
    ${call.status === "aborted" ? `<div class="ctx-detail"><span>${esc(t("state.abortedBody"))}</span></div>` : ""}
    ${call.status === "interrupted" ? `<div class="ctx-detail"><span>${esc(t("state.interruptedBody"))}</span></div>` : ""}
    ${detail}`;

  el.querySelectorAll(".ctx-legend button").forEach((b) => b.addEventListener("click", () => {
    state.bucket = state.bucket === b.dataset.bucket ? null : b.dataset.bucket;
    renderBudget();
    renderTree();
  }));
  el.querySelectorAll(".ctx-chip").forEach((b) => b.addEventListener("click", () => {
    state.chipsOpen.has(b.dataset.chip) ? state.chipsOpen.delete(b.dataset.chip) : state.chipsOpen.add(b.dataset.chip);
    renderBudget();
  }));
}

function chipDetail(call, u) {
  const open = state.chipsOpen;
  if (open.has("cache") && u) return `<div class="ctx-detail">
    <div class="ctx-kv"><span>${esc(t("cache.hit"))}</span><b>${num(u.cacheReadTokens ?? 0)}</b></div>
    <div class="ctx-kv"><span>${esc(t("cache.miss"))}</span><b>${num(u.inputTokens)}</b></div>
    <div class="ctx-kv"><span>${esc(t("cache.write"))}</span><b>${num(u.cacheWriteTokens ?? 0)}</b></div>
    <div class="ctx-kv"><span>${esc(t("cache.output"))}</span><b>${num(u.outputTokens)}</b></div></div>`;
  if (open.has("reconstructed")) return `<div class="ctx-detail"><strong>${esc(t("chip.reconstructed.title"))}</strong><span>${esc(t("chip.reconstructed.body"))}</span></div>`;
  if (open.has("corrupt")) return `<div class="ctx-detail"><span>${esc(t("chip.corrupt.body"))}</span></div>`;
  if (open.has("retry") && call.retry) return `<div class="ctx-detail"><span>${esc(t("state.retryHint", { seconds: Math.round(call.retry.delayMs / 1000), n: call.retry.ordinal, max: call.retry.max }))}</span></div>`;
  if (open.has("reasoning")) return `<div class="ctx-detail"><span>${esc(t("chip.reasoning", { status: t("reasoning.kept") }))}</span></div>`;
  if (open.has("unclassified")) return `<div class="ctx-detail"><code>$.experimental</code></div>`;
  if (open.has("noUsage")) return `<div class="ctx-detail"><span>${esc(t("chip.noUsage.body"))}</span></div>`;
  return "";
}

function renderToolbar() {
  let el = panel.querySelector(".ctx-toolbar");
  if (!el) { el = document.createElement("div"); el.className = "ctx-toolbar"; panel.appendChild(el); }
  el.innerHTML = `
    <input class="ctx-filter" type="search" data-focus-id="filter"
      placeholder="${esc(t("filter.placeholder"))}" aria-label="${esc(t("filter.aria"))}" value="${esc(state.query)}">
    <button type="button" class="ctx-tool-btn" data-focus-id="expand">${esc(state.allExpanded ? t("tree.collapseAll") : t("tree.expandAll"))}</button>`;
  const input = el.querySelector(".ctx-filter");
  input.addEventListener("input", () => { state.query = input.value; renderTree(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && input.value) { input.value = ""; state.query = ""; renderTree(); e.stopPropagation(); }
  });
  el.querySelector("[data-focus-id=expand]").addEventListener("click", () => {
    state.allExpanded = !state.allExpanded;
    panel.querySelectorAll(".ctx-tree details").forEach((d) => { d.open = state.allExpanded; });
    renderToolbar();
  });
}

function renderTree() {
  const call = selectedCall();
  let tree = panel.querySelector(".ctx-tree");
  if (!tree) { tree = document.createElement("div"); tree.className = "ctx-tree"; panel.appendChild(tree); }
  tree.setAttribute("aria-label", t("tree.label"));

  const groups = visibleGroups(call);
  const filtered = state.query.trim() || state.bucket;
  const total = estimateOf(call);

  tree.innerHTML = groups.map((g) => {
    const gTokens = g.items.reduce((a, it) => a + it.tokens, 0);
    return `<section class="ctx-group" aria-label="${esc(t(`group.${g.id}`))}">
      <div class="ctx-group-head">
        <span class="g-name">${esc(t(`group.${g.id}`))}</span>
        <span class="g-count">${g.items.length}</span>
        <span class="g-pct">${total ? Math.round(gTokens / total * 100) : 0}%</span>
      </div>
      ${g.items.map((it) => renderItem(it)).join("")}
    </section>`;
  }).join("");

  if (groups.length === 0) {
    tree.innerHTML = filtered
      ? `<p class="ctx-empty">${esc(t("tree.emptyFiltered"))}<br><button type="button" class="ctx-tool-btn" data-focus-id="clearFilter">${esc(t("tree.clearFilter"))}</button></p>`
      : `<p class="ctx-empty">${esc(t("tree.emptyNone"))}</p>`;
    tree.querySelector("[data-focus-id=clearFilter]")?.addEventListener("click", () => {
      state.query = ""; state.bucket = null;
      renderToolbar(); renderBudget(); renderTree();
      panel.querySelector("[data-focus-id=filter]")?.focus();
    });
  }

  tree.querySelectorAll("details").forEach((d) => d.addEventListener("toggle", () => {
    if (d.dataset.itemKey) d.open ? state.openItems.add(d.dataset.itemKey) : state.openItems.delete(d.dataset.itemKey);
    if (d.dataset.partKey) d.open ? state.openParts.add(d.dataset.partKey) : state.openParts.delete(d.dataset.partKey);
  }));

  renderRaw(tree, call);
}

function renderItem(it) {
  const open = state.allExpanded || state.openItems.has(it.key);
  const single = it.parts.length === 1 ? it.parts[0] : null;
  const meta = [it.role];
  if (it.foldedCount > 0) meta.push(t("envelope.folded", { n: it.foldedCount }));
  return `<details class="ctx-item" data-item-key="${it.key}" style="--row-kind:${kindVar(it.bucket)}" ${open ? "open" : ""}>
    <summary>
      <span class="ctx-chevron" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      <span class="ctx-item-title" title="${esc(it.title)}">${esc(it.title)}</span>
      <span class="ctx-item-tokens">${num(it.tokens)}</span>
    </summary>
    <div class="ctx-item-body">
      <div class="ctx-meta">${meta.map((m) => `<span>${esc(m)}</span>`).join("")}<span class="ctx-path"><bdi>${esc(single?.path ?? it.path)}</bdi></span></div>
      ${single ? renderBody(single.body) : `<div class="ctx-parts">${it.parts.map((p) => renderPart(p)).join("")}</div>`}
    </div>
  </details>`;
}

function renderPart(p) {
  const open = state.allExpanded || state.openParts.has(p.key);
  return `<details class="ctx-part" data-part-key="${p.key}" style="--row-kind:${kindVar(p.bucket)}" ${open ? "open" : ""}>
    <summary>
      <span class="ctx-chevron" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      <code class="ctx-tag">${esc(p.tag)}</code>
      <span class="ctx-part-title" title="${esc(p.title)}">${esc(p.title)}</span>
      <span class="ctx-part-tokens">${num(p.tokens)}</span>
    </summary>
    <div class="ctx-part-body">
      <div class="ctx-meta">${p.toolCallId ? `<span>${esc(p.toolCallId)}</span>` : ""}${p.path ? `<span class="ctx-path"><bdi>${esc(p.path)}</bdi></span>` : ""}</div>
      ${renderBody(p.body)}
    </div>
  </details>`;
}

function renderBody(body) {
  return body.format === "json"
    ? `<div class="ctx-body"><pre><code>${esc(body.text)}</code></pre></div>`
    : `<div class="ctx-body">${esc(body.text).replaceAll("\n", "<br>")}</div>`;
}

/* E 区:逻辑请求(已脱敏),1 KiB 演示步长分页 */
const RAW_CHUNK = 1024;

function renderRaw(tree, call) {
  tree.querySelector(".ctx-raw")?.remove();
  const raw = call.raw;
  const shown = state.rawShown[call.id] ?? 0;
  const box = document.createElement("details");
  box.className = "ctx-raw";
  if (state.rawOpen) box.open = true;
  box.addEventListener("toggle", () => {
    state.rawOpen = box.open;
    if (box.open && raw.state === "available" && (state.rawShown[call.id] ?? 0) === 0) loadRawChunk(call);
    if (box.open && raw.state === "oversize" && (state.rawShown[call.id] ?? 0) === 0) loadRawChunk(call);
  });

  const done = shown >= raw.text.length;
  const paging = raw.state === "available" || raw.state === "oversize";
  const oversizeCapped = raw.state === "oversize" && done; // 演示:text 即展示预算内全部

  box.innerHTML = `
    <summary>
      <span class="ctx-chevron" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      <span class="ctx-raw-label">
        <strong>${esc(t("raw.title"))}</strong>
        <small>${esc(t("raw.summary", { state: t(`raw.state.${raw.state}`), bytes: num(raw.byteCount ?? raw.text.length) }))}${raw.topLevelOrder?.length ? ` · ${esc(raw.topLevelOrder.join(" → "))}` : ""}</small>
      </span>
      <button type="button" class="ctx-tool-btn" data-raw-copy ${raw.state === "unavailable" ? `disabled title="${esc(t("raw.state.unavailable"))}"` : ""}>${esc(state.copied ? t("raw.copied") : t("raw.copyAll"))}</button>
    </summary>
    <div class="ctx-raw-body">
      <p class="ctx-raw-note">${esc(t("raw.note"))}</p>
      ${raw.state === "available" || raw.state === "oversize" ? `
        <div class="ctx-raw-shape">
          <span>${esc(t("raw.shape", { n: raw.messageCount, m: raw.toolCount }))}</span>
          <div class="ctx-order">${raw.topLevelOrder.map((k, i) => `<span>${i > 0 ? `<i aria-hidden="true">→</i>` : ""}<code>${esc(k)}</code></span>`).join("")}</div>
        </div>` : ""}
      ${raw.state === "unavailable" ? `<p class="ctx-raw-note">${esc(t("raw.unavailableBody"))}</p>` : ""}
      ${raw.state === "corrupt" ? `<p class="ctx-raw-note">${esc(t("raw.corruptBody"))}</p><pre><code>${esc(raw.text)}</code></pre>` : ""}
      ${raw.state === "oversize" ? `<p class="ctx-raw-note">${esc(t("raw.oversizeBody", { bytes: num(raw.byteCount), shown: num(raw.text.length) }))} ${esc(t("raw.oversizeCopyNote"))}</p>` : ""}
      ${paging && shown > 0 ? `<pre><code>${esc(raw.text.slice(0, shown))}${oversizeCapped ? esc(`\n${t("raw.truncated")}`) : ""}</code></pre>` : ""}
      ${paging ? `
        <div class="ctx-raw-actions">
          ${!done ? `<button type="button" class="ctx-tool-btn" data-raw-more ${state.rawLoading ? "disabled" : ""}>${esc(state.rawLoading ? t("raw.loading") : t("raw.loadNext"))}</button>` : ""}
          <span class="ctx-raw-progress">${esc(t("raw.progress", { loaded: num(Math.min(shown, raw.text.length)), total: num(raw.text.length) }))} · ${esc(t("raw.demoStep"))}</span>
        </div>` : ""}
    </div>`;

  box.querySelector("[data-raw-more]")?.addEventListener("click", () => loadRawChunk(call));
  box.querySelector("[data-raw-copy]")?.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); copyRaw(call); });
  tree.appendChild(box);
}

function loadRawChunk(call) {
  if (state.rawLoading) return;
  state.rawLoading = true;
  renderTree();
  setTimeout(() => {
    state.rawShown[call.id] = Math.min((state.rawShown[call.id] ?? 0) + RAW_CHUNK, call.raw.text.length);
    state.rawLoading = false;
    renderTree();
  }, 180); // 模拟异步取块
}

async function copyRaw(call) {
  const text = call.raw.text;
  let ok = true;
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      ok = document.execCommand("copy");
      ta.remove();
    }
  } catch { ok = false; }
  state.copied = ok;
  announce(t(ok ? "raw.copied" : "raw.copyFailed"));
  renderTree();
  setTimeout(() => { state.copied = false; if (selectedCall()?.id === call.id) renderTree(); }, 1400);
}

/* ------------------------------------------------------------ demo chrome --- */

const DEMOS = ["normal", "loading", "empty", "noUsage", "aborted", "interrupted", "rawUnavailable", "corrupt", "oversize", "filterEmpty"];

function initDemoChrome() {
  const stateSel = $("#demoState");
  const fillStates = () => {
    stateSel.innerHTML = DEMOS.map((d) => `<option value="${d}" ${d === state.demo ? "selected" : ""}>${esc(t(`demo.s.${d}`))}</option>`).join("");
  };
  fillStates();

  $("#demoLang").addEventListener("change", (e) => {
    lang = e.target.value;
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    fillStates();
    renderAll();
  });

  const mq = matchMedia("(prefers-color-scheme: dark)");
  const applyTheme = (mode) => {
    const dark = mode === "dark" || (mode === "auto" && mq.matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  };
  $("#demoTheme").addEventListener("change", (e) => applyTheme(e.target.value));
  mq.addEventListener("change", () => applyTheme($("#demoTheme").value));
  applyTheme("auto");

  stateSel.addEventListener("change", (e) => {
    state.demo = e.target.value;
    state.calls = buildDemoCalls(state.demo);
    state.selectedId = null;
    state.follow = true;
    state.followNew = 0;
    state.rawShown = {};
    state.rawOpen = false;
    state.chipsOpen = new Set();
    state.query = state.demo === "filterEmpty" ? "no-such-text" : "";
    renderAll();
  });

  $("#demoAppend").addEventListener("click", () => {
    if (state.demo !== "normal") return;
    const calls = state.calls;
    const running = calls.find((c) => c.status === "running");
    if (running) {
      running.status = "success"; running.finish = "stop";
      running.endedAt = Date.now();
      running.usage = { inputTokens: 6104, outputTokens: 458, cacheReadTokens: 2048 };
    }
    const step = calls.length + 1;
    const c = { id: `c${step}`, turn: 3, step, attempt: 1, provider: "deepseek", model: "deepseek-chat",
      startedAt: Date.now(), status: "running", source: "stream-record", recordCompleteness: "complete",
      groups: makeGroups("normal"), raw: { state: "available", topLevelOrder: [], text: "" } };
    fillRaw(c);
    calls.push(c);
    if (state.follow) {
      state.selectedId = c.id;
      announce(t("follow.announce.new", { n: step }));
      announce(t("follow.announce.switch", { n: step }));
    } else {
      state.followNew += 1;
      announce(t("follow.new", { n: state.followNew }));
    }
    renderAll();
  });

  const shell = $("#panelShell");
  const range = $("#demoWidth");
  range.addEventListener("input", () => {
    shell.style.width = `${range.value}px`;
    $("#demoWidthOut").textContent = `${range.value}px`;
  });

  /* 追加按钮仅 normal 演示可用 */
  setInterval(() => { $("#demoAppend").disabled = state.demo !== "normal"; }, 400);
}

/* running 计时 tick:仅更新耗时文本,不重渲染 */
setInterval(() => {
  const call = selectedCall();
  const el = $("#ctxDuration");
  if (call?.status === "running" && el) el.textContent = t("status.runningFor", { duration: fmtDur(Date.now() - call.startedAt) });
}, 1000);

/* error 演示:assertive 播报一次(state-matrix §4) */
const origRenderAll = renderAll;
renderAll = function () {
  const before = selectedCall()?.id;
  origRenderAll();
  const call = selectedCall();
  if (call?.status === "error" && call.id !== before) announce(t("announce.callFailed", { n: state.calls.indexOf(call) + 1, message: call.failure.message }), true);
};

initDemoChrome();

/* 支持 #state=oversize&lang=en&theme=dark 直达演示态(便于测试与分享) */
(function applyHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const fire = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new Event("change")); };
  if (p.get("lang") === "en") fire("#demoLang", "en");
  if (["light", "dark", "auto"].includes(p.get("theme"))) fire("#demoTheme", p.get("theme"));
  if (DEMOS.includes(p.get("state"))) fire("#demoState", p.get("state"));
  const w = parseInt(p.get("width") ?? "", 10);
  if (w >= 240 && w <= 720) { const r = $("#demoWidth"); r.value = String(w); r.dispatchEvent(new Event("input")); }
})();

state.selectedId = state.calls.at(-1)?.id ?? null;
renderAll();
