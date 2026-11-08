import { has } from './checks'
import { MEADOW } from './maps'
import type { LevelDefinition } from './types'

export const level02: LevelDefinition = {
  id: '02-props',
  number: 2,
  title: 'Le bon outil',
  concept: 'Props & fragments',
  summary: 'Configure tes tours grâce aux props et renvoie plusieurs éléments.',
  lesson: `
## Les props : les paramètres d'un composant

Les attributs que tu écris sur une balise s'appellent des **props** (propriétés).
Elles permettent de **configurer** un composant, comme les arguments d'une fonction :

\`\`\`tsx
<Tower slot="B" kind="cannon" />
\`\`\`

Ici, \`slot\` et \`kind\` sont deux props.

## Chaînes et expressions

- Une **chaîne de caractères** s'écrit entre guillemets : \`kind="mage"\`
- Toute autre valeur JavaScript (nombre, variable, calcul…) s'écrit entre **accolades** :

\`\`\`tsx
<Tower slot="B" kind="archer" level={2} />
\`\`\`

\`level={2}\` passe le **nombre** 2, alors que \`level="2"\` passerait le *texte* "2" —
TypeScript te signalera l'erreur !

## Renvoyer plusieurs éléments : le fragment

Un composant ne peut renvoyer **qu'un seul élément racine**. Pour en renvoyer plusieurs,
on les enveloppe dans un **fragment** \`<>…</>\`, qui n'ajoute rien à l'écran :

\`\`\`tsx
return (
  <>
    <Tower slot="A" kind="archer" />
    <Tower slot="B" kind="cannon" />
  </>
)
\`\`\`

> 💡 Les parenthèses autour du JSX multi-lignes évitent les pièges du \`return\` seul sur sa ligne.

## Connaître ses tours

| Tour | Coût | Particularité |
|---|---|---|
| \`archer\` | 50 | rapide, touche les volants |
| \`cannon\` | 80 | zone, perce l'armure, **ne touche pas les volants** |

Chaque niveau supplémentaire (\`level\`) augmente les dégâts mais coûte plus cher.
`,
  mission: `Une nuée de **chauves-souris** et des gobelins arrivent. Le canon ne peut rien contre les volants !
Renvoie **plusieurs tours** dans un fragment, dont au moins une tour d'archer **de niveau 2**.`,
  starterCode: `import { Tower } from 'game'

export default function Defense() {
  // Le canon ne touche pas les volants…
  // TODO : renvoie plusieurs tours dans un fragment <>…</>
  // et passe level={2} à une tour d'archer.
  return <Tower slot="B" kind="cannon" />
}
`,
  solution: `import { Tower } from 'game'

export default function Defense() {
  return (
    <>
      <Tower slot="A" kind="archer" level={2} />
      <Tower slot="B" kind="archer" />
      <Tower slot="C" kind="cannon" />
    </>
  )
}
`,
  hints: [
    'Un composant ne renvoie qu’un seul élément : enveloppe tes tours dans `<>` et `</>`.',
    'Les nombres se passent entre accolades : `level={2}`. Pense à remplacer le canon par des archers pour les volants.',
    'Par exemple : `return (<><Tower slot="A" kind="archer" level={2} /><Tower slot="B" kind="archer" /></>)`',
  ],
  objectives: [
    {
      id: 'fragment',
      label: 'Utiliser un fragment `<>…</>`',
      check: (ctx) => has(ctx, /<>/) || has(ctx, /<(React\.)?Fragment\b/),
    },
    {
      id: 'level-prop',
      label: 'Passer un nombre en prop : `level={2}`',
      check: (ctx) => ctx.towers.some((t) => t.kind === 'archer' && t.level >= 2) && has(ctx, /level=\{/),
    },
    {
      id: 'two-towers',
      label: 'Au moins deux tours actives en même temps',
      check: (ctx) => ctx.stats.maxActiveTowers >= 2,
    },
  ],
  game: {
    map: MEADOW,
    startGold: 220,
    lives: 6,
    allowedTowers: ['archer', 'cannon'],
    waves: [
      { groups: [{ kind: 'flyer', count: 8, interval: 1.2 }] },
      {
        groups: [
          { kind: 'grunt', count: 8, interval: 1.0 },
          { kind: 'flyer', count: 8, interval: 1.3, delay: 2 },
        ],
      },
    ],
  },
}
