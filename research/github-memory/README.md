# Project Memory 开源方案调研（GitHub，2026-10-22）

> 目标：为 DSH（DeepSeek Harness，Cordis 插件架构）设计「Claude Projects」复刻方案，回答一个问题：
> **GitHub 上有没有能「完美甚至更好」实现 Claude Project Memory 的开源方案，可作为 Host 插件底座或 adapter？**
>
> 调研执行：Team 任务 `task-6`（GitHub 调研员 memory-scout）。
> 数据抓取时间：**2026-10-22（Asia/Shanghai）**；star/license/最近推送时间均以该时刻为准，此后会漂移。
> 证据等级：**【已证实】**= 本次实际抓到 README/源码/官方文档（给出 URL）；**【推断】**= 由已证实材料推理，未直接验证。
> 只写 `research/github-memory/` 下文件；未安装任何插件、未改 `~/.dsh`、未改其他目录。

---

## 目录

- [0. 调研方法与数据口径](#0-调研方法与数据口径)
- [1. 结论摘要（有没有完美方案 / 最接近什么 / 差距在哪）](#1-结论摘要有没有完美方案--最接近什么--差距在哪)
- [2. 关键背景：DSH 上已经存在的 5 个原生 memory 插件](#2-关键背景dsh-上已经存在的-5-个原生-memory-插件)
- [3. 项目清单表（30 个，按类别）](#3-项目清单表30-个按类别)
- [4. 能力对比矩阵（17 维）](#4-能力对比矩阵17-维)
- [5. 重点项目实现细节（8 个深读）](#5-重点项目实现细节8-个深读)
- [6. 与 Claude Project Memory 语义逐条对照](#6-与-claude-project-memory-语义逐条对照)
- [7. 对 DSH 的建议（复用 / 借鉴 / 推荐组合）](#7-对-dsh-的建议复用--借鉴--推荐组合)
- [8. 未验证项、风险与不编造声明](#8-未验证项风险与不编造声明)
- [附录 A：证据 URL 清单](#附录-a证据-url-清单)
- [附录 B：数据文件与复现命令](#附录-b数据文件与复现命令)

---

## 0. 调研方法与数据口径

### 0.1 发现与验证通道

本机网络有一处硬限制：`raw.githubusercontent.com` 被解析成非公网 IP，**不可用**（`web_fetch` 直接报 `URL hostname ... resolves to a non-public IP address`；`curl` 亦不可达）。实际可用的通道如下，全部结果可复现：

| 用途 | 通道 | 状态 |
|---|---|---|
| 仓库元数据（stars/license/pushed_at） | `https://api.github.com/repos/<owner>/<repo>` | 【已证实】可用，未认证 core 限流 60 次/小时（与全队共享，本次仅用了 30 次左右） |
| 发现/排序 | `https://api.github.com/search/repositories?q=...&sort=stars` | 【已证实】可用，限 10 次/分钟 |
| README/单文件（raw 的替代） | `https://cdn.jsdelivr.net/gh/<owner>/<repo>@HEAD/<path>` | 【已证实】可用（`@HEAD` 支持默认分支） |
| 整仓快照/源码/文档 | `https://codeload.github.com/<owner>/<repo>/tar.gz/HEAD` | 【已证实】可用，本次下载并解包 27 个仓库做源码级核对 |
| 官方文档正文 | `https://code.claude.com/docs/en/memory.md`（Mintlify `.md` 端点） | 【已证实】可用，519 行正文 |
| 产品文档站 | `web_fetch` 普通 docs 页 | 【已证实】可用但常被截断，正文以仓库源码/raw 文档为准 |

### 0.2 口径说明

- **star**：优先 `api.github.com/repos` 精确值；5 个补充仓库（dsh-auto-memory、EverOS、engram、byterover、centminmod）用 Search API 结果，二者同为 GitHub 官方数据，误差仅来自抓取时刻差。
- **license**：以 GitHub API `license.spdx_id` 为准；`NOASSERTION` 的逐个开 LICENSE 文件核对（见各条“许可证注意”）。**许可证是能否作为 Host 插件底座的硬约束**，本报告单列。
- **最近更新**：`pushed_at`（最后 push 时间），不等于活跃维护质量；会标注“疑似停更/迁移”。
- 本报告**不**采用第三方榜单/awesome-list 的转述数字，所有机制描述都回到 README/源码/官方文档。

### 0.3 交付物关系

- 本文：`research/github-memory/README.md`（主报告）
- 元数据证据：`research/github-memory/data/repo-metadata.csv`（30 行，含每个仓库的 URL/stars/license/pushed_at/来源通道）
- 本任务不产出代码；组合建议是设计建议，不含实现。

---

## 1. 结论摘要（有没有完美方案 / 最接近什么 / 差距在哪）

### 1.1 一句话结论

**没有单一开源项目「完美」实现 Claude Project Memory；但 2026 年 10 月的 GitHub 上已经出现 3 个可「接近甚至局部更好」的候选，且 DSH 生态已被多个方案原生支持。**
最佳答案不是移植某个项目，而是 **「以 Markdown 每事实一文件 + MEMORY.md 索引为语义骨架，叠加 Markdown 源真相的语义检索层（memsearch 路线）」**，或直接以 `dsh-auto-memory` / `memsearch` 的 DSH 插件为起点二次开发。

### 1.2 先把目标语义钉死（来自官方文档，不是我们的想象）

**【已证实：https://code.claude.com/docs/en/memory】** Claude Code 的“项目记忆”其实是**两套并行系统**：

| | CLAUDE.md 文件 | Auto memory |
|---|---|---|
| 谁写 | 人（用户/组织） | **Claude 自己** |
| 内容 | 指令、规则 | 学习到的偏好、纠正、项目上下文 |
| 作用域 | project / user / org | **per repository**（同一 git repo 的所有 worktree/子目录共享） |
| 载入 | 每次会话 | 每次会话（**前 200 行或前 25KB**，先到者为准） |
| 存放 | 仓库内 CLAUDE.md / `~/.claude/CLAUDE.md` 等 | `~/.claude/projects/<project>/memory/` |

Auto memory 的目录结构（【已证实】同上文档 Code block）：

```text
~/.claude/projects/<project>/memory/
├── MEMORY.md           # Index, one line per memory, loaded into every session
├── user_role.md        # One memory
├── feedback_testing.md # One memory
└── ...                 # Any other topic files Claude creates
```

关键机制（均【已证实】同文档）：
1. **只有 `MEMORY.md` 索引常驻**；topic 文件启动时不加载，Claude 用普通文件工具**按需**读。
2. 索引超限（>200 行或 >25KB）时写入**仍成功**，但返回 error 要求 Claude 重写索引（超限部分下次加载被丢弃）。
3. 写入自动补 `modified` frontmatter（ISO 8601），让事实的“新鲜度”可判断。
4. 四类 `type`：`user` / `feedback` / `project` / `reference`；**跳过能从代码库推导的内容，也跳过 CLAUDE.md 已写的内容**；不是每次会话都写。
5. **机器本地**（machine-local），不跨机/云同步；清理会话记录时**不清理** memory 目录。
6. 子 agent 默认不加载主会话的 auto memory（除非 fork）。

> 对照我们方案里的 Project Memory：`MEMORY.md 索引 + Claude 自写按需文件` 就是上表右列，**且它与“项目级指令（CLAUDE.md）”是刻意分离的两套系统**。这一点是后面所有“差距”判断的基准。

### 1.3 最接近的三个项目（三种不同“接近”）

| 路线 | 项目 | 为什么接近 | 差在哪 |
|---|---|---|---|
| **A. 语义 1:1 克隆** | [AskTheWay/dsh-auto-memory](https://github.com/AskTheWay/dsh-auto-memory)（101★，MIT，DSH 原生插件） | 直接复刻 Claude Code auto-memory：**每事实一文件 + MEMORY.md 索引 + 四类型 frontmatter + project/user 双层 scope + 系统提示注入（含字节预算）+ memory_write/read/list/delete**，还多了自动固化/遗忘/P1 扩展 | 项目极小（单维护者、101★、2026-10 才活跃）；无自动语义检索/无 embedding（**设计上明确不做**）；`autoSummarize` 默认关闭；行业验证为零 |
| **B. Markdown 源真相 + 影子索引** | [zilliztech/memsearch](https://github.com/zilliztech/memsearch)（2,771★，MIT，**含官方 DSH 插件**） | 与我们目标几乎同构的工程哲学：**Markdown 是唯一真相，Milvus 是可丢弃重建的影子索引**；daily memory journal + `PROJECT.md`/`USER.md` 维护 + 三层渐进检索（search→expand→transcript）+ 混合检索（dense+BM25+RRF）+ 跨 5 个 harness 共享 | 记忆组织是**日志式 journal + PROJECT/USER 摘要**，不是「每事实一文件 + MEMORY.md 索引」；索引不是常驻 prompt 的硬预算段，而是“step 1 检索命中才注入”；依赖 Milvus（Lite 本地可跑）与 embedding 模型 |
| **C. 成熟自动捕获生态** | [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem)（102,203★，Apache-2.0，**含官方 DSH 插件**） | 目前生态最大、最工程化的“自动记忆压缩”实现：hooks 捕获 tool 观察 → LLM 压缩成 observations/summaries → SQLite+FTS5+Chroma → MCP 三层工具（search→timeline→get_observations，宣称 ~10x token 节省）；有 `MEMORY.md` 式“项目记忆/Profile/日志”概念与 Folder Context 文件 | **真相在 SQLite/Chroma 而不是人可编辑的 Markdown**（虽有 note bridge 可导入 `.claude/memory`）；默认安装流程绑定 claude-mem 账户/托管记忆（CMEM Pro）倾向；数据模型是 observation，不是“项目事实文件” |

### 1.4 差距到底在哪（对 Claude Project Memory 的 6 条结构性差距）

1. **双系统分离**：Claude 把“人的指令（CLAUDE.md）”和“Claude 的记忆（MEMORY.md+topic）”分开、都可以每次都载入。开源方案要么只做“记忆”（mem0/Letta/Graphiti/…），要么只做“指令”（AGENTS.md/CLAUDE.md/memory-bank），**几乎没有一个底座同时、显式地建模这两层并规定各自权限**。AGENTS.md/CLAUDE.md 生态证明了“指令文件”范式（[AGENTS.md 25,038★](https://github.com/agentsmd/agents.md)），但它是人写的、无自动写入。
2. **项目作用域语义**：Claude 的 `<project>` 由 **git 仓库**派生，同一 repo 的所有 worktree/子目录共享一个 memory 目录，且是机器本地。开源方案里 project scope 常见做法是“路径 hash / collection 名 / workspace 目录”，**很少显式处理 worktree 合并与跨 worktree 共享**（memsearch 用 `.memsearch/` 目录 + 项目路径 derive collection，closest；【推断】其语义接近但未写死 git 派生）。
3. **索引硬预算 + 超限治理**：Claude 对 MEMORY.md 有 200 行/25KB 硬上限并在超限时**要求模型重写索引**（治理动作，而非静默截断）。开源方案里只有 `dsh-auto-memory` 实现了字节预算（默认 4096B）+ 截断标记，但**没有“超限拒绝并要求重写索引”的闭环**（它选择“按行截断保留用户级”）；memsearch/Graphiti/mem0 走检索，不做常驻索引预算。
4. **两段式注入**：索引常驻 + 正文按需（agent 用普通文件工具读），这是 Claude 的省 token 关键。开源方案主流是“检索结果注入”（mem0/Graphiti/memsearch）或“全量注入”（memory-bank 类），**缺“索引常驻+正文按需”这一显式两段式**——`dsh-auto-memory` 与 Serena 最接近（Serena  sogar 明确主张“只注入名字列表，正文由 agent 决定读”，【已证实：serena docs/02-usage/045_memories.md】）。
5. **可编辑/可审计/可回滚**：Claude auto memory 是明文 Markdown，可 git diff/blame、可人改。DB 型方案（Letta/Graphiti/mem0/官方 MCP KG/claude-mem SQLite）**不可直接 git 审阅**；basic-memory 与 memsearch 的“Markdown 源真相”正是针对这点。
6. **写入策略与冲突治理**：Claude 有明确的“写什么/不写什么/何时写”纪律 + 更新合并提示（`modified`、提醒简化索引）。开源方案里 mem0 明确“ADD-only、不 UPDATE/DELETE”（新算法）、Graphiti 做**双时态失效**（bi-temporal invalidation）、Letta 做 sleep-time consolidation、A-MEM 做 Zettelkasten 演化——**各有单点更优，但没有一个把“写入纪律 + 去重 + 冲突 + 时间有效性 + 索引治理”组合成 Claude 的完整策略**。

### 1.5 也有“更好”的地方（值得反向借鉴）

- **自动捕获 + token 经济学**：claude-mem 的 observations 压缩 + 三层检索（search → timeline → get_observations）比 Claude 的“索引+按需文件”更省上下文，且能回答“当时发生了什么”（【已证实：claude-mem docs/public/architecture/search-architecture.mdx】）。
- **语义检索**：memsearch 的 dense+BM25+RRF 混合 + SHA-256 内容寻址去重 + 文件监听增量索引，是 Claude 没有的（Claude 靠 agent 主动读文件 + `MEMORY.md` 里的一行钩子）。
- **时间有效性**：Graphiti 的 bi-temporal edge（valid_at/invalid_at）能做到“事实失效但保留历史”，Claude 只有 `modified` 时间戳。
- **图结构**：basic-memory（Observations + wikilinks → SQLite 图）、Graphiti（实体/关系）、Cognee（实体+关系+chunks）在“知识之间关系”上强于纯 Markdown 索引。
- **维护与遗忘**：dsh-auto-memory 的引用计数/时间衰减/失配检测、Letta 的 sleep-time agent、memsearch 的 background maintenance（PROJECT.md/USER.md/技能蒸馏）是 Claude 没有的自动化。

**结论：没有完美方案，但存在“语义骨架已有人实现（dsh-auto-memory）+ 检索与工程化已有人实现（memsearch/claude-mem）”的可组合局面。** 对 DSH 来说，最优路径是**组合而非选型**（见 §7）。

---

## 2. 关键背景：DSH 上已经存在的 5 个原生 memory 插件

这是本次调研最重要、也最容易被漏掉的事实：**2026-10 的 DSH 不再是记忆空白**。以下 5 个项目都提供了 DSH 原生集成（Cordis bundle/patch 方式），其中 3 个是本报告重点候选。

| 项目 | DSH 集成方式 | 记忆模型 | 许可证 | 证据 |
|---|---|---|---|---|
| **claude-mem**（102,203★） | `npx claude-mem install --ide dsh --dsh-profile web` 安装 `@claude-mem/dsh` 到 DSH profile 的 pnpm workspace；插件监听 DSH `agent/created` 事件、watch `~/.dsh/sessions` transcript；工具 `mem_search`/`mem_timeline`/`mem_get_observations`/`mem_save`/`mem_context` | 托管 worker（HTTP）+ SQLite/FTS5 + Chroma；observations/summaries；自动捕获 + 三层检索 | Apache-2.0 | 【已证实】[docs/native-harness-integrations.md](https://cdn.jsdelivr.net/gh/thedotmack/claude-mem@HEAD/docs/native-harness-integrations.md) |
| **memsearch**（2,771★） | `dsh plugin --profile web add @zilliz/memsearch-dsh`；`package.json` 声明 `dsh.bundle.patch`，`cordis.patch.yml` insert `id: memsearch`；监听 `session/event turn/end` 捕获、`agent/pre-step` 第 1 步注入、注册 `memory-recall` skill、web 端 dock 面板 | `.memsearch/memory/YYYY-MM-DD.md`（Markdown 源真相）+ Milvus 影子索引；PROJECT.md/USER.md；技能候选 | MIT | 【已证实】[plugins/dsh/README.md](https://cdn.jsdelivr.net/gh/zilliztech/memsearch@HEAD/plugins/dsh/README.md) |
| **MemOS**（12,019★） | README 明示 “Connect MemOS to DeepSeek Harness (`dsh`)”，提供 **local plugin 与 cloud plugin**；DSH 自动 recall / background capture / hybrid retrieval / Memory Viewer | SQLite（本地）或 Neo4j+Qdrant（服务端）/ MemOS Cloud；MemCube、图+向量混合 | Apache-2.0 | 【已证实】[MemOS README](https://github.com/MemTensor/MemOS)（News 2026-08-17） |
| **dsh-auto-memory**（101★） | `dsh plugin --profile demo add dsh-auto-memory`；`cordis.patch.yml` insert `id: auto-memory`；`ctx.systemPrompt.section` 注入 MEMORY.md；工具 `memory_write/read/list/delete` | `$DSH_HOME/memory/<workspace-slug>/` 每事实一文件 + `MEMORY.md` 索引 + 四类型 frontmatter + project/user 双 scope | MIT | 【已证实】[README](https://github.com/AskTheWay/dsh-auto-memory) / [docs/design.md](https://cdn.jsdelivr.net/gh/AskTheWay/dsh-auto-memory@HEAD/docs/design.md) |
| **EverOS**（13,556★） | DSH 插件在独立仓库 [EverMind-AI/plugins/tree/main/dsh](https://github.com/EverMind-AI/plugins/tree/main/dsh)；README 标注 “DSH plugin for memory-aware DeepSeek Harness agents” | Markdown 源真相 + 本地 SQLite + LanceDB；user/agent 双轨；Knowledge Wiki | Apache-2.0 | 【已证实】[EverOS README](https://github.com/EverMind-AI/EverOS)（表格 + 集成列表） |

另外，`modelcontextprotocol/servers` 的官方 memory（知识图谱）server、mcp-memory-service、engram、context-portal 等也能通过 **MCP** 接 DSH（DSH 支持 MCP server），属于“adapter 路线”的候选（见 §7）。

> 意义：**“有没有 DSH 可用的 memory 底座”已经不是问题；“哪个语义最接近 Claude Project Memory”才是问题。**

---

## 3. 项目清单表（30 个，按类别）

> 全部 30 行的机器可读版本见 [`data/repo-metadata.csv`](data/repo-metadata.csv)（含抓取通道）。
> ★=2026-10-22 抓取值。机制列为源码/README 核对后的摘要，详细证据见 §5 与附录 A。

### 3.1 文件 / Markdown 派

| 项目 | URL | ★ | License | 最近 push | 核心机制 | 接口 | 存储 | 作用域 |
|---|---|---:|---|---|---|---|---|---|
| **dsh-auto-memory** | [AskTheWay/dsh-auto-memory](https://github.com/AskTheWay/dsh-auto-memory) | 101 | MIT | 2026-10-20 | Claude Code auto-memory 克隆：每事实一 md + `MEMORY.md` 索引 + 四类 type + 自动固化/遗忘 | **DSH 原生插件**（tools + systemPrompt section + web panel） | 纯 Markdown 文件 | project（workspace-slug）+ user |
| **memsearch** | [zilliztech/memsearch](https://github.com/zilliztech/memsearch) | 2,771 | MIT | 2026-10-22 | Markdown 源真相 + Milvus 影子索引；标题分块/SHA-256 去重/监听增量；dense+BM25+RRF；3 层渐进检索 | CLI / Python API / **DSH 插件** / Claude Code/Codex/OpenClaw/OpenCode 插件 / MCP | Markdown + Milvus（Lite/Server/云） | 项目目录 `.memsearch/`（可按项目派 collection）+ 可全局 |
| **claude-mem** | [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) | 102,203 | Apache-2.0 | 2026-10-22 | hooks 捕获 tool 观察 → LLM 压缩 observations/summaries；SQLite FTS5 + Chroma；progressive disclosure | **DSH 插件** + MCP（4 工具）+ HTTP worker + Web viewer + CLI | SQLite + Chroma（+ note bridge 导入 `.claude/memory` 的 md） | project（project 字段）+ TeamBrain 团队共享（可选云） |
| **basic-memory** | [basicmachines-co/basic-memory](https://github.com/basicmachines-co/basic-memory) | 4,311 | **AGPL-3.0** | 2026-10-22 | Markdown（含 frontmatter、`- [category] observation`、`[[wikilink]]`）↔ SQLite 索引；双向同步；MCP 优先 | MCP / REST / CLI | Markdown 文件 + SQLite（+可选 Milvus 向量） | 多 project（`--project`）；本地/云可选 |
| **Serena memories** | [oraios/serena](https://github.com/oraios/serena) | 30,592 | **GPL-3.0-or-later**（SolidLSP 为 MIT） | 2026-10-20 | `.serena/memories/` Markdown，名字列表注入，`mem:` 引用，project/global 双 scope，只给名字不给正文 | MCP（coding toolkit 的一部分） | Markdown 文件 | project（`.serena/memories/`）+ global（`~/.serena/`） |
| **CLAUDE.md memory-bank 类（代表）** | [centminmod/my-claude-code-setup](https://github.com/centminmod/my-claude-code-setup) | 2,675 | MIT | 2026-10-08 | 把 CLAUDE.md 拆成 `CLAUDE-activeContext/patterns/decisions/troubleshooting.md` 等“memory bank”，靠人/agent 执行 `/update memory bank` 维护 | CLAUDE.md + slash command | 仓库内 Markdown | project（仓库） |
| memory-bank 小型实现 | [hudrazine/claude-code-memory-bank](https://github.com/hudrazine/claude-code-memory-bank) / [Nagendhra-web/memory-bank](https://github.com/Nagendhra-web/memory-bank) | 42 / 45 | Unlicense / Apache-2.0 | 2025-07-27 / 2026-04-15 | Cline memory-bank 变体；分支感知、会话开始读 bank | skill/规则 + Markdown | 仓库内 Markdown | project |
| **AGENTS.md（指令生态，非记忆实现）** | [agentsmd/agents.md](https://github.com/agentsmd/agents.md) | 25,038 | MIT | 2026-09-10 | 开放格式：README for agents；被 Codex/Claude Code 等读取 | 文件规范 | 仓库内 Markdown | project / user |
| **OpenMemory（旧，已归档）** | [mem0ai/openmemory](https://github.com/mem0ai/openmemory) | 99 | MIT | 2026-07-29 | ⚠️ 已变更：该 repo 现在是**跨 harness 会话迁移 CLI/TUI**；旧 OpenMemory MCP+dashboard 归档在 `openmemory-archive/` | CLI / TUI | (旧版：Postgres+Qdrant) | 已不再维护 |

### 3.2 图 / 时序知识图谱派

| 项目 | URL | ★ | License | 最近 push | 核心机制 | 接口 | 存储 | 作用域 |
|---|---|---:|---|---|---|---|---|---|
| **Graphiti** | [getzep/graphiti](https://github.com/getzep/graphiti) | 32,123 | Apache-2.0 | 2026-10-21 | **双时态 context graph**：Episode（原始流）→ Entity/Fact edges（valid_at/invalid_at，自动失效旧事实）+ communities；增量更新不重算全图 | Python SDK + **MCP server**（含 HTTP，参考实现无鉴权） | Neo4j / FalkorDB / Neptune / Kuzu（deprecated） + 全文检索后端 | group_id（可按项目/租户） |
| **Cognee** | [topoteretes/cognee](https://github.com/topoteretes/cognee) | 32,645 | Apache-2.0 | 2026-10-22 | ECL pipeline（extract→cognify→load）+ `memify` 迭代、`improve/forget`；图+向量+代码图；可全本地小模型 | Python SDK / API / MCP（生态） | 默认本地文件+向量；可单 Postgres（PGVector+图，demo）；Neo4j/Kuzu 等 | dataset（可映射项目/用户） |
| **Zep（社区版已转向）** | [getzep/zep](https://github.com/getzep/zep) | 4,966 | Apache-2.0 | 2026-10-20 | ⚠️ 该 repo 现在是 “Zep Cloud: Examples & Integrations”；社区版服务已不再以此 repo 为主，**生产走 Zep Cloud**（Graphiti 是其开源图核心） | 云 API / 示例 | 托管（Zep Cloud） | 云租户 |

### 3.3 托管式 memory 层 / SDK

| 项目 | URL | ★ | License | 最近 push | 核心机制 | 接口 | 存储 | 作用域 |
|---|---|---:|---|---|---|---|---|---|
| **mem0** | [mem0ai/mem0](https://github.com/mem0ai/mem0) | 67,614 | Apache-2.0 | 2026-10-21 | 2026-04 新算法：**单次 LLM ADD-only 抽取**（不再 UPDATE/DELETE）、实体链接、多信号检索（语义+BM25+实体，RRF）、时间推理；graph memory 可选 | Python/TS SDK、自托管 server、**CLI + Agent Skills**、云 | 向量库（可插拔）+ 可选图库 + SQLite history | `user_id`/`agent_id`/`run_id` 多级（可映射 project） |
| **Letta（原 MemGPT）** | [letta-ai/letta](https://github.com/letta-ai/letta) | 25,225 | Apache-2.0 | 2026-10-18 | ⚠️ 该 repo README 声明**当前源码已迁往 [letta-ai/letta-code](https://github.com/letta-ai/letta-code)（3.7k★，Apache-2.0）**，本仓库保留 `archive` 分支供历史复现；选型请用 letta-code；核心：memory blocks（核心记忆，可直接改）+ recall/archival memory + sleep-time agents 后台整理 | Agent SDK / CLI / server / 云 | Postgres + pgvector（自托管） | agent（每 agent 独立记忆） |
| **MemOS** | [MemTensor/MemOS](https://github.com/MemTensor/MemOS) | 12,019 | Apache-2.0 | 2026-10-21 | Memory OS：MemCube（可组合记忆单元）、store/retrieve/manage 统一 API、图+向量、异步 MemScheduler、反馈纠正、L1/L2/L3 演化；**有 DSH local/cloud plugin** | SDK / 本地插件 / 云 API / DSH 插件 | 本地 SQLite（FTS5+vector）或 Neo4j+Qdrant 或云 | user/project/agent cube 组合 |
| **A-MEM** | [agiresearch/A-mem](https://github.com/agiresearch/A-mem) | 1,206 | MIT | 2025-12-12 | 论文实现：Zettelkasten 式 agentic memory，新记忆生成结构化笔记→链接/演化旧笔记 | Python 库 | ChromaDB | 会话/agent（研究代码） |
| **MemoryOS** | [BAI-LAB/MemoryOS](https://github.com/BAI-LAB/MemoryOS) | 1,609 | Apache-2.0 | 2026-07-07 | 短/中/长三层 persona memory + user profile 自动更新 + MCP server（EMNLP 2025） | Python + MCP | 本地（向量/图） | user（persona） |
| **LangMem** | [langchain-ai/langmem](https://github.com/langchain-ai/langmem) | 1,717 | MIT | 2026-10-02 | SDK：functional primitives + **background memory manager**（抽取/合并/更新）；原生接 LangGraph long-term store | Python SDK | 任意 BaseStore（内存/Postgres…） | namespace（可 project/user） |
| **Memori** | [MemoriLabs/Memori](https://github.com/MemoriLabs/Memori)（旧 GibsonAI/memori 301 迁移） | ~17k（shields 口径） | Apache-2.0（LICENSE 文件） | 2026-09（last commit） | 记忆层引擎：LLM/存储/框架无关，SQL/Redis 持久化，MCP 接 Claude Code/Cursor 等 | SDK / MCP / 云 | 关系库/Redis | 按 app/agent |
| **Memobase** | [memodb-io/memobase](https://github.com/memodb-io/memobase) | 2,937 | Apache-2.0 | 2026-01-11 | **user profile** 为中心 + event timeline；低延迟（<100ms）；可配置 profile 结构 | REST API / Python/Node/Go SDK / MCP | Postgres + pgvector | user（多租户） |
| **memU** | [NevaMind-AI/memU](https://github.com/NevaMind-AI/memU) | 14,556 | Apache-2.0（LICENSE.txt，GitHub 显示 NOASSERTION） | 2026-10-21 | “Personal memory, stored as Wiki”：Markdown wiki/skills + 后台桥接任务；MemoryService 不做 LLM 调用，只存/embed/取 | CLI / 宿主适配器（Claude Code/Codex/OpenClaw…）/ 云 | SQLite 或 Postgres（pgvector）；Markdown 技能文件 | user（跨项目个人）+ host |
| **Supermemory** | [supermemoryai/supermemory](https://github.com/supermemoryai/supermemory) | 31,346 | MIT | 2026-10-21 | Memory API + user profiles + RAG/connectors；提取事实、处理更新/矛盾、遗忘过期；宣称 95% Recall@15 / 99.4% context reduction | API / MCP / 插件 | 托管（可本地跑） | user（多 app/租户） |

### 3.4 MCP memory servers

| 项目 | URL | ★ | License | 最近 push | 核心机制 | 接口 | 存储 | 作用域 |
|---|---|---:|---|---|---|---|---|---|
| **官方 memory（KG）** | [modelcontextprotocol/servers · src/memory](https://github.com/modelcontextprotocol/servers/tree/main/src/memory) | 91,470（整仓） | MIT→Apache-2.0 过渡（memory 为 MIT） | 2026-10-19 | 本地知识图谱：entities / relations / observations（原子字符串）；工具 create_entities、create_relations、add_observations、delete_*、search_nodes 等 | MCP（stdio） | 单个 JSONL 文件 | 无内建 project 概念（靠路径/多实例） |
| **mcp-memory-service** | [doobidoo/mcp-memory-service](https://github.com/doobidoo/mcp-memory-service) | 2,032 | Apache-2.0 | 2026-10-21 | 自托管记忆后端：SQLite-vec 向量 + KG（时间/因果边）、自然语言记忆、dashboard、OAuth | REST + MCP + CLI + Web | SQLite + sqlite-vec（可迁移） | 按 DB/部署实例；支持多客户端 |
| **context-portal (ConPort)** | [GreatScottyMac/context-portal](https://github.com/GreatScottyMac/context-portal) | 767 | Apache-2.0 | 2026-01-27 | **project-specific knowledge graph memory bank**：决策/进度/架构 item + 关系 + 向量检索；每 workspace 一个 SQLite | MCP | SQLite（每 workspace） | **workspace_id = 项目**（与目标最同构的 MCP 方案） |
| **engram** | [Gentleman-Programming/engram](https://github.com/Gentleman-Programming/engram) | 7,521 | MIT | 2026-10-22 | Go 单二进制：SQLite+FTS5，项目感知；CLI/HTTP/MCP/TUI；Git Sync 导出块；云可选 | MCP + HTTP + CLI | `~/.engram/engram.db` SQLite | project（项目解析规则 + Git Sync） |
| **byterover-cli（原 Cipher）** | [campfirein/byterover-cli](https://github.com/campfirein/byterover-cli) | 4,950 | **Elastic License 2.0**（源码可用，有限制） | 2026-06-25 | context tree（结构化项目知识）+ Git-like 版本控制（branch/commit/merge）+ 云同步 + MCP | CLI / MCP | 本地 context tree + 云 | project（context tree）+ 团队 |

### 3.5 编码 agent 专用 / 官方生态

| 项目 | URL | ★ | License | 最近 push | 说明 |
|---|---|---:|---|---|---|
| **Claude Code 官方** | [anthropics/claude-code](https://github.com/anthropics/claude-code) | 152,795 | GitHub 未识别到 license（仓库以 issue/文档/plugin 集市为主） | 2026-10-22 | **语义基准**：CLAUDE.md + auto memory（MEMORY.md+topic files）。官方文档 [code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory) 是本次对照依据 |
| **Cline / memory-bank 源头** | [cline/cline](https://github.com/cline/cline) | 70,702 | Apache-2.0 | 2026-10-22 | memory-bank 模式的流行源头（文档在 [docs.cline.bot](https://docs.cline.bot)）；本项目内存库方案多为它的变体【推断：由多个子项目 README 自述“based on Cline Memory Bank”】 |
| **claude-code-auto-memory** | [severity1/claude-code-auto-memory](https://github.com/severity1/claude-code-auto-memory) | 158 | MIT | 2026-04-18 | Claude Code 插件：自动维护/更新 CLAUDE.md 文件（“指令文件自动更新”路线的代表） |
| **memsearch / claude-mem / dsh-auto-memory** | 见上表 | | | | 本报告的三个重点候选 |

> 说明：必覆盖清单中的 `Zep` 与 `Letta` 在 2026-10 都发生了“开源重心迁移”（Zep→Graphiti+云；Letta→letta-code），已在表中标注，避免团队按旧资料选型。
> `Memori` 的 `GibsonAI/memori` 在抓取时返回 301（仓库迁移），csv 中保留了旧 URL；**使用前请以 GitHub 跳转后的新地址为准**，本报告不对其源码细节下结论（见 §8）。

---

## 4. 能力对比矩阵（17 维）

> 为了可读性拆成三张表（同一批项目，纵向对齐）。✅=明确支持，△=部分/需配置，❌=不支持，—=未验证/不适用。
> 证据来源见 §5 深读与附录 A；对未深读的项目按 README 声明标注，属 README 自述级别。

### 4.1 写入与一致性（5 维）

| 项目 | 写入方式 | 去重/合并 | 冲突/时间有效性 | 遗忘/衰减 | 自动 vs 显式 |
|---|---|---|---|---|---|
| dsh-auto-memory | 显式 memory_write + 可选 autoSummarize（默认关） | ✅ 同名覆盖 + consolidation 更新替换（0.7）；写前查重指令 | △ `modified` 式新鲜度（frontmatter 无标准字段，靠 description 失配检测） | ✅ staleAfterDays 软隐藏 + 引用计数 | 显式为主，自动为辅 |
| memsearch | 自动捕获 turn → 摘要写日志；`memory-recall` 检索 | ✅ SHA-256 内容寻址 chunk id（源+行号+hash+模型） | △ 无失效语义；日志按日期追加（历史即真相） | △ compact 压缩为摘要写回日志；无删除策略 | 自动捕获 + 显式 recall |
| claude-mem | hooks 自动捕获 tool 观察 → LLM 压缩 | ✅ observations 压缩 + 项目/类型/时间过滤（去重靠 summary 层【推断】） | △ 观察按时间序；无显式 valid/invalid | △ 有 deleted/隐私标签/自动脱敏；无衰减 | 几乎全自动 |
| basic-memory | AI/人双向写 Markdown；`- [category] observation` + wikilink | △ 实体按 title 唯一；观察可 add/remove | △ 无 temporal 失效；靠 sync 冲突解决 | ❌ 无内建遗忘 | 显式（agent 调 MCP 工具） |
| Serena memories | 显式 write_memory / rename_memory / delete | ❌ 无去重（靠 agent 读后决定） | ❌ 无 | ❌ 无（有 read-only/ignored patterns） | 全显式 |
| Graphiti | Episode 输入 → LLM 抽取实体/事实边 | ✅ 实体去重 + 事实边相似合并 | ✅ **bi-temporal**：valid_at/invalid_at + 自动失效旧事实，历史保留 | ❌ 无遗忘（靠删除 episode） | 半自动（摄取自动，问答显式） |
| mem0 | 自动抽取（新算法 ADD-only，一次 LLM 调用） | ✅ 实体链接 + 多信号检索；新算法不覆盖旧记忆 | △ 时间感知检索排序；无显式失效 | △ 可 delete；无内建衰减 | 自动为主 |
| Letta | Agent 主动改 memory blocks（可编辑）+ sleep-time 后台整理 | ✅ sleep-time 合并/整理 | △ 依赖 agent 判断 | △ 依赖 agent | 混合（agent 自主） |
| Cognee | `add` → `cognify` 抽取图；`memify` 迭代；`forget` 删除 | ✅ 图去重（实体解析）+ improve 反馈 | △ 无显式时效；有 `forget` 数据集级 | ✅ `forget` 显式遗忘 | 半自动 pipeline |
| MemOS | 统一 add/retrieve/edit/delete + 反馈纠正 | ✅ 智能去重（README 声明） | △ 反馈替换；无标准时效字段 | △ 反馈式纠正 | 混合 |
| EverOS | 自动/显式；Markdown 写入 + SQLite/LanceDB 索引 | △ 派生索引去重 | ❌ 未见时效模型 | △ 用户数据自管 | 混合 |
| official MCP memory | 显式工具调用 | △ 同名 entity 忽略/relations 去重；observations 可增删 | ❌ 无 | ❌ 无 | 全显式 |
| context-portal | 显式 MCP 工具写 item/relation | △ 结构化 item + 关系 | △ 有历史/进度字段（无自动失效） | ❌ 无 | 显式 |
| engram | 显式 save + 自动 sync | △ FTS5 检索 + 项目解析 | ❌ 无 | △ 有 review/诊断工具 | 混合 |

### 4.2 存储与检索（5 维）

| 项目 | 存储范式 | 检索（向量/BM25/图/全文） | 注入方式 | embedding 依赖 | 部署成本 |
|---|---|---|---|---|---|
| dsh-auto-memory | 纯 Markdown 文件 | ❌ 无向量；索引由模型在 prompt 里“读” | **常驻 system prompt 索引段（order 4000，4KB 硬预算）** | **无** | 极低（1 npm 包，0 外部服务） |
| memsearch | Markdown 源真相 + Milvus 影子索引 | ✅ dense + BM25 + RRF；三层层进（search→expand→transcript） | `agent/pre-step` step1 命中才注入；+ `memory-recall` skill | ✅ 可 openai/onnx 本地 bge-m3 等 | 中（Milvus Lite 本地 / Server / 云） |
| claude-mem | SQLite + Chroma（+ 可选导入 md note 目录） | ✅ FTS5 全文 + Chroma 向量；MCP 三层工具省 token | SessionStart 注入摘要 + MCP 工具按需检索（+ PreToolUse 拦截） | ✅ 需模型（默认可托管/自配 key） | 中高（worker 进程 + Bun + uv + 模型） |
| basic-memory | Markdown + SQLite 索引 | ✅ 语义向量 + 全文 + 图谱（observations/wikilinks） | MCP 工具按需调用 | ✅（可选本地/云） | 低中（Python+SQLite；向量可选 Milvus） |
| Serena memories | 纯 Markdown | ❌ 无检索（明确主张“引用优于搜索”，grep 足够） | **只注入名字列表**，正文由 agent 按需 read | 无 | 低（但 Serena 本体 GPL） |
| Graphiti | 图数据库 + 全文索引 | ✅ 语义+BM25+图遍历（hybrid） | MCP 工具（search facts/nodes/episodes） | ✅ LLM+embedding | 高（Neo4j/FalkorDB + LLM） |
| mem0 | 向量库（+可选图） | ✅ 语义+BM25+实体，RRF；时间推理 | SDK search → 应用拼进 prompt | ✅ | 中（托管更简单） |
| Letta | Postgres+pgvector（自托管）/ 云 | ✅ 核心记忆常驻 + archival 语义检索 | memory blocks 直接进上下文；archival 工具检索 | ✅ | 中高（服务+DB） |
| Cognee | 图+向量+chunks | ✅ 图/向量/代码图混合 | SDK 检索结果 → 应用拼 prompt | ✅（可全本地小模型） | 中高 |
| MemOS | SQLite / Neo4j+Qdrant / 云 | ✅ 混合检索（FTS5+vector） | DSH/Hermes 插件自动 recall | ✅ | 中（本地插件低） |
| EverOS | Markdown + SQLite + LanceDB | ✅ 检索（多 id 维度） | 插件注入 | ✅ | 中 |
| official MCP memory | JSONL 文件 | ❌ 仅 search_nodes 字符串匹配（无向量） | MCP 工具按需 | 无 | 极低 |
| context-portal | SQLite（每 workspace） | ✅ 向量语义检索（可选） | MCP 工具按需 | ✅ | 低 |
| engram | SQLite+FTS5 | ✅ 全文（FTS5）+ 项目解析 | MCP 工具按需 | 无（默认） | 极低（单二进制） |

### 4.3 作用域、可审计与工程（5 维）

| 项目 | 作用域 | 可编辑/可审计（明文/git/diff） | 多 agent 并发写 | DSH 原生 | License 作为底座 |
|---|---|---|---|---|---|
| dsh-auto-memory | project + user 双层，跨项目不串扰 | ✅ 纯 md，可 git/手改；`modified` 未实现但可加 | ✅ 跨进程文件锁（`dsh-atomic-write`）+ 原子写 | ✅ 官方形态 | ✅ MIT |
| memsearch | project 目录 `.memsearch/`（collection 按路径派生）+ 可全局 | ✅ Markdown 源真相，可 git；Milvus 可丢弃重建 | ✅ Milvus 并发；文件监听去抖 | ✅ 官方插件 | ✅ MIT |
| claude-mem | project（SDK session 的 project 字段）+ 团队 TeamBrain | △ SQLite 内可读但非 git 化；note bridge 可导入外部 md | ✅ worker 单写者 + WAL【推断：README 称 SQLite WAL】 | ✅ 官方插件 | ✅ Apache-2.0 |
| basic-memory | 多 project | ✅ Markdown 双向 + SQLite 派生 | △ SQLite 索引单机；云有 rclone 冲突解决 | ❌（MCP 可接） | ❌ AGPL-3.0（传染性，嵌入需评估） |
| Serena memories | project/global | ✅ 纯 md + 名字引用 + `serena memories check` 完整性检查 | ✅ 文件级（无锁，靠 git） | ❌（MCP 可接） | ❌ GPL-3.0（应用部分） |
| Graphiti | group_id（可项目/租户） | △ 图 DB 可查询但非文件 git 化 | ✅ 图 DB 并发 + 队列 | ❌（MCP 可接） | ✅ Apache-2.0 |
| mem0 | user/agent/run 多级 | △ DB/向量库为主；有 history 表 | ✅ 服务化 | ❌（MCP/SDK 可接） | ✅ Apache-2.0 |
| Letta | agent 级 | △ memory blocks 可编辑（API） | ✅ server | ❌ | ✅ Apache-2.0 |
| Cognee | dataset | △ 图+向量，非文件 | ✅ | ❌ | ✅ Apache-2.0 |
| MemOS | cube 组合 | △ 图可检查可编辑（README 强调） | ✅ | ✅ | ✅ Apache-2.0 |
| EverOS | user/agent/project/session 正交 id | ✅ Markdown 源真相 | ✅ SQLite/LanceDB | ✅（独立 plugins 仓库） | ✅ Apache-2.0 |
| official MCP memory | 实例级 | ✅ JSONL 明文 | ❌ 单文件写 | ❌（MCP 可接） | ✅ MIT |
| context-portal | workspace=项目 | △ SQLite | ✅（MCP 单进程） | ❌（MCP 可接） | ✅ Apache-2.0 |
| engram | project + Git Sync | △ SQLite（有导出块） | ✅ | ❌（MCP 可接） | ✅ MIT |

---


### 4.4 语言 / 云依赖（2 维，补充）

| 项目 | SDK / 实现语言 | 本地优先 or 云依赖 |
|---|---|---|
| dsh-auto-memory | TypeScript（DSH 插件） | **纯本地**，零外部服务 |
| memsearch | Python（CLI/SDK）+ TS/JS（各 harness 插件） | 本地优先（Milvus Lite）；可切 Server/云 |
| claude-mem | TypeScript（Node worker；SQLite/Chroma） | 本地 worker，但默认安装引导托管记忆（可 `--provider` 改本地） |
| basic-memory | Python（FastAPI/MCP/CLI） | 本地优先；可选云订阅（$15/mo） |
| Serena | Python | 纯本地（但本体 GPL） |
| Graphiti | Python | 自建图 DB（Neo4j/FalkorDB）；托管走 Zep Cloud |
| mem0 | Python + TypeScript SDK | SDK 本地 / 自托管 server / 云三档 |
| Letta | 历史 Python；当前 letta-code 为 TypeScript | 自托管 server 或云 |
| Cognee | Python | 本地/自托管 |
| MemOS | 本地插件/云插件（TS 生态）+ Python 内核 | 本地插件纯本地；亦有云 API |
| EverOS | Python + 宿主插件 | 本地优先（Markdown+SQLite+LanceDB） |
| official MCP memory | TypeScript（npm 包） | 纯本地 JSONL |
| context-portal | Python | 纯本地 SQLite |
| engram | Go（单二进制） | 本地优先；云可选 |
| byterover-cli | TypeScript | 本地 context tree + 云同步 |

> 说明：语言列以仓库 README/包结构为准；未逐字核对每个包的多语言 SDK 覆盖面（见 §8 未验证项）。

## 5. 重点项目实现细节（8 个深读）

> 每个项目都给出：存储 schema / 抽取与压缩 pipeline / 合并去重 / 检索排序 / 如何注入 prompt / DSH 相关性。
> 证据来自本次解包的仓库快照（codeload HEAD）与官方文档；链接见附录 A。

### 5.1 claude-mem（最成熟 + 已有 DSH 插件）

**定位**：面向 Claude Code（及 8+ harness）的“持久记忆压缩系统”，把 agent 的工具使用观察压缩成结构化记忆，未来会话可检索。

**捕获 pipeline**（【已证实：README + docs/public/architecture/hooks.mdx + native-harness-integrations.md】）
- 生命周期 hooks：SessionStart / UserPromptSubmit / PreToolUse / PostToolUse / Stop / SessionEnd；每个 hook 是一条 `claude-mem hook claude-code` 命令。
- DSH 路径不同：**监听 `~/.dsh/sessions` 的 transcript watcher**（`session/event` 的 `turn/end` 每 turn 汇总一次），并用 DSH 的真实 session-header ID；插件在 `agent/created` 时注入 checkout 上下文。
- 观察 → LLM（可托管/自带 OpenRouter/Gemini/Anthropic key）压缩为 observation，写 SQLite；Chroma 作为检索投影（“SQLite holds the current memory content; Chroma holds its search projection”，【已证实：search-architecture.mdx】）。

**存储 schema**（【已证实：docs/public/architecture/database.mdx】）
```sql
sdk_sessions(id, sdk_session_id, claude_session_id, project, prompt_counter, status, created_at_epoch, ...)
observations(id, session_id, sdk_session_id, project, prompt_number, tool_name, title, subtitle, narrative,
             text, facts, concepts, type, files_read, files_modified, created_at_epoch, ...)
session_summaries(id, sdk_session_id, project, prompt_number, request, investigated, learned,
                  completed, next_steps, notes, created_at_epoch, ...)
user_prompts(id, sdk_session_id, project, prompt_number, prompt_text, created_at_epoch, ...)
```
- DB 路径 `~/.claude-mem/claude-mem.db`，WAL 模式；FTS5 虚拟表做全文（`observations_fts`）。
- observation 类型：`decision` / `bugfix` / `feature` / `refactor` / `discovery` / `change`。
- **project 是表字段**（记忆按项目隔离）。

**合并/去重**：SQLite 为内容真源，Chroma 为投影；实时索引 + 启动回填共享“每 collection/记录类型/SQLite ID”的写者，做旧片段清理与检查点（【已证实：search-architecture.mdx】）。观察本身按时间序追加，语义去重主要发生在摘要/检索层（【推断】）。

**检索与注入**：
- MCP 4 工具三层工作流：`search`（紧凑索引，~50-100 tok/条）→ `timeline`（围绕锚点的时序上下文）→ `get_observations`（按 ID 取全文，~500-1000 tok/条），宣称 ~10x token 节省。
- 注入有两条：SessionStart 上下文（可配置数量/来源）+ 模型主动调 MCP 工具；另有 `PreToolUse` 文件上下文 hook 与 optional note bridge（监听 `.claude/memory`、Codex memory、配置的 note 目录，转为快照入库，不自动改源文件）。
- 渐进披露理念（progressive disclosure）与 3 层工作流是它最值得抄的设计。

**DSH 集成**（【已证实：docs/native-harness-integrations.md】）：`npx claude-mem install --ide dsh --dsh-profile web` → 用 DSH 自己的 `plugin --profile <name> add --workspace-root` 安装 `@claude-mem/dsh`；worker 运行时；插件等 `agent/created` 注入 checkout 上下文；工具 `mem_search / mem_timeline / mem_get_observations / mem_save / mem_context`；自动捕获由一个 managed watch 完成。**注意**：安装流程默认引导登录 claude-mem 账户（托管记忆 CMEM Pro，30 天试用），本地 provider 需显式选择（`--provider`、`CLAUDE_MEM_ONLINE_OPTIN=false`），这是“默认云依赖”的合规风险点（【已证实：README Quick Start】）。

### 5.2 memsearch（Markdown 源真相 + 影子索引，DSH 官方插件）

**定位**：“跨平台语义记忆”，5 个 harness 共用一份 Markdown 记忆 + 一个 Milvus 索引。

**设计哲学**（【已证实：docs/design-philosophy.md】）
- **Markdown 是唯一真相**；Milvus 是“shadow index”，丢了可以 `memsearch index` 全量重建。
- 布局刻意对齐 OpenClaw：`MEMORY.md`（+ `memory/YYYY-MM-DD.md`）；chunk id 格式 `hash(source:startLine:endLine:contentHash:model)` 完全一致。
- 混合检索：dense cosine + BM25 sparse（Milvus Function 自动生成）+ **RRF k=60** 融合；可选 cross-encoder/Jev reranker。
- 三层渐进披露：L1 search（snippet）→ L2 expand（整节）→ L3 transcript（原始对话）。

**存储 schema**（【已证实：docs/architecture.md】）
```text
Milvus collection `memsearch_chunks`:
  chunk_hash VARCHAR(64) PRIMARY KEY   -- 复合 SHA-256
  embedding FLOAT_VECTOR               -- dense
  content VARCHAR(65535)               -- 原文（BM25 来源）
  sparse_vector SPARSE_FLOAT_VECTOR    -- Milvus BM25 Function 自动生成
  source VARCHAR(1024), heading VARCHAR(1024), heading_level INT64,
  start_line INT64, end_line INT64
```

**抽取/分块 pipeline**（【已证实：docs/architecture.md】）
- Scanner 扫 `.md/.markdown` → 按 heading 分块（`#`~`######` 为自然边界，preamble 单独 chunk；超 `max_chunk_size`（默认 1500 字符）按段落再切，带 `overlap_lines`=2）→ SHA-256（16 hex）→ 复合 chunk id（source+行号+hash+模型名）→ 只有不存在的新 chunk 才 embed+upsert，消失的 chunk 删除。
- **没有外部缓存/没有 SQLite sidecar**：hash 就是主键，去重是存储键本身。
- 文件监听（1500ms debounce）自动重索引；compact 用 LLM 把 chunk 压成摘要写回 daily log，形成闭环。

**注入与 DSH**（【已证实：plugins/dsh/README.md】）
- 捕获：`session/event turn/end` → 渲染 turn → fire-and-forget 摘要（默认 `dsh-headless` 起一次性 DSH agent，或 `custom-llm`）→ 追加到 `.memsearch/memory/YYYY-MM-DD.md`，带 anchor `<!-- session:<id> turn:<N> db:<path> -->`；`captureExists` 幂等去重；串行化避免并发的总结调用重叠。
- 注入：`agent/pre-step` 第 1 步做有界检索，**只有命中才注入**（附 `[memsearch] Retrieved memory context attached.`），否则零成本；由模型自行判断相关性。
- 召回：注册 `memory-recall` skill（走 DSH 原生 skill 工具，search→expand→transcript）。
- 维护：`.memsearch/PROJECT.md`（活跃线程、决策、风险、下一步）+ `.memsearch/USER.md`（偏好/风格）+ 技能候选（`.memsearch/skill-candidates/`，**永不自动安装**），默认关闭、`min_interval_hours`=24。
- 配置分层：插件只暴露 capture/inject/summarize 开关；provider/Milvus/collection 来自 memsearch config（`~/.memsearch/config.toml`）。

**逐项对照 Claude**：Markdown 源真相 ✅、项目目录 ✅、可编辑可审计 ✅、渐进披露 ✅、语义检索（优于 Claude）✅、**索引常驻 + 正文按需的两段式 ❌**（它用检索替代索引）、每事实一文件 ❌（日志式）。**这是“最好用的检索层”，但不是“Claude 语义的复刻”。**

### 5.3 dsh-auto-memory（Claude auto-memory 的 DSH 1:1 克隆）

**定位**（README/design.md）：把 Claude Code 的 auto-memory 机制移植为 DSH 原生插件；明确“轻量、纯文件、无外部服务、无 embedding”，并与平台型记忆产品（OpenViking/MemOS/EverOS）差异化。

**数据模型**（【已证实：docs/design.md】）
```markdown
<!-- 单条记忆 = 一个 Markdown 文件 -->
---
name: short-kebab-case-slug
description: 一行摘要，用于召回相关性判断与索引展示
metadata:
  type: user | feedback | project | reference
---
正文：事实本身。feedback 类型必须跟 **Why:** 与 **How to apply:** 两行。
正文中用 [[other-name]] 链接相关记忆。
```
- 索引 = `MEMORY.md`：每条一行 `- [标题](文件名.md) — 一句话钩子`；**MEMORY.md 是唯一注入系统提示词的部分**。
- 分层：项目级 `$DSH_HOME/memory/<workspace-slug>/`（workspace-slug 由 session.cwd 派生）+ 用户级 `$DSH_HOME/memory/_user/`；合并注入，用户级在前，跨项目不串扰。

**注入策略**（【已证实：README + docs/design.md】）
1. `ctx.systemPrompt.section()` 注册 order 靠后的动态段，每次提示词组装时重读索引；**空存储注入 0 字节**；默认 `maxBytes=4096` 硬预算，超限按行截断（保留用户级）并留标记。
2. 紧随索引的“写入指导”指令段：何时写、写前读索引查重、按 description 匹配**更新而非堆积**、不写代码库/CLAUDE.md 已记录的内容。
3. 工具面：`memory_write(name, description, type, body, scope)` / `memory_read` / `memory_list` / `memory_delete`；写操作 = 跨进程文件锁 + 原子写 + 锁内全量重建索引。
4. 关键工程决策（对 DSH 插件开发极具参考价值）：文件 IO 走 `node:fs`（默认 fs-sandbox 可写根不含 `$DSH_HOME`）；并发用 `@deepseek-ai/dsh-atomic-write` 的 `withFileLock` + `writeFileAtomic`；**不写自定义 session event**（第三方事件类型会导致会话 resume fail-closed）；projectKey 算法照抄官方（与 `~/.dsh/sessions` 目录一致）；`{{ }}` 中和（strict interpolation 会炸）。
5. 自动能力：`autoSummarize`（会话结束后台 LLM 固化，默认关）、引用计数/时间衰减/description 失配检测（P1）、召回展开（[[链接]] 图展开）、Web UI 记忆面板、CLI（`--json`）。
6. 量化（README 自述，CI 确定性 eval）：索引注入 0→200 条记忆时 0B→2.3KB→3.2KB→4.0KB 封顶；空存储 0B；默认 4KB 预算下 ≥50 条即钉在 cap；压缩（compaction）不影响（动态 section 每步重评估）。

**与 Claude 的差异**（我们评估）：它是**语义最忠实**的实现：索引+按需文件、四类型、项目 scope、写入纪律、索引硬预算。但它明确“不做 embedding/向量检索”，召回依赖模型“看到索引后自己 read 文件”，在“事实多、问题模糊”时弱于语义检索；且没有 Claude 的“超限拒绝并重写索引”闭环。

**成熟度风险**：101★、单维护者、2026-10 才密集迭代（0.9.0）——适合作为**参考实现/骨架**，直接生产依赖需自行兜底（【推断】）。

### 5.4 basic-memory（Markdown ↔ SQLite 双向知识图谱，MCP 原生）

**定位**：本地优先的个人/团队知识库：Markdown 是权威，SQLite 是索引，AI 和人都改同一批文件；支持 Obsidian。

**存储/模型**（【已证实：README + docs/ARCHITECTURE.md + src/basic_memory/models/knowledge.py】）
- Markdown 文件 + frontmatter；正文里 `- [category] observation` 成为结构化观察；`[[wikilink]]` 成为关系（Relation）。
- SQLite 表：`entity`（title/permalink/...，【已证实】`__tablename__ = "entity"`）、`observation`、`relation`、`note_content` 等；索引 project 维度；搜索模型在 `models/search.py`。
- 观察/关系有专门 repository 层（`observation_repository.py`/`relation_repository.py`），支持增量生成。

**接口/同步**：MCP（stdio/https）为主，另有 FastAPI REST、Typer CLI；**双向同步**（人改文件 → 同步进索引；AI 走 MCP 写 → 同步生成文件）；Obsidian 直接打开同一目录即可。可选语义搜索（向量 + cross-encoder rerank，Postgres 部署可接 Milvus extra）。

**注入**：没有“自动注入”机制，靠 MCP 工具按需调用（`search`/`build_context` 等，工具带 read-only/destructive 行为提示，便于 agent 选择）。

**对 DSH**：MCP adapter 可用，但它不是 Host 插件；**AGPL-3.0** 对“嵌入 DSH 分发”是硬约束（AGPL 传染性），更适合“作为外部 MCP 服务”而非内嵌。与 Claude Project Memory 的共性是“Markdown 可编辑 + 项目级”，差异是“知识图谱 vs MEMORY.md 索引”。

### 5.5 Graphiti（双时态知识图谱，Zep 的开源图核心）

**定位**：为 AI agent 构建**实时、可增量更新**的时序知识图谱；不是“记忆文件系统”，而是“事实图谱引擎”。

**数据模型**（【已证实：README】）
| 概念 | 说明 |
|---|---|
| Entity nodes | 实体 |
| Facts/relationships (edges) | 三元组 + **temporal validity windows** |
| Episodes (provenance) | 原始输入（ground truth 流），每个派生事实可回溯到 episode |
| Communities | 实体聚类摘要 |

- **Bi-temporal**：显式 valid_at/invalid_at，自动失效旧事实并**保留历史**（“what's true now and what was true before”）。
- 增量摄取：Episode 入队 → LLM 抽取实体/边 → 去重合并 → 不重算全图。
- 后端：Neo4j / FalkorDB / Neptune / Kuzu（deprecated）+ 全文检索后端（Neo4j 用全文索引 / Neptune 需 OpenSearch）。
- MCP server：`mcp_server/` 提供 episode/entity/search/group 管理；**注意 README 明确“参考实现，无鉴权、无 prompt injection 防护，不要暴露到不可信网络”**（【已证实：mcp_server/README.md】）。

**注入**：MCP 工具（search facts/nodes/episodes）或 SDK 检索 → 应用自行拼 prompt。**没有“项目记忆文件”概念**，group_id 可当项目隔离。

**对 DSH**：作为“时间有效性/冲突解决”的**设计借鉴**极佳（Claude 只有 `modified` 时间戳）；作为底座成本高（图 DB + LLM + embedding），且无法满足“明文可编辑/可 git”。Zep 的社区版已转向云（见 §3.2），Graphiti 是其开源图核心。

### 5.6 mem0（最流行的 memory layer SDK）

**定位**：drop-in memory infrastructure（"The Memory Layer for AI Agents"），67,614★。

**抽取 pipeline（2026-04 新算法，【已证实：README】）**
- **Single-pass ADD-only extraction**：一次 LLM 调用抽取事实，**不再 UPDATE/DELETE**，记忆只累积不覆盖。
- Agent 生成的事实与用户事实同等权重；**实体抽取 + embedding + 跨记忆链接**用于检索加分。
- **多信号检索并行**：semantic + BM25 keyword + entity matching，融合排序；**Temporal Reasoning** 按时间感知排序。
- 官方基准：LoCoMo 92.5 / LongMemEval 94.4 / BEAM(1M) 64.1（托管平台口径，README 明确 OSS 用户“方向一致但数字不同”）。

**接口/存储**：Python/TS SDK；自托管 server（`cd server && make bootstrap`）；CLI + Agent Skills（`mem0 init --agent`）；云。存储为可插拔向量库 + 可选 graph + SQLite history。作用域 `user_id`/`agent_id`/`run_id`。

**对 DSH**：可以作为**自动抽取子系统**（尤其“ADD-only 简化了冲突处理”的取舍值得学习），但它没有“项目级 MEMORY.md 索引/按需文件”，也不明文可编辑；接 DSH 需 adapter（MCP/HTTP/SDK），不适合直接当 Host 插件骨架。

### 5.7 Letta（MemGPT 后继：memory blocks + sleep-time）

**定位**：stateful agent 平台，agent 能“重写自己的记忆/技能/prompt”（Letta Code）。

**记忆模型**（【已证实：letta README + letta-code README】）
- **Memory blocks**：常驻上下文、可直接编辑的核心记忆（相当于“人工+agent 都可改的常驻段”）。
- **Recall / archival memory**：对话历史与长期档案，按需语义检索（pgvector）。
- **Sleep-time agents**：后台 agent 在空闲时整理/合并记忆（对应 Claude 没有的“自动维护”）。
- **迁移提示**：`letta-ai/letta` 为历史源码，活跃在 `letta-ai/letta-code`（3.7k★，Apache-2.0）——**选型别抓旧 repo**。

**对 Claude 的映射**：memory blocks ≈ CLAUDE.md 段（常驻、可编辑）；archival ≈ topic files（按需）；sleep-time ≈ 自动 consolidation。但它是**agent 平台**，不是“项目容器”的一部分；接 DSH 成本高，且记忆在服务端 DB（非文件源真相）。

### 5.8 Cognee（可组合的 memory pipeline / 图+向量）

**定位**：开源 AI memory 平台，把文档/代码/对话变成自托管知识图谱。

**核心**（【已证实：README】）
- 操作面：`add` → `cognify`（抽取知识图谱+embedding）→ `search`；`improve`（反馈/会话知识回灌）；`forget`（删除 item/dataset）；`memify`（迭代式记忆优化）。
- 抽取：默认可用本地 GLiNER（小模型）+ 本地 embedding（无需 API key）；生产版更准（README 说 demo vs licensed）。
- 存储：默认本地文件+向量；**单 Postgres 可跑 PGVector + 图（demo 特性，生产版 licensed）**；也支持 Neo4j/Kuzu 等。
- 检索：图 + 向量 + 代码图混合，返回可检查的证据。

**对 DSH**：作为“pipeline 设计参考”（memify/forget/improve 生命周期）很好；作为底座重（Python 服务 + DB + 模型），且无项目文件语义。

### 5.9 其他值得点名（简评，未深读）

- **EverOS**（13,556★，Apache-2.0）：Markdown 源真相 + 本地 SQLite + LanceDB；**user/agent 双轨**、project_id/app_id 正交检索、Knowledge Wiki；有 DSH 插件（独立 repo）。工程哲学与 memsearch 接近，但更偏“个人记忆 + 知识 wiki”，且插件实现未抓（见 §8）。
- **MemOS**（12,019★）：MemCube + 图/向量 + 反馈纠正；**官方 DSH local/cloud plugin**（本地插件 100% 本地 SQLite + FTS5+vector + Memory Viewer），是“平台型”方案里 DSH 支持最明确的。
- **Serena memories**（30,592★）：最“反检索”的设计宣言——只注入记忆**名字列表**，正文由 agent 按 `mem:` 引用决定读；明确论证了“数据库记忆/单文件 AGENTS.md/自动注入”为何被排除。**它对 Claude 语义的“渐进披露 + 显式读取”还原度很高，但无索引文件、无自动写入。**
- **context-portal**（767★）：最接近“Project = 项目记记忆容器”的 MCP 方案：每 workspace 一个 SQLite，显式建模 decisions/progress/architecture + 关系 + 向量。可作为“结构化项目记忆”的 schema 参考。
- **官方 MCP memory**（KG）：最小实现，JSONL + entities/relations/observations，MIT，零依赖；适合做“项目记忆的最小可审计格式”起点，但无项目 scope、无自动抽取。
- **engram**（7,521★，MIT）：Go 单二进制 + SQLite FTS5，项目感知 + Git Sync，MCP/HTTP/CLI；部署成本最低的“可共享项目记忆”之一。
- **memU / Supermemory / Memobase**：偏“user 级个性化/profile”，与“项目级团队记忆”目标错位；Supermemory 的 profile 与遗忘机制可借鉴。
- **memory-bank 类**：本质是“人维护的 Markdown 文件集 + 约定”，无运行时；但证明了“文件即记忆”在编码 agent 场景的生命力（centminmod 2,675★）。
- **byterover-cli（原 Cipher）**：context tree + Git-like 版本控制（branch/commit/merge），是“记忆可版本化”的独特设计；**Elastic License 2.0，不可随意内嵌分发**。

---

## 6. 与 Claude Project Memory 语义逐条对照

> 左列为目标语义（均出自【已证实：https://code.claude.com/docs/en/memory】，除注明外）；中间为最接近的开源实现；右列为差距结论。

| # | Claude Project Memory 语义 | 最接近的开源实现 | 差距 / 结论 |
|---|---|---|---|
| 1 | **索引 + 按需文件**：`MEMORY.md` 每行一条，topic 文件启动不载入、按需读 | **dsh-auto-memory**（MEMORY.md + one file per memory，唯一注入索引）；**Serena**（只注入名字列表，正文按需） | 语义几乎完全覆盖；但两者都**没有语义检索**兜底。memsearch 有语义检索但缺“索引常驻+按需文件”的两段式。**没有任何项目同时具备两者。** |
| 2 | **指令与记忆分离**：CLAUDE.md（人写指令，每次载入）vs auto memory（Claude 写学习） | **dsh-auto-memory**：只有记忆层，指令层交给 DSH 现有 AGENTS.md/CLAUDE.md 机制（README 明确“不写代码库/CLAUDE.md 已记录内容”） | 单插件不负责指令层；若要完整复刻，需要 DSH 侧同时提供“项目指令文件”加载（DSH 已有 AGENTS.md 支持？【推断】需 DSH 侧确认）。 |
| 3 | **项目级 scope**：`~/.claude/projects/<project>/memory/`，`<project>` 由 git repo 派生，**同 repo 所有 worktree/子目录共享**，机器本地 | **dsh-auto-memory**：`$DSH_HOME/memory/<workspace-slug>/`，slug 由 `session.cwd` 派生（照抄官方 projectKey，与 `~/.dsh/sessions` 一致）+ `_user` 层 | 按 cwd 派生**不是按 git repo**：同一 repo 的不同子目录/不同 clone 可能得到不同记忆目录（【推断】由 design.md “workspace-slug 由 session.cwd 派生”推得）。这是最值得补的一条。 |
| 4 | **四类记忆**：`user` / `feedback` / `project` / `reference`，且 `feedback` 必须说明为什么/怎么用 | **dsh-auto-memory**：完全一致（含 feedback 的 Why:/How to apply: 要求） | 无差距（它就是按 Claude 文档复刻的）。其他方案几乎没有该分类体系。 |
| 5 | **索引硬预算**：只载前 200 行/25KB；超限**写入成功但报错要求重写索引** | **dsh-auto-memory**：4KB 字节预算 + 截断标记 | 有预算、无“超限治理闭环”；截断是静默的（有标记但不是模型可感知的“必须重写”错误）。 |
| 6 | **可编辑 / 可审计**：明文 Markdown、可人改、可 git、写后记录 `modified` ISO 时间 | **dsh-auto-memory / memsearch / Serena / EverOS / basic-memory** 都是文件源真相 | Claude 的 `modified` 语义（自动写 frontmatter）**没有实现**；memsearch 日志文件可 git 但无“每事实 modified”。DB 型方案（mem0/Graphiti/Letta/官方 KG/claude-mem）则不满足“明文可审计”。 |
| 7 | **线程共享**：所有会话（含 subagent 默认不共享、fork 例外）读同一项目记忆；记忆不属于某个 session | **dsh-auto-memory**（按 workspace）+ **memsearch**（`.memsearch/` 项目目录）+ **claude-mem**（project 字段） | 三者都做到“会话间共享”。差异：Claude 的共享边界是 **git repo**；开源多为“目录/项目字段”。claude-mem 默认还多一个可选的 TeamBrain 团队共享（超出 Claude 语义）。 |
| 8 | **写入纪律**：跳过代码库可推导的内容、跳过 CLAUDE.md 已写内容、不每会话都写、更新优于堆积 | **dsh-auto-memory**（写前查重 + 更新而非堆积 + 明确写什么）；**mem0**（ADD-only 简化冲突）；**Graphiti**（失效而非堆积） | 三种策略互斥：Claude 要“更新/合并”，mem0 选择“只增不覆盖”，Graphiti 选择“失效保留历史”。**没有项目把“更新 + 失效历史 + 索引治理”三者统一。** |
| 9 | **机器本地**：不跨机同步；清理会话不清理记忆 | **dsh-auto-memory**（本地文件）；**memsearch**（本地 Markdown，Milvus 本地可选）；**claude-mem**（本地 SQLite，云同步可选） | 基本一致；差异在“云同步是否默认”。claude-mem 默认引导托管账户（合规需评估），memsearch/DSH 方案默认本地。 |

### 6.1 逐条对照的总结

- **语义覆盖度最高**：`dsh-auto-memory`（第 1/2/4/5/6/7/8/9 条都答对，缺 3 的 git 派生与 5 的治理闭环）。
- **检索能力最强**：`memsearch`（语义+BM25+RRF、渐进披露、跨 harness），但它答的是“检索问题”，不是“Claude 语义”。
- **自动捕获最成熟**：`claude-mem`（102k★ 生态验证 + 已有 DSH 插件），但数据模型偏离“明文项目事实文件”。
- **结论：Claude Project Memory 不是“一个记忆库”，而是“指令系统 + 索引文件系统 + 少量自动学习 + 语义兜底”的组合。开源生态把它拆成了不同项目，所以不存在单一完美替代。**

---

## 7. 对 DSH 的建议（复用 / 借鉴 / 推荐组合）

### 7.1 可直接复用（Host 插件 / adapter）

| 候选 | 接入方式 | 复用什么 | 前置约束 | 建议 |
|---|---|---|---|---|
| **dsh-auto-memory** | DSH 原生插件（`dsh plugin add`，Cordis insert） | MEMORY.md 索引 + 每事实文件 + 四类型 + 双层 scope + systemPrompt 注入 + 原子写/文件锁 | MIT ✅；101★ 单维护者；无 embedding | **作为语义骨架首选**：可直接用，或 fork 后补 §6 差距（git 派生 scope、超限治理、语义兜底、modified 字段） |
| **memsearch（@zilliz/memsearch-dsh）** | DSH 原生插件（npm 包 + `dsh.bundle.patch`） | Markdown 源真相 + Milvus 影子索引 + capture/inject/recall/maintenance + 跨 harness 共享 | MIT ✅；Milvus Lite/embedding 依赖；摘要需 DSH headless 或 LLM key | **作为检索层首选**：与骨架层叠加（见 7.3-B） |
| **claude-mem（@claude-mem/dsh）** | DSH 原生插件（installer 写 profile + transcript watch） | 自动捕获/压缩 + SQLite/FTS5/Chroma + MCP 三层工具 + progressive disclosure + Web viewer | Apache-2.0 ✅；worker/Bun/uv 重；**默认引导托管账户**（合规评估） | 若目标是“零干预自动记忆 + 已有生态”，用它做捕获层；若要“明文项目真相”，只借鉴其三层检索/渐进披露 |
| **MemOS local plugin** | DSH 原生插件（本地/云两版） | SQLite+FTS5+vector 本地记忆 + Memory Viewer + 反馈纠正 | Apache-2.0 ✅；文档以 OpenClaw/Hermes 为主，DSH 细节需验证 | 备选：平台型方案里 DSH 支持最明确 |
| **basic-memory** | MCP adapter（外部服务） | Markdown↔SQLite 知识图谱 + 双向同步 + Obsidian 兼容 | **AGPL-3.0**（内嵌分发风险）；需 Python | 适合“用户已有 Obsidian/知识库”场景，不宜内嵌 |
| **官方 MCP memory（KG）** | MCP adapter | entities/relations/observations 最小可审计格式 | MIT ✅；无 project scope、无自动抽取 | 可作为 Library/Project 图谱的**数据格式参考** |
| **engram / mcp-memory-service / context-portal** | MCP adapter | 低部署成本（单二进制/SQLite）或 workspace=项目的结构化记忆 | MIT/Apache-2.0 ✅ | context-portal 的“workspace=项目”schema 值得抄；engram 适合做 CLI 伴生 |

### 7.2 只借鉴设计（不要直接内嵌）

| 项目 | 借鉴什么 | 为什么只借鉴 |
|---|---|---|
| **Graphiti** | **bi-temporal**（valid_at/invalid_at、失效保留历史）、episode provenance、增量图更新、group_id 隔离 | 图 DB + LLM 成本高；无明文文件；Zep 社区版已转向云 |
| **mem0** | 单次 ADD-only 抽取的**成本取舍**、实体链接、多信号检索融合（语义+BM25+实体）、时间推理排序 | 无项目索引/明文真相；托管倾向 |
| **Letta** | memory blocks（常驻可编辑段）；**sleep-time 后台 consolidation** | agent 平台而非项目容器；DB 存储；旧 repo 已归档 |
| **Cognee** | `add→cognify→memify→forget` 的记忆生命周期；图+向量混合检索；本地小模型可跑 | 服务重；无文件语义 |
| **Serena** | **只注入名字列表 + agent 显式读取**的渐进披露论证；`mem:` 引用与完整性检查；project/global 双 scope | GPL-3.0（应用部分）；无自动写入；无索引文件 |
| **claude-mem** | 三层检索（search→timeline→get_observations）的 token 经济学；progressive disclosure；note-folder bridge（把外部 md 目录增量导入） | 数据模型与目标不符、worker 重 |
| **basic-memory** | Markdown 双向同步的冲突处理；observation/wikilink → 图的 schema | AGPL；MCP 外部服务 |
| **context-portal** | 项目级结构化 item（decision/progress/architecture）+ 关系 + workspace 隔离 | 无自动捕获/无索引语义 |
| **memory-bank 类** | “文件约定 + 人机共写”的极简范式（无需运行时） | 无机制、全靠 prompt 自觉 |

### 7.3 推荐组合（3 套，按目标选）

#### 组合 A（推荐主路线）：Claude 语义骨架 + 语义索引层（Markdown 源真相）

```
DSH Host 插件（自研，~1 个 Cordis 包）
├── 记忆层（骨架，复刻 Claude auto memory）
│   ├── MEMORY.md 索引（常驻 systemPrompt.section，默认 4KB 硬预算，空则 0B）
│   ├── 每事实一文件（frontmatter: name/description/type/modified/valid_at/superseded_by）
│   ├── project scope = git repo 派生（不是 cwd）→ 同 repo worktree 共享；+ user scope
│   ├── 工具：memory_write / memory_read / memory_list / memory_delete / memory_search
│   └── 写入纪律段（查重→更新而非堆积；跳过代码可推导/CLAUDE.md 已写；feedback 带 Why/How）
├── 检索层（借鉴 memsearch 路线，可选依赖）
│   ├── Markdown 分块 + SHA-256 内容寻址 → 本地向量索引（Milvus Lite / sqlite-vec / 或先不装）
│   ├── 混合检索：dense + BM25 + RRF；三层渐进披露（索引行→文件→会话 transcript）
│   └── 只做“按需召回”，不做自动注入决策（由模型显式调 memory_search / skill）
├── 治理层
│   ├── 索引超限 → 写入成功但返回“必须重写索引”的错误（复刻 Claude 行为）
│   └── 失效而非删除：valid_to + superseded_by（借鉴 Graphiti），保留可 git 的历史
└── 指令层（复用 DSH 现有 AGENTS.md/项目指令机制，与记忆层显式分离）
```

- **为什么是它**：唯一能同时满足 §6 九条语义的组合；Markdown 源真相保证可审计/git/人改；检索层是**可选增强**（不装也能工作，装了更好）；对 DSH 而言是 Host 插件原生形态，不引入外部服务为必需依赖。
- **落地优先级**：P0 = 骨架（可先 fork `dsh-auto-memory`，MIT，省掉 80% 的注入/锁/工具细节）；P1 = git 派生 scope + 超限治理 + modified；P2 = 可选语义索引（可复用 `memsearch` 的 indexer 组件或直接并列安装 `@zilliz/memsearch-dsh`）。

#### 组合 B（最快见效）：直接叠加两个现有 DSH 插件

```
dsh-auto-memory（MEMORY.md 语义 + 注入）
        +
@zilliz/memsearch-dsh（自动捕获 + 语义检索 + PROJECT.md/USER.md）
        +
（可选）@claude-mem/dsh 只用于“历史 observation 时间线”/跨 harness（合规则先关托管账户）
```

- **优点**：两个项目都是 MIT、都是 DSH 原生插件、都活跃；几乎零开发即可得到“索引常驻 + 语义检索 + 自动捕获”。
- **风险**：两者都会写项目记忆，**写入路径重叠**（双写、索引与日志不一致）；需要在 Host/patch 层做**单一写者**（例如 memsearch 只做 capture/索引、dsh-auto-memory 只做索引/事实文件，或反过来）。
- **判断**：适合做**原型/验证**，不适合长期双写并存。

#### 组合 C（自动捕获优先，接受托管/重依赖）：claude-mem 为捕获层 + Markdown 投影

```
@claude-mem/dsh（捕获 + observation 压缩 + 三层检索）
        ↓ 定期投影（自研小脚本/插件）
MEMORY.md 索引 + memory/*.md（项目可 git 的“人类可读投影”）
```

- **优点**：自动捕获/压缩是三者里最成熟的；102k★ 生态、Apache-2.0；已有 DSH 官方集成；三层检索省 token。
- **代价**：worker/Bun/uv 运行时重；SQLite/Chroma 仍是主真相（投影可能滞后/丢信息）；默认托管账户需改成本地 provider（`--provider`/`CLAUDE_MEM_ONLINE_OPTIN=false`）。
- **判断**：若产品目标是“用户零配置自动记忆”（而非“可审计的项目记忆文件”），这是最省力路线；否则选 A。

### 7.4 为什么没有单一项目能“完美替代”

1. **目标本身是二元系统**：Claude Project Memory = 指令（人写、CLAUDE.md）+ 记忆（AI 写、MEMORY.md+topic）+ 索引/按需注入。开源项目几乎都只占其中一格；同时做两层的只有 dsh-auto-memory（且指令层外包给 host 的 AGENTS.md/CLAUDE.md 机制）。
2. **自动捕获 vs 可审计明文**是结构性矛盾：DB/向量/图方案（claude-mem、mem0、Graphiti、Letta、官方 KG）自动但不可 git；文件方案（dsh-auto-memory、Serena、memsearch、EverOS、basic-memory）可审计但捕获/检索要额外做。Claude 用“AI 写 Markdown”恰好避开矛盾，但**它的自动写入是 Claude 模型行为，不是 harness 引擎**——复刻它需要一个“愿意按纪律写文件的模型+工具面”，这正是 dsh-auto-memory 在做的。
3. **索引 vs 检索**是另一组矛盾：索引常驻省 token 但弱召回（Claude 的选择）；语义检索强但需要 embedding/索引服务且注入时机复杂（memsearch/claude-mem 的选择）。两者叠加需要“索引层 + 可选检索层”的双层设计，现有项目各自只做一层。
4. **项目 scope 的语义在开源里没有标准**：git repo 派生 + worktree 共享 + 机器本地是 Claude 特定的产品决策；通用 SDK（mem0/Graphiti/Letta）用 user/agent/group 抽象，不会为“git worktree”写特例。**这条只能自研。**
5. **许可证与商业模式过滤掉了“最像的”项目**：basic-memory AGPL、Serena GPL、byterover ELv2——即使语义接近也不能作为 Host 插件内嵌；而 Apache/MIT 的头部项目（mem0/Graphiti/Letta/claude-mem/MemOS）都更偏“平台/服务”。**可内嵌 + 语义接近的交集，目前只有 dsh-auto-memory / memsearch / EverOS 这几家。**
6. **生态重心正在漂移**：Zep→Graphiti+云、Letta→letta-code、OpenMemory→会话迁移 CLI、basic-memory→云订阅；这些都说明“记忆”仍是快速演化赛道，**押注单一项目风险高，分层解耦（骨架/检索/捕获各自可换）更稳**。

### 7.5 给 DSH Host 插件的接口清单（从现有插件反推，已证实）

- **注入**：`ctx.systemPrompt.section({ order, ... })` 动态段，每步重评估（dsh-auto-memory 用 order 4000；空内容不注入）。【已证实：dsh-auto-memory docs/design.md】
- **事件**：捕获用 `session/event`（`turn/end`）；注入用 `agent/pre-step` 第 1 步；`agent/created` 做初始化；`session/disposed` + 定时器做维护。【已证实：memsearch plugins/dsh/README.md】
- **工具**：`ctx.tools` 注册 `memory_*`（写/读/列/删/搜），走标准 `tool/call`/`tool/result` 审计。【已证实：dsh-auto-memory】
- **Skill**：`ctx.skills.register('memory-recall')` 供 `skill` 工具按需调用。【已证实：memsearch dsh README】
- **文件安全**：`$DSH_HOME` 不在默认 fs-sandbox 可写根内 → 用 `node:fs` + `@deepseek-ai/dsh-atomic-write`（`withFileLock`/`writeFileAtomic`）。【已证实：dsh-auto-memory design.md】
- **打包**：`package.json` 声明 `dsh.bundle.patch` + `cordis.patch.yml` 的 `insert: [{ id, name }]`；`dsh plugin --profile <p> add <pkg>` 安装。【已证实：memsearch cordis.patch.yml + README】
- **红线**：不要写自定义 session event 类型（会让会话 resume fail-closed）；内存内容要中和 `{{ }}`（strict interpolation）。【已证实：dsh-auto-memory design.md】
- 另可参考 `docs/native-harness-integrations.md`（claude-mem）如何用 managed watch 监听 `~/.dsh/sessions`、如何用 `DSH_MEM_BASE_URL`/`baseUrl` 指向远端 worker。

---

## 8. 未验证项、风险与不编造声明

**已尽力验证但仍有缺口（不编造）：**

1. **`raw.githubusercontent.com` 不可用**是本机环境限制；本报告所有“源码级”结论来自 codeload 解包 + jsdelivr 单文件 + GitHub API，**没有**用 raw 链接。若引用 raw 链接仅为读者方便，不作为证据。
2. **Memori**：`GibsonAI/memori` 抓取时返回 301，新位置为 [MemoriLabs/Memori](https://github.com/MemoriLabs/Memori)（旧仓库源码快照已解包，LICENSE=Apache-2.0；star≈17k 为 shields.io 约数，非 GitHub API 精确值），本报告只按 README 摘要提及，**未对其实现细节做源码级结论**。
3. **EverOS 的 DSH 插件实现未抓**：DSH 插件在 `EverMind-AI/plugins/tree/main/dsh`，本次未解包该仓库；仅确认 README 声明存在。
4. **MemOS 本地 DSH 插件的具体安装命令/包名未逐字核对**：README 给了 plugin 表格与 News，但 DSH 安装细节需以 docs 为准。
5. **claude-mem 的 DSH 自动捕获边界**：文档说 managed watch + `turn/end` 每次总结 + 插件在 `agent/created` 注入；**未实测**其在 DSH 0.2.x 的行为，且其安装默认引导托管账户，合规需产品侧评估。
6. **worktree 共享语义**：Claude 官方文档明确按 git repo 派生；`dsh-auto-memory` 按 `session.cwd` 派生 workspace-slug（design.md 明说），二者的差异是本报告**推断**（未在 DSH 源码验证 `projectKey` 是否等同 git 派生）。
7. **star 数**来自 2026-10-22 抓取；Lett、Zep、OpenMemory 等仓库语义近期变更，选型前需重新核对仓库当前状态。
8. **性能/基准数字**均转述 README 自述（mem0 LoCoMo/LongMemEval、memsearch 无基准、claude-mem 无公开基准），**未独立复现**。
9. **本报告不推荐任何项目作为“完美替代”**；§7 的组合是设计建议，落地前需 PoC（尤其是 DSH 版本兼容：dsh-auto-memory 要求 `@deepseek-ai/dsh >= 0.1.5-rc.2`，memsearch 要求 Node >= 22.19）。

---

## 附录 A：证据 URL 清单

### A.1 权威语义（Claude 侧）

- Claude Code 官方记忆文档（CLAUDE.md vs auto memory、MEMORY.md 结构、200 行/25KB、四类型、`autoMemoryDirectory`）：https://code.claude.com/docs/en/memory
- 同文档 Markdown 源（本次实际抓取正文）：https://code.claude.com/docs/en/memory.md
- Claude Code 仓库（生态/文档/plugin）：https://github.com/anthropics/claude-code

### A.2 三个重点候选

- dsh-auto-memory：https://github.com/AskTheWay/dsh-auto-memory
  - 设计文档（数据模型/注入/工程决策）：https://cdn.jsdelivr.net/gh/AskTheWay/dsh-auto-memory@HEAD/docs/design.md
  - 中文 README：https://github.com/AskTheWay/dsh-auto-memory/blob/main/README.zh.md
- memsearch：https://github.com/zilliztech/memsearch
  - 架构（存储 schema/chunk/去重）：https://cdn.jsdelivr.net/gh/zilliztech/memsearch@HEAD/docs/architecture.md
  - 设计哲学（Markdown 源真相/渐进披露/OpenClaw 兼容）：https://cdn.jsdelivr.net/gh/zilliztech/memsearch@HEAD/docs/design-philosophy.md
  - DSH 插件：https://cdn.jsdelivr.net/gh/zilliztech/memsearch@HEAD/plugins/dsh/README.md
  - Cordis patch：https://cdn.jsdelivr.net/gh/zilliztech/memsearch@HEAD/plugins/dsh/cordis.patch.yml
- claude-mem：https://github.com/thedotmack/claude-mem
  - DSH/Pi 原生集成：https://cdn.jsdelivr.net/gh/thedotmack/claude-mem@HEAD/docs/native-harness-integrations.md
  - 数据库 schema：https://cdn.jsdelivr.net/gh/thedotmack/claude-mem@HEAD/docs/public/architecture/database.mdx
  - 搜索架构：https://cdn.jsdelivr.net/gh/thedotmack/claude-mem@HEAD/docs/public/architecture/search-architecture.mdx
  - 原生记忆桥：https://cdn.jsdelivr.net/gh/thedotmack/claude-mem@HEAD/docs/native-memory-bridge.md

### A.3 其他重点

- basic-memory：https://github.com/basicmachines-co/basic-memory ；架构：https://cdn.jsdelivr.net/gh/basicmachines-co/basic-memory@HEAD/docs/ARCHITECTURE.md
- Graphiti：https://github.com/getzep/graphiti ；MCP server：https://cdn.jsdelivr.net/gh/getzep/graphiti@HEAD/mcp_server/README.md
- mem0：https://github.com/mem0ai/mem0 ；OpenMemory 归档说明：https://cdn.jsdelivr.net/gh/mem0ai/openmemory@HEAD/openmemory-archive/README.md
- Letta：历史源码 https://github.com/letta-ai/letta ；当前源码 https://github.com/letta-ai/letta-code
- Cognee：https://github.com/topoteretes/cognee
- Serena memories 文档：https://cdn.jsdelivr.net/gh/oraios/serena@HEAD/docs/02-usage/045_memories.md
- 官方 memory MCP server：https://github.com/modelcontextprotocol/servers/tree/main/src/memory（README：https://cdn.jsdelivr.net/gh/modelcontextprotocol/servers@HEAD/src/memory/README.md）
- context-portal：https://github.com/GreatScottyMac/context-portal
- MemOS：https://github.com/MemTensor/MemOS
- EverOS：https://github.com/EverMind-AI/EverOS（DSH 插件：https://github.com/EverMind-AI/plugins/tree/main/dsh）
- memU：https://github.com/NevaMind-AI/memU
- engram：https://github.com/Gentleman-Programming/engram
- byterover（原 Cipher）：https://github.com/campfirein/byterover-cli
- mcp-memory-service：https://github.com/doobidoo/mcp-memory-service
- AGENTS.md：https://github.com/agentsmd/agents.md
- memory-bank 代表：https://github.com/centminmod/my-claude-code-setup ；https://github.com/hudrazine/claude-code-memory-bank
- A-MEM：https://github.com/agiresearch/A-mem ；MemoryOS：https://github.com/BAI-LAB/MemoryOS ；LangMem：https://github.com/langchain-ai/langmem ；Memobase：https://github.com/memodb-io/memobase ；Supermemory：https://github.com/supermemoryai/supermemory

## 附录 B：数据文件与复现命令

### B.1 元数据证据

`research/github-memory/data/repo-metadata.csv` —— 30 行，字段：`repo, url, stars, license, pushed_at, created_at, archived, lang, desc, source`。
抓取时间 2026-10-22；`source` 列区分 `api.github.com/repos`（精确接口）与 `search API`（发现接口，差 1 小时内可能微变）。

### B.2 复现（本机可用通道）

```bash
# 1) 精确元数据（注意未认证 60 次/小时、全队共享，请节流）
curl -s -H 'Accept: application/vnd.github+json' \
  https://api.github.com/repos/thedotmack/claude-mem | jq '{full_name,stargazers_count,license:.license.spdx_id,pushed_at,description}'

# 2) 发现
curl -s 'https://api.github.com/search/repositories?q=memory+bank+claude+code&sort=stars&order=desc&per_page=20' \
  | jq -r '.items[] | [.full_name,.stargazers_count,(.license.spdx_id // "none"),.pushed_at] | @tsv'

# 3) README/文档单文件（raw.githubusercontent.com 在本机被拦，用 jsdelivr）
curl -sL https://cdn.jsdelivr.net/gh/zilliztech/memsearch@HEAD/plugins/dsh/README.md

# 4) 整仓源码快照（深读用；不进入交付目录）
curl -sL https://codeload.github.com/zilliztech/memsearch/tar.gz/HEAD -o /tmp/memsearch.tgz
tar -xzf /tmp/memsearch.tgz -C /tmp/
```

### B.3 本次解包深读的仓库（27 个）

basic-memory、claude-mem（只列 md + tree）、serena、modelcontextprotocol/servers、mcp-memory-service、graphiti、zep、cognee、mem0、letta、MemOS、A-mem、MemoryOS、langmem、memori、memobase、memU、supermemory、cipher→byterover、memsearch、context-portal、anthropics/claude-code、agents.md、cline、mem0ai/openmemory、dsh-auto-memory、EverOS、engram、centminmod/my-claude-code-setup。

---

*本报告完成于 2026-10-22；所有 star/license/时间均为该时刻快照。未经验证的信息已在 §8 单独列出，未做推测性填充。*
