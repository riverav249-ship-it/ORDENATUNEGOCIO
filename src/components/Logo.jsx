export default function Logo({ pequeno = false }) {
  return (
    <div className={pequeno ? 'logo logo-sm' : 'logo'}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="10" y="8" width="44" height="52" rx="6" fill="#fff" stroke="#1b2b4b" strokeWidth="4" />
        <rect x="24" y="4" width="16" height="9" rx="3" fill="#f2c94c" stroke="#1b2b4b" strokeWidth="3" />
        <path d="M20 36l8 8 16-18" fill="none" stroke="#1f9d55" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>Ordena<br />tu Negocio</span>
    </div>
  )
}
