import { getSupabaseServerClient } from '@/lib/supabase/client'

export function getDb() {
  return getSupabaseServerClient()
}

export default getDb
