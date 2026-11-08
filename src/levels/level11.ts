import { has, jsxAttr, jsxTags } from './checks'
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

La prop \`element\` d'une tour ajoute +10 % de dégâts… et surtout, chaque ennemi a
une **faiblesse** (×1,6) et une **résistance** (×0,55) :

| Ennemi | Faible à | Résiste à |
|---|---|---|
| 👺 Gobelin (\`grunt\`) | 🔥 Feu | ⚡ Tempête |
| 💨 Éclaireur (\`runner\`) | ❄️ Glace | 🔥 Feu |
| 🛡️ Golem (\`tank\`) | ⚡ Tempête | 🔥 Feu |
| 🦇 Chauve-souris (\`flyer\`) | ⚡ Tempête | ❄️ Glace |

> 💡 Aucun élément ne gagne seul : regarde la vague qui arrive et change d'élément.
> Grâce au contexte, **un seul** \`setElement\` met à jour toutes les tours d'un coup !
`,
  mission: `Ta forteresse est prête, mais ses tours ignorent l'élément choisi avec les boutons.
Crée un **contexte** pour partager l'élément, **fournis-le** autour de la forteresse et **lis-le**
dans \`ElementalTower\` — sans ajouter de prop \`element\` aux remparts. Chaque vague a sa faiblesse
(voir la leçon) : **change d'élément** en cours de partie pour l'exploiter.`,
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
    'Dans `ElementalTower` : `const element = useContext(ElementContext)` puis `<Tower slot={slot} kind={kind} element={element} />`. En jeu : **Glace** contre les éclaireurs, **Feu** contre les gobelins, **Tempête** contre golems et chauves-souris.',
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
      // `<ElementContext value={…}>` (React 19) ou `<ElementContext.Provider value={…}>`,
      // pour n'importe quel identifiant créé par createContext.
      check: (ctx) => {
        const contexts = [
          ...ctx.codeNoComments.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:React\.)?createContext\b/g),
        ].map((m) => m[1])
        return jsxTags(ctx, /\.Provider$|^[A-Z]/).some(
          (t) => t.attrs.has('value') && (t.name.endsWith('.Provider') || contexts.includes(t.name)),
        )
      },
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
        !jsxAttr(ctx, /^(?!Tower$)[A-Z]/, 'element') && jsxTags(ctx, 'Tower').some((t) => typeof t.attrs.get('element') === 'string'),
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
      // Vague 1 : éclaireurs rapides — faibles à la Glace.
      { groups: [{ kind: 'runner', count: 26, interval: 0.45, hpScale: 2.4 }] },
      // Vague 2 : horde de gobelins — faibles au Feu.
      { groups: [{ kind: 'grunt', count: 28, interval: 0.45, hpScale: 2.6 }] },
      // Vague 3 : golems et chauves-souris — faibles à la Tempête.
      {
        groups: [
          { kind: 'tank', count: 9, interval: 1.6, hpScale: 2.3 },
          { kind: 'flyer', count: 18, interval: 0.6, delay: 2, hpScale: 2.5 },
        ],
      },
      // Vague 4 : retour des gobelins, plus nombreux.
      { groups: [{ kind: 'grunt', count: 34, interval: 0.4, hpScale: 3.1 }] },
    ],
  },
  playtest: (ui) => {
    // Comme un joueur attentif : regarde la vague en cours et choisit l'élément adapté.
    const wave = ui.snapshot.currentWave ?? ui.snapshot.nextWave
    if (!wave) return
    const label = wave.kinds.includes('runner') ? 'Glace' : wave.kinds.includes('grunt') ? 'Feu' : 'Tempête'
    if (ui.memory.last !== label && ui.click(label)) ui.memory.last = label
  },
}
