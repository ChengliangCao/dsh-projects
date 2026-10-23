# 在 DeepSeek Harness（DSH）中安装 REA

> 目标读者：已经装好 **DSH Desktop**（macOS，profile 名为 `desktop`），想给 DSH 里的智能体加上 **REA**（[morluto/rea](https://github.com/morluto/rea)，一套逆向工程 MCP 工具）的普通用户。
>
> 本文只讲 **REA × DSH 的安装、验证、更新与卸载**；REA 的完整能力、CLI 命令和各类目标的深入用法请以官方文档为准（见文末参考链接）。
>
> 版本说明：写本文时（2026-10-18）npm 上 `rea-agents` 的最新发布是 **6.5.0**，**DSH 支持从 6.5.0 起**（更早版本没有 `--client dsh`）。仓库 `main` 分支文档对应尚未发到 npm 的 6.6.0，个别参数可能在后续版本变化；一切以 `rea setup` 计划预览和 `rea doctor` 输出为准。

---

## 0. 一页速通（TL;DR）

在**系统终端**（Terminal / iTerm，不是 DSH 内部对话）里依次执行：

```bash
# 1) 确认 Node 版本：需要 22.x（>=22.19）、24.x（>=24.11）或 26+
node -v

# 2) 把 REA 的 MCP 服务注册进 DSH（交互式，会先给你看变更计划）
npx rea-agents@latest setup --client dsh

# 3) 新开一个 DSH 会话（若要更稳妥，完全退出 DSH Desktop 后重开）

# 4) 只读体检（可选，但推荐）
npx -y rea-agents@latest doctor --client dsh
```

然后在 DSH 的对话里对新会话说：

> 调用 `mcp__rea__binary_session`，参数传 `{}`，告诉我当前有哪些工具可用。

能看到 REA 工具返回，就说明安装成功。接下来就可以让它分析你指定的软件了（见 [第 6 节](#6-在-dsh-里第一次使用-rea)）。

---

## 1. 安装前检查

| 项目 | 要求 | 你这台机器（2026-10-18 实测） |
| --- | --- | --- |
| 操作系统 | macOS（Hopper 自动安装要求 macOS 12+） | macOS 27.0.1 ✓ |
| Node.js | `22.x >= 22.19`、`24.x >= 24.11`、`26+`；**不支持 23/25/pre-release** | v24.19.0 ✓ |
| npm | 随 Node 自带即可 | 11.17.0 ✓ |
| DSH | 已安装并可正常打开 DSH Desktop；profile `desktop` | ✓ |
| REA | `rea-agents >= 6.5.0`（DSH 客户端支持从 6.5.0 开始） | 将安装 npm latest |
| 磁盘 | REA 包解压后约 30 MB，Evidence 输出另计 | — |
| 权限 | 需要能写 `~/.dsh/`、`~/.agents/`（安装脚本会写这两处） | 当前用户可写 ✓ |

检查命令：

```bash
node -v
npm -v
ls -ld ~/.dsh ~/.agents 2>/dev/null   # 不存在也正常，setup 会创建
```

> **不要**用 `sudo` 运行 REA 的 `setup`。它只写当前用户目录；用 root 运行会把 `~/.dsh`、`~/.agents` 里的文件变成 root 所有，之后 DSH 反而读不到。

如果你确定后面要用**全局安装**（第 3 节的方案 B），再额外看一下 npm 全局前缀是否可写：

```bash
npm config get prefix          # 本机为 /usr/local
npm root -g                    # 本机为 /usr/local/lib/node_modules
```

本机 `/usr/local` 属于 `root`，全局安装需要 `sudo`；嫌麻烦就用方案 A（`npx`），不需要 `sudo`。

---

## 2. 方案 A（推荐）：用 npx 安装并注册到 DSH

这是最省事、无需改动 npm 全局目录的方式。

### 2.1 执行 setup

```bash
npx rea-agents@latest setup --client dsh
```

`--client dsh` 的作用是**跳过“选择要给哪些客户端安装”的多选**，只处理 DSH。`npx` 会先下载 `rea-agents` 包，再运行 REA 的安装向导。

### 2.2 审阅它给出的变更计划

向导不会静默改配置，会先列出计划，重点看这几项：

- **配置路径**：`~/.dsh/cordis.patch.yml`（DSH 的 home patch）；
- **要写入的 MCP 条目**：`id: rea-mcp`，使用 DSH 的 MCP 客户端插件 `@deepseek-ai/dsh-mcp-client`；
- **技能目录**：`~/.agents/skills/reverse-engineer-anything/`（默认会装，`--skill=false` 可跳过）；
- **可选的分析引擎**：检测到的 Hopper / Ghidra，或“是否安装 Hopper”的单独提议（Hopper 需要单独批准，见 [第 5 节](#5-分析引擎与可选工具)）；
- **备份**：编辑**已有**配置前会保留 `.rea.backup` 备份（首次创建 home patch 时没有旧文件可备份）。

确认无误后按提示批准。中途取消不会写入任何东西。DSH 正在运行也可以安装（改的是 patch 文件、HMR 会在之后重载），但为稳妥可以先退出 DSH 再执行；至少安装完要新开会话。

> 常用变体：
>
> ```bash
> # 只看计划、不写入（read-only，退出码 0）
> npx rea-agents@latest setup --client dsh --dry-run
>
> # 只补装/刷新技能，不动 MCP 注册
> npx rea-agents@latest setup --skill --dry-run
> npx rea-agents@latest setup --skill --yes
>
> # 显式指定版本（回滚时很有用）
> npx rea-agents@6.5.0 setup --client dsh
> ```

### 2.3 让它生效：新开会话（必要时重启 DSH）

DSH 的 HMR 会监视 home patch 文件，检测到变更后重新组合配置。按 DSH 官方文档的说法：新增 MCP 服务后**“需要一个新的 DSH 会话，但不需要重启 Host”**。所以：

1. 先**新开一个 DSH 会话**，看 `mcp__rea__*` 工具是否出现；
2. 若没出现（例如该 DSH 部署没有启用 HMR / 启动时没拿到 profileContext），**完全退出 DSH Desktop（Cmd+Q，而不只是关窗口）再重新打开**。REA 官方文档也建议安装后重启 Harness，这是最稳妥的路径。

> HMR 的配置监听有约 2 秒的“写入稳定窗口”（`awaitWriteFinish`）：setup 刚结束时立刻检查可能还没重载，等一两秒再看。

### 2.4 验证（先终端，后会话）

终端只读体检（不修改任何配置）：

```bash
npx -y rea-agents@latest doctor --client dsh --json
# 或安装过全局版后：rea doctor --client dsh
```

关注输出里的 `scope_checks` / `clientStates`：DSH 注册条目存在且字段与预期一致即通过。注意两点：

- `healthy` 是**全局体检**，没配置任何原生分析引擎（Hopper/Ghidra/IDA）时它本来就是 `false`，不代表 DSH 注册失败——只看 `scope.mode: "explicit"` 下与 dsh 相关的检查，以及 `doctor.skill` 的状态；
- **doctor 只检查文件与前置条件，不能证明当前 DSH 会话已经连上 MCP**；真正的验证要在 DSH 对话里做：

```text
调用 mcp__rea__binary_session，参数 {}，把工具可用性（tool_availability）告诉我。
```

或者直接问：

```text
列出你当前可用的、以 mcp__rea__ 开头的工具。
```

工具命名规则是 `mcp__<serverName>__<toolName>`，REA 注册的 `serverName` 是 `rea`，所以是 **`mcp__rea__<tool>`**。

---

## 3. 方案 B：全局安装（多会话/更快启动）

如果你会经常用 REA、或者希望 DSH 每个会话启动 MCP 时不必再经过 `npx` 的下载与解析，可以全局安装。

```bash
# 本机 /usr/local 属于 root，需要 sudo；如果你用 nvm 等用户级 Node，则不需要 sudo
sudo npm install --global rea-agents

# 用全局命令注册到 DSH
rea setup --client dsh
```

之后：

- DSH 里的 MCP 启动器会指向全局安装目录下的 `scripts/rea.mjs`（绝对路径），不依赖 npm 缓存；
- 终端里可直接用 `rea ...`（CLI 与 MCP 共用同一套分析工作流）；
- 升级：`rea update` 会就地更新这个绝对路径下的包（注册里没有版本号，不需要重新 pin）；之后可再跑一次 `rea setup --client dsh` 让 doctor 复核注册，然后新开一个 DSH 会话（如未生效再完全重启 DSH）。

> 本机若坚持不用 `sudo`，也可以把 npm 全局前缀改到用户目录（如 `npm config set prefix ~/.npm-global` 并把 `~/.npm-global/bin` 加进 `PATH`），属于 Node 环境的常规操作，本文不展开。

---

## 4. 安装到底改了什么

### 4.1 `~/.dsh/cordis.patch.yml`

DSH 通过 **Cordis YAML patch** 注册 MCP 客户端，而不是各家客户端常见的 `mcpServers` JSON 对象。这是 DSH 官方的持久化方式：`$DSH_HOME/cordis.patch.yml` 是“对整台机器所有 profile 生效”的 home patch（组合顺序为：bundle patches → `$DSH_HOME/profiles/<name>/cordis.patch.yml` → `$DSH_HOME/cordis.patch.yml` → 命令行 `--patch`）。REA 会在这个文件里**追加或替换**一条根级 `insert`：

```yaml
- insert:
    - id: rea-mcp
      name: "@deepseek-ai/dsh-mcp-client"
      config:
        serverName: rea
        transport: stdio
        command: npx
        args: ["-y", "rea-agents@6.5.0", "mcp"]
```

几个要点：

- 文件不存在时 setup 会创建；已存在时**保留其它 patch 和注释**，只动 `id: rea-mcp` 这一条；
- **不要手动创建空文件**：home patch “不存在”是合法状态（等于没有这一层），但“存在但为空/只有注释”会让 DSH 启动时报错；需要时交给 setup 创建；
- home patch **对所有 DSH profile 生效**，所以注册一次即可，不需要改 `~/.dsh/profiles/desktop/` 下的任何文件；
- DSH 的 HMR 会监视这个文件（profile patch 和 home patch 都在监视范围内），变更后重新组合配置；**新增 MCP 服务只需要新开会话，不需要重启 Host**（见 [2.3](#23-让它生效新开会话必要时重启-dsh)）；
- 条目里 `command`/`args` 的形态取决于**安装方式与平台**（6.5.0 实测）：
  - 用 `npx` 运行 setup：`command: npx`，`args: ["-y", "rea-agents@6.5.0", "mcp"]`（如上）；
  - macOS/Linux **全局安装**后运行 setup：`command` 是 `.../rea-agents/scripts/rea.mjs` 的绝对路径，`args: ["mcp"]`；
  - Windows 全局安装：`command` 是 `node` 绝对路径，`args: [rea.mjs 绝对路径, "mcp"]`；`cmd.exe /d /c` 只用在 Windows 的 npx/bunx 形态；
  - **最终以 `rea setup --dry-run --json` 计划里打印的 `Command:` 为准**（6.5.0 的 dry-run 实测输出见 11.1）；
- **只有 npx/bunx 形态**会把版本号 pin 进注册（`args` 里的 `rea-agents@<version>`），所以这种情况下升级后要重跑 setup；全局安装注册的是启动器绝对路径、不带版本号，`rea update` 会就地更新它（仍建议重跑 setup 让 doctor 复核注册）；
- 安装器遵循 DSH 的环境变量约定：`DSH_HOME`（默认 `~/.dsh`）、`DSH_AGENTS_HOME`（默认 `~/.agents`）。如果你改过这两个变量，REA 会写到对应位置。

### 4.2 `~/.agents/skills/reverse-engineer-anything/`

默认同时安装 REA 内置的**工作流技能**（`SKILL.md` + `references/`）。它给 DSH 智能体提供“先看证据、按目标类型选路由、先摘要后深入”的调查指引；DSH 会从 `$DSH_AGENTS_HOME/skills`（默认 `~/.agents/skills`）发现技能——它是 DSH 的 `user-agents` 技能根目录（优先级低于项目内的 `.dsh/skills`、`.agents/skills` 和 `~/.dsh/skills`，高于内置技能），会话里的 `skill` 工具即可加载 `reverse-engineer-anything`。技能目录有文件监视，**新增技能不需要重启**，通常下一个模型步骤就能看到。

注意：**技能只是说明书，不等于 MCP 工具**。只装技能不注册 MCP 时，DSH 里不会出现 `mcp__rea__*` 工具。不想装技能就加 `--skill=false`。

### 4.3 备份与可回滚

- 编辑**已有**配置前会保留 `~/.dsh/cordis.patch.yml` 的快照（`.rea.backup`，必要时还有带哈希的 recovery 副本；首次创建时没有旧文件可备份）；
- 任何一步失败都会保留证据并指明备份路径，不会“半写半不写”；
- 想撤销：见 [第 8 节](#8-更新回滚与卸载)。

### 4.4 手动注册（可选，离线/自管时）

如果 setup 无法使用（例如离线、或你想把配置纳入自己的 dotfiles 管理），可以手动写同样的条目。**先备份**：

```bash
cp ~/.dsh/cordis.patch.yml ~/.dsh/cordis.patch.yml.bak 2>/dev/null || true
```

然后追加（保持 `literal` 值、根级 `insert`、`id` 固定为 `rea-mcp`）：

```yaml
- insert:
    - id: rea-mcp
      name: "@deepseek-ai/dsh-mcp-client"
      config:
        serverName: rea
        transport: stdio
        command: npx
        args: ["-y", "rea-agents@6.5.0", "mcp"]
```

写完后**新开一个 DSH 会话**（没生效再完全重启 DSH），并在终端跑 `npx -y rea-agents@latest doctor --client dsh --json` 核对。手动配置的已知限制（来自 REA 官方文档）：

- 如果整段 config 用 Cordis 表达式生成、或把 `rea-mcp` 插在某个 group 下面，`rea setup` 会拒绝编辑——请保持“字面量 + 根级插入”；
- 手写条目不会被 setup 的备份/校验流程保护；升级或卸载请优先回到 setup / `rea uninstall`。

> DSH 官方文档同样把 `$DSH_HOME/cordis.patch.yml` 列为“对所有 profile 持久化 MCP 服务”的推荐位置，并要求**不要整文件覆盖**已有 patch（可能含有无关的用户配置）。
>
> 手动写 `command: npx` 依赖 DSH 能解析到 `npx`（多数 Desktop 会从登录 shell 读到 PATH）。如果你想要最稳的手动写法，用 `node` 绝对路径 + `rea.mjs` 绝对路径，或用全局安装后的 `rea.mjs` 绝对路径。

### 4.5 DSH 的 MCP 子进程环境（重要）

DSH 启动 stdio MCP 服务时，会**从继承的环境里剔除**名称含 `KEY` / `PASSWORD` / `SECRET` / `TOKEN` 子串的变量，以及所有 `DSH_*` 变量，然后把条目 `config.env` 里的值合并进去。`GHIDRA_INSTALL_DIR`、`JAVA_HOME`、`HOPPER_LAUNCHER_PATH` 这类变量**不在清洗范围内**；Desktop 还会从登录 shell 读取环境，所以从终端 `export` 后启动的 DSH 通常能继承它们。但为了可复现、不依赖 DSH 的启动方式，建议：

- **引擎路径**：设置好 `GHIDRA_INSTALL_DIR` / `JAVA_HOME` 后重跑 setup（`rea setup --client dsh` 或 `npx -y rea-agents@latest setup --client dsh`）。REA 会把检测到的引擎路径**写进注册条目的 `config.env`**，DSH 启动 MCP 时再合并回去——这正是注册条目里可能出现 `env` 的原因；
- **REA 调优变量**（`REA_MCP_MAX_RESPONSE_BYTES`、`REA_MCP_INPUT_SCHEMA_PROFILE` 等）：setup 会保留已有的 env 覆盖值，推荐直接写在注册条目 `config.env` 里；
- **含 `TOKEN`/`KEY`/`SECRET`/`PASSWORD` 的变量**（例如某些 provider 的密钥）：它们**不会**被子进程继承，必须写进 `config.env`；写进 YAML 的明文密钥请自行保护文件权限。

---

## 5. 分析引擎与可选工具

REA 本身是“调度器 + 证据层”，**能不能分析某类目标取决于你装了哪些分析工具**。安装 REA 不等于装了反编译器。

> 下文的 `rea ...` 命令指**全局安装**后的用法；如果你走的是方案 A（npx），把 `rea` 换成 `npx -y rea-agents@latest` 即可，例如 `npx -y rea-agents@latest doctor --json`。

| 目标 | 是否需要专门引擎 | 说明 |
| --- | --- | --- |
| JavaScript / Electron（目录或 `.asar`） | 不需要 | 纯静态读取，安装后即可用 |
| .NET 程序集（PE/CLI） | 不需要 | 静态元数据 + CIL 检查 |
| Go / Rust 二进制元数据 | 不需要 | 内置静态检查 |
| 原生二进制（Mach-O / ELF / PE） | **需要** | Hopper、Ghidra 或 IDA 三选一 |
| Android APK | 需要 JADX + JDK | 需自行准备 |
| 网站 / 网络捕获 | 需要 Chrome 系浏览器、tshark 等 | 按目标而定 |

### 5.1 Hopper（macOS 上最省事）

- Hopper 是**商业软件**，有自己的许可；免费 demo 有厂商定义的限制，购买许可可选；
- 执行 `rea setup --client dsh` 时，如果本机没有检测到 Hopper，安装向导会**单独提议安装 Hopper**，需要你明确批准；
- 批准后它会下载官方 DMG、校验大小与摘要、验证应用包，并安装到 `~/Applications/Hopper Disassembler.app`；不通过 Homebrew、不需要管理员权限；
- 首次启动 Hopper 会弹窗让你选择 **demo 模式**或 **激活已有许可证**；
- REA 会在需要时自动启动 Hopper，你不必先手动打开；
- 已知限制（macOS）：REA 不接受已保存的 Hopper 数据库（`.hop`）作为目标——要分析就直接选**原始可执行文件**，由 REA 走受支持的启动桥接；
- 排查：若 Hopper 目录权限报错，确认目录属于当前用户，并恢复仅所有者可读写执行（`0700`）后重试。

如果你已经装了 Hopper，setup 会复用它，不会重复安装。

### 5.2 Ghidra（免费，但要自己准备）

REA 连接**已安装**的 Ghidra，不会替你下载或安装：

1. 准备 Ghidra **12.1.x** 和它要求的 **64 位完整 JDK**（当前 12.1 需要 JDK 21+）；
2. 解压 Ghidra、装好 JDK；
3. 导出绝对路径后体检、再注册：

```bash
export GHIDRA_INSTALL_DIR=/absolute/path/to/ghidra_12.1.4_PUBLIC
export JAVA_HOME=/absolute/path/to/jdk-21     # 若 java/javac 已在 PATH 上可省略
# 全局安装时：
rea doctor --json
rea setup --client dsh
# 或用 npx：
# npx -y rea-agents@latest doctor --json
# npx -y rea-agents@latest setup --client dsh
```

4. 新开一个 DSH 会话（如未生效再完全重启 DSH）。

注意点：

- macOS 上 Homebrew 的 OpenJDK 是 keg-only，`java` 包装器可能找不到它，需要把 `JAVA_HOME` 指到 `/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home`（Apple Silicon）或 `/usr/local/opt/openjdk/libexec/openjdk.jdk/Contents/Home`（Intel）；
- JDK 的架构必须与宿主一致（不要在 Apple Silicon 上选 Rosetta 下的 x86_64 JDK）；
- Ghidra 安装目录里必须有对应平台的 native decompiler；官方发布包有时需要单独编译该组件；
- REA 不会修改 Gatekeeper 隔离属性，也不会升级 Ghidra/JDK；
- 为可复现起见，`GHIDRA_INSTALL_DIR` / `JAVA_HOME` 最好通过重跑 setup（`rea setup --client dsh` 或 `npx -y rea-agents@latest setup --client dsh`）写进注册条目的 `config.env`，而不是只依赖 shell 里的 `export`（见 [4.5](#45-dsh-的-mcp-子进程环境重要)）。

### 5.3 IDA Pro（商用）

已有 IDA 安装与许可证时可用；REA 不提供许可证、密钥或激活。体检命令：

```bash
rea doctor --provider ida --json
# 未全局安装时：
npx -y rea-agents@latest doctor --provider ida --json
```

使用 IDA 时请遵守其许可（包括试用版对自动化和输出分享的限制）。

### 5.4 其他按需工具（用到再装）

这些由**调用方自行提供**，REA 不负责安装：`adb`（Android 设备）、JADX + 完整 JDK（APK 反编译）、Apktool（资源）、`tshark` + `capinfos`（pcap）、WABT（WASM）、Binwalk/Unblob（固件，Linux）、sigrok-cli（逻辑信号，Linux）、pwntools（ELF/崩溃，Linux）、Chrome 系浏览器（网站观察）、HAR 文件（已保存的网络捕获，无需额外工具）。

---

## 6. 在 DSH 里第一次使用 REA

### 6.1 建议的第一句话

新开一个会话，直接说：

```text
用 mcp__rea__binary_session 空参数调用一次，告诉我工具可用性和当前分析提供方。
```

确认工具在，再描述目标：

```text
分析 /Applications/SomeApp.app。我想知道它的「导出为 PDF」功能是怎么实现的：
先用 REA 找出相关函数，给我伪代码和证据，再解释实现思路。
```

也可以显式让它加载技能：

```text
先加载 reverse-engineer-anything 技能，然后按它的指引分析 /path/to/target。
```

### 6.2 使用要点

- **工具前缀**：`mcp__rea__` + 工具名，例如 `mcp__rea__binary_session`、`mcp__rea__open_binary`、`mcp__rea__analyze_javascript_application`；
- **先会话再操作**：原生分析通常先 `open_binary` 选定目标和分析引擎，再按需 `analyze` / `decompile` / `xrefs` 等；不确定时先空调用 `binary_session`，它返回的 `tool_availability` 是当前会话最权威的可用性来源；
- **证据优先**：REA 的返回包含证据（字符串、反汇编、调用关系、限制说明），智能体应基于证据下结论；如果它直接给结论却没有证据，让它补上；
- **大结果**：完整 Evidence 可能很大（真实应用可达数百 MB），让智能体先看摘要/分页、必要时把 Evidence 存成文件再投影；
- **超时**：MCP 单次工具调用默认 60 秒；首次 Ghidra 导入大目标可能更久。客户端超时不代表分析失败，可询问进度或稍后重试；
- **本地分析**：REA 在你的机器上分析目标，目标文件不会上传；但**工具结果会进入模型上下文**，受 DSH 所配置模型提供商的数据政策约束。

### 6.3 适合让它做什么

- 没有源码的 App：搞清某个功能怎么工作、给出伪代码与调用链；
- Electron / JavaScript 应用：模块、路由、IPC 边界、source map；
- 二进制对比：同一软件不同版本的函数/行为差异；
- 重建某个功能：先逆向出算法，再在你的项目里实现并用测试比对。

> 反过来：如果你要分析的是**完整源码仓库**，普通代码分析工具更合适，不必动用 REA。

---

## 7. 更新 REA

REA 发布节奏较快，新版本经常包含修复，建议保持最新。

**方案 A（npx 注册）**：重跑同一条 setup，审阅计划后批准，然后新开一个 DSH 会话（如未生效再完全重启 DSH）：

```bash
npx rea-agents@latest setup --client dsh
```

**方案 B（全局安装）**：

```bash
rea update
rea setup --client dsh      # 可选：让 doctor 复核注册（全局形态不 pin 版本）
```

然后新开一个 DSH 会话（如未生效再完全重启 DSH）。

查看 npm 上最新发布版本：

```bash
npm view rea-agents dist-tags.latest
```

> 记住：**npx/bunx 形态**会把版本 pin 在注册的 `args` 里（`rea-agents@<版本>`），只升级包、不重跑 setup 的话 DSH 仍会启动旧版本；**全局安装形态**注册的是启动器绝对路径（不带版本号），`rea update` 就地把包更新掉。

---

## 8. 更新回滚与卸载

### 8.1 回滚到旧版本

```bash
npx rea-agents@6.5.0 setup --client dsh    # 把 @ 后面的版本换成你想回到的版本
```

审阅计划并批准，新开一个 DSH 会话（如未生效再重启 DSH）。

### 8.2 卸载

```bash
npx -y rea-agents@latest uninstall
# 或全局安装过：
rea uninstall
```

行为说明：

- 扫描受支持的客户端，移除 REA 自己的注册（含 DSH home patch 里的 `rea-mcp` 条目）和 REA 安装的技能文件；
- **保留** Hopper、Node.js、Evidence、抓包、你其它的 MCP 服务和无关技能；
- `rea uninstall --purge-data` 额外删除 REA 的缓存/状态（`~/.rea`）；
- 卸载完成后新开会话（或重启 DSH），会话里的 REA 工具应消失；
- 如果你手动改过注册（不是 setup 写的），先确认 `~/.dsh/cordis.patch.yml` 里的 `rea-mcp` 条目已被删除。

---

## 9. 排错

| 症状 | 可能原因 | 处理 |
| --- | --- | --- |
| DSH 会话里没有 `mcp__rea__*` 工具 | 没新开会话/没重启、注册未生效、MCP 启动失败 | 先新开会话；不行再完全退出 DSH 重开（HMR 生效后约 2 秒内热重载）；终端跑 `rea doctor --client dsh --json`；确认 `~/.dsh/cordis.patch.yml` 有 `rea-mcp` 且 `disabled` 未设为 true；查看 DSH 的日志/终端输出（或 doctor 的 registration 状态）里的 MCP 连接错误 |
| DSH 启动时报 patch/YAML 错误 | `~/.dsh/cordis.patch.yml` 存在但为空、只有注释或 YAML 非法 | 先删除或修复该文件，再跑 setup（只想禁用这一层就把内容写成 `[]`）。空/仅注释的 patch 不仅让 DSH 启动失败，REA setup 自己也会拒绝编辑；不要手动 `touch` 空文件 |
| `rea`: command not found | 只用过 `npx`，没全局安装 | 用 `npx -y rea-agents@latest <命令>`，或按方案 B 全局安装 |
| setup 报“不支持的 client”/没有 `dsh` | 版本太旧（< 6.5.0） | 用 `npx rea-agents@latest setup --client dsh`；确认 `npm view rea-agents dist-tags.latest` |
| setup 拒绝编辑配置 | 配置里有 Cordis 表达式、或 `rea-mcp` 被包在 group 里 | 改成“字面量 config + 根级 insert”（见 4.4）；或按提示修复后重跑 |
| 权限错误（`~/.dsh` 写不进去 / npm EACCES） | `~/.dsh` 被 root 占用、或用了 `sudo npm install -g` 后 prefix 权限混乱 | 不要用 sudo 跑 setup；修复目录归属（`sudo chown -R $(id -u):$(id -g) ~/.dsh`）；全局安装时处理 npm prefix |
| 首次启动很慢 / 偶发 MCP 超时 | `npx` 每个会话要检查并解析包，首次还要下载 | 换方案 B 全局安装；或保持 DSH 有网；重启 DSH 后重试 |
| DSH 里 MCP 报找不到 `npx`（少见） | 登录 shell 环境探测失败/超时，或 Node 只配在非登录 shell 的 PATH 文件里 | 用方案 B（绝对路径启动器）最稳，或从终端启动 DSH；也可把 Node 路径写进登录 shell 配置 |
| REA 工具不出现，日志里有 MCP 连接错误 | 服务启动失败（命令/参数路径错误、Node 版本不符、`npx` 不可用） | 在终端手动执行注册里的 `command + args` 看报错；核对 `node -v`；或改用全局安装形态 |
| `doctor` 说 Hopper 不可用 | 未安装 / 未批准安装 / 目录权限 | 重跑 setup 并在 Hopper 提议处批准；或安装后 `rea doctor --provider hopper --json` |
| Ghidra provider 不可用 | 版本不是 12.1.x / JDK 不符合 / native decompiler 缺失 / 架构不符 | 看 `rea doctor --provider ghidra --json` 的具体拒绝原因；核对 `GHIDRA_INSTALL_DIR`、`JAVA_HOME` |
| 工具调用超时 | 默认 60 秒；首次分析/导入较慢 | 稍后重试、查看 `analysis_activity`；必要时在 MCP 条目 config 里调大 `toolCallTimeoutMs` |
| 工具结果过大被截断/模型看不全 | 输出超过客户端/模型限制 | 让智能体先取摘要或分页；可在 MCP 条目 `config.env` 里设置 `REA_MCP_MAX_RESPONSE_BYTES`、`REA_MCP_INPUT_SCHEMA_PROFILE=compact` 等（这些覆盖值 setup 会保留） |
| 读不到目标（macOS 权限） | 目标位于受保护目录（如其它 App 的容器目录） | 把目标复制到工作区再分析；或给 DSH/Terminal 授予完全磁盘访问权限 |
| Hopper 弹授权/试用对话框 | 首次启动需选 demo 或激活 | 按提示选择；商用请购买许可 |

更多客户端级问题见 REA 官方 [Client configuration and troubleshooting](https://github.com/morluto/rea/blob/main/docs/client-configuration.md)。

---

## 10. 安全、许可与合规

- **只分析你拥有或获得授权分析的软件**。REA 面向合法的研究、教育、互操作、软件保存等用途；不要用它做未授权的事。
- REA 自己的代码是 MIT；但 **Hopper、IDA Pro / Hex-Rays、JEB 等商用工具需要你自己合法取得并遵守其许可**，REA 不提供许可证、密钥或激活，也不得使用破解副本或绕过许可限制。
- 分析在**本机**执行，目标不会由 REA 上传；但 DSH 会把工具结果交给所配置的模型，适用该模型提供商的数据政策。
- DSH 的审批策略会对工具调用、文件写入等请求做确认；安装时也需要批准写 `~/.dsh`、`~/.agents` 以及（可选的）Hopper 安装。不要为了图省事关掉安全策略。
- 运行时分析（如启动目标、进程捕获、浏览器观察）会以**你的用户权限**运行目标，请自行评估影响。

---

## 11. 本机状态快照（2026-10-18）

| 项目 | 实测值 |
| --- | --- |
| OS | macOS 27.0.1 |
| Node / npm | v24.19.0 / 11.17.0（在支持范围内） |
| npm 全局前缀 | `/usr/local`（root 所有 → 全局安装需 sudo） |
| DSH | Desktop，profile `desktop`，`~/.dsh/profiles/desktop/` 已存在 |
| `~/.dsh/cordis.patch.yml` | 安装前不存在（setup 会创建） |
| `~/.agents/skills` | 安装前不存在（setup 会创建） |
| npm 上 `rea-agents` latest | 6.5.0（DSH 支持 ≥ 6.5.0） |

### 11.1 实测：`setup --client dsh --dry-run` 的计划（2026-10-18）

在本机用 `npx rea-agents@6.5.0 setup --client dsh --dry-run --json` 跑过一遍（只读、不写配置），计划如下，可作为预期参考：

```text
status: planned
plannedActions:
  1) configure_client:dsh
     label:  DeepSeek Harness
     target: /Users/ignis/.dsh/cordis.patch.yml
     operation: create
     detail: Add the REA MCP registration for DeepSeek Harness; ...
             Command: "npx" "-y" "rea-agents@6.5.0" "mcp".
             No additional provider environment variables.
  2) install_skill
     target: /Users/ignis/.agents/skills/reverse-engineer-anything
clients: dsh  detected=true configured=false status=needs_configuration
```

即：安装前 DSH 已被正确识别（`~/.dsh` 存在），计划做两件事——创建 home patch 并写入 `rea-mcp` 注册、安装技能；本机没有任何分析引擎，所以计划里没有额外的 provider 环境变量。

---

## 12. 参考链接

- REA 中文 README：<https://github.com/morluto/rea/blob/main/docs/readme/README_zh.md>
- REA 安装与设置（完整版）：<https://github.com/morluto/rea/blob/main/docs/installation.md>
- REA 客户端配置（含 **DeepSeek Harness** 一节）：<https://github.com/morluto/rea/blob/main/docs/client-configuration.md#deepseek-harness>
- REA MCP 契约与工具目录：<https://github.com/morluto/rea/blob/main/docs/mcp-contracts.md>
- REA CLI 与 Evidence：<https://github.com/morluto/rea/blob/main/docs/cli.md>
- REA 官网（中文）：<https://rea.tools/zh-CN/>
- DSH 仓库文档（profile 组合顺序、home patch、HMR）：<https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/README.md>
- DSH 官方 MCP 接入指南（home patch 持久化 MCP 服务、工具命名、环境清洗、验证方式）：<https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/mcp-memory.md>
- DSH 的 MCP 客户端包说明：<https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/mcp/mcp-client/README.md>
- DSH 本地技能发现（`~/.agents/skills` 等根目录与监视行为）：<https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/skill/skill-filesystem/README.md>

---

## 附录：常见问题（FAQ）

**Q：安装 REA 会改动 DSH 的 profile 配置或插件吗？**
不会。它只写用户级 home patch `~/.dsh/cordis.patch.yml` 和技能目录；`~/.dsh/profiles/desktop/` 下的文件不动。`rea uninstall` 也只移除自己的条目。

**Q：我不想让所有 DSH profile 都有 REA 工具怎么办？**
home patch 天然对所有 profile 生效。DSH 官方支持把同一条 `insert` 行放进单个 profile 的 patch（`~/.dsh/profiles/desktop/cordis.patch.yml`），效果只限该 profile；但 `rea setup` / `rea doctor` / `rea uninstall` 管理的是 home patch，不会替你维护这份 profile 级条目。要真正隔离（包括防止同账号的智能体通过 `PATH`/`npx` 自行调用 REA），最干净的是独立 OS 账号或容器；REA 官方文档对“限定范围”有完整说明。

**Q：只装 skill、不注册 MCP 可以吗？**
可以：`npx skills add morluto/rea --skill reverse-engineer-anything`，或 `rea setup --skill --yes`（**不要带 `--client`**，带了会一并刷新 MCP 注册）；只想刷新 DSH 的技能目录可用 `rea setup --skill-client dsh --yes`。但 skill 只是调查指引，**不会**让 DSH 出现 `mcp__rea__*` 工具。

**Q：为什么注册里有一串版本号？升级后会自动变吗？**
只有 **npx/bunx 形态**会把 `rea-agents@<版本>` pin 进注册，保证行为可复现；升级后要重跑 setup（并新开会话/重启 DSH）才会更新。**全局安装形态**注册的是启动器绝对路径、没有版本号，`rea update` 就地生效；是否重跑 setup 只影响 doctor 对注册的复核。

**Q：禁用/删除某条注册要手动改 YAML 吗？**
优先用 `rea uninstall`。临时禁用可以在条目上加 `disabled: true`（DSH 的 patch 支持）后新开会话或重启；但 `rea setup` 重写该条目时会删掉 `disabled`，`rea doctor` 也会把它视为未就绪——所以它只适合临时禁用。手改前先备份。
