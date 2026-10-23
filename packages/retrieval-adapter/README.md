# @dsh-projects/memory-retrieval

M2+ 可选语义检索 adapter（opt-in，不进入 MVP）。实现 `MemoryStore.search`：Markdown 源真相 + 可重建影子索引（memsearch 路线：chunk → SHA-256 → embedding → Milvus Lite/sqlite-vec）+ dense/BM25/RRF + 三层渐进披露。默认不安装；不装时 `memory_search` 走本地索引/文件名匹配。
