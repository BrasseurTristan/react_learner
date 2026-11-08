/** Types partagés par le moteur, le module `game` exposé au joueur et le rendu 3D. */

export type TowerKind = 'archer' | 'cannon' | 'mage' | 'frost'
export type EnemyKind = 'grunt' | 'runner' | 'tank' | 'flyer' | 'boss'
export type TargetMode = 'first' | 'strongest' | 'closest'
export type SpellName = 'freeze' | 'meteor'
export type Element = 'neutral' | 'fire' | 'ice' | 'storm'
export type Phase = 'build' | 'wave' | 'break' | 'victory' | 'defeat'

export interface Vec2 {
  x: number
  z: number
}

export interface SlotDef {
  id: string
  x: number
  z: number
  /** Une hauteur donne +20 % de portée. */
  high?: boolean
}

export interface MapDef {
  /** Dimensions du plateau en cases (x : largeur, z : profondeur). */
  width: number
  depth: number
  /** Points de passage des ennemis, du portail jusqu'à la base. */
  path: Vec2[]
  slots: SlotDef[]
  /** Décor purement visuel. */
  decor?: { kind: 'tree' | 'rock' | 'crystal'; x: number; z: number }[]
}

export interface WaveGroup {
  kind: EnemyKind
  count: number
  /** Secondes entre deux apparitions. */
  interval: number
  /** Délai avant le premier ennemi du groupe, en secondes depuis le début de la vague. */
  delay?: number
  /** Multiplicateur de points de vie (défaut 1). */
  hpScale?: number
}

export interface WaveDef {
  groups: WaveGroup[]
}

export interface GameConfig {
  map: MapDef
  waves: WaveDef[]
  startGold: number
  lives: number
  /** Types de tours autorisés dans ce niveau (défaut : tous). */
  allowedTowers?: TowerKind[]
  /** Sorts disponibles (défaut : aucun). */
  spells?: SpellName[]
  /** Pause entre deux vagues, en secondes (défaut 3). */
  breakTime?: number
}

export interface TowerProps {
  slot: string
  kind: TowerKind
  level?: number
  target?: TargetMode
  element?: Element
}

export type TowerStatus = 'active' | 'unpaid' | 'invalid' | 'conflict'

export interface TowerState {
  id: string
  slot: string
  kind: TowerKind
  level: number
  target: TargetMode
  element: Element
  status: TowerStatus
  /** Raison lisible quand la tour est inactive. */
  reason?: string
  cooldown: number
  /** Angle de visée (radians) pour le rendu. */
  aim: number
  /** Horodatage du dernier tir (secondes de jeu), pour l'animation de recul. */
  lastShot: number
  x: number
  z: number
  range: number
  cost: number
  order: number
}

export interface EnemyState {
  id: number
  kind: EnemyKind
  hp: number
  maxHp: number
  speed: number
  /** Distance parcourue le long du chemin. */
  progress: number
  x: number
  z: number
  flying: boolean
  armored: boolean
  slowUntil: number
  burnUntil: number
  reward: number
}

export interface Projectile {
  id: number
  kind: TowerKind
  element: Element
  fromX: number
  fromZ: number
  toX: number
  toZ: number
  born: number
  ttl: number
}

export interface Effect {
  id: number
  type: 'explosion' | 'freeze' | 'meteor' | 'death' | 'leak' | 'spawn'
  x: number
  z: number
  born: number
  ttl: number
}

/** Vue simplifiée d'un ennemi, exposée au joueur via `useGame()`. */
export interface EnemyInfo {
  id: number
  kind: EnemyKind
  hp: number
  maxHp: number
  flying: boolean
  armored: boolean
  /** Progression de 0 (portail) à 1 (base). */
  progress: number
}

export interface SlotInfo {
  id: string
  high: boolean
  /** Vrai si une tour active occupe déjà ce slot. */
  occupied: boolean
}

export interface WavePreview {
  number: number
  count: number
  kinds: EnemyKind[]
  hasFlying: boolean
  hasArmored: boolean
}

export interface SpellInfo {
  name: SpellName
  ready: boolean
  /** Secondes restantes avant de pouvoir relancer. */
  cooldown: number
}

/** Instantané immuable de la partie, renvoyé par `useGame()`. */
export interface GameSnapshot {
  phase: Phase
  gold: number
  lives: number
  maxLives: number
  wave: number
  totalWaves: number
  time: number
  slots: SlotInfo[]
  enemies: EnemyInfo[]
  nextWave: WavePreview | null
  spells: SpellInfo[]
  towerCount: number
  kills: number
}

export type GameEventName =
  | 'waveStart'
  | 'waveEnd'
  | 'enemySpawn'
  | 'enemyKilled'
  | 'enemyLeaked'
  | 'victory'
  | 'defeat'

export interface GameEventPayload {
  wave: number
  enemy?: EnemyInfo
}

export type LogLevel = 'info' | 'warn' | 'error' | 'success'

export interface LogEntry {
  id: number
  level: LogLevel
  message: string
  time: number
}

/** Statistiques cumulées, utilisées par les objectifs des niveaux. */
export interface GameStats {
  maxActiveTowers: number
  towerKindsUsed: TowerKind[]
  maxTowerLevel: number
  elementsUsed: Element[]
  targetModesUsed: TargetMode[]
  spellsCast: Record<SpellName, number>
  spellsFailed: number
  kills: number
  leaks: number
  wavesCleared: number
  /** Nombre maximal d'abonnements actifs simultanés, tous événements confondus. */
  maxSubscriptions: number
  activeSubscriptions: number
  totalSubscriptions: number
  goldSpentPeak: number
  invalidTowerAttempts: number
  conflicts: number
}
