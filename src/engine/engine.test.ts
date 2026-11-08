import { describe, expect, it, vi } from 'vitest'
import { ARMOR_FACTOR, ENEMIES, SPELLS, TOWERS, towerCost, towerDamage } from './balance'
import { GameEngine } from './engine'
import type { EnemyKind, EnemyState, GameConfig, GameEventName, MapDef } from './types'

/**
 * Carte de test : chemin rectiligne de (0, 2) à (20, 2), longueur 20.
 * A et C sont au niveau du sol, B est une hauteur (+20 % de portée).
 */
const LINE: MapDef = {
  width: 21,
  depth: 5,
  path: [
    { x: 0, z: 2 },
    { x: 20, z: 2 },
  ],
  slots: [
    { id: 'A', x: 5, z: 0 },
    { id: 'B', x: 10, z: 0, high: true },
    { id: 'C', x: 15, z: 4 },
  ],
}

/** Une vague dont le seul ennemi n'arrive jamais : la vague reste ouverte pour les tests manuels. */
const HOLD_WAVE = { groups: [{ kind: 'grunt' as const, count: 1, interval: 1, delay: 10_000 }] }

function makeEngine(over: Partial<GameConfig> = {}): GameEngine {
  return new GameEngine({
    map: LINE,
    waves: [{ groups: [{ kind: 'grunt', count: 1, interval: 1 }] }],
    startGold: 200,
    lives: 5,
    ...over,
  })
}

/** Moteur en pleine vague, sans apparition automatique : on place les ennemis à la main. */
function makeArena(over: Partial<GameConfig> = {}): GameEngine {
  const engine = makeEngine({ waves: [HOLD_WAVE], ...over })
  engine.startWave()
  return engine
}

let nextEnemyId = 10_000
/** Ajoute un ennemi immobile (vitesse 0) à la position `x` du chemin. */
function addEnemy(engine: GameEngine, kind: EnemyKind, x: number, over: Partial<EnemyState> = {}): EnemyState {
  const stats = ENEMIES[kind]
  const pos = engine.positionAt(x)
  const enemy: EnemyState = {
    id: nextEnemyId++,
    kind,
    hp: stats.hp,
    maxHp: stats.hp,
    speed: 0,
    progress: x,
    x: pos.x,
    z: pos.z,
    flying: stats.flying,
    armored: stats.armored,
    slowUntil: 0,
    reward: stats.reward,
    ...over,
  }
  engine.enemies.push(enemy)
  return enemy
}

function run(engine: GameEngine, seconds: number, dt = 0.05): void {
  for (let t = 0; t < seconds && !engine.isOver; t += dt) engine.tick(dt)
}

function statusOf(engine: GameEngine, id: string) {
  return engine.towers.get(id)?.status
}

describe('économie déclarative', () => {
  it('or disponible = banque − coût des tours actives, et retirer une tour la rembourse', () => {
    const engine = makeEngine()
    expect(engine.gold).toBe(200)
    engine.upsertTower('t1', { slot: 'A', kind: 'archer' })
    expect(statusOf(engine, 't1')).toBe('active')
    expect(engine.gold).toBe(200 - TOWERS.archer.cost)
    expect(engine.getSnapshot().gold).toBe(engine.gold)
    engine.removeTower('t1')
    expect(engine.gold).toBe(200)
    expect(engine.towers.size).toBe(0)
  })

  it('le coût d’une tour augmente avec son niveau (et la mise à jour est facturée)', () => {
    expect(towerCost('archer', 1)).toBe(50)
    expect(towerCost('archer', 2)).toBe(85)
    expect(towerCost('archer', 3)).toBe(120)
    const engine = makeEngine()
    engine.upsertTower('t1', { slot: 'A', kind: 'archer', level: 2 })
    expect(engine.gold).toBe(200 - 85)
    engine.upsertTower('t1', { slot: 'A', kind: 'archer', level: 3 })
    expect(engine.gold).toBe(200 - 120)
    engine.upsertTower('t1', { slot: 'A', kind: 'archer', level: 1 })
    expect(engine.gold).toBe(150)
  })

  it('une tour trop chère reste « unpaid » et ne coûte rien', () => {
    const engine = makeEngine({ startGold: 100 })
    engine.upsertTower('t1', { slot: 'A', kind: 'archer' })
    engine.upsertTower('t2', { slot: 'B', kind: 'cannon' })
    expect(statusOf(engine, 't1')).toBe('active')
    expect(statusOf(engine, 't2')).toBe('unpaid')
    expect(engine.towers.get('t2')?.reason).toMatch(/Pas assez d’or/)
    expect(engine.gold).toBe(50)
    expect(engine.getSnapshot().towerCount).toBe(1)
    expect(engine.logs.some((l) => l.level === 'warn' && /Pas assez/.test(l.message))).toBe(true)
  })

  it('une tour impayée s’active dès que l’or arrive (récompenses)', () => {
    const engine = makeArena({ startGold: 100, spells: ['meteor'] })
    engine.upsertTower('t1', { slot: 'A', kind: 'archer' })
    engine.upsertTower('t2', { slot: 'C', kind: 'cannon' })
    expect(statusOf(engine, 't2')).toBe('unpaid')
    // 4 gobelins tués d'un coup par le météore : +32 or → 50 + 32 ≥ 80.
    for (let i = 0; i < 4; i++) addEnemy(engine, 'grunt', 1 + i * 0.1)
    expect(engine.castSpell('meteor')).toBe(true)
    expect(engine.stats.kills).toBe(4)
    expect(statusOf(engine, 't2')).toBe('active')
    expect(engine.gold).toBe(100 + 4 * ENEMIES.grunt.reward - 50 - 80)
  })

  it('une tour impayée s’active quand une autre tour est retirée (remboursement)', () => {
    const engine = makeEngine({ startGold: 100 })
    engine.upsertTower('t1', { slot: 'A', kind: 'archer' })
    engine.upsertTower('t2', { slot: 'B', kind: 'cannon' })
    engine.removeTower('t1')
    expect(statusOf(engine, 't2')).toBe('active')
    expect(engine.gold).toBe(20)
  })

  it('une tour déjà construite n’est jamais démontée quand de l’or arrive', () => {
    // Régression : la tour impayée déclarée en premier « volait » l'or de la tour active.
    const engine = makeArena({ startGold: 100, spells: ['meteor'] })
    engine.upsertTower('mage', { slot: 'A', kind: 'mage' }) // 110 : impayée
    engine.upsertTower('archer', { slot: 'B', kind: 'archer' }) // 50 : active
    expect(statusOf(engine, 'mage')).toBe('unpaid')
    expect(statusOf(engine, 'archer')).toBe('active')
    addEnemy(engine, 'grunt', 1)
    addEnemy(engine, 'grunt', 1.1)
    engine.castSpell('meteor') // banque 116 : assez pour le mage seul, pas pour les deux
    expect(statusOf(engine, 'archer')).toBe('active')
    expect(statusOf(engine, 'mage')).toBe('unpaid')
    expect(engine.gold).toBe(66)
    // Avec assez d'or, les deux tours finissent actives.
    engine.removeTower('archer')
    expect(statusOf(engine, 'mage')).toBe('active')
  })

  it('reset() rejoue l’économie dans l’ordre de déclaration', () => {
    const engine = makeArena({ startGold: 100, spells: ['meteor'] })
    engine.upsertTower('mage', { slot: 'A', kind: 'mage' })
    engine.upsertTower('archer', { slot: 'B', kind: 'archer' })
    for (let i = 0; i < 8; i++) addEnemy(engine, 'grunt', 1 + i * 0.1)
    engine.castSpell('meteor') // banque 164 : les deux tours sont payées
    expect(statusOf(engine, 'mage')).toBe('active')
    expect(statusOf(engine, 'archer')).toBe('active')
    engine.reset()
    expect(statusOf(engine, 'mage')).toBe('unpaid')
    expect(statusOf(engine, 'archer')).toBe('active')
  })
})

describe('validation des tours', () => {
  it('deux tours sur le même slot : la seconde est en conflit', () => {
    const engine = makeEngine()
    engine.upsertTower('t1', { slot: 'A', kind: 'archer' })
    engine.upsertTower('t2', { slot: 'A', kind: 'archer' })
    expect(statusOf(engine, 't2')).toBe('conflict')
    expect(engine.towers.get('t2')?.reason).toMatch(/déjà occupé/)
    expect(engine.stats.conflicts).toBe(1)
    expect(engine.gold).toBe(150)
    engine.removeTower('t1')
    expect(statusOf(engine, 't2')).toBe('active')
  })

  it.each([
    ['type inconnu', { slot: 'A', kind: 'laser' }, /Type de tour inconnu/],
    ['slot inexistant', { slot: 'Z', kind: 'archer' }, /Le slot "Z" n’existe pas/],
    ['niveau 0', { slot: 'A', kind: 'archer', level: 0 }, /entier entre 1 et 3/],
    ['niveau 4', { slot: 'A', kind: 'archer', level: 4 }, /entier entre 1 et 3/],
    ['niveau décimal', { slot: 'A', kind: 'archer', level: 1.5 }, /entier entre 1 et 3/],
    ['ciblage inconnu', { slot: 'A', kind: 'archer', target: 'weakest' }, /Mode de ciblage inconnu/],
    ['élément inconnu', { slot: 'A', kind: 'archer', element: 'poison' }, /Élément inconnu/],
  ])('%s → tour invalide, gratuite et signalée', (_label, props, reason) => {
    const engine = makeEngine()
    engine.upsertTower('t1', props as never)
    expect(statusOf(engine, 't1')).toBe('invalid')
    expect(engine.towers.get('t1')?.reason).toMatch(reason)
    expect(engine.gold).toBe(200)
    expect(engine.stats.invalidTowerAttempts).toBe(1)
    expect(engine.logs.at(-1)).toMatchObject({ level: 'error' })
  })

  it('une tour non autorisée dans le niveau est invalide', () => {
    const engine = makeEngine({ allowedTowers: ['archer'] })
    engine.upsertTower('t1', { slot: 'A', kind: 'cannon' })
    expect(statusOf(engine, 't1')).toBe('invalid')
    expect(engine.towers.get('t1')?.reason).toMatch(/pas disponible dans ce niveau/)
  })

  it('les statistiques retiennent types, niveaux, éléments et ciblages utilisés', () => {
    const engine = makeEngine({ startGold: 1000 })
    engine.upsertTower('t1', { slot: 'A', kind: 'archer', level: 2, target: 'strongest', element: 'fire' })
    engine.upsertTower('t2', { slot: 'B', kind: 'frost' })
    expect(engine.stats.towerKindsUsed).toEqual(['archer', 'frost'])
    expect(engine.stats.maxTowerLevel).toBe(2)
    expect(engine.stats.elementsUsed).toEqual(['fire', 'neutral'])
    expect(engine.stats.targetModesUsed).toEqual(['strongest', 'first'])
    expect(engine.stats.maxActiveTowers).toBe(2)
    expect(engine.stats.goldSpentPeak).toBe(85 + 70)
  })
})

describe('combat', () => {
  it('portée : un ennemi hors de portée n’est pas visé, la hauteur donne +20 %', () => {
    // A (sol) et B (hauteur) sont à 2 cases du chemin ; l'ennemi est décalé de 3 cases en x → distance √13 ≈ 3,6.
    const ground = makeArena()
    ground.upsertTower('t', { slot: 'A', kind: 'archer' })
    expect(ground.towers.get('t')?.range).toBeCloseTo(TOWERS.archer.range)
    const g = addEnemy(ground, 'grunt', 8)
    ground.tick(0.05)
    expect(g.hp).toBe(ENEMIES.grunt.hp)

    const high = makeArena()
    high.upsertTower('t', { slot: 'B', kind: 'archer' })
    expect(high.towers.get('t')?.range).toBeCloseTo(TOWERS.archer.range * 1.2)
    const h = addEnemy(high, 'grunt', 13)
    high.tick(0.05)
    expect(h.hp).toBeCloseTo(ENEMIES.grunt.hp - TOWERS.archer.damage)
  })

  it.each([
    ['first', 12],
    ['closest', 10],
    ['strongest', 8],
  ] as const)('ciblage "%s" → vise l’ennemi en x=%i', (target, expectedX) => {
    const engine = makeArena()
    engine.upsertTower('t', { slot: 'B', kind: 'archer', target })
    const enemies = [8, 10, 12].map((x) => addEnemy(engine, 'grunt', x, { hp: x === 8 ? 300 : 100, maxHp: 300 }))
    const before = enemies.map((e) => e.hp)
    engine.tick(0.05)
    const hit = enemies.filter((e, i) => e.hp < before[i])
    expect(hit.map((e) => e.progress)).toEqual([expectedX])
  })

  it('le canon ne touche pas les volants, l’archer oui', () => {
    const engine = makeArena()
    engine.upsertTower('c', { slot: 'A', kind: 'cannon' })
    const bat = addEnemy(engine, 'flyer', 5)
    run(engine, 3)
    expect(bat.hp).toBe(ENEMIES.flyer.hp)

    const engine2 = makeArena()
    engine2.upsertTower('a', { slot: 'A', kind: 'archer' })
    const bat2 = addEnemy(engine2, 'flyer', 5)
    engine2.tick(0.05)
    expect(bat2.hp).toBeLessThan(ENEMIES.flyer.hp)
  })

  it('l’armure réduit les dégâts non perçants, le canon et le mage la percent', () => {
    for (const [kind, factor] of [
      ['archer', ARMOR_FACTOR],
      ['frost', ARMOR_FACTOR],
      ['cannon', 1],
      ['mage', 1],
    ] as const) {
      const engine = makeArena()
      engine.upsertTower('t', { slot: 'A', kind })
      const tank = addEnemy(engine, 'tank', 5)
      engine.tick(0.05)
      expect(tank.hp, kind).toBeCloseTo(ENEMIES.tank.hp - towerDamage(kind, 1, 'neutral') * factor)
    }
  })

  it('le niveau et l’élément augmentent les dégâts', () => {
    const engine = makeArena()
    engine.upsertTower('t', { slot: 'A', kind: 'archer', level: 3, element: 'fire' })
    const g = addEnemy(engine, 'grunt', 5, { hp: 500, maxHp: 500 })
    engine.tick(0.05)
    expect(g.hp).toBeCloseTo(500 - TOWERS.archer.damage * (1 + 0.65 * 2) * 1.1 * 1.6)
  })

  it('le canon fait des dégâts de zone autour de sa cible', () => {
    const engine = makeArena()
    engine.upsertTower('c', { slot: 'A', kind: 'cannon' })
    const a = addEnemy(engine, 'grunt', 5, { hp: 500, maxHp: 500 })
    const b = addEnemy(engine, 'grunt', 5.8, { hp: 500, maxHp: 500 })
    const far = addEnemy(engine, 'grunt', 7.5, { hp: 500, maxHp: 500 })
    engine.tick(0.05)
    expect(a.hp).toBeLessThan(500)
    expect(b.hp).toBeLessThan(500)
    expect(far.hp).toBe(500)
  })

  it('le givre ralentit les ennemis touchés', () => {
    const engine = makeArena()
    engine.upsertTower('f', { slot: 'A', kind: 'frost' })
    const g = addEnemy(engine, 'grunt', 5, { speed: 1 })
    engine.tick(0.05)
    expect(g.slowUntil).toBeCloseTo(engine.time + TOWERS.frost.slow!.duration)
    const before = g.progress
    engine.tick(0.1)
    expect(g.progress - before).toBeCloseTo(0.1 * (1 - TOWERS.frost.slow!.factor))

    const free = makeArena()
    const e = addEnemy(free, 'grunt', 5, { speed: 1 })
    free.tick(0.1)
    expect(e.progress - 5).toBeCloseTo(0.1)
  })

  it('tuer un ennemi rapporte sa récompense et déclenche enemyKilled', () => {
    const engine = makeArena()
    const killed = vi.fn()
    engine.on('enemyKilled', killed)
    engine.upsertTower('t', { slot: 'A', kind: 'archer' })
    addEnemy(engine, 'grunt', 5, { hp: 1 })
    engine.tick(0.05)
    expect(engine.stats.kills).toBe(1)
    expect(engine.bank).toBe(200 + ENEMIES.grunt.reward)
    expect(killed).toHaveBeenCalledWith(expect.objectContaining({ wave: 1, enemy: expect.objectContaining({ kind: 'grunt', hp: 0 }) }))
    expect(engine.enemies).toHaveLength(0)
  })

  it('les tours ne tirent pas en phase de construction', () => {
    const engine = makeEngine()
    engine.upsertTower('t', { slot: 'A', kind: 'archer' })
    const g = addEnemy(engine, 'grunt', 5)
    run(engine, 2)
    expect(g.hp).toBe(ENEMIES.grunt.hp)
    expect(engine.phase).toBe('build')
  })
})

describe('sorts', () => {
  it('météore : dégâts sur tous les ennemis, puis recharge', () => {
    const engine = makeArena({ spells: ['meteor'] })
    const a = addEnemy(engine, 'tank', 3)
    const b = addEnemy(engine, 'tank', 15)
    expect(engine.castSpell('meteor')).toBe(true)
    expect(a.hp).toBe(ENEMIES.tank.hp - SPELLS.meteor.damage)
    expect(b.hp).toBe(ENEMIES.tank.hp - SPELLS.meteor.damage)
    expect(engine.stats.spellsCast.meteor).toBe(1)
    expect(engine.castSpell('meteor')).toBe(false)
    expect(engine.stats.spellsFailed).toBe(1)
    expect(engine.getSnapshot().spells).toEqual([{ name: 'meteor', ready: false, cooldown: SPELLS.meteor.cooldown }])
    run(engine, SPELLS.meteor.cooldown + 0.1)
    expect(engine.spellCooldown('meteor')).toBe(0)
    expect(engine.castSpell('meteor')).toBe(true)
  })

  it('gel : les ennemis sont immobilisés pendant la durée du sort', () => {
    const engine = makeArena({ spells: ['freeze'] })
    const g = addEnemy(engine, 'grunt', 2, { speed: 1 })
    expect(engine.castSpell('freeze')).toBe(true)
    run(engine, SPELLS.freeze.duration - 0.2)
    expect(g.progress).toBe(2)
    run(engine, 1)
    expect(g.progress).toBeGreaterThan(2)
  })

  it('un sort absent du niveau est refusé', () => {
    const engine = makeArena({ spells: ['freeze'] })
    expect(engine.castSpell('meteor')).toBe(false)
    expect(engine.stats.spellsFailed).toBe(1)
    expect(engine.logs.at(-1)?.message).toMatch(/pas disponible/)
    expect(makeArena().castSpell('freeze')).toBe(false)
  })

  it('aucun sort une fois la partie terminée', () => {
    const engine = makeEngine({ spells: ['meteor'], lives: 1 })
    engine.startWave()
    run(engine, 60)
    expect(engine.phase).toBe('defeat')
    expect(engine.castSpell('meteor')).toBe(false)
  })
})

describe('vagues, victoire et défaite', () => {
  const TWO_WAVES: Partial<GameConfig> = {
    waves: [{ groups: [{ kind: 'grunt', count: 1, interval: 1 }] }, { groups: [{ kind: 'runner', count: 2, interval: 1 }] }],
    breakTime: 2,
  }

  it('enchaîne vague → pause → vague → victoire, avec les bons événements', () => {
    const engine = makeEngine({ ...TWO_WAVES, lives: 10 })
    const events: string[] = []
    for (const name of ['waveStart', 'waveEnd', 'enemySpawn', 'enemyLeaked', 'victory', 'defeat'] as GameEventName[]) {
      engine.on(name, (p) => events.push(`${name}:${p.wave}`))
    }
    expect(engine.getSnapshot()).toMatchObject({ phase: 'build', wave: 0, totalWaves: 2 })
    expect(engine.getSnapshot().nextWave).toMatchObject({ number: 1, count: 1, kinds: ['grunt'] })
    expect(engine.getSnapshot().currentWave).toBeNull()
    expect(engine.startWave()).toBe(true)
    expect(engine.startWave()).toBe(false)
    expect(engine.getSnapshot()).toMatchObject({ phase: 'wave', wave: 1 })
    expect(engine.getSnapshot().nextWave).toMatchObject({ number: 2, count: 2, kinds: ['runner'] })
    expect(engine.getSnapshot().currentWave).toMatchObject({ number: 1, count: 1, kinds: ['grunt'] })

    run(engine, 20.5) // le gobelin (vitesse 1) parcourt les 20 cases
    expect(engine.phase).toBe('break')
    expect(engine.lives).toBe(9)
    expect(engine.getSnapshot().wave).toBe(2)
    expect(engine.getSnapshot().currentWave).toBeNull()
    expect(engine.getSnapshot().nextWave).toMatchObject({ number: 2 })
    run(engine, 2)
    expect(engine.phase).toBe('wave')
    expect(engine.getSnapshot().currentWave).toMatchObject({ number: 2, count: 2, kinds: ['runner'], hasFlying: false })
    expect(engine.getSnapshot().nextWave).toBeNull()
    run(engine, 30)
    expect(engine.phase).toBe('victory')
    expect(engine.isOver).toBe(true)
    expect(engine.lives).toBe(7)
    expect(engine.stats).toMatchObject({ wavesCleared: 2, leaks: 3 })
    expect(engine.getSnapshot().nextWave).toBeNull()
    expect(engine.getSnapshot().currentWave).toBeNull()
    expect(events).toEqual([
      'waveStart:1',
      'enemySpawn:1',
      'enemyLeaked:1',
      'waveEnd:1',
      'waveStart:2',
      'enemySpawn:2',
      'enemySpawn:2',
      'enemyLeaked:2',
      'enemyLeaked:2',
      'waveEnd:2',
      'victory:2',
    ])
  })

  it('défaite quand les vies tombent à 0, et le temps de jeu s’arrête de compter', () => {
    const engine = makeEngine({
      lives: 2,
      waves: [{ groups: [{ kind: 'runner', count: 5, interval: 0.5 }] }],
    })
    const defeat = vi.fn()
    engine.on('defeat', defeat)
    engine.startWave()
    run(engine, 30)
    expect(engine.phase).toBe('defeat')
    expect(engine.lives).toBe(0)
    expect(defeat).toHaveBeenCalledTimes(1)
    const enemies = engine.enemies.length
    engine.tick(0.05)
    expect(engine.phase).toBe('defeat')
    expect(engine.enemies.length).toBe(enemies)
  })

  it('un boss qui passe coûte 5 vies', () => {
    const engine = makeEngine({ lives: 20, waves: [{ groups: [{ kind: 'boss', count: 1, interval: 1 }] }] })
    engine.startWave()
    run(engine, 60)
    expect(engine.phase).toBe('victory')
    expect(engine.lives).toBe(15)
  })

  it('applique hpScale et delay des groupes', () => {
    const engine = makeEngine({ waves: [{ groups: [{ kind: 'grunt', count: 1, interval: 1, delay: 1, hpScale: 2 }] }] })
    engine.startWave()
    run(engine, 0.9)
    expect(engine.enemies).toHaveLength(0)
    run(engine, 0.2)
    expect(engine.enemies).toHaveLength(1)
    expect(engine.enemies[0].maxHp).toBe(ENEMIES.grunt.hp * 2)
  })

  it('ignore les pas de temps nuls, négatifs ou invalides', () => {
    const engine = makeEngine()
    engine.startWave()
    engine.tick(0)
    engine.tick(-1)
    engine.tick(Number.NaN)
    expect(engine.time).toBe(0)
    engine.tick(5) // plafonné à 0,1 s
    expect(engine.time).toBeCloseTo(0.1)
  })
})

describe('événements et abonnements', () => {
  it('compte les abonnements actifs, le maximum et le total ; désabonner est idempotent', () => {
    const engine = makeEngine()
    const handler = vi.fn()
    const off1 = engine.on('waveStart', handler)
    const off2 = engine.on('waveStart', handler)
    expect(engine.stats).toMatchObject({ activeSubscriptions: 2, maxSubscriptions: 2, totalSubscriptions: 2 })
    engine.startWave()
    expect(handler).toHaveBeenCalledTimes(2)
    off1()
    off1()
    expect(engine.stats.activeSubscriptions).toBe(1)
    off2()
    expect(engine.stats).toMatchObject({ activeSubscriptions: 0, maxSubscriptions: 2, totalSubscriptions: 2 })
  })

  it('une erreur dans un gestionnaire est journalisée sans casser le moteur', () => {
    const engine = makeEngine()
    const after = vi.fn()
    engine.on('waveStart', () => {
      throw new Error('boum')
    })
    engine.on('waveStart', after)
    engine.startWave()
    expect(after).toHaveBeenCalled()
    expect(engine.logs.some((l) => l.level === 'error' && /waveStart.*boum/.test(l.message))).toBe(true)
  })

  it('subscribe / getSnapshot : instantané stable et figé entre deux notifications', () => {
    const engine = makeEngine()
    const listener = vi.fn()
    const unsubscribe = engine.subscribe(listener)
    const s1 = engine.getSnapshot()
    expect(engine.getSnapshot()).toBe(s1)
    expect(Object.isFrozen(s1)).toBe(true)
    engine.upsertTower('t', { slot: 'A', kind: 'archer' })
    expect(listener).toHaveBeenCalled()
    const s2 = engine.getSnapshot()
    expect(s2).not.toBe(s1)
    expect(s2.slots.find((s) => s.id === 'A')).toEqual({ id: 'A', high: false, occupied: true })
    unsubscribe()
    listener.mockClear()
    engine.removeTower('t')
    expect(listener).not.toHaveBeenCalled()
  })

  it('le journal ignore les doublons consécutifs et garde 100 entrées', () => {
    const engine = makeEngine()
    engine.log('info', 'a')
    engine.log('info', 'a')
    expect(engine.logs.filter((l) => l.message === 'a')).toHaveLength(1)
    for (let i = 0; i < 150; i++) engine.log('info', `m${i}`)
    expect(engine.logs).toHaveLength(100)
    expect(engine.logs.at(-1)?.message).toBe('m149')
    engine.clearLogs()
    expect(engine.logs).toHaveLength(0)
  })
})

describe('reset()', () => {
  it('remet la partie à zéro en conservant les tours et les abonnements actifs', () => {
    const engine = makeEngine({ lives: 3, spells: ['meteor'] })
    engine.upsertTower('t', { slot: 'A', kind: 'archer' })
    const off = engine.on('enemyKilled', () => {})
    engine.on('waveEnd', () => {})()
    engine.startWave()
    run(engine, 5)
    engine.castSpell('meteor')
    expect(engine.time).toBeGreaterThan(0)

    engine.reset()
    expect(engine.phase).toBe('build')
    expect(engine.time).toBe(0)
    expect(engine.lives).toBe(3)
    expect(engine.enemies).toHaveLength(0)
    expect(engine.waveIndex).toBe(0)
    expect(engine.spellCooldown('meteor')).toBe(0)
    expect(statusOf(engine, 't')).toBe('active')
    expect(engine.gold).toBe(150)
    expect(engine.stats).toMatchObject({
      kills: 0,
      spellsCast: { freeze: 0, meteor: 0 },
      maxActiveTowers: 1,
      towerKindsUsed: ['archer'],
      activeSubscriptions: 1,
      maxSubscriptions: 1,
      totalSubscriptions: 0,
    })
    off()
    expect(engine.stats.activeSubscriptions).toBe(0)
    // La partie est rejouable après reset.
    expect(engine.startWave()).toBe(true)
    run(engine, 40)
    expect(engine.phase).toBe('victory')
  })
})
