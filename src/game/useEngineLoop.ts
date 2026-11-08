import { useEffect, useRef } from 'react'
import type { GameEngine } from '../engine/engine'

/** Fait avancer le moteur à chaque frame du navigateur, multiplié par la vitesse choisie. */
export function useEngineLoop(engine: GameEngine, speed: number, paused: boolean) {
  const speedRef = useRef(speed)
  const pausedRef = useRef(paused)
  speedRef.current = speed
  pausedRef.current = paused
  useEffect(() => {
    let last = performance.now()
    let raf = 0
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      if (!pausedRef.current) {
        // Sous-pas pour garder une simulation stable en vitesse ×4.
        const total = dt * speedRef.current
        const steps = Math.max(1, Math.ceil(total / 0.05))
        for (let i = 0; i < steps; i++) engine.tick(total / steps)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [engine])
}
