import { count, has } from './checks'
import { CANYON } from './maps'
import type { LevelDefinition } from './types'

/** Éléments réellement magiques (le neutre ne compte pas). */
const MAGIC = ['fire', 'ice', 'storm'] as const

export const level11: LevelDefinition = {
  id: '11-context',
  number: 11,
  title: 'Le cristal élémentaire',
  concept: 'Context',
  summary: 'Partage un élément magique avec toutes tes tours, sans faire descendre de props.',
  lesson: `
## Le problème : le « prop drilling »

Imagine une valeur choisie tout en haut de ton application (un thème, une langue, un
utilisateur connecté…) et utilisée tout en bas, dans des composants imbriqués :

\`\`\`tsx
<App theme={theme}>          // le thème est choisi ici…
  <Page theme={theme}>       // …Page ne s'en sert pas, mais doit le transmettre
    <Sidebar theme={theme}>  // …Sidebar non plus
      <Button theme={theme} /> // …seul Button l'utilise vraiment !
\`\`\`

Faire descendre une prop à travers des composants qui ne s'en servent pas, c'est du
**prop drilling** : verbeux, fragile, pénible à modifier.

## La solution : le Context

Un **Context** est un « canal » qui traverse l'arbre de composants. Trois étapes :

**1. Créer le contexte** (en dehors des composants), avec une valeur par défaut :

\`\`\`tsx
import { createContext } from 'react'

type Theme = 'clair' | 'sombre'
const ThemeContext = createContext<Theme>('clair')
\`\`\`

**2. Fournir une valeur** avec le **Provider**, autour de la partie de l'arbre concernée :

\`\`\`tsx
const [theme, setTheme] = useState<Theme>('sombre')

return (
  <ThemeContext.Provider value={theme}>
    <Page />
  </ThemeContext.Provider>
)
\`\`\`

**3. Lire la valeur** où tu veux en dessous, avec le hook \`useContext\` :

\`\`\`tsx
import { useContext } from 'react'

function Button() {
  const theme = useContext(ThemeContext) // 'sombre' ici
  return <button className={theme}>OK</button>
}
\`\`\`

\`Page\` et \`Sidebar\` n'ont plus besoin de connaître le thème !

## Ce qu'il faut retenir

- Quand la \`value\` du Provider change, **tous** les composants qui lisent ce contexte
  se ré-affichent automatiquement, même très loin dans l'arbre.
- Un composant lit la valeur du **Provider le plus proche** au-dessus de lui ; s'il n'y en a
  aucun, il reçoit la **valeur par défaut** passée à \`createContext\`.
- Le type générique \`createContext<Theme>(…)\` garantit que \`useContext\` renvoie bien un \`Theme\`.
- N'en abuse pas : pour une donnée utilisée par un ou deux enfants directs, les props
  restent plus simples et plus lisibles.

## Les éléments magiques

La prop \`element\` d'une tour multiplie ses dégâts :

| Élément | Bonus de dégâts |
|---|---|
| \`neutral\` | aucun |
| \`ice\` (Glace) | +10 % |
| \`storm\` (Tempête) | +15 % |
| \`fire\` (Feu) | +25 % |

> 💡 Le bonus s'applique à tous les types de tours, sur tous les ennemis.
`,
  mission: `Ta forteresse est prête, mais ses tours ignorent l'élément choisi avec les boutons.
Crée un **contexte** pour partager l'élément, **fournis-le** autour de la forteresse et **lis-le**
dans \`ElementalTower\` — sans ajouter de prop \`element\` aux remparts. La Glace ne suffira pas
contre les dernières vagues : **change d'élément** en cours de partie.`,
  starterCode: `import { useState } from 'react'
import { Tower, type TowerKind } from 'game'

type MagicElement = 'fire' | 'ice' | 'storm'

const LABELS: Record<MagicElement, string> = { fire: 'Feu', ice: 'Glace', storm: 'Tempête' }

// TODO 1 : crée un contexte typé, par exemple
// const ElementContext = createContext<MagicElement>('ice')

function ElementalTower({ slot, kind }: { slot: string; kind: TowerKind }) {
  // TODO 3 : lis l'élément avec useContext et passe-le à la tour : element={…}
  return <Tower slot={slot} kind={kind} />
}

function NorthWall() {
  return (
    <>
      <ElementalTower slot="C" kind="mage" />
      <ElementalTower slot="B" kind="cannon" />
      <ElementalTower slot="A" kind="archer" />
    </>
  )
}

function SouthWall() {
  return (
    <>
      <ElementalTower slot="F" kind="mage" />
      <ElementalTower slot="E" kind="cannon" />
      <ElementalTower slot="G" kind="archer" />
    </>
  )
}

function Fortress() {
  return (
    <>
      <NorthWall />
      <SouthWall />
    </>
  )
}

export default function Defense() {
  const [element, setElement] = useState<MagicElement>('ice')

  // TODO 2 : enveloppe la forteresse dans le Provider de ton contexte (value={element})
  return (
    <>
      <p>Élément actif : {LABELS[element]}</p>
      {(Object.keys(LABELS) as MagicElement[]).map((e) => (
        <button key={e} disabled={e === element} onClick={() => setElement(e)}>
          {LABELS[e]}
        </button>
      ))}
      <Fortress />
    </>
  )
}
`,
  solution: `import { createContext, useContext, useState } from 'react'
import { Tower, type TowerKind } from 'game'

type MagicElement = 'fire' | 'ice' | 'storm'

const LABELS: Record<MagicElement, string> = { fire: 'Feu', ice: 'Glace', storm: 'Tempête' }

const ElementContext = createContext<MagicElement>('ice')

function ElementalTower({ slot, kind }: { slot: string; kind: TowerKind }) {
  const element = useContext(ElementContext)
  return <Tower slot={slot} kind={kind} element={element} />
}

function NorthWall() {
  return (
    <>
      <ElementalTower slot="C" kind="mage" />
      <ElementalTower slot="B" kind="cannon" />
      <ElementalTower slot="A" kind="archer" />
    </>
  )
}

function SouthWall() {
  return (
    <>
      <ElementalTower slot="F" kind="mage" />
      <ElementalTower slot="E" kind="cannon" />
      <ElementalTower slot="G" kind="archer" />
    </>
  )
}

function Fortress() {
  return (
    <>
      <NorthWall />
      <SouthWall />
    </>
  )
}

export default function Defense() {
  const [element, setElement] = useState<MagicElement>('ice')

  return (
    <ElementContext.Provider value={element}>
      <p>Élément actif : {LABELS[element]}</p>
      {(Object.keys(LABELS) as MagicElement[]).map((e) => (
        <button key={e} disabled={e === element} onClick={() => setElement(e)}>
          {LABELS[e]}
        </button>
      ))}
      <Fortress />
    </ElementContext.Provider>
  )
}
`,
  hints: [
    'Trois pièces à assembler : `createContext` (hors des composants), le Provider autour de `<Fortress />`, et `useContext` dans `ElementalTower`. Pense à les importer depuis `react`.',
    'Crée `const ElementContext = createContext<MagicElement>(\'ice\')`, puis dans `Defense` renvoie `<ElementContext.Provider value={element}>…</ElementContext.Provider>`.',
    'Dans `ElementalTower` : `const element = useContext(ElementContext)` puis `<Tower slot={slot} kind={kind} element={element} />`. En jeu, clique sur **Feu** avant les golems blindés.',
  ],
  objectives: [
    {
      id: 'create-context',
      label: 'Créer un contexte avec `createContext`',
      check: (ctx) => has(ctx, /\bcreateContext\s*[<(]/),
    },
    {
      id: 'provider',
      label: 'Fournir l’élément avec un Provider',
      check: (ctx) => has(ctx, /<\w+\.Provider\s[^>]*value=/) || has(ctx, /<\w+Context\s[^>]*value=/),
    },
    {
      id: 'use-context',
      label: 'Lire l’élément avec `useContext` dans les tours',
      check: (ctx) => has(ctx, /\buseContext\s*\(/),
    },
    {
      id: 'no-drilling',
      label: 'Aucun prop drilling : pas de prop `element` sur tes composants',
      check: (ctx) =>
        count(ctx, /<(?!Tower\b)[A-Z]\w*\b[^>]*\belement=/) === 0 && count(ctx, /<Tower\b[^>]*\belement=\{/) > 0,
    },
    {
      id: 'two-elements',
      label: 'Utiliser au moins 2 éléments magiques pendant la partie',
      check: (ctx) => ctx.stats.elementsUsed.filter((e) => (MAGIC as readonly string[]).includes(e)).length >= 2,
    },
  ],
  game: {
    map: CANYON,
    startGold: 480,
    lives: 10,
    allowedTowers: ['archer', 'cannon', 'mage'],
    breakTime: 4,
    waves: [
      {
        groups: [
          { kind: 'grunt', count: 16, interval: 0.8, hpScale: 1.55 },
          { kind: 'flyer', count: 8, interval: 1.2, delay: 4, hpScale: 1.55 },
        ],
      },
      {
        groups: [
          { kind: 'runner', count: 18, interval: 0.5, hpScale: 1.55 },
          { kind: 'tank', count: 4, interval: 3, delay: 3, hpScale: 1.55 },
        ],
      },
      {
        groups: [
          { kind: 'tank', count: 8, interval: 2.2, hpScale: 2.17 },
          { kind: 'flyer', count: 14, interval: 0.8, delay: 2, hpScale: 2.17 },
        ],
      },
      {
        groups: [
          { kind: 'grunt', count: 20, interval: 0.5, hpScale: 2.79 },
          { kind: 'tank', count: 8, interval: 1.8, delay: 2, hpScale: 2.48 },
          { kind: 'flyer', count: 14, interval: 0.7, delay: 4, hpScale: 2.48 },
        ],
      },
    ],
  },
  playtest: (ui) => {
    // Glace au début, puis Feu dès la deuxième vague.
    if (!ui.memory.fire && ui.snapshot.wave >= 2) {
      if (ui.click('Feu')) ui.memory.fire = true
    }
  },
}
