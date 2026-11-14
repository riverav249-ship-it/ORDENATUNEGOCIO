// Geometría del mapa, tomada del plano de distribución de lotes (coordenadas aproximadas).
(function(){
const BLOQUES = [
  { pol: 'A', quad: [[585,1200],[800,1090],[745,960],[530,1075]], filas: [[1,2,3,4],[5,6,7,8,9]], lab: [845,1118] },
  { pol: 'B', quad: [[400,1340],[565,1250],[505,1140],[320,1240]], filas: [[1,2,3],[7,6,5,4]], lab: [292,1272] },
  { pol: 'C', quad: [[175,1205],[415,1075],[372,945],[185,1045]], filas: [[1,2,3,4,5,6],[7,8,9,10]], lab: [215,1012] },
  { pol: 'D', quad: [[440,1010],[710,848],[700,682],[395,915]], filas: [[1,2,3,4,5,6],[7,8,9,10,11,12,13,14]], lab: [488,1032] },
  { pol: 'F', quad: [[200,845],[228,930],[285,905],[258,822]], filas: [[1,2]], lab: [312,878] },
  { pol: 'G', quad: [[295,815],[620,600],[598,548],[268,760]], filas: [[1,2,3,4,5,6,7,8,9,10]], lab: [335,838] },
  { pol: 'G', quad: [[690,505],[695,592],[805,585],[800,498]], filas: [[11,12]], lab: null },
  { pol: 'H', quad: [[838,300],[932,862],[1002,858],[905,298]], filas: [[1,2,3,4,5,6,7,8,9,10,11,12]], lab: [1035,560] },
];
const SITIO = [[470,1400],[380,1335],[110,1215],[130,1135],[190,1030],[205,935],[190,862],[225,795],[650,372],[700,170],[760,70],[835,72],[890,170],[905,298],[1005,858],[1085,1040],[560,1300]];
const VERDE = [[[650,372],[700,170],[760,70],[835,72],[890,170],[905,298],[835,300],[790,330],[680,400]], [[595,560],[690,505],[800,498],[785,380],[700,430],[600,520]]];

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const pts = arr => arr.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');
const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs, txt) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (txt != null) e.textContent = txt; return e; }
// dibuja el mapa; areaDe(codigo) da el área para repartir el ancho; onLote(codigo, poly) se llama por cada lote
function dibujar(svg, areaDe) {
  svg.innerHTML = '';
  svg.appendChild(el('polygon', { points: pts(SITIO), fill: 'var(--street)', stroke: 'var(--line)', 'stroke-width': 2 }));
  VERDE.forEach(v => svg.appendChild(el('polygon', { points: pts(v), fill: 'var(--green-area)' })));
  svg.appendChild(el('text', { x: 760, y: 230, class: 'maplab', 'text-anchor': 'middle' }, 'Área verde'));
  svg.appendChild(el('text', { x: 520, y: 1395, class: 'maplab', 'text-anchor': 'middle' }, 'Acceso · calle a San Isidro'));
  svg.appendChild(el('path', { d: 'M1060 100 l14 40 l-14 -10 l-14 10 z', fill: 'var(--muted)' }));
  svg.appendChild(el('text', { x: 1060, y: 165, class: 'pollab', style: 'font-size:16px' }, 'N'));
  const polys = {};
  BLOQUES.forEach(b => {
    const [s1, e1, e2, s2] = b.quad, nf = b.filas.length;
    b.filas.forEach((fila, fi) => {
      const a0 = lerp(s1, s2, fi / nf), a1 = lerp(e1, e2, fi / nf), b0 = lerp(s1, s2, (fi + 1) / nf), b1 = lerp(e1, e2, (fi + 1) / nf);
      const w = fila.map(n => areaDe(`${b.pol}-${n}`) || 200), tot = w.reduce((s, v) => s + v, 0); let acc = 0;
      fila.forEach((n, i) => {
        const t0 = acc / tot, t1 = (acc + w[i]) / tot; acc += w[i];
        const q = [lerp(a0, a1, t0), lerp(a0, a1, t1), lerp(b0, b1, t1), lerp(b0, b1, t0)];
        const code = `${b.pol}-${n}`;
        const poly = el('polygon', { points: pts(q), class: 'lot', 'data-code': code, tabindex: 0 });
        poly.appendChild(el('title', {}, code));
        const cx = q.reduce((s, p) => s + p[0], 0) / 4, cy = q.reduce((s, p) => s + p[1], 0) / 4;
        svg.appendChild(poly); svg.appendChild(el('text', { x: cx.toFixed(1), y: cy.toFixed(1), class: 'lotnum' }, String(n)));
        polys[code] = poly;
      });
    });
    if (b.lab) svg.appendChild(el('text', { x: b.lab[0], y: b.lab[1], class: 'pollab' }, b.pol));
  });
  return polys;
}
window.Mapa = { dibujar };
})();
