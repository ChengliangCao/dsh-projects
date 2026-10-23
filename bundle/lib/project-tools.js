/**
 * DSH Projects preview — coordinator/thread tools.
 *
 * Threads are top-level Sessions created through ctx.sessionController and
 * recorded in <projectDir>/.dsh/threads.json. A thread reports back to its
 * coordinator session; the coordinator can list/steer/stop/resolve threads.
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'

export const name = '@dsh-projects/app-bundle/project-tools'
export const inject = ['tools', 'sessionController', 'systemPrompt']

const text = (t) => [{ type: 'text', text: String(t) }]
const objectSchema = (properties, required = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
})

function gitOk(dir) {
  const r = spawnSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' })
  return r.status === 0 ? r.stdout.trim() : null
}
function createThreadWorktree(projectDir, threadId, title) {
  const repo = gitOk(projectDir)
  if (!repo) return null
  const short = String(threadId).replace(/^thread-/, '').slice(0, 8)
  const slug = String(title || 'task').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'task'
  const branch = 'thread/' + short + '-' + slug
  const worktreePath = join(projectDir, '.dsh', 'worktrees', short)
  mkdirSync(dirname(worktreePath), { recursive: true })
  const r = spawnSync('git', ['-C', repo, 'worktree', 'add', '-b', branch, worktreePath, 'HEAD'], { encoding: 'utf8' })
  if (r.status !== 0) {
    console.error('[projects] worktree failed:', (r.stderr || '').trim())
    return null
  }
  return { repo, worktreePath, branch }
}

export function apply(ctx, config = {}) {
  const projectDir = resolve(config.projectDir || process.cwd())
  const registryPath = join(projectDir, '.dsh', 'threads.json')
  const tools = ctx.get('tools')
  const sc = ctx.get('sessionController')
  if (!tools || typeof tools.register !== 'function') return
  if (!sc || typeof sc.create !== 'function') {
    console.error('[projects] sessionController unavailable; project tools skipped')
    return
  }

  const projectFile = join(projectDir, '.dsh', 'project.json')
  const DEFAULT_PROJECT = {
    title: 'Demo Project · Payments API',
    goal: '把 p95 延迟压到 200ms 以下；补全 Payments API 文档。',
    instructions: '先给方案再动手；未经同意不要 merge/force-push；完成前运行 lint/test；完成后用 project_report 汇报。',
  }
  function readProject() {
    try {
      const parsed = JSON.parse(readFileSync(projectFile, 'utf8'))
      return { ...DEFAULT_PROJECT, ...parsed }
    } catch {
      return { ...DEFAULT_PROJECT }
    }
  }
  const systemPrompt = ctx.get('systemPrompt')
  if (systemPrompt && typeof systemPrompt.section === 'function') {
    systemPrompt.section({
      name: 'projects:instructions',
      order: 4100,
      text: () => readProject().instructions || '',
    })
    systemPrompt.section({
      name: 'projects:coordinator-policy',
      order: 4200,
      text: () =>
        '## 项目协作规则\n' +
        '- 用户的任务若需要多步执行，用 project_spawn_thread 开一个线程，把目标/边界/完成标准写进 brief；简单问题直接回答。\n' +
        '- 线程完成后用 project_list_threads 查看状态与 lastReport；需要收尾时调用 project_resolve_thread。\n' +
        '- 用户说“记住/别忘了”时调用 memory_write（type 用 user/feedback/project/reference）；需要回忆时 memory_search。\n' +
        '- 资料文件用 library_* 工具管理（create_folder/add_file/list/move/read），入库是快照拷贝。\n' +
        '- 协调者不要直接改代码/跑构建，执行交给线程；线程的权限审批由用户在线程内完成。\n',
    })
  }

  // ---- Library (project files & folders) ----
  const libraryDir = join(projectDir, 'library')
  mkdirSync(libraryDir, { recursive: true })
  const safeName = (n) => String(n || '').replace(/[\\/]+/g, '_').trim()
  function listLibrary(folder) {
    const base = folder ? join(libraryDir, safeName(folder)) : libraryDir
    const folders = []
    const files = []
    let entries = []
    try { entries = readdirSync(base, { withFileTypes: true }) } catch { return { folder: folder || '', folders, files } }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.isDirectory()) folders.push(e.name)
      else if (e.isFile()) {
        try {
          const st = statSync(join(base, e.name))
          files.push({ name: e.name, bytes: st.size })
        } catch { /* skip */ }
      }
    }
    return { folder: folder || '', folders, files }
  }
  function moveLibraryFile(fromFolder, name, toFolder) {
    const from = fromFolder ? join(libraryDir, safeName(fromFolder), safeName(name)) : join(libraryDir, safeName(name))
    const to = toFolder ? join(libraryDir, safeName(toFolder), safeName(name)) : join(libraryDir, safeName(name))
    if (from === to) return false
    mkdirSync(dirname(to), { recursive: true })
    renameSync(from, to)
    return true
  }

  function load() {
    try {
      const raw = readFileSync(registryPath, 'utf8')
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  function save(records) {
    mkdirSync(dirname(registryPath), { recursive: true })
    writeFileSync(registryPath, JSON.stringify(records, null, 2))
  }
  function update(id, patch) {
    const records = load()
    const idx = records.findIndex((r) => r.id === id)
    if (idx === -1) return undefined
    records[idx] = { ...records[idx], ...patch, lastActivityAt: new Date().toISOString() }
    save(records)
    return records[idx]
  }

  tools.register({
    name: 'project_spawn_thread',
    description:
      '在项目里开一个独立线程（新的顶层会话）执行一项任务。立即返回线程 ID；线程会异步执行，完成后向协调者汇报。一次只派一个明确任务。',
    parameters: objectSchema(
      {
        title: { type: 'string', description: '线程标题（简短）' },
        brief: { type: 'string', description: '任务简报：目标、边界、完成标准、交付物' },
        cwd: { type: 'string', description: '可选工作目录；默认项目目录' },
        preset: { type: 'string', description: '可选 agent preset id（默认 standard）' },
      },
      ['title', 'brief'],
    ),
    output: {
      schema: objectSchema({
        id: { type: 'string' },
        title: { type: 'string' },
        status: { type: 'string' },
        cwd: { type: 'string' },
      }),
      render: (_a, v) => text(`线程已创建：${v.id}（${v.title}，${v.status}）`),
    },
    execute: async (args, exec) => {
      const sessionId = `thread-${randomUUID()}`
      const wt = config.worktree === false ? null : createThreadWorktree(args.cwd || projectDir, sessionId, args.title)
      const cwd = wt ? wt.worktreePath : (args.cwd || projectDir)
      const created = await sc.create({
        cwd,
        sessionId,
        ...(args.preset ? { agentPreset: args.preset } : {}),
      })
      const coordinatorSessionId = exec && exec.agent ? exec.agent.id : undefined
      const brief = [
        `# 项目线程：${args.title}`,
        '',
        '你是项目里的一个独立线程，拥有自己的上下文。工作目录：' + cwd + '。',
        wt ? '你在独立 git worktree 中工作：' + wt.worktreePath + '（分支 ' + wt.branch + '）。不要切分支、不要 merge；改动留在该 worktree 等协调者 review。' : '（共享项目目录模式：只改你负责的文件。）',
        '项目记忆索引已注入系统提示；需要更多细节可用 memory_search / memory_read。',
        '',
        '## 任务',
        args.brief,
        '',
        '## 汇报要求',
        '完成后调用 project_report 工具向协调者汇报：summary（做了什么）、deliverables（文件路径）、blocked（如有）。',
        '需要用户批准时，直接在当前线程里请求；不要在协调者里代批。',
      ].join('\n')
      await sc.prompt(
        {
          requestId: randomUUID(),
          sessionId: created.sessionId,
          mode: 'queue',
          content: [{ type: 'text', text: brief }],
        },
        exec && exec.signal ? exec.signal : new AbortController().signal,
      )
      const record = {
        id: created.sessionId,
        title: args.title,
        status: 'working',
        cwd,
        coordinatorSessionId,
        ...(wt ? { worktree: wt.worktreePath, branch: wt.branch } : {}),
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
      }
      save([...load(), record])
      return { id: record.id, title: record.title, status: record.status, cwd: record.cwd }
    },
  })

  tools.register({
    name: 'project_list_threads',
    description: '列出当前项目的线程及其状态（working/done/idle/resolved）。汇报协调者/用户时使用。',
    parameters: objectSchema({ status: { type: 'string', description: '可选过滤：working/done/idle/resolved' } }),
    output: {
      schema: { type: 'array', items: objectSchema({
        id: { type: 'string' },
        title: { type: 'string' },
        status: { type: 'string' },
        lastActivityAt: { type: 'string' },
        lastReport: { type: 'string' },
      }) },
      render: (_a, v) => text(JSON.stringify(v)),
    },
    execute: async (args) => {
      const records = load()
      const filtered = args.status ? records.filter((r) => r.status === args.status) : records
      return filtered.map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        lastActivityAt: r.lastActivityAt,
        lastReport: r.lastReport || '',
      }))
    },
  })

  tools.register({
    name: 'project_send_thread',
    description: '给已有线程发消息（steer 或继续任务）。返回是否被接受。',
    parameters: objectSchema(
      { id: { type: 'string', description: '线程/session id' }, message: { type: 'string' } },
      ['id', 'message'],
    ),
    output: {
      schema: objectSchema({ accepted: { type: 'boolean' }, id: { type: 'string' } }),
      render: (_a, v) => text(`消息已提交给线程 ${v.id}（accepted=${v.accepted}）`),
    },
    execute: async (args, exec) => {
      await sc.prompt(
        {
          requestId: randomUUID(),
          sessionId: args.id,
          mode: 'queue',
          content: [{ type: 'text', text: args.message }],
        },
        exec && exec.signal ? exec.signal : new AbortController().signal,
      )
      update(args.id, { status: 'working' })
      return { accepted: true, id: args.id }
    },
  })

  tools.register({
    name: 'project_stop_thread',
    description: '停止线程当前的 turn（保留会话与后续消息能力）。',
    parameters: objectSchema({ id: { type: 'string' } }, ['id']),
    output: {
      schema: objectSchema({ accepted: { type: 'boolean' }, id: { type: 'string' } }),
      render: (_a, v) => text(`已请求停止线程 ${v.id}`),
    },
    execute: async (args) => {
      const result = await sc.cancel({ sessionId: args.id })
      update(args.id, { status: 'idle' })
      return { accepted: Boolean(result && result.accepted), id: args.id }
    },
  })

  tools.register({
    name: 'project_resolve_thread',
    description: '收尾线程（Resolved，不删除；可重新打开）。',
    parameters: objectSchema({ id: { type: 'string' }, reason: { type: 'string' } }, ['id']),
    output: {
      schema: objectSchema({ id: { type: 'string' }, status: { type: 'string' } }),
      render: (_a, v) => text(`线程 ${v.id} 已收尾（${v.status}）`),
    },
    execute: async (args) => {
      const rec = update(args.id, { status: 'resolved', resolvedAt: new Date().toISOString(), resolvedReason: args.reason || '' })
      return { id: args.id, status: rec ? rec.status : 'resolved' }
    },
  })

  tools.register({
    name: 'project_report',
    description: '线程向协调者汇报：summary、交付物、阻塞项。线程完成任务后调用。',
    parameters: objectSchema(
      {
        summary: { type: 'string', description: '做了什么/结果' },
        deliverables: { type: 'string', description: '交付物路径（逗号分隔）' },
        blocked: { type: 'string', description: '需要用户/协调者介入的事项；没有则留空' },
      },
      ['summary'],
    ),
    output: {
      schema: objectSchema({ ok: { type: 'boolean' } }),
      render: () => text('汇报已记录并发送给协调者'),
    },
    execute: async (args, exec) => {
      const threadId = exec && exec.agent ? exec.agent.id : undefined
      let record
      let duplicate = false
      if (threadId) {
        const before = load().find((r) => r.id === threadId)
        duplicate = Boolean(before && before.lastReport === args.summary)
        record = update(threadId, {
          status: 'done',
          lastReport: args.summary,
          deliverables: args.deliverables || '',
          blocked: args.blocked || '',
        })
      }
      if (record && record.coordinatorSessionId && !duplicate) {
        const message = [
          `【线程汇报】${record.title}`,
          `summary: ${args.summary}`,
          args.deliverables ? `deliverables: ${args.deliverables}` : '',
          args.blocked ? `blocked: ${args.blocked}` : '',
        ].filter(Boolean).join('\n')
        try {
          await sc.prompt(
            {
              requestId: randomUUID(),
              sessionId: record.coordinatorSessionId,
              mode: 'queue',
              content: [{ type: 'text', text: message }],
            },
            exec.signal,
          )
        } catch (err) {
          console.error('[projects] report to coordinator failed:', err && err.message ? err.message : err)
        }
      }
      return { ok: true }
    },
  })

  tools.register({
    name: 'project_info',
    description: '读取当前项目的标题/目标/项目指令。',
    parameters: objectSchema({}),
    output: { schema: objectSchema({ title: { type: 'string' }, goal: { type: 'string' }, instructions: { type: 'string' } }), render: (_a, v) => text(JSON.stringify(v)) },
    execute: async () => readProject(),
  })

  tools.register({
    name: 'project_set_instructions',
    description: '更新项目指令（会注入到项目内所有会话/线程的系统提示）。',
    parameters: objectSchema({ instructions: { type: 'string' } }, ['instructions']),
    output: { schema: objectSchema({ ok: { type: 'boolean' } }), render: () => text('项目指令已更新') },
    execute: async (args) => {
      mkdirSync(dirname(projectFile), { recursive: true })
      writeFileSync(projectFile, JSON.stringify({ ...readProject(), instructions: args.instructions }, null, 2))
      return { ok: true }
    },
  })

  tools.register({
    name: 'library_list',
    description: '列出项目资料库（Library）某个文件夹下的子文件夹与文件；folder 省略时列根目录。',
    parameters: objectSchema({ folder: { type: 'string' } }),
    output: { schema: objectSchema({ folder: { type: 'string' }, folders: { type: 'array', items: { type: 'string' } }, files: { type: 'array', items: objectSchema({ name: { type: 'string' }, bytes: { type: 'number' } }) } }), render: (_a, v) => text(JSON.stringify(v)) },
    execute: async (args) => listLibrary(args.folder || ''),
  })

  tools.register({
    name: 'library_create_folder',
    description: '在项目资料库中新建文件夹（根目录或指定父文件夹）。',
    parameters: objectSchema({ name: { type: 'string' }, parent: { type: 'string' } }, ['name']),
    output: { schema: objectSchema({ ok: { type: 'boolean' }, path: { type: 'string' } }), render: (_a, v) => text('已创建文件夹 ' + v.path) },
    execute: async (args) => {
      const base = args.parent ? join(libraryDir, safeName(args.parent)) : libraryDir
      const target = join(base, safeName(args.name))
      mkdirSync(target, { recursive: true })
      return { ok: true, path: target }
    },
  })

  tools.register({
    name: 'library_add_file',
    description: '把项目目录里的文件复制进 Library（快照拷贝）。from 为项目内相对路径。',
    parameters: objectSchema({ from: { type: 'string' }, folder: { type: 'string' }, name: { type: 'string' } }, ['from']),
    output: { schema: objectSchema({ ok: { type: 'boolean' }, name: { type: 'string' }, bytes: { type: 'number' } }), render: (_a, v) => text('已入库 ' + v.name) },
    execute: async (args) => {
      const src = join(projectDir, args.from)
      const base = args.folder ? join(libraryDir, safeName(args.folder)) : libraryDir
      mkdirSync(base, { recursive: true })
      const target = join(base, safeName(args.name || args.from.split('/').pop() || 'file'))
      copyFileSync(src, target)
      return { ok: true, name: target.slice(base.length + 1), bytes: statSync(target).size }
    },
  })

  tools.register({
    name: 'library_move',
    description: '在 Library 内移动文件到另一个文件夹（toFolder 省略=根目录）。',
    parameters: objectSchema({ name: { type: 'string' }, fromFolder: { type: 'string' }, toFolder: { type: 'string' } }, ['name']),
    output: { schema: objectSchema({ ok: { type: 'boolean' } }), render: (_a, v) => text(v.ok ? '已移动' : '未移动') },
    execute: async (args) => ({ ok: moveLibraryFile(args.fromFolder || '', args.name, args.toFolder || '') }),
  })

  tools.register({
    name: 'library_read',
    description: '读取 Library 内的文本文件（最多 20KB）。',
    parameters: objectSchema({ name: { type: 'string' }, folder: { type: 'string' } }, ['name']),
    output: { schema: objectSchema({ name: { type: 'string' }, content: { type: 'string' } }), render: (_a, v) => text(v.content) },
    execute: async (args) => {
      const base = args.folder ? join(libraryDir, safeName(args.folder)) : libraryDir
      const content = readFileSync(join(base, safeName(args.name)), 'utf8')
      return { name: args.name, content: content.slice(0, 20000) }
    },
  })

  tools.register({
    name: 'project_thread_diff',
    description: '查看线程 worktree 的改动（git status --short + diff --stat）。',
    parameters: objectSchema({ id: { type: 'string' } }, ['id']),
    output: { schema: objectSchema({ id: { type: 'string' }, branch: { type: 'string' }, status: { type: 'string' }, diffStat: { type: 'string' } }), render: (_a, v) => text(JSON.stringify(v)) },
    execute: async (args) => {
      const rec = load().find((r) => r.id === args.id)
      if (!rec || !rec.worktree) return { id: args.id, branch: rec && rec.branch ? rec.branch : '', status: '（该线程没有 worktree）', diffStat: '' }
      const st = spawnSync('git', ['-C', rec.worktree, 'status', '--short'], { encoding: 'utf8' })
      const df = spawnSync('git', ['-C', rec.worktree, 'diff', '--stat'], { encoding: 'utf8' })
      return { id: args.id, branch: rec.branch, status: (st.stdout || '').trim(), diffStat: (df.stdout || '').trim() }
    },
  })

  tools.register({
    name: 'project_propose_threads',
    description: '提出 1–3 个建议线程（不立即执行），用户可在 Threads 面板看到并决定是否启动。',
    parameters: objectSchema({ proposals: { type: 'array', items: objectSchema({ title: { type: 'string' }, brief: { type: 'string' } }) } }, ['proposals']),
    output: { schema: objectSchema({ ok: { type: 'boolean' }, count: { type: 'number' } }), render: (_a, v) => text('已记录 ' + v.count + ' 个建议线程') },
    execute: async (args) => {
      const list = (args.proposals || []).slice(0, 3).map((p, i) => ({ id: 'sg-' + Date.now() + '-' + i, title: p.title || ('建议线程 ' + (i + 1)), brief: p.brief || '', createdAt: new Date().toISOString() }))
      const file = join(projectDir, '.dsh', 'proposals.json')
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, JSON.stringify(list, null, 2))
      return { ok: true, count: list.length }
    },
  })

  const projectsHome = process.env.DSH_HOME || join(homedir(), '.dsh')
  const registryFile = join(projectsHome, 'projects-ui', 'registry.json')
  function readRegistryFile() { try { return JSON.parse(readFileSync(registryFile, 'utf8')) } catch { return { projects: [], currentId: null } } }
  function saveRegistryFile(r) { mkdirSync(dirname(registryFile), { recursive: true }); writeFileSync(registryFile, JSON.stringify(r, null, 2)) }
  ctx.inject(['webServer'], (webCtx) => {
    const server = webCtx.webServer
    if (!server || typeof server.register !== 'function') return
    server.register({ kind: 'exact', path: '/dsh-projects/coordinator', handler: (req, res) => {
      let body = ''
      req.on('data', (chunk) => { body += chunk; if (body.length > 1e6) req.destroy() })
      req.on('end', async () => {
        const send = (status, value) => { res.statusCode = status; res.setHeader('content-type', 'application/json; charset=utf-8'); res.end(JSON.stringify(value)) }
        try {
          const { projectId } = JSON.parse(body || '{}')
          const registry = readRegistryFile()
          const project = registry.projects.find((p) => p.id === projectId) || registry.projects.find((p) => p.id === registry.currentId) || registry.projects[0]
          if (!project) return send(404, { error: '项目不存在' })
          if (project.coordinatorSessionId) return send(200, { ok: true, sessionId: project.coordinatorSessionId, existing: true })
          const sessionId = 'coordinator-' + randomUUID().slice(0, 8)
          await sc.create({ cwd: project.dir, sessionId })
          await sc.prompt({
            requestId: randomUUID(),
            sessionId,
            mode: 'queue',
            content: [{ type: 'text', text: '你是项目「' + project.title + '」的协调者。目标：' + (project.goal || '（未设置）') + '\n规则：多步任务用 project_spawn_thread 派线程；用 project_list_threads 查看进度；用户说记住时用 memory_write。' }],
          }, new AbortController().signal)
          project.coordinatorSessionId = sessionId
          saveRegistryFile(registry)
          send(200, { ok: true, sessionId, created: true })
        } catch (err) { send(500, { error: String(err && err.message ? err.message : err) }) }
      })
    } })
    console.error('[projects] coordinator route registered')
  })

  console.error('[projects] tools registered under project:', projectDir)
}
