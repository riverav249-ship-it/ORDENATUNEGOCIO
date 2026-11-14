import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { errorTexto, fecha, hoyISO, money, nroRecibo } from '../lib/format'
import Recibo from './Recibo'

const FORMAS = ['Efectivo', 'Transferencia', 'Depósito', 'Tarjeta', 'Cheque']

export default function Cobros({ lotif, datos, recargar, ventaInicial, limpiarInicial }) {
  const activas = useMemo(
    () => datos.cuentas.filter((c) => c.estado === 'activa').sort((a, b) => a.cliente_nombre.localeCompare(b.cliente_nombre, 'es')),
    [datos.cuentas],
  )
  const [ventaId, setVentaId] = useState(ventaInicial || '')
  const [tipo, setTipo] = useState('cuota')
  const [monto, setMonto] = useState('')
  const [forma, setForma] = useState('Efectivo')
  const [fechaPago, setFechaPago] = useState(hoyISO())
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [recibo, setRecibo] = useState(null)

  const cuenta = datos.cuentas.find((c) => c.id === ventaId)

  useEffect(() => {
    if (ventaInicial) { setVentaId(ventaInicial); setRecibo(null); limpiarInicial() }
  }, [ventaInicial, limpiarInicial])

  useEffect(() => {
    if (!cuenta) { setMonto(''); return }
    const n = Math.max(1, cuenta.cuotas_atrasadas)
    setMonto(tipo === 'cuota' ? (Number(cuenta.cuota) * n).toFixed(2) : '')
  }, [ventaId, tipo]) // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true); setError('')
    const { data, error } = await supabase.rpc('registrar_pago', {
      p_venta_id: ventaId, p_monto: Number(monto), p_tipo: tipo, p_forma_pago: forma, p_fecha: fechaPago, p_nota: nota || null,
    })
    setGuardando(false)
    if (error) { setError(errorTexto(error)); return }
    setRecibo({
      ...data,
      cliente: cuenta.cliente_nombre,
      telefono: cuenta.cliente_telefono,
      lote: cuenta.lote_codigo,
    })
    setNota('')
    recargar()
  }

  const verRecibo = (p) =>
    setRecibo({ ...p, cliente: p.ventas.clientes?.nombre, telefono: p.ventas.clientes?.telefono, lote: p.ventas.lotes.codigo })

  if (recibo)
    return (
      <div>
        <Recibo r={recibo} lotif={lotif} />
        <button className="btn sutil ancho" onClick={() => { setRecibo(null); setVentaId('') }}>Registrar otro pago</button>
      </div>
    )

  return (
    <div>
      <h2 className="sec-titulo">Registrar pago</h2>
      <form className="form tarjeta" onSubmit={guardar}>
        <label>Cliente
          <select required value={ventaId} onChange={(e) => setVentaId(e.target.value)}>
            <option value="">Seleccione cliente / lote…</option>
            {activas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.cliente_nombre} · Lote {c.lote_codigo}{c.cuotas_atrasadas > 0 ? ` · debe ${c.cuotas_atrasadas}` : ''}
              </option>
            ))}
          </select>
        </label>
        {cuenta && (
          <div className="mini-info">
            Cuota {money(cuenta.cuota)} · Saldo {money(cuenta.saldo)}
            {cuenta.cuotas_atrasadas > 0 && <span className="rojo"> · Atrasado {money(cuenta.monto_atrasado)}</span>}
          </div>
        )}
        <label>Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="cuota">Cuota mensual</option>
            <option value="abono_capital">Abono a capital</option>
          </select>
        </label>
        <div className="dos">
          <label>Monto
            <input type="number" min="0.01" step="0.01" required value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="$" />
          </label>
          <label>Fecha
            <input type="date" required value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} />
          </label>
        </div>
        <label>Forma de pago
          <select value={forma} onChange={(e) => setForma(e.target.value)}>
            {FORMAS.map((f) => <option key={f}>{f}</option>)}
          </select>
        </label>
        <label>Nota (opcional)
          <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="N.º de transferencia, comentario…" />
        </label>
        {error && <div className="alerta error">{error}</div>}
        <button className="btn primario" disabled={guardando || !ventaId}>{guardando ? 'Guardando…' : 'Guardar pago'}</button>
      </form>

      <h2 className="sec-titulo">Últimos recibos</h2>
      {datos.pagos.length === 0 && <div className="vacio">Aún no hay pagos.</div>}
      <div className="lista">
        {datos.pagos.slice(0, 30).map((p) => (
          <button key={p.id} className="tarjeta fila-recibo" onClick={() => verRecibo(p)}>
            <span><b>N.º {nroRecibo(p.numero_recibo)}</b> · {p.ventas.clientes?.nombre} · {p.ventas.lotes.codigo}<br /><small>{fecha(p.fecha)} · {p.forma_pago}</small></span>
            <b>{money(p.monto)}</b>
          </button>
        ))}
      </div>
    </div>
  )
}
