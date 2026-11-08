import { useEffect, useRef, useSyncExternalStore } from 'react'
import { ENEMIES, SPELLS } from '../../engine/balance'
import type { GameEngine } from '../../engine/engine'
import type { EnemyKind } from '../../engine/types'
import { bannerIn, pop, shake } from '../anim'

const ENEMY_ICONS: Record<EnemyKind, string> = { grunt: '👺', runner: '💨', tank: '🛡️', flyer: '🦇', boss: '👑' }

interface Props {
  engine: GameEngine
  speed: number
  paused: boolean
  onSpeed: (s: number) => void
  onPause: (p: boolean) => void
  onStart: () => void
  onRestart: () => void
}

export function Hud({ engine, speed, paused, onSpeed, onPause, onStart, onRestart }: Props) {
  const snap = useSyncExternalStore(engine.subscribe, engine.getSnapshot)
  const goldRef = useRef<HTMLDivElement>(null)
  const livesRef = useRef<HTMLDivElement>(null)
  const bannerRef = useRef<HTMLDivElement>(null)
  const prev = useRef({ gold: snap.gold, lives: snap.lives, wave: snap.wave })

  useEffect(() => {
    if (snap.gold > prev.current.gold) pop(goldRef.current)
    if (snap.lives < prev.current.lives) shake(livesRef.current)
    if (snap.wave !== prev.current.wave && snap.phase === 'wave') bannerIn(bannerRef.current)
    prev.current = { gold: snap.gold, lives: snap.lives, wave: snap.wave }
  }, [snap.gold, snap.lives, snap.wave, snap.phase])

  const lifeRatio = snap.lives / snap.maxLives
  const running = snap.phase === 'wave' || snap.phase === 'break'
  return (
    <>
      <div className="hud-top">
        <div className="hud-stat gold" ref={goldRef} title="Or disponible (banque − coût des tours actives)">
          <span className="hud-icon">🪙</span>
          <span className="hud-value">{snap.gold}</span>
        </div>
        <div className={`hud-stat lives${lifeRatio <= 0.34 ? ' danger' : ''}`} ref={livesRef} title="Vies de ta base">
          <span className="hud-icon">❤️</span>
          <span className="hud-value">
            {snap.lives}
            <small>/{snap.maxLives}</small>
          </span>
        </div>
        <div className="hud-stat wave" title="Vague">
          <span className="hud-icon">🌊</span>
          <span className="hud-value">
            {snap.wave}
            <small>/{snap.totalWaves}</small>
          </span>
        </div>
        {snap.nextWave && snap.phase !== 'wave' && (
          <div className="hud-next" title="Composition de la prochaine vague">
            <span className="hud-next-label">Prochaine vague</span>
            {snap.nextWave.kinds.map((k) => (
              <span key={k} className="enemy-chip" title={ENEMIES[k].label}>
                {ENEMY_ICONS[k]}
              </span>
            ))}
            <span className="hud-next-count">×{snap.nextWave.count}</span>
          </div>
        )}
      </div>

      {snap.spells.length > 0 && (
        <div className="hud-spells">
          {snap.spells.map((s) => (
            <div key={s.name} className={`spell-chip${s.ready ? ' ready' : ''}`} title={`Sort ${SPELLS[s.name].label} — castSpell('${s.name}')`}>
              {s.name === 'freeze' ? '❄️' : '☄️'} <span>{s.ready ? 'prêt' : `${s.cooldown.toFixed(0)} s`}</span>
            </div>
          ))}
        </div>
      )}

      <div className="wave-banner" ref={bannerRef}>
        Vague {snap.wave}
      </div>

      <div className="hud-bottom">
        {snap.phase === 'build' && (
          <button className="btn primary big pulse" onClick={onStart}>
            ⚔️ Lancer la défense
          </button>
        )}
        {running && (
          <div className="speed-group" role="group" aria-label="Vitesse">
            <button className={`btn ghost${paused ? ' active' : ''}`} onClick={() => onPause(!paused)} title="Pause">
              {paused ? '▶' : '⏸'}
            </button>
            {[1, 2, 4].map((s) => (
              <button key={s} className={`btn ghost${speed === s && !paused ? ' active' : ''}`} onClick={() => onSpeed(s)}>
                ×{s}
              </button>
            ))}
          </div>
        )}
        {snap.phase !== 'build' && (
          <button className="btn ghost" onClick={onRestart} title="Remettre la partie à zéro">
            ↻ Recommencer
          </button>
        )}
      </div>
    </>
  )
}
