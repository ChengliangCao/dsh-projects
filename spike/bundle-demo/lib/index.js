/**
 * M0 spike plugin (self-contained; no imports outside this package).
 *
 * 1) Injects `MEMORY.md` (budgeted) into the system prompt on every assembly.
 * 2) Registers spike tools:
 *    - spike_memory_write  → write a typed project memory
 *    - spike_memory_search → local keyword search
 *    - spike_spawn_thread  → create a top-level Session and prompt it (thread carrier A probe)
 *
 * This is a throwaway bundle for M0 verification, not the product plugin.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'

import { MemoryStore } from './memory-store.js'

export const name = '@dsh-projects/spike-demo'
export const inject = ['systemPrompt', 'tools']

function findGitRootSync(dir) {
  let cur = resolve(dir)
  for (;;) {
    try {
      readFileSync(join(cur, '.git'))
      return cur
    } catch {
      // .git can be a directory: readFileSync throws EISDIR, which is not ENOENT
      try {
        if (readFileSync(join(cur, '.git', 'HEAD'))) return cur
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
  if (kept.length === 0) return ''
  return kept.join('\n') + '\n'
}

function textResult(text) {
  return [{ type: 'text', text: String(text) }]
}

function objectSchema(properties, required = []) {
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  }
}

export function apply(ctx, config = {}) {
  const rootDir = config.rootDir || resolve(process.cwd(), '.spike-memory')
  const projectDir = config.projectDir || process.cwd()
  const maxIndexBytes = config.maxIndexBytes ?? 4096
  const maxIndexLines = config.maxIndexLines ?? 200
  const scopeDir = scopeDirFor(rootDir, projectDir)
  mkdirSync(scopeDir, { recursive: true })

  const store = new MemoryStore({
    rootDir,
    maxIndexBytes,
    maxIndexLines,
    enableUserScope: config.enableUserScope ?? true,
  })

  // ---- prompt injection ----
  const systemPrompt = typeof ctx.get === 'function' ? ctx.get('systemPrompt') : undefined
  if (systemPrompt && typeof systemPrompt.section === 'function') {
    systemPrompt.section({
      name: 'spike:project-memory',
      order: 4000,
      text: () => readIndexSync(scopeDir, maxIndexBytes, maxIndexLines),
    })
    console.error('[spike-demo] memory section registered:', scopeDir)
  } else {
    console.error('[spike-demo] systemPrompt service unavailable; injection skipped')
  }

  // ---- model tools ----
  const tools = typeof ctx.get === 'function' ? ctx.get('tools') : undefined
  if (!tools || typeof tools.register !== 'function') {
    console.error('[spike-demo] tools service unavailable; tools skipped')
    return
  }

  tools.register({
    name: 'spike_memory_write',
    description: 'M0 spike: write one typed project memory and rebuild MEMORY.md.',
    parameters: objectSchema(
      {
        name: { type: 'string', description: 'Memory title, e.g. "API branch policy"' },
        description: { type: 'string', description: 'One-line summary shown in the index' },
        type: { type: 'string', enum: ['user', 'feedback', 'project', 'reference'] },
        content: { type: 'string', description: 'Memory body (Markdown)' },
      },
      ['name', 'description', 'type', 'content'],
    ),
    output: {
      schema: objectSchema({
        name: { type: 'string' },
        file: { type: 'string' },
        indexOverLimit: { type: 'boolean' },
        indexBytes: { type: 'number' },
      }),
      render: (_args, value) => textResult(JSON.stringify(value)),
    },
    execute: async (args) => {
      const result = await store.write(scopeDir, {
        name: args.name,
        description: args.description,
        type: args.type,
        content: args.content,
      })
      console.error('[spike-demo] memory written:', result.file, 'bytes=', result.indexBytes)
      return {
        name: result.record.name,
        file: result.file,
        indexOverLimit: result.indexOverLimit,
        indexBytes: result.indexBytes,
      }
    },
  })

  tools.register({
    name: 'spike_memory_search',
    description: 'M0 spike: local keyword search over project memory (no embeddings).',
    parameters: objectSchema(
      { query: { type: 'string', description: 'Substring query' } },
      ['query'],
    ),
    output: {
      schema: {
        type: 'array',
        items: objectSchema({
          name: { type: 'string' },
          type: { type: 'string' },
          description: { type: 'string' },
        }),
      },
      render: (_args, value) => textResult(JSON.stringify(value)),
    },
    execute: async (args) => {
      const hits = await store.search(scopeDir, args.query)
      return hits.map((r) => ({ name: r.name, type: r.type, description: r.description }))
    },
  })

  tools.register({
    name: 'spike_spawn_thread',
    description:
      'M0 spike: create a top-level DSH Session (thread) and prompt it with a task. Use this to verify thread carrier A.',
    parameters: objectSchema(
      {
        prompt: { type: 'string', description: 'Initial task brief for the thread session' },
        preset: { type: 'string', description: 'Optional agent preset id (e.g. standard)' },
        cwd: { type: 'string', description: 'Optional working directory; defaults to the project dir' },
      },
      ['prompt'],
    ),
    output: {
      schema: objectSchema({
        sessionId: { type: 'string' },
        cwd: { type: 'string' },
        accepted: { type: 'boolean' },
      }),
      render: (_args, value) =>
        textResult(`created thread session ${value.sessionId} (cwd=${value.cwd}, accepted=${value.accepted})`),
    },
    execute: async (args, exec) => {
      const sc = typeof ctx.get === 'function' ? ctx.get('sessionController') : undefined
      if (!sc || typeof sc.create !== 'function') throw new Error('sessionController unavailable')
      const cwd = args.cwd || projectDir
      const created = await sc.create({
        cwd,
        sessionId: `spike-thread-${randomUUID()}`,
        ...(args.preset ? { agentPreset: args.preset } : {}),
      })
      const signal = exec && exec.signal ? exec.signal : new AbortController().signal
      await sc.prompt(
        {
          requestId: randomUUID(),
          sessionId: created.sessionId,
          mode: 'queue',
          content: [{ type: 'text', text: args.prompt }],
        },
        signal,
      )
      console.error('[spike-demo] thread spawned:', created.sessionId, 'cwd=', cwd)
      return { sessionId: created.sessionId, cwd, accepted: true }
    },
  })

  console.error('[spike-demo] tools registered (memory_write, memory_search, spawn_thread)')
}
