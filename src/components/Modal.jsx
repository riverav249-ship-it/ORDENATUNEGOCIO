import { useEffect } from 'react'

export default function Modal({ titulo, onCerrar, children, ancho = false }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onCerrar])
  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className={'modal' + (ancho ? ' modal-ancho' : '')} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-cab">
          <h3>{titulo}</h3>
          <button className="cerrar" onClick={onCerrar} aria-label="Cerrar">×</button>
        </div>
        <div className="modal-cuerpo">{children}</div>
      </div>
    </div>
  )
}
