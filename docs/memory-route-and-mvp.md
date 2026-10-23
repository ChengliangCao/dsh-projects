# Memory 路线、MVP 与开源形态（决策版）

> 日期：2026-10-22　｜　状态：**决策已定稿**（用户 2026-10-22 确认）
> 关联：[GitHub 调研报告](github-research-report.md)、[Project Memory 调研](../research/github-memory/README.md)、[ADR 0002：自研记忆骨架](decisions/0002-self-built-project-memory.md)、[ADR 0001：插件+开源](decisions/0001-plugin-first-open-source.md)、[UI 原型](../prototype/projects-ui.html)

---

## 0. 定稿结论

| 问题 | 决定 |
|---|---|
| Memory 路线 | **组合 A：自研骨架 + 可选检索**（`dsh-project-memory` 自研，不依赖第三方 memory 插件） |
| 「完全自研框架」 | 不是重写 DSH；指 Project 域、线程运行层、Memory 层、UI 都在我们自己的插件包内实现 |
| 语义检索 | **不进 MVP**；M2+ 作为 opt-in adapter（memsearch 路线）通过 `MemoryStore` 接口接入 |
| 仓库形态 | **单仓多包（pnpm workspace）**，Apache-2.0 |
| License | **Apache-2.0（定稿）** + NOTICE；第三方依赖 license 清单随发布维护 |

---

## 1. 「自研」的边界

**自研 = 我们自己的插件包里实现**：

- `dsh-project`：Project/Thread/Library 的 storage domain 与服务、生命周期、限额；
- `dsh-project-memory`：Claude auto-memory 语义（`MEMORY.md` 索引 + 每事实文件 + 四类型 + git-repo 派生 scope + 注入 + 治理）；
- `dsh-tool-project`：协调者/线程模型工具；
- `dsh-client-ui-project`：Projects 页面 + Threads/Library/Settings 右侧栏；
- bundle：把以上组装成可安装 profile bundle。

**不自研的部分（复用 DSH 公开扩展点）**：session/sessionController、subagent 或顶层会话、storage-domain/storage-json、systemPrompt、AGENTS.md/agent-instructions、attachments/fileUploads、Web UI slots、token-meter/session-stats、worktree（M4）。

## 2. Memory 自研骨架（MVP 范围）

```
~/.dsh/projects/<projectId>/
├── memory/
│   ├── MEMORY.md                # 索引，常驻注入（默认 4KB 预算，空则 0B）
│   └── notes/<slug>.md          # 每事实一个文件；frontmatter: name/description/type/modified/valid_at/superseded_by
├── library/                     # 项目资料库（不可变字节 + 索引 + 文件夹）
└── threads/<threadId>/          # 线程产物暂存（可选）
```

- **project scope**：优先按项目目录所属 **git repo** 派生（同 repo 的 worktree/子目录共享）；非 git 项目退回项目目录；另有 user scope。
- **类型**：`user` / `feedback` / `project` / `reference`；写入纪律写进系统提示（查重→更新、跳过代码可推导/指令已写、feedback 带 Why/How）。
- **索引治理**：超 200 行/25KB（可配）时写入仍成功但返回「必须重写索引」；`modified` 自动补 ISO 8601。
- **工具**：`memory_write` / `memory_read` / `memory_list` / `memory_delete` / `memory_search`（MVP 搜索 = 索引/文件名关键词匹配，无 embedding）。
- **注入**：`ctx.systemPrompt.section({ order: 4000 })` 动态段，每步重评估；空存储 0B；内容须中和 `{{ }}`（strict interpolation）。
- **文件安全**：`$DSH_HOME` 不在默认 fs-sandbox 可写根 → 用 `node:fs` + `@deepseek-ai/dsh-atomic-write` 的 `withFileLock`/`writeFileAtomic`。
- **红线**：不写自定义 session event（会让会话 resume fail-closed）；所有写入走标准工具调用与消息。
- **可参考**：`dsh-auto-memory`（MIT）的设计与实现思路；若复用代码需保留版权/许可并在 NOTICE 记录，但**不作为运行时依赖**。

### 可选检索（M2+，opt-in）

- 独立包 `dsh-project-memory-retrieval`（adapter），符合 `MemoryStore` 接口；
- Markdown 源真相 + 可重建影子索引（memsearch 路线：chunk → SHA-256 → embedding → Milvus Lite/sqlite-vec）+ dense/BM25/RRF + 三层渐进披露；
- 默认不装；不装时 `memory_search` 走本地索引/文件名匹配；
- 评估指标：召回、token 成本、延迟、索引重建时间；达标后再考虑是否默认推荐。

## 3. MVP 概念与范围

**一句话**：让用户在 DSH 里创建一个项目，用项目对话派活给多个独立线程，在右侧 **Threads** 面板看状态/干预，资料统一进带文件夹的 **Library**，**项目记忆（自研骨架）跨线程保留**；重启后可恢复。本地、单用户、无云依赖。**预计 4–5 周**（比复用现成 memory 多 3–5 天）。

| 范围 | In（MVP 必做） | Out（后续） |
|---|---|---|
| 项目 | 创建/列表/打开/设置/暂停/归档/删除；目标、指令、目录 | 从已有会话创建项目、多人协作、分享 |
| 协调者 | `projects-coordinator` preset；路由/开线程/汇总/维护记忆 | goal 无人值守、自动建议线程、定时任务 |
| 线程 | 顶层 Session 创建、简报注入、列表、steer、stop、resolve/reopen、状态同步 | worktree 隔离、PR 自动化、线程内嵌套 subagents |
| Threads 面板 | Threads 默认首个 tab；需要你/进行中/待收/空闲/已收尾 + 用量 | 通知中心、移动端 |
| Library | 上传/列表/读取/删除/替换；**文件夹（新建/进入/移动/拖拽）**；配额；线程只读 | 版本历史、引用图谱、语义检索 |
| **Memory** | **自研骨架**：索引+每事实文件+四类型+git-repo scope+注入+治理+remember/forget/read/list（+本地 search） | 语义检索 adapter、双时态失效、跨项目用户画像 |
| 生命周期 | 重启恢复、自动 resolve（7 天可配）、限额 | 多机同步、云沙箱 |
| UI | Projects/工作台/线程三视图 + Threads/Library/Settings + 白蓝主题 + 设计标注 | 响应式深度适配 |

**里程碑**：
- **M0** 3–5 天：线程载体 spike（`sessionController.create/prompt/cancel`）；Memory 骨架 spike（注入/原子写/索引治理/scope）；Remote/Library 写入；审批可见性；状态同步。
- **M1** 6–9 天：Project 域 + 协调者 + Projects 首页/设置 + **Memory 骨架** + Library（文件夹）。
- **M2** 8–12 天：线程闭环 + Threads 面板 + 状态同步 + 审批/汇报 + 重启恢复。
- 验收用户故事：创建项目 → 建文件夹上传资料 → 派 2 个任务 → Threads 看「需要你/进行中」→ 线程内批准/停止/收尾 → 对话线程卡同步 → 记忆跨线程生效 → 重启继续。

## 4. 单仓多包（已定稿）

```
dsh-projects/                       # pnpm workspace, Apache-2.0
├── packages/
│   ├── host-project/               # Project 域 + 线程台账 + 生命周期
│   ├── host-memory/                # dsh-project-memory：自研记忆骨架
│   ├── host-tools/                 # project_* 模型工具
│   ├── client-ui-project/          # Projects 首页 + Threads/Library/Settings
│   ├── retrieval-adapter/          # M2+ opt-in 语义检索（先留空）
│   └── bundle/                     # cordis.patch.yml + presets + icon/README
├── prototype/                      # UI 原型与截图
├── docs/                           # 调研、方案、ADR、M0 计划
├── LICENSE                         # Apache-2.0
└── .github/workflows/              # DSH 0.2.x 兼容矩阵
```

理由：bundle 精确引用同仓版本、一次 CI/一套 DSH 版本矩阵、跨包 TypeScript 类型共享、issue/PR 集中；retrieval adapter 将来可独立发布。

## 5. License（已定稿）

**Apache-2.0**：明确专利授权 + NOTICE + 贡献许可，利于多人/公司贡献与商业采用；与 DSH 的 MIT 依赖兼容。

依赖核查：自研后无强制第三方记忆依赖；若 M2+ 接入 memsearch（MIT）/其他，按 opt-in adapter 处理并在 NOTICE 记录；**禁止内嵌** basic-memory（AGPL）、Serena（GPL）、byterover（ELv2）。

## 6. 下一步

1. 按本决策更新[方案文档](dsh-claude-projects-plan.md)（Memory 章、包拆分、里程碑）；
2. 搭建 monorepo 骨架与 M0 spike 清单（见 `docs/m0-spike-plan.md`）；
3. M0 结束后再进入 M1 实现。
