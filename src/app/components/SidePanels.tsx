import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import type { GameEngine } from '../../engine/engine'
import type { ObjectiveResult } from '../../runtime/evaluate'
import { pop } from '../anim'
import { InlineMarkdown } from '../Markdown'

export function ObjectivesPanel({ results }: { results: ObjectiveResult[] }) {
  const refs = useRef(new Map<string, HTMLLIElement>())
  const prev = useRef(new Map<string, boolean>())
  useEffect(() => {
    for (const r of results) {
      if (r.pass && prev.current.get(r.id) === false) pop(refs.current.get(r.id)?.querySelector('.obj-icon') ?? null)
      prev.current.set(r.id, r.pass)
    }
  }, [results])
  const done = results.filter((r) => r.pass).length
  return (
    <div className="objectives">
      <div className="objectives-progress">
        <div className="bar">
          <div className="bar-fill" style={{ width: `${(done / Math.max(1, results.length)) * 100}%` }} />
        </div>
        <span>
          {done}/{results.length}
        </span>
      </div>
      <ul>
        {results.map((r) => (
          <li
            key={r.id}
            ref={(el) => {
              if (el) refs.current.set(r.id, el)
            }}
            className={r.pass ? 'pass' : ''}
          >
            <span className="obj-icon">{r.pass ? '✔' : ''}</span>
            <InlineMarkdown source={r.label} />
          </li>
        ))}
      </ul>
    </div>
  )
}

export function LogPanel({ engine }: { engine: GameEngine }) {
  useSyncExternalStore(engine.subscribe, () => engine.logVersion)
  const list = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight
  })
  return (
    <div className="log" ref={list}>
      {engine.logs.length === 0 && (
        <div className="log-empty">
          <span className="empty-icon">📜</span>
          <span className="empty-title">Journal vide pour l’instant</span>
          <span>
            Les événements de la partie et tes <code>console.log</code> s’afficheront ici.
          </span>
        </div>
      )}
      {engine.logs.map((l) => (
        <div key={l.id} className={`log-line ${l.level}`}>
          <span className="log-time">{l.time.toFixed(1)}s</span>
          {/* Les messages du joueur (console.log) sont affichés en texte brut. */}
          {l.message.startsWith('📝') ? <span>{l.message}</span> : <InlineMarkdown source={l.message} />}
        </div>
      ))}
    </div>
  )
}
