import { useState } from 'react'
import { abrirWhatsApp, fechaCorta, money } from '../lib/format'

export function mensajeRecordatorio(c, lotif) {
  const n = c.cuotas_atrasadas
  return (
    `Estimado(a) ${c.cliente_nombre}:\n\n` +
    `Le saludamos de ${lotif.nombre}. Le recordamos que su lote ${c.lote_codigo} tiene ` +
    `*${n} ${n === 1 ? 'cuota pendiente' : 'cuotas pendientes'}* por *${money(c.monto_atrasado)}*.\n\n` +
    `Le agradecemos ponerse al día.`
  )
}

export function mensajeAviso(c, lotif) {
  return (
    `Estimado(a) ${c.cliente_nombre}:\n\n` +
    `Le saludamos de ${lotif.nombre}. Le recordamos que su próxima cuota del lote ${c.lote_codigo} ` +
    `por ${money(c.cuota)} vence el ${fechaCorta(c.proxima_cuota)}.\n\n¡Gracias por su puntualidad!`
  )
}

export default function Alertas({ lotif, cuentas, irACobro }) {
  const [busca, setBusca] = useState('')
  const q = busca.trim().toLowerCase()
  const filtra = (c) => !q || c.cliente_nombre.toLowerCase().includes(q) || c.lote_codigo.toLowerCase().includes(q)

  const atrasados = cuentas
    .filter((c) => c.cuotas_atrasadas > 0 && filtra(c))
    .sort((a, b) => b.cuotas_atrasadas - a.cuotas_atrasadas || b.monto_atrasado - a.monto_atrasado)
  const alDia = cuentas
    .filter((c) => c.estado === 'activa' && c.cuotas_atrasadas === 0 && filtra(c))
    .sort((a, b) => a.proxima_cuota.localeCompare(b.proxima_cuota))
  const totalAtraso = atrasados.reduce((s, c) => s + Number(c.monto_atrasado), 0)

  if (cuentas.length === 0)
    return <div className="vacio">Aún no hay ventas registradas. Venda un lote desde el Mapa.</div>

  return (
    <div>
      <input className="buscar" type="search" placeholder="Buscar cliente o lote…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      {atrasados.length > 0 ? (
        <div className="resumen-atraso">
          <b>{atrasados.length}</b> {atrasados.length === 1 ? 'cliente atrasado' : 'clientes atrasados'} · <b>{money(totalAtraso)}</b> por recuperar
        </div>
      ) : (
        <div className="alerta ok">¡Nadie está atrasado! 🎉</div>
      )}
      <div className="lista">
        {atrasados.map((c) => (
          <div className="tarjeta debe-card" key={c.id}>
            <div className="tarjeta-cab">
              <b>{c.cliente_nombre} · {c.lote_codigo}</b>
              <span className="badge debe">Debe</span>
            </div>
            <div className="tarjeta-sub">
              {c.cuotas_atrasadas} {c.cuotas_atrasadas === 1 ? 'cuota atrasada' : 'cuotas atrasadas'} · {money(c.monto_atrasado)}
            </div>
            <div className="fila-btn">
              <button className="btn primario" onClick={() => abrirWhatsApp(c.cliente_telefono, mensajeRecordatorio(c, lotif))}>
                Recordar por WhatsApp
              </button>
              <button className="btn" onClick={() => irACobro(c.id)}>Cobrar</button>
            </div>
            {!c.cliente_telefono && <div className="tarjeta-sub">Sin teléfono: WhatsApp le pedirá elegir el contacto.</div>}
          </div>
        ))}
        {alDia.map((c) => (
          <div className="tarjeta" key={c.id}>
            <div className="tarjeta-cab">
              <b>{c.cliente_nombre} · {c.lote_codigo}</b>
              <span className="badge aldia">Al día</span>
            </div>
            <div className="tarjeta-sub">Próxima cuota: {fechaCorta(c.proxima_cuota)} · {money(c.cuota)}</div>
            <div className="fila-btn">
              <button className="btn sutil" onClick={() => abrirWhatsApp(c.cliente_telefono, mensajeAviso(c, lotif))}>Enviar aviso</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
