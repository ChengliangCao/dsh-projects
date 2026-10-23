# 方案评审：`docs/dsh-claude-projects-plan.md` 的 DSH 可行性与 API 准确性

> 评审对象：`/Users/ignis/workspace/dsh-plugins/docs/dsh-claude-projects-plan.md`
> 评审时版本：893 行，mtime 2026-10-22 14:09，md5 `eed30fd7a23c650fbd7dd724f78550f3`（§3.4 已含上一轮修订）
> 评审依据：R2/R3（`research/dsh-capabilities/{README,extensions}.md`）、asar 内包 README、包 `lib/*.js` 实现细节、live `cordis_inspect_query`（Host Service/Event/Tool/Config）。
> 只列「说得到但实际做不到」或「证据不支持/证据引用错误」的点，按 阻塞 / 风险 / 建议 分级；每条给章节、证据与可执行修改。**不改方案本体。**

---

## 0. 结论速览

| 级别 | 数量 | 内容 |
|---|---|---|
| **阻塞** | 3 | K1 子会话审批不可见不可批（B 方案核心假设之一不成立）；K2 完成通知不可靠（父 Agent 非 live 时静默丢弃）；K3 `startActivation` 调用形状写错（照写会失败，且缺 `request.parent` 前置） |
| **风险** | 11 | Remote/包名引用错误、上传/Desktop 逃生口/沙箱/归档/包组装/Typer 工作量/用量数据源/子会话地址等 |
| **建议** | 6 | 文档自洽、Client 构建、数据源与 M0 验收补充 |

**整体判断**：§3.3 domain 选型、§3.6 Library 归属、§3.9 大部分边界、§4.1 拆分思路、§4.6 主要 seat 落点都站得住；**但 §3.4 的 B 方案推荐建立在两个未验证/实际不成立的假设上**（子会话可审批、完成通知可依赖），且 §4.5/§4.7 有两处会直接卡住实施的具体 API 形状问题。建议维持 B 为 MVP 载体，但把「线程汇报/状态」改为 **domain 台账为唯一可靠来源**，把「审批」需求分流到 A 方案或预授权，并在 M0 增加 K2/K3 两项验证。

---

## 1. 阻塞项

### K1【阻塞】§3.4（M0 验证项③）、§3.9、§7-R2：in-process 子会话的审批提示**不会**呈现给用户，也无法在线程内批准

**文档说法**：
- §3.4 M0 验证项 "② 后台运行线程的权限提示是否可被用户看到/批准（`pendingInteraction` 投影是否覆盖子会话）"；
- §3.9 "**审批必须在发起线程内完成**：DSH 审批 prompt 绑定 session；项目页提供「打开线程」入口"；
- §7-R2 "子会话后台审批无人可见 → M0 验证 pendingInteraction 覆盖子会话；不行则 watcher 监听 approval 事件 + Overview 标 Waiting on you"。

**实际行为（证据）**：
1. `$ASAR/node_modules/@deepseek-ai/dsh-subagent/README.md` §Model Experience → "Child delegation-scope statement"：**Every in-process child** 的 runtime-context 固定包含：
   > "You are a delegated subagent: your permission scope was fixed when you were started and cannot be widened from inside this session — **operations that require approval are rejected automatically**. When the job needs access beyond that scope, do not retry the denied operation; state the limitation in your reply so the delegating agent can handle it."
2. 本会话就是 in-process 子会话，其 runtime context 实测包含同一句（同一位 teammate 被 Lead spawn）。
3. `$ASAR/node_modules/@deepseek-ai/dsh-experimental-auto-review/README.md` 明确：**"A delegated in-process child pins the `never` policy, so its denials are final."**
4. `$ASAR/node_modules/@deepseek-ai/dsh-user-approval/README.md`：`never` 策略"is enforced inside the service **before waterfall dispatch**，a listener registered later with `prepend` cannot bypass the deterministic rejection" → **即使 Project 插件自己注册 `approval/request` answerer，也收不到子会话的请求**（子会话被 pin 为 `never`，不是 `ask`）。
5. `pendingInteraction` 类信息（approval/plan review/question）对子会话**不会**产生 approval 项；线程不会进入 "Waiting for approval"。

**影响**：B 方案无法满足"用户必须在线程内 steer/批准"这条从 Claude 抄来的边界；M0 ③ 按现在的写法必然失败，而它被列为决定 B 是否成立的关键验证项之一。

**可执行修改**：
- §3.4 M0 ③ 改为："验证子会话越权（需 approval）时的失败形态与错误文案，并确认 '线程内审批' 在 in-process 子会话不可达"。
- §3.9 删除"审批必须在线程内完成"，改为三选一的设计决策：
  (a) **线程只做当前权限内可完成的工作**，越界即失败并在 report 中说明，由协调者/用户改派给方案 A 线程；
  (b) **方案 A（顶层 Session）承担需要审批的线程**（顶层 Session 有原生审批 UI，且用户可打开、批准）；
  (c) 预授权：spawn 线程时用更宽的固定权限（`danger-full-access` 或受控 escalation），代价与风险需产品确认。
- §7-R2 取消"watcher 监听 approval 事件"的对策（不可达），改为上述 (a)/(b)/(c) 之一。

---

### K2【阻塞】§3.4（完成通知行 + 推荐理由）、§3.5、§4.7："线程完成后父会话自动收到完成通知"不能作为可靠机制

**文档说法**：
- §3.4 "完成通知协调者：✅ `delivery:'parent'` 会向父会话发模型可见的完成通知（每次 activation 结束…）"；
- §3.4 推荐理由："线程做完后『汇报回项目对话』在子会话层是**内建行为**（parent completion notice）"；
- §4.7 "线程子会话 turn 结束 → **父会话完成通知** → 协调者可按需汇总"；`project_report` → "台账 + **协调者 inbox**"。

**实际行为（证据）**：
1. `$ASAR/node_modules/@deepseek-ai/dsh-subagent/lib/types/manager.js` 的 `notifySettlement()`：
   ```js
   const parent = this.ctx.agents.get(activation.parent.id);
   if (parent !== activation.parent) return;   // 父 Agent 不在 live registry → 通知被静默丢弃
   ```
   没有 durable 记录、没有重试、没有错误（仅后续 code path 的异常才会 logger.warn）。
2. `$ASAR/node_modules/@deepseek-ai/dsh-subagent/lib/index.js` 的 Remote `subagents/prompt` handler：
   ```js
   const parent = this.ctx.get("agents")?.get(parentSessionId);
   if (parent === void 0) throw new RemoteError("subagent/parent-unavailable", `parent session "..." is not live`, ...);
   ```
3. 协调者 Agent 是否 live 由客户端 retain/handle 决定；用户切到 Projects 页、关闭对话、或 Host 重启后，协调者可能已不在 live registry（会话仍在列表中，可 cold 展示）。此时：线程完成 → 通知被丢弃；用户在项目页点线程发消息 → `subagent/parent-unavailable`。
4. `send_message`（子→父）同样要求 exact live parent（README Known Limitations：**"A direct parent must remain live for child-to-parent delivery — the service has no durable parent mailbox"**）。

**影响**：方案把"汇报回协调者"押在 completion notice 上，可靠性不足；长时间线程（用户不在项目对话时）几乎必然丢通知。

**可执行修改**：
- 把"线程汇报"的唯一可靠来源定为 **`projects` domain 台账**：
  - `project_report` 工具**只写 domain**（durable），不依赖 inbox；协调者每次被唤醒/被要求汇总时用 `project_list_threads`/`project_brief` 拉台账；
  - Host 侧监听 `subagent/end`（Event 目录实测存在："A published child settled"）更新台账状态，作为通知之外的二级信号；
  - 可选：协调者 live 时再补一条 inbox 通知（best-effort），但不得作为正确性依赖。
- §3.4 "完成通知"行改为"best-effort，仅当协调者 Agent live；可靠性由 domain 台账保证"。
- M0 增加验证："子会话运行期间 dispose 协调者 Agent → 通知是否丢失、`subagents/prompt` 报错码、`subagent/end` 是否仍触发"。

---

### K3【阻塞】§3.4（创建行）、§4.7：`startActivation` 的调用形状写错；且缺少「协调者 Agent 必须 live」的前置

**文档写法**：
- §3.4 创建行：`ctx.subagents.startActivation({provider:'spawn', request:{prompt, agentOptions:{agentPreset}}, delivery:'parent'})`；
- §4.7：`ctx.subagents.startActivation(spawn, {prompt: 项目简报+任务, agentPreset: projects-thread, delivery:'parent'})`。

**实际签名（证据：`$ASAR/node_modules/@deepseek-ai/dsh-tool-subagent/lib/index.js` 的 request 构造 + `startActivation` 调用；`dsh-subagent/README.md` line 61/65）**：
```js
const request = {
  ...(args.cwd === undefined ? {} : { cwd: args.cwd }),
  prompt: [{ type: 'text', text: args.prompt }],   // ContentBlock[]，不是 string
  parent,                                          // 必填：exact live parent Agent
  ...(agentPreset === undefined ? {} : { agentPreset }),   // ← 顶层，不在 agentOptions 里
  ...(agentOptions === undefined ? {} : { agentOptions }),
  ...(maxDepth === undefined ? {} : { maxDepth }),
};
await ctx.subagents.startActivation({ provider, label, request, signal, delivery: 'parent' });
```
即：`agentPreset` 是 `request` 的顶层字段；`prompt` 是 `ContentBlock[]`；`request.parent` 必填且必须是 live `Agent`。

**影响**：
1. 照文档写会 type/运行期失败（agentPreset 丢失 → 线程跑的是父 preset；prompt 类型不符）。
2. 更关键：`request.parent` 需要 `ctx.agents.get(coordinatorSessionId)` 返回 live Agent。项目页/定时任务在协调者会话 cold 时 spawn 线程会直接失败（或必须冷唤醒协调者）。文档 §4.7 未包含这一步。
3. `provider` 在 spec 层，不在 request 内。

**可执行修改**：
- 修正 §3.4 表与 §4.7 的伪代码；`spawnThread` 实现步骤补一行："确保协调者 Agent live：`ctx.agents.get(coordinatorSessionId)`，否则走 `agentLoop.resume/createAgent`（或要求 UI 先打开协调者会话）"。
- 若走 Host 内部直接创建 Agent，review 一下 `agentLoop.createAgent(ownerCtx, options)` / `resume`（live Service `agentLoop` 方法已实测存在），并持有 `AgentHandle` 以维持生命周期。

---

## 2. 风险项

### R1【风险】§2.3：Send/Stop 能力的包名/Remote 名引用错误
- 文档："`dsh-api-session-controller`：Client Remote `session` 的 list/create/...；**child composer 支持 Send/Stop、父会话离线时锁定**"，证据标注 `dsh-client-ui-conversation README`。
- 实际：
  - 子会话"发送"走 **`subagents/prompt`**（`dsh-subagent` 的 Remote，由 `dsh-api-remotes` 挂到 Client）：请求 shape `{requestId, parentSessionId, childSessionId, mode:'continuable', delivery:'queue'|'steer', content, clientTimeZone?}`；要求 parent Agent live，否则 `subagent/parent-unavailable`（= 文档所谓"父会话离线时锁定"）。
  - 子会话"停止"走 **`subagents/interruptByParent(childSessionId, parentSessionId, 'continuable')`**；其 JSDoc 明确 "No catalog, history, persistence, or parent Agent lookup runs … keeps a live child interruptible **while its parent Agent is offline**"。
  - `session/prompt` 的 schema 只有 `{requestId, sessionId, mode, content}`（**无 address/childSessionId**）；`session/cancel` 对 subagent session 会抛 `session/agent-busy`（ownership 错误，见 controller 源码）。
- 修改：§2.3 与 §3.4 中把 Send/Stop 的证据改为 `dsh-subagent`（`subagents/prompt` / `subagents/interruptByParent`），并删除"`dsh-client-ui-conversation` README"这一错误引用。

### R2【风险】§3.4：方案 A 的 `steer/stop` 判断过保守（"未验证 U5、风险中高"）
- 实际：`dsh-api-session-controller` 的 Host service 方法可以直接调用：
  - `prompt({requestId, sessionId, mode, content})`（会让 session resume；schema 已实测）；
  - `cancel({sessionId})`（实现 `const agent = this.ctx.agents.get(request.sessionId)` → 运行中的顶层 session 必然 live；对 subagent 才有 ownership 拒绝）。
  → A 方案的控制面**已可确认可行**；A 的真实成本是"完成/失败观测需自建 watcher + 无 hide API + 侧栏污染"。
- 另外 §3.4 A 行写的 watcher 例子 `api-session/activity` **不能当完成信号**：Event 定义是 "One **user-authored** durable message advanced Session list activity"，只在用户消息时触发。应使用 `session/event`（过滤 `turn/end`/`assistant/message`）或 `agent/status`，或 `subagent/end`（若用子会话）。
- 修改：A 风险降为"中"；watcher 证据改为 `session/event`/`agent/status`；U5 结论可直接写入（命令：`ctx.sessionController.prompt/cancel` 可从 Host 插件调用）。

### R3【风险】§2.2/§3.10/§6：线程内"仍可再用 subagents"在默认配置下不成立
- in-process 子会话的 header `delegationDepth` = 父+1；Host 设置 `subagent.maxDepth` 默认 1（`dsh-subagent README`），`maxDepth` 是"absolute delegation-depth cap"。→ 线程（depth=1）再 spawn 会被拒。
- `maxActiveSubagents` 默认 8 且整棵 activation tree 共享（含 workflow children），不是每项目独立。
- 修改：§2.2 线程能力表加注"默认不可再委派；如需，调高 Host `subagent.maxDepth` 并接受嵌套成本"；§3.10 限额表补"共享 `maxActiveSubagents`"。

### R4【风险】§3.6：Library 上传链路依赖 session 级 receipt，项目页可能没有 live coordinator
- 文档："浏览器 `ctx.fileUpload.upload(coordinatorSessionId, blob, name)` → Host receipt → `projectLibrary.addUpload(receipt)`"。
- 实际：Host `fileUploads` 的 `upload(agent, request)` / `resolve(agent, receiptId)` 都以 **Agent** 为参数（`dsh-client-file-upload` Host 面），receipt 生命周期绑定"receiving Agent's exact Session"；Projects 页面本身不是会话，若协调者未 attach，上传/解析可能失败或触发冷唤醒。
- 建议：Library 自带一条 **`ctx.connection.fetch.register`** 的 raw upload 路由（官方先例：`dsh-client-file-upload/lib/index.js` "Authenticated raw-byte upload route registered on the Connection fetch registry"，`ctx.connection.fetch.register({path, methods:['POST'], ...})`），不依赖 session receipt；M0 验证 raw route + Desktop。

### R5【风险】§4.5 路径 2：`ctx.webServer.register` 在 Desktop 上可能不可达
- 证据：`dsh-client-connection/README.md`："When a Web carrier is present it also owns the sole `/api` route, Fetch bridge…；**a shell-owned carrier dispatches the shared Fetch handler directly**"；`dsh-host-webserver/README.md`："It serves browsers only; **Electron loads dist over `file://` and carries fetch over an IPC bridge**"。
- 即 Desktop 渲染层不直接访问 Host 的 HTTP 命名路由；`webServer.register` 的新路径在 Desktop 渲染器内不可达（除非另做 IPC 桥）。
- 正确逃生口：**`ctx.connection.fetch.register`**（carrier-neutral，Web 与 Desktop shell carrier 都走 shared Fetch handler；file-upload / session-log-export 均用它）。exact route 对 non-owner Peer 返回 403，owner 由 `connection.admit` 建立——鉴权按此语义写，而不是"复用 cookie"。
- 修改：§4.5 路径 2 改为 `ctx.connection.fetch.register`；§7-R1 的对策同步改。

### R6【风险】§3.6/§3.10/§6：Library 落盘与沙箱的三处细节不准确
1. **读取不受沙箱限制**：`dsh-fs-sandbox` 只 fence mutation（"Reads, listings, metadata … work exactly as with `fs-local`"）。所以"线程读不到 Library → materialize"的理由不成立；materialize 是产品选择（统一路径/权限语义），不是必须。
2. **Host 写 `~/.dsh/projects/**` 可能被 fs-sandbox 拒绝**：`writeText(..., sandboxPolicy?)` 在 fs-sandbox 下按 policy 执行；agentless Host 调用回退到部署默认（本机 `workspace-write`，fallback root=`process.cwd()`）→ 写 home 目录会 `FS_SANDBOX_DENIED`。Library 写入应用 `node:fs`（受信 Host 代码）或显式宽 policy，M0 验证。
3. **materialize 后副本可写**：把库文件拷进线程 workspace（`workspace-write` 内）后，线程可改副本，与"库只读"语义冲突；需定义"一次性快照/可丢弃副本"或放到 workspace 外的只读路径（但那样读不经过 fs 工具即可）。
- 修改：§3.6 区分"读"与"写"；§6 差异表 "Library 挂载"行的"沙箱安全"表述改为"写入由 Host 受信代码负责；线程侧只读（通过工具）"。

### R7【风险】§3.11：Archive 级联不需要、也不建议逐线程 archive
- 现状：`workspaceRegistry` 没有 hide，只有 archive/unarchive；`ArchivedSessionGate` 依据 **header lineage** 拒绝已归档 Session 及其 subagent 子孙的新 step（`dsh-api-session-controller README`）。`workspace/session-activity` 的提供者会把线程子会话作为 `subagent` family 报告，`archiveSession(coordinatorSessionId,{stopActivity:true})` 会以 parent-cause 停止它们（`dsh-subagent README` "This runtime answers archive admission for children…"）。
- 逐线程 `archiveSession(childSessionId)` 的语义不确定（子会话通常不是 workspace 成员、侧栏本就不显示），可能产生"已归档子会话无法在 UI reopen/不可见"的边缘状态。
- 修改：§3.11 Archive 行改为"只 archive 协调者会话（stopActivity）；线程由 lineage gate 阻挡、由 parent-cause 停止；Unarchive 协调者即整体恢复"。

### R8【风险】§4.2：patch 草案的三行同名（`@deepseek-ai/dsh-project`）会被实例化三次
- 虽然 Loader 允许同 package name 多行（base 里 `tool-subagent` / `tool-subagent-fork` 即同 name），但那是**同一个插件以不同 config 实例化两次**；若该插件在 apply 里注册同名 service/projection unit，第二次会 duplicate 失败。§4.2 的 `project` / `project-library` / `project-context` 三行都写同一个 bare name，等于把同一 `apply` 跑三遍。
- 修改：为每个入口声明独立子路径导出（`@scope/dsh-project/library`、`/context`，precedent：`dsh-tool-subagent-control/list-agents`，Loader 行 `name` 用子路径 specifier），各自有独立 `apply`；或直接拆 3 个包。另：外部插件不要占用 `@deepseek-ai/` 官方 scope（发布/解析冲突），用自有 scope 或裸包名。

### R9【风险】§2.3/§3.7：`session-stats` 不是用量
- `dsh-web-app/cordis.patch.yml` 对 `session-stats` 的注释："Whole-log **turn/step counts** for the chat stats strip (the `sessionStats` projection key)"。token 用量应取 **`tokenUsage`** projection（schema 实测含 `uncachedInputTokens/outputTokens/cacheReadTokens/cacheWriteTokens`）或 `dsh-token-meter`。
- 修改：§3.10/§3.7 数据源改为 `projectionsBySession[...].values.tokenUsage`；`session-stats` 仅用于 turn/step 计数。

### R10【风险】§4.6：打开线程必须传 subagent address，裸 sessionId 会被拒
- `sessionController` 的 `validateAddress`：对 `kind:'session'` 且 `header.origin==='subagent'` 会抛 `session/agent-busy`（"subagent Sessions require their durable parent address"）。即打开线程要用 `{kind:'subagent', parentSessionId, childSessionId, mode:'continuable'}`。
- `ctx.uiWorkspace.openSession(target)` **支持**：`ui-workspace/lib/client.js` 内部 `replaceMain(saved.subagentAddress, ...)`，说明 target 可为 subagent address（✅ 文档"可由 addressed 地址打开"成立，但需写清 target 形状）。
- 修改：§4.6 表格"线程行状态/打开"补 target 形状；并注明 `session/page`、`session/follow` 的 `address` 支持 subagent（已实测 schema）。

### R11【风险】§4.5 路径 1：手写 Typert 的工作量与依赖被低估
- `createTypertRemoteInfo(spec, z)` 只负责构造描述符；全链还需要：`ctx.typert.register(contribution)`（Host）、client `ctx.remote.$mount()`、`typert.resources` 注册资源 kind（非 owner 访问要接 `remoteAccess`）、strict codec 的 Zod factory、流式方法的 `mode:'stream'`/uplink 约定。任一处不匹配都会在 mount 阶段失败。
- 建议：把 **`connection.fetch.register` 原始路由列为 M0 首选**（官方先例、无需 codegen、不受 Typert 演进影响），手写 Typert 降为 M3 优化；若产品接受，也可只做 unary + SSE 两条 raw 路由。
- 该条不否定文档"先 spike 手写 Typert"的意图，但建议调整优先级与工作量估计。

---

## 3. 建议项

| # | 章节 | 问题 | 建议 |
|---|---|---|---|
| S1 | §3.1 vs §4.4 | 原则说"协调者工具面 ~10 个以内"，§4.4 表列了 14 个（brief/spawn/list/send/stop/resolve/reopen/propose/remember/forget/library_list/library_add/report = 13+） | 统一为 ≤10，或把 propose/remember/forget/library_* 合并成参数化工具 |
| S2 | §4.1 | "5 个包（含 bundle）"与后文"先用 3 个 Host 包（1 核心、1 工具、1 会话命令）"不一致，且列表中无"会话命令"包 | 统一包数与职责命名 |
| S3 | §4.1/§4.6 | Client 包构建：外部无 DSH 的 client build tooling；`lib/client.js` 必须是 lazy-CJS factory 格式 | 用 `cordis-plugin-development` 模板（`templates/decoration/client.js`，plain JS + module table 的 React）起步；或自建 tsdown 产出同格式并在 M0 验证加载/HMR |
| S4 | §3.7 | Overview 数据源：`useSessions` + `pendingInteraction` 之外，**`session/list` 行本身含 `parentSessionId`**，子会话也在列表中（侧栏只是 UI 过滤） | 用 `parentSessionId ∈ project.threadSessionIds` 聚合线程状态；`tokenUsage` 供用量；`pendingInteraction` 只覆盖 question/plan 类（approval 对子会话不会出现，见 K1） |
| S5 | §3.3 | domain 选型与磁盘布局 OK（`defineDomain` 导出已实测；`~/.dsh/storages/<unit>.json` 与 workspace.json 同构） | 保留；建议把"每个 project 的 library/memory 目录"也纳入 domain 记录（便于导出/删除一致） |
| S6 | §10 | 文档证据清单未包含本轮新增结论 | 引用本评审（`research/dsh-capabilities/review-plan.md`）：子会话 pin `never`、通知丢弃、`subagents/prompt`/`interruptByParent`、`connection.fetch.register`、`tokenUsage` |

---

## 4. 被评审但**成立/被支持**的关键点（避免误伤）

| 文档说法 | 结论 | 证据 |
|---|---|---|
| 「子会话在侧栏隐藏，但可由项目页 addressed 地址打开」 | ✅ 成立 | `dsh-client-ui-workspace/README.md`（subagent-origin Sessions remain hidden）；`session/page`/`follow` 的 address schema 实测含 `kind:'subagent'`；`ui-workspace` 客户端 `replaceMain(saved.subagentAddress,...)`；`dsh-experimental-client-ui-agent-team` 即用 addressed 地址打开成员会话 |
| 「线程能发消息、能 Stop；父会话离线时 Send 受限」 | ✅ 成立（但归属要改） | Send = `subagents/prompt`（要求 parent live，否则 `subagent/parent-unavailable`）；Stop = `subagents/interruptByParent`（parent 离线也可停）。**不是** `session.prompt/cancel`（R1） |
| 「子会话也是完整 event-sourced Session，可冷恢复」 | ✅ 成立 | `dsh-subagent README`（Local children accept later messages and can cold-resume；需 persistence+Session query）；冷恢复仍受 `maxActiveSubagents` 限制（capacity → `subagent/delivery-unavailable`） |
| §3.3 domain 选型（新 domain、single 布局、不改 SessionHeader） | ✅ 成立 | `dsh-storage-domain` 导出 `defineDomain`；`dsh-storage-json` single layout `<unit>.json`；`appendPluginRecord` 限仓库内 experimental 包（R2 G1） |
| §2.4 G1–G5 / C1–C4 缺口清单 | ✅ 与 R2 一致 | R2 §8；无新增硬缺口 |
| §4.6 主要 UI seat（main/panellist/header/sidebar.right.pane.tab/会话行菜单） | ✅ 成立 | R3 §1；`ui-layout`/`ui-sidebar`/`ui-conversation`/`ui-sidebar-right`/`ui-workspace` README 与 bundle 字符串 |
| 「协调者会话 = 普通 Session + preset，不需要新运行器」 | ✅ 成立 | `dsh-agent-preset`/`registry`；`session/create` 支持 `agentPreset` |
| 「Pause 用 interrupt 停线程」 | ✅ 可行 | Host 可调 `ctx.subagents.interrupt(childId, {kind:'user', parentSessionId})`，其设计允许 parent 离线 |
| 「删除项目 = 删 domain + 目录，会话归档不物理删」 | ✅ 成立 | 无 session delete API；只有 workspace archive（R2 §6） |

---

## 5. 需要补进 M0 的验证项（替换/新增）

| # | 验证项 | 通过标准 | 对应发现 |
|---|---|---|---|
| V1 | 子会话越权/审批行为 | 确认 `never` pin（请求被自动拒绝、无 UI）；记录错误文案 | K1 |
| V2 | 协调者 Agent 非 live 时的线程行为 | `subagents/prompt` 返回 `subagent/parent-unavailable`；`subagent/end` 仍能被 Host 观测；通知确认丢失 | K2 |
| V3 | `startActivation` 正确形状 + live parent | 独立 preset 生效、简报为 ContentBlock、`request.parent` 为 live Agent；协调者 cold 时 spawn 的恢复路径 | K3 |
| V4 | 线程地址与 UI 打开 | `openSession({kind:'subagent',...})` 可打开；线程 composer 可发（协调者 live）/Stop（协调者离线） | R10 |
| V5 | 项目页上传（协调者未打开） | raw 路由（`connection.fetch.register`）可完成上传并落库；Desktop + Web 都验证 | R4/R5 |
| V6 | Library 宿主写入 | Host 侧写 `~/.dsh/projects/**` 不被 fs 沙箱拒绝（node:fs 或显式 policy） | R6 |
| V7 | 手写 Typert vs raw route | 二选一跑通 unary + stream；记录工作量 | R11 |

---

## 6. 一句话给作者

方案骨架（domain + 协调者 preset + 工具面 + 项目页 + 右侧栏 tab + 分阶段）是对的；**需要改的不是架构，而是 §3.4/§3.9 里两个 DSH 语义假设**：子会话审批不可见（pin `never`）与完成通知不可靠（父 Agent 非 live 即丢弃）。把"状态/汇报"落到 domain 台账、把"需审批的活"分流给顶层 Session，B 方案仍然可做，且 M0 的验收标准应据此重写。
