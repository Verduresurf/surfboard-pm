import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://yatevanttwurbkvktekb.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_8crP1D2lP7gJS884Mj3vtQ_vdGGzZM_'

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase env vars')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

console.log('[Supabase] client initialised →', SUPABASE_URL)
