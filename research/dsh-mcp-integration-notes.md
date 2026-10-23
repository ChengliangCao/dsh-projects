# DSH × REA 安装文档 · 事实核验笔记

- 核验人：dsh-mcp-verifier（只读核验；未安装 REA、未运行 `rea setup`、未改 `~/.dsh` / `~/.agents`）
- 核验时间：2026-10-18（Asia/Shanghai）
- 本机：DSH Desktop `0.2.1-rc.2`（asar 内 `dsh/package.json`），Node v24.19.0，npm 11.17.0，macOS 27.0.1
- 观测到的 DSH 环境变量（bash 工具内）：`DSH_HOME=/Users/ignis/.dsh`、`DSH_PROFILE=desktop`、`DSH_PROFILE_DIR=/Users/ignis/.dsh/profiles/desktop`
- 主要证据来源：
  1. `/Applications/DeepSeek Harness.app/Contents/Resources/app.asar/` 内的包 README 与源码（read 工具可直接读 asar 内路径；此外用 Python 解析 asar header 后按 offset 读文件，仅内存读取）。
  2. 已发布的 npm 包 `rea-agents@6.5.0`（`https://registry.npmjs.org/rea-agents/-/rea-agents-6.5.0.tgz`，Lead 解包于 `/tmp/rea/pkg/package`；源码/计划输出均以此为准）。
  3. REA 文档：`/tmp/rea/rea-agents-6.5.0_client-configuration.md.tag`（6.5.0 tag）、`/tmp/rea/client-configuration.md` / `installation.md`（main/6.6.0）、Lead 下载的 DSH 官方 MCP 指南 `/tmp/rea/dsh_mcp_memory.md`。
- 无法实测项（明确标注）：REA 未安装，因此 `mcp__rea__*` 的真实注册/连接、`cordis_inspect_query(Tool).listTools` 是否列出 MCP 工具、HMR 热加载后旧会话的行为，均为“源码/文档推断”，未做 live 验证。

---

## 问题1：home patch 机制（`~/.dsh/cordis.patch.yml` 是否被 Desktop 加载、root `insert` 是否合法、是否全 profile、是否必须重启）

### 结论

1. **会被加载**。DSH 的 profile 合成顺序（从低到高）是：各 bundle 的 patch → `$DSH_HOME/profiles/<name>/cordis.patch.yml`（profile 用户层）→ `$DSH_HOME/cordis.patch.yml`（home 用户层）→ 命令行 `--patch` overlay。home patch 与 profile 名无关，**对每个 profile 都生效**（Desktop 也走同一条 profile-boot 路径）。
2. **root 级 `- insert:` 是合法的**，且是官方模板与随附 bundle 的标准写法：无 `id` 的 insert 直接把行追加到根条目列表；带 `id` 的 insert 只能插入到已存在的 group。home patch 文件是“顶层 YAML 数组”。
3. **desktop profile 默认启用 HMR**（`profileContext` 存在时 `hmr` 行启用），HMR 同时监听 profile patch 与 home patch 两个文件；home patch 变更会触发整棵配置重新组合。因此**“新增 MCP 服务后需要新开 DSH 会话，但不需要重启 Host”**（DSH 官方 MCP 指南原话）；REA 文档写“Restart Harness after setup”是保守说法，不是硬性要求（若 HMR 行被禁用/启动方式无 profileContext 才需重启）。
4. **风险点**：home patch **不存在 = 合法（无该层）**；但**“存在但为空/只有注释”**会让 DSH 启动失败（应写 `[]` 表示禁用该层）。需要时让 setup 创建，别手工 `touch`。

### 证据

- 层序（源码）：`.../dsh-app-boot/lib/index.js:1127-1133`
  ```js
  function readProfilePatches(binName, context, initialProfile) {
    const patches = structuredClone([
      ...readBundlePatches(binName, context, initialProfile),
      ...initialProfile?.patches ?? loadOptionalPatches(binName, context.patchPath) ?? [],
      ...loadOptionalPatches(binName, join(context.home, "cordis.patch.yml")) ?? [],
      ...context.overlays
    ]);
  ```
- 层序（文档）：`.../dsh/README.md:41-44`：“The tree composes over an empty root: - each bundle's patch … - then the profile's `cordis.patch.yml`, then the home-level `$DSH_HOME/cordis.patch.yml` - then `--patch` overlays”；`.../dsh-app-boot/README.md:61`：“your tweak layer, applied after every bundle layer (per-profile first, then the home-level file, which therefore outranks it)… an empty or comments-only file fails boot — disable the layer with `[]` instead.”
- Desktop 走 profile-boot：`.../dsh-desktop-host/lib/index.js:219-250`（`runProfile({ profile: "desktop", resolvedProfile: {…}, environment: loadLayeredEnv("dsh") })`）；`.../dsh/README.md:60`（“profile-boot export provides the shared profile lifecycle to the Desktop host … retaining the Harness home patch … patch reload”）。
- home patch 路径：`.../dsh/lib/profile-boot-C14i-8IN.js:110-115`（`homePatchPath()`）；Electron 主进程 `app.asar/lib/main.js:79-84`（`profile: join(dshHome, "profiles", "desktop")`）；home 解析优先级 `$DSH_HOME` 再 `~/.dsh` 见 `dsh-home-paths/README.md:34-39`。
- **root insert 合法**：`.../dsh-app-boot/lib/index.js:72-89`（`applyEntryPatches`）：`if (insert) { if (id) {…group…} else data.push(...insert); buildMap(insert); continue; }`；官方 MCP 模板 `.../dsh-agent-preset/skills/cordis-plugin-development/templates/mcp/cordis.patch.yml:1-8` 与 `.../dsh-base/cordis.patch.yml:15` 都是 root 级 `- insert:`。
- patch 文件格式：`.../dsh-app-boot/lib/index.js:3993-4004`（`parsePatchList`）：非数组直接抛错 `"must be a top-level YAML array of loader patch entries"`；文件缺失返回 `undefined`（`:3942-3951`，ENOENT = 无该层）。
- HMR 与 profileContext：`.../dsh-base/cordis.patch.yml:27-32`（`id: hmr`，`disabled: !!js "!ctx.get('profileContext')"`，`config: root: []`）；`.../dsh/lib/profile-boot-C14i-8IN.js:290-304`（创建 `profileContext` 并 `hostCtx.provide("profileContext", profileContext)`）；`.../dsh-hmr/README.md:27`（“base bundle enables HMR with `root: []` when the launcher supplies `profileContext`”）；`.../dsh-hmr/lib/index.js:830,850,872`（`profile = ownerContext.get("profileContext")`，`patchFiles = [profile.patchPath, join(profile.home, PROFILE_PATCH_FILENAME)]`，逐个 `watchConfig`）。
- 监听细节：`.../dsh-hmr/README.md:47`（配置监听“also observe additions, removals and initially missing parent directories”，默认 `awaitWriteFinish: true`，约 2 秒写入稳定窗口）。
- DSH 官方 MCP 指南（Lead 下载）`/tmp/rea/dsh_mcp_memory.md:82`：“A new DSH session is required; a Host restart is not.”

### 对文档的建议写法

- 明确写：home patch 与 profile patch 的层序、home patch 对所有 profile 生效；root 级 `- insert:` 合法。
- 写清“缺失 vs 空文件”的区别：`~/.dsh/cordis.patch.yml` 不存在没问题；**不要创建空文件**；想临时禁用整层写 `[]`。
- 生效方式：优先“新开 DSH 会话”；“完全退出并重开 DSH”作为兜底，而不是硬性步骤。可说明 Desktop 默认开 HMR，home patch 变更通常会被自动重载（有约 2 秒写入稳定延迟）。

---

## 问题2：mcp-client 作为 home patch 里的裸 entry 是否允许；id 唯一性；重名 serverName；`failOnStartupError` 建议值

### 结论

1. **允许**。home patch 的 `insert` 行就是普通 Loader entry；官方 MCP 模板与 `@deepseek-ai/dsh-mcp-client` README 的最小配置都是裸 entry（不是 bundle 包）。唯一要求是 `name` 用包名、`config` 里有 `serverName`/`transport`。
2. **id 唯一性**：Loader 用 `id` 作为稳定身份（解析/更新/删除）；REA 固定写 `id: rea-mcp` 并按 id 替换，因此正常流程不会出现重复。**未在 loader/app-boot 源码中发现“重复 id”显式校验**（无法核验重复 id 的精确后果）；文档应避免让用户手工再写一条同 id 行。
3. **重名 serverName**：mcp-client 在注册作用域内保留 `serverName`；**两个 entry 用同一个 serverName 时，后加载的那个会以明确错误失败**（前一个照常工作）。`serverName` 还会决定工具前缀 `mcp__rea__*`。
4. **`failOnStartupError` 建议保持默认 `false`（REA 根本不写这个字段）**：默认 false 时 MCP 连接失败不会拖垮 DSH 启动，只是该 server 的工具不出现并记日志；设 true 会让插件激活失败（虽然 app-boot 仍把可选 MCP entry 视为可选，不会终止整个 harness）。

### 证据

- 裸 entry：`.../dsh-agent-preset/skills/cordis-plugin-development/templates/mcp/cordis.patch.yml:1-8`；`.../dsh-agent-preset/skills/cordis-plugin-development/references/mcp-bundle.md:3-5`（“inserts the already installed `@deepseek-ai/dsh-mcp-client` with `serverName`, `transport…`”）。
- entry 字段：`.../dsh-mcp-client/README.md:30-53`（最小配置：`id`、`name`、`config.serverName`、`transport`、`command/args`）。
- id 语义：`.../cordis-plugin-loader/README.md:29`（“`id` | Stable id for resolving, updating, and removing the entry.”）；patch 语义见 `.../dsh-app-boot/lib/index.js:3044`（schema 描述“An insert appends entries, optionally inside the group identified by id. Other patches replace supplied fields…”）。
- serverName 唯一：`.../dsh-mcp-client/README.md:58`（“`[A-Za-z0-9_-]{1,32}`, unique inside one registration scope”）与 `:78`（“Two entries using the same server name: the later one fails to load with a clear error.”）。
- failOnStartupError：`.../dsh-mcp-client/README.md:63`（默认 `false`）与 `:71`（“If the initial connection fails, the harness still starts but no tools from that server appear, and an error is logged. Setting `failOnStartupError: true` rejects plugin activation; app-boot's startup policy still permits an optional MCP entry to fail without aborting the harness.”）。
- REA 只写固定字段：`.../rea/pkg/package/dist/application/DshCordisPatch.js:379-392`（`dshClientRegistrationEntry` 只生成 `serverName: "rea"`、`transport: "stdio"`、`command`、`args`、可选 `env`；不写 `failOnStartupError`）。

### 对文档的建议写法

- 不要建议用户加 `failOnStartupError: true`；保持默认（REA 也不写）。排错时以“工具不出现 + 日志有 MCP 连接错误”描述，而不是“failOnStartupError 类错误”。
- 提醒：不要手工再插一条 `serverName: rea` 的 entry；同一 serverName 第二次会加载失败。
- 如需临时禁用，`disabled: true` 可放在被插入的 entry 行上；但 REA setup 会重写/删除该字段（`DshCordisPatch.js:279` 删除 `disabled`），doctor 也会把 disabled 视为未就绪，所以只能是临时手段。

---

## 问题3：技能发现（`$DSH_AGENTS_HOME/skills` 默认 `~/.agents/skills`）

### 结论

1. **会从 `<agentsHome>/skills` 发现**（默认 `~/.agents/skills`，可用 `$DSH_AGENTS_HOME` 覆盖；空/空白视为未设置）。另外也会扫 `<dshHome>/skills`（默认 `~/.dsh/skills`，跳过 `.system`）、项目内 `<projectRoot>/.dsh/skills`、`<projectRoot>/.agents/skills`；优先级见下方表。
2. **默认配置**：`agentsHome` = `$DSH_AGENTS_HOME` 或 `~/.agents`；`dshHome` = `$DSH_HOME` 或 `~/.dsh`；`includeDefaultRoots: true`；`watch: true`。**在 Desktop 里由 agent preset（standard）挂载** `dsh-skill-filesystem` + `dsh-tool-skill`（web-app 把 base 根层的这两个行禁用了，交给 preset）。
3. **目录结构**：`<root>/<name>/SKILL.md`（目录 bundle）或 `<root>/<name>.md`（扁平文件）；**只扫一层**，嵌套 `**/SKILL.md` 不发现。`SKILL.md` 需要 YAML frontmatter：`name`（kebab-case）+ `description` 必填；可选 `whenToUse`/`metadata`/`disable-model-invocation`/`user-invocable`。`references/` 等子目录是资源（不参与技能发现，但会被 skill 工具以 base dir 指向）。
4. **通常不需要重启**：provider 会 watch 这些根目录，新增/改名/删除技能会刷新 catalog，下一个模型步骤可见；首次不存在但之后创建的根也会被探测到。**但 MCP 注册的生效仍取决于 HMR/重启（另一件事）。**

### 证据

- 根目录与 rank 表：`.../dsh-skill-filesystem/README.md:44-56`（project-dsh 100、project-agents 200、custom 300、user-dsh 400 `<dshHome>/skills`、user-agents 500 `<agentsHome>/skills`；`bundledSkillDir` 600）；默认值表 `:67-76`；格式 `:36`；watch/无需重启 `:12,28,81`；单层发现限制 `:147-150`。
- `agentsHome` 解析：`.../dsh-home-paths/README.md:43-52`（`$DSH_AGENTS_HOME`，空/空白忽略，否则 `~/.agents`）。
- Desktop 的挂载方式：`.../dsh-base/cordis.patch.yml:308-315`（skill/skill-filesystem/tool-skill 行）；`.../dsh-web-app/cordis.patch.yml:505-517`（“The `skill` REGISTRY stays in the host plane. … the base host `skill-filesystem` row is disabled here (presets own local discovery), and `tool-skill` is what a preset mounts…”）；`.../dsh-web-app/presets/standard.patch.yml:37-40`（`skill-filesystem`、`tool-skill`）。
- 模型侧的加载：`.../dsh-tool-skill/README.md:52-57`（catalog + `skill` 工具；`<available_skills>` 模板 `:114-129`；资源 base dir `:180-185`）。
- REA 技能 frontmatter 合规：`/tmp/rea/SKILL.md:1-7`（`name: reverse-engineer-anything`、`description`、`metadata.version`）。

### 对文档的建议写法

- 写清“技能 ≠ MCP 工具”：装技能不会产生 `mcp__rea__*`；只装技能用 `rea setup --skill`（不要带 `--client`）。
- 技能生效通常无需重启；“下一个模型步骤/新会话即可加载”是准确表述。
- 如需确认，可让智能体在会话里直接 `skill` 工具加载 `reverse-engineer-anything`。

---

## 问题4：安装后如何确认 `mcp__rea__*` 已注册；`Tool.listTools` 能否看到；HMR 是否自动重载

### 结论

1. **最可靠的人类验证**：在 DSH 新会话里让智能体调用一个 REA 工具（推荐空参 `mcp__rea__binary_session`）或列出 `mcp__rea__` 前缀工具；REA 官方文档也说以实际 `tools/list` 为准。
2. **`cordis_inspect_query(platform=host, provider=Tool, method=listTools)` 预期能看到 MCP 工具**：该 Inspect Provider 的描述是“Tools visible to the requesting Agent, including scoped and dynamic registrations.”；本机实测它返回当前会话全部 40+ 工具（含动态注册的 team/schedule 工具）。MCP client 通过 `ctx.tools.register` 把桥接工具注册进同一 registry，工具名 `mcp__<serverName>__<rawName>`。**但本机未安装 REA，未实测 `mcp__rea__*` 出现在该结果中**（推断，非 live 验证）。
3. **HMR 会监听 home patch 并重新组合**，所以运行中的 Desktop 通常不需要重启 Host；但 DSH 官方 MCP 指南要求**新开一个会话**（“A new DSH session is required; a Host restart is not.”），因为工具目录/会话上下文按会话建立。若 HMR 未启用（或 home patch 在启动前不存在等边界），重启 DSH 是兜底。
4. `rea doctor --client dsh --json` 只检查文件/前置条件，**不能证明当前会话已连上 MCP**（REA 文档原话：“doctor checks files and prerequisites, not the live agent connection”）。

### 证据

- Inspect 工具：本机 `cordis_inspect_list` 返回的 `Tool` provider 描述（“Tools visible to the requesting Agent, including scoped and dynamic registrations.”）；`cordis_inspect_query Tool.listTools` 实测返回工具清单。
- 工具注册/命名：`.../dsh-mcp-client/README.md:32`（“After the harness starts, the server's tools appear in the model's tool list.”）、`:71`、`:75`（`mcp__<serverName>__<rawName>`）、`:163`（“SDK-admitted MCP tools appear as native tools named …”）。
- HMR：见问题1证据（`dsh-hmr/lib/index.js:850,872`；`dsh-hmr/README.md:27,47`；`dsh/README.md:37`）；DSH 官方 MCP 指南 `/tmp/rea/dsh_mcp_memory.md:82`（“A new DSH session is required; a Host restart is not.”）。
- doctor 只读文件：`/tmp/rea/installation.md:367-368`（“`rea doctor --json` is strictly read-only”）、`:453-454`（“doctor checks files and prerequisites, not the live agent connection”）。

### 对文档的建议写法

- 验证顺序建议：① `rea doctor --client dsh --json` 看注册条目字段；② 新开 DSH 会话，让智能体调用 `mcp__rea__binary_session {}`；③ 或让智能体列出 `mcp__rea__` 工具。可以补充：若用户愿意，也可让智能体用 `cordis_inspect_query` 的 `Tool.listTools` 自查（DSH 内置 inspect 工具）。
- 明确“doctor 通过 ≠ 会话已连上 MCP”。

---

## 问题5：macOS 细节（node 路径、全局启动器、doctor、uninstall、setup 时 DSH 是否需退出）

### 结论

1. **6.5.0 实际写入的启动命令取决于“用什么方式运行 setup”**（`setupRegistrationCommand`）：
   - 通过 `npx`/`bunx` 运行 setup（`npm_command=exec`）→ 写 **pinned package-runner** 命令：macOS/Linux `command: npx`, `args: ["-y", "rea-agents@6.5.0", "mcp"]`；Windows 包 `cmd.exe /d /c npx -y …`。
   - 直接运行已安装的 CLI（全局安装后的 `rea setup`）→ 非 Windows：`command: <resolve(process.argv[1]) 的绝对路径，即 scripts/rea.mjs>`, `args: ["mcp"]`；Windows：`command: <node.exe 绝对路径>`, `args: ["<rea.mjs 绝对路径>", "mcp"]`。
   - **不是**所有平台都写 `command: node 绝对路径 + args [rea.mjs, mcp]`：那是 Windows 直装形态，也是 REA main/6.6.0 文档的通用示例写法；macOS 6.5.0 全局安装写的是 rea.mjs 绝对路径本身（脚本首行有 `#!/usr/bin/env node`）。
2. **PATH 要求**：npx 形态要求 DSH 子进程能解析 `npx`（进而 node）；全局/macOS 脚本形态要求能通过 shebang `#!/usr/bin/env node` 解析 node。**macOS 上 DSH Desktop 会读取登录 shell（`-ilc`）环境并覆盖到 Host 进程**，所以从 Finder 启动时 PATH 通常也包含 `/usr/local/bin` 等；但若登录 shell 探测失败/超时（`DSH_DESKTOP_LOGIN_SHELL_TIMEOUT_MS` 默认 10s）或 PATH 只配在非登录/非交互文件里，仍可能找不到。为最稳，可全局安装（绝对启动器）或从终端启动 DSH。
3. **全局安装启动器路径**：npm 的 `bin` 映射是 `rea`/`rea-agents` → `scripts/rea.mjs`（6.5.0 `package.json`），REA 文档写“For a global npm installation, the launcher is under `$(npm root -g)/rea-agents/scripts/rea.mjs`”。本机 `npm root -g = /usr/local/lib/node_modules`。**无法完全核验**：macOS 上全局 bin 是符号链接，`process.argv[1]` 究竟是链接路径还是真实路径取决于内核/Node 行为；以 `rea setup --dry-run` 计划里打印的 `Command: …` 为准（6.5.0 计划确实会打印 Command，见 `SetupPlan.js:224-237`）。
4. **`rea doctor --client dsh`**：检查 home patch 里的同一个 entry id（REA 6.5.0 DSH 文档原话）；doctor 只读，JSON 里包含 registrations 的 `command`/`args` 等字段。
5. **`rea uninstall` 没有 `--client` 参数**（6.5.0 CLI 选项只有 `--purge-data`）；它扫描所有受支持客户端，移除 REA 自己的注册（含 home patch 的 `rea-mcp`）和 REA 安装的技能文件；`--purge-data` 额外清 `~/.rea`。
6. **DSH Desktop 运行中 setup 是否需要先退出**：REA 文档只对 Claude Desktop 要求“完全退出”；对 DSH 没有此要求，且 DSH 默认 HMR 会监听到 home patch 变化。**建议（非硬性）先退出 DSH**：避免 REA 原子写 + readback 期间与 DSH 自身的设置写入/HMR 重载互相踩；而且 setup 完成后不论如何都建议新开会话/重启。
7. 版本事实：npm `dist-tags.latest = 6.5.0`（6.6.0 未发到 npm，GitHub 有 6.6.0 release/tag）；`--client dsh` 需要 ≥ 6.5.0；6.5.0 `engines.node = ^22.19.0 || ^24.11.0 || >=26.0.0`，本机 v24.19.0 合规。

### 证据

- `.../rea/pkg/package/dist/application/SetupHost.js:19-30`：`setupRegistrationCommand`（packageRunner → `packageRunnerRegistrationCommand`；否则 win32 `[process.execPath, entrypointPath, "mcp"]`，非 win32 `[entrypointPath, "mcp"]`）；`:32-45` `setupRegistration`。
- `.../rea/pkg/package/dist/process/CurrentEntrypointPath.js`：`CURRENT_ENTRYPOINT_PATH = normalizeEntrypointPath(process.argv[1])`，`normalizeEntrypointPath = resolve(entrypoint)`。
- `.../rea/pkg/package/dist/application/ClientRegistrationIdentity.js:25-33`：npx 形态 `["npx","-y", registrationPackageSpecifier, "mcp"]`（Windows 前插 `cmd.exe /d /c`）；`registrationPackageSpecifier = rea-agents@<version>`（`dist/identity.js:8-12`）。
- `.../rea/pkg/package/dist/application/DshCordisPatch.js:379-392`：entry = `{ serverName: "rea", transport: "stdio", command: command[0], args: rest, env? }`。
- `.../rea/pkg/package/scripts/rea.mjs:1`（`#!/usr/bin/env node`）；`package.json` 的 `bin` 映射与 `engines`。
- 登录 shell 环境注入：`app.asar/lib/main.js:9259-9335`（`readShell(shell, ["-ilc", DUMP])`、`mergeLoginShellEnvironment`，跳过 `DSH_*`/`ELECTRON_*` 与 probe 变量）；`:12057-12064`（`hostEnvironment = await loginShell`）；`:12183-12184`（Host 子进程使用 `hostEnvironment`）；`:3650-3658`（`desktopNodeEnvironment`，提供 `DSH_DESKTOP_NODE_EXECUTABLE` 与私有 PATH 前缀，仅 package operations）。
- `.../rea/pkg/package/dist/application/SupportedClients.js:441-450`：dsh 定义 `configPath: dshPatchDirectory`（= `$DSH_HOME/cordis.patch.yml`）、`skillPath: $DSH_AGENTS_HOME/skills`。
- `.../rea/pkg/package/dist/cli/setupCommands.js:31-67`（setup 选项：`--yes`、`--install-hopper`、`--client`、`--skill-client`、`--all-detected`、`--skill`、`--dry-run`、`--accessible`）；`:93-99`（uninstall 仅有 `--purge-data`）。
- `.../rea/pkg/package/dist/application/SetupPlan.js:224-237`：计划 detail 里含 `Command: "npx" "-y" "rea-agents@6.5.0" "mcp"` 形式的内容（可据此核对实际写入命令）。
- `.../rea/pkg/package/dist/application/ClientRegistrationStatus.js:17-18`：doctor 的 registration 含 `command`/`args`。
- REA 6.5.0 DSH 文档：`/tmp/rea/rea-agents-6.5.0_client-configuration.md.tag:313-354`；main 文档 `/tmp/rea/client-configuration.md:364-412`；`/tmp/rea/installation.md:367-382,440-454,502-503`。
- npm registry（2026-10-18 实测）：`dist-tags.latest = 6.5.0`；versions 列表尾为 `… 6.4.0, 6.5.0`，无 6.6.0。

### 对文档的建议写法

- 不要给死一种 entry 形态：说明“**看 `rea setup --dry-run --json` 计划里打印的 Command**，或 `rea doctor --client dsh --json` 里的 `command`/`args`”；若举例，分别给 npx 形态与全局安装形态，并注明 Windows 直装才是 node+[rea.mjs, mcp]。
- 全局安装那条写“`command` 指向 `$(npm root -g)/rea-agents/scripts/rea.mjs`（实际以计划为准）”，避免断言 node 绝对路径。
- setup 前“建议退出 DSH Desktop（非必须）”；完成后新开 DSH 会话，没有再完全重启。
- `rea uninstall` 明确无 `--client`，用 `--purge-data` 才删 `~/.rea`。

---

## 文档复核：`docs/rea-dsh-install.md`（只读复核，未编辑）

### 必须修改项（事实错误/可能误导）

1. **第 9 节排错表（第 425 行）**：“DSH 从 Finder 启动后找不到 npx | GUI 应用的 PATH 不含 `/usr/local/bin`”。
   - 问题：与 DSH Desktop 实际行为不符/过时。Desktop 在 macOS 用登录 shell（`-ilc`）读取环境并覆盖 Host 环境（`main.js:9259-9335,12057-12064,12183-12184`），PATH 通常包含常见用户路径。
   - 建议改为：“极少数情况下（登录 shell 探测失败/超时，或 PATH 只写在非登录 shell 配置里）DSH 子进程可能解析不到 `npx`；可改用全局安装（绝对启动器）或从终端启动 DSH。一般无需处理。”
2. **第 4.5 节（第 232-236 行）**：把“引擎路径传不进子进程”归因于环境清洗。
   - 问题：清洗规则只剔除名字匹配 `/KEY|PASSWORD|SECRET|TOKEN/i` 和 `DSH_*` 的变量；`GHIDRA_INSTALL_DIR`、`JAVA_HOME`、`HOPPER_LAUNCHER_PATH` **不在清洗范围内**。真正原因是“DSH 进程本身的环境是否来自登录 shell / 是否与终端 export 同步”。
   - 建议改为：“清洗只影响凭据类与 `DSH_*`；引擎路径不受清洗，但不要依赖临时终端 export——REA setup 会把检测到的 `GHIDRA_INSTALL_DIR`/`JAVA_HOME`/`HOPPER_LAUNCHER_PATH` 写入注册条目的 `config.env`，重跑 setup 即可更新；也可手动补在 `config.env`。”（已核验 6.5.0：`GhidraDoctor.js:14-20` 发布 `GHIDRA_INSTALL_DIR`/`JAVA_HOME`；`SetupRegistrationEnvironment.js` + `SetupHost.js` 写进 registration env。）
3. **FAQ（第 486 行）**：“`rea setup --client dsh --skill` 只刷技能”。
   - 错误：带 `--client dsh` 仍会规划/刷新 MCP 注册。只刷技能应**不带 `--client`**：`npx rea-agents@latest setup --skill --yes`（目标为共享 `~/.agents/skills`），或 `--skill-client dsh`（已有客户端技能目标）。
   - 依据：`setupCommands.js:31-67` 选项与 `Setup.js:95-175` 的 scope 逻辑；6.5.0 文档 `client-configuration.md.tag:350-354` 只演示 `setup --skill --dry-run` / `--skill --yes`。
4. **第 9 节（第 426 行）**：“MCP 报 `failOnStartupError` 类错误”。
   - 问题：REA 不写 `failOnStartupError`，默认 false，DSH 不会因 MCP 启动失败而报“failOnStartupError”这个用户可见错误；表现是工具不出现 + 日志错误。
   - 建议改为：“MCP 启动失败：DSH 仍能启动，但 `mcp__rea__*` 不出现，DSH 日志/终端有连接错误；核对 command+args 能否手动执行。”
5. **第 4.1 节（第 186 行）**：“全局安装时是 `rea.mjs` 的绝对路径 + `mcp`，有的版本会写成 `node` + `[rea.mjs, mcp]`；Windows 上会包一层 `cmd.exe /d /c`”。
   - 问题：不够精确；“有的版本”应按平台/调用方式说明。6.5.0 实测源码：npx 形态 → `command: npx`, `args: ["-y","rea-agents@6.5.0","mcp"]`；macOS/Linux 全局 → `command: <rea.mjs 绝对路径>`, `args: ["mcp"]`；Windows 全局 → `command: <node 绝对路径>`, `args: ["<rea.mjs>", "mcp"]`；`cmd.exe /d /c` 只出现在 npx/bunx 形态的 Windows 上。
   - 建议改为上述分平台表述，并加“以 `rea setup --dry-run --json` 计划里的 `Command` 为准（6.5.0 会打印）”。
6. **第 7 节（第 382 行）与 FAQ（第 488-489 行）**：“注册里的版本被 pin，升级后必须重跑 setup 才更新；注册里有一串版本号”。
   - 问题：只对 **npx/bunx 形态**成立（`args: ["-y","rea-agents@<ver>","mcp"]`）；全局安装形态注册的是**启动器绝对路径**，条目里没有版本号，`rea update` 更新的是该路径下的包文件。建议把“版本号”说法限定为 npx 形态，全局形态仍建议重跑 setup/doctor 对齐。
7. **第 2.2 节（第 89 行）**：“备份：改动前会保留 `.rea.backup` 备份”。
   - 问题：首次创建 home patch（文件不存在）时没有旧文件可备份；`.rea.backup` 是“编辑已有配置时”的快照。建议加“已有配置文件时”。
8. **第 9 节（第 419 行）**：“恢复备份或删掉这个空文件让 REA 重新创建”。
   - 补充：空/仅注释的 patch 文件不仅让 DSH 启动失败，**REA setup 自己也会拒绝编辑**（源码 `DshCordisDocument` 要求顶层为序列，空文件解析为 null → 抛错）。正确顺序是：删除/修复空文件 → 再跑 setup。另可提示“只想禁该层写 `[]`”。

### 可选优化项

1. 第 1 节第 45 行“REA 包约 25 MB（解压后）”：实测 `du -sh /tmp/rea/pkg/package` = 28M，可写“约 30 MB”。
2. 第 4.2 节第 192 行技能优先级：补一句 `~/.dsh/skills`（user-dsh，rank 400）也在 `~/.agents/skills`（rank 500）之前；README 表见 `dsh-skill-filesystem/README.md:44-56`。
3. 第 2.3 节第 112 行“patch 文件是安装后才新建的”作为未生效原因：HMR 的配置监听会观察新增文件（`dsh-hmr/README.md:47`），单纯“新建”不是原因；更可能原因是 HMR 被禁用/启动方式无 profileContext。
4. 第 2.2 节第 79 行有双反引号笔误：``npx`` 会先下载 → `npx` 会先下载。
5. 第 9 节第 418 行“看 DSH 启动日志”：未核验 Desktop 日志具体路径；可改为“DSH 日志/终端输出，或 `rea doctor --client dsh --json` 的 registration 状态”。（本机未确认日志文件位置，属“无法核验”。）
6. 第 4.4 节手动注册示例：可补一句“手工 `command: npx` 的条目要求 DSH 子进程能解析 `npx`；想最稳可直接写 `command: <node 绝对路径>` + `args: [<rea.mjs>, "mcp"]`（macOS 也可直接写 rea.mjs 绝对路径）”。
7. FAQ 第 491-492 行“临时禁用可加 `disabled: true`”：补充“REA setup 重写注册时会删除 `disabled`（`DshCordisPatch.js:279`），doctor 也会视为未就绪；只能临时用”。
8. 第 10 节“REA 自己的代码是 MIT”已核验（`package/LICENSE` MIT License, Copyright 2026 morluto）。
9. 第 12 节 DSH 链接：`apps/cli/README.md` 在默认分支 `master` 上存在且内容即 `@deepseek-ai/dsh` README（profile 顺序/home patch/HMR 都在其中），链接可用；其余 DSH 链接 `docs/user/guide/mcp-memory.md`、`packages/mcp/mcp-client/README.md`、`packages/skill/skill-filesystem/README.md` 在 `master` 分支实测 200。（仓库默认分支是 `master`，不是 `main`。）
10. 第 2.2 节可补 `--skill-client dsh` 这个更精确的“只刷新该客户端技能目标”的选项（6.5.0 支持）。

---

## 纠错清单（对任务背景事实的修正/精确化）

1. **“entry 形如 `command: /absolute/path/to/node` + `args: [rea.mjs, mcp]`”不精确**。这是 REA 文档的通用/Windows 直装示例；6.5.0 在 macOS 上实际写入：
   - `npx rea-agents@latest setup --client dsh`（package-runner 启动）→ `command: npx`, `args: ["-y", "rea-agents@6.5.0", "mcp"]`；
   - 全局安装后 `rea setup --client dsh`（直接启动）→ `command: <scripts/rea.mjs 的绝对路径>`, `args: ["mcp"]`（macOS/Linux）；Windows 才是 `command: <node.exe 绝对路径>`, `args: ["<rea.mjs>", "mcp"]`。
   - 结论：文档/背景引用“node+[rea.mjs,mcp]”时务必说明“以 setup 计划 `Command:` 为准”，或标注平台/版本差异。
2. **“安装后必须重启 DSH 才生效”不准确**。Desktop 默认 HMR（`hmr` 行在 `profileContext` 存在时启用）监听 profile patch 与 home patch；DSH 官方 MCP 指南只说“需要新会话，不需要重启 Host”。重启是兜底（HMR 禁用/异常时）。
3. **“home patch 路径默认 `~/.dsh/cordis.patch.yml`”正确**（`$DSH_HOME` 为空/空白按未设置处理；相对值按 cwd 解析）。
4. **“root 级 `- insert:` 合法”正确**（`applyEntryPatches` 无 id 的 insert 追加到根；带 id 的 insert 只允许进 group）。
5. **“home patch 对所有 profile 生效”正确**（层序源码；REA 6.5.0 文档亦同）。
6. **“mcp-client README 的 `failOnStartupError` 默认 false”正确；但 REA 完全不写该字段**，不要写成“REA 设置了 failOnStartupError”。
7. **“stdio 会清洗含 `KEY|PASSWORD|SECRET|TOKEN` 及 `DSH_*` 的环境变量”正确**（`dsh-mcp-client/README.md:135-137`；注意是子串匹配，非仅后缀）。
8. **“`~/.agents/skills` 不存在”正确**（本机不存在，`~/.dsh/skills` 也不存在）；DSH 会从 `$DSH_AGENTS_HOME/skills`（默认 `~/.agents/skills`）发现技能，且通常无需重启。
9. **“`rea doctor --client dsh` / `rea uninstall`（无 `--client`）”正确**（6.5.0 CLI 实测源码：uninstall 只有 `--purge-data`；doctor 检查 home patch entry）。
10. **“DSH 从 Finder 启动 PATH 不含 `/usr/local/bin`”这一常见说法在本机 DSH 上不成立**：Desktop 会读取登录 shell 环境并注入 Host（`main.js:9259-9335` 等），一般能找到 `/usr/local/bin`；只有探测失败/超时或 PATH 配在非登录 shell 文件时才可能缺失。
11. **REA 文档版本差异**：npm `latest = 6.5.0`（6.6.0 仅有 GitHub release/tag，未发 npm）。6.5.0 文档中的 DSH 示例与 6.5.0 源码实际输出存在差异（示例写 node+[rea.mjs,mcp]，源码 macOS 直装写 rea.mjs 绝对路径）；引用示例时以“setup 计划”与“实测”为准。
12. **新增 MCP 条目的层位置**：home patch 的 root insert 行生效于所有 profile；如果只想限某个 profile，可把同样的 root insert 放进 `$DSH_HOME/profiles/<name>/cordis.patch.yml`（但 REA 的 setup/doctor/uninstall 只维护 home patch）。
13. **`rea setup --client dsh --skill` 不是“只装技能”**：带 `--client` 仍会规划 MCP 注册；只装技能请用 `setup --skill`（无 `--client`）或 `setup --skill-client dsh`。

---

## 无法核验项（未安装 REA，只读环境限制）

1. `mcp__rea__*` 是否真的出现在运行中的 DSH 会话、`cordis_inspect_query(Tool).listTools` 是否列出 MCP 工具：源码/文档推断为“会”，未 live 验证。
2. `cordis_inspect_query` 的 MCP 工具可见性在“HMR 热加载后旧会话”中的具体表现（是否必须新会话）：DSH 官方指南说新会话，本地未实测。
3. 全局安装（macOS）时 `process.argv[1]` 经 npm bin 符号链接后的确切值（决定 entry 里写的是 `scripts/rea.mjs` 还是 `bin/rea` 符号链接路径）：未安装，无法实测；以 setup 计划 `Command:` 为准。
4. 重复 `id: rea-mcp` 行在 Loader 中的精确后果：loader/app-boot 源码未发现显式重复 id 校验，未实测（正常 REA setup 不会产生重复，不建议手写）。
5. DSH Desktop 的日志文件具体路径（Windows/macOS 各自位置）：未核验。
6. 6.5.0 文档示例与 6.5.0 源码在 macOS 直装形态上的差异属于“文档未按平台细化”；无法进一步确认是文档 bug 还是版本内改动，按“以计划为准”处理。

---

## 附：本次核验用到的关键文件/行号速查

| 主题 | 路径（asar 内以 `app.asar/` 为根） | 行 |
|---|---|---|
| profile/home patch 层序 | `dsh/node_modules/@deepseek-ai/dsh-app-boot/lib/index.js` | 1127-1133 |
| patch 应用（root insert） | 同上 | 61-110；3044 |
| 空/缺失 patch 文件 | 同上 | 3942-3951；3993-4004 |
| 组合顺序文档 | `dsh/node_modules/@deepseek-ai/dsh/README.md` | 41-44 |
| home patch 语义/空文件失败 | `dsh/node_modules/@deepseek-ai/dsh-app-boot/README.md` | 61 |
| home patch 路径 | `dsh/node_modules/@deepseek-ai/dsh/lib/profile-boot-C14i-8IN.js` | 110-115 |
| profileContext 注入 | 同上 | 290-304 |
| HMR 启用 | `dsh/node_modules/@deepseek-ai/dsh-base/cordis.patch.yml` | 27-32 |
| HMR 监听两个 user patch | `dsh/node_modules/@deepseek-ai/dsh-hmr/lib/index.js` | 830,850,872 |
| HMR 行为/写入稳定窗口 | `dsh/node_modules/@deepseek-ai/dsh-hmr/README.md` | 27,47 |
| mcp-client 配置/命名/清洗 | `dsh/node_modules/@deepseek-ai/dsh-mcp-client/README.md` | 30-79；135-137 |
| MCP bundle 模板 | `dsh/node_modules/@deepseek-ai/dsh-agent-preset/skills/cordis-plugin-development/templates/mcp/cordis.patch.yml` | 1-8 |
| skill 根目录/格式/watch | `dsh/node_modules/@deepseek-ai/dsh-skill-filesystem/README.md` | 36,44-56,67-76,81 |
| Desktop 挂载 skill | `dsh/node_modules/@deepseek-ai/dsh-web-app/presets/standard.patch.yml` | 37-40 |
| Desktop 启动登录 shell 环境 | `app.asar/lib/main.js` | 9259-9335；12057-12064；12183-12184 |
| Desktop profile 路径 | `app.asar/lib/main.js` | 79-84 |
| REA 启动命令选择 | `/tmp/rea/pkg/package/dist/application/SetupHost.js` | 19-45 |
| REA entry 构造 | `/tmp/rea/pkg/package/dist/application/DshCordisPatch.js` | 6-8；195-271；379-392 |
| REA dsh 路径/技能路径 | `/tmp/rea/pkg/package/dist/application/SupportedClients.js` | 60-72；441-450 |
| REA 计划打印 Command | `/tmp/rea/pkg/package/dist/application/SetupPlan.js` | 224-237 |
| REA setup/uninstall CLI | `/tmp/rea/pkg/package/dist/cli/setupCommands.js` | 31-67；93-99 |
| REA 6.5.0 DSH 文档 | `/tmp/rea/rea-agents-6.5.0_client-configuration.md.tag` | 313-354 |
| DSH 官方 MCP 指南（新会话） | `/tmp/rea/dsh_mcp_memory.md` | 33,82 |
