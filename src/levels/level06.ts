import { has } from './checks'
import { CANYON } from './maps'
import type { MapDef } from '../engine/types'
import type { LevelDefinition, PlaytestApi } from './types'

/** Le canyon, réduit à quatre emplacements : impossible d'ajouter des tours, il faut les améliorer. */
const FORGE_CANYON: MapDef = {
  ...CANYON,
  slots: CANYON.slots.filter((s) => ['B', 'C', 'F', 'G'].includes(s.id)),
}

/** Coût d'une amélioration des quatre mages (77 pièces chacun). */
const UPGRADE_COST = 4 * 77

export const level06: LevelDefinition = {
  id: '06-usestate',
  number: 6,
  title: 'La forge',
  concept: 'useState & événements',
  summary: 'Ajoute un bouton qui améliore tes tours en pleine partie grâce à `useState`.',
  lesson: `
## Ton composant peut aussi afficher une interface

Ton composant ne se limite pas aux tours : tout le JSX HTML que tu renvoies (\`<p>\`,
\`<button>\`…) apparaît dans le panneau **« Ton composant »**. Tu peux donc te fabriquer
un vrai tableau de bord !

## Réagir à un clic : \`onClick\`

On passe une **fonction** à la prop \`onClick\` d'un bouton. React l'appellera à chaque clic :

\`\`\`tsx
function handleClick() {
  log('Clic !')
}

<button onClick={handleClick}>Clique-moi</button>
// ou directement, avec une fonction fléchée :
<button onClick={() => log('Clic !')}>Clique-moi</button>
\`\`\`

> ⚠️ \`onClick={handleClick}\` passe la fonction. \`onClick={handleClick()}\` l'**appelle**
> immédiatement pendant l'affichage… et lui passe son résultat. Ce n'est pas ce qu'on veut !

## Pourquoi une simple variable ne suffit pas

Essayons de compter les clics avec une variable :

\`\`\`tsx
export default function Defense() {
  let level = 1
  return <button onClick={() => { level = level + 1 }}>Niveau {level}</button>
}
\`\`\`

Rien ne bouge à l'écran ! Deux raisons :

1. Modifier une variable **ne prévient pas React** qu'il faut ré-afficher le composant.
2. Même s'il ré-affichait, la fonction \`Defense\` serait ré-exécutée depuis le début…
   et \`let level = 1\` remettrait tout à zéro.

## La solution : \`useState\`

\`useState\` est le hook qui donne une **mémoire** à ton composant :

\`\`\`tsx
import { useState } from 'react'

export default function Defense() {
  const [level, setLevel] = useState(1)
  return <button onClick={() => setLevel(level + 1)}>Niveau {level}</button>
}
\`\`\`

- \`useState(1)\` crée un état dont la **valeur initiale** est \`1\`.
- Il renvoie un tableau de deux éléments, qu'on déstructure : la **valeur actuelle**
  (\`level\`) et une **fonction pour la modifier** (\`setLevel\`).
- Appeler \`setLevel(…)\` enregistre la nouvelle valeur **et** demande à React de
  ré-afficher le composant. Au rendu suivant, \`level\` vaut la nouvelle valeur.

TypeScript devine tout seul que \`level\` est un \`number\`, grâce à la valeur initiale.

## La mise à jour fonctionnelle

Quand la nouvelle valeur **dépend de l'ancienne**, passe plutôt une **fonction** à \`setLevel\` :

\`\`\`tsx
setLevel((l) => l + 1)
\`\`\`

React appelle ta fonction avec la valeur **la plus récente** et utilise ce qu'elle renvoie.
Pourquoi ? Parce que \`level\` est une **photo** prise au moment du rendu. Si tu fais :

\`\`\`tsx
setLevel(level + 1)
setLevel(level + 1) // level vaut toujours l'ancienne valeur ici : on n'ajoute que 1 !
\`\`\`

…alors qu'avec \`setLevel((l) => l + 1)\` deux fois de suite, on ajoute bien 2.

## Désactiver un bouton

L'attribut \`disabled\` empêche de cliquer quand ça n'a pas de sens :

\`\`\`tsx
<button onClick={() => setLevel((l) => l + 1)} disabled={level >= 3}>
  Améliorer
</button>
\`\`\`

> 💡 Tu peux afficher l'or avec \`useGame()\` (\`<p>Or : {game.gold}</p>\`) pour savoir quand
> cliquer. Une amélioration trop tôt, sans assez d'or, met tes tours **en attente** !

## Le mage

Dans la forge, seul le **mage** est disponible : il touche les volants **et** perce les
blindages. Il coûte 110 pièces, et chaque niveau supplémentaire en coûte **77** de plus.
Le niveau maximal est **3** : au-delà, la tour est refusée.
`,
  mission: `La forge n'a que **quatre emplacements** et ton or ne paie que des mages de **niveau 1**,
mais les vagues deviennent redoutables. Ajoute un bouton **« Améliorer »** qui augmente le niveau
de tes tours grâce à \`useState\`, et clique dessus **pendant la partie** — même en pleine vague —
dès que tu as assez d'or (${UPGRADE_COST} pièces par amélioration). Objectif : le **niveau 3**.`,
  starterCode: `import { Tower, log } from 'game'

// Les quatre emplacements de la forge.
const SLOTS = ['B', 'C', 'F', 'G']

export default function Defense() {
  // ❌ Une variable normale : modifiée au clic, mais React ne ré-affiche rien
  //    et elle repart à 1 à chaque rendu.
  // TODO : remplace-la par un état : const [level, setLevel] = useState(1)
  //        (sans oublier d'importer useState depuis 'react')
  let level = 1

  function upgrade() {
    level = level + 1
    log('Niveau demandé : ' + level)
  }

  return (
    <>
      <p>Niveau des tours : {level}</p>
      {/* TODO : utilise une mise à jour fonctionnelle et désactive le bouton au niveau 3 */}
      <button onClick={upgrade}>Améliorer</button>
      {SLOTS.map((slot) => (
        <Tower key={slot} slot={slot} kind="mage" level={level} />
      ))}
    </>
  )
}
`,
  solution: `import { useState } from 'react'
import { Tower, useGame } from 'game'

// Les quatre emplacements de la forge.
const SLOTS = ['B', 'C', 'F', 'G']

export default function Defense() {
  const [level, setLevel] = useState(1)
  const game = useGame()

  return (
    <>
      <p>Or : {game.gold} — niveau des tours : {level} / 3</p>
      <button onClick={() => setLevel((l) => Math.min(l + 1, 3))} disabled={level >= 3}>
        Améliorer
      </button>
      {SLOTS.map((slot) => (
        <Tower key={slot} slot={slot} kind="mage" level={level} />
      ))}
    </>
  )
}
`,
  hints: [
    'Une variable déclarée avec `let` est oubliée à chaque rendu : il te faut un **état** React.',
    'Écris `const [level, setLevel] = useState(1)` (avec `import { useState } from \'react\'`), puis `onClick={() => setLevel((l) => l + 1)}`.',
    `Ajoute \`disabled={level >= 3}\` au bouton, lance la partie, et clique sur « Améliorer » chaque fois que tu as au moins ${UPGRADE_COST} pièces d’or.`,
  ],
  objectives: [
    {
      id: 'use-state',
      label: 'Mémoriser le niveau avec `useState`',
      check: (ctx) => has(ctx, /\buseState\b[^(]*\(/) && has(ctx, /import\s*\{[^}]*\buseState\b[^}]*\}\s*from\s*['"]react['"]/),
    },
    {
      id: 'on-click',
      label: 'Un bouton avec `onClick`',
      check: (ctx) => has(ctx, /<button\b[^>]*\bonClick=\{/),
    },
    {
      id: 'functional-update',
      label: 'Mise à jour fonctionnelle : `setX((x) => …)`',
      check: (ctx) => has(ctx, /\bset[A-Z]\w*\(\s*(\(\s*\w+\s*\)|\w+)\s*=>/),
    },
    {
      id: 'level-3',
      label: 'Améliorer tes tours jusqu’au **niveau 3**',
      check: (ctx) => ctx.stats.maxTowerLevel >= 3,
    },
  ],
  game: {
    map: FORGE_CANYON,
    startGold: 450,
    lives: 8,
    allowedTowers: ['mage'],
    breakTime: 4,
    waves: [
      { groups: [{ kind: 'grunt', count: 24, interval: 0.6 }] },
      {
        groups: [
          { kind: 'grunt', count: 24, interval: 0.5, hpScale: 1.4 },
          { kind: 'flyer', count: 12, interval: 0.7, delay: 3, hpScale: 1.4 },
        ],
      },
      {
        groups: [
          { kind: 'tank', count: 8, interval: 1.4, hpScale: 1.6 },
          { kind: 'flyer', count: 14, interval: 0.6, delay: 2, hpScale: 2 },
        ],
      },
      {
        groups: [
          { kind: 'tank', count: 8, interval: 1.4, hpScale: 2 },
          { kind: 'flyer', count: 14, interval: 0.6, delay: 2, hpScale: 2 },
          { kind: 'grunt', count: 16, interval: 0.5, delay: 5, hpScale: 2.2 },
        ],
      },
    ],
  },
  playtest: (ui: PlaytestApi) => {
    // Comme un joueur humain : on clique sur « Améliorer » quand on a de quoi payer,
    // avec un temps de réaction d'environ 2 secondes.
    if (ui.phase === 'victory' || ui.phase === 'defeat') return
    if (ui.snapshot.gold < UPGRADE_COST) {
      ui.memory.since = undefined
      return
    }
    const since = typeof ui.memory.since === 'number' ? ui.memory.since : ui.time
    ui.memory.since = since
    if (ui.time - since >= 2 && ui.click('Améliorer')) ui.memory.since = undefined
  },
}
