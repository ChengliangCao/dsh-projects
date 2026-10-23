# DSH Projects UI 原型（v2）

单文件、零依赖的可交互 HTML 原型，用于确认「Projects 版 DSH」的界面与交互方向；不是最终实现，也不连接 DSH 后端。

- 打开方式：浏览器直接打开 `prototype/projects-ui.html`（已在本机默认浏览器打开过）
- 截图：`prototype/preview/`（首页 / 工作台 / 线程 / Library 文件夹 / 深色 / 设计标注）
- 设计基座：DSH Web UI 的 Slot 体系与 `--dsw-alias-*` 主题 token；默认白蓝配色，可切深色

## 页面与视图

| 视图 | 说明 | 对应 DSH 扩展点 |
|---|---|---|
| Projects 首页 | 项目卡（目标/状态摘要/Library 数量/最近活动）、新建项目、最近活动 | `main` keyed slot key `projects` + `sidebar.panellist` |
| 项目工作台 | 左侧协调者对话 + 右侧 **Threads** / Library / Settings；线程卡、审批卡、Suggested threads、汇报卡 | 复用 `conversation`；卡片走 `conversation.chat.*` tool view/turnTail |
| 线程会话 | 独立会话视图：面包屑、状态、Stop/收尾、工具行、`project_report` 卡、线程 composer | 复用会话主区；通过 `sessionId` 打开顶层 Session |
| Threads 面板 | 默认第一个 tab；按「需要你 / 进行中 / 待收 / 空闲 / 已收尾」分组 + 用量限额 | `ctx.sidebarRightTabs.register` + `sidebar.right.pane.tab` |
| Library 面板 | 上传区；**文件夹**（新建/进入/面包屑）；文件「移动」菜单与拖拽入文件夹；来源/大小/时间 | 新 Client tab；数据来自项目 Library 服务 |
| Settings | 目标/项目指令（≤16k）/Memory 索引/模型/自动收尾/暂停归档删除 | 同一右侧栏 tab |

## 已实现的交互（演示用）

- 主题切换（默认白蓝，可切深色）；`⌘K` 聚焦搜索
- 左侧栏 Claude 式项目树：点击项目打开工作台；点箭头展开/收起，线程嵌套在项目下
- 新建项目弹窗 → 创建后首页插入新卡并进入工作台
- 对话输入框发送演示消息，协调者自动回一条
- Suggested threads 启动/全部启动 → 变成「进行中」线程行
- **线程状态同步**：打开线程 → 点「收尾」/「停止」→ 返回工作台后对话里的线程卡、Threads 面板同步更新；点「重新打开」可恢复；线程 #2 的「批准一次」会把它从 Waiting 同步为进行中
- Library：新建文件夹、进入文件夹（面包屑返回）、文件「移动」到文件夹、**拖拽文件到文件夹**、上传演示文件、文件计数与来源标签
- 线程卡/汇报卡/审批卡均为可点击入口
- 「设计标注」浮层：列出每个区域对应的 DSH Slot/服务

## URL 参数（方便截图/演示）

`?view=home|workbench|thread`、`&tab=threads|library|settings`、`&folder=f-docs`、`&theme=dark|light`、`&annot=1`

## 待确认的设计取舍

1. Threads 面板宽度 384px 是否合适；窄屏是否改为全屏抽屉
2. 线程卡信息量（标题/状态/模型/时长/交付物）是否够用
3. Library 是否需要「重命名/删除文件夹」「多选移动」等管理动作（原型只做了新建+移动+拖拽）
4. 明暗主题是否需要跟随系统
