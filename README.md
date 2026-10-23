# DSH Projects

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 带来 Claude Code Projects 式的工作方式：

- **Project**：长期项目容器（目标、指令、项目记忆、仓库、资料库）
- **Coordinator**：项目对话里的协调者，只做路由 / 台账 / 汇总 / 记忆，不做重执行
- **Threads**：每个任务一个独立会话，可并行、可 steer/停止/收尾/重开，状态与对话卡片同步
- **Library**：项目级资料库，上传与线程产出统一入库，支持文件夹、移动、拖拽
- **Project Memory**：自研骨架——`MEMORY.md` 索引 + 每事实文件 + git-repo 派生的项目 scope（语义检索 M2+ 可选 adapter）

> 状态：**M0（可行性 spike）**。仓库目前是可运行的骨架，尚未发布可安装 bundle。
> 设计与调研：[方案文档](docs/dsh-claude-projects-plan.md)、[GitHub 调研报告](docs/github-research-report.md)、[Memory 与 MVP 决策](docs/memory-route-and-mvp.md)、[M0 Spike 计划](docs/m0-spike-plan.md)、[ADR 0001](docs/decisions/0001-plugin-first-open-source.md)、[ADR 0002](docs/decisions/0002-self-built-project-memory.md)、[UI 原型](prototype/projects-ui.html)

## 仓库结构（单仓多包，pnpm workspace）

```text
packages/
├── host-project/          # Project 域、线程台账、生命周期
├── host-memory/           # 自研项目记忆骨架（dsh-project-memory）
├── host-tools/            # project_* 模型工具
├── client-ui-project/     # Projects 页面 + Threads/Library/Settings
├── retrieval-adapter/     # M2+ opt-in 语义检索 adapter（占位）
└── bundle/                # cordis.patch.yml + presets + icon
docs/                      # 调研、方案、ADR、M0 计划
prototype/                 # UI 高保真原型与截图
```

## 开发

```sh
pnpm install
pnpm typecheck
pnpm build
```

安装到 DSH profile（M0 之后再提供可安装 bundle）：

```sh
dsh plugin --profile <name> add ./packages/bundle
```

## 许可证

Apache-2.0，见 [LICENSE](LICENSE)。第三方依赖与归属记录见 `NOTICE`（发布前补齐）。
