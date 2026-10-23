# DSH Projects 实施进度（自动续跑用）

> 最后更新：2026-10-23 14:05｜目标：按原计划一路做到 M4，完成后交给用户体验。
> 运行环境：danger-full-access、approval never；DSH CLI = `/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh`
> 预览 profile：`projects`（web 模板）｜端口 61990｜bundle 从 tarball 安装（**必须先 pnpm pack 再装，link 方式客户端模块不加载**）
> 当前 token URL：http://127.0.0.1:61990/?token=SN4Wf0UXBAfxDoXXPnzGDdDds4x-aILICyajhGh3hEg
> 后台服务 job：bash-0b6919d07d4646b1

## 已完成
- M0：Memory 核心 + 9/9 tests；live 注入/工具验证；线程载体工具 live（spawn/list/send/stop/report）；项目指令注入；Library Host 工具（create/add/list/move/read）；Projects 客户端入口+主面板（demo 快照数据）。
- 关键路径：`spike/app-bundle/`（bundle 源码）｜`.demo-project/`（demo 项目）｜`packages/host-memory/`（转正实现）｜`docs/preview-0.1.md`

## 待做（按序）
### M1 收尾：多项目
- [x] Project 注册表：`~/.dsh/projects-ui/registry.json` + `<dir>/.dsh/project.json`（字段 id/title/goal/dir/instructions/createdAt）
- [x] Host 工具：`project_list` / `project_create` / `project_switch` / `project_current`（`app-projects` 行，已 live 启动）
- [x] **Host→Client 数据通道**：`app-projects` 用 `ctx.inject(['webServer'], …)` 注册 `/dsh-projects/state`、`/create`、`/switch` 只读/写 JSON 路由（已验证 webServer.register 可用）
- [x] Projects UI：多项目卡、真实线程/记忆/Library 计数、「＋ 新建项目」弹窗（POST create）、点卡切换项目（POST switch）
- [x] 验证：GET /dsh-projects/state 返回 `currentId=demo`、项目 `.demo-project`、`threads=[补全 API 文档 done]`、memory=1
- [ ] 每项目独立 threads.json / memory / library
### M2：线程+总览
- [x] Threads 面板：会话 Header「Threads」按钮 + 浮层（Threads/Library 两个 tab）；真实线程状态、打开线程、收尾按钮（POST /dsh-projects/thread-resolve）
- [x] Library tab（只读视图）：真实目录树/文件列表（state 返回 library.folders/files）；上传/移动 UI 下轮
- [x] watcher：`ctx.on('session/event')` 的 `turn/end` → 自动更新 threads.json（completed→done/idle、error→failed）；启动日志已验证
- [x] Coordinator policy：systemPrompt 段 `projects:coordinator-policy`（派活/收线程/记忆/资料/审批边界规则）
- [x] Library 新建文件夹：POST `/dsh-projects/library-mkdir` + Library tab「＋文件夹」按钮（已验证创建 `合同原件`）
- [x] M3 生命周期：项目 status（active/paused/archived）+ POST `/dsh-projects/lifecycle`（pause/resume/archive/unarchive/delete）；Projects 卡上按钮（暂停/继续/归档/取消归档）
- [x] 自动收尾：state 读取时 idle/done 超过 7 天自动 resolved（resolvedBy=auto）
- [x] 注意力计数：counts {waiting, active, review, done, failed}，Projects 面板显示「待收/进行中/需要你」
- [x] **M4 线程 worktree 隔离**：spawn 自动 `git worktree add -b thread/<short>-<slug> .dsh/worktrees/<short> HEAD`；线程 cwd=worktree、brief 注明分支与「不要 merge」；threads.json 记录 worktree/branch；新增 `project_thread_diff` 工具（status+diff stat）；client Threads 行显示分支；git 不可用时回退共享目录
- [x] 实测 `git worktree add/list` 可用（smoke-test 已清理）
- [x] Library 移动：POST `/dsh-projects/library-move` + Library tab 文件「移动」按钮；实测文件从根目录移入 `合同原件`，state 同步
- [x] Suggested threads：`project_propose_threads` 工具写 `.dsh/proposals.json`；state 返回 proposals；Threads tab 显示建议及「去对话启动」
- [x] Library 上传：POST /dsh-projects/library-upload + 「＋上传」；实测 上传测试.txt 21B 入库
- [x] 交付文档 docs/preview-1.0.md；Projects 截图 prototype/preview/10-final-projects.png
- [ ] 剩余：Threads/Library 面板截图、用量、定时任务、内联卡

## 已验证（第 7 轮）
- library-move `{ok:true}`，`.demo-project/library/合同原件/移动测试.md` 落盘；state files 更新

## 已验证（第 5 轮）
- lifecycle pause → `{ok:true,status:paused}`；resume → active；state counts `review=1` 正确

## 已验证（第 4 轮）
- mkdir 接口返回 `{ok:true}`，`.demo-project/library/合同原件` 落盘，state 返回 `folders:[合同原件]`
### M3：注意力/生命周期/限额
- [ ] 需要你/待收聚合；Pause/Archive/Delete；自动 resolve（7 天）；模型/effort；用量；propose_threads
### M4：隔离与增强
- [ ] 每线程 git worktree/branch（spawn 时 cwd=worktree、resolve 时提示 diff）
- [ ] 线程卡内联（Chat tool view）；Suggested threads；定时任务；Continue as project；通知/导出
- [ ] 收尾后：完整演示 + 截图 + 使用说明给用户

## 已验证（第 3 轮）
- 启动日志：`watcher attached to session/event`、routes registered
- GET /dsh-projects/state 返回 threads + library tree + memory 计数

## 已验证（第 2 轮）
- `/dsh-projects/state` 真实数据验证通过（线程/记忆/Library 计数来自磁盘）
- 预览已重新打包部署；新 token 见顶部

## 已验证（第 1 轮）
- 多项目注册表插件在 projects profile 启动成功：日志 `[projects] multi-project registry ready at /Users/ignis/.dsh/projects-ui/registry.json`

## 重新部署/验证命令
```sh
cd /Users/ignis/workspace/dsh-plugins/spike/app-bundle
NODE=/Users/ignis/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node
PNPM=/Users/ignis/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/pnpm/bin/pnpm.mjs
"$NODE" "$PNPM" pack --pack-destination /tmp
DSH="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"
"$DSH" plugin --profile projects add /tmp/dsh-projects-app-bundle-*.tgz   # 先 remove 旧版
kill 后台旧 job; "$DSH" --profile projects --no-open --port 61990         # 后台启动，读 stdin 之外 job 日志拿新 token
```
UI 验证：headless Chrome CDP 打开 token URL，点 aria-label=Projects，检查 body 含 "Projects"。

## 第 10 轮最终验收（2026-10-23）
- state: current=Payments API 性能优化, status=active, counts=review 1, memory=1, library folders=[合同原件], files 含上传测试/move 测试
- Projects 截图: prototype/preview/10-final-projects.png；交付指南: docs/preview-1.0.md
- 交付入口: http://127.0.0.1:61990/?token=JBO0_uOtf0O3kYTRPOQehdjDOi0r91fL_PjHnmANno0
- 未完成（已写入交付文档限制）: 项目级定时任务、内联线程卡、token 用量统计、Suggested threads 一键启动、worktree 合并/清理 UI、Threads/Library 面板截图自动化

## 第 11 轮（2026-10-23）
- 发现会话 Header 的 Threads 按钮在 headless 下不可见/可能未挂载；新增**侧栏 Threads 页**（sidebar.panellist id=threads + main key=threads，ThreadsPage：线程列表/打开/收尾 + Library 列表/新建文件夹），保证 UI 可见可点。

## 第 12 轮（最终）
- 最终 state 验证通过；交付指南 Preview 1.0 更新为最新 token 与 Threads 页说明。
- 交付状态：可体验版已交付；明确未完成项：定时任务、内联线程卡、用量/限额、Suggested threads 一键启动、worktree 合并清理 UI。

## 第 13 轮（Claude 对齐 · 第一步）
- 新建项目目录校验：绝对路径/存在/是目录/可写，错误码 PATH_REQUIRED/PATH_NOT_ABSOLUTE/PATH_NOT_FOUND/NOT_A_DIRECTORY/NOT_WRITABLE；客户端弹窗 inline error（已验证两种错误返回）。
- 点项目 → switch + 项目首页横幅（← 全部项目 / 标题 / 状态 / 目录 / 目标 / 统计 / 「进入项目对话」）。
- 项目绑定 coordinatorSessionId：POST /dsh-projects/coordinator 首次创建并 prompt、复用；已验证 demo → coordinator-33469d49（created）。
- 当前 token URL: http://127.0.0.1:61990/?token=d3pIrQm3MuOCTE9pw7daLBmuoMHAYLRXMWcyKa4e-zw；job bash-70a4a4adb6454141
- TODO 下一轮：替换 sidebar.workspaces 项目树 + Recents 过滤（项目会话不在左栏）；右栏 Threads(Wating/Idle/Resolved)+Library+时间；会话内线程卡。
