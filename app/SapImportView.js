'use client'

import { useState, useRef } from 'react'
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Trash2, Database } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function SapImportView({ profiles, user, projects=[] }) {
  const [dragOver, setDragOver] = useState(false)
  const [parsedData, setParsedData] = useState([])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef(null)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) processFile(file)
  }

  const processFile = (file) => {
    setErrorMsg('')
    setSuccess(false)
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target.result
      if (file.name.endsWith('.xml')) {
        parseODataXML(content)
      } else {
        setErrorMsg('Lütfen SAP OData XML çıktısını yükleyin (.xml).')
      }
    }
    reader.readAsText(file)
  }

  const parseODataXML = (xmlText) => {
    try {
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(xmlText, "text/xml")
      const entries = xmlDoc.getElementsByTagName("entry")
      
      const results = []
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        const props = entry.getElementsByTagName("m:properties")[0] || entry.getElementsByTagName("properties")[0]
        if (!props) continue

        const getVal = (tag) => {
          const el = props.getElementsByTagName("d:" + tag)[0] || props.getElementsByTagName(tag)[0]
          return el ? el.textContent : ''
        }

        const dateStr = getVal("zzactdat")
        const vorna = getVal("vorna")
        const nachn = getVal("nachn")
        const title = getVal("tanim")
        const proj = getVal("zzproje")
        const projName = getVal("zzprj_tanim")
        const hours = getVal("zzactsaat")
        const loc = getVal("zzlokasyon_yeri")
        const matnr = getVal("matnr")

        const fullName = `${vorna} ${nachn}`.trim()
        
        let assigneeId = null
        if (fullName) {
          const matched = profiles.find(p => p.full_name.toLowerCase() === fullName.toLowerCase())
          if (matched) assigneeId = matched.id
        }

        let projectId = null
        if (proj) {
          // proj might be "DRT14". match with project name or ID.
          const matchedProj = projects.find(p => p.name.toUpperCase().includes(proj.toUpperCase()))
          if (matchedProj) projectId = matchedProj.id
        }

        results.push({
          id: Math.random().toString(36).substr(2, 9),
          title: `[${proj}] ${projName} - ${title}`,
          status: 'todo',
          priority: 'mid',
          assignee_id: assigneeId,
          assignee_name: fullName,
          project_id: projectId,
          due_date: dateStr ? dateStr.split('T')[0] : null,
          tags: [matnr, loc].filter(Boolean),
          notes: [{ text: `Sistemden aktarıldı.`, created_at: new Date().toISOString() }],
          estimated_hours: hours ? parseFloat(hours) : null,
          customer: title,
          description: `SAP Aktarımı:\nProje: ${projName}\nMüşteri: ${title}\nLokasyon: ${loc}`
        })
      }
      
      if (results.length === 0) {
        setErrorMsg("XML dosyasında geçerli bir <entry> kaydı bulunamadı. Lütfen doğru Fiori OData çıktısı olduğundan emin olun.")
      } else {
        setParsedData(results)
      }
    } catch (err) {
      setErrorMsg('XML ayrıştırılırken hata oluştu: ' + err.message)
    }
  }

  const handleImport = async () => {
    if (parsedData.length === 0) return
    setLoading(true)
    setErrorMsg('')

    try {
      const inserts = parsedData.map(item => ({
        title: item.title,
        status: item.status,
        priority: item.priority,
        assignee_id: item.assignee_id,
        user_id: user.id,
        project_id: item.project_id,
        due_date: item.due_date,
        tags: item.tags,
        notes: item.notes,
        estimated_hours: item.estimated_hours,
        customer: item.customer,
        description: item.description,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))

      const { error } = await supabase.from('tasks').insert(inserts)
      if (error) throw error

      setSuccess(true)
      setParsedData([])
    } catch (err) {
      setErrorMsg('İçe aktarma sırasında hata oluştu: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const removeRow = (id) => {
    setParsedData(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Database size={24} color="var(--accent)" />
          SAP Fiori Entegrasyonu
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          SAP sisteminden aldığınız OData XML çıktısını yükleyerek haftalık planlarınızı otomatik olarak panoya aktarabilirsiniz.
        </p>
      </div>

      {success && (
        <div style={{ padding: '12px 16px', background: 'var(--green-light)', border: '1px solid var(--green)', borderRadius: 'var(--radius-md)', color: 'var(--green)', fontSize: 14, fontWeight: 500, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={18} />
          Görevler başarıyla Supabase'e aktarıldı ve panoya eklendi! Menüden 'Pano'ya dönebilirsiniz.
        </div>
      )}

      {errorMsg && (
        <div style={{ padding: '12px 16px', background: 'var(--red-light)', border: '1px solid var(--red)', borderRadius: 'var(--radius-md)', color: 'var(--red)', fontSize: 14, fontWeight: 500, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={18} />
          {errorMsg}
        </div>
      )}

      <div 
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border-strong)'}`,
          background: dragOver ? 'var(--accent-light)' : 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          padding: '40px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
          marginBottom: 24
        }}
      >
        <UploadCloud size={48} color={dragOver ? 'var(--accent)' : 'var(--text-tertiary)'} style={{ marginBottom: 12, margin: '0 auto' }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>XML Dosyasını Sürükleyin veya Seçin</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>Desteklenen formatlar: OData XML</div>
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".xml" style={{ display: 'none' }} />
      </div>

      {parsedData.length > 0 && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              Önizleme: {parsedData.length} Görev Bulundu
            </div>
            <button 
              onClick={handleImport} 
              disabled={loading}
              className="btn-primary" 
              style={{ padding: '8px 16px', fontSize: 13, height: 36, display: 'flex', alignItems: 'center', gap: 6, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <Database size={16} />}
              {loading ? 'Aktarılıyor...' : 'Panoya Aktar'}
            </button>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Tarih</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Personel (Atama)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Başlık & Proje</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {parsedData.map((row, i) => (
                  <tr key={row.id} style={{ borderBottom: i === parsedData.length - 1 ? 'none' : '1px solid var(--border)', background: 'var(--bg)' }}>
                    <td style={{ padding: '12px 16px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {row.due_date ? new Date(row.due_date).toLocaleDateString('tr-TR') : '-'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {row.assignee_name ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{row.assignee_name}</span>
                          {row.assignee_id ? 
                            <span style={{ fontSize: 10, background: 'var(--green-light)', color: 'var(--green)', padding: '2px 6px', borderRadius: 99 }}>Eşleşti</span> : 
                            <span style={{ fontSize: 10, background: 'var(--amber-light)', color: 'var(--amber)', padding: '2px 6px', borderRadius: 99 }}>Havuz</span>
                          }
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Belirtilmedi</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>
                      <div style={{ fontWeight: 500, marginBottom: 4 }}>{row.title}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {row.tags.map(t => <span key={t} style={{ fontSize: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: 4, color: 'var(--text-secondary)' }}>{t}</span>)}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button onClick={() => removeRow(row.id)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4 }} title="Bu satırı sil">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
