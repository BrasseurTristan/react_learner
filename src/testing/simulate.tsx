import { Component, Profiler, type ReactNode, act } from 'react'
import { createRoot } from 'react-dom/client'
import { GameEngine } from '../engine/engine'
import type { LevelDefinition } from '../levels/types'
import { compileUserCode } from '../runtime/compile'
import { buildCheckContext, evaluateObjectives, type ObjectiveResult } from '../runtime/evaluate'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

export interface SimulationResult {
  compileError?: string
  renderError?: string
  victory: boolean
  phase: string
  objectives: ObjectiveResult[]
  allPassed: boolean
  engine: GameEngine
}

class Boundary extends Component<{ onError: (e: Error) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error) {
    this.props.onError(error)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

/**
 * Joue un niveau en accéléré, sans navigateur, avec le code donné.
 * Utilisé par les tests pour garantir que chaque solution gagne et que chaque code de départ perd.
 */
export async function simulateLevel(
  level: LevelDefinition,
  code: string,
  opts: { tsErrors?: number; maxSeconds?: number; dt?: number } = {},
): Promise<SimulationResult> {
  const engine = new GameEngine(level.game)
  const dt = opts.dt ?? 0.05
  const maxSeconds = opts.maxSeconds ?? 900
  const compiled = compileUserCode(code, engine)
  const tsErrors = opts.tsErrors ?? 0
  if (!compiled.ok) {
    const objectives = evaluateObjectives(level, buildCheckContext(engine, code, tsErrors, 0))
    return { compileError: compiled.error, victory: false, phase: engine.phase, objectives, allPassed: false, engine }
  }
  const container = document.createElement('div')
  const root = createRoot(container)
  let renderCount = 0
  let renderError: string | undefined
  const { Component: UserComponent } = compiled
  await act(async () => {
    root.render(
      <Boundary onError={(e) => (renderError = e.message)}>
        <Profiler id="user" onRender={() => renderCount++}>
          <UserComponent />
        </Profiler>
      </Boundary>,
    )
  })
  if (!renderError) {
    engine.startWave()
    let elapsed = 0
    while (!engine.isOver && elapsed < maxSeconds && !renderError) {
      await act(async () => {
        for (let i = 0; i < 20 && !engine.isOver; i++) engine.tick(dt)
      })
      elapsed += dt * 20
    }
  }
  const objectives = evaluateObjectives(level, buildCheckContext(engine, code, tsErrors, renderCount))
  await act(async () => root.unmount())
  return {
    renderError,
    victory: engine.phase === 'victory',
    phase: engine.phase,
    objectives,
    allPassed: objectives.every((o) => o.pass),
    engine,
  }
}
