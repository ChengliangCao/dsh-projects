/**
 * Project Memory core (M0 spike).
 *
 * Implements the Claude auto-memory semantics we want for DSH:
 * - project scope derived from the git repository (worktrees/subdirs share one scope)
 * - MEMORY.md index + one Markdown file per fact
 * - four memory types: user / feedback / project / reference
 * - byte/line budget for the injected index (over-limit is reported, not silently dropped)
 * - atomic writes + a simple cross-process lock
 *
 * No vector search, no external services: `search()` is local keyword matching.
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

export type MemoryType = 'user' | 'feedback' | 'project' | 'reference'

export const MEMORY_TYPES: readonly MemoryType[] = ['user', 'feedback', 'project', 'reference']

export interface MemoryRecord {
  name: string
  description: string
  type: MemoryType
  content: string
  /** ISO 8601; maintained by the store. */
  modified: string
  /** Optional ISO 8601 validity window (for future invalidation; M2+). */
  validAt?: string
  /** Optional replacement link (for future "invalidate instead of delete"; M2+). */
  supersededBy?: string
}

export interface MemoryStoreOptions {
  /** Root directory for all memory scopes, e.g. `~/.dsh/projects/memory`. */
  rootDir: string
  /** Index budget for prompt injection. Default: 4096 bytes / 200 lines. */
  maxIndexBytes?: number
  maxIndexLines?: number
  /** Enable a global user scope shared by all projects. Default: true. */
  enableUserScope?: boolean
}

export interface MemoryIndexOptions {
  maxBytes: number
  maxLines: number
}

export interface MemoryScope {
  /** Stable hash of the uniqueness canon (git repo root, or project dir). */
  scopeKey: string
  /** Directory holding MEMORY.md and notes/. */
  dir: string
  /** Git repository root when the project lives inside one. */
  repoRoot: string | null
  source: 'git' | 'directory'
}

export interface MemoryWriteInput {
  name: string
  description: string
  type: MemoryType
  content: string
  validAt?: string
  supersededBy?: string
}

export interface MemoryWriteResult {
  record: MemoryRecord
  file: string
  indexOverLimit: boolean
  indexLines: number
  indexBytes: number
}

const DEFAULT_MAX_INDEX_BYTES = 4096
const DEFAULT_MAX_INDEX_LINES = 200
const INDEX_FILE = 'MEMORY.md'
const NOTES_DIR = 'notes'
const LOCK_RETRY_MS = 25
const LOCK_RETRIES = 200
const LOCK_STALE_MS = 10_000

/** Build the storage slug for a memory name; throws for reserved/empty names. */
export function slugifyMemoryName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('memory name must not be empty')
  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  if (!slug) throw new Error(`memory name '${name}' has no usable characters`)
  // A memory named "memory" would collide with MEMORY.md on case-insensitive FS.
  if (slug === 'memory' || slug === 'index') {
    throw new Error(`memory name '${name}' is reserved`)
  }
  return slug.slice(0, 80)
}

/** Find the git repository root from a project directory, or null. */
export async function findGitRepoRoot(projectDir: string): Promise<string | null> {
  let current = resolve(projectDir)
  for (;;) {
    try {
      const s = await stat(join(current, '.git'))
      if (s.isDirectory() || s.isFile()) return current
    } catch {
      // continue walking up
    }
    const parent = dirname(current)
    if (parent === current) return null
    current = parent
  }
}

function hashScope(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 16)
}

/** Minimal YAML frontmatter parser for our own files (no external deps). */
export function parseMemoryFile(raw: string): { fields: Record<string, string>; content: string } {
  if (!raw.startsWith('---\n')) return { fields: {}, content: raw.trim() }
  const end = raw.indexOf('\n---\n', 4)
  if (end === -1) return { fields: {}, content: raw.trim() }
  const block = raw.slice(4, end)
  const content = raw.slice(end + 5).replace(/^\n+/, '')
  const fields: Record<string, string> = {}
  for (const line of block.split('\n')) {
    const m = /^([a-zA-Z_][\w-]*):\s*(.*)$/.exec(line)
    if (m) fields[m[1]!] = m[2]!.trim()
  }
  return { fields, content }
}

function renderMemoryFile(record: MemoryRecord): string {
  const lines = [
    '---',
    `name: ${record.name}`,
    `description: ${record.description}`,
    `type: ${record.type}`,
    `modified: ${record.modified}`,
  ]
  if (record.validAt) lines.push(`valid_at: ${record.validAt}`)
  if (record.supersededBy) lines.push(`superseded_by: ${record.supersededBy}`)
  lines.push('---', '', record.content, '')
  return lines.join('\n')
}

/** One index line. Escapes markdown brackets so a name cannot break the list. */
export function renderIndexLine(record: MemoryRecord): string {
  const slug = slugifyMemoryName(record.name)
  const title = record.name.replace(/[\[\]]/g, '')
  const description = record.description.replace(/\s+/g, ' ').trim()
  const month = record.modified.slice(0, 7)
  return `- [${title}](${NOTES_DIR}/${slug}.md) — ${description} (${month})`
}

export class MemoryStore {
  readonly rootDir: string
  readonly maxIndexBytes: number
  readonly maxIndexLines: number
  readonly enableUserScope: boolean

  constructor(options: MemoryStoreOptions) {
    this.rootDir = resolve(options.rootDir)
    this.maxIndexBytes = options.maxIndexBytes ?? DEFAULT_MAX_INDEX_BYTES
    this.maxIndexLines = options.maxIndexLines ?? DEFAULT_MAX_INDEX_LINES
    this.enableUserScope = options.enableUserScope ?? true
  }

  /** Resolve the shared memory scope for a project directory. */
  async resolveScope(projectDir: string): Promise<MemoryScope> {
    const repoRoot = await findGitRepoRoot(projectDir)
    const scopeKey = repoRoot ?? resolve(projectDir)
    return {
      scopeKey,
      dir: join(this.rootDir, 'scopes', hashScope(scopeKey)),
      repoRoot,
      source: repoRoot ? 'git' : 'directory',
    }
  }

  /** The global user scope, when enabled. */
  userScope(): MemoryScope {
    if (!this.enableUserScope) throw new Error('user scope is disabled')
    return { scopeKey: 'user', dir: join(this.rootDir, 'user'), repoRoot: null, source: 'directory' }
  }

  async list(scopeDir: string): Promise<MemoryRecord[]> {
    const dir = join(scopeDir, NOTES_DIR)
    let files: string[]
    try {
      files = (await readdir(dir)).filter((f) => f.endsWith('.md')).sort()
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw err
    }
    const records: MemoryRecord[] = []
    for (const file of files) {
      const raw = await readFile(join(dir, file), 'utf8')
      const { fields, content } = parseMemoryFile(raw)
      const type = fields['type'] as MemoryType | undefined
      records.push({
        name: fields['name'] ?? file.replace(/\.md$/, ''),
        description: fields['description'] ?? '',
        type: type && MEMORY_TYPES.includes(type) ? type : 'project',
        content,
        modified: fields['modified'] ?? new Date(0).toISOString(),
        ...(fields['valid_at'] ? { validAt: fields['valid_at'] } : {}),
        ...(fields['superseded_by'] ? { supersededBy: fields['superseded_by'] } : {}),
      })
    }
    return records
  }

  async read(scopeDir: string, name: string): Promise<MemoryRecord | undefined> {
    const slug = slugifyMemoryName(name)
    try {
      const raw = await readFile(join(scopeDir, NOTES_DIR, `${slug}.md`), 'utf8')
      const { fields, content } = parseMemoryFile(raw)
      const type = fields['type'] as MemoryType | undefined
      return {
        name: fields['name'] ?? name,
        description: fields['description'] ?? '',
        type: type && MEMORY_TYPES.includes(type) ? type : 'project',
        content,
        modified: fields['modified'] ?? new Date(0).toISOString(),
        ...(fields['valid_at'] ? { validAt: fields['valid_at'] } : {}),
        ...(fields['superseded_by'] ? { supersededBy: fields['superseded_by'] } : {}),
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw err
    }
  }

  async write(scopeDir: string, input: MemoryWriteInput): Promise<MemoryWriteResult> {
    if (!MEMORY_TYPES.includes(input.type)) throw new Error(`unknown memory type '${input.type}'`)
    const slug = slugifyMemoryName(input.name)
    const record: MemoryRecord = {
      name: input.name.trim(),
      description: input.description.trim(),
      type: input.type,
      content: input.content.replace(/\r\n/g, '\n'),
      modified: new Date().toISOString(),
      ...(input.validAt ? { validAt: input.validAt } : {}),
      ...(input.supersededBy ? { supersededBy: input.supersededBy } : {}),
    }
    await mkdir(join(scopeDir, NOTES_DIR), { recursive: true })
    return this.withLock(scopeDir, async () => {
      const file = join(scopeDir, NOTES_DIR, `${slug}.md`)
      await this.atomicWrite(file, renderMemoryFile(record))
      const index = await this.rebuildIndex(scopeDir)
      return {
        record,
        file,
        indexOverLimit: index.overLimit,
        indexLines: index.lines,
        indexBytes: index.bytes,
      }
    })
  }

  async remove(scopeDir: string, name: string): Promise<boolean> {
    const slug = slugifyMemoryName(name)
    return this.withLock(scopeDir, async () => {
      let removed = false
      try {
        await rm(join(scopeDir, NOTES_DIR, `${slug}.md`))
        removed = true
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
      }
      if (removed) await this.rebuildIndex(scopeDir)
      return removed
    })
  }

  /** Build MEMORY.md from the notes directory and report budget usage. */
  async rebuildIndex(scopeDir: string): Promise<{ overLimit: boolean; lines: number; bytes: number }> {
    const records = await this.list(scopeDir)
    records.sort((a, b) => b.modified.localeCompare(a.modified) || a.name.localeCompare(b.name))
    const header = records.length ? '# Project memory\n\n' : ''
    const body = records.map(renderIndexLine).join('\n')
    const index = records.length ? `${header}${body}\n` : ''
    await this.atomicWrite(join(scopeDir, INDEX_FILE), index)
    const lines = index ? index.replace(/\n$/, '').split('\n').length : 0
    const bytes = Buffer.byteLength(index, 'utf8')
    return {
      overLimit: lines > this.maxIndexLines || bytes > this.maxIndexBytes,
      lines,
      bytes,
    }
  }

  /**
   * Render the prompt injection text under the budget. Empty when there is no
   * memory (so the section contributes 0 bytes).
   */
  async renderIndex(scopeDir: string): Promise<string> {
    const records = await this.list(scopeDir)
    if (records.length === 0) return ''
    records.sort((a, b) => b.modified.localeCompare(a.modified) || a.name.localeCompare(b.name))
    const header = '# Project memory index\n\n'
    const lines = records.map(renderIndexLine)
    const suffixFor = (truncated: number): string =>
      truncated > 0 ? `\n- …（已按 ${this.maxIndexBytes}B 预算截断 ${truncated} 条）` : ''
    const build = (count: number, truncated: number): string =>
      `${header}${lines.slice(0, count).join('\n')}${suffixFor(truncated)}\n`

    // Keep at most maxIndexLines lines, then shrink further until the byte
    // budget (including the truncation marker) fits.
    let count = Math.min(lines.length, this.maxIndexLines)
    let truncated = lines.length - count
    while (count > 0 && Buffer.byteLength(build(count, truncated), 'utf8') > this.maxIndexBytes) {
      count -= 1
      truncated += 1
    }
    if (count === 0) return ''
    return build(count, truncated)
  }

  /** Local keyword search (no embeddings in MVP). Empty query returns all. */
  async search(scopeDir: string, query: string): Promise<MemoryRecord[]> {
    const records = await this.list(scopeDir)
    const q = query.trim().toLowerCase()
    if (!q) return records
    return records.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.content.toLowerCase().includes(q),
    )
  }

  private async withLock<T>(scopeDir: string, fn: () => Promise<T>): Promise<T> {
    const lock = join(scopeDir, '.lock')
    for (let i = 0; i < LOCK_RETRIES; i += 1) {
      try {
        await mkdir(lock)
        try {
          return await fn()
        } finally {
          await rm(lock, { recursive: true, force: true })
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
        try {
          const s = await stat(lock)
          if (Date.now() - s.mtimeMs > LOCK_STALE_MS) {
            await rm(lock, { recursive: true, force: true })
            continue
          }
        } catch {
          // lock disappeared; retry immediately
        }
        await new Promise((r) => setTimeout(r, LOCK_RETRY_MS))
      }
    }
    throw new Error(`memory store: could not acquire lock at ${lock}`)
  }

  private async atomicWrite(file: string, content: string): Promise<void> {
    await mkdir(dirname(file), { recursive: true })
    const tmp = `${file}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
    await writeFile(tmp, content, 'utf8')
    await rename(tmp, file)
  }
}
