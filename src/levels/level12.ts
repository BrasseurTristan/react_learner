import type { MapDef } from '../engine/types'
import { has } from './checks'
import { FORTRESS } from './maps'
import type { CheckContext, LevelDefinition } from './types'

const REACT_HOOKS = ['useState', 'useEffect', 'useRef', 'useReducer', 'useContext', 'useMemo', 'useCallback', 'useLayoutEffect']

/** Repère le premier hook personnalisé défini par le joueur (`function useXxx(` ou `const useXxx = (`). */
function customHook(ctx: CheckContext): { name: string; body: string; arrow: boolean } | null {
  const code = ctx.codeNoComments
  const m = /\bfunction\s+(use[A-Z]\w*)\s*\(|\bconst\s+(use[A-Z]\w*)\s*=\s*(?:\([^)]*\)|\w+)\s*(?::[^=]*)?=>/.exec(code)
  if (!m) return null
  const name = m[1] ?? m[2]
  // Corps approximatif : jusqu'à la prochaine déclaration de premier niveau.
  const rest = code.slice(m.index + m[0].length)
  const end = rest.search(/\n(?:export\s|function\s|const\s|let\s|type\s|interface\s)/)
  return { name, body: end === -1 ? rest : rest.slice(0, end), arrow: !m[1] }
}

const BATTLE_MAP: MapDef = {
  ...FORTRESS,
  decor: [
    { kind: 'crystal', x: 7, z: 6 },
    { kind: 'rock', x: 0, z: 8 },
    { kind: 'rock', x: 3, z: 5 },
    { kind: 'tree', x: 14, z: 3 },
  ],
}

export const level12: LevelDefinition = {
  id: '12-custom-hook',
  number: 12,
  title: 'Le Seigneur ombre',
  concept: 'Hook personnalisé',
  summary: 'Boss final : rassemble tout ce que tu as appris dans ton propre hook.',
  lesson: `
## Ton propre hook

Tu connais maintenant plusieurs hooks : \`useState\`, \`useEffect\`, \`useRef\`, \`useReducer\`,
\`useContext\`… et \`useGame\`. Un **hook personnalisé** est simplement une **fonction dont le
nom commence par \`use\`** et qui **appelle d'autres hooks**. Il permet d'extraire une logique
avec état pour la réutiliser ou, tout simplement, pour garder tes composants lisibles.

\`\`\`tsx
/** Nombre d'ennemis vaincus depuis le début de la vague. */
function useWaveKills(): number {
  const [kills, setKills] = useState(0)

  useEffect(() => {
    const offStart = onGameEvent('waveStart', () => setKills(0))
    const offKill = onGameEvent('enemyKilled', () => setKills((k) => k + 1))
    return () => {
      offStart()
      offKill()
    }
  }, [])

  return kills
}

function Hud() {
  const kills = useWaveKills() // s'utilise comme n'importe quel hook
  return <p>Ennemis vaincus cette vague : {kills}</p>
}
\`\`\`

\`Hud\` ne sait rien des abonnements ni du nettoyage : toute la mécanique est **encapsulée**.

## Les règles des hooks

1. Le nom **commence par \`use\`** suivi d'une majuscule : React (et ses outils) savent ainsi
   que la fonction contient des hooks.
2. On appelle les hooks **au premier niveau** d'un composant ou d'un autre hook : jamais dans
   un \`if\`, une boucle ou une fonction imbriquée. React les reconnaît **par leur ordre d'appel**.
3. Chaque composant qui appelle ton hook obtient **son propre état** : un hook partage une
   *logique*, pas des *données* (pour partager des données, souviens-toi du Context).

## Typer ce que renvoie le hook

Un hook renvoie ce que tu veux : une valeur, un objet, un tuple… Annoter le type de retour
documente ton intention et protège ceux qui l'utilisent :

\`\`\`tsx
function useThreat(): { flying: boolean; armored: boolean } { … }
\`\`\`

## Le piège du jour : \`nextWave\`

\`useGame().nextWave\` annonce la **prochaine** vague. Pendant la pause, c'est celle qui
arrive ; mais **pendant** une vague, c'est déjà la suivante ! La vague **en cours** est dans
\`currentWave\` (qui vaut \`null\` hors des vagues). La menace à affronter est donc :

\`\`\`tsx
const { currentWave, nextWave } = useGame()
const threat = currentWave ?? nextWave // la vague en cours, sinon celle qui arrive
\`\`\`

Pas besoin d'état pour ça : c'est une valeur **dérivée** de ce que renvoie \`useGame()\`.
En revanche, « combien de boss sont en vie ? » n'apparaît nulle part : c'est à toi de le
**mémoriser** (\`useState\`) en écoutant les événements du jeu (\`useEffect\` + \`onGameEvent\`).
Un compteur plutôt qu'un booléen : la dernière vague en envoie **deux** !

## Le Seigneur ombre

Ici, tous les ennemis sont **renforcés** (bien plus de points de vie que d'habitude), et à
leur tête marche le **Seigneur ombre** : **blindé**, très lent, des milliers de points de vie,
et il coûte **5 vies** s'il atteint ta base — soit toute ta réserve.

Les archers ne lui font presque rien. Quand il apparaît (événement \`enemySpawn\`, avec
\`enemy.kind === 'boss'\`), c'est le moment de lancer tes sorts \`freeze\` et \`meteor\` et de faire
viser tes tours sur l'ennemi le plus résistant (\`target="strongest"\`).

---

## 🎓 Ton parcours

Tu as traversé tout le cœur de React :

- **Composants & JSX**, **props**, **fragments** et **typage des props** avec TypeScript ;
- **listes** avec \`.map()\` et \`key\`, **rendu conditionnel** ;
- l'**état** avec \`useState\`, les **événements** et les **formulaires contrôlés** ;
- les **effets** avec \`useEffect\` et leur **nettoyage**, les **refs** avec \`useRef\` ;
- \`useReducer\` et les **unions discriminées**, le **Context**, et enfin tes **propres hooks**.

## Et ensuite ?

- **\`useMemo\` et \`useCallback\`** : mémoriser un calcul coûteux ou une fonction entre deux rendus
  (utile pour les performances, à n'employer que quand un vrai problème apparaît).
- **React Router** : plusieurs pages dans une application.
- **Récupérer des données** : \`fetch\` dans un effet, puis des bibliothèques comme TanStack Query.
- **Next.js** ou **Remix** : des applications React complètes, rendues côté serveur.
- **Tester** tes composants avec Vitest et Testing Library.
- Et surtout : **construis un vrai projet** qui te tient à cœur. C'est là que tout se met en place !
`,
  mission: `Le Seigneur ombre marche sur ta citadelle et une seule fuite de sa part te serait fatale.
Écris le hook \`useBattlePlan()\` : il doit choisir les tours adaptées à la vague **en cours**
(volants ou blindés ?), repérer l'arrivée du boss grâce à \`onGameEvent\` pour lancer tes sorts,
et renvoyer la liste des tours. La fonction \`planFor\` est déjà écrite pour toi.`,
  starterCode: `import { useEffect, useState } from 'react'
import { Tower, useGame, onGameEvent, castSpell, type TowerKind, type TargetMode, type WavePreview } from 'game'

type PlannedTower = { slot: string; kind: TowerKind; level: number; target: TargetMode }

// Emplacements par ordre de priorité : les premiers sont payés en premier.
const SLOTS = ['I', 'H', 'G', 'J', 'B', 'E', 'A', 'C', 'D', 'F']

/** Stratégie toute prête : les tours à construire face à une menace donnée. */
function planFor(threat: WavePreview | null, bossAlive: boolean): PlannedTower[] {
  const air = threat?.hasFlying ?? false
  const armored = threat?.hasArmored ?? false
  return SLOTS.map((slot, i) => {
    let kind: TowerKind = 'archer'
    if (air && armored) kind = i % 2 === 0 ? 'mage' : 'archer'
    else if (armored) kind = 'cannon'
    const level = Math.min(3, 1 + Math.floor((threat?.number ?? 0) / 3))
    return { slot, kind, level, target: bossAlive && kind !== 'archer' ? 'strongest' : 'first' }
  })
}

// TODO : écris ton hook personnalisé.
// - useGame() : la menace est la vague en cours (currentWave) ou, à défaut, la prochaine (nextWave)
// - un état « bossesAlive » (nombre de boss en vie : la dernière vague en a deux !) piloté par
//   onGameEvent('enemySpawn' / 'enemyKilled' / 'enemyLeaked') (sans oublier le nettoyage !),
//   et castSpell('freeze') / castSpell('meteor') à l'arrivée de chaque boss
// - renvoie planFor(threat, bossesAlive > 0)
function useBattlePlan(): PlannedTower[] {
  return planFor(null, false)
}

export default function Defense() {
  const plan = useBattlePlan()
  return (
    <>
      {plan.map((t) => (
        <Tower key={t.slot} slot={t.slot} kind={t.kind} level={t.level} target={t.target} />
      ))}
    </>
  )
}
`,
  solution: `import { useEffect, useState } from 'react'
import { Tower, useGame, onGameEvent, castSpell, type TowerKind, type TargetMode, type WavePreview } from 'game'

type PlannedTower = { slot: string; kind: TowerKind; level: number; target: TargetMode }

const SLOTS = ['I', 'H', 'G', 'J', 'B', 'E', 'A', 'C', 'D', 'F']

function planFor(threat: WavePreview | null, bossAlive: boolean): PlannedTower[] {
  const air = threat?.hasFlying ?? false
  const armored = threat?.hasArmored ?? false
  return SLOTS.map((slot, i) => {
    let kind: TowerKind = 'archer'
    if (air && armored) kind = i % 2 === 0 ? 'mage' : 'archer'
    else if (armored) kind = 'cannon'
    const level = Math.min(3, 1 + Math.floor((threat?.number ?? 0) / 3))
    return { slot, kind, level, target: bossAlive && kind !== 'archer' ? 'strongest' : 'first' }
  })
}

function useBattlePlan(): PlannedTower[] {
  const { currentWave, nextWave } = useGame()
  // Un compteur, pas un booléen : la dernière vague envoie deux boss.
  const [bossesAlive, setBossesAlive] = useState(0)

  useEffect(() => {
    const offSpawn = onGameEvent('enemySpawn', ({ enemy }) => {
      if (enemy?.kind !== 'boss') return
      setBossesAlive((n) => n + 1)
      castSpell('freeze')
      castSpell('meteor')
    })
    const offKilled = onGameEvent('enemyKilled', ({ enemy }) => {
      if (enemy?.kind === 'boss') setBossesAlive((n) => n - 1)
    })
    const offLeaked = onGameEvent('enemyLeaked', ({ enemy }) => {
      if (enemy?.kind === 'boss') setBossesAlive((n) => n - 1)
    })
    return () => {
      offSpawn()
      offKilled()
      offLeaked()
    }
  }, [])

  return planFor(currentWave ?? nextWave, bossesAlive > 0)
}

export default function Defense() {
  const plan = useBattlePlan()
  return (
    <>
      {plan.map((t) => (
        <Tower key={t.slot} slot={t.slot} kind={t.kind} level={t.level} target={t.target} />
      ))}
    </>
  )
}
`,
  hints: [
    'Ton hook commence comme un composant : `const { currentWave, nextWave } = useGame()`, puis un `useState` et un `useEffect`. Il renvoie `planFor(…)` au lieu de JSX.',
    'La menace, c’est `currentWave ?? nextWave` (pendant une vague, `nextWave` décrit déjà la suivante). Les boss, eux, se comptent : `const [bossesAlive, setBossesAlive] = useState(0)` (la dernière vague en envoie deux).',
    'Pour le boss : dans un `useEffect(…, [])`, abonne-toi à `onGameEvent(\'enemySpawn\', ({ enemy }) => { if (enemy?.kind === \'boss\') { setBossesAlive((n) => n + 1); castSpell(\'freeze\'); castSpell(\'meteor\') } })`, fais de même pour `enemyKilled` et `enemyLeaked` (→ `n - 1`), passe `bossesAlive > 0` à `planFor` et renvoie une fonction qui appelle tous les désabonnements.',
  ],
  objectives: [
    {
      id: 'hook-defined',
      label: 'Définir un hook personnalisé `useXxx()`',
      check: (ctx) => customHook(ctx) !== null,
    },
    {
      id: 'hook-called',
      label: 'Appeler ton hook dans ton composant',
      check: (ctx) => {
        const hook = customHook(ctx)
        if (!hook) return false
        const calls = (ctx.codeNoComments.match(new RegExp(`\\b${hook.name}\\s*\\(`, 'g')) ?? []).length
        return calls >= (hook.arrow ? 1 : 2)
      },
    },
    {
      id: 'hook-uses-hooks',
      label: 'Au moins 2 hooks React différents dans ton hook',
      check: (ctx) => {
        const hook = customHook(ctx)
        if (!hook) return false
        return REACT_HOOKS.filter((h) => new RegExp(`\\b${h}\\s*[<(]`).test(hook.body)).length >= 2
      },
    },
    {
      id: 'boss-events',
      label: 'Réagir à l’arrivée du boss avec `onGameEvent` et un sort',
      check: (ctx) =>
        has(ctx, /onGameEvent\(\s*['"]enemySpawn['"]/) && ctx.stats.spellsCast.freeze + ctx.stats.spellsCast.meteor >= 1,
    },
    {
      id: 'boss-slain',
      label: 'Terrasser le Seigneur ombre',
      check: (ctx) => ctx.victory,
    },
  ],
  game: {
    map: BATTLE_MAP,
    startGold: 400,
    lives: 5,
    allowedTowers: ['archer', 'cannon', 'mage'],
    spells: ['freeze', 'meteor'],
    breakTime: 4,
    // Ennemis renforcés : seule une défense qui s'adapte à chaque vague tient le choc.
    waves: [
      { groups: [{ kind: 'grunt', count: 16, interval: 0.8, hpScale: 3 }] },
      { groups: [{ kind: 'flyer', count: 22, interval: 0.6, hpScale: 3 }] },
      { groups: [{ kind: 'tank', count: 9, interval: 1.8, hpScale: 3 }] },
      {
        groups: [
          { kind: 'flyer', count: 22, interval: 0.5, hpScale: 3.9 },
          { kind: 'runner', count: 14, interval: 0.6, delay: 3, hpScale: 3 },
        ],
      },
      { groups: [{ kind: 'tank', count: 12, interval: 1.5, hpScale: 3.9 }] },
      {
        groups: [
          { kind: 'boss', count: 1, interval: 1, hpScale: 3 },
          { kind: 'flyer', count: 18, interval: 0.8, delay: 6, hpScale: 3.9 },
        ],
      },
      {
        groups: [
          { kind: 'boss', count: 2, interval: 22, hpScale: 3.6 },
          { kind: 'flyer', count: 24, interval: 0.7, delay: 4, hpScale: 4.2 },
          { kind: 'tank', count: 6, interval: 3, delay: 8, hpScale: 3.9 },
        ],
      },
    ],
  },
}
