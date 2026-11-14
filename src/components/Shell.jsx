import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Mapa from './Mapa'
import Alertas from './Alertas'
import Ventas from './Ventas'
import Cobros from './Cobros'
import Onboarding from './Onboarding'
import Ajustes from './Ajustes'

const TABS = ['Mapa', 'Alertas', 'Ventas', 'Cobros']

export default function Shell({ session }) {
  const [lotifs, setLotifs] = useState(null)
  const [actualId, setActualId] = useState(() => localStorage.getItem('otn_lotif') || '')
  const [tab, setTab] = useState('Mapa')
  const [datos, setDatos] = useState({ lotes: [], cuentas: [], pagos: [] })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [ventaCobro, setVentaCobro] = useState(null)
  const [ajustes, setAjustes] = useState(false)
  const [nueva, setNueva] = useState(false)

  const cargarLotifs = useCallback(async () => {
    const { data, error } = await supabase.from('lotificaciones').select('*').order('created_at')
    if (error) { setError(error.message); return }
    setLotifs(data)
    setActualId((id) => (data.find((l) => l.id === id) ? id : data[0]?.id || ''))
  }, [])

  useEffect(() => { cargarLotifs() }, [cargarLotifs])
  useEffect(() => { if (actualId) localStorage.setItem('otn_lotif', actualId) }, [actualId])

  const actual = lotifs?.find((l) => l.id === actualId)

  const cargar = useCallback(async () => {
    if (!actualId) return
    setCargando(true)
    const [l, c, p] = await Promise.all([
      supabase.from('lotes').select('*').eq('lotificacion_id', actualId).order('bloque').order('numero'),
      supabase.from('estado_cuentas').select('*').eq('lotificacion_id', actualId).neq('estado', 'anulada'),
      supabase
        .from('pagos')
        .select('*, ventas!inner(lote_id, cliente_id, cuota, lotes!inner(codigo, lotificacion_id), clientes(nombre, telefono))')
        .eq('ventas.lotes.lotificacion_id', actualId)
        .order('numero_recibo', { ascending: false })
        .limit(1000),
    ])
    const err = l.error || c.error || p.error
    if (err) setError(err.message)
    else {
      setError('')
      setDatos({ lotes: l.data, cuentas: c.data, pagos: p.data })
    }
    setCargando(false)
  }, [actualId])

  useEffect(() => { cargar() }, [cargar])

  const irACobro = (ventaId) => { setVentaCobro(ventaId); setTab('Cobros') }

  if (lotifs === null) return <div className="splash">Cargando…</div>
  if (lotifs.length === 0 || nueva)
    return (
      <Onboarding
        puedeCancelar={lotifs.length > 0}
        onCancelar={() => setNueva(false)}
        onListo={async (id) => { setNueva(false); setActualId(id); await cargarLotifs() }}
      />
    )

  return (
    <div className="app">
      <header className="cab">
        <div className="cab-fila">
          <div className="cab-titulo">
            {lotifs.length > 1 ? (
              <select value={actualId} onChange={(e) => setActualId(e.target.value)} aria-label="Lotificación">
                {lotifs.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
            ) : (
              <h1>{actual?.nombre || 'Mi Lotificación'}</h1>
            )}
          </div>
          <span className="cab-tab">{tab}</span>
          <button className="icono" onClick={() => setAjustes(true)} aria-label="Ajustes" title="Ajustes">⚙</button>
        </div>
      </header>
      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'tab activo' : 'tab'} onClick={() => setTab(t)}>
            {t}
            {t === 'Alertas' && datos.cuentas.filter((c) => c.cuotas_atrasadas > 0).length > 0 && (
              <span className="punto">{datos.cuentas.filter((c) => c.cuotas_atrasadas > 0).length}</span>
            )}
          </button>
        ))}
      </nav>
      <main className="contenido">
        {error && <div className="alerta error">{error}</div>}
        {cargando && datos.lotes.length === 0 ? (
          <div className="vacio">Cargando…</div>
        ) : (
          <>
            {tab === 'Mapa' && <Mapa lotif={actual} datos={datos} recargar={cargar} irACobro={irACobro} />}
            {tab === 'Alertas' && <Alertas lotif={actual} cuentas={datos.cuentas} irACobro={irACobro} />}
            {tab === 'Ventas' && <Ventas lotif={actual} datos={datos} />}
            {tab === 'Cobros' && (
              <Cobros lotif={actual} datos={datos} recargar={cargar} ventaInicial={ventaCobro} limpiarInicial={() => setVentaCobro(null)} />
            )}
          </>
        )}
      </main>
      {ajustes && (
        <Ajustes
          lotif={actual}
          lotes={datos.lotes}
          email={session.user.email}
          onCerrar={() => setAjustes(false)}
          onCambio={async () => { await cargarLotifs(); await cargar() }}
          onNueva={() => { setAjustes(false); setNueva(true) }}
        />
      )}
    </div>
  )
}
