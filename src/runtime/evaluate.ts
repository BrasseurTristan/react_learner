import type { GameEngine } from '../engine/engine'
import { allObjectives, stripComments } from '../levels/checks'
import type { CheckContext, LevelDefinition } from '../levels/types'

export interface ObjectiveResult {
  id: string
  label: string
  pass: boolean
}

export function buildCheckContext(
  engine: GameEngine,
  code: string,
  tsErrors: number,
  renderCount: number,
): CheckContext {
  return {
    code,
    codeNoComments: stripComments(code),
    stats: engine.stats,
    snapshot: engine.getSnapshot(),
    towers: [...engine.towers.values()].filter((t) => t.status === 'active'),
    victory: engine.phase === 'victory',
    tsErrors,
    renderCount,
  }
}

export function evaluateObjectives(level: LevelDefinition, ctx: CheckContext): ObjectiveResult[] {
  return allObjectives(level).map((o) => {
    let pass = false
    try {
      pass = !!o.check(ctx)
    } catch {
      pass = false
    }
    return { id: o.id, label: o.label, pass }
  })
}
