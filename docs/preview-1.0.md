# DSH Projects · Preview 1.0（体验版）

> 2026-10-23｜独立 profile `projects`（web 模板），**不影响 desktop GUI**
> 当前入口（服务重启后 token 会变，以最新轮次消息为准）：
> **http://127.0.0.1:61990/?token=SN4Wf0UXBAfxDoXXPnzGDdDds4x-aILICyajhGh3hEg**
> 截图：`prototype/preview/10-final-projects.png`（Projects 页）

## 已实现的完整闭环

| 模块 | 能力 |
|---|---|
| **多项目** | 注册表 `~/.dsh/projects-ui/registry.json` + `<dir>/.dsh/project.json`；Projects 页多项目卡、**新建项目**（名称/目标/目录/指令）、点卡切换；生命周期 pause/resume/archive/unarchive/delete |
| **Coordinator** | 项目对话里自动遵守策略：多步任务 `project_spawn_thread`、`project_list_threads` 看状态、`project_resolve_thread` 收尾、`memory_*` 记忆、`library_*` 资料；协调者不直接改代码 |
| **Threads 页/面板** | 每任务一个独立顶层 Session；**默认每个线程一个 git worktree + branch**（`thread/<id>-<slug>`，隔离冲突）；支持 list/send/stop/resolve/report；左侧 Threads 页（推荐入口）看真实状态、打开、收尾；会话 Header「Threads」按钮为辅助；watcher 在 `turn/end` 自动更新状态；`project_thread_diff` 看线程改动 |
| **项目记忆** | 自研骨架：`MEMORY.md` 索引 + 每事实文件 + 四类型 + git-repo 派生 scope + 4KB 预算注入 + 原子写/锁；`memory_write/search/list/read` |
| **Library** | 项目级资料库：新建文件夹、上传（快照入库）、移动文件、列表/读取；Threads 面板 Library tab 浏览；Host 工具 `library_*` |
| **建议线程** | `project_propose_threads` 写入建议，Threads 面板展示，回对话启动 |
| **注意力** | state 返回线程计数（waiting/active/review/done/failed），Projects 面板显示「待收/进行中/需要你」；7 天自动 resolve |
| **数据通道** | Host 只读/写 JSON 路由：`/dsh-projects/state|create|switch|lifecycle|library-mkdir|library-upload|library-move|thread-resolve` |

## 怎么玩（建议顺序）

1. 打开链接 →「继续」；
2. 左侧 **Projects** 图标 → 看项目卡，点「＋新建项目」可建新项目（填目录）；
3. 点项目卡/「打开项目对话」进入 Coordinator 会话，说：
   - “开一个线程：只读分析 src/queries.sql，产出 findings.md，完成后汇报”
   - “列出线程”
   - “给线程 xxx 发消息：先给一句话结论”
4. 会话 Header 点 **Threads 页/面板** 打开面板：Threads / Library 两个 tab；线程可打开/收尾；Library 可新建文件夹/上传/移动；
5. 试试“记住：项目代号是 falcon”，然后新建会话问代号 → 会命中记忆；
6. 线程完成或被 watcher 收尾后，回协调者问「线程状态？」。

## 已知限制（明确未做/半成品）

- 未做**项目级定时任务**、内联线程卡（Chat 卡片）、用量/限额统计、Suggested threads 一键启动（现在是回对话启动）；
- Library 上传走浏览器 FileReader（大文件不适合；也没有进度条）；
- 线程 worktree 的**合并/删除**流程未做：完成后 branch 留在 `.dsh/worktrees/`，需要人工 review/清理；
- 多项目切换后，部分旧工具（memory/library 的固定 config）仍以 demo 项目为主——新项目需重启预览才能完全切换作用域（下一轮修）；
- 预览 token 每次重启都会变；页面数据依赖服务端轮询（非实时推送）；
- 无移动端适配、无多用户。

## 文件位置

- bundle 源码：`spike/app-bundle/`（`lib/projects.js` 多项目/路由，`lib/project-tools.js` 线程/记忆/Library 工具，`lib/memory.js` 记忆注入，`lib/client.js` Projects/Threads/Library UI）
- 演示项目：`.demo-project/`（git 仓库；线程 worktree 在 `.demo-project/.dsh/worktrees/`）
- 设计文档：`docs/dsh-claude-projects-plan.md`、`docs/memory-route-and-mvp.md`、`docs/build-progress.md`

## 重启（token 会变）

```sh
DSH="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"
"$DSH" --profile projects --no-open --port 61990
```
