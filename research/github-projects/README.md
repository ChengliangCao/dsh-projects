# 类 Claude Projects（Coordinator + Threads + Library/Overview）开源项目调研

> **调研对象**：GitHub 上「一个长期项目容器 + 协调者 + 每个任务一个独立线程 + 项目级共享资料库 + 总览面板」这类系统的开源实现。
> **抓取时间**：2026-10-22 15:05–15:35（Asia/Shanghai）。stars / license / 最近提交均为此时间窗抓取；star 精确值来自 GitHub Search API 或 shields.io（四舍五入到 0.1k 者标注「约」）。
> **基准语义**：Claude Code Projects（public beta）——Project = 一个长期协调会话（Coordinator），任务 = 独立 Thread（独立 context / 分支 / PR，可 steer/Stop、Resolved 可 reopen），项目级 Library（上传资料 + 线程产出物）+ Overview（Threads 六分组 / Library / PR / Scheduled tasks）+ instructions/memory。基准细节见本仓库内部调研 [research/claude-projects/README.md](../claude-projects/README.md) 与官方文档 [code.claude.com/docs/en/claude-projects](https://code.claude.com/docs/en/claude-projects)。
> **配套方案**：DSH 复刻方案见 [docs/dsh-claude-projects-plan.md](../../docs/dsh-claude-projects-plan.md)，本文第 6 节直接对齐该方案的 Project 域 / 线程运行层 / Overview / Library。

## 目录

- [0. 一页结论（TL;DR）](#0-一页结论tldr)
  - [0.1 一句话回答](#01-一句话回答)
  - [0.2 五条最重要结论](#02-五条最重要结论)
  - [0.3 「已被验证 / 已被超越 / 仍是空白」速览](#03-已被验证--已被超越--仍是空白速览)
- [1. 调研方法与证据说明](#1-调研方法与证据说明)
  - [1.1 Claude Projects 基准语义](#11-claude-projects-基准语义)
  - [1.2 发现与深读路径](#12-发现与深读路径)
  - [1.3 证据分级与抓取口径](#13-证据分级与抓取口径)
- [2. 项目清单表](#2-项目清单表)
  - [2.1 图例](#21-图例)
  - [2.2 多 agent 工作台 / 编排（Workbench & Orchestration）](#22-多-agent-工作台--编排workbench--orchestration)
  - [2.3 项目 / 任务管理层（Spec & PM）](#23-项目--任务管理层spec--pm)
  - [2.4 编排框架 / 平台（只列与「长项目+多线程+共享资料」相关者）](#24-编排框架--平台只列与长项目多线程共享资料相关者)
  - [2.5 会话 / 线程 / 沙箱实现机制横向索引](#25-会话--线程--沙箱实现机制横向索引)
  - [2.6 必覆盖候选核对表](#26-必覆盖候选核对表)
- [3. 与 Claude Projects 的能力对照](#3-与-claude-projects-的能力对照)
  - [3.1 对照能力的定义](#31-对照能力的定义)
  - [3.2 能力对照矩阵](#32-能力对照矩阵)
  - [3.3 对照结论：哪些语义已被验证、被超越、仍空白](#33-对照结论哪些语义已被验证被超越仍空白)
- [4. 重点项目深读（10 个）](#4-重点项目深读10-个)
  - [4.1 Orchestrator.inc（agent-orchestrator）——最接近「Coordinator + Threads + Overview」的开源实现](#41-orchestratorincagent-orchestrator最接近coordinator--threads--overview的开源实现)
  - [4.2 Vibe Kanban——worktree + 任务板数据模型最完整（但已宣布 sunset）](#42-vibe-kanbanworktree--任务板数据模型最完整但已宣布-sunset)
  - [4.3 Claude Squad——tmux 会话 + git worktree 的经典并发模型](#43-claude-squadtmux-会话--git-worktree-的经典并发模型)
  - [4.4 CCPM——GitHub Issues + worktree + 文件态项目记忆](#44-ccpmgithub-issues--worktree--文件态项目记忆)
  - [4.5 Gas Town——Mayor / Rig / Witness / Refinery 的多层守护架构](#45-gas-townmayor--rig--witness--refinery-的多层守护架构)
  - [4.6 Agent Deck——conductor + 会话状态机 + watcher 门铃规则](#46-agent-deckconductor--会话状态机--watcher-门铃规则)
  - [4.7 Claude Flow / Ruflo——swarm + 27 hooks + 向量记忆 + mission](#47-claude-flow--rufloswarm--27-hooks--向量记忆--mission)
  - [4.8 Citadel——campaign / continuation state / discovery relay / claims](#48-citadelcampaign--continuation-state--discovery-relay--claims)
  - [4.9 OpenMeld——把「Project + Coordinator + Library」做成多人协作系统](#49-openmeld把project--coordinator--library-做成多人协作系统)
  - [4.10 Nimbalyst（Crystal 继任者）——多会话 worktree + session kanban + 移动端](#410-nimbalystcrystal-继任者多会话-worktree--session-kanban--移动端)
  - [4.11 补充速写（进入评估但不做深读）](#411-补充速写进入评估但不做深读)
- [5. 「Claude 没有但值得做」清单](#5-claude-没有但值得做清单)
- [6. DSH 方案应借用的实现模式（7 个）](#6-dsh-方案应借用的实现模式7-个)
  - [6.1 模式 A：线程双层模型（domain 存意图 + runtime 由会话承载）](#61-模式-a线程双层模型domain-存意图--runtime-由会话承载)
  - [6.2 模式 B：线程简报 + 统一 report 协议（替代 best-effort 通知）](#62-模式-b线程简报--统一-report-协议替代-best-effort-通知)
  - [6.3 模式 C：项目记忆 = 索引 + 按需文件 + 四段 campaign 结构](#63-模式-c项目记忆--索引--按需文件--四段-campaign-结构)
  - [6.4 模式 D：Library = 内容寻址不可变对象 + 项目级索引 + 产出回收](#64-模式-dlibrary--内容寻址不可变对象--项目级索引--产出回收)
  - [6.5 模式 E：Coordinator = 路由/台账/记忆服务 + 对话界面（不是超级 agent）](#65-模式-ecoordinator--路由台账记忆服务--对话界面不是超级-agent)
  - [6.6 模式 F：Overview = 纯函数状态推导 + 注意力路由](#66-模式-foverview--纯函数状态推导--注意力路由)
  - [6.7 模式 G：生命周期与容量治理（Resolved≠Delete、限额、自动收尾）](#67-模式-g生命周期与容量治理resolveddelete限额自动收尾)
  - [6.8 模式组合后的数据流](#68-模式组合后的数据流)
- [7. 检索结果与抓取失败记录](#7-检索结果与抓取失败记录)
  - [7.1 GitHub 检索查询与命中量](#71-github-检索查询与命中量)
  - [7.2 抓取失败 / 存疑 / 未证实清单（不编造）](#72-抓取失败--存疑--未证实清单不编造)
- [8. 证据 URL 索引](#8-证据-url-索引)

### 证据分级约定

| 标记 | 含义 |
| :- | :- |
| 【已证实】 | 项目 README / 源码 / 架构文档 / 官方站点原文直接支持，给出 URL |
| 【已证实·抓取】 | 由本次抓取的元数据（stars、license、pushed_at、文件清单、源码片段）直接支持，给出抓取口径 |
| 【推断】 | 基于已证实证据的合理推理，原项目没有直接这样写 |
| 【未证实】 | 抓取失败或文档未提及；**不等于**不存在 |

---

## 0. 一页结论（TL;DR）

### 0.1 一句话回答

**2026-10 的 GitHub 上，「多 agent 工作台」已经很卷（worktree 隔离、kanban、PR/CI 联动、会话恢复、移动端、多模型），但把 Claude Projects 的四个语义——「Project 作为长期容器 + Coordinator 只做路由/台账/记忆 + Thread 是完整可恢复会话 + 项目级 Library/Overview」——**作为整体**实现的项目仍然没有。** 最接近的是 [Orchestrator.inc](https://github.com/OrchestratorInc/agent-orchestrator)（project orchestrator + workers + 派生 kanban），其次是 [OpenMeld](https://github.com/amplifthq/openmeld)（Spaces + Center Agent + shared files，多了多人协作、少了线程级隔离）和 [Citadel](https://github.com/SethGammon/Citadel)（campaign/continuation state，偏工程纪律而非产品容器）。

关键检索证据：GitHub Search API 查询 `open source claude projects threads library` 在 2026-10-22 返回 **total_count = 0**（见 [7.1](#71-github-检索查询与命中量)）；而 `claude code parallel agents` 有 1,475 个结果。**「并行跑 agent」是红海，「项目管理语义 + 资料库 + 总览」是空白。**

### 0.2 五条最重要结论

1. **【已证实】「线程 = 独立 worktree + 独立分支」是社区共识，实现已经极其成熟。** claude-squad、vibe-kanban、agent-deck、ccmanager、Nimbalyst、Orchestrator.inc、agent-orchestrator 全部采用「每个任务一个 git worktree」，并在其上叠加「会话/终端/状态」。Claude 的 cloud session（独立 branch + PR）在开源里对应物就是「worktree + CLI 进程」。证据：[claude-squad worktree.go](https://github.com/smtg-ai/claude-squad/blob/main/session/git/worktree.go)、[vibe-kanban Workspace 模型](https://github.com/BloopAI/vibe-kanban/blob/main/crates/db/src/models/workspace.rs)、[agent-deck](https://github.com/asheshgoplani/agent-deck)、[ccmanager](https://github.com/kbwo/ccmanager)、[Nimbalyst](https://github.com/nimbalyst/nimbalyst)。

2. **【已证实】「Coordinator 是一个角色，而不是一个更强的 agent」已经在多处被独立验证，但实现方式分两派。** 一派是「独立协调进程/会话」：Orchestrator.inc 的 project orchestrator、Gas Town 的 Mayor、Agent Deck 的 conductor、Orkas 的 Commander、OpenMeld 的 Center Agent；另一派是「用户 + 技能/路由层」：Citadel 的 `/do` Router + Archon、CCPM 的主对话 conductor。**没有一派实现「Coordinator 只读线程汇报（report）而不读 transcript」的边界**——这是 Claude 明确写死、开源尚未产品化的点（Claude 语义："It sees what threads report back, not every step they take"，官方文档）。

3. **【已证实】「Overview 由 live 状态推导而非双写」是开源做得比 Claude 文档更清楚的一处工程模式。** Orchestrator.inc 用 session + PR + CI + review facts 推导 4 列 kanban（Working / Needs you / In review / Ready to merge）；vibe-kanban 的 `WorkspaceWithStatus` 由 `is_running / is_errored` 叠加派生；Agent Deck 用原生 hooks + pane 轮询得到 running / waiting / idle / error 四态。这直接支持 DSH 方案「持久状态只存意图、Client 推导展示态」的决策（见 [6.1](#61-模式-a线程双层模型domain-存意图--runtime-由会话承载)）。

4. **【已证实】Claude 的 Library 语义（上传即拷贝 + Replace + 线程产出物回收）在开源里几乎空白；最接近的是「共享文件/附件 + 版本历史」。** OpenMeld 有 shared files & folders + previous file versions；vibe-kanban 有 `file` / `scratch` 模型；Nimbalyst 选择「plain files on disk，全在 git repo 里」；Citadel 用 evidence artifacts。**没有项目实现「项目级资料库 = 不可变字节库 + 线程只读挂载 + 上传/产出统一索引」**。这既是 Claude 的实现细节，也是产品差异化点（见 [5](#5-claude-没有但值得做清单) 与 [6.4](#64-模式-dlibrary--内容寻址不可变对象--项目级索引--产出回收)）。

5. **【已证实】开源在 Claude 之外至少多了 6 类能力，且都有成熟先例：多模型/本地模型、多用户协作、移动端、成本看板、自托管、工程纪律/证据（evidence）。** 代表：Nimbalyst 的 iOS companion + 多 agent；OpenMeld / OpenTag 的多人协作 + 审批 + 分享链接；amux 的 Rust+SQLite 本地控制面 + 手机端；Agent Deck / Ruflo console 的成本/用量看板；Superpowers / spec-kit / BMAD 的工程流程与技能库；Citadel 的 evidence contract（passed/failed/blocked/unknown）。这些是 DSH 可以「只做 Claude Projects 语义、但把差异点留作扩展位」的参考（见 [5](#5-claude-没有但值得做清单)）。

### 0.3 「已被验证 / 已被超越 / 仍是空白」速览

| 判定 | 语义 | 开源证据（样例） |
| :- | :- | :- |
| ✅ 已被验证 | 线程级隔离（worktree + 独立分支/会话） | claude-squad、vibe-kanban、ccmanager、Nimbalyst、Orchestrator.inc |
| ✅ 已被验证 | 线程台账 + 实时状态推导 | Orchestrator.inc kanban、vibe-kanban WorkspaceWithStatus、agent-deck status detection |
| ✅ 已被验证 | 协调者/编排者（规划、拆任务、派发、跟踪） | Gas Town Mayor、Orchestrator.inc orchestrator、OpenMeld Center Agent、Orkas Commander |
| ✅ 已被验证 | 任务板 / Overview（含注意力路由） | vibe-kanban kanban、Nimbalyst session kanban、Orchestrator.inc 4 列、ntasker board |
| ✅ 已被验证 | 项目级持久记忆 / 上下文接力 | Citadel campaign files、beads（Dolt + `bd remember`）、CCPM `.claude/epics/` |
| ↕️ 已被超越（Claude 无） | 多人协作、移动端、本地模型、成本看板、自托管 | OpenMeld、OpenTag、Nimbalyst iOS、amux、agent-deck cost dashboard、Kortix |
| ⚠️ 部分实现 | Resolved / Reopen / Archive 语义 | vibe-kanban archived + worktree_deleted、agent-deck archive（保留会话/worktree）、ccmanager restore sessions |
| ⚠️ 部分实现 | 项目级资料库（Library） | OpenMeld shared files + version history、vibe-kanban file/scratch、Citadel evidence artifacts |
| 🕳️ 空白 | Project = 长期协调会话 + 线程成员 + 共享库 + Overview 的**整体产品** | GitHub 检索 0 命中（见 7.1）；无任何项目同时具备四件套 |
| 🕳️ 空白 | Coordinator「只读汇报、不读 transcript」的边界与 report schema | 无标准；Orchestrator.inc 最接近但仍在 UI 层 |
| 🕳️ 空白 | 线程级成本/用量/限额（对应 Claude 200 线程/天） | 只有全局 cost 面板（agent-deck / Ruflo console），无线程级账本 |
| 🕳️ 空白 | 项目级权限策略 + 线程审批聚合 | 各项目有 agent 自身审批，无「项目策略→线程生效→项目页聚合待批」 |

---

## 1. 调研方法与证据说明

### 1.1 Claude Projects 基准语义

本文以内部调研 [research/claude-projects/README.md](../claude-projects/README.md)（依据 [Claude Code 官方文档](https://code.claude.com/docs/en/claude-projects) 抓取）为基准，抽取 9 条用于对照的语义：

1. **Project** = 一个长期对话 + 共享 repositories / instructions / memory / Library。
2. **Coordinator** = 项目对话里的 Claude 角色；决定「就地回答 / 新开线程 / 复用已有线程 / 给 Suggested threads」；维护线程台账；只看线程汇报；可写 memory；**没有 connectors**。
3. **Thread** = 独立完整会话（默认 cloud session），独立 context；自己的 branch；可开 PR；可看 transcript、steer、回答权限提示、Stop。
4. **Resolved** = 收尾（手动 / 完成后自动 / 一周无活动自动），**不是删除**；可 reopen；分支和 PR 留在 GitHub；**并发硬上限 200 新线程/天**。
5. **Library** = 用户上传文件/文件夹 + 线程产出物；上传是拷贝、改本地不同步、需 Replace；线程以 `/mnt/project-files` 读取。
6. **Overview** = Threads 六分组 + Library / PR / Scheduled tasks tab；注意力路由。
7. **Instructions** = 每次注入（≤16,000 字符）。
8. **Memory** = `MEMORY.md` 索引 + 按需打开文件；协调者与线程都自动压缩。
9. **权限/计费** = 线程沿用项目设置；计费并入 plan limits；单用户不可分享。

> 说明：Claude 的入口限制（CLI/VS Code 不支持等）与本文的「能力对照」无关，未纳入。

### 1.2 发现与深读路径

| 阶段 | 手段 | 说明 |
| :- | :- | :- |
| 发现 | GitHub Search API `https://api.github.com/search/repositories?q=<kw>&sort=stars&order=desc&per_page=20` | 10 组关键词，记录 total_count 与 top20，见 [7.1](#71-github-检索查询与命中量) |
| 发现 | `web_search`（中英文） | 用于找 Conductor 类闭源/新项目与官方博客，见各项目 URL |
| 元数据 | GitHub Search API（`repo:` 限定，一次一个仓库）／shields.io 徽章 JSON／GitHub Atom feed（`github.com/<repo>/commits/HEAD.atom` 取最近提交时间） | 抓取口径：stars 精确值优先，`xx.xk` 为 shields 四舍五入；更新时间取默认分支最新提交 |
| README | `https://cdn.jsdelivr.net/gh/<owner>/<repo>@HEAD/README.md`（raw.githubusercontent.com 在本机不可达，见 7.2） | 共抓取 40 份 README（约 0.79 MB 正文） |
| 源码/架构 | jsDelivr 文件树 + 指定源文件（如 vibe-kanban 的 `crates/db/src/models/*.rs`、claude-squad 的 `session/tmux/tmux.go`）+ `docs/ARCHITECTURE.md` | 只对 10 个深读项目做；引用具体文件路径 |
| 官方站点 | `https://www.conductor.build/docs/...`、`https://code.claude.com/docs/...` | Conductor 为闭源产品，无 GitHub 源码，只能引官方文档 |

### 1.3 证据分级与抓取口径

- **stars/license/pushed_at**：全部标注为「2026-10-22 抓取」。`pushed_at` 取 GitHub API search 结果的默认分支最新提交（`pushed_at`），或 Atom feed 第一条 `<updated>`；两者在抽样上一致（如 ccpm 均为 2026-10-19）。
- **README 内容**：标注【已证实】并给 repo URL（部分给源码路径）。README 自述但未能交叉验证的功能，标注【已证实·README 自述】。
- **机制细节**：只写抓到的字段/函数/文件路径；没抓到的写【未证实】。
- **star 数时效**：2026-10 的快照，且不少项目日更（例如 agent-orchestrator、openmeld、compozy 的 pushed_at 就是抓取当天），引用时保留日期。

---

## 2. 项目清单表

### 2.1 图例

- **核心概念**列为「它用什么概念对应 Claude Projects 的 Project / Coordinator / Thread / Library / Overview」。
- **实现机制**列写技术栈与关键机制（存储、隔离、并发、通信）。
- 标 * 者为第 4 节深读项目。
- 「更新」= 默认分支最近提交日期（2026-10-22 抓取）。

### 2.2 多 agent 工作台 / 编排（Workbench & Orchestration）

| # | 项目（GitHub） | stars | license | 更新 | 核心概念映射 | 实现机制 |
| :- | :- | --: | :- | :- | :- | :- |
| 1 | [Orchestrator.inc / agent-orchestrator](https://github.com/OrchestratorInc/agent-orchestrator) * | 13,471 | Apache-2.0 | 2026-10-22 | Project=repo；Coordinator=project orchestrator；Thread=worker session；Overview=派生 kanban；Library=附件（弱） | Electron 桌面 app + 本地 daemon；每 worker 独立 branch+worktree、独立浏览器 profile；PR/CI/review 状态吸附在 session 上；kanban 列由事实推导 |
| 2 | [Vibe Kanban](https://github.com/BloopAI/vibe-kanban) *（已宣布 sunset） | 28,425 | Apache-2.0 | 2026-09-19 | Project=projects；Thread=workspace（branch+terminal+dev server）；Overview=kanban；Library=弱（file/scratch） | Rust（axum/sqlx/SQLite，内嵌 migration）+ React/TS 前端（ts-rs 生成类型）+ npx 启动；每 workspace 一支 worktree、可多仓（workspace_repo）；状态 `Todo/InProgress/InReview/Done/Cancelled` |
| 3 | [Claude Squad](https://github.com/smtg-ai/claude-squad) * | 8,645 | AGPL-3.0 | 2026-08-20 | 无 Project/Coordinator；Thread=instance（tmux 会话 + worktree）；Overview=TUI 列表 + diff 预览 | Go + TUI；每 instance 一个 tmux 会话（前缀 `claudesquad_`）+ 一个 worktree；状态存 `~/.claude-squad/state.json`；pane 抓屏做 transcript；`c` 停/`r` 续/`s` push |
| 4 | [Agent Deck](https://github.com/asheshgoplani/agent-deck) * | 1,138 | MIT | 2026-10-21 | Group≈Project；Conductor=Coordinator；Session=Thread；Overview=TUI 四态 + 通知栏 | Go TUI + SQLite 状态库；tmux 会话；conductor 为一等实体；原生 hooks（Claude statusLine / Codex notify / pi 扩展）+ pane 轮询做状态；watcher 事件去重（SQLite） |
| 5 | [CCManager](https://github.com/kbwo/ccmanager) | ≈1.3k | MIT | 2026-10-18 | 多 project 管理；Thread=session/worktree；无 Coordinator | Node/TS CLI；自包含 PTY、**不依赖 tmux**；worktree 创建/合并/删除；可恢复上次会话；在 worktree 间复制 Claude session 数据；`.worktreeinclude`；devcontainer；状态检测策略可配置 |
| 6 | [Crystal](https://github.com/stravu/crystal) → [Nimbalyst](https://github.com/nimbalyst/nimbalyst) * | 3,134 / 1,957 | MIT | 2026-02-26 / 2026-10-21 | Session≈Thread；session kanban≈Overview；任务跟踪≈Library 旁路；无独立 Coordinator | Electron；每 session 独立 worktree；WYSIWYG 编辑器 + 红绿 diff；plain files on disk；iOS companion；扩展 SDK（EditorHost） |
| 7 | [Orkas](https://github.com/Orkas-AI/Orkas) | 2,147 | MIT | 2026-10-22 | Project=goals/rules/memory/files；Coordinator=Commander；Thread=Conversation/To-do；Overview=to-do 列表 | 本地桌面 app；项目容器持 goal+规则+记忆+文件；To-do 给人或 agent；Auto-advance；定时自动化；CLI agent 作为本地会话接入 |
| 8 | [OpenMeld](https://github.com/amplifthq/openmeld) * | 1,390 | MIT | 2026-10-22 | Space≈Project；Center Agent≈Coordinator；Task/Conversation≈Thread；Library=shared files；Overview=tasks/team chat | TypeScript/React/Electron + Cloudflare + PostgreSQL；本地 agent 通过 CLI 接入「Computers」；共享文件/文件夹+版本历史；审批；跨 chat memory；计划任务 |
| 9 | [amux](https://github.com/mixpeek/amux) | 543 | NOASSERTION | 2026-10-22 | Control plane；Thread=worker session；Overview=dashboard；消息/任务板 | 单个 Rust 二进制 + SQLite，本地优先；**原子领卡的任务板**、agent 互发消息、崩溃自愈重启、schedules/loops、手机/Mac/browser、任意模型 |
| 10 | [AionUi](https://github.com/iOfficeAI/AionUi) | 33,690 | Apache-2.0 | 2026-10-19 | Cowork 工作台；多 agent 并行会话；无 Project/Coordinator | 内置 agent 引擎（aionrs）+ 自动检测 20+ CLI agent；并行会话独立 context；MCP 统一管理；21 个内置 assistant |
| 11 | [Compozy](https://github.com/compozy/compozy) | 2,810 | MIT | 2026-10-22 | 「Agent OS」；接入已有 CLI agent | 本地优先的操作系统式编排层（README 摘要） |
| 12 | [Agent Teams AI](https://github.com/777genius/agent-teams-ai) | 2,288 | AGPL-3.0 | 2026-10-22 | 「你是老板，agent 是团队」；agent 互相发消息/评审 | 多 agent 团队协作（README 摘要），强调 peer messaging + review |
| 13 | [multi-agent-shogun](https://github.com/yohey-w/multi-agent-shogun) | 1,424 | MIT | 2026-08-06 | tmux 并行多 agent；角色化 | tmux 会话编排；README 约 89KB，偏方法论/工作流 |
| 14 | [clawport-ui](https://github.com/JohnRiceML/clawport-ui) | 904 | MIT | 2026-03-24 | Claude Code agent 团队指挥台 | 基于 OpenClaw 的 command center |
| 15 | [ntasker](https://github.com/nerdocs/ntasker) | 4 | AGPL-3.0 | 2026-10-20 | Board=agent 记忆；Queue 持续执行；Inbox | 本地看板 + 插件 + 队列；「board is your agent's memory」；任务可指派不同 agent |
| 16 | [casefile](https://github.com/azimov777/casefile) | 6 | MIT | 2026-10-20 | 每个任务一份「案卷」（决策/死路/未决问题） | 任务级 case file，解决 agent 跨 session 失忆 |
| 17 | [cezar](https://github.com/open-mercato/cezar) | 778 | MIT | 2026-10-21 | Orchestrator + ADE | 多 CLI agent 编排与开发环境 |
| 18 | [proliferate](https://github.com/proliferate-ai/proliferate) | 518 | AGPL-3.0 | 2026-10-15 | 并行 agent 的 AI IDE | 开源 AI IDE（Claude Code/Codex/OpenCode） |
| 19 | [OpenTag](https://github.com/fancyboi999/open-tag)（agent-teams-ai 见 #12） | 212 | Apache-2.0 | 2026-08-22 | 类 Slack 的「团队 + agent」工作区（Claude Tag 的自托管替代） | 自托管多人工作区，频道式协作 |
| 20 | [limuyang2/agent-team](https://github.com/limuyang2/agent-team) | 44 | MIT | 2026-08-26 | **DSH 插件**：Leader=Coordinator；member=Thread；Workspace=共享目录；Assistant Library | 明确面向 DeepSeek Harness；每 member 独立 provider/model/preset/权限/skills/MCP；Leader 建任务派活；工作台并排流式输出；token/cache 统计 |
| 21 | [Conductor](https://www.conductor.build/)（闭源） | — | 闭源商业 | — | 并行 agent 工作台（branch/worktree） | **无 GitHub 源码**；仅官方文档。检索到的同名 repo 均为第三方仿作（如 [dobrinov/conductor](https://github.com/dobrinov/conductor)、[diego-segura/conduct](https://github.com/diego-segura/conduct)、[ryanmac/code-conductor](https://github.com/ryanmac/code-conductor)），不构成官方实现 |

### 2.3 项目 / 任务管理层（Spec & PM）

| # | 项目（GitHub） | stars | license | 更新 | 核心概念映射 | 实现机制 |
| :- | :- | --: | :- | :- | :- | :- |
| 22 | [CCPM](https://github.com/automazeio/ccpm) * | 8,414 | MIT | 2026-10-19 | Project=epic；Coordinator=主对话 conductor；Thread=parallel stream/GitHub issue；Library=`prds/`+`epics/` 文件；Overview=standup/status 脚本 | Agent Skill（agentskills.io）；`.claude/prds/` 与 `epics/` 文件为源；GitHub Issues 为协作层；epic worktree；task frontmatter `parallel/depends_on/conflicts_with`；14 个 bash 脚本做确定性查询 |
| 23 | [claude-task-master](https://github.com/eyaltoledano/claude-task-master) | 28,263 | NOASSERTION | 2026-04-28 | Project=PRD；Thread=task 图；Library=PRD/tasks.json | CLI + MCP server；PRD 解析成任务 DAG；复杂度分析/模型选择；多编辑器配置 |
| 24 | [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) | 54,423 | 未识别（README 标 MIT） | 2026-10-20 | 项目=delivery loop；角色/工作流；Library=briefs/specs/architecture 产物 | v6.12 稳定 + v7 skills；npm installer / skills CLI / 插件市场；Python 脚本；强调 durable context |
| 25 | [spec-kit](https://github.com/github/spec-kit) | 142k | MIT | 2026-10-21 | 项目=spec 驱动；规格→计划→任务→实现 | GitHub 官方；`/specify /plan /tasks /implement` 流程；模板/脚本 |
| 26 | [agent-os](https://github.com/buildermethods/agent-os) | 5.5k | MIT | 2026-10-07 | 项目=standards + specs | 提取代码库标准→按需注入；shape spec；index standards |
| 27 | [Superpowers](https://github.com/obra/superpowers) | 303,292 | MIT | 2026-10-21 | 方法库（skills）而非项目容器 | 技能/工作流市场；20+ harness 安装；process discipline |
| 28 | [beads](https://github.com/steveyegge/beads) | 18k | MIT | 2026-10-22 | Project=repo+`.beads`；Thread=issue+claim；**Library=记忆（`bd remember`）**；Overview=`bd ready` | Go + **Dolt**（版本化 SQL，cell-level merge，`bd dolt push/pull` 同步）；hash ID 防冲突；dependency graph；atomic claim；compaction（记忆衰减）；message 线程；多 writer server 模式 |
| 29 | [Gas Town](https://github.com/steveyegge/gastown) * | 18k | MIT | 2026-10-20 | Town/Rig=Project；Mayor=Coordinator；Polecat=worker Thread；Hooks=持久工作区；Convoy/Beads=任务与记忆 | Go；tmux 会话 + git worktree hooks；Witness/Deacon 看门狗；Refinery 合并队列；Scheduler 限流；Seance 会话续接；git-backed beads 台账 |

> 说明：任务管理层里，**只有 CCPM 与 Gas Town 真正把「项目容器 + 协调者 + 任务单元 + 状态总览」做成了可运行系统**；BMAD/spec-kit/agent-os/Superpowers 是「方法与规格层」，不提供运行时；beads 是「状态与记忆层」，不是项目容器。

### 2.4 编排框架 / 平台（只列与「长项目+多线程+共享资料」相关者）

| # | 项目 | stars | license | 更新 | 可映射到 Claude Projects 的部分 | 关键机制 |
| :- | :- | --: | :- | :- | :- | :- |
| 30 | [OpenHands](https://github.com/All-Hands-AI/OpenHands) | 92k | MIT | 2026-10-22 | Agent Canvas（对话/工作区）；conversation≈Thread；workspace≈Library 容器 | Agent Server（REST，跑多 agent 的单机服务）+ TypeScript client + Automation Server（调度/webhook/run history）；workspace 与 conversation 是服务端一等对象；可自托管 |
| 31 | [Kortix（原 Suna）](https://github.com/kortix-ai/suna) | 20k | 未识别 | 2026-10-22 | 「公司=一个 git 仓库」：`kortix.yaml` + agents/skills/memory 在 repo；每 session 一台 cloud computer + 独立 branch | 自托管/托管云；Slack/定时/3000+ 集成；"each session is a sandbox on its own branch" |
| 32 | [LangGraph](https://github.com/langchain-ai/langgraph) | 44k | MIT | 2026-10-21 | **Thread 的工程原型**：`thread_id` + checkpointer（状态持久化、time travel、human-in-the-loop） | 图状态/checkpointer/中断恢复；是 DSH 线程「可恢复会话」的参考实现 |
| 33 | [AutoGen](https://github.com/microsoft/autogen)（**已归档**） | 62k | 未识别 | 2026-10-16 | 多 agent 团队/群聊；状态持久化 | 已归档，官方指向 [microsoft/agent-framework](https://github.com/microsoft/agent-framework)；历史价值：AgentChat team + state 序列化 |
| 34 | [CrewAI](https://github.com/crewAIInc/crewAI) | 60k | MIT | 2026-10-21 | crew≈协作单元；flow≈项目流程；AMP 控制面 | crews + flows；控制面（部署/监控）；memory/知识配置 |
| 35 | [MetaGPT](https://github.com/FoundationAgents/MetaGPT) | 71k | MIT | 2026-01-21 | 「软件公司=多 agent 系统」：SOP/角色/共享消息池/项目 workspace | 角色 SOP、共享 message pool、产物落 workspace；更像「模拟团队」而非「项目容器」 |
| 36 | [Agno](https://github.com/agno-agi/agno) | 43k | Apache-2.0 | 2026-10-21 | AgentOS 平台：agent/team/workflow + session 存储 | 多 agent team、workflow、session/记忆持久化；可配合 coding agent |

> 结论：这些框架提供的是「agent 编排原语」（图、团队、会话、状态持久化），**不提供 Project 容器/资料库/Overview 的产品语义**；对 DSH 的价值主要是线程可恢复性的实现参考（LangGraph 的 thread/checkpointer 模型）。

### 2.5 会话 / 线程 / 沙箱实现机制横向索引

| 机制 | 代表项目 | 具体做法（可指导实现） |
| :- | :- | :- |
| git worktree 隔离 | claude-squad、vibe-kanban、ccmanager、agent-deck、Nimbalyst、Orchestrator.inc、CCPM | 每线程一个 worktree + branch；记录 `path/branch/baseCommit`；支持 `worktree_deleted/archived`；`.worktreeinclude` 带 gitignored 文件；setup/destruction 脚本 |
| tmux/PTY 会话 | claude-squad（tmux）、agent-deck（tmux）、multi-agent-shogun、ccmanager（自研 PTY） | 会话命名空间前缀；`capture-pane` 做 transcript；pane hash 做「是否有新输出/是否在等输入」；attach/detach；崩溃后可重新 attach 或 resume |
| 容器/沙箱 | OpenHands（Agent Server/workspace）、Kortix（cloud computer/sandbox per session）、Claude 本身 cloud session | 每线程一台隔离执行环境；服务端对象模型（conversation/workspace/events） |
| 任务板/Kanban | vibe-kanban、Nimbalyst、Orchestrator.inc、ntasker、agent-board | 任务状态枚举 + parent workspace 关联；列由运行事实推导；archived/pinned |
| 状态持久化 | claude-squad（JSON）、vibe-kanban（SQLite+sqlx）、agent-deck（SQLite）、beads（Dolt）、OpenMeld（PostgreSQL）、Citadel（markdown campaign） | 单文件 JSON 适合小工具；SQLite 适合本地多会话；Dolt/Postgres 适合多人/多机；markdown 适合人读+git diff |
| 消息/邮箱 | amux（agent 互发消息）、beads（message 类型）、Gas Town（mailboxes/handoffs）、Agent Deck（watcher→conductor doorbell） | 线程间通信不共享 context，只传结构化消息/事件；接收方按需读取 |
| hooks | Claude Flow（27 hooks）、Citadel（36 脚本/29 事件）、agent-deck（status hooks）、vibe-kanban（setup/archive scripts） | 用生命周期事件做路由/质量门/状态同步；DSH 已有 session/event，可复用而非另建 hook 系统 |
| MCP | 上述几乎所有工作台都支持 MCP 配置（claude-squad profiles、agent-deck MCP manager、Nimbalyst client+servers、CCManager） | MCP 是「资料/工具接入」的公共层；Claude 的 Coordinator 自己不能用 connector → DSH 可原样继承 |
| 恢复/关闭/归档 | vibe-kanban（archived/worktree_deleted、reset to process）、agent-deck（archive 保留会话+worktree、resume、fork）、ccmanager（restore sessions）、Gas Town（Seance `.events.jsonl`） | **Resolved≠Delete** 是共性最佳实践；会话记录与工作区可以分离清理 |

### 2.6 必覆盖候选核对表

| 候选（任务清单） | 结论 | 说明 / URL |
| :- | :- | :- |
| claude-squad（smtg-ai） | ✅ 覆盖并深读 | 8,645★ AGPL-3.0，2026-08-20；[repo](https://github.com/smtg-ai/claude-squad) |
| vibe-kanban（BloopAI） | ✅ 覆盖并深读 | 28,425★ Apache-2.0；**已宣布 sunset**（[公告](https://www.vibekanban.com/blog/shutdown)），抓到时 2026-09-19 仍在更新 |
| Crystal（stravu） | ✅ 覆盖；README 抓取失败 | 3,134★ MIT，2026-02-26；repo 描述自述「Crystal is now Nimbalyst」；README 404（见 7.2）。已深读继任者 [Nimbalyst](https://github.com/nimbalyst/nimbalyst) |
| Conductor | ✅ 核对：**闭源**，非 GitHub 项目 | 官方文档 [conductor.build/docs/concepts/parallel-agents](https://www.conductor.build/docs/concepts/parallel-agents)；GitHub 上同名项目均为第三方仿作 |
| ccmanager | ✅ 覆盖 | ≈1.3k★ MIT，2026-10-18；[repo](https://github.com/kbwo/ccmanager) |
| agent-deck | ✅ 覆盖并深读 | 1,138★ MIT，2026-10-21；[asheshgoplani/agent-deck](https://github.com/asheshgoplani/agent-deck)（注：另有同名/近名 `ubar0090/agent-deck`、`a-streetcoder/agent-deck`、`puritysb/AgentDeck`，以 1,138★ 这个为准） |
| opcode（原 claudia） | ✅ 覆盖 | [winfunc/opcode](https://github.com/winfunc/opcode) 约 22k★ AGPL-3.0，2026-09-18；桌面 GUI + 自定义 agent + 后台 session |
| omnara | ✅ 覆盖 | [omnara-ai/omnara](https://github.com/omnara-ai/omnara) 3.1k★ Apache-2.0，2026-10-22；自托管 managed agent platform（API/工具/权限/流式） |
| happy（slopus） | ✅ 覆盖 | [slopus/happy](https://github.com/slopus/happy) 24k★ MIT，2026-10-21；多模型 harness + 移动端（iOS/Android/桌面） |
| CCPM（automazeio） | ✅ 覆盖并深读 | 8,414★ MIT，2026-10-19；[repo](https://github.com/automazeio/ccpm) |
| claude-task-master（eyaltoledano） | ✅ 覆盖 | 28,263★（license 未识别），2026-04-28；[repo](https://github.com/eyaltoledano/claude-task-master) |
| BMAD-METHOD | ✅ 覆盖 | 54,423★，2026-10-20；[repo](https://github.com/bmad-code-org/BMAD-METHOD)（README 标 MIT，GitHub 未识别） |
| github/spec-kit | ✅ 覆盖 | 142k★ MIT，2026-10-21；[repo](https://github.com/github/spec-kit) |
| agent-os（buildermethods） | ✅ 覆盖 | 5.5k★ MIT，2026-10-07；[repo](https://github.com/buildermethods/agent-os) |
| Superpowers（obra） | ✅ 覆盖 | 303,292★ MIT，2026-10-21；[repo](https://github.com/obra/superpowers) |
| beads（steveyegge） | ✅ 覆盖 | 18k★ MIT，2026-10-22；[repo](https://github.com/steveyegge/beads) |
| gastown（steveyegge） | ✅ 覆盖并深读 | 18k★ MIT，2026-10-20；[repo](https://github.com/steveyegge/gastown) |
| claude-flow（ruvnet） | ✅ 覆盖并深读 | 78k★ MIT，2026-10-22；现已更名 **Ruflo**；[repo](https://github.com/ruvnet/claude-flow)（README 指向 ruvnet/ruflo） |
| OpenHands | ✅ 覆盖 | 92k★ MIT，2026-10-22；[repo](https://github.com/All-Hands-AI/OpenHands) |
| Suna（kortix-ai） | ✅ 覆盖；已更名 | 20k★，2026-10-22；README 现为 **Kortix**（`kortix.yaml`，company as a git repo） |
| AutoGen | ✅ 覆盖；**已归档** | 62k★，2026-10-16；README 顶部 Archived 徽章，指向 microsoft/agent-framework |
| CrewAI | ✅ 覆盖 | 60k★ MIT，2026-10-21 |
| MetaGPT | ✅ 覆盖 | 71k★ MIT，2026-01-21 |
| Agno | ✅ 覆盖 | 43k★ Apache-2.0，2026-10-21 |
| LangGraph | ✅ 覆盖 | 44k★ MIT，2026-10-21 |
| （增补）Orchestrator.inc | 🆕 深读 | 13,471★ Apache-2.0，2026-10-22；最接近 Claude Projects 四件套 |
| （增补）OpenMeld | 🆕 深读 | 1,390★ MIT，2026-10-22；多人协作版 |
| （增补）Citadel | 🆕 深读 | 925★ MIT，2026-10-21；campaign/continuation 工程纪律 |
| （增补）Nimbalyst | 🆕 深读 | 1,957★ MIT，2026-10-21；Crystal 继任者 |
| （增补）amux / Orkas / AionUi / agent-teams-ai / ntasker / cezar / open-tag | 🆕 列表覆盖 + 速写 | 见 2.2/2.3 与 4.11 |
| （增补）limuyang2/agent-team | 🆕 速写（与 DSH 直接相关） | 44★ MIT，2026-08-26；DSH 插件实现 Leader+members |

> 检索说明：任务清单里的项目除 Conductor（闭源）外全部在 GitHub 上找到并核对了元数据；其中 Crystal 已由 Nimbalyst 取代、claude-flow 已更名 Ruflo、Suna 已更名 Kortix、AutoGen 已归档、vibe-kanban 已宣布 sunset——这些「状态变化」本身就是 2026 年该领域的重要信息。

---

## 3. 与 Claude Projects 的能力对照

### 3.1 对照能力的定义

| 能力 | 判定标准（本表口径） |
| :- | :- |
| **Project 容器** | 有显式的「项目/空间」实体，承载仓库、指令、成员与生命周期（pause/archive/delete） |
| **Coordinator** | 有独立的规划/路由/派发角色（人或 agent），维护任务台账，能看到各线程状态 |
| **Threads** | 有「一个任务 = 一个可独立运行/恢复/停止的执行单元」的实体，且与其它线程 context 隔离 |
| **Library** | 项目级共享资料：上传文件、线程产出物、索引/版本/替换语义 |
| **Overview** | 项目级总览面板/看板，聚合线程状态、PR/CI、待处理事项 |
| **Resolved/Reopen** | 完成/收尾是独立状态（≠删除），可 reopen 并保留会话/分支 |
| **隔离** | 线程间代码隔离（worktree/沙箱/容器）或至少工作区隔离 |
| **记忆** | 跨会话/跨线程的项目级持久记忆（索引 + 按需读取/注入） |
| **权限** | 工具/命令审批与策略（按线程或项目生效） |
| **多人协作** | 多个真人可共享同一项目/线程/资料 |
| **本地模型** | 可接本地/多厂商模型（Ollama、OpenAI、Gemini 等） |
| **移动端** | 手机/平板可查看与操作（原生 app 或 PWA） |
| **成本控制** | 用量/成本可见，或有预算/限额机制 |

### 3.2 能力对照矩阵

图例：✅ 完整实现 ／ ◐ 部分或近似 ／ ❌ 未实现 ／ — 不适用 ／ ? 未证实

| 项目 | Project 容器 | Coordinator | Threads | Library | Overview | Resolved/Reopen | 隔离 | 记忆 | 权限 | 多人 | 本地模型 | 移动端 | 成本 |
| :- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| **Claude Projects（基准）** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅(cloud) | ✅ | ✅ | ❌ | ❌ | ✅(App) | ◐(plan limits) |
| Orchestrator.inc | ✅ | ✅ | ✅ | ◐ | ✅ | ✅ | ✅ | ◐ | ◐ | ❌ | ✅ | ❌ | ❌ |
| Vibe Kanban | ✅ | ❌ | ✅ | ◐ | ✅ | ✅ | ✅ | ❌ | ◐ | ✅ | ✅ | ❌ | ❌ |
| Claude Squad | ❌ | ❌ | ✅ | ❌ | ◐ | ❌ | ✅ | ❌ | ◐ | ❌ | ✅ | ❌ | ❌ |
| Agent Deck | ◐ | ✅ | ✅ | ◐ | ✅ | ✅ | ◐ | ◐ | ◐ | ◐ | ✅ | ◐ | ✅ |
| CCManager | ◐ | ❌ | ✅ | ❌ | ◐ | ✅ | ✅ | ◐ | ◐ | ❌ | ✅ | ❌ | ❌ |
| Nimbalyst | ◐ | ❌ | ✅ | ◐ | ✅ | ✅ | ✅ | ◐ | ◐ | ❌ | ✅ | ✅ | ❌ |
| Orkas | ✅ | ✅ | ✅ | ◐ | ✅ | ◐ | ◐ | ✅ | ◐ | ◐ | ✅ | ❌ | ◐ |
| OpenMeld | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ | ◐ | ✅ | ✅ | ✅ | ✅ | ◐ | ◐ |
| amux | ◐ | ❌ | ✅ | ◐ | ✅ | ◐ | ? | ◐ | ◐ | ◐ | ✅ | ✅ | ◐ |
| AionUi | ◐ | ❌ | ✅ | ◐ | ✅ | ◐ | ◐ | ◐ | ◐ | ❌ | ✅ | ❌ | ❌ |
| CCPM | ✅ | ◐ | ◐ | ◐ | ✅ | ✅ | ◐ | ✅ | ◐ | ✅ | ◐ | ❌ | ◐ |
| claude-task-master | ◐ | ❌ | ◐ | ◐ | ◐ | ◐ | ❌ | ◐ | — | ◐ | ◐ | ❌ | ◐ |
| BMAD / spec-kit / agent-os | ◐ | ❌ | ❌ | ◐ | ❌ | — | ❌ | ✅ | — | ◐ | ◐ | ❌ | — |
| Superpowers | ❌ | ❌ | ❌ | ◐(技能库) | ❌ | — | ❌ | ◐ | — | ◐ | ◐ | ❌ | — |
| beads | ◐ | ❌ | ◐ | ◐(记忆) | ◐ | ✅ | ❌ | ✅ | ◐ | ✅ | — | ❌ | — |
| Gas Town | ✅ | ✅ | ✅ | ◐ | ◐ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ◐ |
| Citadel | ✅ | ◐ | ◐ | ◐ | ◐ | ◐ | ✅ | ✅ | ✅ | ❌ | ◐ | ❌ | ◐ |
| Claude Flow / Ruflo | ◐ | ◐ | ✅ | ◐ | ✅ | ◐ | ◐ | ✅ | ✅ | ◐ | ✅ | ❌ | ✅ |
| agent-teams-ai | ❌ | ◐ | ✅ | ❌ | ◐ | ◐ | ? | ◐ | ◐ | ◐ | ✅ | ❌ | ❌ |
| ntasker | ✅(board) | ❌ | ✅ | ◐ | ✅ | ◐ | ❌ | ✅ | ◐ | ❌ | ✅ | ❌ | ❌ |
| limuyang2/agent-team | ◐ | ✅ | ✅ | ◐ | ✅ | ◐ | ◐ | ◐ | ✅ | ◐ | ✅ | ❌ | ◐ |
| OpenHands | ◐ | ❌ | ✅ | ◐ | ✅ | ◐ | ✅ | ◐ | ◐ | ◐ | ✅ | ❌ | ◐ |
| Kortix（Suna） | ✅ | ◐ | ✅ | ◐ | ◐ | ◐ | ✅ | ✅ | ◐ | ✅ | ✅ | ◐ | ◐ |
| LangGraph | — | — | ✅ | — | — | ◐ | — | ✅ | — | — | ✅ | — | — |
| AutoGen / CrewAI / MetaGPT / Agno | — | ◐ | ◐ | — | — | ◐ | — | ◐ | — | ◐ | ✅ | ❌ | ◐ |

> 矩阵读法：**同时满足 Project+Coordinator+Threads+Library+Overview 五列的，只有 Claude Projects 基准与 OpenMeld（Library 强、Threads 弱）**；Orchestrator.inc 五列中 4 列完整但 Library 弱；Gas Town 结构最完整但 Overview/Library 是运维视角。

### 3.3 对照结论：哪些语义已被验证、被超越、仍空白

**已被开源验证的语义（可直接参考实现）**

1. **线程 = 独立 worktree/分支/会话**：7 个以上项目一致；机制已收敛到「worktree + branch + 会话进程」。
2. **线程状态机的最小集**：`running / waiting / idle / error`（agent-deck）或 `is_running / is_errored`（vibe-kanban）或 UI 四列（Orchestrator.inc）。Claude 六分组（active / waiting / needs review / resolved / failed / scheduled）粒度更细，但可由此推导。
3. **完成即收尾、收尾≠删除**：agent-deck archive、vibe-kanban archived + `worktree_deleted`、ccmanager restore、Gas Town `gt done`+Seance，均验证「会话记录保留、工作区可清理」。
4. **派活协议**：Coordinator 给线程的「任务 + 上下文 + 交付要求」在 CCPM（task frontmatter + analysis.md）、Citadel（campaign continuation state）、Orchestrator.inc（worker 带 task/context）里都有近似实现。
5. **项目记忆的形态**：`MEMORY.md` 索引 + 按需文件（Claude）在开源里对应 Citadel campaign 文件（Feature Ledger/Decision Log/Active Context/Continuation State）与 beads（`bd remember` / `bd prime`）。「索引 + 按需读」是共识。

**已被开源超越（Claude Projects 明确没有或弱）**

1. **多人协作**：OpenMeld（team chat + shared files + 审批 + 分享链接）、OpenTag（自托管 Slack 式工作区）、CCPM（GitHub Issues 天然多人）、beads（Dolt 多写同步）。Claude Projects 明确「单用户、不可分享、线程不可迁移」。
2. **移动端**：Nimbalyst iOS companion、amux（iOS/Android/浏览器）、happy（App Store/Google Play）、omnara；Claude 有手机 App，但开源在「手机审批/审查 diff/排队下一任务」上做得更细。
3. **本地/多模型**：几乎所有工作台都支持任意 CLI/模型（Claude Code、Codex、Gemini、OpenCode、Ollama…），Claude Projects 只能 Anthropic 模型。
4. **自托管/本地优先**：vibe-kanban self-host、OpenMeld self-host（有限）、Kortix self-host、OpenHands Agent Server、amux（单 Rust 二进制 + SQLite）。
5. **工程纪律/证据**：Citadel 的 evidence contract（`passed/failed/blocked/unknown`）+ continuation state + policy-enforcer；Superpowers/BMAD/spec-kit 的流程化规矩。Claude Projects 有 instructions，但没有「验收证据」概念。
6. **成本/配额治理**：agent-deck cost dashboard、Ruflo console（tokens/cost）、Gas Town Scheduler（`max_polecats` 限流）。Claude 有 plan limits 但没有本地可编程限额。
7. **跨项目/跨组织联邦**：Ruflo federation（mTLS+ed25519、信任评分）、Gas Town Wasteland（DoltHub 联邦）、beads `bd dolt push/pull`。Claude 完全没有。

**仍是空白（我们的机会）**

1. **Project 四件套的整合**：没有项目同时做到「长期协调会话 + 线程成员 + 项目级资料库 + 项目总览」。GitHub 检索 `open source claude projects threads library` 0 命中（7.1）。
2. **Library 的产品化**：上传拷贝/Replace/线程产出物回收/内容寻址去重/配额，没有开源实现；OpenMeld 的 shared files 是团队聊天附件，不带「线程只读挂载 + 产出回收」。
3. **Report 协议 + 协调者「只看汇报」边界**：无标准 schema；开源 coordinator 普遍能读 transcript（Orchestrator.inc 可打开 worker 对话），没有「协调者只读结构化 report」的产品约束。
4. **线程级用量/限额账本**：对应 Claude 200 线程/天；开源只有全局 cost 面板。
5. **项目级权限策略 → 线程生效 → 项目页聚合待批**：开源各自有 agent 审批，没有这个三层结构。
6. **Resolved 的自动化规则**（完成后自动收尾、N 天无活动收尾、可 reopen）：Claude 有明确规则；开源多数是手动 archive/kill。
7. **多项目/多仓库的「项目域」**：vibe-kanban 支持 workspace 多仓（workspace_repo）、Orchestrator.inc 支持多 repo，但没有「一个项目跨多仓 + 共享资料库 + 线程按仓分派」的产品语义。

---

## 4. 重点项目深读（10 个）

> 选读原则：① 覆盖任务清单里最相关的 6 个（claude-squad、vibe-kanban、ccpm、gastown、claude-flow、agent-deck）；② 补上「最接近 Claude Projects 四件套」的 2026 新项目（Orchestrator.inc、Citadel、OpenMeld、Nimbalyst）。每个项目的「实现机制」写到字段/文件/函数级，便于直接指导 DSH 实现。

### 4.1 Orchestrator.inc（agent-orchestrator）——最接近「Coordinator + Threads + Overview」的开源实现

- **repo**：https://github.com/OrchestratorInc/agent-orchestrator ｜ 13,471★ ｜ Apache-2.0 ｜ 更新 2026-10-22 ｜ Electron 桌面 app + 本地 daemon ｜ 支持 20+ CLI agent（Claude Code、Codex、Cursor、OpenCode、Aider、Copilot、Grok、Kimi、Pi、Amp、Auggie、Droid、Crush、Cline、Goose、Qwen、Continue、Devin、Kiro、Kilo、Vibe 等）。

**概念映射**

| Claude Projects | Orchestrator.inc | 证据 |
| :- | :- | :- |
| Project | 一个 repo + 一个 project 工作区（多个 worker 共享） | README「Add a repository and create a worker session…」 |
| Coordinator | **project orchestrator**：持久规划/协调 agent，维护 project-scoped conversation（目标、决策、约束、历史推理） | README §「The orchestrator plans across the project」 |
| Thread | **worker**：一个任务 + 一个 coding agent + 一个隔离 workspace | README §「Workers execute focused tasks」 |
| Overview | **Kanban**：Working / Needs you / In review / Ready to merge 四列，由 session/PR/CI/review 事实推导 | README §「The Kanban keeps the system legible」 |
| Library | 弱：任务可 attach files、worker 有独立浏览器 profile；无项目级资料库 | README（attach relevant files / browser profiles） |

**与 Claude Projects 的差异**：本地桌面 app（非云端）；不强制 cloud session，worker 是本地进程；orchestrator 能打开 worker 的对话/终端（可读 transcript），而 Claude 的 Coordinator 明确「只看线程汇报」；没有项目级资料库、没有线程级限额、单用户。

**Claude 没有的能力**：① 一个 GUI 里混用 20+ 不同厂商 CLI agent 并按任务选模型；② worker 级隔离浏览器 profile（临时 profile 每 worker 隔离，命名 profile 跨会话复用）；③ PR/CI/review 反馈回路直接回到同一个 worker agent；④ orchestrator 与 worker 的「规划/执行」职责硬边界（「orchestrator owns planning and delegation; workers own implementation, tests, commits, and pull requests」）；⑤ 本地 daemon 持续观察 agent 活动与源码状态。

**实现机制**
- **运行形态**：Electron 前端 + 本地 daemon（app 帮你跑 daemon，无需 CLI）；daemon 监视 agent activity 与 source-control state。
- **worker 隔离**：git-backed worker 各自 branch + worktree；standalone agent 得到「branchless directories」（不要求项目/仓库）。
- **状态聚合**：每个 card 绑定 task、agent、branch、activity、PR、status；kanban 列由事实派生（非手工拖拽即事实源）。
- **反馈回路**：PR、CI、review comments 可回传所属 agent；merged session 保留可见直到 archived。
- **跨平台**：macOS arm64/x64、Windows x64、Linux AppImage/deb/rpm。
- **信源**：README 是唯一抓到的架构描述（未抓到源码细节，标【已证实·README 自述】）。

**DSH 可借鉴**
1. **Coordinator/Worker 职责边界直接写进两个 preset 的系统提示**：Coordinator 不实现、Worker 不规划（对应 DSH `projects-coordinator` / `projects-thread`）。
2. **Overview 四列 = 纯函数推导**：`working / needs-you / in-review / ready-to-merge`，与 Claude 六组合同构可扩展。
3. **线程卡片的字段集**：task + agent + branch + activity + PR + status + deliverables——DSH 的 `ThreadRecord` 可照抄为最小集。
4. **「CI/review → 同一个 agent」闭环**：DSH M3 可做 `report` 回传（线程失败/需要介入时回灌到同线程）。
5. **standalone（无 repo）任务**：DSH 应允许 `Project.dir` 为空的纯文档项目（方案已支持）。

### 4.2 Vibe Kanban——worktree + 任务板数据模型最完整（但已宣布 sunset）

- **repo**：https://github.com/BloopAI/vibe-kanban ｜ 28,425★ ｜ Apache-2.0 ｜ 更新 2026-09-19 ｜ **README 顶部：Vibe Kanban is sunsetting（[公告](https://www.vibekanban.com/blog/shutdown)）**。技术栈：Rust 后端（axum/sqlx/SQLite）、React/TS 前端（ts-rs 由 Rust 类型生成 TS 类型）、pnpm monorepo、`npx vibe-kanban` 启动。
- 抓到的源码：`crates/db/src/models/{task,project,workspace,execution_process,…}.rs`、`crates/services/src/services/container.rs`、`crates/db/src/lib.rs`（sqlx 内嵌 migration）。

**数据模型（源码级，【已证实·抓取】）**

| 表/结构 | 字段（抓到的） | 对 DSH 的意义 |
| :- | :- | :- |
| `Task` | `id, project_id, title, description, status(Todo/InProgress/InReview/Done/Cancelled), parent_workspace_id, created_at, updated_at` | **任务意图**（看板卡）vs 执行环境分离；`parent_workspace_id` 允许任务派生出执行环境 |
| `Workspace` | `id, task_id?, container_ref?, branch, setup_completed_at?, archived, pinned, name?, worktree_deleted, created_at, updated_at` | **线程运行环境**：branch + worktree 路径（`container_ref`）+ 归档/清理两态 + pinned（钉住常驻） |
| `WorkspaceWithStatus` | `workspace + is_running + is_errored` | 运行状态由**叠加推导**（不落库）——正是 DSH 「持久状态只存意图」的先例 |
| `Project` | `id, name, default_agent_working_dir, remote_project_id` | project 容器最小字段（可映射 remote 云端项目） |
| 模型清单 | `coding_agent_turn, execution_process(+logs,+repo_state), file, merge, project, pull_request, repo, requests, scratch, session, tag, task, workspace, workspace_repo` | 线程执行 = 多次 turn/process；多仓 = `workspace_repo`；PR/merge 是独立实体 |

**实现机制**
- **执行环境**：`container.rs` 按 workspace 的每个 repo 建 worktree（`workspace_dir.join(repo.name)`），支持多仓；有 archive script；`set_archived` 标记；「reset session to a specific process: restore worktrees, stop processes, drop later processes」= 时间旅行式回滚（【已证实·抓取】源码注释）。
- **状态机**：Task 五态；Workspace 的 `archived` + `worktree_deleted` 双标志让「归档（保留记录）」与「删除工作区（释放磁盘）」解耦。
- **生命周期**：workspace 创建后跑 setup；到期/孤儿 worktree 自动清理（env `DISABLE_WORKTREE_CLEANUP` 可关）；`pinned` 防清理。
- **多 agent**：10+ agent（Claude Code/Codex/Gemini/Copilot/Amp/Cursor/OpenCode/Droid/CCR/Qwen），MCP server 端口 `MCP_PORT`。
- **部署**：本地 npx / 自托管（Docker）/ 云（remote-web + relay tunnel `VK_TUNNEL`）。
- **注意**：已 sunset，README 不再维护功能承诺；但它是「worktree + 任务板」数据模型最好的公开样本。

**DSH 可借鉴**
1. **`Task` 与 `Workspace` 分表** = DSH `threads` 意图字段与「运行时/工作区字段」分离的现成论证。
2. **`archived` / `worktree_deleted` 解耦**：Resolved 只标记归档；磁盘清理是独立动作（对应 DSH `resolve_thread` 与 M4 worktree 清理）。
3. **`is_running/is_errored` 叠加**：Client 侧派生，避免双写。
4. **reset to process（回滚到某个执行点）**：DSH M4 时间旅行可选实现（会话 event-sourced 天然支持）。
5. **多仓 workspace（workspace_repo）**：DSH `Project.repoDirs[]` + 每线程按仓建 worktree。

### 4.3 Claude Squad——tmux 会话 + git worktree 的经典并发模型

- **repo**：https://github.com/smtg-ai/claude-squad ｜ 8,645★ ｜ AGPL-3.0 ｜ 更新 2026-08-20 ｜ Go + TUI + `web/`（Next.js）。
- 抓到的源码：[`session/tmux/tmux.go`](https://github.com/smtg-ai/claude-squad/blob/main/session/tmux/tmux.go)、[`session/git/worktree.go`](https://github.com/smtg-ai/claude-squad/blob/main/session/git/worktree.go)、[`config/state.go`](https://github.com/smtg-ai/claude-squad/blob/main/config/state.go)、`session/storage.go`、`session/instance.go`。

**概念映射**：无 Project / Coordinator；**Thread = instance**（一个 tmux 会话 + 一个 worktree + 一个 CLI program）；Overview = TUI 列表 + diff/preview tab；**Resolved = 无**（只有 suspend 式 checkout 与 kill）。

**实现机制（源码级，【已证实·抓取】）**
- **tmux 会话**：`tmux new-session -d -s <sanitized> -c <workdir> <program>`；会话前缀 `claudesquad_`；`toClaudeSquadTmuxName` 做名字清洗；设 `history-limit 10000`、`mouse on`；`capture-pane -p -e -J` 取 transcript；`has-session` 判存活；`attach-session` 恢复交互（`Restore()` 用 PTY attach）。
- **状态检测**：`statusMonitor` 对 pane 内容做 hash，`HasUpdated()` 返回 (updated, hasPrompt)——用「内容变化 + 是否出现提示符」推断 agent 在跑还是在等输入（cp. 4.6 的 hooks 方案）。
- **worktree**：`~/.claude-squad/worktrees/<sanitize(branch)>_<UnixNano>`；字段 `repoPath / worktreePath / branchName / baseCommitSHA / isExistingBranch`；支持从已有分支建 worktree。
- **持久化**：`~/.claude-squad/{config.json, state.json, instances.json}`；`Instance` struct：`Title, Path, Branch, Status, Program, Prompt, AutoYes, CreatedAt/UpdatedAt, diffStats`；`state.go` 把 instances 以 RawMessage 存进 `state.json`（**注意：单 JSON 全量写，适合单机小规模，不可并发多写**）。
- **用户操作**：`n` 新建 / `N` 带 prompt 新建 / `o` attach / `ctrl-q` detach / `s` commit+push / `c` checkout（提交并暂停会话）/ `r` resume / `D` kill；`--autoyes` 自动接受 prompt；`--program` 可跑任意 CLI（如 `aider --model ollama_chat/gemma3:1b`，即本地模型）。
- **多 program**：profiles 配置（claude/codex/aider…）。

**Claude 没有的能力**：任意 CLI（不止 Claude）+ 本地模型；attach/detach 原生终端体验；`c` = 「提交当前改动并暂停」这种会话级快照语义。【推断】`c` 的暂停/恢复对长任务很有用，但无计划任务/自动收尾。

**DSH 可借鉴**
1. **状态检测的「内容 hash + prompt 检测」**：DSH 不用 tmux，但有 `session/event`+`agent/status`，可复用同一思想（活动时间 + pendingInteraction）判定 waiting/idle。
2. **会话快照/暂停语义**：`ThreadRecord` 可加 `paused` 或由 session 状态推导（DSH 方案 M3 已有 pause）。
3. **worktree 路径与 baseCommit 必须入线程记录**（DSH `threads[].worktree` 已设计）。
4. **单文件 JSON 的教训**：多线程并发会丢写，DSH 必须用 storage domain（方案已选 `projects` domain 同步写 + durable）。

### 4.4 CCPM——GitHub Issues + worktree + 文件态项目记忆

- **repo**：https://github.com/automazeio/ccpm ｜ 8,414★ ｜ MIT ｜ 更新 2026-10-19 ｜ 形态：**Agent Skill**（agentskills.io 标准），可跑在 Claude Code / Factory / Codex / Cursor 等 harness。
- 关键文件：`.claude/prds/<name>.md`、`.claude/epics/<feature>/{epic.md, <N>.md, <N>-analysis.md, updates/}`、`skill/ccpm/{SKILL.md, references/*.md, scripts/*.sh}`。

**概念映射**：Project = epic（+ PRD）；Coordinator = 主对话（conductor，只做分发与汇总）；Thread = 并行 stream（对应 GitHub sub-issue）；Library = `.claude/` 下的 PRD/epic/analysis 文件；Overview = `status.sh / standup.sh` 的确定性输出。

**实现机制（【已证实】README + 文件结构）**
- **五阶段流程**：Plan（引导式 brainstorm → PRD）→ Structure（拆 task，每 task 带 acceptance criteria、`depends_on`、`parallel`、`conflicts_with`，默认 ≤10 task/epic）→ Sync（建 epic issue + sub-issues + 专用 worktree `../epic-<name>/` + 映射文件）→ Execute（分析 issue 的独立 stream，**并行 agent 各自 scope 到自己的文件**，commit 用 `Issue #N: ...`）→ Track（standup/status/next/blocked，全部 bash 脚本，零 LLM 成本）。
- **源与投影分离**：本地 markdown 是源，GitHub Issues 是协作投影（rename 本地文件为 issue 号）；「Issue state is project state. Comments are the audit trail.」
- **并发模型**：一个 epic 一个 worktree；同 worktree 内多个 agent 按文件/stream 分工（README「All running simultaneously in the same worktree」+「launched parallel agents scoped to their own files」）；`conflicts_with` 元数据用于避免撞文件。
- **上下文工程**：主对话只做 conductor，不淹在实现细节里；agent 从 `.claude/epics/` 读任务、通过 git 提交进度。
- **确定性运维**：14 个 bash 脚本负责 status/standup/search/validate（「fast, consistent, no LLM token cost」）。
- **claims**：README 自述的 benchmark（100% vs 27.7% 等）为项目自报，未独立复核，标【已证实·README 自述】。

**Claude 没有的能力**：GitHub Issues 作为共享状态（→ 多人协作/可审计）；确定性脚本查询（status/standup 不花 token）；PRD→epic→task→issue→commit 全链路可追溯；跨 harness（非 Claude 专属）。

**DSH 可借鉴**
1. **「任务文件 frontmatter」= 线程 brief 的骨架**：`parallel / depends_on / conflicts_with / acceptance` 可直接变成 DSH `spawn_thread` 的入参（写 scope、依赖、验收）。
2. **确定性脚本替代 LLM 查询**：DSH 的 Overview 聚合应由 Host 服务计算（token 0），不要问模型。
3. **epic worktree + 文件级分工**：DSH M4 worktree 模式下可让线程 scope 到文件集合，并在 domain 记 `writeScopes`（与 Team 的 write scope 机制同构）。
4. **本地源 + 外部投影**：DSH 可把 `report`/`resolved` 同步到外部（GitHub issue/PR 注释）作为可选插件（不内置）。

### 4.5 Gas Town——Mayor / Rig / Witness / Refinery 的多层守护架构

- **repo**：https://github.com/steveyegge/gastown ｜ 18k★ ｜ MIT ｜ 更新 2026-10-20 ｜ Go；文档：[docs/overview.md](https://github.com/steveyegge/gastown/blob/main/docs/overview.md)、docs/glossary.md、docs/HOOKS.md。
- 一句话：**一个 workspace manager，让多个 CLI agent 在各自任务上协作，工作状态持久化在 git-backed hooks 里**（README Overview）。

**概念映射（README Core Concepts）**

| Gas Town | 含义 | Claude Projects 对应 |
| :- | :- | :- |
| **Town** | `~/gt/` 总工作区，含所有项目/agent/配置 | 整个 Projects 系统 |
| **Rig** | 项目容器，包一个 git repo 与其 agent | Project |
| **Mayor** | 主 AI 协调者，一个 Claude Code instance，拥有 workspace/projects/agents 全量上下文 | Coordinator |
| **Polecat** | worker agent：**持久身份、短命会话**；任务是生出来的，完成即结束，但身份/工作历史保留 | Thread（会话型 worker） |
| **Hooks** | git worktree 形态的持久存储（agent 工作状态，抗崩溃/重启） | Thread workspace + 持久化 |
| **Convoy** | 工作跟踪单元，打包多个 bead 分派给 agent | 任务批次/线程组 |
| **Beads** | git-backed issue tracking（结构化数据；ID 形如 `gt-abc12`） | Library/台账（任务与记忆） |
| **Molecules** | TOML formula 实例化成的工作流模板，带 step 跟踪（wisps / poured wisps 可 checkpoint 恢复） | Scheduled tasks / 流程模板 |
| **Witness** | 每 rig 生命周期管理器：监控 polecat、检测卡死、触发恢复、清理会话 | 线程看门狗 |
| **Deacon / Dogs** | 全局后台巡检 supervisor + 基础设施工人 | 全局任务调度/维护 |
| **Refinery** | 每 rig 合并队列：批处理 merge request、跑验证门、Bors 式二分合并，失败隔离/重派 | PR/merge 自动化 |
| **Escalation** | P0/P1/P2 严重度路由，经 Deacon→Mayor→Overseer | 异常升级 |
| **Scheduler** | 容量调速器，`scheduler.max_polecats` 批量派发防 API 限流 | 并发/限额控制 |
| **Seance** | 通过 `.events.jsonl` 发现前序会话，让 agent 询问前任上下文 | 记忆/恢复 |
| **Wasteland** | 经 DoltHub 的联邦协作网络（wanted/claim/evidence/reputation） | 跨组织协作（Claude 无） |

**与 Claude Projects 的差异**：Gas Town 是**运维/工程系统**（CLI，命令如 `gt sling / gt convoy / gt done / gt escalate / gt seance`），不是产品化的项目页/资料库；它的「项目」是 rig（repo 级），没有上传资料库；协调者是本地 Claude Code 实例（用户 attach 进去对话）。

**Claude 没有的能力**：多层看门狗（Witness/Deacon/Dogs）自动检测卡死并恢复；合并队列（Refinery）；容量调速（Scheduler）；会话续接（Seance）；联邦声誉（Wasteland）；身份与短命会话分离。

**DSH 可借鉴**
1. **身份 vs 会话分离**：`ThreadRecord`（持久身份/历史）与「运行时 Session」（短命）分离——DSH 方案正是这样（domain 台账 + 运行时 session）。
2. **看门狗分层**：DSH 至少需要一个 `project-watcher`（线程 turn/end、超时、失败→台账→注意力），可选再加全局 sweeper（孤儿 session/worktree 清理）。
3. **Escalation 严重度**：线程失败/卡住区分 P0/P1/P2，映射到 Overview 的「Needs you」优先级。
4. **Seance 思路**：线程 reopen 时先读「前序报告/事件摘要」，而不是重放全部 transcript。
5. **Scheduler 限额**：对应 Claude 200 线程/天；DSH 的 `counters.threadsCreated` + 日切是轻量版。
6. **Refinery 合并队列**：DSH M4 若接 PR/merge，可做「一批线程分支按序验证+合并」。

### 4.6 Agent Deck——conductor + 会话状态机 + watcher 门铃规则

- **repo**：https://github.com/asheshgoplani/agent-deck ｜ 1,138★ ｜ MIT ｜ 更新 2026-10-21 ｜ Go TUI + tmux + SQLite。
- README 约 90KB，是**目前抓到的对「会话状态机 + 事件路由」写得最细的项目**。

**概念映射**：Group ≈ Project（分组，可用 `groups` 声明，`default_path` 指定工作目录）；**Conductor = 一等实体**（`agent-deck conductor setup <name>`，可带自己的 Claude config_dir/env_file）；Session = Thread（Claude/Codex/Gemini/OpenCode/pi…）；Overview = TUI 四态列表 + 通知栏 + 状态栏；Cost dashboard = 成本。

**实现机制（【已证实】README）**
- **状态机**：Running `●` / Waiting `◐`（需要输入）/ Idle `○` / Error `✕`；来源有三类：① 原生会话 hooks（Claude `statusLine` 命令喂数据、Codex notify hook、pi 扩展），② pane 轮询兜底，③ events 流。
- **持久化**：SQLite 状态库（事件按 `(watcher_name, event_id)` 去重，重试不重复触发 conductor）。
- **Watcher / Doorbell 规则（关键）**：「watchers are triggers, not launchers」——watcher 只把一条短事件字符串 `agent-deck session send <conductor> "[event] hint"` 转发给 conductor，由 conductor 决定怎么做；**watcher 绝不直接 `launch/add`**（否则 spawn 出的 session 没有 `$AGENTDECK_INSTANCE_ID`，状态事件回不来，变成孤儿）。
- **通知**：transition notifier daemon 监听状态迁移（`running -> waiting|error|idle`）触发 parent nudge；tmux 状态栏 `⚡ [1] frontend [2] api` 一键跳 waiting 会话。
- **归档语义**：archive 会停 tmux 进程并从默认列表隐藏，但**保留 conversation、metadata、worktree、parent linkage**。
- **Worktree 选项**：`sibling`（`repo-branch`）/ `subdirectory`（`repo/.worktrees/branch`）/ 自定义路径；`.worktreeinclude`（gitignore 语法）带 `.env`/`.mcp.json`；worktree setup/destruction 脚本；sparse checkout `inherit`；bare repo 两种布局。
- **多会话能力**：fork sessions（用各 CLI 原生 fork 支持，可 fork 再 fork）；per-group/per-conductor Claude config 与 account 迁移（`session switch-account` 会迁移 conversation 并 `--resume`）；session naming（title 与 group 分离）；context window 条 + 主动 `/clear`（`clear_on_compact`，只在窗口已知时启用）。
- **其他**：MCP Manager（per project/global 开关 + 自动重启）、Skills Manager（pool → `.claude/skills` materialize）、remote decks、Telegram bot conductor（`/status`）、成本看板（7 窗口）。

**Claude 没有的能力**：原生 hooks 驱动的精确状态（比轮询可靠）；conductor 与子会话的 event 路由协议（doorbell）；archive 保留 worktree/parent linkage；account 热切换（迁移 conversation）；多 deck（远程机器）；Telegram 远程指挥。

**DSH 可借鉴**
1. **「watcher 只发事件、不直接动作」**：DSH 的 `project-watcher` 只写台账 + 给协调者投递事件，绝不由 watcher 直接 spawn/stop 线程——与 DSH 方案「通知仅提示，可靠来源是 domain 台账」完全一致，并有开源先例背书。
2. **事件去重 key**：`(source, eventId)` 落 domain，避免重复唤醒协调者。
3. **四态状态机**：Running/Waiting/Idle/Error 是 Overview 推导的最小信息集。
4. **archive 的精确语义**：停进程、保留记录/worktree/父子关系——DSH `ThreadRecord.state='resolved'` + 会话保留即同构。
5. **`.worktreeinclude` + setup 脚本**：DSH M4 worktree 线程必须带这两个钩子（否则 `.env` 缺失导致线程跑不起来）。

### 4.7 Claude Flow / Ruflo——swarm + 27 hooks + 向量记忆 + mission

- **repo**：https://github.com/ruvnet/claude-flow ｜ 78k★ ｜ MIT ｜ 更新 2026-10-22 ｜ **现已改名 Ruflo**（README「Claude Flow is now Ruflo」）。
- 定位：**harness**（Agent = Model + Harness），在 Claude Code/Codex 外层加 100+ agents、swarm、记忆、联邦、控制面。

**概念映射**：Project ≈ `.claude-flow/` 项目目录 + init 生成的项目面；Coordinator ≈ queen-led hierarchy（`/ruflo` console 的 mission）；Thread ≈ swarm 中的 agent/worker；Library ≈ HNSW 向量记忆 AgentDB；Overview ≈ console（Missions/Workflows/tokens/cost，可查看/回放/比较 run）。

**实现机制（【已证实·README 自述】）**
- **Hook 系统**：「27 hooks」（架构图：MCP Server → Router → 27 Hooks → Swarm → Agents → Memory → LLM）；`npx ruflo init` 后 hooks 自动路由任务、学习成功模式、在后台协调 agent。
- **Swarm**：hierarchical / mesh / adaptive 拓扑 + consensus（README 提到 Raft/Byzantine/Gossip）。
- **记忆**：HNSW 索引的 AgentDB（README 自述 benchmark：N=20k 约 1.9x、N=5k 约 3.2–4.7x vs brute force，recall@10≈0.99，并给了审计文档链接——**项目自己标注了限制**）。
- **后台 workers**：12 个自动触发 worker（audit/optimize/testgaps…）。
- **Missions**：console 页面里「mission」= 一个目标任务，Claude 可通过 console 工具创建 mission、导航页面、记录动作；有权限分级（read/write/manage/full + ask/auto）。
- **Federation**：跨机器/组织 agent 发现与协作；mTLS + ed25519 身份、PII 14 类检测（BLOCK/REDACT/HASH/PASS）、行为信任分（0.4 success + 0.2 uptime + 0.2 threat + 0.2 integrity）、9 个 MCP 工具 + 10 个 CLI 命令。
- **体量**：314 MCP tools / 26 CLI commands / 33 插件（README 自述）；`init` 会写 `.claude/`、`.claude-flow/`、`CLAUDE.md`、helpers、settings。
- **注意**：README 营销密度高，但项目主动提供了 audit/benchmark 文档并承认限制；引用其效果数字时标【已证实·README 自述】。

**Claude 没有的能力**：swarm 拓扑/共识；向量记忆与学习回路；hook 自动路由；控制面（tokens/cost/run 对比）；联邦（跨机器）；多 provider failover。

**DSH 可借鉴**
1. **hooks 做路由**：DSH 无需新建 hook 系统，但可复用 `session/event` + 工具调用事件做「自动路由/质量门」规则（如线程 turn 结束触发 report 提醒）。
2. **memory 的向量检索是可选增强**：DSH 的 MEMORY.md 索引 + 按需读文件已够 MVP；HNSW 可作为 M4+ 的 Library 检索。
3. **mission/console 的「目标 + 运行 + 成本」页**：即 DSH Overview 的 Scheduled/Usage 部分参考。
4. **警惕体量**：Ruflo 的 314 MCP tools 是反面教材——项目容器应保持 Coordinator 工具集最小（DSH 方案协调者 ~14 个工具是合理的）。

### 4.8 Citadel——campaign / continuation state / discovery relay / claims

- **repo**：https://github.com/SethGammon/Citadel ｜ 925★ ｜ MIT ｜ 更新 2026-10-21 ｜ [docs/ARCHITECTURE.md](https://github.com/SethGammon/Citadel/blob/main/docs/ARCHITECTURE.md)（last-updated 2026-08-09）。
- 定位：Claude Code + Codex 的「安全操作层」：仓库是 state/evidence 边界，runtime 仍是 Claude/Codex；公开状态词汇 **Request → Run → Evidence → Needs You / Resume**。

**概念映射**

| Claude Projects | Citadel | 证据 |
| :- | :- | :- |
| Project | 仓库（repo as boundary）+ `.planning/` | architecture |
| Coordinator | `/do` Router + 分层编排梯子（Skill→Marshal→Archon→Fleet） | architecture「The Orchestration Ladder」 |
| Thread | Fleet 的 agent（worktree 隔离）；Archon spawns `/marshal` per phase | architecture |
| Library | `.planning/` campaign 文件 + evidence artifacts + telemetry | architecture「Campaign Files」 |
| Overview | campaign 状态 + evidence（无 UI，CLI/markdown） | architecture |

**实现机制（【已证实】architecture doc）**
- **编排梯子**：Skill（分钟/无状态）→ Marshal（30min–2hr/单会话）→ Archon（小时–天/campaign 文件持久）→ Fleet（天/并行 wave）。原则：「use the cheapest level that fits」。
- **/do 路由 4 层**：Tier0 精确命令（0 token，normalized 全等）→ Tier1 活跃状态（0 token）→ Tier2 候选发现（0 token，内置关键词 + 项目 skills）→ Tier3 语义分类器（~500 token，判断 scope/complexity/persistence/parallelism/judgment 后 dispatch）。只有 Tier0 能跳过语义分类。
- **Campaign 文件（持久状态）**：`Status / Direction / Phases / Feature Ledger / Decision Log / Active Context / Continuation State`；每次 Archon 调用读它重建上下文，每次完成更新它——**这是跨 session 接力的核心机制**。
- **Fleet Sessions + discovery relay**：Wave1 AgentA(src/api)+AgentB(src/ui) → 收集结果 → **把发现压缩到 ~500 token/个** → 合并分支 → Wave2 以 Wave1 的发现启动（防止重复发现）。
- **文件态协调**：`.planning/coordination/{instances,claims}`；scope overlap 检测（父/子目录算重叠，兄弟不重叠；`(read-only)` scope 永不冲突）；死实例由 sweep 清理。
- **Hooks**：36 个 Node.js 脚本 / 29 个生命周期事件；分类 Safety(PreToolUse)、Quality(PostToolUse)、Wave(PostToolBatch)、Session(init/session-end/restore-compact)、Fleet(subagent-start/stop、worktree-setup)、Consent、Signals。
- **治理**：hooks 自动 + `policy-enforcer`（Haiku 只读）判 allow/block + 三级 constitution（Tier1 硬阻断/Tier2 警告/Tier3 建议）；telemetry 带 lineage（`event_id/run_id/agent_id/task_id/artifact_id/parent_id/source_event_id` + `_hash`，可选 HMAC 签名）。
- **其他状态**：`.claude/harness.json`（language/framework/packageManager/typecheck/test/qualityRules/protectedFiles/features）；`.claude/agent-context/` 给被委派 agent 的规则；skills 按需加载（未加载 0 token）。

**Claude 没有的能力**：continuation state machine（跨 session 机器可读接续点）；evidence contract（`passed/failed/blocked/unknown`，缺证据不算成功）；claims/ownership 文件锁与 scope 重叠检测；discovery relay（wave 间知识压缩传递）；分层路由（成本与任务规模匹配）；治理分级与 policy-enforcer。

**DSH 可借鉴**
1. **Campaign 文件 = 项目记忆的模板**：`Feature Ledger / Decision Log / Active Context / Continuation State` 四段可近似映射 DSH `MEMORY.md` + `notes/`；其中 Continuation State 是「线程 reopen / 协调者 cold start」的关键。
2. **claims = 写作用域**：DSH 线程间写冲突可用「线程声明 writeScopes + Host 检查重叠」实现（团队已有 write scope 概念）。
3. **Evidence 三态**：DSH `report` 可要求 `status: done/blocked/needs-review + evidence[]`，Overview 显示「缺证据」。
4. **discovery relay**：协调者把「已完成线程的发现摘要」注入新线程简报（DSH 简报已有 memory/library，可加 `prior_reports`）。
5. **Tier0/1 零 token 路由**：协调者优先用确定性规则/台账回答，不要每次都调模型。

### 4.9 OpenMeld——把「Project + Coordinator + Library」做成多人协作系统

- **repo**：https://github.com/amplifthq/openmeld ｜ 1,390★ ｜ MIT ｜ 更新 2026-10-22 ｜ TS/React/Electron/Cloudflare/PostgreSQL（README badges）｜ [docs](https://docs.openmeld.ai)。
- 定位：**the open human-agents collaboration system**：人类 + 各自的本地 agent + hosted cloud agents 在共享 Space 里协作。

**概念映射**：**Space** ≈ Project（共享工作区，含成员/对话/文件）；**Center Agent** ≈ Coordinator（hosted AI teammate，跨 chat 记忆，能协调 work）；**Task/Conversation** ≈ Thread（任务可分配给人和 agent，可要求 approval）；**Library** = shared files & folders + previous file versions；**Overview** = tasks 列表 + team chat + 成员。

**与 Claude Projects 的差异**：多人（team chat、分享链接、成员权限）；agent 是「每个人自己的本地 agent + 一台 Computers 连接」；Center Agent 是托管服务而非用户会话；有 cloud computer（免费 personal cloud computer）。
**Claude 没有的能力**：多人协作（task for people & agents、approval、public sharing links、team knowledge base）；跨 chat memory 在产品层显式化；把本地 agent 接入团队空间（保留各自订阅，本地跑）。
**实现机制（【已证实·README】）**：本地 agent 经 CLI 接入（`openmeld setup` → 创建 Local Agent，选 computer/tool/project folder，computer 需保持在线）；Center Agent 托管；数据存 PostgreSQL；self-host 状态有限（README 指向 docs/self-hosting.md 的 deployment limits）；对 Raft/Multica/Paperclip/Dust/Viktor/OpenHands 做了能力对比表（同页）。**未抓到线程隔离的实现细节**（是否每 task 一个 branch/沙箱）→【未证实】。
**DSH 可借鉴**
1. **多人模型**：Space membership/role + task assignee(person|agent) + approval——DSH 若做团队版，这是最小模型。
2. **「中心 agent + 每人本地 agent」**：DSH 是本地 harness，天然对应「协调者 + 用户各自 harness」，可把多机/多人作为扩展方向。
3. **共享文件版本历史**：Library 的 `replacedAt/history` 参考。
4. **能力对比表的写法**：可直接用作 DSH 与 Claude Projects 差异表的模板。

### 4.10 Nimbalyst（Crystal 继任者）——多会话 worktree + session kanban + 移动端

- **repo**：https://github.com/nimbalyst/nimbalyst ｜ 1,957★ ｜ MIT ｜ 更新 2026-10-21 ｜ Electron（TS）。
- **前身 Crystal**（https://github.com/stravu/crystal）：3,134★，2026-02-26 后不再更新，repo 描述明确写「Crystal is now Nimbalyst」；其 README 在当前抓取通道 404/000（见 7.2），故以 Nimbalyst README 为准。

**概念映射**：Session ≈ Thread（每 session 独立 git worktree）；**Session kanban ≈ Overview**（搜索/恢复/关联 touched files）；任务跟踪（plans/bugs/features/todos，人和 agent 都可编辑）= 任务层；无显式 Project 容器与 Coordinator，但「repo + 多 session」近似项目工作台。

**实现机制（【已证实·README】）**
- 并行 agent sessions，每个独立 worktree；heterogeneous agents（Codex、Claude Code、OpenCode alpha、Copilot alpha、Gemini provider）。
- 视觉编辑与红绿 diff 审查（WYSIWYG：markdown/mockup/Mermaid/Excalidraw/CSV/data model/Monaco code）— 人机共编同一文件。
- Git 内置（branch/worktree 管理、staging、AI commit、内嵌 ghostty 终端）。
- MCP client + servers；扩展 SDK（EditorHost 契约，内置编辑器走同一接口）。
- **Plain files on disk**：内容/状态用 markdown，工作流用 slash commands，全部在 git repo——「No proprietary store to migrate out of」。
- iOS companion：needs-you 仪表盘、文字/语音回复、滑 diff 审批、排队下一任务、push 通知。

**Claude 没有的能力**：iOS 端「diff 逐条审批 + 语音回复 + 排队下一任务」；人机共编的可视化编辑器；扩展 SDK；把状态完全放在用户 git repo 里（可迁移/可 diff）。
**DSH 可借鉴**
1. **「状态全在 git repo/plain files」**：DSH Library/Memory 若用 markdown+目录（方案如此），天然获得可迁移、可 diff 的好处。
2. **session 与 touched files 的关联**：DSH `ThreadRecord.deliverables` 可扩展为 `touchedFiles`（来自 present/diff），Overview 展示「这条线程动了哪些文件」。
3. **移动端「needs-you 队列」**：DSH 若做 Web UI，Notification/待批聚合可直接对标。
4. **红绿 diff 审批**：DSH 复用的是现成会话 UI（审批/工具调用），无需自研。

### 4.11 补充速写（进入评估但不做深读）

- **beads（18k★ MIT，2026-10-22，[repo](https://github.com/steveyegge/beads)）**：**目前最成熟的「项目状态 + 记忆」层**。Go + **Dolt**（版本化 SQL，cell-level merge；`bd dolt push/pull` 经 git remote 同步；`.beads/issues.jsonl` 只是导出不是源）；hash ID（`bd-a1b2`）防多 agent 分支合并冲突；依赖图 + `bd ready`（无 blocker 的可领任务）；`bd update --claim` **原子领取**；`bd remember`/`bd prime` = 项目记忆注入；compaction（语义记忆衰减，压缩老任务省 context）；message 类型支持 threading + mail delegation；多写模式（embedded 单写 / `--server` 多写）；schema version guard。**DSH 借鉴**：hash ID 思路（DSH 用 uuid 亦可）、`ready` 查询（线程依赖就绪）、claim 原子性（线程取任务）、记忆注入（`bd prime` 对应线程简报）。
- **amux（543★，[repo](https://github.com/mixpeek/amux)）**：「control plane」型，**单 Rust 二进制 + SQLite、本地优先**；共享任务板**原子领卡**（两 agent 不会抢同一任务）、agent 互发消息、崩溃/卡住自愈重启、schedules/loops（daily 9am / every 15m / 夜间自调节）、手机/Mac/浏览器、任意模型可切换。**DSH 借鉴**：任务板原子领取（Host 服务端 `claim`）、self-healing（线程失败自动重试/重启策略）、schedules 的 cron 语义。
- **Orkas（2,147★ MIT，2026-10-22，[repo](https://github.com/Orkas-AI/Orkas)）**：**Project = goal + rules + memory + files**（每个新 conversation 从项目上下文开始）；Commander 规划/委派/自己也能干；To-do 可分给人或 agent；Auto-advance 自动取下一项；定时自动化（hourly/daily/weekly/monthly，错过的最近一次 12h 内补跑）；本地会话接入 Claude Code/Codex/OpenCode/OpenClaw/Hermes；共享项目仅打包版（开源版无）。**DSH 借鉴**：项目上下文包的字段（goal/rules/memory/files）几乎就是 DSH Project 设置；Auto-advance 可做「线程 resolve 后自动派下一个」。
- **AionUi（33,690★ Apache-2.0，[repo](https://github.com/iOfficeAI/AionUi)）**：开源 Cowork app；内置 agent 引擎（无需装 CLI）+ 自动检测 20+ 外部 CLI；并行会话独立 context；MCP 统一管理；21 个内置 assistant。**启示**：Cowork 的「工作区 + 任务」与 Claude Code Projects 是两条产品线，开源 Cowork 化已有人做（33k★），但**没有一个把它扩展成「协调者 + 线程」**。
- **limuyang2/agent-team（44★ MIT，[repo](https://github.com/limuyang2/agent-team)）**：**DeepSeek Harness 上的第三方插件**，实现了 Leader + members 团队：每 member 独立 provider/model/preset/权限/skills/MCP；Leader 建任务、分配、跟踪、收结果；可给 member 直接发消息；工作台并排流式输出；token/缓存统计；Assistant Library 复用。**对 DSH 的意义**：证明「插件级 Leader/member」在 DSH 架构里可行（它没有 Project 域/Library/Overview 的产品化）；DSH 方案做项目容器 + 线程台账是它的严格超集。
- **ntasker（4★ AGPL-3.0，[repo](https://github.com/nerdocs/ntasker)）**：看板即 agent 记忆；任务可指定不同 agent；队列在你不看时继续跑；inbox 收想法。**启示**：「看板作为记忆」与 Claude 的 Overview 语义接近，但小项目验证了「队列 + 指派」的产品形态。
- **agent-teams-ai（2,288★ AGPL-3.0，[repo](https://github.com/777genius/agent-teams-ai)）**：「你是老板，agent 是团队；它们自己处理任务、互相发消息、互相 review」——验证了 peer messaging + review 是社区想要的能力。
- **cezar（778★ MIT，[repo](https://github.com/open-mercato/cezar)）**：开源 orchestrator + ADE（agent development environment），跑 Claude Code/Codex/OpenCode/Pi 等。
- **open-tag（212★ Apache-2.0，[repo](https://github.com/fancyboi999/open-tag)）**：「Claude Tag 的自托管替代」——Slack 式工作区，团队 + agent 同处频道；**多人协作**方向上最接近 Claude Tag（Claude 有 Tag 但 Projects 不可分享）。
- **multi-agent-shogun（1,424★ MIT，[repo](https://github.com/yohey-w/multi-agent-shogun)）**：tmux 并行多 agent 的方法论型项目（README 89KB），含 tmux 会话编排。
- **ccmanager（≈1.3k★ MIT，[repo](https://github.com/kbwo/ccmanager)）**：**不依赖 tmux** 的自包含 PTY 会话管理器；worktree 创建/合并/删除；**恢复上次退出/崩溃时的会话**；在 worktree 间复制 Claude session 数据（保持 context）；`.worktreeinclude`；devcontainer；状态检测策略可配置；auto approval（AI 校验安全提示）。**DSH 借鉴**：restore sessions（冷恢复）、状态检测策略可配置。
- **opcode（约 22k★ AGPL-3.0，[repo](https://github.com/winfunc/opcode)）**：原 claudia，桌面 GUI + 自定义 agent + 后台 session 管理；**omnara（3.1k★ Apache-2.0）**：自托管 managed agent platform（API 跑 agent、工具/密钥/权限/流式）；**happy（24k★ MIT）**：多模型 harness + iOS/Android/桌面（Any Model, Your Subscription）。这三者是 Claude 生态的「客户端/平台」路线，对 DSH 的 UI/移动端有参考。
- **任务/规格层（task-master 28,263★、BMAD 54,423★、spec-kit 142k★、agent-os 5.5k★、Superpowers 303,292★）**：它们提供「规格→任务→实现」的流程与可复用技能，不提供运行时容器。DSH 若要「项目 instructions/技能」可参考 Superpowers 的技能分发与 BMAD 的 durable context 写法，但**不要**把流程层塞进 Project 域（保持 Project 域只存 instructions/memory/library）。
- **框架层（LangGraph/AutoGen/CrewAI/MetaGPT/Agno/OpenHands/Kortix）**：LangGraph 的 `thread_id + checkpointer` 是线程可恢复性的教科书实现；OpenHands 的 conversation/workspace/events 服务端对象模型与 Automation Server 值得对照；Kortix「公司=一个 git 仓库（kortix.yaml + agents/skills/memory）」是「项目即仓库」的强形态；AutoGen 已归档（迁 microsoft/agent-framework），不推荐作为新项目依赖。**共同结论**：这些是「编排原语」，不提供 Project 容器/Library/Overview 的产品语义。

---

## 5. 「Claude 没有但值得做」清单

> 去重后 13 条。**判定**列：🟢 有开源先例（可直接借鉴）／🟡 部分先例（需自研组合）／🔴 空白（无先例，是差异化机会）。「Claude 有?」列按 Claude Projects 官方语义判定。

| # | 能力 | Claude 有? | 开源先例（证据） | 判定 | DSH 建议 |
| --: | :- | :-: | :- | :-: | :- |
| 1 | **多人协作**：一个项目多人共享、任务可分配给人/agent、审批、分享链接 | ❌（明确单用户不可分享） | OpenMeld（team chat + tasks + approval + public links）、OpenTag（自托管 Slack 式）、CCPM（GitHub Issues） | 🟢 | 非 MVP；Project 域预留 `members[]`、`thread.assignee`，UI 预留成员/分享 |
| 2 | **移动端**：查看 needs-you、回复/审批、排队下一任务、看 diff | ❌（Claude 有手机 App 但非这套语义） | Nimbalyst iOS（diff 逐条审批/语音/队列）、amux（iOS/Android/PWA）、happy、omnara | 🟢 | DSH Web UI 先做响应式 + 通知；原生端留扩展 |
| 3 | **本地模型 / 多厂商模型** | ❌（仅 Anthropic） | 几乎所有工作台（claude-squad `--program`、agent-deck、Nimbalyst、Orkas、AionUi、Ruflo 5 providers、OpenHands） | 🟢 | DSH 天然支持（modelSettings per project/thread）；写进差异表 |
| 4 | **成本/用量控制**：线程级 token/成本、预算、限额 | ◐（有 plan limits，无本地可编程） | agent-deck cost dashboard、Ruflo console（tokens/cost）、Gas Town Scheduler（`max_polecats`）、amux schedules | 🟡 | M3：`threads[].usage` + `counters` + Overview Usage 页（方案已有雏形） |
| 5 | **工程纪律/验收证据**：任务完成需给出 evidence，缺证据不算 done | ❌（instructions 无验收语义） | Citadel evidence contract（passed/failed/blocked/unknown）+ campaign；Superpowers/BMAD 的质量门 | 🟡 | `project_report` 增加 `evidence[]`；Overview 显示「缺证据」 |
| 6 | **项目状态可迁移/可 diff**：项目记忆/状态是 plain files 在 git 里 | ◐（memory 是平台内部状态） | Nimbalyst（plain files on disk）、Citadel（campaign 文件）、CCPM（`.claude/` 文件）、beads（Dolt + git remote） | 🟢 | DSH Library/Memory 用 markdown+目录（方案已定），天然满足 |
| 7 | **多机/远程/无人值守** | ◐（cloud session 即远程） | agent-deck remote decks + Telegram、amux 手机/浏览器、OpenHands Agent Server、Kortix cloud computer | 🟢 | 本地 harness 可先做「多客户端连同一 Host」；SSH/远程留扩展 |
| 8 | **联邦/跨组织协作** | ❌ | Ruflo federation（mTLS+ed25519/信任分/PII）、Gas Town Wasteland（DoltHub） | 🟡 | 远期；不建议 MVP 做 |
| 9 | **会话续接/前任查询**：新线程能看到前序线程的决策与发现 | ◐（memory 承载，非会话级） | Gas Town `gt seance`（`.events.jsonl` 发现前序会话）、Citadel discovery relay（wave 间 ~500 token 压缩传递） | 🟡 | 线程简报加 `priorReports[]`；reopen 时读「上次 report」 |
| 10 | **任务依赖图 / ready 查询 / 原子领取** | ❌（Claude 靠协调者自然语言） | beads（dependency graph + `bd ready` + `--claim`）、amux（原子领卡）、vibe-kanban（task status） | 🟢 | 线程间依赖写入 domain（`blockedBy`），`spawn` 前检查就绪；Host 端原子 claim |
| 11 | **看门狗/自动恢复/自动收尾** | ◐（Resolved 自动规则是其一） | Gas Town Witness/Deacon、amux self-healing、agent-deck nudge daemon | 🟢 | `project-watcher`：turn/end、超时、失败→台账；N 天无活动→自动 resolve（方案已有） |
| 12 | **合并队列/PR 自动化** | ❌（线程开 PR，但无队列） | Gas Town Refinery（Bors 式二分合并）、vibe-kanban（PR + merge + AI 描述）、Orchestrator.inc（PR/CI/review 吸附） | 🟡 | M4+：可选插件 |
| 13 | **项目级权限策略 → 线程生效 → 项目页聚合待批** | ◐（Claude 有项目设置+线程审批，但聚合细节未在开源验证） | 无直接先例；各项目只有 agent 自身审批 | 🔴 | **机会点**：DSH 用 `pendingInteraction` 投影做项目级聚合，天然比开源强 |

> 排序建议：MVP 必做 4/9/11（低成本、直接增强 Claude 语义）；M3 做 6/10/13（差异化）；M4 做 1/7/12（团队/远程）；3 是 DSH 天然优势；2/5/8 按产品方向取舍。

---

## 6. DSH 方案应借用的实现模式（7 个）

> 本节直接对齐 [docs/dsh-claude-projects-plan.md](../../docs/dsh-claude-projects-plan.md) 的模块划分：`dsh-project`（Project 域 + 线程运行层）、`dsh-project-library`（Library）、`dsh-project-context`（简报/记忆/库索引注入）、`dsh-tool-project`（模型工具）、`dsh-client-ui-project`（Overview/Library UI）。

### 6.1 模式 A：线程双层模型（domain 存意图 + runtime 由会话承载）

- **来源证据**：vibe-kanban `Task`（意图）与 `Workspace`（执行环境）分表，`WorkspaceWithStatus` 由 `is_running/is_errored` 叠加派生；Orchestrator.inc 的 kanban 由 session/PR/CI/review 事实推导；agent-deck 用原生 hooks + 轮询得到四态；Gas Town「身份（polecat）与短命会话分离」。
- **映射到 DSH**：
  - `projects` domain 的 `threads[]` 只存**持久意图**：`state ∈ {provisioning, active, resolved, failed}`、`lastReport`、`worktree`、`usage`、`deliverables`。
  - `running / waiting / idle / needs-review / needs-you` 由 **Client 投影**从 `live session 状态 + pendingInteraction + turn/end + lastActivityAt` 推导（方案 3.4 已如此设计）。
  - **Watcher 只写台账/投递事件**，不直接控制线程（agent-deck doorbell 规则）。
- **落地要点**：domain 写用 storage domain（同步 + durable），状态推导写成纯函数放 Client；避免在 domain 或 session 里双写运行态。
- **风险**：Client 投影与真实状态漂移 → 在 Overview 加「最后事件时间」，并保留 Host 端 `list_threads({derive:true})` 作为权威兜底。

### 6.2 模式 B：线程简报 + 统一 report 协议（替代 best-effort 通知）

- **来源证据**：Citadel campaign 的 `Continuation State`/`Decision Log` 让 Archon 每次冷启动都能重建上下文；CCPM 的 task frontmatter（acceptance/parallel/depends_on）+ `<N>-analysis.md`；Orchestrator.inc 给 worker「relevant context」；agent-deck 的 watcher event + conductor 决策；DSH 方案已知子会话 `delivery:'parent'` 通知是 best-effort（父 Agent 非 live 时静默丢弃）。
- **映射到 DSH**：
  - `spawn_thread` 时把「项目简报」作为**首条 durable user message**（方案 3.4 已定义七段：项目/instructions/MEMORY 索引/Library 索引/仓库工作目录/任务/汇报要求）。
  - 线程侧强制 `project_report` 工具写 domain：`{summary, status: done|blocked|needs-review, evidence[], deliverables[]}`；**协调者的可靠信息源是台账，通知只是提示**。
  - 协调者下次 turn / 用户打开项目页时拉取 `lastReport`，并按需 `list_threads` 汇总。
- **落地要点**：report 是工具而非提示词约定（模型可忘记）；`lastReport` 有长度上限，全文留在会话；report 触发 domain `changed` 事件 → Client 与协调者 watcher 都订阅。
- **风险**：报告过碎/过频打扰 → 给 `report` 加 `notify: silent|normal|attention`，协调者可按用户偏好过滤（Claude 的「Post shorter updates」类比）。

### 6.3 模式 C：项目记忆 = 索引 + 按需文件 + 四段 campaign 结构

- **来源证据**：Claude 官方 `MEMORY.md` 索引 + 按需打开（基准）；Citadel campaign 的 `Feature Ledger / Decision Log / Active Context / Continuation State`；beads `bd remember` + `bd prime`（项目记忆，prime 注入工作流上下文）；CCPM `.claude/` 文件为源；Nimbalyst plain files。
- **映射到 DSH**：
  - `~/.dsh/projects/<id>/memory/{MEMORY.md, notes/<slug>.md}`；`MEMORY.md` 只放索引（每条一行：标题 + 摘要 + 相对路径 + 更新时间 + 作者）。
  - 线程/协调者都通过 `remember/forget` 工具写 memory；`dsh-project-context` 每次注入索引（不注入正文），正文由 `project_memory_read` 按需读。
  - 四段模板写进 `MEMORY.md` 的默认结构：`## Feature Ledger`（已验证事实/交付物）、`## Decision Log`（决策 + 理由）、`## Active Context`（当前状态）、`## Continuation State`（机器可读接续点：下一步/阻塞/待确认）。
- **落地要点**：所有写入走工具（可审计 `updatedBy: coordinator|thread|user`）；memory 文件在 project 目录、不在 session workspace，线程只读。
- **风险**：索引膨胀 → 限制 `MEMORY.md` ≤ 一定行数，超限压缩到 `notes/`；注入预算与 instructions 的 16k 类似，需 token 计量。

### 6.4 模式 D：Library = 内容寻址不可变对象 + 项目级索引 + 产出回收

- **来源证据**：Claude Library 语义（上传拷贝、Replace、线程 `/mnt/project-files` 只读；基准）；OpenMeld shared files & folders + previous file versions；vibe-kanban `file/scratch` 模型；Citadel evidence artifacts；Nimbalyst「plain files on disk」。
- **映射到 DSH**：
  - `~/.dsh/projects/<id>/library/objects/<digest前2>/<digest>`（不可变字节，去重）+ `index/`（可读索引）；domain `libraryEntries[]` 存 `{entryId, projectId, name, kind: uploaded|produced, mime, bytes, digest, storedPath, source: user|coordinator|thread, sourceThreadId?, attachmentId?, replacedAt?}`。
  - 上传/产出统一走 Host 服务：`library_add` 从线程 workspace **拷贝快照**入库（与 Claude「上传是拷贝」一致）；线程对库**只读**（可 list/read，不可写）。
  - `materialize`（可选）：把库文件按需复制到线程工作目录（对应 `/mnt/project-files` 的只读挂载语义）；`Replace` = 新 entry + `replacedAt`，保留历史。
- **落地要点**：内容寻址去重 + 配额（方案 6.2 已有 `entryCount/totalBytes`）；产出物回收 = 线程 `present`/交付物路径 → `libraryEntries(kind=produced)`。
- **风险**：大文件/重复上传 → 配额与 digest 去重必须前置；跨平台路径（Windows）用相对路径存 index。

### 6.5 模式 E：Coordinator = 路由/台账/记忆服务 + 对话界面（不是超级 agent）

- **来源证据**：Claude 官方「coordinator 只看线程汇报，无 connectors」；Orchestrator.inc「orchestrator owns planning and delegation; workers own implementation, tests, commits, PRs」；Citadel 分层路由（Tier0 精确命令/Tier1 活跃状态 0 token，Tier3 语义分类 ~500 token）；Gas Town Mayor 是「拥有全量上下文的 Claude Code 实例」但执行都在 polecat；agent-deck conductor 只做决策不直接 spawn（doorbell）。
- **映射到 DSH**：
  - 协调者会话 preset：persona + 项目工具（`project_brief/list_threads/spawn_thread/send_to_thread/stop_thread/resolve_thread/reopen_thread/propose_threads/remember/forget/library_list/library_add`）+ 只读通用工具；**不给 connectors**（需要 connector 的任务派线程，与 Claude 一致）。
  - 路由策略做成「确定性优先」：台账能回答的（线程状态/文件清单/记忆）由工具直接返回；只有新工作才走模型判断（建议线程 vs 直接开）。
  - `propose_threads` 对应 Claude 的 Suggested threads（列表 + 一键全启）。
- **落地要点**：协调者工具集保持小而稳（方案 4.4 已列）；线程 preset 只给执行工具 + 只读项目工具。
- **风险**：协调者越权做执行 → 用 preset 工具白名单物理限制；「建议 vs 直接开」策略用户可配。

### 6.6 模式 F：Overview = 纯函数状态推导 + 注意力路由

- **来源证据**：Orchestrator.inc 四列由事实推导；agent-deck 四态 + 通知栏 + 「waiting 会话一键跳转」；vibe-kanban `WorkspaceWithStatus`；Claude Overview 六分组 + 注意力路由（基准）。
- **映射到 DSH**：
  - 定义投影函数 `deriveThreadGroup(thread, liveSession, pendingInteraction, now) → one of {active, waiting, needs-review, needs-you, resolved, failed, scheduled}`。
  - Overview 只读投影，不写 domain；「Needs you」聚合 = `pendingInteraction.any(kind=approval|question)` 或 `lastReport.status==blocked` 或 `state==failed`。
  - 注意力路由：通知/徽标/项目排序都用同一投影，避免多处口径。
- **落地要点**：投影纯函数放 client 包 `dsh-client-ui-project`，Host 提供原始事实（`list_threads`）；测试用固定时钟快照。
- **风险**：投影变化导致 UI 抖动 → 以 `lastActivityAt`/`pendingInteraction` 做稳定排序键。

### 6.7 模式 G：生命周期与容量治理（Resolved≠Delete、限额、自动收尾）

- **来源证据**：Claude Resolved 规则（手动/完成/一周无活动，可 reopen，分支/PR 保留；200 线程/天硬上限）；vibe-kanban `archived` + `worktree_deleted` 解耦；agent-deck archive 保留 conversation/metadata/worktree/parent linkage；ccmanager restore sessions；Gas Town Scheduler 限流 + Seance 续接；beads close/reopen + compaction。
- **映射到 DSH**：
  - `resolve_thread` 只置 `state=resolved + resolvedAt + resolvedBy`，**不删会话/不删 worktree/不删库产出**；`reopen` 清 resolvedAt 并允许 send。
  - 自动收尾：`autoResolveDays`（默认 7）由 Host sweeper 每日检查 `lastActivityAt`。
  - 限额：`counters.dayKey/threadsCreated`，spawn 前检查（默认 200，可配）；超限返回结构化错误并在 Overview 提示。
  - 清理是独立动作（M4）：孤儿 worktree / 过期库对象 / 软删项目；`pause/archive/delete` 三级。
- **落地要点**：把「收尾」和「清理」写成两个 API（`resolve_thread` vs `cleanup_thread`），UI 不提供「resolve 即删」的误导按钮。
- **风险**：自动 resolve 误伤长任务 → 用「最后事件时间」而非创建时间；用户可关闭自动收尾。

### 6.8 模式组合后的数据流

```
用户消息 ──► Coordinator 会话（preset: projects-coordinator）
   │             │
   │             ├─(确定性) 工具查台账：list_threads / project_brief / memory / library
   │             └─(新工作) spawn_thread(brief) ──► projects domain: threads[state=provisioning]
   │                                                    │
   │                                      ThreadRuntime.create(session, preset=projects-thread)
   │                                                    │
   │                                      Session（独立 context，可 steer/stop）
   │                                         │ 首条 durable user message = 项目简报
   │                                         │ 工具：project_report / remember / library_list / library_add(只读+快照入库)
   │                                         ▼
   │                                      turn/end + project_report ──► projects domain（lastReport/state/usage）
   │                                                    │
   │                                      project-watcher（只写台账 + 投递事件，不直接控制）
   │                                                    ▼
   └────────────── 下一 turn 拉取 lastReport / 用户打开项目页 ◄── Overview 投影（deriveThreadGroup）
                                                          ├─ Library 投影（libraryEntries）
                                                          ├─ Scheduled tasks（cloud scheduled task）
                                                          └─ 注意力路由（pendingInteraction 聚合）
```

---

## 7. 检索结果与抓取失败记录

### 7.1 GitHub 检索查询与命中量

抓取时间 2026-10-22，GitHub Search API `sort=stars&order=desc&per_page=20`；返回 top20 均已人工过目。

| 查询 | total_count | 说明 / 代表结果 |
| :- | --: | :- |
| `claude code parallel agents` | 1,475 | 红海：ADHD、golutra、nimbalyst、multi-agent-shogun、Citadel、claude_code_agent_farm、cezar、amux、proliferate |
| `multi agent orchestration worktree` | 170 | 大量小项目（ccswarm、singular-lite、baton…），说明「worktree 编排」是常见套路 |
| `agent task board kanban claude` | 51 | agent-teams-ai、kanbots、claude-code-studio、Claw-Kanban、ntasker、kazz187/taskguild |
| `claude projects coordinator` | 90 | 无产品级项目；最相关是 M-Pineapple/Claude-Project-Coordinator（Xcode MCP，48★）等小工具 |
| **`open source claude projects threads library`** | **0** | **直接证据：没有项目用「Claude Projects 四件套」自我描述** |
| `shared context multi agent collaboration workspace` | 2 | 说明「共享上下文协作」方向极其早期 |
| `"project memory" claude code agents` | 165 | Citadel、compozy、aios、agentcairn、cognikernel 等（记忆层是 2026 热点） |
| `agent teams claude code open source` | 68 | AionUi、agent-orchestrator、openmeld、Orkas、amux、open-tag |
| `conductor claude code parallel` | 23 | 全是第三方小仿作；Conductor 本体闭源 |
| `agent-deck` | 1,878 | 名字与「slide decks」撞车；正确项目是 asheshgoplani/agent-deck（1,138★） |
| `claude code mobile remote control session` | 12 | 远程/移动控制是小众但活跃：anycoding、claude-dashboard、cc-remote 等 |

**判定**：`claude code parallel agents`（1475）与 `open source claude projects threads library`（0）的对比，是本报告「并行 agent 红海、项目语义空白」结论最直接的量化证据。

### 7.2 抓取失败 / 存疑 / 未证实清单（不编造）

| 对象 | 情况 | 处理 |
| :- | :- | :- |
| `raw.githubusercontent.com` | 本机域名解析被拦（non-public IP），无法抓 README | 改用 `cdn.jsdelivr.net/gh/<owner>/<repo>@HEAD/<path>`（lead 已验证）；README 全部经此通道抓取 |
| stravu/crystal 的 README | jsDelivr `@HEAD`/`@main` 均 404/000（`@master` 301），未拿到原文 | 只用其 GitHub repo 元数据（3,134★ MIT 2026-02-26 + 描述「Crystal is now Nimbalyst」）；深读用继任者 Nimbalyst README |
| BloopAI/vibe-kanban 的 README/部分文件 | data.jsdelivr 文件树 API 返回 403「Package size exceeded 50 MB」，无法列全文件 | 用已知路径逐文件抓取（`crates/db/src/models/*.rs`、`container.rs`、`lib.rs`、`package.json`）成功；未抓到前端/CLI 源码细节 |
| microsoft/autogen LICENSE | shields 返回 CC-BY-4.0（疑似取到文档许可），与常见 MIT 不一致 | 标「未识别」；项目已归档，不据此做许可判断 |
| BMAD-METHOD / Suna(Kortix) 等 LICENSE | GitHub 未识别（NOASSERTION/未识别） | BMAD README 自标 MIT；Suna 标「未识别」；表内如实标注 |
| GitHub Search API | 元数据收集早期触发过一次 `API rate limit exceeded`（未认证 10 次/分钟） | 改为 shields.io + GitHub Atom feed + 限速重试；最终 42 个仓库元数据全部拿到（个别 star 为四舍五入） |
| Conductor 源码 | 闭源产品，无 GitHub 仓储 | 仅引官方文档；搜索到的同名 repo 均标注为第三方仿作，不当作官方实现 |
| OpenMeld 线程隔离细节 | README 未说明每条 task 是否独立 branch/沙箱 | 标【未证实】；只写「task/conversation + 本地 agent + Computer」 |
| 各项目「效果数字」 | 如 CCPM 的 100% vs 27.7%、Ruflo 的 HNSW 加速比 | 标【已证实·README 自述】，未独立复核 |
| DeepWiki / 官方 docs 站点 | 未尝试抓取（优先 README+源码） | 需要时可按 `docs/` 路径再抓（如 OpenMeld docs、vibe-kanban docs） |

---

## 8. 证据 URL 索引

**基准**
- Claude Code Projects 官方文档：https://code.claude.com/docs/en/claude-projects
- 内部基准调研：[research/claude-projects/README.md](../claude-projects/README.md)
- DSH 方案：[docs/dsh-claude-projects-plan.md](../../docs/dsh-claude-projects-plan.md)

**深读项目（README / 源码 / 架构文档）**
- Orchestrator.inc：https://github.com/OrchestratorInc/agent-orchestrator
- Vibe Kanban：https://github.com/BloopAI/vibe-kanban ｜ sunset 公告 https://www.vibekanban.com/blog/shutdown ｜ `crates/db/src/models/task.rs`、`project.rs`、`workspace.rs`、`crates/services/src/services/container.rs`、`crates/db/src/lib.rs`
- Claude Squad：https://github.com/smtg-ai/claude-squad ｜ `session/tmux/tmux.go`、`session/git/worktree.go`、`config/state.go`、`session/storage.go`、`session/instance.go`
- CCPM：https://github.com/automazeio/ccpm
- Gas Town：https://github.com/steveyegge/gastown ｜ `docs/overview.md`、`docs/glossary.md`、`docs/HOOKS.md`
- Agent Deck：https://github.com/asheshgoplani/agent-deck
- Claude Flow / Ruflo：https://github.com/ruvnet/claude-flow ｜ federation 小节、console/mission 小节
- Citadel：https://github.com/SethGammon/Citadel ｜ `docs/ARCHITECTURE.md`（last-updated 2026-08-09）
- OpenMeld：https://github.com/amplifthq/openmeld ｜ https://docs.openmeld.ai
- Nimbalyst：https://github.com/nimbalyst/nimbalyst ｜ 前身 https://github.com/stravu/crystal

**候选项目**
- Conductor（闭源）：https://www.conductor.build/docs/concepts/parallel-agents
- ccmanager：https://github.com/kbwo/ccmanager
- opcode：https://github.com/winfunc/opcode
- omnara：https://github.com/omnara-ai/omnara
- happy：https://github.com/slopus/happy
- claude-task-master：https://github.com/eyaltoledano/claude-task-master
- BMAD-METHOD：https://github.com/bmad-code-org/BMAD-METHOD
- spec-kit：https://github.com/github/spec-kit
- agent-os：https://github.com/buildermethods/agent-os
- Superpowers：https://github.com/obra/superpowers
- beads：https://github.com/steveyegge/beads
- OpenHands：https://github.com/All-Hands-AI/OpenHands
- Kortix（原 Suna）：https://github.com/kortix-ai/suna
- AutoGen（已归档）：https://github.com/microsoft/autogen → https://github.com/microsoft/agent-framework
- CrewAI：https://github.com/crewAIInc/crewAI
- MetaGPT：https://github.com/FoundationAgents/MetaGPT
- Agno：https://github.com/agno-agi/agno
- LangGraph：https://github.com/langchain-ai/langgraph

**增补项目**
- amux：https://github.com/mixpeek/amux
- Orkas：https://github.com/Orkas-AI/Orkas
- AionUi：https://github.com/iOfficeAI/AionUi
- agent-teams-ai：https://github.com/777genius/agent-teams-ai
- ntasker：https://github.com/nerdocs/ntasker
- cezar：https://github.com/open-mercato/cezar
- open-tag：https://github.com/fancyboi999/open-tag
- multi-agent-shogun：https://github.com/yohey-w/multi-agent-shogun
- limuyang2/agent-team（DSH 插件）：https://github.com/limuyang2/agent-team
- casefile：https://github.com/azimov777/casefile
- compozy：https://github.com/compozy/compozy
- clawport-ui：https://github.com/JohnRiceML/clawport-ui
- proliferate：https://github.com/proliferate-ai/proliferate
- 参考目录：https://github.com/bradAGI/awesome-cli-coding-agents

**检索入口**
- GitHub Search API：`https://api.github.com/search/repositories?q=<kw>&sort=stars&order=desc&per_page=20`
- GitHub Repo API：`https://api.github.com/repos/<owner>/<repo>`
- shields.io JSON：`https://img.shields.io/github/stars/<owner>/<repo>.json`、`.../license/<owner>/<repo>.json`、`.../last-commit/<owner>/<repo>.json`
- 最近提交 Atom：`https://github.com/<owner>/<repo>/commits/HEAD.atom`
- README/源码（jsDelivr）：`https://cdn.jsdelivr.net/gh/<owner>/<repo>@HEAD/<path>`

---

*报告完。抓取时间 2026-10-22 15:05–15:35（Asia/Shanghai）；所有 star/更新时间为该窗口快照。*

