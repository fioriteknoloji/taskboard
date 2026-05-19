'use client'

import { useMemo } from 'react'

const PRIORITY_META = {
  high: { label:'Acil',  color:'#e5484d', bg:'#fff0f0' },
  mid:  { label:'Orta',  color:'#f59e0b', bg:'#fffbeb' },
  low:  { label:'Düşük', color:'#9b9b9b', bg:'#f0efec' },
}

function dueDateStatus(d, status) {
  if (!d || status==='done') return null
  const today=new Date(); today.setHours(0,0,0,0)
  const due=new Date(d+'T00:00:00')
  const diff=Math.floor((due-today)/86400000)
  if (diff<0) return { label:`${Math.abs(diff)}g gecikti`, color:'#e5484d', bg:'#fff0f0' }
  if (diff===0) return { label:'Bugün', color:'#d97706', bg:'#fffbeb' }
  if (diff<=2) return { label:`${diff}g kaldı`, color:'#d97706', bg:'#fffbeb' }
  return null
}

function getLoadLevel(taskCount, overdueCount) {
  if (overdueCount>0) return { label:'Kritik', color:'#e5484d', bg:'#fff0f0', icon:'🔴' }
  if (taskCount===0)  return { label:'Boşta',  color:'#22c55e', bg:'#f0fdf4', icon:'🟢' }
  if (taskCount<=2)   return { label:'Uygun',  color:'#22c55e', bg:'#f0fdf4', icon:'🟢' }
  if (taskCount<=4)   return { label:'Dengeli',color:'#5e6ad2', bg:'#eef0fc', icon:'🔵' }
  if (taskCount<=6)   return { label:'Yoğun',  color:'#f59e0b', bg:'#fffbeb', icon:'🟡' }
  return                     { label:'Aşırı',  color:'#e5484d', bg:'#fff0f0', icon:'🔴' }
}

export default function WorkloadView({ tasks, profiles, onTaskClick }) {
  const today = new Date(); today.setHours(0,0,0,0)

  const personData = useMemo(() => {
    return profiles.map(p => {
      const all     = tasks.filter(t=>t.assignee_id===p.id)
      const active  = all.filter(t=>t.status!=='done')
      const doing   = all.filter(t=>t.status==='doing')
      const todo    = all.filter(t=>t.status==='todo')
      const done    = all.filter(t=>t.status==='done')
      const overdue = active.filter(t=>t.due_date&&new Date(t.due_date+'T00:00:00')<today)
      const load    = getLoadLevel(active.length, overdue.length)
      const doneThisWeek = done.filter(t=>{
        const d=new Date(t.updated_at||t.created_at)
        return Date.now()-d.getTime()<7*86400000
      })
      return { ...p, all, active, doing, todo, done, overdue, load, doneThisWeek }
    }).sort((a,b)=>{
      // Critical first, then by active count
      const order={ '🔴':0,'🟡':1,'🔵':2,'🟢':3 }
      const ao=order[a.load.icon]??4, bo=order[b.load.icon]??4
      if(ao!==bo) return ao-bo
      return b.active.length-a.active.length
    })
  }, [tasks, profiles, today])

  const maxActive = Math.max(...personData.map(p=>p.active.length), 1)

  return (
    <div style={{ padding:20, overflow:'auto', height:'100%' }}>
      <div style={{ maxWidth:1000, margin:'0 auto' }}>

        <div style={{ marginBottom:24 }}>
          <h1 style={{ fontSize:18,fontWeight:700,letterSpacing:'-0.02em',color:'#1a1a1a',marginBottom:4 }}>İş Yükü Görünümü</h1>
          <p style={{ fontSize:12,color:'#9b9b9b' }}>Ekip üyelerinin mevcut iş yükü ve görev dağılımı</p>
        </div>

        {/* Legend */}
        <div style={{ display:'flex', gap:16, marginBottom:20, flexWrap:'wrap' }}>
          {[
            {icon:'🟢',label:'Boşta / Uygun (0-2 görev)'},
            {icon:'🔵',label:'Dengeli (3-4 görev)'},
            {icon:'🟡',label:'Yoğun (5-6 görev)'},
            {icon:'🔴',label:'Aşırı yüklü / Gecikmiş'},
          ].map(l=>(
            <div key={l.icon} style={{ display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#6b6b6b' }}>
              <span>{l.icon}</span><span>{l.label}</span>
            </div>
          ))}
        </div>

        {/* Summary bar */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:24 }}>
          {[
            { label:'Toplam aktif görev', val:tasks.filter(t=>t.status!=='done').length, color:'#1a1a1a' },
            { label:'Boşta üye', val:personData.filter(p=>p.active.length===0).length, color:'#22c55e' },
            { label:'Aşırı yüklü', val:personData.filter(p=>p.active.length>6||p.overdue.length>0).length, color:'#e5484d' },
            { label:'Gecikmiş görev', val:tasks.filter(t=>t.due_date&&t.status!=='done'&&new Date(t.due_date+'T00:00:00')<today).length, color:'#e5484d' },
          ].map(s=>(
            <div key={s.label} style={{ background:'#fff',borderRadius:10,padding:'12px 16px',border:'1px solid rgba(0,0,0,0.07)' }}>
              <div style={{ fontSize:24,fontWeight:800,color:s.color,letterSpacing:'-0.03em' }}>{s.val}</div>
              <div style={{ fontSize:11,color:'#9b9b9b',marginTop:3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Person cards */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {personData.map(person => (
            <div key={person.id} style={{ background:'#fff', border:`1px solid ${person.load.color}22`, borderLeft:`3px solid ${person.load.color}`, borderRadius:12, padding:16, boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
              {/* Person header */}
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                <div style={{ width:36,height:36,borderRadius:'50%',background:'#eef0fc',color:'#5e6ad2',fontSize:14,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                  {person.initials}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:14,fontWeight:600,color:'#1a1a1a' }}>{person.full_name}</span>
                    <span style={{ fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:99,background:person.load.bg,color:person.load.color }}>
                      {person.load.icon} {person.load.label}
                    </span>
                  </div>
                  <div style={{ fontSize:11,color:'#9b9b9b',marginTop:2 }}>
                    {person.active.length} aktif · {person.done.length} tamamlandı · {person.doneThisWeek.length} bu hafta bitti
                    {person.overdue.length>0 && <span style={{ color:'#e5484d',marginLeft:8,fontWeight:500 }}>⚠ {person.overdue.length} gecikmiş</span>}
                  </div>
                </div>

                {/* Load bar */}
                <div style={{ width:200, flexShrink:0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:10,color:'#9b9b9b' }}>İş yükü</span>
                    <span style={{ fontSize:10,fontWeight:600,color:person.load.color }}>{person.active.length} aktif</span>
                  </div>
                  <div style={{ height:8, background:'#f0efec', borderRadius:99, overflow:'hidden' }}>
                    <div style={{ height:'100%', borderRadius:99, background:person.load.color, width:`${Math.min(100,person.active.length/maxActive*100)}%`, transition:'width 500ms ease' }}/>
                  </div>
                </div>
              </div>

              {/* Active tasks */}
              {person.active.length > 0 ? (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {/* Doing first */}
                  {[...person.doing, ...person.todo].slice(0,6).map(task=>{
                    const due=dueDateStatus(task.due_date,task.status)
                    const pm=PRIORITY_META[task.priority]||PRIORITY_META.mid
                    return(
                      <div key={task.id} onClick={()=>onTaskClick(task)}
                        style={{ display:'flex',alignItems:'center',gap:10,padding:'7px 10px',borderRadius:7,background:'#f7f7f5',cursor:'pointer',transition:'background 120ms' }}
                        onMouseEnter={e=>e.currentTarget.style.background='#f0efec'}
                        onMouseLeave={e=>e.currentTarget.style.background='#f7f7f5'}>
                        <div style={{ width:7,height:7,borderRadius:'50%',background:pm.color,flexShrink:0 }}/>
                        <div style={{ width:6,height:6,borderRadius:'50%',background:task.status==='doing'?'#5e6ad2':'#e8e8e8',flexShrink:0 }}/>
                        <span style={{ flex:1,fontSize:12,color:'#1a1a1a',fontWeight:task.status==='doing'?500:400,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{task.title}</span>
                        <span style={{ fontSize:10,padding:'1px 7px',borderRadius:99,background:pm.bg,color:pm.color,flexShrink:0 }}>{pm.label}</span>
                        {due&&<span style={{ fontSize:10,fontWeight:500,color:due.color,background:due.bg,padding:'1px 7px',borderRadius:99,flexShrink:0 }}>{due.label}</span>}
                        <span style={{ fontSize:10,color:task.status==='doing'?'#5e6ad2':'#9b9b9b',flexShrink:0,fontWeight:task.status==='doing'?500:400 }}>
                          {task.status==='doing'?'Devam Ediyor':'Bekliyor'}
                        </span>
                      </div>
                    )
                  })}
                  {person.active.length>6&&(
                    <div style={{ textAlign:'center',fontSize:11,color:'#9b9b9b',paddingTop:2 }}>+{person.active.length-6} görev daha</div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign:'center',padding:'12px 0',fontSize:12,color:'#9b9b9b',border:'1px dashed rgba(0,0,0,0.1)',borderRadius:7 }}>
                  Aktif görev yok — yeni bir görev atayabilirsin
                </div>
              )}
            </div>
          ))}

          {personData.length===0&&(
            <div style={{ textAlign:'center',padding:'48px 0',color:'#9b9b9b',fontSize:13 }}>
              Profil bulunamadı
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
