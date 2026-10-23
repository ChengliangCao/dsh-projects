/**
 * M0 memory demo: exercises the built MemoryStore against a temp dir and
 * prints the injected index (budgeted) plus scope info.
 *
 * Run after `pnpm -r build`:
 *   node spike/memory-demo.mjs
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { MemoryStore } from '../packages/host-memory/lib/memory-store.js'

const root = await mkdtemp(join(tmpdir(), 'dsh-memory-demo-'))
try {
  const store = new MemoryStore({ rootDir: join(root, 'memory'), maxIndexBytes: 4096 })
  const repo = join(root, 'demo-repo')
  const { mkdir } = await import('node:fs/promises')
  await mkdir(join(repo, '.git'), { recursive: true })
  const projectDir = join(repo, 'packages', 'api')
  await mkdir(projectDir, { recursive: true })

  const scope = await store.resolveScope(projectDir)
  console.log('scope:', { source: scope.source, repoRoot: scope.repoRoot, dir: scope.dir })

  await store.write(scope.dir, {
    name: 'API branch policy',
    description: '所有线程从 main 拉分支，先给方案再开 PR',
    type: 'feedback',
    content: 'Why: 上次直接开 PR 导致返工。\nHow to apply: spawn 线程时在简报里写明，PR 前必须让用户看方案。',
  })
  await store.write(scope.dir, {
    name: 'p95 baseline',
    description: 'payments-api 的 p95 基线是 240ms（2026-09 采样）',
    type: 'project',
    content: '数据来源: slow-queries-2026Q3.csv；目标 < 200ms。',
  })
  await store.write(scope.dir, {
    name: 'Always answer in Chinese',
    description: '用户偏好中文交流',
    type: 'user',
    content: '除非用户用英文提问。',
  })

  const index = await store.renderIndex(scope.dir)
  console.log('\n--- injected index (bytes=%d) ---\n%s', Buffer.byteLength(index, 'utf8'), index)
  console.log('--- search("p95") ---')
  console.log((await store.search(scope.dir, 'p95')).map((r) => r.name))
  console.log('--- list ---')
  console.log((await store.list(scope.dir)).map((r) => `${r.type}:${r.name}`))
} finally {
  await rm(root, { recursive: true, force: true })
}
