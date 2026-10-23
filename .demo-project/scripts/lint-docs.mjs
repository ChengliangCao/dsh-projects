#!/usr/bin/env node
// 零依赖 Markdown 结构检查：不安装任何 npm 包，只用 Node 标准库。
// 覆盖与文档质量强相关的 markdownlint 子集（MD001/004/009/012/022/025/031/032/040/047/056）。
// 用法：node scripts/lint-docs.mjs [文件或目录...]，默认检查 README.md 与 docs/。

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DEFAULT_TARGETS = ['README.md', 'docs']

function collect(target) {
  const st = statSync(target)
  if (!st.isDirectory()) {
    return target.endsWith('.md') ? [target] : []
  }
  const out = []
  for (const name of readdirSync(target).sort()) {
    if (name.startsWith('.')) continue
    out.push(...collect(join(target, name)))
  }
  return out
}

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*(\S*)/
const HEADING = /^(#{1,6})\s+(.+)$/
const LIST_ITEM = /^(\s*)([-*+])\s+/
const TABLE_ROW = /^\s*\|.*\|\s*$/
const TABLE_SEP = /^\s*\|(\s*:?-{2,}:?\s*\|)+\s*$/

const isBlank = (s) => s.trim() === ''

function cells(row) {
  const parts = row.trim().split('|')
  if (parts[0] === '') parts.shift()
  if (parts[parts.length - 1] === '') parts.pop()
  return parts.map((p) => p.trim())
}

function checkFile(path) {
  const raw = readFileSync(path, 'utf8')
  const issues = []
  const add = (line, rule, message) => issues.push({ path, line, rule, message })

  if (!raw.endsWith('\n')) {
    add(raw.split('\n').length, 'MD047', '文件应以单个换行结尾')
  } else if (raw.endsWith('\n\n')) {
    add(raw.split('\n').length - 1, 'MD047', '文件结尾不应有多余空行')
  }

  const lines = raw.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()

  let inFence = false
  let fenceStart = 0
  let h1 = 0
  let prevHeading = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNo = i + 1
    const fence = FENCE.exec(line)

    if (fence) {
      if (!inFence) {
        inFence = true
        fenceStart = lineNo
        if (!fence[2]) add(lineNo, 'MD040', '代码块应标注语言')
        if (i > 0 && !isBlank(lines[i - 1]) && !lines[i - 1].startsWith('>')) {
          add(lineNo, 'MD031', '代码块前应有空行')
        }
      } else {
        inFence = false
        const next = lines[i + 1]
        if (next !== undefined && !isBlank(next)) add(lineNo, 'MD031', '代码块后应有空行')
      }
      continue
    }
    if (inFence) continue

    if (/[ \t]+$/.test(line)) add(lineNo, 'MD009', '行尾不应有空白')
    if (isBlank(line) && i > 0 && isBlank(lines[i - 1])) add(lineNo, 'MD012', '不应连续多个空行')

    const heading = HEADING.exec(line)
    if (heading) {
      const level = heading[1].length
      if (level === 1) h1++
      if (prevHeading > 0 && level > prevHeading + 1) {
        add(lineNo, 'MD001', `标题层级跳级：H${prevHeading} → H${level}`)
      }
      prevHeading = level
      if (i > 0 && !isBlank(lines[i - 1])) add(lineNo, 'MD022', '标题前应有空行')
      if (i + 1 < lines.length && !isBlank(lines[i + 1])) add(lineNo, 'MD022', '标题后应有空行')
      continue
    }

    const item = LIST_ITEM.exec(line)
    if (item) {
      if (item[2] !== '-') add(lineNo, 'MD004', `无序列表标记应为 "-"，实际为 "${item[2]}"`)
      const prev = lines[i - 1]
      if (prev !== undefined && !isBlank(prev) && !LIST_ITEM.test(prev) && !prev.startsWith('>')) {
        add(lineNo, 'MD032', '列表前应有空行')
      }
    } else if (
      i > 0 &&
      LIST_ITEM.test(lines[i - 1]) &&
      !isBlank(line) &&
      !/^\s{2,}/.test(line)
    ) {
      add(lineNo, 'MD032', '列表后应有空行')
    }

    if (TABLE_ROW.test(line) && TABLE_SEP.test(lines[i + 1] ?? '')) {
      const expected = cells(line).length
      const sepCount = cells(lines[i + 1]).length
      if (sepCount !== expected) {
        add(lineNo + 1, 'MD056', `表格分隔行列数 ${sepCount} 与表头 ${expected} 不一致`)
      }
      let j = i + 2
      while (j < lines.length && TABLE_ROW.test(lines[j])) {
        const count = cells(lines[j]).length
        if (count !== expected) {
          add(j + 1, 'MD056', `表格行列数 ${count} 与表头 ${expected} 不一致`)
        }
        j++
      }
    }
  }

  if (inFence) add(fenceStart, 'MD040', '代码块未闭合')
  if (h1 > 1) add(1, 'MD025', `文档应只有一个一级标题，实际 ${h1} 个`)

  return issues
}

const args = process.argv.slice(2)
const targets = args.length > 0 ? args : DEFAULT_TARGETS

const files = []
for (const target of targets) {
  try {
    files.push(...collect(target))
  } catch {
    console.error(`lint-docs: 无法读取 ${target}`)
    process.exit(2)
  }
}

if (files.length === 0) {
  console.error('lint-docs: 没有找到待检查的 Markdown 文件')
  process.exit(2)
}

let total = 0
for (const file of files) {
  const issues = checkFile(file)
  total += issues.length
  for (const issue of issues) {
    console.log(`${issue.path}:${issue.line} ${issue.rule} ${issue.message}`)
  }
}

console.log(`\nLinting: ${files.length} file(s)`)
console.log(`Summary: ${total} issue(s)`)
process.exit(total === 0 ? 0 : 1)
