import { count, has } from './checks'
import { MEADOW } from './maps'
import type { LevelDefinition } from './types'

export const level03: LevelDefinition = {
  id: '03-typed-props',
  number: 3,
  title: 'Le bastion sur mesure',
  concept: 'Typer ses props (TypeScript)',
  summary: 'Crée ton propre composant et décris ses props avec un type TypeScript.',
  lesson: `
## Tes propres composants

Jusqu'ici, tu utilisais le composant \`<Tower />\` fourni par le jeu. Mais tu peux créer
**tes propres composants** et les réutiliser autant de fois que tu veux, exactement comme
une fonction :

\`\`\`tsx
function Bastion({ slot, kind }) {
  return <Tower slot={slot} kind={kind} />
}

// … puis, ailleurs :
<Bastion slot="A" kind="archer" />
<Bastion slot="B" kind="cannon" />
\`\`\`

Un composant reçoit **un seul argument** : un objet qui contient toutes ses props.
La syntaxe \`{ slot, kind }\` est une **déstructuration** JavaScript : elle extrait
directement \`props.slot\` et \`props.kind\` dans deux variables.

## Le problème : « implicitly has an 'any' type »

Le code ci-dessus fonctionne… mais TypeScript râle :

> Binding element 'slot' implicitly has an 'any' type.

Il ne sait pas **ce que contient** \`slot\` ni \`kind\`. Sans cette information, il ne
peut pas t'aider : une faute de frappe comme \`kind="arhcer"\` passerait inaperçue
jusqu'à ce que le jeu affiche une erreur.

## Décrire les props avec un \`type\`

On décrit la **forme** de l'objet de props avec un \`type\` (ou une \`interface\`, c'est
presque pareil) :

\`\`\`tsx
type BastionProps = {
  slot: string
  kind: TowerKind
  level?: number // le « ? » rend la prop optionnelle
}
\`\`\`

Puis on annote le paramètre du composant avec ce type, **après** la déstructuration :

\`\`\`tsx
function Bastion({ slot, kind, level = 1 }: BastionProps) {
  return <Tower slot={slot} kind={kind} level={level} />
}
\`\`\`

- \`slot: string\` : n'importe quel texte.
- \`kind: TowerKind\` : **uniquement** \`'archer' | 'cannon' | 'mage' | 'frost'\`.
  Ce genre de type s'appelle une **union** de chaînes.
- \`level?: number\` : optionnelle ; \`level = 1\` lui donne une valeur par défaut.

Et maintenant, l'éditeur **t'aide** : autocomplétion sur \`kind\`, erreur si tu oublies
\`slot\`, erreur si tu passes \`level="2"\` au lieu de \`level={2}\`.

## Importer un type

Le module \`game\` exporte le type \`TowerKind\`. On l'importe avec le mot-clé \`type\`
pour indiquer qu'il ne sert qu'à TypeScript (il disparaît à l'exécution) :

\`\`\`tsx
import { Tower, type TowerKind } from 'game'
\`\`\`

> 💡 \`type\` ou \`interface\` ? Pour des props, les deux conviennent :
> \`interface BastionProps { slot: string }\` est équivalent. Choisis-en un et reste cohérent.
`,
  mission: `Ton composant \`Bastion\` n'a pas de types : TypeScript proteste. **Décris ses props**
avec un \`type\` (en important \`TowerKind\`), puis **réutilise** \`<Bastion />\` pour tenir
au moins **trois emplacements** face aux gobelins, chauves-souris et golems.`,
  starterCode: `import { Tower } from 'game'

// Notre propre composant : un bastion construit une tour.
// ⚠️ TypeScript se plaint : ses props n'ont pas de type !
// TODO : crée un type BastionProps (slot, kind, level optionnel)
//        et annote le paramètre : function Bastion({ ... }: BastionProps)
function Bastion({ slot, kind }) {
  return <Tower slot={slot} kind={kind} />
}

export default function Defense() {
  return (
    <>
      {/* TODO : réutilise <Bastion /> sur d'autres slots (B, C, D…) */}
      <Bastion slot="A" kind="archer" />
    </>
  )
}
`,
  solution: `import { Tower, type TowerKind } from 'game'

type BastionProps = {
  slot: string
  kind: TowerKind
  level?: number
}

function Bastion({ slot, kind, level = 1 }: BastionProps) {
  return <Tower slot={slot} kind={kind} level={level} />
}

export default function Defense() {
  return (
    <>
      <Bastion slot="A" kind="archer" />
      <Bastion slot="B" kind="cannon" />
      <Bastion slot="C" kind="archer" level={2} />
      <Bastion slot="D" kind="cannon" />
      <Bastion slot="E" kind="archer" />
    </>
  )
}
`,
  hints: [
    'TypeScript a besoin de connaître la forme des props : crée un `type` qui liste `slot`, `kind` et éventuellement `level`.',
    'Importe le type avec `import { Tower, type TowerKind } from \'game\'`, puis écris `function Bastion({ slot, kind }: BastionProps)`.',
    'Par exemple : `type BastionProps = { slot: string; kind: TowerKind; level?: number }`, puis `<Bastion slot="A" kind="archer" />`, `<Bastion slot="B" kind="cannon" />`, `<Bastion slot="C" kind="archer" level={2} />`…',
  ],
  objectives: [
    {
      id: 'props-type',
      label: 'Déclarer un `type` (ou une `interface`) pour les props',
      check: (ctx) =>
        has(ctx, /\b(type\s+[A-Z]\w*\s*=\s*\{|interface\s+[A-Z]\w*\s*\{)/) &&
        has(ctx, /\(\s*(\{[^}]*\}|\w+)\s*:\s*[A-Z]\w*\s*\)/),
    },
    {
      id: 'tower-kind',
      label: 'Typer `kind` avec `TowerKind`',
      check: (ctx) => has(ctx, /import\s+(type\s+)?\{[^}]*\bTowerKind\b[^}]*\}\s*from\s*['"]game['"]/) && has(ctx, /kind\??\s*:\s*TowerKind\b/),
    },
    {
      id: 'reuse',
      label: 'Réutiliser ton composant au moins **2 fois**',
      check: (ctx) => {
        // `function Bastion(…)` ou `const Bastion = (…) => …`, hors composant exporté par défaut.
        const declared =
          /\bfunction\s+([A-Z]\w*)\s*\(|\b(?:const|let)\s+([A-Z]\w*)\s*(?::[^=]+)?=\s*(?:\(|function\b|async\b|[A-Za-z_$][\w$]*\s*=>)/g
        const names = [...ctx.codeNoComments.matchAll(declared)]
          .map((m) => m[1] ?? m[2])
          .filter((n) => !new RegExp(`export\\s+default\\s+(function\\s+)?${n}\\b`).test(ctx.codeNoComments))
        return names.some((n) => count(ctx, new RegExp(`<${n}\\b`)) >= 2)
      },
    },
    {
      id: 'three-towers',
      label: 'Au moins **3 tours** actives en même temps',
      check: (ctx) => ctx.stats.maxActiveTowers >= 3,
    },
  ],
  game: {
    map: MEADOW,
    startGold: 300,
    lives: 8,
    allowedTowers: ['archer', 'cannon'],
    waves: [
      { groups: [{ kind: 'grunt', count: 12, interval: 0.9 }] },
      {
        groups: [
          { kind: 'flyer', count: 12, interval: 0.8 },
          { kind: 'grunt', count: 10, interval: 0.7, delay: 2 },
        ],
      },
      {
        groups: [
          { kind: 'tank', count: 6, interval: 2.2 },
          { kind: 'grunt', count: 12, interval: 0.6, delay: 1.5 },
          { kind: 'flyer', count: 8, interval: 0.9, delay: 4 },
        ],
      },
    ],
  },
}
