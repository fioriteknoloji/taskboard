'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useNotifications, sendNotification } from '../lib/useNotifications'
import CalendarView from './CalendarView'
import TaskModal from './TaskModal'
import NotificationPanel from './NotificationPanel'

const COLUMNS = [
  { id: 'todo',  label: 'Yapılacak',  color: '#9b9b9b', icon: '○' },
  { id: 'doing', label: 'Devam Eden', color: '#5e6ad2', icon: '◑' },
  { id: 'done',  label: 'Tamamlandı', color: '#22c55e', icon: '●' },
]

const PRIORITY = {
  low:  { label: 'Düşük', dot: '#9b9b9b', bg: '#f0efec', color: '#6b6b6b' },
  mid:  { label: 'Orta',  dot: '#f59e0b', bg: '#fffbeb', color: '#854d0e' },
  high: { label: 'Acil',  dot: '#e5484d', bg: '#fff0f0', color: '#9f1239' },
}

const STATUS_LABELS = { todo: 'Yapılacak', doing: 'Devam Eden', done: 'Tamamlandı' }

const AVATAR_COLORS = [
  ['#dbeafe','#1d4ed8'],['#fce7f3','#be185d'],['#dcfce7','#15803d'],
  ['#fef3c7','#b45309'],['#ede9fe','#7c3aed'],['#fee2e2','#b91c1c'],
  ['#e0f2fe','#0369a1'],['#fdf4ff','#7e22ce'],
]

function strColor(str = '') {
  let h = 0; for (let c of str) h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length
  return AVATAR_COLORS[h]
}

function Avatar({ initials = '?', size = 22 }) {
  const [bg, fg] = strColor(initials)
  return <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color: fg, fontSize: size * 0.38, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials}</div>
}

function dueDateStatus(d, status) {
  if (!d || status === 'done') return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(d + 'T00:00:00')
  const diff = Math.floor((due - today) / 86400000)
  if (diff < 0) return { label: `${Math.abs(diff)}g gecikti`, color: '#e5484d', bg: '#fff0f0' }
  if (diff === 0) return { label: 'Bugün', color: '#d97706', bg: '#fffbeb' }
  if (diff <= 2) return { label: `${diff}g kaldı`, color: '#d97706', bg: '#fffbeb' }
  return { label: due.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }), color: '#6b6b6b', bg: '#f0efec' }
}

function timeAgo(ts) {
  const d = Date.now() - new Date(ts).getTime()
  if (d < 60000) return 'az önce'
  if (d < 3600000) return `${Math.floor(d / 60000)}dk önce`
  if (d < 86400000) return `${Math.floor(d / 3600000)}sa önce`
  if (d < 604800000) return `${Math.floor(d / 86400000)}g önce`
  return new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

function actionMeta(a) {
  return ({ created: { icon: '✦', bg: '#dcfce7' }, updated: { icon: '✎', bg: '#fef3c7' }, moved: { icon: '→', bg: '#dbeafe' }, note: { icon: '✉', bg: '#ede9fe' }, deleted: { icon: '✕', bg: '#fee2e2' } }[a]) || { icon: '·', bg: '#f0efec' }
}

// Recurring: bir sonraki görevi oluştur
async function createNextRecurring(task) {
  if (!task.recurrence || !task.due_date) return
  const due = new Date(task.due_date + 'T00:00:00')
  const start = task.start_date ? new Date(task.start_date + 'T00:00:00') : null
  const diff = start ? Math.floor((due - start) / 86400000) : 0

  const offsets = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 }
  const days = offsets[task.recurrence] || 7

  const newDue = new Date(due); newDue.setDate(newDue.getDate() + days)
  const newDueStr = newDue.toISOString().split('T')[0]

  if (task.recurrence_end && newDueStr > task.recurrence_end) return

  const newStart = start ? new Date(newDue); start && newStart && newStart.setDate(newStart.getDate() - diff) : null
  const payload = {
    title: task.title, status: 'todo', priority: task.priority,
    assignee_id: task.assignee_id, user_id: task.user_id,
    tags: task.tags, notes: [], due_date: newDueStr,
    start_date: newStart ? newStart.toISOString().split('T')[0] : null,
    recurrence: task.recurrence, recurrence_end: task.recurrence_end,
    parent_recurring_id: task.parent_recurring_id || task.id,
  }
  await supabase.from('tasks').insert(payload)
}

export default function Board() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(user?.id)

  const [tasks, setTasks]         = useState([])
  const [profiles, setProfiles]   = useState([])
  const [activity, setActivity]   = useState([])
  const [subtaskCounts, setSubtaskCounts] = useState({}) // taskId -> { total, done }
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(null)
  const [form, setForm]           = useState({})
  const [search, setSearch]       = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [dragging, setDragging]   = useState(null)
  const [dragOver, setDragOver]   = useState(null)
  const [view, setView]           = useState('board')
  const [showNotif, setShowNotif] = useState(false)

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  const log = useCallback(async (taskId, taskTitle, action, detail = '') => {
    await supabase.from('activity').insert({ task_id: taskId, task_title: taskTitle, action, detail })
  }, [])

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false })
    setTasks(data || [])
    setLoading(false)
  }, [])

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setProfiles(data || [])
  }, [])

  const fetchActivity = useCallback(async () => {
    const { data } = await supabase.from('activity').select('*').order('created_at', { ascending: false }).limit(60)
    setActivity(data || [])
  }, [])

  const fetchSubtaskCounts = useCallback(async () => {
    const { data } = await supabase.from('subtasks').select('task_id, completed')
    if (!data) return
    const counts = {}
    data.forEach(s => {
      if (!counts[s.task_id]) counts[s.task_id] = { total: 0, done: 0 }
      counts[s.task_id].total++
      if (s.completed) counts[s.task_id].done++
    })
    setSubtaskCounts(counts)
  }, [])

  // Deadline bildirimlerini kontrol et
  const checkDeadlines = useCallback(async (taskList, profileData) => {
    if (!profileData) return
    const today = new Date(); today.setHours(0, 0, 0, 0)
    for (const task of taskList) {
      if (!task.due_date || task.status === 'done' || task.assignee_id !== profileData.id) continue
      const due = new Date(task.due_date + 'T00:00:00')
      const diff = Math.floor((due - today) / 86400000)
      if (diff === 1) {
        await sendNotification(supabase, {
          userId: profileData.id, type: 'deadline',
          taskId: task.id, taskTitle: task.title,
          message: `"${task.title}" görevinin son tarihi yarın!`
        })
      }
    }
  }, [])

  useEffect(() => {
    if (!user) return
    fetchTasks(); fetchProfiles(); fetchActivity(); fetchSubtaskCounts()

    const c1 = supabase.channel('tasks-v5').on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchTasks).subscribe()
    const c2 = supabase.channel('act-v5').on('postgres_changes', { event: '*', schema: 'public', table: 'activity' }, fetchActivity).subscribe()
    const c3 = supabase.channel('sub-v5').on('postgres_changes', { event: '*', schema: 'public', table: 'subtasks' }, fetchSubtaskCounts).subscribe()

    return () => { supabase.removeChannel(c1); supabase.removeChannel(c2); supabase.removeChannel(c3) }
  }, [user, fetchTasks, fetchProfiles, fetchActivity, fetchSubtaskCounts])

  useEffect(() => {
    if (tasks.length && profile) checkDeadlines(tasks, profile)
  }, [tasks, profile, checkDeadlines])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function openNew(opts = {}) {
    setForm({ title: '', status: 'todo', priority: 'mid', assignee_id: profile?.id || '', tags: '', start_date: opts.start_date || '', due_date: opts.due_date || '', recurrence: '', recurrence_end: '' })
    setModal('new')
  }

  function openEdit(task) {
    setForm({
      title: task.title, status: task.status, priority: task.priority,
      assignee_id: task.assignee_id || '', tags: (task.tags || []).join(', '),
      start_date: task.start_date || '', due_date: task.due_date || '',
      recurrence: task.recurrence || '', recurrence_end: task.recurrence_end || '',
    })
    setModal(task)
  }

  async function saveTask(form) {
    if (!form.title?.trim()) return
    const tags = form.tags ? form.tags.split(',').map(s => s.trim()).filter(Boolean) : []
    const payload = {
      title: form.title.trim(), status: form.status, priority: form.priority,
      assignee_id: form.assignee_id || null,
      tags, start_date: form.start_date || null, due_date: form.due_date || null,
      recurrence: form.recurrence || null, recurrence_end: form.recurrence_end || null,
      updated_at: new Date().toISOString(),
    }

    if (modal === 'new') {
      payload.notes = []
      payload.user_id = user.id
      const { data } = await supabase.from('tasks').insert(payload).select().single()
      if (data) {
        await log(data.id, data.title, 'created', `${STATUS_LABELS[data.status]} kolonuna eklendi`)
        // Notify assignee
        if (data.assignee_id && data.assignee_id !== user.id) {
          await sendNotification(supabase, {
            userId: data.assignee_id, type: 'assigned',
            taskId: data.id, taskTitle: data.title,
            message: `${profile?.full_name || 'Biri'} sana bir görev atadı: "${data.title}"`
          })
        }
      }
    } else {
      const changed = []
      if (modal.status !== form.status) {
        changed.push(`${STATUS_LABELS[modal.status]} → ${STATUS_LABELS[form.status]}`)
        // If done and recurring → create next
        if (form.status === 'done' && modal.recurrence) await createNextRecurring({ ...modal, ...payload })
        // Notify dependency watchers
        if (form.status === 'done') {
          const { data: deps } = await supabase.from('task_dependencies').select('task_id').eq('depends_on', modal.id)
          for (const dep of deps || []) {
            const depTask = tasks.find(t => t.id === dep.task_id)
            if (depTask?.assignee_id && depTask.assignee_id !== user.id) {
              await sendNotification(supabase, {
                userId: depTask.assignee_id, type: 'dependency_done',
                taskId: depTask.id, taskTitle: depTask.title,
                message: `Bağımlı görev tamamlandı: "${modal.title}" → "${depTask.title}" artık başlayabilir`
              })
            }
          }
        }
      }
      if (modal.priority !== form.priority) changed.push(`öncelik: ${PRIORITY[modal.priority].label} → ${PRIORITY[form.priority || 'mid'].label}`)
      if ((modal.assignee_id || null) !== (form.assignee_id || null)) {
        changed.push(`atanan değişti`)
        if (form.assignee_id && form.assignee_id !== user.id) {
          await sendNotification(supabase, {
            userId: form.assignee_id, type: 'assigned',
            taskId: modal.id, taskTitle: payload.title,
            message: `${profile?.full_name || 'Biri'} sana bir görev atadı: "${payload.title}"`
          })
        }
      }
      if ((modal.due_date || null) !== (form.due_date || null)) changed.push('bitiş tarihi güncellendi')
      await supabase.from('tasks').update(payload).eq('id', modal.id)
      if (changed.length) await log(modal.id, payload.title, 'updated', changed.join(' · '))
    }
    setModal(null)
  }

  async function deleteTask(taskId) {
    const task = tasks.find(t => t.id === taskId)
    if (task) await log(task.id, task.title, 'deleted', 'görev silindi')
    await supabase.from('tasks').delete().eq('id', taskId)
    setModal(null)
  }

  async function handleDrop(targetStatus) {
    if (!dragging) return
    const task = tasks.find(t => t.id === dragging)
    if (!task || task.status === targetStatus) { setDragging(null); setDragOver(null); return }
    await supabase.from('tasks').update({ status: targetStatus, updated_at: new Date().toISOString() }).eq('id', dragging)
    await log(task.id, task.title, 'moved', `${STATUS_LABELS[task.status]} → ${STATUS_LABELS[targetStatus]}`)
    if (targetStatus === 'done' && task.recurrence) await createNextRecurring(task)
    setDragging(null); setDragOver(null)
  }

  const filtered = tasks.filter(t => {
    const q = search.toLowerCase()
    return (!q || t.title.toLowerCase().includes(q) || (t.tags || []).some(g => g.toLowerCase().includes(q)))
      && (!filterPriority || t.priority === filterPriority)
      && (!filterAssignee || t.assignee_id === filterAssignee)
  })

  const hasFilters = search || filterPriority || filterAssignee
  const overdue = tasks.filter(t => t.due_date && t.status !== 'done' && new Date(t.due_date + 'T00:00:00') < new Date().setHours(0, 0, 0, 0)).length

  if (authLoading || loading || !profile) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div style={{ width: 28, height: 28, border: '2px solid rgba(0,0,0,0.1)', borderTopColor: '#5e6ad2', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <span style={{ fontSize: 13, color: '#9b9b9b' }}>Yükleniyor…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        .card{animation:fadeUp 180ms ease;transition:border-color 150ms,box-shadow 150ms}
        .card:hover{border-color:rgba(0,0,0,0.18)!important;box-shadow:0 2px 8px rgba(0,0,0,0.07)!important}
        .sidelink{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:7px;border:none;cursor:pointer;font-size:13px;width:100%;text-align:left;transition:all 150ms;margin-bottom:2px}
        .filtersel{height:32px;border:1px solid rgba(0,0,0,0.1);border-radius:6px;font-size:13px;background:#f7f7f5;padding:0 8px;outline:none;cursor:pointer;color:#6b6b6b}
        input[type=date]::-webkit-calendar-picker-indicator{opacity:0.4;cursor:pointer}
        .card:hover .card-add-sub{opacity:1!important}
      `}</style>

      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

        {/* ── SIDEBAR ── */}
        <div style={{ width: 210, background: '#fff', borderRight: '1px solid rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', padding: '18px 10px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px', marginBottom: 24 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: '#5e6ad2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em' }}>Ekip Panosu</span>
          </div>

          <div style={{ fontSize: 10, fontWeight: 700, color: '#9b9b9b', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '0 10px', marginBottom: 6 }}>Görünüm</div>

          {[
            { id: 'board',    icon: '▦', label: 'Pano' },
            { id: 'calendar', icon: '◫', label: 'Takvim' },
            { id: 'activity', icon: '⊙', label: 'Aktivite' },
          ].map(v => (
            <button key={v.id} className="sidelink" onClick={() => setView(v.id)}
              style={{ background: view === v.id ? '#f0efec' : 'none', color: view === v.id ? '#1a1a1a' : '#6b6b6b', fontWeight: view === v.id ? 500 : 400 }}>
              <span style={{ fontSize: 15, opacity: .7 }}>{v.icon}</span>{v.label}
            </button>
          ))}

          <div style={{ marginTop: 'auto' }}>
            <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(0,0,0,0.07)', marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#9b9b9b', marginBottom: 8, fontWeight: 500 }}>Özet</div>
              {[
                { label: 'Toplam', val: tasks.length, color: '#1a1a1a' },
                { label: 'Tamamlandı', val: tasks.filter(t => t.status === 'done').length, color: '#22c55e' },
                overdue > 0 && { label: 'Gecikmiş', val: overdue, color: '#e5484d' },
                tasks.filter(t => t.recurrence).length > 0 && { label: 'Tekrarlayan', val: tasks.filter(t => t.recurrence).length, color: '#5e6ad2' },
              ].filter(Boolean).map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                  <span style={{ color: '#6b6b6b' }}>{row.label}</span>
                  <span style={{ fontWeight: 600, color: row.color }}>{row.val}</span>
                </div>
              ))}
            </div>

            <div style={{ padding: '10px 8px', borderTop: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar initials={profile.initials} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.full_name}</div>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99, background: isAdmin ? '#eef0fc' : '#f0efec', color: isAdmin ? '#5e6ad2' : '#6b6b6b' }}>
                  {isAdmin ? 'Admin' : 'Üye'}
                </span>
              </div>
              <button onClick={signOut} title="Çıkış yap" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9b9b9b', padding: 4, borderRadius: 4, fontSize: 14 }}>⎋</button>
            </div>
          </div>
        </div>

        {/* ── MAIN ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Topbar */}
          <div style={{ height: 52, borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', padding: '0 18px', gap: 10, background: '#fff', flexShrink: 0 }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
              <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#9b9b9b', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
              <input placeholder="Görev ara…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', paddingLeft: 32, paddingRight: 10, height: 32, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6, fontSize: 13, background: '#f7f7f5', outline: 'none', transition: 'border-color 150ms' }}
                onFocus={e => e.target.style.borderColor = '#5e6ad2'} onBlur={e => e.target.style.borderColor = 'rgba(0,0,0,0.1)'} />
            </div>

            <select className="filtersel" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
              <option value="">Öncelik</option>
              <option value="high">Acil</option>
              <option value="mid">Orta</option>
              <option value="low">Düşük</option>
            </select>

            {isAdmin && (
              <select className="filtersel" value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
                <option value="">Kişi</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            )}

            {hasFilters && (
              <button onClick={() => { setSearch(''); setFilterPriority(''); setFilterAssignee('') }}
                style={{ height: 32, padding: '0 10px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6, fontSize: 12, color: '#6b6b6b', background: 'none', cursor: 'pointer' }}>
                Temizle ×
              </button>
            )}

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Notification bell */}
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowNotif(v => !v)}
                  style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid rgba(0,0,0,0.1)', background: showNotif ? '#f0efec' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, position: 'relative' }}>
                  🔔
                  {unreadCount > 0 && (
                    <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#e5484d', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fff' }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                {showNotif && (
                  <NotificationPanel notifications={notifications} unreadCount={unreadCount} markRead={markRead} markAllRead={markAllRead} onClose={() => setShowNotif(false)} />
                )}
              </div>

              <button onClick={() => openNew()}
                style={{ height: 32, padding: '0 14px', background: '#5e6ad2', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'background 150ms' }}
                onMouseEnter={e => e.currentTarget.style.background = '#4f5bc7'}
                onMouseLeave={e => e.currentTarget.style.background = '#5e6ad2'}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                Yeni İş
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: view === 'calendar' ? 'hidden' : 'auto', padding: view === 'calendar' ? '18px 18px 8px' : 18, display: 'flex', flexDirection: 'column' }}>

            {view === 'calendar' ? (
              <CalendarView
                tasks={filtered} profiles={profiles}
                onTaskClick={openEdit}
                onTaskUpdate={async (id, updates) => {
                  await supabase.from('tasks').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
                }}
                openNewWithDate={(date) => openNew({ start_date: date, due_date: date })}
              />
            ) : view === 'activity' ? (
              <div style={{ maxWidth: 580, margin: '0 auto' }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, letterSpacing: '-0.02em' }}>Aktivite Geçmişi</h2>
                {activity.length === 0 && <div style={{ textAlign: 'center', padding: '48px 0', color: '#9b9b9b', fontSize: 13 }}>Henüz aktivite yok</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {activity.map(a => {
                    const m = actionMeta(a.action)
                    return (
                      <div key={a.id} style={{ display: 'flex', gap: 12, padding: '10px 14px', borderRadius: 10, background: '#fff', border: '1px solid rgba(0,0,0,0.07)', alignItems: 'flex-start' }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12 }}>{m.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.task_title}</div>
                          <div style={{ fontSize: 12, color: '#6b6b6b', marginTop: 2 }}>{a.detail}</div>
                        </div>
                        <div style={{ fontSize: 11, color: '#9b9b9b', whiteSpace: 'nowrap', paddingTop: 2 }}>{timeAgo(a.created_at)}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              /* ── BOARD ── */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, alignItems: 'start' }}>
                {COLUMNS.map(col => {
                  const colTasks = filtered.filter(t => t.status === col.id)
                  const over = dragOver === col.id
                  return (
                    <div key={col.id}
                      onDragOver={e => { e.preventDefault(); setDragOver(col.id) }}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={() => handleDrop(col.id)}
                      style={{ background: over ? '#eef0fc' : '#f7f7f5', borderRadius: 12, padding: 12, border: `1.5px solid ${over ? '#5e6ad2' : 'transparent'}`, transition: 'all 150ms', minHeight: 460 }}>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '2px 2px 10px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: col.color, fontSize: 13 }}>{col.icon}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#6b6b6b' }}>{col.label}</span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 500, color: '#9b9b9b', background: '#fff', padding: '1px 8px', borderRadius: 99, border: '1px solid rgba(0,0,0,0.08)' }}>{colTasks.length}</span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {colTasks.length === 0 && (
                          <div style={{ textAlign: 'center', padding: '28px 0', fontSize: 12, color: '#9b9b9b', border: '1px dashed rgba(0,0,0,0.1)', borderRadius: 8 }}>
                            {hasFilters ? 'Eşleşen yok' : 'Kart yok'}
                          </div>
                        )}
                        {colTasks.map(task => {
                          const due = dueDateStatus(task.due_date, task.status)
                          const p = PRIORITY[task.priority] || PRIORITY.mid
                          const assigneeProf = profiles.find(pr => pr.id === task.assignee_id)
                          const sc = subtaskCounts[task.id]
                          return (
                            <div key={task.id} className="card"
                              draggable
                              onDragStart={() => setDragging(task.id)}
                              onDragEnd={() => { setDragging(null); setDragOver(null) }}
                              onClick={() => openEdit(task)}
                              style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', opacity: dragging === task.id ? 0.3 : 1, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', position: 'relative' }}>

                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7 }}>
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.dot, flexShrink: 0, marginTop: 5 }} />
                                <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a', lineHeight: 1.45, flex: 1 }}>{task.title}</span>
                                {task.recurrence && <span title="Tekrarlayan görev" style={{ fontSize: 11, flexShrink: 0 }}>🔁</span>}
                              </div>

                              {task.tags?.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginLeft: 15, marginBottom: 7 }}>
                                  {task.tags.map(tag => (
                                    <span key={tag} style={{ fontSize: 11, color: '#9b9b9b', background: '#f7f7f5', padding: '1px 7px', borderRadius: 4, border: '1px solid rgba(0,0,0,0.07)' }}>{tag}</span>
                                  ))}
                                </div>
                              )}

                              {/* Subtask progress bar */}
                              {sc && sc.total > 0 && (
                                <div style={{ marginLeft: 15, marginBottom: 8 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span style={{ fontSize: 10, color: '#9b9b9b' }}>{sc.done}/{sc.total} alt görev</span>
                                    <span style={{ fontSize: 10, color: '#9b9b9b' }}>{Math.round(sc.done / sc.total * 100)}%</span>
                                  </div>
                                  <div style={{ height: 3, background: '#f0efec', borderRadius: 99, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', background: '#22c55e', borderRadius: 99, width: `${Math.round(sc.done / sc.total * 100)}%`, transition: 'width 300ms' }} />
                                  </div>
                                </div>
                              )}

                              {task.notes?.length > 0 && (
                                <div style={{ fontSize: 11, color: '#9b9b9b', marginLeft: 15, marginBottom: 7, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.5, fontStyle: 'italic' }}>
                                  {task.notes[task.notes.length - 1].text}
                                </div>
                              )}

                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginLeft: 15, marginTop: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <Avatar initials={assigneeProf?.initials || '?'} size={20} />
                                  {isAdmin && assigneeProf && <span style={{ fontSize: 11, color: '#9b9b9b' }}>{assigneeProf.full_name.split(' ')[0]}</span>}
                                  {due && <span style={{ fontSize: 10, fontWeight: 500, color: due.color, background: due.bg, padding: '1px 7px', borderRadius: 99 }}>{due.label}</span>}
                                </div>
                                <span style={{ fontSize: 10, color: '#9b9b9b' }}>{timeAgo(task.created_at)}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <TaskModal
          modal={modal} form={form} setForm={setForm} setModal={setModal}
          profiles={profiles} allTasks={tasks}
          user={user} profile={profile} isAdmin={isAdmin}
          onSave={saveTask} onDelete={deleteTask}
          activity={activity}
        />
      )}
    </>
  )
}
