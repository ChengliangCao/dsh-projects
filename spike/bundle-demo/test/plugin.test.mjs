import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, it } from 'node:test'

import { apply } from '../lib/index.js'

const tempDirs = []
async function temp() {
  const dir = await mkdtemp(join(tmpdir(), 'spike-plugin-'))
  tempDirs.push(dir)
  return dir
}
afterEach(async () => {
  for (const dir of tempDirs.splice(0)) await rm(dir, { recursive: true, force: true })
})

function makeCtx() {
  const sections = []
  const tools = []
  const calls = []
  const ctx = {
    get(name) {
      if (name === 'systemPrompt') return { section: (def) => { sections.push(def); return () => {} } }
      if (name === 'tools') return { register: (def) => { tools.push(def); return () => {} } }
      if (name === 'sessionController') {
        return {
          create: async (req) => { calls.push(['create', req]); return { sessionId: req.sessionId } },
          prompt: async (req) => { calls.push(['prompt', req]); return { accepted: true } },
        }
      }
      return undefined
    },
  }
  return { ctx, sections, tools, calls }
}

describe('spike-demo plugin', () => {
  it('registers memory section + three tools, and section is empty before a write', async () => {
    const dir = await temp()
    const { ctx, sections, tools } = makeCtx()
    apply(ctx, { rootDir: join(dir, 'memory'), projectDir: join(dir, 'project') })
    assert.equal(sections.length, 1)
    assert.equal(sections[0].name, 'spike:project-memory')
    assert.equal(sections[0].text(), '')
    assert.deepEqual(tools.map((t) => t.name).sort(), ['spike_memory_search', 'spike_memory_write', 'spike_spawn_thread'])
  })

  it('writes a memory and exposes it through the prompt section provider', async () => {
    const dir = await temp()
    const { ctx, sections, tools } = makeCtx()
    apply(ctx, { rootDir: join(dir, 'memory'), projectDir: join(dir, 'project') })
    const write = tools.find((t) => t.name === 'spike_memory_write')
    const result = await write.execute({ name: 'Codename', description: 'project codename', type: 'project', content: 'falcon' })
    assert.equal(result.name, 'Codename')
    const injected = sections[0].text()
    assert.match(injected, /\[\?Codename\]|Codename/)
  })

  it('spawn_thread creates a session and prompts it with the task brief', async () => {
    const dir = await temp()
    const { ctx, tools, calls } = makeCtx()
    apply(ctx, { rootDir: join(dir, 'memory'), projectDir: join(dir, 'project') })
    const spawn = tools.find((t) => t.name === 'spike_spawn_thread')
    const result = await spawn.execute({ prompt: 'do the thing', preset: 'standard' })
    assert.match(result.sessionId, /^spike-thread-/)
    const create = calls.find(([kind]) => kind === 'create')
    const prompt = calls.find(([kind]) => kind === 'prompt')
    assert.ok(create && prompt)
    assert.equal(create[1].agentPreset, 'standard')
    assert.equal(prompt[1].sessionId, result.sessionId)
    assert.deepEqual(prompt[1].content, [{ type: 'text', text: 'do the thing' }])
    assert.equal(result.accepted, true)
  })
})
