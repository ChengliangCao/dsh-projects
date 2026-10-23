# DSH Projects · 开源发布任务清单（全权执行）

> 授权：用户按默认全权交付（public repo `ChengliangCao/dsh-projects`、main、Apache-2.0、版权人 Ignis、用当前 GitHub 账号推送、安装渠道 git URL + Release tarball）。
> 汇报规则：**每完成一个任务向用户汇报一次**（进度、证据、下一步）。

## 完成定义（DoD）

1. 公开仓库可访问，README 有介绍/截图/安装/使用/限制；
2. 干净 profile 从零安装成功（文档步骤可复现）；
3. 功能验收：多项目、Coordinator、线程、worktree 隔离、记忆、Library、watcher、生命周期；
4. CI（install/typecheck/build/test）绿；
5. `v0.1.0` tag + GitHub Release（tarball）；npm 发布脚本备好（需用户 token）。

## 任务

| ID | 任务 | 验收证据 |
|---|---|---|
| T1 | 仓库脚手架：git init、.gitignore、LICENSE/NOTICE、README、CHANGELOG、CI workflow、初始 commit | `git log`、CI 文件、无大文件/无密钥 |
| T2 | 创建 GitHub public 仓库并 push main | `gh repo view` 输出、远端 commit |
| T3 | 可分发安装包：bundle 打包脚本、install 脚本、配置去绝对路径、干净 profile 安装验证 | 安装日志 + 首次启动截图 |
| T4 | Host 功能收尾：每项目独立 memory scope、coordinator preset、状态实时化（轮询/SSE） | 验收脚本输出 |
| T5 | UI 对齐一：左侧栏项目树 + Recents 过滤项目会话 | 截图 + 点击验证 |
| T6 | UI 对齐二：右侧 Threads（Waiting/Idle/Resolved）+ Library + Scheduled；项目三栏工作台 | 截图 |
| T7 | UI 对齐三：会话内线程卡（View thread / Sent to a thread）、Overview 下拉 | 截图，或明确标注未完成 |
| T8 | 工程化：测试补充（state 路由、worktree、library）、错误处理、日志 | CI 绿 |
| T9 | 发布准备：版本 0.1.0、CHANGELOG、截图、安装文档、Release tag/tarball | Release URL |
| T10 | 干净环境最终验证 + 发布公告文本 + 最终汇报 | 验证记录 |

## 当前默认决策（无需再问）

- repo: `ChengliangCao/dsh-projects`（public，main）
- license: Apache-2.0，copyright `Ignis`
- install: `git clone` + `pnpm` build + `dsh plugin add <path>`；另发 Release tarball；npm publish 需用户 token（脚本备好）
- 已知风险：会话内线程卡依赖未公开 conversation 槽位，若成本过高按 T7 标注限制
