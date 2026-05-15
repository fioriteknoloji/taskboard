'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ email: '', password: '', full_name: '', initials: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function f(k) { return e => setForm(p => ({ ...p, [k]: e.target.value })) }

  async function submit() {
    setError(''); setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
        if (error) throw error
        router.push('/')
      } else {
        if (!form.full_name.trim()) throw new Error('Ad Soyad zorunlu')
        if (form.password.length < 6) throw new Error('Şifre en az 6 karakter olmalı')
        const initials = form.initials.trim() || form.full_name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
        const { error } = await supabase.auth.signUp({
          email: form.email, password: form.password,
          options: { data: { full_name: form.full_name.trim(), initials, role: 'member' } }
        })
        if (error) throw error
        setMode('login')
        setError('Kayıt başarılı! E-postanı doğrula ve giriş yap.')
      }
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const inp = { width: '100%', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '10px 13px', fontSize: 14, outline: 'none', transition: 'border-color 150ms', background: '#fff', color: '#1a1a1a' }
  const isSuccess = error && error.includes('başarılı')

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f5', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div style={{ width: 400, maxWidth: '95vw' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#5e6ad2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em', color: '#1a1a1a' }}>Ekip Panosu</h1>
          <p style={{ fontSize: 14, color: '#6b6b6b', marginTop: 4 }}>
            {mode === 'login' ? 'Hesabınla giriş yap' : 'Yeni hesap oluştur'}
          </p>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 28, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, background: isSuccess ? '#f0fdf4' : '#fff0f0', color: isSuccess ? '#15803d' : '#e5484d', border: `1px solid ${isSuccess ? '#bbf7d0' : '#fecaca'}` }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {mode === 'register' && (
              <>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#9b9b9b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Ad Soyad</label>
                  <input style={inp} placeholder="Ahmet Kaya" value={form.full_name} onChange={f('full_name')}
                    onFocus={e => e.target.style.borderColor = '#5e6ad2'} onBlur={e => e.target.style.borderColor = 'rgba(0,0,0,0.12)'} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#9b9b9b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>
                    Kısaltma <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opsiyonel, örn. AK)</span>
                  </label>
                  <input style={inp} placeholder="AK" maxLength={3} value={form.initials} onChange={f('initials')}
                    onFocus={e => e.target.style.borderColor = '#5e6ad2'} onBlur={e => e.target.style.borderColor = 'rgba(0,0,0,0.12)'} />
                </div>
              </>
            )}

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#9b9b9b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>E-posta</label>
              <input style={inp} type="email" placeholder="ahmet@sirket.com" value={form.email} onChange={f('email')}
                onFocus={e => e.target.style.borderColor = '#5e6ad2'} onBlur={e => e.target.style.borderColor = 'rgba(0,0,0,0.12)'}
                onKeyDown={e => e.key === 'Enter' && submit()} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#9b9b9b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Şifre</label>
              <input style={inp} type="password" placeholder="••••••••" value={form.password} onChange={f('password')}
                onFocus={e => e.target.style.borderColor = '#5e6ad2'} onBlur={e => e.target.style.borderColor = 'rgba(0,0,0,0.12)'}
                onKeyDown={e => e.key === 'Enter' && submit()} />
            </div>

            <button onClick={submit} disabled={loading}
              style={{ marginTop: 4, width: '100%', padding: '11px 0', background: loading ? '#9b9b9b' : '#5e6ad2', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? 'default' : 'pointer', transition: 'background 150ms', letterSpacing: '-0.01em' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#4f5bc7' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#5e6ad2' }}>
              {loading ? 'Lütfen bekle…' : mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}
            </button>
          </div>

          <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: '#6b6b6b' }}>
            {mode === 'login' ? 'Hesabın yok mu? ' : 'Zaten hesabın var mı? '}
            <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
              style={{ background: 'none', border: 'none', color: '#5e6ad2', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              {mode === 'login' ? 'Kayıt ol' : 'Giriş yap'}
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#9b9b9b', marginTop: 20 }}>
          Ekip Panosu © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
