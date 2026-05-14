'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const TEAM = [
  { initials: 'AK', name: 'Ahmet K.' },
  { initials: 'BY', name: 'Burak Y.' },
  { initials: 'FŞ', name: 'Fatma Ş.' },
  { initials: 'ZD', name: 'Zeynep D.' },
  { initials: 'MÇ', name: 'Mert Ç.' },
  { initials: 'EY', name: 'Elif Y.' },
]

const COLUMNS = [
  { id: 'todo',  label: 'Gelecek',    accent: '#94a3b8' },
  { id: 'doing', label: 'Devam Eden', accent: '#6366f1' },
  { id: 'done',  label: 'Tamamlandı', accent: '#22c55e' },
]

const PRIORITY_CONFIG = {
  low:  { label: 'Düşük', dot: '#94a3b8' },
  mid:  { label: 'Orta',  dot: '#f59e0b' },
  high: { label: 'Acil',  dot: '#ef4444' },
}

const AVATAR_COLORS = [
  { bg: '#ede9fe', color: '#6d28d9' },
  { bg: '#dbeafe', color: '#1d4ed8' },
  { bg: '#dcfce7', color: '#15803d' },
  { bg: '#fce7f3', color: '#be185d' },
  { bg: '#ffedd5', color: '#c2410c' },
  { bg: '#e0f2fe', color: '#0369a1' },
]

function getAvatarColor(initials) {
  return AVATAR_COLORS[(initials || 'A').charCodeAt(0) % AVATAR_COLORS.length]
}

function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60000) return 'az önce'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}dk önce`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}sa önce`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}g önce`
  return new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

function isDueStatus(dateStr) {
  if (!dateStr) return null
  const diffDays = Math.ceil((new Date(dateStr) - new Date()) / 86400000)
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 2) return 'soon'
  return 'ok'
}

function uid() { return Math.random().toString(36).slice(2, 10) }

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
  @keyframes spin { to { transform: rotate(360deg) } }
  @keyframes fadeUp { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
  @keyframes modalIn { from { opacity:0; transform:translateY(10px) scale(0.97) } to { opacity:1; transform:translateY(0) scale(1) } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', system-ui, sans-serif; background: #f8fafc; }
  ::placeholder { color: #c8d3df; }
  input, select, textarea, button { font-family: inherit; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.1) !important; }
  .task-card { animation: fadeUp 0.18s ease; transition: border-color .12s, box-shadow .12s, transform .1s; }
  .task-card:hover { border-color: #dde3ed !important; box-shadow: 0 2px 12px rgba(0,0,0,0.06) !important; transform: translateY(-1px); }
  .task-card:active { transform: translateY(0); }
  .col-zone.drag-active { background: #f5f3ff !important; border-color: #c4b5fd !important; }
  .pill-btn { transition: all .12s; cursor: pointer; }
  .pill-btn:hover { background: #f5f3ff !important; border-color: #c4b5fd !important; color: #6366f1 !important; }
  .pill-btn.on { background: #6366f1 !important; color: #fff !important; border-color: #6366f1 !important; }
  .tab-btn { transition: color .12s; cursor: pointer; padding-bottom: 10px; border-bottom: 2px solid transparent; }
  .tab-btn:hover { color: #334155 !important; }
  .tab-btn.on { color: #1e293b !important; border-bottom-color: #6366f1 !important; }
  .note-row:hover .del-btn { opacity: 1 !important; }
  .act-row { transition: background .1s; }
  .act-row:hover { background: #fafafa; }
  .primary-btn { background: #6366f1; transition: background .12s, transform .1s; }
  .primary-btn:hover { background: #4f46e5 !important; }
  .primary-btn:active { transform: scale(0.98); }
`

export default function Board() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [noteInput, setNoteInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [search, setSearch] = useState('')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterAssignee, setFilterAssignee] = useState('all')
  const [activeTab, setActiveTab] = useState('detail')
  const searchRef = useRef(null)

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setTasks(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTasks()
    const ch = supabase
      .channel('tasks-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchTasks)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [fetchTasks])

  useEffect(() => {
    const fn = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'Escape') setModal(null)
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  const filtered = tasks.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) &&
      !(t.tags || []).some(g => g.toLowerCase().includes(search.toLowerCase()))) return false
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false
    if (filterAssignee !== 'all' && t.assignee !== filterAssignee) return false
    return true
  })

  function openNew() {
    setForm({ title: '', status: 'todo', priority: 'mid', assignee: 'AK', tags: '', due_date: '' })
    setModal('new'); setActiveTab('detail'); setNoteInput('')
  }

  function openEdit(task) {
    setForm({ title: task.title, status: task.status, priority: task.priority, assignee: task.assignee, tags: (task.tags || []).join(', '), due_date: task.due_date || '' })
    setModal(task); setActiveTab('detail'); setNoteInput('')
  }

  async function saveTask() {
    if (!form.title?.trim()) return
    setSaving(true)
    const now = new Date().toISOString()
    const tags = (form.tags || '').split(',').map(s => s.trim()).filter(Boolean)
    const payload = { title: form.title.trim(), status: form.status, priority: form.priority, assignee: form.assignee, tags, due_date: form.due_date || null, updated_at: now }

    if (modal === 'new') {
      await supabase.from('tasks').insert({ ...payload, notes: [], activity: [{ type: 'created', time: now, text: 'Görev oluşturuldu' }] })
    } else {
      const activity = [...(modal.activity || [])]
      if (form.status !== modal.status) activity.push({ type: 'status', time: now, text: `"${COLUMNS.find(c => c.id === modal.status)?.label}" → "${COLUMNS.find(c => c.id === form.status)?.label}"` })
      if (form.priority !== modal.priority) activity.push({ type: 'priority', time: now, text: `Öncelik: ${PRIORITY_CONFIG[modal.priority]?.label} → ${PRIORITY_CONFIG[form.priority]?.label}` })
      if (form.assignee !== modal.assignee) activity.push({ type: 'assign', time: now, text: `Atanan: ${modal.assignee} → ${form.assignee}` })
      if (form.due_date !== (modal.due_date || '')) activity.push({ type: 'date', time: now, text: form.due_date ? `Son tarih: ${formatDate(form.due_date)}` : 'Son tarih kaldırıldı' })
      await supabase.from('tasks').update({ ...payload, activity }).eq('id', modal.id)
    }
    setSaving(false); setModal(null)
  }

  async function addNote() {
    if (!noteInput.trim() || modal === 'new') return
    const now = new Date().toISOString()
    const note = { id: uid(), text: noteInput.trim(), time: now }
    const notes = [...(modal.notes || []), note]
    const activity = [...(modal.activity || []), { type: 'note', time: now, text: `Not eklendi: "${note.text}"` }]
    await supabase.from('tasks').update({ notes, activity, updated_at: now }).eq('id', modal.id)
    setNoteInput('')
    setModal(p => ({ ...p, notes, activity }))
  }

  async function deleteNote(noteId) {
    const now = new Date().toISOString()
    const notes = (modal.notes || []).filter(n => n.id !== noteId)
    const activity = [...(modal.activity || []), { type: 'note', time: now, text: 'Not silindi' }]
    await supabase.from('tasks').update({ notes, activity, updated_at: now }).eq('id', modal.id)
    setModal(p => ({ ...p, notes, activity }))
  }

  async function deleteTask() {
    await supabase.from('tasks').delete().eq('id', modal.id)
    setModal(null)
  }

  async function handleDrop(targetStatus) {
    if (!dragging) return
    const task = tasks.find(t => t.id === dragging)
    setDragging(null); setDragOver(null)
    if (!task || task.status === targetStatus) return
    const now = new Date().toISOString()
    const activity = [...(task.activity || []), { type: 'status', time: now, text: `"${COLUMNS.find(c => c.id === task.status)?.label}" → "${COLUMNS.find(c => c.id === targetStatus)?.label}"` }]
    await supabase.from('tasks').update({ status: targetStatus, activity, updated_at: now }).eq('id', dragging)
  }

  const totalDone = tasks.filter(t => t.status === 'done').length
  const overdueCount = tasks.filter(t => t.status !== 'done' && isDueStatus(t.due_date) === 'overdue').length

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12 }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ width: 28, height: 28, border: '2px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <span style={{ fontSize: 13, color: '#94a3b8' }}>Yükleniyor…</span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{GLOBAL_CSS}</style>

      {/* Topbar */}
      <header style={{ background: '#fff', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 28px', height: 58, display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginRight: 8 }}>
            <div style={{ width: 30, height: 30, background: '#6366f1', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.02em' }}>Ekip Panosu</span>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 6 }}>
            <Chip>{tasks.length} görev</Chip>
            <Chip green>{totalDone} tamamlandı</Chip>
            {overdueCount > 0 && <Chip red>⚠ {overdueCount} gecikmiş</Chip>}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#b0bec5', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Ara  ⌘K" style={{ paddingLeft: 30, paddingRight: 12, height: 34, border: '1px solid #e8ecf0', borderRadius: 9, fontSize: 13, width: 190, background: '#f8fafc', color: '#1e293b', letterSpacing: '-0.01em', transition: 'all .15s' }} />
            </div>
            <button onClick={openNew} className="primary-btn"
              style={{ height: 34, padding: '0 15px', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Yeni İş
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ borderTop: '1px solid #f8fafc', background: '#fafbfc' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 28px', height: 42, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#b0bec5', letterSpacing: '0.05em', textTransform: 'uppercase', marginRight: 4 }}>Filtre</span>
            {['all', 'low', 'mid', 'high'].map(p => (
              <button key={p} className={`pill-btn${filterPriority === p ? ' on' : ''}`}
                onClick={() => setFilterPriority(p)}
                style={{ height: 26, padding: '0 11px', border: '1px solid #e8ecf0', borderRadius: 20, fontSize: 12, fontWeight: 500, background: '#fff', color: '#64748b' }}>
                {p === 'all' ? 'Tümü' : PRIORITY_CONFIG[p].label}
              </button>
            ))}
            <div style={{ width: 1, height: 14, background: '#e8ecf0', margin: '0 2px' }} />
            <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
              style={{ height: 26, padding: '0 8px', border: '1px solid #e8ecf0', borderRadius: 8, fontSize: 12, background: '#fff', color: '#64748b', cursor: 'pointer' }}>
              <option value="all">Tüm kişiler</option>
              {TEAM.map(m => <option key={m.initials} value={m.initials}>{m.name}</option>)}
            </select>
            {(search || filterPriority !== 'all' || filterAssignee !== 'all') && (
              <button onClick={() => { setSearch(''); setFilterPriority('all'); setFilterAssignee('all') }}
                style={{ height: 26, padding: '0 10px', border: 'none', borderRadius: 20, fontSize: 12, background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontWeight: 500 }}>
                Temizle ×
              </button>
            )}
            {filtered.length !== tasks.length && (
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#b0bec5' }}>{filtered.length} / {tasks.length} görev</span>
            )}
          </div>
        </div>
      </header>

      {/* Board */}
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 28px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
        {COLUMNS.map(col => {
          const colTasks = filtered.filter(t => t.status === col.id)
          return (
            <div key={col.id} className={`col-zone${dragOver === col.id ? ' drag-active' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(col.id) }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null) }}
              onDrop={() => handleDrop(col.id)}
              style={{ background: '#f1f4f8', borderRadius: 14, padding: '14px 12px', border: '1.5px solid #eaecf0', transition: 'all .15s', minHeight: 520 }}>

              {/* Col header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #e8ecf0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.accent }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{col.label}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: '2px 9px', color: '#9aa5b4' }}>{colTasks.length}</span>
              </div>

              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {colTasks.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 100, color: '#c8d3df', fontSize: 12, border: '1.5px dashed #e2e8f0', borderRadius: 10, gap: 7, padding: 24 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>
                    Kart yok
                  </div>
                )}
                {colTasks.map(task => {
                  const ds = isDueStatus(task.due_date)
                  const pc = PRIORITY_CONFIG[task.priority]
                  const av = getAvatarColor(task.assignee)
                  return (
                    <div key={task.id} className="task-card"
                      draggable
                      onDragStart={() => setDragging(task.id)}
                      onDragEnd={() => { setDragging(null); setDragOver(null) }}
                      onClick={() => openEdit(task)}
                      style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', border: '1px solid #eaecf0', opacity: dragging === task.id ? 0.35 : 1 }}>

                      {/* Priority + title */}
                      <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: task.tags?.length || task.due_date ? 9 : 10 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: pc.dot, marginTop: 5, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#1e293b', lineHeight: 1.5, letterSpacing: '-0.015em' }}>{task.title}</span>
                      </div>

                      {/* Tags */}
                      {task.tags?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 16, marginBottom: 8 }}>
                          {task.tags.map(tag => (
                            <span key={tag} style={{ fontSize: 11, background: '#f8fafc', color: '#64748b', padding: '2px 7px', borderRadius: 5, border: '1px solid #eaecf0', fontWeight: 500 }}>{tag}</span>
                          ))}
                        </div>
                      )}

                      {/* Due date */}
                      {task.due_date && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 16, marginBottom: 8 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={ds === 'overdue' ? '#ef4444' : ds === 'soon' ? '#f59e0b' : '#94a3b8'} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                          <span style={{ fontSize: 11, fontWeight: ds !== 'ok' ? 600 : 400, color: ds === 'overdue' ? '#ef4444' : ds === 'soon' ? '#f59e0b' : '#94a3b8' }}>
                            {ds === 'overdue' && '⚠ '}{formatDate(task.due_date)}
                          </span>
                        </div>
                      )}

                      {/* Footer */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: av.bg, color: av.color, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '-0.02em' }}>
                            {task.assignee}
                          </div>
                          {task.notes?.length > 0 && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#94a3b8' }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                              {task.notes.length}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: '#c8d3df' }}>{timeAgo(task.updated_at || task.created_at)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </main>

      {/* Modal */}
      {modal && (
        <div onClick={e => e.target === e.currentTarget && setModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(3px)' }}>
          <div style={{ background: '#fff', borderRadius: 18, width: 560, maxWidth: '95vw', maxHeight: '88vh', overflowY: 'auto', border: '1px solid #e8ecf0', boxShadow: '0 24px 64px rgba(0,0,0,0.14)', animation: 'modalIn .2s cubic-bezier(0.34,1.56,0.64,1)' }}>

            {/* Modal header */}
            <div style={{ padding: '22px 24px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {modal === 'new' ? 'Yeni Görev' : 'Görevi Düzenle'}
                </span>
                <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6, transition: 'color .12s' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
              {modal !== 'new' && (
                <div style={{ display: 'flex', gap: 2 }}>
                  {[['detail', 'Detay'], ['notes', `Notlar${modal.notes?.length ? ` (${modal.notes.length})` : ''}`], ['activity', 'Geçmiş']].map(([id, label]) => (
                    <button key={id} className={`tab-btn${activeTab === id ? ' on' : ''}`}
                      onClick={() => setActiveTab(id)}
                      style={{ padding: '0 14px', height: 38, border: 'none', background: 'none', fontSize: 13, fontWeight: 500, color: '#94a3b8', letterSpacing: '-0.01em' }}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: '22px 24px 24px' }}>

              {/* Detail */}
              {(modal === 'new' || activeTab === 'detail') && (
                <div>
                  <textarea value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Görev adı…" autoFocus rows={2}
                    style={{ width: '100%', border: 'none', fontSize: 17, fontWeight: 500, color: '#0f172a', resize: 'none', letterSpacing: '-0.025em', lineHeight: 1.5, background: 'transparent', marginBottom: 20 }} />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                    <MField label="Durum">
                      <select style={sel} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                        {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </MField>
                    <MField label="Öncelik">
                      <select style={sel} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                        <option value="low">Düşük</option>
                        <option value="mid">Orta</option>
                        <option value="high">Acil</option>
                      </select>
                    </MField>
                    <MField label="Atanan kişi">
                      <select style={sel} value={form.assignee} onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))}>
                        {TEAM.map(m => <option key={m.initials} value={m.initials}>{m.initials} — {m.name}</option>)}
                      </select>
                    </MField>
                    <MField label="Son tarih">
                      <input type="date" style={sel} value={form.due_date || ''} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                    </MField>
                  </div>

                  <MField label="Etiketler (virgülle ayır)">
                    <input style={sel} value={form.tags || ''} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="tasarım, backend, acil…" />
                  </MField>

                  <div style={{ display: 'flex', gap: 8, marginTop: 22, paddingTop: 18, borderTop: '1px solid #f1f5f9' }}>
                    {modal !== 'new' && (
                      <button onClick={deleteTask} style={{ height: 36, padding: '0 14px', border: '1px solid #fecaca', borderRadius: 9, fontSize: 13, cursor: 'pointer', color: '#dc2626', background: '#fff', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        Sil
                      </button>
                    )}
                    <button onClick={() => setModal(null)} style={{ height: 36, padding: '0 14px', border: '1px solid #e8ecf0', borderRadius: 9, fontSize: 13, cursor: 'pointer', color: '#64748b', background: '#fff', marginLeft: 'auto' }}>İptal</button>
                    <button onClick={saveTask} disabled={saving} className="primary-btn"
                      style={{ height: 36, padding: '0 20px', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', letterSpacing: '-0.01em' }}>
                      {saving ? 'Kaydediliyor…' : modal === 'new' ? 'Oluştur' : 'Kaydet'}
                    </button>
                  </div>
                </div>
              )}

              {/* Notes */}
              {modal !== 'new' && activeTab === 'notes' && (
                <div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                    <input value={noteInput} onChange={e => setNoteInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addNote()}
                      placeholder="Not yaz… Enter ile kaydet"
                      style={{ ...sel, flex: 1 }} autoFocus />
                    <button onClick={addNote} className="primary-btn"
                      style={{ height: 36, padding: '0 16px', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Ekle
                    </button>
                  </div>
                  {!modal.notes?.length
                    ? <div style={{ textAlign: 'center', padding: '36px 0', color: '#c8d3df', fontSize: 13 }}>Henüz not yok</div>
                    : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[...modal.notes].reverse().map(n => (
                        <div key={n.id || n.time} className="note-row" style={{ background: '#f8fafc', borderRadius: 9, padding: '10px 14px', border: '1px solid #f1f5f9', position: 'relative' }}>
                          <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.55 }}>{n.text}</p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                            <span style={{ fontSize: 11, color: '#c8d3df' }}>{timeAgo(n.time)}</span>
                            <button className="del-btn" onClick={() => deleteNote(n.id)}
                              style={{ opacity: 0, fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', transition: 'opacity .15s' }}>Sil</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  }
                </div>
              )}

              {/* Activity */}
              {modal !== 'new' && activeTab === 'activity' && (
                <div>
                  {!modal.activity?.length
                    ? <div style={{ textAlign: 'center', padding: '36px 0', color: '#c8d3df', fontSize: 13 }}>Aktivite yok</div>
                    : <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {[...modal.activity].reverse().map((a, i) => {
                        const icons = {
                          created: { bg: '#f0fdf4', stroke: '#22c55e', d: 'M12 5v14M5 12h14' },
                          status:  { bg: '#eff6ff', stroke: '#6366f1', d: 'M5 12h14M12 5l7 7-7 7' },
                          priority:{ bg: '#fffbeb', stroke: '#f59e0b', d: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
                          assign:  { bg: '#faf5ff', stroke: '#8b5cf6', d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' },
                          note:    { bg: '#eff6ff', stroke: '#3b82f6', d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
                          date:    { bg: '#fff7ed', stroke: '#f97316', d: 'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18' },
                        }
                        const ic = icons[a.type] || icons.created
                        return (
                          <div key={i} className="act-row" style={{ display: 'flex', gap: 12, padding: '10px 8px', borderRadius: 8, borderBottom: i < modal.activity.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: ic.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ic.stroke} strokeWidth="2.2"><path d={ic.d}/></svg>
                            </div>
                            <div style={{ flex: 1, paddingTop: 2 }}>
                              <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.45 }}>{a.text}</p>
                              <span style={{ fontSize: 11, color: '#c8d3df' }}>{timeAgo(a.time)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  }
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Chip({ children, green, red }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 20, background: red ? '#fef2f2' : green ? '#f0fdf4' : '#f8fafc', color: red ? '#dc2626' : green ? '#16a34a' : '#94a3b8', border: `1px solid ${red ? '#fecaca' : green ? '#bbf7d0' : '#f1f5f9'}` }}>
      {children}
    </span>
  )
}

function MField({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</label>
      {children}
    </div>
  )
}

const sel = { width: '100%', height: 36, border: '1px solid #e8ecf0', borderRadius: 9, padding: '0 11px', fontSize: 13, background: '#fafbfc', color: '#1e293b', transition: 'all .15s', fontFamily: 'inherit' }