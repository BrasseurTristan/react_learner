import type { Element, EnemyKind, TowerKind } from './types'

export interface TowerStats {
  label: string
  cost: number
  range: number
  damage: number
  /** Tirs par seconde. */
  rate: number
  hitsAir: boolean
  hitsGround: boolean
  /** Ignore l'armure des ennemis blindés. */
  pierce: boolean
  splash?: number
  slow?: { factor: number; duration: number }
  description: string
  color: string
}

export const TOWERS: Record<TowerKind, TowerStats> = {
  archer: {
    label: 'Archer',
    cost: 50,
    range: 3.2,
    damage: 9,
    rate: 1.6,
    hitsAir: true,
    hitsGround: true,
    pierce: false,
    description: 'Tir rapide, touche les volants. Faible contre les blindés.',
    color: '#4ade80',
  },
  cannon: {
    label: 'Canon',
    cost: 80,
    range: 2.8,
    damage: 26,
    rate: 0.6,
    hitsAir: false,
    hitsGround: true,
    pierce: true,
    splash: 1.1,
    description: 'Dégâts de zone, perce les blindages. Ne touche pas les volants.',
    color: '#f97316',
  },
  mage: {
    label: 'Mage',
    cost: 110,
    range: 3.4,
    damage: 16,
    rate: 0.9,
    hitsAir: true,
    hitsGround: true,
    pierce: true,
    description: 'Magie qui ignore l’armure et touche tout.',
    color: '#a78bfa',
  },
  frost: {
    label: 'Givre',
    cost: 70,
    range: 2.7,
    damage: 4,
    rate: 1.1,
    hitsAir: true,
    hitsGround: true,
    pierce: false,
    slow: { factor: 0.45, duration: 1.6 },
    description: 'Ralentit fortement les ennemis touchés.',
    color: '#38bdf8',
  },
}

export interface EnemyStats {
  label: string
  hp: number
  speed: number
  reward: number
  flying: boolean
  armored: boolean
  color: string
}

export const ENEMIES: Record<EnemyKind, EnemyStats> = {
  grunt: { label: 'Gobelin', hp: 42, speed: 1.0, reward: 8, flying: false, armored: false, color: '#84cc16' },
  runner: { label: 'Éclaireur', hp: 26, speed: 2.0, reward: 8, flying: false, armored: false, color: '#facc15' },
  tank: { label: 'Golem blindé', hp: 170, speed: 0.6, reward: 20, flying: false, armored: true, color: '#94a3b8' },
  flyer: { label: 'Chauve-souris', hp: 34, speed: 1.35, reward: 12, flying: true, armored: false, color: '#f472b6' },
  boss: { label: 'Seigneur ombre', hp: 1100, speed: 0.42, reward: 120, flying: false, armored: true, color: '#ef4444' },
}

/** Réduction des dégâts non perçants contre les blindés. */
export const ARMOR_FACTOR = 0.3
export const MAX_TOWER_LEVEL = 3
export const HIGH_GROUND_RANGE_BONUS = 1.2

export const ELEMENTS: Record<Element, { label: string; color: string; damageBonus: number }> = {
  neutral: { label: 'Neutre', color: '#e2e8f0', damageBonus: 1 },
  fire: { label: 'Feu', color: '#fb7185', damageBonus: 1.1 },
  ice: { label: 'Glace', color: '#7dd3fc', damageBonus: 1.1 },
  storm: { label: 'Tempête', color: '#fde047', damageBonus: 1.1 },
}

/**
 * Affinités élémentaires : chaque ennemi a une faiblesse et une résistance.
 * Aucun élément ne domine, il faut l'adapter à la vague (cf. niveau 11).
 */
export const ELEMENT_WEAKNESS = 1.6
export const ELEMENT_RESISTANCE = 0.55
export const ENEMY_AFFINITY: Record<EnemyKind, { weak?: Element; resists?: Element }> = {
  grunt: { weak: 'fire', resists: 'storm' },
  runner: { weak: 'ice', resists: 'fire' },
  tank: { weak: 'storm', resists: 'fire' },
  flyer: { weak: 'storm', resists: 'ice' },
  boss: {},
}

export function elementMultiplier(element: Element, enemy: EnemyKind): number {
  const a = ENEMY_AFFINITY[enemy]
  if (element === a.weak) return ELEMENT_WEAKNESS
  if (element === a.resists) return ELEMENT_RESISTANCE
  return 1
}

export const SPELLS = {
  freeze: { label: 'Gel', cooldown: 12, duration: 2.5 },
  meteor: { label: 'Météore', cooldown: 18, damage: 70 },
} as const

/** Coût total d'une tour pour un niveau donné (construction + améliorations). */
export function towerCost(kind: TowerKind, level: number): number {
  const base = TOWERS[kind].cost
  const lvl = Math.max(1, Math.min(MAX_TOWER_LEVEL, Math.floor(level)))
  return base + Math.round(base * 0.7) * (lvl - 1)
}

export function towerDamage(kind: TowerKind, level: number, element: Element): number {
  const lvl = Math.max(1, Math.min(MAX_TOWER_LEVEL, Math.floor(level)))
  return TOWERS[kind].damage * (1 + 0.65 * (lvl - 1)) * ELEMENTS[element].damageBonus
}
