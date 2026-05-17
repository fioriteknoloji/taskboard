'use client'

import { useState, useRef, useCallback } from 'react'

const PRIORITY = {
  low:  { dot: '#9b9b9b', bg: '#f0efec', border: '#d4d2cc', color: '#6b6b6b' },
  mid:  { dot: '#f59e0b', bg: '#fffbeb', border: '#fde68a', color: '#854d0e' },
  high: { dot: '#e5484d', bg: '#fff0f0', border: '#fecaca', color: '#9f1239' },
}

const AVATAR_COLORS = [
  ['#dbeafe','#1d4ed8'],['#fce7f3','#be185d'],['#dcfce7','#15803d'],
  ['#fef3c7','#b45309'],['#ede9fe','#7c3aed'],['#fee2e2','#b91c1c'],
  ['#e0f2fe','#0369a1'],['#fdf4ff','#7e22ce'],
]

function strColor(str='') {
  let h = 0; for (let c of str) h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length
  return AVATAR_COLORS[h]
}

function Avatar({ initials='?', size=18 }) {
  const [bg, fg] = strColor(initials)
  return <div style={{ width:size, height:size, borderRadius:'50%', background:bg, color:fg, fontSize:size*0.38, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{initials}</div>
}

function toYMD(date) {
  return date.toISOString().split('T')[0]
}

function parseYMD(str) {
  return str ? new Date(str + 'T00:00:00') : null
}

function addDays(date, n) {
  const d = new Date(date); d.setDate(d.getDate() + n); return d
}

function sameDay(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
}

// Get tasks that span or land on a given day
function getTasksForDay(tasks, day) {
  const dayStr = toYMD(day)
  return tasks.filter(t => {
    const start = t.start_date || t.due_date
    const end = t.due_date || t.start_date
    if (!start && !end) return false
    if (start && end) {
      return dayStr >= Math.min(start, end) && dayStr <= Math.max(start, end)
    }
    return start === dayStr || end === dayStr
  })
}

function TaskChip({ task, profiles, onClick, onDragStart, compact=false }) {
  const p = PRIORITY[task.priority] || PRIORITY.mid
  const assignee = profiles.find(pr => pr.id === task.assignee_id)
  const isDone = task.status === 'done'

  return (
    <div
      draggable
      onDragStart={e => { e.stopPropagation(); onDragStart && onDragStart(e, task) }}
      onClick={e => { e.stopPropagation(); onClick && onClick(task) }}
      title={task.title}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: isDone ? '#f7f7f5' : p.bg,
        border: `1px solid ${isDone ? 'rgba(0,0,0,0.07)' : p.border}`,
        borderLeft: `2.5px solid ${isDone ? '#9b9b9b' : p.dot}`,
        borderRadius: 5, padding: compact ? '2px 6px' : '3px 7px',
        cursor: 'pointer', userSelect: 'none',
        fontSize: compact ? 10 : 11, fontWeight: 500,
        color: isDone ? '#9b9b9b' : p.color,
        textDecoration: isDone ? 'line-through' : 'none',
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        maxWidth: '100%', flexShrink: 0,
        transition: 'opacity 150ms',
      }}
    >
      <div style={{ width:5, height:5, borderRadius:'50%', background: isDone?'#9b9b9b':p.dot, flexShrink:0 }} />
      <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', minWidth:0 }}>{task.title}</span>
      {assignee && !compact && <Avatar initials={assignee.initials} size={14} />}
    </div>
  )
}

// ─── MONTH VIEW ───────────────────────────────────────────────────────────────
function MonthView({ tasks, profiles, currentDate, onTaskClick, onDayClick, onDropDate, openNew }) {
  const [dragOver, setDragOver] = useState(null)
  const [draggingTask, setDraggingTask] = useState(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Grid starts from Monday
  let startPad = firstDay.getDay() - 1; if (startPad < 0) startPad = 6
  const days = []
  for (let i = 0; i < startPad; i++) days.push(addDays(firstDay, -(startPad - i)))
  for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i))
  while (days.length % 7 !== 0) days.push(addDays(lastDay, days.length - startPad - lastDay.getDate() + 1))

  const today = new Date(); today.setHours(0,0,0,0)
  const DAYS = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz']

  function handleDragStart(e, task) {
    setDraggingTask(task)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDrop(e, day) {
    e.preventDefault()
    if (!draggingTask) return
    onDropDate && onDropDate(draggingTask, toYMD(day))
    setDraggingTask(null); setDragOver(null)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Day headers */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid rgba(0,0,0,0.08)' }}>
        {DAYS.map(d => (
          <div key={d} style={{ padding:'8px 0', textAlign:'center', fontSize:11, fontWeight:600, color:'#9b9b9b', letterSpacing:'0.04em' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gridTemplateRows:`repeat(${days.length/7},1fr)`, flex:1, gap:0 }}>
        {days.map((day, i) => {
          const isToday = sameDay(day, today)
          const isCurrentMonth = day.getMonth() === month
          const isOver = dragOver === toYMD(day)
          const dayTasks = getTasksForDay(tasks, day)
          const MAX_SHOW = 3

          return (
            <div key={i}
              onDragOver={e => { e.preventDefault(); setDragOver(toYMD(day)) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => handleDrop(e, day)}
              onClick={() => onDayClick && onDayClick(day)}
              style={{
                borderRight: (i+1)%7===0 ? 'none' : '1px solid rgba(0,0,0,0.06)',
                borderBottom: '1px solid rgba(0,0,0,0.06)',
                padding: '6px 6px 4px',
                background: isOver ? '#eef0fc' : isToday ? '#fafafe' : 'transparent',
                cursor: 'pointer', minHeight: 90, position:'relative',
                transition: 'background 120ms',
              }}
            >
              {/* Day number */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{
                  width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:12, fontWeight: isToday ? 700 : 400,
                  color: isToday ? '#fff' : isCurrentMonth ? '#1a1a1a' : '#c4c2bc',
                  background: isToday ? '#5e6ad2' : 'transparent',
                  borderRadius:'50%', flexShrink:0,
                }}>{day.getDate()}</span>
                {dayTasks.length > 0 && (
                  <button onClick={e=>{e.stopPropagation(); openNew && openNew(toYMD(day))}}
                    style={{ width:18, height:18, borderRadius:'50%', border:'none', background:'none', cursor:'pointer', color:'#9b9b9b', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', opacity:0, transition:'opacity 150ms' }}
                    className="day-add-btn">+</button>
                )}
              </div>

              {/* Tasks */}
              <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                {dayTasks.slice(0, MAX_SHOW).map(t => (
                  <TaskChip key={t.id} task={t} profiles={profiles} compact
                    onClick={() => onTaskClick(t)}
                    onDragStart={handleDragStart} />
                ))}
                {dayTasks.length > MAX_SHOW && (
                  <div style={{ fontSize:10, color:'#9b9b9b', fontWeight:500, paddingLeft:4 }}>
                    +{dayTasks.length - MAX_SHOW} daha
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <style>{`.day-add-btn:hover{opacity:1!important}`}</style>
    </div>
  )
}

// ─── WEEK VIEW ────────────────────────────────────────────────────────────────
function WeekView({ tasks, profiles, currentDate, onTaskClick, onDayClick, onDropDate, openNew }) {
  const [dragOver, setDragOver] = useState(null)
  const [draggingTask, setDraggingTask] = useState(null)

  const today = new Date(); today.setHours(0,0,0,0)

  // Get Monday of current week
  const dow = currentDate.getDay()
  const monday = addDays(currentDate, dow === 0 ? -6 : -(dow - 1))
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const DAYS_FULL = ['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar']

  function handleDragStart(e, task) {
    setDraggingTask(task); e.dataTransfer.effectAllowed = 'move'
  }
  function handleDrop(e, day) {
    e.preventDefault()
    if (!draggingTask) return
    onDropDate && onDropDate(draggingTask, toYMD(day))
    setDraggingTask(null); setDragOver(null)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Header */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid rgba(0,0,0,0.08)' }}>
        {days.map((day, i) => {
          const isToday = sameDay(day, today)
          return (
            <div key={i} style={{ padding:'10px 12px', textAlign:'center', borderRight: i<6?'1px solid rgba(0,0,0,0.06)':'none' }}>
              <div style={{ fontSize:11, fontWeight:500, color:'#9b9b9b', letterSpacing:'0.04em', marginBottom:4 }}>{DAYS_FULL[i].slice(0,3).toUpperCase()}</div>
              <div style={{
                width:32, height:32, borderRadius:'50%', margin:'0 auto',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:16, fontWeight: isToday?700:400,
                color: isToday?'#fff':'#1a1a1a',
                background: isToday?'#5e6ad2':'transparent',
              }}>{day.getDate()}</div>
            </div>
          )
        })}
      </div>

      {/* Day columns */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', flex:1, overflow:'auto' }}>
        {days.map((day, i) => {
          const isToday = sameDay(day, today)
          const isOver = dragOver === toYMD(day)
          const dayTasks = getTasksForDay(tasks, day)

          return (
            <div key={i}
              onDragOver={e=>{e.preventDefault();setDragOver(toYMD(day))}}
              onDragLeave={()=>setDragOver(null)}
              onDrop={e=>handleDrop(e,day)}
              onClick={()=>onDayClick&&onDayClick(day)}
              style={{
                borderRight: i<6?'1px solid rgba(0,0,0,0.06)':'none',
                padding:'8px 6px', minHeight:200,
                background: isOver?'#eef0fc' : isToday?'#fafafe':'transparent',
                cursor:'pointer', transition:'background 120ms',
              }}
            >
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {dayTasks.length === 0 && (
                  <div style={{ padding:'16px 4px', textAlign:'center' }}>
                    <div style={{ fontSize:11, color:'#d4d2cc' }}>—</div>
                  </div>
                )}
                {dayTasks.map(t => (
                  <TaskChip key={t.id} task={t} profiles={profiles}
                    onClick={()=>onTaskClick(t)}
                    onDragStart={handleDragStart} />
                ))}
                <button onClick={e=>{e.stopPropagation();openNew&&openNew(toYMD(day))}}
                  style={{ background:'none', border:'1px dashed rgba(0,0,0,0.12)', borderRadius:5, padding:'4px 6px', fontSize:11, color:'#9b9b9b', cursor:'pointer', textAlign:'left', display:'none' }}
                  className="week-add-btn">+ Ekle</button>
              </div>
            </div>
          )
        })}
      </div>
      <style>{`.week-add-btn{display:block!important} `}</style>
    </div>
  )
}

// ─── DAY VIEW ─────────────────────────────────────────────────────────────────
function DayView({ tasks, profiles, currentDate, onTaskClick, openNew }) {
  const today = new Date(); today.setHours(0,0,0,0)
  const isToday = sameDay(currentDate, today)
  const dayTasks = getTasksForDay(tasks, currentDate)

  const todo  = dayTasks.filter(t=>t.status==='todo')
  const doing = dayTasks.filter(t=>t.status==='doing')
  const done  = dayTasks.filter(t=>t.status==='done')

  const dateLabel = currentDate.toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })

  return (
    <div style={{ maxWidth:680, margin:'0 auto', padding:'0 4px' }}>
      {/* Date header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, paddingBottom:16, borderBottom:'1px solid rgba(0,0,0,0.08)' }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, letterSpacing:'-0.03em', color:'#1a1a1a' }}>{dateLabel}</div>
          {isToday && <div style={{ fontSize:12, color:'#5e6ad2', fontWeight:500, marginTop:2 }}>Bugün</div>}
        </div>
        <button onClick={()=>openNew&&openNew(toYMD(currentDate))}
          style={{ height:32, padding:'0 14px', background:'#5e6ad2', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ fontSize:16, lineHeight:1 }}>+</span> Görev Ekle
        </button>
      </div>

      {dayTasks.length === 0 ? (
        <div style={{ textAlign:'center', padding:'64px 0', color:'#9b9b9b' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>📅</div>
          <div style={{ fontSize:14, fontWeight:500 }}>Bu gün için görev yok</div>
          <div style={{ fontSize:12, marginTop:4 }}>Yeni bir görev ekle veya başka bir güne bak</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          {[
            { label:'Devam Eden', tasks:doing, color:'#5e6ad2', icon:'◑' },
            { label:'Yapılacak',  tasks:todo,  color:'#9b9b9b', icon:'○' },
            { label:'Tamamlandı',tasks:done,  color:'#22c55e', icon:'●' },
          ].filter(g=>g.tasks.length>0).map(group=>(
            <div key={group.label}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                <span style={{ color:group.color, fontSize:13 }}>{group.icon}</span>
                <span style={{ fontSize:12, fontWeight:600, color:'#6b6b6b', textTransform:'uppercase', letterSpacing:'0.04em' }}>{group.label}</span>
                <span style={{ fontSize:11, color:'#9b9b9b', background:'#f0efec', padding:'1px 7px', borderRadius:99 }}>{group.tasks.length}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {group.tasks.map(task => {
                  const p = PRIORITY[task.priority]||PRIORITY.mid
                  const assignee = profiles.find(pr=>pr.id===task.assignee_id)
                  return (
                    <div key={task.id} onClick={()=>onTaskClick(task)}
                      style={{ display:'flex', alignItems:'center', gap:12, background:'#fff', border:`1px solid rgba(0,0,0,0.08)`, borderLeft:`3px solid ${p.dot}`, borderRadius:8, padding:'10px 14px', cursor:'pointer', transition:'box-shadow 150ms' }}
                      onMouseEnter={e=>e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.07)'}
                      onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}
                    >
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:500, color: task.status==='done'?'#9b9b9b':'#1a1a1a', textDecoration:task.status==='done'?'line-through':'none', marginBottom:2 }}>{task.title}</div>
                        {task.tags?.length>0 && (
                          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                            {task.tags.map(tag=><span key={tag} style={{ fontSize:10, color:'#9b9b9b', background:'#f7f7f5', padding:'1px 6px', borderRadius:4, border:'1px solid rgba(0,0,0,0.07)' }}>{tag}</span>)}
                          </div>
                        )}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                        <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:99, background:p.bg, color:p.color }}>{PRIORITY[task.priority]?.label||''}</span>
                        {assignee && (
                          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <Avatar initials={assignee.initials} size={20} />
                            <span style={{ fontSize:11, color:'#6b6b6b' }}>{assignee.full_name.split(' ')[0]}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── MAIN CALENDAR COMPONENT ──────────────────────────────────────────────────
export default function CalendarView({ tasks, profiles, onTaskClick, onTaskUpdate, openNewWithDate }) {
  const [calView, setCalView] = useState('month') // 'month'|'week'|'day'
  const [currentDate, setCurrentDate] = useState(() => { const d=new Date(); d.setHours(0,0,0,0); return d })

  function navigate(dir) {
    setCurrentDate(prev => {
      const d = new Date(prev)
      if (calView === 'month') { d.setMonth(d.getMonth() + dir) }
      else if (calView === 'week') { d.setDate(d.getDate() + dir*7) }
      else { d.setDate(d.getDate() + dir) }
      return d
    })
  }

  function goToday() { const d=new Date(); d.setHours(0,0,0,0); setCurrentDate(d) }

  function handleDropDate(task, newDate) {
    // Update due_date (and start_date if multi-day)
    const update = { due_date: newDate }
    if (task.start_date) {
      const diff = parseYMD(task.due_date) && parseYMD(task.start_date)
        ? Math.floor((parseYMD(task.due_date)-parseYMD(task.start_date))/86400000) : 0
      update.start_date = toYMD(addDays(parseYMD(newDate), -diff))
    }
    onTaskUpdate && onTaskUpdate(task.id, update)
  }

  function handleDayClick(day) {
    if (calView === 'month') { setCurrentDate(day); setCalView('day') }
  }

  // Header label
  const headerLabel = (() => {
    if (calView === 'month') return currentDate.toLocaleDateString('tr-TR', { month:'long', year:'numeric' })
    if (calView === 'week') {
      const dow = currentDate.getDay()
      const mon = addDays(currentDate, dow===0?-6:-(dow-1))
      const sun = addDays(mon, 6)
      if (mon.getMonth()===sun.getMonth()) return `${mon.getDate()} – ${sun.getDate()} ${sun.toLocaleDateString('tr-TR',{month:'long',year:'numeric'})}`
      return `${mon.toLocaleDateString('tr-TR',{day:'numeric',month:'short'})} – ${sun.toLocaleDateString('tr-TR',{day:'numeric',month:'short',year:'numeric'})}`
    }
    return currentDate.toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long' })
  })()

  // Taskleri sadece tarih olanları göster
  const calTasks = tasks.filter(t => t.due_date || t.start_date)

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Calendar topbar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 0 16px', borderBottom:'1px solid rgba(0,0,0,0.08)', marginBottom:0, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {/* Nav arrows */}
          <div style={{ display:'flex', alignItems:'center', gap:2 }}>
            <button onClick={()=>navigate(-1)} style={navBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <button onClick={goToday} style={{ ...navBtn, padding:'5px 10px', fontSize:12, fontWeight:500, minWidth:'unset', borderRadius:6 }}>Bugün</button>
            <button onClick={()=>navigate(1)} style={navBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
          <span style={{ fontSize:15, fontWeight:600, letterSpacing:'-0.02em', color:'#1a1a1a' }}>{headerLabel}</span>
        </div>

        {/* View switcher */}
        <div style={{ display:'flex', background:'#f0efec', borderRadius:8, padding:2, gap:1 }}>
          {[['day','Gün'],['week','Hafta'],['month','Ay']].map(([id,lbl])=>(
            <button key={id} onClick={()=>setCalView(id)} style={{
              padding:'5px 14px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:500,
              background: calView===id ? '#fff' : 'transparent',
              color: calView===id ? '#1a1a1a' : '#6b6b6b',
              boxShadow: calView===id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition:'all 150ms',
            }}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* Calendar content */}
      <div style={{ flex:1, overflow: calView==='month'?'hidden':'auto', marginTop:0 }}>
        {calView === 'month' && (
          <MonthView tasks={calTasks} profiles={profiles} currentDate={currentDate}
            onTaskClick={onTaskClick} onDayClick={handleDayClick}
            onDropDate={handleDropDate} openNew={openNewWithDate} />
        )}
        {calView === 'week' && (
          <WeekView tasks={calTasks} profiles={profiles} currentDate={currentDate}
            onTaskClick={onTaskClick} onDayClick={handleDayClick}
            onDropDate={handleDropDate} openNew={openNewWithDate} />
        )}
        {calView === 'day' && (
          <div style={{ padding:'16px 0' }}>
            <DayView tasks={calTasks} profiles={profiles} currentDate={currentDate}
              onTaskClick={onTaskClick} openNew={openNewWithDate} />
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ borderTop:'1px solid rgba(0,0,0,0.07)', padding:'8px 0 0', display:'flex', alignItems:'center', gap:16, flexShrink:0 }}>
        <span style={{ fontSize:11, color:'#9b9b9b', fontWeight:500 }}>Öncelik:</span>
        {Object.entries(PRIORITY).map(([k,v])=>(
          <div key={k} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#6b6b6b' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:v.dot }} />
            {k==='low'?'Düşük':k==='mid'?'Orta':'Acil'}
          </div>
        ))}
        <span style={{ marginLeft:'auto', fontSize:11, color:'#9b9b9b' }}>
          {calTasks.length} görev takvimde · {tasks.length - calTasks.length} tarihsiz
        </span>
      </div>
    </div>
  )
}

const navBtn = {
  width:28, height:28, borderRadius:6, border:'1px solid rgba(0,0,0,0.1)',
  background:'#fff', cursor:'pointer', display:'flex', alignItems:'center',
  justifyContent:'center', color:'#6b6b6b', transition:'all 150ms',
}
