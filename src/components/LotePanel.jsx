import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { abrirWhatsApp, calcCuota, errorTexto, fechaCorta, money, round2 } from '../lib/format'
import Modal from './Modal'
import VentaForm from './VentaForm'
import { mensajeRecordatorio } from './Alertas'

const PLAZOS = [1, 2, 3, 5, 8, 10, 12, 15, 20]

export default function LotePanel({ lote, lotif, cuenta, onCerrar, recargar, irACobro }) {
  const [vista, setVista] = useState('detalle') // detalle | reservar | vender | editar
  const [primaPct, setPrimaPct] = useState(Number(lotif.prima_pct))
  const [plazo, setPlazo] = useState(Number(lotif.plazo_anios))
  const [tel, setTel] = useState('')
  const [res, setRes] = useState({ nombre: lote.reservado_nombre || '', telefono: lote.reservado_telefono || '' })
  const [ed, setEd] = useState({ area_m2: lote.area_m2, precio: lote.precio, notas: lote.notas || '' })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const prima = round2((lote.precio * primaPct) / 100)
  const cuota = calcCuota(lote.precio - prima, lotif.tasa_anual, plazo * 12)

  const badge = { disponible: 'Disponible', reservado: 'Reservado', vendido: 'Vendido' }[lote.estado]

  function enviarCotizacion() {
    const texto =
      `*Cotización – ${lotif.nombre}*\n\n` +
      `Lote: *${lote.codigo}*\n` +
      `Área: ${Number(lote.area_m2).toLocaleString('en-US')} m²\n` +
      `Precio: ${money(lote.precio)}\n` +
      `Prima (${primaPct}%): ${money(prima)}\n` +
      `Cuota mensual a ${plazo} años: *${money(cuota)}*\n\n` +
      `Precios sujetos a disponibilidad. ¡Con gusto le atendemos!` +
      (lotif.whatsapp ? `\nWhatsApp: ${lotif.whatsapp}` : '')
    abrirWhatsApp(tel, texto)
  }

  async function actualizar(cambios) {
    setGuardando(true); setError('')
    const { error } = await supabase.from('lotes').update(cambios).eq('id', lote.id)
    setGuardando(false)
    if (error) { setError(errorTexto(error)); return false }
    await recargar()
    setVista('detalle')
    return true
  }

  if (vista === 'vender')
    return (
      <Modal titulo={`Vender lote ${lote.codigo}`} onCerrar={onCerrar}>
        <VentaForm
          lote={lote}
          lotif={lotif}
          primaPct={primaPct}
          plazo={plazo}
          onCancelar={() => setVista('detalle')}
          onListo={async () => { await recargar(); setVista('detalle') }}
        />
      </Modal>
    )

  return (
    <Modal titulo={`Lote ${lote.codigo}`} onCerrar={onCerrar}>
      <div className="lote-cab">
        <span className={'badge ' + lote.estado}>{badge}</span>
        {cuenta?.cuotas_atrasadas > 0 && <span className="badge debe">Debe {cuenta.cuotas_atrasadas}</span>}
      </div>

      {vista === 'detalle' && (
        <>
          <dl className="filas">
            <dt>Área</dt><dd>{Number(lote.area_m2).toLocaleString('en-US')} m²</dd>
            <dt>Precio</dt><dd>{money(lote.precio)}</dd>
            {lote.estado !== 'vendido' && (
              <>
                <dt>Prima ({primaPct}%)</dt><dd>{money(prima)}</dd>
                <dt>Cuota a {plazo} años</dt><dd className="verde">{money(cuota)}</dd>
              </>
            )}
            {lote.estado === 'reservado' && (
              <>
                <dt>Reservado por</dt><dd>{lote.reservado_nombre || '—'}</dd>
                {lote.reservado_telefono && (<><dt>Teléfono</dt><dd>{lote.reservado_telefono}</dd></>)}
              </>
            )}
            {lote.estado === 'vendido' && cuenta && (
              <>
                <dt>Cliente</dt><dd>{cuenta.cliente_nombre}</dd>
                <dt>Cuota mensual</dt><dd>{money(cuenta.cuota)}</dd>
                <dt>Cuotas pagadas</dt><dd>{cuenta.cuotas_pagadas} de {cuenta.plazo_meses}</dd>
                <dt>Saldo</dt><dd className="verde">{money(cuenta.saldo)}</dd>
                {cuenta.estado === 'activa' && (<><dt>Próxima cuota</dt><dd>{fechaCorta(cuenta.proxima_cuota)}</dd></>)}
                {cuenta.cuotas_atrasadas > 0 && (<><dt>Atrasado</dt><dd className="rojo">{money(cuenta.monto_atrasado)}</dd></>)}
              </>
            )}
            {lote.notas && (<><dt>Notas</dt><dd>{lote.notas}</dd></>)}
          </dl>

          {lote.estado !== 'vendido' && (
            <details className="ajuste-cot">
              <summary>Ajustar prima y plazo de la cotización</summary>
              <div className="dos">
                <label>Prima %
                  <input type="number" min="0" max="100" step="0.5" value={primaPct} onChange={(e) => setPrimaPct(Number(e.target.value))} />
                </label>
                <label>Plazo
                  <select value={plazo} onChange={(e) => setPlazo(Number(e.target.value))}>
                    {[...new Set([...PLAZOS, Number(lotif.plazo_anios)])].sort((a, b) => a - b).map((p) => (
                      <option key={p} value={p}>{p} {p === 1 ? 'año' : 'años'}</option>
                    ))}
                  </select>
                </label>
              </div>
            </details>
          )}

          {error && <div className="alerta error">{error}</div>}

          <div className="acciones">
            {lote.estado !== 'vendido' && (
              <>
                <label className="solo">WhatsApp del interesado (opcional)
                  <input inputMode="tel" placeholder="7000-0000" value={tel} onChange={(e) => setTel(e.target.value)} />
                </label>
                <button className="btn whatsapp" onClick={enviarCotizacion}>Enviar cotización por WhatsApp</button>
                <button className="btn primario" onClick={() => setVista('vender')}>Registrar venta</button>
                {lote.estado === 'disponible' ? (
                  <button className="btn" onClick={() => setVista('reservar')}>Reservar</button>
                ) : (
                  <button className="btn" disabled={guardando}
                    onClick={() => actualizar({ estado: 'disponible', reservado_nombre: null, reservado_telefono: null })}>
                    Liberar reserva
                  </button>
                )}
                <button className="btn sutil" onClick={() => setVista('editar')}>Editar área / precio</button>
              </>
            )}
            {lote.estado === 'vendido' && cuenta && (
              <>
                {cuenta.estado === 'activa' && (
                  <button className="btn primario" onClick={() => irACobro(cuenta.id)}>Registrar pago</button>
                )}
                {cuenta.cuotas_atrasadas > 0 && (
                  <button className="btn whatsapp" onClick={() => abrirWhatsApp(cuenta.cliente_telefono, mensajeRecordatorio(cuenta, lotif))}>
                    Recordar por WhatsApp
                  </button>
                )}
                {cuenta.estado === 'pagada' && <div className="alerta ok">Este lote está totalmente pagado.</div>}
              </>
            )}
          </div>
        </>
      )}

      {vista === 'reservar' && (
        <form className="form" onSubmit={(e) => { e.preventDefault(); actualizar({ estado: 'reservado', reservado_nombre: res.nombre, reservado_telefono: res.telefono }) }}>
          <label>Nombre de quien reserva
            <input required value={res.nombre} onChange={(e) => setRes({ ...res, nombre: e.target.value })} />
          </label>
          <label>Teléfono
            <input inputMode="tel" value={res.telefono} onChange={(e) => setRes({ ...res, telefono: e.target.value })} />
          </label>
          {error && <div className="alerta error">{error}</div>}
          <button className="btn primario" disabled={guardando}>Guardar reserva</button>
          <button type="button" className="btn sutil" onClick={() => setVista('detalle')}>Cancelar</button>
        </form>
      )}

      {vista === 'editar' && (
        <form className="form" onSubmit={(e) => { e.preventDefault(); actualizar({ area_m2: Number(ed.area_m2), precio: Number(ed.precio), notas: ed.notas || null }) }}>
          <div className="dos">
            <label>Área (m²)
              <input type="number" min="0" step="0.01" required value={ed.area_m2} onChange={(e) => setEd({ ...ed, area_m2: e.target.value })} />
            </label>
            <label>Precio ($)
              <input type="number" min="0" step="0.01" required value={ed.precio} onChange={(e) => setEd({ ...ed, precio: e.target.value })} />
            </label>
          </div>
          <label>Notas
            <input value={ed.notas} onChange={(e) => setEd({ ...ed, notas: e.target.value })} placeholder="Esquinero, frente a calle…" />
          </label>
          {error && <div className="alerta error">{error}</div>}
          <button className="btn primario" disabled={guardando}>Guardar cambios</button>
          <button type="button" className="btn sutil" onClick={() => setVista('detalle')}>Cancelar</button>
        </form>
      )}
    </Modal>
  )
}
