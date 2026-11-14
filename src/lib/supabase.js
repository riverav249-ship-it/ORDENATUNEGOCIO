import { createClient } from '@supabase/supabase-js'

// La clave publicable es pública por diseño; los datos se protegen con RLS en Supabase.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://nfbypsinqlsjqpwavewz.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_RfgQoiqVnfQ8QA6uBz5LFQ_cuLLesUp'

export const supabase = createClient(url, key)
