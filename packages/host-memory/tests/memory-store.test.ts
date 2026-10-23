import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, it } from 'node:test'

import {
  MemoryStore,
  findGitRepoRoot,
  parseMemoryFile,
  renderIndexLine,
  slugifyMemoryName,
} from '../src/memory-store.ts'

const tempDirs: string[] = []

async function tempRoot(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-memory-test-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) await rm(dir, { recursive: true, force: true })
})

describe('slugifyMemoryName', () => {
  it('normalizes names and rejects reserved names', () => {
    assert.equal(slugifyMemoryName('Deploy Checklist'), 'deploy-checklist')
    assert.equal(slugifyMemoryName('用户偏好'), '用户偏好')
    assert.throws(() => slugifyMemoryName('   '), /empty/)
    assert.throws(() => slugifyMemoryName('MEMORY'), /reserved/)
  })
})

describe('frontmatter round-trip', () => {
  it('parses fields and content', () => {
    const raw = '---\nname: Foo\ndescription: bar\ntype: feedback\nmodified: 2026-10-22T00:00:00.000Z\n---\n\nhello\n'
    const { fields, content } = parseMemoryFile(raw)
    assert.equal(fields['name'], 'Foo')
    assert.equal(fields['type'], 'feedback')
    assert.equal(content.trim(), 'hello')
  })
})

describe('git repository scope', () => {
  it('derives one shared scope for worktrees/subdirectories of a repo', async () => {
    const root = await tempRoot()
    const repo = join(root, 'repo')
    await mkdir(join(repo, '.git'), { recursive: true })
    await mkdir(join(repo, 'packages', 'api'), { recursive: true })
    await mkdir(join(root, 'other'), { recursive: true })

    const store = new MemoryStore({ rootDir: join(root, 'memory') })
    const a = await store.resolveScope(join(repo, 'packages', 'api'))
    const b = await store.resolveScope(join(repo, 'packages'))
    const other = await store.resolveScope(join(root, 'other'))

    assert.equal(a.source, 'git')
    assert.equal(a.repoRoot, repo)
    assert.equal(a.scopeKey, b.scopeKey)
    assert.equal(a.dir, b.dir)
    assert.notEqual(a.scopeKey, other.scopeKey)
    assert.equal(await findGitRepoRoot(join(repo, 'packages', 'api')), repo)
  })
})

describe('write / read / list / delete', () => {
  it('persists typed memories and a MEMORY.md index', async () => {
    const root = await tempRoot()
    const store = new MemoryStore({ rootDir: join(root, 'memory') })
    const scope = await store.resolveScope(join(root, 'project'))
    await mkdir(scope.dir, { recursive: true })

    const result = await store.write(scope.dir, {
      name: 'Deploy checklist',
      description: 'Run make test before deploy',
      type: 'project',
      content: '- run make test\n- ask before merge',
    })
    assert.equal(result.indexOverLimit, false)
    assert.match(result.file, /notes\/deploy-checklist\.md$/)

    const list = await store.list(scope.dir)
    assert.equal(list.length, 1)
    assert.equal(list[0]!.type, 'project')
    assert.match(list[0]!.modified, /^\d{4}-\d{2}-\d{2}T/)

    const raw = await readFile(join(scope.dir, 'MEMORY.md'), 'utf8')
    assert.match(raw, /# Project memory/)
    assert.match(raw, /\[Deploy checklist\]\(notes\/deploy-checklist\.md\)/)

    const read = await store.read(scope.dir, 'Deploy checklist')
    assert.match(read?.content ?? '', /make test/)

    assert.equal(await store.remove(scope.dir, 'Deploy checklist'), true)
    assert.deepEqual(await store.list(scope.dir), [])
    assert.equal(await readFile(join(scope.dir, 'MEMORY.md'), 'utf8'), '')
  })

  it('updates in place instead of duplicating', async () => {
    const root = await tempRoot()
    const store = new MemoryStore({ rootDir: join(root, 'memory') })
    const scope = await store.resolveScope(join(root, 'p'))
    await mkdir(scope.dir, { recursive: true })
    await store.write(scope.dir, { name: 'Branch', description: 'target main', type: 'feedback', content: 'main' })
    await store.write(scope.dir, { name: 'Branch', description: 'target release', type: 'feedback', content: 'release' })
    const list = await store.list(scope.dir)
    assert.equal(list.length, 1)
    assert.equal(list[0]!.description, 'target release')
  })
})

describe('prompt injection budget', () => {
  it('injects nothing when empty and respects the byte budget', async () => {
    const root = await tempRoot()
    const store = new MemoryStore({ rootDir: join(root, 'memory'), maxIndexBytes: 220 })
    const scope = await store.resolveScope(join(root, 'p'))
    await mkdir(scope.dir, { recursive: true })
    assert.equal(await store.renderIndex(scope.dir), '')

    for (let i = 0; i < 10; i += 1) {
      await store.write(scope.dir, {
        name: `note ${i}`,
        description: `description ${i} `.repeat(3),
        type: 'project',
        content: 'body',
      })
    }
    const injected = await store.renderIndex(scope.dir)
    assert.ok(injected.length > 0)
    assert.ok(Buffer.byteLength(injected, 'utf8') <= 220)
    assert.match(injected, /截断/)
  })

  it('reports over-limit index but still writes the fact (Claude behavior)', async () => {
    const root = await tempRoot()
    const store = new MemoryStore({ rootDir: join(root, 'memory'), maxIndexLines: 3 })
    const scope = await store.resolveScope(join(root, 'p'))
    await mkdir(scope.dir, { recursive: true })
    let result
    for (let i = 0; i < 5; i += 1) {
      result = await store.write(scope.dir, {
        name: `fact ${i}`,
        description: `d${i}`,
        type: 'reference',
        content: 'x',
      })
    }
    assert.equal(result?.indexOverLimit, true)
    assert.equal((await store.list(scope.dir)).length, 5)
  })
})

describe('concurrency and search', () => {
  it('serializes concurrent writes and finds local matches', async () => {
    const root = await tempRoot()
    const store = new MemoryStore({ rootDir: join(root, 'memory') })
    const scope = await store.resolveScope(join(root, 'p'))
    await mkdir(scope.dir, { recursive: true })

    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        store.write(scope.dir, {
          name: `concurrent ${i}`,
          description: i % 2 === 0 ? 'even entry' : 'odd entry',
          type: 'user',
          content: i % 2 === 0 ? 'alpha' : 'beta',
        }),
      ),
    )
    assert.equal((await store.list(scope.dir)).length, 8)
    const even = await store.search(scope.dir, 'even')
    assert.equal(even.length, 4)
    assert.equal((await store.search(scope.dir, 'beta')).length, 4)
  })
})

describe('index line rendering', () => {
  it('escapes brackets and includes month', () => {
    const line = renderIndexLine({
      name: 'A [test] memory',
      description: 'desc',
      type: 'project',
      content: '',
      modified: '2026-10-22T00:00:00.000Z',
    })
    assert.equal(line, '- [A test memory](notes/a-test-memory.md) — desc (2026-10)')
  })
})
