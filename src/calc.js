// Motor de cálculo: mismas reglas que el Excel "Control de venta de lotes".
// Interés simple mensual sobre el saldo de capital; cada pago cubre primero el interés.
(function (root) {
  const TASA = 0.12, PRIMA_MIN = 0.05;
  const FACTORES = { 1: 88.85, 2: 47.07, 3: 33.22, 4: 26.34, 5: 22.25, 6: 19.55, 7: 17.66, 8: 16.26, 9: 15.19, 10: 14.35, 11: 13.68, 12: 13.14 };
  const r2 = v => Math.round((v + Number.EPSILON) * 100) / 100;
  const d = s => { if (!s) return null; const [y, m, dd] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, dd); };
  const iso = dt => dt ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}` : null;
  function edate(dt, n) { const y = dt.getFullYear(), m = dt.getMonth() + n; const last = new Date(y, m + 1, 0).getDate(); return new Date(y, m, Math.min(dt.getDate(), last)); }
  function datedifM(a, b) { let m = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth(); if (b.getDate() < a.getDate()) m -= 1; return m; }
  function pmt(P, n, r) { return r === 0 ? P / n : P * r / (1 - Math.pow(1 + r, -n)); }
  function cuotaTabla(monto, meses) { const f = FACTORES[meses / 12]; return f ? r2(monto * f / 1000) : null; }

  // v: venta {tipo, estado, precio_pactado, plazo, tasa, cuota_pactada, fecha_primera_cuota, saldo_inicial_libro, cuotas_antes}
  // lote: {precio_lista}; pagos: [{id, fecha, tipo, monto}]
  function calcular(v, lote, pagosIn, hoyIn) {
    const hoy = hoyIn ? d(hoyIn) : (() => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); })();
    const pagos = [...pagosIn].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (a.id || 0) - (b.id || 0)));
    const precio = v.precio_pactado != null ? +v.precio_pactado : (lote && lote.precio_lista != null ? +lote.precio_lista : null);
    const tasa = v.tasa != null ? +v.tasa : TASA, r = tasa / 12;
    const totalPagado = r2(pagos.reduce((s, p) => s + +p.monto, 0));
    const primaPagada = r2(pagos.filter(p => p.tipo === 'Reserva' || p.tipo === 'Prima').reduce((s, p) => s + +p.monto, 0));
    const out = { precio, tasa, totalPagado, primaPagada, filas: [] };
    if (v.estado === 'Rescindido') { out.situacion = 'Rescindido'; out.saldo = null; return out; }
    if (v.tipo === 'Contado') {
      out.saldo = v.estado === 'Pagado' ? 0 : (precio == null ? null : Math.max(0, r2(precio - totalPagado)));
      out.situacion = (v.estado === 'Pagado' || (out.saldo != null && out.saldo <= 0.01)) ? 'Pagado' : v.estado === 'Reservado' ? 'Reservado' : 'Contado: saldo pendiente';
      return out;
    }
    const primaMin = precio != null ? r2(precio * PRIMA_MIN) : null;
    const primaTomada = primaPagada > 0 ? primaPagada : primaMin;
    const plazo = v.plazo ? +v.plazo : null;
    const financiado = precio != null && plazo ? r2(precio - primaTomada) : null;
    let cuota = v.cuota_pactada != null ? +v.cuota_pactada : (financiado != null && plazo ? r2(pmt(financiado, plazo, r)) : null);
    const saldoArranque = v.saldo_inicial_libro != null ? +v.saldo_inicial_libro : financiado;
    const antes = v.cuotas_antes ? +v.cuotas_antes : 0;
    const f1 = d(v.fecha_primera_cuota);
    Object.assign(out, { primaMin, primaTomada, financiado, cuota, plazo, saldoArranque });

    let saldo = saldoArranque, pend = 0, kPrev = antes, nCuotaMensual = 0, pagadoCuotas = 0, intPag = 0, capPag = 0, lastK = antes;
    pagos.forEach(p => {
      if (p.tipo !== 'Cuota mensual' && p.tipo !== 'Abono extra a capital') return;
      if (p.tipo === 'Cuota mensual') nCuotaMensual++;
      const f = d(p.fecha);
      let K;
      if (v.interes_por_pago) K = p.tipo === 'Cuota mensual' ? kPrev + 1 : kPrev;
      else if (!f1) K = antes + nCuotaMensual;
      else {
        // Cuotas vencidas a la fecha del pago (el día de vencimiento ya cuenta). Cada cuota mensual cobra al menos
        // un mes de interés; solo se cobra más de uno si quedó un vencimiento sin pagar. Igual que el Excel.
        const vencidas = (f.getFullYear() - f1.getFullYear()) * 12 + f.getMonth() - f1.getMonth() + (f.getDate() >= f1.getDate() ? 1 : 0);
        K = Math.max(kPrev + (p.tipo === 'Cuota mensual' ? 1 : 0), vencidas);
      }
      const N = Math.max(0, K - kPrev);
      const O = saldo, P = pend, Q = r2(O * r * N), R = Math.min(+p.monto, P + Q), S = r2(+p.monto - R), T = r2(O - S), U = r2(P + Q - R);
      out.filas.push({ id: p.id, fecha: p.fecha, monto: +p.monto, cuotaNo: K, meses: N, saldoAnterior: O, interes: Q, aInteres: r2(R), aCapital: S, saldo: T, pendiente: U });
      saldo = T; pend = U; kPrev = K; lastK = K; pagadoCuotas += +p.monto; intPag += R; capPag += S;
    });
    if (v.estado === 'Pagado') saldo = 0;
    out.saldo = saldo == null ? null : r2(saldo);
    out.pagadoCuotas = r2(pagadoCuotas); out.interesPagado = r2(intPag); out.capitalPagado = r2(capPag);
    const activo = v.estado === 'Activo';
    const Y = (!f1 || !activo) ? null : (hoy < f1 ? 0 : Math.min(plazo || 999, datedifM(f1, hoy) + 1));
    const Z = cuota ? antes + pagadoCuotas / cuota : null;
    out.vencidas = Y; out.cubiertas = Z;
    out.atraso = (Y == null || Z == null || out.saldo == null) ? null : (out.saldo <= 0.01 ? 0 : Math.max(0, r2((Y - Z) * cuota)));
    out.cuotasAtrasadas = (out.atraso == null || !cuota) ? null : Math.ceil(Math.round(out.atraso / cuota * 1e4) / 1e4);
    out.adelantado = (Y == null || Z == null) ? null : Math.max(0, r2((Z - Y) * cuota));
    out.interesPendiente = (out.saldo == null || !activo) ? null : r2(pend + out.saldo * r * Math.max(0, (Y || 0) - lastK));
    if (out.saldo != null && cuota) {
      if (out.saldo <= 0.01) out.cuotasFaltan = 0;
      else if (r === 0) out.cuotasFaltan = Math.ceil(out.saldo / cuota);
      else { const x = 1 - out.saldo * r / cuota; out.cuotasFaltan = x > 0 ? Math.ceil(-Math.log(x) / Math.log(1 + r) - 1e-9) : null; }
    }
    out.terminaria = (out.cuotasFaltan && f1) ? iso(edate(f1, lastK + out.cuotasFaltan - 1)) : null;
    out.proximo = (activo && f1 && Z != null && out.saldo > 0.01) ? iso(edate(f1, Math.floor(Math.round(Z * 1e4) / 1e4))) : null;
    if (v.estado === 'Pagado' || (out.saldo != null && out.saldo <= 0.01)) out.situacion = 'Pagado';
    else if (v.estado === 'Reservado') out.situacion = 'Reservado';
    else if (!f1) out.situacion = 'Falta fecha 1ª cuota';
    else if (out.cuotasAtrasadas == null) out.situacion = '';
    else if (out.cuotasAtrasadas === 0) out.situacion = out.adelantado > 0 ? 'Al día (adelantado)' : 'Al día';
    else out.situacion = out.cuotasAtrasadas === 1 ? '1 cuota atrasada' : `${out.cuotasAtrasadas} cuotas atrasadas`;
    return out;
  }
  root.Calc = { calcular, cuotaTabla, pmt, edate, iso, d, r2, FACTORES, TASA, PRIMA_MIN };
})(typeof window !== 'undefined' ? window : globalThis);
