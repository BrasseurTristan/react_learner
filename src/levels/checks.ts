import type { CheckContext, LevelDefinition, Objective } from './types'

/**
 * Retire les commentaires pour que les regex d'analyse ne se fassent pas
 * piéger par du code commenté (les chaînes sont conservées).
 */
export function stripComments(code: string): string {
  let out = ''
  let i = 0
  while (i < code.length) {
    const c = code[i]
    const n = code[i + 1]
    if (c === '/' && n === '/') {
      while (i < code.length && code[i] !== '\n') i++
    } else if (c === '/' && n === '*') {
      i += 2
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++
      i += 2
    } else {
      out += c
      i++
    }
  }
  return out
}

/** Vrai si le motif apparaît dans le code (hors commentaires). */
export function has(ctx: CheckContext, pattern: RegExp): boolean {
  return pattern.test(ctx.codeNoComments)
}

export function count(ctx: CheckContext, pattern: RegExp): number {
  const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'
  return (ctx.codeNoComments.match(new RegExp(pattern.source, flags)) ?? []).length
}

/** Objectifs ajoutés automatiquement à chaque niveau. */
export const VICTORY_OBJECTIVE: Objective = {
  id: 'victory',
  label: 'Repousser toutes les vagues',
  check: (ctx) => ctx.victory,
}

export const TYPESCRIPT_OBJECTIVE: Objective = {
  id: 'typescript',
  label: 'Aucune erreur TypeScript',
  check: (ctx) => ctx.tsErrors === 0,
}

export function allObjectives(level: LevelDefinition): Objective[] {
  return [...level.objectives, TYPESCRIPT_OBJECTIVE, VICTORY_OBJECTIVE]
}
