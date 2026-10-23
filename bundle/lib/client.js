window.__ModuleLoader__.load({
  id: '@dsh-projects/app-bundle',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useState } = React
    const M = { color: 'var(--dsw-alias-label-secondary)' }
    const B = '1px solid var(--dsw-alias-border-l1)'
    const card = { background: 'var(--dsw-alias-bg-layer-1, #fff)', border: B, borderRadius: 12, padding: '14px 16px' }
    const btn = (primary) => ({ padding: '6px 11px', borderRadius: 8, border: primary ? 0 : B, background: primary ? 'var(--dsw-alias-brand-primary, #4d6bfe)' : 'transparent', color: primary ? '#fff' : M.color, cursor: 'pointer', fontSize: 12.5 })
    const chip = (text, color) => h('span', { style: { fontSize: 11, padding: '2px 8px', borderRadius: 20, background: color || 'var(--dsw-alias-bg-layer-2, #f1f5fd)', color: 'var(--dsw-alias-label-secondary)' } }, text)
    const label = (t) => h('div', { style: { fontSize: 11, fontWeight: 650, color: M.color, marginBottom: 6, letterSpacing: '.3px', textTransform: 'uppercase' } }, t)

    function api(path, body) {
      return fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined)
        .then((r) => r.json())
    }
    function useLiveState(setState, refresh) {
      useEffect(() => {
        refresh()
        let es
        try {
          es = new EventSource('/dsh-projects/events')
          es.onmessage = (e) => { try { const s = JSON.parse(e.data); if (s && !s.error) setState(s) } catch { /* ignore */ } }
        } catch { /* fall back to refresh */ }
        return () => { if (es) es.close() }
      }, [])
    }
    function openSessionByTitle(title) {
      const nodes = Array.from(document.querySelectorAll('button, [role="button"], a'))
      const target = nodes.find((n) => (n.textContent || '').includes(title))
      if (target) target.click()
    }
    function Icon({ size = 16 }) {
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, 'aria-hidden': true },
        h('rect', { x: 3, y: 3, width: 7, height: 7, rx: 1.5 }),
        h('rect', { x: 14, y: 3, width: 7, height: 7, rx: 1.5 }),
        h('rect', { x: 3, y: 14, width: 7, height: 7, rx: 1.5 }),
        h('path', { d: 'M17.5 14v7M14 17.5h7' }))
    }
    function Field({ label: text, value, onChange, placeholder }) {
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 } },
        h('div', { style: { fontSize: 11.5, color: M.color } }, text),
        h('input', { value, placeholder, onChange: (e) => onChange(e.target.value), style: { padding: '7px 9px', borderRadius: 8, border: B, background: 'var(--dsw-alias-bg-base, #f8faff)', color: 'var(--dsw-alias-label-primary)', fontSize: 12.5, outline: 'none' } }))
    }
    function ProjectsPage() {
      const [state, setState] = useState(null)
      const [error, setError] = useState('')
      const [modal, setModal] = useState(false)
      const [opened, setOpened] = useState(null)
      const [createError, setCreateError] = useState('')
      const [coordMsg, setCoordMsg] = useState('')
      const [form, setForm] = useState({ title: '', goal: '', dir: '', instructions: '' })
      const refresh = () => api('/dsh-projects/state').then((s) => { if (s && !s.error) { setState(s); setError('') } else setError((s && s.error) || 'load failed') }).catch((e) => setError(String(e)))
      useLiveState(setState, refresh)
      const cur = state && state.current
      const create = () => {
        setCreateError('')
        if (!form.title || !form.dir) { setCreateError('名称与目录必填'); return }
        api('/dsh-projects/create', form).then((r) => {
          if (r && r.error) { setCreateError(r.error); return }
          setModal(false); setForm({ title: '', goal: '', dir: '', instructions: '' }); setOpened(r.project.id); refresh()
        }).catch((e) => setCreateError(String(e)))
      }
      const switchTo = (id) => api('/dsh-projects/switch', { id }).then(refresh).catch((e) => setError(String(e)))
      const openCoordinator = () => {
        const pid = opened || (state && state.currentId)
        setCoordMsg('正在创建协调者会话…')
        api('/dsh-projects/coordinator', { projectId: pid }).then((r) => {
          if (r && r.error) { setCoordMsg('失败：' + r.error); return }
          setCoordMsg('协调者会话已就绪：' + r.sessionId + '（在左侧会话列表/Threads 面板打开）')
        }).catch((e) => setCoordMsg('失败：' + e))
      }
      return h('div', { style: { maxWidth: 1040, margin: '0 auto', padding: '32px 28px', fontFamily: 'var(--dsw-font-family, -apple-system, sans-serif)', color: 'var(--dsw-alias-label-primary)' } },
        h('div', { style: { display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 18 } },
          h('div', null,
            h('h1', { style: { margin: 0, fontSize: 23, letterSpacing: '-.2px' } }, 'Projects'),
            h('p', { style: { margin: '4px 0 0', fontSize: 12.5, color: M.color } }, '一个长期协调会话 = Coordinator；每个任务一个独立线程；资料与记忆按项目共享。')),
          h('div', { style: { marginLeft: 'auto', display: 'flex', gap: 8 } },
            h('button', { style: btn(false), onClick: refresh }, '刷新'),
            h('button', { style: btn(true), onClick: () => setModal(true) }, '＋ 新建项目'))),
        error ? h('div', { style: { fontSize: 11.5, color: 'var(--dsw-alias-state-error-primary, #f85149)', marginBottom: 10 } }, error) : null,
        opened && state && state.current ? h('div', { style: { ...card, marginBottom: 12, borderColor: 'var(--dsw-alias-brand-primary, #4d6bfe)' } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            h('button', { style: { ...btn(false), padding: '2px 8px' }, onClick: () => { setOpened(null); setCoordMsg('') } }, '← 全部项目'),
            h('div', { style: { fontSize: 15, fontWeight: 650 } }, state.current.title),
            state.current.status && state.current.status !== 'active' ? chip(state.current.status) : null,
            h('button', { style: { ...btn(true), marginLeft: 'auto' }, onClick: openCoordinator }, '进入项目对话')),
          h('div', { style: { fontSize: 11.5, color: M.color, margin: '6px 0 2px' } }, state.current.dir),
          h('div', { style: { fontSize: 12, color: M.color } }, state.current.goal || '（未设置目标）'),
          coordMsg ? h('div', { style: { fontSize: 11.5, color: 'var(--dsw-alias-brand-primary, #4d6bfe)', marginTop: 6 } }, coordMsg) : null,
          h('div', { style: { display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' } }, chip('线程 ' + (state.current.threads || []).length), chip('记忆 ' + state.current.memoryCount), chip('Library ' + state.current.libraryCount)))
          : null,
        state ? h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 } },
          state.projects.map((p) => h('div', {
            key: p.id,
            onClick: () => { switchTo(p.id); setOpened(p.id); },
            style: { ...card, cursor: 'pointer', borderColor: p.id === state.currentId ? 'var(--dsw-alias-brand-primary, #4d6bfe)' : B },
          },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 9 } },
              h('div', { style: { width: 26, height: 26, borderRadius: 8, background: 'var(--dsw-alias-brand-primary, #4d6bfe)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 } }, (p.title || 'P').slice(0, 1)),
              h('div', { style: { fontWeight: 600, fontSize: 13.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, p.title),
              p.id === state.currentId ? chip('当前', 'var(--dsw-alias-brand-primary, #4d6bfe)') : null),
            h('div', { style: { fontSize: 11.5, color: M.color, margin: '7px 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, p.dir),
            h('div', { style: { fontSize: 11, color: M.color, minHeight: 16 } }, p.goal || '（未设置目标）'),
            h('div', { style: { display: 'flex', gap: 6, marginTop: 8 } },
              h('button', { style: { ...btn(false), padding: '2px 7px' }, onClick: (e) => { e.stopPropagation(); api('/dsh-projects/lifecycle', { id: p.id, action: p.status === 'paused' ? 'resume' : 'pause' }).then(refresh) } }, p.status === 'paused' ? '继续' : '暂停'),
              h('button', { style: { ...btn(false), padding: '2px 7px' }, onClick: (e) => { e.stopPropagation(); api('/dsh-projects/lifecycle', { id: p.id, action: p.status === 'archived' ? 'unarchive' : 'archive' }).then(refresh) } }, p.status === 'archived' ? '取消归档' : '归档'),
              p.status && p.status !== 'active' ? chip(p.status) : null))),
          h('div', { onClick: () => setModal(true), style: { ...card, borderStyle: 'dashed', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 104, color: M.color, cursor: 'pointer', background: 'transparent' } }, '＋ 新建项目'))
          : h('div', { style: { fontSize: 12, color: M.color } }, '加载项目…'),
        cur ? h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 } },
          h('div', { style: card }, label('THREADS · ' + cur.title),
            h('div', { style: { display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' } },
              chip('线程 ' + (cur.threads || []).length),
              cur.counts && cur.counts.review ? chip('待收 ' + cur.counts.review, 'rgba(163,113,247,.16)') : null,
              cur.counts && cur.counts.failed ? chip('需要你 ' + cur.counts.failed, 'rgba(210,153,34,.18)') : null,
              cur.counts && cur.counts.active ? chip('进行中 ' + cur.counts.active, 'rgba(77,141,255,.16)') : null,
              chip('记忆 ' + cur.memoryCount), chip('Library ' + cur.libraryCount)),
            (cur.threads || []).length
              ? cur.threads.slice(0, 6).map((t) => h('div', { key: t.id, style: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: B } },
                  h('span', { style: { width: 7, height: 7, borderRadius: 99, background: t.status === 'done' ? '#3fb950' : t.status === 'resolved' ? '#8b949e' : '#4d8dff' } }),
                  h('div', { style: { flex: 1, minWidth: 0, fontSize: 12.5 } }, t.title),
                  h('button', { style: { ...btn(false), padding: '2px 8px' }, onClick: (e) => { e.stopPropagation(); openSessionByTitle(t.title) } }, '打开'),
                  chip(t.status)))
              : h('div', { style: { fontSize: 11.5, color: M.color } }, '还没有线程。在项目对话里让 coordinator 派一个。')),
          h('div', { style: card }, label('LIBRARY / MEMORY'),
            h('div', { style: { fontSize: 12, color: M.color, lineHeight: 1.9 } },
              h('div', null, '记忆条数：' + cur.memoryCount),
              h('div', null, 'Library 文件：' + cur.libraryCount),
              h('div', null, '项目指令：' + (cur.instructions ? '已设置' : '未设置')),
              h('div', null, '目录：' + cur.dir))))
          : null,
        modal ? h('div', { style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'grid', placeItems: 'center', zIndex: 50 }, onClick: () => setModal(false) },
          h('div', { style: { width: 520, background: 'var(--dsw-alias-bg-overlay, #fff)', borderRadius: 16, border: B, padding: 18 }, onClick: (e) => e.stopPropagation() },
            h('div', { style: { fontSize: 15, fontWeight: 650, marginBottom: 12 } }, '新建项目'),
            Field({ label: '名称 *', value: form.title, onChange: (v) => setForm({ ...form, title: v }), placeholder: '例如：Payments API 性能优化' }),
            Field({ label: '目标（可选）', value: form.goal, onChange: (v) => setForm({ ...form, goal: v }), placeholder: '一句话目标' }),
            Field({ label: '项目目录 *', value: form.dir, onChange: (v) => setForm({ ...form, dir: v }), placeholder: '/Users/you/workspace/project' }),
            Field({ label: '项目指令（可选）', value: form.instructions, onChange: (v) => setForm({ ...form, instructions: v }), placeholder: '所有线程都会收到的规则' }),
            createError ? h('div', { style: { fontSize: 11.5, color: 'var(--dsw-alias-state-error-primary, #f85149)', marginBottom: 6 } }, createError) : null,
            h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 } },
              h('button', { style: btn(false), onClick: () => setModal(false) }, '取消'),
              h('button', { style: btn(true), onClick: create }, '创建项目'))))
          : null)
    }
    function ThreadsButton() {
      const [open, setOpen] = useState(false)
      const [tab, setTab] = useState('threads')
      const [state, setState] = useState(null)
      const load = () => api('/dsh-projects/state').then((s) => { if (s && !s.error) setState(s) }).catch(() => {})
      useEffect(() => { if (open) load() }, [open])
      const cur = state && state.current
      const resolveThread = (id) => api('/dsh-projects/thread-resolve', { id }).then(load).catch(() => {})
      const tabBtn = (key, label) => h('button', { onClick: () => setTab(key), style: { padding: '5px 10px', border: 0, borderBottom: '2px solid ' + (tab === key ? 'var(--dsw-alias-brand-primary, #4d6bfe)' : 'transparent'), background: 'transparent', color: tab === key ? 'var(--dsw-alias-label-primary)' : M.color, cursor: 'pointer', fontSize: 12 } }, label)
      const row = (t) => h('div', { key: t.id, style: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 2px', borderTop: B } },
        h('span', { style: { width: 7, height: 7, borderRadius: 99, background: t.status === 'done' ? '#3fb950' : t.status === 'resolved' ? '#8b949e' : t.status === 'waiting' ? '#d29922' : '#4d8dff' } }),
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('div', { style: { fontSize: 12.5, fontWeight: 550, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, t.title),
          h('div', { style: { fontSize: 10.5, color: M.color } }, t.id + ' · ' + t.status + (t.lastReport ? ' · 有汇报' : ''))),
        h('button', { style: { ...btn(false), padding: '2px 7px' }, onClick: () => openSessionByTitle(t.title) }, '打开'),
        t.status === 'resolved' ? null : h('button', { style: { ...btn(false), padding: '2px 7px' }, onClick: () => resolveThread(t.id) }, '收尾'))
      return h('div', { style: { position: 'relative', display: 'inline-flex' } },
        h('button', { style: btn(false), onClick: () => setOpen(!open) }, 'Threads'),
        open ? h('div', { style: { position: 'absolute', right: 0, top: 38, width: 420, maxHeight: 540, overflow: 'auto', background: 'var(--dsw-alias-bg-overlay, #fff)', border: B, borderRadius: 12, boxShadow: '0 10px 34px rgba(0,0,0,.18)', padding: 12, zIndex: 60 } },
          h('div', { style: { display: 'flex', gap: 4, borderBottom: B, marginBottom: 8 } }, tabBtn('threads', 'Threads'), tabBtn('library', 'Library')),
          !cur ? h('div', { style: { fontSize: 11.5, color: M.color } }, '加载中…') :
            tab === 'threads'
              ? h('div', null,
                  h('div', { style: { fontSize: 11, color: M.color, marginBottom: 4 } }, (cur.title || '') + ' · ' + (cur.threads || []).length + ' 个线程'),
                  (cur.threads || []).length ? cur.threads.map(row) : h('div', { style: { fontSize: 11.5, color: M.color, padding: '8px 2px' } }, '还没有线程。在项目对话里让 coordinator 派一个。'),
                  (cur.proposals || []).length ? h('div', { style: { marginTop: 10, paddingTop: 8, borderTop: B } },
                    h('div', { style: { fontSize: 11, color: M.color, marginBottom: 4 } }, '建议线程（Suggested threads）'),
                    cur.proposals.map((p) => h('div', { key: p.id, style: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' } },
                      h('span', { style: { width: 7, height: 7, borderRadius: 99, background: '#8b949e' } }),
                      h('div', { style: { flex: 1, minWidth: 0 } },
                        h('div', { style: { fontSize: 12 } }, p.title),
                        h('div', { style: { fontSize: 10.5, color: M.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, p.brief)),
                      h('button', { style: { ...btn(false), padding: '2px 7px' }, onClick: () => openSessionByTitle('项目目标一句话说明') }, '去对话启动')))
                  ) : null)
              : h('div', null,
                  h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, margin: '4px 0' } },
                    h('div', { style: { fontSize: 11, color: M.color, flex: 1 } }, 'Library · ' + cur.libraryCount + ' 文件 / ' + (cur.library.folders || []).length + ' 文件夹'),
                    h('button', { style: { ...btn(false), padding: '2px 8px' }, onClick: () => {
                      const name = window.prompt('新建文件夹名称')
                      if (name) api('/dsh-projects/library-mkdir', { folder: name }).then(load).catch(() => {})
                    } }, '＋ 文件夹'),
                    h('button', { style: { ...btn(false), padding: '2px 8px' }, onClick: () => {
                      const input = document.createElement('input')
                      input.type = 'file'
                      input.onchange = () => {
                        const file = input.files && input.files[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = () => {
                          const base64 = String(reader.result).split(',')[1] || ''
                          api('/dsh-projects/library-upload', { name: file.name, contentBase64: base64 }).then(load).catch(() => {})
                        }
                        reader.readAsDataURL(file)
                      }
                      input.click()
                    } }, '＋ 上传')),
                  (cur.library.folders || []).map((f) => h('div', { key: f, style: { fontSize: 12, padding: '4px 2px' } }, '📁 ' + f)),
                  (cur.library.files || []).slice(0, 40).map((f) => h('div', { key: f, style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '3px 2px', color: M.color } },
                    h('span', { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, '· ' + f),
                    h('button', { style: { ...btn(false), padding: '1px 6px', fontSize: 10.5 }, onClick: () => {
                      const target = window.prompt('移动到文件夹（留空=根目录）', '')
                      if (target === null) return
                      api('/dsh-projects/library-move', { name: f.split('/').pop(), fromFolder: f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '', toFolder: target }).then(load).catch(() => {})
                    } }, '移动'))))
          ) : null)
    }
    function ThreadsPage() {
      const [state, setState] = useState(null)
      const [tab, setTab] = useState('threads')
      const load = () => api('/dsh-projects/state').then((s) => { if (s && !s.error) setState(s) }).catch(() => {})
      useLiveState(setState, load)
      const cur = state && state.current
      const tabBtn = (key, label) => h('button', { onClick: () => setTab(key), style: { padding: '6px 12px', border: 0, borderBottom: '2px solid ' + (tab === key ? 'var(--dsw-alias-brand-primary, #4d6bfe)' : 'transparent'), background: 'transparent', color: tab === key ? 'var(--dsw-alias-label-primary)' : M.color, cursor: 'pointer', fontSize: 12.5 } }, label)
      return h('div', { style: { maxWidth: 1040, margin: '0 auto', padding: '32px 28px', fontFamily: 'var(--dsw-font-family, -apple-system, sans-serif)', color: 'var(--dsw-alias-label-primary)' } },
        h('div', { style: { display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 14 } },
          h('div', null,
            h('h1', { style: { margin: 0, fontSize: 23 } }, 'Threads'),
            h('p', { style: { margin: '4px 0 0', fontSize: 12.5, color: M.color } }, (cur ? cur.title + ' · ' : '') + '独立会话 + git worktree 隔离；资料在 Library。')),
          h('div', { style: { marginLeft: 'auto' } }, h('button', { style: btn(false), onClick: load }, '刷新'))),
        h('div', { style: { display: 'flex', gap: 4, borderBottom: B, marginBottom: 12 } }, tabBtn('threads', 'Threads'), tabBtn('library', 'Library')),
        !cur ? h('div', { style: { fontSize: 12, color: M.color } }, '加载项目…') :
          tab === 'threads'
            ? h('div', { style: card },
                h('div', { style: { display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' } }, chip('线程 ' + (cur.threads || []).length), cur.counts && cur.counts.review ? chip('待收 ' + cur.counts.review) : null, cur.counts && cur.counts.failed ? chip('需要你 ' + cur.counts.failed) : null),
                (cur.threads || []).length === 0 ? h('div', { style: { fontSize: 12, color: M.color } }, '还没有线程，回项目对话让 coordinator 派一个。') :
                  cur.threads.map((t) => h('div', { key: t.id, style: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 2px', borderTop: B } },
                    h('span', { style: { width: 7, height: 7, borderRadius: 99, background: t.status === 'done' ? '#3fb950' : t.status === 'resolved' ? '#8b949e' : '#4d8dff' } }),
                    h('div', { style: { flex: 1, minWidth: 0 } },
                      h('div', { style: { fontSize: 13, fontWeight: 550 } }, t.title),
                      h('div', { style: { fontSize: 10.5, color: M.color } }, t.id + ' · ' + t.status + (t.branch ? ' · ' + t.branch : '') + (t.lastReport ? ' · 有汇报' : ''))),
                    h('button', { style: { ...btn(false), padding: '2px 8px' }, onClick: () => openSessionByTitle(t.title) }, '打开'),
                    t.status === 'resolved' ? null : h('button', { style: { ...btn(false), padding: '2px 8px' }, onClick: () => api('/dsh-projects/thread-resolve', { id: t.id }).then(load) }, '收尾')))
            )
            : h('div', { style: card },
                h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 } },
                  h('div', { style: { fontSize: 12, color: M.color, flex: 1 } }, 'Library · ' + cur.libraryCount + ' 文件 / ' + (cur.library.folders || []).length + ' 文件夹'),
                  h('button', { style: { ...btn(false), padding: '2px 8px' }, onClick: () => { const name = window.prompt('新建文件夹名称'); if (name) api('/dsh-projects/library-mkdir', { folder: name }).then(load) } }, '＋ 文件夹')),
                (cur.library.folders || []).map((f) => h('div', { key: f, style: { fontSize: 12, padding: '4px 2px' } }, '📁 ' + f)),
                (cur.library.files || []).map((f) => h('div', { key: f, style: { fontSize: 12, padding: '3px 2px', color: M.color } }, '· ' + f))))
    }
    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'projects', order: 20, label: 'Projects' }, Icon))
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'projects' }, ProjectsPage))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'threads', order: 21, label: 'Threads' }, Icon))
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'threads' }, ThreadsPage))
        ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({ name: 'conversation.session.header.actions', id: 'projects-threads', order: 40, label: 'Threads' }, ThreadsButton))
      },
    }
  },
})
