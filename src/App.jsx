import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login, { NuevaClave } from './components/Login'
import Shell from './components/Shell'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [recuperando, setRecuperando] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true)
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <div className="splash">Cargando…</div>
  if (recuperando) return <NuevaClave onListo={() => setRecuperando(false)} />
  return session ? <Shell session={session} /> : <Login />
}
