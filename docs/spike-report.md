# M0 Spike 报告（Day 1 · 2026-10-22）

> 环境：DSH 0.2.1-rc.2 desktop profile；Node v24.19.0；pnpm 11.28.5（DSH 自带运行时）；GitHub CLI 2.103.0（已登录 `ChengliangCao`）
> 关联：[M0 计划](m0-spike-plan.md)、[ADR 0002](decisions/0002-self-built-project-memory.md)、[方案 v1.2](dsh-claude-projects-plan.md)

## 0. 一句话状态

**Day 1 完成**：monorepo 可安装/可构建/可测试；**自研 Project Memory 骨架的核心已实现并通过 9/9 单元测试**（git-repo scope、索引预算、超限治理、并发锁、本地搜索、空存储 0B 注入）。
**尚未做**：装进 DSH 的 live 验证（线程载体 / 审批 / watcher / Remote / Library / 归档）——需要你批准在 scratch profile 安装 demo bundle。

## 1. 环境与工具链（已完成）

| 项 | 结果 |
|---|---|
| 包管理器 | 使用 DSH 自带 pnpm（避免系统 npm 日志目录被沙箱拒绝） |
| 依赖安装 | ✅ `pnpm install` 成功（7 workspace projects） |
| 类型检查 | ✅ `pnpm -r typecheck` 全绿（5 个包） |
| 构建 | ✅ `pnpm -r build` 全绿，`packages/host-memory/lib/` 产出 JS+d.ts |
| 依赖可用性 | `@deepseek-ai/cordis@4.0.5`、`dsh-atomic-write`、`schemastery` 等在 npm 可解析；DSH 包只装需要的部分，保持轻量 |
| GitHub | `gh` 已安装并登录（`ChengliangCao` / 显示名 `Ignis` / id 125634716）；本地尚未 `git init`、尚未创建远端仓库 |

## 2. 自研 Memory 骨架（已完成核心，M0 §2.1 的 1/2/4/5/6/7 项）

实现文件：`packages/host-memory/src/memory-store.ts`；测试：`packages/host-memory/tests/memory-store.test.ts`。

| 能力 | 状态 | 说明 |
|---|---|---|
| `MEMORY.md` 索引 + 每事实一文件 | ✅ | `notes/<slug>.md`；索引一行一条，带描述与月份 |
| 四类型 | ✅ | `user` / `feedback` / `project` / `reference`；非法类型拒绝 |
| **git-repo 派生 scope** | ✅ | 沿目录向上找 `.git`；同 repo 子目录/worktree 共享 scope；非 git 退化为项目目录 |
| 注入预算 | ✅ | 默认 4KB / 200 行；空存储返回 `''`（0 字节）；超预算截断并带标记；截断后仍严格 ≤ 预算 |
| 索引超限治理 | ✅ | 文件仍写入，但 `write()` 返回 `indexOverLimit: true`（对应 Claude 的「改写索引」行为） |
| 原子写 + 跨进程锁 | ✅ | 同目录 temp + rename；`mkdir` 锁 + 超时清理；并发 8 写入无丢失 |
| 改名/更新去重 | ✅ | 同名 memory 原地更新，不堆叠 |
| 本地搜索（MVP） | ✅ | name/description/content 子串匹配，无 embedding/外部服务 |
| 保留名保护 | ✅ | 拒绝 `memory`/`index`（避免在大小写不敏感文件系统上覆盖 `MEMORY.md`） |
| 内容安全 | ✅ | 换行归一；索引行转义 `[ ]`（后续补 `{{ }}` 中和，M1 注入时处理） |

测试与演示：
- `node --test tests/memory-store.test.ts` → **9/9 pass**（scope、CRUD、预算、超限、并发、搜索、索引行）；
- `node spike/memory-demo.mjs` → 输出示例索引（357B，3 条记忆）与 `search("p95")` 命中。

```
scope: { source: 'git', repoRoot: '.../demo-repo', dir: '.../memory/scopes/9a49c6b04247fe36' }
--- injected index (bytes=357) ---
# Project memory index
- [Always answer in Chinese](notes/always-answer-in-chinese.md) — 用户偏好中文交流 (2026-10)
- [p95 baseline](notes/p95-baseline.md) — payments-api 的 p95 基线是 240ms（2026-09 采样） (2026-10)
- [API branch policy](notes/api-branch-policy.md) — 所有线程从 main 拉分支，先给方案再开 PR (2026-10)
--- search("p95") --- [ 'p95 baseline' ]
```

## 3. 尚未完成（阻塞在 live DSH 安装）

| 项 | 状态 | 说明 |
|---|---|---|
| Cordis 接线：`ctx.systemPrompt.section` 注入 | ⏳ M1 | 需要 live DSH 验证动态段是否支持异步读取 store |
| `memory_*` 模型工具 | ⏳ M1 | 需要 `ctx.tools` 的 scoped 注册约定 |
| 线程载体 A：`sessionController.create/prompt` | ⏳ 待安装 | 需要在 scratch profile 装最小 Host 插件 |
| 线程内审批可见性 | ⏳ 待安装 | M0 #3 |
| watcher 汇报注入 | ⏳ 待安装 | M0 #6 |
| Remote / Library 写入 | ⏳ 待安装 | M0 #5/#8/#9 |
| 归档/恢复 | ⏳ 待安装 | M0 #10 |

## 4. 下一步（Day 2）

1. 在 `host-memory` 里接 Cordis：`systemPrompt.section` + `memory_*` 工具（先内部 mock，编译通过）；
2. 打一个**最小 demo bundle**（`spike/bundle/`：host-memory + 一个 `spike_thread` 工具）：
   - 工具会 `ctx.sessionController.create({cwd, agentPreset:'standard', sessionId})` + `prompt(...)`，返回 session id；
   - 验证线程创建/冷恢复/停止；
3. 创建 **scratch profile** 安装 demo bundle（需要用户批准），跑 M0 #1–#4、#6、#10；
4. 通过后补 Memory 注入的 live 验证（M0 #11 第 1 条的 live 部分）；
5. 更新本报告与 M0 计划状态。

## 5. 需要用户

1. **批准在 scratch profile 安装 demo bundle**（不碰 desktop profile；测试数据在 `~/.dsh/projects/spike-*`，可清理）；
2. GitHub（可选，先做 M0 也可后传）：确认仓库名/可见性、git 提交身份与版权人。gh 账号为 `ChengliangCao`（显示名 Ignis）；建议：
   - repo: `dsh-projects`，public，default branch `main`
   - git author: `Ignis <125634716+ChengliangCao@users.noreply.github.com>`
   - LICENSE/NOTICE 版权人：`Ignis`（或你指定的名字）

---

## 6. Day 2 追加（2026-10-22 晚）

### 6.1 打通 scratch profile 的 live 运行

发现桌面 app 自带 CLI，可直接管理/启动 profile（无需另装）：

```sh
DSH="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"
"$DSH" --profile projects-spike --from-default-profile headless --dump-config   # 创建 scratch profile
"$DSH" plugin --profile projects-spike add /Users/ignis/workspace/dsh-plugins/spike/bundle-demo
```

- `projects-spike` 由 **headless 模板** 创建；desktop profile 完全未改动。
- 安装后 dump-config 已确认 `spike-demo` 行生效。
- headless 模板缺 credential store：在 `~/.dsh/profiles/projects-spike/cordis.patch.yml` 增加 `@deepseek-ai/dsh-credentials-local`（指向 `~/.dsh/.credentials.yaml`）后，模型请求可正常使用本机凭证。

### 6.2 Live 验证结果（Memory 部分 ✅）

| 验证 | 结果 | 证据 |
|---|---|---|
| 插件在真实 DSH 中激活 | ✅ | 启动日志：`[spike-demo] memory section registered: ...`、`[spike-demo] tools registered (...)` |
| `spike_memory_write` 真实工具调用 | ✅ | 日志 `memory written: .../notes/project-codename.md bytes= 109`；`MEMORY.md` 生成 1 行索引 |
| `spike_memory_search` 真实调用 | ✅ | headless 任务内调用成功（模型最终回复 DONE） |
| **跨会话注入** | ✅ | 新 headless 会话问「项目代号？」→ 模型依据注入的索引回答 **falcon**（reasoning 日志可见它读到了 `[Project codename](notes/project-codename.md)`） |
| 注入预算/空存储 | ✅（单测） | 空存储 0B；强预算下截断且字节数 ≤ 上限 |
| git-repo scope | ✅（单测） | 同 repo 子目录共享 scope；非 git 回退项目目录 |

### 6.3 线程载体 A（待 web 组合）

`spike_spawn_thread` 依赖 `ctx.sessionController`。headless 模板未挂载它；尝试手工补行：

- 补 `workspace` + `session-controller` + `client-file-upload` 后，`session-controller` 仍 `pending (waiting for service: fileUploads)`；
- `client-file-upload` 又需要 `connection`（web carrier）→ headless 组合不可行；
- **结论**：线程 live 验证应使用 **web profile 模板**（含 connection/session-controller/审批 UI），或直接在桌面 GUI 中验证。

已用 **fake sessionController** 对工具逻辑做单测（`spike/bundle-demo/test/plugin.test.mjs`，3/3 pass）：验证 create 参数（cwd/preset/sessionId）、prompt 参数（requestId/sessionId/mode/content）、返回值与会话 ID 透传。live 只剩「在 web 组合里跑一次」。

### 6.4 测试汇总

| 套件 | 结果 |
|---|---|
| `packages/host-memory` 核心 | 9/9 pass |
| `spike/bundle-demo` 插件逻辑 | 3/3 pass |
| `pnpm -r typecheck` | 全绿（5 包） |
| `pnpm -r build` | 全绿 |

### 6.5 下一步（Day 3）

1. 用 **web 模板** 建 `projects-spike-web`，装 spike bundle；
2. 启动 scratch web（不同端口）→ 先验证 `spike_spawn_thread` + 线程冷恢复；
3. 用 GUI 或脚本验证线程内审批、watcher 汇报（#3/#6）；
4. 之后进入 M1：把 spike 逻辑转正到 `host-memory` / `host-project`，并接 `systemPrompt` + `memory_*` 工具（用真实类型）。
