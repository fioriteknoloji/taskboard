'use client'

import { useState, useRef, useEffect } from 'react'

const PRIORITY_COLOR = { high: '#e5484d', mid: '#f59e0b', low: '#9b9b9b' }
const STATUS_COLOR   = { todo: '#9b9b9b', doing: '#5e6ad2', done: '#22c55e' }

function toYMD(d) { return d instanceof Date ? d.toISOString().split('T')[0] : d }

function parseDate(s) {
  if (!s) return null
  const d = new Date(s + 'T00:00:00')
  return isNaN(d) ? null : d
}

function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000)
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

const ROW_H   = 40
const HDR_H   = 56
const LABEL_W = 220
const DAY_W   = 28

export default function GanttView({ tasks, profiles, dependencies, onTaskClick, onTaskUpdate }) {
  const today = new Date(); today.setHours(0, 0, 0, 0)

  // Only tasks with at least one date
  const ganttTasks = tasks.filter(t => t.start_date || t.due_date).map(t => ({
    ...t,
    _start: parseDate(t.start_date || t.due_date),
    _end:   parseDate(t.due_date   || t.start_date),
  })).sort((a, b) => a._start - b._start)

  // Date range: 2 weeks before earliest, 4 weeks after latest
  const earliest = ganttTasks.length ? ganttTasks[0]._start : today
  const latest   = ganttTasks.length ? ganttTasks[ganttTasks.length-1]._end : addDays(today, 30)
  const rangeStart = addDays(earliest, -14)
  const rangeEnd   = addDays(latest,   28)
  const totalDays  = daysBetween(rangeStart, rangeEnd)

  const [dragState, setDragState] = useState(null) // { taskId, type:'move'|'resize-l'|'resize-r', startX, origStart, origEnd }
  const svgRef = useRef()

  function dayOffset(d) { return daysBetween(rangeStart, d) }
  function xForDay(d)   { return LABEL_W + dayOffset(d) * DAY_W }

  // Months header
  const months = []
  let cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
  while (cur <= rangeEnd) {
    const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    const startOff = Math.max(0, dayOffset(cur))
    const endOff   = Math.min(totalDays, dayOffset(next))
    months.push({ label: cur.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }), x: LABEL_W + startOff * DAY_W, width: (endOff - startOff) * DAY_W })
    cur = next
  }

  // Days header (show every 7th day + today)
  const dayHeaders = []
  for (let i = 0; i <= totalDays; i++) {
    const d = addDays(rangeStart, i)
    const isWeekend = d.getDay() === 0 || d.getDay() === 6
    const isTdy = toYMD(d) === toYMD(today)
    if (i % 7 === 0 || isTdy) {
      dayHeaders.push({ x: LABEL_W + i * DAY_W, label: d.getDate(), isWeekend, isTdy })
    }
  }

  const svgWidth  = LABEL_W + totalDays * DAY_W
  const svgHeight = HDR_H + ganttTasks.length * ROW_H + 20

  function onBarMouseDown(e, task, type) {
    e.preventDefault()
    setDragState({ taskId: task.id, type, startX: e.clientX, origStart: task._start, origEnd: task._end })
  }

  useEffect(() => {
    if (!dragState) return

    function onMove(e) {
      const dx = e.clientX - dragState.startX
      const daysDelta = Math.round(dx / DAY_W)
      if (daysDelta === 0) return

      setDragState(prev => {
        const task = ganttTasks.find(t => t.id === prev.taskId)
        if (!task) return prev
        let newStart = new Date(prev.origStart)
        let newEnd   = new Date(prev.origEnd)

        if (prev.type === 'move') {
          newStart = addDays(prev.origStart, daysDelta)
          newEnd   = addDays(prev.origEnd,   daysDelta)
        } else if (prev.type === 'resize-r') {
          newEnd = addDays(prev.origEnd, daysDelta)
          if (newEnd <= newStart) newEnd = addDays(newStart, 1)
        } else if (prev.type === 'resize-l') {
          newStart = addDays(prev.origStart, daysDelta)
          if (newStart >= newEnd) newStart = addDays(newEnd, -1)
        }
        return { ...prev, previewStart: newStart, previewEnd: newEnd }
      })
    }

    function onUp() {
      if (dragState.previewStart && dragState.previewEnd) {
        onTaskUpdate && onTaskUpdate(dragState.taskId, {
          start_date: toYMD(dragState.previewStart),
          due_date:   toYMD(dragState.previewEnd),
        })
      }
      setDragState(null)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragState, ganttTasks, onTaskUpdate])

  // Dependency lines
  const depLines = []
  if (dependencies) {
    for (const dep of dependencies) {
      const fromTask = ganttTasks.find(t => t.id === dep.depends_on)
      const toTask   = ganttTasks.find(t => t.id === dep.task_id)
      if (!fromTask || !toTask) continue
      const fromIdx = ganttTasks.indexOf(fromTask)
      const toIdx   = ganttTasks.indexOf(toTask)

      const previewStart = dragState?.taskId === fromTask.id ? dragState.previewStart : null
      const previewEnd   = dragState?.taskId === fromTask.id ? dragState.previewEnd   : null
      const x1 = xForDay(previewEnd   || fromTask._end)
      const y1 = HDR_H + fromIdx * ROW_H + ROW_H / 2
      const x2 = xForDay(toTask._start)
      const y2 = HDR_H + toIdx   * ROW_H + ROW_H / 2
      const isDone = fromTask.status === 'done'

      depLines.push({ key:`${dep.depends_on}-${dep.task_id}`, x1, y1, x2, y2, isDone })
    }
  }

  if (ganttTasks.length === 0) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', color:'#9b9b9b' }}>
      <div style={{ fontSize:32, marginBottom:12 }}>📊</div>
      <div style={{ fontSize:14, fontWeight:500 }}>Gantt için başlangıç veya bitiş tarihi olan görev yok</div>
      <div style={{ fontSize:12, marginTop:4 }}>Görevlere tarih ekleyerek buraya görünmesini sağla</div>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:12, flexShrink:0 }}>
        <span style={{ fontSize:13, fontWeight:600, color:'#1a1a1a' }}>Gantt Görünümü</span>
        <div style={{ display:'flex', alignItems:'center', gap:12, fontSize:11, color:'#6b6b6b' }}>
          {Object.entries(STATUS_COLOR).map(([k,c])=>(
            <span key={k} style={{ display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ width:10, height:10, borderRadius:2, background:c, display:'inline-block' }} />
              {k==='todo'?'Yapılacak':k==='doing'?'Devam Eden':'Tamamlandı'}
            </span>
          ))}
          <span style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ width:10, height:2, background:'#e5484d', display:'inline-block' }} />Bağımlılık
          </span>
        </div>
      </div>

      <div style={{ flex:1, overflow:'auto', cursor: dragState ? 'grabbing' : 'default', border:'1px solid rgba(0,0,0,0.08)', borderRadius:10 }}>
        <svg ref={svgRef} width={svgWidth} height={svgHeight} style={{ display:'block', userSelect:'none' }}>
          {/* Background */}
          <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="#fff" />

          {/* Weekend shading */}
          {Array.from({length: totalDays}, (_,i) => {
            const d = addDays(rangeStart, i)
            const isWeekend = d.getDay() === 0 || d.getDay() === 6
            return isWeekend ? <rect key={i} x={LABEL_W+i*DAY_W} y={0} width={DAY_W} height={svgHeight} fill="rgba(0,0,0,0.02)" /> : null
          })}

          {/* Today line */}
          <line x1={xForDay(today)} y1={0} x2={xForDay(today)} y2={svgHeight} stroke="#5e6ad2" strokeWidth={1.5} strokeDasharray="4,3" opacity={0.5} />
          <rect x={xForDay(today)-16} y={4} width={32} height={16} rx={4} fill="#5e6ad2" />
          <text x={xForDay(today)} y={15} textAnchor="middle" fill="white" fontSize={9} fontWeight={600}>Bugün</text>

          {/* Row backgrounds */}
          {ganttTasks.map((_, i) => (
            <rect key={i} x={0} y={HDR_H + i*ROW_H} width={svgWidth} height={ROW_H}
              fill={i%2===0 ? '#fafafa' : '#fff'} />
          ))}

          {/* Grid lines (horizontal) */}
          {ganttTasks.map((_, i) => (
            <line key={i} x1={0} y1={HDR_H+(i+1)*ROW_H} x2={svgWidth} y2={HDR_H+(i+1)*ROW_H} stroke="rgba(0,0,0,0.05)" />
          ))}

          {/* Header: months */}
          <rect x={0} y={0} width={svgWidth} height={HDR_H} fill="#f7f7f5" />
          <line x1={0} y1={HDR_H} x2={svgWidth} y2={HDR_H} stroke="rgba(0,0,0,0.1)" />
          {months.map((m,i) => (
            <g key={i}>
              <line x1={m.x} y1={0} x2={m.x} y2={HDR_H} stroke="rgba(0,0,0,0.08)" />
              <text x={m.x + m.width/2} y={18} textAnchor="middle" fontSize={11} fontWeight={600} fill="#6b6b6b">{m.label}</text>
            </g>
          ))}
          {dayHeaders.map((d, i) => (
            <g key={i}>
              <line x1={d.x} y1={28} x2={d.x} y2={HDR_H} stroke="rgba(0,0,0,0.06)" />
              <text x={d.x + DAY_W/2} y={44} textAnchor="middle" fontSize={10} fontWeight={d.isTdy?700:400}
                fill={d.isTdy?'#5e6ad2':d.isWeekend?'#c4c2bc':'#9b9b9b'}>{d.label}</text>
            </g>
          ))}

          {/* Label column header */}
          <rect x={0} y={0} width={LABEL_W} height={svgHeight} fill="white" />
          <line x1={LABEL_W} y1={0} x2={LABEL_W} y2={svgHeight} stroke="rgba(0,0,0,0.1)" />
          <text x={14} y={30} fontSize={11} fontWeight={600} fill="#9b9b9b">GÖREV</text>

          {/* Dependency lines */}
          {depLines.map(dl => {
            const mx = (dl.x1 + dl.x2) / 2
            return (
              <g key={dl.key}>
                <path d={`M${dl.x1},${dl.y1} C${mx},${dl.y1} ${mx},${dl.y2} ${dl.x2},${dl.y2}`}
                  fill="none" stroke={dl.isDone?'#22c55e':'#e5484d'} strokeWidth={1.5} strokeDasharray={dl.isDone?'none':'4,3'} opacity={0.7} />
                <polygon points={`${dl.x2},${dl.y2} ${dl.x2-6},${dl.y2-4} ${dl.x2-6},${dl.y2+4}`}
                  fill={dl.isDone?'#22c55e':'#e5484d'} opacity={0.7} />
              </g>
            )
          })}

          {/* Task rows */}
          {ganttTasks.map((task, i) => {
            const y = HDR_H + i * ROW_H
            const assignee = profiles.find(p => p.id === task.assignee_id)
            const isDragging = dragState?.taskId === task.id
            const barStart = isDragging && dragState.previewStart ? dragState.previewStart : task._start
            const barEnd   = isDragging && dragState.previewEnd   ? dragState.previewEnd   : task._end
            const bx = xForDay(barStart)
            const bw = Math.max(DAY_W, daysBetween(barStart, barEnd) * DAY_W + DAY_W)
            const barColor = STATUS_COLOR[task.status]
            const isLate = task.status !== 'done' && task._end < today

            return (
              <g key={task.id} onClick={()=>!dragState && onTaskClick(task)} style={{cursor:'pointer'}}>
                {/* Label */}
                <text x={10} y={y + ROW_H/2 + 4} fontSize={12} fontWeight={400} fill="#1a1a1a"
                  style={{ overflow:'hidden' }}>
                  {task.title.length > 22 ? task.title.slice(0,22)+'…' : task.title}
                </text>
                {assignee && (
                  <text x={LABEL_W - 8} y={y + ROW_H/2 + 4} fontSize={10} fontWeight={600}
                    fill="#9b9b9b" textAnchor="end">{assignee.initials}</text>
                )}

                {/* Bar */}
                <rect x={bx} y={y + 8} width={bw} height={ROW_H-16} rx={4}
                  fill={barColor} opacity={isDragging?0.6:task.status==='done'?0.4:0.85}
                  stroke={isLate?'#e5484d':'none'} strokeWidth={isLate?1.5:0}
                  onMouseDown={e=>onBarMouseDown(e, task, 'move')} />

                {/* Task title on bar */}
                {bw > 60 && (
                  <text x={bx+8} y={y+ROW_H/2+4} fontSize={10} fontWeight={500} fill="white"
                    style={{pointerEvents:'none'}}>
                    {task.title.length > Math.floor(bw/7) ? task.title.slice(0, Math.floor(bw/7))+'…' : task.title}
                  </text>
                )}

                {/* Resize handles */}
                <rect x={bx} y={y+8} width={6} height={ROW_H-16} rx={2} fill="rgba(255,255,255,0.4)"
                  style={{cursor:'ew-resize'}} onMouseDown={e=>{e.stopPropagation();onBarMouseDown(e,task,'resize-l')}} />
                <rect x={bx+bw-6} y={y+8} width={6} height={ROW_H-16} rx={2} fill="rgba(255,255,255,0.4)"
                  style={{cursor:'ew-resize'}} onMouseDown={e=>{e.stopPropagation();onBarMouseDown(e,task,'resize-r')}} />

                {/* Late indicator */}
                {isLate && (
                  <text x={bx+bw+4} y={y+ROW_H/2+4} fontSize={10} fill="#e5484d">⚠</text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
