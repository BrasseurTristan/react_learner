import type { LevelDefinition } from './types'

/**
 * Registre des niveaux, découvert automatiquement : tout fichier `levelNN.ts`
 * qui exporte un `LevelDefinition` est ajouté, trié par `number`.
 * Ajouter un niveau = créer le fichier, rien d'autre à modifier.
 */
const modules = import.meta.glob<Record<string, unknown>>('./level[0-9][0-9].ts', { eager: true })

function isLevel(value: unknown): value is LevelDefinition {
  return !!value && typeof value === 'object' && 'id' in value && 'starterCode' in value && 'game' in value
}

export const LEVELS: LevelDefinition[] = Object.values(modules)
  .flatMap((m) => Object.values(m).filter(isLevel))
  .sort((a, b) => a.number - b.number)

export function getLevel(id: string): LevelDefinition | undefined {
  return LEVELS.find((l) => l.id === id)
}
