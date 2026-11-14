import { useMemo, useState } from 'react'
import LotePanel from './LotePanel'

export default function Mapa({ lotif, datos, recargar, irACobro }) {
  const [selId, setSelId] = useState(null)
  const [filtro, setFiltro] = useState('todos')

  const bloques = useMemo(() => {
    const m = new Map()
    for (const l of datos.lotes) {
      if (!m.has(l.bloque)) m.set(l.bloque, [])
      m.get(l.bloque).push(l)
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es', { numeric: true }))
  }, [datos.lotes])

  const cols = Math.max(1, ...bloques.map(([, ls]) => ls.length))
  const cuentaPorLote = useMemo(() => {
    const m = {}
    for (const c of datos.cuentas) m[c.lote_id] = c
    return m
  }, [datos.cuentas])

  const conteo = (e) => datos.lotes.filter((l) => l.estado === e).length
  const sel = datos.lotes.find((l) => l.id === selId)

  if (datos.lotes.length === 0)
    return <div className="vacio">Esta lotificación aún no tiene lotes. Agréguelos desde ⚙ Ajustes.</div>

  return (
    <div>
      <div className="leyenda">
        {[
          ['todos', 'Todos', datos.lotes.length],
          ['vendido', 'Vendido', conteo('vendido')],
          ['reservado', 'Reservado', conteo('reservado')],
          ['disponible', 'Disponible', conteo('disponible')],
        ].map(([k, t, n]) => (
          <button key={k} className={'chip ' + k + (filtro === k ? ' chip-on' : '')} onClick={() => setFiltro(k)}>
            {k !== 'todos' && <i className={'cuadro ' + k} />} {t} <b>{n}</b>
          </button>
        ))}
      </div>
      <div className="mapa" style={{ '--cols': cols }}>
        {bloques.map(([b, ls]) => (
          <div className="mapa-fila" key={b}>
            {ls.map((l) => {
              const c = cuentaPorLote[l.id]
              const atrasado = c && c.cuotas_atrasadas > 0
              const atenuado = filtro !== 'todos' && l.estado !== filtro
              return (
                <button
                  key={l.id}
                  className={'lote ' + l.estado + (selId === l.id ? ' sel' : '') + (atenuado ? ' tenue' : '')}
                  onClick={() => setSelId(l.id)}
                  title={`Lote ${l.codigo} · ${l.estado}`}
                >
                  {l.codigo}
                  {atrasado && <span className="debe-dot" aria-label="Con atraso" />}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <p className="nota">Toque un lote para ver su detalle. El punto rojo indica cliente con cuotas atrasadas.</p>
      {sel && (
        <LotePanel
          lote={sel}
          lotif={lotif}
          cuenta={cuentaPorLote[sel.id]}
          onCerrar={() => setSelId(null)}
          recargar={recargar}
          irACobro={irACobro}
        />
      )}
    </div>
  )
}
