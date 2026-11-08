import { has, jsxAttr, typeDeclarations } from './checks'
import { MEADOW } from './maps'
import type { LevelDefinition, PlaytestApi } from './types'

/**
 * Plan de jeu simulé (tests headless) : chaque étape clique sur un bouton dès qu'il est
 * cliquable (les boutons trop chers sont désactivés), éventuellement après une condition.
 */
const PLAYTEST_STEPS: { click: string; when?: (ui: PlaytestApi) => boolean }[] = [
  ...[
    'Canon sur B',
    'Archer sur A',
    'Améliorer B',
    'Archer sur C',
    'Améliorer B',
    'Améliorer C',
    'Améliorer A',
    'Mage sur D',
    'Améliorer C',
    'Améliorer A',
    'Archer sur E',
  ].map((click) => ({ click })),
  // Les chauves-souris arrivent : le canon ne les touche pas, on le revend pour un mage.
  { click: 'Vendre B', when: (ui) => ui.phase === 'break' && !!ui.snapshot.nextWave?.hasFlying },
  ...['Mage sur B', 'Améliorer B', 'Améliorer D', 'Améliorer B', 'Améliorer D', 'Améliorer E'].map((click) => ({ click })),
]

export const level10: LevelDefinition = {
  id: '10-use-reducer',
  number: 10,
  title: 'Le plan de bataille',
  concept: 'useReducer & unions discriminées',
  summary: 'Gère un plan de construction qui évolue grâce à un reducer et des actions typées.',
  lesson: `
## Quand \`useState\` ne suffit plus

Avec \`useState\`, chaque clic appelle un \`setXxx(…)\` et la logique de mise à jour est
**éparpillée** dans tes gestionnaires d'événements. Dès que l'état devient riche (une liste
de tours qu'on construit, améliore, revend…), on préfère **centraliser** toutes les
transitions au même endroit : c'est le rôle de \`useReducer\`.

\`\`\`tsx
const [state, dispatch] = useReducer(reducer, initialState)
\`\`\`

- \`state\` : l'état courant (comme avec \`useState\`) ;
- \`dispatch(action)\` : on **décrit ce qui s'est passé** au lieu de calculer le nouvel état ;
- \`reducer(state, action)\` : une fonction **pure** qui renvoie le **nouvel** état.

## Le reducer : une fonction pure

\`\`\`tsx
function reducer(count: number, action: CounterAction): number {
  switch (action.type) {
    case 'add':
      return count + action.amount
    case 'reset':
      return 0
  }
}
\`\`\`

Règles d'or : **ne jamais modifier** l'état reçu (pas de \`push\`, pas de \`state.x = …\`),
mais renvoyer une **copie** (\`[...liste, nouveau]\`, \`liste.map(…)\`, \`liste.filter(…)\`).
Pas d'effet de bord non plus (pas de \`castSpell\` ni de \`log\` ici) : juste un calcul.

## Les unions discriminées

Comment typer des actions qui n'ont pas toutes les mêmes champs ? Avec une **union
discriminée** : chaque variante a un champ commun (souvent \`type\`) avec une valeur littérale.

\`\`\`tsx
type CounterAction =
  | { type: 'add'; amount: number }
  | { type: 'reset' }
\`\`\`

Dans \`case 'add':\`, TypeScript **sait** que l'action est \`{ type: 'add'; amount: number }\`
et te laisse lire \`action.amount\`. Dans \`case 'reset':\`, \`action.amount\` serait une erreur.
C'est ce qu'on appelle le **rétrécissement** (narrowing).

## Le \`switch\` exhaustif

Et si tu ajoutes une variante à l'union mais oublies de la traiter ? Le type \`never\` te
protège : après tous les \`case\`, il ne reste **aucune** possibilité…

\`\`\`tsx
  default: {
    const impossible: never = action // erreur TS si un cas est oublié !
    return impossible
  }
\`\`\`

## Dispatcher depuis l'interface

\`\`\`tsx
<button onClick={() => dispatch({ type: 'add', amount: 5 })}>+5</button>
\`\`\`

Tu peux désactiver un bouton trop cher avec \`disabled={gold < prix}\` : conditionner un
**bouton** sur l'or est sans danger (contrairement à une tour).

> 💡 Rappel économique : l'or disponible = ta banque − le coût des tours actives.
> **Vendre** une tour (la retirer du plan) te rembourse entièrement. Améliorer une tour
> coûte la différence entre les deux niveaux (\`getTowerCost(kind, level)\`).
`,
  mission: `Ton or de départ ne paie que deux tours : ton plan devra **évoluer pendant la bataille**.
Complète le reducer pour gérer les actions \`build\`, \`upgrade\` et \`sell\`, puis ajoute des boutons
qui les **dispatchent**. Attention : les chauves-souris finales se moquent des canons…`,
  starterCode: `import { useReducer } from 'react'
import { Tower, useGame, getTowerCost, type TowerKind } from 'game'

// Une tour prévue dans le plan.
type PlannedTower = { slot: string; kind: TowerKind; level: number }

// TODO : ajoute les variantes { type: 'upgrade'; slot: string } et { type: 'sell'; slot: string }
type PlanAction = { type: 'build'; slot: string; kind: TowerKind }

function planReducer(plan: PlannedTower[], action: PlanAction): PlannedTower[] {
  switch (action.type) {
    case 'build':
      if (plan.some((t) => t.slot === action.slot)) return plan
      return [...plan, { slot: action.slot, kind: action.kind, level: 1 }]
    // TODO : case 'upgrade' → niveau + 1 (maximum 3) sur le bon slot
    // TODO : case 'sell' → retire la tour du plan
    // TODO : default avec une vérification exhaustive (never)
  }
  return plan
}

const KINDS: TowerKind[] = ['archer', 'cannon', 'mage']
const LABELS: Record<TowerKind, string> = { archer: 'Archer', cannon: 'Canon', mage: 'Mage', frost: 'Givre' }

export default function Defense() {
  const [plan, dispatch] = useReducer(planReducer, [])
  const { slots, gold } = useGame()

  return (
    <>
      {plan.map((t) => (
        <Tower key={t.slot} slot={t.slot} kind={t.kind} level={t.level} />
      ))}
      {slots.map((s) => {
        const planned = plan.find((t) => t.slot === s.id)
        if (planned) {
          return (
            <p key={s.id}>
              {s.id} : {LABELS[planned.kind]} niv. {planned.level}
              {/* TODO : boutons « Améliorer {s.id} » et « Vendre {s.id} » */}
            </p>
          )
        }
        return (
          <p key={s.id}>
            {KINDS.map((kind) => (
              <button
                key={kind}
                disabled={gold < getTowerCost(kind)}
                onClick={() => dispatch({ type: 'build', slot: s.id, kind })}
              >
                {LABELS[kind]} sur {s.id}
              </button>
            ))}
          </p>
        )
      })}
    </>
  )
}
`,
  solution: `import { useReducer } from 'react'
import { Tower, useGame, getTowerCost, type TowerKind } from 'game'

type PlannedTower = { slot: string; kind: TowerKind; level: number }

type PlanAction =
  | { type: 'build'; slot: string; kind: TowerKind }
  | { type: 'upgrade'; slot: string }
  | { type: 'sell'; slot: string }

function planReducer(plan: PlannedTower[], action: PlanAction): PlannedTower[] {
  switch (action.type) {
    case 'build':
      if (plan.some((t) => t.slot === action.slot)) return plan
      return [...plan, { slot: action.slot, kind: action.kind, level: 1 }]
    case 'upgrade':
      return plan.map((t) =>
        t.slot === action.slot ? { ...t, level: Math.min(3, t.level + 1) } : t,
      )
    case 'sell':
      return plan.filter((t) => t.slot !== action.slot)
    default: {
      const impossible: never = action
      return impossible
    }
  }
}

const KINDS: TowerKind[] = ['archer', 'cannon', 'mage']
const LABELS: Record<TowerKind, string> = { archer: 'Archer', cannon: 'Canon', mage: 'Mage', frost: 'Givre' }

export default function Defense() {
  const [plan, dispatch] = useReducer(planReducer, [])
  const { slots, gold } = useGame()

  return (
    <>
      {plan.map((t) => (
        <Tower key={t.slot} slot={t.slot} kind={t.kind} level={t.level} />
      ))}
      {slots.map((s) => {
        const planned = plan.find((t) => t.slot === s.id)
        if (planned) {
          const upgradeCost =
            getTowerCost(planned.kind, planned.level + 1) - getTowerCost(planned.kind, planned.level)
          return (
            <p key={s.id}>
              {s.id} : {LABELS[planned.kind]} niv. {planned.level}{' '}
              <button
                disabled={planned.level >= 3 || gold < upgradeCost}
                onClick={() => dispatch({ type: 'upgrade', slot: s.id })}
              >
                Améliorer {s.id} ({upgradeCost})
              </button>
              <button onClick={() => dispatch({ type: 'sell', slot: s.id })}>Vendre {s.id}</button>
            </p>
          )
        }
        return (
          <p key={s.id}>
            {KINDS.map((kind) => (
              <button
                key={kind}
                disabled={gold < getTowerCost(kind)}
                onClick={() => dispatch({ type: 'build', slot: s.id, kind })}
              >
                {LABELS[kind]} sur {s.id}
              </button>
            ))}
          </p>
        )
      })}
    </>
  )
}
`,
  hints: [
    'Chaque nouvelle action se fait en trois temps : une variante dans l’union `PlanAction`, un `case` dans le reducer, un bouton qui appelle `dispatch`.',
    'Pour améliorer : `plan.map((t) => t.slot === action.slot ? { ...t, level: Math.min(3, t.level + 1) } : t)`. Pour vendre : `plan.filter((t) => t.slot !== action.slot)`. Ne modifie jamais `plan` directement.',
    'Bouton d’amélioration : `<button onClick={() => dispatch({ type: \'upgrade\', slot: s.id })}>Améliorer {s.id}</button>`. Joue ensuite : améliore tes tours entre les vagues et, avant les chauves-souris, vends le canon pour un mage.',
  ],
  objectives: [
    {
      id: 'use-reducer',
      label: 'Gérer le plan avec `useReducer`',
      check: (ctx) => has(ctx, /\buseReducer\s*[<(]/),
    },
    {
      id: 'union',
      label: 'Une union discriminée `build | upgrade | sell`',
      // Les trois littéraux doivent apparaître comme `type: '…'` dans des déclarations de type
      // (`;`, virgule ou retour à la ligne, en alias d'union comme en interfaces).
      check: (ctx) => {
        const decls = typeDeclarations(ctx)
        return (
          decls.some((d) => /=[^]*\|/.test(d.text)) &&
          ['build', 'upgrade', 'sell'].every((t) =>
            decls.some((d) => new RegExp(`\\btype\\s*:\\s*['"]${t}['"]`).test(d.text)),
          )
        )
      },
    },
    {
      id: 'switch',
      label: 'Un `switch` qui traite les 3 actions, exhaustif (`never`)',
      check: (ctx) =>
        has(ctx, /switch\s*\(\s*\w+\.type\s*\)/) &&
        ['build', 'upgrade', 'sell'].every((t) => has(ctx, new RegExp(`case\\s*['"]${t}['"]\\s*:`))) &&
        has(ctx, /:\s*never\b/),
    },
    {
      id: 'dispatch',
      label: 'Des boutons qui appellent `dispatch`',
      // Directement (`onClick={() => dispatch({ type: 'upgrade', … })}`) ou via une fonction
      // intermédiaire (`const upgrade = (slot) => dispatch({ type: 'upgrade', slot })`).
      check: (ctx) => {
        const code = ctx.codeNoComments
        const name = /\[\s*\w+\s*,\s*([A-Za-z_$][\w$]*)\s*\]\s*=\s*(?:React\.)?useReducer\b/.exec(code)?.[1] ?? 'dispatch'
        const typeRanges = typeDeclarations(ctx)
        const outsideTypes = (i: number) => !typeRanges.some((d) => i >= d.start && i < d.end)
        const dispatched = [...code.matchAll(/\btype\s*:\s*['"]upgrade['"]/g)].some((m) => outsideTypes(m.index))
        const called = new RegExp(`(?<![\\w$.])${name.replace(/\$/g, '\\$')}\\s*\\(`).test(code)
        return dispatched && called && jsxAttr(ctx, 'button', 'onClick')
      },
    },
    {
      id: 'evolved',
      label: 'Une tour améliorée au niveau 3 en cours de partie',
      check: (ctx) => ctx.stats.maxTowerLevel >= 3,
    },
  ],
  game: {
    map: MEADOW,
    startGold: 130,
    lives: 10,
    allowedTowers: ['archer', 'cannon', 'mage'],
    breakTime: 4,
    waves: [
      { groups: [{ kind: 'grunt', count: 12, interval: 1.0 }] },
      {
        groups: [
          { kind: 'grunt', count: 12, interval: 0.8 },
          { kind: 'tank', count: 5, interval: 2.5, delay: 2 },
        ],
      },
      {
        groups: [
          { kind: 'tank', count: 7, interval: 2 },
          { kind: 'runner', count: 14, interval: 0.6, delay: 3 },
        ],
      },
      {
        groups: [
          { kind: 'flyer', count: 22, interval: 0.6, hpScale: 1.5 },
          { kind: 'grunt', count: 10, interval: 1.0, delay: 2, hpScale: 1.3 },
        ],
      },
      {
        groups: [
          { kind: 'flyer', count: 36, interval: 0.4, hpScale: 2 },
          { kind: 'tank', count: 4, interval: 3, delay: 3, hpScale: 1.3 },
        ],
      },
    ],
  },
  playtest: (ui) => {
    const step = (ui.memory.step as number | undefined) ?? 0
    const next = PLAYTEST_STEPS[step]
    if (!next || ui.phase === 'victory' || ui.phase === 'defeat') return
    if (next.when && !next.when(ui)) return
    if (ui.click(next.click)) ui.memory.step = step + 1
  },
}
