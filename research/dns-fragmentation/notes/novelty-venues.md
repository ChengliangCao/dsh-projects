# 可发表性与投稿策略分析（novelty-venues）

> 子智能体 res-venues，2026-10-22。输入：`notes/lead-intel.md`（Lead 已核实 13 条）。
> 引用纪律：只写可核查 URL/DOI；不确定的标 **[待核实]**；**不编造分区、影响因子、截稿日期、录用率**。
> 本文件回答用户两个核心问题：**(Q1) 这个点是否能形成可发表成果？(Q2) 现今研究能否越过这些障碍（工具/方法能否复用）？**

---

## 0. 一句话结论（TL;DR）

**Q1：** "DNS 大响应需要分片时分片处理暴露弱点" 这个**原样命题本身不足以发表**（它是 1987 年以来被反复研究的经典脆弱性，且 2025 年已有 USENIX Security 论文与真实 CVE 覆盖了"大响应第二片 + DNS"的利用路径）。**把它收窄成"测量 / 检测 / 缓解评估 / 可复现工件"四类之一的增量工作，则明确可发表**，但目标档位差异很大：

| 贡献类型 | 可发表性判断（现实档位） |
|---|---|
| (a) 新的分片+DNS 攻击 | **低**——顶会基本无望（2025 已被占位），且与用户"防御视角"目标冲突；不建议作为主线 |
| (b) 测量研究（现代解析器/中间盒、EDNS、RFC 9715、IPv4+IPv6） | **中—高**——PAM/TMA/IFIP Networking/ANRW 稳；IMC 需规模与新发现；顶会需强 delta |
| (c) 检测方法（解析器侧 eBPF / Zeek / Suricata / ML） | **中**——可发表，但必须跨过 **POPS（USENIX Sec 2025，摘要已点名可检 fragmentation attacks）** 与 **Iavich et al. 通用分片检测框架（Future Internet 2025/2026）** 两道门槛：卖点须是"DNS 语义感知 + 对抗性规避评估 + 数据面性能" |
| (d) 缓解评估（RFC 8900/9715 建议的量化权衡） | **中**——适合测量类 venue，需给出决策矩阵而非配置手册 |
| (e) 可复现测试床/工件 | **高（最现实的最小可发表版本）**——ANRW / TMA / 中文期刊 / 随论文 artifact |

**Q2：** 工具与方法**障碍可越过，且可复用性很高**：
- *诱导大响应*：EDNS(0) 缓冲区协商、大 RRset/TXT、DNSSEC 大签名、**后量子（PQ）签名/密钥**、多记录应答，现成解析器（BIND/Unbound/Knot/PowerDNS）即可触发，不需要攻击工具。
- *分片构造/注入*：Linux network namespace + `scapy` 原始套接字，隔离环境即可（见 `notes/lab-methods.md`）。
- *测量*：RIPE Atlas、DNS-OARC DITL、OpenINTEL 可复用数据/平台。
- *检测*：Zeek / Suricata / eBPF(XDP) 生态成熟，可在解析器侧挂载。
- **真正的障碍不是工具，而是 novelty 与规模**：PAM 2021、ICDCS 2021 poster、TNSM 2024 已经把"大 DNS 消息在网络上怎么坏"做了相当一部分；2025 年的 RFC 9715、USENIX Sec 两篇、PowerDNS CVE 又把"分片+DNS 的安全后果"抬高到新水位。**任何新工作必须在引言里用一句话同时说清与这些工作的差异。**

---

## 1. 可发表性判定框架（按贡献类型分档）

### 1.1 五维闸门（先自检，再谈 venue）

| 闸门 | 通过标准 | 最常见失败方式 |
|---|---|---|
| **新颖性** | 能用一句话说出"相对 2013/2020/2021/2024/2025 已知工作，多了什么"（新对象：IPv6/PQ/中间盒；新方法：eBPF；新证据：大规模测量；新工件） | "我们也发现了分片会出问题"——与 RFC 8900 (2020)、PAM 2021 重复 |
| **重要性** | 结论能影响真实部署（解析器厂商、CDN、运营商中间盒、IETF DNSOP） | 只在 lab 单机上成立，无法外推 |
| **严谨性** | 控制变量、可复现、统计功效（重复次数/置信区间）、样本设计说明 | 单次实验、无基线、无误差分析 |
| **工件** | 代码/数据/脚本开源，他人能一键复现核心图表（artifact evaluation 友好） | 只给论文不给代码；依赖私有环境 |
| **伦理/法律** | 隔离环境（RFC 5737/3849 文档地址、egress DROP）、不针对第三方网络、发现漏洞走协调披露 | 主动扫描未授权目标、给出可直接利用的攻击步骤 |

### 1.2 贡献类型 × 档位矩阵

> "三档"= ①顶会（S&P/CCS/USENIX Security/NDSS）；②二线或 workshop（PAM/TMA/IMC/DSN/CNS/ANRW/IFIP Networking）；③中文期刊。判定为**在该类型下、以 12 周~9 个月可完成的工作量为前提**的粗略可能性。

| 贡献类型 | ① 顶会 | ② 二线/workshop | ③ 中文期刊 | 关键门槛（不满足则降档/拒稿） |
|---|---|---|---|---|
| **(a) 新分片+DNS 攻击** | 极低 | 低—中 | 中（但伦理审查严） | 必须是**全新攻击面**（非 2013 投毒、非 2025 RUC 的复刻）；需大规模真实测量 + 厂商确认 + 协调披露记录。**不建议**：与用户防御目标冲突，且 2025 已占位 |
| **(b) 测量研究** | 低—中 | **高** | 高 | 规模（跨厂商/跨网络/双栈）+ 新维度（IPv6、PQ、RFC 9715 后）+ 可复现方法；只测实验室 6 台 resolver 只能到 workshop/短文 |
| **(c) 检测方法** | 低—中 | 中—高 | 高 | 真实或高质量半真实流量 + **误报率评估** + 性能开销；且须相对 POPS（2025）与 Iavich 2025/2026 有明确增量（DNS 语义 / 规避对抗 / 数据面）；只给规则不给评估会拒 |
| **(d) 缓解评估** | 低 | **中—高** | 高 | 攻击成功率 vs 正常解析性能的**权衡曲线/决策矩阵**；不能是 RFC 摘抄或配置手册 |
| **(e) 测试床/工件** | 极低（顶会不看纯工件） | **高**（ANRW/TMA/DSN artifact） | 高（软件学报等） | 真实被复用证据、文档、长期维护承诺；"能跑"不等于"可发表" |

**关键结论：** 用户想做的"防御视角（检测与缓解）"正好落在 (c)(d)(e) 这三类**最可行**的区间；不要往 (a) 走。

### 1.3 为什么"纯 idea"不够（评审会怎么问）

1. *"这和 Herzberg & Shulman 2013 / PAM 2021 / TNSM 2024 有什么不同？"* —— 必须回答分片+DNS 的**安全后果**与**网络行为**已被两代人研究过。
2. *"你的证据规模多大？"* —— 单机 netns 实验只能支撑短文/workshop；顶会测量论文通常需要跨网络、跨实现、双栈。
3. *"2025 年 RFC 9715 之后还值得测吗？"* —— 值得，但**必须**把"标准已给出建议、但落地效果未知"作为动机（这正是空白）。
4. *"你的工件的可复现性证据？"* —— 工件类论文需要他人成功复现的记录。
5. *"POPS、Iavich、FRAGJAM 都做过了，你的检测/测量增量在哪？"* —— 2025–2026 的检测与攻击侧工作已经把基线抬高（见 §0、§3 与 §7 新增引用）。

---

## 2. 可收窄选题卡片（T1–T6）

> 每张卡：暂定题目 / 创新点一句话 / 与已知工作的 delta / 最小可行实验 / 资源与周期 / 目标 venue + 备选 / 被抢发风险。
> 所有实验均在隔离环境（Linux VM / network namespace，RFC 5737/3849 文档地址，egress DROP），不涉及真实网络攻击。

### T1（必选主线）后量子 DNSSEC 大响应 × 双栈分片代价

- **暂定题目**：*When PQ Signatures Meet the Wire: Measuring Resolver Fragmentation and TCP Fallback under Post-Quantum DNSSEC (IPv4 vs IPv6)*
- **创新点（一句话）**：首个在**后量子签名导致的大响应**下，量化现代解析器"分片 vs 截断 vs DoTCP 回退"路径选择及其时延代价的**双栈**测量。
- **与已知工作的 delta**：ePrint 2024/1320 提出 QNAME-based fragmentation 的**协议方案**；WWW 2025 Companion 只讨论**安全考量**；IMC 2026 poster 只做 hybrid signature 的**真实世界评估（poster 体量）**——**均未覆盖 IPv6 与中间盒维度，也未量化 RFC 9715 之后的解析器行为**。
- **最小可行实验**：本地授权服务器（Knot/BIND）签发 PQ 大记录 → 5–6 款现代解析器（Unbound/BIND/Knot Resolver/PowerDNS Recursor/dnsdist 等，[具体版本以实验时官网为准]）→ nftables 构造 NAT44/NAT66 与分片策略 → 在 192.0.2.0/24 与 2001:db8::/32 下测量：分片发生率、重组成功率、TC/DoTCP 回退率、端到端时延、重传。
- **资源/周期**：1 名博士生主力 × 8–10 周实验 + 3–4 周写作；2 台 Linux VM（4–8 vCPU/16 GB）+ 本地 Apple Silicon 宿主做控制与抓包。
- **目标 venue + 备选**：TMA / PAM / IMC（full 需扩规模）；备选 ANRW、IFIP Networking、中文期刊。
- **被抢发风险**：**高**（PQ 是 2024–2027 热点，多个测量组在做；IMC 2026 poster 已同题邻近）。对策：抢先锁定"IPv6 + 中间盒 + RFC 9715 后行为"三角，并在 arXiv 预印本占位。

### T2 RFC 9715 落地效能测量

- **暂定题目**：*Avoiding the Avoidable: Measuring RFC 9715 Compliance in Open Resolvers and Authoritative Servers*
- **创新点（一句话）**：RFC 9715（2025-01，Informational）发布后，**首个**对开放解析器/权威服务器"避免分片"建议遵从度的测量。
- **delta**：TNSM 2024（数据约 2023 年）与 PAM 2021 测过 truncation/fragmentation 行为，但都在 RFC 9715 之前，且未回答"标准发布后有没有改善"；亦无"EDNS 缓冲区分布 + TC 位正确性 + DoTCP 回退"三联指标。
- **最小可行实验**：主动探测（自建测量点，仅对**已获许可/公开服务条款允许**的目标）+ DNS-OARC DITL 被动数据 + RIPE Atlas 探针；样本：热门域/TLD/开放解析器清单；指标：大 UDP 响应比例、分片比例、TC 正确率、DoTCP 回退成功率。
- **资源/周期**：2 人 × 6–8 周；主要成本是**伦理审批与目标许可**。
- **目标 venue + 备选**：IMC / PAM / TMA；备选 ANRW、中文期刊。
- **被抢发风险**：**中—高**（标准新、门槛低，最容易被测量组先做）。对策：尽早做、样本设计要有特色（IPv6 分层 + 中间盒 AS 级）。

### T3 IPv6 分片语义下的 DNS 大响应与中间盒行为

- **暂定题目**：*IPv6 Fragmentation Is Not IPv4: Measuring DNS Large-Response Handling Across IPv6 Middleboxes*
- **创新点（一句话）**：系统刻画 IPv6 分片（扩展头、仅首片含 UDP 头、无 IP 校验和、NAT66 状态）在 DNS 大响应场景下的**现代中间盒失败模式分类**。
- **delta**：PAM 2021 / TNSM 2024 / TMA 2026（IPv4 分片纵向测量）的实验主体都是 IPv4；FragEva6（LCN 2024）只做 IPv6 分片对 IDS 的规避、**不涉及 DNS**；因此"IPv6 + DNS + 分片的现代测量"在空白矩阵中几乎为空（见 §3，与 `lit-recent` G2 判断一致）。
- **最小可行实验**：netns 拓扑（客户端—中间盒—解析器—权威）+ nftables NAT66/防火墙策略矩阵 + Linux 内核 IPv6 分片行为；可选 OpenWrt VM（**目标环境需安装**，本机未装）；输出失败模式分类学 + 复现脚本。
- **资源/周期**：1 人 × 6–8 周；对已有 T1 测试床可直接复用（低成本增量）。
- **目标 venue + 备选**：TMA / PAM / ANRW / IFIP Networking；中文期刊。
- **被抢发风险**：**低—中**（IPv6 冷门），但审稿人可能质疑现实重要性——用 PQ/EDNS 增长趋势与 RFC 8900 的 IPv6 讨论作动机。

### T4 解析器侧 eBPF 分片异常检测 + 误报评估

- **暂定题目**：*Fragile by Design: eBPF-Based Detection of Malicious DNS Fragmentation at the Recursive Resolver*
- **创新点（一句话）**：在递归解析器侧用 XDP/eBPF 关联 IP 分片语义与 DNS 事务，检测"分片注入/异常大响应"，并给出**误报率与吞吐开销**评估。
- **delta**：POPS（USENIX Sec 2025）做缓存投毒检测/缓解、摘要点名 fragmentation attacks，但**没有公开的 DNS 语义级分片状态机**；Iavich et al.（Future Internet 2025/2026）是**通用**规则化分片异常检测（不 DNS-aware）；FragEva6（LCN 2024）是 IPv6 分片规避测试；Sensors 2025 的 DNS-Sensor 做投毒检测但非分片。**空白 = "DNS 语义感知（第二片/尾片 × RRSIG 结构 × TC 回退 × 重组状态机）的运行时检测 + 对抗性规避评估 + eBPF 数据面开销"**。
- **最小可行实验**：netns + 真实解析器 + 合成正常/异常流量（**防御性、无真实攻击步骤**）；eBPF 原型（XDP 或 tc）+ Zeek/Suricata 基线对比；指标 TPR/FPR/延迟/CPU。
- **资源/周期**：1–2 人 × 8–10 周；需 Linux 内核与 eBPF 经验。
- **目标 venue + 备选**：DSN（CCF-B）/ ANRW / 中文期刊；若规模与真实流量到位可冲 RAID 类。
- **被抢发风险**：**中**（eBPF 安全检测热，但 DNS 分片细分领域尚冷）。

### T5 缓解量化评估：RFC 8900 → RFC 9715 的权衡

- **暂定题目**：*Defense in Depth or Defense in Cost? Quantifying DNS Fragmentation Mitigations from RFC 8900 to RFC 9715*
- **创新点（一句话）**：把"减小 EDNS 缓冲区 / TC+TCP / 分片过滤 / DF 与 RSSI / IPv6 防火墙 / 解析器策略"等缓解放进**同一实验矩阵**，量化"防御收益 vs 正常解析代价"。
- **delta**：RFC 8900（BCP 230）与 RFC 9715 给建议但无量化对照；厂商文档分散且无横向比较；已有论文多为攻击侧。
- **最小可行实验**：复用 T1/T3 测试床；防御性场景 + DITL 回放作正常流量基线；输出**决策矩阵**（部署场景 × 缓解组合 × 成功率/时延/可用性）。
- **资源/周期**：1 人 × 6–8 周（依赖 T1 测试床）。
- **目标 venue + 备选**：TMA / PAM / ANRW / IFIP Networking；中文期刊。
- **被抢发风险**：**中**（易被写成配置手册；必须突出量化与决策矩阵）。

### T6 可复现测试床 + 开源工件（最小可发表版本）

- **暂定题目**：*DNSFragLab: A Reproducible Testbed for DNS Fragmentation Security Research*
- **创新点（一句话）**：一键部署的隔离测试床（netns/容器）+ 合法的大响应/分片生成器 + 检测评估 harness，让"分片+DNS"实验可复现。
- **delta**：现有论文（PAM 2021 / TNSM 2024）工件公开性 **[待核实]**；未见面向 DNS 分片安全的公开测试床与基准。
- **最小可行实验**：开源仓库 + 3 个标准场景脚本（大响应诱导、分片观察、检测评估）+ 与 6 款解析器的兼容矩阵 + 文档/CI。
- **资源/周期**：1 人 × 4–6 周；可与 T1/T4 并行。
- **目标 venue + 备选**：ANRW / TMA / DSN artifact；中文（软件学报/计算机研究与发展，等级 [待核实]）；亦可作为 T1/T4 的 artifact 附送。
- **被抢发风险**：**低**（工件类先发优势明显，但需要真实复用证据）。

---

## 3. 空白矩阵（1987 → 2026）

> "已做"列只写有可核查来源的工作（DOI/URL 见 §7）；"遗留空白"列与 §2 选题对应。

| 时间 | 代表工作（已核） | 已解决的问题 | 遗留空白 |
|---|---|---|---|
| **1987** | Kent & Mogul, *Fragmentation Considered Harmful*（SIGCOMM/CCR，DOI 10.1145/55483.55524） | 分片对性能/健壮性的系统性危害 | 安全语义、端点侧过滤、IPv6 |
| **1998** | Ptacek & Newsham, *Insertion, Evasion, and Denial of Service*（分片/重叠片绕过 IDS） | 分片可被用于 IDS 规避 | **现代高速检测（eBPF）与 DNS 语义关联** |
| **2013** | Herzberg & Shulman, *Fragmentation Considered Poisonous*（IEEE CNS 2013, DOI 10.1109/CNS.2013.6682711）；Gilad & Herzberg, *Fragmentation Considered Leaking*（ACNS 2014, DOI 10.1007/978-3-319-07536-5_31） | 分片 + DNS 缓存投毒/端口推断的**理论攻击面** | **IPv6、现代解析器与中间盒、大规模测量**（当时实验规模小） |
| **2020** | RFC 8900 / BCP 230, *IP Fragmentation Considered Fragile* | 工程界公认"分片不可靠"，给出建议 | **建议的量化落地效果未知**（无测量） |
| **2021** | PAM 2021, *Fragmentation, Truncation, and Timeouts*（DOI 10.1007/978-3-030-72582-2_27）；ICDCS 2021 poster, *Fragmentation Attacks on DNS over TCP*（DOI 10.1109/ICDCS51616.2021.00118） | 大 DNS 消息在网络中的实际行为；DoTCP 分片攻击可行性 | **IPv6、PQ、RFC 9715 前/后对比** 未覆盖 |
| **2024** | DNSBomb（IEEE S&P 2024, DOI 10.1109/SP54263.2024.00264）；ePrint 2024/1320（PQ DNSSEC over UDP via QNAME-based fragmentation）；TNSM 2024（DOI 10.1109/TNSM.2024.3365303）；Raavi et al. ICC 2024（PQ DNSSEC 分片 mis-association 威胁 + 防护）；FragEva6（LCN 2024，IPv6 分片绕过 IDS/IPS） | 大响应 DoS；PQ 大响应协议方案；truncation/fragmentation 测量；PQ 分片威胁建模；IPv6 规避 | **PQ 实际部署下的分片行为、DNS 专用 IPv6 测量、运行时分片检测/工件** |
| **2025** | RFC 9715（2025-01, Informational）；USENIX Sec 2025 *Your Shield is My Sword*（RUC, 含"大响应第二片"路径）；USENIX Sec 2025 *POPS*；WWW 2025 Companion（PQ DNSSEC 分片安全, DOI 10.1145/3701716.3715585）；CVE-2025-59024（PowerDNS Recursor） | 标准建议；大响应第二片可被利用；PQ 分片安全考量；真实 CVE | **RFC 9715 遵从度、误报评估、可复现工件** |
| **2026** | IMC 2026 poster（hybrid PQ DNSSEC 真实评估, DOI 10.1145/3777912.3847598）；IMC 2026 *Taming DNS Responses*（DOI 10.1145/3777912.3839801，大响应测量）；TMA 2026（IPv4 分片纵向测量, DOI 10.23919/TMA71232.2026.11695507）；**FRAGJAM**（Pan & Rossow, CISPA 2026, DOI 10.60882/cispa.32770800，伪造 ICMP Frag Needed + 分片重组拥塞 DoS）；CCF 第七版目录发布（官网文本）；CVE-2025-59024 NVD 发布（2026-02） | PQ 签名真实性能评估（poster 体量）；大响应测量；IPv4 分片流量基线；攻击侧推进到"ICMP/重组拥塞" | **DNS 语义级检测、IPv6、双栈大规模测量、工件复用（2026 仍空）** |

**空白 × 可行性速览（本文档最核心的 8 个空白项）：**

| 空白项 | 现有证据 | 可做性 | 主要风险 |
|---|---|---|---|
| IPv6 分片 + DNS | 几乎空白（PAM 2021/TNSM 2024/TMA 2026 以 IPv4 为主；FragEva6 不测 DNS） | 高（可复用 T1 测试床） | 审稿人质疑现实重要性 |
| 现代解析器与中间盒 | 部分（TNSM 2024，2023 数据） | 高 | 实现版本更新快，需锁定版本 |
| RFC 9715 落地效能 | 空白（标准 2025 才出；`lit-recent` G4） | 高 | 被测量组抢发；扫描伦理 |
| eBPF/DNS 语义检测 | 空白（POPS 做投毒检测非分片语义；Iavich 非 DNS-aware） | 中—高 | 需要内核经验 + 误报评估 |
| PQ DNSSEC 大响应/分片 | 协议方案 + poster + 威胁建模（Raavi 2024）；**无系统测量、无运行时检测** | 高（2024–2026 窗口） | **抢发风险最高** |
| 大规模测量 | TNSM 2024/PAM 2021 有限规模 | 中 | 伦理审批、平台资源 |
| 测试床/工件 | **[待核实]** 未见公开专用测试床 | 高 | 工件复用证据 |
| 检测误报评估 | 基本空白 | 中—高 | 需要真实/半真实流量与标注 |

---

## 4. 投稿策略表

> **周期列不写具体截稿日期**（写作时点无法保证准确，且用户要求不编造）。一律以各 venue 官网 "Call for Papers" 为准。CCF 等级按 **CCF 官网当前目录（第七版，官网页面文本可见 2026 年发布信息）** 实测，访问日期 2026-10-22；无法核实者标 [待核实]。**Short paper / poster / workshop 论文不计入 CCF 目录推荐范围**（CCF 官网说明）。

### 4.1 顶会（CCF-A，网络与信息安全）

| Venue | CCF | 适配贡献 | 周期/节奏（以官网为准） | 关键门槛/风险 |
|---|---|---|---|---|
| **IEEE S&P** | A（NIS，已核） | (a)(c)(b) 大规模 | 多轮提交（以官网为准） | 需要顶会级新攻击面或大规模测量；伦理与披露要求高 |
| **ACM CCS** | A（NIS，已核） | (a)(c) | 一年一轮（以官网为准） | 同上；对测量类相对友好但竞争激烈 |
| **USENIX Security** | A（NIS，已核） | (a)(b)(c) | 多轮（以官网为准） | 2025 已发 RUC/POPS，同题须明确 delta |
| **NDSS** | A（NIS，已核） | (a)(c) | 多轮（以官网为准） | 需要真实部署影响与厂商确认 |

### 4.2 测量类（最匹配本课题）

| Venue | CCF（实测） | 适配贡献 | 周期/节奏 | 关键门槛 |
|---|---|---|---|---|
| **IMC** | **B（计算机网络，已核）** | (b) 大规模测量 | 一年一轮，以官网为准 | 规模 + 新维度；poster 另设（不计 CCF） |
| **PAM** | **C（网络与信息安全，已核）** | (b)(d) 测量/评估 | 一年一轮，以官网为准 | 测量方法严谨性；短文/海报以官网为准 |
| **TMA** | **不在 CCF 目录（已核 CN/NIS 页面未见）** | (b)(d)(e) | 一年一轮，以官网为准 | 测量方法 + 可复现；社区认可度好但 CCF 不计 |
| **IFIP Networking** | **C（计算机网络，已核）** | (b)(d)(e) 短文 | 一年一轮，以官网为准 | 门槛低于 IMC/PAM，适合首篇 |

### 4.3 二线 / workshop / 安全专门会议

| Venue | CCF（实测） | 适配贡献 | 周期/节奏 | 备注 |
|---|---|---|---|---|
| **DSN** | **B（网络与信息安全，已核）** | (c) 检测/可靠性 | 多轮（以官网为准） | 适合检测与缓解评估；有 artifact 传统（以官网为准） |
| **ANRW**（IRTF） | **不在 CCF 目录（已核）** | (e) 工件、(b) 早期测量 | 一年一次（以官网为准） | **最适合"最小可发表版本"**；6 页级短文（以官网为准） |
| **IEEE CNS** | **不在 CCF 目录（已核 NIS 页面未见）** | (a)(c) 安全专门 | 一年一轮，以官网为准 | 2013 年 Herzberg 论文即发于此；门槛中等 |
| **RAID** | **B（NIS，已核）** | (c) 检测 | 多轮（以官网为准） | 检测类对口，需真实流量 |

### 4.4 中文期刊

| 期刊 | CCF 中文等级 | 适配贡献 | 周期 | 备注 |
|---|---|---|---|---|
| 计算机学报（cjc.ict.ac.cn） | **[待核实]** | (b)(c)(d) | 以官网为准 | 国内顶刊，要求强创新 |
| 软件学报（jos.org.cn） | **[待核实]** | (e) 系统/工件、(c) | 以官网为准 | 系统与工具类友好 |
| 计算机研究与发展（crad.ict.ac.cn） | **[待核实]** | (b)(c) | 以官网为准 | 综述/测量均可 |
| 通信学报（joconline.com.cn） | **[待核实]** | (b)(d) | 以官网为准 | 网络测量对口 |
| 网络与信息安全学报（cjnis.com.cn） | **[待核实]** | (a)(c)(d) | 以官网为准 | 安全专门，门槛相对低 |
| 信息安全学报（jcs.iie.ac.cn） | **[待核实]** | (a)(c)(d) | 以官网为准 | 安全专门 |

> 中文期刊等级请以 CCF 官方"推荐中文科技期刊目录/高质量科技期刊分级目录"为准（本次未逐条核实，故全部标 [待核实]，不写分区/影响因子）。

---

## 5. 12 周执行计划与资源估算

> 默认路线：**T1（主线）+ T6（工件）**，兼顾 T3/T4 增量。周为自然周；里程碑必须可交付（脚本/数据/图表/文稿）。

| 周 | 工作内容 | 里程碑/交付物 | 风险与应对 |
|---|---|---|---|
| W1 | 精读 2013/2020/2021/2024/2025 关键工作，写"差异化矩阵"；锁定 1 个主选题与贡献声明 | 1 页 contribution statement + delta 表 | 发现撞车 → 立即换维度（IPv6/中间盒/工件） |
| W2 | 搭隔离测试床：Linux VM + netns + 6 款解析器 + 抓包 | 可复现的环境部署脚本 v0.1 | 环境依赖失败 → 固定版本、容器化 |
| W3 | 大响应诱导矩阵（EDNS buffer、大 RRset、DNSSEC、PQ 签名、IPv4/IPv6） | 大响应/分片触发矩阵表 | 本机未安装 docker/pdftotext（Lead 已实测）→ 目标环境需先装 Linux VM/工具链 |
| W4 | 分片观测与安全边界审计（合法构造、隔离、egress DROP） | 实验安全 checklist + 数据采集脚本 | 伦理风险 → 提前做机构审查预沟通 |
| W5 | 现代解析器矩阵实验（版本锁定） | 第一批数据（IPv4） | 结果不显著 → 扩样本/换指标 |
| W6 | 中间盒矩阵（nftables NAT44/NAT66、分片策略） | 中间盒行为分类表 | 配置复杂 → 限定 3 类策略 |
| W7 | IPv6 实验 + 重复实验（统计功效） | 双栈对比初稿图表 | 时间紧 → 砍 IPv6 范围到 2 类中间盒 |
| W8 | 检测原型（若走 T4）或 RFC 9715 遵从度采样（若走 T2） | 原型/采样结果 | 误报高 → 调整特征、报告负结果 |
| W9 | 数据分析、统计检验、图表定稿 | 全部图表 + 方法节草稿 | 数据不足 → 补实验，但不超过 1 周 |
| W10 | 写作（方法/实验/结果），内部评审 | 全文 v1 | 写作拖延 → 先写方法与威胁模型 |
| W11 | 伦理与披露审查、工件打包（README/CI/许可证） | 工件 v1 + 披露记录 | 工件不可复现 → 换干净环境验证 |
| W12 | 定稿、选 venue、arXiv 预印本、投稿 | 投稿包 + 预印本 | 被抢发 → 预印本占位；备选 venue 切换 |

**资源估算：**

| 类别 | 估算 | 说明 |
|---|---|---|
| 人力 | 1 名博士生主力（~30 h/周）+ 1 名导师/合作者评审（~3 h/周）；可选 1 名硕士做数据标注 | 12 周 ≈ 0.3–0.5 人年 |
| 机器 | 2 台 Linux VM（4–8 vCPU / 16 GB / 100 GB）+ 本地 Apple Silicon 宿主做控制与抓包；**全部隔离、无默认路由、egress DROP** | 若用云主机，仅作隔离实验网，不接生产网络 |
| 软件 | BIND/Unbound/Knot Resolver/PowerDNS Recursor/dnsdist、scapy、tcpdump/tshark、Zeek/Suricata、eBPF 工具链（目标环境需安装） | 本机未安装 docker/pandoc 等，标注为前置条件 |
| 数据 | 实验室合成流量 + 公开数据（RIPE Atlas、DNS-OARC DITL、OpenINTEL，见 §7） | 主动探测须获许可/遵守服务条款 |
| 伦理 | 机构伦理审查（若涉及扫描）、协调披露（常见 90 天，**以厂商/CERT 政策为准**）、不公开可直接利用细节 | 见 Lead 情报 §3 安全边界 |
| 预算 | 无大额硬件；主要为人力与会议差旅（若投稿顶会） | 不写具体金额（避免臆造） |

---

## 6. 结论

### 6.1 为什么"原样 idea"不足以发表

1. **太宽**：把"分片"与"DNS"并列，等于覆盖 1987 年以来的网络层脆弱性 + DNS 协议安全两大经典问题，无法在一个贡献里说清 novelty。
2. **经典问题**：分片脆弱性有 RFC 8900（BCP 230, 2020）背书；分片+DNS 投毒有 2013/2014 两篇；大消息网络行为有 PAM 2021/TNSM 2024；**2025 年 RFC 9715 专门针对 DNS over UDP 分片给出建议**——"提出问题"本身已不新。
3. **规模不足**：单机/单网络实验无法支撑顶会测量论文；审稿人默认要求跨实现、跨网络、双栈、可复现。
4. **伦理**：攻击向工作（构造伪造分片投毒/DoS）与用户"防御视角"目标冲突，且 2025 年已有论文与 CVE 占位，再做攻击复刻既无新意又有风险。
5. **被占位**：USENIX Sec 2025 *Your Shield is My Sword*（大响应第二片路径）、CVE-2025-59024（PowerDNS Recursor 分片投毒）、POPS（DNS 投毒史与缓解）已经把"分片+DNS 的后果"抬到新水位；**新工作必须在引言第一段就与这些工作划清界限**。
6. **2026 年攻击侧仍在推进**：FRAGJAM（Pan & Rossow, CISPA 2026）把"伪造 ICMP Frag Needed + 分片重组拥塞"做成对真实 UDP 服务的 DoS；IMC 2026 *Taming DNS Responses* 与 TMA 2026 已产出大响应测量与 IPv4 分片纵向基线。**"伪造分片"不能声称首次**，只能限定在 DNS 解析器/响应语义层面。

### 6.2 最推荐的 2–3 条路径（含最小可发表版本）

**路径 P1（推荐主线，4–6 个月）：PQ DNSSEC 大响应 × 双栈测量**
- 做法：T1 为主线，T3（IPv6）与 T2（RFC 9715 遵从度）作为增量章节。
- **最小可发表版本**：TMA/PAM/ANRW/IFIP Networking 的短文（页数/格式以官网为准）——只需"6 款解析器 + 4 类中间盒 + IPv4/IPv6 + PQ 大响应"的扎实矩阵，即可支撑 6–10 页。
- 升级路径：扩展为跨网络规模后投 IMC（CCF-B）。
- 需要补的增量工作：版本矩阵与可复现脚本、统计功效、与 ePrint 2024/1320 / WWW 2025 / IMC 2026 poster 的明确 delta、预印本占位。

**路径 P2（工程向，4–6 个月）：DNS 语义感知的分片检测器 + 开源工件**
- 做法：T4（DNS 语义级分片状态机检测 + 对抗性规避评估 + eBPF 数据面开销）+ T6 工件。**与 `lit-recent` G1/G5 判断一致：这是 2025–2027 最可能被接受、也最可能被抢发的方向**。
- **最小可发表版本**：ANRW 短文 + 开源仓库（artifact）；或中文期刊（网络与信息安全学报/信息安全学报，等级 [待核实]）。
- 升级路径：T4 做扎实（POPS/Suricata/Snort 基线 + FPR + 吞吐）后投 DSN（CCF-B）或 RAID。

**路径 P3（中文快速通道，2–3 个月）：中文综述/测量短文**
- 做法：以 §3 空白矩阵为骨架写中文综述 + 一个小规模复现实验，投通信学报/计算机研究与发展/网络与信息安全学报（等级 [待核实]）。
- **最小可发表版本**：综述 + 复现实验；适合先建立发表记录、再转英文测量论文。
- 风险：创新性要求低于英文顶会，但需避免"翻译式综述"。

### 6.3 必需补齐的增量工作（清单）

- [ ] 与 2013–2026 工作的**逐条 delta 表**（放引言/相关工作）。
- [ ] **双栈**（IPv4+IPv6）与**现代中间盒**（NAT44/NAT66/分片策略）实验矩阵。
- [ ] **PQ DNSSEC** 大响应场景（这是 2024–2026 唯一确定的新窗口）。
- [ ] **RFC 9715 后**的遵从度/效能测量（标准新，空白明确）。
- [ ] 检测类必须有**误报率与性能开销**；工件类必须有**复用证据**。
- [ ] 隔离环境安全边界 + 协调披露流程（防御性研究合规）。
- [ ] 必引并与以下 2025–2026 工作逐条对比：POPS（检测含 fragmentation attacks）、Iavich et al.（通用分片检测）、FragEva6（IPv6 规避）、FRAGJAM（2026，伪造 ICMP/重组拥塞）、RUC（第二片 RRSIG）、TMA 2026 / IMC 2026 *Taming DNS Responses*（测量基线）、Raavi ICC 2024（PQ 分片 mis-association）。
- [ ] 预印本（arXiv）占位，降低抢发风险。

---

## 7. 引用与链接（真实可核查，访问日期 2026-10-22）

### 7.1 标准 / RFC

1. RFC 9715, *IP Fragmentation Avoidance in DNS over UDP*, K. Fujiwara, P. Vixie, 2025-01, Informational, 13 页. https://www.rfc-editor.org/rfc/rfc9715.txt （已实测正文，Category: Informational）
2. RFC 8900 / BCP 230, *IP Fragmentation Considered Fragile*, 2020-09. https://www.rfc-editor.org/rfc/rfc8900.txt
3. RFC 6864, *Updated Specification of the IPv4 ID Field*, 2013. https://www.rfc-editor.org/rfc/rfc6864.txt
4. NIST FIPS 204, *Module-Lattice-Based Digital Signature Standard*（ML-DSA）. https://csrc.nist.gov/pubs/fips/204/final

### 7.2 代表论文（DOI 已核）

5. Kent & Mogul, *Fragmentation Considered Harmful*, ACM SIGCOMM CCR, 1987. https://doi.org/10.1145/55483.55524
6. Ptacek & Newsham, *Insertion, Evasion, and Denial of Service: Eluding Network Intrusion Detection*, 1998. https://insecure.org/stf/secnet_ids/secnet_ids.html
7. Herzberg & Shulman, *Fragmentation Considered Poisonous, or: One-domain-to-rule-them-all.org*, IEEE CNS 2013. https://doi.org/10.1109/CNS.2013.6682711
8. Gilad & Herzberg, *Fragmentation Considered Leaking: Port Inference for DNS Poisoning*, ACNS 2014 (LNCS). https://doi.org/10.1007/978-3-319-07536-5_31
9. Moura, Müller, Davids, Wullink, Hesselman, *Fragmentation, Truncation, and Timeouts: Are Large DNS Messages Falling to Bits?*, PAM 2021. https://doi.org/10.1007/978-3-030-72582-2_27
10. Dai, Shulman, Waidner, *Poster: Fragmentation Attacks on DNS over TCP*, IEEE ICDCS 2021. https://doi.org/10.1109/ICDCS51616.2021.00118
11. Dikshit, Kosek, Faulhaber, Sengupta, Bajpai, *Evaluating DNS Resiliency and Responsiveness With Truncation, Fragmentation & DoTCP Fallback*, IEEE TNSM（Crossref 记录 2026；arXiv 2023）. https://doi.org/10.1109/TNSM.2024.3365303
12. arXiv:2307.06131（同上前身/预印本）. https://arxiv.org/abs/2307.06131
13. *DNSBomb: A New Practical-and-Powerful Pulsing DoS Attack Exploiting DNS Queries-and-Responses*, IEEE S&P 2024. https://doi.org/10.1109/SP54263.2024.00264
14. Zhang, Wang, Chen, Li, Liu, *Your Shield is My Sword: A Persistent Denial-of-Service Attack via the Reuse of Unvalidated Caches in DNSSEC Validation*, USENIX Security 2025. https://www.usenix.org/conference/usenixsecurity25/presentation/zhang-shuhan （论文含"大响应第二片"路径，Lead 已核 PDF）
15. *POPS: From History to Mitigation of DNS Cache Poisoning Attacks*, USENIX Security 2025（arXiv:2501.13540）. https://doi.org/10.48550/arXiv.2501.13540
16. Rawat & Jhanwar, *Post-Quantum DNSSEC over UDP via QNAME-Based Fragmentation*, Cryptology ePrint 2024/1320. https://eprint.iacr.org/2024/1320
17. McGowan, Liu, Ruj, *Security Considerations for Post-Quantum Signatures in DNSSEC via Request-Based Fragmentation*, WWW 2025 Companion. https://doi.org/10.1145/3701716.3715585
18. Heikamp, Shah, Teh, Baig, Doss, Liu, Armstrong, *Poster: Hybrid Signatures for Post-Quantum DNSSEC: A Real-World Evaluation*, IMC 2026（Crossref 记录 2026-10-12）. https://doi.org/10.1145/3777912.3847598
19. *DNS-Sensor: A Sensor-Driven Architecture for Real-Time DNS Cache Poisoning Detection and Mitigation*, Sensors 2025. https://doi.org/10.3390/s25226884

> **以下 19a–19f 为 2025–2026 年新增竞争工作，元数据由 `lit-recent.md`（v1.1）核对，本文档未重复核 DOI；投稿引用前请 Lead 复核。**
19a. Afek, Berger, Bremler-Barr, *POPS: From History to Mitigation of DNS Cache Poisoning Attacks*, USENIX Security 2025. https://www.usenix.org/conference/usenixsecurity25/presentation/afek
19b. Raavi, Wuthier, Chang, *Securing Post-Quantum DNSSEC Against Fragmentation Mis-Association Threat*, IEEE ICC 2024. https://doi.org/10.1109/ICC51166.2024.10622607
19c. Iavich et al., *A Deterministic, Rule-Based Framework for Detecting Anomalous IP Packet Fragmentation*, Future Internet 2025/2026. https://doi.org/10.3390/fi18010019
19d. Pan & Rossow, *FRAGJAM: DoS Attacks Using IP Reassembly Congestion*, CISPA 2026. https://doi.org/10.60882/cispa.32770800
19e. *Taming DNS Responses*（大响应测量）, ACM IMC 2026. https://doi.org/10.1145/3777912.3839801
19f. IPv4 分片纵向测量, TMA 2026. https://doi.org/10.23919/TMA71232.2026.11695507
19g. FragEva6（IPv6 分片绕过 IDS/IPS）, IEEE LCN 2024 — DOI **[待核实]**（元数据见 `lit-recent.md` R23）

### 7.3 漏洞 / 厂商

20. CVE-2025-59024（PowerDNS Recursor，CVSS 3.1 6.5 MEDIUM，NVD 发布 2026-02-09）. https://nvd.nist.gov/vuln/detail/CVE-2025-59024
21. PowerDNS advisory 2025-06. https://docs.powerdns.com/recursor/security-advisories/powerdns-advisory-2025-06.html

### 7.4 CCF 目录与 venue 官网（均已实测可访问）

22. CCF 推荐国际学术刊物目录（第七版，官网页面）. https://www.ccf.org.cn/Academic_Evaluation/By_category/
23. CCF 网络与信息安全分类页（实测：CCS/S&P/USENIX Security/NDSS 为 A 类；DSN 为 B 类；PAM 为 C 类）. https://www.ccf.org.cn/Academic_Evaluation/NIS/
24. CCF 计算机网络分类页（实测：IMC 为 B 类；IFIP Networking 为 C 类；TNSM 为 C 类期刊）. https://www.ccf.org.cn/Academic_Evaluation/CN/
25. IEEE S&P 2026. https://sp2026.ieee-security.org/ ；系列页 https://www.ieee-security.org/TC/SP-Index.html
26. ACM CCS 2026. https://www.sigsac.org/ccs/CCS2026/
27. USENIX Security 2026. https://www.usenix.org/conference/usenixsecurity26
28. NDSS. https://www.ndss-symposium.org/
29. ACM IMC 2026. https://conferences.sigcomm.org/imc/2026/
30. DSN 2026. https://dsn2026.github.io/
31. IEEE CNS 2026. https://cns2026.ieee-cns.org/
32. IRTF ANRW. https://www.irtf.org/anrw/ ；ANRW 2026. https://irtf.org/anrw/2026/
33. IFIP Networking 系列. https://networking.ifip.org/

### 7.5 中文期刊官网（已实测可访问）

34. 计算机学报. http://cjc.ict.ac.cn/
35. 软件学报. https://www.jos.org.cn/
36. 通信学报. http://www.joconline.com.cn/
37. 计算机研究与发展. https://crad.ict.ac.cn/
38. 网络与信息安全学报. http://www.cjnis.com.cn/
39. 信息安全学报. http://jcs.iie.ac.cn/

### 7.6 可复用工具 / 数据源

40. Scapy（分片/报文构造）. https://scapy.net/
41. Zeek（DNS/分片事件分析）. https://zeek.org/
42. Suricata（IDS 规则基线）. https://suricata.io/
43. eBPF 项目（XDP/tc 检测原型）. https://ebpf.io/
44. RIPE Atlas（分布式测量）. https://atlas.ripe.net/
45. DNS-OARC DITL（被动 DNS 数据）. https://www.dns-oarc.net/oarc/data/ditl
46. OpenINTEL（大规模 DNS 测量数据）. https://openintel.nl/
47. ISC BIND. https://www.isc.org/bind/
48. NLnet Labs Unbound. https://nlnetlabs.nl/projects/unbound/about/
49. Knot Resolver. https://www.knot-resolver.cz/
50. PowerDNS Recursor 文档. https://docs.powerdns.com/recursor/

---

### 附：本次核实时效与未核实清单

- **已实测**（2026-10-22）：RFC 9715 正文与分类、CCF 第七版目录分类页（CN/NIS）、10+ 篇关键论文的 DOI/元数据（Crossref/OpenAlex）、CVE-2025-59024 与 PowerDNS 页面（Lead 已核）、所有列出的 venue/期刊官网 HTTP 200（PAM 官网 `pamconf.org` 返回 403，属反爬限制，链接本身存在但未获正文）。本次未使用 `web_fetch`（沙箱拦截），全部来源经 bash `curl` 获取。
- **[待核实]**：TMA 官网（未找到可用站点，CCF 目录已确认不在榜）；中文期刊 CCF 中文等级；各 venue 的截稿日期/页数限制/录用率（按要求不写）；PAM 2021/TNSM 2024 工件公开性；arXiv:2307.06131 与 TNSM 版本的对应关系（OpenAlex 元数据显示为同一工作，未读全文）。
- **与 `lit-recent.md`（v1.1）交叉核对**：其记录的 2025–2026 新增竞争工作（POPS 作者/摘要细节、Raavi ICC 2024、Iavich Future Internet、FragEva6、FRAGJAM、TMA 2026、IMC 2026 *Taming DNS Responses*、TON 2026 等）已吸收进 §0/§1/§3/§6/§7；这些 DOI 的核对由 res-lit-recent 完成，本文档标为"转引/未重复核"，投稿引用前需 Lead 复核。
- **禁止事项提醒**：本文不给出任何针对真实解析器/第三方网络的攻击操作步骤；所有实验方案均限定隔离环境（RFC 5737/3849 文档地址、egress DROP）。
