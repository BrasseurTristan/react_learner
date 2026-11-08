import { has, hasTernary } from './checks'
import { MEADOW } from './maps'
import type { LevelDefinition } from './types'

export const level05: LevelDefinition = {
  id: '05-conditional',
  number: 5,
  title: 'Ciel ou acier',
  concept: 'Rendu conditionnel & useGame',
  summary: 'Lis l’état de la partie et adapte tes tours à chaque vague.',
  lesson: `
## Lire l'état de la partie : \`useGame()\`

Jusqu'ici, ta défense était **figée** : les mêmes tours du début à la fin. Mais un bon
stratège s'adapte ! Le module \`game\` fournit une fonction spéciale, \`useGame()\`, qui
renvoie l'**état actuel** de la partie :

\`\`\`tsx
import { Tower, useGame } from 'game'

export default function Defense() {
  const game = useGame()
  // game.phase   → 'build' | 'wave' | 'break' | 'victory' | 'defeat'
  // game.wave    → numéro de la vague en cours
  // game.enemies → les ennemis sur le plateau (avec .flying, .armored…)
  // game.lives, game.gold, game.nextWave…
}
\`\`\`

À chaque changement dans la partie, ton composant est **ré-exécuté** (on dit qu'il se
**ré-affiche**, ou « re-render ») avec les nouvelles valeurs. Tu n'as rien à faire :
tu décris ce que tu veux *en fonction de l'état*, React s'occupe du reste.

## C'est quoi, un hook ?

\`useGame\` est un **hook** : une fonction dont le nom commence par \`use\` et qui
« accroche » ton composant à quelque chose (ici, l'état du jeu). Deux règles à retenir :

1. On appelle un hook **au premier niveau du composant**, jamais dans un \`if\`, une boucle ou une
   fonction imbriquée (ni après un \`return\` anticipé).
2. On ne l'appelle **que dans un composant** (ou dans un autre hook).

Tu découvriras d'autres hooks très bientôt (\`useState\`, \`useEffect\`…).

## Afficher… ou pas : \`&&\`

Petit rappel : ton composant peut renvoyer, en plus des tours, des éléments HTML comme \`<p>\`.
Ils s'affichent dans le panneau **« Ton composant »**, à côté du plateau : pratique pour te
laisser des messages !

Pour afficher un élément **seulement si** une condition est vraie, on utilise \`&&\` :

\`\`\`tsx
{game.phase === 'break' && <p>Pause : prépare la suite !</p>}
\`\`\`

Si la condition est fausse, React n'affiche rien. Si elle est vraie, il affiche ce qui suit
le \`&&\`. Avec une \`<Tower />\`, ça veut dire : la tour **existe** tant que la condition est vraie,
et elle est **démontée** (et remboursée !) dès qu'elle devient fausse.

> ⚠️ Piège classique : \`{count && <p>…</p>}\` affiche **0** quand \`count\` vaut 0.
> Utilise toujours une vraie condition booléenne : \`{count > 0 && …}\`.

## Choisir entre deux options : le ternaire

Pour choisir entre **deux** possibilités, on utilise l'opérateur ternaire
\`condition ? siVrai : siFaux\` :

\`\`\`tsx
<Tower slot="A" kind={danger ? 'archer' : 'cannon'} />

{danger ? <p>🦇 Alerte !</p> : <p>Tout est calme.</p>}
\`\`\`

## Calculer une condition

Prépare tes conditions dans des variables, avant le \`return\` : c'est plus lisible.
\`.some()\` renvoie \`true\` si **au moins un** élément du tableau vérifie la condition :

\`\`\`tsx
const flyers = game.enemies.some((enemy) => enemy.flying)
\`\`\`

> 🚫 Ne conditionne **jamais** une tour sur \`game.gold\` : construire la tour fait baisser l'or,
> donc la condition devient fausse, la tour est démontée, l'or remonte… et ça recommence à l'infini !

## Rappel des tours

| Tour | Volants | Blindés |
|---|---|---|
| \`archer\` | ✅ touche | ❌ dégâts réduits à 30 % |
| \`cannon\` | ❌ ne touche pas | ✅ perce l'armure |
`,
  mission: `Les vagues alternent entre **chauves-souris** et **golems blindés**, et ton or ne suffit pas
à tout couvrir en même temps. Utilise \`useGame()\` et le **rendu conditionnel** (\`&&\` et ternaire)
pour construire les bonnes tours au bon moment.`,
  starterCode: `import { Tower } from 'game'

const SLOTS = ['A', 'B', 'C', 'D', 'E']

export default function Defense() {
  // TODO : lis l'état de la partie avec useGame()
  //        puis calcule une condition, par ex. :
  //        const flyers = game.enemies.some((enemy) => enemy.flying)
  // TODO : choisis le type de tour avec un ternaire : kind={flyers ? 'archer' : 'cannon'}
  // TODO : affiche un message avec && (par ex. pendant game.phase === 'break')
  return (
    <>
      {SLOTS.map((slot) => (
        <Tower key={slot} slot={slot} kind="cannon" level={2} />
      ))}
    </>
  )
}
`,
  solution: `import { Tower, useGame } from 'game'

const SLOTS = ['A', 'B', 'C', 'D', 'E']

export default function Defense() {
  const game = useGame()
  const flyers = game.enemies.some((enemy) => enemy.flying)

  return (
    <>
      <p>{flyers ? '🦇 Volants en approche : place aux archers !' : '🛡️ Défense au sol : canons prêts.'}</p>
      {game.phase === 'break' && <p>Pause : la prochaine vague arrive…</p>}
      {SLOTS.map((slot) => (
        <Tower key={slot} slot={slot} kind={flyers ? 'archer' : 'cannon'} level={flyers ? 3 : 2} />
      ))}
    </>
  )
}
`,
  hints: [
    'Commence par `const game = useGame()` en haut du composant (pense à importer `useGame` depuis `\'game\'`).',
    'Calcule `const flyers = game.enemies.some((enemy) => enemy.flying)`, puis utilise `kind={flyers ? \'archer\' : \'cannon\'}` sur tes tours.',
    'Il manque un `&&` ? Ajoute par exemple `{game.phase === \'break\' && <p>Pause…</p>}` dans ton fragment. Les archers coûtant moins cher, tu peux même les monter plus haut : `level={flyers ? 3 : 2}`.',
  ],
  objectives: [
    {
      id: 'use-game',
      label: 'Lire la partie avec `useGame()`',
      check: (ctx) => has(ctx, /\buseGame\s*\(\s*\)/),
    },
    {
      id: 'and',
      label: 'Afficher un élément avec `&&`',
      check: (ctx) => has(ctx, /&&\s*\(?\s*</),
    },
    {
      id: 'ternary',
      label: 'Choisir avec un ternaire `? :`',
      check: (ctx) => hasTernary(ctx),
    },
    {
      id: 'adapt',
      label: 'Utiliser des **archers** et des **canons** au fil de la partie',
      check: (ctx) => ctx.stats.towerKindsUsed.includes('archer') && ctx.stats.towerKindsUsed.includes('cannon'),
    },
  ],
  game: {
    map: MEADOW,
    startGold: 700,
    lives: 8,
    allowedTowers: ['archer', 'cannon'],
    breakTime: 4,
    waves: [
      { groups: [{ kind: 'flyer', count: 18, interval: 0.55, hpScale: 1.7 }] },
      { groups: [{ kind: 'tank', count: 10, interval: 1.1, hpScale: 1.5 }] },
      { groups: [{ kind: 'flyer', count: 22, interval: 0.45, hpScale: 2 }] },
      { groups: [{ kind: 'tank', count: 12, interval: 0.95, hpScale: 2 }] },
    ],
  },
}
