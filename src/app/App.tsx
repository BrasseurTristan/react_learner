import { useCallback, useState } from 'react'
import { getLevel, LEVELS } from '../levels'
import { LevelSelect } from './components/Dialogs'
import { LevelSession } from './LevelSession'
import { loadSave, resetSave, writeSave, type LevelProgress, type SaveData } from './storage'

export function App() {
  const [save, setSave] = useState<SaveData>(loadSave)
  const [levelId, setLevelId] = useState(() =>
    save.currentLevel && getLevel(save.currentLevel) ? save.currentLevel : LEVELS[0].id,
  )
  const [showLevels, setShowLevels] = useState(false)
  const level = getLevel(levelId) ?? LEVELS[0]
  const index = LEVELS.indexOf(level)
  const completed = LEVELS.filter((l) => save.levels[l.id]?.completed).length

  const updateProgress = useCallback((id: string, patch: LevelProgress) => {
    setSave((prev) => {
      const next: SaveData = { ...prev, levels: { ...prev.levels, [id]: { ...prev.levels[id], ...patch } } }
      writeSave(next)
      return next
    })
  }, [])

  const goTo = useCallback((id: string) => {
    setLevelId(id)
    setShowLevels(false)
    setSave((prev) => {
      const next = { ...prev, currentLevel: id }
      writeSave(next)
      return next
    })
  }, [])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <span>
            React<b>Learner</b>
          </span>
        </div>
        <button className="level-pill" onClick={() => setShowLevels(true)} title="Choisir un niveau">
          <span className="level-pill-num">{level.number}</span>
          <span className="level-pill-title">{level.title}</span>
          <span className="level-pill-caret">▾</span>
        </button>
        <div className="progress" title={`${completed} niveau(x) réussi(s) sur ${LEVELS.length}`}>
          <div className="bar">
            <div className="bar-fill" style={{ width: `${(completed / LEVELS.length) * 100}%` }} />
          </div>
          <span>
            {completed}/{LEVELS.length}
          </span>
        </div>
      </header>

      <LevelSession
        key={level.id}
        level={level}
        progress={save.levels[level.id] ?? {}}
        onProgress={(patch) => updateProgress(level.id, patch)}
        hasNext={index < LEVELS.length - 1}
        onNext={() => index < LEVELS.length - 1 && goTo(LEVELS[index + 1].id)}
        onOpenLevels={() => setShowLevels(true)}
      />

      {showLevels && (
        <LevelSelect
          levels={LEVELS}
          progress={save.levels}
          currentId={level.id}
          onPick={goTo}
          onClose={() => setShowLevels(false)}
          onResetProgress={() => {
            resetSave()
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}
