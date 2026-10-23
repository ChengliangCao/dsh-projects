# Sources：Claude / Claude Code Projects 调研来源清单

- 调研执行：2026-10-22（Asia/Shanghai）
- 第一次抓取开始：约 2026-10-22T13:58+08:00；本清单整理：2026-10-22T14:02+08:00
- 工具：`web_fetch`（HTTP 抓取，正文可能被截断；完整返回会保存在本机 spill 文件）、`read`/`grep` 读 spill、`web_search`（仅用于找线索，不作为规格依据）
- 引用编号 S1–S17 与 [README.md](README.md) 第 14 节一致。
- **重要**：Projects 处于分批 public beta，所有可用性/限额结论以抓取当日页面为准。

## 1. 来源总表

| 编号 | 来源 | URL | 类型 | 抓取结果 | 用途 |
| :- | :- | :- | :- | :- | :- |
| S1 | Let Claude coordinate ongoing work with Projects（Claude Code 文档，主依据） | https://code.claude.com/docs/en/claude-projects.md | 官方文档 | HTTP 200，**全文**（60,015 bytes，511 行） | 规格主依据 |
| S2 | Orchestrate teams of Claude Code sessions（Agent Teams） | https://code.claude.com/docs/en/agent-teams.md | 官方文档 | HTTP 200，全文（返回内容完整） | Agent Teams 对照 |
| S3 | Run agents in parallel（五种并行方式对比） | https://code.claude.com/docs/en/agents.md | 官方文档 | HTTP 200，全文 | 概念边界 |
| S4 | Use Claude Code in the cloud（cloud sessions） | https://code.claude.com/docs/en/claude-code-on-the-web.md | 官方文档 | HTTP 200，正文截断；完整存 spill | 线程底层、auto-fix、限制 |
| S5 | Configure cloud environments | https://code.claude.com/docs/en/cloud-environments.md | 官方文档 | HTTP 200，正文截断；完整存 spill | 网络/env/secret/setup/资源 |
| S6 | Automate work with scheduled tasks（routines） | https://code.claude.com/docs/en/routines.md | 官方文档 | HTTP 200，全文 | 项目内定时任务、`/fire` API |
| S7 | Continue local sessions from any device with Remote Control | https://code.claude.com/docs/en/remote-control.md | 官方文档 | HTTP 200，正文截断；完整存 spill | 本机线程实现 |
| S8 | Claude Code changelog | https://code.claude.com/docs/en/changelog.md | 官方文档 | HTTP 200，仅显示最近版本（2.1.295–2.1.308），未见 Projects 条目 | 核对 changelog（无果） |
| S9 | Claude Code Docs index（llms.txt） | https://code.claude.com/docs/llms.txt | 官方文档索引 | HTTP 200，正文截断；完整存 spill | 确认无 Projects API 页 / 找页面 |
| S10 | What's new（weekly digests index） | https://code.claude.com/docs/en/whats-new/index.md | 官方文档 | HTTP 200；最新到 Week 37（Projects 发布为 W38，无条目） | 发布信息核对（无果） |
| S11 | What are projects?（Claude Help Center） | https://support.claude.com/en/articles/9517075-what-are-projects | 官方帮助中心 | HTTP 200，正文完整（尾部略截断） | 旧版 Projects + 新版 beta 说明 |
| S12 | How can I create and manage projects? | https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects | 官方帮助中心 | HTTP 200，正文完整 | 旧版 Projects 细节 |
| S13 | Organize your tasks with projects in Claude Cowork | https://support.claude.com/en/articles/14116274-organize-your-tasks-with-projects-in-claude-cowork | 官方帮助中心 | HTTP 200，正文截断；关键部分已见 | Cowork Projects 区分（注意该页有过期表述） |
| S14 | Projects redesigned: from folder to conversation（官方博客） | https://claude.com/blog/projects-redesigned | 官方博客 | HTTP 200，但**正文前被截断**；仅拿到元数据（Date: September 17, 2026；Category: Announcements；Product: Claude Code；Reading time: 5 min）；`.md` 变体 404 | 发布日期/标题/定位 |
| S15 | 第三方逐字摘录：官方博客 highlights（Readwise 高亮） | https://www.pelayoarbues.com/literature-notes/articles/projects-redesigned-from-folder-to-conversation | 第三方笔记（转引官方博客） | HTTP 200，全文 | 博客正文引文（标【已证实·转引】） |
| S16 | Anthropic Rebuilds Claude Code Projects to Run Parallel Agents on Opus by Default（2026-09-18） | https://www.implicator.ai/anthropic-claude-code-projects-opus-default/ | 第三方媒体 | HTTP 200，全文 | 旁证：发布日期、默认 Opus、200 线程/天等 |
| S17 | Work with Claude Tag（文档首页） | https://claude.com/docs/claude-tag/overview | 官方文档 | HTTP 200，但只返回导航，正文未取到 | 仅确认概念存在；对比改用 S1 |

## 2. 抓取失败 / 受限记录（不编造，只记录）

| 尝试 | 结果 | 影响与替代 |
| :- | :- | :- |
| https://claude.com/blog/projects-redesigned | 200，但工具在正文前截断（claude.com 页面导航很长）；得到的正文只有标题、分类、日期、阅读时长 | 博客正文引文改用 S15 的逐字摘录，README 中标注【已证实·转引】 |
| https://claude.com/resources/articles/projects-redesigned | 200，同样在正文前截断 | 同上 |
| https://claude.com/resources/articles/projects-redesigned.md | HTTP 404 | 无 |
| https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md | 失败：URL hostname 解析到 non-public IP address（抓取器策略） | 未能核对 9 月 release changelog；docs 版 changelog（S8）只显示最近版本且未见 Projects 条目 |
| https://r.jina.ai/https://claude.com/blog/projects-redesigned | fetch failed（文本代理不可用） | 未使用 |
| https://code.claude.com/docs/en/whats-new/2026-w38.md（及 w39） | HTTP 404 | 发布周没有 weekly digest；日期改用 S14 + S16 |
| https://www.heise.de/en/news/Claude-Code-Anthropic-turns-Projects-into-a-task-distributor-11458342.html | fetch failed | 未引用 |
| https://devops.com/anthropic-adds-a-coordinator-to-claude-projects-for-running-ai-work-in-parallel | HTTP 403（Cloudflare 盾） | 未引用 |
| https://bosio.digital/articles/claude-projects-redesign | 200，但正文前截断（仅标题） | 未引用 |
| https://code.claude.com/docs/en/whats-new/2026-w37.md | 未单独抓取（index 已覆盖 W37） | 无 |
| Claude Code CLI/桌面/移动端逐页功能对齐 | 未逐一抓取 | README 中标注【未证实】 |

## 3. 本地全文快照（spill 文件路径）

web_fetch 返回被截断时，完整返回保存在本机临时目录：

| 内容 | 快照路径 | 大小 |
| :- | :- | :- |
| Projects 主文档全文（S1；用户/Lead 预抓取版本） | `/var/folders/vz/r20wwwb94vb8vf0k6jmx6hwc0000gn/T/dsh-spill-BrHdHp/session-5478bbce9066/9601b8d99a48-web_fetch.txt` | 60,015 bytes |
| Projects 主文档全文（S1；本次抓取，内容同上） | `/var/folders/vz/r20wwwb94vb8vf0k6jmx6hwc0000gn/T/dsh-spill-BrHdHp/session-935957d20da8/2972dfce6b7b-web_fetch.txt` | 60,015 bytes |
| Cloud environments（S5） | `/var/folders/vz/r20wwwb94vb8vf0k6jmx6hwc0000gn/T/dsh-spill-BrHdHp/session-935957d20da8/0c6d5722ed05-web_fetch.txt` | 63,471 bytes |
| Remote Control（S7） | `/var/folders/vz/r20wwwb94vb8vf0k6jmx6hwc0000gn/T/dsh-spill-BrHdHp/session-935957d20da8/3f8ea37e9589-web_fetch.txt` | 60,419 bytes |
| Changelog（S8） | `/var/folders/vz/r20wwwb94vb8vf0k6jmx6hwc0000gn/T/dsh-spill-BrHdHp/session-935957d20da8/5c5fe1c8c5d2-web_fetch.txt` | 100,261 bytes |
| Docs index llms.txt（S9） | `/var/folders/vz/r20wwwb94vb8vf0k6jmx6hwc0000gn/T/dsh-spill-BrHdHp/session-935957d20da8/e916c95f17da-web_fetch.txt` | 63,817 bytes |

> 这些是平台临时文件，可能被清理；README 中已保留所有关键短引与 URL。

## 4. 页面内容一致性 / 时效性备注

1. **S1 与 S11 的 rollout 描述略有差异**：
   - S1（Claude Code docs）：“rolling out gradually, starting with accounts that have used cloud sessions and don't have existing projects in claude.ai chat or Cowork.”
   - S11（Help Center）：“now available in beta to select Pro and Max subscribers who use Claude Code, and to some Pro and Max users whose existing projects we've moved to the new version.”
   - 结论：放量策略分批动态调整，两者不矛盾；README 已注明。
2. **S13 有过期表述**：“Projects are only available in Cowork, not in Claude Code. Support for Claude Code is planned for a future update.”——该页更新于一周前，但 Claude Code Projects beta 已于 2026-09-17 发布，说明帮助中心新旧页面并存。README 已提示。
3. **S1 中 “Run a thread on your own computer”（Remote Control 本机线程）当前已写入文档**，而 2026-09-17 发布博客仍说 “Threads run in the cloud today; running on your machine … is coming very soon.”（S15）→ 说明发布后数周内产品已更新；本文以 S1（更新更晚）为准。
4. **S2（Agent Teams）**：experimental、默认关闭（`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`）；非交互 `-p` 模式不可 spawn teammate；与 Projects 的对照见 README §9.2。
5. **S8（changelog）**：工具只返回最近版本段落；可见范围（2.1.295–2.1.308）内没有 “Projects” 条目。不能由此断言“changelog 从未提及 Projects”，只能说**本次抓取范围内未发现**——README 标为未证实。
6. **S14 日期**：博客页面元数据 Date 为 2026-09-17；第三方报道发布次日（2026-09-18）。两者一致。

## 5. 检索线索（web_search，不作为规格依据）

用于定位官方页面的搜索词：`"Projects redesigned: from folder to conversation"`、`"a project is one conversation" Claude projects coordinator threads`。返回的第三方链接包括 S15、S16，以及 daily.dev / tldr.tech / dsebastien.net / zdnet（转述）等，未逐篇引用。

## 6. 复现建议

如需复核本文关键结论，按以下顺序读原文：

1. S1 的 “How a project is organized”“Work in a project”“Give a project standing context”“Project settings reference”“Usage and cost”“How projects relate to other Claude Code features”“Limitations” 七节；
2. S4 的 “Cloud environments”“Auto-fix pull requests”“Limitations” 三节（线程底层）；
3. S5 的 “Network access”“Setup scripts”“Resource limits” 三节（环境细节）；
4. S7 的 “Start a Remote Control session”（本机线程前提）；
5. S2 全文（Agent Teams 对照）；
6. S11/S12（旧版 Projects），S13（Cowork Projects）。

> 若页面发生变化，请以抓取时间（2026-10-22）为界，重新核对 S1 的 NOTE/Limitations 与 S11 的 beta 段落。
