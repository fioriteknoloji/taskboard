'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const PROJECT_COLORS = [
  '#5e6ad2','#8b5cf6','#22c55e','#e5484d','#f59e0b',
  '#06b6d4','#ec4899','#84cc16','#f97316','#9b9b9b',
]
const PROJECT_ICONS = ['📁','🚀','🎨','⚙️','💡','🔥','📊','🛡️','🌐','📱','🧩','🏆']

const COLUMNS = [
  { id:'todo',  label:'Yapılacak',  color:'#9b9b9b', icon:'○' },
  { id:'doing', label:'Devam Eden', color:'#5e6ad2', icon:'◑' },
  { id:'done',  label:'Tamamlandı',color:'#22c55e', icon:'●' },
]

const PRIORITY_DOT = { high:'#e5484d', mid:'#f59e0b', low:'#9b9b9b' }

function timeAgo(ts) {
  const d = Date.now() - new Date(ts).getTime()
  if (d < 3600000) return `${Math.floor(d/60000)||1}dk önce`
  if (d < 86400000) return `${Math.floor(d/3600000)}sa önce`
  return `${Math.floor(d/86400000)}g önce`
}

function Inp({ style, ...p }) {
  return <input onFocus={e=>e.target.style.borderColor='#5e6ad2'} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,0.12)'}
    style={{ width:'100%', border:'1px solid rgba(0,0,0,0.12)', borderRadius:6, padding:'7px 10px', fontSize:13, background:'#fff', color:'#1a1a1a', outline:'none', transition:'border-color 150ms', ...style }} {...p} />
}

function Avatar({ initials='?', size=20 }) {
  const colors=[['#dbeafe','#1d4ed8'],['#fce7f3','#be185d'],['#dcfce7','#15803d'],['#fef3c7','#b45309'],['#ede9fe','#7c3aed'],['#fee2e2','#b91c1c']]
  let h=0; for(let c of initials)h=(h*31+c.charCodeAt(0))%colors.length
  const[bg,fg]=colors[h]
  return <div style={{ width:size,height:size,borderRadius:'50%',background:bg,color:fg,fontSize:size*.38,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>{initials}</div>
}

export default function ProjectsView({ tasks, profiles, isAdmin, onTaskClick, subtaskCounts }) {
  const [projects, setProjects] = useState([])
  const [activeProject, setActiveProject] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [newProject, setNewProject] = useState({ name:'', description:'', color:PROJECT_COLORS[0], icon:PROJECT_ICONS[0] })
  const [saving, setSaving] = useState(false)
  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  const fetchProjects = useCallback(async () => {
    const { data } = await supabase.from('projects').select('*').order('created_at')
    setProjects(data || [])
    if (!activeProject && data?.length) setActiveProject(data[0].id)
  }, [activeProject])

  useEffect(() => {
    fetchProjects()
    const ch = supabase.channel('proj-ch')
      .on('postgres_changes',{event:'*',schema:'public',table:'projects'},fetchProjects)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [fetchProjects])

  async function createProject() {
    if (!newProject.name.trim()) return
    setSaving(true)
    const { data } = await supabase.from('projects').insert({ ...newProject, name:newProject.name.trim() }).select().single()
    if (data) setActiveProject(data.id)
    setNewProject({ name:'', description:'', color:PROJECT_COLORS[0], icon:PROJECT_ICONS[0] })
    setShowCreate(false)
    setSaving(false)
  }

  async function updateProject(id, updates) {
    await supabase.from('projects').update({ ...updates, updated_at:new Date().toISOString() }).eq('id', id)
    setEditingProject(null)
  }

  async function archiveProject(id) {
    await supabase.from('projects').update({ status:'archived' }).eq('id', id)
    if (activeProject === id) setActiveProject(projects.find(p=>p.id!==id&&p.status==='active')?.id||null)
  }

  async function moveTaskToStatus(taskId, status) {
    await supabase.from('tasks').update({ status, updated_at:new Date().toISOString() }).eq('id', taskId)
  }

  async function handleDrop(targetStatus) {
    if (!dragging) return
    const task = tasks.find(t => t.id === dragging)
    if (task && task.status !== targetStatus) await moveTaskToStatus(dragging, targetStatus)
    setDragging(null); setDragOver(null)
  }

  const project = projects.find(p => p.id === activeProject)
  const projectTasks = activeProject ? tasks.filter(t => t.project_id === activeProject) : tasks.filter(t => !t.project_id)
  const activeProjects = projects.filter(p => p.status === 'active')
  const archivedProjects = projects.filter(p => p.status === 'archived')

  // Project stats
  const projectStats = projects.map(p => {
    const pt = tasks.filter(t => t.project_id === p.id)
    return { ...p, total:pt.length, done:pt.filter(t=>t.status==='done').length, doing:pt.filter(t=>t.status==='doing').length }
  })

  return (
    <div style={{ display:'flex', height:'100%', gap:0 }}>

      {/* Project sidebar */}
      <div style={{ width:230, borderRight:'1px solid rgba(0,0,0,0.08)', display:'flex', flexDirection:'column', flexShrink:0, background:'#fafafa' }}>
        <div style={{ padding:'16px 14px 12px', borderBottom:'1px solid rgba(0,0,0,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:13, fontWeight:600, color:'#1a1a1a' }}>Projeler</span>
          {isAdmin && (
            <button onClick={()=>setShowCreate(v=>!v)}
              style={{ width:24,height:24,borderRadius:6,border:'none',background:showCreate?'#eef0fc':'#f0efec',cursor:'pointer',fontSize:16,color:'#5e6ad2',display:'flex',alignItems:'center',justifyContent:'center' }}>+</button>
          )}
        </div>

        {/* New project form */}
        {showCreate && isAdmin && (
          <div style={{ padding:'12px 14px', borderBottom:'1px solid rgba(0,0,0,0.07)', background:'#fff' }}>
            <div style={{ marginBottom:8 }}>
              <Inp placeholder="Proje adı" value={newProject.name} onChange={e=>setNewProject(f=>({...f,name:e.target.value}))} style={{ fontSize:12,padding:'5px 8px' }} />
            </div>
            <div style={{ marginBottom:8 }}>
              <Inp placeholder="Açıklama (opsiyonel)" value={newProject.description} onChange={e=>setNewProject(f=>({...f,description:e.target.value}))} style={{ fontSize:12,padding:'5px 8px' }} />
            </div>
            {/* Icon picker */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
              {PROJECT_ICONS.map(icon=>(
                <button key={icon} onClick={()=>setNewProject(f=>({...f,icon}))}
                  style={{ width:28,height:28,borderRadius:6,border:`1.5px solid ${newProject.icon===icon?'#5e6ad2':'transparent'}`,background:newProject.icon===icon?'#eef0fc':'#f0efec',cursor:'pointer',fontSize:14 }}>
                  {icon}
                </button>
              ))}
            </div>
            {/* Color picker */}
            <div style={{ display:'flex', gap:4, marginBottom:10, flexWrap:'wrap' }}>
              {PROJECT_COLORS.map(c=>(
                <div key={c} onClick={()=>setNewProject(f=>({...f,color:c}))}
                  style={{ width:20,height:20,borderRadius:'50%',background:c,cursor:'pointer',border:newProject.color===c?'2.5px solid #1a1a1a':'2px solid transparent',transition:'border 120ms' }}/>
              ))}
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={()=>setShowCreate(false)} style={{ flex:1,padding:'5px 0',background:'none',border:'1px solid rgba(0,0,0,0.1)',borderRadius:5,fontSize:11,cursor:'pointer',color:'#6b6b6b' }}>İptal</button>
              <button onClick={createProject} disabled={saving||!newProject.name.trim()}
                style={{ flex:1,padding:'5px 0',background:newProject.name.trim()?'#5e6ad2':'#c4c2bc',border:'none',borderRadius:5,fontSize:11,fontWeight:500,cursor:newProject.name.trim()?'pointer':'default',color:'#fff' }}>
                {saving?'…':'Oluştur'}
              </button>
            </div>
          </div>
        )}

        {/* Active projects */}
        <div style={{ flex:1, overflowY:'auto', padding:'8px 8px 0' }}>
          {activeProjects.map(p => {
            const stats = projectStats.find(s=>s.id===p.id)
            const isActive = activeProject === p.id
            const pct = stats?.total ? Math.round(stats.done/stats.total*100) : 0
            return (
              <div key={p.id} onClick={()=>setActiveProject(p.id)}
                style={{ padding:'10px 10px', borderRadius:8, cursor:'pointer', marginBottom:4, background:isActive?'#fff':'transparent', border:`1px solid ${isActive?'rgba(0,0,0,0.08)':'transparent'}`, boxShadow:isActive?'0 1px 4px rgba(0,0,0,0.06)':'none', transition:'all 150ms' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:isActive&&stats?.total>0?6:0 }}>
                  <span style={{ fontSize:16 }}>{p.icon}</span>
                  <span style={{ fontSize:12, fontWeight:isActive?600:400, color:isActive?'#1a1a1a':'#444', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                  <span style={{ fontSize:10, color:'#9b9b9b', flexShrink:0 }}>{stats?.total||0}</span>
                </div>
                {isActive && stats?.total > 0 && (
                  <div style={{ height:3, background:'#f0efec', borderRadius:99, overflow:'hidden', marginLeft:24 }}>
                    <div style={{ height:'100%', background:p.color, borderRadius:99, width:`${pct}%`, transition:'width 400ms' }}/>
                  </div>
                )}
              </div>
            )
          })}

          {archivedProjects.length > 0 && (
            <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize:10,fontWeight:700,color:'#9b9b9b',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6,paddingLeft:10 }}>Arşiv</div>
              {archivedProjects.map(p=>(
                <div key={p.id} onClick={()=>setActiveProject(p.id)}
                  style={{ padding:'8px 10px',borderRadius:8,cursor:'pointer',marginBottom:2,opacity:0.5,display:'flex',alignItems:'center',gap:8 }}>
                  <span style={{ fontSize:14 }}>{p.icon}</span>
                  <span style={{ fontSize:12,color:'#6b6b6b' }}>{p.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Project detail — kanban */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {!project ? (
          <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#9b9b9b',fontSize:13 }}>Bir proje seç</div>
        ) : (
          <>
            {/* Project header */}
            <div style={{ padding:'16px 18px', borderBottom:'1px solid rgba(0,0,0,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#fff', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:32,height:32,borderRadius:8,background:project.color+'22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18 }}>{project.icon}</div>
                <div>
                  <div style={{ fontSize:15,fontWeight:700,letterSpacing:'-0.02em',color:'#1a1a1a' }}>{project.name}</div>
                  {project.description&&<div style={{ fontSize:12,color:'#9b9b9b',marginTop:1 }}>{project.description}</div>}
                </div>
                <div style={{ display:'flex', gap:8, marginLeft:8 }}>
                  {[
                    { label:'Toplam', val:projectTasks.length, color:'#1a1a1a' },
                    { label:'Devam', val:projectTasks.filter(t=>t.status==='doing').length, color:'#5e6ad2' },
                    { label:'Bitti', val:projectTasks.filter(t=>t.status==='done').length, color:'#22c55e' },
                  ].map(s=>(
                    <div key={s.label} style={{ padding:'3px 10px',borderRadius:99,background:'#f0efec',fontSize:11 }}>
                      <span style={{ fontWeight:600,color:s.color }}>{s.val}</span>
                      <span style={{ color:'#9b9b9b',marginLeft:4 }}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {isAdmin && (
                <div style={{ display:'flex', gap:8 }}>
                  {editingProject ? (
                    <EditProjectForm project={project} onSave={updates=>updateProject(project.id,updates)} onCancel={()=>setEditingProject(null)} />
                  ) : (
                    <>
                      <button onClick={()=>setEditingProject(project)} style={{ padding:'6px 12px',background:'none',border:'1px solid rgba(0,0,0,0.1)',borderRadius:6,fontSize:12,cursor:'pointer',color:'#6b6b6b' }}>Düzenle</button>
                      <button onClick={()=>archiveProject(project.id)} style={{ padding:'6px 12px',background:'none',border:'1px solid rgba(0,0,0,0.1)',borderRadius:6,fontSize:12,cursor:'pointer',color:'#9b9b9b' }}>Arşivle</button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Kanban columns */}
            <div style={{ flex:1, overflow:'auto', padding:16 }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, alignItems:'start', minHeight:'100%' }}>
                {COLUMNS.map(col=>{
                  const colTasks = projectTasks.filter(t=>t.status===col.id)
                  const over = dragOver === col.id
                  return (
                    <div key={col.id}
                      onDragOver={e=>{e.preventDefault();setDragOver(col.id)}}
                      onDragLeave={()=>setDragOver(null)}
                      onDrop={()=>handleDrop(col.id)}
                      style={{ background:over?'#eef0fc':'#f7f7f5',borderRadius:10,padding:10,border:`1.5px solid ${over?'#5e6ad2':'transparent'}`,transition:'all 150ms',minHeight:400 }}>

                      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,padding:'2px 2px 8px',borderBottom:'1px solid rgba(0,0,0,0.07)' }}>
                        <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                          <span style={{ color:col.color,fontSize:12 }}>{col.icon}</span>
                          <span style={{ fontSize:11,fontWeight:600,color:'#6b6b6b' }}>{col.label}</span>
                        </div>
                        <span style={{ fontSize:10,fontWeight:500,color:'#9b9b9b',background:'#fff',padding:'1px 7px',borderRadius:99,border:'1px solid rgba(0,0,0,0.08)' }}>{colTasks.length}</span>
                      </div>

                      <div style={{ display:'flex',flexDirection:'column',gap:7 }}>
                        {colTasks.length===0&&<div style={{ textAlign:'center',padding:'24px 0',fontSize:12,color:'#9b9b9b',border:'1px dashed rgba(0,0,0,0.1)',borderRadius:7 }}>Kart yok</div>}
                        {colTasks.map(task=>{
                          const assignee=profiles.find(p=>p.id===task.assignee_id)
                          const sc=subtaskCounts?.[task.id]
                          return(
                            <div key={task.id}
                              draggable onDragStart={()=>setDragging(task.id)} onDragEnd={()=>{setDragging(null);setDragOver(null)}}
                              onClick={()=>onTaskClick(task)}
                              style={{ background:'#fff',borderRadius:8,padding:'10px 12px',cursor:'pointer',opacity:dragging===task.id?0.3:1,border:'1px solid rgba(0,0,0,0.07)',boxShadow:'0 1px 2px rgba(0,0,0,0.03)',transition:'all 150ms' }}
                              onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(0,0,0,0.16)';e.currentTarget.style.boxShadow='0 2px 6px rgba(0,0,0,0.07)'}}
                              onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(0,0,0,0.07)';e.currentTarget.style.boxShadow='0 1px 2px rgba(0,0,0,0.03)'}}>
                              <div style={{ display:'flex',alignItems:'flex-start',gap:7,marginBottom:6 }}>
                                <div style={{ width:7,height:7,borderRadius:'50%',background:PRIORITY_DOT[task.priority]||'#9b9b9b',flexShrink:0,marginTop:4 }}/>
                                <span style={{ fontSize:12,fontWeight:500,color:'#1a1a1a',lineHeight:1.4,flex:1 }}>{task.title}</span>
                                {task.recurrence&&<span style={{ fontSize:10 }}>🔁</span>}
                              </div>
                              {task.tags?.length>0&&(
                                <div style={{ display:'flex',flexWrap:'wrap',gap:3,marginLeft:14,marginBottom:6 }}>
                                  {task.tags.slice(0,3).map(tag=><span key={tag} style={{ fontSize:10,color:'#9b9b9b',background:'#f7f7f5',padding:'0px 6px',borderRadius:4,border:'1px solid rgba(0,0,0,0.07)' }}>{tag}</span>)}
                                </div>
                              )}
                              {sc&&sc.total>0&&(
                                <div style={{ marginLeft:14,marginBottom:6 }}>
                                  <div style={{ height:2,background:'#f0efec',borderRadius:99,overflow:'hidden' }}>
                                    <div style={{ height:'100%',background:'#22c55e',borderRadius:99,width:`${Math.round(sc.done/sc.total*100)}%` }}/>
                                  </div>
                                  <span style={{ fontSize:9,color:'#9b9b9b' }}>{sc.done}/{sc.total}</span>
                                </div>
                              )}
                              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginLeft:14 }}>
                                {assignee?<Avatar initials={assignee.initials} size={18}/>:<div style={{ width:18,height:18 }}/>}
                                <span style={{ fontSize:10,color:'#9b9b9b' }}>{timeAgo(task.created_at)}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function EditProjectForm({ project, onSave, onCancel }) {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description||'')
  const [color, setColor] = useState(project.color)
  const [icon, setIcon] = useState(project.icon)

  return (
    <div style={{ display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' }}>
      <input value={name} onChange={e=>setName(e.target.value)}
        style={{ border:'1px solid #5e6ad2',borderRadius:6,padding:'4px 8px',fontSize:13,outline:'none',width:140 }}/>
      <input value={description} onChange={e=>setDescription(e.target.value)}
        style={{ border:'1px solid rgba(0,0,0,0.12)',borderRadius:6,padding:'4px 8px',fontSize:12,outline:'none',width:180 }} placeholder="Açıklama"/>
      <div style={{ display:'flex',gap:3 }}>
        {PROJECT_ICONS.slice(0,6).map(ic=><button key={ic} onClick={()=>setIcon(ic)} style={{ width:24,height:24,borderRadius:4,border:`1.5px solid ${icon===ic?'#5e6ad2':'transparent'}`,background:icon===ic?'#eef0fc':'#f0efec',cursor:'pointer',fontSize:13 }}>{ic}</button>)}
      </div>
      <div style={{ display:'flex',gap:3 }}>
        {PROJECT_COLORS.slice(0,6).map(c=><div key={c} onClick={()=>setColor(c)} style={{ width:16,height:16,borderRadius:'50%',background:c,cursor:'pointer',border:color===c?'2px solid #1a1a1a':'2px solid transparent' }}/>)}
      </div>
      <button onClick={()=>onSave({name:name.trim(),description:description.trim(),color,icon})} style={{ padding:'5px 12px',background:'#5e6ad2',color:'#fff',border:'none',borderRadius:6,fontSize:12,cursor:'pointer',fontWeight:500 }}>Kaydet</button>
      <button onClick={onCancel} style={{ padding:'5px 10px',background:'none',border:'1px solid rgba(0,0,0,0.1)',borderRadius:6,fontSize:12,cursor:'pointer',color:'#6b6b6b' }}>İptal</button>
    </div>
  )
}
