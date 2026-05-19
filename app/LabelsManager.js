'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const PRESET_COLORS = [
  '#e5484d','#f59e0b','#22c55e','#5e6ad2','#8b5cf6',
  '#ec4899','#06b6d4','#84cc16','#f97316','#9b9b9b',
]

function Inp({ style, ...p }) {
  return <input onFocus={e=>e.target.style.borderColor='#5e6ad2'} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,0.12)'}
    style={{ width:'100%', border:'1px solid rgba(0,0,0,0.12)', borderRadius:6, padding:'7px 10px', fontSize:13, background:'#fff', color:'#1a1a1a', outline:'none', ...style }} {...p} />
}

export default function LabelsManager({ isAdmin }) {
  const [labels, setLabels] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [newLabel, setNewLabel] = useState({ name:'', color: PRESET_COLORS[0] })
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const fetch = useCallback(async () => {
    const { data } = await supabase.from('labels').select('*').order('name')
    setLabels(data || [])
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function create() {
    if (!newLabel.name.trim()) return
    setSaving(true)
    await supabase.from('labels').insert({ name: newLabel.name.trim(), color: newLabel.color })
    setNewLabel({ name:'', color: PRESET_COLORS[0] })
    setShowNew(false)
    setSaving(false)
    fetch()
  }

  async function update(id, data) {
    await supabase.from('labels').update(data).eq('id', id)
    setEditing(null)
    fetch()
  }

  async function remove(id) {
    await supabase.from('labels').delete().eq('id', id)
    fetch()
  }

  return (
    <div style={{ maxWidth:560, margin:'0 auto' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:16, fontWeight:700, letterSpacing:'-0.02em', color:'#1a1a1a' }}>Etiket Yönetimi</h2>
          <p style={{ fontSize:12, color:'#9b9b9b', marginTop:2 }}>Görevlerde kullanılacak etiketleri burada yönet</p>
        </div>
        {isAdmin && (
          <button onClick={()=>setShowNew(v=>!v)}
            style={{ padding:'7px 14px', background:'#5e6ad2', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:500, cursor:'pointer' }}>
            + Yeni Etiket
          </button>
        )}
      </div>

      {/* New label form */}
      {showNew && isAdmin && (
        <div style={{ background:'#fafafe', border:'1px solid rgba(94,106,210,0.2)', borderRadius:12, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#1a1a1a', marginBottom:12 }}>Yeni Etiket</div>
          <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:11, color:'#9b9b9b', display:'block', marginBottom:4 }}>İsim</label>
              <Inp value={newLabel.name} onChange={e=>setNewLabel(f=>({...f,name:e.target.value}))}
                placeholder="Bug, Feature, Acil…" onKeyDown={e=>e.key==='Enter'&&create()} />
            </div>
            <div>
              <label style={{ fontSize:11, color:'#9b9b9b', display:'block', marginBottom:4 }}>Renk</label>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap', width:160 }}>
                {PRESET_COLORS.map(c=>(
                  <div key={c} onClick={()=>setNewLabel(f=>({...f,color:c}))}
                    style={{ width:22, height:22, borderRadius:'50%', background:c, cursor:'pointer',
                      border: newLabel.color===c ? '2.5px solid #1a1a1a' : '2px solid transparent',
                      transition:'border 120ms', flexShrink:0 }} />
                ))}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:12 }}>
            <button onClick={()=>setShowNew(false)} style={{ padding:'6px 14px', background:'none', border:'1px solid rgba(0,0,0,0.1)', borderRadius:6, fontSize:13, color:'#6b6b6b', cursor:'pointer' }}>İptal</button>
            <button onClick={create} disabled={saving||!newLabel.name.trim()}
              style={{ padding:'6px 14px', background: newLabel.name.trim()?'#5e6ad2':'#c4c2bc', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:500, cursor: newLabel.name.trim()?'pointer':'default' }}>
              {saving?'Kaydediliyor…':'Kaydet'}
            </button>
          </div>
        </div>
      )}

      {/* Label list */}
      {labels.length === 0 ? (
        <div style={{ textAlign:'center', padding:'48px 0', color:'#9b9b9b' }}>
          <div style={{ fontSize:32, marginBottom:10 }}>🏷️</div>
          <div style={{ fontSize:14 }}>Henüz etiket yok</div>
          {isAdmin && <div style={{ fontSize:12, marginTop:4 }}>Yukarıdaki "Yeni Etiket" butonuyla ekle</div>}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {labels.map(label => (
            <div key={label.id} style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
              {editing?.id === label.id ? (
                <EditLabelRow label={editing} onSave={data=>update(label.id,data)} onCancel={()=>setEditing(null)} />
              ) : (
                <>
                  <div style={{ width:12, height:12, borderRadius:'50%', background:label.color, flexShrink:0 }} />
                  <span style={{ fontSize:13, fontWeight:500, color:'#1a1a1a', flex:1 }}>{label.name}</span>
                  <div style={{ display:'inline-flex', alignItems:'center', padding:'2px 10px', borderRadius:99, background:label.color+'22', border:`1px solid ${label.color}44` }}>
                    <span style={{ fontSize:11, fontWeight:500, color:label.color }}>{label.name}</span>
                  </div>
                  {isAdmin && (
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={()=>setEditing({...label})}
                        style={{ padding:'4px 10px', background:'#f0efec', border:'none', borderRadius:5, fontSize:11, cursor:'pointer', color:'#6b6b6b' }}>Düzenle</button>
                      <button onClick={()=>remove(label.id)}
                        style={{ padding:'4px 10px', background:'none', border:'1px solid rgba(229,72,77,0.2)', borderRadius:5, fontSize:11, cursor:'pointer', color:'#e5484d' }}>Sil</button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EditLabelRow({ label, onSave, onCancel }) {
  const [name, setName] = useState(label.name)
  const [color, setColor] = useState(label.color)

  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, flex:1 }}>
      <input value={name} onChange={e=>setName(e.target.value)}
        style={{ flex:1, border:'1px solid #5e6ad2', borderRadius:6, padding:'5px 8px', fontSize:13, outline:'none' }} />
      <div style={{ display:'flex', gap:3 }}>
        {PRESET_COLORS.map(c=>(
          <div key={c} onClick={()=>setColor(c)}
            style={{ width:18, height:18, borderRadius:'50%', background:c, cursor:'pointer',
              border: color===c?'2.5px solid #1a1a1a':'2px solid transparent' }} />
        ))}
      </div>
      <button onClick={()=>onSave({name:name.trim(),color})} style={{ padding:'4px 10px', background:'#5e6ad2', color:'#fff', border:'none', borderRadius:5, fontSize:11, cursor:'pointer', fontWeight:500 }}>Kaydet</button>
      <button onClick={onCancel} style={{ padding:'4px 10px', background:'none', border:'1px solid rgba(0,0,0,0.1)', borderRadius:5, fontSize:11, cursor:'pointer', color:'#6b6b6b' }}>İptal</button>
    </div>
  )
}
