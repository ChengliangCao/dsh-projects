# 评审：`docs/dsh-claude-projects-plan.md` 的 Claude 侧规格保真度

> 评审人：claude-spec（Claude 规格调研，R1 作者）　｜　评审时间：2026-10-22T14:11+08:00
> 评审对象：`docs/dsh-claude-projects-plan.md`（888 行，2026-10-22 14:09 版本；本文行号以此版本为准）
> 对照基准：
> - **R1** = `research/claude-projects/README.md`（本团队 Claude 侧调研，含 S1–S17 来源编号）
> - **S1** = <https://code.claude.com/docs/en/claude-projects>（Claude Code Projects 主文档，R1 的 S1）
> - 其他来源编号（S2、S11、S13 等）沿用 R1/`sources.md`
> 评审范围：**只评 Claude 侧规格保真度** + 方案对 R1 的引用/映射（§1、§1.4、§3.4、§3.6、§3.7、以及与 Claude 语义直接相关的 §3.9/§3.10/§3.11/§6）。不评审 DSH 架构选型、包拆分、工期与 M0–M4 排期（R2/R3 未在本任务内复核）。

---

## 0. 结论摘要

**总体判断：§1 质量很高，未发现事实性错误；没有把「旧版 Projects / Cowork Projects / Agent Teams」混淆。** 抽查 §1 及直接相关章节的 16 条关键结论，14 条与 S1 一致，2 条属于「措辞过强/把推断写成已证实」；§3.4/§3.6/§3.7 的 DSH 适配总体合理，但存在 1 个核心语义差异未标注、1 个证据标签错误，以及若干能力清单/接口一致性问题。

| 级别 | 数量 | 含义 |
| :- | :- | :- |
| **严重（必须改）** | **2** | 会误导设计、违反方案自己的标注约定，或与 S1 的核心语义冲突；进入实施前必须修 |
| 建议（应改） | 13 | 影响保真度/方案内部一致性，不阻塞 M0，但应在 M1–M3 前处理 |
| 可忽略 | 6 | 措辞/精度问题，可随手改 |
| **确认正确（无需改）** | 16 项 | 见 §4，含 Coordinator 边界、线程启动上下文、Library 限额/拷贝、Resolved、六分组、治理、单用户限制等 |

**两条必须改**：
1. **S1：B 方案把线程实现为「协调者会话的子会话」，与 S1「线程归属项目」的语义差异没有在 §1.2/§3.4/§6 标注，且缺少验收项。**
2. **S2：TL;DR #2 与 §1.4 E2 把「Coordinator 刻意弱化/不做执行」标成【已证实】，超出 S1 原文；S1 只证实「只读线程汇报 / 无 connectors / 决策路由」，且明确它会在原地回答 quick question。**

> 说明：本评审刻意区分「**Claude 事实**」与「**DSH 设计选择**」。方案里多数 DSH 设计是合理的；问题集中在**把设计/推断写成 Claude 事实**、以及**把 Claude 的语义差异只放进「待决策问题」而没有在正文标注**。

---

## 1. 严重（必须改）

### S1（严重）线程归属：B 方案的「协调者子会话」与 S1「线程归属项目」不是同一语义，且未标注差异、无验收项

**方案位置**
- §3.4 两方案对比表：L339（B 方案「父会话离线时 Send 锁定」）、L343（生命周期归属：`subagents/agentTeams`）、L345（与 Claude 语义距离：「中」）、L347（推荐 B）
- §3.4 推荐理由：L354（"子会话同样是完整 event-sourced Session … 满足「线程里可以询问和做事」"）
- §1.2 线程描述：L64（"Threads（每个 = 独立会话…）"）、L87（线程生命周期）
- §1.2/§3.1：L218（"Project 域是唯一组织真相"）、L220（"线程 = 完整会话"）
- §9 待决策：L841（Q2 提到"父会话离线时对发送有限制，需要评估"）
- §6 差异表：L782–794（当前只列执行环境/交付物/隔离/持久化等差异，**没有列线程归属**）

**问题**
S1 明确规定线程的归属与可迁移性：

> "A thread belongs to the one project that started it. You can't move or copy a thread to another project, or move it out to stand alone."
> —— S1（R1 §7.8）

同时 S1 把线程描述为 project 的 worker session：用户可以从 Overview/卡片独立打开线程、steer、Stop；S1 **没有**把线程的生命周期绑定到「项目对话是否处于活动 turn」，而是明确"a thread belongs to the one project"。方案 B 的线程是协调者会话的 child session：运行时父会话离线时 child composer 的 Send 锁定（方案自己引用了 R2 的这一事实，L339），线程的 runtime 归属是 `subagents/agentTeams`（L343）。方案在 Q2 里承认了这一点，但正文仍用"满足『线程里可以询问和做事』"（L354）把它表述成已对齐；§6 差异表也没有这条。

这不是纯实现风险：**如果协调者会话被归档/删除/模型不可用，线程是否还能从项目页单独打开和继续，是产品语义问题，不是 spike 细节。**

**可执行修改**
1. 在 §1.2/§3.4 明确加一句语义对齐声明（不是重写）："Claude：线程归属项目；本方案：线程在 domain 上归属项目（`thread.projectId`），但运行时是协调者会话的子会话（child），因此 Send/冷恢复受父会话可用性影响。"
2. §3.4 推荐理由 L354 把"满足『线程里可以询问和做事』"改为"满足大部分交互（看 transcript / steer / Stop / 冷恢复）；**但线程独立性受父会话约束，列为 M0 验收项**"。
3. §6 差异表新增一行「线程归属/独立性」：Claude = 项目所有、可独立打开/steer；DSH B 方案 = domain 归属项目、运行时挂协调者会话；并在 Q2 之外补充拟采用的缓解（re-parent / 顶层 Session 运行器 / 仅 UI 上独立打开）。
4. M0 验收（§5 L716–728）新增一条：**协调者会话被归档/关闭后，项目页仍能打开线程会话并成功 send（若不能，必须记录为已知限制并决定是否切 A 方案）**。M2 验收（§5 L740–748）同补。

---

### S2（严重）「Coordinator 刻意弱化、不做执行」被标成【已证实】，超出 S1；应标【推断】/【设计】

**方案位置**
- TL;DR #2：L32（"这是刻意的能力边界。【已证实，R1 §3】"）
- §1.4 E2：L117（"**刻意弱化为路由/台账/记忆，不做执行**"）
- §3.5：L416–419（"能力边界（对齐 Claude）"；L418 "协调者本身不做重执行"；L419 【已证实，Claude 同款边界】）
- 相关设计：§3.1 #3（L219）、§4.2 L599（协调者不挂重执行工具）

**问题**
S1 能证实的是：项目对话是长期协调会话；它决定消息去向、跟踪线程、只看到线程汇报而非每一步；项目对话**没有 connectors**；需要 connector 的工作要发线程。但 S1 **同时**明确它会在原地回答：

> "Claude starts a thread for each piece of work or passes it to the thread already working in that area, **and answers quick questions in place**."
> —— S1（R1 §3.3 引）

S1 没有说协调者"不做执行"或"被刻意弱化为只路由/台账/记忆"——这是 R1 §3.6 中**明确标为【推断】**的产品解释。而方案自己的标注约定是：**【已证实】= 官方文档直接支持**。把推断标成已证实，会带来两个实际后果：
1. 设计上可能过度限制协调者（例如连"读一个文件回答问题"都要求开线程），与 S1 "answers quick questions in place" 不一致；
2. 后续团队引用该结论时无法回溯证据。

**可执行修改**
1. TL;DR #2：删掉"这是刻意的能力边界"或改为"R1 将其概括为刻意边界（**推断**）"；标签改为 **【已证实 + 推断】**，并注明哪部分是已证实（只读汇报、无 connectors、路由/决策）、哪部分是推断（不做执行）。
2. §1.4 E2：把"**刻意弱化为路由/台账/记忆，不做执行**"改为"执行主要落在线程；协调者以路由/汇总/记忆为主（**产品边界，非 S1 原文**）"，或把该短语移到 §12 式"DSH 设计选择"行。
3. §3.5 标题"能力边界（对齐 Claude）"改为"能力边界（对齐 Claude 的已证实部分 + 本方案设计）"，L419 标签改为【已证实（只读汇报/无 connectors/线程内批准）+ 设计（不代执行）】。
4. §4.2 L599 的"协调者不挂 bash/write/edit 等重执行工具"保留为设计决策即可，但不要引用 S1 作为依据。

---

## 2. 建议（应改，不阻塞 M0）

| ID | 方案位置 | 问题 | 依据 | 建议改法 |
| :- | :- | :- | :- | :- |
| **M1** | §1.4 七个本质能力（L110–124） | 相比 R1 §12.1 的九项，漏了 **E8 成本与限额可见**、**E9 交付物落地**；而方案 §3.7/§3.10/§3.6 实际都实现了 | R1 §12.1 / S1 Usage、Library | 补成 9 项（或明确写"7 项 + 2 项并入 E5/E4"）；E4 改为"Library（上传物 + 线程产出物）" |
| **M2** | §1.4 E6（L121） | 把"单用户归属、不可分享边界"列为本質能力，但这是 beta 政策/阶段限制，不是能力语义 | S1 Limitations："There are no organization-level controls for projects during the beta"；R1 §7.8 | 把"单用户/不可分享"标为"政策约束（beta）"另起一行；本质能力只保留 pause/archive/delete、归属绑定、生命周期 |
| **M3** | §3.6 L431/L438 + §4.2 L565 | Library 目标语义说"项目级"，但**数据模型没有文件夹/Google Drive 形态**（`libraryEntries` 只有单文件 entry，L303），接口无 `addFolder`；同时配置里有 `maxFolders: 10`（L565）——配置与模型/接口不一致 | S1 "Add files and folders"：上传**文件、文件夹、Google Drive 文件夹**；限额含 10 个文件夹 | 二选一：(a) 补 `kind:'folder'`/`addFolder`/文件夹排除规则（>30MB、隐藏文件、node_modules）与 GDrive 来源字段；或 (b) 明确写"文件夹/Drive 为非目标"并删掉/改名 `maxFolders` 配置。推荐 (b) 进非目标、M4 再议，避免 MVP 悬空 |
| **M4** | §3.4 状态机 L374；§3.11 L524 | Resolved 只实现「手动 + 自动 7 天」两个触发，缺 S1 的第三个触发：**Claude 在最后一步完成时 resolve（如合并 PR）**。`project_resolve_thread` 工具存在，但 §3.5 的协调者策略没有这条，线程会长期挂 Idle | S1 Resolved 定义："by you from the thread's menu, **by Claude once you've taken the last step**, such as merging its pull request, or automatically after a week with no activity"；R1 §4.5 | 在 §3.5 策略加一条（M3）："线程 report 无 `needs` 且交付物已确认/验收 → 协调者调用 resolve"；或在 §3.11 Auto Resolve 旁加"Claude-initiated resolve"路径。标注为【设计】 |
| **M5** | §3.5 L417；§4.4 L644/L653 | 协调者只能看 `list_threads` 台账 + `project_report`/完成通知，**没有"按需读取单个线程详情"的工具/能力**。S1 troubleshooting 明确 Claude 可以读每个线程后回答（这是 Claude 的真实能力） | S1 L457："…Claude reads each thread and answers in the conversation."；R1 §3.2 | 增加 `project_get_thread`/`project_read_thread`（返回线程状态、last report、needs、最近消息摘要），或在 `list_threads` 返回足够字段；同时在 §3.5 声明"协调者可按需读取线程摘要，但不加载完整 transcript" |
| **M6** | §3.7 L463 | `Ready for review = 线程 idle 且有交付物` 改变了 Claude 语义：Claude 该组是 **PR 已开、等待 review**；非代码产出（文档等）在 Claude 进 Idle + Library，不会进 Ready for review。方案虽写"DSH 用交付物替代 PR"，但这属于产品语义变化，§6 差异表未列 | S1 Overview 表："Ready for review — Threads whose pull request is open and awaiting review"；R1 §5.1 | 在 §6 差异表补一行「Ready for review 语义」；或把该组拆成「代码变更待审（worktree/diff）」与「交付物待收（非代码→Idle）」；若保留现映射，至少把"替代 PR"在 §3.7 里明确标成【设计·与 Claude 语义不同】 |
| **M7** | §3.9 L495 | "线程继承协调者的权限模式与 permission roots" 与 Claude 线程语义不同（Claude cloud threads 跑 auto mode、批准在线程内、**不读 repo permission rules**）；且与 §3.1 #3「协调者权力越少越好」有张力 | S1 §"Unblock a thread waiting on approval"（auto mode；approval 在 thread；不读 repo `.claude/settings.json` permission rules）；R1 §4.4、§7.7 | 标【设计】；建议默认线程权限 = **部署默认**（`DSH_PERMISSION_MODE`）而非协调者会话运行态权限，或明确"协调者不得把自身权限提升给线程"；在 §6 差异表注明与 Claude auto-mode 模型的差异 |
| **M8** | §3.6 L447 | 产出物入库依赖线程显式调 `present` + `project_library_add`；Claude 是"Files a thread produced are also on the Library tab"，不需要额外模型动作 | S1 L166；R1 §6.1 | 在线程 `project_report`/完成钩子里**自动回收** `present` 声明的交付物（及线程工作区声明产物）入库；工具保留为补充，不要求模型记得二次调用 |
| **M9** | §3.11 L520 | Pause 写"协调者会话仍可读（工具拒绝执行）"，但 S1 的 Pause 是"Every running thread **and the conversation** are interrupted … the project doesn't accept messages until you resume"。方案是产品差异但未标注 | S1 §"Pause, archive, or delete a project"；R1 §7.6 | 在 §3.11 或 §6 明确写"Claude：pause 后对话不可用；DSH：协调者会话可读但工具拒绝执行（设计差异）"，或改成与 Claude 一致 |
| **M10** | §3.10 L508 | `maxActiveThreads` 默认 4，并称"默认对齐 Claude 精神"不准确：S1 明确"**There's no fixed number**; Claude starts as many as the work calls for"；Claude 只有 200/天硬上限 | S1 §"Usage and cost"（R1 §8.5） | 改为"DSH 资源保护默认值（Claude 无固定并发上限，仅有 200 新线程/天）"；保留 200/天为 config 默认 |
| **M11** | §1.2（L76–85 前置条件缺失）、L124 细节清单 | §1 没有写涉代码项目的前置：**Claude GitHub App 必须安装在仓库、GitHub 账号需 push 权限、仅支持 github.com**；只在 §1.4 把 GitHub App 列为"实现细节" | S1 §"Check the prerequisites"；R1 §2.3 | §1.1 或 §1.2 补一句前置（"涉代码项目：仅 github.com + Claude GitHub App + push 权限；`/web-setup` token 不够"）；即使 §6 声明不做 GitHub 集成，也建议保留该事实 |
| **M12** | §1.2 L95 治理段 | Pause/Archive/Delete 没写 **scheduled tasks 级联**：Pause 时 scheduled tasks 不跑；Archive 期间不跑；Delete 会关闭项目 scheduled tasks | S1 §"Pause, archive, or delete a project"；R1 §7.6 | 在 L95 的 Pause/Archive/Delete 各项后各补半句；与 §3.11/§5 M4 的 Scheduled tasks tab 一致 |
| **M13** | §3.3 L293–303 ↔ §3.4 L382、§3.7 L462 | 方案内部一致性：L382 要"记录 `failed` + **错误文本**"、§3.7 用"线程 report 里带 `needs`"，但 `threads` 表只有 `state`/`usage`，**没有 `error`/`needs`/`lastReport` 字段**，`recordReport` 的结果也没有落点 | 方案内部（非 Claude） | 在 ThreadRecord 补 `lastError?: string`、`lastReport?: { summary, needs?, deliverables? }`（或单独 reports 表）；或在 L382/L462 改为"从 session 事件/通知实时取"，并删掉"记录"表述 |

---

## 3. 可忽略（措辞/精度）

| ID | 位置 | 问题 | 建议 |
| :- | :- | :- | :- |
| L1 | §1.2 L87 | "无 PR 的线程 Idle → 一周无活动或手动 Resolved" 把自动一周限定在无 PR 分支；S1 的"automatically after a week with no activity"适用于任意无活动线程 | 改为"任何无活动线程（含无 PR 的 Idle）→ 一周无活动或手动/自动 Resolved" |
| L2 | §1.3 L105 | "云线程以 `/mnt/project-files` **只读**"：S1 只说"files it can read under /mnt/project-files"，未明确只读；R1 未断言只读 | 改"读取"或标【推断】；§3.6 的只读是 DSH 设计选择，保留但标【设计】 |
| L3 | §3.7 L464 | "Idle / Done" 中的 Done 不是 Claude 分组（Claude 只有 Idle） | 只写 Idle，或注明"DSH 自定义 label" |
| L4 | §3.4 L361–382 | 状态机标题缺【设计】标签；`failed` 持久状态是 DSH 扩展（Claude 无持久 failed 状态，只在 Overview 的 Waiting on you 呈现失败线程） | 标题加"【设计】持久意图状态；Claude 六分组为 UI overlay"，与 §3.7 呼应 |
| L5 | §1.2 L74 | "项目第一次打开时 Claude 可能自动跑一个 turn"：S1 是"On your **first project**"，且用户先发消息可抢占 | 改为"创建**你的第一个项目**后，除非你先发消息，否则 Claude 会自动跑一个 turn" |
| L6 | §1.2 L89 | Library 段没写"线程产出物也会进 Library"（L68 图里有、§1.3 L105 有） | 在 L89 开头补半句，避免只读该段的读者误以为 Library 只有上传物 |

---

## 4. 已确认正确（无需修改）

| # | 方案位置 | 结论 | 依据 |
| :- | :- | :- | :- |
| 1 | §1.1 L45–53 | 三个同名 Projects 的区分准确（Claude Code 新 Projects / claude.ai 旧 Projects / Cowork Projects），**没有混淆**；可用性、入口、不支持的 surface（CLI/IDE/Bedrock/Google Cloud Agent Platform/Microsoft Foundry）准确 | S1 NOTE + Limitations；S11；S13 |
| 2 | §1.2 L76–85 线程启动上下文表 | 逐行正确：会带 repos+files+instructions+memory、仓库根 CLAUDE.md/.claude/CLAUDE.md/.claude/rules/、账号级 connectors/skills、项目 plugins、cloud environment；不会带 repo `.claude/settings.json`（权限/hooks/env）、`.mcp.json`、`.claude/skills/`、agents/commands、本机配置、repo SessionStart hooks/permission rules | S1 "What threads pick up from your repositories"；R1 §4.2 |
| 3 | §1.2 L89 Library 限额/拷贝 | 逐项正确：单次 ≤100 文件/2GB、单文件 ≤480MB、对话框 >30MB 跳过、文件夹前 100 文件/≤200MB（排除 >30MB/隐藏/node_modules）、≤10 文件夹、项目总量官方未给、拷贝+Replace | S1 "Add files and folders"；R1 §6 |
| 4 | §1.2 L91 三件套 | instructions ≤16,000 字符且新线程+项目对话都收到；memory 为 `MEMORY.md` 索引 + Claude 自写文件、云线程启动读索引/按需打开；repos 每线程 clone、只加载根 CLAUDE.md — 均准确 | S1 "Give a project standing context"；R1 §7.2–7.4 |
| 5 | §1.2 L93 用量 | plan limits / 无独立 VM 费 / 200 新线程/天 / 线程上限为偏好 / 等待续跑（定时任务线程例外）/ idle PR 线程被唤醒 — 均准确 | S1 "Usage and cost"；S4；R1 §8 |
| 6 | §1.2 L95 治理 | Pause/Archive/Delete 基本语义、单用户不可分享、线程不可跨项目移动、不能合并项目 — 准确（scheduled tasks 级联缺失见 M12） | S1 "Project settings reference" + Limitations；R1 §7.6、§7.8 |
| 7 | §1.3 用户原话核对表 | 8 行判定与措辞基本准确；仅"只读"一处理解需微调（L2） | R1 §10 |
| 8 | §1.4 实现细节清单 L124 | GitHub App/仅 github.com/branch+PR+auto-fix/云 sandbox/`/mnt/project-files`/`MEMORY.md` 格式/Opus+effort 默认/200+配额/一周自动 Resolved/Continue as project/waitlist/入口实现 — 分类与 R1 §12.2 一致，没有被误当需求 | R1 §12.2 |
| 9 | §3.4 L380 | `resolve ≠ delete`（线程子会话保留、可 reopen、分支/worktree/交付物保留）与 S1 一致 | S1 Resolved；R1 §4.5 |
| 10 | §3.4 L378 | "持久状态只存意图 + Client live overlay 推导 running/waiting/idle" 是合理的 DSH 设计，与 Claude 的持久语义/UI 分组分离思路一致（不影响保真） | 设计评审（合理） |
| 11 | §3.4 L382 | failed → Overview `Waiting on you` 与 S1 的 Waiting on you 定义（"need your reply or approval, **or that failed**"）一致 | S1 Overview 表；R1 §5.1 |
| 12 | §3.6 L431–438 目标语义 | 项目级、上传+产出都进库、拷贝、Replace、配额（480MB/100 文件 2GB/文件夹 100 文件 200MB/10 文件夹）与 S1 对齐（缺口见 M3/M8） | S1；R1 §6 |
| 13 | §3.7 L461–466 分组映射 | Working / Waiting on you（含 failed）/ Idle / Resolved / Landing（非目标）映射合理；Ready-for-review 的 PR 语义被显式改为交付物（差异见 M6） | S1 Overview 表；R1 §5.1 |
| 14 | §3.7 L468 | "项目对话里的 go-ahead 到不了线程、批准必须在线程内完成" 照抄正确 | S1 §"Unblock a thread waiting on approval"；R1 §4.4 |
| 15 | §5 M0 L359 | M0 要验证"后台线程权限提示可见/可批准 + pendingInteraction 覆盖子会话"、"sendMessage 冷恢复"、"addressed-subagent 打开" — 这些正是 B 方案最关键的 Claude 对齐风险，方向正确 | 设计评审（合理） |
| 16 | §6 L780–796 | 执行环境/交付物/隔离/Library 挂载/上下文/分享/计费/入口等差异写清楚，且非目标明确；**仅缺线程归属（S1）与 Ready-for-review 语义（M6）两行** | 对照 R1 §12 |

---

## 5. 对照 lead 的四个评审重点（逐项结论）

### 5.1 §1（Claude 侧总结）准确性
**结论：准确。** 未发现与 S1 冲突的事实错误；Coordinator 边界、线程启动上下文、Resolved 规则、Overview 六分组（TL;DR 与 §3.7）、Library 限额与拷贝语义、instructions/memory/repos 三件套、Pause/Archive/Delete、单用户限制均正确。唯一问题是 **S2 的证据标签**与 **M11/M12 的遗漏**，不是事实错误。

### 5.2 §1.4「七个本质能力」
**结论：方向正确，但清单不完整 + 1 处政策误升。**
- 漏：R1 E8（成本/限额可见）、E9（交付物落地）——而方案 §3.6/§3.7/§3.10 实际都做了（M1）。
- 误升：E6 的"单用户/不可分享"是 beta 政策，不是本质能力（M2）。
- 未误把实现细节当需求：L124 的实现细节清单分类正确，GitHub App/云 sandbox/PR/配额等都被正确降级为细节。

### 5.3 §3.4 状态机 / §3.6 Library / §3.7 Overview 映射
**结论：三处都是合格的 DSH 适配，但有 1 处核心语义差异（S1）、1 处触发缺失（M4）、1 处语义扩展需声明（M6）、1 处数据形态缺口（M3）。**
- §3.4：`resolve ≠ delete` / reopen / 自动 7 天 / failed→Waiting you 忠实；状态机本身是设计（建议 L4 加标签）；**缺 Claude 自主 resolve 触发（M4）**；运行时归属差异未标（S1）。
- §3.6：拷贝/Replace/配额正确；**缺文件夹/Drive 形态且 `maxFolders` 配置悬空（M3）**；"只读"是推断（L2）；**产出物自动入库缺（M8）**。
- §3.7：六组映射合理，Landing 正确列为非目标；**Ready-for-review 从 PR 扩到任意交付物是语义改变，需在 §6 标注（M6）**；"Idle/Done" 和 failed 持久状态是小偏差（L3/L4）。

### 5.4 与 S1 冲突 / 过度推断
- **无事实性冲突**；过度推断集中在 S2（"刻意/不做执行"）与 L2（"只读"）。
- 引用编号抽查（R1 §4.5、§5、§3.6、§12.3、§7.8 等）**全部对得上 R1 章节**，无错引。

---

## 6. 建议的修改顺序（最小改动集）

1. **进实施前（必须）**：S1（§1.2/§3.4/§6 + M0/M2 验收）、S2（TL;DR #2 / §1.4 E2 / §3.5 标签）。
2. **M1 前**：M3（Library 文件夹决策）、M11（GitHub 前置一句话）、M12（scheduled tasks 级联）、M13（ThreadRecord 字段）。
3. **M2 前**：M4（Claude resolve 触发）、M5（读单线程工具）、M6（Ready-for-review 差异标注）、M8（产出物自动入库）。
4. **M3 前**：M7（权限继承决策）、M9（Pause 差异）、M10（maxActiveThreads 措辞）。
5. **随手**：M2、L1–L6。

---

## 7. 评审边界与免责

- 本评审只覆盖 **Claude 侧规格保真度**与 R1 引用；没有复核 R2/R3 对 DSH 能力（subagent/team/storage/UI seat/Remote）的判断，也没有验证 M0 spike 假设的技术可行性。
- 行号基于 2026-10-22 14:09 的 888 行版本；若方案文档继续编辑，请以章节 + 原文短语定位（本评审每条都同时给了章节和短语）。
- 本评审不修改方案本体（按任务要求只写本文件）。
