import { useMemo, useState } from 'react'
import { fecha, hoyISO, money, nroRecibo, round2 } from '../lib/format'

export default function Ventas({ lotif, datos }) {
  const [descargando, setDescargando] = useState(false)
  const hoy = hoyISO()
  const mes = hoy.slice(0, 7)
  const finMes = mes + '-31'

  const n = useMemo(() => {
    const activas = datos.cuentas.filter((c) => c.estado === 'activa')
    const pagosMes = datos.pagos.filter((p) => p.fecha.startsWith(mes))
    return {
      cuotasMes: activas.filter((c) => c.fecha_primera_cuota <= finMes).reduce((s, c) => s + Number(c.cuota), 0),
      cobradoMes: pagosMes.reduce((s, p) => s + Number(p.monto), 0),
      porCobrar: activas.reduce((s, c) => s + Number(c.saldo), 0),
      atrasado: activas.reduce((s, c) => s + Number(c.monto_atrasado), 0),
      disponibles: datos.lotes.filter((l) => l.estado === 'disponible').length,
      reservados: datos.lotes.filter((l) => l.estado === 'reservado').length,
      vendidos: datos.lotes.filter((l) => l.estado === 'vendido').length,
      pagosMes,
    }
  }, [datos, mes, finMes])

  const nombreMes = new Date(hoy + 'T00:00:00').toLocaleDateString('es-SV', { month: 'long', year: 'numeric' })

  async function descargarExcel() {
    setDescargando(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      const hoja = (filas, nombre, anchos) => {
        const ws = XLSX.utils.json_to_sheet(filas)
        if (anchos) ws['!cols'] = anchos.map((w) => ({ wch: w }))
        XLSX.utils.book_append_sheet(wb, ws, nombre)
      }
      hoja([
        { Concepto: 'Lotificación', Valor: lotif.nombre },
        { Concepto: 'Fecha del reporte', Valor: hoy },
        { Concepto: `Cuotas de ${nombreMes}`, Valor: round2(n.cuotasMes) },
        { Concepto: `Cobrado en ${nombreMes}`, Valor: round2(n.cobradoMes) },
        { Concepto: 'Por cobrar (saldo total)', Valor: round2(n.porCobrar) },
        { Concepto: 'Total atrasado', Valor: round2(n.atrasado) },
        { Concepto: 'Lotes vendidos', Valor: n.vendidos },
        { Concepto: 'Lotes reservados', Valor: n.reservados },
        { Concepto: 'Lotes disponibles', Valor: n.disponibles },
      ], 'Resumen', [30, 34])
      hoja(datos.lotes.map((l) => ({
        Lote: l.codigo, Bloque: l.bloque, 'Área m²': Number(l.area_m2), Precio: Number(l.precio),
        Estado: l.estado, 'Reservado por': l.reservado_nombre || '', Notas: l.notas || '',
      })), 'Lotes', [8, 8, 10, 12, 12, 22, 24])
      hoja(datos.cuentas.map((c) => ({
        Cliente: c.cliente_nombre, Teléfono: c.cliente_telefono || '', Lote: c.lote_codigo, 'Fecha venta': c.fecha_venta,
        Precio: Number(c.precio), Prima: Number(c.prima), Financiado: Number(c.monto_financiado),
        'Interés anual %': Number(c.tasa_anual), 'Plazo meses': c.plazo_meses, Cuota: Number(c.cuota),
        'Cuotas pagadas': c.cuotas_pagadas, 'Cuotas atrasadas': c.cuotas_atrasadas, 'Monto atrasado': Number(c.monto_atrasado),
        Saldo: Number(c.saldo), 'Próxima cuota': c.estado === 'activa' ? c.proxima_cuota : '', Estado: c.estado,
      })), 'Clientes y saldos', [24, 12, 7, 12, 11, 10, 11, 9, 8, 10, 8, 8, 10, 12, 12, 9])
      hoja(datos.pagos.map((p) => ({
        Recibo: nroRecibo(p.numero_recibo), Fecha: p.fecha, Cliente: p.ventas.clientes?.nombre || '', Lote: p.ventas.lotes.codigo,
        Tipo: p.tipo === 'cuota' ? 'Cuota' : 'Abono a capital', Monto: Number(p.monto), Intereses: Number(p.interes),
        Capital: Number(p.capital), 'Saldo nuevo': Number(p.saldo_nuevo), 'Forma de pago': p.forma_pago, Nota: p.nota || '',
      })), 'Pagos', [8, 11, 24, 7, 14, 10, 10, 10, 12, 14, 20])
      const archivo = `${lotif.nombre.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'lotificacion'} ${hoy}.xlsx`
      XLSX.writeFile(wb, archivo)
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div>
      <div className="stats">
        <Stat t="Cuotas de este mes" v={money0(n.cuotasMes)} />
        <Stat t="Cobrado este mes" v={money0(n.cobradoMes)} cls="verde" />
        <Stat t="Por cobrar" v={money0(n.porCobrar)} />
        <Stat t="Atrasado" v={money0(n.atrasado)} cls={n.atrasado > 0 ? 'rojo' : ''} />
        <Stat t="Lotes disponibles" v={n.disponibles} />
        <Stat t="Vendidos / reservados" v={`${n.vendidos} / ${n.reservados}`} />
      </div>
      <button className="btn primario ancho" onClick={descargarExcel} disabled={descargando}>
        {descargando ? 'Preparando…' : 'Descargar Excel'}
      </button>

      <h2 className="sec-titulo">Pagos de {nombreMes}</h2>
      {n.pagosMes.length === 0 && <div className="vacio">Aún no hay pagos este mes.</div>}
      <div className="lista">
        {n.pagosMes.map((p) => (
          <div key={p.id} className="tarjeta fila-recibo">
            <span><b>{p.ventas.clientes?.nombre}</b> · {p.ventas.lotes.codigo}<br /><small>{fecha(p.fecha)} · Recibo {nroRecibo(p.numero_recibo)}</small></span>
            <b>{money(p.monto)}</b>
          </div>
        ))}
      </div>
    </div>
  )
}

const money0 = (v) => money(v).replace(/\.\d\d$/, '')

function Stat({ t, v, cls = '' }) {
  return <div className="stat"><span>{t}</span><b className={cls}>{v}</b></div>
}
