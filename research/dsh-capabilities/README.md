# DSH 现有能力与扩展点侦察（为在 DSH 内复刻 Claude Projects）

> 目标：给"Coordinator（主协调者）+ 按任务开线程（Threads）+ 项目级 Library（知识库/上传文件）"在 DSH 内落地提供确切落点：哪些包可直接复用、哪些必须新写、风险在哪。
>
> 本文件只做侦察结论与证据索引，不含实现代码。所有路径以本机安装为准：
> - DSH 版本：`0.2.1-rc.2`（`app.asar/dsh/package.json`）
> - 安装根（下称 `$ASAR`）：`/Applications/DeepSeek Harness.app/Contents/Resources/app.asar/dsh/`
> - 包文档路径统一写作 `$ASAR/node_modules/@deepseek-ai/<pkg>/README.md`
> - 本机 profile：`~/.dsh/profiles/desktop/`，bundles = `dsh-base` + `dsh-web-app` + `dsh-experimental-agent-team-profile`
> - Web GUI：`http://127.0.0.1:61863`
>
> 辅助文件：[extensions.md](./extensions.md)（Slot 拓扑 / Service API / 工具 schema / Event / 磁盘布局 / 组成层序）。

---

## 目录

- [0. 八条核心结论（TL;DR）](#0-八条核心结论tldr)
- [1. 侦察方法与证据基线](#1-侦察方法与证据基线)
- [2. 会话与父子关系（Thread 的载体）](#2-会话与父子关系thread-的载体)
- [3. UI 承载（Projects 页面 / 侧栏 / 线程列表 / Library 面板）](#3-ui-承载projects-页面--侧栏--线程列表--library-面板)
- [4. 协调者能力（Coordinator）](#4-协调者能力coordinator)
- [5. 知识库 / 上传 / Library](#5-知识库--上传--library)
- [6. 持久化与项目元数据](#6-持久化与项目元数据)
- [7. 插件 / 组成机制与 Projects 包拆分建议](#7-插件--组成机制与-projects-包拆分建议)
- [8. 缺口与风险清单](#8-缺口与风险清单)
- [9. 关键证据索引](#9-关键证据索引)
- [10. 不确定项与验证方法](#10-不确定项与验证方法)
- [附录 A：Claude Projects 概念 → DSH 概念映射](#附录-aclaude-projects-概念--dsh-概念映射)

---

## 0. 八条核心结论（TL;DR）

1. **"线程"的天然载体是顶层 Session**：DSH 的 Session 是 append-only event-sourced 日志，落盘为 JSONL(Zstd)，恢复、列举、标题、分叉、归档、并发运行、停止、冷恢复全部现成。相关包：`dsh-session`、`dsh-session-persistence-jsonl`、`dsh-api-session-controller`、`dsh-session-query`、`dsh-session-title`。磁盘位置：`~/.dsh/sessions/--<规范化cwd>--/<sessionId>/session.v4.jsonl.zstd`（本机实测）。
2. **"项目→会话"两级结构的现成实现是 Workspace，不是 Project**：`dsh-workspace`（`ctx.workspaceRegistry`）+ `dsh-api-workspace-controller`（`ctx.remote.workspace`）+ `dsh-client-ui-workspace`（占用侧栏 `sidebar.workspaces`）已经提供分组列表、排序、重命名、归档、pin、会话归属；持久化在 `~/.dsh/storages/workspace.json`（本机实测结构见 §6.1）。但 Workspace 的语义是**目录路径分组**（canonical path 唯一），不是带指令/成员/知识库的项目实体。
3. **新增一个一级页面成本低**：`ui-layout` 的 root-scoped `main` keyed slot + `ui-sidebar` 的 root-scoped `sidebar.panellist` 列表即可注册"侧栏图标 + 全屏页面"，Plugins 页就是这么做的；`dsh-experimental-client-ui-agent-team` 则示范了"往 `conversation.session.header.actions` 加一个按钮 + 弹层面板"。
4. **Library 的浏览/上传 UI 可以大量复用**：右侧栏 tab 体系（`ui-sidebar-right` 的 `sidebar.right.pane.tab` + `ctx.sidebarRightTabs.register`）已有文件树 tab（`ui-sidebar-files`），文件读写 API 是 `dsh-api-workspace-files`（Remote `workspaceFiles.list/read/stat/changes`）；上传链路是 `dsh-client-file-upload` → `ctx.fileUploads` → `dsh-attachment`/`dsh-attachment-local`，字节落在 `~/.dsh/attachments/v1/...`（内容寻址、自动去重、不自动清理）。但这些上传/附件语义是**Session 级 receipt**，不是项目级共享库。
5. **按需注入上下文有三条现成渠道**：(a) `dsh-agent-instructions`（`AGENTS.md`/`CLAUDE.md` 链，项目根=最近的 `.git`）；(b) `dsh-skill` + `dsh-skill-filesystem`（自动扫描 `<projectRoot>/.dsh/skills`、`<projectRoot>/.agents/skills`，按需加载，支持运行时 `register`）；(c) `dsh-system-prompt` 的 `section`/`context`/`variable`（可 agent-scoped 注册，动态每步渲染）。项目指令/Library 索引可以几乎零成本接入。
6. **Coordinator 能力基本齐备**：agent preset（YAML 声明、按 session 选择、可含 persona/instructions/skills/tools，`dsh-agent-preset` + `dsh-agent-preset-registry` + 客户端选择器 `dsh-client-ui-agent-preset`）、`goal`+`goal-round-driver`（无人值守多轮）、`plan-mode`、`workflow`、`commands`、以及实验性的 Agent Teams（`dsh-experimental-agent-team` + 9 个模型工具 + roster/任务板 + `dsh-experimental-client-ui-agent-team`）。
7. **最大缺口有四个**：① 没有 Project 实体，也没有"Session 属于哪个 Project"的字段（`SessionHeader` 只有 `cwd/parentSession/origin/delegationDepth/isSeeded/agentPreset`）；② 没有项目级 Library 服务（上传/去重/索引/权限）；③ 新增 Host↔Client Remote 命名空间需要 Typert descriptor（可用仓库外手写 `createTypertRemoteInfo` 或退化为 `webServer.register` 原始路由，均需验证）；④ 两级"项目→线程"侧栏列表需要自造（`ui-workspace` 只按 Workspace/路径分组）。
8. **主要风险**：Team/subagent 子会话在侧栏被隐藏（`subagent-origin Sessions remain hidden`）、生命周期归 `subagents`/`agentTeams` 所有；模型文件写受 `dsh-fs-sandbox` 限制在 session workspace 内（Library 目录要与 projectDir/session cwd 对齐）；Team 实验包无稳定性承诺、单进程/单 checkout、无自动 owner release；`appendPluginRecord` 明确禁止仓库外插件调用。

---

## 1. 侦察方法与证据基线

### 1.1 已确认可用的取证方式

| 方式 | 用途 | 本报告中的证据 |
|---|---|---|
| `read` 工具读 asar 内精确路径 | 读包 `README.md` | 全文大量引用 `$ASAR/node_modules/@deepseek-ai/<pkg>/README.md` |
| `cordis_inspect_query` host `Service.listService` | live Host Service 与方法签名目录 | §2/§4/§5/§6、[extensions.md](./extensions.md) |
| `cordis_inspect_query` host `Event.listEvents` | live Host Event 目录与模式 | [extensions.md](./extensions.md) |
| `cordis_inspect_query` host `Config.listConfigs` | live 组成行 + Config schema + **packageDir** | 例：`include:agent-team` → `packageDir=/Applications/.../app.asar/dsh/node_modules/@deepseek-ai/dsh-experimental-agent-team`；live 共 196 行 |
| `cordis_inspect_query` host `Tool.listTools` | 当前 Agent 可见的工具 schema | Team 9 工具 schema（[extensions.md](./extensions.md) §4.1） |
| shell 只读观察 `~/.dsh` | profile/组成/数据目录结构 | §1.2、§6.1 |

> 方法补充：Desktop 安装里 `$ASAR` 是**普通文件**（asar 归档）。本侦察用只读方式解析其头部索引以定位包内 `README.md`/`*.d.ts` 路径（写入仅落在 `/tmp` 临时目录），内容仍以 `read` 工具复核。这属于只读取证，未修改任何安装内容。**注意**：安装产物里**没有** `docs/`（`$ASAR/docs/**` 不存在），包 README 里指向的 `docs/subsystems/*.md`、`docs/config-catalog.md` 在本机安装中不可读；因此 Config schema 以 live `Config.listConfigs` 为准。

### 1.2 当前 live 组成（本报告的事实基线）

- `~/.dsh/profiles/desktop/package.json`：`dsh.profile.bundles = ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "@deepseek-ai/dsh-experimental-agent-team-profile"]`。
- `~/.dsh/profiles/desktop/cordis.patch.yml`：profile 覆盖层，含 `agent-default-model`（deepseek-official / **deepseek-flash** / reasoningEffort max）、`locale.preference: zh`、`ui-chat.transcriptView: standard`、`agent-preset-registry.default/selectedDefault: standard` 等。
- `~/.dsh/profiles/desktop/cordis.yml`：空 entry 列表；树由 bundle patch 叠加而成（层序：base → web-app → team-profile → profile patch → `--patch`）。
- 三份 bundle patch 均可在 `$ASAR/node_modules/@deepseek-ai/{dsh-base,dsh-web-app,dsh-experimental-agent-team-profile}/cordis.patch.yml` 读到（web-app 589 行、base 529 行、team-profile 32 行）。
- `dsh-experimental-agent-team-profile` 的 patch 只做三件事：`tool-subagent`/`tool-subagent-fork`/`tool-subagent-control`/`tool-subagent-list-agents` 四个 legacy 行 `disabled: true`；插入 `agent-team`、`tool-agent-team`、`ui-agent-team` 三行。即：**Team 能力是"实验性替换"，不是默认底座**。

### 1.3 本机数据目录（只读观察）

```
~/.dsh/
  .credentials.yaml            # 凭据（未读内容）
  attachments/v1/              # 附件对象（内容寻址）
  cache/
  llm-deepseek/
  profiles/{desktop,web,node_modules}/
  sessions/                    # session JSONL 日志
    --Users-ignis-workspace-dsh-plugins--/
      session-<uuid>/session.v4.jsonl.zstd + session.lock
      <uuid>/                 # 也存在非 session- 前缀的子会话目录
  storages/                    # storage-domain 落盘
    workspace.json             # workspace 注册表（v2）
    session_projcache.json + session_projcache/
```

---

## 2. 会话与父子关系（Thread 的载体）

### 2.1 Session / Turn / Event 数据模型

- `$ASAR/node_modules/@deepseek-ai/dsh-session/README.md`：
  - Session 是 append-only typed event log；所有模型可见事实都记入日志，`deriveMessages()` 增量投影出模型历史。
  - 表面事件：`system/message`、`developer/message`、`user/message`、`assistant/message`、`tool/result`（带 `surfaceOp`）；`assistant/attempt` 只记失败尝试；`request/header` 记录每次请求 envelope 快照（可完整重建请求）；`compaction` 通过 surface `replace` 隐藏而不删除。
  - API：`ctx.sessions.create/get/list/fork/flush`；`session.seq`、`eventAt`、`snapshotEvents`（后三者已 deprecated，新代码用 seq）；`fork(source, boundary?, childSessionId?)`；`inheritedEventCount`/`isOwnSeq` 区分继承前缀。
  - 明确限制：**没有 fork 之外的 session tree**（"No session tree beyond fork"）。
- 会话 Header 的持久字段（在 `dsh-tool-workflow`/`dsh-tool-pwsh` README 的 format 校验片段中可见，另见 `dsh-experimental-client-ui-agent-team` 的 projection JSON Schema）：
  `id`、`createdAt`、`cwd?`（绝对路径）、`parentSession?`（SessionId）、`origin?`（`'subagent'`）、`delegationDepth`、`isSeeded`、`agentPreset?`。
  → **没有** project/team/tag 字段。
- live Host Service（`Service.listService`）：`sessions`（`create/prepare/enter/announce/flush/get/list/fork`）、`sessionProjections`（注册 projection unit、`snapshot/stateOf/checkpoint/restore`）、`sessionProjectionCache`、`sessionPersistence`（`create/open/flush/stat/list`）、`sessionQuery`、`sessionTitle`、`sessionReferenceResolver`。

### 2.2 持久化落盘格式（实测 + 文档）

- `$ASAR/node_modules/@deepseek-ai/dsh-session-persistence-jsonl/README.md` §"On-disk layout"：
  ```
  <root>/--<normalized-cwd>--/<encoded-id>/session.vN.jsonl.zstd   (compression 默认 zstd)
  ```
  当前代 = v4（README 多处 "Current V4 opens"）。默认压缩；`compression: 'none'` 时为可读 JSONL 文本。写入即 fsync，崩溃恢复会补 synthetic closers；`session.lock` 负责单写者。
- base patch 中该行配置：`id: session-persistence-jsonl`, `root: !!js dshHomePath('sessions')` → `~/.dsh/sessions`。
- 本机实测：`~/.dsh/sessions/--Users-ignis-workspace-dsh-plugins--/session-*/session.v4.jsonl.zstd` + `session.lock`。子会话使用普通 uuid 目录（与顶层 `session-<uuid>` 命名不同），**父子关系不靠目录，靠 header `parentSession` + 父会话 projection**。

### 2.3 列出 / 恢复 / 标题 / 搜索

- `ctx.remote.session`（`dsh-api-session-controller`，live Service `sessionController`）是 Client 主入口：
  `list`（只读 stored header + projection cache，不激活 Agent）、`search`、`create`（可带 `agentPreset`，复用/新建 blank）、`fork`、`rename`、`prompt`、`cancel`、`attachment`、`updateQueue`、`page`、`follow`（stream）、`projections`（stream）、`control`（stream）、`modelCatalog`、`selectModel`、`openWorkspacePath` 等。
- `ctx.sessionQuery`（`dsh-session-query`）：`listSessions/searchSessions/searchEvents/readSession/readTitle(Snapshots)/readSurface/traceSession/readEvent`。SQLite FTS5 由 `dsh-session-query-sqlite` 提供；**本机 `openAt: never`**（web-app patch 把 `path: ':memory:'`、`openAt: never`），即全文搜索当前不可用，仅精确读/标题/lineage 可用。
- 标题：`ctx.sessionTitle`（`dsh-session-title`）——`get/rename/refresh/register(provider)`；base 挂了 `session-title-first-prompt-llm`（targetWords 5 / targetCjkCharacters 10）；标题是 log-only `session/title` 事件，不进模型上下文；fork 继承标题。
- 会话列表的 UI 数据来源：`dsh-client-ui-session`（React/Slot 适配、`ctx.uiSession.provide()`、access hooks）+ `dsh-client-ui-workspace`（`useSessions`/`useWorkspaces`、`uiWorkspace.startSession/openSession/forkSession/archiveSession/...`）。

### 2.4 子会话 / 子 Agent（subagent）

- `dsh-subagent`（live Service `subagents`）是**命名 provider 注册表 + 托管激活**：
  - provider：`subagent-spawn-in-process`（fresh 子会话，`spawn`）、`subagent-fork-in-process`（继承父已完成 turn，`fork`）；外部 backend（ACP/Codex/Claude Code/SDK）一次性执行。
  - `startActivation()` 返回 `{childId, result, dispose}`；`sendMessage(sender,targetId,...)`、`interrupt(target,authority)`、`listChildren(parentSessionId)`、`listDescendants(rootSessionId)`、`waitForChildren`、`drainChildren`、`prompt`。
  - 父子关系：父会话日志里写 `subagent/catalog` projection（`createdAt`+`mode: one-shot|continuable|external|unknown`+`label`），子会话 header 写 `parentSession`+`origin:'subagent'`+`delegationDepth`+`subagent/descriptor`（provider/model/reasoningEffort，用于冷恢复）；`subagentCatalog` projection 排除 fork 继承的事实。
  - 冷恢复：本地 continuable 子会话可 `sendMessage`/`prompt` 冷恢复（需 persistence + sessionQuery）；恢复时按 `agent-preset/selected` 或父当前 composition 重建（见 `dsh-subagent/README.md#restoring-child-composition`）。
  - 容量/深度：`maxActiveSubagents` 默认 8；`maxDepth` Host 设置默认 1；`maxDepth: 0` 禁止委派。
- 模型工具：
  - `dsh-tool-subagent`（`subagent` 工具；本机团队 profile 已 `disabled`）：返回 `started subagent <childId>`，后台完成通知；可配 `agentPreset`/`allowedAgentPresets`/`maxDepth`/`modelSelectionSettings`。
  - `dsh-tool-subagent-control`（`send_message`/`interrupt_agent` + 独立的 `list_agents`）：continuable 子会话/父会话之间的直接消息与中断。
- **UI 展示**：`dsh-client-ui-subagent` 在会话 header 渲染 `subagentCatalog` 谱系；`ui-workspace` 明确 **"subagent-origin Sessions remain hidden"**（不在侧栏会话列表出现）。`dsh-client-ui-agent-team` 通过 "addressed-subagent 地址" 打开成员会话。

### 2.5 Team（实验）

- `dsh-experimental-agent-team`（live Service `agentTeams`）：
  - 每个普通运行根 session 隐式是 Team Lead（TeamId = SessionId），无需创建事件。
  - roster 与任务板以 `team/member`、`team/task` 事件写入 **Lead session 日志**（log-only，不进模型表面），并 flush 后才返回成功；`agentTeam` projection 下发到 Client（`members[{id,name,role,phase,error}]`、`tasks[{id,revision,subject,description,status,blockedBy,writeScopes,ownerName,ready,writeScopeWarnings}]`）。
  - 成员 = 由 subagent provider 创建的子会话（fresh/fork），`member` 记录在 Lead 日志；恢复时用 durable roster 与子会话持久化对账（provisioning → active/failed）。
  - API（live）：`spawnTeammate/sendMessage/createTask/getTask/listTasks/updateTask/waitForChange/interrupt/membership/listMembers`。
  - 限制：单进程/单共享 checkout；无嵌套 Team；无自动 owner release；消息无重试/去重；实验无稳定性承诺（README §Known Limitations）。
- 模型工具 9 个（`dsh-experimental-tool-agent-team`）：`spawn_teammate`、`send_message`、`interrupt_agent`、`list_agents`、`wait_agent`、`team_task_create/list/get/update`。本会话（teammate）的 `Tool.listTools` 实测 schema 见 [extensions.md](./extensions.md) §4.1。
- 客户端：`dsh-experimental-client-ui-agent-team` 在 `conversation.session.header.actions` 注册一个 Team 按钮，弹层读 `agentTeam` projection 显示 roster/任务板；点成员用 addressed-subagent 地址打开。本会话 bundle 字符串实测含该 slot key。

### 2.6 对 Projects 的映射建议（结论）

| 需求 | 推荐映射 | 理由 |
|---|---|---|
| 线程（Thread） | **顶层 Session** | 生命周期、并发运行、停止、恢复、标题、归档、UI 列表全部现成；`cancel`/`archiveSession(stopActivity)` 管停止 |
| 项目（Project） | **新元数据实体**（独立 storage domain） | Workspace 只是路径分组，不能承载指令/成员/知识库；Session 无项目字段 |
| 成员/任务板（若需要） | 复用 Team（实验）或自建 storage domain | Team 已给 roster+任务板+CAS 任务+消息，但实验性且单 checkout |
| 线程归属 | Project 记录里存 `sessionIds[]`（或 `threads[{sessionId,title,status}]`） | 不改 session header、不写自定义 session event（见 §8 风险） |
| 子线程/委派 | `subagent`/Team 子会话 | 能力完整但侧栏隐藏，需自己的列表 UI + addressed 地址 |

---

## 3. UI 承载（Projects 页面 / 侧栏 / 线程列表 / Library 面板）

### 3.1 布局骨架（`dsh-client-ui-layout`）

- 三栏 AppFrame：左 sidebar（264–420px，默认 280，折叠 56px rail）、中 main、右 rightbar（45% 视口起，上限 70%）。
- **root-scoped `main` keyed slot**：全局面板按 key 注册；`conversation` 是保留 key。`ctx.layout.selectPanel(id)` 选中；`sidebar.panellist` 里同 id 的图标就是入口。
- 其它 root-scoped seat：`shell.bottom`（全宽底栏）、`shell.overlay`（全屏浮层）、`shell.leading`（macOS 窗口左上角）。本会话 bundle 实测含 `"main"`、`shell.bottom/leading/overlay`。
- 结论：**新增一级 Projects 页面 = 一个 `main` panel + 一个 `sidebar.panellist` 图标**，无需改布局包。

### 3.2 侧栏与会话列表（`dsh-client-ui-sidebar` / `dsh-client-ui-workspace`）

- `ui-sidebar` 提供壳与 seat：`sidebar.brand.mark`、`sidebar.brand.name`、`sidebar.panellist`（**全局面板图标列表**）、`sidebar.workspaces`（会话浏览区，由 ui-workspace 占用）、`sidebar.settings`（底部 Settings 触发）、`sidebar.toggle.badge`、`sidebar.footer.action`、`sidebar.left.toggle`（后几项来自 lib/client.js 实测字符串）。
- `ui-workspace` 提供：Workspace 分组/树形列表、会话行、排序（Last updated/Manual）、pin/archive/rename/fork/search、Workspace 增删改排序；持久化顺序在 Host（`workspaceController`），会话显示顺序在浏览器本地。
- 可扩展的会话行插槽（root-scoped list）：`sidebar.workspaces.session.menu.item`（"..." 菜单项）、`sidebar.workspaces.session.row.action`（hover 按钮）、`sidebar.session.row.leading`、`sidebar.session.row.hover`。
- **两级结构现状**：侧栏已经是"Workspace 组 → Session 行"两级；`Group by: Workspace / Workspace Tree` 只是分组方式。**没有**"Project → Thread"语义；但可以：
  - 方案 A（低成本）：Project ≈ Workspace（一个项目=一个目录），直接复用现有两级 UI；缺点：项目≠目录，且同目录多项目不可行。
  - 方案 B（推荐）：自建 Projects 一级页面 + 页面内两级列表（项目卡 → 线程列表），侧栏 `sidebar.panellist` 放入口；会话行菜单加 "Move to project"（复用 `sidebar.workspaces.session.menu.item`）。
- 客户端导航/创建 API（`uiWorkspace`，bundle 实测）：`startSession`（可带 prompt/draft/agentPreset）、`openSession`、`openWorkspaceSession`、`forkSession`、`archiveSession`、`openWorkspace`、`connectWorkspace`、`renameWorkspace`、`deleteWorkspace`、`openSearchResult`、`openDirectoryFlow`。

### 3.3 会话主区 / 输入框 / 右侧栏

- `ui-conversation` 占用 `main: conversation`，声明 root-scoped `conversation.header`、`conversation.content`、`conversation.composer`、`conversation.view` 等，以及严格 Session 子槽（bundle 实测字符串）：
  `conversation.session.header.actions`、`.utilities`、`.corner`、`.lineage`、`conversation.header.leading`、`conversation.input.{dock,overlay,left,right,activity,model,permission,plan}`、`conversation.composer.dock`、`conversation.chat.*`、`conversation.user.text.node`。
  → 线程切换器/项目面包屑可放 `conversation.header.leading` 或 `conversation.session.header.utilities`；"新线程"按钮可放 `conversation.session.header.actions`。
- 右侧栏（`ui-sidebar-right`）：每个 Session 一个 docking surface；tab 类型注册 API 明确：
  `ctx.sidebarRightTabs.register({ id, kind, patterns?, priority?, canOpen?, title, guide?, keepMounted? })`（id 唯一，kind 可分 builtin/extension 覆盖），body 注册到 keyed slot `sidebar.right.pane.tab`（`useTabInfo()` 取 `{sidebar,panel,tab}`）；导航 `ctx.sidebarRight.openTab(kind, options?)` / `openResource(address, options?)`；关闭钩子 `registerCloseHandler(kind, handler)`；资源地址为 `dsh-resource://<type>/...`。
  → **Library/项目文件浏览器最适合做成一个右侧栏 tab type**，`ui-sidebar-files` 是现成样板（kind `files`，文件树 + `workspaceFiles.list`）。
- 其它可复用 seat：`conversation.composer.dock`（输入框底部按钮，官方建议的简单装饰位）、`shell.overlay`（全屏浮层）。

### 3.4 客户端控制器 / Remote 命名空间（可复用）

| 命名空间/服务 | 包 | 关键内容 |
|---|---|---|
| `ctx.remote.session` | `dsh-api-session-controller` | 会话 CRUD/列表/搜索/fork/rename/prompt/cancel/page/follow/projections |
| `ctx.remote.workspace` | `dsh-api-workspace-controller` | workspace 增删改排序、session 排序、archive/unarchive/pin/unpin、`follow` stream |
| `ctx.remote.workspaceFiles` | `dsh-api-workspace-files` | `read/readBytes/stat/list/changes`（Library 浏览/预览直接可用） |
| `ctx.remote.fileUploads`（`fileUploads` Host 服务） | `dsh-client-file-upload` + Host `fileUploads` | 浏览器上传 Blob/stream → receipt → prompt 绑定 |
| `ctx.remote.sessionReferenceResolver` | `dsh-session-reference` | `@[label](dsh-session:...)` 跨会话引用候选/准备 |
| `ctx.remote.skills` | `dsh-api-session-controller` 的 skills 面 | 用户可调用 skill 列表（不激活冷 Agent） |
| `ctx.remote.job` | `dsh-api-job-controller` | 后台任务列表/follow/kill |

### 3.5 结论：两级"项目→线程"UI 可行性

- **能做，且改动面可控**：一级页面（`main` + `sidebar.panellist`）+ 页面内两级列表（项目卡 → 线程行）是纯 Client 新包；线程行可用 `ctx.remote.session.list`（或 `useSessions`）按项目映射过滤，打开沿用 `uiWorkspace.openSession` 或 session 的 addressed 地址。
- **不建议**直接改 `ui-workspace`（会与上游包竞争 slot/行为）；优先用它的插槽扩展（session row menu/action）与 `uiWorkspace` 服务。

---

## 4. 协调者能力（Coordinator）

### 4.1 Agent preset（`dsh-agent-preset` + `dsh-agent-preset-registry`）

- 一个 preset = 一行 Cordis entry（`name: '@deepseek-ai/dsh-agent-preset'`，`config.id` + `config.plugins` 子插件列表，可带 `name/description/order`）。它挂在 registry scope 下，**session header 记录 `agentPreset`**，选择写入 `agent-preset/selected` 事件。
- registry（live Service `agentPresets`）：`list()`、`resolve(id?)`、`mount(ctx,id?)`、`select(agent,id)`、`remoteExportList()`、`readDocument(id)`、`inspectCompositions()`、`compositionInventory()`、`serviceFor()`、`acquireScope()`；`default` 必填，`selectedDefault` 是用户级覆盖（本机 = standard）。
- 新 preset = bundle patch 插入 presets 行（**不需要改 DSH 代码**）；Web 设置页只读展示/编辑默认，不允许写 YAML 回 Host；"Creator 模式"用 `cordis` preset 在对话里生成 bundle。
- 客户端：`dsh-client-ui-agent-preset` 提供 Settings 卡片组、默认 badge、`agentPresets/list|read`、新会话选择器。
- **对 Coordinator 的意义**：可以定义一个 `projects-coordinator` preset，内含 persona/instructions/systemPrompt 插件/工具白名单/Team 工具，按项目选择（`session.create` 时传 `agentPreset`）。
- 注意：preset 不是安全沙箱（YAML/插件可执行 Host 代码）；已有 Agent 保留旧 revision；重启后旧 revision 不保留。

### 4.2 系统提示注入层次

| 层 | 包 | 能力 |
|---|---|---|
| 部署 persona | `dsh-system-prompt`（config `personaPrefix/personaSuffix/includeHarnessIdentity/includeRuntimeContext/toolOrder`）+ `dsh-persona`（preset 内挂载，shadow 部署 persona，可 `complete: true` 独占、可关 runtime context） | 静态身份 |
| 项目指令文件 | `dsh-agent-instructions` | `AGENTS.md`/`CLAUDE.md` 链：`$DSH_HOME/AGENTS.md` → `<agentsHome>/AGENTS.md` → 项目根（最近 `.git`）到 cwd 的候选文件；cwd 变化重载；`maxBytes` 预算（base 65536） |
| 动态上下文/变量 | `ctx.systemPrompt.context()/section()/variable()` | 每步渲染；agent-scoped 注册遮蔽全局；`refreshContext`；可用 `{{variable}}` |
| 运行时事实 | `dsh-time-context`、`dsh-working-directory`（cwd 以用户上下文注入） | 时间/cwd |
| 事件 | `system-prompt/assemble`（waterfall）、`system-prompt/change` | 专家级改写 |

**结论**：项目级"自定义指令"有两条低风险落法：
1. 写入/维护 `<projectDir>/AGENTS.md`（复用 `dsh-agent-instructions`，零代码）；
2. 新写一个小 Host 插件，按当前 Session 的项目映射注册 `ctx.systemPrompt.context()`（动态、可多项目会话切换）。

### 4.3 Skill（可复用为"按需加载的项目知识"）

- `dsh-skill`：provider 注册表 + 合并 catalog + 按需加载 + 调用策略（`modelInvocable`/`userInvocable` 四种组合）+ `ctx.skills.register()`（运行时内嵌 skill）/`registerProvider()`。
- `dsh-skill-filesystem`：扫描根（README 表格）：100 `<projectRoot>/.dsh/skills`、200 `<projectRoot>/.agents/skills`、400 `<dshHome>/skills`、500 `<agentsHome>/skills`；项目根=最近含 `.git` 的祖先；watcher 自动刷新；支持 `SKILL.md` 目录或 `<name>.md` 平铺。
- 模型侧消费：`dsh-tool-skill` + `core/skill` 的 catalog 段；用户侧 `/skill` 命令（`skills/list` Remote）。
- **对 Library 的意义**：把 Library 里的"操作手册/规范/检索说明"放到 `<project>/.dsh/skills/`，即可获得"索引常驻、正文按需加载"的效果，且无需新代码。

### 4.4 goal / plan / workflow / commands

| 能力 | 包 | 复用判断 |
|---|---|---|
| 长期目标 + 自动续跑 | `dsh-goal`（live `ctx.goals`：get/create/edit/pause/resume/complete/block/clear）、`dsh-goal-round-driver`（idle 时自动排队 goal round，`maxGoalRounds` 上限、blocked 分类、resume/fork 后不自动续跑）、`dsh-tool-goal`、`dsh-command-goal` | 可直接用于 Coordinator "持续推进项目目标" |
| 计划模式 | `dsh-plan-mode`（live `ctx.planMode.get/set`；log-only `plan/mode` 状态 + `plan:policy` 段落 + `exit_plan_mode` 工具；工具目录跨模式不变以保 KV cache） | 复用：项目级"先计划后执行" |
| 工作流编排 | `dsh-workflow` + `dsh-workflow-ptc` + `dsh-tool-workflow`（脚本化 fan-out/pipeline/parallel，`agent()` 子运行；`workflow/*` 事件；子运行=subagent 子会话） | 复用：批量任务/并行评审；但子会话不直接出现在侧栏 |
| 命令 | `dsh-commands`（`register(definition)`、`@Remote list/execute`、`registerFileReceiptResolver`） | 复用：`/project` 之类人类命令入口 |
| 定时 | `dsh-schedule`（Session 级提醒；`schedule/create/list/update/delete` 工具） | 可选：项目例行任务 |

### 4.5 Coordinator 结论

- **可直接复用**：preset（定义协调者人格/工具集）+ systemPrompt/agent-instructions（项目规则）+ skill（项目知识按需加载）+ goal/goal-round-driver（长任务）+ plan-mode + workflow + commands + Team（成员/任务板/消息）。
- **需自写**：Project 实体与项目↔线程关联、"线程列表"工具（模型侧也需要"开/列/停/恢复线程"的工具，或复用 subagent 工具但语义改为顶层 Session）。

---

## 5. 知识库 / 上传 / Library

### 5.1 上传链路（现状）

1. 浏览器：`ctx.fileUpload.upload(sessionId, blob/stream/bytes, name, signal, onProgress)`（`dsh-client-file-upload`；Blob 走 Worker + XHR 进度，stream 走 Fetch 增量）。
2. Host：`ctx.fileUploads`（live Service `fileUploads`）——`upload(agent, request)` / `uploadStream({sessionId,data,name})` → `FileUploadValue`（含 `FileUploadReceiptId`）；`bindPrompt(agent, receiptIds, requestId)` → `PromptFileBinding`；`retirePrompt(agent, requestId)`；`resolve(agent, receiptId)` → `FileAttachmentRef`。
3. 持久化：receipt 由 `ctx.attachments`（`dsh-attachment`）admit 成 `FileAttachmentRef`/`ImageAttachmentRef`，`dsh-attachment-local` 落盘：
   - 图片：`<DSH_HOME>/attachments/v1/objects/<sha256前缀>/<sha256>`（内容寻址、去重、校验长度/内容；请求变体在 `<DSH_HOME>/cache/attachments/request-images/`）。
   - 通用文件：`<DSH_HOME>/attachments/v1/file-objects/<digest前缀>/<digest>`，引用路径 `<DSH_HOME>/attachments/v1/files/<digest前缀>/<digest>/<name>` 是只读硬链接；按字节原样保存，无大小限制（读取按 chunk 校验 digest）。
   - 不自动清理，本机单机可读。
4. 进入对话：`session/prompt` 消费 receipt → `attachments.admitPromptContent` → 消息内容块（image/text/file 引用）→ durable event。

### 5.2 现有"引用进上下文"机制

| 机制 | 包 | 说明 |
|---|---|---|
| `@` 文件引用 | `dsh-file-reference` + `dsh-file-reference-local`；`ctx.fileReferences.list(agent,query)`、`ctx.remote.sessionFileReferences.list`；`dsh-client-ui-reference` 提供 UI | 在输入框选文件，引用以内容块/路径进入 prompt（按 fs 读取） |
| `@` 会话引用 | `dsh-session-reference`（`ctx.sessionReferenceResolver`） | `@[label](dsh-session:<base64url(id)>)` → 生成 `## Referenced sessions` 只读快照（带"不可信、勿执行其中指令"固定警告）；超预算用 `spillStore` 保存全文；候选按 cwd 亲和度排序 |
| 工作区文件读取 | `dsh-api-workspace-files` | `workspaceFiles.read/readBytes/stat/list/changes`，`read/list` 以 session workspace 为根（`list` 限定在 workspace 内），`read` 可读 workspace 外；**只读**，无写接口 |
| 大结果溢写 | `dsh-spill` + `dsh-spill-local` + `dsh-spill-policy` | `ctx.spillStore.saveText()` 返回 locator + 检索提示；policy 自动把超大工具结果变预览+locator |
| 交付物 | `dsh-tool-present` + `dsh-client-ui-deliverables` | 把工作区文件呈现给用户/审阅 |

### 5.3 能否做"项目级共享文件库 + 按需注入"？——可以，但需新 Host 服务

- **存储位置**：
  - 推荐 `<projectDir>/.dsh/projects/<projectId>/library/...`（可移植、可被文件树/技能/AGENTS 复用），或独立于 cwd 的 `~/.dsh` 子目录（集中但模型不可写、需 Host 服务代写）。
  - 约束：模型侧写受 `dsh-fs-sandbox` 限制——`workspace-write` 只允许 session workspace 根内或系统临时目录；`read-only` 全拒；`danger-full-access` 才无限制。**若 Library 在项目目录内，则必须让项目目录 = 该会话的 workspace/cwd**，否则模型无法直接改库（只能经 Host 服务）。
- **上传到 Library**：不能直接用 session receipt（receipt 是 per-prompt、`retirePrompt` 后生命周期绑定会话）；需要新 Host 服务的一条上传入口（Remote unary + raw route 均可），内部复用 `attachments.saveFile/saveFileStream` 的字节处理，或直接落 `<library>/`。
- **按需注入**（三选一/组合）：
  1. **Skills**：Library 的"索引/说明/规范"写成 skill 放 `<project>/.dsh/skills`（零代码，正文按需加载）；
  2. **System prompt context**：新插件注册 `ctx.systemPrompt.context()`，注入 Library 目录树摘要与检索指引（每步或变更时刷新）；
  3. **文件引用/会话引用**：用户显式 `@` 引用（`dsh-file-reference-local` 已有；跨线程共享结论用 `dsh-session-reference`）。
- **索引/检索**：可用文件系统（tree）+ `dsh-tool-fs-search`/`grep` 工具；若要全文检索可考虑 `dsh-session-query-sqlite` 之外自建（当前 FTS 只索引 session 历史）。

---

## 6. 持久化与项目元数据

### 6.1 storage 栈（本项目元数据的最佳落点）

- live 组成：`storage`（hub：`backend` 注册表、`mount/form`）+ `storage-json`（`root: !!js dshHomePath('storages')` → `~/.dsh/storages`）+ `storage-domain`（`backend: json`）。
- `dsh-storage-domain`：`ctx.storageDomain.open(spec)` 打开 schema 校验的 KV domain；**同步读 + 写后 durable 再 resolve + 按序发 `domain/changed`**；`DomainSpec` 含 `name`、`version`、`tables`（`storage-domain` README 示例即 `name: 'workspace'`）；`backend` 默认路由、`routes` 按 domain 覆盖。
- `dsh-storage-json`：布局 `single`（默认，`<unit>.json` 一文件一 unit，本机 `workspace.json` 即此布局）或 `per-record`（一条记录一文档，带版本戳）；原子发布。
- 本机实测 `~/.dsh/storages/workspace.json`（v2）：
  ```
  { "unit": {name:"workspace",version:2},
    "global": { initialized, defaultWorkspaceId, workspaceIds[], archivedSessionIds[], pinnedSessionIds[] },
    "tables": { "workspaces": { "<id>": { path, title, sessionIds[], createdAt, updatedAt } } } }
  ```
  → **这是"目录→会话列表"的持久结构**，可直接作为 Project 记录设计的参照（新增 domain 而非改它）。
- 其它持久化：`session_projcache.json` + `session_projcache/`（`dsh-session-projection-cache`，writeEveryEvents 200 / writeIntervalMs 5000）。

### 6.2 项目元数据适合存哪

| 方案 | 落点 | 优点 | 缺点/风险 |
|---|---|---|---|
| A. 新 storage domain `projects`（推荐） | `~/.dsh/storages/projects.json`（single）或 per-record | 现成栈、schema 校验、变更事件、与 workspace 同级惯例 | 需新 Host 包声明 domain |
| B. 扩展 Workspace 记录 | 改 `dsh-workspace` 的 domain schema/表 | 复用 workspace 全链路 | 侵入上游包 schema；Workspace 语义被污染；升级风险高 |
| C. 项目目录内文件 | `<projectDir>/.dsh/project.json` | 可移植、可进 git、人可读 | 需 fs 写权限；多机/多用户一致性与并发要自己做；模型可改（需校验） |
| D. 写 session 自定义事件 | session log | 天然按会话 | **不可行/高风险**：`appendPluginRecord` 只允许仓库内 `packages/experimental/` 包；未知事件需显式 ignorable 标记；外部插件不应写 |

**关联方式**：Project 记录内保存 `workspacePath?`、`leadSessionId`、`threadSessionIds[]`（或 `threads[{sessionId,title?,createdAt}]`），由 Host 服务负责一致性；Session→Project 的反查索引由该 domain 派生（如 `bySession: {sessionId: projectId}` 表）。不要依赖 session header/标题推断。

### 6.3 组装与配置（E 补充）

- profile 组成 = bundle 列表 + profile `cordis.patch.yml`；每层 patch 规则：`insert` 追加行、按 `id` 覆盖行（`config` **整体替换**不深合并）、`disabled` 可为 `!!js` 表达式、`group: true` 可嵌套、`isolate` 控服务实例。
- 新增功能落地惯例：写成 bundle 包（`package.json` 的 `dsh.profile.bundles` 可加），内部 `cordis.patch.yml` 负责插行；或用 `plugin_manager.install_bundle` 安装到 profile（本任务禁止操作）。
- 实验包惯例（`dsh-experimental-*`）：独立 `README` + `package.json`（含 `dsh.client` 声明）+ `cordis.patch.yml` + `locale/{en,zh}.json` + `icon.svg`；bundle 与实现包分离（如 `agent-team-profile` 只做 patch + 依赖）。

---

## 7. 插件 / 组成机制与 Projects 包拆分建议

### 7.1 机制要点

- **bundle/patch**：`dsh-base`（Host 底座：session/llm/tools/storage/attachments/subagent/skills/goal/plan-mode/…）+ `dsh-web-app`（Web 面：transport、api-*、client-ui-* 浏览器 roster、workspace、session-reference）+ 可选实验 bundle。层序固定，后层按 id 覆盖。
- **client-modules**：`@deepseek-ai/dsh-client-modules` 是浏览器模块系统。插件包在 `package.json` 声明 `dsh.client`（`platform:'web'`、`immediately`、`inject`、`external`）并导出 `./client`；Host 扫描 live Loader 行组合 boot graph（`window.__DSH_BOOT__`）、按 `/plugins/<id>/client.js` 提供 bundle，浏览器懒加载并注册 factory。**新增 Client 包 = 加 package.json `dsh.client` + `lib/client.js` 构建产物 + patch 插一行**（官方模板见 skill `cordis-plugin-development` 的 `templates/decoration/`）。
- **locale**：`ctx.locale.register(ns,{zh,en})`；`dsh-client-locale` 管偏好（本机 zh）与回退；可见文案必须走 locale。
- **theme**：`ctx.theme` 快照 + `--dsw-*` token；`ui-layout` 投影到 document；插件样式继承主题，不重复管理。
- **Host↔Client 新 Remote**（三条路径，见 §8 风险）：
  1. 仓库内构建：`TypertRemoteService` + `@Remote` 装饰器 + typert 生成器产出 descriptor（外部包没有该构建链）；
  2. 运行时手写 descriptor：`createTypertRemoteInfo(spec, z)`（`@deepseek-ai/dsh-typert-protocol/remote-info`，已发布、纯函数）+ `ctx.typert.register(contribution)` / client `ctx.remote.$mount()`（README 明确"any other owner calls ctx.typert.register"）；
  3. 原始 HTTP：`ctx.webServer.register({...})` 注册 `/api/...` 或其它前缀路由 + client 侧 `fetch`（绕开 Typert 类型与校验）。

### 7.2 建议拆包（Host / Client）

| 包（建议名） | 侧 | 职责 | 复用的现有包 |
|---|---|---|---|
| `dsh-projects` | Host | `projects` storage domain + `ctx.projects` 服务：CRUD、project↔session 关联、线程索引 | `dsh-storage`, `dsh-storage-json`, `dsh-storage-domain` |
| `dsh-api-projects` | Host | Remote 命名空间 `remote.projects`（list/get/create/update/delete/linkThread/unlinkThread/follow） | `dsh-api-gateway`/`dsh-api-remotes`、`dsh-typert-*`、`dsh-api-remote-access` |
| `dsh-tool-projects` | Host（模型工具） | 模型侧：创建/列出项目、开线程（创建 session 指定 project）、列出/停止线程、写项目指令 | `dsh-tools`、`dsh-api-session-controller`/`agentLoop`、`dsh-projects` |
| `dsh-projects-context` | Host | 按当前 Session 的 project 注册 `ctx.systemPrompt.context()`（项目指令/库索引），或桥接 AGENTS.md | `dsh-system-prompt`、`dsh-session`、`dsh-projects` |
| `dsh-projects-library` | Host | 项目级文件库：上传入口、目录/索引、去重、给 UI 的列表；可选 skills 导出 | `dsh-attachment`/`attachment-local`、`dsh-api-workspace-files`、`dsh-file-reference`、`dsh-skill` |
| `dsh-projects-bundle`（profile bundle） | Host | 只含 `cordis.patch.yml` + 依赖 + icon/README，把上面各行插入，附带 `projects-coordinator` preset | 现有 bundle 惯例 |
| `dsh-client-ui-projects` | Client | Projects 一级页面（`main` key + `sidebar.panellist` 图标）、项目卡/线程两级列表、新建线程、项目设置（指令/成员/库） | `ui-layout`、`ui-sidebar`、`ui-conversation`、`ui-workspace`（`uiWorkspace.openSession`）、`ui-session` hooks |
| `dsh-client-ui-projects-library` | Client | 项目库面板（右侧栏 tab type 或页面内 tab）：浏览/预览/上传/移除 | `ui-sidebar-right`（`sidebarRightTabs`/`sidebar.right.pane.tab`）、`api-workspace-files`、`client-file-upload`、`ui-sidebar-files`（参考实现） |
| `dsh-client-ui-projects-session-actions` | Client | 会话行菜单/hover 动作："Move to project"；会话 header 显示项目名 | `ui-workspace` 的 `sidebar.workspaces.session.menu.item`、`ui-conversation` 的 `conversation.session.header.*` |
| （可选）`dsh-projects-team` | Host | 若需要 Coordinator+成员：包装/复用 `dsh-experimental-agent-team` 或自建轻量任务板 | `dsh-experimental-agent-team`、`dsh-subagent` |

> 拆分原则与实验包惯例一致：**每层可独立启停**（domain/tools/api/client 分开），bundle 只做组装；客户端包声明 `dsh.client` 并各自带 locale。

---

## 8. 缺口与风险清单

### 8.1 缺口（按阻塞程度排序）

| # | 缺口 | 现状 | 结论 |
|---|---|---|---|
| G1 | Project 实体 + project↔session 关联 | 无 Project 概念；SessionHeader 无 project 字段；`appendPluginRecord` 禁外部包 | **必须新写**（storage domain，方案 A） |
| G2 | 项目级 Library 服务 | attachment/upload 是 session 级 receipt；无项目共享库 | **必须新写**（Host 服务 + 上传入口） |
| G3 | 新 Host↔Client Remote 命名空间 | 需 Typert descriptor；生成链在本仓库外不可用 | **需新写且验证**（手写 `createTypertRemoteInfo` 或原始 HTTP 路由）【推断】 |
| G4 | "Project→Thread"两级列表/一级页面 | 侧栏只有 Workspace 两级；无 Project 页面 | **新写 Client 包**（`main`+`panellist`，难度低） |
| G5 | 模型侧"开/列/停线程"工具 | subagent 工具有类似语义但产出子会话（侧栏隐藏）；无"创建顶层 session"工具 | **需新写**（tool-projects，可内部调 sessionController/agentLoop） |
| G6 | Coordinator 预设 | preset 机制完备，但需声明 `projects-coordinator` | **可复用，仅配置**（bundle patch） |
| G7 | 项目指令注入 | `agent-instructions`/`systemPrompt.context` 现成 | **可复用**（前者零代码，后者小插件） |
| G8 | 项目知识按需加载 | skills 扫描 `<project>/.dsh/skills` 现成 | **可复用（零代码）** |
| G9 | 线程间共享上下文 | `session-reference` 现成（@会话引用，限 3 个/条消息，预算内） | **可复用** |
| G10 | 文件库浏览/预览 UI | 右侧栏 tab + `workspaceFiles` 现成；`ui-sidebar-files` 是样板 | **大量复用**（新包只做项目库视图） |
| G11 | 上传 UI/字节落盘 | `client-file-upload` + `attachment-local` 现成 | **复用字节层**，库入口需新写 |
| G12 | 项目元数据持久化 | storage domain/json 现成，`workspace.json` 是范例 | **复用栈，新 domain** |

### 8.2 风险

| 风险 | 说明 | 消解 |
|---|---|---|
| R1 子会话隐藏 | `ui-workspace` 不显示 `origin:'subagent'` 的会话；Team/线程若用子会话，必须自建列表并用 addressed 地址打开 | 线程用**顶层 Session**（推荐）；确需子会话时复用 `dsh-client-ui-subagent` 的谱系组件或自造列表 |
| R2 生命周期归属 | 顶层 session 由 `sessionController`/agent runtime 拥有（含 `cancel`、archive gate）；子会话由 `subagents`/`agentTeams` 拥有 | 不要自造运行器；线程=session，停止用 `session.cancel`/`archiveSession({stopActivity})` |
| R3 归档 gate | `ArchivedSessionGate` 会拒绝已归档 Session 及子孙的新 step（`blocked`），unarchive 才解除 | 停止/归档线程时按现有语义处理；UI 标注 archived |
| R4 沙箱 | 模型写受 `fs-sandbox` 限制（workspace-write=session workspace + temp；read-only 全拒）；`bash` 同一策略 | Library 放在项目=cwd 的目录，或用 Host 服务代写（Host 不受模型沙箱限制，但需自担审批/UX） |
| R5 Team 实验性 | 无稳定性承诺；单进程/单 checkout；无自动 owner release；消息无重试；替换 legacy 工具 | 首版不要强依赖 Team；Coordinator 可用 preset+tools 实现，Team 作为可选增强 |
| R6 Typert 手写 descriptor | 仓库外无 generation 链；SRC fallback 仅开发兜底；手写需遵循 `InvocationDescriptor`/Zod factory 规范 | 先做 spike 验证 `ctx.typert.register` + client `$mount`；不行就退 `webServer.register` 原始路由（无类型校验，需自校验） |
| R7 自定义 session 事件受限 | `appendPluginRecord` 仅仓库内 experimental 包；未知事件需 ignorable 且格式风险 | 项目状态一律放自己的 storage domain，不写 session log |
| R8 Workspace domain 共享 | `workspace.json` 由 `dsh-workspace` domain 独占；直接改文件会绕过写链/事件 | 不要手改；需要扩展就走新 domain 或 upstream API |
| R9 客户端 inspect 不可用 | 本会话（subagent）client `Slots/Theme/Service` 查询 10s 超时，slot props/注册选项只能从 README/bundle 字符串取证 | 在顶层会话/页面重试 `Slots.listSubTree`、`Theme.listTokens`；或读 `lib/client.js` 中 slot 字面量（本报告已用此法） |
| R10 升级演进 | 依赖包版本 0.2.1-rc.2；UI/插槽可能变化；实验包随时改契约 | 锁定 peer 依赖范围；优先用稳定包（非 experimental）的插槽/Remote；用 `plugin_manager` 安装以便回滚 |

---

## 9. 关键证据索引

| 结论 | 证据 |
|---|---|
| DSH 版本/依赖清单 | `$ASAR/package.json` |
| Session event-sourced 模型、fork、无 session tree | `$ASAR/node_modules/@deepseek-ai/dsh-session/README.md` |
| JSONL 落盘布局 v0–v4、zstd、fsync、lock | `dsh-session-persistence-jsonl/README.md` §On-disk layout；本机 `~/.dsh/sessions/...` 实测 |
| session 列表/分页/follow/projections Remote | host inspect `Service.listService` → `sessionController`；`dsh-api-session-controller/README.md` |
| 标题折叠/生成 | `dsh-session-title/README.md`；base patch `session-title`/`session-title-llm` 行 |
| 全文搜索当前禁用 | `dsh-web-app/cordis.patch.yml` `session-query-sqlite: {path: ':memory:', openAt: never}` |
| subagent provider/激活/catalog/descriptor/冷恢复 | `dsh-subagent/README.md`、`dsh-subagent-spawn-in-process/README.md`、`dsh-tool-subagent/README.md` |
| subagent UI 隐藏 / addressed 地址 | `dsh-client-ui-workspace/README.md`（subagent-origin Sessions remain hidden）、`dsh-experimental-client-ui-agent-team/README.md` |
| Team roster/任务板写 Lead log、projection schema | `dsh-experimental-agent-team/README.md`；`dsh-client-ui-deliverables/README.md` 中 `agentTeam` JSON Schema |
| Team 9 工具 schema | 本会话 `Tool.listTools` 实测（[extensions.md](./extensions.md) §4.1） |
| Team bundle 替换 legacy 工具 | `dsh-experimental-agent-team-profile/cordis.patch.yml` |
| 布局三栏/main keyed slot/shell seals | `dsh-client-ui-layout/README.md`；`lib/client.js` 字符串 `"main"`/`shell.bottom`/`shell.leading`/`shell.overlay` |
| sidebar 一级 panel 入口与 seat | `dsh-client-ui-sidebar/README.md`；`lib/client.js` 字符串 `sidebar.panellist`/`sidebar.workspaces`/`sidebar.settings` 等 |
| Workspace 两级列表与行插槽 | `dsh-client-ui-workspace/README.md`（session.menu.item / row.action / row.leading / row.hover） |
| conversation 槽位（header.actions 等） | `dsh-client-ui-conversation/README.md`；`lib/client.js` 字符串 `conversation.session.header.actions/utilities/corner/lineage` |
| 右侧栏 tab 注册 API/资源地址 | `dsh-client-ui-sidebar-right/README.md`（`sidebarRightTabs.register`、`openTab`、`sidebar.right.pane.tab`） |
| 文件树 tab 样板 | `dsh-client-ui-sidebar-files/README.md`（kind `files`，`workspaceFiles.list`） |
| workspace 文件 Remote | `dsh-api-workspace-files/README.md`（read/readBytes/stat/list/changes、workspace 限定） |
| 上传/附件/落盘 | `dsh-client-file-upload/README.md`、`dsh-attachment-local/README.md`（attachments/v1 布局） |
| 文件/会话引用 | `dsh-file-reference/README.md`、`dsh-session-reference/README.md` |
| 溢写 | `dsh-spill/README.md` |
| preset 定义/选择/默认 | `dsh-agent-preset/README.md`、`dsh-agent-preset-registry/README.md`、`dsh-client-ui-agent-preset/README.md`；profile patch `agent-preset-registry` |
| 系统提示注入/persona/AGENTS.md | `dsh-system-prompt/README.md`、`dsh-persona/README.md`、`dsh-agent-instructions/README.md` |
| skill 扫描根 | `dsh-skill-filesystem/README.md`（rank 100/200/400/500 表格）、`dsh-skill/README.md` |
| goal/plan/workflow/commands | `dsh-goal-round-driver/README.md`、`dsh-plan-mode/README.md`、`dsh-workflow/README.md`、`dsh-commands/README.md`；host inspect `goals`/`planMode`/`workflowEngine` |
| storage/domain/json 与 workspace.json | `dsh-storage-domain/README.md`、`dsh-storage-json/README.md`、`dsh-workspace/README.md`、`dsh-api-workspace-controller/README.md`；`~/.dsh/storages/workspace.json` 实测 |
| bundle/patch 层序与行 | `dsh-base/cordis.patch.yml`、`dsh-web-app/cordis.patch.yml`、`dsh-experimental-agent-team-profile/cordis.patch.yml` |
| client 模块加载 | `dsh-client-modules/README.md`；skill `cordis-plugin-development` 的 `references/ui-plugin.md` + `templates/decoration/` |
| Remote/Typert 与手写 descriptor | `dsh-api-gateway/README.md`、`dsh-typert-registry/README.md`、`dsh-typert-protocol/README.md`（`createTypertRemoteInfo`） |
| 沙箱边界 | `dsh-fs-sandbox/README.md`；web-app/base patch `sandbox-policy`（`DSH_PERMISSION_MODE` 默认 workspace-write） |
| worktree（线程隔离备选） | `dsh-experimental-worktree/README.md`（`ctx.worktrees.create` 建 branch+checkout 并 `workingDirectory.set`） |

---

## 10. 不确定项与验证方法

| # | 不确定项 | 标记 | 验证方法 |
|---|---|---|---|
| U1 | Client slot 的**精确 props 与注册选项**（如 `sidebar.panellist` entry、`conversation.session.header.actions`、`sidebar.right.pane.tab`） | 【推断：来自 README + bundle 字面量】 | 在 GUI 顶层会话调用 `cordis_inspect_query(client, Slots, listSubTree)` 并对具体 root 查询；本会话 client 通道超时（见 R9） |
| U2 | `useSessions`/`useWorkspaces` 的导出包与签名 | 【推断：存在于 `ui-workspace` client bundle，sidebar/team 使用】 | 读 `$ASAR/.../dsh-client-ui-workspace/lib/client.js` 导出段，或客户端 `Service.listService` 查 `uiSession`/`modules` 面 |
| U3 | `ctx.typert.register` + client `ctx.remote.$mount()` 能否在仓库外插件中端到端工作 | 【推断：README 声明允许非生成 owner 注册；未实测】 | 最小 spike：手写一个 `createTypertRemoteInfo` contribution + client `$mount`，在 dev profile 验证一元调用；失败则退 `webServer.register` 路由 |
| U4 | 顶层 Session 是否可带任意自定义元数据（除 `agentPreset`/`cwd`） | 【推断：无公开字段】 | 读 `dsh-session` lib 的类型/`CreateAgentOptions`；或用 `session.create` 后观察 header |
| U5 | `session.create`/`agentLoop.create` 是否可被外部 Host 插件直接调用以创建"线程" | 【推断：`agentLoop` 服务方法公开，但存在 preset-aware resume/ownership fence】 | 从 Host 插件调用 `ctx.agentLoop.create/createAgent` 的 spike；或改用 `sessionController.create` Remote 路径 |
| U6 | Library 放在项目目录时，项目目录是否等于 session cwd（决定模型能否直接写库） | 【推断：取决于 Projects 创建会话时设置的 cwd】 | 设计层强制"Project.dir = session cwd"，用 `dsh-working-directory`/`workspaceController` 验证 |
| U7 | Team 工具与 legacy subagent 工具在模型可见面上的实际替换 | 【本会话 `Tool.listTools` 同时看到 Team 工具与 `subagent`/`subagent_fork`，与 README "disabled" 描述有出入】 | 在顶层会话执行 `Tool.listTools` 对比；检查 `tool-subagent*` 行 `fiberPhase`/`disabled`（`plugin_manager.list_plugins` 或 `Config.listConfigs` 的 inactive 状态） |
| U8 | 新一级页面的 `main` panel 是否需要 `ctx.uiSession.provide()` 之类的 Session 绑定（无会话页面） | 【推断：Plugins 页为全局页面，无需 Session】 | 参考 `dsh-client-ui-plugin-manager/README.md` §browser plugin registers the `plugins` sidebar entry and its `main` panel |
| U9 | `dsh-experimental-worktree` 能否作为"线程工作树隔离"的现成方案 | 【推断：能力匹配，但实验性、默认仅 desktop?】 | 读其 Config schema（`Config.listConfigs` name 过滤）+ 在项目里试建 worktree |
| U10 | 安装产物没有 `docs/`，README 中 `docs/*.md` 链接不可读 | 已确认 | 以 live inspect + 包 README + `lib/*.js` 为准；需要时从源码 checkout 查 docs |

---

## 附录 A：Claude Projects 概念 → DSH 概念映射

| Claude Projects 概念 | DSH 对应/近似 | 差距 |
|---|---|---|
| Project | **无直接对应**；最近似 Workspace（路径分组） | 需新 Project 实体（指令/成员/库/线程索引） |
| Project knowledge（Library） | attachment（字节）+ workspaceFiles（读）+ skills（按需加载）+ AGENTS.md（指令） | 无项目级库/索引/上传入口 |
| Project instructions | `AGENTS.md` 链（agent-instructions）或 preset persona/systemPrompt context | 无"项目设置"UI/存储 |
| Chat / Thread | 顶层 Session（含标题、分叉、归档、并发运行） | 无项目归属字段 |
| Coordinator（主对话） | 一个仅作为协调者的 Session（preset 定义其人格/工具）或 Team Lead | 需要"创建/路由线程"的模型工具 |
| 线程内引用其他线程 | `session-reference`（@会话引用，快照+不可信警告） | 每消息最多 3 个引用源，预算受限 |
| 项目级共享上下文自动注入 | `ctx.systemPrompt.context()` / 项目 skills | 需新插件把项目状态接到 prompt |
| 项目成员/任务 | Team roster + task board（实验） | 实验性，无自动 owner release |
| 文件上传（拖入对话） | `client-file-upload` + attachments（已可用） | 库场景需新增持久归属，而非仅 prompt 级 receipt |
| 工作区隔离（Claude 的 project 文件） | session cwd/workspace + `fs-sandbox`；worktree 实验包 | 沙箱限制模型写库目录；worktree 实验性 |
