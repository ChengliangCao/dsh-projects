/**
 * DSH Projects preview — project memory plugin.
 * MEMORY.md index + typed facts + system-prompt injection + memory_* tools.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'

import { MemoryStore } from './memory-store.js'

export const name = '@dsh-projects/app-bundle/memory'
export const inject = ['systemPrompt', 'tools']

function findGitRootSync(dir) {
  let cur = resolve(dir)
  for (;;) {
    try {
      if (readFileSync(join(cur, '.git', 'HEAD'))) return cur
    } catch {
      try {
        readFileSync(join(cur, '.git'))
        return cur
      } catch {
        /* keep walking */
      }
    }
    const parent = dirname(cur)
    if (parent === cur) return null
    cur = parent
  }
}

function scopeDirFor(rootDir, projectDir) {
  const repo = findGitRootSync(projectDir)
  const key = repo ?? resolve(projectDir)
  const hash = createHash('sha256').update(key).digest('hex').slice(0, 16)
  return join(resolve(rootDir), 'scopes', hash)
}

function readIndexSync(scopeDir, maxBytes, maxLines) {
  let raw
  try {
    raw = readFileSync(join(scopeDir, 'MEMORY.md'), 'utf8')
  } catch {
    return ''
  }
  if (!raw.trim()) return ''
  const lines = raw.replace(/\n$/, '').split('\n')
  const kept = []
  let bytes = 0
  for (const line of lines) {
    if (kept.length >= maxLines) break
    const b = Buffer.byteLength(line, 'utf8') + 1
    if (bytes + b > maxBytes) break
    kept.push(line)
    bytes += b
  }
  return kept.length ? kept.join('\n') + '\n' : ''
}

const text = (t) => [{ type: 'text', text: String(t) }]
const objectSchema = (properties, required = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
})

export function apply(ctx, config = {}) {
  const projectDir = resolve(config.projectDir || process.cwd())
  const rootDir = resolve(config.rootDir || join(projectDir, '.memory'))
  const maxIndexBytes = config.maxIndexBytes ?? 4096
  const maxIndexLines = config.maxIndexLines ?? 200
  const scopeDir = scopeDirFor(rootDir, projectDir)
  mkdirSync(scopeDir, { recursive: true })

  const store = new MemoryStore({ rootDir, maxIndexBytes, maxIndexLines })

  const systemPrompt = ctx.get('systemPrompt')
  if (systemPrompt && typeof systemPrompt.section === 'function') {
    systemPrompt.section({
      name: 'projects:memory',
      order: 4000,
      text: () => readIndexSync(scopeDir, maxIndexBytes, maxIndexLines),
    })
  }

  const tools = ctx.get('tools')
  if (!tools || typeof tools.register !== 'function') return

  tools.register({
    name: 'memory_write',
    description:
      '写入一条项目记忆（类型 user/feedback/project/reference）。同名会更新而不是重复；项目内所有线程共享。用户说“记住…”时使用。',
    parameters: objectSchema(
      {
        name: { type: 'string', description: '记忆标题' },
        description: { type: 'string', description: '一行摘要（进入 MEMORY.md 索引）' },
        type: { type: 'string', enum: ['user', 'feedback', 'project', 'reference'] },
        content: { type: 'string', description: '记忆正文（Markdown）' },
      },
      ['name', 'description', 'type', 'content'],
    ),
    output: {
      schema: objectSchema({
        name: { type: 'string' },
        indexOverLimit: { type: 'boolean' },
        indexBytes: { type: 'number' },
      }),
      render: (_a, v) => text(JSON.stringify(v)),
    },
    execute: async (args) => {
      const r = await store.write(scopeDir, args)
      return { name: r.record.name, indexOverLimit: r.indexOverLimit, indexBytes: r.indexBytes }
    },
  })

  tools.register({
    name: 'memory_search',
    description: '在项目记忆中做本地关键词搜索（无向量检索）。',
    parameters: objectSchema({ query: { type: 'string' } }, ['query']),
    output: {
      schema: { type: 'array', items: objectSchema({ name: { type: 'string' }, type: { type: 'string' }, description: { type: 'string' } }) },
      render: (_a, v) => text(JSON.stringify(v)),
    },
    execute: async (args) => {
      const hits = await store.search(scopeDir, args.query)
      return hits.map((r) => ({ name: r.name, type: r.type, description: r.description }))
    },
  })

  tools.register({
    name: 'memory_list',
    description: '列出当前项目记忆（索引内容）。',
    parameters: objectSchema({}),
    output: {
      schema: { type: 'array', items: objectSchema({ name: { type: 'string' }, type: { type: 'string' }, description: { type: 'string' }, modified: { type: 'string' } }) },
      render: (_a, v) => text(JSON.stringify(v)),
    },
    execute: async () => {
      const list = await store.list(scopeDir)
      return list.map((r) => ({ name: r.name, type: r.type, description: r.description, modified: r.modified }))
    },
  })

  tools.register({
    name: 'memory_read',
    description: '读取一条项目记忆的正文。',
    parameters: objectSchema({ name: { type: 'string' } }, ['name']),
    output: {
      schema: { type: 'object', properties: { name: { type: 'string' }, content: { type: 'string' } } },
      render: (_a, v) => text(v.content ?? ''),
    },
    execute: async (args) => {
      const rec = await store.read(scopeDir, args.name)
      return rec ? { name: rec.name, content: rec.content } : { name: args.name, content: '（未找到）' }
    },
  })
}
