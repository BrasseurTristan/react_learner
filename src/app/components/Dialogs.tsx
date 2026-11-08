import { useEffect, useRef, useState } from 'react'
import type { LevelDefinition } from '../../levels/types'
import { celebrate, enterStagger } from '../anim'
import { Markdown } from '../Markdown'
import type { LevelProgress } from '../storage'
import { Modal } from './Modal'

export function LessonModal({ level, onClose }: { level: LevelDefinition; onClose: () => void }) {
  return (
    <Modal
      wide
      title={
        <>
          <span className="badge">Niveau {level.number}</span> {level.concept}
        </>
      }
      onClose={onClose}
      footer={
        <button className="btn primary" onClick={onClose}>
          C’est parti ! 🚀
        </button>
      }
    >
      <Markdown source={level.lesson} className="lesson" />
    </Modal>
  )
}

export function HintsModal({
  level,
  shown,
  onReveal,
  onClose,
}: {
  level: LevelDefinition
  shown: number
  onReveal: () => void
  onClose: () => void
}) {
  const list = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const last = list.current?.lastElementChild
    if (last) enterStagger([last])
  }, [shown])
  return (
    <Modal title="💡 Indices" onClose={onClose}>
      <ol className="hints" ref={list}>
        {level.hints.slice(0, shown).map((h, i) => (
          <li key={i}>
            <span className="hint-num">{i + 1}</span>
            <Markdown source={h} />
          </li>
        ))}
      </ol>
      {shown < level.hints.length ? (
        <button className="btn primary" onClick={onReveal}>
          Révéler l’indice {shown + 1}/{level.hints.length}
        </button>
      ) : (
        <p className="muted">Tu as vu tous les indices. Si tu bloques encore, la solution est maintenant déverrouillée.</p>
      )}
    </Modal>
  )
}

export function SolutionModal({ level, onApply, onClose }: { level: LevelDefinition; onApply: () => void; onClose: () => void }) {
  return (
    <Modal
      wide
      title="✅ Solution"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Je préfère chercher encore
          </button>
          <button className="btn primary" onClick={onApply}>
            Copier dans l’éditeur
          </button>
        </>
      }
    >
      <p className="muted">Prends le temps de comprendre chaque ligne : c’est en la réécrivant toi-même que tu apprendras le mieux.</p>
      <pre className="code-block">
        <code>{level.solution}</code>
      </pre>
    </Modal>
  )
}

export function starsFor(lives: number, maxLives: number): number {
  if (lives >= maxLives) return 3
  if (lives >= maxLives / 2) return 2
  return 1
}

export function LevelSelect({
  levels,
  progress,
  currentId,
  onPick,
  onClose,
  onResetProgress,
}: {
  levels: LevelDefinition[]
  progress: Record<string, LevelProgress>
  currentId: string
  onPick: (id: string) => void
  onClose: () => void
  onResetProgress: () => void
}) {
  const grid = useRef<HTMLDivElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  useEffect(() => {
    if (grid.current) enterStagger(grid.current.querySelectorAll('.level-card'), 40)
  }, [])
  return (
    <Modal
      wide
      title="🗺️ Choisis ton niveau"
      onClose={onClose}
      footer={
        confirmReset ? (
          <>
            <span className="muted">Effacer toute ta progression et ton code ?</span>
            <button className="btn ghost" onClick={() => setConfirmReset(false)}>
              Annuler
            </button>
            <button className="btn danger" onClick={onResetProgress}>
              Oui, tout effacer
            </button>
          </>
        ) : (
          <button className="btn ghost small" onClick={() => setConfirmReset(true)}>
            Réinitialiser la progression
          </button>
        )
      }
    >
      <div className="level-grid" ref={grid}>
        {levels.map((l, i) => {
          const p = progress[l.id] ?? {}
          const unlocked = i === 0 || !!progress[levels[i - 1].id]?.completed || !!p.completed
          const stars = p.completed && p.bestLives !== undefined ? starsFor(p.bestLives, l.game.lives) : 0
          return (
            <button
              key={l.id}
              className={`level-card${l.id === currentId ? ' current' : ''}${p.completed ? ' done' : ''}`}
              disabled={!unlocked}
              onClick={() => onPick(l.id)}
            >
              <span className="level-num">{unlocked ? l.number : '🔒'}</span>
              <span className="level-title">{l.title}</span>
              <span className="badge">{l.concept}</span>
              <span className="level-summary">{l.summary}</span>
              <span className="level-stars">
                {[1, 2, 3].map((s) => (
                  <span key={s} className={s <= stars ? 'on' : ''}>
                    ★
                  </span>
                ))}
              </span>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}

export function ResultOverlay({
  kind,
  stars,
  missing,
  hasNext,
  onNext,
  onReplay,
  onClose,
}: {
  kind: 'victory' | 'partial' | 'defeat'
  stars: number
  missing: string[]
  hasNext: boolean
  onNext: () => void
  onReplay: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    enterStagger(ref.current ? [ref.current.querySelector('.result-card')!] : [])
    if (kind === 'victory') celebrate(ref.current)
  }, [kind])
  const colors = ['#61dafb', '#a78bfa', '#f472b6', '#facc15', '#4ade80', '#fb923c']
  return (
    <div className={`result-overlay ${kind}`} ref={ref}>
      {kind === 'victory' &&
        Array.from({ length: 48 }, (_, i) => (
          <span key={i} className="confetti" style={{ background: colors[i % colors.length], left: `${50 + (i % 2 ? 1 : -1) * (i % 7)}%` }} />
        ))}
      <div className="result-card">
        {kind === 'victory' && (
          <>
            <div className="stars">
              {[1, 2, 3].map((s) => (
                <span key={s} className={`star${s <= stars ? ' on' : ''}`}>
                  ★
                </span>
              ))}
            </div>
            <h2>Niveau réussi !</h2>
            <p>Ta base a tenu et ton code remplit tous les objectifs.</p>
            <div className="result-actions">
              <button className="btn ghost" onClick={onReplay}>
                ↻ Rejouer
              </button>
              {hasNext ? (
                <button className="btn primary" onClick={onNext}>
                  Niveau suivant →
                </button>
              ) : (
                <button className="btn primary" onClick={onClose}>
                  🎓 Terminer
                </button>
              )}
            </div>
          </>
        )}
        {kind === 'partial' && (
          <>
            <h2>Vagues repoussées… mais</h2>
            <p>Il manque encore des objectifs pour valider le niveau :</p>
            <ul className="missing">
              {missing.map((m) => (
                <li key={m}>{m.replace(/`/g, '')}</li>
              ))}
            </ul>
            <div className="result-actions">
              <button className="btn ghost" onClick={onClose}>
                Modifier mon code
              </button>
              <button className="btn primary" onClick={onReplay}>
                ↻ Rejouer
              </button>
            </div>
          </>
        )}
        {kind === 'defeat' && (
          <>
            <h2>💥 La base est tombée</h2>
            <p>Regarde le journal et les objectifs, ajuste ton code puis relance.</p>
            <div className="result-actions">
              <button className="btn ghost" onClick={onClose}>
                Voir le plateau
              </button>
              <button className="btn primary" onClick={onReplay}>
                ↻ Réessayer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
