import type { GameConfig, GameSnapshot, GameStats, TowerState } from '../engine/types'

/** Tout ce qu'un objectif peut inspecter pour décider s'il est rempli. */
export interface CheckContext {
  /** Code source brut du joueur. */
  code: string
  /** Code source sans commentaires ni chaînes de caractères (pour les analyses par regex). */
  codeNoComments: string
  stats: GameStats
  snapshot: GameSnapshot
  /** Tours actuellement actives sur le plateau. */
  towers: TowerState[]
  victory: boolean
  /** Nombre d'erreurs TypeScript (0 si le code est correct). */
  tsErrors: number
  /** Nombre de rendus (commits) du composant racine du joueur depuis le dernier lancement. */
  renderCount: number
}

export interface Objective {
  id: string
  /** Libellé affiché au joueur, en français. */
  label: string
  check: (ctx: CheckContext) => boolean
}

export interface LevelDefinition {
  /** Identifiant stable, par ex. "01-jsx". Sert de clé de sauvegarde. */
  id: string
  number: number
  title: string
  /** Concept React/TS enseigné, en quelques mots (affiché en badge). */
  concept: string
  /** Une phrase d'accroche pour la sélection des niveaux. */
  summary: string
  /** Leçon théorique en Markdown, affichée avant de jouer. */
  lesson: string
  /** Mission du niveau en Markdown (court). */
  mission: string
  starterCode: string
  solution: string
  /** Trois indices, du plus vague au plus précis. */
  hints: [string, string, string]
  /**
   * Objectifs spécifiques au niveau. Les objectifs « Repousser toutes les vagues »
   * et « Aucune erreur TypeScript » sont ajoutés automatiquement.
   */
  objectives: Objective[]
  game: GameConfig
}
