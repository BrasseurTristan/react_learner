import { animate, stagger } from 'animejs'
import { useEffect, useRef, useState } from 'react'
import type { LevelDefinition } from '../../levels/types'
import { prefersReducedMotion } from '../anim'
import type { LevelProgress } from '../storage'
import { starsFor } from './Dialogs'

interface Props {
  levels: LevelDefinition[]
  progress: Record<string, LevelProgress>
  playerName: string
  onName: (name: string) => void
  onClose: () => void
}

/** Écran de fin de parcours : certificat récapitulatif animé. */
export function Certificate({ levels, progress, playerName, onName, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [name, setName] = useState(playerName)
  const stars = levels.map((l) => {
    const p = progress[l.id]
    return p?.completed && p.bestLives !== undefined ? starsFor(p.bestLives, l.game.lives) : p?.completed ? 1 : 0
  })
  const totalStars = stars.reduce((a, b) => a + b, 0)
  const attempts = levels.reduce((n, l) => n + (progress[l.id]?.attempts ?? 0), 0)
  const withoutSolution = levels.filter((l) => progress[l.id]?.completed && !progress[l.id]?.solutionShown).length
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const prev = document.activeElement as HTMLElement | null
    root.querySelector<HTMLElement>('.cert-close')?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    if (!prefersReducedMotion()) {
      animate(root.querySelector('.cert')!, {
        opacity: { from: 0, to: 1 },
        scale: { from: 0.88, to: 1 },
        rotateX: { from: 18, to: 0 },
        duration: 900,
        ease: 'outExpo',
      })
      animate(root.querySelectorAll('.cert-reveal'), {
        opacity: { from: 0, to: 1 },
        translateY: { from: 14, to: 0 },
        delay: stagger(90, { start: 350 }),
        duration: 600,
        ease: 'outExpo',
      })
      animate(root.querySelectorAll('.cert-concept'), {
        opacity: { from: 0, to: 1 },
        scale: { from: 0.7, to: 1 },
        delay: stagger(45, { start: 900 }),
        duration: 500,
        ease: 'outBack',
      })
      animate(root.querySelector('.cert-seal')!, {
        scale: { from: 0, to: 1 },
        rotate: { from: -200, to: -12 },
        delay: 1300,
        duration: 1100,
        ease: 'outElastic(1, .55)',
      })
      root.querySelectorAll<HTMLElement>('.confetti').forEach((el) => {
        animate(el, {
          translateX: { from: 0, to: (Math.random() - 0.5) * 900 },
          translateY: { from: 0, to: 300 + Math.random() * 500 },
          rotate: { from: 0, to: (Math.random() - 0.5) * 1440 },
          opacity: [1, 1, 0],
          duration: 2400 + Math.random() * 1600,
          delay: 400 + Math.random() * 900,
          ease: 'outCubic',
        })
      })
    }
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.({ preventScroll: true })
    }
  }, [onClose])

  const colors = ['#61dafb', '#a78bfa', '#f472b6', '#facc15', '#4ade80', '#fb923c']
  return (
    <div className="cert-backdrop" ref={ref} role="dialog" aria-modal="true" aria-labelledby="cert-title">
      {Array.from({ length: 70 }, (_, i) => (
        <span key={i} className="confetti" style={{ background: colors[i % colors.length], left: `${50 + (i % 2 ? 1 : -1) * (i % 9) * 1.5}%`, top: '18%' }} />
      ))}
      <div className="cert">
        <div className="cert-border" aria-hidden />
        <div className="cert-seal" aria-hidden>
          <span>⚛</span>
        </div>
        <div className="cert-reveal cert-kicker">ReactLearner · Parcours terminé</div>
        <h2 id="cert-title" className="cert-reveal">
          Certificat de Défenseur React
        </h2>
        <p className="cert-reveal cert-lead">Ce certificat est décerné à</p>
        <input
          className="cert-reveal cert-name"
          value={name}
          maxLength={40}
          placeholder="Ton prénom"
          aria-label="Ton prénom"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => onName(name.trim())}
        />
        <p className="cert-reveal cert-lead">
          pour avoir défendu sa base sur les {levels.length} niveaux en maîtrisant les concepts suivants :
        </p>
        <ul className="cert-concepts">
          {levels.map((l, i) => (
            <li key={l.id} className="cert-concept" title={l.title}>
              <span className="cert-concept-num">{l.number}</span>
              {l.concept}
              <span className="cert-concept-stars" aria-label={`${stars[i]} étoile(s)`}>
                {'★'.repeat(stars[i])}
                <i>{'★'.repeat(3 - stars[i])}</i>
              </span>
            </li>
          ))}
        </ul>
        <div className="cert-stats cert-reveal">
          <div>
            <b>
              {totalStars}
              <small>/{levels.length * 3}</small>
            </b>
            <span>étoiles</span>
          </div>
          <div>
            <b>{attempts}</b>
            <span>défenses lancées</span>
          </div>
          <div>
            <b>
              {withoutSolution}
              <small>/{levels.length}</small>
            </b>
            <span>niveaux sans la solution</span>
          </div>
        </div>
        <div className="cert-footer cert-reveal">
          <span className="muted">Délivré le {date}</span>
          <div className="cert-actions">
            <button className="btn ghost" onClick={() => window.print()}>
              🖨️ Imprimer
            </button>
            <button className="btn primary cert-close" onClick={onClose}>
              Continuer à jouer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
