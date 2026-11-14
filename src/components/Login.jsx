import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { errorTexto } from '../lib/format'
import Logo from './Logo'

export default function Login() {
  const [modo, setModo] = useState('entrar') // entrar | registro | recuperar
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  async function enviar(e) {
    e.preventDefault()
    setError(''); setAviso(''); setCargando(true)
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: clave })
        if (error) throw error
      } else if (modo === 'registro') {
        const { data, error } = await supabase.auth.signUp({
          email, password: clave, options: { emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        if (!data.session) setAviso('Le enviamos un correo para confirmar su cuenta. Ábralo y luego inicie sesión aquí.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) throw error
        setAviso('Si el correo existe, le llegará un enlace para crear una nueva contraseña.')
      }
    } catch (err) {
      setError(errorTexto(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <Logo />
        <p className="auth-sub">Sistema para lotificadoras</p>
        <h2 className="auth-title">
          {modo === 'entrar' ? 'Iniciar sesión' : modo === 'registro' ? 'Crear cuenta' : 'Recuperar contraseña'}
        </h2>
        <form onSubmit={enviar} className="form">
          <label>Correo electrónico
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {modo !== 'recuperar' && (
            <label>Contraseña
              <input type="password" required minLength={6} autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                value={clave} onChange={(e) => setClave(e.target.value)} />
            </label>
          )}
          {error && <div className="alerta error">{error}</div>}
          {aviso && <div className="alerta ok">{aviso}</div>}
          <button className="btn primario" disabled={cargando}>
            {cargando ? 'Un momento…' : modo === 'entrar' ? 'Entrar' : modo === 'registro' ? 'Crear cuenta' : 'Enviar enlace'}
          </button>
        </form>
        <div className="auth-links">
          {modo !== 'entrar' && <button className="link" onClick={() => setModo('entrar')}>Ya tengo cuenta</button>}
          {modo !== 'registro' && <button className="link" onClick={() => setModo('registro')}>Crear una cuenta nueva</button>}
          {modo === 'entrar' && <button className="link" onClick={() => setModo('recuperar')}>Olvidé mi contraseña</button>}
        </div>
      </div>
    </div>
  )
}

export function NuevaClave({ onListo }) {
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function guardar(e) {
    e.preventDefault()
    setCargando(true); setError('')
    const { error } = await supabase.auth.updateUser({ password: clave })
    setCargando(false)
    if (error) setError(errorTexto(error))
    else onListo()
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <Logo />
        <h2 className="auth-title">Nueva contraseña</h2>
        <form onSubmit={guardar} className="form">
          <label>Escriba su nueva contraseña
            <input type="password" required minLength={6} value={clave} onChange={(e) => setClave(e.target.value)} />
          </label>
          {error && <div className="alerta error">{error}</div>}
          <button className="btn primario" disabled={cargando}>Guardar contraseña</button>
        </form>
      </div>
    </div>
  )
}
