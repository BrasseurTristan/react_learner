import { level01 } from './level01'
import { level02 } from './level02'
import type { LevelDefinition } from './types'

/** Registre ordonné des niveaux. Ajouter un niveau = l'importer et l'ajouter ici. */
export const LEVELS: LevelDefinition[] = [level01, level02]

export function getLevel(id: string): LevelDefinition | undefined {
  return LEVELS.find((l) => l.id === id)
}
