import { supabase } from './supabaseClient'

export async function signUp(email: string, password: string) {
  return await supabase.auth.signUp({ email, password })
}

export async function signIn(email: string, password: string) {
  return await supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return await supabase.auth.signOut()
}

export async function getUserRole() {
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role || null
}
