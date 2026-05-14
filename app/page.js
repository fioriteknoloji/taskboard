'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import styles from './page.module.css'

const TEAM = [
  { initials: 'AK', name: 'Ahmet K.' },
  { initials: 'BY', name: 'Burak Y.' },
  { initials: 'FŞ', name: 'Fatma Ş.' },
  { initials: 'ZD', name: 'Zeynep D.' },
  { initials: 'MÇ', name: 'Mert Ç.' },
  { initials: 'EY', name: 'Elif Y.' },
]

const COLUMNS = [
  { id: 'todo', label: 'Gelecek', color: '#888780' },
  { id: 'doing', label: 'Devam Eden', color: '#185FA5' },
  { id: 'done', label: 'Tamamlandı', color: '#3B6D11' },
]

const PRIORITY = {
  low:  { label: 'Düşük', bg: '#EAF3DE', color: '#3B6D11' },
  mid:  { label: 'Orta',  bg: '#FAEEDA', color: '#854F0B' },
  high: { label: 'Acil',  bg: '#FCEBEB', color: '#A32D2D' },
}

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60000) return 'az önce'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}dk önce`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}sa önce`
  return `${Math.floor(diff / 86400000)}g önce`
}

export default function Board() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'new' | task object
  const [form, setForm] = useState({})
  const [noteInput, setNoteInput] = useState('')
  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [saving, setSaving] = useState(false)

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

    const channel = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchTasks()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchTasks])

  function openNew() {
    setForm({ title: '', status: 'todo', priority: 'mid', assignee: 'AK', tags: '' })
    setModal('new')
  }

  function openEdit(task) {
    setForm({
      title: task.title,
      status: task.status,
      priority: task.priority,
      assignee: task.assignee,
      tags: (task.tags || []).join(', '),
    })
    setNoteInput('')
    setModal(task)
  }

  async function saveTask() {
    if (!form.title?.trim()) return
    setSaving(true)
    const tags = form.tags ? form.tags.split(',').map(s => s.trim()).filter(Boolean) : []
    const payload = {
      title: form.title.trim(),
      status: form.status,
      priority: form.priority,
      assignee: form.assignee,
      tags,
      updated_at: new Date().toISOString(),
    }

    if (modal === 'new') {
      payload.notes = []
      await supabase.from('tasks').insert(payload)
    } else {
      await supabase.from('tasks').update(payload).eq('id', modal.id)
    }
    setSaving(false)
    setModal(null)
  }

  async function addNote() {
    if (!noteInput.trim() || modal === 'new') return
    const notes = [...(modal.notes || []), { text: noteInput.trim(), time: new Date().toISOString() }]
    await supabase.from('tasks').update({ notes, updated_at: new Date().toISOString() }).eq('id', modal.id)
    setNoteInput('')
    // optimistic update for modal
    setModal(prev => ({ ...prev, notes }))
  }

  async function deleteTask() {
    await supabase.from('tasks').delete().eq('id', modal.id)
    setModal(null)
  }

  async function handleDrop(targetStatus) {
    if (!dragging || dragging === targetStatus) return
    const task = tasks.find(t => t.id === dragging)
    if (!task || task.status === targetStatus) return
    await supabase.from('tasks').update({ status: targetStatus, updated_at: new Date().toISOString() }).eq('id', dragging)
    setDragging(null)
    setDragOver(null)
  }

  const totalDone = tasks.filter(t => t.status === 'done').length

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 14, color: '#888' }}>
      Yükleniyor…
    </div>
  )

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Ekip Panosu</h1>
          <span style={statPill}>{tasks.length} görev</span>
          <span style={statPill}>{totalDone} tamamlandı</span>
        </div>
        <button style={btnPrimary} onClick={openNew}>+ Yeni İş</button>
      </div>

      {/* Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id)
          return (
            <div
              key={col.id}
              style={{
                background: dragOver === col.id ? '#e8f0fe' : '#eceae4',
                borderRadius: 14,
                padding: 14,
                minHeight: 500,
                border: dragOver === col.id ? '2px dashed #7F77DD' : '1px solid transparent',
                transition: 'background .15s',
              }}
              onDragOver={e => { e.preventDefault(); setDragOver(col.id) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(col.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid rgba(0,0,0,.08)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 500, color: '#555' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, display: 'inline-block' }} />
                  {col.label}
                </span>
                <span style={{ fontSize: 11, background: '#fff', border: '1px solid rgba(0,0,0,.1)', borderRadius: 20, padding: '2px 9px', color: '#666' }}>
                  {colTasks.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {colTasks.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '28px 0', fontSize: 12, color: '#aaa', border: '1px dashed rgba(0,0,0,.12)', borderRadius: 10 }}>
                    Kart yok
                  </div>
                )}
                {colTasks.map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => setDragging(task.id)}
                    onDragEnd={() => { setDragging(null); setDragOver(null) }}
                    onClick={() => openEdit(task)}
                    style={{
                      background: '#fff',
                      borderRadius: 12,
                      padding: '12px 14px',
                      cursor: 'pointer',
                      opacity: dragging === task.id ? 0.4 : 1,
                      border: '1px solid rgba(0,0,0,.07)',
                      transition: 'border-color .15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, flex: 1 }}>{task.title}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap',
                        background: PRIORITY[task.priority]?.bg,
                        color: PRIORITY[task.priority]?.color,
                      }}>
                        {PRIORITY[task.priority]?.label}
                      </span>
                    </div>
                    {task.tags?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                        {task.tags.map(tag => (
                          <span key={tag} style={{ fontSize: 10, background: '#f0ede6', color: '#666', padding: '2px 7px', borderRadius: 4 }}>{tag}</span>
                        ))}
                      </div>
                    )}
                    {task.notes?.length > 0 && (
                      <div style={{ fontSize: 11, color: '#999', marginBottom: 8, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        💬 {task.notes[task.notes.length - 1].text}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={avatarStyle} title={task.assignee}>{task.assignee}</div>
                      <span style={{ fontSize: 10, color: '#bbb' }}>{timeAgo(task.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {modal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setModal(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
        >
          <div style={{ background: '#fff', borderRadius: 18, padding: 28, width: 500, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>{modal === 'new' ? 'Yeni İş Ekle' : 'Görevi Düzenle'}</h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#999', lineHeight: 1 }}>×</button>
            </div>

            <Field label="Görev adı">
              <input style={inputStyle} value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ne yapılacak?" autoFocus />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <Field label="Durum">
                <select style={inputStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Öncelik">
                <select style={inputStyle} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  <option value="low">Düşük</option>
                  <option value="mid">Orta</option>
                  <option value="high">Acil</option>
                </select>
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <Field label="Atanan kişi">
                <select style={inputStyle} value={form.assignee} onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))}>
                  {TEAM.map(m => <option key={m.initials} value={m.initials}>{m.initials} — {m.name}</option>)}
                </select>
              </Field>
              <Field label="Etiketler (virgülle)">
                <input style={inputStyle} value={form.tags || ''} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="tasarım, backend…" />
              </Field>
            </div>

            {modal !== 'new' && (
              <Field label="Not ekle">
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addNote()}
                    placeholder="Yorum veya güncelleme… (Enter)"
                  />
                  <button style={btnSmall} onClick={addNote}>Ekle</button>
                </div>
                {modal.notes?.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[...modal.notes].reverse().map((n, i) => (
                      <div key={i} style={{ background: '#f7f5f0', borderRadius: 8, padding: '8px 12px', borderLeft: '2px solid #AFA9EC' }}>
                        <div style={{ fontSize: 12, color: '#444' }}>{n.text}</div>
                        <div style={{ fontSize: 10, color: '#bbb', marginTop: 3 }}>{timeAgo(n.time)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Field>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              {modal !== 'new' && (
                <button style={btnDanger} onClick={deleteTask}>Sil</button>
              )}
              <button style={{ ...btnGhost, marginLeft: 'auto' }} onClick={() => setModal(null)}>İptal</button>
              <button style={btnPrimary} onClick={saveTask} disabled={saving}>
                {saving ? 'Kaydediliyor…' : modal === 'new' ? 'Ekle' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

const statPill = { fontSize: 12, background: '#eceae4', padding: '4px 10px', borderRadius: 20, color: '#666' }
const inputStyle = { width: '100%', border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px', fontSize: 13, background: '#fff', color: '#1a1a1a', outline: 'none' }
const avatarStyle = { width: 26, height: 26, borderRadius: '50%', background: '#EEEDFE', color: '#3C3489', fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #AFA9EC' }
const btnPrimary = { background: '#3C3489', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const btnGhost = { background: 'none', border: '1px solid #ddd', borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: 'pointer', color: '#666' }
const btnDanger = { background: 'none', border: '1px solid #F09595', borderRadius: 8, padding: '9px 14px', fontSize: 13, cursor: 'pointer', color: '#A32D2D' }
const btnSmall = { background: '#3C3489', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }
