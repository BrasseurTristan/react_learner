import { useEffect, useId, useSyncExternalStore } from 'react'
import { ENEMIES, TOWERS, towerCost } from '../engine/balance'
import type { GameEngine } from '../engine/engine'
import type {
  GameEventName,
  GameEventPayload,
  GameSnapshot,
  SpellName,
  TowerKind,
  TowerProps,
} from '../engine/types'

/**
 * Construit le module `game` que le joueur importe dans son code :
 *   import { Tower, useGame, castSpell, onGameEvent } from 'game'
 * Chaque export est lié à l'instance du moteur du niveau en cours.
 * Les signatures doivent rester synchronisées avec `gameModule.d.ts.txt`.
 */
export function createGameModule(engine: GameEngine) {
  function Tower(props: TowerProps): null {
    const id = useId()
    const { slot, kind, level, target, element } = props
    useEffect(() => {
      engine.upsertTower(id, { slot, kind, level, target, element })
    }, [id, slot, kind, level, target, element])
    useEffect(() => () => engine.removeTower(id), [id])
    return null
  }

  function useGame(): GameSnapshot {
    return useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot)
  }

  function castSpell(name: SpellName): boolean {
    return engine.castSpell(name)
  }

  function onGameEvent(event: GameEventName, handler: (payload: GameEventPayload) => void): () => void {
    if (typeof handler !== 'function') {
      engine.log('error', `onGameEvent("${event}", …) attend une fonction en second argument.`)
      return () => {}
    }
    return engine.on(event, handler)
  }

  function getTowerCost(kind: TowerKind, level = 1): number {
    return towerCost(kind, level)
  }

  function log(message: unknown): void {
    engine.log('info', `📝 ${typeof message === 'string' ? message : JSON.stringify(message)}`)
  }

  const towerInfo = Object.fromEntries(
    Object.entries(TOWERS).map(([k, v]) => [
      k,
      { label: v.label, cost: v.cost, range: v.range, hitsAir: v.hitsAir, pierce: v.pierce, description: v.description },
    ]),
  )
  const enemyInfo = Object.fromEntries(
    Object.entries(ENEMIES).map(([k, v]) => [k, { label: v.label, hp: v.hp, flying: v.flying, armored: v.armored }]),
  )

  return {
    Tower,
    useGame,
    castSpell,
    onGameEvent,
    getTowerCost,
    log,
    TOWER_INFO: towerInfo,
    ENEMY_INFO: enemyInfo,
  }
}

export type GameModule = ReturnType<typeof createGameModule>
