import { type ComponentType, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CodeEditor, type Diagnostic } from '../editor/CodeEditor'
import { GameEngine } from '../engine/engine'
import { Board3D } from '../game/Board3D'
import { useEngineLoop } from '../game/useEngineLoop'
import { UserRuntime } from '../game/UserRuntime'
import type { LevelDefinition } from '../levels/types'
import { compileUserCode } from '../runtime/compile'
import { buildCheckContext, evaluateObjectives, type ObjectiveResult } from '../runtime/evaluate'
import { enterStagger } from './anim'
import { HintsModal, LessonModal, ResultOverlay, SolutionModal, starsFor } from './components/Dialogs'
import { Hud } from './components/Hud'
import { LogPanel, ObjectivesPanel } from './components/SidePanels'
import { Markdown } from './Markdown'
import type { LevelProgress } from './storage'

interface Props {
  level: LevelDefinition
  progress: LevelProgress
  onProgress: (patch: LevelProgress) => void
  hasNext: boolean
  onNext: () => void
  onOpenLevels: () => void
}

type Overlay = 'victory' | 'partial' | 'defeat' | null
type Dialog = 'lesson' | 'hints' | 'solution' | null

const AUTO_RUN_DELAY = 600

export function LevelSession({ level, progress, onProgress, hasNext, onNext }: Props) {
  const [engine] = useState(() => new GameEngine(level.game))
  const [code, setCode] = useState(progress.code ?? level.starterCode)
  const [compiled, setCompiled] = useState<{ Component: ComponentType | null; runKey: number; error?: string }>({
    Component: null,
    runKey: 0,
  })
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([])
  const [speed, setSpeed] = useState(1)
  const [paused, setPaused] = useState(false)
  const [results, setResults] = useState<ObjectiveResult[]>(() =>
    evaluateObjectives(level, buildCheckContext(engine, code, 0, 0)),
  )
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [dialog, setDialog] = useState<Dialog>(progress.lessonSeen ? null : 'lesson')
  const [sideTab, setSideTab] = useState<'objectives' | 'log'>('objectives')
  const [leftWidth, setLeftWidth] = useState(44)
  const renderCount = useRef(0)
  const missionRef = useRef<HTMLDivElement>(null)

  useEngineLoop(engine, speed, paused)

  // Animation d'entrée du niveau
  useEffect(() => {
    if (missionRef.current) enterStagger(missionRef.current.querySelectorAll('.stagger'), 70)
  }, [])

  // ── Compilation / exécution du code ──
  const run = useCallback(
    (source: string) => {
      const result = compileUserCode(source, engine)
      setRuntimeError(null)
      renderCount.current = 0
      if (result.ok) setCompiled((c) => ({ Component: result.Component, runKey: c.runKey + 1 }))
      else setCompiled((c) => ({ Component: c.Component, runKey: c.runKey, error: result.error }))
    },
    [engine],
  )

  useEffect(() => {
    const t = setTimeout(() => run(code), compiled.runKey === 0 ? 0 : AUTO_RUN_DELAY)
    return () => clearTimeout(t)
  }, [code, run])

  // Sauvegarde du code (légèrement différée)
  useEffect(() => {
    const t = setTimeout(() => onProgress({ code }), 400)
    return () => clearTimeout(t)
  }, [code])

  // ── Évaluation continue des objectifs ──
  const latest = useRef({ code, tsErrors: diagnostics.length })
  latest.current = { code, tsErrors: diagnostics.length }
  const signature = useRef('')
  const prevPhase = useRef(engine.phase)

  const evaluate = useCallback(() => {
    const ctx = buildCheckContext(engine, latest.current.code, latest.current.tsErrors, renderCount.current)
    const next = evaluateObjectives(level, ctx)
    const sig = next.map((r) => (r.pass ? '1' : '0')).join('')
    if (sig !== signature.current) {
      signature.current = sig
      setResults(next)
    }
    const phase = engine.phase
    if (phase !== prevPhase.current) {
      prevPhase.current = phase
      if (phase === 'victory') {
        const allPass = next.every((r) => r.pass)
        setOverlay(allPass ? 'victory' : 'partial')
        if (allPass)
          onProgress({
            completed: true,
            bestLives: Math.max(progress.bestLives ?? 0, engine.lives),
          })
      } else if (phase === 'defeat') setOverlay('defeat')
    }
    return next
  }, [engine, level, onProgress, progress.bestLives])

  useEffect(() => engine.subscribe(evaluate), [engine, evaluate])
  useEffect(() => {
    evaluate()
  }, [code, diagnostics, evaluate])

  // Callbacks stables : UserRuntime est mémoïsé et ne doit pas se ré-afficher à chaque rendu de la session.
  const onUserError = useCallback(
    (m: string) => {
      setRuntimeError(m)
      engine.log('error', `Ton composant a planté : ${m}`)
    },
    [engine],
  )
  const onUserRender = useCallback(() => {
    renderCount.current++
  }, [])

  // ── Actions ──
  const start = () => {
    setOverlay(null)
    setPaused(false)
    engine.startWave()
    onProgress({ attempts: (progress.attempts ?? 0) + 1 })
  }
  const restart = () => {
    setOverlay(null)
    engine.reset()
    // Remonte le composant du joueur pour repartir d'un état React propre.
    run(latest.current.code)
  }

  const hintsShown = progress.hintsShown ?? 0
  const solutionUnlocked = hintsShown >= level.hints.length || (progress.attempts ?? 0) >= 3 || !!progress.completed
  const stars = starsFor(engine.lives, level.game.lives)
  const missing = results.filter((r) => !r.pass && r.id !== 'victory').map((r) => r.label)

  const errorView = useMemo(() => {
    if (compiled.error) return { title: 'Erreur de compilation', items: [compiled.error] }
    if (runtimeError) return null // affichée dans le panneau du composant
    if (diagnostics.length)
      return {
        title: `${diagnostics.length} erreur${diagnostics.length > 1 ? 's' : ''} TypeScript`,
        items: diagnostics.slice(0, 4).map((d) => `Ligne ${d.line} : ${d.message}`),
      }
    return null
  }, [compiled.error, runtimeError, diagnostics])

  // ── Séparateur redimensionnable ──
  const onDragStart = (e: React.PointerEvent) => {
    e.preventDefault()
    const move = (ev: PointerEvent) => setLeftWidth(Math.min(65, Math.max(28, (ev.clientX / window.innerWidth) * 100)))
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.classList.remove('resizing')
    }
    document.body.classList.add('resizing')
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <main className="workspace" style={{ gridTemplateColumns: `${leftWidth}% 6px 1fr` }}>
      {/* ───────── Colonne gauche : mission + éditeur ───────── */}
      <section className="left">
        <div className="mission card" ref={missionRef}>
          <div className="mission-head stagger">
            <span className="badge glow">{level.concept}</span>
            <h1>
              <span className="mission-num">#{level.number}</span> {level.title}
            </h1>
          </div>
          <div className="stagger">
            <Markdown source={level.mission} className="mission-text" />
          </div>
          <div className="mission-actions stagger">
            <button className="btn soft" onClick={() => setDialog('lesson')}>
              📖 Leçon
            </button>
            <button className="btn soft" onClick={() => setDialog('hints')}>
              💡 Indices <small>{hintsShown}/3</small>
            </button>
            <button
              className="btn soft"
              disabled={!solutionUnlocked}
              onClick={() => {
                setDialog('solution')
                onProgress({ solutionShown: true })
              }}
              title={solutionUnlocked ? 'Voir la solution' : 'Se déverrouille après 3 indices ou 3 essais'}
            >
              {solutionUnlocked ? '✅' : '🔒'} Solution
            </button>
          </div>
        </div>

        <div className="editor card">
          <div className="editor-tabs">
            <span className="file-tab">
              <span className="dot" /> Defense.tsx
            </span>
            <div className="editor-tools">
              <button
                className="btn ghost small"
                onClick={() => {
                  if (window.confirm('Revenir au code de départ ? Ton code actuel sera perdu.')) setCode(level.starterCode)
                }}
                title="Revenir au code de départ"
              >
                ⟲ Réinitialiser
              </button>
              <button className="btn primary small" onClick={() => run(code)} title="Ctrl/⌘ + S">
                ▶ Exécuter
              </button>
            </div>
          </div>
          <div className="editor-host">
            <CodeEditor
              path={`file:///src/${level.id}/Defense.tsx`}
              value={code}
              onChange={setCode}
              onDiagnostics={setDiagnostics}
              onRun={() => run(latest.current.code)}
            />
          </div>
          <div className={`status-bar${errorView ? ' error' : ' ok'}`}>
            {errorView ? (
              <details open>
                <summary>⚠️ {errorView.title}</summary>
                <ul>
                  {errorView.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </details>
            ) : (
              <span>✓ Ton code compile. Il est exécuté automatiquement à chaque modification.</span>
            )}
          </div>
        </div>
      </section>

      <div className="splitter" onPointerDown={onDragStart} role="separator" aria-orientation="vertical" />

      {/* ───────── Colonne droite : jeu ───────── */}
      <section className="right">
        <div className="board card">
          <Board3D engine={engine} />
          <Hud
            engine={engine}
            speed={speed}
            paused={paused}
            onSpeed={(s) => {
              setSpeed(s)
              setPaused(false)
            }}
            onPause={setPaused}
            onStart={start}
            onRestart={restart}
          />
          {overlay && (
            <ResultOverlay
              kind={overlay}
              stars={stars}
              missing={missing}
              hasNext={hasNext}
              onNext={onNext}
              onReplay={restart}
              onClose={() => setOverlay(null)}
            />
          )}
        </div>

        <div className="bottom">
          <div className="user-panel card">
            <div className="panel-title">
              <span>🎛️ Ton composant</span>
              <small>ce que renvoie ton JSX (hors tours)</small>
            </div>
            <div className="user-surface">
              <UserRuntime Component={compiled.Component} runKey={compiled.runKey} onError={onUserError} onRender={onUserRender} />
            </div>
          </div>
          <div className="side card">
            <div className="tabs" role="tablist">
              <button className={sideTab === 'objectives' ? 'active' : ''} onClick={() => setSideTab('objectives')}>
                🎯 Objectifs
              </button>
              <button className={sideTab === 'log' ? 'active' : ''} onClick={() => setSideTab('log')}>
                📜 Journal
              </button>
            </div>
            <div className="tab-body">
              {sideTab === 'objectives' ? <ObjectivesPanel results={results} /> : <LogPanel engine={engine} />}
            </div>
          </div>
        </div>
      </section>

      {dialog === 'lesson' && (
        <LessonModal
          level={level}
          onClose={() => {
            setDialog(null)
            if (!progress.lessonSeen) onProgress({ lessonSeen: true })
          }}
        />
      )}
      {dialog === 'hints' && (
        <HintsModal
          level={level}
          shown={hintsShown}
          onReveal={() => onProgress({ hintsShown: Math.min(level.hints.length, hintsShown + 1) })}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'solution' && (
        <SolutionModal
          level={level}
          onClose={() => setDialog(null)}
          onApply={() => {
            setCode(level.solution)
            setDialog(null)
          }}
        />
      )}
    </main>
  )
}
