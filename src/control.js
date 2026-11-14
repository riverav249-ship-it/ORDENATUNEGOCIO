// Descarga el libro completo "Control de venta de lotes" con los datos de la app.
// Toma la plantilla (el mismo Excel, guardado por el administrador) y escribe en ella
// lotes, clientes, ventas y pagos; las fórmulas del libro calculan todo al abrirlo.
(function (root) {
  const HOJAS = { lotes: 'xl/worksheets/sheet5.xml', clientes: 'xl/worksheets/sheet6.xml', ventas: 'xl/worksheets/sheet7.xml', pagos: 'xl/worksheets/sheet8.xml' };
  const COLS = {
    lotes: { desde: 5, hasta: 399, cols: ['A', 'B', 'C', 'D', 'E', 'G', 'H', 'M', 'N'] },
    clientes: { desde: 5, hasta: 404, cols: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'J'] },
    ventas: { desde: 6, hasta: 405, cols: ['A', 'B', 'C', 'D', 'E', 'F', 'H', 'N', 'O', 'P', 'R', 'S', 'T', 'AK', 'AL', 'AQ', 'AR'] },
    pagos: { desde: 5, hasta: 3004, cols: ['A', 'B', 'C', 'E', 'F', 'G', 'I'] },
  };
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const colNum = c => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  const serial = iso => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000; };
  const n = v => v == null || v === '' ? null : Number(v);
  const t = v => v == null || v === '' ? null : String(v);
  const fecha = v => v ? { fecha: v } : null;

  function celda(ref, estilo, v) {
    const s = estilo ? ` s="${estilo}"` : '';
    if (v == null || v === '' || (typeof v === 'number' && !isFinite(v))) return `<c r="${ref}"${s}/>`;
    if (typeof v === 'object' && v.fecha) return `<c r="${ref}"${s} t="n"><v>${serial(v.fecha)}</v></c>`;
    if (typeof v === 'number') return `<c r="${ref}"${s} t="n"><v>${v}</v></c>`;
    return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  }

  // Reescribe las columnas de captura de una fila; deja intactas las celdas con fórmula.
  function editarFila(rowXml, r, cols, valores) {
    const ini = rowXml.indexOf('>') + 1, fin = rowXml.lastIndexOf('</row>');
    const abre = rowXml.endsWith('/>') ? rowXml.slice(0, -2) + '>' : rowXml.slice(0, ini);
    const cuerpo = rowXml.endsWith('/>') ? '' : rowXml.slice(ini, fin);
    const celdas = [];
    cuerpo.replace(/<c r="([A-Z]+)\d+"([^>]*?)(\/>|>[\s\S]*?<\/c>)/g, (raw, col, attrs) => { celdas.push({ col, raw, attrs }); return raw; });
    for (const col of cols) {
      const i = celdas.findIndex(c => c.col === col);
      if (i >= 0 && celdas[i].raw.includes('<f')) continue;
      const estilo = i >= 0 ? ((celdas[i].attrs.match(/ s="(\d+)"/) || [])[1] || '') : '';
      const nueva = { col, raw: celda(col + r, estilo, valores ? valores[col] : null), attrs: '' };
      if (i >= 0) celdas[i] = nueva;
      else { const j = celdas.findIndex(c => colNum(c.col) > colNum(col)); j < 0 ? celdas.push(nueva) : celdas.splice(j, 0, nueva); }
    }
    return abre + celdas.map(c => c.raw).join('') + '</row>';
  }

  function llenarHoja(xml, def, filas) {
    if (filas.length > def.hasta - def.desde + 1) throw new Error(`La plantilla solo tiene espacio para ${def.hasta - def.desde + 1} filas y hay ${filas.length}.`);
    const vistas = new Set();
    const out = xml.replace(/<row r="(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g, (raw, rs) => {
      const r = +rs;
      if (r < def.desde || r > def.hasta) return raw;
      vistas.add(r);
      return editarFila(raw, r, def.cols, filas[r - def.desde]);
    });
    for (let r = def.desde; r < def.desde + filas.length; r++) if (!vistas.has(r)) throw new Error('La plantilla no tiene la fila ' + r + '. Suba de nuevo la plantilla.');
    return out;
  }

  const porNum = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  function filasDesdeDatos({ lotes, clientes, ventas, pagos }) {
    const cli = new Map(clientes.map(c => [c.id, c]));
    const ven = new Map(ventas.map(v => [v.id, v]));
    const L = [...lotes].sort((a, b) => porNum(a.poligono, b.poligono) || (+a.numero) - (+b.numero)).map(l => ({
      A: t(l.codigo), B: t(l.poligono), C: n(l.numero), D: n(l.area_m2), E: n(l.area_v2), G: n(l.precio_lista), H: t(l.caracteristicas), M: t(l.observaciones), N: l.a_la_venta === false ? 'No' : 'Sí',
    }));
    const C = [...clientes].sort((a, b) => a.id - b.id).map(c => ({
      A: t(c.codigo), B: t(c.nombre), C: t(c.dui), D: t(c.telefono), E: t(c.direccion), F: t(c.correo), G: t(c.beneficiario), J: t(c.observaciones),
    }));
    const V = [...ventas].sort((a, b) => a.id - b.id).map(v => ({
      A: t(v.contrato), B: fecha(v.fecha), C: t(v.lote), D: t(cli.get(v.cliente_id)?.nombre), E: t(v.estado), F: t(v.tipo), H: n(v.precio_pactado),
      N: n(v.plazo), O: n(v.tasa), P: n(v.cuota_pactada), R: fecha(v.fecha_primera_cuota), S: n(v.saldo_inicial_libro), T: n(v.cuotas_antes),
      AK: t(v.vendedor), AL: n(v.comision), AQ: t(v.observaciones), AR: v.interes_por_pago ? 'Sí' : null,
    }));
    const P = [...pagos].sort((a, b) => porNum(a.fecha, b.fecha) || a.id - b.id).map(p => ({
      A: fecha(p.fecha), B: t(p.recibo), C: t(ven.get(p.venta_id)?.contrato), E: t(p.tipo), F: n(p.monto), G: t(p.forma), I: t(p.nota),
    }));
    return { lotes: L, clientes: C, ventas: V, pagos: P };
  }

  async function construirControl(JSZip, plantilla, datos) {
    const zip = await JSZip.loadAsync(plantilla);
    for (const k of Object.values(HOJAS)) if (!zip.file(k)) throw new Error('La plantilla no es el Excel de control (falta ' + k + ').');
    const filas = filasDesdeDatos(datos);
    for (const [hoja, ruta] of Object.entries(HOJAS)) {
      const xml = await zip.file(ruta).async('string');
      zip.file(ruta, llenarHoja(xml, COLS[hoja], filas[hoja]));
    }
    // que Excel recalcule todo al abrir
    let wb = await zip.file('xl/workbook.xml').async('string');
    if (!/fullCalcOnLoad=/.test(wb)) wb = wb.replace('<calcPr', '<calcPr fullCalcOnLoad="true"');
    zip.file('xl/workbook.xml', wb);
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  }

  function cargarJSZip() {
    if (root.JSZip) return Promise.resolve(root.JSZip);
    return new Promise((ok, mal) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = () => ok(root.JSZip); s.onerror = () => mal(new Error('No se pudo cargar el generador de Excel. Revise la conexión.'));
      document.head.appendChild(s);
    });
  }

  // ---------- conexión directa a Supabase con la sesión que ya abrió la aplicación
  const cfg = root.APP_CONFIG || {};
  const PLANTILLA = 'plantillas/control.xlsx';
  function sesion() {
    const ref = (cfg.SUPABASE_URL || '').replace(/^https:\/\//, '').split('.')[0];
    let s = null; try { s = JSON.parse(localStorage.getItem(`sb-${ref}-auth-token`) || 'null'); } catch (e) { s = null; }
    if (!s || !s.access_token) throw new Error('La sesión no está abierta. Vuelva a entrar.');
    if (s.expires_at && s.expires_at * 1000 < Date.now()) throw new Error('La sesión venció. Recargue la página e intente de nuevo.');
    return { apikey: cfg.SUPABASE_KEY, Authorization: `Bearer ${s.access_token}` };
  }
  async function tabla(nombre, orden) {
    const filas = [];
    for (let desde = 0; ; desde += 1000) {
      const r = await fetch(`${cfg.SUPABASE_URL}/rest/v1/${nombre}?select=*&order=${orden}`, { headers: { ...sesion(), Range: `${desde}-${desde + 999}`, 'Range-Unit': 'items' } });
      if (!r.ok) throw new Error(`No se pudieron leer los ${nombre} (${r.status}).`);
      const lote = await r.json(); filas.push(...lote);
      if (lote.length < 1000) return filas;
    }
  }
  const leerDatos = async () => {
    const [lotes, clientes, ventas, pagos] = await Promise.all([tabla('lotes', 'poligono,numero'), tabla('clientes', 'id'), tabla('ventas', 'id'), tabla('pagos', 'fecha,id')]);
    return { lotes, clientes, ventas, pagos };
  };
  function aviso(msg) { const t = document.getElementById('toast'); if (!t) return alert(msg); t.textContent = msg; t.hidden = false; clearTimeout(aviso.t); aviso.t = setTimeout(() => t.hidden = true, 3500); }
  async function estadoPlantilla() {
    const el = document.getElementById('plantilla-estado'); if (!el) return;
    try {
      const r = await fetch(`${cfg.SUPABASE_URL}/storage/v1/object/list/plantillas`, { method: 'POST', headers: { ...sesion(), 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix: '', search: 'control.xlsx', limit: 10 }) });
      const lista = r.ok ? await r.json() : [];
      const f = lista.find(x => x.name === 'control.xlsx');
      const fd = s => s ? String(s).slice(0, 10).split('-').reverse().join('/') : '';
      el.textContent = f ? `Plantilla guardada el ${fd(f.updated_at || f.created_at)}.` : 'Todavía no hay plantilla: suba el archivo Plantilla_Control_San_Marcos.xlsx.';
    } catch (e) { el.textContent = ''; }
  }
  function elegirArchivo() {
    return new Promise(ok => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      inp.style.display = 'none'; document.body.appendChild(inp);
      inp.addEventListener('change', () => { const f = inp.files[0] || null; inp.remove(); ok(f); });
      inp.click();
    });
  }
  async function subirPlantilla(f) {
    if (!/\.xlsx$/i.test(f.name)) throw new Error('La plantilla debe ser un archivo .xlsx.');
    const JSZip = await cargarJSZip(), zip = await JSZip.loadAsync(await f.arrayBuffer());
    if (Object.values(HOJAS).some(k => !zip.file(k))) throw new Error('Ese archivo no es el Excel de control.');
    const r = await fetch(`${cfg.SUPABASE_URL}/storage/v1/object/${PLANTILLA}`, { method: 'POST', headers: { ...sesion(), 'x-upsert': 'true', 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, body: f });
    if (!r.ok) { let m = ''; try { m = (await r.json()).message || ''; } catch (e) {} throw new Error(`No se pudo guardar la plantilla (${r.status}) ${m}`); }
  }
  function enlazar() {
    const bDesc = document.getElementById('vt-control'), bSubir = document.getElementById('plantilla-subir');
    if (bDesc) bDesc.addEventListener('click', async () => {
      bDesc.disabled = true; const txt = bDesc.textContent; bDesc.textContent = 'Preparando…';
      try {
        let r = await fetch(`${cfg.SUPABASE_URL}/storage/v1/object/${PLANTILLA}`, { headers: sesion() });
        if (r.status === 400 || r.status === 404) {
          // primera vez: pedir el archivo de plantilla, guardarlo y seguir
          aviso('Primera vez: elija el archivo Plantilla_Control_San_Marcos.xlsx');
          const f = await elegirArchivo();
          if (!f) throw new Error('No se eligió la plantilla.');
          await subirPlantilla(f);
          r = await fetch(`${cfg.SUPABASE_URL}/storage/v1/object/${PLANTILLA}`, { headers: sesion() });
        }
        if (!r.ok) throw new Error(`No se pudo leer la plantilla (${r.status}).`);
        const plantilla = await r.arrayBuffer();
        await root.exportarControlExcel(plantilla, await leerDatos());
      } catch (e) { aviso(e.message || 'No se pudo descargar.'); }
      finally { bDesc.disabled = false; bDesc.textContent = txt; }
    });
    if (bSubir) bSubir.addEventListener('click', async () => {
      const inp = document.getElementById('plantilla-file'), f = inp && inp.files[0];
      if (!f) return aviso('Elija primero el archivo .xlsx.');
      bSubir.disabled = true; bSubir.textContent = 'Subiendo…';
      try { await subirPlantilla(f); inp.value = ''; aviso('Plantilla guardada.'); estadoPlantilla(); }
      catch (e) { aviso(e.message); }
      finally { bSubir.disabled = false; bSubir.textContent = 'Subir plantilla'; }
    });
    const tab = document.querySelector('[data-tab="usuarios"]');
    if (tab) tab.addEventListener('click', estadoPlantilla);
  }
  if (typeof document !== 'undefined') { document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', enlazar) : enlazar(); }

  root.exportarControlExcel = async function (plantilla, datos) {
    const JSZip = await cargarJSZip();
    const bytes = await construirControl(JSZip, plantilla, datos);
    const hoy = new Date(), stamp = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Control_Lotes_San_Marcos ${stamp}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  root.ControlExcel = { construirControl, filasDesdeDatos, llenarHoja };
})(typeof window !== 'undefined' ? window : globalThis);
