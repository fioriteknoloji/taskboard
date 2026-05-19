'use client'

import { useMemo } from 'react'

const PRIORITY_META = {
  high: { label:'Acil',  color:'#e5484d', bg:'#fff0f0' },
  mid:  { label:'Orta',  color:'#f59e0b', bg:'#fffbeb' },
  low:  { label:'Düşük', color:'#9b9b9b', bg:'#f0efec' },
}

function timeAgo(ts) {
  const d=Date.now()-new Date(ts).getTime()
  if(d<86400000)return`${Math.floor(d/3600000)||1}sa önce`
  return`${Math.floor(d/86400000)}g önce`
}

// Simple bar chart with SVG
function BarChart({ data, height=120, color='#5e6ad2', label }) {
  const max = Math.max(...data.map(d=>d.value), 1)
  const barW = Math.min(40, Math.floor(560 / data.length) - 8)

  return (
    <div>
      {label && <div style={{ fontSize:12,fontWeight:600,color:'#6b6b6b',marginBottom:10,textTransform:'uppercase',letterSpacing:'0.04em' }}>{label}</div>}
      <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:height+24 }}>
        {data.map((d,i) => (
          <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flex:1 }}>
            <span style={{ fontSize:11,fontWeight:600,color: d.value>0?color:'#c4c2bc' }}>{d.value||''}</span>
            <div style={{ width:'100%', maxWidth:barW, borderRadius:'4px 4px 0 0', background: d.value>0?color:'#f0efec', height:Math.max(4, Math.round(d.value/max*height)), transition:'height 600ms ease', minHeight:d.value>0?4:0 }}/>
            <span style={{ fontSize:10,color:'#9b9b9b',textAlign:'center',lineHeight:1.2 }}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Donut chart SVG
function DonutChart({ segments, size=120, thickness=22 }) {
  const r = (size-thickness*2)/2
  const cx = size/2, cy = size/2
  const circ = 2*Math.PI*r
  const total = segments.reduce((s,g)=>s+g.value,0)||1

  let offset = 0
  const paths = segments.map((seg, i) => {
    const pct = seg.value/total
    const dash = circ*pct
    const gap  = circ*(1-pct)
    const el = (
      <circle key={i} cx={cx} cy={cy} r={r}
        fill="none" stroke={seg.color} strokeWidth={thickness}
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={-offset}
        style={{ transition:'stroke-dasharray 600ms ease', transform:'rotate(-90deg)', transformOrigin:'center' }} />
    )
    offset += dash
    return el
  })

  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0efec" strokeWidth={thickness}/>
      {paths}
    </svg>
  )
}

// Stat card
function StatCard({ label, value, sub, color='#1a1a1a', bg='#f7f7f5', icon }) {
  return (
    <div style={{ background:bg, borderRadius:12, padding:'16px 18px', border:'1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <span style={{ fontSize:12, fontWeight:500, color:'#9b9b9b' }}>{label}</span>
        {icon && <span style={{ fontSize:20 }}>{icon}</span>}
      </div>
      <div style={{ fontSize:32, fontWeight:800, color, letterSpacing:'-0.04em', lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'#9b9b9b', marginTop:6 }}>{sub}</div>}
    </div>
  )
}

export default function DashboardView({ tasks, profiles, projects, activity }) {
  const today = new Date(); today.setHours(0,0,0,0)

  const stats = useMemo(() => {
    const total    = tasks.length
    const done     = tasks.filter(t=>t.status==='done').length
    const doing    = tasks.filter(t=>t.status==='doing').length
    const todo     = tasks.filter(t=>t.status==='todo').length
    const overdue  = tasks.filter(t=>t.due_date&&t.status!=='done'&&new Date(t.due_date+'T00:00:00')<today).length
    const noDueDate= tasks.filter(t=>!t.due_date&&t.status!=='done').length
    const pct      = total ? Math.round(done/total*100) : 0

    // Per-person stats
    const byPerson = profiles.map(p => {
      const pt = tasks.filter(t=>t.assignee_id===p.id)
      return {
        ...p,
        total:   pt.length,
        done:    pt.filter(t=>t.status==='done').length,
        doing:   pt.filter(t=>t.status==='doing').length,
        todo:    pt.filter(t=>t.status==='todo').length,
        overdue: pt.filter(t=>t.due_date&&t.status!=='done'&&new Date(t.due_date+'T00:00:00')<today).length,
      }
    }).filter(p=>p.total>0).sort((a,b)=>b.total-a.total)

    // Tag frequency
    const tagCount = {}
    tasks.forEach(t=>(t.tags||[]).forEach(tag=>{ tagCount[tag]=(tagCount[tag]||0)+1 }))
    const topTags = Object.entries(tagCount).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([tag,count])=>({label:tag,value:count}))

    // Weekly completion trend (last 8 weeks)
    const weeks = Array.from({length:8},(_,i)=>{
      const end=new Date(today); end.setDate(end.getDate()-(i*7))
      const start=new Date(end); start.setDate(start.getDate()-6)
      const completed=activity.filter(a=>{
        if(a.action!=='updated'||!a.detail?.includes('Tamamlandı'))return false
        const d=new Date(a.created_at)
        return d>=start&&d<=end
      }).length
      const label=`${start.getDate()}/${start.getMonth()+1}`
      return{label,value:completed}
    }).reverse()

    // Priority distribution
    const byPriority = [
      {label:'Acil', value:tasks.filter(t=>t.priority==='high').length, color:'#e5484d'},
      {label:'Orta', value:tasks.filter(t=>t.priority==='mid').length,  color:'#f59e0b'},
      {label:'Düşük',value:tasks.filter(t=>t.priority==='low').length,  color:'#9b9b9b'},
    ]

    // Project distribution
    const byProject = projects.map(p=>({
      label:p.icon+' '+p.name.slice(0,12),
      value:tasks.filter(t=>t.project_id===p.id).length,
      color:p.color,
    })).filter(p=>p.value>0).sort((a,b)=>b.value-a.value)

    // Status donut
    const statusDonut = [
      {label:'Yapılacak', value:todo,  color:'#e8e8e8'},
      {label:'Devam',     value:doing, color:'#5e6ad2'},
      {label:'Bitti',     value:done,  color:'#22c55e'},
    ]

    return { total,done,doing,todo,overdue,noDueDate,pct,byPerson,topTags,weeks,byPriority,byProject,statusDonut }
  }, [tasks, profiles, projects, activity, today])

  return (
    <div style={{ padding:20, overflow:'auto', height:'100%' }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <div>
            <h1 style={{ fontSize:18,fontWeight:700,letterSpacing:'-0.02em',color:'#1a1a1a' }}>Dashboard</h1>
            <p style={{ fontSize:12,color:'#9b9b9b',marginTop:2 }}>{new Date().toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:24 }}>
          <StatCard label="Toplam Görev"   value={stats.total} icon="📋" />
          <StatCard label="Tamamlandı"     value={stats.done}  icon="✅" color="#22c55e" bg="#f0fdf4" sub={`${stats.pct}% tamamlandı`} />
          <StatCard label="Devam Eden"     value={stats.doing} icon="⚡" color="#5e6ad2" bg="#eef0fc" />
          <StatCard label="Yapılacak"      value={stats.todo}  icon="○"  color="#9b9b9b" />
          <StatCard label="Gecikmiş"       value={stats.overdue} icon="⚠️" color={stats.overdue>0?'#e5484d':'#9b9b9b'} bg={stats.overdue>0?'#fff0f0':'#f7f7f5'} sub={stats.overdue>0?'Acilen ilgilenilmeli':undefined} />
        </div>

        {/* Row 2: Donut + Status + Weekly trend */}
        <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:16, marginBottom:24 }}>
          {/* Status donut */}
          <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.07)', borderRadius:14, padding:20, display:'flex', flexDirection:'column', alignItems:'center' }}>
            <div style={{ fontSize:12,fontWeight:600,color:'#6b6b6b',marginBottom:16,textTransform:'uppercase',letterSpacing:'0.04em' }}>Durum Dağılımı</div>
            <div style={{ position:'relative' }}>
              <DonutChart segments={stats.statusDonut} size={120} thickness={22} />
              <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:22,fontWeight:800,color:'#1a1a1a',letterSpacing:'-0.03em' }}>{stats.pct}%</span>
                <span style={{ fontSize:10,color:'#9b9b9b' }}>bitti</span>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:16, width:'100%' }}>
              {stats.statusDonut.map(s=>(
                <div key={s.label} style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:8,height:8,borderRadius:'50%',background:s.color }}/>
                    <span style={{ fontSize:12,color:'#6b6b6b' }}>{s.label}</span>
                  </div>
                  <span style={{ fontSize:12,fontWeight:600,color:'#1a1a1a' }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly trend */}
          <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.07)', borderRadius:14, padding:20 }}>
            <BarChart data={stats.weeks} height={100} color='#5e6ad2' label="Haftalık Tamamlanma Trendi" />
          </div>
        </div>

        {/* Row 3: Per person table */}
        <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.07)', borderRadius:14, padding:20, marginBottom:24 }}>
          <div style={{ fontSize:12,fontWeight:600,color:'#6b6b6b',marginBottom:16,textTransform:'uppercase',letterSpacing:'0.04em' }}>Kişi Bazlı Performans</div>
          {stats.byPerson.length===0 ? (
            <div style={{ textAlign:'center',padding:'24px 0',color:'#9b9b9b',fontSize:13 }}>Atanmış görev yok</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {stats.byPerson.map(p => {
                const pct = p.total ? Math.round(p.done/p.total*100) : 0
                return (
                  <div key={p.id} style={{ display:'flex', alignItems:'center', gap:14 }}>
                    {/* Avatar */}
                    <div style={{ width:32,height:32,borderRadius:'50%',background:'#eef0fc',color:'#5e6ad2',fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                      {p.initials}
                    </div>
                    {/* Name */}
                    <div style={{ width:120, flexShrink:0 }}>
                      <div style={{ fontSize:13,fontWeight:500,color:'#1a1a1a' }}>{p.full_name}</div>
                      <div style={{ fontSize:11,color:'#9b9b9b' }}>{p.total} görev</div>
                    </div>
                    {/* Progress bar */}
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', gap:2, height:8, borderRadius:99, overflow:'hidden' }}>
                        <div style={{ width:`${p.total?p.done/p.total*100:0}%`, background:'#22c55e', transition:'width 500ms' }}/>
                        <div style={{ width:`${p.total?p.doing/p.total*100:0}%`, background:'#5e6ad2', transition:'width 500ms' }}/>
                        <div style={{ flex:1, background:'#f0efec' }}/>
                      </div>
                    </div>
                    {/* Stats */}
                    <div style={{ display:'flex', gap:12, flexShrink:0 }}>
                      {[
                        {label:'Bitti',  val:p.done,  color:'#22c55e'},
                        {label:'Devam',  val:p.doing, color:'#5e6ad2'},
                        {label:'Bekl.', val:p.todo,  color:'#9b9b9b'},
                        ...(p.overdue>0?[{label:'Gecik.',val:p.overdue,color:'#e5484d'}]:[]),
                      ].map(s=>(
                        <div key={s.label} style={{ textAlign:'center', minWidth:36 }}>
                          <div style={{ fontSize:15,fontWeight:700,color:s.color,letterSpacing:'-0.02em' }}>{s.val}</div>
                          <div style={{ fontSize:9,color:'#9b9b9b' }}>{s.label}</div>
                        </div>
                      ))}
                      <div style={{ textAlign:'center', minWidth:36 }}>
                        <div style={{ fontSize:15,fontWeight:700,color:'#1a1a1a',letterSpacing:'-0.02em' }}>{pct}%</div>
                        <div style={{ fontSize:9,color:'#9b9b9b' }}>Oran</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Row 4: Tags + Priority + Projects */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 180px 200px', gap:16, marginBottom:24 }}>
          {/* Top tags */}
          <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.07)', borderRadius:14, padding:20 }}>
            <BarChart data={stats.topTags.length?stats.topTags:[{label:'—',value:0}]} height={80} color='#8b5cf6' label="En Çok Kullanılan Etiketler" />
          </div>

          {/* Priority distribution */}
          <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.07)', borderRadius:14, padding:20 }}>
            <div style={{ fontSize:12,fontWeight:600,color:'#6b6b6b',marginBottom:12,textTransform:'uppercase',letterSpacing:'0.04em' }}>Öncelik</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {stats.byPriority.map(p=>(
                <div key={p.label}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:12,color:'#6b6b6b' }}>{p.label}</span>
                    <span style={{ fontSize:12,fontWeight:600,color:p.color }}>{p.value}</span>
                  </div>
                  <div style={{ height:5,background:'#f0efec',borderRadius:99,overflow:'hidden' }}>
                    <div style={{ height:'100%',background:p.color,borderRadius:99,width:`${stats.total?p.value/stats.total*100:0}%`,transition:'width 500ms' }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Project distribution */}
          <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.07)', borderRadius:14, padding:20 }}>
            <div style={{ fontSize:12,fontWeight:600,color:'#6b6b6b',marginBottom:12,textTransform:'uppercase',letterSpacing:'0.04em' }}>Projeler</div>
            {stats.byProject.length===0 ? <div style={{ fontSize:12,color:'#9b9b9b',textAlign:'center',paddingTop:16 }}>Proje yok</div> : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {stats.byProject.slice(0,6).map(p=>(
                  <div key={p.label}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                      <span style={{ fontSize:11,color:'#6b6b6b',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{p.label}</span>
                      <span style={{ fontSize:11,fontWeight:600,color:p.color,flexShrink:0,marginLeft:4 }}>{p.value}</span>
                    </div>
                    <div style={{ height:4,background:'#f0efec',borderRadius:99,overflow:'hidden' }}>
                      <div style={{ height:'100%',background:p.color,borderRadius:99,width:`${stats.total?p.value/stats.total*100:0}%`,transition:'width 500ms' }}/>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.07)', borderRadius:14, padding:20 }}>
          <div style={{ fontSize:12,fontWeight:600,color:'#6b6b6b',marginBottom:14,textTransform:'uppercase',letterSpacing:'0.04em' }}>Son Aktiviteler</div>
          {activity.slice(0,8).map(a=>{
            const iconMap={created:'✦',updated:'✎',moved:'→',note:'✉',deleted:'✕'}
            const bgMap={created:'#dcfce7',updated:'#fef3c7',moved:'#dbeafe',note:'#ede9fe',deleted:'#fee2e2'}
            return(
              <div key={a.id} style={{ display:'flex',gap:10,alignItems:'flex-start',paddingBottom:10,marginBottom:10,borderBottom:'1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ width:24,height:24,borderRadius:'50%',background:bgMap[a.action]||'#f0efec',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:11 }}>{iconMap[a.action]||'·'}</div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:12,fontWeight:500,color:'#1a1a1a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{a.task_title}</div>
                  <div style={{ fontSize:11,color:'#6b6b6b' }}>{a.detail}</div>
                </div>
                <div style={{ fontSize:10,color:'#9b9b9b',whiteSpace:'nowrap' }}>{timeAgo(a.created_at)}</div>
              </div>
            )
          })}
          {activity.length===0&&<div style={{ textAlign:'center',padding:'20px 0',color:'#9b9b9b',fontSize:13 }}>Henüz aktivite yok</div>}
        </div>

      </div>
    </div>
  )
}
