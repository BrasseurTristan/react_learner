import type { MapDef } from '../../engine/types'

/** Convertit des coordonnées de case en coordonnées monde, plateau centré sur l'origine. */
export function toWorld(map: MapDef, x: number, z: number): [number, number] {
  return [x - (map.width - 1) / 2, z - (map.depth - 1) / 2]
}

/** Générateur pseudo-aléatoire déterministe (le décor reste identique d'un rendu à l'autre). */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Cases traversées par le chemin. */
export function pathCells(map: MapDef): Set<string> {
  const cells = new Set<string>()
  for (let i = 0; i < map.path.length - 1; i++) {
    const a = map.path[i]
    const b = map.path[i + 1]
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) * 4)
    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps
      cells.add(`${Math.round(a.x + (b.x - a.x) * t)},${Math.round(a.z + (b.z - a.z) * t)}`)
    }
  }
  return cells
}
