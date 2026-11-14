import { abrirWhatsApp, fecha, money, nroRecibo } from '../lib/format'

export default function Recibo({ r, lotif }) {
  const tipo = r.tipo === 'cuota' ? (r.cuotas_cubiertas > 1 ? `${r.cuotas_cubiertas} cuotas mensuales` : 'Cuota mensual') : 'Abono a capital'

  function enviar() {
    const texto =
      `*Recibo de pago N.º ${nroRecibo(r.numero_recibo)}*\n${lotif.nombre}\n\n` +
      `Recibí de: ${r.cliente}\nLote: ${r.lote}\nFecha: ${fecha(r.fecha)}\nConcepto: ${tipo}\n` +
      `Monto: *${money(r.monto)}*\n  A intereses: ${money(r.interes)}\n  A capital: ${money(r.capital)}\n` +
      `Saldo nuevo: *${money(r.saldo_nuevo)}*\nForma de pago: ${r.forma_pago}\n\n¡Gracias por su pago!`
    abrirWhatsApp(r.telefono, texto)
  }

  return (
    <div>
      <div className="recibo" id="recibo">
        <div className="recibo-cab">
          <div>
            <div className="recibo-emp">{lotif.nombre}</div>
            {lotif.ubicacion && <div className="recibo-ubi">{lotif.ubicacion}</div>}
          </div>
          <span className="recibo-nro">N.º {nroRecibo(r.numero_recibo)}</span>
        </div>
        <div className="recibo-tit">Recibo de pago</div>
        <div className="recibo-monto">{money(r.monto)}</div>
        <dl className="filas">
          <dt>Recibí de</dt><dd><b>{r.cliente}</b></dd>
          <dt>Lote</dt><dd>{r.lote}</dd>
          <dt>Fecha</dt><dd>{fecha(r.fecha)}</dd>
          <dt>Concepto</dt><dd>{tipo}</dd>
          <dt>A intereses</dt><dd>{money(r.interes)}</dd>
          <dt>A capital</dt><dd>{money(r.capital)}</dd>
          <dt>Saldo anterior</dt><dd>{money(r.saldo_anterior)}</dd>
          <dt className="sep">Saldo nuevo</dt><dd className="sep verde"><b>{money(r.saldo_nuevo)}</b></dd>
          <dt>Forma de pago</dt><dd>{r.forma_pago}</dd>
          {r.nota && (<><dt>Nota</dt><dd>{r.nota}</dd></>)}
        </dl>
        <div className="firma">Firma y sello</div>
      </div>
      <div className="listo no-print">✓ Listo para imprimir o enviar</div>
      <div className="fila-btn no-print">
        <button className="btn primario" onClick={() => window.print()}>Imprimir</button>
        <button className="btn whatsapp" onClick={enviar}>Enviar por WhatsApp</button>
      </div>
    </div>
  )
}
