import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { calcCuota, errorTexto, hoyISO, money, round2, sumarMeses } from '../lib/format'

export default function VentaForm({ lote, lotif, primaPct, plazo, onCancelar, onListo }) {
  const hoy = hoyISO()
  const [f, setF] = useState({
    nombre: lote.reservado_nombre || '',
    telefono: lote.reservado_telefono || '',
    documento: '',
    prima: round2((lote.precio * primaPct) / 100),
    tasa: Number(lotif.tasa_anual),
    plazo,
    fecha_venta: hoy,
    primera: sumarMeses(hoy, 1),
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const financiado = Math.max(0, lote.precio - Number(f.prima || 0))
  const cuota = calcCuota(financiado, f.tasa, Number(f.plazo) * 12)

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true); setError('')
    const { error } = await supabase.rpc('crear_venta', {
      p_lote_id: lote.id,
      p_cliente_nombre: f.nombre,
      p_cliente_telefono: f.telefono,
      p_cliente_documento: f.documento,
      p_prima: Number(f.prima),
      p_tasa_anual: Number(f.tasa),
      p_plazo_meses: Math.round(Number(f.plazo) * 12),
      p_fecha_venta: f.fecha_venta,
      p_fecha_primera_cuota: f.primera,
    })
    setGuardando(false)
    if (error) setError(errorTexto(error))
    else onListo()
  }

  return (
    <form className="form" onSubmit={guardar}>
      <label>Nombre del cliente
        <input required value={f.nombre} onChange={set('nombre')} />
      </label>
      <div className="dos">
        <label>WhatsApp / teléfono
          <input inputMode="tel" placeholder="7000-0000" value={f.telefono} onChange={set('telefono')} />
        </label>
        <label>DUI (opcional)
          <input value={f.documento} onChange={set('documento')} />
        </label>
      </div>
      <div className="dos">
        <label>Precio
          <input value={money(lote.precio)} disabled />
        </label>
        <label>Prima ($)
          <input type="number" min="0" max={lote.precio} step="0.01" required value={f.prima} onChange={set('prima')} />
        </label>
      </div>
      <div className="dos">
        <label>Interés anual (%)
          <input type="number" min="0" max="100" step="0.01" required value={f.tasa} onChange={set('tasa')} />
        </label>
        <label>Plazo (años)
          <input type="number" min="0.5" max="40" step="0.5" required value={f.plazo} onChange={set('plazo')} />
        </label>
      </div>
      <div className="dos">
        <label>Fecha de venta
          <input type="date" required value={f.fecha_venta} onChange={set('fecha_venta')} />
        </label>
        <label>Primera cuota
          <input type="date" required value={f.primera} onChange={set('primera')} />
        </label>
      </div>
      <div className="resumen-venta">
        <span>Monto a financiar <b>{money(financiado)}</b></span>
        <span>Cuota mensual <b className="verde">{money(cuota)}</b></span>
      </div>
      {error && <div className="alerta error">{error}</div>}
      <button className="btn primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar venta'}</button>
      <button type="button" className="btn sutil" onClick={onCancelar}>Cancelar</button>
    </form>
  )
}
