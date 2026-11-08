import * as React from 'react'
import type { ComponentType } from 'react'
import { transform } from 'sucrase'
import type { GameEngine } from '../engine/engine'
import { createGameModule } from './gameModule'

export type CompileResult =
  | { ok: true; Component: ComponentType; js: string }
  | { ok: false; error: string; line?: number }

/** Transpile le TSX du joueur (TypeScript + JSX → JS) sans vérifier les types. */
export function transpile(source: string): { ok: true; js: string } | { ok: false; error: string; line?: number } {
  try {
    const { code } = transform(source, {
      transforms: ['typescript', 'jsx', 'imports'],
      jsxRuntime: 'classic',
      production: true,
      filePath: 'Defense.tsx',
    })
    return { ok: true, js: code }
  } catch (err) {
    const e = err as Error & { loc?: { line: number; column: number } }
    const line = e.loc?.line
    return { ok: false, error: `Erreur de syntaxe${line ? ` ligne ${line}` : ''} : ${e.message.replace(/\s*\(\d+:\d+\)$/, '')}`, line }
  }
}

function makeConsole(engine: GameEngine) {
  const fmt = (args: unknown[]) =>
    args
      .map((a) => {
        if (typeof a === 'string') return a
        try {
          return JSON.stringify(a)
        } catch {
          return String(a)
        }
      })
      .join(' ')
  return {
    log: (...args: unknown[]) => engine.log('info', `📝 ${fmt(args)}`),
    info: (...args: unknown[]) => engine.log('info', `📝 ${fmt(args)}`),
    warn: (...args: unknown[]) => engine.log('warn', `📝 ${fmt(args)}`),
    error: (...args: unknown[]) => engine.log('error', `📝 ${fmt(args)}`),
  }
}

/**
 * Compile et évalue le code du joueur, puis renvoie son composant exporté par défaut.
 * Le code n'a accès qu'aux modules `react` et `game`.
 */
export function compileUserCode(source: string, engine: GameEngine): CompileResult {
  const t = transpile(source)
  if (!t.ok) return t
  const gameModule = createGameModule(engine)
  const modules: Record<string, unknown> = {
    react: { ...React, default: React },
    game: gameModule,
  }
  const require = (name: string) => {
    if (name in modules) return modules[name]
    throw new Error(`Le module "${name}" n’existe pas ici. Tu peux importer depuis "react" ou "game".`)
  }
  const exports: Record<string, unknown> = {}
  const module = { exports }
  try {
    const fn = new Function('require', 'exports', 'module', 'React', 'console', t.js)
    fn(require, exports, module, React, makeConsole(engine))
  } catch (err) {
    return { ok: false, error: `Erreur à l’exécution du module : ${(err as Error).message}` }
  }
  const out = module.exports as Record<string, unknown>
  const Component = out.default
  if (typeof Component !== 'function') {
    const named = Object.keys(out).filter((k) => k !== '__esModule')
    return {
      ok: false,
      error:
        'Ton fichier doit exporter un composant par défaut : `export default function Defense() { … }`' +
        (named.length ? ` (exports trouvés : ${named.join(', ')})` : ''),
    }
  }
  return { ok: true, Component: Component as ComponentType, js: t.js }
}
