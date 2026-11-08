import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { GameEngine } from '../engine/engine'
import type { GameConfig } from '../engine/types'
import { LEVELS } from '../levels'
import { MEADOW } from '../levels/maps'
import { typecheckUserCode } from '../testing/typecheck'
import { compileUserCode, transpile } from './compile'
import { createGameModule } from './gameModule'
import { LOOP_GUARD_NAME, createLoopGuard, instrumentLoops } from './loopGuard'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const CONFIG: GameConfig = {
  map: MEADOW,
  startGold: 300,
  lives: 5,
  spells: ['meteor'],
  waves: [{ groups: [{ kind: 'grunt', count: 2, interval: 1 }] }],
}

function compile(source: string, options?: { loopTimeoutMs?: number }) {
  const engine = new GameEngine(CONFIG)
  return { engine, result: compileUserCode(source, engine, options) }
}

/** Monte le composant compilé et renvoie le conteneur + une fonction de démontage. */
async function mount(source: string, options?: { loopTimeoutMs?: number }) {
  const { engine, result } = compile(source, options)
  if (!result.ok) throw new Error(result.error)
  const container = document.createElement('div')
  const root = createRoot(container)
  const { Component } = result
  await act(async () => root.render(createElement(Component)))
  return { engine, container, unmount: () => act(async () => root.unmount()) }
}

describe('compilation du code joueur', () => {
  it('signale une erreur de syntaxe lisible avec le numéro de ligne', () => {
    const { result } = compile(`import { Tower } from 'game'

export default function Defense() {
  return <Tower slot="A" kind="archer"
}
`)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/^Erreur de syntaxe ligne \d+ : /)
    expect(result.line).toBeGreaterThanOrEqual(4)
    expect(result.error).not.toMatch(/\(\d+:\d+\)$/)
  })

  it('transpile conserve les numéros de ligne (utile pour les messages d’erreur)', () => {
    const src = `import { Tower } from 'game'
type Props = { n: number }
const x: number = 1
export default function Defense(_p: Props) {
  return <Tower slot="A" kind="archer" />
}
`
    const t = transpile(src)
    expect(t.ok).toBe(true)
    if (!t.ok) return
    const srcLine = src.split('\n').findIndex((l) => l.includes('return'))
    const jsLine = t.js.split('\n').findIndex((l) => l.includes('return'))
    expect(jsLine).toBe(srcLine)
  })

  it('exige un export par défaut et liste les exports trouvés', () => {
    const { result } = compile(`export function Defense() { return null }`)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/exporter un composant par défaut/)
    expect(result.error).toMatch(/exports trouvés : Defense/)
  })

  it('refuse un export par défaut qui n’est pas une fonction', () => {
    const { result } = compile(`export default 42`)
    expect(result.ok).toBe(false)
  })

  it('interdit les imports autres que react et game', () => {
    const { result } = compile(`import fs from 'fs'
export default function Defense() { console.log(fs); return null }`)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/Le module "fs" n’existe pas ici/)
    expect(result.error).toMatch(/"react" ou "game"/)
  })

  it('rapporte une exception levée au chargement du module', () => {
    const { result } = compile(`const x = (undefined as any).foo
export default function Defense() { return null }`)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/^Erreur à l’exécution du module : /)
  })

  it('redirige console.* vers le journal du jeu', () => {
    const { engine, result } = compile(`console.log('bonjour', { a: 1 }, [2])
console.warn('attention')
console.error('aïe')
export default function Defense() { return null }`)
    expect(result.ok).toBe(true)
    expect(engine.logs.map((l) => [l.level, l.message])).toEqual([
      ['info', '📝 bonjour {"a":1} [2]'],
      ['warn', '📝 attention'],
      ['error', '📝 aïe'],
    ])
  })

  it('console.log survit aux objets circulaires', () => {
    const { engine, result } = compile(`const a: any = {}; a.self = a
console.log(a)
export default function Defense() { return null }`)
    expect(result.ok).toBe(true)
    expect(engine.logs.at(-1)?.message).toBe('📝 [object Object]')
  })
})

describe('module game', () => {
  it('<Tower /> construit une tour tant qu’il est affiché, et useGame se met à jour', async () => {
    const { engine, container, unmount } = await mount(`import { useState } from 'react'
import { Tower, useGame } from 'game'
export default function Defense() {
  const game = useGame()
  const [lvl, setLvl] = useState(1)
  return (
    <>
      <p id="gold">{game.gold}</p>
      <button onClick={() => setLvl(2)}>up</button>
      <Tower slot="A" kind="archer" level={lvl} target="strongest" element="fire" />
    </>
  )
}`)
    const towers = () => [...engine.towers.values()]
    expect(towers()).toHaveLength(1)
    expect(towers()[0]).toMatchObject({ slot: 'A', kind: 'archer', level: 1, target: 'strongest', element: 'fire', status: 'active' })
    expect(container.querySelector('#gold')?.textContent).toBe('250')
    await act(async () => container.querySelector('button')!.click())
    expect(towers()).toHaveLength(1)
    expect(towers()[0].level).toBe(2)
    expect(container.querySelector('#gold')?.textContent).toBe('215')
    await unmount()
    expect(engine.towers.size).toBe(0)
    expect(engine.gold).toBe(300)
  })

  it('onGameEvent, castSpell, getTowerCost, log, TOWER_INFO et ENEMY_INFO fonctionnent', async () => {
    const { engine, unmount } = await mount(`import { useEffect } from 'react'
import { castSpell, getTowerCost, log, onGameEvent, TOWER_INFO, ENEMY_INFO } from 'game'
export default function Defense() {
  useEffect(() => {
    log(\`archer:\${getTowerCost('archer')} archer3:\${getTowerCost('archer', 3)}\`)
    log(\`\${TOWER_INFO.cannon.label} \${ENEMY_INFO.flyer.flying}\`)
    log({ ok: castSpell('freeze') })
    return onGameEvent('waveStart', (p) => log('vague ' + p.wave))
  }, [])
  return null
}`)
    const messages = () => engine.logs.map((l) => l.message)
    expect(messages()).toContain('📝 archer:50 archer3:120')
    expect(messages()).toContain('📝 Canon true')
    expect(messages()).toContain('📝 {"ok":false}') // freeze absent de CONFIG.spells
    expect(engine.stats.activeSubscriptions).toBe(1)
    engine.startWave()
    expect(messages()).toContain('📝 vague 1')
    await unmount()
    expect(engine.stats.activeSubscriptions).toBe(0)
  })

  it('onGameEvent sans fonction journalise une erreur au lieu de planter', async () => {
    const { engine, unmount } = await mount(`import { useEffect } from 'react'
import { onGameEvent } from 'game'
export default function Defense() {
  useEffect(() => onGameEvent('waveStart', 42 as any), [])
  return null
}`)
    expect(engine.logs.at(-1)?.message).toMatch(/attend une fonction/)
    expect(engine.stats.activeSubscriptions).toBe(0)
    await unmount()
  })
})

describe('types du module game (gameModule.d.ts.txt)', () => {
  it('toute l’API se type-checke comme dans l’éditeur', () => {
    const code = `import { useEffect, useState } from 'react'
import {
  Tower, useGame, castSpell, onGameEvent, getTowerCost, log, TOWER_INFO, ENEMY_INFO,
  type TowerKind, type EnemyKind, type TargetMode, type Element, type SpellName, type Phase,
  type TowerProps, type EnemyInfo, type SlotInfo, type WavePreview, type SpellInfo,
  type GameSnapshot, type GameEventName, type GameEventPayload,
} from 'game'

const kinds: TowerKind[] = ['archer', 'cannon', 'mage', 'frost']
const enemies: EnemyKind[] = ['grunt', 'runner', 'tank', 'flyer', 'boss']
const modes: TargetMode[] = ['first', 'strongest', 'closest']
const elements: Element[] = ['neutral', 'fire', 'ice', 'storm']
const spells: SpellName[] = ['freeze', 'meteor']
const phases: Phase[] = ['build', 'wave', 'break', 'victory', 'defeat']
const events: GameEventName[] = ['waveStart', 'waveEnd', 'enemySpawn', 'enemyKilled', 'enemyLeaked', 'victory', 'defeat']

function Info({ s }: { s: GameSnapshot }) {
  const e: EnemyInfo | undefined = s.enemies[0]
  const slot: SlotInfo | undefined = s.slots[0]
  const w: WavePreview | null = s.nextWave
  const sp: SpellInfo | undefined = s.spells[0]
  return (
    <p>
      {s.phase} {s.gold} {s.lives}/{s.maxLives} {s.wave}/{s.totalWaves} {s.time} {s.towerCount} {s.kills}
      {e && \`\${e.id} \${e.kind} \${e.hp}/\${e.maxHp} \${e.flying} \${e.armored} \${e.progress}\`}
      {slot && \`\${slot.id} \${slot.high} \${slot.occupied}\`}
      {w && \`\${w.number} \${w.count} \${w.kinds.join()} \${w.hasFlying} \${w.hasArmored}\`}
      {sp && \`\${sp.name} \${sp.ready} \${sp.cooldown}\`}
    </p>
  )
}

export default function Defense() {
  const game = useGame()
  const [props] = useState<TowerProps>({ slot: 'A', kind: 'archer', level: 2, target: 'first', element: 'ice' })
  useEffect(() => {
    const handler = (p: GameEventPayload) => log(p.enemy ? p.enemy.kind : p.wave)
    const offs: (() => void)[] = events.map((ev) => onGameEvent(ev, handler))
    return () => offs.forEach((off) => off())
  }, [])
  const ok: boolean = castSpell(spells[0])
  const cost: number = getTowerCost('mage') + getTowerCost(kinds[1], 2)
  const info: string = TOWER_INFO.archer.label + TOWER_INFO.mage.description
  const air: boolean = TOWER_INFO.cannon.hitsAir || TOWER_INFO.mage.pierce
  const range: number = TOWER_INFO.frost.range + TOWER_INFO.frost.cost
  const hp: number = ENEMY_INFO.boss.hp
  const flags: boolean = ENEMY_INFO.tank.armored && ENEMY_INFO.flyer.flying
  const label: string = ENEMY_INFO[enemies[0]].label
  log({ ok, cost, info, air, range, hp, flags, label, modes, elements, phases })
  const el: null = Tower(props)
  void el
  return (
    <>
      <Info s={game} />
      <Tower {...props} />
      <Tower slot="B" kind="cannon" />
    </>
  )
}
`
    expect(typecheckUserCode(code)).toEqual([])
  })

  it('refuse les valeurs hors API (le .d.ts n’est pas trop permissif)', () => {
    const errors = typecheckUserCode(`import { Tower, castSpell } from 'game'
export default function Defense() {
  castSpell('fireball')
  return <Tower slot="A" kind="laser" target="weakest" />
}`)
    expect(errors.length).toBeGreaterThanOrEqual(3)
  })

  it('les types déclarés au joueur sont identiques à ceux du moteur', () => {
    const names = [
      'TowerKind',
      'EnemyKind',
      'TargetMode',
      'Element',
      'SpellName',
      'Phase',
      'TowerProps',
      'EnemyInfo',
      'SlotInfo',
      'WavePreview',
      'SpellInfo',
      'GameSnapshot',
      'GameEventName',
      'GameEventPayload',
    ]
    const code = `import type * as G from 'game'
import type * as E from '../src/engine/types'
import type { GameModule } from '../src/runtime/gameModule'
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
${names.map((n) => `const _${n}: Same<G.${n}, E.${n}> = true`).join('\n')}
type Api = typeof import('game')
${['Tower', 'useGame', 'castSpell', 'onGameEvent', 'getTowerCost', 'log', 'TOWER_INFO', 'ENEMY_INFO']
  .map((k) => `const _api_${k}: Same<GameModule['${k}'], Api['${k}']> = true`)
  .join('\n')}
const _keys: Same<keyof GameModule, keyof Api> = true
export {}
`
    expect(typecheckUserCode(code)).toEqual([])
  })

  it('le module exporte exactement l’API déclarée, avec les champs déclarés', () => {
    const api = createGameModule(new GameEngine(CONFIG))
    expect(Object.keys(api).sort()).toEqual(
      ['ENEMY_INFO', 'TOWER_INFO', 'Tower', 'castSpell', 'getTowerCost', 'log', 'onGameEvent', 'useGame'].sort(),
    )
    expect(Object.keys(api.TOWER_INFO).sort()).toEqual(['archer', 'cannon', 'frost', 'mage'])
    for (const info of Object.values(api.TOWER_INFO))
      expect(Object.keys(info).sort()).toEqual(['cost', 'description', 'hitsAir', 'label', 'pierce', 'range'])
    expect(Object.keys(api.ENEMY_INFO).sort()).toEqual(['boss', 'flyer', 'grunt', 'runner', 'tank'])
    for (const info of Object.values(api.ENEMY_INFO))
      expect(Object.keys(info).sort()).toEqual(['armored', 'flying', 'hp', 'label'])
  })

  it('l’instantané de useGame() a exactement les champs déclarés', () => {
    const engine = new GameEngine(CONFIG)
    engine.startWave()
    for (let i = 0; i < 40; i++) engine.tick(0.05)
    const s = engine.getSnapshot()
    expect(Object.keys(s).sort()).toEqual(
      ['enemies', 'gold', 'kills', 'lives', 'maxLives', 'nextWave', 'phase', 'slots', 'spells', 'time', 'totalWaves', 'towerCount', 'wave'].sort(),
    )
    expect(Object.keys(s.enemies[0]).sort()).toEqual(['armored', 'flying', 'hp', 'id', 'kind', 'maxHp', 'progress'])
    expect(Object.keys(s.slots[0]).sort()).toEqual(['high', 'id', 'occupied'])
    expect(Object.keys(s.spells[0]).sort()).toEqual(['cooldown', 'name', 'ready'])
  })
})

describe('garde-fou contre les boucles infinies', () => {
  it('instrumente while, do…while et for, mais pas for…of / for…in', () => {
    const js = `while (a) {}
do { x++ } while (x < 3)
for (let i = 0; i < 3; i++) {}
for (;;) {}
for (const v of list) {}
for (const k in obj) {}
for (;cond;) {}`
    const { code, loops } = instrumentLoops(js)
    expect(loops).toBe(5)
    const g = (line: number) => `${LOOP_GUARD_NAME}(${line})`
    expect(code.split('\n')).toEqual([
      `while (${g(1)} && (a)) {}`,
      `do { x++ } while (${g(2)} && (x < 3))`,
      `for (let i = 0; ${g(3)} && ( i < 3); i++) {}`,
      `for (;${g(4)};) {}`,
      'for (const v of list) {}',
      'for (const k in obj) {}',
      `for (; ${g(7)} && (cond);) {}`,
    ])
  })

  it('ne touche ni aux chaînes, ni aux commentaires, ni aux regex, ni aux propriétés', () => {
    const js = [
      `const s = "while (true) {}"`,
      `const t = 'for (;;)'`,
      'const u = `for (;;) ${"while (x)"} ${`for(;;)`}`',
      '// while (true) {}',
      '/* for (;;) {} */',
      'const r = /while (x)/g',
      'obj.while(1); api.for(2)',
      'const d = a / b / c',
    ].join('\n')
    expect(instrumentLoops(js)).toEqual({ code: js, loops: 0 })
  })

  it('gère les boucles imbriquées et les parenthèses dans les conditions', () => {
    const js = `for (let i = 0; i < f(g(1), [2]); i++) { while ((j = next()) !== null) { if (j) break } }`
    const { code, loops } = instrumentLoops(js)
    expect(loops).toBe(2)
    expect(code).toContain(`${LOOP_GUARD_NAME}(1) && ( i < f(g(1), [2]))`)
    expect(code).toContain(`while (${LOOP_GUARD_NAME}(1) && ((j = next()) !== null))`)
    // Le code instrumenté reste du JavaScript valide.
    expect(() => new Function(LOOP_GUARD_NAME, 'f', 'g', 'next', 'let j;' + code)).not.toThrow()
  })

  it('le garde-fou lève une erreur claire après le délai, puis repart à zéro', async () => {
    const guard = createLoopGuard(30)
    let n = 0
    expect(() => {
      while (guard(7)) n++
    }).toThrow(/Boucle infinie détectée ligne 7 : la boucle tourne depuis plus de 30 ms/)
    expect(n).toBeGreaterThan(100)
    // Le code qui suit l'erreur dispose d'un nouveau budget.
    expect(() => {
      for (let i = 0; i < 1000; i++) guard(8)
    }).not.toThrow()
    // Chaque exécution synchrone a son propre budget : des boucles courtes répétées ne déclenchent rien.
    for (let k = 0; k < 5; k++) {
      const end = performance.now() + 10
      while (performance.now() < end) guard(9)
      await Promise.resolve()
    }
  })

  it('un while (true) dans le rendu devient une erreur au lieu de geler l’onglet', async () => {
    const { result } = compile(
      `export default function Defense() {
  let n = 0
  while (true) {
    n++
  }
  return null
}`,
      { loopTimeoutMs: 50 },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(() => (result.Component as () => null)()).toThrow(/Boucle infinie détectée ligne 3/)
  })

  it('une boucle infinie au chargement du module est signalée comme erreur de compilation', () => {
    const { result } = compile(
      `let i = 0
for (;;) { i++ }
export default function Defense() { return null }`,
      { loopTimeoutMs: 50 },
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/Boucle infinie détectée ligne 2/)
  })

  it('une boucle infinie dans un gestionnaire d’événement du jeu est journalisée', async () => {
    const { engine, unmount } = await mount(
      `import { useEffect } from 'react'
import { onGameEvent } from 'game'
export default function Defense() {
  useEffect(() => onGameEvent('waveStart', () => {
    let x = 0
    do { x++ } while (x > 0)
  }), [])
  return null
}`,
      { loopTimeoutMs: 50 },
    )
    engine.startWave()
    expect(engine.logs.some((l) => l.level === 'error' && /Boucle infinie détectée ligne 6/.test(l.message))).toBe(true)
    await unmount()
  })

  it('les boucles légitimes fonctionnent normalement', async () => {
    const { container, engine, unmount } = await mount(`import { Tower, type TowerKind } from 'game'
const slots = ['A', 'B', 'C']
export default function Defense() {
  const items: string[] = []
  for (let i = 0; i < slots.length; i++) items.push(slots[i])
  let k = 0
  while (k < 3) k++
  do { k-- } while (k > 0)
  for (const s of slots) items.push(s.toLowerCase())
  const kind: TowerKind = 'archer'
  return <>{items.join(',')}{k}<Tower slot="A" kind={kind} /></>
}`)
    expect(container.textContent).toBe('A,B,C,a,b,c0')
    expect(engine.towers.size).toBe(1)
    await unmount()
  })

  it.each(LEVELS.flatMap((l) => [[`${l.id} (solution)`, l.solution] as const, [`${l.id} (départ)`, l.starterCode] as const]))(
    'le code instrumenté de %s reste valide',
    (_label, source) => {
      const t = transpile(source)
      expect(t.ok).toBe(true)
      if (!t.ok) return
      const { code } = instrumentLoops(t.js)
      expect(() => new Function('require', 'exports', 'module', 'React', 'console', LOOP_GUARD_NAME, code)).not.toThrow()
    },
  )
})
