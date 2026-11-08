import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import reactGlobal from '../../node_modules/@types/react/global.d.ts?raw'
import reactIndex from '../../node_modules/@types/react/index.d.ts?raw'
import reactJsxRuntime from '../../node_modules/@types/react/jsx-runtime.d.ts?raw'
import csstype from '../../node_modules/csstype/index.d.ts?raw'
import gameTypes from '../runtime/gameModule.d.ts.txt?raw'

/** Fichier modèle unique édité par le joueur. */
export const USER_FILE_URI = 'file:///src/Defense.tsx'

let configured = false

/** Configure Monaco une seule fois : workers locaux (aucun CDN), types React + module `game`, thème. */
export function setupMonaco(): typeof monaco {
  if (configured) return monaco
  configured = true

  self.MonacoEnvironment = {
    getWorker(_workerId: string, label: string) {
      if (label === 'typescript' || label === 'javascript') return new tsWorker()
      return new editorWorker()
    },
  }
  loader.config({ monaco })
  // En dev, expose Monaco pour les tests automatisés dans le navigateur (window.__monaco.editor.getModels()).
  if (import.meta.env.DEV) (window as unknown as { __monaco: typeof monaco }).__monaco = monaco

  const ts = monaco.languages.typescript
  ts.typescriptDefaults.setCompilerOptions({
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    allowNonTsExtensions: true,
    esModuleInterop: true,
    skipLibCheck: true,
    lib: ['es2020', 'dom'],
  })
  ts.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false })
  ts.typescriptDefaults.setEagerModelSync(true)

  const libs: [string, string][] = [
    [reactIndex, 'file:///node_modules/@types/react/index.d.ts'],
    [reactGlobal, 'file:///node_modules/@types/react/global.d.ts'],
    [reactJsxRuntime, 'file:///node_modules/@types/react/jsx-runtime.d.ts'],
    [csstype, 'file:///node_modules/csstype/index.d.ts'],
    [gameTypes, 'file:///node_modules/@types/game/index.d.ts'],
  ]
  for (const [content, path] of libs) ts.typescriptDefaults.addExtraLib(content, path)

  monaco.editor.defineTheme('react-learner', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6b7a99', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c792ea' },
      { token: 'string', foreground: 'c3e88d' },
      { token: 'number', foreground: 'f78c6c' },
      { token: 'type', foreground: 'ffcb6b' },
      { token: 'identifier', foreground: 'e2e8f0' },
      { token: 'delimiter', foreground: '89ddff' },
      { token: 'tag', foreground: '61dafb' },
    ],
    colors: {
      'editor.background': '#0d1324',
      'editor.foreground': '#e2e8f0',
      'editorLineNumber.foreground': '#3b4766',
      'editorLineNumber.activeForeground': '#61dafb',
      'editor.lineHighlightBackground': '#141c33',
      'editor.selectionBackground': '#2a3a66',
      'editorCursor.foreground': '#61dafb',
      'editorIndentGuide.background1': '#1c2540',
      'editorWidget.background': '#111a30',
      'editorSuggestWidget.background': '#111a30',
      'editorSuggestWidget.selectedBackground': '#1f2c50',
      'scrollbarSlider.background': '#ffffff14',
    },
  })
  return monaco
}

export type Monaco = typeof monaco
