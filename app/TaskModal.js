'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { sendNotification } from '../lib/useNotifications'
import { Repeat, AlertTriangle, Square, Play, X, Sparkles, PenLine, ArrowRight, MessageSquare, Trash2, Circle } from 'lucide-react'

const PRIORITY = {
  low:  { label:'Düşük', dot:'var(--text-tertiary)', bg:'var(--bg-tertiary)', color:'var(--text-secondary)' },
  mid:  { label:'Orta',  dot:'#f59e0b', bg:'#fffbeb', color:'#854d0e' },
  high: { label:'Acil',  dot:'#e5484d', bg:'#fff0f0', color:'#9f1239' },
}
const COLUMNS = [
  { id:'todo',  label:'Yapılacak' },
  { id:'doing', label:'Devam Eden' },
  { id:'done',  label:'Tamamlandı' },
]
const RECURRENCE_OPTIONS = [
  { value:'',          label:'Tekrar yok' },
  { value:'daily',     label:'Her gün' },
  { value:'weekly',    label:'Her hafta' },
  { value:'biweekly',  label:'İki haftada bir' },
  { value:'monthly',   label:'Her ay' },
]
const FIELD_TYPE_LABELS = { text:'Metin', number:'Sayı', select:'Seçim', date:'Tarih', checkbox:'Onay kutusu' }

function timeAgo(ts) {
  const d = Date.now() - new Date(ts).getTime()
  if (d < 60000) return 'az önce'
  if (d < 3600000) return `${Math.floor(d/60000)}dk önce`
  if (d < 86400000) return `${Math.floor(d/3600000)}sa önce`
  return `${Math.floor(d/86400000)}g önce`
}

function Inp({ style, ...p }) {
  return <input className="modern-input" style={{ padding:'8px 12px', ...style }} {...p} />
}

function Sel({ children, style, ...p }) {
  return <select className="modern-input" style={{ padding:'8px 12px', cursor:'pointer', ...style }} {...p}>{children}</select>
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ fontSize:11, fontWeight:600, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:5 }}>{label}</label>
      {children}
    </div>
  )
}

function Avatar({ initials='?', size=20 }) {
  const colors = [['#dbeafe','#1d4ed8'],['#fce7f3','#be185d'],['#dcfce7','#15803d'],['#fef3c7','#b45309'],['#ede9fe','#7c3aed'],['#fee2e2','#b91c1c']]
  let h=0; for (let c of initials) h=(h*31+c.charCodeAt(0))%colors.length
  const [bg,fg]=colors[h]
  return <div style={{ width:size, height:size, borderRadius:'50%', background:bg, color:fg, fontSize:size*0.38, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{initials}</div>
}

// ─── SUBTASKS ─────────────────────────────────────────────────────────────────
function SubtasksPanel({ taskId }) {
  const [subtasks, setSubtasks] = useState([])
  const [newTitle, setNewTitle] = useState('')

  const fetch = useCallback(async () => {
    const { data } = await supabase.from('subtasks').select('*').eq('task_id', taskId).order('position')
    setSubtasks(data || [])
  }, [taskId])

  useEffect(() => {
    fetch()
    const ch = supabase.channel('sub-'+taskId)
      .on('postgres_changes',{event:'*',schema:'public',table:'subtasks',filter:`task_id=eq.${taskId}`},fetch)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [taskId, fetch])

  async function add() {
    if (!newTitle.trim()) return
    await supabase.from('subtasks').insert({ task_id:taskId, title:newTitle.trim(), position:subtasks.length })
    setNewTitle('')
  }

  async function toggle(sub) { await supabase.from('subtasks').update({ completed:!sub.completed }).eq('id',sub.id) }
  async function remove(id)  { await supabase.from('subtasks').delete().eq('id',id) }

  const done=subtasks.filter(s=>s.completed).length, total=subtasks.length

  return (
    <div>
      {total>0 && (
        <div style={{ marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
            <span style={{ fontSize:11, color:'var(--text-tertiary)' }}>{done}/{total} tamamlandı</span>
            <span style={{ fontSize:11, fontWeight:600, color:'#22c55e' }}>{total?Math.round(done/total*100):0}%</span>
          </div>
          <div style={{ height:4, background:'var(--bg-tertiary)', borderRadius:99, overflow:'hidden', marginBottom:10 }}>
            <div style={{ height:'100%', background:'#22c55e', borderRadius:99, width:`${total?Math.round(done/total*100):0}%`, transition:'width 300ms' }} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {subtasks.map(sub=>(
              <div key={sub.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:7, background:sub.completed?'var(--bg-secondary)':'var(--bg)', border:'1px solid var(--border)' }}>
                <input type="checkbox" checked={sub.completed} onChange={()=>toggle(sub)} style={{ width:15,height:15,accentColor:'#5e6ad2',cursor:'pointer',flexShrink:0 }} />
                <span style={{ flex:1, fontSize:13, color:sub.completed?'var(--text-tertiary)':'var(--text-primary)', textDecoration:sub.completed?'line-through':'none' }}>{sub.title}</span>
                <button onClick={()=>remove(sub.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--border-strong)',fontSize:16,padding:'0 2px',lineHeight:1 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ display:'flex', gap:8 }}>
        <Inp value={newTitle} onChange={e=>setNewTitle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()} placeholder="Alt görev ekle… (Enter)" />
        <button className="btn-primary" onClick={add} style={{ padding:'0 14px', whiteSpace:'nowrap' }}>Ekle</button>
      </div>
    </div>
  )
}

// ─── DEPENDENCIES ─────────────────────────────────────────────────────────────
function DependenciesPanel({ taskId, allTasks }) {
  const [deps, setDeps] = useState([])
  const [selected, setSelected] = useState('')

  const fetch = useCallback(async () => {
    const { data } = await supabase.from('task_dependencies').select('*').eq('task_id', taskId)
    setDeps(data||[])
  }, [taskId])

  useEffect(() => { fetch() }, [fetch])

  async function add() {
    if (!selected||selected===taskId) return
    await supabase.from('task_dependencies').insert({ task_id:taskId, depends_on:selected })
    setSelected(''); fetch()
  }
  async function remove(id) { await supabase.from('task_dependencies').delete().eq('id',id); fetch() }

  const depTasks = deps.map(d=>allTasks.find(t=>t.id===d.depends_on)).filter(Boolean)
  const available = allTasks.filter(t=>t.id!==taskId&&!deps.find(d=>d.depends_on===t.id))

  return (
    <div>
      {depTasks.length>0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
          <div style={{ fontSize:11, color:'var(--text-tertiary)', marginBottom:4 }}>Bu görev tamamlanmadan başlayamaz:</div>
          {depTasks.map(t=>{
            const dep=deps.find(d=>d.depends_on===t.id)
            const isDone=t.status==='done'
            return (
              <div key={t.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', borderRadius:7, background:isDone?'#f0fdf4':'var(--bg)', border:`1px solid ${isDone?'#bbf7d0':'var(--border)'}` }}>
                <span style={{ fontSize:14, color:isDone?'#22c55e':'var(--text-tertiary)' }}>{isDone?'●':'○'}</span>
                <span style={{ flex:1, fontSize:13, textDecoration:isDone?'line-through':'none' }}>{t.title}</span>
                <span style={{ fontSize:11, padding:'1px 7px', borderRadius:99, background:isDone?'#dcfce7':'var(--bg-tertiary)', color:isDone?'#15803d':'var(--text-secondary)' }}>
                  {isDone?'Tamamlandı':t.status==='doing'?'Devam Ediyor':'Bekliyor'}
                </span>
                <button onClick={()=>remove(dep.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--border-strong)',fontSize:16,padding:'0 2px' }}>×</button>
              </div>
            )
          })}
        </div>
      )}
      {available.length>0 ? (
        <div style={{ display:'flex', gap:8 }}>
          <Sel value={selected} onChange={e=>setSelected(e.target.value)} style={{ flex:1 }}>
            <option value="">Bağımlılık ekle…</option>
            {available.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}
          </Sel>
          <button className={selected?'btn-primary':''} onClick={add} disabled={!selected} style={{ padding:'0 14px',background:selected?'':'var(--border)',color:selected?'':'var(--text-secondary)',border:'none',borderRadius:6,fontSize:13,fontWeight:500,cursor:selected?'pointer':'default',whiteSpace:'nowrap' }}>Ekle</button>
        </div>
      ) : depTasks.length===0 && <div style={{ fontSize:13,color:'var(--text-tertiary)',textAlign:'center',padding:'16px 0' }}>Bağımlılık eklenecek başka görev yok</div>}
    </div>
  )
}

// ─── MULTI-ASSIGNEE ───────────────────────────────────────────────────────────
function MultiAssigneePanel({ taskId, profiles }) {
  const [assignees, setAssignees] = useState([])
  const [selected, setSelected] = useState('')

  const fetch = useCallback(async () => {
    const { data } = await supabase.from('task_assignees').select('*').eq('task_id', taskId)
    setAssignees(data||[])
  }, [taskId])

  useEffect(() => { fetch() }, [fetch])

  async function add() {
    if (!selected) return
    await supabase.from('task_assignees').insert({ task_id:taskId, user_id:selected })
    setSelected(''); fetch()
  }
  async function remove(id) { await supabase.from('task_assignees').delete().eq('id',id); fetch() }

  const assignedProfiles = assignees.map(a=>profiles.find(p=>p.id===a.user_id)).filter(Boolean)
  const available = profiles.filter(p=>!assignees.find(a=>a.user_id===p.id))

  return (
    <div>
      {assignedProfiles.length>0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
          {assignedProfiles.map(p=>(
            <div key={p.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', background:'var(--bg-tertiary)', borderRadius:99, border:'1px solid var(--border)' }}>
              <Avatar initials={p.initials} size={20} />
              <span style={{ fontSize:12, fontWeight:500, color:'var(--text-primary)' }}>{p.full_name}</span>
              <button onClick={()=>remove(assignees.find(a=>a.user_id===p.id)?.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-tertiary)',fontSize:14,padding:'0 2px',lineHeight:1 }}>×</button>
            </div>
          ))}
        </div>
      )}
      {available.length>0 ? (
        <div style={{ display:'flex', gap:8 }}>
          <Sel value={selected} onChange={e=>setSelected(e.target.value)} style={{ flex:1 }}>
            <option value="">Kişi ekle…</option>
            {available.map(p=><option key={p.id} value={p.id}>{p.full_name} ({p.initials})</option>)}
          </Sel>
          <button className={selected?'btn-primary':''} onClick={add} disabled={!selected} style={{ padding:'0 14px',background:selected?'':'var(--border)',color:selected?'':'var(--text-secondary)',border:'none',borderRadius:6,fontSize:13,fontWeight:500,cursor:selected?'pointer':'default',whiteSpace:'nowrap' }}>Ekle</button>
        </div>
      ) : available.length===0 && assignedProfiles.length===0 && (
        <div style={{ fontSize:13,color:'var(--text-tertiary)',textAlign:'center',padding:'16px 0' }}>Eklenecek başka kişi yok</div>
      )}
    </div>
  )
}

// ─── TIME TRACKING ────────────────────────────────────────────────────────────
function TimeTrackingPanel({ taskId, profile }) {
  const [logs, setLogs] = useState([])
  const [minutes, setMinutes] = useState('')
  const [note, setNote] = useState('')
  const [timer, setTimer] = useState(null) // { start: Date }
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef(null)

  const fetch = useCallback(async () => {
    const { data } = await supabase.from('time_logs').select('*').eq('task_id', taskId).order('created_at',{ascending:false})
    setLogs(data||[])
  }, [taskId])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    if (timer) {
      intervalRef.current = setInterval(() => setElapsed(Math.floor((Date.now()-timer.start)/1000)), 1000)
    } else {
      clearInterval(intervalRef.current)
      setElapsed(0)
    }
    return () => clearInterval(intervalRef.current)
  }, [timer])

  async function logTime(mins, n='') {
    if (!mins||mins<=0) return
    await supabase.from('time_logs').insert({ task_id:taskId, user_id:profile.id, minutes:parseInt(mins), note:n||null })
    setMinutes(''); setNote('')
    fetch()
  }

  function startTimer() { setTimer({ start: Date.now() }) }
  async function stopTimer() {
    if (!timer) return
    const mins = Math.ceil(elapsed/60)
    setTimer(null)
    if (mins>0) await logTime(mins, 'Timer ile')
  }

  async function removeLog(id) { await supabase.from('time_logs').delete().eq('id',id); fetch() }

  const totalMins = logs.reduce((s,l)=>s+l.minutes,0)
  const totalH = Math.floor(totalMins/60), totalM = totalMins%60

  function fmtElapsed(s) {
    const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60
    return h>0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`
  }

  return (
    <div>
      {/* Summary */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'10px 14px', marginBottom:14 }}>
        <div>
          <div style={{ fontSize:11, color:'#15803d', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em' }}>Toplam Süre</div>
          <div style={{ fontSize:20, fontWeight:700, color:'#15803d', letterSpacing:'-0.02em' }}>
            {totalH>0?`${totalH}s `:''}{ totalM}dk
          </div>
        </div>
        {/* Timer */}
        <div style={{ textAlign:'right' }}>
          {timer ? (
            <div>
              <div style={{ fontSize:18, fontWeight:700, color:'#e5484d', fontFamily:'monospace', marginBottom:4 }}>{fmtElapsed(elapsed)}</div>
              <button onClick={stopTimer} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 12px', background:'#e5484d', color:'var(--bg)', border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer' }}><Square fill="currentColor" size={12}/> Durdur & Kaydet</button>
            </div>
          ) : (
            <button onClick={startTimer} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 14px', background:'var(--bg)', border:'1px solid #bbf7d0', borderRadius:6, fontSize:12, fontWeight:500, cursor:'pointer', color:'#15803d' }}><Play fill="currentColor" size={12}/> Timer Başlat</button>
          )}
        </div>
      </div>

      {/* Manual entry */}
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        <Inp type="number" value={minutes} onChange={e=>setMinutes(e.target.value)} placeholder="Dakika" style={{ width:90, flexShrink:0 }} min={1} />
        <Inp value={note} onChange={e=>setNote(e.target.value)} onKeyDown={e=>e.key==='Enter'&&logTime(minutes,note)} placeholder="Açıklama (opsiyonel)" />
        <button onClick={()=>logTime(minutes,note)} disabled={!minutes||parseInt(minutes)<=0}
          style={{ padding:'0 14px', background:minutes&&parseInt(minutes)>0?'#5e6ad2':'#e0dfdc', color:'var(--bg)', border:'none', borderRadius:6, fontSize:13, fontWeight:500, cursor:minutes&&parseInt(minutes)>0?'pointer':'default', whiteSpace:'nowrap' }}>
          Ekle
        </button>
      </div>

      {/* Log list */}
      {logs.length===0 ? <div style={{ textAlign:'center', padding:'20px 0', fontSize:13, color:'var(--text-tertiary)' }}>Henüz zaman kaydı yok</div> : (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {logs.map(log=>(
            <div key={log.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'var(--bg-secondary)', borderRadius:7 }}>
              <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', minWidth:48 }}>
                {log.minutes>=60?`${Math.floor(log.minutes/60)}s ${log.minutes%60}dk`:`${log.minutes}dk`}
              </span>
              <span style={{ flex:1, fontSize:12, color:'var(--text-secondary)' }}>{log.note||'—'}</span>
              <span style={{ fontSize:11, color:'var(--text-tertiary)' }}>{new Date(log.logged_at).toLocaleDateString('tr-TR',{day:'numeric',month:'short'})}</span>
              {log.user_id===profile.id && (
                <button onClick={()=>removeLog(log.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--border-strong)',fontSize:14,padding:'0 2px' }}>×</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── CUSTOM FIELDS ────────────────────────────────────────────────────────────
function CustomFieldsPanel({ taskId, isAdmin }) {
  const [fields, setFields] = useState([])
  const [values, setValues] = useState({})
  const [showAdd, setShowAdd] = useState(false)
  const [newField, setNewField] = useState({ name:'', field_type:'text', options:'' })

  const fetchFields = useCallback(async () => {
    const [{ data:defs }, { data:vals }] = await Promise.all([
      supabase.from('custom_field_definitions').select('*').order('position'),
      supabase.from('custom_field_values').select('*').eq('task_id', taskId),
    ])
    setFields(defs||[])
    const map={}; (vals||[]).forEach(v=>{map[v.field_id]=v.value}); setValues(map)
  }, [taskId])

  useEffect(() => { fetchFields() }, [fetchFields])

  async function saveValue(fieldId, val) {
    setValues(prev=>({...prev,[fieldId]:val}))
    await supabase.from('custom_field_values').upsert({ task_id:taskId, field_id:fieldId, value:String(val), updated_at:new Date().toISOString() },{ onConflict:'task_id,field_id' })
  }

  async function addFieldDef() {
    if (!newField.name.trim()) return
    const options = newField.field_type==='select' ? newField.options.split(',').map(s=>s.trim()).filter(Boolean) : []
    await supabase.from('custom_field_definitions').insert({ name:newField.name.trim(), field_type:newField.field_type, options, position:fields.length })
    setNewField({ name:'',field_type:'text',options:'' }); setShowAdd(false); fetchFields()
  }

  async function deleteField(id) { await supabase.from('custom_field_definitions').delete().eq('id',id); fetchFields() }

  function renderInput(field) {
    const val=values[field.id]??''
    switch(field.field_type) {
      case 'text':     return <Inp value={val} onChange={e=>saveValue(field.id,e.target.value)} placeholder="—" />
      case 'number':   return <Inp type="number" value={val} onChange={e=>saveValue(field.id,e.target.value)} placeholder="0" />
      case 'date':     return <Inp type="date" value={val} onChange={e=>saveValue(field.id,e.target.value)} />
      case 'checkbox': return <div style={{ paddingTop:4 }}><input type="checkbox" checked={val==='true'} onChange={e=>saveValue(field.id,e.target.checked)} style={{ width:16,height:16,accentColor:'#5e6ad2',cursor:'pointer' }} /></div>
      case 'select':   return <Sel value={val} onChange={e=>saveValue(field.id,e.target.value)}><option value="">Seç…</option>{(field.options||[]).map(o=><option key={o} value={o}>{o}</option>)}</Sel>
      default: return null
    }
  }

  return (
    <div>
      {fields.length>0 && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
          {fields.map(field=>(
            <div key={field.id}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                <label style={{ fontSize:11, fontWeight:600, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{field.name}</label>
                {isAdmin && <button onClick={()=>deleteField(field.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--border-strong)',fontSize:13 }}>×</button>}
              </div>
              {renderInput(field)}
            </div>
          ))}
        </div>
      )}
      {fields.length===0 && !showAdd && <div style={{ textAlign:'center',padding:'20px 0',color:'var(--text-tertiary)',fontSize:13 }}>Henüz özel alan yok</div>}
      {isAdmin && (showAdd ? (
        <div style={{ background:'var(--bg-secondary)',borderRadius:10,padding:14,border:'1px solid var(--border)' }}>
          <div style={{ fontSize:12,fontWeight:600,color:'var(--text-primary)',marginBottom:12 }}>Yeni Alan Ekle</div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10 }}>
            <div><label style={{ fontSize:11,color:'var(--text-tertiary)',display:'block',marginBottom:4 }}>Alan adı</label><Inp value={newField.name} onChange={e=>setNewField(f=>({...f,name:e.target.value}))} placeholder="Müşteri, Story point…" /></div>
            <div><label style={{ fontSize:11,color:'var(--text-tertiary)',display:'block',marginBottom:4 }}>Tip</label><Sel value={newField.field_type} onChange={e=>setNewField(f=>({...f,field_type:e.target.value}))}>{Object.entries(FIELD_TYPE_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</Sel></div>
          </div>
          {newField.field_type==='select' && <div style={{ marginBottom:10 }}><label style={{ fontSize:11,color:'var(--text-tertiary)',display:'block',marginBottom:4 }}>Seçenekler (virgülle)</label><Inp value={newField.options} onChange={e=>setNewField(f=>({...f,options:e.target.value}))} placeholder="Düşük, Orta, Yüksek" /></div>}
          <div style={{ display:'flex',gap:8 }}>
            <button onClick={()=>setShowAdd(false)} style={{ padding:'6px 14px',background:'none',border:'1px solid var(--border-mid)',borderRadius:6,fontSize:13,color:'var(--text-secondary)',cursor:'pointer' }}>İptal</button>
            <button onClick={addFieldDef} style={{ padding:'6px 14px',background:'#5e6ad2',color:'var(--bg)',border:'none',borderRadius:6,fontSize:13,fontWeight:500,cursor:'pointer' }}>Kaydet</button>
          </div>
        </div>
      ) : (
        <button onClick={()=>setShowAdd(true)} style={{ width:'100%',padding:'8px',border:'1px dashed var(--border-strong)',borderRadius:7,background:'none',cursor:'pointer',fontSize:13,color:'var(--text-secondary)',display:'flex',alignItems:'center',justifyContent:'center',gap:6 }}>
          <span style={{ fontSize:16 }}>+</span> Yeni alan ekle
        </button>
      ))}
    </div>
  )
}

// ─── MENTION NOTE INPUT ───────────────────────────────────────────────────────
function MentionInput({ value, onChange, profiles, onKeyDown }) {
  const [mentionQuery, setMentionQuery] = useState(null)
  const [mentionPos, setMentionPos] = useState(0)
  const inputRef = useRef()

  function handleChange(e) {
    const val = e.target.value
    onChange(val)
    // Detect @mention
    const cursor = e.target.selectionStart
    const before = val.slice(0, cursor)
    const match = before.match(/@(\w*)$/)
    if (match) { setMentionQuery(match[1].toLowerCase()); setMentionPos(cursor - match[0].length) }
    else setMentionQuery(null)
  }

  function selectMention(profile) {
    const before = value.slice(0, mentionPos)
    const after  = value.slice(inputRef.current?.selectionStart||0)
    onChange(`${before}@${profile.initials} ${after}`)
    setMentionQuery(null)
    inputRef.current?.focus()
  }

  const suggestions = mentionQuery !== null
    ? profiles.filter(p => p.full_name.toLowerCase().includes(mentionQuery) || p.initials.toLowerCase().includes(mentionQuery)).slice(0,5)
    : []

  return (
    <div style={{ position:'relative', flex:1 }}>
      <input ref={inputRef} value={value} onChange={handleChange} onKeyDown={onKeyDown}
        placeholder="Not veya yorum… @kişi ile mention"
        style={{ width:'100%', border:'1px solid var(--border-mid)', borderRadius:6, padding:'7px 10px', fontSize:13, background:'var(--bg)', color:'var(--text-primary)', outline:'none' }}
        onFocus={e=>e.target.style.borderColor='#5e6ad2'} onBlur={e=>{e.target.style.borderColor='var(--border-mid)'; setTimeout(()=>setMentionQuery(null),200)}} />
      {suggestions.length>0 && (
        <div style={{ position:'absolute', bottom:'100%', left:0, right:0, background:'var(--bg)', border:'1px solid var(--border-mid)', borderRadius:8, boxShadow:'0 4px 16px var(--border-mid)', zIndex:100, overflow:'hidden', marginBottom:4 }}>
          {suggestions.map(p=>(
            <div key={p.id} onMouseDown={()=>selectMention(p)}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', cursor:'pointer', transition:'background 120ms' }}
              onMouseEnter={e=>e.currentTarget.style.background='var(--bg-tertiary)'}
              onMouseLeave={e=>e.currentTarget.style.background='var(--bg)'}>
              <div style={{ width:24,height:24,borderRadius:'50%',background:'#eef0fc',color:'#5e6ad2',fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center' }}>{p.initials}</div>
              <span style={{ fontSize:13, color:'var(--text-primary)' }}>{p.full_name}</span>
              <span style={{ fontSize:11, color:'var(--text-tertiary)' }}>@{p.initials}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── DEPENDENCY WARNING ───────────────────────────────────────────────────────
function DependencyWarning({ taskId, allTasks }) {
  const [blockers, setBlockers] = useState([])
  useEffect(() => {
    supabase.from('task_dependencies').select('*').eq('task_id', taskId).then(({ data }) => {
      if (!data?.length) return
      const ids = data.map(d=>d.depends_on)
      setBlockers(allTasks.filter(t=>ids.includes(t.id)&&t.status!=='done'))
    })
  }, [taskId, allTasks])
  if (!blockers.length) return null
  return (
    <div style={{ padding:'10px 14px',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:8,marginBottom:14,fontSize:12,color:'#854d0e',display:'flex',gap:8,alignItems:'flex-start' }}>
      <AlertTriangle size={16} strokeWidth={2.5} style={{flexShrink:0, marginTop:1}}/>
      <div><div style={{ fontWeight:600,marginBottom:3 }}>Bu görev başlayamaz</div><div>{blockers.map(b=>b.title).join(', ')} tamamlanması gerekiyor.</div></div>
    </div>
  )
}

// ─── MAIN MODAL ───────────────────────────────────────────────────────────────
export default function TaskModal({ modal, form, setForm, setModal, profiles, allTasks, user, profile, isAdmin, onSave, onDelete, activity }) {
  const [activeTab, setActiveTab] = useState('detail')
  const [noteInput, setNoteInput] = useState('')
  const [saving, setSaving] = useState(false)
  const isNew = modal === 'new'

  useEffect(() => { setActiveTab('detail'); setNoteInput('') }, [modal])

  const assigneeOptions = isAdmin ? profiles : (profile ? [profile] : [])

  async function save() {
    if (!form.title?.trim()) return
    setSaving(true); await onSave(form); setSaving(false)
  }

  async function addNote() {
    if (!noteInput.trim()||isNew) return
    // Extract mentions
    const mentionMatches = [...noteInput.matchAll(/@(\w+)/g)]
    const notes = [...(modal.notes||[]), { text:noteInput.trim(), time:new Date().toISOString(), author:profile?.initials||'?' }]
    await supabase.from('tasks').update({ notes, updated_at:new Date().toISOString() }).eq('id', modal.id)

    // Notify mentioned users
    for (const match of mentionMatches) {
      const initials = match[1].toUpperCase()
      const mentioned = profiles.find(p=>p.initials===initials)
      if (mentioned && mentioned.id !== user.id) {
        await sendNotification(supabase,{ userId:mentioned.id, type:'commented', taskId:modal.id, taskTitle:modal.title, message:`${profile?.full_name||'Biri'} seni mention etti: "${noteInput.trim().slice(0,60)}"` })
      }
    }
    // Notify assignee
    if (modal.assignee_id && modal.assignee_id !== user.id && !mentionMatches.find(m=>profiles.find(p=>p.initials===m[1].toUpperCase())?.id===modal.assignee_id)) {
      await sendNotification(supabase,{ userId:modal.assignee_id, type:'commented', taskId:modal.id, taskTitle:modal.title, message:`${profile?.full_name||'Biri'} yorum yaptı: "${noteInput.trim().slice(0,60)}"` })
    }
    setNoteInput(''); setModal(prev=>({...prev, notes}))
  }

  const tabs = isNew
    ? [['detail','Detaylar']]
    : [
        ['detail','Detaylar'],
        ['assignees','Atananlar'],
        ['subtasks','Alt Görevler'],
        ['deps','Bağımlılıklar'],
        ['time','Süre Takibi'],
        ['fields','Özel Alanlar'],
        ['notes',`Notlar${modal.notes?.length?` (${modal.notes.length})`:''}`],
        ['activity','Geçmiş'],
        ['ai','✨ AI Özeti'],
      ]

  const taskActivity = !isNew ? activity.filter(a=>a.task_id===modal.id) : []

  function actionMeta(a) {
    return ({created:{icon:<Sparkles size={13}/>,bg:'#dcfce7'},updated:{icon:<PenLine size={13}/>,bg:'#fef3c7'},moved:{icon:<ArrowRight size={13}/>,bg:'#dbeafe'},note:{icon:<MessageSquare size={13}/>,bg:'#ede9fe'},deleted:{icon:<Trash2 size={13}/>,bg:'#fee2e2'}}[a])||{icon:<Circle size={13}/>,bg:'var(--bg-tertiary)'}
  }

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)setModal(null)}} className="animate-fade-in"
      style={{ position:'fixed',inset:0,background:'rgba(15, 23, 42, 0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,backdropFilter:'var(--glass-blur)' }}>
      <div className="animate-pop-in" style={{ background:'var(--bg)',borderRadius:'var(--radius-xl)',width:640,maxWidth:'95vw',maxHeight:'92vh',display:'flex',flexDirection:'column',boxShadow:'var(--shadow-xl)',border:'1px solid var(--glass-border)' }}>

        <div style={{ padding:'18px 20px 0',borderBottom:'1px solid var(--border)',flexShrink:0 }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14 }}>
            <span style={{ fontSize:14,fontWeight:600,letterSpacing:'-0.01em' }}>{isNew?'Yeni İş Ekle':'Görevi Düzenle'}</span>
            <button onClick={()=>setModal(null)} style={{ width:28,height:28,borderRadius:6,border:'none',background:'none',cursor:'pointer',color:'var(--text-tertiary)',display:'flex',alignItems:'center',justifyContent:'center' }}><X size={18} strokeWidth={2.5}/></button>
          </div>
          <div style={{ display:'flex',gap:2,marginBottom:-1,overflowX:'auto' }}>
            {tabs.map(([id,lbl])=>(
              <button key={id} onClick={()=>setActiveTab(id)}
                style={{ padding:'6px 11px',borderRadius:'6px 6px 0 0',border:'none',cursor:'pointer',fontSize:12,fontWeight:500,whiteSpace:'nowrap',transition:'all 150ms',background:activeTab===id?'var(--bg)':'none',color:activeTab===id?'var(--text-primary)':'var(--text-secondary)',borderBottom:activeTab===id?'2px solid #5e6ad2':'2px solid transparent' }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex:1,overflow:'auto',padding:'18px 20px' }}>
          {(modal==='new'||activeTab==='detail') && (
            <>
              <Field label="Görev adı">
                <Inp value={form.title||''} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Ne yapılacak?" autoFocus onKeyDown={e=>e.key==='Enter'&&save()} />
              </Field>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12 }}>
                <Field label="Durum"><Sel value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>{COLUMNS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</Sel></Field>
                <Field label="Öncelik"><Sel value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}><option value="low">Düşük</option><option value="mid">Orta</option><option value="high">Acil</option></Sel></Field>
                <Field label="Birincil atanan"><Sel value={form.assignee_id||''} onChange={e=>setForm(f=>({...f,assignee_id:e.target.value}))}><option value="">Seç…</option>{assigneeOptions.map(p=><option key={p.id} value={p.id}>{p.full_name} ({p.initials})</option>)}</Sel></Field>
                <Field label="Başlangıç tarihi"><Inp type="date" value={form.start_date||''} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))} /></Field>
                <Field label="Bitiş tarihi"><Inp type="date" value={form.due_date||''} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))} /></Field>
                <Field label="Tekrar"><Sel value={form.recurrence||''} onChange={e=>setForm(f=>({...f,recurrence:e.target.value}))}>{RECURRENCE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</Sel></Field>
              </div>
              {form.recurrence && <Field label="Tekrar bitiş tarihi"><Inp type="date" value={form.recurrence_end||''} onChange={e=>setForm(f=>({...f,recurrence_end:e.target.value}))} style={{ maxWidth:200 }} /></Field>}
              <Field label="Etiketler (virgülle ayır)"><Inp value={form.tags||''} onChange={e=>setForm(f=>({...f,tags:e.target.value}))} placeholder="tasarım, backend, frontend…" /></Field>
              {!isNew && modal.recurrence && (
                <div style={{ display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'#eef0fc',borderRadius:8,marginBottom:14,fontSize:12,color:'#5e6ad2' }}>
                  <Repeat size={14} strokeWidth={2.5}/><span>Bu görev <b>{RECURRENCE_OPTIONS.find(o=>o.value===modal.recurrence)?.label}</b> tekrar ediyor</span>
                </div>
              )}
              {!isNew && <DependencyWarning taskId={modal.id} allTasks={allTasks} />}
            </>
          )}

          {activeTab==='assignees' && !isNew && <MultiAssigneePanel taskId={modal.id} profiles={profiles} />}
          {activeTab==='subtasks' && !isNew && <SubtasksPanel taskId={modal.id} />}
          {activeTab==='deps'     && !isNew && <DependenciesPanel taskId={modal.id} allTasks={allTasks} />}
          {activeTab==='time'     && !isNew && <TimeTrackingPanel taskId={modal.id} profile={profile} />}
          {activeTab==='fields'   && !isNew && <CustomFieldsPanel taskId={modal.id} isAdmin={isAdmin} />}

          {activeTab==='notes' && !isNew && (
            <div>
              <div style={{ display:'flex',gap:8,marginBottom:16 }}>
                <MentionInput value={noteInput} onChange={setNoteInput} profiles={profiles} onKeyDown={e=>e.key==='Enter'&&addNote()} />
                <button onClick={addNote} style={{ padding:'0 14px',background:'#5e6ad2',color:'var(--bg)',border:'none',borderRadius:6,fontSize:13,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap' }}>Ekle</button>
              </div>
              {!modal.notes?.length && <div style={{ textAlign:'center',padding:'32px 0',fontSize:13,color:'var(--text-tertiary)' }}>Henüz not yok</div>}
              <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                {[...(modal.notes||[])].reverse().map((n,i)=>(
                  <div key={i} style={{ background:'var(--bg-secondary)',borderRadius:8,padding:'10px 14px',borderLeft:'2px solid #5e6ad2' }}>
                    <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:4 }}>
                      <Avatar initials={n.author||'?'} size={18} />
                      <span style={{ fontSize:11,color:'var(--text-tertiary)' }}>{timeAgo(n.time)}</span>
                    </div>
                    <div style={{ fontSize:13,color:'var(--text-primary)',lineHeight:1.5 }}
                      dangerouslySetInnerHTML={{ __html: n.text.replace(/@(\w+)/g,'<span style="color:#5e6ad2;font-weight:600">@$1</span>') }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab==='activity' && !isNew && (
            taskActivity.length===0
              ? <div style={{ textAlign:'center',padding:'32px 0',fontSize:13,color:'var(--text-tertiary)' }}>Bu görev için aktivite yok</div>
              : <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                  {taskActivity.map(a=>{const m=actionMeta(a.action); return (
                    <div key={a.id} style={{ display:'flex',gap:10,alignItems:'flex-start' }}>
                      <div style={{ width:24,height:24,borderRadius:'50%',background:m.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:11 }}>{m.icon}</div>
                      <div style={{ flex:1 }}><div style={{ fontSize:13,color:'var(--text-primary)' }}>{a.detail}</div><div style={{ fontSize:11,color:'var(--text-tertiary)',marginTop:2 }}>{timeAgo(a.created_at)}</div></div>
                    </div>
                  )})}
                </div>
          )}

          {activeTab==='ai' && !isNew && (
            <AISummaryPanel task={modal} activity={taskActivity} />
          )}
        </div>

        <div style={{ padding:'16px 24px',borderTop:'1px solid var(--border)',display:'flex',gap:12,alignItems:'center',flexShrink:0,background:'var(--bg-secondary)',borderBottomLeftRadius:'var(--radius-xl)',borderBottomRightRadius:'var(--radius-xl)' }}>
          {!isNew&&(isAdmin||modal.user_id===user?.id)&&(
            <button onClick={()=>onDelete(modal.id)}
              style={{ padding:'8px 16px',background:'none',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',fontSize:13,color:'var(--red)',cursor:'pointer',fontWeight:500,transition:'all var(--transition-fast)' }}
              onMouseEnter={e=>{e.currentTarget.style.background='var(--red-light)';e.currentTarget.style.borderColor='var(--red)'}}
              onMouseLeave={e=>{e.currentTarget.style.background='none';e.currentTarget.style.borderColor='var(--border)'}}>
              Sil
            </button>
          )}
          <div style={{ marginLeft:'auto',display:'flex',gap:12 }}>
            <button onClick={()=>setModal(null)} style={{ padding:'8px 18px',background:'none',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',fontSize:13,fontWeight:500,color:'var(--text-secondary)',cursor:'pointer',transition:'background var(--transition-fast)' }} onMouseEnter={e=>e.currentTarget.style.background='var(--bg)'} onMouseLeave={e=>e.currentTarget.style.background='none'}>İptal</button>
            {(isNew||activeTab==='detail')&&(
              <button onClick={save} disabled={saving} className={saving?'':'btn-primary'}
                style={{ padding:'8px 24px',background:saving?'var(--text-tertiary)':'',color:'var(--bg)',border:'none',borderRadius:'var(--radius-md)',fontSize:13,fontWeight:600,cursor:saving?'default':'pointer' }}>
                {saving?'Kaydediliyor…':isNew?'Ekle':'Kaydet'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── AI SUMMARY PANEL ─────────────────────────────────────────────────────────
function AISummaryPanel({ task, activity }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastGenerated, setLastGenerated] = useState(null)

  const hasContent = (task.notes?.length > 0) || activity.length > 0

  async function generateSummary() {
    setLoading(true); setError(null); setSummary(null)

    // Build context for Claude
    const noteLines = (task.notes || []).map((n, i) =>
      `Not ${i+1} (${new Date(n.time).toLocaleDateString('tr-TR')}): "${n.text}"`
    ).join('\n')

    const activityLines = activity.map(a =>
      `[${new Date(a.created_at).toLocaleDateString('tr-TR')}] ${a.action}: ${a.detail}`
    ).join('\n')

    const priorityLabel = { high: 'Acil', mid: 'Orta', low: 'Düşük' }[task.priority] || task.priority
    const statusLabel = { todo: 'Yapılacak', doing: 'Devam Ediyor', done: 'Tamamlandı' }[task.status] || task.status

    const prompt = `Aşağıda bir proje yönetim görevinin detayları verilmiştir. Bu görevi Türkçe olarak özetle.

GÖREV BİLGİLERİ:
- Başlık: ${task.title}
- Durum: ${statusLabel}
- Öncelik: ${priorityLabel}
- Etiketler: ${(task.tags || []).join(', ') || 'yok'}
- Başlangıç: ${task.start_date || 'belirtilmemiş'}
- Bitiş: ${task.due_date || 'belirtilmemiş'}

AKTİVİTE GEÇMİŞİ:
${activityLines || 'Aktivite yok'}

YORUMLAR VE NOTLAR:
${noteLines || 'Not yok'}

Lütfen şu başlıklar altında Türkçe bir özet yaz:

**📋 Genel Durum**
(Görevin mevcut durumu, ne kadar ilerlendi)

**💬 Tartışılanlar**
(Notlarda ve yorumlarda neler konuşuldu, hangi kararlar alındı)

**🔄 Değişiklikler**
(Statü, atanan, tarih gibi önemli değişiklikler)

**⚡ Dikkat Edilmesi Gerekenler**
(Önemli noktalar, riskler, sonraki adımlar)

Özeti 3-4 cümle ile sınırlı tut, net ve anlaşılır yaz.`

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }]
        })
      })

      if (!response.ok) throw new Error(`API hatası: ${response.status}`)
      const data = await response.json()
      const text = data.content?.find(b => b.type === 'text')?.text
      if (!text) throw new Error('Yanıt alınamadı')
      setSummary(text)
      setLastGenerated(new Date())
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  // Format markdown-like bold text
  function formatSummary(text) {
    return text.split('\n').map((line, i) => {
      if (!line.trim()) return <div key={i} style={{ height: 8 }} />
      // Bold headers like **text**
      const parts = line.split(/\*\*(.*?)\*\*/)
      return (
        <div key={i} style={{ marginBottom: 2 }}>
          {parts.map((part, j) =>
            j % 2 === 1
              ? <span key={j} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{part}</span>
              : <span key={j}>{part}</span>
          )}
        </div>
      )
    })
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
            <Sparkles size={14} color="var(--accent)"/> AI Görev Özeti
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {hasContent
              ? `${(task.notes?.length || 0)} not · ${activity.length} aktivite`
              : 'Henüz not veya aktivite yok'}
          </div>
        </div>
        <button
          onClick={generateSummary}
          disabled={loading || !hasContent}
          style={{
            padding: '7px 16px',
            background: loading ? 'var(--bg-tertiary)' : !hasContent ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #5e6ad2, #8b5cf6)',
            color: loading || !hasContent ? 'var(--text-tertiary)' : 'var(--bg)',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500,
            cursor: loading || !hasContent ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 7,
            transition: 'opacity 150ms',
            boxShadow: !loading && hasContent ? '0 2px 8px rgba(94,106,210,0.3)' : 'none',
          }}
        >
          {loading ? (
            <>
              <div style={{ width: 12, height: 12, border: '2px solid var(--border-strong)', borderTopColor: '#5e6ad2', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              Özetleniyor…
            </>
          ) : (
            <>{summary ? <><Repeat size={14}/> Yenile</> : <><Sparkles size={14}/> Özetle</>}</>
          )}
        </button>
      </div>

      {/* Empty state */}
      {!hasContent && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>💬</div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Özetlenecek içerik yok</div>
          <div style={{ fontSize: 12 }}>Notlar sekmesinden yorum ekle veya görev üzerinde değişiklikler yap</div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 14px', background: '#fff0f0', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#e5484d', marginBottom: 12 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Summary result */}
      {summary && (
        <div style={{ background: 'linear-gradient(135deg, #fafafe, #f5f3ff)', border: '1px solid rgba(94,106,210,0.15)', borderRadius: 12, padding: 18 }}>
          {/* AI badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: 'linear-gradient(135deg, #5e6ad2, #8b5cf6)', borderRadius: 99 }}>
              <span style={{ fontSize: 11 }}>✨</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--bg)', letterSpacing: '0.02em' }}>Claude AI</span>
            </div>
            {lastGenerated && (
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{lastGenerated.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
            )}
          </div>

          <div style={{ fontSize: 13, color: '#444', lineHeight: 1.65 }}>
            {formatSummary(summary)}
          </div>

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(94,106,210,0.1)', fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span>⚡</span>
            <span>Bu özet görevin notları ve aktivite geçmişi baz alınarak oluşturulmuştur</span>
          </div>
        </div>
      )}

      {/* Prompt preview — collapsed */}
      {!summary && !loading && hasContent && (
        <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ne analiz edilecek?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {[
              { icon: '📋', label: 'Görev durumu ve önceliği' },
              { icon: '💬', label: `${task.notes?.length || 0} not ve yorum` },
              { icon: '🔄', label: `${activity.length} aktivite kaydı (durum değişiklikleri, atamalar)` },
              { icon: '📅', label: 'Tarih ve etiket bilgileri' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                <span>{item.icon}</span><span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
