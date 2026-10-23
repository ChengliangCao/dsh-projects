# Claude / Claude Code「Projects（项目）模式」规格调研

> 调研目标：用户（中文）想了解 Claude / Claude Code 的「project 模式」。他的理解是——**开启后有一个主 Coordinator，负责统筹、给每个任务开线程；线程里可以询问和做事，做完后关闭线程；还有 Library 存储上传的数据**。本文给出一份全面、准确、有出处的规格调研，并区分哪些是「本质能力」、哪些只是 Claude 的实现细节。
>
> 调研时间：2026-10-22（Asia/Shanghai）。Claude Projects 仍处于 **public beta** 且分批放量，所有"可用性/入口/限额"结论都有时效性，引用时请保留日期。

## 目录

- [0. 一页结论（TL;DR）](#0-一页结论tldr)
- [1. 先分清三个同名「Projects」](#1-先分清三个同名projects)
- [2. Claude Code Projects：定位、可用性与创建](#2-claude-code-projects定位可用性与创建)
- [3. Coordinator（项目对话）](#3-coordinator项目对话)
- [4. Thread（线程）](#4-thread线程)
- [5. Overview 面板](#5-overview-面板)
- [6. Library](#6-library)
- [7. 项目级配置与治理](#7-项目级配置与治理)
- [8. 用量与计费](#8-用量与计费)
- [9. 与邻近概念的边界](#9-与邻近概念的边界)
- [10. 用户原话逐条核对](#10-用户原话逐条核对)
- [11. 功能清单表](#11-功能清单表)
- [12. 对 DSH 的启示](#12-对-dsh-的启示)
- [13. 未证实 / 待验证 / 抓取失败清单](#13-未证实--待验证--抓取失败清单)
- [14. 来源编号与引用说明](#14-来源编号与引用说明)

### 证据分级约定

| 标记 | 含义 |
| :- | :- |
| 【已证实】 | 官方文档 / 官方帮助中心 / 官方博客原文直接支持（给出短引 + 来源） |
| 【已证实·转引】 | 官方博客正文直接抓取被截断，引文来自第三方逐字摘录页，可靠但属转引 |
| 【旁证】 | 第三方媒体/笔记，仅用于交叉验证时间、背景，不作为规格依据 |
| 【推断】 | 基于官方文档的合理推理，官方没有直接这样写 |
| 【未证实】 | 官方文档未提及，或页面抓取失败无法确认；**不是**"不存在" |

来源编号 `[S1]`–`[S17]` 见文末与 [sources.md](sources.md)。

---

## 0. 一页结论（TL;DR）

### 0.1 用户理解的核对

| 用户的理解 | 判定 | 更精确的说法 |
| :- | :- | :- |
| 开启后有一个主 Coordinator | ✅ 基本正确 | 创建项目后，**项目对话（project conversation）**里就是 Claude 作为 coordinator；设置里确有 **Coordinator model / Coordinator effort**。但它不是另起一个"总 agent"，而是这个长期会话的角色。[S1] |
| 负责统筹、给每个任务开线程 | ✅ 正确 | Claude 决定每条消息"就地回答 / 交给已有线程 / 新开线程 / 先给出 Suggested threads"。多个不相关任务会拆成多个线程。[S1] |
| 线程里可以询问和做事 | ✅ 正确 | 线程是**完整会话**（默认是 cloud session），可执行代码、开 PR；用户可在线程内看 transcript、发消息 steer、回答权限提示、Stop。[S1] |
| 做完后关闭线程 | ⚠️ 半对 | 准确概念是 **Resolved（收尾）**，不是删除：可由用户手动、由 Claude 在最后一步完成后（如 PR 合并）、或一周无活动自动 Resolved；可 reopen。分支和 PR 仍留在 GitHub。[S1] |
| Library 存储上传的数据 | ✅ 大体正确 | Library 同时存**用户上传的文件/文件夹/Google Drive 文件夹**和**线程产出的文件**；线程以 `/mnt/project-files` 读取；上传是**拷贝**，改本地文件不会同步，需重新上传并 **Replace**。[S1] |
| 以为这是 claude.ai 旧版 Projects 的升级 | ⚠️ 需要区分 | Claude Code Projects（协调会话 + 线程 + Library）与 claude.ai 旧 Projects（聊天文件夹 + project knowledge + instructions）是**两个东西**；旧版会逐步迁移到新体验，但目前分开存在。[S1][S11][S12] |
| 以为 CLI 也能用 | ❌ 不对 | 入口只有 claude.ai/code、桌面端 Code tab、Claude 手机 App；**CLI / VS Code 插件 / JetBrains 插件不支持**，Amazon Bedrock / Google Cloud Agent Platform / Microsoft Foundry 也不支持。[S1] |

### 0.2 五条最重要结论

1. **Claude Code Projects = 一个长期协调会话 + 若干独立线程（cloud session）+ 共享 Library / memory / instructions**。它解决的是"一串相关任务、跨天、机器可关"的编排问题，不是单次任务的并行。[S1]
2. **Coordinator 是"会话角色"而非独立 agent**：它只看到线程汇报的结果（"sees what threads report back, not every step they take"），负责路由、跟踪、汇总、写 memory；**它本身没有 connectors**，需要 MCP 的任务必须派给线程。[S1]
3. **线程是完整 cloud session**（或经 Remote Control 跑在用户电脑上的会话），自带独立 context、独立 branch，PR 可开、auto-fix 默认开；仓库的 `.claude/settings.json`（权限、hooks、MCP、插件、env）**不会**被线程加载。[S1]
4. **协调层靠"指令 + memory + 自动压缩"而不是人工管上下文**：instructions 每次注入（≤16,000 字符），memory 以 `MEMORY.md` 索引 + 按需打开文件，线程/会话都自动压缩。[S1]
5. **它是 pre-GA 的分批 beta**：Pro/Max、public beta、Team/Enterprise 未开放；计费并入 plan limits 但没有独立 VM 费用；唯一硬性并发限制是 **200 个新线程/天**，"你要求的线程上限只是偏好不是硬上限"。[S1][S4][S14/S15]

---

## 1. 先分清三个同名「Projects」

这是整个调研最容易踩坑的地方。**"Projects" 至少有三个不同的东西**，用户说的"Coordinator + 线程 + Library"只对应第一个。

### 1.1 Claude Code Projects（新）——用户所指的东西

【已证实】一句话定义：

> "A project is one ongoing conversation where Claude coordinates a stream of related work for you. You tell it what needs doing and it starts a thread for each task."
> —— Claude Code 文档 [S1](https://code.claude.com/docs/en/claude-projects)

核心特征：项目对话 = coordinator；任务 = threads（通常每个是一个 cloud session）；共享 repositories / instructions / memory / Library；Overview 面板统一看状态。

### 1.2 claude.ai / Desktop / Cowork 的「旧版 Projects」——文件夹式工作区

【已证实】旧版定义：

> "Projects allow you to create self-contained workspaces with their own chat histories and knowledge bases. Within each project, you can upload documents, provide context, and have focused chats with Claude."
> —— Claude Help Center [S11](https://support.claude.com/en/articles/9517075-what-are-projects)

旧版要点（来自 [S11] 与 [S12](https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects)）：

- **入口**：claude.ai 网页 / claude.ai/projects；Claude Desktop；Claude 手机 App。
- **内容**：project knowledge（上传文档/文本/代码）、project instructions（行为设定）、项目内多段聊天。**聊天之间不共享上下文**，除非内容进入 knowledge base。
- **套餐**：所有用户可用，**免费用户最多 5 个项目**；RAG 扩展容量仅付费套餐（Pro/Max/Team/Enterprise）。
- **分享**：Team/Enterprise 可分享（Can view / Can edit）、组织内公开、管理员可关闭分享；Pro/Max/Free 不分享。
- **memory**：每个项目有自己的 memory（可关闭 project 内"Use account memory"）；聊天可移入/移出项目。
- **生命周期**：可 star、archive（归档后不可直接删除，需先 unarchive）、delete。
- **没有** Coordinator、没有线程、没有 Library（它叫 project knowledge）。

### 1.3 Claude Cowork 的 Projects——第三种「工作区」

【已证实】Cowork Projects 是"把相关任务归到专属工作区"，有自己的 files/context/instructions/memory/scheduled tasks：

> "Projects in Claude Cowork let you group related tasks into dedicated workspaces with their own files, context, instructions, and memory."
> —— Claude Help Center [S13](https://support.claude.com/en/articles/14116274-organize-your-tasks-with-projects-in-claude-cowork)

它与 Claude Code Projects 的区别：Cowork Projects 是**工作区+任务**（不是协调会话+线程）；帮助中心该页（抓取时更新于一周前）甚至仍写着 "Projects are only available in Cowork, not in Claude Code. Support for Claude Code is planned for a future update."——这句话已被 Claude Code Projects 的发布**部分过期**，说明新旧文档并存，引用时务必区分页面。[S13]

### 1.4 三者的关系与迁移

【已证实】新版是"从文件夹到对话"的重设计，先从 Claude Code 放量，再扩到 chat/Cowork/Team/Enterprise：

> "A new version of projects is now available in beta, rolling out in stages starting with Claude Code. We've started moving existing projects for some Pro and Max users to the new version."
> —— Claude Help Center [S11](https://support.claude.com/en/articles/9517075-what-are-projects)

迁移承诺：旧项目的 instructions、files、完整聊天历史、scheduled tasks 一起迁入新版本，"Nothing is lost or deleted"；使用过旧项目的 Pro/Max 用户会先收到邮件；其他 chat/Cowork 项目暂时保留旧版。[S11]

> 注意：Claude Code 文档说的是"从未用过 claude.ai chat/Cowork 项目的账号优先放量"，而帮助中心说"部分已有项目用户已被迁移"。两者是**不同批次策略**的描述差异，不矛盾，但说明 rollout 规则在动态调整。[S1][S11]

---

## 2. Claude Code Projects：定位、可用性与创建

### 2.1 它是什么 / 何时该用

【已证实】官方定位：把一串相关工作交给一个对话，Claude 把它们跑成共享 repositories、instructions、memory 的并行 cloud sessions。[S1]

文档给出的适用场景（原文要点）：

- **一个目标跨多个仓库**：如"把每个服务升到新 lint 配置"，每个仓库一个线程 + 各自 PR，Overview 看哪些可 review。
- **持续投喂的领域**：bug、stack trace、review request 随发生粘进对话；一个修复里学到的坑进入 project memory。
- **比单会话大的 build/migration**：任务拆成多个线程，早期决策通过 memory 传到后面的线程。
- **非代码工作**：合同、工单导出等资料上传，线程产出写成文件放到 Library。

什么时候**不**用项目（原文要点）：单个任务用 cloud session；每个任务都必须用本机环境（本地 DB、模拟器、VPN 后的 API）用本地会话或 agent view；纯定时无对话用 cloud scheduled task；多人 Slack 协作看 Claude Tag。[S1]

### 2.2 可用性、套餐、入口、不可用面【已证实】

> "Projects are in public beta on Pro and Max plans and rolling out gradually, starting with accounts that have used cloud sessions and don't have existing projects in claude.ai chat or Cowork. They aren't available on Team or Enterprise plans yet."
> —— [S1](https://code.claude.com/docs/en/claude-projects)

- **套餐**：Pro / Max，public beta，分批放量；Team / Enterprise 暂不可用；等不到可进 waitlist（claude.com/form/projects）。
- **入口**（创建与使用）：
  - 浏览器 [claude.ai/code](https://claude.ai/code)（左侧 **Projects**；也可直达 claude.ai/code/projects/browse）
  - Claude Desktop 的 **Code** tab
  - Claude 手机 App（iOS / Android）
- **明确不支持**：终端 CLI、VS Code 扩展、JetBrains 插件；Amazon Bedrock、Google Cloud Agent Platform、Microsoft Foundry（即第三方模型 provider 场景）。[S1]
- **模型 provider**：线程内部始终是 Anthropic 作为 provider。[S1]
- **Desktop/Mobile 差异**：桌面端有系统通知（Claude 在对话发帖、线程报错、线程需要输入）；浏览器只靠 Overview 按钮上的小圆点提示；手机端可看线程、steer、创建/使用项目（详细功能对齐程度文档未逐一列出——【未证实】）。[S1]

> 【旁证】发布节奏：官方博客页面元数据显示 **Date: September 17, 2026**，标题 "Projects redesigned: from folder to conversation"，副标题 "A new experience for Claude projects, now available in beta in Claude Code"；第三方报道称 Anthropic 于 9 月 17 日（周四）发布 beta。[S14][S16]

### 2.3 创建项目的两条路径【已证实】

1. **From scratch**：New project 对话框 → 填 Name（必填）、Goal（可选，一行目标）、Context（可选：GitHub repos + files/folders/Google Drive folders）→ Create project。
2. **From an existing cloud session**：会话菜单选 **Continue as project**（新建以会话命名的项目，Claude 读会话后发 Setup recommendations；原会话保留，若正在跑会继续跑，需自己 stop）或 **Move to project**（把会话工作带进已有项目，发一条消息让 Claude 接着做；原会话不变）。
   - 本机 local session **没有**这两个选项；只能在项目对话里描述工作，或 push 分支、把 repo 加进项目后再点名分支。

**前置条件（GitHub）**：代码必须在 github.com（不支持 GHES/GitLab/Bitbucket 作为项目仓库）；联网的 GitHub 账号对该仓库有 push 权限；**必须在仓库上安装 Claude GitHub App**（用 `/web-setup` 连接的 token 只够其他 cloud sessions，项目线程不够）。GitHub org 上的 App 只能 org owner 批准；若 org 强制 SAML SSO，还需重新连接并授权。[S1][S4]

**第一次 turn / Setup recommendations**：创建后的第一个项目，Claude 会主动走一个 turn（消耗 plan 用量），可能：起一个只读仓库探索线程并提出下一步；或基于你最近 cloud sessions 发 **Setup recommendations**（要加的 repos、要建的 scheduled tasks、可开的线程），推荐默认全部开启，可关掉后再点 **Update setup**。[S1]

### 2.4 组成结构

```
你
└─ 项目（Project）：目标/指令/记忆/repos/文件/云环境/插件/用量
   ├─ 项目对话（Coordinator conversation，长期会话）
   │   ├─ 就地回答
   │   ├─ 新线程 / 复用已有线程
   │   └─ Suggested threads（建议列表，逐个或一键全开）
   ├─ Threads（每个 = 独立会话，默认 cloud session，或 Remote Control 本机会话）
   │   ├─ 独立 context / 独立 branch / PR / auto-fix
   │   └─ 可再派 subagents / workflows
   ├─ Library（上传物 + 线程产出物）
   ├─ Pull requests（线程开的 PR）
   ├─ Scheduled tasks（项目内定时任务，以线程形式跑）
   └─ Overview（Threads 六状态分组 + 上述 tab）
```

（结构依据 [S1] "How a project is organized" 与 Overview/settings 描述。）

---

## 3. Coordinator（项目对话）

### 3.1 它是什么会话【已证实】

> "The project conversation: one long-running session where Claude acts as coordinator. It takes what you send, decides what becomes a thread, and keeps track of every thread it started. It sees what threads report back, not every step they take."
> —— [S1](https://code.claude.com/docs/en/claude-projects)

- 它是**一个长期会话**，不是每次新建；项目活得越久它越久。
- 有独立的 **Coordinator model / Coordinator effort** 设置（见 3.4）。
- **没有 connectors**：项目对话本身不能调用 MCP；需要 connector 的任务要发成线程。
- 有"Claude hasn't responded"恢复机制：横幅出现时点 **Restart Claude**（或 Project settings > General > Restart），会重连对话，丢失正在写的回复，不影响线程。[S1]

### 3.2 职责清单【已证实】

| 职责 | 具体行为 |
| :- | :- |
| 路由每条消息 | 就地回答 / 新线程 / 交给已经在做这块的线程 / 先给建议线程；并告诉用户分发到哪里 |
| 建线程并登记 | 每个新线程在用户消息下显示为卡片（标题 + 状态），点开即线程 |
| 跟踪所有线程 | "keeps track of every thread it started"，维护项目内线程清单 |
| 读取线程汇报 | 只看线程 report back 的结果，不看每一步；也能按用户要求逐个读线程后汇总（troubleshooting 示例："For every open thread, list what you asked it to do, what it assumed or couldn't reach, and what it's waiting on"） |
| 汇总/汇报 | 可要求 "Give me a status update on every thread"、"Post shorter updates"、"Only post when something finishes or is blocked" |
| 维护 memory | 用户说"记住/忘掉"某要求、决策、坑；Claude 也会**自己**把偏好（如线程数上限、检查频率）写进 project memory 并在后续线程遵守 |
| 项目初始化 | 首次 turn 探索 repo、发 Setup recommendations |
| 管理 scheduled work | 用户要求定时工作时，创建 cloud scheduled task，出现在 Scheduled tasks tab |

### 3.3 何时自己回答 vs 开线程【已证实】

文档原文规则：

- "A quick question usually gets an answer in the conversation."
- "New work goes to a new thread or to a thread already working in that area, and Claude tells you which."
- "Several unrelated tasks in one message become separate threads."
- "Sometimes Claude proposes threads instead of starting them, in a **Suggested threads** list. Click the arrow on a suggestion to start that thread. When several are listed, a button under the list starts all of them."

**Suggested threads vs 直接开线程**：Claude 可以判断"这件事值得做但先征求同意"，于是列建议线程；用户点箭头逐个启动，或一键全启。也可以直接对 Claude 说 "Propose threads and wait for my go-ahead before starting them" / "Start these now without asking me to confirm" 来调策略。

**用户可纠正路由**：文档明确"If Claude routes something differently than you wanted, say so"，并给出可用指令：

- "Run at most two threads at a time" / "Reuse an existing thread for follow-ups in the same area"
- "Post shorter updates" / "Only post when something finishes or is blocked"
- "Do this task with a smaller model"
- "Don't open a pull request until I've seen the plan"
- "Tell me what's wrong in these repositories and don't fix anything yet"
- "Answer that here instead of starting a thread"

这些偏好**会被 Claude 自己存进 project memory 并在之后遵守**；但它们是"Claude 遵守的指令"，不是强制设置——线程数上限尤其如此（见 8.5）。要精确措辞且对每个线程生效，应写进 **project instructions**。[S1]

### 3.4 模型与 effort【已证实】

- 在 **Project settings > General** 设置：
  - **Coordinator model / Coordinator effort**：项目对话用的模型与 effort。
  - **Thread model / Thread effort**：线程用的模型与 effort；单任务可在任务里点名模型，运行中的线程可用线程自己的模型选择器。
- **新项目默认**："A new project runs Opus everywhere, with high effort for threads and low effort for the conversation." 文档提醒：线程默认值"draws on your plan fastest"。
- 按线程单独调 effort 的 UI：文档只写了设置里的 Thread effort，**未见按单线程调整 effort 的说明（未证实）**。

### 3.5 上下文如何不爆（自动压缩 + memory）【已证实】

> "You don't manage context windows in a project. Threads compact automatically, and the conversation works from recent messages, recent threads, and project memory rather than its full history, so it keeps going for as long as the project runs. Put anything that must never be dropped in project memory."
> —— [S1](https://code.claude.com/docs/en/claude-projects)

- **线程**：各自独立 context，自动 compact；爆了会显示 "Claude ran out of context on this turn"；若提示说线程会在新会话继续，则自动继续，否则让 Claude 在项目对话里为剩余工作开新线程。[S1]
- **项目对话**：不依赖全量历史，而是 recent messages + recent threads + project memory。
- **Cloud session 的压缩机制**：cloud sessions 会自行设置 `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`，在 auto-compact window 未满时提前压缩；该值覆盖用户在环境变量里设的值。[S4]
- **人工干预手段**：`/compact`、`/context` 在 cloud session 可用（`/clear` 不可用，需新开会话）。[S4]

### 3.6 Coordinator 的边界（重要）

【推断】官方没有把 coordinator 描述成一个"拥有完整工具集的超级 agent"：

- 文档只说明它"读汇报、决定分发、跟踪、维护 memory"；它**没有 connectors**（明确），**没有独立的工具清单文档**（未证实）。
- 它不能代替线程做执行：需要 connector、需要跑代码、需要开 PR 的工作都在线程里。
- 它能看到线程汇报，但不能"接管"线程的 transcript——用户要干预时**直接在线程里发消息**，在项目对话里说"go ahead"不会传进等待审批的线程。[S1]

> 对 DSH 的启示：把"协调者"建模成**有状态的路由/台账/记忆服务 + 一个对话界面**，比建模成"一个权力更大的 agent"更贴近 Claude 的实际设计（见 §12）。

---

## 4. Thread（线程）

### 4.1 本质：一个完整会话，默认在云端【已证实】

> "Threads: the workers. Each is a separate session with its own context window that does one piece of work and reports back to the conversation when it finishes. A cloud thread works on its own branch and opens a pull request when the work calls for one."
> —— [S1](https://code.claude.com/docs/en/claude-projects)

- 默认 = **cloud session**（Anthropic 托管的隔离 VM），关掉笔记本仍继续跑。
- 特殊情况 = **跑在用户电脑上的会话**（经 Remote Control）；电脑休眠则暂停，`claude remote-control`/桌面 App 退出则停止。
- 线程内部仍可再派 subagents、workflows、loops（文档说线程可进一步拆分工作）。
- 线程**不加载**用户本机 Claude Code 环境的任何东西（"Cloud threads don't pick up anything from the Claude Code setup on your own machine"）。[S1]

### 4.2 每个云线程启动时带什么【已证实】

| 会带上 | 不会带上 |
| :- | :- |
| 项目的 repositories 和 files（`/mnt/project-files`）；project instructions；project memory | 仓库的 `.claude/settings.json`（权限规则、hooks、env）、`.mcp.json`、`.claude/skills/`、`.claude/` 下的 agents/commands |
| 每个仓库根的 `CLAUDE.md`、`.claude/CLAUDE.md`、`.claude/rules/`（子目录 CLAUDE.md 和 path-specific rules 不加载） | 本机用户/项目 settings（包括 CLI 全局配置） |
| 用户 claude.ai 账号上的 connectors、启用账号级 skills | 仓库里声明的 MCP servers（要连接器）、插件（要 Project settings > Plugins） |
| 项目 cloud environment（网络、env vars、network secrets、setup script） | 本机已安装工具（要装进 setup script；本机线程除外） |

【已证实】文档明确："Cloud threads load each repository's CLAUDE.md instructions but not its skills, `.mcp.json` servers, or `.claude/settings.json`, whether the project has one repository or several." [S1]

【已证实】例外：**跑在你自己电脑上的线程**用本机文件、工具、MCP servers、hooks、权限规则；"Starts with the project's instructions, but not with its memory files loaded."（只带 instructions，不带 memory 文件）[S1]

### 4.3 并行、独立分支/PR【已证实】

- 多个线程**并行**运行；数量无固定值（见 8.5）。
- 云线程默认行为（除非任务/instructions 另有要求）：
  - 从仓库**默认分支**拉新 branch；
  - 用户要求时开 PR；对 bug fix 等具体改动也可自行开 PR；
  - 开 PR 后**默认开启 auto-fix**（即使其他 cloud sessions 没开）：CI 失败推修复、回应 review comments、检查通过后在 thread 里回复"ready"。
- 写同一段代码的线程之间的冲突，**不特殊处理**：按普通 PR merge conflict 解决（官方博客原话：overlap is resolved as a merge conflict just like any other PR）。[S14/S15]

### 4.4 用户如何交互（看/steer/批准/停）【已证实】

打开方式：点对话里的线程卡片，或 Overview 里的行 → 在 Overview 面板打开该线程 transcript。

在线程里可以：

- **读 transcript**：逐步看 Claude 做了什么。
- **Steer**：在线程自己的消息框发消息，直接到该线程；**在项目对话里发 follow-up 只有被 Claude 匹配到该线程时才会到达它**。
- **回答权限提示**：prompt 在线程内部，线程会等待；在项目对话里说"go ahead"不会传过去。"Each approval covers that prompt, or the rest of that thread if you choose the broader option."
- **Stop / Esc**：线程工作时发送按钮变为 **Stop**，或按 Esc 中断。
- **权限模型**：线程在模型支持时跑 **auto mode**，多数工具调用不打扰用户；cloud threads **不读取**仓库 `.claude/settings.json` 的 permission rules，因此只能依赖 auto mode + 线程内逐次批准。[S1]

线程卡片上可能出现的 PR 操作按钮（点击即把对应指令作为"你的消息"发给线程）：**Resolve conflicts、Fix CI、Address comments、Merge it**；**Review PR**（在 GitHub 打开 PR）；**Create PR**（idle 线程已 push 分支但没开 PR 时，直接由该分支建 PR）。[S1]

### 4.5 线程生命周期与 Resolved 规则【已证实】

Overview 的 Threads 分组（详见 §5）：Ready for review / Waiting on you / Working / Landing / Idle / Resolved。

> "**Resolved**: Threads marked done: by you from the thread's menu, by Claude once you've taken the last step, such as merging its pull request, or automatically after a week with no activity. You can reopen one from the same menu."
> —— [S1](https://code.claude.com/docs/en/claude-projects)

要点：

- **"关闭线程"= Resolved**，不是删除；线程仍可 reopen。
- Resolved 的触发有三类：用户手动、Claude 判断最后一步已完成（如 PR 合并）、**一周无活动自动**。
- Resolve 不影响 GitHub：文档在 troubleshooting 里明确 "Its branch and any pull request stay on GitHub until you delete them."（分支/PR 还在，直到你去删）。
- 线程卡住时用户可"mark resolved / 告诉它该怎么做"，其 branch/PR 同样保留。

### 4.6 失败、卡住、限额的行为【已证实】

| 现象/错误 | 行为与处理 |
| :- | :- |
| **Thread looks stuck** | Claude 不逐步播报，所以"显示 running 但对话没新消息"通常仍在工作；新云线程要先 provisioning cloud environment，首次更新有延迟。点开线程看 transcript；若在等权限提示则在线程里答。 |
| **Waiting on you** | 包含需要回复/批准或**失败**的线程。 |
| **Threads guessed or stalled** | 多个线程都"猜"或"blocked"，通常是项目配置缺口（instructions/environment）；先让 Claude 列出每个线程"要做什么、假设/够不到什么、在等什么"，再修正 instructions/env，然后先发一个线程验证，再发其余。 |
| **Claude hasn't responded** | 项目对话横幅 → Restart Claude；丢失正在写的回复，线程不受影响。 |
| **Repository access errors** | 三类：App 未安装/被 suspend/未绑定账号；clone 失败/仓库名不对/分支不存在；保存仓库时提示 "Claude can't access"。按提示 Install GitHub App / Select repositories / Check again。 |
| **Service is busy（usage limit）** | 线程/对话达到 5 小时或周限额时**自动重试并等待**，恢复后继续；显示 "Claude is still retrying and will continue automatically." 可点 Stop 或 pause 项目；**由 scheduled task 启动的线程不等待**——turn 直接以 limit error 停止，限额重置后需用户再发消息。 |
| **Additional usage credits required** | 请求只有 usage credits 才能覆盖、且账号没开 credits 时出现；开通后再发消息重试。 |
| **Claude ran out of context on this turn** | 线程 context 满；若提示在新会话继续则自动继续，否则让 Claude 在项目对话开新线程做剩余工作。 |
| **Reached the turn limit** | 达到 `CLAUDE_CODE_MAX_TURNS` 的 agentic turn 上限；发消息继续，或调整/移除该环境变量。 |
| **Lost contact with your folder**（本机线程） | 电脑睡眠、桌面 App/`claude remote-control` 退出；唤醒并重启连接。 |
| **"Couldn't start in <folder>" / "Claude is out of date on your device"** | 本机线程启动失败或 Claude Code 低于 **v2.1.280**；升级后重试。 |
| **"The project's environment was removed"** | 在 Project settings > Environment 换环境；只影响新线程。 |

另外，**云线程 sandbox 会在 turn 之间暂停、继续时恢复；若无法恢复则从全新 clone 继续，未提交的改动可能丢失**——长任务要请 Claude 中途 commit & push。[S1]

### 4.7 本机线程（Remote Control）细节【已证实】

- 触发：项目对话里 **+ 菜单 → Work locally**（消息标 **Local**），或消息里说明要在自己电脑跑。
- 前提：电脑上 Claude Code **≥ v2.1.280**；桌面 App 打开 **Settings > Claude Code > Use this computer from your phone and claude.ai** 并把文件夹加入列表，或终端在文件夹里跑 `claude remote-control`（git 仓库可加 `--spawn worktree` 给每个线程独立 worktree）。
- 项目会发 **"Allow Claude to work in a folder on your device"** 卡片：选文件夹（可开 **Worktree** 避免同文件夹两线程互相覆盖），点 **Allow once**。
- 行为差异：用本机文件/工具/MCP/settings/hooks/权限规则；带 project instructions 但**不带 memory 文件**；只在电脑醒着且 RC 开着时运行；默认 auto mode，auto mode 不可用时权限提示在线程里等。
- 账号限制：**Require trusted devices** 开启时，项目不能在本机跑线程。[S1][S7]

---

## 5. Overview 面板

### 5.1 Threads 六分组【已证实】

> "The **Overview** pane beside the conversation tracks the project's threads. It's already open the first time you open a new project. The **Overview** button in the project header closes and reopens it, and shows a dot when a thread is waiting on you."
> —— [S1](https://code.claude.com/docs/en/claude-projects)

| 分组 | 含义 |
| :- | :- |
| **Ready for review** | PR 已开、等待 review 的线程 |
| **Waiting on you** | 需要你回复/批准，或已失败的线程 |
| **Working** | 仍在运行 |
| **Landing** | PR 已批准或排队合并 |
| **Idle** | 已结束且没在等任何事 |
| **Resolved** | 已收尾：你手动 mark、Claude 在最后一步完成后（如合并 PR）、或一周无活动自动；可从同一菜单 reopen |

**状态如何流转**（【推断】基于分组定义与文档行为）：新线程 → Working →（有 PR）Ready for review →（批准）Landing →（合并后 Claude 收尾）Resolved；无 PR 的线程 → Idle → 一周后或手动 → Resolved；需要回复/批准/失败 → Waiting on you；用户 Stop 后通常进入 Idle/Waiting 的语义由实际状态决定（文档未逐条列出状态机，标注为推断）。

### 5.2 其他 tab【已证实】

- **Library**：你添加的文件/文件夹 + 线程产出的文件。
- **Pull requests**：线程开过 PR 后才出现。
- **Scheduled tasks**：Claude 从这个项目建的 cloud scheduled tasks。

### 5.3 注意力路由（容易被忽略）

- Overview 按钮上的**小圆点** = 有线程在等你（浏览器端的主要提示）。
- 桌面端另有系统通知：Claude 在项目对话发帖、线程报错、线程需要输入时通知；可在项目 sidebar 菜单 **Notifications** 里额外开启"每个线程完成 turn 也通知"或关闭。[S1]
- **线程 transcript 没有 cloud session 的 share 选项**（项目单用户、无线程分享）。[S1]

---

## 6. Library

### 6.1 数据形态【已证实】

- 用户添加的：**文件**、**文件夹**、**Google Drive 文件夹**（在 New project 对话框的 Context 字段，或项目创建后在 Overview > Library 点 **Add**）。
- 线程产出的文件：线程写出的文件也会出现在 Library。
- 线程读取路径：项目文件/文件夹通过 **`/mnt/project-files`** 暴露给云线程。
- Library 是项目级的"资料库 + 产出物索引"，不是 git 仓库，也不是 CLAUDE.md/instructions 的替代品。

### 6.2 限额【已证实】

| 场景 | 限额 |
| :- | :- |
| Library tab 一次选取 | 最多 **100 个文件、2 GB**；单文件最大 **480 MB** |
| New project 对话框 | **>30 MB 的文件会被跳过**（所以大文件应在项目创建后从 Library 添加） |
| 文件夹（两种入口都一样） | 只拷贝**前 100 个文件、最多 200 MB**；**不含 >30 MB 文件、隐藏文件、`node_modules`** |
| 文件夹总数 | 一个项目最多 **10 个文件夹 + Google Drive 文件夹**（单个文件不计入此限制） |
| 项目总量配额 | 【未证实】文档未给出项目级总容量/总文件数上限 |

### 6.3 拷贝与 Replace 语义【已证实】

> "Changes after upload: uploads are copies, so a change you make on your computer afterward doesn't reach the project until you upload the file again and choose **Replace** when asked about the existing name."
> —— [S1](https://code.claude.com/docs/en/claude-projects)

- **上传 = 快照拷贝**，不是挂载/同步。
- 更新同名文件时系统会问是否 **Replace**。
- 线程产出物是另一类数据，不通过上传进入 Library。

### 6.4 与仓库文件、CLAUDE.md、instructions、memory 的区别

| 机制 | 存什么 | 谁读 | 位置/入口 |
| :- | :- | :- | :- |
| **Library（项目文件）** | 上传的文档/数据/文件夹 + 线程产出文件 | 每个云线程（`/mnt/project-files`），按需读 | Overview > Library / New project Context |
| **Repositories** | 代码仓库（clone 到每个线程 sandbox） | 每个云线程 clone；README/CLAUDE.md 等 | Project settings > Environment |
| **CLAUDE.md（仓库内）** | 某个仓库的构建/约定 | 每个云线程启动时读仓库根的 `CLAUDE.md`、`.claude/CLAUDE.md`、`.claude/rules/` | 在各 repo 内 |
| **Project instructions** | 跨线程的"简报"（≤16,000 字符） | 每个新线程 + 项目对话 | Project settings > Memory > Project instructions |
| **Project memory** | Claude 自己维护的项目记忆（文件，`MEMORY.md` 索引） | 每个云线程启动读索引、按需打开其他文件；项目对话也用 | Project settings > Memory |

【已证实】文档建议：关于**某个仓库**的规则写进该仓库的 `CLAUDE.md`；**项目级**的笔记写进 project memory；brief 性质的规则写进 project instructions。[S1]

---

## 7. 项目级配置与治理

### 7.1 设置总表【已证实】

> 项目设置在 claude.ai/code 或桌面端改，**不在 `settings.json` 里**。入口：项目 sidebar 菜单的 **Settings**，或项目 header 的齿轮。
> "Changes to instructions, repositories, plugins, and environment in Project settings reach new threads, not threads already running." [S1]

| 设置 | 位置 | 作用 |
| :- | :- | :- |
| Name / icon / goal | General | 项目名、图标、一行目标 |
| **Coordinator model / effort** | General | 项目对话的模型与 effort |
| **Thread model / effort** | General | 线程的模型与 effort |
| **Project instructions** | Memory | 每个新线程收到的常驻规则（≤16,000 字符） |
| Project repositories | Environment | 新云线程 clone 的仓库 |
| Cloud environment | Environment | 网络、env、secret、setup script |
| Plugins | Plugins | 加载进每个新云线程的插件 |
| Usage | Usage | 按线程/模型的 token 用量 |
| Memory | Memory | 项目的 memory 文件 |
| Restart Claude | General | 对话无响应时重启 |
| Pause / Archive / Delete | General | 生命周期（见 7.6） |

### 7.2 Project instructions【已证实】

- 每个新线程的"brief"，也发给项目对话；**上限 16,000 字符**。
- 官方建议覆盖：项目目的；工作在哪（repos、从哪个分支起、PR 如何命名）；线程如何自检才算完成；缺东西时怎么办；哪些需要先获批。
- 官方示例要点：从 main 开 draft PR、每个线程一个 PR；完成前跑 `make test`/`make lint` 并贴摘要；拿不到 repo/secret/API/connector 时在第一条消息里说明并停，不要 substitute/mock/guess；未经同意不 merge/force-push/改 CI。
- 修改只影响**新线程**，不影响已运行线程。

### 7.3 Project memory【已证实】

> "Project memory: Notes Claude keeps about the project, such as requirements, decisions, and pitfalls, stored as files. Every cloud thread reads the index file `MEMORY.md` when it starts and opens the other files when it needs them."
> —— [S1](https://code.claude.com/docs/en/claude-projects)

- **怎么产生**：在项目对话或任一云线程里让 Claude "记住/忘掉"某要求、决策、坑；Claude 也会**自己**把偏好（线程数、汇报频率等）写入 memory。
- **存什么**：需求、决策、坑、工作习惯（例：发布改到周五、为什么砍掉 export、碰 billing service 前找谁确认——来自官方博客）。[S14/S15]
- **怎么管理**：Project settings > Memory 可读、编辑、删除文件；列表标注为 **Auto memory**（因为 Claude 自己写）。
- **与其他 memory 的区别**：与**本机 auto memory**（`~/.claude` 那套，虽然也用 `MEMORY.md` 索引）不同；与仓库 `CLAUDE.md` 不同。
- **本机线程**：带 instructions，但**不加载 memory 文件**。[S1]

### 7.4 Repositories【已证实】

- 三种加法：New project 对话框、Project settings > Environment、在项目对话里让 Claude 加。
- **加进项目**的 repo：从下一个线程开始，每个云线程都 clone 并在启动时加载其 `CLAUDE.md`——即使该任务不碰它。
- **不加进项目**：线程可在任务需要时自己加一个 repo（线程级、仅本线程；clone 发生在任务中途，所以启动时没有它的 CLAUDE.md；下一个线程仍没有）；仍需同样前置（GitHub App + push 权限）。
- **项目可以没有 repo**：云线程仍可在自己 sandbox 里研究、写文档、写/跑代码，产出文件进 Library。
- **owner 限制**：项目已有 repo 后，Claude 只能添加**项目已用过的 GitHub owner** 下的 repo；跨 owner 要用户自己去 Project settings > Environment 加。
- 多仓项目建议：只加"几乎每个任务都要碰"的 1–2 个 repo，其余在 instructions 里说明位置，让线程按需拉起。

### 7.5 Cloud environment【已证实】

每个新云线程用项目的 cloud environment，控制：

- **网络访问级别**：None（无出网）/ Trusted（默认，只允许 allowlist：包管理器、GitHub、云 SDK、容器 registry 等）/ Full / Custom（自定义 allowlist，可选包含默认）。无论哪级，GitHub（独立 proxy）、启用的 MCP connectors（走 Anthropic 服务器）、network secrets 对应 host、Anthropic API 仍可达。
- **环境变量**：`.env` 格式；任何线程内命令可读（`OTEL_*` 除外）；同环境的所有使用者都能读到，所以密钥应用 **network secrets** 而不是 env。
- **Network secrets**：密钥存在环境上，请求离开 VM 后由 Anthropic agent proxy 注入，密钥不进 VM；可指定 host/header/prefix；GitHub 和 Anthropic API 等请求不注入。
- **Setup script**：新会话启动前以 root 在 Ubuntu 24.04 跑；必须 exit 0；总时长 ≲5 分钟才会被缓存；缓存是文件系统快照（~7 天），不保留运行中的进程。
- **资源上限**（Anthropic 托管环境，可能变化）：约 **4 vCPU / 16 GB RAM / 30 GB disk**；超出可能被杀。
- **时间限制**：Bash 前台默认 2 分钟、可申请到 10 分钟（超时转后台，后台最多 30 分钟）；SessionStart hook 默认 600 秒；idle 会话 VM 会暂停、之后可能被回收（见 4.6 的 sandbox 丢失风险）。

另：**Project threads 不运行仓库 `.claude/settings.json` 的 SessionStart hooks**；依赖安装要靠 environment 的 setup script（自托管环境另有 hook 机制）。[S1][S5]

### 7.6 Pause / Archive / Delete【已证实】

- **Pause**：一次停掉所有——运行中线程和对话被中断，不再开新线程，scheduled tasks 不跑，项目不收消息；Resume 在同处或消息框上方横幅；resume 后给某个暂停线程发消息它会继续。
- **Archive**：从 sidebar 隐藏，归档其线程（停止运行中或盯 PR 的线程）；归档期间 scheduled tasks 不跑；从 Projects 页 **Unarchive** 恢复；**其线程仍保持 archived，需逐个在会话列表 unarchive**。
- **Delete**：永久删除项目及其线程、memory、文件，关闭其 scheduled tasks；**不可撤销**；线程 push 到 GitHub 的 branch/PR **不受影响**。

### 7.7 权限模型【已证实】

- 项目设置不在 `settings.json`，也没有项目级权限规则 UI 的文档。
- 云线程在模型支持时跑 **auto mode**；需要批准时 prompt 在线程内，用户在**线程里**答。
- 云线程**不读**仓库 `.claude/settings.json` 的 permission rules；要本机规则就开本机线程。
- 项目对话**没有 connectors**；线程有账号级 connectors。
- Claude Tag 那种"管理员为 channel 设定连接"的组织级权限模型，在 Projects beta 中**没有**："There are no organization-level controls for projects during the beta." [S1]

### 7.8 单用户、不可分享、线程不可迁移【已证实】

> "A project belongs to one user. You can't share a project or its threads with another user, and thread transcripts don't have the share option other cloud sessions have. There are no organization-level controls for projects during the beta."
> "A thread belongs to the one project that started it. You can't move or copy a thread to another project, or move it out to stand alone. **Move to project** goes the other way only: it brings a cloud session's work into a project. You can't merge two projects into one."
> —— [S1](https://code.claude.com/docs/en/claude-projects)

补充：项目使用**你自己的** GitHub 访问与 connectors；团队协作在同期由 Claude Tag（Slack，Team/Enterprise）承担，而不是项目分享。

---

## 8. 用量与计费

### 8.1 计费原则【已证实】

- 项目用量计入**同一份 plan limits**（和其他 Claude / Claude Code 会话共享），项目自己不能超支。
- **没有单独的云 VM 费用**（cloud sessions 文档："there's no separate charge for the cloud VM"）。[S4]
- 若账号开了 **usage credits**，超出后才走计量；**线程不能替你开启 credits**；没有 credits 时，达到限额的线程会等待并自动继续。
- 一个空闲项目（无线程跑、无 PR 在盯、无新消息）**不消耗** plan；archived 项目也不消耗。

### 8.2 什么在消耗用量【已证实】

- **运行线程**：每个都是完整会话，可多个并行。
- **项目对话**：Claude 读线程汇报、决定下一步的 token。
- **盯 PR 的 idle 线程**：CI 失败或收到 review comment 时会被唤醒并再次消耗；要停就在线程里让 Claude 别盯该 PR。

### 8.3 限额行为【已证实】

- 线程或项目对话达到 5 小时/周限额：**自动重试，恢复后继续**；显示 **Service is busy** + "Claude is still retrying and will continue automatically."
- 不想让它用下一个窗口：线程内 **Stop**，或 **pause 项目**。
- **scheduled task 启动的线程例外**：不等待，turn 以 limit error 结束，限额重置后用户再发消息。
- usage credits 相关请求（模型/上下文不在套餐内）会提示 "Additional usage credits are required"，开通后重发消息重试。

### 8.4 如何省用量（官方建议）【已证实】

1. **别复活大的旧线程**：路由到 idle 超过 cache lifetime（Pro/Max 约 1 小时）的线程，会先重读该线程整段对话；新工作开新线程可能更省。
2. 用更小模型/更低 effort（线程、对话或两者）。
3. 少开线程；小问题让 Claude 直接在项目对话回答。

### 8.5 并发与硬上限【已证实】

> "There's no fixed number; Claude starts as many as the work calls for, and a limit you ask for is a preference rather than a cap. The enforced limit is **200 new threads per day across your projects**."
> —— [S1](https://code.claude.com/docs/en/claude-projects)

- 用户要求的 "Run at most two threads at a time" 是偏好，**不是硬上限**；硬上限是每天 200 个新线程（跨所有项目）。
- 同时并行运行的线程数是否有隐藏上限：**未证实**（文档只给了"无固定数量 + 200/天"）。

---

## 9. 与邻近概念的边界

### 9.1 一览表

| 概念 | 一句话 | 与 Projects 的关系 | 来源 |
| :- | :- | :- | :- |
| **Project** | 一个协调会话 + 线程 + 共享 repos/instructions/memory/Library 的长期容器 | 本体 | [S1] |
| **Thread** | 项目派出的完整会话（cloud session 或 RC 本机会话） | 项目的工作单元 | [S1] |
| **Cloud session** | 跑在 Anthropic 云端 VM 的 Claude Code 会话；可自己在网页/手机/桌面/CLI 启动 | 线程默认形态；自己启动的 cloud session 可 **Continue as project / Move to project** | [S4] |
| **Agent view** | `claude agents` 一屏管理你自己启动的多个后台会话（research preview） | 仍是"你自己派任务"；项目是"Claude 帮你派和跟踪" | [S3] |
| **Worktrees** | 给每个本地会话独立 git checkout | 云线程不需要（各自 sandbox + branch）；本机线程可用 `--spawn worktree`/Worktree 选项 | [S1][S3] |
| **Agent teams** | 一个会话内 lead + teammates，共享 task list、可互相发消息，单任务协作（experimental） | 不同的编排层，详见 9.2 | [S2] |
| **Subagents** | 一个会话内派生的子 agent，独立 context、返回摘要 | 线程内部仍可用 subagents 做侧任务 | [S1][S3] |
| **Dynamic workflows** | 脚本编排大量 subagent，交叉验证结果 | 线程内部可用；不是项目级编排 | [S3] |
| **Routines / cloud scheduled tasks** | 云端定时/API/GitHub 事件触发的保存配置 | 项目内建的 scheduled tasks 以线程形式跑、显示在 Scheduled tasks tab；项目外的独立存在 | [S6] |
| **Claude Tag** | Slack 里的组织级 Claude（Team/Enterprise，多人可见可 steer，用管理员配置的连接） | 多人协作由 Tag 承担；项目是**个人独享** | [S1] |
| **Cloud environments** | 云会话的网络/env/secret/setup script 配置 | 项目线程用项目选定的环境 | [S5] |
| **Remote Control** | 用手机/网页操控你电脑上的 Claude Code 会话 | 项目要跑在本机时借它实现 | [S7] |
| **旧 claude.ai Projects** | 聊天文件夹 + project knowledge + instructions +（Team）分享 | 同名不同物；迁移目标才是它 | [S11][S12] |
| **Cowork Projects** | 任务工作区（files/instructions/memory/scheduled tasks） | 又一个同名概念；新 Projects 未来会并入 chat/Cowork 体验 | [S13] |

### 9.2 重点：Projects vs Agent Teams【已证实 + 部分推断】

Claude Code 文档对 agent team 的定义：

> "an agent team is one session that starts teammate sessions for a single task, on your machine or inside a cloud session, and ends with that task."
> —— [S1](https://code.claude.com/docs/en/claude-projects)（"How projects relate to other Claude Code features"）

> "One session acts as the team lead, coordinating work, assigning tasks, and synthesizing results. Teammates work independently, each in its own context window, and communicate directly with each other."
> —— [S2](https://code.claude.com/docs/en/agent-teams)

| 维度 | **Projects** | **Agent Teams** |
| :- | :- | :- |
| 编排单位 | 一个**长期项目对话** + N 个线程（跨任务、跨天） | 一个**会话内**的 lead + teammates（单任务） |
| 谁在编排 | 项目对话里的 Claude（服务端管理的 coordinator 角色） | 主会话（lead）；lead 固定，不可转移 |
| 工作单元 | Thread = **完整 cloud session**（或 RC 本机会话），独立 context/branch/PR | Teammate = 完整 Claude Code 实例，独立 context，但通常同工作树 |
| 生命周期 | 项目持续存在；线程 Working→…→Resolved（可 reopen）；项目 Pause/Archive/Delete | 任务结束即结束；每会话一个 team；team config 在会话结束时清理 |
| 持久性 | 云线程关掉笔记本仍跑 | 本机会话；在 cloud session 内也可开，但随该会话 |
| 互相通信 | 线程只向项目对话汇报；用户在线程内 steer；无公开的线程间直接消息机制【未证实有】 | Teammates **直接互相发消息**（mailbox 文件），共享 task list，自协调 |
| 任务板 | 无文档化的显式任务板；coordinator 自己跟踪 + Suggested threads | 有共享 task list：pending/in_progress/completed、依赖、文件锁 claim；`~/.claude/tasks/{team}` |
| 交付/隔离 | 每线程独立 branch + PR（auto-fix），冲突按普通 PR 冲突 | 无 worktree 隔离；官方建议按文件划分，避免同文件冲突；无内建 PR 编排（teammate 可自行开 PR） |
| 权限 | 线程 auto mode；批准在线程内；不继承 repo settings | Teammates 继承 lead 的 permission mode（`dontAsk` 除外）；批准出现在 lead 会话；teammate 不能代你批准 |
| 模型 | Coordinator/Thread 两套 model+effort 设置 | lead 选模型；teammate 按 spawn prompt / agent 定义 / `CLAUDE_CODE_SUBAGENT_MODEL` / lead 模型；effort 默认继承 lead |
| 可用性 | public beta，Pro/Max，网页/桌面/手机；**CLI 不支持** | **experimental，默认关闭**（`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`）；需交互式会话（`-p`/SDK 不能 spawn）；终端 in-process / split-pane 显示 |
| 计费 | 同一 plan limits，明显更快；200 新线程/天 | 同一 plan limits，token 显著更高；无文档化的 teammate 数量硬上限 |
| 最适合 | 一串相关任务、跨天、希望机器关了也继续、想"说一次"而不是逐个派 | 单任务并行探索/评审/辩论，需要 teammates 互相挑战与协调 |
| 不适合 | 单任务、每任务都要本机特殊环境且不想用 RC、纯定时 | 顺序任务、同文件编辑、强依赖任务 |

【推断】一句话判别：

- **"我要 Claude 替我管理一队列工作，持续几天，我不在它也能跑" → Projects。**
- **"我要在一个任务里让多个 agent 并行探索、互相讨论、最后合成" → Agent Teams。**
- 两者可叠加方向只有一个：**项目线程内部可以再开 subagents/teammates**（因为线程就是完整会话）；但一个 agent team 不会变成项目。

### 9.3 与 cloud session / agent view / routines / Claude Tag 的边界细节

- **Cloud session → Project**：自己启动的 cloud session 可 "Continue as project"（新建项目）或 "Move to project"（并入已有项目）；反向不行——线程不能移出项目变独立会话，本机 local session 不能加进项目。[S1]
- **Agent view**：`claude agents` 是"你自己派任务 + 一屏监控"；项目是"Claude 派任务 + Overview 监控"。agent view 的会话在本机（可 worktree 隔离）；项目的线程默认在云。[S3]
- **Routines/scheduled tasks**：项目内请求的定时工作会成为 cloud scheduled task，跑成该项目的线程、显示在 Scheduled tasks tab；项目外的 routine 独立运行。定时任务启动的线程在限额时**不等待**（见 8.3）。[S1][S6]
- **Claude Tag**：Slack 里多人协作、用管理员配置的 connectors、Team/Enterprise；项目是个人独享、用自己的 GitHub/connectors、Pro/Max。官方明确对比。[S1]
- **Subagents**：在**一个会话内**做侧任务、返回摘要；项目线程是"整会话"，且线程里仍可再用 subagents。[S1]
- **Worktrees**：本地并行隔离手段；云线程天然有自己的 sandbox + branch，不需要 worktree。[S1]

---

## 10. 用户原话逐条核对

| # | 用户原话 | 结论 | 依据 |
| :- | :- | :- | :- |
| 1 | "Claude / Claude Code 的 project 模式" | 存在，正式名 **Projects**，2026-09-17 起 public beta | [S1][S14] |
| 2 | "开启后有一个主的 Coordinator" | 有 coordinator，但它是**项目对话这个长期会话的角色**，不是单独派生的 agent；设置项名为 Coordinator model/effort | [S1] |
| 3 | "负责统筹" | 是：路由消息、决定就地答/新开/复用线程、跟踪所有线程、汇总、维护 memory | [S1] |
| 4 | "给每个任务开线程" | 是：新工作开新线程或交给同类线程；多个不相关任务拆多个线程；也可先给 Suggested threads | [S1] |
| 5 | "线程里可以询问和做事" | 是：线程是完整 cloud session（或本机会话），可跑命令/改代码/开 PR；可读 transcript、随时发消息 steer、回答权限提示、Stop | [S1] |
| 6 | "做完后关闭线程" | 概念对应 **Resolved**，不是删除；手动/Claude 判断最后一步完成/一周无活动自动触发；可 reopen；branch/PR 保留 | [S1] |
| 7 | "还有 library 存储上传的数据" | 是，且不止上传：还收线程产出的文件；上传是拷贝、支持 Replace；云线程从 `/mnt/project-files` 读；有限额 | [S1] |
| 8 | （隐含）"这是 claude.ai 旧 Projects 的新版本" | 既有联系也有断裂：新体验从 Claude Code 起步，旧项目后续迁移；旧版是文件夹式，新版是协调会话 | [S1][S11] |
| 9 | （隐含）"CLI 也能开" | 不能：CLI/VS Code/JetBrains 均不支持；入口仅 claude.ai/code、桌面 Code tab、手机 App | [S1] |
| 10 | （隐含）"团队可共享" | 不能：项目单用户、线程 transcript 不可分享、beta 无组织级管理 | [S1] |

---

## 11. 功能清单表

| # | 能力 | 行为 | 限制/注意 | 证据 |
| :- | :- | :- | :- | :- |
| 1 | 项目创建 | 从零（Name/Goal/Context）或从已有 cloud session（Continue as / Move to） | Pro/Max beta；需 GitHub App（涉代码时） | [S1] |
| 2 | 项目入口 | claude.ai/code、桌面 Code tab、手机 App | CLI/VS Code/JetBrains 不支持；Bedrock/Vertex/Foundry 不支持 | [S1] |
| 3 | Coordinator 对话 | 长期会话，路由+跟踪+汇总+写 memory | 无 connectors；可 Restart Claude | [S1] |
| 4 | 任务路由 | 就地回答 / 新线程 / 复用线程 / Suggested threads | 可被用户纠正；偏好写入 memory | [S1] |
| 5 | 线程 | 默认 cloud session；独立 context；可并行 | 无固定数量；200 新线程/天 | [S1] |
| 6 | 线程内操作 | transcript / steer / 权限批准 / Stop(Esc) | 项目对话里的"go ahead"到不了线程 | [S1] |
| 7 | 线程交付 | 新 branch（默认从默认分支起）+ PR（可开/被要求开）+ auto-fix 默认开 | 云沙箱 turn 间会暂停，未提交改动可能丢 | [S1] |
| 8 | 线程收尾 | Resolved：手动/合并后/一周无活动；可 reopen | branch/PR 保留 | [S1] |
| 9 | Overview | Threads 六分组 + Library + PR + Scheduled tasks | 浏览器仅小圆点提醒 | [S1] |
| 10 | Library | 上传文件/文件夹/GDrive + 线程产出；`/mnt/project-files` | 100 文件/2GB/次；单文件 480MB；文件夹前 100 文件/200MB；≤10 文件夹 | [S1] |
| 11 | 上传语义 | 拷贝快照；同名时 Replace | 本地后续修改不同步 | [S1] |
| 12 | Project instructions | 每线程注入，≤16,000 字符 | 只影响新线程 | [S1] |
| 13 | Project memory | `MEMORY.md` 索引 + 按需文件；Claude 自写 | 与本地 auto memory、repo CLAUDE.md 不同；本机线程不加载 | [S1] |
| 14 | Repositories | 项目级 clone；加载 repo 根 CLAUDE.md | 不加载 skills/.mcp.json/.claude/settings.json；需 GitHub App+push；仅 github.com | [S1][S4] |
| 15 | Cloud environment | 网络级别/env/secret/setup script | 默认 Trusted；资源约 4vCPU/16GB/30GB；setup ≤5min 才缓存 | [S5] |
| 16 | 权限 | 线程 auto mode + 线程内批准 | 不读 repo permission rules；无项目级权限 UI | [S1] |
| 17 | 模型/effort | Coordinator、Thread 分开设置 | 新项目默认 Opus；threads high / conversation low | [S1] |
| 18 | 用量 | 并入 plan limits；按线程/模型看 Usage | 上限时等待（定时任务线程除外）；credits 需自行开启 | [S1][S4] |
| 19 | 生命周期 | Pause / Archive / Delete | Delete 不可撤销；Archive 后线程仍 archived | [S1] |
| 20 | 归属 | 项目单用户；线程锁项目 | 不可分享、不可移出/移入线程、不可合并项目 | [S1] |
| 21 | 项目内定时任务 | 显示在 Scheduled tasks tab，以线程跑 | 项目外 routine 独立；限额行为不同 | [S1][S6] |
| 22 | 本机线程 | Remote Control；带本机文件/工具/settings；带 instructions 不带 memory | 需 CC ≥2.1.280、电脑醒着、关 trusted devices 限制 | [S1][S7] |
| 23 | 公开 API/SDK | 【未证实】未找到 Projects 的 API/SDK 文档；只有 cloud scheduled task 的 `/fire` 等旁路 API | 不能据文档假设可编程创建项目/线程 | [S1][S6][S9] |
| 24 | 协作/多人 | 个人独享；多人用 Claude Tag | 无组织级控制（beta） | [S1] |

---

## 12. 对 DSH 的启示

> 这一节是我的综合提炼（【推断】为主），刻意把"本质能力"与"Claude 的实现细节"分开。**§12.2 列出的实现细节不要直接当成需求。**

### 12.1 本质能力（产品语义层，值得抽象）

| # | 本质能力 | 说明 | Claude 的体现 |
| :- | :- | :- | :- |
| E1 | **项目容器** | 一个长期工作范围：目标 + 资源（仓库/文件）+ 规则 + 记忆 + 环境 + 用量 + 生命周期 | Project / Library / Environment / Usage / Pause-Archive-Delete |
| E2 | **协调者** | 一个持久入口，接收自然语言工作流，决定"就地答/派给已有 worker/新建 worker/建议 worker"，并维护台账与记忆 | 项目对话（Coordinator） |
| E3 | **任务线程** | 有独立上下文、可并行、可被 steer/批准/停止/查看、有终态与重开的执行单元 | Thread = cloud session |
| E4 | **共享知识面** | 每次注入的常驻指令 + 可积累的项目记忆 + 只读资料库，三者职责分明 | instructions / project memory / Library |
| E5 | **状态总览** | 一屏呈现"需要我 / 进行中 / 待审 / 收尾"，把注意力路由到人 | Overview 六分组 + 小圆点 |
| E6 | **生命周期与治理** | 暂停/归档/删除、个人归属、线程单向绑定项目、明确不可分享边界 | Pause/Archive/Delete + Limitations |
| E7 | **执行环境解耦** | worker 在云端隔离环境或用户本机执行，由任务需求决定；接口是"派任务 + 收汇报" | cloud environment / Remote Control |
| E8 | **成本与限额可见** | 按线程/模型统计用量；限额行为（等待/停止/自动续）明确可预期 | Usage tab、Service is busy、200 threads/day |
| E9 | **交付物落地** | 线程的产出要么进代码宿主（branch/PR），要么进项目资料库（Library） | PR + Library |

### 12.2 Claude 的实现细节（不要直接当需求）

| 实现细节 | 为什么是细节 |
| :- | :- |
| Claude GitHub App 作为前置、只支持 github.com | 换一个代码宿主/连接方式即可 |
| 每个线程独立 branch + PR + auto-fix + merge 按钮 | 是"交付物落地"的一种实现；也可用 patch/diff/直接提交 |
| Anthropic 托管 sandbox（4vCPU/16GB/30GB、环境缓存、network allowlist、network secrets、setup script） | 云执行环境的具体实现 |
| claude.ai connectors / 账号级 skills / Project settings > Plugins | MCP/扩展的分发实现 |
| `MEMORY.md` 索引 + 按需打开 + Auto memory | memory 的一种文件实现 |
| `/mnt/project-files` 路径 | Library 挂载方式 |
| Opus 默认、threads high / conversation low effort | 默认值，不是能力 |
| 200 新线程/天、16,000 字符 instructions、Library 480MB/2GB、文件夹 100 文件/200MB、10 文件夹 | 当前配额，会变 |
| 一周无活动自动 Resolved | 收尾策略的一种默认 |
| "Continue as project"/"Move to project"/Setup recommendations/waitlist | 迁移与增长策略 |
| 桌面通知 / 手机 / Remote Control / "Work locally" | 入口与远程控制实现 |
| 并入 plan limits、usage credits | 商业模式 |
| beta 套餐限制、Team/Enterprise 未开放 | 放量阶段 |

### 12.3 若把 Projects 映射到 DSH（初步思路，【推断】）

| Projects 概念 | 可映射的 DSH 形态（建议） | 关键设计点 |
| :- | :- | :- |
| Project | 工作区/项目聚合（持久化元数据）+ 一个长期 coordinator 会话 | 项目元数据与线程索引要独立于会话存储，可恢复 |
| Coordinator 对话 | 常驻/可恢复的编排会话，带路由策略与线程台账 | **不要让编排者包办执行**；它应是路由+汇总+memory 服务 |
| Thread | 子会话/线程，独立上下文；若要求隔离则配 worktree/branch；DSH 的 durable teammate + shared task board 可作为"线程+任务板"底座 | 线程与任务板分离：线程=执行+上下文；任务板=状态与依赖 |
| Suggested threads | 编排者产出的"待确认任务建议"，一键/逐个开启 | 与团队任务板 pending 任务衔接 |
| Library | 不可变资产库：上传快照 + 产出物索引；replace 语义；给 worker 只读挂载 | 明确"拷贝而非同步"，避免用户误解 |
| instructions | 每次派发线程时注入的 system/developer 级规则（有长度预算） | 与技能/记忆的加载顺序要定 |
| project memory | 共享记忆索引 + 按需文件；谁可写、何时写、如何审阅 | 避免所有线程并发写同一文件；需要冲突策略 |
| Overview | 状态机 + 注意力队列（needs_you / working / review / done） | 状态由事件驱动；"需要人"优先 |
| 权限 | worker 内审批 + auto 模式；项目级不继承宿主权限 | 审批必须送到发起者/用户，不能由编排者代批 |
| 生命周期 | pause/archive/delete；项目个人归属；线程单向绑定 | 删除的级联与外部产物（PR/分支）解耦 |

**三条设计陷阱（从 Claude 规格里读出来的教训）**：

1. **别把 Coordinator 做成"更强的 agent"**：Claude 的 coordinator 被刻意限制在"读汇报 + 路由 + 记忆"（连 connectors 都没有）。编排者的权力越少，行为越可预期、越省 token。
2. **线程的"完成"要可判定、可重开、可保留外部产物**：Resolved 不是 delete；一周自动收尾 + reopen + branch/PR 保留，是一套能让长时间无人值守不失控的机制。
3. **上下文靠"注入 + 压缩 + 记忆"三件套，而不是让用户手动管理**：instructions 每次注入、线程/会话自动压缩、必须保留的信息进 memory。任何要求用户"记得清上下文"的设计都与 Claude 的做法相反。

### 12.4 与 DSH 现有概念的差异提醒

- DSH 的 **Agent Teams**（lead + teammates + 共享任务板 + mailbox）更像 Claude 的 **Agent Teams**，而不是 Projects；Projects 是"跨会话、跨天、项目级"的另一层。
- DSH 的 teammate 是 **durable**、共享同一工作目录；Claude 的 thread 是独立 cloud session（独立 context、独立 branch/PR）。若 DSH 要做"线程"，需要显式设计**上下文隔离**与**写入隔离**（worktree/branch/路径分区），否则无法复用 Claude 的并行模型。
- DSH 已有 Web GUI：Overview/Library/Memory 这类"项目面板"在 GUI 上天然可做；但**不要把 Claude 的 GitHub App / PR / 云 sandbox 当成需求**，应替换为 DSH 自己的执行与交付机制。

---

## 13. 未证实 / 待验证 / 抓取失败清单

### 13.1 官方文档未给出、本文标注为未证实/推断的项

| # | 项 | 状态 | 说明 |
| :- | :- | :- | :- |
| 1 | Library 项目级总配额（总容量/总文件数/保留期） | 未证实 | 只找到单次/单文件/文件夹/文件夹数量限制 |
| 2 | Projects 的公开 API / SDK（创建项目、枚举线程、发消息） | 未证实 | 文档索引 [S9] 无 Projects API 页；已知只有 cloud scheduled task 的 `/fire` API [S6]；CLI 有 `claude -p --cloud <session-id>` 可向 cloud session 发消息 [S4]，但能否指向项目线程无文档 |
| 3 | 同时并行线程数的隐藏上限 | 未证实 | 只有"无固定数量 + 200 新线程/天" |
| 4 | 线程 transcript 的保留/删除策略 | 未证实 | 文档指向 Security / Data usage，未在 Projects 页给具体期限 |
| 5 | 手机 App 与桌面/网页的完整功能对齐程度 | 未证实 | 文档只说可在手机创建/使用/steer |
| 6 | Coordinator 的完整工具清单（除读线程、发消息、写 memory 外） | 未证实/推断 | 文档未公开其工具集 |
| 7 | 线程的"完成"判定细节（Claude 如何判断最后一步完成） | 未证实 | 只举例"如合并其 PR" |
| 8 | Overview 状态机的精确迁移条件 | 推断 | 依据分组定义推导，文档未给状态图 |
| 9 | Projects 是否在 chat/Cowork 已有入口 | 未证实（分阶段） | 帮助中心说 chat/Cowork 后续跟进；Cowork 自己的 Projects 是另一个东西 [S13] |
| 10 | Team/Enterprise 何时开放 | 未证实 | 只说 "not available yet" |
| 11 | 旧项目自动迁移的完整判定与时间表 | 未证实 | 帮助中心只说已开始、部分用户会收到邮件 |
| 12 | 本机线程是否加载 project memory | 已证实**不加载**（仅 instructions） | 这点反直觉，已确认 [S1] |

### 13.2 抓取失败/受限的来源（记录，不编造）

| 来源 | 结果 | 处理 |
| :- | :- | :- |
| `claude.com/blog/projects-redesigned` 正文 | HTTP 200，但返回内容在正文前被截断（只有标题/日期/分类等元数据）；`.md` 变体 404 | 正文引文改用第三方逐字摘录页 [S15]，并在文中标【已证实·转引】 |
| `claude.com/resources/articles/projects-redesigned` | 同上，截断在正文前 | 同上 |
| `raw.githubusercontent.com/.../CHANGELOG.md` | 抓取失败："resolves to a non-public IP address" | 无法核对 9 月 Projects 的 changelog 条目；docs changelog 只显示最近版本 [S8] |
| `https://r.jina.ai/...`（文本代理） | fetch failed | 未使用 |
| `devops.com` 报道 | HTTP 403 | 仅记录，不引用 |
| `heise.de` 报道 | fetch failed | 仅记录，不引用 |
| `code.claude.com/docs/en/whats-new/2026-w38.md`、`w39` | 404（Projects 发布周没有对应 weekly digest） | 用博客页元数据 + 第三方报道确定日期 |
| `claude.com/docs/claude-tag/overview` | 200 但只返回导航，正文未取到 | Claude Tag 对比改用 [S1] 中的官方对比段 |

---

## 14. 来源编号与引用说明

完整清单、抓取时间与本地快照见 [sources.md](sources.md)。核心来源：

| 编号 | 来源 | URL |
| :- | :- | :- |
| S1 | Claude Code 文档 **Let Claude coordinate ongoing work with Projects**（本调研主依据） | <https://code.claude.com/docs/en/claude-projects>（`.md` 全文：<https://code.claude.com/docs/en/claude-projects.md>） |
| S2 | Claude Code 文档 **Orchestrate teams of Claude Code sessions**（Agent Teams） | <https://code.claude.com/docs/en/agent-teams> |
| S3 | Claude Code 文档 **Run agents in parallel**（五种并行方式对比） | <https://code.claude.com/docs/en/agents> |
| S4 | Claude Code 文档 **Use Claude Code in the cloud**（cloud sessions / auto-fix / 限制） | <https://code.claude.com/docs/en/claude-code-on-the-web> |
| S5 | Claude Code 文档 **Configure cloud environments**（网络/secret/setup script/资源） | <https://code.claude.com/docs/en/cloud-environments> |
| S6 | Claude Code 文档 **Automate work with scheduled tasks**（routines/scheduled tasks） | <https://code.claude.com/docs/en/routines> |
| S7 | Claude Code 文档 **Continue local sessions from any device with Remote Control** | <https://code.claude.com/docs/en/remote-control> |
| S8 | Claude Code 文档 **Changelog**（可见范围内未见 Projects 条目） | <https://code.claude.com/docs/en/changelog> |
| S9 | Claude Code 文档索引（用于确认无 Projects API 页） | <https://code.claude.com/docs/llms.txt> |
| S10 | Claude Code 文档 **What's new** 周索引（W38 无条目） | <https://code.claude.com/docs/en/whats-new/index> |
| S11 | Claude Help Center **What are projects?**（旧版 + 新版 beta 说明） | <https://support.claude.com/en/articles/9517075-what-are-projects> |
| S12 | Claude Help Center **How can I create and manage projects?**（旧版细节） | <https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects> |
| S13 | Claude Help Center **Organize your tasks with projects in Claude Cowork** | <https://support.claude.com/en/articles/14116274-organize-your-tasks-with-projects-in-claude-cowork> |
| S14 | 官方博客页 **Projects redesigned: from folder to conversation**（正文直取失败，元数据可用） | <https://claude.com/blog/projects-redesigned> |
| S15 | 第三方逐字摘录页：官方博客 highlights（转引） | <https://www.pelayoarbues.com/literature-notes/articles/projects-redesigned-from-folder-to-conversation> |
| S16 | 第三方报道：Anthropic Rebuilds Claude Code Projects…（2026-09-18，旁证） | <https://www.implicator.ai/anthropic-claude-code-projects-opus-default/> |
| S17 | Claude Tag 文档首页（抓取受限，仅用于确认概念存在） | <https://claude.com/docs/claude-tag/overview> |

> **引用原则**：规格结论一律以 S1 主文档为准；S2–S7 用于扩展与对照；S11–S13 只用于旧版/Cowork 区分；S14–S16 只用于发布日期与博客原文（且明确标注转引/旁证）。官方文档与帮助中心存在**日期不一致/新旧并存**时，本文以更新更晚的文档为准并注明冲突（如 [S13] 的 "not in Claude Code" 已过期）。
