# ReactLearner

**Apprends React + TypeScript en défendant ta base.**

ReactLearner est un jeu web où ton code est ta défense : à gauche, un éditeur (le même moteur que VS Code) ;
à droite, un tower defense en 3D. Les tours ne se posent pas à la souris : elles apparaissent parce que **ton
composant React les affiche**. Douze niveaux progressifs te font passer du tout premier JSX jusqu'à l'écriture de
ton propre hook, face à des vagues de gobelins, de chauves-souris et de golems blindés.

Public visé : quelqu'un qui connaît JavaScript et découvre React. Tout le jeu est en français.

## Comment ça marche : ton code pilote le jeu

Chaque niveau te donne un fichier `Defense.tsx` à compléter. Il est compilé dans le navigateur à chaque
modification, puis réellement exécuté par React :

```tsx
import { Tower, useGame } from 'game'

export default function Defense() {
  const game = useGame() // l'état de la partie, en temps réel

  return (
    <>
      <Tower slot="A" kind="archer" />
      {game.nextWave?.hasFlying && <Tower slot="B" kind="mage" />}
    </>
  )
}
```

- `<Tower />` construit une tour **tant qu'il est affiché**. Le démonter la retire (et te rembourse).
- `useGame()` renvoie un instantané de la partie (or, vies, ennemis, vague en cours…) et fait se ré-afficher ton
  composant à chaque changement.
- `onGameEvent()`, `castSpell()`, `getTowerCost()`, `log()`, `TOWER_INFO`, `ENEMY_INFO` complètent l'API du
  module `game`, entièrement typée et documentée dans l'éditeur (autocomplétion, erreurs TypeScript en direct).

L'économie est **déclarative** : l'or disponible vaut ta banque moins le coût des tours affichées. Si tu n'as pas
assez d'or, la tour attend d'être payée et se construit dès que les récompenses tombent.

Chaque niveau a des **objectifs** qui vérifient le concept enseigné (pas seulement la victoire), trois indices
progressifs et une leçon illustrée.

## Les niveaux

| # | Titre | Concept | Au programme |
|---|-------|---------|--------------|
| 1 | Premier rempart | Composants & JSX | Écrire son premier composant et poser une tour. |
| 2 | Le bon outil | Props & fragments | Configurer ses tours avec des props et renvoyer plusieurs éléments. |
| 3 | Le bastion sur mesure | Typer ses props (TypeScript) | Créer son composant et décrire ses props avec un type. |
| 4 | Le canyon fortifié | Listes & keys | Générer une ligne de défense depuis un tableau avec `.map()`. |
| 5 | Ciel ou acier | Rendu conditionnel & `useGame` | Lire l'état de la partie et adapter ses tours à chaque vague. |
| 6 | La forge | `useState` & événements | Un bouton qui améliore les tours en pleine partie. |
| 7 | Le poste de commande | Formulaires contrôlés & événements typés | Piloter une tour avec un formulaire contrôlé. |
| 8 | Les sentinelles | `useEffect` & nettoyage | S'abonner aux événements du jeu… et se désabonner. |
| 9 | La mémoire du stratège | `useRef` | Mémoriser des valeurs sans provoquer de rendu. |
| 10 | Le plan de bataille | `useReducer` & unions discriminées | Un plan de construction piloté par des actions typées. |
| 11 | Le cristal élémentaire | Context | Partager un élément avec toutes les tours sans *prop drilling*. |
| 12 | Le Seigneur ombre | Hook personnalisé | Boss final : tout rassembler dans son propre hook. |

## Installation

Prérequis : **Node.js 22 ou plus récent**.

```bash
npm install
npm run dev        # http://localhost:5173
```

Tout tourne en local : Monaco et ses workers sont empaquetés par Vite, aucun CDN n'est utilisé.

## Commandes

| Commande | Rôle |
|----------|------|
| `npm run dev` | Serveur de développement Vite. |
| `npm run build` | Vérification des types puis build de production dans `dist/`. |
| `npm run preview` | Sert le build de production. |
| `npm run typecheck` | `tsc --noEmit` sur tout le projet. |
| `npm test` | Tests unitaires (moteur, runtime) et simulation headless de chaque niveau. |
| `npx vitest run -t "niveau 05"` | Ne tester qu'un niveau. |
| `npm run balance` | Rapport d'équilibrage : issue et vies restantes de chaque niveau, avec la solution et avec le code de départ. |

La CI GitHub Actions (`.github/workflows/ci.yml`) lance typecheck, tests et build sur Node 22 et 24.

## Architecture

```
src/
├── engine/     Moteur de jeu pur (aucune dépendance à React) : tick(dt), économie, combat, vagues.
│               balance.ts regroupe tout l'équilibrage (tours, ennemis, sorts).
├── runtime/    Exécution du code joueur :
│               compile.ts      transpilation sucrase + évaluation (seuls `react` et `game` sont importables)
│               loopGuard.ts    garde-fou : une boucle infinie lève une erreur au lieu de geler l'onglet
│               gameModule.tsx  le module `game` exposé au joueur
│               gameModule.d.ts.txt  ses types pour l'éditeur (vérifiés par les tests)
├── levels/     Un fichier levelNN.ts par niveau (auto-découvert), cartes partagées, helpers d'objectifs.
├── testing/    simulateLevel (jsdom + act, joue un niveau en accéléré) et typecheckUserCode (API TypeScript).
├── game/       Rendu 3D react-three-fiber, boucle de jeu, ErrorBoundary du code joueur.
├── editor/     Configuration de Monaco (workers locaux, types React + module `game`).
└── app/        Interface : session de niveau, HUD, leçons, modales, animations (anime.js).
scripts/        balance.test.ts (npm run balance).
```

Le moteur n'avance que via `tick(dt)` : il est donc entièrement testable sans navigateur. Les tests jouent
chaque niveau de bout en bout en headless pour garantir que **la solution gagne sans erreur TypeScript** et que
**le code de départ ne réussit pas**.

## Ajouter un niveau

1. Crée `src/levels/levelNN.ts` en t'inspirant de `level01.ts` ; il est découvert automatiquement.
2. Renseigne la leçon (Markdown), la mission, le `starterCode` (avec des `// TODO`), la `solution`, trois indices
   du plus vague au plus précis et des objectifs qui vérifient le concept (`ctx.stats`, `ctx.towers`,
   `ctx.renderCount`, ou une regex via `has(ctx, /…/)`).
3. Calibre les vagues pour que le niveau soit impossible sans le concept, et gagnable avec marge avec la solution.
4. Si le niveau repose sur des clics ou des saisies du joueur, définis `playtest` pour que les tests jouent comme
   un humain.
5. Vérifie : `npx vitest run -t "niveau NN"` puis `npm run balance`.

Les conventions détaillées (ton, règles d'économie, pièges à éviter) sont dans [`CLAUDE.md`](CLAUDE.md).

## Stack

- **React 19** + **TypeScript 5.9**, **Vite 8**
- **Monaco Editor** (éditeur de VS Code) avec vérification TypeScript dans un worker
- **sucrase** pour transpiler le code du joueur dans le navigateur
- **three.js** + **react-three-fiber** / **drei** / **postprocessing** pour la scène 3D
- **anime.js** pour les animations d'interface, **marked** pour les leçons
- **Vitest** + **jsdom** pour les tests

## Licence

[MIT](LICENSE) © Tristan Brasseur
