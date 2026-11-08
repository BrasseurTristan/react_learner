# ReactLearner

Jeu web local pour apprendre **React + TypeScript** : éditeur Monaco à gauche, tower defense 3D à droite.
Le code du joueur (`Defense.tsx`) est compilé dans le navigateur et **pilote réellement** le jeu :
le composant `<Tower />` du module `game` construit une tour tant qu'il est affiché.
Public : débutant en React qui connaît JavaScript. Toute l'interface et le contenu sont **en français**
(identifiants de code en anglais).

## Commandes

- `npm run dev` — serveur Vite (port 5173)
- `npm test` — vitest : simule chaque niveau en headless (la solution doit gagner sans erreur TS, le code de départ ne doit pas réussir)
- `npx vitest run -t "niveau 05"` — tester un seul niveau
- `npm run typecheck` — tsc sur le projet

## Architecture

- `src/engine/` — moteur pur, sans React. `GameEngine.tick(dt)` fait avancer le temps. Équilibrage dans `balance.ts`.
  Économie déclarative : or disponible = banque − coût des tours actives (retirer une tour la rembourse).
  ⚠️ Conséquence : ne jamais conditionner l'affichage d'une tour sur `gold` dans un niveau (oscillation).
- `src/runtime/gameModule.tsx` — le module `game` exposé au joueur (`Tower`, `useGame`, `castSpell`, `onGameEvent`, `getTowerCost`, `log`, `TOWER_INFO`, `ENEMY_INFO`).
  Ses types pour l'éditeur sont dans `gameModule.d.ts.txt` : **les deux doivent rester synchronisés**.
- `src/runtime/compile.ts` — transpilation sucrase + évaluation ; seuls `react` et `game` sont importables.
- `src/levels/` — un fichier `levelNN.ts` par niveau (auto-découvert par `index.ts`). `maps.ts` : cartes partagées. `checks.ts` : helpers d'objectifs (`has`, `count`).
  Les objectifs « Aucune erreur TypeScript » et « Repousser toutes les vagues » sont ajoutés automatiquement.
- `src/testing/` — `simulateLevel` (jsdom + act) et `typecheckUserCode` (API TypeScript, mêmes options que Monaco).
- `src/game/` — rendu 3D react-three-fiber (`Board3D`, `scene/*`), boucle `useEngineLoop`, `UserRuntime` (ErrorBoundary + Profiler).
- `src/app/` — interface (session de niveau, HUD, modales). Animations d'UI via anime.js v4 (`src/app/anim.ts`).
- `src/editor/` — Monaco 0.52 local (workers Vite, aucun CDN). En dev, `window.__monaco` est exposé pour les tests navigateur.

## Écrire un niveau

Copier la structure de `level01.ts` / `level02.ts`. Règles :
- Leçon Markdown claire et progressive, exemples courts, ton bienveillant, tutoiement.
- `starterCode` : compile (pas d'erreur de syntaxe), ne plante pas, contient des `// TODO` guidant le joueur, et **ne réussit pas** le niveau.
- `solution` : idiomatique, sans erreur TypeScript, gagne avec de la marge (pas à 1 vie près).
- Objectifs : vérifient le **concept enseigné** (via `ctx.stats`, `ctx.towers`, `ctx.renderCount`, ou regex sur `ctx.codeNoComments`), pas seulement la victoire. Libellés courts en Markdown inline.
- Le niveau doit être impossible à gagner sans utiliser le concept (vagues calibrées en conséquence).
- 3 indices du plus vague au plus précis.
- Si le niveau repose sur des clics ou saisies dans le panneau du joueur, définir `playtest` (voir `PlaytestApi` dans `types.ts`, exemple dans `src/testing/playtest.test.ts`) pour que les tests headless jouent comme un humain.

## Conventions

- Conventional Commits **en français** (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`), commits petits et fréquents, sur `main`.
- Toujours `git add <chemins précis>` (plusieurs agents travaillent en parallèle dans ce dépôt) ; si `index.lock` existe, réessayer quelques secondes plus tard.
- Ne jamais `git push`.
- Pied de commit : `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
