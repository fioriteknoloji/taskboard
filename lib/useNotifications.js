'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  const fetch = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications(data || [])
    setUnreadCount((data || []).filter(n => !n.read).length)
  }, [userId])

  useEffect(() => {
    fetch()
    if (!userId) return
    const ch = supabase.channel('notif-' + userId)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, fetch)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [userId, fetch])

  async function markRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  async function markAllRead() {
    if (!userId) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  return { notifications, unreadCount, markRead, markAllRead, refetch: fetch }
}

export async function sendNotification(supabase, { userId, type, taskId, taskTitle, message }) {
  if (!userId) return
  await supabase.from('notifications').insert({ user_id: userId, type, task_id: taskId, task_title: taskTitle, message })
}
