import Editor, { type OnMount } from '@monaco-editor/react'
import type * as MonacoNS from 'monaco-editor'
import { useEffect, useRef } from 'react'
import { setupMonaco } from './monacoSetup'

const monaco = setupMonaco()

export interface Diagnostic {
  line: number
  column: number
  message: string
}

interface Props {
  /** Un fichier par niveau : chacun garde son propre historique d'annulation. */
  path: string
  value: string
  onChange: (code: string) => void
  onDiagnostics: (errors: Diagnostic[]) => void
  onRun: () => void
}

export function CodeEditor({ path, value, onChange, onDiagnostics, onRun }: Props) {
  const editorRef = useRef<MonacoNS.editor.IStandaloneCodeEditor | null>(null)
  const onRunRef = useRef(onRun)
  const onDiagRef = useRef(onDiagnostics)
  onRunRef.current = onRun
  onDiagRef.current = onDiagnostics

  useEffect(() => {
    const read = () => {
      const model = editorRef.current?.getModel()
      if (!model) return
      const markers = monaco.editor
        .getModelMarkers({ resource: model.uri })
        .filter((m) => m.severity === monaco.MarkerSeverity.Error)
      onDiagRef.current(markers.map((m) => ({ line: m.startLineNumber, column: m.startColumn, message: m.message })))
    }
    const sub = monaco.editor.onDidChangeMarkers(read)
    read()
    return () => sub.dispose()
  }, [path])

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => onRunRef.current())
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRunRef.current())
    editor.focus()
  }

  return (
    <Editor
      path={path}
      defaultLanguage="typescript"
      value={value}
      theme="react-learner"
      onChange={(v) => onChange(v ?? '')}
      onMount={handleMount}
      loading={<div className="editor-loading">Chargement de l’éditeur…</div>}
      options={{
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 14,
        lineHeight: 22,
        fontLigatures: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        padding: { top: 16, bottom: 16 },
        tabSize: 2,
        renderLineHighlight: 'all',
        bracketPairColorization: { enabled: true },
        automaticLayout: true,
        fixedOverflowWidgets: true,
        quickSuggestions: { other: true, strings: true, comments: false },
      }}
    />
  )
}
