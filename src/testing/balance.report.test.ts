import { it } from 'vitest'
import { LEVELS } from '../levels'
import { simulateLevel } from './simulate'

// Rapport d'équilibrage : lancer avec `npx vitest run balance.report`.
it('rapport', async () => {
  for (const l of LEVELS) {
    const s = await simulateLevel(l, l.solution)
    const st = await simulateLevel(l, l.starterCode)
    console.log(`${l.id}: solution -> ${s.phase} vies ${s.engine.lives}/${l.game.lives} or ${s.engine.gold} t=${s.engine.time.toFixed(0)}s | départ -> ${st.phase} vies ${st.engine.lives}`)
  }
})
