'use client'

import { useEffect, useRef } from 'react'

function timeAgo(ts) {
  const d = Date.now() - new Date(ts).getTime()
  if (d < 60000) return 'az önce'
  if (d < 3600000) return `${Math.floor(d/60000)}dk önce`
  if (d < 86400000) return `${Math.floor(d/3600000)}sa önce`
  return `${Math.floor(d/86400000)}g önce`
}

const TYPE_META = {
  assigned:         { icon: '👤', label: 'Görev atandı' },
  commented:        { icon: '💬', label: 'Yorum yapıldı' },
  deadline:         { icon: '⏰', label: 'Deadline yaklaşıyor' },
  status_changed:   { icon: '→',  label: 'Durum değişti' },
  dependency_done:  { icon: '✅', label: 'Bağımlılık tamamlandı' },
}

export default function NotificationPanel({ notifications, unreadCount, markRead, markAllRead, onClose }) {
  const ref = useRef()

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} style={{
      position: 'absolute', top: 44, right: 0, width: 340, maxHeight: 480,
      background: '#fff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.1)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 500, display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>Bildirimler</span>
          {unreadCount > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, background: '#5e6ad2', color: '#fff', padding: '1px 7px', borderRadius: 99 }}>{unreadCount}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} style={{ fontSize: 11, color: '#5e6ad2', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
            Tümünü okundu say
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: '#9b9b9b' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
            <div style={{ fontSize: 13 }}>Bildirim yok</div>
          </div>
        ) : (
          notifications.map(n => {
            const meta = TYPE_META[n.type] || { icon: '·', label: n.type }
            return (
              <div key={n.id}
                onClick={() => markRead(n.id)}
                style={{
                  padding: '11px 16px', borderBottom: '1px solid rgba(0,0,0,0.05)',
                  background: n.read ? '#fff' : '#fafafe',
                  cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start',
                  transition: 'background 150ms',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f7f7f5'}
                onMouseLeave={e => e.currentTarget.style.background = n.read ? '#fff' : '#fafafe'}
              >
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: n.read ? '#f0efec' : '#eef0fc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                  {meta.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {n.task_title && (
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                      {n.task_title}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: '#6b6b6b', lineHeight: 1.4 }}>{n.message}</div>
                  <div style={{ fontSize: 10, color: '#9b9b9b', marginTop: 3 }}>{timeAgo(n.created_at)}</div>
                </div>
                {!n.read && (
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#5e6ad2', flexShrink: 0, marginTop: 4 }} />
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
