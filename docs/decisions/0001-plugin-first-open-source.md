# ADR 0001：以「插件 + bundle」形态实现并开源

- 状态：**已接受（Accepted）**，2026-10-22
- 决策人：项目所有者（用户）+ Lead 整理
- 关联：`docs/dsh-claude-projects-plan.md`（方案 v1.2）、[ADR 0002：自研 Memory 骨架](0002-self-built-project-memory.md)

## 背景

我们要为 DSH（DeepSeek Harness）实现 Claude Code「Projects」等价能力（Coordinator + Threads + Library + Overview + Project Memory）。方案调研确认：

1. DSH 的产品功能全部是 Cordis 插件行，新增功能的标准路径是「写包 → 写 bundle patch → 装进 profile」，不需要改核心；
2. 官方包已经提供全部关键底座（session、sessionController、subagent、storage domain、system prompt、attachments、UI slots），缺口是「Project 域 / 项目级 Library / 项目→线程 UI / 项目工具」这些产品层能力；
3. 用户希望实现后**开源**。

## 决策

**采用纯插件形态实现，不改 DSH 核心；以可安装 bundle 交付并开源。**

具体约束：

1. **不改核心**：所有能力放在独立的 Host 包 / Client 包 / bundle 中；不修改 `dsh-base`、`dsh-web-app` 或任何内置包；通过公开的 Loader patch、Service、Slot、Remote 扩展点接入。
2. **交付形态**：一个可安装的 bundle 包（`cordis.patch.yml` + preset 声明 + 依赖），通过 `plugin_manager install_bundle` 安装到 profile；卸载/回滚不改动用户数据（project 数据在 `~/.dsh/projects` 与 `projects` domain，独立于安装）。
3. **仓库形态**：独立开源仓库，**单仓多包（pnpm workspace）**：`packages/host-project`、`packages/host-tools`、`packages/memory-adapter`、`packages/client-ui-project`、`packages/bundle`；包放在自有 npm scope（不使用 `@deepseek-ai` 官方 scope），版本与 DSH 版本范围绑定（peerDependencies 锁定 `0.2.1-rc.x` 并声明兼容区间）。
4. **开源许可**：**Apache-2.0（2026-10-22 定稿）**（含专利授权与 NOTICE，利于公司/多人贡献与商业化采用；与 DSH 的 MIT 依赖兼容）。第三方依赖必须核查 license 兼容性（尤其 memory 方案、UI 组件、图标资源）。
5. **Memory 层自研**（见 ADR 0002）：`dsh-project-memory` 由本项目实现（Claude auto-memory 语义），**MVP 不依赖第三方 memory 插件**；仅 M2+ 的可选语义检索以 **opt-in adapter 包**提供，核心 bundle 只依赖稳定的 `MemoryStore` 接口，保证「不装外部服务也能用」。
6. **上游演进策略**：只使用公开扩展点（`ctx.slots.inject`、`ctx.typing`/Remote 注册、Service 注入），不 fork 上游包；插槽/API 变化时通过版本区间与 CI 兼容测试兜底。
7. **不做的部分**：云沙箱、GitHub App/PR 自动化、多用户共享（与 Claude beta 一致的单用户语义）；这些保持为非目标，未来若做也以独立插件扩展。

## 理由

- **用户价值**：装一个 bundle 就能获得 Projects，不要求用户替换/重建 DSH；可随上游升级。
- **风险控制**：DSH 0.2.1-rc 仍快速演进，插件形态避免维护核心 fork 的合并成本；失败可回滚。
- **开源友好**：插件包边界清晰、依赖封装、许可证干净，便于社区贡献与二次组合；Project 域 / UI / Memory adapter 可独立发布。
- **团队协作**：Host/Client/工具/adapter 可按包拆给不同贡献者，写作用域清晰。

## 后果

- 需要自己实现 Host↔Client Remote（手写 Typert 或 Connection fetch 路由）、packaging、兼容性测试；
- 需要维护 DSH 版本兼容矩阵；
- 上游实验性 API（subagent/worktree 等）变化会导致偶发破坏，必须锁定版本并提供回滚；
- 不能假设用户会改 DSH 源码，所以所有能力必须通过公开扩展点可达。

## 待定（开源前补齐）

- [x] 许可证：**Apache-2.0**（2026-10-22 定稿）；第三方依赖 license 清单随发布维护
- [ ] npm scope 与包命名（候选：`@dsh-plugins/*` 或自有 org scope）
- [x] 仓库结构：**单仓多包（pnpm workspace）**（2026-10-22 建议已记录，待最终确认）；CI 矩阵覆盖 DSH 0.2.x
- [ ] 贡献指南 / DCO / issue 模板
- [ ] 与 DSH 官方插件市场（`plugin_manager`）的发布方式
