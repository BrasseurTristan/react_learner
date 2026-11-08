import { animate, stagger } from 'animejs'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { LevelDefinition } from '../../levels/types'
import { prefersReducedMotion } from '../anim'

/** Carton d'introduction animé affiché sur le plateau au chargement d'un niveau. */
export function LevelIntro({ level, onDone }: { level: LevelDefinition; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduced = prefersReducedMotion()
    const hold = reduced ? 1600 : 2300
    if (!reduced) {
      animate(el.querySelectorAll('.intro-line'), {
        opacity: { from: 0, to: 1 },
        translateY: { from: 22, to: 0 },
        filter: { from: 'blur(6px)', to: 'blur(0px)' },
        delay: stagger(110, { start: 150 }),
        duration: 700,
        ease: 'outExpo',
      })
      animate(el.querySelector('.intro-rule')!, { scaleX: { from: 0, to: 1 }, duration: 900, delay: 300, ease: 'outExpo' })
    }
    const t = setTimeout(() => {
      if (reduced) return done.current()
      animate(el, { opacity: { to: 0 }, translateY: { to: -12 }, duration: 450, ease: 'inQuad', onComplete: () => done.current() })
    }, hold)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="level-intro" ref={ref} aria-live="polite">
      <div className="intro-line intro-kicker">Niveau {level.number}</div>
      <div className="intro-line intro-title">{level.title}</div>
      <div className="intro-rule" />
      <div className="intro-line intro-concept">{level.concept}</div>
    </div>
  )
}

interface TourStep {
  target: string
  title: string
  body: string
  place: 'right' | 'left' | 'top' | 'bottom'
}

const STEPS: TourStep[] = [
  {
    target: '[data-tour="editor"]',
    title: '✍️ Ton éditeur',
    body: 'Tu écris ici ton composant React en TypeScript. Il est compilé et exécuté automatiquement à chaque modification (ou avec Ctrl/⌘ + S).',
    place: 'right',
  },
  {
    target: '[data-tour="board"]',
    title: '🏰 Le plateau',
    body: 'Chaque <Tower /> renvoyée par ton composant construit une vraie tour. Clique sur « Lancer la défense » quand tu es prêt. Fais glisser pour tourner la caméra.',
    place: 'left',
  },
  {
    target: '[data-tour="user"]',
    title: '🎛️ Ton composant',
    body: 'Tout le JSX qui n’est pas une tour (boutons, textes, listes…) s’affiche ici. C’est ton interface de commande.',
    place: 'top',
  },
  {
    target: '[data-tour="objectives"]',
    title: '🎯 Les objectifs',
    body: 'Pour réussir un niveau, il faut repousser les vagues ET utiliser le concept React enseigné. Les objectifs se cochent en direct.',
    place: 'top',
  },
]

/** Visite guidée de la première visite : met en lumière chaque zone de l'interface. */
export function WelcomeTour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const card = useRef<HTMLDivElement>(null)
  const next = useRef<HTMLButtonElement>(null)
  const current = STEPS[step]

  const measure = useCallback(() => {
    const el = document.querySelector(current.target)
    if (!el) return setRect(null)
    el.scrollIntoView({ block: 'nearest' })
    setRect(el.getBoundingClientRect())
  }, [current.target])

  useLayoutEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  useEffect(() => {
    next.current?.focus()
    if (card.current && !prefersReducedMotion())
      animate(card.current, { opacity: { from: 0, to: 1 }, translateY: { from: 10, to: 0 }, duration: 380, ease: 'outExpo' })
  }, [step])

  const go = (n: number) => (n >= STEPS.length ? onClose() : setStep(n))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(step + 1)
      else if (e.key === 'ArrowLeft' && step > 0) go(step - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Position de la bulle à côté de la zone ciblée, bornée à l'écran.
  const pad = 8
  const W = 320
  let style: React.CSSProperties = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
  let place = current.place
  if (rect) {
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (place === 'right' && rect.right + W + 24 > vw) place = 'top'
    if (place === 'left' && rect.left - W - 24 < 0) place = 'top'
    const clampX = (x: number) => Math.max(12, Math.min(vw - W - 12, x))
    if (place === 'right') style = { left: rect.right + 16, top: Math.max(12, Math.min(vh - 220, rect.top + rect.height / 2 - 90)) }
    else if (place === 'left') style = { left: rect.left - W - 16, top: Math.max(12, Math.min(vh - 220, rect.top + rect.height / 2 - 90)) }
    else if (place === 'top') {
      const top = rect.top - 16
      style = top > 200 ? { left: clampX(rect.left + rect.width / 2 - W / 2), top, transform: 'translateY(-100%)' } : { left: clampX(rect.left + rect.width / 2 - W / 2), top: Math.min(vh - 200, rect.bottom + 16) }
    } else style = { left: clampX(rect.left + rect.width / 2 - W / 2), top: rect.bottom + 16 }
  }

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect ? (
        <div
          className="tour-spot"
          style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
        />
      ) : (
        <div className="tour-dim" />
      )}
      <div className="tour-card" style={{ ...style, width: W }}>
        <div ref={card}>
        <div className="tour-step">
          Étape {step + 1} sur {STEPS.length}
        </div>
        <h3 id="tour-title">{current.title}</h3>
        <p>{current.body}</p>
        <div className="tour-dots" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={i === step ? 'on' : ''} />
          ))}
        </div>
        <div className="tour-actions">
          <button className="btn ghost small" onClick={onClose}>
            Passer
          </button>
          <div className="tour-nav">
            {step > 0 && (
              <button className="btn soft small" onClick={() => go(step - 1)}>
                ← Retour
              </button>
            )}
            <button ref={next} className="btn primary small" onClick={() => go(step + 1)}>
              {step === STEPS.length - 1 ? 'C’est compris !' : 'Suivant →'}
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
