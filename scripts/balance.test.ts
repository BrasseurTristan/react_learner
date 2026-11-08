/**
 * Rapport d'équilibrage : `npm run balance`.
 * Joue chaque niveau en headless avec sa solution puis avec son code de départ,
 * et affiche l'issue, les vies restantes et les objectifs manqués.
 * Ce fichier n'est pas inclus dans `npm test` (voir vite.config.ts).
 */
import { it } from 'vitest'
import { LEVELS } from '../src/levels'
import { simulateLevel, type SimulationResult } from '../src/testing/simulate'
import { typecheckUserCode } from '../src/testing/typecheck'

function outcome(r: SimulationResult): string {
  if (r.compileError) return 'erreur de compilation'
  if (r.renderError) return 'erreur au rendu'
  if (r.victory) return 'victoire'
  if (r.phase === 'defeat') return 'défaite'
  return `inachevé (${r.phase})`
}

function describeRun(r: SimulationResult): string {
  const e = r.engine
  const failed = r.objectives.filter((o) => !o.pass).map((o) => o.id)
  const lives = `${e.lives}/${e.config.lives} vies`
  const waves = `vague ${e.stats.wavesCleared}/${e.config.waves.length}`
  return `${outcome(r).padEnd(12)} ${lives.padEnd(11)} ${waves.padEnd(11)} ${
    failed.length ? `objectifs manqués : ${failed.join(', ')}` : 'tous les objectifs ✔'
  }`
}

it('rapport d’équilibrage', async () => {
  const lines: string[] = ['', '═══ Équilibrage des niveaux ═══', '']
  let problems = 0
  for (const level of LEVELS) {
    const solution = await simulateLevel(level, level.solution, { tsErrors: typecheckUserCode(level.solution).length })
    const starter = await simulateLevel(level, level.starterCode, {
      tsErrors: typecheckUserCode(level.starterCode).length,
    })
    const margin = solution.engine.lives / solution.engine.config.lives
    const warnings: string[] = []
    if (!solution.allPassed) warnings.push('la solution ne réussit pas le niveau')
    else if (margin < 0.4) warnings.push('solution gagnée de justesse')
    if (starter.allPassed) warnings.push('le code de départ réussit le niveau')
    problems += warnings.length
    lines.push(`Niveau ${String(level.number).padStart(2, '0')} — ${level.title} (${level.concept})`)
    lines.push(`  solution : ${describeRun(solution)}`)
    lines.push(`  départ   : ${describeRun(starter)}`)
    for (const w of warnings) lines.push(`  ⚠️  ${w}`)
    lines.push('')
  }
  lines.push(problems ? `${problems} point(s) à surveiller.` : 'Aucun problème détecté.', '')
  process.stdout.write(lines.join('\n') + '\n')
})
