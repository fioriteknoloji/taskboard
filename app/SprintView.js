'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const STATUS_META = {
  planned:   { label: 'Planlandı',   color: '#9b9b9b', bg: '#f0efec' },
  active:    { label: 'Aktif',       color: '#5e6ad2', bg: '#eef0fc' },
  completed: { label: 'Tamamlandı', color: '#22c55e', bg: '#f0fdf4' },
}

const TASK_STATUS = {
  todo:  { label: 'Yapılacak',  color: '#9b9b9b' },
  doing: { label: 'Devam Eden', color: '#5e6ad2' },
  done:  { label: 'Tamamlandı',color: '#22c55e' },
}

function daysBetween(a, b) {
  return Math.ceil((new Date(b+'T00:00:00') - new Date(a+'T00:00:00')) / 86400000)
}

function formatDate(d) {
  return new Date(d+'T00:00:00').toLocaleDateString('tr-TR', { day:'numeric', month:'short' })
}

function Inp({ style, ...p }) {
  return <input onFocus={e=>e.target.style.borderColor='#5e6ad2'} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,0.12)'}
    style={{ width:'100%', border:'1px solid rgba(0,0,0,0.12)', borderRadius:6, padding:'7px 10px', fontSize:13, background:'#fff', color:'#1a1a1a', outline:'none', ...style }} {...p} />
}

export default function SprintView({ tasks, profiles, isAdmin, onTaskClick }) {
  const [sprints, setSprints] = useState([])
  const [sprintTasks, setSprintTasks] = useState({}) // sprintId -> taskId[]
  const [activeSprint, setActiveSprint] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newSprint, setNewSprint] = useState({ name:'', goal:'', start_date:'', end_date:'' })
  const [addingTask, setAddingTask] = useState(null) // sprintId
  const [saving, setSaving] = useState(false)

  const fetchSprints = useCallback(async () => {
    const { data } = await supabase.from('sprints').select('*').order('start_date', { ascending: false })
    setSprints(data || [])
    if (data?.length && !activeSprint) {
      const active = data.find(s => s.status === 'active') || data[0]
      setActiveSprint(active?.id || null)
    }
  }, [activeSprint])

  const fetchSprintTasks = useCallback(async () => {
    const { data } = await supabase.from('sprint_tasks').select('*')
    const map = {}
    ;(data || []).forEach(st => {
      if (!map[st.sprint_id]) map[st.sprint_id] = []
      map[st.sprint_id].push(st.task_id)
    })
    setSprintTasks(map)
  }, [])

  useEffect(() => {
    fetchSprints(); fetchSprintTasks()
    const c1 = supabase.channel('sprints-ch').on('postgres_changes',{event:'*',schema:'public',table:'sprints'},fetchSprints).subscribe()
    const c2 = supabase.channel('st-ch').on('postgres_changes',{event:'*',schema:'public',table:'sprint_tasks'},fetchSprintTasks).subscribe()
    return () => { supabase.removeChannel(c1); supabase.removeChannel(c2) }
  }, [fetchSprints, fetchSprintTasks])

  async function createSprint() {
    if (!newSprint.name || !newSprint.start_date || !newSprint.end_date) return
    setSaving(true)
    await supabase.from('sprints').insert({ ...newSprint, status: 'planned', created_by: (await supabase.auth.getUser()).data.user?.id })
    setNewSprint({ name:'', goal:'', start_date:'', end_date:'' })
    setShowCreate(false)
    setSaving(false)
  }

  async function updateStatus(sprintId, status) {
    await supabase.from('sprints').update({ status }).eq('id', sprintId)
  }

  async function addTaskToSprint(sprintId, taskId) {
    await supabase.from('sprint_tasks').insert({ sprint_id: sprintId, task_id: taskId })
    setAddingTask(null)
  }

  async function removeTaskFromSprint(sprintId, taskId) {
    await supabase.from('sprint_tasks').delete().eq('sprint_id', sprintId).eq('task_id', taskId)
  }

  async function deleteSprint(id) {
    await supabase.from('sprints').delete().eq('id', id)
    if (activeSprint === id) setActiveSprint(null)
  }

  const sprint = sprints.find(s => s.id === activeSprint)
  const sprintTaskIds = activeSprint ? (sprintTasks[activeSprint] || []) : []
  const sprintTaskList = tasks.filter(t => sprintTaskIds.includes(t.id))
  const availableTasks = tasks.filter(t => !sprintTaskIds.includes(t.id))

  const today = new Date().toISOString().split('T')[0]

  // Sprint stats
  const total = sprintTaskList.length
  const done = sprintTaskList.filter(t => t.status === 'done').length
  const doing = sprintTaskList.filter(t => t.status === 'doing').length
  const todo = sprintTaskList.filter(t => t.status === 'todo').length
  const pct = total ? Math.round(done / total * 100) : 0

  // Burndown: days remaining
  const daysTotal = sprint ? daysBetween(sprint.start_date, sprint.end_date) : 0
  const daysLeft = sprint ? Math.max(0, daysBetween(today, sprint.end_date)) : 0
  const daysPassed = daysTotal - daysLeft

  return (
    <div style={{ display:'flex', height:'100%', gap:0 }}>
      {/* Sprint list sidebar */}
      <div style={{ width:220, borderRight:'1px solid rgba(0,0,0,0.08)', padding:'0 0 0 0', display:'flex', flexDirection:'column', flexShrink:0 }}>
        <div style={{ padding:'16px 14px 12px', borderBottom:'1px solid rgba(0,0,0,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:13, fontWeight:600, color:'#1a1a1a' }}>Sprintler</span>
          {isAdmin && (
            <button onClick={()=>setShowCreate(v=>!v)}
              style={{ width:24, height:24, borderRadius:6, border:'none', background: showCreate?'#eef0fc':'#f0efec', cursor:'pointer', fontSize:16, color:'#5e6ad2', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
          )}
        </div>

        {showCreate && isAdmin && (
          <div style={{ padding:'12px 14px', borderBottom:'1px solid rgba(0,0,0,0.07)', background:'#fafafe' }}>
            <div style={{ marginBottom:8 }}>
              <Inp placeholder="Sprint adı" value={newSprint.name} onChange={e=>setNewSprint(f=>({...f,name:e.target.value}))} style={{ fontSize:12, padding:'5px 8px' }} />
            </div>
            <div style={{ marginBottom:8 }}>
              <Inp placeholder="Hedef (opsiyonel)" value={newSprint.goal} onChange={e=>setNewSprint(f=>({...f,goal:e.target.value}))} style={{ fontSize:12, padding:'5px 8px' }} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
              <Inp type="date" value={newSprint.start_date} onChange={e=>setNewSprint(f=>({...f,start_date:e.target.value}))} style={{ fontSize:11, padding:'4px 6px' }} />
              <Inp type="date" value={newSprint.end_date} onChange={e=>setNewSprint(f=>({...f,end_date:e.target.value}))} style={{ fontSize:11, padding:'4px 6px' }} />
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={()=>setShowCreate(false)} style={{ flex:1, padding:'5px 0', background:'none', border:'1px solid rgba(0,0,0,0.1)', borderRadius:5, fontSize:11, cursor:'pointer', color:'#6b6b6b' }}>İptal</button>
              <button onClick={createSprint} disabled={saving} style={{ flex:1, padding:'5px 0', background:'#5e6ad2', border:'none', borderRadius:5, fontSize:11, fontWeight:500, cursor:'pointer', color:'#fff' }}>Oluştur</button>
            </div>
          </div>
        )}

        <div style={{ flex:1, overflowY:'auto' }}>
          {sprints.length === 0 && (
            <div style={{ padding:'32px 14px', textAlign:'center', color:'#9b9b9b', fontSize:12 }}>
              {isAdmin ? 'Henüz sprint yok.\n+ ile ekle.' : 'Henüz sprint yok.'}
            </div>
          )}
          {sprints.map(s => {
            const meta = STATUS_META[s.status]
            const stIds = sprintTasks[s.id] || []
            const stTasks = tasks.filter(t => stIds.includes(t.id))
            const sDone = stTasks.filter(t => t.status === 'done').length
            const isActive = activeSprint === s.id
            return (
              <div key={s.id} onClick={()=>setActiveSprint(s.id)}
                style={{ padding:'10px 14px', borderBottom:'1px solid rgba(0,0,0,0.05)', cursor:'pointer', background: isActive?'#f0efec':'transparent', transition:'background 120ms' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:12, fontWeight: isActive?600:400, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{s.name}</span>
                  <span style={{ fontSize:10, fontWeight:500, padding:'1px 6px', borderRadius:99, background:meta.bg, color:meta.color, flexShrink:0, marginLeft:4 }}>{meta.label}</span>
                </div>
                <div style={{ fontSize:11, color:'#9b9b9b', marginBottom:4 }}>
                  {formatDate(s.start_date)} – {formatDate(s.end_date)}
                </div>
                {stTasks.length > 0 && (
                  <div style={{ height:3, background:'#e8e8e8', borderRadius:99, overflow:'hidden' }}>
                    <div style={{ height:'100%', background:'#22c55e', borderRadius:99, width:`${stTasks.length?Math.round(sDone/stTasks.length*100):0}%` }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Sprint detail */}
      <div style={{ flex:1, overflow:'auto', padding:20 }}>
        {!sprint ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#9b9b9b', fontSize:13 }}>
            Bir sprint seç
          </div>
        ) : (
          <>
            {/* Sprint header */}
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20 }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                  <h2 style={{ fontSize:18, fontWeight:700, letterSpacing:'-0.02em', color:'#1a1a1a' }}>{sprint.name}</h2>
                  <span style={{ fontSize:11, fontWeight:500, padding:'2px 8px', borderRadius:99, background:STATUS_META[sprint.status].bg, color:STATUS_META[sprint.status].color }}>{STATUS_META[sprint.status].label}</span>
                </div>
                {sprint.goal && <div style={{ fontSize:13, color:'#6b6b6b', marginBottom:4 }}>🎯 {sprint.goal}</div>}
                <div style={{ fontSize:12, color:'#9b9b9b' }}>
                  {formatDate(sprint.start_date)} – {formatDate(sprint.end_date)} · {daysTotal} gün
                  {sprint.status === 'active' && daysLeft > 0 && <span style={{ color:'#5e6ad2', marginLeft:6 }}>{daysLeft}g kaldı</span>}
                  {sprint.status === 'active' && daysLeft === 0 && <span style={{ color:'#e5484d', marginLeft:6 }}>Bugün son gün!</span>}
                </div>
              </div>
              {isAdmin && (
                <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                  {sprint.status === 'planned' && (
                    <button onClick={()=>updateStatus(sprint.id,'active')}
                      style={{ padding:'7px 14px', background:'#5e6ad2', color:'#fff', border:'none', borderRadius:6, fontSize:12, fontWeight:500, cursor:'pointer' }}>
                      Başlat
                    </button>
                  )}
                  {sprint.status === 'active' && (
                    <button onClick={()=>updateStatus(sprint.id,'completed')}
                      style={{ padding:'7px 14px', background:'#22c55e', color:'#fff', border:'none', borderRadius:6, fontSize:12, fontWeight:500, cursor:'pointer' }}>
                      Tamamla
                    </button>
                  )}
                  <button onClick={()=>deleteSprint(sprint.id)}
                    style={{ padding:'7px 12px', background:'none', border:'1px solid rgba(0,0,0,0.1)', borderRadius:6, fontSize:12, color:'#e5484d', cursor:'pointer' }}>
                    Sil
                  </button>
                </div>
              )}
            </div>

            {/* Stats row */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
              {[
                { label:'Toplam', val:total, color:'#1a1a1a', bg:'#f7f7f5' },
                { label:'Yapılacak', val:todo, color:'#9b9b9b', bg:'#f0efec' },
                { label:'Devam Eden', val:doing, color:'#5e6ad2', bg:'#eef0fc' },
                { label:'Tamamlandı', val:done, color:'#22c55e', bg:'#f0fdf4' },
              ].map(s => (
                <div key={s.label} style={{ background:s.bg, borderRadius:10, padding:'12px 16px', textAlign:'center' }}>
                  <div style={{ fontSize:24, fontWeight:700, color:s.color, letterSpacing:'-0.03em' }}>{s.val}</div>
                  <div style={{ fontSize:11, color:'#9b9b9b', marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Progress */}
            <div style={{ background:'#f7f7f5', borderRadius:10, padding:'14px 16px', marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <span style={{ fontSize:13, fontWeight:500, color:'#1a1a1a' }}>Sprint İlerlemesi</span>
                <span style={{ fontSize:13, fontWeight:700, color:'#22c55e' }}>{pct}%</span>
              </div>
              <div style={{ height:8, background:'#e8e8e8', borderRadius:99, overflow:'hidden', marginBottom:8 }}>
                <div style={{ height:'100%', background:'#22c55e', borderRadius:99, width:`${pct}%`, transition:'width 500ms' }} />
              </div>
              {daysTotal > 0 && (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:11, color:'#9b9b9b' }}>
                  <span>Geçen süre: {daysPassed}/{daysTotal} gün</span>
                  {sprint.status === 'active' && <span>{daysLeft > 0 ? `${daysLeft} gün kaldı` : 'Süre doldu'}</span>}
                </div>
              )}
            </div>

            {/* Task list */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <span style={{ fontSize:13, fontWeight:600, color:'#1a1a1a' }}>Görevler</span>
              <button onClick={()=>setAddingTask(addingTask?null:sprint.id)}
                style={{ padding:'5px 12px', background: addingTask?'#eef0fc':'#f0efec', border:'none', borderRadius:6, fontSize:12, fontWeight:500, cursor:'pointer', color: addingTask?'#5e6ad2':'#6b6b6b' }}>
                {addingTask ? 'İptal' : '+ Görev Ekle'}
              </button>
            </div>

            {addingTask && availableTasks.length > 0 && (
              <div style={{ background:'#fafafe', border:'1px solid rgba(0,0,0,0.08)', borderRadius:10, padding:12, marginBottom:12 }}>
                <div style={{ fontSize:11, color:'#9b9b9b', marginBottom:8 }}>Sprint'e eklenecek görevi seç:</div>
                <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:200, overflowY:'auto' }}>
                  {availableTasks.map(t => (
                    <div key={t.id} onClick={()=>addTaskToSprint(sprint.id, t.id)}
                      style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:7, border:'1px solid rgba(0,0,0,0.07)', background:'#fff', cursor:'pointer', transition:'border-color 150ms' }}
                      onMouseEnter={e=>e.currentTarget.style.borderColor='#5e6ad2'}
                      onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(0,0,0,0.07)'}>
                      <div style={{ width:7, height:7, borderRadius:'50%', background: t.priority==='high'?'#e5484d':t.priority==='mid'?'#f59e0b':'#9b9b9b', flexShrink:0 }} />
                      <span style={{ fontSize:13, flex:1, color:'#1a1a1a' }}>{t.title}</span>
                      <span style={{ fontSize:11, color:'#9b9b9b' }}>{TASK_STATUS[t.status]?.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sprintTaskList.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:'#9b9b9b', fontSize:13, border:'1px dashed rgba(0,0,0,0.1)', borderRadius:10 }}>
                Bu sprintte henüz görev yok
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {['doing','todo','done'].map(status => {
                  const group = sprintTaskList.filter(t => t.status === status)
                  if (!group.length) return null
                  const sm = TASK_STATUS[status]
                  return (
                    <div key={status}>
                      <div style={{ fontSize:11, fontWeight:600, color:'#9b9b9b', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ color:sm.color }}>●</span> {sm.label} ({group.length})
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
                        {group.map(task => {
                          const assignee = profiles.find(p => p.id === task.assignee_id)
                          return (
                            <div key={task.id}
                              style={{ display:'flex', alignItems:'center', gap:10, background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:8, padding:'9px 12px', cursor:'pointer', transition:'box-shadow 150ms' }}
                              onMouseEnter={e=>e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.06)'}
                              onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}
                              onClick={()=>onTaskClick(task)}>
                              <div style={{ width:7, height:7, borderRadius:'50%', background: task.priority==='high'?'#e5484d':task.priority==='mid'?'#f59e0b':'#9b9b9b', flexShrink:0 }} />
                              <span style={{ flex:1, fontSize:13, color: status==='done'?'#9b9b9b':'#1a1a1a', textDecoration: status==='done'?'line-through':'none', fontWeight:500 }}>{task.title}</span>
                              {task.tags?.slice(0,2).map(tag=>(
                                <span key={tag} style={{ fontSize:10, color:'#9b9b9b', background:'#f7f7f5', padding:'1px 6px', borderRadius:4, border:'1px solid rgba(0,0,0,0.07)' }}>{tag}</span>
                              ))}
                              {assignee && (
                                <div style={{ width:20, height:20, borderRadius:'50%', background:'#eef0fc', color:'#5e6ad2', fontSize:8, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                  {assignee.initials}
                                </div>
                              )}
                              <button onClick={e=>{e.stopPropagation();removeTaskFromSprint(sprint.id,task.id)}}
                                style={{ background:'none', border:'none', cursor:'pointer', color:'#c4c2bc', fontSize:16, padding:'0 2px', lineHeight:1 }}>×</button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
