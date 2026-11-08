import {
  ARMOR_FACTOR,
  ELEMENTS,
  ENEMIES,
  HIGH_GROUND_RANGE_BONUS,
  MAX_TOWER_LEVEL,
  SPELLS,
  TOWERS,
  towerCost,
  towerDamage,
  elementMultiplier,
} from './balance'
import type {
  Effect,
  Element,
  EnemyInfo,
  EnemyKind,
  EnemyState,
  GameConfig,
  GameEventName,
  GameEventPayload,
  GameSnapshot,
  GameStats,
  LogEntry,
  LogLevel,
  Phase,
  Projectile,
  SpellName,
  TargetMode,
  TowerKind,
  TowerProps,
  TowerState,
  Vec2,
  WavePreview,
} from './types'

const TOWER_KINDS: TowerKind[] = ['archer', 'cannon', 'mage', 'frost']
const TARGET_MODES: TargetMode[] = ['first', 'strongest', 'closest']
const ELEMENT_NAMES = Object.keys(ELEMENTS) as (keyof typeof ELEMENTS)[]
const NOTIFY_INTERVAL = 0.05

interface SpawnOrder {
  at: number
  kind: EnemyKind
  hpScale: number
}

type Listener = () => void
type EventHandler = (payload: GameEventPayload) => void

function emptyStats(): GameStats {
  return {
    maxActiveTowers: 0,
    towerKindsUsed: [],
    maxTowerLevel: 0,
    elementsUsed: [],
    targetModesUsed: [],
    spellsCast: { freeze: 0, meteor: 0 },
    spellsFailed: 0,
    kills: 0,
    leaks: 0,
    wavesCleared: 0,
    maxSubscriptions: 0,
    activeSubscriptions: 0,
    totalSubscriptions: 0,
    goldSpentPeak: 0,
    invalidTowerAttempts: 0,
    conflicts: 0,
  }
}

/**
 * Moteur du tower defense. Totalement indépendant de React et du rendu :
 * le temps n'avance que via `tick(dt)`, ce qui permet de le tester sans navigateur.
 *
 * Modèle économique déclaratif : l'or disponible = banque − coût des tours actives.
 * Retirer une tour (démonter le composant) la rembourse entièrement.
 */
export class GameEngine {
  readonly config: GameConfig
  private readonly segments: { from: Vec2; to: Vec2; start: number; length: number }[] = []
  readonly pathLength: number

  phase: Phase = 'build'
  time = 0
  bank = 0
  lives = 0
  /** Index (0-based) de la vague en cours ou de la prochaine vague. */
  waveIndex = 0
  private waveTime = 0
  private breakLeft = 0
  private spawnQueue: SpawnOrder[] = []
  private frozenUntil = 0
  private spellReadyAt: Record<SpellName, number> = { freeze: 0, meteor: 0 }

  readonly towers = new Map<string, TowerState>()
  enemies: EnemyState[] = []
  projectiles: Projectile[] = []
  effects: Effect[] = []
  logs: LogEntry[] = []
  logVersion = 0
  stats: GameStats = emptyStats()

  private towerOrder = 0
  private nextId = 1
  private listeners = new Set<Listener>()
  private handlers = new Map<GameEventName, Set<EventHandler>>()
  private snapshot: GameSnapshot | null = null
  private lastNotify = -Infinity
  private churn: number[] = []
  private churnWarned = false
  /** Coût payé par chaque tour active au dernier calcul : une tour déjà construite garde sa priorité. */
  private paid = new Map<string, number>()

  constructor(config: GameConfig) {
    this.config = config
    let acc = 0
    const path = config.map.path
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i]
      const to = path[i + 1]
      const length = Math.hypot(to.x - from.x, to.z - from.z)
      this.segments.push({ from, to, start: acc, length })
      acc += length
    }
    this.pathLength = acc
    this.reset()
  }

  // ───────────────────────── Cycle de vie ─────────────────────────

  /** Remet la partie à zéro en conservant les tours déclarées par le code React. */
  reset(): void {
    this.phase = 'build'
    this.time = 0
    this.bank = this.config.startGold
    this.lives = this.config.lives
    this.waveIndex = 0
    this.waveTime = 0
    this.breakLeft = 0
    this.spawnQueue = []
    this.frozenUntil = 0
    this.spellReadyAt = { freeze: 0, meteor: 0 }
    this.enemies = []
    this.projectiles = []
    this.effects = []
    const active = this.stats.activeSubscriptions
    this.stats = emptyStats()
    this.stats.activeSubscriptions = active
    this.stats.maxSubscriptions = active
    this.churn = []
    this.churnWarned = false
    this.paid.clear()
    this.resolveTowers()
    this.notify(true)
  }

  /** Lance la première vague (les suivantes s'enchaînent automatiquement). */
  startWave(): boolean {
    if (this.phase !== 'build') return false
    this.beginWave()
    return true
  }

  get isOver(): boolean {
    return this.phase === 'victory' || this.phase === 'defeat'
  }

  get gold(): number {
    return this.bank - this.spentGold()
  }

  private spentGold(): number {
    let total = 0
    for (const t of this.towers.values()) if (t.status === 'active') total += t.cost
    return total
  }

  private beginWave(): void {
    const wave = this.config.waves[this.waveIndex]
    this.phase = 'wave'
    this.waveTime = 0
    this.spawnQueue = []
    for (const g of wave.groups) {
      for (let i = 0; i < g.count; i++) {
        this.spawnQueue.push({ at: (g.delay ?? 0) + i * g.interval, kind: g.kind, hpScale: g.hpScale ?? 1 })
      }
    }
    this.spawnQueue.sort((a, b) => a.at - b.at)
    this.log('info', `🌊 Vague ${this.waveIndex + 1}/${this.config.waves.length} !`)
    this.emit('waveStart', { wave: this.waveIndex + 1 })
    this.notify(true)
  }

  // ───────────────────────── Tours (appelé par <Tower />) ─────────────────────────

  upsertTower(id: string, props: TowerProps): void {
    const existing = this.towers.get(id)
    const kind = props.kind
    const level = typeof props.level === 'number' && Number.isFinite(props.level) ? props.level : 1
    const tower: TowerState = {
      id,
      slot: String(props.slot),
      kind,
      level,
      target: props.target ?? 'first',
      element: props.element ?? 'neutral',
      status: 'active',
      cooldown: existing?.cooldown ?? 0,
      aim: existing?.aim ?? 0,
      lastShot: existing?.lastShot ?? -10,
      x: 0,
      z: 0,
      range: 0,
      cost: 0,
      order: existing?.order ?? this.towerOrder++,
    }
    this.towers.set(id, tower)
    if (!existing) this.trackChurn()
    this.resolveTowers()
    this.notify(true)
  }

  removeTower(id: string): void {
    if (!this.towers.delete(id)) return
    this.trackChurn()
    this.resolveTowers()
    this.notify(true)
  }

  private trackChurn(): void {
    this.churn.push(performance.now())
    const cutoff = performance.now() - 1000
    this.churn = this.churn.filter((t) => t > cutoff)
    if (this.churn.length > 40 && !this.churnWarned) {
      this.churnWarned = true
      this.log(
        'warn',
        'Tes tours apparaissent et disparaissent en boucle. Évite de conditionner une tour sur `gold` : construire la tour fait baisser l’or, ce qui la retire…',
      )
    }
  }

  /**
   * Recalcule le statut de chaque tour (valide, payée, conflit de slot…).
   * Les tours déjà actives dont le coût n'a pas changé passent en premier : l'or qui arrive
   * ne doit jamais démonter une tour construite au profit d'une tour impayée déclarée avant elle.
   * Les autres tours sont servies dans l'ordre de déclaration.
   */
  private resolveTowers(): void {
    const kept = (t: TowerState) =>
      TOWER_KINDS.includes(t.kind) && this.paid.get(t.id) === towerCost(t.kind, t.level) ? 0 : 1
    const sorted = [...this.towers.values()].sort((a, b) => kept(a) - kept(b) || a.order - b.order)
    const taken = new Set<string>()
    let remaining = this.bank
    let active = 0
    const allowed = this.config.allowedTowers ?? TOWER_KINDS
    for (const t of sorted) {
      const slot = this.config.map.slots.find((s) => s.id === t.slot)
      const prevStatus = t.status
      t.reason = undefined
      if (!TOWER_KINDS.includes(t.kind)) {
        t.status = 'invalid'
        t.reason = `Type de tour inconnu : "${String(t.kind)}". Types possibles : ${TOWER_KINDS.join(', ')}.`
      } else if (!allowed.includes(t.kind)) {
        t.status = 'invalid'
        t.reason = `La tour "${t.kind}" n’est pas disponible dans ce niveau (autorisées : ${allowed.join(', ')}).`
      } else if (!slot) {
        t.status = 'invalid'
        t.reason = `Le slot "${t.slot}" n’existe pas. Slots disponibles : ${this.config.map.slots.map((s) => s.id).join(', ')}.`
      } else if (!Number.isInteger(t.level) || t.level < 1 || t.level > MAX_TOWER_LEVEL) {
        t.status = 'invalid'
        t.reason = `Le niveau d’une tour doit être un entier entre 1 et ${MAX_TOWER_LEVEL} (reçu : ${t.level}).`
      } else if (!TARGET_MODES.includes(t.target)) {
        t.status = 'invalid'
        t.reason = `Mode de ciblage inconnu : "${String(t.target)}".`
      } else if (!ELEMENT_NAMES.includes(t.element)) {
        t.status = 'invalid'
        t.reason = `Élément inconnu : "${String(t.element)}".`
      } else if (taken.has(t.slot)) {
        t.status = 'conflict'
        t.reason = `Le slot "${t.slot}" est déjà occupé par une autre tour.`
      } else {
        t.cost = towerCost(t.kind, t.level)
        t.x = slot.x
        t.z = slot.z
        t.range = TOWERS[t.kind].range * (slot.high ? HIGH_GROUND_RANGE_BONUS : 1)
        if (t.cost > remaining) {
          t.status = 'unpaid'
          t.reason = `Pas assez d’or : cette tour coûte ${t.cost}, il te reste ${remaining}.`
        } else {
          t.status = 'active'
          remaining -= t.cost
          taken.add(t.slot)
          active++
          this.recordTowerStats(t)
        }
      }
      if (slot) {
        t.x = slot.x
        t.z = slot.z
      }
      if (t.status !== prevStatus || (t.status !== 'active' && t.reason)) {
        if (t.status === 'invalid' && prevStatus !== 'invalid') {
          this.stats.invalidTowerAttempts++
          this.log('error', t.reason ?? 'Tour invalide')
        } else if (t.status === 'conflict' && prevStatus !== 'conflict') {
          this.stats.conflicts++
          this.log('warn', t.reason ?? 'Conflit')
        } else if (t.status === 'unpaid' && prevStatus !== 'unpaid') {
          this.log('warn', t.reason ?? 'Pas assez d’or')
        }
      }
    }
    this.paid.clear()
    for (const t of sorted) if (t.status === 'active') this.paid.set(t.id, t.cost)
    this.stats.maxActiveTowers = Math.max(this.stats.maxActiveTowers, active)
    this.stats.goldSpentPeak = Math.max(this.stats.goldSpentPeak, this.bank - remaining)
  }

  private recordTowerStats(t: TowerState): void {
    const s = this.stats
    if (!s.towerKindsUsed.includes(t.kind)) s.towerKindsUsed = [...s.towerKindsUsed, t.kind]
    if (!s.elementsUsed.includes(t.element)) s.elementsUsed = [...s.elementsUsed, t.element]
    if (!s.targetModesUsed.includes(t.target)) s.targetModesUsed = [...s.targetModesUsed, t.target]
    s.maxTowerLevel = Math.max(s.maxTowerLevel, t.level)
  }

  // ───────────────────────── Sorts ─────────────────────────

  spellCooldown(name: SpellName): number {
    return Math.max(0, this.spellReadyAt[name] - this.time)
  }

  castSpell(name: SpellName): boolean {
    const available = this.config.spells ?? []
    if (!available.includes(name)) {
      this.stats.spellsFailed++
      this.log('error', `Le sort "${String(name)}" n’est pas disponible dans ce niveau.`)
      return false
    }
    if (this.isOver) return false
    if (this.spellCooldown(name) > 0) {
      this.stats.spellsFailed++
      this.log('warn', `Sort "${SPELLS[name].label}" en recharge (${this.spellCooldown(name).toFixed(1)} s).`)
      return false
    }
    this.spellReadyAt[name] = this.time + SPELLS[name].cooldown
    this.stats.spellsCast[name]++
    if (name === 'freeze') {
      this.frozenUntil = this.time + SPELLS.freeze.duration
      this.addEffect('freeze', 0, 0, SPELLS.freeze.duration)
      this.log('success', '❄️ Gel ! Les ennemis sont figés.')
    } else {
      for (const e of [...this.enemies]) {
        this.addEffect('meteor', e.x, e.z, 0.8)
        this.damage(e, SPELLS.meteor.damage)
      }
      this.log('success', '☄️ Pluie de météores !')
    }
    this.notify(true)
    return true
  }

  // ───────────────────────── Événements (pour useEffect) ─────────────────────────

  on(event: GameEventName, handler: EventHandler): () => void {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    // Chaque abonnement est un objet unique, même si la même fonction est réutilisée.
    const wrapped: EventHandler = (p) => handler(p)
    set.add(wrapped)
    this.stats.activeSubscriptions++
    this.stats.totalSubscriptions++
    this.stats.maxSubscriptions = Math.max(this.stats.maxSubscriptions, this.stats.activeSubscriptions)
    let done = false
    return () => {
      if (done) return
      done = true
      set.delete(wrapped)
      this.stats.activeSubscriptions--
    }
  }

  private emit(event: GameEventName, payload: GameEventPayload): void {
    const set = this.handlers.get(event)
    if (!set) return
    for (const h of [...set]) {
      try {
        h(payload)
      } catch (err) {
        this.log('error', `Erreur dans ton gestionnaire "${event}" : ${(err as Error).message}`)
      }
    }
  }

  // ───────────────────────── Boucle de jeu ─────────────────────────

  tick(dt: number): void {
    if (!(dt > 0)) return
    dt = Math.min(dt, 0.1)
    this.time += dt
    this.effects = this.effects.filter((e) => this.time - e.born < e.ttl)
    this.projectiles = this.projectiles.filter((p) => this.time - p.born < p.ttl)

    if (this.phase === 'break') {
      this.breakLeft -= dt
      if (this.breakLeft <= 0) this.beginWave()
    } else if (this.phase === 'wave') {
      this.waveTime += dt
      this.spawnDue()
      this.moveEnemies(dt)
      if (this.phase === 'wave') this.fireTowers(dt)
      this.checkWaveEnd()
    } else if (this.phase === 'build') {
      for (const t of this.towers.values()) t.aim += dt * 0.4
    }

    this.notify(false)
  }

  private spawnDue(): void {
    while (this.spawnQueue.length && this.spawnQueue[0].at <= this.waveTime) {
      const order = this.spawnQueue.shift()!
      const stats = ENEMIES[order.kind]
      const start = this.config.map.path[0]
      const hp = Math.round(stats.hp * order.hpScale)
      const enemy: EnemyState = {
        id: this.nextId++,
        kind: order.kind,
        hp,
        maxHp: hp,
        speed: stats.speed,
        progress: 0,
        x: start.x,
        z: start.z,
        flying: stats.flying,
        armored: stats.armored,
        slowUntil: 0,
        reward: stats.reward,
      }
      this.enemies.push(enemy)
      this.addEffect('spawn', start.x, start.z, 0.6)
      this.emit('enemySpawn', { wave: this.waveIndex + 1, enemy: this.enemyInfo(enemy) })
    }
  }

  private moveEnemies(dt: number): void {
    const frozen = this.time < this.frozenUntil
    const leaked: EnemyState[] = []
    for (const e of this.enemies) {
      if (frozen) continue
      const slow = this.time < e.slowUntil ? 1 - (TOWERS.frost.slow?.factor ?? 0.5) : 1
      e.progress += e.speed * slow * dt
      if (e.progress >= this.pathLength) {
        leaked.push(e)
        continue
      }
      const pos = this.positionAt(e.progress)
      e.x = pos.x
      e.z = pos.z
    }
    for (const e of leaked) {
      this.enemies = this.enemies.filter((x) => x !== e)
      const cost = e.kind === 'boss' ? 5 : 1
      this.lives = Math.max(0, this.lives - cost)
      this.stats.leaks++
      const end = this.config.map.path[this.config.map.path.length - 1]
      this.addEffect('leak', end.x, end.z, 0.8)
      this.emit('enemyLeaked', { wave: this.waveIndex + 1, enemy: this.enemyInfo(e) })
      if (this.lives <= 0 && this.phase === 'wave') {
        this.phase = 'defeat'
        this.log('error', '💥 Ta base est tombée… Corrige ton code et réessaie !')
        this.emit('defeat', { wave: this.waveIndex + 1 })
        this.notify(true)
        return
      }
    }
  }

  positionAt(distance: number): Vec2 {
    for (const s of this.segments) {
      if (distance <= s.start + s.length) {
        const t = s.length === 0 ? 0 : (distance - s.start) / s.length
        return { x: s.from.x + (s.to.x - s.from.x) * t, z: s.from.z + (s.to.z - s.from.z) * t }
      }
    }
    const last = this.config.map.path[this.config.map.path.length - 1]
    return { x: last.x, z: last.z }
  }

  private fireTowers(dt: number): void {
    for (const t of this.towers.values()) {
      if (t.status !== 'active') continue
      t.cooldown = Math.max(0, t.cooldown - dt)
      const stats = TOWERS[t.kind]
      const target = this.pickTarget(t)
      if (!target) continue
      t.aim = Math.atan2(target.x - t.x, target.z - t.z)
      if (t.cooldown > 0) continue
      t.cooldown = 1 / stats.rate
      t.lastShot = this.time
      this.projectiles.push({
        id: this.nextId++,
        kind: t.kind,
        element: t.element,
        fromX: t.x,
        fromZ: t.z,
        toX: target.x,
        toZ: target.z,
        born: this.time,
        ttl: t.kind === 'cannon' ? 0.35 : 0.22,
      })
      const dmg = towerDamage(t.kind, t.level, t.element)
      if (stats.splash) {
        this.addEffect('explosion', target.x, target.z, 0.5)
        for (const e of [...this.enemies]) {
          if (e.flying && !stats.hitsAir) continue
          if (Math.hypot(e.x - target.x, e.z - target.z) <= stats.splash) this.hit(e, dmg, stats.pierce, t.element)
        }
      } else {
        this.hit(target, dmg, stats.pierce, t.element)
        if (stats.slow) target.slowUntil = this.time + stats.slow.duration
      }
    }
  }

  private pickTarget(t: TowerState): EnemyState | null {
    const stats = TOWERS[t.kind]
    let best: EnemyState | null = null
    let bestScore = -Infinity
    for (const e of this.enemies) {
      if (e.flying ? !stats.hitsAir : !stats.hitsGround) continue
      const d = Math.hypot(e.x - t.x, e.z - t.z)
      if (d > t.range) continue
      const score = t.target === 'strongest' ? e.hp : t.target === 'closest' ? -d : e.progress
      if (score > bestScore) {
        bestScore = score
        best = e
      }
    }
    return best
  }

  private hit(e: EnemyState, dmg: number, pierce: boolean, element: Element): void {
    const elemental = dmg * elementMultiplier(element, e.kind)
    this.damage(e, e.armored && !pierce ? elemental * ARMOR_FACTOR : elemental)
  }

  private damage(e: EnemyState, dmg: number): void {
    if (e.hp <= 0) return
    e.hp -= dmg
    if (e.hp <= 0) {
      e.hp = 0
      this.enemies = this.enemies.filter((x) => x !== e)
      this.bank += e.reward
      this.stats.kills++
      this.addEffect('death', e.x, e.z, 0.6)
      this.emit('enemyKilled', { wave: this.waveIndex + 1, enemy: this.enemyInfo(e) })
      // De l'or vient d'arriver : des tours impayées peuvent devenir actives.
      if ([...this.towers.values()].some((t) => t.status === 'unpaid')) this.resolveTowers()
    }
  }

  private checkWaveEnd(): void {
    if (this.phase !== 'wave' || this.spawnQueue.length || this.enemies.length) return
    this.stats.wavesCleared++
    const cleared = this.waveIndex + 1
    this.emit('waveEnd', { wave: cleared })
    if (cleared >= this.config.waves.length) {
      this.phase = 'victory'
      this.log('success', '🏆 Toutes les vagues ont été repoussées !')
      this.emit('victory', { wave: cleared })
    } else {
      this.waveIndex++
      this.phase = 'break'
      this.breakLeft = this.config.breakTime ?? 3
      this.log('info', `Vague ${cleared} repoussée. Prochaine vague dans ${this.breakLeft} s…`)
    }
    this.notify(true)
  }

  private addEffect(type: Effect['type'], x: number, z: number, ttl: number): void {
    this.effects.push({ id: this.nextId++, type, x, z, born: this.time, ttl })
  }

  // ───────────────────────── Journal ─────────────────────────

  log(level: LogLevel, message: string): void {
    const last = this.logs[this.logs.length - 1]
    if (last && last.message === message && last.level === level) return
    this.logs = [...this.logs.slice(-99), { id: this.nextId++, level, message, time: this.time }]
    this.logVersion++
    for (const l of this.listeners) l()
  }

  clearLogs(): void {
    this.logs = []
    this.logVersion++
    for (const l of this.listeners) l()
  }

  // ───────────────────────── Store externe (useSyncExternalStore) ─────────────────────────

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): GameSnapshot => {
    if (!this.snapshot) this.snapshot = this.buildSnapshot()
    return this.snapshot
  }

  private notify(force: boolean): void {
    if (!force && this.time - this.lastNotify < NOTIFY_INTERVAL) return
    this.lastNotify = this.time
    this.snapshot = null
    for (const l of this.listeners) l()
  }

  private enemyInfo(e: EnemyState): EnemyInfo {
    return {
      id: e.id,
      kind: e.kind,
      hp: Math.ceil(e.hp),
      maxHp: e.maxHp,
      flying: e.flying,
      armored: e.armored,
      progress: Math.min(1, e.progress / this.pathLength),
    }
  }

  private wavePreview(index: number): WavePreview | null {
    const wave = this.config.waves[index]
    if (!wave) return null
    const kinds = [...new Set(wave.groups.map((g) => g.kind))]
    return {
      number: index + 1,
      count: wave.groups.reduce((n, g) => n + g.count, 0),
      kinds,
      hasFlying: kinds.some((k) => ENEMIES[k].flying),
      hasArmored: kinds.some((k) => ENEMIES[k].armored),
    }
  }

  private buildSnapshot(): GameSnapshot {
    const occupied = new Set([...this.towers.values()].filter((t) => t.status === 'active').map((t) => t.slot))
    const nextIndex = this.phase === 'build' || this.phase === 'break' ? this.waveIndex : this.waveIndex + 1
    return Object.freeze({
      phase: this.phase,
      gold: this.gold,
      lives: this.lives,
      maxLives: this.config.lives,
      wave: this.phase === 'build' ? 0 : this.waveIndex + 1,
      totalWaves: this.config.waves.length,
      time: Math.round(this.time * 10) / 10,
      slots: this.config.map.slots.map((s) => ({ id: s.id, high: !!s.high, occupied: occupied.has(s.id) })),
      enemies: this.enemies.map((e) => this.enemyInfo(e)),
      nextWave: this.wavePreview(nextIndex),
      currentWave: this.phase === 'wave' ? this.wavePreview(this.waveIndex) : null,
      spells: (this.config.spells ?? []).map((name) => ({
        name,
        ready: this.spellCooldown(name) === 0,
        cooldown: Math.ceil(this.spellCooldown(name) * 10) / 10,
      })),
      towerCount: occupied.size,
      kills: this.stats.kills,
    })
  }
}
