# ADR 0002：Project Memory 采用「自研骨架 + 可选检索」

- 状态：**已接受（Accepted）**，2026-10-22
- 决策人：项目所有者（用户）
- 取代：ADR 0001 中「MVP 用组合 B（依赖 dsh-auto-memory）」的临时倾向
- 关联：[Project Memory 调研](../research/github-memory/README.md)、[GitHub 调研报告](../github-research-report.md)、[MVP 说明](memory-route-and-mvp.md)

## 背景

Claude Project Memory 实际是两套系统（[官方 memory 文档](https://code.claude.com/docs/en/memory)）：

- **指令层**：CLAUDE.md（人写；project/user/org scope）；DSH 对应 AGENTS.md/项目指令机制，直接复用；
- **记忆层**：auto memory（Claude 自己写）——`MEMORY.md` 索引（首 200 行/25KB 常驻）+ 每事实一个 topic 文件（按需读）+ 四类型（user/feedback/project/reference）+ **按 git repo 派生 project scope（同 repo worktree 共享）** + `modified` 时间戳 + 机器本地 + 子 agent 默认不加载。

GitHub 调研结论：没有单一开源项目完整实现这套语义；可内嵌且最接近的是 `dsh-auto-memory`（101★，MIT，DSH 原生），但它缺 git-repo scope、索引超限治理、语义检索，且是单维护者小项目。若直接依赖它，我们的 Project/线程/记忆数据模型会被第三方边界切割，并引入双写/版本漂移风险。

项目所有者决定：**Memory 采用自研骨架 + 可选检索**，不在 MVP 依赖第三方 memory 插件。

## 决策

1. **自研 Host 包 `dsh-project-memory`**（属于本项目 monorepo），实现 Claude auto-memory 语义：
   - `MEMORY.md` 索引 + 每事实一个 Markdown 文件（YAML frontmatter：`name`/`description`/`type`/`modified`/`valid_at`/`superseded_by`）；
   - 四类型：`user` / `feedback` / `project` / `reference`；写入纪律（查重→更新而非堆积、跳过代码可推导与指令已写内容）；
   - **project scope 由 git repo 派生**（同 repo worktree/子目录共享；非 git 目录退回项目目录），另有 user scope；
   - 索引注入走 `ctx.systemPrompt.section`（默认 4KB 硬预算，空存储 0B）；
   - 工具：`memory_write` / `memory_read` / `memory_list` / `memory_delete` / `memory_search`（search 先做索引内关键词/文件名匹配，不做向量检索）；
   - 索引超限治理：写入成功但返回「必须重写索引」错误（复刻 Claude 行为）；
   - 明文 Markdown、可 git 审计；Host 侧用 `node:fs` + 原子写/跨进程锁（`$DSH_HOME` 不在 fs-sandbox 可写根内）；
   - **不写自定义 session event**（会让会话 resume fail-closed），全部走标准消息与工具调用。
2. **指令层复用 DSH 现有机制**（AGENTS.md/项目指令），与记忆层显式分离；项目指令仍存 `projects` domain。
3. **检索层不进入 MVP**。一期只做「索引常驻 + 正文按需」。M2+ 提供独立的、**opt-in 安装**的检索适配器（memsearch 路线：Markdown 源真相 + 可重建影子索引 + 三层渐进披露），通过 `MemoryStore` 接口接入，默认不启用。
4. **接口先行**：`dsh-project-memory` 暴露稳定 `MemoryStore`（`write/read/list/delete/search` + scope 解析），未来替换实现不影响 Project/线程/UI。
5. **可参考但不依赖 `dsh-auto-memory`**：其设计（4KB 预算、原子写、注入位置、工具面）可作为实现参考；若复用其代码/文本，遵守 MIT 归属要求（保留版权与许可声明），并在 NOTICE 中记录。
6. **许可证与仓库形态**（与 ADR 0001 一致）：**Apache-2.0** + **单仓多包（pnpm workspace）**。

## 理由

- **数据模型一致性**：Project、Thread、Library、Memory 同属一个 domain 设计，`projectId ↔ memory scope` 可直接映射，不需要 adapter 补丁。
- **单一写者**：记忆只由我们的 Host 包写，避免两个 memory 插件双写。
- **差异化**：git-repo 派生 scope、索引超限治理、失效而非删除、可审计 Markdown，正是调研里开源方案的空白。
- **许可证干净**：自己实现，不引入 AGPL/GPL/ELv2 依赖。
- **代价可控**：预计比「直接依赖现成插件」多 3–5 天（骨架/注入/锁/治理），但换来长期可维护与产品一致性。

## 后果

- 需要维护一个自研 memory 包与 eval（索引预算、召回、更新合并的确定性测试）；
- 需要谨慎设计与 Claude auto-memory 的差异（例如 DSH 的 project 概念不是 git repo；我们以「项目目录所属 git repo」派生 scope，非 git 项目退回项目目录）；
- 语义检索延后意味着「按意思找记忆」能力一期没有，需要用户/模型主动按索引与文件名查找；
- 迁移成本：若未来换成第三方/自研 v2，只改 `MemoryStore` 实现，domain 数据仍以 Markdown 为源真相。

## MVP 验收（Memory 部分）

1. 新建项目 → 协调者/线程中「记住 X」→ 写入 `MEMORY.md` + topic 文件，下一次请求索引可见；
2. 删除/更新事实 → 索引与文件同步；超限时返回「重写索引」错误；
3. 同一 git repo 的不同 worktree/session 读到同一项目记忆；不同项目互相隔离；
4. 空存储注入 0 字节；默认 4KB 预算下注入量可控；
5. 重启 DSH 后记忆仍在，且索引未重复；
6. 语义检索关闭时，`memory_search` 仅做本地索引/文件匹配（无 embedding/外部服务）。
