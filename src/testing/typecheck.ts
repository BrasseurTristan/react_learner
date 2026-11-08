import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

const ROOT = resolve(__dirname, '../..')
const GAME_DTS = readFileSync(resolve(ROOT, 'src/runtime/gameModule.d.ts.txt'), 'utf8')

/** Mêmes options que l'éditeur Monaco (voir src/editor/monacoSetup.ts). */
export const USER_COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
  types: [],
}

/** Vérifie les types du code d'un joueur comme le ferait l'éditeur. Renvoie les messages d'erreur. */
export function typecheckUserCode(code: string): string[] {
  const userFile = resolve(ROOT, '__user__/Defense.tsx')
  const gameFile = resolve(ROOT, '__user__/game.d.ts')
  const virtual = new Map([
    [userFile, code],
    [gameFile, GAME_DTS],
  ])
  const host = ts.createCompilerHost(USER_COMPILER_OPTIONS)
  const origGetSourceFile = host.getSourceFile.bind(host)
  host.getSourceFile = (fileName, lang, onError, shouldCreate) => {
    const text = virtual.get(resolve(fileName))
    if (text !== undefined) return ts.createSourceFile(fileName, text, lang)
    return origGetSourceFile(fileName, lang, onError, shouldCreate)
  }
  const origFileExists = host.fileExists.bind(host)
  host.fileExists = (f) => virtual.has(resolve(f)) || origFileExists(f)
  const origReadFile = host.readFile.bind(host)
  host.readFile = (f) => virtual.get(resolve(f)) ?? origReadFile(f)
  host.getCurrentDirectory = () => ROOT

  const program = ts.createProgram([userFile, gameFile], USER_COMPILER_OPTIONS, host)
  const diagnostics = [...program.getSyntacticDiagnostics(), ...program.getSemanticDiagnostics()].filter(
    (d) => !d.file || resolve(d.file.fileName) === userFile,
  )
  return diagnostics.map((d) => {
    const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n')
    if (d.file && d.start !== undefined) {
      const { line } = d.file.getLineAndCharacterOfPosition(d.start)
      return `ligne ${line + 1} : ${msg}`
    }
    return msg
  })
}
