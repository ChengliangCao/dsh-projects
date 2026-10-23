# Lead 情报包（子智能体共享）— 2026-10-22

## 0. 总目标

用户（安全研究者）构想：**DNS 响应需要 IP 分片时，分片处理方式可能暴露弱点**；希望做**防御视角**（检测与缓解）研究，想知道：
(a) 这个点是否还能形成**可发表成果**、现有研究是否已把它做掉；
(b) 如何在**受控实验环境**诱导大 DNS 响应；
(c) 如何**安全建模伪造分片**。
最终交付：一份中文调研报告（Lead 汇总）。子智能体只负责各自 notes 文件，不写最终报告。

## 1. 环境与工具（已实测，务必遵守）

- 工作目录 `/Users/ignis/workspace/dsh-plugins`，notes 目录 `research/dns-fragmentation/notes/` 已存在。
- **web_fetch 工具被沙箱拦截**（外部域名解析到非公网 IP）。**不要用 web_fetch**。
- **bash 里 curl 可直连外网**，已实测可用：rfc-editor.org、datatracker.ietf.org、api.crossref.org、dblp.org、services.nvd.nist.gov、docs.powerdns.com 等。
- HTML 转纯文本helper（已存在，若丢失可重建 `/tmp/dnsfrag/h2t.py`）：
  `curl -sL -m 25 URL -o /tmp/x.html && python3 /tmp/dnsfrag/h2t.py < /tmp/x.html`
- 有用 API（curl 直接调）：
  - RFC 正文：`https://www.rfc-editor.org/rfc/rfc9715.txt`
  - IETF 元数据：`https://datatracker.ietf.org/api/v1/doc/document/rfc9715/?format=json`
  - Crossref 精确核 DOI：`https://api.crossref.org/works/<DOI>`；检索：`https://api.crossref.org/works?query.bibliographic=<关键词>&rows=5`
  - DBLP：`https://dblp.org/search/publ/api?q=<关键词>&format=json&h=10`
  - OpenAlex：`https://api.openalex.org/works?filter=title_and_abstract.search:DNS%20fragmentation&per_page=25`
  - Semantic Scholar 单篇摘要/引文：`https://api.semanticscholar.org/graph/v1/paper/DOI:<DOI>?fields=title,abstract,authors,year,venue`；引文 `/citations?fields=title,year,venue,externalIds&limit=100`
  - NVD：`https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=CVE-XXXX-XXXXX`
  - arXiv abs：`https://arxiv.org/abs/<id>`（可能 403，失败就只靠搜索摘要并标 [待核实]）
- 本机是 macOS 26/27（Apple Silicon）；**未安装** docker / colima / pandoc / pdftotext / pypdf。不要假装运行过这些工具；实验方案标注"目标环境需安装/需 Linux VM"。
- 时间有限：**先写文件骨架并落盘，再逐步完善**（每完成一节就 write/edit 保存）。单条来源核实不超过 2–3 分钟。完成后 send_message 给 `lead`。

## 2. 已由 Lead 核实的事实（可直接引用，勿再花时间重复核）

1. **RFC 9715** "IP Fragmentation Avoidance in DNS over UDP"，K. Fujiwara (JPRS), P. Vixie (AWS Security)，**2025-01，Informational**，13 页。指出 EDNS(0) 允许大 UDP 响应 → 更易分片 → 分片已暴露应用协议弱点；建议限制响应尺寸、必要时 TCP 回退。**不是 BCP**（易错点）。
2. **RFC 8900** "IP Fragmentation Considered Fragile"，R. Bonica, F. Baker, G. Huston, R. Hinden, O. Troan, F. Gont，2020-09，**BCP 230**。
3. **Herzberg & Shulman, "Fragmentation Considered Poisonous, or: One-domain-to-rule-them-all.org", IEEE CNS 2013, DOI 10.1109/CNS.2013.6682711**（Crossref 已核）。
4. Gilad & Herzberg 正式标题是 **"Fragmentation Considered Leaking: Port Inference for DNS Poisoning"**（疑 ACNS 2014，Springer LNCS；"Fragmentation Considered Leaky" 不是正式标题）——需补 DOI。
5. **CVE-2025-59024**：PowerDNS Recursor，"Crafted delegations or IP fragments can poison cached delegations in Recursor"。NVD：CVSS 3.1 **6.5 MEDIUM**（AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:H/A:L），CWE-345，NVD 发布 2026-02-09；厂商 advisory 2025-06 标注 2025-10-22，页面 docs.powerdns.com/recursor/security-advisories/powerdns-advisory-2025-06.html。
6. **USENIX Security 2025** 论文 "**Your Shield is My Sword: A Persistent Denial-of-Service Attack via the Reuse of Unvalidated Caches in DNSSEC Validation**"（作者 Zhang 等；PDF usenixsecurity25-zhang-shuhan.pdf），含 "Approach #1: Manipulating RRSIG records in the 2nd fragment of a large DNS response"——与"大响应第二片"直接相关。
7. **USENIX Security 2025** 论文 "**POPS: From History to Mitigation of DNS Cache Poisoning Attacks**"（34th USENIX Sec，ACM DL 10.5555/3766078.3766260）。
8. **USENIX Security 2020** 论文 "**Poison Over Troubled Forwarders: A Cache Poisoning Attack Targeting DNS Forwarding Devices**"（Zheng 等，DBLP: ZhengLPYZLMHDQ20），含 DNSSEC-based fragmentation 讨论。
9. **PAM 2021** "Fragmentation, Truncation, and Timeouts: Are Large DNS Messages Falling to Bits?"，DOI 10.1007/978-3-030-72582-2_27。
10. 后量子 DNSSEC 大响应/分片新方向：ePrint **2024/1320** "Post-Quantum DNSSEC over UDP via QNAME-Based Fragmentation"；**WWW 2025 Companion** "Security Considerations for Post-Quantum Signatures in DNSSEC via Request-Based Fragmentation"，DOI 10.1145/3701716.3715585；**IMC 2026** poster "Hybrid Signatures for Post-Quantum DNSSEC: A Real-World Evaluation"，DOI 10.1145/3777912.3847598。
11. arXiv **2307.06131** "Evaluating DNS Resiliency and Responsiveness with Truncation, Fragmentation & DoTCP Fallback"（作者含 Dikshit、Kosek 等，venue 待核）。
12. **DNSBomb**（IEEE S&P 2024，DBLP conf/sp/LiWDL24）— 大响应/脉冲式 DNS DoS（相邻工作）。
13. Sensors 2025 "DNS-Sensor: A Sensor-Driven Architecture for Real-Time DNS Cache Poisoning Detection and Mitigation"（MDPI sensors-25-06884）— 检测类对标。

## 3. 安全边界（所有子智能体必须遵守）

- 防御性研究；不得给出针对真实解析器/第三方网络的攻击操作步骤。
- 实验方法只描述**隔离环境**：Linux VM / Docker / network namespace，使用 RFC 5737（192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24）与 RFC 3849（2001:db8::/32）文档地址，无默认路由、egress DROP，绝不接生产网络。
- 发现真实产品漏洞时，建议协调披露（厂商/CERT、90 天等），不得公开可直接利用细节。

## 4. 引用纪律

- 每条结论必须带真实可核查来源（URL/DOI）。**禁止编造**标题、作者、venue、年份、CVE、截稿日期、影响因子/分区。
- 只有搜索摘要、没读到全文的，标 **[待核实]** 并注明证据等级（如"仅见标题+引用片段"）。
- 中文材料优先中文，但技术名词保留英文。

## 5. 分工

- `lit-classic` → `notes/lit-classic.md`：1987–2021 经典文献/标准/实现 CVE。
- `lit-recent` → `notes/lit-recent.md`：2021–2026 最新工作 + 新颖性威胁 + 中文文献/专利。
- `lab-methods` → `notes/lab-methods.md`：受控实验方法（诱导大响应 / 安全伪造分片 / 检测评估 / 工件）。
- `novelty-venues` → `notes/novelty-venues.md`：可发表性判定、空白矩阵、选题、投稿策略、12 周计划。
- `lead` → 最终报告 `research/dns-fragmentation/DNS分片安全研究-可发表性调研报告.md` 与 `references.md`。
