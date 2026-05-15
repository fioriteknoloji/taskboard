'use client'

import { useEffect, useState, useCallback } from 'react'
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
  { id: 'todo',  label: 'Yapılacak',   color: '#9b9b9b', icon: '○' },
  { id: 'doing', label: 'Devam Eden',  color: '#5e6ad2', icon: '◑' },
  { id: 'done',  label: 'Tamamlandı', color: '#22c55e', icon: '●' },
]

const PRIORITY = {
  low:  { label: 'Düşük', color: '#6b6b6b', bg: '#f0efec', dot: '#9b9b9b' },
  mid:  { label: 'Orta',  color: '#854d0e', bg: '#fffbeb', dot: '#f59e0b' },
  high: { label: 'Acil',  color: '#9f1239', bg: '#fff0f0', dot: '#e5484d' },
}

const STATUS_LABELS = { todo: 'Yapılacak', doing: 'Devam Eden', done: 'Tamamlandı' }

const avatarColors = {
  AK: ['#dbeafe','#1d4ed8'], BY: ['#fce7f3','#be185d'],
  FŞ: ['#dcfce7','#15803d'], ZD: ['#fef3c7','#b45309'],
  MÇ: ['#ede9fe','#7c3aed'], EY: ['#fee2e2','#b91c1c'],
}

function dueDateStatus(d, status) {
  if (!d || status === 'done') return null
  const today = new Date(); today.setHours(0,0,0,0)
  const due = new Date(d + 'T00:00:00')
  const diff = Math.floor((due - today) / 86400000)
  if (diff < 0) return { label: `${Math.abs(diff)}g gecikti`, color: '#e5484d', bg: '#fff0f0' }
  if (diff === 0) return { label: 'Bugün', color: '#d97706', bg: '#fffbeb' }
  if (diff <= 2) return { label: `${diff}g kaldı`, color: '#d97706', bg: '#fffbeb' }
  return { label: due.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }), color: '#6b6b6b', bg: '#f0efec' }
}

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60000) return 'az önce'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}dk önce`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}sa önce`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}g önce`
  return new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

function actionMeta(action) {
  return {
    created: { icon: '✦', bg: '#dcfce7' },
    updated: { icon: '✎', bg: '#fef3c7' },
    moved:   { icon: '→', bg: '#dbeafe' },
    note:    { icon: '✉', bg: '#ede9fe' },
    deleted: { icon: '✕', bg: '#fee2e2' },
  }[action] || { icon: '·', bg: '#f0efec' }
}

function Avatar({ initials, size = 22 }) {
  const [bg, fg] = avatarColors[initials] || ['#f0efec','#6b6b6b']
  return <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color: fg, fontSize: size * 0.38, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials}</div>
}

function Inp({ style, ...p }) {
  return <input onFocus={e=>e.target.style.borderColor='#5e6ad2'} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,0.12)'} style={{ width:'100%', border:'1px solid rgba(0,0,0,0.12)', borderRadius:6, padding:'7px 10px', fontSize:13, background:'#fff', color:'#1a1a1a', outline:'none', transition:'border-color 150ms', ...style }} {...p} />
}

function Sel({ children, ...p }) {
  return <select style={{ width:'100%', border:'1px solid rgba(0,0,0,0.12)', borderRadius:6, padding:'7px 10px', fontSize:13, background:'#fff', color:'#1a1a1a', outline:'none', cursor:'pointer' }} {...p}>{children}</select>
}

function Lbl({ children }) {
  return <label style={{ fontSize:11, fontWeight:600, color:'#9b9b9b', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:5 }}>{children}</label>
}

function Field({ label, children }) {
  return <div style={{ marginBottom:14 }}><Lbl>{label}</Lbl>{children}</div>
}

export default function Board() {
  const [tasks, setTasks] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [noteInput, setNoteInput] = useState('')
  const [search, setSearch] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('detail')
  const [view, setView] = useState('board')

  const log = useCallback(async (taskId, taskTitle, action, detail='') => {
    await supabase.from('activity').insert({ task_id: taskId, task_title: taskTitle, action, detail })
  }, [])

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false })
    setTasks(data || [])
    setLoading(false)
  }, [])

  const fetchActivity = useCallback(async () => {
    const { data } = await supabase.from('activity').select('*').order('created_at', { ascending: false }).limit(60)
    setActivity(data || [])
  }, [])

  useEffect(() => {
    fetchTasks(); fetchActivity()
    const c1 = supabase.channel('t').on('postgres_changes',{event:'*',schema:'public',table:'tasks'},fetchTasks).subscribe()
    const c2 = supabase.channel('a').on('postgres_changes',{event:'*',schema:'public',table:'activity'},fetchActivity).subscribe()
    return () => { supabase.removeChannel(c1); supabase.removeChannel(c2) }
  }, [fetchTasks, fetchActivity])

  function openNew() {
    setForm({ title:'', status:'todo', priority:'mid', assignee:TEAM[0].initials, tags:'', due_date:'' })
    setModal('new'); setActiveTab('detail')
  }

  function openEdit(task) {
    setForm({ title:task.title, status:task.status, priority:task.priority, assignee:task.assignee, tags:(task.tags||[]).join(', '), due_date:task.due_date||'' })
    setNoteInput(''); setModal(task); setActiveTab('detail')
  }

  async function saveTask() {
    if (!form.title?.trim()) return
    setSaving(true)
    const tags = form.tags ? form.tags.split(',').map(s=>s.trim()).filter(Boolean) : []
    const payload = { title:form.title.trim(), status:form.status, priority:form.priority, assignee:form.assignee, tags, due_date:form.due_date||null, updated_at:new Date().toISOString() }
    if (modal === 'new') {
      payload.notes = []
      const { data } = await supabase.from('tasks').insert(payload).select().single()
      if (data) await log(data.id, data.title, 'created', `${STATUS_LABELS[data.status]} kolonuna eklendi`)
    } else {
      const changed = []
      if (modal.status !== form.status) changed.push(`${STATUS_LABELS[modal.status]} → ${STATUS_LABELS[form.status]}`)
      if (modal.priority !== form.priority) changed.push(`öncelik: ${PRIORITY[modal.priority].label} → ${PRIORITY[form.priority].label}`)
      if (modal.assignee !== form.assignee) changed.push(`atanan: ${modal.assignee} → ${form.assignee}`)
      if ((modal.due_date||null) !== (form.due_date||null)) changed.push('bitiş tarihi güncellendi')
      await supabase.from('tasks').update(payload).eq('id', modal.id)
      if (changed.length) await log(modal.id, payload.title, 'updated', changed.join(' · '))
    }
    setSaving(false); setModal(null)
  }

  async function addNote() {
    if (!noteInput.trim() || modal === 'new') return
    const notes = [...(modal.notes||[]), { text:noteInput.trim(), time:new Date().toISOString() }]
    await supabase.from('tasks').update({ notes, updated_at:new Date().toISOString() }).eq('id', modal.id)
    await log(modal.id, modal.title, 'note', noteInput.trim())
    setNoteInput(''); setModal(prev => ({...prev, notes}))
  }

  async function deleteTask() {
    await log(modal.id, modal.title, 'deleted', 'görev silindi')
    await supabase.from('tasks').delete().eq('id', modal.id)
    setModal(null)
  }

  async function handleDrop(targetStatus) {
    if (!dragging) return
    const task = tasks.find(t=>t.id===dragging)
    if (!task || task.status===targetStatus) { setDragging(null); setDragOver(null); return }
    await supabase.from('tasks').update({ status:targetStatus, updated_at:new Date().toISOString() }).eq('id', dragging)
    await log(task.id, task.title, 'moved', `${STATUS_LABELS[task.status]} → ${STATUS_LABELS[targetStatus]}`)
    setDragging(null); setDragOver(null)
  }

  const filtered = tasks.filter(t => {
    const q = search.toLowerCase()
    return (!q || t.title.toLowerCase().includes(q) || (t.tags||[]).some(g=>g.toLowerCase().includes(q)))
      && (!filterPriority || t.priority===filterPriority)
      && (!filterAssignee || t.assignee===filterAssignee)
  })

  const hasFilters = search || filterPriority || filterAssignee
  const overdue = tasks.filter(t => t.due_date && t.status!=='done' && new Date(t.due_date+'T00:00:00') < new Date().setHours(0,0,0,0)).length

  const s = {
    sidebar: { width:210, background:'#fff', borderRight:'1px solid rgba(0,0,0,0.08)', display:'flex', flexDirection:'column', padding:'18px 10px', flexShrink:0 },
    topbar: { height:52, borderBottom:'1px solid rgba(0,0,0,0.08)', display:'flex', alignItems:'center', padding:'0 18px', gap:10, background:'#fff', flexShrink:0 },
    btnPrimary: { height:32, padding:'0 14px', background:'#5e6ad2', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:5 },
    btnGhost: { padding:'7px 14px', background:'none', border:'1px solid rgba(0,0,0,0.1)', borderRadius:6, fontSize:13, color:'#6b6b6b', cursor:'pointer' },
    btnDanger: { padding:'7px 14px', background:'none', border:'1px solid rgba(0,0,0,0.1)', borderRadius:6, fontSize:13, color:'#e5484d', cursor:'pointer' },
    modalOverlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.25)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, backdropFilter:'blur(3px)' },
    modal: { background:'#fff', borderRadius:16, width:520, maxWidth:'95vw', maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 8px 40px rgba(0,0,0,0.14)', border:'1px solid rgba(0,0,0,0.08)' },
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:12 }}>
      <div style={{ width:28, height:28, border:'2px solid rgba(0,0,0,0.1)', borderTopColor:'#5e6ad2', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
      <span style={{ fontSize:13, color:'#9b9b9b' }}>Yükleniyor…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .card{animation:fadeUp 180ms ease;transition:border-color 150ms,box-shadow 150ms}
        .card:hover{border-color:rgba(0,0,0,0.18)!important;box-shadow:0 2px 8px rgba(0,0,0,0.07)!important}
        .sidelink{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:7px;border:none;cursor:pointer;font-size:13px;width:100%;text-align:left;transition:all 150ms;margin-bottom:2px}
        .sidelink:hover{background:#f7f7f5}
        .sidelink.active{background:#f0efec;font-weight:500;color:#1a1a1a}
        .tab{padding:6px 12px;border-radius:6px;font-size:13px;font-weight:500;border:none;cursor:pointer;transition:all 150ms;color:#6b6b6b;background:none}
        .tab:hover{background:#f7f7f5;color:#1a1a1a}
        .tab.active{background:#fff;color:#1a1a1a;box-shadow:0 1px 3px rgba(0,0,0,0.08)}
        .filtersel{height:32px;border:1px solid rgba(0,0,0,0.1);border-radius:6px;font-size:13px;background:#f7f7f5;padding:0 8px;outline:none;cursor:pointer;color:#6b6b6b}
        input[type=date]::-webkit-calendar-picker-indicator{opacity:0.4;cursor:pointer}
      `}</style>

      <div style={{ display:'flex', height:'100vh', overflow:'hidden', fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

        {/* Sidebar */}
        <div style={s.sidebar}>
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 6px', marginBottom:24 }}>
            <div style={{ width:26, height:26, borderRadius:7, background:'#5e6ad2', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            </div>
            <span style={{ fontSize:14, fontWeight:600, letterSpacing:'-0.02em' }}>Ekip Panosu</span>
          </div>

          <div style={{ fontSize:10, fontWeight:700, color:'#9b9b9b', textTransform:'uppercase', letterSpacing:'0.07em', padding:'0 10px', marginBottom:6 }}>Görünüm</div>

          {[{id:'board',icon:'▦',label:'Pano'},{id:'activity',icon:'⊙',label:'Aktivite'}].map(v => (
            <button key={v.id} className={`sidelink${view===v.id?' active':''}`} onClick={()=>setView(v.id)} style={{ background: view===v.id?'#f0efec':'none', color: view===v.id?'#1a1a1a':'#6b6b6b' }}>
              <span style={{ fontSize:15, opacity:.7 }}>{v.icon}</span>{v.label}
            </button>
          ))}

          <div style={{ marginTop:'auto', padding:'14px 8px 0', borderTop:'1px solid rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize:11, color:'#9b9b9b', marginBottom:8, fontWeight:500 }}>Özet</div>
            {[
              { label:'Toplam', val:tasks.length, color:'#1a1a1a' },
              { label:'Tamamlandı', val:tasks.filter(t=>t.status==='done').length, color:'#22c55e' },
              overdue > 0 && { label:'Gecikmiş', val:overdue, color:'#e5484d' },
            ].filter(Boolean).map(row => (
              <div key={row.label} style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5 }}>
                <span style={{ color:'#6b6b6b' }}>{row.label}</span>
                <span style={{ fontWeight:600, color:row.color }}>{row.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Main area */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Topbar */}
          <div style={s.topbar}>
            <div style={{ position:'relative', flex:1, maxWidth:300 }}>
              <svg style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'#9b9b9b', pointerEvents:'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input placeholder="Görev ara…" value={search} onChange={e=>setSearch(e.target.value)}
                style={{ width:'100%', paddingLeft:32, paddingRight:10, height:32, border:'1px solid rgba(0,0,0,0.1)', borderRadius:6, fontSize:13, background:'#f7f7f5', outline:'none', transition:'border-color 150ms' }}
                onFocus={e=>e.target.style.borderColor='#5e6ad2'} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,0.1)'} />
            </div>

            <select className="filtersel" value={filterPriority} onChange={e=>setFilterPriority(e.target.value)}>
              <option value="">Öncelik</option>
              <option value="high">Acil</option>
              <option value="mid">Orta</option>
              <option value="low">Düşük</option>
            </select>

            <select className="filtersel" value={filterAssignee} onChange={e=>setFilterAssignee(e.target.value)}>
              <option value="">Kişi</option>
              {TEAM.map(m=><option key={m.initials} value={m.initials}>{m.name}</option>)}
            </select>

            {hasFilters && (
              <button onClick={()=>{setSearch('');setFilterPriority('');setFilterAssignee('')}}
                style={{ height:32, padding:'0 10px', border:'1px solid rgba(0,0,0,0.1)', borderRadius:6, fontSize:12, color:'#6b6b6b', background:'none', cursor:'pointer' }}>
                Temizle ×
              </button>
            )}

            <div style={{ marginLeft:'auto' }}>
              <button style={s.btnPrimary} onClick={openNew}
                onMouseEnter={e=>e.currentTarget.style.background='#4f5bc7'}
                onMouseLeave={e=>e.currentTarget.style.background='#5e6ad2'}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                Yeni İş
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ flex:1, overflow:'auto', padding:18 }}>
            {view === 'activity' ? (
              <div style={{ maxWidth:580, margin:'0 auto' }}>
                <h2 style={{ fontSize:15, fontWeight:600, marginBottom:16, letterSpacing:'-0.02em' }}>Aktivite Geçmişi</h2>
                {activity.length === 0 && <div style={{ textAlign:'center', padding:'48px 0', color:'#9b9b9b', fontSize:13 }}>Henüz aktivite yok</div>}
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {activity.map(a => {
                    const m = actionMeta(a.action)
                    return (
                      <div key={a.id} style={{ display:'flex', gap:12, padding:'10px 14px', borderRadius:10, background:'#fff', border:'1px solid rgba(0,0,0,0.07)', alignItems:'flex-start' }}>
                        <div style={{ width:26, height:26, borderRadius:'50%', background:m.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:12 }}>{m.icon}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:500, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.task_title}</div>
                          <div style={{ fontSize:12, color:'#6b6b6b', marginTop:2 }}>{a.detail}</div>
                        </div>
                        <div style={{ fontSize:11, color:'#9b9b9b', whiteSpace:'nowrap', paddingTop:2 }}>{timeAgo(a.created_at)}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, alignItems:'start' }}>
                {COLUMNS.map(col => {
                  const colTasks = filtered.filter(t=>t.status===col.id)
                  const over = dragOver === col.id
                  return (
                    <div key={col.id}
                      onDragOver={e=>{e.preventDefault();setDragOver(col.id)}}
                      onDragLeave={()=>setDragOver(null)}
                      onDrop={()=>handleDrop(col.id)}
                      style={{ background: over?'#eef0fc':'#f7f7f5', borderRadius:12, padding:12, border:`1.5px solid ${over?'#5e6ad2':'transparent'}`, transition:'all 150ms', minHeight:460 }}>

                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, padding:'2px 2px 10px', borderBottom:'1px solid rgba(0,0,0,0.07)' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ color:col.color, fontSize:13 }}>{col.icon}</span>
                          <span style={{ fontSize:12, fontWeight:600, color:'#6b6b6b', letterSpacing:'-0.01em' }}>{col.label}</span>
                        </div>
                        <span style={{ fontSize:11, fontWeight:500, color:'#9b9b9b', background:'#fff', padding:'1px 8px', borderRadius:99, border:'1px solid rgba(0,0,0,0.08)' }}>{colTasks.length}</span>
                      </div>

                      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        {colTasks.length === 0 && (
                          <div style={{ textAlign:'center', padding:'28px 0', fontSize:12, color:'#9b9b9b', border:'1px dashed rgba(0,0,0,0.1)', borderRadius:8 }}>
                            {hasFilters ? 'Eşleşen yok' : 'Kart yok'}
                          </div>
                        )}
                        {colTasks.map(task => {
                          const due = dueDateStatus(task.due_date, task.status)
                          const p = PRIORITY[task.priority]
                          return (
                            <div key={task.id} className="card"
                              draggable
                              onDragStart={()=>setDragging(task.id)}
                              onDragEnd={()=>{setDragging(null);setDragOver(null)}}
                              onClick={()=>openEdit(task)}
                              style={{ background:'#fff', borderRadius:10, padding:'12px 14px', cursor:'pointer', opacity:dragging===task.id?0.3:1, border:'1px solid rgba(0,0,0,0.08)', boxShadow:'0 1px 2px rgba(0,0,0,0.04)' }}>

                              <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:7 }}>
                                <div style={{ width:7, height:7, borderRadius:'50%', background:p.dot, flexShrink:0, marginTop:5 }} />
                                <span style={{ fontSize:13, fontWeight:500, color:'#1a1a1a', lineHeight:1.45, flex:1 }}>{task.title}</span>
                              </div>

                              {task.tags?.length > 0 && (
                                <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginLeft:15, marginBottom:7 }}>
                                  {task.tags.map(tag=>(
                                    <span key={tag} style={{ fontSize:11, color:'#9b9b9b', background:'#f7f7f5', padding:'1px 7px', borderRadius:4, border:'1px solid rgba(0,0,0,0.07)' }}>{tag}</span>
                                  ))}
                                </div>
                              )}

                              {task.notes?.length > 0 && (
                                <div style={{ fontSize:11, color:'#9b9b9b', marginLeft:15, marginBottom:7, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', lineHeight:1.5, fontStyle:'italic' }}>
                                  {task.notes[task.notes.length-1].text}
                                </div>
                              )}

                              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginLeft:15, marginTop:6 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                  <Avatar initials={task.assignee} size={20} />
                                  {due && <span style={{ fontSize:10, fontWeight:500, color:due.color, background:due.bg, padding:'1px 7px', borderRadius:99 }}>{due.label}</span>}
                                </div>
                                <span style={{ fontSize:10, color:'#9b9b9b' }}>{timeAgo(task.created_at)}</span>
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
        <div onClick={e=>{if(e.target===e.currentTarget)setModal(null)}} style={s.modalOverlay}>
          <div style={s.modal}>
            <div style={{ padding:'18px 20px 0', borderBottom:'1px solid rgba(0,0,0,0.08)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <span style={{ fontSize:14, fontWeight:600, letterSpacing:'-0.01em' }}>{modal==='new'?'Yeni İş Ekle':'Görevi Düzenle'}</span>
                <button onClick={()=>setModal(null)} style={{ width:28, height:28, borderRadius:6, border:'none', background:'none', cursor:'pointer', fontSize:18, color:'#9b9b9b', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
              </div>
              {modal !== 'new' && (
                <div style={{ display:'flex', gap:2, marginBottom:-1 }}>
                  {[['detail','Detaylar'],['notes',`Notlar${modal.notes?.length?` (${modal.notes.length})`:''}`],['activity','Geçmiş']].map(([id,lbl])=>(
                    <button key={id} className={`tab${activeTab===id?' active':''}`} onClick={()=>setActiveTab(id)}>{lbl}</button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ flex:1, overflow:'auto', padding:'18px 20px' }}>
              {(modal==='new'||activeTab==='detail') && <>
                <Field label="Görev adı">
                  <Inp value={form.title||''} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Ne yapılacak?" autoFocus onKeyDown={e=>e.key==='Enter'&&saveTask()} />
                </Field>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <Field label="Durum"><Sel value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>{COLUMNS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</Sel></Field>
                  <Field label="Öncelik"><Sel value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}><option value="low">Düşük</option><option value="mid">Orta</option><option value="high">Acil</option></Sel></Field>
                  <Field label="Atanan kişi"><Sel value={form.assignee} onChange={e=>setForm(f=>({...f,assignee:e.target.value}))}>{TEAM.map(m=><option key={m.initials} value={m.initials}>{m.initials} — {m.name}</option>)}</Sel></Field>
                  <Field label="Bitiş tarihi"><Inp type="date" value={form.due_date||''} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))} /></Field>
                </div>
                <Field label="Etiketler (virgülle)">
                  <Inp value={form.tags||''} onChange={e=>setForm(f=>({...f,tags:e.target.value}))} placeholder="tasarım, backend…" />
                </Field>
              </>}

              {modal!=='new'&&activeTab==='notes'&&(
                <div>
                  <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                    <Inp value={noteInput} onChange={e=>setNoteInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addNote()} placeholder="Not veya yorum ekle… (Enter)" />
                    <button onClick={addNote} style={{ padding:'0 14px', background:'#5e6ad2', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap' }}>Ekle</button>
                  </div>
                  {!modal.notes?.length && <div style={{ textAlign:'center', padding:'32px 0', fontSize:13, color:'#9b9b9b' }}>Henüz not yok</div>}
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {[...(modal.notes||[])].reverse().map((n,i)=>(
                      <div key={i} style={{ background:'#f7f7f5', borderRadius:8, padding:'10px 14px', borderLeft:'2px solid #5e6ad2' }}>
                        <div style={{ fontSize:13, color:'#1a1a1a', lineHeight:1.5 }}>{n.text}</div>
                        <div style={{ fontSize:11, color:'#9b9b9b', marginTop:4 }}>{timeAgo(n.time)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {modal!=='new'&&activeTab==='activity'&&(()=>{
                const items = activity.filter(a=>a.task_id===modal.id)
                if (!items.length) return <div style={{ textAlign:'center', padding:'32px 0', fontSize:13, color:'#9b9b9b' }}>Bu görev için aktivite yok</div>
                return <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {items.map(a=>{
                    const m = actionMeta(a.action)
                    return (
                      <div key={a.id} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                        <div style={{ width:24, height:24, borderRadius:'50%', background:m.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:11 }}>{m.icon}</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, color:'#1a1a1a' }}>{a.detail}</div>
                          <div style={{ fontSize:11, color:'#9b9b9b', marginTop:2 }}>{timeAgo(a.created_at)}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              })()}
            </div>

            <div style={{ padding:'14px 20px', borderTop:'1px solid rgba(0,0,0,0.08)', display:'flex', gap:8, alignItems:'center' }}>
              {modal!=='new'&&(
                <button style={s.btnDanger} onClick={deleteTask}
                  onMouseEnter={e=>{e.currentTarget.style.background='#fff0f0';e.currentTarget.style.borderColor='#e5484d'}}
                  onMouseLeave={e=>{e.currentTarget.style.background='none';e.currentTarget.style.borderColor='rgba(0,0,0,0.1)'}}>
                  Sil
                </button>
              )}
              <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
                <button style={s.btnGhost} onClick={()=>setModal(null)}>İptal</button>
                {(modal==='new'||activeTab==='detail')&&(
                  <button onClick={saveTask} disabled={saving}
                    style={{ padding:'7px 18px', background:saving?'#9b9b9b':'#5e6ad2', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:500, cursor:saving?'default':'pointer', transition:'background 150ms' }}>
                    {saving?'Kaydediliyor…':modal==='new'?'Ekle':'Kaydet'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}