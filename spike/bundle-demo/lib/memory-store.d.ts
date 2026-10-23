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
export type MemoryType = 'user' | 'feedback' | 'project' | 'reference';
export declare const MEMORY_TYPES: readonly MemoryType[];
export interface MemoryRecord {
    name: string;
    description: string;
    type: MemoryType;
    content: string;
    /** ISO 8601; maintained by the store. */
    modified: string;
    /** Optional ISO 8601 validity window (for future invalidation; M2+). */
    validAt?: string;
    /** Optional replacement link (for future "invalidate instead of delete"; M2+). */
    supersededBy?: string;
}
export interface MemoryStoreOptions {
    /** Root directory for all memory scopes, e.g. `~/.dsh/projects/memory`. */
    rootDir: string;
    /** Index budget for prompt injection. Default: 4096 bytes / 200 lines. */
    maxIndexBytes?: number;
    maxIndexLines?: number;
    /** Enable a global user scope shared by all projects. Default: true. */
    enableUserScope?: boolean;
}
export interface MemoryIndexOptions {
    maxBytes: number;
    maxLines: number;
}
export interface MemoryScope {
    /** Stable hash of the uniqueness canon (git repo root, or project dir). */
    scopeKey: string;
    /** Directory holding MEMORY.md and notes/. */
    dir: string;
    /** Git repository root when the project lives inside one. */
    repoRoot: string | null;
    source: 'git' | 'directory';
}
export interface MemoryWriteInput {
    name: string;
    description: string;
    type: MemoryType;
    content: string;
    validAt?: string;
    supersededBy?: string;
}
export interface MemoryWriteResult {
    record: MemoryRecord;
    file: string;
    indexOverLimit: boolean;
    indexLines: number;
    indexBytes: number;
}
/** Build the storage slug for a memory name; throws for reserved/empty names. */
export declare function slugifyMemoryName(name: string): string;
/** Find the git repository root from a project directory, or null. */
export declare function findGitRepoRoot(projectDir: string): Promise<string | null>;
/** Minimal YAML frontmatter parser for our own files (no external deps). */
export declare function parseMemoryFile(raw: string): {
    fields: Record<string, string>;
    content: string;
};
/** One index line. Escapes markdown brackets so a name cannot break the list. */
export declare function renderIndexLine(record: MemoryRecord): string;
export declare class MemoryStore {
    readonly rootDir: string;
    readonly maxIndexBytes: number;
    readonly maxIndexLines: number;
    readonly enableUserScope: boolean;
    constructor(options: MemoryStoreOptions);
    /** Resolve the shared memory scope for a project directory. */
    resolveScope(projectDir: string): Promise<MemoryScope>;
    /** The global user scope, when enabled. */
    userScope(): MemoryScope;
    list(scopeDir: string): Promise<MemoryRecord[]>;
    read(scopeDir: string, name: string): Promise<MemoryRecord | undefined>;
    write(scopeDir: string, input: MemoryWriteInput): Promise<MemoryWriteResult>;
    remove(scopeDir: string, name: string): Promise<boolean>;
    /** Build MEMORY.md from the notes directory and report budget usage. */
    rebuildIndex(scopeDir: string): Promise<{
        overLimit: boolean;
        lines: number;
        bytes: number;
    }>;
    /**
     * Render the prompt injection text under the budget. Empty when there is no
     * memory (so the section contributes 0 bytes).
     */
    renderIndex(scopeDir: string): Promise<string>;
    /** Local keyword search (no embeddings in MVP). Empty query returns all. */
    search(scopeDir: string, query: string): Promise<MemoryRecord[]>;
    private withLock;
    private atomicWrite;
}
