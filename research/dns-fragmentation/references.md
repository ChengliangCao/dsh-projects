# 参考文献（摘自主报告）

## 参考文献

**标准与规范**

[1] P. Mockapetris, "Domain Names — Implementation and Specification," RFC 1035, 1987. https://www.rfc-editor.org/rfc/rfc1035.txt
[2] J. Damas, M. Graff, P. Vixie, "Extension Mechanisms for DNS (EDNS(0))," RFC 6891, 2013. https://www.rfc-editor.org/rfc/rfc6891.txt
[3] R. Bonica, F. Baker, G. Huston, R. Hinden, O. Troan, F. Gont, "IP Fragmentation Considered Fragile," RFC 8900 / BCP 230, 2020. https://www.rfc-editor.org/rfc/rfc8900.txt
[4] K. Fujiwara, P. Vixie, "IP Fragmentation Avoidance in DNS over UDP," RFC 9715, Informational, 2025. https://www.rfc-editor.org/rfc/rfc9715.txt
[5] F. Gont, "Security Implications of Predictable Fragment Identification Values," RFC 7739, 2016. https://www.rfc-editor.org/rfc/rfc7739.txt
[6] J. Touch, "Updated Specification of the IPv4 ID Field," RFC 6864, 2013. https://www.rfc-editor.org/rfc/rfc6864.txt
[7] J. Dickinson, S. Dickinson, R. Bellis, A. Mankin, D. Wessels, "DNS Transport over TCP — Implementation Requirements," RFC 7766, 2016. https://www.rfc-editor.org/rfc/rfc7766.txt
[8] S. Deering, R. Hinden, "Internet Protocol, Version 6 (IPv6) Specification," RFC 8200, 2017. https://www.rfc-editor.org/rfc/rfc8200.txt
[9] D. Thaler, "Security Implications of IPv6 Fragmentation with IPv6 Neighbor Discovery," RFC 6980, 2013. https://www.rfc-editor.org/rfc/rfc6980.txt
[10] P. Ferguson, D. Senie, "Security Considerations for IP Fragment Filtering," RFC 1858, 1995. https://www.rfc-editor.org/rfc/rfc1858.txt
[11] P. Miller, "Protection Against a Variant of the Tiny Fragment Attack," RFC 3128, 2001. https://www.rfc-editor.org/rfc/rfc3128.txt
[12] L. Eggert, G. Fairhurst, G. Shepherd, "UDP Usage Guidelines," RFC 8085, 2017. https://www.rfc-editor.org/rfc/rfc8085.txt
[13] J. Abley, O. Gudmundsson, M. Majkowski, "Providing Minimal-Sized Responses to DNS Queries That Have QTYPE=ANY," RFC 8482, 2018. https://www.rfc-editor.org/rfc/rfc8482.txt
[14] D. Eastlake 3rd, M. Andrews, "Domain Name System (DNS) Cookies," RFC 7873, 2016. https://www.rfc-editor.org/rfc/rfc7873.txt
[15] DNS Flag Day 2020. https://dnsflagday.net/2020/

**经典分片与 DNS 分片攻击**

[16] C. A. Kent, J. C. Mogul, "Fragmentation Considered Harmful," ACM SIGCOMM Computer Communication Review, 1987. https://doi.org/10.1145/55483.55524
[17] T. Ptacek, T. Newsham, "Insertion, Evasion, and Denial of Service: Eluding Network Intrusion Detection," 1998. https://insecure.org/stf/secnet_ids/secnet_ids.html
[18] A. Herzberg, H. Shulman, "Fragmentation Considered Poisonous, or: One-domain-to-rule-them-all.org," IEEE CNS 2013. https://doi.org/10.1109/CNS.2013.6682711
[19] Y. Gilad, A. Herzberg, "Fragmentation Considered Vulnerable: Blindly Intercepting and Discarding Fragments," USENIX WOOT 2011（引用自 USENIX Sec 2020 论文 `[21]`；DOI/全文待核实）。
[20] H. Shulman, M. Waidner, "Fragmentation Considered Leaking: Port Inference for DNS Poisoning," ACNS 2014, LNCS. https://doi.org/10.1007/978-3-319-07536-5_31
[21] X. Zheng, C. Lu, J. Peng, Q. Yang, D. Zhou, B. Liu, K. Man, S. Hao, H. Duan, Z. Qian, "Poison Over Troubled Forwarders: A Cache Poisoning Attack Targeting DNS Forwarding Devices," USENIX Security 2020. https://www.usenix.org/conference/usenixsecurity20/presentation/zheng
[22] T. Hlavacek, "IP Fragmentation Attack on DNS," RIPE 67, 2013. https://ripe67.ripe.net/presentations/240-ipfragattack.pdf
[23] M. Brandt, T. Dai, A. Klein, H. Shulman, M. Waidner, "Domain Validation++ For MitM-Resilient PKI," ACM CCS 2018, pp. 2060–2076（见 RFC 9715 参考文献 `[4]`；DOI 待核实）。

**测量（2021–2026）**

[24] G. C. M. Moura, M. Müller, M. Davids, M. Wullink, C. Hesselman, "Fragmentation, Truncation, and Timeouts: Are Large DNS Messages Falling to Bits?," PAM 2021. https://doi.org/10.1007/978-3-030-72582-2_27
[25] T. Dai, H. Shulman, M. Waidner, "Poster: Fragmentation Attacks on DNS over TCP," IEEE ICDCS 2021. https://doi.org/10.1109/ICDCS51616.2021.00118
[26] T. Dai, H. Shulman, M. Waidner, "DNS-over-TCP Considered Vulnerable," ACM ANRW 2021. https://doi.org/10.1145/3472305.3472884
[27] M. Kosek, T. V. Doan, S. Huber, V. Bajpai, "Measuring DNS over TCP in the Era of Increasing DNS Response Sizes," ACM SIGCOMM CCR, 2022. https://doi.org/10.1145/3544912.3544918
[28] K. Fukuda, Y. Aharen, S. Sato, T. Mitamura, "Characterizing DNS Query Response Sizes Through Active and Passive Measurements," IEEE/IFIP NOMS 2022. https://doi.org/10.1109/NOMS54207.2022.9789912
[29] P. Dikshit, M. Kosek, N. Faulhaber, J. Sengupta, V. Bajpai, "Evaluating DNS Resiliency with Truncation, Fragmentation and DoTCP Fallback," IFIP Networking 2023. https://doi.org/10.23919/IFIPNetworking57963.2023.10186392
[30] 同 [29] 期刊版："Evaluating DNS Resiliency and Responsiveness With Truncation, Fragmentation & DoTCP Fallback," IEEE TNSM, 2024（arXiv:2307.06131）. https://doi.org/10.1109/TNSM.2024.3365303
[31] L. Aubard, K. Fukuda, J. Mazel, G. Guette, P. Chifflier, "A Longitudinal Study of IPv4 Fragmentation Characteristics in Internet Traffic," TMA 2026. https://doi.org/10.23919/TMA71232.2026.11695507
[32] Z. Li, W. Wu, Z. Wang, et al., "Taming DNS Responses: A Measurement Study of Response Size and Its Impact," ACM IMC 2026. https://doi.org/10.1145/3777912.3839801

**2024–2026 攻击/防御进展**

[33] S. Zhang, S. Wang, L. Chen, D. Li, B. Liu, "Your Shield is My Sword: A Persistent Denial-of-Service Attack via the Reuse of Unvalidated Caches in DNSSEC Validation," USENIX Security 2025, pp. 3517–3535. https://www.usenix.org/conference/usenixsecurity25/presentation/zhang-shuhan
[34] Y. Afek, H. Berger, A. Bremler-Barr, "POPS: From History to Mitigation of DNS Cache Poisoning Attacks," USENIX Security 2025, pp. 3537–3556（arXiv:2501.13540）. https://www.usenix.org/conference/usenixsecurity25/presentation/afek
[35] X. Li, D. Wu, H. Duan, Q. Li, "DNSBomb: A New Practical-and-Powerful Pulsing DoS Attack Exploiting DNS Queries-and-Responses," IEEE S&P 2024. https://doi.org/10.1109/SP54263.2024.00264
[36] E. Heftrig, H. Schulmann, N. Vogel, M. Waidner, "The Harder You Try, The Harder You Fail: The KeyTrap Denial-of-Service Algorithmic Complexity Attacks on DNSSEC," ACM CCS 2024. https://doi.org/10.1145/3658644.3670389
[37] X. Li, W. Xu, B. Liu, et al., "TuDoor Attack: Systematically Exploring and Exploiting Logic Vulnerabilities in DNS Response Pre-processing with Malformed Packets," IEEE S&P 2024. https://doi.org/10.1109/SP54263.2024.00172
[38] X. Li, M. Zhang, Z. Xu, et al., "RebirthDay Attack: Reviving DNS Cache Poisoning with the Birthday Paradox," ACM CCS 2025. https://doi.org/10.1145/3719027.3744832
[39] Y. Pan, C. Rossow, "FRAGJAM: DoS Attacks Using IP Reassembly Congestion," CISPA, 2026. https://doi.org/10.60882/cispa.32770800
[40] CVE-2025-59024, NVD. https://nvd.nist.gov/vuln/detail/CVE-2025-59024 ；PowerDNS Security Advisory 2025-06. https://docs.powerdns.com/recursor/security-advisories/powerdns-advisory-2025-06.html
[41] K. Man, X. Zhou, Z. Qian, "DNS Cache Poisoning Attack: Resurrections with Side Channels," ACM CCS 2021. https://doi.org/10.1145/3460120.3486219
[42] T. Dai, P. Jeitner, H. Shulman, M. Waidner, "From IP to Transport and Beyond: Cross-Layer Attacks Against Applications," ACM SIGCOMM 2021. https://doi.org/10.1145/3452296.3472933
[43] Y. Afek, A. Bremler-Barr, S. Danino, Y. Shavitt, "A Flushing Attack on the DNS Cache," USENIX Security 2024. https://www.usenix.org/conference/usenixsecurity24/presentation/afek
[44] F. Miao, X. Li, C. An, W. Xu, J. Wang, "One Char to Rule Them All: Systematically Exploring and Exploiting DNS Silent Vulnerabilities in Domain Name Resolution," IEEE S&P 2026. https://doi.org/10.1109/SP63933.2026.00260
[45] Y. Wu, Y. Zhang, C. Lu, B. Liu, "Should I Trust You? Rethinking the Principle of Zone-Based Isolation DNS Bailiwick Checking," NDSS 2026. https://doi.org/10.14722/ndss.2026.240330

**后量子 DNSSEC 大响应/分片**

[46] A. S. Rawat, M. P. Jhanwar, "Post-Quantum DNSSEC over UDP via QNAME-Based Fragmentation," SPACE 2024; Cryptology ePrint 2024/1320. https://doi.org/10.1007/978-3-031-51583-5_4
[47] J. Goertzen, D. Stebila, "Post-Quantum Signatures in DNSSEC via Request-Based Fragmentation," LNCS, 2023. https://doi.org/10.1007/978-3-031-40003-2_20
[48] M. Raavi, S. Wuthier, S.-Y. Chang, "Securing Post-Quantum DNSSEC Against Fragmentation Mis-Association Threat," IEEE ICC 2024. https://doi.org/10.1109/ICC51166.2024.10622607
[49] C. McGowan, J. Liu, S. Ruj, "Security Considerations for Post-Quantum Signatures in DNSSEC via Request-Based Fragmentation," WWW 2025 Companion. https://doi.org/10.1145/3701716.3715585
[50] F. Heikamp, S. W. A. Shah, J. S. Teh, et al., "Poster: Hybrid Signatures for Post-Quantum DNSSEC: A Real-World Evaluation," ACM IMC 2026. https://doi.org/10.1145/3777912.3847598
[51] M. Iavich, A. Lopata, N. Bagalishvili, "Post-Quantum DNSSEC: A Systematic Review of Transport Constraints, Security Vulnerabilities, and Migration Pathways," Mathematics, 2026. https://doi.org/10.3390/math14142555
[52] A. S. Rawat, M. P. Jhanwar, "Quantum-safe Signatureless DNSSEC," ACM ASIACCS 2025. https://doi.org/10.1145/3708821.3710837

**检测与 IPv6**

[53] M. Iavich, V. Svanadze, O. Kovalchuk, "A Deterministic, Rule-Based Framework for Detecting Anomalous IP Packet Fragmentation," Future Internet, 2025/2026. https://doi.org/10.3390/fi18010019
[54] H. Yu, X. Yuchi, X. Yang, et al., "DNS-Sensor: A Sensor-Driven Architecture for Real-Time DNS Cache Poisoning Detection and Mitigation," Sensors, 2025. https://doi.org/10.3390/s25226884
[55] B. Lin, L. Zhang, Y. Guo, H. Zhang, Y. Fang, "Research on Security Protection Evasion Mechanism Based on IPv6 Fragment Headers (FragEva6)," IEEE LCN 2024. https://doi.org/10.1109/LCN60385.2024.10639756
[56] F. Huang, Y. Yang, Z. Yang, B. Hou, Y. Chen, Z. Cai, "A Closer Look at IPv6 IP-ID Behavior in the Wild," LNCS, 2025. https://doi.org/10.1007/978-3-031-85960-1_2

**中文文献**

[57] 李沁心, 武文浩, 王兆华, 李振宇, 《域名系统递归解析服务安全技术综述：风险、防护和测量》, 计算机研究与发展, DOI 10.7544/issn1000-1239.202440158（卷期年份以官网为准，待核实）.
[58] 杨天乐, 谌颖, 王海涛, 《通过缓存一致性检查方法和灾难解析系统优化来抵御 DNS 缓存中毒》,《新一代信息技术》2023, 6(16).

**工具、数据源与目录**

[59] Scapy https://scapy.net/ ；Zeek https://zeek.org/ ；Suricata https://suricata.io/ ；eBPF https://ebpf.io/ ；RIPE Atlas https://atlas.ripe.net/ ；DNS-OARC DITL https://www.dns-oarc.net/oarc/data/ditl ；OpenINTEL https://openintel.nl/ ；BIND https://www.isc.org/bind/ ；Unbound https://nlnetlabs.nl/projects/unbound/about/ ；Knot Resolver https://www.knot-resolver.cz/ ；PowerDNS Recursor https://docs.powerdns.com/recursor/
[60] CCF 推荐国际学术会议/期刊目录：https://www.ccf.org.cn/Academic_Evaluation/By_category/ （分类页：NIS https://www.ccf.org.cn/Academic_Evaluation/NIS/ ；CN https://www.ccf.org.cn/Academic_Evaluation/CN/ ，2026-10-22 访问；等级以当期目录为准）。

---

> **附件（团队工作笔记）**：`notes/lit-classic.md`（经典文献）、`notes/lit-recent.md`（2021–2026 最新工作，41 篇+标准+中文线索）、`notes/lab-methods.md`（731 行实验方法，含配置/命令/矩阵/工件/伦理）、`notes/novelty-venues.md`（369 行可发表性/选题/投稿策略/12 周计划）。主报告已吸收其核心结论；引用细节以各笔记中的 DOI/URL 为准。
