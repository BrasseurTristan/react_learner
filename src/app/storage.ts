/** Sauvegarde locale de la progression (navigateur uniquement, aucune donnée envoyée). */

export interface LevelProgress {
  code?: string
  completed?: boolean
  hintsShown?: number
  solutionShown?: boolean
  attempts?: number
  /** Meilleur nombre de vies restantes à la victoire (sert aux étoiles). */
  bestLives?: number
  lessonSeen?: boolean
}

export interface SaveData {
  currentLevel?: string
  levels: Record<string, LevelProgress>
}

const KEY = 'react-learner:save:v1'

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const data = JSON.parse(raw) as SaveData
      if (data && typeof data === 'object' && data.levels) return data
    }
  } catch {
    /* stockage indisponible : on repart de zéro */
  }
  return { levels: {} }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    /* ignoré */
  }
}

export function resetSave(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignoré */
  }
}
