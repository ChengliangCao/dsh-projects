# GitHub 生态调研报告：Project Memory 与「类 Claude Projects」方案

> 日期：2026-10-22　｜　抓取时间：15:05–15:35（Asia/Shanghai）　｜　数据快照：GitHub stars/license/pushed_at 均为 2026-10-22 当日
> 详细证据：
> - Project Memory：[`research/github-memory/README.md`](../research/github-memory/README.md)（706 行，30 仓库 + 数据 CSV）
> - 类 Projects 项目：[`research/github-projects/README.md`](../research/github-projects/README.md)（870 行，42 仓库 + 10 个深读）
> - 决策记录：[ADR 0001：以「插件 + bundle」形态实现并开源](decisions/0001-plugin-first-open-source.md)
> - 方案本体：[DSH 复刻 Claude Projects 方案](dsh-claude-projects-plan.md)（本报告给出待吸收的修订清单）
>
> 证据标注：**【已证实】** = README/源码/官方文档直接支持；**【推断】** = 由证据外推。star 数为抓取时点近似值。

---

## 目录

- [0. 执行摘要（三个任务的直接回答）](#0-执行摘要三个任务的直接回答)
- [1. 调研方法与口径](#1-调研方法与口径)
- [2. 任务一：Project Memory 有没有「完美方案」](#2-任务一project-memory-有没有完美方案)
- [3. 任务二：类 Claude Projects 项目——实现了什么、差异、独有能力、怎么实现](#3-任务二类-claude-projects-项目实现了什么差异独有能力怎么实现)
- [4. 对 DSH 方案的启示：7 个可借用模式 + 待修订清单](#4-对-dsh-方案的启示7-个可借用模式--待修订清单)
- [5. 任务三：开源 + 插件化决策（已记录）](#5-任务三开源--插件化决策已记录)
- [6. 下一步建议与待你决策](#6-下一步建议与待你决策)
- [7. 附录：关键仓库与来源](#7-附录关键仓库与来源)

---

## 0. 执行摘要（三个任务的直接回答）

### 0.1 任务一：Project Memory 有没有能完美甚至更好的方案？

**没有单一项目「完美」实现；但存在可组合的成熟部件，而且 DSH 生态里已经有 5 个原生 memory 插件。**

【已证实】Claude 的「项目记忆」其实是**两套并行系统**（[官方文档](https://code.claude.com/docs/en/memory)）：

| | CLAUDE.md 指令（人写） | Auto memory（Claude 自己写） |
|---|---|---|
| 作用域 | project / user / org | **per git repository**（同 repo 的所有 worktree/子目录共享） |
| 载入 | 每次会话 | 每次会话，只载 `MEMORY.md` 索引（**前 200 行或 25KB，先到者为准**） |
| 存储 | 仓库内 / `~/.claude/CLAUDE.md` | `~/.claude/projects/<project>/memory/MEMORY.md` + 每事实一个 topic 文件 |
| 机制 | 静态规则 | 四类型（user/feedback/project/reference）、索引常驻 + 正文按需读、`modified` 时间戳、机器本地、子 agent 默认不加载 |

**2026-10 的 DSH 已经不空白**：claude-mem、memsearch（@zilliz/memsearch-dsh）、MemOS、dsh-auto-memory、EverOS 都提供 DSH 原生插件。问题从「有没有」变成「谁语义最像、谁可维护、许可证能不能用」。

**三条最接近的路线**（stars 为 2026-10-22 抓取）：

| 路线 | 项目 | 为什么接近 | 差距 |
|---|---|---|---|
| A. 语义 1:1 克隆 | [dsh-auto-memory](https://github.com/AskTheWay/dsh-auto-memory)（101★，MIT，DSH 插件） | 直接复刻 Claude auto-memory：每事实一文件 + `MEMORY.md` 索引 + 四类型 + project/user 双 scope + 系统提示注入（4KB 硬预算）+ `memory_write/read/list/delete` + 原子写/文件锁 | 单维护者、无 embedding/语义检索、`autoSummarize` 默认关、无 git-repo 派生 scope 与超限治理 |
| B. Markdown 源真相 + 影子索引 | [memsearch](https://github.com/zilliztech/memsearch)（2,771★，MIT，官方 DSH 插件） | 与我们目标同构：**Markdown 唯一真相，Milvus 可重建影子索引**；三层渐进检索（search→expand→transcript）+ dense+BM25+RRF + `PROJECT.md`/`USER.md` 维护 + 跨 5 个 harness 共享 | 记忆组织是「日志 journal + 摘要」，不是「索引 + 每事实文件」；依赖 Milvus Lite + embedding（~558MB ONNX 模型） |
| C. 成熟自动捕获 | [claude-mem](https://github.com/thedotmack/claude-mem)（102,203★，Apache-2.0，官方 DSH 插件） | 生态最大：hooks 捕获 → LLM 压缩 observations → SQLite+FTS5+Chroma → MCP 三层工具（~10x token 节省） | 真相在 SQLite/Chroma 而非人可编辑 Markdown；默认引导托管账户（CMEM Pro），需改本地 provider |

**结论：最优路径是「组合」而不是「选型」**——推荐主路线 A：自研 Host 插件作为骨架（复刻 Claude auto-memory 语义，可 fork/参考 dsh-auto-memory），叠加**可选**的 memsearch 式语义索引层，并吸收 Graphiti 的「失效而非删除」；不装外部服务也能工作。详见 [§2](#2-任务一project-memory-有没有完美方案)。

### 0.2 任务二：类 Claude Projects 项目——具体实现了什么、差异、独有能力、怎么实现？

【已证实】GitHub Search API 在 2026-10-22 的量化结果：

- 查询 `open source claude projects threads library` → **total_count = 0**
- 查询 `claude code parallel agents` → **1,475 个结果**

**「并行跑 agent」是红海；把 Claude Projects 四件套（长期项目容器 + 只做路由/台账的 Coordinator + 完整可恢复线程 + 项目级 Library/Overview）作为整体实现的产品仍是空白。**

| 判定 | 语义 | 开源证据 |
|---|---|---|
| ✅ 已被验证 | 线程级隔离：每任务一个 git worktree + branch + 独立会话 | claude-squad、vibe-kanban、ccmanager、Nimbalyst、Orchestrator.inc |
| ✅ 已被验证 | 线程台账 + 实时状态由事实**推导**（不双写） | Orchestrator.inc 四列 kanban、vibe-kanban `WorkspaceWithStatus`、agent-deck hooks/pane 四态 |
| ✅ 已被验证 | 协调者角色（规划/拆任务/派发/跟踪） | Gas Town Mayor、Orchestrator.inc orchestrator、OpenMeld Center Agent、CCPM conductor |
| ✅ 已被验证 | Resolved ≠ Delete（归档/清理与会话记录解耦） | vibe-kanban `archived/worktree_deleted`、agent-deck archive、Gas Town Seance |
| ↕️ 已被超越（Claude 无） | 多人协作、移动端、本地多模型、成本看板、自托管、工程证据契约 | OpenMeld、Nimbalyst iOS、amux、agent-deck/Ruflo、Citadel |
| ⚠️ 部分实现 | Library（项目级资料库） | 最接近 OpenMeld shared files + 版本历史，但仍是聊天附件模型 |
| 🕳️ 空白（机会） | Project 四件套整体；Coordinator「只读汇报」边界；线程级成本/限额账本；项目级权限→线程审批聚合 | 无先例 |

**最接近整体语义的是 [Orchestrator.inc](https://github.com/OrchestratorInc/agent-orchestrator)（13,471★，Apache-2.0，2026-10-22 仍日更）**：repo = Project，project orchestrator = Coordinator，worker = Thread（git worktree + branch），kanban 四列（Working / Needs you / In review / Ready to merge）由 session/PR/CI/review 事实推导；差异是本地桌面 app、orchestrator 可读 worker transcript（Claude 明确「只看汇报」）、Library 弱、单用户。

其余重点：vibe-kanban（28,425★，Task/Workspace 分表是最佳数据模型样本，但已宣布 sunset）、claude-squad（tmux+worktree，AGPL）、CCPM（GitHub Issues+worktree+Agent Skill，MIT）、Gas Town（Mayor/Rig/Witness/Deacon/Refinery/Seance，MIT）、Agent Deck（watcher + doorbell）、Claude Flow/Ruflo（swarm+hooks+memory）、Citadel（campaign/evidence contract）、OpenMeld（多人协作）、Nimbalyst（Crystal 继任者，iOS + session kanban）。详见 [§3](#3-任务二类-claude-projects-项目实现了什么差异独有能力怎么实现)。

### 0.3 任务三：开源 + 插件化

已记录为正式决策 [ADR 0001](decisions/0001-plugin-first-open-source.md)：**纯插件形态实现、不改 DSH 核心、以可安装 bundle 交付并开源**；自有 npm scope、默认 MIT（可改 Apache-2.0）、外部 memory/检索能力以 adapter 形式提供、不 fork 上游。实现阶段再开展，本次只记录决策与约束。

### 0.4 一句话

> **不是「找一个开源项目抄」，而是「用开源已验证的线程隔离/状态推导/记忆语义，组合出一个还没人做完整的 Project 产品」**；我们的差异化恰好在 Claude 与开源共同薄弱处：Library 产品化、Coordinator「只看汇报」边界、线程级账本、项目级审批聚合。

---

## 1. 调研方法与口径

| 项 | 说明 |
|---|---|
| 发现 | `web_search` + GitHub Search API（未认证限流约 10 次/分钟）+ shields.io 徽章 JSON（stars/license/last-commit）+ `commits/HEAD.atom` 补更新时间 |
| 读代码/文档 | 本机 `raw.githubusercontent.com` 被网络策略拦截（non-public IP）→ 改用 `cdn.jsdelivr.net/gh/<owner>/<repo>@HEAD/...`；另有 codeload 解包 27 个仓库核对源码 |
| 元数据 | `api.github.com/repos/<owner>/<repo>`（未认证 60 次/小时，全队共享，已节流） |
| 分级 | 【已证实】README/源码/官方文档；【推断】外推；抓取失败项在详细报告 §7.2 记录，未编造 |
| 时效 | Claude Projects 仍 public beta；开源项目状态变化快（见 §3.7），所有数值仅代表 2026-10-22 |

---

## 2. 任务一：Project Memory 有没有「完美方案」

### 2.1 结论：没有，但已有「语义骨架 + 检索工程」的分工

【已证实】开源方案与 Claude Project Memory 的**六条结构性差距**：

1. **双系统分离无人统一**：Claude 刻意把「人的指令（CLAUDE.md）」与「AI 的记忆（MEMORY.md + topic）」分开；开源要么只做记忆（mem0/Graphiti/Letta），要么只做指令（AGENTS.md / memory-bank），几乎没有一个底座同时显式建模两层并规定权限。
2. **项目作用域语义无标准**：Claude 的 `<project>` 由 **git 仓库**派生（同 repo 的 worktree 共享、机器本地）；开源常用 path hash / collection / workspace 目录，很少处理 worktree 合并。这条只能自研。
3. **索引硬预算 + 超限治理缺失**：Claude 对 `MEMORY.md` 有 200 行/25KB 硬上限，超限写入仍成功但**返回错误要求模型重写索引**；只有 dsh-auto-memory 做了字节预算+截断标记，但无「要求重写」闭环。
4. **两段式注入（索引常驻 + 正文按需）缺失**：开源主流是「检索结果注入」或「全量注入」；dsh-auto-memory 与 Serena 最接近（Serena 明确论证「只注入名字列表，正文由 agent 决定读」）。
5. **可审计/可回滚**：DB/向量/图方案（claude-mem、mem0、Graphiti、Letta、官方 MCP KG）自动但不可 git diff/blame；文件方案可审计但捕获/检索要另做。
6. **写入纪律 + 去重 + 冲突 + 时间有效性未组合**：mem0 的 ADD-only、Graphiti 的双时态失效、Letta 的 sleep-time consolidation、A-MEM 的演化各有一点，但无人组合成 Claude 的完整策略。

【已证实】开源**也有更好**的地方（可反向借鉴）：

- **claude-mem**：observations 压缩 + 三层检索（search→timeline→get_observations）的 token 经济学，能回答「当时发生了什么」；
- **memsearch**：dense+BM25+RRF 混合、SHA-256 内容寻址去重、文件监听增量索引；
- **Graphiti**：bi-temporal（`valid_at/invalid_at`）失效保留历史；
- **dsh-auto-memory**：4KB 索引硬预算、空存储 0B 注入、跨进程锁、原子写；
- **Letta / memsearch**：后台 consolidation / `PROJECT.md`/`USER.md` 维护 / 技能蒸馏。

### 2.2 项目地图（30 个，按类别；详见 memory 报告 §3）

| 类别 | 代表项目（stars，license） | 机制关键词 |
|---|---|---|
| 文件/Markdown | **dsh-auto-memory**（101，MIT）、**memsearch**（2,771，MIT）、basic-memory（4,311，**AGPL**）、Serena（30,592，**GPL** 部分）、agents.md（25,038，MIT）、engram（7,521，MIT） | MEMORY.md 索引、每事实文件、Markdown 源真相、MCP、SQLite+FTS5 |
| 图/时序 | **Graphiti**（32,123，Apache-2.0）、Cognee（32,645，Apache-2.0）、Zep（4,966，Apache-2.0，CE 已转云） | 时序知识图谱、双时态、实体/关系 |
| Memory 平台/SDK | **mem0**（67,614，Apache-2.0）、**Letta**（25,225，Apache-2.0）、MemOS（12,019，Apache-2.0）、EverOS（13,556，Apache-2.0）、supermemory（31,346，MIT）、memU（14,556）、LangMem（1,717，MIT） | 抽取/合并、向量+图、scope、托管或自托管 |
| 自动捕获 | **claude-mem**（102,203，Apache-2.0）、mcp-memory-service（2,032，Apache-2.0）、context-portal（767，Apache-2.0） | hooks、observation 压缩、MCP 工具 |
| Claude/编码专用 | dsh-auto-memory、claude-mem、memsearch、Serena、CLAUDE.md/AGENTS.md 生态 | 项目记忆、指令、跨 harness |

### 2.3 推荐路线（3 套，按目标选）

#### 组合 A（推荐主路线）：Claude 语义骨架 + 可选语义索引层

```
DSH Host 插件（自研，~1 个 Cordis 包）
├── 记忆骨架（复刻 Claude auto-memory）
│   ├── MEMORY.md 索引 → systemPrompt.section（order 4000，4KB 硬预算，空则 0B）
│   ├── 每事实一文件：frontmatter name/description/type/modified/valid_at/superseded_by
│   ├── project scope = git repo 派生（同 repo worktree 共享）+ user scope
│   ├── 工具：memory_write / memory_read / memory_list / memory_delete / memory_search
│   └── 写入纪律（查重→更新而非堆积；跳过代码可推导/指令已写；feedback 带 Why/How）
├── 检索层（可选，借鉴 memsearch）：Markdown 分块+SHA-256 → 本地向量索引（Milvus Lite/sqlite-vec），混合检索 + 三层渐进披露；不装也能工作
├── 治理层：索引超限 → 写入成功但要求重写索引（复刻 Claude）；失效而非删除（Graphiti 式）
└── 指令层：复用 DSH 现有 AGENTS.md/项目指令（与记忆层显式分离）
```

- **落地优先级**：P0 骨架（可先 fork `dsh-auto-memory`，MIT，省掉 80% 注入/锁/工具细节）；P1 补 git 派生 scope、超限治理、`modified`/`valid_at`；P2 可选语义索引（复用 memsearch 的 indexer 或并列安装 `@zilliz/memsearch-dsh`，但要做**单一写者**治理）。
- **为什么**：唯一能同时满足上述九条语义的组合；Markdown 源真相保证可审计/git/人改；检索层可选；Host 插件原生，无外部服务强依赖。

#### 组合 B（最快原型）：直接叠加现有 DSH 插件

`dsh-auto-memory`（索引+注入） + `@zilliz/memsearch-dsh`（捕获+语义检索） + 可选 `@claude-mem/dsh`（历史 observation）。
**优点**：零开发、MIT、都活跃；**风险**：双写/索引不一致——必须做单一写者，只适合原型验证。

#### 组合 C（自动捕获优先）：claude-mem 做捕获层 + 自研 Markdown 投影

适合「用户零配置自动记忆」而非「可审计项目记忆文件」；代价：worker/Bun/uv 重、真相仍在 SQLite/Chroma、默认托管账户需改本地 provider。

### 2.4 License 与选型陷阱（重要）

- **不可内嵌分发**：basic-memory = **AGPL-3.0**、Serena 应用部分 = **GPL-3.0**、byterover = Elastic License 2.0。可内嵌且语义接近的交集只有 **dsh-auto-memory / memsearch / EverOS**（MIT/Apache-2.0）。
- **状态变化**（避免按旧资料选型）：Zep CE 已转云；Letta 源码迁 `letta-ai/letta-code`；旧 OpenMemory 应用归档；Memori→MemoriLabs；Memobase 自 2026-01 停更；claude-mem 默认托管账户需评估合规。

### 2.5 对 DSH 实现的具体落点（从现有 DSH memory 插件反推，【已证实】）

| 能力 | 落点 |
|---|---|
| 注入 | `ctx.systemPrompt.section({ order: 4000, ... })`：每步重评估、动态、空内容不注入 |
| 捕获 | `session/event` 的 `turn/end`；`agent/pre-step`（首步注入）；`agent/created` 初始化；`session/disposed`+定时器做维护 |
| 工具 | `ctx.tools.register` 注册 `memory_*`，走标准 `tool/call`/`tool/result` 审计 |
| Skill | `ctx.skills.register('memory-recall')` 供 `skill` 工具按需调用 |
| 文件安全 | `$DSH_HOME` 不在默认 fs-sandbox 可写根内 → 用 `node:fs` + `@deepseek-ai/dsh-atomic-write`（`withFileLock`/`writeFileAtomic`） |
| 打包 | `package.json` 声明 `dsh.bundle.patch` + `cordis.patch.yml` 的 `insert`；`dsh plugin --profile <p> add <pkg>` |
| 红线 | **不要写自定义 session event 类型**（会让 session resume fail-closed）；索引内容必须中和 `{{ }}`（strict interpolation） |

> 这一节直接改写我们方案 §3.6/§3.3 的 Project Memory 设计，见 [§4.2](#42-对现有方案文档的修订清单)。

---

## 3. 任务二：类 Claude Projects 项目——实现了什么、差异、独有能力、怎么实现

### 3.1 十强速览（概念映射 / 与 Claude 差异 / Claude 没有的 / 实现机制）

| 项目 | 概念映射 | 与 Claude 的差异 | Claude 没有的能力 | 实现机制（要点） |
|---|---|---|---|---|
| **[Orchestrator.inc](https://github.com/OrchestratorInc/agent-orchestrator)** 13,471★ Apache-2.0 | repo=Project；project orchestrator=Coordinator；worker=Thread；kanban=Overview | 本地 Electron+daemon，非云；orchestrator 可读 worker transcript（Claude 只看汇报）；Library 弱；单用户 | 20+ 家 CLI agent 混用；worker 级隔离浏览器 profile；PR/CI/review 回灌同一 worker | git worktree+branch；card 绑定 task/agent/branch/activity/PR/status；kanban 由事实推导；daemon 监视 agent 与源码状态 |
| **[vibe-kanban](https://github.com/BloopAI/vibe-kanban)** 28,425★ Apache-2.0（**已宣布 sunset**） | Task=任务；Workspace=执行环境；kanban=Overview | 无 Coordinator 会话；任务板人工驱动；无 Library | 多 agent 切换（10+）、内置浏览器预览、PR 创建/合并、self-host | Rust axum/sqlx/SQLite + React；`Task`(意图, 五态) 与 `Workspace`(branch/container_ref/archived/worktree_deleted/pinned) **分表**；`WorkspaceWithStatus` 由 is_running/is_errored 叠加派生 |
| **[claude-squad](https://github.com/smtg-ai/claude-squad)** AGPL-3.0 | session=Thread；TUI=Overview | 无 Project/Coordinator/Library；无状态持久化 | tmux 多会话、任意 CLI 程序、yolo 自动接受、diff 预览 | tmux 会话 + git worktree 隔离；TUI；`s` commit+push、`c` checkout、`r` resume |
| **[CCPM](https://github.com/automazeio/ccpm)** MIT | 主对话=conductor；GitHub Issue=Thread；`.claude/epics/`=项目记忆 | 无 Library/Overview UI；无自动收尾；依赖 GitHub | 用 GitHub Issues 做多人/人机交接、PRD→Epic→Task 全链路、Bash 确定性操作（零 token） | Agent Skill + `.claude/` 文件为真相；GitHub Issues + worktree 并行；task frontmatter（depends_on/parallel/conflicts_with） |
| **[Gas Town](https://github.com/steveyegge/gastown)** MIT | Town=项目群；Rig=Project；Mayor=Coordinator；Polecat=Thread；Convoy=任务批次 | 更重、需 Go/Dolt/tmux；无 Library；面向工程 | 20–30 agents 规模化、Witness/Deacon 看门狗、Refinery Bors 式合并队列、Seance 前任会话查询、Wasteland 联邦 | git worktree hooks 持久化；Beads(Dolt) 记状态；tmux 角色；守护链 Daemon→Boot→Deacon→Witness；scheduler 限流 |
| **[Agent Deck](https://github.com/asheshgoplani/agent-deck)** | deck=Project 集合；conductor=Coordinator；session=Thread | 终端 TUI；无 Library | Telegram 远程、成本看板、nudge 守护、会话状态机（running/waiting/idle/error） | tmux 会话 + hooks + pane 轮询；doorbell 规则（watcher 只投递不控制）；archive 保留 conversation/worktree |
| **[Claude Flow / Ruflo](https://github.com/ruvnet/claude-flow)** 78k★ | swarm=Threads；mission=Project | 偏框架库；无产品级项目容器 | 27 hooks、向量记忆、多 provider、federation（mTLS） | Node/TS；swarm 编排 + hooks 生命周期 + memory 向量库 |
| **[Citadel](https://github.com/SethGammon/Citadel)** 925★ | campaign=Project；`/do` Router=Coordinator；wave=Thread | 偏工程纪律，非产品容器 | evidence contract（passed/failed/blocked/unknown）、claims/写作用域冲突检测、discovery relay（~500 token 跨 wave 压缩传递） | campaign 文件（Feature Ledger/Decision Log/Active Context/Continuation State）+ 状态文件 + 策略执行器 |
| **[OpenMeld](https://github.com/amplifthq/openmeld)** 1,390★ MIT | Space=Project；Center Agent=Coordinator；shared files=Library | 多人协作优先；线程隔离弱；无自动收尾 | 团队 chat、审批、分享链接、文件版本历史、self-host | 服务端+web；Space 成员/任务/文件共享 |
| **[Nimbalyst](https://github.com/nimbalyst/nimbalyst)** 1,957★（Crystal 继任者） | project=Project；多会话 worktree=Thread；session kanban=Overview | 无 Coordinator 语义；无 Library 索引 | iOS companion（审批 diff/排下一任务）、多 agent、plain files in git | 桌面+iOS；session kanban；git worktree；原生本地文件 |

> 完整 25 行 × 13 列能力矩阵、每个项目的「怎么实现」源码级细节见 [projects 报告 §2–§4](../research/github-projects/README.md)。

### 3.2 关键差异结论（对 Claude 而言）

1. **开源验证了「线程 = 独立 worktree/分支/会话」是最佳实践**（7+ 项目一致），Claude 的 cloud session 在本地环境中的对应物就是它——这支持我们方案 M4 的 worktree 隔离提前到 MVP 的候选（取决于用户是否接受成本）。
2. **开源验证了「Overview 由事实推导、不双写」**（Orchestrator.inc / vibe-kanban / Agent Deck），直接支持我们「ThreadRecord 只存意图 + Client 叠加推导」的设计。
3. **开源没有做到** Claude 的「Coordinator 只读结构化汇报、不读 transcript」边界——它们大多允许协调者打开 worker 对话；这提示我们要把 `project_report` 做成**协议**（schema + evidence），而不是 best-effort 通知。
4. **Library 是最大空白**：没有项目实现「不可变字节库 + 线程只读挂载 + 上传/产出统一索引 + Replace 历史」；OpenMeld 的 shared files 是团队附件模型。**这是我们的差异化机会**。
5. **Claude 也没有**：多人协作、本地多模型、移动端、成本看板、自托管、验收证据、依赖图/原子领取——但其中一部分是「产品扩展位」，不是 v1 必需。

### 3.3 「Claude 没有但值得做」13 条（节选，完整表见 projects 报告 §5）

| # | 能力 | 有先例？ | DSH 建议 |
|---|---|---|---|
| 1 | 多人协作（成员/分派/审批/分享链接） | 🟢 OpenMeld/OpenTag/CCPM | 非 MVP；Project 域预留 `members[]`、`thread.assignee` |
| 2 | 移动端（看 needs-you、审批、排队） | 🟢 Nimbalyst/amux/happy | 先响应式 Web + 通知；原生端留扩展 |
| 3 | 本地、多厂商模型 | 🟢 几乎所有工作台 | DSH 天然支持；写进差异表 |
| 4 | 线程级成本/限额账本 | 🟡 agent-deck/Ruflo 全局看板 | **M3 做线程级 `usage` + `counters` + 日限额** |
| 5 | 验收证据（缺证据不算 done） | 🟡 Citadel evidence contract | `project_report` 加 `evidence[]`（passed/failed/blocked/unknown） |
| 6 | 项目状态 plain files、可 git diff | 🟢 Citadel/CCPM/Nimbalyst | Memory/Library 用 Markdown+目录（方案已定） |
| 7 | 多机/远程/无人值守 | 🟢 agent-deck/OpenHands/Kortix | 先「多客户端连同一 Host」；SSH/远程留扩展 |
| 8 | 联邦/跨组织 | 🟡 Gas Town Wasteland/Ruflo | 远期，不做 |
| 9 | 会话续接/前任查询 | 🟡 Gas Town Seance/Citadel relay | 线程简报加 `priorReports[]`；reopen 读「上次 report」 |
| 10 | 任务依赖图/ready/原子领取 | 🟢 beads/amux/vibe-kanban | M3 写 domain `blockedBy`，spawn 前检查就绪 |
| 11 | 看门狗/自动恢复/自动收尾 | 🟢 Gas Town Witness/Deacon | `project-watcher`：turn/end、超时失败→台账；N 天无活动自动 resolve |
| 12 | 合并队列/PR 自动化 | 🟡 Gas Town Refinery | M4+ 可选插件 |
| 13 | 项目级权限→线程生效→项目页聚合 | 🔴 **空白** | **机会点**：用 `pendingInteraction` 投影做项目级聚合，DSH 天然比开源强 |

### 3.4 2026 生态洗牌警示（避免踩坑）

- **vibe-kanban 已宣布 sunset**（README 顶部）；**Crystal → Nimbalyst**（3,134★ → 1,957★）；**claude-flow → Ruflo**（78k★）；**Suna → Kortix**（20k★）；**AutoGen 已归档**；**Conductor 是闭源商业产品**（无 GitHub 源码，检索到的同名仓库全是第三方仿作）；**Zep CE 转云**；**Letta 源码迁 letta-code**。
- 结论：**押注单一项目风险高，分层解耦（骨架/检索/捕获各自可换）更稳**——这也支持我们插件化 + adapter 的设计。

---

## 4. 对 DSH 方案的启示：7 个可借用模式 + 待修订清单

### 4.1 7 个可借用实现模式（A–G）

| 模式 | 内容 | 对应我们方案 |
|---|---|---|
| **A. 线程双层模型** | domain 只存意图（provisioning/active/resolved/failed + lastReport + usage），运行态由 Client 用 session 状态/`pendingInteraction` 纯函数推导；watcher 只写台账/投递事件，不直接控制线程（agent-deck doorbell 规则） | §3.4 状态机、§3.7 Overview（已同构，建议显式写入设计） |
| **B. 线程简报 + report 协议** | 简报 = 首条 durable user message；`project_report` 写 domain：summary/status/`evidence[]`/`deliverables[]`/needs；协调者可靠信息源是台账而非 best-effort 通知 | §3.4/§4.4（需补 `evidence[]`、`priorReports[]`） |
| **C. 项目记忆四段结构** | MEMORY.md 索引 + notes/ 按需 + Citadel 的 Feature Ledger / Decision Log / Active Context / Continuation State | §3.6（需改写为 §2.3 组合 A） |
| **D. Library** | 内容寻址不可变对象 + 项目级索引 + 产出回收；上传/产出统一「拷贝快照入库」，线程只读，Replace 保留历史 | §3.6（已接近，需补「Replace 历史版本」与「无项目也能用」） |
| **E. Coordinator 边界** | 路由/台账/记忆服务 + 对话界面；确定性优先路由；无 connectors；`propose_threads` = Suggested threads | §3.5（已同构，强化「只读汇报」） |
| **F. Overview 纯函数推导** | 六分组由 Running/Waiting/Idle/Error + `pendingInteraction` + lastReport 推导；不双写 | §3.7（已同构，补「Needs you」注意力路由） |
| **G. 生命周期治理** | resolve 只标记、清理是独立动作；`autoResolveDays`；`counters.threadsCreated` 日限额；pause/archive/delete 三级 | §3.11（已同构，补「清理动作」） |

### 4.2 对现有方案文档的修订清单

> 方案本体暂不改动，等你确认后一次性更新 [dsh-claude-projects-plan.md](dsh-claude-projects-plan.md)：

1. **Project Memory 章重写**（§3.3/§3.6）：改为「指令层（复用 AGENTS.md）+ 记忆层（自研骨架，可 fork dsh-auto-memory 语义）+ 可选检索层（memsearch 路线）」；数据模型加 `type`、`modified`、`valid_at`/`superseded_by`；项目 scope 由 **git repo 派生**而非 cwd；索引预算 4KB（可配）+ 超限治理；补「不写自定义 session event / 中和 `{{ }}`」红线。
2. **线程模型微调**（§3.4）：ThreadRecord 增 `evidence[]`、`priorReports[]`、`deliverables[]`；`project_report` 改为有 schema 的协议；确认「domain 意图 + client 推导」双层模型。
3. **Library**（§3.6）：明确「Replace 保留历史版本」「纯文档项目无 dir 也能用」「内容寻址 + 配额」；线程只读通过 Host 工具 + materialize 一次性快照。
4. **Overview**（§3.7）：Ready for review 改名为「Needs review / 待收」并注明 DSH 特有映射；增加「Needs you」聚合（审批+问题+失败+缺证据）。
5. **生命周期**（§3.11）：resolve 与清理分离；补「自动 resolve 规则开源无人实现 → 我们的差异化」。
6. **M0/M3 增加验证项**：M0 增加「memory adapter spike」（dsh-auto-memory vs 自研骨架 vs memsearch 叠加，含单写者冲突验证）；M3 增加「线程级 usage/evidence/依赖图」。
7. **新增扩展位**（不阻塞 MVP）：`members[]`/`assignee`（多人）、`blockedBy`（依赖图/原子领取）、evidence contract、移动端响应式。

---

## 5. 任务三：开源 + 插件化决策（已记录）

已写入 [ADR 0001](decisions/0001-plugin-first-open-source.md)（状态：已接受，2026-10-22）：

- **纯插件形态**：不改 DSH 核心，只通过 Loader patch / Service / Slot / Remote 等公开扩展点接入；Host/Client/bundle 分层，可独立启停与回滚。
- **开源交付**：独立仓库、自有 npm scope（不占 `@deepseek-ai`）、默认 MIT（可改 Apache-2.0）、第三方依赖 license 清单与合规核查（本次调研已发现 AGPL/GPL/ELv2 硬约束）。
- **Adapter 形态**：Project Memory / Library 的外部集成（dsh-auto-memory、memsearch、claude-mem、Graphiti 等）以适配器包提供；核心 bundle 只依赖稳定的 `MemoryStore` 接口，**不装外部服务也能用**。
- **上游策略**：不 fork 上游包；peerDependencies 锁定 DSH 版本区间 + CI 兼容矩阵；实验性 API 变化通过 bundle 回滚兜底。
- **非目标**：云沙箱、GitHub App/PR 自动化、多用户共享（与 Claude beta 一致）。

---

## 6. 下一步建议与待你决策

### 6.1 修订后的 M0（建议 2–4 天）

在原 10 项线程/Remote/Library 验证之外，新增 **memory spike**：

1. 在 scratch profile 装 `dsh-auto-memory`（MIT）验证：注入、scope、原子写、与 DSH 0.2.1-rc.2 兼容性；
2. 评估 `@zilliz/memsearch-dsh` 的部署成本（Milvus Lite + ONNX 558MB）与「只做检索层、不双写」的可行性；
3. 对比「fork dsh-auto-memory 补差距」 vs 「自研骨架（参考其设计）」的维护成本；
4. 产出：Memory 选型 ADR（建议主路线 A）+ M1 的 memory 包拆分。

### 6.2 待你决策（4 个）

1. **Memory 路线**：A（自研骨架 + 可选检索，推荐）/ B（直接叠加两个现成 DSH 插件，最快但双写风险）/ C（claude-mem 捕获 + Markdown 投影，自动但重依赖）？
2. **是否依赖/ fork `dsh-auto-memory`**（MIT、101★、单维护者）还是自研骨架？
3. **MVP 是否包含语义检索**（memsearch 路线）还是一期只做「索引 + 按需文件」？
4. **开源仓库形态**：单仓多包（推荐）还是 Host/Client/adapter 多仓；最终 license MIT 还是 Apache-2.0？

---

## 7. 附录：关键仓库与来源

**Project Memory（节选，完整 30 个见 memory 报告 §3）**
- <https://github.com/AskTheWay/dsh-auto-memory>（101★ MIT，DSH 插件）
- <https://github.com/zilliztech/memsearch>（2,771★ MIT，含 DSH 插件）
- <https://github.com/thedotmack/claude-mem>（102,203★ Apache-2.0，含 DSH 插件）
- <https://github.com/getzep/graphiti>（32,123★ Apache-2.0，双时态图）
- <https://github.com/mem0ai/mem0>（67,614★ Apache-2.0）
- <https://github.com/letta-ai/letta>（25,225★ Apache-2.0）
- <https://github.com/MemTensor/MemOS>（12,019★ Apache-2.0）
- <https://github.com/EverMind-AI/EverOS>（13,556★ Apache-2.0，含 DSH 插件）
- <https://github.com/basicmachines-co/basic-memory>（4,311★ **AGPL-3.0**）

**类 Claude Projects（节选，完整 42 个见 projects 报告）**
- <https://github.com/OrchestratorInc/agent-orchestrator>（13,471★ Apache-2.0，最接近）
- <https://github.com/BloopAI/vibe-kanban>（28,425★ Apache-2.0，已 sunset）
- <https://github.com/smtg-ai/claude-squad>（AGPL-3.0）
- <https://github.com/automazeio/ccpm>（MIT）
- <https://github.com/steveyegge/gastown>（MIT）
- <https://github.com/asheshgoplani/agent-deck>
- <https://github.com/ruvnet/claude-flow>（78k★，现 Ruflo）
- <https://github.com/SethGammon/Citadel>（925★）
- <https://github.com/amplifthq/openmeld>（1,390★ MIT）
- <https://github.com/nimbalyst/nimbalyst>（1,957★，Crystal 继任）

**官方语义**
- Claude Code Projects：<https://code.claude.com/docs/en/claude-projects>
- Claude Code Memory（auto memory / CLAUDE.md）：<https://code.claude.com/docs/en/memory>

**方法限制**：`raw.githubusercontent.com` 被网络策略拦截（改用 jsDelivr/codeload/API）；GitHub 未认证 API 有限流（个别 star 为近似值）；vibe-kanban 已 sunset、Crystal/Conductor 等状态见 §3.4；Claude Projects 仍 beta，语义可能变化。
