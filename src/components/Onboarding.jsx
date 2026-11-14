import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { errorTexto, letraBloque } from '../lib/format'
import Logo from './Logo'

export async function crearLotes(lotificacionId, bloques, porBloque, area, precio, desdeBloque = 0) {
  const filas = []
  for (let b = 0; b < bloques; b++) {
    const letra = letraBloque(desdeBloque + b)
    for (let n = 1; n <= porBloque; n++)
      filas.push({ lotificacion_id: lotificacionId, bloque: letra, numero: n, codigo: `${letra}-${n}`, area_m2: area, precio })
  }
  const { error } = await supabase.from('lotes').insert(filas)
  if (error) throw error
}

export default function Onboarding({ onListo, puedeCancelar, onCancelar }) {
  const [f, setF] = useState({
    nombre: '', ubicacion: '', whatsapp: '', bloques: 7, porBloque: 6, area: 200, precio: 40000, tasa: 12, prima: 5, plazo: 12,
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function crear(e) {
    e.preventDefault()
    setGuardando(true); setError('')
    try {
      const { data, error } = await supabase.from('lotificaciones').insert({
        nombre: f.nombre.trim(), ubicacion: f.ubicacion || null, whatsapp: f.whatsapp || null,
        tasa_anual: Number(f.tasa), prima_pct: Number(f.prima), plazo_anios: Number(f.plazo),
      }).select().single()
      if (error) throw error
      await crearLotes(data.id, Number(f.bloques), Number(f.porBloque), Number(f.area), Number(f.precio))
      await onListo(data.id)
    } catch (err) {
      setError(errorTexto(err))
    } finally {
      setGuardando(false)
    }
  }

  async function demo() {
    setGuardando(true); setError('')
    const { data, error } = await supabase.rpc('cargar_demo')
    setGuardando(false)
    if (error) setError(errorTexto(error))
    else await onListo(data)
  }

  return (
    <div className="auth">
      <div className="auth-card ancha">
        <Logo />
        <p className="auth-sub">Sistema para lotificadoras</p>
        <h2 className="auth-title">Configure su lotificación</h2>
        <p className="nota">Escriba los datos básicos y creamos el mapa de lotes. Después puede editar cada lote (área, precio) o agregar más.</p>
        <form className="form" onSubmit={crear}>
          <label>Nombre de la lotificación
            <input required value={f.nombre} onChange={set('nombre')} placeholder="Residencial Las Palmeras" />
          </label>
          <div className="dos">
            <label>Ubicación
              <input value={f.ubicacion} onChange={set('ubicacion')} placeholder="Municipio, departamento" />
            </label>
            <label>WhatsApp de ventas
              <input inputMode="tel" value={f.whatsapp} onChange={set('whatsapp')} placeholder="7000-0000" />
            </label>
          </div>
          <div className="dos">
            <label>Cantidad de bloques (A, B, C…)
              <input type="number" min="1" max="60" required value={f.bloques} onChange={set('bloques')} />
            </label>
            <label>Lotes por bloque
              <input type="number" min="1" max="100" required value={f.porBloque} onChange={set('porBloque')} />
            </label>
          </div>
          <div className="dos">
            <label>Área típica (m²)
              <input type="number" min="0" step="0.01" required value={f.area} onChange={set('area')} />
            </label>
            <label>Precio típico ($)
              <input type="number" min="0" step="0.01" required value={f.precio} onChange={set('precio')} />
            </label>
          </div>
          <div className="tres">
            <label>Interés anual %
              <input type="number" min="0" step="0.01" required value={f.tasa} onChange={set('tasa')} />
            </label>
            <label>Prima %
              <input type="number" min="0" max="100" step="0.5" required value={f.prima} onChange={set('prima')} />
            </label>
            <label>Plazo (años)
              <input type="number" min="1" max="40" required value={f.plazo} onChange={set('plazo')} />
            </label>
          </div>
          <p className="nota">Se crearán {Number(f.bloques) * Number(f.porBloque) || 0} lotes.</p>
          {error && <div className="alerta error">{error}</div>}
          <button className="btn primario" disabled={guardando}>{guardando ? 'Creando…' : 'Crear lotificación'}</button>
        </form>
        <div className="separador"><span>o</span></div>
        <button className="btn" onClick={demo} disabled={guardando}>Probar con datos de ejemplo</button>
        {puedeCancelar && <button className="btn sutil" onClick={onCancelar}>Cancelar</button>}
        {!puedeCancelar && <button className="link" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>}
      </div>
    </div>
  )
}
