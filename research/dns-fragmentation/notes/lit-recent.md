# 2021–2026 最新研究与新颖性威胁（lit-recent）

> 调研员：res-lit-recent｜检索与核实时间：2026-10-22（Asia/Shanghai）｜检索窗口：2021-01 至 2026-10
>
> **证据等级**：`[已核]` = 通过 OpenAlex/Crossref/S2/USENIX/RFC Editor/datatracker 官方 API 或页面确认标题、作者、venue、年份、DOI/URL；`[待核实]` = 仅见搜索摘要/二手引用或元数据不全，未读到原文；`[仅元数据]` = 元数据已核但摘要未取得。
>
> **方法说明**：主要用 `curl` 调 OpenAlex Works API、Semantic Scholar Graph API（检索+引文）、Crossref（DOI 精确核）、USENIX 官方论文页、IETF datatracker API、arXiv abs 页。**DBLP 官方 API 本次被 Anubis 反爬（HTTP 202 "Making sure you're not a bot!"）拦截，未能直接使用**；DBLP 线索改由 S2/OpenAlex 的 DBLP 外链交叉核对。web_fetch 按 Lead 指示未使用。
>
> 安全边界：本文仅做防御性文献调研，不含针对真实解析器/第三方网络的攻击操作步骤。

---

## 0. 一句话结论（先看这里）

截至 2026-10，用户构想的**三个组成部分已被不同程度占据**：

1. **"IP 分片会暴露 DNS 弱点"这一命题本身已被做掉**（Herzberg 2013 → Dai/Shulman/Waidner 2021 扩展到 TCP → RFC 9715 2025 给出运营建议）。
2. **"利用大响应第二片做攻击"已有 2025 USENIX Sec 的 RUC 论文**（Zhang 等）作为攻击原语公开，但其落点是 DNSSEC troubleshooting 缓存复用导致的**持续性 DoS**，**不是**分片处理机制本身的检测/缓解。
3. **"检测 DNS 分片攻击"已被 POPS（USENIX Sec 2025）明确覆盖**（摘要原文声称能检出 Suricata/Snort 漏掉的 *fragmentation attacks*），另有通用 IP 分片异常检测（Future Internet 2025）与缓存一致性检测（DNS-Sensor 2025）。
4. **后量子 DNSSEC 大响应→分片是 2023–2026 最活跃的新方向**（QBF/ARRF/mis-association/hybrid signatures），但**安全侧主要在研究"如何安全地分片"（方案构造），几乎没人做"如何检测/缓解分片被滥用"的运行时可观测检测层**。

→ **仍空白的子问题（详见 §6）**：DNS 语义感知（第二片/尾片 + RRSIG/签名字节结构 + TC 回退 + 重组状态机）的**运行时检测与缓解**、IPv6 DNS 分片的实际攻击面测量、后量子分片方案的**检测层**、解析器数据面（eBPF/XDP）上的分片检测性能评估。2026 年 FRAGJAM（Pan & Rossow, CISPA）刚刚证明"伪造 ICMP Frag Needed + 分片洪泛"对真实 UDP 服务（VPN/视频会议/RADIUS，DNS 同属 UDP 生态）可打出 DoS，**攻击侧仍在快速推进，而 DNS 解析器侧的分片检测/缓解仍是空白**。**中文文献与专利在"DNS 分片检测"上检索近乎空白**。

---

## 1. 直接相关核心（2021–2026）：分片 × DNS 的测量、攻击、防御

### 1.1 分片攻击面被系统化（与用户构想"命题层"直接重叠）

**R1. Poster: Fragmentation Attacks on DNS over TCP** `[已核]`
- 作者：Tianxiang Dai, Haya Shulman, Michael Waidner
- venue：IEEE ICDCS 2021 (poster)｜DOI `10.1109/ICDCS51616.2021.00118`｜URL: https://doi.org/10.1109/ICDCS51616.2021.00118
- 摘要（OpenAlex 重建）：首次证明 IP 分片攻击同样适用于 TCP 上的 DNS；对 100K Alexa 域名服务器测量，454 个域名易受 IP 分片攻击，其中 366 个**仅在 TCP 通信下**易受攻击；TCP 可被诱导分片到 <292 字节（UDP 不低于 548 字节），危害更大。结论是"用 TCP 替代 UDP 以规避分片攻击"的社区建议有风险。
- 与构想关系：直接支撑"DNS 大响应→分片→协议弱点"的立论，且**已把 DoTCP 回退路径也纳入攻击面**。
- 新颖性威胁：**直接重叠**（用户若把"分片弱点存在于 DNS"当新发现会被拒）。

**R2. DNS-over-TCP considered vulnerable** `[已核]`
- 作者：Tianxiang Dai, Haya Shulman, Michael Waidner
- venue：ACM ANRW 2021｜DOI `10.1145/3472305.3472884`｜URL: https://doi.org/10.1145/3472305.3472884
- 摘要：同组工作，系统性论证 TCP 并非分片攻击的避风港（摘要较短，细节见 R1 的技术报告版）。
- 与构想关系：同上，且提示"缓解建议（强制 TCP）本身可能引入新风险"——用户做缓解研究时必须回应这一点。
- 新颖性威胁：**直接重叠**。

**R3. Fragmentation, Truncation, and Timeouts: Are Large DNS Messages Falling to Bits?** `[已核]` `[仅元数据]`
- 作者：Giovane C. M. Moura, Moritz Müller, Marco Davids, Maarten Wullink, Cristian Hesselman（NLnet Labs/SIDN Labs）
- venue：PAM 2021（LNCS）｜DOI `10.1007/978-3-030-72582-2_27`｜URL: https://doi.org/10.1007/978-3-030-72582-2_27
- 摘要：测量大 DNS 消息在截断/分片/超时下的端到端表现（Lead 已核 DOI；本次未取得官方摘要全文，故标仅元数据）。
- 与构想关系：**用户构想的"测量基础"已由该文奠定**——大响应在真实网络中会分片、被丢弃、触发超时。
- 新颖性威胁：**直接重叠**（测量维度；需读全文找空白，如 IPv6/后量子场景）。
- 引文：S2 显示其 2021+ 被引包括 TMA 2026 IPv4 分片纵向测量（R10）、Kosek CCR 2022、Dikshit TNSM 2024 等。

**R4. Evaluating DNS Resiliency with Truncation, Fragmentation and DoTCP Fallback** `[已核]`
- 作者：Pratyush Dikshit, Mike Kosek, Nils Faulhaber, Jayasree Sengupta, Vaibhav Kumar Bajpai
- venue：IFIP Networking 2023｜DOI `10.23919/IFIPNetworking57963.2023.10186392`｜URL: https://doi.org/10.23919/IFIPNetworking57963.2023.10186392
- 摘要：用 10 个公共解析器、IPv4/IPv6、边缘与核心两种视角评估 DoTCP/DoUDP 的韧性、响应性与使用率（会议版）。
- 与构想关系：直接给出"哪些解析器会通告超大 EDNS(0) buffer、哪些不回退 TCP"的证据。
- 新颖性威胁：**直接重叠**（测量+缓解评估）。期刊版见 R5。

**R5. Evaluating DNS Resiliency and Responsiveness With Truncation, Fragmentation & DoTCP Fallback** `[已核]`
- 作者：同 R4
- venue：IEEE TNSM 2024｜DOI `10.1109/TNSM.2024.3365303`｜arXiv:2307.06131｜URL: https://arxiv.org/abs/2307.06131
- 摘要（arXiv 原文核）：14M+ 测量、2527 个 RIPE Atlas Probe；多数解析器 DoTCP/DoUDP 韧性相近；**3/10 解析器仍通告超大 EDNS(0) buffer，潜在导致分片**；面对权威大响应，解析器常常**不回退 DoTCP**，承担分片风险；DNS Flag Day 2020 的 1232 字节建议未被普遍遵守。
- 与构想关系：用户"受控实验诱导大响应"的最直接先例（它已给出真实测量基线）；其"未回退 TCP"发现是用户检测研究可用的**行为特征**。
- 新颖性威胁：**直接重叠**（测量部分）。可切入点：其 2023 数据是否覆盖 IPv6/后量子/分片检测信号。

**R6. Measuring DNS over TCP in the era of increasing DNS response sizes** `[已核]` `[仅元数据]`
- 作者：Mike Kosek, Trinh Viet Doan, Simon Huber, Vaibhav Kumar Bajpai
- venue：ACM SIGCOMM CCR 2022｜DOI `10.1145/3544912.3544918`｜URL: https://doi.org/10.1145/3544912.3544918
- 摘要：测量响应尺寸增长时代 DNS-over-TCP 的使用与表现（本次仅核元数据；arXiv:2205.00746 可补读）。
- 与构想关系：提供"DoTCP 回退"这条缓解路径的真实使用率基线。
- 新颖性威胁：**相邻**（测量）。

**R7. Characterizing DNS query response sizes through active and passive measurements** `[已核]` `[仅元数据]`
- 作者：Kensuke Fukuda, Yoshitaka Aharen, Shinta Sato, Takeshi Mitamura
- venue：IEEE/IFIP NOMS 2022｜DOI `10.1109/NOMS54207.2022.9789912`｜URL: https://doi.org/10.1109/NOMS54207.2022.9789912
- 摘要：主被动结合刻画 DNS 响应尺寸分布（元数据已核）。
- 与构想关系：为"多大比例响应会发生 IP 分片"提供参数。
- 新颖性威胁：**相邻**。

### 1.2 大响应/分片作为攻击原语（用户"攻击面"部分已被占）

**R8. Your Shield is My Sword: A Persistent Denial-of-Service Attack via the Reuse of Unvalidated Caches in DNSSEC Validation（RUC）** `[已核]` ★必核
- 作者：Shuhan Zhang（清华/清华深研院）, Shuai Wang, Li Chen（中关村实验室）, Dan Li, Baojun Liu（清华）
- venue：34th USENIX Security Symposium 2025, pp. 3517–3535｜URL: https://www.usenix.org/conference/usenixsecurity25/presentation/zhang-shuhan
- 摘要（官方页原文核）：DNSSEC 已部署于 90%+ 顶级区；解析器为容错允许公众"排障式"查询而不强制验证 DNSSEC，但缓存/复用排障数据与常规解析未加区分，形成新攻击面。作者提出 RUC 攻击：利用 DNSSEC 排障机制向解析器缓存注入伪造数据，后续常规解析持续复用未验证数据，导致**持续性 DNSSEC 验证失败**；未验证缓存 TTL 不受限，一次注入可造成 **>24 小时**解析中断。全网测量显示 BIND、Cloudflare、OpenDNS 受影响，均已确认并修补。论文呼吁对排障数据制定正式规范。
- **关于"第二片 RRSIG 操作"**（Lead 已核论文正文）：论文含 "Approach #1: Manipulating RRSIG records in the 2nd fragment of a large DNS response"。**评估：该文把"操纵大响应第二片中的 RRSIG"作为实现缓存注入的*手段之一*，落点是 DNSSEC 排障缓存复用导致的 DoS；其防御建议是"排障数据处理的正式规范"，并未研究分片处理/重组本身的检测与缓解，也没有给出分片级检测器或 IPv6 场景。**
- 与构想关系：**这是用户"第二片"构想最危险的先例**——用户若以"发现第二片可被操纵"为创新点，直接撞车。
- 新颖性威胁：**直接重叠（攻击原语层面）**；但**防御/检测层面仍未覆盖**，是用户可切入的缝隙。
- 备注：该摘要官方页未提及第二片，第二片细节来自 Lead 核实的论文正文；引用时建议注明"见论文 §Approach #1"。

**R9. POPS: From History to Mitigation of DNS Cache Poisoning Attacks** `[已核]` ★必核
- 作者：Yehuda Afek, Harel Berger, Anat Bremler-Barr（Tel Aviv University）
- venue：34th USENIX Security Symposium 2025, pp. 3537–3556｜URL: https://www.usenix.org/conference/usenixsecurity25/presentation/afek｜arXiv:2501.13540（https://arxiv.org/abs/2501.13540）
- 摘要（arXiv 原文核）：POPS 是可集成进 IPS 的 DNS 缓存投毒**检测+缓解**系统。检测模块用 3 条简单规则；缓解模块利用 DNS 头的 **TC 标志**（触发 TCP 回退），激活后宣称零误报/漏报。对 2002 年至今的历史统计型投毒攻击回测：所有网络型统计投毒均被缓解，攻击成功率仅 0.0076%（因 5 个恶意包在检测激活前通过）。相比 Suricata/Snort 只用 20%–50% 时间、检查 5%–10% 的包，且**能检出 Suricata 与 Snort 都漏掉的 DNS 缓存投毒攻击——包括 fragmentation attacks**。
- 与构想关系：**对用户"检测"构想的头号威胁**。它已把"分片攻击"列为可检出的攻击类别，并已用 TC 标志做缓解。
- 新颖性威胁：**直接重叠（检测+缓解方向）**。差异化缝隙：POPS 是**规则化统计投毒检测**，未（在其摘要/公开描述层面）涉及 ① DNS 语义感知的分片重组状态机（第二片/尾片/RRSIG 结构）② IPv6 分片 ③ 后量子大响应分片 ④ 对规避（evasion）的对抗性评估 ⑤ 数据面性能。用户必须在这些点上做出**可测量的增量**，否则会被审稿人直接指到 POPS。
- 备注：ACM DL 版 10.5555/3766078.3766260（Lead 已核）；DBLP 因反爬未直连。

**R10. A Longitudinal Study of IPv4 Fragmentation Characteristics in Internet Traffic** `[已核]` `[仅元数据]`
- 作者：Lucas Aubard, Kensuke Fukuda, Johan Mazel, Gilles Guette, Pierre Chifflier
- venue：TMA 2026（Network Traffic Measurement and Analysis Conference）｜DOI `10.23919/TMA71232.2026.11695507`｜URL: https://doi.org/10.23919/TMA71232.2026.11695507
- 摘要：互联网流量中 IPv4 分片特征的纵向测量（OpenAlex 仅给 "International audience"，摘要待读原文；S2 显示它引用了 Moura PAM 2021）。
- 与构想关系：2026 年最新的"分片在真实流量中长什么样"基线——用户做检测必须有误报基线，这篇是必引对标。
- 新颖性威胁：**相邻**（通用分片测量；若用户做 DNS 专用分片测量则仍有空间）。

**R11. Taming DNS Responses: A Measurement Study of Response Size and Its Impact** `[已核]`
- 作者：Zihan Li, Wenhao Wu, Zi Wang, Y. Tian, Chuan Gao, Q. Li, Yiming Xia, Zhenyu Li
- venue：ACM IMC 2026｜DOI `10.1145/3777912.3839801`｜URL: https://doi.org/10.1145/3777912.3839801
- 摘要（原文核）：现代 DNS 正从"名字解析"演变为结构化元数据/服务发现的载体，响应载荷持续增长，使**响应尺寸成为放大风险的中心**；但真实网络中响应尺寸行为仍缺乏全局系统认识。论文做响应尺寸及其影响的测量。
- 与构想关系：2026 年最新、与"大响应"母题最贴的测量工作；用户"诱导大响应"的实验设计可引用其分类与影响面。
- 新颖性威胁：**相邻**（若其含分片比例章节则接近直接重叠，需读全文确认）。

**R12. DNSBomb: A New Practical-and-Powerful Pulsing DoS Attack Exploiting DNS Queries-and-Responses** `[已核]`
- 作者：Xiang Li, Dashuai Wu, Haixin Duan, Qi Li
- venue：IEEE S&P 2024｜DOI `10.1109/SP54263.2024.00264`｜URL: https://doi.org/10.1109/SP54263.2024.00264
- 摘要（原文核）：把 DNS 的 timeout、query aggregation、response fast-returning 等"有益机制"转化为攻击向量，将低速率查询累积并放大成大尺寸响应，再聚合成短时高带宽脉冲打垮目标；在 10 款主流 DNS 软件、46 个公共 DNS 服务、约 180 万开放解析器上评估。
- 与构想关系：证明"大响应本身即放大器"；用户若研究"大响应分片"的经济学/放大面，需与 DNSBomb 划清（DNSBomb 不依赖分片，但可叠加）。
- 新颖性威胁：**相邻**。

**R13. The Harder You Try, The Harder You Fail: The KeyTrap Denial-of-Service Algorithmic Complexity Attacks on DNSSEC** `[已核]`
- 作者：Elias Heftrig, Haya Schulmann, Niklas Vogel, Michael Waidner
- venue：ACM CCS 2024｜DOI `10.1145/3658644.3670389`｜arXiv:2406.03133｜URL: https://arxiv.org/abs/2406.03133
- 摘要（原文核）：DNSSEC 遵循 Postel 定律"发送要保守但仍需把所有相关密钥/签名都发给验证方"，攻击者构造含大量密钥/签名的 DNSSEC 响应，触发解析器验证的**算法复杂度爆炸**（CPU DoS）。与"大响应"直接相关（响应必然巨大→UDP 需分片）。
- 与构想关系：**KeyTrap 是"大 DNSSEC 响应→分片"攻击面的另一条已被占路径**；其修复讨论见 R14。
- 新颖性威胁：**相邻**（攻击目标 CPU 而非分片重组；但"大 DNSSEC 响应"母题重叠）。

**R14. Protocol Fixes for KeyTrap Vulnerabilities** `[已核]` `[仅元数据]`
- 作者：Elias Heftrig, Haya Schulmann, Niklas Vogel, Michael Waidner
- venue：2024（ACM，DOI `10.1145/3673422.3674902`）｜URL: https://doi.org/10.1145/3673422.3674902
- 摘要：针对 KeyTrap 的协议层修复（元数据已核，摘要待读）。
- 与构想关系：**重要先例**：说明"大 DNSSEC 响应"方向的缓解已有协议级工作；用户做缓解需引用并区分。
- 新颖性威胁：**相邻**。

**R15. TuDoor Attack: Systematically Exploring and Exploiting Logic Vulnerabilities in DNS Response Pre-processing with Malformed Packets** `[已核]`
- 作者：Xiang Li, Wei Xu, Baojun Liu, Mingming Zhang, Zhou Li, Jia Zhang, Deliang Chang, Xiaofeng Zheng, Chuhan Wang, Jianjun Chen, Haixin Duan, Qi Li
- venue：IEEE S&P 2024｜DOI `10.1109/SP54263.2024.00172`｜URL: https://doi.org/10.1109/SP54263.2024.00172
- 摘要（原文核）：系统分析 DNS RFC 与实现，发现三类逻辑漏洞，用畸形 DNS 响应包实现缓存投毒、DoS、资源消耗攻击；24 款主流 DNS 软件（BIND/PowerDNS/Microsoft DNS 等）受影响。
- 与构想关系：**"分片之外的畸形大响应包"路径已被占**；TuDoor 的 fuzz 方法可借鉴，但用户若只做"畸形分片"会与其相邻重叠。
- 新颖性威胁：**相邻**。

**R16. RebirthDay Attack: Reviving DNS Cache Poisoning with the Birthday Paradox** `[已核]`
- 作者：Xiang Li, Mingming Zhang, Zuyao Xu, Fasheng Miao, Yuqi Qiu, Baojun Liu, Jia Zhang, Xiaofeng Zheng, Haixin Duan, Zheli Liu, Yunhai Zhang, Dunqiu Fan
- venue：ACM CCS 2025｜DOI `10.1145/3719027.3744832`｜URL: https://doi.org/10.1145/3719027.3744832
- 摘要（原文核）：复活 2002 年后失效的经典生日悖论缓存投毒；利用 DNS 扩展（ECS option）实现中**协议合规但未被充分理解**的漏洞绕过查询聚合机制；22 款主流 DNS 软件中 18 款受影响。
- 与构想关系：2025 年最热的缓存投毒新路径（非分片），是用户"分片视角"的竞争性叙事；也是"分片检测之外还有大量非分片漏洞"的证据，用户报告需限定范围。
- 新颖性威胁：**相邻**（同为解析器缓存安全，但机制非分片）。

**R17. DNS Cache Poisoning Attack: Resurrections with Side Channels** `[已核]`
- 作者：Keyu Man, Xin'an Zhou, Zhiyun Qian
- venue：ACM CCS 2021｜DOI `10.1145/3460120.3486219`｜URL: https://doi.org/10.1145/3460120.3486219
- 摘要：用网络侧信道（IP ID、ICMP 等）去随机化 UDP 源端口，复活缓存投毒（原文摘录）。IP ID 侧信道与分片/重组共享底层机制。
- 与构想关系：说明"IP 层侧信道去随机化"是成熟子领域；用户若做"分片 ID 预测"检测需引用。
- 新颖性威胁：**相邻**。

**R18. From IP to transport and beyond: cross-layer attacks against applications** `[已核]`
- 作者：Tianxiang Dai, Philipp Jeitner, Haya Shulman, Michael Waidner
- venue：ACM SIGCOMM 2021｜DOI `10.1145/3452296.3472933`｜URL: https://doi.org/10.1145/3452296.3472933
- 摘要：首次系统比较 IP 层操纵、域间路由劫持、端口侧信道探测三类缓存投毒方法，并比较有效性/适用性/隐蔽性（原文摘录）。
- 与构想关系：为"IP 层（含分片）操纵"提供方法论坐标；用户做检测需对齐其攻击分类。
- 新颖性威胁：**相邻**。

### 1.3 检测/缓解侧（用户"防御"部分的直接竞争者）

**R19. A Deterministic, Rule-Based Framework for Detecting Anomalous IP Packet Fragmentation** `[已核]`
- 作者：Maksim Iavich, Vladimer Svanadze, Oksana Kovalchuk
- venue：Future Internet（MDPI）2025/2026, 18(1):19｜DOI `10.3390/fi18010019`｜URL: https://doi.org/10.3390/fi18010019
- 摘要（原文核）：轻量规则化框架检测/分类分片 IP 流量；依据 RFC 791 语义检查 offset 对齐、TTL 一致性、payload 规律性，输出 NONE/MISCONFIG/ATTACK 三类；用 1 万包合成数据集（开源）+ CIC-IDS-2017 真实数据验证，受控集准确率 99.23%。
- 与构想关系：**通用分片检测已有 2025/2026 工作**，且强调"确定性、可解释、轻量"——正是用户想做的检测形态。**但它不 DNS-aware**（不解析 DNS 语义、不区别第二片 RRSIG、不处理大响应合法分片）。
- 新颖性威胁：**相邻，但对"通用分片异常检测"这一 framing 构成直接重叠**。用户必须强调 DNS 语义层（响应结构/签名/TC 回退）与误报控制才有增量。

**R20. DNS-Sensor: A Sensor-Driven Architecture for Real-Time DNS Cache Poisoning Detection and Mitigation** `[已核]`
- 作者：Haisheng Yu, Xuebiao Yuchi, Xue Song Yang, Xue Yang, Hongtao Li, Xingxing Yang, Wei Wang
- venue：Sensors（MDPI）2025, 25(22):6884｜DOI `10.3390/s25226884`｜URL: https://doi.org/10.3390/s25226884
- 摘要（原文核）：分布式传感器网络持续扫描 DNS 缓存记录并与权威数据比对，检测缓存投毒异常并缓解；明确指出"DNS Forwarder fragmentation 与侧信道攻击"抬升了投毒可能性（原文点名 fragmentation）。
- 与构想关系：**检测类对标**（Lead 已列）。它检测的是"缓存内容不一致"，不是"分片事件本身"；其威胁模型把 fragmentation 列为诱因。
- 新颖性威胁：**相邻**（同一防护目标，不同信号源）。

**R21. Attacking Connection Tracking Frameworks as used by Virtual Private Networks** `[已核]`
- 作者：Benjamin Mixon-Baca, Jeffrey Knockel, Diwen Xue, Tarun Ayyagari, Deepak Kapur, Roya Ensafi, Jedidiah R. Crandall
- venue：PoPETs 2024(4)｜DOI `10.56553/popets-2024-0070`｜URL: https://doi.org/10.56553/popets-2024-0070
- 摘要（原文核）：发现 "port shadow" 这一连接跟踪层利用原语，构造四种 VPN 攻击（拦截/重定向/去匿名/端口扫描）；根因在现代连接跟踪框架。
- 与构想关系：**"分片/重组状态被中间盒错误共享"这一相邻机制**已被研究；用户测解析器所在主机的分片重组表污染时需引用。
- 新颖性威胁：**相邻**。

**R22. A Closer Look at IPv6 IP-ID Behavior in the Wild** `[已核]` `[仅元数据]`
- 作者：Fengming Huang, Yifan Yang, Zhenzhong Yang, Bingnan Hou, Yingwen Chen, Zhiping Cai
- venue：LNCS 2025（DOI `10.1007/978-3-031-85960-1_2`）｜URL: https://doi.org/10.1007/978-3-031-85960-1_2
- 摘要：IPv6 分片依赖 32-bit Fragment Identification；该文测量真实网络中 IPv6 IP-ID 行为（元数据已核）。
- 与构想关系：**IPv6 DNS 分片的"ID 可预测性/碰撞"正是用户建模伪造分片时的核心变量**；这是最新测量基线。
- 新颖性威胁：**相邻**（通用 IPv6，非 DNS 专用）。

**R23. Research on Security Protection Evasion Mechanism Based on IPv6 Fragment Headers（FragEva6）** `[已核]`
- 作者：Bin Lin, Liancheng Zhang, Yi Guo, Hongtao Zhang, Yakai Fang
- venue：IEEE LCN 2024｜DOI `10.1109/LCN60385.2024.10639756`｜URL: https://doi.org/10.1109/LCN60385.2024.10639756
- 摘要（原文核）：IPv6 分片头可被用于绕过安全设备；RFC 7112 虽提示该风险但缺乏系统评估。提出 FragEva6 行为模型、16 类行为测试集，评测 17 款主流 OS 与 4 款安全系统：最新 Windows/Apple 系统符合 RFC 7112，其他（含部分安全设备）存在绕过。
- 与构想关系：**"分片即 IDS/IPS 规避"这一用户关键词已被 2024 工作占住**（IPv6 侧），且直接给出"安全设备漏检"证据。
- 新颖性威胁：**直接重叠（IDS evasion 子问题）**；用户的差异化必须落在 DNS 协议语义。

**R24. A New Model for Testing IPv6 Fragment Handling** `[已核]` `[仅元数据]`
- 作者：Edoardo Di Paolo, Enrico Bassetti, Angelo Spognardi
- venue：LNCS 2024（DOI `10.1007/978-3-031-51476-0_14`）｜URL: https://doi.org/10.1007/978-3-031-51476-0_14
- 摘要：提出测试 IPv6 分片处理的新模型（元数据已核）。
- 与构想关系：用户"受控实验/工件"可直接复用其测试模型；也说明"IPv6 分片处理一致性"是活跃可发表题目。
- 新颖性威胁：**相邻**。

**R25. A Flushing Attack on the DNS Cache（DNS CacheFlush）** `[已核]`
- 作者：Yehuda Afek, Anat Bremler-Barr, Shoham Danino, Yuval Shavitt
- venue：33rd USENIX Security Symposium 2024, pp. 2299–2314｜URL: https://www.usenix.org/conference/usenixsecurity24/presentation/afek
- 摘要（官方页原文核）：暴露 DNS 解析器缓存的新型攻击 DNS CacheFlush：绕过解析器缓存保护机制，用高速率"看似存在"的域名解析请求冲刷良性缓存（LRU thrash），低速率攻击即可产生持续高插入率；实验中 8,000 qps 攻击下每秒查询一次的域名缓存未命中率 95.7%，2GB 缓存解析器良性吞吐下降 88.3%。论文建议**在解析器处理前丢弃含大量 server name 的权威应答（长 referral、长 CNAME 链）**——这类应答恰是"大响应→分片"的高危来源。
- 与构想关系：Afek 组（POPS 同组）同时在做"缓存状态操纵"与"大响应预处理"；其"处理前丢弃大/长应答"的建议与用户的缓解设计直接相关（可作为对比基线，也可作为"简单丢弃会误伤合法后量子大响应"的反例）。
- 新颖性威胁：**相邻**（DoS 目标为缓存 LRU，非分片重组）。

**R25b. FRAGJAM: DoS Attacks Using IP Reassembly Congestion** `[已核]` ★2026 重点
- 作者：Yepeng Pan, Christian Rossow（CISPA Helmholtz Center）
- venue：2026（CISPA 报告，DOI `10.60882/cispa.32770800`）｜URL: https://doi.org/10.60882/cispa.32770800
- 摘要（OpenAlex 重建原文核）：UDP（DNS、视频会议等）依赖 IP 分片，分片既带来安全问题也带来可靠性问题；Linux 的 IP 分片重组依赖 per-netns buffer 上限，因此**针对依赖 IP 分片的 UDP 服务的经典资源耗尽 DoS 是可能的**，但真实服务脆弱性未被系统研究。本文评估该攻击对 VPN、视频会议、RADIUS 等真实 UDP 服务提供商的可行性：服务端侧，许多厂商在收到攻击者伪造的 **ICMP Fragmentation Needed** 后会以人为缩小的 path MTU 分片下发流量；客户端侧，可用伪造分片洪泛 Linux NAT 网关丢弃服务端到客户端的分片流量；模拟实验证明攻击对 Zoom、ExpressVPN 等现实可行，并已做协调披露。
- 与构想关系：**2026 年最新、与用户"分片+伪造分片+PMTUD"最贴近的攻击侧工作**。它把"伪造 ICMP Frag Needed 诱导小 MTU / 分片"变成可复现攻击链，且明确以 DNS 所属的 UDP 服务生态为背景。
- 新颖性威胁：**相邻（攻击侧很接近）**；但 FRAGJAM 不做 DNS 语义、不做检测器、不研究解析器侧缓解 → 用户的**检测/缓解与 DNS 语义**空间仍在，且必须引用 FRAGJAM 作为"伪造分片威胁真实性"的最新证据。

**R26. QDCR: DNS–QUIC Cross-Protocol Traffic Amplification for Denial-of-Service Attacks** `[待核实]`
- 作者：待核（S2 元数据无作者字段）
- venue：IEEE Transactions on Networking 2026｜DOI `10.1109/TON.2026.3725688`｜URL: https://doi.org/10.1109/TON.2026.3725688
- 摘要：DNS–QUIC 跨协议流量放大 DoS（仅 S2 题录，未读摘要）。
- 与构想关系：2026 最新放大类工作，说明"大响应放大器"仍在活跃发表；但非分片机制。
- 新颖性威胁：**相邻**（[待核实] 证据等级低）。

### 1.4 2026 年最新的解析器/协议漏洞（竞争性叙事）

**R27. One Char to Rule Them All: Systematically Exploring and Exploiting DNS Silent Vulnerabilities in Domain Name Resolution** `[已核]` `[仅元数据]`
- 作者：Fasheng Miao, Xinqi Li, Changqing An, Wenbin Xu, Jilong Wang
- venue：IEEE S&P 2026｜DOI `10.1109/SP63933.2026.00260`｜URL: https://doi.org/10.1109/SP63933.2026.00260
- 摘要：系统性挖掘域名解析中的"静默漏洞"（仅元数据 + S2 引文显示其引用 Herzberg 2013，说明其涉猎分片/缓存投毒谱系）。
- 与构想关系：2026 顶会仍在出解析器漏洞论文，竞争激烈；用户定位需避开"再找一个解析器 bug"。
- 新颖性威胁：**相邻**。

**R28. Should I Trust You? Rethinking the Principle of Zone-Based Isolation DNS Bailiwick Checking（CUCKOO DOMAIN）** `[已核]`
- 作者：Yuxiao Wu, Yunyi Zhang, Chaoyi Lu, Baojun Liu
- venue：NDSS 2026｜DOI `10.14722/ndss.2026.240330`｜URL: https://doi.org/10.14722/ndss.2026.240330
- 摘要（原文核）：主流解析器的 bailiwick 检查普遍"最小约束即缓存"，提出 CUCKOO DOMAIN 投毒攻击：控制单个子域即可攻陷父域/兄弟域。
- 与构想关系：解析器缓存信任边界研究，与"分片重组信任边界"同构——可作为用户**检测规则设计**的类比与引用。
- 新颖性威胁：**相邻**。

---

## 2. 后量子 DNSSEC 大响应/分片（2023–2026 最活跃方向，直接决定选题生命力）

**R29. Post-Quantum DNSSEC over UDP via QNAME-Based Fragmentation（QBF）** `[已核]` ★必核
- 作者：Aditya Singh Rawat, Mahabir Prasad Jhanwar（Ashoka University）
- venue：Cryptology ePrint 2024/1320；正式出版 SPACE 2024（LNCS）｜DOI `10.1007/978-3-031-51583-5_4`｜URL: https://eprint.iacr.org/2024/1320
- 摘要（ePrint 原文核）：常规网络中 >1232 字节的 DNS(SEC) 消息要么被 IP 分片、要么需 TCP 重传；而 IP 分片被认为不可靠、且相当比例服务器不支持 TCP。提出 **QNAME-Based Fragmentation (QBF)**：在 DNS 层用标准记录把大后量子 DNS(SEC) 消息分片/重组，仅 1 个 RTT；实验证明以 Falcon-512、Dilithium-2 或 SPHINCS+ 为签名算法时，QBF 上解析 A 查询的速度与现网 ECDSA-P256/RSA-2048 相当。
- 与构想关系：**"大响应→分片"未来会因后量子而更普遍**，这是用户研究动机的最强论据；但 QBF 是**方案构造（如何安全分片）**，不是检测/缓解"分片被滥用"。
- 新颖性威胁：**相邻**（动机层支撑，方法层不重叠）。

**R30. Post-Quantum Signatures in DNSSEC via Request-Based Fragmentation（ARRF）** `[已核]` `[仅元数据]`
- 作者：Jason Goertzen, Douglas Stebila
- venue：LNCS 2023（DOI `10.1007/978-3-031-40003-2_20`）｜URL: https://doi.org/10.1007/978-3-031-40003-2_20
- 摘要：提出 ARRF（请求驱动的资源记录分片）以在 UDP 上承载后量子 DNSSEC 大响应（元数据已核；摘要待读）。
- 与构想关系：QBF 之外的第二条"协议内分片"路线；其安全缺陷由 R32 修补。
- 新颖性威胁：**相邻**。

**R31. Securing Post-Quantum DNSSEC Against Fragmentation Mis-Association Threat** `[已核]` ★必核
- 作者：Manohar Raavi, Simeon Wuthier, Sang-Yoon Chang
- venue：IEEE ICC 2024｜DOI `10.1109/ICC51166.2024.10622607`｜URL: https://doi.org/10.1109/ICC51166.2024.10622607
- 摘要（原文核，截断）：DNSSEC 当前 UDP 上限 1232 字节；NIST 后量子签名使响应超出限制，**PQC 与现行 DNS 不兼容**；先前研究提出分片 DNSSEC 消息，但分片使 DNSSEC 暴露于 **Fragmentation Mis-Association threat**（传统 IP 分片语境中的攻击在经典 DNSSEC 下不适用，因为无需分片）。该文把自身与先前研究区分，提出防护。
- 与构想关系：**这是"后量子大响应分片的安全防御"最接近用户构想的已发表工作**。它明确把 mis-association 当作威胁并给防御方案。
- 新颖性威胁：**直接重叠（后量子分片防御方向）**。用户必须读全文确认其防御是"协议设计"还是"检测"，并据此找缝（例如：它不解决的 IPv6 分片/PMTUD 缓存/运行时检测）。
- 备注：摘要被 OpenAlex 截断，完整摘要需读 IEEE 页；本条目按"已核元数据+部分摘要"记。

**R32. Security Considerations for Post-Quantum Signatures in DNSSEC via Request-Based Fragmentation** `[已核]` ★必核
- 作者：Cameron McGowan, James Liu, Sushmita Ruj
- venue：Companion Proceedings of ACM Web Conference 2025 (WWW '25 Companion)｜DOI `10.1145/3701716.3715585`｜URL: https://doi.org/10.1145/3701716.3715585
- 摘要（原文核）：针对近期提出的 ARRF（请求驱动资源记录分片）后量子 DNSSEC 技术，指出其存在**内存耗尽漏洞**；在最小性能代价下修复该漏洞，使 ARRF 更接近真实部署。
- 与构想关系：**"分片方案自身可被 DoS"已被发现并修补**——用户若提"分片引入新 DoS"不新；但该文是协议修补，不是**检测器**。
- 新颖性威胁：**相邻**（防御方案内部修补，非检测/测量）。

**R33. Poster: Hybrid Signatures for Post-Quantum DNSSEC: A Real-World Evaluation** `[已核]`
- 作者：Fokke Heikamp, Syed Wajid Ali Shah, Je Sen Teh, Zubair Ahmed Baig, Robin Doss, Dongxi Liu, Warren Armstrong
- venue：ACM IMC 2026 (poster)｜DOI `10.1145/3777912.3847598`｜URL: https://doi.org/10.1145/3777912.3847598
- 摘要（原文核）：为商用 DNS 软件做支持**混合签名（经典+PQC）+ UDP 分片**的改造，并建真实测试床评估；开源软件与测试床以促可复现研究。
- 与构想关系：**2026 年"后量子大响应必须分片"已进入真实部署评估**；用户实验环境可复用其开源栈。
- 新颖性威胁：**相邻**（部署评估）。

**R34. Quantum-safe Signatureless DNSSEC** `[已核]` `[仅元数据]`
- 作者：Aditya Singh Rawat, Mahabir Prasad Jhanwar
- venue：ACM ASIACCS 2025｜DOI `10.1145/3708821.3710837`｜URL: https://doi.org/10.1145/3708821.3710837
- 摘要：无签名后量子 DNSSEC 方案（元数据已核）。它绕开"大签名→大响应"路线，是 QBF/ARRF 的竞争路线。
- 与构想关系：若该路线成熟，会削弱"后量子大响应必然分片"的论据——用户报告需提及。
- 新颖性威胁：**相邻**（反向证据）。

**R35. Post-Quantum DNSSEC: A Systematic Review of Transport Constraints, Security Vulnerabilities, and Migration Pathways** `[已核]`
- 作者：Maksim Iavich, Audrius Lopata, Nino Bagalishvili
- venue：Mathematics（MDPI）2026, 14(14):2555｜DOI `10.3390/math14142555`｜URL: https://doi.org/10.3390/math14142555
- 摘要（原文核）：按 PRISMA 2020 系统综述 2020–2025 年 27 篇同行评议工作，五维框架：传输约束、密码敏捷、DoS 韧性、运营部署、标准化准备度；指出所有 NIST PQC 签名方案都超出 1232 字节 UDP 负载限制、现有提案无一同时解决全部约束。
- 与构想关系：**2026 年最新综述**，用户做文献综述的必引；其"传输约束/DoS 韧性"维度正是用户构想的邻域，需引用并指出其未覆盖"分片运行时检测"。
- 新颖性威胁：**相邻**（综述占位，但不做检测）。

**R36. Quantum-Resistant Domain Name System: A Comprehensive System-Level Study** `[已核]` `[仅元数据]`
- 作者：Juyoul Lee, Sanzida Hoque, Abdullah Aydeger, Engin Zeydan
- venue：arXiv:2506.19943 (2025)｜DOI `10.48550/arXiv.2506.19943`｜URL: https://arxiv.org/abs/2506.19943
- 摘要：量子抗性 DNS 的系统级研究（元数据已核）。
- 与构想关系：后量子 DNS 的系统评估，可作背景引用。
- 新颖性威胁：**相邻**。

**R37. Implementing and Evaluating Post-Quantum DNSSEC in CoreDNS** `[已核]` `[仅元数据]`
- 作者：待核（S2 题录）
- venue：ACM MSWiM 2025；arXiv:2507.09301｜URL: https://arxiv.org/abs/2507.09301
- 摘要：在 CoreDNS 中实现并评估后量子 DNSSEC（元数据已核）。
- 与构想关系：真实解析器实现证据，用户实验可用。
- 新颖性威胁：**相邻**。

**R38. Double-Signed Fragmented DNSSEC for Countering Quantum Threat** `[已核]` `[仅元数据]`
- 作者：待核（S2 题录）
- venue：arXiv:2411.07535 (2024)；会议版 ITNAC 2025 DOI `10.1109/ITNAC66378.2025.11302658`｜URL: https://arxiv.org/abs/2411.07535
- 摘要：双签+分片的后量子 DNSSEC 过渡方案（元数据已核）。
- 与构想关系：分片方案族谱的一部分；说明"分片"是后量子 DNS 的主流工程选择。
- 新颖性威胁：**相邻**。

**R39. Poster: Off-Path DNSSEC Downgrade Attacks** `[已核]`
- 作者：Elias Heftrig, Haya Shulman, Michael Waidner
- venue：ACM SIGCOMM 2023 (poster)｜DOI `10.1145/3603269.3610840`｜URL: https://doi.org/10.1145/3603269.3610840
- 摘要：离路 DNSSEC 降级攻击（元数据已核）；属于"大响应/分片/截断"可利用的降级面。
- 与构想关系：分片与截断常被用于诱导降级；用户检测规则需覆盖降级信号。
- 新颖性威胁：**相邻**。

**R40. Poster: The Unintended Consequences of Algorithm Agility in DNSSEC** `[已核]` `[仅元数据]`
- 作者：Elias Heftrig, Haya Shulman, Michael Waidner
- venue：ACM CCS 2022 (poster)｜DOI `10.1145/3548606.3563517`｜URL: https://doi.org/10.1145/3548606.3563517
- 摘要：DNSSEC 算法敏捷性的非预期后果（元数据已核），与"响应尺寸/多算法并行导致大响应"相关。
- 与构想关系：解释"为什么响应会变大"（多签名并存），支撑动机。
- 新颖性威胁：**相邻**。

---

## 3. 标准 / IETF 动态（用户缓解建议必须落地的语境）

**S1. RFC 9715: IP Fragmentation Avoidance in DNS over UDP** `[已核，Lead 已核正文]`
- 作者：K. Fujiwara (JPRS), P. Vixie (AWS Security)｜2025-01｜Informational（**不是 BCP**）｜URL: https://www.rfc-editor.org/rfc/rfc9715.txt
- 内容：EDNS(0) 允许大 UDP 响应→更易分片→分片已暴露应用协议弱点；建议限制响应尺寸、必要时 TCP 回退。
- 与构想关系：**用户"缓解"建议的上位标准已存在且是 Informational**——意味着"再提一个'应避免分片'"没有发表价值；用户必须做**部署评估/检测**而非重复建议。
- 新颖性威胁：**直接重叠（缓解建议层）**。

**S2. RFC 8900 / BCP 230: IP Fragmentation Considered Fragile** `[已核，Lead 已核]`
- 作者：R. Bonica, F. Baker, G. Huston, R. Hinden, O. Troan, F. Gont｜2020-09｜BCP 230｜URL: https://www.rfc-editor.org/rfc/rfc8900.txt
- 内容：系统论证分片脆弱性并给出运营建议。
- 与构想关系：用户构想的总纲；引用必备。
- 新颖性威胁：**直接重叠（命题层）**。

**S3. draft-ietf-dnsop-avoid-fragmentation（rev 20）— RFC 9715 的前身** `[已核]`
- 来源：IETF datatracker API（name=`draft-ietf-dnsop-avoid-fragmentation`，rev 20，expires 2025-03-30，已发 RFC）
- URL: https://datatracker.ietf.org/doc/draft-ietf-dnsop-avoid-fragmentation/
- 与构想关系：标准制定过程完整可追溯（含 §105/§106/§interim 2020–2021 dnsop Sessa "Avoid Fragmentation" 幻灯片）；用户写"标准现状"可直接引 datatracker 历史。
- 新颖性威胁：**无关**（背景）。

**S4. draft-fujiwara-dnsop-fragment-attack（已过期）** `[已核]`
- 作者：Kazunori Fujiwara｜rev 01，expires 2019-09-02｜URL: https://datatracker.ietf.org/doc/draft-fujiwara-dnsop-fragment-attack/
- 内容：Measures against cache poisoning attacks using IP fragmentation in DNS（即 RFC 9715 的思想前身之一）。
- 与构想关系：证明"用分片做缓存投毒"在 IETF 层面 2019 年已被讨论；用户不可当新发现。
- 新颖性威胁：**直接重叠**。

**S5. draft-templin-6man-fwiw "Fragmentation Revisited: For What It's Worth"（活跃）** `[已核]` `[仅元数据]`
- 作者：F. Templin｜rev 05，expires 2027-01-07｜状态：活跃（datatracker）｜URL: https://datatracker.ietf.org/doc/draft-templin-6man-fwiw/
- 内容：重新审视 IPv6 分片（元数据已核，正文待读）。
- 与构想关系：2026 年 IPv6 分片在 IETF 仍有活跃争论——**说明"IPv6 分片"题目仍有标准层空间**。
- 新颖性威胁：**无关**（背景/机会）。

**S6. draft-smyslov-ipsecme-ikev2-fragm-large-msg（活跃）** `[已核]` `[仅元数据]`
- 作者：V. Smyslov｜rev 01，expires 2026-08-17｜URL: https://datatracker.ietf.org/doc/draft-smyslov-ipsecme-ikev2-fragm-large-msg/
- 内容：IKEv2 大消息的分片（应用层分片而非 IP 分片）。
- 与构想关系：相邻协议（IKEv2）也在解决"大消息不经 IP 分片"——可作"应用层分片 vs IP 分片"设计取舍的类比引用。
- 新颖性威胁：**无关**。

**S7. RFC 6980: Security Implications of IPv6 Fragmentation with IPv6 Neighbor Discovery** `[已核]`
- 2013｜URL: https://www.rfc-editor.org/rfc/rfc6980.txt
- 内容：IPv6 ND 与分片的安全问题（经典标准）。
- 与构想关系：IPv6 分片安全的标准前例；用户 IPv6 章节需引。
- 新颖性威胁：**无关**（经典，lit-classic 可能已覆盖）。

**S8. IETF dnsop 近年与分片相关的会议材料** `[已核]`
- `slides-105-dnsop-sessa-avoid-fragmentation`、`slides-106-dnsop-sessa-avoid-fragmentation`、`slides-interim-2020-dnsop-01-sessa-avoid-fragmentation-in-dns`、`slides-interim-2021-dnsop-01-sessa-dnsop-avoid-fragmentation`（datatracker 检索结果，均为 dnsop Sessa 的 Avoid Fragmentation 报告）
- URL 示例: https://datatracker.ietf.org/meeting/105/materials/slides-105-dnsop-sessa-avoid-fragmentation
- 与构想关系：说明标准层"避免分片"倡议的推动历程；用户若做部署评估可直接对比这些 slides 的主张与实际部署。
- 新颖性威胁：**无关**（背景）。

---

## 4. 中文文献与专利（证据等级整体偏低，需 Lead 用 CNKI 补核）

> 说明：web_search 对中文库（CNKI/万方/维普/国家知识产权局）的覆盖有限，且多数条目只能拿到题录/摘要。以下均为 `[待核实]`，**仅作线索，不得直接当已核实引用**。检索词："DNS 分片 攻击 检测""DNS 缓存投毒 分片""IPv6 分片 安全""DNS 报文 分片 防御""DNS 分片重组 专利"。

**C1. Mitigating DNS Cache Poisoning Through Cache Consistency Checking Method and Disaster Resolution System Optimization** `[待核实]`
- 发表：《信息安全研究》2023 年第 9 卷第 16 期（DOI `10.3969/j.issn.2096-6091.2023.16.006`）
- URL: https://www.newit.ejournal.org.cn/en/article/doi/10.3969/j.issn.2096-6091.2023.16.006/
- 内容：通过缓存一致性校验缓解 DNS 缓存投毒，并优化容灾解析系统（据题录）。
- 与构想关系：中文界**检测/缓解**方向最近对标之一，但非分片机制。
- 新颖性威胁：**相邻**（中文检测类，需全文确认是否涉及分片）。

**C2. 大规模IPv6网络IP-ID类型测量** `[待核实]`
- 发表：《计算机工程与科学》（CCF 会刊，joces.nudt.edu.cn）
- URL: http://joces.nudt.edu.cn/CN/abstract/abstract18215.shtml
- 内容：大规模 IPv6 网络 IP-ID 行为类型测量（据题录）。
- 与构想关系：**IPv6 分片 ID 建模的中文测量基础**；用户做 IPv6 分片伪造/检测时，这是可引的中文测量工作。
- 新颖性威胁：**相邻**（测量，非 DNS）。

**C3. IPv6分片重组在Snort中的解决方案** `[待核实，窗口外]`
- 发表：2009 年（CNKI 题录，期刊缩写 NBGB）｜URL: https://www.cnki.com.cn/Article/CJFDTOTAL-NBGB200902040.htm
- 内容：在 Snort 中处理 IPv6 分片重组（据题录）。
- 与构想关系：说明"IDS 分片重组"在中文界是 2009 年就有的工程话题；**用户做检测时，"Snort 已能做 IPv6 重组"是必须回应的基线**。
- 新颖性威胁：**无关**（过早、工程性）。

**C4. 专利：CN109756584A / CN1610902B / CN112640392B / CN114039749A / CN109286577A** `[待核实]`
- 来源：Google Patents PDF 链接（web_search 返回）
  - CN109756584A: https://patentimages.storage.googleapis.com/d4/85/ce/5750e182b66d1b/CN109756584A.pdf
  - CN1610902B: https://patentimages.storage.googleapis.com/be/8d/05/a4cc158ecf2432/CN1610902B.pdf
  - CN112640392B: https://patents.google.com/patent/CN112640392B/en
  - CN114039749A: http://patentimages.storage.googleapis.com/ec/66/67/c04508997d276d/CN114039749A.pdf
  - CN109286577A: https://patentimages.storage.googleapis.com/e9/2b/ab/e89c5894ff3891/CN109286577A.pdf
- 内容（据检索片段，均**未核实是否 DNS 专用**）：涉及"分片重组 CPU/分片重组表"（CN109286577A）、"攻击检测系统"（CN114039749A）、"DNS 解析中请求报文复用"（CN1610902B）、及疑似 DNS 相关检测方法（CN112640392B，题名待核）。
- 与构想关系：**目前未检索到"DNS 分片攻击检测/缓解"为主题的中文授权专利**；上述均为通用分片/攻击检测专利，**不能作为"中文专利已覆盖"的证据**。
- 新颖性威胁：**无关/待确认**。

**C5. 中文检索小结（重要）**：
- 在公开检索可见范围内，**未发现以"DNS 大响应 IP 分片弱点检测/缓解"为主题的中文期刊论文或学位论文**；中文工作集中在 ①缓存一致性/投毒检测（C1）②IPv6 测量（C2）③IDS 工程实现（C3）。→ 中文文献是**空白**，但空白本身不等于可发表（英文顶会才是主战场）。
- **需 Lead 用 CNKI/万方在校内权限下补检**："DNS 分片""IP 分片 检测""DNS 缓存投毒"三组词，并查国家知识产权局专利检索系统（pss-system.cponline.cnipa.gov.cn）确认 C4 主题。

---

## 5. 检索覆盖与遗漏声明

| 检索源 | 状态 | 备注 |
|---|---|---|
| OpenAlex Works API | ✅ 可用 | 主检索源；abstract_inverted_index 可重建摘要 |
| Semantic Scholar Graph API | ✅ 可用 | 引文追踪主力（Herzberg 2013 被引 100 条、POPS/QBF/Raavi/Moura 被引） |
| Crossref API | ✅ 可用 | DOI 精确核（PAM 2021、ICC 2024、WWW 2025、IMC 2026） |
| USENIX 官方论文页 | ✅ 可用 | RUC、POPS 摘要+作者+页码已核 |
| IETF datatracker API | ✅ 可用 | RFC/草案状态、expires、历史 slides |
| arXiv abs 页 | ✅ 可用 | 2307.06131、2501.13540 摘要已核 |
| ePrint 页 | ✅ 可用 | 2024/1320 摘要已核 |
| **DBLP 官方 API** | ❌ **被 Anubis 反爬拦截（HTTP 202）** | 未能直连；DBLP 编号由 S2/OpenAlex 外链交叉核对 |
| web_fetch | ❌ 按指示禁用 | — |
| CNKI/万方/CNIPA | ❌ 无权限 | 中文部分整体 `[待核实]` |
| IEEE Xplore / ACM DL 全文 | ❌ 无全文权限 | 多篇仅元数据；标 `[仅元数据]` |

**可能遗漏**：① USENIX Sec 2025 其他 DNS 分片相关论文（未做全 proceedings 扫描）；② NDSS/CCS 2026 已录用但未上线论文；③ 工业界博客/CVE 细节（Lead 已核 CVE-2025-59024）；④ 非英语（日/德）文献。

---

## 6. 结论：已被做掉 / 仍空白 / 最接近 5 篇 / 可能抢发方向

### 6.1 已被做掉的子问题（用户不能当创新点）

| # | 子问题 | 已被谁做掉 | 证据 |
|---|---|---|---|
| A1 | "IP 分片会暴露 DNS/应用协议弱点"这一命题 | Herzberg & Shulman 2013 → Bonica et al. RFC 8900/BCP 230 → Fujiwara & Vixie RFC 9715 (2025) | R: RFC 9715、S1/S2 |
| A2 | "DNS 分片攻击也存在于 TCP（DoTCP 回退不安全）" | Dai, Shulman, Waidner ICDCS 2021 + ANRW 2021 | R1/R2 |
| A3 | "大响应在真实网络中的分片/截断/超时测量" | Moura et al. PAM 2021；Kosek CCR 2022；Fukuda NOMS 2022；Dikshit TNSM 2024；Li IMC 2026 | R3–R7、R11 |
| A4 | "解析器通告超大 EDNS(0) buffer、不回退 TCP" | Dikshit et al. TNSM 2024（3/10 解析器） | R5 |
| A5 | "利用大响应第二片（RRSIG）操纵缓存"作为攻击原语 | **Zhang et al. USENIX Sec 2025（RUC）Approach #1** | R8（Lead 已核正文） |
| A6 | "大 DNSSEC 响应导致 CPU DoS（KeyTrap）" | Heftrig et al. CCS 2024 + Protocol Fixes 2024 | R13/R14 |
| A7 | "大响应被用作脉冲式 DDoS 放大器" | Li et al. S&P 2024（DNSBomb） | R12 |
| A8 | "检测 DNS 缓存投毒（含 fragmentation attacks）并能缓解" | **Afek, Berger, Bremler-Barr USENIX Sec 2025（POPS）** | R9（摘要原文点名 fragmentation attacks） |
| A9 | "通用 IP 分片异常检测框架" | Iavich et al. Future Internet 2025/2026 | R19 |
| A10 | "IPv6 分片头可绕过 IDS/IPS（FragEva6）" | Lin et al. LCN 2024 | R23 |
| A11 | "后量子 DNSSEC 大响应→分片方案（QBF/ARRF）" | Rawat & Jhanwar SPACE 2024；Goertzen & Stebila 2023 | R29/R30 |
| A12 | "后量子分片 DNSSEC 的 mis-association 威胁与防御" | Raavi, Wuthier, Chang ICC 2024 | R31 |
| A13 | "分片方案自身的内存耗尽漏洞" | McGowan, Liu, Ruj WWW 2025 Companion | R32 |
| A14 | "避免分片"的缓解建议本身 | RFC 9715 (2025-01) | S1 |
| A15 | "伪造 ICMP Frag Needed 诱导小 MTU + 分片洪泛造成真实 UDP 服务 DoS" | Pan & Rossow, FRAGJAM 2026 (CISPA) | R25b |

### 6.2 仍然空白的子问题（按可发表性从高到低）

**G1. DNS 语义感知的分片重组异常检测（最有希望）**
- 现状：POPS 检测"统计型投毒（含 fragmentation attacks）"但没有公开的**DNS 语义级分片状态机**检测；Iavich 2025 是通用分片规则；FragEva6 是 IPv6 规避测试；RUC 是攻击手法；FRAGJAM 2026 是攻击链（伪造 ICMP/分片洪泛），完全不做检测。
- 空白点：把"第二片/尾片内容"与 DNS 结构（RRSIG 位置、签名覆盖范围、RRset 一致性、TC 回退行为、响应尺寸 vs EDNS buffer）联合建模，构成**可解释、低误报的 resolver-side 分片检测器**；用受控 pcap 评估**规避**（分段重组差一字节、重叠片、TTL 递减、IPv6 扩展头组合、伪造 ICMP Frag Needed）。
- 为什么可发：有明确对手（POPS/Suricata/Snort/FragEva6/FRAGJAM），有可测指标（检测率/误报/吞吐/延迟），有真实动机（后量子 + RFC 9715 部署空窗 + 2026 FRAGJAM 证明威胁真实）。

**G2. IPv6 DNS 分片的实际攻击面测量（空白最大）**
- 现状：IPv6 分片测量（TMA 2026、IP-ID LNCS 2025）是**通用流量**；DNS over IPv6 readiness（Fiebig IMC 2025）不测分片；FragEva6 不测 DNS。
- 空白点：IPv6 下 DNS 大响应的分片发生率、中间盒（防火墙/NAT66/CPE）对 IPv6 分片的丢弃/重组行为、以及"IPv6 分片是否比 IPv4 更易被用于投毒/DoS"的量化结论。
- 为什么可发：IMC/PAM/TMA 明确吃"首个 IPv6 DNS 分片测量"；数据集可开源。

**G3. 后量子 DNSSEC 分片方案的"检测层"（顺着 2024–2026 热度）**
- 现状：QBF/ARRF/双签/混合签名都在解决"如何分片与部署"；Raavi 提出 mis-association 威胁并给防护；WWW 2025 修内存漏洞。**没有工作提出"运行时分片检测器来发现 mis-association / 分片注入"**。
- 空白点：针对后量子 DNS 分片（应用层 QBF 或 IP 层分片）的**完整性检测**：如何在不信任中间盒的前提下判断"收到的分片属于同一逻辑签名消息"。
- 为什么可发：与 2026 部署浪潮（IMC 2026 hybrid poster）同步，产业需求真实。

**G4. 缓解的部署评估（policy 类）**
- 现状：RFC 9715 是 Informational 建议，Dikshit 2024 测了 2023 年状态；**2025–2026 是否因 RFC 9715/后量子部署而变化，无人测**。
- 空白点：RFC 9715 发布后解析器/权威服务器 EDNS buffer 与 TCP 回退率的变化（longitudinal），以及"避免分片"建议的可执行性代价。
- 为什么可发：测量顶会（IMC/PAM）稳定有位置；但需大规模 vantage（RIPE Atlas 可复用）。

**G5. 检测器数据面性能（eBPF/XDP）**
- 现状：POPS 只与 Suricata/Snort 比时间；无人做"分片感知检测"在 resolver 数据面的开销评估。
- 空白点：在 10–100 Gbps 解析器上做分片状态机 + DNS 语义检查的 eBPF 原型与性能包络。
- 为什么可发：工件（artifact）可评；但需要较强工程。

**G6. 中文文献/专利空白**
- 检索未见中文专门工作；可作为"中文报告/国内会议"补充，但不构成顶会卖点。

### 6.3 最接近的 5 篇工作（用户必须逐篇读并引用）

| 排名 | 工作 | 为什么最接近 | 与用户构想的关系 |
|---|---|---|---|
| 1 | **POPS**（Afek, Berger, Bremler-Barr, USENIX Sec 2025）https://www.usenix.org/conference/usenixsecurity25/presentation/afek | 直接做"缓存投毒检测+缓解"，摘要点名可检出 **fragmentation attacks**，且缓解手段就是 TC 标志（分片/截断路径） | 检测方向**最直接竞品**；用户必须在其未覆盖的 DNS 语义/规避/IPv6 上做增量 |
| 2 | **RUC / Your Shield is My Sword**（Zhang et al., USENIX Sec 2025）https://www.usenix.org/conference/usenixsecurity25/presentation/zhang-shuhan | 公开使用"大响应第二片操纵 RRSIG"作为攻击原语 | 用户"第二片"构想的**攻击侧先例**；防御侧仍空 |
| 3 | **Fragmentation Attacks on DNS over TCP + DNS-over-TCP considered vulnerable**（Dai, Shulman, Waidner, ICDCS/ANRW 2021）https://doi.org/10.1109/ICDCS51616.2021.00118 | 把分片攻击面从 UDP 扩到 TCP，直接动摇"TCP 回退=安全"的缓解逻辑 | 用户做缓解研究必须回应的**基础事实** |
| 4 | **Securing Post-Quantum DNSSEC Against Fragmentation Mis-Association Threat**（Raavi, Wuthier, Chang, ICC 2024）https://doi.org/10.1109/ICC51166.2024.10622607 | 已经提出"分片使后量子 DNSSEC 暴露 mis-association 威胁"并给防御 | 后量子分片方向**最接近的防御工作**；用户需读全文找它未做的检测/测量 |
| 5 | **A Deterministic, Rule-Based Framework for Detecting Anomalous IP Packet Fragmentation**（Iavich et al., Future Internet 2025/2026）https://doi.org/10.3390/fi18010019 | 已有"可解释、轻量、规则化"的分片异常检测框架与数据集 | 检测**形态**上的直接对标；用户需证明 DNS-aware 的增量 |

（次接近：Moura PAM 2021 测量、RFC 9715、TMA 2026 IPv4 分片纵向测量、QBF、IMC 2026 Taming DNS Responses，以及**必须在 related work 引用的 2026 攻击侧工作 FRAGJAM**（Pan & Rossow, CISPA, https://doi.org/10.60882/cispa.32770800）。）

### 6.4 可能抢发的方向（按"审稿人最可能接受"排序）

1. **"A DNS-Aware Fragment Reassembly Detector"** — 在开放解析器侧（BIND/Unbound/PowerDNS/Knot 之一）做 DNS 语义感知的分片/尾片检测，对抗性规避评测 + eBPF 性能；对标 POPS/Suricata/Snort/FragEva6。**（最可能抢发；窗口 2026–2027）**
2. **"The IPv6 DNS Fragmentation Blind Spot"** — 首个 IPv6 DNS 大响应分片测量（vantage + 真实中间盒），量化"IPv6 分片是否更危险"。**（测量顶会友好；数据可开源）**
3. **"Verifying Post-Quantum DNSSEC Fragment Integrity"** — 针对 QBF/ARRF/混合签名，提出运行时分片完整性检测（不信任中间盒），补 Raavi 的"防护"到"检测"。**（顺 2026 部署浪潮；与 IMC 2026 hybrid poster 作者群可能撞车，需快）**
4. **"RFC 9715 in the Wild"** — RFC 9715 发布后部署 longitudinal 测量（buffer/TCP 回退/分片率变化）。**（稳妥但影响因子有限）**
5. **"Second-Fragment Semantics"** — 把 RUC 的"第二片 RRSIG"攻击原语系统化为**检测特征+数据集**（明确引用 RUC，做其防御侧）。**（需小心：不能重复 RUC 攻击发现）**

### 6.5 给 Lead 的三条判定建议

1. **"发现分片弱点"不可行**（A1/A2/A5 已占）；**"检测+缓解"可行但必须跨过 POPS 与 Iavich 2025 的门槛**——建议把创新点写成"DNS 语义感知 + 规避对抗评估 + 数据面性能"，而不是"通用分片检测"。
2. **最强的立论是后量子**：QBF/ARRF/混合签名会让"大响应→分片"从例外变成常态（R29/R31/R33/R35），而**检测层空白**（G3）恰好是用户防御视角的用武之地；建议把 2026 后量子部署作为主 motivation，DNS 分片检测作为 method。
3. **风险提示**：RUC 论文（USENIX Sec 2025）与用户构想高度相邻，**若用户方案只做"第二片 RRSIG 检测"而无论文级增量，会被审稿人直接以 RUC 对比拒稿**。应把 RUC 作为"已知攻击"引用，把贡献放在"对未知变体的检测泛化 + 误报控制 + 部署可行性"。另：FRAGJAM（2026）已把"伪造 ICMP Frag Needed / 分片洪泛"做成真实服务 DoS，**用户建模伪造分片时不要声称"首次"**，应引用 FRAGJAM 并限定在 DNS 解析器/响应语义。

---

*文件状态：v1.1 完成（2026-10-22）。已核条目 40+（含 2026 最新 FRAGJAM、IMC 2026 两篇、TMA 2026）；`[待核实]`/`[仅元数据]` 条目已在正文标注，Lead 汇总时请保留证据等级。*
