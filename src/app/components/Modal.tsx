import { animate } from 'animejs'
import { useEffect, useRef, type ReactNode } from 'react'
import { prefersReducedMotion } from '../anim'

interface Props {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

export function Modal({ title, onClose, children, footer, wide }: Props) {
  const card = useRef<HTMLDivElement>(null)
  const backdrop = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    // Focus dans la modale, restitué à la fermeture.
    const previous = document.activeElement as HTMLElement | null
    const focusable = card.current?.querySelector<HTMLElement>('.modal-footer .btn.primary, .modal-body button, .icon-btn')
    focusable?.focus({ preventScroll: true })
    return () => previous?.focus?.({ preventScroll: true })
  }, [])
  useEffect(() => {
    if (prefersReducedMotion()) {
      /* pas d'animation */
    } else if (backdrop.current) animate(backdrop.current, { opacity: { from: 0, to: 1 }, duration: 250, ease: 'outQuad' })
    if (card.current && !prefersReducedMotion())
      animate(card.current, {
        opacity: { from: 0, to: 1 },
        translateY: { from: 24, to: 0 },
        scale: { from: 0.96, to: 1 },
        duration: 450,
        ease: 'outExpo',
      })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="modal-backdrop" ref={backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} ref={card} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  )
}
