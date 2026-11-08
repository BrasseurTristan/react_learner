import { has } from './checks'
import { MEADOW } from './maps'
import type { LevelDefinition } from './types'

export const level01: LevelDefinition = {
  id: '01-jsx',
  number: 1,
  title: 'Premier rempart',
  concept: 'Composants & JSX',
  summary: 'Écris ton tout premier composant React et pose une tour.',
  lesson: `
## Un composant, c'est une fonction

En React, toute l'interface est faite de **composants**. Un composant est simplement une
**fonction** dont le nom commence par une majuscule et qui **renvoie du JSX** :

\`\`\`tsx
function Salut() {
  return <h1>Bonjour !</h1>
}
\`\`\`

## Le JSX

Le JSX ressemble à du HTML, mais c'est du JavaScript déguisé. \`<h1>Bonjour</h1>\` devient
en réalité un appel de fonction qui décrit *ce qu'on veut voir à l'écran*.

Les balises qui commencent par une **minuscule** (\`<div>\`, \`<p>\`) sont des éléments HTML.
Celles qui commencent par une **majuscule** (\`<Tower />\`) sont des **composants**.

Une balise sans enfant doit se fermer elle-même avec \`/>\` :

\`\`\`tsx
<Tower slot="A" kind="archer" />
\`\`\`

## Importer et exporter

On importe les composants dont on a besoin et on **exporte** le sien :

\`\`\`tsx
import { Tower } from 'game'

export default function Defense() {
  return <Tower slot="A" kind="archer" />
}
\`\`\`

\`export default\` indique au jeu *quel* composant afficher.

> 💡 Dans ce jeu, le composant \`<Tower />\` construit une tour sur le plateau 3D
> tant qu'il est affiché. Ton code **est** ta défense !
`,
  mission: `Des gobelins approchent ! Fais en sorte que ton composant \`Defense\` **renvoie une tour d'archer** sur l'emplacement **A**.`,
  starterCode: `import { Tower } from 'game'

// Un composant React est une fonction qui renvoie du JSX.
export default function Defense() {
  // TODO : renvoie une tour d'archer sur le slot "A"
  // Exemple de JSX : <Tower slot="A" kind="archer" />
  return null
}
`,
  solution: `import { Tower } from 'game'

export default function Defense() {
  return <Tower slot="A" kind="archer" />
}
`,
  hints: [
    'Ton composant renvoie actuellement `null`, c’est-à-dire « rien ». Il doit renvoyer du JSX.',
    'Remplace `return null` par `return <Tower … />` en précisant le slot et le type de tour.',
    'La réponse : `return <Tower slot="A" kind="archer" />`',
  ],
  objectives: [
    {
      id: 'returns-jsx',
      label: 'Renvoyer du JSX avec `<Tower />`',
      check: (ctx) => has(ctx, /return\s*\(?\s*<Tower\b/),
    },
    {
      id: 'archer-on-a',
      label: 'Une tour d’archer active sur le slot A',
      check: (ctx) => ctx.towers.some((t) => t.slot === 'A' && t.kind === 'archer'),
    },
  ],
  game: {
    map: MEADOW,
    startGold: 60,
    lives: 5,
    allowedTowers: ['archer'],
    waves: [{ groups: [{ kind: 'grunt', count: 7, interval: 2.4 }] }],
  },
}
