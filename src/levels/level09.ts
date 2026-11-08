import { has } from './checks'
import { CANYON } from './maps'
import type { LevelDefinition } from './types'

const MAX_RENDERS = 30

export const level09: LevelDefinition = {
  id: '09-use-ref',
  number: 9,
  title: 'La mémoire du stratège',
  concept: 'useRef',
  summary: 'Mémorise des valeurs entre les événements sans provoquer de rendu, grâce à useRef.',
  lesson: `
## Se souvenir… sans redessiner

Dans le niveau précédent, tes gestionnaires d'événements réagissaient « sur le moment ».
Mais une vraie stratégie a besoin de **mémoire** : combien d'ennemis sont déjà apparus
dans cette vague ? Ai-je déjà lancé mon gel ?

Premier réflexe : \`useState\`. Sauf que **chaque** \`setState\` provoque un **nouveau
rendu** du composant. Compter 60 apparitions, c'est 60 rendus… pour une valeur que tu
n'affiches même pas !

## \`useRef\` : une boîte qui survit aux rendus

\`useRef(valeurInitiale)\` te donne un objet \`{ current: … }\`. React te rend **le même
objet** à chaque rendu, et tu peux modifier \`current\` comme tu veux… en dehors du rendu :

\`\`\`tsx
import { useRef } from 'react'

export default function Defense() {
  const clicks = useRef(0) // { current: 0 }, le même objet à chaque rendu

  function handleClick() {
    clicks.current++     // ✅ modifie la valeur dans un gestionnaire…
    log(clicks.current)  // … elle est conservée d'un clic à l'autre
  }

  return <button onClick={handleClick}>Compter</button>
}
\`\`\`

Modifier \`.current\` **ne déclenche aucun rendu**. C'est exactement ce qu'il faut pour
une valeur « de coulisses » : un compteur, un drapeau, un identifiant de minuteur…

## useState ou useRef ?

| | \`useState\` | \`useRef\` |
|---|---|---|
| La valeur survit aux rendus | ✅ | ✅ |
| La modifier provoque un rendu | ✅ oui | ❌ non |
| Comment la modifier | \`setX(nouvelle)\` | \`ref.current = nouvelle\` |
| À utiliser pour… | ce qui s'**affiche** à l'écran | ce qui sert **en coulisses** |

> ⚠️ Règle d'or : **ne lis ni ne modifie \`ref.current\` pendant le rendu** (dans le corps du
> composant ou dans le JSX). Fais-le dans un **gestionnaire d'événement** ou un **effet**.
> Et comme une ref ne redessine rien, l'afficher dans ton JSX ne montrerait jamais la valeur à jour.

## Le cas typique : un gestionnaire d'événement

Un abonnement créé dans \`useEffect(…, [])\` vit pendant toute la partie. Avec une ref,
le gestionnaire lit et modifie toujours **la valeur à jour** :

\`\`\`tsx
const alreadyCast = useRef(false)

useEffect(() => {
  const offWave = onGameEvent('waveStart', () => {
    alreadyCast.current = false // nouvelle vague : on réarme
  })
  const offSpawn = onGameEvent('enemySpawn', () => {
    if (alreadyCast.current) return // anti double-déclenchement
    alreadyCast.current = true
    castSpell('freeze')
  })
  return () => {
    offWave()
    offSpawn()
  }
}, [])
\`\`\`

## Bonus : une ref vers un élément HTML

\`useRef\` sert aussi à « attraper » un élément du DOM, par exemple pour lui donner le focus :

\`\`\`tsx
const inputRef = useRef<HTMLInputElement>(null)
// …
<input ref={inputRef} />
<button onClick={() => inputRef.current?.focus()}>Écrire</button>
\`\`\`

> 💡 Et une simple variable \`let\` hors du composant ? Elle serait partagée par toutes les
> copies du composant et ne serait jamais remise à zéro quand il est remonté.
> \`useRef\` appartient à **ton** composant, c'est la bonne boîte.
`,
  mission: `Hordes et golems blindés déferlent dans le canyon. Tes deux sorts sont indispensables, mais **aucun sort ne doit être lancé pendant sa recharge** !
Avec des **refs** (et un \`useEffect\` qui s'abonne aux événements) :
- au **10e ennemi apparu** de chaque vague, lance \`castSpell('meteor')\` : toute la horde est alors sur le chemin ;
- au **premier golem** (\`tank\`) de chaque vague, lance \`castSpell('freeze')\`… **une seule fois** par vague ;
- remets tes compteurs à zéro à chaque \`waveStart\`.

Ton composant ne doit pas se ré-afficher plus de ${MAX_RENDERS} fois : pas de \`useState\` ni de \`useGame()\` pour compter !`,
  starterCode: `import { useEffect, useState } from 'react'
import { Tower, castSpell, onGameEvent } from 'game'

export default function Defense() {
  // ❌ Un état provoque un rendu à CHAQUE apparition d'ennemi…
  // TODO : remplace-le par une ref : const spawnCount = useRef(0)
  const [spawnCount, setSpawnCount] = useState(0)
  // TODO : ajoute une seconde ref (un booléen) pour savoir si le gel a déjà été lancé cette vague

  useEffect(() => {
    const offSpawn = onGameEvent('enemySpawn', ({ enemy }) => {
      setSpawnCount((n) => n + 1)
      // TODO : au 10e ennemi de la vague → castSpell('meteor')
      // TODO : au premier tank de la vague (une seule fois !) → castSpell('freeze')
    })
    // TODO : abonne-toi à 'waveStart' pour remettre tes refs à zéro
    return () => offSpawn()
  }, [])

  return (
    <>
      <p>Ennemis apparus : {spawnCount}</p>
      <Tower slot="C" kind="archer" />
      <Tower slot="F" kind="cannon" />
    </>
  )
}
`,
  solution: `import { useEffect, useRef } from 'react'
import { Tower, castSpell, onGameEvent } from 'game'

export default function Defense() {
  const spawnCount = useRef(0)
  const frozenThisWave = useRef(false)

  useEffect(() => {
    const offWave = onGameEvent('waveStart', () => {
      spawnCount.current = 0
      frozenThisWave.current = false
    })
    const offSpawn = onGameEvent('enemySpawn', ({ enemy }) => {
      spawnCount.current++
      if (spawnCount.current === 10) castSpell('meteor')
      if (enemy?.kind === 'tank' && !frozenThisWave.current) {
        frozenThisWave.current = true
        castSpell('freeze')
      }
    })
    return () => {
      offWave()
      offSpawn()
    }
  }, [])

  return (
    <>
      <p>Le stratège veille…</p>
      <Tower slot="C" kind="archer" />
      <Tower slot="F" kind="cannon" />
    </>
  )
}
`,
  hints: [
    'Une valeur qui doit survivre entre deux événements **sans** redessiner le composant ? C’est le travail de `useRef`.',
    'Crée `const spawnCount = useRef(0)` et `const frozenThisWave = useRef(false)`. Dans tes gestionnaires, lis et modifie `spawnCount.current` et `frozenThisWave.current`.',
    'Dans `enemySpawn` : `spawnCount.current++`, puis `if (spawnCount.current === 10) castSpell(\'meteor\')` et `if (enemy?.kind === \'tank\' && !frozenThisWave.current) { frozenThisWave.current = true; castSpell(\'freeze\') }`. Dans `waveStart`, remets les deux refs à zéro.',
  ],
  objectives: [
    {
      id: 'use-ref',
      label: 'Mémoriser avec `useRef` et `.current`',
      check: (ctx) =>
        has(ctx, /\buseRef\s*(<[^>]*>)?\s*\(/) && has(ctx, /\.current\s*(\+\+|--|\+=|-=|=(?!=))/),
    },
    {
      id: 'spells-each-wave',
      label: 'Un météore **et** un gel à chaque vague',
      check: (ctx) =>
        ctx.stats.spellsCast.meteor >= ctx.snapshot.totalWaves && ctx.stats.spellsCast.freeze >= ctx.snapshot.totalWaves,
    },
    {
      id: 'no-wasted-spell',
      label: 'Aucun sort lancé pendant sa recharge',
      check: (ctx) => ctx.stats.spellsFailed === 0 && ctx.stats.spellsCast.freeze + ctx.stats.spellsCast.meteor > 0,
    },
    {
      id: 'few-renders',
      label: `Au plus ${MAX_RENDERS} rendus de ton composant`,
      check: (ctx) => ctx.renderCount > 0 && ctx.renderCount <= MAX_RENDERS,
    },
  ],
  game: {
    map: CANYON,
    startGold: 130,
    lives: 8,
    allowedTowers: ['archer', 'cannon', 'mage', 'frost'],
    spells: ['freeze', 'meteor'],
    breakTime: 5,
    waves: [
      {
        groups: [
          { kind: 'grunt', count: 16, interval: 0.4, hpScale: 1.3 },
          { kind: 'tank', count: 4, interval: 2, delay: 8 },
        ],
      },
      {
        groups: [
          { kind: 'runner', count: 14, interval: 0.25, hpScale: 1.3 },
          { kind: 'grunt', count: 10, interval: 0.4, delay: 4, hpScale: 1.3 },
          { kind: 'tank', count: 4, interval: 2, delay: 9 },
        ],
      },
      {
        groups: [
          { kind: 'grunt', count: 16, interval: 0.4 },
          { kind: 'flyer', count: 8, interval: 0.6, delay: 5 },
          { kind: 'tank', count: 4, interval: 2, delay: 9 },
        ],
      },
    ],
  },
}
