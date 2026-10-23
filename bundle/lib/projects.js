/**
 * DSH Projects — multi-project registry (Host).
 * Index: $DSH_HOME/projects-ui/registry.json ; current project pointer in same dir.
 * Each project owns <dir>/.dsh/project.json so project metadata travels with the folder.
 */
import { accessSync, constants, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'

export const name = '@dsh-projects/app-bundle/projects'
export const inject = ['tools']

const text = (t) => [{ type: 'text', text: String(t) }]
const objectSchema = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false })

const home = process.env.DSH_HOME || join(homedir(), '.dsh')
const baseDir = join(home, 'projects-ui')
const registryPath = join(baseDir, 'registry.json')
const currentPath = join(baseDir, 'current.json')

function readJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return fallback }
}
function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(value, null, 2))
}
const readRegistry = () => readJson(registryPath, { projects: [], currentId: null })
const saveRegistry = (r) => writeJson(registryPath, r)
function loadProject(id) { return readRegistry().projects.find((p) => p.id === id) }
function currentProject() { const r = readRegistry(); return r.projects.find((p) => p.id === r.currentId) || r.projects[0] }

function ensureProjectFiles(project) {
  const dir = resolve(project.dir)
  mkdirSync(join(dir, '.dsh'), { recursive: true })
  mkdirSync(join(dir, 'library'), { recursive: true })
  mkdirSync(join(dir, '.memory'), { recursive: true })
  const metaPath = join(dir, '.dsh', 'project.json')
  if (!readJson(metaPath, null)) {
    writeJson(metaPath, {
      id: project.id, title: project.title, goal: project.goal,
      instructions: project.instructions, createdAt: project.createdAt,
    })
  }
}

function validateProjectDir(dir) {
  const value = String(dir || '').trim()
  if (!value) return { code: 'PATH_REQUIRED', message: '请填写项目目录' }
  if (!isAbsolute(value)) return { code: 'PATH_NOT_ABSOLUTE', message: '必须填写绝对路径（以 / 开头），例如 /Users/you/workspace/project' }
  let st
  try { st = statSync(resolve(value)) } catch { return { code: 'PATH_NOT_FOUND', message: '目录不存在：' + value + '。请先创建该目录，或检查路径拼写。' } }
  if (!st.isDirectory()) return { code: 'NOT_A_DIRECTORY', message: '路径不是文件夹：' + value }
  try { accessSync(resolve(value), constants.W_OK) } catch { return { code: 'NOT_WRITABLE', message: '目录不可写：' + value } }
  return { ok: true, dir: resolve(value) }
}

function createProject(registry, args) {
  const id = 'proj-' + randomUUID().slice(0, 8)
  const project = {
    id, title: String(args.title || '').trim() || 'Untitled project',
    status: 'active',
    dir: resolve(String(args.dir || '')), goal: args.goal || '',
    instructions: args.instructions || '', createdAt: new Date().toISOString(),
  }
  ensureProjectFiles(project)
  registry.projects.push(project)
  registry.currentId = id
  saveRegistry(registry)
  return project
}

function projectState(project) {
  if (!project) return null
  const dir = resolve(project.dir)
  let threads = []
  try { threads = JSON.parse(readFileSync(join(dir, '.dsh', 'threads.json'), 'utf8')) } catch { threads = [] }
  // 自动收尾：idle/done 超过 7 天 -> resolved
  const cutoff = Date.now() - 7 * 24 * 3600 * 1000
  let changed = false
  for (const t of threads) {
    const ts = Date.parse(t.lastActivityAt || t.createdAt || 0)
    if ((t.status === 'idle' || t.status === 'done') && ts && ts < cutoff) { t.status = 'resolved'; t.resolvedAt = new Date().toISOString(); t.resolvedBy = 'auto'; changed = true }
  }
  if (changed) { try { writeJson(join(dir, '.dsh', 'threads.json'), threads) } catch { /* ignore */ } }
  let libraryCount = 0
  const library = { folders: [], files: [] }
  const walk = (d, rel = '') => {
    let entries = []
    try { entries = readdirSync(d, { withFileTypes: true }) } catch { return }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const childRel = rel ? rel + '/' + e.name : e.name
      if (e.isDirectory()) { library.folders.push(childRel); walk(join(d, e.name), childRel) }
      else if (e.isFile()) { library.files.push(childRel); libraryCount += 1 }
    }
  }
  walk(join(dir, 'library'))
  let proposals = []
  try { proposals = JSON.parse(readFileSync(join(dir, '.dsh', 'proposals.json'), 'utf8')) } catch { proposals = [] }
  let memoryCount = 0
  try { memoryCount = (readdirSync(join(dir, '.memory', 'scopes'), { withFileTypes: true }).length) } catch { /* missing */ }
  const counts = { waiting: 0, active: 0, review: 0, done: 0, failed: 0 }
  for (const t of threads) {
    if (t.status === 'waiting') counts.waiting += 1
    else if (t.status === 'working' || t.status === 'running') counts.active += 1
    else if (t.status === 'done') counts.review += 1
    else if (t.status === 'failed') counts.failed += 1
    else counts.done += 1
  }
  return { ...project, threads, counts, proposals, library, libraryCount, memoryCount }
}

export function apply(ctx, config = {}) {
  const tools = ctx.get('tools')
  if (!tools) return
  mkdirSync(baseDir, { recursive: true })
  if (!readRegistry().projects.length) {
    const dir = resolve(config.projectDir || process.cwd())
    const project = {
      id: 'demo', title: config.projectTitle || 'Hello Project', dir,
      goal: config.projectGoal || '体验 DSH Projects：多项目、Coordinator、线程、记忆与 Library。',
      instructions: '先给方案再动手；完成前运行 lint/test；完成后 project_report 汇报。',
      createdAt: new Date().toISOString(),
    }
    saveRegistry({ projects: [project], currentId: 'demo' })
  }

  tools.register({
    name: 'project_list',
    description: '列出所有项目与当前项目。',
    parameters: objectSchema({}),
    output: { schema: { type: 'object', properties: { currentId: { type: 'string' }, projects: { type: 'array' } } }, render: (_a, v) => text(JSON.stringify(v)) },
    execute: async () => {
      const r = readRegistry()
      return { currentId: r.currentId, projects: r.projects.map((p) => ({ id: p.id, title: p.title, dir: p.dir, goal: p.goal })) }
    },
  })

  tools.register({
    name: 'project_create',
    description: '新建项目：title/dir 必填；自动创建 .dsh/project.json、library/、.memory/，并设为当前项目。',
    parameters: objectSchema({ title: { type: 'string' }, dir: { type: 'string' }, goal: { type: 'string' }, instructions: { type: 'string' } }, ['title', 'dir']),
    output: { schema: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, dir: { type: 'string' } } }, render: (_a, v) => text('项目已创建：' + v.id + ' (' + v.title + ')') },
    execute: async (args) => {
      const project = createProject(readRegistry(), args)
      return { id: project.id, title: project.title, dir: project.dir }
    },
  })

  tools.register({
    name: 'project_switch',
    description: '切换当前项目（影响 project_* / library_* / memory 的工具作用域）。',
    parameters: objectSchema({ id: { type: 'string' } }, ['id']),
    output: { schema: { type: 'object', properties: { ok: { type: 'boolean' }, id: { type: 'string' } } }, render: (_a, v) => text(v.ok ? '已切换到项目 ' + v.id : '项目不存在') },
    execute: async (args) => {
      const r = readRegistry()
      const project = r.projects.find((p) => p.id === args.id)
      if (!project) return { ok: false, id: args.id }
      r.currentId = args.id
      saveRegistry(r)
      ensureProjectFiles(project)
      return { ok: true, id: args.id }
    },
  })

  tools.register({
    name: 'project_current',
    description: '读取当前项目（id/title/dir/goal/instructions）。',
    parameters: objectSchema({}),
    output: { schema: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, dir: { type: 'string' }, goal: { type: 'string' }, instructions: { type: 'string' } } }, render: (_a, v) => text(JSON.stringify(v)) },
    execute: async () => {
      const p = currentProject()
      return p ? { id: p.id, title: p.title, dir: p.dir, goal: p.goal, instructions: p.instructions } : {}
    },
  })

  ctx.inject(['webServer'], (webCtx) => {
    const webServer = webCtx.webServer
    if (!webServer || typeof webServer.register !== 'function') return
    const json = (res, status, value) => {
      res.statusCode = status
      res.setHeader('content-type', 'application/json; charset=utf-8')
      res.setHeader('cache-control', 'no-store')
      res.end(JSON.stringify(value))
    }
    webServer.register({ kind: 'exact', path: '/dsh-projects/state', handler: (req, res) => {
      try {
        const r = readRegistry()
        const current = r.projects.find((p) => p.id === r.currentId) || r.projects[0] || null
        json(res, 200, { currentId: r.currentId, projects: r.projects.map((p) => ({ id: p.id, title: p.title, goal: p.goal, dir: p.dir })), projectDirs: r.projects.map((p) => p.dir), current: projectState(current) })
      } catch (err) { json(res, 500, { error: String(err && err.message ? err.message : err) }) }
    } })
    webServer.register({ kind: 'exact', path: '/dsh-projects/events', handler: (req, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' })
      const send = () => {
        try {
          const r = readRegistry()
          const current = r.projects.find((p) => p.id === r.currentId) || r.projects[0] || null
          res.write('data: ' + JSON.stringify({ currentId: r.currentId, projects: r.projects.map((p) => ({ id: p.id, title: p.title, goal: p.goal, dir: p.dir })), current: projectState(current) }) + '\n\n')
        } catch { /* ignore transient */ }
      }
      send()
      const timer = setInterval(send, 2000)
      req.on('close', () => clearInterval(timer))
    } })
    webServer.register({ kind: 'exact', path: '/dsh-projects/create', handler: (req, res) => {
      let body = ''
      req.on('data', (chunk) => { body += chunk; if (body.length > 1e6) req.destroy() })
      req.on('end', () => {
        try {
          const args = JSON.parse(body || '{}')
          if (!args.title || !String(args.title).trim()) return json(res, 400, { code: 'TITLE_REQUIRED', error: '请填写项目名称' })
          const checked = validateProjectDir(args.dir)
          if (!checked.ok) return json(res, 400, { code: checked.code, error: checked.message })
          args.dir = checked.dir
          const project = createProject(readRegistry(), args)
          json(res, 200, { ok: true, project: { id: project.id, title: project.title, dir: project.dir } })
        } catch (err) { json(res, 500, { error: String(err && err.message ? err.message : err) }) }
      })
    } })
    webServer.register({ kind: 'exact', path: '/dsh-projects/library-upload', handler: (req, res) => {
      let body = ''
      req.on('data', (chunk) => { body += chunk; if (body.length > 30e6) req.destroy() })
      req.on('end', () => {
        try {
          const { name, folder, contentBase64 } = JSON.parse(body || '{}')
          const r = readRegistry()
          const project = r.projects.find((p) => p.id === r.currentId) || r.projects[0]
          if (!project || !name || typeof contentBase64 !== 'string') return json(res, 400, { error: 'name and contentBase64 required' })
          const safe = (v) => String(v || '').replace(/[\\/]+/g, '_').trim()
          const dir = folder ? join(resolve(project.dir), 'library', safe(folder)) : join(resolve(project.dir), 'library')
          mkdirSync(dir, { recursive: true })
          const bytes = Buffer.from(contentBase64, 'base64')
          writeFileSync(join(dir, safe(name)), bytes)
          json(res, 200, { ok: true, bytes: bytes.length })
        } catch (err) { json(res, 500, { error: String(err && err.message ? err.message : err) }) }
      })
    } })
    webServer.register({ kind: 'exact', path: '/dsh-projects/library-move', handler: (req, res) => {
      let body = ''
      req.on('data', (chunk) => { body += chunk; if (body.length > 1e6) req.destroy() })
      req.on('end', () => {
        try {
          const { name, fromFolder, toFolder } = JSON.parse(body || '{}')
          const r = readRegistry()
          const project = r.projects.find((p) => p.id === r.currentId) || r.projects[0]
          if (!project || !name) return json(res, 400, { error: 'name required' })
          const safe = (v) => String(v || '').replace(/[\\/]+/g, '_').trim()
          const libDir = join(resolve(project.dir), 'library')
          const src = fromFolder ? join(libDir, safe(fromFolder), safe(name)) : join(libDir, safe(name))
          const dst = toFolder ? join(libDir, safe(toFolder), safe(name)) : join(libDir, safe(name))
          if (src === dst) return json(res, 200, { ok: true })
          mkdirSync(dirname(dst), { recursive: true })
          renameSync(src, dst)
          json(res, 200, { ok: true })
        } catch (err) { json(res, 500, { error: String(err && err.message ? err.message : err) }) }
      })
    } })
    webServer.register({ kind: 'exact', path: '/dsh-projects/lifecycle', handler: (req, res) => {
      let body = ''
      req.on('data', (chunk) => { body += chunk; if (body.length > 1e6) req.destroy() })
      req.on('end', () => {
        try {
          const { id, action } = JSON.parse(body || '{}')
          const r = readRegistry()
          const project = r.projects.find((p) => p.id === id)
          if (!project) return json(res, 404, { error: 'unknown project' })
          if (action === 'pause') project.status = 'paused'
          else if (action === 'resume') project.status = 'active'
          else if (action === 'archive') project.status = 'archived'
          else if (action === 'unarchive') project.status = 'active'
          else if (action === 'delete') {
            const idx = r.projects.findIndex((p) => p.id === id)
            if (idx !== -1) r.projects.splice(idx, 1)
            if (r.currentId === id) r.currentId = r.projects[0] ? r.projects[0].id : null
            saveRegistry(r)
            return json(res, 200, { ok: true, deleted: true })
          } else return json(res, 400, { error: 'unknown action' })
          saveRegistry(r)
          json(res, 200, { ok: true, status: project.status })
        } catch (err) { json(res, 500, { error: String(err && err.message ? err.message : err) }) }
      })
    } })
    webServer.register({ kind: 'exact', path: '/dsh-projects/library-mkdir', handler: (req, res) => {
      let body = ''
      req.on('data', (chunk) => { body += chunk; if (body.length > 1e6) req.destroy() })
      req.on('end', () => {
        try {
          const { folder } = JSON.parse(body || '{}')
          const r = readRegistry()
          const project = r.projects.find((p) => p.id === r.currentId) || r.projects[0]
          if (!project || !folder) return json(res, 400, { error: 'folder required' })
          const safe = String(folder).replace(/[\\/]+/g, '_').trim()
          if (!safe) return json(res, 400, { error: 'invalid folder' })
          mkdirSync(join(resolve(project.dir), 'library', safe), { recursive: true })
          json(res, 200, { ok: true })
        } catch (err) { json(res, 500, { error: String(err && err.message ? err.message : err) }) }
      })
    } })
    webServer.register({ kind: 'exact', path: '/dsh-projects/thread-resolve', handler: (req, res) => {
      let body = ''
      req.on('data', (chunk) => { body += chunk; if (body.length > 1e6) req.destroy() })
      req.on('end', () => {
        try {
          const { id } = JSON.parse(body || '{}')
          const r = readRegistry()
          const project = r.projects.find((p) => p.id === r.currentId) || r.projects[0]
          if (!project) return json(res, 404, { error: 'no project' })
          const threadsPath = join(resolve(project.dir), '.dsh', 'threads.json')
          const threads = readJson(threadsPath, [])
          const t = threads.find((x) => x.id === id)
          if (!t) return json(res, 404, { error: 'unknown thread' })
          t.status = 'resolved'; t.resolvedAt = new Date().toISOString(); t.lastActivityAt = t.resolvedAt
          writeJson(threadsPath, threads)
          json(res, 200, { ok: true })
        } catch (err) { json(res, 500, { error: String(err && err.message ? err.message : err) }) }
      })
    } })
    webServer.register({ kind: 'exact', path: '/dsh-projects/switch', handler: (req, res) => {
      let body = ''
      req.on('data', (chunk) => { body += chunk; if (body.length > 1e6) req.destroy() })
      req.on('end', () => {
        try {
          const { id } = JSON.parse(body || '{}')
          const r = readRegistry()
          if (!r.projects.some((p) => p.id === id)) return json(res, 404, { error: 'unknown project' })
          r.currentId = id
          saveRegistry(r)
          const project = r.projects.find((p) => p.id === id)
          ensureProjectFiles(project)
          json(res, 200, { ok: true })
        } catch (err) { json(res, 500, { error: String(err && err.message ? err.message : err) }) }
      })
    } })
    console.error('[projects] HTTP routes registered: /dsh-projects/{state,create,switch}')
  })

  try {
    ctx.on('session/event', (session, event) => {
      if (!event || event.type !== 'turn/end') return
      const reason = event.data && event.data.reason ? event.data.reason.kind : 'completed'
      const r = readRegistry()
      for (const project of r.projects) {
        const threadsPath = join(resolve(project.dir), '.dsh', 'threads.json')
        const threads = readJson(threadsPath, [])
        const idx = threads.findIndex((t) => t.id === session.id)
        if (idx === -1) continue
        const t = threads[idx]
        if (t.status === 'resolved') return
        t.status = reason === 'completed' ? (t.lastReport ? 'done' : 'idle') : (reason === 'error' ? 'failed' : 'idle')
        t.lastActivityAt = new Date().toISOString()
        writeJson(threadsPath, threads)
        console.error('[projects] watcher: thread', t.id, '->', t.status)
        return
      }
    })
    console.error('[projects] watcher attached to session/event')
  } catch (err) { console.error('[projects] watcher failed', err && err.message ? err.message : err) }

  console.error('[projects] multi-project registry ready at', registryPath)
}
