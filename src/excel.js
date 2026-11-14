// Exporta las ventas a Excel (.xlsx) sin librerías externas: hojas Resumen, Contado y Crédito.
(function () {
  // ---- zip sin compresión
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) {
    const enc = new TextEncoder(), partes = [], central = []; let off = 0;
    const u16 = v => [v & 255, (v >>> 8) & 255], u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
    files.forEach(([name, txt]) => {
      const nb = enc.encode(name), data = enc.encode(txt), crc = crc32(data);
      const head = [...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nb.length), ...u16(0)];
      partes.push(new Uint8Array(head), nb, data);
      central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nb.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nb);
      off += head.length + nb.length + data.length;
    });
    const tam = central.reduce((s, p) => s + p.length, 0);
    return new Blob([...partes, ...central, new Uint8Array([...u32(0x06054b50), 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(tam), ...u32(off), 0, 0])], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  // ---- hojas
  const x = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const col = n => { let s = ''; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; };
  const serial = iso => { if (!iso) return null; const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000; };
  // estilos: 0 normal, 1 encabezado, 2 dinero, 3 fecha, 4 total texto, 5 total dinero, 6 entero, 7 título, 8 total entero
  const ST = { txt: 0, head: 1, money: 2, date: 3, totTxt: 4, totMoney: 5, int: 6, title: 7, totInt: 8 };
  function celda(ref, v, s) {
    if (v && typeof v === 'object' && v.f) return `<c r="${ref}" s="${s}"><f>${x(v.f)}</f></c>`;
    if (v == null || v === '' || (typeof v === 'number' && !isFinite(v))) return s ? `<c r="${ref}" s="${s}"/>` : '';
    if (typeof v === 'number') return `<c r="${ref}" s="${s}"><v>${v}</v></c>`;
    return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${x(v)}</t></is></c>`;
  }
  // filas: [[{v, s}...]]; opts: {anchos, filtro: 'A1:J5', congelar: fila}
  function hojaXML(filas, opts) {
    const rows = filas.map((f, r) => `<row r="${r + 1}">${f.map((c, i) => c ? celda(col(i) + (r + 1), c.v, c.s || 0) : '').join('')}</row>`).join('');
    const pane = opts.congelar ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${opts.congelar}" topLeftCell="A${opts.congelar + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : '';
    const cols = opts.anchos ? `<cols>${opts.anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${pane}${cols}<sheetData>${rows}</sheetData>${opts.filtro ? `<autoFilter ref="${opts.filtro}"/>` : ''}</worksheet>`;
  }
  const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="13"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2F5D46"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE3ECE5"/></patternFill></fill></fills>
<borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="9"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf numFmtId="164" applyNumberFormat="1"/><xf numFmtId="165" applyNumberFormat="1"/>
<xf fontId="2" fillId="3" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="2" fillId="3" applyNumberFormat="1" applyFont="1" applyFill="1"/><xf numFmtId="1" applyNumberFormat="1"/><xf fontId="2" applyFont="1"/><xf numFmtId="1" fontId="2" fillId="3" applyNumberFormat="1" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

  function libro(hojas) {
    const n = hojas.length;
    return zip([
      ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
      ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
      ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${hojas.map((h, i) => `<sheet name="${x(h.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`],
      ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      ['xl/styles.xml', ESTILOS],
      ...hojas.map((h, i) => [`xl/worksheets/sheet${i + 1}.xml`, hojaXML(h.filas, h)]),
    ]);
  }

  // tabla con encabezado, datos y fila de totales (SUMA)
  function tabla(nombre, columnas, datos) {
    const head = columnas.map(c => ({ v: c.t, s: ST.head }));
    const filas = datos.map(d => columnas.map((c, i) => ({ v: c.tipo === 'date' ? serial(d[i]) : d[i], s: ST[c.tipo] || 0 })));
    const n = datos.length, ult = n + 1;
    const tot = columnas.map((c, i) => i === 0 ? { v: 'TOTAL', s: ST.totTxt } : c.suma && n ? { v: { f: `SUM(${col(i)}2:${col(i)}${ult})` }, s: ST.totMoney } : { v: '', s: ST.totTxt });
    return { nombre, filas: [head, ...filas, tot], anchos: columnas.map(c => c.w), congelar: 1, filtro: `A1:${col(columnas.length - 1)}${Math.max(2, ult)}` };
  }

  window.exportarVentasExcel = async function ({ con, cre }, desde, hasta) {
    const f = s => s ? s.split('-').reverse().join('/') : '';
    const periodo = desde || hasta ? `Ventas del ${desde ? f(desde) : 'inicio'} al ${hasta ? f(hasta) : 'día de hoy'}` : 'Todas las ventas';
    const desc = r => r.lista != null && r.precio != null ? Math.max(0, Math.round((r.lista - r.precio) * 100) / 100) : null;

    const C = [{ t: 'Fecha', tipo: 'date', w: 12 }, { t: 'Lote', w: 7 }, { t: 'Cliente', w: 44 }, { t: 'Contrato', w: 14 }, { t: 'Precio de lista', tipo: 'money', w: 15, suma: 1 }, { t: 'Precio', tipo: 'money', w: 15, suma: 1 }, { t: 'Descuento', tipo: 'money', w: 13, suma: 1 }, { t: 'Pagado', tipo: 'money', w: 15, suma: 1 }, { t: 'Saldo', tipo: 'money', w: 13, suma: 1 }, { t: 'Estado', w: 12 }];
    const hCon = tabla('Contado', C, con.map(r => [r.v.fecha, r.v.lote, r.cl?.nombre || '', r.v.contrato || '', r.lista, r.precio, desc(r), r.pagado, r.saldo, r.c.situacion || '']));

    const K = [{ t: 'Fecha', tipo: 'date', w: 12 }, { t: 'Lote', w: 7 }, { t: 'Cliente', w: 44 }, { t: 'Contrato', w: 14 }, { t: 'Precio de lista', tipo: 'money', w: 15, suma: 1 }, { t: 'Precio', tipo: 'money', w: 15, suma: 1 }, { t: 'Descuento', tipo: 'money', w: 13, suma: 1 }, { t: 'Prima', tipo: 'money', w: 13, suma: 1 }, { t: 'Financiado', tipo: 'money', w: 15, suma: 1 }, { t: 'Cuota', tipo: 'money', w: 12, suma: 1 }, { t: 'Plazo (meses)', tipo: 'int', w: 9 }, { t: 'Primera cuota', tipo: 'date', w: 13 }, { t: 'Pagado', tipo: 'money', w: 15, suma: 1 }, { t: 'Intereses pagados', tipo: 'money', w: 15, suma: 1 }, { t: 'Saldo', tipo: 'money', w: 15, suma: 1 }, { t: 'Situación', w: 20 }, { t: 'Próximo pago', tipo: 'date', w: 13 }];
    const hCre = tabla('Crédito', K, cre.map(r => [r.v.fecha, r.v.lote, r.cl?.nombre || '', r.v.contrato || '', r.lista, r.precio, desc(r), r.prima, r.financiado, r.cuota, r.plazo, r.v.fecha_primera_cuota, r.pagado, r.interes, r.saldo, r.c.situacion || '', r.c.proximo]));

    // Resumen con fórmulas que leen las otras hojas
    const nC = con.length + 2, nK = cre.length + 2;
    const H = (t) => ({ v: t, s: ST.head });
    const res = [
      [{ v: `${(window.LOTIF && window.LOTIF.nombre) || 'Lotificación'} · Resumen de ventas`, s: ST.title }], [{ v: periodo }], [],
      [H('Tipo'), H('Lotes'), H('Total vendido'), H('Cobrado'), H('Intereses cobrados'), H('Por cobrar')],
      [{ v: 'Contado' }, { v: con.length, s: ST.int }, { v: { f: `Contado!F${nC}` }, s: ST.money }, { v: { f: `Contado!H${nC}` }, s: ST.money }, { v: 0, s: ST.money }, { v: { f: `Contado!I${nC}` }, s: ST.money }],
      [{ v: 'Crédito' }, { v: cre.length, s: ST.int }, { v: { f: `'Crédito'!F${nK}` }, s: ST.money }, { v: { f: `'Crédito'!M${nK}` }, s: ST.money }, { v: { f: `'Crédito'!N${nK}` }, s: ST.money }, { v: { f: `'Crédito'!O${nK}` }, s: ST.money }],
      [{ v: 'TOTAL', s: ST.totTxt }, { v: { f: 'SUM(B5:B6)' }, s: ST.totInt }, ...['C', 'D', 'E', 'F'].map(c => ({ v: { f: `SUM(${c}5:${c}6)` }, s: ST.totMoney }))],
    ];
    if (!con.length) res[4].splice(2, 4, { v: 0, s: ST.money }, { v: 0, s: ST.money }, { v: 0, s: ST.money }, { v: 0, s: ST.money });
    if (!cre.length) res[5].splice(2, 4, { v: 0, s: ST.money }, { v: 0, s: ST.money }, { v: 0, s: ST.money }, { v: 0, s: ST.money });
    const hRes = { nombre: 'Resumen', filas: res, anchos: [16, 8, 17, 17, 19, 17] };

    const blob = libro([hRes, hCon, hCre]);
    const hoy = new Date(), stamp = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Ventas ${((window.LOTIF && window.LOTIF.nombre_corto) || 'lotificación').replace(/[\\/:*?"<>|]/g, '')} ${stamp}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
})();
