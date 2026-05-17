'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { sendNotification } from '../lib/useNotifications'

const PRIORITY = {
  low:  { label: 'Düşük', dot: '#9b9b9b', bg: '#f0efec', color: '#6b6b6b' },
  mid:  { label: 'Orta',  dot: '#f59e0b', bg: '#fffbeb', color: '#854d0e' },
  high: { label: 'Acil',  dot: '#e5484d', bg: '#fff0f0', color: '#9f1239' },
}

const COLUMNS = [
  { id: 'todo',  label: 'Yapılacak' },
  { id: 'doing', label: 'Devam Eden' },
  { id: 'done',  label: 'Tamamlandı' },
]

const RECURRENCE_OPTIONS = [
  { value: '',          label: 'Tekrar yok' },
  { value: 'daily',    label: 'Her gün' },
  { value: 'weekly',   label: 'Her hafta' },
  { value: 'biweekly', label: 'İki haftada bir' },
  { value: 'monthly',  label: 'Her ay' },
]

const FIELD_TYPE_LABELS = { text: 'Metin', number: 'Sayı', select: 'Seçim', date: 'Tarih', checkbox: 'Onay kutusu' }

function timeAgo(ts) {
  const d = Date.now() - new Date(ts).getTime()
  if (d < 60000) return 'az önce'
  if (d < 3600000) return `${Math.floor(d/60000)}dk önce`
  if (d < 86400000) return `${Math.floor(d/3600000)}sa önce`
  return `${Math.floor(d/86400000)}g önce`
}

function Inp({ style, ...p }) {
  return <input onFocus={e=>e.target.style.borderColor='#5e6ad2'} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,0.12)'}
    style={{ width:'100%', border:'1px solid rgba(0,0,0,0.12)', borderRadius:6, padding:'7px 10px', fontSize:13, background:'#fff', color:'#1a1a1a', outline:'none', transition:'border-color 150ms', ...style }} {...p} />
}

function Sel({ children, style, ...p }) {
  return <select style={{ width:'100%', border:'1px solid rgba(0,0,0,0.12)', borderRadius:6, padding:'7px 10px', fontSize:13, background:'#fff', color:'#1a1a1a', outline:'none', cursor:'pointer', ...style }} {...p}>{children}</select>
}

function Field({ label, children, half }) {
  return (
    <div style={{ marginBottom: 14, ...(half ? {} : {}) }}>
      <label style={{ fontSize:11, fontWeight:600, color:'#9b9b9b', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:5 }}>{label}</label>
      {children}
    </div>
  )
}

function Avatar({ initials='?', size=20 }) {
  const colors = [['#dbeafe','#1d4ed8'],['#fce7f3','#be185d'],['#dcfce7','#15803d'],['#fef3c7','#b45309'],['#ede9fe','#7c3aed'],['#fee2e2','#b91c1c']]
  let h = 0; for (let c of initials) h = (h*31+c.charCodeAt(0)) % colors.length
  const [bg,fg] = colors[h]
  return <div style={{ width:size, height:size, borderRadius:'50%', background:bg, color:fg, fontSize:size*0.38, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{initials}</div>
}

// ─── SUBTASKS ─────────────────────────────────────────────────────────────────
function SubtasksPanel({ taskId }) {
  const [subtasks, setSubtasks] = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const { data } = await supabase.from('subtasks').select('*').eq('task_id', taskId).order('position')
    setSubtasks(data || [])
    setLoading(false)
  }, [taskId])

  useEffect(() => {
    fetch()
    const ch = supabase.channel('sub-'+taskId)
      .on('postgres_changes', { event:'*', schema:'public', table:'subtasks', filter:`task_id=eq.${taskId}` }, fetch)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [taskId, fetch])

  async function add() {
    if (!newTitle.trim()) return
    const pos = subtasks.length
    await supabase.from('subtasks').insert({ task_id: taskId, title: newTitle.trim(), position: pos })
    setNewTitle('')
  }

  async function toggle(sub) {
    await supabase.from('subtasks').update({ completed: !sub.completed }).eq('id', sub.id)
  }

  async function remove(id) {
    await supabase.from('subtasks').delete().eq('id', id)
  }

  const done = subtasks.filter(s => s.completed).length
  const total = subtasks.length

  return (
    <div>
      {total > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
            <span style={{ fontSize:11, color:'#9b9b9b' }}>{done}/{total} tamamlandı</span>
          </div>
          <div style={{ height:4, background:'#f0efec', borderRadius:99, overflow:'hidden', marginBottom:10 }}>
            <div style={{ height:'100%', background:'#22c55e', borderRadius:99, width:`${total?Math.round(done/total*100):0}%`, transition:'width 300ms' }} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {subtasks.map(sub => (
              <div key={sub.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:7, background: sub.completed?'#f7f7f5':'#fff', border:'1px solid rgba(0,0,0,0.07)', transition:'background 150ms' }}>
                <input type="checkbox" checked={sub.completed} onChange={()=>toggle(sub)}
                  style={{ width:15, height:15, accentColor:'#5e6ad2', cursor:'pointer', flexShrink:0 }} />
                <span style={{ flex:1, fontSize:13, color: sub.completed?'#9b9b9b':'#1a1a1a', textDecoration: sub.completed?'line-through':'none' }}>{sub.title}</span>
                <button onClick={()=>remove(sub.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#c4c2bc', fontSize:16, padding:'0 2px', lineHeight:1 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ display:'flex', gap:8 }}>
        <Inp value={newTitle} onChange={e=>setNewTitle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()} placeholder="Alt görev ekle… (Enter)" />
        <button onClick={add} style={{ padding:'0 14px', background:'#5e6ad2', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap' }}>Ekle</button>
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
    setDeps(data || [])
  }, [taskId])

  useEffect(() => { fetch() }, [fetch])

  async function add() {
    if (!selected || selected === taskId) return
    await supabase.from('task_dependencies').insert({ task_id: taskId, depends_on: selected }).then(fetch)
    setSelected('')
  }

  async function remove(id) {
    await supabase.from('task_dependencies').delete().eq('id', id)
    fetch()
  }

  const depTasks = deps.map(d => allTasks.find(t => t.id === d.depends_on)).filter(Boolean)
  const available = allTasks.filter(t => t.id !== taskId && !deps.find(d => d.depends_on === t.id))

  return (
    <div>
      {depTasks.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
          <div style={{ fontSize:11, color:'#9b9b9b', marginBottom:4 }}>Bu görev tamamlanmadan başlayamaz:</div>
          {depTasks.map(t => {
            const dep = deps.find(d => d.depends_on === t.id)
            const isDone = t.status === 'done'
            return (
              <div key={t.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', borderRadius:7, background: isDone?'#f0fdf4':'#fff', border:`1px solid ${isDone?'#bbf7d0':'rgba(0,0,0,0.09)'}` }}>
                <span style={{ fontSize:14, color: isDone?'#22c55e':'#9b9b9b' }}>{isDone?'●':'○'}</span>
                <span style={{ flex:1, fontSize:13, color:'#1a1a1a', textDecoration: isDone?'line-through':'none' }}>{t.title}</span>
                <span style={{ fontSize:11, padding:'1px 7px', borderRadius:99, background: isDone?'#dcfce7':'#f0efec', color: isDone?'#15803d':'#6b6b6b' }}>
                  {isDone?'Tamamlandı':t.status==='doing'?'Devam Ediyor':'Bekliyor'}
                </span>
                <button onClick={()=>remove(dep.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#c4c2bc', fontSize:16, padding:'0 2px' }}>×</button>
              </div>
            )
          })}
        </div>
      )}
      {available.length > 0 && (
        <div style={{ display:'flex', gap:8 }}>
          <Sel value={selected} onChange={e=>setSelected(e.target.value)} style={{ flex:1 }}>
            <option value="">Bağımlılık ekle…</option>
            {available.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </Sel>
          <button onClick={add} disabled={!selected} style={{ padding:'0 14px', background: selected?'#5e6ad2':'#e0dfdc', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:500, cursor: selected?'pointer':'default', whiteSpace:'nowrap' }}>Ekle</button>
        </div>
      )}
      {available.length === 0 && deps.length === 0 && (
        <div style={{ fontSize:13, color:'#9b9b9b', textAlign:'center', padding:'16px 0' }}>Bağımlılık eklenecek başka görev yok</div>
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
    const { data: defs } = await supabase.from('custom_field_definitions').select('*').order('position')
    const { data: vals } = await supabase.from('custom_field_values').select('*').eq('task_id', taskId)
    setFields(defs || [])
    const map = {}
    ;(vals || []).forEach(v => { map[v.field_id] = v.value })
    setValues(map)
  }, [taskId])

  useEffect(() => { fetchFields() }, [fetchFields])

  async function saveValue(fieldId, val) {
    setValues(prev => ({ ...prev, [fieldId]: val }))
    await supabase.from('custom_field_values').upsert({ task_id: taskId, field_id: fieldId, value: String(val), updated_at: new Date().toISOString() }, { onConflict: 'task_id,field_id' })
  }

  async function addFieldDef() {
    if (!newField.name.trim()) return
    const options = newField.field_type === 'select'
      ? newField.options.split(',').map(s=>s.trim()).filter(Boolean)
      : []
    await supabase.from('custom_field_definitions').insert({ name: newField.name.trim(), field_type: newField.field_type, options, position: fields.length })
    setNewField({ name:'', field_type:'text', options:'' })
    setShowAdd(false)
    fetchFields()
  }

  async function deleteField(id) {
    await supabase.from('custom_field_definitions').delete().eq('id', id)
    fetchFields()
  }

  function renderInput(field) {
    const val = values[field.id] ?? ''
    switch (field.field_type) {
      case 'text':
        return <Inp value={val} onChange={e=>saveValue(field.id, e.target.value)} placeholder="—" />
      case 'number':
        return <Inp type="number" value={val} onChange={e=>saveValue(field.id, e.target.value)} placeholder="0" />
      case 'date':
        return <Inp type="date" value={val} onChange={e=>saveValue(field.id, e.target.value)} />
      case 'checkbox':
        return (
          <div style={{ paddingTop:4 }}>
            <input type="checkbox" checked={val==='true'} onChange={e=>saveValue(field.id, e.target.checked)}
              style={{ width:16, height:16, accentColor:'#5e6ad2', cursor:'pointer' }} />
          </div>
        )
      case 'select':
        return (
          <Sel value={val} onChange={e=>saveValue(field.id, e.target.value)}>
            <option value="">Seç…</option>
            {(field.options||[]).map(o=><option key={o} value={o}>{o}</option>)}
          </Sel>
        )
      default: return null
    }
  }

  return (
    <div>
      {fields.length === 0 && !showAdd && (
        <div style={{ textAlign:'center', padding:'20px 0', color:'#9b9b9b', fontSize:13 }}>
          Henüz özel alan yok
          {isAdmin && <div style={{ marginTop:6, fontSize:12 }}>Aşağıdan yeni alan ekleyebilirsin</div>}
        </div>
      )}

      {fields.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
          {fields.map(field => (
            <div key={field.id}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                <label style={{ fontSize:11, fontWeight:600, color:'#9b9b9b', textTransform:'uppercase', letterSpacing:'0.05em' }}>{field.name}</label>
                {isAdmin && (
                  <button onClick={()=>deleteField(field.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#c4c2bc', fontSize:13, padding:'0 2px' }}>×</button>
                )}
              </div>
              {renderInput(field)}
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        showAdd ? (
          <div style={{ background:'#f7f7f5', borderRadius:10, padding:14, border:'1px solid rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#1a1a1a', marginBottom:12 }}>Yeni Alan Ekle</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div>
                <label style={{ fontSize:11, color:'#9b9b9b', display:'block', marginBottom:4 }}>Alan adı</label>
                <Inp value={newField.name} onChange={e=>setNewField(f=>({...f,name:e.target.value}))} placeholder="Müşteri adı, Story point…" />
              </div>
              <div>
                <label style={{ fontSize:11, color:'#9b9b9b', display:'block', marginBottom:4 }}>Tip</label>
                <Sel value={newField.field_type} onChange={e=>setNewField(f=>({...f,field_type:e.target.value}))}>
                  {Object.entries(FIELD_TYPE_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </Sel>
              </div>
            </div>
            {newField.field_type === 'select' && (
              <div style={{ marginBottom:10 }}>
                <label style={{ fontSize:11, color:'#9b9b9b', display:'block', marginBottom:4 }}>Seçenekler (virgülle ayır)</label>
                <Inp value={newField.options} onChange={e=>setNewField(f=>({...f,options:e.target.value}))} placeholder="Düşük, Orta, Yüksek" />
              </div>
            )}
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>setShowAdd(false)} style={{ padding:'6px 14px', background:'none', border:'1px solid rgba(0,0,0,0.1)', borderRadius:6, fontSize:13, color:'#6b6b6b', cursor:'pointer' }}>İptal</button>
              <button onClick={addFieldDef} style={{ padding:'6px 14px', background:'#5e6ad2', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:500, cursor:'pointer' }}>Kaydet</button>
            </div>
          </div>
        ) : (
          <button onClick={()=>setShowAdd(true)} style={{ width:'100%', padding:'8px', border:'1px dashed rgba(0,0,0,0.15)', borderRadius:7, background:'none', cursor:'pointer', fontSize:13, color:'#6b6b6b', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            <span style={{ fontSize:16 }}>+</span> Yeni alan ekle
          </button>
        )
      )}
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
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  async function addNote() {
    if (!noteInput.trim() || isNew) return
    const notes = [...(modal.notes||[]), { text: noteInput.trim(), time: new Date().toISOString(), author: profile?.initials||'?' }]
    await supabase.from('tasks').update({ notes, updated_at: new Date().toISOString() }).eq('id', modal.id)

    // Notify assignee if different from noter
    if (modal.assignee_id && modal.assignee_id !== user.id) {
      await sendNotification(supabase, {
        userId: modal.assignee_id, type: 'commented',
        taskId: modal.id, taskTitle: modal.title,
        message: `${profile?.full_name||'Biri'} yorum yaptı: "${noteInput.trim().slice(0,60)}"`
      })
    }
    setNoteInput('')
    setModal(prev => ({ ...prev, notes }))
  }

  const tabs = isNew
    ? [['detail','Detaylar']]
    : [
        ['detail','Detaylar'],
        ['subtasks', `Alt Görevler`],
        ['deps','Bağımlılıklar'],
        ['fields','Özel Alanlar'],
        ['notes', `Notlar${modal.notes?.length?` (${modal.notes.length})`:''}`],
        ['activity','Geçmiş'],
      ]

  const taskActivity = !isNew ? activity.filter(a => a.task_id === modal.id) : []

  function actionMeta(a) {
    return ({ created:{icon:'✦',bg:'#dcfce7'}, updated:{icon:'✎',bg:'#fef3c7'}, moved:{icon:'→',bg:'#dbeafe'}, note:{icon:'✉',bg:'#ede9fe'}, deleted:{icon:'✕',bg:'#fee2e2'} }[a]) || {icon:'·',bg:'#f0efec'}
  }

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.25)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, backdropFilter:'blur(3px)' }}>
      <div style={{ background:'#fff', borderRadius:16, width:580, maxWidth:'95vw', maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:'0 8px 40px rgba(0,0,0,0.14)', border:'1px solid rgba(0,0,0,0.08)' }}>

        {/* Header */}
        <div style={{ padding:'18px 20px 0', borderBottom:'1px solid rgba(0,0,0,0.08)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <span style={{ fontSize:14, fontWeight:600, letterSpacing:'-0.01em' }}>{isNew?'Yeni İş Ekle':'Görevi Düzenle'}</span>
            <button onClick={()=>setModal(null)} style={{ width:28, height:28, borderRadius:6, border:'none', background:'none', cursor:'pointer', fontSize:18, color:'#9b9b9b' }}>×</button>
          </div>
          <div style={{ display:'flex', gap:2, marginBottom:-1, overflowX:'auto', flexShrink:0 }}>
            {tabs.map(([id,lbl])=>(
              <button key={id} onClick={()=>setActiveTab(id)}
                style={{ padding:'6px 12px', borderRadius:'6px 6px 0 0', border:'none', cursor:'pointer', fontSize:12, fontWeight:500, whiteSpace:'nowrap', transition:'all 150ms',
                  background: activeTab===id?'#fff':'none',
                  color: activeTab===id?'#1a1a1a':'#6b6b6b',
                  borderBottom: activeTab===id?'2px solid #5e6ad2':'2px solid transparent',
                }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflow:'auto', padding:'18px 20px' }}>

          {/* ── DETAIL TAB ── */}
          {activeTab==='detail' && (
            <>
              <Field label="Görev adı">
                <Inp value={form.title||''} onChange={e=>setForm(f=>({...f,title:e.target.value}))}
                  placeholder="Ne yapılacak?" autoFocus onKeyDown={e=>e.key==='Enter'&&save()} />
              </Field>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                <Field label="Durum">
                  <Sel value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                    {COLUMNS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                  </Sel>
                </Field>
                <Field label="Öncelik">
                  <Sel value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>
                    <option value="low">Düşük</option>
                    <option value="mid">Orta</option>
                    <option value="high">Acil</option>
                  </Sel>
                </Field>
                <Field label="Atanan kişi">
                  <Sel value={form.assignee_id||''} onChange={e=>setForm(f=>({...f,assignee_id:e.target.value}))}>
                    <option value="">Seç…</option>
                    {assigneeOptions.map(p=><option key={p.id} value={p.id}>{p.full_name} ({p.initials})</option>)}
                  </Sel>
                </Field>
                <Field label="Başlangıç tarihi">
                  <Inp type="date" value={form.start_date||''} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))} />
                </Field>
                <Field label="Bitiş tarihi">
                  <Inp type="date" value={form.due_date||''} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))} />
                </Field>
                <Field label="Tekrar">
                  <Sel value={form.recurrence||''} onChange={e=>setForm(f=>({...f,recurrence:e.target.value}))}>
                    {RECURRENCE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                  </Sel>
                </Field>
              </div>

              {form.recurrence && (
                <Field label="Tekrar bitiş tarihi">
                  <Inp type="date" value={form.recurrence_end||''} onChange={e=>setForm(f=>({...f,recurrence_end:e.target.value}))}
                    style={{ maxWidth:200 }} />
                </Field>
              )}

              <Field label="Etiketler (virgülle ayır)">
                <Inp value={form.tags||''} onChange={e=>setForm(f=>({...f,tags:e.target.value}))} placeholder="tasarım, backend, frontend…" />
              </Field>

              {/* Recurring info badge */}
              {!isNew && modal.recurrence && (
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:'#eef0fc', borderRadius:8, marginBottom:14, fontSize:12, color:'#5e6ad2' }}>
                  <span>🔁</span>
                  <span>Bu görev <b>{RECURRENCE_OPTIONS.find(o=>o.value===modal.recurrence)?.label}</b> tekrar ediyor</span>
                </div>
              )}

              {/* Dependency warning */}
              {!isNew && (
                <DependencyWarning taskId={modal.id} allTasks={allTasks} />
              )}
            </>
          )}

          {/* ── SUBTASKS TAB ── */}
          {activeTab==='subtasks' && !isNew && (
            <SubtasksPanel taskId={modal.id} />
          )}

          {/* ── DEPENDENCIES TAB ── */}
          {activeTab==='deps' && !isNew && (
            <DependenciesPanel taskId={modal.id} allTasks={allTasks} />
          )}

          {/* ── CUSTOM FIELDS TAB ── */}
          {activeTab==='fields' && !isNew && (
            <CustomFieldsPanel taskId={modal.id} isAdmin={isAdmin} />
          )}

          {/* ── NOTES TAB ── */}
          {activeTab==='notes' && !isNew && (
            <div>
              <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                <Inp value={noteInput} onChange={e=>setNoteInput(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&addNote()} placeholder="Not veya yorum ekle… (Enter)" />
                <button onClick={addNote} style={{ padding:'0 14px', background:'#5e6ad2', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap' }}>Ekle</button>
              </div>
              {!modal.notes?.length && <div style={{ textAlign:'center', padding:'32px 0', fontSize:13, color:'#9b9b9b' }}>Henüz not yok</div>}
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[...(modal.notes||[])].reverse().map((n,i)=>(
                  <div key={i} style={{ background:'#f7f7f5', borderRadius:8, padding:'10px 14px', borderLeft:'2px solid #5e6ad2' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                      <Avatar initials={n.author||'?'} size={18} />
                      <span style={{ fontSize:11, color:'#9b9b9b' }}>{timeAgo(n.time)}</span>
                    </div>
                    <div style={{ fontSize:13, color:'#1a1a1a', lineHeight:1.5 }}>{n.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ACTIVITY TAB ── */}
          {activeTab==='activity' && !isNew && (
            taskActivity.length===0
              ? <div style={{ textAlign:'center', padding:'32px 0', fontSize:13, color:'#9b9b9b' }}>Bu görev için aktivite yok</div>
              : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {taskActivity.map(a=>{
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
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 20px', borderTop:'1px solid rgba(0,0,0,0.08)', display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
          {!isNew && (isAdmin || modal.user_id===user?.id) && (
            <button onClick={()=>onDelete(modal.id)}
              style={{ padding:'7px 14px', background:'none', border:'1px solid rgba(0,0,0,0.1)', borderRadius:6, fontSize:13, color:'#e5484d', cursor:'pointer' }}
              onMouseEnter={e=>{e.currentTarget.style.background='#fff0f0';e.currentTarget.style.borderColor='#e5484d'}}
              onMouseLeave={e=>{e.currentTarget.style.background='none';e.currentTarget.style.borderColor='rgba(0,0,0,0.1)'}}>
              Sil
            </button>
          )}
          <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
            <button onClick={()=>setModal(null)} style={{ padding:'7px 16px', background:'none', border:'1px solid rgba(0,0,0,0.1)', borderRadius:6, fontSize:13, color:'#6b6b6b', cursor:'pointer' }}>İptal</button>
            {(isNew || activeTab==='detail') && (
              <button onClick={save} disabled={saving}
                style={{ padding:'7px 18px', background:saving?'#9b9b9b':'#5e6ad2', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:500, cursor:saving?'default':'pointer' }}>
                {saving?'Kaydediliyor…':isNew?'Ekle':'Kaydet'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Görev açıkken bağımlılık uyarısı göster
function DependencyWarning({ taskId, allTasks }) {
  const [blockers, setBlockers] = useState([])

  useEffect(() => {
    supabase.from('task_dependencies').select('*').eq('task_id', taskId).then(({ data }) => {
      if (!data?.length) return
      const ids = data.map(d => d.depends_on)
      const blocking = allTasks.filter(t => ids.includes(t.id) && t.status !== 'done')
      setBlockers(blocking)
    })
  }, [taskId, allTasks])

  if (!blockers.length) return null

  return (
    <div style={{ padding:'10px 14px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, marginBottom:14, fontSize:12, color:'#854d0e', display:'flex', gap:8, alignItems:'flex-start' }}>
      <span style={{ fontSize:16, flexShrink:0 }}>⚠️</span>
      <div>
        <div style={{ fontWeight:600, marginBottom:3 }}>Bu görev başlayamaz</div>
        <div>{blockers.map(b=>b.title).join(', ')} tamamlanması gerekiyor.</div>
      </div>
    </div>
  )
}
