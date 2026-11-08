import { count, has } from './checks'
import { MEADOW } from './maps'
import type { CheckContext, LevelDefinition } from './types'

/** Corps de chaque useEffect du joueur (approximation suffisante pour des regex d'objectifs). */
function effectBodies(ctx: CheckContext): string[] {
  const code = ctx.codeNoComments
  const bodies: string[] = []
  const re = /useEffect\s*\(/g
  let m: RegExpExecArray | null
  while ((m = re.exec(code))) {
    let depth = 1
    let i = m.index + m[0].length
    const start = i
    while (i < code.length && depth > 0) {
      if (code[i] === '(') depth++
      else if (code[i] === ')') depth--
      i++
    }
    bodies.push(code.slice(start, i - 1))
  }
  return bodies
}

export const level08: LevelDefinition = {
  id: '08-use-effect',
  number: 8,
  title: 'Les sentinelles',
  concept: 'useEffect & nettoyage',
  summary: 'Abonne-toi aux événements du jeu avec useEffect… et pense à te désabonner !',
  lesson: `
## Les effets : agir **en dehors** du rendu

Un composant React doit rester **pur** : à partir de ses props et de son état, il
*décrit* ce qu'il faut afficher, sans rien modifier autour de lui. Mais parfois, il faut
bien parler au monde extérieur : lancer un minuteur, écouter un événement, appeler une API…
On appelle ça des **effets de bord**, et ils ont leur propre hook : \`useEffect\`.

\`\`\`tsx
import { useEffect } from 'react'

useEffect(() => {
  // ce code s'exécute APRÈS l'affichage du composant
  log('Ma défense est en place !')
}, [])
\`\`\`

## Le tableau de dépendances

Le second argument dit à React **quand** relancer l'effet :

| Écriture | L'effet s'exécute… |
|---|---|
| \`useEffect(fn, [])\` | une seule fois, à l'apparition du composant |
| \`useEffect(fn, [kind])\` | à l'apparition, puis chaque fois que \`kind\` change |
| \`useEffect(fn)\` | après **chaque** rendu (rarement ce que tu veux !) |

> ⚠️ \`useGame()\` provoque environ **20 rendus par seconde**. Sans tableau de dépendances,
> ton effet serait relancé 20 fois par seconde !

## S'abonner à un événement du jeu

Le module \`game\` propose \`onGameEvent(nom, gestionnaire)\`. Le gestionnaire reçoit un
objet \`{ wave, enemy? }\` :

\`\`\`tsx
onGameEvent('enemySpawn', ({ enemy }) => {
  if (enemy?.kind === 'boss') log('Le boss arrive !')
})
\`\`\`

Événements disponibles : \`waveStart\`, \`waveEnd\`, \`enemySpawn\`, \`enemyKilled\`,
\`enemyLeaked\` (un ennemi atteint ta base), \`victory\`, \`defeat\`.

Et pour riposter, \`castSpell(nom)\` lance un sort (il renvoie \`false\` s'il est en recharge) :

| Sort | Effet | Recharge |
|---|---|---|
| \`'freeze'\` | fige **tous** les ennemis 2,5 s (tes tours, elles, continuent de tirer) | 12 s |
| \`'meteor'\` | 70 dégâts à **chaque** ennemi présent sur le chemin | 18 s |

## Le nettoyage : se désabonner

\`onGameEvent\` **renvoie une fonction** qui annule l'abonnement. Si ta fonction d'effet
**renvoie** une fonction, React l'appelle pour **nettoyer** : quand le composant
disparaît, ou juste avant de relancer l'effet.

\`\`\`tsx
useEffect(() => {
  const unsubscribe = onGameEvent('waveStart', ({ wave }) => log(\`Vague \${wave} !\`))
  return () => unsubscribe() // 🧹 nettoyage
}, [])
\`\`\`

Plusieurs abonnements ? Nettoie-les tous dans la même fonction :

\`\`\`tsx
return () => {
  offA()
  offB()
}
\`\`\`

## Pourquoi c'est indispensable

- **Démontage** : si ton composant disparaît (ou que tu modifies ton code), un abonnement
  oublié continue de tourner dans le vide… et s'accumule à chaque nouvelle version.
- **StrictMode** : en développement, React monte ton composant, le **démonte**, puis le
  **remonte** aussitôt, exprès, pour vérifier que tes effets se nettoient bien. Sans
  nettoyage, tu te retrouves avec deux abonnements : chaque événement déclenche ton
  code **deux fois** !

> 💡 Règle d'or : tout ce qu'un effet **ouvre** (abonnement, minuteur, écouteur…),
> sa fonction de nettoyage le **ferme**.
`,
  mission: `Le **Seigneur ombre** et des hordes d'éclaireurs attaquent. Tes tours ne suffiront pas : il te faut tes **sorts**, au bon moment.
Dans un \`useEffect\`, abonne-toi à deux événements :
- \`enemySpawn\` : si l'ennemi est un **boss**, lance \`castSpell('meteor')\` pour écraser la horde qui le précède ;
- \`enemyLeaked\` : un ennemi a percé ? Fige tout le monde avec \`castSpell('freeze')\` pour laisser tes tours rattraper le coup.

Et n'oublie pas de **te désabonner** dans la fonction de nettoyage !`,
  starterCode: `import { useEffect } from 'react'
import { Tower, useGame, castSpell, onGameEvent, log } from 'game'

export default function Defense() {
  const game = useGame()

  // TODO : dans un useEffect (avec un tableau de dépendances !),
  //  - abonne-toi à 'enemySpawn' : si enemy?.kind === 'boss', lance castSpell('meteor')
  //  - abonne-toi à 'enemyLeaked' : lance castSpell('freeze')
  //  - renvoie une fonction qui appelle les deux fonctions de désabonnement
  useEffect(() => {
    log('Sentinelles en position')
  }, [])

  return (
    <>
      <ul>
        {game.spells.map((s) => (
          <li key={s.name}>
            {s.name} : {s.ready ? 'prêt' : \`\${s.cooldown} s\`}
          </li>
        ))}
      </ul>
      <Tower slot="B" kind="archer" />
      <Tower slot="C" kind="cannon" />
    </>
  )
}
`,
  solution: `import { useEffect } from 'react'
import { Tower, useGame, castSpell, onGameEvent } from 'game'

export default function Defense() {
  const game = useGame()

  useEffect(() => {
    const offSpawn = onGameEvent('enemySpawn', ({ enemy }) => {
      if (enemy?.kind === 'boss') castSpell('meteor')
    })
    const offLeak = onGameEvent('enemyLeaked', () => {
      castSpell('freeze')
    })
    return () => {
      offSpawn()
      offLeak()
    }
  }, [])

  return (
    <>
      <ul>
        {game.spells.map((s) => (
          <li key={s.name}>
            {s.name} : {s.ready ? 'prêt' : \`\${s.cooldown} s\`}
          </li>
        ))}
      </ul>
      <Tower slot="B" kind="archer" />
      <Tower slot="C" kind="cannon" />
    </>
  )
}
`,
  hints: [
    'Tout se passe dans `useEffect(() => { … }, [])` : c’est là qu’on s’abonne aux événements extérieurs, une seule fois.',
    '`onGameEvent` renvoie une fonction de désabonnement : garde-la dans une constante (`const offSpawn = onGameEvent(…)`) et appelle-la dans la fonction que ton effet renvoie.',
    'Par exemple : `const offSpawn = onGameEvent(\'enemySpawn\', ({ enemy }) => { if (enemy?.kind === \'boss\') castSpell(\'meteor\') })`, pareil avec `\'enemyLeaked\'` et `castSpell(\'freeze\')`, puis `return () => { offSpawn(); offLeak() }`.',
  ],
  objectives: [
    {
      id: 'subscribed',
      label: 'S’abonner avec `onGameEvent` dans un `useEffect`',
      check: (ctx) =>
        ctx.stats.totalSubscriptions >= 2 && effectBodies(ctx).some((b) => /onGameEvent\s*\(/.test(b)),
    },
    {
      id: 'cleanup',
      label: 'Renvoyer une fonction de nettoyage',
      check: (ctx) =>
        effectBodies(ctx).some((b) => /onGameEvent\s*\(/.test(b) && /\breturn\s+(\(\s*\)\s*=>|function\b|onGameEvent\s*\(|[A-Za-z_$][\w$]*\s*($|[;}]))/m.test(b)),
    },
    {
      id: 'deps',
      label: 'Un tableau de dépendances (pas de réabonnement à chaque rendu)',
      check: (ctx) =>
        effectBodies(ctx)
          .filter((b) => /onGameEvent\s*\(/.test(b))
          .every((b) => /,\s*\[[^\]]*\]\s*$/.test(b)) &&
        count(ctx, /onGameEvent\s*\(/) > 0 &&
        ctx.stats.totalSubscriptions <= 200,
    },
    {
      id: 'no-leak',
      label: 'Jamais plus de 3 abonnements actifs à la fois',
      check: (ctx) => ctx.stats.totalSubscriptions > 0 && ctx.stats.maxSubscriptions <= 3,
    },
    {
      id: 'spells',
      label: 'Lancer `freeze` **et** `meteor` grâce aux événements',
      check: (ctx) => ctx.stats.spellsCast.freeze >= 1 && ctx.stats.spellsCast.meteor >= 1 && has(ctx, /castSpell\s*\(/),
    },
  ],
  game: {
    map: MEADOW,
    startGold: 140,
    lives: 8,
    allowedTowers: ['archer', 'cannon', 'mage', 'frost'],
    spells: ['freeze', 'meteor'],
    breakTime: 4,
    waves: [
      {
        groups: [
          { kind: 'grunt', count: 6, interval: 1.2 },
          { kind: 'runner', count: 26, interval: 0.2, delay: 9 },
        ],
      },
      {
        groups: [
          { kind: 'grunt', count: 18, interval: 0.4 },
          { kind: 'boss', count: 1, interval: 1, delay: 7, hpScale: 0.35 },
        ],
      },
      {
        groups: [
          { kind: 'runner', count: 16, interval: 0.25 },
          { kind: 'grunt', count: 16, interval: 0.4, delay: 6 },
          { kind: 'boss', count: 1, interval: 1, delay: 12, hpScale: 0.4 },
        ],
      },
    ],
  },
}
