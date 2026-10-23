# 附录：DSH 扩展点速查（Slot / Service / Tool / Event / 磁盘布局）

> 配套 [README.md](./README.md)。所有路径前缀：
> `$ASAR = /Applications/DeepSeek Harness.app/Contents/Resources/app.asar/dsh`
> 版本 `0.2.1-rc.2`。标注：
> - ✅ = 本机 live 查询或包 `lib/*.js` 字符串实测
> - 📖 = 包 README 明确记载
> - 【推断】= 由 README/字符串外推，需 live 验证

---

## 目录
1. [Slot 拓扑](#1-slot-拓扑)
2. [Host Service 速查](#2-host-service-速查)
3. [Client 服务与 Remote 命名空间](#3-client-服务与-remote-命名空间)
4. [模型工具 schema](#4-模型工具-schema)
5. [Host Event 速查](#5-host-event-速查)
6. [磁盘与数据布局](#6-磁盘与数据布局)
7. [组成层序与关键行](#7-组成层序与关键行)
8. [待验证精确类型](#8-待验证精确类型)

---

## 1. Slot 拓扑

### 1.1 root-scoped（框架级，由 `ui-layout` / `ui-sidebar` 声明）

| Slot key | 形态 | Owner | 说明 |
|---|---|---|---|
| `main` | keyed | `ui-layout` | 全局面板容器；key `conversation` 保留给会话；`ctx.layout.selectPanel(id)` 切换 ✅ |
| `shell.bottom` | single | `ui-layout` | 全宽底栏（默认空） ✅ |
| `shell.overlay` | single | `ui-layout` | 全屏浮层（弹窗/toast 常用） ✅ |
| `shell.leading` | single | `ui-layout` | macOS 窗口左上角 seat（隐藏侧栏时的关闭/新建按钮） ✅ |
| `sidebar.panellist` | list | `ui-sidebar` | **一级页面图标列表**：entry 需 `id`（= `main` key）+ `label` + icon，可 `order` ✅ |
| `sidebar.workspaces` | single | `ui-sidebar`（由 `ui-workspace` 占用） | 会话/Workspace 浏览区 ✅ |
| `sidebar.settings` | single | `ui-sidebar`（`ui-settings` 占用） | 底部 Settings 入口 ✅ |
| `sidebar.brand.mark` / `sidebar.brand.name` | single | `ui-sidebar` | 品牌标识 ✅ |
| `sidebar.toggle.badge` | single | `ui-sidebar` | 折叠态徽标（非交互） ✅ |
| `sidebar.footer.action` | single/list【推断】 | `ui-sidebar` | 底部动作区（bundle 字符串） ✅ |

### 1.2 会话/侧栏行/会话头（Session-scope 或行级）

| Slot key | 形态 | Owner | 说明 |
|---|---|---|---|
| `sidebar.workspaces.session.menu.item` | list | `ui-workspace` | 会话行 "..." 菜单项；entry 收 `{sessionId, displayTitle}` ✅ |
| `sidebar.workspaces.session.row.action` | list | `ui-workspace` | 会话行 hover 按钮 ✅ |
| `sidebar.session.row.leading` | single | `ui-workspace` | 行首状态/标记 seat（如 schedule 时钟） 📖 |
| `sidebar.session.row.hover` | single | `ui-workspace` | 行 hover 卡片内容 📖 |
| `conversation.header` | single | `ui-conversation` | 会话区根 header（无 Session 时也存在） ✅ |
| `conversation.header.leading` | single | `ui-conversation` | header 左侧（面包屑/线程切换器候选位） ✅ |
| `conversation.session.header.actions` | list | `ui-conversation` | **会话头按钮区**（Team 按钮就在这里） ✅ |
| `conversation.session.header.utilities` | list | `ui-conversation` | 右侧工具区（open-in-app 在此） ✅ |
| `conversation.session.header.corner` | single | `ui-conversation` | 最右角（右侧栏展开按钮） ✅ |
| `conversation.session.header.lineage` | single/list【推断】 | `ui-conversation` | 子会话谱系（ui-subagent 渲染） ✅ |
| `conversation.composer.dock` | list | `ui-conversation` | 输入框底部按钮位（官方建议的简单装饰位） 📖 |
| `conversation.composer` | single（可 takeover） | `ui-conversation` | 输入框整体；可用 ChainSelect 临时接管 📖 |
| `conversation.input.dock` / `.overlay` / `.left` / `.right` | list/single | `ui-conversation` | 输入区周边 seat ✅ |
| `conversation.input.plan` / `.permission` / `.model` | single | `ui-conversation` | 规划/权限/模型指示位 ✅ |
| `conversation.input.activity` | single | `ui-conversation` | 运行活动指示 ✅ |
| `conversation.view` | keyed | `ui-conversation` | 会话视图切换（Chat/Trajectory 等） 📖 |
| `conversation.content` | Factory | `ui-conversation` | 会话主体 Factory 📖 |
| `conversation.session` | single | `ui-conversation` | 默认视图实现 📖 |
| `conversation.hero.*` | keyed/list | `ui-conversation` | 空白会话（New Session）hero 区（`hero.workspace`/`hero.agentPreset`/`hero.options`/`hero.brand.mark`） 📖/✅ |
| `conversation.chat.flow` / `.node` / `.turnTail` / `.user.content` / `.reasoning.body` 等 | Factory/list | `ui-chat` | Chat 渲染扩展点 📖 |
| `conversation.user.text` / `.user.text.node` | Factory/keyed | `ui-conversation` | 用户文本渲染扩展 📖 |
| `conversation.images.content` | Factory | `ui-conversation`/`ui-attachment` | 图片渲染 📖 |
| `conversation.trajectory.images` | single | `ui-trajectory` | 轨迹视图图片 📖 |

### 1.3 右侧栏（`ui-sidebar-right`）

| 注册点 | 形态 | 说明 |
|---|---|---|
| `ctx.sidebarRightTabs.register({id, kind, patterns?, priority?, canOpen?, title, guide?, keepMounted?})` | 服务 API | tab 类型；`id` 全局唯一（建议包名）；`kind` 可分 `builtin`/`extension`（extension 生效）📖 |
| `sidebar.right.pane.tab` | keyed by `id` | tab body；`useTabInfo()` 取 `{sidebar, panel, tab:{record,visible,navigation,signal,actions}}` 📖 |
| `sidebar.right.pane.tab.title`【推断】 | keyed | 可选自定义标题 📖 |
| `ctx.sidebarRight.openTab(kind, options?)` / `openResource(address, options?)` | 服务 API | 打开页面 tab / 资源 tab；资源地址 `dsh-resource://<type>/...` 📖 |
| `ctx.sidebarRight.registerCloseHandler(kind, handler)` | 服务 API | 关闭前异步清理 📖 |
| `ctx.sidebarRight.openTabs` | 服务 API | 打开 tab 元数据（供资源生命周期恢复） 📖 |
| `sidebar.right.tab.files.actions` | list | 文件树 tab 的头部动作（open-in-app 在此） 📖 |
| `sidebar.right.pane.tab`（`ui-sidebar-files` 的 kind `files`） | 现成实现 | 文件树样板，可仿照做 Library 浏览 📖 |

### 1.4 Settings / Plugins 页扩展点（可选）

| Slot key | Owner | 说明 |
|---|---|---|
| `settings.section` | `ui-settings` | 设置页分区（项目设置可加一处）📖 |
| `settings.plugins.tab` | `ui-settings-plugin-inventory` | Plugins 设置 tab 📖 |
| `plugins.item` / `plugins.bundle.config` / `plugins.row.config` | `ui-plugin-manager` | 插件配置页 📖 |
| `plugins.add.actions` / `plugins.detail.*` / `plugins.tab` | `ui-plugin-manager` | 插件页动作/详情/标签 📖 |
| `job.list` | `ui-jobs` | 后台任务列表 📖 |
| `deliverables.file.actions` / `deliverables.review.file.actions` | `ui-deliverables` | 交付物文件动作 📖 |

---

## 2. Host Service 速查

> 来源：`cordis_inspect_query(host, Service, listService)` ✅。

| Service key | 包 | 与 Projects 相关的关键方法 |
|---|---|---|
| `sessions` | `dsh-session` | `create/prepare/enter/announce/flush/get/list/fork` |
| `sessionPersistence` | `dsh-session-persistence-jsonl` | `create/open/flush/stat/list`（读冷会话快照） |
| `sessionProjections` | `dsh-session-projection` | `register/stateOf/snapshot/checkpoint/restore/hydrate` |
| `sessionProjectionCache` | `dsh-session-projection-cache` | `cachedSnapshot/cachedPredecessorTitle/write/coldSnapshot` |
| `sessionQuery` | `dsh-session-query`(+sqlite) | `listSessions/filterSessions/readSession/readTitle(Snapshots)/listEvents/readSurface/traceSession` |
| `sessionTitle` | `dsh-session-title` | `get/rename/refresh/register` |
| `sessionController` | `dsh-api-session-controller` | `list/search/create/fork/rename/prompt/cancel/updateQueue/attachment/page/follow/projections/control/selectModel/modelCatalog` |
| `sessionReferenceResolver` | `dsh-session-reference` | `listCandidates/prepare`（跨会话引用快照） |
| `sessionFileReferences` | `dsh-api-session-controller` | `list(agent,query)`（`@` 文件候选） |
| `sessionSkillCatalog` | `dsh-api-session-controller` | `list`（不激活 Agent 的 skill 目录） |
| `agents` | `dsh-agent` | `currentInitiator/create/resume/register/get/list/roots/announce/isOwnedBy` |
| `agentLoop` | `dsh-agent-loop` | `create/createAgent/resume` |
| `agentPresets` | `dsh-agent-preset-registry` | `register/list/resolve/mount/select/readDocument/remoteExportList/inspectCompositions/compositionInventory/serviceFor/acquireScope/recompose` |
| `subagents` | `dsh-subagent` | `startActivation/waitForChildren/sendMessage/interrupt/drainChildren/drainDescendants/listChildren/listDescendants/prompt/interruptByParent/registerProvider/getProvider/list` |
| `agentTeams` | `dsh-experimental-agent-team` | `membership/listMembers/spawnTeammate/sendMessage/createTask/getTask/listTasks/updateTask/waitForChange/interrupt/tryMembership` |
| `goals` | `dsh-goal` | `get/create/edit/pause/resume/complete/block/clear/disarm/remoteExportCreate` |
| `planMode` | `dsh-plan-mode` | `get(agent)/set(agent,active)` |
| `workflowEngine` | `dsh-workflow` | `start(request)`（`dsh-workflow-ptc` 提供脚本运行时） |
| `commands` | `dsh-commands` | `register/registerFileReceiptResolver/list/find/execute` |
| `skills` | `dsh-skill` | provider 注册/合并 catalog/按需加载（`ctx.skills.register`/`registerProvider`） |
| `systemPrompt` | `dsh-system-prompt` | `section/context/variable/tools/suppressRuntimeContext/assemble/refreshContext/getSectionOrder/getContextOrder` |
| `attachments` | `dsh-attachment`(`attachment-local`) | `saveImage(s)/saveFile/saveFileStream/readFileStream/admitPromptContent/admitEncodedFile/imageHostPath/fileHostPath` |
| `fileUploads` | `dsh-client-file-upload`(host half) | `upload/uploadStream/bindPrompt/retirePrompt/resolve/registerAgentResolver` |
| `fileReferences` | `dsh-file-reference` | `list(agent,query)` |
| `spillStore` | `dsh-spill` | `saveText` |
| `storage` | `dsh-storage` | `backend` 注册表、`mount/form` |
| `storageDomain` | `dsh-storage-domain` | `open(spec)/get(name)/closeAll` |
| `workingDirectory` | `dsh-working-directory` | `defaultDirectory/get/ensure/set` |
| `workspaceRegistry` | `dsh-workspace` | `create/initializeDefault/get/list/delete/insertBefore/archiveSession/unarchiveSession/pinSession/unpinSession/resolveByPath` |
| `workspaceController` | `dsh-api-workspace-controller` | `create/initializeDefault/rename/delete/insertBefore/insertSessionBefore/archiveSession/unarchiveSession/pinSession/unpinSession/follow` |
| `workspaceFiles` | `dsh-api-workspace-files` | `read/readBytes/stat/list/changes` |
| `workspaceChanges` | `dsh-workspace-changes` | `summary/diff`（会话产生的文件变更） |
| `jobs` / `jobController` | `dsh-jobs-local` / `dsh-api-job-controller` | 后台任务 `start/list/get/read/kill/wait`；`list/follow/kill` Remote |
| `tools` | `dsh-tools` | `register/restrict/guard/get/schemas/execute/presentAs` |
| `webServer` | `dsh-host-webserver` | `register(route)/registerUpgrade/registerFallback/tapIndex/renderIndex`（**原始 HTTP 逃生口**） |
| `webApp` | `dsh-web-app` | `getAdvertisedUrl` |
| `clientModules` | `dsh-client-modules` | `graph/clientPath/fetchBundle/artifactBaseline/rebuilt/onRebuilt/onGraphChanged` |
| `settings` / `configEditor` | `dsh-settings` / `dsh-config-editor` | 设置文档读写；Loader 行配置读写 |
| `pluginManager` | `dsh-plugin-manager` | profile/插件安装、启停、bundle 管理 |
| `sandboxPolicy` / `sandbox` | `dsh-sandbox-policy` / `dsh-sandbox-local` | `resolve`/策略（workspace-write 默认） |
| `worktrees` | `dsh-experimental-worktree` | `create(agent,{name?,from?})` → branch+checkout+`workingDirectory.set` |
| `schedule` | `dsh-schedule` | Session 级提醒 |
| `userQuestions` / `approval` | `dsh-user-questions` / `dsh-user-approval` | 交互/审批 |
| `compaction` | `dsh-compaction` | 压缩 |
| `tokenMeter` | `dsh-token-meter` | 计量 |
| `remoteAccess` | `dsh-api-remote-access` | 非 owner Peer 的方法级访问控制（新 Remote 需要） |
| `typert` / `typertGateway` | `dsh-typert-registry` / `dsh-api-gateway` | 运行时注册 schema/descriptor；Remote 分发 |

---

## 3. Client 服务与 Remote 命名空间

| 名称 | 侧 | 包 | 用途 |
|---|---|---|---|
| `ctx.remote.session` | Client Remote | `dsh-api-session-controller` | 会话 |
| `ctx.remote.workspace` | Client Remote | `dsh-api-workspace-controller` | Workspace |
| `ctx.remote.workspaceFiles` | Client Remote | `dsh-api-workspace-files` | 文件读/列/看 |
| `ctx.remote.job` | Client Remote | `dsh-api-job-controller` | 后台任务 |
| `ctx.remote.settings` / `credentials` / `directoryPicker` / `pluginManager` / `pluginMarket` / `account` 等 | Client Remote | 各 `dsh-api-*` | 设置/凭据/目录选择/插件 |
| `ctx.fileUpload` | Client | `dsh-client-file-upload` | 浏览器上传（Blob/stream/bytes） |
| `ctx.modules` | Client | `dsh-client-modules` | 插件模块表/HMR/release |
| `ctx.clientModules` | Host | `dsh-client-modules` | boot graph/bundle 路由 |
| `ctx.slots` | Client | `dsh-client-ui-slots`【推断：由各 UI 包注入】 | `register/inject` |
| `ctx.layout` | Client | `dsh-client-ui-layout` | `selectPanel/toggleSidebar/openRightbar/closeRightbar/panelInfo` |
| `ctx.uiWorkspace` | Client | `dsh-client-ui-workspace` | `startSession/openSession/openWorkspaceSession/forkSession/archiveSession/openWorkspace/connectWorkspace/renameWorkspace/deleteWorkspace/openSearchResult/openDirectoryFlow` ✅（bundle 字符串） |
| `ctx.uiSession` | Client | `dsh-client-ui-session` | `provide()` 物化会话/输入源；`current` 快照 ✅（README + bundle） |
| `ctx.sidebarRight` / `ctx.sidebarRightTabs` | Client | `dsh-client-ui-sidebar-right` | tab 导航/注册 |
| `ctx.locale` | Client | `dsh-client-locale` | `register(ns,{en,zh})/bind/resolveText` |
| `ctx.theme` | Client | `dsh-client-ui-theme` | 主题快照/第三方 token |
| `ctx.remote.$mount/$host/$stream/$on` | Client | `dsh-api-gateway/client` | 手写 Remote contribution 挂载点 |
| `ctx.typert.register` | Host | `dsh-typert-registry` | 运行时注册 schema/descriptor 集合 |

---

## 4. 模型工具 schema

### 4.1 Team 9 工具（本会话 `Tool.listTools` 实测 ✅）

| 工具 | 参数 | 说明 |
|---|---|---|
| `spawn_teammate` | `name`(kebab-case，必填)、`description`(必填)、`prompt`(必填)、`context`(`fresh`/`fork`，默认 fresh) | 仅 Lead 可调用；创建 durable teammate |
| `send_message` | `target`(member target 或 `lead`)、`message` | 运行中在最接近的 step 边界 Steer；inactive 则启动/冷恢复 |
| `list_agents` | — | 返回 Lead + 所有 teammate 的 `target`/availability（inactive 不代表任务完成） |
| `wait_agent` | `timeout_ms`(10000–3600000，默认 30000) | 等待下一个 team 变化；无运行成员时立即 `noProgress` |
| `interrupt_agent` | `target` | 仅 Lead；停止当前 turn，保留 inbox |
| `team_task_create` | `subject`、`description`、`blocked_by?`、`write_scopes?` | 创建 unowned pending 任务（CAS 体系） |
| `team_task_list` | `status?`、`owner?`(或 `unowned`)、`ready?`、`cursor?`、`limit?` | 列任务含 readiness/owner/revision/blockers/写冲突警告 |
| `team_task_get` | `task_id` | 读完整任务（改前必读） |
| `team_task_update` | `task_id`、`expected_revision`、`action`(`claim/release/edit/set_dependencies/complete/reopen/reassign/delete`)、`subject?`、`description?`、`blocked_by?`、`write_scopes?`、`owner?` | CAS 更新；`reassign` 仅 Lead |

### 4.2 其它相关工具

| 工具 | 包 | 参数要点 |
|---|---|---|
| `subagent` | `dsh-tool-subagent` | `description`、`prompt`、`cwd?`；返回 child id，后台完成通知；可配 `agentPreset`/`allowedAgentPresets`/`maxDepth` |
| `subagent_fork` | `dsh-tool-subagent-fork` | 同上，但子代理继承当前会话已完成 turns |
| `send_message`/`interrupt_agent`/`list_agents`（legacy） | `dsh-tool-subagent-control` | 以 `agent_id` 寻址；与 Team 同名工具互斥（team bundle 禁用 legacy） |
| `workflow` | `dsh-tool-workflow` | `script`(JS body)、`meta`、`args?`、`run_in_background?`；脚本内 hook：`agent(prompt,opts?)`、`pipeline`、`parallel`、`phase`、`log` |
| `create_goal`/`update_goal`/`get_goal` | `dsh-tool-goal` | 目标持久化与轮次控制 |
| `exit_plan_mode` | `dsh-plan-mode` | `plan`(markdown，`#` 开头) |
| `todo_write` | `dsh-tool-todo` | 会话内任务列表（非 Team 任务板） |
| `present` | `dsh-tool-present` | `files[{path,description}]`（≤4） |
| `bash`/`read`/`write`/`edit`/`glob`/`grep`/`read_image` | 各 `dsh-tool-*` | 受 `fs-sandbox`/`sandboxPolicy` 约束 |
| `load_workspace_dependencies` | `dsh-tool-workspace-dependencies` | 返回 bundled Python/Node/pnpm 路径 |

---

## 5. Host Event 速查

> 来源：`cordis_inspect_query(host, Event, listEvents)` ✅。与 Projects 相关：

| Event | 模式 | 用途 |
|---|---|---|
| `agent/created` / `agent/disposed` / `agent/status` | serial/emit | 监听 Agent 生命周期与 idle/running（聚合线程状态） |
| `agent/inbox/inserted` / `claimed` / `discarded` | emit | 会话输入队列 |
| `agent/pre-step` / `agent/request` / `agent/request-error` / `agent/turn-stopping` | waterfall | 注入/改写请求 |
| `session/created` / `session/disposed` / `session/event` / `session/flush` | emit/parallel | 会话日志事件与耐久 flush |
| `session/event` 是本报告多数 projection 的基础 | | |
| `api-session/added` / `removed` / `status` / `activity` / `error` | emit | 会话列表/状态流（sessionController 维护） |
| `subagent/start` / `subagent/end` / `provider-added` / `provider-removed` | emit | 子 agent 运行观测 |
| `agent-preset/selected` | emit | 某 session 切换了 preset |
| `goal/changed` / `goal/activation-changed` | emit | 目标状态 |
| `system-prompt/assemble` / `change` | waterfall/emit | 提示装配 |
| `skills/change` | emit | 技能目录变化 |
| `tools/change` | emit | 工具注册/限制变化 |
| `domain/changed` | emit | storage domain 写入（项目元数据变更通知 UI 的现成通道） |
| `workspace/session-activity` / `session-stop` | waterfall/parallel | 归档前询问/停止运行中的工作（turn/subagent/job/schedule 家族） |
| `webserver/index-inject` | emit | index 注入（可用于新页面 bootstrap） |
| `workflow/start|phase|log|agent-start|agent-end|end` | emit | workflow 运行观测 |
| `hmr/reload` / `hmr/change` / `app-boot/config-reload` | emit | 热载/配置重载 |
| `command/…` → `commands/change` | emit | 命令注册变化 |
| `plugin-manager/changed` / `install-state` / `install-log` | emit | 插件安装状态 |
| `schedule/changed` | emit | 定时任务变化 |
| `session-telemetry/record` | waterfall | 遥测（可忽略） |

---

## 6. 磁盘与数据布局

### 6.1 `~/.dsh/`（本机实测）

```
~/.dsh/
├── .anonymous-user-id
├── .credentials.yaml                  # 凭据（未读）
├── attachments/v1/
│   ├── objects/<sha256-prefix>/<sha256>            # 图片（内容寻址、去重）
│   ├── file-objects/<digest-prefix>/<digest>       # 通用文件字节
│   ├── files/<digest-prefix>/<digest>/<name>       # 只读硬链接（展示名）
│   └── tmp/
├── cache/attachments/request-images/              # 图片变体缓存
├── llm-deepseek/                                  # 账号/用量缓存
├── profiles/
│   ├── desktop/{package.json, cordis.yml, cordis.patch.yml, node_modules/, .plugin-manager/, pnpm-*}
│   ├── web/
│   └── node_modules/                              # profile 已安装 bundle 依赖
├── sessions/
│   └── --<normalized-cwd>--/<session-id>/
│       ├── session.v4.jsonl.zstd                  # 当前格式（zstd；compression:'none' 时为 session.v4.jsonl）
│       └── session.lock                           # 单写者
└── storages/
    ├── workspace.json                             # workspace domain（single 布局）
    ├── session_projcache.json
    └── session_projcache/                         # per-record 布局
```

### 6.2 session log 物理格式

- 文件首行是 header（含 `id/createdAt/cwd/parentSession/origin/delegationDepth/isSeeded/agentPreset`），随后一条 durable event 一行 JSON（v0/v1 有 packed assistant-delta 行）。
- 历史代 `session.jsonl(.zstd)`、`session.v1/v2/v3...`；运行时选最高代；写打开会迁移并发布新代（源文件字节不变）。
- 崩溃：保留已提交前缀，恢复时补 synthetic closers；撕尾帧只保留完整记录；校验失败视为 corruption。
- 会话 id 做路径段转义（无穿越/碰撞）；cwd 规范化后决定 project 目录名。

### 6.3 `workspace.json`（v2，本机实测结构）

```json
{ "unit": {"name":"workspace","version":2},
  "global": {"initialized":true,"defaultWorkspaceId":"...","workspaceIds":["..."],
             "archivedSessionIds":[],"pinnedSessionIds":[]},
  "tables": {"workspaces":{"<id>":{"path":"/abs/dir","title":"...","sessionIds":["session-..."],
                                   "createdAt":...,"updatedAt":...}}}}
```

> 项目元数据的建议：新增独立 domain（`projects`），**不要改这个文件**；参照其 `unit/global/tables` 形态与 single/per-record 布局选择。

### 6.4 profile 文件

| 文件 | 作用 |
|---|---|
| `~/.dsh/profiles/desktop/package.json` | profile 名 + `dsh.profile.bundles` 有序列表 |
| `~/.dsh/profiles/desktop/cordis.yml` | 空 entry 列表（树由 patch 组成） |
| `~/.dsh/profiles/desktop/cordis.patch.yml` | profile 覆盖层（最后应用；`config` 整体替换） |
| `~/.dsh/profiles/desktop/node_modules/` | profile 安装的 bundle 依赖 |

---

## 7. 组成层序与关键行

层序（后层覆盖前层，按 `id` 定位）：`dsh-base/cordis.patch.yml` → `dsh-web-app/cordis.patch.yml` → `dsh-experimental-agent-team-profile/cordis.patch.yml` → `~/.dsh/profiles/desktop/cordis.patch.yml` → 启动 `--patch` 覆盖。

### 7.1 base 层与 Projects 相关的行

`session`、`session-persistence-jsonl`（`root: dshHomePath('sessions')`）、`attachment-local`、`session-query-sqlite`（`openAt: never`）、`working-directory`、`session-projection`、`storage`/`storage-json`（`root: dshHomePath('storages')`）/`storage-domain`（`backend: json`）、`session-projection-cache`、`sandbox-policy`（默认 `DSH_PERMISSION_MODE ?? 'workspace-write'`）、`fs-sandbox`、`approval`（非 full-access 时 `ask`）、`subagent`/`subagent-spawn-in-process`/`subagent-fork-in-process`、`agent-instructions`（`maxBytes: 65536`）、`skill`/`skill-filesystem`/`tool-skill`、`commands`、`goal`/`goal-round-driver`/`command-goal`、`plan-mode`、`system-prompt`、`tools`、`agent-loop`、`llm-*`。

### 7.2 web-app 层与 Projects 相关的行

`session-controller`、`job-controller`、`workspace-files`、`workspace-controller`、`workspace`（`dsh-workspace`）、`session-reference`、`file-reference-local`、`session-stats`、`session-turn-outline`、`session-log-download`、`open-in-app`(+ui)、`directory-picker`(auto)、`plugin-inventory`、`modules`（client-modules）、`connection`、`file-upload`、`api-remotes`、`ui-theme`、`locale`、`shortcuts`(+ui)、`ui-layout`、`ui-renderer`、`ui-session`、`resources`、`ui-sidebar`、`ui-sidebar-right`、`ui-sidebar-documentpreview`、`ui-sidebar-files`、`ui-sidebar-terminal`、`ui-settings*`、`ui-plugin-manager`、`ui-conversation`、`ui-chat`（base? web? 由 preset/base 提供）、`ui-approval`、`ui-plan`、`ui-goal`、`ui-jobs`、`ui-schedule`、`ui-subagent`、`ui-workspace`、`ui-agent-preset`、`ui-deliverables`、`ui-reference`、`ui-attachment`、`ui-command*` 等。
另外 web-app patch 明确：`session-query-sqlite.path=':memory:'`、`openAt:'never'`（全文搜索默认关）；`system-prompt.personaPrefix` 设为 "You are a coding agent powered by the {{model}} model."。

### 7.3 team-profile 层（32 行全文要点）

- 禁用：`tool-subagent-control`、`tool-subagent-list-agents`、`tool-subagent`、`tool-subagent-fork`。
- 插入：`agent-team`（`maxMembers:8, maxTasks:256, maxMessageBytes:65536, disposalTimeoutMs:5000`）、`tool-agent-team`（`freshProvider:spawn, forkProvider:fork`）、`ui-agent-team`（`dsh-experimental-client-ui-agent-team`）。

### 7.4 profile patch 层（本机）

`ui-settings-general.welcomeNoticeVersion`、`agent-default-model{provider:deepseek-official, model:deepseek-flash, reasoningEffort:max}`、`locale.preference: zh`、`ui-chat{transcriptView:standard, performanceUsage:detailed}`、`ui-settings.enabled:true`、`ui-settings-account{...}`、`agent-preset-registry{default:standard, selectedDefault:standard}`。

### 7.5 live 组成证据（节选）

- `Config.listConfigs` 实测 entry id 形如 `include:<patchId>`（bundle patch 经 `cordis:include` 装载）；`include:agent-team`、`include:session-persistence-jsonl`、`include:storage-domain`、`include:workspace` 等均可见；`total: 196`。
- `include:agent-team` 的 `packageDir` = `.../app.asar/dsh/node_modules/@deepseek-ai/dsh-experimental-agent-team`，Config schema 含 `maxMembers/maxTasks/maxMessageBytes/disposalTimeoutMs`。
- 一批 preset 内工具行（`tool-bash`/`tool-fs`/`tool-goal`/`plan-mode`/`tool-todo`/`tool-workflow` 等）在 host 层为 `inactive`，因为它们挂在 preset scope 内——判断某行是否真活要看所在 scope，不能只看 host 状态。

---

## 8. 待验证精确类型

1. **Slot 注册/Props 精确类型**（`Slots.listSubTree` 的 catalog 与 occupant props）——本会话 client 通道超时，需从顶层会话页验证：
   `cordis_inspect_query(client, Slots, listSubTree)`，再对 `sidebar.panellist`、`conversation.session.header.actions`、`sidebar.right.pane.tab`、`main` 单独查询。
2. **`useSessions`/`useWorkspaces` 的导出路径与快照形状**——读 `$ASAR/.../dsh-client-ui-workspace/lib/client.js` 导出表，或 client `Service.listService` 查 `modules`/`uiSession`。
3. **`ctx.uiWorkspace` 服务的完整类型**（`startSession` 选项、`openSession`/`openWorkspaceSession` 目标形态）——bundle 字符串只给了名字，需查 client 服务契约或 `ui-workspace/client` 导出。
4. **`ctx.sidebarRightTabs.register` 的 TS 类型与 `priority` band 取值**（`extension`/`builtin`/`fallback` 为字符串字面量）——README 有说明，需按实际注册测试。
5. **手写 Typert contribution 的可行形式**：`createTypertRemoteInfo(spec, z)` 的 `spec` 形状（descriptors/methods/parameters/result codec）与 `ctx.typert.register`/`ctx.remote.$mount` 的配对；建议做最小 spike。
6. **`session.create` 是否支持传自定义 `cwd`/workspace 归属**（决定"项目目录=会话 cwd"能否从 UI 新建线程时设定）。
7. **Team 工具与 legacy subagent 工具的模型可见性替换**（本会话 `Tool.listTools` 两者并存，需顶层会话对比）。
8. **`ui-workspace` 隐藏 subagent-origin 会话的实现位置**（`lib/client.js` 过滤条件），以确认能否为新一级页面复用其列表过滤规则。
9. **`dsh-experimental-worktree` 的 Config 与平台可用性**（`Config.listConfigs` name 过滤）。
10. **官方安装包是否提供 `docs/`**：本机确认没有；如需子系统文档，需源码 checkout（或在线文档）。
