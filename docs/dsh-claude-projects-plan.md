# 在 DSH 中复刻 Claude「Projects」：调研结论与改造方案

> 日期：2026-10-22　｜　版本：v1.1（含两路独立评审修订）　｜　对象：DeepSeek Harness（下称 DSH）0.2.1-rc.2，desktop profile
> 依据：
> - Claude 侧调研：[`research/claude-projects/README.md`](../research/claude-projects/README.md)（下称 **R1**，含 S1–S17 来源编号）
> - DSH 侧侦察：[`research/dsh-capabilities/README.md`](../research/dsh-capabilities/README.md)（下称 **R2**）与 [`extensions.md`](../research/dsh-capabilities/extensions.md)（下称 **R3**）
> - 本文标注约定：**【已证实】**= 官方文档/源码/实测直接支持；**【推断】**= 由证据外推，需 spike 验证；**【设计】**= 本文的工程决策。
>
> 一句话：**用户描述的「Coordinator + 线程 + Library」是 Claude Code 2026-09-17 起 public beta 的新 Projects，不是 claude.ai 旧版 Projects。DSH 现有底座已覆盖大部分底层能力，建议不改核心，以一个实验性 bundle（Host 项目域 + 协调者/线程工具 + 自研项目记忆 + 项目级 Library + Projects Web 页面）分层实现。**
>
> **2026-10-22 决策更新（v1.2）**：Memory 采用 **自研骨架 + 可选检索**（见 [ADR 0002](decisions/0002-self-built-project-memory.md)），语义检索不进 MVP；仓库形态定为**单仓多包**、License **Apache-2.0**（见 [ADR 0001](decisions/0001-plugin-first-open-source.md)）；UI 原型见 [`prototype/projects-ui.html`](../prototype/projects-ui.html)。MVP 预计 4–5 周。

---

## 目录

- [0. TL;DR（结论先行）](#0-tldrtldr结论先行)
- [1. Claude 的 project 模式到底是什么](#1-claude-的-project-模式到底是什么)
- [2. DSH 现状：能复用什么、缺什么](#2-dsh-现状能复用什么缺什么)
- [3. 总体方案](#3-总体方案)
- [4. 实施设计（包、API、工具、UI 落点）](#4-实施设计包apitoolui-落点)
- [5. 分阶段落地计划](#5-分阶段落地计划)
- [6. 与 Claude 的差异 / 非目标](#6-与-claude-的差异--非目标)
- [7. 风险与对策](#7-风险与对策)
- [8. 更轻的替代方案](#8-更轻的替代方案)
- [9. 待决策问题](#9-待决策问题)
- [10. 参考与证据索引](#10-参考与证据索引)

---

## 0. TL;DR（结论先行）

1. **先纠正一个常见混淆**：Claude 生态里有三种「Projects」——① **Claude Code Projects（新，2026-09-17 public beta）**：一个长期协调会话 + 每个任务一个独立线程（cloud session）+ 共享 Library/instructions/memory/Overview，**这才是用户描述的东西**；② claude.ai/Desktop 旧版 Projects：文件夹 + project knowledge + instructions；③ Cowork Projects：任务工作区。三者不可混为一谈。【已证实，R1 §1】
2. **Coordinator 不是一个权力更大的 agent**，而是「项目对话这个长期会话的角色」：它只读线程汇报、决定就地回答/新开线程/复用线程、维护 memory；项目对话本身**没有 connectors**，需要 MCP 的工作必须派给线程；用户必须**在线程内** steer/批准。【已证实：只读汇报/无 connectors/路由/可原地答快问，R1 §3】「刻意弱化、不做重执行」是 R1 的推断与本文的设计取向，不是官方文档的原话。【推断/设计】
3. **「关闭线程」= Resolved，不是删除**：手动 / Claude 判断最后一步完成 / 一周无活动自动收尾，可 reopen，分支与 PR 保留。Overview 六分组：Ready for review / Waiting on you / Working / Landing / Idle / Resolved。【已证实，R1 §4.5、§5】
4. **DSH 已具备约 70–80% 的底座**：event-sourced Session（持久化/恢复/标题/fork/归档/停止全现成）、可续跑子会话（subagent）、Session 投影、storage domain、系统提示注入、文件上传/附件、Skills、右侧栏 tab 体系、worktree、schedule、preset、Team（roster+任务板）。R2 的结论是：**最大缺口是「Project 实体 + project↔session 关联」「项目级 Library 服务」「新 Remote 命名空间」「项目→线程的两级 UI」「模型侧开/列/停线程的工具」**。
5. **推荐方案**：**不改 DSH 核心，新增 1 个实验性 bundle**，按「项目域（Host storage domain）→ 协调者 preset + 项目工具 → 线程运行层 → 项目级 Library → Projects Web 页面 + Overview/Library 右侧栏 tab」分层实现。线程载体先做 **M0 spike 二选一**：**默认推荐「顶层 Session」**（`ctx.sessionController.create/prompt/cancel` 已确认存在于 Host 服务，线程是完整独立会话，最贴近 Claude 语义），**可续跑子会话（continuable subagent）作为备选/加速路径**（inbox/steer/中断/冷恢复/完成通知现成，但受父会话在线、侧栏隐藏与谱系语义约束）。
6. **节奏**：M0 验证 spike 1–3 天；M1 项目容器 + Library 5–8 天；M2 线程闭环 + Overview 8–12 天（**MVP ≈ 3–4 周**）；M3 注意力/生命周期/限额 5–8 天；M4 隔离与增强（worktree、定时、建议线程）8–12 天。1–2 人全职估算，完整 6–8 周。
7. **如果只想「现在就能多智能体协作」**：本机 desktop profile 已启用实验性 Agent Teams（本文档的 Lead+teammates 就是它），零开发即可用，但它**不是 Projects**：没有项目容器、Library、Overview、跨天项目语义。详见 [§8](#8-更轻的替代方案)。

---

## 1. Claude 的 project 模式到底是什么

### 1.1 三个同名「Projects」

| # | 名称 | 形态 | 与用户描述的关系 |
|---|---|---|---|
| ① | **Claude Code Projects**（新，public beta） | 一个长期「项目对话」= Coordinator；每个任务一个独立线程（默认 cloud session）；共享 repositories / instructions / memory / Library / cloud environment；Overview 面板 | **就是用户说的东西** |
| ② | claude.ai / Desktop 旧版 Projects | 自包含工作区：自己的聊天历史 + project knowledge（上传文档）+ project instructions；RAG 扩容；Team/Enterprise 可分享 | 同名不同物；新版正逐步迁移旧项目 |
| ③ | Claude Cowork Projects | 把相关任务归到专属工作区（files/context/instructions/memory/scheduled tasks） | 又一个同名概念；不是协调会话 |

【已证实，R1 §1；S1=code.claude.com/docs/en/claude-projects，S11=support.claude.com 9517075】

**可用性（beta 期，会变）**：Pro/Max，public beta 分批放量，Team/Enterprise 暂不可用；入口只有 claude.ai/code、桌面端 Code tab、Claude 手机 App；**CLI / VS Code / JetBrains 插件不支持**；Bedrock / Google Cloud Agent Platform / Microsoft Foundry 不支持。【已证实，S1】

**涉代码项目的前置**：代码必须在 github.com（不支持 GHES/GitLab/Bitbucket 作为项目仓库）、联网 GitHub 账号有 push 权限、仓库上安装了 Claude GitHub App（`/web-setup` 的 token 只够其他 cloud sessions，项目线程不够）；org 仓库需 owner 批准，强制 SAML SSO 还需额外授权。【已证实，S1】纯文档项目不需要 GitHub，上传资料即可。

### 1.2 Claude Code Projects 全貌

```
你
└─ Project：目标/指令/记忆/repos/文件/云环境/插件/用量/生命周期
   ├─ 项目对话（Coordinator，长期会话）
   │   ├─ 就地回答（quick question）
   │   ├─ 新开线程 / 复用已有线程（并告诉你分发到哪）
   │   └─ Suggested threads（建议列表，逐个/一键启动）
   ├─ Threads（每个 = 独立会话，默认 cloud session；或经 Remote Control 跑在本机）
   │   ├─ 独立 context / 独立 branch / PR（auto-fix 默认开）
   │   ├─ 可看 transcript、在线程内 steer、回答权限提示、Stop
   │   └─ 线程内部仍可再用 subagents
   ├─ Library（用户上传文件/文件夹/GDrive + 线程产出文件；云线程从 /mnt/project-files 读）
   ├─ Pull requests（线程开的 PR）
   ├─ Scheduled tasks（项目内定时任务，以线程形式跑）
   └─ Overview（Threads 六分组 + Library/PR/Scheduled 三个 tab）
```

**创建方式**：从零（Name 必填 / Goal 可选 / Context 可选：repos+files+文件夹）或从已有 cloud session「Continue as project / Move to project」。项目第一次打开时 Claude 可能自动跑一个 turn（探索 repo / 给 Setup recommendations）。【已证实，S1】

**每个云线程启动时带什么**（这是设计上下文注入的关键）：

| 会带上 | 不会带上 |
|---|---|
| 项目 repositories + files（`/mnt/project-files`）+ instructions + memory | 仓库的 `.claude/settings.json`（权限/hooks/env）、`.mcp.json`、`.claude/skills/`、agents/commands |
| 每个仓库根的 `CLAUDE.md`、`.claude/CLAUDE.md`、`.claude/rules/`（子目录 CLAUDE.md 与 path-specific rules 不加载） | 用户本机的 Claude Code 配置与已装工具 |
| 用户账号级 connectors / skills；Project settings > Plugins 配置的插件 | 仓库里声明的 MCP servers（要改用 connectors）、插件（要项目级配置） |
| 项目 cloud environment（网络、env vars、network secrets、setup script） | 仓库 SessionStart hooks、仓库 permission rules |

【已证实，S1 §"What threads pick up from your repositories"】

**线程生命周期**：Working →（有 PR）Ready for review →（批准）Landing →（合并后）Resolved；无 PR 的线程 Idle → 一周无活动或手动 Resolved；失败/要回复/要批准 → Waiting on you。Resolved 可 reopen，分支和 PR 留在 GitHub。【已证实 + 状态流转【推断】，R1 §4.5、§5】

**Library**：上传 = **快照拷贝**（改本地文件不同步，同名重新上传时 Replace）；限额：Library tab 单次 ≤100 文件/2GB、单文件 ≤480MB；New project 对话框跳过 >30MB；文件夹只拷前 100 文件/≤200MB（排除 >30MB、隐藏文件、node_modules）；最多 10 个文件夹（单个文件不计）。项目总量配额官方未给。【已证实，S1 §"Add files and folders"】

**项目级上下文三件套**：Project instructions（每个新线程 + 项目对话都收到，≤16,000 字符）／Project memory（`MEMORY.md` 索引 + Claude 自写的其他文件，每个云线程启动读索引、按需打开；与仓库 CLAUDE.md、本机 auto memory 都不同）／Repositories（每个线程 clone，只加载仓库根 CLAUDE.md）。【已证实，S1 §"Give a project standing context"】

**用量与限制**：并入 plan limits、无独立 VM 费用；唯一硬上限是 **200 个新线程/天**（跨所有项目）；用户要求的「最多跑两条线程」只是偏好，不是硬上限；限额时线程自动等待并续跑（定时任务启动的线程例外）；idle 线程盯着 PR 会被 CI/评论唤醒继续消耗。【已证实，S1 §"Usage and cost"】

**治理**：Pause（全停、不收新消息）/ Archive（隐藏、归档线程）/ Delete（永久删项目+线程+memory+文件，不可撤销；GitHub 分支/PR 不受影响）；项目单用户不可分享、线程不可跨项目移动、不能合并项目。【已证实，S1 §"Project settings reference"、Limitations】

### 1.3 用户原话逐条核对

| 用户的理解 | 判定 | 更精确的说法 |
|---|---|---|
| 开启后有一个主 Coordinator | ✅ 基本正确 | 是「项目对话这个长期会话」的角色，有独立的 Coordinator model/effort；不是另起一个总 agent |
| 负责统筹、给每个任务开线程 | ✅ | 路由每条消息：就地答 / 新线程 / 复用线程 / 建议线程；多个不相关任务拆多个线程 |
| 线程里可以询问和做事 | ✅ | 线程是完整会话，可跑命令/改代码/开 PR；可读 transcript、steer、回答权限提示、Stop |
| 做完后关闭线程 | ⚠️ 半对 | 准确概念是 **Resolved**（可 reopen，不是删除）；手动/最后一步完成/一周无活动自动 |
| Library 存储上传的数据 | ✅ 大体正确 | 同时存上传物**和线程产出物**；云线程以 `/mnt/project-files` 只读；上传是拷贝、支持 Replace；有限额 |
| （隐含）旧版 Projects 升级 | ⚠️ | 是重设计后的新体验，从 Claude Code 起步；旧项目后续迁移 |
| （隐含）CLI 也能用 | ❌ | CLI/VS Code/JetBrains 均不支持；仅 claude.ai/code、桌面 Code tab、手机 App |
| （隐含）可分享给团队 | ❌ | 项目单用户、线程 transcript 不可分享；团队协作由 Claude Tag 承担 |

### 1.4 九个本质能力 vs Claude 的实现细节

**本质能力（复刻时应当保留）**

| # | 能力 | 说明 |
|---|---|---|
| E1 | **项目容器** | 一个长期工作范围：目标 + 资源（仓库/文件）+ 规则 + 记忆 + 环境 + 用量 + 生命周期 |
| E2 | **协调者** | 持久入口：路由消息、维护线程台账、汇总、维护记忆；官方证实它只读线程汇报、不代批准、无 connectors；「不做重执行」是 R1 的推断/本文设计取向 |
| E3 | **任务线程** | 独立上下文、可并行、可 steer/批准/停止/查看、有终态与重开、做完向协调者汇报；归属项目，可独立打开/继续 |
| E4 | **共享知识面** | 常驻指令（每次注入）+ 可积累记忆（索引+按需文件）+ 只读资料库（Library），三者职责分明 |
| E5 | **状态总览** | 一屏呈现「需要我 / 进行中 / 待审 / 收尾」，把注意力路由到人 |
| E6 | **生命周期与治理** | pause/archive/delete、线程单向绑定项目、删除级联边界（单用户/不可分享是 beta 政策，不是本质能力） |
| E7 | **执行环境解耦** | worker 在隔离环境或本机执行，接口是「派任务 + 收汇报」；DSH 里对应「线程各自的工作目录/worktree + 汇报」 |
| E8 | **成本与限额可见** | 按线程/模型统计用量、限额行为可预期（Claude 的 Usage/plan limits；DSH 对应 `tokenUsage` projection / token-meter + 可配置限额） |
| E9 | **交付物落地** | 线程产出要么进入代码宿主（branch/PR），要么进入项目资料库（Library）；文档类项目必须有明确的「产出→Library」路径 |

**Claude 的实现细节（不要当需求）**：GitHub App / 仅 github.com / 每线程独立 branch+PR+auto-fix、Anthropic 云 sandbox（4vCPU/16GB/30GB、环境缓存、network allowlist/secrets、setup script）、`/mnt/project-files` 挂载路径、`MEMORY.md` 文件格式、Opus 默认与 effort 默认值、200 线程/天与 480MB/2GB 等配额、一周自动 Resolved、Continue as project / waitlist、桌面通知/手机/Remote Control 等入口实现。

**三条设计教训**（R1 §12.3，本文采纳）：
1. 别把 Coordinator 做成「更强的 agent」——权力越少，行为越可预期、越省 token。
2. 线程的「完成」必须可判定、可重开、外部产物保留——这才撑得住无人值守。
3. 上下文靠「注入 + 压缩 + 记忆」三件套，而不是让用户手动管理。

---

## 2. DSH 现状：能复用什么、缺什么

### 2.1 一句话架构

DSH = Cordis 插件树 + **event-sourced Session**（append-only 日志，JSONL/Zstd 落盘，投影派生模型历史）+ bundle/patch 组成 + Web Client（Slot 体系）与 Host（Service + Remote）分离。**所有产品功能都是插件行**；新增功能的标准做法是「写包 → 写 bundle patch → 装进 profile」，不需要改核心代码。

【R2 §0、R3 §7；证据：`$ASAR/package.json`、`dsh-base/cordis.patch.yml`、`dsh-web-app/cordis.patch.yml`】

### 2.2 Claude Projects 概念 → DSH 对应

| Claude 概念 | DSH 对应 / 最近似 | 复用度 | 结论 |
|---|---|---|---|
| Project 容器 | **无直接对应**；Workspace 只是目录分组 | 30% | **必须新写** Project 实体（新 storage domain） |
| Coordinator 对话 | 一个普通 Session + 专用 agent preset | 80% | 复用 preset + systemPrompt/instructions；补「项目工具」与路由策略 |
| Thread 线程 | ① 顶层 Session（`sessionController.create/prompt/cancel`）② 可续跑子会话（subagent） | 85% / 70% | M0 二选一 spike；默认 ①（见 §3.4） |
| 线程内 steer/stop/查看 | `sessionController.prompt/cancel`（A）或 subagent inbox/steer/interrupt（B）；会话 UI 现成 | 75% | 复用为主；补项目侧编排与状态 |
| Library | attachment 字节层 + workspaceFiles 读 + `@` 文件引用 + skills | 50% | **新写项目级 Library 服务**（上传入口、索引、去重、产出物回收入库） |
| Project instructions | AGENTS.md/CLAUDE.md 链（agent-instructions）+ systemPrompt.context() | 90% | 复用；项目指令存 domain，注入时与 AGENTS.md 合并 |
| Project memory | 无现成；可用 skills/AGENTS.md 近似 | 20% | **自研 `dsh-project-memory`**（`MEMORY.md` 索引 + 每事实文件 + 四类型 + git-repo scope + 注入 + 治理；可选检索 adapter 放 M2+） |
| Overview 状态总览 | 右侧栏 tab 体系 + session 状态/`pendingInteraction` 投影 | 60% | 新写 Overview tab（Threads 分组/Library/Usage） |
| 项目生命周期 | Workspace 的 archive/delete + 自定义 domain 字段 | 50% | 新写 project 状态机与级联语义 |
| 用量/限额 | tokenUsage projection、token-meter、session 列表投影 | 60% | 复用统计；新写项目级限额与计数 |
| 隔离（每线程 branch/worktree） | `dsh-experimental-worktree` / 本地 git worktree | 60% | M4 接入；MVP 先共享项目目录 + 写入约定 |
| 定时任务 | `dsh-schedule` + tool-schedule + ui-schedule | 70% | M4 接入「项目 Scheduled tasks」tab |

### 2.3 可直接复用的关键扩展点

**会话 / 线程**
- `dsh-session`（`ctx.sessions`）：create/get/list/fork/flush、event log、`deriveMessages()`。【R2 §2.1】
- `dsh-session-persistence-jsonl`：`~/.dsh/sessions/--<cwd>--/<sessionId>/session.v4.jsonl.zstd` + `session.lock`；崩溃恢复、单写者锁。【R2 §2.2】
- `dsh-subagent` + `subagent-spawn-in-process`：`startActivation()`、`sendMessage`、`interrupt`、`listChildren`、冷恢复、`subagent/catalog`/`subagent/descriptor` 事件、`maxActiveSubagents`（默认 8）、`maxDepth`（默认 1）。**注意：子会话在侧栏隐藏（`origin:'subagent'`），需 addressed 地址打开。**【R2 §2.4；`dsh-client-ui-workspace` README】
- `dsh-api-session-controller`：Client Remote `session` 的 list/create/fork/rename/prompt/cancel/page/follow/projections；**child composer 支持 Send/Stop、父会话离线时锁定**。【R2 §2.2、§3.4；`dsh-client-ui-conversation` README】
- `dsh-experimental-agent-team`：durable roster + inbox + 任务板 + `agentTeam` projection + Web roster UI。**这是「线程台账 + 汇报 + UI」最接近的参考实现**（不是直接复用，因为 Team 是单任务、flat、实验性）。【R2 §2.5】

**UI 承载**
- 一级页面：`ui-layout` 的 root-scoped `main` keyed slot + `ui-sidebar` 的 `sidebar.panellist`（图标列表），`ctx.layout.selectPanel(id)`。**Plugins 页就是范例**。【R2 §3.1；`dsh-client-ui-layout`/`dsh-client-ui-sidebar` README】
- 会话区：`ui-conversation` 的 `conversation.header.leading`、`conversation.session.header.actions/utilities`、`conversation.composer.dock` 等；`ui-workspace` 的会话行菜单/按钮 seat（`sidebar.workspaces.session.menu.item` / `.row.action` / `.row.leading` / `.row.hover`）。【R2 §3.2–3.3】
- 右侧栏：`ui-sidebar-right` 的 `ctx.sidebarRightTabs.register({id,kind,...})` + keyed slot `sidebar.right.pane.tab` + `ctx.sidebarRight.openTab/openResource`；`ui-sidebar-files` 是现成文件树 tab 样板。**Overview/Library 就做成右侧栏 tab type。**【R2 §3.3；`dsh-client-ui-sidebar-right` README】
- 客户端模块：新增 Client 包 = `package.json` 声明 `dsh.client` + `lib/client.js` + patch 一行；locale/theme 各自注册。【R2 §7.1；skill `cordis-plugin-development` 模板】

**上下文注入**
- `dsh-system-prompt`：`section()` / `context()` / `variable()`，agent-scoped 注册、每步渲染、`refreshContext`。【`dsh-system-prompt` README；R2 §4.2】
- `dsh-agent-instructions`：`AGENTS.md`/`CLAUDE.md` 链（项目根 = 最近 `.git`），base 已启用、`maxBytes: 65536`。【R2 §4.2】
- `dsh-skill` + `dsh-skill-filesystem`：自动扫描 `<projectRoot>/.dsh/skills`、`.agents/skills`，正文按需加载。**Library 里的「手册/规范」可直接变成项目 skills。**【R2 §4.3】
- `dsh-persona`、`dsh-time-context`、`dsh-working-directory`。【R2 §4.2】

**库 / 上传 / 交付**
- `dsh-client-file-upload`（Client `ctx.fileUpload.upload(sessionId, blob/stream, name, ...)`）+ Host `ctx.fileUploads` → `ctx.attachments`（admission）→ `dsh-attachment-local` 落盘 `~/.dsh/attachments/v1/…`（内容寻址、去重、不自动清理）。【R2 §5.1】
- `dsh-api-workspace-files`：`read/readBytes/stat/list/changes`（读 workspace 内为主）。【R2 §5.2】
- `dsh-file-reference` / `dsh-session-reference`（`@` 文件/会话引用；跨线程共享结论可用）。【R2 §5.2】
- `dsh-tool-present` + `dsh-client-ui-deliverables`（声明交付文件；`present` 只记路径不拷贝）。【`dsh-tool-present` README】
- `dsh-spill`（大工具结果溢写）。【R2 §5.2】

**持久化 / 组成**
- `dsh-storage` + `dsh-storage-json` + `dsh-storage-domain`：`ctx.storageDomain.open(spec)`，schema 校验 KV，同步读、写后 durable 再返回、`domain/changed` 事件；本机 `~/.dsh/storages/workspace.json` 是范例。【R2 §6.1；`dsh-storage-domain` README】
- bundle/patch：`insert` / 按 id 覆盖 / `disabled` / group / isolate；实验包惯例（`experimental-*`、README、locale、icon、独立 bundle）。【R2 §7.1】
- 新 Host↔Client Remote 的三种路径：仓库内 typert 生成链 / 外层手写 `createTypertRemoteInfo` + `ctx.typert.register` + client `ctx.remote.$mount` / 退化为 `ctx.connection.fetch.register` 原始路由（Desktop 也走 Connection fetch；`ctx.webServer.register` 只服务浏览器加载的页面，Electron 的 `file://` 场景不可靠）。【R2 §7.1、R6；dsh-explorer 评审修正】

**协调者 / 治理**
- `dsh-agent-preset` + `agent-preset-registry`（按 session 选择、`agent-preset/selected`、bundle patch 声明新 preset）；`dsh-client-ui-agent-preset`。【R2 §4.1】
- `dsh-goal` + `goal-round-driver`（无人值守多轮）、`dsh-plan-mode`、`dsh-workflow`、`dsh-commands`、`dsh-schedule`。【R2 §4.4】
- `dsh-token-meter`、`tokenUsage` projection（token 用量；session-stats 只是 turn/step 计数）；`dsh-user-approval`/`user-questions`/`client-ui-approval`（审批提示与 `pendingInteraction` 分类）。【R2 §2.2、§3.4；R3 §2；dsh-explorer 评审修正】
- `dsh-experimental-worktree`（`ctx.worktrees.create(agent,{name?,from?})` → branch+checkout+切 cwd）。【`dsh-experimental-worktree` README】

### 2.4 硬缺口与约束

| # | 缺口/约束 | 说明 | 处理 |
|---|---|---|---|
| G1 | **没有 Project 实体与 project↔session 关联** | `SessionHeader` 只有 `id/createdAt/cwd/parentSession/origin/delegationDepth/isSeeded/agentPreset`，无 project 字段；且 `appendPluginRecord` 只允许仓库内 experimental 包调用，外部插件不应写自定义 session 事件 | 新建 `projects` storage domain；项目记录存 `coordinatorSessionId` + `threads[]`；**不要**改 session header、不要写自定义 session 事件 |
| G2 | **没有项目级 Library 服务** | 上传/附件是 **Session 级 receipt**（prompt 消费即退场），不能当项目共享库 | 新写 Library Host 服务：字节复制 + 内容寻址 + 索引 + 上传入口 + 产出物回收入库 |
| G3 | **新 Remote 命名空间需要 Typert descriptor** | 仓库外没有生成链；手写 `createTypertRemoteInfo` 可行但未实测 | M0 spike；失败则退 `ctx.connection.fetch.register` 原始路由（自己校验/鉴权；Desktop 可用） |
| G4 | **没有 Project→Thread 两级 UI** | 侧栏只有 Workspace→Session；`ui-workspace` 不显示 subagent-origin 会话 | 新写 Client 包：Projects 一级页面（`main`+`panellist`）+ 项目内线程列表；不要改上游 `ui-workspace` |
| G5 | **没有模型侧「开/列/停线程」的项目语义工具** | subagent 工具产出子会话；Team 工具服务于单任务、名字冲突 | 新写 `dsh-tool-project`（scoped 注册，避免与 Team/legacy 工具冲突） |
| C1 | **单进程** | 线程只在 DSH 进程存活时运行；无云端「关笔记本继续跑」 | 明示差异；线程 idle 后会话持久化，下次消息冷恢复 |
| C2 | **沙箱** | `workspace-write` 下模型写只允许 session workspace + temp；Library 若在 cwd 外只能 Host 代写/或 materialize 到 workspace | Library 由 Host 管理；给线程提供 `project_library_materialize` 拷入 workspace 只读副本 |
| C3 | **实验包无稳定性承诺** | Team/subagent/worktree 均在 experimental | 首版不硬依赖 Team；锁定版本，自建测试，bundle 可回滚 |
| C4 | **上游插槽会演进** | UI slot 可能变化 | 只用公开 seat + `slots.inject()`，不 fork 上游包；锁定 peer 版本 |

---

## 3. 总体方案

### 3.1 设计原则

1. **插件优先，不改核心**：全部能力以「Host 包 + Client 包 + bundle patch」交付，可独立启停、可回滚（`plugin_manager.install_bundle` / 从 profile 移除）。
2. **Session 是唯一执行真相，Project 域是唯一组织真相**：线程的执行/上下文/恢复归 Session 层；项目归属、线程台账、Library、memory、状态归 `projects` domain。两边用 id 关联，不复制运行时状态。
3. **Coordinator 只做路由/台账/记忆/汇总**：执行一律落到线程；协调者工具面控制在 ~10 个以内，减少 token 与行为不确定性。
4. **线程 = 完整会话，不是「一个更大 agent 的一次工具调用」**：有独立上下文、可并行、可长期 idle、可 reopen。
5. **上下文三件套**：线程创建时注入「项目简报（指令+记忆索引+库索引+任务）」；运行中按需 `project_brief`/`project_library_*`；项目记忆只进索引，正文按需读。
6. **UI 用现有 seat 组装，新页面不抢占既有主面板**：`main` 新 key + `sidebar.panellist` 图标；项目工作台复用「会话主区 + 右侧栏 tab」结构（与 Claude 的「对话 + Overview 侧板」一致）。

### 3.2 目标架构

```
┌────────────────────────────── Client (Web / Desktop) ──────────────────────────────┐
│  ui-project: Projects 页面(main key) │ 项目工作台 = conversation + 右侧栏 tabs     │
│    · 项目卡/新建项目/设置            │   · project-overview（Threads 分组/Usage）  │
│    · 线程列表/打开线程会话           │   · project-library（浏览/上传/预览）        │
│    · 会话行菜单 "Move to project"    │   · 线程内 header（项目面包屑/Resolve）      │
│    ↕ Remote `project` 命名空间（list/get/create/update/thread/library/follow）      │
└─────────────────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────── Host (Cordis 插件树) ────────────────────────────────┐
│ dsh-project（核心服务）                                                             │
│   · projects storage domain：Project / Thread / LibraryEntry / MemoryFile           │
│   · ctx.projects：CRUD、线程台账、状态聚合、限额/计数、自动 Resolve、暂停/归档/删除   │
│   · 线程运行层适配器（ThreadRuntime）：spawn/prompt/steer/cancel/resume/monitor      │
│   · 完成/失败观测：subagent/end、agent/status、session/event → 台账 + 唤醒协调者      │
│                                                                                     │
│ dsh-project-library：上传入口/字节复制/内容寻址/索引/产出物回收/materialize          │
│ dsh-project-context：把项目简报/记忆索引/库索引接入系统提示（按 session→project 映射）│
│ dsh-tool-project：模型工具（scoped 注册到项目成员 agent）                            │
│   · 协调者：project_brief / spawn_thread / list_threads / send_to_thread /          │
│             stop_thread / resolve_thread / reopen_thread / remember / forget /      │
│             library_list / library_add / propose_threads                           │
│   · 线程：project_brief / report / remember / library_list / library_add           │
│                                                                                     │
│ 复用：dsh-session(+persistence/projection) · dsh-subagent · dsh-system-prompt       │
│       dsh-agent-instructions · dsh-skill · dsh-attachment(-local) · fileUploads     │
│       dsh-storage(-json/-domain) · dsh-token-meter · worktree(M4)                   │
└─────────────────────────────────────────────────────────────────────────────────────┘
                ↕ 由 bundle patch 组装，profile 一行启用
┌──────────────────────────── preset / bundle ────────────────────────────────────────┐
│ dsh-project-profile（bundle）                                                       │
│   · 插入 Host/Client 行；声明 projects-coordinator / projects-thread 两个 preset     │
│   · coordinator preset：persona + project 工具 + 通用工具；thread preset：执行工具 +  │
│     project 工具（只读库/记忆）+ present/fs/bash                                              │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 数据模型与持久化

**选型**：新建 `projects` storage domain（`defineDomain`），复用 `dsh-storage-json`（single 布局，`~/.dsh/storages/projects.json`）。理由：workspace domain 语义是目录分组、不可污染；session log 不允许外部插件写自定义事件；domain 提供 schema 校验、同步读、durable 写、`domain/changed` 事件。**不新增 SessionHeader 字段**。

**表结构（v1，摘要）**

```ts
// 全局
global: {
  projectIds: ProjectId[]              // 展示顺序
  counters: { dayKey: string, threadsCreated: number }  // 200/天限额
}
// tables
projects: Record<ProjectId, {
  id, title, icon?, goal?,
  instructions: string,                 // ≤16,000 字符（service 校验）
  dir?: string,                         // 项目主目录（canonical path）；纯文档项目可为空
  repoDirs: string[],                   // 参与项目的仓库目录（可多仓）
  coordinatorSessionId: string,         // 协调者会话
  presetIds: { coordinator: string, thread: string },
  modelSettings: {
    coordinator?: { provider, model, reasoningEffort },
    thread?:      { provider, model, reasoningEffort }
  },
  library: { dir: string, entryCount: number, totalBytes: number },
  memory:  { dir: string, indexFile: string },   // MEMORY.md + notes/
  status: 'active' | 'paused' | 'archived',
  autoResolveDays: number,              // 默认 7
  createdAt, updatedAt, archivedAt?
  counters: { threadsTotal: number }
}>
threads: Record<ThreadId, {
  id, projectId, title, brief?,
  sessionId,                             // 线程会话（A=顶层 Session；B=子会话）
  runtime: 'top-level' | 'child',
  parentSessionId?: string,              // 仅 B：协调者会话
  state: 'provisioning' | 'active' | 'resolved' | 'failed',  // 仅持久意图
  model?: { provider, model, reasoningEffort },
  worktree?: { path, branch, baseCommit },
  createdAt, lastActivityAt?, resolvedAt?, resolvedBy?,
  lastReport?: { summary: string, needs?: string, at: number },   // project_report 最近一次
  error?: { code: string, message: string, at: number },          // failed 摘要，不存全文
  deliverables?: string[],               // 最近一次 present / 入库的交付物路径
  usage?: { inputTokens, outputTokens, requests }                 // M3 从 tokenUsage projection/token-meter 汇总
}>
libraryFolders: Record<FolderId, {
  id, projectId, name, kind: 'folder' | 'gdrive',
  entryIds: EntryId[], addedAt
}>
libraryEntries: Record<EntryId, {
  id, projectId, name, kind: 'uploaded' | 'produced',
  mime?, bytes, digest, storedPath,          // 项目库目录内的不可变对象
  source: 'user' | 'coordinator' | 'thread', sourceThreadId?,
  folderId?,                                  // 归属文件夹（可选）
  attachmentId?, addedAt, replacedAt?
}>
memoryFiles: Record<string, {                // key = 相对文件名
  projectId, name, digest, updatedAt, updatedBy: 'coordinator' | 'thread' | 'user'
}>
```

**磁盘布局**

```
~/.dsh/
├── storages/projects.json                      # projects domain（single 布局）
└── projects/<projectId>/
    ├── library/
    │   ├── objects/<digest前2>/<digest>        # 不可变字节（内容寻址去重）
    │   └── index/<entryId>.json               # 可选：便于人读/排障
    ├── memory/
    │   ├── MEMORY.md                          # 索引（每次注入）
    │   └── notes/<slug>.md                    # 按需打开
    └── threads/<threadId>/                    # 可选：线程产物暂存/报告
```

**为什么不做成「Library 放项目目录 cwd 内」**：模型写沙箱只允许 session workspace；多个线程共享同一目录会互相覆盖；`project_library_add` 由 Host 从线程 workspace **拷贝快照**入库（与 Claude「上传是拷贝」一致），线程对库只有只读访问。

### 3.4 线程运行机制（核心决策）

#### 两个可选载体

| 维度 | 方案 A：顶层 Session（✅ 默认推荐） | 方案 B：可续跑子会话（备选/加速） |
|---|---|---|
| 创建 | ✅ `ctx.sessionController.create({cwd, agentPreset, sessionId?})` → `prompt({requestId, sessionId, mode:'queue', content})`（Host 服务已确认存在；M0 验证插件注入） | `ctx.subagents.startActivation({provider:'spawn', label, request:{parent: Agent, prompt: ContentBlock[], agentPreset, agentOptions, cwd?, maxDepth?}, signal, delivery:'parent'})`；**`parent` 必须是 live Agent**（协调者冷启动需先 `agents.get`/resume） |
| 审批（关键差异） | ✅ 顶层会话有原生审批 UI：线程内弹审批、项目页可打开线程批准、`pendingInteraction` 投影可聚合 Waiting on you | ❌ **in-process 子会话的审批被 pin 为 `never`，自动拒绝且不产生 UI/answerer 收不到**（`dsh-subagent` delegation-scope + `dsh-experimental-auto-review` + `dsh-user-approval` README 证据）→ B 只适合「权限内可完成」的线程，或 spawn 时给更宽固定权限 |
| 独立上下文 | ✅ 完整 Session | ✅ 完整子 Session（同样 event-sourced、持久化） |
| 浏览器里打开/对话 | ✅ 普通会话：`uiWorkspace.openSession(sessionId)` 或会话列表 | ✅ addressed-subagent 地址（**裸 sessionId 会以 `session/agent-busy` 被拒**）；child composer 有 Send/Stop（Send 走 `subagents/prompt`，要求父会话 live；Stop 走 `subagents/interruptByParent`，父离线也可） |
| steer/stop | ✅ `sessionController.prompt({sessionId, mode:'queue'\|'steer', content})` / `sessionController.cancel({sessionId})`（Host 服务方法，插件可直接调用；M0 验证注入与并发） | ✅ `subagents.prompt`（需父 live）/ `subagents.interruptByParent`（父离线可用）；**不要**用 `session.prompt/cancel` 对子会话操作（ownership 拒绝） |
| 完成通知协调者 | ⚠️ 需 project watcher 监听 `session/event` 的 `turn/end`（或 `agent/status`），把线程汇报以 prompt 注入协调者会话；**并发与去重需设计**（1–2 天，低风险） | ⚠️ `delivery:'parent'` 的通知只是 **best-effort**：`notifySettlement` 在父 Agent 非 live 时静默丢弃，无 durable/重试；**汇报的唯一可靠来源是 projects domain 台账**（project_report 写 domain，协调者下次 turn 拉取），通知仅作提示 |
| 冷恢复 | ✅ 会话恢复机制现成（prompt 会 resume 冷会话） | ✅ `sendMessage` 可冷恢复（需 persistence+sessionQuery） |
| 线程↔协调者关系 | 平级、无父子依赖；协调者会话关闭也不影响线程被打开/继续 | 父子；父会话离线时浏览器 Send 锁定（可用 `interruptByParent` 停止） |
| 侧栏可见性 | 会出现在 Workspace 会话列表；可把项目主目录注册为 Workspace，让线程自然地按项目分组显示（与 Claude 在项目上下文中可见一致）；`workspaceRegistry` 无 hide API、归档会阻塞新 step，但不影响本方案 | 默认隐藏（`origin:'subagent'`，侧栏不显示），由项目页自己列 |
| 与 Claude 语义距离 | **最近**（线程=完整独立会话） | 中（线程=协调者的持续子会话，仍是完整 Session） |
| 实现风险 | **中**（API 已确认；缺口是 watcher、审批可见性、从插件注入服务，M0 1–2 天可验证） | **低–中**（四原语现成；但受父子生命周期、谱系 UI、父离线限制） |
| 推荐 | ✅ **主选（MVP 默认）** | 备选：M0 若 A 的 watcher/审批路由受阻则切 B |

#### 推荐：方案 A（顶层 Session）为主，B 作为备选/加速路径

理由：
- `ctx.sessionController` 已确认提供 `create({workspaceId?, cwd?, sessionId?, agentPreset?})`、`prompt({requestId, sessionId, mode, content})`、`cancel({sessionId})`、`selectModel`、`rename` 等方法，Host 插件有现成落点；**剩下要自写的只有「从项目工具里调用」和「完成 watcher」两件事**（M0 验证注入与并发）。
- 线程是完整独立会话，与 Claude 语义一致：线程不依赖协调者生命周期，协调者会话关闭也不影响用户打开/继续线程；用户可以从普通会话入口打开线程，不需要「addressed-subagent」这一层。
- 不需要接管或依赖 subagents 的父子/激活语义，不会出现「父会话离线 → 浏览器 Send 锁定」「线程藏在父子谱系里」的问题；也不会与 Team/legacy subagent 工具语义纠缠。
- 侧栏可见性反而是优点：把项目主目录注册为 Workspace，线程会像普通会话一样出现在该项目分组下（Claude 的线程同样在项目上下文里可见），项目页再提供项目维度的线程视图与 Overview。
- B 的优势是 inbox/steer 与冷恢复现成、实现更快；但**审批不可用（子会话审批 pin 为 never）**、完成通知仅 best-effort，只适合做 M0 的**对照实现**或 A 遇阻时的回退。

> **线程归属语义（重要）**：无论 A/B，线程的**归属都在项目域**（`threads[]` 是 project 的成员，`ThreadRecord.projectId` 固定、不可跨项目移动）；A 下线程是普通顶层 Session，可**独立于协调者**被打开/继续；B 下线程的运行时挂在协调者会话下（`parentSession`），但产品语义上仍归属项目。Claude 的规则是「A thread belongs to the one project that started it」，本方案在 A 下完全一致；B 下需在 §6 差异表额外标注「运行时父子依赖」。

**M0 必须验证的 A 方案细节**：
① 从协调者工具/Host 插件注入 `ctx.sessionController`，`create` + `prompt` 出一个独立 cwd + `projects-thread` preset 的线程会话，简报注入正确；
② 线程在后台跑的同时协调者会话可交互（并发 agent 行为、子会话/线程之间不串台）；
③ 后台线程的权限提示可见/可批准（A 用顶层会话原生审批 UI + `pendingInteraction` 聚合；B 不可用——子会话审批被 pin 为 never）；
④ 线程 `turn/end` → watcher 把汇报注入协调者（prompt 方式）的体验、去重与防打扰；
⑤ 线程会话被打开/steer/stop（`sessionController.prompt/cancel`）且历史连续、可冷恢复；
⑥ 记录 B 方案对照（若 A 的成本显著更高，M0 结束切 B）。

#### 线程生命周期状态机

```
                 project_spawn_thread
                        │
                        ▼
                 [provisioning] ──失败──▶ [failed]（可重试/重开）
                        │ 激活成功
                        ▼
                   [active] ◀──────────── reopen（清 resolvedAt，允许 send）
                    │  │  │
      turn 运行中 ──┘  │  └── 等待输入/审批（client 侧 pendingInteraction）
                        │
             done（idle，可继续 send）── 手动 resolve / 自动 7 天 ──▶ [resolved]
                        │
                        └── resolve_thread(reason) ──▶ [resolved]
```

- **持久状态只存意图**（provisioning/active/resolved/failed）；`running / waiting / idle / needs-review` 由 Client 用 **live session 状态 + `pendingInteraction` + deliverables** 叠加推导（与 Team UI 同构）。这样避免双写运行时状态。
- **resolve ≠ delete**：线程会话保留，可 reopen 继续；分支/worktree/交付物保留。
- **stop**：`sessionController.cancel({sessionId})`（停当前 turn，保留待处理队列与后续消息能力）。
- **失败**：create/prompt 失败或 `turn/end` reason=`error` → 记录 `failed` + 错误摘要（从 session 事件实时取，不重复存全文），Overview 归入 Waiting on you。

#### 线程创建时注入的「项目简报」（作为首条 durable user message）

```
# 项目：<title>（goal）
## 项目指令（≤16k）
<instructions>
## 项目记忆索引（MEMORY.md）
<index 摘要 + 提示：正文用 project_brief/project_memory_read 按需读>
## 项目资料库（Library）
<文件清单：name / 类型 / 大小 / 相对路径；提示 project_library_list/read 或 materialize>
## 仓库与工作目录
<project.dir / repoDirs / worktree 路径与分支>
## 你的任务
<title + brief>
## 汇报要求
完成后用 project_report 汇报：做了什么 / 交付物路径 / 需要我确认或介入的事项。
```

**缓存友好**：简报只在线程创建时注入一次（durable 消息），运行中不重复；需要时由工具按需读取。协调者侧不注入线程全文，只保留台账摘要（`list_threads` 结果按需拉取）。

### 3.5 Coordinator 机制

**形态**：一个普通 Session（`coordinatorSessionId`），用 `projects-coordinator` preset 创建；preset 固定 persona + 工具白名单 + 路由策略段。**不是**新 agent 类型，不需要新运行器。

**职责（写进系统提示的固定策略段）**
1. 判断每条用户消息：就地回答 / 新开线程 / 交给已有线程 / 先给 `propose_threads` 建议；
2. 开线程必须调用 `project_spawn_thread`（标题 + 任务简报），并在回复中说明分发结果；
3. 不替线程做执行；不替线程批准权限；用户要干预线程时，引导其打开线程或调用 `project_send_thread`；
4. 用户说「记住/忘掉」→ 调 `project_remember/forget` 写项目记忆；用户纠正过的偏好也应记住；
5. 定期/被要求时用 `project_list_threads` 汇总；需要时用 `project_get_thread` 读取单个线程的最新状态/汇报/交付物（Claude troubleshooting 里「逐个线程列出做了什么、假设了什么、在等什么」的同款用法）；线程完成后读其 report 并决定下一步；
6. 项目级规则优先走 instructions（用户可见可改），临时偏好走 memory；
7. 当判断某线程的「最后一步」已完成（如交付物已入库、任务目标达成），可主动调 `project_resolve_thread`；用户也可手动 resolve。这是 Claude「Claude once you've taken the last step」对应的本地规则（写进协调者策略，不硬编码）。【设计】

**能力边界（已证实部分 + 设计部分）**
- 【已证实】协调者**不逐步跟踪线程执行**：官方说它 "sees what threads report back, not every step they take"；
- 【已证实】协调者本身无 connectors、不能替线程批准权限；用户必须在线程内 steer/批准（R1 §3）；
- 【设计】协调者不做重执行：需要跑代码/长任务/改文件的活一律派线程（这是对「权力越小越可预期」取向的采用，不是官方强制）；
- 【设计】协调者不常驻加载全部线程 transcript，只按需 `list_threads` / `get_thread` / report。

**模型 / effort**：`project.modelSettings` 存两套；M1 先落 preset/部署默认 + 线程 spawn 时按项目设置传 `agentOptions`；M3 设置页可改。协调者模型沿用 session model selection（`dsh-client-ui-model-selection` + `modelSelection` 投影）。

**可选增强（M3/M4）**
- `propose_threads`：返回建议列表（UI 渲染「Suggested threads」卡片，一键全开）；
- `goal` 集成：项目目标可作为 coordinator 的 long-running goal（`goal-round-driver`）；
- `plan-mode`：复杂项目先 plan 后 spawn；
- 定时：`dsh-schedule` 触发项目线程（M4）。

### 3.6 Library 机制

**目标语义**（对齐 Claude）：项目级、只读给线程、用户上传与线程产出都进库、上传是拷贝、支持同名 Replace、有配额。

**服务接口（Host `ctx.projectLibrary`，由 `dsh-project` 或独立包提供）**
- `addUpload(projectId, receiptId | stream, name, {replace?})`：从 file-upload receipt 或流复制字节到 `projects/<id>/library/objects/<digest>`，写 entry；同名冲突返回 `needsReplace`；
- `addProduced(projectId, sourcePaths[], sourceThreadId, title?)`：Host 校验路径在工作区内（或 threads 暂存区），复制快照入库；
- `list(projectId, query?)` / `read(projectId, name, offset?, limit?)` / `remove(projectId, entryId)` / `replace(...)`；
- `materialize(projectId, entryId, threadWorkspace)`：把库文件**一次性快照**拷到线程 workspace 的 `.project-library/`（副本可被模型修改，属于「只读语义的一次性副本」，不是实时只读挂载）；主要用于二进制/大文件需要 `read_image` 或工具链直接访问的场景；
- **沙箱与写入**：fs-sandbox 只 fence 写入、不限制读，所以「线程读不到 Library」不成立——线程可以通过 Host 工具的绝对路径/`read` 读；但 Host 侧用 `ctx.fs` 写 `~/.dsh/projects/**` 可能被 agentless 默认策略拒（`FS_SANDBOX_DENIED`），M0 需验证用 `node:fs` 或显式宽 policy 落盘；
- 配额校验（默认对齐 Claude）：单文件 480MB、单次 100 文件/2GB、文件夹只拷前 100 文件/≤200MB（排除 >30MB、隐藏文件、node_modules）、≤10 个文件夹（含 Google Drive 文件夹；单个文件不计入）；可配置。文件夹在 domain 里记 `libraryFolders`（名字 + entryIds），上传时由 Client 展开目录、Host 复制文件并登记分组；Google Drive 同属「远程文件夹」形态（M4 接入，MVP 只做本地文件夹）。

**上传链路**（两条，按是否要求 live coordinator 选择）：
1. **Library 自有 raw 上传路由（首选，Desktop/Electron 也可用）**：用 `ctx.connection.fetch.register` 注册认证的字节上传路由（官方先例：`dsh-client-file-upload` 的 raw-byte upload route 就注册在 Connection fetch registry 上），Body 直接交给 `projectLibrary.addUpload(stream, name)`；不依赖任何 Agent/session 在线。
2. **复用 `ctx.fileUpload.upload(coordinatorSessionId, ...)`**：在项目工作台（协调者会话 live）时可用，Host 收到 receipt 后 `projectLibrary.addUpload(receipt)`；项目页在协调者冷启动时会失败，需先打开协调者会话。

两条路都：复制/索引 → `domain/changed` → Overview/Library tab 刷新；**不把 receipt 直接交给 prompt**，避免 session 级生命周期问题。

**注入方式**：
1. 线程创建简报里给 **库索引**（名字/类型/大小/路径），正文按需 `project_library_read`；
2. 大文件/二进制：`materialize` 到线程 workspace 后用 fs/`read_image` 读；
3. 库里的「规范/手册」可同时导出为项目 skills（`<project>/.dsh/skills`，M3）——索引常驻、正文按需，零额外 token。

**产出物回收（自动 + 显式）**：
- **自动**：project watcher 在线程 `turn/end` 时读取该会话的 `present` 交付物声明（`deliverables/presented` 事件）与工作区变更，按配置默认自动复制进 Library（`kind:'produced'`，记来源线程）；避免依赖模型第二次调用。
- **显式**：线程也可调 `project_library_add` 指定额外路径/命名；协调者在 `project_get_thread`/台账里看到交付物路径；Overview 的 Library tab 显示来源（user/thread/auto）。

### 3.7 Overview 与注意力路由

**数据来源**（Client 侧组合，不新造运行时状态）：
- `projects` Remote：项目记录、线程台账（持久状态/标题/时间/resolve）；
- `useSessions` + `SessionSnapshot`/`sessionListMetadata`/`pendingInteraction` 投影：线程 live 状态（running/idle/等待审批/等待回答）、未读完成；
- 线程会话 `present` 交付物 + worktree 变更：待审/有交付；
- `tokenUsage` projection / `token-meter`（token 用量；**`session-stats` 只是 turn/step 计数，不是 token 用量**）：每线程与项目合计。

**Threads 分组（DSH 映射）**

| Claude 分组 | DSH 判定 | 备注 |
|---|---|---|
| Working | 线程 live session running | 文案「进行中」 |
| Waiting on you | `pendingInteraction`（approval/plan/question）∨ `failed` ∨ 线程 report 里带 `needs` | 最高优先级，Overview 按钮/项目卡显示圆点 |
| Ready for review | 线程 idle 且有交付物（present/worktree 变更） | M3；DSH 用「交付物/变更待收」替代 PR；**这是 DSH 特有映射，不等同 Claude 的 PR 待 review**（见 §6） |
| Idle / Done | 线程 idle 且无待办、未 resolve | 可手动 resolve |
| Resolved | domain `state=resolved` | 可 reopen |
| Landing | —（无 PR 合并语义） | 非目标；M4 可用「已合并/已应用」人工状态代替 |

**注意力路由**：项目卡/Overview tab 标题显示圆点；线程行显示状态点；桌面通知（Electron）M4 可选。**「项目对话里的 go-ahead 到不了线程」这一点照抄**：批准必须在打开的线程会话里完成（DSH 审批 UI 本来就绑定 session）。

### 3.8 UI 结构与交互流

**页面/入口**
1. **Projects 一级页面**（`main` key `projects` + `sidebar.panellist` 图标）：项目卡列表（名称/目标/活跃线程数/等待你数/最近活动）、New project、从会话创建（M4）。
2. **项目工作台**：打开项目 = 打开协调者会话（主区 conversation）+ 右侧栏自动开 `project-overview` tab；右侧栏 tabs：**Overview / Library / (Settings)**。
3. **线程**：项目工作台 Overview 行或协调者消息里的线程卡 → 打开线程会话（address within main conversation）；线程 header 显示项目面包屑 + 状态 + Resolve 按钮（slots：`conversation.header.leading` / `conversation.session.header.actions`）。
4. **项目设置**：对话框（M1 用页面内 tab 或 `shell.overlay` 弹层）：名称/目标/指令（≤16k 字符计数）/目录/模型/自动 resolve 天数/配额（M3）。

**关键交互流**
- **新建项目**：填名称(+目标+目录+指令) → `project.create` → Host 建 domain 记录 + 建协调者会话（preset `projects-coordinator`）→ UI 打开协调者会话 + Overview。
- **派任务**：在协调者对话里输入 → 协调者决定就地答或 `project_spawn_thread` → 返回线程卡/文案 → Overview 新增行（provisioning→working）。
- **等审批**：线程会话里批准（原有审批 UI）；Overview 归入 Waiting on you；协调者被要求汇总时读台账。
- **看线程**：Overview 行 → 打开线程会话 → 在线程 composer 继续聊 / Stop。
- **收尾**：线程卡/行菜单 Resolve（或自动 7 天）→ Resolved 组，可 Reopen。
- **资料**：Library tab 上传/预览/重命名/替换/删除；线程创建时自动带索引。
- **项目治理**：设置页 Pause/Archive/Delete；暂停时协调者仍可读，线程停止接新活。

**实现落点**（全部有现成 seat，R2 §3、R3 §1）：
- `main` keyed slot + `sidebar.panellist`；右侧栏 tab type（`ctx.sidebarRightTabs.register` + `sidebar.right.pane.tab`）；文件预览复用 `ui-sidebar-documentpreview` / `ui-sidebar-files` 模式；
- 会话行「Move to project」：`sidebar.workspaces.session.menu.item`；
- 线程内项目上下文：`conversation.header.leading` 或 `conversation.session.header.utilities`；
- 消息内线程卡（M3）：`conversation.chat.*` 的 tool-call/turnTail 扩展（先降级为 Overview 行 + 协调者文本，M3 再美化）。

### 3.9 权限、沙箱与安全

- **权限基线**：线程默认继承**部署的 permission mode / sandbox policy**（本机 `workspace-write`），不继承协调者运行时被临时授予的特权；需要放宽时必须显式配置项目策略并经用户批准。【设计；Claude 的线程是 auto mode + 线程内批准，机制不同，见 §6】
- **审批归属**：A 方案下审批 prompt 绑定线程这个顶层 Session，用户在线程会话内批准（原生 UI），或从项目页打开线程批准；Overview 用 `pendingInteraction` 聚合 Waiting on you。**B 方案不可用**：in-process 子会话审批被 pin 为 `never` 自动拒绝（见 §3.4），所以 B 只能跑权限内任务、或 spawn 时给更宽固定权限，不能承诺「线程内批准」。
- **默认权限模式**：沿用部署 `DSH_PERMISSION_MODE`（本机 `workspace-write`），不因项目放宽；项目 instructions 要求「缺权限时停下来报告，不要绕过」。
- **线程写隔离**：MVP 所有线程共享 `project.dir`，用「写入范围/文件所有权」约定 + 协调者串行化高风险任务；M4 用 git worktree 给每线程独立 checkout（branch 保留 = Claude 的 branch/PR 替代）。
- **Library 只读**：线程不能直接改库；入库必须经 `project_library_add`（Host 复制快照，可审计来源线程）。
- **删除语义**：项目删除只删 domain 记录 + `~/.dsh/projects/<id>/`（库/记忆）；会话按 DSH 语义归档而非删除；git 分支/worktree 保留并提示用户。
- **分享**：单用户（与 Claude beta 一致）；远程访问沿用 DSH 的 `remoteAccess` 策略，不做项目级 ACL（M4 可选）。

### 3.10 模型、effort、用量与限额

- 项目设置两套模型/effort（协调者 / 线程），默认继承部署；线程 spawn 时通过 `agentOptions`/preset 生效（M1 先固定部署默认，M3 可改）。
- 用量：每线程从 `tokenUsage` projection / `token-meter` 聚合入 ThreadRecord.usage（M3），Overview 显示按线程/模型的 token 与项目合计；协调者自身用量单列。**注意 `session-stats` 是 turn/step 计数，不是 token 用量**。
- **线程内嵌套委派**：DSH `subagent.maxDepth` 默认 1（子会话不能再派子代理）；若要「线程内仍可再用 subagents」（Claude 线程可以），需显式调高 `maxDepth` 并接受 `maxActiveSubagents`（默认 8、全树共享）与成本上升。MVP 默认不允许嵌套，写进线程简报与 §6 差异表。
- 限额（config；注意 Claude 的 200/天是唯一硬上限、并发数无固定上限，以下为 DSH 本地默认，**不是 Claude 等价物**）：
  - `maxActiveThreads` 默认 4（DSH 本地软上限，Claude 无固定并发上限）；
  - `maxThreadsPerDay` 默认 200（对齐 Claude 的唯一硬上限，可配置）；
  - `maxThreadMessages/Day` 无；
  - Library 配额见 §3.6；
  - `instructionsMaxChars` 默认 16000；
  - `autoResolveDays` 默认 7。
- 超限行为：线程 spawn 返回结构化错误 + Overview 提示；**不做**自动重试等待（DSH 无云端 quota 重试语义）。

### 3.11 生命周期与级联语义

| 动作 | 行为 | 级联 |
|---|---|---|
| **Pause** | `status=paused`；拒绝新 spawn/send；运行中线程 `interrupt`；协调者会话仍可读（工具拒绝执行）；项目定时任务不触发（M4 接入后） | UI 横幅 Resume；已排队消息保留。**注意**：Claude 的 Pause 会「项目不收消息」，本方案保留只读是为了本地排障，属设计差异（见 §6） |
| **Resume** | `status=active`；恢复接受消息 | 不自动重启被中断的 turn（用户或协调者再发消息） |
| **Archive** | `status=archived`；项目从 Projects 列表隐藏；归档协调者会话并设 `stopActivity: true`——由 subagent family 的 parent-cause 停止其后代、`ArchivedSessionGate` 按 lineage 拒绝新 step；期间定时任务不跑 | 可 Unarchive；**无需逐线程归档**（逐线程 archive 子会话的语义不确定，且不是 Workspace 成员）。对齐 Claude「归档项目=归档其线程」 |
| **Delete** | 永久删除 domain 记录 + `~/.dsh/projects/<id>/`；关闭项目定时任务；会话归档不物理删除；git 分支/worktree 保留 | 二次确认；不可撤销 |
| **Resolve（手动/协调者判断/自动）** | ① 用户手动 resolve；② 协调者判断最后一步完成后 resolve（§3.5 策略）；③ 启动时/定时扫描：`active` 且 `lastActivityAt < now - autoResolveDays` → `resolved`（`resolvedBy: auto`） | 可 reopen；不删任何东西 |
| **Host 重启** | 从 domain 恢复项目/线程台账；线程会话可被消息冷恢复 | 重启时正在运行的 turn 会中断（单进程限制） |

---

## 4. 实施设计（包、API、工具、UI 落点）

### 4.1 包拆分

> 外部插件开发建议用**少量包 + 子路径导出**降低安装与版本管理成本（DSH 已支持 `pkg/subpath` 作为独立 Loader 行，如 `dsh-tool-subagent-control/list-agents`）。以下为 5 个包（含 bundle）。

| # | 包 | 侧 | 职责 | 复用 |
|---|---|---|---|---|
| 1 | `dsh-project` | Host | `projects` domain + `ctx.projects`（CRUD/线程台账/状态聚合/限额/自动 Resolve/暂停归档删除）+ 线程运行适配器（subpath `./thread-runtime`、`./watcher`） | storage-domain/json、sessionController、session events |
| 2 | `dsh-project-memory` | Host | **自研项目记忆骨架**：`MEMORY.md` 索引 + 每事实文件 + 四类型 + git-repo scope + systemPrompt 注入 + 索引治理 + `memory_*` 工具（MVP 无向量检索） | `dsh-atomic-write`、system-prompt、tools |
| 3 | `dsh-project-library`（可并入 1 的 subpath） | Host | 项目级 Library 服务：上传入库、复制、内容寻址、文件夹、产出回收、materialize、配额 | attachments、fileUploads、fs |
| 4 | `dsh-tool-project` | Host | 模型工具（scoped 注册）：协调者工具 + 线程工具（§4.4） | tools、dsh-project、dsh-project-memory |
| 5 | `dsh-project-context`（可并入 4） | Host | 按 session→project 映射注入系统提示（项目 persona/记忆索引/库索引；线程简报兜底） | system-prompt、session |
| 6 | `dsh-client-ui-project` | Client | Projects 页面/项目卡/设置/新建/线程列表/**Threads tab**/Library tab/线程 header/会话行菜单；含 locale 与图标 | ui-layout、ui-sidebar、ui-conversation、ui-sidebar-right、ui-session、ui-workspace、api-* |
| 7 | `dsh-project-memory-retrieval`（M2+，opt-in） | Host | 可选语义检索 adapter：Markdown 源真相 + 可重建影子索引 + 混合检索/三层渐进披露；实现 `MemoryStore` 接口 | memory store、memsearch 路线依赖 |
| — | `dsh-project-profile` | Bundle | 只含 patch + 依赖 + presets（`projects-coordinator`、`projects-thread`）+ icon/README | 上面 7 个 |

**为什么不是更多包**：Host 服务/工具/Library 彼此强耦合，拆太细会带来跨包 service 注入与版本对齐成本；先用 3 个 Host 包（1 核心、1 工具、1 会话命令）即可。若团队更大，再把 Library 独立。

> **命名与导出约定**：以上为示意名；**外部插件不要占用 `@deepseek-ai` 官方 scope**，实际发布用自有 scope（如 `@acme/dsh-project`）。**同一个包的多行必须在 `exports` 里声明不同子路径**（如 `./core`、`./library`、`./context`，仓库内先例 `dsh-tool-subagent-control/list-agents`）；否则 patch 里三行同名会重复实例化同一个 `apply`，造成 duplicate service/projection。也可以拆成独立包规避。

### 4.2 组成 patch 草案

```yaml
# dsh-project-profile/cordis.patch.yml（示意；实际需按 0.2.1-rc.2 行 id 校准）
# 注意：以下用自有 scope 示意；同包多行必须走不同 exports 子路径
- insert:
    - id: project
      name: '@acme/dsh-project/core'
      config:
        autoResolveDays: 7
        maxActiveThreads: 4
        maxThreadsPerDay: 200

    - id: project-library
      name: '@acme/dsh-project/library'
      config:
        maxFileBytes: 503316480        # 480MB
        maxBatchFiles: 100
        maxBatchBytes: 2147483648      # 2GB
        maxFolders: 10

    - id: project-memory
      name: '@acme/dsh-project-memory'
      config:
        maxIndexBytes: 4096            # MEMORY.md 注入预算
        maxIndexLines: 200
        enableUserScope: true
        # retrieval: disabled（M2+ 可选 adapter）

    - id: tool-project
      name: '@acme/dsh-tool-project'
      config:
        coordinatorPreset: projects-coordinator
        threadPreset: projects-thread
        maxBriefChars: 16000

    - id: project-context
      name: '@acme/dsh-project/context'

    - id: ui-project
      name: '@acme/dsh-client-ui-project'

# preset 声明（示意）
- insert:
    - id: preset-projects-coordinator
      name: '@deepseek-ai/dsh-agent-preset'
      config:
        id: projects-coordinator
        name: 'Projects 协调者'
        description: '项目对话：路由任务、维护线程台账与项目记忆，不做重执行'
        plugins: [...]
    - id: preset-projects-thread
      name: '@deepseek-ai/dsh-agent-preset'
      config:
        id: projects-thread
        name: 'Projects 线程'
        description: '项目任务执行线程：在自己的会话与工作目录里完成一项任务并汇报'
        plugins: [...]
```

> Preset 的 `plugins` 子列表需要实测可用的行（`dsh-base` 的 preset 定义可作模板）。原则：**协调者不挂 bash/write/edit 等重执行工具**（或只给只读 fs），线程挂执行工具 + 项目工具只读面。

### 4.3 Host 服务 API 草案（`ctx.projects`）

```ts
// 项目
list(filter?): ProjectView[]
get(projectId): ProjectView
create(input: { title, goal?, dir?, instructions?, presetIds?, modelSettings? }): ProjectView
update(projectId, patch): ProjectView
pause(projectId) / resume(projectId) / archive(projectId) / unarchive(projectId)
delete(projectId, { confirmation }): void
// 线程
spawnThread(projectId, { title, brief, model?, worktree? }): ThreadView
listThreads(projectId, filter?): ThreadView[]
getThread(projectId, threadId): ThreadView
sendToThread(projectId, threadId, message): { accepted: true }
stopThread(projectId, threadId): void
resolveThread(projectId, threadId, reason?): ThreadView
reopenThread(projectId, threadId): ThreadView
recordReport(projectId, threadId, { summary, needs? }): void
// 记忆
readMemory(projectId, name?): { index, files[] }
writeMemory(projectId, name, content, { by }): MemoryFile
deleteMemory(projectId, name): void
// 库
listLibrary(projectId, query?)
addLibraryUpload(projectId, receiptId | { bytes, name }, opts?)
addLibraryProduced(projectId, { paths, threadId, title? })
readLibrary(projectId, nameOrId, opts?)
materializeLibrary(projectId, entryId, targetDir)
removeLibraryEntry(projectId, entryId)
// 观测
subscribe(listener) / watchThread(threadId) // 或复用 domain/changed + session events
```

**一致性策略**：domain 写先 durable，再更新内存与发通知；线程状态变更以「session/agent 事件 → domain 更新」单向驱动；UI 只信任「domain 事实 + session live overlay」。

**线程运行适配器的关键实现**（M0 定稿，两方案择一）：
- **A（顶层 Session，推荐）**：`ctx.sessionController.create({cwd, agentPreset:'projects-thread', sessionId: preallocated})` → `ctx.sessionController.prompt({requestId, sessionId, mode:'queue', content:[{type:'text',text:brief}]})`；steer/stop 用 `prompt(mode:'steer')`/`cancel`；watcher 订阅 `session/event` 的 `turn/end`（辅以 `agent/status`），读该线程的 `project_report`/`present` 事件后按策略把汇报 `prompt` 回协调者；失败/完成状态写 domain。
- **B（子会话，备选）**：`ctx.subagents.startActivation({provider:'spawn', label, request:{parent: liveCoordinatorAgent, prompt: ContentBlock[], agentPreset:'projects-thread', agentOptions, cwd?}, signal, delivery:'parent'})`；steer/stop 用 `subagents.prompt`/`subagents.interruptByParent`；**审批不可用**、完成通知 best-effort，台账与汇报一律以 domain 为准。

### 4.4 模型工具草案

**协调者（scoped 到 coordinator preset）**

| 工具 | 参数 | 返回 | 说明 |
|---|---|---|---|
| `project_brief` | `{}` | 项目目标/指令/记忆索引/线程列表摘要/库摘要 | 每次新 turn 可按需拉取；不常驻注入 |
| `project_spawn_thread` | `title`, `brief`, `model?`, `worktree?` | `threadId`, `title`, `state` | 创建线程 + 简报；立即返回（后台跑） |
| `project_list_threads` | `status?` | 行：id/title/state/liveStatus/lastActivity/hasDeliverables/needs | 台账 |
| `project_get_thread` | `threadId` | 状态 + 最近 report + 交付物 + 最近 turn 摘要 | 按需读单个线程（不加载全文） |
| `project_send_thread` | `threadId`, `message` | `{accepted}` | steer/继续 |
| `project_stop_thread` | `threadId` | — | 停当前 turn |
| `project_resolve_thread` | `threadId`, `reason?` | ThreadView | 收尾（可 reopen） |
| `project_reopen_thread` | `threadId` | ThreadView | 重开 |
| `project_propose_threads` | `proposals:[{title,brief}]` | — | M3；UI 渲染建议卡 |
| `project_remember` / `project_forget` | `name`, `content` / `name` | MemoryFile | 项目记忆 |
| `project_library_list` / `project_library_add` | `query?` / `paths[]`, `title?` | 清单 / entry | 库 |
| `project_report` | `summary`, `needs?`, `deliverables?` | — | 线程→协调者汇报（同时可写台账） |

**线程（scoped 到 thread preset）**：`project_brief`、`project_report`、`project_remember`、`project_library_list`、`project_library_add`、`project_library_materialize`（只读/受限面）。

**命名冲突**：不要用 `send_message`、`interrupt_agent`、`list_agents`、`spawn_teammate` 等 Team/legacy 同名工具（Team bundle 会让模型看到两套同名工具，行为不可预期）。统一 `project_*` 前缀。【R3 §4.1、R2 U7】

**工具结果呈递**：`project_spawn_thread` 的返回在 Chat 里先按普通工具结果展示；M3 注册自定义 tool view 渲染成「线程卡」（标题+状态+打开），对齐 Claude 消息下的线程卡片。

### 4.5 Remote / Typert 路径

**目标**：Client 需要 `project` 命名空间做项目/线程/库/设置的读取与变更 + 可选 `follow` 流。

**三条实现路径（按风险从低到高）**
1. **手写 Typert contribution**（推荐先 spike）：`createTypertRemoteInfo(spec, z)`（`@deepseek-ai/dsh-typert-protocol/remote-info`，已发布纯函数）+ Host `ctx.typert.register(contribution)` + Client `ctx.remote.$mount()`。外部包没有生成链，但 README 明确允许非生成 owner 注册。【R2 §7.1、R6；**推断，需 spike**】
2. **Connection fetch 原始路由**（保底，Desktop/Electron 可用）：`ctx.connection.fetch.register(route)` 注册认证的 `/api/project/**`（官方先例：file-upload 的 raw route 就在 Connection fetch registry 上），Client 用 `fetch`；自行做 schema 校验与方法级鉴权。`ctx.webServer.register` 只用于「浏览器加载页面」场景，不能当作 Desktop 逃生口。【dsh-explorer 评审】
3. **仓库内构建链路**（若团队能改 DSH 源码）：在 `packages/` 内实现并走 typert 生成器；不适用于纯插件交付。

**M0 验收**：一个 unary 方法（`project.list`）与一个流（`project.follow`）端到端跑通（浏览器 + Desktop 都验证）；否则切路径 2。

### 4.6 Client 扩展点落点表

| 需求 | Slot / API | 参考实现 |
|---|---|---|
| Projects 一级页面 | `main` keyed slot key=`projects` + `sidebar.panellist` entry（id/label/icon/order）+ `ctx.layout.selectPanel` | `dsh-client-ui-plugin-manager`（Plugins 页） |
| 项目设置/新建项目对话框 | `shell.overlay`（全屏浮层）或页面内 modal | `ui-workspace` 的 rename/delete 对话框、plugin-manager |
| 打开协调者会话 | `ctx.uiWorkspace.openSession(sessionId)` 或 `ctx.remote.session` + 导航 | `ui-workspace` |
| Overview tab | `ctx.sidebarRightTabs.register({id,kind:'project-overview',title,patterns?})` + `sidebar.right.pane.tab` + `ctx.sidebarRight.openTab('project-overview')` | `ui-sidebar-files`（文件树 tab） |
| Library tab | 同上 `kind:'project-library'`；上传用 `ctx.fileUpload.upload`；预览复用 document preview tab | `ui-sidebar-files`、`ui-sidebar-documentpreview` |
| 线程行状态/打开 | 项目页内自绘列表；打开用 `uiWorkspace.openSession(sessionId)`（A 主选）或 addressed 地址（B 备选） | `ui-workspace` 的会话打开；B 参考 `experimental-client-ui-agent-team` |
| 线程 header 项目面包屑/Resolve | `conversation.header.leading` / `conversation.session.header.actions` | `ui-conversation`、Team UI 的 header 按钮 |
| 会话行「Move to project」 | `sidebar.workspaces.session.menu.item`（entry 收 `{sessionId, displayTitle}`） | `ui-workspace` 的插件示例 |
| 线程卡（M3） | `conversation.chat.*` tool view / turnTail | `ui-deliverables` 的 turnTail 卡 |
| 状态点/等待你 | 项目卡 & tab 标题 badge；数据来自 pendingInteraction 投影 | `ui-workspace` 行状态点 |

**约束**：不 fork `ui-workspace`/`ui-conversation`；所有注册用 `ctx.slots.inject()` 做声明感知注册；文案走 locale（本机 preferred `zh`）；样式用主题 token；图标需自备（安装包的 display checklist 要求原创/已授权图标）。

### 4.7 一次「派活」的数据流（端到端）

```
用户在项目工作台输入「把 docs/api.md 的接口补全，并跑测试」
  → 协调者 session 收到 user/message
  → 模型调 project_spawn_thread({title, brief})
     → ctx.projects.spawnThread：校验配额/暂停状态
     → 写 domain（thread = provisioning，threadId = 预分配的 sessionId）+ flush
     → ctx.sessionController.create({cwd: 线程工作目录, agentPreset: 'projects-thread', sessionId})
     → ctx.sessionController.prompt({sessionId, mode:'queue', content: 项目简报+任务})
     → domain 更新 active；写台账；发 domain/changed
  → 协调者回复「已开线程 #3：补全 API 文档」
客户端：
  → project.follow/domain 变更 → Overview 刷新（Working）
  → 线程会话自己跑 turn；turn/end 由 project watcher 捕获
  → watcher 把「线程汇报摘要/needs/交付物」prompt 回协调者会话（去重、防打扰），
    协调者可按需汇总；Overview 显示 idle/needs
  → 用户点线程行 → 打开普通线程会话（openSession）→ 看 transcript / 继续聊 / Stop
线程结束时：
  → project_report(summary, deliverables) 或 watcher 自动摘要 → 台账 + 协调者会话
  → 用户 Resolve → state=resolved（可 reopen）
```

---

## 5. 分阶段落地计划

> 估算按 1–2 名熟悉 DSH/Cordis 的工程师；含测试与文档；不含 UI 视觉打磨。

### M0 · 可行性 spike（3–5 天）

**目标**：用最小 bundle 验证 11 个关键假设，定稿线程载体与记忆骨架。

| # | 验证项 | 通过标准 |
|---|---|---|
| 1 | 顶层 Session 作线程：`sessionController.create({cwd, agentPreset, sessionId})` + `prompt(简报)` | 线程会话独立跑、preset/cwd 正确、简报注入正确 |
| 2 | 线程 idle 后再次 `prompt` 冷恢复、历史保留 | 第二次消息后上下文连续 |
| 3 | 后台线程的权限提示可被用户看到并批准（A 顶层会话原生审批） | 线程会话内能看到并批准；Overview 可感知 Waiting on you |
| 4 | 线程会话打开/steer/stop（`sessionController.prompt/cancel`） | `openSession` 能看 transcript；prompt(mode)/cancel 生效 |
| 5 | 项目 domain + 手写 Remote（或原始路由）端到端 | Client 读到列表、能创建项目 |
| 6 | watcher：线程 `turn/end` → 汇报注入协调者（去重/防打扰） | 协调者收到一次汇报，不重复、不打断正在进行的 turn |
| 7 | 备选 B：可续跑子会话作线程（正确 request 形状 + 审批限制 + 完成通知 best-effort） | 能跑；记录与 A 的成本/审批/通知对比；明确 B 不承诺线程内审批 |
| 8 | Library Host 写入 `~/.dsh/projects/**` 的沙箱策略 | 用 `node:fs` 或显式 policy 成功写入并读回；记录被拒的默认策略 |
| 9 | Desktop 下 Client↔Host 逃生口：`ctx.connection.fetch.register` 原始路由（`ctx.webServer.register` 在 Electron 的 file:// 下不可靠） | 浏览器 + Desktop 都能上传并拉列表 |
| 10 | 协调者会话归档/dispose 后，项目页仍能打开线程并继续发送；台账仍完整（通知可丢，domain 不能丢） | 线程可继续；状态从 domain + session 读取正确 |
| 11 | **Memory 自研骨架 spike**：索引注入（空=0B/4KB 预算）、每事实文件、git-repo scope、原子写/锁、超限治理 | 两次请求间记忆即时生效；同 repo 不同 worktree 共享；超限返回「重写索引」；重启不丢不重 |

**交付**：spike 报告（结论 + 证据 + 风险更新）、线程载体决策（默认 A）、Memory 骨架设计确认（ADR 0002）、可安装的 demo bundle。

### M1 · 项目容器 + Library 基础（5–8 天）

- `projects` domain（schema/版本/迁移策略）、`ctx.projects` CRUD、coordinator session 创建与关联；
- Projects 页面（列表/新建/删除/打开）、项目设置（名称/目标/指令/目录）；
- **自研项目记忆骨架**（`dsh-project-memory`）：`MEMORY.md` 索引 + 每事实文件 + 四类型 + git-repo scope + 注入（4KB 预算）+ `memory_write/read/list/delete` + 索引超限治理；协调者与线程共用；语义检索留 M2+ adapter；
- Library：上传/列表/读取/删除/Replace、索引注入、配额校验；
- 协调者 preset + 项目工具只读面（`project_brief`、`project_library_list`、`project_remember`）；
- 验收：新建项目 → 上传 3 个文件 → 在项目对话里问「这批文件讲了什么」能基于 Library 回答 → 重启后项目/文件/记忆都在；指令改动对下一轮生效。

### M2 · 线程闭环 + Overview（8–12 天）

- 线程运行层（spawn/list/steer/stop/resolve/reopen）、线程台账、live 状态聚合；
- 线程预设 + 简报注入（含记忆索引/库索引/仓库目录/汇报要求）；
- 完成/失败观测与协调者通知；`project_report`；
- 项目工作台：对话 + Overview tab（Threads 分组/状态点/打开线程）+ 线程 header 面包屑/Resolve；
- 项目级库 tab 与线程产物回收；
- 验收：项目下并行 3 个线程；能从 Overview 看状态、打开任意线程、发送 steer、Stop；线程完成后协调者能汇总；Resolve（手动/协调者判断）与 Reopen 生效；**协调者会话归档/关闭后，项目页仍能打开线程并继续发送**；重启后线程台账恢复、可冷恢复。

### M3 · 注意力、生命周期与限额（5–8 天）

- Waiting-on-you 聚合（审批/问题/失败/needs）与圆点提醒；
- Pause/Resume/Archive/Unarchive/Delete 及级联；自动 Resolve 定时器；
- 模型/effort 项目设置、线程级模型覆盖；用量统计（按线程/模型/项目）；
- 限额（并发/每日/库配额）与错误文案；`propose_threads`（建议线程）；
- 验收：暂停后线程停止接活、恢复后继续；归档从列表消失；删除二次确认后库/记忆清除、会话归档；超限有结构化提示；用量数字与 `tokenUsage` projection 一致。

### M4 · 隔离与增强（8–12 天）

- 每线程 git worktree/branch 隔离（`ctx.worktrees` 或 Host git 服务）与「线程交付物/变更」视图；
- 消息内线程卡、Suggested threads 卡片、项目级 Scheduled tasks tab（`dsh-schedule`）；
- 「Continue as project / Move to project」（从已有会话建项目）；
- Library 手册导出为项目 skills；大文件 materialize；跨线程 `@` 会话引用快捷插入；
- 桌面通知（Electron）与项目使用量导出；远程访问策略；
- 验收：两个线程在各自 worktree 并行改动互不覆盖；线程产生 diff 可在项目页查看/合并提示；从已有会话建项目成功；定时任务以线程形式出现在项目页。

### 里程碑汇总

| 里程碑 | 范围 | 估算 | 累计 | 关键验收 |
|---|---|---|---|---|
| M0 | spike + 决策 | 1–3 天 | 3 天 | 6 项假设验证 |
| M1 | 项目 + 记忆 + Library | 5–8 天 | ~2 周 | 「项目+资料库」可用 |
| M2 | 线程 + Overview | 8–12 天 | ~4 周 | 「派活→看→干预→收尾」闭环 |
| M3 | 注意力/治理/限额 | 5–8 天 | ~5–6 周 | 可长期无人值守 |
| M4 | 隔离/增强 | 8–12 天 | ~8 周 | 接近 Claude 体验 |

> **MVP（M0–M2）≈ 3–4 周**；其中 M0 结束必须重新评估是否坚持 B 方案。

---

## 6. 与 Claude 的差异 / 非目标

| 维度 | Claude Projects | 本方案 | 说明 |
|---|---|---|---|
| 执行环境 | Anthropic 云 sandbox；关笔记本仍跑 | 本机 DSH 进程；进程退出线程停止 | 单进程限制；会话持久化，消息可冷恢复 |
| 线程归属/运行时 | 线程归属项目，可独立打开/steer；协调者会话不是线程的父 | **A 方案一致**（顶层 Session，归属 project domain）；**B 方案为运行时挂在协调者下的子会话**（父会话离线时浏览器 Send 锁定） | 只有 A 完全对齐；B 作为备选需标注 |
| 交付物 | 每线程独立 branch + PR + auto-fix | 本地 diff/交付物 present；M4 可选 worktree+branch；无 PR 自动化 | DSH 无 GitHub App/PR 语义 |
| 隔离 | 云 sandbox 天然隔离 | MVP 共享项目目录；M4 worktree | 需要用户理解并发写风险 |
| Pause 语义 | 项目不收消息、线程全停 | 线程全停、拒绝新 spawn/send，但协调者会话仍可读（排障） | 设计差异，UI 需标注 |
| 权限模式 | 线程 auto mode、线程内批准、不读仓库 settings | 线程继承部署 permission mode（本机 workspace-write），审批绑定 session | 机制不同，不能承诺 Claude 式 auto mode |
| Resolved 触发 | 手动 / Claude 最后一步完成 / 一周无活动 | 手动 / 协调者判断 / 自动 N 天（默认 7） | 三个触发都实现，自动天数可配置 |
| Overview 分组 | Ready for review = PR 待 review；非代码产出进 Idle/Library | Ready for review = 交付物待收（DSH 特有映射） | 需在 UI 文案与文档中说明，避免误解为 PR |
| 线程内嵌套委派 | 线程内部仍可再用 subagents/workflows | 默认不可（`subagent.maxDepth` 默认 1）；调高后可，但 `maxActiveSubagents` 全树共享、成本上升 | 线程简报与项目设置需说明 |
| 后台线程审批 | 线程 auto mode + 线程内批准 | A：顶层会话原生审批（对齐）；B：子会话审批被 pin 为 never 自动拒绝 | 选 B 时只能跑权限内任务 |
| Library 挂载 | `/mnt/project-files` | Host 服务读取 + materialize 到 workspace | 沙箱安全 |
| 记忆实现 | `MEMORY.md` + 按需文件（云线程启动读索引） | 同构实现（本项目自建） | 对齐语义，不依赖 Claude 格式 |
| 上下文管理 | 自动 compact + recent threads + memory | Session 自动 compaction（现有）+ 简报/索引/工具按需 | 需给协调者加「不要复述长历史」的策略 |
| 多人分享 | 不支持（beta） | 不支持（单用户） | 一致 |
| 套餐/计费 | plan limits、200 线程/天 | 本地 token 统计 + 可配置限额 | 无计费语义 |
| 入口 | Web/Desktop/Mobile | DSH Web/Desktop | 不做手机端 |
| 「继续跑」 | 云端持续 | Host 存活期间；idle 可恢复 | 明确差异，UI 标注线程状态 |
| 项目管理 | Pause/Archive/Delete | 同构 + 会话归档而非删除 | 删除语义差异需在确认弹窗说明 |

**明确非目标（至少 beta 前不做）**：GitHub App/PR auto-fix、云 sandbox、多用户共享/ACL、计费与套餐、手机入口、跨机器同步、组织级治理、200 线程/天的硬性配额执法（只做可配置）。

---

## 7. 风险与对策

| # | 风险 | 影响 | 对策 |
|---|---|---|---|
| R1 | 手写 Typert Remote 不可行 | Client 无法调用项目 API | M0 验证；退 `ctx.connection.fetch.register` 原始路由（自校验/鉴权；**Desktop Electron 下 `ctx.webServer.register` 不可靠**）；再不行用「编辑 profile + 读配置」的降级方案（不可接受，需重评估） |
| R2 | A 方案后台线程审批可见性/通知机制需要自建 | 线程卡在等批准，用户不知道 | A 的审批 UI 原生（顶层 Session），只需 `pendingInteraction` 聚合 + watcher 通知；M0 验证「线程不在前台时仍能感知」；B 方案则不承诺审批（子会话审批 never） |
| R3 | B 方案父子依赖（父会话离线锁定发送）与谱系 UI 干扰 | 用户找不到/管不了线程 | **A 方案为主可规避**；若切 B：项目页自建线程列表 + addressed 地址打开 + 线程 header 项目面包屑，并在 M0 验收「协调者归档后线程仍可打开/继续」 |
| R4 | 单进程：Host 退出后线程不能继续 | 长时间任务中断 | 明示限制；线程 brief 要求阶段性提交/写进度；M4 支持 worktree + 分支保留；文档建议长任务拆小 |
| R5 | 多线程写同一文件冲突 | 数据覆盖 | MVP：协调者串行化 + 写入范围声明 + instructions 约束；M4：每线程 worktree，合并由人/后续任务完成 |
| R6 | 模型侧工具膨胀/行为漂移 | token 成本、路由混乱 | 协调者只挂 ~10 个工具；线程工具面更小；固定策略段；工具名统一 `project_*` |
| R7 | 项目上下文太长 | token 成本、KV cache | 简报只注入一次；记忆只进索引；库只给清单；协调者台账摘要按需；instructions ≤16k |
| R8 | 依赖实验包（subagent/worktree）契约变化 | 升级即坏 | 锁定 DSH 版本范围；bundle 可回滚；关键路径写集成测试；尽量用稳定包（session/storage/system-prompt） |
| R9 | 上游 UI 插槽演进 | 页面/按钮丢失 | 只用公开 seat + `slots.inject()`；不 fork 上游；M0 记录 live slot 拓扑 |
| R10 | 项目元数据与 session 不一致（崩溃/半写） | 台账错乱 | domain 写 durable 后才返回；provisioning 状态对账（参照 Team 恢复模式）；启动时修复扫描 |
| R11 | Library 磁盘增长 | 磁盘占满 | 内容寻址去重 + 配额 + 删除清理；不做自动 GC（与 attachment 一致），M4 提供「清理未引用对象」 |
| R12 | `appendPluginRecord` 限制 | 不能把项目事件写 session log | 所有项目状态只进 domain；需要审计时在 domain 表加事件表（append-only 记录） |
| R13 | Library Host 写入路径受 fs-sandbox 默认策略影响 | 上传/入库写入被拒（`FS_SANDBOX_DENIED`） | Host 用 `node:fs` 或显式宽 policy 落盘（M0 验证）；线程读取本身不受 fs-sandbox 限制；二进制大文件用 `materialize` 一次性快照 |
| R14 | 删除语义不一致（Claude 删线程，DSH 归档） | 用户预期不符 | 删除确认文案明确「会话将归档保留，库/记忆将删除」；M4 可选真正删除空会话（受上游 API 限制） |

---

## 8. 更轻的替代方案

| 方案 | 成本 | 能做什么 | 缺什么 |
|---|---|---|---|
| **A. 直接用 Agent Teams**（本机 profile 已启用） | 0 开发 | Lead + teammates、spawn/消息/中断/等待、任务板、Web roster UI | 无项目容器、无 Library、无 Overview、无跨天项目、Team 随会话结束；单任务协作 |
| **B. Workspace + AGENTS.md + skills + subagent 工具** | ~0–2 天（约定 + 文档） | 目录级项目分组、项目指令/知识（AGENTS.md + `<project>/.dsh/skills`）、手动派 subagent 并行 | 无 Coordinator 路由、无线程台账/状态、无 Library 管理、无 Overview |
| **C. 本方案 M0–M1（项目容器 + Library，不做线程）** | ~2 周 | 项目列表/指令/记忆/Library/资料问答 | 没有「派活→线程」核心体验 |
| **D. 本方案 MVP（M0–M2）** | ~3–4 周 | 用户描述的完整「Coordinator+线程+Library+Overview」骨架 | 无 worktree 隔离/PR/云持续 |
| **E. 完整方案（M0–M4）** | ~6–8 周 | 接近 Claude Projects 的本地版 | 仍受单进程/无云限制 |

**建议路径**：
- 若目标是「给 DSH 增加产品级 Projects」→ 走 D + E。
- 若只想立刻多智能体协作 → 今天就启用 Agent Teams（已经在用），把「项目/资料」用 Workspace + AGENTS.md + skills 承载，等项目需求稳定再投入 D。
- 若只想要「项目资料库 + 项目分组」→ B 已能满足 60% 需求，零开发。

---

## 9. 待决策问题

1. **产品定位**：这是要交付给 DSH 用户的正式功能，还是团队内部/个人工作流？前者需要 UI/文档/升级策略，后者可以先用 spike bundle。
2. **线程是否需要独立于协调者生命周期**（方案 A vs B）：如果要求「关闭项目对话后线程仍能被单独打开/继续」，B 方案在父会话离线时对发送有限制，需要评估。
3. **是否要求每线程 git worktree 隔离**：如果一开始就要，M2 需并入 worktree（+3–5 天），否则按共享目录 + 写入约定。
4. **是否需要「从已有会话建项目」**（Continue as project）：如果要，M1 就要设计（fork/引用/预设切换），否则放 M4。
5. **多仓库项目**：MVP 只支持单主目录 + 多个 repo 目录清单；真正多仓 clone/管理放 M4。
6. **是否接受删除时保留（归档）线程会话**：受 DSH「session 不删除」限制；若不可接受，需要上游 API 或改核心。

---

## 10. 参考与证据索引

**Claude 侧**
- 主文档：<https://code.claude.com/docs/en/claude-projects>（`.md` 全文：<https://code.claude.com/docs/en/claude-projects.md>）
- Agent Teams：<https://code.claude.com/docs/en/agent-teams>
- 帮助中心（旧版 + 新版 beta 说明）：<https://support.claude.com/en/articles/9517075-what-are-projects>
- 发布公告：<https://claude.com/blog/projects-redesigned>（2026-09-17）
- 详细拆解与来源编号 S1–S17、抓取失败记录：R1 的 §13 与 `research/claude-projects/sources.md`

**DSH 侧（安装根 `$ASAR=/Applications/DeepSeek Harness.app/Contents/Resources/app.asar/dsh/`）**
- 包 README：`$ASAR/node_modules/@deepseek-ai/<pkg>/README.md`（session/persistence/subagent/team/session-projection/storage-domain/system-prompt/agent-instructions/attachment/file-upload/sidebar-right/layout/conversation/workspace/agent-preset/worktree …）
- 组成 patch：`$ASAR/node_modules/@deepseek-ai/{dsh-base,dsh-web-app,dsh-experimental-agent-team-profile}/cordis.patch.yml`
- 本机 profile：`~/.dsh/profiles/desktop/{package.json,cordis.patch.yml}`
- 数据布局：`~/.dsh/{sessions,storages,attachments,projects(新增)}`
- live 侦察结论与扩展点速查：R2、R3（196 个组成行、Slot 拓扑、Service API、Team 工具 schema、磁盘布局）

**本文档相关的关键判断**
- 【已证实】Claude Projects 的组成/边界/限额/Resolved/Library 语义（R1 全文）
- 【已证实】DSH 会话/子会话/投影/storage/UI seat/上传/审批/preset 的现有能力（R2、R3、包 README）
- 【推断，需 M0 验证】手写 Typert Remote、后台线程审批可见性、线程 watcher 汇报注入、从插件注入 `ctx.sessionController` 并跨会话 prompt（含并发 agent 行为）
- 【设计】数据模型、线程载体推荐（A，顶层 Session；B 备选）、包拆分、工具面、里程碑与限额默认值

---

## 附：本文引用的关键事实清单（自查用）

- [x] Claude Code Projects 与 claude.ai 旧 Projects 的区别（R1 §1）
- [x] Coordinator 的职责与边界（无 connectors、不代批、只看汇报）（R1 §3）
- [x] 线程启动上下文（repo CLAUDE.md 加载、settings/skills/mcp 不加载）（R1 §4.2）
- [x] Resolved 规则与 Overview 六分组（R1 §4.5、§5）
- [x] Library 数据形态、限额、拷贝/Replace 语义（R1 §6）
- [x] Instructions/Memory/Repositories 三件套（R1 §7）
- [x] Pause/Archive/Delete、单用户、线程不可迁移（R1 §7.6、§7.8）
- [x] 用量与 200 线程/天（R1 §8）
- [x] DSH Session/持久化/子会话/投影/storage/UI seat/上传/审批/preset/worktree/schedule 的现有能力（R2、R3）
- [x] DSH 硬缺口 G1–G5 与约束 C1–C4（R2 §8）
- [x] 线程载体 A/B 对比与推荐（§3.4）
- [x] 包拆分与 API/工具草案（§4）
- [x] M0–M4 里程碑与验收（§5）
- [x] 非目标、风险、轻量替代（§6–§8）

---

## 11. 评审记录（v1.1）

本文在 v1 完成后由两位调研员独立评审，修订已吸收：

- **Claude 规格保真度评审**（claude-spec，[review-plan.md](../research/claude-projects/review-plan.md)）：修订 Coordinator「弱化/不做执行」的证据标签（改为【推断/设计】）、线程归属语义与 M2 验收、补 E8/E9、GitHub 前置、Resolved 第三触发、协调者按需读单线程（`project_get_thread`）、Library 文件夹形态、产出自动入库、Ready-for-review / 权限 / Pause 差异标注、ThreadRecord 字段。
- **DSH 可行性评审**（dsh-explorer，[review-plan.md](../research/dsh-capabilities/review-plan.md)，3 阻塞 / 11 风险 / 6 建议）：修订为 **A（顶层 Session）默认 + B 备选**；补「in-process 子会话审批 pinned never」「完成通知 best-effort」「startActivation 真实形状」「Send/Stop 走 subagents.prompt/interruptByParent」「Desktop 逃生口用 connection.fetch.register」「token 用量用 tokenUsage projection」「Library 写入沙箱与自有上传路由」「Archive 只归档协调者会话」「patch 子路径 / 自有 scope」「线程内嵌套委派默认不可」。
- **仍待 M0 实测的假设**：见 §5 M0 验证表 1–10 与 §10 的【推断，需 M0 验证】清单。
