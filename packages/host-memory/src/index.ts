import type { Context } from '@deepseek-ai/cordis'

import { MemoryStore, type MemoryType } from './memory-store.js'

export { MemoryStore } from './memory-store.js'
export type {
  MemoryRecord,
  MemoryScope,
  MemoryStoreOptions,
  MemoryType,
  MemoryWriteInput,
  MemoryWriteResult,
} from './memory-store.js'

export const name = 'dsh-project-memory'

/**
 * M0 status: the store core is implemented and unit-tested; Cordis wiring
 * (systemPrompt section, memory_* tools, project→scope resolution) lands in M1.
 * Keep this plugin shell dependency-free so it can be installed before the
 * Project domain exists.
 */
export interface Config {
  rootDir?: string
  maxIndexBytes?: number
  maxIndexLines?: number
  enableUserScope?: boolean
  defaultProjectDir?: string
  defaultMemoryType?: MemoryType
}

export const inject: string[] = []

export function apply(_ctx: Context, _config: Config = {}): void {
  // M1 wiring to add:
  // 1. ctx.systemPrompt.section({ order: 4000, text: () => store.renderIndex(scope) })
  // 2. ctx.tools.register memory_write / memory_read / memory_list / memory_delete / memory_search
  // 3. resolve the active project from session header metadata (M1 Project domain)
  // 4. atomic-write integration via @deepseek-ai/dsh-atomic-write inside MemoryStore
}
