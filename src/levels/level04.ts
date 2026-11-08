import { count, has } from './checks'
import { CANYON } from './maps'
import type { LevelDefinition } from './types'

export const level04: LevelDefinition = {
  id: '04-lists-keys',
  number: 4,
  title: 'Le canyon fortifié',
  concept: 'Listes & keys',
  summary: 'Génère toute une ligne de défense à partir d’un tableau avec `.map()`.',
  lesson: `
## Afficher une liste

Le canyon est long : il va te falloir **beaucoup** de tours. Les écrire une par une serait
long, répétitif… et source d'erreurs. En React, quand on a une **liste de données**, on la
transforme en **liste d'éléments JSX** avec la méthode \`.map()\` des tableaux.

Rappel JavaScript : \`.map()\` crée un nouveau tableau en appliquant une fonction à chaque élément.

\`\`\`ts
const nombres = [1, 2, 3]
const doubles = nombres.map((n) => n * 2) // [2, 4, 6]
\`\`\`

En JSX, c'est pareil, sauf que la fonction renvoie… du JSX :

\`\`\`tsx
const slots = ['A', 'B', 'C']

return (
  <>
    {slots.map((slot) => (
      <Tower key={slot} slot={slot} kind="archer" />
    ))}
  </>
)
\`\`\`

Les **accolades** \`{ }\` permettent d'insérer une expression JavaScript dans le JSX.
React sait afficher un **tableau d'éléments** : chaque élément devient une tour.

## Une liste d'objets

Souvent, chaque élément de la liste porte plusieurs informations. On utilise alors un
tableau d'**objets**, et TypeScript nous aide à décrire leur forme :

\`\`\`tsx
type Post = { slot: string; kind: TowerKind }

const POSTS: Post[] = [
  { slot: 'A', kind: 'archer' },
  { slot: 'B', kind: 'cannon' },
]

{POSTS.map((post) => (
  <Tower key={post.slot} slot={post.slot} kind={post.kind} />
))}
\`\`\`

\`Post[]\` se lit « un tableau de \`Post\` ».

## Pourquoi la prop \`key\` ?

Quand une liste change (un élément ajouté, retiré, déplacé), React doit savoir **quel
élément est lequel** d'un rendu à l'autre. La \`key\` est son « numéro d'identité ».

- Sans \`key\`, React affiche un avertissement et se repère à la **position** : si tu retires
  le premier élément, il croit que *tous* les autres ont changé.
- La \`key\` doit être **unique** parmi ses frères et **stable** : ici, l'identifiant du slot
  est parfait, car deux tours ne partagent jamais le même slot.
- Évite l'index (\`map((post, i) => <Tower key={i} … />)\`) : si l'ordre change, les
  identités se mélangent. Dans ce jeu, une tour qui « change d'identité » est démolie
  puis reconstruite !

> 💡 La \`key\` se met sur l'élément **renvoyé directement** par la fonction du \`.map()\`.
> Ce n'est pas une vraie prop : le composant \`Tower\` ne la reçoit jamais.
`,
  mission: `Le canyon serpente et les ennemis arrivent en masse : il faut **au moins 6 tours**.
Décris tes tours dans un **tableau** et génère-les avec \`.map()\`, chacune avec une \`key\` stable.
Pas plus de **deux** \`<Tower>\` écrits à la main !`,
  starterCode: `import { Tower, type TowerKind } from 'game'

type Post = { slot: string; kind: TowerKind }

// Le canyon offre 8 emplacements : A, B, C, D, E, F, G, H.
// TODO : complète ce tableau (au moins 6 postes, archers et canons)
const POSTS: Post[] = [
  { slot: 'A', kind: 'archer' },
  { slot: 'B', kind: 'cannon' },
]

export default function Defense() {
  // TODO : remplace cette tour unique par POSTS.map(...)
  // sans oublier la prop key !
  return <Tower slot="A" kind="archer" />
}
`,
  solution: `import { Tower, type TowerKind } from 'game'

type Post = { slot: string; kind: TowerKind }

const POSTS: Post[] = [
  { slot: 'A', kind: 'archer' },
  { slot: 'B', kind: 'cannon' },
  { slot: 'C', kind: 'archer' },
  { slot: 'D', kind: 'cannon' },
  { slot: 'E', kind: 'archer' },
  { slot: 'F', kind: 'cannon' },
  { slot: 'G', kind: 'archer' },
  { slot: 'H', kind: 'archer' },
]

export default function Defense() {
  return (
    <>
      {POSTS.map((post) => (
        <Tower key={post.slot} slot={post.slot} kind={post.kind} />
      ))}
    </>
  )
}
`,
  hints: [
    'Ajoute d’abord tous les postes dans le tableau `POSTS`, puis transforme ce tableau en tours avec `.map()`.',
    'Dans le JSX, insère l’expression entre accolades : `{POSTS.map((post) => <Tower … />)}`. Chaque tour a besoin de `key={post.slot}`.',
    'La réponse : `return (<>{POSTS.map((post) => (<Tower key={post.slot} slot={post.slot} kind={post.kind} />))}</>)` avec au moins 6 postes dans `POSTS`.',
  ],
  objectives: [
    {
      id: 'map',
      label: 'Générer les tours avec `.map()`',
      check: (ctx) => has(ctx, /\.map\(\s*\(?[^)]*\)?\s*=>\s*\(?\s*<Tower\b/),
    },
    {
      id: 'key',
      label: 'Donner une `key` stable à chaque tour (pas l’index)',
      check: (ctx) =>
        has(ctx, /<Tower\b[^>]*\bkey=\{/) && !has(ctx, /key=\{\s*(i|idx|index)\s*\}/) && !has(ctx, /\.map\(\s*\(\s*\w+\s*,\s*(\w+)\s*\)[^]*key=\{\s*\1\s*\}/),
    },
    {
      id: 'few-handwritten',
      label: 'Au plus **2** `<Tower>` écrits à la main',
      check: (ctx) => count(ctx, /<Tower\b/) <= 2,
    },
    {
      id: 'six-towers',
      label: 'Au moins **6 tours** actives en même temps',
      check: (ctx) => ctx.stats.maxActiveTowers >= 6,
    },
  ],
  game: {
    map: CANYON,
    startGold: 360,
    lives: 10,
    allowedTowers: ['archer', 'cannon'],
    waves: [
      { groups: [{ kind: 'grunt', count: 20, interval: 0.55, hpScale: 1.3 }] },
      {
        groups: [
          { kind: 'runner', count: 18, interval: 0.45, hpScale: 1.6 },
          { kind: 'flyer', count: 14, interval: 0.6, delay: 2, hpScale: 1.6 },
        ],
      },
      {
        groups: [
          { kind: 'tank', count: 8, interval: 1.4, hpScale: 1.5 },
          { kind: 'grunt', count: 24, interval: 0.4, delay: 1, hpScale: 1.6 },
        ],
      },
      {
        groups: [
          { kind: 'flyer', count: 18, interval: 0.5, hpScale: 1.7 },
          { kind: 'tank', count: 6, interval: 1.6, delay: 2, hpScale: 1.5 },
          { kind: 'runner', count: 20, interval: 0.4, delay: 5, hpScale: 1.8 },
        ],
      },
    ],
  },
}
