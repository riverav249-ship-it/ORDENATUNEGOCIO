/* Sistema de control de lotificación · aplicación de control */
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = v => v == null || isNaN(v) ? '—' : '$' + (+v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money0 = v => v == null || isNaN(v) ? '—' : '$' + Math.round(+v).toLocaleString('en-US');
  const num = s => { const v = parseFloat(String(s ?? '').replace(/[$,\s]/g, '')); return isFinite(v) ? v : NaN; };
  const fd = s => s ? String(s).slice(0, 10).split('-').reverse().join('/') : '—';
  const hoyISO = () => Calc.iso(new Date());
  const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const fLarga = s => { const d = Calc.d(s); return d ? `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}` : ''; };

  const cfg = window.APP_CONFIG || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_KEY) { document.body.innerHTML = '<p style="padding:20px">Falta configurar la conexión (config.js).</p>'; return; }
  const sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY);

  const S = { user: null, perfil: null, lotes: [], clientes: [], ventas: [], pagos: [], calc: {}, sel: null };
  const puede = (...roles) => S.perfil && roles.includes(S.perfil.rol);

  // ---------- datos de la lotificación (nombre, ubicación y teléfono; el administrador los cambia en la pestaña Usuarios)
  const L = window.LOTIF = { nombre: 'Mi Lotificación', nombre_corto: 'Mi Lotificación', ubicacion: '', telefono: '' };
  function aplicarLotif() {
    document.title = `${L.nombre_corto} · Control de lotes`;
    $('lt-nombre').textContent = L.nombre;
    $('lt-corto').textContent = L.nombre_corto;
    $('lt-ubic').textContent = L.ubicacion;
  }
  async function cargarLotif() {
    const { data } = await sb.from('ajustes').select('*').eq('id', 1).maybeSingle();
    if (data) Object.assign(L, data);
    aplicarLotif();
    if (puede('admin')) pintarAjustes();
  }
  function pintarAjustes() {
    if (document.activeElement && document.activeElement.closest('#f-ajustes')) return;
    $('aj-nombre').value = L.nombre; $('aj-corto').value = L.nombre_corto; $('aj-ubic').value = L.ubicacion; $('aj-tel').value = L.telefono;
  }
  $('f-ajustes').addEventListener('submit', async e => {
    e.preventDefault();
    const nuevo = { nombre: $('aj-nombre').value.trim(), nombre_corto: $('aj-corto').value.trim(), ubicacion: $('aj-ubic').value.trim(), telefono: $('aj-tel').value.trim() };
    if (!nuevo.nombre) return toast('Escriba el nombre de la lotificación.');
    if (!nuevo.nombre_corto) nuevo.nombre_corto = nuevo.nombre;
    $('aj-guardar').disabled = true;
    const { error } = await sb.from('ajustes').update({ ...nuevo, actualizado: new Date().toISOString() }).eq('id', 1);
    $('aj-guardar').disabled = false;
    if (error) return toast('No se pudo guardar: ' + error.message);
    Object.assign(L, nuevo); aplicarLotif(); toast('Datos de la lotificación guardados');
  });
  cargarLotif();

  function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2600); }
  function show(id) { ['login', 'pendiente', 'app'].forEach(x => $(x).hidden = x !== id); }

  // ---------- sesión
  let modoReg = false;
  const errLogin = m => { $('login-err').textContent = m; $('login-err').hidden = false; };
  $('login-modo').addEventListener('click', () => {
    modoReg = !modoReg;
    $('reg-nombre-w').hidden = !modoReg;
    $('login-btn').textContent = modoReg ? 'Crear cuenta' : 'Entrar';
    $('login-modo').textContent = modoReg ? 'Ya tengo cuenta' : 'Crear cuenta nueva';
    $('login-sub').textContent = modoReg ? 'Cree su cuenta. El administrador le dará acceso.' : 'Control de lotes, ventas y cobros';
    $('pass').autocomplete = modoReg ? 'new-password' : 'current-password';
    $('login-err').hidden = true; $('login-ok').hidden = true;
  });
  $('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    $('login-err').hidden = true; $('login-ok').hidden = true;
    const email = $('email').value.trim(), password = $('pass').value;
    if (modoReg) {
      if (password.length < 6) return errLogin('La contraseña debe tener al menos 6 caracteres.');
      $('login-btn').disabled = true;
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { nombre: $('reg-nombre').value.trim() || undefined }, emailRedirectTo: location.origin } });
      $('login-btn').disabled = false;
      if (error) return errLogin(/registered|exists/i.test(error.message) ? 'Ese correo ya tiene cuenta.' : 'No se pudo crear: ' + error.message);
      if (!data.session) { $('login-ok').textContent = 'Cuenta creada. Avise al administrador para que le dé acceso; después entre con su correo y contraseña.'; $('login-ok').hidden = false; }
      return;
    }
    $('login-btn').disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email, password });
    $('login-btn').disabled = false;
    if (error) errLogin(/confirm/i.test(error.message) ? 'Su cuenta todavía no está activada. Avise al administrador.' : 'Correo o contraseña incorrectos.');
  });
  document.addEventListener('click', e => { if (e.target.closest('[data-act="salir"]')) sb.auth.signOut(); });
  sb.auth.onAuthStateChange((_ev, session) => { setTimeout(() => iniciar(session), 0); });

  let iniciado = null;
  async function iniciar(session) {
    if (!session) { S.user = null; iniciado = null; show('login'); return; }
    if (iniciado === session.user.id) return;
    iniciado = session.user.id; S.user = session.user;
    const { data: perfil } = await sb.from('perfiles').select('*').eq('id', S.user.id).maybeSingle();
    S.perfil = perfil;
    if (!perfil || perfil.rol === 'pendiente') { show('pendiente'); return; }
    $('who').textContent = `${perfil.nombre || perfil.correo} · ${perfil.rol}${perfil.puede_cobrar && perfil.rol === 'ventas' ? ' + cobros' : ''}`;
    document.querySelectorAll('[data-roles]').forEach(b => b.hidden = !b.dataset.roles.split(',').includes(perfil.rol));
    show('app');
    await cargar();
    suscribir();
  }

  async function cargar() {
    const [l, c, v, p] = await Promise.all([
      sb.from('lotes').select('*').order('poligono').order('numero'),
      sb.from('clientes').select('*').order('nombre'),
      sb.from('ventas').select('*').order('fecha', { nullsFirst: false }),
      sb.from('pagos').select('*').order('fecha').order('id'),
    ]);
    const err = [l, c, v, p].find(r => r.error);
    if (err) { toast('No se pudieron cargar los datos: ' + err.error.message); return; }
    S.lotes = l.data; S.clientes = c.data; S.ventas = v.data; S.pagos = p.data;
    recalcular(); pintarTodo(); cargarLotif();
  }
  let timer = null;
  function suscribir() {
    sb.channel('cambios').on('postgres_changes', { event: '*', schema: 'public' }, () => { clearTimeout(timer); timer = setTimeout(cargar, 400); }).subscribe();
  }

  // ---------- datos derivados
  const lote = code => S.lotes.find(l => l.codigo === code);
  const cliente = id => S.clientes.find(c => c.id === id);
  // Las reservas sin documento llevan un código interno RES-…; en pantalla se muestran como "Sin contrato".
  const sinContrato = v => /^RES-/.test(String(v?.contrato || ''));
  const ctr = v => sinContrato(v) ? 'Sin contrato' : v?.contrato;
  const ventaVigente = code => S.ventas.find(v => v.lote === code && v.estado !== 'Rescindido');
  function estadoLote(l) {
    if (!l) return 'na';
    const v = ventaVigente(l.codigo);
    if (v) return v.estado === 'Reservado' ? 'res' : 'sold';
    return l.a_la_venta ? 'free' : 'na';
  }
  function recalcular() {
    S.calc = {};
    const hoy = hoyISO();
    S.ventas.forEach(v => { S.calc[v.id] = Calc.calcular(v, lote(v.lote), S.pagos.filter(p => p.venta_id === v.id), hoy); });
  }
  function chipSit(s) {
    if (!s) return '';
    const cls = s.startsWith('Al día') || s === 'Pagado' ? 'ok' : s.includes('atrasada') ? 'bad' : s === 'Rescindido' ? 'mute' : 'warn';
    return `<span class="chip ${cls}">${esc(s)}</span>`;
  }

  function pintarTodo() { pintarAlertas(); pintarKpis(); pintarMapa(); pintarContratos(); pintarVentas(); pintarCobros(); pintarFormVenta(); if (puede('admin')) pintarUsuarios(); if (S.sel) panelLote(S.sel); }

  function pintarKpis() {
    const libres = S.lotes.filter(l => estadoLote(l) === 'free').length;
    const vend = S.lotes.filter(l => estadoLote(l) === 'sold').length;
    const cred = S.ventas.filter(v => v.tipo === 'Crédito' && v.estado === 'Activo');
    const cartera = cred.reduce((s, v) => s + (S.calc[v.id].saldo || 0), 0);
    const mensual = cred.reduce((s, v) => s + (S.calc[v.id].cuota || 0), 0);
    const atras = cred.filter(v => (S.calc[v.id].cuotasAtrasadas || 0) > 0).length;
    $('kpis').innerHTML = [['Disponibles', libres], ['Vendidos', vend], ['Por cobrar', money0(cartera)], ['Cuotas al mes', money0(mensual)], ['Atrasados', atras]]
      .map(([k, v]) => `<div class="kpi${k === 'Atrasados' ? ' click' : ''}"${k === 'Atrasados' ? ' data-tab="alertas"' : ''}><span>${k}</span><strong>${v}</strong></div>`).join('') + avisoAtraso();
  }

  // ---------- alertas de cobro
  const DIA = 86400000;
  const diasEntre = (a, b) => Math.round((Calc.d(b) - Calc.d(a)) / DIA);
  function listaAlertas() {
    const hoy = hoyISO(), lim = +($('al-dias').value || 7);
    const atr = [], prox = [];
    S.ventas.filter(v => v.tipo === 'Crédito' && v.estado === 'Activo').forEach(v => {
      const c = S.calc[v.id], cl = cliente(v.cliente_id);
      if (!c || c.saldo == null || c.saldo <= 0.01 || !c.proximo) return;
      const dias = diasEntre(c.proximo, hoy);
      if ((c.cuotasAtrasadas || 0) > 0) atr.push({ v, c, cl, dias });
      else if (dias <= 0 && -dias <= lim) prox.push({ v, c, cl, dias: -dias });
    });
    atr.sort((a, b) => b.dias - a.dias); prox.sort((a, b) => a.dias - b.dias);
    return { atr, prox };
  }
  function waRecordatorio(x, atrasado) {
    const n = x.c.cuotasAtrasadas;
    const msg = atrasado
      ? [`Estimado(a) ${x.cl?.nombre || ''}:`, '', `Le saludamos de *${L.nombre}*. Le recordamos que su lote ${x.v.lote} tiene ${n === 1 ? '1 cuota pendiente' : n + ' cuotas pendientes'} por un total de *${money(x.c.atraso)}*.`, `El pago venció el ${fLarga(x.c.proximo)}.`, '', `Le agradecemos ponerse al día.${L.telefono ? ` Para cualquier consulta: ${L.telefono}.` : ''}`].join('\n')
      : [`Estimado(a) ${x.cl?.nombre || ''}:`, '', `Le saludamos de *${L.nombre}*. Le recordamos que su cuota de *${money(x.c.cuota)}* del lote ${x.v.lote} vence el ${fLarga(x.c.proximo)}.`, '', `Gracias por su puntualidad.${L.telefono ? ` Consultas: ${L.telefono}.` : ''}`].join('\n');
    const tel = (x.cl?.telefono || '').replace(/\D/g, '');
    return `https://wa.me/${tel.length === 8 ? '503' + tel : tel}?text=${encodeURIComponent(msg)}`;
  }
  function tarjeta(x, atrasado) {
    const tel = x.cl?.telefono;
    return `<div class="alcard${atrasado ? '' : ' prox'}">
      <div class="top"><b>${esc(x.cl?.nombre)} · ${esc(x.v.lote)}</b><span class="monto">${money(atrasado ? x.c.atraso : x.c.cuota)}</span></div>
      <div class="muted">${atrasado
        ? `${x.c.cuotasAtrasadas === 1 ? '1 cuota atrasada' : x.c.cuotasAtrasadas + ' cuotas atrasadas'} · venció el ${fd(x.c.proximo)} (${x.dias} ${x.dias === 1 ? 'día' : 'días'})`
        : `Cuota ${x.dias === 0 ? 'vence hoy' : `vence el ${fd(x.c.proximo)} (en ${x.dias} ${x.dias === 1 ? 'día' : 'días'})`}`}
        ${tel ? ` · Tel. ${esc(tel)}` : ' · <span class="err">sin teléfono</span>'}</div>
      <div class="row"><a class="btn sm" href="${waRecordatorio(x, atrasado)}" target="_blank" rel="noopener">Recordar por WhatsApp</a><button class="btn ghost sm" type="button" data-ver="${x.v.id}">Estado de cuenta</button></div>
    </div>`;
  }
  function pintarAlertas() {
    const { atr, prox } = listaAlertas();
    const b = $('badge-al'); b.textContent = atr.length; b.hidden = !atr.length;
    const total = atr.reduce((s, x) => s + (x.c.atraso || 0), 0);
    $('alertas').innerHTML =
      `<div class="kpis"><div class="kpi"><span>Clientes atrasados</span><strong>${atr.length}</strong></div><div class="kpi"><span>Monto atrasado</span><strong>${money(total)}</strong></div><div class="kpi"><span>Por vencer</span><strong>${prox.length}</strong></div></div>
      <h3>Atrasados</h3><div class="allist">${atr.length ? atr.map(x => tarjeta(x, true)).join('') : '<p class="muted">Nadie está atrasado. 👍</p>'}</div>
      <h3>Por vencer</h3><div class="allist">${prox.length ? prox.map(x => tarjeta(x, false)).join('') : '<p class="muted">No hay cuotas por vencer en estos días.</p>'}</div>
      <p class="hint">Para que el botón de WhatsApp abra directo el chat del cliente, guarde su teléfono en "Editar contrato".</p>`;
  }
  function avisoAtraso() {
    const { atr } = listaAlertas(); if (!atr.length) return '';
    const total = atr.reduce((s, x) => s + (x.c.atraso || 0), 0);
    return `<div class="aviso" style="grid-column:1/-1"><span><b>${atr.length} ${atr.length === 1 ? 'cliente atrasado' : 'clientes atrasados'}</b> · ${money(total)} sin cobrar</span><button class="btn sm" type="button" data-tab="alertas">Ver alertas</button></div>`;
  }
  $('al-dias').addEventListener('change', pintarAlertas);

  let polys = null;
  function pintarMapa() {
    if (!polys) {
      polys = Mapa.dibujar($('mapa'), code => { const l = lote(code); return l ? +l.area_m2 : 200; });
      Object.entries(polys).forEach(([code, poly]) => {
        poly.addEventListener('click', () => panelLote(code));
        poly.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); panelLote(code); } });
      });
    }
    Object.entries(polys).forEach(([code, poly]) => {
      const st = estadoLote(lote(code));
      poly.setAttribute('class', `lot ${st}${S.sel === code ? ' sel' : ''}`);
      poly.firstChild.textContent = `${code} · ${{ free: 'Disponible', sold: 'Vendido', res: 'Reservado', na: 'No está a la venta' }[st]}`;
    });
  }

  function panelLote(code) {
    S.sel = code; pintarMapa();
    const l = lote(code), st = estadoLote(l), box = $('panel-lote');
    if (!l || st === 'na') { box.innerHTML = `<h2>Lote ${esc(code)}</h2><div class="alert warn"><b>No está a la venta</b>${esc(l?.observaciones || 'Este lote no se vende.')}</div>`; return; }
    const head = `<h2>Lote ${esc(code)}</h2><dl class="sum"><dt>Área</dt><dd>${l.area_m2} m² · ${(+l.area_v2).toFixed(2)} v²</dd><dt>Precio de lista</dt><dd>${money(l.precio_lista)}</dd></dl>`;
    if (st === 'res') {
      const v = ventaVigente(code), c = S.calc[v.id], cl = cliente(v.cliente_id);
      box.innerHTML = head + `<div class="alert bad"><b>RESERVADO</b>No se puede ofrecer.</div>
        <dl class="sum"><dt>Cliente</dt><dd>${esc(cl?.nombre)}</dd>${cl?.telefono ? `<dt>Teléfono</dt><dd>${esc(cl.telefono)}</dd>` : ''}<dt>Reservado el</dt><dd>${fd(v.fecha)}</dd><dt>Dinero de reserva</dt><dd>${money(c.totalPagado)}</dd><dt>Contrato</dt><dd>${esc(ctr(v))}</dd></dl>
        <button class="btn ghost" type="button" data-ver="${v.id}">Ver detalle</button>`;
      return;
    }
    if (st === 'sold') {
      const v = ventaVigente(code), c = S.calc[v.id], cl = cliente(v.cliente_id);
      box.innerHTML = head + `<div class="alert bad"><b>VENDIDO</b>No se puede ofrecer.</div>
        <dl class="sum"><dt>Cliente</dt><dd>${esc(cl?.nombre)}</dd><dt>Contrato</dt><dd>${esc(ctr(v))}</dd><dt>Tipo</dt><dd>${esc(v.tipo)}</dd><dt>Saldo</dt><dd>${money(c.saldo)}</dd></dl>
        <p>${chipSit(c.situacion)}</p><button class="btn ghost" type="button" data-ver="${v.id}">Ver estado de cuenta</button>`;
      return;
    }
    box.innerHTML = head + `<div class="alert ok"><b>Disponible</b>Ajuste la cotización y envíela por WhatsApp.</div>
      <div class="fields">
        <div><label for="q-precio">Precio ($)</label><input id="q-precio" class="num" value="${(+l.precio_lista).toFixed(2)}"></div>
        <div><label for="q-prima">Prima ($)</label><input id="q-prima" class="num" value="${(Math.ceil(l.precio_lista * Calc.PRIMA_MIN * 100) / 100).toFixed(2)}"></div>
        <div class="full"><label for="q-plazo">Plazo</label><select id="q-plazo">${plazos(12)}</select></div>
      </div>
      <div id="q-res"></div>
      <label>Mensaje para el cliente</label><pre class="msg" id="q-msg"></pre>
      <div class="row"><a class="btn" id="q-wa" target="_blank" rel="noopener" href="#">Abrir en WhatsApp</a><button class="btn ghost" type="button" id="q-copy">Copiar</button>
      ${puede('admin', 'ventas') ? `<button class="btn ghost" type="button" data-vender="${esc(code)}">Registrar venta</button><button class="btn ghost" type="button" data-reservar="${esc(code)}">Reservar</button>` : ''}</div>`;
    const upd = () => {
      const precio = num($('q-precio').value), prima = num($('q-prima').value), n = +$('q-plazo').value;
      const fin = precio - prima, cuota = Calc.cuotaTabla(fin, n), min = Math.ceil(precio * Calc.PRIMA_MIN * 100) / 100;
      const A = [];
      if (precio < l.precio_lista - 0.005) A.push(`<div class="alert warn"><b>Descuento de ${money(l.precio_lista - precio)}</b>Necesita autorización.</div>`);
      if (prima + 0.005 < min) A.push(`<div class="alert bad"><b>Prima debajo del 5%</b>Mínimo ${money(min)}.</div>`);
      $('q-res').innerHTML = A.join('') + `<dl class="sum"><dt>Financiado</dt><dd>${money(fin)}</dd><dt>Cuota (${n / 12} años)</dt><dd><b>${money(cuota)}</b></dd></dl>`;
      const msg = [`*${L.nombre}* · Cotización`, '', `Lote ${l.codigo} (polígono ${l.poligono}): *DISPONIBLE*`, `Área: ${l.area_m2} m² (${(+l.area_v2).toFixed(2)} v²)`,
        `Precio: ${money(precio)}`, `Prima: ${money(prima)}`, `Saldo a financiar: ${money(fin)}`, `Plazo: ${n / 12} ${n === 12 ? 'año' : 'años'} (${n} cuotas)`, `*Cuota mensual: ${money(cuota)}*`, `Interés: 12% anual sobre saldos`, '', L.telefono ? `Tel. ${L.telefono}` : ''].join('\n');
      $('q-msg').textContent = msg; $('q-wa').href = 'https://wa.me/?text=' + encodeURIComponent(msg);
    };
    ['q-precio', 'q-prima', 'q-plazo'].forEach(id => $(id).addEventListener('input', upd));
    $('q-copy').addEventListener('click', () => copiar($('q-msg').textContent));
    upd();
  }
  function plazos(sel) { let h = ''; for (let a = 1; a <= 12; a++) h += `<option value="${a * 12}"${a === sel ? ' selected' : ''}>${a} ${a === 1 ? 'año' : 'años'} (${a * 12} cuotas)</option>`; return h; }
  function copiar(txt) { try { navigator.clipboard.writeText(txt).then(() => toast('Copiado'), () => toast('No se pudo copiar')); } catch (e) { toast('No se pudo copiar'); } }

  // ---------- contratos
  function pintarContratos() {
    const q = ($('buscar').value || '').toLowerCase(), f = $('filtro').value;
    let list = S.ventas.filter(v => {
      const c = S.calc[v.id], cl = cliente(v.cliente_id);
      const txt = `${ctr(v)} ${v.lote} ${cl?.nombre}`.toLowerCase();
      if (q && !txt.includes(q)) return false;
      if (f === 'credito') return v.tipo === 'Crédito' && v.estado === 'Activo';
      if (f === 'atrasados') return (c.cuotasAtrasadas || 0) > 0;
      if (f === 'pagados') return c.situacion === 'Pagado';
      if (f === 'reservados') return v.estado === 'Reservado';
      return true;
    });
    list.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    $('t-contratos').innerHTML = `<thead><tr><th>Lote</th><th>Cliente</th><th>Tipo</th><th class="n">Saldo</th><th>Situación</th><th>Próximo pago</th><th>Contrato</th></tr></thead><tbody>` +
      list.map(v => { const c = S.calc[v.id], res = v.estado === 'Reservado'; return `<tr class="click" data-ver="${v.id}"><td>${esc(v.lote || '—')}</td><td>${esc(cliente(v.cliente_id)?.nombre)}</td><td>${res ? 'Reserva' : esc(v.tipo)}</td><td class="n">${res ? `<span class="hint">reserva ${money(c.totalPagado)}</span>` : money(c.saldo)}</td><td>${chipSit(c.situacion)}</td><td>${fd(c.proximo)}</td><td>${esc(ctr(v))}</td></tr>`; }).join('') +
      `</tbody>`;
  }
  $('buscar').addEventListener('input', pintarContratos); $('filtro').addEventListener('change', pintarContratos);

  document.addEventListener('click', e => {
    const ver = e.target.closest('[data-ver]'); if (ver) { verContrato(+ver.dataset.ver); return; }
    const vend = e.target.closest('[data-vender]'); if (vend) { irVenta(vend.dataset.vender); return; }
    const rsv = e.target.closest('[data-reservar]'); if (rsv) { irVenta(rsv.dataset.reservar, 'Reserva'); return; }
    const tab = e.target.closest('[data-tab]'); if (tab) { irTab(tab.dataset.tab); return; }
    if (e.target.closest('[data-cerrar]')) $('dlg').close();
  });
  function irTab(t) {
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    document.querySelectorAll('[data-view]').forEach(s => s.hidden = s.dataset.view !== t);
  }

  function verContrato(id) {
    const v = S.ventas.find(x => x.id === id), c = S.calc[id], cl = cliente(v.cliente_id), l = lote(v.lote);
    const pagos = S.pagos.filter(p => p.venta_id === id);
    const filas = Object.fromEntries(c.filas.map(f => [f.id, f]));
    const res = v.estado === 'Reservado';
    const cred = v.tipo === 'Crédito' && !res;
    const rows = pagos.map(p => { const f = filas[p.id];
      return `<tr><td>${fd(p.fecha)}</td><td>${esc(p.tipo)}</td><td class="n">${money(p.monto)}</td>${cred ? `<td class="n">${f ? money(f.aInteres) : ''}</td><td class="n">${f ? money(f.aCapital) : ''}</td><td class="n">${f ? money(f.saldo) : ''}</td>` : ''}<td>${esc(p.forma || '')}</td><td>${esc(p.recibo || '')}</td><td style="white-space:nowrap"><button class="btn ghost sm" type="button" data-recibo="${p.id}">Recibo</button>${puede('admin') ? ` <button class="btn danger sm" type="button" data-borrar-pago="${p.id}">Borrar</button>` : ''}</td></tr>`; }).join('');
    const msg = res
      ? [`*${L.nombre}* · Reserva de lote`, '', `Cliente: ${cl?.nombre}`, `Lote: ${v.lote}`, `Fecha de reserva: ${fLarga(v.fecha)}`, `Dinero de reserva recibido: ${money(c.totalPagado)}`, c.precio != null ? `Precio del lote: ${money(c.precio)}` : '', '', L.telefono ? `Tel. ${L.telefono}` : ''].join('\n')
      : [`*${L.nombre}* · Estado de cuenta`, '', `Cliente: ${cl?.nombre}`, `Lote: ${v.lote} · Contrato ${ctr(v)}`,
        cred ? `Cuota mensual: ${money(c.cuota)}` : `Venta al contado: ${money(c.precio)}`, `Total pagado: ${money(c.totalPagado)}`, `Saldo: ${money(c.saldo)}`,
        c.situacion ? `Situación: ${c.situacion}` : '', c.proximo ? `Próximo pago: ${fLarga(c.proximo)}` : '', '', L.telefono ? `Tel. ${L.telefono}` : ''].filter(x => x !== null).join('\n');
    const tel = (cl?.telefono || '').replace(/\D/g, ''), wa = `https://wa.me/${tel.length === 8 ? '503' + tel : tel}?text=${encodeURIComponent(msg)}`;
    const resumen = res
      ? `<div class="alert warn"><b>Lote reservado, sin contrato</b>Solo se ha recibido el dinero de la reserva. Cuando se formalice, la administración completa el contrato, el tipo de venta y el plan de pagos en "Editar contrato" y cambia el estado a Activo.</div>
        <dl class="sum"><dt>Reservado el</dt><dd>${fd(v.fecha)}</dd><dt>Precio acordado</dt><dd>${money(c.precio)}</dd><dt>Dinero de reserva</dt><dd><b>${money(c.totalPagado)}</b></dd>${cl?.telefono ? `<dt>Teléfono</dt><dd>${esc(cl.telefono)}</dd>` : ''}</dl>`
      : `<dl class="sum">
        <dt>Precio</dt><dd>${money(c.precio)}${l && c.precio != null && c.precio < l.precio_lista - 0.005 ? ` <span class="chip warn">lista ${money0(l.precio_lista)}</span>` : ''}</dd>
        ${cred ? `<dt>Prima</dt><dd>${money(c.primaTomada)}</dd><dt>Financiado</dt><dd>${money(c.saldoArranque)}</dd><dt>Plazo · cuota</dt><dd>${c.plazo ? c.plazo + ' meses · ' : ''}${money(c.cuota)}</dd><dt>Primera cuota</dt><dd>${fd(v.fecha_primera_cuota)}</dd>` : ''}
        <dt>Total pagado</dt><dd>${money(c.totalPagado)}</dd>
        ${cred ? `<dt>Interés pagado</dt><dd>${money(c.interesPagado)}</dd>` : ''}
        <dt><b>Saldo</b></dt><dd><b>${money(c.saldo)}</b></dd>
        ${cred && c.atraso ? `<dt>Atraso</dt><dd>${money(c.atraso)}</dd>` : ''}${cred && c.adelantado ? `<dt>Adelantado</dt><dd>${money(c.adelantado)}</dd>` : ''}
        ${c.proximo ? `<dt>Próximo pago</dt><dd>${fd(c.proximo)}</dd>` : ''}${c.terminaria ? `<dt>Terminaría</dt><dd>${fd(c.terminaria)}</dd>` : ''}
      </dl>`;
    abrir(`<div class="dlg-head"><div><h2>${esc(cl?.nombre)}</h2><p class="muted">Lote ${esc(v.lote || '—')} · ${esc(ctr(v))} · ${res ? 'Reserva' : esc(v.tipo)} · ${fd(v.fecha)}</p></div><button class="btn ghost sm" data-cerrar>Cerrar</button></div>
      <p>${chipSit(c.situacion)}</p>
      ${resumen}
      ${v.observaciones ? `<p class="muted">${esc(v.observaciones)}</p>` : ''}
      <h3>Pagos</h3>
      <div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th class="n">Monto</th>${cred ? '<th class="n">Interés</th><th class="n">Capital</th><th class="n">Saldo</th>' : ''}<th>Forma</th><th>Recibo</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="9" class="muted">Sin pagos.</td></tr>'}</tbody></table></div>
      <div class="row" style="margin-top:14px">
        ${puede('admin', 'cobros', 'ventas') && v.estado !== 'Rescindido' ? `<button class="btn" type="button" id="b-pago">${res ? 'Agregar a la reserva' : 'Registrar pago'}</button>` : ''}
        <a class="btn ghost" href="${wa}" target="_blank" rel="noopener">${res ? 'Enviar por WhatsApp' : 'Estado de cuenta por WhatsApp'}</a>
        ${puede('admin') ? `<button class="btn ghost" type="button" id="b-editar">${res ? 'Formalizar / editar' : 'Editar contrato'}</button>` : ''}
      </div>`);
    $('b-pago')?.addEventListener('click', () => formPago(v));
    $('b-editar')?.addEventListener('click', () => formEditar(v));
    document.querySelectorAll('[data-recibo]').forEach(b => b.addEventListener('click', () => verRecibo(+b.dataset.recibo)));
    document.querySelectorAll('[data-borrar-pago]').forEach(b => b.addEventListener('click', async () => {
      if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = '¿Seguro?'; return; }
      const { error } = await sb.from('pagos').delete().eq('id', +b.dataset.borrarPago);
      if (error) return toast('No se pudo borrar: ' + error.message);
      toast('Pago borrado'); await cargar(); verContrato(id);
    }));
  }
  function abrir(html) { $('dlg-body').innerHTML = html; if (!$('dlg').open) $('dlg').showModal(); }

  function formPago(v) {
    const c = S.calc[v.id], soloVentas = puede('ventas') && !puede('admin', 'cobros') && !S.perfil.puede_cobrar;
    const res = v.estado === 'Reservado';
    const tipos = res ? ['Reserva'] : v.tipo === 'Contado' ? ['Pago de contado', 'Reserva'] : soloVentas ? ['Prima', 'Reserva'] : ['Cuota mensual', 'Abono extra a capital', 'Prima', 'Reserva'];
    const sug = res ? null : v.tipo === 'Contado' ? c.saldo : c.cuota;
    abrir(`<div class="dlg-head"><h2>Registrar pago · ${esc(v.lote)}</h2><button class="btn ghost sm" data-cerrar>Cerrar</button></div>
      <form id="f-pago" class="fields">
        <div><label for="p-fecha">Fecha</label><input id="p-fecha" type="date" value="${hoyISO()}" required></div>
        <div><label for="p-tipo">Tipo</label><select id="p-tipo">${tipos.map(t => `<option>${t}</option>`).join('')}</select></div>
        <div><label for="p-monto">Monto ($)</label><input id="p-monto" class="num" inputmode="decimal" value="${sug != null ? (+sug).toFixed(2) : ''}" required></div>
        <div><label for="p-forma">Forma de pago</label><select id="p-forma"><option>Efectivo</option><option>Transferencia</option><option>Depósito bancario</option><option>Cheque</option></select></div>
        <div><label for="p-recibo">No. de recibo</label><input id="p-recibo" value="${esc(siguienteRecibo())}"><div class="hint">Sugerido; puede cambiarlo.</div></div>
        <div><label for="p-nota">Nota</label><input id="p-nota"></div>
        <div class="full" id="p-prev"></div>
        <div class="full"><button class="btn" type="submit" id="p-ok">Guardar pago</button></div>
      </form>`);
    const prev = () => {
      const m = num($('p-monto').value); if (!(m > 0) || v.tipo !== 'Crédito' || res) { $('p-prev').innerHTML = ''; return; }
      const sim = Calc.calcular(v, lote(v.lote), [...S.pagos.filter(p => p.venta_id === v.id), { id: 1e12, fecha: $('p-fecha').value, tipo: $('p-tipo').value, monto: m }], hoyISO());
      const f = sim.filas.find(x => x.id === 1e12);
      $('p-prev').innerHTML = f ? `<div class="alert ok"><b>Así se aplica</b>Interés ${money(f.aInteres)} (${f.meses} ${f.meses === 1 ? 'mes' : 'meses'}) · capital ${money(f.aCapital)} · saldo queda en ${money(f.saldo)}</div>` : '';
    };
    ['p-monto', 'p-fecha', 'p-tipo'].forEach(id => $(id).addEventListener('input', prev)); prev();
    $('f-pago').addEventListener('submit', async e => {
      e.preventDefault(); $('p-ok').disabled = true;
      const row = { fecha: $('p-fecha').value, venta_id: v.id, tipo: $('p-tipo').value, monto: num($('p-monto').value), forma: $('p-forma').value, recibo: $('p-recibo').value.trim() || null, nota: $('p-nota').value.trim() || null };
      const { data: nuevo, error } = await sb.from('pagos').insert(row).select('id').single();
      $('p-ok').disabled = false;
      if (error) return toast(error.message.includes('pagos_recibo_unico') ? 'Ese número de recibo ya existe.' : 'No se pudo guardar: ' + error.message);
      // contado: si ya cubre el precio, marcar pagado
      if (!res && v.tipo === 'Contado' && puede('admin')) { const tot = S.calc[v.id].totalPagado + row.monto; if (S.calc[v.id].precio != null && tot >= S.calc[v.id].precio - 0.01) await sb.from('ventas').update({ estado: 'Pagado' }).eq('id', v.id); }
      toast('Pago guardado'); await cargar(); verRecibo(nuevo.id);
    });
  }

  // ---------- recibos
  function siguienteRecibo() {
    let max = 0, ancho = 6;
    S.pagos.forEach(p => { const m = String(p.recibo || '').match(/(\d+)\s*$/); if (m) { const n = +m[1]; if (n > max) { max = n; ancho = Math.max(m[1].length, 4); } } });
    return String(max + 1).padStart(ancho, '0');
  }
  const UNI = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
  const DEC = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const CEN = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
  function menorMil(n) {
    if (n === 100) return 'CIEN';
    const c = Math.floor(n / 100), r = n % 100; let s = CEN[c];
    if (r) s += (s ? ' ' : '') + (r < 30 ? UNI[r] : DEC[Math.floor(r / 10)] + (r % 10 ? ' Y ' + UNI[r % 10] : ''));
    return s;
  }
  function enLetras(v) {
    const ent = Math.floor(Math.round(v * 100) / 100), cts = Math.round((v - ent) * 100);
    let s;
    if (ent === 0) s = 'CERO';
    else {
      const mill = Math.floor(ent / 1e6), miles = Math.floor((ent % 1e6) / 1000), resto = ent % 1000; const p = [];
      if (mill) p.push(mill === 1 ? 'UN MILLÓN' : menorMil(mill) + ' MILLONES');
      if (miles) p.push(miles === 1 ? 'MIL' : menorMil(miles) + ' MIL');
      if (resto) p.push(menorMil(resto));
      s = p.join(' ');
    }
    return `${s} ${String(cts).padStart(2, '0')}/100 DÓLARES`;
  }
  function datosRecibo(pid, numero) {
    const p = S.pagos.find(x => x.id === pid), v = S.ventas.find(x => x.id === p.venta_id), c = S.calc[v.id], cl = cliente(v.cliente_id);
    const f = (c.filas || []).find(x => x.id === pid);
    const concepto = { 'Cuota mensual': f ? `Cuota mensual n.º ${f.cuotaNo}` : 'Cuota mensual', 'Abono extra a capital': 'Abono extra a capital', 'Prima': 'Prima', 'Reserva': 'Reserva de lote', 'Pago de contado': 'Pago de contado' }[p.tipo] || p.tipo;
    return { p, v, c, cl, f, numero, concepto };
  }
  function reciboHTML(d, copia) {
    const { p, v, c, cl, f, numero, concepto } = d;
    const fila = (k, val) => `<tr><td class="k">${k}</td><td>${val}</td></tr>`;
    let detalle = fila('Concepto', `${esc(concepto)} · Lote ${esc(v.lote)}${sinContrato(v) ? '' : ` · Contrato ${esc(v.contrato)}`}`) + fila('Forma de pago', esc(p.forma || '—'));
    if (v.estado === 'Reservado') detalle += fila('Precio acordado del lote', money(c.precio)) + fila('Total recibido como reserva', money(c.totalPagado));
    else if (f) detalle += fila('Aplicado a intereses', money(f.aInteres)) + fila('Aplicado a capital', money(f.aCapital)) + fila('Saldo de capital después de este pago', `<b>${money(f.saldo)}</b>`);
    else if (v.tipo === 'Contado') detalle += fila('Precio del lote', money(c.precio)) + fila('Saldo pendiente', money(c.saldo));
    else detalle += fila('Precio del lote', money(c.precio));
    if (p.nota) detalle += fila('Nota', esc(p.nota));
    return `<div class="rec"><div class="hd"><div><div class="t">${esc(L.nombre)}</div><div class="s">${esc([L.ubicacion, L.telefono ? 'Tel. ' + L.telefono : ''].filter(Boolean).join(' · '))}</div></div>
      <div class="num"><div class="s">RECIBO DE PAGO${copia ? ' · COPIA' : ''}</div><div class="n">N.º ${esc(numero || '________')}</div><div class="s">Fecha: ${fd(p.fecha)}</div></div></div>
      <div class="monto">${money(p.monto)}</div>
      <p>Recibí de <b>${esc(cl?.nombre || '')}</b>${cl?.dui ? `, DUI ${esc(cl.dui)}` : ''}, la cantidad de <b>${enLetras(+p.monto)}</b>.</p>
      <table>${detalle}</table>
      <div class="firmas"><div>Recibido por</div><div>Entregado por (cliente)</div></div></div>`;
  }
  const RECIBO_CSS = `body{font-family:Arial,Helvetica,sans-serif;color:#1d2420;margin:0}
    .rec{border:1.5px solid #2f5d46;border-radius:8px;padding:18px 22px;margin:0 0 14px;page-break-inside:avoid;font-size:13px;line-height:1.45}
    .hd{display:flex;justify-content:space-between;gap:12px;border-bottom:2px solid #2f5d46;padding-bottom:8px;margin-bottom:10px}
    .t{font-size:19px;font-weight:700;color:#2f5d46}.s{font-size:11px;color:#5d6a62}.num{text-align:right}.n{font-size:17px;font-weight:700;color:#a3271b}
    .monto{float:right;font-size:20px;font-weight:700;border:1.5px solid #2f5d46;border-radius:6px;padding:4px 12px;margin:0 0 6px 12px}
    table{width:100%;border-collapse:collapse;margin:8px 0}td{border-bottom:1px solid #d9ded5;padding:4px 6px;vertical-align:top}td.k{color:#5d6a62;width:42%}
    .firmas{display:flex;gap:40px;margin-top:38px}.firmas div{flex:1;border-top:1px solid #1d2420;text-align:center;padding-top:4px;font-size:11px}
    .corte{border-top:1px dashed #999;margin:4px 0 14px}@page{size:letter;margin:12mm}`;
  function imprimirRecibo(d, w) {
    if (!w) { toast('Permita las ventanas emergentes para imprimir.'); return; }
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Recibo ${esc(d.numero || '')}</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>${RECIBO_CSS}</style></head><body>${reciboHTML(d, false)}<div class="corte"></div>${reciboHTML(d, true)}<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`);
    w.document.close();
  }
  function verRecibo(pid) {
    const p = S.pagos.find(x => x.id === pid); if (!p) return;
    const guardado = p.recibo || '', admin = puede('admin');
    const sugerido = guardado || siguienteRecibo();
    const vista = () => { const html = `<!doctype html><html><head><meta charset="utf-8"><style>${RECIBO_CSS}body{margin:8px}</style></head><body>${reciboHTML(datosRecibo(pid, $('r-num') ? $('r-num').value.trim() : sugerido), false)}</body></html>`; return `<iframe title="Vista del recibo" style="width:100%;height:470px;border:0;border-radius:8px;background:#fff" srcdoc="${esc(html)}"></iframe>`; };
    abrir(`<div class="dlg-head"><h2>Recibo de pago</h2><button class="btn ghost sm" data-cerrar>Cerrar</button></div>
      <div class="fields"><div><label for="r-num">No. de recibo</label><input id="r-num" value="${esc(sugerido)}">
      <div class="hint">${guardado ? (admin ? 'Puede corregirlo y guardarlo.' : 'Número ya guardado. Solo la administración puede cambiarlo.') : (admin ? 'Número sugerido; puede cambiarlo antes de guardar.' : 'Este pago no tiene número guardado; la administración puede asignarlo. Puede imprimir con el número que escriba.')}</div></div></div>
      <div id="r-vista">${vista()}</div>
      <div class="row" style="margin-top:14px"><button class="btn" type="button" id="r-print">Imprimir</button>${admin ? '<button class="btn ghost" type="button" id="r-save">Guardar número</button>' : ''}<button class="btn ghost" type="button" data-ver="${p.venta_id}">Volver al contrato</button></div>`);
    $('r-num').addEventListener('input', () => { $('r-vista').innerHTML = vista(); });
    $('r-print').addEventListener('click', async () => {
      const num = $('r-num').value.trim(), w = window.open('', '_blank');
      if (admin && num && num !== guardado) { const ok = await guardarRecibo(pid, num); if (!ok) { w && w.close(); return; } }
      imprimirRecibo(datosRecibo(pid, num), w);
    });
    $('r-save')?.addEventListener('click', () => guardarRecibo(pid, $('r-num').value.trim()));
  }
  async function guardarRecibo(pid, num) {
    const { error } = await sb.from('pagos').update({ recibo: num || null }).eq('id', pid);
    if (error) { toast(error.message.includes('pagos_recibo_unico') ? 'Ese número de recibo ya existe.' : 'No se pudo guardar: ' + error.message); return false; }
    const p = S.pagos.find(x => x.id === pid); if (p) p.recibo = num || null;
    toast('Número de recibo guardado'); return true;
  }

  function formEditar(v) {
    const campos = [['estado', 'Estado', 'sel', ['Reservado', 'Activo', 'Pagado', 'Rescindido']], ['tipo', 'Tipo de venta', 'sel', ['Crédito', 'Contado']], ['contrato', 'No. de contrato'], ['fecha', 'Fecha de venta', 'date'], ['precio_pactado', 'Precio pactado', 'num'],
      ['plazo', 'Plazo (meses)', 'num'], ['cuota_pactada', 'Cuota pactada', 'num'], ['tasa', 'Tasa anual (0.12 = 12%)', 'num'], ['fecha_primera_cuota', 'Primera cuota', 'date'],
      ['saldo_inicial_libro', 'Saldo al pasar al sistema', 'num'], ['cuotas_antes', 'Cuotas pagadas antes', 'num'], ['observaciones', 'Observaciones']];
    const cl = cliente(v.cliente_id), res = v.estado === 'Reservado';
    abrir(`<div class="dlg-head"><h2>${res ? 'Formalizar reserva · ' + esc(v.lote) : 'Editar ' + esc(v.contrato)}</h2><button class="btn ghost sm" data-cerrar>Cerrar</button></div>
      ${res ? '<div class="alert warn"><b>Para formalizar</b>Escriba el número de contrato, elija el tipo de venta, ponga el estado en Activo y, si es al crédito, el plazo y la fecha de la primera cuota. El dinero de la reserva cuenta como parte de la prima.</div>' : ''}
      <form id="f-edit" class="fields">
        <div><label for="e-cnombre">Cliente</label><input id="e-cnombre" value="${esc(cl?.nombre)}"></div>
        <div><label for="e-cdui">DUI</label><input id="e-cdui" value="${esc(cl?.dui || '')}"></div>
        <div><label for="e-ctel">Teléfono</label><input id="e-ctel" value="${esc(cl?.telefono || '')}"></div>
        ${campos.map(([k, t, ty, opts]) => `<div${k === 'observaciones' ? ' class="full"' : ''}><label for="e-${k}">${t}</label>${ty === 'sel' ? `<select id="e-${k}">${opts.map(o => `<option${v[k] === o ? ' selected' : ''}>${o}</option>`).join('')}</select>` : `<input id="e-${k}" ${ty === 'date' ? 'type="date"' : ty === 'num' ? 'class="num" inputmode="decimal"' : ''} value="${esc(k === 'contrato' && sinContrato(v) ? '' : v[k] ?? '')}"${k === 'contrato' && sinContrato(v) ? ' placeholder="Sin contrato todavía"' : ''}>`}</div>`).join('')}
        <div class="full"><button class="btn" type="submit" id="e-ok">Guardar cambios</button></div>
      </form>`);
    $('f-edit').addEventListener('submit', async e => {
      e.preventDefault(); $('e-ok').disabled = true;
      const upd = {};
      campos.forEach(([k, , ty]) => { const val = $('e-' + k).value.trim(); upd[k] = val === '' ? null : ty === 'num' ? num(val) : val; });
      if (!upd.contrato) {
        if (upd.estado !== 'Reservado' && sinContrato(v)) { $('e-ok').disabled = false; return toast('Escriba el número de contrato para formalizar.'); }
        upd.contrato = v.contrato;
      }
      if (res && upd.estado === 'Activo' && upd.tipo === 'Crédito' && (!upd.plazo || !upd.fecha_primera_cuota)) { $('e-ok').disabled = false; return toast('Para crédito falta el plazo y la fecha de la primera cuota.'); }
      const r1 = await sb.from('ventas').update(upd).eq('id', v.id);
      const r2 = await sb.from('clientes').update({ nombre: $('e-cnombre').value.trim(), dui: $('e-cdui').value.trim() || null, telefono: $('e-ctel').value.trim() || null }).eq('id', v.cliente_id);
      $('e-ok').disabled = false;
      const err = r1.error || r2.error; if (err) return toast(err.message.includes('ventas_contrato_key') ? 'Ese número de contrato ya existe.' : 'No se pudo guardar: ' + err.message);
      toast('Cambios guardados'); await cargar(); verContrato(v.id);
    });
  }

  // ---------- ventas: contado y crédito
  function enFechas(v) { const d1 = $('vt-desde').value, d2 = $('vt-hasta').value; return (!d1 || (v.fecha || '') >= d1) && (!d2 || (v.fecha || '') <= d2); }
  function ventasFiltradas() {
    return S.ventas.filter(v => v.estado !== 'Rescindido' && v.estado !== 'Reservado' && enFechas(v))
      .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || String(a.lote).localeCompare(String(b.lote)));
  }
  function filasVentas() {
    const list = ventasFiltradas();
    const con = list.filter(v => v.tipo === 'Contado').map(v => { const c = S.calc[v.id], l = lote(v.lote);
      return { v, c, cl: cliente(v.cliente_id), lista: l ? +l.precio_lista : null, precio: c.precio, pagado: c.totalPagado, saldo: c.saldo || 0 }; });
    const cre = list.filter(v => v.tipo === 'Crédito').map(v => { const c = S.calc[v.id], l = lote(v.lote);
      return { v, c, cl: cliente(v.cliente_id), lista: l ? +l.precio_lista : null, precio: c.precio, prima: c.primaPagada, financiado: c.saldoArranque, cuota: c.cuota, plazo: c.plazo,
        pagado: c.totalPagado, interes: c.interesPagado || 0, capital: c.precio != null && c.saldo != null ? r2(c.precio - c.saldo) : null, saldo: c.saldo || 0 }; });
    return { con, cre };
  }
  const r2 = Calc.r2, sum = (a, k) => r2(a.reduce((s, x) => s + (+x[k] || 0), 0));
  function pintarVentas() {
    const { con, cre } = filasVentas(), todos = [...con, ...cre];
    const reservas = S.ventas.filter(v => v.estado === 'Reservado' && enFechas(v)).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
    const totRes = r2(reservas.reduce((s, v) => s + (S.calc[v.id].totalPagado || 0), 0));
    const kpi = (t, v, sub) => `<div class="kpi"><span>${t}</span><strong>${v}</strong>${sub ? `<div class="hint">${sub}</div>` : ''}</div>`;
    const dif = x => x.lista != null && x.precio != null && x.precio < x.lista - 0.005 ? ` <span class="chip warn" title="Precio de lista ${money(x.lista)}">−${money0(x.lista - x.precio)}</span>` : '';
    $('ventas').innerHTML =
      `<div class="kpis">
        ${kpi('Lotes vendidos', todos.length, `${con.length} contado · ${cre.length} crédito`)}
        ${kpi('Total vendido', money0(sum(todos, 'precio')))}
        ${kpi('Cobrado', money0(sum(todos, 'pagado')), `${money0(sum(cre, 'interes'))} de intereses`)}
        ${kpi('Por cobrar', money0(sum(todos, 'saldo')))}
        ${kpi('Reservados', reservas.length, `${money0(totRes)} en reservas`)}
      </div>
      ${reservas.length ? `<h3>Reservados sin contrato · ${reservas.length} ${reservas.length === 1 ? 'lote' : 'lotes'}</h3>
      <div class="tablewrap" style="margin-bottom:22px"><table class="wide">
        <thead><tr><th>Fecha</th><th>Lote</th><th>Cliente</th><th>Teléfono</th><th class="n">Precio acordado</th><th class="n">Reserva</th></tr></thead>
        <tbody>${reservas.map(v => { const c = S.calc[v.id], cl = cliente(v.cliente_id); return `<tr class="click" data-ver="${v.id}"><td>${fd(v.fecha)}</td><td>${esc(v.lote)}</td><td>${esc(cl?.nombre)}</td><td>${esc(cl?.telefono || '—')}</td><td class="n">${money(c.precio)}</td><td class="n">${money(c.totalPagado)}</td></tr>`; }).join('')}</tbody>
        <tfoot><tr><td colspan="5">Total en reservas</td><td class="n">${money(totRes)}</td></tr></tfoot>
      </table></div>` : ''}
      <h3>Al contado · ${con.length} ${con.length === 1 ? 'lote' : 'lotes'}</h3>
      <div class="tablewrap" style="margin-bottom:22px"><table class="wide">
        <thead><tr><th>Fecha</th><th>Lote</th><th>Cliente</th><th class="n">Precio</th><th class="n">Pagado</th><th class="n">Saldo</th><th>Estado</th></tr></thead>
        <tbody>${con.map(x => `<tr class="click" data-ver="${x.v.id}"><td>${fd(x.v.fecha)}</td><td>${esc(x.v.lote)}</td><td>${esc(x.cl?.nombre)}</td><td class="n">${money(x.precio)}${dif(x)}</td><td class="n">${money(x.pagado)}</td><td class="n">${money(x.saldo)}</td><td>${chipSit(x.c.situacion)}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">No hay ventas al contado en estas fechas.</td></tr>'}</tbody>
        <tfoot><tr><td colspan="3">Total contado</td><td class="n">${money(sum(con, 'precio'))}</td><td class="n">${money(sum(con, 'pagado'))}</td><td class="n">${money(sum(con, 'saldo'))}</td><td></td></tr></tfoot>
      </table></div>
      <h3>Al crédito · ${cre.length} ${cre.length === 1 ? 'lote' : 'lotes'}</h3>
      <div class="tablewrap"><table class="wide">
        <thead><tr><th>Fecha</th><th>Lote</th><th>Cliente</th><th class="n">Precio</th><th class="n">Prima</th><th class="n">Financiado</th><th class="n">Cuota</th><th class="n">Pagado</th><th class="n">Intereses</th><th class="n">Saldo</th><th>Situación</th></tr></thead>
        <tbody>${cre.map(x => `<tr class="click" data-ver="${x.v.id}"><td>${fd(x.v.fecha)}</td><td>${esc(x.v.lote)}</td><td>${esc(x.cl?.nombre)}</td><td class="n">${money(x.precio)}${dif(x)}</td><td class="n">${money(x.prima)}</td><td class="n">${money(x.financiado)}</td><td class="n">${money(x.cuota)}${x.plazo ? `<div class="hint">× ${x.plazo}</div>` : ''}</td><td class="n">${money(x.pagado)}</td><td class="n">${money(x.interes)}</td><td class="n">${money(x.saldo)}</td><td>${chipSit(x.c.situacion)}</td></tr>`).join('') || '<tr><td colspan="11" class="muted">No hay ventas al crédito en estas fechas.</td></tr>'}</tbody>
        <tfoot><tr><td colspan="3">Total crédito</td><td class="n">${money(sum(cre, 'precio'))}</td><td class="n">${money(sum(cre, 'prima'))}</td><td class="n">${money(sum(cre, 'financiado'))}</td><td class="n">${money(sum(cre, 'cuota'))}</td><td class="n">${money(sum(cre, 'pagado'))}</td><td class="n">${money(sum(cre, 'interes'))}</td><td class="n">${money(sum(cre, 'saldo'))}</td><td></td></tr></tfoot>
      </table></div>
      <p class="hint">"Pagado" incluye prima, reservas y cuotas. Una etiqueta naranja junto al precio indica descuento sobre el precio de lista. Toque una fila para ver el estado de cuenta.</p>`;
  }
  ['vt-desde', 'vt-hasta'].forEach(id => $(id).addEventListener('change', pintarVentas));
  $('vt-limpiar').addEventListener('click', () => { $('vt-desde').value = ''; $('vt-hasta').value = ''; pintarVentas(); });
  $('vt-csv').addEventListener('click', async () => {
    const b = $('vt-csv'); b.disabled = true; b.textContent = 'Preparando…';
    try { await window.exportarVentasExcel(filasVentas(), $('vt-desde').value, $('vt-hasta').value); }
    catch (e) { toast(e.message || 'No se pudo descargar.'); }
    finally { b.disabled = false; b.textContent = 'Descargar Excel'; }
  });

  // ---------- cobros
  $('mes').value = hoyISO().slice(0, 7);
  $('mes').addEventListener('input', pintarCobros);
  function pintarCobros() {
    const mes = $('mes').value; if (!mes) return;
    const [y, m] = mes.split('-').map(Number);
    const cred = S.ventas.filter(v => v.tipo === 'Crédito' && v.estado === 'Activo');
    const filas = cred.map(v => {
      const c = S.calc[v.id], f1 = Calc.d(v.fecha_primera_cuota);
      const empieza = f1 ? (f1.getFullYear() * 12 + f1.getMonth()) <= (y * 12 + m - 1) : true;
      const dia = f1 ? f1.getDate() : null;
      const pagadoMes = S.pagos.filter(p => p.venta_id === v.id && p.fecha.slice(0, 7) === mes).reduce((s, p) => s + +p.monto, 0);
      return { v, c, empieza, dia, pagadoMes };
    }).filter(x => x.empieza).sort((a, b) => (a.dia || 99) - (b.dia || 99));
    const esperado = filas.reduce((s, x) => s + (x.c.cuota || 0), 0), cobrado = S.pagos.filter(p => p.fecha.slice(0, 7) === mes).reduce((s, p) => s + +p.monto, 0);
    const atras = filas.filter(x => (x.c.cuotasAtrasadas || 0) > 0);
    $('cobros').innerHTML = `<div class="kpis"><div class="kpi"><span>Cuotas del mes</span><strong>${money(esperado)}</strong></div><div class="kpi"><span>Recibido en el mes (todo)</span><strong>${money(cobrado)}</strong></div><div class="kpi"><span>Atrasados</span><strong>${atras.length}</strong></div></div>
      <div class="tablewrap"><table><thead><tr><th>Día</th><th>Lote</th><th>Cliente</th><th class="n">Cuota</th><th class="n">Pagado en el mes</th><th>Situación</th><th></th></tr></thead><tbody>` +
      filas.map(x => `<tr class="click" data-ver="${x.v.id}"><td>${x.dia ?? '—'}</td><td>${esc(x.v.lote)}</td><td>${esc(cliente(x.v.cliente_id)?.nombre)}</td><td class="n">${money(x.c.cuota)}</td><td class="n">${x.pagadoMes ? money(x.pagadoMes) : '—'}</td><td>${chipSit(x.c.situacion)}</td><td>${x.c.atraso ? money(x.c.atraso) : ''}</td></tr>`).join('') +
      `</tbody><tfoot><tr><td colspan="3">Total</td><td class="n">${money(esperado)}</td><td class="n">${money(filas.reduce((s, x) => s + x.pagadoMes, 0))}</td><td colspan="2"></td></tr></tfoot></table></div>`;
  }

  // ---------- nueva venta / reserva
  let vTipo = 'Crédito', vCli = 'nuevo';
  function pintarFormVenta() {
    if (!puede('admin', 'ventas')) return;
    const libres = S.lotes.filter(l => estadoLote(l) === 'free');
    const cur = $('v-lote').value;
    $('v-lote').innerHTML = libres.map(l => `<option value="${esc(l.codigo)}">${esc(l.codigo)} · ${l.area_m2} m² · ${money0(l.precio_lista)}</option>`).join('');
    if (cur && libres.find(l => l.codigo === cur)) $('v-lote').value = cur;
    $('v-cliente').innerHTML = S.clientes.map(c => `<option value="${c.id}">${esc(c.nombre)}${c.dui ? ' · ' + esc(c.dui) : ''}</option>`).join('');
    if (!$('v-plazo').options.length) $('v-plazo').innerHTML = plazos(12);
    if (!$('v-fecha').value) { $('v-fecha').value = hoyISO(); $('v-f1').value = Calc.iso(Calc.edate(new Date(), 1)); }
    if (!$('v-precio').value) ponerPrecio();
    if (!$('v-recibo').value) $('v-recibo').value = siguienteRecibo();
    revisarVenta();
  }
  function ponerPrecio() { const l = lote($('v-lote').value); if (!l) return; $('v-precio').value = (+l.precio_lista).toFixed(2); $('v-monto').value = vTipo === 'Crédito' ? (Math.ceil(l.precio_lista * Calc.PRIMA_MIN * 100) / 100).toFixed(2) : vTipo === 'Reserva' ? '' : (+l.precio_lista).toFixed(2); }
  function elegirTipo(t) {
    vTipo = t; const res = t === 'Reserva';
    document.querySelectorAll('[data-tipo]').forEach(x => x.setAttribute('aria-pressed', x.dataset.tipo === t));
    document.querySelectorAll('.cred').forEach(x => x.hidden = t !== 'Crédito');
    $('v-contrato-w').hidden = res; $('v-reserva-h').hidden = !res;
    $('v-monto-l').textContent = t === 'Crédito' ? 'Prima ($)' : res ? 'Monto de la reserva ($)' : 'Monto recibido ($)';
    $('v-fecha-l').textContent = res ? 'Fecha de la reserva' : 'Fecha de la venta';
    $('v-titulo').textContent = res ? 'Reservar lote' : 'Registrar venta';
    $('v-guardar').textContent = res ? 'Guardar reserva' : 'Guardar venta';
    ponerPrecio(); revisarVenta();
  }
  function irVenta(code, tipo) { $('dlg').open && $('dlg').close(); irTab('nueva'); $('v-lote').value = code; if (tipo) elegirTipo(tipo); else { ponerPrecio(); revisarVenta(); } }
  $('v-lote').addEventListener('change', () => { ponerPrecio(); revisarVenta(); });
  $('v-fecha').addEventListener('change', () => { const d = Calc.d($('v-fecha').value); if (d) $('v-f1').value = Calc.iso(Calc.edate(d, 1)); revisarVenta(); });
  ['v-precio', 'v-monto', 'v-plazo', 'v-f1'].forEach(id => $(id).addEventListener('input', revisarVenta));
  document.querySelectorAll('[data-tipo]').forEach(b => b.addEventListener('click', () => elegirTipo(b.dataset.tipo)));
  document.querySelectorAll('[data-cli]').forEach(b => b.addEventListener('click', () => {
    vCli = b.dataset.cli; document.querySelectorAll('[data-cli]').forEach(x => x.setAttribute('aria-pressed', x === b));
    $('cli-existe').hidden = vCli !== 'existe'; ['cli-nuevo-1', 'cli-nuevo-2', 'cli-nuevo-3'].forEach(id => $(id).hidden = vCli !== 'nuevo');
  }));
  function revisarVenta() {
    const l = lote($('v-lote').value); if (!l) { $('v-alerts').innerHTML = '<div class="alert warn"><b>No hay lotes disponibles</b></div>'; return; }
    const precio = num($('v-precio').value), monto = num($('v-monto').value), n = +$('v-plazo').value, A = [];
    $('v-precio-h').textContent = `Lista: ${money(l.precio_lista)}`;
    if (precio < l.precio_lista - 0.005) A.push(`<div class="alert warn"><b>Descuento de ${money(l.precio_lista - precio)} (${((1 - precio / l.precio_lista) * 100).toFixed(1)}%)</b>Escriba en observaciones quién lo autorizó.</div>`);
    let res = '';
    if (vTipo === 'Reserva') {
      $('v-monto-h').textContent = 'El dinero que dejó el cliente para apartar el lote.';
      res = `<dl class="sum"><dt>Lote</dt><dd>${esc(l.codigo)}</dd><dt>Precio acordado</dt><dd>${money(precio)}</dd><dt>Reserva</dt><dd><b>${money(monto)}</b></dd><dt>Estado</dt><dd>Reservado (sin contrato)</dd></dl>`;
    } else if (vTipo === 'Crédito') {
      const min = Math.ceil(precio * Calc.PRIMA_MIN * 100) / 100; $('v-monto-h').textContent = `Mínimo 5%: ${money(min)}`;
      if (monto + 0.005 < min) A.push(`<div class="alert bad"><b>Prima debajo del 5%</b>Faltan ${money(min - monto)}.</div>`);
      const fin = precio - monto, cuota = Calc.cuotaTabla(fin, n);
      res = `<dl class="sum"><dt>Saldo a financiar</dt><dd>${money(fin)}</dd><dt>Cuota según la tabla</dt><dd><b>${money(cuota)}</b> × ${n}</dd><dt>Primera cuota</dt><dd>${fd($('v-f1').value)}</dd></dl>`;
    } else {
      $('v-monto-h').textContent = monto < precio ? `Queda pendiente ${money(precio - monto)}` : 'Pagado completo';
      res = `<dl class="sum"><dt>Precio</dt><dd>${money(precio)}</dd><dt>Recibido</dt><dd>${money(monto)}</dd><dt>Estado</dt><dd>${monto >= precio - 0.01 ? 'Pagado' : 'Activo (saldo pendiente)'}</dd></dl>`;
    }
    $('v-alerts').innerHTML = A.join(''); $('v-resumen').innerHTML = res;
  }
  $('f-venta').addEventListener('submit', async e => {
    e.preventDefault();
    const l = lote($('v-lote').value); if (!l) return;
    const precio = num($('v-precio').value), monto = num($('v-monto').value), n = +$('v-plazo').value;
    const reserva = vTipo === 'Reserva';
    if (!(precio > 0)) return toast('Escriba el precio.');
    if (reserva && !(monto > 0)) return toast('Escriba el monto de la reserva.');
    if (vCli === 'nuevo' && !$('c-nombre').value.trim()) return toast('Escriba el nombre del cliente.');
    $('v-guardar').disabled = true;
    try {
      let clienteId = +$('v-cliente').value;
      if (vCli === 'nuevo') {
        const { data, error } = await sb.from('clientes').insert({ nombre: $('c-nombre').value.trim(), dui: $('c-dui').value.trim() || null, telefono: $('c-tel').value.trim() || null }).select('id').single();
        if (error) throw error; clienteId = data.id;
      }
      const cred = vTipo === 'Crédito';
      const venta = reserva
        ? { contrato: `RES-${l.codigo.replace('-', '')}-${Date.now().toString(36).toUpperCase()}`, fecha: $('v-fecha').value, lote: l.codigo, cliente_id: clienteId, tipo: 'Crédito', estado: 'Reservado',
            precio_pactado: Math.abs(precio - l.precio_lista) > 0.005 ? precio : null, plazo: null, cuota_pactada: null, fecha_primera_cuota: null, observaciones: $('v-obs').value.trim() || 'Reserva sin contrato' }
        : { contrato: $('v-contrato').value.trim() || `SN-${l.codigo.replace('-', '')}`, fecha: $('v-fecha').value, lote: l.codigo, cliente_id: clienteId, tipo: vTipo,
            estado: cred ? 'Activo' : (monto >= precio - 0.01 ? 'Pagado' : 'Activo'), precio_pactado: Math.abs(precio - l.precio_lista) > 0.005 ? precio : null,
            plazo: cred ? n : null, cuota_pactada: cred ? Calc.cuotaTabla(precio - monto, n) : null, fecha_primera_cuota: cred ? $('v-f1').value : null, observaciones: $('v-obs').value.trim() || null };
      const { data: vrow, error: e2 } = await sb.from('ventas').insert(venta).select('id').single();
      if (e2) throw e2;
      if (monto > 0) {
        const { error: e3 } = await sb.from('pagos').insert({ fecha: $('v-fecha').value, venta_id: vrow.id, tipo: reserva ? 'Reserva' : cred ? 'Prima' : 'Pago de contado', monto, forma: $('v-forma').value, recibo: $('v-recibo').value.trim() || null });
        if (e3) throw e3;
      }
      toast(reserva ? 'Reserva guardada' : 'Venta guardada');
      ['c-nombre', 'c-dui', 'c-tel', 'v-contrato', 'v-recibo', 'v-obs', 'v-precio'].forEach(id => $(id).value = '');
      await cargar(); verContrato(vrow.id);
    } catch (err) {
      const m = err.message || String(err);
      toast(m.includes('ventas_un_lote_vigente') ? 'Ese lote ya tiene una venta o reserva registrada.' : m.includes('ventas_contrato_key') ? 'Ese número de contrato ya existe.' : 'No se pudo guardar: ' + m);
    } finally { $('v-guardar').disabled = false; }
  });

  // ---------- usuarios
  async function pintarUsuarios() {
    const { data, error } = await sb.from('perfiles').select('*').order('creado');
    if (error) return;
    $('t-usuarios').innerHTML = `<thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>También cobra cuotas</th></tr></thead><tbody>` + data.map(p =>
      `<tr><td>${esc(p.nombre)}</td><td>${esc(p.correo)}</td><td><select data-rol="${p.id}" ${p.id === S.user.id ? 'disabled' : ''}>${['admin', 'ventas', 'cobros', 'pendiente'].map(r => `<option${p.rol === r ? ' selected' : ''}>${r}</option>`).join('')}</select></td><td>${p.rol === 'ventas' ? `<label class="inl" style="text-transform:none;font-size:.9rem"><input type="checkbox" data-cobra="${p.id}" style="width:auto;min-height:0;margin-right:6px"${p.puede_cobrar ? ' checked' : ''}>Sí</label>` : '<span class="muted">—</span>'}</td></tr>`).join('') + `</tbody>`;
    document.querySelectorAll('[data-rol]').forEach(s => s.addEventListener('change', async () => {
      const { error } = await sb.from('perfiles').update({ rol: s.value }).eq('id', s.dataset.rol);
      toast(error ? 'No se pudo cambiar: ' + error.message : 'Rol actualizado');
      if (!error) pintarUsuarios();
    }));
    document.querySelectorAll('[data-cobra]').forEach(c => c.addEventListener('change', async () => {
      const { error } = await sb.from('perfiles').update({ puede_cobrar: c.checked }).eq('id', c.dataset.cobra);
      toast(error ? 'No se pudo cambiar: ' + error.message : c.checked ? 'Ahora también puede cobrar cuotas' : 'Ya no cobra cuotas');
    }));
  }
})();
