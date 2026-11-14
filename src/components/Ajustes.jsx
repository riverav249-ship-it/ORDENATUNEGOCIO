import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { errorTexto } from '../lib/format'
import Modal from './Modal'

export default function Ajustes({ lotif, lotes, email, onCerrar, onCambio, onNueva }) {
  const [f, setF] = useState({
    nombre: lotif.nombre, ubicacion: lotif.ubicacion || '', whatsapp: lotif.whatsapp || '',
    tasa_anual: lotif.tasa_anual, prima_pct: lotif.prima_pct, plazo_anios: lotif.plazo_anios,
  })
  const ultimo = lotes.reduce((m, l) => (l.bloque.localeCompare(m, 'es', { numeric: true }) > 0 ? l.bloque : m), 'A')
  const [nl, setNl] = useState({ bloque: ultimo, cantidad: 1, area: lotes[0]?.area_m2 || 200, precio: lotes[0]?.precio || 40000 })
  const [msg, setMsg] = useState({ t: '', ok: true })
  const [ocupado, setOcupado] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function guardar(e) {
    e.preventDefault()
    setOcupado(true)
    const { error } = await supabase.from('lotificaciones').update({
      nombre: f.nombre.trim(), ubicacion: f.ubicacion || null, whatsapp: f.whatsapp || null,
      tasa_anual: Number(f.tasa_anual), prima_pct: Number(f.prima_pct), plazo_anios: Number(f.plazo_anios),
    }).eq('id', lotif.id)
    setOcupado(false)
    if (error) setMsg({ t: errorTexto(error), ok: false })
    else { setMsg({ t: 'Datos guardados.', ok: true }); onCambio() }
  }

  async function agregar(e) {
    e.preventDefault()
    const b = nl.bloque.trim().toUpperCase()
    const max = lotes.filter((l) => l.bloque === b).reduce((m, l) => Math.max(m, l.numero), 0)
    const filas = Array.from({ length: Number(nl.cantidad) }, (_, i) => ({
      lotificacion_id: lotif.id, bloque: b, numero: max + i + 1, codigo: `${b}-${max + i + 1}`,
      area_m2: Number(nl.area), precio: Number(nl.precio),
    }))
    setOcupado(true)
    const { error } = await supabase.from('lotes').insert(filas)
    setOcupado(false)
    if (error) setMsg({ t: errorTexto(error), ok: false })
    else { setMsg({ t: `Se agregaron ${filas.length} lote(s) al bloque ${b}.`, ok: true }); onCambio() }
  }

  return (
    <Modal titulo="Ajustes" onCerrar={onCerrar}>
      {msg.t && <div className={'alerta ' + (msg.ok ? 'ok' : 'error')}>{msg.t}</div>}
      <form className="form" onSubmit={guardar}>
        <h4>Datos de la lotificación</h4>
        <label>Nombre<input required value={f.nombre} onChange={set('nombre')} /></label>
        <div className="dos">
          <label>Ubicación<input value={f.ubicacion} onChange={set('ubicacion')} /></label>
          <label>WhatsApp de ventas<input inputMode="tel" value={f.whatsapp} onChange={set('whatsapp')} /></label>
        </div>
        <div className="tres">
          <label>Interés anual %<input type="number" min="0" step="0.01" value={f.tasa_anual} onChange={set('tasa_anual')} /></label>
          <label>Prima %<input type="number" min="0" max="100" step="0.5" value={f.prima_pct} onChange={set('prima_pct')} /></label>
          <label>Plazo años<input type="number" min="1" max="40" value={f.plazo_anios} onChange={set('plazo_anios')} /></label>
        </div>
        <p className="nota">El interés, prima y plazo se usan para nuevas cotizaciones y ventas; no cambian las ventas ya registradas.</p>
        <button className="btn primario" disabled={ocupado}>Guardar datos</button>
      </form>

      <form className="form" onSubmit={agregar}>
        <h4>Agregar lotes</h4>
        <div className="dos">
          <label>Bloque<input required maxLength={4} value={nl.bloque} onChange={(e) => setNl({ ...nl, bloque: e.target.value })} /></label>
          <label>Cantidad<input type="number" min="1" max="200" required value={nl.cantidad} onChange={(e) => setNl({ ...nl, cantidad: e.target.value })} /></label>
        </div>
        <div className="dos">
          <label>Área (m²)<input type="number" min="0" step="0.01" required value={nl.area} onChange={(e) => setNl({ ...nl, area: e.target.value })} /></label>
          <label>Precio ($)<input type="number" min="0" step="0.01" required value={nl.precio} onChange={(e) => setNl({ ...nl, precio: e.target.value })} /></label>
        </div>
        <button className="btn" disabled={ocupado}>Agregar lotes</button>
      </form>

      <div className="form">
        <h4>Más opciones</h4>
        <button className="btn" onClick={onNueva}>Crear otra lotificación</button>
        <p className="nota">Sesión iniciada como {email}</p>
        <button className="btn sutil" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
      </div>
    </Modal>
  )
}
