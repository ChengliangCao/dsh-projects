# M0 可行性 Spike 计划（3–5 天）

> 目标：在真正写 M1 之前，用最小 demo bundle 验证 11 个关键假设，锁定线程载体（A：顶层 Session）、自研记忆骨架、Remote/Library 写入与状态同步方案。
> 环境：DSH 0.2.1-rc.2（desktop profile，GUI http://127.0.0.1:61863）；工作目录 `/Users/ignis/workspace/dsh-plugins`。
> 决策依据：[方案 v1.2](../docs/dsh-claude-projects-plan.md)、[ADR 0001](../docs/decisions/0001-plugin-first-open-source.md)、[ADR 0002](../docs/decisions/0002-self-built-project-memory.md)、[M0 表](../docs/dsh-claude-projects-plan.md#m0--可行性-spike35-天)。

---

## 0. 准备与边界

1. **使用独立 scratch profile**（例如 `projects-spike`），不动 `desktop` profile；装完可整包卸载。
2. 安装动作需要用户批准（`plugin_manager` / `dsh plugin add`）；开发期先在 workspace 跑 `pnpm install / typecheck`，不提前写 profile。
3. 所有 spike 代码放在本仓库 `spike/` 或各 package 的 `src/` 下，标记 `SPIKE:`；M0 结束后删除或转正。
4. 不写自定义 session event；不修改 DSH 安装包与 `~/.dsh` 既有数据（新增项目目录除外）。

---

## 1. 验证清单（11 项）

| # | 假设 | 方法 | 通过标准 | 证据产物 |
|---|---|---|---|---|
| 1 | 顶层 Session 可作线程：`sessionController.create({cwd, agentPreset, sessionId})` + `prompt({requestId, sessionId, mode:'queue', content})` | 在最小 Host 插件里用 `ctx.sessionController` 创建一个 session（独立 cwd + `projects-thread` preset）并注入简报 | session 独立运行、preset/cwd 正确、简报进入历史 | 截图 + session log 片段 |
| 2 | 线程可冷恢复 | 线程跑完一个 turn 后再次 `prompt` | 上下文连续、历史不丢（重启 DSH 后再试一次） | 两次 transcript 对比 |
| 3 | 线程内审批可被用户看到并批准（A 方案关键前提） | 让线程触发一次需审批的 bash；在 Web UI 打开该线程 | 线程会话内出现审批、批准后继续；`pendingInteraction` 可在项目侧感知 | 截图 + 状态投影值 |
| 4 | 线程打开/steer/stop | `ctx.uiWorkspace.openSession(sessionId)`；`sessionController.prompt(mode:'steer')`、`cancel` | 能看 transcript；steer 在最近 step 生效；stop 中止当前 turn | 录屏/截图 |
| 5 | Project domain + 手写 Remote（或 Connection fetch 路由）端到端 | 最小 `projects` domain + 一个 `project.list` unary；Client 读列表 | 浏览器与 Desktop 都能读到 | Remote 响应 + 截图 |
| 6 | watcher：线程 `turn/end` → 汇报注入协调者（去重/防打扰） | 订阅 `session/event` 的 `turn/end`，把线程 report 以 prompt 注入协调者；测试协调者正在跑时 | 只注入一次、不打断当前 turn、可被用户忽略 | watcher 日志 + 对话截图 |
| 7 | 备选 B（可续跑子会话）对照 | `subagents.startActivation` 正确 request 形状；父 live/离线行为；审批限制 | 记录 A/B 成本与限制对比；明确 B 不承诺线程内审批 | 对比表 |
| 8 | Library Host 写入 `~/.dsh/projects/**` 的沙箱策略 | 用 `node:fs` 与 `ctx.fs` 各写一次 | 至少一条路径成功且可读回；记录被拒的策略与错误码 | 错误日志 + 成功路径 |
| 9 | Desktop 下 Client↔Host 逃生口 | `ctx.connection.fetch.register` 注册认证路由；浏览器 + Desktop 各请求一次 | 两者都可达；鉴权正确 | 响应码 + 截图 |
| 10 | 协调者会话归档/dispose 后线程仍可用；台账完整 | 归档协调者会话后打开线程、发消息 | 线程可继续；状态从 domain + session 读取正确 | 状态快照 |
| 11 | **自研 Memory 骨架** | 见下方 §2 | 6 条验收全过 | 测试输出 + 注入内容 |

---

## 2. Memory 骨架 spike（ADR 0002）

### 2.1 验证点

1. **注入**：`ctx.systemPrompt.section({ order: 4000 })` 动态段；空存储注入 0B；4KB 预算内截断并带标记；每步重评估（写入后下一个请求可见）。
2. **存储**：`~/.dsh/projects/<projectId>/memory/MEMORY.md` + `notes/<slug>.md`；frontmatter `name/description/type/modified`；四类型。
3. **scope**：项目目录属于 git repo 时按 repo 派生（同 repo 两个 worktree 共享）；非 git 项目退回项目目录；user scope 独立。
4. **原子写/锁**：`@deepseek-ai/dsh-atomic-write` 的 `withFileLock` + `writeFileAtomic`；并发写同一 memory 不丢。
5. **超限治理**：索引超 200 行/25KB 时写入成功但返回「必须重写索引」错误（Claude 行为）。
6. **重启**：DSH 重启后记忆仍在，索引不重复、无重复事实。
7. **红线**：不写自定义 session event；内容中和 `{{`/`}}`；`$DSH_HOME` 写入用 `node:fs`（fs-sandbox 不覆盖）。

### 2.2 交付

- `spike/memory/` 最小实现 + 确定性测试（注入字节数、超限行为、scope 派生、并发写）；
- 一份 `docs/spike-memory-report.md`（结果/偏差/风险）；
- 若通过：把设计固化进 `packages/host-memory/src/`（M1 转正）。

---

## 3. 日程（3–5 天）

| Day | 内容 |
|---|---|
| D1 | 仓库 `pnpm install` + 最小 Host 插件骨架跑起来；验证 #1/#2（线程 create/prompt/冷恢复） |
| D2 | #3/#4（审批、steer/stop、打开线程）+ #7 备选 B 对照 |
| D3 | #11 Memory 骨架（注入/存储/scope/锁/超限） |
| D4 | #5/#9 Remote 逃生口 + #8 Library 写入 + #6 watcher |
| D5 | #10 归档/恢复 + 汇总 spike 报告 + 决策定稿 |

> 任何一项 < 通过标准时：记录限制，评估替代方案；A 方案阻塞则切 B（但审批限制需写进产品约束）。

---

## 4. 交付物

1. `docs/spike-report.md`：11 项结论 + 证据截图/日志 + 风险更新；
2. 可安装的 demo bundle（scratch profile）；
3. 更新后的 `docs/dsh-claude-projects-plan.md`（M0 结论、M1 任务细化）；
4. 若 Remote/Connection 路线确定，补 `docs/decisions/0003-remote-transport.md`。

---

## 5. 需要用户配合

- 批准在 **scratch profile** 安装 demo bundle（不碰 desktop profile）；
- M0 期间会创建测试项目数据（`~/.dsh/projects/spike-*`），结束后可清理；
- 若审批触发，需要你在线程会话里点批准（这正是验证 #3）。
