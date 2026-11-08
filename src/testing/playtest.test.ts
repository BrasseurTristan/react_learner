import { expect, it } from 'vitest'
import { level01 } from '../levels/level01'
import { simulateLevel } from './simulate'

it('playtest : les clics et saisies atteignent le composant du joueur', async () => {
  const code = `import { useState } from 'react'
import { Tower, type TowerKind } from 'game'
export default function Defense() {
  const [on, setOn] = useState(false)
  const [kind, setKind] = useState<TowerKind>('cannon')
  return (<>
    <select value={kind} onChange={(e) => setKind(e.target.value as TowerKind)}>
      <option value="cannon">c</option><option value="archer">a</option>
    </select>
    <button onClick={() => setOn(true)}>Construire</button>
    {on && <Tower slot="A" kind={kind} />}
  </>)
}`
  const withoutPlay = await simulateLevel(level01, code)
  expect(withoutPlay.victory).toBe(false)
  const level = {
    ...level01,
    playtest: (ui: Parameters<NonNullable<typeof level01.playtest>>[0]) => {
      if (ui.memory.done) return
      expect(ui.setValue('select', 'archer')).toBe(true)
      expect(ui.click('Construire')).toBe(true)
      ui.memory.done = true
    },
  }
  const played = await simulateLevel(level, code)
  expect(played.victory).toBe(true)
  expect(played.engine.stats.towerKindsUsed).toEqual(['archer'])
})
