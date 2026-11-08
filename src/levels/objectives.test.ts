import { describe, expect, it } from 'vitest'
import { typecheckUserCode } from '../testing/typecheck'
import { stripComments } from './checks'
import { LEVELS } from './index'
import type { CheckContext } from './types'

/**
 * Les objectifs qui analysent le code ne doivent jamais refuser du code correct : un objectif
 * raté bloque le niveau suivant. Chaque variante « valide » est un programme complet, vérifié
 * sans erreur TypeScript, qui doit passer l'objectif ; les variantes « invalides » doivent échouer.
 */
function check(levelNumber: number, objectiveId: string, code: string): boolean {
  const level = LEVELS[levelNumber - 1]
  const objective = level.objectives.find((o) => o.id === objectiveId)
  if (!objective) throw new Error(`objectif ${objectiveId} introuvable au niveau ${levelNumber}`)
  const ctx = { code, codeNoComments: stripComments(code) } as CheckContext
  return objective.check(ctx)
}

function expectValid(levelNumber: number, objectiveId: string, variants: string[]) {
  for (const code of variants) {
    expect(typecheckUserCode(code), code).toEqual([])
    expect(check(levelNumber, objectiveId, code), code).toBe(true)
  }
}

function expectInvalid(levelNumber: number, objectiveId: string, variants: string[]) {
  for (const code of variants) expect(check(levelNumber, objectiveId, code), code).toBe(false)
}

describe('niveau 01 — returns-jsx', () => {
  it('accepte return, fonction fléchée et fragment', () => {
    expectValid(1, 'returns-jsx', [
      `import { Tower } from 'game'\nexport default function Defense() {\n  return <Tower slot="A" kind="archer" />\n}`,
      `import { Tower } from 'game'\nconst Defense = () => <Tower slot="A" kind="archer" />\nexport default Defense`,
      `import { Tower } from 'game'\nexport default function Defense() {\n  return (\n    <>\n      <Tower slot="A" kind="archer" />\n    </>\n  )\n}`,
      `import { Tower } from 'game'\nexport default function Defense() {\n  return <Tower slot="A" kind="archer"></Tower>\n}`,
    ])
  })
  it('refuse null', () => {
    expectInvalid(1, 'returns-jsx', [`export default function Defense() {\n  return null\n}`])
  })
})

describe('niveau 03 — tower-kind et reuse', () => {
  const body = (decl: string) => `${decl}

type BastionProps = { slot: string; kind: TowerKind }

const Bastion = ({ slot, kind }: BastionProps) => <Tower slot={slot} kind={kind} />

export default function Defense() {
  return (
    <>
      <Bastion slot="A" kind="archer" />
      <Bastion slot="B" kind="cannon" />
    </>
  )
}`
  it('accepte import type séparé et composant fléché', () => {
    const code = body(`import { Tower } from 'game'\nimport type { TowerKind } from 'game'`)
    expectValid(3, 'tower-kind', [code])
    expectValid(3, 'reuse', [code, body(`import { Tower, type TowerKind } from 'game'`)])
  })
  it('refuse un composant utilisé une seule fois', () => {
    expectInvalid(3, 'reuse', [
      `import { Tower } from 'game'\nconst Bastion = () => <Tower slot="A" kind="archer" />\nexport default function Defense() { return <Bastion /> }`,
    ])
  })
})

describe('niveau 04 — map et key', () => {
  const posts = `import { Tower, type TowerKind } from 'game'
type Post = { slot: string; kind: TowerKind }
const POSTS: Post[] = [{ slot: 'A', kind: 'archer' }, { slot: 'B', kind: 'cannon' }]`
  it('accepte corps en bloc, composant maison et props étalées', () => {
    expectValid(4, 'map', [
      `${posts}\nexport default function Defense() {\n  return <>{POSTS.map((p) => {\n    return <Tower key={p.slot} slot={p.slot} kind={p.kind} />\n  })}</>\n}`,
    ])
    const variants = [
      `${posts}\nexport default function Defense() {\n  return <>{POSTS.map((p) => {\n    return <Tower key={p.slot} slot={p.slot} kind={p.kind} />\n  })}</>\n}`,
      `${posts}\nfunction Bastion(props: Post) {\n  return <Tower slot={props.slot} kind={props.kind} />\n}\nexport default function Defense() {\n  return <>{POSTS.map((p) => <Bastion key={p.slot} {...p} />)}</>\n}`,
      `${posts}\nexport default function Defense() {\n  return (\n    <>\n      {POSTS.map(({ slot, kind }, index) => (\n        <Tower\n          kind={kind}\n          slot={slot}\n          level={index >= 1 ? 2 : 1}\n          key={slot}\n        />\n      ))}\n    </>\n  )\n}`,
    ]
    expectValid(4, 'map', variants)
    expectValid(4, 'key', variants)
  })
  it('refuse l’index ou l’absence de key', () => {
    expectInvalid(4, 'key', [
      `${posts}\nexport default function Defense() {\n  return <>{POSTS.map((p, i) => <Tower key={i} slot={p.slot} kind={p.kind} />)}</>\n}`,
      `${posts}\nexport default function Defense() {\n  return <>{POSTS.map((p, n) => <Tower key={String(n)} slot={p.slot} kind={p.kind} />)}</>\n}`,
      `${posts}\nexport default function Defense() {\n  return <>{POSTS.map((p) => <Tower slot={p.slot} kind={p.kind} />)}</>\n}`,
    ])
    expectInvalid(4, 'map', [`${posts}\nexport default function Defense() {\n  return <Tower slot="A" kind="archer" />\n}`])
  })
})

describe('niveau 05 — ternary', () => {
  it('accepte un ternaire multi-ligne', () => {
    expectValid(5, 'ternary', [
      `import { Tower, useGame } from 'game'
export default function Defense() {
  const game = useGame()
  const flyers = game.enemies.some((enemy) => enemy.flying)
  return (
    <>
      {flyers ? (
        <p>Volants, archers !</p>
      ) : (
        <p>Au sol</p>
      )}
      <Tower slot="A" kind={flyers
        ? 'archer'
        : 'cannon'} />
    </>
  )
}`,
    ])
  })
  it('ne confond pas ?. et ??', () => {
    expectInvalid(5, 'ternary', [
      `import { Tower, useGame } from 'game'
export default function Defense() {
  const game = useGame()
  const kind = game.enemies[0]?.kind ?? 'none'
  return <Tower slot="A" kind={kind === 'flyer' && true ? 'archer' : 'cannon'} />
}`.replace(` && true ? 'archer' : 'cannon'`, ''),
    ])
  })
})

describe('niveau 06 — use-state et on-click', () => {
  it('accepte => et >= avant onClick, et React.useState', () => {
    expectValid(6, 'on-click', [
      `import { useState } from 'react'
export default function Defense() {
  const [level, setLevel] = useState(1)
  return <button disabled={level >= 3} onClick={() => setLevel((l) => l + 1)}>Améliorer</button>
}`,
    ])
    expectValid(6, 'use-state', [
      `import * as React from 'react'
export default function Defense() {
  const [level, setLevel] = React.useState(1)
  return <button onClick={() => setLevel(level + 1)}>Améliorer</button>
}`,
      `import { useState } from 'react'
export default function Defense() {
  const [level, setLevel] = useState<number>(1)
  return <button onClick={() => setLevel(level + 1)}>Améliorer</button>
}`,
    ])
    expectValid(6, 'functional-update', [
      `import { useState } from 'react'
export default function Defense() {
  const [level, setLevel] = useState(1)
  return <button onClick={() => setLevel((l: number) => l + 1)}>{level}</button>
}`,
    ])
  })
  it('refuse un useState seulement importé', () => {
    expectInvalid(6, 'use-state', [`import { useState } from 'react'\nexport default function Defense() { let level = 1; return <p>{level}</p> }`])
    expectInvalid(6, 'on-click', [`export default function Defense() { return <button>Améliorer</button> }`])
  })
})

describe('niveau 07 — formulaires contrôlés', () => {
  const head = `import { useState } from 'react'
import { Tower, type TowerKind } from 'game'
export default function Defense() {
  const [kind, setKind] = useState<TowerKind>('archer')
  const [level, setLevel] = useState(3)
  return (
    <>`
  const tail = `
      <Tower slot="C" kind={kind} level={level} />
    </>
  )
}`
  const select = `
      <select onChange={(e) => setKind(e.target.value as TowerKind)} value={kind}>
        <option value="archer">Archer</option>
        <option value="cannon">Canon</option>
      </select>`
  it('accepte onChange avant value et les autres conversions', () => {
    const variants = [
      `${head}${select}\n      <input type="number" onChange={(e) => setLevel(e.target.valueAsNumber)} value={level} />${tail}`,
      `${head}${select}\n      <input\n        type="number"\n        onChange={({ target }) => setLevel(Number(target.value))}\n        value={level}\n      />${tail}`,
      `${head}${select}\n      <input type="number" value={level} onChange={(e) => setLevel(+e.currentTarget.value)} />${tail}`,
    ]
    expectValid(7, 'controlled-select', variants)
    expectValid(7, 'controlled-input', variants)
    expectValid(7, 'typed-value', variants)
  })
  it('refuse un champ non contrôlé', () => {
    expectInvalid(7, 'controlled-input', [`${head}${select}\n      <input type="number" defaultValue={3} onChange={() => {}} />${tail}`])
    expectInvalid(7, 'typed-value', [`${head}${select}\n      <input type="number" value={level} onChange={() => setLevel(2)} />${tail}`])
  })
})

describe('niveau 10 — union et dispatch', () => {
  const program = (types: string, ui: string) => `import { useReducer } from 'react'
import { Tower, type TowerKind } from 'game'
type PlannedTower = { slot: string; kind: TowerKind; level: number }
${types}
function planReducer(plan: PlannedTower[], action: PlanAction): PlannedTower[] {
  switch (action.type) {
    case 'build':
      return [...plan, { slot: action.slot, kind: action.kind, level: 1 }]
    case 'upgrade':
      return plan.map((t) => (t.slot === action.slot ? { ...t, level: t.level + 1 } : t))
    case 'sell':
      return plan.filter((t) => t.slot !== action.slot)
    default: {
      const impossible: never = action
      return impossible
    }
  }
}
export default function Defense() {
  const [plan, send] = useReducer(planReducer, [])
${ui}
}`
  const directUi = `  return (
    <>
      {plan.map((t) => <Tower key={t.slot} slot={t.slot} kind={t.kind} level={t.level} />)}
      <button onClick={() => send({ type: 'upgrade', slot: 'A' })}>Améliorer A</button>
    </>
  )`
  it('accepte virgules, multi-ligne sans ;, type en dernier champ', () => {
    expectValid(10, 'union', [
      program(
        `type PlanAction =\n  | { type: 'build', slot: string, kind: TowerKind }\n  | { type: 'upgrade', slot: string }\n  | { slot: string, type: 'sell' }`,
        directUi,
      ),
      program(
        `type PlanAction =\n  | {\n      type: 'build'\n      slot: string\n      kind: TowerKind\n    }\n  | { type: 'upgrade'\n      slot: string }\n  | { slot: string; type: 'sell' }`,
        directUi,
      ),
      program(
        `interface Build { type: 'build'; slot: string; kind: TowerKind }\ninterface Upgrade { type: 'upgrade'; slot: string }\ninterface Sell { type: 'sell'; slot: string }\ntype PlanAction = Build | Upgrade | Sell`,
        directUi,
      ),
    ])
  })
  it('accepte un dispatch via une fonction intermédiaire', () => {
    const types = `type PlanAction =\n  | { type: 'build'; slot: string; kind: TowerKind }\n  | { type: 'upgrade'; slot: string }\n  | { type: 'sell'; slot: string }`
    expectValid(10, 'dispatch', [
      program(types, directUi),
      program(
        types,
        `  function upgrade(slot: string) {
    send({ slot, type: 'upgrade' })
  }
  return (
    <>
      {plan.map((t) => <Tower key={t.slot} slot={t.slot} kind={t.kind} level={t.level} />)}
      <button onClick={() => upgrade('A')}>Améliorer A</button>
    </>
  )`,
      ),
    ])
  })
  it('refuse une union incomplète et l’absence de bouton', () => {
    expectInvalid(10, 'union', [`type PlanAction = { type: 'build'; slot: string; kind: TowerKind }\nconst a = { type: 'upgrade', x: 1 }\nconst b = { type: 'sell', x: 1 }`])
    expectInvalid(10, 'dispatch', [
      `const [plan, dispatch] = useReducer(r, [])\ntype PlanAction = { type: 'upgrade'; slot: string }\ndispatch({ type: 'build' })\nconst x = <button onClick={() => dispatch({ type: 'build' })}>B</button>`,
    ])
  })
})

describe('niveau 11 — provider et no-drilling', () => {
  const program = (providerOpen: string, providerClose: string) => `import { createContext, useContext, useState } from 'react'
import { Tower } from 'game'
type MagicElement = 'fire' | 'ice' | 'storm'
const Crystal = createContext<MagicElement>('ice')
function ElementalTower({ slot }: { slot: string }) {
  const element = useContext(Crystal)
  return <Tower slot={slot} kind="mage" element={element} />
}
export default function Defense() {
  const [element, setElement] = useState<MagicElement>('ice')
  return (
    ${providerOpen}
      <button disabled={element === 'fire'} onClick={() => setElement('fire')}>Feu</button>
      <ElementalTower slot="A" />
    ${providerClose}
  )
}`
  it('accepte la forme React 19 et .Provider, avec => avant value', () => {
    const variants = [
      program(`<Crystal value={element}>`, `</Crystal>`),
      program(`<Crystal.Provider value={element}>`, `</Crystal.Provider>`),
      program(`<Crystal.Provider key={element === 'ice' ? 'a' : 'b'} value={element}>`, `</Crystal.Provider>`),
    ]
    expectValid(11, 'provider', variants)
    expectValid(11, 'no-drilling', variants)
  })
  it('refuse l’absence de provider et le prop drilling', () => {
    expectInvalid(11, 'provider', [program('<>', '</>')])
    expectInvalid(11, 'no-drilling', [
      `function Wall({ element }: { element: 'fire' }) { return <Tower slot="A" kind="mage" element={element} /> }\nconst x = <Wall element={'fire'} />`,
    ])
  })
})
