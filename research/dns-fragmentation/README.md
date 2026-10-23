# DNS 大响应分片安全研究：资料包索引

> 生成时间：2026-10-22｜主题：DNS 大响应（需 IP 分片）的分片处理弱点，防御视角（检测与缓解）的可发表性调研、实验方法与执行计划。

## 交付物

| 文件 | 说明 |
|---|---|
| [DNS分片安全研究调研报告.md](DNS分片安全研究调研报告.md) | **主报告（861 行，60 条参考文献）**：结论摘要、文献综述、新颖性/空白分析、6 个可收窄选题、受控实验方法论、发表策略与 12 周计划、关键事实速查、证据等级 |
| [研究提案-12周执行版.md](研究提案-12周执行版.md) | 一页式执行版：方向决策树、贡献声明模板、delta 表、实验设计（U1–U6）、12 周时间线、venue、风险与伦理清单 |

## 团队工作笔记（附录/证据）

| 文件 | 内容 |
|---|---|
| [notes/lit-classic.md](notes/lit-classic.md) | 347 行 / 52 条可核查引用：1987–2021 经典分片/DNS 文献、标准、实现 CVE、时间线、对构想的启示 |
| [notes/lit-recent.md](notes/lit-recent.md) | 2021–2026 最新工作（41 篇 + 标准 + 中文线索 + 新颖性威胁评级 + 空白 G1–G6） |
| [notes/lab-methods.md](notes/lab-methods.md) | 731 行实验方法：威胁模型、诱导大响应、netns/MTU、Scapy 伪造分片、检测基线、工件、伦理 |
| [notes/novelty-venues.md](notes/novelty-venues.md) | 369 行可发表性分析：分档矩阵、T1–T6 选题卡、空白矩阵、CCF/venue 表、12 周计划 |
| [notes/lead-intel.md](notes/lead-intel.md) | Lead 已核实事实清单（环境、curl 用法、RFC/CVE/论文元数据） |
| [references.md](references.md) | 从主报告抽取的 60 条参考文献（便于单独引用） |

## 30 秒结论

- **原样构想不可发**："分片危险"是 1987 年以来经典问题，2013/2020/2021/2025 已被多轮覆盖（Herzberg 2013、USENIX Sec 2020、RUC/POPS 2025、CVE-2025-59024）。
- **收窄后可发**：测量（PQ DNSSEC 大响应 / IPv6 / 中间盒 / RFC 9715 遵从度）→ TMA/PAM/IMC；检测（DNS 语义感知 + eBPF + 规避评估）→ ANRW/DSN；工件 → ANRW/TMA；中文期刊可行。
- **技术障碍可越过**：Linux VM + netns + BIND/Unbound + Scapy + 文档地址即可；不需要攻击工具。
- **新颖性障碍需主动跨**：站在 2024–2026 新变量（后量子 DNSSEC、IPv6、RFC 9715 后行为、DNS 语义检测）上，并在引言逐条对比 POPS/RUC/FRAGJAM/PAM 2021/TNSM 2024。
- **最现实的最小可发表版本**：ANRW/TMA/PAM 短文 + 开源工件（P1 测量或 P2 检测的最小版）。

## 安全与证据声明

- 所有实验方案均限定隔离环境：Linux VM / network namespace、RFC 5737 与 RFC 3849 文档地址、无默认路由、egress DROP；不针对真实解析器/第三方网络。
- 关键事实附 DOI/URL；主报告附录 B 给出 `[已核]` / `[待核实]` 清单。投稿前请对 `[待核实]` 条目做全文核对。
- 主动测量需获许可并遵守平台条款；发现真实漏洞走厂商/CERT 协调披露（常见 90 天，以政策为准）。
