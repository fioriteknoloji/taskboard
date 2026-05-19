import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'fake-key'

const getSupabase = () => {
  return createClient(supabaseUrl, supabaseAnonKey)
}

const supabase = new Proxy({}, {
  get(target, prop) {
    const client = getSupabase()
    const value = client[prop]
    return typeof value === 'function' ? value.bind(client) : value
  }
})

try {
  const query = supabase.from('tasks').select('*')
  console.log('Proxy test success:', typeof query.then)
} catch (e) {
  console.error('Proxy test error:', e)
}
