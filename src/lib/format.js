export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

export const money = (n) =>
  '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const money0 = (n) => '$' + Math.round(Number(n || 0)).toLocaleString('en-US')

export const fecha = (d) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('es-SV', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

export const fechaCorta = (d) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('es-SV', { day: 'numeric', month: 'long' }) : ''

export const hoyISO = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export const sumarMeses = (iso, m) => {
  const [y, mo, d] = iso.split('-').map(Number)
  const dt = new Date(y, mo - 1 + m, d)
  return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export const nroRecibo = (n) => String(n).padStart(4, '0')

export function calcCuota(monto, tasaAnual, meses) {
  monto = Number(monto); meses = Number(meses)
  if (monto <= 0 || meses <= 0) return 0
  const i = Number(tasaAnual) / 1200
  if (i === 0) return round2(monto / meses)
  return round2((monto * i) / (1 - Math.pow(1 + i, -meses)))
}

export function waLink(tel, texto) {
  let d = (tel || '').replace(/\D/g, '')
  if (d.length === 8) d = '503' + d
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`
}

export const abrirWhatsApp = (tel, texto) => window.open(waLink(tel, texto), '_blank', 'noopener')

export const letraBloque = (i) => {
  let s = ''
  i += 1
  while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26) }
  return s
}

export const errorTexto = (e) => {
  const m = e?.message || String(e)
  if (m.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (m.includes('Email not confirmed')) return 'Primero confirme su correo: revise su bandeja de entrada.'
  if (m.includes('User already registered')) return 'Ese correo ya tiene una cuenta. Inicie sesión.'
  if (m.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres.'
  if (m.includes('rate limit')) return 'Demasiados intentos. Espere unos minutos e intente de nuevo.'
  if (m.includes('duplicate key') && m.includes('codigo')) return 'Ya existe un lote con ese código.'
  return m
}
