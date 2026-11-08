import { describe, expect, it } from 'vitest'
import { simulateLevel } from '../testing/simulate'
import { typecheckUserCode } from '../testing/typecheck'
import { LEVELS } from './index'

/**
 * Filet de sécurité principal du projet : chaque niveau doit être gagnable avec sa solution
 * (sans erreur TypeScript) et ne doit PAS être gagné avec son code de départ.
 */
describe.each(LEVELS.map((l) => [l.id, l] as const))('niveau %s', (_id, level) => {
  it('a des métadonnées cohérentes', () => {
    expect(level.hints).toHaveLength(3)
    expect(level.lesson.length).toBeGreaterThan(200)
    expect(level.objectives.length).toBeGreaterThan(0)
    const ids = level.objectives.map((o) => o.id)
    expect(new Set(ids).size).toBe(ids.length)
    const slotIds = level.game.map.slots.map((s) => s.id)
    expect(new Set(slotIds).size).toBe(slotIds.length)
  })

  it('la solution compile sans erreur TypeScript', () => {
    expect(typecheckUserCode(level.solution)).toEqual([])
  })

  it('la solution remplit tous les objectifs', async () => {
    const result = await simulateLevel(level, level.solution)
    expect(result.compileError).toBeUndefined()
    expect(result.renderError).toBeUndefined()
    const failed = result.objectives.filter((o) => !o.pass).map((o) => o.label)
    expect(failed).toEqual([])
    expect(result.victory).toBe(true)
  })

  it('le code de départ ne réussit pas le niveau', async () => {
    const tsErrors = typecheckUserCode(level.starterCode).length
    const result = await simulateLevel(level, level.starterCode, { tsErrors })
    expect(result.allPassed).toBe(false)
  })

  it('le code de départ ne plante pas', async () => {
    const result = await simulateLevel(level, level.starterCode)
    expect(result.compileError).toBeUndefined()
    expect(result.renderError).toBeUndefined()
  })
})

describe('ordre des niveaux', () => {
  it('numéros consécutifs et ids uniques', () => {
    LEVELS.forEach((l, i) => expect(l.number).toBe(i + 1))
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length)
  })
})
