import { Component, Profiler, type ReactNode, act } from 'react'
import { createRoot } from 'react-dom/client'
import { GameEngine } from '../engine/engine'
import type { LevelDefinition, PlaytestApi } from '../levels/types'
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

function makePlaytestApi(container: HTMLElement, engine: GameEngine, memory: Record<string, unknown>): PlaytestApi {
  return {
    container,
    phase: engine.phase,
    snapshot: engine.getSnapshot(),
    time: engine.time,
    memory,
    click(textOrSelector) {
      let el: HTMLElement | null = null
      try {
        el = container.querySelector<HTMLElement>(textOrSelector)
      } catch {
        /* pas un sélecteur CSS valide : on cherche par texte */
      }
      if (!el)
        el = [...container.querySelectorAll<HTMLElement>('button, [role="button"]')].find((b) =>
          (b.textContent ?? '').includes(textOrSelector),
        ) ?? null
      if (!el || (el as HTMLButtonElement).disabled) return false
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      return true
    },
    setValue(selector, value) {
      const el = container.querySelector<HTMLInputElement | HTMLSelectElement>(selector)
      if (!el) return false
      const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value)
      el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
      return true
    },
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
  const memory: Record<string, unknown> = {}
  const playtest = async () => {
    if (!level.playtest || renderError) return
    await act(async () => {
      level.playtest!(makePlaytestApi(container, engine, memory))
    })
  }
  await playtest()
  if (!renderError) {
    engine.startWave()
    let elapsed = 0
    while (!engine.isOver && elapsed < maxSeconds && !renderError) {
      await act(async () => {
        for (let i = 0; i < 10 && !engine.isOver; i++) engine.tick(dt)
      })
      elapsed += dt * 10
      await playtest()
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
