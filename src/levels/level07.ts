import { has } from './checks'
import { MEADOW } from './maps'
import type { LevelDefinition } from './types'

export const level07: LevelDefinition = {
  id: '07-forms',
  number: 7,
  title: 'Le poste de commande',
  concept: 'Formulaires contrôlés & événements typés',
  summary: 'Pilote ta tour en pleine partie grâce à un formulaire contrôlé par React.',
  lesson: `
## Un formulaire piloté par React

Jusqu'ici, tes tours étaient écrites « en dur » dans ton code. Et si tu pouvais changer
de tour **en pleine partie**, depuis un menu déroulant ? C'est le rôle des **formulaires**.

En HTML classique, un \`<select>\` ou un \`<input>\` garde **sa propre valeur** dans le
navigateur. En React, on préfère que ce soit **l'état du composant** qui décide de la
valeur affichée. On parle alors de champ **contrôlé**.

## Les deux ingrédients d'un champ contrôlé

1. \`value\` : la valeur affichée vient de ton état ;
2. \`onChange\` : à chaque modification, tu mets l'état à jour.

\`\`\`tsx
const [kind, setKind] = useState<TowerKind>('archer')

<select value={kind} onChange={(e) => setKind(e.target.value as TowerKind)}>
  <option value="archer">Archer</option>
  <option value="cannon">Canon</option>
</select>
\`\`\`

Le cycle est toujours le même : le joueur choisit → \`onChange\` → \`setKind\` →
nouveau rendu → le \`<select>\` affiche \`kind\`… et ta \`<Tower kind={kind} />\` change aussi !

> ⚠️ Avec \`value\` mais **sans** \`onChange\`, le champ est bloqué : React remet toujours
> la valeur de l'état. Et sans \`value\`, React ne sait pas ce qui est affiché.

## Typer l'événement

Le paramètre \`e\` est un **événement de changement**. Quand tu écris le gestionnaire
directement dans le JSX, TypeScript **devine** son type tout seul. Si tu préfères une
fonction séparée, tu dois l'annoter avec \`ChangeEvent\`, en précisant l'élément HTML :

\`\`\`tsx
import { useState, type ChangeEvent } from 'react'

function handleKind(e: ChangeEvent<HTMLSelectElement>) {
  setKind(e.target.value as TowerKind)
}

<select value={kind} onChange={handleKind}>…</select>
\`\`\`

| Élément | Type de l'événement |
|---|---|
| \`<select>\` | \`ChangeEvent<HTMLSelectElement>\` |
| \`<input>\` | \`ChangeEvent<HTMLInputElement>\` |
| \`<textarea>\` | \`ChangeEvent<HTMLTextAreaElement>\` |

## \`e.target.value\` est toujours une chaîne

Le navigateur renvoie **toujours du texte**, même pour un \`<input type="number">\`.
Deux conversions à connaître :

- \`e.target.value as TowerKind\` : tu **affirmes** à TypeScript que ce texte est un
  \`TowerKind\` (c'est vrai, puisque tes \`<option>\` ne proposent que des types valides) ;
- \`Number(e.target.value)\` : tu transformes le texte \`"2"\` en nombre \`2\`.

\`\`\`tsx
const [level, setLevel] = useState(1)

<input
  type="number"
  min={1}
  max={3}
  value={level}
  onChange={(e) => setLevel(Number(e.target.value))}
/>
\`\`\`

> 💡 \`as\` ne convertit rien à l'exécution : c'est une promesse faite à TypeScript.
> Utilise-le seulement quand tu es **sûr** de la valeur.
`,
  mission: `Une seule tour sur la hauteur **C**, mais des vagues qui alternent **chauves-souris** et **golems blindés** !
Construis un formulaire **contrôlé** : un \`<select>\` pour le type de tour et un \`<input type="number">\` pour son niveau,
puis **change la configuration entre les vagues** (regarde l'aperçu de la prochaine vague dans le HUD).
Astuce budget : archer niveau 3 ou canon niveau 2.`,
  starterCode: `import { useState } from 'react'
import { Tower, type TowerKind } from 'game'

export default function Defense() {
  const [kind, setKind] = useState<TowerKind>('archer')
  const [level, setLevel] = useState(3)

  return (
    <>
      <label>
        Tour :{' '}
        {/* TODO : rends ce <select> contrôlé avec value={kind} et un onChange qui appelle setKind */}
        <select defaultValue="archer">
          <option value="archer">Archer</option>
          <option value="cannon">Canon</option>
        </select>
      </label>
      <label>
        Niveau :{' '}
        {/* TODO : rends cet <input> contrôlé avec value={level} et onChange (pense à Number(...)) */}
        <input type="number" min={1} max={3} defaultValue={3} />
      </label>
      {/* TODO : utilise kind et level au lieu des valeurs écrites en dur */}
      <Tower slot="C" kind="archer" level={3} />
    </>
  )
}
`,
  solution: `import { useState, type ChangeEvent } from 'react'
import { Tower, type TowerKind } from 'game'

export default function Defense() {
  const [kind, setKind] = useState<TowerKind>('archer')
  const [level, setLevel] = useState(3)

  function handleKindChange(e: ChangeEvent<HTMLSelectElement>) {
    setKind(e.target.value as TowerKind)
  }

  return (
    <>
      <label>
        Tour :{' '}
        <select value={kind} onChange={handleKindChange}>
          <option value="archer">Archer</option>
          <option value="cannon">Canon</option>
        </select>
      </label>
      <label>
        Niveau :{' '}
        <input type="number" min={1} max={3} value={level} onChange={(e) => setLevel(Number(e.target.value))} />
      </label>
      <Tower slot="C" kind={kind} level={level} />
    </>
  )
}
`,
  hints: [
    'Un champ contrôlé a besoin de deux props : `value` (lue depuis l’état) et `onChange` (qui met l’état à jour).',
    'Dans `onChange`, la nouvelle valeur est dans `e.target.value` : c’est une chaîne. Utilise `as TowerKind` pour le select et `Number(...)` pour l’input. N’oublie pas `kind={kind}` et `level={level}` sur la tour.',
    'Par exemple : `<select value={kind} onChange={(e) => setKind(e.target.value as TowerKind)}>` et `<input type="number" value={level} onChange={(e) => setLevel(Number(e.target.value))} />`. Ensuite, en partie : archer niveau 3 contre les volants, canon niveau 2 contre les golems.',
  ],
  objectives: [
    {
      id: 'controlled-select',
      label: '`<select>` contrôlé (`value` + `onChange`)',
      check: (ctx) =>
        has(ctx, /<select\b[^>]*\bvalue=\{/) && has(ctx, /<select\b[^>]*\bonChange=\{/),
    },
    {
      id: 'controlled-input',
      label: '`<input>` contrôlé (`value` + `onChange`)',
      check: (ctx) => has(ctx, /<input\b[^>]*\bvalue=\{/) && has(ctx, /<input\b[^>]*\bonChange=\{/),
    },
    {
      id: 'typed-value',
      label: 'Convertir `e.target.value` (`as TowerKind`, `Number(…)`)',
      check: (ctx) => has(ctx, /\bas\s+TowerKind\b/) && has(ctx, /Number\(\s*\w+\.(currentTarget|target)\.value\s*\)/),
    },
    {
      id: 'switched',
      label: 'Archer **et** canon utilisés pendant la partie',
      check: (ctx) => ctx.stats.towerKindsUsed.includes('archer') && ctx.stats.towerKindsUsed.includes('cannon'),
    },
  ],
  game: {
    map: MEADOW,
    startGold: 140,
    lives: 8,
    allowedTowers: ['archer', 'cannon'],
    breakTime: 5,
    waves: [
      { groups: [{ kind: 'flyer', count: 6, interval: 1.1 }] },
      {
        groups: [
          { kind: 'tank', count: 8, interval: 0.8 },
          { kind: 'grunt', count: 6, interval: 1.2, delay: 3 },
        ],
      },
      { groups: [{ kind: 'flyer', count: 15, interval: 0.8 }] },
    ],
  },
  playtest: (ui) => {
    if (ui.phase !== 'build' && ui.phase !== 'break') return
    const next = ui.snapshot.nextWave
    if (!next || ui.memory.configuredFor === next.number) return
    if (next.hasArmored) {
      ui.setValue('input', '2')
      ui.setValue('select', 'cannon')
    } else {
      ui.setValue('select', 'archer')
      ui.setValue('input', '3')
    }
    ui.memory.configuredFor = next.number
  },
}
