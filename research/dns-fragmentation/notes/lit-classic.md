# 经典/基础文献（1987–2021）：IP 分片与 DNS 安全

> 子智能体：`lit-classic`｜最后更新：2026-10-22｜状态：已完成（第 1 版）
> 每条格式：**标题** — 作者 — venue/year — DOI/URL — 摘要（3–5 句）— 与 DNS 分片主题相关性 — 可复用方法/工件。
> 证据纪律：除特别标注外，标题/作者/venue/DOI 均经 curl + Crossref/OpenAlex/S2/Springer/USENIX/RFC Editor 实际返回核实；仅读到摘要者标 **[摘要级]**，未能读全文者标 **[待核实]**。
> 关键更正（相对 `lead-intel.md` 第 4 条）："Fragmentation Considered Leaking: Port Inference for DNS Poisoning"（ACNS 2014, DOI 10.1007/978-3-319-07536-5_31）的作者是 **Haya Shulman & Michael Waidner**，不是 Gilad & Herzberg —— Springer 官方章页、Crossref、Semantic Scholar、OpenAlex 四处一致。**Gilad & Herzberg 的分片论文实际是 "Fragmentation Considered Vulnerable: Blindly Intercepting and Discarding Fragments"（USENIX WOOT 2011）**，见 §2.9。

## 0. 阅读导航

本文件把"DNS 分片安全"的谱系拆成三条互相咬合的线：
1. **IP 分片本身为什么危险**（1987–2020）：Kent & Mogul 的性能论证 → teardrop / ping-of-death / tiny-fragment 的实现与过滤规避 → Ptacek-Newsham 的重组策略差异模型 → RFC 1858/3128/5722/6980/7739/8900 的标准化收口。
2. **DNS 分片攻击主线**（2013–2021）：Herzberg & Shulman 2013 把"长 UDP 响应必然分片"变成 off-path 投毒载体 → Shulman & Waidner 2014 端口推断补上最后 16 bit → USENIX Sec 2020 把攻击面推到 DNS forwarder → PAM 2021 用 1640 亿查询测量"分片在真实世界到底多常见"。
3. **标准与实现的防御闭环**（2013–2025）：EDNS(0) 尺寸协商（RFC 6891）→ DNS Flag Day 2020（1232 字节）→ TCP 兜底（RFC 7766/9210）→ DNS Cookies（RFC 7873）→ BCP 230（RFC 8900）→ RFC 9715 明确"避免分片 + 丢弃分片响应"的操作建议。

**给 Lead 的一句话结论**：截至 2021 年，"DNS 大响应 → IP 分片 → off-path 投毒"这条攻击链已被 2013/2014/2020 三篇论文 + 2018–2021 侧信道系列打透；但"**防御视角的检测/测量/实现差异系统化**"只有零星工作（Ptacek-Newsham 1998 的 OS 差异表、RFC 8900 的原则性描述、PAM 2021 的 TLD 级测量），这正是用户构想最可能站住的缝隙（最终判定归 `novelty-venues`）。

## 1. 时间线表

| 年份 | 事件 | 类型 | 本文件条目 |
|---|---|---|---|
| 1981 | RFC 791：IPv4 分片字段（Identification/FO/MF） | 标准 | §4 |
| 1987-08 | Kent & Mogul《Fragmentation Considered Harmful》（SIGCOMM'87 workshop / CCR 17(5)；DEC WRL TR TN-87-2） | 论文 | 2.1 |
| 1989-04 | Bellovin《Security Problems in the TCP/IP Protocol Suite》（CCR） | 论文 | 2.2 |
| 1995-10 | RFC 1858：tiny fragment / overlapping fragment 攻击与过滤对策 | 标准(Informational) | 2.5 |
| 1996-12 | CVE-1999-0128 "Ping o' Death"（超大 ICMP ping 导致 DoS） | 实现漏洞 | 2.4 |
| 1997-12 | CVE-1999-0015 teardrop、CVE-1999-0104 Teardrop-2 | 实现漏洞 | 2.3 |
| 1998-01 | Ptacek & Newsham《Insertion, Evasion, and Denial of Service》 | 技术报告 | 2.6 |
| 1998-02/04 | CVE-1999-0258 Bonk、CVE-1999-0257 Nestea（teardrop 变种） | 实现漏洞 | 2.3 |
| 2001-06 | RFC 3128：RFC 1858 "Indirect Method" 的绕过变种 | 标准(Informational) | 2.5 |
| 2009-12 | RFC 5722：IPv6 重叠分片 MUST 整包静默丢弃 | 标准(Track) | §4 |
| 2011 | Gilad & Herzberg《Fragmentation Considered Vulnerable: Blindly Intercepting and Discarding Fragments》（USENIX WOOT 2011） | 论文 | 2.9 |
| 2013-04 | RFC 6891 EDNS(0)：请求者/响应者 payload size 协商 | 标准(STD 75) | §4 |
| 2013-08 | RFC 6980：ND 消息禁止 IPv6 分片头 | 标准(Track) | §4 |
| 2013 | Herzberg & Shulman《Fragmentation Considered Poisonous…》（IEEE CNS 2013） | 论文 | 3.1 |
| 2013-10 | Hlavacek《IP fragmentation attack on DNS》（RIPE 67） | 会议演讲 | 2.7 |
| 2014 | Shulman & Waidner《Fragmentation Considered Leaking: Port Inference for DNS Poisoning》（ACNS 2014） | 论文 | 3.2 |
| 2016-02 | RFC 7739：可预测 IPv6 Fragment ID 的安全影响 | 标准(Informational) | §4 |
| 2016-03 | RFC 7766：DNS-over-TCP 实现要求 | 标准(Track) | §4 |
| 2016-05 | RFC 7873：DNS Cookies | 标准(Track) | §4 |
| 2017-03 | RFC 8085（BCP 145）：UDP 应用不应产生超过 MTU 的包 | 标准(BCP) | §4 |
| 2017-07 | RFC 8200：IPv6 规范（STD 86） | 标准 | §4 |
| 2018-09 | CVE-2018-5391 FragmentSmack（Linux 3.9+ IP 重组 DoS，CVSS 7.5） | 实现漏洞 | 5.1 |
| 2018 | Göring/Shulman/Waidner《Path MTU Discovery Considered Harmful》（ICDCS） | 论文 | 3.3 |
| 2018 | Brandt et al.《Domain Validation++ For MitM-Resilient PKI》（CCS） | 论文 | 3.3 |
| 2019-01 | RFC 8482：ANY 查询最小化响应 | 标准(Track) | §4 |
| 2020-09 | RFC 8900（BCP 230）《IP Fragmentation Considered Fragile》 | 标准(BCP) | 2.8 / §4 |
| 2020-08 | USENIX Sec 2020《Poison Over Troubled Forwarders》 | 论文 | 3.4 |
| 2020-10-01 | **DNS Flag Day 2020**（1232 字节 EDNS buffer + TCP 兜底） | 工程行动 | 4.14 |
| 2020-11 | CCS 2020《DNS Cache Poisoning Attack Reloaded》 | 论文 | 3.3 |
| 2021 | PAM 2021《Fragmentation, Truncation, and Timeouts…》 | 论文 | 3.5 |
| 2021-11 | CCS 2021《DNS Cache Poisoning Attack: Resurrections with Side Channels》 | 论文 | 3.3 |
| 2021 | ANRW 2021《DNS-over-TCP considered vulnerable》 | 论文 | 3.3 |
| 2022-03 | RFC 9210（BCP 235）：DNS-over-TCP 运营要求（超出 2021 主窗，作闭环参考） | 标准(BCP) | §4 |
| 2025-01 | RFC 9715《IP Fragmentation Avoidance in DNS over UDP》（Informational） | 标准(Informational) | 4.15 |

## 2. IP 分片基础与早期攻击（1987–2016）

### 2.1 Fragmentation Considered Harmful — Christopher A. Kent, Jeffrey C. Mogul — ACM SIGCOMM'87 Workshop (Proc. "Frontiers in Computer Communications Technology"), 1987-08；期刊版 ACM SIGCOMM CCR 17(5)；技术报告版 DEC WRL TN-87-2（1987-12）— DOI: 10.1145/55482.55524（workshop）/ 10.1145/55483.55524（CCR）
- **摘要（3–5 句）**：该文系统论证 IP 分片对端到端性能与可靠性是净损失：分片与重组消耗路由器/主机资源、任一分片丢失会导致整包重传（丢失放大）、分片还会干扰 MTU/路径发现与应用层报文设计。作者主张让应用与传输层主动控制报文尺寸（MSS/应用级分段）以尽量避免 IP 层分片，并讨论分片在异构链路下的工程代价。
- **相关性**：这是"避免分片"工程共识的源头；RFC 8900（BCP 230）与 RFC 9715 的立论（分片脆弱、应避免）都可视为其 30 年后的标准形式化。对用户构想的意义：**"分片本身有害"不是新发现**，任何新工作必须落在"DNS 场景下的具体弱点/检测/缓解"而非泛泛重述。
- **可复用方法/工件**：论证框架（分片成本模型：重组开销、丢失放大、MTU 依赖）；引用它可作为报告开篇的历史锚点。
- **证据等级**：[待核实] WRL TN-87-2 报告版本的在线 URL 未能核实（`hpl.hp.com/techreports/Compaq-DEC/WRL-TN-87-2.pdf` 已失效，Wayback 无快照）；DOI 与作者/venue 由 Crossref 核实（两条 DOI 均返回 Kent & Mogul, 1987-08）。正文措辞为摘要级转述，未读全文。

### 2.2 Security Problems in the TCP/IP Protocol Suite — Steven M. Bellovin — ACM SIGCOMM Computer Communication Review, 1989-04 — DOI: 10.1145/378444.378449
- **摘要（3–5 句）**：TCP/IP 协议族经典安全综述，系统整理了地址伪造、序列号预测、路由与 ICMP 相关攻击等"协议设计时未考虑对抗"的问题集。它确立了 **off-path 攻击者**（看不到报文、靠猜测/时序注入）这一威胁模型，后来被 DNS 缓存投毒研究直接继承。
- **相关性**：为 Herzberg & Shulman 2013 / 侧信道系列提供威胁模型谱系；本身不专门讨论 DNS 分片（正文细节 [待核实]）。
- **可复用方法/工件**：off-path 威胁建模的分类学；报告"攻击者模型"章节可引用。
- **证据等级**：[待核实] 仅核实元数据，未读全文；"讨论分片"未证实，勿在报告中归因。

### 2.3 Teardrop 家族（IP 分片重组 DoS）— 1997–1998 — NVD: CVE-1999-0015、CVE-1999-0104（Teardrop-2）、CVE-1999-0258（Bonk）、CVE-1999-0257（Nestea）
- **摘要（3–5 句）**：1997–1998 年席卷多种操作系统的一类 IP 分片 DoS：攻击者发送精心构造 offset 的**重叠分片**，使目标重组逻辑出现长度/偏移计算错误并崩溃。NVD 对 CVE-1999-0015 的描述仅 "Teardrop IP denial of service."，CVE-1999-0104 为 "later variation… a.k.a. Teardrop-2"，Bonk 与 Nestea 是后续变种（CVE-1999-0258/0257）。
- **相关性**：证明"重组器实现差异 + 重叠分片"是可武器化的经典原语；与 DNS 分片攻击共享同一实现薄弱面（现代对应物是 CVE-2018-5391）。
- **可复用方法/工件**：CVE 编号可作为"实现漏洞史"时间线证据；具体触发机制（负长度/偏移重叠）在 NVD 描述中未展开，**[待核实]**，报告中不要写具体 exploitation 细节（安全边界）。
- **证据等级**：CVE ID/日期/描述由 NVD API 核实（发布时间分别 1997-12-16、1997-12-16、1998-02-13、1998-04-01）。

### 2.4 Ping o' Death — 1996-12 — NVD: CVE-1999-0128
- **摘要（3–5 句）**：通过发送超大的 ICMP ping（分片后总长超过 IP 报文上限、重组时溢出）导致目标协议栈崩溃的早期 DoS。NVD 描述原文："Oversized ICMP ping packets can result in a denial of service, aka Ping o' Death."（发布时间 1996-12-18）。
- **相关性**：与 teardrop 同属"分片重组边界条件缺陷"时代；说明**分片路径的健壮性从 1990 年代起就是系统性问题**。
- **可复用方法/工件**：CVE-1999-0128 作为历史引用；不提供构造方法。
- **证据等级**：NVD API 核实描述/日期；机制细节为通行表述，[待核实] 具体实现受影响清单。

### 2.5 RFC 1858 + RFC 3128：Tiny Fragment / Overlapping Fragment 攻击与过滤规避 — G. Ziemba, D. Reed, P. Traina（RFC 1858, 1995-10, Informational）；I. Miller（RFC 3128, 2001-06, Informational, Updates 1858）
- **摘要（3–5 句）**：RFC 1858 指出 IP 分片可被用来**蒙骗路由器/主机上的包过滤器**，描述两类攻击：(a) tiny fragment——把传输层头切到第二个分片，使过滤器无法看到端口；(b) overlapping fragment——用后到的高 offset 分片覆盖第一分片里的传输层头，重组后端口/标志与过滤器看到的不一致。RFC 1858 给出对策（含 "Indirect Method"）。
- **RFC 3128**：证明 RFC 1858 的 "Indirect Method" 仍可被"tiny fragment + overlapping fragment"组合绕过，使本应只允许出站的端口接受入站连接；并给出修正建议。
- **相关性**：这是"**分片让不同观察点看到不同报文**"的最早标准化表述，直接对应 DNS 解析器/防火墙/IDS 对同一分片响应做出不同判定这一核心风险；也是"防火墙丢弃非首片/丢弃分片"策略（RFC 9715 R6/§7.5）的思想来源。
- **可复用方法/工件**：tiny-fragment/overlap 两类攻击的术语与对策分类；报告中"实现差异"部分可直接引用 RFC 1858 §3/§4 与 RFC 3128 §1。
- **证据等级**：RFC 原文摘要与引言已读（rfc-editor.org txt）；§3/§4 编号由 RFC 3128 引言交叉确认。

### 2.6 Insertion, Evasion, and Denial of Service: Eluding Network Intrusion Detection — Thomas H. Ptacek, Timothy N. Newsham — Secure Networks, Inc. 技术报告, 1998-01 — URL: http://insecure.org/stf/secnet_ids/secnet_ids.html
- **摘要（3–5 句）**：IDS 领域奠基性报告：被动协议分析不足以判定端系统"实际"看到什么，据此提出 insertion / evasion / DoS 三类攻击。§4.3 专论 IP 分片：乱序分片、分片队列超时、以及**重叠分片的冲突解决策略随 OS 不同**；Figure 12 给出可核查的对照表：Windows NT 4.0 "Always Favors Old Data"、Solaris 2.6 同；4.4BSD、Linux、HP-UX 9.01、Irix 5.3 "Favors New Data for Forward Overlap"。§4.3.3 进一步讨论端系统重组 bug；§4.4 明确"针对 DNS 的攻击可来自任意伪造源地址"。
- **相关性**：**这是"Linux/BSD/Windows 重组与重叠处理差异"最可核查的经典来源**，也是把"实现差异"变成安全问题的原始模型；DNS 解析器面对伪造分片响应时，双方（解析器 vs 中间盒/攻击者预期）对重叠/超时的处理差异正是同类问题。另注意其 §4.4 已把 DNS 列为无连接伪造的典型目标——早于 2008 Kaminsky 十余年。
- **可复用方法/工件**：Figure 12 的 OS 重叠策略表；"分片乱序/重叠/超时/队列耗尽"四类规避维度；实验方法（构造分片流对比 IDS 与端系统重组结果）可直接迁移到"解析器 vs 防火墙"对照实验。
- **证据等级**：全文 HTML 已读（insecure.org 镜像）；表中 OS 行为为 1998 年实测，现代行为 [待核实]（见 §5.2）。

### 2.7 IP fragmentation attack on DNS — Tomáš Hlaváček — RIPE 67 Meeting, 2013-10 — URL: https://ripe67.ripe.net/presentations/240-ipfragattack.pdf（PDF 已下载核实存在：317,332 B，25 页，Last-Modified 2013-10-16）
- **摘要（3–5 句）**：RIPE 67 演讲，指出**off-path 攻击者可干预 Path MTU Discovery，迫使权威服务器产生分片响应**，从而把 DNS 响应变成可利用的分片攻击面（RFC 9715 §7.3 转述：[Hlavacek2013] "note that off-path attackers can intervene in the Path MTU Discovery to cause authoritative servers to produce fragmented responses"）。该工作与 Herzberg & Shulman 2013 同期，是"诱导分片"思路的公开记录之一。
- **相关性**：与用户构想的 (b) "如何在受控实验环境诱导大 DNS 响应"直接相关：**PMTUD 干预是经典诱导手段之一**；也是 RFC 9715 的引用来源。
- **可复用方法/工件**：PMTUD/ICMP "packet too big" 干预作为诱导分片的实验变量（须在隔离环境、RFC 5737/3849 地址内做）。
- **证据等级**：[待核实] PDF 为纯图形/矢量，文本无法抽取；内容仅据 RFC 9715 的转述 + PDF 元数据，未逐页阅读。

### 2.8 RFC 7739 + RFC 8900（BCP 230）：可预测 Fragment ID 与"分片脆弱"的标准化 — F. Gont（RFC 7739, 2016-02, Informational）；R. Bonica, F. Baker, G. Huston, R. Hinden, O. Troan, F. Gont（RFC 8900, 2020-09, BCP 230）
- **RFC 7739 摘要**：IPv6 Fragment Header 的 Identification 字段只需"与近期同一源/目的地址的分片不同"，部分实现用**全局计数器**导致 ID 可预测；文档分析其安全影响（伪造分片/干扰合法重组）并给出随机化实现建议。
- **RFC 8900 摘要**：BCP 230，说明 IP 分片如何给 Internet 通信带来脆弱性（丢片、超时、重叠、中间盒策略差异、NAT/隧道），并提出开发者与运营者建议（优先 PLPMTUD/避免分片；网络不得过滤分片与 ICMP PTB；应用层限制尺寸）。§3.7 把攻击归类为：重叠分片攻击 [RFC1858][RFC3128][RFC5722]、资源耗尽、可预测 Fragment ID [RFC7739]、NIDS 规避 [Ptacek1998]；并指出"目标节点可通过实现 RFC 1858/3128/8200 的过程检测重叠并丢包"来抵御。
- **相关性**：RFC 8900 是"分片脆弱"的**权威共识文档**，任何防御视角研究都必须先对齐它与 RFC 9715，否则会被审稿人视为重复常识。
- **可复用方法/工件**：BCP 230 的建议清单（开发者/运营者两栏）可直接作为报告的"缓解措施"基线；§3.7 的攻击分类是现成的 taxonomy。
- **证据等级**：RFC 原文（摘要、§3.7 全文）已读；BCP 号、作者、日期核实。

### 2.9 Fragmentation Considered Vulnerable: Blindly Intercepting and Discarding Fragments — Yossi Gilad, Amir Herzberg — 5th USENIX Workshop on Offensive Technologies (WOOT 2011), 2011 — 出处：USENIX Sec 2020（Zheng et al.）参考文献 [42]（该文写作时页码记为 pp. 2–2，[待核实]）
- **摘要（据标题与 USENIX Sec 2020 §2.2 的引用脉络，[摘要级]）**：研究 off-path 攻击者如何"盲目地（blindly）"拦截并丢弃 IP 分片——攻击者无需看到合法流量，通过预测/伪造分片使目标的重组失败或丢弃合法分片，从而达成 DoS/干扰。该文是 Herzberg 团队把"分片"从实现 bug 提升为**协议级攻击面**的早期工作，早于 2013 年投毒主线。
- **相关性**：提醒防御视角不要只盯"投毒"——**分片还可被用于盲目丢弃/拦截（可用性攻击）**；检测研究应同时考虑"分片被替换"与"分片被丢弃"两类信号。
- **可复用方法/工件**：blindly intercepting/discarding 威胁模型；与 2013 投毒线共享 IP ID/分片预测原语。
- **证据等级**：[待核实·中] 标题/作者/venue/年份经 USENIX Sec 2020 参考文献表 [42] 二次核实，未独立核实 WOOT 2011 官方页面与页码；内容描述据标题与引用脉络。
- **注（对 `lead-intel.md` 第 4 条的再更正）**：Gilad & Herzberg 确实写过一篇分片论文，但正式标题是 **"Fragmentation Considered Vulnerable: Blindly Intercepting and Discarding Fragments"（WOOT 2011）**；而"Fragmentation Considered Leaking: Port Inference for DNS Poisoning"（ACNS 2014）的作者是 **Shulman & Waidner**。三篇不要混用。

## 3. DNS 分片攻击主线（2013–2021）

### 3.1 Fragmentation Considered Poisonous, or: One-domain-to-rule-them-all.org — Amir Herzberg, Haya Shulman — IEEE Conference on Communications and Network Security (CNS) 2013 — DOI: 10.1109/CNS.2013.6682711 — 引用数：Semantic Scholar 131 / OpenAlex 102（2026-10-22 查询）
- **摘要（基于 OpenAlex 收录的官方摘要，逐句可对）**：作者提出**有效的 off-path DNS 缓存投毒攻击**，可绕过当时广泛部署的 challenge-response 防御（**事务 ID 随机化、端口随机化、查询随机化**）。攻击前提是 **用 UDP 取回长 DNS 响应会导致 IP 分片**；作者证明攻击者**常常能够生成这样的分片响应**，并滥用它们把伪造的"有毒"记录注入合法 DNS 响应。文中还研究了解析器、权威服务器、域名与注册商各侧的防御；结论是**最好的防御是部署并强制 DNSSEC 验证**，但 DNSSEC 需域名与解析器两侧都正确部署（并引用"不到 1% 解析器在 DNSSEC 验证失败时拒绝响应"的研究）。作者给出若干**短期对策**以在 DNSSEC 普及前补位，并在 **BIND 与 Unbound 等流行解析器及真实互联网域名**上验证了攻击。
- **攻击者模型**：摘要明确为 **off-path**（看不到合法通信，靠伪造/注入）；论文题目暗示的"one-domain-to-rule-them-all"对应"用一个可控域名制造大量分片响应"的规模化思路。**on-path 变体**未在摘要中出现，[待核实] 正文是否讨论。
- **攻击机制（二次来源：USENIX Sec 2020 §2.2 对 [48] 的综述，原文已从 PDF 恢复并核实）**："the **2nd fragment** of a fragmented DNS response packet **does not contain DNS or UDP headers or question section**, so it can **bypass randomization-based defences** against forging attacks." 攻击者先构造含 rogue 记录的第 2 分片、随后发出受害域名查询；权威服务器的响应被强制分片（攻击者"提前、通过独立过程"完成）；递归解析器把**合法第 1 分片与伪造第 2 分片**重组，产出 rogue 响应并缓存。强制分片有两条路径：**PMTU-based**（降低 PMTU；USENIX 2020 引 [33] = Brandt et al. CCS 2018）与 **DNSSEC-based**（用 DNSSEC 大响应触及 MTU；USENIX 2020 引 [48]，即本文）。这补足了官方摘要未展开的"分片为何能绕过随机化"细节。页码 pp. 224–232（据 USENIX 2020 参考文献 [48]）。
- **需猜/需绕过的字段**：摘要点名的 challenge-response 防御即 **DNS 事务 ID（16 bit）、UDP 源端口（16 bit）、查询名/大小写等查询随机化**；攻击通过分片注入绕过对这些字段的"单包匹配"校验（具体匹配逻辑与成功率数字需读全文，[待核实]）。
- **实验对象**：BIND、Unbound（摘要原文 "We validated our attacks against popular resolvers (Bind and Unbound), and real domains in the Internet."）。
- **防御建议**：DNSSEC 验证（最优）；短期对策补充（摘要未列清单，[待核实] 具体条目）。
- **相关性**：**本主题的奠基论文**。用户构想中的"DNS 响应需分片时暴露弱点"在 2013 年已被明确建模为 off-path 投毒；任何新工作必须说明相对它的增量（新传输/新实现/新检测信号/新测量）。
- **可复用方法/工件**：攻击前提四元组（UDP 长响应 → 分片 → 攻击者可生成分片 → 注入）；"one-domain"规模化构造；BIND/Unbound 测试床设计；防御评估框架。
- **证据等级**：[摘要级·高] 摘要来自 OpenAlex（S2 因出版商限制 elided abstract）；全文未读，正文细节（分片生成的具体触发条件、成功率、短期对策清单）标 [待核实]。

### 3.2 Fragmentation Considered Leaking: Port Inference for DNS Poisoning — **Haya Shulman, Michael Waidner** — ACNS 2014（Applied Cryptography and Network Security），Springer LNCS 8479, pp. 531–548 — DOI: 10.1007/978-3-319-07536-5_31
- **摘要（Springer 官方摘要，逐句可对）**：Internet 系统长期受 **off-path 攻击者**威胁：攻击者看不到合法端到端流量，只能通过向通信流注入伪造包来冒充受害者。此类攻击曾用于 **DNS 缓存投毒、TCP 注入、反射 DDoS**；主流硬化手段是基于随机 challenge 的 challenge-response（请求带随机值、校验响应回显）。本文研究**端口随机化**这一"标准且广泛部署"的 challenge-response 防御的安全性，证明 off-path 攻击者可以**高效且隐蔽地学到端系统选择的端口**，并把技术用于 **DNS 缓存投毒**；作者在**标准与已打补丁的操作系统、以及流行 DNS 解析器软件**上测试了攻击，结果"促使我们加速采用 DNS 的密码学防御"。
- **相关性**：为 3.1 的分片投毒补上关键一环——**端口随机化可被推断**，因此"猜 16 bit 端口"未必是障碍；标题("Fragmentation Considered Leaking")表明分片可能泄漏端口信息（[待核实] 摘要未直接展开分片机制，需读全文确认"leaking"具体指分片侧信道还是泛指信息泄漏）。
- **可复用方法/工件**：端口推断实验设计（跨 OS/解析器）；"随机化防御可被信息泄漏击穿"的评估范式。
- **证据等级**：[摘要级·高] 摘要来自 Springer 章页；作者更正已核实（Springer citation_author + Crossref + S2 + OpenAlex 一致）；全文未读 [待核实] 分片与端口泄漏的具体因果链。
- **给 Lead 的更正**：`lead-intel.md` 第 4 条把本文作者写成 "Gilad & Herzberg"，应改为 **Shulman & Waidner**（ACNS 2014, LNCS 8479, pp. 531–548）。

### 3.3 2014–2021 跟进工作（从 3.1 的 S2 citations 列表中挑选，均核实 DOI/作者/摘要）
> 说明：以下 8 条来自 Semantic Scholar citations API 对 DOI:10.1109/CNS.2013.6682711 的 100 条被引记录（2026-10-22 拉取），按与本主题相关性挑选；摘要均来自 OpenAlex/Crossref 收录的官方摘要（[摘要级]）。

1. **DNS Resolvers Considered Harmful** — Kyle Schomp, Mark Allman, Michael Rabinovich — ACM HotNets 2014 — DOI: 10.1145/2670518.2673881。摘要：共享 DNS 解析器是系统臭名昭著的安全弱点；作者提出"干脆移除共享解析器、把递归解析留给客户端"的非常规方案，并论证性能与系统负载两项主要代价都不大，从而缩小攻击面。**相关性**：把"解析器是攻击面"推到架构层；反向印证"分片响应在解析器处的处理"是关键观测点。
2. **Towards Security of Internet Naming Infrastructure** — Haya Shulman, Michael Waidner — ESORICS 2015 — DOI: 10.1007/978-3-319-24174-6_1。摘要：研究命名基础设施**服务器侧**的运行特征，发现"隐藏的服务器侧缓存解析器"架构至少存在于前向 DNS 树 38% 的域名中（反向树更高），并刻画其运营者与动机、评估其安全影响。**相关性**：说明 DNS 链路中"多级缓存/转发"普遍存在，分片响应可在这些中间层被不同实现处理——与 USENIX Sec 2020 forwarder 攻击呼应。
3. **Path MTU Discovery Considered Harmful** — Matthias Göring, Haya Shulman, Michael Waidner — IEEE ICDCS 2018 — DOI: 10.1109/ICDCS.2018.00088。摘要：PMTUD 长期存在 bug/失效/配置错误；分析 CAIDA 流量显示使用 PMTUD 的网络比例可忽略且 2008–2016 持续下降，大量热门 Web 服务器屏蔽 ICMP "packet too big"，同时给出利用 PMTUD 可用性的**服务降级攻击**，主张停止使用 PMTUD 并给出缓解建议。**相关性**：直接支撑"**PMTUD 干预可诱导分片/降级**"（与 Hlavacek 2013 同一思路），也是 RFC 9715 §7.3 引用 [Brandt2018] 的背景。
4. **Domain Validation++ For MitM-Resilient PKI** — Markus Brandt, Tianxiang Dai, Amit Klein, Haya Shulman, Michael Waidner — ACM CCS 2018 — DOI: 10.1145/3243734.3243790。摘要：首次实际证明**弱 off-path 攻击者**可有效颠覆主流 CA 的信任（这些 CA 用 Domain Validation，占证书市场 99%）：利用 **DNS 缓存投毒** 诱导 CA 为受害域名签发攻击者公钥的证书；讨论短期与长期防御。**相关性**：RFC 9715 §7.3 引用它说明 off-path 攻击者可干预 PMTUD 使权威服务器产生分片响应——是"分片投毒 → 现实 PKI 后果"的桥梁。
5. **DNS Cache Poisoning Attack Reloaded: Revolutions with Side Channels** — Keyu Man, Zhiyun Qian, Zhongjie Wang, Xiaofeng Zheng, Youjun Huang, Haixin Duan — ACM CCS 2020 — DOI: 10.1145/3372297.3417280。摘要：典型投毒需同时猜中源端口（16 bit）+事务 ID（16 bit）共 2^32 空间；作者发现软件栈缺陷可"**分而治之**"：先猜端口再猜 ID，只需约 2^16+2^16 次伪造响应。**相关性**：证明"随机化防御"在实现层可被降维；分片攻击同样是"绕过随机化匹配"的另一条路径。
6. **DNS Cache Poisoning Attack: Resurrections with Side Channels** — Keyu Man, Xin'an Zhou, Zhiyun Qian — ACM CCS 2021 — DOI: 10.1145/3460120.3486219。摘要：DNS 随机化防御（UDP 临时端口随机化等）仍受**侧信道**侵蚀；论文系统化展示跨层侧信道如何恢复随机数、复活投毒。**相关性**：与 3.2 端口推断同属"随机化不可靠"证据链；防御视角研究需把这些泄漏纳入威胁模型。
7. **DNS-over-TCP considered vulnerable** — Tianxiang Dai, Haya Shulman, Michael Waidner — ACM ANRW 2021 — DOI: 10.1145/3472305.3472884。**摘要（S2 Graph API 收录全文摘要，已核）**：研究界与运维界相信 TCP 能抵御 IP 分片攻击，并建议服务器避免用 UDP 发 DNS 响应、改用 TCP；本文证明 **IP 分片攻击同样适用于走 TCP 的服务器**：在 Alexa top-100K 域名中，有 **393 个额外域名**的名称服务器**可被强制对承载 TCP 段的 IP 包做（源）分片**，而这些域名在 UDP 下反而无法被强制分片；因此"用 TCP 替代 UDP 以规避分片攻击"的建议有风险，且分片攻击面比此前认为的更大；作者在 TCP 承载的 DNS 响应上评估了分片投毒攻击。**相关性**：**直接反驳"TCP 兜底 = 分片问题解决"**，是用户构想做防御研究时必须回应的反例；同时给出可复用的测量口径（对权威服务器强制源分片）。
8. **Measuring DNS over TCP in the era of increasing DNS response sizes** — Mike Kosek, Trinh Viet Doan, Simon Huber, Vaibhav Kumar Bajpai — ACM SIGCOMM CCR 2022 — DOI: 10.1145/3544912.3544918（2022，超出 2021 主窗，作为边界参考）。摘要：新 RR 类型使 DNS 响应尺寸显著增大，可能触发截断或 IP 分片；标准要求回退 DoTCP；论文从边缘侧测量 DoTCP 行为与效应。**相关性**：分片/截断/DoTCP 三角关系的当代测量基线。
- **同期但未选入**：Trufflehunter（IMC 2020，缓存窥探）、Off-Path Attacks Against PKI（CCS 2018，与 4 同源）、Collaborative Client-Side DNS Cache Poisoning（INFOCOM 2019）等，属邻近主题；`lit-recent` 会覆盖 2021 后工作。

### 3.4 Poison Over Troubled Forwarders: A Cache Poisoning Attack Targeting DNS Forwarding Devices — Xiaofeng Zheng, Chaoyi Lu, Jian Peng, Qiushi Yang, Dongjie Zhou, Baojun Liu, Keyu Man, Shuang Hao, Haixin Duan, Zhiyun Qian — 29th USENIX Security Symposium (USENIX Security '20), 2020-08, pp. 577–593 — URL: https://www.usenix.org/conference/usenixsecurity20/presentation/zheng
- **摘要（USENIX 官网摘要，逐句可对）**：DNS forwarder 位于客户端与递归解析器之间，广泛部署但更易受攻击；作者提出**针对 forwarder 的缓存投毒攻击**：攻击者用自己控制的域名，向任意受害域名注入 rogue 记录，并**绕过广泛部署的缓存投毒防御**；对热门家用路由器与 DNS 软件（D-Link、Linksys、dnsmasq、MS DNS 等）测试发现多个脆弱实现；通过全国测量估计中国移动客户端中使用脆弱 forwarder 的规模；已向厂商报告并获部分正面反馈。论文呼吁社区关注 forwarder 这一 DNS 基础设施软肋并给出实现指南。
- **与分片的关系（已从 PDF 文本流部分恢复并核实章节结构）**：该文的核心攻击就是 **defragmentation attack**。目录（PDF 书签流）显示：**§2.2 Defragmentation Attacks**（相关的前人工作）、**§4 Defragmentation Attacks Targeting DNS Forwarders**（§4.1 Attack Overview、**§4.2 Forcing DNS Response Fragmentation**、**§4.3 Crafting Spoofed Fragments**、§4.4 Conditions of Successful Attacks）。正文原文（PDF 内容流，已人工恢复）称："the second approach is to send **DNSSEC queries** to solicit enlarged DNS responses with DNSSEC records, so that they reach limits of MTUs (e.g., 1,500 bytes for Ethernet) and will be fragmented [48]. We term this type of attack as **DNSSEC-based defragmentation attack**." 该文还比较了 PMTU-based 与 DNSSEC-based 两条诱导分片路径，指出前者对权威服务器 PMTU 行为与受害域名要求很高；并描述攻击者如何"**提前注入第 2 个伪造分片**"，使 forwarder 看到的是被篡改的响应（§4.3 的 2nd-fragment 注入）。—— 这直接印证 `lead-intel.md` 第 8 条：**该文确含 DNSSEC-based fragmentation 章节**。
- **可复用方法/工件（分片部分）**：两条"强制分片"路径（PMTU 干预 vs DNSSEC 大响应）的对比框架；**2nd fragment 注入**的攻击模型；对 forwarder 转发大响应行为的观测点设计。
- **§2.2 关键原文（PDF 内容流已恢复，逐字）**："Recent studies [33, 47–49, 66] have uncovered a new type of DNS cache poisoning attack based on IP defragmentation. The attack exploits the fact that the **2nd fragment of a fragmented DNS response packet does not contain DNS or UDP headers or question section**, so it can **bypass randomization-based defences against forging attacks**. … the attacker first crafts a spoofed 2nd fragment with rogue DNS records, and issues a DNS query of the victim domain name. The response from an authoritative server is forced to be fragmented by the attacker (through a separate process ahead of time). At the recursive resolver, the legitimate 1st fragment is reassembled with the spoofed 2nd fragment, which produces a rogue DNS response." —— **这是本主题"攻击前提"的最佳一句话表述**，可直接引用。
- **§2.1 投毒判定条件原文**："a DNS response is accepted when the following fields matches a DNS query: **question section, DNS transaction ID, source/destination addresses and port numbers**."（即需猜/需匹配的字段清单）并指出 2008 Kaminsky 攻击后防御方普遍启用随机端口 + 事务 ID + 0x20 编码，而分片攻击绕过它们。
- **§4.2 原文要点**："Reducing PMTU: ineffective for DNS forwarder attacks."（对 forwarder 场景，PMTU 路线无效，故该文用 DNSSEC 大响应路线强制分片）。
- **相关性**：把"DNS 分片/大响应处理"的攻击面从递归解析器扩展到 **forwarder/家用路由器**——这正是用户构想中"检测与缓解"最需要覆盖的部署现实。
- **可复用方法/工件**：forwarder 固件/软件测试矩阵（D-Link、Linksys、dnsmasq、MS DNS）；全国规模测量方法（估计受影响客户端 population）；负责任披露流程；§4.2 两条强制分片路线的可行性对比。
- **证据等级**：标题/作者/venue/摘要由 USENIX 官方页面核实；章节结构、§2.1/§2.2/§4.2 原文由 PDF 内容流/书签流恢复后核实（部分字体重编码导致个别字符异常，引文已按上下文校正；正文完整语义未逐页校对）。

### 3.5 Fragmentation, Truncation, and Timeouts: Are Large DNS Messages Falling to Bits? — Giovane C. M. Moura, Moritz Müller, Marco Davids, Maarten Wullink, Cristian Hesselman — PAM 2021 (Passive and Active Measurement), Springer LNCS — DOI: 10.1007/978-3-030-72582-2_27
- **摘要（Springer 官方摘要，逐句可对）**：DNS 主要走 UDP，而**大 UDP 响应有不到达的风险**（最终导致不可达）；作者分析 **.nl 权威服务器**三个月（**2019-07、2020-07、2020-10**）采集的 **1640 亿条查询/响应对、4.6 万+ AS**，发现分片及其后续问题在这些权威服务器上**很少发生**；并证明 DNS 内建防御（**截断、EDNS0 buffer size、减小响应、TCP 回退**）能有效减少分片；最后测量 **2020 DNS Flag Day** 的采纳情况。
- **相关性**：**给用户构想的关键"现实主义"校准**：在 TLD 权威侧，分片是罕见事件，因此"检测分片响应"这类防御工作的价值必须用"罕见但高影响"来论证；同时它给出可复用的测量方法（EDNS buffer 分布、TC 比例、DoTCP 回退统计）。
- **可复用方法/工件**：164B 查询/46k AS 的测量口径；分片率/截断率/回退率指标定义；Flag Day 采纳度评估框架。
- **证据等级**：摘要与作者/DOI 由 Springer 章页核实；[待核实] 全文细节（如分片率具体数值）。

## 4. 标准与规范清单（含 RFC 9715 关键原文）

> 说明：日期/状态/作者均取自 rfc-editor.org 的 RFC 正文首部；「关键内容」为原文摘录或紧贴原文的转述。

### 4.1 RFC 791 — "Internet Protocol"（STD 5），J. Postel，1981-09 — https://www.rfc-editor.org/rfc/rfc791.txt
IPv4 分片字段定义（Identification / Flags 的 DF、MF / Fragment Offset），是全部后续讨论的语法基础；RFC 8900 与 RFC 9715 均以它为规范性引用（例如 R2 用 DF 位避免分片）。

### 4.2 RFC 1035 — "Domain names - implementation and specification"（STD 13），P. Mockapetris，1987-11 — https://www.rfc-editor.org/rfc/rfc1035.txt
原文（§4.2.1 UDP usage）："**Messages carried by UDP are restricted to 512 bytes** (not counting the IP or UDP headers). Longer messages are truncated and the TC bit is set in the header." —— 512 字节/TC 位是"大响应 → 分片/截断"张力的起点。

### 4.3 RFC 1858（Informational，1995-10）与 RFC 3128（Informational，2001-06）
见 §2.5；前者定义 tiny fragment 与 overlapping fragment 攻击及过滤对策，后者修正其 "Indirect Method" 的绕过变种。二者被 RFC 8900 §3.7、RFC 9715 §7.3/§7.5 引用为"目标节点应实现的检测重叠并丢弃"的规范依据。

### 4.4 RFC 5722 — "Handling of Overlapping IPv6 Fragments"（Standards Track），S. Krishnan，2009-12 — https://www.rfc-editor.org/rfc/rfc5722.txt
原文（§4 Node Behavior）："**IPv6 nodes transmitting datagrams that need to be fragmented MUST NOT create overlapping fragments. When reassembling an IPv6 datagram, if one or more its constituent fragments is determined to be an overlapping fragment, the entire datagram (and any constituent fragments, including those not yet received) MUST be silently discarded.**" —— IPv6 侧对重叠分片的强硬立场；IPv4 无同等级 MUST（IPv4 的处理差异正是 Ptacek-Newsham / RFC 1858 的问题域）。

### 4.5 RFC 6891 — "Extension Mechanisms for DNS (EDNS(0))"（STD 75），J. Damas, M. Graff, P. Vixie，2013-04 — https://www.rfc-editor.org/rfc/rfc6891.txt
关键原文：§6.2.3 "The requestor SHOULD place a value in this field that it can actually receive… if a requestor sits behind a firewall that will block fragmented IP packets, a requestor SHOULD NOT choose a value that will cause fragmentation."；"Note that a 512-octet UDP payload requires a 576-octet IP reassembly buffer. Choosing between 1280 and 1410 bytes for IP (v4 or v6) over Ethernet would be reasonable."；"Choosing a very large value will guarantee fragmentation at the IP layer, and may prevent answers from being received due to loss of a single fragment or to misconfigured firewalls."；§6.2.5 "A good compromise may be the use of an EDNS maximum payload size of 4096 octets as a starting point." —— **EDNS(0) 把"是否分片"变成显式协商参数**，是后续所有防护（1232、Flag Day）的机制基础。

### 4.6 RFC 6980 — "Security Implications of IPv6 Fragmentation with IPv6 Neighbor Discovery"（Standards Track），F. Gont，2013-08 — https://www.rfc-editor.org/rfc/rfc6980.txt
摘要原文：分析 ND 消息使用 IPv6 分片的安全影响，更新 RFC 4861 使 "**use of the IPv6 Fragmentation Header is forbidden in all Neighbor Discovery messages**"，并讨论 SEND 的分片影响。 —— 证明"协议层禁用分片"是可行且已被标准采纳的缓解范式。

### 4.7 RFC 7739 — "Security Implications of Predictable Fragment Identification Values"（Informational），F. Gont，2016-02 — https://www.rfc-editor.org/rfc/rfc7739.txt
摘要原文：部分实现用全局计数器设置 IPv6 Fragment Header 的 Identification，导致 **可预测 ID**；文档分析其安全影响并给出实现指导。 —— 与 RFC 8900 §3.7 "attacks based on predictable fragment identification values" 对应；是"ID 猜测"这一攻击原语的标准引用。

### 4.8 RFC 7766 — "DNS Transport over TCP - Implementation Requirements"（Standards Track），J. Dickinson, S. Dickinson, R. Bellis, A. Mankin, D. Wessels，2016-03 — https://www.rfc-editor.org/rfc/rfc7766.txt
摘要原文：规定 DNS 实现对 TCP 传输的支持要求，并给出使 DoTCP 性能与 DoUDP 相当的指南；obsoletes RFC 5966、updates RFC 1035/1123。RFC 9715 §2 引其要求："all general-purpose DNS implementations **MUST** support both UDP and TCP transport"。 —— TCP 兜底的法律基础。

### 4.9 RFC 7873 — "Domain Name System (DNS) Cookies"（Standards Track），D. Eastlake 3rd, M. Andrews，2016-05 — https://www.rfc-editor.org/rfc/rfc7873.txt
摘要原文：轻量级 DNS 事务安全机制，对 **off-path 攻击者**的 DoS/放大/伪造与缓存投毒提供有限保护；容忍 NAT/NAT-PT/anycast，可增量部署。 —— 针对 off-path 伪造的**密码学/挑战响应**补充，与分片投毒防御互补（Herzberg & Shulman 的"短期对策"一类）。

### 4.10 RFC 8085 — "UDP Usage Guidelines"（BCP 145），L. Eggert, G. Fairhurst, G. Shepherd，2017-03 — https://www.rfc-editor.org/rfc/rfc8085.txt
RFC 9715 §7.3 引其 §3.2 原文："**an application SHOULD NOT send UDP datagrams that result in IP packets that exceed the Maximum Transmission Unit (MTU) along the path to the destination**"。 —— 应用层避免分片的通用原则，DNS 是其特例。

### 4.11 RFC 8200 — "Internet Protocol, Version 6 (IPv6) Specification"（STD 86），S. Deering, R. Hinden，2017-07 — https://www.rfc-editor.org/rfc/rfc8200.txt
IPv6 分片头/重组规则；RFC 9715 R1 引其"UDP 响应者不应使用 IPv6 分片"，并给出 1280 字节最小 MTU（1232 = 1280 − 48 的推导来源）。

### 4.12 RFC 8482 — "Providing Minimal-Sized Responses to DNS Queries That Have QTYPE=ANY"（Standards Track），J. Abley, O. Gudmundsson, M. Majkowski, E. Hunt，2019-01 — https://www.rfc-editor.org/rfc/rfc8482.txt
摘要原文：ANY 查询可因安全/性能/本地策略而不被完整回答；文档给出服务器/客户端行为指南，updates RFC 1034/1035。 —— "**减小响应尺寸=减少分片**"的标准侧手段（RFC 9715 R8–R10 的同类思路）。

### 4.13 RFC 8900 — "IP Fragmentation Considered Fragile"（BCP 230），R. Bonica, F. Baker, G. Huston, R. Hinden, O. Troan, F. Gont，2020-09 — https://www.rfc-editor.org/rfc/rfc8900.txt
摘要原文 + §3.7 攻击分类见 §2.8。要点：分片引入脆弱性；建议替代方案与开发者/运营者建议；"fragmentation considered fragile" 是 2020 年代的标准口径。 —— **防御视角研究的基线文档**。

### 4.14 DNS Flag Day 2020（2020-10-01）— https://dnsflagday.net/2020/
官网原文要点（已 curl 核实）：
- 目标日期 **2020-10-01**，聚焦"IP 分片引起的 DNS 运维与安全问题"；"IP fragmentation is unreliable on the Internet today… Even when fragmentation does work, it may not be secure; it is theoretically possible to **spoof parts of a fragmented DNS message**, without easy detection at the receiving end."（引 Bonica et al. 的 frag-fragile 草案、Huston 2017、Fujiwara 2019）。
- **1232 字节**：EDNS buffer size 默认 1232，"will avoid fragmentation on nearly all current networks"，依据 MTU 1280 − 48（IPv6+UDP 头）。
- 权威侧："Authoritative DNS servers **MUST NOT** send answers larger than the requested EDNS buffer size!"；须支持 TCP/53 并检查防火墙。
- 解析器侧：**"Resolvers MUST resend queries over TCP if they receive a truncated UDP response (with TC=1 set)!"**
- 软件默认值示例：BIND `edns-udp-size 1232` / `max-udp-size 1232`；Unbound `edns-buffer-size: 1232`；NSD `ipv4-edns-size/ipv6-edns-size`；Knot、PowerDNS 对应参数。

### 4.15 RFC 9715 — "IP Fragmentation Avoidance in DNS over UDP"（Informational，**不是 BCP**），K. Fujiwara (JPRS), P. Vixie (AWS Security)，2025-01 — https://www.rfc-editor.org/rfc/rfc9715.txt
关键原文（逐条已核）：
- **R1** "UDP responders should not use IPv6 fragmentation [RFC8200]."
- **R2** "UDP responders should configure their systems to prevent fragmentation of UDP packets when sending replies, provided it can be done safely."（BSD 用 DF 位；Linux 需 IP_MTU_DISCOVER，且"enabling IPv4 Path MTU Discovery for UDP in current Linux versions is considered harmful and dangerous"，见 Appendix C）
- **R3** 响应应不超过 min(请求者 EDNS 上限、接口 MTU、运营者 MTU、**RECOMMENDED maximum DNS/UDP payload size 1400**)。
- **R5** 请求者把最大 UDP payload 限制在 min(接口 MTU、运营者 MTU、**1400**)。
- **R6** "UDP requestors should **drop fragmented DNS/UDP responses without IP reassembly** to avoid cache poisoning attacks (at the firewall function)."
- **R7** "DNS responses may be dropped by IP fragmentation. It is recommended that requestors eventually try alternative transport protocols."（TCP 兜底）
- **§7.3** 直接引用 [Herzberg2013] 与 [Hlavacek2013]；给出核心理由："**A DNS message receiver cannot trust fragmented UDP datagrams** primarily due to the small amount of entropy provided by UDP port numbers and DNS message identifiers, each of which is only 16 bits in size, and both are likely to be in the first fragment of a packet if fragmentation occurs."
- **§7.4** DNSSEC 是分片投毒的对抗手段，但 "DNS delegation responses are not signed with DNSSEC, and DNSSEC does not have a mechanism to get the correct response if an incorrect delegation is injected"（DoS 风险）。
- **§7.5** 解析器运维者可实施 R5/R6："configure the firewall functions protecting the full-service resolver to discard incoming DNS response packets with a non-zero Fragment Offset (FO) or a More Fragments (MF) flag bit of 1 on IPv4, and discard packets with IPv6 Fragment Headers."
- **1232 的推导**：§Appendix 引 [DNSFlagDay2020] 提出请求者 payload 1232、响应者也应适配 1232；理由：IPv6 最小 MTU 1280 − 48（IPv6 头 40 + UDP 头 8）= 1232；RFC 4035 要求安全感知名称服务器至少支持 1220 字节。
- **相关性**：这是把 2013 年攻击研究、2020 年 Flag Day、BCP 230 三者收束成**可执行操作清单**的最新标准；用户构想的"防御视角"若走"检测/丢弃分片响应"路线，就是在实现 R6 及其变体——**必须说明相对 RFC 9715 的增量**（如：检测信号、误报代价、对 R7 回退的影响）。
- **证据等级**：RFC 原文已读（R1–R11、§7.3–§7.5、Appendix 相关段落）；"Informational 而非 BCP"已由正文 Status of This Memo 核实（`lead-intel.md` 第 1 条正确）。

### 4.16 RFC 9210 — "DNS Transport over TCP - Operational Requirements"（BCP 235），J. Kristoff, D. Wessels，2022-03 — https://www.rfc-editor.org/rfc/rfc9210.txt
摘要原文：updates RFC 1123/1536，以 BCP 形式要求**运营上允许 DNS 消息走 TCP**（含加密 TLS），与 RFC 7766 的实现要求对齐；文档讨论不遵守时的运营后果。 —— 超出 2021 主窗，但补齐"TCP 兜底"的运营闭环（RFC 9715 引 RFC 7766 而非 9210，注意区分）。
- **证据等级**：RFC 首部与摘要已核（BCP 235、2022-03、作者）。

## 5. 实现漏洞（CVE 与重组差异）

### 5.1 CVE 表（NVD API 核实）
| CVE | 发布时间 | 受影响对象 | NVD 描述要点 | 与本主题关系 |
|---|---|---|---|---|
| CVE-1999-0128 | 1996-12-18 | 多种 IP 栈 | "Oversized ICMP ping packets can result in a denial of service, aka Ping o' Death." | 分片重组边界/溢出类 DoS 的早期代表 |
| CVE-1999-0015 | 1997-12-16 | 多种 IP 栈 | "Teardrop IP denial of service." | 重叠分片重组缺陷 DoS |
| CVE-1999-0104 | 1997-12-16 | 多种 IP 栈 | "A later variation on the Teardrop IP denial of service attack, a.k.a. Teardrop-2." | 同上（变种） |
| CVE-1999-0258 | 1998-02-13 | 多种 IP 栈 | "Bonk variation of teardrop IP fragmentation denial of service." | 同上（变种） |
| CVE-1999-0257 | 1998-04-01 | 多种 IP 栈 | "Nestea variation of teardrop IP fragmentation denial of service." | 同上（变种） |
| **CVE-2018-5391** | 2018-09-06 | **Linux kernel 3.9+** | "vulnerable to a denial of service attack with low rates of specially modified packets targeting IP fragment re-assembly… became exploitable in the Linux kernel with the increase of the IP fragment reassembly queue size."（CWE-400, CWE-20；CVSS 3.1 **7.5 HIGH**，CVSS v2 7.8） | **FragmentSmack**：现代重组队列耗尽型 DoS；证明分片实现问题在 2018 年仍是活跃漏洞源 |

- **相关性/启示**：CVE 史说明"分片实现缺陷"从未消失，只是从"崩溃"转向"资源耗尽/算法复杂度"；DNS 分片安全研究若只谈协议层攻击（2013 系列）而忽略实现层 DoS/健壮性，会漏掉一整类可发表贡献（但需注意 2025 年的 CVE-2025-59024 已由 PowerDNS 披露，属 `lit-recent` 范围）。
- **证据等级**：CVE ID/日期/描述/CVSS 均由 NVD REST API 返回核实（CVE-2018-5391 的 `vulnStatus: Modified`）。

### 5.2 Linux / BSD / Windows 重组与重叠处理差异
- **可核查的经典来源**：Ptacek & Newsham 1998 Figure 12（§2.6）给出 1998 年实测的 OS 重叠处理对照表：**Windows NT 4.0 / Solaris 2.6 总是偏好旧数据；4.4BSD / Linux / HP-UX 9.01 / Irix 5.3 在前向重叠时偏好新数据**；并强调"除非 IDS 知道端系统 OS，否则无法确定最终重组结果"。
- **标准侧差异**：IPv6 侧 RFC 5722 用 MUST 禁止重叠并整包丢弃（§4.4）；IPv4 侧没有等价 MUST，RFC 1858/3128 只给出"目标节点可检测重叠并丢弃"的过程建议（RFC 8900 §3.7 明确"stateless firewall 无法防护重叠分片攻击，目标节点可通过实现 RFC 1858/3128/8200 的过程防护"）。
- **另一可核查经典**：**Heffner, J. W., Chandler, B., & Mathis, M. (2007). "IPv4 Reassembly Errors at High Data Rates"**（经 USENIX Sec 2020 参考文献 [46] 核实标题/作者/年份；venue 未独立核实 [待核实]）——指出真实高速链路下 IPv4 重组错误并非罕见，是"重组不可靠/实现差异"的经典测量；可用于论证"分片在真实链路中本就易失败"，与 RFC 8900 的"fragile"论一致。
- **当代实现行为**：[待核实] 本次未找到 2019–2021 年对 BIND/Unbound/PowerDNS/Knot 及当代 Windows/Linux/BSD 协议栈重叠策略的可核查系统对比（S2/OpenAlex 检索到的相关工作多聚焦攻击/侧信道，而非重组策略测量）；该空白本身可作为用户构想的候选切入点（但需与 `lit-recent` 的 2022–2026 工作去重）。
- **证据等级**：Ptacek-Newsham 原文已读；RFC 5722/8900 原文已读；当代 OS 差异 [待核实]。

## 6. 对用户构想的启示（哪些已被经典工作覆盖）

**（a）已被覆盖、不能当"新发现"的：**
1. **"DNS 大 UDP 响应会分片，分片可被 off-path 滥用投毒"** —— Herzberg & Shulman 2013（§3.1）已完整建模并在 BIND/Unbound + 真实域名验证；Hlavacek 2013（§2.7）给出 PMTUD 诱导；Shulman & Waidner 2014（§3.2）补端口推断。
2. **"分片/重叠/ID 猜测是通用攻击原语"** —— RFC 1858/3128（tiny/overlap）、RFC 7739（可预测 ID）、RFC 8900 §3.7（分类学）、Ptacek-Newsham 1998（NIDS 规避 + OS 差异表）已系统化。
3. **"避免分片/丢弃分片/1232/TCP 兜底"作为缓解** —— DNS Flag Day 2020（§4.14）、RFC 8900（§4.13）、RFC 9715 R1–R11/§7.5（§4.15）、RFC 7766/9210（§4.8/§4.16）已成标准口径；**"检测分片响应"不是新 mitigation 想法**，RFC 9715 §7.5 直接给出防火墙规则。
4. **"真实世界分片有多常见"** —— PAM 2021（§3.5）用 .nl 1640 亿查询测量，结论是权威侧罕见（但"罕见≠不重要"，需用影响论证）。
5. **"forwarder/家用路由器是软肋"** —— USENIX Sec 2020（§3.4）已覆盖。

**（b）经典工作留下的、可能仍站得住的缝隙（初步判断，最终归 `novelty-venues`）：**
- **防御视角的"检测信号 + 代价模型"系统化**：现有标准给的是"丢弃"（RFC 9715 R6/§7.5），但**在解析器/中间盒上如何低成本地识别"本应单包却分片"的异常响应、误杀合法大响应的代价、以及与 R7 TCP 回退的交互**缺少系统测量与评估（PAM 2021 测的是发生率，不是检测器）。
- **当代实现的系统化差异测量**：Ptacek-Newsham 的 OS 差异表是 1998 年的；2013–2021 的攻击工作假设解析器行为，但**2020 年代 DNS 软件栈（BIND/Unbound/PowerDNS/Knot、Windows/Linux/BSD、容器化转发器）对重叠/乱序/超时/超大分片响应的处理差异**没有可核查的公开系统对比（本次检索未发现 [待核实]）。
- **受控实验方法学**：如何**安全地**在隔离环境诱导大响应/伪造分片并做可复现实验（PMTUD 干预、大 DNSSEC 响应、ANY、EDNS buffer 操纵的组合），经典文献多为攻击描述而非实验方法学——这与 `lab-methods` 分工直接衔接。
- **IPv6 分片/新传输（DoT/DoH/DoQ）下的暴露面**：RFC 5722/6980 只覆盖 IPv6 ND；DoH/DoQ 绕过传统 53 端口观测，分片行为随传输层变化——经典文献少有覆盖（2018–2021 论文侧信道为主）。
- **注意**：以上缝隙必须与 `lit-recent`（2021–2026）核对；已知 2022–2026 已有大量后续（如 TMA 2026 IPv4 分片测量、SP 2026 语义漏洞、CCS 2025 RebirthDay 等），不要把"空白"说过头。

**（c）方法学可直接借用的经典结论：**
- 攻击前提必须写清 **on-path/off-path**（2013 系列为 off-path；Ptacek-Newsham 的 IDS 规避是 on-path 观测差异）；
- 必须写清**需猜/需绕的字段**（事务 ID、源端口、查询名；每个 16 bit；RFC 9715 §7.3 的熵论证可直接引用）；
- 必须说明**实验对象与部署现实**（BIND/Unbound；forwarder 固件；TLD 权威服务器）；
- 防御评估必须包含 **DNSSEC 验证不通过时的行为**（Herzberg & Shulman 摘要指出 <1% 解析器拒绝）与 **TCP 兜底是否真的安全**（ANRW 2021 的警告）。

## 7. 可核查引用清单（≥20 条）

**论文/报告**
1. Kent, C. A., & Mogul, J. C. (1987). *Fragmentation Considered Harmful*. Proc. ACM SIGCOMM'87 Workshop / ACM SIGCOMM CCR 17(5). DOI: 10.1145/55482.55524（另有 10.1145/55483.55524；TR 版 DEC WRL TN-87-2，URL 未核实）.
2. Bellovin, S. M. (1989). *Security Problems in the TCP/IP Protocol Suite*. ACM SIGCOMM CCR, 1989-04. DOI: 10.1145/378444.378449.
3. Ptacek, T. H., & Newsham, T. N. (1998). *Insertion, Evasion, and Denial of Service: Eluding Network Intrusion Detection*. Secure Networks, Inc. http://insecure.org/stf/secnet_ids/secnet_ids.html
4. Hlaváček, T. (2013). *IP fragmentation attack on DNS*. RIPE 67. https://ripe67.ripe.net/presentations/240-ipfragattack.pdf（内容据 RFC 9715 转述，[待核实]）
5. Herzberg, A., & Shulman, H. (2013). *Fragmentation Considered Poisonous, or: One-domain-to-rule-them-all.org*. IEEE CNS 2013, pp. 224–232. DOI: 10.1109/CNS.2013.6682711.
6. Shulman, H., & Waidner, M. (2014). *Fragmentation Considered Leaking: Port Inference for DNS Poisoning*. ACNS 2014, LNCS 8479, pp. 531–548. DOI: 10.1007/978-3-319-07536-5_31.
7. Schomp, K., Allman, M., & Rabinovich, M. (2014). *DNS Resolvers Considered Harmful*. ACM HotNets 2014. DOI: 10.1145/2670518.2673881.
8. Shulman, H., & Waidner, M. (2015). *Towards Security of Internet Naming Infrastructure*. ESORICS 2015. DOI: 10.1007/978-3-319-24174-6_1.
9. Göring, M., Shulman, H., & Waidner, M. (2018). *Path MTU Discovery Considered Harmful*. IEEE ICDCS 2018. DOI: 10.1109/ICDCS.2018.00088.
10. Brandt, M., Dai, T., Klein, A., Shulman, H., & Waidner, M. (2018). *Domain Validation++ For MitM-Resilient PKI*. ACM CCS 2018. DOI: 10.1145/3243734.3243790.
11. Zheng, X., Lu, C., Peng, J., Yang, Q., Zhou, D., Liu, B., Man, K., Hao, S., Duan, H., & Qian, Z. (2020). *Poison Over Troubled Forwarders: A Cache Poisoning Attack Targeting DNS Forwarding Devices*. USENIX Security 2020, pp. 577–593. https://www.usenix.org/conference/usenixsecurity20/presentation/zheng
12. Man, K., Qian, Z., Wang, Z., Zheng, X., Huang, Y., & Duan, H. (2020). *DNS Cache Poisoning Attack Reloaded: Revolutions with Side Channels*. ACM CCS 2020. DOI: 10.1145/3372297.3417280.
13. Man, K., Zhou, X., & Qian, Z. (2021). *DNS Cache Poisoning Attack: Resurrections with Side Channels*. ACM CCS 2021. DOI: 10.1145/3460120.3486219.
14. Dai, T., Shulman, H., & Waidner, M. (2021). *DNS-over-TCP considered vulnerable*. ACM ANRW 2021. DOI: 10.1145/3472305.3472884.
15. Moura, G. C. M., Müller, M., Davids, M., Wullink, M., & Hesselman, C. (2021). *Fragmentation, Truncation, and Timeouts: Are Large DNS Messages Falling to Bits?* PAM 2021. DOI: 10.1007/978-3-030-72582-2_27.
16. Kosek, M., Doan, T. V., Huber, S., & Bajpai, V. K. (2022). *Measuring DNS over TCP in the era of increasing DNS response sizes*. ACM SIGCOMM CCR 2022. DOI: 10.1145/3544912.3544918.

**标准/规范（rfc-editor.org 正文核实）**
17. RFC 791 (STD 5), Postel, 1981-09. https://www.rfc-editor.org/rfc/rfc791.txt
18. RFC 1035 (STD 13), Mockapetris, 1987-11. https://www.rfc-editor.org/rfc/rfc1035.txt
19. RFC 1858, Ziemba/Reed/Traina, 1995-10 (Informational). https://www.rfc-editor.org/rfc/rfc1858.txt
20. RFC 3128, Miller, 2001-06 (Informational, Updates 1858). https://www.rfc-editor.org/rfc/rfc3128.txt
21. RFC 5722, Krishnan, 2009-12 (Standards Track). https://www.rfc-editor.org/rfc/rfc5722.txt
22. RFC 6891 (STD 75), Damas/Graff/Vixie, 2013-04. https://www.rfc-editor.org/rfc/rfc6891.txt
23. RFC 6980, Gont, 2013-08 (Standards Track). https://www.rfc-editor.org/rfc/rfc6980.txt
24. RFC 7739, Gont, 2016-02 (Informational). https://www.rfc-editor.org/rfc/rfc7739.txt
25. RFC 7766, Dickinson et al., 2016-03 (Standards Track). https://www.rfc-editor.org/rfc/rfc7766.txt
26. RFC 7873, Eastlake/Andrews, 2016-05 (Standards Track). https://www.rfc-editor.org/rfc/rfc7873.txt
27. RFC 8085 (BCP 145), Eggert/Fairhurst/Shepherd, 2017-03. https://www.rfc-editor.org/rfc/rfc8085.txt
28. RFC 8200 (STD 86), Deering/Hinden, 2017-07. https://www.rfc-editor.org/rfc/rfc8200.txt
29. RFC 8482, Abley/Gudmundsson/Majkowski/Hunt, 2019-01 (Standards Track). https://www.rfc-editor.org/rfc/rfc8482.txt
30. RFC 8900 (BCP 230), Bonica/Baker/Huston/Hinden/Troan/Gont, 2020-09. https://www.rfc-editor.org/rfc/rfc8900.txt
31. RFC 9210 (BCP 235), Kristoff/Wessels, 2022-03. https://www.rfc-editor.org/rfc/rfc9210.txt
32. RFC 9715 (Informational), Fujiwara/Vixie, 2025-01. https://www.rfc-editor.org/rfc/rfc9715.txt
33. DNS Flag Day 2020 (2020-10-01). https://dnsflagday.net/2020/

**漏洞（NVD API 核实）**
34. CVE-1999-0128（Ping o' Death，1996-12-18）；CVE-1999-0015（Teardrop，1997-12-16）；CVE-1999-0104（Teardrop-2，1997-12-16）；CVE-1999-0258（Bonk，1998-02-13）；CVE-1999-0257（Nestea，1998-04-01）— https://nvd.nist.gov/vuln/detail/CVE-1999-0015 等。
35. CVE-2018-5391（FragmentSmack，Linux kernel 3.9+，2018-09-06，CVSS 3.1 7.5 HIGH，CWE-400/CWE-20）— https://nvd.nist.gov/vuln/detail/CVE-2018-5391

**补充经典（二次来源核实）**
36. Gilad, Y., & Herzberg, A. (2011). *Fragmentation Considered Vulnerable: Blindly Intercepting and Discarding Fragments*. 5th USENIX Workshop on Offensive Technologies (WOOT 2011)（经 USENIX Sec 2020 参考文献 [42]；[待核实]）.
37. Heffner, J. W., Chandler, B., & Mathis, M. (2007). *IPv4 Reassembly Errors at High Data Rates*.（经 USENIX Sec 2020 参考文献 [46]；venue [待核实]）.

> 计数：论文/报告 18 条 + 标准/行动 17 条 + CVE 6 个 = 远超 20 条可核查引用。

## 8. 未核实项与证据等级（给 Lead 的诚实清单）

1. **Kent & Mogul WRL TN-87-2 的在线 URL 未核实**（hpl.hp.com 链接失效，Wayback 无快照）；DOI/作者/venue 已核。正文描述为摘要级转述，未读全文。
2. **Bellovin 1989 是否直接讨论 IP 分片未证实**；仅作 off-path/协议安全综述引用，未读全文。
3. **Hlavacek RIPE 67 演讲内容未读**（PDF 无法文本抽取，仅核实文件存在与元数据）；其"PMTUD 干预导致分片"的描述来自 RFC 9715 §7.3 的转述。
4. **Herzberg & Shulman 2013 全文未读**（IEEE 闭源；S2 摘要被出版商 elided，摘要取自 OpenAlex）。但其**攻击机制已通过 USENIX Sec 2020 §2.2 的逐字综述补足**（见 §3.1：第 2 分片无 DNS/UDP 头与 question section → 绕过随机化）；**成功率、短期对策清单、是否讨论 on-path 变体仍 [待核实]**；直接引用本文结论时标"摘要级"。
5. **Shulman & Waidner 2014 全文未读**；"Fragmentation Considered Leaking" 中"leaking"与分片的具体因果链未证实（摘要只讲端口推断）。旁证：USENIX Sec 2020 参考文献 [66] 将其列为 defragmentation 前人工作之一，说明它与主题相关；但具体机制 [待核实]。
6. **USENIX Sec 2020（Zheng et al.）分片章节已确认**：PDF 目录流显示 §2.2 Defragmentation Attacks、§4 Defragmentation Attacks Targeting DNS Forwarders（§4.1–§4.4），正文含 "DNSSEC-based defragmentation attack" 原文与 §4.2 "Reducing PMTU: ineffective for DNS forwarder attacks."。**限制**：文本由 zlib 内容流恢复，字体重编码导致个别字符噪声，段落级完整语义未逐页校对；引用长引文前建议再核对原 PDF。
7. **PAM 2021 全文未读**（Springer 闭源），仅摘要；分片率具体数值 [待核实]。
8. **2019–2021 年当代解析器/OS 对重叠分片的处理策略无系统对比来源**（本次未检索到）；Ptacek-Newsham Figure 12 仅为 1998 年实测。该空白若写入报告，必须标 [待核实]/"未检索到"而非"不存在"。
9. **ANRW 2021 "DNS-over-TCP considered vulnerable" 摘要已核实**（S2 全文摘要：TCP 亦受分片攻击，Alexa top-100K 中 393 个域名的名称服务器可被强制源分片；UDP 下反而不能）。**全文未读**，具体测量方法与攻击可行性 [待核实]。
10. **Teardrop/Ping-of-Death 的具体触发机制未在 NVD 展开**；本文件只引用其描述，不写构造细节（安全边界）。
11. RFC 9715 的 R1–R7 原文使用小写 "should"（非 2119 大写 MUST/SHOULD；文档虽定义关键词但建议为小写），引用时保持原文大小写。RFC 9715 是 **Informational，不是 BCP**（与 RFC 8900 的 BCP 230 不同）。
12. 时间窗说明：RFC 9210（2022）与 RFC 9715（2025）超出 1987–2021 主窗，但为防御闭环必需，已在文中标注年份。
13. **Gilad & Herzberg WOOT 2011 元数据仅经二次来源核实**（USENIX Sec 2020 参考文献 [42]），未独立核实 WOOT 官方页面、页码与摘要；其内容描述据标题与引用脉络，[待核实·中]。
14. **Heffner et al. 2007 元数据经 USENIX Sec 2020 参考文献 [46] 二次核实**，venue 未核实（[待核实]）；仅引用其"高速链路 IPv4 重组错误"结论方向。
15. **方法学备注**：USENIX Sec 2020 PDF 文本恢复 = zlib 解压 + 内容流字面串提取，非标准 PDF 解析；因此 §2.2/§4.2 引文可能与排版原文有个别字符差异（引号/连字符），但语义与关键句已交叉比对（§2.2 与 §3.1/§5.2 的转述一致）。

---
*核实方法备注：所有联网核实均通过 bash `curl` 完成（RFC Editor、Crossref、OpenAlex、Semantic Scholar Graph API、Springer Link、USENIX 官网、NVD REST API、dnsflagday.net）。未使用 web_fetch。*
